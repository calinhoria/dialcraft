'use strict';
// Device display masks for the preview.
//
// Generated from the catalog (screen size + shape + corner radius from the
// device list) — round screens become a circle, square screens a rounded
// rectangle with the documented radius, bands a rounded rectangle too. Drop real
// vendor artwork at assets/masks/<target>.svg (same viewBox) to override it.
const { DEVICES } = require('./devices');

function maskSvg(d) {
  const shape = d.shape === 'r'
    ? `<circle cx="${d.w / 2}" cy="${d.h / 2}" r="${Math.min(d.w, d.h) / 2}"/>`
    : `<rect x="0" y="0" width="${d.w}" height="${d.h}" rx="${d.radius}" ry="${d.radius}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.w} ${d.h}" width="${d.w}" height="${d.h}">${shape}</svg>\n`;
}

function maskMeta() {
  const m = {};
  for (const d of DEVICES) m[d.target] = { w: d.w, h: d.h, radius: d.radius, shape: d.shape, name: d.name };
  return m;
}

module.exports = { maskSvg, maskMeta };
