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
  const run = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`, true)
    .catch((err) => {   // a failed injection is otherwise just "Script failed to execute"
      console.error(`[run failed] ${String(err && err.message).slice(0, 90)} :: ${code.trim().split('\n')[0].slice(0, 110)}`);
      throw err;
    });
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
      setLiveClock(false);   // checks below compare against the 10:09:36 reference time
      await createProject('Smoke Face', ${JSON.stringify(TARGET)}, 'digital');
      // presets start in Normal; the clock opts into AOD through the variant helper
      setShowIn(elements().filter((e) => (e.kind === 'IMG_TIME' && e.part !== 'second') || e.kind === 'IMG'), 'both');
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

    // ---- codegen: shared sensor + quoted names ------------------------------
    const sensorCode = await run(`
      const arc = (id, name, show) => ({ id, kind: 'ARC_PROGRESS', name, dataType: 'STEP', show, visible: true,
        centerX: 100, centerY: 100, radius: 50, startAngle: 0, endAngle: 360, lineWidth: 5, color: '#ff0000' });
      const tmp = { ...project, elements: [arc('elaaaa1', 'Steps', 'both'), arc('elbbbb2', 'Steps 2', 'normal'),
        { id: 'elcccc3', kind: 'IMG', name: 'Quote', src: "it's.png", show: 'normal', visible: true }] };
      const res = await API.generateCode({ project: tmp });
      let parsed = true, err = '';
      try { new Function(res.code.replace(/^import .*$/gm, '')); } catch (e) { parsed = false; err = e.message; }
      return { parsed, err, decls: (res.code.match(/const s_step /g) || []).length };`);
    check('two step arcs (one in both states) share one sensor and the code parses; a quote in an image name is escaped',
      sensorCode.parsed && sensorCode.decls === 1, `parsed ${sensorCode.parsed}${sensorCode.err ? ' (' + sensorCode.err + ')' : ''} · ${sensorCode.decls} sensor declaration(s)`);

    // ---- glyphs: diacritics, separator metrics, per-layer label sets --------
    const glyphLang = await run(`
      // Orbitron's file has Â and Î but no Ă, Ș or Ț: they must come from the
      // font's own glyphs (alternate form or base + accent), never a system font
      const plans = [...'ăâîșțĂÂÎȘȚ'].map((ch) => glyphPlan('Orbitron', ch).how);
      const inter = coverageReport('Inter', 'ăâîșțĂÂÎȘȚ');
      await ensureFont('Orbitron');
      const [a, abreve] = await genGlyphImages([{ tag: 'A', char: 'A', name: 't_A.png' }, { tag: 'Ab', char: 'Ă', name: 't_Ab.png' }],
        { family: 'Orbitron', size: 60, mono: false, replace: true });
      const inkTop = (name) => {
        const im = imgFor(name); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 64) return y;
        return -1;
      };
      // a separator generated for a digit set shares its cell height (same Y = aligned)
      const digits = await ensureDigitNames();
      const style = digitStyleOf(digits);
      const colon = await genUnit('colon', ':', { style });
      // two weekday layers in two languages keep two sets
      const w1 = await addElement('IMG_WEEK', { name: 'Week EN' });
      const w2 = await addElement('IMG_WEEK', { name: 'Week RO', language: 'ro-RO' });
      w2.labelForm = 'long'; w2.images = await genLabelSet(w2, 'week');
      const out = { plans, inter: inter.system.length + inter.composed.length + inter.alternate.length,
        accentAbove: inkTop('t_Ab.png') < inkTop('t_A.png'),
        cov: abreve && genGlyphImages.length >= 0, colonH: imgMeta(colon).height, digitH: imgMeta(digits[0]).height,
        w1: w1.images[0], w2: w2.images[0], w2Untouched: !!imgMeta(w1.images[0]) && w1.images[0] !== w2.images[0] };
      project.images = project.images.filter((i) => !/^t_A/.test(i.name));
      deleteElements([w1, w2]);
      return out;`);
    check('Romanian letters a font lacks are drawn from its own glyphs (composed / alternate), never a system font',
      glyphLang.plans.every((h) => h !== 'system') && glyphLang.plans.includes('composed') && glyphLang.inter === 0
      && glyphLang.accentAbove,
      `Orbitron: ${glyphLang.plans.join(',')} · Inter non-native: ${glyphLang.inter} · Ă ink above A: ${glyphLang.accentAbove}`);
    check('a separator shares the digits\' cell height; two weekday layers keep separate sets',
      glyphLang.colonH === glyphLang.digitH && glyphLang.w2Untouched,
      `colon ${glyphLang.colonH}px vs digits ${glyphLang.digitH}px · ${glyphLang.w1} / ${glyphLang.w2}`);

    const picker = await run(`
      const e = await addElement('IMG', { name: 'Picker test' });
      selectedId = e.id; multiSel = new Set([e.id]); refreshPanels();
      document.querySelector('#props .imgfield .if-pick').click();
      const cells = document.querySelectorAll('.imgpicker .ip-cell');
      const thumbs = document.querySelectorAll('.imgpicker .ip-cell img').length;
      const target = [...cells].find((c) => c.dataset.name);
      const name = target.dataset.name;
      target.click();
      const out = { cells: cells.length, thumbs, picked: e.src === name, closed: !document.querySelector('.imgpicker') };
      deleteElements([e]);
      return out;`);
    check('the image picker shows project images with previews and sets the layer\'s image',
      picker.cells > 1 && picker.thumbs > 0 && picker.picked && picker.closed, JSON.stringify(picker));

    // ---- layer order: below a group, groups as units -------------------------
    const order = await run(`
      const before = project.elements.slice();
      const a = await addElement('FILL_RECT', { name: 'Ord A' });
      const b = await addElement('FILL_RECT', { name: 'Ord B' });
      const g1 = await addElement('FILL_RECT', { name: 'Ord G1' });
      const g2 = await addElement('FILL_RECT', { name: 'Ord G2' });
      selectedId = g1.id; multiSel = new Set([g1.id, g2.id]); groupSelection();
      const bg = await addElement('IMG', { name: 'Ord BG' });
      // 1. Send to back puts a layer under everything, groups included
      selectedId = bg.id; multiSel = new Set([bg.id]); reorderSelection('back');
      const backFirst = project.elements[0] === bg;
      // 2. a drag in the panel: move the row to the very bottom of the list
      reorderSelection('front');
      const list = document.querySelector('#layers .layers-list');
      list.appendChild(list.querySelector('.layer[data-id="' + bg.id + '"]'));
      applyLayerOrder();
      const dragFirst = project.elements[0] === bg;
      // 3. a group moves as one unit and its members stay together
      selectedId = g1.id; multiSel = new Set([g1.id, g2.id]); reorderSelection('back');
      const ids = project.elements.map((e) => e.id);
      const groupBack = ids.indexOf(g1.id) <= 1 && ids.indexOf(g2.id) <= 1;
      const groupDraggable = !!document.querySelector('#layers .group-block .group-row .grip');
      const count = project.elements.length;
      project.elements = before; project.groups = Object.fromEntries(Object.entries(project.groups).filter(([k]) => before.some((e) => e.group === k)));
      selectedId = null; multiSel = new Set(); refreshPanels(); render();
      return { backFirst, dragFirst, groupBack, groupDraggable, count, expected: before.length + 5 };`);
    check('a layer goes below a group (Send to back and drag), a group moves as one unit',
      order.backFirst && order.dragFirst && order.groupBack && order.groupDraggable && order.count === order.expected, JSON.stringify(order));

    // ---- number fields: wheel, arrows, scrub; device field; preview time ----
    const numInput = await run(`
      const e = await addElement('FILL_RECT', { name: 'Num test', x: 100, y: 100, w: 50, h: 50 });
      selectedId = e.id; multiSel = new Set([e.id]); refreshPanels();
      const x0 = e.x, y0 = e.y;
      const xin = [...document.querySelectorAll('#props .pf')].find((f) => f.querySelector('.pfx').textContent === 'X').querySelector('input');
      xin.focus();
      xin.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
      const afterWheel = e.x;
      xin.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, cancelable: true }));
      const afterArrow = e.x;
      const steps0 = past.length;
      const pfx = [...document.querySelectorAll('#props .pfx')].find((p) => p.textContent === 'Y');
      const r = pfx.getBoundingClientRect();
      const at = (x) => ({ clientX: x, clientY: r.top + 4, bubbles: true, button: 0, pointerId: 1 });
      pfx.dispatchEvent(new PointerEvent('pointerdown', at(r.left)));
      window.dispatchEvent(new PointerEvent('pointermove', at(r.left + 10)));
      window.dispatchEvent(new PointerEvent('pointermove', at(r.left + 25)));
      window.dispatchEvent(new PointerEvent('pointerup', at(r.left + 25)));
      const out = { afterWheel: afterWheel - x0, afterArrow: afterArrow - x0, afterScrub: e.y - y0, scrubSteps: past.length - steps0,
        deviceField: $('projDevice').tagName, deviceText: $('projDeviceName').textContent };
      // the saved preview reads 10:09:36 even with the live clock on
      clock = { h: 3, m: 41, s: 7 };
      const a = composePreviewB64(); clock = { ...REF_CLOCK }; const b = composePreviewB64();
      out.previewAtRef = a === b;
      deleteElements([e]);
      return out;`);
    check('number fields: wheel and Shift+arrow step a focused field, dragging a label scrubs (one undo step); device is a field; preview at 10:09:36',
      numInput.afterWheel === 1 && numInput.afterArrow === 11 && numInput.afterScrub === 25 && numInput.scrubSteps === 1
      && numInput.deviceField === 'BUTTON' && /\S/.test(numInput.deviceText) && numInput.previewAtRef,
      JSON.stringify(numInput));

    // ---- IMG_POINTER: x/y is the pivot inside the image ---------------------
    const pointer = await run(`
      const img = project.images[0];
      const e = await addElement('IMG_POINTER', { src: img.name, x: 3, y: 5 });
      const b0 = elBox(e);
      moveEl(e, 10, 20);
      const out = { boxAtPivot: b0.x === e.centerX - 10 - 3 && b0.y === e.centerY - 20 - 5,
        moved: { cx: e.centerX, cy: e.centerY, x: e.x, y: e.y }, w: b0.w === img.width && b0.h === img.height };
      deleteElements([e]);
      return out;`);
    check('an image pointer pivots on its own x/y at the screen centre (and moves by its centre)',
      pointer.boxAtPivot && pointer.w && pointer.moved.x === 3 && pointer.moved.y === 5, JSON.stringify(pointer));

    // ---- undo: no-op clicks, device, focus ----------------------------------
    const undoFix = await run(`
      pushHistory();
      const steps0 = past.length;
      const cv = $('cv'); const r = cv.getBoundingClientRect(); const s = r.width / cv.width;
      const t = project.elements.find((x) => !x.locked && x.visible !== false && x.kind !== 'TIME_POINTER');
      const b = elBox(t);
      const at = { clientX: r.left + (b.x + b.w / 2) * s, clientY: r.top + (b.y + b.h / 2) * s, bubbles: true };
      cv.dispatchEvent(new MouseEvent('mousedown', at));
      window.dispatchEvent(new MouseEvent('mouseup', at));
      const clickSteps = past.length - steps0;
      const dev0 = project.device;
      const other = DEVICES.find((d) => d.target !== dev0 && d.w !== dev().w);
      convertProject(other.target, project.name);
      const converted = project.device;
      undo();
      const back = project.device;
      selectedId = t.id; multiSel = new Set([t.id]); refreshPanels();
      const name = [...document.querySelectorAll('#props input[data-keep-focus="text:name"]')][0];
      name.focus(); name.value = t.name + 'x'; name.dispatchEvent(new Event('input'));
      const focusKept = document.activeElement && document.activeElement.dataset.keepFocus === 'text:name';
      undo();
      return { clickSteps, dev0, converted, back, focusKept };`);
    check('a click that moves nothing adds no undo step; undoing Change device restores the device; typing a name keeps focus',
      undoFix.clickSteps === 0 && undoFix.converted !== undoFix.dev0 && undoFix.back === undoFix.dev0 && undoFix.focusKept,
      JSON.stringify(undoFix));

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
    const aodProj = { name: 'AOD probe', elements: [{ id: 'a1', kind: 'IMG', show: 'both', src: 'probe.png' }, { id: 'a2', kind: 'TEXT', show: 'normal' }] };
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
    const whenProj = { name: 'When probe', elements: [
      { id: 'w1x1', name: 'AM lit', kind: 'IMG', show: 'normal', showWhen: 'am', src: 'am.png', x: 1, y: 2 },
      { id: 'w2x2', name: 'PM lit', kind: 'IMG', show: 'normal', showWhen: 'pm', src: 'pm.png', x: 1, y: 30 }] };
    const whenJs = codegenMod.generateWatchface(whenProj, aodDev).code;
    let whenSyntax = true;
    try { new Function(whenJs.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { whenSyntax = false; }
    check('AM / PM layers export a Time-driven VISIBLE switch',
      /import \{ Time \} from '@zos\/sensor'/.test(whenJs) && /const when_0 = ui\.createWidget/.test(whenJs)
      && /when_0\.setProperty\(ui\.prop\.VISIBLE, !pm\)/.test(whenJs) && /when_1\.setProperty\(ui\.prop\.VISIBLE, pm\)/.test(whenJs)
      && /clockNow\.onPerMinute\(updateWhen\)/.test(whenJs) && whenSyntax, 'Time import, two handles, hour switch, valid syntax');
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

      // ---- IMG_ANIM: the widget addresses frames by name, not by file name ----
      // <anim_path>/<prefix>_<i>.png is what the watch resolves, so the frames
      // must be written under exactly those names whatever the designer calls them.
      const animPng = (r, g, b) => {
        const p = new (require('pngjs').PNG)({ width: 2, height: 2 });
        for (let i = 0; i < 4; i++) { p.data[i * 4] = r; p.data[i * 4 + 1] = g; p.data[i * 4 + 2] = b; p.data[i * 4 + 3] = 255; }
        return require('pngjs').PNG.sync.write(p).toString('base64');
      };
      const animProj = {
        name: 'Anim probe', device: TARGET, appId: 2123456, vender: 'watchface-designer',
        elements: [{ id: 'an1', kind: 'IMG_ANIM', name: 'Spectrum', x: 24, y: 207, w: 330, h: 84, fps: 10, frames: ['frame_a.png', 'frame_b.png'] }],
      };
      const animOut = path.join(SCRATCH, 'zeus-anim');
      const animExp = await run(`return API.exportZeus({
        project: ${JSON.stringify(animProj)},
        images: [{ name: 'frame_a.png', dataBase64: '${animPng(255, 0, 0)}' }, { name: 'frame_b.png', dataBase64: '${animPng(0, 0, 255)}' }],
        previewBase64: '', outDir: ${JSON.stringify(animOut)} });`);
      const animJsFile = path.join(animOut, 'watchface', TARGET, 'index.js');
      const animJs = fs.existsSync(animJsFile) ? fs.readFileSync(animJsFile, 'utf8') : '';
      const animFramesDir = path.join(animOut, 'assets', TARGET, 'images', 'anim');
      const animFrames = fs.existsSync(animFramesDir) ? fs.readdirSync(animFramesDir).sort() : [];
      const animFlat = fs.existsSync(path.join(animOut, 'assets', TARGET, 'images', 'frame_a.png'));
      check('IMG_ANIM frames are exported where the widget looks for them (images/anim/<prefix>_<i>.png)',
        !!animExp && animExp.ok !== false
        && /anim_path: 'images\/anim',/.test(animJs)
        && /anim_prefix: 'spectrum',/.test(animJs)
        && /anim_size: 2/.test(animJs)
        && animFrames.join(',') === 'spectrum_0.png,spectrum_1.png'
        && !animFlat,
        animExp && animExp.ok === false ? animExp.error
          : `anim_path ${(animJs.match(/anim_path: '[^']+'/) || ['?'])[0]} · ${animFrames.join(', ') || 'no frames written'}${animFlat ? ' · stale flat copy left behind' : ''}`);
      // …and the designer's own export has to come back the same way (an import
      // of an import), otherwise every export/import round would reshuffle them.
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const animBack = importFaceDir(animOut).project.elements.find((e) => e.kind === 'IMG_ANIM');
      check('an exported animation imports back with the same frames and prefix',
        !!animBack && animBack.animPrefix === 'spectrum' && animBack.frames.length === 2
        && animBack.frames.join(',') === 'anim/spectrum_0.png,anim/spectrum_1.png',
        animBack ? `${animBack.animPrefix} → ${animBack.frames.join(', ')}` : 'no IMG_ANIM came back');
    }

    // ---- importing an existing watchface (Zeus project / Maker export) -----
    // The designer's own export is a real Zeus project, so importing it back is
    // the strongest test we have: the same layers must come back out.
    const roundTrip = await run(`
      const before = project.elements.map(e => e.kind).sort().join(',');
      const appIdBefore = project.appId;
      const res = await API.openProjectPath(${JSON.stringify(zeusDir)});
      if (res.error) return { error: res.error };
      const report = (res.report || []).join('\\n');
      await loadProject(res);
      $('logModal').hidden = true;
      const refs = [];
      for (const e of project.elements) {
        if (e.src) refs.push(e.src);
        for (const k of ['images', 'frames']) for (const n of (e[k] || [])) refs.push(n);
      }
      return {
        before, imported: !!res.imported, source: res.source, report,
        after: project.elements.map(e => e.kind).sort().join(','),
        layers: project.elements.length, images: project.images.length,
        unresolved: refs.filter((n) => n && !project.images.some((i) => i.name === n)),
        savePath: project.savePath, dirty, name: project.name, device: project.device,
        appIdBefore, appIdAfter: project.appId, vender: project.vender,
        reportSaysLayers: /Layers: \\d+ imported/.test(report),
      };`);
    check('import a Zeus project folder', !roundTrip.error && roundTrip.imported && roundTrip.layers > 0,
      roundTrip.error || `${roundTrip.layers} layers, ${roundTrip.images} images from ${roundTrip.source}`);
    {
      const { languageTag } = require(path.join(__dirname, '..', 'core', 'importface'));
      const got = ['enUS', 'zh_CN', 'ro-ro', '', undefined, 'not a tag!'].map(languageTag);
      check('imported language tags are mended to valid locales',
        got.join(',') === 'en-US,zh-CN,ro-RO,en-US,en-US,en-US', got.join(','));
    }
    const monthRun = await run(`
      const m = await addElement('IMG_DATE', { part: 'month', isCharacter: true, x: 10, y: 10 });
      const names = Array.from({ length: 12 }, (_, i) => 'mn_' + i + '.png');
      m.images = names;
      const mk = (w) => { const c = document.createElement('canvas'); c.width = w; c.height = 20; c.getContext('2d').fillRect(0, 0, w, 20); return c; };
      names.forEach((n, i) => addProjectImage(n, mk(30 + i * 3)));
      const keep = { ...dateParts };
      dateParts = { ...dateParts, month: 3 };
      const b = digitBox(m);
      const drawn = monthNameImage(m);
      dateParts = keep;
      return { drawn, w: b.w };`);
    const kmRun = await run(`
      const d = await addElement('TEXT_IMG', { dataType: 'DISTANCE', x: 234, y: 10, alignH: 'RIGHT', hSpace: 2, dot: 'dd_dot.png' });
      const names = Array.from({ length: 10 }, (_, i) => 'dd_' + i + '.png');
      d.images = names;
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').fillRect(0, 0, w, h); return c; };
      names.forEach((n) => addProjectImage(n, mk(22, 20)));
      addProjectImage('dd_dot.png', mk(6, 27));
      const b = digitBox(d);
      return { text: digitTextFor(d), w: b.w };`);
    check('a distance keeps its decimal point and fits a 3-digit + dot box (not 6 digits)',
      kmRun.text === '5.30' && kmRun.w === 78, JSON.stringify(kmRun));
    const thRun = await run(`
      const mkc = (col) => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 8, 8); return c; };
      addProjectImage('th_y.png', mkc('#ffc000'));
      addProjectImage('th_g.png', mkc('#808080'));
      await loadAllImages();
      const el = await addElement('IMG', { x: 0, y: 0, src: 'th_y.png', name: 'ThemeImg' });
      const res = await generateThemes([{ name: 'Sky', color: '#5ab0ff' }, { name: 'Grey', color: '#a6a6a6' }], '#ffc000');
      const px = (n) => { const c = imageToCanvas(n); const d = c.cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const out = {
        res, rec: project.themes && project.themes.recolored, hasCopy: !!imgMeta('th_y__t1.png'), noGreyCopy: !imgMeta('th_g__t1.png'),
        sky: px('th_y__t1.png'), grey: px('th_y__t2.png'), orig: px('th_y.png'),
      };
      themeIdx = 1;
      out.drawn = imgFor('th_y.png') === imgCache.get('th_y__t1.png');
      themeIdx = 0;
      const tapEl = await addElement('TAP', { action: 'theme', x: 0, y: 0, w: 40, h: 40, show: 'normal', name: 'Theme tap' });
      const code = (await API.generateCode({ project })).code;
      project.elements = project.elements.filter((x) => x !== tapEl);
      out.code = code;
      clearThemeImages();
      out.cleared = !project.themes && !imgMeta('th_y__t1.png');
      project.elements = project.elements.filter((x) => x !== el);
      return out;`);
    const lum = (c) => c[0] * 0.3 + c[1] * 0.6 + c[2] * 0.1;
    check('colour themes: the accent moves to each palette colour, greys stay shared, the preview picks the copy',
      !thRun.res.error && thRun.rec.includes('th_y.png') && !thRun.rec.includes('th_g.png') && thRun.hasCopy && thRun.noGreyCopy
      && thRun.sky[2] > thRun.sky[0] + 40 && Math.abs(thRun.grey[0] - thRun.grey[2]) < 20 && thRun.orig[0] > 240 && thRun.drawn && thRun.cleared,
      JSON.stringify({ ...thRun, code: undefined }));
    {
      const code = thRun.code || '';
      let syn = true;
      try { new Function(code.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { syn = false; }
      check('a themed export switches by deleting and rebuilding the widgets (guarded, deferred, persisted)',
        /const THEMED = \{[^}]*"th_y\.png":1/.test(code) && /cycleTheme\(\)/.test(code) && /deleteWidget/.test(code) && /guard = /.test(code)
        && /setTimeout\(rebuild, 0\)/.test(code) && /dialcraft_theme/.test(code) && /__t' \+ themeIdx/.test(code) && syn,
        `syntax ${syn}`);
    }
    const impRun = await run(`
      const mkc = (w, h, col) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(2, 2, w - 4, h - 4); return c; };
      const names = Array.from({ length: 10 }, (_, i) => 'imp' + i + '.png');
      names.forEach((n) => addProjectImage(n, mkc(20, 40, '#ff0000')));
      await loadAllImages();
      const e = await addElement('IMG_TIME', { part: 'hour', x: 5, y: 5 });
      e.images = names; delete e.glyph;
      const before = glyphStyle(e);
      e.glyph = glyphSpecFrom(glyphStyle(e));
      e.glyph.fill = 'solid'; e.glyph.color = '#00ff00'; e.glyph.size = 80;
      const nDone = await rerenderGlyphLayers([e], { quiet: true });
      const dbg = { nDone, imgs: project.images.filter((i) => /imp/.test(i.name)).map((i) => i.name + ':' + i.height).join(','), spec: !!glyphSpecForLayer(e), glyph: JSON.stringify(e.glyph) };
      if (!imgMeta('imp0__src.png')) return { dbg };
      const px = (n) => { const c = imageToCanvas(n); if (!c) return ['missing ' + n, [...imgCache.keys()].filter((k) => /imp/.test(k)).join(',')]; const d = c.cx.getImageData(c.cv.width >> 1, c.cv.height >> 1, 1, 1).data; return [d[0], d[1], d[2], d[3]]; };
      const out = {
        font0: before.font, fill0: before.fill, size0: before.size,
        h: imgMeta('imp0.png').height, w: imgMeta('imp0.png').width, green: px('imp0.png'),
        srcRed: px('imp0__src.png'), srcH: imgMeta('imp0__src.png').height, hidden: HIDDEN_IMG_RE.test('imp0__src.png'),
        palettes: COLOR_PALETTES.length, offered: true,
      };
      e.glyph.fill = 'gradient'; e.glyph.from = '#0000ff'; e.glyph.to = '#ffff00'; e.glyph.angle = 180; e.glyph.size = 40;
      await rerenderGlyphLayers([e], { quiet: true });
      const top = (n) => { const c = imageToCanvas(n); const d = c.cx.getImageData(c.cv.width >> 1, 4, 1, 1).data; const b = c.cx.getImageData(c.cv.width >> 1, c.cv.height - 5, 1, 1).data; return [d[2] > d[0], b[0] > b[2]]; };
      out.grad = top('imp0.png');
      // opaque artwork on black (a Maker picture): the fill is multiplied by the brightness, the ground stays black
      const mko = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffee00'; x.fillRect(8, 8, w - 16, h - 16); return c; };
      addProjectImage('imp0.png', mko(20, 40));
      e.glyph.sourceNames = null;
      await loadAllImages();
      e.glyph.fill = 'solid'; e.glyph.color = '#00ffff'; e.glyph.size = 40;
      await rerenderGlyphLayers([e], { quiet: true });
      const o = imageToCanvas('imp0.png');
      const corner = o.cx.getImageData(1, 1, 1, 1).data, mid = o.cx.getImageData(10, 20, 1, 1).data;
      out.opaque = [corner[0] + corner[1] + corner[2], mid[0], mid[1] > 200 && mid[2] > 200, mid[3]];
      await restoreImportedSet(e);
      out.restored = [imgMeta('imp0.png').height, px('imp0.png')[0], !e.glyph];
      project.elements = project.elements.filter((x) => x !== e);
      return out;`);
    check('Imported Font: the pictures a face came with are scaled and painted over (solid, gradient), kept as hidden sources and restorable; 20 palettes',
      impRun.font0 === 'Imported Font' && impRun.fill0 === 'original' && impRun.size0 === 40 && impRun.h === 80 && impRun.w === 40
      && impRun.green[1] > 240 && impRun.green[0] < 20 && impRun.srcRed[0] > 240 && impRun.srcH === 40 && impRun.hidden && impRun.palettes === 20
      && impRun.grad[0] && impRun.grad[1] && impRun.opaque[0] < 12 && impRun.opaque[1] < 40 && impRun.opaque[2] && impRun.opaque[3] === 255 && impRun.restored[0] === 40 && impRun.restored[2],
      JSON.stringify(impRun));
    const lvRun = await run(`
      const mk = (lit) => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 20, 20); x.fillStyle = '#4a4400'; x.fillRect(0, 0, 10, 20); if (lit) { x.fillStyle = '#ffee00'; x.fillRect(10, 0, 10, 20); } return c; };
      const names = ['lvl0.png', 'lvl1.png', 'lvl2.png'];
      names.forEach((n, i) => addProjectImage(n, mk(i > 0)));
      await loadAllImages();
      const e = await addElement('IMG_LEVEL', { x: 0, y: 0 });
      e.images = names; e.dataType = 'BATTERY';
      const T = isTintLayer(e);
      e.tint = tintStyle(e); e.tint.fill = 'solid'; e.tint.color = '#00ffff';
      await rerenderGlyphLayers([e], { quiet: true });
      const at = (n, x) => { const c = imageToCanvas(n); const d = c.cx.getImageData(x, 10, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lit = at('lvl1.png', 15), dim = at('lvl1.png', 4);
      const out = { T, lit, dim, src: !!imgMeta('lvl1__src.png') };
      await restoreTint(e);
      out.restored = at('lvl1.png', 15)[0];
      // an icon: one picture on an IMG layer
      addProjectImage('ico.png', mk(true));
      await loadAllImages();
      const ic = await addElement('IMG', { x: 0, y: 0, src: 'ico.png', name: 'Icon' });
      out.iconT = isTintLayer(ic) && isThemeTint(ic);
      ic.tint = tintStyle(ic); ic.tint.fill = 'solid'; ic.tint.color = '#ff00ff';
      await rerenderGlyphLayers([ic], { quiet: true });
      out.icon = at('ico.png', 15);
      await restoreTint(ic);
      out.iconBack = at('ico.png', 15)[1];
      project.elements = project.elements.filter((x) => x !== ic);
      project.elements = project.elements.filter((x) => x !== e);
      return out;`);
    check('a level set is painted over: the lit part takes the colour, the dim track stays dim, originals come back',
      lvRun.T && lvRun.lit[0] < 10 && lvRun.lit[1] > 240 && lvRun.lit[2] > 240 && lvRun.dim[1] > 20 && lvRun.dim[1] < 130 && lvRun.dim[0] < 10 && lvRun.src && lvRun.restored > 240 && lvRun.iconT && lvRun.icon[0] > 240 && lvRun.icon[1] < 10 && lvRun.icon[2] > 240 && lvRun.iconBack > 200,
      JSON.stringify(lvRun));
    check('a month shown as a name draws that month\'s picture at its own width',
      monthRun.drawn === 'mn_2.png' && monthRun.w === 36, JSON.stringify(monthRun));
    {
      const { PNG } = require('pngjs');
      const { appIconPng } = require(path.join(__dirname, '..', 'core', 'icon'));
      const face = new PNG({ width: 390, height: 450 });
      for (let i = 0; i < face.data.length; i += 4) { face.data[i] = 200; face.data[i + 1] = 40; face.data[i + 2] = 40; face.data[i + 3] = 255; }
      const faceBuf = PNG.sync.write(face);
      const sq = PNG.sync.read(appIconPng(faceBuf, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey('bip-6')));
      const rd = PNG.sync.read(appIconPng(faceBuf, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey('balance-3')));
      const px = (img, x, y) => img.data[(img.width * y + x) * 4 + 3];
      check('a square watch gets the whole face as its preview, a round one the 248 circle',
        sq.width === 266 && sq.height === 307 && px(sq, 0, 0) === 0 && px(sq, 133, 4) === 255 && px(sq, 4, 153) === 255 && px(sq, 133, 153) === 255
        && rd.width === 248 && px(rd, 124, 124) === 255 && px(rd, 4, 4) === 0,
        `square ${sq.width}×${sq.height} (corner α ${px(sq, 0, 0)}, edge α ${px(sq, 4, 153)}) · round ${rd.width}×${rd.height} (corner α ${px(rd, 4, 4)})`);
    }
    // …the same face handed over as a .zip (flat, and wrapped in one folder)
    {
      const zipMod = require(path.join(__dirname, '..', 'core', 'zip'));
      const entries = zipMod.zipDirectory(zeusDir);
      const flat = path.join(SCRATCH, 'face-flat.zip');
      const wrapped = path.join(SCRATCH, 'face-wrapped.zip');
      const evil = path.join(SCRATCH, 'face-evil.zip');
      fs.writeFileSync(flat, zipMod.createZip(entries));
      fs.writeFileSync(wrapped, zipMod.createZip(entries.map((e) => ({ ...e, name: 'my face/' + e.name }))));
      fs.writeFileSync(evil, zipMod.createZip([...entries, { name: '../escaped.txt', data: Buffer.from('x') }]));
      const zipRes = await run(`
        const out = {};
        for (const [k, f] of [['flat', ${JSON.stringify(flat)}], ['wrapped', ${JSON.stringify(wrapped)}], ['evil', ${JSON.stringify(evil)}]]) {
          const r = await API.openProjectPath(f);
          out[k] = r.error ? { error: r.error } : { layers: r.project.elements.length, images: r.images.length, source: r.source, base: r.base };
        }
        return out;`);
      check('a watchface .zip imports (flat or wrapped in a folder) and shows as the source',
        zipRes.flat.layers === roundTrip.layers && zipRes.wrapped.layers === roundTrip.layers
        && zipRes.flat.images === roundTrip.images && zipRes.flat.source === flat && zipRes.flat.base === 'face-flat',
        JSON.stringify(zipRes.flat) + ' / ' + JSON.stringify(zipRes.wrapped));
      check('a .zip with a path escaping its folder is refused',
        !!zipRes.evil.error && /unsafe path/.test(zipRes.evil.error) && !fs.existsSync(path.join(SCRATCH, 'escaped.txt')) && !fs.existsSync(path.join(path.dirname(os.tmpdir()), 'escaped.txt')),
        zipRes.evil.error || 'it imported');
    }
    // A Text layer that needed baking (gradient/bold) exports as an IMG, so the
    // round trip is compared with TEXT counted as IMG.
    check('the imported layers match the exported ones (round trip)',
      !roundTrip.error && roundTrip.after === roundTrip.before.replace(/\bTEXT\b/g, 'IMG').split(',').sort().join(',')
      && roundTrip.reportSaysLayers,
      roundTrip.error || `before ${roundTrip.before}\n    after  ${roundTrip.after}`);
    check('every image an imported layer points at came along',
      !roundTrip.error && roundTrip.unresolved.length === 0,
      roundTrip.error || (roundTrip.unresolved.length ? roundTrip.unresolved.join(', ') : 'no dangling references'));
    check('an import is unsaved, so Save asks where to put the designer project',
      roundTrip.savePath === null && roundTrip.dirty === true,
      `savePath ${JSON.stringify(roundTrip.savePath)}, dirty ${roundTrip.dirty}`);
    check('importing this designer\'s own export keeps the app id',
      !roundTrip.error && roundTrip.appIdAfter === roundTrip.appIdBefore && roundTrip.appIdAfter >= 1,
      `${roundTrip.vender} → appId ${roundTrip.appIdBefore} ⇒ ${roundTrip.appIdAfter}`);

    // A hand-written v2 project in the shape the watch actually runs: global
    // hmUI, a Maker-style runtime, a widget call inside build(), a compressed
    // image, a normal+AOD pair and two widgets the designer cannot author.
    const v2Dir = path.join(SCRATCH, 'imported-v2');
    fs.mkdirSync(path.join(v2Dir, 'watchface'), { recursive: true });
    fs.mkdirSync(path.join(v2Dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(v2Dir, 'app.json'), JSON.stringify({
      configVersion: 'v2',
      app: { appId: 4242, appName: 'Imported V2', appType: 'watchface', vender: 'tester', version: { code: 1, name: '1.0.0' } },
      module: { watchface: { path: 'watchface/index', main: 1, lockscreen: 1 } },
      platforms: [{ name: 'Amazfit Bip 6', deviceSource: 9765120 }],
      designWidth: 390,
    }, null, 2));
    // a 4×4 image in Zepp's compressed container: 64-byte header, 256 RGBA
    // palette entries, one index byte per pixel
    const somh = Buffer.alloc(1088 + 16);
    somh[0] = 0x2e; somh[1] = 0x01; somh[2] = 0x01;
    somh.writeUInt16LE(4, 12); somh.writeUInt16LE(4, 14);
    Buffer.from('SOMH').copy(somh, 18);
    // index 0 fully transparent, index 1 amber #ff8c00 — the byte order in the
    // palette is what this check pins down
    [0, 0, 0, 0, 0xff, 0x8c, 0x00, 0xff].forEach((v, i) => { somh[64 + i] = v; });
    for (let i = 0; i < 16; i++) somh[1088 + i] = i % 2;
    fs.mkdirSync(path.join(v2Dir, 'assets', 'img'), { recursive: true });
    fs.writeFileSync(path.join(v2Dir, 'assets', 'img', 'dot.png'), somh);
    // a plain PNG next to it, generated here so the check does not depend on the
    // export above succeeding
    const plainPng = new (require('pngjs').PNG)({ width: 2, height: 2 });
    for (let i = 0; i < 4; i++) { plainPng.data[i * 4] = 20; plainPng.data[i * 4 + 1] = 200; plainPng.data[i * 4 + 2] = 20; plainPng.data[i * 4 + 3] = 255; }
    fs.writeFileSync(path.join(v2Dir, 'assets', 'plain.png'), require('pngjs').PNG.sync.write(plainPng));
    // a numbered set a widget picks from at runtime, plus the three files the
    // reference can only be understood through
    for (let i = 0; i < 3; i++) {
      fs.writeFileSync(path.join(v2Dir, 'assets', `lvl_${i}.png`), require('pngjs').PNG.sync.write(plainPng));
    }
    fs.writeFileSync(path.join(v2Dir, 'watchface', 'index.js'), `
      const h = new DeviceRuntimeCore.WidgetFactory(new DeviceRuntimeCore.HmDomApi());
      const logger = DeviceRuntimeCore.HmLogger.getLogger('probe');
      DeviceRuntimeCore.WatchFace({
        build() {
          logger.log('build');
          hmUI.createWidget(hmUI.widget.IMG, { x: 1, y: 2, src: 'img/dot.png' });
          hmUI.createWidget(hmUI.widget.IMG, { x: 1, y: 2, src: 'plain.png', show_level: hmUI.show_level.ONLY_NORMAL });
          hmUI.createWidget(hmUI.widget.IMG, { x: 1, y: 2, src: 'plain.png', show_level: hmUI.show_level.ONLY_AOD });
          // the index comes from a reading the sandbox cannot know
          const step = hmSensor.createSensor(hmSensor.id.STEP);
          hmUI.createWidget(hmUI.widget.IMG, { x: 40, y: 50, src: 'lvl_' + Math.floor(step.getCurrent() / 10) + '.png' });
          hmUI.createWidget(hmUI.widget.IMG_TIME, {
            hour_startX: 10, hour_startY: 20, hour_array: ['plain.png'],
            hour_zero: 1, hour_space: 3, hour_align: hmUI.align.CENTER_H,
            show_level: hmUI.show_level.ONLY_AOD,
          });
          // not a layer: the watchface lifecycle hook
          hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, { resume_call: function () {} });
          hmUI.createWidget(hmUI.widget.SLIDE_SWITCH, { x: 0, y: 0, w: 10, h: 10 });
          hmUI.createWidget(hmUI.widget.SCROLL_TEXT, { x: 0, y: 0 });
        },
      });
    `);
    const v2 = await run(`
      const res = await API.openProjectPath(${JSON.stringify(v2Dir)});
      if (res.error) return { error: res.error };
      const report = (res.report || []).join('\\n');
      const unresolved = (report.match(/could not be resolved:([\\s\\S]*?)(\\n\\n|$)/) || ['', ''])[1];
      await loadProject(res);
      $('logModal').hidden = true;
      const byKind = {};
      for (const e of project.elements) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
      const hour = project.elements.find((e) => e.kind === 'IMG_TIME');
      const lvl = project.elements.find((e) => e.kind === 'IMG_LEVEL');
      const both = project.elements.filter((e) => e.show === 'both').length;
      const dot = project.images.find((i) => i.name === 'dot.png');
      return {
        report, byKind, layers: project.elements.length, both, unresolved,
        name: project.name, device: project.device, appId: project.appId,
        lvl: lvl ? { x: lvl.x, y: lvl.y, w: lvl.w, h: lvl.h, type: lvl.dataType, images: lvl.images } : null,
        hour: hour ? { part: hour.part, x: hour.x, y: hour.y, zero: hour.zero, space: hour.space, alignH: hour.alignH, show: hour.show, images: hour.images } : null,
        dot: dot ? { width: dot.width, url: dot.url.slice(0, 30) } : null,
        plain: !!project.images.find((i) => i.name === 'plain.png'),
      };`);
    check('import a hand-written v2 (hmUI) project', !v2.error && v2.layers === 4,
      v2.error || `${v2.layers} layers ${JSON.stringify(v2.byKind)}`);
    check('the v2 import keeps the container and the device, but not a foreign app id',
      !v2.error && v2.name === 'Imported V2' && v2.device === 'bip-6'
      && v2.appId >= 2000000 && v2.appId <= 2999999 && /App id: 4242 → \d+/.test(v2.report),
      `${v2.name} · ${v2.device} · appId ${v2.appId} (reported: ${/App id: \d+ → \d+/.test(v2.report)})`);
    // dot.png has no show_level (shown in both states on the watch) and the
    // plain.png pair is one physical widget per state
    check('a normal+AOD pair comes back as one layer, shown in both states',
      !v2.error && v2.both === 3 && v2.byKind.IMG === 2, `both=${v2.both}, IMG=${v2.byKind.IMG}`);
    // the picture is chosen from a step reading: the index never survives the
    // sandbox, so the widget comes back as a level over the whole numbered set
    check('a picture picked from a reading becomes a level over its whole set',
      !v2.error && v2.lvl && v2.lvl.type === 'STEP' && v2.lvl.images.join(',') === 'lvl_0.png,lvl_1.png,lvl_2.png'
      && v2.lvl.w === 2 && v2.lvl.h === 2 && !/lvl_NaN/.test(v2.unresolved),
      v2.lvl ? `${v2.lvl.type} over ${v2.lvl.images.join(', ')} at ${v2.lvl.w}×${v2.lvl.h} (still reported missing: ${/lvl_NaN/.test(v2.unresolved)})` : 'no level layer');
    check('IMG_TIME keeps its part, zero, spacing and alignment',
      !v2.error && v2.hour && v2.hour.part === 'hour' && v2.hour.zero === 1 && v2.hour.space === 3
      && v2.hour.alignH === 'CENTER_H' && v2.hour.show === 'aod' && v2.hour.images.length === 1,
      JSON.stringify(v2.hour));
    check('widgets the designer cannot author are listed, not dropped',
      !v2.error && /SLIDE_SWITCH/.test(v2.report) && /SCROLL_TEXT/.test(v2.report),
      (v2.report || '').split('\n').filter((l) => /SLIDE_SWITCH|SCROLL_TEXT/.test(l)).join(' · '));
    // WIDGET_DELEGATE draws nothing — it only carries the resume/pause hook, so
    // it is a note, not a widget that was "left out"
    const delegateLeftOut = ((v2.report || '').match(/Not in the designer[\s\S]*?(?:\n\n|$)/) || [''])[0];
    check('a lifecycle delegate is a note, not an unsupported layer',
      !v2.error && /WIDGET_DELEGATE ×1/.test(v2.report) && !/WIDGET_DELEGATE/.test(delegateLeftOut)
      && v2.layers === 4,
      `layers=${v2.layers} · ${(v2.report || '').split('\n').filter((l) => /WIDGET_DELEGATE/.test(l)).join(' · ') || 'no delegate note'}`);
    check('a compressed Maker image imports as a real PNG (palette + byte order)',
      !v2.error && v2.dot && v2.dot.width === 4 && /^data:image\/png;base64,iVBOR/.test(v2.dot.url),
      v2.dot ? `${v2.dot.width}px, ${v2.dot.url}` : 'dot.png missing');
    const dotRec = await run(`const i = project.images.find((x) => x.name === 'dot.png'); return i ? i.url : '';`);
    let dotPx = null;
    try {
      const png = require('pngjs').PNG.sync.read(Buffer.from(String(dotRec).split(',')[1], 'base64'));
      dotPx = [png.data[(1 * png.width + 1) * 4], png.data[(1 * png.width + 1) * 4 + 1], png.data[(1 * png.width + 1) * 4 + 2], png.data[(1 * png.width + 1) * 4 + 3]];
    } catch (e) { dotPx = null; }
    check('the compressed image decodes to the right pixels in the right order',
      !!dotPx && dotPx.join(',') === '255,140,0,255', dotPx ? dotPx.join(',') : 'could not decode');

    // the import checks above swapped the loaded project out; put the smoke's
    // own back so the checks that follow keep working on it
    const restored = await run(`
      const res = await API.openProjectPath(${JSON.stringify(projectDir)});
      if (res.error) return { error: res.error };
      await loadProject(res);
      $('logModal').hidden = true;
      return { layers: project.elements.length, name: project.name };`);
    check('the original project loads again after the imports',
      !restored.error && restored.layers >= 9, restored.error || `${restored.name}: ${restored.layers} layers`);

    // A layer that lost its picture must never reach the watch: the generated
    // code would open an image the package does not hold and the face would not
    // come up. Such layers are reported and left out instead.
    const codegen = require(path.join(__dirname, '..', 'core', 'codegen'));
    const devices = require(path.join(__dirname, '..', 'core', 'devices'));
    const stripped = codegen.generateWatchface({
      name: 'Missing pictures', device: 'bip-6',
      elements: [
        { id: 'aaaa', kind: 'IMG', name: 'No picture', x: 1, y: 2, show: 'both' },
        { id: 'bbbb', kind: 'IMG_LEVEL', name: 'Empty level', x: 3, y: 4, show: 'both', images: [] },
      ],
    }, devices.deviceByKey('bip-6'));
    check('a layer whose picture is gone stays out of the export (and is reported)',
      !/createWidget/.test(stripped.code)
      && stripped.warnings.some((w) => /^No picture: no picture — left out of the export$/.test(w))
      && stripped.warnings.some((w) => /^Empty level: no picture — left out of the export$/.test(w)),
      `${stripped.warnings.length} warning(s): ${stripped.warnings.join(' · ')}`);

    // A folder can hold both a designer project and an app.json (this app's own
    // sample/export layout): Open prefers the project, Import imports anyway.
    fs.writeFileSync(path.join(v2Dir, 'Probe.wfproj.json'), JSON.stringify({
      version: 1, name: 'Designer One', device: 'bip-6', appId: 4242, font: 'Orbitron',
      fonts: [], groups: {}, elements: [],
    }, null, 2));
    const bothWays = await run(`
      const asProject = await API.openProjectPath(${JSON.stringify(v2Dir)});
      const forced = await API.openProjectPath(${JSON.stringify(v2Dir)}, { force: true });
      return {
        project: asProject.error ? asProject.error : { imported: !!asProject.imported, name: asProject.project.name, savePath: asProject.savePath },
        forced: forced.error ? forced.error : { imported: !!forced.imported, name: forced.project.name, layers: forced.project.elements.length },
      };`);
    check('a folder with a project file and an app.json opens as the project',
      !!(bothWays.project && bothWays.project.imported === false && bothWays.project.name === 'Designer One'),
      JSON.stringify(bothWays.project));
    check('Import imports that same folder anyway',
      !!(bothWays.forced && bothWays.forced.imported === true && bothWays.forced.name === 'Imported V2' && bothWays.forced.layers === 4),
      JSON.stringify(bothWays.forced));

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
        cells: document.querySelectorAll('#props .setfield .sf-cell img').length,
        notes: [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent) };`);
    check('digit layer properties expose font / size / colour / fill / bold / italic rows',
      ['Font', 'Size', 'Fill', 'Color', 'Bold', 'Italic', 'Redraw'].every((l) => glyphRows.labels.includes(l))
      && glyphRows.spill.length === 0 && glyphRows.imgs >= 10 && glyphRows.cells >= 10,
      `${glyphRows.labels.length} rows, ${glyphRows.imgs} images, ${glyphRows.cells} set thumbnails, spill: ${glyphRows.spill.join(', ') || 'none'}`);

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

    // ---- language / names, and sets that came from another watchface --------
    const weekNames2 = await run(`
      const e = await addElement('IMG_WEEK', { name: 'Names test' });
      selectedId = e.id; multiSel = new Set([e.id]); refreshPanels();
      const rows = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      const en = weekNames(e).slice();                       // default case is UPPERCASE
      const enAs = weekNames(Object.assign({}, e, { labelCase: '' })).slice();
      project.language = 'ro-RO';
      const ro = weekNames(Object.assign({}, e, { labelCase: '' })).slice();
      const roLong = monthNames(Object.assign({}, e, { labelForm: 'long', labelCase: '' })).slice();
      project.language = 'en-US';
      e.labelForm = 'long'; e.labelCase = 'upper';
      const shout = weekNames(e).slice();
      const files = (e.images || []).slice();
      return { rows, en, enAs, ro, roLong, shout, files, known: localeKnown('ro-RO'), bad: localeKnown('xx-nope') };`);
    check('weekday / month names come from the project language (Intl), with a form and a case',
      weekNames2.known && !weekNames2.bad && weekNames2.en[0] === 'MON' && weekNames2.enAs[0] === 'Mon' && weekNames2.en.length === 7
      && /^lun/i.test(weekNames2.ro[0]) && weekNames2.roLong[0] === 'ianuarie'
      && weekNames2.shout[0] === 'MONDAY'
      && ['Names', 'Case', 'Language'].every((l) => weekNames2.rows.includes(l))
      && /^week\d*_w1\.png$/.test(weekNames2.files[0])
      && weekNames2.files.join(',') === [1, 2, 3, 4, 5, 6, 7].map((i) => weekNames2.files[0].replace('_w1.', `_w${i}.`)).join(','),
      `default ${weekNames2.en[0]} · as generated ${weekNames2.enAs[0]} · ro ${weekNames2.ro[0]} / ${weekNames2.roLong[0]} · ${weekNames2.shout[0]} · rows ${weekNames2.rows.filter((l) => /Names|Case|Language/.test(l)).join(',')}`);

    const importedSet = await run(`
      const el = await addElement('IMG_TIME', { name: 'Imported set' });
      // pretend the pictures came from another watchface: private copies under
      // foreign names, so nothing else in the project is touched
      const original = el.images.slice();
      const foreign = [];
      for (let i = 0; i < original.length; i++) {
        const im = imgFor(original[i]);
        const cv = document.createElement('canvas');
        cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        cv.getContext('2d').drawImage(im, 0, 0);
        addProjectImage('winamp_big_' + i + '.png', cv, { replace: true });
        foreign.push('winamp_big_' + i + '.png');
      }
      el.images = foreign;
      el.glyph = undefined;
      selectedId = el.id; multiSel = new Set([el.id]); refreshPanels();
      const spec0 = (glyphSpecForLayer(el) || []).map((g) => g.char).join('');
      const imported0 = importedGlyphSet(el);
      const sized = glyphStyle(el).size;
      const note = [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent).join(' | ');
      const url0 = imgMeta(foreign[0]).url;
      const sh0 = imgMeta(foreign[0]).height;
      el.glyph = { font: glyphFont, size: 96, color: glyphOpts.color, fill: 'solid' };
      const done = await rerenderGlyphLayers([el]);
      const after = imgMeta(foreign[0]);
      // tidy up: the layer and its copies are this check's own
      project.elements = project.elements.filter((x) => x !== el);
      project.images = project.images.filter((i) => !foreign.includes(i.name));
      selectedId = null; multiSel = new Set(); refreshPanels();
      return { spec0, imported0, sized, done, sh0, sh1: after ? after.height : 0,
        replaced: !after || after.url !== url0, note: /came with/.test(note),
        keptNames: el.images.join(',') === foreign.join(',') };`);
    check('a set imported from another watchface can be restyled in place',
      importedSet.spec0 === '0123456789' && importedSet.imported0 && importedSet.note && importedSet.sized > 0
      && importedSet.done === 1 && importedSet.keptNames && importedSet.replaced && importedSet.sh1 > importedSet.sh0,
      `recognised as “${importedSet.spec0}” · default size ${importedSet.sized}px · re-rendered ${importedSet.done} · cell ${importedSet.sh0}px → ${importedSet.sh1}px`);

    // a hand-built two-frame GIF (1×1, 100 ms then 200 ms) so the split is tested
    // end to end without shipping a fixture file
    const GIF_B64 = 'R0lGODlhAQABAPAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAkQBACH5BAAUAAAALAAAAAABAAEAAAICRAEAOw==';
    const frameImport = await run(`
      // the row is one button for both cases: a run of pictures, or an animated
      // GIF that is split into frames for you
      const GIF = '${GIF_B64}';
      const el = await addElement('IMG_ANIM', { name: 'GIF test' });
      selectedId = el.id; multiSel = new Set([el.id]); refreshPanels();
      const labels = [...document.querySelectorAll('#props .row .lbl')].map((s) => s.textContent.trim());
      const prefix = animPrefixForLayer(el);
      const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
      cv.getContext('2d').fillRect(0, 0, 8, 8);
      const still = await new Promise((r) => cv.toBlob(r, 'image/png'));
      const settle = async (want) => { for (let i = 0; i < 80; i++) { await new Promise((r) => setTimeout(r, 50)); if ((el.frames || []).length === want) return true; } return false; };
      const feed = (files) => {
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        $('framesInput').files = dt.files;
        framesTarget = el;                                  // what the button sets before clicking
        $('framesInput').dispatchEvent(new Event('change'));
      };
      // a still picture is simply one frame
      feed([new File([still], 'still.png', { type: 'image/png' })]);
      const one = await settle(1);
      // an animated GIF splits into one PNG per frame, fps from its own delays
      const bytes = Uint8Array.from(atob(GIF), (ch) => ch.charCodeAt(0));
      feed([new File([bytes], 'blink.gif', { type: 'image/gif' })]);
      const two = await settle(2);
      const out = { labels, one, two, names: (el.frames || []).slice(), fps: el.fps, prefix,
        still: await splitGifInto(el, new File([still], 'still.png', { type: 'image/png' })),
        hasDecoder: typeof ImageDecoder !== 'undefined',
        anims: project.images.filter((i) => i.name.startsWith('anim/')).length };
      project.elements = project.elements.filter((x) => x !== el);
      project.images = project.images.filter((i) => !i.name.startsWith('anim/') || !i.name.includes(prefix));
      selectedId = null; multiSel = new Set(); refreshPanels();
      return out;`);
    check('one Frames row: a picture run, and a GIF that splits itself with its own frame rate',
      frameImport.hasDecoder && frameImport.labels.includes('Frames') && !frameImport.labels.includes('GIF')
      && frameImport.one && frameImport.two
      && frameImport.names.join(',') === `anim/${frameImport.prefix}_0.png,anim/${frameImport.prefix}_1.png`
      && frameImport.fps === 7 && frameImport.still === 0,
      `rows ${frameImport.labels.filter((l) => /Frames|GIF/.test(l)).join(',')} · still → 1 frame (${frameImport.one}) · 2-frame GIF → ${frameImport.names.length} frames at ${frameImport.fps} fps · splitGifInto(still)=${frameImport.still} · ImageDecoder=${frameImport.hasDecoder}`);

    const modalGen = await run(`
      selectedId = null; multiSel = new Set(); refreshPanels();
      const before = project.images.length;
      openFontModal();
      const noTarget = $('fontTarget').textContent;
      await fontGen('week');                    // must refuse: nothing selected
      const refused = project.images.length === before;
      $('fontModal').hidden = true;
      const el = await addElement('IMG_WEEK', { name: 'Modal week' });
      selectedId = el.id; multiSel = new Set([el.id]); refreshPanels();
      openFontModal();
      const target = $('fontTarget').textContent;
      const targetName = el.name;
      const seededFont = fontSelFamily, seededSize = $('fontSize').value;
      const rowsShown = getComputedStyle($('fontNamesRow')).display !== 'none'
        && getComputedStyle($('fontCaseRow')).display !== 'none';
      const cases = [...$('fontCase').options].map((o) => o.value);
      const weekBtn = $('fontGenWeek').textContent.trim();
      const weekShown = getComputedStyle($('fontGenWeek')).display !== 'none'
        && getComputedStyle($('fontGenSet')).display === 'none';
      el.labelForm = 'long'; el.labelCase = 'upper';
      await fontGen('week');
      const meta = imgMeta((el.images || [])[0]);
      // the same button follows the component: a digit set offers its 0-9 images,
      // seeded with that layer's own size
      const digit = elements().find((x) => x.kind === 'IMG_TIME') || await addElement('IMG_TIME');
      selectedId = digit.id; multiSel = new Set([digit.id]); refreshPanels();
      openFontModal();
      const digitBtn = $('fontGenSet').textContent.trim();
      const digitHidden = getComputedStyle($('fontGenWeek')).display === 'none';
      const digitSeed = +$('fontSize').value;
      const digitSize = glyphStyle(digit).size;
      const out = { noTarget, refused, target, targetName, cases, seededFont, seededSize, rowsShown, weekBtn, weekShown,
        digitBtn, digitHidden, digitSeed, digitSize,
        char0: (glyphSpecForLayer(el) || [])[0].char, name0: (el.images || [])[0], w: meta && meta.width, h: meta && meta.height, size: (el.glyph || {}).size };
      $('fontModal').hidden = true;
      project.elements = project.elements.filter((x) => x !== el);
      selectedId = null; multiSel = new Set(); refreshPanels(); render();
      return out;`);
    check('the font modal generates for the selected component (and says so without one)',
      /Select a layer first/.test(modalGen.noTarget) && modalGen.refused
      && modalGen.target.includes(modalGen.targetName) && /Weekday/.test(modalGen.target)
      && modalGen.rowsShown && modalGen.cases[0] === 'upper'
      && modalGen.weekBtn === 'Weekdays' && modalGen.weekShown
      && modalGen.char0 === 'MONDAY' && /^week\d*_w1\.png$/.test(modalGen.name0)
      && modalGen.w > 0 && modalGen.h > 0
      && modalGen.digitBtn === 'Digits 0-9' && modalGen.digitHidden && modalGen.digitSeed === modalGen.digitSize,
      `“${modalGen.noTarget}” → refused=${modalGen.refused} · ${modalGen.target} · seed ${modalGen.seededFont} ${modalGen.seededSize}px · drew “${modalGen.char0}” → ${modalGen.name0} ${modalGen.w}×${modalGen.h} · digit layer: ${modalGen.digitBtn} (week button hidden: ${modalGen.digitHidden}, seed ${modalGen.digitSeed}px)`);

    const animRate = await run(`
      let added = null;
      if (!project.elements.some((e) => e.kind === 'IMG_ANIM' && e.visible !== false)) {
        added = await addElement('IMG_ANIM', { name: 'Preview pace' });
      }
      render();                       // the interval only redraws when an anim exists
      animTick = 0;
      await new Promise((r) => setTimeout(r, 600));
      const tick = animTick;          // in 1/30 s units, so ~18 after 0.6 s
      if (added) { project.elements = project.elements.filter((x) => x !== added); selectedId = null; multiSel = new Set(); refreshPanels(); render(); }
      return { tick };`);
    check('the animation preview advances in real time (~30 units/s, so fps is honest)',
      animRate.tick > 12 && animRate.tick < 26, `${animRate.tick.toFixed(1)} units in 0.6 s`);

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
      const gap0 = Math.round(elBox(b).x - elBox(a).x);
      alignSel(selection(), 'right', D, 'device');
      const rights = [Math.round(selBox(selection()).x + selBox(selection()).w)];
      const gap1 = Math.round(elBox(b).x - elBox(a).x);
      alignSel(selection(), 'vcenter', D, 'device');
      const centres = [Math.round(selBox(selection()).y + selBox(selection()).h / 2)];
      return { before, boxLeft, devLeft, rights, centres, kept: gap0 === gap1, devW: D.w, devH: D.h };`);
    check('align to box keeps the group box, align to device uses the screen',
      alignRun.boxLeft === alignRun.before && alignRun.devLeft === 0 && alignRun.kept
      && alignRun.rights.every((r) => r === alignRun.devW)
      && alignRun.centres.every((c) => c === Math.round(alignRun.devH / 2)),
      `box-left ${alignRun.before}→${alignRun.boxLeft} · device-left ${alignRun.devLeft} · right edges ${alignRun.rights.join(',')} of ${alignRun.devW} · centres ${alignRun.centres.join(',')} of ${alignRun.devH / 2}`);

    const viewRun = await run(`
      const a = elementById(${JSON.stringify(groupUi.a)});
      const b = elementById(${JSON.stringify(groupUi.b)});
      a.show = 'normal'; b.show = 'both';
      document.querySelector('#layersView [data-view="aod"]').click();
      const dimmed = [...document.querySelectorAll('#layers .layer.offview')].map((n) => n.dataset.id);
      const aodOn = previewMode === 'aod';
      const badge = !!document.querySelector('#layers .layer[data-id="' + b.id + '"] .grp.both');
      document.querySelector('#layersView [data-view="all"]').click();
      const none = document.querySelectorAll('#layers .layer.offview').length;
      document.querySelector('#layersView [data-view="normal"]').click();
      document.querySelector('#layersView [data-view="all"]').click();
      return { aInDim: dimmed.includes(a.id), bInDim: dimmed.includes(b.id), aodOn, badge, none };`);
    check('layer view filter dims what the preview does not draw and tags Both',
      viewRun.aInDim && !viewRun.bInDim && viewRun.aodOn && viewRun.badge && viewRun.none === 0, JSON.stringify(viewRun));

    const selRun = await run(`
      const a = await addElement('FILL_RECT', { x: 5, y: 5, w: 30, h: 30, color: '#202020' });
      const b = await addElement('FILL_RECT', { x: 60, y: 60, w: 30, h: 30, color: '#303030' });
      a.x = 5; a.y = 5; b.x = 60; b.y = 60; a.group = b.group = null;
      a.show = 'both'; b.show = 'normal';
      selectedId = null; multiSel = new Set(); previewMode = 'normal'; layerFocus = false; render();
      const at = (e) => { const bx = elBox(e), r = $('cv').getBoundingClientRect(), k = r.width / $('cv').width;
        return { clientX: r.left + (bx.x + bx.w / 2) * k, clientY: r.top + (bx.y + bx.h / 2) * k }; };
      const fire = (e, mod) => $('cv').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ctrlKey: mod, ...at(e) }));
      fire(a, false); window.dispatchEvent(new MouseEvent('mouseup'));
      fire(b, true); window.dispatchEvent(new MouseEvent('mouseup'));
      const two = multiSel.size >= 2 && multiSel.has(a.id) && multiSel.has(b.id);
      fire(b, true); window.dispatchEvent(new MouseEvent('mouseup'));
      const toggledOff = !multiSel.has(b.id) && multiSel.has(a.id);
      fire(b, true); window.dispatchEvent(new MouseEvent('mouseup'));
      document.querySelector('#layersView [data-view="aod"]').click();
      const dropped = !multiSel.has(b.id) && multiSel.has(a.id);
      const rowB = document.querySelector('#layers .layer[data-id="' + b.id + '"]');
      rowB.click();
      const rowIgnored = !multiSel.has(b.id);
      document.querySelector('#layersView [data-view="all"]').click();
      document.querySelector('main').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      const cleared = !selectedId && multiSel.size === 0;
      return { two, toggledOff, dropped, rowIgnored, cleared };`);
    check('Ctrl-click multi-selects on the preview, AOD focus disables other layers, clicking the workspace deselects',
      selRun.two && selRun.toggledOff && selRun.dropped && selRun.rowIgnored && selRun.cleared, JSON.stringify(selRun));

    const whenRun = await run(`
      const a = await addElement('FILL_RECT', { x: 5, y: 5, w: 30, h: 30, color: '#202020' });
      const b = await addElement('FILL_RECT', { x: 60, y: 60, w: 30, h: 30, color: '#303030' });
      a.show = b.show = 'normal'; a.showWhen = 'am'; b.showWhen = 'pm';
      const saved = { ...clock };
      clock = { h: 9, m: 0, s: 0 };
      const amA = whenAllows(a), amB = whenAllows(b);
      clock = { h: 17, m: 0, s: 0 };
      const pmA = whenAllows(a), pmB = whenAllows(b);
      clock = saved;
      return { amA, amB, pmA, pmB };`);
    check('Visible when ties a layer to AM or PM (preview follows the clock)',
      whenRun.amA && !whenRun.amB && !whenRun.pmA && whenRun.pmB, JSON.stringify(whenRun));

    const spaceRun = await run(`
      const names = Array.from({ length: 10 }, (_, i) => 'sp_' + i + '.png');
      for (const n of names) {
        const c = document.createElement('canvas'); c.width = 20; c.height = 20;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(2, 2, 10, 16);
        addProjectImage(n, c);
      }
      await loadAllImages();
      const t = await addElement('IMG_TIME', { part: 'hour', x: 60, y: 60, zero: 1, space: 0, images: names });
      t.images = names; t.space = 0; t.x = 60; t.y = 60;
      selectedId = t.id; multiSel = new Set([t.id]);
      const tight = tightSpace(t);
      const hp = spaceHandlePos(t);
      const r = $('cv').getBoundingClientRect(), k = r.width / $('cv').width;
      const at = (dx) => ({ clientX: r.left + (hp.x + dx) * k, clientY: r.top + hp.y * k });
      $('cv').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ...at(0) }));
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, ...at(-6) }));
      window.dispatchEvent(new MouseEvent('mouseup'));
      return { tight, hasHandle: !!hp, dragged: t.space };`);
    check('digit spacing: Tight measures the painted width, the canvas handle drags the spacing',
      spaceRun.tight === -10 && spaceRun.hasHandle && spaceRun.dragged === -6, JSON.stringify(spaceRun));

    const barRun = await run(`
      const bar = await addElement('BAR', { x: 10, y: 10, length: 100, lineWidth: 8, dataType: 'BATTERY', color: '#ff0000' });
      bar.x = 10; bar.y = 10; bar.length = 100; bar.lineWidth = 8; bar.rounded = false; bar.inversion = false;
      const prev = testData.BATTERY; testData.BATTERY = 40;
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 40;
      const c = cv.getContext('2d');
      drawElement(c, bar);
      const px = (x, y) => c.getImageData(x, y, 1, 1).data[3];
      const fillEnd = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => px(10 + 10 * i + 5, 14)).filter((a) => a > 0).length;
      bar.inversion = true; c.clearRect(0, 0, 200, 40); drawElement(c, bar);
      const invLeft = px(12, 14), invRight = px(105, 14);
      testData.BATTERY = prev;
      return { fillEnd, invLeft, invRight };`);
    check('a progress bar fills to the reading (and from the far end when inverted)',
      barRun.fillEnd === 4 && barRun.invLeft === 0 && barRun.invRight > 0, JSON.stringify(barRun));

    const editRun = await run(`
      const slot = await addElement('EDIT_SLOT', { editId: 7, x: 10, y: 10, w: 40, h: 20, defaultType: 'STEP', optionalTypes: [{ type: 'STEP', preview: '' }, { type: 'HEART', preview: '' }] });
      const a = await addElement('FILL_RECT', { w: 10, h: 10, color: '#202020' });
      const b = await addElement('FILL_RECT', { w: 10, h: 10, color: '#303030' });
      a.editSlot = 7; a.editType = 'STEP'; b.editSlot = 7; b.editType = 'HEART';
      const first = [editAllows(a), editAllows(b)];
      editPick[7] = 'HEART';
      const second = [editAllows(a), editAllows(b)];
      editPick = {};
      return { first, second, sel: !!document.querySelector('#editSels select') };`);
    check('the Complication selector decides which choice\'s layers the preview draws',
      editRun.first.join() === 'true,false' && editRun.second.join() === 'false,true', JSON.stringify(editRun));

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
      // a reference widget a few px to the right: its edge is the nearest target
      // for the group box's left edge, so the snap has to land exactly on it
      const ref = await addElement('FILL_RECT', { w: 20, h: 20, color: '#202020' });
      ref.x = Math.round(union.x) + 3; ref.y = 20;
      const s = snapBox(union.x + 3, union.y, union.w, union.h, [a.id, b.id]);
      const cands = [...alignTargets([a.id, b.id]).xs, dev().w / 2];
      const onTarget = cands.some((t) => Math.abs(t - s.x) < 0.6) || s.x % 20 === 0;
      project.elements = project.elements.filter((x) => x !== ref);
      return { drop2: allN - skipN, drop1: allN - oneN, unionX: union.x, refX: ref.x, snapped: s.x, onTarget };`);
    check('the snap aid uses the group box, and members are not their own snap targets',
      snapAid.drop2 === 6 && snapAid.drop1 === 3 && snapAid.onTarget && snapAid.snapped === snapAid.refX,
      `two members excluded → ${snapAid.drop2} targets fewer (one → ${snapAid.drop1}) · group box left ${snapAid.unionX} +3 → snapped ${snapAid.snapped} (reference edge ${snapAid.refX} · on a target: ${snapAid.onTarget})`);

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
      const before = project.elements.length;
      await applyPreset('clock');
      const added = project.elements.slice(before);
      const clockHour = added.find((e) => e.kind === 'IMG_TIME' && e.part === 'hour');
      project.elements = project.elements.slice(0, before);
      const reading = project.elements.find((e) => e.kind === 'TEXT_IMG' && e.dataType === 'STEP');
      const labels = SHOW_LEVELS.map((s) => s.key + ':' + s.label);
      return { fresh: fresh.show, freshText: freshText.show, clockHour: clockHour && clockHour.show,
        reading: reading && reading.show, labels };`);
    check('new components and presets start in Normal only (AOD is opt-in)',
      showDefault.fresh === 'normal' && showDefault.freshText === 'normal'
      && showDefault.clockHour === 'normal' && showDefault.reading === 'normal',
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
    check('the layers panel has a flat top toolbar (order / duplicate / group / ungroup / delete)',
      layersBar.btns.join(',') === 'btnToFront,btnForward,btnBackward,btnToBack,btnDup,btnGroup,btnUngroup,btnDelLayers'
      && layersBar.headerButtons === 0
      && layersBar.styles.every((s) => s.border === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(s.bg) && s.svg && s.h >= 28)
      && layersBar.bar.y < layersBar.panel.y + layersBar.panel.h / 2
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
      rowOf('Show in').querySelector('.seg-b[data-show="aod"]').click();
      const alphaInp = rowOf('Alpha').querySelector('input');
      alphaInp.value = '128';
      alphaInp.oninput();
      const note = [...document.querySelectorAll('#props .prop-note')].map((p) => p.textContent).find((t) => /apply to every selected layer/.test(t)) || '';
      return { none: false, aShow: a.show, bShow: b.show, aAlpha: a.alpha, bAlpha: b.alpha,
        showTip: rowOf('Show in').querySelector('.lbl .help-i').dataset.help, alphaTip: rowOf('Alpha').querySelector('.lbl .help-i').dataset.help, note };`);
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
      const plain = { symbol: picRows.includes('Symbol'), font: picRows.includes('Font'), preview: !!document.querySelector('#props .imgfield .if-thumb img') };
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
      const prev = document.querySelector('#props .imgfield .if-thumb img');
      const prevText = document.querySelector('#props .imgfield .if-sub');
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

    // ---- recents: a project folder that went missing stays visible ----------
    const recentsFile = path.join(app.getPath('userData'), 'recent-projects.json');
    let recentsBackup = null;
    try { recentsBackup = fs.readFileSync(recentsFile, 'utf8'); } catch (e) { recentsBackup = null; }
    const goneDir = path.join(SCRATCH, 'moved-away');
    fs.mkdirSync(goneDir, { recursive: true });
    await run(`return API.saveProject({ project, images: projectImagesPayload(), savePath: ${JSON.stringify(goneDir)}, previewBase64: '' });`);
    fs.rmSync(goneDir, { recursive: true, force: true });   // the user drags the folder to the Trash
    const recents = await run(`
      const list = await API.recentList();
      const entry = list.find((r) => r.path === ${JSON.stringify(goneDir)});
      const keep = project; project = null;
      await renderRecents();
      const row = [...document.querySelectorAll('#recentList .recent-item')].find((n) => n.title === ${JSON.stringify(goneDir)});
      const out = {
        listed: !!entry, exists: entry ? entry.exists : null,
        missingClass: !!(row && row.classList.contains('missing')),
        text: row ? row.querySelector('.ri-path').textContent : '',
        badge: row ? row.querySelector('.ri-badge').textContent : '',
        hasX: !!(row && row.querySelector('.ri-x')),
      };
      if (row) row.click();
      out.status = $('meta').textContent; out.err = $('meta').classList.contains('err');
      $('recentClear').click();
      await new Promise((r) => setTimeout(r, 250));
      out.left = document.querySelectorAll('#recentList .recent-item').length;
      out.hidden = $('recentWrap').hidden;
      project = keep;
      return out;`);
    check('a project folder that went missing stays listed, flagged in red',
      recents.listed && recents.exists === false && recents.missingClass && recents.badge === 'Missing' && recents.hasX && /gone/.test(recents.status) && recents.err === true,
      `listed=${recents.listed} exists=${recents.exists} · row: “${recents.text}” · click → “${recents.status}”`);
    check('Clear empties the recent list', recents.left === 0 && recents.hidden === true,
      `${recents.left} row(s) left · panel ${recents.hidden ? 'hidden' : 'still open'}`);
    // the smoke never keeps the user's own recents
    if (recentsBackup === null) { try { fs.unlinkSync(recentsFile); } catch (e) { /* there was none */ } }
    else fs.writeFileSync(recentsFile, recentsBackup);

    // a Maker face with a "switch background" button and a shortcut button
    {
      const tapDir = path.join(SCRATCH, 'tapface');
      fs.cpSync(v2Dir, tapDir, { recursive: true });
      const assetsRoot = fs.existsSync(path.join(tapDir, 'assets', 'default', 'img')) ? path.join(tapDir, 'assets', 'default', 'img') : path.join(tapDir, 'assets');
      for (const d of [assetsRoot, path.join(tapDir, 'assets')]) {
        const src = path.join(d, 'plain.png');
        if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(d, 'plain2.png')); fs.copyFileSync(src, path.join(d, 'plain3.png')); }
      }
      fs.writeFileSync(path.join(tapDir, 'watchface', 'index.js'), `
        let backgroundList = ['plain.png', 'plain2.png', 'plain3.png'];
        let backgroundToastList = ['Yellow', 'Green', 'Blue'];
        DeviceRuntimeCore.WatchFace({
          build() {
            const bg = hmUI.createWidget(hmUI.widget.IMG, { x: 0, y: 0, w: 390, h: 450, src: 'plain.png' });
            hmUI.createWidget(hmUI.widget.BUTTON, { x: 138, y: 10, w: 115, h: 51, normal_src: 'plain.png',
              click_func: (b) => { switchBackground(); } });
            hmUI.createWidget(hmUI.widget.BUTTON, { x: 34, y: 390, w: 78, h: 56, normal_src: 'plain.png',
              click_func: (b) => { hmApp.startApp({url: 'ScheduleCalScreen', native: true }); } });
          },
        });
      `);
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const gen = require(path.join(__dirname, '..', 'core', 'codegen'));
      const imp = importFaceDir(tapDir);
      const els = imp.project ? imp.project.elements : [];
      const bg = els.find((e) => e.kind === 'IMG' && (e.images || []).length === 3);
      const taps = els.filter((e) => e.kind === 'TAP');
      const js = imp.project ? gen.generateWatchface(imp.project, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET)).code : '';
      let syntax = true;
      try { new Function(js.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { syntax = false; }
      check('a Maker face imports its background variants and tap zones',
        !imp.error && !!bg && bg.variantNames.join() === 'Yellow,Green,Blue'
        && taps.length === 2 && taps.some((t) => t.action === 'variant' && t.x === 138) && taps.some((t) => t.action === 'app' && t.appUrl === 'ScheduleCalScreen'),
        imp.error || `bg ${bg ? bg.images.length : 0} variants · taps ${taps.map((t) => t.action).join(',')}`);
      check('variants + tap zones export a switcher (storage, toast, BUTTON, startApp) that parses',
        !/@zos\/storage|@zos\/interaction/.test(js) && /hmFS\.SysProGetInt/.test(js) && /typeof hmUI/.test(js)
        && /const variant_0 = ui\.createWidget\(ui\.widget\.IMG/.test(js) && /variant_0\.setProperty\(ui\.prop\.SRC/.test(js)
        && (js.match(/ui\.widget\.BUTTON/g) || []).length === 2 && /cycleVariants\(\)/.test(js) && /startApp\(\{ url: "ScheduleCalScreen"/.test(js) && syntax,
        `imports ${/@zos\/storage|@zos\/interaction/.test(js)} · storage ${/SysProGetInt/.test(js)} · variant widget ${/const variant_0/.test(js)} · BUTTON ${(js.match(/ui\.widget\.BUTTON/g) || []).length} · cycle ${/cycleVariants\(\)/.test(js)} · app ${/startApp/.test(js)} · syntax ${syntax}`);
    }
    {
      const { decodeSomh } = require(path.join(__dirname, '..', 'core', 'somh'));
      // 16-bit flavour: 64-byte header, RGB565 pixels, stride 4 but a real width of 3
      const buf = Buffer.alloc(64 + 4 * 2 * 2);
      buf[0] = 0x2e; buf[2] = 0x02; buf.writeUInt16LE(4, 12); buf.writeUInt16LE(2, 14); buf.writeUInt16LE(0x2010, 16); buf.writeUInt16LE(3, 22);
      const put = (i, v) => buf.writeUInt16LE(v, 64 + i * 2);
      put(0, 0xf800); put(1, 0x07e0); put(2, 0x001f); put(3, 0xffff);   // row 0: red, green, blue, (padding)
      put(4, 0x0000); put(5, 0xffff); put(6, 0x8410); put(7, 0xffff);
      const img = decodeSomh(buf);
      const at = (x, y) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
      check('a 16-bit (RGB565) Maker image decodes, cropped to its real width',
        !!img && img.width === 3 && img.height === 2 && at(0, 0).join() === '255,0,0,255' && at(1, 0).join() === '0,255,0,255'
        && at(2, 0).join() === '0,0,255,255' && at(1, 1).join() === '255,255,255,255',
        img ? `${img.width}×${img.height} · ${at(0, 0)} ${at(1, 0)} ${at(2, 0)}` : 'not decoded');
    }
    // Maker components with no widget of their own: linear scale, text reading, sleep chart
    {
      const dirM = path.join(SCRATCH, 'makerparts');
      fs.cpSync(v2Dir, dirM, { recursive: true });
      fs.writeFileSync(path.join(dirM, 'watchface', 'index.js'), `
        let normal_sleepColors = [0xFF708EAE, 0xFF212C35, 0xFF8CB0D8, 0xFF44556B];
        DeviceRuntimeCore.WatchFace({
          build() {
            hmUI.createWidget(hmUI.widget.FILL_RECT);
            // normal_battery_linear_scale = hmUI.createWidget(hmUI.widget.Linear_Scale, {
              // start_x: 53,
              // start_y: 57,
              // color: 0xFF84A6CD,
              // lenght: 41,
              // line_width: 17,
              // line_cap: Rounded,
              // vertical: False,
              // mirror: False,
              // inversion: True,
              // alpha: 255,
              // type: hmUI.data_type.BATTERY,
              // show_level: hmUI.show_level.ONLY_NORMAL,
            // });
            hmUI.createWidget(hmUI.widget.TEXT_FONT, { x: 69, y: 397, w: 97, h: 29, text_size: 23, color: 0xFFFFFFFF, alpha: 180,
              align_h: hmUI.align.CENTER_H, type: hmUI.data_type.MOON_RISE, show_level: hmUI.show_level.ONLY_NORMAL });
            hmUI.createWidget(hmUI.widget.GROUP, { x: 41, y: 307, w: 215, h: 69, show_level: hmUI.show_level.ONLY_NORMAL });
          },
        });
      `);
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const gen = require(path.join(__dirname, '..', 'core', 'codegen'));
      const impM = importFaceDir(dirM);
      const elsM = impM.project ? impM.project.elements : [];
      const bar = elsM.find((e) => e.kind === 'BAR');
      const txt = elsM.find((e) => e.kind === 'TEXT' && e.dataType === 'MOON_RISE');
      const slp = elsM.find((e) => e.kind === 'SLEEP_CHART');
      check('Maker linear scale, text reading and sleep chart import as real layers',
        !impM.error && !!bar && bar.x === 53 && bar.length === 41 && bar.lineWidth === 17 && bar.rounded && bar.inversion && bar.dataType === 'BATTERY'
        && !!txt && txt.alpha === 180 && !!slp && slp.colorWake === '#44556b' && !elsM.some((e) => e.kind === 'FILL_RECT'),
        impM.error || `bar ${bar ? bar.dataType : '—'} · text ${txt ? txt.dataType : '—'} · sleep ${slp ? slp.w + '×' + slp.h : '—'}`);
      const jsM = impM.project ? gen.generateWatchface(impM.project, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET)).code : '';
      let synM = true;
      try { new Function(jsM.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { synM = false; }
      check('bar, TEXT_FONT reading and sleep chart export (sensor-driven, guarded, valid syntax)',
        /ui\.widget\.FILL_RECT/.test(jsM) && /bar_1\.setProperty\(ui\.prop\.MORE/.test(jsM) && /onChange\(upd_bar_1\)/.test(jsM)
        && /ui\.widget\.TEXT_FONT/.test(jsM) && /type: ui\.data_type\.MOON_RISE/.test(jsM)
        && /ui\.widget\.GROUP/.test(jsM) && /new Sleep\(\)/.test(jsM) && /catch \(e\) \{\}/.test(jsM) && synM,
        'FILL_RECT + MORE updater, TEXT_FONT type, GROUP + Sleep in try/catch');
    }
    // digits the face sets from the clock every minute (IMG + setProperty MORE) are the Digital time layers
    {
      const dirC = path.join(SCRATCH, 'clockdigits');
      fs.cpSync(v2Dir, dirC, { recursive: true });
      fs.writeFileSync(path.join(dirC, 'watchface', 'index.js'), `
        const D = ['plain.png','plain.png','plain.png','plain.png','plain.png','plain.png','plain.png','plain.png','plain.png','plain.png'].map((n, i) => i ? 'plain' + i + '.png' : n);
        DeviceRuntimeCore.WatchFace({
          init_view() {
            const e = hmSensor.createSensor(hmSensor.id.TIME);
            const a = hmUI.createWidget(hmUI.widget.IMG, { x: 20, y: 30, w: 20, h: 30, src: D[0] });
            const b = hmUI.createWidget(hmUI.widget.IMG, { x: 80, y: 30, w: 80, h: 30, src: D[0] });
            const c = hmUI.createWidget(hmUI.widget.IMG, { x: 20, y: 130, src: D[0] });
            const d = hmUI.createWidget(hmUI.widget.IMG, { x: 80, y: 130, src: D[0] });
            function g() {
              const h = e.format_hour.toString(), m = e.minute.toString();
              a.setProperty(hmUI.prop.MORE, { src: D[h.length == 2 ? h.charAt(0) : 0] });
              b.setProperty(hmUI.prop.MORE, { src: D[h.length == 2 ? h.charAt(1) : h.charAt(0)] });
              c.setProperty(hmUI.prop.MORE, { src: D[m.length == 2 ? m.charAt(0) : 0] });
              d.setProperty(hmUI.prop.MORE, { src: D[m.length == 2 ? m.charAt(1) : m.charAt(0)] });
            }
            e.addEventListener(hmSensor.event.CHANGE, function () { g(); });
            hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, { resume_call: function () { g(); } });
          },
          onInit() { this.init_view(); },
        });
      `);
      for (let i = 1; i < 10; i++) fs.copyFileSync(path.join(dirC, 'assets', fs.readdirSync(path.join(dirC, 'assets')).find((n) => /plain\.png$/.test(n)) || 'plain.png'), path.join(dirC, 'assets', `plain${i}.png`));
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const impC = importFaceDir(dirC);
      const tm = (impC.project ? impC.project.elements : []).filter((e) => e.kind === 'IMG_TIME');
      const hr = tm.find((e) => e.part === 'hour'), mn = tm.find((e) => e.part === 'minute');
      check('clock-driven digit pictures import as hour and minute Digital time layers (no static clipped images)',
        !impC.error && tm.length === 2 && !!hr && !!mn && hr.x === 20 && hr.y === 30 && mn.y === 130 && hr.images.length === 10 && hr.images[7] === 'plain7.png' && hr.zero === 1
        && !(impC.project.elements || []).some((e) => e.kind === 'IMG'),
        impC.error || tm.map((e) => `${e.part}@${e.x},${e.y} sp${e.space}`).join(' '));
    }
    // DATE_POINTER: imported, exported and drawn
    {
      const dirP = path.join(SCRATCH, 'datepointer');
      fs.cpSync(v2Dir, dirP, { recursive: true });
      fs.writeFileSync(path.join(dirP, 'watchface', 'index.js'), `
        DeviceRuntimeCore.WatchFace({
          build() {
            hmUI.createWidget(hmUI.widget.DATE_POINTER, {
              scale_x: 10, scale_y: 20, scale_en: 'plain.png', scale_sc: 'plain.png', scale_tc: 'plain.png',
              center_x: 195, center_y: 225, src: 'plain.png', posX: 3, posY: 40,
              cover_x: 180, cover_y: 210, cover_path: 'plain.png', start_angle: -90, end_angle: 90, type: hmUI.date.WEEK,
            });
          },
        });
      `);
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const gen = require(path.join(__dirname, '..', 'core', 'codegen'));
      const impP = importFaceDir(dirP);
      const dp = (impP.project ? impP.project.elements : []).find((e) => e.kind === 'DATE_POINTER');
      const codeP = dp ? gen.generateWatchface(impP.project, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET)).code : '';
      let synP = true;
      try { new Function(codeP.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { synP = false; }
      const drawn = await run(`
        const e = await addElement('DATE_POINTER', { centerX: 100, centerY: 100, startAngle: -90, endAngle: 90, dateType: 'WEEK' });
        const ok = !!e && e.kind === 'DATE_POINTER' && elBox(e).w > 0;
        project.elements = project.elements.filter((x) => x !== e);
        return ok;`);
      check('a date pointer (DATE_POINTER) imports every parameter, exports them and can be added in the editor',
        !impP.error && !!dp && dp.dateType === 'WEEK' && dp.centerX === 195 && dp.posY === 40 && dp.startAngle === -90 && dp.endAngle === 90 && dp.scaleX === 10 && dp.coverX === 180
        && /widget\.DATE_POINTER/.test(codeP) && /\.WEEK,/.test(codeP) && /posX: px\(3\)/.test(codeP) && /start_angle: -90/.test(codeP) && synP && drawn,
        impP.error || JSON.stringify(dp));
    }
    // IMG_PROGRESS with hand-placed pictures keeps every position
    {
      const dirI = path.join(SCRATCH, 'progresspos');
      fs.cpSync(v2Dir, dirI, { recursive: true });
      fs.writeFileSync(path.join(dirI, 'watchface', 'index.js'), `
        DeviceRuntimeCore.WatchFace({
          build() {
            hmUI.createWidget(hmUI.widget.IMG_PROGRESS, { x: [10, 40, 90], y: [200, 190, 200], image_array: Array(3).fill('plain.png'), image_length: 3, level: 2 });
          },
        });
      `);
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const gen = require(path.join(__dirname, '..', 'core', 'codegen'));
      const impI = importFaceDir(dirI);
      const ip = (impI.project ? impI.project.elements : []).find((e) => e.kind === 'IMG_PROGRESS');
      const codeI = gen.generateWatchface(impI.project, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET)).code;
      check('an image progress with irregular positions keeps each picture where it was and exports the same lists',
        !!ip && Array.isArray(ip.positions) && ip.positions.length === 3 && ip.positions[1][1] === 190 && /x: \[px\(10\), px\(40\), px\(90\)\]/.test(codeI) && /y: \[px\(200\), px\(190\), px\(200\)\]/.test(codeI),
        JSON.stringify(ip && ip.positions));
    }
    // the tool PATH for the Zeus build: a Dock-launched app has no shell PATH, so npx must be found from the usual places
    {
      const { toolPath } = require(path.join(__dirname, '..', 'core', 'toolpath'));
      const have = new Set(['/opt/homebrew/bin', '/Users/x/.volta/bin', '/Users/x/.nvm/versions/node/v18.1.0/bin', '/Users/x/.nvm/versions/node/v20.18.3/bin']);
      const p = toolPath({
        platform: 'darwin', basePath: '/usr/bin:/bin', shellPath: '/Users/x/custom/bin:/usr/bin', home: '/Users/x',
        exists: (q) => have.has(q) || q === '/usr/bin' || q === '/bin', list: () => ['v18.1.0', 'v20.18.3'],
      }).split(':');
      const win = toolPath({ platform: 'win32', basePath: 'C:\\Windows' });
      check('the Zeus build finds npx from a Dock-launched app: shell PATH + Homebrew / Volta / newest nvm, no duplicates',
        p[0] === '/usr/bin' && p.includes('/Users/x/custom/bin') && p.includes('/opt/homebrew/bin') && p.includes('/Users/x/.volta/bin')
        && p.indexOf('/Users/x/.nvm/versions/node/v20.18.3/bin') < p.indexOf('/Users/x/.nvm/versions/node/v18.1.0/bin')
        && new Set(p).size === p.length && win === 'C:\\Windows', p.join(':'));
    }
    // Add and Presets: a search box over a scrolling list, groups hide when empty, Enter picks the first match
    const menus = await run(`
      const r = await API.openProjectPath(${JSON.stringify(path.join(__dirname, '..', 'samples', 'sample-digital'))});
      await loadProject(r);
      const out = {};
      for (const [btn, prefix] of [['btnComponents', 'components'], ['btnPresets', 'presets']]) {
        document.getElementById(btn).click();
        const search = document.getElementById(prefix + 'Search'), list = document.getElementById(prefix + 'List');
        const total = list.querySelectorAll('button').length;
        const focused = document.activeElement === search;
        search.value = prefix === 'presets' ? 'heart' : 'circle'; search.dispatchEvent(new Event('input'));
        const shown = [...list.querySelectorAll('button')].filter((b) => !b.hidden).length;
        const titles = [...list.querySelectorAll('.pm-title')].filter((t) => !t.hidden).length;
        search.value = 'zzzzqq'; search.dispatchEvent(new Event('input'));
        const none = [...list.querySelectorAll('button')].every((b) => b.hidden) && !document.getElementById(prefix + 'Empty').hidden;
        search.value = ''; search.dispatchEvent(new Event('input'));
        const back = [...list.querySelectorAll('button')].filter((b) => !b.hidden).length === total;
        const scroll = getComputedStyle(list).overflowY === 'auto';
        out[prefix] = { total, focused, shown, titles, none, back, scroll };
        document.getElementById(btn).click();
      }
      return out;`);
    check('the Add and Presets menus have a search box (focused on open) over a scrolling list; groups hide when empty',
      Object.values(menus).every((m) => m.total > 10 && m.focused && m.shown >= 1 && m.shown < m.total && m.titles >= 1 && m.titles <= 2 && m.none && m.back && m.scroll), JSON.stringify(menus));
    // build tools: Node / npx / Zeus status comes back and the panel says what the build will do
    const tools = await run(`
      const t = await API.toolsStatus();
      const r = await API.openProjectPath(${JSON.stringify(path.join(__dirname, '..', 'samples', 'sample-digital'))});
      await loadProject(r);
      const shown = await refreshTools();
      return { t, text: document.getElementById('toolsInfo').textContent, install: !document.getElementById('btnInstallZeus').hidden, hasApi: typeof API.installZeus === 'function' };`);
    check('the build-tools row reports Node / npx / Zeus and offers to install Zeus only when Node is there and Zeus is not',
      tools.hasApi && 'node' in tools.t && 'npx' in tools.t && 'zeus' in tools.t && /Node|not found/.test(tools.text) && !/\u001b|node:/.test(tools.text) && (!tools.t.zeus || /^\d+\.\d+/.test(tools.t.zeus))
      && tools.install === !!(tools.t.node && tools.t.npx && !tools.t.zeus), JSON.stringify(tools));
    // app updates: which installs update themselves, the check → download → install flow, skipping a version
    {
      const { createUpdater, installMode, compareVersions, releaseUrl } = require(path.join(__dirname, '..', 'core', 'updater'));
      const EventEmitter = require('events');
      const mode = (platform, env, isPackaged = true) => installMode({ platform, env, isPackaged });
      const fake = () => {
        const u = new EventEmitter();
        u.calls = [];
        u.checkForUpdates = async () => { u.calls.push('check'); u.emit('checking-for-update'); u.emit('update-available', u.next || { version: '0.9.0', releaseNotes: '<p>Hi</p>' }); };
        u.downloadUpdate = async () => { u.calls.push('download'); u.emit('download-progress', { percent: 50 }); u.emit('update-downloaded', {}); };
        u.quitAndInstall = (...a) => u.calls.push('install ' + a.join());
        return u;
      };
      const mk = (over = {}) => {
        const store = { skip: '' }, sent = [], opened = [];
        const au = over.au || fake();
        const up = createUpdater({
          autoUpdater: au, currentVersion: '0.2.5', platform: over.platform || 'win32', env: over.env || {}, isPackaged: over.isPackaged !== false,
          repo: 'o/r', openExternal: (u) => opened.push(u), send: (st) => sent.push(st.status), settings: { get: () => store, set: (p) => Object.assign(store, p) },
        });
        return { up, au, store, sent, opened };
      };
      const A = mk();
      await A.up.check({ manual: true });
      const sAvail = A.up.state();
      await A.up.download();
      const sReady = A.up.state();
      A.up.install();
      const B = mk({ platform: 'darwin' });
      await B.up.check({ manual: true });
      await B.up.download();
      const C = mk();
      await C.up.check({ manual: true });
      C.up.skip();
      const quiet = (await C.up.check({ manual: false }), C.up.state().status);
      const loud = (await C.up.check({ manual: true }), C.up.state().status);
      const D = mk(); D.au.next = { version: '0.2.5' };
      await D.up.check({ manual: true });
      const E2 = mk(); E2.au.checkForUpdates = async () => { E2.au.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED\nstack')); };
      await E2.up.check({ manual: false }); const bgErr = E2.up.state().status;
      await E2.up.check({ manual: true }); const fgErr = E2.up.state();
      const F = mk({ isPackaged: false }); await F.up.check({ manual: true });
      check('updates: auto on a Windows installer / AppImage, manual on mac / portable / deb, off in a dev run; check → download → install; skip; quiet background errors',
        mode('win32', {}) === 'auto' && mode('win32', { PORTABLE_EXECUTABLE_FILE: 'x' }) === 'manual' && mode('linux', { APPIMAGE: '/a' }) === 'auto' && mode('linux', {}) === 'manual'
        && mode('darwin', {}) === 'manual' && mode('win32', {}, false) === 'off'
        && compareVersions('0.2.5', '0.2.10') === -1 && compareVersions('0.3.0', '0.2.9') === 1 && compareVersions('1.0.0-beta', '1.0.0') === -1 && compareVersions('0.2', '0.2.0') === 0
        && sAvail.status === 'available' && sAvail.version === '0.9.0' && !/<p>/.test(sAvail.notes) && sReady.status === 'ready' && A.au.calls.join('|') === 'check|download|install false,true'
        && B.up.state().mode === 'manual' && B.opened[0] === releaseUrl('o/r', '0.9.0') && !B.au.calls.includes('download')
        && quiet === 'none' && loud === 'available' && D.up.state().status === 'none'
        && bgErr === 'idle' && fgErr.status === 'error' && !/stack/.test(fgErr.error) && F.up.state().status === 'none' && F.up.mode === 'off',
        JSON.stringify({ sAvail: sAvail.status, sReady: sReady.status, calls: A.au.calls, B: B.up.state().mode, opened: B.opened, quiet, loud, D: D.up.state().status, bgErr, fgErr: fgErr.status }));
    }
    // the update banner: what each state shows
    const bar = await run(`
      const out = {};
      const st = (o) => ({ status: 'none', current: '0.2.5', mode: 'auto', version: null, progress: 0, auto: true, ...o });
      const read = () => ({ hidden: document.getElementById('updateBar').hidden, text: document.getElementById('updateText').textContent, dl: !document.getElementById('updateDownload').hidden, dlText: document.getElementById('updateDownload').textContent, inst: !document.getElementById('updateInstall').hidden, skip: !document.getElementById('updateSkip').hidden });
      renderUpdate(st({ status: 'available', version: '0.3.0' })); out.avail = read();
      renderUpdate(st({ status: 'available', version: '0.3.0', mode: 'manual' })); out.manual = read();
      renderUpdate(st({ status: 'downloading', version: '0.3.0', progress: 40 })); out.down = read();
      renderUpdate(st({ status: 'ready', version: '0.3.0' })); out.ready = read();
      renderUpdate(st({ status: 'none' })); out.none = read();
      out.version = document.getElementById('appVersion').textContent;
      return out;`);
    check('the update banner offers Download (installs) or Open release page (mac / portable), shows progress, then Restart to install; hidden when up to date',
      !bar.avail.hidden && /0\.3\.0 is available/.test(bar.avail.text) && bar.avail.dl && bar.avail.dlText === 'Download' && bar.avail.skip
      && bar.manual.dlText === 'Open release page' && /by hand/.test(bar.manual.text) && /40%/.test(bar.down.text) && !bar.down.dl
      && bar.ready.inst && !bar.ready.dl && bar.none.hidden && /0\.2\.5/.test(bar.version), JSON.stringify(bar));
    // the colour-theme dialog: chips from a chosen palette, custom colours added and removed
    const thUi = await run(`
      const r = await API.openProjectPath(${JSON.stringify(path.join(__dirname, '..', 'samples', 'sample-digital'))});
      await loadProject(r);
      openThemes();
      const first = themeChips.map((c) => c.name + ':' + c.color).join(',');
      const sel = document.getElementById('themePaletteSel');
      sel.value = '1'; sel.onchange();
      const dracula = themeChips.length;
      document.getElementById('themeCustomColor').value = '#123456';
      document.getElementById('themeCustomName').value = 'Mine';
      document.getElementById('themeCustomAdd').click();
      const hasCustom = themeChips.some((c) => c.custom && c.name === 'Mine' && c.color === '#123456');
      sel.value = '2'; sel.onchange();
      const keepsCustom = themeChips.some((c) => c.custom && c.name === 'Mine') && themeChips.length > 1;
      const chipEls = document.querySelectorAll('#themePalette .theme-chip').length === themeChips.length;
      document.getElementById('themeModal').hidden = true;
      return { first, dracula, hasCustom, keepsCustom, chipEls, name: colorName('#ffc700') };`);
    check('the colour-theme dialog builds its colours from the chosen palette, keeps custom colours across palette changes',
      /Orange:#ff4a1c/.test(thUi.first) && /Pink:#ff7aa8/.test(thUi.first) && thUi.dracula === 6 && thUi.hasCustom && thUi.keepsCustom && thUi.chipEls && thUi.name === 'Yellow', JSON.stringify(thUi));
    // tap zones that open a system app (launchApp + SYSTEM_APP_*) or a named screen
    {
      const dirT = path.join(SCRATCH, 'sysapp');
      fs.cpSync(v2Dir, dirT, { recursive: true });
      fs.writeFileSync(path.join(dirT, 'watchface', 'index.js'), `
        DeviceRuntimeCore.WatchFace({
          build() {
            hmUI.createWidget(hmUI.widget.BUTTON, { x: 10, y: 10, w: 80, h: 60, text: '', normal_src: 'plain.png', press_src: 'plain.png', click_func: () => { launchApp({ appId: SYSTEM_APP_HR, native: true }) } });
            hmUI.createWidget(hmUI.widget.BUTTON, { x: 100, y: 10, w: 80, h: 60, text: '', normal_src: 'plain.png', press_src: 'plain.png', click_func: () => { hmApp.startApp({ url: 'heart_app_Screen', native: true }) } });
          },
        });
      `);
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const gen = require(path.join(__dirname, '..', 'core', 'codegen'));
      const { SYSTEM_APPS, TAP_APPS } = require(path.join(__dirname, '..', 'core', 'datatypes'));
      const impT = importFaceDir(dirT);
      const taps = (impT.project ? impT.project.elements : []).filter((e) => e.kind === 'TAP');
      const dev = require(path.join(__dirname, '..', 'core', 'devices'));
      const outT = gen.generateWatchface(impT.project, dev.deviceByKey('bip-6'));
      const oldT = gen.generateWatchface(impT.project, dev.deviceByKey('gtr-3-pro'));
      let synT = true;
      try { new Function(outT.code.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { synT = false; }
      check('tap zones: 39 documented system apps + named screens; launchApp imported only when used; a pick imports back',
        SYSTEM_APPS.length === 39 && TAP_APPS.length >= 60 && taps.length === 2 && taps[0].action === 'sysapp' && taps[0].sysApp === 'SYSTEM_APP_HR' && taps[1].action === 'app' && taps[1].appUrl === 'heart_app_Screen'
        && /import \{ launchApp, SYSTEM_APP_HR \} from '@zos\/router'/.test(outT.code) && /launchApp\(\{ appId: SYSTEM_APP_HR, native: true \}\)/.test(outT.code)
        && outT.warnings.some((w) => /@zos\/router/.test(w)) && !/@zos\/router/.test(oldT.code) && oldT.warnings.some((w) => /API 3\.0/.test(w)) && synT,
        impT.error || JSON.stringify({ n: SYSTEM_APPS.length, a: TAP_APPS.length, taps: taps.map((t) => [t.action, t.sysApp, t.appUrl]), imp: (outT.code.match(/import .*router.*/) || [])[0], call: /launchApp\(\{ appId: SYSTEM_APP_HR, native: true \}\)/.test(outT.code), w: outT.warnings, old: /@zos\/router/.test(oldT.code), oldw: oldT.warnings, synT }));
    }
    // GRADKIENT_POLYLINE: the firmware-drawn heart / sleep line chart
    {
      const dirG = path.join(SCRATCH, 'polyline');
      fs.cpSync(v2Dir, dirG, { recursive: true });
      fs.writeFileSync(path.join(dirG, 'watchface', 'index.js'), `
        DeviceRuntimeCore.WatchFace({
          build() {
            hmUI.createWidget(hmUI.widget.GRADKIENT_POLYLINE, { x: 20, y: 300, w: 200, h: 80, type: hmUI.data_type.HEART });
            hmUI.createWidget(hmUI.widget.GRADKIENT_POLYLINE, { x: 20, y: 200, w: 100, h: 60 });
          },
        });
      `);
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const gen = require(path.join(__dirname, '..', 'core', 'codegen'));
      const impG = importFaceDir(dirG);
      const pl = (impG.project ? impG.project.elements : []).filter((e) => e.kind === 'POLYLINE');
      const codeG = gen.generateWatchface(impG.project, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET)).code;
      let synG = true;
      try { new Function(codeG.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { synG = false; }
      check('the heart / sleep line chart (GRADKIENT_POLYLINE) imports when the firmware draws it and exports with its type; one drawn by code is reported',
        !impG.error && pl.length === 1 && pl[0].dataType === 'HEART' && pl[0].w === 200 && /GRADKIENT_POLYLINE/.test(codeG) && /type: ui\.data_type\.HEART/.test(codeG) && synG
        && /GRADKIENT_POLYLINE \(data drawn by code\)/.test(impG.report.join('\n')),
        impG.error || JSON.stringify(pl));
    }
    // the smaller documented parameters: text_style, hand caps, imperial units, fixed text, visible buttons
    {
      const dirQ = path.join(SCRATCH, 'smallparams');
      fs.cpSync(v2Dir, dirQ, { recursive: true });
      fs.writeFileSync(path.join(dirQ, 'watchface', 'index.js'), `
        DeviceRuntimeCore.WatchFace({
          build() {
            hmUI.createWidget(hmUI.widget.TEXT, { x: 10, y: 10, w: 200, h: 40, text: 'A very long text', text_size: 24, color: 0xffffff, text_style: hmUI.text_style.ELLIPSIS });
            hmUI.createWidget(hmUI.widget.TIME_POINTER, {
              hour_centerX: 195, hour_centerY: 225, hour_posX: 5, hour_posY: 60, hour_path: 'plain.png',
              minute_centerX: 195, minute_centerY: 225, minute_posX: 5, minute_posY: 80, minute_path: 'plain.png', minute_cover_path: 'plain.png',
              second_centerX: 195, second_centerY: 225, second_posX: 3, second_posY: 90, second_path: 'plain.png', second_cover_path: 'plain.png',
            });
            hmUI.createWidget(hmUI.widget.TEXT_IMG, {
              x: 50, y: 50, font_array: Array(10).fill('plain.png'), type: hmUI.data_type.DISTANCE, unit_en: 'plain.png', imperial_unit_en: 'plain.png', invalid_image: 'plain.png', h_space: 2,
            });
            hmUI.createWidget(hmUI.widget.TEXT_IMG, { x: 50, y: 90, font_array: Array(10).fill('plain.png'), text: '1234', h_space: 2 });
            hmUI.createWidget(hmUI.widget.BUTTON, {
              x: 20, y: 300, w: 120, h: 50, text: 'Go', color: 0xffffff, text_size: 24, normal_color: 0x333333, press_color: 0x666666, radius: 12,
              click_func: () => { hmApp.startApp({ url: 'ScheduleCalScreen', native: true }) },
            });
          },
        });
      `);
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const gen = require(path.join(__dirname, '..', 'core', 'codegen'));
      const impQ = importFaceDir(dirQ);
      const E = impQ.project ? impQ.project.elements : [];
      const codeQ = gen.generateWatchface(impQ.project, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET)).code;
      let synQ = true;
      try { new Function(codeQ.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { synQ = false; }
      const tp = E.find((e) => e.kind === 'TIME_POINTER'), ti = E.filter((e) => e.kind === 'TEXT_IMG'), btn = E.find((e) => e.kind === 'TAP');
      check('smaller documented parameters survive import and export (text_style, hand caps, imperial unit, fixed text, visible button)',
        !impQ.error && E.find((e) => e.kind === 'TEXT').textStyle === 'ELLIPSIS' && !!tp.minuteCover && !!tp.secondCover && !!ti[0].unitImperial && !!ti[0].invalid && ti[1].text === '1234'
        && !!btn && btn.text === 'Go' && btn.normalColor === '#333333' && btn.radius === 12
        && /text_style: ui\.text_style\.ELLIPSIS/.test(codeQ) && /minute_cover_path/.test(codeQ) && /second_cover_path/.test(codeQ)
        && /imperial_unit_en/.test(codeQ) && /invalid_image/.test(codeQ) && /text: "1234"/.test(codeQ)
        && /normal_color: 0x333333/.test(codeQ) && /press_color: 0x666666/.test(codeQ) && /radius: px\(12\)/.test(codeQ) && /text: "Go"/.test(codeQ) && synQ,
        impQ.error || `syntax ${synQ}`);
    }
    // an editable complication slot: choices import as layers that show for one choice only
    {
      const dirE = path.join(SCRATCH, 'editslot');
      fs.cpSync(v2Dir, dirE, { recursive: true });
      fs.writeFileSync(path.join(dirE, 'watchface', 'index.js'), `
        DeviceRuntimeCore.WatchFace({
          build() {
            hmUI.createWidget(hmUI.widget.IMG, { x: 0, y: 0, src: 'plain.png' });
            const slot = hmUI.createWidget(hmUI.widget.WATCHFACE_EDIT_GROUP, {
              edit_id: 1, x: 297, y: 213, w: 54, h: 29, default_type: hmUI.edit_type.STEP,
              optional_types: [{ type: hmUI.edit_type.STEP, preview: 'plain.png' }, { type: hmUI.edit_type.HEART, preview: 'plain.png' }],
              count: 2, tips_BG: 'plain.png', tips_x: 0, tips_y: -5, tips_width: 54, tips_margin: 10,
            });
            const editType = slot.getProperty(hmUI.prop.CURRENT_TYPE);
            switch (editType) {
              case hmUI.edit_type.STEP:
                hmUI.createWidget(hmUI.widget.IMG, { x: 331, y: 212, src: 'plain.png' });
                break;
              case hmUI.edit_type.HEART:
                hmUI.createWidget(hmUI.widget.IMG, { x: 298, y: 212, src: 'plain.png' });
                break;
            }
            hmUI.createWidget(hmUI.widget.WATCHFACE_EDIT_MASK, { x: 0, y: 0, w: 390, h: 450, src: 'plain.png', show_level: hmUI.show_level.ONLY_EDIT });
            hmUI.createWidget(hmUI.widget.IMG, { x: 5, y: 5, src: 'plain.png' });
          },
        });
      `);
      const { importFaceDir } = require(path.join(__dirname, '..', 'core', 'importface'));
      const gen = require(path.join(__dirname, '..', 'core', 'codegen'));
      const impE = importFaceDir(dirE);
      const elsE = impE.project ? impE.project.elements : [];
      const slot = elsE.find((e) => e.kind === 'EDIT_SLOT');
      const kids = elsE.filter((e) => e.editSlot != null);
      const order = elsE.map((e) => e.kind + (e.editType ? ':' + e.editType : '')).join(' ');
      const mask = elsE.find((e) => e.name === 'Edit mask');
      check('a complication slot imports its choices as layers shown for one choice each',
        !impE.error && !!slot && slot.editId === 1 && slot.optionalTypes.length === 2 && slot.defaultType === 'STEP'
        && kids.length === 2 && kids.find((k) => k.editType === 'STEP').x === 331 && kids.find((k) => k.editType === 'HEART').x === 298
        && !!mask && mask.show === 'edit' && /EDIT_SLOT IMG:STEP IMG:HEART IMG IMG/.test(order),
        impE.error || order);
      const jsE = gen.generateWatchface(impE.project, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET)).code;
      const appE = JSON.parse(gen.generateAppJson(impE.project, require(path.join(__dirname, '..', 'core', 'devices')).deviceByKey(TARGET)));
      let synE = true;
      try { new Function(jsE.replace(/^import .*$/gm, '').replace(/WatchFace\(\{/, 'const _w = ({')); } catch (e) { synE = false; }
      check('a complication slot exports the edit group, a switch on the pick, and editable in app.json',
        /widget\.WATCHFACE_EDIT_GROUP/.test(jsE) && /case H\.edit_type\.STEP:/.test(jsE) && /case H\.edit_type\.HEART:/.test(jsE)
        && /getProperty\(H\.prop\.CURRENT_TYPE\)/.test(jsE) && /catch \(e\) \{\}/.test(jsE) && appE.targets[TARGET].module.watchface.editable === 1 && synE,
        `editable ${appE.targets[TARGET].module.watchface.editable} · syntax ${synE}`);
      check('edit masks export as mask widgets (an IMG would also draw in the normal face)',
        /WATCHFACE_EDIT_MASK/.test(jsE) && !/ui\.widget\.IMG, \{[^}]*ONLY_EDIT/.test(jsE),
        (jsE.match(/WATCHFACE_EDIT_\w*MASK/g) || []).join(','));
    }
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
