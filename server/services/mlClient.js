const http = require('http');
const https = require('https');

const ML_URL = process.env.ML_SERVICE_URL || null;

function requestJson(method, urlPath, body = null, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!ML_URL) return reject(new Error('ML_SERVICE_URL not configured'));
    const u = new URL(`${ML_URL}${urlPath}`);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const req = lib.request({
      hostname: u.hostname,
      port: parseInt(u.port, 10) || (u.protocol === 'https:' ? 443 : 80),
      path: `${u.pathname}${u.search}`,
      method,
      headers: payload ? {
        'Content-Type':'application/json',
        'Content-Length': Buffer.byteLength(payload),
      } : {},
    }, res => {
      let out = '';
      res.on('data', chunk => out += chunk);
      res.on('end', () => {
        try {
          const parsed = out ? JSON.parse(out) : {};
          if (res.statusCode >= 400) {
            const msg = parsed.detail || parsed.error || `ML request failed with ${res.statusCode}`;
            return reject(new Error(msg));
          }
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('ML timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function mlGet(path) { return requestJson('GET', path); }
function mlPost(path, body) { return requestJson('POST', path, body); }

module.exports = { mlGet, mlPost, ML_URL };
