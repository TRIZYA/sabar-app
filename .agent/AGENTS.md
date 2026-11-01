# AGENTS.md — Aplikasi Web Pemantau Harga

## 1. Project Overview

Aplikasi pemantau harga produk toko online. Pengguna menempel link produk, sistem mengambil nama dan harga, menyimpan riwayat harga, lalu memberi notifikasi saat harga turun di bawah target.

Project masih pada tahap awal (MVP). Prioritaskan alur inti yang berfungsi dari ujung ke ujung sebelum menambah fitur lain, dan jangan membangun ulang arsitektur yang sudah berjalan.

Prinsip kerja utama:

**Inspect → Plan → Implement → Run → Preview → Evaluate → Refine → Verify**

Agent harus memeriksa hasil perubahan secara langsung melalui live preview jika alat browser tersedia, lalu memperbaiki lagi apabila hasilnya belum sesuai.

## 2. Project Structure

Struktur yang direncanakan (periksa struktur aktual sebelum membuat asumsi):

```text
pemantau-harga/
├── .agent/
│   └── AGENTS.md
├── backend/
│   ├── src/
│   │   ├── routes/        # endpoint API
│   │   ├── scrapers/      # pengambil harga per toko
│   │   ├── jobs/          # pengecekan berkala (cron)
│   │   ├── services/      # firebase, notifikasi
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── utils/
│   │   └── api.js
│   ├── App.jsx
│   └── main.jsx
├── public/
├── index.html
├── vite.config.js
├── vercel.json
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── ROADMAP.md
├── UI.md
└── DATABASE_SCHEMA.md
```

Folder root adalah area kerja aktif untuk frontend, backend, dan deployment. Struktur dapat berkembang sesuai kebutuhan fitur, tetapi perubahan penting harus dicek ulang sebelum dibuat asumsi.

## 3. Tech Stack

- Frontend: React + Vite (JSX)
- Backend: Node.js + Express
- API: REST
- Database: Firebase Realtime Database (JSON), diakses dari backend lewat Firebase Admin SDK
- AI (opsional): puter.js, sisi klien, hanya untuk fitur yang dipicu pengguna
- Notifikasi: bot Telegram (rencana)
- Deploy: Vercel

Jangan menambahkan framework UI, component library, ORM, atau dependensi baru tanpa kebutuhan yang jelas. `firebase-admin` di backend sudah disetujui. Firebase Web SDK disetujui hanya untuk Firebase Auth; jangan gunakan Firebase client SDK untuk membaca/menulis Realtime Database.

## 4. Key Commands

Jalankan dari root project. Periksa `package.json` terlebih dahulu dan jalankan hanya script yang benar-benar tersedia.

```bash
npm install
npm run dev
```

URL default frontend:

```text
http://localhost:5173
```

Script lain yang mungkin tersedia: `build`, `lint`, `test`. Jangan mengasumsikan semuanya ada, dan jangan mengganti toolchain hanya untuk memenuhi instruksi ini.

## 5. Mandatory Live Preview Workflow

### 5.1 Keep the Development Server Running

- Periksa apakah server frontend sudah berjalan sebelum memulai yang baru.
- Pertahankan server tetap berjalan selama sesi dan manfaatkan Vite HMR.
- Restart hanya jika konfigurasi atau kondisi server memang memerlukannya.
- Periksa pesan error di terminal setelah perubahan.

Jika backend dibutuhkan untuk menguji fitur, pastikan backend juga berjalan. Jangan menganggap backend berfungsi hanya karena frontend berhasil dibuka.

### 5.2 Required Edit–Preview–Refine Loop

Setelah setiap perubahan UI yang bermakna:

1. Simpan perubahan dan tunggu HMR.
2. Buka atau refresh halaman terkait pada live preview.
3. Amati tampilan dan perilaku yang sebenarnya.
4. Identifikasi layout rusak, elemen tidak konsisten, interaksi gagal, atau data tidak sesuai.
5. Perbaiki, lalu periksa ulang hasilnya.
6. Ulangi sampai acceptance criteria terpenuhi atau ditemukan hambatan yang harus dilaporkan.

Jangan menunggu seluruh pekerjaan selesai untuk pertama kali membuka browser. Jangan menyatakan selesai hanya karena tidak ada error di editor.

### 5.3 What Must Be Inspected

- Kesesuaian dengan panduan di `UI.md` (alur, komponen, warna status, format rupiah).
- Layout, navigasi, dan konsistensi warna, tipografi, jarak, serta ikon.
- Form tambah produk: validasi link, pesan kesalahan, dan feedback setelah submit.
- Daftar produk, grafik riwayat harga, dan tombol aksi.
- Loading state, empty state, dan error state.
- Tampilan desktop dan mobile.
- Scroll horizontal, elemen terpotong, dan layout yang bertumpuk.
- Browser console dan request API yang gagal jika alat tersedia.

Untuk perubahan backend, uji endpoint dan alur data yang relevan, lalu periksa dampaknya pada frontend.

### 5.3.1 Pembuktian inspeksi browser (tugas pertama)

- Jangan mengubah kode terlebih dahulu.
- Pastikan frontend berjalan di `http://localhost:5173`.
- Buka halaman menggunakan browser automation tool dan ambil screenshot aktual.
- Periksa screenshot secara visual dan laporkan tiga temuan konkret yang benar-benar terlihat.
- Jangan menganalisis JSX/CSS sebagai pengganti screenshot.
- Jika tidak ada tool untuk membuka browser atau melihat screenshot, katakan dengan jelas bahwa visual inspection belum bisa dilakukan.
- Setelah terbukti, gunakan workflow screenshot → edit → screenshot ulang untuk semua perubahan UI berikutnya.

### 5.4 Never Fake Visual Verification

Jika agent tidak memiliki browser atau alat live preview:

- Jangan mengaku sudah melihat hasil website.
- Lakukan pemeriksaan kode dan tes yang tersedia.
- Laporkan bahwa verifikasi visual belum dilakukan dan berikan URL preview lokal.
- Jangan menganggap screenshot lama sebagai bukti perubahan terbaru sudah benar.

## 6. Avoid Repeated Builds

**Jangan menjalankan production build setiap kali selesai mengedit kode.**

- Gunakan Vite dev server dan HMR untuk frontend.
- Gunakan backend yang sedang berjalan untuk pengujian API.
- Gunakan test atau pemeriksaan terarah, bukan build berulang.

Production build dilakukan pada tahap akhir, saat diminta pengguna, atau ketika masalah hanya bisa diverifikasi lewat build. Build yang gagal harus dianalisis dan diulang setelah diperbaiki.

## 7. Architecture and Coding Rules

### Frontend

- Ikuti pola React yang sudah digunakan; project ini memakai JSX, bukan TypeScript.
- Gunakan komponen yang sudah ada jika sesuai dan hindari duplikasi logika.
- Pisahkan tanggung jawab halaman, komponen, API client, dan utilitas.
- Jangan memindahkan struktur folder atau mengganti seluruh UI hanya untuk satu fitur.
- Pertahankan route dan fitur yang sudah berfungsi.

### Backend

- Pertahankan struktur Express dan pola routing yang ada.
- Validasi input di server, bukan hanya di frontend (terutama URL produk dan harga target).
- Pertahankan format response API yang konsisten.
- Tangani error secara terstruktur tanpa membocorkan stack trace atau secret.
- Jangan mengubah kontrak endpoint tanpa memeriksa dampaknya pada frontend.

### Database (Firebase)

- Periksa `DATABASE_SCHEMA.md` dan struktur data aktual sebelum mengubah query atau path.
- Hindari perubahan destruktif tanpa persetujuan pengguna.
- Jangan menghapus atau mereset data untuk memperbaiki bug biasa.
- Aturan lengkap ada di bagian 9 (Firebase Rules).

## 8. Price Fetching and Scraping Rules

Pengambilan harga adalah bagian paling berisiko dari project ini.

- Pengambilan harga **hanya** dilakukan di backend. Browser tidak boleh mengambil halaman toko lain secara langsung karena terkena CORS.
- Mulai dari satu toko. Tambahkan toko lain sebagai scraper terpisah di `backend/src/scrapers/`.
- Prioritaskan data terstruktur (API resmi atau JSON-LD) daripada membaca HTML mentah.
- Sediakan input harga manual sebagai cadangan jika toko memblokir bot.
- Beri jeda dan batasi frekuensi permintaan agar tidak membebani server toko.
- Patuhi ketentuan layanan dan `robots.txt` toko yang bersangkutan.
- Validasi dan normalisasi hasil (angka, mata uang, nama produk) sebelum disimpan.
- Tangani kegagalan dengan jelas: timeout, halaman berubah, harga tidak ditemukan.
- Jangan menyimpan atau menampilkan HTML mentah dari toko ke pengguna.

## 9. Firebase Database Rules

Project memakai Firebase Realtime Database sebagai penyimpanan utama.

- Semua baca dan tulis ke Firebase dilakukan di backend (`backend/src/services/`) memakai Firebase Admin SDK. Frontend memanggil API backend, bukan Firebase langsung.
- Firebase Auth client SDK di frontend hanya dipakai untuk login/registrasi dan memperoleh ID token; frontend tetap tidak mengakses Realtime Database langsung.
- Semua route produk wajib memverifikasi Firebase ID token memakai Admin SDK. UID hanya boleh diambil dari token yang sudah diverifikasi, tidak pernah dari body, query, atau header buatan klien.
- Wajibkan `email_verified === true` sebelum API memberi akses. Data produk disimpan di `/users/{sha256(uid)}/...` agar akun terisolasi.
- Inisialisasi Firebase Admin cukup satu kali dan dipakai ulang; jangan membuat instance baru di setiap request.
- Kredensial service account (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`) hanya dibaca dari environment variables. Jangan hardcode, jangan commit file JSON service account, dan jangan tampilkan nilainya di log.
- `FIREBASE_PRIVATE_KEY` berisi baris baru: ubah `\n` menjadi newline saat dibaca (`.replace(/\\n/g, "\n")`).
- Rules database harus menolak akses klien (`".read": false, ".write": false`). Jangan pernah mengubahnya menjadi `true` demi kemudahan; ubah Rules hanya setelah persetujuan pengguna.
- Struktur data baru: `/users/{sha256(uid)}/products/{productId}` dan `/users/{sha256(uid)}/pricePoints/{productId}/{pointId}`. Rincian field ada di `DATABASE_SCHEMA.md`; perbarui dokumen itu setiap struktur berubah. Jangan menaruh riwayat harga di dalam node produk.
- Jangan memigrasikan atau menghapus data lama pada `/products` dan `/pricePoints` tanpa persetujuan serta pemetaan pemilik yang benar.
- Hindari mengunduh seluruh node besar. Ambil hanya data yang dibutuhkan (misalnya riwayat satu produk, dibatasi dengan `limitToLast`).
- Gunakan operasi atomik (`update` multi-path atau transaksi) saat memperbarui produk dan riwayat harga sekaligus agar konsisten.
- Validasi dan normalisasi data sebelum ditulis (tipe angka untuk harga, timestamp konsisten). Firebase tidak memaksakan skema.
- Perhatikan batas paket gratis (Spark): batasi frekuensi cron dan ukuran data yang ditulis.
- Jangan menghapus node, mereset database, atau melakukan migrasi struktur data tanpa persetujuan pengguna.

## 10. API Integration

Saat menghubungkan frontend ke backend:

1. Periksa route Express yang benar-benar tersedia.
2. Periksa metode HTTP, request body, parameter, response, dan status error.
3. Sertakan Firebase ID token pada request privat; backend harus memverifikasi token dan mengambil UID dari claims.
4. Gunakan konfigurasi base URL yang konsisten; hindari path ganda seperti `/api/api/...`.
5. Periksa CORS dan environment variables jika koneksi gagal.
6. Implementasikan loading, success, empty, dan error states.
7. Uji jalur berhasil, token tidak ada/invalid, dan email belum diverifikasi.

Bedakan error: `ECONNREFUSED` berarti backend tidak terjangkau, 404 berarti route atau method salah, dan CORS bukan perbaikan untuk keduanya. Validasi status dan Content-Type sebelum parse JSON.

Jangan membuat endpoint palsu atau menganggap fitur terintegrasi hanya karena UI terlihat selesai. Jangan menambahkan mock data permanen tanpa persetujuan pengguna; jika mock diperlukan, tandai dengan jelas.

## 11. AI Features (puter.js)

- Puter.js berjalan di sisi klien dan bergantung pada akun Puter pengguna.
- Gunakan hanya untuk fitur yang dipicu pengguna: ekstraksi data dari teks berantakan, ringkasan tren harga, merapikan nama produk.
- Jangan memakai puter.js untuk pengecekan otomatis di latar belakang; itu tugas backend.
- Fitur inti harus tetap berfungsi tanpa AI.
- Jangan mengirim data sensitif ke layanan AI. Tandai jelas hasil AI di UI sebagai saran, bukan fakta.
- Tangani kegagalan atau ketidaktersediaan AI dengan fallback yang wajar.

## 12. Priority Features

Gunakan `ROADMAP.md` dan permintaan terbaru pengguna untuk menentukan prioritas. Daftar di bawah hanyalah ringkasan; `ROADMAP.md` adalah rujukan utama.

1. Siapkan Firebase (project, Realtime Database, Rules, service account) dan koneksi Admin SDK di backend.
2. Backend: endpoint untuk mengambil nama dan harga dari satu link.
3. Frontend: form tambah produk dan daftar produk.
4. Simpan produk dan riwayat harga ke Firebase.
5. Grafik riwayat harga.
6. Cron pengecekan harga berkala.
7. Notifikasi Telegram.
8. Fitur AI dengan puter.js.
9. Deployment ke Vercel.

Jangan mencoba menyelesaikan semua area sekaligus jika pengguna hanya meminta satu fitur. Utamakan satu perubahan yang selesai, teruji, dan terintegrasi daripada banyak perubahan setengah jadi.

## 13. Testing Rules

- Tambahkan atau perbarui tes untuk fungsionalitas baru jika test framework tersedia.
- Pastikan tes deterministik; jangan bergantung pada situs toko yang sebenarnya. Gunakan fixture HTML atau respons tersimpan untuk menguji scraper.
- Uji jalur sukses, validasi input, dan kegagalan yang relevan.
- Jangan menguji terhadap database Firebase produksi. Gunakan project atau path khusus uji (misalnya `/test/...`) atau Firebase Emulator, dan bersihkan datanya setelah tes.
- Jangan menyatakan test lulus jika belum benar-benar dijalankan.
- Jangan mengabaikan kegagalan test yang berkaitan dengan perubahan.

Untuk perubahan alur penting, uji rangkaian: tambah produk lewat link, harga terambil, riwayat tersimpan, harga turun di bawah target, notifikasi terkirim.

## 14. Environment Variables and Git Safety

- Jangan commit `.env`, file kredensial, token, atau private key.
- Periksa `.gitignore` sebelum staging.
- Jangan menampilkan nilai environment variable saat debugging.
- Jangan commit file JSON service account Firebase; pastikan sudah masuk `.gitignore`.
- Gunakan `.env.example` hanya untuk nama variabel dan placeholder aman (misalnya `TELEGRAM_BOT_TOKEN=`, `FIREBASE_PRIVATE_KEY=`).
- Jangan menaruh secret di kode frontend atau variabel yang diekspos ke browser.
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, dan `VITE_FIREBASE_APP_ID` adalah konfigurasi web publik, bukan service-account secret. Jangan pernah menaruh `FIREBASE_PRIVATE_KEY` pada variabel `VITE_*`.
- Jangan commit, push, force push, atau mengubah repository remote tanpa izin pengguna.

Jika secret sudah terlanjur terpublikasi, beri tahu pengguna untuk mencabut atau merotasinya.

## 15. Boundaries

### Allowed Without Asking

- Membaca file dan memeriksa struktur direktori.
- Menjalankan development server lokal dan memeriksa live preview.
- Mengedit file yang relevan dengan tugas.
- Menjalankan lint dan tes terarah yang tersedia.
- Memperbaiki bug yang muncul akibat perubahan yang sedang dikerjakan.

### Ask First

- Menginstal, menghapus, atau meng-upgrade dependency.
- Menghapus file penting atau aset pengguna.
- Mengubah struktur data Firebase secara destruktif, menghapus node, atau mereset data.
- Mengubah Firebase Rules atau menambahkan Firebase client SDK di frontend.
- Mengubah konfigurasi produksi atau deployment.
- Commit, push, force push, atau membuka pull request.
- Perubahan arsitektur besar di luar ruang lingkup tugas.
- Menambahkan scraper untuk toko baru yang ketentuan layanannya belum diperiksa.

### Never

- Commit secret atau file `.env`.
- Mengambil harga langsung dari browser ke toko lain.
- Mengakses Firebase langsung dari frontend dengan kredensial service account.
- Membuka Firebase Rules menjadi `".read": true` atau `".write": true`.
- Mengabaikan batas frekuensi atau memberi beban berlebihan pada server toko.
- Memodifikasi direktori generated output atau dependencies secara manual.
- Mengaku telah menguji browser, API, build, atau tes jika tidak dilakukan.
- Menjalankan production build berulang sebagai pengganti live preview.
- Menandai tugas selesai jika acceptance criteria belum terpenuhi.

## 16. Definition of Done

Sebuah tugas dianggap selesai jika:

- Kebutuhan pengguna telah diterapkan tanpa perubahan tidak relevan.
- Live preview telah diperiksa jika alat browser tersedia.
- Masalah yang ditemukan selama inspeksi telah diperbaiki dan diperiksa ulang.
- Integrasi API telah diuji jika tugas berkaitan dengan API.
- Data benar-benar tertulis dan terbaca dari Firebase jika tugas berkaitan dengan penyimpanan.
- Tes dan pemeriksaan yang tersedia telah dijalankan sesuai kebutuhan.
- Tidak ada secret yang ikut masuk ke perubahan.
- Keterbatasan verifikasi dilaporkan dengan jujur.

## 17. Final Report

Setelah menyelesaikan tugas, berikan ringkasan:

1. **Perubahan:** file dan fitur yang diperbarui.
2. **Live preview:** halaman dan viewport yang benar-benar diperiksa.
3. **Perbaikan iteratif:** masalah yang ditemukan dan cara memperbaikinya.
4. **Validasi:** tes, lint, API check, atau build yang benar-benar dijalankan.
5. **Status integrasi:** memakai API dan data nyata atau masih membutuhkan integrasi.
6. **Catatan:** masalah tersisa dan hal yang membutuhkan tindakan pengguna.

Jangan mengklaim semua fitur berjalan hanya berdasarkan tampilan visual.

**Final principle: Implement carefully, inspect the real application, fix what is wrong, verify the result, and report honestly.**

## 18. Catatan implementasi dan keputusan

Dokumen acuan: `README.md`, `ROADMAP.md`, `UI.md`, dan `DATABASE_SCHEMA.md`. Perbarui dokumen yang relevan setiap kali ada perubahan fitur, tampilan, atau struktur data.

Bagian ini diisi seiring project berjalan. Catat keputusan penting, misalnya toko yang dipilih pertama, pilihan penyimpanan, dan format response API, agar tidak perlu ditebak ulang.

- Database: Firebase Realtime Database, diakses hanya lewat backend (Admin SDK). Rules menolak akses klien.
- Toko pertama dan format response API: belum ditentukan.
