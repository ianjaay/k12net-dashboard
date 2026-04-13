// Temporary script to set CORS on Firebase Storage bucket
// Run: node scripts/set-cors.cjs
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

const BUCKET_NAME = 'k12net-dashboard.firebasestorage.app';
const corsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cors.json'), 'utf8'));

async function main() {
  const storage = new Storage();
  const bucket = storage.bucket(BUCKET_NAME);
  
  console.log('Setting CORS on bucket:', BUCKET_NAME);
  console.log('CORS config:', JSON.stringify(corsConfig, null, 2));
  
  await bucket.setCorsConfiguration(corsConfig);
  console.log('CORS configuration set successfully!');
  
  // Verify
  const [metadata] = await bucket.getMetadata();
  console.log('Verified CORS:', JSON.stringify(metadata.cors, null, 2));
}

main().catch(err => {
  console.error('Failed to set CORS:', err.message);
  console.error('\nMake sure you are authenticated with Google Cloud:');
  console.error('  gcloud auth application-default login');
  console.error('Or set GOOGLE_APPLICATION_CREDENTIALS to a service account key file.');
  process.exit(1);
});
