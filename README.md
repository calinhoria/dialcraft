<p align="center">
  <img src="build/icon.png" width="128" alt="Dialcraft icon">
</p>

<h1 align="center">Dialcraft</h1>

<p align="center">
  A desktop watchface designer for <b>Zepp OS</b> (Amazfit) watches.<br>
  Design on a device-accurate canvas, then export a Zeus CLI project, build the <code>.zab</code>,
  or install it on your watch over Wi-Fi with a QR code.
</p>

<p align="center">
  <img src="docs/screenshots/editor.png" alt="Dialcraft editing the Honeybee watchface for the Amazfit Bip 6">
</p>

<p align="center"><sub>The <i>Honeybee</i> face for the Amazfit Bip 6, imported straight from its Zepp OS project folder.</sub></p>

> **Beta release (0.2.x).** Dialcraft is under active development and is not finished software.
> Expect rough edges and changes between versions. Generated watchface code is checked with
> automated tests and a mock runtime, but not every widget has been tried on every watch — test a
> face on your own watch before sharing it, and keep a copy of your projects. The macOS builds are
> **not code-signed or notarised**: macOS will warn about an unidentified developer (right-click →
> Open, or `xattr -cr /Applications/Dialcraft.app`), and they may not run at all on a locked-down
> system. Windows builds are unsigned too (SmartScreen may warn). Use at your own risk; this is an
> independent project, not affiliated with Zepp Health / Amazfit.

---

## Features

- **Device-accurate canvas** for 34 Amazfit watches (round and square, 194×368 up to
  480×480), with each device's display mask, safe edge, snapping guides, and a
  live or reference (10:09:36) clock.
- **Every Zepp watchface widget**: digital time and date, analog hands, data
  readings (steps, heart rate, battery, weather …), image levels and progress,
  arcs, shapes, text, status icons, tap shortcuts and animations. Each layer maps
  1:1 to an `hmUI.widget.*` call.
- **Glyph generation from fonts.** Digits, separators, weekday and month names are
  drawn into PNGs from 33 bundled OFL fonts or your own, with fill, gradient,
  outline, bold and italic styles, re-rendered live as you edit.
- **Any language.** Weekday and month names come from the system's locale data
  (`ro-RO` gives *LUNI … DUMINICĂ*, `de-DE` gives *MONTAG …*). A letter a font
  lacks (`ă ș ț` in a Latin-only face) is built from that font's own glyphs
  instead of falling back to a system font.
- **AOD (always-on) design**: preview the normal and screen-off states.
  *Check* measures the lit-pixel budget and the other Zepp design-spec rules.
- **Import existing faces**: open a Zeus CLI project or a Watchface Maker export
  and keep editing. Compressed Maker images are decoded, and runtime-picked image
  sets are traced back to their data source.
- **Ship it**: export a Zeus project, build the installable `.zab` with the Zeus
  CLI, or serve it on your LAN and install it with the Zepp App's developer-mode
  QR scanner.

| | |
| --- | --- |
| <img src="docs/screenshots/image-picker.png" alt="Image picker with previews"> | <img src="docs/screenshots/font-library.png" alt="Font library with Romanian coverage"> |
| **Image picker.** Every image field shows a preview; choosing opens a searchable grid of the project's images. | **Font library.** Fonts are marked ✓ / ≈ / ✕ for the project language. Here, `SÂMBĂTĂ` is drawn in Orbitron, which has no Ă. |
| <img src="docs/screenshots/import.png" alt="Import report"> | |
| **Import report.** What came across, what was traced, and what has no designer equivalent. | |

## Getting started

Requirements: **Node 18+** and npm, on macOS, Windows or Linux. The **Zeus CLI**
is optional and only needed to build `.zab` packages (`npm i -g @zeppos/zeus-cli`).

```bash
git clone https://github.com/calinhoria/dialcraft.git
cd dialcraft
npm install
npm start
```

If `npm start` reports *"Electron failed to install correctly"*, npm skipped
Electron's install script. Run `npm install --foreground-scripts`.

### Your first face in a minute

1. **New** → pick your watch and the *Digital clock starter*.
2. Select the hour layer and, in **Properties → Glyph style**, change the font,
   size or fill. The digits, the colon and any `°` follow along.
3. **Presets ▾** adds weekday, date, steps, heart rate, battery, weather, arcs …
4. Select the layers that should stay on in always-on mode and click **Both** under
   *Show in* (or press `⇧B`), then check them with the **AOD** preview.
5. Press **Check**, then **Build .zab**, or **Install** to scan the QR code with
   *Zepp App → Profile → your device → Developer Mode*.

Every property in the Properties panel has an ⓘ: hover it to see what the
property does on the watch.

### Editing an existing face

**Import** a Zeus CLI project folder (with `app.json`, `watchface/` and
`assets/`) or a Watchface Maker export. The source folder is never modified.
**Save** writes a Dialcraft project (`<name>.wfproj.json` plus `images/` and
`fonts/`).

## Keyboard

| | |
| --- | --- |
| Undo / redo | `⌘Z` / `⌘⇧Z` (`Ctrl` on Windows/Linux) |
| Save | `⌘S` |
| Duplicate, group, ungroup | `⌘D`, `⌘G`, `⌘⇧G` |
| Bring forward / send backward | `⌘]` / `⌘[` (add `⇧` for front / back) |
| Nudge | arrow keys (`⇧` for 10 px) |
| Face variant of the selection | `⇧N` Normal · `⇧A` AOD · `⇧B` Both |
| Number fields | wheel or `↑`/`↓` on a focused field, or drag its label to scrub (`⇧` for ×10) |
| Delete | `Delete` / `Backspace` |

## Documentation

The full **[user guide](docs/GUIDE.md)** covers every widget, glyph and text
style, groups and alignment, AOD, export and build, Wi-Fi install, importing, and
the project format.

Zepp OS references: [watchface API](https://docs.zepp.com/docs/watchface/) ·
[widgets](https://docs.zepp.com/docs/watchface/api/hmUI/widget/) ·
[design specification](https://docs.zepp.com/docs/watchface/specification/) ·
[Zeus CLI](https://docs.zepp.com/docs/guides/tools/zeus-cli/)

## Development

| Script | What it does |
| --- | --- |
| `npm start` | Run the app |
| `npm run css` | Rebuild `styles.css` from `styles-src.css` (Tailwind v4) |
| `npm run smoke` | End-to-end test: drives the app through new face → presets → code → save → export → import → fonts → `zeus build` → LAN install (`SMOKE_BUILD=0` skips the CLI build) |
| `npm run dist` | Package with electron-builder (`dist-mac` / `dist-win` / `dist-linux`) |
| `npm run icon` | Render `build/icon.png` / `build/icon.icns` |
| `npm run masks` | Regenerate the device display masks |
| `npm run sample` | Regenerate `samples/sample-digital/` |
| `python3 tools/fonts-latin-ext.py` | Rebuild the bundled fonts with Latin Extended coverage (needs `fonttools`) |
| `node_modules/.bin/electron tools/shot.js` | Scripted UI screenshots (used for this README) |

```
main.js        Electron main process: dialogs, save / export / build / install IPC
renderer.js    the editor: model, canvas, panels, glyph engine, import and install UI
core/          codegen, importer, device catalog, widget kinds, data types, fonts, LAN server
assets/        bundled fonts (OFL) and device masks
tools/         smoke test, screenshots, icon, masks, sample, font rebuild
docs/          user guide and screenshots
```

## Notes

- Dialcraft is an independent project. It is not affiliated with or endorsed by
  Zepp Health; *Amazfit* and *Zepp* are their trademarks.
- The bundled fonts are under the SIL Open Font License; see
  [`assets/fonts/FONTS.md`](assets/fonts/FONTS.md). The licence file is copied
  into every export that ships one of them.
- The Honeybee face in the screenshots is used as an example of importing an
  existing Zepp OS project.
