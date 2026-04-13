// Promote a user to super-admin role using Firestore REST API
// Usage: node scripts/promote-super-admin.cjs <email>
// Example: node scripts/promote-super-admin.cjs ismaila@century.consulting

const fs = require('fs');
const path = require('path');
const https = require('https');

const EMAIL = process.argv[2];
if (!EMAIL) {
  console.error('Usage: node scripts/promote-super-admin.cjs <email>');
  process.exit(1);
}

const PROJECT_ID = 'k12net-dashboard';
const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, ...options }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const configPath = path.join(require('os').homedir(), '.config/configstore/firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const refreshToken = config.tokens.refresh_token;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: FIREBASE_CLIENT_ID,
    client_secret: FIREBASE_CLIENT_SECRET,
    refresh_token: refreshToken,
  }).toString();

  const result = await httpRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length },
  }, body);

  return result.access_token;
}

async function firestoreQuery(accessToken, collectionId, fieldPath, value) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } }
      }
    }
  });
  return httpRequest(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
}

async function firestorePatch(accessToken, docPath, fields) {
  const params = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const url = `https://firestore.googleapis.com/v1/${docPath}?${params}`;
  const mapFields = {};
  for (const [k, v] of Object.entries(fields)) {
    mapFields[k] = { stringValue: v };
  }
  const body = JSON.stringify({ fields: mapFields });
  return httpRequest(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
}

async function main() {
  console.log(`🔑 Getting access token from Firebase CLI...`);
  const token = await getAccessToken();

  console.log(`🔍 Looking for user with email: ${EMAIL}`);
  const results = await firestoreQuery(token, 'users', 'email', EMAIL);

  if (!results || !results[0]?.document) {
    console.error(`❌ No user found with email: ${EMAIL}`);
    process.exit(1);
  }

  const doc = results[0].document;
  const docName = doc.name; // full path
  const displayName = doc.fields?.displayName?.stringValue || EMAIL;
  const currentRole = doc.fields?.role?.stringValue || 'user';

  console.log(`   Found: ${displayName} (role: ${currentRole})`);

  await firestorePatch(token, docName, { role: 'super-admin' });

  console.log(`✅ "${displayName}" is now super-admin!`);
  console.log(`   → Access /super-admin to manage establishments.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
