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
const { dataType } = require('./datatypes');
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
function arrName(el) { return `img_${ident(el.name)}_${el.id.slice(-4)}`; }

// A widget that has lost its picture would be built with a reference to an
// image the package does not contain — the watch then fails to initialise the
// face, taking every widget after it down as well. Those layers are reported
// and left out of the code instead.
function missingPicture(el) {
  switch (el.kind) {
    case 'IMG': case 'IMG_POINTER': return !el.src;
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
  return fill !== 'solid' || !!el.bold || !!el.italic;
}
function bakeReason(el) {
  const why = [];
  if ((el.fillType || 'solid') === 'gradient') why.push('gradient fill');
  else if ((el.fillType || 'solid') === 'css') why.push('CSS gradient fill');
  else if ((el.fillType || 'solid') === 'outline') why.push('outline fill');
  if (el.bold) why.push('bold');
  if (el.italic) why.push('italic');
  return why.join(' + ') || 'styled text';
}

// one line of `key: value,` when the value is present
function kv(lines, key, value, when = true) {
  if (!when || value === null || value === undefined || value === '') return;
  lines.push(`    ${key}: ${value},`);
}

function emitElement(el, ctx, out) {
  const { arrays } = ctx;
  const L = [];
  const sl = `show_level: ${showLevel(el.show)}`;
  const alpha = el.alpha != null && el.alpha < 255 ? `alpha: ${Math.max(0, num(el.alpha))},` : null;

  switch (el.kind) {
    case 'IMG': {
      L.push('  ui.createWidget(ui.widget.IMG, {');
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
      kv(L, 'show_level', showLevel(el.show));
      out.push(L.join('\n').replace(/,(\s*)$/, '$1') + '\n  })');
      break;
    }
    case 'TEXT': {
      // A gradient/outline fill, bold or italic cannot be expressed with the
      // TEXT widget (docs: only `color`, `text_size`, `font`, spacing), so those
      // layers are rasterised by the designer and shipped as a picture.
      if (needsTextBake(el)) {
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
      L.push('  ui.createWidget(ui.widget.TEXT, {');
      kv(L, 'x', p(el.x)); kv(L, 'y', p(el.y));
      kv(L, 'w', p(el.w || 200)); kv(L, 'h', p(el.h || 40));
      kv(L, 'color', `0x${hexToNum(el.color).toString(16).padStart(6, '0')}`);
      kv(L, 'text_size', p(el.size || 32));
      kv(L, 'align_h', `ui.align.${el.alignH || 'CENTER_H'}`);
      kv(L, 'align_v', `ui.align.${el.alignV || 'CENTER_V'}`);
      if (el.lineSpace) kv(L, 'line_space', p(el.lineSpace));
      if (el.charSpace) kv(L, 'char_space', p(el.charSpace));
      kv(L, 'text', JSON.stringify(el.text == null ? '' : String(el.text)));
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
      if (el.dataType) kv(L, 'type', `ui.data_type.${el.dataType}`);
      kv(L, 'font_array', arrays[arrName(el)]);
      if (el.hSpace) kv(L, 'h_space', p(el.hSpace));
      kv(L, 'align_h', `ui.align.${el.alignH || 'LEFT'}`);
      if (el.unit) { kv(L, 'unit_en', asset(el, 'unit')); kv(L, 'unit_sc', asset(el, 'unit')); kv(L, 'unit_tc', asset(el, 'unit')); }
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
    case 'TIME_POINTER': {
      const hands = [['hour', el.hour, el.hourPivotX, el.hourPivotY], ['minute', el.minute, el.minutePivotX, el.minutePivotY], ['second', el.second, el.secondPivotX, el.secondPivotY]];
      for (const [name, src, px_, py] of hands) {
        if (!src) continue;
        kv(L, `${name}_centerX`, p(el.centerX)); kv(L, `${name}_centerY`, p(el.centerY));
        kv(L, `${name}_posX`, p(px_)); kv(L, `${name}_posY`, p(py));
        kv(L, `${name}_path`, A(src));
      }
      if (el.cover) { kv(L, 'hour_cover_path', A(el.cover)); kv(L, 'hour_cover_x', p(el.centerX)); kv(L, 'hour_cover_y', p(el.centerY)); }
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
      kv(L, 'x', `[${Array.from({ length: n }, (_, i) => p(num(el.x) + i * spread)).join(', ')}]`);
      kv(L, 'y', `[${Array.from({ length: n }, () => p(el.y)).join(', ')}]`);
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
  const ctx = { sensors: new Set(), declared: new Set(), arrays: {}, warnings: [] };
  const els = (project.elements || []).filter((e) => e.visible !== false);
  // ---- declare the image arrays the widgets reference ----
  const decls = [];
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
    decls.push(`const ${id} = [\n${names.map((n) => `  ${A(n)}`).join(',\n')},\n]`);
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
  out.push("import ui from '@zos/ui'");
  if (ctx.sensors.size) {
    out.push(`import { ${[...ctx.sensors].sort().join(', ')} } from '@zos/sensor'`);
  }
  out.push('');
  out.push('const A = (p) => `images/${p}`');
  out.push('');
  if (decls.length) {
    out.push('// ---- image arrays (frame order matters: digits 0-9, week 1-7) ----');
    out.push(decls.join('\n\n'));
    out.push('');
  }
  out.push('WatchFace({');
  out.push('  initView() {');
  if (!els.length) {
    out.push('    // no visible elements yet');
  }
  for (const el of els) {
    if (missingPicture(el)) {
      ctx.warnings.push(`${el.name}: no picture — left out of the export`);
      continue;
    }
    // A layer shown in both states becomes two widgets — one ONLY_NORMAL, one
    // ONLY_AOD — because the watch's AOD path only picks up widgets that carry
    // the AOD bit on its own (the combined bitmask is not honoured). This is the
    // structure every shipping watchface uses.
    const both = (el.show || 'both') === 'both';
    const states = both ? ['normal', 'aod'] : [el.show || 'normal'];
    for (const state of states) {
      out.push(`    // ${el.name} (${el.kind})${both ? ` — ${state === 'aod' ? 'AOD (screen-off)' : 'normal state'}` : ''}`);
      const chunk = [];
      emitElement({ ...el, show: state, _emitState: both ? state : null }, ctx, chunk);
      // the emitters are written at a 2-space base indent; shift them inside initView
      for (const line of chunk.join('\n').split('\n')) out.push(line ? '  ' + line : line);
      out.push('');
    }
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
        module: { watchface: { path: `watchface/${device.target}/index`, main: 1, editable: 0, lockscreen: hasAod ? 1 : 0 } },
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
