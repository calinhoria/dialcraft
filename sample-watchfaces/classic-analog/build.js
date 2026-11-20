// Classic analog: a black dial with 60 ticks and 12 numerals, white hour and minute hands (native, ticking only when the minute changes),
// and a red second hand that sweeps smoothly (the "Smooth second hand" preset). Always-on shows the hands and 12 dim ticks.
const CY = H / 2;
await document.fonts.load('500 40px InterMed');
const dial = (major_only, col_major, col_minor, nums) => {
  const c = mk(W, H), g = c.getContext('2d'); g.lineCap = 'round';
  for (let k = 0; k < 60; k++) {
    const mj = k % 5 === 0; if (major_only && !mj) continue;
    const a = rad(6 * k), r1 = 190, r0 = r1 - (mj ? 20 : 8);
    g.strokeStyle = mj ? col_major : col_minor; g.lineWidth = mj ? 4 : 1.6;
    g.beginPath(); g.moveTo(CX + r0 * Math.sin(a), CY - r0 * Math.cos(a)); g.lineTo(CX + r1 * Math.sin(a), CY - r1 * Math.cos(a)); g.stroke();
  }
  if (nums) {
    g.fillStyle = '#ffffff'; g.font = '500 38px InterMed'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (let n = 1; n <= 12; n++) {
      const a = rad(30 * n), r = 146, t = String(n), m = g.measureText(t);
      const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
      g.fillText(t, CX + r * Math.sin(a), CY - r * Math.cos(a) + (asc - desc) / 2);     // ink centred on the circle
    }
  }
  return c;
};
await addImg('classic/dial', dial(false, '#ffffff', '#6d6f73', true), 0, 0, 'Dial');
await addImg('classic/dial-aod', dial(true, '#8a8a8a', '#8a8a8a', false), 0, 0, 'Dial AOD', 'aod');
// hands: tapered, rounded, drawn upright with the pivot a little above the bottom (the tail)
const hand = (w, len, tail, col) => {
  const c = mk(w, len + tail + 4), g = c.getContext('2d'), x = w / 2, p = len + 2;
  g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2, p + tail - w / 2); g.lineTo(x - w * 0.32, 2 + w / 2); g.arc(x, 2 + w * 0.32, w * 0.32, Math.PI, 0); g.lineTo(x + w / 2, p + tail - w / 2);
  g.arc(x, p + tail - w / 2, w / 2, 0, Math.PI); g.closePath(); g.fill(); return c;
};
const HW = 16, MW = 11, HL = 105, ML = 160, TAIL = 22;
addProjectImage('hour_hand.png', hand(HW, HL, TAIL, '#ffffff'), { replace: true });
addProjectImage('minute_hand.png', hand(MW, ML, TAIL, '#ffffff'), { replace: true });
addProjectImage('second_hand.png', hand(4, 10, 4, '#e5484d'), { replace: true });   // placeholder, the native second hand is removed below
await applyPreset('analog');
const a = project.elements.find((x) => x.kind === 'TIME_POINTER');
a.name = 'Hour and minute hands'; a.second = ''; a.cover = ''; a.show = 'both';
Object.assign(a, { hourPivotX: HW / 2, hourPivotY: HL + 2, minutePivotX: MW / 2, minutePivotY: ML + 2 });
await applyPreset('smoothsec');
// a cap over the hour and minute hands' pivot is part of the second hand's picture (a red dot), so the order is: dial, hands, second hand
const order = ['Dial', 'Dial AOD', 'Hour and minute hands', 'Smooth second hand'];
const listed = order.map((n) => project.elements.find((x) => x.name === n)).filter(Boolean);
const bgl = project.elements.filter((x) => x.kind === 'FILL_RECT');
project.elements = bgl.concat(listed, project.elements.filter((x) => !listed.includes(x) && !bgl.includes(x)));
return project.elements.map((x) => x.name).join(', ');
