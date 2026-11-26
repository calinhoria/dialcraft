const DIAL = { centerX: 195, centerY: 218.5, radius: 158, trackRadius: 175 };
const MARKER_SIZE = 69;

function markerAt(angle) {
  const point = solarDialPoint(DIAL, angle);
  return { x: Math.round(point.x - MARKER_SIZE / 2), y: Math.round(point.y - MARKER_SIZE / 2) };
}

function solarTimes(weather) {
  if (!weather) return [360, 1080];
  // Firmware versions expose either method name.
  for (const method of ['getForecastWeather', 'getForecast']) {
    try {
      if (typeof weather[method] !== 'function') continue;
      const forecast = weather[method]();
      const today = forecast && forecast.tideData && forecast.tideData.data && forecast.tideData.data[0];
      if (!today) continue;
      const rise = toMinutes(today.sunrise);
      const set = toMinutes(today.sunset);
      if (rise >= 0 && set > rise) return [rise, set];
    } catch (error) { /* Try the alternate method or use the default daylight interval. */ }
  }
  return [360, 1080];
}

function toMinutes(time) {
  if (!time || !Number.isInteger(time.hour) || !Number.isInteger(time.minute) ||
      time.hour < 0 || time.hour > 23 || time.minute < 0 || time.minute > 59) return -1;
  return time.hour * 60 + time.minute;
}
