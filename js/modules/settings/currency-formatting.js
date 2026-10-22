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
        }    ).format(value || 0);

}



