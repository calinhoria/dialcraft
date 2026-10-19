'use strict';
// Zepp's compressed image container, the one the Watchface-Maker exports ship in
// (files named `*.png` whose signature is not a PNG). Layout, verified against
// the Maker exports for the Bip 6:
//
//   0    2e 01 01 00                     magic
//   12   uint16 LE  stored row width (the stride)
//   14   uint16 LE  height
//   22   uint16 LE  the picture's real width (<= the stride; the rest of each row is padding)
//   18   "SOMH"                          ("HMOS" stored little-endian)
//   64   256 × RGBA palette entries
//   1088 width × height palette indices  (one byte per pixel)
//
// so a file is always 1088 + width × height bytes. Most Maker artwork is a mask
// (a single colour with a varying alpha), which is why the palette is full of
// (0, 0, 0, a) entries; the byte order is RGB(A), confirmed by the amber/gold
// entries in the DW-6000 cover.
const { PNG } = require('pngjs');

const PAL_OFF = 64;
const PX_OFF = 1088;

const HDR16 = 64;
// two flavours share the magic: type 01 = 8-bit palette (above), type 02 = raw 16-bit RGB565
// pixels right after a 64-byte header (opaque pictures such as backgrounds and labels)
function isSomh(buf) {
  if (!buf || buf.length <= HDR16 || buf[0] !== 0x2e) return false;
  if (buf[1] === 0x01 && buf[2] === 0x01) return buf.length > PX_OFF;
  return buf[2] === 0x02 && (buf.readUInt16LE(16) & 0xff) === 0x10;
}

function decode565(buf) {
  const stride = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  if (!stride || !height || buf.length < HDR16 + stride * height * 2) return null;
  const field = buf.readUInt16LE(22);
  const width = field >= 1 && field <= stride ? field : stride;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = HDR16 + (y * stride + x) * 2;
      const v = buf[o] | (buf[o + 1] << 8);
      const d = (y * width + x) << 2;
      data[d] = ((v >> 11) & 31) * 255 / 31 + 0.5 | 0;
      data[d + 1] = ((v >> 5) & 63) * 255 / 63 + 0.5 | 0;
      data[d + 2] = (v & 31) * 255 / 31 + 0.5 | 0;
      data[d + 3] = 255;
    }
  }
  return { width, height, data };
}

function decodeSomh(buf) {
  if (!isSomh(buf)) return null;
  if (buf[2] === 0x02) return decode565(buf);
  const stride = buf.readUInt16LE(12);          // pixels per stored row
  const height = buf.readUInt16LE(14);
  if (!stride || !height || buf.length < PX_OFF + stride * height) return null;
  // The row is padded: the picture's real width is the uint16 at offset 22 (a 64-wide
  // digit holds a 50-wide picture, a 400-wide background a 390-wide one). The Maker lays
  // digits out and fits backgrounds by that width, so honouring it is what makes a face
  // come out the same size and spacing as in the Maker.
  const field = buf.readUInt16LE(22);
  const width = field >= 1 && field <= stride ? field : stride;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = PAL_OFF + (buf[PX_OFF + y * stride + x] << 2);
      const d = (y * width + x) << 2;
      data[d] = buf[o];
      data[d + 1] = buf[o + 1];
      data[d + 2] = buf[o + 2];
      data[d + 3] = buf[o + 3];
    }
  }
  return { width, height, data };
}

// A decoded container back to a real PNG, which is what the designer works with
// (and what the watch runs — the plain PNGs the designer exports install fine).
// Fully transparent images collapse to a 1×1 pixel: the Maker ships one big
// canvas per layer, and the empty ones only bloat the project.
function somhToPng(buf) {
  const img = decodeSomh(buf);
  if (!img) return null;
  let opaque = false;
  for (let i = 3; i < img.data.length && !opaque; i += 4) if (img.data[i]) opaque = true;
  if (!opaque) {
    const one = new PNG({ width: 1, height: 1 });
    return { width: 1, height: 1, png: PNG.sync.write(one) };
  }
  const png = new PNG({ width: img.width, height: img.height });
  img.data.copy(png.data);
  return { width: img.width, height: img.height, png: PNG.sync.write(png) };
}

module.exports = { isSomh, decodeSomh, somhToPng, PAL_OFF, PX_OFF };
