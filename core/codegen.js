'use strict';
// Zeus CLI project generator: designer model -> app.json + app.js + watchface JS.
//
// The generated watchface follows the v3 shape used by the official samples
// (zepp-health/zeppos-samples, watchface/3.0/timer): `WatchFace({...})` with
// `@zos/ui` widgets, `px()` scaled coordinates (designWidth = screen width) and
// `show_level` per widget for the normal / AOD / edit states.
//
// Widget parameters are documented at https://docs.zepp.com/docs/watchface/api/hmUI/widget/
const path = require('path');
const { deviceByKey, platformsFor } = require('./devices');
const { dataType, DT_MAX } = require('./datatypes');
const { apiVersionFor } = require('./fonts');

function hexToNum(hex) {
  const s = String(hex || '#ffffff').replace('#', '');
  const v = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return Number.isFinite(v) ? v : 0xffffff;
}
function num(n) { return Number.isFinite(+n) ? Math.round(+n) : 0; }
function p(n) { return `px(${num(n)})`; }
function ident(s) { return String(s || 'x').replace(/[^\w]+/g, '_').replace(/^(\d)/, '_$1'); }
// IMG_ANIM finds its frames by name: <anim_path>/<anim_prefix>_<index>.<anim_ext>.
// The prefix is therefore also the frame file's stem, so keep it [\w] and stable
// for a given layer; writeZeusProject() names the exported frames with it.
function animPrefixFor(el) { return ident((el && el.animPrefix) || (el && el.name)).toLowerCase(); }
// hmUI.show_level is a bitmask: ONLY_NORMAL 1, ONLY_AOD 2, ONLY_EDIT 4 (the docs
// also spell the AOD bit ONAL_AOD — same value, the watchface typedefs and every
// shipping face use ONLY_AOD)
function showLevel(show) {
  switch (show) {
    case 'aod': return 'ui.show_level.ONLY_AOD';
    case 'edit': return 'ui.show_level.ONLY_EDIT';
    case 'normal': return 'ui.show_level.ONLY_NORMAL';
    default: return 'ui.show_level.ONLY_NORMAL | ui.show_level.ONLY_AOD';
  }
}
// image names are stored as `images/<name>` in the model; the watch reads them
// relative to the target asset root, so the code uses a tiny path helper
// image names come from uploads and imported faces, so they are quoted as JS
// string literals — a stray quote must never break the generated code
function q(s) { return `'${String(s).replace(/[\\']/g, '\\$&').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`; }
function A(name) { return `A(${q(name)})`; }
function asset(el, key) {
  const name = el[key];
  return name ? A(name) : null;
}
function validHandle(h) { return typeof h === 'string' && /^[A-Za-z_$][\w$]*$/.test(h) && !['W', 'F'].includes(h); }
function arrName(el) { return `img_${ident(el.name)}_${el.id.slice(-4)}`; }

// A widget that has lost its picture would be built with a reference to an
// image the package does not contain — the watch then fails to initialise the
// face, taking every widget after it down as well. Those layers are reported
// and left out of the code instead.
function missingPicture(el) {
  switch (el.kind) {
    case 'IMG': return !el.src && !variantsOf(el);
    case 'IMG_POINTER': case 'DATE_POINTER': return !el.src;
    case 'IMG_ANIM': return !(el.frames || []).length;
    case 'IMG_LEVEL': case 'IMG_PROGRESS': case 'TEXT_IMG': return !(el.images || []).length;
    default: return false;
  }
}

// The TEXT widget only takes a flat `color` (plus text_size / font / spacing —
// see the docs link above). A gradient fill, an outline, bold or italic exist
// only in the designer, so those layers are rasterised by the renderer into a
// transparent PNG and emitted as an IMG instead. Keep in sync with
// needsTextBake() in renderer.js.
function needsTextBake(el) {
  if (!el || el.kind !== 'TEXT') return false;
  const fill = el.fillType || 'solid';
  return fill !== 'solid' || !!el.bold || !!el.italic || (+el.borderWidth || 0) > 0 || !!(+el.shadowX || +el.shadowY || +el.shadowBlur);
}
function bakeReason(el) {
  const why = [];
  if ((el.fillType || 'solid') === 'gradient') why.push('gradient fill');
  else if ((el.fillType || 'solid') === 'css') why.push('CSS gradient fill');
  else if ((el.fillType || 'solid') === 'outline') why.push('outline fill');
  if (el.bold) why.push('bold');
  if (el.italic) why.push('italic');
  if ((+el.borderWidth || 0) > 0) why.push('border');
  if (+el.shadowX || +el.shadowY || +el.shadowBlur) why.push('shadow');
  return why.join(' + ') || 'styled text';
}

// one line of `key: value,` when the value is present
function kv(lines, key, value, when = true) {
  if (!when || value === null || value === undefined || value === '') return;
  lines.push(`    ${key}: ${value},`);
}

// an Image layer with two or more pictures is a variants layer: a Tap zone cycles them
function variantsOf(el) {
  return el && el.kind === 'IMG' && Array.isArray(el.images) && el.images.filter(Boolean).length >= 2 ? el.images.filter(Boolean) : null;
}
// a variants layer can follow the time of day: variantHours holds the hour (0-24, fractions allowed) each picture starts at
function hoursOf(el) {
  const v = variantsOf(el);
  const h = el && el.variantHours;
  return v && Array.isArray(h) && h.length === v.length && h.every((x) => Number.isFinite(+x)) ? h.map(Number) : null;
}
function emitElement(el, ctx, out) {
  const { arrays } = ctx;
  const variants = variantsOf(el);
  if (variants && el.show === 'aod') el = { ...el, src: variants[0] };   // AOD keeps the first picture
  const L = [];
  const sl = `show_level: ${showLevel(el.show)}`;
  const alpha = el.alpha != null && el.alpha < 255 ? `alpha: ${Math.max(0, num(el.alpha))},` : null;

  // a box behind the text (its rectangle is stamped by the designer at export time)
  if (el.boxOn && el.boxRect) {
    const r = el.boxRect, B = [];
    B.push(`  // box behind ${ident(el.name)}`);
    B.push('  ui.createWidget(ui.widget.FILL_RECT, {');
    kv(B, 'x', p(r.x)); kv(B, 'y', p(r.y)); kv(B, 'w', p(r.w)); kv(B, 'h', p(r.h));
    if (+el.boxRadius) kv(B, 'radius', p(el.boxRadius));
    kv(B, 'color', `0x${hexToNum(el.boxColor || '#000000').toString(16).padStart(6, '0')}`);
    const op = Math.max(0, Math.min(100, el.boxOpacity == null ? 60 : +el.boxOpacity));
    if (op < 100) kv(B, 'alpha', Math.round(op * 2.55));
    kv(B, 'show_level', showLevel(el.show));
    out.push(B.join('\n') + '\n  })');
  }

  switch (el.kind) {
    case 'POLYLINE': {
      // the firmware draws the line for the reading (docs: only HEART and SLEEP are supported); the
      // docs spell the widget GRADKIENT_POLYLINE
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y)); kv(L, 'w', p(el.w || 200)); kv(L, 'h', p(el.h || 80));
      kv(L, 'type', `ui.data_type.${el.dataType === 'SLEEP' ? 'SLEEP' : 'HEART'}`);
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  try { ui.createWidget(ui.widget.GRADKIENT_POLYLINE, {\n${L.join('\n')}\n  }) } catch (e) {}`);
      break;
    }
    case 'SLEEP_CHART': {
      // A GROUP the face fills with one FILL_RECT per sleep stage (the Maker's sleep chart).
      // Everything sensor-related sits in try/catch: a missing API must not stop the face.
      ctx.sensors.add('Sleep');
      const k = ctx.sleepCharts = (ctx.sleepCharts || 0) + 1;
      const v = `sleepChart_${k}`;
      const hex = (c) => `0x${hexToNum(c).toString(16).padStart(6, '0')}`;
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y)); kv(L, 'w', p(el.w || 215)); kv(L, 'h', p(el.h || 69));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  const ${v} = ui.createWidget(ui.widget.GROUP, {\n${L.join('\n')}\n  })`);
      out.push(`  try {`);
      out.push(`    const sleep = new Sleep()`);
      out.push(`    if (sleep.updateInfo) sleep.updateInfo()`);
      out.push(`    const stages = sleep.getStage ? sleep.getStage() : []`);
      out.push(`    const M = sleep.getStageConstantObj ? sleep.getStageConstantObj() : {}`);
      out.push(`    if (stages && stages.length) {`);
      out.push(`      const colors = [${hex(el.colorDeep)}, ${hex(el.colorLight)}, ${hex(el.colorRem)}, ${hex(el.colorWake)}]`);
      out.push(`      const t0 = stages[0].start`);
      out.push(`      const total = Math.max(1, stages[stages.length - 1].stop + 1 - t0)`);
      out.push(`      const sx = px(${num(el.w) || 215}) / total`);
      out.push(`      const sy = px(${num(el.h) || 69}) / 4`);
      out.push(`      for (const s of stages) {`);
      out.push(`        const row = s.model === M.WAKE_STAGE ? 0 : s.model === M.REM_STAGE ? 1 : s.model === M.LIGHT_STAGE ? 2 : 3`);
      out.push(`        ${v}.createWidget(ui.widget.FILL_RECT, { x: (s.start - t0) * sx, y: row * sy, w: Math.max(2, (s.stop + 1 - s.start) * sx), h: sy, radius: 5, color: colors[3 - row] })`);
      out.push(`      }`);
      out.push(`    }`);
      out.push(`  } catch (e) {}`);
      break;
    }
    case 'BAR': {
      // The Maker's "linear scale": a FILL_RECT the code resizes with the reading (there is no
      // framework binding for it, so a sensor updater sets its length, like the arcs' LEVEL).
      const dt = dataType(el.dataType);
      const len = Math.max(1, num(el.length) || 100), lw = Math.max(1, num(el.lineWidth) || 10);
      const k = ctx.bars = (ctx.bars || 0) + 1;
      const v = `bar_${k}`;
      const colour = `0x${hexToNum(el.color).toString(16).padStart(6, '0')}`;
      const x0 = num(el.x), y0 = num(el.y);
      kv(L, 'x', p(x0)); kv(L, 'y', p(y0));
      kv(L, 'w', el.vertical ? p(lw) : 'px(0)'); kv(L, 'h', el.vertical ? 'px(0)' : p(lw));
      if (el.rounded) kv(L, 'radius', p(Math.round(lw / 2)));
      kv(L, 'color', colour);
      if (el.alpha != null && el.alpha < 255) kv(L, 'alpha', Math.max(0, num(el.alpha)));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  const ${v} = ui.createWidget(ui.widget.FILL_RECT, {\n${L.join('\n')}\n  })`);
      // the fraction of the bar to fill, from the reading
      let frac = '0';
      const lines = [];
      if (dt && dt.reader) {
        const { cls, get } = dt.reader;
        ctx.sensors.add(cls);
        const sv = `s_${ident(el.dataType).toLowerCase()}`;
        if (!ctx.declared.has(sv)) { lines.push(`  const ${sv} = new ${cls}()`); ctx.declared.add(sv); }
        const isTarget = /Target$/.test(el.dataType) || /getTarget/.test(get);
        const targetBased = /STEP|CAL|STAND|FAT_BURNING/.test(el.dataType) && !isTarget;
        frac = targetBased ? `${sv}.getCurrent() / (${sv}.getTarget() || 1)` : `${sv}.${get}() / ${DT_MAX[el.dataType] || 100}`;
        const upd = `upd_${v}`;
        const total = `px(${len})`;
        const fill = `Math.round(${total} * Math.max(0, Math.min(1, ${frac})))`;
        const place = [];
        // On the watch a MORE with only some of the four geometry values is accepted and ignored (the bar never moved),
        // so every update sends x, y, w and h together.
        if (el.vertical) {
          const off = el.mirror ? `Math.round((${total} - fill) / 2)` : el.inversion ? `${total} - fill` : '0';
          place.push(`x: px(${x0})`, `y: px(${y0}) + ${off}`, `w: px(${lw})`, 'h: fill');
        } else {
          const off = el.mirror ? `Math.round((${total} - fill) / 2)` : el.inversion ? `${total} - fill` : '0';
          place.push(`x: px(${x0}) + ${off}`, `y: px(${y0})`, 'w: fill', `h: px(${lw})`);
        }
        lines.push(`  const ${upd} = () => {`, `    const fill = ${fill}`, `    ${v}.setProperty(ui.prop.MORE, { ${place.join(', ')} })`, '  }', `  ${sv}.onChange(${upd})`, `  ${upd}()`);
      } else ctx.warnings.push(`${el.name}: ${el.dataType || 'no reading'} has no automatic reader — the bar stays empty on the watch`);
      for (const l of lines) out.push(l);
      break;
    }
    case 'TAP': {
      if (el.show === 'aod') break;   // the always-on display takes no taps
      let body = null;
      if (el.action === 'variant') body = 'cycleVariants()';
      else if (el.action === 'theme') {
        if (ctx.themed) body = 'cycleTheme()';
        else ctx.warnings.push(`${el.name}: no colour themes yet — generate them from the project panel first (left out)`);
      }
      else if (el.action === 'sysapp' && ctx.api && ctx.api < 3) ctx.warnings.push(`${el.name}: system apps need Zepp OS API 3.0 or newer (this device is ${ctx.api}) — the tap zone is left out`);
      else if (el.action === 'sysapp' && /^SYSTEM_APP_\w+$/.test(el.sysApp || '')) {
        // the documented launchApp + SYSTEM_APP_* of @zos/router (API 3.0+); the import is added only when used
        (ctx.routerApps = ctx.routerApps || new Set()).add(el.sysApp);
        body = `try { launchApp({ appId: ${el.sysApp}, native: true }) } catch (e) {}`;
        ctx.warnings.push(`${el.name}: opens a system app with launchApp from @zos/router — not yet tried on a watch; if the face shows a black screen, remove this tap zone`);
      } else if (el.action === 'sysapp') ctx.warnings.push(`${el.name}: no system app chosen — the tap zone is left out`);
      else if (el.action === 'app' && el.appUrl) {
        body = `if (typeof hmApp !== 'undefined') hmApp.startApp({ url: ${JSON.stringify(String(el.appUrl))}, native: true })`;
      } else if (el.action === 'app') ctx.warnings.push(`${el.name}: no screen chosen — the tap zone is left out`);
      else ctx.warnings.push(`${el.name}: this tap zone has no action here (${el.note ? 'the original ran custom code' : 'none set'}) — left out`);
      if (!body) break;
      if (el.action === 'variant' && !ctx.variants.length) ctx.warnings.push(`${el.name}: no image layer with variants to cycle`);
      ctx.usesTap = true;
      if (el.text || el.normalColor) {
        // a visible button: label and/or background colours (the docs' BUTTON text / color / press_color / normal_color / radius)
        const hex = (v) => `0x${hexToNum(v).toString(16).padStart(6, '0')}`;
        const B = [`    x: ${p(el.x)}, y: ${p(el.y)}, w: ${p(el.w)}, h: ${p(el.h)},`, `    text: ${JSON.stringify(String(el.text || ''))},`];
        if (el.textColor) B.push(`    color: ${hex(el.textColor)},`);
        if (el.textSize) B.push(`    text_size: ${p(el.textSize)},`);
        if (el.normalColor) { B.push(`    normal_color: ${hex(el.normalColor)},`, `    press_color: ${hex(el.pressColor || el.normalColor)},`); }
        if (el.radius) B.push(`    radius: ${p(el.radius)},`);
        out.push(`  ui.createWidget(ui.widget.BUTTON, {\n${B.join('\n')}\n    click_func: () => { ${body} },\n    show_level: ${showLevel(el.show)},\n  })`);
      } else out.push(`  ui.createWidget(ui.widget.BUTTON, {\n    x: ${p(el.x)}, y: ${p(el.y)}, w: ${p(el.w)}, h: ${p(el.h)},\n    text: '',\n    normal_src: A('tapzone.png'),\n    press_src: A('tapzone.png'),\n    click_func: () => { ${body} },\n    show_level: ${showLevel(el.show)},\n  })`);
      break;
    }
    case 'IMG': {
      if (variants) {
        const k = ctx.variants.length;
        const list = `variants_${k}`;
        out.push(`  const ${list} = [${variants.map((n) => A(n)).join(', ')}]`);
        const hours = hoursOf(el);
        if (hours) {
          out.push(`  const hours_${k} = ${JSON.stringify(hours)}`);
          out.push(`  const tod_${k} = () => { const t = new Time(); const h = t.getHours() + t.getMinutes() / 60; let b = -1, mx = 0; for (let i = 0; i < hours_${k}.length; i++) { if (hours_${k}[i] > hours_${k}[mx]) mx = i; if (hours_${k}[i] <= h && (b < 0 || hours_${k}[i] > hours_${k}[b])) b = i } return b < 0 ? mx : b }`);
        }
        out.push(`  const variant_${k} = ui.createWidget(ui.widget.IMG, {`);
        kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
        if (el.w) kv(L, 'w', p(el.w));
        if (el.h) kv(L, 'h', p(el.h));
        L.push(`    src: ${hours ? `${list}[tod_${k}()]` : `${list}[variantIdx % ${list}.length]`},`);
        kv(L, 'show_level', showLevel(el.show));
        out.push(L.join('\n').replace(/,(\s*)$/, '$1') + '\n  })');
        ctx.variants.push({ list, widget: `variant_${k}`, tod: hours ? `tod_${k}` : null, names: Array.isArray(el.variantNames) ? el.variantNames : [] });
        break;
      }
      // A picture for the customise screen is a mask widget: a plain IMG with ONLY_EDIT
      // would also be drawn over the normal face on the watch.
      const maskW = el.show === 'edit' ? (el.editMask === 'fg' || /foreground/i.test(el.name || '') ? 'WATCHFACE_EDIT_FG_MASK' : 'WATCHFACE_EDIT_MASK') : null;
      L.push(maskW ? `  try { const H = (typeof hmUI !== 'undefined' && hmUI.widget && hmUI.widget.${maskW}) ? hmUI : ui; H.createWidget(H.widget.${maskW}, {` : '  ui.createWidget(ui.widget.IMG, {');
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      if (el.w) kv(L, 'w', p(el.w));
      if (el.h) kv(L, 'h', p(el.h));
      if (el.posX) kv(L, 'pos_x', p(el.posX));
      if (el.posY) kv(L, 'pos_y', p(el.posY));
      if (el.angle) {
        kv(L, 'angle', num(el.angle));
        kv(L, 'center_x', p(el.centerX));
        kv(L, 'center_y', p(el.centerY));
      }
      kv(L, 'src', asset(el, 'src'));
      kv(L, 'show_level', maskW ? 'H.show_level.ONLY_EDIT' : showLevel(el.show));
      out.push(L.join('\n').replace(/,(\s*)$/, '$1') + '\n  })' + (maskW ? ' } catch (e) {}' : ''));
      break;
    }
    case 'TEXT': {
      // A gradient/outline fill, bold or italic cannot be expressed with the
      // TEXT widget (docs: only `color`, `text_size`, `font`, spacing), so those
      // layers are rasterised by the designer and shipped as a picture.
      if (el.dataType && needsTextBake(el)) {
        ctx.warnings.push(`${el.name}: a reading shown as text cannot carry ${bakeReason(el)} — exported with a flat colour`);
      } else if (needsTextBake(el)) {
        if (!el.bakedImage) {
          ctx.warnings.push(`${el.name}: ${bakeReason(el)} — re-export to refresh the baked image`);
        } else {
          L.push(`  // baked by the designer: ${bakeReason(el)}`);
          L.push('  ui.createWidget(ui.widget.IMG, {');
          kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
          kv(L, 'w', p(el.w || 200)); kv(L, 'h', p(el.h || 40));
          kv(L, 'src', asset(el, 'bakedImage'));
          kv(L, 'show_level', showLevel(el.show));
          out.push(L.join('\n') + '\n  })');
          break;
        }
      }
      L.push(`  ui.createWidget(ui.widget.${el.dataType ? 'TEXT_FONT' : 'TEXT'}, {`);
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      kv(L, 'w', p(el.w || 200)); kv(L, 'h', p(el.h || 40));
      kv(L, 'color', `0x${hexToNum(el.color).toString(16).padStart(6, '0')}`);
      kv(L, 'text_size', p(el.size || 32));
      kv(L, 'align_h', `ui.align.${el.alignH || 'CENTER_H'}`);
      kv(L, 'align_v', `ui.align.${el.alignV || 'CENTER_V'}`);
      if (el.lineSpace) kv(L, 'line_space', p(el.lineSpace));
      if (el.charSpace) kv(L, 'char_space', p(el.charSpace));
      if (el.textStyle && el.textStyle !== 'NONE') kv(L, 'text_style', `ui.text_style.${el.textStyle}`);
      if (el.dataType) kv(L, 'type', `ui.data_type.${el.dataType}`);
      else kv(L, 'text', JSON.stringify(el.text == null ? '' : String(el.text)));
      if (el.alpha != null && el.alpha < 255) kv(L, 'alpha', Math.max(0, num(el.alpha)));
      // custom typeface: the file is exported next to the images as
      // assets/<target>/fonts/<file> and referenced relative to that folder.
      if (el.fontFile) kv(L, 'font', JSON.stringify(`fonts/${path.basename(String(el.fontFile))}`));
      kv(L, 'show_level', showLevel(el.show));
      out.push(L.join('\n') + '\n  })');
      break;
    }
    case 'TEXT_IMG': {
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      if (el.w) kv(L, 'w', p(el.w));
      // a fixed text replaces the reading (the docs: `type` is disabled when `text` is set)
      if (el.text) kv(L, 'text', JSON.stringify(String(el.text).replace(/[^0-9]/g, '')));
      else if (el.dataType) kv(L, 'type', `ui.data_type.${el.dataType}`);
      kv(L, 'font_array', arrays[arrName(el)]);
      if (el.hSpace) kv(L, 'h_space', p(el.hSpace));
      kv(L, 'align_h', `ui.align.${el.alignH || 'LEFT'}`);
      if (el.unit) { kv(L, 'unit_en', asset(el, 'unit')); kv(L, 'unit_sc', asset(el, 'unit')); kv(L, 'unit_tc', asset(el, 'unit')); }
      // the unit shown when the watch is set to imperial (mi, °F …)
      if (el.unitImperial) { kv(L, 'imperial_unit_en', asset(el, 'unitImperial')); kv(L, 'imperial_unit_sc', asset(el, 'unitImperial')); kv(L, 'imperial_unit_tc', asset(el, 'unitImperial')); }
      if (el.invalid) kv(L, 'invalid_image', asset(el, 'invalid'));
      if (el.dot) kv(L, 'dot_image', asset(el, 'dot'));
      if (el.negative) kv(L, 'negative_image', asset(el, 'negative'));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.TEXT_IMG, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_TIME': {
      const part = el.part || 'hour';
      const pre = part === 'hour12' ? 'hour' : part;
      const follow = num(el.follow) ? 1 : 0;
      // a following part is placed by the watch next to the previous one, so it
      // sends no startX / space / align (same as Zepp's own tool)
      if (!follow) {
        kv(L, `${pre}_startX`, p(el.x)); kv(L, `${pre}_startY`, p(el.y));
      }
      if (pre !== 'hour12') {
        kv(L, `${pre}_zero`, num(el.zero) ? 1 : 0);
        if (!follow) {
          kv(L, `${pre}_space`, p(el.space || 0));
          kv(L, `${pre}_align`, `ui.align.${el.alignH || 'LEFT'}`);
        }
      }
      kv(L, `${pre}_array`, arrays[arrName(el)]);
      if (el.unit) {
        kv(L, `${pre}_unit_en`, asset(el, 'unit'));
        kv(L, `${pre}_unit_sc`, asset(el, 'unit'));
        kv(L, `${pre}_unit_tc`, asset(el, 'unit'));
      }
      kv(L, `${pre}_follow`, num(el.follow) ? 1 : 0);
      // am/pm are optional: only emit them when an AM or PM image was set
      if (part === 'hour12' && (el.am || el.pm)) {
        kv(L, 'am_x', p(el.amX)); kv(L, 'am_y', p(el.amY));
        kv(L, 'am_en_path', asset(el, 'am'));
        kv(L, 'am_sc_path', asset(el, 'am'));
        kv(L, 'am_tc_path', asset(el, 'am'));
        kv(L, 'pm_x', p(el.pmX)); kv(L, 'pm_y', p(el.pmY));
        kv(L, 'pm_en_path', asset(el, 'pm'));
        kv(L, 'pm_sc_path', asset(el, 'pm'));
        kv(L, 'pm_tc_path', asset(el, 'pm'));
      }
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_TIME, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_WEEK': {
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      kv(L, 'week_en', arrays[arrName(el)]);
      kv(L, 'week_sc', arrays[arrName(el)]);
      kv(L, 'week_tc', arrays[arrName(el)]);
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_WEEK, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_DATE': {
      const part = el.part || 'day';
      const follow = num(el.follow) ? 1 : 0;
      if (!follow) {
        kv(L, `${part}_startX`, p(el.x)); kv(L, `${part}_startY`, p(el.y));
      }
      kv(L, `${part}_zero`, num(el.zero) ? 1 : 0);
      if (!follow) {
        kv(L, `${part}_space`, p(el.space || 0));
        kv(L, `${part}_align`, `ui.align.${el.alignH || 'LEFT'}`);
      }
      kv(L, `${part}_follow`, follow);
      if (el.isCharacter) kv(L, `${part}_is_character`, 'true');
      kv(L, `${part}_en_array`, arrays[arrName(el)]);
      kv(L, `${part}_sc_array`, arrays[arrName(el)]);
      kv(L, `${part}_tc_array`, arrays[arrName(el)]);
      if (el.unit) {
        kv(L, `${part}_unit_en`, asset(el, 'unit'));
        kv(L, `${part}_unit_sc`, asset(el, 'unit'));
        kv(L, `${part}_unit_tc`, asset(el, 'unit'));
      }
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_DATE, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'DATE_POINTER': {
      // hmUI.date.WEEK / DAY / MONTH — the date unit the pointer turns with
      kv(L, 'type', `(typeof hmUI !== 'undefined' && hmUI.date ? hmUI.date : ui.date).${el.dateType || 'WEEK'}`);
      kv(L, 'center_x', p(el.centerX)); kv(L, 'center_y', p(el.centerY));
      kv(L, 'src', asset(el, 'src'));
      kv(L, 'posX', p(el.posX)); kv(L, 'posY', p(el.posY));
      if (el.scale) {
        kv(L, 'scale_x', p(el.scaleX)); kv(L, 'scale_y', p(el.scaleY));
        kv(L, 'scale_en', asset(el, 'scale')); kv(L, 'scale_sc', asset(el, 'scale')); kv(L, 'scale_tc', asset(el, 'scale'));
      }
      if (el.cover) { kv(L, 'cover_path', asset(el, 'cover')); kv(L, 'cover_x', p(el.coverX)); kv(L, 'cover_y', p(el.coverY)); }
      kv(L, 'start_angle', num(el.startAngle || 0));
      kv(L, 'end_angle', num(el.endAngle == null ? 180 : el.endAngle));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.DATE_POINTER, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'TIME_POINTER': {
      const hands = [['hour', el.hour, el.hourPivotX, el.hourPivotY], ['minute', el.minute, el.minutePivotX, el.minutePivotY], ['second', el.second, el.secondPivotX, el.secondPivotY]];
      for (const [name, src, px_, py] of hands) {
        if (!src) continue;
        kv(L, `${name}_centerX`, p(el.centerX)); kv(L, `${name}_centerY`, p(el.centerY));
        kv(L, `${name}_posX`, p(px_)); kv(L, `${name}_posY`, p(py));
        kv(L, `${name}_path`, A(src));
      }
      if (el.cover) { kv(L, 'hour_cover_path', A(el.cover)); kv(L, 'hour_cover_x', p(el.centerX)); kv(L, 'hour_cover_y', p(el.centerY)); }
      // a hand of its own can carry its own cap too (minute_cover_* / second_cover_*)
      for (const name of ['minute', 'second']) {
        if (el[`${name}Cover`]) { kv(L, `${name}_cover_path`, A(el[`${name}Cover`])); kv(L, `${name}_cover_x`, p(el.centerX)); kv(L, `${name}_cover_y`, p(el.centerY)); }
      }
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.TIME_POINTER, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_POINTER': {
      kv(L, 'src', asset(el, 'src'));
      kv(L, 'center_x', p(el.centerX)); kv(L, 'center_y', p(el.centerY));
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      kv(L, 'angle', num(el.angle || 0));
      if (el.startAngle) kv(L, 'start_angle', num(el.startAngle));
      if (el.endAngle) kv(L, 'end_angle', num(el.endAngle));
      if (el.dataType) { kv(L, 'type', `ui.data_type.${el.dataType}`); kv(L, 'invalid_visible', 0); }
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_POINTER, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_LEVEL': {
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      if (el.w) kv(L, 'w', p(el.w));
      if (el.h) kv(L, 'h', p(el.h));
      kv(L, 'image_array', arrays[arrName(el)]);
      kv(L, 'image_length', `${arrays[arrName(el)]}.length`);
      if (el.dataType) kv(L, 'type', `ui.data_type.${el.dataType}`);
      else kv(L, 'level', num(el.level || 0));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_LEVEL, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_PROGRESS': {
      const arr = arrays[arrName(el)];
      const n = (el.images || []).length || 1;
      const spread = num(el.spread || 24);
      const pos = Array.isArray(el.positions) && el.positions.length === n ? el.positions : null;
      kv(L, 'x', `[${Array.from({ length: n }, (_, i) => p(pos ? pos[i][0] : num(el.x) + i * spread)).join(', ')}]`);
      kv(L, 'y', `[${Array.from({ length: n }, (_, i) => p(pos ? pos[i][1] : el.y)).join(', ')}]`);
      kv(L, 'image_array', arr);
      kv(L, 'image_length', `${arr}.length`);
      if (el.dataType) kv(L, 'type', `ui.data_type.${el.dataType}`);
      else kv(L, 'level', num(el.level || 1));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_PROGRESS, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'ARC_PROGRESS': {
      kv(L, 'center_x', p(el.centerX)); kv(L, 'center_y', p(el.centerY));
      kv(L, 'radius', p(el.radius));
      kv(L, 'start_angle', num(el.startAngle));
      kv(L, 'end_angle', num(el.endAngle));
      kv(L, 'line_width', p(el.lineWidth));
      kv(L, 'color', `0x${hexToNum(el.color).toString(16).padStart(6, '0')}`);
      if (el.bg) kv(L, 'src_bg', A(el.bg));
      kv(L, 'level', num(el.level || 0));
      kv(L, 'show_level', showLevel(el.show));
      const needsVar = readerFor(el, ctx);
      out.push(`  ${needsVar ? `const ${needsVar.varName} = ` : ''}ui.createWidget(ui.widget.ARC_PROGRESS, {\n${L.join('\n')}\n  })`);
      if (needsVar) { out.push(needsVar.code); ctx.declared.add(needsVar.sensorVar); }
      break;
    }
    case 'ARC': {
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      kv(L, 'w', p(el.w)); kv(L, 'h', p(el.h));
      if (el.radius) kv(L, 'radius', p(el.radius));
      kv(L, 'start_angle', num(el.startAngle));
      kv(L, 'end_angle', num(el.endAngle));
      kv(L, 'line_width', p(el.lineWidth));
      kv(L, 'color', `0x${hexToNum(el.color).toString(16).padStart(6, '0')}`);
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.ARC, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'CIRCLE': {
      kv(L, 'center_x', p(el.centerX)); kv(L, 'center_y', p(el.centerY));
      kv(L, 'radius', p(el.radius));
      kv(L, 'color', `0x${hexToNum(el.color).toString(16).padStart(6, '0')}`);
      if (el.alpha != null && el.alpha < 255) kv(L, 'alpha', Math.max(0, num(el.alpha)));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.CIRCLE, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'FILL_RECT': {
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y)); kv(L, 'w', p(el.w)); kv(L, 'h', p(el.h));
      if (el.radius) kv(L, 'radius', p(el.radius));
      if (el.angle) kv(L, 'angle', num(el.angle));
      kv(L, 'color', `0x${hexToNum(el.color).toString(16).padStart(6, '0')}`);
      if (el.alpha != null && el.alpha < 255) kv(L, 'alpha', Math.max(0, num(el.alpha)));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.FILL_RECT, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'STROKE_RECT': {
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y)); kv(L, 'w', p(el.w)); kv(L, 'h', p(el.h));
      kv(L, 'radius', p(el.radius || 0));
      kv(L, 'line_width', p(el.lineWidth || 2));
      if (el.angle) kv(L, 'angle', num(el.angle));
      kv(L, 'color', `0x${hexToNum(el.color).toString(16).padStart(6, '0')}`);
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.STROKE_RECT, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_STATUS': {
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      if (el.w) kv(L, 'w', p(el.w));
      if (el.h) kv(L, 'h', p(el.h));
      kv(L, 'type', `ui.system_status.${el.status || 'DISCONNECT'}`);
      kv(L, 'src', asset(el, 'src'));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_STATUS, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_CLICK': {
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      kv(L, 'w', p(el.w)); kv(L, 'h', p(el.h));
      kv(L, 'src', asset(el, 'src'));
      kv(L, 'type', `ui.data_type.${el.dataType || 'OUTDOOR_RUNNING'}`);
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_CLICK, {\n${L.join('\n')}\n  })`);
      break;
    }
    case 'IMG_ANIM': {
      const frames = el.frames || [];
      if (!frames.length) break;
      const prefix = animPrefixFor(el);
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      // anim_path is the *folder*, the widget composes <anim_path>/<prefix>_<i>.<ext>
      // (https://docs.zepp.com/docs/watchface/api/hmUI/widget/IMG_ANIM/), which is
      // why writeZeusProject() puts the frames in images/anim/ under these names.
      kv(L, 'anim_path', `'images/anim'`);
      kv(L, 'anim_prefix', `'${prefix}'`);
      kv(L, 'anim_ext', `'png'`);
      kv(L, 'anim_fps', num(el.fps || 30));
      kv(L, 'anim_size', frames.length);
      kv(L, 'repeat_count', num(el.repeat != null ? el.repeat : 0));
      kv(L, 'step', num(el.step || 1));
      kv(L, 'anim_status', 'ui.anim_status.START');
      if (el.displayOnRestart) kv(L, 'display_on_restart', 'true');
      if (el.defaultFrame) kv(L, 'default_frame_index', num(el.defaultFrame));
      kv(L, 'show_level', showLevel(el.show));
      out.push(`  ui.createWidget(ui.widget.IMG_ANIM, {\n${L.join('\n')}\n  })`);
      break;
    }
    default:
      break;
  }
  return out;
}

// Hand-written updater for widgets that have no framework `type` binding
// (ARC_PROGRESS): read the matching @zos/sensor class and push the level.
function readerFor(el, ctx) {
  if (!el.dataType) return null;
  const dt = dataType(el.dataType);
  if (!dt || !dt.reader) return null;
  const { cls, get } = dt.reader;
  const suffix = `${ident(el.name)}_${el.id.slice(-4)}${el._emitState ? `_${el._emitState}` : ''}`;
  const varName = `w_${suffix}`;
  const updName = `upd_${suffix}`;
  const sensorVar = `s_${ident(el.dataType).toLowerCase()}`;
  ctx.sensors.add(cls);
  const targetCls = cls;
  const isTarget = /Target$/.test(el.dataType) || /getTarget/.test(get);
  const pct = /STEP|CAL|STAND|FAT_BURNING/.test(el.dataType) && !isTarget;
  const body = pct
    ? `    const value = ${sensorVar}.getCurrent()\n    const target = ${sensorVar}.getTarget() || 1\n    ${varName}.setProperty(ui.prop.LEVEL, Math.min(100, Math.round((value / target) * 100)))`
    : `    ${varName}.setProperty(ui.prop.LEVEL, Math.min(100, ${sensorVar}.${get}()))`;
  // One sensor instance per data type: a layer shown in both states (or two
  // layers on the same reading) shares it, since a second `const` with the same
  // name is a syntax error that takes the whole face down.
  const declare = !ctx.declared.has(sensorVar);
  const lines = [`  // ${dt.label} progress (${targetCls}.${get})`];
  if (declare) lines.push(`  const ${sensorVar} = new ${targetCls}()`);
  lines.push(
    `  const ${updName} = () => {`,
    body,
    '  }',
    `  ${sensorVar}.onChange(${updName})`,
    `  ${updName}()`,
  );
  return { varName, code: lines.join('\n'), sensorVar };
}

function generateWatchface(project, device = deviceByKey(project.device)) {
  const ctx = { sensors: new Set(), declared: new Set(), arrays: {}, warnings: [], variants: [], usesTap: false };
  // colour themes: pictures with a recoloured copy per theme; the face rebuilds itself on a switch
  const th = project.themes;
  const themed = !!(th && Array.isArray(th.list) && th.list.length && Array.isArray(th.recolored) && th.recolored.length);
  ctx.themed = themed;
  ctx.api = parseFloat(device && device.api) || 0;
  const els = (project.elements || []).filter((e) => e.visible !== false && !e.previewOnly);
  // ---- declare the image arrays the widgets reference ----
  const decls = [];
  const fills = [];                   // themed faces: the arrays are filled again after a switch
  const arrayByContent = new Map();   // identical sets share one const
  for (const el of els) {
    let names = null;
    if (el.kind === 'IMG_TIME' || el.kind === 'IMG_WEEK' || el.kind === 'IMG_DATE' || el.kind === 'TEXT_IMG' || el.kind === 'IMG_LEVEL' || el.kind === 'IMG_PROGRESS') {
      names = (el.images || []).map((n) => (typeof n === 'string' ? n : n.name)).filter(Boolean);
    }
    if (!names || !names.length) {
      if (['TEXT_IMG', 'IMG_LEVEL', 'IMG_PROGRESS'].includes(el.kind)) ctx.warnings.push(`${el.name}: no images assigned`);
      continue;
    }
    const key = names.join('\u0000');
    if (arrayByContent.has(key)) { ctx.arrays[arrName(el)] = arrayByContent.get(key); continue; }
    const id = arrName(el);
    arrayByContent.set(key, id);
    ctx.arrays[id] = id;
    if (themed) {
      decls.push(`let ${id} = []`);
      fills.push(`  ${id} = [\n${names.map((n) => `    ${A(n)}`).join(',\n')},\n  ]`);
    } else decls.push(`const ${id} = [\n${names.map((n) => `  ${A(n)}`).join(',\n')},\n]`);
  }
  // the import line is written before the layers, so every sensor a layer will construct has to be known now
  for (const el of els) {
    if (el.kind === 'BAR') { const dt = dataType(el.dataType); if (dt && dt.reader) ctx.sensors.add(dt.reader.cls); }
    else if (el.kind === 'SLEEP_CHART') ctx.sensors.add('Sleep');
  }
  for (const el of els) {
    if (el.kind !== 'ARC_PROGRESS') continue;
    const r = readerFor(el, ctx);
    if (!r && el.dataType) ctx.warnings.push(`${el.name}: ${el.dataType} has no automatic reader — level stays static on the watch`);
  }

  const out = [];
  out.push('// ---------------------------------------------------------------------------');
  out.push(`// ${project.name || 'watchface'} — generated by Dialcraft`);
  out.push(`// target: ${device.name} (${device.target}, ${device.w}×${device.h}, ${device.shape})`);
  out.push('//');
  out.push('// Built against the Zepp OS watchface API:');
  out.push('//   widgets  https://docs.zepp.com/docs/watchface/api/hmUI/widget/');
  out.push('//   layout   px() scales from app.json designWidth = ' + device.designWidth);
  out.push('//   states   show_level = normal / AOD / edit');
  out.push('// Design-spec reminders: preview time 10:09:36, 2px safe edge, AOD keeps');
  out.push('// the pixel budget under 10% with a black background and no second hand.');
  out.push('// ---------------------------------------------------------------------------');
  if (els.some((e) => e.showWhen && !missingPicture(e)) || els.some((e) => hoursOf(e) && e.show !== 'aod')) ctx.sensors.add('Time');
  const hasVariants = els.some((e) => variantsOf(e) && e.show !== 'aod');
  const hasSunWhen = els.some((e) => (e.showWhen === 'sunrise' || e.showWhen === 'sunset') && !missingPicture(e));
  out.push("import ui from '@zos/ui'");

  if (ctx.sensors.size) {
    out.push(`import { ${[...ctx.sensors].sort().join(', ')} } from '@zos/sensor'`);
  }
  if (hasSunWhen) out.push("import * as zosSensors from '@zos/sensor'   // Weather is read from here: a watch without it gives undefined, it never stops the face loading");
  // code of your own (a game, a custom sensor): project.userImports sits with the imports, project.userCode runs at the end of initView
  if (typeof project.userImports === 'string' && project.userImports.trim()) out.push(project.userImports.trim());
  // the import line comes before the widgets, so the system apps the tap zones use are collected here
  for (const e of els) {
    if (e.kind === 'TAP' && e.action === 'sysapp' && e.show !== 'aod' && ctx.api >= 3 && /^SYSTEM_APP_\w+$/.test(e.sysApp || '')) (ctx.routerApps = ctx.routerApps || new Set()).add(e.sysApp);
  }
  if (ctx.routerApps && ctx.routerApps.size) {
    out.push(`import { launchApp, ${[...ctx.routerApps].sort().join(', ')} } from '@zos/router'`);
  }
  out.push('');
  if (themed) {
    out.push(`// colour themes: ${th.list.map((t) => t.name).join(', ')} (pictures with a recoloured copy are listed in THEMED)`);
    out.push(`const THEME_NAMES = ${JSON.stringify(['Original', ...th.list.map((t) => t.name)])}`);
    out.push(`const THEMED = ${JSON.stringify(Object.fromEntries(th.recolored.map((n) => [n, 1])))}`);
    out.push('let themeIdx = 0');
    out.push("const A = (p) => `images/${themeIdx && THEMED[p] ? p.replace(/\\.png$/i, '__t' + themeIdx + '.png') : p}`");
  } else out.push('const A = (p) => `images/${p}`');
  out.push('');
  if (decls.length) {
    out.push('// ---- image arrays (frame order matters: digits 0-9, week 1-7) ----');
    out.push(decls.join('\n\n'));
    out.push('');
    if (themed) { out.push('const initArrays = () => {'); out.push(fills.join('\n')); out.push('}'); out.push(''); }
  }
  out.push('WatchFace({');
  out.push('  initView() {');
  const whenVars = [];
  const sunVars = [];
  if (!els.length) {
    out.push('    // no visible elements yet');
  }
  if (hasVariants) {
    // Guarded on purpose: a missing API must never stop the face from drawing.
    out.push('    // the picked variant survives a restart (when the watch offers storage)');
    out.push('    let variantIdx = 0');
    out.push("    try { if (typeof hmFS !== 'undefined') variantIdx = Number(hmFS.SysProGetInt('dialcraft_variant')) || 0 } catch (e) {}");
    out.push('');
  }
  if (themed) {
    out.push('    // the picked colour theme survives a restart (when the watch offers storage)');
    out.push("    try { if (typeof hmFS !== 'undefined') themeIdx = (Number(hmFS.SysProGetInt('dialcraft_theme')) || 0) % THEME_NAMES.length } catch (e) {}");
    out.push('');
  }
  if (els.some((e) => validHandle(e.handle) && !missingPicture(e))) {
    out.push('    // layers with a code handle: W.<handle> is the widget, F.<handle> the picture list of a variants layer');
    out.push('    const W = {}');
    out.push('    const F = {}');
  }
  const bodyStart = out.length;
  const slotEls = els.filter((e) => e.kind === 'EDIT_SLOT');
  const slotOf = (e) => (e.editSlot != null && e.editSlot !== '' ? slotEls.find((sl) => String(sl.editId) === String(e.editSlot)) : null);
  // one layer (or two, when it shows in both states) as widget code, indented by `pad` extra spaces
  const emitLayer = (el, pad) => {
    if (missingPicture(el)) {
      ctx.warnings.push(`${el.name}: no picture — left out of the export`);
      return;
    }
    if (el.kind === 'EDIT_SLOT') { emitSlot(el, pad); return; }
    // A layer shown in both states becomes two widgets — one ONLY_NORMAL, one
    // ONLY_AOD — because the watch's AOD path only picks up widgets that carry
    // the AOD bit on its own (the combined bitmask is not honoured). This is the
    // structure every shipping watchface uses.
    const both = (el.show || 'both') === 'both';
    const states = both ? ['normal', 'aod'] : [el.show || 'normal'];
    for (const state of states) {
      out.push(`${pad}    // ${el.name} (${el.kind})${both ? ` — ${state === 'aod' ? 'AOD (screen-off)' : 'normal state'}` : ''}`);
      const chunk = [];
      emitElement({ ...el, show: state, _emitState: both ? state : null }, ctx, chunk);
      // a layer tied to AM / PM keeps a handle so the hour can show or hide it
      if ((el.showWhen === 'sunrise' || el.showWhen === 'sunset') && chunk.length && /ui\.createWidget\(/.test(chunk[chunk.length - 1])) {
        const v = `sun_${sunVars.length}`;
        chunk[chunk.length - 1] = chunk[chunk.length - 1].replace(/(^|\n)(\s*)ui\.createWidget\(/, `$1$2const ${v} = ui.createWidget(`);
        sunVars.push({ v, set: el.showWhen === 'sunset' });
      } else if (el.showWhen && chunk.length && /ui\.createWidget\(/.test(chunk[chunk.length - 1])) {
        const v = `when_${whenVars.length}`;
        chunk[chunk.length - 1] = chunk[chunk.length - 1].replace(/(^|\n)(\s*)ui\.createWidget\(/, `$1$2const ${v} = ui.createWidget(`);
        whenVars.push({ v, pm: el.showWhen === 'pm' });
      }
      // a layer with a code handle is reachable from user code as W.<handle> (and F.<handle> for its picture list)
      if (state === states[0] && validHandle(el.handle) && chunk.length) {
        const last = chunk[chunk.length - 1], named = [...chunk.join('\n').matchAll(/const (\w+) = ui\.createWidget\(/g)].pop();
        const list = /const (variants_\d+) = /.exec(chunk.join('\n'));
        if (named) chunk.push(`  W.${el.handle} = ${named[1]}`);
        else if (/(^|\n)\s*ui\.createWidget\(/.test(last)) chunk[chunk.length - 1] = last.replace(/(^|\n)(\s*)ui\.createWidget\(/, `$1$2W.${el.handle} = ui.createWidget(`);
        else ctx.warnings.push(`${el.name}: code handle "${el.handle}" skipped — this layer's widget cannot be named`);
        if (list) chunk.push(`  F.${el.handle} = ${list[1]}`);
      }
      // the emitters are written at a 2-space base indent; shift them inside initView
      for (const line of chunk.join('\n').split('\n')) out.push(line ? pad + '  ' + line : line);
      out.push('');
    }
  };
  // A complication slot: the group widget, then a switch on what the wearer picked that creates
  // the layers of that choice. try/catch: the edit APIs must never stop the rest of the face.
  const emitSlot = (slot, pad) => {
    if (slot.show === 'aod') return;
    const k = ctx.slots = (ctx.slots || 0) + 1;
    const opts = (slot.optionalTypes || []).filter((o) => o && o.type);
    const ty = (t) => `H.edit_type.${t}`;
    out.push(`${pad}    // ${slot.name || 'Complication'} (the wearer picks what it shows)`);
    out.push(`${pad}    try {`);
    out.push(`${pad}      // the edit API lives on the legacy global in every shipping face; fall back to the import`);
    out.push(`${pad}      const H = (typeof hmUI !== 'undefined' && hmUI.edit_type) ? hmUI : ui`);
    out.push(`${pad}      const slot_${k} = H.createWidget(H.widget.WATCHFACE_EDIT_GROUP, {`);
    const Ls = [];
    kv(Ls, 'edit_id', num(slot.editId) || k);
    kv(Ls, 'x', p(slot.x)); kv(Ls, 'y', p(slot.y)); kv(Ls, 'w', p(slot.w)); kv(Ls, 'h', p(slot.h));
    kv(Ls, 'select_image', slot.selectImage ? A(slot.selectImage) : "''");
    kv(Ls, 'un_select_image', slot.unSelectImage ? A(slot.unSelectImage) : "''");
    kv(Ls, 'default_type', ty(slot.defaultType || (opts[0] && opts[0].type) || 'STEP'));
    kv(Ls, 'optional_types', `[${opts.map((o) => `{ type: ${ty(o.type)}${o.preview ? `, preview: ${A(o.preview)}` : ''} }`).join(', ')}]`);
    kv(Ls, 'count', opts.length);
    kv(Ls, 'select_list', '{ title_font_size: px(34), title_align_h: H.align.CENTER_H, list_item_vspace: px(8), list_tips_text_font_size: px(32), list_tips_text_align_h: H.align.LEFT }');
    if (slot.tipsBg) {
      kv(Ls, 'tips_BG', A(slot.tipsBg)); kv(Ls, 'tips_x', p(slot.tipsX)); kv(Ls, 'tips_y', p(slot.tipsY));
      kv(Ls, 'tips_width', p(slot.tipsWidth || slot.w)); kv(Ls, 'tips_margin', p(slot.tipsMargin || 10));
    }
    // no show_level: the group has to exist in the customise state too, or nothing can be picked
    for (const l of Ls) out.push(`${pad}    ${l}`);
    out.push(`${pad}      })`);
    out.push(`${pad}      switch (slot_${k}.getProperty(H.prop.CURRENT_TYPE)) {`);
    for (const o of opts) {
      out.push(`${pad}        case ${ty(o.type)}: {`);
      for (const ch of els.filter((e) => e.editSlot != null && String(e.editSlot) === String(slot.editId) && e.editType === o.type)) emitLayer(ch, pad + '        ');
      out.push(`${pad}          break`);
      out.push(`${pad}        }`);
    }
    out.push(`${pad}      }`);
    // never stops the face, but says why the slot is missing (a toast on the watch)
    out.push(`${pad}    } catch (e) {`);
    out.push(`${pad}      try { ui.createWidget(ui.widget.TEXT, { x: 0, y: px(150), w: px(${device.w}), h: px(150), text: 'Edit slot: ' + (e && e.message ? e.message : e), text_size: px(22), color: 0xff5555, align_h: ui.align.CENTER_H, text_style: ui.text_style.WRAP }) } catch (e2) {}`);
    out.push(`${pad}    }`);
    out.push('');
  };
  for (const el of els) {
    if (slotOf(el)) continue;      // emitted inside its slot's switch
    emitLayer(el, '');
  }
  if (ctx.variants.length) {
    const names = (ctx.variants.find((v) => v.names.length) || { names: [] }).names;
    out.push('    // a Tap zone set to "Cycle variants" calls this');
    if (names.length) out.push(`    const variantNames = ${JSON.stringify(names)}`);
    out.push('    const cycleVariants = () => {');
    const total = ctx.variants.map((v) => `${v.list}.length`).join(', ');
    out.push(`      variantIdx = (variantIdx + 1) % Math.max(${total})`);
    out.push("      try { if (typeof hmFS !== 'undefined') hmFS.SysProSetInt('dialcraft_variant', variantIdx) } catch (e) {}");
    if (names.length) out.push("      try { if (variantNames[variantIdx] && typeof hmUI !== 'undefined') hmUI.showToast({ text: variantNames[variantIdx] }) } catch (e) {}");
    for (const v of ctx.variants) if (!v.tod) out.push(`      ${v.widget}.setProperty(ui.prop.SRC, ${v.list}[variantIdx % ${v.list}.length])`);
    out.push('    }');
    const todV = ctx.variants.filter((v) => v.tod);
    if (todV.length) {
      out.push('    // time-of-day variants follow the clock');
      out.push('    const updateTod = () => {');
      for (const v of todV) out.push(`      ${v.widget}.setProperty(ui.prop.SRC, ${v.list}[${v.tod}()])`);
      out.push('    }');
      out.push('    const todClock = new Time()');
      out.push('    todClock.onPerMinute(updateTod)');
      out.push('    ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: updateTod })');
    }
  } else if (ctx.usesTap && els.some((e) => e.kind === 'TAP' && e.action === 'variant')) {
    out.push('    const cycleVariants = () => {}');
  }
  if (whenVars.length) {
    out.push('    // lit AM / PM layers follow the hour');
    out.push('    const clockNow = new Time()');
    out.push('    const updateWhen = () => {');
    out.push('      const pm = clockNow.getHours() >= 12');
    for (const w of whenVars) out.push(`      ${w.v}.setProperty(ui.prop.VISIBLE, ${w.pm ? 'pm' : '!pm'})`);
    out.push('    }');
    out.push('    updateWhen()');
    out.push('    clockNow.onPerMinute(updateWhen)');
    out.push('    ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: updateWhen })');
  }
  if (sunVars.length) {
    out.push('    // Sunrise / sunset swap. The watch has no "next sunrise" reading: SUN_CURRENT stays on today\'s sunset once it has passed.');
    out.push('    // So the plain SUN_RISE and SUN_SET readings sit in the same place and this shows the one that comes next:');
    out.push('    // the sunset from sunrise until sunset, the sunrise otherwise (after sunset it is today\'s sunrise time, within a minute or two of tomorrow\'s).');
    out.push('    const sunClock = new Time()');
    out.push('    const sunTimes = () => {   // today\'s [sunrise, sunset] in minutes since midnight, from the weather data; null when the watch has none');
    out.push('      try {');
    out.push('        const WeatherCls = zosSensors && zosSensors.Weather');
    out.push('        const wx = WeatherCls ? new WeatherCls() : null');
    out.push('        const f = wx ? (wx.getForecastWeather ? wx.getForecastWeather() : wx.getForecast()) : null');
    out.push('        const t = f && f.tideData && f.tideData.data && f.tideData.data[0]');
    out.push('        if (t && t.sunrise && t.sunset) return [t.sunrise.hour * 60 + t.sunrise.minute, t.sunset.hour * 60 + t.sunset.minute]');
    out.push('      } catch (e) {}');
    out.push('      return null');
    out.push('    }');
    out.push('    const updateSun = () => {');
    out.push('      const m = sunClock.getHours() * 60 + sunClock.getMinutes()');
    out.push('      const t = sunTimes() || [360, 1080]   // without weather data: 06:00 to 18:00 counts as day');
    out.push('      const nextIsSunset = m >= t[0] && m < t[1]');
    for (const w of sunVars) out.push(`      ${w.v}.setProperty(ui.prop.VISIBLE, ${w.set ? 'nextIsSunset' : '!nextIsSunset'})`);
    out.push('    }');
    out.push('    updateSun()');
    out.push('    sunClock.onPerMinute(updateSun)');
    out.push('    ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: updateSun })');
  }
  if (themed) {
    // Everything above becomes buildFace(): a theme switch deletes the widgets it made and builds again
    const body = out.splice(bodyStart).join('\n')
      .replace(/ui\.createWidget\(/g, 'mk(')
      .replace(/\bH\.createWidget\(/g, 'mkH(H, ')
      .replace(/\.(onChange|onPerMinute|onPerSecond)\(([\w$]+)\)/g, '.$1(guard($2, g))');
    const ind = (t) => t.split('\n').map((l) => (l ? '  ' + l : l)).join('\n');
    out.push('    let gen = 0');
    out.push('    const made = []');
    out.push('    const mk = (t, o) => { const w = ui.createWidget(t, o); made.push(w); return w }');
    out.push('    const mkH = (h, t, o) => { const w = h.createWidget(t, o); made.push(w); return w }');
    out.push('    // a timer or sensor callback of an old build must not touch its deleted widgets');
    out.push('    const guard = (f, g) => (...a) => { if (g === gen) return f(...a) }');
    out.push('    const buildFace = () => {');
    out.push('      const g = ++gen');
    if (decls.length) out.push('      initArrays()');
    out.push(ind(body));
    out.push('    }');
    out.push('    const rebuild = () => {');
    out.push('      for (const w of made) { try { if (ui.deleteWidget) ui.deleteWidget(w); else if (typeof hmUI !== \'undefined\') hmUI.deleteWidget(w) } catch (e) {} }');
    out.push('      made.length = 0');
    out.push('      buildFace()');
    out.push('    }');
    out.push('    // a Tap zone calls this; the rebuild runs after the tap handler returns (it deletes the tap zone itself)');
    out.push('    const cycleTheme = () => {');
    out.push('      themeIdx = (themeIdx + 1) % THEME_NAMES.length');
    out.push("      try { if (typeof hmFS !== 'undefined') hmFS.SysProSetInt('dialcraft_theme', themeIdx) } catch (e) {}");
    out.push("      try { if (typeof hmUI !== 'undefined' && hmUI.showToast) hmUI.showToast({ text: THEME_NAMES[themeIdx] }) } catch (e) {}");
    out.push("      if (typeof setTimeout === 'function') setTimeout(rebuild, 0); else rebuild()");
    out.push('    }');
    out.push('    buildFace()');
  }
  if (typeof project.userCode === 'string' && project.userCode.trim()) {
    out.push('');
    out.push('    // ---- user code (project.userCode) ----');
    out.push('    // px() only takes a literal number (the build replaces it, there is no px at run time); pxv() scales a computed one');
    out.push('    const pxv = (n) => Math.round(n * px(1000) / 1000)');
    out.push(project.userCode.trim().split('\n').map((l) => (l ? '    ' + l : l)).join('\n'));
  }
  out.push('  },');
  out.push('');
  out.push('  build() {');
  out.push('    this.initView()');
  out.push('  },');
  out.push('})');
  out.push('');
  return { code: out.join('\n'), warnings: [...new Set(ctx.warnings)] };
}

function generateAppJson(project, device, opts = {}) {
  const appId = Number(opts.appId) || 20000 + Math.floor(Math.random() * 9000);
  // `lockscreen` tells the system the face brings its own AOD (lock screen)
  // design: without it (the default is 0 = none) the watch shows its own AOD
  // face and the widgets' show_level never gets a chance.
  const hasAod = (project.elements || []).some((e) => e.visible !== false && (e.show === 'aod' || e.show === 'both'));
  // a face with complication slots has to say it can be edited on the watch
  const hasEdit = (project.elements || []).some((e) => e.visible !== false && e.kind === 'EDIT_SLOT');
  const doc = {
    configVersion: 'v3',
    app: {
      appId,
      appName: project.name || 'Watchface',
      appType: 'watchface',
      version: { code: 1, name: '1.0.0' },
      icon: 'images/preview.png',
      vender: opts.vender || 'dialcraft',
      description: (project.description || `${project.name || 'watchface'} watchface`).slice(0, 120),
    },
    permissions: [],
    runtime: { apiVersion: apiVersionFor(device.api), type: 0 },
    targets: {
      [device.target]: {
        module: { watchface: { path: `watchface/${device.target}/index`, main: 1, editable: hasEdit ? 1 : 0, lockscreen: hasAod ? 1 : 0 } },
        platforms: platformsFor(device),
        designWidth: device.designWidth,
      },
    },
    i18n: { 'en-US': { appName: project.name || 'Watchface' } },
    defaultLanguage: 'en-US',
    debug: false,
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

function generateAppJs() {
  return [
    "import { log } from '@zos/utils'",
    '',
    "const logger = log.getLogger('app')",
    '',
    'App({',
    '  globalData: {},',
    '  onCreate() {',
    "    logger.log('app on create invoke')",
    '  },',
    '  onDestroy() {',
    "    logger.log('app on destroy invoke')",
    '  },',
    '})',
    '',
  ].join('\n');
}

function generateProjectReadme(project, device) {
  const usedFonts = [...new Set((project.elements || [])
    .map((e) => e && e.fontFile)
    .filter(Boolean)
    .map((f) => path.basename(String(f))))];
  const lines = [
    `# ${project.name || 'Watchface'}`,
    '',
    `Zeus CLI watchface project exported by **Dialcraft**.`,
    '',
    `- Target: ${device.name} (\`${device.target}\`, ${device.w}×${device.h})`,
    `- designWidth: ${device.designWidth}`,
    `- Assets: \`assets/${device.assetDir}/images/\``,
    `- Code: \`watchface/${device.target}/index.js\``,
  ];
  if (usedFonts.length) {
    lines.push(`- Fonts: \`assets/${device.assetDir}/fonts/${usedFonts.join('`, `')}\` — referenced by Text widgets as \`font: 'fonts/<file>'\``);
  }
  lines.push(
    '',
    '## Build / preview',
    '',
    '```bash',
    'npm i @zeppos/zeus-cli -g',
    'zeus dev        # live preview in the Zepp OS simulator',
    'zeus preview    # QR code for the Zepp app (developer mode)',
    'zeus build      # installable package in dist/',
    '```',
    '',
    'Add more devices by copying the `targets` block in `app.json` (the key must',
    'match the `assets/<key>.<st>` folder) — see the device list in the docs:',
    'https://docs.zepp.com/docs/reference/related-resources/device-list/',
    '',
  );
  return lines.join('\n');
}

module.exports = { generateWatchface, generateAppJson, generateAppJs, generateProjectReadme, hexToNum, animPrefixFor };
