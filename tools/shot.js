'use strict';
// UI screenshot helper for development.
//
// It renders index.html in an OFFSCREEN window (so the app can be driven and
// captured without stealing the screen) and writes one PNG per step:
//
//   SHOTS=out-%d.png STEP='[{"script":"openFontModal()","wait":800},{}]' \
//     node_modules/.bin/electron tools/shot.js
//
// STEP is a JSON array; each entry may carry `script` (run inside the renderer,
// `await`ed) and `wait` (ms before the capture).
//
// Caveat: capture needs a working compositor. On a headless/occluded session
// Electron may hand back the first frame forever — the smoke test
// (`npm run smoke`) does the layout assertions that matter in CI.
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

require(path.join(__dirname, '..', 'main.js'));

const W = +(process.env.W || 1440);
const H = +(process.env.H || 940);
const SHOTS = process.env.SHOTS || 'shot.png';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Offscreen windows emit every composed frame; collect until the stream goes
// quiet and keep the newest one.
function grabPaint(win, timeout = 4000) {
  return new Promise((resolve) => {
    let newest = null;
    let settle = null;
    const quiet = +(process.env.QUIET || 900);
    const onPaint = (_e, _dirty, image) => {
      if (!image || image.isEmpty()) return;
      newest = image;
      clearTimeout(settle);
      settle = setTimeout(() => { win.webContents.off('paint', onPaint); resolve(newest); }, quiet);
    };
    win.webContents.on('paint', onPaint);
    try { win.webContents.invalidate(); } catch (e) { /* ignore */ }
    setTimeout(() => { win.webContents.off('paint', onPaint); resolve(newest); }, timeout);
  });
}

app.whenReady().then(async () => {
  setTimeout(() => { console.error('shot: hard timeout'); app.exit(2); }, 120000);
  const win = new BrowserWindow({
    width: W, height: H, show: false, backgroundColor: '#0e1015',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      offscreen: true, backgroundThrottling: false,
    },
  });
  win.webContents.setFrameRate(30);
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  const run = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`, true);

  let steps = [];
  try { steps = process.env.STEP ? JSON.parse(process.env.STEP) : [{}]; } catch (e) { console.error('bad STEP json:', e.message); app.exit(2); return; }

  await sleep(1600); // init(): metadata, fonts, masks
  let i = 0;
  for (const step of steps) {
    i++;
    if (step.script) {
      try {
        const r = await run(step.script);
        if (r && typeof r === 'object') console.log('step', i, JSON.stringify(r).slice(0, 300));
      } catch (e) { console.error('step', i, 'failed:', e.message); }
    }
    await sleep(step.wait || 700);
    const target = SHOTS.includes('%d') ? SHOTS.replace('%d', String(i)) : SHOTS;
    if (!target || target === 'none') continue;
    const img = await grabPaint(win, step.timeout || 4000);
    if (img) { fs.writeFileSync(target, img.toPNG()); console.log('wrote', target, `${img.getSize().width}x${img.getSize().height}`); }
    else console.error('capture failed for', target);
  }
  app.exit(0);
}).catch((e) => { console.error('shot failed:', e && e.message); app.exit(1); });
