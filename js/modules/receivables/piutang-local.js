
(function(){
    "use strict";

    /* =====================================================
       STORAGE PIUTANG TERPISAH
       Tidak memakai database / rumus SellerBooks lama.
       Data tetap ada melewati pergantian hari.
    ===================================================== */
    const STORAGE_PREFIX = "sellerbooks_piutang_isolated_v1_";
    const PAYMENT_STORAGE_PREFIX = "sellerbooks_piutang_payment_isolated_v1_";

    function sbPiutangStorageKey(){
        const emailEl = document.getElementById("userEmail");
        const email = emailEl ? String(emailEl.textContent || "").trim().toLowerCase() : "default";
        const safe = email.replace(/[^a-z0-9._@-]/g,"_") || "default";
        return STORAGE_PREFIX + safe;
    }

    function sbPiutangRead(){
        try{
            const raw = localStorage.getItem(sbPiutangStorageKey());
            const data = raw ? JSON.parse(raw) : [];
            return Array.isArray(data) ? data : [];
        }catch(error){
            console.warn("Piutang: gagal membaca storage",error);
            return [];
        }
    }

    function sbPiutangWrite(data){
        try{
            localStorage.setItem(sbPiutangStorageKey(),JSON.stringify(data));
            return true;
        }catch(error){
            console.warn("Piutang: gagal menyimpan storage",error);
            return false;
        }
    }

    function sbPiutangPaymentStorageKey(){
        const emailEl=document.getElementById("userEmail");
        const email=emailEl ? String(emailEl.textContent||"").trim().toLowerCase() : "default";
        const safe=email.replace(/[^a-z0-9._@-]/g,"_") || "default";
        return PAYMENT_STORAGE_PREFIX + safe;
    }

    function sbPiutangBayarRead(){
        try{
            const raw=localStorage.getItem(sbPiutangPaymentStorageKey());
            const data=raw ? JSON.parse(raw) : [];
            return Array.isArray(data) ? data : [];
        }catch(error){
            console.warn("Pembayaran piutang: gagal membaca storage",error);
            return [];
        }
    }

    function sbPiutangBayarWrite(data){
        try{
            localStorage.setItem(sbPiutangPaymentStorageKey(),JSON.stringify(data));
            return true;
        }catch(error){
            console.warn("Pembayaran piutang: gagal menyimpan storage",error);
            return false;
        }
    }

    function sbPiutangBayarTotal(data){
        return data.reduce(function(total,item){
            return total+(Number(item.jumlah)||0);
        },0);
    }

    function sbPiutangSisaTotal(){
        const totalPiutang=sbPiutangTotal(sbPiutangRead());
        const totalBayar=sbPiutangBayarTotal(sbPiutangBayarRead());
        return Math.max(0,totalPiutang-totalBayar);
    }

    function sbPiutangFormat(value){
        return "Rp" + new Intl.NumberFormat("id-ID",{
            maximumFractionDigits:0
        }).format(Number(value)||0);
    }

    function sbPiutangTotal(data){
        return data.reduce(function(total,item){
            return total + (Number(item.jumlah)||0);
        },0);
    }

    function sbPiutangFormatTanggal(value){
        if(!value) return "-";
        const parts=String(value).split("-");
        if(parts.length!==3) return sbPiutangEscape(value);
        return sbPiutangEscape(parts[2]+"-"+parts[1]+"-"+parts[0]);
    }

    function sbPiutangUpdateNameFilter(data){
        const select=document.getElementById("sbPiutangNamaFilter");
        if(!select) return;
        const current=select.value;
        const names=[];
        const seen=new Set();
        data.forEach(function(item){
            const name=String(item.nama||"").trim();
            const key=name.toLowerCase();
            if(name && !seen.has(key)){ seen.add(key); names.push(name); }
        });
        names.sort(function(a,b){return a.localeCompare(b,"id",{sensitivity:"base"});});
        select.innerHTML='<option value="">'+window.sbPiutangText("allNames")+'</option>'+names.map(function(name){
            return '<option value="'+sbPiutangEscape(name)+'">'+sbPiutangEscape(name)+'</option>';
        }).join("");
        if(names.some(function(n){return n.toLowerCase()===current.toLowerCase();})) select.value=current;
    }

    function sbPiutangRender(){
        const data=sbPiutangRead();
        const total=sbPiutangSisaTotal();
        const totalText=sbPiutangFormat(total);
        const dashboardTotal=document.getElementById("sbPiutangDashboardTotal");
        const pageTotal=document.getElementById("sbPiutangPageTotal");
        if(dashboardTotal) dashboardTotal.textContent=totalText;
        if(pageTotal) pageTotal.textContent=totalText;

        sbPiutangUpdateNameFilter(data);
        const filter=document.getElementById("sbPiutangNamaFilter");
        const selected=filter ? String(filter.value||"").trim().toLowerCase() : "";
        const filtered=selected ? data.filter(function(item){return String(item.nama||"").trim().toLowerCase()===selected;}) : data;

        const tbody=document.getElementById("sbPiutangTableBody");
        if(!tbody) return;
        if(!filtered.length){
            tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);">'+(data.length?''+window.sbPiutangText("noReceivablesForName")+'':''+window.sbPiutangText("noReceivables")+'')+'</td></tr>';
            return;
        }
        tbody.innerHTML=filtered.map(function(item){
            const originalIndex=data.indexOf(item);
            const tanggal=sbPiutangFormatTanggal(item.tanggal||"");
            const nama=sbPiutangEscape(item.nama);
            const jumlah=sbPiutangFormat(item.jumlah);
            const keterangan=sbPiutangEscape(item.keterangan||"-");
            return '<tr><td>'+tanggal+'</td><td>'+nama+'</td><td>'+jumlah+'</td><td>'+keterangan+'</td><td><button type="button" class="sb-piutang-delete-button" onclick="sbPiutangDelete('+originalIndex+')">'+window.sbPiutangText("delete")+'</button></td></tr>';
        }).join("");
    }

    function sbPiutangUpdatePaymentNameFilter(data){
        const select=document.getElementById("sbPiutangBayarNamaFilter");
        if(!select) return;
        const current=select.value;
        const names=[];
        const seen=new Set();
        data.forEach(function(item){
            const name=String(item.nama||"").trim();
            const key=name.toLowerCase();
            if(name && !seen.has(key)){seen.add(key);names.push(name);}
        });
        names.sort(function(a,b){return a.localeCompare(b,"id",{sensitivity:"base"});});
        select.innerHTML='<option value="">'+window.sbPiutangText("allNames")+'</option>'+names.map(function(name){
            return '<option value="'+sbPiutangEscape(name)+'">'+sbPiutangEscape(name)+'</option>';
        }).join("");
        if(names.some(function(n){return n.toLowerCase()===current.toLowerCase();})) select.value=current;
    }

    function sbPiutangBayarRender(){
        const data=sbPiutangBayarRead();
        const totalBayar=sbPiutangBayarTotal(data);
        const bayarTotalEl=document.getElementById("sbPiutangBayarTotal");
        if(bayarTotalEl) bayarTotalEl.textContent=sbPiutangFormat(totalBayar);
        sbPiutangUpdatePaymentNameFilter(data);
        const filter=document.getElementById("sbPiutangBayarNamaFilter");
        const selected=filter ? String(filter.value||"").trim().toLowerCase() : "";
        const filtered=selected ? data.filter(function(item){return String(item.nama||"").trim().toLowerCase()===selected;}) : data;
        const tbody=document.getElementById("sbPiutangBayarTableBody");
        if(!tbody) return;
        if(!filtered.length){
            tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);">'+(data.length?''+window.sbPiutangText("noPaymentsForName")+'':''+window.sbPiutangText("noPayments")+'')+'</td></tr>';
            return;
        }
        tbody.innerHTML=filtered.map(function(item){
            const originalIndex=data.indexOf(item);
            return '<tr><td>'+sbPiutangFormatTanggal(item.tanggal||"")+'</td><td>'+sbPiutangEscape(item.nama)+'</td><td>'+sbPiutangFormat(item.jumlah)+'</td><td>'+sbPiutangEscape(item.keterangan||"-")+'</td><td><button type="button" class="sb-piutang-delete-button" onclick="sbPiutangBayarDelete('+originalIndex+')">'+window.sbPiutangText("delete")+'</button></td></tr>';
        }).join("");
    }

    window.sbPiutangBayarApplyFilter=function(){
        sbPiutangBayarRender();
    };

    window.sbPiutangApplyFilter=function(){
        sbPiutangRender();
    };

    function sbPiutangEscape(value){
        return String(value == null ? "" : value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    window.sbPiutangDelete = async function(index){
        const data=sbPiutangRead();
        if(index<0 || index>=data.length) return false;

        const item=data[index];
        const tanggal=sbPiutangFormatTanggal(item.tanggal||"");
        const nama=String(item.nama||"").trim() || "-";
        const jumlah=sbPiutangFormat(item.jumlah);

        const yakin=await window.sellerBooksConfirm(
            window.sbPiutangText("deleteReceivable")+"\n\n" +
            window.sbPiutangText("date")+": " + tanggal + "\n" +
            window.sbPiutangText("name")+": " + nama + "\n" +
            window.sbPiutangText("amount")+": " + jumlah + "\n\n" +
            window.sbPiutangText("deletedReceivableInfo"),
            window.sbPiutangText("confirmationTitle")
        );
        if(!yakin) return false;

        data.splice(index,1);
        if(!sbPiutangWrite(data)){
            window.sellerBooksAlert(window.sbPiutangText("browserDeleteFailed"),window.sbPiutangText("errorTitle"));
            return false;
        }
        sbPiutangRender();
        return false;
    };

    window.sbPiutangSave = function(event){
        if(event) event.preventDefault();

        const tanggalEl = document.getElementById("sbPiutangTanggal");
        const namaEl = document.getElementById("sbPiutangNama");
        const jumlahEl = document.getElementById("sbPiutangJumlah");
        const ketEl = document.getElementById("sbPiutangKeterangan");

        const tanggal = String(tanggalEl ? tanggalEl.value : "").trim();
        const nama = String(namaEl ? namaEl.value : "").trim();
        const jumlah = Number(jumlahEl ? jumlahEl.value : 0);
        const keterangan = String(ketEl ? ketEl.value : "").trim();

        if(!tanggal){
            window.sellerBooksAlert(window.sbPiutangText("requiredFields"),window.sbPiutangText("validationTitle"));
            return false;
        }
        if(!nama){
            window.sellerBooksAlert(window.sbPiutangText("requiredFields"),window.sbPiutangText("validationTitle"));
            return false;
        }
        if(!Number.isFinite(jumlah) || jumlah <= 0){
            window.sellerBooksAlert(window.sbPiutangText("requiredFields"),window.sbPiutangText("validationTitle"));
            return false;
        }

        const data = sbPiutangRead();
        data.push({
            tanggal:tanggal,
            nama:nama,
            jumlah:jumlah,
            keterangan:keterangan,
            createdAt:new Date().toISOString()
        });

        if(!sbPiutangWrite(data)){
            window.sellerBooksAlert(window.sbPiutangText("browserSaveFailed"),window.sbPiutangText("errorTitle"));
            return false;
        }

        if(tanggalEl) tanggalEl.value = "";
        if(namaEl) namaEl.value = "";
        if(jumlahEl) jumlahEl.value = "";
        if(ketEl) ketEl.value = "";
        sbPiutangRender();
        return false;
    };

    window.sbPiutangBayarDelete=async function(index){
        const data=sbPiutangBayarRead();
        if(index<0 || index>=data.length) return false;
        const item=data[index];
        const yakin=await window.sellerBooksConfirm(
            window.sbPiutangText("deletePayment")+"\n\n"+
            window.sbPiutangText("date")+": "+sbPiutangFormatTanggal(item.tanggal||"")+"\n"+
            window.sbPiutangText("name")+": "+(String(item.nama||"").trim()||"-")+"\n"+
            window.sbPiutangText("amount")+": "+sbPiutangFormat(item.jumlah)+"\n\n"+
            window.sbPiutangText("paymentDeleteInfo"),
            window.sbPiutangText("confirmationTitle")
        );
        if(!yakin) return false;
        data.splice(index,1);
        if(!sbPiutangBayarWrite(data)){
            window.sellerBooksAlert(window.sbPiutangText("browserPaymentDeleteFailed"),window.sbPiutangText("errorTitle"));
            return false;
        }
        sbPiutangRefreshDashboard();
        return false;
    };

    window.sbPiutangBayarSave=async function(event){
        if(event) event.preventDefault();
        const tanggalEl=document.getElementById("sbPiutangBayarTanggal");
        const namaEl=document.getElementById("sbPiutangBayarNama");
        const jumlahEl=document.getElementById("sbPiutangBayarJumlah");
        const ketEl=document.getElementById("sbPiutangBayarKeterangan");
        const tanggal=String(tanggalEl? tanggalEl.value:"").trim();
        const nama=String(namaEl? namaEl.value:"").trim();
        const jumlah=Number(jumlahEl? jumlahEl.value:0);
        const keterangan=String(ketEl? ketEl.value:"").trim();
        if(!tanggal){window.sellerBooksAlert(window.sbPiutangText("requiredPaymentFields"),window.sbPiutangText("validationTitle"));return false;}
        if(!nama){window.sellerBooksAlert(window.sbPiutangText("requiredPaymentFields"),window.sbPiutangText("validationTitle"));return false;}
        if(!Number.isFinite(jumlah)||jumlah<=0){window.sellerBooksAlert(window.sbPiutangText("requiredPaymentFields"),window.sbPiutangText("validationTitle"));return false;}

        const outstanding=sbPiutangSisaTotal();
        if(jumlah>outstanding){
            const lanjut=await window.sellerBooksConfirm(
                window.sbPiutangText("overpayment").replace("{amount}",sbPiutangFormat(jumlah)).replace("{outstanding}",sbPiutangFormat(outstanding))+"\n\n"+window.sbPiutangText("keepPayment"),
                window.sbPiutangText("confirmationTitle")
            );
            if(!lanjut) return false;
        }

        const data=sbPiutangBayarRead();
        data.push({tanggal:tanggal,nama:nama,jumlah:jumlah,keterangan:keterangan,createdAt:new Date().toISOString()});
        if(!sbPiutangBayarWrite(data)){window.sellerBooksAlert(window.sbPiutangText("browserPaymentSaveFailed"),window.sbPiutangText("errorTitle"));return false;}
        if(tanggalEl) tanggalEl.value="";
        if(namaEl) namaEl.value="";
        if(jumlahEl) jumlahEl.value="";
        if(ketEl) ketEl.value="";
        sbPiutangRefreshDashboard();
        return false;
    };

    function sbPiutangSetPaymentDefaultDate(){
        const el=document.getElementById("sbPiutangBayarTanggal");
        if(!el||el.value) return;
        const now=new Date();
        el.value=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
    }

    function sbPiutangSetDefaultDate(){
        const el=document.getElementById("sbPiutangTanggal");
        if(!el || el.value) return;
        const now=new Date();
        el.value=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
    }

    window.sbPiutangOpen = function(button){
        /* Memakai mekanisme view lama hanya untuk perpindahan halaman.
           Tidak menambahkan logika piutang ke sistem lama. */
        if(typeof showView === "function"){
            showView("sbPiutangView",button || null,false);
        }else{
            document.querySelectorAll(".view").forEach(function(v){v.classList.remove("active");});
            const v=document.getElementById("sbPiutangView");
            if(v) v.classList.add("active");
        }

        const title=document.getElementById("topTitle");
        const subtitle=document.getElementById("topSubtitle");
        if(title) title.textContent=window.sbPiutangText("pageTitle");
        if(subtitle) subtitle.textContent=window.sbPiutangText("pageSubtitle");
        if(typeof window.sbPiutangApplyLanguage === "function") window.sbPiutangApplyLanguage();

        if(typeof window.sbPiutangCloudRender === "function"){
            window.sbPiutangCloudRender();
        }else{
            sbPiutangRender();
            sbPiutangBayarRender();
        }
        sbPiutangSetDefaultDate();
    };

    function sbPiutangRefreshDashboard(){
        if(typeof window.sbPiutangCloudRender === "function"){
            window.sbPiutangCloudRender();
        }else{
            sbPiutangRender();
            sbPiutangBayarRender();
        }
        sbPiutangSetDefaultDate();
        sbPiutangSetPaymentDefaultDate();
    }

    document.addEventListener("DOMContentLoaded",function(){
        sbPiutangRefreshDashboard();
        if(typeof window.sbPiutangApplyLanguage === "function") window.sbPiutangApplyLanguage();
    });

    /* Saat SellerBooks mengganti identitas/login, refresh nilai yang tampil. */
    window.addEventListener("storage",function(event){
        if(event.key && event.key.indexOf(STORAGE_PREFIX) === 0){
            sbPiutangRefreshDashboard();
        }
    });
})();
