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
