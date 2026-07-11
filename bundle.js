/**
 * bundle.js — Downloads Three.js r128 from the CDN and inlines it
 * directly into dodge-dash-legends.html, replacing the <script src> tag.
 * Run once: node bundle.js
 * This makes the game work 100% offline after being installed as a PWA.
 */
'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const HTML_FILE = path.join(__dirname, 'dodge-dash-legends.html');

console.log('⬇  Downloading Three.js r128…');

https.get(THREE_URL, res => {
  if (res.statusCode !== 200) {
    console.error('✗  Download failed:', res.statusCode);
    process.exit(1);
  }

  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const threeJs = Buffer.concat(chunks).toString('utf8');
    console.log(`✓  Downloaded Three.js (${(threeJs.length / 1024).toFixed(0)} KB)`);

    let html = fs.readFileSync(HTML_FILE, 'utf8');

    // Replace the external CDN script tag with an inline version
    const oldTag = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
    const newTag = `<script>/* Three.js r128 — inlined for offline PWA use */\n${threeJs}\n</script>`;

    if (!html.includes(oldTag)) {
      // Already inlined or tag is different — check for partial match
      const partialMatch = html.match(/<script\s+src="[^"]*three[^"]*"><\/script>/i);
      if (partialMatch) {
        html = html.replace(partialMatch[0], newTag);
        console.log('✓  Replaced existing Three.js script tag (partial match)');
      } else {
        console.warn('⚠  Could not find Three.js <script src> tag — inserting before </head>');
        html = html.replace('</head>', newTag + '\n</head>');
      }
    } else {
      html = html.replace(oldTag, newTag);
      console.log('✓  Replaced Three.js CDN tag with inline version');
    }

    // Also update the service worker asset list to remove the CDN URL
    // (it's now baked into the HTML, so no separate fetch needed)
    const SW_FILE = path.join(__dirname, 'sw.js');
    let sw = fs.readFileSync(SW_FILE, 'utf8');
    sw = sw.replace(
      /\s*'https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js',?\n?/,
      '\n  // Three.js is now bundled inline in the HTML\n'
    );
    fs.writeFileSync(SW_FILE, sw);
    console.log('✓  Updated sw.js (removed CDN asset from cache list)');

    // Bump the SW cache version so the new HTML is picked up immediately
    sw = fs.readFileSync(SW_FILE, 'utf8');
    sw = sw.replace(/const CACHE = 'ddl-v\d+';/, "const CACHE = 'ddl-v4';");
    fs.writeFileSync(SW_FILE, sw);
    console.log('✓  Bumped service worker cache to ddl-v4');

    fs.writeFileSync(HTML_FILE, html);
    console.log(`✓  Saved ${HTML_FILE}`);
    console.log('\n🎮  Done! The game is now fully self-contained and offline-ready.');
    console.log('    Serve it over HTTPS (run: node server.js) then install on your phone.\n');
  });
}).on('error', err => {
  console.error('✗  Network error:', err.message);
  process.exit(1);
});
