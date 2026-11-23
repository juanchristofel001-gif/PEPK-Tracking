# Trapesium by OJK

Tracker Pelayanan dan Sistem Informasi Umum. Aplikasi web (PWA) untuk mencatat dan menganalisis pelayanan konsumen serta kegiatan edukasi keuangan di Kantor OJK Provinsi Banten. Status: prototipe.

Live: https://pepktracking.vercel.app (pengunjung) dan https://pepktracking.vercel.app/pegawai (pegawai)

## Isi repo

| Lokasi | Isi |
|---|---|
| `public/index.html` | Halaman publik pengunjung (alamat utama, juga `/layanan`): tombol ke Google Form resmi OJK dan info edukasi. Tanpa login, tidak menyimpan data. Link formulir di variabel `FORMULIR` |
| `public/pegawai/index.html` | Aplikasi dasbor pegawai di `/pegawai` (HTML, CSS, JS dalam satu file), wajib login |
| `public/sw.js` | Service worker untuk cache dan mode offline. Naikkan versi `CACHE` setiap ada perubahan besar |
| `public/manifest.webmanifest` | Manifest PWA |
| `public/.well-known/assetlinks.json` | Verifikasi domain untuk APK Android (TWA) |
| `icons/*.svg` | Sumber ikon. PNG dibuat otomatis saat build |
| `api/` | Fungsi server Vercel |
| `build.mjs` | Skrip build: membuat ikon PNG dari SVG |
| `firestore.rules` | Aturan keamanan Firestore (siapa boleh membaca/menulis). Disalin manual ke Firebase Console |

### Fungsi server (`api/`)

| File | Fungsi |
|---|---|
| `summary.js` | Interpretasi AI untuk "Unduh rangkuman" (Gemini). Hanya menerima angka agregat |
| `sentiment.js` | Analisis sentimen catatan petugas (Gemini) |
| `backup.js` | Backup otomatis harian ke Vercel Blob privat, simpan 30 hari |
| `notes.js` | Catatan harian Logbook di Vercel Blob privat |
| `sheet.js` | Impor dari Google Sheets yang dibagikan publik atau dipublikasikan ke web (cadangan). Link sheet biasa dibaca langsung oleh browser lewat Google Sheets API dengan izin `spreadsheets.readonly` akun yang login, jadi sheet boleh tetap privat |
| `sync.js`, `seed.js` | Sinkronisasi dan data awal versi lama (sebelum Firebase) |
| `kirim-agregat.js` | Meneruskan angka agregat pelayanan (jumlah per bulan × jenis × kategori topik, tanpa data pribadi) ke SiPEDULIKU. Hanya pemilik. Dipanggil otomatis saat aplikasi dibuka kalau angkanya berubah |
| `_kategori.js` | Daftar kategori topik, sama persis dengan `TOPIK` di SiPEDULIKU. Ubah di kedua repo sekaligus |
| `_auth.js`, `_gemini.js` | Helper: verifikasi login Firebase dan panggilan Gemini |

## Layanan yang dipakai

- **Firebase** (proyek `trapesium-4339d`): login Google dan database Firestore (koleksi `visits` dan `edu`). Konfigurasi web ada di `pegawai/index.html` (variabel `FBC`); ini bukan rahasia, keamanan diatur oleh Firestore Security Rules.
- **Vercel**: hosting, fungsi `api/`, dan Blob store privat.
- **Gemini API** (Google AI Studio, tier gratis): AI untuk rangkuman dan sentimen.

## Google Sheets API

Impor sheet privat butuh **Google Sheets API** aktif di project Google Cloud `trapesium-4339d` (Google Cloud Console → APIs & Services → Library → Google Sheets API → Enable). Selama belum aktif, impor link otomatis memakai cara lama (sheet harus dibagikan "Siapa saja yang memiliki link").

## Environment variables (Vercel → Settings → Environment Variables)

| Nama | Untuk |
|---|---|
| `GEMINI_API_KEY` | Key dari aistudio.google.com. Wajib untuk fitur AI |
| `GEMINI_MODEL` | Opsional, memaksa model tertentu |
| `BLOB_READ_WRITE_TOKEN` | Otomatis dari Vercel Blob store |
| `SYNC_PIN` | Kode sinkron versi lama |
| `SIPEDULIKU_URL` | Alamat SiPEDULIKU, misal `https://….vercel.app`, untuk kirim agregat pelayanan |
| `KUNCI_AGREGAT` | Kunci rahasia yang sama dengan `KUNCI_AGREGAT` di Vercel SiPEDULIKU |

Setelah mengubah environment variable, deploy ulang agar terbaca.

## Hak akses

Hanya akun yang terdaftar yang bisa membuka Trapesium:
- **Pemilik**: email di `EDITORS` (`public/pegawai/index.html`, `api/backup.js`, `api/notes.js`, `api/sheet.js`) dan di `firestore.rules`. Selalu editor, dan satu-satunya yang bisa mengatur daftar akses.
- **Akun lain**: didaftarkan pemilik lewat kartu **Akses akun** di tab Data (koleksi Firestore `akses`, satu dokumen per email, peran `pembaca` atau `editor`). Akun yang tidak terdaftar langsung ditolak setelah login.

Kunci sebenarnya ada di **Firestore Security Rules** (`firestore.rules`). Setiap kali file itu berubah, salin isinya ke Firebase Console → Firestore Database → Rules → Publish. Tanpa langkah itu, penolakan di aplikasi hanya tampilan.

Backup dan Logbook (fungsi `api/`) hanya untuk pemilik.

## Privasi

Semua teks yang dikirim ke Gemini lewat `api/_gemini.js`, dan di sana NIK, nomor HP, email, NPWP, dan nomor rekening diganti tanda seperti [NIK] (`api/_pii.js`). Detail dan Catatan yang diketik manual juga disamarkan sebelum disimpan.

Ke Gemini hanya dikirim angka agregat (rangkuman) dan teks catatan petugas (sentimen). Saat impor dari Google Sheets atau file, kolom data pribadi (nama, NIK, KK, NPWP, HP/WA, email, alamat, tanggal lahir, rekening, dll.) tidak pernah diimpor, dan NIK, nomor HP, email, NPWP, serta nomor rekening yang terselip di Detail/Catatan diganti tanda seperti [NIK] sebelum disimpan (fungsi `samarkan` di `pegawai/index.html`). Nama setelah sapaan (Bu, Pak, Sdr., Mbak, dll.) atau penanda ("atas nama", "a.n.", "bernama") diganti [NAMA], dan NIK yang ditulis dengan spasi/titik juga tertangkap. Nama tanpa sapaan, atau nama kedua yang ditulis huruf kecil, masih bisa lolos, jadi tetap hindari menulis nama konsumen di Catatan dan Detail.

**Wilayah konsumen.** Trapesium hanya menyimpan kab/kota dan kecamatan domisili (`kab`, `kec`). Saat impor, kolom alamat/domisili dibaca di browser untuk menebak kecamatan (dicocokkan ke daftar 155 kecamatan Banten, sama dengan SiPEDULIKU), lalu teks alamatnya dibuang. Impor ulang sheet melengkapi wilayah data lama yang cocok. Alamat yang tidak jelas (misalnya hanya "Tangerang", atau kecamatan kembar seperti Curug/Cibeber tanpa kab/kota) dibiarkan kosong daripada ditebak salah. Sebelum aplikasi dipakai lebih luas, konfirmasi kebijakan data ke pihak OJK.

## APK Android

APK dibuat dengan PWABuilder (Trusted Web Activity), paket `app.vercel.pepktracking.twa`. Isi aplikasi ikut ter-update otomatis dari web. File keystore penandatangan **tidak** disimpan di repo ini; simpan sendiri dengan aman, karena diperlukan untuk setiap pembaruan APK.

## Menjalankan lokal

```
cd public && python3 -m http.server 8000
```

Login Google hanya berjalan di domain yang terdaftar di Firebase Authentication. Fitur `api/` butuh `vercel dev`.
