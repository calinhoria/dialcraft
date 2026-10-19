'use strict';
// Bundled typefaces used to rasterize glyph images (digits, weekday, separators,
// analog hands, dial). Zeus watchfaces draw PNG glyphs, so a font is a
// design-time asset: we paint the characters into transparent PNGs.
//
// Any font the user imports is registered in the renderer through FontFace and
// kept inside the project folder (fonts/<file>) so a project stays portable.

const BUNDLED_FONTS = [
  { family: 'Orbitron', file: 'assets/fonts/Orbitron-Bold.ttf', cat: 'Clean digital' },
  { family: 'Rajdhani', file: 'assets/fonts/Rajdhani-SemiBold.ttf', cat: 'Clean digital' },
  { family: 'Exo 2', file: 'assets/fonts/Exo2-SemiBold.ttf', cat: 'Clean digital' },
  { family: 'Space Grotesk', file: 'assets/fonts/SpaceGrotesk-Medium.ttf', cat: 'Clean digital' },
  { family: 'Saira Condensed', file: 'assets/fonts/SairaCondensed-SemiBold.ttf', cat: 'Clean digital' },
  { family: 'DSEG7 Classic', file: 'assets/fonts/DSEG7Classic-Bold.ttf', cat: 'Retro LCD' },
  { family: 'DSEG14 Classic', file: 'assets/fonts/DSEG14Classic-Bold.ttf', cat: 'Retro LCD' },
  { family: 'VT323', file: 'assets/fonts/VT323-Regular.ttf', cat: 'Retro LCD' },
  { family: 'Share Tech Mono', file: 'assets/fonts/ShareTechMono-Regular.ttf', cat: 'Retro LCD' },
  { family: 'Major Mono Display', file: 'assets/fonts/MajorMonoDisplay-Regular.ttf', cat: 'Retro LCD' },
  { family: 'Press Start 2P', file: 'assets/fonts/PressStart2P-Regular.ttf', cat: 'Retro LCD' },
  { family: 'Silkscreen', file: 'assets/fonts/Silkscreen-Regular.ttf', cat: 'Retro LCD' },
  { family: 'Doto', file: 'assets/fonts/Doto-Black.ttf', cat: 'Segmented' },
  { family: 'Handjet', file: 'assets/fonts/Handjet-Bold.ttf', cat: 'Segmented' },
  { family: 'Bebas Neue', file: 'assets/fonts/BebasNeue-Regular.ttf', cat: 'Bold sporty' },
  { family: 'Oswald', file: 'assets/fonts/Oswald-SemiBold.ttf', cat: 'Bold sporty' },
  { family: 'Anton', file: 'assets/fonts/Anton-Regular.ttf', cat: 'Bold sporty' },
  { family: 'Barlow Condensed', file: 'assets/fonts/BarlowCondensed-SemiBold.ttf', cat: 'Bold sporty' },
  { family: 'Teko', file: 'assets/fonts/Teko-SemiBold.ttf', cat: 'Bold sporty' },
  { family: 'Cormorant Garamond', file: 'assets/fonts/CormorantGaramond-SemiBold.ttf', cat: 'Elegant' },
  { family: 'Playfair Display', file: 'assets/fonts/PlayfairDisplay-SemiBold.ttf', cat: 'Elegant' },
  { family: 'Cinzel', file: 'assets/fonts/Cinzel-SemiBold.ttf', cat: 'Elegant' },
  { family: 'Marcellus', file: 'assets/fonts/Marcellus-Regular.ttf', cat: 'Elegant' },
  { family: 'Inter', file: 'assets/fonts/Inter-Bold.ttf', cat: 'Minimal' },
  { family: 'Inter Thin', file: 'assets/fonts/Inter-Thin.ttf', cat: 'Minimal' },
  { family: 'Montserrat', file: 'assets/fonts/Montserrat-Bold.ttf', cat: 'Minimal' },
  { family: 'Montserrat Thin', file: 'assets/fonts/Montserrat-Thin.ttf', cat: 'Minimal' },
  { family: 'Poppins', file: 'assets/fonts/Poppins-Regular.ttf', cat: 'Minimal' },
  { family: 'Josefin Sans', file: 'assets/fonts/JosefinSans-SemiBold.ttf', cat: 'Minimal' },
  { family: 'Roboto Condensed', file: 'assets/fonts/RobotoCondensed-Bold.ttf', cat: 'General' },
  { family: 'Roboto Mono', file: 'assets/fonts/RobotoMono-Bold.ttf', cat: 'General' },
  { family: 'Open Sans', file: 'assets/fonts/OpenSans-Bold.ttf', cat: 'General' },
  { family: 'Lato', file: 'assets/fonts/Lato-Bold.ttf', cat: 'General' },
];

// Variable fonts need explicit axis values to look right.
const FONT_VARIATIONS = { Handjet: "'wght' 700, 'ELGR' 1, 'ELSH' 6" };

const FONT_EXTS = ['.ttf', '.otf', '.woff', '.woff2'];

function isFontFile(name) {
  const lower = String(name || '').toLowerCase();
  return FONT_EXTS.some((e) => lower.endsWith(e));
}

function fontFormat(ext) {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  if (e === 'otf') return 'opentype';
  if (e === 'woff') return 'woff';
  if (e === 'woff2') return 'woff2';
  return 'truetype';
}

// "Orbitron-Bold.ttf" -> "Orbitron" (used when the real name table is unreadable)
function guessFamily(fileName) {
  const base = String(fileName || 'Custom font').replace(/\.[a-z0-9]+$/i, '');
  const cleaned = base
    .replace(/[-_]+/g, ' ')
    .replace(/\b(thin|hairline|extralight|ultralight|light|regular|book|normal|medium|semibold|demibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|condensed|narrow|wide|expanded|[0-9]{3})\b.*$/i, '')
    .trim();
  return cleaned || base || 'Custom font';
}

const WIN_PLATFORMS = new Set([0, 3]);

function readNameTable(buf) {
  const out = {};
  if (!buf || buf.length < 12) return out;
  const tag = buf.toString('latin1', 0, 4);
  // wOFF/wOFF2 tables are compressed and ttcf holds several faces: fall back to
  // the file name instead of implementing two more decoders.
  if (tag === 'wOFF' || tag === 'wOF2' || tag === 'ttcf') return out;
  const numTables = buf.readUInt16BE(4);
  let nameOff = 0;
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    if (off + 16 > buf.length) break;
    if (buf.toString('latin1', off, off + 4) === 'name') { nameOff = buf.readUInt32BE(off + 8); break; }
  }
  if (!nameOff || nameOff + 6 > buf.length) return out;
  const count = buf.readUInt16BE(nameOff + 2);
  const strOff = nameOff + buf.readUInt16BE(nameOff + 4);
  const records = [];
  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + i * 12;
    if (r + 12 > buf.length) break;
    records.push({
      platformID: buf.readUInt16BE(r),
      nameID: buf.readUInt16BE(r + 6),
      len: buf.readUInt16BE(r + 8),
      off: buf.readUInt16BE(r + 10),
    });
  }
  const decode = (rec) => {
    const start = strOff + rec.off;
    if (start < 0 || start + rec.len > buf.length) return '';
    const slice = buf.subarray(start, start + rec.len);
    if (WIN_PLATFORMS.has(rec.platformID)) {
      let s = '';
      for (let i = 0; i + 1 < slice.length; i += 2) s += String.fromCharCode(slice.readUInt16BE(i));
      return s;
    }
    return slice.toString('latin1');
  };
  const pick = (ids) => {
    for (const id of ids) {
      const candidates = records.filter((r) => r.nameID === id);
      const rec = candidates.find((r) => WIN_PLATFORMS.has(r.platformID)) || candidates[0];
      if (rec) {
        const v = decode(rec).replace(/\u0000/g, '').trim();
        if (v) return v;
      }
    }
    return '';
  };
  out.family = pick([16, 21, 1, 4]);
  out.subfamily = pick([17, 22, 2]);
  out.full = pick([4, 6]);
  return out;
}

// Which characters a font really draws, from its cmap table (formats 4 and 12,
// the two every TrueType/OpenType font carries). The renderer needs this because
// a canvas silently borrows a missing glyph from a system font — a weekday like
// "SÂMBĂTĂ" in a font without Â/Ă would come out in two typefaces. Returned as
// sorted [first, last] code point ranges, compact enough for the IPC payload.
// WOFF/WOFF2 are compressed and return null (coverage unknown).
function readCmapRanges(buf) {
  if (!buf || buf.length < 12) return null;
  const tag = buf.toString('latin1', 0, 4);
  if (tag === 'wOFF' || tag === 'wOF2' || tag === 'ttcf') return null;
  const numTables = buf.readUInt16BE(4);
  let cmap = 0;
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    if (off + 16 > buf.length) break;
    if (buf.toString('latin1', off, off + 4) === 'cmap') { cmap = buf.readUInt32BE(off + 8); break; }
  }
  if (!cmap || cmap + 4 > buf.length) return null;
  const n = buf.readUInt16BE(cmap + 2);
  // prefer a full-repertoire subtable (format 12), else the BMP one (format 4)
  let best = null;
  for (let i = 0; i < n; i++) {
    const r = cmap + 4 + i * 8;
    if (r + 8 > buf.length) break;
    const platform = buf.readUInt16BE(r), encoding = buf.readUInt16BE(r + 2);
    const sub = cmap + buf.readUInt32BE(r + 4);
    if (sub + 2 > buf.length) continue;
    const format = buf.readUInt16BE(sub);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode || (format !== 4 && format !== 12)) continue;
    if (!best || (format === 12 && best.format !== 12)) best = { format, sub };
  }
  if (!best) return null;
  const ranges = [];
  const { sub } = best;
  try {
    if (best.format === 12) {
      const groups = buf.readUInt32BE(sub + 12);
      for (let i = 0; i < groups; i++) {
        const g = sub + 16 + i * 12;
        const start = buf.readUInt32BE(g), end = buf.readUInt32BE(g + 4), glyph = buf.readUInt32BE(g + 8);
        if (glyph === 0 && start === end) continue;
        ranges.push([start, end]);
      }
    } else {
      const segX2 = buf.readUInt16BE(sub + 6);
      const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, offsets = deltas + segX2;
      for (let i = 0; i < segX2 / 2; i++) {
        const end = buf.readUInt16BE(ends + i * 2), start = buf.readUInt16BE(starts + i * 2);
        const delta = buf.readUInt16BE(deltas + i * 2), roff = buf.readUInt16BE(offsets + i * 2);
        if (start === 0xffff) continue;
        // a code point only counts when it maps to a real glyph (not .notdef)
        let runStart = -1;
        for (let c = start; c <= end; c++) {
          let glyph;
          if (!roff) glyph = (c + delta) & 0xffff;
          else {
            const at = offsets + i * 2 + roff + (c - start) * 2;
            glyph = at + 2 <= buf.length ? buf.readUInt16BE(at) : 0;
            if (glyph) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph && runStart < 0) runStart = c;
          if (!glyph && runStart >= 0) { ranges.push([runStart, c - 1]); runStart = -1; }
        }
        if (runStart >= 0) ranges.push([runStart, end]);
      }
    }
  } catch (e) { return null; }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

function fontInfoFromBuffer(buf, fileName) {
  const fallback = guessFamily(fileName);
  const names = readNameTable(buf);
  return {
    family: names.family || fallback,
    subfamily: names.subfamily || '',
    full: names.full || '',
    guessed: !names.family,
    coverage: readCmapRanges(buf),
  };
}

// Map a device api level (Zepp OS version) to the app.json runtime apiVersion.
function apiVersionFor(osVersion) {
  const v = String(osVersion || '1.0');
  const major = Number(v.split('.')[0]) || 1;
  const minor = Number(v.split('.')[1]) || 0;
  if (major <= 1) return { compatible: '1.0.0', target: '1.0.1', minVersion: '1.0.0' };
  if (major === 2) return { compatible: '2.0.0', target: '2.0.0', minVersion: '2.0.0' };
  if (major === 3) {
    if (minor >= 5) return { compatible: '3.6', target: '3.6', minVersion: '3.6' };
    return { compatible: '3.0.0', target: '3.0.0', minVersion: '3.0.0' };
  }
  return { compatible: '4.0', target: '4.0', minVersion: '4.0' };
}

// The values zeus accepts for --APILevel.
function zeusApiLevel(osVersion) {
  const v = apiVersionFor(osVersion).compatible;
  const major = Number(String(v).split('.')[0]) || 1;
  const minor = Number(String(v).split('.')[1]) || 0;
  if (major <= 1) return '1.0';
  if (major === 2) return '2.0';
  if (major === 3) return minor >= 5 ? '3.5' : '3.0';
  return '4.0';
}

module.exports = {
  BUNDLED_FONTS,
  FONT_VARIATIONS,
  FONT_EXTS,
  isFontFile,
  fontFormat,
  guessFamily,
  fontInfoFromBuffer,
  readCmapRanges,
  apiVersionFor,
  zeusApiLevel,
};
