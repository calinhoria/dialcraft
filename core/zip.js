'use strict';
// Minimal ZIP writer (deflate + store). Enough to hand a whole designer project
// to a phone/browser over the LAN installer without pulling in a dependency.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// PNG/ZAB/ZIP are already compressed; storing them keeps zips fast.
const STORE_EXT = /\.(png|jpe?g|gif|webp|zab|zip|bin)$/i;

function dosDateTime(date) {
  const d = date || new Date();
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const day = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time: time & 0xffff, date: day & 0xffff };
}

// entries: [{ name, data (Buffer|string), mode? }]
function createZip(entries, opts = {}) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const { date } = dosDateTime(opts.date);
  const { time } = dosDateTime(opts.date);

  for (const entry of entries) {
    const name = String(entry.name).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!name || name.endsWith('/')) continue;
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const crc = crc32(raw);
    const store = STORE_EXT.test(name);
    const body = store ? raw : zlib.deflateRawSync(raw, { level: 9 });
    const method = store ? 0 : 8;
    const nameBuf = Buffer.from(name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0, 6);           // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);          // extra length
    chunks.push(local, nameBuf, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(0x031e, 4);        // version made by (unix)
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(((entry.mode || 0o100644) << 16) >>> 0, 38);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2 > 0xffff ? 0xffff : central.length / 2, 8);
  end.writeUInt16LE(central.length / 2 > 0xffff ? 0xffff : central.length / 2, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, end]);
}

// Walk a folder (skipping heavy build output) into zip entries.
function zipDirectory(dir, opts = {}) {
  const skip = opts.skip || /(^|[\\/])(node_modules|dist|\.git)([\\/]|$)/;
  const entries = [];
  const root = path.resolve(dir);
  const walk = (cur) => {
    let names = [];
    try { names = fs.readdirSync(cur); } catch (e) { return; }
    for (const n of names) {
      const full = path.join(cur, n);
      if (skip.test(full)) continue;
      let st;
      try { st = fs.statSync(full); } catch (e) { continue; }
      if (st.isDirectory()) { walk(full); continue; }
      if (st.size > (opts.maxFile || 24 * 1024 * 1024)) continue;
      entries.push({ name: path.relative(root, full).split(path.sep).join('/'), data: fs.readFileSync(full) });
    }
  };
  walk(root);
  return entries;
}

// Unpack a .zip into `dest` (created). Entries that would land outside `dest`
// ("../x", absolute paths) are refused, macOS `__MACOSX` litter is skipped and
// the total size is capped so a hostile archive cannot fill the disk.
function extractZip(file, dest, opts = {}) {
  const maxTotal = opts.maxTotal || 600 * 1024 * 1024;
  const buf = fs.readFileSync(file);
  // end of central directory record: scan back for its signature
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a valid .zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const root = path.resolve(dest);
  fs.mkdirSync(root, { recursive: true });
  let total = 0, written = 0;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt .zip directory');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString((flags & 0x800) ? 'utf8' : 'utf8');
    p += 46 + nlen + elen + clen;
    if (!name || name.endsWith('/') || /(^|\/)__MACOSX(\/|$)/.test(name) || /(^|\/)\.DS_Store$/.test(name)) continue;
    const target = path.resolve(root, name);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error(`unsafe path in the .zip: ${name}`);
    total += usize;
    if (total > maxTotal) throw new Error('the .zip is too large to import');
    if (buf.readUInt32LE(lho) !== 0x04034b50) throw new Error('corrupt .zip entry');
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.slice(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else throw new Error(`unsupported compression (method ${method}) for ${name}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    written++;
  }
  return written;
}

module.exports = { createZip, zipDirectory, crc32, extractZip };
