'use strict';
// Headless watchface builder: drives the real Dialcraft editor (offscreen) from a JSON recipe, so a
// face can be designed, previewed, checked and exported without clicking. Used by the
// create-amazfit-watchface skill, but it works on its own:
//
//   env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js recipe.json
//
// It runs headless: no window is shown, no Dock icon appears and the app never takes focus (DIALCRAFT_HEADLESS, see main.js).
//
// Prints one JSON object on stdout (the last line that starts with `{"ok"`). See
// .claude/skills/create-amazfit-watchface/references/recipe.md for the recipe format.
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

process.env.DIALCRAFT_HEADLESS = '1';   // no editor window, no Dock icon, no focus stealing (see main.js)
require(path.join(__dirname, '..', 'main.js'));

const recipePath = process.argv.slice(2).find((a) => !a.startsWith('-') && /\.json$/i.test(a));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg, extra = {}) {
  console.log(JSON.stringify({ ok: false, error: msg, ...extra }));
  app.exit(1);
}

app.whenReady().then(async () => {
  setTimeout(() => fail('timed out after 300 s'), 300000);
  if (!recipePath) return fail('usage: electron tools/face-cli.js recipe.json');
  let recipe;
  try { recipe = JSON.parse(fs.readFileSync(path.resolve(recipePath), 'utf8')); } catch (e) { return fail('cannot read the recipe: ' + e.message); }
  const base = path.dirname(path.resolve(recipePath));
  const abs = (p) => (p ? path.resolve(base, p) : null);
  if (recipe.open) recipe.open = abs(recipe.open);

  const win = new BrowserWindow({
    width: 1300, height: 900, show: false, backgroundColor: '#0e1015',
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, offscreen: true, backgroundThrottling: false },
  });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  const run = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`, true);
  await sleep(1500);   // init(): metadata, fonts, masks

  // the steps run in the page, where the editor's own functions live; each returns what it did
  const driver = `
    const R = ${JSON.stringify(recipe)};
    const log = [];
    const find = (key) => {
      const k = String(key).toLowerCase();
      return project.elements.find((e) => e.id === key) || project.elements.find((e) => (e.name || '').toLowerCase() === k)
        || project.elements.find((e) => (e.name || '').toLowerCase().includes(k));
    };
    if (R.open) {
      // start from a saved Dialcraft project (a folder or its .wfproj.json) instead of a blank one; it is never written back
      const o = await API.openProjectPath(R.open);
      if (!o || o.error) return { ok: false, error: 'cannot open ' + R.open + ': ' + (o && o.error) };
      await loadProject(o);
      project.savePath = null;
    } else {
      if (!DEVICES.some((d) => d.target === R.device)) return { ok: false, error: 'unknown device ' + R.device + '. Known: ' + DEVICES.map((d) => d.target).join(', ') };
      if (R.font) glyphFont = R.font;
      await createProject(R.name || 'My watchface', R.device, 'blank');
      if (R.font) { project.font = R.font; glyphFont = R.font; }
    }
    if (R.language) project.language = R.language;
    if (R.userImports) project.userImports = R.userImports;
    if (R.userCode) project.userCode = R.userCode;
    if (R.optimizePng === true || R.optimizePng === 'lossless' || (Number.isInteger(R.optimizePng) && R.optimizePng >= 2 && R.optimizePng <= 256)) project.optimizePng = R.optimizePng;
    if (R.description) project.description = R.description;
    for (const [i, s] of (R.steps || []).entries()) {
      try {
        if (s.preset) {
          await applyPreset(s.preset);
          log.push('preset ' + s.preset);
        } else if (s.add) {
          const e = await addElement(s.add, s.patch || {});
          if (s.name && e) e.name = s.name;
          if (e && s.set) Object.assign(e, s.set);
          log.push('add ' + s.add + (e ? ' → ' + e.name : ''));
        } else if (s.edit) {
          const e = find(s.edit);
          if (!e) { log.push('edit: no layer “' + s.edit + '”'); continue; }
          if (s.set) Object.assign(e, s.set);
          if (s.glyph) {
            e.glyph = Object.assign(glyphSpecFrom(glyphStyle(e)), e.glyph || {}, s.glyph);
            await rerenderGlyphLayers([e], { quiet: true });
          }
          if (s.tint) { e.tint = Object.assign(tintStyle(e), e.tint || {}, s.tint); await rerenderGlyphLayers([e], { quiet: true }); }
          log.push('edit ' + e.name);
        } else if (s.remove) {
          const e = find(s.remove);
          if (e) { project.elements = project.elements.filter((x) => x !== e); log.push('remove ' + e.name); }
        } else if (s.script) {
          const out = await (new Function('return (async () => {' + s.script + '})()'))();
          log.push('script' + (out !== undefined ? ' → ' + JSON.stringify(out).slice(0, 200) : ''));
        }
      } catch (err) { log.push('step ' + (i + 1) + ' failed: ' + (err && err.message || err)); }
    }
    await glyphGenNow();
    await loadAllImages();
    refreshPanels(); render();
    const lint = lintProject().map((l) => l.level + ': ' + l.message);
    const layers = project.elements.map((e) => (e.name || e.kind) + ' [' + e.kind + (e.show && e.show !== 'both' ? ', ' + e.show : '') + '] ' + Math.round(e.x ?? e.centerX ?? 0) + ',' + Math.round(e.y ?? e.centerY ?? 0));
    return { ok: true, log, lint, layers, images: project.images.length, device: dev().name, size: dev().w + 'x' + dev().h };
  `;
  let res;
  try { res = await run(driver); } catch (e) { return fail('the editor threw: ' + e.message); }
  if (!res || !res.ok) return fail((res && res.error) || 'the recipe failed', res || {});

  // preview PNG(s): the normal and AOD states as the store icon would render them
  if (recipe.preview) {
    const b64 = await run(`return composePreviewB64();`);
    fs.mkdirSync(path.dirname(abs(recipe.preview)), { recursive: true });
    fs.writeFileSync(abs(recipe.preview), Buffer.from(b64, 'base64'));
    res.preview = abs(recipe.preview);
  }
  if (recipe.previewAod) {
    const b64 = await run(`
      const d = dev(); const cv = document.createElement('canvas'); cv.width = d.w; cv.height = d.h;
      const keep = { clock, dateParts, exportRender };
      clock = { ...REF_CLOCK }; dateParts = { ...REF_DATE }; exportRender = true;
      try { drawScene(cv.getContext('2d'), d.w, d.h, 'aod', false); } finally { clock = keep.clock; dateParts = keep.dateParts; exportRender = keep.exportRender; }
      return cv.toDataURL('image/png').split(',')[1];`);
    fs.mkdirSync(path.dirname(abs(recipe.previewAod)), { recursive: true });
    fs.writeFileSync(abs(recipe.previewAod), Buffer.from(b64, 'base64'));
    res.previewAod = abs(recipe.previewAod);
  }
  // the editor's own project file, to reopen and keep editing in the app
  if (recipe.save) {
    const json = await run(`return JSON.stringify({ project, images: project.images.map((i) => ({ name: i.name, dataBase64: imageDataBase64(i) })) });`);
    const { project, images } = JSON.parse(json);
    const dir = abs(recipe.save);
    fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
    for (const im of images) fs.mkdirSync(path.dirname(path.join(dir, 'images', im.name)), { recursive: true }), fs.writeFileSync(path.join(dir, 'images', im.name), Buffer.from(im.dataBase64, 'base64'));
    const slim = { ...project, images: project.images.map((i) => ({ name: i.name, width: i.width, height: i.height })) };
    fs.writeFileSync(path.join(dir, `${(project.name || 'watchface').replace(/[^\w\-. ]+/g, '_')}.wfproj.json`), JSON.stringify(slim, null, 2));
    res.saved = dir;
  }
  if (recipe.out) {
    const outDir = abs(recipe.out);
    const ex = await run(`
      const payload = { project, images: await exportImagesPayload(), fonts: fontRecords(), previewBase64: composePreviewB64(), outDir: ${JSON.stringify(outDir)} };
      const r = ${recipe.build ? 'await API.buildZeus(payload)' : 'await API.exportZeus(payload)'};
      return r;`);
    res.export = { ok: ex && ex.ok !== false, outDir, error: ex && ex.error, warnings: ex && ex.warnings, artifacts: ex && ex.artifacts, code: ex && ex.code };
    if (recipe.build && ex && ex.log && !ex.ok) res.export.log = String(ex.log).split('\n').slice(-15).join('\n');
    try {
      const target = fs.readdirSync(path.join(outDir, 'watchface'))[0];
      const code = fs.readFileSync(path.join(outDir, 'watchface', target, 'index.js'), 'utf8');
      new Function(code.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({'));
      res.export.syntax = 'ok';
    } catch (e) { res.export.syntax = 'error: ' + e.message; }
  }
  res.windows = BrowserWindow.getAllWindows().length;   // 1: only the hidden offscreen one
  console.log(JSON.stringify(res));
  app.exit(0);
}).catch((e) => fail(String(e && e.message || e)));
