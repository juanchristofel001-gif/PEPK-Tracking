# Trapesium by OJK

Tracker Pelayanan dan Sistem Informasi Umum. Aplikasi web (PWA) untuk mencatat dan menganalisis pelayanan konsumen serta kegiatan edukasi keuangan di Kantor OJK Provinsi Banten. Status: prototipe.

Live: https://pepktracking.vercel.app

## Isi repo

| Lokasi | Isi |
|---|---|
| `public/index.html` | Seluruh aplikasi (HTML, CSS, JS dalam satu file) |
| `public/sw.js` | Service worker untuk cache dan mode offline. Naikkan versi `CACHE` setiap ada perubahan besar |
| `public/manifest.webmanifest` | Manifest PWA |
| `public/.well-known/assetlinks.json` | Verifikasi domain untuk APK Android (TWA) |
| `icons/*.svg` | Sumber ikon. PNG dibuat otomatis saat build |
| `api/` | Fungsi server Vercel |
| `build.mjs` | Skrip build: membuat ikon PNG dari SVG |

### Fungsi server (`api/`)

| File | Fungsi |
|---|---|
| `summary.js` | Interpretasi AI untuk "Unduh rangkuman" (Gemini). Hanya menerima angka agregat |
| `sentiment.js` | Analisis sentimen catatan petugas (Gemini) |
| `backup.js` | Backup otomatis harian ke Vercel Blob privat, simpan 30 hari |
| `notes.js` | Catatan harian Logbook di Vercel Blob privat |
| `sheet.js` | Impor dari Google Sheets |
| `sync.js`, `seed.js` | Sinkronisasi dan data awal versi lama (sebelum Firebase) |
| `_auth.js`, `_gemini.js` | Helper: verifikasi login Firebase dan panggilan Gemini |

## Layanan yang dipakai

- **Firebase** (proyek `trapesium-4339d`): login Google dan database Firestore (koleksi `visits` dan `edu`). Konfigurasi web ada di `index.html` (variabel `FBC`); ini bukan rahasia, keamanan diatur oleh Firestore Security Rules.
- **Vercel**: hosting, fungsi `api/`, dan Blob store privat.
- **Gemini API** (Google AI Studio, tier gratis): AI untuk rangkuman dan sentimen.

## Environment variables (Vercel → Settings → Environment Variables)

| Nama | Untuk |
|---|---|
| `GEMINI_API_KEY` | Key dari aistudio.google.com. Wajib untuk fitur AI |
| `GEMINI_MODEL` | Opsional, memaksa model tertentu |
| `BLOB_READ_WRITE_TOKEN` | Otomatis dari Vercel Blob store |
| `SYNC_PIN` | Kode sinkron versi lama |

Setelah mengubah environment variable, deploy ulang agar terbaca.

## Hak akses

Editor (boleh menambah, mengubah, backup, logbook) ditentukan di dua tempat yang harus sama:
- `EDITORS` di `public/index.html`
- `EDITORS` di `api/backup.js` dan `api/notes.js`

Pengguna lain yang login hanya bisa melihat.

## Privasi

Ke Gemini hanya dikirim angka agregat (rangkuman) dan teks catatan petugas (sentimen). Saat impor dari Google Sheets atau file, kolom data pribadi (nama, NIK, KK, NPWP, HP/WA, email, alamat, tanggal lahir, rekening, dll.) tidak pernah diimpor, dan NIK, nomor HP, email, NPWP, serta nomor rekening yang terselip di Detail/Catatan diganti tanda seperti [NIK] sebelum disimpan (fungsi `samarkan` di `index.html`). Nama orang di dalam teks bebas belum bisa disaring otomatis, jadi tetap jangan menulis nama konsumen di Catatan dan Detail. Sebelum aplikasi dipakai lebih luas, konfirmasi kebijakan data ke pihak OJK.

## APK Android

APK dibuat dengan PWABuilder (Trusted Web Activity), paket `app.vercel.pepktracking.twa`. Isi aplikasi ikut ter-update otomatis dari web. File keystore penandatangan **tidak** disimpan di repo ini; simpan sendiri dengan aman, karena diperlukan untuk setiap pembaruan APK.

## Menjalankan lokal

```
cd public && python3 -m http.server 8000
```

Login Google hanya berjalan di domain yang terdaftar di Firebase Authentication. Fitur `api/` butuh `vercel dev`.
