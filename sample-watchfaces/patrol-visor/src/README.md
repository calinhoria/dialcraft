# Patrol Visor: sources

The art in `art/` was generated in Gemini (Nano Banana) from written prompts: one scene, one 0-9 + colon digit sheet, its glitched edit, and one props sheet. All the sheets use a green #00FF00 background.

The scripts expect a working folder with `images/1.png` … `images/4.png` (the scene, digits, props and glitch sheets, in that order) and these scripts in `<work>/scratchpad/robo/`. Run them from `<work>`:

1. `python3 scratchpad/robo/scene.py`: blacks out the white corners and scales the scene to 390×450.
2. `python3 scratchpad/robo/cut.py`: keys out the green (colour unmixing, so the glow stays red) and cuts the digits, registering each glitch digit on its base digit, plus the reticles, beam, LEDs and icons.
3. `python3 scratchpad/robo/gen.py`: builds every picture and writes `recipe.json`. `build.js` is the editor-side layout; `code.js` is the watch code.

Then run `env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js <recipe.json>` from the repo root.
