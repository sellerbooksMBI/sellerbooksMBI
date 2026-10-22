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
