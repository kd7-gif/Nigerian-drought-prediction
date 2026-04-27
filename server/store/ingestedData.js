const fs = require('fs');
const path = require('path');

const INGEST_FILE = path.join(__dirname, '..', 'ingested_data.json');
const ingestedData = {};
if (fs.existsSync(INGEST_FILE)) {
  try {
    Object.assign(ingestedData, JSON.parse(fs.readFileSync(INGEST_FILE, 'utf8')));
  } catch (e) {
    console.warn('ingested_data.json load failed:', e.message);
  }
}

function saveIngestedData() {
  fs.writeFileSync(INGEST_FILE, JSON.stringify(ingestedData, null, 2));
}

module.exports = { ingestedData, saveIngestedData };
