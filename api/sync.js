// Sinkron data PEPK antar-perangkat. Data disimpan di Vercel Blob privat, dilindungi kode sinkron (SYNC_PIN).
const { put, get } = require('@vercel/blob');
const PATH = 'pepk/data.json';
const MAX = 20000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function clean(o) {
  if (!o || typeof o !== 'object') return null;
  const r = {};
  for (const k of Object.keys(o).slice(0, 30)) {
    const v = o[k];
    if (typeof v === 'string') r[k] = v.slice(0, 2000);
    else if (typeof v === 'number' || typeof v === 'boolean') r[k] = v;
  }
  return typeof r.id === 'string' && r.id ? r : null;
}
function merge(a, b) {
  const tomb = {};
  for (const src of [a.tomb, b.tomb]) for (const k in (src || {})) { const t = +src[k] || 0; if (t > (tomb[k] || 0)) tomb[k] = t; }
  const pick = (x, y) => {
    const m = new Map();
    for (const arr of [x, y]) for (const raw of (Array.isArray(arr) ? arr : []).slice(0, MAX)) {
      const it = clean(raw); if (!it) continue;
      const cur = m.get(it.id);
      if (!cur || (+it.u || 0) > (+cur.u || 0)) m.set(it.id, it);
    }
    return [...m.values()].filter((it) => !(tomb[it.id] && tomb[it.id] >= (+it.u || 0)));
  };
  return { visits: pick(a.visits, b.visits), edu: pick(a.edu, b.edu), tomb };
}
async function load() {
  try {
    const r = await get(PATH, { access: 'private' });
    if (!r || !r.stream) return { visits: [], edu: [], tomb: {} };
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (/not.?found|404/i.test(String(e && (e.name + ' ' + e.message)))) return { visits: [], edu: [], tomb: {} };
    throw e;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET' && req.query && req.query.health) {
      const d = await load();
      return res.status(200).json({ ok: true, pinSet: !!process.env.SYNC_PIN, records: (d.visits || []).length });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
    const pin = String(req.headers['x-pin'] || '').trim().toUpperCase();
    if (!process.env.SYNC_PIN || pin !== String(process.env.SYNC_PIN).trim().toUpperCase()) {
      await sleep(600);
      return res.status(401).json({ error: 'Kode sinkron salah' });
    }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const merged = merge(await load(), body || {});
    await put(PATH, JSON.stringify(merged), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
    return res.status(200).json(merged);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e).slice(0, 300) });
  }
};
