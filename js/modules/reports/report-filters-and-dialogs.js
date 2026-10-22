

/* =====================================================
   SELLERBOOKS CUSTOM ALERT / CONFIRM
   Tidak menggunakan window.alert/window.confirm
===================================================== */
(function(){
    let sellerBooksDialogQueue = [];
    let sellerBooksDialogBusy = false;

    function sellerBooksShowDialog(message, options){
        options = options || {};
        const overlay = document.getElementById("sellerBooksDialogOverlay");
        const title = document.getElementById("sellerBooksDialogTitle");
        const body = document.getElementById("sellerBooksDialogMessage");
        const ok = document.getElementById("sellerBooksDialogOk");
        const cancel = document.getElementById("sellerBooksDialogCancel");
        const icon = document.getElementById("sellerBooksDialogIcon");

        if(!overlay || !title || !body || !ok || !cancel){
            // Fallback hanya jika elemen custom belum tersedia.
            return Promise.resolve(false);
        }

        return new Promise(function(resolve){
            sellerBooksDialogQueue.push({
                message:String(message ?? ""),
                title:options.title || "SellerBooks",
                confirm:!!options.confirm,
                resolve:resolve
            });
            sellerBooksProcessDialogQueue();
        });
    }

    function sellerBooksProcessDialogQueue(){
        if(sellerBooksDialogBusy || !sellerBooksDialogQueue.length) return;

        sellerBooksDialogBusy = true;

        const item = sellerBooksDialogQueue.shift();
        const overlay = document.getElementById("sellerBooksDialogOverlay");
        const title = document.getElementById("sellerBooksDialogTitle");
        const body = document.getElementById("sellerBooksDialogMessage");
        const ok = document.getElementById("sellerBooksDialogOk");
        const cancel = document.getElementById("sellerBooksDialogCancel");
        const icon = document.getElementById("sellerBooksDialogIcon");

        const dialogLanguage =
            typeof sellerBooksCurrentLanguage === "function"
                ? sellerBooksCurrentLanguage()
                : "id";

        const dialogTranslations = dialogLanguage === "en"
            ? {
                confirmation:"Confirmation",
                cancel:"Cancel",
                continue:"Continue",
                ok:"OK"
            }
            : {
                confirmation:"Konfirmasi",
                cancel:"Batal",
                continue:"Lanjutkan",
                ok:"OK"
            };

        title.textContent =
            item.title ||
            (item.confirm
                ? dialogTranslations.confirmation
                : "SellerBooks");

        body.textContent = item.message;
        icon.textContent = item.confirm ? "?" : "✓";
        cancel.style.display = item.confirm ? "" : "none";
        cancel.textContent = dialogTranslations.cancel;
        ok.textContent = item.confirm
            ? dialogTranslations.continue
            : dialogTranslations.ok;

        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden","false");

        let finished = false;

        function finish(value){
            if(finished) return;
            finished = true;

            overlay.classList.remove("show");
            overlay.setAttribute("aria-hidden","true");

            ok.removeEventListener("click", onOk);
            cancel.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onKey);

            item.resolve(value);
            sellerBooksDialogBusy = false;
            setTimeout(sellerBooksProcessDialogQueue, 0);
        }

        function onOk(){
            finish(true);
        }

        function onCancel(){
            finish(false);
        }

        function onKey(event){
            if(event.key === "Escape"){
                finish(false);
            }else if(event.key === "Enter"){
                finish(true);
            }
        }

        ok.addEventListener("click", onOk);
        cancel.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKey);

        setTimeout(function(){
            (item.confirm ? cancel : ok).focus();
        }, 0);
    }

    window.sellerBooksAlert = function(message, title){
        sellerBooksShowDialog(message, {
            title:title || "SellerBooks",
            confirm:false
        });
    };

    window.sellerBooksConfirm = function(message, title){
        const language =
            typeof sellerBooksCurrentLanguage === "function"
                ? sellerBooksCurrentLanguage()
                : "id";

        return sellerBooksShowDialog(message, {
            title:title || (language === "en" ? "Confirmation" : "Konfirmasi"),
            confirm:true
        });
    };
})();


function loadReportMarketplaceFilter(){

    const select =
        document.getElementById(
            "reportMarketplace"
        );

    if(!select){
        return;
    }


    const currentValue =
        select.value || "all";


    select.innerHTML = `
        <option value="all">
            Semua Marketplace
        </option>
    `;


    let marketplaceData = [];

    try{

        marketplaceData =
            JSON.parse(
                sellerBooksStorage.getItem(
                    "sellerbooks_marketplaces"
                )
            ) || [];

    }catch(error){

        marketplaceData = [];

    }


    marketplaceData
        .filter(function(marketplace){

            return marketplace.status === "active";

        })
        .forEach(function(marketplace){

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                marketplace.id;

            option.textContent =
                marketplace.name;

            select.appendChild(option);

        });


    if(
        [...select.options]
        .some(function(option){

            return option.value === currentValue;

        })
    ){

        select.value = currentValue;

    }

}


/* =====================================================
   LOAD AKUN TOKO SESUAI MARKETPLACE
===================================================== */

function loadReportStoreFilter(){

    const marketplaceSelect =
        document.getElementById(
            "reportMarketplace"
        );

    const storeSelect =
        document.getElementById(
            "reportStore"
        );


    if(
        !marketplaceSelect ||
        !storeSelect
    ){

        return;

    }


    const marketplaceId =
        marketplaceSelect.value;


    const currentStore =
        storeSelect.value;


    storeSelect.innerHTML = `
        <option value="all">
            Semua Akun Toko
        </option>
    `;


    let storesData = [];

    try{

        storesData =
            JSON.parse(
                sellerBooksStorage.getItem(
                    "sellerbooks_stores"
                )
            ) || [];

    }catch(error){

        storesData = [];

    }


    storesData
        .filter(function(store){

            if(
                store.status === "inactive"
            ){

                return false;

            }


            if(
                marketplaceId === "all"
            ){

                return true;

            }


            return (
                store.marketplaceId ===
                marketplaceId
            );

        })
        .forEach(function(store){

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                store.id;

            option.textContent =
                store.name;

            storeSelect.appendChild(
                option
            );

        });


    if(
        [...storeSelect.options]
        .some(function(option){

            return option.value === currentStore;

        })
    ){

        storeSelect.value =
            currentStore;

    }

}


/* =====================================================
   MARKETPLACE BERUBAH
===================================================== */

function onReportMarketplaceChange(){

    loadReportStoreFilter();

    applyReportFilters();

}


/* =====================================================
   TERAPKAN FILTER
===================================================== */

function applyReportFilters(){

    const period =
        document.getElementById(
            "reportPeriod"
        )?.value || "month";


    const marketplace =
        document.getElementById(
            "reportMarketplace"
        )?.value || "all";


    const store =
        document.getElementById(
            "reportStore"
        )?.value || "all";


    updateReportCustomDateUI();

    updateReportFilterInfo(
        period,
        marketplace,
        store
    );

    sellerBooksScheduleDeferredRender(function(){
        updateReports();
    });

}


/* =====================================================
   INFO FILTER
===================================================== */

function updateReportFilterInfo(
    period,
    marketplaceId,
    storeId
){

    const info =
        document.getElementById(
            "reportFilterInfo"
        );


    if(!info){
        return;
    }


    const periodNames = {

        today:
            "Hari Ini",

        yesterday:
            "Kemarin",

        week:
            "Minggu Ini",

        lastWeek:
            "Minggu Lalu",

        month:
            "Bulan Ini",

        lastMonth:
            "Bulan Lalu",

        last3Months:
            "3 Bulan Terakhir",

        year:
            "Tahun Ini",

        custom:
            "Pilih Tanggal",

        all:
            "Semua Periode"

    };


    let marketplaceName =
        "Semua Marketplace";


    let storeName =
        "Semua Akun Toko";


    try{

        const marketplacesData =
            JSON.parse(
                sellerBooksStorage.getItem(
                    "sellerbooks_marketplaces"
                )
            ) || [];


        const marketplace =
            marketplacesData.find(
                function(item){

                    return (
                        item.id ===
                        marketplaceId
                    );

                }
            );


        if(marketplace){

            marketplaceName =
                marketplace.name;

        }


    }catch(error){}


    try{

        const storesData =
            JSON.parse(
                sellerBooksStorage.getItem(
                    "sellerbooks_stores"
                )
            ) || [];


        const store =
            storesData.find(
                function(item){

                    return (
                        item.id ===
                        storeId
                    );

                }
            );


        if(store){

            storeName =
                store.name;

        }


    }catch(error){}


    let periodLabel = periodNames[period] || "Bulan Ini";

    if(period === "custom"){
        const from = getReportInputDate("reportDateFrom");
        const to = getReportInputDate("reportDateTo");
        if(from || to){
            periodLabel += " (" +
                (from ? from.split("-").reverse().join("/") : "...") +
                " s/d " +
                (to ? to.split("-").reverse().join("/") : "...") +
                ")";
        }
    }

    info.innerHTML =
        "Periode: <strong>" +
        periodLabel +
        "</strong>" +
        " &nbsp;•&nbsp; " +
        "Marketplace: <strong>" +
        marketplaceName +
        "</strong>" +
        " &nbsp;•&nbsp; " +
        "Akun: <strong>" +
        storeName +
        "</strong>";

}


/* =====================================================
   INISIALISASI LAPORAN
===================================================== */

function initializeReports(renderNow = true){

    loadReportMarketplaceFilter();

    loadReportStoreFilter();

    loadDeleteReportMarketplaceFilter();

    if(renderNow){
        applyReportFilters();
    }

}


/* =====================================================
   SAAT DOM SELESAI
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function(){

        initializeReports();

    }
);


