# SellerBooks Client — Audit dan Peta Migrasi

Status: pemetaan awal berdasarkan file sumber lama `index.html` yang diberikan pengguna (39.021 baris; sekitar 1,08 MB pada salinan yang diaudit).

## Batas pekerjaan

- Cakupan dokumen ini hanya aplikasi **SellerBooks untuk client**.
- Repository Core dianggap selesai dan tidak termasuk ruang lingkup perubahan.
- Tampilan, nama menu, alur operasional, dan perilaku SellerBooks lama adalah acuan. Jangan mengganti produk ini dengan konsep antarmuka baru.
- Jangan mengganti koneksi Supabase lama hanya dengan mengganti URL. Skema data, RPC, RLS, realtime, penyimpanan, serta alur OAuth harus dipetakan dan diuji terlebih dahulu.
- Jangan menghapus data atau mengubah rumus keuangan tanpa pengujian dan persetujuan.

## Peta halaman dan fungsi

| Halaman | Area yang harus dipetakan dan diuji |
|---|---|
| Dashboard | Ringkasan penjualan dan laba, grafik, filter periode, konsistensi angka dengan Laporan/Rincian, render saat data besar. |
| Marketplace | CRUD marketplace, logo, status aktif, filter; menghapus satu item tidak boleh menghapus item lain. |
| Akun Toko | CRUD toko, pemilihan marketplace, status integrasi, OAuth, Tarik Order, multi-akun dan multi-client. |
| Master Produk | SKU, nama/kategori produk, harga dan HPP, impor, pencocokan SKU ke transaksi. |
| Import Penjualan | Impor Excel manual, antrean file, deduplikasi order/resi, validasi baris pertama, pemetaan kolom, snapshot, dan penyimpanan. |
| Biaya Lain | Tambah/edit/hapus, cakupan biaya, konfirmasi simpan, persistensi setelah refresh, sinkronisasi dengan laporan. |
| Piutang | Modul terpisah dengan operasi entri dan pembayaran serta realtime; verifikasi isolasi per client. |
| Rincian | Analisis produk terjual, QTY, HPP, laba dan rata-rata laba; filter serta pagination. |
| Laporan | Filter periode, marketplace/toko, ringkasan finansial, transaksi, produk terjual, ekspor PDF, hapus terpilih dan hapus berdasarkan rentang tanggal. |
| Pengaturan | Preferensi akun dan bahasa ID/EN, pengaturan biaya/snapshot, serta persistensi setelah login/refresh. |

## Temuan langsung dari sumber lama

1. File lama mengandung sekitar 388 deklarasi fungsi bernama tingkat atas dan banyak kode inline HTML/CSS/JavaScript. Migrasi harus bertahap dan setiap tahap harus menjaga perilaku yang sudah ada.
2. Navigasi utama sumber lama memuat Dashboard, Marketplace, Akun Toko, Master Produk, Import Penjualan, Biaya Lain, Piutang, Rincian, Laporan, dan Pengaturan.
3. Sumber lama menunjuk ke proyek Supabase `fysaxpqpqexjnlpkbwap`. Koneksi itu tidak boleh dipakai untuk data aplikasi client baru jika targetnya adalah proyek baru.
4. Akses data Supabase yang terdeteksi dalam sumber meliputi tabel `sellerbooks_user_data`, `sellerbooks_profiles`, `sellerbooks_stores`, `sellerbooks_api_connections`, `sellerbooks_language_settings`; RPC yang terdeteksi meliputi `sellerbooks_api_upsert_connection`, `sellerbooks_api_set_secret`, dan RPC piutang.
5. Sumber lama memakai kanal realtime untuk data, akun, integrasi, dan piutang; memakai cache lokal untuk sebagian data piutang; serta memiliki jalur simpan cloud, pemulihan konflik, snapshot harian, antrean simpan, dan cache cepat. Semuanya perlu diaudit bersama-sama.
6. Sumber lama mempunyai logika integrasi untuk Blibli, Shopee, Lazada, dan TikTok. Pastikan setiap integrasi memakai kredensial per client/toko, bukan state global bersama.

## Risiko prioritas

### P0 — Isolasi client dan autentikasi
- Semua data bisnis harus terkait dengan identitas pengguna yang sedang login.
- Uji dua pengguna berbeda secara bersamaan: data toko, produk, transaksi, biaya, bahasa, token marketplace, dan cache tidak boleh tercampur.
- Verifikasi RLS dan otorisasi server; menyembunyikan data hanya di UI tidak cukup.
- Secret/token marketplace tidak boleh disimpan sebagai data publik atau dicampur antar akun.

### P1 — Integritas transaksi dan penyimpanan
- Import manual menjadi jalur pemrosesan/deduplikasi yang otoritatif.
- Tarik Order API mengumpulkan data mentah yang diperlukan dan tidak boleh menimpa transaksi hasil import manual.
- Deduplikasi harus memakai identitas order/resi yang benar sesuai marketplace dan toko.
- Setelah simpan/hapus, tunggu hasil operasi database sebelum menyatakan selesai atau mengizinkan operasi yang berkonflik.
- Uji kegagalan jaringan, refresh ketika operasi berlangsung, pengulangan permintaan, serta konflik antar-tab/perangkat.

### P1 — Akurasi laporan dan snapshot
- Audit rumus Sales, QTY, HPP, biaya admin SKU/toko, packing, biaya lain, laba, dan margin.
- Data hari berjalan mengikuti nilai yang sedang diedit sesuai aturan produk; data historis harus terkunci sesuai aturan snapshot yang disepakati.
- Cocokkan hasil Dashboard, Laporan, Rincian, dan ekspor PDF pada dataset yang sama.

### P2 — Performa
- Ukur waktu query, ukuran payload cloud, parsing/merge, filter periode, agregasi, render DOM, dan pembuatan PDF secara terpisah.
- Uji dataset besar, termasuk rentang tiga bulan dan semua periode.
- Gunakan pagination/indeks/query terarah dan cache terukur; jangan mengurangi akurasi atau membuang data demi kecepatan.

### P2 — Bahasa dan antarmuka
- Pertahankan tampilan SellerBooks lama dan perilaku responsif desktop/mobile.
- Semua label, dialog, validasi, status proses, dan pesan error harus mengikuti bahasa akun (ID atau EN) tanpa campuran.
- Jangan memasukkan identitas atau konsep Core ke antarmuka client.

## Rencana pelaksanaan

1. Buat inventaris lengkap modul, fungsi, tabel, RPC, event realtime, storage, dan integrasi dari sumber lama.
2. Bandingkan inventaris tersebut dengan skema dan kebijakan RLS proyek Supabase client yang baru.
3. Tandai setiap fitur: cocok, perlu adaptor, belum tersedia, atau berisiko.
4. Perbaiki per area kecil dalam commit terpisah; mulai dari isolasi client dan penyimpanan, lalu import/API, rumus laporan, performa, dan UI/bahasa.
5. Jalankan tes regresi per area dan verifikasi deploy GitHub Pages. Jangan menyatakan selesai sebelum tes nyata dilakukan.

## Kriteria selesai

- Tidak ada perubahan pada repository atau desain Core.
- Semua data dan token terisolasi per client.
- Import manual dan Tarik Order tidak saling menimpa.
- Operasi simpan/hapus tetap benar setelah refresh dan saat dipakai bersamaan.
- Angka finansial konsisten pada Dashboard, Laporan, Rincian, dan PDF.
- Performa diuji pada data besar; ID/EN konsisten; tampilan lama dipertahankan.

Catatan: ini adalah peta audit berbasis inspeksi sumber. Ini bukan klaim bahwa semua fitur sudah dites di browser atau seluruh masalah sudah diperbaiki.


## Pemeriksaan skema proyek Supabase client baru (2026-10-20)

Tabel yang benar-benar ada di proyek baru meliputi:

- `sellerbooks_user_data(user_id, data jsonb, created_at, updated_at)` — kandidat penyimpanan cloud JSON yang paling dekat dengan model lama.
- `sellerbooks_profiles` dan `sellerbooks_user_language` — profil dan preferensi bahasa per pengguna.
- `sellerbooks_stores`, `sellerbooks_marketplaces` — data toko dan marketplace.
- `sellerbooks_api_connections`, `sellerbooks_api_oauth_states`, `sellerbooks_api_import_queue`, `sellerbooks_sync_runs` — integrasi, antrean, dan audit sinkronisasi.
- `sellerbooks_orders`, `sellerbooks_order_items` — data order mentah ternormalisasi.
- `sellerbooks_client_access`, `sellerbooks_access_logs` — status akses dan riwayat keputusan.
- `sellerbooks_operator_workspaces` — ruang kerja operator.

### Kecocokan yang perlu ditangani

1. Sumber lama menggunakan `sellerbooks_user_data` untuk state cloud JSON, sedangkan skema baru juga menyediakan tabel terpisah untuk toko/order/API. Migrasi harus menentukan apakah modul lama tetap memakai JSON sebagai state utama atau membaca/menulis tabel terstruktur. Jangan menjalankan dua sumber kebenaran untuk data yang sama tanpa aturan sinkronisasi.
2. RLS pada `sellerbooks_user_data`, toko, order, item order, koneksi API, antrean, dan bahasa membatasi akses berdasarkan `auth.uid()` dan fungsi izin akses client. Tetap perlu uji dua akun nyata; inspeksi kebijakan saja belum membuktikan isolasi end-to-end.
3. Skema baru tidak menampilkan tabel eksplisit untuk master produk, biaya lain, snapshot finansial, dan seluruh state laporan. Sebagian mungkin disimpan dalam JSON `sellerbooks_user_data.data`; isi dan kontraknya harus diperiksa sebelum membuat adaptor.
4. `sellerbooks_orders/order_items` saat ini berbentuk data order marketplace mentah. Jangan menganggap tabel tersebut otomatis menggantikan mesin import penjualan lama atau perhitungan laba/snapshot.
5. Source code aktif di repository ini saat ini baru memiliki login, registrasi, status akses, dan halaman permintaan akses administrator. Belum ada modul Dashboard, Marketplace, Akun Toko, Master Produk, Import Penjualan, Biaya Lain, Piutang, Rincian, dan Laporan yang telah dimigrasikan ke source aktif. Ini adalah gap implementasi, bukan masalah yang bisa diselesaikan hanya dengan mengubah konfigurasi.

## Status setelah commit 2026-10-20

- Commit `54d72dce7542be8da24e79cca7a540ec98839823`: menghapus kata “Core” dari judul login dan mengganti copy promosi menjadi copy aplikasi SellerBooks client.
- Commit tersebut tidak mengubah Core, skema database, data pengguna, atau rumus keuangan.
- Migrasi modul client belum selesai. Langkah implementasi berikutnya harus memindahkan kode sumber lama secara lengkap dan menguji setiap modul terhadap skema baru; jangan mengarang ulang perilaku yang tidak terbukti dari sumber lama.
