
(function(){
    "use strict";

    window.sbPiutangText=function(key){
        const en=String(sellerBooksCurrentLanguage?.()||"id").toLowerCase()==="en";
        const id={
            menu:"Piutang",pageTitle:"Piutang",pageSubtitle:"Catat dan pantau total piutang secara terpisah dari laba bisnis.",
            addTitle:"Tambah Piutang",addInfo:"Setiap data baru akan menambah total piutang.",date:"Tanggal",name:"Nama",amount:"Jumlah",description:"Keterangan",
            namePlaceholder:"Nama pelanggan / pihak",amountPlaceholder:"Contoh: 500000",receivablePlaceholder:"Keterangan piutang",saveReceivable:"+ Simpan Piutang",
            totalReceivables:"TOTAL PIUTANG",totalReceivablesNote:"Total seluruh piutang sesuai daftar piutang. Pembayaran ditampilkan terpisah.",
            listTitle:"Daftar Piutang",listSubtitle:"Seluruh piutang yang sudah dicatat.",selectName:"Pilih Nama",allNames:"Semua Nama",
            tableDate:"Tanggal",tableName:"Nama",tableAmount:"Jumlah",tableDescription:"Keterangan",actions:"Aksi",edit:"Edit",delete:"Hapus",
            noReceivables:"Belum ada piutang.",noReceivablesForName:"Tidak ada piutang untuk nama tersebut.",
            paymentTitle:"Bayar Piutang",paymentInfo:"Catat pembayaran piutang. Pembayaran akan mengurangi sisa piutang.",
            paymentNamePlaceholder:"Nama pelanggan / pihak",paymentAmountPlaceholder:"Contoh: 500000",paymentPlaceholder:"Keterangan pembayaran",savePayment:"+ Simpan Pembayaran",
            totalPaid:"TOTAL SUDAH DIBAYAR",totalPaidNote:"Total pembayaran yang sudah dicatat dari seluruh nama.",
            paymentReport:"Raport Pembayaran Piutang",paymentReportSubtitle:"Riwayat pembayaran yang sudah diterima.",
            noPayments:"Belum ada pembayaran.",noPaymentsForName:"Tidak ada pembayaran untuk nama tersebut.",
            remainingTitle:"Sisa Piutang Per Reseller",remainingSubtitle:"Total piutang dikurangi total pembayaran berdasarkan nama yang dipilih.",
            remaining:"SISA HUTANG",breakdown:"Total piutang {receivable} − Total sudah dibayar {paid}",
            editReceivable:"Edit Piutang",editPayment:"Edit Pembayaran Piutang",cancel:"Batal",saveChanges:"Simpan Perubahan",confirmationTitle:"Konfirmasi",validationTitle:"Validasi",errorTitle:"Kesalahan",
            requiredFields:"Tanggal, Nama, dan Jumlah wajib diisi dengan benar.",requiredPaymentFields:"Tanggal, Nama, dan Jumlah pembayaran wajib diisi dengan benar.",
            cloudUnavailable:"Piutang belum tersambung ke Supabase. Coba lagi sebentar.",paymentCloudUnavailable:"Pembayaran belum tersambung ke Supabase. Coba lagi sebentar.",
            saveFailed:"Piutang gagal disimpan ke Supabase.",paymentSaveFailed:"Pembayaran gagal disimpan ke Supabase.",
            editFailed:"Piutang gagal diedit.",paymentEditFailed:"Pembayaran gagal diedit.",deleteFailed:"Piutang gagal dihapus.",paymentDeleteFailed:"Pembayaran gagal dihapus.",
            deleteReceivable:"Hapus piutang ini?",deletePayment:"Hapus catatan pembayaran ini?",
            deletedReceivableInfo:"Data yang dihapus tidak akan dihitung lagi dalam Total Piutang.",
            paymentDeleteInfo:"Jika dihapus, jumlah pembayaran ini akan kembali menjadi piutang.",
            paymentDeleteShort:"Nominal akan kembali menjadi sisa piutang.",
            overpayment:"Jumlah pembayaran ({amount}) lebih besar dari sisa piutang ({outstanding}).",
            keepPayment:"Tetap simpan pembayaran ini?",browserDeleteFailed:"Piutang tidak dapat dihapus di browser ini.",
            browserSaveFailed:"Piutang tidak dapat disimpan di browser ini.",browserPaymentDeleteFailed:"Pembayaran tidak dapat dihapus di browser ini.",
            browserPaymentSaveFailed:"Pembayaran tidak dapat disimpan di browser ini.",
            dashboardLabel:"TOTAL PIUTANG RESELLER",dashboardInfo:"Total piutang dikurangi pembayaran yang sudah masuk",dashboardButton:"Lihat Piutang →"
        };
        const enMap={
            menu:"Receivables",pageTitle:"Receivables",pageSubtitle:"Record and monitor receivables separately from business profit.",
            addTitle:"Add Receivable",addInfo:"Each new entry will increase the total receivables.",date:"Date",name:"Name",amount:"Amount",description:"Description",
            namePlaceholder:"Customer / party name",amountPlaceholder:"Example: 500000",receivablePlaceholder:"Receivable description",saveReceivable:"+ Save Receivable",
            totalReceivables:"TOTAL RECEIVABLES",totalReceivablesNote:"Total receivables in the list. Payments are shown separately.",
            listTitle:"Receivables List",listSubtitle:"All receivables that have been recorded.",selectName:"Select Name",allNames:"All Names",
            tableDate:"Date",tableName:"Name",tableAmount:"Amount",tableDescription:"Description",actions:"Actions",edit:"Edit",delete:"Delete",
            noReceivables:"No receivables yet.",noReceivablesForName:"No receivables found for this name.",
            paymentTitle:"Record Payment",paymentInfo:"Record a receivable payment. The payment will reduce the remaining receivable.",
            paymentNamePlaceholder:"Customer / party name",paymentAmountPlaceholder:"Example: 500000",paymentPlaceholder:"Payment description",savePayment:"+ Save Payment",
            totalPaid:"TOTAL PAID",totalPaidNote:"Total payments recorded for all names.",
            paymentReport:"Receivable Payment Report",paymentReportSubtitle:"History of payments received.",
            noPayments:"No payments yet.",noPaymentsForName:"No payments found for this name.",
            remainingTitle:"Remaining Receivables by Reseller",remainingSubtitle:"Total receivables minus total payments for the selected name.",
            remaining:"REMAINING RECEIVABLES",breakdown:"Total receivables {receivable} − Total paid {paid}",
            editReceivable:"Edit Receivable",editPayment:"Edit Receivable Payment",cancel:"Cancel",saveChanges:"Save Changes",confirmationTitle:"Confirmation",validationTitle:"Validation",errorTitle:"Error",
            requiredFields:"Date, Name, and Amount must be filled in correctly.",requiredPaymentFields:"Date, Name, and Payment Amount must be filled in correctly.",
            cloudUnavailable:"Receivables are not connected to Supabase yet. Please try again shortly.",paymentCloudUnavailable:"Payments are not connected to Supabase yet. Please try again shortly.",
            saveFailed:"Failed to save receivable to Supabase.",paymentSaveFailed:"Failed to save payment to Supabase.",
            editFailed:"Failed to edit receivable.",paymentEditFailed:"Failed to edit payment.",deleteFailed:"Failed to delete receivable.",paymentDeleteFailed:"Failed to delete payment.",
            deleteReceivable:"Delete this receivable?",deletePayment:"Delete this payment record?",
            deletedReceivableInfo:"Deleted data will no longer be included in Total Receivables.",
            paymentDeleteInfo:"If deleted, this payment amount will become receivable again.",
            paymentDeleteShort:"The amount will return to remaining receivables.",
            overpayment:"The payment amount ({amount}) is greater than the remaining receivables ({outstanding}).",
            keepPayment:"Save this payment anyway?",browserDeleteFailed:"This receivable could not be deleted in this browser.",
            browserSaveFailed:"This receivable could not be saved in this browser.",browserPaymentDeleteFailed:"This payment could not be deleted in this browser.",
            browserPaymentSaveFailed:"This payment could not be saved in this browser.",
            dashboardLabel:"TOTAL RESELLER RECEIVABLES",dashboardInfo:"Total receivables minus payments already received",dashboardButton:"View Receivables →"
        };
        return (en?enMap:id)[key] ?? id[key] ?? key;
    };

    window.sbPiutangApplyLanguage=function(){
        const t=window.sbPiutangText;
        const view=document.getElementById("sbPiutangView");
        const modal=document.getElementById("sbPiutangEditModal");
        const langEn=String(sellerBooksCurrentLanguage?.()||"id").toLowerCase()==="en";

        const menu=document.querySelector(".sb-piutang-menu-item");
        if(menu){
            const icon=menu.querySelector(".menu-icon");
            Array.from(menu.childNodes).filter(n=>n.nodeType===3&&String(n.textContent||"").trim()).forEach(n=>n.textContent=" "+t("menu")+" ");
        }

        const dashLabel=document.querySelector(".sb-piutang-dashboard-label");
        const dashInfo=document.querySelector(".sb-piutang-dashboard-info");
        const dashButton=document.querySelector(".sb-piutang-dashboard-button");
        if(dashLabel)dashLabel.textContent=t("dashboardLabel");
        if(dashInfo)dashInfo.textContent=t("dashboardInfo");
        if(dashButton)dashButton.textContent=t("dashboardButton");

        if(view){
            const topTitle=document.getElementById("topTitle"), topSubtitle=document.getElementById("topSubtitle");
            if(view.classList.contains("active")){if(topTitle)topTitle.textContent=t("pageTitle");if(topSubtitle)topSubtitle.textContent=t("pageSubtitle");}
            const ph=view.querySelector(".page-header h2"), ps=view.querySelector(".page-header p");
            if(ph)ph.textContent=t("pageTitle"); if(ps)ps.textContent=t("pageSubtitle");

            const cards=view.querySelectorAll(".sb-piutang-card-header");
            if(cards[0]){
                const h=cards[0].querySelector("h3"),p=cards[0].querySelector("p");
                if(h)h.textContent=t("addTitle"); if(p)p.textContent=t("addInfo");
            }
            if(cards[1]){
                const h=cards[1].querySelector("h3"),p=cards[1].querySelector("p");
                if(h)h.textContent=t("paymentTitle"); if(p)p.textContent=t("paymentInfo");
            }

            const labels={
                sbPiutangTanggal:t("date"),sbPiutangNama:t("name"),sbPiutangJumlah:t("amount"),sbPiutangKeterangan:t("description"),
                sbPiutangBayarTanggal:t("date"),sbPiutangBayarNama:t("name"),sbPiutangBayarJumlah:t("amount"),sbPiutangBayarKeterangan:t("description")
            };
            Object.entries(labels).forEach(([id,val])=>{
                const el=document.querySelector('label[for="'+id+'"]'); if(el)el.textContent=val;
            });

            const phs={
                sbPiutangNama:t("namePlaceholder"),sbPiutangJumlah:t("amountPlaceholder"),sbPiutangKeterangan:t("receivablePlaceholder"),
                sbPiutangBayarNama:t("paymentNamePlaceholder"),sbPiutangBayarJumlah:t("paymentAmountPlaceholder"),sbPiutangBayarKeterangan:t("paymentPlaceholder")
            };
            Object.entries(phs).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.placeholder=val;});

            const save1=document.querySelector("#sbPiutangForm .sb-piutang-save-button"),save2=document.querySelector("#sbPiutangBayarForm .sb-piutang-save-button");
            if(save1)save1.textContent=t("saveReceivable"); if(save2)save2.textContent=t("savePayment");

            const sections=view.querySelectorAll(".sb-piutang-list-header");
            if(sections[0]){
                const h=sections[0].querySelector("h3"),p=sections[0].querySelector("p"),l=sections[0].querySelector("label");
                if(h)h.textContent=t("listTitle");if(p)p.textContent=t("listSubtitle");if(l)l.textContent=t("selectName");
            }
            if(sections[1]){
                const h=sections[1].querySelector("h3"),p=sections[1].querySelector("p"),l=sections[1].querySelector("label");
                if(h)h.textContent=t("paymentReport");if(p)p.textContent=t("paymentReportSubtitle");if(l)l.textContent=t("selectName");
            }
            if(sections[2]){
                const h=sections[2].querySelector("h3"),p=sections[2].querySelector("p"),l=sections[2].querySelector("label");
                if(h)h.textContent=t("remainingTitle");if(p)p.textContent=t("remainingSubtitle");if(l)l.textContent=t("selectName");
            }

            const summaryLabels=view.querySelectorAll(".sb-piutang-summary-label");
            if(summaryLabels[0])summaryLabels[0].textContent=t("totalReceivables");
            if(summaryLabels[1])summaryLabels[1].textContent=t("totalPaid");
            const summaryNotes=view.querySelectorAll(".sb-piutang-summary-note");
            if(summaryNotes[0])summaryNotes[0].textContent=t("totalReceivablesNote");
            if(summaryNotes[1])summaryNotes[1].textContent=t("totalPaidNote");

            const selectIds=["sbPiutangNamaFilter","sbPiutangBayarNamaFilter","sbPiutangSisaNamaFilter"];
            selectIds.forEach(id=>{const el=document.getElementById(id);if(el&&el.options[0])el.options[0].textContent=t("allNames");});

            view.querySelectorAll("table thead tr").forEach(tr=>{
                const th=tr.querySelectorAll("th");
                [t("tableDate"),t("tableName"),t("tableAmount"),t("tableDescription"),t("actions")].forEach((v,i)=>{if(th[i])th[i].textContent=v;});
            });

            const sisaLabel=document.querySelector(".sb-piutang-sisa-label"); if(sisaLabel)sisaLabel.textContent=t("remaining");
        }

        if(modal){
            const title=document.getElementById("sbPiutangEditTitle"),labels=modal.querySelectorAll(".form-group > label");
            if(title){
                const type=document.getElementById("sbPiutangEditType")?.value||"";
                title.textContent=type==="payment"?t("editPayment"):t("editReceivable");
            }
            [t("date"),t("name"),t("amount"),t("description")].forEach((v,i)=>{if(labels[i])labels[i].textContent=v;});
            const buttons=modal.querySelectorAll(".modal-footer button");
            if(buttons[0])buttons[0].textContent=t("cancel");if(buttons[1])buttons[1].textContent=t("saveChanges");
        }
    };
})();
