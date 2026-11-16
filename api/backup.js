// Backup otomatis harian ke Vercel Blob privat. Hanya editor yang login Google.
const { put, get, list, del } = require('@vercel/blob');
const { verify } = require('./_auth');
const EDITORS = ['juanchristofel001@gmail.com'];
const KEEP = 30;
const DIR = 'backup/';

function wibDate() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
async function all() {
  const out = []; let cursor;
  do { const r = await list({ prefix: DIR, cursor, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  return out.filter((b) => /^backup\/\d{4}-\d{2}-\d{2}\.json$/.test(b.pathname)).sort((a, b) => b.pathname.localeCompare(a.pathname));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let P;
  try { P = await verify(req.headers.authorization || ''); }
  catch (e) { return res.status(401).json({ error: 'Sesi login habis. Muat ulang aplikasi lalu coba lagi.' }); }
  if (EDITORS.indexOf(String(P.email || '').toLowerCase()) < 0) return res.status(403).json({ error: 'Hanya editor yang bisa mengakses backup.' });
  try {
    if (req.method === 'GET' && req.query && req.query.name) {
      const name = String(req.query.name);
      if (!/^backup\/\d{4}-\d{2}-\d{2}\.json$/.test(name)) return res.status(400).json({ error: 'Nama backup tidak valid.' });
      const r = await get(name, { access: 'private' });
      if (!r || !r.stream) return res.status(404).json({ error: 'Backup tidak ditemukan.' });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(await new Response(r.stream).text());
    }
    if (req.method === 'GET') {
      const b = await all();
      return res.status(200).json({ backups: b.map((x) => ({ name: x.pathname, date: x.pathname.slice(7, 17), size: x.size, at: x.uploadedAt })) });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak didukung' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const d = body && body.data;
    if (!d || !Array.isArray(d.visits) || !Array.isArray(d.edu)) return res.status(400).json({ error: 'Data backup tidak valid.' });
    if (!d.visits.length && !d.edu.length) return res.status(400).json({ error: 'Data kosong, backup dilewati.' });
    const name = DIR + wibDate() + '.json';
    let notes = {};
    try { const nr = await get('logbook/notes.json', { access: 'private' }); if (nr && nr.stream) notes = JSON.parse(await new Response(nr.stream).text()) || {}; } catch (e) { notes = {}; }
    const txt = JSON.stringify({ visits: d.visits, edu: d.edu, tomb: d.tomb || {}, notes, savedAt: new Date().toISOString(), by: P.email });
    await put(name, txt, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
    const old = (await all()).slice(KEEP);
    if (old.length) await del(old.map((x) => x.url));
    return res.status(200).json({ ok: true, name, visits: d.visits.length, edu: d.edu.length, removed: old.length });
  } catch (e) {
    console.log('backup gagal', e && e.message);
    return res.status(500).json({ error: 'Backup gagal: ' + String((e && e.message) || e).slice(0, 200) });
  }
};
