/* =====================================================
   SELLERBOOKS PRODUCT ANALYSIS
   Existing calculations, filters, rendering, and PDF behavior
   are relocated unchanged as classic-script global functions.
===================================================== */

function getProductAnalysisDateRange(){
    const fromValue =
        document.getElementById("productAnalysisDateFrom")?.value || "";

    const toValue =
        document.getElementById("productAnalysisDateTo")?.value || "";

    return {
        from: fromValue ? getReportDateOnly(fromValue) : null,
        to: toValue ? getReportDateOnly(toValue) : null
    };
}


function isTransactionInProductAnalysisPeriod(transaction, period){
    const date =
        getReportDateOnly(
            transaction.reportDate ||
            transaction.importedAt
        );

    if(!date){
        return true;
    }

    const today = getIndonesiaTodayDate();

    if(period === "today"){
        return date.getTime() === today.getTime();
    }

    if(period === "yesterday"){
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return date.getTime() === yesterday.getTime();
    }

    if(period === "week" || period === "lastWeek"){
        const day = today.getDay();
        const diff = day === 0 ? 6 : day - 1;

        const startThisWeek = new Date(today);
        startThisWeek.setDate(today.getDate() - diff);

        if(period === "week"){
            return date >= startThisWeek && date <= today;
        }

        const startLastWeek = new Date(startThisWeek);
        startLastWeek.setDate(startLastWeek.getDate() - 7);

        const endLastWeek = new Date(startThisWeek);
        endLastWeek.setDate(endLastWeek.getDate() - 1);

        return date >= startLastWeek && date <= endLastWeek;
    }

    if(period === "month" || period === "lastMonth"){
        const targetMonth =
            period === "month"
                ? today.getMonth()
                : today.getMonth() - 1;

        const targetYear =
            today.getFullYear() +
            Math.floor(targetMonth / 12);

        const normalizedMonth =
            ((targetMonth % 12) + 12) % 12;

        const start =
            new Date(
                targetYear,
                normalizedMonth,
                1
            );

        const end =
            new Date(
                targetYear,
                normalizedMonth + 1,
                0
            );

        return date >= start && date <= end;
    }

    if(period === "last3Months"){
        const start =
            new Date(
                today.getFullYear(),
                today.getMonth() - 2,
                1
            );

        return date >= start && date <= today;
    }

    if(period === "year"){
        return (
            date.getFullYear() ===
            today.getFullYear()
        );
    }

    if(period === "custom"){
        const range =
            getProductAnalysisDateRange();

        if(range.from && date < range.from){
            return false;
        }

        if(range.to && date > range.to){
            return false;
        }

        return true;
    }

    return true;
}


function updateProductAnalysisDateUI(){
    const period =
        document.getElementById(
            "productAnalysisPeriod"
        )?.value || "month";

    const box =
        document.getElementById(
            "productAnalysisCustomDateRange"
        );

    if(!box){
        return;
    }

    const show =
        period === "custom";

    box.style.display =
        show ? "block" : "none";

    if(!show){
        return;
    }

    const today = getIndonesiaTodayDate();

    const maxDate =
        getLocalDateString(today);

    const minDate =
        getLocalDateString(
            new Date(
                today.getFullYear(),
                today.getMonth() - 2,
                1
            )
        );

    const from =
        document.getElementById(
            "productAnalysisDateFrom"
        );

    const to =
        document.getElementById(
            "productAnalysisDateTo"
        );

    if(from){
        from.min = minDate;
        from.max = maxDate;
    }

    if(to){
        to.min = minDate;
        to.max = maxDate;
    }
}


function loadProductAnalysisMarketplaceFilter(){

    const select =
        document.getElementById("productAnalysisMarketplace");

    if(!select){
        return;
    }

    const currentValue =
        select.value || "all";

    select.innerHTML = `
        <option value="all">${sellerBooksDetailsText("allMarketplaces")}</option>
    `;

    let marketplaces = [];

    try{
        marketplaces =
            JSON.parse(
                sellerBooksStorage.getItem("sellerbooks_marketplaces") || "[]"
            ) || [];
    }catch(error){
        marketplaces = [];
    }

    marketplaces
        .filter(function(marketplace){
            return marketplace.status !== "inactive";
        })
        .forEach(function(marketplace){
            const option = document.createElement("option");
            option.value = marketplace.id;
            option.textContent = marketplace.name;
            select.appendChild(option);
        });

    if([...select.options].some(function(option){
        return option.value === currentValue;
    })){
        select.value = currentValue;
    }else{
        select.value = "all";
    }
}


function loadProductAnalysisStoreFilter(){

    const marketplaceSelect =
        document.getElementById("productAnalysisMarketplace");

    const storeSelect =
        document.getElementById("productAnalysisStore");

    if(!marketplaceSelect || !storeSelect){
        return;
    }

    const marketplaceId =
        marketplaceSelect.value || "all";

    const currentValue =
        storeSelect.value || "all";

    storeSelect.innerHTML = `
        <option value="all">${sellerBooksDetailsText("allStoreAccounts")}</option>
    `;

    let stores = [];

    try{
        stores =
            JSON.parse(
                sellerBooksStorage.getItem("sellerbooks_stores") || "[]"
            ) || [];
    }catch(error){
        stores = [];
    }

    stores
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

    if([...storeSelect.options].some(function(option){
        return option.value === currentValue;
    })){
        storeSelect.value = currentValue;
    }else{
        storeSelect.value = "all";
    }
}


function onProductAnalysisMarketplaceChange(){
    loadProductAnalysisStoreFilter();
    applyProductAnalysisFilters();
}


function getProductAnalysisTransactions(){
    const period =
        document.getElementById(
            "productAnalysisPeriod"
        )?.value || "month";

    const marketplaceId =
        document.getElementById("productAnalysisMarketplace")?.value || "all";

    const storeId =
        document.getElementById("productAnalysisStore")?.value || "all";

    return getAllReportTransactions()
        .filter(function(transaction){

            if(!isTransactionInProductAnalysisPeriod(
                transaction,
                period
            )){
                return false;
            }

            if(
                marketplaceId !== "all" &&
                String(transaction.marketplaceId || "") !== String(marketplaceId)
            ){
                return false;
            }

            if(
                storeId !== "all" &&
                String(transaction.storeId || "") !== String(storeId)
            ){
                return false;
            }

            return true;
        });
}


function calculateProductAnalysisRows(){
    const sourceTransactions =
        getAllReportTransactions();

    const period =
        document.getElementById("productAnalysisPeriod")?.value || "";

    const marketplace =
        document.getElementById("productAnalysisMarketplace")?.value || "";

    const store =
        document.getElementById("productAnalysisStore")?.value || "";

    const dateFrom =
        document.getElementById("productAnalysisDateFrom")?.value || "";

    const dateTo =
        document.getElementById("productAnalysisDateTo")?.value || "";

    const cacheKey = [
        period,
        marketplace,
        store,
        dateFrom,
        dateTo
    ].join("|");

    if(
        sellerBooksProductAnalysisRowsCache.sourceTransactions === sourceTransactions &&
        sellerBooksProductAnalysisRowsCache.key === cacheKey &&
        Array.isArray(sellerBooksProductAnalysisRowsCache.rows)
    ){
        return sellerBooksProductAnalysisRowsCache.rows;
    }

    const transactions =
        getProductAnalysisTransactions();

    /*
       PATCH B:
       Bangun index Master Produk sekali agar setiap SKU cukup dicari
       satu kali, bukan memanggil getMasterProductBySku() berulang-ulang
       untuk setiap transaksi.
       
       Penting: sumber data dan aturan penggabungan tetap mengikuti
       getMasterProductBySku(): storage + runtime products, termasuk
       fallback dan koreksi field cost/price/adminFeePercent.
       Jadi optimasi ini tidak mengubah hasil bisnis.
    */
    const productMap = new Map();

    let storedProducts = [];
    try{
        storedProducts = JSON.parse(
            sellerBooksStorage.getItem("sellerbooks_products") || "[]"
        );
    }catch(error){
        storedProducts = [];
    }

    const storedProductMap = new Map();

    if(Array.isArray(storedProducts)){
        storedProducts.forEach(function(product){
            const sku = String(product?.sku || "")
                .trim()
                .toLowerCase();

            if(sku){
                storedProductMap.set(sku, product);
            }
        });
    }

    const runtimeProductMap = new Map();

    try{
        if(Array.isArray(products)){
            products.forEach(function(product){
                const sku = String(product?.sku || "")
                    .trim()
                    .toLowerCase();

                if(sku){
                    runtimeProductMap.set(sku, product);
                }
            });
        }
    }catch(error){}

    const allProductKeys = new Set([
        ...storedProductMap.keys(),
        ...runtimeProductMap.keys()
    ]);

    allProductKeys.forEach(function(key){
        const storedProduct = storedProductMap.get(key) || null;
        const runtimeProduct = runtimeProductMap.get(key) || null;

        if(!storedProduct && !runtimeProduct){
            return;
        }

        if(!storedProduct){
            productMap.set(key,{...runtimeProduct});
            return;
        }

        if(!runtimeProduct){
            productMap.set(key,{...storedProduct});
            return;
        }

        const merged = {...storedProduct};

        ["cost","price","adminFeePercent"].forEach(function(field){
            const storedValue = Number(storedProduct[field]);
            const runtimeValue = Number(runtimeProduct[field]);

            if(
                Number.isFinite(runtimeValue) &&
                runtimeValue !== 0 &&
                (
                    !Number.isFinite(storedValue) ||
                    storedValue === 0
                )
            ){
                merged[field] = runtimeValue;
            }
        });

        productMap.set(key,merged);
    });

    const rows = new Map();

    transactions.forEach(function(item){

        const sku =
            String(item.sku || "")
                .trim();

        if(!sku){
            return;
        }

        const key = sku.toLowerCase();

        if(!rows.has(key)){
            rows.set(key,{                sku:sku,
                qty:0,
                sales:0,
                hpp:0,
                admin:0,
                product:productMap.get(key) || null,
                marketplaces:new Set()
            });
        }

        const row = rows.get(key);

        const itemMarketplace =
            String(item.marketplace || "").trim();

        if(itemMarketplace){
            row.marketplaces.add(itemMarketplace.toLowerCase());
        }

        const qty =
            Number(item.qty) || 0;

        const sales =
            getReportTransactionSalesAmount(item);

        const product =
            row.product;

        const cost =
            getReportTransactionCost(item);

        const feePercent =
            getReportTransactionFeePercent(item);

        const admin =
            sales *
            (feePercent / 100);

        row.qty += qty;
        row.sales += sales;
        row.hpp += cost * qty;
        row.admin += admin;
    });


    
    const finalRows =
        Array.from(rows.values())
            .map(function(row){
                /*
                   Harga Jual selalu merupakan harga transaksi aktual:
                   Total Penjualan / QTY.
                */
                row.price =
                    Number(row.qty) > 0
                        ? Number(row.sales) / Number(row.qty)
                        : 0;

                row.name =
                    row.product
                        ? (row.product.name || row.sku)
                        : "SKU belum ada di Master Produk";

                row.profit =
                    row.sales -
                    row.admin -
                    row.hpp;

                row.isLoss =
                    row.profit < 0;

                return row;
            })
            .sort(function(a,b){

                if(a.isLoss !== b.isLoss){
                    return a.isLoss ? -1 : 1;
                }

                return a.profit - b.profit;
            });

    sellerBooksProductAnalysisRowsCache = {
        sourceTransactions: sourceTransactions,
        key: cacheKey,
        rows: finalRows
    };

    return finalRows;
}


function formatProductAnalysisCurrency(value){
    return formatRupiah(value);
}


async function downloadProductAnalysisPDF(){
    const button = document.getElementById("downloadProductAnalysisPDFButton");
    const language = String(sellerBooksCurrentLanguage() || "id").trim().toLowerCase().startsWith("en") ? "en" : "id";
    const originalText = button ? button.textContent : "";

    try{
        if(button){
            button.disabled = true;
            button.textContent = language === "en" ? "Preparing PDF..." : "Menyiapkan PDF...";
        }

        /* Gunakan baris dari Rincian dan filter yang sedang aktif. */
        const rows = calculateProductAnalysisRows().slice().sort(function(a,b){
            return String(a.sku || "").localeCompare(String(b.sku || ""), language === "en" ? "en" : "id", {
                numeric:true,
                sensitivity:"base"
            });
        });

        await sellerBooksLoadPdfLibraries();
        const jsPDF = window.jspdf.jsPDF;
        const doc = new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
        const pageWidth = doc.internal.pageSize.getWidth();
        const periodElement = document.getElementById("productAnalysisPeriod");
        const periodLabel = periodElement?.selectedOptions?.[0]?.textContent || (language === "en" ? "Selected period" : "Periode terpilih");
        const marketplaceElement = document.getElementById("productAnalysisMarketplace");
        const storeElement = document.getElementById("productAnalysisStore");
        const marketplaceLabel = marketplaceElement?.selectedOptions?.[0]?.textContent || "";
        const storeLabel = storeElement?.selectedOptions?.[0]?.textContent || "";

        doc.setFont("helvetica","bold");
        doc.setFontSize(16);
        doc.text(language === "en" ? "SellerBooks - Product Details" : "SellerBooks - Rincian Produk",14,16);
        doc.setFont("helvetica","normal");
        doc.setFontSize(9);
        doc.text((language === "en" ? "Printed: " : "Dicetak: ") + sellerBooksPdfFormatDateNow(),pageWidth - 14,16,{align:"right"});
        doc.setFontSize(10);
        doc.text((language === "en" ? "Period: " : "Periode: ") + periodLabel,14,24);
        doc.text("Marketplace: " + marketplaceLabel,14,30);
        doc.text((language === "en" ? "Store Account: " : "Akun Toko: ") + storeLabel,14,36);

        const totalQty = rows.reduce((sum,row)=>sum + (Number(row.qty)||0),0);
        const totalHpp = rows.reduce((sum,row)=>sum + (Number(row.hpp)||0),0);
        const totalProfit = rows.reduce((sum,row)=>sum + (Number(row.profit)||0),0);
        /* Jumlah resi mengikuti perhitungan total packing pada Laporan, dengan filter Rincian aktif. */
        const totalResi = calculateReportPacking(getProductAnalysisTransactions());
        const body = rows.map(function(row){
            return [
                String(row.sku || "-"),
                sellerBooksPdfFormatNumber(row.qty),
                sellerBooksPdfFormatRupiah(row.hpp),
                sellerBooksPdfFormatRupiah(row.profit),
                row.isLoss
                    ? (language === "en" ? "LOSS" : "MINUS")
                    : (language === "en" ? "PROFIT" : "UNTUNG"),
                ""
            ];
        });
        body.push([
            "TOTAL",
            sellerBooksPdfFormatNumber(totalQty),
            sellerBooksPdfFormatRupiah(totalHpp),
            sellerBooksPdfFormatRupiah(totalProfit),
            "",
            sellerBooksPdfFormatNumber(totalResi)
        ]);

        doc.autoTable({
            startY:42,
            margin:{left:14,right:14},
            theme:"grid",
            head:[["SKU","QTY",language === "en" ? "COGS" : "HPP",language === "en" ? "PRODUCT PROFIT" : "LABA PRODUK","STATUS",language === "en" ? "TOTAL WAYBILLS" : "TOTAL RESI"]],
            body:body,
            styles:{font:"helvetica",fontSize:8,cellPadding:2.2,overflow:"linebreak"},
            headStyles:{fontStyle:"bold"},
            columnStyles:{
                0:{cellWidth:65},
                1:{cellWidth:25,halign:"right"},
                2:{cellWidth:45,halign:"right"},
                3:{cellWidth:45,halign:"right"},
                4:{cellWidth:25,halign:"center"},
                5:{cellWidth:32,halign:"right"}
            },
            didParseCell:function(data){
                if(data.section === "body" && data.row.index === body.length - 1){
                    data.cell.styles.fontStyle = "bold";
                    data.cell.styles.fillColor = [235,240,248];
                }
            }
        });

        const dateKey = typeof getSellerBooksDayKey === "function" ? getSellerBooksDayKey() : new Date().toISOString().slice(0,10);
        /* Samakan pola nama file dengan PDF Laporan: jenis dokumen + periode aktif + tanggal. */
        const safePeriod = sellerBooksPdfEscapeFileName(periodLabel);
        const fileName = (language === "en" ? "SellerBooks_Product_Details_" : "SellerBooks_Rincian_Produk_") + safePeriod + "_" + sellerBooksPdfEscapeFileName(dateKey) + ".pdf";

        /* Samakan mekanisme unduh dengan PDF Laporan agar Android WebView menyimpan file. */
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = "none";

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        /* Beri waktu browser/WebView membaca Blob URL sebelum dilepas. */
        setTimeout(function(){
            try{
                URL.revokeObjectURL(url);
            }catch(error){}
        },15000);

        sellerBooksAlert(
            (language === "en" ? "✅ Product PDF created successfully. " : "✅ PDF rincian produk berhasil dibuat. ") +
            (language === "en" ? "Period: " : "Periode: ") + periodLabel + " | " +
            "Marketplace: " + marketplaceLabel + " | " +
            (language === "en" ? "Store Account: " : "Akun Toko: ") + storeLabel
        );
    }catch(error){
        console.error("Download PDF Rincian Produk gagal:",error);
        if(typeof sellerBooksAlert === "function"){
            sellerBooksAlert(
                language === "en" ? "Failed to create the product details PDF. Please try again." : "PDF Rincian Produk gagal dibuat. Silakan coba lagi.",
                language === "en" ? "PDF Error" : "Kesalahan PDF"
            );
        }
    }finally{
        if(button){
            button.disabled = false;
            button.textContent = sellerBooksDetailsText("downloadPdf") || originalText;
        }
    }
}


function renderProductAnalysis(){

    const body =
        document.getElementById(
            "productAnalysisTableBody"
        );

    const pagination =
        document.getElementById(
            "productAnalysisPagination"
        );

    const paginationControls =
        document.getElementById(
            "productAnalysisPaginationControls"
        );

    const pageSizeSelect =
        document.getElementById(
            "productAnalysisPageSize"
        );

    if(!body){
        return;
    }

    const rows =
        calculateProductAnalysisRows();

    const totalProducts =
        document.getElementById(
            "productAnalysisTotalProducts"
        );

    const profitProducts =
        document.getElementById(
            "productAnalysisProfitProducts"
        );

    const lossProducts =
        document.getElementById(
            "productAnalysisLossProducts"
        );

    const totalProfit =
        document.getElementById(
            "productAnalysisTotalProfit"
        );

    const total =
        rows.length;

    const losses =
        rows.filter(function(row){
            return row.isLoss;
        }).length;

    const profits =
        total - losses;

    const profitValue =
        rows.reduce(function(sum,row){
            return sum + row.profit;
        },0);

    if(totalProducts){
        totalProducts.textContent = total;
    }

    if(profitProducts){
        profitProducts.textContent = profits;
    }

    if(lossProducts){
        lossProducts.textContent = losses;
    }

    if(totalProfit){
        totalProfit.textContent =
            formatProductAnalysisCurrency(
                profitValue
            );
    }

    /* Jika filter berubah, kembali ke halaman pertama. */
    const period =
        document.getElementById(
            "productAnalysisPeriod"
        )?.value || "";

    const marketplace =
        document.getElementById(
            "productAnalysisMarketplace"
        )?.value || "";

    const store =
        document.getElementById(
            "productAnalysisStore"
        )?.value || "";

    const dateFrom =
        document.getElementById(
            "productAnalysisDateFrom"
        )?.value || "";

    const dateTo =
        document.getElementById(
            "productAnalysisDateTo"
        )?.value || "";

    const filterKey =
        [
            period,
            marketplace,
            store,
            dateFrom,
            dateTo
        ].join("|");

    if(
        productAnalysisPaginationFilterKey !==
        filterKey
    ){
        productAnalysisPage = 1;
        productAnalysisPaginationFilterKey =
            filterKey;
    }

    if(!rows.length){

        body.innerHTML = `
            <tr class="analysis-empty-row">
                <td colspan="11">
                    ${sellerBooksDetailsText("noTransactions")}
                </td>
            </tr>
        `;

        if(pagination){
            pagination.style.display = "none";
        }

        return;
    }

    if(
        !Number.isFinite(
            productAnalysisPageSize
        ) ||
        productAnalysisPageSize < 1
    ){
        productAnalysisPageSize = 20;
    }

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                rows.length /
                productAnalysisPageSize
            )
        );

    if(productAnalysisPage > totalPages){
        productAnalysisPage = totalPages;
    }

    if(productAnalysisPage < 1){
        productAnalysisPage = 1;
    }

    if(pageSizeSelect){
        pageSizeSelect.value =
            String(productAnalysisPageSize);
    }

    const startIndex =
        (productAnalysisPage - 1) *
        productAnalysisPageSize;

    const endIndex =
        Math.min(
            startIndex +
            productAnalysisPageSize,
            rows.length
        );

    const visibleRows =
        rows.slice(
            startIndex,
            endIndex
        );

    body.innerHTML =
        visibleRows.map(function(row,index){

            const profitClass =
                row.isLoss
                    ? "analysis-loss-value"
                    : "analysis-profit-value";

            const statusClass =
                row.isLoss
                    ? "analysis-status-loss"
                    : "analysis-status-profit";

            const statusText =
                row.isLoss
                    ? sellerBooksDetailsText("loss")
                    : sellerBooksDetailsText("profit");

            /*
               Harga Jual = Total Penjualan / QTY.
               Berlaku sama untuk semua marketplace.
            */
            const displayPrice =
                Number(row.qty) > 0
                    ? (Number(row.sales) / Number(row.qty))
                    : 0;

            const action =
                row.product
                    ? `
                        <button
                            type="button"
                            class="analysis-fix-button"
                            onclick="fixProductFromAnalysis('${String(row.product.id).replace(/'/g,"\\'") }')"
                        >
                            ${sellerBooksDetailsText("fix")}
                        </button>
                    `
                    : `
                        <span style="font-size:11px;color:#dc2626;">
                            ${sellerBooksDetailsText("noMaster")}
                        </span>
                    `;

            return `
                <tr class="${row.isLoss ? "analysis-loss-row" : ""}">
                    <td>${startIndex + index + 1}</td>
                    <td>
                        <strong>${escapeHtmlProductAnalysis(row.sku)}</strong>
                    </td>
                    <td>
                        ${escapeHtmlProductAnalysis(row.name)}
                    </td>
                    <td>${row.qty}</td>
                    <td>${formatProductAnalysisCurrency(displayPrice)}</td>
                    <td>${formatProductAnalysisCurrency(row.sales)}</td>
                    <td>${formatProductAnalysisCurrency(row.hpp)}</td>
                    <td>${formatProductAnalysisCurrency(row.admin)}</td>
                    <td class="${profitClass}">
                        ${formatProductAnalysisCurrency(row.profit)}
                    </td>
                    <td>
                        <span class="analysis-status-badge ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>${action}</td>
                </tr>
            `;
        }).join("");

    if(pagination){
        pagination.style.display = "flex";
    }

    if(paginationControls){

        let controlsHtml = "";

        controlsHtml += `
            <span class="report-transaction-page-info">
                ${startIndex + 1}-${endIndex} ${sellerBooksDetailsText("dateSeparator")} ${rows.length}
            </span>
        `;

        controlsHtml += `
            <button
                type="button"
                class="report-transaction-page-button"
                onclick="goToProductAnalysisPage(${productAnalysisPage - 1})"
                ${productAnalysisPage <= 1 ? "disabled" : ""}
                aria-label="${sellerBooksDetailsText("previous")}"
            >
                ‹
            </button>
        `;

        const maxButtons = 7;

        let pageStart =
            Math.max(
                1,
                productAnalysisPage - 3
            );

        let pageEnd =
            Math.min(
                totalPages,
                pageStart + maxButtons - 1
            );

        pageStart =
            Math.max(
                1,
                pageEnd - maxButtons + 1
            );

        if(pageStart > 1){

            controlsHtml += `
                <button
                    type="button"
                    class="report-transaction-page-button"
                    onclick="goToProductAnalysisPage(1)"
                >
                    1
                </button>
            `;

            if(pageStart > 2){
                controlsHtml += `
                    <span class="report-transaction-page-info">
                        ...
                    </span>
                `;
            }
        }

        for(
            let page = pageStart;
            page <= pageEnd;
            page++
        ){

            controlsHtml += `
                <button
                    type="button"
                    class="report-transaction-page-button ${page === productAnalysisPage ? "active" : ""}"
                    onclick="goToProductAnalysisPage(${page})"
                    aria-current="${page === productAnalysisPage ? "page" : "false"}"
                >
                    ${page}
                </button>
            `;
        }

        if(pageEnd < totalPages){

            if(pageEnd < totalPages - 1){
                controlsHtml += `
                    <span class="report-transaction-page-info">
                        ...
                    </span>
                `;
            }

            controlsHtml += `
                <button
                    type="button"
                    class="report-transaction-page-button"
                    onclick="goToProductAnalysisPage(${totalPages})"
                >
                    ${totalPages}
                </button>
            `;
        }

        controlsHtml += `
            <button
                type="button"
                class="report-transaction-page-button"
                onclick="goToProductAnalysisPage(${productAnalysisPage + 1})"
                ${productAnalysisPage >= totalPages ? "disabled" : ""}
                aria-label="${sellerBooksDetailsText("next")}"
            >
                ${sellerBooksDetailsText("nextButton")}
            </button>
        `;

        paginationControls.innerHTML =
            controlsHtml;
    }
}


function goToProductAnalysisPage(page){

    const rows =
        calculateProductAnalysisRows();

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                rows.length /
                productAnalysisPageSize
            )
        );

    productAnalysisPage =
        Math.min(
            Math.max(
                1,
                Number(page) || 1
            ),
            totalPages
        );

    renderProductAnalysis();
}


function changeProductAnalysisPageSize(value){

    const parsed =
        Number(value);

    productAnalysisPageSize =
        [20,40,50,80,100].includes(parsed)
            ? parsed
            : 20;

    productAnalysisPage = 1;

    renderProductAnalysis();
}


function escapeHtmlProductAnalysis(value){
    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}


function updateProductAnalysisFilterInfo(){

    const info =
        document.getElementById(
            "productAnalysisFilterInfo"
        );

    if(!info){
        return;
    }

    const period =
        document.getElementById(
            "productAnalysisPeriod"
        )?.value || "month";

    const names = {
        today:sellerBooksDetailsText("today"),
        yesterday:sellerBooksDetailsText("yesterday"),
        week:sellerBooksDetailsText("week"),
        lastWeek:sellerBooksDetailsText("lastWeek"),
        month:sellerBooksDetailsText("month"),
        lastMonth:sellerBooksDetailsText("lastMonth"),
        last3Months:sellerBooksDetailsText("last3Months"),
        year:sellerBooksDetailsText("year"),
        custom:sellerBooksDetailsText("custom"),
        all:sellerBooksDetailsText("all")
    };

    let label =
        names[period] ||
        sellerBooksDetailsText("month");

    const marketplaceSelect =
        document.getElementById("productAnalysisMarketplace");

    const storeSelect =
        document.getElementById("productAnalysisStore");

    const marketplaceLabel =
        marketplaceSelect?.selectedOptions?.[0]?.textContent ||
        sellerBooksDetailsText("allMarketplaces");

    const storeLabel =
        storeSelect?.selectedOptions?.[0]?.textContent ||
        sellerBooksDetailsText("allStoreAccounts");

    if(period === "custom"){

        const from =
            document.getElementById(
                "productAnalysisDateFrom"
            )?.value || "";

        const to =
            document.getElementById(
                "productAnalysisDateTo"
            )?.value || "";

        if(from || to){
            label +=
                " (" +
                (
                    from
                        ? from.split("-").reverse().join("/")
                        : "..."
                ) +
                " " + sellerBooksDetailsText("dateSeparator") + " " +
                (
                    to
                        ? to.split("-").reverse().join("/")
                        : "..."
                ) +
                ")";
        }
    }

    info.innerHTML =
        sellerBooksDetailsText("filterPeriod") + ": <strong>" +
        label +
        "</strong> &nbsp;|&nbsp; " + sellerBooksDetailsText("filterMarketplace") + ": <strong>" +
        escapeHtmlProductAnalysis(marketplaceLabel) +
        "</strong> &nbsp;|&nbsp; " + sellerBooksDetailsText("filterStore") + ": <strong>" +
        escapeHtmlProductAnalysis(storeLabel) +
        "</strong>";
}


function applyProductAnalysisFilters(){

    const period = document.getElementById("productAnalysisPeriod");
    if(period){
        sellerBooksWriteIndependentViewPreferences("productAnalysis",{
            period:period.value,
            viewDay:getSellerBooksDayKey()
        });
    }

    const productAnalysisDateFrom =
        document.getElementById("productAnalysisDateFrom");
    const productAnalysisDateTo =
        document.getElementById("productAnalysisDateTo");

    sellerBooksWriteIndependentViewPreferences("productAnalysis",{
        dateFrom:productAnalysisDateFrom?.value || "",
        dateTo:productAnalysisDateTo?.value || "",
        viewDay:getSellerBooksDayKey()
    });

    updateProductAnalysisDateUI();
    const dateFrom = document.getElementById("productAnalysisDateFrom")?.value || "";
    const dateTo = document.getElementById("productAnalysisDateTo")?.value || "";
    if(period?.value === "custom" && dateFrom && dateTo && dateFrom > dateTo){
        if(typeof sellerBooksAlert === "function"){
            sellerBooksAlert(sellerBooksDetailsText("rangeInvalid"),sellerBooksDetailsText("rangeTitle"));
        }
        return false;
    }
    updateProductAnalysisFilterInfo();

    sellerBooksScheduleDeferredRender(function(){
        renderProductAnalysis();
    });

    return false;
}


function initializeProductAnalysis(){

    const period =
        document.getElementById(
            "productAnalysisPeriod"
        );

    if(period){
        const todayKey = getSellerBooksDayKey();
        const savedDay = sellerBooksGetIndependentViewPreference(
            "productAnalysis",
            "viewDay",
            ""
        );
        const savedPeriod = sellerBooksGetIndependentViewPreference(
            "productAnalysis",
            "period",
            "today"
        );
        const savedDateFrom = sellerBooksGetIndependentViewPreference(
            "productAnalysis",
            "dateFrom",
            ""
        );
        const savedDateTo = sellerBooksGetIndependentViewPreference(
            "productAnalysis",
            "dateTo",
            ""
        );

        if(savedDay !== todayKey){
            period.value = "today";
            sellerBooksWriteIndependentViewPreferences("productAnalysis",{
                viewDay:todayKey,
                period:"today",
                dateFrom:"",
                dateTo:""
            });
        }else{
            period.value = savedPeriod || "today";

            const productAnalysisDateFrom =
                document.getElementById("productAnalysisDateFrom");
            const productAnalysisDateTo =
                document.getElementById("productAnalysisDateTo");

            if(productAnalysisDateFrom){
                productAnalysisDateFrom.value = savedDateFrom || "";
            }
            if(productAnalysisDateTo){
                productAnalysisDateTo.value = savedDateTo || "";
            }
        }
    }

    loadProductAnalysisMarketplaceFilter();
    loadProductAnalysisStoreFilter();

    updateProductAnalysisDateUI();
    updateProductAnalysisFilterInfo();
    renderProductAnalysis();
}


function fixProductFromAnalysis(id){

    if(!id){
        return;
    }

    showView("products",null);

    setTimeout(function(){

        if(typeof editProduct === "function"){
            editProduct(id);
        }

    },100);
}
