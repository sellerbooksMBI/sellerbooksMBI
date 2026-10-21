


/* =========================================================
   SELLERBOOKS TEMPORARY REPORT PROFILER
   Profiling only. Does not alter report formulas/data flow.
   Remove this block after performance diagnosis.
========================================================= */
(function(){
    const profiler = {
        active:false,
        cycle:0,
        reset:function(){
            this.cycle += 1;
            this.storageReadMs = 0;
            this.jsonParseMs = 0;
            this.mergeMs = 0;
            this.filterMs = 0;
            this.financialMs = 0;
            this.renderMs = 0;
            this.importCount = 0;
            this.allTransactionCount = 0;
            this.filteredTransactionCount = 0;
            this.financialCalls = 0;
            this.reportCalls = 0;
            this.startedAt = performance.now();
        },
        log:function(){
            if(!this.active) return;
            const total = performance.now() - this.startedAt;
            console.groupCollapsed(
                "[SellerBooks Report Profiler] Cycle " + this.cycle
            );
            console.table({
                "Periode": document.getElementById("reportPeriod")?.value || "",
                "Marketplace": document.getElementById("reportMarketplace")?.value || "",
                "Akun Toko": document.getElementById("reportStore")?.value || "",
                "TOTAL cycle (ms)": Number(total.toFixed(2)),
                "Storage read (ms)": Number(this.storageReadMs.toFixed(2)),
                "JSON.parse (ms)": Number(this.jsonParseMs.toFixed(2)),
                "Penggabungan transaksi (ms)": Number(this.mergeMs.toFixed(2)),
                "Filter tanggal+marketplace+toko (ms)": Number(this.filterMs.toFixed(2)),
                "Perhitungan finansial (ms)": Number(this.financialMs.toFixed(2)),
                "Render updateReports (ms)": Number(this.renderMs.toFixed(2)),
                "Jumlah import": this.importCount,
                "Seluruh transaksi": this.allTransactionCount,
                "Transaksi terfilter": this.filteredTransactionCount,
                "Panggilan finansial": this.financialCalls,
                "Panggilan updateReports": this.reportCalls
            });
            console.groupEnd();
        }
    };
    window.sellerBooksReportProfiler = profiler;
})();


let sellerBooksSalesImportsCacheSource = null;
let sellerBooksSalesImportsCache = null;

function getSalesImportsData(){

    try{

        /* PATCH F: cache sumber import agar JSON.parse tidak berulang. */
        const salesImportsSource =
            sellerBooksCloudState
                ? sellerBooksCloudState.sellerbooks_sales_imports
                : undefined;

        if(
            sellerBooksSalesImportsCache !== null &&
            sellerBooksSalesImportsCacheSource === salesImportsSource
        ){
            return sellerBooksSalesImportsCache;
        }

        const storageStart = performance.now();

        const rawSalesImports =
            sellerBooksStorage.getItem(
                "sellerbooks_sales_imports"
            ) || "[]";

        const storageElapsed =
            performance.now() - storageStart;

        if(
            window.sellerBooksReportProfiler?.active
        ){
            window.sellerBooksReportProfiler.storageReadMs +=
                storageElapsed;
        }

        const parseStart = performance.now();

        const parsedSalesImports =
            JSON.parse(
                rawSalesImports
            );

        const parseElapsed =
            performance.now() - parseStart;

        if(
            window.sellerBooksReportProfiler?.active
        ){
            window.sellerBooksReportProfiler.jsonParseMs +=
                parseElapsed;
        }

        sellerBooksSalesImportsCacheSource =
            salesImportsSource;

        sellerBooksSalesImportsCache =
            Array.isArray(parsedSalesImports)
                ? parsedSalesImports
                : [];

        return sellerBooksSalesImportsCache;

    }catch(error){

        console.error(
            "Gagal membaca data import penjualan:",
            error
        );

        return [];
    }
}


let sellerBooksReportTransactionsCacheImports = null;
let sellerBooksReportTransactionsCache = null;

function getAllReportTransactions(){

    const imports =
        getSalesImportsData();

    /* PATCH F: cache hasil flatten transaksi selama sumber import sama. */
    if(
        sellerBooksReportTransactionsCache !== null &&
        sellerBooksReportTransactionsCacheImports === imports
    ){
        return sellerBooksReportTransactionsCache;
    }

    const mergeStart =
        performance.now();

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
            function(transaction, transactionIndex){

                transactions.push({

                    ...transaction,

                    importId:
                        record.id,

                    sourceTransactionIndex:
                        transactionIndex,

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

    if(
        window.sellerBooksReportProfiler?.active
    ){
        window.sellerBooksReportProfiler.mergeMs +=
            performance.now() - mergeStart;
        window.sellerBooksReportProfiler.importCount +=
            imports.length;
        window.sellerBooksReportProfiler.allTransactionCount =
            transactions.length;
    }

    sellerBooksReportTransactionsCacheImports = imports;
    sellerBooksReportTransactionsCache = transactions;

    return sellerBooksReportTransactionsCache;
}


/* =========================================================
   FILTER TANGGAL
========================================================= */

/* =========================================================
   SELLERBOOKS TIMEZONE
   Semua tanggal operasional SellerBooks wajib mengikuti WIB.
   Jangan gunakan timezone browser untuk menentukan hari.
========================================================= */
const SELLERBOOKS_TIMEZONE = "Asia/Jakarta";

function getIndonesiaDateString(value){
    if(value === null || value === undefined || value === ""){
        return null;
    }

    /*
       DATE-ONLY (YYYY-MM-DD) adalah tanggal kalender, bukan timestamp.
       Jangan kirim melalui new Date() karena browser di timezone tertentu
       dapat menggesernya ke hari sebelumnya/berikutnya.
    */
    if(typeof value === "string"){
        const dateOnly = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if(dateOnly){
            return dateOnly[1] + "-" + dateOnly[2] + "-" + dateOnly[3];
        }
    }

    const date = value instanceof Date ? value : new Date(value);
    if(isNaN(date.getTime())){ return null; }

    const parts = new Intl.DateTimeFormat("en-CA",{
        timeZone:SELLERBOOKS_TIMEZONE,
        year:"numeric",
        month:"2-digit",
        day:"2-digit"
    }).formatToParts(date);

    const map = {};
    parts.forEach(function(part){
        if(part.type !== "literal"){
            map[part.type] = part.value;
        }
    });

    if(!map.year || !map.month || !map.day){ return null; }
    return map.year + "-" + map.month + "-" + map.day;
}


/* =========================================================
   DAILY MASTER SNAPSHOT
   TODAY = LIVE / EDITABLE
   00:00 = FINAL SNAPSHOT
   HISTORICAL DAYS = LOCKED / IMMUTABLE
   Only HPP, selling price, SKU admin %, store admin %, and stock.
========================================================= */
const SELLERBOOKS_DAILY_SNAPSHOT_KEY = "sellerbooks_daily_snapshots_v1";
let sellerBooksDailySnapshotTimer = null;

function sellerBooksReadDailySnapshots(){
    try{
        const raw = sellerBooksStorage.getItem(SELLERBOOKS_DAILY_SNAPSHOT_KEY) || "{}";
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === "object"){
            if(!parsed.days || typeof parsed.days !== "object") parsed.days = {};
            return parsed;
        }
    }catch(error){}
    return {version:1,days:{}};
}

/* PATCH O: cache snapshot laporan agar JSON snapshot tidak di-parse
   ulang untuk setiap transaksi historis. Cache ini hanya mempercepat
   pembacaan data yang sama; tidak mengubah isi atau rumus bisnis. */
let sellerBooksDailySnapshotReadCacheRaw = null;
let sellerBooksDailySnapshotReadCacheState = null;

function sellerBooksReadDailySnapshots(){
    try{
        const raw = sellerBooksStorage.getItem(SELLERBOOKS_DAILY_SNAPSHOT_KEY) || "{}";

        if(
            sellerBooksDailySnapshotReadCacheState !== null &&
            sellerBooksDailySnapshotReadCacheRaw === raw
        ){
            return sellerBooksDailySnapshotReadCacheState;
        }

        const parsed = JSON.parse(raw);

        if(parsed && typeof parsed === "object"){
            if(!parsed.days || typeof parsed.days !== "object") parsed.days = {};

            sellerBooksDailySnapshotReadCacheRaw = raw;
            sellerBooksDailySnapshotReadCacheState = parsed;

            return parsed;
        }
    }catch(error){}

    sellerBooksDailySnapshotReadCacheRaw = null;
    sellerBooksDailySnapshotReadCacheState = null;
    return {version:1,days:{}};
}

function sellerBooksWriteDailySnapshots(state){
    try{
        const nextState = state || {version:1,days:{}};
        const serialized = JSON.stringify(nextState);

        sellerBooksStorage.setItem(
            SELLERBOOKS_DAILY_SNAPSHOT_KEY,
            serialized
        );

        sellerBooksDailySnapshotReadCacheRaw = serialized;
        sellerBooksDailySnapshotReadCacheState = nextState;
    }catch(error){
        console.error("Gagal menyimpan daily snapshot SellerBooks:",error);
    }
}

function sellerBooksSnapshotSkuKey(sku){
    return String(sku || "").trim().toLowerCase();
}

function sellerBooksEnsureTodaySnapshot(){
    if(typeof sellerBooksStorage === "undefined") return;
    const today = getIndonesiaTodayKey();
    if(!today) return;

    const state = sellerBooksReadDailySnapshots();
    state.version = 1;
    if(!state.days[today]){
        state.days[today] = {
            locked:false,
            products:{},
            stores:{}
        };
    }

    const day = state.days[today];
    if(day.locked) return;

    let changed = false;

    let currentProducts = [];
    try{
        currentProducts = JSON.parse(
            sellerBooksStorage.getItem("sellerbooks_products") || "[]"
        ) || [];
    }catch(error){
        currentProducts = [];
    }

    if(Array.isArray(currentProducts)){
        currentProducts.forEach(function(product){
            const key = sellerBooksSnapshotSkuKey(product && product.sku);
            if(!key || day.products[key]) return;
            day.products[key] = {
                productId: product.id || "",
                sku: product.sku || "",
                price: Number(product.price) || 0,
                cost: Number(product.cost) || 0,
                adminFeePercent:
                    product.adminFeePercent === "" ||
                    product.adminFeePercent === undefined ||
                    product.adminFeePercent === null
                        ? ""
                        : Number(product.adminFeePercent),
                stock: Math.max(0, Number(product.stock) || 0),
                capturedAt: new Date().toISOString()
            };
            changed = true;
        });
    }

    let currentStores = [];
    try{
        currentStores = JSON.parse(
            sellerBooksStorage.getItem("sellerbooks_stores") || "[]"
        ) || [];
    }catch(error){
        currentStores = [];
    }

    if(Array.isArray(currentStores)){
        currentStores.forEach(function(store){
            const key = String(store && store.id || "").trim();
            if(!key || day.stores[key]) return;
            day.stores[key] = {
                storeId: store.id || "",
                feePercent: Number(store.feePercent) || 0,
                capturedAt: new Date().toISOString()
            };
            changed = true;
        });
    }

    if(changed){
        sellerBooksWriteDailySnapshots(state);
    }
}

function sellerBooksRecordTodayProductSnapshots(){
    if(typeof sellerBooksStorage === "undefined") return;
    const today = getIndonesiaTodayKey();
    if(!today) return;

    const state = sellerBooksReadDailySnapshots();
    state.version = 1;
    if(!state.days[today]){
        state.days[today] = {
            locked:false,
            products:{},
            stores:{}
        };
    }

    const day = state.days[today];
    if(day.locked) return;

    let currentProducts = [];
    try{
        currentProducts = JSON.parse(
            sellerBooksStorage.getItem("sellerbooks_products") || "[]"
        ) || [];
    }catch(error){
        currentProducts = [];
    }

    if(!Array.isArray(currentProducts)) return;

    currentProducts.forEach(function(product){
        const key = sellerBooksSnapshotSkuKey(product && product.sku);
        if(!key) return;
        day.products[key] = {
            productId: product.id || "",
            sku: product.sku || "",
            price: Number(product.price) || 0,
            cost: Number(product.cost) || 0,
            adminFeePercent:
                product.adminFeePercent === "" ||
                product.adminFeePercent === undefined ||
                product.adminFeePercent === null
                    ? ""
                    : Number(product.adminFeePercent),
            stock: Math.max(0, Number(product.stock) || 0),
            capturedAt: new Date().toISOString()
        };
    });

    sellerBooksWriteDailySnapshots(state);
}

function sellerBooksRecordTodayStoreSnapshots(){
    if(typeof sellerBooksStorage === "undefined") return;
    const today = getIndonesiaTodayKey();
    if(!today) return;

    const state = sellerBooksReadDailySnapshots();
    state.version = 1;
    if(!state.days[today]){
        state.days[today] = {
            locked:false,
            products:{},
            stores:{}
        };
    }

    const day = state.days[today];
    if(day.locked) return;

    let currentStores = [];
    try{
        currentStores = JSON.parse(
            sellerBooksStorage.getItem("sellerbooks_stores") || "[]"
        ) || [];
    }catch(error){
        currentStores = [];
    }

    if(!Array.isArray(currentStores)) return;

    currentStores.forEach(function(store){
        const key = String(store && store.id || "").trim();
        if(!key) return;
        day.stores[key] = {
            storeId: store.id || "",
            feePercent: Number(store.feePercent) || 0,
            capturedAt: new Date().toISOString()
        };
    });

    sellerBooksWriteDailySnapshots(state);
}

function sellerBooksGetDailyProductSnapshot(sku, reportDate){
    const key = sellerBooksSnapshotSkuKey(sku);
    const dateKey = getIndonesiaDateString(reportDate);
    if(!key || !dateKey) return null;

    const state = sellerBooksReadDailySnapshots();
    const day = state.days && state.days[dateKey];
    if(!day || !day.products) return null;

    return day.products[key] || null;
}

function sellerBooksGetDailyStoreSnapshot(storeId, reportDate){
    const key = String(storeId || "").trim();
    const dateKey = getIndonesiaDateString(reportDate);
    if(!key || !dateKey) return null;

    const state = sellerBooksReadDailySnapshots();
    const day = state.days && state.days[dateKey];
    if(!day || !day.stores) return null;

    return day.stores[key] || null;
}

function sellerBooksLockPreviousDays(){
    if(typeof sellerBooksStorage === "undefined") return;
    const today = getIndonesiaTodayKey();
    if(!today) return;

    const state = sellerBooksReadDailySnapshots();
    let changed = false;

    Object.keys(state.days || {}).forEach(function(dateKey){
        if(dateKey < today && !state.days[dateKey].locked){
            state.days[dateKey].locked = true;
            changed = true;
        }
    });

    if(changed){
        sellerBooksWriteDailySnapshots(state);
    }
}

function sellerBooksRunDailySnapshotClock(){
    if(typeof sellerBooksCloudReady !== "undefined" && !sellerBooksCloudReady){
        return;
    }

    /*
       Nilai hari berjalan sudah direkam setiap kali Master Produk/Akun Toko
       disimpan. Ketika kalender masuk hari baru, bucket hari sebelumnya
       langsung menjadi immutable. Jika aplikasi sempat tertutup tepat 00:00,
       hasilnya tetap sama karena nilai terakhir sebelum 00:00 sudah tersimpan.
    */
    sellerBooksEnsureTodaySnapshot();
    sellerBooksLockPreviousDays();
}

function sellerBooksStartDailySnapshotClock(){
    sellerBooksRunDailySnapshotClock();

    if(sellerBooksDailySnapshotTimer){
        clearInterval(sellerBooksDailySnapshotTimer);
    }

    sellerBooksDailySnapshotTimer = setInterval(
        sellerBooksRunDailySnapshotClock,
        30000
    );
}


function getIndonesiaTodayKey(){
    return getIndonesiaDateString(new Date());
}

function getIndonesiaTodayDate(){
    const todayString = getIndonesiaDateString(new Date());
    if(!todayString){ return null; }
    return new Date(todayString + "T00:00:00");
}

function getLocalDateString(date){
    return date.getFullYear() + "-" +
        String(date.getMonth()+1).padStart(2,"0") + "-" +
        String(date.getDate()).padStart(2,"0");
}

function getReportDateOnly(value){
    if(!value){ return null; }

    /*
       Semua hasil dinormalisasi menjadi tanggal kalender WIB.
       Object Date yang dikembalikan tetap memakai local midnight hanya
       sebagai wadah tanggal; nilai kalendernya sudah ditentukan oleh WIB.
    */
    const indonesiaDate = getIndonesiaDateString(value);
    if(!indonesiaDate){ return null; }

    const parts = indonesiaDate.split("-");
    return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );
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

    const today = getIndonesiaTodayDate();

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

    const today = getIndonesiaTodayDate();
    const maxDate = getLocalDateString(today);
    const minDate = getLocalDateString(new Date(today.getFullYear(), today.getMonth()-2, 1));
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
                sellerBooksStorage.getItem("sellerbooks_marketplaces") || "[]"
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
                sellerBooksStorage.getItem("sellerbooks_stores") || "[]"
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

async function deleteReportsByDateRange(){
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
        sellerBooksAlert(sellerBooksReportsText("deleteRequired"));
        return;
    }

    const from = getReportDateOnly(fromValue);
    const to = getReportDateOnly(toValue);

    if(!from || !to){
        sellerBooksAlert(sellerBooksReportsText("invalidRange"));
        return;
    }

    if(from > to){
        sellerBooksAlert(sellerBooksReportsText("invalidOrder"));
        return;
    }

    const today = getIndonesiaTodayDate();

    const minDate =
        new Date(
            today.getFullYear(),
            today.getMonth()-2,
            1
        );

    if(from < minDate || to > today){
        sellerBooksAlert(
            sellerBooksReportsText("deleteRangeLimit")
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
        sellerBooksAlert(
            sellerBooksReportsText("noDeleteMatch")
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
        await sellerBooksConfirm(
            sellerBooksReportsText("deleteConfirmTitle") + "\n\n" +
            sellerBooksReportsText("range") + ": " + fromText + " " + (sellerBooksCurrentLanguage()==="en" ? "to" : "s/d") + " " + toText + "\n" +
            "Marketplace: " + marketplaceSelectText + "\n" +
            sellerBooksReportsText("storeAccount") + ": " + storeSelectText + "\n" +
            sellerBooksReportsText("importCount") + ": " + deleted +
            "\n\n" +
            sellerBooksReportsText("deleteOnlyMatching") + "\n" +
            sellerBooksReportsText("stockRestore") + "\n\n" +
            sellerBooksReportsText("cannotUndo")
        );

    if(!confirmed){
        return;
    }

    /*
       Hapus laporan periode tanpa pop-up progress.
       Pop-up progress tetap dipakai untuk proses Master Produk.
       Kembalikan stok TERLEBIH DAHULU berdasarkan import yang
       benar-benar akan dihapus. Setelah itu baru hapus laporan.
    */
    const stockRestoreResult =
        restoreProductStockFromDeletedImports(
            deletedImports
        );

    /* Setelah hapus periode, fingerprint file asal tidak boleh
       menghalangi import ulang untuk transaksi yang benar-benar dihapus. */
    remaining.forEach(function(record){
        if(record && Array.isArray(record.transactions))delete record.importFingerprint;
    });
    sellerBooksStorage.setItem(
        "sellerbooks_sales_imports",
        JSON.stringify(remaining)
    );

    updateReports();

    let cloudConfirmed=false;
    try{
        if(!sellerBooksAuthUser || !sellerBooksCloudReady || sellerBooksCloudLoading){
            throw new Error("cloud_not_ready");
        }
        if(typeof sellerBooksCloudSaveTimer !== "undefined" && sellerBooksCloudSaveTimer){
            clearTimeout(sellerBooksCloudSaveTimer);
            sellerBooksCloudSaveTimer = null;
        }
        const expectedSnapshot=sellerBooksCloneCloudState(sellerBooksCloudState);
        await sellerBooksPersistCloudDataStrict(expectedSnapshot);
        if(sellerBooksCloudDirtyKeys && sellerBooksCloudDirtyKeys.size){
            throw new Error("cloud_save_unconfirmed");
        }
        cloudConfirmed=true;    }catch(error){
        console.error("Penghapusan laporan periode belum terkonfirmasi di cloud:",error);
        sellerBooksAlert(sellerBooksCurrentLanguage()==="en"
            ? "The report deletion could not be confirmed in the cloud. Please check the data before repeating the deletion."
            : "Penghapusan laporan belum dapat dikonfirmasi di cloud. Periksa data sebelum mengulangi penghapusan.");
    }
    if(!cloudConfirmed)return;

    sellerBooksAlert(
        sellerBooksReportsText("deleteSuccess") + "\n" +
        deleted + " " + sellerBooksReportsText("deletedCount") +
        (
            stockRestoreResult.restoredQty > 0
                ? "\n\n" + sellerBooksReportsText("restoredStock") + " " +
                  stockRestoreResult.restoredQty +
                  " " + sellerBooksReportsText("pcs")
                : "\n\n" + sellerBooksReportsText("noStockRestore")
        )
    );
}


/* =========================================================
   AMBIL DATA SESUAI FILTER
========================================================= */

/* PATCH L: cache hasil filter transaksi Laporan dan hasil agregasi Rincian.
   Cache hanya berlaku selama sumber transaksi dan filter tetap sama. */
let sellerBooksReportFilteredTransactionsCache = {
    sourceTransactions:null,
    key:"",
    transactions:null
};

let sellerBooksProductAnalysisRowsCache = {
    sourceTransactions:null,
    key:"",
    rows:null
};

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


    const filterStart =
        performance.now();

    const transactions =
        getAllReportTransactions();

    const cacheKey = [
        period,
        marketplaceId,
        storeId
    ].join("|");

    if(
        sellerBooksReportFilteredTransactionsCache.sourceTransactions === transactions &&
        sellerBooksReportFilteredTransactionsCache.key === cacheKey &&
        Array.isArray(sellerBooksReportFilteredTransactionsCache.transactions)
    ){
        const cachedTransactions =
            sellerBooksReportFilteredTransactionsCache.transactions;

        if(window.sellerBooksReportProfiler?.active){
            window.sellerBooksReportProfiler.filteredTransactionCount =
                cachedTransactions.length;
        }

        return cachedTransactions;
    }

    const filteredTransactions =
        transactions.filter(
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

    sellerBooksReportFilteredTransactionsCache = {
        sourceTransactions: transactions,
        key: cacheKey,
        transactions: filteredTransactions
    };

    if(
        window.sellerBooksReportProfiler?.active
    ){
        window.sellerBooksReportProfiler.filterMs +=
            performance.now() - filterStart;
        window.sellerBooksReportProfiler.filteredTransactionCount =
            filteredTransactions.length;
    }

    return filteredTransactions;
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
                sellerBooksStorage.getItem(
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

                /*
                   Gunakan HPP snapshot transaksi yang sudah dibuat
                   oleh mesin Import Penjualan. Jangan mengambil
                   Master Produk terbaru untuk transaksi historis.
                */
                const hppPerUnit =
                    getReportTransactionCost(item);


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
            sellerBooksStorage.getItem(
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
            sellerBooksStorage.getItem(
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
            sellerBooksStorage.getItem("sellerbooks_costs") || "[]"
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
            sellerBooksStorage.getItem("sellerbooks_costs") || "[]"
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
   BIAYA ADMIN TRANSAKSI
   Import baru menyimpan snapshot admin akun toko.
   Data lama tetap fallback ke pengaturan akun toko.
========================================================= */

function isReportTransactionToday(transaction){

    if(!transaction){
        return true;
    }

    const transactionDate =
        transaction.reportDate ||
        transaction.importedAt ||
        transaction.transactionDate ||
        "";

    const reportDate =
        getIndonesiaDateString(transactionDate);

    const today =
        getIndonesiaDateString(new Date());

    return !reportDate || reportDate === today;
}

/*
   SNAPSHOT HARIAN:
   - Transaksi hari ini masih mengikuti Master Produk terbaru.
   - Begitu tanggal berganti 00:00 WIB, transaksi kemarin memakai
     nilai snapshot yang disimpan saat import dan tidak lagi ikut
     perubahan Master Produk.
*/
function getReportTransactionCost(transaction){

    if(!transaction){
        return 0;
    }

    if(!isReportTransactionToday(transaction)){
        const historicalProduct =
            sellerBooksGetDailyProductSnapshot(
                transaction.sku,
                transaction.reportDate || transaction.importedAt
            );

        /*
           SNAPSHOT HARIAN:
           Prioritas utama adalah nilai TERAKHIR Master Produk
           pada hari transaksi, bukan nilai saat import pertama.
        */
        if(
            historicalProduct &&
            Object.prototype.hasOwnProperty.call(historicalProduct,"cost")
        ){
            return Number(historicalProduct.cost) || 0;
        }

        /*
           Kompatibilitas transaksi lama yang belum memiliki
           daily snapshot baru.
        */
        if(
            transaction.costSnapshot !== undefined &&
            transaction.costSnapshot !== null &&
            transaction.costSnapshot !== ""
        ){
            const snapshotCost = Number(transaction.costSnapshot);
            if(Number.isFinite(snapshotCost)){
                return snapshotCost;
            }
        }
    }

    const product = getMasterProductBySku(transaction.sku);
    return product ? (Number(product.cost) || 0) : 0;
}

function getReportTransactionPrice(transaction){

    if(!transaction){
        return 0;
    }

    if(!isReportTransactionToday(transaction)){
        const historicalProduct =
            sellerBooksGetDailyProductSnapshot(
                transaction.sku,
                transaction.reportDate || transaction.importedAt
            );

        /*
           SNAPSHOT HARIAN:
           Gunakan harga jual TERAKHIR pada hari transaksi.
        */
        if(
            historicalProduct &&
            Object.prototype.hasOwnProperty.call(historicalProduct,"price")
        ){
            return Number(historicalProduct.price) || 0;
        }

        if(
            transaction.priceSnapshot !== undefined &&
            transaction.priceSnapshot !== null &&
            transaction.priceSnapshot !== ""
        ){
            const snapshotPrice = Number(transaction.priceSnapshot);
            if(Number.isFinite(snapshotPrice)){
                return snapshotPrice;
            }
        }
    }

    const product = getMasterProductBySku(transaction.sku);
    return product ? (Number(product.price) || 0) : 0;
}

function getReportTransactionFeePercent(transaction){

    /*
       SNAPSHOT HARIAN — ADMIN FEE
       - Transaksi hari ini boleh mengikuti Master Produk terbaru.
       - Setelah tanggal berganti, transaksi lama memakai nilai fee
         yang tersimpan saat transaksi/import dibuat.
       - Edit Admin % SKU di Master Produk TIDAK mengubah hari sebelumnya.
       - API tidak diubah; adapter tetap mengirim data transaksi yang sama.
    */

    if(!transaction){
        return 0;
    }

    const transactionIsToday =
        isReportTransactionToday(transaction);

    /*
       TRANSAKSI LAMA:
       Prioritaskan snapshot yang sudah tersimpan.
       adminFeePercent adalah snapshot Admin % Akun lama dan tetap
       dipertahankan untuk kompatibilitas transaksi sebelum field snapshot
       baru tersedia.
    */
    if(!transactionIsToday){

        const historicalProduct =
            sellerBooksGetDailyProductSnapshot(
                transaction.sku,
                transaction.reportDate || transaction.importedAt
            );

        /*
           SNAPSHOT HARIAN:
           Admin % SKU memakai nilai TERAKHIR Master Produk
           pada hari transaksi. Nilai 0% tetap dianggap valid.
        */
        if(
            historicalProduct &&
            Object.prototype.hasOwnProperty.call(historicalProduct,"adminFeePercent")
        ){
            const dailySkuFee = historicalProduct.adminFeePercent;
            if(
                dailySkuFee !== "" &&
                dailySkuFee !== null &&
                dailySkuFee !== undefined &&
                Number.isFinite(Number(dailySkuFee))
            ){
                return Number(dailySkuFee);
            }
        }

        const historicalStore =
            sellerBooksGetDailyStoreSnapshot(
                transaction.storeId,
                transaction.reportDate || transaction.importedAt
            );

        /*
           Jika Admin % SKU tidak tersedia, gunakan Admin % Akun Toko
           TERAKHIR pada hari transaksi. Nilai 0% tetap valid.
        */
        if(
            historicalStore &&
            Object.prototype.hasOwnProperty.call(historicalStore,"feePercent")
        ){
            const dailyAccountFee = Number(historicalStore.feePercent);
            if(Number.isFinite(dailyAccountFee)){
                return dailyAccountFee;
            }
        }

        const historicalSkuFee =
            transaction.adminFeeSkuSnapshot !== undefined &&
            transaction.adminFeeSkuSnapshot !== null &&
            transaction.adminFeeSkuSnapshot !== ""
                ? Number(transaction.adminFeeSkuSnapshot)
                : NaN;

        if(Number.isFinite(historicalSkuFee) && historicalSkuFee > 0){
            return historicalSkuFee;
        }

        const historicalAccountSnapshot =
            transaction.adminFeeAccountSnapshot !== undefined &&
            transaction.adminFeeAccountSnapshot !== null &&
            transaction.adminFeeAccountSnapshot !== ""
                ? Number(transaction.adminFeeAccountSnapshot)
                : NaN;

        if(Number.isFinite(historicalAccountSnapshot) && historicalAccountSnapshot > 0){
            return historicalAccountSnapshot;
        }

        const legacyAccountSnapshot =
            transaction.adminFeePercent !== undefined &&
            transaction.adminFeePercent !== null &&
            transaction.adminFeePercent !== ""
                ? Number(transaction.adminFeePercent)
                : NaN;

        if(Number.isFinite(legacyAccountSnapshot) && legacyAccountSnapshot > 0){
            return legacyAccountSnapshot;
        }
    }

    /*
       HARI INI:
       1. Admin % SKU Master Produk TERBARU
       2. Admin % SKU transaksi sebagai fallback
       3. Snapshot Admin % SKU sebagai fallback
       4. Snapshot Admin % Akun
       5. Admin % Akun Toko

       PATCH P:
       Selama transaksi masih termasuk hari ini, Master Produk adalah
       sumber utama Admin % SKU. Snapshot historis dan transaksi lama
       tidak disentuh.
    */
    const transactionSku =
        String(transaction.sku || "")
            .trim()
            .toLowerCase();

    if(transactionSku){

        let masterProduct = null;

        try{
            const latestProducts =
                JSON.parse(
                    sellerBooksStorage.getItem(
                        "sellerbooks_products"
                    ) || "[]"
                );

            if(Array.isArray(latestProducts)){
                masterProduct =
                    latestProducts.find(function(product){
                        return String(product.sku || "")
                            .trim()
                            .toLowerCase() === transactionSku;
                    }) || null;
            }
        }catch(error){
            masterProduct = null;
        }

        if(!masterProduct && Array.isArray(products)){
            masterProduct =
                products.find(function(product){
                    return String(product.sku || "")
                        .trim()
                        .toLowerCase() === transactionSku;
                }) || null;
        }

        if(masterProduct){

            const masterSkuFee =
                masterProduct.adminFeePercent !== undefined &&
                masterProduct.adminFeePercent !== null &&
                masterProduct.adminFeePercent !== ""
                    ? Number(masterProduct.adminFeePercent)
                    : NaN;

            if(Number.isFinite(masterSkuFee)){
                return masterSkuFee;
            }
        }
    }


    const transactionSkuFee =
        transaction.adminFeeSku !== undefined &&
        transaction.adminFeeSku !== null &&
        transaction.adminFeeSku !== ""
            ? Number(transaction.adminFeeSku)
            : NaN;

    if(Number.isFinite(transactionSkuFee) && transactionSkuFee > 0){
        return transactionSkuFee;
    }

    const snapshotSkuFee =
        transaction.adminFeeSkuSnapshot !== undefined &&
        transaction.adminFeeSkuSnapshot !== null &&
        transaction.adminFeeSkuSnapshot !== ""
            ? Number(transaction.adminFeeSkuSnapshot)
            : NaN;

    if(Number.isFinite(snapshotSkuFee) && snapshotSkuFee > 0){
        return snapshotSkuFee;
    }

    const accountSnapshotValue =
        transaction.adminFeeAccountSnapshot !== undefined &&
        transaction.adminFeeAccountSnapshot !== null &&
        transaction.adminFeeAccountSnapshot !== ""
            ? transaction.adminFeeAccountSnapshot
            : transaction.adminFeePercent;

    const accountSnapshotFee =
        accountSnapshotValue !== undefined &&
        accountSnapshotValue !== null &&
        accountSnapshotValue !== ""
            ? Number(accountSnapshotValue)
            : NaN;

    if(Number.isFinite(accountSnapshotFee) && accountSnapshotFee > 0){
        return accountSnapshotFee;
    }

    return getReportStoreFeePercent(
        transaction.storeId
    );
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
           TOTAL PACKING HARUS MENGIKUTI LOGIKA
           YANG SAMA DENGAN TABEL PERFORMA MARKETPLACE.
           Jangan gunakan fallback importId + SKU karena
           itu membuat total packing berbeda dari tabel.
        */
        if(!packingId){
            packingId =
                String(
                    item.orderId || ""
                ).trim();
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

    const financialStart =
        performance.now();

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
                sellerBooksStorage.getItem(
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

            /*
               HPP historis wajib mengikuti snapshot transaksi
               yang dibuat saat Import Penjualan.
               Master Produk terbaru tidak boleh mengubah
               HPP transaksi yang sudah terjadi.
            */
            totalHpp +=
                getReportTransactionCost(item) *
                qty;

        }


        /*
           BIAYA ADMIN TOKO
        */

        const feePercent =
            getReportTransactionFeePercent(item);


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


    if(
        window.sellerBooksReportProfiler?.active
    ){
        window.sellerBooksReportProfiler.financialMs +=
            performance.now() - financialStart;
        window.sellerBooksReportProfiler.financialCalls += 1;
    }

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

            const fee = getReportTransactionFeePercent(item);
            group.admin += sales * fee / 100;

            const product = getMasterProductBySku(item.sku);
            if(product){
                group.hpp += getReportTransactionCost(item) * qty;
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

            const fee = getReportTransactionFeePercent(item);
            group.admin += sales * fee / 100;

            const product = getMasterProductBySku(item.sku);
            if(product){
                group.hpp += getReportTransactionCost(item) * qty;
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
   DETAIL TRANSAKSI - STATE PAGINATION
========================================================= */
let reportTransactionPage = 1;
let reportTransactionPageSize = 20;
let reportTransactionPaginationFilterKey = "";
const selectedReportTransactionKeys = new Set();

/* =========================================================
   DETAIL TRANSAKSI
========================================================= */

function renderReportTransactionTable(){

    const body = document.getElementById("reportTransactionBody");
    const pagination = document.getElementById("reportTransactionPagination");
    const paginationControls = document.getElementById("reportTransactionPaginationControls");
    const pageSizeSelect = document.getElementById("reportTransactionPageSize");

    if(!body) return;

    try{
        const transactions = getFilteredReportTransactions();

        /* Jika filter berubah, kembali ke halaman pertama. */
        const period = document.getElementById("reportPeriod")?.value || "";
        const marketplace = document.getElementById("reportMarketplace")?.value || "";
        const store = document.getElementById("reportStore")?.value || "";
        const dateFrom = document.getElementById("reportDateFrom")?.value || "";
        const dateTo = document.getElementById("reportDateTo")?.value || "";
        const filterKey = [period, marketplace, store, dateFrom, dateTo].join("|");

        if(reportTransactionPaginationFilterKey !== filterKey){
            reportTransactionPage = 1;
            reportTransactionPaginationFilterKey = filterKey;
            selectedReportTransactionKeys.clear();
        }

        if(!transactions.length){
            body.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:35px;color:#64748b;">Belum ada data penjualan.</td></tr>`;
            if(pagination){ pagination.style.display = "none"; }
            updateSelectedReportTransactionUI();
            return;
        }

        if(!Number.isFinite(reportTransactionPageSize) || reportTransactionPageSize < 1){
            reportTransactionPageSize = 20;
        }

        const totalPages = Math.max(1, Math.ceil(transactions.length / reportTransactionPageSize));

        if(reportTransactionPage > totalPages){
            reportTransactionPage = totalPages;
        }
        if(reportTransactionPage < 1){
            reportTransactionPage = 1;
        }

        if(pageSizeSelect){
            pageSizeSelect.value = String(reportTransactionPageSize);
        }

        const startIndex = (reportTransactionPage - 1) * reportTransactionPageSize;
        const endIndex = Math.min(startIndex + reportTransactionPageSize, transactions.length);
        const visibleTransactions = transactions.slice(startIndex, endIndex);

        let html = "";

        visibleTransactions.forEach(function(item){
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
            const status = product ? "✓ Valid" : "⚠ SKU belum ada";

            const selectionKey = getReportTransactionSelectionKey(item);
            const isSelected = selectedReportTransactionKeys.has(selectionKey);
            html += `
                <tr>
                    <td class="report-transaction-select-column"><input type="checkbox" class="report-transaction-row-checkbox" value="${escapeHtml(selectionKey)}" ${isSelected ? "checked" : ""} aria-label="Pilih transaksi ${escapeHtml(String(item.orderId || sku || ""))}" onchange="toggleReportTransactionSelection(this)"></td>
                    <td>${escapeHtml(formattedDate)}</td>
                    <td>${escapeHtml(item.marketplace || "-")}</td>
                    <td>${escapeHtml(item.storeName || "-")}</td>
                    <td>${escapeHtml(String(item.orderId || "-"))}</td>
                    <td>${escapeHtml(String(item.externalOrderId || item.tiktok_order_id || item.orderId || "-"))}</td>
                    <td>${escapeHtml(sku || "-")}</td>
                    <td>${Number(item.qty) || 0}</td>
                    <td>${formatRupiah(getReportTransactionSalesAmount(item))}</td>
                    <td>${status}</td>
                </tr>
            `;
        });

        body.innerHTML = html;
        updateSelectedReportTransactionUI();

        if(pagination){
            pagination.style.display = "flex";
        }

        if(paginationControls){
            let controlsHtml = "";

            controlsHtml += `
                <span class="report-transaction-page-info">
                    ${startIndex + 1}-${endIndex} dari ${transactions.length}
                </span>
            `;

            controlsHtml += `
                <button
                    type="button"
                    class="report-transaction-page-button"
                    onclick="goToReportTransactionPage(${reportTransactionPage - 1})"
                    ${reportTransactionPage <= 1 ? "disabled" : ""}
                    aria-label="${sellerBooksProductText("previous")}"
                >
                    ‹
                </button>
            `;

            /* Maksimal 7 nomor halaman sekaligus agar tetap ringkas. */
            const maxButtons = 7;
            let pageStart = Math.max(1, reportTransactionPage - 3);
            let pageEnd = Math.min(totalPages, pageStart + maxButtons - 1);
            pageStart = Math.max(1, pageEnd - maxButtons + 1);

            if(pageStart > 1){
                controlsHtml += `<button type="button" class="report-transaction-page-button" onclick="goToReportTransactionPage(1)">1</button>`;
                if(pageStart > 2){
                    controlsHtml += `<span class="report-transaction-page-info">...</span>`;
                }
            }

            for(let page = pageStart; page <= pageEnd; page++){
                controlsHtml += `
                    <button
                        type="button"
                        class="report-transaction-page-button ${page === reportTransactionPage ? "active" : ""}"
                        onclick="goToReportTransactionPage(${page})"
                        aria-current="${page === reportTransactionPage ? "page" : "false"}"
                    >
                        ${page}
                    </button>
                `;
            }

            if(pageEnd < totalPages){
                if(pageEnd < totalPages - 1){
                    controlsHtml += `<span class="report-transaction-page-info">...</span>`;
                }
                controlsHtml += `<button type="button" class="report-transaction-page-button" onclick="goToReportTransactionPage(${totalPages})">${totalPages}</button>`;
            }

            controlsHtml += `
                <button
                    type="button"
                    class="report-transaction-page-button"
                    onclick="goToReportTransactionPage(${reportTransactionPage + 1})"
                    ${reportTransactionPage >= totalPages ? "disabled" : ""}
                    aria-label="Halaman berikutnya"
                >
                    Next ›
                </button>
            `;

            paginationControls.innerHTML = controlsHtml;
        }

    }catch(error){
        console.error("Gagal menampilkan Detail Penjualan:", error);
        body.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:35px;color:#dc2626;">Detail penjualan gagal ditampilkan. Silakan refresh halaman.</td></tr>`;
        if(pagination){ pagination.style.display = "none"; }
    }
}

function getReportTransactionSelectionKey(item){
    return String(item && item.importId || "") + "::" + String(item && item.sourceTransactionIndex);
}
function updateSelectedReportTransactionUI(){
    const wrap=document.getElementById("reportTransactionBulkActions");
    const count=document.getElementById("selectedReportTransactionCount");
    const label=document.getElementById("selectedReportTransactionLabel");
    const n=selectedReportTransactionKeys.size;
    if(wrap)wrap.style.display=n>0?"flex":"none";
    if(count)count.textContent=String(n);
    if(label)label.textContent=n?(sellerBooksCurrentLanguage()==="en"?"selected":"dipilih"):"";
    const all=document.getElementById("selectAllReportTransactions");
    const boxes=Array.from(document.querySelectorAll("#reportTransactionBody .report-transaction-row-checkbox"));
    if(all){const checked=boxes.filter(x=>x.checked).length;all.checked=boxes.length>0&&checked===boxes.length;all.indeterminate=checked>0&&checked<boxes.length;}
}
function toggleReportTransactionSelection(box){
    if(!box)return;
    if(box.checked)selectedReportTransactionKeys.add(box.value);else selectedReportTransactionKeys.delete(box.value);
    updateSelectedReportTransactionUI();
}
function toggleSelectAllReportTransactions(box){
    if(!box)return;
    document.querySelectorAll("#reportTransactionBody .report-transaction-row-checkbox").forEach(function(row){
        row.checked=box.checked;
        if(box.checked)selectedReportTransactionKeys.add(row.value);else selectedReportTransactionKeys.delete(row.value);
    });
    updateSelectedReportTransactionUI();
}
async function deleteSelectedReportTransactions(){
    const keys=new Set(selectedReportTransactionKeys);
    if(!keys.size){sellerBooksAlert(sellerBooksCurrentLanguage()==="en"?"Please select at least one transaction row.":"Pilih minimal satu baris transaksi.");return;}
    const prompt=(sellerBooksCurrentLanguage()==="en"?"Permanently delete {count} selected transaction rows? This cannot be undone.":"Hapus permanen {count} baris transaksi yang dipilih? Tindakan ini tidak dapat dibatalkan.").replace("{count}",String(keys.size));
    if(!await sellerBooksConfirm(prompt))return;

    const imports=getSalesImportsData();
    const deletedRefs=[];
    const stockRestoreRecords=[];
    imports.forEach(function(record){
        if(!record||!Array.isArray(record.transactions))return;
        const indexes=[];
        record.transactions.forEach(function(transaction,index){if(keys.has(String(record.id||"")+"::"+String(index)))indexes.push(index);});
        if(!indexes.length)return;
        const indexSet=new Set(indexes);
        const selectedTransactions=indexes.map(function(index){return record.transactions[index];});
        indexes.forEach(function(index){deletedRefs.push(String(record.id||"")+"::"+String(index));});
        if(Array.isArray(record.stockDeductionDetails)){
            const remainingDetails=record.stockDeductionDetails.map(function(detail){return Object.assign({},detail);});
            const selectedDetails=[];
            selectedTransactions.forEach(function(transaction){
                const sku=String(transaction&&transaction.sku||"").trim().toLowerCase();
                let needed=Math.max(0,Number(transaction&&transaction.qty)||0);
                if(!sku||needed<=0)return;
                remainingDetails.forEach(function(detail){
                    if(needed<=0||String(detail&&detail.sku||"").trim().toLowerCase()!==sku)return;
                    const available=Math.max(0,Number(detail&&detail.deductedQty)||0);
                    if(available<=0)return;
                    const amount=Math.min(needed,available);detail.deductedQty=available-amount;needed-=amount;
                    const found=selectedDetails.find(function(entry){return String(entry.productId||"")===String(detail.productId||"")&&String(entry.sku||"").trim().toLowerCase()===sku;});
                    if(found)found.deductedQty+=amount;else selectedDetails.push({productId:detail.productId||"",sku:detail.sku||transaction.sku,deductedQty:amount});
                });
            });
            stockRestoreRecords.push({id:String(record.id||"")+"__selected_rows",transactions:selectedTransactions,stockDeductionDetails:selectedDetails});
            record.stockDeductionDetails=remainingDetails.filter(function(detail){return (Number(detail&&detail.deductedQty)||0)>0;});
        }else stockRestoreRecords.push({id:String(record.id||"")+"__selected_rows",transactions:selectedTransactions});
        record.transactions=record.transactions.filter(function(transaction,index){return !indexSet.has(index);});

        /*
           HAPUS CHECKBOX: perbarui fingerprint setelah sebagian baris dihapus.
           Fingerprint lama mewakili SELURUH file import sebelum penghapusan.
           Jika dibiarkan, import ulang file yang sama akan ditolak sebagai
           duplikat meskipun baris terpilih sudah dihapus dari transaksi.
           Fingerprint baru hanya mewakili transaksi yang masih tersimpan;
           baris yang dihapus dapat diimpor kembali, sementara baris lain
           tetap dilindungi oleh pemeriksaan identitas transaksi.
        */
        if(record.transactions.length > 0 && typeof buildSalesImportFingerprint === "function"){
            record.importFingerprint = buildSalesImportFingerprint(
                { marketplace: record.marketplace },
                record.storeId,
                record.transactions
            );
        }
    });
    if(!deletedRefs.length){selectedReportTransactionKeys.clear();renderReportTransactionTable();return;}
    if(!deletedRefs.length){
        selectedReportTransactionKeys.clear();
        sellerBooksReportTransactionsCacheImports=null;
        sellerBooksReportTransactionsCache=null;
        renderReportTransactionTable();
        return;
    }
    const stockResult=restoreProductStockFromDeletedImports(stockRestoreRecords);
    const remainingImports=imports.filter(function(record){return Array.isArray(record.transactions)&&record.transactions.length>0;});
    /* Baris yang dihapus harus bisa diimpor kembali. Fingerprint file lama
       tidak boleh memblokir baris yang sudah dihapus; identity transaksi
       tetap mencegah baris yang masih ada menjadi duplikat. */
    remainingImports.forEach(function(record){
        if(record && Array.isArray(record.transactions))delete record.importFingerprint;
    });
    sellerBooksStorage.setItem("sellerbooks_sales_imports",JSON.stringify(remainingImports));
    selectedReportTransactionKeys.clear();
    sellerBooksReportTransactionsCacheImports=null;sellerBooksReportTransactionsCache=null;
    sellerBooksReportFilteredTransactionsCache={sourceTransactions:null,key:"",transactions:null};
    sellerBooksProductAnalysisRowsCache={sourceTransactions:null,key:"",rows:null};
    updateReports();
    const en=sellerBooksCurrentLanguage()==="en";
    try{
        if(typeof sellerBooksCloudSaveTimer!=="undefined" && sellerBooksCloudSaveTimer){
            clearTimeout(sellerBooksCloudSaveTimer);
            sellerBooksCloudSaveTimer=null;
        }
        const expectedSnapshot=sellerBooksCloneCloudState(sellerBooksCloudState);
        await sellerBooksPersistCloudDataStrict(expectedSnapshot,function(savedData){
            let savedImports=[];
            try{savedImports=JSON.parse(savedData["sellerbooks_sales_imports"]||"[]")||[];}catch(error){return false;}
            const savedKeys=new Set();
            savedImports.forEach(function(record){
                (record.transactions||[]).forEach(function(transaction,index){
                    savedKeys.add(String(record.id||"")+"::"+String(index));
                });
            });
            return deletedRefs.every(function(ref){return !savedKeys.has(ref);});
        });
    }catch(error){
        console.error("Penghapusan checkbox belum terkonfirmasi tersimpan di cloud:",error);
        sellerBooksAlert(en
            ? "The deletion could not be confirmed in the cloud. Please check the report before repeating it."
            : "Penghapusan belum dapat dikonfirmasi tersimpan di cloud. Periksa laporan sebelum mengulang penghapusan.");
        return;
    }
    sellerBooksAlert((en?"Selected transaction rows deleted successfully.":"Baris transaksi terpilih berhasil dihapus.")+"\n"+deletedRefs.length+(en?" transaction rows deleted.":" baris transaksi dihapus.")+(stockResult.restoredQty>0?"\n\n"+(en?"Stock restored:":"Stok dikembalikan:")+" "+stockResult.restoredQty+" pcs.":""));
}
function goToReportTransactionPage(page){
    const transactions = getFilteredReportTransactions();
    const totalPages = Math.max(1, Math.ceil(transactions.length / reportTransactionPageSize));

    reportTransactionPage = Math.min(
        Math.max(1, Number(page) || 1),
        totalPages
    );

    renderReportTransactionTable();
}

function changeReportTransactionPageSize(value){
    const parsed = Number(value);
    reportTransactionPageSize = [20,40,50,80,100].includes(parsed) ? parsed : 20;
    reportTransactionPage = 1;
    renderReportTransactionTable();
}


/* =========================================================
   SELLERBOOKS - DOWNLOAD PDF LAPORAN
   Mengikuti filter Periode + Marketplace + Akun Toko
========================================================= */

let sellerBooksPdfLibrariesPromise = null;

function sellerBooksLoadPdfLibraries(){
    if(window.jspdf && window.jspdf.jsPDF && window.jspdfAutoTableLoaded){
        return Promise.resolve();
    }

    if(sellerBooksPdfLibrariesPromise){
        return sellerBooksPdfLibrariesPromise;
    }

    sellerBooksPdfLibrariesPromise = new Promise(function(resolve,reject){

        function loadScript(src, done){
            const existing = document.querySelector('script[data-sellerbooks-pdf="' + src + '"]');

            if(existing){
                if(existing.dataset.loaded === "true"){
                    done();
                    return;
                }

                existing.addEventListener("load", done, {once:true});
                existing.addEventListener("error", function(){
                    reject(new Error("Gagal memuat library PDF."));
                }, {once:true});
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.dataset.sellerbooksPdf = src;

            script.onload = function(){
                script.dataset.loaded = "true";
                done();
            };

            script.onerror = function(){
                reject(new Error("Gagal memuat library PDF."));
            };

            document.head.appendChild(script);
        }

        loadScript(
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
            function(){
                loadScript(
                    "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
                    function(){
                        window.jspdfAutoTableLoaded = true;
                        resolve();
                    }
                );
            }
        );
    });

    return sellerBooksPdfLibrariesPromise;
}

function sellerBooksPdfFormatDateNow(){
    const language =
        typeof sellerBooksCurrentLanguage === "function" &&
        sellerBooksCurrentLanguage() === "en" ? "en-US" : "id-ID";

    try{
        return new Intl.DateTimeFormat(language,{
            year:"numeric",
            month:"2-digit",
            day:"2-digit",
            hour:"2-digit",
            minute:"2-digit",
            second:"2-digit",
            hour12: language === "en-US"
        }).format(new Date());
    }catch(error){
        return new Date().toLocaleString();
    }
}

function sellerBooksPdfFormatRupiah(value){
    return formatRupiah(Number(value) || 0);
}

function sellerBooksPdfFormatNumber(value){
    const language =
        typeof sellerBooksCurrentLanguage === "function" &&
        sellerBooksCurrentLanguage() === "en" ? "en-US" : "id-ID";
    return (Number(value) || 0).toLocaleString(language,{
        maximumFractionDigits:2
    });
}

function sellerBooksPdfEscapeFileName(value){
    return String(value || "SellerBooks")
        .replace(/[\\\/:*?"<>|]+/g,"-")
        .replace(/\s+/g," ")
        .trim();
}

function sellerBooksPdfGetPeriodLabel(language){
    const period = document.getElementById("reportPeriod")?.value || "today";
    const names = language === "en" ? {
        today:"Today",yesterday:"Yesterday",week:"This Week",lastWeek:"Last Week",
        month:"This Month",lastMonth:"Last Month",last3Months:"Last 3 Months",
        year:"This Year",custom:"Custom Date",all:"All Periods"
    } : {
        today:"Hari Ini",yesterday:"Kemarin",week:"Minggu Ini",lastWeek:"Minggu Lalu",
        month:"Bulan Ini",lastMonth:"Bulan Lalu",last3Months:"3 Bulan Terakhir",
        year:"Tahun Ini",custom:"Pilih Tanggal",all:"Semua Periode"
    };
    let label = names[period] || period;
    if(period === "custom"){
        const from = document.getElementById("reportDateFrom")?.value || "";
        const to = document.getElementById("reportDateTo")?.value || "";
        if(from || to){
            label += " (" + (from ? from.split("-").reverse().join("/") : "...") +
                (language === "en" ? " to " : " s/d ") +
                (to ? to.split("-").reverse().join("/") : "...") + ")";
        }
    }
    return label;
}

function sellerBooksPdfGetMarketplaceLabel(language){
    const element = document.getElementById("reportMarketplace");
    if(!element) return language === "en" ? "All Marketplaces" : "Semua Marketplace";
    const option = element.options[element.selectedIndex];
    const label = option ? String(option.textContent || option.value || "").trim() : "";
    if(language === "en" && (!label || /semua marketplace/i.test(label))) return "All Marketplaces";
    if(language !== "en" && (!label || /all marketplaces/i.test(label))) return "Semua Marketplace";
    return label || (language === "en" ? "All Marketplaces" : "Semua Marketplace");
}

function sellerBooksPdfGetStoreLabel(language){
    const element = document.getElementById("reportStore");
    if(!element) return language === "en" ? "All Store Accounts" : "Semua Akun Toko";
    const option = element.options[element.selectedIndex];
    const label = option ? String(option.textContent || option.value || "").trim() : "";
    if(language === "en" && (!label || /semua akun toko/i.test(label))) return "All Store Accounts";
    if(language !== "en" && (!label || /all store accounts/i.test(label))) return "Semua Akun Toko";
    return label || (language === "en" ? "All Store Accounts" : "Semua Akun Toko");
}

async function downloadReportPDF(){

    /* Ikuti bahasa akun seperti mekanisme PDF Rincian Produk. */
    const language =
        typeof sellerBooksCurrentLanguage === "function" &&
        sellerBooksCurrentLanguage() === "en" ? "en" : "id";

    const text = language === "en" ? {
        preparing:"⏳ Preparing PDF...",title:"SellerBooks - Business Report",printed:"Printed: ",
        period:"Period: ",marketplace:"Marketplace: ",store:"Store Account: ",
        totalSales:"Total Sales",netSales:"Net Sales",productsSold:"Products Sold",cogs:"COGS",
        marketplaceAdmin:"Marketplace Fees",packing:"Packing",otherCosts:"Other Costs",
        grossProfit:"Gross Profit",netProfit:"Net Profit",netMargin:"Net Margin",
        financialSummary:"Financial Summary",component:"Item",value:"Value",
        salesBySku:"Sales Details by SKU",noTransactions:"No transactions for this period.",
        missingMasterSku:"SKU not found in Master Products",loss:"LOSS",profit:"PROFIT",
        noData:"No data",marketplaceSummary:"Marketplace Summary",qty:"QTY",
        productName:"Product Name",sellingPrice:"Selling Price",sales:"Sales",admin:"Fees",
        productProfit:"Product Profit",status:"Status",
        page:"SellerBooks | Business Report | Page ",of:" of ",
        success:"✅ Report PDF created successfully. ",failed:"❌ Failed to create PDF. ",
        tryAgain:"Please try again."
    } : {
        preparing:"⏳ Menyiapkan PDF...",title:"SellerBooks - Laporan Bisnis",printed:"Dicetak: ",
        period:"Periode: ",marketplace:"Marketplace: ",store:"Akun Toko: ",
        totalSales:"Total Penjualan",netSales:"Penjualan Bersih",productsSold:"Produk Terjual",cogs:"HPP",
        marketplaceAdmin:"Admin Marketplace",packing:"Packing",otherCosts:"Biaya Lain",
        grossProfit:"Laba Kotor",netProfit:"Laba Bersih",netMargin:"Margin Bersih",
        financialSummary:"Ringkasan Keuangan",component:"Komponen",value:"Nilai",
        salesBySku:"Rincian Penjualan per SKU",noTransactions:"Tidak ada transaksi pada periode ini.",
        missingMasterSku:"SKU belum ada di Master Produk",loss:"MINUS",profit:"UNTUNG",
        noData:"Tidak ada data",marketplaceSummary:"Ringkasan Marketplace",qty:"QTY",
        productName:"Nama Produk",sellingPrice:"Harga Jual",sales:"Penjualan",admin:"Admin",
        productProfit:"Laba Produk",status:"Status",
        page:"SellerBooks | Laporan Bisnis | Halaman ",of:" dari ",
        success:"✅ PDF laporan berhasil dibuat. ",failed:"❌ PDF gagal dibuat. ",
        tryAgain:"Silakan coba lagi."
    };

    const button =
        document.getElementById("downloadReportPDFButton");

    const originalText =
        button ? button.innerHTML : "";

    try{

        if(button){
            button.disabled = true;
            button.innerHTML = text.preparing;
        }

        /*
         * Ambil FILTER AKTIF SEBELUM refresh laporan.
         * PDF tidak boleh mengambil SKU dari akun toko lain.
         */
        const pdfPeriod =
            document.getElementById("reportPeriod")?.value || "month";

        const pdfMarketplaceId =
            document.getElementById("reportMarketplace")?.value || "all";

        const pdfStoreId =
            document.getElementById("reportStore")?.value || "all";

        const pdfDateFrom =
            document.getElementById("reportDateFrom")?.value || "";

        const pdfDateTo =
            document.getElementById("reportDateTo")?.value || "";

        /* Pastikan tampilan laporan terbaru */
        updateReports();

        /*
         * Gunakan filter laporan secara STRICT untuk PDF.
         * Khusus akun toko: jika akun B dipilih, hanya transaksi
         * dengan storeId B yang boleh masuk. Jika tidak ada transaksi,
         * hasil harus benar-benar [] sehingga SKU juga kosong.
         */
        let transactions =
            getAllReportTransactions().filter(function(transaction){

                if(!isTransactionInReportPeriod(
                    transaction,
                    pdfPeriod
                )){
                    return false;
                }

                if(
                    pdfMarketplaceId !== "all" &&
                    pdfMarketplaceId !== ""
                ){
                    const transactionMarketplaceId =
                        String(transaction.marketplaceId || "")
                            .trim()
                            .toLowerCase();

                    const transactionMarketplace =
                        String(transaction.marketplace || "")
                            .trim()
                            .toLowerCase();

                    const selectedMarketplaceId =
                        String(pdfMarketplaceId)
                            .trim()
                            .toLowerCase();

                    const aliases = {
                        "tiktok":["tiktok","tiktok shop"],
                        "tokopedia":["tokopedia"],
                        "toco":["toco"],
                        "blibli":["blibli"],
                        "shopee":["shopee"],
                        "lazada":["lazada"]
                    };

                    const allowed =
                        aliases[selectedMarketplaceId] ||
                        [selectedMarketplaceId];

                    if(
                        transactionMarketplaceId !== selectedMarketplaceId &&
                        !allowed.includes(transactionMarketplaceId) &&
                        !allowed.includes(transactionMarketplace)
                    ){
                        return false;
                    }
                }

                /*
                 * FILTER AKUN TOKO WAJIB STRICT.
                 * Jangan pernah fallback ke storeName karena itu
                 * bisa membuat data akun lain ikut terbawa.
                 */
                if(
                    pdfStoreId !== "all" &&
                    pdfStoreId !== ""
                ){
                    if(
                        String(transaction.storeId || "").trim() !==
                        String(pdfStoreId).trim()
                    ){
                        return false;
                    }
                }

                if(pdfPeriod === "custom"){
                    const from = pdfDateFrom ? getReportDateOnly(pdfDateFrom) : null;
                    const to = pdfDateTo ? getReportDateOnly(pdfDateTo) : null;
                    const transactionDate =
                        getReportDateOnly(
                            transaction.reportDate || transaction.importedAt
                        );

                    if(from && (!transactionDate || transactionDate < from)){
                        return false;
                    }

                    if(to && (!transactionDate || transactionDate > to)){
                        return false;
                    }
                }

                return true;
            });

        /*
         * Jika akun toko yang dipilih tidak mempunyai transaksi,
         * paksa semua bagian rincian PDF kosong.
         */
        if(!transactions.length){
            transactions = [];
        }

        /*
         * Hitung keuangan berdasarkan transaksi PDF yang sama,
         * bukan berdasarkan kemungkinan filter lain.
         */
        const financialBase =
            calculateReportFinancial();

        const financial =
            transactions.length
                ? financialBase
                : {
                    totalSales:0,
                    netSales:0,
                    totalQty:0,
                    totalHpp:0,
                    totalAdmin:0,
                    totalPacking:0,
                    otherCosts:0,
                    grossProfit:0,
                    netProfit:0,
                    margin:0
                };

        /*
           RINCIAN SKU PDF HARUS MENGIKUTI TRANSAKSI LAPORAN YANG SAMA.
           Jangan memakai calculateProductAnalysisRows() karena fungsi tersebut
           mengikuti filter Product Analysis sendiri, bukan filter Report.
           Dengan cara ini SEMUA SKU yang terjual pada periode/filter laporan
           akan masuk PDF, termasuk SKU yang belum ada di Master Produk.
        */
        const productRowsMap = new Map();

        transactions.forEach(function(item){

            const sku =
                String(item.sku || "").trim();

            if(!sku){
                return;
            }

            const key = sku.toLowerCase();

            if(!productRowsMap.has(key)){
                const product = getMasterProductBySku(sku);

                productRowsMap.set(key,{
                    sku:sku,
                    qty:0,
                    sales:0,
                    hpp:0,
                    admin:0,
                    product:product || null,
                    marketplaces:new Set()
                });
            }

            const row = productRowsMap.get(key);

            const itemMarketplace =
                String(item.marketplace || "").trim().toLowerCase();

            if(itemMarketplace){
                row.marketplaces.add(itemMarketplace);
            }

            const qty = Number(item.qty) || 0;
            const sales = getReportTransactionSalesAmount(item);
            const product = row.product || getMasterProductBySku(sku);
            const cost = getReportTransactionCost(item);
            const feePercent = getReportTransactionFeePercent(item);
            const admin = sales * (feePercent / 100);

            row.qty += qty;
            row.sales += sales;
            row.hpp += cost * qty;
            row.admin += admin;

            if(!row.product && product){
                row.product = product;
            }
        });

        const productRows = Array.from(productRowsMap.values())
            .map(function(row){
                const isShopeeTikTokOnly =
                    row.marketplaces &&
                    row.marketplaces.size === 1 &&
                    (row.marketplaces.has("shopee") ||
                     row.marketplaces.has("tiktok") ||
                     row.marketplaces.has("blibli") ||
                     row.marketplaces.has("lazada"));

                row.price =
                    isShopeeTikTokOnly && Number(row.qty) > 0
                        ? (Number(row.sales) / Number(row.qty))
                        : (row.product ? (Number(row.product.price) || 0) : 0);

                row.name = row.product
                    ? (row.product.name || row.sku)
                    : text.missingMasterSku;
                row.profit = row.sales - row.admin - row.hpp;
                row.isLoss = row.profit < 0;
                return row;
            })
            .sort(function(a,b){
                return String(a.sku).localeCompare(String(b.sku), "id", {
                    numeric:true,
                    sensitivity:"base"
                });
            });

        await sellerBooksLoadPdfLibraries();

        const jsPDF =
            window.jspdf.jsPDF;

        const doc =
            new jsPDF({
                orientation:"landscape",
                unit:"mm",
                format:"a4"
            });

        const pageWidth =
            doc.internal.pageSize.getWidth();

        const pageHeight =
            doc.internal.pageSize.getHeight();

        const periodLabel =
            sellerBooksPdfGetPeriodLabel(language);
        const marketplaceLabel =
            sellerBooksPdfGetMarketplaceLabel(language);

        const storeLabel =
            sellerBooksPdfGetStoreLabel(language);

        /* HEADER */
        doc.setFont("helvetica","bold");
        doc.setFontSize(18);
        doc.text(text.title,14,16);

        doc.setFont("helvetica","normal");
        doc.setFontSize(9);
        doc.text(
            text.printed + sellerBooksPdfFormatDateNow(),
            pageWidth - 14,
            16,
            {align:"right"}
        );

        doc.setFontSize(10);
        doc.text(text.period + periodLabel,14,23);
        doc.text(text.marketplace + marketplaceLabel,14,29);
        doc.text(text.store + storeLabel,14,35);

        /* RINGKASAN KEUANGAN */
        const summaryRows = [
            [text.totalSales, sellerBooksPdfFormatRupiah(financial.totalSales)],
            [text.netSales, sellerBooksPdfFormatRupiah(financial.netSales)],
            [text.productsSold, sellerBooksPdfFormatNumber(financial.totalQty) + " PCS"],
            [text.cogs, sellerBooksPdfFormatRupiah(financial.totalHpp)],
            [text.marketplaceAdmin, sellerBooksPdfFormatRupiah(financial.totalAdmin)],
            [text.packing, sellerBooksPdfFormatRupiah(financial.totalPacking)],
            [text.otherCosts, sellerBooksPdfFormatRupiah(financial.otherCosts)],
            [text.grossProfit, sellerBooksPdfFormatRupiah(financial.grossProfit)],
            [text.netProfit, sellerBooksPdfFormatRupiah(financial.netProfit)],
            [text.netMargin, Number(financial.margin || 0).toLocaleString(language === "en" ? "en-US" : "id-ID",{maximumFractionDigits:2}) + "%"]
        ];

        doc.setFont("helvetica","bold");
        doc.setFontSize(12);
        doc.text(text.financialSummary,14,44);

        doc.autoTable({
            startY:47,
            margin:{left:14,right:14},
            theme:"grid",
            head:[[text.component,text.value]],
            body:summaryRows,
            styles:{
                font:"helvetica",
                fontSize:8,
                cellPadding:2.2
            },
            headStyles:{
                fontStyle:"bold"
            },
            columnStyles:{
                0:{cellWidth:65},
                1:{halign:"right"}
            }
        });

        let y =
            doc.lastAutoTable.finalY + 8;

        /* SKU / PRODUK */
        doc.setFont("helvetica","bold");
        doc.setFontSize(12);
        doc.text(text.salesBySku,14,y);

        y += 3;

        const skuBody =
            productRows.map(function(row,index){
                return [
                    index + 1,
                    String(row.sku || "-"),
                    String(row.name || "-"),
                    sellerBooksPdfFormatNumber(row.qty),
                    sellerBooksPdfFormatRupiah(row.price),
                    sellerBooksPdfFormatRupiah(row.sales),
                    sellerBooksPdfFormatRupiah(row.hpp),
                    sellerBooksPdfFormatRupiah(row.admin),
                    sellerBooksPdfFormatRupiah(row.profit),
                    row.isLoss ? text.loss : text.profit
                ];
            });

        if(!skuBody.length){
            skuBody.push([
                "-",
                "-",
                text.noTransactions,
                "-","-","-","-","-","-","-"
            ]);
        }

        doc.autoTable({
            startY:y + 2,
            margin:{left:14,right:14},
            theme:"grid",
            head:[[
                "No",
                "SKU",
                text.productName,
                text.qty,
                text.sellingPrice,
                text.sales,
                text.cogs,
                text.admin,
                text.productProfit,
                text.status
            ]],
            body:skuBody,
            styles:{
                font:"helvetica",
                fontSize:6.7,
                cellPadding:1.8,
                overflow:"linebreak"
            },
            headStyles:{
                fontStyle:"bold",
                fontSize:6.7
            },
            columnStyles:{
                0:{cellWidth:8,halign:"center"},
                1:{cellWidth:25},
                2:{cellWidth:48},
                3:{cellWidth:14,halign:"right"},
                4:{cellWidth:25,halign:"right"},
                5:{cellWidth:27,halign:"right"},
                6:{cellWidth:25,halign:"right"},
                7:{cellWidth:25,halign:"right"},
                8:{cellWidth:27,halign:"right"},
                9:{cellWidth:18,halign:"center"}
            },
            didParseCell:function(data){
                if(
                    data.section === "body" &&
                    data.column.index === 9 &&
                    String(data.cell.raw) === "MINUS"
                ){
                    data.cell.styles.fontStyle = "bold";
                }
            }
        });

        y =
            doc.lastAutoTable.finalY + 8;

        /* MARKETPLACE */
        doc.setFont("helvetica","bold");
        doc.setFontSize(12);
        doc.text(text.marketplaceSummary,14,y);

        const marketplaceMap = new Map();

        transactions.forEach(function(item){

            const key =
                String(
                    item.marketplaceId ||
                    item.marketplace ||
                    "unknown"
                );

            if(!marketplaceMap.has(key)){
                marketplaceMap.set(key,{
                    name:String(item.marketplace || key || "Lainnya"),
                    sales:0,
                    qty:0,
                    hpp:0,
                    admin:0
                });
            }

            const group =
                marketplaceMap.get(key);

            const sales =
                getReportTransactionSalesAmount(item);

            const qty =
                Number(item.qty) || 0;

            const product =
                getMasterProductBySku(item.sku);

            const hpp =
                product
                    ? getReportTransactionCost(item) * qty
                    : 0;

            const admin =
                sales *
                getReportTransactionFeePercent(item) /
                100;

            group.sales += sales;
            group.qty += qty;
            group.hpp += hpp;
            group.admin += admin;
        });

        const marketplaceBody =
            Array.from(marketplaceMap.values()).map(function(group){
                const profit =
                    group.sales -
                    group.admin -
                    group.hpp;

                return [
                    group.name,
                    sellerBooksPdfFormatNumber(group.qty),
                    sellerBooksPdfFormatRupiah(group.sales),
                    sellerBooksPdfFormatRupiah(group.admin),
                    sellerBooksPdfFormatRupiah(group.hpp),
                    sellerBooksPdfFormatRupiah(profit)
                ];
            });

        if(!marketplaceBody.length){
            marketplaceBody.push([
                text.noData,
                "-","-","-","-","-"
            ]);
        }

        doc.autoTable({
            startY:y + 3,
            margin:{left:14,right:14},
            theme:"grid",
            head:[[
                text.marketplace,
                text.qty,
                text.sales,
                text.admin,
                text.cogs,
                text.productProfit
            ]],
            body:marketplaceBody,
            styles:{
                font:"helvetica",
                fontSize:7,
                cellPadding:2
            },
            headStyles:{
                fontStyle:"bold",
                fontSize:7
            },
            columnStyles:{
                0:{cellWidth:55},
                1:{cellWidth:20,halign:"right"},
                2:{cellWidth:40,halign:"right"},
                3:{cellWidth:35,halign:"right"},
                4:{cellWidth:35,halign:"right"},
                5:{cellWidth:40,halign:"right"}
            }
        });

        /* FOOTER NOMOR HALAMAN */
        const totalPages =
            doc.internal.getNumberOfPages();

        for(
            let page = 1;
            page <= totalPages;
            page++
        ){
            doc.setPage(page);

            doc.setFont("helvetica","normal");
            doc.setFontSize(7);

            doc.text(
                text.page +
                page +
                text.of +
                totalPages,
                pageWidth / 2,
                pageHeight - 7,
                {align:"center"}
            );
        }

        const safePeriod =
            sellerBooksPdfEscapeFileName(
                periodLabel
            );

        const fileName =
            (language === "en" ? "SellerBooks_Report_" : "SellerBooks_Laporan_") +
            safePeriod +
            "_" +
            new Date().toISOString().slice(0,10) +
            ".pdf";

        /*
           WEB BROWSER + ANDROID WEBVIEW
        */
        const blob =
            doc.output("blob");

        const url =
            URL.createObjectURL(blob);

        const anchor =
            document.createElement("a");

        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = "none";

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        /*
           Beri waktu browser/WebView membaca Blob URL
           sebelum object URL dilepas.
        */
        setTimeout(function(){
            try{
                URL.revokeObjectURL(url);
            }catch(error){}
        },15000);

        sellerBooksAlert(
            text.success +
            text.period + periodLabel + " | " +
            text.marketplace + marketplaceLabel + " | " +
            text.store + storeLabel
        );

    }catch(error){

        console.error(
            "Gagal membuat PDF laporan:",
            error
        );

        sellerBooksAlert(
            text.failed +
            (
                error && error.message
                    ? error.message
                    : text.tryAgain
            )
        );

    }finally{

        if(button){
            button.disabled = false;
            button.innerHTML = originalText;
        }

    }
}


/* =========================================================
   DETAIL PRODUK TERJUAL
   Tabel tambahan ini memakai filter laporan yang sama dan tidak
   mengubah mesin perhitungan laporan yang sudah ada.
========================================================= */
let reportSoldProductPage = 1;
let reportSoldProductPageSize = 20;
let reportSoldProductFilterKey = "";

function goToReportSoldProductPage(page){
    reportSoldProductPage = Math.max(1, Number(page) || 1);
    renderReportSoldProductTable();
}

function changeReportSoldProductPageSize(value){
    const parsed = Number(value);
    reportSoldProductPageSize = [20,40,50,80,100].includes(parsed) ? parsed : 20;
    reportSoldProductPage = 1;
    renderReportSoldProductTable();
}

function updateReportSoldProductLabels(isEN){
        const labels = {
            title: isEN ? "Sold Product Details" : "Detail Produk Terjual",
            description: isEN ? "Summary of quantity, COGS, and profit by product category." : "Ringkasan jumlah produk, HPP, dan laba berdasarkan kategori produk.",
            name: isEN ? "Product Name" : "Nama Produk",
            qty: isEN ? "Total Products" : "Total Produk",
            hpp: isEN ? "COGS" : "HPP",
            profit: isEN ? "Profit" : "Laba",
            averageProfit: isEN ? "Average Profit per Product" : "Rata-rata Laba per Produk",
            hppPerPcs: isEN ? "COGS per Unit" : "HPP per PCS"
        };
        const labelMap = {
            reportSoldProductTitle:labels.title,
            reportSoldProductDescription:labels.description,
            reportSoldProductNameHeader:labels.name,
            reportSoldProductQtyHeader:labels.qty,
            reportSoldProductHppHeader:labels.hpp,
            reportSoldProductProfitHeader:labels.profit,
            reportSoldProductAverageProfitHeader:labels.averageProfit,
            reportSoldProductHppPerPcsHeader:labels.hppPerPcs
        };
        Object.keys(labelMap).forEach(function(id){
            const el=document.getElementById(id);
            if(el)el.textContent=labelMap[id];
        });
}

function renderReportSoldProductTable(){
    const body = document.getElementById("reportSoldProductBody");
    const pagination = document.getElementById("reportSoldProductPagination");
    const controls = document.getElementById("reportSoldProductPaginationControls");
    const pageSizeSelect = document.getElementById("reportSoldProductPageSize");
    if(!body) return;

    const isEN = String(typeof sellerBooksCurrentLanguage === "function" ? sellerBooksCurrentLanguage() : "id").toLowerCase() === "en";
    updateReportSoldProductLabels(isEN);
    const transactions = getFilteredReportTransactions();
    const filterKey = [
        document.getElementById("reportPeriod")?.value || "",
        document.getElementById("reportMarketplace")?.value || "",
        document.getElementById("reportStore")?.value || "",
        document.getElementById("reportDateFrom")?.value || "",
        document.getElementById("reportDateTo")?.value || ""
    ].join("|");
    if(reportSoldProductFilterKey !== filterKey){
        reportSoldProductFilterKey = filterKey;
        reportSoldProductPage = 1;
    }
    const pageSizeLabel = document.getElementById("reportSoldProductPageSizeLabel");
    const rowsLabel = document.getElementById("reportSoldProductRowsLabel");
    if(pageSizeLabel) pageSizeLabel.textContent = isEN ? "Show" : "Tampilkan";
    if(rowsLabel) rowsLabel.textContent = isEN ? "rows" : "baris";
    if(!transactions.length){
        body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:28px;color:#64748b;">${isEN ? "No sold product data." : "Belum ada data produk terjual."}</td></tr>`;
        if(pagination) pagination.style.display = "none";
        return;
    }

    const rows = new Map();
    transactions.forEach(function(item){
        const sku = String(item && item.sku || "").trim();
        const product = sku ? getMasterProductBySku(sku) : null;
        const category = String(product && product.category || "").trim();
        const name = category || (isEN ? "Uncategorized" : "Tanpa Kategori");
        const key = name.toLocaleLowerCase();
        if(!rows.has(key)) rows.set(key,{name:name,qty:0,hpp:0,profit:0});

        const row = rows.get(key);
        const qty = Number(item && item.qty) || 0;
        const sales = getReportTransactionSalesAmount(item);
        const fee = sales * (getReportTransactionFeePercent(item) / 100);
        const hpp = product ? getReportTransactionCost(item) * qty : 0;
        row.qty += qty;
        row.hpp += hpp;
        row.profit += sales - fee - hpp;
    });

    const sortedRows = Array.from(rows.values()).sort(function(a,b){
        return a.name.localeCompare(b.name, isEN ? "en" : "id", {sensitivity:"base"});
    });
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / reportSoldProductPageSize));
    reportSoldProductPage = Math.min(Math.max(1, reportSoldProductPage), totalPages);
    if(pageSizeSelect) pageSizeSelect.value = String(reportSoldProductPageSize);
    const startIndex = (reportSoldProductPage - 1) * reportSoldProductPageSize;
    const endIndex = Math.min(startIndex + reportSoldProductPageSize, sortedRows.length);
    const visibleRows = sortedRows.slice(startIndex, endIndex);
    body.innerHTML = visibleRows.map(function(row){
        const averageProfit = row.qty > 0 ? row.profit / row.qty : 0;
        const hppPerPcs = row.qty > 0 ? row.hpp / row.qty : 0;
        return `<tr><td>${escapeHtml(row.name)}</td><td>${Number(row.qty).toLocaleString(isEN ? "en-US" : "id-ID")}</td><td>${formatRupiah(row.hpp)}</td><td>${formatRupiah(row.profit)}</td><td>${formatRupiah(hppPerPcs)}</td><td>${formatRupiah(averageProfit)}</td></tr>`;
    }).join("");

    if(pagination) pagination.style.display = "flex";
    if(controls){
        let controlsHtml = `<span class="report-transaction-page-info">${startIndex + 1}-${endIndex} ${isEN ? "of" : "dari"} ${sortedRows.length}</span>`;
        controlsHtml += `<button type="button" class="report-transaction-page-button" onclick="goToReportSoldProductPage(${reportSoldProductPage - 1})" ${reportSoldProductPage <= 1 ? "disabled" : ""} aria-label="${isEN ? "Previous page" : "Halaman sebelumnya"}">‹</button>`;
        const maxButtons = 7;
        let pageStart = Math.max(1, reportSoldProductPage - 3);
        let pageEnd = Math.min(totalPages, pageStart + maxButtons - 1);
        pageStart = Math.max(1, pageEnd - maxButtons + 1);
        if(pageStart > 1){
            controlsHtml += `<button type="button" class="report-transaction-page-button" onclick="goToReportSoldProductPage(1)">1</button>`;
            if(pageStart > 2) controlsHtml += `<span class="report-transaction-page-info">...</span>`;
        }
        for(let page = pageStart; page <= pageEnd; page++){
            controlsHtml += `<button type="button" class="report-transaction-page-button ${page === reportSoldProductPage ? "active" : ""}" onclick="goToReportSoldProductPage(${page})" aria-current="${page === reportSoldProductPage ? "page" : "false"}">${page}</button>`;
        }
        if(pageEnd < totalPages){
            if(pageEnd < totalPages - 1) controlsHtml += `<span class="report-transaction-page-info">...</span>`;
            controlsHtml += `<button type="button" class="report-transaction-page-button" onclick="goToReportSoldProductPage(${totalPages})">${totalPages}</button>`;
        }
        controlsHtml += `<button type="button" class="report-transaction-page-button" onclick="goToReportSoldProductPage(${reportSoldProductPage + 1})" ${reportSoldProductPage >= totalPages ? "disabled" : ""}>${isEN ? "Next" : "Berikutnya"} ›</button>`;
        controls.innerHTML = controlsHtml;
    }

    updateReportSoldProductLabels(isEN);

}

/* =========================================================
   UPDATE SEMUA LAPORAN
========================================================= */

function updateReports(){

    const reportProfiler =
        window.sellerBooksReportProfiler;

    if(reportProfiler){
        reportProfiler.reset();
        reportProfiler.active = true;
        reportProfiler.reportCalls += 1;
    }

    const renderStart =
        performance.now();

    /* Satu error tidak boleh membuat semua tabel laporan kosong. */
    try{ renderReportSalesSummary(); }catch(error){ console.error("Laporan ringkasan:", error); }
    try{ renderUnmatchedSkuReport(); }catch(error){ console.error("Laporan SKU:", error); }
    try{ renderReportFinancial(); }catch(error){ console.error("Laporan keuangan:", error); }
    try{ renderReportMarketplaceTable(); }catch(error){ console.error("Laporan marketplace:", error); }
    try{ renderReportStoreTable(); }catch(error){ console.error("Laporan akun toko:", error); }
    try{ renderReportTransactionTable(); }catch(error){ console.error("Detail transaksi:", error); }
    try{ renderReportSoldProductTable(); }catch(error){ console.error("Detail produk terjual:", error); }
    try{ sellerBooksApplyReportsLanguage(); }catch(error){ console.error("Reports language:", error); }

    if(reportProfiler){
        reportProfiler.renderMs =
            performance.now() - renderStart;
        reportProfiler.log();
        reportProfiler.active = false;
    }

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
            const savedDay = sellerBooksGetIndependentViewPreference(
                "report",
                "viewDay",
                ""
            );
            const savedPeriod = sellerBooksGetIndependentViewPreference(
                "report",
                "period",
                "today"
            );

            if(savedDay !== todayKey){
                period.value = "today";
                sellerBooksWriteIndependentViewPreferences("report",{
                    viewDay:todayKey,
                    period:"today",
                    dateFrom:"",
                    dateTo:""
                });
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
                    sellerBooksWriteIndependentViewPreferences("report",{
                        period:period.value,
                        viewDay:getSellerBooksDayKey()
                    });
                    sellerBooksScheduleDeferredRender(function(){
                        updateReports();
                    });
                }
            );

        }

        const reportDateFrom = document.getElementById("reportDateFrom");
        const reportDateTo = document.getElementById("reportDateTo");

        const savedReportDateFrom =
            sellerBooksGetIndependentViewPreference(
                "report",
                "dateFrom",
                ""
            );
        const savedReportDateTo =
            sellerBooksGetIndependentViewPreference(
                "report",
                "dateTo",
                ""
            );

        if(reportDateFrom){
            reportDateFrom.value = savedReportDateFrom || "";
            reportDateFrom.addEventListener("change", function(){
                sellerBooksWriteIndependentViewPreferences("report",{
                    dateFrom:reportDateFrom.value || "",
                    viewDay:getSellerBooksDayKey()
                });
                updateReports();
            });
        }

        if(reportDateTo){
            reportDateTo.value = savedReportDateTo || "";
            reportDateTo.addEventListener("change", function(){
                sellerBooksWriteIndependentViewPreferences("report",{
                    dateTo:reportDateTo.value || "",
                    viewDay:getSellerBooksDayKey()
                });
                updateReports();
            });
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
