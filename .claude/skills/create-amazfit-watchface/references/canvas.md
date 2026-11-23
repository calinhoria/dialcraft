# CANVAS on the Bip 6: what works and how fast

Measured on a real Amazfit Bip 6 (390×450, API 4.x) over `zeus bridge`, 22 Nov 2026. "fps" = whole frames per second on the
watch. Never promise an fps that wasn't measured on the watch: probe first, or say "not measured".

## Works
- `ui.widget.CANVAS`, at most **4 per face** (the 5th createWidget throws). userCode runs after all layers, so hands and ticks
  that must sit above a canvas are created again in code.
- Filled and outlined shapes: drawRect, drawCircle({center_x, center_y, radius, color}), drawPoly, drawLine (setPaint
  {color, line_width}), stroke*. Edges are antialiased.
- `drawImage({x, y, w, h, image})` pastes a picture and **scales** it to w×h (up and down).
- The canvas keeps its pixels while the screen is off. `clear()` makes a transparent hole.
- Moving or resizing the canvas widget (setProperty X / Y / W): 0.3 ms, runs at screen rate (~62 fps).
- Taps: `addEventListener(ui.event.CLICK_DOWN / CLICK_UP, (i) => i.x, i.y)`.
- **Transparency: `canvas.setAlpha(0–255)`** (the widget method, API 2.1+) makes the whole canvas see-through and it blends
  with what is below (measured: yellow under a setAlpha 150 pink showed orange). Stack up to 4 full-screen canvases as opacity
  layers, each `clear()`ed to transparent: 3 layers × 8 moving shapes, all redrawn every frame = **24 fps**. Shapes on the same
  canvas still cover each other; the opacity is per layer.

## Doesn't work (accepted, no effect)
- ANGLE, ALPHA, prop.ANIM on a canvas; `transform()`; `drawFill()`; `snapshot()` (returns true, no file).
- No reading back pixels (no get / copy / mask): a p5-style "copy a wedge and paste it rotated" kaleidoscope can't run as
  written. Compute it instead: draw every shape turned / mirrored into each slice (see the pattern below).
- ARGB colours (0x80ff0000) and `setProperty(ui.prop.ALPHA, …)` draw opaque: use `setAlpha()` instead (above). No subpixel:
  coordinates snap to whole pixels.
- drawImage can't rotate or flip (negative w / h draws upright). A turned or mirrored picture must be pre-made.

## Frame rates, full-screen redraw every frame
| drawn each frame | fps |
|---|---|
| black background only | 59 (≈17 ms floor) |
| + 48 rects 35×35 | 25 |
| + 48 circles | 21–22 |
| + 48 thick lines (w20) | 19 |
| + 48 rings (stroked circles) | 17 |
| + 48 triangles | 15 |
| + 48 hexagons | 10 |
| + 48 squares as drawPoly | 6 |
| shape kaleidoscope, ~30 clipped polys / lines | 11–14 |
| p5-port kaleidoscope: 20 circles + 20 thick lines (setPaint each) + bg, turning | 16–17 |
| 3 canvas layers (setAlpha 255 / 150 / 80), each clear() + 8 shapes | 24 |
| photo kaleidoscope: 24 drawImage of 24 different pictures, scaled, switched as it turns | **2** |

- **Outline shapes stutter in animation** (strokePoly / strokeCircle, seen on the watch in a 4-layer kaleidoscope): animate filled
  shapes only.
- Shape type matters, size barely does. Squares and rotated rects: a thick drawLine (width = side), not drawPoly.
- Building new `{x, y}` objects every call doubles the cost (0.77 ms vs 0.35 pooled): make parameter objects once, change
  their fields.
- One picture pasted repeatedly ≈ 3 ms per paste. Many different scaled pictures per frame collapse to 2 fps (which part
  costs most is not measured): don't animate photos on a canvas.
- Budget: 59 fps minus ~1 ms per shape in a real face (maths + setPaint included): 40 circles / thick lines = 16–17 fps
  (measured; the 20 fps estimate from the probe numbers was too high).

## Timers and sleep
- setInterval(16) gives 62/s, setTimeout(0) ~830/s. Date.now() doesn't advance inside a busy loop; drive motion from
  elapsed time, not from a frame counter, so the speed doesn't depend on fps.
- Timers and sensors stop while the screen is off; WIDGET_DELEGATE `resume_call` fires on wake (and once at start).
- **Switching faces pauses and resumes the new face right after it loads** (found Nov 2026: the animation never started). A `pause_call`
  that stops the loop followed by a `resume_call` that is ignored as "the resume at load" leaves the face frozen. Ignore a pause in the
  first ~1.5 s after the face starts (`if (Date.now() - startedAt < 1500) return` in `onPause`), as well as the resume.

## Compared with native pictures (IMG widgets, no canvas)
- 1 full-screen IMG swapping its picture (MORE {src}): 44 fps. 8 rotated wedge IMGs swapping: 24 fps (rotation via
  `angle` + center is free; give the IMG a full-screen box or it's clipped).
- Storage ~1 byte per pixel on the watch (full screen ≈ 181 KB).

## Pattern: kaleidoscope computed on the canvas
`sample-watchfaces/kaleidoscope-analog/kaleido.js` (a port of a p5 sketch): N shapes move inside one wedge (angle
W = 360°/SEG, position in polar r, φ); slice k draws each shape at angle `spin + k·W + φ`, odd slices mirrored
(`spin + (k+1)·W − φ`, and a rod's tilt negated). Circles → drawCircle, rects → thick drawLine, pooled parameters, the
whole thing turned by adding `spin`. The same engine runs in Node (ops.js → paint.py) for the preview and the store GIF.
