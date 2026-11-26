const time = new SolarSensors.Time();
let weather;
try {
  if (SolarSensors.Weather) weather = new SolarSensors.Weather();
} catch (error) { /* Weather is optional. */ }

const normal = ui.show_level.ONLY_NORMAL;
const twilightColors = [0xdfaa81, 0xb594c7, 0x8299d3];
const track = [];
let lastMarker;
let lastSky;
let lastTide;

function drawTrack(state) {
  track.forEach((widget) => ui.deleteWidget(widget));
  track.length = 0;
  const radius = DIAL.trackRadius;
  const arc = (start, end, color) => {
    if (end <= start) return;
    track.push(ui.createWidget(ui.widget.ARC, {
      x: pxv(DIAL.centerX - radius), y: pxv(DIAL.centerY - radius),
      w: pxv(radius * 2), h: pxv(radius * 2), radius: pxv(radius),
      start_angle: start, end_angle: end, line_width: pxv(2), color, show_level: normal,
    }));
  };
  arc(0, 359.99, 0x536d9d);
  const start = (state.sunrise + 270) % 360;
  const end = start + state.sunset - state.sunrise;
  arc(start, Math.min(end, 360), 0xf6be59);
  if (end > 360) arc(0, end - 360, 0xf6be59);
  state.twilight.forEach((angle, index) => {
    const point = solarDialPoint(DIAL, angle, radius - 8);
    track.push(ui.createWidget(ui.widget.CIRCLE, {
      center_x: pxv(point.x), center_y: pxv(point.y), radius: pxv(2),
      color: twilightColors[Math.floor(index / 2)], show_level: normal,
    }));
  });
}

function update() {
  const minute = time.getHours() * 60 + time.getMinutes();
  const [rise, set] = solarTimes(weather);
  const state = solarDialState(minute, rise, set);
  const marker = markerAt(state.angle);
  if (lastSky !== state.sky) {
    W.solarSky.setProperty(ui.prop.SRC, F.solarSky[state.sky]);
    lastSky = state.sky;
  }
  if (!lastMarker || marker.x !== lastMarker.x || marker.y !== lastMarker.y || state.day !== lastMarker.day) {
    W.solarMarker.setProperty(ui.prop.MORE, {
      x: pxv(marker.x), y: pxv(marker.y), src: F.solarMarker[state.day ? 0 : 1],
    });
    lastMarker = { ...marker, day: state.day };
  }
  const tide = rise * 1440 + set;
  if (lastTide !== tide) {
    lastTide = tide;
    drawTrack(state);
  }
}

update();
time.onPerMinute(update);
ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: update });
