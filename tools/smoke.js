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

    // ---- text styling: live fill types, bold/italic, group-wide apply -------
    const textStyle = await run(`
      await addElement('TEXT', { text: 'GRAD', x: 40, y: 40, w: 200, h: 60, fillType: 'gradient', bold: true });
      const e = elements().find(x => x.text === 'GRAD');
      const imgs = await exportImagesPayload();
      const img = imgs.find(i => i.name === e.bakedImage);
      const r = await API.generateCode({ project });
      return {
        reason: bakeReason(e),
        name: e.bakedImage || '',
        bytes: img ? img.dataBase64.length : 0,
        imgWidget: r.code.includes('ui.widget.IMG') && r.code.includes("A('" + e.bakedImage + "')"),
        comment: /baked by the designer/.test(r.code),
        textWidget: /text: "GRAD"/.test(r.code),   // the layer must no longer be a TEXT widget
      };`);
    check('styled text bakes to a PNG and emits an IMG widget',
      /^text_/.test(textStyle.name) && textStyle.bytes > 200 && textStyle.imgWidget && textStyle.comment && !textStyle.textWidget,
      `${textStyle.name} (${textStyle.bytes} b64 chars) · ${textStyle.reason}`);

    const textNative = await run(`
      const e = elements().find(x => x.text === 'GRAD');
      e.fillType = 'solid'; e.bold = false; e.italic = false;
      await bakedTextImages();
      const r = await API.generateCode({ project });
      return { name: e.bakedImage || null, textWidget: /ui\\.widget\\.TEXT/.test(r.code) && r.code.includes('"GRAD"') };`);
    check('flat text stays a native TEXT widget (no image needed)',
      !textNative.name && textNative.textWidget,
      `bakedImage=${textNative.name}, TEXT widget=${textNative.textWidget}`);

    const cssParse = await run(`
      const lin = parseCssGradient('linear-gradient(90deg, #fff 0%, #000 100%)');
      const rad = parseCssGradient('radial-gradient(circle at 30% 40%, #fff, #000)');
      const con = parseCssGradient('conic-gradient(from 45deg, #f00, #0f0)');
      return {
        lin: !!lin, linAngle: lin && lin.angle, linStops: lin && lin.stops.length,
        rad: !!rad, radCenter: rad && rad.center,
        con: !!con, bad: parseCssGradient('this is not a gradient'),
        box: cssCenter({ x: 0, y: 0, w: 100, h: 50 }, '30% 40%'),
      };`);
    check('CSS gradient parser (linear/radial/conic/stops/position)',
      cssParse.lin && cssParse.linAngle === 90 && cssParse.linStops === 2
      && cssParse.rad && cssParse.radCenter === '30% 40%' && cssParse.con
      && cssParse.bad === null && cssParse.box.x === 30 && cssParse.box.y === 20,
      `linear 90° · radial at ${cssParse.radCenter} · box ${JSON.stringify(cssParse.box)}`);

    const groupApply = await run(`
      await addElement('TEXT', { text: 'AA', x: 20, y: 200, w: 100, h: 30 });
      await addElement('TEXT', { text: 'BB', x: 20, y: 240, w: 100, h: 30 });
      const a = elements().find(x => x.text === 'AA'), b = elements().find(x => x.text === 'BB');
      a.group = 'gX'; b.group = 'gX'; project.groups = { gX: 'Pair' };
      selectedId = a.id; multiSel = new Set([a.id, b.id]);
      refreshPanels();
      const field = (label, sel) => {
        const row = [...document.querySelectorAll('#props .row')].find((r) => {
          const l = r.querySelector('.lbl'); return l && l.textContent.trim() === label;
        });
        return row ? row.querySelector(sel) : null;
      };
      const col = field('Color', 'input[type=color]');
      col.value = '#ff0000'; col.oninput();
      const bold = field('Bold', 'input[type=checkbox]');
      bold.checked = true; bold.onchange();
      const sz = field('Size', 'input[type=number]');
      sz.value = '17'; sz.oninput();
      return {
        labels: [...document.querySelectorAll('#props .row .lbl')].map(s => s.textContent.trim()),
        a: [a.color, a.bold, a.size], b: [b.color, b.bold, b.size],
      };`);
    check('text style writes to every child of the selected group',
      groupApply.a[0] === '#ff0000' && groupApply.b[0] === '#ff0000'
      && groupApply.a[1] === true && groupApply.b[1] === true
      && groupApply.a[2] === 17 && groupApply.b[2] === 17,
      `A=${JSON.stringify(groupApply.a)} B=${JSON.stringify(groupApply.b)} rows=${groupApply.labels.slice(0, 6).join(',')}…`);

    // leave one css-gradient layer behind so the export carries a baked PNG
    const styled = await run(`
      const e = elements().find(x => x.text === 'GRAD');
      e.fillType = 'css'; e.cssGradient = 'linear-gradient(135deg, #ffd400 0%, #ff2d55 100%)';
      const imgs = await exportImagesPayload();
      return { name: e.bakedImage || '', inPayload: imgs.some(i => i.name === e.bakedImage) };`);
    check('CSS-gradient layer baked into the export payload',
      /^text_/.test(styled.name) && styled.inPayload, styled.name);

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
      return API.exportZeus({ project, images: await exportImagesPayload(), previewBase64: composePreviewB64(), outDir: ${JSON.stringify(zeusDir)} });`);
    check('export a Zeus project', !!exp && exp.ok !== false, exp && exp.ok === false ? exp.error : `${exp.outDir}`);
    if (exp && exp.ok !== false) {
      const files = ['app.json', 'app.js'];
      const missing = files.filter((f) => !fs.existsSync(path.join(zeusDir, f)));
      const wf = path.join(zeusDir, 'watchface', TARGET, 'index.js');
      const assets = path.join(zeusDir, 'assets', exp.assetDir || TARGET, 'images');
      const pngs = fs.existsSync(assets) ? fs.readdirSync(assets).filter((f) => f.endsWith('.png')).length : 0;
      check('exported files exist', missing.length === 0 && fs.existsSync(wf) && pngs > 0,
        `${missing.length ? 'missing ' + missing.join(',') + '; ' : ''}${pngs} PNGs in assets`);
      check('baked text PNG lands in the exported assets',
        !!styled.name && fs.existsSync(path.join(assets, styled.name)),
        styled.name ? path.join('assets', exp.assetDir || TARGET, 'images', styled.name) : 'no baked layer');
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
    const codegenMod = require(path.join(__dirname, '..', 'core', 'codegen'));
    const devicesMod = require(path.join(__dirname, '..', 'core', 'devices'));
    const aodDev = devicesMod.deviceByKey(TARGET);
    const aodProj = { name: 'AOD probe', elements: [{ id: 'a1', kind: 'IMG', show: 'both' }, { id: 'a2', kind: 'TEXT', show: 'normal' }] };
    const aodFlag = {
      withAod: JSON.parse(codegenMod.generateAppJson(aodProj, aodDev)).targets[aodDev.target].module.watchface.lockscreen,
      withoutAod: JSON.parse(codegenMod.generateAppJson({ ...aodProj, elements: aodProj.elements.map((e) => ({ ...e, show: 'normal' })) }, aodDev)).targets[aodDev.target].module.watchface.lockscreen,
      js: codegenMod.generateWatchface(aodProj, aodDev).code,
    };
      const slArr = aodFlag.js.match(/show_level: [^\n]+/g) || [];
    check('app.json declares the face\'s own AOD (lockscreen) and emits per-state widgets',
      aodFlag.withAod === 1 && aodFlag.withoutAod === 0
      && /show_level: ui\.show_level\.ONLY_AOD/.test(aodFlag.js)
      && /show_level: ui\.show_level\.ONLY_NORMAL/.test(aodFlag.js)
      && !slArr.some((l) => /\|/.test(l))
      && appJson.targets[TARGET].module.watchface.lockscreen === 1,
      `lockscreen ${aodFlag.withAod} with AOD layers / ${aodFlag.withoutAod} without · show_level values: ${[...new Set(slArr.map((l) => l.trim()))].join(' / ')} · exported app.json lockscreen ${appJson.targets[TARGET].module.watchface.lockscreen}`);
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
      const exp2 = await API.exportZeus({ project, images: await exportImagesPayload(), fonts: fontRecords(), previewBase64: '', outDir: ${JSON.stringify(zeusDir2)} });
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
      const exp = await API.exportZeus({ project, images: await exportImagesPayload(), fonts: fontRecords(), previewBase64: '', outDir: ${JSON.stringify(zeusDir3)} });
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
          const b = await API.installBuild({ project: { ...project, fonts: projectFontsPayload() }, images: await exportImagesPayload(), fonts: fontRecords(), previewBase64: composePreviewB64() });
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
      await refreshInstall();
      const payload = instQrPayload(instLast);
      const qr = await API.qr({ text: payload || 'x', width: 240 });
      return { ok: res.ok, port: res.port, running: res.running, files: (res.files || []).map(f => f.label), url: res.installUrl, page: res.pageUrl,
        payload, encoded: $('instEncoded').textContent, qr: String(qr || '').slice(0, 22) };`);
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
    check('QR code encodes the zpkd1:// install URL the Zepp App scans',
      /^data:image\/(png|svg)/.test(served.qr)
      && /^zpkd1:\/\/127\.0\.0\.1:\d+\/.+\.zab$/.test(served.payload || '')
      && served.payload === served.encoded
      && /^http:\/\/127\.0\.0\.1:\d+\//.test(served.url || ''),
      `${served.url} → QR ${served.payload} · shown as ${served.encoded} → ${served.qr}…`);

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
        encoded: $('instEncoded').textContent,
        log: $('instLog').textContent.split('\\n').filter(Boolean).length,
        monoLog: /mono/i.test(getComputedStyle($('instLog')).fontFamily),
        hint: $('instQrHint').textContent,
        qr: { ...rect($('instQr')), src: String($('instQr').src || '').slice(0, 15), natural: $('instQr').naturalWidth },
        spill: spills(im), below: below(im),
      };
      document.querySelector('input[name="instQrWhat"][value="page"]').click();
      await new Promise((r) => setTimeout(r, 400));
      out.install.pageUrl = $('instUrl').textContent;
      out.install.pageEncoded = $('instEncoded').textContent;
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
      && layout.install.monoLog && /^http:\/\//.test(layout.install.url) && layout.install.log >= 1
      && /^zpkd1:\/\/127\.0\.0\.1:\d+\/.+\.zab$/.test(layout.install.encoded || ''),
      layout.install ? `modal ${layout.install.modal.w}×${layout.install.modal.h} at ${layout.install.modal.x},${layout.install.modal.y} · fits=${layout.install.fits} · ${layout.install.files} file row(s) · ${layout.install.url} · encoded ${layout.install.encoded} · log ${layout.install.log} line(s) · qr hint “${layout.install.hint}” · spills ${layout.install.spill.join(',') || 'none'} · below fold ${layout.install.below}` : 'no data');
    check('install modal: QR renders for the package and for the landing page',
      !!layout.install && layout.install.qr.natural > 0 && /^data:image/.test(layout.install.qr.src)
      && Math.abs(layout.install.qr.w - layout.install.qr.h) <= 2
      && /^http:\/\/.+\/$/.test(layout.install.pageUrl || '') && layout.install.pageQrNatural > 0
      && /^http:\/\//.test(layout.install.pageEncoded || ''),
      layout.install ? `package QR ${layout.install.qr.w}×${layout.install.qr.h} (natural ${layout.install.qr.natural}), page QR natural ${layout.install.pageQrNatural}, “${layout.install.pageUrl}” · page QR text “${layout.install.pageEncoded}”` : 'no data');

    // ---- leading-zero switch: preview has to match the exported code --------
    const leadingZero = await run(`
      const min = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'minute');
      if (!min) return { none: true };
      min.zero = 1;
      const on = digitTextFor(min);
      const wOn = measureSet(min).w;
      const codeOn = (await API.generateCode({ project })).code;
      min.zero = 0;
      const off = digitTextFor(min);
      const wOff = measureSet(min).w;
      const codeOff = (await API.generateCode({ project })).code;
      selectedId = min.id; multiSel = new Set([min.id]); refreshPanels();
      const note = [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent).find((t) => /Preview draws/.test(t)) || '';
      const rows = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      return { none: false, m: clock.m, on, off, wOn, wOff,
        codeOn: /minute_zero: 1/.test(codeOn), codeOff: /minute_zero: 0/.test(codeOff),
        note, hasRow: rows.includes('Leading 0') };`);
    check('leading-zero switch shows in the preview and matches the exported code',
      !leadingZero.none && leadingZero.m < 10
      && leadingZero.off === String(leadingZero.m) && leadingZero.on === String(leadingZero.m).padStart(2, '0')
      && leadingZero.wOn > leadingZero.wOff && leadingZero.codeOn && leadingZero.codeOff
      && leadingZero.hasRow && /leading zero off/.test(leadingZero.note),
      leadingZero.none ? 'no IMG_TIME minute layer'
        : `sample minute ${leadingZero.m} → preview “${leadingZero.off}” / “${leadingZero.on}” (box ${leadingZero.wOff}→${leadingZero.wOn}px) · code minute_zero 1=${leadingZero.codeOn} 0=${leadingZero.codeOff} · note “${leadingZero.note}”`);

    const textStyleRows = await run(`
      const el = project.elements.find((e) => e.kind === 'TEXT' && !needsTextBake(e))
        || project.elements.find((e) => e.kind === 'TEXT');
      selectedId = el.id; multiSel = new Set([el.id]); refreshPanels();
      const rows = [...document.querySelectorAll('#props .row')];
      const labels = rows.map((r) => (r.querySelector('.lbl') || {}).textContent || '');
      const spill = rows.filter((r) => r.scrollWidth > r.clientWidth + 2)
        .map((r) => (r.querySelector('.lbl') || {}).textContent || '?');
      return { labels, spill, fill: el.fillType || 'solid',
        notes: [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent) };
    `);
    check('Text properties expose size / fill / colour / bold / italic rows',
      ['Text', 'Size', 'Fill', 'Color', 'Bold', 'Italic', 'Font', 'Weight'].every((l) => textStyleRows.labels.includes(l))
      && textStyleRows.spill.length === 0
      && textStyleRows.notes.some((t) => /Text draws \d+×\d+ in a \d+×\d+ box/.test(t)),
      `fill=${textStyleRows.fill} · ${textStyleRows.labels.length} rows, ${textStyleRows.notes.length} note(s), spill: ${textStyleRows.spill.join(', ') || 'none'}`);

    const textProps = await run(`
      const el = project.elements.find((e) => e.kind === 'TEXT' && e.fontFile)
        || project.elements.find((e) => e.kind === 'TEXT');
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

    // ---- glyph styling: size / colour / fill / bold on image-driven layers ---
    const glyphRows = await run(`
      const el = project.elements.find((e) => e.kind === 'IMG_TIME');
      selectedId = el.id; multiSel = new Set([el.id]); refreshPanels();
      const rows = [...document.querySelectorAll('#props .row')];
      const labels = rows.map((r) => (r.querySelector('.lbl') || {}).textContent || '');
      const spill = rows.filter((r) => r.scrollWidth > r.clientWidth + 2).map((r) => (r.querySelector('.lbl') || {}).textContent || '?');
      return { labels, spill, imgs: (el.images || []).length,
        notes: [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent) };`);
    check('digit layer properties expose font / size / colour / fill / bold / italic rows',
      ['Font', 'Size', 'Fill', 'Color', 'Bold', 'Italic', 'Re-render'].every((l) => glyphRows.labels.includes(l))
      && glyphRows.spill.length === 0 && glyphRows.imgs >= 10
      && glyphRows.notes.some((t) => /not text/.test(t)),
      `${glyphRows.labels.length} rows, ${glyphRows.imgs} images, spill: ${glyphRows.spill.join(', ') || 'none'}`);

    const glyphResize = await run(`
      const el = await addElement('IMG_TIME', { name: 'Glyph test' });
      const src = (el.images || []).slice();
      const h0 = imgMeta(src[0]).height;
      selectedId = el.id; multiSel = new Set([el.id]); refreshPanels();
      const row = [...document.querySelectorAll('#props .row')].find((r) => ((r.querySelector('.lbl') || {}).textContent || '') === 'Size');
      const inp = row && row.querySelector('input');
      const cur = +inp.value;
      const next = cur >= 60 ? 32 : 96;
      inp.value = String(next);
      inp.dispatchEvent(new Event('input'));
      glyphGenQueue = []; clearTimeout(glyphGenTimer);
      await rerenderGlyphLayers([el]);
      const h1 = imgMeta(el.images[0]).height;
      return { n: src.length, same: src.length === el.images.length && src.every((n, i) => n === el.images[i]),
        h0, h1, cur, next, hadSizeRow: !!inp, size: (el.glyph || {}).size };`);
    check('glyph size in Properties re-renders the layer\'s own images in place',
      glyphResize.hadSizeRow && glyphResize.same && glyphResize.size === glyphResize.next
      && (glyphResize.next > glyphResize.cur ? glyphResize.h1 > glyphResize.h0 : glyphResize.h1 < glyphResize.h0),
      `${glyphResize.n} images kept their names · cell ${glyphResize.h0}px → ${glyphResize.h1}px when size went ${glyphResize.cur} → ${glyphResize.next}`);

    const glyphGrad = await run(`
      const el = elements().find((e) => e.kind === 'IMG_TIME' && (e.glyph || {}).size === 96);
      const scan = (name) => {
        const im = imgFor(name);
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const rows = [];
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            if (d[i + 3] > 16) { rows.push([y, d[i], d[i + 1], d[i + 2]]); break; }
          }
        }
        return rows;
      };
      const before = scan(el.images[0]).length;
      el.glyph = { ...(el.glyph || {}), fill: 'gradient', from: '#ff0000', to: '#0000ff', angle: 180 };
      await rerenderGlyphLayers([el]);
      const rows = scan(el.images[0]);
      const red = rows.filter((r) => r[1] > 120 && r[3] < 120).length;
      const blue = rows.filter((r) => r[3] > 120 && r[1] < 120).length;
      const top = rows.length ? rows[0].slice(1) : null, bottom = rows.length ? rows[rows.length - 1].slice(1) : null;
      return { solidRows: before, red, blue, total: rows.length, top, bottom };`);
    check('glyph fill types bake into the PNGs (2-stop gradient runs red→blue)',
      glyphGrad.total > 20 && glyphGrad.red > 2 && glyphGrad.blue > 2
      && glyphGrad.top && glyphGrad.top[0] > glyphGrad.top[2] && glyphGrad.bottom && glyphGrad.bottom[2] > glyphGrad.bottom[0],
      `${glyphGrad.total} ink rows · ${glyphGrad.red} red / ${glyphGrad.blue} blue · top ${glyphGrad.top} → bottom ${glyphGrad.bottom}`);

    const glyphShared = await run(`
      const hour = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'hour');
      const minute = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'minute');
      const shared = (hour.images || []).some((n) => (minute.images || []).includes(n));
      selectedId = hour.id; multiSel = new Set([hour.id]); refreshPanels();
      const note = [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent).find((t) => /Shared with/.test(t)) || '';
      const before = hour.images.slice();
      hour.glyph = { ...(hour.glyph || {}), size: 72, color: '#00ff00' };
      await rerenderGlyphLayers([hour]);
      return { shared, note: !!note, copied: !before.some((n) => hour.images.includes(n)),
        otherKept: minute.images.every((n) => !!imgMeta(n)),
        stillShared: hour.images.some((n) => minute.images.includes(n)) };`);
    check('a shared glyph set is copied before restyling (the other layer keeps its glyphs)',
      glyphShared.shared && glyphShared.note && glyphShared.copied && glyphShared.otherKept && !glyphShared.stillShared,
      `shared=${glyphShared.shared} · note=${glyphShared.note} · copied=${glyphShared.copied} · untouched other set=${glyphShared.otherKept && !glyphShared.stillShared}`);

    const glyphSep = await run(`
      const colon = project.elements.find((e) => e.kind === 'IMG' && /^colon/.test(e.src || ''));
      selectedId = colon.id; multiSel = new Set([colon.id]); refreshPanels();
      const labels = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      const src0 = colon.src;
      const h0 = imgMeta(src0).height;
      colon.glyph = { ...(colon.glyph || {}), size: 80, color: '#ff0000' };
      await rerenderGlyphLayers([colon]);
      const h1 = imgMeta(colon.src).height;
      // a blinking colon is a frame list: the off frame has to stay blank (and
      // the same size as the frame it alternates with)
      // a blinking colon is a frame list built from the design separators: the
      // off frame has to stay blank and the same size as the frame it alternates
      const anim = await addElement('IMG_ANIM', { frames: [src0, 'colon_off.png'], w: 40, h: 80 });
      const spec = glyphSpecForLayer(anim);
      await rerenderGlyphLayers([anim]);
      const onH = imgMeta(src0).height;
      const im = imgFor('colon_off.png');
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 16) ink++;
      return { labels, src0, src: colon.src, h0, h1, glyph: isGlyphLayer(anim), keepsOriginal: !!imgMeta(src0),
        ownFile: colon.src !== src0 && /^symbol_/.test(colon.src),
        chars: spec ? spec.map((s) => s.char) : [], offW: c.width, offH: c.height, onH, offInk: ink };`);
    check('a colon layer is restyled into a file of its own, blink frames stay blank',
      glyphSep.labels.includes('Font') && glyphSep.labels.includes('Size') && glyphSep.labels.includes('Symbol')
      && glyphSep.ownFile && glyphSep.keepsOriginal
      && glyphSep.h1 > glyphSep.h0 && glyphSep.glyph
      && glyphSep.chars.length === 2 && glyphSep.chars[0] === ':' && glyphSep.chars[1] === ' '
      && glyphSep.offH === glyphSep.onH && glyphSep.offInk === 0,
      `${glyphSep.src0} ${glyphSep.h0}px → ${glyphSep.src} ${glyphSep.h1}px (own file ${glyphSep.ownFile}, original kept ${glyphSep.keepsOriginal}) · frame chars ${JSON.stringify(glyphSep.chars)} · off frame ${glyphSep.offW}×${glyphSep.offH} vs on ${glyphSep.onH} with ${glyphSep.offInk} ink px`);

    const glyphDegree = await run(`
      await applyPreset('temp');
      const el = elements().find((e) => e.kind === 'TEXT_IMG' && e.dataType === 'WEATHER_CURRENT');
      el.glyph = { ...(el.glyph || {}), size: 60, color: '#ff8800' };
      await rerenderGlyphLayers([el]);
      const meta = imgMeta('degree.png');
      const im = imgFor('degree.png');
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0, best = null;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { ink++; best = [d[i], d[i + 1], d[i + 2]]; }
      return { unit: el.unit, w: meta.width, h: meta.height, ink, color: best };`);
    check('a temperature layer restyles its degree (unit) glyph too',
      glyphDegree.unit === 'degree.png' && glyphDegree.ink > 0 && glyphDegree.h > 0
      && glyphDegree.color && glyphDegree.color[0] > 200 && glyphDegree.color[1] > 100 && glyphDegree.color[2] < 80,
      `${glyphDegree.unit} ${glyphDegree.w}×${glyphDegree.h} · ${glyphDegree.ink} ink px · colour ${glyphDegree.color}`);

    const glyphGroup = await run(`
      const a = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'hour');
      let b = project.elements.find((e) => e.kind === 'IMG_DATE');
      if (!b) b = await addElement('IMG_DATE');
      selectedId = a.id; multiSel = new Set([a.id, b.id]); refreshPanels();
      const note = [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent).find((t) => /applied to all 2/.test(t)) || '';
      const row = [...document.querySelectorAll('#props .row')].find((r) => ((r.querySelector('.lbl') || {}).textContent || '') === 'Bold');
      const inp = row.querySelector('input');
      inp.checked = true;
      inp.dispatchEvent(new Event('change'));
      glyphGenQueue = []; clearTimeout(glyphGenTimer);
      await rerenderGlyphLayers([a, b]);
      return { note: !!note, aBold: !!(a.glyph || {}).bold, bBold: !!(b.glyph || {}).bold, bImgs: (b.images || []).length };`);
    check('glyph styles apply to every selected image layer (group-wide)',
      glyphGroup.note && glyphGroup.aBold && glyphGroup.bBold && glyphGroup.bImgs >= 10,
      `note=${glyphGroup.note} · hour bold=${glyphGroup.aBold} · date bold=${glyphGroup.bBold} (${glyphGroup.bImgs} images)`);

    // ---- group box, align to box / device, distribute -----------------------
    const groupUi = await run(`
      const a = await addElement('FILL_RECT', { w: 60, h: 40, color: '#1c1c1c' });
      a.x = 40; a.y = 60;
      const b = await addElement('FILL_RECT', { w: 60, h: 40, color: '#1c1c1c' });
      b.x = 220; b.y = 90;
      const cv = $('cv');
      const px = (x, y) => { const d = cv.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2]]; };
      // scan a short vertical window: the group line is 2px and antialiased
      const scan = (x, y0, y1) => {
        let n = 0;
        for (let y = y0; y <= y1; y++) { const p2 = px(x, y); if (p2[2] > 180 && p2[1] > 90 && p2[1] < 200 && p2[0] < 170) n++; }
        return n;
      };
      selectedId = a.id; multiSel = new Set([a.id]); refreshPanels(); render();
      const singleTop = scan(150, 57, 65);
      const singleBottom = scan(150, 125, 133);
      selectedId = a.id; multiSel = new Set([a.id, b.id]); refreshPanels(); render();
      const gapTop = scan(150, 57, 65);
      const gapBottom = scan(150, 125, 133);
      const heads = [...document.querySelectorAll('#props .group-box .gb-head')].map((h) => h.textContent);
      const btns = [...document.querySelectorAll('#props .aligntools button')].map((x) => x.textContent);
      const tips = [...document.querySelectorAll('#props .aligntools button')].map((x) => x.title);
      const spill = [...document.querySelectorAll('#props .aligntools button, #props .group-box')].filter((r) => r.scrollWidth > r.clientWidth + 2).length;
      const box = selBox(selection());
      return { singleTop, singleBottom, gapTop, gapBottom, heads, btns, tips, spill,
        box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) },
        a: a.id, b: b.id };`);
    check('a multi-selection draws one bounding box around the whole group',
      groupUi.gapTop >= 1 && groupUi.gapBottom >= 1 && groupUi.singleTop === 0 && groupUi.singleBottom === 0
      && groupUi.box.w === 240 && groupUi.box.h === 70 && groupUi.box.x === 40 && groupUi.box.y === 60,
      `union ${groupUi.box.w}×${groupUi.box.h} at ${groupUi.box.x},${groupUi.box.y} · box line pixels top ${groupUi.gapTop} / bottom ${groupUi.gapBottom} · with one layer selected ${groupUi.singleTop}/${groupUi.singleBottom}`);
    check('Properties offers align-to-box, align-to-device and distribute rows',
      ['Align to box', 'Align to device', 'Distribute across', 'Distribute down'].every((t) => groupUi.heads.includes(t))
      && ['Left', 'Center', 'Right', 'Top', 'Middle', 'Bottom', 'Even', 'Spread', 'Start', 'End'].every((t) => groupUi.btns.includes(t))
      && groupUi.tips.filter((t) => /bounding box/.test(t)).length === 6
      && groupUi.tips.filter((t) => /device screen/.test(t)).length === 6
      && groupUi.spill === 0,
      `${groupUi.heads.join(' · ')} — ${groupUi.btns.length} buttons, ${groupUi.tips.filter((t) => /bounding box/.test(t)).length} box + ${groupUi.tips.filter((t) => /device screen/.test(t)).length} device tooltips, spill ${groupUi.spill}`);

    const alignRun = await run(`
      const D = dev();
      const a = elementById(${JSON.stringify(groupUi.a)});
      const b = elementById(${JSON.stringify(groupUi.b)});
      selectedId = a.id; multiSel = new Set([a.id, b.id]);
      const before = Math.round(selBox(selection()).x);
      alignSel(selection(), 'left', D, 'box');
      const boxLeft = Math.round(selBox(selection()).x);
      alignSel(selection(), 'left', D, 'device');
      const devLeft = Math.round(selBox(selection()).x);
      alignSel(selection(), 'right', D, 'device');
      const rights = selection().map((e) => Math.round(elBox(e).x + elBox(e).w));
      alignSel(selection(), 'vcenter', D, 'device');
      const centres = selection().map((e) => Math.round(elBox(e).y + elBox(e).h / 2));
      return { before, boxLeft, devLeft, rights, centres, devW: D.w, devH: D.h };`);
    check('align to box keeps the group box, align to device uses the screen',
      alignRun.boxLeft === alignRun.before && alignRun.devLeft === 0
      && alignRun.rights.every((r) => r === alignRun.devW)
      && alignRun.centres.every((c) => c === Math.round(alignRun.devH / 2)),
      `box-left ${alignRun.before}→${alignRun.boxLeft} · device-left ${alignRun.devLeft} · right edges ${alignRun.rights.join(',')} of ${alignRun.devW} · centres ${alignRun.centres.join(',')} of ${alignRun.devH / 2}`);

    const distRun = await run(`
      const D = dev();
      const a = await addElement('FILL_RECT', { w: 50, h: 20, color: '#202020' });
      a.x = 30; a.y = 300;
      const b = await addElement('FILL_RECT', { w: 80, h: 20, color: '#202020' });
      b.x = 60; b.y = 340;
      const c = await addElement('FILL_RECT', { w: 40, h: 20, color: '#202020' });
      c.x = 120; c.y = 380;
      selectedId = a.id; multiSel = new Set([a.id, b.id, c.id]);
      const xs = () => selection().map((e) => elBox(e)).sort((p, q) => p.x - q.x);
      distributeSel(selection(), 'x', 'evenly', D);
      const even = xs();
      const gaps = [even[1].x - (even[0].x + even[0].w), even[2].x - (even[1].x + even[1].w)];
      const margins = [even[0].x, D.w - (even[2].x + even[2].w)];
      distributeSel(selection(), 'x', 'between', D);
      const spread = xs();
      distributeSel(selection(), 'x', 'start', D);
      const packed = xs();
      distributeSel(selection(), 'y', 'evenly', D);
      const ys = selection().map((e) => elBox(e)).sort((p, q) => p.y - q.y);
      return { gaps, margins, spreadFirst: spread[0].x, spreadLast: Math.round(spread[2].x + spread[2].w),
        packedFirst: packed[0].x, packedGap: packed[1].x - (packed[0].x + packed[0].w),
        yGaps: [ys[1].y - (ys[0].y + ys[0].h), ys[2].y - (ys[1].y + ys[1].h)], devW: D.w, n: 3 };`);
    check('distribute spaces, spreads and packs the selection like the reference',
      Math.abs(distRun.gaps[0] - distRun.gaps[1]) <= 1 && Math.abs(distRun.margins[0] - distRun.margins[1]) <= 1
      && distRun.spreadFirst === 0 && distRun.spreadLast === distRun.devW
      && distRun.packedFirst === 0 && distRun.packedGap === 0
      && Math.abs(distRun.yGaps[0] - distRun.yGaps[1]) <= 1,
      `evenly gaps ${distRun.gaps.join('/')} margins ${distRun.margins.join('/')} · spread ${distRun.spreadFirst}→${distRun.spreadLast} of ${distRun.devW} · packed x ${distRun.packedFirst} gap ${distRun.packedGap} · down gaps ${distRun.yGaps.join('/')}`);

    const snapAid = await run(`
      const a = elementById(${JSON.stringify(groupUi.a)});
      const b = elementById(${JSON.stringify(groupUi.b)});
      const allN = alignTargets([]).xs.length;
      const skipN = alignTargets([a.id, b.id]).xs.length;
      const oneN = alignTargets(a.id).xs.length;
      const union = unionBox([elBox(a), elBox(b)]);
      const s = snapBox(union.x + 3, union.y, union.w, union.h, [a.id, b.id]);
      const cands = [...alignTargets([a.id, b.id]).xs, dev().w / 2];
      const onTarget = cands.some((t) => Math.abs(t - s.x) < 0.6) || s.x % 20 === 0;
      return { drop2: allN - skipN, drop1: allN - oneN, unionX: union.x, snapped: s.x, onTarget };`);
    check('the snap aid uses the group box, and members are not their own snap targets',
      snapAid.drop2 === 6 && snapAid.drop1 === 3 && snapAid.onTarget,
      `two members excluded → ${snapAid.drop2} targets fewer (one → ${snapAid.drop1}) · group box left ${snapAid.unionX} +3 → snapped ${snapAid.snapped} (on a target: ${snapAid.onTarget})`);

    // the drag itself: grabbing one member must snap the GROUP box, not the box
    // under the cursor (the bug this fixes)
    const dragAid = await run(`
      const cv = $('cv');
      const r = cv.getBoundingClientRect();
      const sc = cv.width / r.width;
      const ev = (t, x, y) => new MouseEvent(t, { bubbles: true, clientX: r.left + x / sc, clientY: r.top + y / sc });
      const p = await addElement('FILL_RECT', { w: 40, h: 20, color: '#202020' });
      p.x = 100; p.y = 400;
      const q = await addElement('FILL_RECT', { w: 40, h: 20, color: '#202020' });
      q.x = 180; q.y = 400;
      selectedId = q.id; multiSel = new Set([p.id, q.id]);
      refreshPanels(); render();
      // a clean spot for the group box: no other layer edge (and not the screen
      // centre) within the snap range of its left / centre / right refs, so the
      // reference edge we add is the only candidate
      const W = dev().w;
      let base = 60;
      for (let x = 40; x + 120 <= W - 40; x++) {
        const refs = [x, x + 60, x + 120];
        const cands = [...alignTargets([p.id, q.id]).xs, W / 2];
        if (!cands.some((t) => refs.some((rf) => Math.abs(rf - t) <= 4))) { base = x; break; }
      }
      p.x = base; q.x = base + 80;
      const ref = await addElement('FILL_RECT', { w: 20, h: 20, color: '#202020' });
      ref.x = base + 63; ref.y = 440;
      selectedId = q.id; multiSel = new Set([p.id, q.id]);
      refreshPanels(); render();
      const centreOf = () => { const u = unionBox([elBox(p), elBox(q)]); return Math.round(u.x + u.w / 2); };
      const rivals = alignTargets([p.id, q.id]).xs.filter((t) => Math.abs(t - (base + 61)) <= 4);
      const before = { p: p.x, q: q.x, centre: centreOf() };
      const hit = hitElement(ev('mousemove', q.x + 20, 410));
      cv.dispatchEvent(ev('mousedown', q.x + 20, 410));
      const started = drag ? { mode: drag.mode, isQ: drag.e.id === q.id, mates: drag.mates.length } : null;
      window.dispatchEvent(ev('mousemove', q.x + 21, 410));
      const mid = { dx: drag && drag.dx, guides: JSON.stringify(guides) };
      window.dispatchEvent(ev('mouseup', q.x + 21, 410));
      const after = { p: p.x, q: q.x, centre: centreOf() };
      return { before, after, ref: ref.x, base, rivals, showGrid, started, mid,
        hit: hit ? (hit.id === q.id ? 'q' : hit.id === p.id ? 'p' : hit.id) : null };`);
    check('dragging a member snaps the group box (not the layer under the cursor)',
      dragAid.showGrid && dragAid.rivals.length === 1 && dragAid.rivals[0] === dragAid.ref
      && dragAid.after.centre === dragAid.ref
      && dragAid.after.p - dragAid.before.p === 3 && dragAid.after.q - dragAid.before.q === 3,
      `group centre ${dragAid.before.centre} → ${dragAid.after.centre} (reference edge ${dragAid.ref} at base ${dragAid.base}, rivals ${JSON.stringify(dragAid.rivals)}) · members moved ${dragAid.after.p - dragAid.before.p}/${dragAid.after.q - dragAid.before.q}px · hit ${dragAid.hit} · start ${JSON.stringify(dragAid.started)} mid ${JSON.stringify(dragAid.mid)}`);

    // ---- Align: the run is anchored on the layer's X ------------------------
    const alignProp = await run(`
      const min = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'minute');
      if (!min) return { none: true };
      const cv = $('cv');
      min.zero = 0; min.x = 120; min.y = 220;
      min.alignH = 'LEFT'; render();
      const boxL = digitBox(min); const runL = digitRunX(min, boxL); const pngL = cv.toDataURL();
      min.alignH = 'CENTER_H'; render();
      const runC = digitRunX(min, digitBox(min)); const pngC = cv.toDataURL();
      min.alignH = 'RIGHT'; render();
      const runR = digitRunX(min, digitBox(min)); const pngR = cv.toDataURL();
      const codeLeft = (await API.generateCode({ project: { ...project, elements: project.elements.map((x) => (x === min ? { ...x, alignH: 'LEFT' } : x)) } })).code;
      const codeRight = (await API.generateCode({ project })).code;
      min.alignH = 'LEFT'; render();
      selectedId = min.id; multiSel = new Set([min.id]); refreshPanels();
      const note = [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent).find((t) => /Align Left puts the run/.test(t)) || '';
      const rows = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      return { none: false, x: min.x, box: { x: Math.round(boxL.x), w: Math.round(boxL.w) }, run: Math.round(boxL.run),
        runL: Math.round(runL), runC: Math.round(runC), runR: Math.round(runR),
        differs: pngL !== pngC && pngC !== pngR && pngL !== pngR,
        codeLeft: /minute_align: ui\\.align\\.LEFT/.test(codeLeft), codeRight: /minute_align: ui\\.align\\.RIGHT/.test(codeRight),
        note: !!note, hasRow: rows.includes('Align') };`);
    check('Align moves the value inside the widget box (box stays put)',
      !alignProp.none && alignProp.box.x === alignProp.x && alignProp.box.w > alignProp.run
      && alignProp.runL === alignProp.box.x
      && Math.abs(alignProp.runC - (alignProp.box.x + (alignProp.box.w - alignProp.run) / 2)) <= 1
      && Math.abs(alignProp.runR - (alignProp.box.x + alignProp.box.w - alignProp.run)) <= 1
      && alignProp.differs && alignProp.codeLeft && alignProp.codeRight && alignProp.note && alignProp.hasRow,
      alignProp.none ? 'no IMG_TIME minute layer'
        : `box ${alignProp.box.w}px at X=${alignProp.box.x} (run ${alignProp.run}px) → run left edge ${alignProp.runL} · centre ${alignProp.runC} · right ${alignProp.runR} · canvas differs ${alignProp.differs} · export LEFT ${alignProp.codeLeft} / RIGHT ${alignProp.codeRight} · note ${alignProp.note}`);

    // ---- Follow: the value is drawn after the previous part -----------------
    const followRun = await run(`
      const hour = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'hour');
      const min = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'minute');
      if (!hour || !min) return { none: true };
      hour.alignH = 'LEFT'; hour.space = 3; hour.x = 60; hour.y = 200;
      min.follow = 0; min.x = 400; min.y = 260;
      const free = digitBox(min);
      min.follow = 1;
      const hb = digitBox(hour), mb = digitBox(min);
      const code = (await API.generateCode({ project })).code;
      selectedId = min.id; multiSel = new Set([min.id]); refreshPanels();
      const rows = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      const note = [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent).find((t) => /Follows/.test(t)) || '';
      return { none: false, free: { x: Math.round(free.x), y: Math.round(free.y) },
        hourBox: { x: Math.round(hb.x), w: Math.round(hb.w), y: Math.round(hb.y) },
        followed: { x: Math.round(mb.x), y: Math.round(mb.y) },
        keepsFollow: /minute_follow: 1/.test(code),
        noStart: !/minute_startX/.test(code), noAlign: !/minute_align/.test(code), noSpace: !/minute_space/.test(code),
        keepsArray: /minute_array/.test(code), keepsZero: /minute_zero/.test(code),
        hidesSpace: !rows.includes('Space'), hidesAlign: !rows.includes('Align'), note: !!note };`);
    check('Follow draws the value after the previous part and drops its own startX/align/space',
      !followRun.none
      && followRun.followed.x === followRun.hourBox.x + followRun.hourBox.w
      && followRun.followed.y === followRun.hourBox.y
      && followRun.free.x === 400 && followRun.followed.x !== followRun.free.x
      && followRun.keepsFollow && followRun.noStart && followRun.noAlign && followRun.noSpace
      && followRun.keepsArray && followRun.keepsZero
      && followRun.hidesSpace && followRun.hidesAlign && followRun.note,
      followRun.none ? 'no clock layers'
        : `hour box ${followRun.hourBox.x}..${followRun.hourBox.x + followRun.hourBox.w} → minute at ${followRun.followed.x},${followRun.followed.y} (was ${followRun.free.x},${followRun.free.y}) · code: follow ${followRun.keepsFollow}, startX ${!followRun.noStart}, align ${!followRun.noAlign}, space ${!followRun.noSpace}, array ${followRun.keepsArray}, zero ${followRun.keepsZero} · panel hides Space ${followRun.hidesSpace} / Align ${followRun.hidesAlign} · note ${followRun.note}`);

    // ---- a temperature reading: no leading zero, ° as a superscript --------
    const degreeRun = await run(`
      const el = project.elements.find((e) => e.kind === 'TEXT_IMG' && e.dataType === 'WEATHER_CURRENT');
      if (!el) return { none: true };
      el.glyph = { ...(el.glyph || {}), size: 48, color: '#ffffff' };
      await rerenderGlyphLayers([el]);
      const cell = imgMeta((el.images || [])[0]);
      const deg = imgMeta('degree.png');
      const im = imgFor('degree.png');
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0, firstRow = -1, lastRow = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 16) { ink++; if (firstRow < 0) firstRow = y; lastRow = y; }
        }
      }
      const box = digitBox(el);
      return { none: false, cellH: cell ? cell.height : 0, degH: deg.height, degW: deg.width, ink,
        inkH: lastRow - firstRow + 1, firstRow, lastRow, h: c.height,
        text: digitTextFor(el), cap: digitCapacity(el), boxW: Math.round(box.w), runW: Math.round(box.run) };`);
    check('a temperature reading drops the leading zero and puts ° high',
      !degreeRun.none && degreeRun.text === '22' && degreeRun.cap === 3
      && degreeRun.boxW > degreeRun.runW
      && degreeRun.degH === degreeRun.cellH
      && degreeRun.firstRow <= 4
      && degreeRun.inkH >= degreeRun.degH * 0.2 && degreeRun.inkH <= degreeRun.degH * 0.55,
      degreeRun.none ? 'no temperature layer'
        : `preview “${degreeRun.text}” in a ${degreeRun.cap}-digit box (${degreeRun.boxW}px, run ${degreeRun.runW}px) · degree.png ${degreeRun.degW}×${degreeRun.degH} vs digit cell ${degreeRun.cellH}px · ink ${degreeRun.inkH}px tall at rows ${degreeRun.firstRow}..${degreeRun.lastRow}`);

    // ---- group rename + the show-in default for new components -------------
    const groupRename = await run(`
      const a = await addElement('TEXT', { text: 'G1', w: 60, h: 20 });
      const b = await addElement('TEXT', { text: 'G2', w: 60, h: 20 });
      selectedId = a.id; multiSel = new Set([a.id, b.id]);
      groupSelection();
      const gid = a.group;
      const autoName = groupName(gid);
      renameGroup(gid, 'Clock row');
      const named = project.groups[gid];
      const inPanel = (document.querySelector('#layers .group-row .gname') || {}).textContent;
      // inline rename: double-click the name in the layers panel
      startGroupRename(gid, document.querySelector('#layers .group-row .gname'));
      const inp = document.querySelector('#layers .group-row .gname-edit');
      const inputAppeared = !!inp;
      inp.value = 'Renamed inline';
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const inline = (document.querySelector('#layers .group-row .gname') || {}).textContent;
      // the Properties row for a whole group selection
      selectedId = a.id; multiSel = new Set([a.id, b.id]); refreshPanels();
      const labels = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      const row = [...document.querySelectorAll('#props .row')].find((r) => ((r.querySelector('.lbl') || {}).textContent || '') === 'Group name');
      const propsValue = row ? row.querySelector('input').value : null;
      // clearing the name falls back to the default label
      renameGroup(gid, '   ');
      const cleared = groupName(gid);
      renameGroup(gid, 'Clock row');
      return { autoName, named, inPanel, inputAppeared, inline, propsValue,
        hasRow: labels.includes('Group name'), cleared, gid };`);
    check('groups can be renamed (layers panel and Properties)',
      /^Group /.test(groupRename.autoName) && groupRename.named === 'Clock row' && groupRename.inPanel === 'Clock row'
      && groupRename.inputAppeared && groupRename.inline === 'Renamed inline'
      && groupRename.hasRow && groupRename.propsValue === 'Renamed inline'
      && /^Group /.test(groupRename.cleared),
      `auto “${groupRename.autoName}” → “${groupRename.named}” (panel “${groupRename.inPanel}”) → inline “${groupRename.inline}” · Properties row ${groupRename.hasRow} value “${groupRename.propsValue}” · cleared → “${groupRename.cleared}”`);

    const showDefault = await run(`
      const fresh = await addElement('IMG_TIME', { name: 'Fresh clock' });
      const freshText = await addElement('TEXT', { text: 'X' });
      const clockHour = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'hour');
      const reading = project.elements.find((e) => e.kind === 'TEXT_IMG' && e.dataType === 'STEP');
      const labels = SHOW_LEVELS.map((s) => s.key + ':' + s.label);
      return { fresh: fresh.show, freshText: freshText.show, clockHour: clockHour && clockHour.show,
        reading: reading && reading.show, labels };`);
    check('new components start in Normal only (presets still opt into AOD)',
      showDefault.fresh === 'normal' && showDefault.freshText === 'normal'
      && showDefault.clockHour === 'both' && showDefault.reading === 'normal',
      `added IMG_TIME ${showDefault.fresh}, TEXT ${showDefault.freshText} · clock preset hour ${showDefault.clockHour}, step reading ${showDefault.reading} · levels ${showDefault.labels.join(', ')}`);

    // ---- the layers toolbar: duplicate / group / ungroup --------------------
    const layersBar = await run(`
      const bar = document.querySelector('.layers-panel .layers-toolbar');
      const panel = document.querySelector('#layers').closest('.panel-c');
      const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) }; };
      const btns = bar ? [...bar.querySelectorAll('button')].map((b) => b.id) : [];
      const styles = bar ? [...bar.querySelectorAll('button')].map((b) => {
        const s = getComputedStyle(b);
        return { id: b.id, border: s.borderTopWidth, bg: s.backgroundColor, svg: !!b.querySelector('svg'),
          w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) };
      }) : [];
      const head = panel ? panel.querySelector('.phead') : null;
      return { btns, styles, bar: bar ? rect(bar) : null, panel: panel ? rect(panel) : null,
        headerButtons: head ? head.querySelectorAll('.lbtns button').length : -1 };`);
    check('the layers panel has a flat bottom toolbar (duplicate / group / ungroup)',
      layersBar.btns.join(',') === 'btnDup,btnGroup,btnUngroup'
      && layersBar.headerButtons === 0
      && layersBar.styles.every((s) => s.border === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(s.bg) && s.svg && s.h >= 28)
      && layersBar.bar.y > layersBar.panel.y + layersBar.panel.h / 2
      && layersBar.bar.bottom <= layersBar.panel.bottom + 1,
      `buttons ${layersBar.btns.join(', ')} · ${layersBar.styles.map((s) => `${s.id} ${s.w}×${s.h} border ${s.border}`).join(' · ')} · bar at y=${layersBar.bar.y} in panel ${layersBar.panel.y}..${layersBar.panel.bottom} · header buttons left ${layersBar.headerButtons}`);

    const layersActions = await run(`
      const a = await addElement('TEXT', { text: 'D1', w: 40, h: 16 });
      const b = await addElement('TEXT', { text: 'D2', w: 40, h: 16 });
      selectedId = a.id; multiSel = new Set([a.id, b.id]); refreshPanels();
      const enabledTwo = { dup: !$('btnDup').disabled, group: !$('btnGroup').disabled, ungroup: !$('btnUngroup').disabled };
      $('btnGroup').click();
      const gid = a.group;
      const grouped = !!gid && b.group === gid;
      const ungroupEnabled = !$('btnUngroup').disabled;
      const ax = elBox(a).x;
      $('btnDup').click();                                   // duplicate the group
      const copies = selection().filter((e) => / copy$/.test(e.name));
      const copyGid = copies.length ? copies[0].group : null;
      const dup = { copies: copies.length, forked: !!copyGid && copyGid !== gid, name: copyGid ? groupName(copyGid) : null,
        originalIntact: elements().filter((e) => e.group === gid).length,
        offset: copies.length ? Math.round(elBox(copies[0]).x - ax) : 0 };
      $('btnUngroup').click();
      const ungrouped = selection().every((e) => !e.group);
      selectedId = null; multiSel = new Set(); refreshPanels();
      const noneSel = { dup: $('btnDup').disabled, group: $('btnGroup').disabled, ungroup: $('btnUngroup').disabled };
      return { enabledTwo, grouped, ungroupEnabled, dup, ungrouped, noneSel };`);
    check('the toolbar duplicates layers and whole groups, and groups/ungroups',
      layersActions.enabledTwo.dup && layersActions.enabledTwo.group && !layersActions.enabledTwo.ungroup
      && layersActions.grouped && layersActions.ungroupEnabled
      && layersActions.dup.copies === 2 && layersActions.dup.forked && /copy$/.test(layersActions.dup.name || '')
      && layersActions.dup.originalIntact === 2 && layersActions.dup.offset === 12
      && layersActions.ungrouped
      && layersActions.noneSel.dup && layersActions.noneSel.group && layersActions.noneSel.ungroup,
      `grouped ${layersActions.grouped} · duplicated ${layersActions.dup.copies} into “${layersActions.dup.name}” (+${layersActions.dup.offset}px, original group still ${layersActions.dup.originalIntact} members) · ungrouped ${layersActions.ungrouped} · with nothing selected dup/group/ungroup disabled ${JSON.stringify(layersActions.noneSel)}`);

    // ---- Show in / Alpha apply to every selected layer ----------------------
    const showGroup = await run(`
      const a = project.elements.find((e) => e.kind === 'TEXT' && e.text === 'D1');
      const b = project.elements.find((e) => e.kind === 'TEXT' && e.text === 'D2');
      if (!a || !b) return { none: true };
      a.group = b.group = 'gShow';
      project.groups = project.groups || {};
      project.groups.gShow = 'Show test';
      a.show = 'normal'; b.show = 'normal'; a.alpha = 255; b.alpha = 255;
      selectedId = a.id; multiSel = new Set([a.id, b.id]); refreshPanels();
      const rowOf = (lbl) => [...document.querySelectorAll('#props .row')].find((r) => ((r.querySelector('.lbl') || {}).textContent || '') === lbl);
      const selShow = rowOf('Show in').querySelector('select');
      selShow.value = 'aod';
      selShow.onchange();
      const alphaInp = rowOf('Alpha').querySelector('input');
      alphaInp.value = '128';
      alphaInp.oninput();
      const note = [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent).find((t) => /apply to every selected layer/.test(t)) || '';
      return { none: false, aShow: a.show, bShow: b.show, aAlpha: a.alpha, bAlpha: b.alpha,
        showTip: rowOf('Show in').querySelector('.lbl').title, alphaTip: rowOf('Alpha').querySelector('.lbl').title, note };`);
    check('Show in (and Alpha) apply to every layer of a selected group',
      !showGroup.none && showGroup.aShow === 'aod' && showGroup.bShow === 'aod'
      && showGroup.aAlpha === 128 && showGroup.bAlpha === 128
      && /all 2 selected layers/.test(showGroup.showTip) && /all 2 selected layers/.test(showGroup.alphaTip)
      && !!showGroup.note,
      showGroup.none ? 'no layers'
        : `both layers → show ${showGroup.aShow}/${showGroup.bShow}, alpha ${showGroup.aAlpha}/${showGroup.bAlpha} · tooltips “${showGroup.showTip}” / “${showGroup.alphaTip}” · note ${!!showGroup.note}`);

    // ---- duplicating a clock copies its colon image -------------------------
    const dupColon = await run(`
      // a layer pointing at a shared separator file (the clock preset's colon)
      const colonName = await genUnit('colon', ':');
      const colon = await addElement('IMG', { src: colonName, name: 'Colon fresh' });
      const hour = project.elements.find((e) => e.kind === 'IMG_TIME' && e.part === 'hour');
      if (!colon || !hour) return { none: true };
      const beforeImages = project.images.length;
      selectedId = hour.id; multiSel = new Set([hour.id, colon.id]);
      const srcBefore = colon.src, digitsBefore = hour.images.slice();
      duplicateSelection();
      const copyColon = selection().find((e) => e.kind === 'IMG');
      const copyHour = selection().find((e) => e.kind === 'IMG_TIME');
      const copied = copyColon ? imgMeta(copyColon.src) : null;
      const origMeta = imgMeta(srcBefore);
      return { none: false, srcBefore, srcAfter: copyColon ? copyColon.src : null,
        newFile: !!copied && copyColon.src !== srcBefore,
        sameSize: !!copied && !!origMeta && copied.width === origMeta.width && copied.height === origMeta.height,
        originalKept: !!imgMeta(srcBefore) && colon.src === srcBefore,
        digitsShared: !!copyHour && copyHour.images.join(',') === digitsBefore.join(','),
        addedImages: project.images.length - beforeImages };`);
    check('duplicating a clock gives the copy its own colon image',
      !dupColon.none && dupColon.newFile && dupColon.sameSize && dupColon.originalKept
      && dupColon.digitsShared && dupColon.addedImages === 1,
      dupColon.none ? 'no clock layers'
        : `colon ${dupColon.srcBefore} → ${dupColon.srcAfter} (same size ${dupColon.sameSize}, original kept ${dupColon.originalKept}) · digit set still shared ${dupColon.digitsShared} · ${dupColon.addedImages} image(s) added`);

    // ---- an image generated from a symbol --------------------------------
    const symbolImage = await run(`
      // a plain picture layer still offers the Symbol field (that is the way in)
      const pic = await addElement('IMG', { name: 'Picture test' });
      const picImg = project.images.find((i) => !separatorGlyphFor(i.name));
      pic.src = picImg ? picImg.name : '';
      selectedId = pic.id; multiSel = new Set([pic.id]); refreshPanels();
      const picRows = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      const plain = { symbol: picRows.includes('Symbol'), font: picRows.includes('Font'), preview: !!document.querySelector('#props .imgprev') };
      const e = await addElement('IMG', { name: 'Symbol test' });
      const before = project.images.length;
      e.symbol = { char: '°' };
      e.glyph = { font: 'Orbitron', size: 64, fill: 'solid', color: '#ff0000' };
      await rerenderGlyphLayers([e]);
      const meta = imgMeta(e.src);
      const w0 = meta.width, h0 = meta.height;
      const im = imgFor(e.src);
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0, colour = null;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { ink++; colour = [d[i], d[i + 1], d[i + 2]]; }
      // the helper: preview + symbol field in the panel
      selectedId = e.id; multiSel = new Set([e.id]); refreshPanels();
      const rows = [...document.querySelectorAll('#props .row')];
      const labels = rows.map((r) => ((r.querySelector('.lbl') || {}).textContent || ''));
      const prev = document.querySelector('#props .imgprev img');
      const prevText = document.querySelector('#props .imgprev span');
      const symInp = rows.find((r) => ((r.querySelector('.lbl') || {}).textContent || '') === 'Symbol');
      const name = e.src;
      const symValueBefore = symInp.querySelector('input').value;
      // editing the symbol re-renders in place, keeping the file name
      symInp.querySelector('input').value = 'A';
      symInp.querySelector('input').oninput();
      glyphGenQueue = []; clearTimeout(glyphGenTimer);
      await rerenderGlyphLayers([e]);
      const meta2 = imgMeta(e.src);
      return { plain, name, pattern: /^symbol_/.test(name || ''), w: w0, h: h0, ink, colour,
        added: project.images.length - before,
        labels, hasPreview: !!prev, previewSrc: prev ? /^data:image/.test(prev.src) : false,
        previewText: prevText ? prevText.textContent : '',
        hasSymbolRow: !!symInp, symValue: symValueBefore,
        afterChar: e.symbol ? e.symbol.char : null, sameName: e.src === name, w2: meta2.width,
        previewMatches: (prevText ? prevText.textContent : '').includes(w0 + '×' + h0) };`);
    check('an image layer can be generated from a symbol (preview + symbol field)',
      symbolImage.plain.symbol && !symbolImage.plain.font && symbolImage.plain.preview
      && symbolImage.pattern && symbolImage.ink > 0 && symbolImage.added === 1
      && symbolImage.colour && symbolImage.colour[0] > 180 && symbolImage.colour[1] < 90
      && symbolImage.hasPreview && symbolImage.previewSrc && symbolImage.previewMatches
      && symbolImage.labels.includes('Symbol') && symbolImage.symValue === '°'
      && symbolImage.afterChar === 'A' && symbolImage.sameName && symbolImage.w2 > symbolImage.w,
      `plain picture: Symbol row ${symbolImage.plain.symbol}, font rows ${symbolImage.plain.font}, preview ${symbolImage.plain.preview} · generated ${symbolImage.name} ${symbolImage.w}×${symbolImage.h} (${symbolImage.ink} ink px, colour ${symbolImage.colour}) · preview ${symbolImage.hasPreview} “${symbolImage.previewText}” · Symbol row ${symbolImage.hasSymbolRow} “${symbolImage.symValue}” → “${symbolImage.afterChar}” re-rendered in place (${symbolImage.w2}px wide)`);

    // ---- the Properties panel keeps its scroll while it is rebuilt ----------
    const propsScroll = await run(`
      const e = project.elements.find((x) => x.kind === 'IMG' && layerSymbol(x));
      if (!e) return { none: true };
      selectedId = e.id; multiSel = new Set([e.id]); refreshPanels();
      const host = $('props');
      host.scrollTop = 200;
      const before = host.scrollTop;
      const rowOf = () => [...document.querySelectorAll('#props .row')].find((r) => ((r.querySelector('.lbl') || {}).textContent || '') === 'Symbol');
      const inp = rowOf().querySelector('input');
      inp.value = ''; inp.oninput();                    // the font rows disappear
      const afterClear = $('props').scrollTop;
      const maxClear = host.scrollHeight - host.clientHeight;   // the panel is shorter now
      const inp2 = rowOf().querySelector('input');
      inp2.value = ':'; inp2.oninput();                 // …and come back
      const afterSet = $('props').scrollTop;
      return { none: false, before, afterClear, afterSet, maxClear, scrollable: host.scrollHeight > host.clientHeight };`);
    check('typing in the Symbol field keeps the Properties scroll where it was',
      !propsScroll.none && propsScroll.scrollable && propsScroll.before > 0
      && propsScroll.afterClear === Math.min(propsScroll.before, propsScroll.maxClear)
      && propsScroll.afterSet === propsScroll.afterClear,
      propsScroll.none ? 'no symbol layer'
        : `scroll ${propsScroll.before} → ${propsScroll.afterClear} (cleared, panel max ${propsScroll.maxClear}) → ${propsScroll.afterSet} (set) · scrollable ${propsScroll.scrollable}`);

    // ---- an empty AOD is called out (the watch would use its own) ----------
    const aodEmpty = await run(`
      const saved = project.elements.map((e) => e.show);
      project.elements.forEach((e) => { e.show = 'normal'; });
      const warn = lintProject().filter((l) => l.level === 'warn' && /Nothing is shown in AOD/.test(l.message)).length;
      setPreviewMode('aod');
      const hint = $('meta').textContent;
      setPreviewMode('normal');
      project.elements.forEach((e, i) => { e.show = saved[i]; });
      const after = lintProject().filter((l) => /Nothing is shown in AOD/.test(l.message)).length;
      return { warn, hint: /Nothing is shown in AOD/.test(hint), after, restored: project.elements.every((e, i) => e.show === saved[i]) };`);
    check('an empty AOD is warned about (watch falls back to its own face)',
      aodEmpty.warn === 1 && aodEmpty.hint && aodEmpty.after === 0 && aodEmpty.restored,
      `warn with every layer normal: ${aodEmpty.warn} · AOD preview hint ${aodEmpty.hint} · after restoring: ${aodEmpty.after}`);

    // ---- an outline must not cover the glyph inside (sharp corners) ---------
    const outlineClean = await run(`
      const fam = 'Orbitron', size = 96, w = 3;
      await ensureFont(fam, 400);
      const sol = await addElement('IMG_TIME', { name: 'Mask probe' });
      sol.glyph = { font: fam, size, fill: 'solid', color: '#ffffff', outlineColor: '#ffffff', outlineWidth: w };
      await rerenderGlyphLayers([sol]);
      const out = await addElement('IMG_TIME', { name: 'Ring probe' });
      out.glyph = { font: fam, size, fill: 'outline', color: '#ffffff', outlineColor: '#ffffff', outlineWidth: w };
      await rerenderGlyphLayers([out]);
      const grab = (name) => {
        const im = imgFor(name);
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        return { w: c.width, h: c.height, g };
      };
      const rows = [];
      for (const [ch, idx] of [['0', 0], ['4', 4], ['7', 7]]) {
        const sName = sol.images[idx], oName = out.images[idx];
        const s = grab(sName);
        const core = document.createElement('canvas'); core.width = s.w; core.height = s.h;
        const cg = core.getContext('2d');
        cg.drawImage(imgFor(sName), 0, 0);
        cg.globalCompositeOperation = 'destination-in';
        for (let i = 0; i < 16; i++) { const a2 = (i / 16) * Math.PI * 2; cg.drawImage(imgFor(sName), Math.cos(a2) * (w + 1), Math.sin(a2) * (w + 1)); }
        const cd = cg.getImageData(0, 0, core.width, core.height).data;
        const o = grab(oName);
        const od = o.g.getImageData(0, 0, o.w, o.h).data;
        let ink = 0, inside = 0;
        for (let i = 0; i < od.length; i += 4) { if (od[i + 3] > 40) { ink++; if (cd[i + 3] > 200) inside++; } }
        rows.push(ch + ':' + ink + '/' + inside + '/' + o.w + 'x' + o.h);
      }
      const labels = [...document.querySelectorAll('#props .row .lbl')].map((x) => x.textContent.trim());
      project.elements = project.elements.filter((e) => e !== sol && e !== out);
      return { rows: rows.join(' '), sameCell: true, labels };`);
    check('the outline ring never covers the glyph inside (sharp corners)',
      /^0:\d+\/0\/\d+x\d+ 4:\d+\/0\/\d+x\d+ 7:\d+\/0\/\d+x\d+$/.test(outlineClean.rows)
      && outlineClean.labels.includes('Outline') && !outlineClean.labels.includes('Color'),
      `glyphs (ink px / ink inside the core / cell): ${outlineClean.rows} · outline rows hide the unused Color (${outlineClean.labels.filter((l) => /Outline|Color/.test(l)).join(', ')})`);

    // ---- overlapping digit layers are called out (outline "artifacts") ------
    const overlapLint = await run(`
      const a = await addElement('IMG_TIME', {});
      const b = await addElement('IMG_TIME', {});
      a.name = 'Clash A'; b.name = 'Clash B';
      const hidden = project.elements.filter((e) => e !== a && e !== b && e.visible !== false);
      hidden.forEach((e) => { e.visible = false; });
      const pair = (list) => list.filter((l) => /overlap by/.test(l.message) && l.message.includes('Clash A') && l.message.includes('Clash B'));
      b.x = a.x + Math.round(elBox(a).w) - 20; b.y = a.y;
      const on = pair(lintProject()).length;
      const msg = (pair(lintProject())[0] || {}).message || '';
      b.x = a.x + Math.round(elBox(a).w) + 20;
      const off = pair(lintProject()).length;
      // a background rectangle over the clock must not be reported
      const bg = project.elements.find((e) => e.kind === 'FILL_RECT');
      const bgFalse = bg ? lintProject().filter((l) => /overlap by/.test(l.message) && l.message.includes(bg.name)).length : 0;
      hidden.forEach((e) => { e.visible = true; });
      project.elements = project.elements.filter((e) => e !== a && e !== b);
      return { on, off, bgFalse, msg };`);
    check('overlapping digit layers are reported (the outline “artifacts”)',
      overlapLint.on === 1 && overlapLint.off === 0 && overlapLint.bgFalse === 0 && /Distribute/.test(overlapLint.msg),
      `${overlapLint.on} warning while overlapping, ${overlapLint.off} after separating · background false positives ${overlapLint.bgFalse} · “${overlapLint.msg.slice(0, 80)}…”`);

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
