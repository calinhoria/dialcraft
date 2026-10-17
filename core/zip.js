'use strict';
// Minimal ZIP writer (deflate + store). Enough to hand a whole designer project
// to a phone/browser over the LAN installer without pulling in a dependency.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// PNG/ZAB/ZIP are already compressed; storing them keeps zips fast.
const STORE_EXT = /\.(png|jpe?g|gif|webp|zab|zip|bin)$/i;

function dosDateTime(date) {
  const d = date || new Date();
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const day = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time: time & 0xffff, date: day & 0xffff };
}

// entries: [{ name, data (Buffer|string), mode? }]
function createZip(entries, opts = {}) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const { date } = dosDateTime(opts.date);
  const { time } = dosDateTime(opts.date);

  for (const entry of entries) {
    const name = String(entry.name).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!name || name.endsWith('/')) continue;
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const crc = crc32(raw);
    const store = STORE_EXT.test(name);
    const body = store ? raw : zlib.deflateRawSync(raw, { level: 9 });
    const method = store ? 0 : 8;
    const nameBuf = Buffer.from(name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0, 6);           // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);          // extra length
    chunks.push(local, nameBuf, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(0x031e, 4);        // version made by (unix)
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(((entry.mode || 0o100644) << 16) >>> 0, 38);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2 > 0xffff ? 0xffff : central.length / 2, 8);
  end.writeUInt16LE(central.length / 2 > 0xffff ? 0xffff : central.length / 2, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, end]);
}

// Walk a folder (skipping heavy build output) into zip entries.
function zipDirectory(dir, opts = {}) {
  const skip = opts.skip || /(^|[\\/])(node_modules|dist|\.git)([\\/]|$)/;
  const entries = [];
  const root = path.resolve(dir);
  const walk = (cur) => {
    let names = [];
    try { names = fs.readdirSync(cur); } catch (e) { return; }
    for (const n of names) {
      const full = path.join(cur, n);
      if (skip.test(full)) continue;
      let st;
      try { st = fs.statSync(full); } catch (e) { continue; }
      if (st.isDirectory()) { walk(full); continue; }
      if (st.size > (opts.maxFile || 24 * 1024 * 1024)) continue;
      entries.push({ name: path.relative(root, full).split(path.sep).join('/'), data: fs.readFileSync(full) });
    }
  };
  walk(root);
  return entries;
}

module.exports = { createZip, zipDirectory, crc32 };
