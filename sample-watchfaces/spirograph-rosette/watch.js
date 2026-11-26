const time = new Time();
const normal = ui.show_level.ONLY_NORMAL;
const digitWidth = 52;
const loopOutline = { data_array: [] };
const segment = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 };
const brush = { color: 0xffffff, line_width: 1 };
const ACCENT_SEGMENTS = 28;
const wipe = { x: 0, y: 0, w: ART.w, h: ART.h };
const holeCover = { center_x: ART.w / 2, center_y: ART.h / 2, radius_x: 40, radius_y: 35, color: 0 };
let model = DEFAULT_MODEL;
let drawing = makeRosette(model);
let color = 0;
let renderTimer = null;
let drawn = 0;
let paused = false;

function drawBatch() {
  renderTimer = null;
  const first = drawing.paths[drawn];
  const whiteEnd = drawing.paths.length / 2;
  const end = first.accent ? drawn + 1 : Math.min(drawn + 10, whiteEnd);
  for (; drawn < end; drawn++) {
    const loop = drawing.paths[drawn];
    brush.color = loop.accent ? PALETTE[color] : INK;
    W.rosette.setPaint(brush);
    if (loop.accent) {
      // Use the same per-segment color as Spirograph Live. Draw at most one
      // accent path per callback so native rendering yields between paths.
      const last = loop.data.length - 1;
      let from = loop.data[0];
      segment.color = brush.color;
      for (let i = 1; i <= ACCENT_SEGMENTS; i++) {
        const to = loop.data[Math.round(i * last / ACCENT_SEGMENTS)];
        segment.x1 = from.x;
        segment.y1 = from.y;
        segment.x2 = to.x;
        segment.y2 = to.y;
        W.rosette.drawLine(segment);
        from = to;
      }
    } else {
      loopOutline.data_array = loop.data;
      W.rosette.strokePoly(loopOutline);
    }
  }
  if (drawn === drawing.paths.length) {
    holeCover.radius_x = drawing.hole.x;
    holeCover.radius_y = drawing.hole.y;
    W.rosette.drawEllipse(holeCover);
  } else {
    renderTimer = setTimeout(drawBatch, 16);
  }
}

function stopDrawing() {
  if (renderTimer !== null) clearTimeout(renderTimer);
  renderTimer = null;
}

function redraw() {
  stopDrawing();
  drawn = 0;
  W.rosette.clear(wipe);
  if (!paused) drawBatch();
}

function photo(name, x, y, w, h) {
  return ui.createWidget(ui.widget.IMG, { x: pxv(x), y: pxv(y), w: pxv(w), h: pxv(h), src: A(name), show_level: normal });
}

const minutes = [
  photo('minute_0_0.png', 207, 331, digitWidth, 64),
  photo('minute_0_0.png', 259, 331, digitWidth, 64),
];
const labelParts = [
  photo('weekday_2.png', 49, 26, 62, 22),
  photo('month_0.png', 106, 26, 62, 22),
  photo('day_28.png', 154, 26, 30, 22),
];

let lastMinute = -1;
let dateKey = '';
function updateTime(force) {
  const minute = time.getMinutes();
  if (force || minute !== lastMinute) {
    minutes[0].setProperty(ui.prop.SRC, A('minute_' + color + '_' + Math.floor(minute / 10) + '.png'));
    minutes[1].setProperty(ui.prop.SRC, A('minute_' + color + '_' + minute % 10 + '.png'));
    lastMinute = minute;
  }
  const weekday = time.getDay() % 7;
  const month = time.getMonth() - 1;
  const day = time.getDate();
  const key = weekday + '/' + month + '/' + day;
  if (dateKey === key) return;
  dateKey = key;
  const cwd = DATE_WIDTHS.weekdays[weekday];
  const cm = DATE_WIDTHS.months[month];
  labelParts[0].setProperty(ui.prop.MORE, { x: pxv(49), w: pxv(cwd), src: A('weekday_' + weekday + '.png') });
  labelParts[1].setProperty(ui.prop.MORE, { x: pxv(49 + cwd), w: pxv(cm), src: A('month_' + month + '.png') });
  labelParts[2].setProperty(ui.prop.MORE, { x: pxv(49 + cwd + cm), w: pxv(DATE_WIDTHS.days[day - 1]), src: A('day_' + day + '.png') });
}

const batteryInk = W.batteryIcon;
function recolorBattery() {
  batteryInk.setProperty(ui.prop.SRC, A('battery_' + color + '.png'));
}

W.rosette.addEventListener(ui.event.CLICK_UP, () => {
  model = generateModel(model, Math.random);
  drawing = makeRosette(model);
  redraw();
});

// A transparent button keeps the accent tap independent of the art's canvas.
ui.createWidget(ui.widget.BUTTON, {
  x: px(205), y: px(331), w: px(108), h: px(63),
  normal_src: A('transparent.png'), press_src: A('transparent.png'),
  show_level: normal,
  click_func: () => {
    color = (color + 1) % PALETTE.length;
    updateTime(true);
    recolorBattery();
    redraw();
  },
});

time.onPerMinute(() => updateTime(false));
ui.createWidget(ui.widget.WIDGET_DELEGATE, {
  pause_call: () => { paused = true; stopDrawing(); },
  resume_call: () => {
    paused = false;
    updateTime(false);
    if (drawn < drawing.paths.length && renderTimer === null) drawBatch();
  },
});
updateTime(true);
recolorBattery();
redraw();
