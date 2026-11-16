// Verifikasi token login Firebase (Google) dari aplikasi.
const crypto = require('crypto');
const PROJECT = 'trapesium-4339d';
let jwks = null, jwksAt = 0;
async function keys() {
  if (jwks && Date.now() - jwksAt < 3600e3) return jwks;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  jwks = (await r.json()).keys; jwksAt = Date.now(); return jwks;
}
const b64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
async function verify(tok) {
  const [h, p, s] = String(tok).replace(/^Bearer\s+/i, '').split('.');
  const H = JSON.parse(b64u(h)), P = JSON.parse(b64u(p));
  if (H.alg !== 'RS256') throw new Error('alg');
  const k = (await keys()).find((x) => x.kid === H.kid);
  if (!k) throw new Error('kid');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), crypto.createPublicKey({ key: k, format: 'jwk' }), b64u(s));
  const now = Date.now() / 1000;
  if (!ok || P.aud !== PROJECT || P.iss !== 'https://securetoken.google.com/' + PROJECT || P.exp < now || !P.email_verified) throw new Error('invalid');
  return P;
}
module.exports = { verify };
