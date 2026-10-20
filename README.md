# SellerBooks

Repository aplikasi SellerBooks mandiri di root domain GitHub Pages: https://sellerbooksMBI.github.io/

## Struktur
- `index.html`: entry point halaman.
- `src/styles/main.css`: stylesheet utama.
- `src/core/`: fondasi autentikasi, akses, dan konfigurasi.
- `src/modules/`: fitur aplikasi.
- `src/services/`: integrasi Supabase dan API marketplace.
- `src/legacy/`: catatan migrasi bertahap dari index lama.

## Prinsip migrasi
Repository ini terpisah dari `sellerbookscore`. Pemindahan index lama dilakukan bertahap supaya fungsi import, laporan, biaya, snapshot, dan API tidak rusak. Jangan mengaktifkan integrasi lama tanpa audit sumber data dan kredensial.
