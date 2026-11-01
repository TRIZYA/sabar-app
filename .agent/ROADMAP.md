# Roadmap & Checklist Aplikasi Pemantau Harga

Dokumen ini dipakai untuk memantau progres proyek secara realistis. Alur inti yang ingin dicapai: pengguna menempel link produk, sistem mengambil harga, menyimpan riwayat, lalu memberi tahu saat harga turun mencapai target.

## Status proyek saat ini

Proyek berada di Fase 4. Firebase Auth, data per akun, dashboard, dan API produk manual sudah diimplementasikan; provider Auth serta index Rules remote perlu diverifikasi di Console.

- [x] README.md disusun.
- [x] AGENTS.md disusun (aturan kerja agent).
- [x] Keputusan database: Firebase Realtime Database, diakses lewat backend.
- [x] ROADMAP.md, UI.md, dan DATABASE_SCHEMA.md disusun.
- [ ] Toko pertama yang akan didukung belum dipilih.
- [ ] Fitur pemantauan harga otomatis belum diimplementasikan.

## Alur kerja yang ingin dicapai

1. Pengguna menempel link produk.
2. Backend mengambil nama, gambar, dan harga dari halaman toko.
3. Pengguna meninjau hasilnya dan menentukan harga target.
4. Produk dan titik harga pertama disimpan di Firebase.
5. Cron mengecek harga secara berkala dan menambah riwayat.
6. Jika harga mencapai atau di bawah target, notifikasi dikirim.
7. Pengguna melihat grafik riwayat dan keputusan beli dibantu ringkasan AI (opsional).

Jika salah satu langkah di atas belum jalan, aplikasi belum terasa sebagai pemantau harga yang nyata.

## Fase 1: Persiapan & konfigurasi awal
- [x] Putuskan nama aplikasi (`Sabar`) dan nama repository (`Sabar-app`).
- [x] Buat struktur folder frontend (Vite + React JSX) dan backend (Express).
- [x] Siapkan `.gitignore` (termasuk `.env` dan file service account).
- [x] Siapkan `.env.example` untuk frontend dan backend.
- [x] Pasang dependensi dasar.

## Fase 2: Firebase & data
- [x] Buat project Firebase dan aktifkan Realtime Database.
- [x] Atur Rules agar akses klien ditolak (`.read` dan `.write` `false`, dikonfirmasi pengguna).
- [ ] Terapkan dan verifikasi `.indexOn` dari `DATABASE_SCHEMA.md` di project Firebase.
- [x] Buat service account dan isi variabel environment di backend.
- [x] Buat service Firebase Admin di `backend/src/services/`.
- [x] Uji baca `/products` dan tulis-baca-hapus node sementara di `/test`.

## Fase 3: Pengembangan backend
### 3.1 Pengambilan harga
- [ ] Pilih satu toko pertama dan periksa ketentuan layanannya.
- [ ] Buat scraper pertama di `backend/src/scrapers/` (prioritaskan data terstruktur).
- [ ] Normalisasi hasil (nama, harga bilangan bulat, gambar).
- [ ] Tangani kegagalan: timeout, halaman berubah, harga tidak ditemukan.
- [x] Sediakan input harga manual sebagai cadangan saat menambahkan produk.
- [ ] Uji scraper dengan fixture HTML, bukan situs asli.

### 3.2 API produk
- [x] Endpoint `/api/health` dan `/api/health/firebase`.
- [ ] Endpoint pratinjau: terima link, kembalikan nama dan harga (belum menyimpan).
- [x] Endpoint tambah produk manual (validasi URL dan target, cek duplikasi `urlHash`).
- [x] Endpoint daftar produk dan detail produk.
- [x] Endpoint ubah target, jeda, dan hapus produk.
- [x] Endpoint edit harga sekarang; perbarui current/low/high dan tambah `pricePoint` manual secara atomik.
- [ ] Endpoint "cek sekarang" untuk pengecekan manual satu produk.
- [x] Endpoint input harga manual saat menambahkan produk.
- [x] Endpoint riwayat harga (dibatasi maksimal 90 titik).
- [x] Format response dan error yang konsisten.

### 3.3 Otomasi
- [ ] Job pengecekan harga berkala dengan jeda antar permintaan.
- [ ] Perbarui `currentPrice`, `lowestPrice`, `highestPrice`, dan `pricePoints` dalam satu update atomik.
- [ ] Bot Telegram: kirim notifikasi saat target tercapai.
- [ ] Cegah notifikasi berulang (cek `lastNotifiedAt` dan log `notifications`).

## Fase 4: Frontend
- [x] Layout dasar halaman ringkasan dan navigasi ke daftar produk.
- [x] Klien API di `src/utils/api.js` (tanpa path ganda `/api/api`).
- [x] Halaman daftar produk terhubung ke API (target tercapai di atas).
- [x] Pencarian dan filter produk (toko, status, sudah mencapai target).
- [x] Form tambah produk dua langkah dengan input manual sebelum disimpan.
- [ ] Pratinjau otomatis nama, gambar, dan harga sebelum disimpan (menunggu endpoint preview/scraper).
- [x] Detail produk dengan grafik riwayat harga dan rentang 7/30/semua (maksimal 90 titik dari API).
- [x] Ubah target, jeda, dan hapus produk.
- [x] Form edit harga sekarang dari detail produk.
- [ ] Tombol "cek sekarang".
- [x] Input harga manual.
- [x] Loading, empty, dan error state pada daftar serta validasi form.
- [x] Tampilan responsif untuk mobile dan desktop.
- [x] Notifikasi toast untuk aksi sukses atau gagal.
- [x] Firebase Auth Google/email-password, verifikasi email, reset kata sandi, dan logout.
- [x] Backend memverifikasi ID token dan mengisolasi data per UID.
- [ ] Aktifkan provider Google dan Email/Password, izinkan domain aplikasi, lalu uji login di Firebase Console.

## Fase 5: Fitur AI (puter.js)
- [ ] Ekstraksi nama dan harga dari teks atau HTML yang berantakan (pemicu oleh pengguna).
- [ ] Ringkasan tren harga ("cukup bagus untuk beli?").
- [ ] Rapikan nama produk yang panjang.
- [ ] Fallback jika AI tidak tersedia; fitur inti tetap jalan.

## Fase 6: Finishing & deploy
- [ ] Tes alur: tambah produk, harga terambil, riwayat tersimpan, target tercapai, notifikasi terkirim.
- [ ] Verifikasi Rules Firebase dan tidak ada secret di kode atau repository.
- [ ] Uji tampilan di berbagai ukuran layar.
- [ ] Atur environment variables di Vercel (perhatikan `FIREBASE_PRIVATE_KEY`).
- [ ] Atur penjadwalan pengecekan di lingkungan deploy.
- [ ] Lengkapi README dengan cara pakai.

## Prioritas

### P0 (wajib untuk MVP)
- [x] Firebase terhubung dari backend.
- [ ] Satu toko dapat diambil harganya.
- [ ] Tambah produk, daftar produk, dan riwayat harga berfungsi dari ujung ke ujung.
- [ ] Error handling dan loading state yang konsisten.

### P1 (penting setelah MVP)
- [ ] Cron pengecekan berkala.
- [ ] Notifikasi Telegram.
- [ ] Grafik riwayat harga yang rapi.
- [ ] Input harga manual sebagai cadangan.

### P2 (fitur lanjutan)
- [ ] Dukungan toko tambahan.
- [ ] Fitur AI dengan puter.js.
- [x] Implementasi autentikasi dan isolasi data per pengguna.
- [ ] Terapkan index Rules user-scoped di Firebase Console; data lama tidak dimigrasikan otomatis.
- [ ] Ekspor riwayat harga (CSV).
- [ ] Notifikasi tambahan lewat email atau WhatsApp.
- [ ] Perbandingan harga produk serupa antar toko.
- [ ] Mode gelap.
- [ ] Ekstensi browser untuk menambah produk dengan sekali klik.

## Gap kritis yang perlu diselesaikan

1. Sumber data harga: toko mana yang cukup stabil dan secara eksplisit mengizinkan akses otomatis. Tokopedia tidak dipilih untuk scraper: Terms melarang crawler/scraping, dan robots.txt melarang parameter `extParam` pada tautan uji.
2. Frekuensi pengecekan yang aman terhadap batas paket gratis Firebase dan tidak membebani toko.
3. Cara menjalankan cron di lingkungan deploy yang dipilih.
4. Keamanan: kredensial Firebase dan token Telegram tidak boleh bocor.
5. Jalur cadangan saat scraper gagal agar pengguna tetap bisa memakai aplikasi.

## Catatan pembaruan

Setiap kali satu item selesai, centang di sini dan perbarui bagian "Status proyek saat ini". Jika struktur data berubah, perbarui `DATABASE_SCHEMA.md`; jika tampilan berubah, perbarui `UI.md`.
