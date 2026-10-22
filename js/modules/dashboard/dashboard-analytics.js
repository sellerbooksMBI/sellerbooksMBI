/* =====================================================
   SELLERBOOKS DASHBOARD ANALYTICS
   Existing dashboard calculations and rendering are relocated
   unchanged as classic-script global functions. Shared caches and
   application state remain in main.js.
===================================================== */

function sellerBooksDashboardFormatShortRupiah(value){
    value = Number(value) || 0;

    const settings =
        typeof getSellerBooksSettings === "function"
            ? getSellerBooksSettings()
            : {currency:"IDR"};

    const currency =
        settings.currency || "IDR";

    const rates =
        typeof getSellerBooksExchangeRates === "function"
            ? getSellerBooksExchangeRates()
            : {IDR:1,USD:16500,SGD:12900,MYR:3900};

    const rate =
        Number(rates[currency]) || 1;

    const numeric =
        value / rate;

    const configMap = {
        IDR:{locale:"id-ID",currency:"IDR"},
        USD:{locale:"en-US",currency:"USD"},
        SGD:{locale:"en-SG",currency:"SGD"},
        MYR:{locale:"ms-MY",currency:"MYR"}
    };

    const config =
        configMap[currency] || configMap.IDR;

    if(currency === "IDR"){
        if(value >= 1000000000) return "Rp" + (value/1000000000).toLocaleString("id-ID",{maximumFractionDigits:1}) + " M";
        if(value >= 1000000) return "Rp" + (value/1000000).toLocaleString("id-ID",{maximumFractionDigits:1}) + " jt";
        if(value >= 1000) return "Rp" + (value/1000).toLocaleString("id-ID",{maximumFractionDigits:0}) + " rb";
        return "Rp" + Math.round(value).toLocaleString("id-ID");
    }

    const formatter =
        function(amount){
            return new Intl.NumberFormat(
                config.locale,
                {
                    style:"currency",
                    currency:config.currency,
                    minimumFractionDigits:2,
                    maximumFractionDigits:2
                }
            ).format(amount);
        };

    if(numeric >= 1000000000){
        return formatter(numeric / 1000000000) + " B";
    }
    if(numeric >= 1000000){
        return formatter(numeric / 1000000) + " M";
    }
    if(numeric >= 1000){
        return formatter(numeric / 1000) + " K";
    }

    return formatter(numeric);
}


function sellerBooksDashboardDateKey(value){

    if(!value){
        return null;
    }

    const text = String(value).trim();

    /* Tanggal murni tidak boleh dianggap UTC karena
       bisa bergeser menjadi 07:00 WIB. */
    if(/^\d{4}-\d{2}-\d{2}$/.test(text)){
        return new Date(text + "T00:00:00");
    }

    const d = new Date(value);

    if(isNaN(d.getTime())){
        return null;
    }

    /* Seluruh jam grafik dipaksa mengikuti WIB/Asia Jakarta. */
    const parts =
        new Intl.DateTimeFormat("en-CA",{
            timeZone:"Asia/Jakarta",
            year:"numeric",
            month:"2-digit",
            day:"2-digit",
            hour:"2-digit",
            minute:"2-digit",
            second:"2-digit",
            hour12:false
        }).formatToParts(d);

    const map = {};

    parts.forEach(function(part){
        if(part.type !== "literal"){
            map[part.type] = part.value;
        }
    });

    if(
        !map.year ||
        !map.month ||
        !map.day ||
        !map.hour
    ){
        return d;
    }

    return new Date(
        Number(map.year),
        Number(map.month)-1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute || 0),
        Number(map.second || 0)
    );
}


function sellerBooksRenderDashboardCharts(transactions){
    const salesChart = document.getElementById("dashboardSalesChart");
    const marketplaceChart = document.getElementById("dashboardMarketplaceChart");
    const info = document.getElementById("dashboardSalesChartInfo");
    if(!salesChart || !marketplaceChart) return;

    const chartTransactions = Array.isArray(transactions) ? transactions : [];

    if(
        sellerBooksDashboardChartsCache.rendered &&
        sellerBooksDashboardChartsCache.transactions === chartTransactions &&
        sellerBooksDashboardChartsCache.period === String(currentDashboardPeriod || "today")
    ){
        if(info) info.textContent = sellerBooksDashboardText("periodMovement") + sellerBooksDashboardPeriodText(currentDashboardPeriod);
        return;
    }

    if(info) info.textContent = sellerBooksDashboardText("periodMovement") + sellerBooksDashboardPeriodText(currentDashboardPeriod);

    const buckets = new Map();
    const marketplaceTotals = new Map();

    chartTransactions.forEach(function(item){
        const amount = Number(getReportTransactionSalesAmount(item)) || 0;
        const date = sellerBooksDashboardDateKey(item.importedAt || item.reportDate);
        if(!date) return;

        let key = "";
        let label = "";
        if(currentDashboardPeriod === "today" || currentDashboardPeriod === "yesterday") {
            key = String(date.getHours()).padStart(2,"0");
            label = key + ":00";
        } else if(currentDashboardPeriod === "year") {
            key = date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");
            label = date.toLocaleDateString("id-ID",{month:"short"});
        } else if(currentDashboardPeriod === "last3Months" || currentDashboardPeriod === "all") {
            key = date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");
            label = date.toLocaleDateString("id-ID",{month:"short",year:"2-digit"});
        } else {
            key = date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
            label = date.toLocaleDateString("id-ID",{day:"2-digit",month:"short"});
        }
        if(!buckets.has(key)) buckets.set(key,{key:key,label:label,value:0,date:date});
        buckets.get(key).value += amount;

        const marketplace = String(item.marketplace || item.platform || item.marketplaceName || "Lainnya").trim() || "Lainnya";
        marketplaceTotals.set(marketplace,(marketplaceTotals.get(marketplace)||0)+amount);
    });

    let bucketList = Array.from(buckets.values()).sort((a,b)=>a.key.localeCompare(b.key));
    if(bucketList.length === 0){
        salesChart.innerHTML = '<div class="dashboard-chart-empty">' + sellerBooksDashboardText("noSalesPeriod") + '</div>';
        marketplaceChart.innerHTML = '<div class="dashboard-chart-empty">' + sellerBooksDashboardText("noSalesPeriod") + '</div>';
        ["dashboardChartMax","dashboardChartMid","dashboardChartZero"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=sellerBooksDashboardFormatShortRupiah(0);});
        return;
    }

    // Isi titik nol agar grafik hari/minggu tetap menunjukkan seluruh periode.
    if(currentDashboardPeriod === "today" || currentDashboardPeriod === "yesterday") {
        const full=[]; for(let h=0;h<24;h++){const k=String(h).padStart(2,"0"); full.push(buckets.get(k)||{key:k,label:k+":00",value:0});} bucketList=full;
    }

    const max = 100000000;
    const mid = max/2;
    const maxEl=document.getElementById("dashboardChartMax"); const midEl=document.getElementById("dashboardChartMid");
    if(maxEl) maxEl.textContent=sellerBooksDashboardFormatShortRupiah(max);
    if(midEl) midEl.textContent=sellerBooksDashboardFormatShortRupiah(mid);
    const zeroEl=document.getElementById("dashboardChartZero");
    if(zeroEl) zeroEl.textContent=sellerBooksDashboardFormatShortRupiah(0);

    salesChart.innerHTML = bucketList.map(function(item){
        const height = item.value > 0 ? Math.max(3,Math.min(100,(item.value/max)*100)) : 1;
        return '<div class="dashboard-bar-item" title="'+item.label+' • '+formatRupiah(item.value)+'"><div class="dashboard-bar-value">'+(item.value? sellerBooksDashboardFormatShortRupiah(item.value):"")+'</div><div class="dashboard-bar" style="height:'+height+'%"></div><div class="dashboard-bar-label">'+item.label+'</div></div>';
    }).join("");

    // Default grafik selalu diarahkan ke batang biru/penjualan TERAKHIR
    // pada periode yang sedang dipilih. Berlaku untuk Hari Ini, Kemarin,
    // Minggu Ini, Minggu Lalu, Bulan, Tahun, Semua Periode, dan periode lain.
    let latestBucketIndex = -1;
    for(let i = bucketList.length - 1; i >= 0; i--){
        if(Number(bucketList[i].value) > 0){
            latestBucketIndex = i;
            break;
        }
    }

    if(latestBucketIndex >= 0) {
        /*
           Posisi grafik diatur langsung melalui scrollLeft agar
           batang biru terakhir langsung terlihat ketika dashboard
           pertama kali dibuka maupun ketika periode diganti.
           Batang terakhir ditempatkan di tengah area yang terlihat.
        */
        const positionLatestChartBar = function(){
            const bars = salesChart.querySelectorAll(".dashboard-bar-item");
            const target = bars[latestBucketIndex];
            if(!target) return;

            const targetCenter =
                target.offsetLeft + (target.offsetWidth / 2);

            salesChart.scrollLeft = Math.max(
                0,
                targetCenter - (salesChart.clientWidth / 2)
            );
        };

        requestAnimationFrame(function(){
            requestAnimationFrame(positionLatestChartBar);
        });

        setTimeout(positionLatestChartBar, 100);
    }

    const mpList=Array.from(marketplaceTotals.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const mpMax=Math.max(...mpList.map(x=>x[1]),1);
    marketplaceChart.innerHTML=mpList.map(function(pair){
        const pct=(pair[1]/mpMax)*100;
        return '<div class="dashboard-marketplace-row"><div class="dashboard-marketplace-name" title="'+pair[0]+'">'+pair[0]+'</div><div class="dashboard-marketplace-track"><div class="dashboard-marketplace-fill" style="width:'+pct+'%"></div></div><div class="dashboard-marketplace-value">'+sellerBooksDashboardFormatShortRupiah(pair[1])+'</div></div>';
    }).join("");

    sellerBooksDashboardChartsCache = {
        transactions: chartTransactions,
        period: String(currentDashboardPeriod || "today"),
        rendered: true
    };
}


function getDashboardTransactionsForPeriod(period){

    const allTransactions =
        getAllReportTransactions();

    const state =
        sellerBooksDashboardFilterState || {};

    const key =
        String(period || "today") +
        "|" +
        String(state.dateFrom || "") +
        "|" +
        String(state.dateTo || "");

    if(
        sellerBooksDashboardTransactionsCache.sourceTransactions ===
            allTransactions &&
        sellerBooksDashboardTransactionsCache.key === key &&
        sellerBooksDashboardTransactionsCache.transactions !== null
    ){
        return sellerBooksDashboardTransactionsCache.transactions;
    }

    const transactions =
        allTransactions.filter(function(item){

            const reportDate =
                item.reportDate || item.importedAt;

            return isDateInPeriod(
                reportDate,
                period
            );
        });

    sellerBooksDashboardTransactionsCache = {
        sourceTransactions:allTransactions,
        key:key,
        transactions:transactions
    };

    return transactions;
}


function sellerBooksGetDashboardMasterArray(key){

    const rawValue =
        sellerBooksCloudState
            ? sellerBooksCloudState[key]
            : undefined;

    const source =
        typeof rawValue === "string"
            ? rawValue
            : (
                rawValue == null
                    ? ""
                    : JSON.stringify(rawValue)
            );

    const cached =
        sellerBooksDashboardMasterArrayCache[key];

    if(
        cached &&
        cached.source === source
    ){
        return cached.value;
    }

    let value = [];

    try{
        const parsed =
            JSON.parse(
                source || "[]"
            );

        value =
            Array.isArray(parsed)
                ? parsed
                : [];
    }catch(error){
        value = [];
    }

    sellerBooksDashboardMasterArrayCache[key] = {
        source:source,
        value:value
    };

    return value;
}


function sellerBooksGetDashboardProductMap(products){

    if(
        sellerBooksDashboardProductMapCache.source === products &&
        sellerBooksDashboardProductMapCache.map
    ){
        return sellerBooksDashboardProductMapCache.map;
    }

    const productMap =
        new Map();

    products.forEach(function(product){

        const sku =
            String(
                product.sku || ""
            )
            .trim()
            .toLowerCase();

        if(sku){
            productMap.set(
                sku,
                product
            );
        }

    });

    sellerBooksDashboardProductMapCache = {
        source:products,
        map:productMap
    };

    return productMap;
}


function sellerBooksGetDashboardStoresIndex(stores){

    if(
        sellerBooksDashboardStoresIndexCache.source === stores &&
        sellerBooksDashboardStoresIndexCache.index
    ){
        return sellerBooksDashboardStoresIndexCache.index;
    }

    const index =        new Map();

    stores.forEach(function(store){

        const marketplaceId =
            String(
                store.marketplaceId || ""
            );

        if(!index.has(marketplaceId)){
            index.set(
                marketplaceId,
                []
            );
        }

        index.get(marketplaceId).push(store);

    });

    sellerBooksDashboardStoresIndexCache = {
        source:stores,
        index:index
    };

    return index;
}


function sellerBooksGetDashboardTransactionMarketplaceIndex(transactions){

    if(
        sellerBooksDashboardTransactionMarketplaceIndexCache.source === transactions &&
        sellerBooksDashboardTransactionMarketplaceIndexCache.index
    ){
        return sellerBooksDashboardTransactionMarketplaceIndexCache.index;
    }

    const index =
        new Map();

    transactions.forEach(function(item){

        const itemMarketplaceId =
            String(
                item.marketplaceId || ""
            )
            .trim()
            .toLowerCase();

        const itemMarketplace =
            String(
                item.marketplace || ""
            )
            .trim()
            .toLowerCase();

        const keys =
            new Set([
                "id:" + itemMarketplaceId,
                "name:" + itemMarketplace
            ]);

        if(
            itemMarketplaceId === "tiktok" ||
            itemMarketplace === "tiktok" ||
            itemMarketplace === "tiktok shop"
        ){
            keys.add("id:tiktok");
            keys.add("name:tiktok");
            keys.add("name:tiktok shop");
            keys.add("name:tiktokshop");
        }

        keys.forEach(function(key){

            if(!index.has(key)){
                index.set(
                    key,
                    []
                );
            }

            index.get(key).push(item);

        });

    });

    sellerBooksDashboardTransactionMarketplaceIndexCache = {
        source:transactions,
        index:index
    };

    return index;
}


function sellerBooksGetDashboardMarketplaceTransactions(
    index,
    marketplaceId,
    marketplaceName
){

    const keys = [
        "id:" +
        String(
            marketplaceId || ""
        )
        .trim()
        .toLowerCase(),

        "name:" +
        String(
            marketplaceName || ""
        )
        .trim()
        .toLowerCase()
    ];

    if(
        String(marketplaceId || "")
            .trim()
            .toLowerCase() === "tiktok"
    ){
        keys.push(
            "name:tiktok",
            "name:tiktok shop",
            "name:tiktokshop"
        );
    }

    const seen =
        new Set();

    const result =
        [];

    keys.forEach(function(key){

        const list =
            index.get(key) || [];

        list.forEach(function(item){

            if(seen.has(item)){
                return;
            }

            seen.add(item);
            result.push(item);

        });

    });

    return result;
}


function sellerBooksGetDashboardMarketplaceCosts(
    costs,
    period
){

    if(
        sellerBooksDashboardMarketplaceCostsCache.source === costs &&
        sellerBooksDashboardMarketplaceCostsCache.period === period &&
        sellerBooksDashboardMarketplaceCostsCache.index
    ){
        return sellerBooksDashboardMarketplaceCostsCache.index;
    }

    const index =
        new Map();

    costs.forEach(function(cost){

        const category =
            String(
                cost.category || ""
            )
            .trim()
            .toLowerCase();

        if(
            category === "packing" ||
            category.includes("packing")
        ){
            return;
        }

        const dateValue =
            cost.date ||
            cost.createdAt;

        if(
            dateValue &&
            !isDateInPeriod(
                dateValue,
                period
            )
        ){
            return;
        }

        const marketplaceId =
            String(
                cost.marketplaceId || ""
            )
            .trim();

        if(!marketplaceId){
            return;
        }

        const amount =
            Number(
                cost.amount
            ) || 0;

        index.set(
            marketplaceId,
            (
                index.get(marketplaceId) || 0
            ) + amount
        );

    });

    sellerBooksDashboardMarketplaceCostsCache = {
        source:costs,
        period:period,
        index:index
    };

    return index;
}


function renderMarketplacePerformance(){

    /*
       DASHBOARD:
       1. Kartu atas = TOTAL seluruh marketplace + seluruh akun toko.
       2. Tabel bawah = RINCIAN setiap marketplace.
       3. Harga jual dan HPP tetap berasal dari Master Produk.
       4. Marketplace yang belum memiliki transaksi tetap ditampilkan Rp0.
    */

    const transactions =
        getDashboardTransactionsForPeriod(
            currentDashboardPeriod
        );

    const marketplacesData =
        sellerBooksGetDashboardMasterArray(
            "sellerbooks_marketplaces"
        );

    const storesData =
        sellerBooksGetDashboardMasterArray(
            "sellerbooks_stores"
        );

    const performanceBody =
        document.getElementById(
            "performanceMarketplaceBody"
        );

    /*
       =====================================================
       MASTER PRODUK
       =====================================================
    */

    const products =
        sellerBooksGetDashboardMasterArray(
            "sellerbooks_products"
        );

    const productMap =
        sellerBooksGetDashboardProductMap(
            products
        );

    const costsData =
        sellerBooksGetDashboardMasterArray(
            "sellerbooks_costs"
        );

    /*
       =====================================================
       HITUNG TOTAL DASHBOARD
       =====================================================
    */

    let totalSales = 0;
    let totalQty = 0;
    let totalHpp = 0;
    let totalAdmin = 0;

    transactions.forEach(function(item){

        const sales =
            getReportTransactionSalesAmount(
                item
            );

        const qty =
            Number(item.qty) || 0;

        totalSales += sales;
        totalQty += qty;

        const product =
            productMap.get(
                String(item.sku || "")
                    .trim()
                    .toLowerCase()
            );

        if(product){
            totalHpp +=
                getReportTransactionCost(item) *
                qty;
        }

        totalAdmin +=
            sales *
            getReportTransactionFeePercent(item) /
            100;

    });

    const totalPackingCount =
        calculateReportPacking(
            transactions
        );

    const totalPacking =
        totalPackingCount *
        getPackingCostPerOrder();

    /*
       =====================================================
       BIAYA LAIN TOTAL
       =====================================================
    */

    let totalOtherCosts = 0;

    if(Array.isArray(costsData)){

        costsData.forEach(function(cost){

            const category =
                String(
                    cost.category || ""
                )
                .trim()
                .toLowerCase();

            /* Packing sudah dihitung dari transaksi. */
            if(
                category === "packing" ||
                category.includes("packing")
            ){
                return;
            }

            const dateValue =
                cost.date ||
                cost.createdAt;

            if(
                dateValue &&
                !isDateInPeriod(
                    dateValue,
                    currentDashboardPeriod
                )
            ){
                return;
            }

            totalOtherCosts +=
                Number(cost.amount) || 0;

        });

    }

    const totalNetSales =
        totalSales -
        totalAdmin;

    const totalGrossProfit =
        totalNetSales -
        totalHpp -
        totalPacking;

    const totalNetProfit =
        totalGrossProfit -
        totalOtherCosts;

    const totalMargin =
        totalSales > 0
            ? (
                totalNetProfit /
                totalSales
            ) * 100
            : 0;

    // Update diagram statistik berdasarkan transaksi periode aktif.
    sellerBooksRenderDashboardCharts(transactions);

    /*
       =====================================================
       UPDATE 4 KARTU ATAS
       =====================================================
    */

    const dashboardTotalSales =
        document.getElementById(
            "dashboardTotalSales"
        );

    const dashboardTotalQty =
        document.getElementById(
            "dashboardTotalQty"
        );

    const dashboardNetProfit =
        document.getElementById(
            "dashboardNetProfit"
        );

    const dashboardMargin =
        document.getElementById(
            "dashboardMargin"
        );

    if(dashboardTotalSales){
        dashboardTotalSales.textContent =
            formatRupiah(
                totalSales
            );
    }

    if(dashboardTotalQty){
        dashboardTotalQty.textContent =
            totalQty.toLocaleString(
                "id-ID"
            ) +
            " PCS";
    }

    if(dashboardNetProfit){
        dashboardNetProfit.textContent =
            formatRupiah(
                totalNetProfit
            );
    }

    if(dashboardMargin){
        dashboardMargin.textContent =
            totalMargin.toLocaleString(
                "id-ID",
                {
                    minimumFractionDigits:2,
                    maximumFractionDigits:2
                }
            ) +
            "%";
    }

    /*
       UPDATE KETERANGAN KARTU
    */

    const dashboardCards =
        document.querySelectorAll(
            "#dashboard .stats-grid .stat-card"
        );

    if(dashboardCards.length >= 4){

        const salesInfo =
            dashboardCards[0]
                .querySelector(
                    ".stat-info"
                );

        const qtyInfo =
            dashboardCards[1]
                .querySelector(
                    ".stat-info"
                );

        const profitInfo =
            dashboardCards[2]
                .querySelector(
                    ".stat-info"
                );

        const marginInfo =
            dashboardCards[3]
                .querySelector(
                    ".stat-info"
                );

        const dashboardPeriodLabel = sellerBooksDashboardPeriodText(currentDashboardPeriod);

        if(salesInfo){
            salesInfo.textContent =
                transactions.length
                    ? sellerBooksDashboardText("allMarketplaceTotal") + dashboardPeriodLabel
                    : sellerBooksDashboardText("noSalesPeriodShort") + dashboardPeriodLabel;
        }

        if(qtyInfo){
            qtyInfo.textContent =
                sellerBooksDashboardText("allProductsTotal") + dashboardPeriodLabel;
        }

        if(profitInfo){
            profitInfo.textContent =
                sellerBooksDashboardText("allProfitTotal") + dashboardPeriodLabel;
        }

        if(marginInfo){
            marginInfo.textContent =
                sellerBooksDashboardText("allMarginTotal") + dashboardPeriodLabel;
        }

    }

    /*
       =====================================================
       JIKA TABEL TIDAK ADA, SELESAI DI KARTU
       =====================================================
    */

    if(!performanceBody){
        return;
    }

    /*
       =====================================================
       RINCIAN SETIAP MARKETPLACE
       TIDAK HANYA MARKETPLACE AKTIF.
       Semua marketplace ditampilkan agar angka Rp0 tetap
       terlihat dan struktur dashboard konsisten.
       =====================================================
    */

    const storesIndex =
        sellerBooksGetDashboardStoresIndex(
            storesData
        );

    const marketplacesWithStores =
        new Set();

    storesData.forEach(function(store){

        marketplacesWithStores.add(
            String(
                store.marketplaceId || ""
            )
        );

    });

    const specialMarketplaceWithStore =
        {};

    marketplacesData.forEach(function(marketplace){

        if(marketplace.status !== "active"){
            return;
        }

        const marketplaceName =
            String(
                marketplace.name || ""
            )
            .trim()
            .toLowerCase();

        const isShopeeOrTiktok =
            marketplaceName === "shopee" ||
            marketplaceName === "tiktok" ||
            marketplaceName === "tiktok shop" ||
            marketplaceName === "tiktokshop";

        if(!isShopeeOrTiktok){
            return;
        }

        const marketplaceId =
            String(
                marketplace.id || ""
            );

        if(
            marketplacesWithStores.has(
                marketplaceId
            )
        ){
            specialMarketplaceWithStore[
                marketplaceName === "shopee"
                    ? "shopee"
                    : "tiktok"
            ] = true;
        }

    });

    const activeMarketplaces =
        marketplacesData.filter(function(marketplace){

            if(marketplace.status !== "active"){
                return false;
            }

            const marketplaceName =
                String(
                    marketplace.name || ""
                )
                .trim()
                .toLowerCase();

            const isShopeeOrTiktok =
                marketplaceName === "shopee" ||
                marketplaceName === "tiktok" ||
                marketplaceName === "tiktok shop" ||
                marketplaceName === "tiktokshop";

            if(!isShopeeOrTiktok){
                return true;
            }

            const marketplaceId =
                String(
                    marketplace.id || ""
                );

            if(
                marketplacesWithStores.has(
                    marketplaceId
                )
            ){
                return true;
            }

            const specialKey =
                marketplaceName === "shopee"
                    ? "shopee"
                    : "tiktok";

            /*
               Pertahankan perilaku lama:
               untuk Shopee/TikTok duplikat, hanya tampilkan satu
               jika marketplace lain yang sama sudah memiliki toko.
            */
            return !specialMarketplaceWithStore[
                specialKey
            ];

        });

    if(!activeMarketplaces.length){

    performanceBody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    style="
                        text-align:center;
                        padding:28px;
                        color:#64748b;
                    "
                >
                    ${sellerBooksDashboardText("noMarketplace")}
                </td>
            </tr>
        `;

        return;
    }

    const marketplaceCosts =
        sellerBooksGetDashboardMarketplaceCosts(
            costsData,
            currentDashboardPeriod
        );

    const marketplaceRowsCacheHit =
        sellerBooksDashboardMarketplaceRowsCache.rows &&
        sellerBooksDashboardMarketplaceRowsCache.transactions === transactions &&
        sellerBooksDashboardMarketplaceRowsCache.marketplaces === marketplacesData &&
        sellerBooksDashboardMarketplaceRowsCache.stores === storesData &&
        sellerBooksDashboardMarketplaceRowsCache.products === products &&
        sellerBooksDashboardMarketplaceRowsCache.costs === costsData &&
        sellerBooksDashboardMarketplaceRowsCache.period === String(currentDashboardPeriod || "today");

    const rows =
        marketplaceRowsCacheHit
            ? sellerBooksDashboardMarketplaceRowsCache.rows
            : activeMarketplaces.map(
            function(marketplace){

                const marketplaceId =
                    String(
                        marketplace.id || ""
                    );

                const marketplaceName =
                    String(
                        marketplace.name || ""
                    )
                    .trim()
                    .toLowerCase();

                const marketplaceStores =
                    storesIndex.get(
                        marketplaceId
                    ) || [];

                const marketplaceTransactions =
                    sellerBooksGetDashboardMarketplaceTransactions(
                        sellerBooksGetDashboardTransactionMarketplaceIndex(
                            transactions
                        ),
                        marketplaceId,
                        marketplaceName
                    );

                let sales = 0;
                let qty = 0;
                let hpp = 0;
                let admin = 0;

                marketplaceTransactions.forEach(
                    function(item){

                        const itemSales =
                            getReportTransactionSalesAmount(
                                item
                            );

                        const itemQty =
                            Number(
                                item.qty
                            ) || 0;

                        sales +=
                            itemSales;

                        qty +=
                            itemQty;

                        const product =
                            productMap.get(
                                String(
                                    item.sku || ""
                                )
                                .trim()
                                .toLowerCase()
                            );

                        if(product){

                            hpp +=
                                getReportTransactionCost(item) *
                                itemQty;

                        }

                        admin +=
                            itemSales *
                            getReportTransactionFeePercent(item) /
                            100;

                    }
                );

                const packingCount =
                    calculateReportPacking(
                        marketplaceTransactions
                    );

                const packingCost =
                    packingCount *
                    getPackingCostPerOrder();

                const otherCosts =
                    marketplaceCosts.get(
                        marketplaceId
                    ) || 0;

                const netSales =
                    sales -
                    admin;

                const netProfit =
                    netSales -
                    hpp -
                    packingCost -
                    otherCosts;

                const margin =
                    sales > 0
                        ? (
                            netProfit /
                            sales
                        ) * 100
                        : 0;

                return {
                    marketplace:
                        marketplace,
                    accountCount:
                        marketplaceStores.length,
                    sales:
                        sales,
                    netProfit:
                        netProfit,
                    margin:
                        margin,
                    qty:
                        qty,
                    packingCount:
                        packingCount
                };

            }
        );

    if(!marketplaceRowsCacheHit){
        sellerBooksDashboardMarketplaceRowsCache = {
            transactions: transactions,
            marketplaces: marketplacesData,
            stores: storesData,
            products: products,
            costs: costsData,
            period: String(currentDashboardPeriod || "today"),
            rows: rows
        };
    }

    performanceBody.innerHTML =
        rows.map(
            function(row){

                const marketplace =
                    row.marketplace;

                const marketplaceIcon =
                    getMarketplaceLogoHTML(marketplace);

                return `
                    <tr>

                        <td>
                            <div class="marketplace-row">

                                <div class="marketplace-icon">
                                    ${marketplaceIcon}
                                </div>

                                <span>
                                    ${marketplace.name || "-"}
                                </span>

                            </div>
                        </td>

                        <td>
                            <strong>
                                ${row.accountCount}
                            </strong>
                            ${sellerBooksDashboardText("account")}
                        </td>

                        <td>
                            ${formatRupiah(row.sales)}
                        </td>

                        <td>
                            <span
                                style="
                                    color:${
                                        row.netProfit < 0
                                            ? "#dc2626"
                                            : "#0f172a"
                                    };
                                    font-weight:700;
                                "
                            >
                                ${formatRupiah(
                                    row.netProfit
                                )}
                            </span>
                        </td>

                    </tr>
                `;

            }
        ).join("");

}
