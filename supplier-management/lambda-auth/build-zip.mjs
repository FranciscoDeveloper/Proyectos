import fs   from "fs";
import path from "path";

const ROOT    = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const OUT     = path.join(ROOT, "dist", "lambda-auth.zip");
const EXCLUDE = new Set(["dist", ".git", "build-zip.mjs"]);

const entries = [];

function walk(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir)) {
    if (prefix === "" && EXCLUDE.has(entry)) continue;
    const abs  = path.join(dir, entry);
    const rel  = prefix ? `${prefix}/${entry}` : entry;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, rel);
    } else {
      entries.push({ abs, rel });
    }
  }
}

walk(ROOT);
console.log(`Found ${entries.length} files`);

function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }

const localHeaders  = [];
const centralDirs   = [];
let   offset        = 0;

for (const { abs, rel } of entries) {
  const data      = fs.readFileSync(abs);
  const nameBytes = Buffer.from(rel, "utf8");
  const crc       = crc32(data);
  const now       = dosDateTime();

  const local = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    u16(20), u16(0), u16(0),
    u16(now.time), u16(now.date),
    u32(crc), u32(data.length), u32(data.length),
    u16(nameBytes.length), u16(0),
    nameBytes, data
  ]);

  localHeaders.push(local);

  const central = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x01, 0x02]),
    u16(20), u16(20), u16(0), u16(0),
    u16(now.time), u16(now.date),
    u32(crc), u32(data.length), u32(data.length),
    u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
    u32(0), u32(offset),
    nameBytes
  ]);

  centralDirs.push(central);
  offset += local.length;
}

const centralDirData  = Buffer.concat(centralDirs);
const centralDirStart = offset;

const eocd = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  u16(0), u16(0),
  u16(entries.length), u16(entries.length),
  u32(centralDirData.length), u32(centralDirStart),
  u16(0)
]);

fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
const out = fs.createWriteStream(OUT);
for (const h of localHeaders) out.write(h);
out.write(centralDirData);
out.write(eocd);
out.end();

console.log(`Written: ${OUT}`);

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime() {
  const d = new Date();
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}
