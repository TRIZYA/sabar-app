# Panduan UI & Alur Pengguna Aplikasi Pemantau Harga

Dokumen ini menjelaskan bagaimana UI seharusnya merepresentasikan alur memantau harga, bukan sekadar form dan tabel. Fokusnya membuat pengguna cepat paham: produk apa, harga sekarang berapa, apakah sudah mencapai target, dan apa langkah berikutnya.

## Prinsip desain utama

1. Harga dan perubahannya harus langsung terbaca tanpa perlu membuka halaman lain.
2. Setiap produk menunjukkan posisi harga terhadap target (belum, hampir, atau tercapai).
3. Aksi utama (tempel link) harus mudah ditemukan dan cepat dilakukan.
4. Kegagalan pengambilan harga harus jelas dan selalu ada jalan keluar (coba lagi atau input manual).
5. Mobile first. Banyak pengguna akan membukanya dari ponsel.
6. Layout bersih dan konsisten, tanpa dekorasi yang tidak membantu membaca data.

## Status implementasi UI saat ini

Login/register email-password, verifikasi email, reset kata sandi, halaman ringkasan, daftar produk live, form tambah manual dua langkah, form edit harga sekarang, serta modal detail dengan grafik sudah diimplementasikan. Preview otomatis menunggu endpoint scraper; fitur ini tidak disimulasikan di UI.

## 0. Login

- Form masuk memakai Firebase Authentication Google atau email/password; pendaftaran email/password tersedia.
- Akun harus memverifikasi email sebelum dashboard dan API produk dapat digunakan.
- Sediakan reset kata sandi, kirim ulang verifikasi, dan aksi keluar.
- Jangan pernah meminta atau menampilkan service-account credential di frontend.

## 1. Halaman utama (daftar produk)

Menampilkan produk yang dipantau.

- Kolom atau kartu: gambar, nama, toko, harga sekarang, harga target, perubahan harga, waktu cek terakhir, status.
- Ringkasan di atas daftar: jumlah produk, jumlah yang sudah mencapai target, jumlah yang bermasalah.
- Pencarian dan filter (toko, status, sudah mencapai target).
- Urutan bawaan: yang mencapai target di atas, lalu yang terbaru.
- Tombol "Tambah produk" yang menonjol.
- Empty state: ajakan menempel link pertama.

## 2. Tambah produk

Alur dua langkah agar pengguna bisa memeriksa hasil sebelum disimpan.

1. **Tempel link.** Satu input, validasi format URL di klien dan server, tombol "Ambil harga".
2. **Pratinjau dan konfirmasi.** Tampilkan nama, gambar, toko, dan harga yang terambil. Pengguna mengisi harga target (dengan saran, misalnya 10% di bawah harga sekarang) lalu menyimpan.

Kondisi khusus:
- Loading saat mengambil harga.
- Jika gagal: pesan yang jelas (toko tidak didukung, halaman tidak bisa dibaca, harga tidak ditemukan) dan pilihan "Coba lagi" atau "Isi manual".
- Jika produk sudah ada (link sama): tampilkan produk yang sudah ada, jangan buat duplikat.

## 3. Detail produk

- Header: gambar, nama, toko, tautan ke halaman toko.
- Harga sekarang, harga terendah, dan harga tertinggi.
- Grafik riwayat harga dengan garis target. Pilihan rentang waktu (7 hari, 30 hari, semua).
- Tabel riwayat harga (tanggal, harga, sumber: otomatis atau manual).
- Aksi: ubah target, jeda atau lanjutkan pemantauan, cek sekarang, input harga manual, hapus (dengan konfirmasi).
- Panel AI opsional: ringkasan tren, ditandai jelas sebagai saran.

## 4. Pengaturan

- Hubungkan Telegram (chat ID) dan tombol uji kirim notifikasi.
- Preferensi pengecekan (interval, jika tersedia).
- Tampilan tidak boleh menampilkan token atau kredensial apa pun.

## 5. Alur UI yang disarankan

### Dari link ke notifikasi
1. Pengguna menempel link.
2. Sistem menampilkan pratinjau hasil.
3. Pengguna menentukan target dan menyimpan.
4. Produk muncul di daftar dengan status aktif.
5. Sistem mengecek berkala di latar belakang.
6. Harga mencapai target, produk ditandai di daftar dan notifikasi dikirim.
7. Pengguna membuka detail, melihat grafik, lalu memutuskan membeli.

### Saat ada masalah
- Pengecekan gagal berulang: status produk menjadi `error`, tampilkan alasan terakhir dan tombol "Coba lagi" atau "Isi manual".
- Pengguna menjeda produk: status `dijeda`, tidak ikut dicek.

## 6. Standar komponen UI yang disarankan

```text
src/
├── components/
│   ├── Layout/
│   ├── ProductCard/
│   ├── PriceChart/
│   ├── PriceBadge/        # status harga vs target
│   ├── Modal/
│   └── Toast/
├── pages/
│   ├── Home/              # daftar produk
│   ├── AddProduct/
│   ├── ProductDetail/
│   └── Settings/
├── hooks/
├── utils/
│   ├── api.js
│   └── format.js          # format rupiah dan tanggal
├── App.jsx
├── App.css
└── main.jsx
```

## 7. Prinsip visual yang harus dijaga

- Warna status: hijau untuk harga turun atau target tercapai, merah untuk harga naik, abu-abu atau netral untuk tidak berubah, kuning untuk produk bermasalah. Jangan mengandalkan warna saja; sertakan ikon atau teks.
- Format harga konsisten memakai `Intl.NumberFormat("id-ID")` (contoh: `Rp 1.250.000`), dengan angka rata kanan di tabel.
- Persentase perubahan ditampilkan dengan tanda dan arah yang jelas.
- Gambar produk memakai ukuran tetap dan placeholder jika gagal dimuat.
- Tabel dan grafik bisa di-scroll horizontal di dalam wrapper sendiri; halaman tidak boleh melebar.
- Tombol aksi memakai ikon bermakna plus label teks.
- Modal konfirmasi konsisten untuk aksi destruktif (hapus produk).
- Area sentuh minimal 40px di mobile.

## 8. Backlog UI prioritas berikutnya

### Prioritas P0
- [x] Halaman daftar produk dan form tambah manual terhubung ke API live.
- [ ] Pratinjau hasil scraper sebelum menyimpan.
- [x] Loading, empty, dan error state pada halaman daftar dan form.

### Prioritas P1
- [x] Detail produk dengan grafik riwayat harga.
- [x] Toast untuk aksi sukses atau gagal.
- [x] Pencarian dan filter di daftar produk.
- [x] Input harga manual.

### Prioritas P2
- Panel AI (ringkasan tren) dengan puter.js.
- Mode gelap.
- Ekspor riwayat harga (CSV).
- Pengaturan kanal notifikasi tambahan (email, WhatsApp).
- Perbandingan harga antar toko untuk produk serupa.

## 9. Kesimpulan

UI yang baik untuk pemantau harga harus berpusat pada satu pertanyaan: "Apakah sekarang waktu yang tepat untuk membeli?" Daftar produk, grafik, dan notifikasi harus menjawabnya dengan cepat. Tanpa itu, aplikasi hanya akan terasa seperti tabel link yang harus dicek manual.
