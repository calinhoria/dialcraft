'use strict';
// Regenerate assets/masks/*.svg + masks.json from the device catalog:
//   npm run masks
const fs = require('fs');
const path = require('path');
const { DEVICES } = require('../core/devices');
const { maskSvg, maskMeta } = require('../core/masks');

const dir = path.join(__dirname, '..', 'assets', 'masks');
fs.mkdirSync(dir, { recursive: true });
for (const d of DEVICES) fs.writeFileSync(path.join(dir, `${d.target}.svg`), maskSvg(d));
fs.writeFileSync(path.join(dir, 'masks.json'), JSON.stringify(maskMeta(), null, 2) + '\n');
console.log(`wrote ${DEVICES.length} masks to assets/masks`);
