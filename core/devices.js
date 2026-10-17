'use strict';
// Zepp OS device catalog.
//
// Source: https://docs.zepp.com/docs/reference/related-resources/device-list/
// (deviceSource ids, screen resolution, screen shape, corner radius, watchface
// preview resolution) plus the per-device API_LEVEL column.
//
//   shape   'r' round | 's' square (rounded rectangle) | 'b' band
//   radius  corner radius in device px (round screens: half the short side)
//   target  Zeus CLI target key == assets/<target>/ subdirectory name
//   sources deviceSource ids (hardware variants) for app.json `platforms`
//   st      app.json `platforms[].st` value ('r' | 's' | 'b')
//   sr      app.json `platforms[].sr` value ('w' + screen width)
//   preview watchface preview (thumbnail) resolution
//
// designWidth is always the screen width: coordinates in the generated code are
// written through px(), so a face authored at one width stays correct when the
// device list grows.
const DEVICES = [
  { target: 'balance-3', name: 'Amazfit Balance 3', shape: 'r', w: 480, h: 480, api: '4.4', preview: [324, 324], sources: [11141376, 11141377, 11141379], keys: 5 },
  { target: 'balance-ultra', name: 'Amazfit Balance Ultra', shape: 'r', w: 480, h: 480, api: '4.4', preview: [324, 324], sources: [11075840, 11075841], keys: 5 },
  { target: 'bip-max', name: 'Amazfit Bip Max', shape: 's', w: 432, h: 514, radius: 106, api: '4.4', preview: [294, 350], sources: [11206915], keys: 2 },
  { target: 'cheetah-2-ultra', name: 'Amazfit Cheetah 2 Ultra', shape: 'r', w: 480, h: 480, api: '4.3', preview: [324, 324], sources: [9961728, 9961729], keys: 4 },
  { target: 'cheetah-2-pro', name: 'Amazfit Cheetah 2 Pro', shape: 'r', w: 466, h: 466, api: '4.3', preview: [314, 314], sources: [11010304, 11010305, 11010307], keys: 4 },
  { target: 'active-3-premium', name: 'Amazfit Active 3 Premium', shape: 'r', w: 466, h: 466, api: '4.2', preview: [314, 314], sources: [10944768, 10944769, 10944771, 10948867], keys: 4 },
  { target: 'trex-ultra-2', name: 'Amazfit T-Rex Ultra 2', shape: 'r', w: 480, h: 480, api: '4.2', preview: [324, 324], sources: [10879232, 10879233, 10879235], keys: 4 },
  { target: 'active-max', name: 'Amazfit Active Max', shape: 'r', w: 480, h: 480, api: '4.2', preview: [324, 324], sources: [10813697, 10813699], keys: 2 },
  { target: 'trex-3-pro-44', name: 'Amazfit T-Rex 3 Pro (44mm)', shape: 'r', w: 466, h: 466, api: '4.2', preview: [314, 314], sources: [10682624, 10682625, 10682627], keys: 4 },
  { target: 'trex-3-pro-48', name: 'Amazfit T-Rex 3 Pro (48mm)', shape: 'r', w: 480, h: 480, api: '4.2', preview: [324, 324], sources: [10551552, 10551553, 10551555], keys: 4 },
  { target: 'active-2-square', name: 'Amazfit Active 2 (Square)', shape: 's', w: 390, h: 450, radius: 86, api: '4.2', preview: [266, 307], sources: [10223872, 10223873, 10223875], keys: 2, secondary: true },
  { target: 'balance-2', name: 'Amazfit Balance 2', shape: 'r', w: 480, h: 480, api: '4.2', preview: [324, 324], sources: [9568512, 9568513, 9568515], keys: 2, secondary: true },
  { target: 'bip-6', name: 'Amazfit Bip 6', shape: 's', w: 390, h: 450, radius: 86, api: '4.2', preview: [266, 307], sources: [9765120, 9765121, 10158337], keys: 2, secondary: true },
  { target: 'active-2', name: 'Amazfit Active 2 (Round)', shape: 'r', w: 466, h: 466, api: '4.2', preview: [314, 314], sources: [8913152, 8913153, 8913155, 8913159, 10092800, 10092801, 10092803, 10092807], keys: 2, secondary: true },
  { target: 'trex-3', name: 'Amazfit T-Rex 3', shape: 'r', w: 480, h: 480, api: '4.0', preview: [324, 324], sources: [8716544, 8716545, 8716547], keys: 4 },
  { target: 'bip-5-unity', name: 'Amazfit Bip 5 Unity', shape: 's', w: 320, h: 380, radius: 69, api: '3.0', preview: [200, 238], sources: [8782081, 8782088, 8782089], keys: 1, secondary: true },
  { target: 'active-edge', name: 'Amazfit Active Edge', shape: 'r', w: 360, h: 360, api: '3.5', preview: [243, 243], sources: [8388864, 8388865], keys: 4 },
  { target: 'active', name: 'Amazfit Active', shape: 's', w: 390, h: 450, radius: 86, api: '3.6', preview: [266, 307], sources: [8323328, 8323329], keys: 1, secondary: true },
  { target: 'balance', name: 'Amazfit Balance', shape: 'r', w: 480, h: 480, api: '3.7', preview: [324, 324], sources: [8519936, 8519937, 8519939], keys: 2, secondary: true },
  { target: 'cheetah-square', name: 'Amazfit Cheetah (Square)', shape: 's', w: 390, h: 450, radius: 86, api: '3.6', preview: [266, 307], sources: [8257793], keys: 3 },
  { target: 'bip-5', name: 'Amazfit Bip 5', shape: 's', w: 320, h: 380, radius: 69, api: '2.1', preview: [200, 238], sources: [8454400, 8454401], keys: 1, secondary: true },
  { target: 'cheetah-pro', name: 'Amazfit Cheetah Pro', shape: 'r', w: 480, h: 480, api: '3.6', preview: [324, 324], sources: [8126720, 8126721], keys: 2 },
  { target: 'cheetah-round', name: 'Amazfit Cheetah (Round)', shape: 'r', w: 454, h: 454, api: '3.6', preview: [306, 306], sources: [8192256, 8192257], keys: 2 },
  { target: 'trex-ultra', name: 'Amazfit T-Rex Ultra', shape: 'r', w: 454, h: 454, api: '3.6', preview: [306, 306], sources: [6553856, 6553857], keys: 4 },
  { target: 'gtr-mini', name: 'Amazfit GTR Mini', shape: 'r', w: 416, h: 416, api: '2.0', preview: [280, 280], sources: [250, 251], keys: 1, secondary: true },
  { target: 'gtr-4', name: 'Amazfit GTR 4', shape: 'r', w: 466, h: 466, api: '3.6', preview: [314, 314], sources: [7930112, 7930113, 7864577], keys: 2, secondary: true },
  { target: 'gts-4', name: 'Amazfit GTS 4', shape: 's', w: 390, h: 450, radius: 86, api: '3.6', preview: [266, 307], sources: [7995648, 7995649], keys: 1, secondary: true },
  { target: 'gts-4-mini', name: 'Amazfit GTS 4 mini', shape: 's', w: 336, h: 384, radius: 80, api: '1.0', preview: [228, 260], sources: [246, 247], keys: 1 },
  { target: 'falcon', name: 'Amazfit Falcon', shape: 'r', w: 416, h: 416, api: '3.6', preview: [280, 280], sources: [414, 415], keys: 4 },
  { target: 'band-7', name: 'Amazfit Band 7', shape: 'b', w: 194, h: 368, radius: 25, api: '1.0', preview: [152, 288], sources: [252, 253, 254], keys: 0 },
  { target: 'gtr-3-pro', name: 'Amazfit GTR 3 Pro', shape: 'r', w: 480, h: 480, api: '1.0', preview: [324, 324], sources: [229, 230, 242, 6095106], keys: 2 },
  { target: 'gtr-3', name: 'Amazfit GTR 3', shape: 'r', w: 454, h: 454, api: '1.0', preview: [306, 306], sources: [226, 227], keys: 2 },
  { target: 'gts-3', name: 'Amazfit GTS 3', shape: 's', w: 390, h: 450, radius: 86, api: '1.0', preview: [266, 307], sources: [224, 225], keys: 1 },
  { target: 'trex-2', name: 'Amazfit T-Rex 2', shape: 'r', w: 454, h: 454, api: '2.1', preview: [306, 306], sources: [418, 419], keys: 4 },
];

// radius in device px (round = half the short side, so masks are exact circles)
for (const d of DEVICES) {
  if (d.shape === 'r') d.radius = Math.min(d.w, d.h) / 2;
  if (d.radius == null) d.radius = 0;
  // assets/<target>/ — one folder per target, shared by every hardware variant
  // (same layout as the official config-version-v3 watchface template). A
  // "<target>.<st>" folder is *not* recognised by the build: zpm then copies no
  // assets into the device directory and the icon step fails the build.
  d.assetDir = d.target;
  d.sr = `w${d.w}`;
  d.designWidth = d.w;
}

// app.json `platforms` for one target.
//
// Every entry must carry an explicit `deviceSource` (the id from the official
// device list). Without it zpm expands the target into all of its hardware
// variants, skips the per-device asset copy, and then dies in the icon resize
// helper with a misleading error:
//
//   ENOENT: no such file or directory, lstat '…/device/assets/images/preview.png_origin'
//   build failed: zeus build exited with code 7
//
// (Reproduced with Zepp's own template too, so it is not specific to this app.)
function platformsFor(d) {
  const ids = Array.isArray(d.sources) && d.sources.length ? d.sources : [null];
  return ids.map((id) => (id == null ? { st: d.shape, sr: d.sr } : { st: d.shape, sr: d.sr, deviceSource: id }));
}

function deviceByKey(key) { return DEVICES.find((d) => d.target === key) || null; }
function deviceLabel(d) {
  const shape = d.shape === 'r' ? 'round' : d.shape === 's' ? 'square' : 'band';
  return `${d.name} · ${d.w}×${d.h} ${shape} · API ${d.api}`;
}
// Zeus target block for app.json
function targetBlock(d) {
  return {
    [d.target]: {
      module: { watchface: { path: `watchface/${d.target}/index`, main: 1, editable: 0, lockscreen: 0 } },
      platforms: platformsFor(d),
      designWidth: d.designWidth,
    },
  };
}

module.exports = { DEVICES, deviceByKey, deviceLabel, targetBlock, platformsFor };
