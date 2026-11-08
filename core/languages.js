'use strict';
// The languages a Zepp OS watch can be set to.
// `id` is what getLanguage() returns on the watch (Zepp's "Multilingual Mapping" table), `code` is the key app.json's `i18n` uses,
// `intl` is the tag the browser's Intl data knows (the weekday / month names come from it) and `label` is for the pickers.
const LANGUAGES = [
  { id: 0, code: 'zh-CN', intl: 'zh-CN', label: 'Chinese (Simplified)' },
  { id: 1, code: 'zh-TW', intl: 'zh-TW', label: 'Chinese (Traditional)' },
  { id: 2, code: 'en-US', intl: 'en-US', label: 'English (US)' },
  { id: 3, code: 'es-ES', intl: 'es-ES', label: 'Spanish' },
  { id: 4, code: 'ru-RU', intl: 'ru-RU', label: 'Russian' },
  { id: 5, code: 'ko-KR', intl: 'ko-KR', label: 'Korean' },
  { id: 6, code: 'fr-FR', intl: 'fr-FR', label: 'French' },
  { id: 7, code: 'de-DE', intl: 'de-DE', label: 'German' },
  { id: 8, code: 'id-ID', intl: 'id-ID', label: 'Indonesian' },
  { id: 9, code: 'pl-PL', intl: 'pl-PL', label: 'Polish' },
  { id: 10, code: 'it-IT', intl: 'it-IT', label: 'Italian' },
  { id: 11, code: 'ja-JP', intl: 'ja-JP', label: 'Japanese' },
  { id: 12, code: 'th-TH', intl: 'th-TH', label: 'Thai' },
  { id: 13, code: 'ar-EG', intl: 'ar-EG', label: 'Arabic' },
  { id: 14, code: 'vi-VN', intl: 'vi-VN', label: 'Vietnamese' },
  { id: 15, code: 'pt-PT', intl: 'pt-PT', label: 'Portuguese (Portugal)' },
  { id: 16, code: 'nl-NL', intl: 'nl-NL', label: 'Dutch' },
  { id: 17, code: 'tr-TR', intl: 'tr-TR', label: 'Turkish' },
  { id: 18, code: 'uk-UA', intl: 'uk-UA', label: 'Ukrainian' },
  { id: 19, code: 'iw-IL', intl: 'he-IL', label: 'Hebrew' },
  { id: 20, code: 'pt-BR', intl: 'pt-BR', label: 'Portuguese (Brazil)' },
  { id: 21, code: 'ro-RO', intl: 'ro-RO', label: 'Romanian' },
  { id: 22, code: 'cs-CZ', intl: 'cs-CZ', label: 'Czech' },
  { id: 23, code: 'el-GR', intl: 'el-GR', label: 'Greek' },
  { id: 24, code: 'sr-RS', intl: 'sr-Latn-RS', label: 'Serbian (Latin)' },
  { id: 25, code: 'ca-ES', intl: 'ca-ES', label: 'Catalan' },
  { id: 26, code: 'fi-FI', intl: 'fi-FI', label: 'Finnish' },
  { id: 27, code: 'nb-NO', intl: 'nb-NO', label: 'Norwegian' },
  { id: 28, code: 'da-DK', intl: 'da-DK', label: 'Danish' },
  { id: 29, code: 'sv-SE', intl: 'sv-SE', label: 'Swedish' },
  { id: 30, code: 'hu-HU', intl: 'hu-HU', label: 'Hungarian' },
  { id: 31, code: 'ms-MY', intl: 'ms-MY', label: 'Malay' },
  { id: 32, code: 'sk-SK', intl: 'sk-SK', label: 'Slovak' },
  { id: 33, code: 'hi-IN', intl: 'hi-IN', label: 'Hindi' },
];

const byCode = (code) => {
  const c = String(code || '').trim();
  return LANGUAGES.find((l) => l.code.toLowerCase() === c.toLowerCase()) || null;
};
// a tag the editor knows (en-GB, he-IL …) → the Zepp entry it belongs to, by language and then by the language part alone
const forTag = (tag) => {
  const t = String(tag || '').trim();
  if (!t) return null;
  const direct = byCode(t) || LANGUAGES.find((l) => l.intl.toLowerCase() === t.toLowerCase());
  if (direct) return direct;
  const base = t.split('-')[0].toLowerCase();
  return LANGUAGES.find((l) => l.code.split('-')[0].toLowerCase() === base) || null;
};
// a watch that reports `id` shows this language
const byId = (id) => LANGUAGES.find((l) => l.id === +id) || null;

module.exports = { LANGUAGES, byCode, forTag, byId };
