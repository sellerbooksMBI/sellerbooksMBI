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
