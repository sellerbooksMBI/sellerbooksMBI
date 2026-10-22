/* =====================================================
   SELLERBOOKS PRODUCT EXCEL IMPORT / EXPORT
   Existing product spreadsheet operations, relocated unchanged.
   The price parser remains nested inside importProducts as in the original.
===================================================== */

async function importProducts(input){

    const file = input.files[0];


    if(!file){

        return;

    }

    sellerBooksImportProgressShow();

    if(!(await sellerBooksEnsureXLSX())){
        sellerBooksImportProgressHide();
        input.value = "";
        return;
    }


    const reader = new FileReader();
    reader.onerror = function(){
        sellerBooksImportProgressHide();
        input.value = "";
        sellerBooksAlert(sellerBooksProductText("importError"));
    };


    reader.onload = async function(event){


        try{


            sellerBooksImportProgressUpdate(12,"reading");
            const workbook = XLSX.read(

                event.target.result,

                {

                    type:"array"

                }

            );


            const firstSheet =

                workbook.Sheets[
                    workbook.SheetNames[0]
                ];


            const excelData =

                XLSX.utils.sheet_to_json(

                    firstSheet,

                    {

                        defval:""

                    }

                );

            sellerBooksImportProgressUpdate(24,"processing");



            if(excelData.length === 0){

                sellerBooksAlert(
                    sellerBooksProductText("importEmpty")
                );

                return;

            }



            let successCount = 0;

            let duplicateCount = 0;

            let errorCount = 0;



            excelData.forEach(function(row){


                /*
                   MENERIMA BEBERAPA NAMA KOLOM
                */

                const sku = String(

                    row["SKU"]

                    ||

                    row["sku"]

                    ||

                    ""

                ).trim();



                const name = String(

                    row["Nama Produk"] || row["Product Name"]

                    ||

                    row["NAMA PRODUK"]

                    ||

                    row["Nama"]

                    ||

                    row["nama"]

                    ||

                    ""

                ).trim();



                const category = String(

                    row["Kategori"] || row["Category"]

                    ||

                    row["KATEGORI"]

                    ||

                    ""

                ).trim();



 /* =====================================================
   PARSE HARGA EXCEL
   Menjaga harga marketplace seperti:
   26,999
   13,999
   7,999
   agar tidak berubah menjadi 27 / 14 / 8
===================================================== */

function parseExcelPrice(value){

    if(value === null || value === undefined || value === ""){
        return 0;
    }

    /* Jika Excel sudah membaca sebagai number */
    if(typeof value === "number"){

        /*
           Excel bisa membaca 26,999 sebagai
           angka 26.999.

           Untuk harga marketplace Indonesia,
           bagian desimal 999 dianggap pemisah
           ribuan.
        */

        const decimalPart =
            value.toString().split(".")[1];

        if(decimalPart && decimalPart.length === 3){

            return Math.round(value * 1000);
        }

        return value;
    }

    /* Jika Excel membaca sebagai text */
    let text = String(value).trim();

    /* Hilangkan Rp dan spasi */
    text = text
        .replace(/Rp/gi, "")
        .replace(/\s/g, "");

    /*
       Format:
       26,999
       13,999
       7,999

       dianggap sebagai harga ribuan.
    */
    if(/^\d+,\d{3}$/.test(text)){

        return Number(
            text.replace(",", "")
        );
    }

    /*
       Format:
       26.999
       13.999
       7.999
    */
    if(/^\d+\.\d{3}$/.test(text)){

        return Number(
            text.replace(".", "")
        );
    }

    /*
       Format angka biasa
       contoh:
       25000
       5000
    */
    text = text.replace(/,/g, "");

    const result = Number(text);

    return Number.isFinite(result)
        ? result
        : 0;
}


/* HARGA JUAL */

const price = parseExcelPrice(
    row["Harga Jual"] || row["Selling Price"]
    ||
    row["HARGA JUAL"]
    ||
    row["Harga"]
    ||
    0
);


/* HPP / MODAL */

const cost = parseExcelPrice(
    row["HPP"] || row["Cost"]
    ||
    row["Modal"] || row["Cost"]
    ||
    row["HPP / Modal"] || row["Product Cost"]
    ||
    row["HPP/MODAL"] || row["Product Cost"]
    ||
    0
);


const adminFeePercentRaw =
    row["Admin % SKU"] !== undefined ? row["Admin % SKU"] :
    (row["ADMIN % SKU"] !== undefined ? row["ADMIN % SKU"] :
    (row["Admin SKU %"] !== undefined ? row["Admin SKU %"] : ""));

const adminFeePercentText =
    String(adminFeePercentRaw)
        .trim()
        .replace("%", "")
        .trim();

/*
   Terima desimal Excel Indonesia maupun internasional:
   23,8
   23.8
   23,8%
   23.8%
*/
const adminFeePercent =
    adminFeePercentText === ""
        ? ""
        : Number(
            adminFeePercentText.replace(",", ".")
        );


const stock = Math.max(
    0,
    Number(
        row["Stok"] || row["Stock"]
        ||
        row["STOK"]
        ||
        row["Stock"]
        ||
        0
    )
);

                const importedStatusRaw =
                    row["Status Produk"] !== undefined ? row["Status Produk"] :
                    (row["Product Status"] !== undefined ? row["Product Status"] :
                    (row["STATUS PRODUK"] !== undefined ? row["STATUS PRODUK"] :
                    (row["Status"] !== undefined ? row["Status"] : "Aktif")));

                const importedStatus = String(importedStatusRaw).trim().toLowerCase();

                const status = importedStatus === ""
                    ? ""
                    : (
                        importedStatus === "tidak aktif" ||
                        importedStatus === "inactive" ||
                        importedStatus === "nonaktif" ||
                        importedStatus === "non-active"
                    ? "inactive"
                    : "active");


                /*
                   VALIDASI DATA
                */

                if(!sku){

                    errorCount++;

                    return;

                }

                if(adminFeePercent !== "" && (!Number.isFinite(adminFeePercent) || adminFeePercent < 0 || adminFeePercent > 100)){
                    errorCount++;
                    return;
                }



                /*
                   CEK SKU GANDA
                */

                const existingProduct =

                    products.find(function(product){

                        return (

                            product.sku.toLowerCase()

                            ===

                            sku.toLowerCase()

                        );

                    });



                /*
                   JIKA SUDAH ADA:
                   JANGAN BUAT DUPLIKAT
                */

                if(existingProduct){

                    existingProduct.name = name;
                    existingProduct.category = category;
                    existingProduct.price = price;
                    existingProduct.cost = cost;
                    existingProduct.adminFeePercent = adminFeePercent;
                    existingProduct.stock = stock;
                    existingProduct.status = status;
                    existingProduct.updatedAt = new Date().toISOString();

                    successCount++;

                    return;

                }

                if(!name){

                    errorCount++;

                    return;

                }

                /*
                   SKU BARU:
                   SIMPAN PRODUK BARU.
                */

                products.push({

                    id:
                        "product_" +
                        Date.now() +
                        "_" +
                        Math.random()
                        .toString(36)
                        .substring(2,7),


                    sku:sku,

                    name:name,

                    category:category,

                    price:price,

                    cost:cost,

                    adminFeePercent:adminFeePercent,
           
                    stock:stock,

                    status:status,


                    createdAt:
                        new Date().toISOString(),


                    updatedAt:
                        new Date().toISOString()

                });


                successCount++;

            });



            sellerBooksImportProgressUpdate(68,"saving");
            saveProductData({deferCloudPersist:true});
            /* Import mengirim satu snapshot penuh saja. Batalkan debounce yang
               dipicu oleh perubahan produk dan daily snapshot sebelum save ketat. */
            if(sellerBooksCloudSaveTimer){
                clearTimeout(sellerBooksCloudSaveTimer);
                sellerBooksCloudSaveTimer=null;
            }

            /*
               IMPORT MASTER PRODUK HARUS MENUNGGU KONFIRMASI CLOUD.
               Jangan mengumumkan import berhasil sebelum snapshot produk
               berhasil ditulis dan jumlah SKU hasil simpan terverifikasi.
            */
            try{
                if(!sellerBooksAuthUser || !sellerBooksCloudReady || sellerBooksCloudLoading){
                    throw new Error("Cloud belum siap. Import belum dapat diverifikasi.");
                }

                const expectedProducts = products.map(function(product){
                    return Object.assign({}, product);
                });
                const expectedSkuCount = expectedProducts.length;
                const expectedSnapshot = sellerBooksCloneCloudState(sellerBooksCloudState);
                const expectedBySku = new Map(expectedProducts.map(function(product){
                    return [String(product && product.sku || "").trim().toLowerCase(), product];
                }));
                function verifyImportedProducts(savedData){
                    let savedProducts = savedData && savedData.sellerbooks_products;
                    if(typeof savedProducts === "string"){
                        try{ savedProducts = JSON.parse(savedProducts); }
                        catch(error){ return false; }
                    }
                    if(!Array.isArray(savedProducts) || savedProducts.length !== expectedSkuCount) return false;
                    const savedBySku = new Map(savedProducts.map(function(product){
                        return [String(product && product.sku || "").trim().toLowerCase(), product];
                    }));
                    if(savedBySku.size !== expectedSkuCount) return false;
                    return Array.from(expectedBySku.entries()).every(function(entry){
                        const sku=entry[0], expected=entry[1], saved=savedBySku.get(sku);
                        if(!saved) return false;
                        return String(saved.name||"")===String(expected.name||"") &&
                            String(saved.category||"")===String(expected.category||"") &&
                            Number(saved.price||0)===Number(expected.price||0) &&
                            Number(saved.cost||0)===Number(expected.cost||0) &&
                            String(saved.adminFeePercent??"")===String(expected.adminFeePercent??"") &&
                            Number(saved.stock||0)===Number(expected.stock||0) &&
                            String(saved.status||"")===String(expected.status||"");
                    });
                }

                sellerBooksImportProgressUpdate(80,"saving");
                await sellerBooksPersistCloudDataStrict(
                    expectedSnapshot,
                    function(savedData){
                        return verifyImportedProducts(savedData);
                    }
                );

                sellerBooksImportProgressUpdate(93,"verifying");
                const verifiedCloudRow = await sellerBooksReadCloudRow();
                let verifiedProducts = verifiedCloudRow.data && verifiedCloudRow.data.sellerbooks_products;
                if(typeof verifiedProducts === "string"){
                    verifiedProducts = JSON.parse(verifiedProducts);
                }
                if(!verifyImportedProducts(verifiedCloudRow.data)){
                    throw new Error("Verifikasi cloud gagal: SKU atau isi produk yang tersimpan tidak sama dengan hasil import.");
                }
                sellerBooksImportProgressUpdate(100,"done");
                renderProducts();
                renderNotifications();
                sellerBooksAlert(
                    sellerBooksProductText("importDone")
                        .replace("{success}",successCount)
                        .replace("{duplicate}",duplicateCount)
                        .replace("{error}",errorCount)
                );
            }catch(saveError){
                console.error("Import Master Produk gagal diverifikasi di cloud:",saveError);
                sellerBooksImportProgressFailure(saveError);
                return;
            }


        }

        catch(error){


            console.error(error);


            sellerBooksAlert(

                sellerBooksProductText("importError")

            );

        }

        finally{
            /* Overlay tetap terlihat jika penyimpanan cloud gagal; hanya ditutup
               otomatis setelah jalur sukses atau kesalahan pemrosesan umum. */
            if(!document.getElementById("sellerBooksImportProgressClose")){
                sellerBooksImportProgressHide();
            }
        }

        /*
           RESET INPUT
        */

        input.value = "";

    };


    reader.readAsArrayBuffer(file);

}



/* =====================================================
   EXPORT EXCEL MASTER PRODUK SELLERBOOKS
   DENGAN DROPDOWN STATUS
===================================================== */



async function exportProducts(){

    try{

        const t=function(key){
            return sellerBooksProductText(key);
        };

        const language=sellerBooksCurrentLanguage();
        const fileName="MASTER_PRODUK_SELLERBOOKS.xlsx";

        /*
           ExcelJS tetap menjadi jalur utama agar dropdown Status
           dan struktur export lama tetap dipertahankan.
           Validasi hanya dibuat sampai jumlah baris yang relevan
           + 50 baris kosong, bukan 1000 baris.
        */
        if(typeof ExcelJS!=="undefined"){

            try{

                const workbook=new ExcelJS.Workbook();
                const worksheet=workbook.addWorksheet(t("exportMaster"));

                worksheet.addRow([
                    t("sku"),
                    t("productName"),
                    t("category"),
                    t("sellingPrice"),
                    t("cost"),
                    t("adminSku"),
                    t("stock"),
                    t("status")
                ]);

                if(Array.isArray(products) && products.length>0){

                    products.forEach(function(product){

                        worksheet.addRow([
                            product.sku || "",
                            product.name || "",
                            product.category || "",
                            Number(product.price) || 0,
                            Number(product.cost) || 0,
                            product.adminFeePercent === "" ||
                            product.adminFeePercent === undefined ||
                            product.adminFeePercent === null
                                ? ""
                                : Number(product.adminFeePercent),
                            Number(product.stock) || 0,
                            product.status === "active"
                                ? t("active")
                                : t("inactive")
                        ]);

                    });

                }else{

                    worksheet.addRow([
                        language==="en" ? "EXAMPLE-SKU-001" : "CONTOH-SKU-001",
                        language==="en" ? "Example Product Name" : "Contoh Nama Produk",
                        language==="en" ? "Example Category" : "Contoh Kategori",
                        10000,
                        5000,
                        "",
                        0,
                        t("active")
                    ]);

                }

                worksheet.getRow(1).font={bold:true};

                [22,35,22,18,18,16,15,20].forEach(function(width,index){
                    worksheet.getColumn(index+1).width=width;
                });

                worksheet.getColumn(4).numFmt="#,##0";
                worksheet.getColumn(5).numFmt="#,##0";
                worksheet.getColumn(6).numFmt="0.0#";
                worksheet.getColumn(7).numFmt="0.##";

                const statusFormula=
                    language==="en"
                        ? '"Active,Inactive"'
                        : '"Aktif,Tidak Aktif"';

                const validationEnd=Math.max(
                    rowsForExportCount()+50,
                    50
                );

                for(let row=2;row<=validationEnd;row++){

                    worksheet.getCell(row,8).dataValidation={
                        type:"list",
                        allowBlank:true,
                        formulae:[statusFormula],
                        showErrorMessage:true,
                        errorTitle:t("statusInvalidTitle"),
                        error:t("statusInvalid"),
                        showInputMessage:true,
                        promptTitle:t("statusPromptTitle"),
                        prompt:t("statusPrompt")
                    };

                }

                const instructionSheet=workbook.addWorksheet(t("exportInstructions"));

                [
                    [t("exportColumn"),t("exportGuide")],
                    [t("sku"),t("requiredSku")],
                    [t("productName"),t("requiredName")],
                    [t("category"),t("optionalCategory")],
                    [t("sellingPrice"),t("priceGuide")],
                    [t("cost"),t("costGuide")],
                    [t("stock"),t("stockGuide")],
                    [t("status"),t("statusGuide")],
                    [],
                    [t("exportRules"),""],
                    ["1",t("rule1")],
                    ["2",t("rule2")],
                    ["3",t("rule3")],
                    ["4",t("rule4")],
                    ["5",t("rule5")],
                    ["6",t("rule6")]
                ].forEach(function(row){
                    instructionSheet.addRow(row);
                });

                instructionSheet.getColumn(1).width=25;
                instructionSheet.getColumn(2).width=90;

                const readmeSheet=workbook.addWorksheet(t("exportReadme"));

                [
                    [t("exportTemplateTitle")],
                    [],
                    [t("exportTemplateDescription")],
                    [],
                    [t("howTo")],
                    ["1. "+t("how1")],
                    ["2. "+t("how2")],
                    ["3. "+t("how3")],
                    ["4. "+t("how4")],
                    ["5. "+t("how5")],
                    ["6. "+t("how6")],
                    ["7. "+t("how7")],
                    ["8. "+t("how8")],
                    ["9. "+t("how9")],
                    ["10. "+t("how10")],
                    [],
                    [t("importantNotes")],
                    [t("note1")],
                    [t("note2")],
                    [t("note3")],
                    [t("note4")]
                ].forEach(function(row){
                    readmeSheet.addRow(row);
                });

                readmeSheet.getColumn(1).width=100;

                const writePromise=workbook.xlsx.writeBuffer();

                const buffer=await Promise.race([
                    writePromise,
                    new Promise(function(_,reject){
                        setTimeout(function(){
                            reject(new Error("ExcelJS writeBuffer timeout"));
                        },10000);
                    })
                ]);

                await sellerBooksDownloadExcelBlob(
                    new Blob(
                        [buffer],
                        {
                            type:
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        }
                    ),
                    fileName
                );

                sellerBooksAlert(
                    sellerBooksProductText("exportSuccess"),
                    sellerBooksProductText("exportSuccessTitle")
                );

                return;

            }catch(excelJsError){

                console.warn(
                    "ExcelJS export gagal, menggunakan fallback XLSX:",
                    excelJsError
                );

            }

        }

        /*
           Fallback: SheetJS. Ini memastikan export tetap dapat
           menghasilkan file walaupun ExcelJS gagal/timeout.
        */
        if(typeof XLSX==="undefined"){

            if(typeof sellerBooksEnsureXLSX==="function"){
                const ready=await sellerBooksEnsureXLSX();
                if(!ready){
                    throw new Error("XLSX library tidak tersedia.");
                }
            }

        }

        if(typeof XLSX==="undefined"){
            throw new Error("Tidak ada library Excel yang tersedia.");
        }

        const rows=[
            [
                t("sku"),
                t("productName"),
                t("category"),
                t("sellingPrice"),
                t("cost"),
                t("adminSku"),
                t("stock"),
                t("status")
            ]
        ];

        if(Array.isArray(products) && products.length>0){

            products.forEach(function(product){
                rows.push([
                    product.sku || "",
                    product.name || "",
                    product.category || "",
                    Number(product.price) || 0,
                    Number(product.cost) || 0,
                    product.adminFeePercent === "" ||
                    product.adminFeePercent === undefined ||
                    product.adminFeePercent === null
                        ? ""
                        : Number(product.adminFeePercent),
                    Number(product.stock) || 0,
                    product.status === "active"
                        ? t("active")
                        : t("inactive")
                ]);
            });

        }else{

            rows.push([
                language==="en" ? "EXAMPLE-SKU-001" : "CONTOH-SKU-001",
                language==="en" ? "Example Product Name" : "Contoh Nama Produk",
                language==="en" ? "Example Category" : "Contoh Kategori",
                10000,
                5000,
                "",
                0,
                t("active")
            ]);

        }

        const fallbackWorkbook=XLSX.utils.book_new();
        const fallbackSheet=XLSX.utils.aoa_to_sheet(rows);

        fallbackSheet["!cols"]=[
            {wch:22},{wch:35},{wch:22},{wch:18},
            {wch:18},{wch:16},{wch:15},{wch:20}
        ];

        fallbackSheet["!autofilter"]={
            ref:"A1:H"+rows.length
        };

        XLSX.utils.book_append_sheet(
            fallbackWorkbook,
            fallbackSheet,
            t("exportMaster")
        );

        const instructionRows=[
            [t("exportColumn"),t("exportGuide")],
            [t("sku"),t("requiredSku")],
            [t("productName"),t("requiredName")],
            [t("category"),t("optionalCategory")],
            [t("sellingPrice"),t("priceGuide")],
            [t("cost"),t("costGuide")],
            [t("stock"),t("stockGuide")],
            [t("status"),t("statusGuide")],
            [],
            [t("exportRules"),""],
            ["1",t("rule1")],
            ["2",t("rule2")],
            ["3",t("rule3")],
            ["4",t("rule4")],
            ["5",t("rule5")],
            ["6",t("rule6")]
        ];

        const fallbackInstruction=XLSX.utils.aoa_to_sheet(instructionRows);
        fallbackInstruction["!cols"]=[{wch:25},{wch:90}];

        XLSX.utils.book_append_sheet(
            fallbackWorkbook,
            fallbackInstruction,
            t("exportInstructions")
        );

        const readmeRows=[
            [t("exportTemplateTitle")],
            [],
            [t("exportTemplateDescription")],
            [],
            [t("howTo")],
            ["1. "+t("how1")],
            ["2. "+t("how2")],
            ["3. "+t("how3")],
            ["4. "+t("how4")],
            ["5. "+t("how5")],
            ["6. "+t("how6")],
            ["7. "+t("how7")],
            ["8. "+t("how8")],
            ["9. "+t("how9")],
            ["10. "+t("how10")],
            [],
            [t("importantNotes")],
            [t("note1")],
            [t("note2")],
            [t("note3")],
            [t("note4")]
        ];

        const fallbackReadme=XLSX.utils.aoa_to_sheet(readmeRows);
        fallbackReadme["!cols"]=[{wch:100}];

        XLSX.utils.book_append_sheet(
            fallbackWorkbook,
            fallbackReadme,
            t("exportReadme")
        );

        const output=XLSX.write(
            fallbackWorkbook,
            {
                bookType:"xlsx",
                type:"array"
            }
        );

        await sellerBooksDownloadExcelBlob(
            new Blob(
                [output],
                {
                    type:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            ),
            fileName
        );

        sellerBooksAlert(
            sellerBooksProductText("exportSuccess"),
            sellerBooksProductText("exportSuccessTitle")
        );

    }catch(error){

        console.error(
            "SellerBooks Export Master Produk Error:",
            error
        );

        sellerBooksAlert(
            sellerBooksProductText("exportError") ||
            "Export Excel gagal. Silakan coba lagi."
        );

    }

}

function rowsForExportCount(){
    return Array.isArray(products) ? products.length + 1 : 2;
}

async function sellerBooksDownloadExcelBlob(blob,fileName){

    if(!blob || !blob.size){
        throw new Error("File Excel kosong.");
    }

    const isMobile=
        /Android|iPhone|iPad|iPod/i.test(
            navigator.userAgent || ""
        );

    if(
        isMobile &&
        typeof navigator.share==="function" &&
        typeof File!=="undefined" &&
        typeof navigator.canShare==="function"
    ){

        try{

            const file=new File(
                [blob],
                fileName,
                {type:blob.type}
            );

            if(navigator.canShare({files:[file]})){

                await navigator.share({
                    files:[file],
                    title:fileName
                });

                return;

            }

        }catch(shareError){

            console.warn(
                "Native share export gagal, lanjut download:",
                shareError
            );

        }

    }

    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");

    anchor.href=url;
    anchor.download=fileName;
    anchor.setAttribute("download",fileName);
    anchor.rel="noopener";
    anchor.style.position="fixed";
    anchor.style.left="-9999px";
    anchor.style.top="0";
    anchor.style.width="1px";
    anchor.style.height="1px";
    anchor.style.opacity="0";

    document.body.appendChild(anchor);

    try{
        anchor.click();
    }finally{

        setTimeout(function(){

            try{
                anchor.remove();
            }catch(e){
                try{
                    document.body.removeChild(anchor);
                }catch(e2){}
            }

            try{
                URL.revokeObjectURL(url);
            }catch(e3){}

        },3000);

    }

}



/* =====================================================
   SELLERBOOKS SALES IMPORT ENGINE
===================================================== */


/*
========================================================
FILE IMPORT SEMENTARA
========================================================
*/

