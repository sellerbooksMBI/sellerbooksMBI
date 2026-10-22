/* =====================================================
   SELLERBOOKS SALES IMPORT WORKFLOW
   Existing file analysis, preview, confirmation and duplicate-check functions, relocated unchanged.
===================================================== */

function normalizeHeader(value){

    return String(value || "")

        .toLowerCase()

        .trim()

        .replace(/[_\-]+/g," ")

        .replace(/\s+/g," ");

}



/*
========================================================
CARI KOLOM TERBAIK
========================================================
*/

function findBestColumn(headers,keywords){

    let bestMatch = null;

    let bestScore = 0;


    headers.forEach(function(header){


        const normalizedHeader =

            normalizeHeader(header);



        keywords.forEach(function(keyword){


            const normalizedKeyword =

                normalizeHeader(keyword);



            let score = 0;



            /*
            EXACT MATCH
            */

            if(

                normalizedHeader ===
                normalizedKeyword

            ){

                score = 100;

            }



            /*
            HEADER MENGANDUNG KEYWORD
            */

            else if(

                normalizedHeader.includes(
                    normalizedKeyword
                )

            ){

                score = 80;

            }



            /*
            KEYWORD MENGANDUNG HEADER
            */

            else if(

                normalizedKeyword.includes(
                    normalizedHeader
                )

            ){

                score = 60;

            }



            if(score > bestScore){

                bestScore = score;

                bestMatch = header;

            }


        });


    });



    return {

        column:bestMatch,

        score:bestScore

    };

}



/*
========================================================
ANALYZE FILE
========================================================
*/

async function analyzeSalesFile(input){


    const file = input.files[0];


    if(!file){

        return;

    }



    /*
    VALIDASI FORMAT
    */

    const fileName =

        file.name.toLowerCase();



    const supportedFormats = [

        ".xlsx",

        ".xls",

        ".csv"

    ];



    const validFormat =

        supportedFormats.some(function(format){

            return fileName.endsWith(format);

        });



    if(!validFormat){


        sellerBooksAlert(

            sellerBooksSalesImportText("unsupported")

        );


        input.value = "";

        return;

    }



    /*
    CEK SHEETJS
    */

    if(!(await sellerBooksEnsureXLSX())){
        return;
    }



    /*
    TAMPILKAN STATUS
    */

    const analysisBox =

        document.getElementById(
            "salesImportAnalysis"
        );


    analysisBox.style.display = "block";


    document.getElementById(
        "analysisStatus"
    ).innerText =

        sellerBooksSalesImportText("readingFile");


    document.getElementById(
        "continueSalesImportButton"
    ).disabled = true;



    /*
    FILE READER
    */

    const reader = new FileReader();



    reader.onload = function(event){


        try{


            const workbook =

                XLSX.read(

                    event.target.result,

                    {

                        type:"array"

                    }

                );



            /*
            AMBIL SHEET PERTAMA
            UNTUK FASE AWAL
            */

            const firstSheetName =

                workbook.SheetNames[0];


            const worksheet =

                workbook.Sheets[
                    firstSheetName
                ];



            /*
            CONVERT KE ARRAY
            */

            const rawData =

                XLSX.utils.sheet_to_json(

                    worksheet,

                    {

                        header:1,

                        defval:""

                    }

                );



            if(rawData.length < 2){


                sellerBooksAlert(

                    sellerBooksSalesImportText("insufficient")

                );


                resetSalesImport();

                return;

            }



            /*
            CARI HEADER YANG VALID

            Engine memeriksa beberapa
            baris pertama karena laporan
            marketplace kadang memiliki
            judul laporan di atas header.
            */

            let headerRowIndex = -1;

            let headers = [];



            const maxCheckRows =

                Math.min(

                    rawData.length,

                    15

                );



            for(

                let i = 0;

                i < maxCheckRows;

                i++

            ){


                const row = rawData[i];


                const nonEmptyValues =

                    row.filter(function(value){

                        return String(value).trim() !== "";

                    });


                /*
                HEADER minimal memiliki
                2 kolom terisi
                */

                if(nonEmptyValues.length >= 2){


                    const possibleHeaders =

                        row.map(function(value){

                            return String(value).trim();

                        });


                    /*
                    CEK APAKAH ADA KATA SKU
                    ATAU QTY
                    */

                    const skuTest =

                        findBestColumn(

                            possibleHeaders,

                            SKU_KEYWORDS

                        );


                    const qtyTest =

                        findBestColumn(

                            possibleHeaders,

                            QTY_KEYWORDS

                        );



                    if(

                        skuTest.column ||

                        qtyTest.column

                    ){


                        headerRowIndex = i;

                        headers = possibleHeaders;

                        break;

                    }

                }

            }



            /*
            JIKA TIDAK MENEMUKAN
            HEADER BERDASARKAN SKU/QTY
            GUNAKAN BARIS PERTAMA
            */

            if(headerRowIndex === -1){


                headerRowIndex = 0;


                headers =

                    rawData[0].map(function(value){

                        return String(value).trim();

                    });

            }



            /*
            HAPUS HEADER KOSONG
            TAPI TETAP PERTAHANKAN POSISI
            UNTUK ANALISIS
            */

            const cleanHeaders =

                headers.filter(function(header){

                    return header !== "";

                });



            /*
            CARI SKU
            */

            let skuResult =

                findBestColumn(

                    cleanHeaders,

                    SKU_KEYWORDS

                );



            /*
            CARI QTY
            */

            let qtyResult =

                findBestColumn(

                    cleanHeaders,

                    QTY_KEYWORDS

                );


            /* =================================================
               KHUSUS LAZADA
               Tidak ada kolom QTY di file Lazada.
               SKU wajib sellerSku.
               QTY dihitung dari jumlah kemunculan sellerSku.
            ================================================= */
            const detectedLazada =

                detectSalesMarketplace(

                    cleanHeaders,

                    file.name

                ).marketplace === "Lazada";


            if(detectedLazada){

                const lazadaSkuResult =

                    findBestColumn(

                        cleanHeaders,

                        [

                            "sellersku",

                            "seller sku"

                        ]

                    );

                if(lazadaSkuResult.column){

                    skuResult = lazadaSkuResult;

                }

                qtyResult = {

                    column:"__LAZADA_QTY_BY_SELLERSKU__",

                    score:100

                };

            }

            /* =================================================
               KHUSUS SHOPEE
               File REGULER memiliki kolom Jumlah.
               File KILAT/Advance Fulfilment dapat tidak memiliki
               kolom Jumlah dan No. Pesanan. Dalam kondisi itu
               setiap baris SKU dihitung 1 pcs.
               SKU tetap dicari dari Nomor Referensi SKU.
            ================================================= */
            const detectedShopee =
                detectSalesMarketplace(
                    cleanHeaders,
                    file.name
                ).marketplace === "Shopee";

            if(detectedShopee){

                const shopeeSkuResult =
                    findBestColumn(
                        cleanHeaders,
                        [
                            "nomor referensi sku"
                        ]
                    );

                if(shopeeSkuResult.column){
                    skuResult = shopeeSkuResult;
                }

                const shopeeQtyResult =
                    findBestColumn(
                        cleanHeaders,
                        [
                            "jumlah"
                        ]
                    );

                qtyResult = shopeeQtyResult.column
                    ? shopeeQtyResult
                    : {
                        column:"__SHOPEE_QTY_PER_ROW__",
                        score:100
                    };
            }



            /*
            JUMLAH BARIS DATA
            */

            const dataRows =

                rawData.slice(

                    headerRowIndex + 1

                )

                .filter(function(row){


                    return row.some(function(value){

                        return String(value).trim() !== "";

                    });


                });



            /*
            SIMPAN HASIL ANALISIS
            */

            currentSalesImport = {

                file:file,

                fileName:file.name,

                fileType:

                    fileName.split(".").pop()

                    .toUpperCase(),


                sheetName:

                    firstSheetName,


                rawData:rawData,


                headerRowIndex:

                    headerRowIndex,


                headers:

                    cleanHeaders,


                dataRows:

                    dataRows,


                skuColumn:

                    skuResult.column,


                skuScore:

                    skuResult.score,


                qtyColumn:

                    qtyResult.column,


                qtyScore:

                    qtyResult.score,

                marketplace:
                    detectSalesMarketplace(cleanHeaders,file.name).marketplace,

                marketplaceScore:
                    detectSalesMarketplace(cleanHeaders,file.name).score,

                skuIndex:
                    skuResult.column
                        ? cleanHeaders.indexOf(skuResult.column)
                        : -1,

                qtyIndex:
                    detectedLazada ||
                    (detectedShopee && qtyResult.column === "__SHOPEE_QTY_PER_ROW__")
                        ? -1
                        : (
                            qtyResult.column
                                ? cleanHeaders.indexOf(qtyResult.column)
                                : -1
                        ),

                /* Lazada: Harga Jual wajib dari kolom AV (index 47). */
                priceColumn:
                    detectedLazada
                        ? (cleanHeaders[47] || "unitPrice")
                        : null,

                priceIndex:
                    detectedLazada
                        ? 47
                        : -1

            };



            /*
            TAMPILKAN HASIL
            */

            renderSalesAnalysis();


        }

        catch(error){


            console.error(error);


            sellerBooksAlert(

                sellerBooksSalesImportText("unreadable") +
                (sellerBooksCurrentLanguage()==="en" ? "\n\nMake sure the file is not corrupted." : "\n\nPastikan file tidak rusak.")

            );


            resetSalesImport();

        }


    };



    reader.readAsArrayBuffer(file);

}



/*
========================================================
RENDER HASIL ANALISIS
========================================================
*/

function renderSalesAnalysis(){


    if(!currentSalesImport){

        return;

    }



    const data =

        currentSalesImport;

    const marketplaceElement=document.getElementById("detectedMarketplaceName");
    if(marketplaceElement) marketplaceElement.value=data.marketplace?data.marketplace+" ✓":sellerBooksSalesImportText("notDetected");




    /*
    FILE INFO
    */

    document.getElementById(

        "analysisFileName"

    ).innerText =

        data.fileName;



    document.getElementById(

        "analysisFileType"

    ).innerText =

        data.fileType;



    document.getElementById(

        "analysisRowCount"

    ).innerText =

        data.dataRows.length
        .toLocaleString("id-ID");



    document.getElementById(

        "analysisColumnCount"

    ).innerText =

        data.headers.length;



    /*
    STATUS
    */

    const statusElement =

        document.getElementById(
            "analysisStatus"
        );


    /*
    SKU
    */

    const skuResultElement =

        document.getElementById(
            "skuRecognitionResult"
        );


    const skuConfidenceElement =

        document.getElementById(
            "skuRecognitionConfidence"
        );


    if(data.skuColumn){


        skuResultElement.innerText =

            data.skuColumn;


        skuConfidenceElement.innerText =

            sellerBooksSalesImportText("autoDetected") +

            data.skuScore +

            sellerBooksSalesImportText("matchSuffix");


    }

    else{


        skuResultElement.innerText =

            sellerBooksSalesImportText("notFound");


        skuConfidenceElement.innerText =

            sellerBooksSalesImportText("skuNotRecognized");

    }



    /*
    QTY
    */

    const qtyResultElement =

        document.getElementById(
            "qtyRecognitionResult"
        );


    const qtyConfidenceElement =

        document.getElementById(
            "qtyRecognitionConfidence"
        );


    if(
        data.marketplace === "Lazada"
    ){

        qtyResultElement.innerText =

            sellerBooksSalesImportText("lazadaQty");

        qtyConfidenceElement.innerText =

            sellerBooksSalesImportText("lazadaQtyInfo");

    }

    else if(
        data.marketplace === "Shopee" &&
        data.qtyColumn === "__SHOPEE_QTY_PER_ROW__"
    ){

        qtyResultElement.innerText =
            sellerBooksSalesImportText("shopeeQty");

        qtyConfidenceElement.innerText =
            sellerBooksSalesImportText("shopeeQtyInfo");

    }

    else if(data.qtyColumn){


        qtyConfidenceElement.innerText =

            sellerBooksSalesImportText("autoDetected") +

            data.qtyScore +

            sellerBooksSalesImportText("matchSuffix");


    }

    else{


        qtyResultElement.innerText =

            sellerBooksSalesImportText("notFound");


        qtyConfidenceElement.innerText =

            sellerBooksSalesImportText("qtyNotRecognized");

    }


    /* =====================================================
       HARGA JUAL RECOGNITION - KHUSUS LAZADA
       Sumber wajib: kolom AV = unitPrice
    ===================================================== */

    const lazadaPriceCard =
        document.getElementById("lazadaPriceRecognitionCard");

    const lazadaPriceResult =
        document.getElementById("lazadaPriceRecognitionResult");

    const lazadaPriceConfidence =
        document.getElementById("lazadaPriceRecognitionConfidence");

    if(data.marketplace === "Lazada"){

        if(lazadaPriceCard){
            lazadaPriceCard.style.display = "";
        }

        if(lazadaPriceResult){
            lazadaPriceResult.innerText =
                sellerBooksSalesImportText("lazadaPrice");
        }

        if(lazadaPriceConfidence){
            lazadaPriceConfidence.innerText =
                sellerBooksSalesImportText("lazadaPriceInfo");
        }

    }else{

        if(lazadaPriceCard){
            lazadaPriceCard.style.display = "none";
        }

    }



    /*
    HEADER TAGS
    */

    const headersContainer =

        document.getElementById(
            "detectedHeaders"
        );


    headersContainer.innerHTML = "";



    data.headers.forEach(function(header){


        const tag =

            document.createElement("div");


        tag.className =

            "header-tag";


        /*
        TANDAI SKU
        */

        if(

            header === data.skuColumn

        ){

            tag.classList.add(
                "sku-header"
            );

        }


        /*
        TANDAI QTY
        */

        if(

            header === data.qtyColumn

        ){

            tag.classList.add(
                "qty-header"
            );

        }


        tag.innerText = header;


        headersContainer.appendChild(tag);


    });



    /*
    VALIDASI
    */

    const continueButton =

        document.getElementById(
            "continueSalesImportButton"
        );



    if(

        data.skuColumn &&

        data.qtyColumn

    ){


        statusElement.innerText =

            sellerBooksSalesImportText("statusFound");


        continueButton.disabled = false;

    }

    else{


        statusElement.innerText =

            sellerBooksSalesImportText("statusManual");


        continueButton.disabled = true;

    }

}



/* =====================================================
   RESET IMPORT PENJUALAN - KEMBALI KE AWAL
===================================================== */

function resetSalesImport(){

    /* RESET DATA SEMENTARA */
    currentSalesImport = null;


    /* RESET INPUT FILE */
    const fileInput =
        document.getElementById(
            "salesImportFile"
        );

    if(fileInput){
        fileInput.value = "";
    }


    /* SEMBUNYIKAN HASIL ANALISIS */
    const analysisBox =
        document.getElementById(
            "salesImportAnalysis"
        );

    if(analysisBox){
        analysisBox.style.display = "none";
    }


    /* RESET KOLOM SKU */
    const skuSelect =
        document.getElementById(
            "manualSkuColumn"
        );

    if(skuSelect){

        skuSelect.innerHTML =
            '<option value="">'+sellerBooksSalesImportText("chooseSku")+'</option>';

        skuSelect.value = "";

    }


    /* RESET KOLOM QTY */
    const qtySelect =
        document.getElementById(
            "manualQtyColumn"
        );

    if(qtySelect){

        qtySelect.innerHTML =
            '<option value="">'+sellerBooksSalesImportText("chooseQty")+'</option>';

        qtySelect.value = "";

    }


    /* RESET MARKETPLACE */
    const marketplace =
        document.getElementById(
            "detectedMarketplaceName"
        );

    if(marketplace){
        marketplace.value =
            sellerBooksSalesImportText("notDetected");
    }


    /* RESET AKUN TOKO */
    const storeSelect =
        document.getElementById(
            "salesStoreAccount"
        );

    if(storeSelect){

        storeSelect.innerHTML =
            '<option value="">'+sellerBooksSalesImportText("chooseStore")+'</option>';

        storeSelect.value = "";

    }


    /* RESET INFO AKUN */
    const storeInfo =
        document.getElementById(
            "salesStoreAccountInfo"
        );

    if(storeInfo){

        storeInfo.innerText =
            sellerBooksSalesImportText("storeRequired");

        storeInfo.style.color = "";

    }


    /* RESET BIAYA PACKING */
    const packingInput =
        document.getElementById(
            "packingCostPerOrder"
        );

    if(packingInput){
        packingInput.value = "";
    }


    /* RESET HASIL PACKING */
    const packingCount =
        document.getElementById(
            "uniquePackingCount"
        );

    if(packingCount){
        packingCount.innerText = "0";
    }


    const packingTotal =
        document.getElementById(
            "totalPackingImportCost"
        );

    if(packingTotal){
        packingTotal.innerText = "Rp 0";
    }


    const packingInfo =
        document.getElementById(
            "packingIdentifierInfo"
        );

    if(packingInfo){

        packingInfo.innerText =
            sellerBooksSalesImportText("packingIdentifier");

    }


    /* RESET STATUS VALIDASI */
    const validation =
        document.getElementById(
            "previewValidationStatus"
        );

    if(validation){

        validation.className =
            "preview-validation-status";

        validation.innerText =
            sellerBooksSalesImportText("validationChoose");

    }


    /* RESET STATUS ANALISIS */
    const analysisStatus =
        document.getElementById(
            "analysisStatus"
        );

    if(analysisStatus){

        analysisStatus.innerText =
            sellerBooksSalesImportText("waitingAnalysis");

    }


    /* RESET INFO FILE */
    const fileName =
        document.getElementById(
            "analysisFileName"
        );

    if(fileName){
        fileName.innerText = "-";
    }


    const fileType =
        document.getElementById(
            "analysisFileType"
        );

    if(fileType){
        fileType.innerText = "-";
    }


    const rowCount =
        document.getElementById(
            "analysisRowCount"
        );

    if(rowCount){
        rowCount.innerText = "0";
    }


    /* RESET TOMBOL LANJUTKAN */
    const continueButton =
        document.getElementById(
            "continueSalesImportButton"
        );

    if(continueButton){
        continueButton.disabled = true;
    }


    /* RESET TOMBOL KONFIRMASI */
    const confirmButton =
        document.getElementById(
            "confirmSalesColumnsButton"
        );

    if(confirmButton){
        confirmButton.disabled = true;
    }

    /* RESET PREVIEW */
    const previewFileName =
        document.getElementById(
            "previewFileName"
        );

    if(previewFileName){
        previewFileName.innerText = "-";
    }


    const previewRowCount =
        document.getElementById(
            "previewRowCount"
        );

    if(previewRowCount){
        previewRowCount.innerText = "0";
    }

}



/* =====================================================
   FASE 2 - LANJUT KE PREVIEW
===================================================== */

function continueSalesImport(){

    if(!currentSalesImport){

        sellerBooksAlert(
            sellerBooksSalesImportText("noFile")
        );

        return;

    }

    openSalesPreview();

}


/* =====================================================
   FASE 2 - OPEN SALES PREVIEW
===================================================== */

function openSalesPreview(){


    /*
    PASTIKAN ADA DATA FILE
    */

    if(!currentSalesImport){

        return;

    }


    /*
    AMBIL DATA HASIL ANALISIS FASE 1
    */

    const data = currentSalesImport;



    /* =========================================
       TAMPILKAN NAMA FILE
    ========================================= */

    document.getElementById(
        "previewFileName"
    ).innerText = data.fileName;



    /* =========================================
       TAMPILKAN JUMLAH BARIS DATA
    ========================================= */

    document.getElementById(
        "previewRowCount"
    ).innerText =

        data.dataRows.length
        .toLocaleString("id-ID");



    /* =========================================
       AMBIL DROPDOWN SKU
    ========================================= */

    const skuSelect =

        document.getElementById(
            "manualSkuColumn"
        );



    /* =========================================
       AMBIL DROPDOWN QTY
    ========================================= */

    const qtySelect =

        document.getElementById(
            "manualQtyColumn"
        );



    /* =========================================
       KOSONGKAN DROPDOWN SEBELUM DIISI ULANG
    ========================================= */

    skuSelect.innerHTML =

        '<option value="">'+sellerBooksSalesImportText("chooseSku")+'</option>';


    qtySelect.innerHTML =

        '<option value="">'+sellerBooksSalesImportText("chooseQty")+'</option>';


    /* =========================================
       KHUSUS LAZADA:
       QTY bukan kolom fisik.
       SellerBooks menghitung jumlah kemunculan sellerSku.
    ========================================= */

    if(data.marketplace === "Lazada"){

        const lazadaQtyOption =

            document.createElement("option");

        lazadaQtyOption.value =
            "__LAZADA_QTY_BY_SELLERSKU__";

        lazadaQtyOption.textContent =
            sellerBooksSalesImportText("lazadaQty");

        qtySelect.appendChild(
            lazadaQtyOption
        );

        qtySelect.value = "__LAZADA_QTY_BY_SELLERSKU__";

    }

    if(
        data.marketplace === "Shopee" &&
        data.qtyColumn === "__SHOPEE_QTY_PER_ROW__"
    ){
        const shopeeQtyOption = document.createElement("option");
        shopeeQtyOption.value = "__SHOPEE_QTY_PER_ROW__";
        shopeeQtyOption.textContent = sellerBooksSalesImportText("shopeeQty");
        qtySelect.appendChild(shopeeQtyOption);
        qtySelect.value = "__SHOPEE_QTY_PER_ROW__";
    }



    /* =========================================
       MASUKKAN SEMUA HEADER FILE
       KE DROPDOWN
    ========================================= */

    data.headers.forEach(function(header){


        /*
        OPTION UNTUK SKU
        */

        const skuOption =

            document.createElement("option");


        skuOption.value = header;

        skuOption.textContent = header;


        skuSelect.appendChild(
            skuOption
        );



        /*
        OPTION UNTUK QTY
        */

        const qtyOption =

            document.createElement("option");


        qtyOption.value = header;

        qtyOption.textContent = header;


        qtySelect.appendChild(
            qtyOption
        );


    });



    /* =========================================
       AUTO PILIH SKU
       JIKA SUDAH DITEMUKAN ENGINE
    ========================================= */

    if(data.skuColumn){

        skuSelect.value =
            data.skuColumn;

    }



    /* =========================================
       AUTO PILIH QTY
       JIKA SUDAH DITEMUKAN ENGINE
    ========================================= */

    if(data.qtyColumn){

        qtySelect.value =
            data.qtyColumn;

    }



    /* =========================================
       BUKA MODAL PREVIEW
    ========================================= */

const marketplaceElement=document.getElementById("detectedMarketplaceName");
    if(marketplaceElement) marketplaceElement.value=data.marketplace?data.marketplace+" ✓":"Tidak dikenali";
    populateSalesStoreAccounts();
    const packingInput=document.getElementById("packingCostPerOrder");
    if(packingInput) packingInput.value=sellerBooksStorage.getItem("sellerbooks_packing_unit_cost")||"";
    updatePackingCalculation();

document.getElementById(
    "salesPreviewModal"
).classList.add(
    "active"
);

updatePreviewColumns();

}
/* =====================================================
   FASE 2 - UPDATE PREVIEW COLUMNS
===================================================== */

function updatePreviewColumns(){


    /*
    PASTIKAN DATA IMPORT ADA
    */

    if(!currentSalesImport){

        return;

    }


    /* =========================================
       AMBIL PILIHAN KOLOM SKU
    ========================================= */

    const skuColumn =

        document.getElementById(
            "manualSkuColumn"
        ).value;



    /* =========================================
       AMBIL PILIHAN KOLOM QTY
    ========================================= */

    const qtyColumn =

        document.getElementById(
            "manualQtyColumn"
        ).value;



    /* =========================================
       AMBIL STATUS VALIDASI
    ========================================= */

    const statusElement =

        document.getElementById(
            "previewValidationStatus"
        );



    /* =========================================
       AMBIL TOMBOL KONFIRMASI
    ========================================= */

    const confirmButton =

        document.getElementById(
            "confirmSalesColumnsButton"
        );



    /*
    RESET STATUS
    */

    statusElement.className =

        "preview-validation-status";


    confirmButton.disabled = true;



    /* =========================================
       KONDISI 1:
       SKU ATAU QTY BELUM DIPILIH
    ========================================= */

    const isLazadaImport =

        currentSalesImport.marketplace === "Lazada";

    const isShopeePerRow =
        currentSalesImport.marketplace === "Shopee" &&
        qtyColumn === "__SHOPEE_QTY_PER_ROW__";


    if(

    !skuColumn ||

    (!qtyColumn && !isLazadaImport)

){


    statusElement.innerText =

        isLazadaImport

            ? sellerBooksSalesImportText("lazadaQtyInfo")

            : sellerBooksSalesImportText("validationChoose");


    /*
    UPDATE PREVIEW TABLE
    */

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );


    return;

}


    /* =========================================
       KONDISI 2:
       SKU DAN QTY TIDAK BOLEH SAMA
    ========================================= */

    if(

    !isLazadaImport &&
    !isShopeePerRow &&

    skuColumn === qtyColumn

){


    statusElement.classList.add(

        "error"

    );


    statusElement.innerText =

        sellerBooksSalesImportText("sameColumns");


    /*
    TETAP UPDATE PREVIEW
    */

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );


    return;

}



    /* =========================================
       KONDISI 3:
       SEMUA SUDAH BENAR
    ========================================= */

    statusElement.classList.add(

        "success"

    );


    statusElement.innerText =

        isLazadaImport

            ? sellerBooksSalesImportText("lazadaReady")

            : isShopeePerRow
                ? sellerBooksSalesImportText("shopeeReady")
                : sellerBooksSalesImportText("columnsReady");


    /*
    AKTIFKAN TOMBOL KONFIRMASI
    */

    confirmButton.disabled = false;

/*
UPDATE PREVIEW TABLE
*/

renderPreviewTable(
    skuColumn,
    qtyColumn
);

    /*
    LANGKAH 6 NANTI:

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );

    */

}

/* =====================================================
   FASE 2 - RENDER PREVIEW TABLE
===================================================== */

function renderPreviewTable(

    skuColumn,

    qtyColumn

){


    /*
    AMBIL BAGIAN BODY TABLE
    */

    const body =

        document.getElementById(
            "previewTableBody"
        );



    /*
    AMBIL HEADER SKU
    */

    const skuHeader =

        document.getElementById(
            "previewSkuHeader"
        );



    /*
    AMBIL HEADER QTY
    */

    const qtyHeader =

        document.getElementById(
            "previewQtyHeader"
        );



    /*
    KOSONGKAN DATA TABLE LAMA
    */

    body.innerHTML = "";



    /*
    UBAH NAMA HEADER SESUAI
    KOLOM YANG DIPILIH CLIENT
    */

    skuHeader.innerText =

        skuColumn || "SKU";


    qtyHeader.innerText =

        (
            currentSalesImport &&
            currentSalesImport.marketplace === "Lazada"
        )
            ? "QTY • sellerSku"
            : (
                currentSalesImport &&
                currentSalesImport.marketplace === "Shopee" &&
                qtyColumn === "__SHOPEE_QTY_PER_ROW__"
            )
                ? (sellerBooksCurrentLanguage()==="en" ? "QTY • 1 pc/row" : "QTY • 1 pcs/baris")
                : (qtyColumn || "QTY");



    /*
    PASTIKAN DATA IMPORT ADA
    */

    if(!currentSalesImport){

        return;

    }



    /*
    AMBIL DATA IMPORT
    */

    const data = currentSalesImport;



    /*
    CARI POSISI / INDEX
    KOLOM SKU
    */

    const skuIndex =

        data.headers.indexOf(
            skuColumn
        );



    /*
    CARI POSISI / INDEX
    KOLOM QTY
    */

    const qtyIndex =

        data.headers.indexOf(
            qtyColumn
        );



    /* =========================================
   BERSIHKAN BARIS KETERANGAN / INSTRUKSI
   BAWAAN FILE MARKETPLACE
========================================= */

const cleanRows = data.dataRows.filter(function(row){

    const skuValue = String(
        row[skuIndex] || ""
    )
    .trim()
    .toLowerCase();


    const qtyValue = String(
        row[qtyIndex] || ""
    )
    .trim()
    .toLowerCase();


    /*
    FILTER KHUSUS FILE TIKTOK

    Baris ini bukan transaksi,
    hanya keterangan bawaan export TikTok.
    */

    if(
        skuValue ===
        "seller sku input by the seller in the product system."
    ){

        return false;

    }


    if(
        qtyValue ===
        "sku sold quantity in the order."
    ){

        return false;

    }


    /*
    JANGAN TAMPILKAN BARIS
    YANG SKU DAN QTY-NYA SAMA-SAMA KOSONG
    */

    if(!skuValue && !qtyValue){

        return false;

    }


    return true;

});


/* =========================================
   TAMPILKAN SEMUA TRANSAKSI
   Nomor baris otomatis 1, 2, 3, dst.
========================================= */

const previewRows = cleanRows;



    /*
    LOOP SETIAP BARIS
    */

    previewRows.forEach(

        function(row,index){


            /*
            BUAT BARIS BARU
            */

            const tr =

                document.createElement(
                    "tr"
                );



            /*
            =====================
            NOMOR
            =====================
            */

            const numberCell =

                document.createElement(
                    "td"
                );


            numberCell.innerText =

                index + 1;



            /*
            =====================
            SKU
            =====================
            */

            const skuCell =

                document.createElement(
                    "td"
                );


            skuCell.innerText =

                skuIndex >= 0

                ? row[skuIndex] || ""

                : "";



            /*
            =====================
            QTY
            =====================
            */

            const qtyCell =

                document.createElement(
                    "td"
                );


            qtyCell.innerText =

                (
                    data.marketplace === "Lazada" ||
                    (
                        data.marketplace === "Shopee" &&
                        qtyColumn === "__SHOPEE_QTY_PER_ROW__"
                    )
                )

                ? "1"

                : (
                    qtyIndex >= 0
                        ? row[qtyIndex] || ""
                        : ""
                );



            /*
            MASUKKAN SEMUA CELL
            KE BARIS
            */

            tr.appendChild(
                numberCell
            );


            tr.appendChild(
                skuCell
            );


            tr.appendChild(
                qtyCell
            );



            /*
            MASUKKAN BARIS
            KE TABLE
            */

            body.appendChild(
                tr
            );


        }

    );


}

/* =====================================================
   FASE 2 - KONFIRMASI KOLOM FINAL
===================================================== */

async function confirmSalesColumns(){

    if(!currentSalesImport){

        sellerBooksAlert(
            sellerBooksSalesImportText("noImportData")
        );

        return;
    }


    const skuColumn =
        document.getElementById(
            "manualSkuColumn"
        ).value;


    const qtyColumn =
        document.getElementById(
            "manualQtyColumn"
        ).value;


    if(!skuColumn){

        sellerBooksAlert(
            sellerBooksSalesImportText("chooseSkuFirst")
        );

        return;
    }


    const isLazadaImport =

        currentSalesImport.marketplace === "Lazada";

    const isShopeePerRow =
        currentSalesImport.marketplace === "Shopee" &&
        qtyColumn === "__SHOPEE_QTY_PER_ROW__";


    if(
        !qtyColumn &&
        !isLazadaImport
    ){

        sellerBooksAlert(
            sellerBooksSalesImportText("chooseQtyFirst")
        );

        return;
    }


    if(
        !isLazadaImport &&
        !isShopeePerRow &&
        skuColumn === qtyColumn
    ){

        sellerBooksAlert(
            sellerBooksSalesImportText("sameColumns")
        );

        return;
    }


    currentSalesImport.skuColumn =
        skuColumn;

    currentSalesImport.qtyColumn =
        isLazadaImport
            ? "__LAZADA_QTY_BY_SELLERSKU__"
            : qtyColumn;

    currentSalesImport.skuIndex =
        currentSalesImport.headers.indexOf(
            skuColumn
        );

    currentSalesImport.qtyIndex =
        (isLazadaImport || isShopeePerRow)
            ? -1
            : currentSalesImport.headers.indexOf(
                qtyColumn
            );

    currentSalesImport.columnsConfirmed =
        true;

    currentSalesImport.confirmedAt =
        new Date().toISOString();


    if(!currentSalesImport.marketplace){

        sellerBooksAlert(
            sellerBooksSalesImportText("marketplaceUnknown")
        );

        return;
    }


    const storeId =
        document.getElementById(
            "salesStoreAccount"
        ).value;


    if(!storeId){

        sellerBooksAlert(
            sellerBooksSalesImportText("chooseStoreFirst")
        );

        return;
    }


    const packingInput =
        document.getElementById(
            "packingCostPerOrder"
        );


    if(
        !packingInput ||
        packingInput.value === ""
    ){

        sellerBooksAlert(
            sellerBooksSalesImportText("packingRequired")
        );

        return;
    }


    /* Tampilkan status segera dan cegah klik konfirmasi berulang. */
    const confirmButton=document.getElementById("confirmSalesColumnsButton");
    if(confirmButton && confirmButton.dataset.saving==="true")return;
    const originalButtonText=confirmButton ? confirmButton.textContent : "";
    if(confirmButton){
        confirmButton.dataset.saving="true";
        confirmButton.disabled=true;
        confirmButton.textContent=sellerBooksCurrentLanguage()==="en"
            ? "Saving… Please wait"
            : "Sedang menyimpan…";
        confirmButton.setAttribute("aria-busy","true");
    }
    const restoreConfirmButton=function(){
        if(!confirmButton)return;
        confirmButton.dataset.saving="false";
        confirmButton.disabled=false;
        confirmButton.textContent=originalButtonText;
        confirmButton.removeAttribute("aria-busy");
    };

    /* SIMPAN DATA */
    let record = null;

    try{
        record = saveSalesImportData();
    }catch(error){
        console.error("SellerBooks: saveSalesImportData gagal:", error);
        restoreConfirmButton();
        sellerBooksAlert(
            sellerBooksSalesImportText("saveError") +
            (error?.message || String(error))
        );

        return;
    }

    if(!record){

        restoreConfirmButton();
        sellerBooksAlert(
            sellerBooksSalesImportText("saveFailed")
        );

        return;
    }

    /* Jangan nyatakan import berhasil sebelum snapshot penjualan
       benar-benar tersimpan dan terkonfirmasi oleh Supabase. */
    try{
        if(typeof sellerBooksCloudSaveTimer!=="undefined" && sellerBooksCloudSaveTimer){
            clearTimeout(sellerBooksCloudSaveTimer);
            sellerBooksCloudSaveTimer=null;
        }
        const expectedSnapshot=sellerBooksCloneCloudState(sellerBooksCloudState);
        await sellerBooksPersistCloudDataStrict(expectedSnapshot,function(savedData){
            let savedImports=[];
            try{savedImports=JSON.parse(savedData["sellerbooks_sales_imports"]||"[]")||[];}catch(error){return false;}
            return savedImports.some(function(item){return String(item.id||"")===String(record.id||"");});
        });
    }catch(error){
        console.error("Import Penjualan belum terkonfirmasi tersimpan di cloud:",error);
        restoreConfirmButton();
        sellerBooksAlert(sellerBooksCurrentLanguage()==="en"
            ? "The import could not be confirmed in the cloud. Please check the report before importing again."
            : "Import belum dapat dikonfirmasi tersimpan di cloud. Periksa laporan sebelum mengimpor ulang.");
        return;
    }

    /* TUTUP PREVIEW */
    closeSalesPreview();


    /*
       KONFIRMASI KE USER

       RESET BELUM DIJALANKAN
       AGAR RESET TERJADI SETELAH
       USER MENEKAN OKE.
    */

    sellerBooksAlert(
        sellerBooksSalesImportText("saved") + "\n\n" +

        sellerBooksSalesImportText("marketplace") + " " +
        record.marketplace +

        "\n" + sellerBooksSalesImportText("store") + " " +
        record.storeName +

        "\n" + sellerBooksSalesImportText("transactions") + " " +
        record.rowCount.toLocaleString("id-ID") +

        "\n" + sellerBooksSalesImportText("uniquePackingLabel") + " " +
        record.uniquePackingCount.toLocaleString("id-ID") +

        "\n" + sellerBooksSalesImportText("packingCostLabel") + " " +
        formatRupiah(
            record.totalPackingCost
        )
    );


    /*
       SETELAH USER KLIK OKE
       KEMBALI KE KONDISI AWAL
    */

        resetSalesImport();

    /*
       REFRESH LAPORAN
       Setelah import berhasil disimpan,
       laporan langsung membaca data terbaru.
    */

    if(
        typeof updateReports === "function"
    ){
        updateReports();
    }

    /*
       Refresh Master Produk agar stok langsung terlihat
       berkurang, sekaligus mempertahankan sistem notifikasi
       stok menipis yang sudah ada.
    */
    if(
        typeof renderProducts === "function"
    ){
        renderProducts();
    }

    if(
        typeof renderNotifications === "function"
    ){
        renderNotifications();
    }

}
/* =====================================================
   SEMENTARA - PERSIAPAN FASE 3
===================================================== */

function checkSalesImportDuplicate(){


    /*
    FASE 3 BELUM DIAKTIFKAN.
    */

    console.log(
        "FASE 2 SELESAI. Siap masuk pemeriksaan duplikat."
    );


    sellerBooksAlert(
        sellerBooksSalesImportText("confirmed")
    );


}

/* =====================================================
   FASE 2 - CLOSE SALES PREVIEW
===================================================== */

function closeSalesPreview(){


    /* =========================================
       AMBIL MODAL PREVIEW
    ========================================= */

    const modal =

        document.getElementById(
            "salesPreviewModal"
        );


    /* =========================================
       JIKA MODAL TIDAK DITEMUKAN
       JANGAN LANJUTKAN AGAR TIDAK ERROR
    ========================================= */

    if(!modal){

        return;

    }


    /* =========================================
       TUTUP MODAL
    ========================================= */

    modal.classList.remove(
        "active"
    );


    /* =========================================
       RESET STATUS VALIDASI
    ========================================= */

    const statusElement =

        document.getElementById(
            "previewValidationStatus"
        );


    if(statusElement){

        statusElement.className =

            "preview-validation-status";


        statusElement.innerText =

            sellerBooksSalesImportText("validationChoose");

    }


    /* =========================================
       NONAKTIFKAN TOMBOL KONFIRMASI
    ========================================= */

    const confirmButton =

        document.getElementById(
            "confirmSalesColumnsButton"
        );


    if(confirmButton){

        confirmButton.disabled = true;

    }


}
/* =====================================================
   INITIALIZE APP
===================================================== */

document.addEventListener(

    "DOMContentLoaded",

    function(){

        if(typeof sellerBooksApplySalesImportLanguage === "function"){
            sellerBooksApplySalesImportLanguage();
        }
        if(typeof sellerBooksApplyReportsLanguage === "function"){
            sellerBooksApplyReportsLanguage();
        }
        if(typeof window.sbPiutangApplyLanguage === "function"){
            window.sbPiutangApplyLanguage();
        }
        if(typeof sellerBooksApplyCostLanguage === "function"){
            sellerBooksApplyCostLanguage();
        }


        /* MARKETPLACE */

        renderMarketplaces();


        /* AKUN TOKO */

        if(typeof renderStores === "function"){

            renderStores();

        }


        /* MASTER PRODUK */

        renderProducts();


        /* TIKTOK API RAW-FILE QUEUE */
        startSellerBooksTikTokApiQueueWorker();


        /* DASHBOARD */

        if(
            typeof renderMarketplacePerformance
            === "function"
        ){

            renderMarketplacePerformance();

        }


    }

);
/* =========================================
   LOGOUT SELLERBOOKS - BENAR-BENAR KELUAR
========================================= */

async 