'use strict';
// Font detection for pictures a face came with.
//
// A watchface imported from Zeus CLI / Watchface Maker often ships only the
// pictures of its digits and weekday / month names — no font file. The
// translations table then has to draw the new names in some other typeface.
// This finds the closest typeface by comparing the shapes of the face's own
// pictures with the same words drawn in candidate fonts. Fonts bundled with the
// designer are tried offline first; then the Google Fonts catalogue is scanned
// in popularity order (a tiny per-family subset is downloaded, not the whole
// file). The user can preview every candidate and download the one that fits.
//
// The score is a shape similarity (0–100%), not a promise: two grotesques can
// be very close. The list is ordered so the closest is always first.

const FD_GRIDS = { digits: [48, 64], week: [128, 36], month: [128, 36] };
const FD_LABELS = { digits: 'Digits', week: 'Weekday names', month: 'Month names' };
const FD_MIN = { digits: 8, week: 5, month: 8 };
const FD_FIRST_BATCH = 280;
const FD_MORE_BATCH = 320;
const FD_PROBE_WEIGHTS = [400, 500, 600, 700, 300, 800, 200, 900];
const FD_CASES = [
  { id: 'upper', label: 'UPPERCASE' },
  { id: '', label: 'As generated' },
  { id: 'capitalize', label: 'Capitalize' },
  { id: 'lower', label: 'lowercase' },
];

let fdet = null;
const fdetImageCache = new Map();
const fdetProbe = new Map();
const fdetRenderCache = new Map();
const fdetInkCache = new Map();

function fdetLoadImage(url) {
  if (!url) return Promise.resolve(null);
  const hit = fdetImageCache.get(url);
  if (hit) return hit;
  const p = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
  fdetImageCache.set(url, p);
  return p;
}

// The solid background of an opaque picture: the corners and edge midpoints,
// when they agree. A picture whose border is itself artwork cannot be cut out.
function fdetBorderColor(d, w, h) {
  const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [w >> 1, h - 1], [0, h >> 1], [w - 1, h >> 1]];
  let r = 0, g = 0, b = 0, n = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 220) return null;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  r /= n; g /= n; b /= n;
  let spread = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    spread = Math.max(spread, Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b));
  }
  return spread <= 90 ? { r, g, b } : null;
}

// The tight ink box of a mask (threshold 18), or null when it has none.
function fdetBBox(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] <= 18) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      count++;
    }
  }
  return x1 < x0 ? null : { x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1, count };
}

// Trim a mask to its ink and scale it to the comparison grid.
function fdetGridFromMask(mask, w, h, gw, gh, box = null, keepAspect = false) {
  const b = box || fdetBBox(mask, w, h);
  if (!b) return null;
  const { x0, y0, bw, bh } = b;
  const tmp = document.createElement('canvas');
  tmp.width = bw; tmp.height = bh;
  const tc = tmp.getContext('2d', { willReadFrequently: true });
  const id = tc.createImageData(bw, bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const v = mask[(y + y0) * w + (x + x0)];
      const j = (y * bw + x) * 4;
      id.data[j] = 255; id.data[j + 1] = 255; id.data[j + 2] = 255; id.data[j + 3] = v;
    }
  }
  tc.putImageData(id, 0, 0);
  const out = document.createElement('canvas');
  out.width = gw; out.height = gh;
  const oc = out.getContext('2d', { willReadFrequently: true });
  oc.imageSmoothingEnabled = true;
  oc.imageSmoothingQuality = 'high';
  if (keepAspect) {   // scaled by height only, centred: a narrow letter stays narrow
    const dw = Math.min(gw, bw * gh / bh);
    oc.drawImage(tmp, (gw - dw) / 2, 0, dw, gh);
  } else oc.drawImage(tmp, 0, 0, gw, gh);
  const od = oc.getImageData(0, 0, gw, gh).data;
  const grid = new Float32Array(gw * gh);
  let ink = 0;
  for (let i = 0, j = 0; i < od.length; i += 4, j++) { grid[j] = od[i + 3] / 255; ink += grid[j]; }
  ink /= (gw * gh);
  return { grid, gw, gh, aspect: bw / bh, ink, w: bw, h: bh };
}

// A square erosion: the border and shadow of a glyph live on the outside of
// its ink, so shrinking the mask by a few pixels leaves the letter's own shape.
function fdetErode(mask, w, h, k) {
  if (k <= 0) return mask;
  const tmp = new Uint8ClampedArray(w * h);
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 255;
      for (let i = Math.max(0, x - k); i <= Math.min(w - 1, x + k); i++) v = Math.min(v, mask[y * w + i]);
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 255;
      for (let i = Math.max(0, y - k); i <= Math.min(h - 1, y + k); i++) v = Math.min(v, tmp[i * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}

// How deep inside the ink each pixel sits (chessboard distance to the outside:
// a diagonal border is as deep as a straight one),
// used to tell a glyph's fill from the border / shadow painted around it.
const FD_N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function fdetDepthMap(mask, w, h, box) {
  const { x0, y0, bw, bh } = box;
  const depth = new Uint16Array(bw * bh);
  const q = new Int32Array(bw * bh);
  let qh = 0, qt = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = (y + y0) * w + (x + x0);
      if (mask[i] <= 18) continue;
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) { edge = true; break; }
        if (mask[(yy + y0) * w + (xx + x0)] <= 18) { edge = true; break; }
      }
      if (edge) { const j = y * bw + x; depth[j] = 1; q[qt++] = j; }
    }
  }
  while (qh < qt) {
    const j = q[qh++];
    const x = j % bw, y = (j / bw) | 0;
    const d = depth[j] + 1;
    for (const [dx, dy] of FD_N8) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
      const k = yy * bw + xx;
      if (depth[k] || mask[(yy + y0) * w + (xx + x0)] <= 18) continue;
      depth[k] = d; q[qt++] = k;
    }
  }
  return depth;
}

// A glyph is usually filled with one colour (or a gradient) and may have a
// border and a shadow painted around it. The ink is split into two colour
// clusters; when one of them is a thin rim (shallow, around the other) it is the
// border / shadow and only the deeper one — the letter's fill — is kept. A
// two-tone fill (light top, dark bottom) has no rim, so it is left whole.
// Returns null when the picture is simply one solid glyph.
function fdetBodyMask(mask, d, w, h, box) {
  const { x0, y0, bw, bh } = box;
  const depth = fdetDepthMap(mask, w, h, box);
  const px = [];
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = (y + y0) * w + (x + x0);
      if (mask[i] > 128) px.push(i, y * bw + x);
    }
  }
  const total = px.length / 2;
  if (total < 30) return null;
  // 2-means in RGB, seeded with the darkest and the brightest ink
  const lum = (i) => d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  let lo = px[0], hi = px[0];
  for (let k = 0; k < px.length; k += 2) { const i = px[k]; if (lum(i) < lum(lo)) lo = i; if (lum(i) > lum(hi)) hi = i; }
  let c0 = [d[lo * 4], d[lo * 4 + 1], d[lo * 4 + 2]], c1 = [d[hi * 4], d[hi * 4 + 1], d[hi * 4 + 2]];
  const dist2 = (i, c) => { const r = d[i * 4] - c[0], g = d[i * 4 + 1] - c[1], b = d[i * 4 + 2] - c[2]; return r * r + g * g + b * b; };
  for (let it = 0; it < 8; it++) {
    const s = [[0, 0, 0, 0], [0, 0, 0, 0]];
    for (let k = 0; k < px.length; k += 2) {
      const i = px[k], t = dist2(i, c0) <= dist2(i, c1) ? 0 : 1;
      s[t][0] += d[i * 4]; s[t][1] += d[i * 4 + 1]; s[t][2] += d[i * 4 + 2]; s[t][3]++;
    }
    if (!s[0][3] || !s[1][3]) return null;
    c0 = [s[0][0] / s[0][3], s[0][1] / s[0][3], s[0][2] / s[0][3]];
    c1 = [s[1][0] / s[1][3], s[1][1] / s[1][3], s[1][2] / s[1][3]];
  }
  if (Math.hypot(c0[0] - c1[0], c0[1] - c1[1], c0[2] - c1[2]) < 60) return null;   // one colour: nothing to peel
  const st = [{ n: 0, depth: 0, rim: 0 }, { n: 0, depth: 0, rim: 0 }];
  const rimMax = Math.max(2, Math.round(Math.min(bw, bh) * 0.12) + 1);
  for (let k = 0; k < px.length; k += 2) {
    const i = px[k], t = dist2(i, c0) <= dist2(i, c1) ? 0 : 1, dep = depth[px[k + 1]];
    st[t].n++; st[t].depth += dep; if (dep <= rimMax) st[t].rim++;
  }
  const deepIdx = st[0].depth / st[0].n >= st[1].depth / st[1].n ? 0 : 1;
  const deep = st[deepIdx], rim = st[1 - deepIdx];
  if (deep.n < total * 0.1 || deep.n > total * 0.92) return null;
  if (deep.depth / deep.n < 1.35 * (rim.depth / rim.n)) return null;   // no rim: a two-tone fill
  if (rim.rim < rim.n * 0.7) return null;
  const cd = deepIdx === 0 ? c0 : c1, cr = deepIdx === 0 ? c1 : c0;
  const ax = [cd[0] - cr[0], cd[1] - cr[1], cd[2] - cr[2]], al = ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2];
  const body = new Uint8ClampedArray(w * h);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = (y + y0) * w + (x + x0);
      if (mask[i] <= 18) continue;
      // how far the colour sits from the rim towards the fill: anti-aliased edges get a partial value
      const t = ((d[i * 4] - cr[0]) * ax[0] + (d[i * 4 + 1] - cr[1]) * ax[1] + (d[i * 4 + 2] - cr[2]) * ax[2]) / al;
      const v = Math.max(0, Math.min(1, (t - 0.25) / 0.5));
      if (v > 0) body[i] = mask[i] * v;
    }
  }
  return body;
}

// The letters of a word picture, cut at the empty columns between them. Each is
// cropped to its own width but to the word's height, so a lowercase letter keeps
// its size against the capitals. null when the cut is not clean.
const FD_LETTER = [48, 40];
const FD_LETTER_MIX = 0.6;   // letter-by-letter vs the whole word, for names that cut cleanly
function fdetLetterGrids(mask, w, h, box) {
  const { x0, y0, bw, bh } = box;
  const runs = [];
  let start = -1;
  for (let x = 0; x <= bw; x++) {
    let ink = false;
    if (x < bw) for (let y = 0; y < bh; y++) if (mask[(y + y0) * w + x + x0] > 40) { ink = true; break; }
    if (ink && start < 0) start = x;
    if (!ink && start >= 0) { runs.push([start, x - 1]); start = -1; }
  }
  if (runs.length < 2 || runs.length > 24) return null;
  const out = [];
  for (const [a, b] of runs) {
    const g = fdetGridFromMask(mask, w, h, FD_LETTER[0], FD_LETTER[1], { x0: x0 + a, y0, bw: b - a + 1, bh }, true);
    if (!g) return null;
    // the fingerprint of the same letter, trimmed to its own ink (what the font index stores)
    let ya = bh, yb = -1;
    for (let y = 0; y < bh; y++) for (let x = a; x <= b; x++) if (mask[(y + y0) * w + x + x0] > 18) { if (y < ya) ya = y; if (y > yb) yb = y; break; }
    g.coarse = yb >= ya ? fdetCoarseFromMask(mask, w, h, { x0: x0 + a, y0: y0 + ya, bw: b - a + 1, bh: yb - ya + 1 }) : null;
    out.push(g);
  }
  return out;
}

// ---- the prebuilt font index (assets/fontindex, made by tools/build-font-index.js) ----
// Each glyph of each indexed font weight is kept as a tiny trimmed grid. Comparing
// a face's pictures with all of them takes milliseconds and needs no download;
// only the closest families are then fetched and compared at full detail.
const FD_INDEX_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const FD_COARSE = [10, 14];
const FD_SHORTLIST = 12;
// the shown score: the detailed comparison, averaged with the index's when the family came from it
function fdetBlend(cand, detail) {
  cand.detail = detail;
  return cand.indexScore != null ? 0.5 * detail + 0.5 * cand.indexScore : detail;
}
function fdetCoarseFromMask(mask, w, h, box) {
  const g = fdetGridFromMask(mask, w, h, FD_COARSE[0], FD_COARSE[1], box);
  if (!g) return null;
  let n = 0;
  for (let i = 0; i < g.grid.length; i++) n += g.grid[i] * g.grid[i];
  return n ? { grid: g.grid, aspect: g.aspect, norm: Math.sqrt(n) } : null;
}
function fdetCoarseGlyph(family, weight, ch) {
  const size = 64, W = 160, H = 128;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true });
  setFontOn(c, family, size, weight, '');
  c.textBaseline = 'alphabetic'; c.fillStyle = '#ffffff';
  c.fillText(ch, 24, 88);
  const d = c.getImageData(0, 0, W, H).data;
  const m = new Uint8ClampedArray(W * H);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) m[j] = d[i + 3];
  const b = fdetBBox(m, W, H);
  return b && b.count >= 6 ? fdetCoarseFromMask(m, W, H, b) : null;
}
function fdetPackCoarse(g, buf, off) {
  const n = FD_COARSE[0] * FD_COARSE[1];
  for (let i = 0; i < n; i += 2) {
    const a = Math.round(Math.min(1, g.grid[i]) * 15), b = i + 1 < n ? Math.round(Math.min(1, g.grid[i + 1]) * 15) : 0;
    buf[off + (i >> 1)] = (a << 4) | b;
  }
  const p = off + Math.ceil(n / 2);
  buf[p] = Math.max(1, Math.min(255, Math.round(g.aspect * 64)));
  buf[p + 1] = 1;   // present
}
let fdetIndexData = null;
async function fdetIndex() {
  if (fdetIndexData) return fdetIndexData.ok ? fdetIndexData : null;
  try {
    const r = await API.fontIndex();
    if (!r || r.error || !r.meta || !r.bin) { fdetIndexData = { ok: false }; return null; }
    const meta = r.meta, n = meta.gw * meta.gh, per = Math.ceil(n / 2) + 2;
    const bin = r.bin instanceof Uint8Array ? r.bin : new Uint8Array(r.bin);
    // unpacked once into floats with their norms: ~2000 weights × 62 glyphs × 140 is small enough
    const grids = new Float32Array(meta.entries.length * meta.chars.length * n);
    const aspect = new Float32Array(meta.entries.length * meta.chars.length);
    const norm = new Float32Array(meta.entries.length * meta.chars.length);
    for (let k = 0; k < meta.entries.length * meta.chars.length; k++) {
      const off = k * per;
      if (!bin[off + Math.ceil(n / 2) + 1]) continue;
      let s = 0;
      for (let i = 0; i < n; i++) {
        const byte = bin[off + (i >> 1)], v = ((i & 1) ? (byte & 15) : (byte >> 4)) / 15;
        grids[k * n + i] = v; s += v * v;
      }
      norm[k] = Math.sqrt(s);
      aspect[k] = bin[off + Math.ceil(n / 2)] / 64;
    }
    const slot = new Map([...meta.chars].map((c, i) => [c, i]));
    fdetIndexData = { ok: true, meta, grids, aspect, norm, n, slot };
    return fdetIndexData;
  } catch (e) { fdetIndexData = { ok: false }; return null; }
}
// a letter of a name → its slot in the index (accents dropped: Ș is compared as S)
function fdetIndexSlot(ix, ch) {
  if (ix.slot.has(ch)) return ix.slot.get(ch);
  const base = String(ch).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ix.slot.has(base) ? ix.slot.get(base) : -1;
}
// The face's glyphs that can be looked up: every digit picture, and the letters of
// the name pictures that cut cleanly into as many letters as the name has.
function fdetIndexProbes(group, ix) {
  const out = [];
  const parts = group.parts || [group];
  for (const g of parts) {
    for (const s of g.samples || []) {
      if (g.kind === 'digits') {
        const k = fdetIndexSlot(ix, s.char);
        if (k >= 0 && s.sig.coarse) out.push({ k, c: s.sig.coarse, w: 1 });
        continue;
      }
      const chars = [...String(s.char)].filter((c) => c.trim());
      if (!s.sig.letters || s.sig.letters.length !== chars.length) continue;
      chars.forEach((ch, i) => {
        const k = fdetIndexSlot(ix, ch), c = s.sig.letters[i].coarse;
        if (k >= 0 && c) out.push({ k, c, w: 1 / chars.length });   // one name weighs as much as one digit
      });
    }
  }
  return out;
}
// Every indexed family ranked by its closest weight. null when the index is
// missing or the face gives nothing to look up (then the full scan is used).
async function fdetIndexRank(group) {
  const ix = await fdetIndex();
  if (!ix) return null;
  const probes = fdetIndexProbes(group, ix);
  if (probes.length < 5) return null;
  const { meta, grids, aspect, norm, n } = ix, C = meta.chars.length;
  const best = new Map();
  for (let e = 0; e < meta.entries.length; e++) {
    let sum = 0, wsum = 0;
    for (const p of probes) {
      const k = e * C + p.k;
      if (!norm[k]) continue;
      let dot = 0;
      const base = k * n, g = p.c.grid;
      for (let i = 0; i < n; i++) dot += g[i] * grids[base + i];
      const cos = dot / (p.c.norm * norm[k]);
      const asp = Math.abs(Math.log((p.c.aspect || 1) / (aspect[k] || 1)));
      sum += p.w * (cos - Math.min(0.2, asp * 0.25)); wsum += p.w;
    }
    if (!wsum) continue;
    const [family, weight, category] = meta.entries[e];
    const score = sum / wsum;
    const old = best.get(family);
    if (!old || score > old.score) best.set(family, { family, weight, category, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

// LCD-style faces draw the unlit segments faintly ("ghost" 8s behind every
// digit). Split the ink's alpha levels in two (Otsu); when the faint class is
// solid areas — not just the anti-aliased rim of the letters — it is dropped and
// the lit part rescaled. The mask is changed in place.
function fdetDropGhost(mask, w, h) {
  // very faint ink (under ~15% of the strongest) is never the letter: ghost
  // segments, a glow, dust left by an editor
  let max = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > max) max = mask[i];
  if (max > 160) { const cut = max * 0.15; for (let i = 0; i < mask.length; i++) if (mask[i] < cut) mask[i] = 0; }
  const hist = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 8) { hist[mask[i]]++; total++; }
  if (total < 40) return false;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) sumAll += v * hist[v];
  let wB = 0, sumB = 0, bestT = 0, bestVar = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
    if (v > bestVar) { bestVar = v; bestT = t; }
  }
  let nLow = 0, sLow = 0, sHigh = 0, solid = 0;
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i];
    if (a <= 8) continue;
    if (a <= bestT) {
      nLow++; sLow += a;
      const x = i % w, y = (i / w) | 0;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && mask[i - 1] > 8 && mask[i + 1] > 8 && mask[i - w] > 8 && mask[i + w] > 8
        && mask[i - 1] <= bestT && mask[i + 1] <= bestT) solid++;
    } else sHigh += a;
  }
  const nHigh = total - nLow;
  if (!nLow || !nHigh || nLow < total * 0.15 || nHigh < total * 0.15) return false;
  if (sLow / nLow > 0.4 * (sHigh / nHigh)) return false;        // two similar levels: one glyph
  if (solid < nLow * 0.3) return false;                          // only the soft edges of the letters
  for (let i = 0; i < mask.length; i++) mask[i] = mask[i] <= bestT ? 0 : Math.round((mask[i] - bestT) / (255 - bestT) * 255);
  return true;
}

// A trimmed, scaled grey mask of what the picture draws. Transparent pictures
// use their alpha channel (watchface glyphs normally do); opaque ones use the
// distance from their border colour.
function fdetSignature(im, gw, gh) {
  const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  if (!w || !h) return null;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  try { c.drawImage(im, 0, 0, w, h); } catch (e) { return null; }
  let d;
  try { d = c.getImageData(0, 0, w, h).data; } catch (e) { return null; }
  let hasAlpha = false;
  for (let i = 3; i < d.length; i += 4) { if (d[i] < 245) { hasAlpha = true; break; } }
  const mask = new Uint8ClampedArray(w * h);
  if (hasAlpha) {
    for (let i = 0, j = 0; i < d.length; i += 4, j++) mask[j] = d[i + 3];
    fdetDropGhost(mask, w, h);
  } else {
    const bg = fdetBorderColor(d, w, h);
    if (!bg) return null;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const dist = Math.hypot(d[i] - bg.r, d[i + 1] - bg.g, d[i + 2] - bg.b);
      mask[j] = Math.max(0, Math.min(255, (dist - 10) * 2.5));
    }
  }
  const box = fdetBBox(mask, w, h);
  if (!box || box.count < 8) return null;
  if (box.count / (box.bw * box.bh) > 0.94) return null;          // a block, not a glyph
  // Pictures drawn with a border / shadow are a dilated version of the letter.
  // When the fill can be told from the rim by colour, the fill alone is the
  // letter (the dilated outline would always favour the heaviest fonts).
  // Otherwise a slightly eroded copy is offered next to the full shape.
  const body = hasAlpha ? fdetBodyMask(mask, d, w, h, box) : null;
  const bb = body ? fdetBBox(body, w, h) : null;
  const useBody = !!(bb && bb.count >= 8);
  const src = useBody ? body : mask, sbox = useBody ? bb : box;
  const sig = fdetGridFromMask(src, w, h, gw, gh, sbox);
  if (!sig) return null;
  sig.box = { x0: sbox.x0, y0: sbox.y0, bw: sbox.bw, bh: sbox.bh };
  sig.peeled = useBody;
  sig.letters = fdetLetterGrids(src, w, h, sbox);
  sig.coarse = fdetCoarseFromMask(src, w, h, sbox);
  sig.alts = [];
  if (!useBody) {
    const k = Math.max(1, Math.round(Math.min(box.bw, box.bh) * 0.09));
    const eroded = fdetErode(mask, w, h, k);
    const eb = fdetBBox(eroded, w, h);
    if (eb && eb.count >= 20 && eb.count <= box.count * 0.9) {
      const alt = fdetGridFromMask(eroded, w, h, gw, gh, eb);
      if (alt && alt.ink > 0.005) { alt.letters = fdetLetterGrids(eroded, w, h, eb); sig.alts.push(alt); }
    }
  }
  return sig;
}

// Shapes are compared with a cosine over the grey masks, with small penalties
// for a very different width or stroke weight. Exact same font/size/weight
// scores ~1; two unrelated sans faces usually land in 0.65–0.85. A one-pixel
// search absorbs the small differences in letter spacing and rasterisation.
function fdetScore(a, b) {
  if (!a || !b || a.gw !== b.gw || a.gh !== b.gh) return 0;
  const gw = a.gw, gh = a.gh;
  let na = 0;
  for (let i = 0; i < a.grid.length; i++) na += a.grid[i] * a.grid[i];
  if (!na) return 0;
  let shape = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      let dot = 0, nb = 0;
      for (let y = 0; y < gh; y++) {
        const yy = y + dy;
        if (yy < 0 || yy >= gh) continue;
        for (let x = 0; x < gw; x++) {
          const xx = x + dx;
          if (xx < 0 || xx >= gw) continue;
          const av = a.grid[y * gw + x], bv = b.grid[yy * gw + xx];
          dot += av * bv; nb += bv * bv;
        }
      }
      if (nb) shape = Math.max(shape, dot / Math.sqrt(na * nb));
    }
  }
  if (!shape) return 0;
  const aspect = Math.abs(Math.log((a.aspect || 1) / (b.aspect || 1)));
  const ink = Math.abs(Math.log((a.ink + 0.02) / (b.ink + 0.02)));
  return Math.max(0, Math.min(1, shape - Math.min(0.11, aspect * 0.045) - Math.min(0.07, ink * 0.035)));
}

// The same text drawn with a candidate font, normalised exactly like the face's picture.
function fdetRenderText(family, weight, text, gw, gh) {
  const key = `${family}\u0000${weight}\u0000${text}\u0000${gw}x${gh}`;
  if (fdetRenderCache.has(key)) return fdetRenderCache.get(key);
  const meas = document.createElement('canvas').getContext('2d');
  const size = Math.max(96, gh * 3);
  setFontOn(meas, family, size, weight, '');
  const m = meas.measureText(text);
  const left = Math.max(0, m.actualBoundingBoxLeft || 0);
  const right = Math.max(1, m.actualBoundingBoxRight || 0);
  const asc = Math.max(1, m.actualBoundingBoxAscent || size * 0.8);
  const desc = Math.max(0, m.actualBoundingBoxDescent || 0);
  const pad = Math.ceil(size * 0.1);
  const w = Math.max(8, Math.ceil(left + right) + pad * 2);
  const h = Math.max(8, Math.ceil(asc + desc) + pad * 2);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  setFontOn(c, family, size, weight, '');
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#ffffff';
  c.fillText(text, pad + left, pad + asc);
  const sig = fdetSignature(cv, gw, gh);
  fdetRenderCache.set(key, sig);
  if (fdetRenderCache.size > 4000) fdetRenderCache.clear();
  return sig;
}

// The candidate drawn as a cropped ink bitmap: used by the per-result preview
// so it can be placed at the exact position and size of the face's own picture.
function fdetRenderInk(family, weight, text) {
  const key = `${family}\u0000${weight}\u0000${text}`;
  if (fdetInkCache.has(key)) return fdetInkCache.get(key);
  const meas = document.createElement('canvas').getContext('2d');
  const size = 320;
  setFontOn(meas, family, size, weight, '');
  const m = meas.measureText(text);
  const left = Math.max(0, m.actualBoundingBoxLeft || 0);
  const right = Math.max(1, m.actualBoundingBoxRight || 0);
  const asc = Math.max(1, m.actualBoundingBoxAscent || size * 0.8);
  const desc = Math.max(0, m.actualBoundingBoxDescent || 0);
  const pad = Math.ceil(size * 0.1);
  const w = Math.max(8, Math.ceil(left + right) + pad * 2);
  const h = Math.max(8, Math.ceil(asc + desc) + pad * 2);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  setFontOn(c, family, size, weight, '');
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#ffffff';
  c.fillText(text, pad + left, pad + asc);
  let d;
  try { d = c.getImageData(0, 0, w, h).data; } catch (e) { fdetInkCache.set(key, null); return null; }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] <= 18) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || y1 < y0) { fdetInkCache.set(key, null); return null; }
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  fdetInkCache.set(key, out);
  if (fdetInkCache.size > 1000) fdetInkCache.clear();
  return out;
}

// Each letter of `text` drawn on its own (no spacing, no kerning), cropped like
// fdetLetterGrids crops a picture: own width, the word's common height.
const fdetLetterCache = new Map();
function fdetRenderLetters(family, weight, text) {
  const key = `${family}\u0000${weight}\u0000${text}`;
  if (fdetLetterCache.has(key)) return fdetLetterCache.get(key);
  const chars = [...String(text)].filter((ch) => ch.trim());
  const size = 96, H = Math.ceil(size * 1.6), base = Math.round(size * 1.15);
  const parts = [];
  let Y0 = H, Y1 = -1;
  for (const ch of chars) {
    const cv = document.createElement('canvas');
    const c0 = cv.getContext('2d', { willReadFrequently: true });
    setFontOn(c0, family, size, weight, '');
    const W = Math.max(8, Math.ceil(c0.measureText(ch).width + size * 0.6));
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    setFontOn(c, family, size, weight, '');
    c.textBaseline = 'alphabetic'; c.fillStyle = '#ffffff';
    c.fillText(ch, Math.round(size * 0.3), base);
    const d = c.getImageData(0, 0, W, H).data;
    const m = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) m[j] = d[i + 3];
    const b = fdetBBox(m, W, H);
    if (!b) { fdetLetterCache.set(key, null); return null; }
    Y0 = Math.min(Y0, b.y0); Y1 = Math.max(Y1, b.y0 + b.bh - 1);
    parts.push({ m, W, b });
  }
  const out = parts.length >= 2 ? parts.map((p) => fdetGridFromMask(p.m, p.W, H, FD_LETTER[0], FD_LETTER[1], { x0: p.b.x0, y0: Y0, bw: p.b.bw, bh: Y1 - Y0 + 1 }, true)) : null;
  const res = out && out.every(Boolean) ? out : null;
  fdetLetterCache.set(key, res);
  if (fdetLetterCache.size > 6000) fdetLetterCache.clear();
  return res;
}
// letter by letter, when the picture cuts into as many letters as the name has:
// the spacing a designer chose is then not held against the font
function fdetLetterScore(srcLetters, family, weight, text) {
  const n = [...String(text)].filter((ch) => ch.trim()).length;
  if (!srcLetters || srcLetters.length !== n) return null;
  const cand = fdetRenderLetters(family, weight, text);
  if (!cand || cand.length !== n) return null;
  let s = 0;
  for (let i = 0; i < n; i++) s += fdetScore(srcLetters[i], cand[i]);
  return s / n;
}
function fdetItemScore(kind, sigSrc, family, weight, text, gw, gh) {
  const sig = fdetRenderText(family, weight, text, gw, gh);
  const whole = sig ? fdetScore(sigSrc, sig) : null;
  if (kind !== 'digits') {
    const ls = fdetLetterScore(sigSrc.letters, family, weight, text);
    const mix = typeof window.FD_LETTER_MIX === 'number' ? window.FD_LETTER_MIX : FD_LETTER_MIX;
    if (ls != null) return whole == null ? ls : ls * mix + whole * (1 - mix);
  }
  return whole;
}
// After a group is scored, group.lastInk holds how much heavier (> 1) or lighter
// (< 1) the face's strokes are than the candidate's: it steers the weight search.
async function fdetGroupScore(group, family, weight) {
  if (group.parts) {
    let sum = 0, ink = 0;
    for (const part of group.parts) { sum += await fdetGroupScore(part, family, weight); ink += Math.log(part.lastInk || 1); }
    group.lastInk = Math.exp(ink / group.parts.length);
    return sum / group.parts.length;
  }
  const [gw, gh] = FD_GRIDS[group.kind];
  const scores = [];
  let inkLog = 0, inkN = 0;
  for (const item of group.samples) {
    let score = fdetItemScore(group.kind, item.sig, family, weight, item.char, gw, gh);
    if (score == null) continue;
    const r = fdetRenderText(family, weight, item.char, gw, gh);
    if (r && r.ink > 0.005 && item.sig.ink > 0.005) { inkLog += Math.log(item.sig.ink / r.ink); inkN++; }
    for (const alt of item.sig.alts || []) {
      const s = fdetItemScore(group.kind, alt, family, weight, item.char, gw, gh);
      if (s != null) score = Math.max(score, s);
    }
    scores.push(score);
  }
  group.lastInk = inkN ? Math.exp(inkLog / inkN) : 1;
  if (!scores.length) return 0;
  scores.sort((a, b) => a - b);
  // one odd picture (a blurred frame, a multi-colour icon) must not decide the match
  const keep = scores.length >= 7 ? scores.slice(1) : scores;
  return keep.reduce((n, v) => n + v, 0) / keep.length;
}

function fdetSlug(s) {
  return String(s || 'font').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'font';
}

async function fdetProbeFont(rec) {
  const key = `${rec.family}\u0000${rec.weight}\u0000${rec.style || 'normal'}`;
  if (fdetProbe.has(key)) return fdetProbe.get(key).alias;
  const alias = `__gfd_${fdetSlug(rec.family)}_${rec.weight}_${fdetSlug(rec.style || 'normal')}`;
  try {
    const ff = new FontFace(alias, `url("data:font/${rec.format || 'truetype'};base64,${rec.dataBase64}")`, { weight: String(rec.weight || 400) });
    await ff.load();
    document.fonts.add(ff);
    fdetProbe.set(key, { alias, ff });
    return alias;
  } catch (e) { return null; }
}

// Which of the face's pictures can be compared. A layer whose pictures the
// designer generated is included too: the tool also serves as a second opinion
// when a project was opened on a machine without its font file.
function fdetGroups() {
  const out = [];
  const seen = new Set();
  for (const e of elements()) {
    const kind = labelKind(e) || (DIGIT_SET_KINDS.has(e.kind) ? 'digits' : null);
    if (!kind) continue;
    const spec = glyphSpecForLayer(e);
    if (!spec || typeof spec === 'string') continue;
    const imgs = e.images || [];
    const items = [];
    for (const g of spec) {
      if (!g || !g.name || !imgs.includes(g.name)) continue;
      if (kind === 'digits' && !/^\d$/.test(g.char)) continue;
      items.push({ char: String(g.char), name: g.name });
    }
    if (items.length < FD_MIN[kind]) continue;
    // layers that share the same picture set are one component: hour / minute /
    // date pictures often point at the same `font_N_*` files
    const key = `${kind}:${imgs[0] || e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const targets = elements().filter((x) => {
      const k = labelKind(x) || (DIGIT_SET_KINDS.has(x.kind) ? 'digits' : null);
      return k === kind && (x.images || [])[0] === imgs[0];
    });
    const want = kind === 'week' ? 7 : kind === 'month' ? 12 : 10;
    out.push({
      key, kind, element: e, targets: targets.length ? targets : [e],
      label: `${FD_LABELS[kind]} · ${e.name || 'layer'}${targets.length > 1 ? ` · ${targets.length} layers` : ''}`,
      items: items.slice(0, want),
    });
  }
  // most faces draw their digits and their names in one typeface: comparing both
  // at once is the strongest evidence (the names part decides the language)
  const names = out.find((g) => g.kind === 'week') || out.find((g) => g.kind === 'month');
  const digits = out.filter((g) => g.kind === 'digits');
  if (names && digits.length) out.unshift(fdetCombined(names, digits));
  return out;
}
// `digits` may be several digit sets (a face often has two or three styles); once
// the pictures are read, the one whose closest fonts agree most with the names'
// is kept (fdetPickDigits).
function fdetCombined(names, digits) {
  const list = Array.isArray(digits) ? digits : [digits];
  const g = {
    key: 'all', kind: 'all', names, element: names.element, targets: names.targets, digitChoices: list,
    parts: [names, list[0]],
    label: `${FD_LABELS[names.kind]} + digits · one font for both`,
    get samples() { return g.parts.every((p) => p.samples) ? g.parts.flatMap((p) => p.samples) : null; },
    get items() { return g.parts.flatMap((p) => p.items); },
    get previewText() { return names.previewText; },
  };
  return g;
}
async function fdetPickDigits(group) {
  if (!group.digitChoices || group.digitChoices.length < 2) return;
  const ix = await fdetIndex();
  if (!ix) return;
  const top = async (g) => { const r = await fdetIndexRank(g); return r ? r.slice(0, 25).map((x) => x.family) : []; };
  const nameTop = new Set(await top(group.names));
  if (!nameTop.size) return;
  let best = null;
  for (const d of group.digitChoices) {
    const t = await top(d);
    const overlap = t.filter((f, i) => nameTop.has(f)).length + (t[0] && nameTop.has(t[0]) ? 3 : 0);
    if (!best || overlap > best.overlap) best = { d, overlap };
  }
  if (best) group.parts = [group.names, best.d];
}
const fdetNames = (group) => (group && group.names) || group;

async function fdetLoadSamples(group) {
  if (group.parts) {
    for (const part of [group.names, ...(group.digitChoices || group.parts)]) if (part && !part.samples) await fdetLoadSamples(part);
    await fdetPickDigits(group);
    return group.samples;
  }
  const [gw, gh] = FD_GRIDS[group.kind];
  const got = await Promise.all(group.items.map(async (item) => {
    const meta = imgMeta(item.name);
    if (!meta || !meta.url) return null;
    const im = await fdetLoadImage(meta.url);
    if (!im) return null;
    const sig = fdetSignature(im, gw, gh);
    return sig ? { ...item, sig } : null;
  }));
  group.samples = got.filter(Boolean);
  group.items = group.samples;
  if (group.kind !== 'digits' && group.samples.length) {
    if (!group.lang) {
      const guess = await fdetGuessLanguage(group);
      if (guess) {
        group.lang = guess.code; group.form = guess.form; group.caseMode = guess.caseMode;
        group.guessed = guess;
      } else {
        group.lang = defaultLangCode(); group.form = group.form || (group.element && group.element.labelForm) || 'short';
        group.caseMode = labelCaseOf(group.element);
      }
    }
    fdetApplyLanguage(group);
  } else {
    group.previewText = group.samples.slice(0, 4).map((x) => x.char).join('');
  }
  return group.samples;
}

// What the pictures probably read. The pattern of short and long names (a font's
// width changes every name by the same factor) shortlists language / form / case
// hypotheses cheaply; the shortlist, plus the layer's own language, is then
// decided by letter shapes drawn in a plain sans, and by how many pictures cut
// into exactly as many letters as the names have.
function fdetWidthHypotheses(group) {
  const langs = ((META && META.languages) || []).map((l) => l.code);
  const sample = group.samples.map((s) => Math.log(Math.max(0.05, s.sig.aspect)));
  if (sample.length < 3 || !langs.length) return [];
  const ref = document.createElement('canvas').getContext('2d');
  setFontOn(ref, 'sans-serif', 64, 400, '');
  const measure = (names) => names.map((n) => {
    const m = ref.measureText(n);
    const h = Math.max(1, (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0));
    return Math.log(Math.max(0.05, Math.max(1, m.width) / h));
  });
  const corr = (a, b) => {
    let ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
    ma /= a.length; mb /= b.length;
    let va = 0, vb = 0, cov = 0;
    for (let i = 0; i < a.length; i++) { const da = a[i] - ma, db = b[i] - mb; cov += da * db; va += da * da; vb += db * db; }
    return va && vb ? cov / Math.sqrt(va * vb) : 0;
  };
  const out = [];
  for (const code of langs) {
    for (const form of ['short', 'long']) {
      for (const caseMode of FD_CASES.map((c) => c.id)) {
        const names = fdetNamesFor(group, code, form, caseMode);
        if (names.length !== sample.length) continue;
        out.push({ code, form, caseMode, names, width: corr(sample, measure(names)) });
      }
    }
  }
  return out.sort((a, b) => b.width - a.width);
}
const FD_GUESS_FONT = 'Open Sans';
async function fdetGuessLanguage(group, font = null) {
  group = fdetNames(group);
  if (!group || !group.samples || group.samples.length < 3) return null;
  const all = fdetWidthHypotheses(group);
  if (!all.length) return null;
  const own = zeppLanguage(languageOf(group.element));
  const ownCode = own ? own.code : defaultLangCode();
  const seen = new Set(), short = [];
  const add = (h) => { const k = `${h.code}|${h.form}|${h.caseMode}`; if (h && !seen.has(k)) { seen.add(k); short.push(h); } };
  // the layer's language first, then the best width matches; when the widths say
  // nothing (a monospace face draws every three-letter name equally wide) all of them
  const ws = group.samples.map((x) => x.sig.aspect), wm = ws.reduce((a, b) => a + b, 0) / ws.length;
  const spread = Math.sqrt(ws.reduce((a, b) => a + (b - wm) * (b - wm), 0) / ws.length) / (wm || 1);
  for (const h of all) if (h.code === ownCode) add(h);
  for (const h of (spread < 0.06 ? all : all.slice(0, 40))) add(h);
  // identical name lists (en-US / en-GB …) need scoring once
  const byNames = new Map();
  for (const h of short) { const k = h.names.join('|'); if (!byNames.has(k)) byNames.set(k, h); }
  // a plain sans first; once a scan has found the face's font, that font (font = { family, weight })
  const fam = font ? font.family : ((await ensureFont(FD_GUESS_FONT)) ? FD_GUESS_FONT : 'sans-serif');
  const fw = font ? (font.weight || 400) : 400;
  const chars = group.samples.map((x) => x.char);
  let best = null;
  try {
    for (const h of byNames.values()) {
      group.samples.forEach((x, i) => { x.char = h.names[i]; });
      const shape = await fdetGroupScore(group, fam, fw);
      let cut = 0;
      group.samples.forEach((x, i) => {
        const n = [...h.names[i]].filter((c) => c.trim()).length;
        if (x.sig.letters && x.sig.letters.length === n) cut++;
      });
      const score = shape + 0.06 * (cut / group.samples.length) + 0.03 * Math.max(0, h.width) + (h.code === ownCode ? 0.01 : 0);
      if (!best || score > best.score) best = { code: h.code, form: h.form, caseMode: h.caseMode, score, shape, width: h.width };
    }
  } finally { group.samples.forEach((x, i) => { x.char = chars[i]; }); }
  return best;
}

function fdetNamesFor(group, code, form, caseMode) {
  group = fdetNames(group);
  if (!group || group.kind === 'digits') return [];
  const tag = intlTagOf(code);
  const loc = localeKnown(tag) ? tag : (localeKnown(code) ? code : 'en-US');
  const mode = caseMode == null ? labelCaseOf(group.element) : caseMode;
  return builtInNames(group.kind, loc, form || 'short').map((n) => applyLabelCase(n, mode));
}

function fdetApplyLanguage(group) {
  group = fdetNames(group);
  if (!group || group.kind === 'digits') return;
  const names = fdetNamesFor(group, group.lang || defaultLangCode(), group.form || 'short', group.caseMode);
  for (let i = 0; i < group.samples.length; i++) if (names[i]) group.samples[i].char = names[i];
  group.previewText = (group.samples[0] && group.samples[0].char) || '';
}

// bundled + imported project fonts, tried before any download
function fdetLocal() {
  const out = [];
  for (const f of customFonts) out.push({ family: f.family, source: 'project', category: 'Project font', file: f.name, weight: 400 });
  for (const f of BUNDLED_FONTS) out.push({ family: f.family, source: 'bundled', category: f.cat || 'Bundled', weight: 400 });
  return out;
}

async function fdetCatalog() {
  if (fdet.catalog) return fdet.catalog;
  fdetState('Reading the Google Fonts catalogue…');
  const res = await API.gfontsCatalog({ force: !!(fdet && fdet.forceCatalog) });
  if (!res || res.error && !(res.families || []).length) throw new Error((res && res.error) || 'Google Fonts could not be reached');
  fdet.catalog = res.families || [];
  fdet.catalogStale = !!res.stale;
  return fdet.catalog;
}

// An ordered shortlist: popular faces first, then a broad slice of every
// category (display, serif, monospace, handwriting) so distinctive watchfaces
// are not missed. "Search more" walks the rest of the catalogue in this order.
function fdetGoogleOrder(families) {
  const seen = new Set(), out = [];
  // a bundled typeface is one weight (Open Sans = Bold …), so its Google family is
  // still scanned for the others; a font imported into the project is skipped
  const local = new Set(customFonts.map((f) => f.family.toLowerCase()));
  const add = (f) => {
    if (!f || f.isBrandFont) return;
    if (!Array.isArray(f.subsets) || !f.subsets.includes('latin')) return;
    const k = f.family.toLowerCase();
    if (seen.has(k) || local.has(k)) return;
    seen.add(k); out.push(f);
  };
  for (const f of families.slice(0, 100)) add(f);
  for (const cat of ['Display', 'Serif', 'Sans Serif', 'Monospace', 'Handwriting']) {
    let n = 0;
    for (const f of families) if (f.category === cat) { add(f); if (++n >= 50) break; }
  }
  for (const f of families) add(f);
  return out;
}

function fdetWeights(family) {
  const keys = Object.keys((family && family.fonts) || {}).filter((k) => /^\d+$/.test(k)).map(Number)
    .sort((a, b) => a - b);
  if (!keys.length) {
    const axis = (family && family.axes || []).find((a) => a.tag === 'wght');
    if (axis) keys.push(Math.round(axis.defaultValue || 400));
    else keys.push(400);
  }
  return keys;
}
function fdetFirstWeight(family) {
  const keys = fdetWeights(family);
  return FD_PROBE_WEIGHTS.find((w) => keys.includes(w)) || keys[Math.floor(keys.length / 2)] || 400;
}
// Regular and bold cover most watchfaces; a family with only other weights gets
// its common one. Two downloads per family are cached, so later faces are fast.
function fdetScanWeights(family) {
  const keys = fdetWeights(family);
  const out = [];
  const regular = keys.includes(400) ? 400 : fdetFirstWeight(family);
  out.push(regular);
  for (const w of [700, 500, 300, 800]) if (keys.includes(w) && !out.includes(w)) { out.push(w); break; }
  return out;
}

// One family, scored at the weight that fits best: start at regular, then step
// towards the heavier or lighter weights while the strokes still differ and the
// score still improves. Most families need one or two tiny downloads.
async function fdetScoreFamily(group, f, scanText, alive = () => true, startWeight = null) {
  const avail = fdetWeights(f);
  const tried = new Map();
  let best = null, failed = 0;
  const probe = async (weight) => {
    if (tried.has(weight)) return tried.get(weight);
    tried.set(weight, null);
    let rec = null;
    try { rec = await API.gfontsSubset({ family: f.family, weight, text: scanText }); } catch (e) { rec = null; }
    if (!rec || rec.error) { failed++; return null; }
    const alias = await fdetProbeFont(rec);
    if (!alias) { failed++; return null; }
    const score = await fdetGroupScore(group, alias, weight);
    const r = { weight, alias, score, ink: group.lastInk, style: rec.style || 'normal' };
    tried.set(weight, r);
    if (!best || score > best.score) best = r;
    return r;
  };
  let cur = await probe(startWeight != null && avail.includes(startWeight) ? startWeight : (avail.includes(400) ? 400 : fdetFirstWeight(f)));
  for (let step = 0; cur && step < 4 && alive(); step++) {
    const dir = cur.ink > 1.06 ? 1 : cur.ink < 0.94 ? -1 : 0;
    if (!dir) break;
    const next = avail.filter((w) => (dir > 0 ? w > cur.weight : w < cur.weight) && !tried.has(w))
      .sort((a, b) => (dir > 0 ? a - b : b - a))[0];
    if (next == null) break;
    const r = await probe(next);
    if (!r || r.score <= cur.score) break;
    cur = r;
  }
  return best ? { ...best, tried: [...tried.keys()], failed } : { failed };
}

function fdetState(text) {
  if (!fdet) return;
  const el = $('fontDetectState');
  if (el) el.textContent = text ? '· ' + text : '';
}

function fdetGroup() {
  if (!fdet) return null;
  return fdet.groups.find((g) => g.key === fdet.groupKey) || null;
}

function fdetScoreClass(score) {
  if (score == null) return 'low';
  // from the benchmark: the right family lands at 0.92–0.98, close lookalikes of
  // a typeface Google does not have (DIN …) around 0.86–0.90
  if (score >= 0.92) return 'good';
  if (score >= 0.87) return 'ok';
  return 'low';
}

function fdetActionLabel(cand, targets) {
  if (cand.source === 'google') return 'Download & use';
  if (targets && targets.length > 1) return 'Use for these layers';
  if (targets && targets.length === 1) return 'Use for this layer';
  return 'Use this font';
}

function fdetRenderSource(group) {
  const head = $('fontDetectSourceHead'), host = $('fontDetectSource');
  if (!head || !host) return;
  host.innerHTML = '';
  const items = group && group.samples ? group.samples : [];
  if (!items.length) { head.hidden = true; host.hidden = true; return; }
  let sel = +(fdet && fdet.previewIndex) || 0;
  if (sel < 0 || sel >= items.length) sel = 0;
  if (fdet) fdet.previewIndex = sel;
  items.slice(0, 12).forEach((item, i) => {
    const meta = imgMeta(item.name);
    if (!meta || !meta.url) return;
    const fig = document.createElement('figure');
    if (i === sel) fig.className = 'on';
    const img = document.createElement('img');
    img.src = meta.url;
    img.alt = item.char || item.name;
    img.title = `${item.char || ''} · ${item.name}`;
    const cap = document.createElement('figcaption');
    cap.textContent = item.char || '';
    fig.appendChild(img); fig.appendChild(cap);
    fig.onclick = () => {
      if (!fdet) return;
      fdet.previewIndex = i;
      fdetRenderSource(group);
      fdetRenderList();
    };
    host.appendChild(fig);
  });
  if (items.length > 12) {
    const more = document.createElement('span');
    more.className = 'fd-source-more';
    more.textContent = `+${items.length - 12} more`;
    host.appendChild(more);
  }
  const visible = host.children.length > 0;
  head.hidden = !visible;
  host.hidden = !visible;
}

function fdetRenderList() {
  if (!fdet) return;
  const wrap = $('fontDetectList');
  if (!wrap) return;
  const group = fdetGroup();
  const list = fdet.searchResults && fdet.searchResults.length ? fdet.searchResults
    : fdet.candidates.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12);
  wrap.innerHTML = '';
  if (!list.length) {
    const p = document.createElement('div');
    p.className = 'fd-empty';
    p.textContent = fdet.busy ? 'Comparing shapes…' : (fdet.groups.length
      ? (fdet.googleIndex > 0 ? 'No candidate found — try “Search more fonts” or look a family up by name.' : 'No candidate yet — press “Search fonts” (or look a family up by name).')
      : 'This face has no digit or weekday / month pictures to compare.');
    wrap.appendChild(p);
    return;
  }
  const srcItem = group && group.samples ? (group.samples[fdet.previewIndex || 0] || group.samples[0]) : null;
  const srcMeta = srcItem ? imgMeta(srcItem.name) : null;
  const srcW = Math.max(8, (srcMeta && srcMeta.width) || 160);
  const srcH = Math.max(8, (srcMeta && srcMeta.height) || 64);
  const srcBox = srcItem && srcItem.sig && srcItem.sig.box ? srcItem.sig.box
    : { x0: 0, y0: 0, bw: srcW, bh: srcH };
  const previewText = (srcItem && srcItem.char) || (group ? group.previewText : '');
  // the result is shown larger than the face's thumbnails; render it at 2× the
  // CSS height so it stays sharp when the browser scales the canvas down
  const density = Math.max(1, 144 / srcH);
  const pw = Math.max(8, Math.round(srcW * density));
  const ph = Math.max(8, Math.round(srcH * density));
  const pBox = { x0: srcBox.x0 * density, y0: srcBox.y0 * density, bw: srcBox.bw * density, bh: srcBox.bh * density };
  for (const cand of list) {
    const row = document.createElement('div');
    row.className = 'fd-row' + (fdet.selected === cand.key ? ' on' : '');
    row.onclick = () => { fdet.selected = cand.key; fdetRenderList(); };

    const cv = document.createElement('canvas');
    cv.className = 'fd-preview'; cv.width = pw; cv.height = ph;
    cv.title = 'The candidate drawn in the same shape and position as the selected picture';
    row.appendChild(cv);
    const c = cv.getContext('2d');
    c.fillStyle = '#0b0f14'; c.fillRect(0, 0, cv.width, cv.height);
    const fam = cand.alias || cand.family;
    let drew = false;
    if ((cand.alias || fontFamilies().includes(cand.family)) && previewText) {
      const ink = fdetRenderInk(fam, cand.weight || 400, previewText);
      if (ink && ink.width && ink.height) {
        const fit = Math.min(pBox.bw / ink.width, pBox.bh / ink.height);
        const dw = ink.width * fit, dh = ink.height * fit;
        c.drawImage(ink, pBox.x0 + (pBox.bw - dw) / 2, pBox.y0 + (pBox.bh - dh) / 2, dw, dh);
        drew = true;
      }
    }
    if (!drew) {
      c.fillStyle = '#5b6b80';
      c.font = `${Math.max(12, Math.round(ph / 8))}px -apple-system, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('Preview after download', cv.width / 2, cv.height / 2);
    }

    const main = document.createElement('div');
    main.className = 'fd-main';
    const name = document.createElement('span');
    name.className = 'fd-name'; name.textContent = cand.family;
    const sub = document.createElement('span');
    sub.className = 'fd-sub';
    const bits = [cand.source === 'google' ? 'Google Fonts' : cand.source === 'project' ? 'Project font' : 'Bundled',
      cand.source === 'project' ? (cand.file || '') : (cand.category || ''), cand.weight ? `${cand.weight}` : ''].filter(Boolean);
    sub.textContent = bits.join(' · ');
    main.appendChild(name); main.appendChild(sub);
    row.appendChild(main);

    const score = document.createElement('span');
    score.className = 'fd-score ' + fdetScoreClass(cand.score);
    score.textContent = cand.score == null ? '—' : Math.round(cand.score * 100) + '%';
    score.title = cand.score == null ? 'Not compared yet' : 'Shape similarity to the face\'s own pictures';
    row.appendChild(score);

    const act = document.createElement('div');
    act.className = 'fd-act';
    if (cand.source === 'google') {
      const link = document.createElement('button');
      link.type = 'button'; link.textContent = 'Open';
      link.title = 'Open this family on Google Fonts';
      link.onclick = (ev) => { ev.stopPropagation(); API.openExternal(`https://fonts.google.com/specimen/${encodeURIComponent(String(cand.family).replace(/ /g, '+'))}`); };
      act.appendChild(link);
    }
    const use = document.createElement('button');
    use.type = 'button';
    const group = fdetGroup();
    const targets = group ? (group.targets || (group.element ? [group.element] : [])) : [];
    const target = targets[0] || null;
    const targetFont = target ? (labelKind(target) ? target.labelFont : (target.glyph && target.glyph.font)) : null;
    const usedFont = cand.used || targetFont || (project && project.font);
    // a Google candidate is in use only once it was downloaded for this face (a bundled family of the same name is another file)
    const used = !!(usedFont && (cand.used ? cand.used === usedFont : (cand.source !== 'google' && usedFont === cand.family)));
    use.className = cand.source === 'google' && !used ? 'primary' : '';
    use.textContent = used ? 'Using ✓' : fdetActionLabel(cand, targets);
    use.disabled = used;
    use.onclick = (ev) => { ev.stopPropagation(); fdetUse(cand, use); };
    act.appendChild(use);
    row.appendChild(act);
    wrap.appendChild(row);
  }
}

async function fdetUse(cand, btn) {
  if (!fdet || fdet.applying) return;
  fdet.applying = true;
  const old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = cand.source === 'google' ? 'Downloading…' : 'Applying…'; }
  try {
    let family = cand.family;
    if (cand.source === 'google') {
      const rec = await API.gfontsFace({ family: cand.family, weight: cand.weight || 400, style: cand.style || 'normal' });
      if (!rec || rec.error) throw new Error((rec && rec.error) || 'The font could not be downloaded');
      // the bundled Open Sans is the Bold file: a downloaded Open Sans 400 needs a name of its own
      const bundled = BUNDLED_FONTS.some((f) => f.family === rec.family);
      if (bundled || (customFonts.some((f) => f.family === rec.family && f.name !== rec.name))) {
        rec.family = `${rec.family} ${cand.weight || 400}${(cand.style || 'normal') === 'italic' ? ' Italic' : ''}`;
      }
      const entry = await registerCustomFont(rec);
      if (!entry || !fontCache.has(entry.family)) throw new Error('The downloaded font could not be loaded');
      family = entry.family;
    }
    pushHistory();
    const group = fdetGroup();
    const targets = group ? (group.targets || (group.element ? [group.element] : [])) : [];
    let scope = 'the face';
    if (targets.length) {
      for (const target of targets) {
        if (labelKind(target)) {
          target.labelFont = family;
          if (!importedLabels(target)) target.glyph = { ...(target.glyph || {}), font: family };
        } else {
          target.glyph = { ...(target.glyph || {}), font: family };
        }
      }
      scope = targets.length === 1 ? `“${targets[0].name || 'this component'}”` : `${targets.length} layers`;
    } else {
      useGlyphFont(family);
    }
    fontSelFamily = family;
    cand.used = family;
    setDirty(true);
    const langs = extraLanguages().length && (!targets.length || targets.some((t) => labelKind(t)));
    status(`“${family}” is now the font for ${scope}.${langs ? ' Press “Redraw translations” to draw the translated names with it.' : ''}`);
    if (btn) { btn.textContent = 'Using ✓'; btn.classList.remove('primary'); }
    $('fontDetectRedraw').hidden = !langs;
    fdetRenderList();
    buildFontList(); renderFontPreview(); refreshPanels(); render(); scheduleCode();
  } catch (err) {
    status('Could not get the font: ' + (err && err.message ? err.message : err), true);
    if (btn) { btn.disabled = false; btn.textContent = old; }
  } finally {
    fdet.applying = false;
  }
}

function fdetSearch(value) {
  if (!fdet) return;
  const q = String(value || '').trim().toLowerCase();
  if (!q || !fdet.catalog) { fdet.searchResults = null; fdetRenderList(); return; }
  const local = new Set(customFonts.map((f) => f.family.toLowerCase()));
  const hits = [];
  for (const f of fdet.catalog) {
    if (!f.family.toLowerCase().includes(q)) continue;
    if (local.has(f.family.toLowerCase())) continue;
    hits.push({
      key: `search:${f.family}`, family: f.family, source: 'google', category: f.category,
      weight: fdetFirstWeight(f), score: null,
    });
    if (hits.length >= 15) break;
  }
  fdet.searchResults = hits;
  fdetRenderList();
}

async function fdetScanLocal(group, token) {
  fdetState('Trying the bundled and project fonts…');
  const list = fdetLocal();
  for (let i = 0; i < list.length; i++) {
    if (!fdet || token !== fdet.token) return;
    const cand = list[i];
    if (!(await ensureFont(cand.family))) continue;
    const score = await fdetGroupScore(group, cand.family, cand.weight || 400);
    fdet.candidates.push({ ...cand, key: `local:${cand.family}`, score, alias: cand.family });
    if (i % 4 === 0) fdetRenderList();
  }
  fdet.localDone = true;
  fdetRenderList();
}

// The letters requested from Google. Latin names use the shared scan set that
// core/gfonts.js asks for by default, so one tiny download per family and weight
// serves every face; other scripts (Cyrillic, Greek …) ask for their own letters.
function fdetScanText(group) {
  const chars = [...new Set([...((group && group.samples) || []).map((s) => s.char).join('')])]
    .filter((c) => c && c.codePointAt(0) > 32);
  if (chars.every((c) => c.codePointAt(0) <= 0x24F)) return undefined;
  return '0123456789' + chars.join('');
}

const fdetYield = () => new Promise((r) => setTimeout(r, 0));

async function fdetScanGoogle(group, token, families) {
  const order = families;
  const scanText = fdetScanText(group);
  let done = 0, failed = 0;
  const total = order.length;
  const limit = 6;
  let at = 0;
  const alive = () => !!fdet && token === fdet.token;
  const worker = async () => {
    while (at < total) {
      const my = at++;
      if (!alive()) return;
      const f = order[my];
      const r = await fdetScoreFamily(group, f, scanText, alive, f.startWeight);
      if (!alive()) return;
      failed += r.failed || 0;
      if (r.alias) {
        const best = {
          key: `google:${f.family}`, family: f.family, source: 'google', category: f.category,
          weight: r.weight, alias: r.alias, style: r.style, tried: r.tried, indexScore: f.indexScore,
        };
        best.score = fdetBlend(best, r.score);
        const old = fdet.candidates.findIndex((c) => c.key === best.key);
        if (old >= 0) fdet.candidates[old] = best; else fdet.candidates.push(best);
        done++;
        fdetState(`Comparing Google Fonts… ${done} of ${total}`);
        if (done % 5 === 0) fdetRenderList();
      }
      await fdetYield();   // scoring is synchronous: let the dialog repaint between families
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, total) }, worker));
  if (!alive()) return;
  fdetState(`Compared ${done} Google font${done === 1 ? '' : 's'}${failed ? ` (${failed} download${failed === 1 ? '' : 's'} failed)` : ''}`);
  await fdetRefineWeights(group, token);
  fdetRenderList();
}

// The names were guessed with a plain sans. Read again with the winning font
// (a slab or a script face reads very differently); when that changes what the
// pictures are thought to say, the strongest candidates are scored again.
async function fdetRecheckLanguage(group, token) {
  const ng = fdetNames(group);
  if (!ng || ng.kind === 'digits' || ng.userPicked || !ng.samples || !ng.samples.length) return;
  const ranked = fdet.candidates.filter((c) => c.alias).sort((a, b) => (b.score || 0) - (a.score || 0));
  if (!ranked.length) return;
  const g2 = await fdetGuessLanguage(ng, { family: ranked[0].alias, weight: ranked[0].weight });
  if (!g2 || token !== fdet.token) return;
  const before = ng.samples.map((x) => x.char).join('|');
  const after = fdetNamesFor(ng, g2.code, g2.form, g2.caseMode).join('|');
  if (before === after) return;
  ng.lang = g2.code; ng.form = g2.form; ng.caseMode = g2.caseMode; ng.guessed = g2;
  fdetApplyLanguage(ng);
  fdetState('Re-reading the names with the best match…');
  for (const c of ranked.slice(0, 40)) {
    if (token !== fdet.token) return;
    c.score = fdetBlend(c, await fdetGroupScore(group, c.alias, c.weight || 400));
    await fdetYield();
  }
  fdetBuildLanguageSelect();
  fdetShowSamples(group);
}

// The weight walk stops at the first step that does not help; for the strongest
// candidates the untried weights right next to the winner are checked too.
async function fdetRefineWeights(group, token) {
  if (!fdet) return;
  const scanText = fdetScanText(group);
  const top = fdet.candidates.filter((c) => c.source === 'google').sort((a, b) => b.score - a.score).slice(0, 12);
  for (const cand of top) {
    if (cand.score >= 0.97) continue;
    const family = fdet.catalog && fdet.catalog.find((f) => f.family === cand.family);
    if (!family) continue;
    const all = fdetWeights(family), at = all.indexOf(cand.weight), tried = new Set(cand.tried || [cand.weight]);
    const keys = [all[at - 1], all[at + 1]].filter((w) => w != null && !tried.has(w));
    for (const weight of keys) {
      if (!fdet || token !== fdet.token) return;
      try {
        const rec = await API.gfontsSubset({ family: cand.family, weight, text: scanText });
        if (!rec || rec.error) continue;
        const alias = await fdetProbeFont(rec);
        if (!alias) continue;
        const score = await fdetGroupScore(group, alias, weight);
        if (score > (cand.detail != null ? cand.detail : cand.score)) { cand.score = fdetBlend(cand, score); cand.weight = weight; cand.alias = alias; cand.style = rec.style || 'normal'; }
      } catch (e) { /* a weight that cannot be fetched is simply not tried */ }
    }
  }
}

// Every probed subset is a FontFace in document.fonts; hundreds of them slow
// down all later text layout. Keep only the ones the list still shows.
function fdetReleaseProbes(keep = 40) {
  if (!fdet) return;
  const shown = new Set(fdet.candidates.filter((c) => c.source === 'google').sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, keep).map((c) => c.alias));
  for (const [key, p] of fdetProbe) {
    if (shown.has(p.alias)) continue;
    try { document.fonts.delete(p.ff); } catch (e) { /* already gone */ }
    fdetProbe.delete(key);
  }
  for (const c of fdet.candidates) if (c.source === 'google' && !shown.has(c.alias)) c.alias = null;
}

function fdetShowSamples(group) {
  if (!group) return;
  if (!group.samples || !group.samples.length) {
    $('fontDetectHint').textContent = 'Those pictures could not be read. They may be artwork with no transparent letters.';
    return;
  }
  const guess = fdetNames(group).guessed;
  const guessText = guess
    ? ` The pictures look like ${(zeppLanguage(guess.code) || { label: guess.code }).label}${guess.form === 'long' ? ' full' : ' short'} names in ${guess.caseMode === 'upper' ? 'UPPERCASE' : guess.caseMode === 'lower' ? 'lowercase' : guess.caseMode === 'capitalize' ? 'Capitalized' : 'as-generated'} case — change the pickers if that is wrong.`
    : '';
  $('fontDetectHint').textContent = group.items.length > group.samples.length
    ? `${group.items.length - group.samples.length} picture${group.items.length - group.samples.length === 1 ? ' was' : 's were'} too irregular to compare; the rest are used.${guessText}`
    : `${group.samples.length} of the face's own pictures are compared with the same names drawn in each candidate font.${guessText}`;
}

async function fdetPrepareGroup() {
  if (!fdet) return;
  const group = fdetGroup();
  if (!group) return;
  $('fontDetectMore').hidden = true;
  $('fontDetectStart').disabled = true;
  $('fontDetectStart').textContent = 'Reading pictures…';
  fdetState('');
  fdet.candidates = [];
  fdetRenderList();
  try {
    if (!group.samples) await fdetLoadSamples(group);
    fdetBuildLanguageSelect();
    fdetRenderSource(group);
    fdetShowSamples(group);
  } catch (e) {
    $('fontDetectHint').textContent = 'Those pictures could not be read.';
  } finally {
    if (fdet) {
      const ready = !!(group.samples && group.samples.length);
      $('fontDetectStart').disabled = !ready;
      $('fontDetectStart').textContent = ready ? 'Search fonts' : 'No pictures';
      fdetRenderList();
    }
  }
}

async function fdetRunGroup({ more = false } = {}) {
  if (!fdet || fdet.busy) return;
  const group = fdetGroup();
  if (!group) return;
  if (!more) {
    fdet.candidates = []; fdet.searchResults = null; fdet.googleIndex = 0;
    fdet.localDone = false; fdet.selected = null;
  }
  fdet.busy = true;
  const token = ++fdet.token;
  $('fontDetectMore').hidden = true;
  $('fontDetectStart').disabled = true;
  $('fontDetectStart').textContent = 'Searching…';
  fdetRenderList();
  try {
    fdetState('Reading the face\'s pictures…');
    if (!group.samples) await fdetLoadSamples(group);
    if (token !== fdet.token) return;
    fdetBuildLanguageSelect();
    fdetRenderSource(group);
    fdetShowSamples(group);
    if (!group.samples.length) {
      fdetState('');
      fdet.busy = false; fdetRenderList(); return;
    }
    if (!fdet.localDone) await fdetScanLocal(group, token);
    if (token !== fdet.token) return;
    // the prebuilt index ranks every indexed family in milliseconds; only the
    // closest few are downloaded and compared in detail. Without an index (or for
    // names it cannot read, e.g. Cyrillic) the catalogue is scanned as before.
    if (!more) fdet.indexRanked = await fdetIndexRank(group);
    if (token !== fdet.token) return;
    let families = null;
    try { families = await fdetCatalog(); } catch (e) { if (!fdet.indexRanked) throw e; }
    if (token !== fdet.token) return;
    let order;
    if (fdet.indexRanked) {
      const byName = new Map((families || []).map((f) => [f.family, f]));
      const local = new Set(customFonts.map((f) => f.family.toLowerCase()));
      order = fdet.indexRanked.filter((r) => !local.has(r.family.toLowerCase())).map((r) => ({
        ...(byName.get(r.family) || { family: r.family, category: r.category, fonts: { [r.weight]: {} }, axes: [] }),
        startWeight: r.weight, indexScore: r.score,
      }));
    } else order = fdetGoogleOrder(families);
    const start = fdet.googleIndex;
    const batch = fdet.indexRanked ? (more ? FD_SHORTLIST * 2 : FD_SHORTLIST) : (more ? FD_MORE_BATCH : FD_FIRST_BATCH);
    const end = Math.min(order.length, start + batch);
    fdet.googleIndex = end;
    fdet.moreLeft = order.length - end;
    fdetState(fdet.indexRanked ? `Comparing the ${end - start} closest Google fonts…` : 'Comparing Google Fonts…');
    await fdetScanGoogle(group, token, order.slice(start, end));
    if (token !== fdet.token) return;
    // offline: the index still names the likely families (preview after download)
    if (fdet.indexRanked && !fdet.candidates.some((c) => c.source === 'google')) {
      for (const f of order.slice(start, start + 12)) {
        fdet.candidates.push({ key: `google:${f.family}`, family: f.family, source: 'google', category: f.category, weight: f.startWeight, score: f.indexScore, alias: null });
      }
    }
    await fdetRecheckLanguage(group, token);
    if (token !== fdet.token) return;
    fdetReleaseProbes();
    const bestScore = fdet.candidates.reduce((n, c) => Math.max(n, c.score || 0), 0);
    fdetState(fdet.candidates.length
      ? `${fdet.candidates.length} candidate${fdet.candidates.length === 1 ? '' : 's'}${bestScore && bestScore < 0.87 ? ' · no close match: the face may use a font Google does not have, or drawn letters' : ''}`
      : 'No match found');
    $('fontDetectMore').hidden = !fdet.moreLeft;
    if (fdet.moreLeft) $('fontDetectMore').title = `Try the next ${Math.min(fdet.moreLeft, fdet.indexRanked ? FD_SHORTLIST * 2 : FD_MORE_BATCH)} Google fonts (${fdet.moreLeft} left)`;
  } catch (err) {
    if (token !== fdet.token) return;
    fdetState('');
    $('fontDetectHint').textContent = 'Google Fonts could not be read: ' + (err && err.message ? err.message : err) +
      '. The bundled fonts were still compared; import the font file if you know it.';
    $('fontDetectMore').hidden = true;
  } finally {
    if (fdet && token === fdet.token) {
      fdet.busy = false;
      $('fontDetectStart').disabled = false;
      $('fontDetectStart').textContent = fdet.candidates.length ? 'Search again' : 'Search fonts';
      fdetRenderList();
    }
  }
}

function fdetBuildGroupSelect() {
  const sel = $('fontDetectGroup');
  sel.innerHTML = '';
  for (const g of fdet.groups) {
    const o = document.createElement('option');
    o.value = g.key; o.textContent = g.label;
    sel.appendChild(o);
  }
  sel.value = fdet.groupKey;
  sel.onchange = () => {
    if (!fdet || fdet.busy) return;
    fdet.groupKey = sel.value;
    const g = fdetGroup();
    if (!g) return;
    fdet.previewIndex = 0;
    $('fontDetectSearch').value = '';
    $('fontDetectHint').textContent = '';
    fdetRenderSource(null);
    fdetResetScan();
  };
  fdetBuildLanguageSelect();
}

function fdetBuildLanguageSelect() {
  const sel = $('fontDetectLang');
  const caseSel = $('fontDetectCase');
  const group = fdetNames(fdetGroup());
  sel.innerHTML = '';
  caseSel.innerHTML = '';
  if (!group || group.kind === 'digits') { sel.disabled = true; caseSel.disabled = true; return; }
  const seen = new Set();
  const add = (code, label) => {
    if (!code || seen.has(code)) return;
    seen.add(code);
    const o = document.createElement('option');
    o.value = code; o.textContent = label || code;
    sel.appendChild(o);
  };
  const guess = group.guessed;
  if (guess) {
    const z = zeppLanguage(guess.code);
    add(guess.code, `${z ? z.label : guess.code}${guess.form === 'long' ? ' · full names' : ' · short names'}${guess.shape > 0.8 ? '' : ' (best guess)'}`);
  }
  for (const l of (META && META.languages) || []) add(l.code, l.label);
  if (!seen.has(group.lang)) add(group.lang, group.lang);
  sel.value = group.lang;
  sel.disabled = false;
  sel.onchange = () => {
    if (!fdet || fdet.busy) return;
    const g = fdetNames(fdetGroup());
    if (!g) return;
    g.lang = sel.value; g.userPicked = true;
    fdetApplyLanguage(g);
    fdetResetScan();
  };
  const auto = document.createElement('option');
  auto.value = '__auto'; auto.textContent = 'Auto (guess)';
  caseSel.appendChild(auto);
  for (const c of FD_CASES) {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.label;
    caseSel.appendChild(o);
  }
  caseSel.value = group.caseMode == null ? labelCaseOf(group.element) : group.caseMode;
  caseSel.disabled = false;
  caseSel.onchange = async () => {
    if (!fdet || fdet.busy) return;
    const g = fdetNames(fdetGroup());
    if (!g) return;
    if (caseSel.value === '__auto') {
      g.userPicked = false;
      const guess = await fdetGuessLanguage(g);
      if (guess) { g.lang = guess.code; g.form = guess.form; g.caseMode = guess.caseMode; g.guessed = guess; }
    } else {
      g.caseMode = caseSel.value; g.userPicked = true;
      g.guessed = null;
    }
    fdetApplyLanguage(g);
    fdetResetScan();
  };
}

function fdetResetScan() {
  if (!fdet) return;
  fdet.candidates = []; fdet.searchResults = null; fdet.googleIndex = 0;
  fdet.localDone = false; fdet.selected = null; fdet.moreLeft = 0;
  $('fontDetectMore').hidden = true;
  $('fontDetectStart').textContent = 'Search fonts';
  fdetPrepareGroup();
}

function updateFontDetectButton() {
  const btn = $('projFontDetect');
  if (!btn) return;
  const hasPictures = !!project && elements().some((e) => (labelKind(e) || DIGIT_SET_KINDS.has(e.kind))
    && (((e.images || []).length) || e.src || (e.frames || []).length));
  const chosen = !!project && (project.fontChosen || (project.font && project.font !== DEFAULT_GLYPH_FONT));
  const usable = !!project && !!project.font && fontFamilies().includes(project.font);
  btn.hidden = !project || (chosen && usable) || !hasPictures;
}

function openFontDetect(from) {
  if (!project) return;
  fdet = {
    from: from || 'fonts', groups: fdetGroups(), groupKey: '', candidates: [],
    busy: false, token: 0, catalog: null, searchResults: null, selected: null,
    localDone: false, googleIndex: 0, applying: false, previewIndex: 0,
  };
  $('fontDetectModal').hidden = false;
  $('fontDetectSearch').value = '';
  $('fontDetectHint').textContent = '';
  $('fontDetectMore').hidden = true;
  $('fontDetectRedraw').hidden = true;
  $('fontDetectStart').disabled = true;
  $('fontDetectStart').textContent = 'Reading pictures…';
  fdet.candidates = [];
  fdetRenderList();
  const intro = $('fontDetectIntro');
  if (!fdet.groups.length) {
    intro.textContent = 'This face has no digit or weekday / month pictures to compare. Generate a glyph set, or open a face that came with its own pictures.';
    $('fontDetectGroup').innerHTML = '';
    $('fontDetectGroup').disabled = true;
    $('fontDetectLang').innerHTML = '';
    $('fontDetectLang').disabled = true;
    $('fontDetectCase').innerHTML = '';
    $('fontDetectCase').disabled = true;
    fdetRenderSource(null);
    fdetState('');
    $('fontDetectStart').disabled = true;
    $('fontDetectStart').textContent = 'No pictures';
    fdetRenderList();
    return;
  }
  $('fontDetectGroup').disabled = false;
  intro.textContent = 'The detector compares the face\'s own pictures with the same names drawn in each candidate font: the bundled fonts, then the 1,000 most popular Google Fonts families, ranked offline from a built-in index. Only the closest few are fetched (a tiny subset) to compare in detail, and the full font when you choose it.';
  fdet.groupKey = (fdet.groups.find((g) => g.kind === 'all') || fdet.groups.find((g) => g.kind === 'week')
    || fdet.groups.find((g) => g.kind === 'month') || fdet.groups[0]).key;
  fdetBuildGroupSelect();
  fdetPrepareGroup();
}

$('fontDetect').onclick = () => openFontDetect('fonts');
$('projFontDetect').onclick = () => openFontDetect('fonts');
$('trFontInfoDetect').onclick = () => { $('trFontInfo').hidden = true; openFontDetect('translations'); };
if ($('i18nDetect')) $('i18nDetect').onclick = () => openFontDetect('translations');
$('fontDetectClose').onclick = () => { $('fontDetectModal').hidden = true; if (fdet) { fdet.token++; fdet.busy = false; } };
$('fontDetectRedraw').onclick = async () => {
  if (!project || !extraLanguages().length) return;
  if (!trDraft) trDraft = trClone();
  $('fontDetectModal').hidden = true;
  await applyTranslations();
};
$('fontDetectMore').onclick = () => { if (fdet && !fdet.busy) fdetRunGroup({ more: true }); };
$('fontDetectStart').onclick = () => { if (fdet && !fdet.busy) fdetRunGroup(); };
let fdetSearchTimer = null;
$('fontDetectSearch').oninput = (ev) => {
  clearTimeout(fdetSearchTimer);
  const v = ev.target.value;
  fdetSearchTimer = setTimeout(() => fdetSearch(v), 220);
};
