# Layer kinds (the `add` value) and their default properties

Properties are set with `patch` when adding, or with `set` when editing. Every layer also has `x`, `y`, `name`, `show` (`normal` | `aod` | `both` | `edit`), `alpha` (0–255), `visible`, `locked`.

| kind | label | group | defaults |
|---|---|---|---|
| `IMG` | Image | Image | `{"w":0,"h":0,"angle":0,"posX":0,"posY":0}` |
| `IMG_ANIM` | Animation | Image | `{"frames":[],"fps":30,"repeat":0,"step":1,"animPrefix":""}` |
| `IMG_LEVEL` | Image level (from data) | Image | `{"images":[],"w":100,"h":100,"dataType":"STEP","level":0}` |
| `IMG_PROGRESS` | Image progress bar | Image | `{"images":[],"dataType":"STEP","level":0,"spread":24}` |
| `IMG_POINTER` | Image pointer (dial) | Clock | `{"centerX":0,"centerY":0,"x":0,"y":0,"angle":0,"startAngle":0,"endAngle":360}` |
| `IMG_TIME` | Digital time | Time | `{"part":"hour","zero":0,"follow":0,"space":0,"images":[],"unit":"","am":"","pm":"","amX":0,"amY":0,"pmX":0,"pmY":0}` |
| `IMG_WEEK` | Weekday | Time | `{"images":[]}` |
| `IMG_DATE` | Date (month / day) | Time | `{"images":[],"part":"day","zero":0,"follow":0,"space":0,"unit":"","isCharacter":false}` |
| `DATE_POINTER` | Date pointer (dial) | Clock | `{"dateType":"WEEK","centerX":0,"centerY":0,"src":"","posX":0,"posY":0,"scale":"","scaleX":0,"scaleY":0,"cover":"","coverX":0,"coverY":0,"startAngle":0,"endAngle":180}` |
| `TIME_POINTER` | Analog clock | Clock | `{"centerX":0,"centerY":0,"hour":"","hourPivotX":0,"hourPivotY":0,"minute":"","minutePivotX":0,"minutePivotY":0,"second":"","secondPivotX":0,"secondPivotY":0,"cover":""}` |
| `TEXT_IMG` | Data reading (digit images) | Data | `{"dataType":"STEP","images":[],"hSpace":1,"alignH":"LEFT","unit":"","dot":"","negative":""}` |
| `TEXT` | Text | Data | `{"text":"MONDAY","color":"#ffffff","size":32,"alignH":"CENTER_H","alignV":"CENTER_V","lineSpace":0,"charSpace":0,"fontFile":"","weight":400,"fillType":"solid","color2":"#f0f","gradAngle":90,"cssGradient":"linear-gradient(90deg, #ffffff 0%, #7c3aed 100%)","outlineColor":"#000000","outlineWidth":2,"bold":false,"italic":false}` |
| `IMG_STATUS` | System status icon | Data | `{"status":"DISCONNECT"}` |
| `IMG_CLICK` | Tap shortcut icon | Data | `{"dataType":"OUTDOOR_RUNNING","w":40,"h":40}` |
| `BAR` | Progress bar (linear) | Shape | `{"length":100,"lineWidth":10,"rounded":false,"vertical":false,"inversion":false,"mirror":false,"color":"#84a6cd","dataType":"BATTERY","level":0}` |
| `SLEEP_CHART` | Sleep chart | Data | `{"w":215,"h":69,"colorDeep":"#708eae","colorLight":"#212c35","colorRem":"#8cb0d8","colorWake":"#44556b"}` |
| `POLYLINE` | Line chart (heart / sleep) | Data | `{"w":200,"h":80,"dataType":"HEART"}` |
| `EDIT_SLOT` | Complication slot | Data | `{"editId":1,"w":54,"h":29,"defaultType":"STEP","optionalTypes":[],"selectImage":"","unSelectImage":"","tipsBg":"","tipsX":0,"tipsY":0,"tipsWidth":0,"tipsMargin":10}` |
| `TAP` | Tap zone | Data | `{"w":100,"h":50,"action":"variant","appUrl":"","note":""}` |
| `FILL_RECT` | Filled rectangle | Shape | `{"w":100,"h":100,"color":"#101522","radius":0,"angle":0}` |
| `STROKE_RECT` | Stroked rectangle | Shape | `{"w":100,"h":100,"color":"#ffffff","radius":0,"lineWidth":4,"angle":0}` |
| `CIRCLE` | Circle | Shape | `{"centerX":0,"centerY":0,"radius":60,"color":"#ffffff","alpha":255}` |
| `ARC` | Arc | Shape | `{"w":200,"h":200,"radius":90,"startAngle":-90,"endAngle":90,"lineWidth":12,"color":"#34e073"}` |
| `ARC_PROGRESS` | Arc progress | Shape | `{"centerX":0,"centerY":0,"radius":120,"startAngle":-90,"endAngle":270,"lineWidth":12,"color":"#34e073","dataType":"STEP","bg":"","level":0}` |

## Data types (`dataType` of readings, levels, arcs, text)

`TIME` (Time (HH:MM)), `DATE` (Date), `WEEK` (Weekday), `ALARM_CLOCK` (Alarm), `COUNT_DOWN` (Countdown (min/sec)), `STOP_WATCH` (Stopwatch (min/sec)), `SLEEP` (Sleep time), `SUN_CURRENT` (Time to sunrise/sunset), `SUN_RISE` (Sunrise), `SUN_SET` (Sunset), `STEP` (Steps), `STEP_TARGET` (Step target), `CAL` (Calories), `CAL_TARGET` (Calorie target), `DISTANCE` (Distance), `STAND` (Stand (hours)), `STAND_TARGET` (Stand target), `FLOOR` (Floors climbed), `ALTIMETER` (Air pressure), `ALTITUDE` (Altitude), `FAT_BURNING` (Fat burning (min)), `FAT_BURNING_TARGET` (Fat burning target), `MONTH_RUN_TIMES` (Month run times), `MONTH_RUN_DISTANCE` (Month run distance), `TRAINING_LOAD` (Training load), `VO2MAX` (VO2 max), `RECOVERY_TIME` (Recovery time), `READINESS` (Readiness), `HEART` (Heart rate), `SPO2` (Blood oxygen), `STRESS` (Stress), `PAI_DAILY` (PAI today), `PAI_WEEKLY` (PAI weekly), `WEATHER_CURRENT` (Temperature (current)), `MOON_RISE` (Moonrise time), `MOON_SET` (Moonset time), `WEATHER_LOW` (Temperature (low)), `WEATHER_HIGH` (Temperature (high)), `HUMIDITY` (Humidity), `UVI` (UV index), `AQI` (Air quality (mainland CN)), `WIND` (Wind force level), `WEATHER` (Weather icon), `BATTERY` (Battery)
