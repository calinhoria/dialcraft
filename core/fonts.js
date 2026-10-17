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

function fontInfoFromBuffer(buf, fileName) {
  const fallback = guessFamily(fileName);
  const names = readNameTable(buf);
  return {
    family: names.family || fallback,
    subfamily: names.subfamily || '',
    full: names.full || '',
    guessed: !names.family,
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
  apiVersionFor,
  zeusApiLevel,
};
