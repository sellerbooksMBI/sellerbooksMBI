function showView(viewId, button, saveHistory = true){

    if(window.sellerBooksImportInProgress){
        const isEN = typeof sellerBooksCurrentLanguage === "function" && sellerBooksCurrentLanguage() === "EN";
        if(typeof sellerBooksAlert === "function") sellerBooksAlert(isEN ? "Import is still running. Please wait until the save is verified." : "Import masih berjalan. Mohon tunggu sampai penyimpanan terverifikasi.");
        return;
    }

    /* =========================================
       TUTUP SEMUA HALAMAN
    ========================================= */

    document
        .querySelectorAll(".view")
        .forEach(function(view){

            view.classList.remove("active");

        });


    /* =========================================
       TAMPILKAN HALAMAN TERPILIH
    ========================================= */

    const targetView =
        document.getElementById(viewId);

    if(!targetView){
        return;
    }

    targetView.classList.add("active");

    /*
       Render berat dijadwalkan setelah navigasi selesai.
       Rincian memakai initializeProductAnalysis() karena fungsi itu
       sudah sekaligus menyiapkan filter + melakukan render pertama.
    */
    sellerBooksScheduleDeferredRender(function(){
        if(viewId === "dashboard" && typeof updateDashboardByPeriod === "function") updateDashboardByPeriod();
        else if(viewId === "marketplace" && typeof renderMarketplaces === "function") renderMarketplaces();
        else if(viewId === "stores" && typeof renderStores === "function") renderStores();
        else if(viewId === "products" && typeof renderProducts === "function") renderProducts();
        else if(viewId === "costs" && typeof renderCosts === "function") renderCosts();
        else if(viewId === "reports" && typeof updateReports === "function") updateReports();
        else if(viewId === "productAnalysis" && typeof initializeProductAnalysis === "function") initializeProductAnalysis();
        else if(viewId === "settings" && typeof loadSellerBooksSettings === "function") loadSellerBooksSettings();
    });


    /* =========================================
       UPDATE MENU AKTIF
    ========================================= */

    document
        .querySelectorAll(".menu-item")
        .forEach(function(menu){

            menu.classList.remove("active");

        });


    if(button){

        button.classList.add("active");

    }

    else{

        /* Cari menu berdasarkan onclick */

        const menuButtons =
            document.querySelectorAll(".menu-item");

        menuButtons.forEach(function(menu){

            const onclickValue =
                menu.getAttribute("onclick") || "";

            if(
                onclickValue.includes(
                    "showView('" + viewId + "'"
                )
            ){

                menu.classList.add("active");

            }

        });

    }


    /* =========================================
       UPDATE JUDUL HALAMAN
    ========================================= */

    if(pageData[viewId]){

        document.getElementById("topTitle").innerText =
            pageData[viewId].title;

        document.getElementById("topSubtitle").innerText =
            pageData[viewId].subtitle;

    }

    /*
       Sembunyikan subtitle topbar pada semua halaman selain Dashboard,
       karena deskripsi halaman sudah tampil di area konten.
       Dashboard tetap mempertahankan subtitle topbar.
    */
    const topSubtitle = document.getElementById("topSubtitle");
    if(topSubtitle){
        topSubtitle.hidden = (viewId !== "dashboard");
        topSubtitle.setAttribute(
            "aria-hidden",
            viewId !== "dashboard" ? "true" : "false"
        );
    }

    /*
       Dashboard memakai bahasa akun aktif.
       Halaman login tetap berada di luar engine i18n.
    */
    if(
        viewId === "dashboard" &&
        typeof sellerBooksApplyDashboardLanguage === "function"
    ){
        sellerBooksApplyDashboardLanguage();
    }

    if(
        viewId === "marketplace" &&
        typeof sellerBooksApplyMarketplaceLanguage === "function"
    ){
        sellerBooksApplyMarketplaceLanguage();
    }

    if(
        viewId === "stores" &&
        typeof sellerBooksApplyStoreLanguage === "function"
    ){
        sellerBooksApplyStoreLanguage();
    }

    if(
        viewId === "products" &&
        typeof sellerBooksApplyProductLanguage === "function"
    ){
        sellerBooksApplyProductLanguage();
    }

    if(
        viewId === "import" &&
        typeof sellerBooksApplySalesImportLanguage === "function"
    ){
        sellerBooksApplySalesImportLanguage();
    }
    if(viewId === "costs" && typeof sellerBooksApplyCostLanguage === "function"){
        sellerBooksApplyCostLanguage();
    }
    if(viewId === "productAnalysis" && typeof sellerBooksApplyDetailsLanguage === "function"){
        sellerBooksApplyDetailsLanguage();
    }
    if(viewId === "reports" && typeof sellerBooksApplyReportsLanguage === "function"){
        sellerBooksApplyReportsLanguage();
    }
    if(viewId === "settings" && typeof sellerBooksApplySettingsLanguage === "function"){
        sellerBooksApplySettingsLanguage();
    }
    if(typeof sellerBooksApplyNotificationLanguage === "function"){
        sellerBooksApplyNotificationLanguage();
    }


    /* =========================================
       TUTUP SIDEBAR DI HP
    ========================================= */

    if(window.innerWidth <= 900){

        const sidebar =
            document.getElementById("sidebar");

        if(sidebar){

            sidebar.classList.remove("show");

        }

    }


    /* =========================================
       SIMPAN RIWAYAT HALAMAN
    ========================================= */

    if(saveHistory){

        history.pushState(
            {
                sellerbooksPage:viewId
            },
            "",
            "#" + viewId
        );

    }


    /* =========================================
       KEMBALI KE ATAS
    ========================================= */

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

}

/* =====================================================
   MOBILE SIDEBAR
===================================================== */

function toggleSidebar(){

    document
        .getElementById("sidebar")
        .classList
        .toggle("show");

}

/* =====================================================
   TUTUP SIDEBAR SAAT KLIK DI LUAR SIDEBAR
   KHUSUS MOBILE / TABLET
   ===================================================== */

document.addEventListener("click", function(event) {

    // Hanya aktif pada layar mobile/tablet
    if (window.innerWidth > 900) {
        return;
    }

    const sidebar = document.querySelector(".sidebar");
    const mobileMenu = document.querySelector(".mobile-menu");

    if (!sidebar) {
        return;
    }

    // Jika sidebar sedang terbuka
    if (sidebar.classList.contains("show")) {

        // Klik di dalam sidebar → jangan tutup
        if (sidebar.contains(event.target)) {
            return;
        }

        // Klik tombol hamburger → jangan tutup dari kode ini
        if (mobileMenu && mobileMenu.contains(event.target)) {
            return;
        }

        // Klik area putih di luar sidebar → tutup
        sidebar.classList.remove("show");
    }
});
