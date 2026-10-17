'use strict';
// Zepp OS watchface data sources.
//
// Source: https://docs.zepp.com/docs/watchface/api/hmUI/widget/data_type/
// plus the watchface design specification
// (https://docs.zepp.com/docs/watchface/specification/) for the digit maxima
// the store review enforces, and the official color-world sample for
// `data_type.WEATHER` (29 weather icons, index list in the specification).
//
//   digits   maximum digits the design spec allows for that reading
//   unit     unit image shown by TEXT_IMG (unit_en/sc/tc)
//   preview  value used by the editor's Test data panel (spec default data)
//   reader   how the on-watch value can be refreshed in hand-written code
//            (`@zos/sensor` class + getter), used when a widget has no built-in
//            `type` binding (ARC_PROGRESS)
//   bound    the framework updates the widget itself when `type` is passed
const DATA_TYPES = [
  // ---- time & date ---------------------------------------------------------
  { key: 'TIME', label: 'Time (HH:MM)', group: 'Time', digits: 5, preview: null, note: 'Use IMG_TIME for digital time' },
  { key: 'DATE', label: 'Date', group: 'Time', digits: 4, preview: null, note: 'Use IMG_DATE for month/day' },
  { key: 'WEEK', label: 'Weekday', group: 'Time', digits: 1, preview: null, note: 'Use IMG_WEEK for the weekday set' },
  { key: 'ALARM_CLOCK', label: 'Alarm', group: 'Time', digits: 5, preview: '07:30', bound: true },
  { key: 'COUNT_DOWN', label: 'Countdown (min/sec)', group: 'Time', digits: 2, preview: 25, bound: true },
  { key: 'STOP_WATCH', label: 'Stopwatch (min/sec)', group: 'Time', digits: 2, preview: 12, bound: true },
  { key: 'SLEEP', label: 'Sleep time', group: 'Time', digits: 5, preview: '07:24', bound: true, unit: '' },
  { key: 'SUN_CURRENT', label: 'Time to sunrise/sunset', group: 'Weather', digits: 5, preview: '02:15', bound: true },
  { key: 'SUN_RISE', label: 'Sunrise', group: 'Weather', digits: 5, preview: '06:30', bound: true },
  { key: 'SUN_SET', label: 'Sunset', group: 'Weather', digits: 5, preview: '18:30', bound: true },

  // ---- activity ------------------------------------------------------------
  { key: 'STEP', label: 'Steps', group: 'Activity', digits: 5, preview: 8670, reader: { cls: 'Step', get: 'getCurrent' } },
  { key: 'STEP_TARGET', label: 'Step target', group: 'Activity', digits: 5, preview: 10000, reader: { cls: 'Step', get: 'getTarget' } },
  { key: 'CAL', label: 'Calories', group: 'Activity', digits: 4, preview: 280, reader: { cls: 'Calorie', get: 'getCurrent' } },
  { key: 'CAL_TARGET', label: 'Calorie target', group: 'Activity', digits: 4, preview: 500, reader: { cls: 'Calorie', get: 'getTarget' } },
  { key: 'DISTANCE', label: 'Distance', group: 'Activity', digits: 6, preview: 5.3, dot: true, reader: { cls: 'Distance', get: 'getCurrent' }, note: 'shown as 0.00 / 00.0' },
  { key: 'STAND', label: 'Stand (hours)', group: 'Activity', digits: 2, preview: 7, reader: { cls: 'Stand', get: 'getCurrent' } },
  { key: 'STAND_TARGET', label: 'Stand target', group: 'Activity', digits: 2, preview: 12, reader: { cls: 'Stand', get: 'getTarget' } },
  { key: 'FLOOR', label: 'Floors climbed', group: 'Activity', digits: 3, preview: 8 },
  { key: 'ALTIMETER', label: 'Air pressure', group: 'Activity', digits: 5, preview: 1013, reader: { cls: 'Barometer', get: 'getAirPressure' } },
  { key: 'ALTITUDE', label: 'Altitude', group: 'Activity', digits: 5, preview: 342, reader: { cls: 'Barometer', get: 'getAltitude' } },
  { key: 'FAT_BURNING', label: 'Fat burning (min)', group: 'Activity', digits: 3, preview: 65, reader: { cls: 'FatBurning', get: 'getCurrent' } },
  { key: 'FAT_BURNING_TARGET', label: 'Fat burning target', group: 'Activity', digits: 3, preview: 90, reader: { cls: 'FatBurning', get: 'getTarget' } },
  { key: 'MONTH_RUN_TIMES', label: 'Month run times', group: 'Activity', digits: 3, preview: 6 },
  { key: 'MONTH_RUN_DISTANCE', label: 'Month run distance', group: 'Activity', digits: 6, preview: 150.98, dot: true },
  { key: 'TRAINING_LOAD', label: 'Training load', group: 'Activity', digits: 3, preview: 240 },
  { key: 'VO2MAX', label: 'VO2 max', group: 'Activity', digits: 2, preview: 48 },
  { key: 'RECOVERY_TIME', label: 'Recovery time', group: 'Activity', digits: 2, preview: 18 },
  { key: 'READINESS', label: 'Readiness', group: 'Activity', digits: 3, preview: 76 },

  // ---- health --------------------------------------------------------------
  { key: 'HEART', label: 'Heart rate', group: 'Health', digits: 3, preview: 86, unit: 'bpm', reader: { cls: 'HeartRate', get: 'getCurrent' } },
  { key: 'SPO2', label: 'Blood oxygen', group: 'Health', digits: 3, preview: 98, unit: '%', reader: { cls: 'BloodOxygen', get: 'getCurrent' } },
  { key: 'STRESS', label: 'Stress', group: 'Health', digits: 3, preview: 42, reader: { cls: 'Stress', get: 'getCurrent' } },
  { key: 'PAI_DAILY', label: 'PAI today', group: 'Health', digits: 3, preview: 42, reader: { cls: 'Pai', get: 'getToday' } },
  { key: 'PAI_WEEKLY', label: 'PAI weekly', group: 'Health', digits: 3, preview: 168, reader: { cls: 'Pai', get: 'getTotal' } },

  // ---- weather -------------------------------------------------------------
  { key: 'WEATHER_CURRENT', label: 'Temperature (current)', group: 'Weather', digits: 3, preview: 22, unit: '°C', negative: true, bound: true },
  { key: 'WEATHER_LOW', label: 'Temperature (low)', group: 'Weather', digits: 3, preview: 14, unit: '°C', negative: true, bound: true },
  { key: 'WEATHER_HIGH', label: 'Temperature (high)', group: 'Weather', digits: 3, preview: 27, unit: '°C', negative: true, bound: true },
  { key: 'HUMIDITY', label: 'Humidity', group: 'Weather', digits: 3, preview: 42, unit: '%', bound: true },
  { key: 'UVI', label: 'UV index', group: 'Weather', digits: 2, preview: 4, bound: true },
  { key: 'AQI', label: 'Air quality (mainland CN)', group: 'Weather', digits: 3, preview: 26, bound: true },
  { key: 'WIND', label: 'Wind force level', group: 'Weather', digits: 2, preview: 3, bound: true },
  { key: 'WEATHER', label: 'Weather icon', group: 'Weather', digits: 2, preview: 3, bound: true, icons: true, note: '29 icons, index order from the design specification' },

  // ---- system --------------------------------------------------------------
  { key: 'BATTERY', label: 'Battery', group: 'System', digits: 3, preview: 75, unit: '%', reader: { cls: 'Battery', get: 'getCurrent' } },

  // ---- click-only shortcuts (IMG_CLICK) ------------------------------------
  { key: 'MOON', label: 'Moon phase (tap)', group: 'Shortcut', digits: 2, preview: 0, bound: true, clickOnly: true },
  { key: 'OUTDOOR_RUNNING', label: 'Outdoor running (tap)', group: 'Shortcut', digits: 0, clickOnly: true, bound: true },
  { key: 'WALKING', label: 'Walking (tap)', group: 'Shortcut', digits: 0, clickOnly: true, bound: true },
  { key: 'OUTDOOR_CYCLING', label: 'Outdoor cycling (tap)', group: 'Shortcut', digits: 0, clickOnly: true, bound: true },
  { key: 'FREE_TRAINING', label: 'Free training (tap)', group: 'Shortcut', digits: 0, clickOnly: true, bound: true },
  { key: 'POOL_SWIMMING', label: 'Pool swimming (tap)', group: 'Shortcut', digits: 0, clickOnly: true, bound: true },
  { key: 'OPEN_WATER_SWIMMING', label: 'Open water swimming (tap)', group: 'Shortcut', digits: 0, clickOnly: true, bound: true },
  { key: 'PHN', label: 'Sports coach (tap)', group: 'Shortcut', digits: 0, clickOnly: true, bound: true },
  { key: 'BREATH_TRAIN', label: 'Breath training (tap)', group: 'Shortcut', digits: 0, clickOnly: true, bound: true },
];

const BY_KEY = Object.fromEntries(DATA_TYPES.map((d) => [d.key, d]));
function dataType(key) { return BY_KEY[key] || null; }
function dtLabel(key) { const d = BY_KEY[key]; return d ? d.label : key; }
function unitsFor(key) {
  const d = BY_KEY[key];
  if (!d) return '°C';
  if (d.unit === '°C') return '°C';
  return d.unit || '';
}
// cells the reading can occupy (used to size TEXT_IMG widgets in the editor)
function digitCount(key, value) {
  const d = BY_KEY[key];
  if (!d) return 3;
  if (d.digits) return d.digits;
  const s = String(value == null ? '' : value);
  return Math.max(1, s.replace(/[^0-9]/g, '').length);
}
// weather icon index table (design specification "type data" table)
const WEATHER_ICONS = [
  'Cloudy', 'Shower', 'Snow shower', 'Sunny', 'Overcast', 'Light rain', 'Light snow',
  'Moderate rain', 'Moderate snow', 'Heavy snow', 'Heavy rain', 'Sandstorm', 'Sleet',
  'Fog', 'Haze', 'Thundershower', 'Snowstorm', 'Dust', 'Extraordinary rainstorm',
  'Rain with hail', 'Thundershowers with hail', 'Heavy rainstorm', 'Sand blowing',
  'Strong sandstorm', 'Rainstorm', 'Unknown weather', 'Cloudy at night', 'Shower at night',
  'Clear night',
];
// hmUI.system_status values for IMG_STATUS elements
const SYSTEM_STATUS = [
  { key: 'CLOCK', label: 'Alarm clock on' },
  { key: 'DISCONNECT', label: 'Bluetooth disconnected' },
  { key: 'DISTURB', label: 'Do not disturb' },
  { key: 'LOCK', label: 'Lock screen on' },
];

module.exports = { DATA_TYPES, dataType, dtLabel, unitsFor, digitCount, WEATHER_ICONS, SYSTEM_STATUS };
