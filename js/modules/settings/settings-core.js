/* =====================================================
   SELLERBOOKS SETTINGS CORE
   Existing settings/currency functions remain classic-script globals.
   Shared storage, language state, and UI handlers remain in their
   current owners; these functions are relocated without rewrites.
===================================================== */

function getSellerBooksSettings(){
    try{
        const saved =
            JSON.parse(
                sellerBooksStorage.getItem(
                    SELLERBOOKS_SETTINGS_KEY
                ) || "{}"
            );

        const normalizedSaved =
            saved && typeof saved === "object"
                ? saved
                : {};

        return {            ...DEFAULT_SELLERBOOKS_SETTINGS,
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

    sellerBooksStorage.setItem(
        SELLERBOOKS_SETTINGS_KEY,
        JSON.stringify(settings)
    );

    /*
       Sinkronkan biaya packing dengan konfigurasi
       packing yang sudah digunakan oleh import.
    */
    sellerBooksStorage.setItem(
        "sellerbooks_packing_unit_cost",
        String(packingCost)
    );

    applySellerBooksSettings();

    sellerBooksApplySettingsLanguage();

    const nameInfo =
        document.getElementById(
            "settingsBusinessNameInfo"
        );

    if(nameInfo){
        nameInfo.textContent =
            sellerBooksSettingsText("saved");
    }

    const packingInfo =
        document.getElementById(
            "settingsPackingInfo"
        );

    if(packingInfo){
        packingInfo.textContent =
            sellerBooksSettingsText("packingInfo") +
            " " + formatRupiah(packingCost) +
            " / order.";
    }

    const currencyInfo =
        document.getElementById(
            "settingsCurrencyInfo"
        );

    if(currencyInfo){
        currencyInfo.textContent =
            sellerBooksSettingsText("rateInfo") + " " +
            "1 USD = Rp" + Number(exchangeRates.USD).toLocaleString("id-ID") +
            " • 1 SGD = Rp" + Number(exchangeRates.SGD).toLocaleString("id-ID") +
            " • 1 MYR = Rp" + Number(exchangeRates.MYR).toLocaleString("id-ID");
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
            sellerBooksSettingsText("packingInfo") + " " +
            formatRupiah(Number(settings.packingCost) || 0) +
            " / order.";
    }

    renderSettingsLogo();
    /*
       Membuka Pengaturan hanya memuat form.
       Jangan render ulang Dashboard/Laporan/Rincian/halaman lain
       hanya karena user membuka menu Pengaturan.
    */
    applySellerBooksSettings(false);
    sellerBooksSyncLanguageControl();
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


function applySellerBooksSettings(refreshViews = true){
    renderSettingsLogo();

    if(!refreshViews){
        return;
    }

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

        /*
           Piutang adalah modul terpisah, tetapi seluruh nominal
           tampilannya harus mengikuti mata uang/kurs Settings.
        */
        if(typeof window.sbPiutangCloudRender === "function"){
            window.sbPiutangCloudRender();
        }
    }catch(error){
        console.warn(
            "Refresh tampilan mata uang gagal:",
            error
        );
    }
}
