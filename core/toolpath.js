'use strict';
// Where to look for node / npx / zeus when the app was started from the Dock or Finder.
//
// A macOS / Linux GUI app does not inherit the PATH of the user's shell, so `npx` (Homebrew, nvm,
// Volta, fnm, asdf …) is not found and the Zeus build fails with "spawn npx ENOENT". The login
// shell's PATH is asked once, and the usual install folders are added after it. Pure: the caller
// passes the filesystem lookups in, so it can be tested.
const path = require('path');

function toolPath({ platform = process.platform, basePath = '', shellPath = '', home = '', exists = () => false, list = () => [] } = {}) {
  if (platform === 'win32') return basePath;
  const sep = ':';
  const seen = new Set();
  const out = [];
  const add = (p) => { if (p && !seen.has(p)) { seen.add(p); out.push(p); } };
  for (const p of String(basePath).split(sep)) add(p);
  for (const p of String(shellPath).split(sep)) add(p);
  const fixed = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin', '/usr/bin', '/bin'];
  const homeDirs = ['.volta/bin', '.fnm/aliases/default/bin', '.asdf/shims', '.local/bin', '.npm-global/bin', '.yarn/bin', 'n/bin'];
  for (const p of fixed) if (exists(p)) add(p);
  if (home) {
    for (const rel of homeDirs) { const p = path.join(home, rel); if (exists(p)) add(p); }
    // nvm keeps one folder per installed Node version: newest first
    const nvm = path.join(home, '.nvm', 'versions', 'node');
    let versions = [];
    try { versions = list(nvm); } catch (e) { versions = []; }
    versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versions) { const p = path.join(nvm, v, 'bin'); if (exists(p)) add(p); }
  }
  return out.join(sep);
}
module.exports = { toolPath };
