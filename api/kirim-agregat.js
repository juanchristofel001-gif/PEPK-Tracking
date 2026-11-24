// Meneruskan angka agregat pelayanan ke SiPEDULIKU (aplikasi edukasi), untuk kartu
// "Pelayanan vs edukasi". Yang dikirim hanya jumlah per bulan x jenis layanan x kategori topik:
// tanpa catatan, ringkasan, nama, atau data pribadi apa pun.
// Kunci rahasia ke SiPEDULIKU hanya ada di server ini (env), tidak pernah sampai ke browser.
const { verify } = require('./_auth');
const KATEGORI = require('./_kategori');
const EDITORS = ['juanchristofel001@gmail.com'];
const JENIS = ['SLIK', 'Pengaduan', 'Lainnya'];
const KAB = ['Kota Serang', 'Kabupaten Serang', 'Kota Cilegon', 'Kota Tangerang', 'Kabupaten Tangerang', 'Kota Tangerang Selatan', 'Kabupaten Pandeglang', 'Kabupaten Lebak', 'Luar Banten'];

const bulanOk = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const angka = (n) => (Number.isInteger(n) && n >= 0 && n < 1e6 ? n : null);

// Saring ulang di server: hanya bentuk dan nilai yang dikenal yang diteruskan.
function bersihkan(a) {
  if (!a || typeof a !== 'object' || !Array.isArray(a.baris) || !a.perBulan || typeof a.perBulan !== 'object') return null;
  const perBulan = {};
  for (const [m, v] of Object.entries(a.perBulan)) {
    if (!bulanOk(m) || !v) continue;
    const t = angka(v.total), d = angka(v.dianalisis), k = angka(v.berkategori);
    if (t == null || d == null || k == null) continue;
    perBulan[m] = { total: t, dianalisis: d, berkategori: k };
  }
  const baris = [];
  for (const r of a.baris.slice(0, 20000)) {
    if (!r || !bulanOk(r.bulan) || !JENIS.includes(r.jenis) || !KATEGORI.includes(r.kategori)) continue;
    const n = angka(r.jumlah);
    if (!n) continue;
    const kab = KAB.includes(r.kab) ? r.kab : '';
    const kec = kab && /^[A-Za-z ]{2,40}$/.test(String(r.kec || '')) ? String(r.kec) : '';
    baris.push({ bulan: r.bulan, jenis: r.jenis, kategori: r.kategori, kab, kec, jumlah: n });
  }
  // Jumlah layanan berkategori (bukan penyebutan), untuk menghitung "% pengaduan tentang topik X".
  const layanan = [];
  for (const r of (Array.isArray(a.layanan) ? a.layanan : []).slice(0, 20000)) {
    if (!r || !bulanOk(r.bulan) || !JENIS.includes(r.jenis)) continue;
    const n = angka(r.jumlah);
    if (!n) continue;
    const kab = KAB.includes(r.kab) ? r.kab : '';
    const kec = kab && /^[A-Za-z ]{2,40}$/.test(String(r.kec || '')) ? String(r.kec) : '';
    layanan.push({ bulan: r.bulan, jenis: r.jenis, kab, kec, jumlah: n });
  }
  return { versi: 2, perBulan, baris, layanan };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  let P;
  try { P = await verify(req.headers.authorization || ''); }
  catch (e) { return res.status(401).json({ error: 'Sesi login habis.' }); }
  if (EDITORS.indexOf(String(P.email || '').toLowerCase()) < 0) return res.status(403).json({ error: 'Hanya pemilik yang mengirim agregat.' });
  const url = process.env.SIPEDULIKU_URL, kunci = process.env.KUNCI_AGREGAT;
  if (!url || !kunci) return res.status(503).json({ error: 'SIPEDULIKU_URL atau KUNCI_AGREGAT belum diisi di Vercel.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const data = bersihkan(body);
  if (!data) return res.status(400).json({ error: 'Data agregat tidak valid.' });
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/api/pelayanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kunci-agregat': kunci },
      body: JSON.stringify(data),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: j.error || 'SiPEDULIKU menolak (' + r.status + ').' });
    return res.status(200).json({ ok: true, baris: data.baris.length });
  } catch (e) {
    return res.status(502).json({ error: 'Tidak bisa menghubungi SiPEDULIKU.' });
  }
};
