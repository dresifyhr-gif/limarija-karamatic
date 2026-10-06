// Doda 16 nul-bajtova na kraj 'glyf' tablice (fontkit inače pada na praznim glifovima na samom kraju tablice).
const fs = require('fs');
const file = process.argv[2];
const b = fs.readFileSync(file);
const n = b.readUInt16BE(4);
const tables = [];
for (let i = 0; i < n; i++) {
  const o = 12 + i * 16;
  tables.push({ tag: b.toString('latin1', o, o + 4), off: b.readUInt32BE(o + 8), len: b.readUInt32BE(o + 12) });
}
const data = tables.map((t) => {
  let d = Buffer.from(b.subarray(t.off, t.off + t.len));
  if (t.tag === 'glyf') d = Buffer.concat([d, Buffer.alloc(16)]);
  if (t.tag === 'head') d.writeUInt32BE(0, 8); // checkSumAdjustment se računa ponovno
  return { tag: t.tag, d };
});
const checksum = (buf) => {
  const p = Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4)]);
  let s = 0;
  for (let i = 0; i < p.length; i += 4) s = (s + p.readUInt32BE(i)) >>> 0;
  return s;
};
const header = Buffer.from(b.subarray(0, 12));
const dir = Buffer.alloc(16 * n);
let off = 12 + 16 * n;
const bodies = [];
data.sort((a, c) => (a.tag < c.tag ? -1 : 1)).forEach((t, i) => {
  dir.write(t.tag, i * 16, 'latin1');
  dir.writeUInt32BE(checksum(t.d), i * 16 + 4);
  dir.writeUInt32BE(off, i * 16 + 8);
  dir.writeUInt32BE(t.d.length, i * 16 + 12);
  const pad = Buffer.alloc((4 - (t.d.length % 4)) % 4);
  bodies.push(t.d, pad);
  t.off = off;
  off += t.d.length + pad.length;
});
const out = Buffer.concat([header, dir, ...bodies]);
const head = data.find((t) => t.tag === 'head');
out.writeUInt32BE((0xb1b0afba - checksum(out)) >>> 0, head.off + 8);
fs.writeFileSync(file, out);
console.log('ok', file, b.length, '→', out.length);
