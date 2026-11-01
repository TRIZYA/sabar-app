# Sabar

Aplikasi web untuk memantau harga produk toko online. Tempel tautan produk, simpan riwayat harganya, dan dapatkan notifikasi saat harga mencapai target.

Status: Fase 4, Firebase Auth, data per akun, dashboard, dan API produk manual tersedia.

## Teknologi

- Frontend: React + Vite (JavaScript/JSX)
- Backend: Node.js + Express
- Database: Firebase Realtime Database melalui Firebase Admin SDK di backend
- Auth: Firebase Authentication Google dan email/password
- Package manager: pnpm

## Menjalankan lokal

Pasang dependency dari root dan backend:

```bash
pnpm install
pnpm --dir backend install
```

Jalankan frontend dan backend di terminal terpisah:

```bash
pnpm dev
pnpm --dir backend dev
```

Frontend berjalan di `http://localhost:5173`, backend di `http://localhost:3000`.

## Environment

Salin `.env.example` ke `.env` root, lalu isi konfigurasi web `VITE_FIREBASE_*` dan variabel Firebase Admin. Backend memuat file root tersebut saat dijalankan. Jangan mengisi secret di file contoh atau mengirimkannya ke repository.

Semua baca/tulis Realtime Database dilakukan dari backend. Frontend memakai Firebase Auth untuk memperoleh ID token; backend memverifikasi token dan hanya memberi akses untuk email terverifikasi. Rules database tetap menetapkan `.read` dan `.write` ke `false`.

## API Produk

Base path: `/api/products`.

Semua endpoint produk dan `GET /api/health/firebase` membutuhkan `Authorization: Bearer <Firebase ID token>` dari sesi login.

- `GET /api/products`: daftar maksimal 100 produk terbaru.
- `POST /api/products`: tambah produk dengan input manual `{ "url", "name", "currentPrice", "targetPrice", "image?" }`.
- `GET /api/products/:productId`: detail produk.
- `PATCH /api/products/:productId`: ubah harga sekarang, target, dan/atau status (`aktif` atau `dijeda`). Perubahan harga manual menambah titik histori.
- `DELETE /api/products/:productId`: hapus produk dan riwayatnya.
- `GET /api/products/:productId/price-history?limit=90`: riwayat harga, maksimal 90 titik.

Respons berhasil memakai `{ "data": ... }`; error memakai `{ "error": { "code", "message" } }`. Preview dan scraper otomatis belum tersedia sampai toko pertama dipilih.

## Firebase

- `backend/src/services/firebase.js` menyediakan singleton Firebase Admin SDK.
- `database.rules.json` menolak semua akses klien dan mendefinisikan index sesuai skema.
- `firebase.json` menunjuk file Rules untuk deployment lewat Firebase CLI.
- Aktifkan provider Google dan Email/Password serta izinkan domain aplikasi di Firebase Authentication.
- Data baru disimpan di `/users/{sha256(uid)}/`; terapkan Rules/index user-scoped dari `database.rules.json` dan pastikan `.read` serta `.write` tetap `false`.
- Data lama di `/products` dan `/pricePoints` tidak dimigrasikan otomatis.
- Simpan service account hanya melalui environment variables. Jangan commit `.env` atau file JSON kredensial.