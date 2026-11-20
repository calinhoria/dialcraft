# Forecast Dial: sources

`make.py` builds `recipe.json` (run from this folder, then `electron tools/face-cli.js ../recipe.json`):
fonts (`antonio-400.ttf` from `.claude/skills/create-amazfit-watchface/examples/animated/fonts`), the presets, `add.js` (extra readings),
`styles.json` (glyph styles), `place.js` (layout, shapes drawn in code, icons) and `forecast.code.js` (the five-day forecast, run on the watch).

The icons were generated externally on five magenta-background sheets (prompts in the skill's `references/asset-prompts.md` style):
`cut_icons.py` keys the magenta and cuts each cell into `icons/<name>.png` (white on transparent masters, kept here);
`bake_icons.py` bakes them at watch size with thickened strokes into `icons.json`, which `place.js` embeds.
Sheets 1-3: globe, runner, compass, moon, sunrise, wind, bolt, footprints, heart, flame and 14 weather icons; sheets 4-5: the other 17 weather icons (the watch has 29).
