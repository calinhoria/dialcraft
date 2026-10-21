---
name: create-amazfit-watchface
description: Design and build a watchface for an Amazfit / Zepp OS watch (Bip, Balance, Active, Cheetah, T-Rex, GTR/GTS, Falcon, Band) from a description — layout, fonts, colours, data fields, AOD — and export a ready-to-build Zeus project or .zab. Use when the user asks to create, design or generate an Amazfit or Zepp OS watchface, or to turn an idea or reference image into one. Drives the Dialcraft editor headlessly.
---

# Create a watchface for Amazfit

You design the face in **Dialcraft** (this repository): a headless driver (`tools/face-cli.js`) runs the
real editor offscreen from a JSON *recipe*, so the preview, the glyph images, the lint and the Zeus export are
exactly what the app produces. You write the recipe, look at the preview, fix it, and export.

Work from the repository root (the folder with `package.json`; `npm install` must have been run). Keep the
recipe, previews and output in a scratch folder (not in the repo).

## Workflow

1. **Pin down the brief.** Ask only what you cannot choose yourself: the **watch** (a `device` key from
   [references/devices.md](references/devices.md); square and round screens need different layouts), the
   **look** (colours, mood, digital / analog, a reference image) and the **data** to show (steps, heart rate,
   battery, weather, date …). Default to a black background, one accent colour, and at most 4–5 elements.
2. **Write the recipe** — format in [references/recipe.md](references/recipe.md), a working one in
   [examples/neon-pulse.json](examples/neon-pulse.json). Order matters: **add every layer first (presets),
   then style and position them** — digit sets are shared between layers until one is restyled.
3. **Run it:**
   ```bash
   env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js /path/to/recipe.json
   ```
   The last stdout line is JSON: `ok`, the step `log`, the `layers` (name, kind, position), the `lint` messages,
   the `preview` / `previewAod` PNG paths and the `export` result (`syntax: "ok"`, warnings, artifacts).
   Nothing is installed or opened on the machine.
4. **Look at the preview** (read the PNG). Check it against the brief: overlaps, text running off the screen,
   contrast, balance. The lint list is a floor, not a verdict — it knows overlaps, off-screen layers and
   AOD budgets, not taste. Fix with `edit` steps (`set` for position / size, `glyph` for font size and colour)
   and re-run until it looks right. Expect 2–4 iterations.
5. **Do AOD properly** ([references/design-rules.md](references/design-rules.md)): give the layers that stay on
   in always-on mode `"show": "both"` (or `"aod"` for an AOD-only version), keep it sparse and dim, no second
   hand, then check `previewAod`. A face with nothing in AOD makes the watch use its own AOD face.
6. **Export.** Set `"out"` to write the Zeus project (`app.json`, `watchface/<target>/index.js`, `assets/`).
   Set `"build": true` as well to run the Zeus CLI and get the installable `.zab` in `dist/` (needs Node + `npx`
   and, the first time, a network connection). Add `"save"` to also write the editable Dialcraft project
   (`*.wfproj.json` + `images/`), which the app opens for further hand-tuning.
7. **Hand it over honestly.** Say where the files are, show the preview, list the lint warnings you left and why,
   and say plainly that the face has been built and syntax-checked but **not run on a watch** — the user installs
   it with the Dialcraft app (Install → QR code in the Zepp App's developer mode) or `zeus preview`, and tests it.

## Rules that save time

- **Layout:** positions are the layer's top-left in device pixels; the screen is in
  [references/devices.md](references/devices.md). Digit layers are boxes as wide as their data can get, with the
  value aligned inside (`alignH`); check the box in the layer list, not just the ink.
- **Glyph size** is the digit image height in pixels; ~100–140 px for a hero time, ~30–40 px for a reading on a
  ~400 px screen. Edit the **glyph** (`"glyph": {…}`), not `size`, on digit / weekday / reading layers.
- **Fonts:** 33 bundled families (Orbitron, Inter, Montserrat, Bebas Neue, DSEG7 …); use one family per face.
  Other fonts are not available headlessly.
- **Data bindings are native:** `TEXT_IMG`, `IMG_LEVEL`, `IMG_POINTER` take a `dataType`; the watch updates them.
  `ARC_PROGRESS` / `BAR` get a small reader only for the data types listed in `docs/ZEPP_COVERAGE.md`.
- **Custom code** (animation that follows the clock, games, timers): [references/custom-code.md](references/custom-code.md) has the
  recipe keys, the device facts that cost hours to find (`px(variable)` throws, `IMG_ANIM` moves with `Y` not `MORE`, no global
  `timer`) and how to test on a real watch with logs over the developer bridge. Read it before writing `userCode`.
- **Don't invent widgets.** Only the kinds in [references/kinds.md](references/kinds.md) exist; for anything
  else, say it is not supported rather than faking it. Coverage and known gaps: `docs/ZEPP_COVERAGE.md`.
- **Don't overwrite** a user's existing project: write to a new `out` / `save` folder.
- To start from an **existing face** (a Maker export, a `.zip`), use the app's import instead of rebuilding it
  — see `docs/GUIDE.md` → *Importing an existing watchface*.

## If something fails

- `unknown device …` — use a key from the devices table.
- A step in `log` says `failed:` — the message is the editor's; fix the property name or value (see kinds.md).
- Preview is blank or glyphs missing — the glyph font name must be exactly a bundled family; re-run after
  checking the `lint` for `no images assigned`.
- `export.syntax` is not `ok` — report it with the message; do not hand the face over.
- A build error `Could not run the Zeus CLI` — Node / npx are missing from the PATH; export without `build` and
  tell the user to install Node.js.
