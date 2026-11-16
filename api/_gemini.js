// Panggilan Gemini API (Google AI Studio, tier gratis). Key disimpan di env GEMINI_API_KEY di Vercel.
const CHAIN = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];
let good = null;

class GeminiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

async function call(model, key, prompt, opt) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: Object.assign({ temperature: opt.temperature == null ? 0.3 : opt.temperature, maxOutputTokens: opt.maxTokens || 4096 }, opt.json ? { responseMimeType: 'application/json' } : {})
  };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opt.timeout || 45000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new GeminiError(String((j.error && j.error.message) || ('HTTP ' + r.status)).slice(0, 300), r.status);
  const c = j.candidates && j.candidates[0];
  const parts = (c && c.content && c.content.parts) || [];
  const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  if (!text) throw new GeminiError('Jawaban kosong (' + ((c && c.finishReason) || 'tanpa alasan') + ')', 502);
  return text;
}

// Coba model satu per satu; model yang tidak tersedia untuk key ini dilewati.
async function generate(prompt, opt) {
  opt = opt || {};
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError('GEMINI_API_KEY belum diisi di Vercel', 503);
  const pref = opt.prefer || [];
  const list = [process.env.GEMINI_MODEL, good].concat(pref, CHAIN).filter((m, i, a) => m && a.indexOf(m) === i);
  let last = null;
  for (const m of list) {
    try { const t = await call(m, key, prompt, opt); good = m; return { text: t, model: m }; }
    catch (e) {
      last = e;
      if (e.status === 401 || e.status === 403 && !/model/i.test(e.message)) throw new GeminiError('API key Gemini ditolak. Periksa GEMINI_API_KEY di Vercel.', 401);
      if (e.status === 400 && /api key/i.test(e.message)) throw new GeminiError('API key Gemini tidak valid. Periksa GEMINI_API_KEY di Vercel.', 401);
      if (e.status === 429 && m === list[list.length - 1]) break;
      continue; // 404 model tidak ada, 429 kuota model ini habis, 5xx: coba model berikutnya
    }
  }
  if (last && last.status === 429) throw new GeminiError('Kuota gratis Gemini sedang habis. Coba lagi beberapa menit lagi.', 429);
  throw last || new GeminiError('Tidak ada model Gemini yang bisa dipakai', 502);
}

module.exports = { generate, GeminiError };
