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
