// ─────────────────────────────────────────────────────────────
//  Dodge Dash Legends — Icon generator (Node.js, no dependencies)
//  Writes icons/icon-192.png, icons/icon-512.png,
//         icons/apple-touch-icon.png, icons/favicon.ico
//
//  Run: node make-icons.js
// ─────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

// ── Minimal pure-JS PNG encoder ──────────────────────────────
// Supports RGBA 8-bit. No zlib compression (filter type 0,
// deflate stored blocks). Small icons are tiny anyway.
function encodePNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row-major

  // ─ CRC32 table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf, off, len) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < len; i++) c = crcTable[(c ^ buf[off + i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function u32be(v) { return [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF]; }

  function chunk(type, data) {
    const len    = data.length;
    const header = [...u32be(len), ...type];
    const body   = [...data];
    const crcBuf = Buffer.from([...header.slice(4), ...body]);
    const crc    = crc32(crcBuf, 0, crcBuf.length);
    return Buffer.from([...u32be(len), ...type, ...body, ...u32be(crc)]);
  }

  // IHDR
  const ihdr = chunk(
    [0x49, 0x48, 0x44, 0x52],
    [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0]
  );

  // IDAT — deflate "stored" blocks (no compression)
  // Build raw scanlines with filter byte 0x00
  const rowBytes = width * 4;
  const rawLines = [];
  for (let y = 0; y < height; y++) {
    rawLines.push(0x00);
    const base = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) rawLines.push(pixels[base + x]);
  }
  // Wrap in zlib header + deflate stored blocks
  const zlibData = deflateStored(rawLines);
  const idat = chunk([0x49, 0x44, 0x41, 0x54], zlibData);

  // IEND
  const iend = chunk([0x49, 0x45, 0x4E, 0x44], []);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function deflateStored(data) {
  // zlib header (CMF=0x78, FLG computed for no dict, level 0)
  const cmf = 0x78, flg = (31 - ((0x78 * 256) % 31)) % 31;
  const MAX_BLOCK = 65535;
  const blocks = [];
  let pos = 0;
  while (pos < data.length) {
    const chunk = data.slice(pos, pos + MAX_BLOCK);
    const isLast = (pos + chunk.length >= data.length) ? 1 : 0;
    const len = chunk.length;
    const nlen = (~len) & 0xFFFF;
    blocks.push(isLast, len & 0xFF, (len >> 8) & 0xFF, nlen & 0xFF, (nlen >> 8) & 0xFF, ...chunk);
    pos += chunk.length;
  }
  // Adler-32
  let s1 = 1, s2 = 0;
  for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
  const adler = (s2 << 16) | s1;
  return [cmf, flg, ...blocks, (adler >>> 24) & 0xFF, (adler >>> 16) & 0xFF, (adler >>> 8) & 0xFF, adler & 0xFF];
}

// ── Draw icon into a pixels buffer ───────────────────────────
function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    // Alpha blend onto existing
    const aa = a / 255, ba = pixels[i + 3] / 255;
    const oa = aa + ba * (1 - aa);
    if (oa < 0.001) return;
    pixels[i    ] = Math.round((r * aa + pixels[i    ] * ba * (1 - aa)) / oa);
    pixels[i + 1] = Math.round((g * aa + pixels[i + 1] * ba * (1 - aa)) / oa);
    pixels[i + 2] = Math.round((b * aa + pixels[i + 2] * ba * (1 - aa)) / oa);
    pixels[i + 3] = Math.round(oa * 255);
  }

  function fillRect(x1, y1, x2, y2, r, g, b, a = 255) {
    for (let y = Math.max(0, y1); y < Math.min(size, y2); y++)
      for (let x = Math.max(0, x1); x < Math.min(size, x2); x++)
        setPixel(x, y, r, g, b, a);
  }

  function fillCircle(cx, cy, radius, r, g, b, a = 255) {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const edge = Math.max(0, Math.min(1, radius - dist + 0.5));
          setPixel(x, y, r, g, b, Math.round(a * edge));
        }
      }
    }
  }

  function fillRoundRect(x1, y1, x2, y2, r, red, g, b, a = 255) {
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        // Corner radii check
        const dx = Math.max(0, r - (x - x1), r - (x2 - x - 1));
        const dy = Math.max(0, r - (y - y1), r - (y2 - y - 1));
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= r) {
          const edge = Math.max(0, Math.min(1, r - dist + 0.5));
          setPixel(x, y, red, g, b, Math.round(a * edge));
        }
      }
    }
  }

  const s = size;
  const cr = Math.round(s * 0.18); // corner radius

  // ── Background: deep blue ──────────────────────────────────
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // Radial gradient: centre bright, edges dark
      const dx = (x / s) - 0.5, dy = (y / s) - 0.45;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(dist / 0.7, 1);
      const red = Math.round(0 * (1 - t) + 0 * t);
      const grn = Math.round(20 * (1 - t) + 0 * t);
      const blu = Math.round(180 * (1 - t) + 20 * t);
      setPixel(x, y, red, grn, blu, 255);
    }
  }

  // ── Rounded rect mask (clear corners) ─────────────────────
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const inLeft  = x < cr, inRight  = x >= s - cr;
      const inTop   = y < cr, inBottom = y >= s - cr;
      if (!((inLeft || inRight) && (inTop || inBottom))) continue;
      const cx = inLeft ? cr : s - cr - 1;
      const cy = inTop  ? cr : s - cr - 1;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > cr) {
        const i = (y * s + x) * 4;
        pixels[i + 3] = 0; // fully transparent
      }
    }
  }

  // ── Road strip ────────────────────────────────────────────
  const roadY  = Math.round(s * 0.56);
  const roadH  = Math.round(s * 0.30);
  const roadX1 = Math.round(s * 0.12);
  const roadX2 = Math.round(s * 0.88);
  fillRect(roadX1, roadY, roadX2, roadY + roadH, 30, 30, 50, 220);

  // Road dashes
  const dashY = roadY + Math.round(roadH * 0.5);
  for (let i = 0; i < 4; i++) {
    const dx1 = roadX1 + Math.round((roadX2 - roadX1) * (i / 4 + 0.05));
    const dx2 = roadX1 + Math.round((roadX2 - roadX1) * (i / 4 + 0.16));
    fillRect(dx1, dashY - Math.round(s * 0.012), dx2, dashY + Math.round(s * 0.012), 255, 215, 0, 230);
  }

  // ── Car body ──────────────────────────────────────────────
  const carCX = Math.round(s * 0.50);
  const carCY = Math.round(s * 0.44);
  const carW  = Math.round(s * 0.52);
  const carH  = Math.round(s * 0.16);
  const carR  = Math.round(s * 0.04);

  // Shadow
  fillCircle(carCX, carCY + Math.round(s * 0.09), Math.round(s * 0.22), 0, 0, 0, 60);

  // Body
  fillRoundRect(carCX - Math.round(carW/2), carCY - Math.round(carH*0.6),
                carCX + Math.round(carW/2), carCY + Math.round(carH*0.4),
                carR, 200, 20, 50, 255);

  // Cabin
  const cabW = Math.round(carW * 0.44), cabH = Math.round(carH * 0.9);
  fillRoundRect(carCX - Math.round(cabW/2), carCY - Math.round(carH*0.6) - cabH,
                carCX + Math.round(cabW/2), carCY - Math.round(carH*0.6) + Math.round(carH*0.1),
                Math.round(carR*0.7), 15, 15, 35, 235);

  // Windshield tint
  const winW = Math.round(cabW * 0.82), winH = Math.round(cabH * 0.75);
  fillRoundRect(carCX - Math.round(winW/2), carCY - Math.round(carH*0.6) - cabH + Math.round(cabH*0.1),
                carCX + Math.round(winW/2), carCY - Math.round(carH*0.6) - cabH + Math.round(cabH*0.1) + winH,
                Math.round(carR*0.5), 100, 200, 255, 140);

  // Wheels
  const wheelR = Math.round(s * 0.062);
  const wheelY = carCY + Math.round(carH * 0.32);
  const wheelX = [carCX - Math.round(carW * 0.32), carCX + Math.round(carW * 0.32)];
  wheelX.forEach(wx => {
    fillCircle(wx, wheelY, wheelR,           15,  15,  15,  255); // tyre
    fillCircle(wx, wheelY, wheelR * 0.55,   180, 180, 180, 255); // rim
    fillCircle(wx, wheelY, wheelR * 0.22,    60,  60,  60, 255); // hub
  });

  // Headlight glow
  const hlX = carCX + Math.round(carW * 0.44);
  const hlY = carCY - Math.round(carH * 0.05);
  for (let r = Math.round(s*0.10); r > 0; r -= 2) {
    fillCircle(hlX, hlY, r, 255, 255, 180, Math.round(28 * (1 - r / (s*0.10))));
  }
  fillCircle(hlX, hlY, Math.round(s * 0.025), 255, 255, 220, 255);

  // Brake light
  fillCircle(carCX - Math.round(carW * 0.44), hlY, Math.round(s * 0.018), 220, 20, 0, 255);

  // ── Speed lines ───────────────────────────────────────────
  const slY = [carCY - Math.round(carH * 0.08), carCY + Math.round(carH * 0.08)];
  slY.forEach(ly => {
    for (let x = carCX - Math.round(carW * 0.82); x < carCX - Math.round(carW * 0.54); x++) {
      setPixel(x, ly, 120, 180, 255, 120);
      setPixel(x, ly + 1, 120, 180, 255, 60);
    }
  });

  // ── Text: "DDL" ───────────────────────────────────────────
  // Simple pixel font for "DDL" at the bottom
  const textY = Math.round(s * 0.83);
  const textScale = Math.max(1, Math.round(s / 64));
  drawText('DDL', Math.round(s * 0.5), textY, textScale, pixels, s);

  return pixels;
}

// ── Minimal pixel font for "DDL" ─────────────────────────────
const GLYPHS = {
  D: [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  L: [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
};
function drawText(str, cx, y, scale, pixels, size) {
  const chars = str.split('');
  const charW = 3 * scale + scale, totalW = chars.length * charW - scale;
  let x = cx - Math.floor(totalW / 2);
  chars.forEach(ch => {
    const glyph = GLYPHS[ch] || GLYPHS['D'];
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col]) {
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++) {
              const px = x + col * scale + sx;
              const py = y + row * scale + sy;
              if (px >= 0 && px < size && py >= 0 && py < size) {
                const i = (py * size + px) * 4;
                pixels[i    ] = 220; pixels[i+1] = 235; pixels[i+2] = 255; pixels[i+3] = 230;
              }
            }
        }
      }
    }
    x += charW;
  });
}

// ── Generate and write files ──────────────────────────────────
const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const sizes = [
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

sizes.forEach(({ size, name }) => {
  const pixels = drawIcon(size);
  const png = encodePNG(size, size, pixels);
  const dest = path.join(outDir, name);
  fs.writeFileSync(dest, png);
  console.log(`✓ ${name}  (${png.length} bytes)`);
});

// favicon.ico: a minimal 1-image ICO wrapping the 48×48 PNG
const ico48 = encodePNG(48, 48, drawIcon(48));
const icoData = buildICO(ico48);
fs.writeFileSync(path.join(outDir, 'favicon.ico'), icoData);
console.log(`✓ favicon.ico  (${icoData.length} bytes)`);
console.log('\nAll icons written to icons/');

function buildICO(pngBuf) {
  // ICO file: header + 1 directory entry + PNG data
  const w = 0, h = 0; // 0 = 256 in ICO spec (use 0 for all sizes)
  const header    = Buffer.alloc(6);
  const dirEntry  = Buffer.alloc(16);
  const dataOffset = 6 + 16;

  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: 1 = ICO
  header.writeUInt16LE(1, 4);  // count: 1 image

  dirEntry.writeUInt8(48, 0);  // width  (48px)
  dirEntry.writeUInt8(48, 1);  // height (48px)
  dirEntry.writeUInt8(0, 2);   // color count
  dirEntry.writeUInt8(0, 3);   // reserved
  dirEntry.writeUInt16LE(1, 4);  // color planes
  dirEntry.writeUInt16LE(32, 6); // bits per pixel
  dirEntry.writeUInt32LE(pngBuf.length, 8);
  dirEntry.writeUInt32LE(dataOffset, 12);

  return Buffer.concat([header, dirEntry, pngBuf]);
}
