# Dialcraft — user guide

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
- For building `.zab` packages: Node (with `npx`) on your PATH. A global Zeus CLI is used when
  present (`npm i @zeppos/zeus-cli -g`), otherwise `npx` fetches it on each build (network needed).
  The **Build tools** row in the Watchface panel shows what was found and can install Zeus.

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
| `npm run icon` | Render the app icon (`build/icon.png`, and `build/icon.icns` on macOS) |
| `npm run sample` | Write `samples/sample-digital/` — a designer project **and** a Zeus project |
| `npm run smoke` | End-to-end test: boots the app and drives it (new face → presets → code → save → export → **import round trip** → fonts → **real `zeus build`** → LAN install → layout audit). `SMOKE_BUILD=0 npm run smoke` skips the CLI build |
| `npm run dist` | Package the app with electron-builder (`--mac` / `--win` / `--linux`) |
| `node tools/shot.js` | Development helper: drive the UI and write PNG screenshots (`SHOTS=… STEP=…`) |

## The editor

```
┌ header ─ New · undo/redo · Open · Import · Save · Add ▾ · Presets ▾ · Grid Mask Upload · Glyphs ▾ · Check · Export Zeus · Build .zab · Install ┐
├ Watchface / Layers / Project images ─┬ device canvas (normal · AOD · live clock) ─┬ Properties / Test data / Generated code ┤
```

- **Watchface** — name, description, App id, device, glyph font, **Colours → Colour themes…**,
  **Fonts → Font library & glyphs…** and **Build tools** (Node / npx / Zeus status, *Install Zeus*).
  The panel starts collapsed (its summary line and a **Close** button stay visible). Clicking **Device** retargets the project and scales the
  layout.
- **Layers** — a view filter (**All / Normal / AOD / Edit**) dims the layers the chosen state does
  not draw and makes them unselectable; Normal is the default. Top-to-bottom paint order. Drag a row from anywhere to restack it
  (above or below groups too), drag a group by its header to move it as one unit,
  or drop a layer into a group's body to add it. Eye = visibility, lock = not
  selectable on the canvas (a locked layer can still be reordered), badges mark
  AOD/edit-only layers; a group row has its own eye and lock for all its members.
  The toolbar at the top of the panel works on the selection: **to front**
  (`Ctrl/Cmd+Shift+]`), **forward** (`Ctrl/Cmd+]`), **backward** (`Ctrl/Cmd+[`),
  **to back** (`Ctrl/Cmd+Shift+[`), **duplicate** (`Ctrl/Cmd+D`), **group**
  (`Ctrl/Cmd+G`), **ungroup** (`Ctrl/Cmd+Shift+G`) and **delete**. Part of a group
  moves inside that group; anything else moves whole groups. Duplicating a whole group
  gives the copies a group of their own (`<group> copy`), 12 px offset, so the two
  can be moved and restyled independently; a duplicate also gets **its own
  separator images** — `colon.png` → `colon_2.png` — because those names are
  shared by every layer that points at them and a copy that kept sharing them
  could not be restyled on its own (digit sets stay shared and fork only when you
  restyle them, see *Glyph size, colour and fill*). A group is named when it is
  created (`Group 1`, …) and can be **renamed** by double-clicking its name in the
  panel (Enter saves, Esc cancels) or from the *Group name* row in Properties when
  the whole group is selected.
- **Add ▾ and Presets ▾** open a menu with a search box (focused on open; Enter picks the first match,
  Esc closes). Under the face: **Normal · AOD · Edit · Live clock**, and selectors for a colour theme,
  a background variant and each complication slot when the face has them.
- **Canvas** — drawn at device pixel size and CSS-scaled, so what you see is what
  the watch renders. Drag to move, corner handles to resize, the square on a
  circle's rim to change the radius. Snapping snaps to other layers, to the
  screen centre and to the 20px grid (toggle with **Grid**); pink guides show the
  active snap. The amber dashed rectangle is the 2px safe area; the black shape
  outside it is the bezel mask (toggle with **Mask**).
- **Properties** — per-kind fields, plus **Align to box / Align to device /
  Distribute** when several layers are selected (see *Groups, align and
  distribute*). **Show in** and **Alpha** are the exception to "primary layer
  only": with several layers (or a group) selected they write to every one of
  them, so a whole group can be moved to AOD in one go.
- **Test data** — the values the preview draws (and that the code panel is
  generated against). Defaults come from the design-spec reference readings
  (10:09:36, 8670 steps, 86 bpm, 280 kcal …). **Use current time** switches the
  preview to the real clock. Digit and date layers honour their own **Leading 0**
  switch (off → `9`, on → `09`) and their **Align**, which moves the value
  *inside* the widget's box: the box is as wide as the part can get (hour /
  minute / second / day / month = 2 digits, a `TEXT_IMG` reading as many as its
  data type can show) and it stays put at X, so a reading does not jump when it
  grows (`9:00` → `10:00`). This is the rule Zepp's own tool uses
  (`getImgArrAfterAlign`: `RIGHT → u - b`, `CENTER → (u - b) / 2`, `LEFT → 0`,
  and no shift once the value is as wide as the box — a full-width value
  therefore looks identical in every mode). The canvas draws the box (solid) and
  the value's own outline (dashed, pink) with the anchor dot at the box origin,
  and Properties spells out the result — `Preview draws “9” at 10:09:36 in a
  2-digit box 78×39 — leading zero off (minute_zero: 0) · Align Left puts the run
  at the box's left edge.`
  **Follow** places a value directly after the previous part of its kind
  (hour → minute → second, month → day) using that part's spacing and alignment;
  the export then sends no `startX`, `*_space` or `*_align` for it, which is why
  Space and Align are hidden in a following layer's panel.
  A `TEXT_IMG` reading shows the value as it is — `22°`, not `022°`: its data
  type's digit count is the *box* the value stays in, not a padding request
  (only `IMG_TIME` / `IMG_DATE` have a **Leading 0** switch, and that is the
  watch's `*_zero`). Separators — the colon, the `°` — are rasterised at the
  digits' cell height, so they keep their proportions when the glyph size
  changes, and the `°` is a superscript (three quarters of that size, ink at the
  top of a cell as tall as the digits).
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
| Animation | `IMG_ANIM` | frame images + fps/repeat/step, restart on resume, still frame; frames are exported to `images/anim/<prefix>_<i>.png`, the only name the widget can resolve. **Frames** in Properties takes a run of PNGs — or an animated GIF/WebP, which is split into one PNG per frame with the frame rate taken from the file's own delays (a still picture, even one saved as `.gif`, is just one frame); the preview plays the frames at `fps` (sampled every 1/30 s) |
| Image level | `IMG_LEVEL` | one image per level (battery, weather …) |
| Image progress | `IMG_PROGRESS` | segmented progress bar; irregular positions from an import are kept per picture |
| Image pointer | `IMG_POINTER` | pointer image rotated by a data value or angle |
| Time (digit images) | `IMG_TIME` | hour / hour12 / minute / second |
| Weekday images | `IMG_WEEK` | 7 images, with a **Names** row (Mon / Monday / M), **Case** and, per layer, the language |
| Date images | `IMG_DATE` | day / month / year (two digits); the **Character** switch turns the month into its 12 names |
| Analog clock | `TIME_POINTER` | hour + minute + second hands, optional caps (hour / minute / second) |
| Date pointer | `DATE_POINTER` | a pointer that turns from a start to an end angle with the weekday, day or month; optional scale behind and cap above |
| Data reading | `TEXT_IMG` | digits + unit / imperial unit / separator / invalid images for any `data_type`, or a fixed number (**Fixed text**) |
| Text | `TEXT` | multiline, size, alignment, live font, **Overflow** (`text_style`: none / wrap / ellipsis), solid/gradient/outline fill, bold + italic |
| Line chart | `GRADKIENT_POLYLINE` | the firmware-drawn heart-rate or sleep line chart (the widget is spelled that way in the docs) |
| Sleep chart | `GROUP` | last night's stages, filled by a small reader in the generated code |
| Progress bar | `FILL_RECT` | a linear bar that follows a reading (`FILL_RECT` + a sensor updater) |
| Complication slot | `WATCHFACE_EDIT_GROUP` | an editable slot: the wearer picks what it shows; see *Complication slots* |
| Tap zone / button | `BUTTON` | an invisible tap zone, or a visible button with a label and colours; see *Variants and tap zones* |
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
| Weekdays | `week_w1.png` … `week_w7.png` (Monday = w1); a second weekday layer gets `week2_w1.png` … |
| Month names | `month_m1.png` … `month_m12.png` (January = m1); likewise `month2_…` |
| Separators | `colon.png`, `dot.png`, `percent.png`, `negative.png`, `degree.png`, `slash.png` |
| Hands | `hour_hand.png`, `minute_hand.png`, `second_hand.png` |
| Animation frames | `anim/<prefix>_<i>.png` |
| Weather | `weather_0.png` … `weather_28.png` (spec order) |

**Glyphs ▾** renders those images from one of the 33 bundled fonts
(`assets/fonts/`, all OFL): digit sets 0-9, weekday sets, separators, and
programmatic analog hands and a dial. Regenerating a set overwrites the same file
names, so it is idempotent. Generation is **per component**:

- **Font library & glyphs…** (or a layer's *Re-render*) draws for **the selected
  layer**: its size, colour, weight and variation are filled in from that layer,
  and the generator button says what it will draw — *Digits 0-9*, *Weekdays*,
  *Month names* or *Redraw images* (separators, symbols) — so it redraws that
  layer's own set only. *Use for glyphs* switches that layer's typeface. With
  nothing selected the modal says so and refuses; analog hands and the dial are
  the exception, they are project artwork that any pointer links by name.
- **Glyphs ▾ → Digit set / Weekday set** draws the selected layer's set, or drops
  a loose set into the project for the Images panel when nothing is selected.

Once a layer has a set, its **size, colour, fill, bold and italic are edited in
Properties** and the glyphs are rasterised again in place — see *Glyph size,
colour and fill* below.

### Language and names

Weekday and month names are not hard-coded: the project has a **Language**
(BCP-47 tag, e.g. `en-US`, `ro-RO`, `ja-JP`) and every name is asked of the
browser's `Intl` data, so any language Electron ships works — no table, no
library. A layer can override the project language in its own **Language** row,
and weekday/month layers add:

| Row | Values |
| --- | --- |
| Names | *Short* (`Mon`), *Full* (`Monday`), *Narrow* (`M`) |
| Case | `UPPERCASE` (the default, as the designer has always drawn weekday sets), the language's own casing (`Mon`), `Capitalize` or `lowercase` |
| Language | empty = the project language, or a tag for this layer alone |

Each weekday / month layer owns its set, so two layers in two languages or
styles never overwrite each other. The names share one cell — as wide as the
longest, as tall as the tallest accent — and **Label align** places each name in
it, so the label does not jump from day to day.

**Letters a font lacks.** A canvas silently borrows a missing glyph from a system
font, which is how `SÂMBĂTĂ` used to come out in two typefaces. The designer reads
every font's character map (`core/fonts.js`) and draws a missing letter from the
font's *own* glyphs: the other Romanian form (`ș` ↔ `ş`, `ț` ↔ `ţ`), else the base
letter plus its accent (the font's `ˆ ¸ ´ ¨ …`, or a breve drawn as a crescent the
thickness of its stems). Only when even the base letter is missing does a system
font step in — the Font row then says *lacks*. The bundled fonts were rebuilt with
their Latin Extended subsets (`tools/fonts-latin-ext.py`), so most of them draw
Romanian natively; the font library marks each font ✓ (native), ≈ (composed) or
✕ (lacks) for the project language. A Text layer is drawn live on the watch with
its font file, so missing letters there are flagged in Properties and in Check.

Names are baked into the PNGs, so they follow the images: a set the designer drew
is redrawn right away when you change the wording, while a layer that came from
another watchface keeps its pictures until you press **Re-render**. The font
library has the same two rows when a weekday or month layer is selected, next to
the generator buttons.

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

## Text styles (gradients, outline, bold, italic)

A **Text** layer has a *Fill* of four kinds, plus **Bold** and **Italic**:

| Fill | Controls |
| --- | --- |
| Solid | one colour |
| Linear gradient | from / to colour + angle (`0°` up, `90°` right — CSS angles) |
| CSS gradient | any CSS string: `linear-gradient`, `radial-gradient(at 30% 40%)`, `conic-gradient(from 45deg)`, `repeating-…`, with `%` stops |
| Outline | fill colour + outline colour + width |

The canvas draws all of them live, so the editor is the source of truth.

**Multi-layer editing.** With several layers selected (or a group clicked in the
layers panel) every style row writes to all selected *Text* layers at once — so
you can restyle a whole group, e.g. give all of its children the same gradient,
size and weight in one pass. The panel reports `Applies to N selected Text
layers` when it is doing that.

**What the watch actually gets.** The `hmUI` Text widget takes only a flat
`color` plus `text_size`, `font` and spacing (there is no gradient, outline,
bold or italic parameter in
[the API](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/widget/TEXT/)).
So the designer is honest about it:

- flat colour, no bold/italic → a plain `TEXT` widget, exactly as you see it;
- anything else → the layer is **baked** into a transparent PNG
  (`images/text_<layer>_<stylehash>.png`, at the layer's box size, alpha
  included) and emitted as an `IMG` widget with a `// baked by the designer: …`
  comment. Bold picks the boldest face of the font, italic slants 11°.

Baked PNGs are derived, never persisted: they are re-rendered at export/build/
install time (and whenever the style changes), the file name is a hash of the
style so two exports of the same project produce identical assets, and the code
panel shows them immediately via `IMG`. If you would rather keep a real `TEXT`
widget, choose a bold or italic *font file* instead of the Bold/Italic switches
— a font file is a legitimate watch asset, whereas a Weight/Bold setting can
only be baked.

## Groups, align and distribute

Selecting more than one layer (Ctrl/Cmd-click, or clicking a group in the layers
panel) draws **one bounding box around the whole selection**, with a faint outline
per member and a label — `3 layers · 142×71`. That box is the reference the tools
use, so what the panel promises is what you see:

| Panel box | Buttons | Reference |
| --- | --- | --- |
| **Align to box** | Left · Center · Right · Top · Middle · Bottom | the selection's bounding box |
| **Align to device** | same six | the device screen (`0,0`–`480,480`), so Left means the left edge of the watch |
| **Distribute across / down** | Even · Spread · Start · End | the device, along that axis |

- **Even** — equal gaps *and* equal device margins, so the row ends up centred on
  the device (`n` layers → `n+1` shares).
- **Spread** — first layer on one device edge, last on the other.
- **Start / End** — pack the row against the low (left/top) or high (right/bottom)
  edge.

Distribution follows the **layers-panel order**, never the current positions, so a
jumbled layout (hour, colon, minute) is spaced in reading order instead of being
scrambled.

**Dragging a group** moves every member by the same delta and snaps the **group
box** — the members are excluded from their own snap targets, so the aid is the
selection's box, not the layer under the cursor. The pink guide lines show the
edge or centre that matched.

## Glyph size, colour and fill (digit, weekday and reading layers)

A digit, weekday or reading layer draws PNGs, so the watch has no `text_size` or
`color` parameter to edit — those values were baked when the glyphs were
rasterised. Properties therefore edits the *glyphs* and re-renders them:

| Row | What it does |
| --- | --- |
| Font | typeface the set is rasterised from (bundled, project or imported) |
| Size | glyph height in px |
| Fill | Solid / Linear gradient / CSS gradient / Outline — same controls as Text. **Outline** is a true ring (the silhouette grown by the outline width, with the glyph carved back out), not a stroke, so sharp corners stay clean and nothing creeps inside the letter; the cell always reserves room for the ring, which also keeps the glyph size stable when you switch fill types |
| Bold | thickens every glyph with a stroke of the fill, so single-weight fonts get a real bold |
| Outline width | the ring's thickness in px (outline fill only; Color is not used — the ring is hollow) |
| Italic | slants every glyph 12° |
| Re-render | rasterises the set again right away (editing any row already does it ~0.4 s later) |

Everything is re-rendered **in place**, keeping the file names, so the generated
watch-face code does not change.

**Any image layer** (`IMG`) has a **Preview** row — the thumbnail and pixel size
of the PNG it draws — and a **Symbol** field. Fill the symbol in (`°`, `:`, `♥`,
`A`) and the Font / Size / Fill / Colour / Outline / Bold / Italic rows appear:
the image is rasterised from that font into **a file of its own**
(`symbol_A.png`, `symbol_u00b0.png`, deduplicated if the name is taken), which
becomes the layer's image; later edits re-render that file in place. A separator
layer (the clock's colon) starts with its symbol filled in from the file name, so
its first restyle moves it onto its own `symbol_*.png` and leaves the shared
`colon.png` alone. Clear the symbol and the font rows disappear — the layer is a
plain image again, exactly as it was. The panel keeps its scroll position and the
caret while it rebuilds, so typing a symbol (or a size) does not jump.

Three cases are special, because the watch-face format fixes their file names and
shares those files between layers:

- **Colon and separators.** `colon.png`, `degree.png`, `dot.png`,
  `negative.png`, `percent.png`, `slash.png` and `am`/`pm` images are single-glyph
  layers: select the colon layer itself and you get the same rows, and its file
  name is kept. A temperature layer carries its degree (and minus) glyph as the
  layer's `unit` / `negative` image, and those follow the digits, so the `°` never
  drifts out of style. Separators are rasterised with the digits' font and size
  in the digits' exact cell (same height, same baseline), so a colon placed at the
  digits' Y lines up, and `°` / `−` sit where the typeface puts them. A colon
  layer with no style of its own draws like the nearest digit layer, and **Match
  digits** copies that layer's style onto it.
  *Glyphs ▾ → Separators* (or a layer's *Re-render*) brings an older `degree.png`
  up to date.
- **A blinking colon** is a frame list: the `…_off` frames are re-rendered blank
  at the same cell size, so the blink keeps working with the new look.
- **Imported image sets.** A set that came from another watchface is editable when
  the widget itself says what the images are: a time / date / reading part is the
  digits 0-9 in order, `IMG_WEEK` is the seven weekdays, a month-name layer is the
  twelve months. The panel says those pictures *are* the ones the layer came with,
  and a style change replaces them with glyphs drawn from the font below — the
  size row starts from the height of the pictures they came with, so the first
  re-render keeps their scale. Sets the widget cannot read — weather icons, a
  level or progress array, hand-picked pictures — are still never regenerated.

Glyph sets are **shared**: the digital-clock preset points hour, minute and
second at one digit set (`font_1_*`), so restyling one layer would otherwise
restyle all of them. Editing a layer that shares its set first gives that layer a
**copy of its own** (a new `font_<n>_*` prefix) and leaves the others exactly as
they were — the panel says `Shared with N other layers` beforehand. Selecting
several glyph layers (or clicking a group) restyles them together in one pass,
and they share the copy.

## Palettes and the Imported Font

In **Glyph style**, a solid or gradient **Fill** shows a **Palette** picker with 20 well-known palettes
(Teenage Engineering, Dracula, Nord, Solarized, Gruvbox, Monokai, Catppuccin, Tokyo Night, One Dark,
Material, Cyberpunk, Synthwave, Sunset, Ocean, Forest, Pastel, Rainbow, Game Boy, Monochrome, Neon).
Choosing one fills the colours at once (solid: its first colour; gradient: its first two); a swatch sets a
single colour (shift+click sets the gradient's end). **Apply to all text layers** gives every digit /
weekday layer, every level set and every small icon the palette — a quick theme.

A set that came from another watchface is offered as **Imported Font**: the pictures it came with. Size
scales them and the fill paints over them. Pictures cut out on transparency keep their shape (the fill goes
through their alpha); opaque artwork on a black ground — what the Maker exports — is multiplied by its
brightness, so the ground stays black and the lit part takes the colour. The originals are kept as hidden
`…__src.png` copies (never exported), so **Restore originals** puts them back, and choosing a real
typeface instead still keeps them.

The same **Colour** section (Fill, Color / From–To, Palette, Restore originals, Redraw now) is on **level
sets** (the ring that fills up, a row of dots — the lit part takes the colour, the dim track stays dim) and
on **single pictures** (icons on image layers, status icons, tap icons). Variants layers and layers drawn from
a symbol are left out.

## Variants and tap zones

Some faces change on a tap: another colour scheme, another background, a shortcut to a
Zepp screen. Dialcraft models both.

- **Variants.** An **Image** layer with two or more pictures (Properties → Variants) is a
  variants layer. Name the variants (“Yellow, Green, …”), then use the **Variant** selector
  under the face to preview each one.
- **Tap zone** (Add → Tap zone). A rectangle that reacts to a tap. Its **Action** is one of:
  - **Cycle background variants** — steps the variants layers, shows the variant's name as a
    toast and remembers the choice across restarts.
  - **Next colour theme** — see *Colour themes*.
  - **Open a system app** — a select of the 39 documented `SYSTEM_APP_*` apps (Activity, Heart rate,
    Workout, Weather, Alarm, Camera remote, Music, Stopwatch, Timer, Settings, Compass, Sleep, Blood
    oxygen, Breathe …), exported as `launchApp({ appId, native: true })` from `@zos/router`
    (Zepp OS API 3.0+; older devices drop the zone with a warning). The import line is added only
    when a face uses one. This path has not been tried on a watch: if a face ever shows a black
    screen after adding it, remove the zone.
  - **Open a Zepp screen (by name)** — `hmApp.startApp({ url, native: true })`. The field suggests 66
    names (Calendar, Workouts, Heart rate, Weather, Sleep, Settings, Flashlight, Do not disturb,
    World clock, …) collected from the community's ButtonFunctions list of SashaCX75's
    Watch-face-editor; they are not officially published and a screen may not exist on every watch.
    Any other name can be typed.
  A zone with **no label and no fill** draws nothing and is shown dashed in the editor only. Give it
  a **Label** and/or a **Fill** colour (with pressed colour, label colour and size, radius) and it
  becomes a visible `BUTTON`.
- **Import.** A Watchface Maker face with a *switch background* button comes in with its
  background list as variants, and its buttons as tap zones (named screens, system apps, and visible
  buttons keep their text and colours). Buttons that ran other custom code come in as a tap zone with
  the original code in its note (that code is not kept).
- **Export.** Tap zones become `BUTTON` widgets (a transparent `tapzone.png` for an invisible one). The
  variants switcher stores the pick through guarded legacy globals (`hmFS`, `hmUI.showToast`) so a
  missing API can never stop the face from drawing. Built and syntax-checked, but not run on a
  watch from here — test it on yours.

## Complication slots and the Edit view

A **Complication slot** (Add ▾ → Complication slot) is a `WATCHFACE_EDIT_GROUP`: the wearer
long-presses the face, taps the slot, and picks what it shows (Steps, Heart rate, …). Properties
holds its `edit_id`, size, default type, the list of choices with their picker previews, and the
picker's background (`tips_*`).

- **Layers per choice.** Any layer can be tied to one choice — Properties → **Complication** → “Complication 1
  is STEP”. It is then drawn only when the slot shows that choice (a steps number and its icon, say);
  “Any choice” draws it regardless. The export makes one `switch` on the picked type and creates the
  layers of that choice.
- **Edit masks.** Pictures shown only while customising (the dimming mask and the foreground mask) are
  layers with **Show in → Edit**. They export as `WATCHFACE_EDIT_MASK` / `WATCHFACE_EDIT_FG_MASK`
  widgets — a plain image with the edit state would also be drawn over the normal face.
- **Preview.** The **Edit** button under the face previews the customise screen (the face plus the
  masks); the selector under the face picks which choice a slot shows; the **Edit** filter in the layer
  list focuses the edit layers and the slots.
- **Export.** `app.json` gets `editable: 1`. The slot is created with the edit API of the legacy `hmUI`
  global (the form every shipping face uses), falling back to `@zos/ui`, and sits in a `try/catch` that
  prints the error on the face if creating it fails. The group must not carry a `show_level`, or it
  would not exist in the customise state. Confirmed working on a watch.

## Colour themes

One face, several colours. **Watchface → Colour themes…** takes a **palette** (20 well-known ones, or
*Custom colours only*), lets you tick the colours you want and **add your own** (a colour picker, an
optional name), and moves the face's **accent colour** — found from its pictures, or the hex you type —
to each of them (hue, saturation, brightness). Only pictures that carry the accent get a copy
(`name__t1.png`, …); black, white and grey pictures stay shared. The **Theme** selector under the face
previews each theme.

A Tap zone set to **Next colour theme** switches them on the watch (one is added for you). The export
builds the whole face in one function; a tap deletes the widgets it made and builds again with the next
theme's pictures, and the choice is remembered. Every theme adds its pictures to the package — a face
with 45 accent pictures and 4 themes ships 180 more files, so tick only the colours you want.

## AOD

Every layer belongs to a face variant — **Show in**: *Normal*, *AOD*, *Both*
(plus *Edit*, shown only while the wearer customises the face). Everything you
add — from **Add ▾** or a preset — starts in **Normal**; AOD is opt-in.

To build the AOD variant, select the layers that should stay on (the clock, say)
and click **Both** (or **AOD**) in the *Show in* segments of Properties, or press
**Shift+B** / **Shift+A** (**Shift+N** puts them back to Normal). The segments act
on the whole selection; a mixed selection lights no segment and its tooltip says
how it splits.

The **AOD** preview button renders the AOD state over black, and **Check**
enforces the spec rules: no second hand, and under 10% of the screen lit — measured
from the rendered AOD frame.

**If the watch shows its own AOD face instead of yours**, there are three things
to check:

1. **`app.json` must declare the face's own lock-screen design.** The exported
   package sets `module.watchface.lockscreen = 1` whenever the face has AOD
   content (0 when it has none) — the docs' watchface-module table: *lockscreen,
   default 0 = none*. With 0 the watch never looks at your AOD widgets, whatever
   `show_level` they carry, so **rebuild and reinstall** after changing AOD
   layers.
2. **The face has AOD content.** At least one layer must be *Both* or *AOD only* —
   everything starts in *Normal*, so a face nobody opted in has nothing to draw
   in AOD. **Check** warns (`Nothing is shown in AOD — the
   watch will fall back to its own default AOD face`) and the AOD preview says so
   too. With a group selected, `Show in` writes to every layer at once.
3. **The watch's AOD style setting.** Zepp App → your device → *Screen-off style /
   AOD style* has to follow the watch face; when it is set to the system style the
   watch draws its own AOD face no matter what the package contains.

**How the states are emitted.** A layer set to *Both* becomes **two widgets** in
the generated code — one `show_level: ui.show_level.ONLY_NORMAL` and one
`ui.show_level.ONLY_AOD` — rather than one widget with the combined bitmask
(`ONLY_NORMAL | ONLY_AOD`, which is what the API docs' example shows). That is the
structure every shipping watchface uses (checked against a working third-party
package: 32 `ONLY_NORMAL` widgets, 10 `ONLY_AOD` widgets, not a single combined
one) and the only one the watch's AOD path reliably picks up. A layer set to
*Normal only* or *AOD only* is emitted once with that single value; *Edit only*
never reaches the package.

## Export and build

**Export Zeus** writes a complete Zeus CLI project:

```
<name>/
  app.json                             configVersion v3, appType "watchface"
  app.js                               App({ onCreate() {} })
  README.md                            target, build commands, device links
  watchface/<target>/index.js          the generated WatchFace({ initView, build })
  assets/<target>/images/              every PNG referenced by the code (+ baked text layers)
  assets/<target>/images/preview.png   the app icon (always written, see below)
  assets/<target>/fonts/               fonts used by Text layers (+ OFL notice)
```

`app.json` carries `runtime.apiVersion`, `platforms` (one entry per hardware
variant, each with an explicit `deviceSource` id from the official device list),
`designWidth` = screen width, and a single `targets` key equal to the device
target — which is also the asset folder name (`assets/<target>/`, as in the
official `config-version-v3` watchface template; a `<target>.<st>` folder is not
recognised by the build). Its `module.watchface` block sets **`lockscreen: 1`
whenever the face has AOD content** (0 when it has none) — that is the flag that
tells the watch the face brings its own lock-screen/AOD design; without it the
watch draws its own AOD face no matter what `show_level` the widgets carry
(`editable` is 1 when the face has a complication slot, else 0). The `apiVersion` triple is derived from the selected
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
`npx --yes @zeppos/zeus-cli@latest`), streaming the log. The app does not install Node; Node and
`npx` must be on the machine. A packaged app started from the Dock / Finder has no shell PATH, so it asks
your login shell for it and adds the usual folders (Homebrew, Volta, fnm, asdf, every nvm version) —
`core/toolpath.js`; without that the build fails with `spawn npx ENOENT`. The **Build tools** row in the
Watchface panel reports Node / npx / Zeus and offers **Install Zeus** (`npm install -g @zeppos/zeus-cli`),
which avoids fetching Zeus on every build. Manual flow:

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
`qrcode`), switchable between the package — the one the Zepp App needs — and the
landing page. Then: phone and computer on the same Wi-Fi → Zepp App → Profile →
your device → **Developer Mode** → scan.

**The package QR is not a plain web link.** The Zepp App's scanner only accepts
its own scheme, so the payload is the package URL with `http://` swapped for
`zpkd1://` (verified against a QR handed out by the community tools —
`zpkd1://amazfitwatchfaces.com/dl/bip/zip/45655/x.zip?zpk=…&comp=Bip_6` — and
confirmed by installing over this app's own LAN server with the official app):

```
http://192.168.1.24:7331/SmokeFace-1.0.0.zab   ← shown in the modal, Copy/Open
zpkd1://192.168.1.24:7331/SmokeFace-1.0.0.zab  ← what the QR encodes (Copy too)
```

The app fetches that host/path, so a plain-HTTP LAN address with a port is fine.
Zepp's own Watchface Maker uses a second scheme for the same scanner, pointing at
its cloud instead of your machine:

```
watchface://api-mifit-cn2.huami.com/custom/tools/app-dial/download/<token>
```

The landing-page QR stays a plain `http://…/` link, because that one is meant for
an ordinary camera/browser.

The Zepp cloud route still needs `zeus login` and a real account, and its link
expires after seven days — `zeus preview` produces that QR in the terminal:

```bash
cd "<staging folder>" && zeus preview --target <target>
```

## Importing an existing watchface

*Open* takes a saved designer project, a watchface `.zip` (extracted safely into a temporary folder;
the zip stays the shown source) or a real Zepp OS watchface folder — one with `app.json` + `watchface/` +
`assets/`. *Import* is the same door with an import-flavoured dialog. Zeus CLI projects and Watchface Maker
exports both work.

The watchface code is *run* (in the main process, in a `vm` sandbox that captures
every `hmUI.createWidget` call), so helpers, loops, constants and computed
image arrays resolve exactly as they do on the watch:

- `WatchFace({ … })` / `DeviceRuntimeCore.WatchFace({ … })` with the widgets
  built in `build()` or `initView()`; the constants come from `hmUI.widget`,
  `hmUI.show_level`, `hmUI.align`, `hmUI.data_type`, `hmUI.system_status`.
- Both `app.json` shapes: the v3 `targets` map and the flat v2
  `platforms`/`designWidth` document.
- A layer the project emits as two widgets (`ONLY_NORMAL` + `ONLY_AOD`) comes
  back as one layer shown in *both* states.
- Images in Zepp's compressed container — Watchface Maker exports call them
  `*.png` but they are not PNGs — are decoded to real PNGs: the 8-bit palette form (`2e 01 01`: a
  256-entry palette and one index byte per pixel, cropped to the real width stored in the header) and
  the 16-bit RGB565 form (`2e 00 02`); see `core/somh.js`.
- Only the images the layers actually reference are imported; `fonts/<file>`
  used by a `TEXT` layer is registered as a project font.
- The *app id* is kept only when it came from this designer. A Maker export
  carries its vendor's id (the Maker hands out `1000001`, `1000002`, …) and the
  Zepp App installs a local package *as* that app, so an id that already belongs
  to a published watchface makes the install fail; the import assigns one from
  the designer's own range and says so in the report (type the old id back into
  the project panel if you really want it).

Each widget becomes the matching layer kind: `IMG`, `IMG_TIME` (split into
*hour* / *hour (12h)* / *minute* / *second* from the `*_array` groups),
`IMG_DATE` (*month* / *day* / *year*), `IMG_WEEK`, `IMG_LEVEL`, `IMG_PROGRESS`,
`IMG_POINTER`, `IMG_ANIM` (frames), `TEXT` / `TEXT_FONT`, `TEXT_IMG`, `IMG_STATUS`,
`IMG_CLICK`, `TIME_POINTER`, `DATE_POINTER`, `FILL_RECT`, `STROKE_RECT`, `CIRCLE`, `ARC`,
`ARC_PROGRESS`, `GRADKIENT_POLYLINE` (when the firmware draws it), `BUTTON` (tap zones and
visible buttons), `GROUP` (the sleep chart) and the `WATCHFACE_EDIT_*` widgets (complication slots
with the layers each choice adds, and the edit masks).

The importer also reads what the code *does*: a refresh function that sets four digit pictures from the
clock becomes Digital time layers (the code is run at twelve times to see which digit each picture follows);
widgets a face hides or shows by the hour (lit AM / PM labels) become *Visible when* layers; a
background switcher becomes variants; linear scales written as comments become progress bars; the slot's
choices are traced by running the code once per choice.

The import never writes to the source folder: the project opens **unsaved**, so
*Save* asks where to put the designer project. A report opens in the log modal
and lists what came across, what could not, and any notes. What does not survive:

- Widgets the designer has no equivalent for (for example `SCROLL_TEXT`, `CYCLE_LIST`, `SLIDE_SWITCH`,
  `WATCHFACE_EDIT_BG`) are counted in the report and left out; so is a line chart the face draws
  itself with `addLine`.
- Faces that start a widget hidden and show it on a tap come in with that layer switched off.
- `WIDGET_DELEGATE` carries the watchface's *resume / pause* lifecycle callbacks
  and draws nothing, so it is not counted as a missing layer — the report notes
  it instead (the designer has no lifecycle hooks to attach the callbacks to).
- A `TEXT` layer whose font was baked upstream arrives as an `IMG` layer.
- Runtime `setProperty` logic is not replayed — the editor shows the value the
  code sets while building. A face that ships two overlapping normal-state
  variants and switches them at runtime imports as both layers, so the project
  checker will report the overlap it cannot know about.

## Code of your own (games, custom logic)

A project can carry JavaScript that is written into the exported watchface next to the generated widgets, for what the
designer cannot express: a game that plays itself, a fill animation, a custom timer. Open it from **Watchface ▸ Code ▸
Code of your own…** (or set `userImports` / `userCode` in a face-cli recipe):

- **Imports** (`userImports`) — lines placed with the other `import`s at the top of `watchface/<target>/index.js`.
- **Code** (`userCode`) — a block run at the end of `initView()`, after all the generated widgets. `ui`, `px(…)` and
  `A('file.png')` (the image path helper) are in scope. `px()` is replaced at build time, so it only works with a literal
  number (`px(300)`); for a value your code computes use `pxv(n)`, which scales it the same way. Wrap it in `{ … }` to keep its names out of the generated code's way.
- **Code handle** (Layer panel, `handle` in a recipe) — names a layer for your code: its widget is `W.<handle>`, and a
  layer with several pictures (a variants layer) also gives `F.<handle>`, the list of its picture paths. So you design the
  layers here and drive them from code, e.g. `W.beer.setProperty(ui.prop.MORE, { y: pxv(y), src: F.foam[2] })`
  (`MORE` takes `x`, `y`, `src` … on an IMG. On an animation (`IMG_ANIM`) `MORE` is accepted but does not move it; use
  `W.anim.setProperty(ui.prop.Y, pxv(y))`. Both checked on a Bip 6.). `W` and `F` are reserved names.
- **Preview only** (Layer panel, `previewOnly`) — the layer is drawn in the editor and in the preview pictures but is left
  out of the export. Use it to show what the code will draw (a still of the game).

Pictures the code needs only have to be in the project (they are all exported); the editor lists them as unused.
**▶ Run code** (the button above the preview) runs your code in the editor against a stand-in for the watch API, so you can see it work
without installing: `W.<handle>` is the layer itself, `setProperty` with `X`, `Y`, `W`, `H`, `ALPHA`, `SRC`, `VISIBLE`, `TEXT` or `MORE`
moves or swaps it on the canvas (a layer with several pictures follows `SRC`), `setInterval` / `setTimeout` are real, and the `Time`
sensor reads the computer's clock. A picture the code creates itself (`ui.createWidget(ui.widget.IMG, { x, y, src })`) is drawn as a temporary layer on top and
removed again by `ui.deleteWidget` or Stop, and layers marked *Preview only* are hidden while the code runs; other widgets the code
creates (a text, a group) are accepted but not drawn, and other watch modules are quiet stand-ins that return 0. **Stop** puts every layer back as it was, and nothing that ran is saved or exported (saving, exporting
or installing stops the run first). It is your own code running in the editor, so it only starts on a click; a project from someone
else deserves a read before you press it. The final word is still the watch: the stand-in cannot tell you which calls the firmware
accepts (for instance `MORE` does not move an animation there, `Y` does). Samples: `sample-watchfaces/tetris-live`.

## Updates

The installed app checks `github.com/calinhoria/dialcraft` releases (electron-updater, `core/updater.js`) a few seconds after
start-up, when *Check for updates when the app starts* is on, and on **Check for updates** (Watchface panel, or the start
screen). A banner shows the new version with **Download**, **Skip this version** and **Later**. Pre-releases count while the
project is in beta; nothing downloads in the background.

| Install | Update |
|---|---|
| Windows installer (NSIS) | in place: *Download* → *Restart to install* |
| Linux AppImage | in place |
| macOS `.dmg` / `.zip` | manual — the builds are unsigned and macOS will not replace a running unsigned app; the banner opens the release page |
| Windows portable `.exe`, Linux `.deb` | manual (release page) |
| `npm start` (development) | off |

For a release to be updatable the GitHub release must carry `latest.yml`, `latest-mac.yml`, `latest-linux.yml` and the `*.blockmap`
files next to the installers; the release workflow (`.github/workflows/release.yml`) attaches them, and `package.json` →
`build.publish` embeds the feed in the app (`app-update.yml`). Update checks arrived in 0.2.6; earlier installs are replaced by hand
once. A release made by hand (not by the workflow) is invisible to the updater unless those files are uploaded too.

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
core/importface.js imports an existing watchface folder (runs its code, captures widgets)
core/somh.js       decoder for Zepp's compressed image container (unsigned `*.png`)
core/fonts.js      bundled font catalog, TTF/OTF name-table parser, apiVersion map
core/icon.js       app icon: 248×248 circular PNG, built from the canvas render
core/lanserver.js  LAN install server (package, preview, source.zip, landing page)
core/zip.js        ZIP writer for /source.zip, and the safe extractor used to import a .zip
core/toolpath.js   PATH for node / npx / zeus when the app is started from the Dock / Finder
core/updater.js    update flow over electron-updater (which installs can update in place, skip, banner states)
core/masks.js      per-device bezel mask generation
assets/fonts       33 bundled OFL fonts for glyph generation
assets/masks       generated per-device SVG masks + masks.json
samples            output of npm run sample
tools              gen-masks.js, make-sample.js, smoke.js, shot.js, make-icon.js, fonts-latin-ext.py, adhoc-sign.js
.github/workflows  release.yml — builds Windows / Linux / macOS on a v* tag and attaches them to a pre-release
docs               GUIDE.md (this guide), ZEPP_COVERAGE.md (widget coverage), screenshots
```

## Limitations

- One device target per project (copy the `targets` block in `app.json` to add
  more in the exported project; clicking **Device** retargets a project and scales
  the layout, but images keep their pixel size).
- This is a **beta**. Generated code is checked with automated tests and a mock runtime; not every widget
  has been tried on every watch. Complication slots and the clock-driven import were confirmed on a
  watch; system-app taps (`@zos/router`), colour-theme switching, date pointers and the line chart were
  not.
- Release builds are unsigned (Windows SmartScreen, macOS Gatekeeper warn). The macOS ones are re-signed
  ad hoc so the bundle is consistent, which does not make Gatekeeper trust them.
- An imported watchface is a good starting point, not a lossless round trip: see
  *Importing an existing watchface* for what cannot come across (widgets with no
  designer equivalent, baked text, runtime `setProperty` logic).
- `TEXT` layers with a gradient/outline fill or with Bold/Italic are baked into
  a PNG on export (see *Text styles*) — they stop being live text on the watch,
  so they no longer follow i18n or a runtime font change.
- Digit, weekday and reading layers are rasterised images: restyling one from
  Properties re-renders its PNGs (see *Glyph size, colour and fill*).
- Animations preview statically outside the canvas tick; the export is exact.
- `zeus preview`/`build` need the Zepp CLI and a network connection; the app
  only shells out to it.
- Install over Wi-Fi serves plain HTTP from this machine, which is not a
  documented Zepp install path — see the caveats in that section. Nothing leaves
  the local network, and the server is stopped when you press *Stop* or close the
  app.
- `woff`/`woff2` files can be imported, but their family name comes from the file
  name (their tables are compressed); the preview then shows the guessed name.
