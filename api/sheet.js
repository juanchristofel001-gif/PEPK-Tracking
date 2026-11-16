// Ambil isi Google Sheets (yang dibagikan "siapa saja yang memiliki link") sebagai CSV, khusus editor yang login.
const crypto = require('crypto');
const PROJECT = 'trapesium-4339d';
const EDITORS = ['juanchristofel001@gmail.com'];
let jwks = null, jwksAt = 0;
async function keys() {
  if (jwks && Date.now() - jwksAt < 3600e3) return jwks;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  jwks = (await r.json()).keys; jwksAt = Date.now(); return jwks;
}
const b64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
async function verify(tok) {
  const [h, p, s] = String(tok).split('.');
  const H = JSON.parse(b64u(h)), P = JSON.parse(b64u(p));
  if (H.alg !== 'RS256') throw new Error('alg');
  const k = (await keys()).find((x) => x.kid === H.kid);
  if (!k) throw new Error('kid');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), crypto.createPublicKey({ key: k, format: 'jwk' }), b64u(s));
  const now = Date.now() / 1000;
  if (!ok || P.aud !== PROJECT || P.iss !== 'https://securetoken.google.com/' + PROJECT || P.exp < now || !P.email_verified) throw new Error('invalid');
  return P;
}
function csvUrl(u) {
  let url;
  try { url = new URL(u); } catch (e) { return null; }
  if (url.hostname !== 'docs.google.com') return null;
  const gid = (url.hash.match(/gid=(\d+)/) || url.search.match(/gid=(\d+)/) || [])[1];
  const pub = url.pathname.match(/^\/spreadsheets\/d\/e\/([\w-]+)/);
  if (pub) return 'https://docs.google.com/spreadsheets/d/e/' + pub[1] + '/pub?output=csv' + (gid ? '&gid=' + gid : '');
  const id = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/);
  if (id) return 'https://docs.google.com/spreadsheets/d/' + id[1] + '/export?format=csv' + (gid ? '&gid=' + gid : '');
  return null;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let P;
  try { P = await verify(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); }
  catch (e) { return res.status(401).json({ error: 'Sesi login habis. Muat ulang app lalu coba lagi.' }); }
  if (EDITORS.indexOf(String(P.email || '').toLowerCase()) < 0) return res.status(403).json({ error: 'Hanya editor yang bisa mengimpor data.' });
  const src = csvUrl(String((req.query && req.query.url) || ''));
  if (!src) return res.status(400).json({ error: 'Link Google Sheets tidak dikenali.' });
  try {
    const r = await fetch(src, { redirect: 'follow' });
    const type = String(r.headers.get('content-type') || '');
    if (!r.ok || /text\/html/.test(type)) return res.status(403).json({ error: 'Sheet belum bisa dibaca. Di Google Sheets klik Bagikan, ubah akses umum ke "Siapa saja yang memiliki link", lalu coba lagi.' });
    const text = await r.text();
    if (text.length > 5e6) return res.status(413).json({ error: 'Sheet terlalu besar (lebih dari 5 MB).' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(502).json({ error: 'Gagal menghubungi Google Sheets. Coba lagi sebentar.' });
  }
};
