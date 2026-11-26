// readings that have no preset of their own: current / high / low temperature with the degree sign
await dataTextPreset('WEATHER_CURRENT', 'Temp now', ['degree', '°'], ['negative', '-']);
await dataTextPreset('WEATHER_HIGH', 'Temp high', ['degree', '°'], ['negative', '-']);
await dataTextPreset('WEATHER_LOW', 'Temp low', ['degree', '°'], ['negative', '-']);
return project.elements.map((e) => e.name).join(' | ');
