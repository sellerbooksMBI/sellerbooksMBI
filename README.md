# SellerBooks

Kerangka baru SellerBooks yang dipisahkan dari repository SellerBooks Core.

## Prinsip pemisahan
- `index.html`: kerangka halaman.
- `src/styles/`: CSS tampilan.
- `src/core/`: konfigurasi dan fondasi inti.
- `src/modules/`: modul fitur aplikasi.
- `src/services/`: integrasi layanan/API.
- `src/main.js`: entry point aplikasi.

## Penting
- Repository ini berdiri sendiri dan tidak mengubah repository `sellerbookscore`.
- Belum ada fitur SellerBooks lama yang dipindahkan atau diaktifkan pada tahap kerangka ini.
- Supabase baru akan dikonfigurasi melalui environment variable; jangan menaruh service-role key di frontend.
- Sebelum memindahkan engine lama, kode akan dipetakan dan dipisahkan bertahap agar alur penjualan, impor, sinkronisasi, dan snapshot tidak berubah tanpa pengujian.
