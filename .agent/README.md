# Pemantau Harga

Aplikasi web untuk memantau harga produk dari toko online. Tempel link produk, simpan riwayat harganya, dan dapatkan notifikasi saat harga turun di bawah target yang kamu tentukan.

> Status: tahap perancangan (MVP belum selesai).

## Fitur

**Fitur inti (MVP)**
- Login Google atau email/password dengan Firebase Auth, verifikasi email, dan reset kata sandi
- Produk dan riwayat harga terisolasi per akun
- Tambah produk lewat link, dengan pratinjau hasil sebelum disimpan
- Ambil nama, gambar, dan harga produk secara otomatis
- Tentukan harga target per produk
- Daftar produk: harga sekarang, target, perubahan harga, dan status
- Riwayat harga tersimpan di Firebase
- Detail produk: harga terendah dan tertinggi, grafik riwayat dengan garis target
- Edit target, jeda, dan hapus produk
- Input harga manual sebagai cadangan jika toko memblokir scraper

**Otomasi**
- Pengecekan harga berkala (cron)
- Notifikasi Telegram saat harga mencapai target, dengan pencegahan notifikasi berulang
- Status error yang jelas saat pengecekan gagal, plus tombol coba lagi
- Tombol "cek sekarang" untuk pengecekan manual per produk

**Kemudahan pakai**
- Pencarian dan filter produk (toko, status, sudah mencapai target)
- Urutan otomatis: produk yang sudah mencapai target tampil paling atas
- Toast untuk aksi sukses atau gagal
- Tampilan responsif, terutama untuk mobile
- Ekspor riwayat harga ke CSV

**Fitur AI (puter.js, opsional)**
- Ringkasan tren harga, misalnya "turun 12% dalam 2 minggu, cukup bagus untuk beli"
- Ekstraksi nama dan harga dari teks atau HTML berantakan saat parser biasa gagal
- Merapikan nama produk yang panjang
- Hasil AI ditandai sebagai saran, dan fitur inti tetap berjalan tanpa AI

**Fitur lanjutan (opsional)**
- Dukungan beberapa toko
- Login dan data per pengguna
- Perbandingan harga produk serupa antar toko
- Ekstensi browser untuk menambah produk dengan sekali klik
- Notifikasi tambahan lewat email atau WhatsApp
- Mode gelap

## Alur penggunaan

1. Tempel link produk.
2. Periksa hasil yang terambil (nama, gambar, harga) dan tentukan harga target.
3. Produk muncul di daftar dan dicek berkala.
4. Saat harga mencapai target, notifikasi dikirim.
5. Buka detail produk untuk melihat grafik riwayat, lalu putuskan membeli.

## Tech Stack

| Bagian | Teknologi |
| --- | --- |
| Frontend | React + Vite (JSX) |
| Backend | Node.js + Express |
| Database | Firebase Realtime Database (data berbentuk JSON), diakses lewat Firebase Admin SDK dari backend |
| AI (opsional) | [puter.js](https://developer.puter.com) |
| Deploy | Vercel |

## Arsitektur

```
React (Vite)  ->  Backend API  ->  Halaman toko
                      |
                      +-->  Firebase (Realtime Database)
                      |
                Penjadwal (cron)  ->  Notifikasi (Telegram)
```

- Pengambilan harga dilakukan di backend karena browser tidak bisa mengambil halaman toko lain secara langsung (CORS).
- Semua baca/tulis Realtime Database lewat backend memakai Firebase Admin SDK. Frontend hanya memakai Firebase Auth untuk identitas dan mengirim ID token; API memverifikasi token sebelum membaca data akun.
- Puter.js berjalan di sisi klien, jadi dipakai untuk fitur AI yang dipicu pengguna, bukan untuk pengecekan otomatis di latar belakang.

## Model Data

Struktur di Realtime Database:

```
/products/{productId}
    url, name, image, store, currentPrice, targetPrice, createdAt, updatedAt

/pricePoints/{productId}/{pointId}
    price, checkedAt
```

- `Product`: `id`, `url`, `name`, `image`, `store`, `currentPrice`, `targetPrice`
- `PricePoint`: `productId`, `price`, `checkedAt`

Riwayat harga dipisah dari data produk supaya daftar produk tetap ringan dan tidak ikut terunduh saat hanya menampilkan daftar.

## Struktur Folder (rencana)

```
.
├── backend/
│   ├── src/
│   │   ├── routes/        # endpoint API
│   │   ├── scrapers/      # pengambil harga per toko
│   │   ├── jobs/          # pengecekan berkala
│   │   ├── services/      # firebase, notifikasi
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── src/
│   ├── components/
│   ├── pages/
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
└── package.json
```

## Menyiapkan Firebase

1. Buat project di [Firebase Console](https://console.firebase.google.com).
2. Aktifkan **Realtime Database** dan pilih lokasi terdekat.
3. Atur **Rules** agar klien tidak bisa membaca atau menulis langsung (backend memakai Admin SDK yang tidak terikat rules):
   ```json
   {
     "rules": {
       ".read": false,
       ".write": false
     }
   }
   ```
4. Buat **service account** (Project settings > Service accounts > Generate new private key).
5. Salin nilai `project_id`, `client_email`, dan `private_key` dari file JSON ke `backend/.env`. Jangan commit file JSON-nya.

## Menjalankan Secara Lokal

Prasyarat: Node.js 18 atau lebih baru dan project Firebase yang sudah disiapkan.

```bash
# 1. Pasang dependensi
npm install
cd backend && npm install && cd ..

# 2. Salin file environment dan isi konfigurasi Firebase
cp .env.example .env

# 3. Jalankan backend
cd backend && npm run dev

# 4. Jalankan frontend (terminal lain)
npm run dev
```

Frontend berjalan di `http://localhost:5173`, backend di `http://localhost:3000` (sesuaikan dengan konfigurasi).

## Environment Variables

Contoh `backend/.env.example`:

```
PORT=3000
FIREBASE_DATABASE_URL=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CHECK_INTERVAL_MINUTES=60
```

Catatan:
- `FIREBASE_PRIVATE_KEY` berisi karakter baris baru. Di `.env` tulis sebagai satu baris dengan `\n`, lalu ubah kembali dengan `.replace(/\\n/g, "\n")` di kode. Hal yang sama berlaku saat mengisinya di dashboard Vercel.
- Jangan commit file `.env` atau file service account ke repository.

## Login dan keamanan akun

Aktifkan provider **Google** dan **Email/Password** di Firebase Console > Authentication > Sign-in method, serta pastikan domain aplikasi terdaftar pada Authorized domains. Pengguna email/password harus memverifikasi email sebelum API produk menerima ID token. Backend memverifikasi token, mengambil UID dari claims, dan menyimpan data di `/users/{sha256(uid)}/`; klien tidak mendapat akses langsung ke Realtime Database.

Frontend memerlukan `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, dan `VITE_FIREBASE_APP_ID` dari konfigurasi web Firebase. Nilai ini publik; service-account private key hanya boleh berada di environment backend.

Rules Realtime Database wajib tetap menolak akses (`.read` dan `.write` `false`). Terapkan index user-scoped dari `DATABASE_SCHEMA.md` setelah perubahan struktur. Data lama di `/products` dan `/pricePoints` tidak otomatis dipindahkan ke akun mana pun.

## Dokumentasi

- [`ROADMAP.md`](ROADMAP.md): checklist progres dan prioritas pengerjaan.
- [`UI.md`](UI.md): panduan tampilan dan alur pengguna.
- [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md): struktur data Firebase, konvensi, dan Rules.
- [`AGENTS.md`](AGENTS.md): aturan kerja untuk agent AI.

## Roadmap ringkas

- [ ] Siapkan Firebase dan koneksi Admin SDK
- [ ] Ambil nama dan harga dari satu link
- [ ] Form tambah produk dan daftar produk
- [ ] Simpan produk dan riwayat harga
- [ ] Grafik riwayat harga
- [ ] Cron pengecekan dan notifikasi Telegram
- [ ] Fitur AI dengan puter.js
- [ ] Deploy ke Vercel

Rincian lengkap ada di `ROADMAP.md`.

## Catatan

- Beberapa toko memblokir bot, jadi sediakan input harga manual sebagai cadangan.
- Patuhi ketentuan layanan toko dan beri jeda antar permintaan agar tidak membebani server mereka.
- Prioritaskan data terstruktur (JSON-LD atau API resmi) daripada membaca HTML mentah, karena lebih stabil.
- Jangan biarkan Rules Firebase dalam mode terbuka (`true`) karena siapa pun bisa membaca dan menimpa datamu.
- Versi awal ini belum memakai login. Jika nanti dipakai banyak orang, tambahkan autentikasi dan pisahkan data per pengguna.

## Lisensi

Belum ditentukan.
