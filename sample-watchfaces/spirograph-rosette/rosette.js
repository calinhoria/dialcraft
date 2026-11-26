// Shared geometry for the Zepp canvas and the Dialcraft still.
const ART = { x: 25, y: 53, w: 344, h: 278, rx: 159, ry: 134 };
const PALETTE = [0xc8f000, 0x47e6ff, 0xff70bb, 0xffb84f, 0xad92ff];
const INK = 0xf4f3ee;
const DEFAULT_MODEL = {
  ring: 12,
  wheel: 7,
  pen: 3.15,
  penSpread: 0.55,
  phaseSpread: 0.17,
  reachFalloff: 0.13,
  twist: 0,
};
const TAU = Math.PI * 2;
const GEARS = [[8, 5], [10, 7], [12, 7], [14, 9], [16, 9]];
const STRANDS = 15;

function generateModel(previous, random) {
  const index = GEARS.findIndex((pair) => pair[0] === previous.ring);
  const step = 1 + Math.floor(random() * (GEARS.length - 1));
  const pair = GEARS[(index + step) % GEARS.length];
  const gap = pair[0] - pair[1];
  return {
    ring: pair[0],
    wheel: pair[1],
    pen: gap * (0.59 + random() * 0.09),
    penSpread: gap * (0.05 + random() * 0.06),
    phaseSpread: TAU / pair[0] * (0.26 + random() * 0.10),
    reachFalloff: 0.09 + random() * 0.06,
    twist: (random() - 0.5) * 0.25,
  };
}

function makeRosette(model) {
  const paths = [];
  const gap = model.ring - model.wheel;
  const frequency = gap / model.wheel;
  const interval = TAU * model.wheel / model.ring;
  const cx = ART.w / 2;
  const cy = ART.h / 2;
  const samples = 76;
  let inner = 0;

  // Split each rolling-wheel curve at its radial minima. With an even ring
  // and an odd coprime wheel, alternating sections also alternate around
  // the face. Paint the white family first and use the accent at crossings.
  for (const accent of [false, true]) {
    for (let strand = 0; strand < STRANDS; strand++) {
      const phase = 2 * strand / (STRANDS - 1) - 1;
      const offset = phase * phase;
      const d = model.pen - model.penSpread * offset;
      const scale = (1 - model.reachFalloff * offset) / (gap + d);
      const rotation = -Math.PI / 2 + model.twist + model.phaseSpread * phase;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      inner = Math.max(inner, (gap - d) * scale);

      for (let lobe = accent ? 0 : 1; lobe < model.ring; lobe += 2) {
        const data = [];
        for (let i = 0; i <= samples; i++) {
          const t = interval * (lobe + i / samples - 0.5);
          const x = gap * Math.cos(t) + d * Math.cos(frequency * t);
          const y = gap * Math.sin(t) - d * Math.sin(frequency * t);
          data.push({
            x: Math.round(cx + ART.rx * scale * (x * cos - y * sin)),
            y: Math.round(cy + ART.ry * scale * (x * sin + y * cos)),
          });
        }
        paths.push({ accent, data });
      }
    }
  }

  // Closing a section for strokePoly adds a short chord across the hole.
  // The tiny clearance also covers the rounded endpoints of that chord.
  return { paths, hole: { x: Math.ceil(ART.rx * inner) + 1, y: Math.ceil(ART.ry * inner) + 1 } };
}
