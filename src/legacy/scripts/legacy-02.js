function getSalesImportsData(){

    try{

        return JSON.parse(
            localStorage.getItem(
                "sellerbooks_sales_imports"
            ) || "[]"
        );

    }catch(error){

        console.error(
            "Gagal membaca data import penjualan:",
            error
        );

        return [];
    }
}


function getAllReportTransactions(){

    const imports =
        getSalesImportsData();

    const transactions = [];

    imports.forEach(function(record){

        if(
            !Array.isArray(
                record.transactions
            )
        ){
            return;
        }

        record.transactions.forEach(
            function(transaction){

                transactions.push({

                    ...transaction,

                    importId:
                        record.id,

                    /*
                       Prioritas tanggal laporan:
                       1. reportDate transaksi
                       2. reportDate record import
                       3. importedAt transaksi lama
                       4. importedAt record lama
                    */
                    reportDate:
                        transaction.reportDate ||
                        record.reportDate ||
                        transaction.importedAt ||
                        record.importedAt,

                    importedAt:
                        transaction.importedAt ||
                        record.importedAt

                });

            }
        );

    });

    return transactions;
}


/* =========================================================
   FILTER TANGGAL
========================================================= */

function getReportDateOnly(value){
    if(!value){ return null; }
    if(value instanceof Date){ return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
    const text = String(value).trim();
    const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(isoDate){ return new Date(Number(isoDate[1]), Number(isoDate[2])-1, Number(isoDate[3])); }
    const parsed = new Date(text);
    if(isNaN(parsed.getTime())){ return null; }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getReportInputDate(id){
    const element = document.getElementById(id);
    return element ? element.value : "";
}

function getReportDateRange(){
    const from = getReportInputDate("reportDateFrom");
    const to = getReportInputDate("reportDateTo");
    return { from: from ? getReportDateOnly(from) : null, to: to ? getReportDateOnly(to) : null };
}

function isTransactionInReportPeriod(transaction, period){
    const date = getReportDateOnly(transaction.reportDate || transaction.importedAt);
    if(!date){ return true; }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if(period === "today"){
        return date.getTime() === today.getTime();
    }

    if(period === "yesterday"){
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate()-1);
        return date.getTime() === yesterday.getTime();
    }

    if(period === "week" || period === "lastWeek"){
        const day = today.getDay();
        const diff = day === 0 ? 6 : day - 1;
        const startThisWeek = new Date(today);
        startThisWeek.setDate(today.getDate()-diff);
        if(period === "week"){
            return date >= startThisWeek && date <= today;
        }
        const startLastWeek = new Date(startThisWeek);
        startLastWeek.setDate(startLastWeek.getDate()-7);
        const endLastWeek = new Date(startThisWeek);
        endLastWeek.setDate(endLastWeek.getDate()-1);
        return date >= startLastWeek && date <= endLastWeek;
    }

    if(period === "month" || period === "lastMonth"){
        const targetMonth = period === "month" ? today.getMonth() : today.getMonth()-1;
        const targetYear = today.getFullYear() + Math.floor(targetMonth/12);
        const normalizedMonth = ((targetMonth % 12)+12)%12;
        const start = new Date(targetYear, normalizedMonth, 1);
        const end = new Date(targetYear, normalizedMonth+1, 0);
        return date >= start && date <= end;
    }

    if(period === "last3Months"){
        const start = new Date(today.getFullYear(), today.getMonth()-2, 1);
        return date >= start && date <= today;
    }

    if(period === "year"){
        return date.getFullYear() === today.getFullYear();
    }

    if(period === "custom"){
        const range = getReportDateRange();
        if(range.from && date < range.from){ return false; }
        if(range.to && date > range.to){ return false; }
        return true;
    }

    return true;
}

function updateReportCustomDateUI(){
    const period = document.getElementById("reportPeriod")?.value || "month";
    const box = document.getElementById("reportCustomDateRange");
    if(!box){ return; }
    const show = period === "custom";
    box.style.display = show ? "block" : "none";
    if(!show){ return; }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const maxDate = today.toISOString().split("T")[0];
    const minDate = new Date(today.getFullYear(), today.getMonth()-2, 1).toISOString().split("T")[0];
    const from = document.getElementById("reportDateFrom");
    const to = document.getElementById("reportDateTo");

    if(from){ from.min=minDate; from.max=maxDate; }
    if(to){ to.min=minDate; to.max=maxDate; }

    const info = document.getElementById("reportDateRangeInfo");
    if(info){
        info.textContent = "Rentang tanggal maksimal: 3 bulan terakhir sampai hari ini (" + minDate.split("-").reverse().join("/") + " s/d " + maxDate.split("-").reverse().join("/") + ").";
    }
}

/* =========================================================
   FILTER MARKETPLACE & TOKO UNTUK HAPUS LAPORAN
========================================================= */

function loadDeleteReportMarketplaceFilter(){
    const select = document.getElementById("deleteReportMarketplace");
    if(!select){ return; }

    const currentValue = select.value || "all";

    select.innerHTML = `
        <option value="all">Semua Marketplace</option>
    `;

    let marketplaceData = [];
    try{
        marketplaceData =
            JSON.parse(
                localStorage.getItem("sellerbooks_marketplaces") || "[]"
            ) || [];
    }catch(error){
        marketplaceData = [];
    }

    marketplaceData
        .filter(function(marketplace){
            return marketplace.status === "active";
        })
        .forEach(function(marketplace){
            const option = document.createElement("option");
            option.value = marketplace.id;
            option.textContent = marketplace.name;
            select.appendChild(option);
        });

    if(
        [...select.options].some(function(option){
            return option.value === currentValue;
        })
    ){
        select.value = currentValue;
    }

    loadDeleteReportStoreFilter();
}

function loadDeleteReportStoreFilter(){
    const marketplaceSelect =
        document.getElementById("deleteReportMarketplace");

    const storeSelect =
        document.getElementById("deleteReportStore");

    if(!marketplaceSelect || !storeSelect){
        return;
    }

    const marketplaceId = marketplaceSelect.value || "all";
    const currentStore = storeSelect.value || "all";

    storeSelect.innerHTML = `
        <option value="all">Semua Akun Toko</option>
    `;

    let storesData = [];
    try{
        storesData =
            JSON.parse(
                localStorage.getItem("sellerbooks_stores") || "[]"
            ) || [];
    }catch(error){
        storesData = [];
    }

    storesData
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

    if(
        [...storeSelect.options].some(function(option){
            return option.value === currentStore;
        })
    ){
        storeSelect.value = currentStore;
    }
}

function deleteReportsByDateRange(){
    const fromValue = getReportInputDate("deleteReportDateFrom");
    const toValue = getReportInputDate("deleteReportDateTo");

    const marketplaceElement =
        document.getElementById("deleteReportMarketplace");

    const storeElement =
        document.getElementById("deleteReportStore");

    const marketplaceId =
        marketplaceElement ? marketplaceElement.value || "all" : "all";

    const storeId =
        storeElement ? storeElement.value || "all" : "all";

    if(!fromValue || !toValue){
        alert("Silakan pilih Dari Tanggal dan Sampai Dengan terlebih dahulu.");
        return;
    }

    const from = getReportDateOnly(fromValue);
    const to = getReportDateOnly(toValue);

    if(!from || !to){
        alert("Rentang tanggal tidak valid.");
        return;
    }

    if(from > to){
        alert("Dari Tanggal tidak boleh lebih besar dari Sampai Dengan.");
        return;
    }

    const now = new Date();
    const today =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

    const minDate =
        new Date(
            today.getFullYear(),
            today.getMonth()-2,
            1
        );

    if(from < minDate || to > today){
        alert(
            "Penghapusan hanya dapat dilakukan untuk rentang maksimal 3 bulan terakhir sampai hari ini."
        );
        return;
    }

    let imports = getSalesImportsData();

    /*
       Hanya import yang memenuhi SEMUA filter berikut yang boleh
       dihapus:
       1. Rentang tanggal laporan
       2. Marketplace yang dipilih
       3. Akun toko yang dipilih
    */
    const deletedImports =
        imports.filter(function(record){

            const reportDate =
                getReportDateOnly(
                    record.reportDate || record.importedAt
                );

            if(!reportDate){
                return false;
            }

            if(reportDate < from || reportDate > to){
                return false;
            }

            if(
                marketplaceId !== "all" &&
                String(record.marketplaceId || "").trim().toLowerCase() !==
                String(marketplaceId || "").trim().toLowerCase()
            ){
                return false;
            }

            if(
                storeId !== "all" &&
                String(record.storeId || "") !== String(storeId)
            ){
                return false;
            }

            return true;
        });

    const deleted = deletedImports.length;

    if(deleted === 0){
        alert(
            "Tidak ada laporan yang cocok dengan tanggal, marketplace, dan akun toko yang dipilih."
        );
        return;
    }

    const remaining =
        imports.filter(function(record){
            return !deletedImports.includes(record);
        });

    const fromText = fromValue.split("-").reverse().join("/");
    const toText = toValue.split("-").reverse().join("/");

    const marketplaceSelectText =
        marketplaceElement &&
        marketplaceElement.selectedOptions &&
        marketplaceElement.selectedOptions[0]
            ? marketplaceElement.selectedOptions[0].textContent
            : "Semua Marketplace";

    const storeSelectText =
        storeElement &&
        storeElement.selectedOptions &&
        storeElement.selectedOptions[0]
            ? storeElement.selectedOptions[0].textContent
            : "Semua Akun Toko";

    const confirmed =
        confirm(
            "HAPUS LAPORAN PERMANEN?\n\n" +
            "Rentang: " + fromText + " s/d " + toText + "\n" +
            "Marketplace: " + marketplaceSelectText + "\n" +
            "Akun Toko: " + storeSelectText + "\n" +
            "Jumlah data import: " + deleted +
            "\n\n" +
            "Hanya laporan yang sesuai dengan filter di atas yang akan dihapus.\n" +
            "Stok produk akan DIKEMBALIKAN sesuai jumlah stok yang sebelumnya dipotong oleh laporan tersebut.\n\n" +
            "Data yang dihapus tidak dapat dikembalikan."
        );

    if(!confirmed){
        return;
    }

    /*
       Kembalikan stok TERLEBIH DAHULU berdasarkan import yang
       benar-benar akan dihapus. Setelah itu baru hapus laporan.
    */
    const stockRestoreResult =
        restoreProductStockFromDeletedImports(
            deletedImports
        );

    localStorage.setItem(
        "sellerbooks_sales_imports",
        JSON.stringify(remaining)
    );

    updateReports();

    alert(
        "Laporan berhasil dihapus.\n" +
        deleted + " data import telah dihapus." +
        (
            stockRestoreResult.restoredQty > 0
                ? "\n\nStok dikembalikan: " +
                  stockRestoreResult.restoredQty +
                  " pcs."
                : "\n\nTidak ada stok yang perlu dikembalikan."
        )
    );
}


/* =========================================================
   AMBIL DATA SESUAI FILTER
========================================================= */

function getFilteredReportTransactions(){

    const periodElement =
        document.getElementById(
            "reportPeriod"
        );

    const marketplaceElement =
        document.getElementById(
            "reportMarketplace"
        );

    const storeElement =
        document.getElementById(
            "reportStore"
        );


    const period =
        periodElement
            ? periodElement.value
            : "month";


    const marketplaceId =
        marketplaceElement
            ? marketplaceElement.value
            : "";


    const storeId =
        storeElement
            ? storeElement.value
            : "";


    const transactions =
        getAllReportTransactions();


    return transactions.filter(
        function(transaction){

            /*
               FILTER PERIODE
            */
            if(
                !isTransactionInReportPeriod(
                    transaction,
                    period
                )
            ){
                return false;
            }


            /*
               FILTER MARKETPLACE
            */
            if(
    marketplaceId &&
    marketplaceId !== "all"
){

    const transactionMarketplaceId =
        String(
            transaction.marketplaceId || ""
        )
        .trim()
        .toLowerCase();

    const transactionMarketplace =
        String(
            transaction.marketplace || ""
        )
        .trim()
        .toLowerCase();

    const selectedMarketplaceId =
        String(
            marketplaceId
        )
        .trim()
        .toLowerCase();


    const marketplaceAliases = {

        "tiktok":
            [
                "tiktok",
                "tiktok shop"
            ],

        "tokopedia":
            [
                "tokopedia"
            ],

        "toco":
            [
                "toco"
            ],

        "blibli":
            [
                "blibli"
            ],

        "shopee":
            [
                "shopee"
            ],

        "lazada":
            [
                "lazada"
            ]

    };


    const aliases =
        marketplaceAliases[
            selectedMarketplaceId
        ] || [
            selectedMarketplaceId
        ];


    const marketplaceMatch =
        transactionMarketplaceId ===
            selectedMarketplaceId
        ||
        aliases.includes(
            transactionMarketplaceId
        )
        ||
        aliases.includes(
            transactionMarketplace
        );


    if(!marketplaceMatch){

        return false;

    }

}

            /*
               FILTER AKUN TOKO
            */
            if(
                storeId &&
                storeId !== "all"
            ){

                if(
                    String(
                        transaction.storeId
                    ) !==
                    String(
                        storeId
                    )
                ){

                    return false;
                }
            }


            return true;

        }
    );
}


/* =========================================================
   RENDER TOTAL PENJUALAN + QTY + HPP
========================================================= */

function renderReportSalesSummary(){

    const transactions =
        getFilteredReportTransactions();


    /* =====================================================
       TOTAL PENJUALAN
    ===================================================== */

    const totalSales =
        transactions.reduce(
            function(total,item){

                return total +
                    (
                        getReportTransactionSalesAmount(item)
                    );

            },
            0
        );


    /* =====================================================
       TOTAL QTY
    ===================================================== */

    const totalQty =
        transactions.reduce(
            function(total,item){

                return total +
                    (
                        Number(
                            item.qty
                        ) || 0
                    );

            },
            0
        );


    /* =====================================================
       TRANSAKSI UNIK
    ===================================================== */

    const orderSet =
        new Set();


    transactions.forEach(
        function(item){

            const order =
                String(
                    item.orderId || ""
                ).trim();


            if(order){

                orderSet.add(
                    order
                );

            }

        }
    );


    const transactionCount =
        orderSet.size;


    /*
       Jika order ID kosong,
       gunakan jumlah baris transaksi.
    */

    const finalTransactionCount =
        transactionCount > 0
            ? transactionCount
            : transactions.length;


    /* =====================================================
       LOAD MASTER PRODUK
    ===================================================== */

    let masterProducts = [];

    try{

        masterProducts =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_products"
                ) || "[]"
            );

    }
    catch(error){

        console.error(
            "Gagal membaca Master Produk:",
            error
        );

        masterProducts = [];

    }


    /* =====================================================
       BUAT INDEX SKU
       SKU DINORMALISASI AGAR:
       ABC-001 = abc-001
    ===================================================== */

    const productMap =
        new Map();


    masterProducts.forEach(
        function(product){

            const sku =
                String(
                    product.sku || ""
                )
                .trim()
                .toLowerCase();


            if(!sku){
                return;
            }


            productMap.set(
                sku,
                product
            );

        }
    );


    /* =====================================================
       HITUNG TOTAL HPP
       HPP = COST MASTER PRODUK × QTY TRANSAKSI
    ===================================================== */

    let totalHpp = 0;

    let matchedSkuCount = 0;

    let unmatchedSkuCount = 0;


    transactions.forEach(
        function(item){

            const sku =
                String(
                    item.sku || ""
                )
                .trim()
                .toLowerCase();


            const qty =
                Number(
                    item.qty
                ) || 0;


            const product =
                productMap.get(
                    sku
                );


            /*
               SKU DITEMUKAN
            */

            if(product){

                const hppPerUnit =
                    Number(
                        product.cost
                    ) || 0;


                totalHpp +=
                    hppPerUnit *
                    qty;


                matchedSkuCount++;

            }


            /*
               SKU TIDAK DITEMUKAN
            */

            else{

                unmatchedSkuCount++;

            }

        }
    );


    /* =====================================================
       ELEMENT LAPORAN
    ===================================================== */

    const salesElement =
        document.getElementById(
            "reportTotalSales"
        );


    const productsElement =
        document.getElementById(
            "reportTotalProducts"
        );


    const packingElement =
        document.getElementById(
            "reportTotalPacking"
        );


    const hppElement =
        document.getElementById(
            "reportTotalHpp"
        );


    /* =====================================================
       TAMPILKAN TOTAL PENJUALAN
    ===================================================== */

    if(salesElement){

        salesElement.textContent =
            formatRupiah(
                totalSales
            );

    }


    /* =====================================================
       TAMPILKAN TOTAL PRODUK
    ===================================================== */

    if(productsElement){

        productsElement.textContent =
            totalQty.toLocaleString(
                "id-ID"
            ) +
            " PCS";

    }


    /* =====================================================
       PACKING UNIK
    ===================================================== */

    const packingSet =
        new Set();


    transactions.forEach(
        function(item){

            const packing =
                String(
                    item.packingId || ""
                ).trim();


            if(packing){

                packingSet.add(
                    packing
                );

            }

        }
    );


    if(packingElement){

        packingElement.textContent =
            packingSet.size.toLocaleString(
                "id-ID"
            );

    }


    /* =====================================================
       TAMPILKAN TOTAL HPP
    ===================================================== */

    if(hppElement){

        hppElement.textContent =
            formatRupiah(
                totalHpp
            );

    }


    /* =====================================================
       SIMPAN HASIL LAPORAN
       UNTUK PERHITUNGAN TAHAP BERIKUTNYA
    ===================================================== */

    window.currentReportSummary = {

        transactions:
            transactions,

        totalSales:
            totalSales,

        totalQty:
            totalQty,

        transactionCount:
            finalTransactionCount,

        packingCount:
            packingSet.size,

        totalHpp:
            totalHpp,

        matchedSkuCount:
            matchedSkuCount,

        unmatchedSkuCount:
            unmatchedSkuCount

    };


    /* =====================================================
       INFO FILTER
    ===================================================== */

    const info =
        document.getElementById(
            "reportFilterInfo"
        );


    if(info){

        let infoText =
            "Menampilkan " +
            transactions.length.toLocaleString(
                "id-ID"
            ) +
            " baris transaksi • " +
            finalTransactionCount.toLocaleString(
                "id-ID"
            ) +
            " transaksi • " +
            totalQty.toLocaleString(
                "id-ID"
            ) +
            " produk";


        /*
           INFO SKU YANG BELUM COCOK
        */

        if(unmatchedSkuCount > 0){

            infoText +=
                " • " +
                unmatchedSkuCount.toLocaleString(
                    "id-ID"
                ) +
                " SKU belum ditemukan di Master Produk";

        }


        info.textContent =
            infoText + ".";

    }

}

/* =========================================================
   RENDER SKU BELUM DITEMUKAN DI MASTER PRODUK
========================================================= */

function renderUnmatchedSkuReport(){

    const section =
        document.getElementById(
            "reportUnmatchedSkuSection"
        );

    const body =
        document.getElementById(
            "reportUnmatchedSkuBody"
        );

    if(!section || !body){
        return;
    }


    /*
       AMBIL TRANSAKSI SESUAI FILTER LAPORAN
    */

    const transactions =
        getFilteredReportTransactions();


    /*
       AMBIL MASTER PRODUK
    */

    const masterProducts =
        JSON.parse(
            localStorage.getItem(
                "sellerbooks_products"
            )
        ) || [];


    /*
       BUAT INDEX SKU MASTER PRODUK
    */

    const masterSkuMap =
        new Map();

    masterProducts.forEach(
        function(product){

            const sku =
                String(
                    product.sku || ""
                )
                .trim()
                .toLowerCase();

            if(sku){
                masterSkuMap.set(
                    sku,
                    true
                );
            }

        }
    );


    /*
       KELOMPOKKAN SKU YANG TIDAK DITEMUKAN
    */

    const unmatchedMap =
        new Map();


    transactions.forEach(
        function(item){

            const originalSku =
                String(
                    item.sku || ""
                ).trim();

            /*
               SKU kosong tidak dimasukkan
               sebagai SKU tidak ditemukan.
            */

            if(!originalSku){
                return;
            }


            const normalizedSku =
                originalSku.toLowerCase();


            /*
               SKU SUDAH ADA DI MASTER
            */

            if(
                masterSkuMap.has(
                    normalizedSku
                )
            ){
                return;
            }


            /*
               BELUM ADA DI MASTER
            */

            if(
                !unmatchedMap.has(
                    normalizedSku
                )
            ){

                unmatchedMap.set(
                    normalizedSku,
                    {
                        sku: originalSku,
                        rows: 0,
                        qty: 0
                    }
                );

            }


            const data =
                unmatchedMap.get(
                    normalizedSku
                );


            /*
               JUMLAH BARIS TRANSAKSI
            */

            data.rows += 1;


            /*
               TOTAL QTY
            */

            data.qty +=
                Number(
                    item.qty
                ) || 0;

        }
    );


    /*
       UBAH MENJADI ARRAY
       DAN URUTKAN DARI QTY TERBESAR
    */

    const unmatchedList =
        Array.from(
            unmatchedMap.values()
        ).sort(
            function(a,b){

                return b.qty - a.qty;

            }
        );


    /*
       JIKA TIDAK ADA SKU YANG BELUM DITEMUKAN
    */

    if(
        unmatchedList.length === 0
    ){

        section.style.display =
            "none";

        body.innerHTML =
            `
            <tr>
                <td
                    colspan="3"
                    style="
                        text-align:center;
                        padding:30px;
                        color:#64748b;
                    "
                >
                    Tidak ada SKU yang belum ditemukan.
                </td>
            </tr>
            `;

        return;

    }


    /*
       TAMPILKAN SECTION
    */

    section.style.display =
        "block";


    /*
       RENDER DATA
    */

    body.innerHTML =
        unmatchedList.map(
            function(item){

                return `
                    <tr>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    item.sku
                                )}
                            </strong>
                        </td>

                        <td>
                            ${item.rows.toLocaleString(
                                "id-ID"
                            )}
                        </td>

                        <td>
                            ${item.qty.toLocaleString(
                                "id-ID"
                            )}
                            PCS
                        </td>

                    </tr>
                `;

            }
        ).join("");

}
/* =========================================================
   JALANKAN LAPORAN
========================================================= */

/* =========================================================
   SELLERBOOKS REPORT ENGINE - TAHAP 3
   PENJUALAN BERSIH + ADMIN + PACKING + BIAYA LAIN
   + LABA KOTOR + LABA BERSIH + MARGIN
   + MARKETPLACE + TOKO + DETAIL TRANSAKSI
========================================================= */

function getReportStoresData(){

    try{

        return JSON.parse(
            localStorage.getItem(
                "sellerbooks_stores"
            ) || "[]"
        );

    }catch(error){

        return [];

    }

}


/* =========================================================
   AMBIL BIAYA LAIN SESUAI PERIODE
   PACKING TIDAK DIHITUNG DI SINI
   karena packing sudah dihitung terpisah
========================================================= */

function getReportOtherCosts(){

    let costsData = [];

    try{
        costsData = JSON.parse(
            localStorage.getItem("sellerbooks_costs") || "[]"
        );
    }catch(error){
        costsData = [];
    }

    const period =
        document.getElementById("reportPeriod")?.value || "month";

    const marketplaceId =
        document.getElementById("reportMarketplace")?.value || "all";

    const storeId =
        document.getElementById("reportStore")?.value || "all";

    let total = 0;

    costsData.forEach(function(cost){

        const category =
            String(cost.category || "").trim().toLowerCase();

        /* PACKING SUDAH DIHITUNG TERPISAH */
        if(
            category === "packing" ||
            category.includes("packing")
        ){
            return;
        }

        const dateValue = cost.date || cost.createdAt;

        if(
            dateValue &&
            !isTransactionInReportPeriod(
                { reportDate: dateValue },
                period
            )
        ){
            return;
        }

        /* BIAYA WAJIB TERIKAT KE MARKETPLACE */
        if(
            marketplaceId !== "all" &&
            String(cost.marketplaceId || "") !== String(marketplaceId)
        ){
            return;
        }

        /* BIAYA WAJIB TERIKAT KE AKUN TOKO */
        if(
            storeId !== "all" &&
            String(cost.storeId || "") !== String(storeId)
        ){
            return;
        }

        total += Number(cost.amount) || 0;

    });

    return total;

}


/* =========================================================
   HITUNG BIAYA LAIN PER MARKETPLACE / AKUN TOKO
========================================================= */

function getReportOtherCostsByScope(
    marketplaceId,
    storeId
){

    let costsData = [];

    try{
        costsData = JSON.parse(
            localStorage.getItem("sellerbooks_costs") || "[]"
        );
    }catch(error){
        costsData = [];
    }

    const period =
        document.getElementById("reportPeriod")?.value || "month";

    let total = 0;

    costsData.forEach(function(cost){

        const category =
            String(cost.category || "").trim().toLowerCase();

        if(
            category === "packing" ||
            category.includes("packing")
        ){
            return;
        }

        const dateValue = cost.date || cost.createdAt;

        if(
            dateValue &&
            !isTransactionInReportPeriod(
                { reportDate: dateValue },
                period
            )
        ){
            return;
        }

        if(
            marketplaceId !== undefined &&
            marketplaceId !== null &&
            String(marketplaceId) !== "all" &&
            String(cost.marketplaceId || "") !== String(marketplaceId)
        ){
            return;
        }

        if(
            storeId !== undefined &&
            storeId !== null &&
            String(storeId) !== "all" &&
            String(cost.storeId || "") !== String(storeId)
        ){
            return;
        }

        total += Number(cost.amount) || 0;

    });

    return total;

}


/* =========================================================
   HITUNG BIAYA ADMIN
   BERDASARKAN AKUN TOKO
========================================================= */

function getReportStoreFeePercent(storeId){

    const stores =
        getReportStoresData();


    const store =
        stores.find(function(item){

            return String(item.id) ===
                String(storeId);

        });


    if(!store){

        return 0;

    }


    const fee =
        Number(
            store.feePercent
        );


    return Number.isFinite(fee)
        ? fee
        : 0;

}


/* =========================================================
   HITUNG PACKING DARI TRANSAKSI
========================================================= */

function calculateReportPacking(transactions){

    const packingSet =
        new Set();


    transactions.forEach(function(item){

        let packingId =
            String(
                item.packingId || ""
            ).trim();


        /*
           JIKA TIDAK ADA ID PACKING
           GUNAKAN ORDER ID
        */

        if(!packingId){

            packingId =
                String(
                    item.orderId || ""
                ).trim();

        }


        /*
           JIKA KEDUANYA KOSONG,
           GUNAKAN IMPORT + INDEX
        */

        if(!packingId){

            packingId =
                String(
                    item.importId || ""
                ) +
                "_" +
                String(
                    item.sku || ""
                );

        }


        /*
           PREFIX MARKETPLACE + TOKO
           AGAR ID DARI TOKO BERBEDA
           TIDAK BENTROK
        */

        packingSet.add(

            String(
                item.marketplaceId || ""
            ) +
            "|" +
            String(
                item.storeId || ""
            ) +
            "|" +
            packingId

        );

    });


    return packingSet.size;

}


/* =========================================================
   HITUNG KEUANGAN UTAMA
========================================================= */

function calculateReportFinancial(){

    const transactions =
        getFilteredReportTransactions();


    let totalSales = 0;

    let totalQty = 0;

    let totalHpp = 0;

    let totalAdmin = 0;


    const masterProducts = [];

    try{

        const data =
            JSON.parse(
                localStorage.getItem(
                    "sellerbooks_products"
                ) || "[]"
            );

        if(
            Array.isArray(data)
        ){

            data.forEach(function(product){

                masterProducts.push(product);

            });

        }

    }catch(error){}


    const productMap =
        new Map();


    masterProducts.forEach(function(product){

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


    transactions.forEach(function(item){

        const sales =
            getReportTransactionSalesAmount(item);


        const qty =
            Number(
                item.qty
            ) || 0;


        totalSales += sales;

        totalQty += qty;


        /*
           HPP
        */

        const sku =
            String(
                item.sku || ""
            )
            .trim()
            .toLowerCase();


        const product =
            productMap.get(
                sku
            );


        if(product){

            totalHpp +=
                (
                    Number(
                        product.cost
                    ) || 0
                ) *
                qty;

        }


        /*
           BIAYA ADMIN TOKO
        */

        const feePercent =
            getReportStoreFeePercent(
                item.storeId
            );


        totalAdmin +=
            sales *
            feePercent /
            100;

    });


    /*
       PACKING
    */

    const packingCount =
        calculateReportPacking(
            transactions
        );


    const packingUnit =
        getPackingCostPerOrder();


    const totalPacking =
        packingCount *
        packingUnit;


    /*
       PENJUALAN BERSIH
    */

    const netSales =
        totalSales -
        totalAdmin;


    /*
       LABA KOTOR
    */

    const grossProfit =
        netSales -
        totalHpp -
        totalPacking;


    /*
       BIAYA LAIN
    */

    const otherCosts =
        getReportOtherCosts();


    /*
       LABA BERSIH
    */

    const netProfit =
        grossProfit -
        otherCosts;


    /*
       MARGIN
    */

    const margin =
        totalSales > 0
            ? (
                netProfit /
                totalSales
            ) *
            100
            : 0;


    return {

        transactions:
            transactions,

        totalSales:
            totalSales,

        totalQty:
            totalQty,

        totalAdmin:
            totalAdmin,

        netSales:
            netSales,

        totalHpp:
            totalHpp,

        packingCount:
            packingCount,

        totalPacking:
            totalPacking,

        otherCosts:
            otherCosts,

        grossProfit:
            grossProfit,

        netProfit:
            netProfit,

        margin:
            margin

    };

}


/* =========================================================
   RENDER KARTU KEUANGAN
========================================================= */

function renderReportFinancial(){

    const data =
        calculateReportFinancial();


    const totalSales =
        document.getElementById(
            "reportTotalSales"
        );


    const netSales =
        document.getElementById(
            "reportNetSales"
        );


    const totalProducts =
        document.getElementById(
            "reportTotalProducts"
        );


    const totalPacking =
        document.getElementById(
            "reportTotalPacking"
        );


    const totalHpp =
        document.getElementById(
            "reportTotalHpp"
        );


    const otherCosts =
        document.getElementById(
            "reportOtherCosts"
        );


    const grossProfit =
        document.getElementById(
            "reportGrossProfit"
        );


    const netProfit =
        document.getElementById(
            "reportNetProfit"
        );


    const margin =
        document.getElementById(
            "reportProfitMargin"
        );


    if(totalSales){

        totalSales.textContent =
            formatRupiah(
                data.totalSales
            );

    }


    if(netSales){

        netSales.textContent =
            formatRupiah(
                data.netSales
            );

    }


    if(totalProducts){

        totalProducts.textContent =
            data.totalQty.toLocaleString(
                "id-ID"
            ) +
            " PCS";

    }


    if(totalPacking){

        totalPacking.textContent =
            data.packingCount.toLocaleString(
                "id-ID"
            );

    }


    if(totalHpp){

        totalHpp.textContent =
            formatRupiah(
                data.totalHpp
            );

    }


    if(otherCosts){

        otherCosts.textContent =
            formatRupiah(
                data.otherCosts
            );

    }


    if(grossProfit){

        grossProfit.textContent =
            formatRupiah(
                data.grossProfit
            );

    }


    if(netProfit){

        netProfit.textContent =
            formatRupiah(
                data.netProfit
            );

    }


    if(margin){

        margin.textContent =
            data.margin.toLocaleString(
                "id-ID",
                {
                    minimumFractionDigits:0,
                    maximumFractionDigits:2
                }
            ) +
            "%";

    }


    /*
       INFO PENJUALAN
    */

    const salesInfo =
        document.getElementById(
            "reportSalesInfo"
        );


    if(salesInfo){

        salesInfo.textContent =
            "Admin marketplace " +
            formatRupiah(
                data.totalAdmin
            );

    }


    /*
       SIMPAN HASIL
    */

    window.currentReportFinancial =
        data;

}


/* =========================================================
   RINGKASAN MARKETPLACE
========================================================= */

function renderReportMarketplaceTable(){

    const body = document.getElementById("reportMarketplaceBody");
    if(!body) return;

    try{
        const transactions = getFilteredReportTransactions();

        if(!transactions.length){
            body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:35px;color:#64748b;">Belum ada data laporan.</td></tr>`;
            return;
        }

        const groups = new Map();

        transactions.forEach(function(item){
            const marketplaceId = String(item.marketplaceId || item.marketplace || "unknown");
            if(!groups.has(marketplaceId)){
                groups.set(marketplaceId,{
                    marketplace: item.marketplace || marketplaceId || "-",
                    marketplaceId: marketplaceId,
                    sales:0,
                    qty:0,
                    admin:0,
                    hpp:0,
                    packingIds:new Set()
                });
            }

            const group = groups.get(marketplaceId);
            const sales = getReportTransactionSalesAmount(item);
            const qty = Number(item.qty) || 0;

            group.sales += sales;
            group.qty += qty;

            const fee = getReportStoreFeePercent(item.storeId);
            group.admin += sales * fee / 100;

            const product = getMasterProductBySku(item.sku);
            if(product){
                group.hpp += (Number(product.cost) || 0) * qty;
            }

            let packing = String(item.packingId || "").trim();
            if(!packing) packing = String(item.orderId || "").trim();
            if(packing){
                group.packingIds.add(
                    String(item.storeId || "") + "|" + packing
                );
            }
        });

        let html = "";

        groups.forEach(function(group){
            const netSales = group.sales - group.admin;
            const packingCost = group.packingIds.size * getPackingCostPerOrder();

            const otherCosts = getReportOtherCostsByScope(
                group.marketplaceId,
                "all"
            );

            const profit = netSales - group.hpp - packingCost - otherCosts;
            const margin = group.sales > 0 ? (profit / group.sales) * 100 : 0;

            html += `
                <tr>
                    <td>${escapeHtml(group.marketplace)}</td>
                    <td>Semua Toko</td>
                    <td>${formatRupiah(group.sales)}</td>
                    <td>${formatRupiah(netSales)}</td>
                    <td>${group.qty.toLocaleString("id-ID")} PCS</td>
                    <td>${group.packingIds.size.toLocaleString("id-ID")}</td>
                    <td>${formatRupiah(profit)}</td>
                    <td>${margin.toLocaleString("id-ID",{maximumFractionDigits:2})}%</td>
                </tr>
            `;
        });

        body.innerHTML = html || `<tr><td colspan="8" style="text-align:center;padding:35px;color:#64748b;">Belum ada data laporan.</td></tr>`;

    }catch(error){
        console.error("Gagal menampilkan Performa Marketplace:", error);
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:35px;color:#dc2626;">Data laporan gagal ditampilkan. Silakan refresh halaman.</td></tr>`;
    }
}
/* =========================================================
   RINGKASAN AKUN TOKO
========================================================= */

function renderReportStoreTable(){

    const body = document.getElementById("reportStoreBody");
    if(!body) return;

    try{
        const transactions = getFilteredReportTransactions();

        if(!transactions.length){
            body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:35px;color:#64748b;">Belum ada data laporan.</td></tr>`;
            return;
        }

        const groups = new Map();

        transactions.forEach(function(item){
            const storeId = String(item.storeId || item.storeName || "unknown");

            if(!groups.has(storeId)){
                groups.set(storeId,{
                    marketplace: item.marketplace || "-",
                    store: item.storeName || "-",
                    storeId: storeId,
                    sales:0,
                    qty:0,
                    admin:0,
                    hpp:0,
                    packingIds:new Set()
                });
            }

            const group = groups.get(storeId);
            const sales = getReportTransactionSalesAmount(item);
            const qty = Number(item.qty) || 0;

            group.sales += sales;
            group.qty += qty;

            const fee = getReportStoreFeePercent(item.storeId);
            group.admin += sales * fee / 100;

            const product = getMasterProductBySku(item.sku);
            if(product){
                group.hpp += (Number(product.cost) || 0) * qty;
            }

            let packing = String(item.packingId || "").trim();
            if(!packing) packing = String(item.orderId || "").trim();
            if(packing) group.packingIds.add(packing);
        });

        let html = "";

        groups.forEach(function(group){
            const netSales = group.sales - group.admin;
            const packingCost = group.packingIds.size * getPackingCostPerOrder();

            const otherCosts = getReportOtherCostsByScope(
                "all",
                group.storeId
            );

            const profit = netSales - group.hpp - packingCost - otherCosts;
            const margin = group.sales > 0 ? (profit / group.sales) * 100 : 0;

            html += `
                <tr>
                    <td>${escapeHtml(group.marketplace)}</td>
                    <td>${escapeHtml(group.store)}</td>
                    <td>${formatRupiah(group.sales)}</td>
                    <td>${formatRupiah(netSales)}</td>
                    <td>${group.qty.toLocaleString("id-ID")} PCS</td>
                    <td>${group.packingIds.size.toLocaleString("id-ID")}</td>
                    <td>${formatRupiah(profit)}</td>
                    <td>${margin.toLocaleString("id-ID",{maximumFractionDigits:2})}%</td>
                </tr>
            `;
        });

        body.innerHTML = html || `<tr><td colspan="8" style="text-align:center;padding:35px;color:#64748b;">Belum ada data laporan.</td></tr>`;

    }catch(error){
        console.error("Gagal menampilkan Performa Akun Toko:", error);
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:35px;color:#dc2626;">Data laporan gagal ditampilkan. Silakan refresh halaman.</td></tr>`;
    }
}
/* =========================================================
   DETAIL TRANSAKSI
========================================================= */

function renderReportTransactionTable(){

    const body = document.getElementById("reportTransactionBody");
    if(!body) return;

    try{
        const transactions = getFilteredReportTransactions();

        if(!transactions.length){
            body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:35px;color:#64748b;">Belum ada data penjualan.</td></tr>`;
            return;
        }

        let html = "";

        transactions.forEach(function(item){

            const dateValue = item.transactionDate || item.importedAt || item.reportDate || "";
            let formattedDate = "-";

            if(dateValue){
                const d = new Date(dateValue);
                if(!isNaN(d.getTime())){
                    formattedDate = d.toLocaleDateString("id-ID");
                }
            }

            const sku = String(item.sku || "").trim();
            const product = getMasterProductBySku(sku);
            const status = product ? "✓ Cocok" : "⚠ SKU belum ada";

            html += `
                <tr>
                    <td>${escapeHtml(formattedDate)}</td>
                    <td>${escapeHtml(item.marketplace || "-")}</td>
                    <td>${escapeHtml(item.storeName || "-")}</td>
                    <td>${escapeHtml(String(item.orderId || "-"))}</td>
                    <td>${escapeHtml(sku || "-")}</td>
                    <td>${Number(item.qty) || 0}</td>
                    <td>${formatRupiah(getReportTransactionSalesAmount(item))}</td>
                    <td>${status}</td>
                </tr>
            `;
        });

        body.innerHTML = html;

    }catch(error){
        console.error("Gagal menampilkan Detail Penjualan:", error);
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:35px;color:#dc2626;">Detail penjualan gagal ditampilkan. Silakan refresh halaman.</td></tr>`;
    }
}
/* =========================================================
   UPDATE SEMUA LAPORAN
========================================================= */

function updateReports(){

    /* Satu error tidak boleh membuat semua tabel laporan kosong. */
    try{ renderReportSalesSummary(); }catch(error){ console.error("Laporan ringkasan:", error); }
    try{ renderUnmatchedSkuReport(); }catch(error){ console.error("Laporan SKU:", error); }
    try{ renderReportFinancial(); }catch(error){ console.error("Laporan keuangan:", error); }
    try{ renderReportMarketplaceTable(); }catch(error){ console.error("Laporan marketplace:", error); }
    try{ renderReportStoreTable(); }catch(error){ console.error("Laporan akun toko:", error); }
    try{ renderReportTransactionTable(); }catch(error){ console.error("Detail transaksi:", error); }

}


/* =========================================================
   EVENT FILTER
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function(){

        const period =
            document.getElementById(
                "reportPeriod"
            );

        /* DEFAULT LAPORAN: HARI INI
           Jika kalender berganti hari, filter otomatis kembali ke Hari Ini. */
        if(period){
            const todayKey = getSellerBooksDayKey();
            const savedDay = localStorage.getItem("sellerbooks_report_view_day");
            const savedPeriod = localStorage.getItem("sellerbooks_report_period");

            if(savedDay !== todayKey){
                period.value = "today";
                localStorage.setItem("sellerbooks_report_view_day", todayKey);
                localStorage.setItem("sellerbooks_report_period", "today");
            }else{
                period.value = savedPeriod || "today";
            }
        }

        const marketplace =
            document.getElementById(
                "reportMarketplace"
            );

        const store =
            document.getElementById(
                "reportStore"
            );


        if(period){

            period.addEventListener(
                "change",
                function(){
                    updateReportCustomDateUI();
                    localStorage.setItem("sellerbooks_report_period", period.value);
                    localStorage.setItem("sellerbooks_report_view_day", getSellerBooksDayKey());
                    updateReports();
                }
            );

        }

        const reportDateFrom = document.getElementById("reportDateFrom");
        const reportDateTo = document.getElementById("reportDateTo");

        if(reportDateFrom){
            reportDateFrom.addEventListener("change", updateReports);
        }

        if(reportDateTo){
            reportDateTo.addEventListener("change", updateReports);
        }

        updateReportCustomDateUI();


        if(marketplace){

            marketplace.addEventListener(
                "change",
                function(){

                    if(
                        typeof onReportMarketplaceChange ===
                        "function"
                    ){

                        onReportMarketplaceChange();

                    }

                    updateReports();

                }
            );

        }


        if(store){

            store.addEventListener(
                "change",
                updateReports
            );

        }


        setTimeout(
            function(){

                updateReports();

            },
            100
        );

    }
);