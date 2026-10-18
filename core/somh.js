'use strict';
// Zepp's compressed image container, the one the Watchface-Maker exports ship in
// (files named `*.png` whose signature is not a PNG). Layout, verified against
// the Maker exports for the Bip 6:
//
//   0    2e 01 01 00                     magic
//   12   uint16 LE  width
//   14   uint16 LE  height
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

function isSomh(buf) {
  return !!buf && buf.length > PX_OFF && buf[0] === 0x2e && buf[1] === 0x01 && buf[2] === 0x01;
}

function decodeSomh(buf) {
  if (!isSomh(buf)) return null;
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  if (!width || !height || buf.length < PX_OFF + width * height) return null;
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = PAL_OFF + (buf[PX_OFF + i] << 2);
    const d = i << 2;
    data[d] = buf[o];
    data[d + 1] = buf[o + 1];
    data[d + 2] = buf[o + 2];
    data[d + 3] = buf[o + 3];
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
