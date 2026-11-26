# Solar Dial for Amazfit Bip 6

Open `project/Solar Dial.wfproj.json` in the workspace version of Dialcraft to edit the 390 × 450 face. Change the preview time and sunrise and sunset values in Test Data to see the solar track and sky respond. Install `solar-dial.zab` using the Zepp developer-mode workflow.

The marker makes one circuit every 24 hours, with local solar noon at the top. The sky and track distinguish daylight, the horizon, twilight, and night. The watch reads sunrise and sunset from Zepp weather and uses 06:00 and 18:00 when that data is unavailable. The three pairs of twilight markers estimate boundaries at 30, 60, and 90 minutes outside daylight. The digital clock remains independent of the solar track.

To regenerate the preview, editable project, and Zeus export from the repository root:

```sh
node sample-watchfaces/solar-dial/gen.js --build
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js sample-watchfaces/solar-dial/recipe.json
```

The editable project’s Inter font is under `project/fonts/`. The reference glyphs, cleaned dial plate, and sun sprite are under `art/`.

## Artwork

Built-in ImageGen edited the supplied mockup at its original framing. The model’s patches fill the areas behind the live elements. The surrounding dial is registered to the mockup.

> Return the standalone clean artwork plate for the 390 × 450 Solar Dial reference. Preserve the blue circular dial, tick marks, thin gold orbit, three blue waves, and gold light on the right. Erase the clock, date, gold sun disk, and both footer icons and readings. Restore the track where the sun was. Fill the case and corner reflections with black. Keep the exact framing and positions.
