# Bundled fonts (SIL Open Font License 1.1)

Digit-friendly faces for watch numbers. Google Fonts TTFs come from the
fontsource CDN, DSEG from the `dseg` npm package (the DSEG repo ships no
prebuilt TTFs), Handjet from the google/fonts repo (variable-only).

`node tools/fontcheck.js` verifies every file is a real TTF and carries 0-9
(a missing digit would silently generate blank glyph images). All 33 files pass.

## Clean digital
- Orbitron Bold — `Orbitron-Bold.ttf` — geometric, techy
- Rajdhani SemiBold — `Rajdhani-SemiBold.ttf` — squared, condensed
- Exo 2 SemiBold — `Exo2-SemiBold.ttf` — sleek, slightly futuristic
- Space Grotesk Medium — `SpaceGrotesk-Medium.ttf` — modern, quirky numerals
- Saira Condensed SemiBold — `SairaCondensed-SemiBold.ttf` — narrow, small-size legible

## Retro LCD / terminal
- DSEG7 Classic Bold — `DSEG7Classic-Bold.ttf` — true 7-segment display
- DSEG14 Classic Bold — `DSEG14Classic-Bold.ttf` — 14-segment (letters too)
- VT323 Regular — `VT323-Regular.ttf` — terminal / LCD
- Share Tech Mono Regular — `ShareTechMono-Regular.ttf` — monospaced digital
- Major Mono Display Regular — `MajorMonoDisplay-Regular.ttf` — stylised mono
- Press Start 2P Regular — `PressStart2P-Regular.ttf` — 8-bit pixel
- Silkscreen Regular — `Silkscreen-Regular.ttf` — pixel LCD

## Segmented / dot matrix
- Doto Black — `Doto-Black.ttf` — dot matrix
- Handjet Bold — `Handjet-Bold.ttf` — element grid/shape axes; rendered with
  `wght 700, ELGR 1, ELSH 6` via `FONT_VARIATIONS` in `renderer.js`

## Bold sporty
- Bebas Neue Regular — `BebasNeue-Regular.ttf`
- Oswald SemiBold — `Oswald-SemiBold.ttf`
- Anton Regular — `Anton-Regular.ttf`
- Barlow Condensed SemiBold — `BarlowCondensed-SemiBold.ttf`
- Teko SemiBold — `Teko-SemiBold.ttf`

## Elegant / classic
- Cormorant Garamond SemiBold — `CormorantGaramond-SemiBold.ttf`
- Playfair Display SemiBold — `PlayfairDisplay-SemiBold.ttf`
- Cinzel SemiBold — `Cinzel-SemiBold.ttf` (Roman-numeral dials)
- Marcellus Regular — `Marcellus-Regular.ttf`

## Minimal / thin
- Inter Bold — `Inter-Bold.ttf`
- Inter Thin — `Inter-Thin.ttf` (a separate family, one file per family)
- Montserrat Bold — `Montserrat-Bold.ttf`
- Montserrat Thin — `Montserrat-Thin.ttf`
- Poppins Regular — `Poppins-Regular.ttf`
- Josefin Sans SemiBold — `JosefinSans-SemiBold.ttf`

## General
- Roboto Condensed Bold — `RobotoCondensed-Bold.ttf`
- Roboto Mono Bold — `RobotoMono-Bold.ttf`
- Open Sans Bold — `OpenSans-Bold.ttf`
- Lato Bold — `Lato-Bold.ttf`

All SIL OFL 1.1 (https://openfontlicense.org). One weight per family — the
editor's faux-bold toggle covers the rest. Custom .ttf/.otf/.woff fonts can be
imported at runtime from the Font picker.

Not bundled: dafont's "Seven Segment" is *free for personal use* (commercial
licence $5), so it cannot ship in a distributed build; DSEG7/DSEG14 above are
the open-licensed equivalent.
