'use strict';
// electron-builder afterPack hook. With no signing identity, the macOS app is left with the
// linker's broken ad-hoc signature (its resources do not match it), and Apple Silicon then
// refuses it as "damaged". Re-sign it ad hoc and deeply so the bundle is at least consistent.
// Gatekeeper still treats it as unidentified (right-click → Open, or `xattr -cr`); this does not
// replace a Developer ID signature + notarisation. Skipped when a real identity signs the build.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const signing = process.env.CSC_IDENTITY_AUTO_DISCOVERY !== 'false' && (process.env.CSC_LINK || process.env.CSC_NAME);
  if (signing) return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
