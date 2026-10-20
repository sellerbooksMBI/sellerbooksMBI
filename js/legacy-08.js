
(function(){
    "use strict";

    let cloudReady=false;
    let cloudUser=null;
    let cloudEntries=[];
    let cloudPayments=[];
    let piutangRealtimeChannel=null;
    let piutangRealtimeRefreshing=false;
    let piutangRealtimePollTimer=null;
    let piutangRealtimeLastSignature="";

    function piutangCloudUser(){
        return cloudUser;
    }

    async function piutangCloudGetUser(){
        try{
            const result=await sellerBooksSupabase.auth.getUser();
            if(result && result.data && result.data.user) cloudUser=result.data.user;
            return cloudUser;
        }catch(error){
            console.warn("Piutang cloud: user tidak tersedia",error);
            return null;
        }
    }

    function piutangLocalEntries(){
        try{
            const email=(cloudUser?.email||document.getElementById("userEmail")?.textContent||"default").trim().toLowerCase();
            const safe=email.replace(/[^a-z0-9._@-]/g,"_")||"default";
            const raw=localStorage.getItem("sellerbooks_piutang_isolated_v1_"+safe);
            const data=raw?JSON.parse(raw):[];
            return Array.isArray(data)?data:[];
        }catch(e){return [];}
    }

    function piutangLocalPayments(){
        try{
            const email=(cloudUser?.email||document.getElementById("userEmail")?.textContent||"default").trim().toLowerCase();
            const safe=email.replace(/[^a-z0-9._@-]/g,"_")||"default";
            const raw=localStorage.getItem("sellerbooks_piutang_payment_isolated_v1_"+safe);
            const data=raw?JSON.parse(raw):[];
            return Array.isArray(data)?data:[];
        }catch(e){return [];}
    }

    async function piutangCloudList(){
        const [a,b]=await Promise.all([
            sellerBooksSupabase.rpc("piutang_list_entries"),
            sellerBooksSupabase.rpc("piutang_list_payments")
        ]);
        if(a.error) throw a.error;
        if(b.error) throw b.error;
        cloudEntries=Array.isArray(a.data)?a.data:[];
        cloudPayments=Array.isArray(b.data)?b.data:[];
    }

    async function piutangCloudMigrateLocalIfEmpty(){
        if(cloudEntries.length===0){
            const local=piutangLocalEntries();
            for(const item of local){
                if(!item?.tanggal || !item?.nama || !(Number(item.jumlah)>0)) continue;
                const r=await sellerBooksSupabase.rpc("piutang_add_entry",{
                    p_tanggal:item.tanggal,
                    p_nama:String(item.nama).trim(),
                    p_jumlah:Number(item.jumlah),
                    p_keterangan:item.keterangan||null
                });
                if(r.error) throw r.error;
            }
        }
        if(cloudPayments.length===0){
            const local=piutangLocalPayments();
            for(const item of local){
                if(!item?.tanggal || !item?.nama || !(Number(item.jumlah)>0)) continue;
                const r=await sellerBooksSupabase.rpc("piutang_add_payment",{
                    p_tanggal:item.tanggal,
                    p_nama:String(item.nama).trim(),
                    p_jumlah:Number(item.jumlah),
                    p_keterangan:item.keterangan||null
                });
                if(r.error) throw r.error;
            }
        }
        await piutangCloudList();
    }

    function piutangMoney(v){
        /*
           Modul Piutang tetap menyimpan nominal dalam basis IDR,
           tetapi tampilan mengikuti mata uang yang dipilih di
           Pengaturan SellerBooks, sama seperti modul utama.
        */
        if(typeof formatRupiah === "function"){
            return formatRupiah(v);
        }

        return "Rp"+new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(v)||0);
    }
    function piutangDate(v){
        if(!v)return "-";
        const x=String(v).split("-");
        return x.length===3 ? x[2]+"-"+x[1]+"-"+x[0] : String(v);
    }
    function piutangEsc(v){
        return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function piutangKeterangan(value){
        const text=String(value==null?"":value).trim();
        if(!text)return "-";
        /*
           Tandai kata "LUNAS" walaupun ada keterangan lain,
           contoh: "LUNAS - potong gaji", "potong gaji - LUNAS",
           atau "lunas potong gaji".
        */
        const escaped=piutangEsc(text);
        return escaped.replace(/\blunas\b/gi,function(match){
            return '<span class="sb-piutang-lunas-badge">'+match.toUpperCase()+"</span>";
        });
    }

    function piutangUniqueNames(data){
        const seen=new Set(), out=[];
        (data||[]).forEach(x=>{
            const n=String(x.nama||"").trim(), k=n.toLowerCase();
            if(n&&!seen.has(k)){seen.add(k);out.push(n);}
        });
        return out.sort((a,b)=>a.localeCompare(b,"id",{sensitivity:"base"}));
    }
    function piutangSetSelect(id,data){
        const el=document.getElementById(id); if(!el)return;
        const old=el.value;
         el.innerHTML='<option value="">'+window.sbPiutangText("allNames")+'</option>'+piutangUniqueNames(data).map(n=>'<option value="'+piutangEsc(n)+'">'+piutangEsc(n)+'</option>').join("");
        if(piutangUniqueNames(data).some(n=>n.toLowerCase()===old.toLowerCase())) el.value=old;
    }

    window.sbPiutangCloudRender=function(){
        piutangRenderCloud();
    };

    function piutangRenderCloud(){
        const totalPiutang=cloudEntries.reduce((a,x)=>a+(Number(x.jumlah)||0),0);
        const totalBayar=cloudPayments.reduce((a,x)=>a+(Number(x.jumlah)||0),0);
        const sisa=Math.max(0,totalPiutang-totalBayar);
        // Dashboard dan kartu halaman memakai satu sumber nilai:
        // Sisa Piutang = seluruh piutang - seluruh pembayaran.
        const d=document.getElementById("sbPiutangDashboardTotal"), p=document.getElementById("sbPiutangPageTotal"), bt=document.getElementById("sbPiutangBayarTotal");
        // Dashboard = sisa setelah pembayaran.
        // Rincian halaman Piutang = total seluruh daftar piutang, tanpa dikurangi pembayaran.
        if(d)d.textContent=piutangMoney(sisa);
        if(p)p.textContent=piutangMoney(totalPiutang);
        if(bt)bt.textContent=piutangMoney(totalBayar);

        piutangSetSelect("sbPiutangNamaFilter",cloudEntries);
        piutangSetSelect("sbPiutangBayarNamaFilter",cloudPayments);
        piutangSetSelect("sbPiutangSisaNamaFilter",cloudEntries.concat(cloudPayments));

        const f1=(document.getElementById("sbPiutangNamaFilter")?.value||"").toLowerCase();
        const e=cloudEntries.filter(x=>!f1||String(x.nama||"").toLowerCase()===f1);
        // Kartu TOTAL PIUTANG mengikuti filter nama pada Daftar Piutang.
        const displayedPiutangTotal=e.reduce((a,x)=>a+(Number(x.jumlah)||0),0);
        if(p)p.textContent=piutangMoney(displayedPiutangTotal);
        const tbody=document.getElementById("sbPiutangTableBody");
        if(tbody){
            tbody.innerHTML=e.length?e.map(x=>'<tr><td>'+piutangDate(x.tanggal)+'</td><td>'+piutangEsc(x.nama)+'</td><td>'+piutangMoney(x.jumlah)+'</td><td>'+piutangEsc(x.keterangan||"-")+'</td><td><button type="button" class="sb-piutang-edit-button" onclick="sbPiutangEditCloud(\''+piutangEsc(x.id)+'\')">'+window.sbPiutangText("edit")+'</button><button type="button" class="sb-piutang-delete-button" onclick="sbPiutangDeleteCloud(\''+piutangEsc(x.id)+'\')">'+window.sbPiutangText("delete")+'</button></td></tr>').join(""):('<tr><td colspan="5" style="text-align:center;color:var(--muted);">'+(cloudEntries.length?''+window.sbPiutangText("noReceivablesForName")+'':''+window.sbPiutangText("noReceivables")+'')+'</td></tr>');
        }

        const f2=(document.getElementById("sbPiutangBayarNamaFilter")?.value||"").toLowerCase();
        const pay=cloudPayments.filter(x=>!f2||String(x.nama||"").toLowerCase()===f2);

        // Kartu Sisa Hutang: total piutang nama terpilih dikurangi total pembayaran nama yang sama.
        const sisaFilter=(document.getElementById("sbPiutangSisaNamaFilter")?.value||"").toLowerCase();
        const sisaPiutangData=cloudEntries.filter(x=>!sisaFilter||String(x.nama||"").toLowerCase()===sisaFilter);
        const sisaBayarData=cloudPayments.filter(x=>!sisaFilter||String(x.nama||"").toLowerCase()===sisaFilter);
        const sisaPiutangTotal=sisaPiutangData.reduce((a,x)=>a+(Number(x.jumlah)||0),0);
        const sisaBayarTotal=sisaBayarData.reduce((a,x)=>a+(Number(x.jumlah)||0),0);
        const sisaHutang=Math.max(0,sisaPiutangTotal-sisaBayarTotal);
        const sisaTotalEl=document.getElementById("sbPiutangSisaTotal");
        const sisaBreakdownEl=document.getElementById("sbPiutangSisaBreakdown");
        if(sisaTotalEl)sisaTotalEl.textContent=piutangMoney(sisaHutang);
        if(sisaBreakdownEl)sisaBreakdownEl.textContent=window.sbPiutangText("breakdown").replace("{receivable}",piutangMoney(sisaPiutangTotal)).replace("{paid}",piutangMoney(sisaBayarTotal));

        // Kartu TOTAL SUDAH DIBAYAR mengikuti filter nama pada Raport Pembayaran Piutang.
        const displayedBayarTotal=pay.reduce((a,x)=>a+(Number(x.jumlah)||0),0);
        if(bt)bt.textContent=piutangMoney(displayedBayarTotal);
        const pt=document.getElementById("sbPiutangBayarTableBody");
        if(pt){
            pt.innerHTML=pay.length?pay.map(x=>'<tr><td>'+piutangDate(x.tanggal)+'</td><td>'+piutangEsc(x.nama)+'</td><td>'+piutangMoney(x.jumlah)+'</td><td>'+piutangKeterangan(x.keterangan)+'</td><td><button type="button" class="sb-piutang-edit-button" onclick="sbPiutangBayarEditCloud(\''+piutangEsc(x.id)+'\')">'+window.sbPiutangText("edit")+'</button><button type="button" class="sb-piutang-delete-button" onclick="sbPiutangBayarDeleteCloud(\''+piutangEsc(x.id)+'\')">'+window.sbPiutangText("delete")+'</button></td></tr>').join(""):('<tr><td colspan="5" style="text-align:center;color:var(--muted);">'+(cloudPayments.length?''+window.sbPiutangText("noPaymentsForName")+'':''+window.sbPiutangText("noPayments")+'')+'</td></tr>');
        }
    }

    window.sbPiutangApplyFilter=function(){ piutangRenderCloud(); };
    window.sbPiutangBayarApplyFilter=function(){ piutangRenderCloud(); };
    window.sbPiutangSisaApplyFilter=function(){ piutangRenderCloud(); };

    window.sbPiutangSave=async function(event){
        if(event)event.preventDefault();
        if(!cloudReady){window.sellerBooksAlert(window.sbPiutangText("cloudUnavailable"),window.sbPiutangText("errorTitle"));return false;}
        const t=document.getElementById("sbPiutangTanggal")?.value||"", n=document.getElementById("sbPiutangNama")?.value.trim()||"", j=Number(document.getElementById("sbPiutangJumlah")?.value||0), k=document.getElementById("sbPiutangKeterangan")?.value.trim()||"";
        if(!t||!n||!(j>0)){window.sellerBooksAlert(window.sbPiutangText("requiredFields"),window.sbPiutangText("validationTitle"));return false;}
        const r=await sellerBooksSupabase.rpc("piutang_add_entry",{p_tanggal:t,p_nama:n,p_jumlah:j,p_keterangan:k||null});
        if(r.error){console.error(r.error);window.sellerBooksAlert(window.sbPiutangText("saveFailed"),window.sbPiutangText("errorTitle"));return false;}
        await piutangCloudList(); piutangRenderCloud();
        ["sbPiutangTanggal","sbPiutangNama","sbPiutangJumlah","sbPiutangKeterangan"].forEach(id=>{const x=document.getElementById(id);if(x)x.value="";});
        return false;
    };

    window.sbPiutangOpenEditModal=function(type,id){
        const item=(type==="payment"?cloudPayments:cloudEntries).find(x=>String(x.id)===String(id));
        if(!item)return false;

        const modal=document.getElementById("sbPiutangEditModal");
        document.getElementById("sbPiutangEditId").value=String(id);
        document.getElementById("sbPiutangEditType").value=type;
        document.getElementById("sbPiutangEditTitle").textContent=type==="payment"?window.sbPiutangText("editPayment"):window.sbPiutangText("editReceivable");
        document.getElementById("sbPiutangEditTanggal").value=String(item.tanggal||"");
        document.getElementById("sbPiutangEditNama").value=String(item.nama||"");
        document.getElementById("sbPiutangEditJumlah").value=String(item.jumlah||"");
        document.getElementById("sbPiutangEditKeterangan").value=String(item.keterangan||"");

        if(modal)modal.classList.add("show");
        setTimeout(function(){
            const field=document.getElementById("sbPiutangEditNama");
            if(field)field.focus();
        },50);
        return false;
    };

    window.sbPiutangCloseEditModal=function(){
        const modal=document.getElementById("sbPiutangEditModal");
        if(modal)modal.classList.remove("show");
    };

    window.sbPiutangSaveEditModal=async function(){
        const id=document.getElementById("sbPiutangEditId")?.value||"";
        const type=document.getElementById("sbPiutangEditType")?.value||"";
        const t=document.getElementById("sbPiutangEditTanggal")?.value||"";
        const n=document.getElementById("sbPiutangEditNama")?.value.trim()||"";
        const j=Number(document.getElementById("sbPiutangEditJumlah")?.value||0);
        const k=document.getElementById("sbPiutangEditKeterangan")?.value.trim()||"";

        if(!id||!type||!t||!n||!(j>0)){
            window.sellerBooksAlert(window.sbPiutangText("requiredFields"),window.sbPiutangText("validationTitle"));
            return false;
        }

        const fn=type==="payment"?"piutang_update_payment":"piutang_update_entry";
        const r=await sellerBooksSupabase.rpc(fn,{
            p_id:id,
            p_tanggal:t,
            p_nama:n,
            p_jumlah:j,
            p_keterangan:k||null
        });

        if(r.error){
            console.error(r.error);
            window.sellerBooksAlert(type==="payment"?window.sbPiutangText("paymentEditFailed"):window.sbPiutangText("editFailed"),window.sbPiutangText("errorTitle"));
            return false;
        }

        sbPiutangCloseEditModal();
        await piutangCloudList();
        piutangRenderCloud();
        return false;
    };

    window.sbPiutangEditCloud=function(id){
        return sbPiutangOpenEditModal("entry",id);
    };

    window.sbPiutangBayarEditCloud=function(id){
        return sbPiutangOpenEditModal("payment",id);
    };

    window.sbPiutangDeleteCloud=async function(id){
        const item=cloudEntries.find(x=>x.id===id); if(!item)return false;
        const confirmed=await window.sellerBooksConfirm(
             window.sbPiutangText("deleteReceivable")+"\n\n"+
             window.sbPiutangText("date")+": "+piutangDate(item.tanggal)+"\n"+
             window.sbPiutangText("name")+": "+item.nama+"\n"+
             window.sbPiutangText("amount")+": "+piutangMoney(item.jumlah),
             window.sbPiutangText("confirmationTitle")
         );
         if(!confirmed)return false;
        const r=await sellerBooksSupabase.rpc("piutang_delete_entry",{p_id:id});
        if(r.error){window.sellerBooksAlert(window.sbPiutangText("deleteFailed"),window.sbPiutangText("errorTitle"));return false;}
        await piutangCloudList(); piutangRenderCloud(); return false;
    };

    window.sbPiutangBayarSave=async function(event){
        if(event)event.preventDefault();
        if(!cloudReady){window.sellerBooksAlert(window.sbPiutangText("paymentCloudUnavailable"),window.sbPiutangText("errorTitle"));return false;}
        const t=document.getElementById("sbPiutangBayarTanggal")?.value||"", n=document.getElementById("sbPiutangBayarNama")?.value.trim()||"", j=Number(document.getElementById("sbPiutangBayarJumlah")?.value||0), k=document.getElementById("sbPiutangBayarKeterangan")?.value.trim()||"";
        if(!t||!n||!(j>0)){window.sellerBooksAlert(window.sbPiutangText("requiredPaymentFields"),window.sbPiutangText("validationTitle"));return false;}
        const r=await sellerBooksSupabase.rpc("piutang_add_payment",{p_tanggal:t,p_nama:n,p_jumlah:j,p_keterangan:k||null});
        if(r.error){console.error(r.error);window.sellerBooksAlert(window.sbPiutangText("paymentSaveFailed"),window.sbPiutangText("errorTitle"));return false;}
        await piutangCloudList(); piutangRenderCloud();
        ["sbPiutangBayarTanggal","sbPiutangBayarNama","sbPiutangBayarJumlah","sbPiutangBayarKeterangan"].forEach(id=>{const x=document.getElementById(id);if(x)x.value="";});
        return false;
    };

    window.sbPiutangBayarDeleteCloud=async function(id){
        const item=cloudPayments.find(x=>x.id===id); if(!item)return false;
        const confirmed=await window.sellerBooksConfirm(
             window.sbPiutangText("deletePayment")+"\n\n"+
             window.sbPiutangText("date")+": "+piutangDate(item.tanggal)+"\n"+
             window.sbPiutangText("name")+": "+item.nama+"\n"+
             window.sbPiutangText("amount")+": "+piutangMoney(item.jumlah)+"\n\n"+
             window.sbPiutangText("paymentDeleteShort"),
             window.sbPiutangText("confirmationTitle")
         );
         if(!confirmed)return false;
        const r=await sellerBooksSupabase.rpc("piutang_delete_payment",{p_id:id});
        if(r.error){window.sellerBooksAlert(window.sbPiutangText("paymentDeleteFailed"),window.sbPiutangText("errorTitle"));return false;}
        await piutangCloudList(); piutangRenderCloud(); return false;
    };

    function piutangStartRealtimePolling(){
        if(piutangRealtimePollTimer)clearInterval(piutangRealtimePollTimer);
        if(!cloudUser)return;
        /*
           Fallback realtime: WebSocket Realtime tidak selalu tersedia
           di browser/WebView tertentu. Polling ringan ini memastikan
           perubahan HP <-> komputer tetap masuk tanpa refresh.
        */
        piutangRealtimePollTimer=setInterval(async function(){
            if(!cloudReady||!cloudUser||piutangRealtimeRefreshing)return;
            try{
                const before=JSON.stringify([cloudEntries,cloudPayments]);
                await piutangCloudList();
                const after=JSON.stringify([cloudEntries,cloudPayments]);
                if(before!==after){
                    piutangRenderCloud();
                }
            }catch(error){
                console.warn("Sinkronisasi otomatis Piutang:",error);
            }
        },2000);
    }

    function piutangStopRealtimePolling(){
        if(piutangRealtimePollTimer){
            clearInterval(piutangRealtimePollTimer);
            piutangRealtimePollTimer=null;
        }
    }

    function piutangStopRealtime(){
        piutangStopRealtimePolling();
        if(piutangRealtimeChannel){
            try{ sellerBooksSupabase.removeChannel(piutangRealtimeChannel); }catch(e){}
            piutangRealtimeChannel=null;
        }
    }

    function piutangStartRealtime(){
        if(!cloudUser)return;
        piutangStopRealtime();
        const userId=String(cloudUser.id||"");
        if(!userId)return;

        piutangRealtimeChannel=sellerBooksSupabase
            .channel("piutang-realtime-"+userId)
            .on("postgres_changes",{
                event:"*",
                schema:"piutang",
                table:"entries",
                filter:"user_id=eq."+userId
            },function(){
                piutangRealtimeRefresh();
            })
            .on("postgres_changes",{
                event:"*",
                schema:"piutang",
                table:"payments",
                filter:"user_id=eq."+userId
            },function(){
                piutangRealtimeRefresh();
            })
            .subscribe(function(status){
                if(status!=="SUBSCRIBED" && status!=="CHANNEL_ERROR" && status!=="TIMED_OUT"){
                    return;
                }
                if(status!=="SUBSCRIBED"){
                    console.warn("Realtime Piutang:",status);
                }
            });
    }

    async function piutangRealtimeRefresh(){
        if(piutangRealtimeRefreshing || !cloudReady)return;
        piutangRealtimeRefreshing=true;
        try{
            await piutangCloudList();
            piutangRenderCloud();
        }catch(error){
            console.warn("Realtime Piutang gagal memuat ulang:",error);
        }finally{
            piutangRealtimeRefreshing=false;
        }
    }

    async function piutangCloudInit(){
        try{
            if(typeof sellerBooksSupabase==="undefined")return;
            const user=await piutangCloudGetUser();
            if(!user)return;
            await piutangCloudList();
            await piutangCloudMigrateLocalIfEmpty();
            cloudReady=true;
            piutangRenderCloud();
            if(typeof window.sbPiutangApplyLanguage === "function") window.sbPiutangApplyLanguage();
            piutangStartRealtime();
            piutangStartRealtimePolling();
        }catch(error){
            console.error("Piutang Supabase init gagal:",error);
            cloudReady=false;
        }
    }

    document.addEventListener("DOMContentLoaded",function(){
        setTimeout(piutangCloudInit,1200);
    });

    if(typeof sellerBooksSupabase!=="undefined" && sellerBooksSupabase.auth){
        sellerBooksSupabase.auth.onAuthStateChange(function(event,session){
            if(session?.user){
                cloudUser=session.user;
                setTimeout(piutangCloudInit,300);
            }else{
                piutangStopRealtime();
                cloudReady=false; cloudUser=null; cloudEntries=[]; cloudPayments=[];
            }
        });
    }
})();
