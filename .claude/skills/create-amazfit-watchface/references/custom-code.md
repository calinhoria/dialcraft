# Custom code (animation, timers, games) and testing on a real watch

Use it only for what the designer cannot express: a fill that follows the seconds, a game, a custom timer. Design the layers
with the recipe as usual; give the ones the code must reach a **handle**; put the logic in `userCode`.

## Recipe keys

```json
{
  "userImports": "import { Time as DCTime } from '@zos/sensor'",
  "userCode": "{ … }",
  "optimizePng": 16,
  "open": "path/to/a/saved/project",
  "steps": [ { "edit": "Animation", "set": { "handle": "anim", "repeat": 0 } } ]
}
```

- `userImports` — lines placed with the other `import`s at the top of `watchface/<target>/index.js`.
- `userCode` — a block run at the end of `initView()`, after every layer exists. Wrap it in `{ … }` so its names cannot clash with
  the generated ones (`W`, `F`, `pxv`, `variant_*`, …). No `return`, no top-level `import`.
- A layer's `handle` (set it with `set`) makes its widget `W.<handle>`; a layer with several pictures also gives `F.<handle>`
  (the picture paths). `W` and `F` are reserved. `previewOnly: true` draws a layer in the editor but leaves it out of the export.
- `open` starts from a saved Dialcraft project instead of a blank one (it is read, never written back), so overrides such as a new
  `userCode` can be tried without touching the file the app has open. `out` then writes somewhere else.
- `optimizePng: N` (2–256) reduces every animation frame, and every picture of an Image layer with several, to N colours at export
  (libimagequant, then oxipng, both WebAssembly, so it is the same on every platform). Everything else is only recompressed
  losslessly. The saved project keeps the full-colour originals; only the export is small. A frame of about 10–20 KB at 16 colours is normal.

> Animation made of sprites, a toolkit and a capture tool that runs the code headlessly: [animated-faces.md](animated-faces.md).

## What is true on a real watch (Bip 6, API 4.x, checked over bridge logs)

- `px()` is a **build-time macro**: `px(300)` works, `px(y)` with a variable throws "not a function". Use `pxv(y)` in user code
  (Dialcraft defines it before the user block).
- There is no global `timer` and no `hmUI`. `setInterval`, `setTimeout`, `clearInterval` and `Date.now()` exist. Use `ui`.
- An `IMG` is drawn at its own pixel size and **clipped** to its box: `w` / `h` in `MORE` never stretch it (a growing bar is a full-length
  sprite with a changing box width).
- `IMG_ANIM`: `setProperty(ui.prop.MORE, {x, y})` is accepted but **does not move it**; `setProperty(ui.prop.Y, v)` does, and
  `getProperty(ui.prop.Y)` reads it back. `MORE` works on a plain `IMG` and on a `GROUP`.
- `Time` from `@zos/sensor` counts whole seconds. For smooth motion keep the time since the second last changed (`Date.now()`
  differences) and add it as the fraction. About 1 px at ~7 updates a second fills a 450 px screen over a minute.
- Fall back when a source fails (`try { clock.getSeconds() } catch … new Date().getSeconds()`): a missing import once froze the
  fill at empty because the error was swallowed.
- Stop timers on `WIDGET_DELEGATE` `pause_call`, start on `resume_call` (screen off / on).

## Look before the watch

The editor's **▶ Run code** button (above the preview) runs the code against a stand-in for the watch API: `W.<handle>` is the layer,
`setProperty` with X / Y / W / H / ALPHA / SRC / VISIBLE / TEXT / MORE moves or swaps it, timers are real, `Time` reads the
computer clock, `console.log` goes to the status bar. Stop restores every layer. Pictures the code makes itself with `ui.createWidget(ui.widget.IMG, { x, y, src })` are drawn as temporary layers on top (and removed by `ui.deleteWidget`), and layers marked *Preview only* are hidden while it runs, so a game's tiles and sprites show up and the still under them does not. It cannot know what the firmware accepts
(it moves an animation with `MORE`, the watch does not), so confirm on the watch.

## Test on the watch with logs (developer bridge)

`zeus status` must say logged in; the Zepp app on the phone must have **Developer Mode → + → Bridge** on. `zeus bridge` is an
interactive shell (`connect`, `install`, `uninstall`), run from the exported project folder. It prints the watch's `console.log`,
which is the fastest way to find out what actually happens: log `typeof` of things, call each API inside its own try/catch and
log the message, read values back with `getProperty`.

[examples/bridge-drive.py](../examples/bridge-drive.py) drives it through a pty so it can run unattended:

```bash
python3 examples/bridge-drive.py <exported project folder> bridge.log "connect@8" "install@25" "@90"
```

Each argument is text to send and the seconds to listen afterwards; an empty text presses Enter (the device prompt: the first
choice is the right Bip 6). Then filter the log, e.g. `grep "\[mytag\]" bridge.log`. Notes:

- Install replaces an installed face with the same app id; there is no need to uninstall first.
- A build plus install takes about a minute; wait for `Install watchface result: success`.
- Never leave debug text on the face you hand over: set `DEBUG = false` and remove on-screen status widgets.
