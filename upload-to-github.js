// ─────────────────────────────────────────────────────────────
//  Dodge Dash Legends — GitHub uploader
//  Uploads all PWA files directly via the GitHub API.
//  Run: node upload-to-github.js YOUR_GITHUB_TOKEN
// ─────────────────────────────────────────────────────────────
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const TOKEN = process.argv[2];
const OWNER = 'legend200711';
const REPO  = 'Dodge-Dash-Legends';
const BASE  = path.join(__dirname);

if (!TOKEN) {
  console.error('\n❌  Usage: node upload-to-github.js YOUR_GITHUB_TOKEN');
  console.error('   Get a token at: https://github.com/settings/tokens/new');
  console.error('   Required scope: repo (or public_repo)\n');
  process.exit(1);
}

// Files to upload: [localPath, repoPath]
const FILES = [
  ['index.html',                   'index.html'],
  ['manifest.json',                'manifest.json'],
  ['sw.js',                        'sw.js'],
  ['style.css',                    'style.css'],
  ['script.js',                    'script.js'],
  ['offline.html',                 'offline.html'],
  ['robots.txt',                   'robots.txt'],
  ['icons/icon-192.png',           'icons/icon-192.png'],
  ['icons/icon-512.png',           'icons/icon-512.png'],
  ['icons/apple-touch-icon.png',   'icons/apple-touch-icon.png'],
  ['icons/favicon.ico',            'icons/favicon.ico'],
];

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent':    'DDL-Uploader/1.0',
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(_) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getFileSHA(repoPath) {
  const res = await apiRequest('GET', `/repos/${OWNER}/${REPO}/contents/${repoPath}`);
  if (res.status === 200) return res.body.sha;
  return null;
}

async function uploadFile(localPath, repoPath) {
  const fullPath = path.join(BASE, localPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠  SKIP (not found): ${localPath}`);
    return;
  }
  const content = fs.readFileSync(fullPath).toString('base64');
  const sha = await getFileSHA(repoPath);
  const body = {
    message: `Update ${repoPath}`,
    content,
    ...(sha ? { sha } : {}),
  };
  const res = await apiRequest('PUT', `/repos/${OWNER}/${REPO}/contents/${repoPath}`, body);
  if (res.status === 200 || res.status === 201) {
    console.log(`  ✓  ${repoPath}`);
  } else {
    console.log(`  ✗  ${repoPath} — ${res.status}: ${JSON.stringify(res.body.message || res.body)}`);
  }
}

async function main() {
  console.log(`\nUploading to github.com/${OWNER}/${REPO} ...\n`);
  for (const [local, remote] of FILES) {
    await uploadFile(local, remote);
  }
  console.log('\n✅  Done! Wait ~60 seconds then visit:');
  console.log(`    https://${OWNER}.github.io/${REPO}/\n`);
}

main().catch(console.error);
