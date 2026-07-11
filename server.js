#!/usr/bin/env node
/**
 * Dodge Dash Legends — Local HTTPS server
 *
 * PWAs require HTTPS (or localhost) to register a service worker.
 * This server generates a self-signed certificate and serves the game
 * on https://0.0.0.0:8443 so you can open it on any device on your LAN.
 *
 * Usage:  node server.js
 *
 * Then on your phone (same Wi-Fi):
 *   1. Open the URL shown in the console
 *   2. Accept the "unsafe certificate" warning
 *   3. Use the browser menu → "Add to Home Screen" / Install
 */
'use strict';

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const os     = require('os');
const { execSync } = require('child_process');

const PORT      = 8443;
const REDIR_PORT = 8080;
const DIR        = __dirname;
const CERT_FILE  = path.join(DIR, '.tls-cert.pem');
const KEY_FILE   = path.join(DIR, '.tls-key.pem');

// ── MIME map ─────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.css':  'text/css',
};

// ── Self-signed cert generation ──────────────────────────────────────────────
// Uses correct DER/ASN.1 encoding compatible with Node's OpenSSL binding.

function encodeDERLength(len) {
  if (len < 0x80) return Buffer.from([len]);
  if (len <= 0xff) return Buffer.from([0x81, len]);
  if (len <= 0xffff) return Buffer.from([0x82, len >> 8, len & 0xff]);
  throw new Error('Length too large');
}

function derTLV(tag, value) {
  const v = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([Buffer.from([tag]), encodeDERLength(v.length), v]);
}

function derSEQ(content)     { return derTLV(0x30, content); }
function derSET(content)     { return derTLV(0x31, content); }
function derINT(bytes)       {
  // Ensure positive: prepend 0x00 if high bit set
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from([bytes]);
  const need0 = (b[0] & 0x80) !== 0;
  return derTLV(0x02, need0 ? Buffer.concat([Buffer.from([0x00]), b]) : b);
}
function derOID(hex)         { return derTLV(0x06, Buffer.from(hex, 'hex')); }
function derUTF8(str)        { return derTLV(0x0c, Buffer.from(str, 'utf8')); }
function derPrintable(str)   { return derTLV(0x13, Buffer.from(str, 'ascii')); }
function derBITSTR(bytes)    { return derTLV(0x03, Buffer.concat([Buffer.from([0x00]), bytes])); }
function derCTX(n, content)  { return derTLV(0xa0 | n, content); }

function derUTCTime(date) {
  const d = date;
  const pad = n => String(n).padStart(2, '0');
  const s = pad(d.getUTCFullYear() % 100)
          + pad(d.getUTCMonth() + 1)
          + pad(d.getUTCDate())
          + pad(d.getUTCHours())
          + pad(d.getUTCMinutes())
          + pad(d.getUTCSeconds())
          + 'Z';
  return derTLV(0x17, Buffer.from(s, 'ascii'));
}

function derGeneralizedTime(date) {
  const d = date;
  const pad2 = n => String(n).padStart(2, '0');
  const s = String(d.getUTCFullYear())
          + pad2(d.getUTCMonth() + 1)
          + pad2(d.getUTCDate())
          + pad2(d.getUTCHours())
          + pad2(d.getUTCMinutes())
          + pad2(d.getUTCSeconds())
          + 'Z';
  return derTLV(0x18, Buffer.from(s, 'ascii'));
}

function buildDistinguishedName(cn) {
  // SET > SEQUENCE > [OID commonName, UTF8String value]
  return derSEQ(
    derSET(
      derSEQ(Buffer.concat([
        derOID('550403'),         // id-at-commonName
        derUTF8(cn),
      ]))
    )
  );
}

function generateSelfSignedCert() {
  console.log('🔐 Generating self-signed TLS certificate (first run only)…');

  // Generate RSA-2048 key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const now    = new Date();
  const expiry = new Date(now.getTime() + 10 * 365.25 * 24 * 3600 * 1000);

  const serial = crypto.randomBytes(8);
  serial[0] = serial[0] & 0x7f;  // ensure positive

  const dn = buildDistinguishedName('localhost');

  // sha256WithRSAEncryption OID  1.2.840.113549.1.1.11
  const sha256rsa = derSEQ(Buffer.concat([
    derOID('2a864886f70d01010b'),
    derTLV(0x05, Buffer.alloc(0)),  // NULL
  ]));

  // TBSCertificate
  const tbs = derSEQ(Buffer.concat([
    derCTX(0, derINT(2)),          // version v3
    derINT(serial),
    sha256rsa,                     // signature algorithm
    dn,                            // issuer
    derSEQ(Buffer.concat([         // validity
      derUTCTime(now),
      derGeneralizedTime(expiry),
    ])),
    dn,                            // subject
    Buffer.from(publicKey),        // subjectPublicKeyInfo (already DER)
  ]));

  // Sign the TBS
  const sig = crypto.sign('SHA256', tbs, { key: privateKey, format: 'pem' });

  // Full certificate
  const certDer = derSEQ(Buffer.concat([
    tbs,
    sha256rsa,
    derBITSTR(sig),
  ]));

  const certPem = '-----BEGIN CERTIFICATE-----\n'
    + certDer.toString('base64').replace(/(.{64})/g, '$1\n')
    + '\n-----END CERTIFICATE-----\n';

  fs.writeFileSync(CERT_FILE, certPem);
  fs.writeFileSync(KEY_FILE,  privateKey);
  console.log('✓  TLS certificate ready');
  return { cert: certPem, key: privateKey };
}

// ── Load or create TLS credentials ───────────────────────────────────────────
let tls;
try {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    tls = { cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) };
    console.log('🔐 Loaded TLS certificate');
  } else {
    tls = generateSelfSignedCert();
  }
} catch (err) {
  console.error('Certificate error:', err.message);
  // Delete bad certs so next run regenerates them
  try { fs.unlinkSync(CERT_FILE); } catch(_) {}
  try { fs.unlinkSync(KEY_FILE);  } catch(_) {}
  tls = generateSelfSignedCert();
}

// ── Static file handler ───────────────────────────────────────────────────────
function handler(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/dodge-dash-legends.html';

  const filePath = path.normalize(path.join(DIR, urlPath));

  if (!filePath.startsWith(DIR + path.sep) && filePath !== DIR) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    // Serve the game HTML for any unknown path (SPA-style fallback)
    const fallback = path.join(DIR, 'dodge-dash-legends.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    fs.createReadStream(fallback).pipe(res);
    return;
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type':  mime,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    // Required for SW registration scope
    'Service-Worker-Allowed': '/',
  });
  fs.createReadStream(filePath).pipe(res);
}

// ── HTTPS server ──────────────────────────────────────────────────────────────
let httpsServer;
try {
  httpsServer = https.createServer(tls, handler);
} catch(err) {
  console.error('❌ Failed to create HTTPS server:', err.message);
  console.error('   Deleting bad certificate files, please re-run: node server.js');
  try { fs.unlinkSync(CERT_FILE); } catch(_) {}
  try { fs.unlinkSync(KEY_FILE);  } catch(_) {}
  process.exit(1);
}

httpsServer.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const ips  = [];
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address);
    }
  }

  console.log('\n🎮  DODGE DASH LEGENDS — Server running\n');
  console.log('  On this PC    →  https://localhost:' + PORT + '/');
  ips.forEach(ip =>
    console.log('  On your phone →  https://' + ip + ':' + PORT + '/')
  );
  console.log('\n  Steps to install on phone:');
  console.log('  1. Make sure phone is on the same Wi-Fi as this PC');
  console.log('  2. Open the "On your phone" URL above in Chrome (Android) or Safari (iOS)');
  console.log('  3. Tap "Advanced" → "Proceed to ... (unsafe)" to accept the self-signed cert');
  console.log('  4. Android: Chrome will show an install banner OR use ⋮ → "Add to Home screen"');
  console.log('     iPhone:  Tap the Share icon ⬆ → "Add to Home Screen"');
  console.log('\n  Press Ctrl+C to stop the server.\n');
});

httpsServer.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌  Port ${PORT} is already in use. Change PORT in server.js or stop the other process.`);
  } else {
    console.error('❌  Server error:', err.message);
  }
  process.exit(1);
});

// ── HTTP → HTTPS redirect ─────────────────────────────────────────────────────
http.createServer((req, res) => {
  const host = (req.headers.host || 'localhost').replace(/:\d+$/, '');
  res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
  res.end();
}).listen(REDIR_PORT, '0.0.0.0', () => {
  console.log(`  HTTP redirect on port ${REDIR_PORT} → HTTPS`);
});
