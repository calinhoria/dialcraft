'use strict';
// The watchface app icon.
//
// Zepp's design guide (docs/designs/visual/icons) specifies the app icon as a
// 248×248 PNG: a circular graphic with a blank, transparent 4px safe area on
// every side (the content itself is 240×240).
//
// It also has to exist. `zeus build` reads the file named by `app.json`
// (`app.icon` = "images/preview.png", resolved inside the target's asset folder)
// and hands it to zpm, which moves it aside to "<name>_origin" before resizing.
// If the file is missing, that move fails, the error handler tries to move the
// (also missing) "<name>_origin" back and *that* ENOENT is what surfaces:
//
//   ENOENT: no such file or directory, lstat '…/assets/images/preview.png_origin'
//   build failed: zeus build exited with code 7
//
// So the export always writes an icon, even when no canvas render was supplied.
const { PNG } = require('pngjs');

const SIZE = 248;               // final icon, per the design guide
const SAFE = 4;                 // transparent safe area around the disc
const DISC = SIZE - SAFE * 2;   // 240 — the visible circle

function decode(buf) {
  if (!buf || !buf.length) return null;
  try {
    const png = PNG.sync.read(buf);
    return png && png.width && png.height ? png : null;
  } catch (e) {
    return null;
  }
}

// Area-average resample of a source rectangle, premultiplied so transparent
// pixels in the source do not darken the edges of the disc.
function resample(src, sx, sy, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const iy0 = Math.max(0, Math.floor(sy + (y * sh) / dh));
    const iy1 = Math.min(src.height, Math.ceil(sy + ((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const ix0 = Math.max(0, Math.floor(sx + (x * sw) / dw));
      const ix1 = Math.min(src.width, Math.ceil(sx + ((x + 1) * sw) / dw));
      let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
      for (let py = iy0; py < iy1; py++) {
        for (let px = ix0; px < ix1; px++) {
          const i = (src.width * py + px) << 2;
          const a = src.data[i + 3];
          const w = a / 255;
          sr += src.data[i] * w; sg += src.data[i + 1] * w; sb += src.data[i + 2] * w;
          sa += a; n++;
        }
      }
      const o = (dw * y + x) << 2;
      if (!n || sa < 0.5) { out[o + 3] = 0; continue; }
      const scale = sa / 255;
      out[o] = Math.min(255, Math.round(sr / scale));
      out[o + 1] = Math.min(255, Math.round(sg / scale));
      out[o + 2] = Math.min(255, Math.round(sb / scale));
      out[o + 3] = Math.min(255, Math.round(sa / n));
    }
  }
  return { data: out, width: dw, height: dh };
}

// Circular alpha mask over a DISC×DISC buffer (1px soft edge).
function circleMask(img) {
  const r = DISC / 2;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
      const cov = Math.max(0, Math.min(1, r + 0.5 - d));
      const i = (img.width * y + x) << 2;
      img.data[i + 3] = Math.round(img.data[i + 3] * cov);
    }
  }
  return img;
}

function at(img, x, y) { return (img.width * y + x) << 2; }

function disc(img, cx, cy, radius, color) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius)), x1 = Math.min(img.width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(img.height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d2 > r2) continue;
      const i = at(img, x, y);
      img.data[i] = color[0]; img.data[i + 1] = color[1]; img.data[i + 2] = color[2];
      img.data[i + 3] = color[3] == null ? 255 : color[3];
    }
  }
}

function segment(img, x0, y0, x1, y1, width, color) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len));
  for (let s = 0; s <= steps; s++) {
    disc(img, x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, width / 2, color);
  }
}

function ring(img, cx, cy, radius, width, color) {
  for (let a = 0; a < 360; a += 0.4) {
    const rad = (a * Math.PI) / 180;
    disc(img, cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius, width / 2, color);
  }
}

// A recognisable placeholder: dark blue dial, white hands, 12/3/6/9 marks.
// Deliberately not solid black, per the design guide.
function fallbackDisc() {
  const img = { data: Buffer.alloc(DISC * DISC * 4), width: DISC, height: DISC };
  const c = DISC / 2;
  disc(img, c, c, c, [26, 34, 48, 255]);
  ring(img, c, c, c - 1, 3, [71, 85, 105, 255]);
  for (let a = 0; a < 360; a += 30) {
    const rad = ((a - 90) * Math.PI) / 180;
    const big = a % 90 === 0;
    disc(img, c + Math.cos(rad) * (c - 26), c + Math.sin(rad) * (c - 26), big ? 6 : 3, [148, 163, 184, 255]);
  }
  segment(img, c, c, c, c - 62, 11, [241, 245, 249, 255]);              // hour hand → 12
  segment(img, c, c, c + 74 * Math.cos(Math.PI / 6), c - 74 * Math.sin(Math.PI / 6), 8, [241, 245, 249, 255]); // minute → ~1
  disc(img, c, c, 8, [59, 130, 246, 255]);
  return img;
}

function compose(content) {
  const icon = { data: Buffer.alloc(SIZE * SIZE * 4), width: SIZE, height: SIZE };
  for (let y = 0; y < DISC; y++) {
    const dst = ((y + SAFE) * SIZE + SAFE) << 2;
    content.data.copy(icon.data, dst, (y * DISC) << 2, ((y + 1) * DISC) << 2);
  }
  return PNG.sync.write(icon);
}

// App icon PNG buffer. `preview` is a rendered watchface image (any size); when
// it is missing or unreadable the placeholder dial is used instead.
function appIconPng(preview) {
  const src = decode(preview);
  if (!src) return compose(circleMask(fallbackDisc()));
  // centre-crop to a square, then scale into the disc
  const side = Math.min(src.width, src.height);
  const square = resample(src, (src.width - side) / 2, (src.height - side) / 2, side, side, DISC, DISC);
  return compose(circleMask(square));
}

module.exports = { appIconPng, SIZE, SAFE, DISC };
