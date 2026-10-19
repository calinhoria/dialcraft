'use strict';
// App updates from GitHub releases (electron-updater), kept independent of Electron so it can be tested:
// main.js hands in the real autoUpdater, the tests hand in a fake one.
//
// What can update itself in place depends on the platform and on how the app was installed:
//   Windows installer (NSIS) ........ auto   (downloads, then restarts into the new version)
//   Linux AppImage .................. auto
//   macOS ........................... manual (the builds are unsigned: macOS will not swap a running unsigned app)
//   Windows portable, Linux .deb .... manual (no installer to update through)
//   a dev run (not packaged) ........ off
// "manual" still checks and tells you there is a new version; the button opens its release page.

function installMode({ platform, env = {}, isPackaged }) {
  if (!isPackaged) return 'off';
  if (platform === 'win32') return env.PORTABLE_EXECUTABLE_FILE ? 'manual' : 'auto';
  if (platform === 'linux') return env.APPIMAGE ? 'auto' : 'manual';
  return 'manual';
}

function releaseUrl(repo, version) {
  return `https://github.com/${repo}/releases/tag/v${String(version).replace(/^v/, '')}`;
}

// "0.2.5" < "0.2.10"; a missing part counts as 0; a pre-release suffix sorts before the release
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre] = String(v).replace(/^v/, '').split('-');
    return { n: core.split('.').map((x) => parseInt(x, 10) || 0), pre: pre || '' };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.n.length, y.n.length); i++) {
    const d = (x.n[i] || 0) - (y.n[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

function createUpdater({ autoUpdater, currentVersion, platform, env, isPackaged, repo, openExternal, send, settings }) {
  const mode = installMode({ platform, env, isPackaged });
  let state = { status: 'idle', current: currentVersion, mode, version: null, progress: 0, error: null, url: null, notes: '' };
  let manualCheck = false;
  const set = (patch) => { state = { ...state, ...patch }; send({ ...state }); };

  if (autoUpdater && mode !== 'off') {
    autoUpdater.autoDownload = false;            // the wearer decides; nothing downloads in the background
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = true;          // the releases are published as pre-releases while this is a beta
    autoUpdater.allowDowngrade = false;
    autoUpdater.on('checking-for-update', () => set({ status: 'checking', error: null }));
    autoUpdater.on('update-available', (info) => {
      const v = info && info.version;
      if (!v || compareVersions(v, currentVersion) <= 0) { set({ status: 'none', version: null }); return; }
      const skipped = settings.get().skip;
      if (!manualCheck && skipped === v) { set({ status: 'none', version: null }); return; }
      const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : '';
      set({ status: 'available', version: v, url: releaseUrl(repo, v), notes: notes.replace(/<[^>]+>/g, '').slice(0, 600) });
    });
    autoUpdater.on('update-not-available', () => set({ status: 'none', version: null }));
    autoUpdater.on('download-progress', (p) => set({ status: 'downloading', progress: Math.round((p && p.percent) || 0) }));
    autoUpdater.on('update-downloaded', () => set({ status: 'ready', progress: 100 }));
    autoUpdater.on('error', (err) => {
      // a background check that fails (offline, rate limit) stays quiet; one the wearer asked for says why
      if (manualCheck || state.status === 'downloading') set({ status: 'error', error: String((err && err.message) || err).split('\n')[0].slice(0, 200) });
      else set({ status: 'idle' });
    });
  }

  return {
    mode,
    state: () => ({ ...state }),
    async check({ manual = false } = {}) {
      manualCheck = !!manual;
      if (mode === 'off') { set({ status: 'none', error: null }); return state; }
      if (state.status === 'checking' || state.status === 'downloading') return state;
      try { await autoUpdater.checkForUpdates(); } catch (e) { /* the error event reports it */ }
      return state;
    },
    async download() {
      if (state.status !== 'available') return state;
      if (mode !== 'auto') { openExternal(state.url || releaseUrl(repo, state.version)); return state; }
      set({ status: 'downloading', progress: 0 });
      try { await autoUpdater.downloadUpdate(); } catch (e) { /* the error event reports it */ }
      return state;
    },
    install() {
      if (state.status === 'ready') autoUpdater.quitAndInstall(false, true);
      return state;
    },
    skip() {
      if (state.version) settings.set({ skip: state.version });
      set({ status: 'none', version: null });
      return state;
    },
  };
}

module.exports = { createUpdater, installMode, releaseUrl, compareVersions };
