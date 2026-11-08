'use strict';
// Builds assets/fontindex/: a compact fingerprint of the most popular Google Fonts families, so
// "Detect font" can rank them offline in a fraction of a second and check only the closest few
// precisely. Run it once in a while (the catalogue changes slowly):
//
//   env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/build-font-index.js [families=1000]
//
// Per family it keeps up to two weights (the ones nearest 400 and 700). Per weight and character
// (0-9 A-Z a-z) it stores the glyph trimmed to its ink and scaled to a GW×GH grid at 4 bits a pixel,
// plus its aspect ratio — the same normalisation fonts-detect.js applies to a face's pictures.
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

process.env.DIALCRAFT_HIDDEN = '1';
require(path.join(__dirname, '..', 'main.js'));

const COUNT = +(process.argv.find((a) => /^\d+$/.test(a)) || 1000);
const OUT = path.join(__dirname, '..', 'assets', 'fontindex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RENDERER = `
window.__buildIndex = async (COUNT) => {
  const CHARS = FD_INDEX_CHARS, GW = FD_COARSE[0], GH = FD_COARSE[1], PER = Math.ceil(GW * GH / 2) + 2;
  const cat = (await API.gfontsCatalog({})).families;
  const fams = cat.filter((f) => !f.isBrandFont && (f.subsets || []).includes('latin')).slice(0, COUNT);
  const jobs = [];
  for (const f of fams) {
    const avail = fdetWeights(f);
    const near = (t) => avail.slice().sort((a, b) => Math.abs(a - t) - Math.abs(b - t) || a - b)[0];
    const ws = [near(400)];
    const bold = near(700);
    if (bold != null && Math.abs(bold - ws[0]) >= 200) ws.push(bold);
    for (const w of ws) jobs.push({ f, w });
  }
  const entries = new Array(jobs.length), blobs = new Array(jobs.length);
  let at = 0, done = 0, failed = 0;
  const one = async (job, k) => {
    let rec = null;
    try { rec = await API.gfontsSubset({ family: job.f.family, weight: job.w }); } catch (e) { rec = null; }
    if (!rec || rec.error) { failed++; return; }
    const alias = '__idx_' + k;
    let ff;
    try {
      ff = new FontFace(alias, 'url("data:font/' + (rec.format || 'truetype') + ';base64,' + rec.dataBase64 + '")', { weight: String(job.w) });
      await ff.load(); document.fonts.add(ff);
    } catch (e) { failed++; return; }
    const buf = new Uint8Array(CHARS.length * PER);
    let have = 0;
    for (let c = 0; c < CHARS.length; c++) {
      const g = fdetCoarseGlyph(alias, job.w, CHARS[c]);
      if (!g) continue;
      have++;
      fdetPackCoarse(g, buf, c * PER);
    }
    document.fonts.delete(ff);
    if (have < 30) { failed++; return; }
    entries[k] = [job.f.family, job.w, job.f.category || ''];
    blobs[k] = buf;
  };
  const worker = async () => { while (at < jobs.length) { const k = at++; await one(jobs[k], k); if (++done % 100 === 0) console.log('index ' + done + '/' + jobs.length + ' failed ' + failed); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  const keep = entries.map((e, i) => (e ? i : -1)).filter((i) => i >= 0);
  const all = new Uint8Array(keep.length * CHARS.length * PER);
  keep.forEach((i, j) => all.set(blobs[i], j * CHARS.length * PER));
  return { meta: { version: 1, built: new Date().toISOString().slice(0, 10), chars: CHARS, gw: GW, gh: GH, entries: keep.map((i) => entries[i]) },
    bin: all, failed };
};
0`;

app.whenReady().then(async () => {
  let win = null;
  for (let i = 0; i < 40 && !win; i++) { win = BrowserWindow.getAllWindows()[0]; if (!win) await sleep(200); }
  await sleep(1500);
  win.webContents.on('console-message', (...a) => { const e = a[0]; const m = e && e.message != null ? e.message : a[2]; if (/^index /.test(String(m))) console.log(m); });
  try {
    await win.webContents.executeJavaScript(RENDERER, true);
    const t0 = Date.now();
    const res = await win.webContents.executeJavaScript(`window.__buildIndex(${COUNT})`, true);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(res.meta));
    fs.writeFileSync(path.join(OUT, 'index.bin'), Buffer.from(res.bin));
    console.log(`wrote ${res.meta.entries.length} font weights (${(res.bin.length / 1e6).toFixed(1)} MB), ${res.failed} failed, ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (e) { console.error('BUILD ERR', e && e.stack || e); process.exitCode = 1; }
  app.exit(process.exitCode || 0);
});
