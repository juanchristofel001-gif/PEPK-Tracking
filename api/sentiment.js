// Analisis sentimen konsumen lewat Gemini API (tier gratis Google AI Studio).
const { generate } = require('./_gemini');
const ALLOWED = /(^|\.)pepktracking(-[a-z0-9-]+)?\.vercel\.app$|^localhost$/;
const MAP = { positif: 'pos', negatif: 'neg', netral: 'net' };
const LITE = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];

function hostOf(u) { try { return new URL(u).hostname; } catch (e) { return ''; } }

async function classify(note) {
  const prompt = 'Kamu menilai sentimen KONSUMEN dari catatan petugas layanan konsumen OJK. ' +
    'Nilai perasaan atau kepuasan konsumen, bukan topik kasusnya. ' +
    'Jawab hanya satu kata: positif, negatif, atau netral.\n\nCatatan petugas:\n"""' + note + '"""';
  const r = await generate(prompt, { prefer: LITE, temperature: 0, maxTokens: 1024, timeout: 9000 });
  const txt = r.text.toLowerCase();
  const k = Object.keys(MAP).find((w) => txt.includes(w));
  if (!k) throw new Error('jawaban tak terbaca: ' + txt.slice(0, 50));
  return { s: MAP[k], model: r.model };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET' && req.query && req.query.ping) {
      const r = await classify('Konsumen merasa terbantu dan berterima kasih atas penjelasannya.');
      return res.status(200).json({ ok: true, model: r.model, sentimen: r.s });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
    const origin = hostOf(req.headers.origin || req.headers.referer || '');
    if (!ALLOWED.test(origin)) return res.status(403).json({ error: 'Asal permintaan tidak diizinkan' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const note = String((body && body.note) || '').trim().slice(0, 600);
    if (!note) return res.status(400).json({ error: 'Catatan kosong' });
    const r = await classify(note);
    return res.status(200).json({ sentimen: r.s });
  } catch (e) {
    return res.status(e.status && e.status < 600 ? e.status : 502).json({ error: String(e.message || e) });
  }
};
