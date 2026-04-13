// Set CORS on Firebase Storage bucket using Firebase CLI refresh token
// Run: node scripts/set-cors-firebase.cjs
const fs = require('fs');
const https = require('https');
const path = require('path');

const BUCKET_NAME = 'k12net-dashboard.firebasestorage.app';
const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const corsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cors.json'), 'utf8'));

// Read Firebase CLI refresh token
const configPath = path.join(require('os').homedir(), '.config/configstore/firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const refreshToken = config.tokens.refresh_token;

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': u.pathname.includes('token') ? 'application/x-www-form-urlencoded' : 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${text}`));
        else resolve(JSON.parse(text));
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

function patch(url, body, accessToken) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${accessToken}`,
      },
    }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${text}`));
        else resolve(JSON.parse(text));
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

async function main() {
  console.log('1. Getting access token...');
  const tokenResp = await post('https://oauth2.googleapis.com/token',
    `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${FIREBASE_CLIENT_ID}&client_secret=${FIREBASE_CLIENT_SECRET}`
  );
  const accessToken = tokenResp.access_token;
  console.log('   Access token obtained');

  console.log('2. Setting CORS on bucket:', BUCKET_NAME);
  const result = await patch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}?fields=cors`,
    { cors: corsConfig },
    accessToken
  );
  console.log('3. CORS set successfully!');
  console.log('   Result:', JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
