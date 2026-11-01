# Skema Database Firebase - Pemantau Harga

Dokumen ini menggambarkan struktur data aplikasi pemantau harga di Firebase Realtime Database (JSON). Fokusnya memisahkan dengan jelas data produk, riwayat harga, dan log notifikasi, serta menjelaskan konvensi karena Realtime Database tidak memaksakan skema.

Semua akses data dilakukan dari backend memakai Firebase Admin SDK. Frontend tidak membaca atau menulis database langsung.

## 1. Gambaran umum

```
/
└── users/
  └── {userKey}/                 # SHA-256 dari Firebase Auth UID
    ├── products/
    │   └── {productId}/
    ├── productUrlHashes/
    │   └── {urlHash}: {productId}
    ├── pricePoints/
    │   └── {productId}/{pointId}/
    └── notifications/
      └── {notificationId}/
```

- `{userKey}` adalah SHA-256 dari UID yang diverifikasi backend; UID mentah tidak dipakai sebagai Firebase key.
- `productUrlHashes/{urlHash}` adalah reservasi unik per akun yang ditulis melalui transaksi sebelum produk disimpan; ini mencegah duplikat tanpa query berindex.
- `{productId}`, `{pointId}`, dan `{notificationId}` dibuat dengan `push()` (urut berdasarkan waktu).
- Jangan memakai URL sebagai key. Key Firebase tidak boleh mengandung `.`, `$`, `#`, `[`, `]`, atau `/`.

## 2. Node `products`

Menyimpan produk milik satu akun. Path: `/users/{userKey}/products/{productId}`.

| Field | Tipe | Keterangan |
| :--- | :--- | :--- |
| `url` | string | Link produk asli dari pengguna |
| `urlHash` | string | Hash dari URL yang sudah dinormalisasi, untuk mencegah duplikasi |
| `name` | string | Nama produk |
| `image` | string, opsional | URL gambar produk |
| `store` | string | Nama toko, contoh: `tokopedia` |
| `currency` | string | Kode mata uang, default `IDR` |
| `currentPrice` | number | Harga terakhir, bilangan bulat (rupiah) |
| `lowestPrice` | number | Harga terendah yang pernah tercatat |
| `highestPrice` | number | Harga tertinggi yang pernah tercatat |
| `targetPrice` | number | Harga target dari pengguna |
| `status` | string | `aktif`, `dijeda`, atau `error` |
| `lastCheckedAt` | number | Waktu pengecekan terakhir (epoch milidetik) |
| `lastError` | string, opsional | Pesan kegagalan pengecekan terakhir |
| `lastNotifiedAt` | number, opsional | Waktu notifikasi terakhir, untuk mencegah spam |
| `createdAt` | number | Waktu produk ditambahkan |
| `updatedAt` | number | Waktu data terakhir berubah |

Catatan:
- `currentPrice`, `lowestPrice`, dan `highestPrice` sengaja disimpan di sini (denormalisasi) supaya daftar produk bisa ditampilkan tanpa mengunduh riwayat harga.
- Perbarui field ini bersamaan dengan penambahan `pricePoints` memakai satu `update` multi-path agar tetap konsisten.
- Realtime Database tidak punya constraint unik. Backend mereservasi `urlHash` dengan transaksi di `/users/{userKey}/productUrlHashes/` sebelum menyimpan produk.

## 3. Node `pricePoints`

Menyimpan riwayat harga per produk. Path: `/users/{userKey}/pricePoints/{productId}/{pointId}`.

| Field | Tipe | Keterangan |
| :--- | :--- | :--- |
| `price` | number | Harga saat dicek, bilangan bulat (rupiah) |
| `checkedAt` | number | Waktu pengecekan (epoch milidetik) |
| `source` | string | `scraper` atau `manual` |

Catatan:
- Riwayat dipisah dari node produk agar daftar produk tetap ringan.
- Saat menampilkan grafik, ambil sebagian data saja (misalnya `orderByChild("checkedAt").limitToLast(90)`), jangan seluruh node.
- Jika harga tidak berubah dari titik sebelumnya, boleh melewati penulisan untuk menghemat kuota. Tetap perbarui `lastCheckedAt` pada produk.

## 4. Node `notifications`

Log notifikasi yang sudah dikirim. Path: `/users/{userKey}/notifications/{notificationId}`.

| Field | Tipe | Keterangan |
| :--- | :--- | :--- |
| `productId` | string | Referensi ke `/products/{productId}` |
| `type` | string | Contoh: `price_drop`, `target_reached`, `check_failed` |
| `price` | number | Harga saat notifikasi dikirim |
| `targetPrice` | number | Target saat itu |
| `channel` | string | Contoh: `telegram`; `email` atau `whatsapp` bila ditambahkan nanti |
| `sentAt` | number | Waktu pengiriman (epoch milidetik) |

Catatan: log ini dipakai untuk mencegah notifikasi berulang untuk kondisi yang sama dan untuk menelusuri riwayat peringatan.

## 5. Hubungan antar node

1. `users/{userKey}/products/{id}` memiliki banyak `users/{userKey}/pricePoints/{id}/*`.
2. `users/{userKey}/products/{id}` memiliki banyak `users/{userKey}/notifications/*` lewat field `productId`.
3. `users/{userKey}/productUrlHashes/{urlHash}` menunjuk ID produk yang memiliki URL tersebut dan dihapus bersama produk.

Dengan struktur ini sistem dapat melacak:
- produk apa yang dipantau dan berapa target-nya;
- bagaimana harga berubah dari waktu ke waktu;
- kapan terakhir dicek dan apakah ada kegagalan;
- kapan notifikasi terakhir dikirim.

## 6. Konvensi data

- Harga disimpan sebagai bilangan bulat rupiah, bukan string atau desimal. Format tampilan (misalnya `Rp 1.250.000`) dilakukan di frontend.
- Waktu disimpan sebagai epoch milidetik (number) agar mudah diurutkan.
- Field opsional yang kosong sebaiknya tidak ditulis, karena Firebase tidak menyimpan nilai `null`.
- Validasi tipe dan rentang (harga lebih dari 0, URL valid) dilakukan di backend sebelum menulis.
- Perubahan ke beberapa path sekaligus memakai `update` multi-path atau transaksi.

## 7. Rules dan index

Klien tidak boleh mengakses database langsung. Backend memakai Admin SDK yang tidak terikat Rules.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "users": {
      "$userKey": {
        "products": {
          ".indexOn": ["store", "status", "createdAt"]
        },
        "pricePoints": {
          "$productId": {
            ".indexOn": ["checkedAt"]
          }
        },
        "notifications": {
          ".indexOn": ["productId", "sentAt"]
        }
      }
    }
  }
}
```

Jangan pernah mengubah `.read` atau `.write` menjadi `true`.

## 8. Contoh data (fiktif)

```json
{
  "users": {
    "{userKey}": {
      "products": {
        "-Nabc123": {
          "url": "https://toko.example/produk/headphone-x",
          "urlHash": "9f2c1d...",
          "name": "Headphone X",
          "store": "toko-contoh",
          "currency": "IDR",
          "currentPrice": 1250000,
          "lowestPrice": 1190000,
          "highestPrice": 1399000,
          "targetPrice": 1200000,
          "status": "aktif",
          "lastCheckedAt": 1793446800000,
          "createdAt": 1793360400000,
          "updatedAt": 1793446800000
        }
      },
      "pricePoints": {
        "-Nabc123": {
          "-Npt001": { "price": 1399000, "checkedAt": 1793360400000, "source": "scraper" },
          "-Npt002": { "price": 1250000, "checkedAt": 1793446800000, "source": "scraper" }
        }
      }
    }
  }
}
```

## 9. Rekomendasi penambahan

Tambahkan hanya saat dibutuhkan:

- **Akun**: Firebase Auth sudah menjadi identitas login. Backend memverifikasi ID token dan mengisolasi data di bawah `users/{sha256(uid)}`; klien tetap tidak mendapat akses RTDB langsung.
- **`settings`**: preferensi notifikasi (interval cek, jam tenang, chat ID Telegram).
- **`scrapeLogs`**: log kegagalan pengambilan per toko untuk memantau scraper yang rusak. Beri batas retensi supaya tidak membengkak.

## 10. Catatan penting untuk pengembangan lanjutan

- Perhatikan batas paket gratis (Spark): ukuran data, jumlah koneksi, dan transfer harian. Batasi frekuensi cron dan jumlah `pricePoints` yang ditulis.
- Pertimbangkan membersihkan atau meringkas riwayat harga yang sangat lama.
- Perbarui dokumen ini setiap kali struktur data berubah, lalu sesuaikan juga `README.md` dan `AGENTS.md`.
- Jangan menjalankan penghapusan node atau migrasi struktur tanpa cadangan dan persetujuan pengguna. Ekspor JSON dari Firebase Console dapat dipakai sebagai cadangan sederhana.
- Data lama di `/products` dan `/pricePoints` tidak otomatis dipindahkan ke akun mana pun. Migrasikan hanya setelah pemilik data dipastikan.
