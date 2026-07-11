/**
 * generate-icons.js
 * Generates all PWA icons and splash screens for Dodge Dash Legends.
 * Uses ONLY Node.js built-ins — no npm install required.
 * Run: node generate-icons.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Output directory ──────────────────────────────────────
const OUT_DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Brand colours ─────────────────────────────────────────
const BG_DARK   = [10,  10,  15,  255]; // #0a0a0f
const PURPLE    = [124, 77,  255, 255]; // #7c4dff
const CYAN      = [0,   229, 255, 255]; // #00e5ff
const ORANGE    = [255, 109, 0,   255]; // #ff6d00
const WHITE     = [255, 255, 255, 255];
const MASK_BG   = [124, 77,  255, 255]; // solid purple for maskable safe zone

// ── Minimal PNG encoder (no deps) ─────────────────────────
// Builds a valid RGBA PNG from a flat Uint8Array pixel buffer.
function encodePNG(width, height, pixels, compressionLevel = 6) {
  // pixels: Uint8Array of length width*height*4 (RGBA row-major)

  // 1. Build filtered scanlines (filter byte 0 = None per row)
  //    Use Buffer.copy for speed instead of per-byte loop
  const rowBytes  = width * 4;
  const scanlines = Buffer.allocUnsafe(height * (1 + rowBytes));
  const srcBuf    = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  for (let y = 0; y < height; y++) {
    const base = y * (1 + rowBytes);
    scanlines[base] = 0; // filter type None
    srcBuf.copy(scanlines, base + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  // 2. Deflate (zlib)
  const compressed = zlib.deflateSync(scanlines, { level: compressionLevel });

  // 3. CRC32 helper
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.allocUnsafe(4);
    len.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.allocUnsafe(4);
    crcVal.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  // 4. IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 6;  // colour type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // 5. Assemble
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Fast solid-colour fill using Buffer.fill ──────────────
function fillSolid(buf, w, h, color) {
  // Build one RGBA pixel and tile it across the whole buffer
  const pixel = Buffer.from([color[0], color[1], color[2], color[3] ?? 255]);
  for (let i = 0; i < w * h; i++) pixel.copy(buf, i * 4);
}

// ── Pixel helpers ──────────────────────────────────────────
function setPixel(buf, w, x, y, color) {
  if (x < 0 || y < 0 || x >= w || y >= buf.length / 4 / w) return;
  const i = (y * w + x) * 4;
  buf[i]   = color[0];
  buf[i+1] = color[1];
  buf[i+2] = color[2];
  buf[i+3] = color[3] ?? 255;
}

function fillRect(buf, w, x0, y0, rw, rh, color) {
  for (let y = y0; y < y0 + rh; y++)
    for (let x = x0; x < x0 + rw; x++)
      setPixel(buf, w, x, y, color);
}

function fillCircle(buf, w, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x-cx)*(x-cx) + (y-cy)*(y-cy) <= r*r)
        setPixel(buf, w, x, y, color);
}

function fillRoundedRect(buf, w, x0, y0, rw, rh, radius, color) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      // check corners
      const inCorner =
        (x < x0 + radius && y < y0 + radius && (x-x0-radius)*(x-x0-radius)+(y-y0-radius)*(y-y0-radius) > radius*radius) ||
        (x >= x0+rw-radius && y < y0+radius   && (x-x0-rw+radius)*(x-x0-rw+radius)+(y-y0-radius)*(y-y0-radius) > radius*radius) ||
        (x < x0+radius && y >= y0+rh-radius   && (x-x0-radius)*(x-x0-radius)+(y-y0-rh+radius)*(y-y0-rh+radius) > radius*radius) ||
        (x >= x0+rw-radius && y >= y0+rh-radius && (x-x0-rw+radius)*(x-x0-rw+radius)+(y-y0-rh+radius)*(y-y0-rh+radius) > radius*radius);
      if (!inCorner) setPixel(buf, w, x, y, color);
    }
  }
}

// Draw a simple racing-car silhouette (scaled to size)
function drawCar(buf, w, h, s) {
  // s = scale factor (icon size / 192)
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  const bw = Math.round(80 * s), bh = Math.round(24 * s);
  const cabW = Math.round(52 * s), cabH = Math.round(18 * s);
  const wR = Math.round(10 * s);

  // Body (orange)
  fillRoundedRect(buf, w,
    cx - Math.floor(bw/2), cy - Math.floor(bh/2),
    bw, bh, Math.max(3, Math.round(6*s)), ORANGE
  );

  // Cabin (cyan)
  fillRoundedRect(buf, w,
    cx - Math.floor(cabW/2), cy - Math.floor(bh/2) - cabH + Math.round(4*s),
    cabW, cabH, Math.max(2, Math.round(4*s)), CYAN
  );

  // Wheels (dark)
  const wheelY = cy + Math.floor(bh/2) - Math.round(2*s);
  const axleOff = Math.round(26 * s);
  [[cx - axleOff, wheelY], [cx + axleOff, wheelY]].forEach(([wx, wy]) => {
    fillCircle(buf, w, wx, wy, wR, [20, 20, 30, 255]);
    fillCircle(buf, w, wx, wy, Math.max(2, Math.round(5*s)), [180, 180, 200, 255]);
  });

  // Headlight dots (white)
  fillCircle(buf, w, cx + Math.floor(bw/2) - Math.round(6*s), cy - Math.round(4*s), Math.max(2, Math.round(3*s)), WHITE);
}

// Draw a small bolt / lightning bolt for the "maskable" icon variant
function drawLightning(buf, w, h, s, color) {
  const cx = Math.floor(w/2), cy = Math.floor(h/2);
  const thick = Math.max(2, Math.round(5*s));
  // Simple lightning: top-right to bottom-left zig-zag
  const pts = [
    [cx + Math.round(14*s), cy - Math.round(28*s)],
    [cx - Math.round(2*s),  cy - Math.round(4*s)],
    [cx + Math.round(8*s),  cy - Math.round(4*s)],
    [cx - Math.round(14*s), cy + Math.round(28*s)],
    [cx + Math.round(2*s),  cy + Math.round(4*s)],
    [cx - Math.round(8*s),  cy + Math.round(4*s)],
  ];
  // Fill the polygon by scanline
  for (let y = cy - Math.round(32*s); y <= cy + Math.round(32*s); y++) {
    const intersections = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1,y1] = pts[i], [x2,y2] = pts[(i+1)%pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        intersections.push(Math.round(x1 + (y-y1)*(x2-x1)/(y2-y1)));
      }
    }
    intersections.sort((a,b)=>a-b);
    for (let k=0; k<intersections.length-1; k+=2) {
      for (let x=intersections[k]; x<=intersections[k+1]; x++)
        setPixel(buf, w, x, y, color);
    }
  }
}

// ── Main icon generator ───────────────────────────────────
function generateIcon(size, maskable = false) {
  const pixels = new Uint8Array(size * size * 4);

  // Background
  const bg = maskable ? MASK_BG : BG_DARK;
  fillRect(pixels, size, 0, 0, size, size, bg);

  const s = size / 192;

  if (maskable) {
    // Maskable: solid purple bg, white lightning bolt centred in safe zone
    // Safe zone = inner 80% (40px on each side for 512px icon)
    drawLightning(pixels, size, size, s * 0.85, WHITE);
  } else {
    // Rounded background card (purple)
    const margin  = Math.round(size * 0.1);
    const radius  = Math.round(size * 0.18);
    fillRoundedRect(pixels, size,
      margin, margin, size - margin*2, size - margin*2, radius, PURPLE
    );
    // Draw car
    drawCar(pixels, size, size, s * 0.78);
    // Small speed lines (white, top-right)
    for (let i = 0; i < 3; i++) {
      const lx = Math.round(size * 0.72 + i * Math.round(5*s));
      const ly = Math.round(size * 0.28 + i * Math.round(7*s));
      const lw = Math.round(12 * s);
      const lh = Math.max(1, Math.round(2 * s));
      fillRect(pixels, size, lx, ly, lw, lh, [255,255,255,160]);
    }
  }

  return encodePNG(size, size, pixels);
}

// ── Splash screen generator ───────────────────────────────
// Ultra-fast: solid dark background + centred car + accent bar.
// No expensive loops — O(pixels drawn) not O(total pixels).
function generateSplash(width, height) {
  const pixels = new Uint8Array(width * height * 4);
  const cx = Math.floor(width/2), cy = Math.floor(height/2);

  // 1. Solid dark fill (single pass)
  fillRect(pixels, width, 0, 0, width, height, BG_DARK);

  // 2. Large soft purple rectangle in the centre (cheap gradient substitute)
  const gw = Math.round(Math.min(width, height) * 0.8);
  const gh = Math.round(Math.min(width, height) * 0.8);
  // Plain fillRect — no rounded corners (avoids slow loop on large images)
  fillRect(pixels, width,
    cx - Math.floor(gw/2), cy - Math.floor(gh/2),
    gw, gh,
    [20, 12, 35, 255] // very dark purple — subtle glow tint
  );

  // 3. Centred car icon
  const iconSize = Math.round(Math.min(width, height) * 0.14);
  const s = iconSize / 192;
  drawCar(pixels, width, height, s);

  // 4. Thin accent line below car
  const lineY = cy + Math.round(iconSize * 0.65);
  const lineW = Math.round(Math.min(width, height) * 0.28);
  fillRect(pixels, width, cx - Math.floor(lineW/2), lineY, lineW, Math.max(1, Math.round(2*s)), PURPLE);

  return encodePNG(width, height, pixels, 1); // level 1 = fast, fine for splash screens
}

// ── File list ─────────────────────────────────────────────
const ICONS = [
  { name: 'icon-48.png',            size: 48,   maskable: false },
  { name: 'icon-72.png',            size: 72,   maskable: false },
  { name: 'icon-96.png',            size: 96,   maskable: false },
  { name: 'icon-128.png',           size: 128,  maskable: false },
  { name: 'icon-144.png',           size: 144,  maskable: false },
  { name: 'icon-152.png',           size: 152,  maskable: false },
  { name: 'icon-192.png',           size: 192,  maskable: false },
  { name: 'icon-256.png',           size: 256,  maskable: false },
  { name: 'icon-384.png',           size: 384,  maskable: false },
  { name: 'icon-512.png',           size: 512,  maskable: false },
  { name: 'icon-maskable-192.png',  size: 192,  maskable: true  },
  { name: 'icon-maskable-512.png',  size: 512,  maskable: true  },
];

const SPLASHES = [
  { name: 'splash-1290x2796.png', w: 1290, h: 2796 },
  { name: 'splash-1179x2556.png', w: 1179, h: 2556 },
  { name: 'splash-1170x2532.png', w: 1170, h: 2532 },
  { name: 'splash-1284x2778.png', w: 1284, h: 2778 },
  { name: 'splash-1125x2436.png', w: 1125, h: 2436 },
  { name: 'splash-828x1792.png',  w: 828,  h: 1792 },
  { name: 'splash-750x1334.png',  w: 750,  h: 1334 },
  { name: 'splash-1536x2048.png', w: 1536, h: 2048 },
  { name: 'splash-1668x2224.png', w: 1668, h: 2224 },
  { name: 'splash-2048x2732.png', w: 2048, h: 2732 },
];

// Also generate screenshot placeholders
const SCREENSHOTS = [
  { name: 'screenshot-mobile.png',  w: 390,  h: 844  },
  { name: 'screenshot-desktop.png', w: 1280, h: 720  },
];

// ── Generate all files ─────────────────────────────────────
let total = 0;

console.log('\n🎨  Dodge Dash Legends — Icon Generator\n');

console.log('📱  Generating app icons…');
for (const { name, size, maskable } of ICONS) {
  const png = generateIcon(size, maskable);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`    ✓  icons/${name}  (${size}×${size}${maskable?' maskable':''})`);
  total++;
}

console.log('\n🍎  Generating iOS splash screens…');
for (const { name, w, h } of SPLASHES) {
  const png = generateSplash(w, h);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`    ✓  icons/${name}  (${w}×${h})`);
  total++;
}

console.log('\n📸  Generating screenshot placeholders…');
for (const { name, w, h } of SCREENSHOTS) {
  const png = generateSplash(w, h);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`    ✓  icons/${name}  (${w}×${h})`);
  total++;
}

console.log(`\n✅  Done — ${total} files written to ./icons/\n`);
console.log('💡  Replace these placeholder images with your actual artwork before publishing.\n');
