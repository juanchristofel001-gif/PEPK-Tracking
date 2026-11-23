// Samarkan data pribadi (NIK, nomor HP, email, NPWP, nomor rekening) dari teks.
// Dipakai di api/_gemini.js sebagai gerbang terakhir: apa pun yang dikirim ke Gemini lewat sini dulu.
// Aturan yang sama dengan fungsi samarkan() di public/index.html.
// Samarkan nama orang: kata setelah sapaan (Bu/Pak/Sdr/...) atau penanda nama ("atas nama", "bernama", "a.n.").
var SAPA='(?:ibu|bu|bapak|bpk|pak|sdr|sdri|saudara|saudari|mas|mbak|mba|kak|kang|teh|neng|aa|tn|ny|nn|nyonya|tuan)';
var PENANDA='(?:atas nama|a\\.n\\.?|bernama|namanya)';
var BUKAN=/^(dari|yang|sudah|belum|ini|itu|dan|atau|petugas|kepala|ke|di|untuk|tersebut|konsumen|nasabah|bank|menanyakan|mengadu|datang|ingin|mau|sedang|tidak|bisa|juga|saja|lagi|sendiri|nya|dengan|pada|karena|merasa|bilang|minta|meminta|bertanya|terkait|soal|tentang|selaku|sebagai|lurah|rt|rw|ojk|polisi|debt|kolektor|collector|pemilik|orang|perusahaan)$/i;
function ci(p){return p.replace(/[a-z]/g,function(c){return '['+c+c.toUpperCase()+']'})}
function samarkanNama(t){t=String(t||'');var n=0;
 t=t.replace(new RegExp('(^|[^A-Za-z])('+ci(SAPA)+'\\.?)\\s+([A-Za-z\'][A-Za-z\'.-]*)((?:\\s+[A-Z][A-Za-z\'.-]*){0,3})','g'),function(m,a,s,w1,rest){
  if(BUKAN.test(w1)||w1==='[NAMA]')return m;n++;return a+s+' [NAMA]'});
 t=t.replace(new RegExp('(^|[^A-Za-z])('+ci(PENANDA)+')\\s*:?\\s+([A-Za-z\'][A-Za-z\'.-]*)((?:\\s+[A-Z][A-Za-z\'.-]*){0,3})','g'),function(m,a,s,w1,rest){
  if(BUKAN.test(w1))return m;n++;return a+s+' [NAMA]'});
 return{t:t,n:n}}

function samarkan(t) {
  t = String(t || '');
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
  t = t.replace(/\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}/g, '[NPWP]');
  t = t.replace(/(^|[^\d])(\d{16})(?!\d)/g, '$1[NIK]');
  t = t.replace(/(^|[^\d])(\d(?:[ .-]?\d){15})(?![\d])/g, (m, a, n) => (/^(\+?62|0)8/.test(n) ? m : a + '[NIK]'));
  t = t.replace(/(^|[^\d+])((?:\+62|62|0)\s?8[\d\s.-]{7,14}\d)(?!\d)/g, (m, a, n) => (n.replace(/\D/g, '').length < 10 ? m : a + '[no. HP]'));
  t = t.replace(/(rp\.?\s*)?(\d[\d.\s-]{8,}\d)/gi, (m, rp, n) => (rp || n.replace(/\D/g, '').length < 10 ? m : '[nomor]'));
  return samarkanNama(t).t;
}
module.exports = { samarkan };
