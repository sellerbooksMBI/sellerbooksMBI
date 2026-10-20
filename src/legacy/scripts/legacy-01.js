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
                localStorage.getItem(
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
                localStorage.getItem(
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

    updateReports();

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
                localStorage.getItem(
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
                localStorage.getItem(
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

function initializeReports(){

    loadReportMarketplaceFilter();

    loadReportStoreFilter();

    loadDeleteReportMarketplaceFilter();

    applyReportFilters();

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