// Samarkan data pribadi (NIK, nomor HP, email, NPWP, nomor rekening) dari teks.
// Dipakai di api/_gemini.js sebagai gerbang terakhir: apa pun yang dikirim ke Gemini lewat sini dulu.
// Aturan yang sama dengan fungsi samarkan() di public/index.html.
function samarkan(t) {
  t = String(t || '');
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
  t = t.replace(/\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}/g, '[NPWP]');
  t = t.replace(/(^|[^\d])(\d{16})(?!\d)/g, '$1[NIK]');
  t = t.replace(/(^|[^\d+])((?:\+62|62|0)\s?8[\d\s.-]{7,14}\d)(?!\d)/g, (m, a, n) => (n.replace(/\D/g, '').length < 10 ? m : a + '[no. HP]'));
  t = t.replace(/(rp\.?\s*)?(\d[\d.\s-]{8,}\d)/gi, (m, rp, n) => (rp || n.replace(/\D/g, '').length < 10 ? m : '[nomor]'));
  return t;
}
module.exports = { samarkan };
