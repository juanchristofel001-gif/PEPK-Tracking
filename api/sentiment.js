// Analisis catatan petugas lewat Gemini: sentimen konsumen, ringkasan masalah, dan topik kunci.
const { generate } = require('./_gemini');
const ALLOWED = /(^|\.)pepktracking(-[a-z0-9-]+)?\.vercel\.app$|^localhost$/;
const MAP = { positif: 'pos', negatif: 'neg', netral: 'net' };
const LITE = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
// Kategori bersama dengan SiPEDULIKU (shared/schema.ts → TOPIK). Ubah di kedua tempat sekaligus,
// karena perbandingan pelayanan vs edukasi hanya cocok kalau namanya persis sama.
const KATEGORI = require('./_kategori');

function hostOf(u) { try { return new URL(u).hostname; } catch (e) { return ''; } }
function clean(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); }

function pilihKategori(v) {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[;,]/) : [];
  const out = arr.map((x) => KATEGORI.find((k) => k.toLowerCase() === clean(x, 80).toLowerCase())).filter(Boolean);
  return [...new Set(out)].slice(0, 2);
}

async function analyze(note, known) {
  const prompt = [
    'Kamu membaca catatan petugas layanan konsumen OJK tentang satu konsumen.',
    'Balas JSON saja dengan bentuk persis: {"sentimen":"positif|negatif|netral","ringkas":"...","topik":["..."],"kategori":["..."]}',
    '- sentimen: perasaan atau kepuasan KONSUMEN, bukan topik kasusnya.',
    '- ringkas: satu kalimat, maksimal 15 kata, inti permasalahan atau keperluan konsumen. Jangan menyebut nama orang, NIK, nomor rekening, nomor telepon, alamat, atau data pribadi lain.',
    '- topik: 1 sampai 3 frasa kunci, masing-masing 1 sampai 3 kata, huruf kecil, istilah umum (contoh: "pinjol ilegal", "slik bermasalah", "penagihan kasar", "restrukturisasi kredit", "penipuan investasi"). Jangan memasukkan nama orang, nama perusahaan, atau data pribadi.',
    '- kategori: 1 atau 2 kategori yang paling sesuai dengan masalah konsumen, ditulis PERSIS seperti salah satu dari daftar ini: ' + KATEGORI.join('; ') + '. Pakai "Lainnya" hanya kalau benar-benar tidak ada yang cocok.',
    known && known.length ? '- Kalau maknanya sama, pakai persis salah satu topik yang sudah ada ini: ' + known.join(', ') + '.' : '',
    '',
    'Catatan petugas:',
    '"""' + note + '"""'
  ].filter(Boolean).join('\n');
  const r = await generate(prompt, { prefer: LITE, json: true, temperature: 0, maxTokens: 1024, timeout: 9000 });
  let j;
  try { j = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { j = {}; }
  const sw = Object.keys(MAP).find((w) => String(j.sentimen || r.text).toLowerCase().includes(w));
  if (!sw) throw new Error('jawaban tak terbaca');
  const topik = (Array.isArray(j.topik) ? j.topik : []).map((t) => clean(t, 40).toLowerCase().replace(/[^a-z0-9\s\-/]/g, '').trim()).filter((t) => t && t.split(' ').length <= 4).slice(0, 3);
  return { s: MAP[sw], ringkas: clean(j.ringkas, 160), topik: [...new Set(topik)], kategori: pilihKategori(j.kategori), model: r.model };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET' && req.query && req.query.ping) {
      const r = await analyze('Konsumen bertanya soal SLIK yang masih bermasalah padahal pinjaman sudah lunas, setelah dijelaskan konsumen merasa terbantu.', []);
      return res.status(200).json({ ok: true, model: r.model, sentimen: r.s, ringkas: r.ringkas, topik: r.topik, kategori: r.kategori });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
    const origin = hostOf(req.headers.origin || req.headers.referer || '');
    if (!ALLOWED.test(origin)) return res.status(403).json({ error: 'Asal permintaan tidak diizinkan' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const note = String((body && body.note) || '').trim().slice(0, 600);
    if (!note) return res.status(400).json({ error: 'Catatan kosong' });
    const known = (Array.isArray(body.known) ? body.known : []).map((t) => clean(t, 40)).filter(Boolean).slice(0, 40);
    const r = await analyze(note, known);
    return res.status(200).json({ sentimen: r.s, ringkas: r.ringkas, topik: r.topik, kategori: r.kategori });
  } catch (e) {
    return res.status(e.status && e.status < 600 ? e.status : 502).json({ error: String(e.message || e) });
  }
};
