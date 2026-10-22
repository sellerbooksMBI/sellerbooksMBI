/* =====================================================
   SELLERBOOKS SALES TRANSACTION PROCESSING
   Existing stock, transaction, packing and import-save helpers, relocated unchanged.
===================================================== */

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
            sellerBooksStorage.getItem("sellerbooks_products") || "[]"
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
            sellerBooksStorage.getItem("sellerbooks_products") || "[]"
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

    if(!item){
        return 0;
    }

    /*
       SNAPSHOT HARIAN:
       - Marketplace/API memiliki salesAmount yang sudah berasal dari
         harga transaksi/order, sehingga nilai tersebut tetap dipakai.
       - Untuk transaksi manual SellerBooks, transaksi hari ini boleh
         membaca Master Produk terbaru.
       - Setelah hari berganti, gunakan priceSnapshot yang disimpan
         saat transaksi/import dibuat.
       - Dengan demikian edit harga Master Produk tidak mengubah
         penjualan hari-hari sebelumnya.
    */
    if(
        item.marketplace === "TikTok" ||
        item.marketplace === "TikTok Shop" ||
        item.marketplace === "Shopee" ||
        item.marketplace === "Blibli" ||
        item.marketplace === "Lazada"
    ){
        return Number(item.salesAmount) || 0;
    }

    const qty =
        Number(item.qty) || 0;

    if(qty <= 0){
        return 0;
    }

    return getReportTransactionPrice(item) * qty;

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
        data.marketplace === "Lazada" ||
        (data.marketplace === "Shopee" && data.qtyColumn === "__SHOPEE_QTY_PER_ROW__")

            ? 1

            : (
                qtyIndex >= 0
                    ? parseSalesNumber(
                        row[qtyIndex]
                    )
                    : 0
            );

    if(data.marketplace === "Lazada"){

        /* Lazada: Harga Jual wajib dari kolom AV (unitPrice). */
        return parseLazadaUnitPrice(row[47]) * qty;

    }

    if(
        data.marketplace === "TikTok" ||
        data.marketplace === "TikTok Shop"
    ){
        /* TikTok file export: kolom SKU Subtotal After Discount. */
        return parseSalesNumber(row[15]);
    }

    if(data.marketplace === "Shopee"){
        const rule =
            SALES_MARKETPLACE_RULES[data.marketplace];
        const marketplacePrice =
            getFirstValue(
                row,
                data.headers,
                rule && rule.priceAliases ? rule.priceAliases : []
            );

        /*
           SHOPEE ONLY:
           Jika Subtotal Pesanan (kolom U pada file reguler)
           memiliki nilai > 0, gunakan subtotal tersebut.
           Jika 0 / "-" / kosong, fallback ke Harga Jual
           Master Produk x QTY.
        */
        const subtotal = parseSalesNumber(marketplacePrice);
        if(subtotal > 0){
            return subtotal;
        }

        const product = getMasterProductBySku(sku);
        const masterPrice = product
            ? (Number(product.price) || 0)
            : 0;

        return masterPrice * qty;
    }

    if(data.marketplace === "Blibli"){
        /*
           Blibli memiliki 2 format file:
           - Format 1: Harga produk di kolom I
           - Format 2: Harga produk di kolom W
           Kunci berdasarkan HEADER "Harga produk", sehingga kedua
           format terbaca tanpa memakai Master Produk dan tanpa
           mengambil "Total" order.
        */
        const blibliPriceIndex = data.headers.findIndex(function(header){
            return normalizeHeader(header) === "harga produk";
        });
        const fallbackPriceIndex = blibliPriceIndex >= 0
            ? blibliPriceIndex
            : (
                row.length > 22 && row[22] !== "" ? 22 :
                8
            );
        return parseSalesNumber(row[fallbackPriceIndex]) * qty;
    }

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
        '<option value="">'+sellerBooksSalesImportText("chooseStore")+'</option>';


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

            const sameMarketplace =
                itemId === normalizedMarketplace
                ||
                itemName === detectedMarketplace
                ||
                (
                    normalizedMarketplace === "tiktok" &&
                    (
                        itemId === "tiktok" ||
                        itemName === "tiktok shop" ||
                        itemName === "tiktokshop"
                    )
                );

            if(!sameMarketplace){
                return false;
            }

            /* Jika ada marketplace duplikat, pilih yang memiliki
               akun toko aktif agar dropdown Import tidak kosong. */
            return stores.some(function(store){
                return store.status === "active" &&
                    String(store.marketplaceId || "") === String(item.id || "");
            });

        }) ||
        marketplaces.find(function(item){
            const itemId = String(item.id || "").trim().toLowerCase();
            const itemName = String(item.name || "").trim().toLowerCase();

            return itemId === normalizedMarketplace
                || itemName === detectedMarketplace
                || (normalizedMarketplace === "tiktok" &&
                    (itemId === "tiktok" || itemName === "tiktok shop" || itemName === "tiktokshop"));
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
                sellerBooksSalesImportText("marketplaceUnknown");

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
                (sellerBooksCurrentLanguage()==="en" ? " active store accounts available." : " akun toko aktif tersedia.");

            info.style.color =
                "";

        }else{

            info.innerText =
                sellerBooksCurrentLanguage()==="en" ? "No active store accounts are available for this marketplace." : "Belum ada akun toko aktif untuk marketplace ini.";

            info.style.color =
                "#dc2626";

        }

    }

}
function updatePackingCalculation(){if(!currentSalesImport)return;const r=calculateUniquePacking(currentSalesImport),unit=Math.max(0,Number(document.getElementById("packingCostPerOrder")?.value)||0);const c=document.getElementById("uniquePackingCount"),t=document.getElementById("totalPackingImportCost"),i=document.getElementById("packingIdentifierInfo");if(c)c.innerText=r.count.toLocaleString("id-ID");if(t)t.innerText=formatRupiah(r.count*unit);if(i)i.innerText=r.column?sellerBooksSalesImportText("packingIdentity")+" "+r.column+sellerBooksSalesImportText("uniquePackingSuffix"):sellerBooksSalesImportText("packingNotFound");}
function buildSalesImportFingerprint(currentImport, storeId, transactions){
    /*
       IDENTITAS FILE/ISI IMPORT.
       Tidak bergantung pada nomor baris Excel atau waktu upload.
       Jika isi transaksi yang sama pernah tersimpan pada akun toko
       dan marketplace yang sama, import dianggap sudah pernah masuk.
    */
    const marketplace = String(
        currentImport?.marketplace || ""
    ).trim().toLowerCase();

    const store = String(storeId || "").trim().toLowerCase();

    const list = (Array.isArray(transactions) ? transactions : [])
        .map(function(item){
            return [
                String(item.sku || "").trim().toLowerCase(),
                String(item.orderId || "").trim().toLowerCase(),
                String(item.packingId || "").trim().toLowerCase(),
                Number(item.qty) || 0,
                Number(item.salesAmount) || 0
            ].join("~");
        })
        .sort();

    const source = marketplace + "|" + store + "|" + list.join("||");
    /* Hash sederhana dan stabil, cukup untuk identitas import lokal. */
    let hash = 2166136261;
    for(let i = 0; i < source.length; i++){
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return "SBIMP-" + (hash >>> 0).toString(16) + "-" + list.length;
}


function saveSalesImportData(){

    if(!currentSalesImport){
        return null;
    }

    const storeId =
        document.getElementById(
            "salesStoreAccount"
        ).value;

    const storesForImport =
        getReportStoresData();

    const store =
        storesForImport.find(function(x){
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
    ===================================================== */
    const importedAt =
        new Date().toISOString();

    const reportDate =
        getIndonesiaDateString(importedAt);

    let transactions =
        rows.map(function(row,rowIndex){

            const qty =
                currentSalesImport.marketplace === "Lazada"

                    ? 1

                    : (
                        currentSalesImport.marketplace === "Shopee" &&
                        currentSalesImport.qtyColumn === "__SHOPEE_QTY_PER_ROW__"
                            ? 1
                            : (
                                qtyIndex >= 0
                                    ? parseSalesNumber(
                                        row[qtyIndex]
                                    )
                                    : 0
                            )
                    );

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

            const transactionSku =
                skuIndex >= 0
                    ? String(row[skuIndex] || "").trim()
                    : "";

            /*
               SNAPSHOT IMPORT — ambil Master Produk dari sumber
               runtime + cloud/cache yang sudah diselaraskan.
               Nilai ini dibekukan di transaksi dan tidak boleh
               dihitung ulang dari Master Produk setelah hari berganti.
            */
            const masterProductAtImport =
                getMasterProductBySku(transactionSku);

            const adminFeeSkuSnapshot =
                masterProductAtImport &&
                masterProductAtImport.adminFeePercent !== undefined &&
                masterProductAtImport.adminFeePercent !== null &&
                masterProductAtImport.adminFeePercent !== ""
                    ? Number(masterProductAtImport.adminFeePercent)
                    : "";

            const priceSnapshot =
                qty > 0
                    ? (Number(salesAmount) || 0) / qty
                    : (masterProductAtImport ? (Number(masterProductAtImport.price) || 0) : 0);

            const costSnapshot =
                masterProductAtImport
                    ? (Number(masterProductAtImport.cost) || 0)
                    : 0;

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

                /*
                   Admin % SKU transaksi.
                   Disimpan langsung agar urutan sumber pertama
                   selalu memiliki nilai bila tersedia saat import.
                */
                adminFeeSku:
                    adminFeeSkuSnapshot,

                /*
                   Snapshot Admin % Akun saat import.
                   Field adminFeePercent tetap dipertahankan untuk
                   kompatibilitas data lama.
                */
                adminFeeAccountSnapshot:
                    store
                        ? (Number(store.feePercent) || 0)
                        : 0,

                adminFeePercent:
                    store
                        ? (Number(store.feePercent) || 0)
                        : 0,

                /* Snapshot Admin % SKU saat import. */
                adminFeeSkuSnapshot:
                    adminFeeSkuSnapshot,

                priceSnapshot:
                    priceSnapshot,

                costSnapshot:
                    costSnapshot,

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
                    currentSalesImport.marketplace === "Shopee"
                        ? (
                            String(
                                getFirstValue(
                                    row,
                                    currentSalesImport.headers,
                                    ["no. pesanan"]
                                ) || ""
                            ).trim()
                            ||
                            String(
                                getFirstValue(
                                    row,
                                    currentSalesImport.headers,
                                    ["booking sn"]
                                ) || ""
                            ).trim()
                        )
                        : (
                            rule
                                ? getFirstValue(
                                    row,
                                    currentSalesImport.headers,
                                    rule.orderAliases
                                )
                                : ""
                        ),

                packingId:
                    packingIndex >= 0
                        ? String(
                            row[packingIndex] || ""
                        ).trim()
                        : "",

                transactionDate:
                    transactionDate,

                reportDate:
                    reportDate,

                /* Penanda baris khusus Lazada agar
                   SKU yang sama dalam order yang sama
                   tidak digabung menjadi 1 transaksi. */
                sourceRowIndex:
                    currentSalesImport.marketplace === "Lazada"
                        ? rowIndex
                        : null,

                importedAt:
                    importedAt
            };

        });


    const imports =
        JSON.parse(
            sellerBooksStorage.getItem(
                "sellerbooks_sales_imports"
            ) || "[]"
        );

    /* =====================================================
       CEK FILE/ISI IMPORT SUDAH PERNAH DISIMPAN
       Jika file yang sama sudah pernah masuk untuk marketplace
       + akun toko yang sama, IMPORT DITOLAK TOTAL.
       Tidak boleh ada nilai penjualan/QTY baru yang masuk.
    ===================================================== */
    const importFingerprint =
        buildSalesImportFingerprint(
            currentSalesImport,
            storeId,
            transactions
        );

    const duplicateImport =
        imports.some(function(existingImport){
            if(
                String(existingImport.marketplace || "").trim().toLowerCase() !==
                String(currentSalesImport.marketplace || "").trim().toLowerCase()
            ){
                return false;
            }

            if(
                String(existingImport.storeId || "").trim() !==
                String(storeId || "").trim()
            ){
                return false;
            }

            if(
                existingImport.importFingerprint &&
                String(existingImport.importFingerprint) === importFingerprint
            ){
                return true;
            }

            /*
               BACKWARD COMPATIBILITY:
               record lama belum memiliki fingerprint.
               Buat fingerprint dari transaksi lama agar file
               yang sama tetap ditolak setelah update ini.
            */
            const oldFingerprint =
                buildSalesImportFingerprint(
                    {
                        marketplace: existingImport.marketplace
                    },
                    existingImport.storeId,
                    existingImport.transactions || []
                );

            return oldFingerprint === importFingerprint;
        });

    if(duplicateImport){
        console.warn(
            "Import ditolak: file/data penjualan yang sama sudah pernah disimpan.",
            importFingerprint
        );
        return null;
    }



    /* =====================================================
       UPDATE / MERGE IMPORT
       Import berikutnya tidak menggandakan transaksi lama.
       Kunci transaksi:
       Marketplace + Akun Toko + Order ID + SKU.
       Jika Order ID kosong, gunakan Packing ID + SKU.
       Transaksi yang sudah ada tetap dipertahankan;
       hanya transaksi baru yang ditambahkan.
    ===================================================== */
    const existingTransactionKeys =
        new Set();

    imports.forEach(function(existingImport){

        (existingImport.transactions || [])
            .forEach(function(existingTransaction){

                /*
                   Gunakan identity yang sama dengan Cloud Sync.
                   Khusus Lazada, sourceRowIndex ikut menjadi bagian
                   identity agar baris SKU yang sama dalam Order Number
                   yang sama tidak digabung.
                */
                const identityKey =
                    sellerBooksGetSalesImportIdentity(existingTransaction);

                if(identityKey){
                    existingTransactionKeys.add(identityKey);
                }

            });

    });


    const newTransactions =
        [];

    const incomingTransactionKeys =
        new Set();

    transactions.forEach(function(transaction){

        /*
           Gunakan identity pusat yang sama dengan Cloud Sync.
           Khusus Lazada, sourceRowIndex menjaga setiap baris Excel
           tetap terpisah meskipun Order Number + Seller SKU sama.
        */
        const identityKey =
            sellerBooksGetSalesImportIdentity(transaction);

        /*
           identityKey sekarang menjadi satu-satunya sumber kunci
           transaksi. Variabel orderKey/packingKey lama tidak lagi
           dipakai karena sudah dihapus saat penyelarasan identity.
        */
        if(
            identityKey &&
            existingTransactionKeys.has(identityKey)
        ){
            return;
        }

        /*
           Cegah baris dengan identity yang sama muncul dua kali
           dalam file import yang sedang diproses.
           Khusus Lazada, sourceRowIndex membuat setiap baris Excel
           tetap berbeda.
        */
        if(
            identityKey &&
            incomingTransactionKeys.has(identityKey)
        ){
            return;
        }

        if(identityKey){
            incomingTransactionKeys.add(identityKey);
        }

        newTransactions.push(
            transaction
        );

    });

    /*
       Jika seluruh isi file sudah pernah disimpan,
       jangan membuat record kosong/Rp0.
       Kembalikan null agar muncul:
       "Data penjualan gagal disimpan."
    */
    if(
        transactions.length > 0 &&
        newTransactions.length === 0
    ){
        return null;
    }

    transactions =
        newTransactions;


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


    /* =====================================================
       PACKING HANYA UNTUK TRANSAKSI BARU
       Satu order tetap dihitung satu kali.
    ===================================================== */
    const newPackingKeys =
        new Set();

    transactions.forEach(function(item){

        const isShopeePacking =
            String(item.marketplace || "").trim().toLowerCase() === "shopee";

        const packingKey =
            String(
                isShopeePacking
                    ? (item.packingId || "")
                    : (item.packingId || item.orderId || "")
            ).trim().toLowerCase();

        if(packingKey){
            newPackingKeys.add(
                String(item.marketplaceId || item.marketplace || "")
                    .trim().toLowerCase() + "|" +
                String(item.storeId || "")
                    .trim().toLowerCase() + "|" +
                packingKey
            );
        }

    });

    const newPackingCount =
        newPackingKeys.size;


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

        adminFeePercent:
            store
                ? (Number(store.feePercent) || 0)
                : 0,

        skuColumn:
            currentSalesImport.skuColumn,

        qtyColumn:
            currentSalesImport.qtyColumn,

        packingColumn:
            packing.column,

        uniquePackingCount:
            newPackingCount,

        packingCostPerOrder:
            packingUnit,

        totalPackingCost:
            newPackingCount *
            packingUnit,

        rowCount:
            transactions.length,

        totalSales:
            totalSales,

        totalQty:
            totalQty,

        reportDate:
            reportDate,

        importedAt:
            importedAt,

        importFingerprint:
            importFingerprint,

        transactions:
            transactions
    };


    /* =====================================================
       STOK OTOMATIS
       Hanya transaksi BARU yang dikurangi dari stok.
    ===================================================== */
    const stockResult =
        reduceProductStockFromImport(record);

    record.stockDeductedQty =
        stockResult.totalQty;


    /*
       Jika tidak ada transaksi baru, tidak perlu membuat
       record import kosong yang dapat mengganggu laporan.
    */
    if(!transactions.length){
        return null;
    }


    imports.push(record);


    sellerBooksStorage.setItem(
        "sellerbooks_sales_imports",
        JSON.stringify(imports)
    );


    sellerBooksStorage.setItem(
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

