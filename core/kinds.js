'use strict';
// Element (widget) kinds the designer can author.
//
// Every kind maps 1:1 to a Zepp OS watchface widget documented at
// https://docs.zepp.com/docs/watchface/api/hmUI/widget/ — the `docs` field is
// the page the parameters come from.
//
//   box      how the editor derives the on-screen box of the element
//            'natural' image size | 'wh' the w/h fields | 'center' centre+size
//   fields   fields the Properties panel edits (see renderer.js propRows)
const KINDS = [
  // ---------------------------------------------------------------- images --
  {
    id: 'IMG', label: 'Image', group: 'Image', docs: 'IMG', box: 'natural',
    defaults: { w: 0, h: 0, angle: 0, posX: 0, posY: 0 },
  },
  {
    id: 'IMG_ANIM', label: 'Animation', group: 'Image', docs: 'IMG_ANIM', box: 'natural',
    defaults: { frames: [], fps: 30, repeat: 0, step: 1, animPrefix: '' },
  },
  {
    id: 'IMG_LEVEL', label: 'Image level (from data)', group: 'Image', docs: 'IMG_LEVEL', box: 'wh',
    defaults: { images: [], w: 100, h: 100, dataType: 'STEP', level: 0 },
  },
  {
    id: 'IMG_PROGRESS', label: 'Image progress bar', group: 'Image', docs: 'IMG_PROGRESS', box: 'natural',
    defaults: { images: [], dataType: 'STEP', level: 0, spread: 24 },
  },
  {
    id: 'IMG_POINTER', label: 'Image pointer (dial)', group: 'Clock', docs: 'IMG_POINTER', box: 'natural',
    defaults: { centerX: 0, centerY: 0, x: 0, y: 0, angle: 0, startAngle: 0, endAngle: 360 },
  },
  // ------------------------------------------------------------------ time --
  {
    id: 'IMG_TIME', label: 'Digital time', group: 'Time', docs: 'IMG_TIME', box: 'natural',
    defaults: { part: 'hour', zero: 0, follow: 0, space: 0, images: [], unit: '', am: '', pm: '', amX: 0, amY: 0, pmX: 0, pmY: 0 },
  },
  {
    id: 'IMG_WEEK', label: 'Weekday', group: 'Time', docs: 'IMG_WEEK', box: 'natural',
    defaults: { images: [] },
  },
  {
    id: 'IMG_DATE', label: 'Date (month / day)', group: 'Time', docs: 'IMG_DATE', box: 'natural',
    defaults: { images: [], part: 'day', zero: 0, follow: 0, space: 0, unit: '', isCharacter: false },
  },
  {
    id: 'DATE_POINTER', label: 'Date pointer (dial)', group: 'Clock', docs: 'DATE_POINTER', box: 'screen',
    defaults: {
      dateType: 'WEEK', centerX: 0, centerY: 0, src: '', posX: 0, posY: 0,
      scale: '', scaleX: 0, scaleY: 0, cover: '', coverX: 0, coverY: 0, startAngle: 0, endAngle: 180,
    },
  },
  {
    id: 'TIME_POINTER', label: 'Analog clock', group: 'Clock', docs: 'TIME_POINTER', box: 'screen',
    defaults: {
      centerX: 0, centerY: 0,
      hour: '', hourPivotX: 0, hourPivotY: 0,
      minute: '', minutePivotX: 0, minutePivotY: 0,
      second: '', secondPivotX: 0, secondPivotY: 0,
      cover: '',
    },
  },
  // ------------------------------------------------------------- data text --
  {
    id: 'TEXT_IMG', label: 'Data reading (digit images)', group: 'Data', docs: 'TEXT_IMG', box: 'natural',
    defaults: {
      dataType: 'STEP', images: [], hSpace: 1, alignH: 'LEFT',
      unit: '', dot: '', negative: '',
    },
  },
  {
    id: 'TEXT', label: 'Text', group: 'Data', docs: 'TEXT', box: 'wh',
    defaults: {
      text: 'MONDAY', color: '#ffffff', size: 32, alignH: 'CENTER_H', alignV: 'CENTER_V',
      lineSpace: 0, charSpace: 0, fontFile: '', weight: 400,
      // fill: solid | gradient | css | outline. The hmUI TEXT widget only knows
      // one flat `color`, so anything else is baked to a PNG on export.
      fillType: 'solid', color2: '#f0f', gradAngle: 90,
      cssGradient: 'linear-gradient(90deg, #ffffff 0%, #7c3aed 100%)',
      outlineColor: '#000000', outlineWidth: 2,
      bold: false, italic: false,
    },
  },
  {
    id: 'IMG_STATUS', label: 'System status icon', group: 'Data', docs: 'IMG_STATUS', box: 'natural',
    defaults: { status: 'DISCONNECT' },
  },
  {
    id: 'IMG_CLICK', label: 'Tap shortcut icon', group: 'Data', docs: 'IMG_CLICK', box: 'natural',
    defaults: { dataType: 'OUTDOOR_RUNNING', w: 40, h: 40 },
  },
  {
    id: 'BAR', label: 'Progress bar (linear)', group: 'Shape', docs: 'FILL_RECT', box: 'wh',
    defaults: { length: 100, lineWidth: 10, rounded: false, vertical: false, inversion: false, mirror: false, color: '#84a6cd', dataType: 'BATTERY', level: 0 },
  },
  {
    id: 'SLEEP_CHART', label: 'Sleep chart', group: 'Data', docs: 'GROUP', box: 'wh',
    defaults: { w: 215, h: 69, colorDeep: '#708eae', colorLight: '#212c35', colorRem: '#8cb0d8', colorWake: '#44556b' },
  },
  {
    id: 'POLYLINE', label: 'Line chart (heart / sleep)', group: 'Data', docs: 'GRADKIENT_POLYLINE', box: 'wh',
    defaults: { w: 200, h: 80, dataType: 'HEART' },
  },
  {
    id: 'EDIT_SLOT', label: 'Complication slot', group: 'Data', docs: 'WATCHFACE_EDIT_GROUP', box: 'wh',
    defaults: { editId: 1, w: 54, h: 29, defaultType: 'STEP', optionalTypes: [], selectImage: '', unSelectImage: '', tipsBg: '', tipsX: 0, tipsY: 0, tipsWidth: 0, tipsMargin: 10 },
  },
  {
    id: 'TAP', label: 'Tap zone', group: 'Data', docs: 'BUTTON', box: 'wh',
    defaults: { w: 100, h: 50, action: 'variant', appUrl: '', note: '' },
  },
  // ---------------------------------------------------------------- shapes --
  {
    id: 'FILL_RECT', label: 'Filled rectangle', group: 'Shape', docs: 'FILL_RECT', box: 'wh',
    defaults: { w: 100, h: 100, color: '#101522', radius: 0, angle: 0 },
  },
  {
    id: 'STROKE_RECT', label: 'Stroked rectangle', group: 'Shape', docs: 'STROKE_RECT', box: 'wh',
    defaults: { w: 100, h: 100, color: '#ffffff', radius: 0, lineWidth: 4, angle: 0 },
  },
  {
    id: 'CIRCLE', label: 'Circle', group: 'Shape', docs: 'CIRCLE', box: 'center',
    defaults: { centerX: 0, centerY: 0, radius: 60, color: '#ffffff', alpha: 255 },
  },
  {
    id: 'ARC', label: 'Arc', group: 'Shape', docs: 'ARC', box: 'wh',
    defaults: { w: 200, h: 200, radius: 90, startAngle: -90, endAngle: 90, lineWidth: 12, color: '#34e073' },
  },
  {
    id: 'ARC_PROGRESS', label: 'Arc progress', group: 'Shape', docs: 'ARC_PROGRESS', box: 'center',
    defaults: { centerX: 0, centerY: 0, radius: 120, startAngle: -90, endAngle: 270, lineWidth: 12, color: '#34e073', dataType: 'STEP', bg: '', level: 0 },
  },
];

const KIND_BY_ID = Object.fromEntries(KINDS.map((k) => [k.id, k]));
function kind(id) { return KIND_BY_ID[id] || null; }
function kindLabel(id) { const k = KIND_BY_ID[id]; return k ? k.label : id; }
function newElement(kindId, patch = {}) {
  const k = kind(kindId);
  const el = {
    id: `el${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    kind: kindId,
    name: kindLabel(kindId),
    x: 0, y: 0,
    // new components start in Normal only — AOD is opt-in (presets set it)
    show: 'normal',
    visible: true, locked: false, group: null, alpha: 255,
    ...(k ? k.defaults : {}),
    ...patch,
  };
  return el;
}
// show_level expression fragments (renderer draws the same three states)
const SHOW_LEVELS = [
  { key: 'normal', label: 'Normal only' },
  { key: 'aod', label: 'AOD only' },
  { key: 'both', label: 'Normal + AOD' },
  { key: 'edit', label: 'Edit mode only' },
];

module.exports = { KINDS, KIND_BY_ID, kind, kindLabel, newElement, SHOW_LEVELS };
