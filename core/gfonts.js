'use strict';
// Google Fonts, for the “detect the font of an imported face” feature.
//
// The app needs two very different shapes of the same data:
//   * the catalogue (family, category, weights, popularity) for the matcher, cached for a month;
//   * a tiny subset of a family (only the letters the detector compares) while it looks for a match,
//     then the full font file when the user picks one.
//
// Both font requests go through Google's public CSS API. Asking with a plain
// desktop user agent makes it answer with .ttf files, which is what the editor
// (and a watch's Text layers) can use directly. Nothing here needs an API key.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CATALOG_URL = 'https://fonts.google.com/metadata/fonts';
const CSS_URL = 'https://fonts.googleapis.com/css2';
const FONT_HOST = 'fonts.gstatic.com';
const USER_AGENT = 'curl/8.0';   // Google's CSS API answers with plain .ttf for this one
const CATALOG_MAX_AGE = 30 * 24 * 60 * 60 * 1000;   // a month
const REQUEST_TIMEOUT = 30000;

// The letters the detector compares. One fixed text means the tiny subset of a
// family is downloaded once and reused for every face that needs it.
const SCAN_TEXT = [
  '0123456789:.,%°/-+ ',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß',
  'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
  'ĀāĂăĄąĆćČčĎďĐđĒēĔĕĖėĘęĚěĞğĪīĬĭĮįİıŁłŃńŅņŇňŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŪūŬŭŮůŰűŲųŸŹźŻżŽžȘșȚț',
].join('');

function cacheRoot(userData) {
  return path.join(userData, 'google-fonts');
}
function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* the write below reports a real problem */ }
}
function hash(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}
function safeName(s) {
  return String(s || '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'font';
}

async function fetchText(url, { timeout = REQUEST_TIMEOUT } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}
async function fetchBuffer(url, { timeout = REQUEST_TIMEOUT } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(timer); }
}

// A compact catalogue: the matcher needs a family's shape hints and popularity,
// not the whole 2.7 MB document it arrives in.
function compactCatalog(raw) {
  const list = Array.isArray(raw && raw.familyMetadataList) ? raw.familyMetadataList : [];
  return list
    .filter((f) => f && f.family)
    .map((f) => ({
      family: f.family,
      category: f.category || 'Sans Serif',
      stroke: f.stroke || f.category || '',
      classifications: Array.isArray(f.classifications) ? f.classifications : [],
      popularity: Number.isFinite(+f.popularity) ? +f.popularity : 99999,
      defaultSort: Number.isFinite(+f.defaultSort) ? +f.defaultSort : 99999,
      subsets: Array.isArray(f.subsets) ? f.subsets : [],
      fonts: f.fonts || {},
      axes: Array.isArray(f.axes) ? f.axes : [],
      isBrandFont: !!f.isBrandFont,
    }))
    .sort((a, b) => a.popularity - b.popularity);
}

async function catalog(userData, { force = false } = {}) {
  const dir = cacheRoot(userData);
  const file = path.join(dir, 'catalog.json');
  ensureDir(dir);
  let cached = null;
  try {
    const st = fs.statSync(file);
    cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!force && cached && Date.now() - (+cached.at || 0) < CATALOG_MAX_AGE && Array.isArray(cached.families)) {
      return { families: cached.families, cached: true, stale: false, at: cached.at };
    }
  } catch (e) { cached = null; }
  try {
    const raw = JSON.parse(await fetchText(CATALOG_URL));
    const families = compactCatalog(raw);
    const at = Date.now();
    try { fs.writeFileSync(file, JSON.stringify({ at, families })); } catch (e) { /* cache is optional */ }
    return { families, cached: false, stale: false, at };
  } catch (err) {
    if (cached && Array.isArray(cached.families)) {
      return { families: cached.families, cached: true, stale: true, at: cached.at, error: String(err.message || err) };
    }
    throw new Error('Could not read the Google Fonts catalogue: ' + String(err.message || err));
  }
}

// The first @font-face block in a Google CSS answer, for the weight/style asked
// for (the API returns one per weight when a range is requested).
function parseCss(css, weight, style) {
  const blocks = [];
  const re = /@font-face\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(String(css || '')))) {
    const body = m[1];
    const w = /font-weight\s*:\s*([^;]+);/i.exec(body);
    const s = /font-style\s*:\s*([^;]+);/i.exec(body);
    const src = /url\(\s*['"]?([^'")]+)['"]?\s*\)\s*format\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(body);
    if (!src) continue;
    const wv = w ? String(w[1]).trim() : '400';
    const sv = s ? String(s[1]).trim() : 'normal';
    const wn = /^\d+$/.test(wv) ? +wv : (/(\d+)\s+(\d+)/.test(wv) ? (() => {
      const r = /(\d+)\s+(\d+)/.exec(wv);
      return Math.max(+r[1], Math.min(+r[2], +weight));
    })() : 400);
    blocks.push({ weight: wn, style: sv, url: src[1], format: src[2] });
  }
  if (!blocks.length) return null;
  const wantStyle = style === 'italic' ? 'italic' : 'normal';
  return blocks.find((b) => b.weight === +weight && b.style === wantStyle)
    || blocks.find((b) => b.style === wantStyle)
    || blocks.find((b) => b.weight === +weight)
    || blocks[0];
}

function fontCssUrl(family, weight, style, text) {
  const fam = encodeURIComponent(String(family || '').trim()).replace(/%20/g, '+');
  const wght = Math.max(1, Math.min(1000, Math.round(+weight || 400)));
  const ital = style === 'italic' ? 'ital,wght@1,' + wght : 'wght@' + wght;
  let url = `${CSS_URL}?family=${fam}:${ital}&display=swap`;
  if (text) url += `&text=${encodeURIComponent(text)}`;
  return url;
}

// A tiny subset for matching. `text` defaults to the shared scan set.
async function subsetFace(userData, { family, weight = 400, style = 'normal', text = SCAN_TEXT } = {}) {
  const dir = path.join(cacheRoot(userData), 'subsets');
  ensureDir(dir);
  const key = hash(`${family}\u0000${weight}\u0000${style}\u0000${text}\u0000ttf-v2`);
  for (const ext of ['.ttf', '.otf', '.woff2', '.woff']) {
    const file = path.join(dir, key + ext);
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    return { family, weight: +weight, style, ext, format: formatOf(ext), dataBase64: buf.toString('base64'), cached: true };
  }
  const css = await fetchText(fontCssUrl(family, weight, style, text));
  const face = parseCss(css, weight, style);
  if (!face) throw new Error(`Google Fonts returned no font for “${family} ${weight}”`);
  const buf = await fetchBuffer(face.url);
  const ext = extOf(face.format);
  try { fs.writeFileSync(path.join(dir, key + ext), buf); } catch (e) { /* cache is optional */ }
  return {
    family, weight: face.weight || +weight, style: face.style || style,
    ext, format: formatOf(ext), dataBase64: buf.toString('base64'), cached: false, source: face.url,
  };
}

// The whole font file, for keeping in the project. Latin + Latin Extended are
// what the translations table needs, and Google's full TTF carries both.
async function fullFace(userData, { family, weight = 400, style = 'normal' } = {}) {
  const dir = path.join(cacheRoot(userData), 'faces');
  ensureDir(dir);
  const base = `${safeName(family)}-${Math.round(+weight || 400)}${style === 'italic' ? 'i' : ''}`;
  for (const ext of ['.ttf', '.otf', '.woff2', '.woff']) {
    const file = path.join(dir, base + ext);
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    return {
      name: `${safeName(family)}-${Math.round(+weight || 400)}${style === 'italic' ? '-italic' : ''}${ext}`,
      family, weight: +weight, style, ext, format: formatOf(ext), dataBase64: buf.toString('base64'), cached: true,
    };
  }
  const css = await fetchText(fontCssUrl(family, weight, style, ''));
  const face = parseCss(css, weight, style);
  if (!face) throw new Error(`Google Fonts returned no font for “${family} ${weight}”`);
  const buf = await fetchBuffer(face.url);
  const ext = extOf(face.format);
  try { fs.writeFileSync(path.join(dir, base + ext), buf); } catch (e) { /* cache is optional */ }
  return {
    name: `${safeName(family)}-${Math.round(+weight || 400)}${style === 'italic' ? '-italic' : ''}${ext}`,
    family, weight: face.weight || +weight, style: face.style || style,
    ext, format: formatOf(ext), dataBase64: buf.toString('base64'), cached: false, source: face.url,
  };
}

function extOf(format) {
  const f = String(format || '').toLowerCase();
  if (f === 'opentype') return '.otf';
  if (f === 'woff2') return '.woff2';
  if (f === 'woff') return '.woff';
  return '.ttf';
}
function formatOf(ext) {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  if (e === 'otf') return 'opentype';
  if (e === 'woff') return 'woff';
  if (e === 'woff2') return 'woff2';
  return 'truetype';
}

module.exports = { SCAN_TEXT, catalog, subsetFace, fullFace, fontCssUrl, parseCss };
