// extra readings that have no preset of their own
for (const e of project.elements) if (e.showWhen === 'sunrise' || e.showWhen === 'sunset') delete e.showWhen;
project.elements = project.elements.filter((e) => e.name !== 'Sunrise icon' && e.name !== 'Sunset icon');
await dataTextPreset('WEATHER_HIGH', 'Temp high', ['degree', '°'], ['negative', '-']);
await dataTextPreset('WEATHER_LOW', 'Temp low', ['degree', '°'], ['negative', '-']);
await dataTextPreset('WIND_SPEED', 'Wind', ['mps', 'm/s']);
await dataTextPreset('ALTIMETER', 'Pressure', ['hpa', 'hPa']);
// the month as a name (NOV), like the date row of the sketch
{ const m = project.elements.find((e) => e.name === 'Month'); m.isCharacter = true; m.part = 'month'; rememberGlyphStyle(m, 34); m.images = await genLabelSet(m, 'month'); }
return project.elements.map((e) => e.name).join(' | ');
