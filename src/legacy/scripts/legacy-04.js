/* =====================================================
   SELLERBOOKS
   APPLICATION ENGINE
===================================================== */


/* =====================================================
   LOGIN DEMO
   NANTI DIGANTI SUPABASE AUTH
===================================================== */

/* =====================================================
   LOGIN DEMO
   NANTI DIGANTI SUPABASE AUTH
===================================================== */

function loginGoogle(){

    const savedOwnerName =
        localStorage.getItem(
            "sellerbooks_owner_name"
        );


    /* JIKA NAMA PEMILIK SUDAH ADA
       LANGSUNG MASUK DASHBOARD */

    if(savedOwnerName){

        document.getElementById(
            "loginPage"
        ).style.display = "none";


        document.getElementById(
            "ownerSetupPage"
        ).style.display = "none";


        document.getElementById(
            "app"
        ).style.display = "block";

        return;

    }


    /* JIKA BELUM ADA NAMA PEMILIK
       TAMPILKAN FORM NAMA PEMILIK */

    document.getElementById(
        "loginPage"
    ).style.display = "none";


    document.getElementById(
        "ownerSetupPage"
    ).style.display = "flex";


    document.getElementById(
        "app"
    ).style.display = "none";

}


/* =====================================================
   SIMPAN NAMA PEMILIK
===================================================== */

function saveOwnerName(){

    const input =
        document.getElementById(
            "ownerNameInput"
        );


    const ownerName =
        input.value.trim();


    /* VALIDASI */

    if(!ownerName){

        alert(
            "Silakan isi Nama Pemilik atau Nama Usaha terlebih dahulu."
        );

        input.focus();

        return;

    }


    /* SIMPAN */

    localStorage.setItem(
        "sellerbooks_owner_name",
        ownerName
    );

updateSidebarOwner();

    /* TUTUP HALAMAN NAMA PEMILIK */

    document.getElementById(
        "ownerSetupPage"
    ).style.display = "none";


    /* TUTUP LOGIN */

    document.getElementById(
        "loginPage"
    ).style.display = "none";


    /* BUKA DASHBOARD */

    document.getElementById(
        "app"
    ).style.display = "block";


    alert(
        "✅ Data berhasil disimpan!\n\n" +
        "Selamat datang, " + ownerName
    );

}


/* =====================================================
   NAVIGATION
===================================================== */

const pageData = {

    dashboard:{
        title:"Dashboard",
        subtitle:"Ringkasan bisnis marketplace Anda"
    },

    marketplace:{
        title:"Marketplace",
        subtitle:"Kelola marketplace bisnis Anda"
    },

    stores:{
        title:"Akun Toko",
        subtitle:"Kelola seluruh akun toko"
    },

    products:{
        title:"Master Produk",
        subtitle:"Kelola produk dan SKU"
    },

    import:{
        title:"Import Penjualan",
        subtitle:"Upload dan proses laporan penjualan"
    },

    costs:{
        title:"Biaya Lain",
        subtitle:"Kelola biaya tambahan bisnis"
    },

    reports:{
        title:"Laporan",
        subtitle:"Analisis bisnis marketplace Anda"
    },

    productAnalysis:{
        title:"Rincian",
        subtitle:"Analisis laba dan kerugian setiap produk"
    },

    settings:{
        title:"Pengaturan",
        subtitle:"Pengaturan SellerBooks"
    }

};


/* =====================================================
   NAVIGATION SELLERBOOKS
   + HISTORY BACK HP
===================================================== */


/* =========================================================
   RINCIAN PRODUK - ANALISIS LABA PER SKU
   FILTER BERDIRI SENDIRI, TIDAK MENGUBAH LAPORAN UTAMA
========================================================= */

function getProductAnalysisDateRange(){
    const fromValue =
        document.getElementById("productAnalysisDateFrom")?.value || "";

    const toValue =
        document.getElementById("productAnalysisDateTo")?.value || "";

    return {
        from: fromValue ? getReportDateOnly(fromValue) : null,
        to: toValue ? getReportDateOnly(toValue) : null
    };
}

function isTransactionInProductAnalysisPeriod(transaction, period){
    const date =
        getReportDateOnly(
            transaction.reportDate ||
            transaction.importedAt
        );

    if(!date){
        return true;
    }

    const now = new Date();
    const today =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

    if(period === "today"){
        return date.getTime() === today.getTime();
    }

    if(period === "yesterday"){
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return date.getTime() === yesterday.getTime();
    }

    if(period === "week" || period === "lastWeek"){
        const day = today.getDay();
        const diff = day === 0 ? 6 : day - 1;

        const startThisWeek = new Date(today);
        startThisWeek.setDate(today.getDate() - diff);

        if(period === "week"){
            return date >= startThisWeek && date <= today;
        }

        const startLastWeek = new Date(startThisWeek);
        startLastWeek.setDate(startLastWeek.getDate() - 7);

        const endLastWeek = new Date(startThisWeek);
        endLastWeek.setDate(endLastWeek.getDate() - 1);

        return date >= startLastWeek && date <= endLastWeek;
    }

    if(period === "month" || period === "lastMonth"){
        const targetMonth =
            period === "month"
                ? today.getMonth()
                : today.getMonth() - 1;

        const targetYear =
            today.getFullYear() +
            Math.floor(targetMonth / 12);

        const normalizedMonth =
            ((targetMonth % 12) + 12) % 12;

        const start =
            new Date(
                targetYear,
                normalizedMonth,
                1
            );

        const end =
            new Date(
                targetYear,
                normalizedMonth + 1,
                0
            );

        return date >= start && date <= end;
    }

    if(period === "last3Months"){
        const start =
            new Date(
                today.getFullYear(),
                today.getMonth() - 2,
                1
            );

        return date >= start && date <= today;
    }

    if(period === "year"){
        return (
            date.getFullYear() ===
            today.getFullYear()
        );
    }

    if(period === "custom"){
        const range =
            getProductAnalysisDateRange();

        if(range.from && date < range.from){
            return false;
        }

        if(range.to && date > range.to){
            return false;
        }

        return true;
    }

    return true;
}

function updateProductAnalysisDateUI(){
    const period =
        document.getElementById(
            "productAnalysisPeriod"
        )?.value || "month";

    const box =
        document.getElementById(
            "productAnalysisCustomDateRange"
        );

    if(!box){
        return;
    }

    const show =
        period === "custom";

    box.style.display =
        show ? "block" : "none";

    if(!show){
        return;
    }

    const now = new Date();

    const today =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

    const maxDate =
        today.toISOString().split("T")[0];

    const minDate =
        new Date(
            today.getFullYear(),
            today.getMonth() - 2,
            1
        )
        .toISOString()
        .split("T")[0];

    const from =
        document.getElementById(
            "productAnalysisDateFrom"
        );

    const to =
        document.getElementById(
            "productAnalysisDateTo"
        );

    if(from){
        from.min = minDate;
        from.max = maxDate;
    }

    if(to){
        to.min = minDate;
        to.max = maxDate;
    }
}

function loadProductAnalysisMarketplaceFilter(){

    const select =
        document.getElementById("productAnalysisMarketplace");

    if(!select){
        return;
    }

    const currentValue =
        select.value || "all";

    select.innerHTML = `
        <option value="all">Semua Marketplace</option>
    `;

    let marketplaces = [];

    try{
        marketplaces =
            JSON.parse(
                localStorage.getItem("sellerbooks_marketplaces") || "[]"
            ) || [];
    }catch(error){
        marketplaces = [];
    }

    marketplaces
        .filter(function(marketplace){
            return marketplace.status !== "inactive";
        })
        .forEach(function(marketplace){
            const option = document.createElement("option");
            option.value = marketplace.id;
            option.textContent = marketplace.name;
            select.appendChild(option);
        });

    if([...select.options].some(function(option){
        return option.value === currentValue;
    })){
        select.value = currentValue;
    }else{
        select.value = "all";
    }
}

function loadProductAnalysisStoreFilter(){

    const marketplaceSelect =
        document.getElementById("productAnalysisMarketplace");

    const storeSelect =
        document.getElementById("productAnalysisStore");

    if(!marketplaceSelect || !storeSelect){
        return;
    }

    const marketplaceId =
        marketplaceSelect.value || "all";

    const currentValue =
        storeSelect.value || "all";

    storeSelect.innerHTML = `
        <option value="all">Semua Akun Toko</option>
    `;

    let stores = [];

    try{
        stores =
            JSON.parse(
                localStorage.getItem("sellerbooks_stores") || "[]"
            ) || [];
    }catch(error){
        stores = [];
    }

    stores
        .filter(function(store){

            if(store.status === "inactive"){
                return false;
            }

            if(marketplaceId === "all"){
                return true;
            }

            return String(store.marketplaceId || "") ===
                String(marketplaceId);
        })
        .forEach(function(store){
            const option = document.createElement("option");
            option.value = store.id;
            option.textContent = store.name;
            storeSelect.appendChild(option);
        });

    if([...storeSelect.options].some(function(option){
        return option.value === currentValue;
    })){
        storeSelect.value = currentValue;
    }else{
        storeSelect.value = "all";
    }
}

function onProductAnalysisMarketplaceChange(){
    loadProductAnalysisStoreFilter();
    applyProductAnalysisFilters();
}

function getProductAnalysisTransactions(){
    const period =
        document.getElementById(
            "productAnalysisPeriod"
        )?.value || "month";

    const marketplaceId =
        document.getElementById("productAnalysisMarketplace")?.value || "all";

    const storeId =
        document.getElementById("productAnalysisStore")?.value || "all";

    return getAllReportTransactions()
        .filter(function(transaction){

            if(!isTransactionInProductAnalysisPeriod(
                transaction,
                period
            )){
                return false;
            }

            if(
                marketplaceId !== "all" &&
                String(transaction.marketplaceId || "") !== String(marketplaceId)
            ){
                return false;
            }

            if(
                storeId !== "all" &&
                String(transaction.storeId || "") !== String(storeId)
            ){
                return false;
            }

            return true;
        });
}

function calculateProductAnalysisRows(){
    const transactions =
        getProductAnalysisTransactions();

    const rows = new Map();

    transactions.forEach(function(item){

        const sku =
            String(item.sku || "")
                .trim();

        if(!sku){
            return;
        }

        const key = sku.toLowerCase();

        if(!rows.has(key)){
            rows.set(key,{
                sku:sku,
                qty:0,
                sales:0,
                hpp:0,
                admin:0,
                product:getMasterProductBySku(sku)
            });
        }

        const row = rows.get(key);

        const qty =
            Number(item.qty) || 0;

        const sales =
            getReportTransactionSalesAmount(item);

        const product =
            row.product ||
            getMasterProductBySku(sku);

        const cost =
            product
                ? Number(product.cost) || 0
                : 0;

        const feePercent =
            getReportStoreFeePercent(
                item.storeId
            );

        const admin =
            sales *
            (feePercent / 100);

        row.qty += qty;
        row.sales += sales;
        row.hpp += cost * qty;
        row.admin += admin;
    });

    return Array.from(rows.values())
        .map(function(row){

            row.price =
                row.product
                    ? Number(row.product.price) || 0
                    : 0;

            row.name =
                row.product
                    ? (row.product.name || row.sku)
                    : "SKU belum ada di Master Produk";

            /*
               Analisis produk:
               Penjualan - Admin Marketplace - HPP.
               Packing tidak dibebankan ke SKU karena
               packing merupakan biaya per order/resi.
            */
            row.profit =
                row.sales -
                row.admin -
                row.hpp;

            row.isLoss =
                row.profit < 0;

            return row;
        })
        .sort(function(a,b){

            if(a.isLoss !== b.isLoss){
                return a.isLoss ? -1 : 1;
            }

            return a.profit - b.profit;
        });
}

function formatProductAnalysisCurrency(value){
    return formatRupiah(value);
}

function renderProductAnalysis(){

    const body =
        document.getElementById(
            "productAnalysisTableBody"
        );

    if(!body){
        return;
    }

    const rows =
        calculateProductAnalysisRows();

    const totalProducts =
        document.getElementById(
            "productAnalysisTotalProducts"
        );

    const profitProducts =
        document.getElementById(
            "productAnalysisProfitProducts"
        );

    const lossProducts =
        document.getElementById(
            "productAnalysisLossProducts"
        );

    const totalProfit =
        document.getElementById(
            "productAnalysisTotalProfit"
        );

    const total =
        rows.length;

    const losses =
        rows.filter(function(row){
            return row.isLoss;
        }).length;

    const profits =
        total - losses;

    const profitValue =
        rows.reduce(function(sum,row){
            return sum + row.profit;
        },0);

    if(totalProducts){
        totalProducts.textContent = total;
    }

    if(profitProducts){
        profitProducts.textContent = profits;
    }

    if(lossProducts){
        lossProducts.textContent = losses;
    }

    if(totalProfit){
        totalProfit.textContent =
            formatProductAnalysisCurrency(
                profitValue
            );
    }

    if(!rows.length){
        body.innerHTML = `
            <tr class="analysis-empty-row">
                <td colspan="11">
                    Belum ada transaksi pada periode yang dipilih.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        rows.map(function(row,index){

            const profitClass =
                row.isLoss
                    ? "analysis-loss-value"
                    : "analysis-profit-value";

            const statusClass =
                row.isLoss
                    ? "analysis-status-loss"
                    : "analysis-status-profit";

            const statusText =
                row.isLoss
                    ? "⚠️ MINUS"
                    : "✓ UNTUNG";

            const action =
                row.product
                    ? `
                        <button
                            type="button"
                            class="analysis-fix-button"
                            onclick="fixProductFromAnalysis('${String(row.product.id).replace(/'/g,"\\'")}')"
                        >
                            ✏️ Perbaiki
                        </button>
                    `
                    : `
                        <span style="font-size:11px;color:#dc2626;">
                            Belum ada master
                        </span>
                    `;

            return `
                <tr class="${row.isLoss ? "analysis-loss-row" : ""}">
                    <td>${index + 1}</td>
                    <td>
                        <strong>${escapeHtmlProductAnalysis(row.sku)}</strong>
                    </td>
                    <td>
                        ${escapeHtmlProductAnalysis(row.name)}
                    </td>
                    <td>${row.qty}</td>
                    <td>${formatProductAnalysisCurrency(row.price)}</td>
                    <td>${formatProductAnalysisCurrency(row.sales)}</td>
                    <td>${formatProductAnalysisCurrency(row.hpp)}</td>
                    <td>${formatProductAnalysisCurrency(row.admin)}</td>
                    <td class="${profitClass}">
                        ${formatProductAnalysisCurrency(row.profit)}
                    </td>
                    <td>
                        <span class="analysis-status-badge ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>${action}</td>
                </tr>
            `;
        }).join("");
}

function escapeHtml(value){
    return escapeHtmlProductAnalysis(value);
}

function escapeHtmlProductAnalysis(value){
    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

function updateProductAnalysisFilterInfo(){

    const info =
        document.getElementById(
            "productAnalysisFilterInfo"
        );

    if(!info){
        return;
    }

    const period =
        document.getElementById(
            "productAnalysisPeriod"
        )?.value || "month";

    const names = {
        today:"Hari Ini",
        yesterday:"Kemarin",
        week:"Minggu Ini",
        lastWeek:"Minggu Lalu",
        month:"Bulan Ini",
        lastMonth:"Bulan Lalu",
        last3Months:"3 Bulan Terakhir",
        year:"Tahun Ini",
        custom:"Pilih Tanggal",
        all:"Semua Periode"
    };

    let label =
        names[period] ||
        "Bulan Ini";

    const marketplaceSelect =
        document.getElementById("productAnalysisMarketplace");

    const storeSelect =
        document.getElementById("productAnalysisStore");

    const marketplaceLabel =
        marketplaceSelect?.selectedOptions?.[0]?.textContent ||
        "Semua Marketplace";

    const storeLabel =
        storeSelect?.selectedOptions?.[0]?.textContent ||
        "Semua Akun Toko";

    if(period === "custom"){

        const from =
            document.getElementById(
                "productAnalysisDateFrom"
            )?.value || "";

        const to =
            document.getElementById(
                "productAnalysisDateTo"
            )?.value || "";

        if(from || to){
            label +=
                " (" +
                (
                    from
                        ? from.split("-").reverse().join("/")
                        : "..."
                ) +
                " s/d " +
                (
                    to
                        ? to.split("-").reverse().join("/")
                        : "..."
                ) +
                ")";
        }
    }

    info.innerHTML =
        "Periode: <strong>" +
        label +
        "</strong> &nbsp;|&nbsp; Marketplace: <strong>" +
        escapeHtmlProductAnalysis(marketplaceLabel) +
        "</strong> &nbsp;|&nbsp; Akun: <strong>" +
        escapeHtmlProductAnalysis(storeLabel) +
        "</strong>";
}

function applyProductAnalysisFilters(){

    const period = document.getElementById("productAnalysisPeriod");
    if(period){
        localStorage.setItem("sellerbooks_product_analysis_period", period.value);
        localStorage.setItem("sellerbooks_product_analysis_view_day", getSellerBooksDayKey());
    }

    updateProductAnalysisDateUI();
    updateProductAnalysisFilterInfo();
    renderProductAnalysis();
}

function initializeProductAnalysis(){

    const period =
        document.getElementById(
            "productAnalysisPeriod"
        );

    if(period){
        const todayKey = getSellerBooksDayKey();
        const savedDay = localStorage.getItem("sellerbooks_product_analysis_view_day");
        const savedPeriod = localStorage.getItem("sellerbooks_product_analysis_period");

        if(savedDay !== todayKey){
            period.value = "today";
            localStorage.setItem("sellerbooks_product_analysis_view_day", todayKey);
            localStorage.setItem("sellerbooks_product_analysis_period", "today");
        }else{
            period.value = savedPeriod || "today";
        }
    }

    loadProductAnalysisMarketplaceFilter();
    loadProductAnalysisStoreFilter();

    updateProductAnalysisDateUI();
    updateProductAnalysisFilterInfo();
    renderProductAnalysis();
}

function fixProductFromAnalysis(id){

    if(!id){
        return;
    }

    showView("products",null);

    setTimeout(function(){

        if(typeof editProduct === "function"){
            editProduct(id);
        }

    },100);
}


function showView(viewId, button, saveHistory = true){

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

    if(viewId === "productAnalysis"){
        initializeProductAnalysis();
    }


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
/* =====================================================
   MARKETPLACE DATABASE
   SEMENTARA LOCAL STORAGE
===================================================== */

let marketplaces = JSON.parse(

    localStorage.getItem("sellerbooks_marketplaces")

) || [

    {
        id:"shopee",
        name:"Shopee",
        icon:"🛍️",
        status:"active",
        system:true
    },

    {
        id:"tiktok",
        name:"TikTok Shop",
        icon:"🎵",
        status:"active",
        system:true
    },

    {
        id:"tokopedia",
        name:"Tokopedia",
        icon:"🟢",
        status:"inactive",
        system:true
    },

    {
        id:"lazada",
        name:"Lazada",
        icon:"🔵",
        status:"inactive",
        system:true
    },

    {
        id:"toco",
        name:"Toco",
        icon:"🟣",
        status:"inactive",
        system:true
    },

    {
        id:"blibli",
        name:"Blibli",
        icon:"🔷",
        status:"inactive",
        system:true
    }

];


let editingMarketplaceId = null;


/* =====================================================
   SAVE LOCAL
===================================================== */

function saveMarketplaceData(){

    localStorage.setItem(

        "sellerbooks_marketplaces",

        JSON.stringify(marketplaces)

    );

}


/* =====================================================
   RENDER MARKETPLACE
===================================================== */

function renderMarketplaces(){

    const grid =
        document.getElementById("marketplaceGrid");


    const count =
        document.getElementById("marketplaceCount");


    if(!grid) return;


    count.innerText =
        marketplaces.length + " Marketplace";


    grid.innerHTML = "";


    marketplaces.forEach(function(marketplace){

        const statusText =
            marketplace.status === "active"
            ? "Aktif"
            : "Tidak Aktif";


        const statusClass =
            marketplace.status === "active"
            ? "active"
            : "inactive";


        grid.innerHTML += `

        <div class="marketplace-card">

            <div class="marketplace-card-top">

                <div class="marketplace-card-icon">

                    ${marketplace.icon}

                </div>


                <div style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                ">

                    <span class="status ${statusClass}">

                        ${statusText}

                    </span>


                    <button
                        class="marketplace-more"
                        onclick="editMarketplace('${marketplace.id}')"
                    >
                        ⋮
                    </button>

                </div>

            </div>


            <h3>

                ${marketplace.name}

            </h3>


            <p>

                ${
                    marketplace.status === "active"
                    ? "Marketplace aktif dan siap digunakan"
                    : "Marketplace belum digunakan"
                }


            </p>


            <div class="marketplace-card-actions">


                <button
                    class="card-button primary"
                    onclick="goToStores('${marketplace.id}')"
                >

                    Kelola Toko

                </button>


                <button
                    class="card-button secondary"
                    onclick="toggleMarketplace('${marketplace.id}')"
                >

                    ${
                        marketplace.status === "active"
                        ? "Nonaktifkan"
                        : "Aktifkan"
                    }

                </button>


            </div>


        </div>

        `;

    });
renderMarketplacePerformance();

/* UPDATE MODUL AKUN TOKO */

if(typeof renderStores === "function"){

    renderStores();

}
}

/* =====================================================
   DASHBOARD PERFORMANCE MARKETPLACE
   MENAMPILKAN MARKETPLACE YANG AKTIF
===================================================== */

function renderMarketplacePerformance(){

    /*
       DASHBOARD:
       1. Kartu atas = TOTAL seluruh marketplace + seluruh akun toko.
       2. Tabel bawah = RINCIAN setiap marketplace.
       3. Harga jual dan HPP tetap berasal dari Master Produk.
       4. Marketplace yang belum memiliki transaksi tetap ditampilkan Rp0.
    */

    const transactions =
        getAllReportTransactions().filter(function(item){
            const reportDate =
                item.reportDate || item.importedAt;

            return isDateInPeriod(
                reportDate,
                currentDashboardPeriod
            );
        });

    let marketplacesData = [];
    let storesData = [];

    try{
        marketplacesData =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_marketplaces"
                ) || "[]"
            );
    }catch(error){
        marketplacesData = [];
    }

    try{
        storesData =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_stores"
                ) || "[]"
            );
    }catch(error){
        storesData = [];
    }

    const performanceBody =
        document.getElementById(
            "performanceMarketplaceBody"
        );

    /*
       =====================================================
       MASTER PRODUK
       =====================================================
    */

    let products = [];

    try{
        products =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_products"
                ) || "[]"
            );
    }catch(error){
        products = [];
    }

    const productMap =
        new Map();

    products.forEach(function(product){

        const sku =
            String(
                product.sku || ""
            )
            .trim()
            .toLowerCase();

        if(sku){
            productMap.set(
                sku,
                product
            );
        }

    });

    /*
       =====================================================
       HITUNG TOTAL DASHBOARD
       =====================================================
    */

    let totalSales = 0;
    let totalQty = 0;
    let totalHpp = 0;
    let totalAdmin = 0;

    transactions.forEach(function(item){

        const sales =
            getReportTransactionSalesAmount(
                item
            );

        const qty =
            Number(item.qty) || 0;

        totalSales += sales;
        totalQty += qty;

        const product =
            productMap.get(
                String(item.sku || "")
                    .trim()
                    .toLowerCase()
            );

        if(product){
            totalHpp +=
                (Number(product.cost) || 0) *
                qty;
        }

        totalAdmin +=
            sales *
            getReportStoreFeePercent(
                item.storeId
            ) /
            100;

    });

    const totalPackingCount =
        calculateReportPacking(
            transactions
        );

    const totalPacking =
        totalPackingCount *
        getPackingCostPerOrder();

    /*
       =====================================================
       BIAYA LAIN TOTAL
       =====================================================
    */

    let totalOtherCosts = 0;

    try{

        const costsData =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_costs"
                ) || "[]"
            );

        if(Array.isArray(costsData)){

            costsData.forEach(function(cost){

                const category =
                    String(
                        cost.category || ""
                    )
                    .trim()
                    .toLowerCase();

                /* Packing sudah dihitung dari transaksi. */
                if(
                    category === "packing" ||
                    category.includes("packing")
                ){
                    return;
                }

                const dateValue =
                    cost.date ||
                    cost.createdAt;

                if(
                    dateValue &&
                    !isDateInPeriod(
                        dateValue,
                        currentDashboardPeriod
                    )
                ){
                    return;
                }

                totalOtherCosts +=
                    Number(cost.amount) || 0;

            });

        }

    }catch(error){}

    const totalNetSales =
        totalSales -
        totalAdmin;

    const totalGrossProfit =
        totalNetSales -
        totalHpp -
        totalPacking;

    const totalNetProfit =
        totalGrossProfit -
        totalOtherCosts;

    const totalMargin =
        totalSales > 0
            ? (
                totalNetProfit /
                totalSales
            ) * 100
            : 0;

    /*
       =====================================================
       UPDATE 4 KARTU ATAS
       =====================================================
    */

    const dashboardTotalSales =
        document.getElementById(
            "dashboardTotalSales"
        );

    const dashboardTotalQty =
        document.getElementById(
            "dashboardTotalQty"
        );

    const dashboardNetProfit =
        document.getElementById(
            "dashboardNetProfit"
        );

    const dashboardMargin =
        document.getElementById(
            "dashboardMargin"
        );

    if(dashboardTotalSales){
        dashboardTotalSales.textContent =
            formatRupiah(
                totalSales
            );
    }

    if(dashboardTotalQty){
        dashboardTotalQty.textContent =
            totalQty.toLocaleString(
                "id-ID"
            ) +
            " PCS";
    }

    if(dashboardNetProfit){
        dashboardNetProfit.textContent =
            formatRupiah(
                totalNetProfit
            );
    }

    if(dashboardMargin){
        dashboardMargin.textContent =
            totalMargin.toLocaleString(
                "id-ID",
                {
                    minimumFractionDigits:2,
                    maximumFractionDigits:2
                }
            ) +
            "%";
    }

    /*
       UPDATE KETERANGAN KARTU
    */

    const dashboardCards =
        document.querySelectorAll(
            "#dashboard .stats-grid .stat-card"
        );

    if(dashboardCards.length >= 4){

        const salesInfo =
            dashboardCards[0]
                .querySelector(
                    ".stat-info"
                );

        const qtyInfo =
            dashboardCards[1]
                .querySelector(
                    ".stat-info"
                );

        const profitInfo =
            dashboardCards[2]
                .querySelector(
                    ".stat-info"
                );

        const marginInfo =
            dashboardCards[3]
                .querySelector(
                    ".stat-info"
                );

        if(salesInfo){
            salesInfo.textContent =
                transactions.length
                    ? "Total semua marketplace"
                    : "Belum ada data penjualan";
        }

        if(qtyInfo){
            qtyInfo.textContent =
                "Total produk semua marketplace";
        }

        if(profitInfo){
            profitInfo.textContent =
                "Laba bersih semua marketplace";
        }

        if(marginInfo){
            marginInfo.textContent =
                "Margin bersih semua marketplace";
        }

    }

    /*
       =====================================================
       JIKA TABEL TIDAK ADA, SELESAI DI KARTU
       =====================================================
    */

    if(!performanceBody){
        return;
    }

    /*
       =====================================================
       RINCIAN SETIAP MARKETPLACE
       TIDAK HANYA MARKETPLACE AKTIF.
       Semua marketplace ditampilkan agar angka Rp0 tetap
       terlihat dan struktur dashboard konsisten.
       =====================================================
    */

    const activeMarketplaces =
        marketplacesData.filter(function(marketplace){
            return marketplace.status === "active";
        });

    if(!activeMarketplaces.length){

        performanceBody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    style="
                        text-align:center;
                        padding:28px;
                        color:#64748b;
                    "
                >
                    Belum ada marketplace.
                </td>
            </tr>
        `;

        return;
    }

    const rows =
        activeMarketplaces.map(
            function(marketplace){

                const marketplaceId =
                    String(
                        marketplace.id || ""
                    );

                const marketplaceName =
                    String(
                        marketplace.name || ""
                    )
                    .trim()
                    .toLowerCase();

                const marketplaceStores =
                    storesData.filter(
                        function(store){

                            return (
                                String(
                                    store.marketplaceId || ""
                                ) === marketplaceId
                            );

                        }
                    );

                const marketplaceTransactions =
                    transactions.filter(
                        function(item){

                            const itemMarketplaceId =
                                String(
                                    item.marketplaceId || ""
                                )
                                .trim()
                                .toLowerCase();

                            const itemMarketplace =
                                String(
                                    item.marketplace || ""
                                )
                                .trim()
                                .toLowerCase();

                            if(
                                itemMarketplaceId ===
                                marketplaceId.toLowerCase()
                            ){
                                return true;
                            }

                            /*
                               Fallback untuk data import lama
                               yang mungkin hanya menyimpan nama
                               marketplace.
                            */

                            if(
                                marketplaceName &&
                                itemMarketplace ===
                                marketplaceName
                            ){
                                return true;
                            }

                            if(
                                marketplaceId === "tiktok" &&
                                (
                                    itemMarketplace === "tiktok" ||
                                    itemMarketplace === "tiktok shop"
                                )
                            ){
                                return true;
                            }

                            return false;

                        }
                    );

                let sales = 0;
                let qty = 0;
                let hpp = 0;
                let admin = 0;

                marketplaceTransactions.forEach(
                    function(item){

                        const itemSales =
                            getReportTransactionSalesAmount(
                                item
                            );

                        const itemQty =
                            Number(
                                item.qty
                            ) || 0;

                        sales +=
                            itemSales;

                        qty +=
                            itemQty;

                        const product =
                            productMap.get(
                                String(
                                    item.sku || ""
                                )
                                .trim()
                                .toLowerCase()
                            );

                        if(product){

                            hpp +=
                                (
                                    Number(
                                        product.cost
                                    ) || 0
                                ) *
                                itemQty;

                        }

                        admin +=
                            itemSales *
                            getReportStoreFeePercent(
                                item.storeId
                            ) /
                            100;

                    }
                );

                const packingCount =
                    calculateReportPacking(
                        marketplaceTransactions
                    );

                const packingCost =
                    packingCount *
                    getPackingCostPerOrder();

                let otherCosts = 0;

                try{

                    const costsData =
                        JSON.parse(
                            localStorage.getItem(
                                "sellerbooks_costs"
                            ) || "[]"
                        );

                    if(Array.isArray(costsData)){

                        costsData.forEach(
                            function(cost){

                                const category =
                                    String(
                                        cost.category || ""
                                    )
                                    .trim()
                                    .toLowerCase();

                                if(
                                    category === "packing" ||
                                    category.includes("packing")
                                ){
                                    return;
                                }

                                const dateValue =
                                    cost.date ||
                                    cost.createdAt;

                                if(
                                    dateValue &&
                                    !isDateInPeriod(
                                        dateValue,
                                        currentDashboardPeriod
                                    )
                                ){
                                    return;
                                }

                                const costMarketplaceId =
                                    String(
                                        cost.marketplaceId || ""
                                    )
                                    .trim();

                                if(
                                    costMarketplaceId &&
                                    costMarketplaceId !==
                                    marketplaceId
                                ){
                                    return;
                                }

                                if(
                                    costMarketplaceId ===
                                    marketplaceId
                                ){
                                    otherCosts +=
                                        Number(
                                            cost.amount
                                        ) || 0;
                                }

                            }
                        );

                    }

                }catch(error){}

                const netSales =
                    sales -
                    admin;

                const netProfit =
                    netSales -
                    hpp -
                    packingCost -
                    otherCosts;

                const margin =
                    sales > 0
                        ? (
                            netProfit /
                            sales
                        ) * 100
                        : 0;

                return {
                    marketplace:
                        marketplace,
                    accountCount:
                        marketplaceStores.length,
                    sales:
                        sales,
                    netProfit:
                        netProfit,
                    margin:
                        margin,
                    qty:
                        qty,
                    packingCount:
                        packingCount
                };

            }
        );

    performanceBody.innerHTML =
        rows.map(
            function(row){

                const marketplace =
                    row.marketplace;

                const marketplaceIcon =
                    marketplace.icon ||
                    "🛍️";

                return `
                    <tr>

                        <td>
                            <div class="marketplace-row">

                                <div class="marketplace-icon">
                                    ${marketplaceIcon}
                                </div>

                                <span>
                                    ${marketplace.name || "-"}
                                </span>

                            </div>
                        </td>

                        <td>
                            <strong>
                                ${row.accountCount}
                            </strong>
                            Akun
                        </td>

                        <td>
                            ${formatRupiah(row.sales)}
                        </td>

                        <td>
                            <span
                                style="
                                    color:${
                                        row.netProfit < 0
                                            ? "#dc2626"
                                            : "#0f172a"
                                    };
                                    font-weight:700;
                                "
                            >
                                ${formatRupiah(
                                    row.netProfit
                                )}
                            </span>
                        </td>

                    </tr>
                `;

            }
        ).join("");

}
function openMarketplaceModal(){

    editingMarketplaceId = null;


    document.getElementById(
        "marketplaceModalTitle"
    ).innerText = "Tambah Marketplace";


    document.getElementById(
        "marketplaceName"
    ).value = "";


    document.getElementById(
        "marketplaceStatus"
    ).value = "active";


    document
        .getElementById("marketplaceModal")
        .classList
        .add("show");

}


function closeMarketplaceModal(){

    document
        .getElementById("marketplaceModal")
        .classList
        .remove("show");

}


/* =====================================================
   SAVE MARKETPLACE
===================================================== */

function saveMarketplace(){

    const name =
        document
        .getElementById("marketplaceName")
        .value
        .trim();


    const status =
        document
        .getElementById("marketplaceStatus")
        .value;

    if(name === ""){

        alert("Nama marketplace wajib diisi.");

        return;

    }


    if(editingMarketplaceId){

        const marketplace =
            marketplaces.find(function(item){

                return item.id === editingMarketplaceId;

            });


        if(marketplace){
    marketplace.name = name;
    marketplace.status = status;
    marketplace.updatedAt = new Date().toISOString();
}

    }else{

        const id =
            "marketplace_" + Date.now();


        marketplaces.push({
    id:id,
    name:name,
    icon:"🏪",
    status:status,
    system:false,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
});

    }


    saveMarketplaceData();

    renderMarketplaces();

    closeMarketplaceModal();

}


/* =====================================================
   EDIT MARKETPLACE
===================================================== */

function editMarketplace(id){

    const marketplace =
        marketplaces.find(function(item){

            return item.id === id;

        });


    if(!marketplace) return;


    editingMarketplaceId = id;


    document.getElementById(
        "marketplaceModalTitle"
    ).innerText = "Edit Marketplace";


    document.getElementById(
        "marketplaceName"
    ).value = marketplace.name;


    document.getElementById(
        "marketplaceStatus"
    ).value = marketplace.status;


    document
        .getElementById("marketplaceModal")
        .classList
        .add("show");

}


/* =====================================================
   ACTIVATE / DEACTIVATE
===================================================== */

function toggleMarketplace(id){

    const marketplace =
        marketplaces.find(function(item){

            return item.id === id;

        });


    if(!marketplace) return;


    marketplace.status =
        marketplace.status === "active"
        ? "inactive"
        : "active";


    saveMarketplaceData();

    renderMarketplaces();

}


/* =====================================================
   GO TO STORE
===================================================== */

function goToStores(id){

    /*
       SIMPAN MARKETPLACE YANG DIPILIH
    */

    selectedMarketplaceId = id;


    /*
       PINDAH KE HALAMAN AKUN TOKO
    */

    showView("stores");


    /*
       FILTER LANGSUNG
       KE MARKETPLACE TERSEBUT
    */

    renderStoreMarketplaceFilter();


    const filter =

        document.getElementById(
            "storeMarketplaceFilter"
        );


    if(filter){

        filter.value = id;

    }


    renderStores();

}

/* =====================================================
   AKUN TOKO DATABASE
   SEMENTARA MENGGUNAKAN LOCAL STORAGE
===================================================== */

let stores = JSON.parse(

    localStorage.getItem("sellerbooks_stores")

) || [];


/* ID TOKO YANG SEDANG DIEDIT */

let editingStoreId = null;


/* MARKETPLACE YANG DIPILIH DARI TOMBOL KELOLA TOKO */

let selectedMarketplaceId = null;



/* =====================================================
   SIMPAN DATA TOKO
===================================================== */

function saveStoreData(){

    localStorage.setItem(

        "sellerbooks_stores",

        JSON.stringify(stores)

    );

}



/* =====================================================
   AMBIL MARKETPLACE AKTIF
===================================================== */

function getActiveMarketplaces(){

    return marketplaces.filter(function(marketplace){

        return marketplace.status === "active";

    });

}



/* =====================================================
   RENDER PILIHAN MARKETPLACE
===================================================== */

function renderStoreMarketplaceOptions(){

    const select =

        document.getElementById(
            "storeMarketplace"
        );


    if(!select) return;


    const currentValue = select.value;


    select.innerHTML = `

        <option value="">

            Pilih Marketplace

        </option>

    `;


    const activeMarketplaces =

        getActiveMarketplaces();


    activeMarketplaces.forEach(function(marketplace){

        select.innerHTML += `

            <option value="${marketplace.id}">

                ${marketplace.icon}
                ${marketplace.name}

            </option>

        `;

    });


    /* KEMBALIKAN PILIHAN LAMA JIKA MASIH ADA */

    if(currentValue){

        select.value = currentValue;

    }

}



/* =====================================================
   RENDER FILTER MARKETPLACE
===================================================== */

function renderStoreMarketplaceFilter(){

    const filter =

        document.getElementById(
            "storeMarketplaceFilter"
        );


    if(!filter) return;


    const currentValue = filter.value || "all";


    filter.innerHTML = `

        <option value="all">

            Semua Marketplace

        </option>

    `;


    const activeMarketplaces =

        getActiveMarketplaces();


    activeMarketplaces.forEach(function(marketplace){

        filter.innerHTML += `

            <option value="${marketplace.id}">

                ${marketplace.icon}
                ${marketplace.name}

            </option>

        `;

    });


    /* JIKA MARKETPLACE MASIH AKTIF */

    const stillExists =

        currentValue === "all" ||

        activeMarketplaces.some(function(marketplace){

            return marketplace.id === currentValue;

        });


    filter.value =

        stillExists
        ? currentValue
        : "all";

}



/* =====================================================
   RENDER AKUN TOKO
===================================================== */

function renderStores(){

    const grid =

        document.getElementById(
            "storesGrid"
        );


    const count =

        document.getElementById(
            "storeCount"
        );


    if(!grid) return;


    renderStoreMarketplaceFilter();


    const filter =

        document.getElementById(
            "storeMarketplaceFilter"
        );


    const filterValue =

        filter
        ? filter.value
        : "all";


    /*
       HANYA TAMPILKAN TOKO
       DARI MARKETPLACE YANG AKTIF
    */

    let visibleStores =

        stores.filter(function(store){

            const marketplace =

                marketplaces.find(function(item){

                    return item.id === store.marketplaceId;

                });


            if(!marketplace){

                return false;

            }


            if(marketplace.status !== "active"){

                return false;

            }


            if(
                filterValue !== "all" &&
                store.marketplaceId !== filterValue
            ){

                return false;

            }


            return true;

        });


    /*
       HITUNG TOTAL TOKO YANG TAMPIL
    */

    if(count){

        count.innerText =

            visibleStores.length +
            " Akun Toko";

    }


    grid.innerHTML = "";


    /*
       EMPTY STATE
    */

    if(visibleStores.length === 0){

        grid.innerHTML = `

            <div class="store-empty">

                <div class="store-empty-icon">

                    🏬

                </div>


                <h3>

                    Belum Ada Akun Toko

                </h3>


                <p>

                    Tambahkan akun toko dari marketplace
                    yang aktif untuk mulai mengelola bisnis.

                </p>


            </div>

        `;


        return;

    }



    /* =================================================
       BUAT CARD TOKO
    ================================================= */

    visibleStores.forEach(function(store){

        const marketplace =

            marketplaces.find(function(item){

                return item.id === store.marketplaceId;

            });


        if(!marketplace) return;


        const statusText =

            store.status === "active"

            ? "Aktif"

            : "Tidak Aktif";


        const statusClass =

            store.status === "active"

            ? "active"

            : "inactive";


        grid.innerHTML += `

            <div class="store-card">


                <div class="store-card-top">


                    <div class="store-marketplace">


                        <div class="store-marketplace-icon">

                            ${marketplace.icon}

                        </div>


                        <div>


                            <div class="store-marketplace-name">

                                ${marketplace.name}

                            </div>


                            <span class="status ${statusClass}">

                                ${statusText}

                            </span>


                        </div>


                    </div>


                </div>



                <div class="store-name">

                    ${store.name}

                </div>



                <div class="store-description">

                    ${
                        store.description
                        ? store.description
                        : "Belum ada keterangan toko."
                    }

                </div>



                <div class="store-info">


                    <div class="store-info-item">

                        KODE TOKO

                        <strong>

                            ${
                                store.code
                                ? store.code
                                : "-"
                            }

                        </strong>

                    </div>



                    <div class="store-info-item">

                        MARKETPLACE

                        <strong>

                            ${marketplace.name}

                        </strong>

                    </div>
<div class="store-info-item">

    BIAYA ADMIN

    <strong>
        ${
            store.feePercent !== undefined &&
            store.feePercent !== null &&
            store.feePercent !== ""
            ? Number(store.feePercent) + "%"
            : "-"
        }
    </strong>

</div>


                <div class="store-actions">


                    <button
                        class="
                            store-action-button
                            store-edit-button
                        "
                        onclick="editStore('${store.id}')"
                    >

                        ✏️ Edit

                    </button>



                    <button
                        class="
                            store-action-button
                            store-toggle-button
                        "
                        onclick="toggleStore('${store.id}')"
                    >

                        ${
                            store.status === "active"

                            ? "Nonaktifkan"

                            : "Aktifkan"
                        }

                    </button>



                    <button
                        class="
                            store-action-button
                            store-delete-button
                        "
                        onclick="deleteStore('${store.id}')"
                    >

                        🗑

                    </button>


                </div>


            </div>

        `;

    });


    /*
       UPDATE DASHBOARD
    */

    updateMarketplaceStoreCounts();

}



/* =====================================================
   BUKA MODAL TAMBAH TOKO
===================================================== */

function openStoreModal(){

    const activeMarketplaces =

        getActiveMarketplaces();


    /*
       CEK APAKAH ADA MARKETPLACE AKTIF
    */

    if(activeMarketplaces.length === 0){

        alert(

            "Belum ada marketplace aktif. " +
            "Silakan aktifkan marketplace terlebih dahulu."

        );

        return;

    }


    editingStoreId = null;


    document.getElementById(
        "storeModalTitle"
    ).innerText =

        "Tambah Akun Toko";


    /*
       KOSONGKAN FORM
    */

    document.getElementById(
        "storeName"
    ).value = "";


    document.getElementById(
        "storeCode"
    ).value = "";

document.getElementById(
    "storeFeePercent"
).value = "";

    document.getElementById(
        "storeDescription"
    ).value = "";


    document.getElementById(
        "storeStatus"
    ).value = "active";


    renderStoreMarketplaceOptions();


    /*
       JIKA MASUK DARI TOMBOL
       KELOLA TOKO MARKETPLACE
    */

    if(selectedMarketplaceId){

        document.getElementById(
            "storeMarketplace"
        ).value = selectedMarketplaceId;

    }


    document
        .getElementById("storeModal")
        .classList
        .add("show");

}



/* =====================================================
   TUTUP MODAL
===================================================== */

function closeStoreModal(){

    document
        .getElementById("storeModal")
        .classList
        .remove("show");


    editingStoreId = null;

    selectedMarketplaceId = null;

}



/* =====================================================
   SIMPAN AKUN TOKO
===================================================== */

function saveStore(){

    const marketplaceId =

        document.getElementById(
            "storeMarketplace"
        ).value;


    const name =

        document.getElementById(
            "storeName"
        ).value
        .trim();


    const code =

        document.getElementById(
            "storeCode"
        ).value
        .trim();


    const description =

        document.getElementById(
            "storeDescription"
        ).value
        .trim();


    const status =

        document.getElementById(
            "storeStatus"
        ).value;

const feePercent =
    parseFloat(
        document.getElementById(
            "storeFeePercent"
        ).value
    ) || 0;



    /*
       VALIDASI
    */

    if(!marketplaceId){

        alert(
            "Silakan pilih marketplace."
        );

        return;

    }


    if(!name){

        alert(
            "Nama akun toko wajib diisi."
        );

        return;

    }

if(feePercent < 0 || feePercent > 100){

    alert(
        "Biaya admin harus antara 0% sampai 100%."
    );

    return;
}

    /*
       CEK MARKETPLACE MASIH AKTIF
    */

    const marketplace =

        marketplaces.find(function(item){

            return item.id === marketplaceId;

        });


    if(
        !marketplace ||
        marketplace.status !== "active"
    ){

        alert(

            "Marketplace ini sudah tidak aktif. " +
            "Silakan pilih marketplace aktif."

        );

        return;

    }



    /* EDIT TOKO */

    if(editingStoreId){


        const store =

            stores.find(function(item){

                return item.id === editingStoreId;

            });


        if(store){

            store.marketplaceId = marketplaceId;

            store.name = name;

            store.code = code;

            store.feePercent = feePercent;

            store.description = description;

            store.status = status;

            store.updatedAt =
                new Date().toISOString();

        }


    }


    /* TAMBAH TOKO BARU */

    else{


        /*
           CEK NAMA TOKO GANDA
           DALAM MARKETPLACE YANG SAMA
        */

        const duplicate =

            stores.some(function(store){

                return (

                    store.marketplaceId === marketplaceId &&

                    store.name.toLowerCase() ===
                    name.toLowerCase()

                );

            });


        if(duplicate){

            alert(

                "Nama toko ini sudah terdaftar " +
                "di marketplace yang dipilih."

            );

            return;

        }



        stores.push({

            id:"store_" + Date.now(),

            marketplaceId:marketplaceId,

            name:name,

            code:code,

            feePercent:feePercent,

            description:description,

            status:status,

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()

        });

    }



    saveStoreData();

    renderStores();

    renderMarketplaceStoreCounts();

    closeStoreModal();

}



/* =====================================================
   EDIT AKUN TOKO
===================================================== */

function editStore(id){

    const store =

        stores.find(function(item){

            return item.id === id;

        });


    if(!store) return;


    editingStoreId = id;


    selectedMarketplaceId = null;


    document.getElementById(
        "storeModalTitle"
    ).innerText =

        "Edit Akun Toko";


    renderStoreMarketplaceOptions();


    document.getElementById(
        "storeMarketplace"
    ).value = store.marketplaceId;


    document.getElementById(
        "storeName"
    ).value = store.name;


    document.getElementById(
        "storeCode"
    ).value = store.code || "";

document.getElementById(
    "storeFeePercent"
).value =
    store.feePercent ?? "";

    document.getElementById(
        "storeDescription"
    ).value = store.description || "";


    document.getElementById(
        "storeStatus"
    ).value = store.status;


    document
        .getElementById("storeModal")
        .classList
        .add("show");

}



/* =====================================================
   AKTIF / NONAKTIF TOKO
===================================================== */

function toggleStore(id){

    const store =

        stores.find(function(item){

            return item.id === id;

        });


    if(!store) return;


    store.status =

        store.status === "active"

        ? "inactive"

        : "active";


    store.updatedAt =
        new Date().toISOString();


    saveStoreData();

    renderStores();

    renderMarketplaceStoreCounts();

}



/* =====================================================
   HAPUS TOKO
===================================================== */

function deleteStore(id){

    const store =

        stores.find(function(item){

            return item.id === id;

        });


    if(!store) return;


    const confirmation = confirm(

        'Hapus akun toko "' +

        store.name +

        '"?'

    );


    if(!confirmation){

        return;

    }


    stores =

        stores.filter(function(item){

            return item.id !== id;

        });


    saveStoreData();

    renderStores();

    renderMarketplaceStoreCounts();

}



/* =====================================================
   UPDATE JUMLAH TOKO DI DASHBOARD
===================================================== */

function renderMarketplaceStoreCounts(){

    /*
       JIKA SUDAH ADA ENGINE
       PERFORMA MARKETPLACE
    */

    if(
        typeof renderMarketplacePerformance
        === "function"
    ){

        renderMarketplacePerformance();

    }

}



/* =====================================================
   FUNGSI TAMBAHAN
   UPDATE MARKETPLACE PERFORMANCE
===================================================== */

function updateMarketplaceStoreCounts(){

    /*
       FUNGSI INI DISIAPKAN UNTUK
       INTEGRASI DASHBOARD
    */

    if(
        typeof renderMarketplacePerformance
        === "function"
    ){

        renderMarketplacePerformance();

    }

}
/* =====================================================
   BIAYA PACKING
   DIHITUNG PER ORDER / IDENTITAS PACKING UNIK
===================================================== */
function getPackingCostPerOrder(){return Number(localStorage.getItem("sellerbooks_packing_unit_cost")||0)||0;}
function getTotalPackingCost(){const imports=JSON.parse(localStorage.getItem("sellerbooks_sales_imports")||"[]");return imports.reduce(function(total,item){return total+Number(item.totalPackingCost||0);},0);}

/* =====================================================
   MASTER PRODUK DATABASE
===================================================== */

let products = JSON.parse(

    localStorage.getItem("sellerbooks_products")

) || [];


/* PRODUK YANG SEDANG DIEDIT */

let editingProductId = null;



/* =====================================================
   SIMPAN DATABASE PRODUK
===================================================== */

function saveProductData(){

    localStorage.setItem(

        "sellerbooks_products",

        JSON.stringify(products)

    );

}



/* =====================================================
   KURS MATA UANG SELLERBOOKS
===================================================== */

function getSellerBooksExchangeRates(){
    const settings =
        getSellerBooksSettings();

    const defaults = {
        IDR: 1,
        USD: 16500,
        SGD: 12900,
        MYR: 3900
    };

    const savedRates =
        settings &&
        settings.exchangeRates &&
        typeof settings.exchangeRates === "object"
            ? settings.exchangeRates
            : {};

    return {
        IDR: 1,
        USD:
            Number(savedRates.USD) > 0
                ? Number(savedRates.USD)
                : defaults.USD,
        SGD:
            Number(savedRates.SGD) > 0
                ? Number(savedRates.SGD)
                : defaults.SGD,
        MYR:
            Number(savedRates.MYR) > 0
                ? Number(savedRates.MYR)
                : defaults.MYR
    };
}


/* =====================================================
   FORMAT RUPIAH
===================================================== */

function formatRupiah(value){

    /*
       SEMUA NOMINAL INTERNAL SELLERBOOKS DISIMPAN DALAM IDR.
       Pengaturan mata uang hanya menentukan mata uang tampilan,
       tetapi sekarang nilai juga DIKONVERSI dari IDR ke mata uang pilihan.
    */
    if(
        typeof getSellerBooksSettings === "function"
    ){
        const settings =
            getSellerBooksSettings();

        const currency =
            settings.currency || "IDR";

        const rounding =
            settings.rounding || "none";

        let numeric =
            Number(value) || 0;

        /*
           KURS KONVERSI
           Basis seluruh data SellerBooks = IDR.
           Nilai kurs diambil dari Pengaturan agar
           pengguna dapat memperbaruinya kapan saja.
        */
        const exchangeRates =
            getSellerBooksExchangeRates();

        /* Pembulatan tetap dilakukan pada nilai dasar IDR. */
        if(
            rounding !== "none"
        ){
            const unit =
                Number(rounding);

            if(
                Number.isFinite(unit) &&
                unit > 0
            ){
                numeric =
                    Math.round(
                        numeric / unit
                    ) * unit;
            }
        }

        const currencyConfig = {
            IDR:{
                locale:"id-ID",
                currency:"IDR",
                minimumFractionDigits:0,
                maximumFractionDigits:0
            },
            USD:{
                locale:"en-US",
                currency:"USD",
                minimumFractionDigits:2,
                maximumFractionDigits:2
            },
            SGD:{
                locale:"en-SG",
                currency:"SGD",
                minimumFractionDigits:2,
                maximumFractionDigits:2
            },
            MYR:{
                locale:"ms-MY",
                currency:"MYR",
                minimumFractionDigits:2,
                maximumFractionDigits:2
            }
        };

        const config =
            currencyConfig[currency] ||
            currencyConfig.IDR;

        const exchangeRate =
            Number(exchangeRates[currency]) || 1;

        /*
           Konversi IDR -> mata uang pilihan.
           Contoh: Rp25.000 / 16.500 = USD 1,52.
        */
        numeric =
            numeric / exchangeRate;

        return new Intl.NumberFormat(
            config.locale,
            {
                style:"currency",
                currency:config.currency,
                minimumFractionDigits:
                    config.minimumFractionDigits,
                maximumFractionDigits:
                    config.maximumFractionDigits
            }
        ).format(numeric);
    }

    return new Intl.NumberFormat(
        "id-ID",
        {
            style:"currency",
            currency:"IDR",
            minimumFractionDigits:0
        }
    ).format(value || 0);

}



/* =====================================================
   RENDER MASTER PRODUK
===================================================== */

function renderProducts(){

    const tableBody =

        document.getElementById(
            "productsTableBody"
        );


    const productCount =

        document.getElementById(
            "productCount"
        );


    if(!tableBody){

        return;

    }



    /* SEARCH */

    const searchInput =

        document.getElementById(
            "productSearch"
        );


    const search =

        searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";



    /* FILTER STATUS */

    const statusFilter =

        document.getElementById(
            "productStatusFilter"
        );


    const status =

        statusFilter
        ? statusFilter.value
        : "all";



    /* FILTER DATA */

    let filteredProducts =

        products.filter(function(product){


            const matchSearch =

                product.sku
                .toLowerCase()
                .includes(search)

                ||

                product.name
                .toLowerCase()
                .includes(search);



            const matchStatus =

                status === "all"

                ||

                product.status === status;



            return matchSearch && matchStatus;

        });



    /* UPDATE JUMLAH */

    if(productCount){

        productCount.innerText =

            filteredProducts.length +
            " Produk";

    }



    /* KOSONGKAN TABLE */

    tableBody.innerHTML = "";

    const selectAllProducts =
        document.getElementById(
            "selectAllProducts"
        );

    if(selectAllProducts){

        selectAllProducts.checked = false;

    }

    updateSelectedProductUI();



    /* EMPTY STATE */

    if(filteredProducts.length === 0){

        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                >

                    <div class="product-empty">

                        <div class="product-empty-icon">

                            📦

                        </div>


                        <h3>

                            Belum Ada Produk

                        </h3>


                        <p>

                            Tambahkan produk secara manual
                            atau import menggunakan Excel.

                        </p>

                    </div>

                </td>

            </tr>

        `;


        return;

    }



    /* =================================================
       BUAT BARIS PRODUK
    ================================================= */

    filteredProducts.forEach(function(product){


        const statusText =

            product.status === "active"

            ? "Aktif"

            : "Tidak Aktif";


        const statusClass =

            product.status === "active"

            ? "active"

            : "inactive";



        tableBody.innerHTML += `

            <tr>


                <td class="product-select-column">

                    <input
                        type="checkbox"
                        class="product-select-checkbox product-row-checkbox"
                        value="${product.id}"
                        onchange="updateSelectedProductUI()"
                    >

                </td>


                <td>

                    <span class="product-sku">

                        ${product.sku}

                    </span>

                </td>



                <td>

                    <div class="product-name">

                        ${product.name}

                    </div>

                </td>



                <td>

                    <span class="product-category">

                        ${
                            product.category
                            ? product.category
                            : "-"
                        }

                    </span>

                </td>



                <td>

                    <span class="product-price">

                        ${formatRupiah(product.price)}

                    </span>

                </td>



                <td>

                    <span class="product-price">

                        ${formatRupiah(product.cost)}

                    </span>

                </td>

                <td>
                   <span class="product-stock">
        
                        ${Number(product.stock) || 0}
    
                    </span>
               
                </td>

                <td>

                    <span class="status ${statusClass}">

                        ${statusText}

                    </span>

                </td>



                <td>


                    <div class="product-actions">


                        <button
                            class="
                                product-action-button
                                product-edit
                            "
                            onclick="editProduct('${product.id}')"
                        >

                            ✏️

                        </button>



                        <button
                            class="
                                product-action-button
                                product-toggle
                            "
                            onclick="toggleProduct('${product.id}')"
                        >

                            ${
                                product.status === "active"

                                ? "Nonaktifkan"

                                : "Aktifkan"
                            }

                        </button>



                        <button
                            class="
                                product-action-button
                                product-delete
                            "
                            onclick="deleteProduct('${product.id}')"
                        >

                            🗑️

                        </button>


                    </div>


                </td>


            </tr>

        `;

    });

}



/* =====================================================
   BUKA MODAL TAMBAH PRODUK
===================================================== */

function openProductModal(){

    editingProductId = null;


    document.getElementById(
        "productModalTitle"
    ).innerText =

        "Tambah Produk";


    document.getElementById(
        "productSKU"
    ).value = "";


    document.getElementById(
        "productName"
    ).value = "";


    document.getElementById(
        "productCategory"
    ).value = "";


    document.getElementById(
        "productPrice"
    ).value = "";


    document.getElementById(
        "productCost"
    ).value = "";

    
    document.getElementById(
    "productStock"
    ).value = "0";

    
    document.getElementById(
        "productStatus"
    ).value = "active";


    document
        .getElementById("productModal")
        .classList
        .add("show");

}



/* =====================================================
   TUTUP MODAL
===================================================== */

function closeProductModal(){

    document
        .getElementById("productModal")
        .classList
        .remove("show");


    editingProductId = null;

}



/* =====================================================
   SIMPAN PRODUK
===================================================== */

function saveProduct(){

    const sku =

        document.getElementById(
            "productSKU"
        )
        .value
        .trim();


    const name =

        document.getElementById(
            "productName"
        )
        .value
        .trim();


    const category =

        document.getElementById(
            "productCategory"
        )
        .value
        .trim();


    const price =

        Number(

            document.getElementById(
                "productPrice"
            ).value

        ) || 0;


    const cost =

        Number(

            document.getElementById(
                "productCost"
            ).value

        ) || 0;


    const stock =
        Math.max(
            0,
        Number(
            document.getElementById(
                "productStock"
            ).value
        ) || 0
    );
   

    const status =

        document.getElementById(
            "productStatus"
        ).value;



    /* VALIDASI SKU */

    if(!sku){

        alert(
            "SKU produk wajib diisi."
        );

        return;

    }



    /* VALIDASI NAMA */

    if(!name){

        alert(
            "Nama produk wajib diisi."
        );

        return;

    }



    /* VALIDASI HPP */

    if(

        document.getElementById(
            "productCost"
        ).value === ""

    ){

        alert(
            "HPP / Modal produk wajib diisi."
        );

        return;

    }



    /* EDIT PRODUK */

    if(editingProductId){


        /*
           CEK SKU GANDA
           SELAIN PRODUK YANG DIEDIT
        */

        const duplicateSKU =

            products.some(function(product){

                return (

                    product.sku.toLowerCase()
                    === sku.toLowerCase()

                    &&

                    product.id !== editingProductId

                );

            });


        if(duplicateSKU){

            alert(
                "SKU sudah digunakan oleh produk lain."
            );

            return;

        }



        const product =

            products.find(function(item){

                return item.id === editingProductId;

            });


        if(product){

            product.sku = sku;

            product.name = name;

            product.category = category;

            product.price = price;

            product.stock = stock;

            product.cost = cost;

            product.status = status;

            product.updatedAt =
                new Date().toISOString();

        }

    }



    /* TAMBAH PRODUK BARU */

    else{


        const duplicateSKU =

            products.some(function(product){

                return (

                    product.sku.toLowerCase()

                    ===

                    sku.toLowerCase()

                );

            });


        if(duplicateSKU){

            alert(
                "SKU sudah terdaftar."
            );

            return;

        }



        products.push({

            id:
                "product_" +
                Date.now(),


            sku:sku,

            name:name,

            category:category,

            price:price,

            cost:cost,

            stock:stock,

            status:status,


            createdAt:
                new Date().toISOString(),


            updatedAt:
                new Date().toISOString()

        });

    }



    saveProductData();

    renderProducts();

    renderNotifications();

    closeProductModal();

}



/* =====================================================
   EDIT PRODUK
===================================================== */

function editProduct(id){

    const product =

        products.find(function(item){

            return item.id === id;

        });


    if(!product){

        return;

    }


    editingProductId = id;


    document.getElementById(
        "productModalTitle"
    ).innerText =

        "Edit Produk";


    document.getElementById(
        "productSKU"
    ).value = product.sku;


    document.getElementById(
        "productName"
    ).value = product.name;


    document.getElementById(
        "productCategory"
    ).value = product.category || "";


    document.getElementById(
        "productPrice"
    ).value = product.price || "";


    document.getElementById(
        "productCost"
    ).value = product.cost || "";

document.getElementById(
    "productStock"
).value =
    Number(product.stock) || 0;

    document.getElementById(
        "productStatus"
    ).value = product.status;


    document
        .getElementById("productModal")
        .classList
        .add("show");

}



/* =====================================================
   AKTIF / NONAKTIF PRODUK
===================================================== */

function toggleProduct(id){

    const product =

        products.find(function(item){

            return item.id === id;

        });


    if(!product){

        return;

    }


    product.status =

        product.status === "active"

        ? "inactive"

        : "active";


    product.updatedAt =
        new Date().toISOString();


    saveProductData();

    renderProducts();

    renderNotifications();

}



/* =====================================================
   PILIH & HAPUS BEBERAPA PRODUK SEKALIGUS
===================================================== */

function getSelectedProductIds(){

    return Array.from(
        document.querySelectorAll(
            ".product-row-checkbox:checked"
        )
    ).map(function(checkbox){

        return checkbox.value;

    });

}


function updateSelectedProductUI(){

    const selectedIds = getSelectedProductIds();

    const deleteButton =
        document.getElementById(
            "deleteSelectedProductsButton"
        );

    const selectedCount =
        document.getElementById(
            "selectedProductCount"
        );

    if(selectedCount){

        selectedCount.innerText =
            selectedIds.length;

    }

    if(deleteButton){

        deleteButton.style.display =
            selectedIds.length > 0
            ? "inline-block"
            : "none";

    }

    const selectAll =
        document.getElementById(
            "selectAllProducts"
        );

    const rowCheckboxes =
        document.querySelectorAll(
            ".product-row-checkbox"
        );

    if(selectAll){

        selectAll.checked =
            rowCheckboxes.length > 0 &&
            selectedIds.length === rowCheckboxes.length;

    }

}


function toggleSelectAllProducts(checkbox){

    document
        .querySelectorAll(
            ".product-row-checkbox"
        )
        .forEach(function(rowCheckbox){

            rowCheckbox.checked =
                checkbox.checked;

        });

    updateSelectedProductUI();

}


function deleteSelectedProducts(){

    const selectedIds = getSelectedProductIds();

    if(selectedIds.length === 0){

        return;

    }

    const confirmation = confirm(
        "Hapus " +
        selectedIds.length +
        " produk yang dipilih?\n\n" +
        "Data yang dihapus tidak dapat dikembalikan."
    );

    if(!confirmation){

        return;

    }

    products = products.filter(function(product){

        return !selectedIds.includes(
            product.id
        );

    });

    saveProductData();
    renderProducts();
    renderNotifications();

}


/* =====================================================
   HAPUS PRODUK
===================================================== */

function deleteProduct(id){

    const product =

        products.find(function(item){

            return item.id === id;

        });


    if(!product){

        return;

    }


    const confirmation = confirm(

        'Hapus produk "' +

        product.name +

        '"?'

    );


    if(!confirmation){

        return;

    }


    products =

        products.filter(function(item){

            return item.id !== id;

        });


    saveProductData();

    renderProducts();

    renderNotifications();

}



/* =====================================================
   IMPORT EXCEL
===================================================== */

function importProducts(input){

    const file = input.files[0];


    if(!file){

        return;

    }


    if(typeof XLSX === "undefined"){

        alert(

            "Library Excel belum dimuat. " +
            "Pastikan SheetJS sudah ditambahkan."

        );

        return;

    }


    const reader = new FileReader();


    reader.onload = function(event){


        try{


            const workbook = XLSX.read(

                event.target.result,

                {

                    type:"array"

                }

            );


            const firstSheet =

                workbook.Sheets[
                    workbook.SheetNames[0]
                ];


            const excelData =

                XLSX.utils.sheet_to_json(

                    firstSheet,

                    {

                        defval:""

                    }

                );



            if(excelData.length === 0){

                alert(
                    "File Excel tidak memiliki data."
                );

                return;

            }



            let successCount = 0;

            let duplicateCount = 0;

            let errorCount = 0;



            excelData.forEach(function(row){


                /*
                   MENERIMA BEBERAPA NAMA KOLOM
                */

                const sku = String(

                    row["SKU"]

                    ||

                    row["sku"]

                    ||

                    ""

                ).trim();



                const name = String(

                    row["Nama Produk"]

                    ||

                    row["NAMA PRODUK"]

                    ||

                    row["Nama"]

                    ||

                    row["nama"]

                    ||

                    ""

                ).trim();



                const category = String(

                    row["Kategori"]

                    ||

                    row["KATEGORI"]

                    ||

                    ""

                ).trim();



 /* =====================================================
   PARSE HARGA EXCEL
   Menjaga harga marketplace seperti:
   26,999
   13,999
   7,999
   agar tidak berubah menjadi 27 / 14 / 8
===================================================== */

function parseExcelPrice(value){

    if(value === null || value === undefined || value === ""){
        return 0;
    }

    /* Jika Excel sudah membaca sebagai number */
    if(typeof value === "number"){

        /*
           Excel bisa membaca 26,999 sebagai
           angka 26.999.

           Untuk harga marketplace Indonesia,
           bagian desimal 999 dianggap pemisah
           ribuan.
        */

        const decimalPart =
            value.toString().split(".")[1];

        if(decimalPart && decimalPart.length === 3){

            return Math.round(value * 1000);
        }

        return value;
    }

    /* Jika Excel membaca sebagai text */
    let text = String(value).trim();

    /* Hilangkan Rp dan spasi */
    text = text
        .replace(/Rp/gi, "")
        .replace(/\s/g, "");

    /*
       Format:
       26,999
       13,999
       7,999

       dianggap sebagai harga ribuan.
    */
    if(/^\d+,\d{3}$/.test(text)){

        return Number(
            text.replace(",", "")
        );
    }

    /*
       Format:
       26.999
       13.999
       7.999
    */
    if(/^\d+\.\d{3}$/.test(text)){

        return Number(
            text.replace(".", "")
        );
    }

    /*
       Format angka biasa
       contoh:
       25000
       5000
    */
    text = text.replace(/,/g, "");

    const result = Number(text);

    return Number.isFinite(result)
        ? result
        : 0;
}


/* HARGA JUAL */

const price = parseExcelPrice(
    row["Harga Jual"]
    ||
    row["HARGA JUAL"]
    ||
    row["Harga"]
    ||
    0
);


/* HPP / MODAL */

const cost = parseExcelPrice(
    row["HPP"]
    ||
    row["Modal"]
    ||
    row["HPP / Modal"]
    ||
    row["HPP/MODAL"]
    ||
    0
);


const stock = Math.max(
    0,
    Number(
        row["Stok"]
        ||
        row["STOK"]
        ||
        row["Stock"]
        ||
        0
    )
);

                const importedStatus = String(

                    row["Status Produk"]

                    ||

                    row["STATUS PRODUK"]

                    ||

                    row["Status"]

                    ||

                    "Aktif"

                ).toLowerCase();



                const status =

                    importedStatus === "tidak aktif"

                    ||

                    importedStatus === "inactive"

                    ||

                    importedStatus === "nonaktif"

                    ||

                    importedStatus === "non-active"

                    ? "inactive"

                    : "active";



                /*
                   VALIDASI DATA
                */

                if(!sku || !name){

                    errorCount++;

                    return;

                }



                /*
                   CEK SKU GANDA
                */

                const existingProduct =

                    products.find(function(product){

                        return (

                            product.sku.toLowerCase()

                            ===

                            sku.toLowerCase()

                        );

                    });



                /*
                   JIKA SUDAH ADA:
                   JANGAN BUAT DUPLIKAT
                */

                if(existingProduct){

                    duplicateCount++;

                    return;

                }



                /*
                   SIMPAN PRODUK
                */

                products.push({

                    id:
                        "product_" +
                        Date.now() +
                        "_" +
                        Math.random()
                        .toString(36)
                        .substring(2,7),


                    sku:sku,

                    name:name,

                    category:category,

                    price:price,

                    cost:cost,
           
                    stock:stock,

                    status:status,


                    createdAt:
                        new Date().toISOString(),


                    updatedAt:
                        new Date().toISOString()

                });


                successCount++;

            });



            saveProductData();

            renderProducts();

            renderNotifications();

            alert(

                "Import selesai.\n\n" +

                "Berhasil: " +
                successCount +

                "\nDuplikat SKU: " +
                duplicateCount +

                "\nData tidak valid: " +
                errorCount

            );


        }

        catch(error){


            console.error(error);


            alert(

                "Terjadi kesalahan saat membaca file Excel."

            );

        }


        /*
           RESET INPUT
        */

        input.value = "";

    };


    reader.readAsArrayBuffer(file);

}



/* =====================================================
   EXPORT EXCEL MASTER PRODUK SELLERBOOKS
   DENGAN DROPDOWN STATUS
===================================================== */

async function exportProducts(){

    /* CEK LIBRARY EXCEL */
    if(typeof ExcelJS === "undefined"){

        alert(
            "Library Excel belum dimuat."
        );

        return;
    }


    /* =================================================
       BUAT WORKBOOK
    ================================================= */

    const workbook =
        new ExcelJS.Workbook();


    /* =================================================
       SHEET 1
       MASTER PRODUK
    ================================================= */

    const worksheet =
        workbook.addWorksheet(
            "MASTER PRODUK"
        );


    /* =================================================
       HEADER
    ================================================= */

    worksheet.addRow([
        "SKU",
        "Nama Produk",
        "Kategori",
        "Harga Jual",
        "HPP / Modal",
        "Stok",
        "Status Produk"
    ]);


    /* =================================================
       DATA PRODUK
    ================================================= */

    if(
        Array.isArray(products) &&
        products.length > 0
    ){

        products.forEach(function(product){

            worksheet.addRow([
                product.sku || "",
                product.name || "",
                product.category || "",
                Number(product.price) || 0,
                Number(product.cost) || 0,
                Number(product.stock) || 0,

                product.status === "active"
                    ? "Aktif"
                    : "Tidak Aktif"
            ]);

        });

    }

    else{

        /* CONTOH DATA */

        worksheet.addRow([
            "CONTOH-SKU-001",
            "Contoh Nama Produk",
            "Contoh Kategori",
            10000,
            5000,
            0,
            "Aktif"
        ]);

    }


    /* =================================================
       STYLE HEADER
    ================================================= */

    const headerRow =
        worksheet.getRow(1);

    headerRow.font = {
        bold:true
    };


    /* =================================================
       LEBAR KOLOM
    ================================================= */

    worksheet.getColumn(1).width = 22;
    worksheet.getColumn(2).width = 35;
    worksheet.getColumn(3).width = 22;
    worksheet.getColumn(4).width = 18;
    worksheet.getColumn(5).width = 18;
    worksheet.getColumn(6).width = 15;
    worksheet.getColumn(7).width = 20;


    /* =================================================
       FORMAT ANGKA
    ================================================= */

    worksheet
        .getColumn(4)
        .numFmt = '#,##0';

    worksheet
        .getColumn(5)
        .numFmt = '#,##0';

    worksheet
        .getColumn(6)
        .numFmt = '#,##0';


    /* =================================================
       DROPDOWN STATUS PRODUK
       AKTIF / TIDAK AKTIF
    ================================================= */

    for(
        let row = 2;
        row <= 1000;
        row++
    ){

        worksheet
            .getCell(row, 7)
            .dataValidation = {

                type:"list",

                allowBlank:true,

                formulae:[
                    '"Aktif,Tidak Aktif"'
                ],

                showErrorMessage:true,

                errorTitle:
                    "Status tidak valid",

                error:
                    "Silakan pilih Aktif atau Tidak Aktif.",

                showInputMessage:true,

                promptTitle:
                    "Status Produk",

                prompt:
                    "Pilih Aktif atau Tidak Aktif."
            };

    }


    /* =================================================
       SHEET 2
       PETUNJUK PENGISIAN
    ================================================= */

    const instructionSheet =
        workbook.addWorksheet(
            "PETUNJUK PENGISIAN"
        );


    instructionSheet.addRow([
        "KOLOM",
        "PETUNJUK PENGISIAN"
    ]);


    instructionSheet.addRow([
        "SKU",
        "Wajib diisi. SKU adalah kode unik produk dan tidak boleh sama dengan produk lain."
    ]);


    instructionSheet.addRow([
        "Nama Produk",
        "Wajib diisi. Masukkan nama produk dengan jelas."
    ]);


    instructionSheet.addRow([
        "Kategori",
        "Opsional. Contoh: Fashion, Elektronik, Aksesoris, Rumah Tangga."
    ]);


    instructionSheet.addRow([
        "Harga Jual",
        "Isi angka saja tanpa tulisan Rp atau tanda titik. Contoh: 25000"
    ]);


    instructionSheet.addRow([
        "HPP / Modal",
        "Isi angka biaya modal produk tanpa tulisan Rp. Contoh: 12000"
    ]);


    instructionSheet.addRow([
        "Stok",
        "Isi jumlah stok awal produk dalam angka. Contoh: 100."
    ]);


    instructionSheet.addRow([
        "Status Produk",
        "Pilih dari dropdown: Aktif atau Tidak Aktif."
    ]);


    instructionSheet.addRow([]);


    instructionSheet.addRow([
        "ATURAN IMPORT",
        ""
    ]);


    instructionSheet.addRow([
        "1",
        "Jangan mengubah nama kolom pada sheet MASTER PRODUK."
    ]);


    instructionSheet.addRow([
        "2",
        "SKU tidak boleh kosong dan tidak boleh duplikat."
    ]);


    instructionSheet.addRow([
        "3",
        "Harga Jual dan HPP / Modal harus berupa angka."
    ]);


    instructionSheet.addRow([
        "4",
        "Stok harus berupa angka. Jika belum memiliki stok, isi 0."
    ]);


    instructionSheet.addRow([
        "5",
        "Status Produk cukup dipilih dari dropdown Aktif atau Tidak Aktif."
    ]);


    instructionSheet.addRow([
        "6",
        "Isi data hanya pada sheet MASTER PRODUK."
    ]);


    instructionSheet.getColumn(1).width = 25;
    instructionSheet.getColumn(2).width = 90;


    /* =================================================
       SHEET 3
       README
    ================================================= */

    const readmeSheet =
        workbook.addWorksheet(
            "README"
        );


    readmeSheet.addRow([
        "SELLERBOOKS MASTER PRODUK TEMPLATE"
    ]);


    readmeSheet.addRow([]);


    readmeSheet.addRow([
        "File ini digunakan untuk menambah atau memperbarui data Master Produk di SellerBooks."
    ]);


    readmeSheet.addRow([]);


    readmeSheet.addRow([
        "CARA PENGGUNAAN"
    ]);


    readmeSheet.addRow([
        "1. Buka sheet MASTER PRODUK."
    ]);


    readmeSheet.addRow([
        "2. Isi data produk sesuai kolom yang tersedia."
    ]);


    readmeSheet.addRow([
        "3. Jangan mengubah nama header atau urutan kolom."
    ]);


    readmeSheet.addRow([
        "4. Isi stok dengan angka. Jika belum ada stok, gunakan 0."
    ]);


    readmeSheet.addRow([
        "5. Untuk Status Produk, pilih Aktif atau Tidak Aktif dari dropdown."
    ]);


    readmeSheet.addRow([
        "6. Simpan file setelah selesai diisi."
    ]);


    readmeSheet.addRow([
        "7. Kembali ke SellerBooks."
    ]);


    readmeSheet.addRow([
        "8. Buka menu Master Produk."
    ]);


    readmeSheet.addRow([
        "9. Klik Import Excel."
    ]);


    readmeSheet.addRow([
        "10. Pilih file yang sudah diisi."
    ]);


    readmeSheet.addRow([]);


    readmeSheet.addRow([
        "CATATAN PENTING"
    ]);


    readmeSheet.addRow([
        "• SKU harus unik."
    ]);


    readmeSheet.addRow([
        "• Harga diisi dalam angka."
    ]);


    readmeSheet.addRow([
        "• Stok diisi dalam angka."
    ]);


    readmeSheet.addRow([
        "• Status Produk menggunakan dropdown Aktif atau Tidak Aktif."
    ]);


    readmeSheet.getColumn(1).width = 100;


    /* =================================================
       DOWNLOAD FILE
    ================================================= */

    const buffer =
        await workbook.xlsx.writeBuffer();


    const blob =
        new Blob(
            [
                buffer
            ],
            {
                type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        "MASTER_PRODUK_SELLERBOOKS.xlsx";


    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);


    URL.revokeObjectURL(url);

}
/* =====================================================
   SELLERBOOKS SALES IMPORT ENGINE
===================================================== */


/*
========================================================
FILE IMPORT SEMENTARA
========================================================
*/

let currentSalesImport = null;



/*
========================================================
DAFTAR KATA SKU
========================================================
*/

const SKU_KEYWORDS = [

    "nomor referensi sku",

    "seller sku",

    "product sku",

    "merchant sku",

    "sku produk",

    "kode produk",

    "kode barang",

    "item sku",

    "product code",

    "seller_sku",

    "product_sku"

];



/*
========================================================
DAFTAR KATA QTY
========================================================
*/

const QTY_KEYWORDS = [

    "qty",

    "quantity",

    "jumlah",

    "jumlah produk",

    "kuantitas",

    "jumlah pesanan",

    "qty pesanan",

    "quantity ordered",

    "product quantity",
    
    "total barang",

    "item quantity"

];



/* =====================================================
   MARKETPLACE FILE FINGERPRINT + PACKING ENGINE
===================================================== */
const SALES_MARKETPLACE_RULES={
    Shopee:{
        required:["no. pesanan","nomor referensi sku","jumlah"],
        packingAliases:["no. pesanan","no. resi"],
        orderAliases:["no. pesanan"],
        priceAliases:["harga setelah diskon","subtotal"],
        dateAliases:["waktu pesanan dibuat"]
    },

    TikTok:{
        required:["order id","seller sku","quantity"],
        packingAliases:["order id","tracking id"],
        orderAliases:["order id"],
        priceAliases:["sku subtotal after discount","sku unit original price"],
        dateAliases:["created time"]
    },

    Blibli:{
        required:["no. order","merchant sku","total barang"],
        packingAliases:["no. order","no. awb"],
        orderAliases:["no. order"],
        priceAliases:["harga produk","total harga produk"],
        dateAliases:["tanggal order"]
    },

    Toco:{
        required:["invoice number","sku","jumlah produk"],
        packingAliases:["no. resi pesanan"],
        orderAliases:["invoice number"],
        priceAliases:["harga setelah diskon","total harga produk"],
        dateAliases:["waktu pesanan dibuat"]
    },

    Lazada:{
        required:["orderitemid","seller sku","ordernumber"],
        packingAliases:["orderitemid","trackingcode"],
        orderAliases:["ordernumber"],
        priceAliases:["paidprice","unitprice","itemprice"],
        dateAliases:["ordercreatedat","createdat","order date"]
    },

    Tokopedia:{
        required:["nomor invoice","nomor sku","jumlah produk dibeli"],
        packingAliases:["no resi / kode booking"],
        orderAliases:["nomor invoice"],
        priceAliases:["harga produk","harga"],
        dateAliases:["tanggal pembayaran"]
    }
};
function findAliasColumn(headers,aliases){const r=findBestColumn(headers,aliases||[]);return r&&r.column?r.column:null;}
function detectSalesMarketplace(headers,fileName){const h=headers.map(normalizeHeader);let best=null,scoreBest=0;Object.keys(SALES_MARKETPLACE_RULES).forEach(function(name){const rule=SALES_MARKETPLACE_RULES[name];let score=0;rule.required.forEach(function(k){if(h.indexOf(normalizeHeader(k))>=0)score+=3;});if(name==="Lazada"&&h.indexOf("lazadaid")>=0)score+=4;if(name==="TikTok"&&h.indexOf("tracking id")>=0)score+=2;if(name==="Shopee"&&h.indexOf("no. pesanan")>=0)score+=4;if(name==="Tokopedia"&&h.indexOf("nomor invoice")>=0)score+=4;if(name==="Blibli"&&h.indexOf("no. order")>=0)score+=4;if(name==="Toco"&&h.indexOf("invoice number")>=0)score+=4;if(score>scoreBest){scoreBest=score;best=name;}});if(!best){const n=String(fileName||"").toLowerCase();["Shopee","TikTok","Blibli","Toco","Lazada","Tokopedia"].some(function(x){if(n.includes(x.toLowerCase())){best=x;return true;}return false;});}return {marketplace:best,score:scoreBest};}
function getPackingColumn(data){const rule=SALES_MARKETPLACE_RULES[data.marketplace];if(!rule)return null;for(let i=0;i<rule.packingAliases.length;i++){const c=findAliasColumn(data.headers,[rule.packingAliases[i]]);if(c)return c;}return null;}
function getFirstValue(row,headers,aliases){const c=findAliasColumn(headers,aliases);if(!c)return "";const i=headers.indexOf(c);return i>=0?row[i]:"";}
/* =====================================================
   HELPER LAPORAN PENJUALAN
===================================================== */

function parseSalesNumber(value){

    if(value === null || value === undefined){
        return 0;
    }

    if(typeof value === "number"){
        return Number.isFinite(value) ? value : 0;
    }

    let text = String(value)
        .trim()
        .replace(/Rp/gi,"")
        .replace(/\s/g,"");

    if(!text){
        return 0;
    }

    /*
       FORMAT INDONESIA
       50.000
       50.000,50
    */
    if(text.includes(",") && text.includes(".")){
        text = text
            .replace(/\./g,"")
            .replace(",",".");
    }

    /*
       50.000
       Jika tidak ada desimal koma,
       anggap titik sebagai pemisah ribuan.
    */
    else if(text.includes(".")){
        text = text.replace(/\./g,"");
    }

    else if(text.includes(",")){
        text = text.replace(",",".");
    }

    const number = Number(text);

    return Number.isFinite(number) ? number : 0;
}


function parseSalesDate(value){

    if(!value){
        return null;
    }

    if(value instanceof Date){
        return isNaN(value.getTime())
            ? null
            : value.toISOString();
    }

    /*
       Excel serial date
    */
    if(typeof value === "number"){

        const excelDate =
            new Date(
                Date.UTC(
                    1899,
                    11,
                    30
                ) +
                value * 86400000
            );

        if(!isNaN(excelDate.getTime())){
            return excelDate.toISOString();
        }
    }

    const text = String(value).trim();

    if(!text){
        return null;
    }

    const date = new Date(text);

    if(!isNaN(date.getTime())){
        return date.toISOString();
    }

    /*
       DD/MM/YYYY HH:mm:ss
    */
    const match =
        text.match(
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/
        );

    if(match){

        const day =
            Number(match[1]);

        const month =
            Number(match[2]) - 1;

        const year =
            Number(match[3]);

        const result =
            new Date(
                year,
                month,
                day
            );

        if(!isNaN(result.getTime())){
            return result.toISOString();
        }
    }

    return null;
}


/* =========================================================
   HARGA PENJUALAN WAJIB DARI MASTER PRODUK
   FILE MARKETPLACE HANYA MENYUMBANG SKU + QTY
========================================================= */

function getMasterProductBySku(sku){

    const normalizedSku =
        String(sku || "")
            .trim()
            .toLowerCase();

    if(!normalizedSku){
        return null;
    }

    let masterProducts = [];

    try{

        masterProducts =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_products"
                ) || "[]"
            );

    }catch(error){

        masterProducts = [];

    }

    if(!Array.isArray(masterProducts)){
        return null;
    }

    return masterProducts.find(function(product){

        return String(
            product.sku || ""
        )
        .trim()
        .toLowerCase() === normalizedSku;

    }) || null;

}


/* =========================================================
   STOK OTOMATIS DARI IMPORT PENJUALAN
   Setiap QTY transaksi yang berhasil di-import akan
   mengurangi stok Master Produk berdasarkan SKU.
   SKU yang tidak ada di Master Produk tidak mengurangi stok.
========================================================= */
function reduceProductStockFromImport(record){

    if(!record || record.stockDeducted){
        return {
            changed:0,
            totalQty:0,
            missingSkus:[],
            details:[]
        };
    }

    /*
       SELALU AMBIL DATA MASTER PRODUK TERBARU DARI
       localStorage agar stok yang dipakai benar-benar
       stok terakhir, bukan salinan lama di memory.
    */
    try{
        const latestProducts = JSON.parse(
            localStorage.getItem("sellerbooks_products") || "[]"
        );
        if(Array.isArray(latestProducts)){
            products = latestProducts;
        }
    }catch(error){}

    const transactions =
        Array.isArray(record.transactions)
            ? record.transactions
            : [];

    const qtyBySku = new Map();

    transactions.forEach(function(item){

        const sku =
            String(item && item.sku || '')
                .trim()
                .toLowerCase();

        const qty =
            Number(item && item.qty) || 0;

        if(!sku || qty <= 0){
            return;
        }

        qtyBySku.set(
            sku,
            (qtyBySku.get(sku) || 0) + qty
        );
    });

    let changed = 0;
    let totalQty = 0;
    const missingSkus = [];
    const stockDetails = [];

    qtyBySku.forEach(function(qty, sku){

        const product =
            products.find(function(item){
                return String(item && item.sku || '')
                    .trim()
                    .toLowerCase() === sku;
            }) || null;

        if(!product){
            missingSkus.push(sku);
            return;
        }

        const oldStock =
            Math.max(0, Number(product.stock) || 0);

        /*
           Hanya jumlah yang benar-benar berhasil dipotong
           yang dicatat untuk refund. Ini penting jika QTY
           penjualan lebih besar dari stok sehingga stok
           berhenti di 0.
        */
        const deductedQty = Math.min(oldStock, qty);
        const newStock = Math.max(0, oldStock - qty);

        product.stock = newStock;
        product.updatedAt =
            new Date().toISOString();

        if(oldStock !== newStock){
            changed++;
        }

        totalQty += qty;

        stockDetails.push({
            productId: product.id || "",
            sku: product.sku || sku,
            soldQty: qty,
            deductedQty: deductedQty,
            stockBefore: oldStock,
            stockAfter: newStock
        });
    });

    if(qtyBySku.size > 0){
        saveProductData();
    }

    record.stockDeducted = true;
    record.stockDeductedAt =
        new Date().toISOString();
    record.stockDeductedQty = totalQty;
    record.stockDeductedProductCount = changed;
    record.stockMissingSku = missingSkus;
    record.stockDeductionDetails = stockDetails;

    return {
        changed:changed,
        totalQty:totalQty,
        missingSkus:missingSkus,
        details:stockDetails
    };

}

/* =========================================================
   KEMBALIKAN STOK SAAT LAPORAN DIHAPUS
   Hanya mengembalikan stok yang benar-benar dipotong
   oleh import yang sedang dihapus.
========================================================= */
function restoreProductStockFromDeletedImports(deletedImports){

    if(!Array.isArray(deletedImports) || deletedImports.length === 0){
        return { restoredQty:0, productCount:0 };
    }

    /* Ambil Master Produk TERBARU sebelum refund stok. */
    let latestProducts = [];
    try{
        latestProducts = JSON.parse(
            localStorage.getItem("sellerbooks_products") || "[]"
        );
    }catch(error){
        latestProducts = [];
    }

    if(!Array.isArray(latestProducts)){
        latestProducts = [];
    }

    products = latestProducts;

    const restoreByProduct = new Map();

    deletedImports.forEach(function(record){

        if(!record){
            return;
        }

        /*
           Import baru memiliki detail stok yang benar-benar
           dipotong. Gunakan ini agar refund tidak pernah
           mengembalikan stok lebih banyak dari yang dipotong.
        */
        if(Array.isArray(record.stockDeductionDetails)){

            record.stockDeductionDetails.forEach(function(detail){

                const deductedQty =
                    Math.max(0, Number(detail && detail.deductedQty) || 0);

                if(deductedQty <= 0){
                    return;
                }

                const key =
                    String(detail.productId || "sku:" + String(detail.sku || "").trim().toLowerCase());

                restoreByProduct.set(
                    key,
                    {
                        productId: detail.productId || "",
                        sku: detail.sku || "",
                        qty: (restoreByProduct.get(key)?.qty || 0) + deductedQty
                    }
                );
            });

            return;
        }

        /*
           Fallback untuk laporan lama yang dibuat sebelum detail
           stok tersedia. Jumlah QTY transaksi dikembalikan satu kali.
        */
        const transactions =
            Array.isArray(record.transactions)
                ? record.transactions
                : [];

        transactions.forEach(function(item){

            const sku =
                String(item && item.sku || "")
                    .trim()
                    .toLowerCase();

            const qty =
                Number(item && item.qty) || 0;

            if(!sku || qty <= 0){
                return;
            }

            const key = "sku:" + sku;
            const existing = restoreByProduct.get(key);

            restoreByProduct.set(
                key,
                {
                    productId: existing?.productId || "",
                    sku: sku,
                    qty: (existing?.qty || 0) + qty
                }
            );
        });
    });

    let restoredQty = 0;
    let productCount = 0;

    restoreByProduct.forEach(function(info){

        const product =
            products.find(function(item){
                const sameId =
                    info.productId &&
                    String(item && item.id || "") === String(info.productId);

                const sameSku =
                    String(item && item.sku || "")
                        .trim()
                        .toLowerCase() === String(info.sku || "")
                        .trim()
                        .toLowerCase();

                return sameId || sameSku;
            }) || null;

        if(!product){
            return;
        }

        const oldStock =
            Math.max(0, Number(product.stock) || 0);

        const restoreQty =
            Math.max(0, Number(info.qty) || 0);

        if(restoreQty <= 0){
            return;
        }

        product.stock = oldStock + restoreQty;
        product.updatedAt =
            new Date().toISOString();

        restoredQty += restoreQty;
        productCount++;
    });

    if(restoreByProduct.size > 0){
        saveProductData();
    }

    return {
        restoredQty:restoredQty,
        productCount:productCount
    };
}

function getReportTransactionSalesAmount(item){

    const product =
        getMasterProductBySku(
            item && item.sku
        );

    if(!product){
        return 0;
    }

    const qty =
        Number(
            item && item.qty
        ) || 0;

    const price =
        Number(
            product.price
        ) || 0;

    return price * qty;

}


function getSalesAmount(row,data){

    const skuIndex =
        data.skuIndex != null
            ? data.skuIndex
            : data.headers.indexOf(
                data.skuColumn
            );

    const qtyIndex =
        data.qtyIndex != null
            ? data.qtyIndex
            : data.headers.indexOf(
                data.qtyColumn
            );

    const sku =
        skuIndex >= 0
            ? String(
                row[skuIndex] || ""
            ).trim()
            : "";

    const qty =
        qtyIndex >= 0
            ? parseSalesNumber(
                row[qtyIndex]
            )
            : 0;

    const product =
        getMasterProductBySku(sku);

    /*
       SKU tidak ditemukan:
       transaksi tetap diimport,
       harga = Rp0,
       HPP = Rp0,
       dan masuk daftar peringatan.
    */
    if(!product){
        return 0;
    }

    const masterPrice =
        Number(
            product.price
        ) || 0;

    return masterPrice * qty;
}


function getSalesTransactionDate(row,data){

    const rule =
        SALES_MARKETPLACE_RULES[
            data.marketplace
        ];

    if(!rule){
        return null;
    }

    const value =
        getFirstValue(
            row,
            data.headers,
            rule.dateAliases || []
        );

    return parseSalesDate(value);
}
function getCleanSalesRows(data){if(!data)return [];const si=data.skuIndex!=null?data.skuIndex:data.headers.indexOf(data.skuColumn),qi=data.qtyIndex!=null?data.qtyIndex:data.headers.indexOf(data.qtyColumn);return data.dataRows.filter(function(row){const sku=String(row[si]||"").trim().toLowerCase(),qty=String(row[qi]||"").trim().toLowerCase();return sku!=="seller sku input by the seller in the product system."&&qty!=="sku sold quantity in the order."&&(sku||qty);});}
function calculateUniquePacking(data){const c=getPackingColumn(data),i=c?data.headers.indexOf(c):-1,u=new Set();getCleanSalesRows(data).forEach(function(row){if(i>=0){const v=String(row[i]||"").trim();if(v)u.add(v);}});return {column:c,count:u.size,identifiers:Array.from(u)};}
function populateSalesStoreAccounts(){

    const select =
        document.getElementById(
            "salesStoreAccount"
        );

    const info =
        document.getElementById(
            "salesStoreAccountInfo"
        );

    if(
        !select ||
        !currentSalesImport
    ){
        return;
    }


    /* =========================================
       RESET DROPDOWN
    ========================================= */

    select.innerHTML =
        '<option value="">-- Pilih Akun Toko --</option>';


    /* =========================================
       AMBIL MARKETPLACE TERDETEKSI
    ========================================= */

    const detectedMarketplace =
        String(
            currentSalesImport.marketplace || ""
        )
        .trim()
        .toLowerCase();


    /*
       DETEKSI MENGGUNAKAN NAMA SINGKAT,
       SEDANGKAN DATABASE MARKETPLACE
       BISA MENGGUNAKAN NAMA LENGKAP.
    */

    const marketplaceAlias = {

        "shopee":
            "shopee",

        "tiktok":
            "tiktok",

        "tiktok shop":
            "tiktok",

        "tokopedia":
            "tokopedia",

        "lazada":
            "lazada",

        "blibli":
            "blibli",

        "toco":
            "toco"

    };


    const normalizedMarketplace =
        marketplaceAlias[
            detectedMarketplace
        ] || detectedMarketplace;


    /* =========================================
       CARI MARKETPLACE BERDASARKAN ID / NAMA
    ========================================= */

    const mp =
        marketplaces.find(function(item){

            const itemId =
                String(
                    item.id || ""
                )
                .trim()
                .toLowerCase();

            const itemName =
                String(
                    item.name || ""
                )
                .trim()
                .toLowerCase();


            return (

                itemId ===
                normalizedMarketplace

                ||

                itemName ===
                detectedMarketplace

                ||

                (
                    normalizedMarketplace === "tiktok" &&
                    (
                        itemId === "tiktok" ||
                        itemName === "tiktok shop"
                    )
                )

            );

        });


    /* =========================================
       SIMPAN MARKETPLACE ID
    ========================================= */

    currentSalesImport.marketplaceId =
        mp
        ? mp.id
        : null;


    /* =========================================
       JIKA MARKETPLACE TIDAK DITEMUKAN
    ========================================= */

    if(
        !currentSalesImport.marketplaceId
    ){

        if(info){

            info.innerText =
                "Marketplace tidak ditemukan di database.";

            info.style.color =
                "#dc2626";

        }

        return;
    }


    /* =========================================
       CARI AKUN TOKO
       SESUAI MARKETPLACE
    ========================================= */

    const list =
        stores.filter(function(store){

            return (

                store.status === "active"

                &&

                String(
                    store.marketplaceId
                ) ===
                String(
                    currentSalesImport.marketplaceId
                )

            );

        });


    /* =========================================
       MASUKKAN AKUN TOKO KE DROPDOWN
    ========================================= */

    list.forEach(function(store){

        const option =
            document.createElement(
                "option"
            );

        option.value =
            store.id;

        option.textContent =
            store.name +
            (
                store.code
                ? " • " + store.code
                : ""
            );

        select.appendChild(
            option
        );

    });


    /* =========================================
       INFO AKUN TOKO
    ========================================= */

    if(info){

        if(list.length){

            info.innerText =
                list.length +
                " akun toko aktif tersedia.";

            info.style.color =
                "";

        }else{

            info.innerText =
                "Belum ada akun toko aktif untuk marketplace ini.";

            info.style.color =
                "#dc2626";

        }

    }

}
function updatePackingCalculation(){if(!currentSalesImport)return;const r=calculateUniquePacking(currentSalesImport),unit=Math.max(0,Number(document.getElementById("packingCostPerOrder")?.value)||0);const c=document.getElementById("uniquePackingCount"),t=document.getElementById("totalPackingImportCost"),i=document.getElementById("packingIdentifierInfo");if(c)c.innerText=r.count.toLocaleString("id-ID");if(t)t.innerText=formatRupiah(r.count*unit);if(i)i.innerText=r.column?"Identitas packing: "+r.column+" • 1 packing dihitung 1 ID unik.":"Identitas packing belum ditemukan pada file.";}
function saveSalesImportData(){

    if(!currentSalesImport){
        return null;
    }

    const storeId =
        document.getElementById(
            "salesStoreAccount"
        ).value;

    const store =
        stores.find(function(x){
            return String(x.id) ===
                String(storeId);
        });

    const packing =
        calculateUniquePacking(
            currentSalesImport
        );

    const packingInput =
        document.getElementById(
            "packingCostPerOrder"
        );

    const packingUnit =
        Math.max(
            0,
            Number(
                packingInput?.value
            ) || 0
        );

    const rows =
        getCleanSalesRows(
            currentSalesImport
        );

    const skuIndex =
        currentSalesImport.headers.indexOf(
            currentSalesImport.skuColumn
        );

    const qtyIndex =
        currentSalesImport.headers.indexOf(
            currentSalesImport.qtyColumn
        );

    const rule =
        SALES_MARKETPLACE_RULES[
            currentSalesImport.marketplace
        ];

    const packingIndex =
        packing.column
            ? currentSalesImport.headers.indexOf(
                packing.column
            )
            : -1;

    /* =====================================================
       TANGGAL LAPORAN PERMANEN
       Seluruh transaksi dari 1 kali import memakai
       tanggal saat tombol import/simpan dijalankan.
       Tanggal dari file marketplace TIDAK dipakai
       untuk filter periode laporan.
    ===================================================== */
    const reportDate =
        new Date().toISOString();

    const transactions =
        rows.map(function(row){

            const qty =
                qtyIndex >= 0
                    ? parseSalesNumber(
                        row[qtyIndex]
                    )
                    : 0;

            const salesAmount =
                getSalesAmount(
                    row,
                    currentSalesImport
                );

            const transactionDate =
                getSalesTransactionDate(
                    row,
                    currentSalesImport
                );

            return {

                marketplace:
                    currentSalesImport.marketplace,

                marketplaceId:
                    currentSalesImport.marketplaceId,

                storeId:
                    storeId,

                storeName:
                    store
                        ? store.name
                        : "",

                sku:
                    skuIndex >= 0
                        ? String(
                            row[skuIndex] || ""
                        ).trim()
                        : "",

                qty:
                    qty,

                salesAmount:
                    salesAmount,

                orderId:
                    rule
                        ? getFirstValue(
                            row,
                            currentSalesImport.headers,
                            rule.orderAliases
                        )
                        : "",

                packingId:
                    packingIndex >= 0
                        ? String(
                            row[packingIndex] || ""
                        ).trim()
                        : "",

                transactionDate:
                    transactionDate,

                /* tanggal laporan = waktu import, permanen */
                reportDate:
                    reportDate,

                importedAt:
                    reportDate
            };

        });


    const imports =
        JSON.parse(
            localStorage.getItem(
                "sellerbooks_sales_imports"
            ) || "[]"
        );


    const totalSales =
        transactions.reduce(
            function(total,item){

                return total +
                    getReportTransactionSalesAmount(item);

            },
            0
        );


    const totalQty =
        transactions.reduce(
            function(total,item){

                return total +
                    Number(
                        item.qty
                    ) || 0;

            },
            0
        );


    const record = {

        id:
            "sales_import_" +
            Date.now(),

        fileName:
            currentSalesImport.fileName,

        fileType:
            currentSalesImport.fileType,

        marketplace:
            currentSalesImport.marketplace,

        marketplaceId:
            currentSalesImport.marketplaceId,

        storeId:
            storeId,

        storeName:
            store
                ? store.name
                : "",

        skuColumn:
            currentSalesImport.skuColumn,

        qtyColumn:
            currentSalesImport.qtyColumn,

        packingColumn:
            packing.column,

        uniquePackingCount:
            packing.count,

        packingCostPerOrder:
            packingUnit,

        totalPackingCost:
            packing.count *
            packingUnit,

        rowCount:
            transactions.length,

        totalSales:
            totalSales,

        totalQty:
            totalQty,

        /* tanggal laporan permanen untuk seluruh file import */
        reportDate:
            reportDate,

        importedAt:
            reportDate,

        transactions:
            transactions
    };


    /* =====================================================
       STOK OTOMATIS
       Setelah transaksi siap disimpan, QTY penjualan
       langsung mengurangi stok Master Produk.
    ===================================================== */
    const stockResult =
        reduceProductStockFromImport(record);

    record.stockDeductedQty =
        stockResult.totalQty;

    imports.push(record);


    localStorage.setItem(
        "sellerbooks_sales_imports",
        JSON.stringify(imports)
    );


    localStorage.setItem(
        "sellerbooks_packing_unit_cost",
        String(packingUnit)
    );


    return record;
}
/*
========================================================
NORMALISASI HEADER
========================================================
*/

function normalizeHeader(value){

    return String(value || "")

        .toLowerCase()

        .trim()

        .replace(/[_\-]+/g," ")

        .replace(/\s+/g," ");

}



/*
========================================================
CARI KOLOM TERBAIK
========================================================
*/

function findBestColumn(headers,keywords){

    let bestMatch = null;

    let bestScore = 0;


    headers.forEach(function(header){


        const normalizedHeader =

            normalizeHeader(header);



        keywords.forEach(function(keyword){


            const normalizedKeyword =

                normalizeHeader(keyword);



            let score = 0;



            /*
            EXACT MATCH
            */

            if(

                normalizedHeader ===
                normalizedKeyword

            ){

                score = 100;

            }



            /*
            HEADER MENGANDUNG KEYWORD
            */

            else if(

                normalizedHeader.includes(
                    normalizedKeyword
                )

            ){

                score = 80;

            }



            /*
            KEYWORD MENGANDUNG HEADER
            */

            else if(

                normalizedKeyword.includes(
                    normalizedHeader
                )

            ){

                score = 60;

            }



            if(score > bestScore){

                bestScore = score;

                bestMatch = header;

            }


        });


    });



    return {

        column:bestMatch,

        score:bestScore

    };

}



/*
========================================================
ANALYZE FILE
========================================================
*/

function analyzeSalesFile(input){


    const file = input.files[0];


    if(!file){

        return;

    }



    /*
    VALIDASI FORMAT
    */

    const fileName =

        file.name.toLowerCase();



    const supportedFormats = [

        ".xlsx",

        ".xls",

        ".csv"

    ];



    const validFormat =

        supportedFormats.some(function(format){

            return fileName.endsWith(format);

        });



    if(!validFormat){


        alert(

            "Format file tidak didukung.\n\n" +

            "Gunakan:\n" +

            "XLSX\n" +

            "XLS\n" +

            "CSV"

        );


        input.value = "";

        return;

    }



    /*
    CEK SHEETJS
    */

    if(typeof XLSX === "undefined"){


        alert(

            "Engine pembaca file belum aktif.\n\n" +

            "Pastikan SheetJS sudah dipasang."

        );


        return;

    }



    /*
    TAMPILKAN STATUS
    */

    const analysisBox =

        document.getElementById(
            "salesImportAnalysis"
        );


    analysisBox.style.display = "block";


    document.getElementById(
        "analysisStatus"
    ).innerText =

        "Sedang membaca file...";


    document.getElementById(
        "continueSalesImportButton"
    ).disabled = true;



    /*
    FILE READER
    */

    const reader = new FileReader();



    reader.onload = function(event){


        try{


            const workbook =

                XLSX.read(

                    event.target.result,

                    {

                        type:"array"

                    }

                );



            /*
            AMBIL SHEET PERTAMA
            UNTUK FASE AWAL
            */

            const firstSheetName =

                workbook.SheetNames[0];


            const worksheet =

                workbook.Sheets[
                    firstSheetName
                ];



            /*
            CONVERT KE ARRAY
            */

            const rawData =

                XLSX.utils.sheet_to_json(

                    worksheet,

                    {

                        header:1,

                        defval:""

                    }

                );



            if(rawData.length < 2){


                alert(

                    "File tidak memiliki data yang cukup."

                );


                resetSalesImport();

                return;

            }



            /*
            CARI HEADER YANG VALID

            Engine memeriksa beberapa
            baris pertama karena laporan
            marketplace kadang memiliki
            judul laporan di atas header.
            */

            let headerRowIndex = -1;

            let headers = [];



            const maxCheckRows =

                Math.min(

                    rawData.length,

                    15

                );



            for(

                let i = 0;

                i < maxCheckRows;

                i++

            ){


                const row = rawData[i];


                const nonEmptyValues =

                    row.filter(function(value){

                        return String(value).trim() !== "";

                    });



                /*
                HEADER minimal memiliki
                2 kolom terisi
                */

                if(nonEmptyValues.length >= 2){


                    const possibleHeaders =

                        row.map(function(value){

                            return String(value).trim();

                        });


                    /*
                    CEK APAKAH ADA KATA SKU
                    ATAU QTY
                    */

                    const skuTest =

                        findBestColumn(

                            possibleHeaders,

                            SKU_KEYWORDS

                        );


                    const qtyTest =

                        findBestColumn(

                            possibleHeaders,

                            QTY_KEYWORDS

                        );



                    if(

                        skuTest.column ||

                        qtyTest.column

                    ){


                        headerRowIndex = i;

                        headers = possibleHeaders;

                        break;

                    }

                }

            }



            /*
            JIKA TIDAK MENEMUKAN
            HEADER BERDASARKAN SKU/QTY
            GUNAKAN BARIS PERTAMA
            */

            if(headerRowIndex === -1){


                headerRowIndex = 0;


                headers =

                    rawData[0].map(function(value){

                        return String(value).trim();

                    });

            }



            /*
            HAPUS HEADER KOSONG
            TAPI TETAP PERTAHANKAN POSISI
            UNTUK ANALISIS
            */

            const cleanHeaders =

                headers.filter(function(header){

                    return header !== "";

                });



            /*
            CARI SKU
            */

            const skuResult =

                findBestColumn(

                    cleanHeaders,

                    SKU_KEYWORDS

                );



            /*
            CARI QTY
            */

            const qtyResult =

                findBestColumn(

                    cleanHeaders,

                    QTY_KEYWORDS

                );



            /*
            JUMLAH BARIS DATA
            */

            const dataRows =

                rawData.slice(

                    headerRowIndex + 1

                )

                .filter(function(row){


                    return row.some(function(value){

                        return String(value).trim() !== "";

                    });


                });



            /*
            SIMPAN HASIL ANALISIS
            */

            currentSalesImport = {

                file:file,

                fileName:file.name,

                fileType:

                    fileName.split(".").pop()

                    .toUpperCase(),


                sheetName:

                    firstSheetName,


                rawData:rawData,


                headerRowIndex:

                    headerRowIndex,


                headers:

                    cleanHeaders,


                dataRows:

                    dataRows,


                skuColumn:

                    skuResult.column,


                skuScore:

                    skuResult.score,


                qtyColumn:

                    qtyResult.column,


                qtyScore:

                    qtyResult.score,

                marketplace:
                    detectSalesMarketplace(cleanHeaders,file.name).marketplace,

                marketplaceScore:
                    detectSalesMarketplace(cleanHeaders,file.name).score

            };



            /*
            TAMPILKAN HASIL
            */

            renderSalesAnalysis();


        }

        catch(error){


            console.error(error);


            alert(

                "SellerBooks tidak dapat membaca file ini.\n\n" +

                "Pastikan file tidak rusak."

            );


            resetSalesImport();

        }


    };



    reader.readAsArrayBuffer(file);

}



/*
========================================================
RENDER HASIL ANALISIS
========================================================
*/

function renderSalesAnalysis(){


    if(!currentSalesImport){

        return;

    }



    const data =

        currentSalesImport;

    const marketplaceElement=document.getElementById("detectedMarketplaceName");
    if(marketplaceElement) marketplaceElement.value=data.marketplace?data.marketplace+" ✓":"Tidak dikenali";




    /*
    FILE INFO
    */

    document.getElementById(

        "analysisFileName"

    ).innerText =

        data.fileName;



    document.getElementById(

        "analysisFileType"

    ).innerText =

        data.fileType;



    document.getElementById(

        "analysisRowCount"

    ).innerText =

        data.dataRows.length
        .toLocaleString("id-ID");



    document.getElementById(

        "analysisColumnCount"

    ).innerText =

        data.headers.length;



    /*
    STATUS
    */

    const statusElement =

        document.getElementById(
            "analysisStatus"
        );


    /*
    SKU
    */

    const skuResultElement =

        document.getElementById(
            "skuRecognitionResult"
        );


    const skuConfidenceElement =

        document.getElementById(
            "skuRecognitionConfidence"
        );


    if(data.skuColumn){


        skuResultElement.innerText =

            data.skuColumn;


        skuConfidenceElement.innerText =

            "Terdeteksi otomatis • " +

            data.skuScore +

            "% kecocokan";


    }

    else{


        skuResultElement.innerText =

            "Tidak ditemukan";


        skuConfidenceElement.innerText =

            "Kolom SKU belum dikenali";

    }



    /*
    QTY
    */

    const qtyResultElement =

        document.getElementById(
            "qtyRecognitionResult"
        );


    const qtyConfidenceElement =

        document.getElementById(
            "qtyRecognitionConfidence"
        );


    if(data.qtyColumn){


        qtyResultElement.innerText =

            data.qtyColumn;


        qtyConfidenceElement.innerText =

            "Terdeteksi otomatis • " +

            data.qtyScore +

            "% kecocokan";


    }

    else{


        qtyResultElement.innerText =

            "Tidak ditemukan";


        qtyConfidenceElement.innerText =

            "Kolom QTY belum dikenali";

    }



    /*
    HEADER TAGS
    */

    const headersContainer =

        document.getElementById(
            "detectedHeaders"
        );


    headersContainer.innerHTML = "";



    data.headers.forEach(function(header){


        const tag =

            document.createElement("div");


        tag.className =

            "header-tag";


        /*
        TANDAI SKU
        */

        if(

            header === data.skuColumn

        ){

            tag.classList.add(
                "sku-header"
            );

        }


        /*
        TANDAI QTY
        */

        if(

            header === data.qtyColumn

        ){

            tag.classList.add(
                "qty-header"
            );

        }


        tag.innerText = header;


        headersContainer.appendChild(tag);


    });



    /*
    VALIDASI
    */

    const continueButton =

        document.getElementById(
            "continueSalesImportButton"
        );



    if(

        data.skuColumn &&

        data.qtyColumn

    ){


        statusElement.innerText =

            "SKU & QTY ditemukan ✓";


        continueButton.disabled = false;

    }

    else{


        statusElement.innerText =

            "Perlu konfirmasi manual";


        continueButton.disabled = true;

    }

}



/* =====================================================
   RESET IMPORT PENJUALAN - KEMBALI KE AWAL
===================================================== */

function resetSalesImport(){

    /* RESET DATA SEMENTARA */
    currentSalesImport = null;


    /* RESET INPUT FILE */
    const fileInput =
        document.getElementById(
            "salesImportFile"
        );

    if(fileInput){
        fileInput.value = "";
    }


    /* SEMBUNYIKAN HASIL ANALISIS */
    const analysisBox =
        document.getElementById(
            "salesImportAnalysis"
        );

    if(analysisBox){
        analysisBox.style.display = "none";
    }


    /* RESET KOLOM SKU */
    const skuSelect =
        document.getElementById(
            "manualSkuColumn"
        );

    if(skuSelect){

        skuSelect.innerHTML =
            '<option value="">-- Pilih Kolom SKU --</option>';

        skuSelect.value = "";

    }


    /* RESET KOLOM QTY */
    const qtySelect =
        document.getElementById(
            "manualQtyColumn"
        );

    if(qtySelect){

        qtySelect.innerHTML =
            '<option value="">-- Pilih Kolom QTY --</option>';

        qtySelect.value = "";

    }


    /* RESET MARKETPLACE */
    const marketplace =
        document.getElementById(
            "detectedMarketplaceName"
        );

    if(marketplace){
        marketplace.value =
            "Belum terdeteksi";
    }


    /* RESET AKUN TOKO */
    const storeSelect =
        document.getElementById(
            "salesStoreAccount"
        );

    if(storeSelect){

        storeSelect.innerHTML =
            '<option value="">-- Pilih Akun Toko --</option>';

        storeSelect.value = "";

    }


    /* RESET INFO AKUN */
    const storeInfo =
        document.getElementById(
            "salesStoreAccountInfo"
        );

    if(storeInfo){

        storeInfo.innerText =
            "Akun toko wajib dipilih sebelum data disimpan.";

        storeInfo.style.color = "";

    }


    /* RESET BIAYA PACKING */
    const packingInput =
        document.getElementById(
            "packingCostPerOrder"
        );

    if(packingInput){
        packingInput.value = "";
    }


    /* RESET HASIL PACKING */
    const packingCount =
        document.getElementById(
            "uniquePackingCount"
        );

    if(packingCount){
        packingCount.innerText = "0";
    }


    const packingTotal =
        document.getElementById(
            "totalPackingImportCost"
        );

    if(packingTotal){
        packingTotal.innerText = "Rp 0";
    }


    const packingInfo =
        document.getElementById(
            "packingIdentifierInfo"
        );

    if(packingInfo){

        packingInfo.innerText =
            "Identitas packing akan dipilih otomatis sesuai marketplace.";

    }


    /* RESET STATUS VALIDASI */
    const validation =
        document.getElementById(
            "previewValidationStatus"
        );

    if(validation){

        validation.className =
            "preview-validation-status";

        validation.innerText =
            "Pilih kolom SKU dan QTY untuk melanjutkan.";

    }


    /* RESET STATUS ANALISIS */
    const analysisStatus =
        document.getElementById(
            "analysisStatus"
        );

    if(analysisStatus){

        analysisStatus.innerText =
            "Menunggu Analisis";

    }


    /* RESET INFO FILE */
    const fileName =
        document.getElementById(
            "analysisFileName"
        );

    if(fileName){
        fileName.innerText = "-";
    }


    const fileType =
        document.getElementById(
            "analysisFileType"
        );

    if(fileType){
        fileType.innerText = "-";
    }


    const rowCount =
        document.getElementById(
            "analysisRowCount"
        );

    if(rowCount){
        rowCount.innerText = "0";
    }


    /* RESET TOMBOL LANJUTKAN */
    const continueButton =
        document.getElementById(
            "continueSalesImportButton"
        );

    if(continueButton){
        continueButton.disabled = true;
    }


    /* RESET TOMBOL KONFIRMASI */
    const confirmButton =
        document.getElementById(
            "confirmSalesColumnsButton"
        );

    if(confirmButton){
        confirmButton.disabled = true;
    }


    /* RESET PREVIEW */
    const previewFileName =
        document.getElementById(
            "previewFileName"
        );

    if(previewFileName){
        previewFileName.innerText = "-";
    }


    const previewRowCount =
        document.getElementById(
            "previewRowCount"
        );

    if(previewRowCount){
        previewRowCount.innerText = "0";
    }

}



/* =====================================================
   FASE 2 - LANJUT KE PREVIEW
===================================================== */

function continueSalesImport(){

    if(!currentSalesImport){

        alert(
            "Belum ada file yang dianalisis."
        );

        return;

    }

    openSalesPreview();

}


/* =====================================================
   FASE 2 - OPEN SALES PREVIEW
===================================================== */

function openSalesPreview(){


    /*
    PASTIKAN ADA DATA FILE
    */

    if(!currentSalesImport){

        return;

    }


    /*
    AMBIL DATA HASIL ANALISIS FASE 1
    */

    const data = currentSalesImport;



    /* =========================================
       TAMPILKAN NAMA FILE
    ========================================= */

    document.getElementById(
        "previewFileName"
    ).innerText = data.fileName;



    /* =========================================
       TAMPILKAN JUMLAH BARIS DATA
    ========================================= */

    document.getElementById(
        "previewRowCount"
    ).innerText =

        data.dataRows.length
        .toLocaleString("id-ID");



    /* =========================================
       AMBIL DROPDOWN SKU
    ========================================= */

    const skuSelect =

        document.getElementById(
            "manualSkuColumn"
        );



    /* =========================================
       AMBIL DROPDOWN QTY
    ========================================= */

    const qtySelect =

        document.getElementById(
            "manualQtyColumn"
        );



    /* =========================================
       KOSONGKAN DROPDOWN SEBELUM DIISI ULANG
    ========================================= */

    skuSelect.innerHTML =

        '<option value="">-- Pilih Kolom SKU --</option>';


    qtySelect.innerHTML =

        '<option value="">-- Pilih Kolom QTY --</option>';



    /* =========================================
       MASUKKAN SEMUA HEADER FILE
       KE DROPDOWN
    ========================================= */

    data.headers.forEach(function(header){


        /*
        OPTION UNTUK SKU
        */

        const skuOption =

            document.createElement("option");


        skuOption.value = header;

        skuOption.textContent = header;


        skuSelect.appendChild(
            skuOption
        );



        /*
        OPTION UNTUK QTY
        */

        const qtyOption =

            document.createElement("option");


        qtyOption.value = header;

        qtyOption.textContent = header;


        qtySelect.appendChild(
            qtyOption
        );


    });



    /* =========================================
       AUTO PILIH SKU
       JIKA SUDAH DITEMUKAN ENGINE
    ========================================= */

    if(data.skuColumn){

        skuSelect.value =
            data.skuColumn;

    }



    /* =========================================
       AUTO PILIH QTY
       JIKA SUDAH DITEMUKAN ENGINE
    ========================================= */

    if(data.qtyColumn){

        qtySelect.value =
            data.qtyColumn;

    }



    /* =========================================
       BUKA MODAL PREVIEW
    ========================================= */

const marketplaceElement=document.getElementById("detectedMarketplaceName");
    if(marketplaceElement) marketplaceElement.value=data.marketplace?data.marketplace+" ✓":"Tidak dikenali";
    populateSalesStoreAccounts();
    const packingInput=document.getElementById("packingCostPerOrder");
    if(packingInput) packingInput.value=localStorage.getItem("sellerbooks_packing_unit_cost")||"";
    updatePackingCalculation();

document.getElementById(
    "salesPreviewModal"
).classList.add(
    "active"
);

updatePreviewColumns();

}
/* =====================================================
   FASE 2 - UPDATE PREVIEW COLUMNS
===================================================== */

function updatePreviewColumns(){


    /*
    PASTIKAN DATA IMPORT ADA
    */

    if(!currentSalesImport){

        return;

    }


    /* =========================================
       AMBIL PILIHAN KOLOM SKU
    ========================================= */

    const skuColumn =

        document.getElementById(
            "manualSkuColumn"
        ).value;



    /* =========================================
       AMBIL PILIHAN KOLOM QTY
    ========================================= */

    const qtyColumn =

        document.getElementById(
            "manualQtyColumn"
        ).value;



    /* =========================================
       AMBIL STATUS VALIDASI
    ========================================= */

    const statusElement =

        document.getElementById(
            "previewValidationStatus"
        );



    /* =========================================
       AMBIL TOMBOL KONFIRMASI
    ========================================= */

    const confirmButton =

        document.getElementById(
            "confirmSalesColumnsButton"
        );



    /*
    RESET STATUS
    */

    statusElement.className =

        "preview-validation-status";


    confirmButton.disabled = true;



    /* =========================================
       KONDISI 1:
       SKU ATAU QTY BELUM DIPILIH
    ========================================= */

    if(

    !skuColumn ||

    !qtyColumn

){


    statusElement.innerText =

        "Pilih kolom SKU dan QTY untuk melanjutkan.";


    /*
    UPDATE PREVIEW TABLE
    */

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );


    return;

}


    /* =========================================
       KONDISI 2:
       SKU DAN QTY TIDAK BOLEH SAMA
    ========================================= */

    if(

    skuColumn === qtyColumn

){


    statusElement.classList.add(

        "error"

    );


    statusElement.innerText =

        "Kolom SKU dan QTY tidak boleh sama.";


    /*
    TETAP UPDATE PREVIEW
    */

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );


    return;

}



    /* =========================================
       KONDISI 3:
       SEMUA SUDAH BENAR
    ========================================= */

    statusElement.classList.add(

        "success"

    );


    statusElement.innerText =

        "✓ Kolom SKU dan QTY sudah dipilih. Data siap dikonfirmasi.";


    /*
    AKTIFKAN TOMBOL KONFIRMASI
    */

    confirmButton.disabled = false;

/*
UPDATE PREVIEW TABLE
*/

renderPreviewTable(
    skuColumn,
    qtyColumn
);

    /*
    LANGKAH 6 NANTI:

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );

    */

}

/* =====================================================
   FASE 2 - RENDER PREVIEW TABLE
===================================================== */

function renderPreviewTable(

    skuColumn,

    qtyColumn

){


    /*
    AMBIL BAGIAN BODY TABLE
    */

    const body =

        document.getElementById(
            "previewTableBody"
        );



    /*
    AMBIL HEADER SKU
    */

    const skuHeader =

        document.getElementById(
            "previewSkuHeader"
        );



    /*
    AMBIL HEADER QTY
    */

    const qtyHeader =

        document.getElementById(
            "previewQtyHeader"
        );



    /*
    KOSONGKAN DATA TABLE LAMA
    */

    body.innerHTML = "";



    /*
    UBAH NAMA HEADER SESUAI
    KOLOM YANG DIPILIH CLIENT
    */

    skuHeader.innerText =

        skuColumn || "SKU";


    qtyHeader.innerText =

        qtyColumn || "QTY";



    /*
    PASTIKAN DATA IMPORT ADA
    */

    if(!currentSalesImport){

        return;

    }



    /*
    AMBIL DATA IMPORT
    */

    const data = currentSalesImport;



    /*
    CARI POSISI / INDEX
    KOLOM SKU
    */

    const skuIndex =

        data.headers.indexOf(
            skuColumn
        );



    /*
    CARI POSISI / INDEX
    KOLOM QTY
    */

    const qtyIndex =

        data.headers.indexOf(
            qtyColumn
        );



    /* =========================================
   BERSIHKAN BARIS KETERANGAN / INSTRUKSI
   BAWAAN FILE MARKETPLACE
========================================= */

const cleanRows = data.dataRows.filter(function(row){

    const skuValue = String(
        row[skuIndex] || ""
    )
    .trim()
    .toLowerCase();


    const qtyValue = String(
        row[qtyIndex] || ""
    )
    .trim()
    .toLowerCase();


    /*
    FILTER KHUSUS FILE TIKTOK

    Baris ini bukan transaksi,
    hanya keterangan bawaan export TikTok.
    */

    if(
        skuValue ===
        "seller sku input by the seller in the product system."
    ){

        return false;

    }


    if(
        qtyValue ===
        "sku sold quantity in the order."
    ){

        return false;

    }


    /*
    JANGAN TAMPILKAN BARIS
    YANG SKU DAN QTY-NYA SAMA-SAMA KOSONG
    */

    if(!skuValue && !qtyValue){

        return false;

    }


    return true;

});


/* =========================================
   TAMPILKAN SEMUA TRANSAKSI
   Nomor baris otomatis 1, 2, 3, dst.
========================================= */

const previewRows = cleanRows;



    /*
    LOOP SETIAP BARIS
    */

    previewRows.forEach(

        function(row,index){


            /*
            BUAT BARIS BARU
            */

            const tr =

                document.createElement(
                    "tr"
                );



            /*
            =====================
            NOMOR
            =====================
            */

            const numberCell =

                document.createElement(
                    "td"
                );


            numberCell.innerText =

                index + 1;



            /*
            =====================
            SKU
            =====================
            */

            const skuCell =

                document.createElement(
                    "td"
                );


            skuCell.innerText =

                skuIndex >= 0

                ? row[skuIndex] || ""

                : "";



            /*
            =====================
            QTY
            =====================
            */

            const qtyCell =

                document.createElement(
                    "td"
                );


            qtyCell.innerText =

                qtyIndex >= 0

                ? row[qtyIndex] || ""

                : "";



            /*
            MASUKKAN SEMUA CELL
            KE BARIS
            */

            tr.appendChild(
                numberCell
            );


            tr.appendChild(
                skuCell
            );


            tr.appendChild(
                qtyCell
            );



            /*
            MASUKKAN BARIS
            KE TABLE
            */

            body.appendChild(
                tr
            );


        }

    );


}

/* =====================================================
   FASE 2 - KONFIRMASI KOLOM FINAL
===================================================== */

function confirmSalesColumns(){

    if(!currentSalesImport){

        alert(
            "Data import tidak ditemukan. Silakan upload file kembali."
        );

        return;
    }


    const skuColumn =
        document.getElementById(
            "manualSkuColumn"
        ).value;


    const qtyColumn =
        document.getElementById(
            "manualQtyColumn"
        ).value;


    if(!skuColumn){

        alert(
            "Silakan pilih kolom SKU terlebih dahulu."
        );

        return;
    }


    if(!qtyColumn){

        alert(
            "Silakan pilih kolom QTY terlebih dahulu."
        );

        return;
    }


    if(skuColumn === qtyColumn){

        alert(
            "Kolom SKU dan QTY tidak boleh sama."
        );

        return;
    }


    currentSalesImport.skuColumn =
        skuColumn;

    currentSalesImport.qtyColumn =
        qtyColumn;

    currentSalesImport.skuIndex =
        currentSalesImport.headers.indexOf(
            skuColumn
        );

    currentSalesImport.qtyIndex =
        currentSalesImport.headers.indexOf(
            qtyColumn
        );

    currentSalesImport.columnsConfirmed =
        true;

    currentSalesImport.confirmedAt =
        new Date().toISOString();


    if(!currentSalesImport.marketplace){

        alert(
            "Marketplace file belum dapat dikenali otomatis."
        );

        return;
    }


    const storeId =
        document.getElementById(
            "salesStoreAccount"
        ).value;


    if(!storeId){

        alert(
            "Silakan pilih akun toko terlebih dahulu sebelum menyimpan."
        );

        return;
    }


    const packingInput =
        document.getElementById(
            "packingCostPerOrder"
        );


    if(
        !packingInput ||
        packingInput.value === ""
    ){

        alert(
            "Silakan isi biaya packing per 1 order terlebih dahulu."
        );

        return;
    }


    /* SIMPAN DATA */
    const record =
        saveSalesImportData();


    if(!record){

        alert(
            "Data penjualan gagal disimpan."
        );

        return;
    }


    /* TUTUP PREVIEW */
    closeSalesPreview();


    /*
       KONFIRMASI KE USER

       RESET BELUM DIJALANKAN
       AGAR RESET TERJADI SETELAH
       USER MENEKAN OKE.
    */

    alert(
        "Import berhasil disimpan ✓\n\n" +

        "Marketplace: " +
        record.marketplace +

        "\nAkun: " +
        record.storeName +

        "\nData transaksi: " +
        record.rowCount.toLocaleString("id-ID") +

        "\nPacking unik: " +
        record.uniquePackingCount.toLocaleString("id-ID") +

        "\nBiaya packing: " +
        formatRupiah(
            record.totalPackingCost
        )
    );


    /*
       SETELAH USER KLIK OKE
       KEMBALI KE KONDISI AWAL
    */

        resetSalesImport();

    /*
       REFRESH LAPORAN
       Setelah import berhasil disimpan,
       laporan langsung membaca data terbaru.
    */

    if(
        typeof updateReports === "function"
    ){
        updateReports();
    }

    /*
       Refresh Master Produk agar stok langsung terlihat
       berkurang, sekaligus mempertahankan sistem notifikasi
       stok menipis yang sudah ada.
    */
    if(
        typeof renderProducts === "function"
    ){
        renderProducts();
    }

    if(
        typeof renderNotifications === "function"
    ){
        renderNotifications();
    }

}
/* =====================================================
   SEMENTARA - PERSIAPAN FASE 3
===================================================== */

function checkSalesImportDuplicate(){


    /*
    FASE 3 BELUM DIAKTIFKAN.
    */

    console.log(
        "FASE 2 SELESAI. Siap masuk pemeriksaan duplikat."
    );


    alert(
        "Kolom SKU dan QTY berhasil dikonfirmasi."
    );


}

/* =====================================================
   FASE 2 - CLOSE SALES PREVIEW
===================================================== */

function closeSalesPreview(){


    /* =========================================
       AMBIL MODAL PREVIEW
    ========================================= */

    const modal =

        document.getElementById(
            "salesPreviewModal"
        );


    /* =========================================
       JIKA MODAL TIDAK DITEMUKAN
       JANGAN LANJUTKAN AGAR TIDAK ERROR
    ========================================= */

    if(!modal){

        return;

    }


    /* =========================================
       TUTUP MODAL
    ========================================= */

    modal.classList.remove(
        "active"
    );


    /* =========================================
       RESET STATUS VALIDASI
    ========================================= */

    const statusElement =

        document.getElementById(
            "previewValidationStatus"
        );


    if(statusElement){

        statusElement.className =

            "preview-validation-status";


        statusElement.innerText =

            "Pilih kolom SKU dan QTY untuk melanjutkan.";

    }


    /* =========================================
       NONAKTIFKAN TOMBOL KONFIRMASI
    ========================================= */

    const confirmButton =

        document.getElementById(
            "confirmSalesColumnsButton"
        );


    if(confirmButton){

        confirmButton.disabled = true;

    }


}
/* =====================================================
   INITIALIZE APP
===================================================== */

document.addEventListener(

    "DOMContentLoaded",

    function(){


        /* MARKETPLACE */

        renderMarketplaces();


        /* AKUN TOKO */

        if(typeof renderStores === "function"){

            renderStores();

        }


        /* MASTER PRODUK */

        renderProducts();


        /* DASHBOARD */

        if(
            typeof renderMarketplacePerformance
            === "function"
        ){

            renderMarketplacePerformance();

        }


    }

);
/* =========================================
   LOGOUT SELLERBOOKS
========================================= */

function logoutSellerBooks(){

    /* SEMBUNYIKAN DASHBOARD */

    document.getElementById("app").style.display = "none";


    /* SEMBUNYIKAN FORM NAMA PEMILIK */

    const ownerSetup =
        document.getElementById("ownerSetupPage");

    if(ownerSetup){

        ownerSetup.style.display = "none";

    }


    /* TAMPILKAN LOGIN */

    document.getElementById("loginPage").style.display = "flex";

}
/* =========================================
   RESET IDENTITAS
========================================= */

function resetIdentity(){

    const confirmReset = confirm(
        "Reset identitas?\n\n" +
        "Nama pemilik yang tersimpan akan dihapus."
    );

    if(!confirmReset){
        return;
    }


    /* HAPUS NAMA PEMILIK */

    localStorage.removeItem(
        "sellerbooks_owner_name"
    );


    /* KOSONGKAN INPUT NAMA */

    const ownerInput =
        document.getElementById("ownerNameInput");

    if(ownerInput){
        ownerInput.value = "";
    }


    /* SEMBUNYIKAN DASHBOARD */

    const app =
        document.getElementById("app");

    if(app){
        app.style.display = "none";
    }


    /* SEMBUNYIKAN OWNER SETUP */

    const ownerSetup =
        document.getElementById("ownerSetupPage");

    if(ownerSetup){
        ownerSetup.style.display = "none";
    }


    /* TAMPILKAN LOGIN AWAL */

    const loginPage =
        document.getElementById("loginPage");

    if(loginPage){
        loginPage.style.display = "flex";
    }


    alert(
        "✅ Identitas berhasil direset.\n\n" +
        "Silakan login kembali untuk membuat Nama Pemilik baru."
    );

}

/* =====================================================
   SELLERBOOKS
   BACK BUTTON HP / BROWSER
===================================================== */

window.addEventListener(
    "popstate",
    function(event){

        /* =========================================
           JIKA ADA RIWAYAT HALAMAN
        ========================================= */

        if(
            event.state &&
            event.state.sellerbooksPage
        ){

            showView(

                event.state.sellerbooksPage,

                null,

                false

            );

        }

        else{

            /* =========================================
               KEMBALI KE DASHBOARD
            ========================================= */

            showView(

                "dashboard",

                null,

                false

            );

        }

    }
);

/* =====================================================
   SET DASHBOARD SEBAGAI HALAMAN AWAL
===================================================== */

window.addEventListener(
    "DOMContentLoaded",
    function(){

        if(

            document.getElementById("app") &&
            document.getElementById("app").style.display !== "none"

        ){

            history.replaceState(

                {
                    sellerbooksPage:"dashboard"
                },

                "",

                "#dashboard"

            );

        }

    }
);

/* =========================================
   TAMPILKAN NAMA PEMILIK DI SIDEBAR
========================================= */

function updateSidebarOwner(){

    const ownerName =
        localStorage.getItem(
            "sellerbooks_owner_name"
        );

    const userName =
        document.getElementById(
            "userName"
        );

    const userAvatar =
        document.getElementById(
            "userAvatar"
        );


    /* JIKA ADA NAMA PEMILIK */

    if(ownerName && ownerName.trim() !== ""){

        if(userName){

            userName.innerText = ownerName;

        }


        /* AMBIL HURUF PERTAMA */

        if(userAvatar){

            userAvatar.innerText =
                ownerName
                .trim()
                .charAt(0)
                .toUpperCase();

        }

    }

}

document.addEventListener(
    "DOMContentLoaded",
    function(){

        updateSidebarOwner();

    }
);
/* =========================================
   RESET OTOMATIS PERIODE HARIAN
   Data lama TETAP tersimpan untuk histori/delete.
   Tampilan operasional otomatis kembali ke Hari Ini
   ketika kalender berganti hari.
========================================= */
function getSellerBooksDayKey(){
    const now = new Date();
    return now.getFullYear() + "-" +
        String(now.getMonth()+1).padStart(2,"0") + "-" +
        String(now.getDate()).padStart(2,"0");
}

function prepareDailyViewState(){
    const todayKey = getSellerBooksDayKey();

    const dashboardDay = localStorage.getItem("sellerbooks_dashboard_view_day");
    if(dashboardDay !== todayKey){
        localStorage.setItem("sellerbooks_dashboard_view_day", todayKey);
        localStorage.setItem("sellerbooks_dashboard_period", "today");
    }

    const reportDay = localStorage.getItem("sellerbooks_report_view_day");
    if(reportDay !== todayKey){
        localStorage.setItem("sellerbooks_report_view_day", todayKey);
        localStorage.setItem("sellerbooks_report_period", "today");
    }

    const productAnalysisDay = localStorage.getItem("sellerbooks_product_analysis_view_day");
    if(productAnalysisDay !== todayKey){
        localStorage.setItem("sellerbooks_product_analysis_view_day", todayKey);
        localStorage.setItem("sellerbooks_product_analysis_period", "today");
    }
}

prepareDailyViewState();

/* =========================================
   DASHBOARD FILTER PERIODE
========================================= */

let currentDashboardPeriod = "today";


function changeDashboardPeriod(){

    const periodSelect =
        document.getElementById(
            "dashboardPeriod"
        );


    if(!periodSelect){
        return;
    }


    currentDashboardPeriod =
        periodSelect.value;


    /* SIMPAN PILIHAN */

    localStorage.setItem(
        "sellerbooks_dashboard_period",
        currentDashboardPeriod
    );
    localStorage.setItem(
        "sellerbooks_dashboard_view_day",
        getSellerBooksDayKey()
    );


    /* UPDATE DASHBOARD */

    updateDashboardByPeriod();

}
/* =========================================
   CEK APAKAH TANGGAL MASUK PERIODE
========================================= */

function isDateInPeriod(dateValue, period){

    if(!dateValue){
        return false;
    }


    const date =
        new Date(dateValue);


    if(isNaN(date.getTime())){
        return false;
    }


    const now =
        new Date();


    /* =====================================
       HARI INI
    ===================================== */

    if(period === "today"){

        return (

            date.getDate() ===
            now.getDate()

            &&

            date.getMonth() ===
            now.getMonth()

            &&

            date.getFullYear() ===
            now.getFullYear()

        );

    }


    /* =====================================
       MINGGU INI
    ===================================== */

    if(period === "week"){

        const today =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );


        const day =
            today.getDay();


        const diff =
            day === 0
            ? 6
            : day - 1;


        const monday =
            new Date(today);


        monday.setDate(
            today.getDate() - diff
        );


        monday.setHours(
            0,0,0,0
        );


        const sunday =
            new Date(monday);


        sunday.setDate(
            monday.getDate() + 6
        );


        sunday.setHours(
            23,59,59,999
        );


        return (

            date >= monday
            &&
            date <= sunday

        );

    }


    /* =====================================
       BULAN INI
    ===================================== */

    if(period === "month"){

        return (

            date.getMonth() ===
            now.getMonth()

            &&

            date.getFullYear() ===
            now.getFullYear()

        );

    }


    /* =====================================
       TAHUN INI
    ===================================== */

    if(period === "year"){

        return (

            date.getFullYear() ===
            now.getFullYear()

        );

    }


    return false;

}
/* =========================================
   UPDATE DASHBOARD BERDASARKAN PERIODE
========================================= */

function updateDashboardByPeriod(){

    console.log(
        "Dashboard periode:",
        currentDashboardPeriod
    );


    /*
    =========================================

    DATA PENJUALAN AKAN DIHUBUNGKAN
    KE SINI

    Saat engine Import Penjualan selesai,
    dashboard akan mengambil transaksi:

    Hari Ini
    Minggu Ini
    Bulan Ini
    Tahun Ini

    =========================================
    */


    /* UPDATE PERFORMA MARKETPLACE */

    if(
        typeof renderMarketplacePerformance
        === "function"
    ){

        renderMarketplacePerformance();

    }

}
/* =========================================
   LOAD PERIODE TERAKHIR
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function(){

        const todayKey = getSellerBooksDayKey();
        const savedDashboardDay =
            localStorage.getItem(
                "sellerbooks_dashboard_view_day"
            );

        if(savedDashboardDay !== todayKey){
            localStorage.setItem("sellerbooks_dashboard_view_day", todayKey);
            localStorage.setItem("sellerbooks_dashboard_period", "today");
        }

        const savedPeriod =
            localStorage.getItem(
                "sellerbooks_dashboard_period"
            );


        const periodSelect =
            document.getElementById(
                "dashboardPeriod"
            );


        if(
            savedPeriod
            &&
            periodSelect
        ){

            currentDashboardPeriod =
                savedPeriod;

            periodSelect.value =
                savedPeriod;

        }


        updateDashboardByPeriod();

    }
);

/* =========================================
   SELLERBOOKS NOTIFICATION SYSTEM
========================================= */

function toggleNotifications(){

    const panel =
        document.getElementById(
            "notificationPanel"
        );

    if(!panel){
        return;
    }

    panel.classList.toggle("show");

    renderNotifications();

}


/* =========================================
   TUTUP NOTIFIKASI
========================================= */

function closeNotifications(){

    const panel =
        document.getElementById(
            "notificationPanel"
        );

    if(panel){

        panel.classList.remove("show");

    }

}

/* =========================================
   CEK PRODUK STOK MENIPIS
========================================= */
function getLowStockProducts(){

    let productsData = [];

    try{
        productsData =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_products"
                )
            ) || [];
    }catch(error){
        productsData = [];
    }

    return productsData.filter(
        function(product){

            const stock =
                Number(product.stock);

            return (
                product.status !== "inactive"
                &&
                Number.isFinite(stock)
                &&
                stock <= 5
            );

        }
    );

}
/* =========================================
   BUAT NOTIFIKASI
========================================= */

function getSellerBooksNotifications(){

    const notifications = [];


    /* =====================================
       CEK MASTER PRODUK
    ===================================== */

    let productsData = [];

    try{

        productsData =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_products"
                )
            ) || [];

    }catch(error){

        productsData = [];

    }


    if(productsData.length === 0){

        notifications.push({

            icon:"📦",

            title:"Master Produk masih kosong",

            text:
                "Tambahkan produk terlebih dahulu agar data penjualan dapat dihitung."

        });

    }


    /* =====================================
       CEK IDENTITAS
    ===================================== */

    const ownerName =
        localStorage.getItem(
            "sellerbooks_owner_name"
        );


    if(!ownerName){

        notifications.push({

            icon:"👤",

            title:"Identitas belum diatur",

            text:
                "Silakan lengkapi nama pemilik SellerBooks."

        });

    }


    /* =====================================
       STATUS IMPORT PENJUALAN
    ===================================== */

    if(
        typeof currentSalesImport !==
        "undefined"
        &&
        currentSalesImport
    ){

        if(
            !currentSalesImport.columnsConfirmed
        ){

            notifications.push({

                icon:"📥",

                title:"Import penjualan belum selesai",

                text:
                    "SKU dan QTY dari file penjualan perlu dikonfirmasi."

            });

        }

    }

/* =====================================
   CEK STOK MENIPIS
===================================== */

const lowStockProducts =
    getLowStockProducts();


if(lowStockProducts.length > 0){

    notifications.push({

        icon:"⚠️",

        title:
            lowStockProducts.length +
            " produk stok menipis",

        text:
            "Ada produk dengan stok 5 atau kurang. " +
            "Segera lakukan pengisian ulang."

    });

}
    /* =====================================
       JIKA TIDAK ADA MASALAH
    ===================================== */

    if(notifications.length === 0){

        notifications.push({

            icon:"✅",

            title:"Semua aman",

            text:
                "Tidak ada notifikasi penting untuk saat ini."

        });

    }


    return notifications;

}


/* =========================================
   TAMPILKAN NOTIFIKASI
========================================= */

function renderNotifications(){

    const list =
        document.getElementById(
            "notificationList"
        );

    const badge =
        document.getElementById(
            "notificationBadge"
        );


    if(!list){
        return;
    }


    const notifications =
        getSellerBooksNotifications();


    list.innerHTML = "";


    notifications.forEach(
        function(notification){

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "notification-item";


            item.innerHTML = `

                <div class="notification-icon">

                    ${notification.icon}

                </div>


                <div class="notification-content">

                    <div class="notification-title">

                        ${notification.title}

                    </div>


                    <div class="notification-text">

                        ${notification.text}

                    </div>

                </div>

            `;


            list.appendChild(item);

        }
    );


    /* BADGE */

    if(badge){

        const realCount =
            notifications.filter(
                function(item){

                    return (
                        item.title !==
                        "Semua aman"
                    );

                }
            ).length;


        if(realCount > 0){

            badge.innerText =
                realCount;

            badge.style.display =
                "flex";

        }else{

            badge.style.display =
                "none";

        }

    }

}


/* =========================================
   KLIK DI LUAR PANEL
========================================= */

document.addEventListener(
    "click",
    function(event){

        const wrapper =
            document.querySelector(
                ".notification-wrapper"
            );

        const panel =
            document.getElementById(
                "notificationPanel"
            );


        if(
            wrapper &&
            panel &&
            !wrapper.contains(event.target)
        ){

            panel.classList.remove(
                "show"
            );

        }

    }
);


/* =========================================
   LOAD NOTIFIKASI
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function(){

        renderNotifications();

    }
);
/* =====================================================
   BIAYA LAIN
   DATABASE SEMENTARA LOCAL STORAGE
===================================================== */

let costs = JSON.parse(
    localStorage.getItem(
        "sellerbooks_costs"
    )
) || [];


/* =====================================================
   ID BIAYA YANG SEDANG DIEDIT
===================================================== */

let editingCostId = null;


/* =====================================================
   FORMAT RUPIAH
===================================================== */

function formatCostCurrency(value){

    /*
       Gunakan formatter utama SellerBooks agar
       Biaya Lain mengikuti mata uang + konversi yang sama
       dengan Dashboard, Laporan, dan Rincian.
    */
    return formatRupiah(value);

}


/* =====================================================
   FORMAT TANGGAL
===================================================== */

function formatCostDate(dateString){

    if(!dateString){

        return "-";

    }

    const parts =
        dateString.split("-");

    if(parts.length !== 3){

        return dateString;

    }

    return (
        parts[2] +
        "/" +
        parts[1] +
        "/" +
        parts[0]
    );

}


/* =====================================================
   SIMPAN DATA BIAYA
===================================================== */

function saveCostData(){

    localStorage.setItem(
        "sellerbooks_costs",
        JSON.stringify(costs)
    );

}


function getCostMarketplaceName(id){
    if(!id) return "-";
    const item = getCostMarketplacesData().find(function(marketplace){
        return String(marketplace.id) === String(id);
    });
    return item ? (item.name || "Marketplace") : "Marketplace tidak ditemukan";
}


function getCostStoreName(id){
    if(!id) return "-";
    const item = getCostStoresData().find(function(store){
        return String(store.id) === String(id);
    });
    return item ? (item.name || "Akun Toko") : "Akun tidak ditemukan";
}


/* =====================================================
   RENDER BIAYA
===================================================== */

function renderCosts(){

    const tableBody =
        document.getElementById(
            "costTableBody"
        );

    const emptyState =
        document.getElementById(
            "costEmptyState"
        );

    const tableWrapper =
        document.getElementById(
            "costTableWrapper"
        );

    const totalElement =
        document.getElementById(
            "costTotal"
        );


    if(
        !tableBody ||
        !emptyState ||
        !tableWrapper ||
        !totalElement
    ){

        return;

    }


    /* =========================================
       TOTAL
    ========================================= */

    const totalCost =
        costs.reduce(
            function(total, cost){

                return total +
                    (
                        Number(
                            cost.amount
                        ) || 0
                    );

            },
            0
        );


    totalElement.textContent =
        formatCostCurrency(
            totalCost
        );


    /* =========================================
       KOSONG
    ========================================= */

    if(costs.length === 0){

        tableBody.innerHTML = "";

        emptyState.style.display =
            "block";

        tableWrapper.style.display =
            "none";

        return;

    }


    /* =========================================
       ADA DATA
    ========================================= */

    emptyState.style.display =
        "none";

    tableWrapper.style.display =
        "block";


    /* =========================================
       URUTKAN TERBARU
    ========================================= */

    const sortedCosts =
        [...costs].sort(
            function(a,b){

                return (
                    String(b.date || "")
                    .localeCompare(
                        String(a.date || "")
                    )
                );

            }
        );


    /* =========================================
       RENDER TABLE
    ========================================= */

    tableBody.innerHTML =
        sortedCosts
            .map(
                function(cost){

                    return `

                        <tr>

                            <td>
                                ${formatCostDate(cost.date)}
                            </td>

                            <td>
                                ${escapeCostHtml(getCostMarketplaceName(cost.marketplaceId))}
                            </td>

                            <td>
                                ${escapeCostHtml(getCostStoreName(cost.storeId))}
                            </td>

                            <td>
                                <span
                                    style="
                                        display:inline-block;
                                        padding:5px 10px;
                                        border-radius:999px;
                                        background:#fef3c7;
                                        color:#92400e;
                                        font-size:12px;
                                        font-weight:600;
                                    "
                                >
                                    ${escapeCostHtml(cost.category)}
                                </span>
                            </td>

                            <td>
                                <strong>
                                    ${escapeCostHtml(cost.description)}
                                </strong>
                            </td>

                            <td>
                                <strong
                                    style="color:#dc2626;"
                                >
                                    ${formatCostCurrency(cost.amount)}
                                </strong>
                            </td>

                            <td>
                                ${
                                    cost.notes
                                    ? escapeCostHtml(cost.notes)
                                    : '<span style="color:#94a3b8;">-</span>'
                                }
                            </td>

                            <td>

                                <div
                                    style="
                                        display:flex;
                                        gap:6px;
                                    "
                                >

                                    <button
                                        type="button"
                                        class="secondary-button"
                                        onclick="editCost('${cost.id}')"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        class="secondary-button"
                                        onclick="deleteCost('${cost.id}')"
                                        style="
                                            color:#dc2626;
                                            border-color:#fecaca;
                                        "
                                    >
                                        Hapus
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeCostHtml(value){

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


/* =====================================================
   MARKETPLACE & AKUN TOKO UNTUK BIAYA
===================================================== */

function getCostMarketplacesData(){

    try{

        return JSON.parse(
            localStorage.getItem(
                "sellerbooks_marketplaces"
            ) || "[]"
        ) || [];

    }catch(error){

        return [];

    }

}


function getCostStoresData(){

    try{

        return JSON.parse(
            localStorage.getItem(
                "sellerbooks_stores"
            ) || "[]"
        ) || [];

    }catch(error){

        return [];

    }

}


function loadCostMarketplaceOptions(selectedId){

    const select = document.getElementById("costMarketplace");

    if(!select) return;

    const current =
        selectedId !== undefined
            ? String(selectedId || "")
            : String(select.value || "");

    select.innerHTML = `
        <option value="">
            -- Pilih Marketplace --
        </option>
    `;

    getCostMarketplacesData()
        .filter(function(marketplace){
            return marketplace.status !== "inactive";
        })
        .forEach(function(marketplace){
            const option = document.createElement("option");
            option.value = marketplace.id;
            option.textContent = marketplace.name || "Marketplace";
            select.appendChild(option);
        });

    if(current) select.value = current;

}


function loadCostStoreOptions(selectedId){

    const marketplaceSelect = document.getElementById("costMarketplace");
    const storeSelect = document.getElementById("costStore");

    if(!marketplaceSelect || !storeSelect) return;

    const marketplaceId = String(marketplaceSelect.value || "");
    const current =
        selectedId !== undefined
            ? String(selectedId || "")
            : String(storeSelect.value || "");

    storeSelect.innerHTML = `
        <option value="">
            -- Pilih Akun Toko --
        </option>
    `;

    if(!marketplaceId) return;

    getCostStoresData()
        .filter(function(store){
            return (
                store.status !== "inactive" &&
                String(store.marketplaceId) === marketplaceId
            );
        })
        .forEach(function(store){
            const option = document.createElement("option");
            option.value = store.id;
            option.textContent = store.name || "Akun Toko";
            storeSelect.appendChild(option);
        });

    if(current) storeSelect.value = current;

}


/* =====================================================
   BUKA MODAL TAMBAH BIAYA
===================================================== */

function openCostModal(){

    editingCostId = null;


    document.getElementById(
        "costModalTitle"
    ).textContent =
        "Tambah Biaya";


    document.getElementById(
        "costDate"
    ).value =
        new Date()
            .toISOString()
            .split("T")[0];


    loadCostMarketplaceOptions("");
    loadCostStoreOptions("");

    document.getElementById(
        "costCategory"
    ).value = "";


    document.getElementById(
        "costDescription"
    ).value = "";


    document.getElementById(
        "costAmount"
    ).value = "";


    document.getElementById(
        "costNotes"
    ).value = "";


    document.getElementById(
        "costModal"
    ).classList.add(
        "show"
    );

}


/* =====================================================
   TUTUP MODAL
===================================================== */

function closeCostModal(){

    document.getElementById(
        "costModal"
    ).classList.remove(
        "show"
    );

}


/* =====================================================
   SIMPAN BIAYA
===================================================== */

function saveCost(){

    const date =
        document.getElementById(
            "costDate"
        ).value;


    const marketplaceId =
        document.getElementById(
            "costMarketplace"
        ).value;

    const storeId =
        document.getElementById(
            "costStore"
        ).value;

    const category =
        document.getElementById(
            "costCategory"
        ).value.trim();


    const description =
        document.getElementById(
            "costDescription"
        ).value.trim();


    const amount =
        Number(
            document.getElementById(
                "costAmount"
            ).value
        );


    const notes =
        document.getElementById(
            "costNotes"
        ).value.trim();


    /* =========================================
       VALIDASI
    ========================================= */

    if(!date){

        alert(
            "Tanggal biaya wajib diisi."
        );

        return;

    }


    if(!marketplaceId){

        alert(
            "Marketplace wajib dipilih."
        );

        return;

    }


    if(!storeId){

        alert(
            "Akun toko wajib dipilih."
        );

        return;

    }


    if(!category){

        alert(
            "Kategori biaya wajib dipilih."
        );

        return;

    }


    if(!description){

        alert(
            "Keterangan biaya wajib diisi."
        );

        return;

    }


    if(
        !Number.isFinite(amount) ||
        amount <= 0
    ){

        alert(
            "Nominal biaya harus lebih dari 0."
        );

        return;

    }


    /* =========================================
       EDIT
    ========================================= */

    if(editingCostId){

        const index =
            costs.findIndex(
                function(cost){

                    return String(cost.id) ===
                        String(editingCostId);

                }
            );


        if(index !== -1){

            costs[index] = {

                ...costs[index],

                date:date,

                marketplaceId:marketplaceId,

                storeId:storeId,

                category:category,

                description:description,

                amount:amount,

                notes:notes,

                updatedAt:
                    new Date().toISOString()

            };

        }

    }

    /* =========================================
       TAMBAH
    ========================================= */

    else{

        costs.push({

            id:
                "cost_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .substring(2,8),

            date:date,

            marketplaceId:marketplaceId,

            storeId:storeId,

            category:category,

            description:description,

            amount:amount,

            notes:notes,

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()

        });

    }


    /* =========================================
       SIMPAN
    ========================================= */

    saveCostData();


    /* =========================================
       RENDER
    ========================================= */

    renderCosts();


    /* =========================================
       TUTUP
    ========================================= */

    closeCostModal();

}


/* =====================================================
   EDIT BIAYA
===================================================== */

function editCost(id){

    const cost =
        costs.find(
            function(item){

                return String(item.id) ===
                    String(id);

            }
        );


    if(!cost){

        return;

    }


    editingCostId =
        cost.id;


    document.getElementById(
        "costModalTitle"
    ).textContent =
        "Edit Biaya";


    document.getElementById(
        "costDate"
    ).value =
        cost.date || "";


    loadCostMarketplaceOptions(
        cost.marketplaceId || ""
    );

    loadCostStoreOptions(
        cost.storeId || ""
    );

    document.getElementById(
        "costCategory"
    ).value =
        cost.category || "";


    document.getElementById(
        "costDescription"
    ).value =
        cost.description || "";


    document.getElementById(
        "costAmount"
    ).value =
        Number(cost.amount) || 0;


    document.getElementById(
        "costNotes"
    ).value =
        cost.notes || "";


    document.getElementById(
        "costModal"
    ).classList.add(
        "show"
    );

}


/* =====================================================
   HAPUS BIAYA
===================================================== */

function deleteCost(id){

    const cost =
        costs.find(
            function(item){

                return String(item.id) ===
                    String(id);

            }
        );


    if(!cost){

        return;

    }


    const confirmed =
        confirm(
            "Hapus biaya \"" +
            cost.description +
            "\" sebesar " +
            formatCostCurrency(
                cost.amount
            ) +
            "?"
        );


    if(!confirmed){

        return;

    }


    costs =
        costs.filter(
            function(item){

                return String(item.id) !==
                    String(id);

            }
        );


    saveCostData();


    renderCosts();

}


/* =====================================================
   INITIALIZE BIAYA
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function(){

        renderCosts();

    }
);

/* =====================================================
   SELLERBOOKS - PENGATURAN
   TAMBAHAN BARU, TIDAK MENGHAPUS FUNGSI LAMA
===================================================== */

const SELLERBOOKS_SETTINGS_KEY = "sellerbooks_settings";

const DEFAULT_SELLERBOOKS_SETTINGS = {
    businessName: "",
    logo: "",
    currency: "IDR",
    packingCost: 0,
    rounding: "none",
    exchangeRates: {
        IDR: 1,
        USD: 16500,
        SGD: 12900,
        MYR: 3900
    }
};

function getSellerBooksSettings(){
    try{
        const saved =
            JSON.parse(
                localStorage.getItem(
                    SELLERBOOKS_SETTINGS_KEY
                ) || "{}"
            );

        const normalizedSaved =
            saved && typeof saved === "object"
                ? saved
                : {};

        return {
            ...DEFAULT_SELLERBOOKS_SETTINGS,
            ...normalizedSaved,
            exchangeRates: {
                ...DEFAULT_SELLERBOOKS_SETTINGS.exchangeRates,
                ...(normalizedSaved.exchangeRates &&
                    typeof normalizedSaved.exchangeRates === "object"
                    ? normalizedSaved.exchangeRates
                    : {})
            }
        };
    }catch(error){
        return {
            ...DEFAULT_SELLERBOOKS_SETTINGS
        };
    }
}

function saveSellerBooksSettings(){
    const businessName =
        document.getElementById(
            "settingsBusinessName"
        )?.value.trim() || "";

    const currency =
        document.getElementById(
            "settingsCurrency"
        )?.value || "IDR";

    const packingCost =
        Math.max(
            0,
            Number(
                document.getElementById(
                    "settingsPackingCost"
                )?.value
            ) || 0
        );

    const rounding =
        document.getElementById(
            "settingsRounding"
        )?.value || "none";

    const current =
        getSellerBooksSettings();

    const currentRates =
        current.exchangeRates || {};

    const readRate = function(id, fallback){
        const element =
            document.getElementById(id);

        const value =
            Number(element?.value);

        return Number.isFinite(value) && value > 0
            ? value
            : Number(currentRates[fallback]) || 1;
    };

    const exchangeRates = {
        IDR: 1,
        USD: readRate("settingsRateUSD", "USD"),
        SGD: readRate("settingsRateSGD", "SGD"),
        MYR: readRate("settingsRateMYR", "MYR")
    };

    const settings = {
        ...current,
        businessName,
        currency,
        packingCost,
        rounding,
        exchangeRates
    };

    localStorage.setItem(
        SELLERBOOKS_SETTINGS_KEY,
        JSON.stringify(settings)
    );

    /*
       Sinkronkan biaya packing dengan konfigurasi
       packing yang sudah digunakan oleh import.
    */
    localStorage.setItem(
        "sellerbooks_packing_unit_cost",
        String(packingCost)
    );

    applySellerBooksSettings();

    const nameInfo =
        document.getElementById(
            "settingsBusinessNameInfo"
        );

    if(nameInfo){
        nameInfo.textContent =
            "Pengaturan berhasil disimpan.";
    }

    const packingInfo =
        document.getElementById(
            "settingsPackingInfo"
        );

    if(packingInfo){
        packingInfo.textContent =
            "Default packing: " +
            formatRupiah(packingCost) +
            " / order.";
    }

    const currencyInfo =
        document.getElementById(
            "settingsCurrencyInfo"
        );

    if(currencyInfo){
        currencyInfo.textContent =
            "Kurs tersimpan. " +
            "1 USD = Rp" +
            Number(exchangeRates.USD).toLocaleString("id-ID") +
            " • 1 SGD = Rp" +
            Number(exchangeRates.SGD).toLocaleString("id-ID") +
            " • 1 MYR = Rp" +
            Number(exchangeRates.MYR).toLocaleString("id-ID");
    }
}

function loadSellerBooksSettings(){
    const settings =
        getSellerBooksSettings();

    const businessName =
        document.getElementById(
            "settingsBusinessName"
        );

    if(businessName){
        businessName.value =
            settings.businessName || "";
    }

    const currency =
        document.getElementById(
            "settingsCurrency"
        );

    if(currency){
        currency.value =
            settings.currency || "IDR";
    }

    const packingCost =
        document.getElementById(
            "settingsPackingCost"
        );

    if(packingCost){
        packingCost.value =
            Number(settings.packingCost) || 0;
    }

    const rounding =
        document.getElementById(
            "settingsRounding"
        );

    if(rounding){
        rounding.value =
            settings.rounding || "none";
    }

    const exchangeRates =
        settings.exchangeRates || {};

    const rateUSD =
        document.getElementById(
            "settingsRateUSD"
        );

    if(rateUSD){
        rateUSD.value =
            Number(exchangeRates.USD) || 16500;
    }

    const rateSGD =
        document.getElementById(
            "settingsRateSGD"
        );

    if(rateSGD){
        rateSGD.value =
            Number(exchangeRates.SGD) || 12900;
    }

    const rateMYR =
        document.getElementById(
            "settingsRateMYR"
        );

    if(rateMYR){
        rateMYR.value =
            Number(exchangeRates.MYR) || 3900;
    }

    const packingInfo =
        document.getElementById(
            "settingsPackingInfo"
        );

    if(packingInfo){
        packingInfo.textContent =
            "Default packing: " +
            formatRupiah(
                Number(settings.packingCost) || 0
            ) +
            " / order.";
    }

    renderSettingsLogo();
    applySellerBooksSettings();
}

function roundSellerBooksValue(value){
    const settings =
        getSellerBooksSettings();

    const rounding =
        settings.rounding || "none";

    const numeric =
        Number(value) || 0;

    if(rounding === "none"){
        return numeric;
    }

    const unit =
        Number(rounding);

    if(
        !Number.isFinite(unit) ||
        unit <= 0
    ){
        return numeric;
    }

    return Math.round(
        numeric / unit
    ) * unit;
}

function getSellerBooksCurrencyConfig(){
    const settings =
        getSellerBooksSettings();

    const currency =
        settings.currency || "IDR";

    const config = {
        IDR:{
            locale:"id-ID",
            currency:"IDR",
            minimumFractionDigits:0,
            maximumFractionDigits:0
        },
        USD:{
            locale:"en-US",
            currency:"USD",
            minimumFractionDigits:2,
            maximumFractionDigits:2
        },
        SGD:{
            locale:"en-SG",
            currency:"SGD",
            minimumFractionDigits:2,
            maximumFractionDigits:2
        },
        MYR:{
            locale:"ms-MY",
            currency:"MYR",
            minimumFractionDigits:2,
            maximumFractionDigits:2
        }
    };

    return (
        config[currency] ||
        config.IDR
    );
}

function formatSellerBooksCurrency(value){

    return formatRupiah(value);

}

function applySellerBooksSettings(){
    renderSettingsLogo();

    /*
       Refresh tampilan nominal setelah mata uang atau
       kurs diubah. Semua nilai dasar tetap tersimpan dalam IDR.
    */
    try{
        if(typeof renderProducts === "function"){
            renderProducts();
        }

        if(typeof renderCosts === "function"){
            renderCosts();
        }

        if(typeof updateDashboardByPeriod === "function"){
            updateDashboardByPeriod();
        }

        if(typeof updateReports === "function"){
            updateReports();
        }

        if(typeof renderProductAnalysis === "function"){
            renderProductAnalysis();
        }
    }catch(error){
        console.warn(
            "Refresh tampilan mata uang gagal:",
            error
        );
    }
}

function renderSettingsLogo(){
    const settings =
        getSellerBooksSettings();

    const preview =
        document.getElementById(
            "settingsLogoPreview"
        );

    if(preview){
        if(settings.logo){
            preview.innerHTML =
                '<img src="' +
                settings.logo +
                '" alt="Logo Bisnis">';
        }else{
            preview.textContent = "S";
        }
    }

    applyBusinessLogoToInterface(
        settings.logo
    );
}

function applyBusinessLogoToInterface(logo){
    const logoTargets =
        document.querySelectorAll(
            ".sidebar-logo, .login-logo-icon"
        );

    logoTargets.forEach(function(target){
        if(logo){
            target.innerHTML =
                '<img src="' +
                logo +
                '" alt="Logo Bisnis" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;">';
        }else{
            target.textContent = "S";
        }
    });
}

function handleSettingsLogoUpload(input){
    const file =
        input?.files?.[0];

    if(!file){
        return;
    }

    if(file.size > 1024 * 1024){
        alert(
            "Ukuran logo maksimal 1 MB."
        );
        input.value = "";
        return;
    }

    if(
        ![
            "image/png",
            "image/jpeg",
            "image/webp"
        ].includes(file.type)
    ){
        alert(
            "Format logo harus PNG, JPG, atau WEBP."
        );
        input.value = "";
        return;
    }

    const reader =
        new FileReader();

    reader.onload = function(event){
        const current =
            getSellerBooksSettings();

        current.logo =
            event.target.result || "";

        localStorage.setItem(
            SELLERBOOKS_SETTINGS_KEY,
            JSON.stringify(current)
        );

        renderSettingsLogo();

        input.value = "";

        alert(
            "✅ Logo bisnis berhasil disimpan."
        );
    };

    reader.onerror = function(){
        alert(
            "Logo gagal dibaca."
        );
        input.value = "";
    };

    reader.readAsDataURL(file);
}

function removeSettingsLogo(){
    const confirmed =
        confirm(
            "Hapus logo bisnis yang tersimpan?"
        );

    if(!confirmed){
        return;
    }

    const settings =
        getSellerBooksSettings();

    settings.logo = "";

    localStorage.setItem(
        SELLERBOOKS_SETTINGS_KEY,
        JSON.stringify(settings)
    );

    renderSettingsLogo();

    const input =
        document.getElementById(
            "settingsLogoInput"
        );

    if(input){
        input.value = "";
    }
}

function backupSellerBooksData(){
    const backup = {
        app:"SellerBooks",
        version:1,
        exportedAt:new Date().toISOString(),
        data:{}
    };

    /*
       Backup seluruh localStorage agar data
       SellerBooks dari file ini ikut tersimpan.
    */
    for(let i=0;i<localStorage.length;i++){
        const key =
            localStorage.key(i);

        if(!key){
            continue;
        }

        backup.data[key] =
            localStorage.getItem(key);
    }

    const blob =
        new Blob(
            [
                JSON.stringify(
                    backup,
                    null,
                    2
                )
            ],
            {
                type:"application/json"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    const date =
        new Date()
            .toISOString()
            .slice(0,10);

    link.href = url;
    link.download =
        "SellerBooks_Backup_" +
        date +
        ".json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function(){
        URL.revokeObjectURL(url);
    },1000);
}

function restoreSellerBooksData(input){
    const file =
        input?.files?.[0];

    if(!file){
        return;
    }

    const confirmed =
        confirm(
            "Restore akan mengganti seluruh data SellerBooks saat ini dengan data dari file backup. Lanjutkan?"
        );

    if(!confirmed){
        input.value = "";
        return;
    }

    const reader =
        new FileReader();

    reader.onload = function(event){
        try{
            const backup =
                JSON.parse(
                    event.target.result
                );

            if(
                !backup ||
                backup.app !== "SellerBooks" ||
                !backup.data ||
                typeof backup.data !== "object"
            ){
                throw new Error(
                    "Format backup tidak valid."
                );
            }

            /*
               Hapus data lokal saat ini.
               File backup berisi pasangan key/value
               localStorage.
            */
            localStorage.clear();

            Object.keys(
                backup.data
            ).forEach(function(key){
                const value =
                    backup.data[key];

                if(
                    typeof value === "string"
                ){
                    localStorage.setItem(
                        key,
                        value
                    );
                }else{
                    localStorage.setItem(
                        key,
                        JSON.stringify(value)
                    );
                }
            });

            alert(
                "✅ Restore berhasil. SellerBooks akan dimuat ulang."
            );

            location.reload();

        }catch(error){
            console.error(
                "Restore SellerBooks gagal:",
                error
            );

            alert(
                "❌ File backup tidak valid atau rusak."
            );
        }finally{
            input.value = "";
        }
    };

    reader.onerror = function(){
        input.value = "";
        alert(
            "File backup gagal dibaca."
        );
    };

    reader.readAsText(file);
}

document.addEventListener(
    "DOMContentLoaded",
    function(){
        loadSellerBooksSettings();
    }
);