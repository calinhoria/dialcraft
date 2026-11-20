'use strict';
// The "Amazfit" package: the same face as a plain-source package for the older runtime (Zepp OS 1.0 API: the global hmUI / hmSensor / hmFS), the
// layout the Watchface Maker and amazfitwatchfaces.com use: app.json (configVersion v2), app.js, watchface/index.js and a plain assets/ folder.
// It is made from the code Dialcraft already generated for the Zeus build: the imports of the new API are replaced by a small shim over the
// old globals, and the face is wrapped the way the Maker wraps it.
const path = require('path');
const fs = require('fs');
const { createZip, zipDirectory } = require('./zip');

// the new API's classes, over the old sensors. Every call is guarded: a sensor an older watch lacks reads 0 and never stops the face.
const SHIM = `
        // ---- Dialcraft: the new-API names over the old runtime ----
        const ui = hmUI
        const safe = (f, d) => { try { const v = f(); return v === undefined ? d : v } catch (e) { return d } }
        const sensorClass = (id, props) => class {
          constructor() { this.s = safe(() => hmSensor.createSensor(hmSensor.id[id]), null) }
          getCurrent() { return safe(() => this.s[props[0]], 0) }
          getTarget() { return safe(() => this.s[props[1] || 'target'], 0) }
          onChange(cb) { safe(() => this.s.addEventListener(hmSensor.event.CHANGE, cb)) }
        }
        const Step = sensorClass('STEP', ['current', 'target'])
        const Calorie = sensorClass('CALORIE', ['current', 'target'])
        const Distance = sensorClass('DISTANCE', ['current'])
        const Stand = sensorClass('STAND', ['current', 'target'])
        const FatBurning = sensorClass('FAT_BURNING', ['current', 'target'])
        const HeartRate = sensorClass('HEART', ['last'])
        const Battery = sensorClass('BATTERY', ['current'])
        const BloodOxygen = sensorClass('SPO2', ['current'])
        const Stress = sensorClass('STRESS', ['current'])
        class Pai {
          constructor() { this.s = safe(() => hmSensor.createSensor(hmSensor.id.PAI), null) }
          getToday() { return safe(() => this.s.dailypai, 0) }
          getTotal() { return safe(() => this.s.totalpai, 0) }
          onChange(cb) { safe(() => this.s.addEventListener(hmSensor.event.CHANGE, cb)) }
        }
        class Barometer {
          constructor() { this.s = safe(() => hmSensor.createSensor(hmSensor.id.BAROMETER), null) }
          getAirPressure() { return safe(() => this.s.current, 0) }
          getAltitude() { return safe(() => this.s.altitude, 0) }
          onChange(cb) { safe(() => this.s.addEventListener(hmSensor.event.CHANGE, cb)) }
        }
        class Time {
          constructor() { this.s = safe(() => hmSensor.createSensor(hmSensor.id.TIME), null) }
          getHours() { return safe(() => this.s.hour, new Date().getHours()) }
          getMinutes() { return safe(() => this.s.minute, new Date().getMinutes()) }
          getSeconds() { return safe(() => this.s.second, new Date().getSeconds()) }
          onPerMinute(cb) { safe(() => this.s.addEventListener(this.s.event.MINUTEEND, cb)) }
          onPerSecond(cb) { safe(() => this.s.addEventListener(this.s.event.SECONDEND, cb)) }
        }
        class Weather {
          constructor() { this.s = safe(() => hmSensor.createSensor(hmSensor.id.WEATHER), null) }
          getForecastWeather() { return safe(() => this.s.getForecastWeather(), null) }
        }
        const zosSensors = { Weather }
        const zosSettings = { getLanguage: () => hmSetting.getLanguage() }
        const zosFs = {   // the old runtime keeps numbers per name (the face stores its colour theme)
          readFileSync: (o) => { const v = hmFS.SysProGetInt(String(o.path)); if (v === undefined || v === null) throw new Error('none'); return v },
          writeFileSync: (o) => { hmFS.SysProSetInt(String(o.path), Number(o.data) || 0) },
        }
        const SYSTEM_APPS_OLD = {
          SYSTEM_APP_STATUS: 'activityAppScreen', SYSTEM_APP_HR: 'heart_app_Screen', SYSTEM_APP_WEATHER: 'Weather_HomeScreen', SYSTEM_APP_SPORT: 'Sport_listScreen',
        }
`;

const HEAD = `try {
    (() => {
        //start of ignored block
        const __$$app$$__ = __$$hmAppManager$$__.currentApp;
        function getApp() {
            return __$$app$$__.app;
        }
        function getCurrentPage() {
            return __$$app$$__.current && __$$app$$__.current.module;
        }
        const __$$module$$__ = __$$app$$__.current;
        const {px} = __$$app$$__.__globals__;
        const logger = DeviceRuntimeCore.HmLogger.getLogger('watchface_dialcraft');
        //end of ignored block
`;
const TAIL = `        ;
    })();
} catch (e) {
    console.log('Mini Program Error', e);
    e && e.stack && e.stack.split(/\\n/).forEach(i => console.log('error stack', i));
    ;
}`;

// the face's generated code → the old runtime's page
function faceToLegacy(code) {
  let s = String(code);
  const apps = new Set();
  s = s.replace(/^import \{([^}]*)\} from '@zos\/router'.*$/gm, (_, names) => { names.split(',').map((x) => x.trim()).filter((x) => /^SYSTEM_APP_\w+$/.test(x)).forEach((x) => apps.add(x)); return ''; });
  s = s.replace(/^import .* from '@zos\/[a-z]+'.*$/gm, '');
  // launchApp({ appId: SYSTEM_APP_X, native: true }) → hmApp.startApp({ url, native: true })
  let shim = SHIM;
  if (apps.size || /launchApp\(/.test(s)) {
    shim += `        const launchApp = (o) => { const url = SYSTEM_APPS_OLD[o && o.__name]; if (url) hmApp.startApp({ url, native: true }) }\n`;
    s = s.replace(/launchApp\(\{ appId: (SYSTEM_APP_\w+),/g, "launchApp({ __name: '$1', appId: 0,");
  }
  // only the names that are no real identifiers any more
  s = s.replace(/\bWatchFace\(\{/, '__$$$$module$$$$__.module = DeviceRuntimeCore.WatchFace({')
    .replace(/\binitView\(\) \{/, 'init_view() {')
    .replace(/this\.initView\(\)/g, 'this.init_view()');
  // the old runtime has no onInit/onDestroy requirement, but the Maker always writes them
  s = s.replace(/\n  build\(\) \{/, "\n  onInit() {\n    logger.log('index page.js on init invoke')\n  },\n\n  build() {");
  return HEAD + shim + '\n' + s.split('\n').map((l) => (l ? '        ' + l : l)).join('\n') + '\n' + TAIL + '\n';
}

// app.js: the old runtime's own app wrapper, with the designed width for px()
function appJs(designWidth) {
  return `try {
    (() => {
        const __$$app$$__ = __$$hmAppManager$$__.currentApp;
        function getApp() {
            return __$$app$$__.app;
        }
        function getCurrentPage() {
            return __$$app$$__.current && __$$app$$__.current.module;
        }
        __$$app$$__.__globals__ = {
            lang: new DeviceRuntimeCore.HmUtils.Lang(DeviceRuntimeCore.HmUtils.getLanguage()),
            px: DeviceRuntimeCore.HmUtils.getPx(${Number(designWidth) || 390})
        };
        const {px} = __$$app$$__.__globals__;
        const languageTable = {};
        __$$app$$__.__globals__.gettext = DeviceRuntimeCore.HmUtils.gettextFactory(languageTable, __$$app$$__.__globals__.lang, 'en-US');
        function getGlobal() {
            if (typeof self !== 'undefined') {
                return self;
            }
            if (typeof window !== 'undefined') {
                return window;
            }
            if (typeof global !== 'undefined') {
                return global;
            }
            if (typeof globalThis !== 'undefined') {
                return globalThis;
            }
            throw new Error('unable to locate global object');
        }
        let globalNS$2 = getGlobal();
        if (!globalNS$2.Logger) {
            if (typeof DeviceRuntimeCore !== 'undefined') {
                globalNS$2.Logger = DeviceRuntimeCore.HmLogger;
            }
        }
        let globalNS$1 = getGlobal();
        if (!globalNS$1.Buffer) {
            if (typeof Buffer !== 'undefined') {
                globalNS$1.Buffer = Buffer;
            } else {
                globalNS$1.Buffer = DeviceRuntimeCore.Buffer;
            }
        }
        function isHmTimerDefined() {
            return typeof timer !== 'undefined';
        }
        let globalNS = getGlobal();
        if (typeof setTimeout === 'undefined' && isHmTimerDefined()) {
            globalNS.clearTimeout = function clearTimeout(timerRef) {
                timerRef && timer.stopTimer(timerRef);
            };
            globalNS.setTimeout = function setTimeout2(func, ns) {
                const timer1 = timer.createTimer(ns || 1, Number.MAX_SAFE_INTEGER, function () {
                    globalNS.clearTimeout(timer1);
                    func && func();
                }, {});
                return timer1;
            };
            globalNS.clearImmediate = function clearImmediate(timerRef) {
                timerRef && timer.stopTimer(timerRef);
            };
            globalNS.setImmediate = function setImmediate(func) {
                const timer1 = timer.createTimer(1, Number.MAX_SAFE_INTEGER, function () {
                    globalNS.clearImmediate(timer1);
                    func && func();
                }, {});
                return timer1;
            };
            globalNS.clearInterval = function clearInterval(timerRef) {
                timerRef && timer.stopTimer(timerRef);
            };
            globalNS.setInterval = function setInterval(func, ms) {
                const timer1 = timer.createTimer(1, ms, function () {
                    func && func();
                }, {});
                return timer1;
            };
        }
        __$$app$$__.app = DeviceRuntimeCore.App({
            globalData: {},
            onCreate(options) {
            },
            onDestroy(options) {
            },
            onError(error) {
            },
            onPageNotFound(obj) {
            },
            onUnhandledRejection(obj) {
            }
        });
        ;
    })();
} catch (e) {
    console.log('Mini Program Error', e);
    e && e.stack && e.stack.split(/\\n/).forEach(i => console.log('error stack', i));
    ;
}`;
}

// app.json in the Maker's layout (configVersion v2)
function appJsonLegacy(zeusApp, device, opts = {}) {
  const a = (zeusApp && zeusApp.app) || {};
  return {
    configVersion: 'v2',
    app: {
      appIdType: 0,
      appId: a.appId,
      appName: a.appName || 'Watchface',
      appType: 'watchface',
      version: a.version || { code: 1, name: '1.0.0' },
      vender: a.vender || 'dialcraft',
      description: a.description || '',
      icon: 'preview.png',
      cover: ['preview.png'],
      extraInfo: { madeBy: 1, fromZoom: false },
    },
    permissions: opts.gps ? ['gps'] : [],
    runtime: { apiVersion: { compatible: '1.0.0', target: '1.0.1', minVersion: '1.0.0' } },
    i18n: { 'en-US': { icon: 'preview.png', appName: a.appName || 'Watchface' } },
    defaultLanguage: 'en-US',
    debug: false,
    module: { watchface: { path: 'watchface/index', main: 1, editable: 0, lockscreen: opts.aod ? 1 : 0, hightCost: 0 } },
    platforms: (device.sources || []).map((id) => ({ name: device.name, deviceSource: id })),
    designWidth: device.designWidth || device.w,
    packageInfo: { mode: 'production', timeStamp: Math.floor(Date.now() / 1000), expiredTime: 172800, zpm: '2.8.2' },
  };
}

// The pictures: the built .zab already holds them in Zepp's compressed format (.zab → .zpk → device.zip → assets/), the same files the Maker's
// package carries. Without a .zab the plain PNGs of the project are used.
function assetsFromZab(zabPath) {
  const os = require('os');
  const { extractZip } = require('./zip');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dialcraft-amazfit-'));
  try {
    extractZip(zabPath, path.join(tmp, 'zab'));
    const zpk = fs.readdirSync(path.join(tmp, 'zab')).find((f) => /\.zpk$/i.test(f));
    if (!zpk) return null;
    extractZip(path.join(tmp, 'zab', zpk), path.join(tmp, 'zpk'));
    const dz = path.join(tmp, 'zpk', 'device.zip');
    if (!fs.existsSync(dz)) return null;
    extractZip(dz, path.join(tmp, 'device'));
    const root = path.join(tmp, 'device', 'assets');
    return fs.existsSync(root) ? zipDirectory(root) : null;
  } catch (e) { return null; } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* temp */ } }
}

// outDir = the Zeus project Dialcraft wrote; returns the written zip path
function writeAmazfitPackage(outDir, device, destDir, name, zabPath) {
  const faceFile = path.join(outDir, 'watchface', device.target, 'index.js');
  const code = fs.readFileSync(faceFile, 'utf8');
  const zeusApp = JSON.parse(fs.readFileSync(path.join(outDir, 'app.json'), 'utf8'));
  const gps = /WEATHER|SUN_|zosSensors\.Weather|Weather\b/.test(code);
  const aod = /ONLY_AOD/.test(code);
  const entries = [
    { name: 'app.json', data: JSON.stringify(appJsonLegacy(zeusApp, device, { gps, aod }), null, 2) },
    { name: 'app.js', data: appJs(device.designWidth || device.w) },
    { name: 'watchface/index.js', data: faceToLegacy(code) },
  ];
  // assets/: the pictures and fonts in the same folders the code asks for (images/…, fonts/…); preview.png is the icon
  const assets = (zabPath && assetsFromZab(zabPath)) || zipDirectory(path.join(outDir, 'assets', device.assetDir || device.target));
  for (const e of assets) {
    if (e.name === 'images/preview.png') entries.push({ name: 'assets/preview.png', data: e.data });
    else entries.push({ name: 'assets/' + e.name, data: e.data });
  }
  const file = path.join(destDir, `${String(name || 'watchface').replace(/[^\w\-. ]+/g, '_').trim() || 'watchface'}-amazfit.zip`);
  fs.writeFileSync(file, createZip(entries));
  return file;
}

module.exports = { faceToLegacy, appJs, appJsonLegacy, writeAmazfitPackage };
