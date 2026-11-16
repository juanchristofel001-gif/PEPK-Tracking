// Catatan logbook per tanggal, disimpan privat di Vercel Blob. Hanya editor.
const { put, get } = require('@vercel/blob');
const { verify } = require('./_auth');
const EDITORS = ['juanchristofel001@gmail.com'];
const FILE = 'logbook/notes.json';

async function load() {
  try { const r = await get(FILE, { access: 'private' }); if (!r || !r.stream) return {}; return JSON.parse(await new Response(r.stream).text()) || {}; }
  catch (e) { if (/not.?found|404/i.test(String(e && (e.message || e.name)))) return {}; throw e; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let P;
  try { P = await verify(req.headers.authorization || ''); }
  catch (e) { return res.status(401).json({ error: 'Sesi login habis. Muat ulang aplikasi lalu coba lagi.' }); }
  if (EDITORS.indexOf(String(P.email || '').toLowerCase()) < 0) return res.status(403).json({ error: 'Hanya editor yang bisa mengakses catatan.' });
  try {
    if (req.method === 'GET') return res.status(200).json({ notes: await load() });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak didukung' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const date = String((body && body.date) || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Tanggal tidak valid.' });
    const text = String((body && body.text) || '').slice(0, 4000);
    const notes = await load();
    if (text.trim()) notes[date] = { text, at: new Date().toISOString() }; else delete notes[date];
    await put(FILE, JSON.stringify(notes), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
    return res.status(200).json({ ok: true, date });
  } catch (e) {
    console.log('notes gagal', e && e.message);
    return res.status(500).json({ error: 'Catatan gagal disimpan: ' + String((e && e.message) || e).slice(0, 200) });
  }
};
