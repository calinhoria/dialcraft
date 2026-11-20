'use strict';
// What the Zepp Console's release form asks for, per language: watch face name, description (up to 400 characters) and the preview, plus one
// English "Review notes" box. Written next to the package in <outDir>/store so the form is copy and paste.
const { LANGUAGES, byCode } = require('./languages');
const { dtLabel } = require('./datatypes');

const DESC_MAX = 400;

function defaultCode(project) {
  const c = project && project.language;
  return byCode(c) ? c : 'en-US';
}

// every language of the face: the default first, then the translations
function storeLanguages(project) {
  const def = defaultCode(project);
  const list = (project && project.i18n && Array.isArray(project.i18n.languages)) ? project.i18n.languages : [];
  return [def, ...list.filter((c) => c !== def && byCode(c))];
}

function labelOf(code) {
  const l = LANGUAGES.find((x) => x.code === code);
  return l ? l.label : code;
}

// { code, label, name, description } for each language; a language with no store text of its own gets the default one
function storeTexts(project) {
  const meta = (project && project.i18n && project.i18n.meta) || {};
  const def = defaultCode(project);
  const out = [];
  for (const code of storeLanguages(project)) {
    const own = code === def;
    const name = (meta.appName && meta.appName[code]) || project.name || 'Watchface';
    const desc = (meta.description && meta.description[code]) || (project.description || '');
    out.push({ code, label: labelOf(code), name, description: String(desc).slice(0, DESC_MAX), translated: own || !!(meta.description && meta.description[code]) });
  }
  return out;
}

// English notes for the reviewer: what the face does, what it reads, what it needs. Built from the layers, so they stay true.
function reviewNotes(project, device) {
  const els = (project.elements || []).filter((e) => e && e.visible !== false && !e.previewOnly);
  const has = (k) => els.some((e) => e.kind === k);
  const types = [...new Set(els.map((e) => e.dataType).filter(Boolean))];
  const slotTypes = [...new Set(els.filter((e) => e.kind === 'EDIT_SLOT').flatMap((e) => (e.optionalTypes || []).map((o) => o.type)))];
  const taps = els.filter((e) => e.kind === 'TAP');
  const aod = els.some((e) => e.show === 'aod' || e.show === 'both');
  const themes = project.themes && Array.isArray(project.themes.list) ? project.themes.list.length : 0;
  const animated = has('IMG_ANIM') || (typeof project.userCode === 'string' && project.userCode.trim());
  const langs = storeLanguages(project);
  const L = [];
  L.push(`${project.name || 'This watch face'} is a watch face made with Dialcraft, a watch face designer for Zepp OS, and built with the Zeus CLI for ${device.name} (${device.w}x${device.h}, ${device.shape === 'r' ? 'round' : 'rounded-rectangle'} screen).`);
  L.push('');
  L.push('- The preview pictures show the face in its normal (non-AOD) state at 10:09:36, in the shape of the screen, with transparent corners.');
  if (types.length) L.push(`- Data it shows, all read from the watch's own sensors: ${types.map((t) => dtLabel(t).replace(/\s*\(.*\)$/, '')).join(', ')}.`);
  if (slotTypes.length) L.push('- It has editable complication slots (long-press the face, then Edit) that let the user choose the data shown.');
  if (taps.length) L.push(`- Tap zones: ${taps.map((t) => t.name || 'tap').join('; ')}.`);
  if (themes) L.push(`- ${themes} colour themes, switched on the watch.`);
  if (animated) L.push('- Contains animation, drawn by the face itself; it stops in always-on mode.');
  L.push(aod ? '- It has its own always-on display (AOD) design.' : '- It does not have its own always-on display design.');
  if (langs.length > 1) L.push(`- Store name and description are provided in ${langs.map(labelOf).join(', ')}; the face follows the watch language.`);
  const net = types.some((t) => /WEATHER|SUN/.test(t));
  L.push(`- The face itself makes no network requests, has no app-side or settings page and stores nothing about the user.${net ? ' Weather and sun times are the values the watch already receives from the Zepp app.' : ''}`);
  L.push('');
  L.push('Thank you for reviewing.');
  return L.join('\n');
}

// the console shows one block per language; this is the text file for the whole form
function storeForm(project, device) {
  const texts = storeTexts(project);
  const L = [];
  L.push(`${project.name || 'Watchface'} - Zepp Console release form`, '');
  for (const t of texts) {
    L.push(`=== ${t.label} (${t.code}) ===`);
    L.push(`Watch Face Name: ${t.name}`);
    L.push(`Watch Face Preview: preview-${device.w}x${device.h}${t.code === defaultCode(project) ? '' : '-' + t.code}.png`);
    L.push(`Watch Face Description (${t.description.length}/${DESC_MAX}):`);
    L.push(t.description, '');
  }
  L.push('=== Review Notes (English) ===');
  L.push(reviewNotes(project, device));
  return L.join('\n') + '\n';
}

module.exports = { storeTexts, reviewNotes, storeForm, storeLanguages, DESC_MAX };
