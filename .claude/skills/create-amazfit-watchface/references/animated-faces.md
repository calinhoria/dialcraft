# Animated faces: sprites, a toolkit and a capture tool

**Rule: one static scene image plus small sprites that the code moves or swaps. Never a full-screen frame sequence.** (The owner's standing
rule: smaller export, less work for the watch. The ten faces made this way export 96–220 KB each; a frame-sequence face is several MB.)

## What is true about the runtime (checked in the editor's stand-in and on the Bip 6)

- An `IMG` is drawn **at its own pixel size and clipped to its box**. `setProperty(MORE, {w, h})` therefore never stretches it. A bar that
  fills is a **full-length sprite whose box width changes** (revealed from the left); a dimming veil is a full-size sprite shown or hidden.
- `MORE` takes `{x, y, src, w, h}` on a plain `IMG` (`IMG_ANIM` ignores x/y in `MORE`, see custom-code.md). Swapping `src` needs a picture
  from the same slot.
- An `IMG` layer with **two or more pictures** (`images`) is a *slot*. Its handle gives `W.<handle>` and `F.<handle>` (the picture paths).
  The **first picture is what the static preview, the store thumbnail and the first frame show**.
- A bar that follows steps, battery … is a native **`IMG_PROGRESS`** (a row of segment pictures with `positions`, `dataType`, no code); the toolkit's
  `segBar(name, dataType, pictures, positions)` makes one, and the dim track is drawn in the scene. Do **not** use `BAR`: it exports as a `FILL_RECT`
  that a sensor callback resizes from zero, and on a real Bip 6 it never filled. `ARC_PROGRESS` (rings, arcs) is fine; it has a centre, not a top-left.
- The time, the date, steps, heart rate, battery, temperature and sunrise are **native layers**, restyled, never sprites. `IMG_TIME` can take a
  custom set of ten pictures (`images`), so a clock can be drawn as flap plates, nixie tubes, receipt print … and still be data-bound.
- Code reads only `Date` (hours, minutes, seconds, weekday, day of year). Sensors from `@zos/sensor` are not verified on the device and the
  stand-in returns zeros for them; derive what you can from the date, and use native layers for the rest.
- The loop is a chain of `setTimeout` (re-armed after each tick, ≥ 100 ms), not `setInterval`; stop on `pause_call`, start on `resume_call`.
  `examples/animated/runtime.js` is that loop plus `slot(handle)(x, y, variantIndex, w, h)` which skips unchanged calls.
- Slots that must disappear swap to a **blank picture** (the toolkit appends one to every slot) instead of moving off-screen.

## Anatomy of a face

| part | where | what |
|---|---|---|
| native layers | `face.json` + `build.js` | clock, date, readings: presets, glyph styles, positions measured from ink |
| scene | `build.js` | one opaque image: background, labels, frames, tracks, anything that never moves |
| slots | `build.js` | sprites, each a slot with all its pictures on **one canvas size**; share identical pictures (`mkSlot(..., share)`) |
| timeline | `code.js` | watch code: `tick()` places the slots from `Date`; placeholders `/*V*/` (per-slot picture index maps) and `/*RUNTIME*/` |
| always-on | `build.js` (`__A`) + `tail.js` | a separate dim **outline** twin of the clock (`show: aod`); nothing else; no animation |

Covers are a legitimate technique: a sprite above a native layer hides it until a time (a printer pulling paper back, a boot screen revealing
lines), and cover strips either side keep a long ticker inside its band. Put such layers in `__TOP` so they sit above the native ones.

## Workflow

```bash
cd .claude/skills/create-amazfit-watchface/examples/animated
python3 get_fonts.py <id>:<weight> ...                       # fonts, Romanian-checked (see references/fonts.md)
# write faces/<stem>.face.json, <stem>.build.js, <stem>.code.js  (copy faces/receipt.* and change it)
python3 build_face.py faces/<stem>                           # -> faces/<stem>.recipe.json
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js .claude/skills/create-amazfit-watchface/examples/animated/faces/<stem>.recipe.json   # from the repo root
python3 capture.py faces/<stem>-project faces/<stem>.gif 9 12 0     # the face's OWN code on a virtual clock -> GIF; prints `errors []`
python3 publish_sample.py faces/<stem> <sample-name> "<description>"  # sample-watchfaces/<sample-name>/, fonts in, reopened and verified
```

`capture.py` is the proof that the code works: it runs the real `userCode` in the editor's stand-in with `Date` and the timers virtual
(2026-10-24 10:09:`start`), so a minute rollover is `... 12 12 50`. A thrown error is listed; a clean run says `errors []`.

### What the build kit gives you (`kit.js`, available inside `build.js`)

Measured placement (ink bounds from a real render of just those layers; `drawScene` ignores `visible`, so layers are isolated by swapping the
element list): `inkBox(names, state, weekday)`, `align(names, {l|cx|r, t|cy|b})`, `seqRow(names, cx, cy, gap)` (equal ink gaps; use it for
hour–colon–minute), `park(names)` (put layers on screen so they can be measured), `dateRow(cx, cy, gap)`, `chipAt` / `batChipAt` / `chipL` (icon + reading,
centred or left-aligned, digits' ink centred on the icon) and `chipRow(groups, cx, gap)`. Drawing: `rr circ ell poly line txt grad rgrad glow icon cell`
(heart, steps, thermometer, sun, bolt, battery cell), `scene(canvas, name)`. Slots: `mkSlot(handle, label, [[key, drawFn], …], w, h, x, y, share)`,
`refPlace` (runs `code.js` once at 10:09:36 against recording stubs and makes **that** the static state: positions and sizes as the code set
them, the shown picture moved to first place, blank first where the code hides the slot). Set `globalThis.__REFADJ = (ms) => …` to choose a better
moment for the preview. Globals the build script sets for the tail: `__A` (always-on clock: font, size, colour, `row` or `stack` or `left`),
`__G` (group name → layer names, in layer-list order), `__TOP`.

In `code.js` use `V[handle][key]` for a picture index, **per slot**: `refPlace` reorders each slot's pictures, so the maps differ between
slots that were built from the same list. Numeric placeholders: `/*FW*/ /*TL*/0 /*CW*/0 /*K*/0 /*PT*/0 /*PH*/0 /*PX*/0` are filled from
`globalThis.__FW`, `__TL`, `__CW`, `__K`, `__PT`, `__PH`, `__PX` (add more in `fillCode` when a face needs a measured constant).

## Sunrise and sunset

Use the `suntimes` preset (see SKILL.md): both native readings in one place, each with its icon, swapped by `showWhen: sunset | sunrise` and generated
code that reads today's times from the weather data. In a toolkit face: add `suntimes` to the presets in `face.json`, clear `showWhen` (the generator
does), place the readings with `sunChipAt(cx, cy, size, colour, line)` (centred) or `sunChipL(left, cy, …)`, and put any text that belongs with the
reading (a label like APUS / RĂSĂRIT, a formula) in layers of its own with the same `showWhen` so they swap together. `sunChipAt` sets `showWhen` at the end.
To look at the sunrise state in a preview, set `SUN_PREVIEW.rise = 1000; SUN_PREVIEW.set = 1100` in a `script` step (the editor assumes sunrise 06:30
and sunset 18:30).

## Lint, and the cases it is right about

- `error: … is off-screen` for a sprite parked off the screen: do not park there. Start every slot on screen with the **blank picture first**
  (the toolkit swaps it in for slots the code hides at the reference time) or at the position the code gives at 10:09:36.
- A sprite **wider than the screen** (a ticker) is an error. Split it into a ring of chunks, each narrower than the screen, repeat the text so the ring
  closes, give each slot `SLOTS[h].park = [x, y, showFirst]`, and let two cover strips hide the ends (`faces` in the repo: *monitorul-de-pe-mana*).
- `warn: … overlap` between boxes of digit layers is about the box, not the ink; measure the ink instead.
- `info: N images in the project are unused`: the replaced font digits; they are not exported.

## Efficiency numbers to report

Unique sprite pictures, their total bytes, scene bytes, export assets bytes (`optimizePng: 32` in the recipe reduces the pictures to 32
colours at export; the saved project keeps full colour). Take them from the project's image list (`sp/…`), not from the folder.
Digit pictures that several slots use are baked once (`share`). Typical: 4–80 unique sprites, 5–270 KB, export 96–220 KB.

## Timeline design

Tie it to the real clock, not to a loop of your own: the minute phase (`seconds + ms/1000`) for things that restart every minute (a boot
sequence, a receipt, a scrubber), `Date.now()` for things that cycle (every 3 s, every 15 s), and the date for anything that is a fraction of a
day, week or year. Keep the time legible: a gag never hides the clock for long. A face that runs longer than a few seconds of effect per
minute should be quiet the rest of the time (hold the final state).
