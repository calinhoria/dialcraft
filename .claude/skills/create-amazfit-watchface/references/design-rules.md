# Design rules (Zepp watchface specification + what the editor checks)

Sources: the Zepp OS watchface design specification (https://docs.zepp.com/docs/watchface/specification/) and
the app's *Check* (the `lint` list of a run).

- **Reference time:** previews and the store icon show 10:09:36. Design the layout for that time and for the
  widest one (e.g. 20:48) — digit boxes are as wide as the data can get.
- **Safe edge:** keep 2 px (the app draws it amber) free on every side; on round screens nothing important in
  the corners — the visible shape is the circle (or the rounded square on square watches).
- **Background:** black. AMOLED pixels that are black are off: it is the look and the battery.
- **AOD (always-on):** an AOD face must be **sparse and dim** — only the time and perhaps one or two readings;
  lit pixels under ~10 % of the screen; **no second hand, no animation**; no large bright areas. Put the layers that
  stay on in **both** states (`"show": "both"`) or build an AOD-only version of them (`"show": "aod"` + a normal
  twin); a face that has nothing in AOD makes the watch fall back to its own.
- **Contrast and size:** time ≥ ~90 px tall on a ~400 px screen reads at a glance; secondary readings 28–40 px;
  keep at least 3:1 contrast against black; avoid thin strokes below 2 px.
- **Naming and files:** images are written for you (`font_<n>_<digit>.png`, `week_w1.png` …); do not rename.
- **Data bindings:** a reading (`TEXT_IMG`), level (`IMG_LEVEL`) or pointer (`IMG_POINTER`) follows its
  `dataType` on the watch by itself — give it the right type instead of a fixed number.
- **Language:** weekday and month names are drawn from the system's locale data — set `language` (e.g. `ro-RO`)
  and use a font that has the letters (the app marks missing ones; Latin-extended is covered by the bundled set).
- **Don't:** more than ~6 elements on a small screen; two accent colours fighting; text over busy images; a
  second hand in AOD; relying on a font the user does not have.

## House rules recap (also in SKILL.md)

**The last step before hand-over is the measured check (SKILL.md step 7): mandatory, and repeated after any later edit.**

Group and name related layers · digital time order hour, colon, minute · subtle borders / shadows unless the theme or the
user wants more · verify text alignment in the preview · colon centred on the digits (measured) · spacing symmetric: equal gaps, equal margins, values centred in their blocks (measured) · ask a multiple choice about elements first · stats readable
(≥ ~28 px) · ask the user when space is short.
