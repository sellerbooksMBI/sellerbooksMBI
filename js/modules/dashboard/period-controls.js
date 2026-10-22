function getDashboardDateRange(){

    /* PATCH E: hindari query DOM untuk setiap transaksi pada filter custom. */
    const fromValue =
        sellerBooksDashboardFilterState.dateFrom || "";

    const toValue =
        sellerBooksDashboardFilterState.dateTo || "";

    return {
        from:fromValue ? getReportDateOnly(fromValue) : null,
        to:toValue ? getReportDateOnly(toValue) : null
    };
}

function updateDashboardCustomDateUI(){

    const periodSelect =
        document.getElementById("dashboardPeriod");

    const box =
        document.getElementById("dashboardCustomDateRange");

    if(!periodSelect || !box){
        return;
    }

    const show =
        periodSelect.value === "custom" &&
        !dashboardCustomDateConfirmed;

    box.classList.toggle("show",show);

    const today =
        getIndonesiaTodayDate();

    if(!today){
        return;
    }

    const maxDate =
        getLocalDateString(today);

    const minDate =
        getLocalDateString(
            new Date(
                today.getFullYear(),
                today.getMonth()-2,
                1
            )
        );

    const from =
        document.getElementById("dashboardDateFrom");

    const to =
        document.getElementById("dashboardDateTo");

    if(from){
        from.min = minDate;
        from.max = maxDate;
    }

    if(to){
        to.min = minDate;
        to.max = maxDate;
    }

    const info =
        document.getElementById("dashboardDateRangeInfo");

    if(info){
        info.textContent =
            "Rentang tanggal maksimal: 3 bulan terakhir sampai hari ini (" +
            minDate.split("-").reverse().join("/") +
            " s/d " +
            maxDate.split("-").reverse().join("/") +
            ").";
    }
}

function changeDashboardCustomDateRange(){

    dashboardCustomDateConfirmed = false;

    const fromValue =
        document.getElementById("dashboardDateFrom")?.value || "";

    const toValue =
        document.getElementById("dashboardDateTo")?.value || "";

    if(fromValue && toValue){
        const from = getReportDateOnly(fromValue);
        const to = getReportDateOnly(toValue);

        if(from && to && from > to){
            sellerBooksAlert(
                sellerBooksDashboardText("dateOrderInvalid"),
                sellerBooksDashboardText("dateValidationTitle")
            );
            return;
        }
    }

    sellerBooksSetDashboardFilterState({
        dateFrom:fromValue,
        dateTo:toValue
    });

    sellerBooksWriteDashboardPreferences({
        dateFrom:fromValue,
        dateTo:toValue
    });

    updateDashboardByPeriod();
}

function confirmDashboardCustomDateRange(){

    const fromValue =
        document.getElementById("dashboardDateFrom")?.value || "";

    const toValue =
        document.getElementById("dashboardDateTo")?.value || "";

    if(!fromValue || !toValue){
        sellerBooksAlert(
            sellerBooksDashboardText("dateRequired"),
            sellerBooksDashboardText("dateValidationTitle")
        );
        return;
    }

    const from = getReportDateOnly(fromValue);
    const to = getReportDateOnly(toValue);

    if(from && to && from > to){
        sellerBooksAlert(
            sellerBooksDashboardText("dateOrderInvalid"),
            sellerBooksDashboardText("dateValidationTitle")
        );
        return;
    }

    sellerBooksSetDashboardFilterState({
        dateFrom:fromValue,
        dateTo:toValue
    });

    sellerBooksWriteDashboardPreferences({
        dateFrom:fromValue,
        dateTo:toValue
    });

    dashboardCustomDateConfirmed = true;

    const box =
        document.getElementById("dashboardCustomDateRange");

    if(box){
        box.classList.remove("show");
    }

    updateDashboardByPeriod();
}

function loadDashboardCustomDates(){

    const from =
        document.getElementById("dashboardDateFrom");

    const to =
        document.getElementById("dashboardDateTo");

    sellerBooksSyncDashboardFilterState();

    if(from){
        from.value =
            sellerBooksDashboardFilterState.dateFrom || "";
    }

    if(to){
        to.value =
            sellerBooksDashboardFilterState.dateTo || "";
    }

    updateDashboardCustomDateUI();
}

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

    sellerBooksSetDashboardFilterState({
        period:currentDashboardPeriod,
        viewDay:getSellerBooksDayKey()
    });

    dashboardCustomDateConfirmed =
        currentDashboardPeriod !== "custom";

    updateDashboardCustomDateUI();


    /* SIMPAN PILIHAN */

    sellerBooksWriteDashboardPreferences({
        period:currentDashboardPeriod,
        viewDay:getSellerBooksDayKey()
    });


    /* UPDATE DASHBOARD — jadwalkan agar UI/dropdown tetap responsif. */
    sellerBooksScheduleDeferredRender(function(){
        updateDashboardByPeriod();
    });

}
/* =========================================
   CEK APAKAH TANGGAL MASUK PERIODE
========================================= */

function isDateInPeriod(dateValue, period){

    if(!dateValue){
        return false;
    }

    /*
       DASHBOARD CUSTOM MENGGUNAKAN RENTANG TANGGAL
       MILIK DASHBOARD, bukan filter Laporan.
    */
    if(period === "custom"){

        const date =
            getReportDateOnly(dateValue);

        if(!date){
            return false;
        }

        const range =
            getDashboardDateRange();

        if(range.from && date < range.from){
            return false;
        }

        if(range.to && date > range.to){
            return false;
        }

        return true;
    }

    /*
       Periode standar tetap memakai logika Laporan.
       Semua perhitungan tanggal mengikuti WIB/Indonesia.
    */
    return isTransactionInReportPeriod(
        { reportDate: dateValue },
        period
    );

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


/* Dashboard lifecycle helpers relocated unchanged from main.js. */

function getSellerBooksDayKey(){
    return getIndonesiaTodayKey();
}



function sellerBooksSyncDashboardFilterState(){
    const prefs = sellerBooksReadDashboardPreferences();

    sellerBooksDashboardFilterState = {
        period:prefs.period || "today",
        dateFrom:prefs.dateFrom || "",
        dateTo:prefs.dateTo || "",
        viewDay:prefs.viewDay || ""
    };

    currentDashboardPeriod =
        sellerBooksDashboardFilterState.period;

    return sellerBooksDashboardFilterState;
}

function sellerBooksSetDashboardFilterState(patch){
    sellerBooksDashboardFilterState = {
        ...sellerBooksDashboardFilterState,
        ...(patch || {})
    };

    if(sellerBooksDashboardFilterState.period){
        currentDashboardPeriod =
            sellerBooksDashboardFilterState.period;
    }

    return sellerBooksDashboardFilterState;
}

function prepareDailyViewState(forceToday = false){
    const todayKey = getSellerBooksDayKey();
    let dashboardChanged = false;
    let reportChanged = false;
    let productAnalysisChanged = false;

    const dashboardDay = sellerBooksGetDashboardPreference("viewDay", "");
    if(forceToday || dashboardDay !== todayKey){
        sellerBooksWriteDashboardPreferences({
            viewDay:todayKey,
            period:"today"
        });
        dashboardChanged = true;
    }

    const reportDay = sellerBooksGetIndependentViewPreference(
        "report",
        "viewDay",
        ""
    );

    if(forceToday || reportDay !== todayKey){
        sellerBooksWriteIndependentViewPreferences("report",{
            viewDay:todayKey,
            period:"today",
            dateFrom:"",
            dateTo:""
        });
        reportChanged = true;
    }

    const productAnalysisDay = sellerBooksGetIndependentViewPreference(
        "productAnalysis",
        "viewDay",
        ""
    );

    if(forceToday || productAnalysisDay !== todayKey){
        sellerBooksWriteIndependentViewPreferences("productAnalysis",{
            viewDay:todayKey,
            period:"today",
            dateFrom:"",
            dateTo:""
        });
        productAnalysisChanged = true;
    }

    if(reportChanged){
        const reportPeriod =
            document.getElementById("reportPeriod");
        if(reportPeriod) reportPeriod.value = "today";

        const reportDateFrom =
            document.getElementById("reportDateFrom");
        const reportDateTo =
            document.getElementById("reportDateTo");
        if(reportDateFrom) reportDateFrom.value = "";
        if(reportDateTo) reportDateTo.value = "";
    }

    if(productAnalysisChanged){
        const productAnalysisPeriod =
            document.getElementById("productAnalysisPeriod");
        if(productAnalysisPeriod) productAnalysisPeriod.value = "today";

        const productAnalysisDateFrom =
            document.getElementById("productAnalysisDateFrom");
        const productAnalysisDateTo =
            document.getElementById("productAnalysisDateTo");
        if(productAnalysisDateFrom) productAnalysisDateFrom.value = "";
        if(productAnalysisDateTo) productAnalysisDateTo.value = "";
    }

    return {
        todayKey: todayKey,
        dashboardChanged: dashboardChanged,
        reportChanged: reportChanged,
        productAnalysisChanged: productAnalysisChanged
    };
}

/* Preferensi tampilan diinisialisasi setelah Auth + data cloud siap,
   sehingga key lokal selalu terikat ke user yang sedang login. */
/* =========================================
   DASHBOARD FILTER PERIODE
========================================= */



/*
   Cek rollover hari berdasarkan WIB setiap menit.
   Jadi ketika browser tetap terbuka melewati 00:00 WIB,
   Dashboard tidak tetap memakai "Hari Kemarin".
*/
let sellerBooksLastWibDayKey = getSellerBooksDayKey();

function sellerBooksCheckWibDayRollover(){
    const todayKey = getSellerBooksDayKey();

    if(!todayKey || todayKey === sellerBooksLastWibDayKey){
        return;
    }

    sellerBooksLastWibDayKey = todayKey;

    const state = prepareDailyViewState();

    if(state.dashboardChanged){
        sellerBooksSetDashboardFilterState({
            period:"today",
            viewDay:todayKey
        });

        currentDashboardPeriod = "today";

        const dashboardPeriod =
            document.getElementById("dashboardPeriod");

        if(dashboardPeriod){
            dashboardPeriod.value = "today";
        }

        dashboardCustomDateConfirmed = true;

        if(typeof updateDashboardCustomDateUI === "function"){
            updateDashboardCustomDateUI();
        }

        if(typeof updateDashboardByPeriod === "function"){
            updateDashboardByPeriod();
        }
    }

    if(state.reportChanged){
        const reportPeriod =
            document.getElementById("reportPeriod");

        if(reportPeriod){
            reportPeriod.value = "today";
        }

        const reportDateFrom =
            document.getElementById("reportDateFrom");
        const reportDateTo =
            document.getElementById("reportDateTo");
        if(reportDateFrom) reportDateFrom.value = "";
        if(reportDateTo) reportDateTo.value = "";

        if(typeof updateReportCustomDateUI === "function"){
            updateReportCustomDateUI();
        }

        if(typeof renderReport === "function"){
            renderReport();
        }
    }

    if(state.productAnalysisChanged){
        const productAnalysisPeriod =
            document.getElementById("productAnalysisPeriod");

        if(productAnalysisPeriod){
            productAnalysisPeriod.value = "today";
        }

        const productAnalysisDateFrom =
            document.getElementById("productAnalysisDateFrom");
        const productAnalysisDateTo =
            document.getElementById("productAnalysisDateTo");
        if(productAnalysisDateFrom) productAnalysisDateFrom.value = "";
        if(productAnalysisDateTo) productAnalysisDateTo.value = "";

        if(typeof updateProductAnalysisCustomDateUI === "function"){
            updateProductAnalysisCustomDateUI();
        }

        if(typeof renderProductAnalysis === "function"){
            renderProductAnalysis();
        }
    }
}



async function sellerBooksManualRefreshDashboard(){

    /*
       REFRESH TOMBOL DASHBOARD:
       Ambil ulang data langsung dari Supabase.
       Tidak melakukan setItem / penyimpanan ulang,
       sehingga tombol refresh tidak dapat menimpa data cloud.
    */

    if(!sellerBooksAuthUser){
        return;
    }

    try{

        const {data,error} =
            await sellerBooksSupabase
                .from("sellerbooks_user_data")
                .select("data")
                .eq(
                    "user_id",
                    sellerBooksAuthUser.id
                )
                .maybeSingle();

        if(error){
            console.error(
                "Refresh Dashboard dari Supabase gagal:",
                error
            );
            return;
        }

        sellerBooksCloudState =
            (data &&
             data.data &&
             typeof data.data === "object")
                ? {...data.data}
                : {};

        sellerBooksCloudReady = true;
        sellerBooksSaveFastCache();

        if(
            typeof sellerBooksRefreshRuntimeFromCloud ===
            "function"
        ){
            sellerBooksRefreshRuntimeFromCloud();
        }

        if(
            typeof updateDashboardByPeriod ===
            "function"
        ){
            updateDashboardByPeriod();
        }

    }catch(error){

        console.error(
            "Refresh Dashboard dari Supabase gagal:",
            error
        );

    }

}

function refreshDashboard(){

    /* REFRESH DASHBOARD */
    prepareDailyViewState();

    const periodSelect =
        document.getElementById(
            "dashboardPeriod"
        );

    const savedPeriod =
        sellerBooksGetDashboardPreference(
            "period",
            "today"
        );

    if(
        savedPeriod &&
        periodSelect
    ){
        periodSelect.value = savedPeriod;
        currentDashboardPeriod = savedPeriod;
    }

    loadDashboardCustomDates();
    updateDashboardByPeriod();

}

