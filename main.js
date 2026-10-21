'use strict';
// Electron main process: file system + Zepp project I/O for the designer.
// The renderer holds the editing model; everything that touches disk (importing
// images, saving the project, exporting a Zeus CLI project, calling the Zeus
// CLI) happens here and is exposed through preload.js.
const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { PNG } = require('pngjs');
const QRCode = require('qrcode');
const { DEVICES, deviceByKey, deviceLabel } = require('./core/devices');
const { DATA_TYPES, WEATHER_ICONS, SYSTEM_STATUS, TAP_APPS, SYSTEM_APPS, DT_MAX, EDIT_TYPES } = require('./core/datatypes');
const { KINDS, SHOW_LEVELS } = require('./core/kinds');
const { BUNDLED_FONTS, fontInfoFromBuffer, readCmapRanges, isFontFile, fontFormat, zeusApiLevel, FONT_VARIATIONS } = require('./core/fonts');
const { LanServer, lanAddresses } = require('./core/lanserver');
const { importFaceDir } = require('./core/importface');
const { extractZip } = require('./core/zip');
const { appIconPng } = require('./core/icon');
const {
  generateWatchface, generateAppJson, generateAppJs, generateProjectReadme, animPrefixFor,
} = require('./core/codegen');

// The app was "Amazfit Watchface Designer" before it became Dialcraft; its
// settings folder moves with the name, so carry the recent-projects list over
// once instead of starting empty.
function migrateUserData() {
  try {
    const now = app.getPath('userData');
    const recent = path.join(now, 'recent-projects.json');
    if (fs.existsSync(recent)) return;
    for (const old of ['Amazfit Watchface Designer', 'amazfit-watchface-designer']) {
      const prev = path.join(app.getPath('appData'), old, 'recent-projects.json');
      if (fs.existsSync(prev)) {
        fs.mkdirSync(now, { recursive: true });
        fs.copyFileSync(prev, recent);
        return;
      }
    }
  } catch (e) { /* a fresh list is fine */ }
}
let win = null;
// tools/make-icon.js renders it
const APP_ICON = path.join(__dirname, 'build', 'icon.png');
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 940,
    minWidth: 1080, minHeight: 700,
    backgroundColor: '#0e1015',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      // the canvas runs a live clock; keep the renderer ticking when unfocused
      backgroundThrottling: false,
    },
    title: 'Dialcraft',
    icon: APP_ICON,
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // Surface renderer errors on the terminal — the designer does all its work in
  // the renderer, so a console error there is the quickest way to see a problem.
  win.webContents.on('console-message', (...args) => {
    const e = args[0];
    const level = e && typeof e === 'object' && e.level != null ? e.level : args[1];
    const message = e && typeof e === 'object' && e.message != null ? e.message : args[2];
    const source = e && typeof e === 'object' && e.sourceId != null ? e.sourceId : args[4];
    if (level === 2 || level === 3 || level === 'error' || level === 'warning') {
      console.error(`[renderer:${level}] ${message}${source ? ` (${source})` : ''}`);
    }
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer gone]', JSON.stringify(details));
    rendererGone = true;
  });
  // Closing asks the renderer first: it owns the editing model and knows
  // whether there are unsaved changes (it answers with 'close-confirmed').
  rendererGone = false;
  closeConfirmed = false;
  win.on('close', (e) => {
    if (closeConfirmed || rendererGone || win.webContents.isLoading()) return;
    e.preventDefault();
    win.webContents.send('close-request');
  });
}
let closeConfirmed = false;
let rendererGone = false;
let quitting = false;
app.on('before-quit', () => { quitting = true; });
ipcMain.handle('close-confirmed', async () => {
  closeConfirmed = true;
  if (win && !win.isDestroyed()) win.close();
  if (quitting) app.quit();
});
// the renderer cancelled the close (it chose to keep editing)
ipcMain.handle('close-cancelled', async () => { quitting = false; });
// Save / Don't save / Cancel before work would be thrown away
ipcMain.handle('confirm-unsaved', async (_e, opts = {}) => {
  const r = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Save', "Don't save", 'Cancel'],
    defaultId: 0, cancelId: 2,
    message: `Save the changes to “${opts.name || 'this watchface'}”?`,
    detail: opts.detail || 'Your changes will be lost if you don\'t save them.',
  });
  return ['save', 'discard', 'cancel'][r.response] || 'cancel';
});
// ------------------------------------------------------------------ updates --
// Checks GitHub releases (see core/updater.js for which installs can update in place)
const UPDATE_REPO = 'calinhoria/dialcraft';
let updater = null;
function updateSettingsFile() { return path.join(app.getPath('userData'), 'updates.json'); }
const updateSettings = {
  get() { try { return { auto: true, skip: '', ...JSON.parse(fs.readFileSync(updateSettingsFile(), 'utf8')) }; } catch (e) { return { auto: true, skip: '' }; } },
  set(patch) { try { fs.writeFileSync(updateSettingsFile(), JSON.stringify({ ...updateSettings.get(), ...patch }, null, 2)); } catch (e) { /* read-only profile */ } },
};
function getUpdater() {
  if (updater) return updater;
  let autoUpdater = null;
  if (app.isPackaged) { try { ({ autoUpdater } = require('electron-updater')); autoUpdater.logger = null; } catch (e) { autoUpdater = null; } }
  updater = require('./core/updater').createUpdater({
    autoUpdater, currentVersion: app.getVersion(), platform: process.platform, env: process.env, isPackaged: app.isPackaged && !!autoUpdater,
    repo: UPDATE_REPO, openExternal: (url) => { if (/^https:\/\/github\.com\//.test(url)) shell.openExternal(url); },
    send: (st) => { if (win && !win.isDestroyed()) win.webContents.send('update-state', st); },
    settings: updateSettings,
  });
  return updater;
}
ipcMain.handle('update-state', () => ({ ...getUpdater().state(), auto: updateSettings.get().auto }));
ipcMain.handle('update-check', () => getUpdater().check({ manual: true }));
ipcMain.handle('update-download', () => getUpdater().download());
ipcMain.handle('update-install', () => getUpdater().install());
ipcMain.handle('update-skip', () => getUpdater().skip());
ipcMain.handle('update-auto', (_e, on) => { updateSettings.set({ auto: !!on }); return !!on; });

app.whenReady().then(() => {
  migrateUserData();
  // a packaged app takes build/icon.icns; a dev run would show Electron's own
  if (process.platform === 'darwin' && app.dock && fs.existsSync(APP_ICON)) app.dock.setIcon(APP_ICON);
  createWindow();
  // a quiet check a few seconds after start-up (installed app only, and only if the wearer left it on)
  setTimeout(() => { try { if (app.isPackaged && updateSettings.get().auto) getUpdater().check({ manual: false }); } catch (e) { /* never block start-up */ } }, 8000);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

const PROJECT_EXT = '.wfproj.json';

// ---------------------------------------------------------------- metadata --
// The per-device bezel masks are generated by tools/gen-masks.js into
// assets/masks/ (<target>.svg + masks.json). The renderer clips the canvas with
// the SVG; the manifest rides along with the rest of the metadata so it never
// has to fetch a file:// URL.
function loadMaskManifest() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'masks', 'masks.json'), 'utf8'));
  } catch (e) { return {}; }
}
// which characters each bundled font draws (see readCmapRanges) — read once
let bundledWithCoverage = null;
function bundledFonts() {
  if (!bundledWithCoverage) {
    bundledWithCoverage = BUNDLED_FONTS.map((f) => {
      let coverage = null;
      try { coverage = readCmapRanges(fs.readFileSync(path.join(__dirname, f.file))); } catch (e) { /* unknown */ }
      return { ...f, coverage };
    });
  }
  return bundledWithCoverage;
}
ipcMain.handle('meta', async () => ({
  devices: DEVICES.map((d) => ({ ...d, label: deviceLabel(d) })),
  dataTypes: DATA_TYPES,
  kinds: KINDS,
  showLevels: SHOW_LEVELS,
  weatherIcons: WEATHER_ICONS,
  systemStatus: SYSTEM_STATUS,
  tapApps: TAP_APPS,
  systemApps: SYSTEM_APPS,
  dtMax: DT_MAX,
  editTypes: EDIT_TYPES,
  masks: loadMaskManifest(),
  fonts: bundledFonts(),
  fontVariations: FONT_VARIATIONS,
  addresses: lanAddresses(),
}));

// ------------------------------------------------------------------ fonts --
// Imported fonts live in the project folder (fonts/<file>) so a project stays
// portable; the renderer registers them with FontFace to rasterize glyphs.
ipcMain.handle('pick-font', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Import fonts',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
  });
  if (r.canceled || !r.filePaths.length) return [];
  return r.filePaths.filter(isFontFile).map((p) => {
    const buf = fs.readFileSync(p);
    const ext = path.extname(p).toLowerCase();
    const info = fontInfoFromBuffer(buf, path.basename(p));
    return {
      name: path.basename(p),
      family: info.family,
      subfamily: info.subfamily,
      full: info.full,
      guessed: info.guessed,
      coverage: info.coverage,
      ext, format: fontFormat(ext),
      size: buf.length,
      dataBase64: buf.toString('base64'),
    };
  });
});

// ------------------------------------------------------------ image import --
function readImageAsPng(filePath) {
  const img = nativeImage.createFromPath(filePath);
  if (img.isEmpty()) return null;
  const size = img.getSize();
  return {
    name: path.basename(filePath).replace(/\.[^.]+$/, ''),
    width: size.width,
    height: size.height,
    dataBase64: img.toPNG().toString('base64'),
  };
}
ipcMain.handle('pick-images', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Import images',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff'] }],
  });
  if (r.canceled || !r.filePaths.length) return [];
  return r.filePaths.map(readImageAsPng).filter(Boolean);
});
// read a dropped image without a dialog
ipcMain.handle('read-image', async (_e, filePath) => readImageAsPng(filePath));

// ---------------------------------------------------------------- projects --
function recentsFile() { return path.join(app.getPath('userData'), 'recent-projects.json'); }
function loadRecents() {
  try { const l = JSON.parse(fs.readFileSync(recentsFile(), 'utf8')); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
function writeRecents(list) { try { fs.writeFileSync(recentsFile(), JSON.stringify(list, null, 2)); } catch (e) { } }
function pushRecent(dir, name, device) {
  const list = loadRecents().filter((r) => r.path !== dir);
  list.unshift({ path: dir, name: name || path.basename(dir), device: device || '', at: Date.now() });
  writeRecents(list.slice(0, 8));
}
// A recent entry is *kept* even when its folder is gone: "recent-list" flags it
// (exists: false) and the empty state shows it in red, so a moved or deleted
// project folder is visible instead of silently disappearing from the list.
// kind: 'project' = a saved designer project (has a .wfproj.json), 'imported' =
// a Zepp OS / Watchface Maker folder opened as-is and not yet saved as a project
ipcMain.handle('recent-list', async () => loadRecents().map((r) => {
  const exists = fs.existsSync(r.path);
  return { ...r, exists, kind: exists && findProjectFile(r.path) ? 'project' : 'imported', home: app.getPath('home') };
}));
ipcMain.handle('recent-remove', async (_e, dir) => { writeRecents(loadRecents().filter((r) => r.path !== dir)); return true; });
ipcMain.handle('recent-clear', async () => { writeRecents([]); return []; });

function findProjectFile(dir) {
  try {
    const f = fs.readdirSync(dir).find((n) => n.endsWith(PROJECT_EXT));
    return f ? path.join(dir, f) : null;
  } catch (e) { return null; }
}
// A Zepp OS watchface project (Zeus CLI / Watchface Maker export) has no
// .wfproj.json — it is imported into the designer model instead of rejected.
function importFaceDirOr(dir) {
  let res;
  try { res = importFaceDir(dir); } catch (e) {
    return { error: `Could not import that watchface: ${String((e && e.message) || e)}` };
  }
  if (res.error) return { error: res.error };
  return res;
}
function loadProjectDir(dir, opts = {}) {
  const root = findProjectFile(dir) ? dir : (() => {
    // allow picking a parent folder that contains the project
    try {
      for (const n of fs.readdirSync(dir)) {
        const p = path.join(dir, n);
        if (fs.statSync(p).isDirectory() && findProjectFile(p)) return p;
      }
    } catch (e) { /* ignore */ }
    return null;
  })();
  // Not a designer project: a Zeus CLI / Watchface Maker folder opens by
  // importing it (app.json + watchface code + assets) instead of erroring out.
  // `force` is the Import button: a folder that holds both a designer project
  // and an app.json (this app's own sample/export layout) is imported anyway.
  if (opts.force || !root) return importFaceDirOr(dir);
  let project;
  try { project = JSON.parse(fs.readFileSync(findProjectFile(root), 'utf8')); } catch (e) {
    return { error: 'Could not read the project file: ' + String(e.message || e) };
  }
  const imgDir = path.join(root, 'images');
  const images = [];
  if (fs.existsSync(imgDir)) {
    const walk = (dir, prefix) => {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) { walk(full, `${prefix}${f}/`); continue; }
        if (!/\.png$/i.test(f)) continue;
        try {
          const buf = fs.readFileSync(full);
          const png = PNG.sync.read(buf);
          images.push({ name: `${prefix}${f}`, width: png.width, height: png.height, dataBase64: buf.toString('base64') });
        } catch (e) { /* skip unreadable */ }
      }
    };
    walk(imgDir, '');
  }
  const fonts = [];
  const fontDir = path.join(root, 'fonts');
  if (fs.existsSync(fontDir)) {
    const known = Array.isArray(project.fonts) ? project.fonts : [];
    for (const f of fs.readdirSync(fontDir)) {
      if (!isFontFile(f)) continue;
      const full = path.join(fontDir, f);
      try {
        const buf = fs.readFileSync(full);
        const ext = path.extname(f).toLowerCase();
        const info = fontInfoFromBuffer(buf, f);
        const rec = known.find((x) => x && x.name === f);
        fonts.push({
          name: f,
          family: (rec && rec.family) || info.family,
          subfamily: info.subfamily,
          coverage: info.coverage,
          ext, format: fontFormat(ext),
          size: buf.length,
          dataBase64: buf.toString('base64'),
        });
      } catch (e) { /* skip unreadable font */ }
    }
  }
  return { project, images, fonts, savePath: root, base: path.basename(root) };
}
// A .zip is unpacked to a scratch folder, imported from there and cleaned up;
// the result (and the recent entry) point at the .zip itself, which is what the
// user picked and can open again.
function loadProjectSource(p, opts = {}) {
  let st;
  try { st = fs.statSync(p); } catch (e) { return { error: 'File or folder not found.' }; }
  if (!st.isFile()) return loadProjectDir(p, opts);
  if (!/\.zip$/i.test(p)) return { error: 'Pick a watchface .zip or a project folder.' };
  const tmp = fs.mkdtempSync(path.join(app.getPath('temp'), 'dialcraft-zip-'));
  try {
    extractZip(p, tmp);
    const res = loadProjectDir(tmp, { force: true });
    if (res && !res.error) {
      res.source = p; res.savePath = null;
      res.base = path.basename(p).replace(/\.zip$/i, '');
    }
    return res;
  } catch (e) {
    return { error: `Could not read that .zip: ${String((e && e.message) || e)}` };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* scratch folder */ }
  }
}
ipcMain.handle('open-project-dialog', async (_e, opts = {}) => {
  const r = await dialog.showOpenDialog(win, {
    title: opts.title || 'Open a project or a watchface folder',
    buttonLabel: opts.buttonLabel || 'Open',
    message: opts.message || 'Pick a saved designer project, a Zepp OS watchface folder (app.json) or a watchface .zip',
    properties: ['openFile', 'openDirectory'],
    filters: [{ name: 'Watchface .zip', extensions: ['zip'] }, { name: 'All files', extensions: ['*'] }],
  });
  if (r.canceled || !r.filePaths.length) return null;
  const res = loadProjectSource(r.filePaths[0], { force: !!opts.force });
  if (res && !res.error) pushRecent(res.savePath || res.source, res.project.name, res.project.device);
  return res;
});
ipcMain.handle('open-project-path', async (_e, dir, opts = {}) => {
  if (!dir || !fs.existsSync(dir)) return { error: 'Folder not found.' };
  const res = loadProjectSource(dir, { force: !!(opts && opts.force) });
  if (res && !res.error) pushRecent(res.savePath || res.source, res.project.name, res.project.device);
  return res;
});

// Save: <dir>/images/*.png + <name>.wfproj.json (+ preview.png when composed)
ipcMain.handle('save-project', async (_e, payload) => {
  const { project, images, savePath, previewBase64 } = payload;
  let outDir = savePath || null;
  if (!outDir) {
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose where to save the project folder',
      buttonLabel: 'Save here', properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths.length) return null;
    outDir = path.join(r.filePaths[0], (project.name || 'watchface').replace(/[^\w\-. ]+/g, '_'));
  }
  fs.mkdirSync(path.join(outDir, 'images'), { recursive: true });
  const imgDir = path.join(outDir, 'images');
  const keep = new Set((images || []).map((i) => i.name));
  for (const old of fs.readdirSync(imgDir)) {
    if (/\.png$/i.test(old) && !keep.has(old)) { try { fs.unlinkSync(path.join(imgDir, old)); } catch (e) { } }
  }
  for (const im of images || []) {
    const target = path.join(imgDir, im.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(im.dataBase64, 'base64'));
  }
  if (previewBase64) fs.writeFileSync(path.join(outDir, 'preview.png'), Buffer.from(previewBase64, 'base64'));
  // project fonts: <dir>/fonts/<file>
  const fontDir = path.join(outDir, 'fonts');
  const keepFonts = new Set((payload.fonts || []).map((f) => f.name));
  if (keepFonts.size || fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
  if (fs.existsSync(fontDir)) {
    for (const old of fs.readdirSync(fontDir)) {
      if (isFontFile(old) && !keepFonts.has(old)) { try { fs.unlinkSync(path.join(fontDir, old)); } catch (e) { /* ignore */ } }
    }
  }
  for (const f of payload.fonts || []) {
    if (!f || !f.dataBase64) continue;
    try { fs.writeFileSync(path.join(fontDir, path.basename(f.name)), Buffer.from(f.dataBase64, 'base64')); } catch (e) { /* ignore */ }
  }
  const name = (project.name || 'watchface').replace(/[^\w\-. ]+/g, '_');
  for (const f of fs.readdirSync(outDir)) if (f.endsWith(PROJECT_EXT) && f !== name + PROJECT_EXT) { try { fs.unlinkSync(path.join(outDir, f)); } catch (e) { } }
  fs.writeFileSync(path.join(outDir, name + PROJECT_EXT), JSON.stringify(project, null, 2));
  pushRecent(outDir, project.name, project.device);
  return { savePath: outDir, file: path.join(outDir, name + PROJECT_EXT) };
});

// --------------------------------------------------------- code generation --
ipcMain.handle('generate-code', async (_e, payload) => {
  const device = deviceByKey(payload.project.device) || DEVICES[0];
  const res = generateWatchface(payload.project, device);
  return {
    code: res.code,
    warnings: res.warnings,
    appJson: generateAppJson(payload.project, device, { appId: payload.project.appId, vender: payload.project.vender }),
    device: device.target,
    assetDir: device.assetDir,
  };
});

// ------------------------------------------------------- Zeus project export --
// Pictures are saved as the canvas wrote them, which is not the smallest PNG. `optimizePng` on the project is opt-in:
//   "lossless"  re-encodes every picture without changing a pixel (kept only when smaller)
//   true        the same, and a big full-colour picture (an animation frame with a gradient, say) is first tried as a
//               256-colour PNG with alpha, kept only when that is clearly smaller
//   2 … 256     a number: every animation frame (and every picture of an Image layer with several) is reduced to that many colours (lossy, libimagequant) so a long
//               animation stays small; every other picture is only re-encoded losslessly
// Picture optimisation runs on two WebAssembly modules, so it is the same on every platform and nothing native has to be shipped:
//   libimagequant-wasm  the quantizer behind pngquant (palette of N colours, alpha kept)
//   @jsquash/oxipng     oxipng, a lossless PNG recompressor
// There is no fallback on purpose: a weaker encoder would quietly write a package several times bigger, so a module that
// cannot load stops the export with a message instead.
let wasmReady;
function unpackedPath(p) {
  const u = p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  return u !== p && fs.existsSync(u) ? u : p;
}
function loadOptimizers() {
  if (!wasmReady) {
    wasmReady = (async () => {
      try {
        const lqDir = unpackedPath(path.join(path.dirname(require.resolve('libimagequant-wasm')), 'wasm'));
        const lq = await import(pathToFileURL(path.join(lqDir, 'libimagequant_wasm.js')).href);
        lq.initSync({ module: fs.readFileSync(path.join(lqDir, 'libimagequant_wasm_bg.wasm')) });
        // the package's own wrapper needs a browser Web Worker; its generated module is used directly
        const oxDir = unpackedPath(path.dirname(require.resolve('@jsquash/oxipng/package.json')));
        const ox = await import(pathToFileURL(path.join(oxDir, 'optimise.js')).href);
        await ox.init(await WebAssembly.compile(fs.readFileSync(path.join(oxDir, 'codec', 'pkg', 'squoosh_oxipng_bg.wasm'))));
        return { lq, oxipng: ox.default };
      } catch (e) {
        throw new Error(`The picture optimiser could not be loaded (${String((e && e.message) || e).split('\n')[0]}). Run "npm install" in the Dialcraft folder, or set optimizePng to false.`);
      }
    })();
    wasmReady.catch(() => { wasmReady = null; });
  }
  return wasmReady;
}
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
// oxipng turns a picture whose pixels are all gray into a grayscale PNG (colour type 0 or 4), which the Zeus build cannot convert
// for the watch ("PNG with grayscale color type is not supported"), so such a result is dropped and the input is kept
const isGrayPng = (b) => b.length > 26 && (b[25] === 0 || b[25] === 4);
async function oxipngBuffer(png) {
  const { oxipng } = await loadOptimizers();
  const input = Buffer.from(png);
  const out = Buffer.from(await oxipng(toArrayBuffer(input), { level: 2, interlace: false, optimiseAlpha: true }));
  return isGrayPng(out) ? input : out;
}
// reduce to `colors` colours (2-256), then recompress
async function quantizePngBuffer(buf, colors) {
  const { lq } = await loadOptimizers();
  const [rgba, w, h] = lq.decode_png_to_rgba(new Uint8Array(buf));
  const qz = new lq.ImageQuantizer();
  try {
    qz.setMaxColors(colors);
    qz.setSpeed(1);
    const res = qz.quantizeImage(rgba, w, h);
    try {
      res.setDithering(0.5);
      return await oxipngBuffer(lq.encode_palette_to_png(res.getPaletteIndices(rgba, w, h), res.getPalette(), w, h));
    } finally { res.free(); }
  } finally { qz.free(); }
}
async function optimizePngBuffer(buf, mode) {
  if (mode === true && buf.length >= 20 * 1024) {
    const q = await quantizePngBuffer(buf, 256);
    if (q.length < buf.length * 0.85) return q;
  }
  const l = await oxipngBuffer(buf);
  return l.length < buf.length ? l : buf;
}

async function writeZeusProject(outDir, payload) {
  const device = deviceByKey(payload.project.device) || DEVICES[0];
  const { project } = payload;
  const colors = Number.isInteger(project.optimizePng) && project.optimizePng >= 2 && project.optimizePng <= 256 ? project.optimizePng : 0;
  const shrink = async (im, anim) => {
    const raw = Buffer.from(im.dataBase64, 'base64');
    if (colors) return anim ? await quantizePngBuffer(raw, colors) : await optimizePngBuffer(raw, 'lossless');
    return project.optimizePng === true || project.optimizePng === 'lossless' ? await optimizePngBuffer(raw, project.optimizePng) : raw;
  };
  // the designer's kept originals (…__src.png) are never part of the face
  const images = (payload.images || []).filter((i) => !/__src\.png$/i.test(i.name));
  const assetDir = path.join(outDir, 'assets', device.assetDir);
  const imgDir = path.join(assetDir, 'images');
  // exports made before the asset-folder rename may still hold assets/<target>.<st>/
  try {
    for (const entry of fs.readdirSync(path.join(outDir, 'assets'))) {
      if (entry !== device.assetDir && entry.startsWith(`${device.target}.`)) {
        fs.rmSync(path.join(outDir, 'assets', entry), { recursive: true, force: true });
      }
    }
  } catch (e) { /* no assets dir yet */ }
  fs.mkdirSync(imgDir, { recursive: true });
  // IMG_ANIM never sees the designer's image names: the watch looks the frames up
  // as images/anim/<prefix>_<index>.png, so every animation writes its frames
  // under exactly those names and a frame that nothing else uses lives only there.
  const byName = new Map((images || []).map((i) => [i.name, i]));
  const frames = new Map();
  const frameNames = new Set();
  for (const el of project.elements || []) {
    if (!el || el.kind !== 'IMG_ANIM') continue;
    const prefix = animPrefixFor(el);
    (el.frames || []).forEach((name, i) => {
      const im = byName.get(name);
      if (!im) return;
      frames.set(`anim/${prefix}_${i}.png`, im);
      frameNames.add(name);
    });
  }
  // pictures that are frames of something: an animation's, or the several pictures of an Image layer that code or a tap swaps
  const framePics = new Set(frameNames);
  for (const el of project.elements || []) {
    if (el && el.kind === 'IMG' && Array.isArray(el.images) && el.images.filter(Boolean).length >= 2) for (const n of el.images) framePics.add(n);
  }
  // names a layer references directly (everything an animation does not own)
  const usedNames = new Set();
  for (const el of project.elements || []) {
    if (!el || el.kind === 'IMG_ANIM') continue;
    for (const key of ['images', 'frames']) for (const n of el[key] || []) usedNames.add(n);
    for (const key of ['src', 'unit', 'unitImperial', 'invalid', 'minuteCover', 'secondCover', 'dot', 'negative', 'bg', 'cover', 'scale', 'am', 'pm', 'hour', 'minute', 'second', 'tipsBg', 'selectImage', 'unSelectImage']) {
      if (el[key]) usedNames.add(el[key]);
    }
    for (const o of el.optionalTypes || []) if (o && o.preview) usedNames.add(o.preview);
  }
  const keep = new Set((images || []).map((i) => i.name));
  for (const name of frameNames) if (!usedNames.has(name)) keep.delete(name); // lives in images/anim/
  // An image's name is the path the generated code asks for, so a name that
  // carries a folder has to be written in that folder — flattening it would
  // leave the widget pointing at a file the package does not hold. Sweep what
  // an earlier export left behind at the same time.
  const sweep = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const key = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        sweep(full, key);
        if (!fs.readdirSync(full).length) fs.rmdirSync(full);
      } else if (/\.png$/i.test(entry.name) && !keep.has(key) && key !== 'preview.png') {
        try { fs.unlinkSync(full); } catch (e) { /* ignore */ }
      }
    }
  };
  try { sweep(imgDir, ''); } catch (e) { /* no images dir yet */ }
  for (const im of images || []) {
    if (frameNames.has(im.name) && !usedNames.has(im.name)) continue; // exported under images/anim/
    const target = path.join(imgDir, im.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await shrink(im, framePics.has(im.name)));
  }
  for (const [rel, im] of frames) {
    const target = path.join(imgDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await shrink(im, true));
  }
  try { // frames from an earlier export that no animation uses any more
    const animDir = path.join(imgDir, 'anim');
    for (const old of fs.readdirSync(animDir)) {
      if (/\.png$/i.test(old) && !frames.has(`anim/${old}`)) fs.unlinkSync(path.join(animDir, old));
    }
    if (!fs.readdirSync(animDir).length) fs.rmdirSync(animDir);
  } catch (e) { /* no animation exported yet */ }
  // The app icon is mandatory: app.json points at images/preview.png and zpm
  // fails the whole build (exit 7) if the file is missing. Always write one.
  const previewBuf = payload.previewBase64 ? Buffer.from(payload.previewBase64, 'base64') : null;
  fs.writeFileSync(path.join(imgDir, 'preview.png'), appIconPng(previewBuf, deviceByKey(project.device)));
  // Tap zones are BUTTON widgets, which need a picture: a transparent 1×1 one (what the Maker ships too)
  if ((project.elements || []).some((e) => e && e.kind === 'TAP')) {
    const { PNG } = require('pngjs');
    fs.writeFileSync(path.join(imgDir, 'tapzone.png'), PNG.sync.write(new PNG({ width: 1, height: 1 })));
  }
  // fonts used by TEXT widgets live beside the images: assets/<target>/fonts/
  const usedFonts = new Set((project.elements || []).map((e) => e && e.fontFile).filter(Boolean).map((f) => path.basename(String(f))));
  if (usedFonts.size) {
    const fontDir = path.join(assetDir, 'fonts');
    fs.mkdirSync(fontDir, { recursive: true });
    for (const old of fs.readdirSync(fontDir)) {
      if (isFontFile(old) && !usedFonts.has(old)) { try { fs.unlinkSync(path.join(fontDir, old)); } catch (e) { /* ignore */ } }
    }
    let bundled = false;
    for (const name of usedFonts) {
      const fromProject = (payload.fonts || []).find((f) => f && f.name === name);
      try {
        if (fromProject && fromProject.dataBase64) {
          fs.writeFileSync(path.join(fontDir, name), Buffer.from(fromProject.dataBase64, 'base64'));
        } else {
          const bundledPath = path.join(__dirname, 'assets', 'fonts', name);
          if (fs.existsSync(bundledPath)) { fs.copyFileSync(bundledPath, path.join(fontDir, name)); bundled = true; }
        }
      } catch (e) { /* ignore unreadable font */ }
    }
    // OFL requires the licence to travel with the font
    if (bundled) {
      try { fs.copyFileSync(path.join(__dirname, 'assets', 'fonts', 'FONTS.md'), path.join(fontDir, 'FONTS-LICENSES.md')); } catch (e) { /* ignore */ }
    }
  }
  // code
  const wfDir = path.join(outDir, 'watchface', device.target);
  fs.mkdirSync(wfDir, { recursive: true });
  const gen = generateWatchface(project, device);
  fs.writeFileSync(path.join(wfDir, 'index.js'), gen.code);
  fs.writeFileSync(path.join(outDir, 'app.json'), generateAppJson(project, device, { appId: project.appId, vender: project.vender }));
  fs.writeFileSync(path.join(outDir, 'app.js'), generateAppJs());
  fs.writeFileSync(path.join(outDir, 'README.md'), generateProjectReadme(project, device));
  fs.writeFileSync(path.join(outDir, '.gitignore'), 'node_modules/\ndist/\n.DS_Store\n');
  return { outDir, warnings: gen.warnings, target: device.target, assetDir: device.assetDir };
}
ipcMain.handle('export-zeus', async (_e, payload) => {
  let outDir = payload.outDir || null;
  if (!outDir) {
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose where to export the Zeus project',
      buttonLabel: 'Export here', properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths.length) return null;
    outDir = path.join(r.filePaths[0], (payload.project.name || 'watchface').replace(/[^\w\-. ]+/g, '_'));
  }
  try {
    const res = await writeZeusProject(outDir, payload);
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});
ipcMain.handle('show-in-folder', async (_e, p) => { if (p && fs.existsSync(p)) shell.showItemInFolder(p); });
ipcMain.handle('open-path', async (_e, p) => { if (p && fs.existsSync(p)) shell.openPath(p); });
ipcMain.handle('open-external', async (_e, url) => {
  if (/^https?:\/\//i.test(String(url || ''))) shell.openExternal(url);
});

// ------------------------------------------------------------ Zeus CLI build --
// The environment tools are started in. Started from the Dock / Finder, the app has no shell PATH
// and `npx` would not be found (spawn npx ENOENT): ask the login shell once and add the usual folders.
let toolEnvCache = null;
function toolEnv() {
  if (toolEnvCache) return toolEnvCache;
  let shellPath = '';
  if (process.platform !== 'win32') {
    try {
      const sh = process.env.SHELL || '/bin/zsh';
      const out = require('child_process').execFileSync(sh, ['-ilc', 'printf "__PATH__%s__END__" "$PATH"'], { timeout: 4000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const mt = /__PATH__(.*?)__END__/s.exec(out);
      shellPath = mt ? mt[1] : '';
    } catch (e) { /* no login shell: the fixed folders still help */ }
  }
  const PATH = require('./core/toolpath').toolPath({
    basePath: process.env.PATH || '', shellPath, home: app.getPath('home'),
    exists: (p) => fs.existsSync(p), list: (p) => fs.readdirSync(p),
  });
  toolEnvCache = { ...process.env, PATH };
  return toolEnvCache;
}
function zeusCommand() {
  // prefer a globally installed zeus, fall back to npx
  const probe = spawn('zeus', ['--version'], { shell: true, env: toolEnv() });
  return new Promise((resolve) => {
    probe.on('error', () => resolve(['npx', ['--yes', '@zeppos/zeus-cli@latest']]));
    probe.on('close', (code) => resolve(code === 0 ? ['zeus', []] : ['npx', ['--yes', '@zeppos/zeus-cli@latest']]));
  });
}
// run a tool to the end (short ones: version probes); never throws
function probeTool(cmd, args) {
  return new Promise((resolve) => {
    let out = '';
    let child;
    try { child = spawn(cmd, args, { shell: process.platform === 'win32', env: toolEnv() }); } catch (e) { resolve(null); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch (e) { /* gone */ } resolve(null); }, 8000);
    child.stdout.on('data', (b) => { out += b.toString(); });
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 ? out.replace(/\x1b\[[0-9;]*m/g, '').trim() : null); });
  });
}
// What the build needs: Node + npx always, and Zeus either installed globally or fetched by npx.
ipcMain.handle('tools-status', async () => {
  const [node, npx, zeus] = await Promise.all([probeTool('node', ['--version']), probeTool('npx', ['--version']), probeTool('zeus', ['--version'])]);
  // `zeus --version` prints node / npm / zeus / zpm lines, in colour: keep the zeus one
  const zeusVer = zeus ? ((/^zeus:\s*v?([\d.]+)/mi.exec(zeus) || /(\d+\.\d+\.\d+)/.exec(zeus) || [])[1] || zeus.split('\n')[0]) : null;
  const first = (s) => (s ? s.split('\n')[0].trim() : null);
  return { node: first(node), npx: first(npx), zeus: zeusVer, platform: process.platform };
});
// Install the Zeus CLI globally (npm i -g), so a build does not have to fetch it every time
ipcMain.handle('install-zeus', async () => {
  buildLog('$ npm install -g @zeppos/zeus-cli');
  return new Promise((resolve) => {
    let out = '';
    let child;
    try { child = spawn('npm', ['install', '-g', '@zeppos/zeus-cli'], { shell: process.platform === 'win32', env: toolEnv() }); }
    catch (e) { resolve({ ok: false, error: String(e.message || e) }); return; }
    const onData = (b) => { const s = b.toString(); out += s; s.split('\n').forEach((l) => l.trim() && buildLog(l)); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => resolve({
      ok: false,
      error: 'Could not run npm: ' + String(err.message || err) + (err && err.code === 'ENOENT' ? ' — install Node.js (https://nodejs.org) first.' : ''),
    }));
    child.on('close', async (code) => {
      if (code !== 0) {
        const perm = /EACCES|EPERM/.test(out);
        resolve({ ok: false, error: perm
          ? 'npm was not allowed to write to its global folder. Install Node with a version manager (nvm, Volta, fnm), or run: sudo npm install -g @zeppos/zeus-cli'
          : `npm exited with code ${code}` });
        return;
      }
      const z = await probeTool('zeus', ['--version']);
      resolve({ ok: true, zeus: z ? ((/^zeus:\s*v?([\d.]+)/mi.exec(z) || [])[1] || null) : null });
    });
  });
});
function buildLog(line) {
  if (win && !win.isDestroyed()) win.webContents.send('build-log', line);
}
// Export the project and let the Zeus CLI package it into dist/*.zab
async function runZeusBuild(outDir, payload, { apiLevel } = {}) {
  let res;
  try { res = await writeZeusProject(outDir, payload); } catch (err) { return { ok: false, error: String(err.message || err), outDir }; }
  // an earlier build's packages must not survive: the install page serves what is in dist/,
  // so a stale (bigger, older) .zab used to win over the one that was just built
  try { fs.rmSync(path.join(outDir, 'dist'), { recursive: true, force: true }); } catch (e) { /* nothing to clear */ }
  const [cmd, prefix] = await zeusCommand();
  const args = [...prefix, 'build'];
  if (apiLevel) args.push(`--APILevel=${apiLevel}`);
  buildLog(`$ ${cmd} ${args.join(' ')}  (in ${outDir})`);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: outDir, shell: process.platform === 'win32', env: toolEnv() });
    let out = '';
    const onData = (buf) => { const s = buf.toString(); out += s; s.split('\n').forEach((l) => l.trim() && buildLog(l)); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => resolve({
      ok: false, outDir, log: out,
      error: 'Could not run the Zeus CLI: ' + String(err.message || err)
        + (err && err.code === 'ENOENT' ? ` — "${cmd}" was not found. Install Node.js (https://nodejs.org) so that npx is available, then try again.` : ''),
    }));
    child.on('close', async (code) => {
      // Zeus puts a hidden ".ip-package" (the intermediate product the Zepp store uses to retarget a face to other watches)
      // into every .zab, often bigger than the package itself. Installing on your own watch does not need it, so it is pruned.
      // A failed prune only leaves the bigger file, it never fails the build.
      if (code === 0) {
        out += await new Promise((done) => {
          let log = '';
          const pr = spawn(cmd, [...prefix, 'prune', '--ip'], { cwd: outDir, shell: process.platform === 'win32', env: toolEnv() });
          pr.stdout.on('data', (b) => { log += b; }); pr.stderr.on('data', (b) => { log += b; });
          pr.on('error', () => done(''));
          pr.on('close', (c) => { buildLog(c === 0 ? 'Pruned the intermediate product (.ip-package) from the .zab: smaller package.' : 'Could not prune the intermediate product; the .zab keeps it.'); done(c === 0 ? '' : log); });
        });
      }
      const dist = path.join(outDir, 'dist');
      let artifacts = [];
      try { artifacts = fs.readdirSync(dist).map((f) => path.join(dist, f)); } catch (e) { artifacts = []; }
      resolve({ ok: code === 0, code, outDir, artifacts, log: out, warnings: res && res.warnings });
    });
  });
}
ipcMain.handle('build-zeus', async (_e, payload) => {
  let outDir = payload.outDir;
  if (!outDir) {
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose where to build the Zeus project',
      buttonLabel: 'Build here', properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, error: 'cancelled' };
    outDir = path.join(r.filePaths[0], slugName(payload.project && payload.project.name));
  }
  const device = deviceByKey(payload.project && payload.project.device) || DEVICES[0];
  return runZeusBuild(outDir, payload, { apiLevel: zeusApiLevel(device.api) });
});

// ---------------------------------------------------- LAN install ("Wi-Fi") --
// Serves a built package on the local network so the Zepp App (Profile ->
// device -> Developer Mode -> scan) can install it from a QR code.
let lan = null;
let lanDir = null;

function slugName(s) { return String(s || 'watchface').replace(/[^\w\-. ]+/g, '_').trim() || 'watchface'; }
function installDirFor(project) {
  return path.join(app.getPath('userData'), 'install', slugName(project && project.name));
}

function collectInstallFiles(dir, project, device) {
  const files = [];
  const seen = new Set();
  const add = (p, kind, label) => {
    if (!p || !fs.existsSync(p) || seen.has(p)) return;
    seen.add(p);
    files.push({ path: p, route: path.basename(p), label: label || path.basename(p), kind, download: /\.zab$/i.test(p) });
  };
  const dist = path.join(dir, 'dist');
  const zabs = walkFiles(dist).filter((f) => /\.zab$/i.test(f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);   // newest first
  for (const z of zabs) add(z, 'install package', path.basename(z));
  const previews = walkFiles(path.join(dir, 'assets')).filter((f) => /[\\/]images[\\/]preview\.png$/i.test(f));
  add(path.join(dir, 'preview.png'), 'preview');
  if (previews[0]) add(previews[0], 'preview');
  return files;
}

function walkFiles(dir, out = []) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return out; }
  for (const n of names) {
    if (n === 'node_modules' || n === '.git') continue;
    const full = path.join(dir, n);
    let st;
    try { st = fs.statSync(full); } catch (e) { continue; }
    if (st.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function lanStatus() {
  return lan ? lan.status() : {
    running: false, port: 0, host: null, addresses: lanAddresses(),
    files: [], requests: 0, dir: lanDir, installUrl: null, pageUrl: null,
  };
}

function attachServer(opts) {
  const server = new LanServer({
    name: opts.name,
    device: opts.device,
    target: opts.target,
    dir: opts.dir,
    files: opts.files,
    address: opts.address,
    onRequest: (r) => { if (win && !win.isDestroyed()) win.webContents.send('lan-request', r); },
    onError: (err) => { if (win && !win.isDestroyed()) win.webContents.send('build-log', '[lan] ' + String((err && err.message) || err)); },
  });
  return server;
}

ipcMain.handle('install-status', async () => lanStatus());

ipcMain.handle('install-start', async (_e, payload) => {
  const project = (payload && payload.project) || {};
  const device = deviceByKey(project.device) || DEVICES[0];
  if (lan) { await lan.stop(); lan = null; }
  lanDir = payload && payload.dir ? payload.dir : installDirFor(project);
  const files = collectInstallFiles(lanDir, project, device);
  const server = attachServer({
    name: project.name || 'watchface',
    device: device ? device.name : '',
    target: device ? device.target : '',
    dir: lanDir,
    files,
    address: payload && payload.address,
  });
  try {
    const st = await server.start(payload && payload.port);
    lan = server;
    return { ok: true, ...st };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err), ...lanStatus() };
  }
});

ipcMain.handle('install-build', async (_e, payload) => {
  const project = (payload && payload.project) || {};
  const device = deviceByKey(project.device) || DEVICES[0];
  lanDir = installDirFor(project);
  try { fs.mkdirSync(lanDir, { recursive: true }); } catch (e) { /* ignore */ }
  const res = await runZeusBuild(lanDir, { ...payload, outDir: lanDir }, { apiLevel: zeusApiLevel(device.api) });
  if (!res.ok) {
    return {
      ok: false,
      step: 'build',
      error: res.error || `zeus build exited with code ${res.code}`,
      outDir: lanDir,
      log: res.log,
    };
  }
  return { ok: true, built: true, outDir: lanDir, artifacts: res.artifacts };
});

ipcMain.handle('install-stop', async () => {
  if (lan) { await lan.stop(); lan = null; }
  return lanStatus();
});

ipcMain.handle('install-open-folder', async () => {
  if (lanDir && fs.existsSync(lanDir)) shell.openPath(lanDir);
  return lanDir;
});

// QR codes for the install modal (rendered in the main process: the renderer
// has no dependency loader and qrcode is a node package).
ipcMain.handle('qr', async (_e, opts) => {
  const text = String((opts && opts.text) || '');
  if (!text) return null;
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: (opts && opts.ec) || 'M',
      margin: (opts && opts.margin) != null ? opts.margin : 1,
      width: Math.max(120, Math.min(1024, (opts && opts.width) || 320)),
      color: { dark: '#0b1220ff', light: '#ffffffff' },
    });
  } catch (err) {
    return null;
  }
});
