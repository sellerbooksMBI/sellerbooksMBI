/* =====================================================
   SELLERBOOKS LANGUAGE TEXT DICTIONARIES
   Pure translation lookup functions; they remain classic-script
   globals for compatibility with the existing application.
===================================================== */

function sellerBooksLoginText(key){
    /*
       Gunakan sumber bahasa yang sama dengan seluruh SellerBooks.
       Setelah autentikasi, jangan kembali membaca preferensi sementara
       localStorage karena pilihan permanen berasal dari Supabase.
    */
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            language:"Bahasa",
            heroTitle:"Kelola Marketplace Lebih Cerdas.",
            heroDescription:"Pantau penjualan, produk keluar, akun toko dan laba bisnis Anda dalam satu sistem.",
            marketplace:"Multi Marketplace",
            stores:"Multi Akun Toko",
            profit:"Analisis Laba Bisnis",
            footer:"MBI — Semua Angka Bisnis, Dalam Satu Kendali.",
            title:"Selamat Datang 👋",
            description:"Masuk menggunakan akun Google untuk mengakses SellerBooks.",
            google:"Masuk dengan Google",
            securityTitle:"Data bisnis Anda terlindungi",
            securityDescription:"Setiap pengguna hanya dapat mengakses data bisnis yang memiliki izin untuknya."
        },
        en:{
            language:"Language",
            heroTitle:"Manage Your Marketplace Smarter.",
            heroDescription:"Monitor sales, outgoing products, store accounts, and business profit in one system.",
            marketplace:"Multi Marketplace",
            stores:"Multiple Store Accounts",
            profit:"Business Profit Analysis",
            footer:"MBI — All Your Business Numbers, Under One Control.",
            title:"Welcome 👋",
            description:"Sign in with your Google account to access SellerBooks.",
            google:"Sign in with Google",
            securityTitle:"Your business data is protected",
            securityDescription:"Each user can only access business data they are authorized to access."
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksStoreText(key){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            pageTitle:"Akun Toko",
            pageSubtitle:"Kelola seluruh akun toko dari marketplace yang aktif di bisnis Anda.",
            count:"Akun Toko",
            add:"Tambah Akun Toko",
            allMarketplaces:"Semua Marketplace",
            active:"Aktif",
            inactive:"Tidak Aktif",
            activeIntegrated:"Sudah terintegrasi sukses",
            noDescription:"Belum ada keterangan toko.",
            storeCode:"KODE TOKO",
            marketplace:"MARKETPLACE",
            adminFee:"BIAYA ADMIN",
            manageIntegration:"Integrasikan Akun",
            disconnectIntegration:"Copot Integrasi",
            syncOrders:"Tarik Order",
            syncTikTokTitle:"Tarik order TikTok Shop dan hitung SKU + QTY",
            syncShopeeTitle:"Tarik order Shopee",
            syncLazadaTitle:"Tarik order Lazada",
            disable:"Nonaktifkan",
            enable:"Aktifkan",
            edit:"Edit",
            delete:"Hapus",
            noStoresTitle:"Belum Ada Akun Toko",
            noStoresText:"Tambahkan akun toko dari marketplace yang aktif untuk mulai mengelola bisnis.",
            addTitle:"Tambah Akun Toko",
            editTitle:"Edit Akun Toko",
            marketplaceLabel:"Marketplace",
            chooseMarketplace:"Pilih Marketplace",
            nameLabel:"Nama Akun Toko",
            namePlaceholder:"Contoh: Adimasa Official Store",
            codeLabel:"Kode Toko",
            optional:"Opsional",
            codePlaceholder:"Contoh: SHOPEE-001",
            feeLabel:"Biaya Admin Marketplace (%)",
            feePlaceholder:"Masukkan persentase admin",
            feeHelp:"Isi sesuai biaya admin akun toko ini.",
            descriptionLabel:"Keterangan",
            descriptionPlaceholder:"Contoh: Akun utama Shopee",
            statusLabel:"Status Akun Toko",
            cancel:"Batal",
            save:"Simpan Akun Toko",
            chooseMarketplaceError:"Silakan pilih marketplace.",
            nameRequired:"Nama akun toko wajib diisi.",
            feeInvalid:"Biaya admin harus antara 0% sampai 100%.",
            marketplaceInactive:"Marketplace ini sudah tidak aktif. Silakan pilih marketplace aktif.",
            duplicate:"Nama toko ini sudah terdaftar di marketplace yang dipilih.",
            deleteConfirm:"Hapus akun toko",
            deleteQuestion:"Hapus akun toko",
            deleteWarning:"?",
            connectTitle:"Integrasikan Akun",
            disconnectTitle:"Copot Integrasi",
            storeNotFound:"Akun toko tidak ditemukan.",
            marketplaceNotFound:"Marketplace akun toko tidak ditemukan.",
            disconnectConfirm:"Copot integrasi",
            disconnectWarning:"Setelah dicopot, akun ini harus diotorisasi ulang jika ingin terhubung kembali.",
            soonTitle:"Segera Hadir",
            integrationUnavailable:"Integrasi {marketplace} belum tersedia saat ini. Fitur sinkronisasi API akan segera hadir setelah konektor/API resmi SellerBooks siap. Sementara Anda bisa melakukan upload file orderan marketplace secara manual melalui Import Penjualan."
        },
        en:{
            pageTitle:"Store Accounts",
            pageSubtitle:"Manage all store accounts from the active marketplaces in your business.",
            count:"Store Accounts",
            add:"Add Store Account",
            allMarketplaces:"All Marketplaces",
            active:"Active",
            inactive:"Inactive",
            activeIntegrated:"Successfully integrated",
            noDescription:"No store description.",
            storeCode:"STORE CODE",
            marketplace:"MARKETPLACE",
            adminFee:"ADMIN FEE",
            manageIntegration:"Integrate Account",
            disconnectIntegration:"Disconnect Integration",
            syncOrders:"Pull Orders",
            syncTikTokTitle:"Pull TikTok Shop orders and calculate SKU + QTY",
            syncShopeeTitle:"Pull Shopee orders",
            syncLazadaTitle:"Pull Lazada orders",
            disable:"Disable",
            enable:"Enable",
            edit:"Edit",
            delete:"Delete",
            noStoresTitle:"No Store Accounts Yet",
            noStoresText:"Add a store account from an active marketplace to start managing your business.",
            addTitle:"Add Store Account",
            editTitle:"Edit Store Account",
            marketplaceLabel:"Marketplace",
            chooseMarketplace:"Select Marketplace",
            nameLabel:"Store Account Name",
            namePlaceholder:"Example: Adimasa Official Store",
            codeLabel:"Store Code",
            optional:"Optional",
            codePlaceholder:"Example: SHOPEE-001",
            feeLabel:"Marketplace Admin Fee (%)",
            feePlaceholder:"Enter admin fee percentage",
            feeHelp:"Enter the admin fee for this store account.",
            descriptionLabel:"Description",
            descriptionPlaceholder:"Example: Main Shopee account",
            statusLabel:"Store Account Status",
            cancel:"Cancel",
            save:"Save Store Account",
            chooseMarketplaceError:"Please select a marketplace.",
            nameRequired:"Store account name is required.",
            feeInvalid:"Admin fee must be between 0% and 100%.",
            marketplaceInactive:"This marketplace is no longer active. Please select an active marketplace.",
            duplicate:"This store name is already registered in the selected marketplace.",
            deleteConfirm:"Delete store account",
            deleteQuestion:"Delete store account",
            deleteWarning:"?",
            connectTitle:"Integrate Account",
            disconnectTitle:"Disconnect Integration",
            storeNotFound:"Store account not found.",
            marketplaceNotFound:"Store account marketplace not found.",
            disconnectConfirm:"Disconnect integration",
            disconnectWarning:"After disconnecting, this account must be authorized again if you want to reconnect it.",
            soonTitle:"Coming Soon",
            integrationUnavailable:"Integration for {marketplace} is not available yet. API synchronization will be available after the official SellerBooks connector/API is ready. In the meantime, you can manually upload marketplace order files through Sales Import."
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksStoreCountText(count){
    return (Number(count) || 0) + " " + sellerBooksStoreText("count");
}


function sellerBooksMarketplaceText(key){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            pageTitle:"Marketplace",
            pageSubtitle:"Kelola marketplace yang digunakan oleh bisnis Anda.",
            count:"Marketplace",
            add:"Tambah Marketplace",
            active:"Aktif",
            inactive:"Tidak Aktif",
            activeReady:"Marketplace aktif dan siap digunakan",
            inactiveUnused:"Marketplace belum digunakan",
            manageStores:"Kelola Toko",
            disable:"Nonaktifkan",
            enable:"Aktifkan",
            delete:"Hapus",
            addTitle:"Tambah Marketplace",
            editTitle:"Edit Marketplace",
            nameLabel:"Nama Marketplace",
            namePlaceholder:"Contoh: Shopee",
            statusLabel:"Status",
            cancel:"Batal",
            save:"Simpan Marketplace",
            nameRequired:"Nama marketplace wajib diisi.",
            deleteConfirm:"Hapus marketplace",
            deleteWarning:"Data akun toko yang terhubung dengan marketplace ini juga akan dihapus.",
            deleteSuccess:"Marketplace",
            deleteSuccessSuffix:"berhasil dihapus dan perubahan sudah terverifikasi tersimpan di database.",
            deleteFailedTitle:"Marketplace belum jadi dihapus dari database.",
            deleteFailedBody:"Perubahan dibatalkan karena verifikasi Supabase gagal.",
            deleteFailedDetail:"Detail:",
            more:"Opsi marketplace"
        },
        en:{
            pageTitle:"Marketplace",
            pageSubtitle:"Manage the marketplaces used by your business.",
            count:"Marketplaces",
            add:"Add Marketplace",
            active:"Active",
            inactive:"Inactive",
            activeReady:"Marketplace is active and ready to use",
            inactiveUnused:"Marketplace is not in use",
            manageStores:"Manage Stores",
            disable:"Disable",
            enable:"Enable",
            delete:"Delete",
            addTitle:"Add Marketplace",
            editTitle:"Edit Marketplace",
            nameLabel:"Marketplace Name",
            namePlaceholder:"Example: Shopee",
            statusLabel:"Status",
            cancel:"Cancel",
            save:"Save Marketplace",
            nameRequired:"Marketplace name is required.",
            deleteConfirm:"Delete marketplace",
            deleteWarning:"Store accounts connected to this marketplace will also be deleted.",
            deleteSuccess:"Marketplace",
            deleteSuccessSuffix:"was deleted successfully and the change has been verified in the database.",
            deleteFailedTitle:"Marketplace was not deleted from the database.",
            deleteFailedBody:"The change was canceled because Supabase verification failed.",
            deleteFailedDetail:"Details:",
            more:"Marketplace options"
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksMarketplaceCountText(count){
    const total = Number(count) || 0;
    return total + " " + sellerBooksMarketplaceText("count");
}


function sellerBooksDashboardText(key){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            welcomeTitle:"Selamat Datang di SellerBooks 👋",
            welcomeText:"Kelola seluruh penjualan marketplace, produk, akun toko, dan laba bisnis Anda dalam satu sistem.",
            totalSales:"TOTAL PENJUALAN", totalProducts:"PRODUK TERJUAL", netProfit:"LABA BERSIH", netMargin:"MARGIN BERSIH",
            noSales:"Belum ada data penjualan", productsOut:"Total produk keluar", afterCosts:"Setelah seluruh biaya", profitPerformance:"Performa keuntungan bisnis",
            resellerReceivable:"TOTAL PIUTANG RESELLER", receivableInfo:"Total piutang dikurangi pembayaran yang sudah masuk", viewReceivable:"Lihat Piutang →",
            salesChart:"Grafik Penjualan", salesMovement:"Pergerakan penjualan berdasarkan periode", marketplaceSales:"Penjualan per Marketplace", marketplaceComparison:"Perbandingan omzet berdasarkan marketplace",
            marketplacePerformance:"Performa Marketplace", marketplaceSummary:"Ringkasan seluruh marketplace", refreshDashboard:"Refresh Dashboard", viewMarketplace:"Lihat Marketplace →",
            marketplace:"Marketplace", storeAccount:"Akun Toko", sales:"Penjualan", netProfitHeader:"Laba Bersih", noMarketplace:"Belum ada marketplace.", account:"Akun",
            today:"Hari Ini", yesterday:"Kemarin", week:"Minggu Ini", lastWeek:"Minggu Lalu", month:"Bulan Ini", lastMonth:"Bulan Lalu", last3Months:"3 Bulan Terakhir", year:"Tahun Ini", custom:"Pilih Tanggal", all:"Semua Periode",
            fromDate:"Dari Tanggal", toDate:"Sampai Dengan", dateRangeInfo:"Maksimal rentang tanggal 3 bulan terakhir sampai hari ini.",
            dateRequired:"Silakan pilih Dari Tanggal dan Sampai Dengan terlebih dahulu.", dateOrderInvalid:"Dari Tanggal tidak boleh lebih besar dari Sampai Dengan.", dateValidationTitle:"Validasi Tanggal",
            periodMovement:"Pergerakan penjualan • ", noSalesPeriod:"Belum ada data penjualan pada periode ini", noSalesPeriodShort:"Tidak ada penjualan • ",
            allMarketplaceTotal:"Total semua marketplace • ", allProductsTotal:"Total produk semua marketplace • ", allProfitTotal:"Laba bersih semua marketplace • ", allMarginTotal:"Margin bersih semua marketplace • "
        },
        en:{
            welcomeTitle:"Welcome to SellerBooks 👋",
            welcomeText:"Manage all marketplace sales, products, store accounts, and business profit in one system.",
            totalSales:"TOTAL SALES", totalProducts:"PRODUCTS SOLD", netProfit:"NET PROFIT", netMargin:"NET MARGIN",
            noSales:"No sales data yet", productsOut:"Total products sold", afterCosts:"After all costs", profitPerformance:"Business profit performance",
            resellerReceivable:"TOTAL RESELLER RECEIVABLES", receivableInfo:"Total receivables minus payments already received", viewReceivable:"View Receivables →",
            salesChart:"Sales Chart", salesMovement:"Sales movement by period", marketplaceSales:"Sales by Marketplace", marketplaceComparison:"Revenue comparison by marketplace",
            marketplacePerformance:"Marketplace Performance", marketplaceSummary:"Summary of all marketplaces", refreshDashboard:"Refresh Dashboard", viewMarketplace:"View Marketplace →",
            marketplace:"Marketplace", storeAccount:"Store Account", sales:"Sales", netProfitHeader:"Net Profit", noMarketplace:"No marketplaces yet.", account:"Account",
            today:"Today", yesterday:"Yesterday", week:"This Week", lastWeek:"Last Week", month:"This Month", lastMonth:"Last Month", last3Months:"Last 3 Months", year:"This Year", custom:"Custom Date", all:"All Periods",
            fromDate:"From Date", toDate:"To Date", dateRangeInfo:"Maximum date range: the last 3 months through today.",
            dateRequired:"Please select both From Date and To Date first.", dateOrderInvalid:"From Date cannot be later than To Date.", dateValidationTitle:"Date Validation",
            periodMovement:"Sales movement • ", noSalesPeriod:"No sales data for this period", noSalesPeriodShort:"No sales • ",
            allMarketplaceTotal:"Total all marketplaces • ", allProductsTotal:"Total products across all marketplaces • ", allProfitTotal:"Net profit across all marketplaces • ", allMarginTotal:"Net margin across all marketplaces • "
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksDashboardPeriodText(period){
    return sellerBooksDashboardText(period || "today");
}


function sellerBooksReportsText(key){
    const language = sellerBooksCurrentLanguage();

    const translations = {
        id:{
            filterTitle:"Filter Laporan",
            filterSubtitle:"Pilih periode, marketplace, dan akun toko.",
            period:"Periode",
            today:"Hari Ini",
            yesterday:"Kemarin",
            week:"Minggu Ini",
            lastWeek:"Minggu Lalu",
            month:"Bulan Ini",
            lastMonth:"Bulan Lalu",
            last3Months:"3 Bulan Terakhir",
            year:"Tahun Ini",
            custom:"Pilih Tanggal",
            allPeriods:"Semua Periode",
            fromDate:"Dari Tanggal",
            toDate:"Sampai Dengan",
            maxRange:"Maksimal rentang tanggal 3 bulan terakhir.",
            allMarketplaces:"Semua Marketplace",
            marketplace:"Marketplace",
            storeAccount:"Akun Toko",
            allStoreAccounts:"Semua Akun Toko",
            showingAllSales:"Menampilkan semua data penjualan.",
            downloadPdf:"📄 Download PDF Laporan",
            deleteTitle:"Hapus Laporan",
            deleteSubtitle:"Hapus data import penjualan secara spesifik berdasarkan tanggal, marketplace, dan akun toko.",
            deleteScope:"Penghapusan hanya menyentuh laporan yang sesuai dengan tanggal + marketplace + akun toko yang dipilih.",
            deleteScope2:"Master Produk, Marketplace, Akun Toko, dan Biaya Lain tidak ikut dihapus.",
            deleteScope3:"Stok Master Produk akan otomatis dikembalikan sesuai QTY yang sebelumnya dipotong oleh laporan yang dihapus.",
            deleteButton:"🗑️ Hapus Laporan",
            totalSales:"TOTAL PENJUALAN",
            noData:"Belum ada data",
            netSales:"PENJUALAN BERSIH",
            afterMarketplace:"Setelah potongan marketplace",
            productsSold:"PRODUK TERJUAL",
            totalProductsSold:"Total produk terjual",
            totalPacking:"TOTAL PACKING",
            orderPacking:"Jumlah order/packing",
            totalHpp:"TOTAL HPP",
            soldProductCost:"Modal produk terjual",
            otherCosts:"BIAYA LAIN",
            additionalBusinessCosts:"Biaya tambahan bisnis",
            grossProfit:"LABA KOTOR",
            afterHppPacking:"Setelah HPP dan packing",
            netProfit:"LABA BERSIH",
            afterAllCosts:"Setelah seluruh biaya",
            profitMargin:"Margin Profit",
            profitMarginSubtitle:"Persentase laba bersih terhadap penjualan.",
            unmatchedTitle:"SKU Belum Ditemukan di Master Produk",
            unmatchedSubtitle:"Daftar SKU transaksi yang belum memiliki pasangan pada Master Produk.",
            rows:"Jumlah Baris",
            qty:"Total QTY",
            noUnmatched:"Tidak ada SKU yang belum ditemukan.",
            marketplacePerformance:"Performa Marketplace",
            marketplaceSummary:"Ringkasan performa berdasarkan marketplace.",
            marketplace:"Marketplace",
            sales:"Penjualan",
            netSalesHeader:"Penjualan Bersih",
            packing:"Packing",
            netProfitHeader:"Laba Bersih",
            margin:"Margin",
            noReportData:"Belum ada data laporan.",
            storePerformance:"Performa Akun Toko",
            storeSummary:"Ringkasan performa masing-masing akun toko.",
            detailsTitle:"Detail Penjualan",
            detailsSubtitle:"Daftar transaksi berdasarkan filter yang dipilih.",
            date:"Tanggal",
            order:"Order",
            orderId:"Order ID",
            skuSellerBooks:"SKU SellerBooks",
            status:"Status",
            noSalesData:"Belum ada data penjualan.",
            show:"Tampilkan",
            rowsLower:"baris",
            previous:"Sebelumnya",
            next:"Berikutnya",
            valid:"✓ Valid",
            skuMissing:"⚠ SKU belum ada",
            allStores:"Semua Toko",
            adminMarketplace:"Admin marketplace",
            transactionRows:"Menampilkan {rows} baris transaksi • {transactions} transaksi • {products} produk",
            unmatchedInfo:" • {count} SKU belum ditemukan di Master Produk",
            pageOf:"dari",
            errorDetails:"Detail penjualan gagal ditampilkan. Silakan refresh halaman.",
            errorReport:"Data laporan gagal ditampilkan. Silakan refresh halaman.",
            deleteRequired:"Silakan pilih Dari Tanggal dan Sampai Dengan terlebih dahulu.",
            invalidRange:"Rentang tanggal tidak valid.",
            invalidOrder:"Dari Tanggal tidak boleh lebih besar dari Sampai Dengan.",
            deleteRangeLimit:"Penghapusan hanya dapat dilakukan untuk rentang maksimal 3 bulan terakhir sampai hari ini.",
            noDeleteMatch:"Tidak ada laporan yang cocok dengan tanggal, marketplace, dan akun toko yang dipilih.",
            deleteConfirmTitle:"HAPUS LAPORAN PERMANEN?",
            range:"Rentang",
            importCount:"Jumlah data import",
            deleteOnlyMatching:"Hanya laporan yang sesuai dengan filter di atas yang akan dihapus.",
            stockRestore:"Stok produk akan DIKEMBALIKAN sesuai jumlah stok yang sebelumnya dipotong oleh laporan tersebut.",
            cannotUndo:"Data yang dihapus tidak dapat dikembalikan.",
            deleteSuccess:"Laporan berhasil dihapus.",
            deletedCount:"data import telah dihapus.",
            restoredStock:"Stok dikembalikan:",
            pcs:"pcs.",
            noStockRestore:"Tidak ada stok yang perlu dikembalikan."
        },
        en:{
            filterTitle:"Report Filters",
            filterSubtitle:"Select period, marketplace, and store account.",
            period:"Period",
            today:"Today",            yesterday:"Yesterday",
            week:"This Week",
            lastWeek:"Last Week",
            month:"This Month",
            lastMonth:"Last Month",
            last3Months:"Last 3 Months",
            year:"This Year",
            custom:"Custom Date",
            allPeriods:"All Periods",
            fromDate:"From Date",
            toDate:"To Date",
            maxRange:"Maximum date range: the last 3 months.",
            allMarketplaces:"All Marketplaces",
            marketplace:"Marketplace",
            storeAccount:"Store Account",
            allStoreAccounts:"All Store Accounts",
            showingAllSales:"Showing all sales data.",
            downloadPdf:"📄 Download PDF Report",
            deleteTitle:"Delete Reports",
            deleteSubtitle:"Delete sales import data specifically by date, marketplace, and store account.",
            deleteScope:"Deletion only affects reports matching the selected date, marketplace, and store account.",
            deleteScope2:"Master Products, Marketplaces, Store Accounts, and Other Costs are not deleted.",
            deleteScope3:"Master Product stock will be automatically restored according to the quantity previously deducted by the deleted reports.",
            deleteButton:"🗑️ Delete Reports",
            totalSales:"TOTAL SALES",
            noData:"No data yet",
            netSales:"NET SALES",
            afterMarketplace:"After marketplace deductions",
            productsSold:"PRODUCTS SOLD",
            totalProductsSold:"Total products sold",
            totalPacking:"TOTAL PACKING",
            orderPacking:"Orders/packing count",
            totalHpp:"TOTAL COGS",
            soldProductCost:"Cost of sold products",
            otherCosts:"OTHER COSTS",
            additionalBusinessCosts:"Additional business costs",
            grossProfit:"GROSS PROFIT",
            afterHppPacking:"After COGS and packing",
            netProfit:"NET PROFIT",
            afterAllCosts:"After all costs",
            profitMargin:"Profit Margin",
            profitMarginSubtitle:"Net profit as a percentage of sales.",
            unmatchedTitle:"SKUs Not Found in Master Products",
            unmatchedSubtitle:"List of transaction SKUs that do not have a matching Master Product.",
            rows:"Rows",
            qty:"Total QTY",
            noUnmatched:"No unmatched SKUs found.",
            marketplacePerformance:"Marketplace Performance",
            marketplaceSummary:"Performance summary by marketplace.",
            marketplace:"Marketplace",
            sales:"Sales",
            netSalesHeader:"Net Sales",
            packing:"Packing",
            netProfitHeader:"Net Profit",
            margin:"Margin",
            noReportData:"No report data yet.",
            storePerformance:"Store Account Performance",
            storeSummary:"Performance summary for each store account.",
            detailsTitle:"Sales Details",
            detailsSubtitle:"List of transactions based on the selected filters.",
            date:"Date",
            order:"Order",
            orderId:"Order ID",
            skuSellerBooks:"SellerBooks SKU",
            status:"Status",
            noSalesData:"No sales data yet.",
            show:"Show",
            rowsLower:"rows",
            previous:"Previous",
            next:"Next",
            valid:"✓ Valid",
            skuMissing:"⚠ SKU not in Master",
            allStores:"All Stores",
            adminMarketplace:"Marketplace admin",
            transactionRows:"Showing {rows} transaction rows • {transactions} transactions • {products} products",
            unmatchedInfo:" • {count} SKUs not found in Master Products",
            pageOf:"of",
            errorDetails:"Sales details failed to display. Please refresh the page.",
            errorReport:"Report data failed to display. Please refresh the page.",
            deleteRequired:"Please select From Date and To Date first.",
            invalidRange:"Invalid date range.",
            invalidOrder:"From Date cannot be later than To Date.",
            deleteRangeLimit:"Deletion is limited to a maximum range of the last 3 months through today.",
            noDeleteMatch:"No reports match the selected date, marketplace, and store account.",
            deleteConfirmTitle:"PERMANENTLY DELETE REPORTS?",
            range:"Range",
            importCount:"Import data count",
            deleteOnlyMatching:"Only reports matching the filters above will be deleted.",
            stockRestore:"Product stock will be RESTORED according to the quantity previously deducted by those reports.",
            cannotUndo:"Deleted data cannot be recovered.",
            deleteSuccess:"Reports deleted successfully.",
            deletedCount:"import records have been deleted.",
            restoredStock:"Stock restored:",
            pcs:"pcs.",
            noStockRestore:"No stock needs to be restored."
        }
    };

    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksReportPeriodText(value){
    const map = {
        today:"today",
        yesterday:"yesterday",
        week:"week",
        lastWeek:"lastWeek",
        month:"month",
        lastMonth:"lastMonth",
        last3Months:"last3Months",
        year:"year",
        custom:"custom",
        all:"allPeriods"
    };
    return sellerBooksReportsText(map[value] || "allPeriods");
}


function sellerBooksSettingsText(key){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            pageTitle:"Pengaturan", pageSubtitle:"Kelola konfigurasi bisnis dan preferensi SellerBooks Anda.",
            languageTitle:"Bahasa", languageDesc:"Pilih bahasa SellerBooks. Pilihan ini tersimpan pada akun Anda dan digunakan di semua perangkat.",
            languageLabel:"Bahasa Tampilan", languageSaved:"Bahasa tersimpan pada akun Anda.", saveLanguage:"💾 Simpan Bahasa",
            businessTitle:"Nama Bisnis", businessDesc:"Atur nama bisnis yang digunakan sebagai identitas usaha.",
            businessLabel:"Nama Bisnis", businessPlaceholder:"Contoh: PT Adiimasa Distribusi Indonesia", noChanges:"Belum ada perubahan.", save:"💾 Simpan",
            logoTitle:"Logo Bisnis", logoDesc:"Gunakan logo bisnis sebagai identitas visual SellerBooks.", chooseLogo:"📁 Pilih Logo", removeLogo:"Hapus Logo",
            logoFormats:"PNG, JPG atau WEBP. Maksimal 1 MB.",
            currencyTitle:"Mata Uang", currencyDesc:"Atur mata uang yang digunakan untuk tampilan nilai laporan.", currencyLabel:"Mata Uang",
            idr:"IDR — Rupiah Indonesia", usd:"USD — US Dollar", sgd:"SGD — Singapore Dollar", myr:"MYR — Malaysian Ringgit",
            manualRate:"Atur Kurs Manual", rateDesc:"Kurs yang digunakan untuk konversi dari IDR.",
            usdRate:"1 USD = Rp", sgdRate:"1 SGD = Rp", myrRate:"1 MYR = Rp",
            ratePlaceholderUSD:"Contoh: 16500", ratePlaceholderSGD:"Contoh: 12900", ratePlaceholderMYR:"Contoh: 3900",
            rateNote:"💱 Masukkan nilai rupiah untuk 1 unit mata uang asing. Contoh: jika 1 USD = Rp16.500, isi 16500. Perubahan kurs akan digunakan untuk seluruh nominal yang ditampilkan.",
            rateSaved:"Kurs tersimpan digunakan untuk konversi.", saveRate:"💾 Simpan Kurs",
            currencyNote:"ℹ️ Semua data disimpan dalam IDR sebagai nilai dasar. Saat mata uang diganti, seluruh nominal otomatis dikonversi ke kurs tampilan.",
            packingTitle:"Biaya Packing Default", packingDesc:"Nilai ini otomatis menjadi biaya packing per 1 order saat import penjualan.",
            packingLabel:"Biaya Packing per Order", packingPlaceholder:"Contoh: 850", packingSaved:"Nilai tersimpan digunakan sebagai default import.",
            roundingTitle:"Pembulatan", roundingDesc:"Atur pembulatan nilai uang yang ditampilkan di SellerBooks.", roundingLabel:"Pembulatan Nilai",
            roundingNone:"Tanpa Pembulatan", rounding10:"Ke Rp10 terdekat", rounding100:"Ke Rp100 terdekat", rounding1000:"Ke Rp1.000 terdekat",
            roundingNote:"ℹ️ Pembulatan hanya memengaruhi tampilan angka, bukan data transaksi yang tersimpan.",
            backupTitle:"Backup & Restore Data", backupDesc:"Simpan seluruh data SellerBooks ke file atau pulihkan dari file backup.",
            backup:"⬇️ Backup Data", restore:"⬆️ Restore Data", restoreWarning:"⚠️ Restore akan mengganti data SellerBooks saat ini dengan isi file backup.",
            backupSuccessTitle:"Backup Berhasil", backupSuccess:"File backup SellerBooks berhasil dibuat dan diunduh ke perangkat Anda.",
            saved:"Pengaturan berhasil disimpan.", packingInfo:"Default packing:", rateInfo:"Kurs tersimpan.",
            logoTooLarge:"Ukuran logo maksimal 1 MB.", logoFormat:"Format logo harus PNG, JPG, atau WEBP.",
            sessionNotReady:"❌ Sesi SellerBooks belum siap. Silakan login kembali.", logoSaved:"✅ Logo bisnis berhasil disimpan.",
            logoSaveFailed:"❌ Logo gagal disimpan.", logoReadFailed:"❌ Logo gagal dibaca.", removeLogoConfirm:"Hapus logo bisnis yang tersimpan?",
            removeLogoFailed:"❌ Logo gagal dihapus.", restoreConfirm:"Restore akan mengganti seluruh data SellerBooks saat ini dengan data dari file backup. Lanjutkan?",
            invalidBackup:"Format backup tidak valid.", restoreSuccess:"✅ Restore berhasil. SellerBooks akan dimuat ulang.",
            restoreInvalid:"❌ File backup tidak valid atau rusak.", restoreReadFailed:"File backup gagal dibaca.",
            savingLanguage:"Menyimpan Bahasa Indonesia...", languageSavedCloud:"Bahasa Indonesia tersimpan pada akun Anda.",
            languageSaveFailed:"Bahasa gagal disimpan. Silakan coba lagi."
        },
        en:{
            pageTitle:"Settings", pageSubtitle:"Manage your SellerBooks business configuration and preferences.",
            languageTitle:"Language", languageDesc:"Choose the SellerBooks language. This choice is saved to your account and used across all devices.",
            languageLabel:"Display Language", languageSaved:"Language is saved to your account.", saveLanguage:"💾 Save Language",
            businessTitle:"Business Name", businessDesc:"Set the business name used as your business identity.",
            businessLabel:"Business Name", businessPlaceholder:"Example: PT Adiimasa Distribusi Indonesia", noChanges:"No changes yet.", save:"💾 Save",
            logoTitle:"Business Logo", logoDesc:"Use your business logo as the SellerBooks visual identity.", chooseLogo:"📁 Choose Logo", removeLogo:"Remove Logo",
            logoFormats:"PNG, JPG, or WEBP. Maximum 1 MB.",
            currencyTitle:"Currency", currencyDesc:"Set the currency used to display report values.", currencyLabel:"Currency",
            idr:"IDR — Indonesian Rupiah", usd:"USD — US Dollar", sgd:"SGD — Singapore Dollar", myr:"MYR — Malaysian Ringgit",
            manualRate:"Set Manual Exchange Rates", rateDesc:"Exchange rates used to convert from IDR.",
            usdRate:"1 USD = Rp", sgdRate:"1 SGD = Rp", myrRate:"1 MYR = Rp",
            ratePlaceholderUSD:"Example: 16500", ratePlaceholderSGD:"Example: 12900", ratePlaceholderMYR:"Example: 3900",
            rateNote:"💱 Enter the rupiah value for 1 unit of foreign currency. Example: if 1 USD = Rp16,500, enter 16500. Exchange-rate changes will be used for all displayed amounts.",
            rateSaved:"Saved rates are used for conversion.", saveRate:"💾 Save Exchange Rates",
            currencyNote:"ℹ️ All data is stored in IDR as the base value. When the currency changes, all displayed amounts are automatically converted using the selected rates.",
            packingTitle:"Default Packing Cost", packingDesc:"This value automatically becomes the packing cost per order when importing sales.",
            packingLabel:"Packing Cost per Order", packingPlaceholder:"Example: 850", packingSaved:"The saved value is used as the import default.",
            roundingTitle:"Rounding", roundingDesc:"Set how monetary values are rounded when displayed in SellerBooks.", roundingLabel:"Rounding Value",
            roundingNone:"No Rounding", rounding10:"Round to nearest Rp10", rounding100:"Round to nearest Rp100", rounding1000:"Round to nearest Rp1,000",
            roundingNote:"ℹ️ Rounding only affects displayed values, not stored transaction data.",
            backupTitle:"Data Backup & Restore", backupDesc:"Save all SellerBooks data to a file or restore it from a backup file.",
            backup:"⬇️ Backup Data", restore:"⬆️ Restore Data", restoreWarning:"⚠️ Restore will replace the current SellerBooks data with the contents of the backup file.",
            backupSuccessTitle:"Backup Successful", backupSuccess:"The SellerBooks backup file was successfully created and downloaded to your device.",
            saved:"Settings saved successfully.", packingInfo:"Default packing:", rateInfo:"Rates saved.",
            logoTooLarge:"Logo size must not exceed 1 MB.", logoFormat:"Logo format must be PNG, JPG, or WEBP.",
            sessionNotReady:"❌ SellerBooks session is not ready. Please log in again.", logoSaved:"✅ Business logo saved successfully.",
            logoSaveFailed:"❌ Failed to save the business logo.", logoReadFailed:"❌ Failed to read the logo.", removeLogoConfirm:"Remove the saved business logo?",
            removeLogoFailed:"❌ Failed to remove the business logo.", restoreConfirm:"Restore will replace all current SellerBooks data with data from the backup file. Continue?",
            invalidBackup:"Invalid backup format.", restoreSuccess:"✅ Restore successful. SellerBooks will reload.",
            restoreInvalid:"❌ The backup file is invalid or corrupted.", restoreReadFailed:"Failed to read the backup file.",
            savingLanguage:"Saving English...", languageSavedCloud:"English saved to your account.",
            languageSaveFailed:"Language could not be saved. Please try again."
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksOwnerSetupText(key){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            title:"Lengkapi Data Pemilik",
            description:"Sebelum masuk ke SellerBooks, silakan masukkan nama pemilik atau nama usaha Anda.",
            label:"Nama Pemilik / Nama Usaha",
            placeholder:"Contoh: Adiimasa",
            save:"💾 Simpan & Masuk SellerBooks",
            note:"Data ini akan digunakan sebagai identitas pemilik akun SellerBooks Anda.",
            nameRequired:"Silakan isi Nama Pemilik atau Nama Usaha terlebih dahulu.",
            session:"Sesi login tidak ditemukan. Silakan login kembali.",
            success:"✅ Data berhasil disimpan!\n\nSelamat datang, ",
            failed:"❌ Nama Pemilik gagal disimpan ke server."
        },
        en:{
            title:"Complete Owner Information",
            description:"Before entering SellerBooks, please enter the owner's name or your business name.",
            label:"Owner Name / Business Name",
            placeholder:"Example: Adiimasa",
            save:"💾 Save & Enter SellerBooks",
            note:"This information will be used as the identity of your SellerBooks account.",
            nameRequired:"Please enter the Owner Name or Business Name first.",
            session:"Login session not found. Please log in again.",
            success:"✅ Information saved successfully!\n\nWelcome, ",
            failed:"❌ Failed to save the Owner Name to the server."
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksDetailsText(key){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            pageTitle:"Rincian",pageSubtitle:"Analisis laba dan kerugian setiap produk",
            sectionTitle:"Rincian Produk",sectionSubtitle:"Analisis laba setiap SKU untuk mendeteksi produk yang minus dan mengetahui produk mana yang perlu diperbaiki.",
            filterTitle:"Filter Rincian",filterSubtitle:"Pilih periode, marketplace, dan akun toko untuk mengetahui produk minus secara lebih spesifik.",
            period:"Periode",marketplace:"Marketplace",storeAccount:"Akun Toko",
            today:"Hari Ini",yesterday:"Kemarin",week:"Minggu Ini",lastWeek:"Minggu Lalu",month:"Bulan Ini",lastMonth:"Bulan Lalu",last3Months:"3 Bulan Terakhir",year:"Tahun Ini",custom:"Pilih Tanggal",all:"Semua Periode",
            allMarketplaces:"Semua Marketplace",allStoreAccounts:"Semua Akun Toko",fromDate:"Dari Tanggal",toDate:"Sampai Dengan",
            filterPeriod:"Periode",filterMarketplace:"Marketplace",filterStore:"Akun",
            downloadPdf:"📄 Download PDF Produk",totalProducts:"Total Produk",profitProducts:"Produk Untung",lossProducts:"Produk Minus",totalProfit:"Total Laba Produk",
            salesPerProduct:"Rincian Penjualan Per Produk",salesPerProductSubtitle:"Produk minus ditampilkan paling atas agar mudah diperbaiki.",
            no:"No",sku:"SKU",productName:"Nama Produk",qty:"QTY",sellingPrice:"Harga Jual",totalSales:"Total Penjualan",hpp:"HPP",marketplaceAdmin:"Admin Marketplace",productProfit:"Laba Produk",status:"Status",actions:"Aksi",
            loss:"⚠️ MINUS",profit:"✓ UNTUNG",fix:"✏️ Perbaiki",noMaster:"Belum ada master",noTransactions:"Belum ada transaksi pada periode yang dipilih.",
            show:"Tampilkan",rows:"baris",previous:"Halaman sebelumnya",next:"Halaman berikutnya",nextButton:"Next ›",dateSeparator:"s/d",dateEllipsis:"...",rangeInvalid:"Tanggal awal tidak boleh lebih besar dari tanggal akhir.",rangeTitle:"Validasi Tanggal"
        },
        en:{
            pageTitle:"Details",pageSubtitle:"Profit and loss analysis for each product",
            sectionTitle:"Product Details",sectionSubtitle:"Analyze profit for each SKU to identify loss-making products and determine which products need improvement.",
            filterTitle:"Details Filter",filterSubtitle:"Select a period, marketplace, and store account to identify loss-making products more specifically.",
            period:"Period",marketplace:"Marketplace",storeAccount:"Store Account",
            today:"Today",yesterday:"Yesterday",week:"This Week",lastWeek:"Last Week",month:"This Month",lastMonth:"Last Month",last3Months:"Last 3 Months",year:"This Year",custom:"Custom Date",all:"All Periods",
            allMarketplaces:"All Marketplaces",allStoreAccounts:"All Store Accounts",fromDate:"From Date",toDate:"To Date",
            filterPeriod:"Period",filterMarketplace:"Marketplace",filterStore:"Store Account",
            downloadPdf:"📄 Download PDF Product",totalProducts:"Total Products",profitProducts:"Profitable Products",lossProducts:"Loss-Making Products",totalProfit:"Total Product Profit",
            salesPerProduct:"Sales Details by Product",salesPerProductSubtitle:"Loss-making products are shown first so they can be improved easily.",
            no:"No.",sku:"SKU",productName:"Product Name",qty:"QTY",sellingPrice:"Selling Price",totalSales:"Total Sales",hpp:"COGS",marketplaceAdmin:"Marketplace Admin Fee",productProfit:"Product Profit",status:"Status",actions:"Actions",
            loss:"⚠️ LOSS",profit:"✓ PROFIT",fix:"✏️ Fix",noMaster:"No master product",noTransactions:"No transactions for the selected period.",
            show:"Show",rows:"rows",previous:"Previous page",next:"Next page",nextButton:"Next ›",dateSeparator:"to",dateEllipsis:"...",rangeInvalid:"The start date cannot be later than the end date.",rangeTitle:"Date Validation"
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksProductText(key){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            pageTitle:"Master Produk", pageSubtitle:"Kelola seluruh produk, SKU, modal, dan data dasar produk bisnis Anda.",
            count:"Produk", importExcel:"Import Excel", exportExcel:"Export Excel", addProduct:"Tambah Produk",
            deleteSelected:"Hapus Terpilih", searchPlaceholder:"🔍 Cari SKU atau nama produk...", allStatus:"Semua Status",
            active:"Aktif", inactive:"Tidak Aktif", sku:"SKU", productName:"Nama Produk", category:"Kategori",
            sellingPrice:"Harga Jual", cost:"HPP / Modal", adminSku:"Admin % SKU", stock:"Stok", status:"Status", actions:"Aksi",
            rowsLabel:"Tampilkan", rowsSuffix:"baris", rowsAria:"Jumlah baris Master Produk", noProducts:"Belum Ada Produk",
            noProductsText:"Tambahkan produk secara manual atau import menggunakan Excel.", disable:"Nonaktifkan", enable:"Aktifkan",
            edit:"Edit", delete:"Hapus", range:"{start}-{end} dari {total}", previous:"Halaman sebelumnya", next:"Halaman berikutnya",
            addTitle:"Tambah Produk", editTitle:"Edit Produk", skuLabel:"SKU Produk *", skuPlaceholder:"Contoh: TAS-BIRU-001",
            nameLabel:"Nama Produk *", namePlaceholder:"Contoh: Tas Biru Premium", categoryLabel:"Kategori", categoryPlaceholder:"Contoh: Tas",
            priceLabel:"Harga Jual", pricePlaceholder:"Contoh: 50000", costLabel:"HPP / Modal Produk *", costPlaceholder:"Contoh: 25000",
            stockLabel:"Stok Produk", stockPlaceholder:"Contoh: 100", adminLabel:"Admin % SKU", adminPlaceholder:"Contoh: 15",
            statusLabel:"Status Produk", optional:"Opsional", cancel:"Batal", save:"Simpan Produk",
            adminInvalid:"Admin % SKU harus antara 0 sampai 100.", skuRequired:"SKU produk wajib diisi.", nameRequired:"Nama produk wajib diisi.",
            costRequired:"HPP / Modal produk wajib diisi.", duplicateEdit:"SKU sudah digunakan oleh produk lain.", duplicateAdd:"SKU sudah terdaftar.",
            deleteSelectedConfirm:"Hapus {count} produk yang dipilih?\n\nData yang dihapus tidak dapat dikembalikan.", deleteConfirm:"Hapus produk",
            importEmpty:"File Excel tidak memiliki data.", importDone:"Import selesai.\n\nBerhasil: {success}\nDuplikat SKU: {duplicate}\nData tidak valid: {error}",
            importError:"Terjadi kesalahan saat membaca file Excel.", exportError:"Export Excel gagal. Silakan coba lagi.",
            exportSuccessTitle:"Export Berhasil", exportSuccess:"File Excel Master Produk berhasil dibuat dan diunduh ke perangkat Anda.",
            exportMaster:"MASTER PRODUK", exportInstructions:"PETUNJUK PENGISIAN", exportReadme:"README", exportColumn:"KOLOM",
            exportGuide:"PETUNJUK PENGISIAN", exportRules:"ATURAN IMPORT", exportTemplateTitle:"SELLERBOOKS MASTER PRODUK TEMPLATE",
            exportTemplateDescription:"File ini digunakan untuk menambah atau memperbarui data Master Produk di SellerBooks.",
            howTo:"CARA PENGGUNAAN", importantNotes:"CATATAN PENTING", requiredSku:"Wajib diisi. SKU adalah kode unik produk dan tidak boleh sama dengan produk lain.",
            requiredName:"Wajib diisi. Masukkan nama produk dengan jelas.", optionalCategory:"Opsional. Contoh: Fashion, Elektronik, Aksesoris, Rumah Tangga.",
            priceGuide:"Isi angka saja tanpa tulisan Rp atau tanda titik. Contoh: 25000", costGuide:"Isi angka biaya modal produk tanpa tulisan Rp. Contoh: 12000",
            stockGuide:"Isi jumlah stok awal produk dalam angka. Contoh: 100.", statusGuide:"Pilih dari dropdown: Aktif atau Tidak Aktif.",
            rule1:"Jangan mengubah nama kolom pada sheet MASTER PRODUK.", rule2:"SKU tidak boleh kosong dan tidak boleh duplikat.",
            rule3:"Harga Jual dan HPP / Modal harus berupa angka.", rule4:"Stok harus berupa angka. Jika belum memiliki stok, isi 0.",
            rule5:"Status Produk cukup dipilih dari dropdown Aktif atau Tidak Aktif.", rule6:"Isi data hanya pada sheet MASTER PRODUK.",
            how1:"Buka sheet MASTER PRODUK.", how2:"Isi data produk sesuai kolom yang tersedia.", how3:"Jangan mengubah nama header atau urutan kolom.",
            how4:"Isi stok dengan angka. Jika belum ada stok, gunakan 0.", how5:"Untuk Status Produk, pilih Aktif atau Tidak Aktif dari dropdown.",
            how6:"Simpan file setelah selesai diisi.", how7:"Kembali ke SellerBooks.", how8:"Buka menu Master Produk.", how9:"Klik Import Excel.", how10:"Pilih file yang sudah diisi.",
            note1:"• SKU harus unik.", note2:"• Harga diisi dalam angka.", note3:"• Stok diisi dalam angka.", note4:"• Status Produk menggunakan dropdown Aktif atau Tidak Aktif.",
            statusInvalidTitle:"Status tidak valid", statusInvalid:"Silakan pilih Aktif atau Tidak Aktif.", statusPromptTitle:"Status Produk", statusPrompt:"Pilih Aktif atau Tidak Aktif."
        },
        en:{
            pageTitle:"Master Products", pageSubtitle:"Manage all products, SKUs, costs, and basic product data for your business.",
            count:"Products", importExcel:"Import Excel", exportExcel:"Export Excel", addProduct:"Add Product",
            deleteSelected:"Delete Selected", searchPlaceholder:"🔍 Search SKU or product name...", allStatus:"All Statuses",
            active:"Active", inactive:"Inactive", sku:"SKU", productName:"Product Name", category:"Category", sellingPrice:"Selling Price",
            cost:"Cost", adminSku:"Admin % SKU", stock:"Stock", status:"Status", actions:"Actions", rowsLabel:"Show", rowsSuffix:"rows",
            rowsAria:"Master Products rows per page", noProducts:"No Products Yet", noProductsText:"Add products manually or import them using Excel.",
            disable:"Disable", enable:"Enable", edit:"Edit", delete:"Delete", range:"{start}-{end} of {total}", previous:"Previous page", next:"Next page",
            addTitle:"Add Product", editTitle:"Edit Product", skuLabel:"Product SKU *", skuPlaceholder:"Example: TAS-BIRU-001",
            nameLabel:"Product Name *", namePlaceholder:"Example: Premium Blue Bag", categoryLabel:"Category", categoryPlaceholder:"Example: Bags",
            priceLabel:"Selling Price", pricePlaceholder:"Example: 50000", costLabel:"Product Cost *", costPlaceholder:"Example: 25000",
            stockLabel:"Product Stock", stockPlaceholder:"Example: 100", adminLabel:"Admin % SKU", adminPlaceholder:"Example: 15",
            statusLabel:"Product Status", optional:"Optional", cancel:"Cancel", save:"Save Product",
            adminInvalid:"Admin % SKU must be between 0 and 100.", skuRequired:"Product SKU is required.", nameRequired:"Product name is required.",
            costRequired:"Product cost is required.", duplicateEdit:"This SKU is already used by another product.", duplicateAdd:"This SKU is already registered.",
            deleteSelectedConfirm:"Delete {count} selected products?\n\nDeleted data cannot be recovered.", deleteConfirm:"Delete product",
            importEmpty:"The Excel file contains no data.", importDone:"Import completed.\n\nSuccessful: {success}\nDuplicate SKUs: {duplicate}\nInvalid data: {error}",
            importError:"An error occurred while reading the Excel file.", exportError:"Excel export failed. Please try again.",
            exportSuccessTitle:"Export Successful", exportSuccess:"The Master Products Excel file was successfully created and downloaded to your device.", exportMaster:"MASTER PRODUCTS", exportInstructions:"FILLING INSTRUCTIONS",
            exportReadme:"README", exportColumn:"COLUMN", exportGuide:"FILLING INSTRUCTIONS", exportRules:"IMPORT RULES",
            exportTemplateTitle:"SELLERBOOKS MASTER PRODUCTS TEMPLATE", exportTemplateDescription:"This file is used to add or update Master Products data in SellerBooks.",
            howTo:"HOW TO USE", importantNotes:"IMPORTANT NOTES", requiredSku:"Required. SKU is the unique product code and must not duplicate another product.",
            requiredName:"Required. Enter the product name clearly.", optionalCategory:"Optional. Example: Fashion, Electronics, Accessories, Home & Living.",
            priceGuide:"Enter numbers only without Rp or separators. Example: 25000", costGuide:"Enter the product cost as a number without Rp. Example: 12000",
            stockGuide:"Enter the initial product stock as a number. Example: 100.", statusGuide:"Select from the dropdown: Active or Inactive.",
            rule1:"Do not change the column names in the MASTER PRODUCTS sheet.", rule2:"SKU cannot be empty or duplicated.", rule3:"Selling Price and Cost must be numeric.",
            rule4:"Stock must be numeric. If there is no stock yet, enter 0.", rule5:"Select Product Status from the Active or Inactive dropdown.", rule6:"Enter data only in the MASTER PRODUCTS sheet.",
            how1:"Open the MASTER PRODUCTS sheet.", how2:"Enter product data according to the available columns.", how3:"Do not change the header names or column order.",
            how4:"Enter stock as a number. If there is no stock, use 0.", how5:"For Product Status, select Active or Inactive from the dropdown.",
            how6:"Save the file after completing the data.", how7:"Return to SellerBooks.", how8:"Open the Master Products menu.", how9:"Click Import Excel.", how10:"Select the completed file.",
            note1:"• SKU must be unique.", note2:"• Enter prices as numbers.", note3:"• Enter stock as a number.", note4:"• Product Status uses the Active or Inactive dropdown.",
            statusInvalidTitle:"Invalid status", statusInvalid:"Please select Active or Inactive.", statusPromptTitle:"Product Status", statusPrompt:"Select Active or Inactive."
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}


function sellerBooksProductCountText(count){ return (Number(count)||0) + " " + sellerBooksProductText("count"); }


function sellerBooksSalesImportText(key){
    const language=sellerBooksCurrentLanguage();
    const id={
        pageTitle:"Import Penjualan",
        pageSubtitle:"Upload laporan penjualan marketplace. SellerBooks akan membaca struktur file dan mencari SKU serta QTY secara otomatis.",
        analyzerTitle:"SellerBooks Smart File Analyzer",
        analyzerDescription:"Upload file dari marketplace tanpa perlu memilih marketplace terlebih dahulu. Sistem akan menganalisis struktur data secara otomatis.",
        uploadTitle:"Upload Laporan Penjualan", uploadDescription:"Klik di sini untuk memilih file", chooseFile:"+ Pilih File",
        analysisTitle:"Hasil Analisis File", analysisDescription:"SellerBooks telah membaca struktur file Anda.", waitingAnalysis:"Menunggu Analisis", readingFile:"Sedang membaca file...",
        fileName:"Nama File", format:"Format", rowCount:"Jumlah Baris", columnCount:"Jumlah Kolom",
        skuRecognition:"SKU Recognition", qtyRecognition:"QTY Recognition", sellingPriceRecognition:"Harga Jual Recognition",
        notFound:"Belum ditemukan", waiting:"Menunggu analisis", skuNotRecognized:"Kolom SKU belum dikenali", qtyNotRecognized:"Kolom QTY belum dikenali",
        autoDetected:"Terdeteksi otomatis • ", matchSuffix:"% kecocokan", lazadaQty:"sellerSku • hitung kemunculan", lazadaQtyInfo:"Khusus Lazada • QTY = jumlah kemunculan sellerSku",
        shopeeQty:"1 pcs / baris", shopeeQtyInfo:"Khusus Shopee • file tidak memiliki kolom Jumlah, setiap baris SKU = 1 pcs",
        lazadaPrice:"unitPrice • Kolom AV", lazadaPriceInfo:"Khusus Lazada • Harga Jual = unitPrice kolom AV",
        foundColumns:"Kolom yang Ditemukan", cancel:"✕ Batalkan", continueImport:"Lanjutkan Import →",
        previewTitle:"Preview & Konfirmasi Data", previewDescription:"Pastikan SellerBooks membaca kolom SKU dan QTY dengan benar sebelum melanjutkan.",
        file:"File", dataCount:"Jumlah Data", selectSku:"🏷️ Pilih Kolom SKU", selectQty:"📦 Pilih Kolom QTY",
        chooseSku:"-- Pilih Kolom SKU --", chooseQty:"-- Pilih Kolom QTY --", skuHelp:"Pilih kolom yang berisi SKU atau kode produk.", qtyHelp:"Pilih kolom yang berisi jumlah produk terjual.",
        detectedMarketplace:"🏪 Marketplace Terdeteksi", notDetected:"Belum terdeteksi", marketplaceHelp:"SellerBooks menentukan marketplace dari struktur/header file.",
        selectStore:"👤 Pilih Akun Toko", chooseStore:"-- Pilih Akun Toko --", storeRequired:"Akun toko wajib dipilih sebelum data disimpan.",
        packingCost:"📦 Biaya Packing / 1 Order", packingPlaceholder:"Contoh: 1500", packingHelp:"Nominal dapat diubah dan disimpan untuk import berikutnya.",
        packingResult:"🧮 Hasil Perhitungan Packing", uniquePacking:"Order/Resi unik:", totalPacking:"Total biaya packing:",
        packingIdentifier:"Identitas packing akan dipilih otomatis sesuai marketplace.", validationChoose:"Pilih kolom SKU dan QTY untuk melanjutkan.",
        allRows:"Semua baris transaksi ditampilkan.", back:"← Kembali", confirmData:"✓ Konfirmasi Data",
        statusFound:"SKU & QTY ditemukan ✓", statusManual:"Perlu konfirmasi manual",
        lazadaReady:"✓ Lazada: sellerSku dikenali dan QTY akan dihitung dari jumlah kemunculan sellerSku. Data siap dikonfirmasi.",
        shopeeReady:"✓ Shopee: setiap baris SKU dihitung 1 pcs. Tidak perlu memilih kolom QTY. Data siap dikonfirmasi.",
        columnsReady:"✓ Kolom SKU dan QTY sudah dipilih. Data siap dikonfirmasi.",
        sameColumns:"Kolom SKU dan QTY tidak boleh sama.", noFile:"Belum ada file yang dianalisis.",
        noImportData:"Data import tidak ditemukan. Silakan upload file kembali.", chooseSkuFirst:"Silakan pilih kolom SKU terlebih dahulu.",
        chooseQtyFirst:"Silakan pilih kolom QTY terlebih dahulu.", marketplaceUnknown:"Marketplace file belum dapat dikenali otomatis.",
        chooseStoreFirst:"Silakan pilih akun toko terlebih dahulu sebelum menyimpan.", packingRequired:"Silakan isi biaya packing per 1 order terlebih dahulu.",
        saveFailed:"Data penjualan gagal disimpan.", saveError:"Data penjualan gagal disimpan.\n\n", saved:"Import berhasil disimpan ✓",
        marketplace:"Marketplace:", store:"Akun:", transactions:"Data transaksi:", uniquePackingLabel:"Packing unik:", packingCostLabel:"Biaya packing:",
        confirmed:"Kolom SKU dan QTY berhasil dikonfirmasi.", unsupported:"Format file tidak didukung.\n\nGunakan:\nXLSX\nXLS\nCSV",
        insufficient:"File tidak memiliki data yang cukup.", unreadable:"SellerBooks tidak dapat membaca file ini.\n\nPeriksa format dan isi file lalu coba lagi.",
        packingIdentity:"Identitas packing:", uniquePackingSuffix:" • 1 packing dihitung 1 ID unik.", packingNotFound:"Identitas packing belum ditemukan pada file."
    };
    const en={
        pageTitle:"Sales Import",
        pageSubtitle:"Upload marketplace sales reports. SellerBooks will read the file structure and automatically find SKU and QTY.",
        analyzerTitle:"SellerBooks Smart File Analyzer",
        analyzerDescription:"Upload a marketplace file without selecting the marketplace first. The system will analyze the data structure automatically.",
        uploadTitle:"Upload Sales Report", uploadDescription:"Click here to select a file", chooseFile:"+ Choose File",
        analysisTitle:"File Analysis Result", analysisDescription:"SellerBooks has read your file structure.", waitingAnalysis:"Waiting for Analysis", readingFile:"Reading file...",
        fileName:"File Name", format:"Format", rowCount:"Rows", columnCount:"Columns",
        skuRecognition:"SKU Recognition", qtyRecognition:"QTY Recognition", sellingPriceRecognition:"Selling Price Recognition",
        notFound:"Not found", waiting:"Waiting for analysis", skuNotRecognized:"SKU column not recognized", qtyNotRecognized:"QTY column not recognized",
        autoDetected:"Automatically detected • ", matchSuffix:"% match", lazadaQty:"sellerSku • count occurrences", lazadaQtyInfo:"Lazada only • QTY = number of sellerSku occurrences",
        shopeeQty:"1 pc / row", shopeeQtyInfo:"Shopee only • file has no Quantity column, each SKU row = 1 pc",
        lazadaPrice:"unitPrice • Column AV", lazadaPriceInfo:"Lazada only • Selling Price = unitPrice in column AV",
        foundColumns:"Detected Columns", cancel:"✕ Cancel", continueImport:"Continue Import →",
        previewTitle:"Preview & Confirm Data", previewDescription:"Make sure SellerBooks reads the SKU and QTY columns correctly before continuing.",
        file:"File", dataCount:"Data Count", selectSku:"🏷️ Select SKU Column", selectQty:"📦 Select QTY Column",
        chooseSku:"-- Select SKU Column --", chooseQty:"-- Select QTY Column --", skuHelp:"Select the column containing the SKU or product code.", qtyHelp:"Select the column containing the quantity sold.",
        detectedMarketplace:"🏪 Detected Marketplace", notDetected:"Not detected", marketplaceHelp:"SellerBooks determines the marketplace from the file structure/header.",
        selectStore:"👤 Select Store Account", chooseStore:"-- Select Store Account --", storeRequired:"A store account must be selected before the data can be saved.",
        packingCost:"📦 Packing Cost / Order", packingPlaceholder:"Example: 1500", packingHelp:"This amount can be changed and saved for the next import.",
        packingResult:"🧮 Packing Calculation", uniquePacking:"Unique Order/Tracking ID:", totalPacking:"Total packing cost:",
        packingIdentifier:"The packing identifier will be selected automatically based on the marketplace.", validationChoose:"Select SKU and QTY columns to continue.",
        allRows:"All transaction rows are displayed.", back:"← Back", confirmData:"✓ Confirm Data",
        statusFound:"SKU & QTY found ✓", statusManual:"Manual confirmation required",
        lazadaReady:"✓ Lazada: sellerSku was recognized and QTY will be calculated from sellerSku occurrences. Data is ready to confirm.",
        shopeeReady:"✓ Shopee: each SKU row counts as 1 pc. No QTY column is required. Data is ready to confirm.",
        columnsReady:"✓ SKU and QTY columns are selected. Data is ready to confirm.",
        sameColumns:"SKU and QTY columns cannot be the same.", noFile:"No analyzed file is available.",
        noImportData:"Import data was not found. Please upload the file again.", chooseSkuFirst:"Please select the SKU column first.",
        chooseQtyFirst:"Please select the QTY column first.", marketplaceUnknown:"The file marketplace could not be detected automatically.",
        chooseStoreFirst:"Please select a store account before saving.", packingRequired:"Please enter the packing cost per order first.",
        saveFailed:"Sales data could not be saved.", saveError:"Sales data could not be saved.\n\n", saved:"Import saved successfully ✓",
        marketplace:"Marketplace:", store:"Account:", transactions:"Transactions:", uniquePackingLabel:"Unique packing IDs:", packingCostLabel:"Packing cost:",
        confirmed:"SKU and QTY columns confirmed.", unsupported:"Unsupported file format.\n\nUse:\nXLSX\nXLS\nCSV",
        insufficient:"The file does not contain enough data.", unreadable:"SellerBooks could not read this file.\n\nCheck the file format and contents, then try again.",
        packingIdentity:"Packing identifier:", uniquePackingSuffix:" • 1 packing ID counted as one unique ID.", packingNotFound:"No packing identifier was found in the file."
    };
    const source=language==="en"?en:id;
    return source[key] ?? id[key] ?? key;
}


function sellerBooksPullOrderIsEN(){
    return String(typeof sellerBooksCurrentLanguage === "function" ? sellerBooksCurrentLanguage() : "id").toLowerCase() === "en";
}


function sellerBooksPullOrderText(key, marketplace, value){
    const en = sellerBooksPullOrderIsEN();
    const name = ({TikTok:"TikTok Shop",Shopee:"Shopee",Lazada:"Lazada",Blibli:"Blibli"})[marketplace] || marketplace || "marketplace";
    const copy = {
        missingStore: en ? name+" store account was not found." : "Akun toko "+name+" tidak ditemukan.",
        wrongMarketplace: en ? "This store account is not "+name+"." : "Akun toko ini bukan "+name+".",
        notConnected: en ? name+" account is not integrated." : "Akun "+name+" belum terintegrasi.",
        noSession: en ? "SellerBooks session is unavailable. Please log in again." : "Sesi SellerBooks tidak tersedia. Silakan login kembali.",
        loading: en ? "Fetching "+name+" orders from the last 7 days...\n\nThe API only retrieves raw order data.\nThe data will then be processed by the same Sales Import engine used for manual Excel uploads." : "Sedang mengambil order "+name+" 7 hari terakhir...\n\nAPI hanya mengambil data mentah.\nSetelah itu data masuk ke mesin Import Penjualan yang sama seperti upload Excel manual.",
        failedFetch: en ? "Failed to fetch "+name+" data." : "Pengambilan data "+name+" gagal.",
        failedOrders: en ? "Failed to fetch "+name+" orders." : "Tarik order "+name+" gagal.",
        noOrders: en ? "No "+name+" orders were found in the checked period.\n\nOrders found: "+value : "Tidak ada order "+name+" pada periode yang diperiksa.\n\nOrder ditemukan: "+value,
        resultTitle: en ? name+" Order Fetch Results" : "Hasil Tarik Order "+name,
        loadingTitle: en ? "Fetching "+name+" Orders" : "Tarik Order "+name,
        errorTitle: en ? name+" Synchronization" : "Sinkronisasi "+name,
        noFile: en ? name+" connection did not produce a data file." : "Koneksi "+name+" tidak menghasilkan file data.",
        apiError: en ? name+" API returned an error." : name+" API mengembalikan error.",
        status: en ? "Data fetch finished with status: " : "Pengambilan data selesai dengan status: ",
        unexpected: en ? "An error occurred while fetching data." : "Terjadi kesalahan saat mengambil data."
    };
    return copy[key] || key;
}


function sellerBooksResetIdentityText(key){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            mobile:"⚠️ Reset Identitas hanya dapat dilakukan melalui komputer/laptop.",
            confirm:"Reset Nama Pemilik?\n\nNama Pemilik akan dikosongkan dan Anda akan kembali ke halaman pengisian Nama Pemilik.\n\nAkun Gmail dan status persetujuan Core Adiimasa tetap tersimpan.",
            session:"Sesi login tidak ditemukan. Silakan login kembali.",
            success:"✅ Nama Pemilik berhasil direset.\n\nAkun Gmail dan persetujuan Core Adiimasa tetap tersimpan.\n\nSilakan masukkan Nama Pemilik yang baru.",
            failed:"❌ Nama Pemilik gagal direset.",
            confirmTitle:"Konfirmasi Reset Identitas",
            successTitle:"Reset Identitas Berhasil",
            failedTitle:"Reset Identitas Gagal",
            sessionTitle:"Sesi Tidak Ditemukan"
        },
        en:{
            mobile:"⚠️ Reset Identity is only available on a desktop or laptop.",
            confirm:"Reset Owner Name?\n\nThe Owner Name will be cleared and you will return to the Owner Name setup page.\n\nYour Gmail account and Core Adiimasa approval status will remain unchanged.",
            session:"Login session not found. Please log in again.",
            success:"✅ Owner Name was successfully reset.\n\nYour Gmail account and Core Adiimasa approval remain unchanged.\n\nPlease enter a new Owner Name.",
            failed:"❌ Failed to reset the Owner Name.",
            confirmTitle:"Reset Identity Confirmation",
            successTitle:"Identity Reset Successful",
            failedTitle:"Identity Reset Failed",
            sessionTitle:"Session Not Found"
        }
    };
    return translations[language]?.[key] ?? translations.id[key] ?? key;
}
