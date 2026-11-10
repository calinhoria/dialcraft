# Asset prompts to paste into an external image tool (Gemini / Nano Banana …)

Use this when the owner chose **external** assets (house rule *Ask how the art assets are made*). Fill the `<…>` parts from the brief,
print each prompt in its own code block so it can be pasted as is, say which reference image to attach, and say what the image will be used for.
All of these were used on real faces and worked.

## Always true
- **Still images only.** Never write animation, frames, sequence, video or "plays": the app offers a paid video instead of the picture.
  Ask for "a sheet of separate illustrations".
- **Chroma key:** magenta `#FF00FF`, or green `#00FF00` when the art is pink / magenta (neon). One flat colour, **no cell panels, borders,
  grid lines or text**. If the tool adds panels: "same image, the whole background one single flat colour, no panels".
- **Style:** attach the owner's reference image and say "use it as the STYLE reference only" (and "COLOUR reference" for water / glow pieces).
- **Layouts that can be cut out:** grids with the same cell size, the drawing centred and not touching the cell edges. Ten digits are always
  **4 + 4 + 2** (0 1 2 3 / 4 5 6 7 / 8 9). Ask for ≤ 9 drawings per image; if the tool breaks the layout, ask for 0-4 and 5-9 in two images.
- **Ask for the file paths** (or the image pasted on its own); a picture is not usable until it is saved on disk.
- Count the images before asking and combine small items in one sheet.

## 1. Scene (background)
```
Use the attached image as the STYLE reference only: <style words: flat bold paint-by-numbers / hand-painted vector, saturated colours, crisp shapes, no photo texture>.
Create a portrait image, 3:4 ratio, of <scene>. Keep the <upper-left / top / centre> area calm and mostly empty (<what is there>), because the clock goes there.
No text, no letters, no numbers, no logos, no people, nothing that will move (no <birds / cars / drops / blades>: I add those separately).
```
Moving parts are removed from the scene on purpose (windmill without sails, basin without the drop, street without cars and rain).

## 2. Digits 0-9 (any material: cloud, water, neon tube …)
```
Use the attached image as the STYLE reference. ONE still image: the digits 0 1 2 3 4 5 6 7 8 9 as ten separate illustrations in a 4 x 3 grid
(0-3, 4-6, 7-9), each digit made of <material and look: fluffy white cloud with pale blue shading / clear turquoise water with white highlights / glowing pink neon tube>.
Fat rounded strokes, all digits the same height, clearly readable, with the holes in 0, 4, 6, 8, 9 open. Plain flat <magenta #FF00FF / green #00FF00>
background everywhere, one flat colour, no cell panels, borders or text.
```

## 3. Digit state variants (glitch, sliced, colour split, damaged, wet …)
Attach the finished digit sheet. One image per state, the same sheet edited:
```
Edit the attached image. Keep EVERYTHING the same: the same ten digits 0 to 9, the same layout (4 + 4 + 2), the same position and size of every digit,
the same style, the same flat <colour> background. The only change: <state: every digit is cut into 3 or 4 horizontal strips shifted sideways by different amounts / a red copy shifted left and a cyan copy shifted right / half the tube dim with a broken gap and small pixel-noise blocks on and next to the digit>.
Every digit must stay readable as its own number. Do not add or remove digits, no text, no panels.
```

## 4. Colon (or any single symbol)
```
Edit the attached image. ONE new image on the same flat <colour> background: a colon ":" made of two round dots, one above the other, in the same style, size and glow as the digits. Alone and centred. No text, no panels.
```

## 5. Props sheet (vehicles, characters of a scene, objects)
```
Same style. ONE still image, 3 x 3 grid of separate illustrations on a plain flat <colour> background (no panels or text): <list the cells, e.g. cells 1-4 a hover-car seen from the side facing right in 4 colours; cells 5-6 a drone in 2 poses (eye on, eye off); cells 7-9 three different sets of thin diagonal streaks>.
```
Facing direction: vehicles and creatures **facing right** (I flip when needed). Poses of the same object in one row.

## 6. Effect sheets (splash, drop, ripples, gust, sparks, smoke …) 
Name the exact stages and the **same colour as the scene** (attach the scene). Examples that worked:
```
Use the attached scene as the reference for BOTH style and colour (<exact water colour words, e.g. soft pale turquoise, light aqua with white highlights, no dark outlines, no saturated cyan>).
ONE still image, 3 x 2 grid of 6 separate illustrations of a water splash from one drop: 1 a tiny upward spike, 2 a narrow column with 2 droplets, 3 a small crown with 5 points,
4 the widest crown with droplets flying out, 5 the crown collapsing with droplets falling back, 6 only a low soft ripple bump. Plain flat <colour> background, no panels, borders or text.
```
```
Same style and colour. ONE image, 3 x 3 grid: cells 1-3 a water bead hanging from a leaf tip in 3 sizes; cell 4 a falling teardrop; cells 5-9 top-down ripples (wide thin ellipses about 3:1) in 5 stages from a tiny ring to a very wide faint ring, thin light lines only. Flat <colour> background, no panels or text.
```
```
Same style. ONE still image, 4 x 2 grid of 8 separate small illustrations of a wind-swept cloud: a puff streaming to the right with curling tendrils and thin speed streaks, in 8 stages from a small tight puff, to the largest swirl torn into wisps, to a few tiny wisps. Flat <colour> background, no panels, borders or text.
```
(the word "wind-swept" is fine; "blowing / animation" is what triggers the video offer.)

## 7. Signs, panels, billboards
```
Same style. ONE image, 2 x 2 grid on a flat <colour> background (no panels or text): a tall rectangular neon billboard (height about twice its width) in 4 states: 1 glowing gradient panel with scanlines, 2 the same brighter, 3 with dark horizontal glitch bars, 4 nearly dark with faint specks. No letters, numbers or logos.
```

## After the files arrive
Look at each image first. Check the count of drawings, the layout, and the colour against the scene. Then cut them out with the kit's pattern: key the
chroma colour (soft alpha, remove the colour fringe), label the blobs on a downscaled mask, assign them to cells by position, and register variants
of the same digit on the base digit's crop box so they overlay exactly. Report what was used and what is still missing.
