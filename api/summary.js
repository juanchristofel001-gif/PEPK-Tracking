// Interpretasi AI untuk "Unduh rangkuman" dasbor. Yang dikirim hanya angka agregat, tanpa data pribadi konsumen.
const { generate } = require('./_gemini');
const { verify } = require('./_auth');

const KEYS = {
  pel: { tren: 'Tren layanan harian', komposisi: 'Komposisi jenis layanan', jam: 'Jam sibuk (hari dan jam kedatangan)', gender: 'Jenis kelamin per layanan', sentimen: 'Sentimen konsumen', keperluan: 'Keperluan terbanyak' },
  edu: { peserta: 'Peserta per kegiatan', demografi: 'Peserta per demografi', bulan: 'Peserta per bulan', lokasi: 'Lokasi dengan peserta terbanyak' }
};

function prompt(space, agg, desc) {
  const what = space === 'edu' ? 'kegiatan edukasi keuangan' : 'layanan konsumen (pengecekan SLIK, pengaduan, dan layanan lain) di kantor';
  const keys = KEYS[space];
  return [
    'Kamu analis data di Kantor OJK Provinsi Banten. Tulis rangkuman dasbor ' + what + ' untuk laporan internal.',
    'Aturan:',
    '- Bahasa Indonesia formal, kalimat lugas, tanpa basa-basi dan tanpa emoji.',
    '- Pakai HANYA angka yang ada di DATA. Jangan mengarang angka, persentase, atau fakta baru. Kalau menghitung (misal selisih atau persentase), hitung dengan teliti dari DATA.',
    '- Bedakan fakta dan dugaan: penjelasan sebab ditulis sebagai kemungkinan ("kemungkinan", "dapat menunjukkan").',
    '- Kalau datanya sedikit, sebutkan bahwa kesimpulan masih terbatas.',
    '- Jangan mengulang kalimat DESKRIPSI apa adanya; interpretasi menjelaskan arti dan implikasinya.',
    '',
    'Balas JSON saja dengan bentuk persis:',
    '{"ringkasan":"2-3 kalimat gambaran umum","sorotan":["3-4 poin temuan utama, masing-masing 1 kalimat"],"interpretasi":{' + Object.keys(keys).map((k) => '"' + k + '":"2-3 kalimat"').join(',') + '},"rekomendasi":["2-4 saran tindak lanjut yang praktis, masing-masing 1 kalimat"]}',
    '',
    'Arti kunci interpretasi: ' + Object.keys(keys).map((k) => k + ' = ' + keys[k]).join('; ') + '.',
    '',
    'DESKRIPSI (fakta per grafik, sudah dihitung):',
    JSON.stringify(desc),
    '',
    'DATA (agregat):',
    JSON.stringify(agg)
  ].join('\n');
}

// Model cepat dulu (sudah terbukti jalan dengan key ini); model lain jadi cadangan.
const FAST = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];

function clean(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 900); }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  try { await verify(req.headers.authorization || ''); }
  catch (e) { return res.status(401).json({ error: 'Sesi login habis. Muat ulang aplikasi lalu coba lagi.' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const space = body && body.space === 'edu' ? 'edu' : 'pel';
  const agg = body && body.agg, desc = (body && body.desc) || {};
  if (!agg || typeof agg !== 'object') return res.status(400).json({ error: 'Data rangkuman kosong.' });
  if (JSON.stringify(agg).length > 40000) return res.status(413).json({ error: 'Data terlalu besar untuk dirangkum.' });
  try {
    const t0 = Date.now();
    const r = await generate(prompt(space, agg, desc), { json: true, prefer: FAST, temperature: 0.3, maxTokens: 8192, timeout: 40000 });
    console.log('summary', space, r.model, (Date.now() - t0) + 'ms');
    let j;
    try { j = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
    catch (e) { return res.status(502).json({ error: 'Jawaban AI tidak terbaca. Coba lagi.' }); }
    const out = { model: r.model, ringkasan: clean(j.ringkasan, 1200), sorotan: [], interpretasi: {}, rekomendasi: [] };
    (Array.isArray(j.sorotan) ? j.sorotan : []).slice(0, 5).forEach((x) => { if (clean(x)) out.sorotan.push(clean(x, 400)); });
    (Array.isArray(j.rekomendasi) ? j.rekomendasi : []).slice(0, 5).forEach((x) => { if (clean(x)) out.rekomendasi.push(clean(x, 400)); });
    Object.keys(KEYS[space]).forEach((k) => { if (j.interpretasi && j.interpretasi[k]) out.interpretasi[k] = clean(j.interpretasi[k]); });
    return res.status(200).json(out);
  } catch (e) {
    console.log('summary gagal', e.status, e.message);
    return res.status(e.status && e.status < 600 ? e.status : 502).json({ error: String(e.message || e) });
  }
};
