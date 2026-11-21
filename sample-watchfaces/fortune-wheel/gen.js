// Fortune Wheel: a glossy wheel of answers behind the time (after a Wear OS face). Every time the watch wakes up the wheel spins once: it speeds up,
// slows down and stops with a random card centred under the pointer, then stays still until the next wake-up.
// Same technique as the "Smooth second hand" preset: one picture turned by the watch itself (setProperty(prop.ANIM) with anim_prop ANGLE),
// pivot written as centerX / centerY, the running animation stopped (ANIM_STATUS) before a new one and when the screen goes off.
// Pictures from build/ (prep.py: Nano Banana cards bent into 12 equal slices, words written by prep.py, keyed dial / plate). Time, date, battery native.
const fs = require('fs');
const B = __dirname + '/build/', meta = JSON.parse(fs.readFileSync(B + 'wheel.json', 'utf8'));
const has = (f) => fs.existsSync(B + f);
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(B + f).toString('base64');
const CX = 195, CY = 225, R = meta.R, PTR = 90;              // pivot, wheel radius, pointer direction (clockwise from the top: 3 o'clock)
const REST0 = PTR - meta.centres[2];                          // the still picture: MAYBE under the pointer, as in the reference (15 degrees)
const COLX = 84;                                              // centre of the time column
const ROW = { day: 82, date: 110.5, pow: 339.5, val: 367.5 };       // centre lines of the small rows (measured and corrected after each run)
const IMGSTEP = (f, name, x, y, extra) => ({ script: `const im = new Image(); im.src = '${b64(f)}'; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0);
  const n = addProjectImage('fw/${f}', c, {}).name; await loadAllImages(); const e = await addElement('IMG', { src: n }); e.name = '${name}'; e.src = n; e.x = ${x}; e.y = ${y}; e.show = 'normal'; Object.assign(e, ${JSON.stringify(extra || {})}); return n` });
const F = 'Open Sans Regular', TXT = { font: F, fill: 'solid', color: '#ffffff' }, BIG = 112, SMALL = 28;
const steps = [
  { script: `project.appId = ${Number(process.env.APP_ID || 1133670)}; return 1` },
  { script: `await registerCustomFont({ name: 'open-sans-400.ttf', family: 'Open Sans Regular', format: 'truetype', ext: '.ttf', dataBase64: '${fs.readFileSync(B + 'open-sans-400.ttf').toString('base64')}' }); return 1` },
  { preset: 'bg' },
  IMGSTEP('wheel.png', 'Wheel', 0, 0, { handle: 'wheel', centerX: CX, centerY: CY, w: 0, h: 0, angle: REST0 }),
  IMGSTEP('cover.png', 'Cover', 0, 0),
  ...(has('plate.png') ? [IMGSTEP('plate.png', 'Centre plate', CX - 40, CY - 40)] : []),
  IMGSTEP('dial.png', 'Dial', CX - (meta.dial - 1) / 2, CY - (meta.dial - 1) / 2),
  { preset: 'clock' },
  { script: `const n = project.elements.length; for (const i of [n - 3, n - 2, n - 1]) project.elements[i].name += ' Aod'; return 1` },
  { preset: 'clock' }, { preset: 'day' }, { preset: 'month' }, { preset: 'weekday' }, { preset: 'battery' },
  { script: `project.elements = project.elements.filter((e) => !/^Colon/.test(e.name)); project.groups = project.groups || {}; project.groups.gClockAod = 'Clock AOD'; for (const e of project.elements) if (/ Aod$/.test(e.name)) e.group = 'gClockAod'; return project.elements.map((e) => e.name).join(',')` },
  { edit: 'Hour', set: { show: 'normal', zero: 1, alignH: 'CENTER_H' }, glyph: { ...TXT, size: BIG } },
  { edit: 'Minute', set: { show: 'normal', zero: 1, alignH: 'CENTER_H' }, glyph: { ...TXT, size: BIG } },
  { edit: 'Hour Aod', set: { show: 'aod', zero: 1, alignH: 'CENTER_H' }, glyph: { ...TXT, color: '#8c8c8c', size: BIG } },
  { edit: 'Minute Aod', set: { show: 'aod', zero: 1, alignH: 'CENTER_H' }, glyph: { ...TXT, color: '#8c8c8c', size: BIG } },
  { edit: 'Day', set: { show: 'normal' }, glyph: { ...TXT, size: SMALL } },
  { edit: 'Month', set: { show: 'normal', isCharacter: true, part: 'month' }, glyph: { ...TXT, size: SMALL } },
  { edit: 'Weekday', set: { show: 'normal' }, glyph: { ...TXT, size: SMALL } },
  { edit: 'Battery', set: { show: 'normal', alignH: 'CENTER_H', unit: '' }, glyph: { ...TXT, size: SMALL } },
  { script: fs.readFileSync(__dirname + '/../../.claude/skills/create-amazfit-watchface/examples/animated/kit.js', 'utf8') + `
    const mkTxt = async (name, s, size) => { await document.fonts.load(size + 'px "${F}"'); const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = size + 'px "${F}"';
      c.width = Math.ceil(g.measureText(s).width) + 4; c.height = Math.ceil(size * 1.4); const g2 = c.getContext('2d'); g2.font = size + 'px "${F}"'; g2.fillStyle = '#fff'; g2.fillText(s, 2, size);
      const n = addProjectImage('fw/' + name + '.png', c, {}).name; await loadAllImages(); const e = await addElement('IMG', { src: n }); e.name = name; e.src = n; e.show = 'normal'; return e; };
    await mkTxt('Slash', '/', ${SMALL}); await mkTxt('Power', 'POWER', ${SMALL});
    const mo = E('Month'); mo.isCharacter = true; mo.part = 'month'; rememberGlyphStyle(mo, ${SMALL}); mo.images = await genLabelSet(mo, 'month');
    E('Day').space = -4; E('Battery').hSpace = -4; E('Battery').space = -4;
    rerenderGlyphLayers(); await loadAllImages();
    // digits: the box (two digits wide) centred on the column, so the time stays put whatever the digits; rows from measured ink
    for (const n of ['Hour', 'Minute', 'Hour Aod', 'Minute Aod']) { const e = E(n); const b = elBox(e); e.x = Math.round(${COLX} - b.w / 2); }
    E('Hour').y = E('Hour Aod').y = ${process.env.HY || 132}; E('Minute').y = E('Minute Aod').y = ${process.env.MY || 226};
    park(['Day', 'Month', 'Slash', 'Weekday', 'Power', 'Battery']);
    await align(['Day'], { cx: ${COLX}, cy: ${ROW.day} });
    let x = 0; for (const [n, gap] of [['Month', 2], ['Slash', 2], ['Weekday', 0]]) { await align([n], { l: x, cy: ${ROW.date} }); const b = await inkBox([n]); x = b.r + gap; }
    await align(['Month', 'Slash', 'Weekday'], { cx: ${COLX}, cy: ${ROW.date} });
    await align(['Power'], { cx: ${COLX}, cy: ${ROW.pow} }); await align(['Battery'], { cx: ${COLX}, cy: ${ROW.val} });
    project.groups.gClock = 'Clock'; project.groups.gDate = 'Date'; project.groups.gPower = 'Power'; project.groups.gWheel = 'Wheel';
    for (const [g, list] of [['gClock', ['Minute', 'Hour']], ['gDate', ['Day', 'Month', 'Slash', 'Weekday']], ['gPower', ['Power', 'Battery']], ['gWheel', ['Wheel', 'Cover', 'Centre plate', 'Dial']]]) for (const n of list) if (E(n)) E(n).group = g;
    return 1` },
];
const userCode = `{
  // Fortune wheel. Every time the watch wakes up the wheel spins ONCE: it speeds up (1 s), slows down (3.8 s) and stops with a random card centred
  // under the pointer at 3 o'clock, then stays still until the next wake-up. The watch turns the picture itself (anim_steps on prop.ANGLE, like the
  // smooth second hand preset); the landing angle is chosen first, so the wheel always stops exactly on a card centre. The running animation is stopped
  // (ANIM_STATUS) before a new one starts and when the screen goes off, and the wheel is then set straight to its landing angle.
  const CEN = ${JSON.stringify(meta.centres)}, PTR = ${PTR}
  let aid = null, timer = null, rest = ${REST0}
  const kill = () => {
    try { if (aid != null && W.wheel && ui.anim_status) W.wheel.setProperty(ui.prop.ANIM_STATUS, { anim_id: aid, anim_status: ui.anim_status.STOP }) } catch (e) {}
    aid = null
    if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null }
  }
  const spin = () => {
    const h = W.wheel; if (!h) return
    kill()
    const k = Math.floor(Math.random() * CEN.length)
    const target = (((PTR - CEN[k]) % 360) + 360) % 360
    const total = ((target - rest) % 360 + 360) % 360 + 360 * (3 + Math.floor(Math.random() * 2))
    const a0 = rest, a1 = rest + total * 0.2, a2 = rest + total
    rest = target
    try {
      if (!ui.prop.ANIM) throw new Error('no ANIM')
      aid = h.setProperty(ui.prop.ANIM, { anim_steps: [
        { anim_prop: ui.prop.ANGLE, anim_from: a0, anim_to: a1, anim_rate: 'easein', anim_duration: 1000, anim_offset: 0 },
        { anim_prop: ui.prop.ANGLE, anim_from: a1, anim_to: a2, anim_rate: 'easeout', anim_duration: 3800, anim_offset: 1000 } ], anim_fps: 25, anim_repeat: 0 })
    } catch (e) { try { h.setProperty(ui.prop.ANGLE, target) } catch (e2) {} }
    timer = setTimeout(() => { timer = null; aid = null; try { h.setProperty(ui.prop.ANGLE, target) } catch (e) {} }, 4850)
  }
  const stop = () => { kill(); try { W.wheel.setProperty(ui.prop.ANGLE, rest) } catch (e) {} }
  const start = () => { try { spin() } catch (e) {} }
  start()
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: stop, resume_call: start })
}`;
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Fortune Wheel', device: 'bip-6', language: 'en-US', font: F, optimizePng: 64,
  description: 'A glossy wheel of answers behind the time: every time the watch wakes up it spins once, speeds up, slows down and stops on a random answer.',
  preview: 'preview.png', previewAod: 'preview-aod.png', showcase: 'showcase.gif', save: 'project', out: 'out/fortune-wheel', userCode, steps }, null, 1));
