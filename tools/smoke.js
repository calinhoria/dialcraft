'use strict';
// End-to-end smoke test: boots the real app, drives the renderer the way a user
// would (new watchface → presets → code → save → Zeus export) and reports what
// happened. Run it with:
//
//   npm run smoke           # uses the sample device in core/devices.js
//   AMAZFIT_DEVICE=bip-6 npm run smoke
//
// It writes into a scratch folder under the system temp dir and never touches
// your projects.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { app, BrowserWindow } = require('electron');

require(path.join(__dirname, '..', 'main.js'));

const TARGET = process.env.AMAZFIT_DEVICE || 'gtr-3-pro';
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'awd-smoke-'));
const projectDir = path.join(SCRATCH, 'project');
const zeusDir = path.join(SCRATCH, 'zeus');
const zeusDir2 = path.join(SCRATCH, 'zeus-fonts');
const zeusDir3 = path.join(SCRATCH, 'zeus-bundled-font');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  let win = null;
  for (let i = 0; i < 40 && !win; i++) { win = BrowserWindow.getAllWindows()[0]; if (!win) await sleep(200); }
  const run = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`, true);
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep2(1500); // let init() finish loading the metadata + masks
  const consoleErrors = [];
  win.webContents.on('console-message', (...a) => {
    const e = a[0];
    const level = e && typeof e === 'object' && e.level != null ? e.level : a[1];
    const message = e && typeof e === 'object' && e.message != null ? e.message : a[2];
    if (level === 3 || level === 'error') consoleErrors.push(message);
  });

  try {
    const meta = await run('return { devices: DEVICES.length, kinds: KINDS.length, dataTypes: DATA_TYPES.length };');
    check('metadata loaded', meta.devices > 30 && meta.kinds > 15, `${meta.devices} devices, ${meta.kinds} kinds, ${meta.dataTypes} data types`);

    const created = await run(`
      await createProject('Smoke Face', ${JSON.stringify(TARGET)}, 'digital');
      return { elements: project.elements.length, images: project.images.length, device: project.device };`);
    check('new watchface + digital clock preset', created.elements >= 3 && created.images >= 10,
      `${created.elements} layers, ${created.images} images on ${created.device}`);

    const presets = await run(`
      await applyPreset('steps');
      await applyPreset('arcprogress');
      await applyPreset('weekday');
      await applyPreset('battery');
      await applyPreset('bg');
      await applyPreset('rect');
      return { elements: project.elements.length, images: project.images.length };`);
    check('presets add layers + glyph images', presets.elements >= 9, `${presets.elements} layers, ${presets.images} images`);

    const defaultFont = await run(`return { font: glyphFont, sets: project.images.filter(i => /^font_\\d+_\\d+\\.png$/.test(i.name)).length };`);
    check('digit images generated from the bundled font', defaultFont.sets >= 10, `font ${defaultFont.font}, ${defaultFont.sets} digit images`);

    const maskCheck = await run(`
      const cv = $('cv'); const host = $('cvDevice');
      return {
        mask: String(cv.style.webkitMaskImage || cv.style.maskImage || ''),
        canvasRadius: cv.style.borderRadius,
        hostRadius: host.style.borderRadius,
        plain: host.classList.contains('plain'),
      };`);
    check('device mask applied to the canvas', /masks\/.*\.svg/.test(maskCheck.mask) && parseInt(maskCheck.canvasRadius) > 0,
      `mask=${maskCheck.mask} radius=${maskCheck.canvasRadius} wrapper=${maskCheck.hostRadius}${maskCheck.plain ? ' (plain)' : ''}`);

    const code = await run(`await refreshCode(); const t = $('code').textContent; return { len: t.length, hasWatchFace: /WatchFace\\(/.test(t), hasShowLevel: /show_level/.test(t), warns: ($('codeWarn').hidden ? 0 : $('codeWarn').textContent) };`);
    check('generated watchface code', code.len > 500 && code.hasWatchFace && code.hasShowLevel,
      `${code.len} chars${code.warns ? '; warnings: ' + code.warns : ''}`);

    const aod = await run(`
      setPreviewMode('aod'); setLiveClock(true); await new Promise(r => setTimeout(r, 1200));
      const t = document.querySelector('#cv').toDataURL('image/png').length; setLiveClock(false); setPreviewMode('normal');
      return { canvasBytes: t };`);
    check('AOD preview + live clock render without throwing', aod.canvasBytes > 2000, `${aod.canvasBytes} bytes of canvas data`);

    const hist = await run(`
      const before = project.elements.length;
      pushHistory(); deleteElements([project.elements[project.elements.length - 1]]);
      const afterDelete = project.elements.length;
      undo();
      return { before, afterDelete, afterUndo: project.elements.length };`);
    check('delete + undo', hist.afterDelete === hist.before - 1 && hist.afterUndo === hist.before,
      `${hist.before} → ${hist.afterDelete} → ${hist.afterUndo}`);

    const lint = await run(`const items = lintProject(); return { errors: items.filter(i => i.level === 'error').length, warnings: items.filter(i => i.level === 'warn').length, info: items.filter(i => i.level === 'info').length, msgs: items.map(i => i.level + ': ' + i.message) };`);
    check('project check runs', lint.errors + lint.warnings + lint.info >= 0, `${lint.errors} errors, ${lint.warnings} warnings, ${lint.info} notes${lint.msgs.length ? '\n    ' + lint.msgs.join('\n    ') : ''}`);

    const saved = await run(`
      return API.saveProject({ project, images: projectImagesPayload(), savePath: ${JSON.stringify(projectDir)}, previewBase64: composePreviewB64() });`);
    const namesAtSave = await run(`return project.elements.map(e => e.name);`);
    console.log('    layers at save: ' + JSON.stringify(namesAtSave));
    const projectFile = path.join(projectDir, 'saved-project.wfproj.json');
    const anyProj = fs.existsSync(projectDir) ? fs.readdirSync(projectDir).find((f) => f.endsWith('.wfproj.json')) : null;
    check('save project folder', !!saved && !!anyProj, anyProj ? `${anyProj} written` : 'nothing written');
    void projectFile;

    const reopened = await run(`
      const res = await API.openProjectPath(${JSON.stringify(projectDir)});
      if (res.error) return { error: res.error };
      await loadProject(res);
      return { elements: project.elements.length, images: project.images.length };`);
    check('reopen the saved project', !reopened.error && reopened.elements >= 9,
      reopened.error || `${reopened.elements} layers, ${reopened.images} images`);

    const exp = await run(`
      return API.exportZeus({ project, images: projectImagesPayload(), previewBase64: composePreviewB64(), outDir: ${JSON.stringify(zeusDir)} });`);
    check('export a Zeus project', !!exp && exp.ok !== false, exp && exp.ok === false ? exp.error : `${exp.outDir}`);
    if (exp && exp.ok !== false) {
      const files = ['app.json', 'app.js'];
      const missing = files.filter((f) => !fs.existsSync(path.join(zeusDir, f)));
      const wf = path.join(zeusDir, 'watchface', TARGET, 'index.js');
      const assets = path.join(zeusDir, 'assets', exp.assetDir || TARGET, 'images');
      const pngs = fs.existsSync(assets) ? fs.readdirSync(assets).filter((f) => f.endsWith('.png')).length : 0;
      check('exported files exist', missing.length === 0 && fs.existsSync(wf) && pngs > 0,
        `${missing.length ? 'missing ' + missing.join(',') + '; ' : ''}${pngs} PNGs in assets`);
      if (fs.existsSync(wf)) {
        const mjs = path.join(SCRATCH, 'index.mjs');
        fs.writeFileSync(mjs, fs.readFileSync(wf, 'utf8'));
        let syntaxOk = true, err = '';
        try { execFileSync('node', ['--check', mjs], { stdio: 'pipe' }); } catch (e) { syntaxOk = false; err = String(e.stderr || e.message).split('\n')[0]; }
        check('generated watchface JS parses', syntaxOk, err || 'node --check passed');
        const src = fs.readFileSync(wf, 'utf8');
        check('generated code uses the Zepp APIs', /from '@zos\/ui'/.test(src) && /WatchFace\(/.test(src) && /import \{ Step \} from '@zos\/sensor'/.test(src), 'imports @zos/ui + @zos/sensor');
      }
      const appJson = JSON.parse(fs.readFileSync(path.join(zeusDir, 'app.json'), 'utf8'));
      check('app.json is a watchface for the target', appJson.app.appType === 'watchface' && !!appJson.targets[TARGET],
        `appType=${appJson.app.appType}, targets=${Object.keys(appJson.targets).join(',')}`);
      const dev = require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET);
      const av = (appJson.runtime || {}).apiVersion || {};
      check('app.json apiVersion follows the device OS level', av.minVersion === require(path.join(__dirname, '..', 'core', 'fonts')).apiVersionFor(dev.api).minVersion,
        `${dev.target} os=${dev.api} → ${av.compatible}/${av.target}/${av.minVersion}`);
      check('app.json i18n uses appName', !!(appJson.i18n && appJson.i18n['en-US'] && appJson.i18n['en-US'].appName),
        JSON.stringify(appJson.i18n));

      // ---- export shape the Zeus CLI requires (these cause build failures) --
      const iconPath = path.join(assets, 'preview.png');
      let iconSize = null;
      try { const png = require('pngjs').PNG.sync.read(fs.readFileSync(iconPath)); iconSize = [png.width, png.height]; } catch (e) { /* missing */ }
      check('app icon written where app.json points', appJson.app.icon === 'images/preview.png' && !!iconSize,
        `${appJson.app.icon} → ${iconSize ? iconSize.join('×') : 'MISSING'} (zeus build exits 7 when absent)`);
      check('app icon is a 248×248 PNG (design guide: 4px safe area)',
        !!iconSize && iconSize[0] === 248 && iconSize[1] === 248, iconSize ? iconSize.join('×') : 'n/a');
      check('assets sit in assets/<target>/ shared by all variants', exp.assetDir === TARGET && !exp.assetDir.includes('.'),
        `assets/${exp.assetDir}/images`);
      const plat = (appJson.targets[TARGET] || {}).platforms || [];
      check('every platform entry carries a deviceSource (else zpm drops the assets)',
        plat.length > 0 && plat.every((p) => Number.isInteger(p.deviceSource)),
        plat.map((p) => p.deviceSource).join(', ') || 'none');
      check('platform deviceSources come from the device list',
        plat.length > 0 && plat.every((p) => dev.sources.includes(p.deviceSource)),
        `${dev.sources.join(', ')}`);

      // real CLI build: the only check that would have caught the exit-7 crash
      if (String(process.env.SMOKE_BUILD || '') !== '0') {
        let hasCli = true;
        try { execFileSync('zeus', ['-v'], { stdio: 'pipe' }); } catch (e) { hasCli = false; }
        if (!hasCli) {
          check('zeus build packages the export', true, 'skipped — zeus CLI not installed');
        } else {
          let built = '';
          let detail = '';
          try {
            execFileSync('zeus', ['build', `--APILevel=${require(path.join(__dirname, '..', 'core', 'fonts')).zeusApiLevel(dev.api)}`],
              { cwd: zeusDir, stdio: 'pipe', timeout: 300000 });
            built = fs.readdirSync(path.join(zeusDir, 'dist')).filter((f) => f.endsWith('.zab')).join(', ');
          } catch (e) {
            detail = String((e.stderr || '') + (e.stdout || '')).split('\n')
              .filter((l) => /RESIZE|ENOENT|Error/.test(l)).slice(0, 1).join('').slice(0, 200);
          }
          check('zeus build packages the export', !!built, built || detail || 'zeus build failed');
        }
      }
    }

    // ---- fonts: name table parser, import, glyphs, Text font file ----------
    const fonts = require(path.join(__dirname, '..', 'core', 'fonts'));
    const orbitronFile = path.join(__dirname, '..', 'assets', 'fonts', 'Orbitron-Bold.ttf');
    const orbitron = fonts.fontInfoFromBuffer(fs.readFileSync(orbitronFile), 'Orbitron-Bold.ttf');
    const cormorant = fonts.fontInfoFromBuffer(fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'CormorantGaramond-SemiBold.ttf')), 'CormorantGaramond-SemiBold.ttf');
    check('font name table parser reads the family', orbitron.family === 'Orbitron' && /Cormorant Garamond/.test(cormorant.family),
      `Orbitron-Bold.ttf → “${orbitron.family}” (${orbitron.subfamily}), CormorantGaramond-SemiBold.ttf → “${cormorant.family}” (${cormorant.subfamily})`);
    check('font file detection + API level mapping', fonts.isFontFile('x.otf') && !fonts.isFontFile('x.png') && fonts.zeusApiLevel('1.0') === '1.0' && fonts.zeusApiLevel('4.2') === '4.0',
      `otf ok · 1.0→${fonts.zeusApiLevel('1.0')} · 4.2→${fonts.zeusApiLevel('4.2')}`);

    const imported = await run(`
      const base64 = ${JSON.stringify(fs.readFileSync(orbitronFile).toString('base64'))};
      const rec = await registerCustomFont({ name: 'MyDisplay.ttf', family: 'MyDisplay', ext: '.ttf', format: 'truetype', dataBase64: base64 });
      fillFontSelect($('projFont'));
      project.fonts = projectFontsPayload();
      return {
        registered: !!rec, custom: customFonts.length,
        inSelect: [...$('projFont').options].some(o => o.value === 'MyDisplay'),
        inElementFonts: fontFileOptions().some(o => o.value === 'MyDisplay.ttf'),
        loaded: fontCache.has('MyDisplay'),
      };`);
    check('import a font into the project', imported.registered && imported.custom === 1 && imported.inSelect && imported.inElementFonts && imported.loaded,
      `${imported.custom} project font(s) · select=${imported.inSelect} · layers=${imported.inElementFonts} · loaded=${imported.loaded}`);

    const customGlyphs = await run(`
      const names = await genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c })),
        { family: 'MyDisplay', size: 52, color: '#8ef0c0', weight: 700 });
      return { count: names.length, first: names[0], firstSize: (name => { const im = imgMeta(name); return im ? im.width + 'x' + im.height : ''; })(names[0]) };`);
    check('rasterize glyphs from an imported font', customGlyphs.count === 10 && /x/.test(customGlyphs.firstSize),
      `${customGlyphs.count} images, first ${customGlyphs.first} ${customGlyphs.firstSize}`);

    const textFont = await run(`
      const el = newElement('TEXT');
      el.name = 'Fonted text'; el.x = 20; el.y = 20; el.w = 200; el.h = 40; el.text = 'HELLO';
      el.fontFile = 'MyDisplay.ttf'; el.size = 30;
      project.elements.push(el);
      const code = await API.generateCode({ project });
      const saved = await API.saveProject({ project: { ...project, fonts: projectFontsPayload() }, images: projectImagesPayload(), fonts: fontRecords(), savePath: ${JSON.stringify(projectDir)}, previewBase64: '' });
      const exp2 = await API.exportZeus({ project, images: projectImagesPayload(), fonts: fontRecords(), previewBase64: '', outDir: ${JSON.stringify(zeusDir2)} });
      return { hasFontLine: /font: "fonts\\/MyDisplay\\.ttf"/.test(code.code || ''), snippet: (String(code.code || '').match(/[^\\n]*font: [^\\n]*/) || [''])[0].trim(), saved: !!saved, assetDir: exp2.assetDir };`);
    check('Text layer with a custom font emits font: "fonts/…"', textFont.hasFontLine,
      textFont.hasFontLine ? textFont.snippet : 'font parameter missing');
    const exportedFont = path.join(zeusDir2, 'assets', textFont.assetDir || TARGET, 'fonts', 'MyDisplay.ttf');
    check('export copies the font into assets/<target>/fonts/', fs.existsSync(exportedFont),
      fs.existsSync(exportedFont) ? `assets/${textFont.assetDir}/fonts/MyDisplay.ttf` : 'font file not copied into the Zeus project');

    const bundledFontExport = await run(`
      const el = newElement('TEXT');
      el.name = 'Bundled font text'; el.x = 20; el.y = 400; el.w = 220; el.h = 40; el.text = 'STEPS';
      el.fontFile = 'Orbitron-Bold.ttf'; el.size = 28;
      project.elements.push(el);
      const exp = await API.exportZeus({ project, images: projectImagesPayload(), fonts: fontRecords(), previewBase64: '', outDir: ${JSON.stringify(zeusDir3)} });
      return { assetDir: exp.assetDir };`);
    const bfDir = path.join(zeusDir3, 'assets', bundledFontExport.assetDir || TARGET, 'fonts');
    const bfFont = path.join(bfDir, 'Orbitron-Bold.ttf');
    check('a bundled font picked for a layer ships with its licence', fs.existsSync(bfFont) && fs.existsSync(path.join(bfDir, 'FONTS-LICENSES.md')),
      `assets/${bundledFontExport.assetDir}/fonts → ${fs.existsSync(bfFont) ? 'Orbitron-Bold.ttf' : 'font missing'}${fs.existsSync(path.join(bfDir, 'FONTS-LICENSES.md')) ? ' + FONTS-LICENSES.md' : ' (no licence)'}`);
    const bundledCode = await run(`
      const res = await API.generateCode({ project });
      return (String(res.code || '').match(/[^\\n]*font: [^\\n]*/g) || []).map((l) => l.trim());`);
    check('generated code references each layer font', Array.isArray(bundledCode) && bundledCode.some((l) => /Orbitron-Bold\.ttf/.test(l)) && bundledCode.some((l) => /MyDisplay\.ttf/.test(l)),
      (bundledCode || []).join(' | '));

    const fontFileOnDisk = fs.existsSync(path.join(projectDir, 'fonts', 'MyDisplay.ttf'));
    const reopenedFonts = await run(`
      const res = await API.openProjectPath(${JSON.stringify(projectDir)});
      await loadProject(res);
      return { fonts: (res.fonts || []).map(f => f.name + ':' + f.family), linked: project.elements.filter(e => e.fontFile === 'MyDisplay.ttf').length };`);
    check('font file travels with the project folder', fontFileOnDisk && reopenedFonts.fonts.some((s) => s.startsWith('MyDisplay.ttf:')),
      `${fontFileOnDisk ? 'fonts/MyDisplay.ttf saved' : 'font file missing'} · reopened: ${reopenedFonts.fonts.join(', ') || 'none'} · ${reopenedFonts.linked} layer(s) linked`);

    // ---- install: the real "Build & serve" flow (export + zeus build) ------
    // This is the path that surfaced the exit-7 icon crash.
    if (String(process.env.SMOKE_BUILD || '') !== '0') {
      let hasCli = true;
      try { execFileSync('zeus', ['-v'], { stdio: 'pipe' }); } catch (e) { hasCli = false; }
      if (!hasCli) {
        check('Build & serve packages a real .zab', true, 'skipped — zeus CLI not installed');
      } else {
        const built = await run(`
          const b = await API.installBuild({ project: { ...project, fonts: projectFontsPayload() }, images: projectImagesPayload(), fonts: fontRecords(), previewBase64: composePreviewB64() });
          const s = await API.installStart({ project, port: 7399, address: '127.0.0.1' });
          return { ok: b && b.ok !== false, error: (b && b.error) || null, artifacts: (b && b.artifacts) || [], dir: (b && b.outDir) || '', files: ((s && s.files) || []).map(f => f.label) };`);
        const iconThere = !!built.dir && fs.existsSync(path.join(built.dir, 'assets', TARGET, 'images', 'preview.png'));
        check('Build & serve packages a real .zab (used to fail with exit 7)',
          built.ok && built.artifacts.length > 0 && built.files.some((f) => /\.zab$/.test(f)) && iconThere,
          built.ok ? `${built.artifacts.map((a) => path.basename(a)).join(', ')} · serves: ${built.files.join(', ')}${iconThere ? ' · icon in staging' : ' · NO ICON'}`
            : (built.error || 'unknown error'));
        await run(`await API.installStop();`);
      }
    }

    // ---- install over Wi-Fi: LAN server + QR ------------------------------
    const zabDir = path.join(zeusDir, 'dist');
    fs.mkdirSync(zabDir, { recursive: true });
    const zabBytes = Buffer.from('PK\u0003\u0004 fake watchface package for the smoke test', 'utf8');
    fs.writeFileSync(path.join(zabDir, 'SmokeFace-1.0.0.zab'), zabBytes);

    const served = await run(`
      const res = await API.installStart({ project, port: 7399, address: '127.0.0.1', dir: ${JSON.stringify(zeusDir)} });
      const qr = await API.qr({ text: res.installUrl || 'x', width: 240 });
      return { ok: res.ok, port: res.port, running: res.running, files: (res.files || []).map(f => f.label), url: res.installUrl, page: res.pageUrl, qr: String(qr || '').slice(0, 22) };`);
    check('LAN install server starts and lists the package', served.ok !== false && served.running && served.files.some((f) => /\.zab$/.test(f)),
      `port ${served.port} · ${served.files.join(', ') || 'no files'}`);

    const get = (p) => new Promise((resolve) => {
      require('http').get({ host: '127.0.0.1', port: served.port, path: p }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      }).on('error', (e) => resolve({ status: 0, error: String(e.message || e) }));
    });
    const manifest = await get('/manifest.json');
    const health = await get('/health');
    const landing = await get('/');
    const pkg = await get('/SmokeFace-1.0.0.zab');
    let manifestJson = {};
    try { manifestJson = JSON.parse(manifest.body.toString('utf8')); } catch (e) { /* reported below */ }
    check('server answers manifest / health / landing page', manifest.status === 200 && health.status === 200 && landing.status === 200 && /Install package/i.test(landing.body.toString('utf8')),
      `manifest ${manifest.status}, health ${health.status}, page ${landing.status}, package route in manifest: ${manifestJson.package ? manifestJson.package.route : 'none'}`);
    check('the .zab downloads byte for byte', pkg.status === 200 && pkg.body.length === zabBytes.length && pkg.body.equals(zabBytes),
      `${pkg.status} · ${pkg.body.length} bytes · content-type ${pkg.headers['content-type']} · disposition ${pkg.headers['content-disposition'] || '-'}`);
    check('QR code is rendered for the install URL', /^data:image\/(png|svg)/.test(served.qr) && /^http:\/\/127\.0\.0\.1:\d+\//.test(served.url || ''),
      `${served.url} → ${served.qr}…`);

    const requests = await run(`await refreshInstall(); return { log: $('instLog').textContent.split('\\n').filter(Boolean).length, files: $('instFiles').textContent.trim().length };`);
    check('install modal lists the server files', !!requests && requests.files > 0,
      requests ? `${requests.files} chars in the file list, ${requests.log} log line(s)` : 'no response');

    const layout = await run(`
      const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
      const vw = innerWidth, vh = innerHeight;
      const spills = (root) => [...root.querySelectorAll('*')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); })
        .map((el) => el.className || el.tagName).slice(0, 4);
      const below = (root) => [...root.querySelectorAll('.modal-btns button, .glyph-actions button, .font-col-head button, .inst-actions button, .inst-url button, .qr-select input, .font-col > .row > input, .font-col > .row > select')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > vh + 1; }).length;
      const fits = (r) => r.y >= -1 && r.bottom <= vh + 1 && r.x >= -1 && r.right <= vw + 1;
      const out = { vw, vh };
      openFontModal();
      const fm = $('fontModal').querySelector('.modal');
      out.font = {
        modal: rect(fm),
        fits: fits(rect(fm)),
        rows: document.querySelectorAll('#fontList .font-row').length,
        groups: document.querySelectorAll('#fontList .font-group').length,
        preview: rect($('fontPreview')),
        listScrolls: $('fontList').scrollHeight > $('fontList').clientHeight,
        spill: spills(fm), below: below(fm),
      };
      const row = [...document.querySelectorAll('#fontList .font-row')].find((b) => /Orbitron/.test(b.textContent));
      if (row) row.click();
      out.font.selected = fontSelFamily;
      $('fontModal').hidden = true;
      await openInstallModal();
      await new Promise((r) => setTimeout(r, 500));
      const im = $('installModal').querySelector('.modal');
      out.install = {
        modal: rect(im),
        fits: fits(rect(im)),
        running: !!(instLast && instLast.running),
        files: document.querySelectorAll('#instFiles .inst-file').length,
        url: $('instUrl').textContent,
        log: $('instLog').textContent.split('\\n').filter(Boolean).length,
        monoLog: /mono/i.test(getComputedStyle($('instLog')).fontFamily),
        hint: $('instQrHint').textContent,
        qr: { ...rect($('instQr')), src: String($('instQr').src || '').slice(0, 15), natural: $('instQr').naturalWidth },
        spill: spills(im), below: below(im),
      };
      document.querySelector('input[name="instQrWhat"][value="page"]').click();
      await new Promise((r) => setTimeout(r, 400));
      out.install.pageUrl = $('instUrl').textContent;
      out.install.pageQrNatural = $('instQr').naturalWidth;
      $('installModal').hidden = true;
      return out;`);
    check('font library modal: every typeface listed and nothing clipped',
      !!layout.font && layout.font.rows >= 34 && layout.font.groups >= 5 && layout.font.spill.length === 0 && layout.font.below === 0
      && layout.font.fits && layout.font.preview.w > 100 && layout.font.listScrolls,
      layout.font ? `${layout.font.rows} rows in ${layout.font.groups} groups · modal ${layout.font.modal.w}×${layout.font.modal.h} at ${layout.font.modal.x},${layout.font.modal.y} in ${layout.vw}×${layout.vh} · fits=${layout.font.fits} · preview ${layout.font.preview.w}×${layout.font.preview.h} · scrolls=${layout.font.listScrolls} · spills ${layout.font.spill.join(',') || 'none'} · below fold ${layout.font.below}` : 'no data');
    check('font library modal: picking a typeface selects it', layout.font && layout.font.selected === 'Orbitron',
      `selection = ${layout.font ? layout.font.selected : '?'}`);

    check('install modal: layout fits and mirrors the live server', !!layout.install && layout.install.running
      && layout.install.fits
      && layout.install.spill.length === 0 && layout.install.below === 0 && layout.install.files >= 1
      && layout.install.monoLog && /^http:\/\//.test(layout.install.url) && layout.install.log >= 1,
      layout.install ? `modal ${layout.install.modal.w}×${layout.install.modal.h} at ${layout.install.modal.x},${layout.install.modal.y} · fits=${layout.install.fits} · ${layout.install.files} file row(s) · ${layout.install.url} · log ${layout.install.log} line(s) · qr hint “${layout.install.hint}” · spills ${layout.install.spill.join(',') || 'none'} · below fold ${layout.install.below}` : 'no data');
    check('install modal: QR renders for the package and for the landing page',
      !!layout.install && layout.install.qr.natural > 0 && /^data:image/.test(layout.install.qr.src)
      && Math.abs(layout.install.qr.w - layout.install.qr.h) <= 2
      && /^http:\/\/.+\/$/.test(layout.install.pageUrl || '') && layout.install.pageQrNatural > 0,
      layout.install ? `package QR ${layout.install.qr.w}×${layout.install.qr.h} (natural ${layout.install.qr.natural}), page QR natural ${layout.install.pageQrNatural}, “${layout.install.pageUrl}”` : 'no data');

    const textProps = await run(`
      const el = project.elements.find((e) => e.kind === 'TEXT');
      if (!el) return { none: true };
      selectedId = el.id; multiSel = new Set([el.id]); refreshPanels();
      const labels = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      const fontSel = [...document.querySelectorAll('#props select')].find((s) => [...s.options].some((o) => o.value === 'MyDisplay.ttf'));
      return {
        hasFontRow: labels.includes('Font'),
        hasWeightRow: labels.includes('Weight'),
        options: fontSel ? fontSel.options.length : 0,
        value: fontSel ? fontSel.value : '',
        customListed: fontSel ? [...fontSel.options].some((o) => o.value === 'MyDisplay.ttf') : false,
      };`);
    check('Text layer properties offer the font list (system + bundled + imported)',
      !!textProps && !textProps.none && textProps.hasFontRow && textProps.hasWeightRow && textProps.customListed && textProps.value === 'MyDisplay.ttf',
      textProps && textProps.none ? 'no Text layer' : `${textProps ? textProps.options : 0} fonts, selected ${textProps ? JSON.stringify(textProps.value) : '?'}, imported font listed=${textProps ? textProps.customListed : '?'}`);

    const stopped = await run(`const st = await API.installStop(); return { running: st.running };`);
    const after = await get('/health');
    check('stopping the server closes the port', stopped.running === false && after.status === 0,
      `status=${stopped.running ? 'running' : 'stopped'} · later request: ${after.status || after.error}`);

    // the committed sample has to keep loading with the current model, images and all
    const sampleUi = await run(`
      const res = await API.openProjectPath(${JSON.stringify(path.join(__dirname, '..', 'samples', 'sample-digital'))});
      if (res.error) return { error: res.error };
      await loadProject(res);
      const t = project.elements.find((e) => e.kind === 'TEXT');
      const lint = lintProject();
      const errors = lint.filter((l) => l.level === 'error');
      return {
        layers: project.elements.length, images: project.images.length,
        text: !!t, file: t ? t.fontFile : '', family: t ? familyForFontFile(t.fontFile) : '',
        errorCount: errors.length, errors: errors.slice(0, 2).map((l) => l.message),
      };`);
    check('the shipped sample loads clean (font layer resolves to a bundled family)',
      !!sampleUi && !sampleUi.error && sampleUi.text && sampleUi.file === 'Orbitron-Bold.ttf'
      && sampleUi.family === 'Orbitron' && sampleUi.errorCount === 0 && sampleUi.images > 0,
      sampleUi && sampleUi.error ? `could not open the sample: ${sampleUi.error}`
        : `${sampleUi ? sampleUi.layers : 0} layers, ${sampleUi ? sampleUi.images : 0} images · Text font ${sampleUi ? sampleUi.file : ''} → ${sampleUi ? sampleUi.family : ''} · ${sampleUi ? sampleUi.errorCount : '?'} lint error(s)${sampleUi && sampleUi.errors.length ? ': ' + sampleUi.errors.join(' / ') : ''}`);

    if (consoleErrors.length) {
      check('no console errors', false, consoleErrors.slice(0, 3).join(' | '));
    } else {
      check('no console errors', true, '');
    }
  } catch (e) {
    check('smoke run completed', false, String(e && e.message ? e.message : e));
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed · scratch: ${SCRATCH}`);
  app.exit(failed ? 1 : 0);
});
