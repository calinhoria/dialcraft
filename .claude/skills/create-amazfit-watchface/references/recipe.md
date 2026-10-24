# Recipe format

A recipe is one JSON file (no comments in the real file — the `//` notes below are only explanations). Relative paths
(`out`, `preview`, …) are resolved next to the recipe file.

```json
{
  "name": "Neon Pulse",            // face name (also the Zeus project name)
  "device": "bip-6",               // a target key from devices.md
  "font": "Orbitron",              // glyph font for digits / weekday / readings (a bundled family)
  "language": "en-US",             // optional; weekday / month names follow it (ro-RO, de-DE …)
  "optimizePng": false,            // optional; "lossless" re-encodes every PNG without changing a pixel; true also re-saves big (>20 KB) ones as 256-colour PNGs when clearly smaller; a number 2–256 reduces every animation frame to that many colours (lossy) and re-encodes the rest losslessly
  "description": "…",              // optional store description
  "userImports": "…", "userCode": "…", // optional JavaScript written into the watchface (see docs/GUIDE.md → Code of your own)
  "open": "path/to/project",       // optional; start from a saved Dialcraft project instead of a blank one (read only; see custom-code.md)
  "steps": [ … ],                  // applied in order — see below
  "preview": "preview.png",        // normal-state PNG at device size (10:09:36)
  "previewAod": "preview-aod.png", // AOD-state PNG
  "save": "project",               // optional: write the editable Dialcraft project here
  "out": "out/neon-pulse",         // optional: write the Zeus project here
  "build": false                   // true: also run the Zeus CLI (needs Node + network) → dist/*.zab
}
```

## Steps

Each step is an object with exactly one action.

| action | example | what it does |
|---|---|---|
| `preset` | `{ "preset": "clock" }` | Adds a ready-made component (ids below): glyph images and layers included, placed at defaults. |
| `add` | `{ "add": "ARC_PROGRESS", "patch": { "centerX": 195, "centerY": 225, "radius": 120, "dataType": "STEP" }, "name": "Step ring", "set": {…} }` | Adds one layer of a kind from kinds.md. `patch` = initial properties, `name` renames it. |
| `edit` | `{ "edit": "Hour", "set": { "x": 36, "y": 40, "show": "both" }, "glyph": { "color": "#39ff14", "size": 110 } }` | Finds a layer by id or (partial, case-insensitive) name and changes it. |
| `remove` | `{ "remove": "Colon" }` | Deletes a layer. |
| `script` | `{ "script": "const e = find('Hour'); e.alpha = 160; return e.name" }` | Runs JavaScript inside the editor. `find(name)`, `project`, `elements()`, `dev()`, `applyPreset`, `addElement`, `rerenderGlyphLayers([e])` are available; whatever you `return` is logged. Last resort. |

### `edit` fields

- **`set`** — any layer property: `x`, `y`, `w`, `h`, `show` (`normal` | `aod` | `both`), `alpha`, `name`,
  `showWhen` (`am` | `pm` | `sunrise` | `sunset`: shown only then, the watch switches it), `alignH` (`LEFT` | `CENTER_H` | `RIGHT`), `hSpace` / `space` (digit spacing), `dataType`, `color`, `text`, `size` (TEXT only) …
- **`glyph`** — style of a digit / weekday / reading layer (its pictures are re-drawn): `font`, `size` (px height of
  the digits), `weight`, `fill` (`solid` | `gradient` | `css` | `outline`), `color`, `from`, `to`, `angle`, `css`
  (e.g. `"linear-gradient(180deg,#ffd400,#ff2d55)"`), `outlineColor`, `outlineWidth`, `bold`, `italic`.
- **`set` also takes** `handle` (names the layer for your code as `W.<handle>`) and `previewOnly` — see [custom-code.md](custom-code.md).
- **`tint`** — for level sets and icons: `{ "fill": "solid", "color": "#39ff14" }` paints the pictures over.

### The `script` step's environment

A `script` step runs inside the editor page (async, `return` a value to log it) with the editor's own functions in scope: `find`, `project`,
`applyPreset`, `addElement`, `rerenderGlyphLayers`, plus `registerCustomFont({name, family, format, ext, dataBase64})` (an external font,
then usable as `glyph.font`), `addProjectImage(name, canvas, {})` (a PNG built on a canvas becomes a project image), `elBox(layer)`,
`drawScene(ctx, w, h, 'normal' | 'aod', false)`, `startCodeRun()` / `stopCodeRun()` and `composePreviewB64()`. Each step is its own scope, so
share state through `globalThis`. A layer's `name` in `log` is truncated at 200 characters: write large results into the project
(for example `project.description`) and read the saved project instead. Animated faces: [animated-faces.md](animated-faces.md).

### Order matters

Digit sets are **shared** between layers (the clock, steps, heart rate … all use the same 0–9 images) until one is
restyled; restyling a layer gives it its own copy. So **add all presets first, then `edit` each layer** — editing
the hour before adding the readings makes every later reading inherit the hour's size and colour.

Unit pictures that are plain text (the heart rate's `bpm`) are drawn when the preset is added, at the digits' size
of that moment; restyling the digits later does not redraw them. Clear them with `"set": { "unit": "" }`, or leave the
glyph size at its default. (`%`, `°` and the colon follow the digits.)

## Presets

| id | adds |
|---|---|
| `bg` | black full-screen background (locked) |
| `clock` / `clocksec` | digital time `hh : mm` / `hh:mm:ss` (hour, colon, minute[, second] layers), grouped as `Clock`; the layer order is minute, colon, hour so the Layers panel reads hour, colon, minute |
| `analog` | analog clock: hour / minute / second hands + dial cap |
| `weekday` / `day` / `month` | weekday names / day of month / month as images |
| `steps` `hr` `cal` `battery` `temp` `distance` `spo2` `stress` | a reading as digit images with its unit |
| `weather` | weather icon (29-icon level set) |
| `arcprogress` | step progress arc |
| `bar` | linear progress bar that follows a reading |
| `sleepchart` `polyline` | sleep chart / heart-rate or sleep line chart |
| `level` | battery image level |
| `rect` `stroke` `circle` `arc` | shapes |
| `text` `datatext` | a text widget / any reading as images |
| `suntimes` | the next sunrise / sunset: `SUN_RISE` and `SUN_SET` readings with an icon each, in one place, swapped by the time (`showWhen`) by generated code; use this one |
| `sun` | one `SUN_CURRENT` reading with a sun icon and colon, grouped (layers `Sun time`, `Sun icon`); on a real Bip 6 it stays on a sun event that has already passed, prefer `suntimes` |
| `status` | Bluetooth status icon |
| `click` `tap` | tap shortcut / tap zone |
| `editslot` | complication slot (the wearer picks what it shows) |

Presets land at default positions and sizes: **expect to reposition them** with `edit` + `set` (the lint
reports `off-screen` and `overlap` for the ones you have not moved yet).

## Reading the result

`layers` lists `name [KIND, show] x,y` after the last step. `lint` entries start with `error:`, `warn:` or
`info:`. Fix every `error`; weigh each `warn`. `export` has `ok`, `outDir`, `warnings` (what the export left
out or could not do) and `syntax` (`ok` when the generated `index.js` parses).
