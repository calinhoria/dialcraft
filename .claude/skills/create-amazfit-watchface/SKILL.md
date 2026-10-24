---
name: create-amazfit-watchface
description: Design and build a watchface for an Amazfit / Zepp OS watch (Bip, Balance, Active, Cheetah, T-Rex, GTR/GTS, Falcon, Band) from a description — layout, fonts, colours, data fields, AOD — and export a ready-to-build Zeus project or .zab. Use when the user asks to create, design or generate an Amazfit or Zepp OS watchface, or to turn an idea or reference image into one. Drives the Dialcraft editor headlessly.
---

# Create a watchface for Amazfit

You design the face in **Dialcraft** (this repository): a headless driver (`tools/face-cli.js`) runs the
real editor offscreen from a JSON *recipe*, so the preview, the glyph images, the lint and the Zeus export are
exactly what the app produces. You write the recipe, look at the preview, fix it, and export. The driver is truly headless
(`DIALCRAFT_HEADLESS`, set by the tool): no editor window opens, no Dock icon bounces, nothing takes focus, so it can run
hundreds of times in a session without bothering the user. Never launch the app itself (`npm start`) to build a face.

Work from the repository root (the folder with `package.json`; `npm install` must have been run). Keep the
recipe, previews and output in a scratch folder (not in the repo).

## Workflow

1. **Pin down the brief.** Ask only what you cannot choose yourself: the **watch** (a `device` key from
   [references/devices.md](references/devices.md); square and round screens need different layouts) and the
   **look** (colours, mood, digital / analog, a reference image). Default to a black background and one accent colour.
   **Always ask a multiple-choice question before you start building** about which elements to include
   (multi-select: date / weekday, battery, temperature / weather, steps, heart rate, calories, distance, …),
   even when the request names a few; offer the sensible ones for the theme and let the user pick. Do not start
   the recipe until it is answered.
2. **Write the recipe** — format in [references/recipe.md](references/recipe.md), a working one in
   [examples/neon-pulse.json](examples/neon-pulse.json). Order matters: **add every layer first (presets),
   then style and position them** — digit sets are shared between layers until one is restyled.
3. **Run it:**
   ```bash
   env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js /path/to/recipe.json
   ```
   The last stdout line is JSON: `ok`, the step `log`, the `layers` (name, kind, position), the `lint` messages,
   the `preview` / `previewAod` PNG paths and the `export` result (`syntax: "ok"`, warnings, artifacts).
   Nothing is installed or opened on the machine, and no window appears (`windows: 1` in the result is the hidden offscreen one).
   A face that **animates** is not a plain recipe: follow [references/animated-faces.md](references/animated-faces.md) (sprites, a
   toolkit in [examples/animated/](examples/animated/), and a capture tool that runs the face's own code on a virtual clock and writes a GIF).
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
7. **Final measured check — mandatory, never skip it, and run it again after every later edit.** A small late change (a size, a
   position, a new row) can quietly unbalance a face that was already good, so this is the last thing done before hand-over and it is
   done on the final export, not on an earlier run. Read the final `preview.png` and `preview-aod.png` with PIL and measure; do not
   judge by eye:
   - the colon is centred on the digits, vertically and between the hour and the minute (normal and AOD clock);
   - the gaps between stacked rows and blocks are equal, the top and bottom margins match, left matches right;
   - every value is centred in its block or chip, and the space above a value under a chip equals the space below it;
   - text left edges and baselines line up in each row and column, and nothing touches the 2 px safe edge or the rounded corners
     (for example 86 px radius on the Bip 6);
   - the lint has no `error:`, and every `warn:` left has a reason (a box overlap with no ink overlap is fine).
   If anything is off, fix it and run the whole check again. Say in the hand-over that this check was done and what it measured.
8. **Hand it over honestly.** Say where the files are, show the preview, list the lint warnings you left and why,
   and say plainly that the face has been built and syntax-checked but **not run on a watch** — the user installs
   it with the Dialcraft app (Install → QR code in the Zepp App's developer mode) or `zeus preview`, and tests it.
   For an animated face also report the **unique sprite frames and their bytes** and the **export assets size** (counted from the
   project's own image list, not the folder: stale files stay in a re-used folder), and give the GIF. If the face goes into
   `sample-watchfaces/`, use `examples/animated/publish_sample.py`: it regenerates everything in place, puts the fonts into the project
   and reopens it to prove the fonts load and the render matches. Commit and push only when the user asks.

## House rules (always follow)

- **Group related components and name the group.** The clock (hour, colon, minute), the date row (weekday, day,
  month), a reading with its icon, the fish slots, a scene's decor … each become one named group
  (`Clock`, `Date`, `Steps`, …), not loose layers. In a recipe, add a `script` step after the layers exist:
  `project.groups = project.groups || {}; project.groups.gClock = 'Clock'; let n = 0; for (const nm of ['Hour Main','Colon Main','Minute Main']) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = 'gClock'; n++ } } return n`
  (use the exact layer names; do **not** use `find()` for this, it does not hand back the real layer, so the group would exist but stay
  empty). The members should be neighbours in the layer list. After the run, check the step's result (`script → 3`) and that the saved
  project lists each layer's `group`: a group with no members is silently dropped.
- **Digital time layer order is always hour, colon, minute from top to bottom of the Layers panel.** The panel lists the top
  layer first, so in the project the order is minute, colon, hour. The `clock` / `clocksec` presets already do this and put the
  parts in a group named `Clock`; a second clock preset makes `Clock 2` (rename it, e.g. `Clock AOD`, with a `script` step on
  `project.groups`). Never add the parts by hand in the wrong order, and check the saved project's element order.
- **Next sunrise / sunset is the `suntimes` preset**, not `sun`. The native `SUN_CURRENT` reading (what `sun` makes) is documented as the next
  event but on a real Bip 6 it stayed on today's sunset for hours after the sunset had passed; there is no "next sunrise" value on the watch.
  `suntimes` places the two plain readings (`SUN_RISE`, `SUN_SET`) and an icon each in **one spot**, and the generated code shows the one that
  is next (`showWhen: sunset` / `sunrise`): the sunset from sunrise until sunset, the sunrise otherwise (after sunset it is today's sunrise
  time, within a minute or two of tomorrow's). The code reads today's times from the weather data (`Weather` via a namespace import, both
  method names tried) and falls back to 06:00–18:00 when the watch has none. Remove the preset's two default icons if you draw your own and
  give any label or formula that sits with the reading the same `showWhen` (APUS / RĂSĂRIT). `showWhen` hides a layer in the editor too, so set
  it only after measuring and placing (the toolkit's `sunChipAt` does). Never use the "time to sunrise" reading.
- **A bar that must fill is a native `IMG_PROGRESS`** (segments, data-bound, no code), not a `BAR`. `BAR` exports as a `FILL_RECT` that a sensor
  callback resizes from zero; on a real Bip 6 such bars (steps, battery, a vine) never filled. Draw the segment picture, give `positions`
  (bottom to top for a vertical bar, one entry per segment) and a `dataType`; the dim track goes in the scene. `ARC_PROGRESS` rings are fine.
- **Subtle borders and shadows.** Use a thin border (1–2 px) and a soft shadow only where legibility needs it.
  Heavy outlines, thick glows and drop shadows only when the theme is that by nature (neon, cartoon, fire) or the
  user asks. When in doubt, leave them off.
- **Check text alignment in the preview, every time.** Read the PNG and verify the horizontal and vertical
  alignment of every text element: shared baselines on a row, equal cap heights, even gaps, columns centred
  where they should be. If it is unclear by eye, crop and zoom the preview or measure the ink bounds of each
  element (e.g. with PIL) and fix with `set` x / y and `glyph` size / weight. Different layer kinds (weekday
  images vs digits) have different ink heights at the same size, so compare ink, not the numbers you set.
- **Centre the colon on the digits, measured.** A colon image is a separate layer whose cell does not line up with the digit cells, so
  at the same `y` it usually sits too high or too low, and it is rarely centred between the hour and the minute. After every run
  measure the ink of the hour, colon and minute (PIL: bounding box per column run) and fix with `set` x / y on the colon until its
  vertical centre equals the digits' centre (within 1 px) and its horizontal centre equals the midpoint between the hour's right
  edge and the minute's left edge. Do it for the normal clock and for the AOD clock, whatever the font or glyph size.
- **Check spacing symmetry, measured.** Stacked rows get one equal gap (e.g. every block 8–9 px apart), the top and bottom margins
  of the face match (and left matches right), and each value sits centred in its block or chip (same space above and below the
  ink; a reading under its label chip has the same space above the chip as below the value). Measure it after every run, do not
  judge by eye: read the PNG with PIL, take the non-black runs down a column (e.g. through the sidebar and through the content),
  and compare the gaps, the margins and each item's top / bottom space inside its block. Different layer kinds have different ink
  offsets at the same `y`, so move by the measured difference and re-measure until the gaps are equal within 1 px.
- **Stats must be visible and not small.** Readings need to be readable at a glance on the real screen; as a
  floor use ~28 px glyph height on ~400 px screens (~24 px on the smallest) and enough contrast with their
  background. Do not shrink a stat to make it fit.
- **Animation is sprites, always (the owner's standing rule).** One static scene image plus small sprites that the code moves or swaps
  with `setProperty(MORE, {x, y, src, w, h})`; never a full-screen frame sequence. Smaller export, less work for the watch. The time and
  every reading stay **native, data-bound layers** (never baked into a sprite), and the code takes everything else from `Date`. Details,
  the facts that make it work (an image is drawn at its natural size and **clipped**, never stretched; the first picture of a slot is the
  static preview) and the toolkit: [references/animated-faces.md](references/animated-faces.md).
- **Taste for the funny / weird / witty request (the owner's standing preference).** No characters, no mascots, no cartoon art. The
  humour lives in the interface itself: a player that buffers, a BIOS report, a departure board, a receipt, subtitles, a spreadsheet that
  errors, deadpan copy. Write the copy in the watch's language with real diacritics. When asked for concepts first, show **animated GIFs**
  of working faces, not still sketches.
- **If space runs out, ask the user, do not decide alone.** When the chosen elements will not fit at readable
  sizes, stop and ask a multiple-choice question for the resolution (drop an element, move it to AOD only or to
  a tap / complication slot, shrink the clock, change the layout …) with your recommendation first.

## Rules that save time

- **Layout:** positions are the layer's top-left in device pixels; the screen is in
  [references/devices.md](references/devices.md). Digit layers are boxes as wide as their data can get, with the
  value aligned inside (`alignH`); check the box in the layer list, not just the ink.
- **Glyph size** is the digit image height in pixels; ~100–140 px for a hero time, ~30–40 px for a reading on a
  ~400 px screen. Edit the **glyph** (`"glyph": {…}`), not `size`, on digit / weekday / reading layers.
- **Fonts:** use one family per face (two when one is a masthead). The 33 bundled families (Orbitron, Inter, Montserrat, Bebas Neue,
  DSEG7 …) are the fallback; when the user wants **new / external fonts**, fetch free OFL fonts with
  `examples/animated/get_fonts.py` (Fontsource, `latin` + `latin-ext` merged into one TTF so **ă â î ș ț** come from the font, not from a
  system fallback) and register them in a `script` step with `registerCustomFont(...)` — see [references/fonts.md](references/fonts.md),
  which also lists which families really cover Romanian. A saved project needs the font files in `project/fonts/` and a `fonts` list,
  which face-cli's `save` does not write; `publish_sample.py` does it.
- **Data bindings are native:** `TEXT_IMG`, `IMG_LEVEL`, `IMG_POINTER` take a `dataType`; the watch updates them.
  `ARC_PROGRESS` / `BAR` get a small reader only for the data types listed in `docs/ZEPP_COVERAGE.md`.
- **Custom code** (animation that follows the clock, games, timers): [references/custom-code.md](references/custom-code.md) has the
  recipe keys, the device facts that cost hours to find (`px(variable)` throws, `IMG_ANIM` moves with `Y` not `MORE`, no global
  `timer`) and how to test on a real watch with logs over the developer bridge. Read it before writing `userCode`.
- **Weekday names of any length.** The weekday layer is one cell as wide as the longest name (Romanian long names run from *Luni* to
  *Miercuri*), anchored at its left edge, so a fixed `x` for the day number overlaps or leaves a hole. Right-align the names
  (`labelAlign: right`), keep a fixed ink gap to the day, share the baseline and centre the row on the average name: `dateRow()` in the
  toolkit does it from measurements of all seven names. Check the row for every weekday, not just the reference one.
- **Rounded corners are part of the layout.** The Bip 6 screen is a rounded rectangle (radius 86); baked pills, bars and frames count too,
  not only layers. Measure the outline of every baked shape against the corner (the toolkit's checks do) and keep ≥ 2 px clearance.
- **Don't invent widgets.** Only the kinds in [references/kinds.md](references/kinds.md) exist; for anything
  else, say it is not supported rather than faking it. Coverage and known gaps: `docs/ZEPP_COVERAGE.md`.
- **Don't overwrite** a user's existing project: write to a new `out` / `save` folder.
- To start from an **existing face** (a Maker export, a `.zip`), use the app's import instead of rebuilding it
  — see `docs/GUIDE.md` → *Importing an existing watchface*.

## If something fails

- `unknown device …` — use a key from the devices table.
- A step in `log` says `failed:` — the message is the editor's; fix the property name or value (see kinds.md).
- Preview is blank or glyphs missing — the glyph font name must be exactly a bundled family or a font registered with
  `registerCustomFont`; re-run after checking the `lint` for `no images assigned`.
- Lint `error: … is off-screen` on an animated sprite — see the lint section of
  [references/animated-faces.md](references/animated-faces.md) (blank picture first, park the slot, or split a wide sprite into chunks).
- `export.syntax` is not `ok` — report it with the message; do not hand the face over.
- A build error `Could not run the Zeus CLI` — Node / npx are missing from the PATH; export without `build` and
  tell the user to install Node.js.
