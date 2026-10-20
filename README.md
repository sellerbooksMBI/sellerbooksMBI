# SellerBooks

Repository aplikasi SellerBooks di root domain GitHub Pages: https://sellerbooksMBI.github.io/

## Struktur pemisahan awal

- `index.html` — markup dan susunan halaman aplikasi lama.
- `src/styles/main.css` — seluruh blok CSS lama digabung ke satu stylesheet.
- `src/legacy/scripts/` — JavaScript inline dipisahkan menjadi file-file berurutan; setiap file dipanggil pada posisi asalnya agar urutan eksekusi dipertahankan.
- `public/` — aset statis seperti favicon.
- `src/core/`, `src/modules/`, dan `src/services/` — tujuan refactor lanjutan.

## Batas tahap ini

Ini pemisahan mekanis, bukan perubahan logika. Alur import, laporan, biaya, dan penyimpanan belum diubah. Sebelum mengalihkan penyimpanan ke Supabase atau mengaktifkan API marketplace multi-client, masing-masing modul harus diaudit dan diuji. File JavaScript lama tetap berjalan sebagai script klasik karena markup menggunakan handler global.
