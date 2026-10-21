/* =========================================================
   SELLERBOOKS TEMPORARY REPORT PROFILER
   Profiling only. Does not alter report formulas/data flow.
   Remove this block after performance diagnosis.
========================================================= */
(function(){
    const profiler = {
        active:false,
        cycle:0,
        reset:function(){
            this.cycle += 1;
            this.storageReadMs = 0;
            this.jsonParseMs = 0;
            this.mergeMs = 0;
            this.filterMs = 0;
            this.financialMs = 0;
            this.renderMs = 0;
            this.importCount = 0;
            this.allTransactionCount = 0;
            this.filteredTransactionCount = 0;
            this.financialCalls = 0;
            this.reportCalls = 0;
            this.startedAt = performance.now();
        },
        log:function(){
            if(!this.active) return;
            const total = performance.now() - this.startedAt;
            console.groupCollapsed(
                "[SellerBooks Report Profiler] Cycle " + this.cycle
            );
            console.table({
                "Periode": document.getElementById("reportPeriod")?.value || "",
                "Marketplace": document.getElementById("reportMarketplace")?.value || "",
                "Akun Toko": document.getElementById("reportStore")?.value || "",
                "TOTAL cycle (ms)": Number(total.toFixed(2)),
                "Storage read (ms)": Number(this.storageReadMs.toFixed(2)),
                "JSON.parse (ms)": Number(this.jsonParseMs.toFixed(2)),
                "Penggabungan transaksi (ms)": Number(this.mergeMs.toFixed(2)),
                "Filter tanggal+marketplace+toko (ms)": Number(this.filterMs.toFixed(2)),
                "Perhitungan finansial (ms)": Number(this.financialMs.toFixed(2)),
                "Render updateReports (ms)": Number(this.renderMs.toFixed(2)),
                "Jumlah import": this.importCount,
                "Seluruh transaksi": this.allTransactionCount,
                "Transaksi terfilter": this.filteredTransactionCount,
                "Panggilan finansial": this.financialCalls,
                "Panggilan updateReports": this.reportCalls
            });
            console.groupEnd();
        }
    };
    window.sellerBooksReportProfiler = profiler;
})();
