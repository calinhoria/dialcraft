# Fonts (external, free, with Romanian)

Digits, weekday names and other readings are baked into PNG images from a font at design time, so a font is a design asset and never
ships in the watchface (unless a `TEXT` layer uses it). Any TTF can be used headlessly.

## Get a font

```bash
python3 .claude/skills/create-amazfit-watchface/examples/animated/get_fonts.py figtree:700 jetbrains-mono:700 instrument-serif:400
```

`<fontsource id>:<weight>` → `examples/animated/fonts/<id>-<weight>.ttf` (git-ignored). Fontsource splits each family into unicode-range subsets
and `latin` alone has **no ă ș ț** (only â î), so the script downloads `latin` and `latin-ext` and merges them. It prints whether the result
covers `ăâîșțĂÂÎȘȚ` and the digits and symbols a face needs (`0-9 : . % °`); trust that line, because a family can lack ș/ț even in latin-ext.
All fonts here are SIL OFL.

## Register it in a recipe

In the first `script` step, before any preset, with the file embedded as base64 (the recipe stays self-contained):

```js
await registerCustomFont({ name: 'figtree-700.ttf', family: 'Figtree', format: 'truetype', ext: '.ttf', dataBase64: '<base64>' });
glyphFont = 'Figtree'; glyphOpts.size = 18;    // new presets draw in it; 18 keeps unit pictures (bpm, %) small
```

then name it in `glyph.font` of each layer's `edit` step. `examples/animated/build_face.py` does all of this from a `fonts` list.

Canvas text drawn in a build script (`txt(g, …)`) uses the same family once it is registered; `await document.fonts.load('40px "Figtree"')`
if a sprite is drawn before the page has used it.

## A saved project must carry its fonts

face-cli's `save` writes the project JSON and the images but **not the fonts**: the saved project then lists `fonts: []` and the app falls back
to a system font for any letter it re-renders. Copy the TTFs to `<project>/fonts/`, set `project.fonts = [{name, family}]` and
`project.font`, add the licence note, then reopen the project once to prove it (`publish_sample.py` does all four).

## Which families cover Romanian (checked on the merged files)

Cover ă â î ș ț and the digits: Figtree, JetBrains Mono, Antonio, Instrument Serif, DM Mono, Abril Fatface, Libre Franklin, Courier Prime,
Roboto, Bodoni Moda, Source Code Pro, Oxanium, Unbounded, Big Shoulders Display, Outfit, Baloo 2, Paytone One, Bungee, Bangers, Gluten, Dongle,
Coiny, Lemon, Cherry Bomb One, Rubik (and its Glitch / Bubbles / Dirt cuts), Modak, Caveat Brush, Chakra Petch, Space Mono, Syne, Pixelify Sans,
Kode Mono, Sora, Manrope, Lexend, DM Sans, Poppins.

Do **not** cover it (missing ș ț, or ă ș ț too): Righteous, Fredoka, Audiowide, Lilita One, Chewy, Permanent Marker, Creepster, Shrikhand,
Knewave, Luckiest Guy, Bubblegum Sans, Special Elite, Titan One, Russo One, Rubik Mono One, Nosifer, Eater, Press Start-style families
other than Pixelify, Workbench, Sixtyfour, DotGothic16. A face in Romanian with one of these shows borrowed letters in the weekday names.
