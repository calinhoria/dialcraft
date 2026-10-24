// ---- face 7: Bon fiscal ----
const SLUG = 'f07'; FONT = 'Courier Prime';
const PAPER = '#f4efe2', INK = '#1d1b17', BGC = '#0c0c0e', PX = 60, PW = 270, SLOT_Y = 404, TOP_Y = 56;
const LINES = [['c', 'CEASUL TĂU S.R.L.', 18], ['c', '', 56], ['c', '', 13], ['d'], ['r', 'PAȘI'], ['r', 'PULS (bpm)'], ['r', 'BATERIE'], ['r', 'TEMPERATURĂ'], ['d'], ['c', 'MULȚUMIM! REVINO MÂINE', 12], ['bar']];
const paperH = () => { let h = 30; for (const l of LINES) h += l[0] === 'c' ? l[2] * 1.45 : l[0] === 'd' ? 14 : l[0] === 'bar' ? 34 : 22; return Math.ceil(h + 24); };
const PH_ = paperH(), PT = SLOT_Y - PH_;
// scene: dark, the printed receipt (labels only) and the printer
const c = mkc(W, H), g = c.getContext('2d'); g.fillStyle = BGC; g.fillRect(0, 0, W, H);
g.fillStyle = PAPER; g.beginPath(); g.moveTo(PX, PT + 8); for (let x = 0; x <= PW; x += 10) g.lineTo(PX + x, PT + (x / 10 % 2 ? 0 : 8)); g.lineTo(PX + PW, PT + PH_ - 8); for (let x = PW; x >= 0; x -= 10) g.lineTo(PX + x, PT + ((x / 10) % 2 ? PH_ : PH_ - 8)); g.closePath(); g.fill();
g.fillStyle = 'rgba(0,0,0,0.04)'; g.fillRect(PX, PT, 14, PH_);
let y = 30; const Y = { time: 0, date: 0, rows: [] };
for (const l of LINES) {
  if (l[0] === 'c') { y += l[2]; if (l[1]) txt(g, l[1], PX + PW / 2, PT + y, l[2], INK); else if (l[2] === 56) Y.time = PT + y; else Y.date = PT + y; y += l[2] * 0.45; }
  else if (l[0] === 'd') { for (let x = 22; x < PW - 22; x += 9) line(g, PX + x, PT + y + 4, PX + x + 5, PT + y + 4, INK, 1.6); y += 14; }
  else if (l[0] === 'bar') { for (let x = 36; x < PW - 36; ) { const w = 1 + Math.floor(srand(x) * 4); g.fillStyle = INK; g.fillRect(PX + x, PT + y + 4, w, 24); x += w + 2 + Math.floor(srand(x + 9) * 3); } y += 34; }
  else { y += 17; txt(g, l[1], PX + 24, PT + y, 16, INK, { align: 'left' }); Y.rows.push(PT + y); y += 5; }
}
g.fillStyle = '#17171a'; g.fillRect(0, SLOT_Y, W, 70); g.fillStyle = '#0a0a0c'; rr(g, 40, SLOT_Y + 6, 310, 12, 5); g.fill(); g.fillStyle = '#26262b'; g.fillRect(0, SLOT_Y, W, 3);
for (let i = 0; i < 3; i++) circ(g, 60 + i * 16, SLOT_Y + 44, 4, i === 0 ? '#5fd37a' : '#3a3a40');
txt(g, '', CX, 42, 22, '#8a8678');
await scene(c, 'scene_f07');
// native values placed on the paper
park(['Hour', 'Colon', 'Minute', 'Weekday', 'Day', 'Steps', 'Heart rate', 'Battery', 'Temperature']);
await seqRow(['Hour', 'Colon', 'Minute'], PX + PW / 2, Y.time - 20, 2);
await dateRow(PX + PW / 2, Y.date - 5, 8);
const VN = ['Steps', 'Heart rate', 'Battery', 'Temperature'];
for (let i = 0; i < 4; i++) await align([VN[i]], { r: PX + PW - 24, cy: Y.rows[i] - 5.5 });
// the cover that the printer pulls back, and the print head line
const CVW = PW + 16, CVH = PH_ + 6;
await mkSlot('cover', 'Paper cover', [['s', (g) => { g.fillStyle = BGC; g.fillRect(0, 0, CVW, CVH); }]], CVW, CVH, PX - 8, PT - 6);
await mkSlot('head', 'Print head', [['s', (g) => { g.fillStyle = 'rgba(255,240,200,0.9)'; g.fillRect(0, 0, PW, 3); g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(0, 3, PW, 5); }]], PW, 8, PX, PT);
globalThis.__PT = PT; globalThis.__PH = PH_; globalThis.__PX = PX;
globalThis.__TOP = ['Paper cover', 'Print head'];
globalThis.__A = { font: 'Courier Prime', size: 96, color: '#75726a', row: [CX, 215, 6], col: true };
globalThis.__G = { Date: ['Weekday', 'Day'], Steps: ['Steps'], 'Heart rate': ['Heart rate'], Battery: ['Battery'], Temperature: ['Temperature'], Printer: ['Paper cover', 'Print head'] };
