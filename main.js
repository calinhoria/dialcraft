'use strict';
// Electron main process: file system + Zepp project I/O for the designer.
// The renderer holds the editing model; everything that touches disk (importing
// images, saving the project, exporting a Zeus CLI project, calling the Zeus
// CLI) happens here and is exposed through preload.js.
const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { PNG } = require('pngjs');
const QRCode = require('qrcode');
const { DEVICES, deviceByKey, deviceLabel } = require('./core/devices');
const { DATA_TYPES, WEATHER_ICONS, SYSTEM_STATUS } = require('./core/datatypes');
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
app.whenReady().then(() => {
  migrateUserData();
  // a packaged app takes build/icon.icns; a dev run would show Electron's own
  if (process.platform === 'darwin' && app.dock && fs.existsSync(APP_ICON)) app.dock.setIcon(APP_ICON);
  createWindow();
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
function writeZeusProject(outDir, payload) {
  const device = deviceByKey(payload.project.device) || DEVICES[0];
  const { project, images } = payload;
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
  // names a layer references directly (everything an animation does not own)
  const usedNames = new Set();
  for (const el of project.elements || []) {
    if (!el || el.kind === 'IMG_ANIM') continue;
    for (const key of ['images', 'frames']) for (const n of el[key] || []) usedNames.add(n);
    for (const key of ['src', 'unit', 'dot', 'negative', 'bg', 'cover', 'am', 'pm', 'hour', 'minute', 'second']) {
      if (el[key]) usedNames.add(el[key]);
    }
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
    fs.writeFileSync(target, Buffer.from(im.dataBase64, 'base64'));
  }
  for (const [rel, im] of frames) {
    const target = path.join(imgDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(im.dataBase64, 'base64'));
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
  fs.writeFileSync(path.join(imgDir, 'preview.png'), appIconPng(previewBuf));
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
    const res = writeZeusProject(outDir, payload);
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
function zeusCommand() {
  // prefer a globally installed zeus, fall back to npx
  const probe = spawn('zeus', ['--version'], { shell: true });
  return new Promise((resolve) => {
    probe.on('error', () => resolve(['npx', ['--yes', '@zeppos/zeus-cli@latest']]));
    probe.on('close', (code) => resolve(code === 0 ? ['zeus', []] : ['npx', ['--yes', '@zeppos/zeus-cli@latest']]));
  });
}
function buildLog(line) {
  if (win && !win.isDestroyed()) win.webContents.send('build-log', line);
}
// Export the project and let the Zeus CLI package it into dist/*.zab
async function runZeusBuild(outDir, payload, { apiLevel } = {}) {
  let res;
  try { res = writeZeusProject(outDir, payload); } catch (err) { return { ok: false, error: String(err.message || err), outDir }; }
  const [cmd, prefix] = await zeusCommand();
  const args = [...prefix, 'build'];
  if (apiLevel) args.push(`--APILevel=${apiLevel}`);
  buildLog(`$ ${cmd} ${args.join(' ')}  (in ${outDir})`);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: outDir, shell: process.platform === 'win32' });
    let out = '';
    const onData = (buf) => { const s = buf.toString(); out += s; s.split('\n').forEach((l) => l.trim() && buildLog(l)); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => resolve({ ok: false, error: 'Could not run the Zeus CLI: ' + String(err.message || err), outDir, log: out }));
    child.on('close', (code) => {
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
  const zabs = walkFiles(dist).filter((f) => /\.zab$/i.test(f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
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
