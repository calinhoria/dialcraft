const A = globalThis.__A, G = globalThis.__G;
const out = [];
// main clock: normal state only; the AOD gets its own dim twin
for (const n of ['Hour', 'Minute', 'Colon']) { const e = E(n); if (e) { e.name = n + ' Main'; e.show = 'normal'; } }
const mg = E('Hour Main').group; if (mg) project.groups[mg] = 'Clock';
await applyPreset('clock');
const spec = Object.assign({ font: A.font, size: A.size, fill: 'outline', outlineColor: A.color, outlineWidth: A.width || 2, color: A.color }, A.glyph || {});
for (const n of ['Hour', 'Minute', 'Colon']) {
  const e = E(n); if (!e) continue;
  if (n === 'Colon' && !A.col) { project.elements = project.elements.filter((x) => x !== e); continue; }
  e.glyph = Object.assign(glyphSpecFrom(glyphStyle(e)), e.glyph || {}, spec); await rerenderGlyphLayers([e], { quiet: true }); e.show = 'aod'; e.x = 20; e.y = 20;
}
const ag = E('Hour').group; if (ag) project.groups[ag] = 'Clock AOD';
if (A.stack) { for (const [n, cx, cy] of A.stack) await align([n], { cx, cy }, 'aod'); }
if (A.row) await seqRow(['Hour', 'Colon', 'Minute'], A.row[0], A.row[1], A.row[2], 'aod');
if (A.left) { for (const [n, l, cy] of A.left) await align([n], { l, cy }, 'aod'); }
// groups
project.groups = project.groups || {};
const sg = E('Sun time') ? E('Sun time').group : null;
for (const [name, list] of Object.entries(G)) {
  const gid = 'g' + name.replace(/\W/g, '');
  project.groups[gid] = name; let n = 0;
  for (const nm of list) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = gid; n++; } }
  out.push(name + ':' + n);
}
// layer order, bottom to top: everything else, then the groups one after another
const want = ['Minute Main', 'Colon Main', 'Hour Main', 'Minute', 'Colon', 'Hour'];
for (const list of Object.values(G)) want.push(...list);
const listed = want.map((n) => project.elements.find((x) => x.name === n)).filter(Boolean);
const rest = project.elements.filter((x) => !listed.includes(x));
project.elements = rest.concat(listed);
if (globalThis.__TOP) { const tops = globalThis.__TOP.map((n) => project.elements.find((x) => x.name === n)).filter(Boolean); project.elements = project.elements.filter((x) => !tops.includes(x)).concat(tops); }
if (globalThis.__L) project.elements[0].layoutInfo = globalThis.__L;
return out.join(' ');
