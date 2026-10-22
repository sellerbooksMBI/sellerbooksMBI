# SellerBooks

Repository aplikasi SellerBooks mandiri di root domain GitHub Pages: https://sellerbooksMBI.github.io/

## Runtime aktif

- `index.html`: entry point yang sedang dipublikasikan di GitHub Pages.
- `css/legacy-01.css` sampai `css/legacy-06.css`: lapisan CSS yang masih harus dipertahankan urutannya.
- `js/main.js`: mesin aplikasi utama klasik; sedang dipisah bertahap tanpa mengubah kontrak global dan inline handler.
- `js/modules/` dan `js/services/`: modul yang sudah dipindahkan dan dipanggil langsung oleh `index.html`.
- `js/legacy-01.js` sampai `js/legacy-09.js`, serta `css/legacy-02.css` dan `css/legacy-03.css`: salinan pemulihan; bukan jalur aktif dari `index.html`.

## Area `src/`

`src/` berisi kerangka Vite yang berbeda dari runtime klasik di atas. Jangan menganggap modul di sana sudah menjadi sumber produksi, dan jangan mengganti entry point sebelum autentikasi, integrasi, data, dan seluruh fitur lolos uji regresi.

## Prinsip refactor

- Repository ini terpisah dari `sellerbookscore`; jangan melakukan perubahan ke repository lama.
- Pertahankan urutan script dan gaya classic-script selama inline handler dan global function masih digunakan.
- Jangan mengubah rumus HPP/laba, import/deduplikasi, snapshot, atau marketplace API hanya untuk merapikan struktur.
- Setiap ekstraksi harus disertai pemeriksaan struktur dan build. Uji browser/WebView dan regresi fitur tetap diperlukan sebelum menyatakan rilis final.
