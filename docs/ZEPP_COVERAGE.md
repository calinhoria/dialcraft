# Zepp OS watchface components — coverage report

Checked 2026-10-19 against the public Zepp OS watchface documentation
(<https://docs.zepp.com/docs/watchface/api/hmUI/widget/>, one page per widget, plus
`data_type`, `edit_watchface` and `app-json`) and compared with what Dialcraft does at the
three levels that matter: **editor + preview**, **export** (generated `index.js` / `app.json`) and
**import** (reading an existing face).

**Verdict (updated after the follow-up work): every widget on the documented widget pages is now
covered. What is still missing is the editable background / pointer widgets, a few runtime controls
(animation status, delegate callbacks), more sensor readers and `photoscreen`.** Details below;
rows marked “(new)” were added after the first version of this report.

Legend: ✅ full · 🟡 partial · ❌ not implemented · — not applicable

## How reliable this report is

- The docs pages are uneven. ARC, CIRCLE, FILL_RECT, STROKE_RECT, TEXT, TEXT_IMG, IMG, BUTTON,
  IMG_ANIM, IMG_POINTER, ARC_PROGRESS, IMG_PROGRESS, IMG_LEVEL have parameter tables. IMG_TIME,
  IMG_DATE, IMG_WEEK, TIME_POINTER, DATE_POINTER, IMG_STATUS, IMG_CLICK, GRADKIENT_POLYLINE and
  DELEGATE only have a code example, so “the parameters” there are what the example shows plus the
  usual `xx_` prefix pattern.
- The `setProperty` / `getProperty` reference pages were not readable, so runtime control of each
  widget (what can be changed after creation) is judged from the examples only.
- Nothing here was verified on a watch; the “export” column means the generated code contains the
  parameter and passes a syntax check / mock run.

## Widgets

| Widget (docs) | Dialcraft layer | Editor + preview | Export | Import | Gaps |
|---|---|---|---|---|---|
| IMG | Image | ✅ | ✅ | ✅ | `pos_x/pos_y/angle/center_x/center_y` all supported. Docs: the picture is never scaled (`w/h` only crop) — the editor follows this. Runtime `setProperty` only used for background variants. |
| TEXT | Text | ✅ | ✅ | ✅ | **`text_style`** (NONE / WRAP / ELLIPSIS) added (new): editor field, preview, export, import. Styled text (outline, gradient, bold, italic) is baked into a PNG instead of a TEXT widget, by design. `font` (new API) ✅. |
| ARC | Arc | ✅ | ✅ | ✅ | — |
| FILL_RECT | Filled rectangle | ✅ | ✅ | ✅ | `radius`, `angle`, alpha ✅. |
| STROKE_RECT | Stroked rectangle | ✅ | ✅ | ✅ | — |
| TEXT_IMG | Data reading (digit images) | ✅ | ✅ | ✅ | (new) **`imperial_unit_*`**, the fixed **`text`** mode and `invalid_image` added. Still one picture sent for sc/en/tc (a unit per language is not offered) and no `h`. `dot_image`, `negative_image`, `h_space`, `align_h`, `w` ✅. Distance capacity (3 digits + dot) matches the Maker. |
| ARC_PROGRESS | Arc progress | ✅ | 🟡 | ✅ | All parameters ✅. `level` follows a reading only for the 17 data types that have a sensor reader (below); the others stay static on the watch and a warning says so. |
| IMG_PROGRESS | Image progress bar | ✅ | ✅ | ✅ | (new) irregular `x[]` / `y[]` positions are kept per picture (an even row stays start + spread). |
| IMG_LEVEL | Image level (from data) | ✅ | ✅ | ✅ | Bound by `type` natively; sets picked at runtime are recognised on import. |
| IMG_ANIM | Animation | 🟡 | 🟡 | ✅ | (new) `display_on_restart` and `default_frame_index` added. Still missing: `anim_complete_call`, `anim_auto_resume_call`, `anim_repeat`, and the runtime `ANIM_STATUS` control (START/PAUSE/RESUME/STOP) / `ANIM_IS_*` reads. Frames, fps, `step`, `repeat_count` ✅. |
| CIRCLE | Circle | ✅ | ✅ | ✅ | — |
| IMG_POINTER | Image pointer (dial) | ✅ | ✅ | ✅ | `invalid_visible` is always written as 0 when a data type is bound (docs default: true). |
| BUTTON | Tap zone | ✅ | ✅ | ✅ | (new) a Tap zone with a label and/or fill colour is a visible button: `text`, `color`, `text_size`, `normal_color`, `press_color`, `radius`. Without them it stays the invisible zone (action = open a screen / cycle variants / next colour theme). Custom click code is not kept. |
| IMG_STATUS | System status icon | ✅ | ✅ | ✅ | All four documented states (CLOCK, DISCONNECT, DISTURB, LOCK). |
| IMG_TIME | Digital time | ✅ | 🟡 | ✅ | hour/minute/second, `zero`, `space`, `align`, `follow`, unit, 12-hour AM/PM images ✅. One unit picture is sent for sc/en/tc. Faces that set the digits from a refresh function are now lifted into IMG_TIME on import. |
| TIME_POINTER | Analog clock | ✅ | ✅ | ✅ | Hour/minute/second hands and (new) `minute_cover_*` / `second_cover_*` next to the hour cover. |
| IMG_DATE | Date (month / day / year) | ✅ | 🟡 | ✅ | day, month and (new) year, `follow`, unit, `is_character` for month names ✅. `is_character` for **day** (31 pictures) is not offered; a year is drawn as two digits (Maker preview) — unverified on a watch. |
| IMG_WEEK | Weekday | ✅ | ✅ | ✅ | Same set is sent for en/sc/tc. |
| DATE_POINTER | Date pointer (dial) | ✅ | ✅ | ✅ | (new) `scale_*`, `center_x/y`, `src`, `posX/posY`, `cover_*`, `start_angle/end_angle`, `type` MONTH / DAY / WEEK. The preview turns the pointer with the sample date. Unverified on a watch (the `hmUI.date` constants are read from the legacy global when present). |
| IMG_CLICK | Tap shortcut icon | ✅ | ✅ | ✅ | `type` from the click-only data types. |
| GRADKIENT_POLYLINE | Line chart (heart / sleep) | ✅ | ✅ | 🟡 | (new) the firmware-drawn chart (`x, y, w, h, type` HEART or SLEEP). A chart the face draws itself with `addLine` / `addPoint` is not kept — it is listed in the import report. Wrapped in try/catch on export. |
| DELEGATE (`WIDGET_DELEGATE`) | — | — | 🟡 | 🟡 | Used internally (AM/PM refresh). `resume_call` / `pause_call` are not exposed as user code; imported ones are reported as “not a layer”. |

### Widgets Dialcraft uses that are not on the widget pages

GROUP (sleep chart), TEXT_FONT (reading as text), BAR (FILL_RECT + sensor updater),
WIDGET_DELEGATE and the edit widgets below come from the newer API / real Maker faces.

## Data types (`hmUI.data_type`)

- All **48** documented values exist in the editor: ✅ (plus Dialcraft's own TIME / DATE / WEEK /
  MOON_RISE / MOON_SET / WEATHER helpers, which are not in the docs list).
- The nine click-only values (MOON, OUTDOOR_RUNNING, WALKING, OUTDOOR_CYCLING, FREE_TRAINING,
  POOL_SWIMMING, OPEN_WATER_SWIMMING, PHN, BREATH_TRAIN) are offered for IMG_CLICK only ✅.
- Bound natively (no code): every widget that takes `type` — TEXT_IMG, IMG_LEVEL, IMG_POINTER,
  IMG_PROGRESS, TEXT ✅.
- 🟡 **Sensor readers** (needed where the watch does not bind the type for us: ARC_PROGRESS,
  BAR): 17 of 48 — STEP, STEP_TARGET, CAL, CAL_TARGET, DISTANCE, STAND, STAND_TARGET, ALTIMETER,
  ALTITUDE, FAT_BURNING, FAT_BURNING_TARGET, HEART, SPO2, STRESS, PAI_DAILY, PAI_WEEKLY, BATTERY.
  The rest (weather, UVI, AQI, wind, sleep, moon, …) have no reader for those two layers.

## Editable watchface (`edit_watchface`)

| Widget | Status | Notes |
|---|---|---|
| WATCHFACE_EDIT_GROUP | ✅ | Complication slot: `edit_id`, size, `default_type`, `optional_types` (+ previews), `count`, `select_list`, `tips_*`, choice layers per type. **Confirmed working on a watch** after the `show_level` fix. `select_list` text sizes are fixed values (not editable in the UI). |
| WATCHFACE_EDIT_MASK / FG_MASK | ✅ | Exported as mask widgets (an IMG with ONLY_EDIT leaks into the normal face — verified on a watch). |
| **WATCHFACE_EDIT_BG** | ❌ | Editable background (`bg_config`, `default_id`, `fg`, tips). Backgrounds are done with the variants + tap-zone mechanism instead. |
| **WATCHFACE_EDIT_POINTER** | ❌ | Editable hands (`config`, `CURRENT_CONFIG`). |
| Custom edit types (0x186a0+) | ❌ | Need `title_sc/tc/en`. |
| `show_level` ONLY_NORMAL / ONLY_AOD / ONLY_EDIT | ✅ | A layer in both normal and AOD is written as two widgets. |

## app.json (`module.watchface`)

`path` ✅ · `main` ✅ · `editable` ✅ (1 when a slot exists) · `lockscreen` ✅ (1 when the face has AOD
layers) · **`photoscreen` ❌** (photo watchface) · `hightCost` (not in the docs page, used by Maker).

## Not covered by this report

Sensors and system APIs outside `hmUI` widgets (heart-rate zones, worlds clocks, alarms API
beyond the data types), tap-to-open screens beyond the three listed in the Tap zone
(ScheduleCal, SportList, PowerSaveHint, …), and anything in the Zepp OS app / mini-program API.

## Done in the follow-up

DATE_POINTER, GRADKIENT_POLYLINE, TEXT `text_style`, TIME_POINTER minute / second caps, TEXT_IMG
imperial units + fixed text + invalid image, IMG_ANIM `display_on_restart` / `default_frame_index`,
BUTTON as a visible button, IMG_PROGRESS irregular positions. Each has a smoke test (import → export →
syntax check); none has been run on a watch.

## Still open

1. **WATCHFACE_EDIT_BG / EDIT_POINTER** and custom edit types — large, and the docs show no read-back
   for the background; needs a watch to settle.
2. **IMG_ANIM runtime control** (`ANIM_STATUS`, `anim_complete_call`) and exposing DELEGATE
   `resume_call` / `pause_call` — need a place for user code in the design.
3. More **sensor readers** so ARC_PROGRESS / BAR follow weather, UVI, AQI, wind, sleep (the sensor
   class names and methods are not in the widget docs).
4. `photoscreen` in app.json, `is_character` for the day (31 pictures), a unit picture per language.
