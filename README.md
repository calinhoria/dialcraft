# Amazfit Watchface Designer

A desktop designer (Electron) for **Zepp OS / Amazfit watchfaces**. You compose the
face on a device-accurate canvas, then export a ready-to-build
[Zeus CLI](https://docs.zepp.com/docs/guides/tools/zeus-cli/) project
(`app.json`, `app.js`, `watchface/<target>/index.js`, `assets/`), build the
installable `.zab` straight from the app, or install it on the watch over Wi-Fi
with a QR code.

The editor is the design surface; the **watchface format and APIs come from the
Zepp OS documentation** — every widget the app emits maps 1:1 to an `hmUI.*`
widget and every parameter is documented there:

- Watchface overview — https://docs.zepp.com/docs/watchface/
- Widget reference — https://docs.zepp.com/docs/watchface/api/hmUI/widget/
- `data_type` (sensor bindings) — https://docs.zepp.com/docs/watchface/api/hmUI/data_type/
- Design specification (naming, AOD, safe area) — https://docs.zepp.com/docs/watchface/specification/
- Zeus CLI — https://docs.zepp.com/docs/guides/tools/zeus-cli/
- Device list — https://docs.zepp.com/docs/reference/related-resources/device-list/

> **`ui.*` vs `hmUI.*`.** The generated code imports `ui from '@zos/ui'`, the
> module alias used by Zeus CLI watchface samples:
> `import ui from '@zos/ui'` then `ui.createWidget(ui.widget.IMG_TIME, {...})`.
> This is the same object the watchface docs call **`hmUI`**
> (`hmUI.widget.*`, `hmUI.data_type.*`, `hmUI.show_level.*`, `hmUI.align.*`).
> Rename the import to `hmUI` if you prefer the docs' spelling.

## Requirements

- Node 18+ and npm (developed on Node 26 / npm 11)
- macOS, Windows or Linux (Electron 33)
- Optional: the Zeus CLI for preview/build — `npm i @zeppos/zeus-cli -g`

## Getting started

```bash
npm install
npm run css      # compile styles-src.css -> styles.css (Tailwind)
npm start        # launch the designer
```

If `npm start` reports *"Electron failed to install correctly"*, npm blocked the
package's install script. Either approve it (`npm install --foreground-scripts`)
or point the module at an existing binary by writing the executable path into
`node_modules/electron/path.txt`.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run css` | Build `styles.css` from `styles-src.css` (Tailwind v4) |
| `npm run masks` | Regenerate `assets/masks/*.svg` + `masks.json` from `core/devices.js` |
| `npm run sample` | Write `samples/sample-digital/` — a designer project **and** a Zeus project |
| `npm run smoke` | End-to-end test: boots the app and drives it (new face → presets → code → save → export → fonts → **real `zeus build`** → LAN install → layout audit). `SMOKE_BUILD=0 npm run smoke` skips the CLI build |
| `npm run dist` | Package the app with electron-builder (`--mac` / `--win` / `--linux`) |
| `node tools/shot.js` | Development helper: drive the UI and write PNG screenshots (`SHOTS=… STEP=…`) |

## The editor

```
┌ header ─ New · undo/redo · Open · Save · Add ▾ · Presets ▾ · Grid Mask Upload · Glyphs ▾ · Check · Export Zeus · Build .zab · Install ┐
├ Watchface / Layers / Project images ─┬ device canvas (normal · AOD · live clock) ─┬ Properties / Test data / Generated code ┤
```

- **Watchface** — name, description, App id, device, glyph font, and **Fonts →
  Font library & glyphs…**. *Change device…* retargets the project and scales the
  layout.
- **Layers** — top-to-bottom paint order, drag to restack, drag one layer onto
  another's group box to group. Eye = visibility, lock = not selectable on the
  canvas, badges mark AOD/edit-only layers. `Ctrl/Cmd+G` groups, `Ctrl/Cmd+Shift+G`
  ungroups.
- **Canvas** — drawn at device pixel size and CSS-scaled, so what you see is what
  the watch renders. Drag to move, corner handles to resize, the square on a
  circle's rim to change the radius. Snapping snaps to other layers, to the
  screen centre and to the 20px grid (toggle with **Grid**); pink guides show the
  active snap. The amber dashed rectangle is the 2px safe area; the black shape
  outside it is the bezel mask (toggle with **Mask**).
- **Properties** — per-kind fields, plus alignment tools when several layers are
  selected.
- **Test data** — the values the preview draws (and that the code panel is
  generated against). Defaults come from the design-spec reference readings
  (10:09:36, 8670 steps, 86 bpm, 280 kcal …). **Use current time** switches the
  preview to the real clock.
- **Generated code** — live `watchface/<target>/index.js` preview, with warnings;
  *Copy* puts it on the clipboard.
- **Check** — lint against the watchface spec: off-screen layers, safe edge,
  missing/incorrectly-sized image sets, AOD pixel budget, second hand in AOD,
  missing image references, unused images.

Keyboard: `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` undo/redo, `Ctrl/Cmd+S` save,
`Ctrl/Cmd+D` duplicate, `Ctrl/Cmd+G` group, arrows nudge (`Shift` = 10px),
`Delete` remove, `Esc` deselect. Files can be dropped on the window to import.

## Widgets (what you can place)

Each entry maps to an `hmUI` widget; `Add ▾` and `Presets ▾` both use them.

| Designer kind | hmUI widget | Notes |
| --- | --- | --- |
| Image | `IMG` | optional rotation around a centre point |
| Animation | `IMG_ANIM` | frame images + fps/repeat/step |
| Image level | `IMG_LEVEL` | one image per level (battery, weather …) |
| Image progress | `IMG_PROGRESS` | segmented progress bar |
| Image pointer | `IMG_POINTER` | pointer image rotated by a data value or angle |
| Time (digit images) | `IMG_TIME` | hour / hour12 / minute / second |
| Weekday images | `IMG_WEEK` | 7 images |
| Date images | `IMG_DATE` | day / month |
| Analog clock | `TIME_POINTER` | hour + minute + second hands, optional cover |
| Data reading | `TEXT_IMG` | digits + unit/separator images for any `data_type` |
| Text | `TEXT` | multiline, colour, alignment |
| System status | `IMG_STATUS` | disconnect / DND / … icons |
| Tap shortcut | `IMG_CLICK` | opens an app on tap |
| Filled / stroked rect | `FILL_RECT`, `STROKE_RECT` | corner radius, optional rotation |
| Circle | `CIRCLE` | filled (alpha via the layer's Alpha) |
| Arc | `ARC` | static sweep, line width |
| Arc progress | `ARC_PROGRESS` | data-driven sweep, optional background image |

Data-bound widgets use the framework's own binding (`data_type`), so the watch
updates them natively. `ARC_PROGRESS` is the one exception: its level is pushed
from a small reader in the generated code (`@zos/sensor`), which the app writes
for step, calorie, heart rate, battery, stand, distance, stress, SpO₂, barometer
and fat-burning.

## Images and glyphs

Project images live in the project's `images/` folder. Set names follow the
naming conventions from the design specification, so exports stay reviewable:

| Asset | Name |
| --- | --- |
| Digits | `font_<set>_<0-9>.png` (e.g. `font_1_0.png`) |
| Time digits | `time_<0-9>.png` / `hour_<0-9>.png` |
| Weekdays | `week_0.png` … `week_6.png` (Monday = 0) |
| Separators | `colon.png`, `dot.png`, `percent.png`, `negative.png`, `degree.png`, `slash.png` |
| Hands | `hour_hand.png`, `minute_hand.png`, `second_hand.png` |
| Animation frames | `anim/<prefix>_<i>.png` |
| Weather | `weather_0.png` … `weather_28.png` (spec order) |

**Glyphs ▾** renders those images from one of the 33 bundled fonts
(`assets/fonts/`, all OFL): digit sets 0-9, weekday sets, separators, and
programmatic analog hands and a dial. Regenerating a set overwrites the same file
names, so it is idempotent.

**Upload** (or dropping files) opens the import dialog with three fits:

- **As is** — keep every pixel (icons, digits, hands)
- **Cover** — fill the screen, drag to choose the visible region
- **Contain** — fit inside the screen, centred

The chosen output size is shown before you confirm.

## Fonts and glyph settings

**Fonts → Font library & glyphs…** (or the same entry in **Glyphs ▾**) is the
typeface workbench:

- **Typefaces** — the 33 bundled fonts grouped by style, plus *Project fonts*.
- **Import font…** — pick `.ttf`, `.otf`, `.woff` or `.woff2` files (several at
  once). The family name is read from the font's `name` table; two files that
  share a family (say `Inter-Bold` and `Inter-Thin`) are kept apart by appending
  their style, so each one can be rasterized and shipped separately. The file is
  copied into the project folder on save (see *Projects*), so the project stays
  portable and survives switching machines.
- **Preview** — `10:09` and sample rows drawn live with the selected size,
  colour, weight and optional OpenType variation string (e.g. `'wght' 700,
  'ELSH' 6` for Handjet). The measured width of `10:09` is printed next to it,
  which is how you size a clock box before placing it.
- **Generate** — digits, weekdays, separators, hands and the dial, rasterized to
  PNG with the settings above. The Glyphs menu reuses the last settings used
  here, so the quick actions stay predictable.

Glyph images are what the watch actually draws, but a **Text** layer can also
render *live* text with a real font file: pick one under *Properties → Font*
(system default, bundled, or an imported font) and set *Weight*. The file is
copied to `assets/<target>/fonts/` on export and referenced as
`font: 'fonts/<file>'` — the parameter the official samples use
(`font: 'raw/custom.ttf'`). Bundled fonts travel with their OFL notice
(`fonts/FONTS-LICENSES.md`).

## AOD

Layers have a **Show in** state: *Normal only*, *AOD only* or *Both* (plus
*Edit only*, which is designer-only and never exported). The **AOD** preview
button renders the AOD state over black, and **Check** enforces the spec rules:
black background, no second hand, and under ~10% of the screen emitting light
(near-black fills are not counted). Presets place the clock and date in *Both*
and readings/arcs in *Normal only*, which is the usual starting point.

## Export and build

**Export Zeus** writes a complete Zeus CLI project:

```
<name>/
  app.json                             configVersion v3, appType "watchface"
  app.js                               App({ onCreate() {} })
  README.md                            target, build commands, device links
  watchface/<target>/index.js          the generated WatchFace({ initView, build })
  assets/<target>/images/              every PNG referenced by the code
  assets/<target>/images/preview.png   the app icon (always written, see below)
  assets/<target>/fonts/               fonts used by Text layers (+ OFL notice)
```

`app.json` carries `runtime.apiVersion`, `platforms` (one entry per hardware
variant, each with an explicit `deviceSource` id from the official device list),
`designWidth` = screen width, and a single `targets` key equal to the device
target — which is also the asset folder name (`assets/<target>/`, as in the
official `config-version-v3` watchface template; a `<target>.<st>` folder is not
recognised by the build). The `apiVersion` triple is derived from the selected
device's Zepp OS level using the official template values (`1.0.x`, `2.0`, `3.0`,
`3.6` for 3.5+, `4.0`), so an old watch is not asked for a runtime it never had;
the build passes the matching `--APILevel` to the CLI, and with a single target
`zeus build` runs non-interactively.

Two details are load-bearing for `zeus build`, and both used to break it (exit
code 7, `ENOENT … images/preview.png_origin`):

- **`assets/<target>/images/preview.png` always exists.** `app.json`'s `icon`
  points at it, and the CLI moves the file aside (`<name>_origin`) while resizing
  it for each device. If it is missing the resize fails, the error path tries to
  move the (also missing) `_origin` back, and that secondary `ENOENT` kills the
  build. The exported icon is a 248×248 PNG (circular, 4 px transparent safe
  area) built from the canvas render, or a generated placeholder dial when the
  render is unavailable — see `core/icon.js`.
- **every `platforms` entry carries its `deviceSource`.** Without it the CLI
  expands the target into all of its hardware variants, copies no assets into the
  per-device build folder and then hits the same icon error. Zepp's own template
  fails the same way, so this is a CLI requirement, not a design choice.

**Build .zab** exports and then runs the Zeus CLI (global `zeus`, else
`npx --yes @zeppos/zeus-cli@latest`), streaming the log. Manual flow:

```bash
npm i @zeppos/zeus-cli -g
zeus dev        # simulator
zeus preview    # QR code — scan with the Zepp app in developer mode
zeus build      # installable package in dist/
```

## Install over Wi-Fi (QR code)

**Install** packages the watchface into a staging folder and serves it from this
machine, so a phone on the same Wi-Fi can fetch it:

```
<userData>/install/<name>/
  app.json app.js watchface/ assets/    the exported project
  dist/<name>.zab                       the built package (after zeus build)
```

`Build & serve` runs the same export + `zeus build`, then starts an HTTP server
(`http.createServer`, bound to every interface, default port 7331 — the next free
port is used if that one is taken). **Serve existing** re-serves the last build
without rebuilding, which survives app restarts. **Show folder** opens the
staging directory, and the modal keeps a live access log of what the phone
requested.

The server publishes:

| Route | What it is |
| --- | --- |
| `/<name>.zab` | the installable package (`application/octet-stream`, as an attachment) |
| `/` | an instruction page with a download button, for a plain browser camera scan |
| `/preview.png` | the app icon (248×248, also the Zepp App list image) |
| `/source.zip` | the whole Zeus project as a ZIP (built in-process, no dependency) |
| `/manifest.json` | machine-readable listing (name, device, package route/size) |
| `/health` | liveness + request count |

The modal renders the URL as a QR code (generated in the main process with
`qrcode`), switchable between the package URL — the one the Zepp App needs — and
the landing page URL. Then: phone and computer on the same Wi-Fi → Zepp App →
Profile → your device → **Developer Mode** → scan.

Two honest caveats: the Zepp App normally installs through the Zepp cloud, and
`zeus preview` is what produces that cloud QR (it needs `zeus login` and a real
account, and its link expires after seven days) — so a plain `http://` LAN URL
is our own mechanism, not a documented Zepp protocol. If the app refuses the
address, fall back to:

```bash
cd "<staging folder>" && zeus preview --target <target>
```

which prints its own QR code in the terminal.

## Projects

A designer project is `<name>.wfproj.json` next to its `images/` (and optional
`fonts/`) folder:

```json
{ "version": 1, "name": "…", "device": "gtr-3-pro", "appId": 2000001,
  "font": "Orbitron", "fonts": [{ "name": "MyFont.ttf", "family": "My Font" }],
  "groups": {}, "elements": [ … ] }
```

`font` is the typeface used to rasterize glyphs; `fonts[]` lists the imported
font files, which are stored as `<name>/fonts/<file>` and re-registered with
`FontFace` when the project is opened (the entry remembers the family name the
importer chose, so a renamed family survives a round trip). Images and fonts stay
as standalone files so they can be edited outside the app and reused in the
exported project. Recent projects are listed on the empty state.

## Repository layout

```
main.js            Electron main process — windows, dialogs, save/export/build IPC
preload.js         contextBridge surface (window.api)
index.html         the whole UI shell and modals
renderer.js        editor: model, canvas, panels, glyph generation, import, install UI
styles-src.css     Tailwind source (compiled to styles.css by npm run css)
core/devices.js    34-device catalog (target, shape, size, api, asset dir)
core/kinds.js      widget metadata + defaults
core/datatypes.js  data_type catalog, weather icons, status icons, preview values
core/codegen.js    project model -> app.json / app.js / watchface code / README
core/fonts.js      bundled font catalog, TTF/OTF name-table parser, apiVersion map
core/icon.js       app icon: 248×248 circular PNG, built from the canvas render
core/lanserver.js  LAN install server (package, preview, source.zip, landing page)
core/zip.js        dependency-free ZIP writer for /source.zip
core/masks.js      per-device bezel mask generation
assets/fonts       33 bundled OFL fonts for glyph generation
assets/masks       generated per-device SVG masks + masks.json
samples            output of npm run sample
tools              gen-masks.js, make-sample.js, smoke.js, shot.js
```

## Limitations

- One device target per project (copy the `targets` block in `app.json` to add
  more in the exported project; *Change device…* retargets a project and scales
  the layout, but images keep their pixel size).
- Animations preview statically outside the canvas tick; the export is exact.
- `zeus preview`/`build` need the Zepp CLI and a network connection; the app
  only shells out to it.
- Install over Wi-Fi serves plain HTTP from this machine, which is not a
  documented Zepp install path — see the caveats in that section. Nothing leaves
  the local network, and the server is stopped when you press *Stop* or close the
  app.
- `woff`/`woff2` files can be imported, but their family name comes from the file
  name (their tables are compressed); the preview then shows the guessed name.
