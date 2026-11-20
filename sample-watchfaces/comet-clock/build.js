
function STARS_CODE(n) { return `// <comet-stars>
// Background: each star fades in and out for ever (alpha animation, a different pace each); a shooting star crosses the top corner every ~20 s.
// They start and stop with the screen (the hooks of the smooth second hand block).
{
  const G = globalThis, N = ${n}, ids = [];
  const tw = (i) => { const w = W['st' + i]; if (!w) return; const d = 1400 + ((i * 7919) % 1900), lo = 30 + (i * 37) % 60;
    ids[i] = w.setProperty(ui.prop.ANIM, { anim_steps: [
      { anim_prop: ui.prop.ALPHA, anim_from: lo, anim_to: 255, anim_rate: 'easeinout', anim_duration: d, anim_offset: 0 },
      { anim_prop: ui.prop.ALPHA, anim_from: 255, anim_to: lo, anim_rate: 'easeinout', anim_duration: d, anim_offset: d } ], anim_fps: 10, anim_repeat: -1 }); };
  const shoot = () => { const w = W.shoot; if (!w) return;
    ids.shoot = w.setProperty(ui.prop.ANIM, { anim_steps: [
      { anim_prop: ui.prop.X, anim_from: 235, anim_to: 330, anim_rate: 'linear', anim_duration: 900, anim_offset: 0 },
      { anim_prop: ui.prop.Y, anim_from: 14, anim_to: 56, anim_rate: 'linear', anim_duration: 900, anim_offset: 0 },
      { anim_prop: ui.prop.ALPHA, anim_from: 0, anim_to: 255, anim_rate: 'easeout', anim_duration: 300, anim_offset: 0 },
      { anim_prop: ui.prop.ALPHA, anim_from: 255, anim_to: 0, anim_rate: 'easein', anim_duration: 600, anim_offset: 300 },
      { anim_prop: ui.prop.ALPHA, anim_from: 0, anim_to: 0, anim_rate: 'linear', anim_duration: 19000, anim_offset: 900 } ], anim_fps: 20, anim_repeat: -1 }); };
  const kill = (k) => { try { if (ids[k] != null && ui.anim_status) W[k === 'shoot' ? 'shoot' : 'st' + k].setProperty(ui.prop.ANIM_STATUS, { anim_id: ids[k], anim_status: ui.anim_status.STOP }); } catch (e) {} ids[k] = null; };
  const stop = () => { for (let i = 0; i < N; i++) kill(i); kill('shoot'); };
  const start = () => { stop(); for (let i = 0; i < N; i++) { try { tw(i); } catch (e) {} } try { shoot(); } catch (e) {} };
  (G.__ssHooks = G.__ssHooks || []).push({ start, stop });
  start();
}
// </comet-stars>`; }
// Comet clock: a black face with the time in big digits. A small bright dot with a fading tail (a comet) circles the digits once a minute:
// its place on the circle is the second. The comet is the "Smooth second hand" preset with its picture swapped for a comet.
const CY = H / 2;
await document.fonts.load('500 40px InterMed');
const ACC = [90, 176, 255], R = 178, SZ = 100;
// the faint track the comet runs on
{ const c = mk(W, H), g = c.getContext('2d'); g.strokeStyle = 'rgba(90,176,255,0.16)'; g.lineWidth = 2; g.beginPath(); g.arc(CX, CY, R, 0, Math.PI * 2); g.stroke(); await addImg('comet/track', c, 0, 0, 'Track'); }
// the clock: hour, colon, minute; a dim twin for always-on
for (const n of ['Hour', 'Minute', 'Colon']) { const e = E(n); if (e) { e.name = n + ' Main'; e.show = 'normal'; } }
{ const mg = E('Hour Main').group; if (mg) project.groups[mg] = 'Clock'; }
await applyPreset('clock');
for (const n of ['Hour', 'Minute', 'Colon']) { const e = project.elements.find((x) => x.name === n); if (e) e.show = 'aod'; }
{ const ag = E('Hour').group; if (ag) project.groups[ag] = 'Clock AOD'; }
for (const [suffix, col, show] of [[' Main', '#ffffff', null], ['', '#8a8a8a', 'aod']]) {
  for (const n of ['Hour', 'Minute', 'Colon']) {
    const e = project.elements.find((x) => x.name === n + suffix && (!show || x.show === show));
    e.glyph = Object.assign(glyphSpecFrom(glyphStyle(e)), e.glyph || {}, { font: 'InterMed', size: SZ, weight: 500, color: col }); await rerenderGlyphLayers([e], { quiet: true });
  }
}
for (const e of project.elements) if (e.kind === 'IMG_TIME') e.space = -2;
// centre the three parts as one block (their boxes), each part's ink centred on the screen's middle line
for (const [suffix, show] of [[' Main', null], ['', 'aod']]) {
  const parts = ['Hour', 'Colon', 'Minute'].map((n) => project.elements.find((x) => x.name === n + suffix && (!show || x.show === show)));
  const gap = 4, ws = parts.map((e) => elBox(e).w), total = ws.reduce((a, b) => a + b, 0) + gap * 2;
  let x = Math.round(CX - total / 2);
  parts.forEach((e, i) => { e.alignH = 'CENTER_H'; e.x = x; e.y = vy(e, CY); x += ws[i] + gap; });
}
// readings inside the circle: temperature above the digits; sunrise / sunset (the next one) and battery below
await applyPreset('temp'); await applyPreset('suntimes'); await applyPreset('battery');
await loadAllImages();
for (const n of ['Temperature', 'Sunrise', 'Sunset', 'Battery']) {
  const e = E(n); e.glyph = Object.assign(glyphSpecFrom(glyphStyle(e)), e.glyph || {}, { font: 'InterMed', size: 38, weight: 500, color: '#dfe8f5' }); e.alignH = 'LEFT'; e.hSpace = -1; await rerenderGlyphLayers([e], { quiet: true });
}
await loadAllImages();
for (const n of ['Sunrise icon', 'Sunset icon']) project.elements = project.elements.filter((x) => x.name !== n);   // the preset's own icons: ours are drawn below
await chipAt('Temperature', 'thermo', CX, 132, 34, '#7ec8ff', true);
await sunChipAt(CX, 318, 36, '#ffb454', true);
// the sunrise text has no picture at build time, so its row was centred without it: put sunrise exactly where the (measured) sunset row is
for (const [from, to] of [['Sunset', 'Sunrise'], ['Sunset icon', 'Sunrise icon']]) { const a = E(from), t = E(to); t.x = a.x; t.y = a.y; t.alignH = a.alignH; }
await batChipAt('Battery', CX, 372, 46, 24, ['#4be08a', '#ffd34d', '#ff5d5d'], '#bfc8d6');
// background: twinkling stars outside the orbit (an alpha animation each, started by the code) and now and then a shooting star
const inScreen = (x, y) => { const r = 86; const dx = Math.max(r - x, 0, x - (W - r)), dy = Math.max(r - y, 0, y - (H - r)); return Math.hypot(dx, dy) <= r - 6 && x > 8 && x < W - 8 && y > 8 && y < H - 8; };
const star = (s, big) => { const c = mk(s, s), g = c.getContext('2d'), m = s / 2; const gl = g.createRadialGradient(m, m, 0, m, m, m); gl.addColorStop(0, 'rgba(255,255,255,0.95)'); gl.addColorStop(0.35, 'rgba(190,225,255,0.35)'); gl.addColorStop(1, 'rgba(120,180,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, s, s);
  if (big) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(m, 0.5); g.lineTo(m, s - 0.5); g.moveTo(0.5, m); g.lineTo(s - 0.5, m); g.stroke(); } return c; };
const pos = []; let tries = 0, sd = 11; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
while (pos.length < 18 && tries++ < 4000) {
  const x = Math.round(10 + rn() * (W - 20)), y = Math.round(10 + rn() * (H - 20)), r = Math.hypot(x - CX, y - CY);
  if (r < R + 16 || !inScreen(x, y)) continue;
  if (pos.some(([px, py]) => Math.hypot(px - x, py - y) < 34)) continue;
  pos.push([x, y]);
}
for (let i = 0; i < pos.length; i++) {
  const big = i % 3 === 0, s = big ? 11 : 7, e = await addImg(big ? 'comet/star-l' : 'comet/star-s', star(s, big), pos[i][0] - Math.round(s / 2), pos[i][1] - Math.round(s / 2), 'Star ' + (i + 1)); e.handle = 'st' + i;
}
{ const c = mk(34, 34), g = c.getContext('2d'); const gr = g.createLinearGradient(30, 4, 2, 30); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(120,180,255,0)'); g.strokeStyle = gr; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(30, 4); g.lineTo(2, 30); g.stroke();
  const e = await addImg('comet/shoot', c, 250, 14, 'Shooting star'); e.handle = 'shoot'; }
project.userCode = (project.userCode || '').replace(/\s*$/, '\n\n') + STARS_CODE(pos.length) + '\n';
// the comet: the smooth second hand preset, then its picture is replaced
await applyPreset('smoothsec');
{
  const c = mk(W, H), g = c.getContext('2d'); g.lineCap = 'round';
  const TAIL = 100, N = 100;                                    // tail length in degrees, segments
  for (let i = N; i >= 1; i--) {                                // from the far end of the tail to the head
    const t = i / N, a0 = rad(-TAIL * t - 0.4), a1 = rad(-TAIL * (t - 1 / N));
    g.strokeStyle = `rgba(${ACC[0]},${ACC[1]},${ACC[2]},${Math.pow(1 - t, 1.7) * 0.9})`; g.lineWidth = 2 + 5 * Math.pow(1 - t, 1.2);
    g.beginPath(); g.arc(CX, CY, R, a0 - Math.PI / 2, a1 - Math.PI / 2); g.stroke();
  }
  const hx = CX, hy = CY - R;                                    // the head at 12 o'clock (angle 0)
  const gl = g.createRadialGradient(hx, hy, 0, hx, hy, 16); gl.addColorStop(0, 'rgba(160,210,255,0.55)'); gl.addColorStop(1, 'rgba(90,176,255,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(hx, hy, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(hx, hy, 6, 0, Math.PI * 2); g.fill();
  addProjectImage('smooth_second.png', c, { replace: true });
}
{ const e = project.elements.find((x) => x.handle === 'smoothsec'); e.name = 'Comet'; e.angle = 200; }       // preview position only; the code turns it from the real time
const order = ['Track', 'Comet'];
const listed = order.map((n) => project.elements.find((x) => x.name === n)).filter(Boolean);
const bgl = project.elements.filter((x) => x.kind === 'FILL_RECT');
project.elements = bgl.concat(listed, project.elements.filter((x) => !listed.includes(x) && !bgl.includes(x)));
return project.elements.map((x) => x.name).join(', ');
