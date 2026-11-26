'use strict';

function solarDialState(minute, rise, set) {
  if (!Number.isFinite(rise) || !Number.isFinite(set) || rise < 0 || set >= 1440 || set <= rise) {
    rise = 360;
    set = 1080;
  }
  const daylight = set - rise;
  const noon = (rise + set) / 2;
  const wrap = (m) => ((m % 1440) + 1440) % 1440;
  const sinceRise = wrap(minute - rise);
  const day = sinceRise < daylight;
  const fromHorizon = day ? Math.min(sinceRise, daylight - sinceRise) :
    Math.min(sinceRise - daylight, 1440 - sinceRise);
  // Zepp tide data gives the two horizon crossings. These three markers are estimated.
  const twilight = [30, 60, 90].filter((offset) => offset < (1440 - daylight) / 2);
  const sky = day ? (fromHorizon < 30 ? 1 : 0) :
    fromHorizon < 30 ? 1 : fromHorizon < 60 ? 2 : fromHorizon < 90 ? 3 : 4;
  const angleAt = (m) => (m - noon) / 4;
  return {
    angle: angleAt(minute),
    day,
    sky,
    sunrise: angleAt(rise),
    sunset: angleAt(set),
    twilight: twilight.flatMap((offset) => [angleAt(rise - offset), angleAt(set + offset)]),
  };
}

function solarDialPoint(dial, angle, radius = dial.radius) {
  const radians = angle * Math.PI / 180;
  return {
    x: dial.centerX + radius * Math.sin(radians),
    y: dial.centerY - radius * Math.cos(radians),
  };
}

if (typeof module !== 'undefined') module.exports = { solarDialState, solarDialPoint };
