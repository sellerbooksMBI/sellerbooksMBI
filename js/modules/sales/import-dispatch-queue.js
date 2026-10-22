/* =====================================================
   SELLERBOOKS SALES IMPORT DISPATCH QUEUE
   Existing function bodies relocated unchanged.
===================================================== */

async function sellerBooksGetQueueSession(){
    const sessionResult=await sellerBooksSupabase.auth.getSession();
    const session=sessionResult?.data?.session;
    if(!session?.access_token) throw new Error("Sesi SellerBooks tidak tersedia. Silakan login kembali.");
    return session;
}

async function sellerBooksQueueRequest(path,options){
    const session=await sellerBooksGetQueueSession();
    const headers=new Headers(options?.headers||{});
    headers.set("apikey",SELLERBOOKS_SUPABASE_KEY);
    headers.set("Authorization","Bearer "+session.access_token);
    headers.set("Content-Type","application/json");
    return fetch(SELLERBOOKS_SUPABASE_URL+"/rest/v1/"+path,{...(options||{}),headers});
}

function sellerBooksApiImportProfile(marketplace){
    const key=String(marketplace||"").toLowerCase().replace(/\s+/g,"");
    const profiles={
        tiktok:{sku:"Seller SKU",qty:"Quantity",price:"SKU Subtotal After Discount"},
        "tiktokshop":{sku:"Seller SKU",qty:"Quantity",price:"SKU Subtotal After Discount"},
        shopee:{sku:"Nomor Referensi SKU",qty:"Jumlah Produk",price:"Subtotal Pesanan"},
        lazada:{sku:"sellerSku",qty:"__LAZADA_QTY_PER_ROW__",price:"unitPrice"}
    };
    return profiles[key]||null;
}

async function sellerBooksDispatchExcelToImportPenjualan(queueItem,showResult){
    if(!queueItem) return null;
    const marketplaceName=String(queueItem.marketplace||"").trim();
    const profile=sellerBooksApiImportProfile(marketplaceName);
    if(!profile) return {ok:false,retry:false,error:"Marketplace API belum memiliki adapter Import Penjualan: "+marketplaceName};

    const store=stores.find(item=>String(item.id)===String(queueItem.store_id));
    if(!store) return {ok:false,retry:true,error:"Akun toko untuk file API belum tersedia di workspace."};

    const headers=Array.isArray(queueItem.headers)?queueItem.headers:[];
    const rows=Array.isArray(queueItem.rows)?queueItem.rows:[];
    if(!headers.length||!rows.length) throw new Error("File mentah "+marketplaceName+" tidak berisi header/data transaksi.");

    const marketplace=marketplaces.find(function(item){
        const id=String(item?.id||"").trim().toLowerCase();
        const name=String(item?.name||"").trim().toLowerCase().replace(/\s+/g,"");
        const target=marketplaceName.toLowerCase().replace(/\s+/g,"");
        return id===target||name===target||id==="tiktok"&&target==="tiktokshop"||name==="tiktokshop"&&target==="tiktok";
    });

    const skuIndex=profile.sku==="__LAZADA_QTY_PER_ROW__"?headers.indexOf("sellerSku"):headers.indexOf(profile.sku);
    const qtyIndex=profile.qty==="__LAZADA_QTY_PER_ROW__"?-1:headers.indexOf(profile.qty);
    if(skuIndex<0) throw new Error("Kolom SKU API "+marketplaceName+" tidak ditemukan.");
    if(profile.qty!=="__LAZADA_QTY_PER_ROW__"&&qtyIndex<0) throw new Error("Kolom QTY API "+marketplaceName+" tidak ditemukan.");

    currentSalesImport={
        file:null,
        fileName:String(queueItem.file_name||("AUTO-SYNC-"+marketplaceName+".xlsx")),
        fileType:"XLSX",
        sheetName:"Orders",
        rawData:[headers].concat(rows),
        headerRowIndex:0,
        headers:headers,
        dataRows:rows,
        skuColumn:profile.sku,
        skuScore:100,
        qtyColumn:profile.qty,
        qtyScore:100,
        marketplace:marketplaceName==="TikTok Shop"?"TikTok":marketplaceName,
        marketplaceScore:100,
        marketplaceId:marketplace?.id||store.marketplaceId||marketplaceName.toLowerCase().replace(/\s+/g,""),
        skuIndex:skuIndex,
        qtyIndex:qtyIndex,
        priceColumn:profile.price,
        priceIndex:headers.indexOf(profile.price),
        columnsConfirmed:true,
        confirmedAt:new Date().toISOString()
    };

    const storeSelect=document.getElementById("salesStoreAccount");
    if(storeSelect){
        storeSelect.value=String(store.id);
        if(storeSelect.value!==String(store.id)){
            const option=document.createElement("option");
            option.value=String(store.id);
            option.textContent=String(store.name||store.id);
            storeSelect.appendChild(option);
            storeSelect.value=String(store.id);
        }
    }
    const packingInput=document.getElementById("packingCostPerOrder");
    if(packingInput){
        const savedPackingCost=sellerBooksStorage.getItem("sellerbooks_packing_unit_cost");
        packingInput.value=savedPackingCost!==null&&savedPackingCost!==undefined&&String(savedPackingCost)!==""?String(savedPackingCost):"0";
    }

    const record=saveSalesImportData();
    if(record){
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
    }
    const result={
        new_transactions:record?Number(record.rowCount||0):0,
        new_qty:record?Number(record.totalQty||0):0,
        new_packing_count:record?Number(record.uniquePackingCount||0):0,
        import_id:record?.id||null
    };

    await sellerBooksQueueRequest("sellerbooks_api_import_queue?id=eq."+encodeURIComponent(queueItem.id),{
        method:"PATCH",headers:{"Prefer":"return=minimal"},
        body:JSON.stringify({status:"IMPORTED",error_message:null,processed_at:new Date().toISOString()})
    });

    /* Refresh noncritical views after the result dialog is queued. Cloud persistence
       and the queue status update above remain awaited before success is shown. */
    setTimeout(function(){
        try{ if(typeof updateReports==="function") updateReports(); }
        catch(error){ console.warn("SellerBooks: deferred report refresh failed:",error); }
        try{ if(typeof renderProducts==="function") renderProducts(); }
        catch(error){ console.warn("SellerBooks: deferred product refresh failed:",error); }
        try{ if(typeof renderNotifications==="function") renderNotifications(); }
        catch(error){ console.warn("SellerBooks: deferred notification refresh failed:",error); }
        if(typeof loadStores==="function") loadStores();
        else if(typeof renderStores==="function") renderStores(true);
    },0);

    if(showResult){
        const en=sellerBooksPullOrderIsEN();
        const title=en?"Order Fetch Results — "+marketplaceName:"Hasil Tarik Order "+marketplaceName;
        const numberLocale=en?"en-US":"id-ID";
        if(result.new_transactions>0){
            sellerBooksAlert(
                en
                    ? marketplaceName+" orders were successfully processed by the Sales Import engine.\n\n"+
                      "New packing orders: "+result.new_packing_count.toLocaleString(numberLocale)+"\n"+
                      "New units: "+result.new_qty.toLocaleString(numberLocale)+"\n\n"+
                      "Calculations, COGS, admin fees, packing, snapshots, and reports are handled by the SellerBooks Sales Import engine."
                    : "Order "+marketplaceName+" berhasil diproses oleh mesin Import Penjualan.\n\n"+
                      "Packing baru: "+result.new_packing_count.toLocaleString(numberLocale)+"\n"+
                      "PCS baru: "+result.new_qty.toLocaleString(numberLocale)+"\n\n"+
                      "Perhitungan, HPP, admin, packing, snapshot dan laporan dikerjakan oleh mesin Import Penjualan SellerBooks.",
                title
            );
        }else{
            sellerBooksAlert(
                en
                    ? marketplaceName+" data already exists or produced no new transactions.\n\n"+
                      "The Sales Import engine skipped duplicate data."
                    : "Data "+marketplaceName+" sudah ada / tidak menghasilkan transaksi baru.\n\n"+
                      "Mesin Import Penjualan melewati data duplikat.",
                title
            );
        }
    }
    return result;
}

async function sellerBooksDispatchExcelQueue(opts){
    opts=opts||{};
    if(sellerBooksExcelDispatchRunning){
        /*
           API dapat memasukkan file mentah ketika worker sedang membaca
           antrean. Jangan hilangkan permintaan itu: jalankan satu putaran
           lagi setelah worker aktif selesai, dan pertahankan popup hasil.
        */
        sellerBooksExcelDispatchRerunRequested=true;
        if(opts.showResult)sellerBooksExcelDispatchRerunShowResult=true;
        return;
    }
    sellerBooksExcelDispatchRunning=true;
    try{
        const session=await sellerBooksGetQueueSession();
        const ownerId=String(session.user?.id||"");
        const res=await sellerBooksQueueRequest("sellerbooks_api_import_queue?owner_user_id=eq."+encodeURIComponent(ownerId)+"&status=eq.PENDING&order=created_at.asc&limit=20",{
            headers:{"Prefer":"return=representation"}
        });
        if(!res.ok)throw new Error("Gagal membaca antrean API: "+await res.text());
        const items=await res.json();
        for(const item of (Array.isArray(items)?items:[])){
            const claim=await sellerBooksQueueRequest("sellerbooks_api_import_queue?id=eq."+encodeURIComponent(item.id)+"&status=eq.PENDING",{
                method:"PATCH",headers:{"Prefer":"return=representation"},
                body:JSON.stringify({status:"PROCESSING",processing_started_at:new Date().toISOString(),error_message:null})
            });
            if(!claim.ok)continue;
            const claimed=await claim.json();
            if(!Array.isArray(claimed)||!claimed[0])continue;
            try{
                const result=await sellerBooksDispatchExcelToImportPenjualan(claimed[0],!!opts.showResult);
                if(result?.retry){
                    await sellerBooksQueueRequest("sellerbooks_api_import_queue?id=eq."+encodeURIComponent(item.id),{
                        method:"PATCH",headers:{"Prefer":"return=minimal"},
                        body:JSON.stringify({status:"PENDING",processing_started_at:null,error_message:result.error||"Retry"})
                    });
                }
            }catch(error){
                const message=error?.message||String(error);
                await sellerBooksQueueRequest("sellerbooks_api_import_queue?id=eq."+encodeURIComponent(item.id),{
                    method:"PATCH",headers:{"Prefer":"return=minimal"},
                    body:JSON.stringify({status:"ERROR",error_message:message,processed_at:new Date().toISOString()})
                });
                if(opts.showResult)throw error;
                console.error("SellerBooks API queue gagal:",error);
            }
        }
    }finally{
        sellerBooksExcelDispatchRunning=false;
        if(sellerBooksExcelDispatchRerunRequested){
            const showResult=sellerBooksExcelDispatchRerunShowResult;
            sellerBooksExcelDispatchRerunRequested=false;
            sellerBooksExcelDispatchRerunShowResult=false;
            setTimeout(function(){
                sellerBooksDispatchExcelQueue({showResult:showResult}).catch(console.error);
            },0);
        }
    }
}

function startSellerBooksExcelDispatchWorker(){
    /*
       Kontrak: antrean API hanya diproses sebagai tindak lanjut langsung
       setelah pengguna menekan Pull Orders dan API menghasilkan RAW_FILE_READY.
       Jangan polling antrean di latar belakang karena dapat berjalan bersamaan
       dengan import manual dan sinkronisasi cloud.
    */
    window.__sellerBooksExcelDispatchStarted=true;
}

function startSellerBooksTikTokApiQueueWorker(){ startSellerBooksExcelDispatchWorker(); }
