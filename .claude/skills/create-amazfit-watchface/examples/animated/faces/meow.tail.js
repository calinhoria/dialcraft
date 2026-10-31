const A = globalThis.__A, G = globalThis.__G;
const out = [];
// main clock: normal state only; the always-on state gets its own dim twin made of the same cells
for (const n of ['Hour', 'Minute']) { const e = E(n); if (e) { e.name = n + ' Main'; e.show = 'normal'; } }
const mg = E('Hour Main').group; if (mg) project.groups[mg] = 'Clock';
await applyPreset('clock');
for (const [n, x] of [['Hour', A.hx], ['Minute', A.mx]]) { const e = E(n); e.glyph = null; e.images = A.aod; e.space = A.C; e.zero = 1; e.alignH = 'LEFT'; e.x = x; e.y = A.y; e.show = 'aod'; }
project.elements = project.elements.filter((q) => q.name !== 'Colon');
const acv = mkc(A.C, 4 * A.C), acg = acv.getContext('2d'); acg.fillStyle = '#5a0000';
for (const r of [0, 3]) acg.fillRect(0, r * A.C, A.C - 1, A.C - 1);
const ca = await addImg('a_colon', acv, A.colx, A.coly, 'Colon AOD'); ca.show = 'aod';
const ag = E('Hour').group; if (ag) { project.groups[ag] = 'Clock AOD'; ca.group = ag; }
project.groups = project.groups || {};
for (const [name, list] of Object.entries(G)) {
  const gid = 'g' + name.replace(/\W/g, '');
  project.groups[gid] = name; let n = 0;
  for (const nm of list) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = gid; n++; } }
  out.push(name + ':' + n);
}
const want = ['Minute Main', 'Hour Main', 'Minute', 'Colon AOD', 'Hour'];
for (const list of Object.values(G)) want.push(...list);
const listed = want.map((n) => project.elements.find((x) => x.name === n)).filter(Boolean);
const rest = project.elements.filter((x) => !listed.includes(x));
project.elements = rest.concat(listed);
return out.join(' ');
