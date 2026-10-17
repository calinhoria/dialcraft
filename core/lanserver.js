'use strict';
// Tiny LAN file server used by the "Install over Wi-Fi" feature.
//
// It publishes a built .zab (and a few human-friendly extras: preview.png, the
// Zeus project as source.zip, manifest.json) on the local network so a phone
// can reach it by scanning a QR code. The Zepp App (Profile -> device ->
// Developer Mode -> scan) fetches the package straight from here; a plain
// browser gets an instruction page instead.

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { createZip, zipDirectory } = require('./zip');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.zab': 'application/octet-stream',
  '.zip': 'application/zip',
};

function mimeFor(name) {
  return MIME[path.extname(String(name)).toLowerCase()] || 'application/octet-stream';
}

function humanSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

// Every non-internal IPv4 address, best candidate first.
function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family !== 'IPv4' || ni.internal) continue;
      out.push({ iface: name, address: ni.address });
    }
  }
  const rank = (a) => {
    if (/^192\.168\./.test(a)) return 0;
    if (/^10\./.test(a)) return 1;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(a)) return 2;
    if (/^169\.254\./.test(a)) return 4; // link-local: almost never reachable
    return 3;
  };
  return out.sort((a, b) => rank(a.address) - rank(b.address) || a.iface.localeCompare(b.iface));
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

class LanServer {
  constructor(opts = {}) {
    this.name = opts.name || 'watchface';
    this.device = opts.device || '';
    this.target = opts.target || '';
    this.dir = opts.dir || null;
    this.files = (opts.files || []).filter((f) => f && f.path && fs.existsSync(f.path));
    this.address = opts.address || (lanAddresses()[0] || {}).address || '127.0.0.1';
    this.port = 0;
    this.server = null;
    this.startedAt = 0;
    this.requestCount = 0;
    this.onRequest = opts.onRequest || (() => { });
    this.onError = opts.onError || (() => { });
  }

  get running() { return !!this.server; }

  baseUrl() { return `http://${this.address}:${this.port}`; }

  installFile() { return this.files.find((f) => /\.zab$/i.test(f.path)) || this.files[0] || null; }

  installUrl() {
    const f = this.installFile();
    return f ? `${this.baseUrl()}/${encodeURIComponent(f.route)}` : this.baseUrl() + '/';
  }

  pageUrl() { return this.baseUrl() + '/'; }

  status() {
    return {
      running: this.running,
      port: this.port,
      host: this.address,
      addresses: lanAddresses(),
      name: this.name,
      device: this.device,
      target: this.target,
      dir: this.dir,
      startedAt: this.startedAt,
      requests: this.requestCount,
      files: this.files.map((f) => ({
        route: f.route,
        label: f.label || f.route,
        kind: f.kind || 'file',
        size: (() => { try { return fs.statSync(f.path).size; } catch (e) { return 0; } })(),
      })),
      pageUrl: this.running ? this.pageUrl() : null,
      installUrl: this.running ? this.installUrl() : null,
    };
  }

  landingPage() {
    const f = this.installFile();
    const rows = this.files.map((x) => {
      const size = (() => { try { return humanSize(fs.statSync(x.path).size); } catch (e) { return ''; } })();
      const isPkg = /\.zab$/i.test(x.path);
      return `<li><a href="/${encodeURIComponent(x.route)}"><b>${escapeHtml(x.label || x.route)}</b></a>
        <span>${escapeHtml(x.kind || 'file')} · ${escapeHtml(size)}</span>
        ${isPkg ? '<a class="btn" href="/' + encodeURIComponent(x.route) + '">Download package</a>' : ''}</li>`;
    }).join('\n');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(this.name)} · install</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;padding:24px;background:#0b0f14;color:#e8eef6;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  main{max-width:640px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#8b9bb0;margin-bottom:22px}
  ol{padding-left:22px} li{margin:6px 0}
  ul{list-style:none;padding:0}
  ul li{border:1px solid #1f2b3a;border-radius:12px;padding:12px 14px;margin:8px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;background:#111823}
  ul li span{color:#8b9bb0;font-size:13px}
  a{color:#7cc4ff;text-decoration:none}
  a.btn{background:#1d6fd0;color:#fff;padding:8px 14px;border-radius:10px;font-weight:600}
  code{background:#111823;border:1px solid #1f2b3a;border-radius:6px;padding:1px 6px}
  .card{border:1px solid #1f2b3a;border-radius:14px;padding:16px;background:#111823;margin-top:18px}
  .muted{color:#8b9bb0;font-size:13px;margin-top:22px}
</style></head>
<body><main>
  <h1>${escapeHtml(this.name)}</h1>
  <div class="sub">${escapeHtml(this.device || '')}${this.target ? ' · ' + escapeHtml(this.target) : ''}</div>
  ${f ? `<p><a class="btn" href="/${encodeURIComponent(f.route)}">Install package (${escapeHtml(f.label || f.route)})</a></p>` : '<p>No built package on this server yet.</p>'}
  <div class="card">
    <h3>Install on the watch</h3>
    <ol>
      <li>Phone and computer on the same Wi-Fi.</li>
      <li>Open the Zepp App → Profile → your device → <b>Developer Mode</b>.</li>
      <li>Tap the scan icon (top right) and scan the QR code shown in the designer.</li>
      <li>Confirm the install, then pick the watchface on the watch.</li>
    </ol>
    <p class="muted">A phone camera pointed at the QR opens this page instead — download the package here and share it to the Zepp App.</p>
  </div>
  ${this.files.length ? `<div class="card"><h3>Files</h3><ul>${rows}</ul></div>` : ''}
  <div class="card"><h3>Also available</h3><ul>
    <li><a href="/source.zip"><b>source.zip</b></a><span>the whole Zeus project</span></li>
    <li><a href="/manifest.json"><b>manifest.json</b></a><span>machine readable listing</span></li>
  </ul></div>
  <p class="muted">Served by Amazfit Watchface Designer · ${escapeHtml(this.baseUrl() || '')}</p>
</main></body></html>`;
  }

  manifest() {
    const f = this.installFile();
    return {
      name: this.name,
      device: this.device,
      target: this.target,
      server: this.baseUrl(),
      installUrl: this.running ? this.installUrl() : null,
      package: f ? { file: f.label || f.route, route: '/' + f.route, size: (() => { try { return fs.statSync(f.path).size; } catch (e) { return 0; } })() } : null,
      files: this.files.map((x) => ({ route: '/' + x.route, kind: x.kind || 'file', size: (() => { try { return fs.statSync(x.path).size; } catch (e) { return 0; } })() })),
      generatedAt: new Date().toISOString(),
    };
  }

  handle(req, res) {
    const u = new URL(req.url, 'http://localhost');
    const route = decodeURIComponent(u.pathname);
    const ip = (req.socket && req.socket.remoteAddress) || '';
    this.requestCount++;
    const done = (status, label) => this.onRequest({ method: req.method, url: route, status, label, ip, at: Date.now() });

    const send = (status, headers, body) => {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
      res.writeHead(status, { 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...headers });
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(buf);
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      done(405, 'method not allowed');
      return send(405, { 'Content-Type': 'text/plain' }, 'Method not allowed\n');
    }
    if (route === '/' || route === '/index.html') {
      done(200, 'landing page');
      return send(200, { 'Content-Type': MIME['.html'] }, this.landingPage());
    }
    if (route === '/manifest.json') {
      done(200, 'manifest');
      return send(200, { 'Content-Type': MIME['.json'] }, JSON.stringify(this.manifest(), null, 2));
    }
    if (route === '/health') {
      done(200, 'health');
      return send(200, { 'Content-Type': MIME['.json'] }, JSON.stringify({ ok: true, port: this.port, name: this.name, requests: this.requestCount }));
    }
    if (route === '/source.zip') {
      if (!this.dir || !fs.existsSync(this.dir)) {
        done(404, 'no source');
        return send(404, { 'Content-Type': 'text/plain' }, 'No project folder behind this server.\n');
      }
      try {
        const zip = createZip(zipDirectory(this.dir));
        done(200, `source.zip (${humanSize(zip.length)})`);
        return send(200, { 'Content-Type': MIME['.zip'], 'Content-Disposition': 'attachment; filename="' + this.name.replace(/[^\w\-.]+/g, '_') + '-source.zip"' }, zip);
      } catch (err) {
        done(500, 'zip failed');
        return send(500, { 'Content-Type': 'text/plain' }, 'Could not build source.zip: ' + String(err.message || err) + '\n');
      }
    }

    const wanted = route.replace(/^\/+/, '');
    let file = this.files.find((f) => f.route === wanted || path.basename(f.path) === wanted);
    let full = file ? file.path : null;
    if (!full && this.dir) {
      // static fallback inside the project folder (traversal guarded)
      const cand = path.resolve(this.dir, wanted);
      if (cand.startsWith(path.resolve(this.dir) + path.sep) && fs.existsSync(cand) && fs.statSync(cand).isFile()) full = cand;
    }
    if (!full || !fs.existsSync(full)) {
      done(404, 'not found');
      return send(404, { 'Content-Type': 'text/plain' }, 'Not found: ' + route + '\n');
    }
    let st;
    try { st = fs.statSync(full); } catch (e) {
      done(404, 'not found');
      return send(404, { 'Content-Type': 'text/plain' }, 'Not found\n');
    }
    const headers = { 'Content-Type': mimeFor(full), 'Content-Length': st.size };
    if ((file && file.download) || /\.zab$/i.test(full)) {
      headers['Content-Disposition'] = 'attachment; filename="' + path.basename(full) + '"';
    }
    done(200, `${path.basename(full)} (${humanSize(st.size)})`);
    res.writeHead(200, { 'Cache-Control': 'no-store', ...headers });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(full).pipe(res);
  }

  start(port) {
    return new Promise((resolve, reject) => {
      if (this.running) return resolve(this.status());
      const wanted = Math.max(1, Math.min(65535, Number(port) || 7331));
      let attempt = 0;
      const tryListen = (p) => {
        const server = http.createServer((req, res) => {
          try { this.handle(req, res); } catch (err) {
            this.onError(err);
            try { res.writeHead(500); res.end('error\n'); } catch (e) { /* sent */ }
          }
        });
        server.on('error', (err) => {
          if (err && err.code === 'EADDRINUSE' && attempt < 20) {
            attempt++;
            tryListen(p + 1);
            return;
          }
          this.server = null;
          this.onError(err);
          reject(err);
        });
        server.listen(p, '0.0.0.0', () => {
          this.server = server;
          this.port = p;
          this.startedAt = Date.now();
          resolve(this.status());
        });
      };
      tryListen(wanted);
    });
  }

  stop() {
    return new Promise((resolve) => {
      const srv = this.server;
      this.server = null;
      this.port = 0;
      if (!srv) return resolve(false);
      try { srv.close(() => resolve(true)); } catch (e) { resolve(false); }
      setTimeout(() => { try { srv.closeAllConnections && srv.closeAllConnections(); } catch (e) { /* ignore */ } }, 400);
    });
  }

  update(partial = {}) {
    if (partial.files) this.files = partial.files.filter((f) => f && f.path && fs.existsSync(f.path));
    if (partial.name) this.name = partial.name;
    if (partial.device !== undefined) this.device = partial.device;
    if (partial.target !== undefined) this.target = partial.target;
    if (partial.dir !== undefined) this.dir = partial.dir;
    if (partial.address) this.address = partial.address;
    return this.status();
  }
}

module.exports = { LanServer, lanAddresses, mimeFor, humanSize };
