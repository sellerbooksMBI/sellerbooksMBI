

/* =====================================================
   SELLERBOOKS
   APPLICATION ENGINE
===================================================== */






/* =====================================================
   SELLERBOOKS SUPABASE AUTH
   Google Login + Core Adiimasa Approval
===================================================== */
const SELLERBOOKS_SUPABASE_URL="https://vrgiwzxwnfjhpmxcahwo.supabase.co";
const SELLERBOOKS_SUPABASE_KEY="sb_publishable_8Q1xJ_6ji1DqPvbS1GrP-Q_gV9_n3FB";
const sellerBooksSupabase=window.supabase.createClient(SELLERBOOKS_SUPABASE_URL,SELLERBOOKS_SUPABASE_KEY);

/* =====================================================
   SELLERBOOKS CLOUD STORAGE
   SELURUH DATA APLIKASI DISIMPAN PER AKUN GOOGLE DI SUPABASE
   localStorage hanya dibaca sekali untuk migrasi data lama.
===================================================== */
let sellerBooksCloudState = {};
let sellerBooksCloudReady = false;
let sellerBooksCloudSaveTimer = null;
let sellerBooksCloudSavePromise = Promise.resolve();
let sellerBooksCloudLoading = false;
let sellerBooksCloudLoadPromise = null;
let sellerBooksCloudLoadUserId = "";
let sellerBooksCloudGeneration = 0;
let sellerBooksCloudUpdatedAt = null;

/* CLOUD SYNC SAFETY: track last trusted cloud snapshot and local changes. */
let sellerBooksCloudBaseState = {};
let sellerBooksCloudDirtyKeys = new Set();
let sellerBooksCloudClearRequested = false;
let sellerBooksCloudConflictHandling = false;

function sellerBooksCloneCloudState(data){
    return {...((data && typeof data==="object") ? data : {})};
}

function sellerBooksGetSalesImportIdentity(transaction){
    const marketplaceKey=String(transaction?.marketplaceId||transaction?.marketplace||"").trim().toLowerCase();
    const storeKey=String(transaction?.storeId||"").trim().toLowerCase();
    const orderKey=String(transaction?.orderId||"").trim().toLowerCase();
    const packingKey=String(transaction?.packingId||"").trim().toLowerCase();
    const skuKey=String(transaction?.sku||"").trim().toLowerCase();
    if(!orderKey && !packingKey)return "";

    /* Lazada: pertahankan setiap baris sumber sebagai transaksi terpisah.
       sourceRowIndex sudah dibuat saat import dan harus ikut dalam identity
       agar baris SKU yang sama dalam Order Number yang sama tidak tergabung. */
    if(
        String(transaction?.marketplace||"").trim().toLowerCase()==="lazada" ||
        String(transaction?.marketplaceId||"").trim().toLowerCase()==="lazada"
    ){
        const sourceRow=String(transaction?.sourceRowIndex ?? "").trim();
        if(sourceRow!==""){
            return marketplaceKey+"|"+storeKey+
                   "|ORDER:"+orderKey+
                   "|SKU:"+skuKey+
                   "|ROW:"+sourceRow;
        }
    }

    return marketplaceKey+"|"+storeKey+"|"+(orderKey?"ORDER:"+orderKey:"PACKING:"+packingKey)+"|"+skuKey;
}

function sellerBooksGetSalesImportKeys(value){
    try{
        const imports=Array.isArray(value)?value:JSON.parse(value||"[]");
        const keys=new Set();
        (imports||[]).forEach(function(record){
            (record?.transactions||[]).forEach(function(transaction){
                const key=sellerBooksGetSalesImportIdentity(transaction);
                if(key)keys.add(key);
            });
        });
        return keys;
    }catch(error){ return new Set(); }
}

function sellerBooksMergeSalesImportsForConflict(baseValue,localValue,remoteValue){
    let base=[],local=[],remote=[];
    try{base=Array.isArray(baseValue)?baseValue:JSON.parse(baseValue||"[]");}catch(error){}
    try{local=Array.isArray(localValue)?localValue:JSON.parse(localValue||"[]");}catch(error){}
    try{remote=Array.isArray(remoteValue)?remoteValue:JSON.parse(remoteValue||"[]");}catch(error){}

    const baseKeys=sellerBooksGetSalesImportKeys(base);
    const localKeys=sellerBooksGetSalesImportKeys(local);
    let removed=0;
    baseKeys.forEach(function(key){if(!localKeys.has(key))removed++;});

    if(removed>0){
        return {conflict:true,reason:"Data penjualan berubah di perangkat lain saat operasi penghapusan/edit berlangsung."};
    }

    const result=[],recordById=new Map();
    function addRecord(record){
        if(!record||typeof record!=="object")return;
        const id=String(record.id||"");
        if(id&&recordById.has(id)){
            const existing=recordById.get(id);
            existing.transactions=(existing.transactions||[]).concat(Array.isArray(record.transactions)?record.transactions:[]);
            return;
        }
        const cloned={...record,transactions:Array.isArray(record.transactions)?record.transactions.map(function(item){return {...item};}):[]};
        result.push(cloned);
        if(id)recordById.set(id,cloned);
    }
    remote.forEach(addRecord);
    local.forEach(addRecord);

    const seen=new Set();
    result.forEach(function(record){
        const unique=[];
        (record.transactions||[]).forEach(function(transaction){
            const key=sellerBooksGetSalesImportIdentity(transaction);
            if(key&&seen.has(key))return;
            if(key)seen.add(key);
            unique.push(transaction);
        });
        record.transactions=unique;
    });

    return {conflict:false,value:JSON.stringify(result)};
}

function sellerBooksBuildConcurrentSnapshot(baseState,localState,remoteState){
    if(sellerBooksCloudClearRequested){
        throw new Error("Data cloud berubah di perangkat lain. Operasi hapus seluruh data dibatalkan demi keamanan.");
    }

    const merged=sellerBooksCloneCloudState(remoteState);
    sellerBooksCloudDirtyKeys.forEach(function(key){
        if(key==="sellerbooks_sales_imports"){
            const sales=sellerBooksMergeSalesImportsForConflict(
                baseState[key],localState[key],remoteState[key]
            );
            if(sales.conflict)throw new Error(sales.reason);
            merged[key]=sales.value;
        }else if(localState[key]===undefined){
            delete merged[key];
        }else{
            merged[key]=localState[key];
        }
    });
    return merged;
}

function sellerBooksMarkCloudDirty(key){
    if(!sellerBooksDataRealtimeApplying)sellerBooksCloudDirtyKeys.add(String(key));
}

function sellerBooksStorageGetItem(key){
    const value=sellerBooksCloudState[key];
    if(value===undefined||value===null)return null;

    /*
       Cloud data dapat menyimpan beberapa key sebagai JSON native
       (khususnya sellerbooks_sales_imports sebagai ARRAY).
       localStorage selalu mengembalikan STRING, sehingga nilai object/array
       harus diserialisasi terlebih dahulu agar JSON.parse(...) di seluruh
       mesin SellerBooks tetap bekerja sama seperti sebelumnya.
    */
    if(typeof value==="object"){
        try{
            return JSON.stringify(value);
        }catch(error){
            return null;
        }
    }

    return String(value);
}

function sellerBooksStorageSetItem(key,value){
    sellerBooksCloudState[key]=String(value);
    sellerBooksMarkCloudDirty(key);
    sellerBooksQueueCloudSave();
}

function sellerBooksStorageRemoveItem(key){
    delete sellerBooksCloudState[key];
    sellerBooksMarkCloudDirty(key);
    sellerBooksQueueCloudSave();
}

function sellerBooksStorageClear(){
    sellerBooksCloudClearRequested=true;
    Object.keys(sellerBooksCloudBaseState).forEach(function(key){sellerBooksCloudDirtyKeys.add(key);});
    Object.keys(sellerBooksCloudState).forEach(function(key){sellerBooksCloudDirtyKeys.add(key);});
    sellerBooksCloudState={};
    sellerBooksQueueCloudSave();
}

const sellerBooksStorage = {
    getItem:sellerBooksStorageGetItem,
    setItem:sellerBooksStorageSetItem,
    removeItem:sellerBooksStorageRemoveItem,
    clear:sellerBooksStorageClear,
    key:function(index){
        const keys = Object.keys(sellerBooksCloudState);
        return keys[index] ?? null;
    }
};
Object.defineProperty(sellerBooksStorage,"length",{
    get:function(){
        return Object.keys(sellerBooksCloudState).length;
    }
});

/* =====================================================
   FAST START CACHE
   Cache lokal untuk mempercepat startup/refresh. Supabase
   tetap menjadi sumber data utama dan diverifikasi di belakang.
===================================================== */
const sellerBooksFastCacheDBName="SellerBooksFastCache";
const sellerBooksFastCacheStoreName="sessions";
function sellerBooksOpenFastCacheDB(){
    return new Promise(function(resolve){
        try{
            if(!window.indexedDB){resolve(null);return;}
            const request=window.indexedDB.open(sellerBooksFastCacheDBName,1);
            request.onupgradeneeded=function(event){
                const db=event.target.result;
                if(!db.objectStoreNames.contains(sellerBooksFastCacheStoreName))db.createObjectStore(sellerBooksFastCacheStoreName);
            };
            request.onsuccess=function(){resolve(request.result);};
            request.onerror=function(){resolve(null);};
        }catch(error){resolve(null);}
    });
}
async function sellerBooksFastCacheGet(userId){
    if(!userId)return null;
    const db=await sellerBooksOpenFastCacheDB();
    if(!db)return null;
    return new Promise(function(resolve){
        try{
            const req=db.transaction(sellerBooksFastCacheStoreName,"readonly").objectStore(sellerBooksFastCacheStoreName).get(String(userId));
            req.onsuccess=function(){resolve(req.result||null);};
            req.onerror=function(){resolve(null);};
        }catch(error){resolve(null);}
    });
}
async function sellerBooksFastCacheSet(userId,value){
    if(!userId||!value)return;
    const db=await sellerBooksOpenFastCacheDB();
    if(!db)return;
    try{db.transaction(sellerBooksFastCacheStoreName,"readwrite").objectStore(sellerBooksFastCacheStoreName).put(value,String(userId));}catch(error){}
}
async function sellerBooksSaveFastCache(){
    if(!sellerBooksAuthUser||!sellerBooksCloudReady)return;
    try{await sellerBooksFastCacheSet(sellerBooksAuthUser.id,{savedAt:Date.now(),profile:{status:String(sellerBooksProfile?.status||""),owner_name:String(sellerBooksProfile?.owner_name||""),email:String(sellerBooksProfile?.email||sellerBooksAuthUser.email||"")},data:sellerBooksCloudState});}catch(error){}
}
async function sellerBooksWarmStartFromCache(user){
    if(!user)return false;
    try{
        const cached=await sellerBooksFastCacheGet(user.id);
        if(!cached||!cached.data||!cached.profile||String(cached.profile.status||"").toLowerCase()!=="approved")return false;
        sellerBooksAuthUser=user;
        sellerBooksProfile={...(cached.profile||{}),user_id:user.id,email:cached.profile.email||user.email||""};
        sellerBooksCloudState={...cached.data};

        /*
           CACHE HANYA UNTUK TAMPILAN CEPAT.
           Cache tidak boleh dianggap sebagai sumber cloud yang siap ditulis.
           sellerBooksLoadCloudData() akan mengambil data Supabase terlebih dahulu.
        */
        clearTimeout(sellerBooksCloudSaveTimer);
        sellerBooksCloudSaveTimer=null;
        sellerBooksCloudGeneration++;
        sellerBooksCloudLoading=true;
        sellerBooksCloudReady=false;

        sellerBooksRefreshRuntimeFromCloud();
        sellerBooksOpenApplication();
        sellerBooksRefreshActiveView();
        return true;
    }catch(error){console.warn("Fast cache SellerBooks gagal digunakan:",error);return false;}
}

function sellerBooksGetLegacyLocalData(){
    const legacy = {};
    try{
        for(let i=0;i<window.localStorage.length;i++){
            const key = window.localStorage.key(i);
            if(!key || !key.startsWith("sellerbooks_"))continue;
            legacy[key] = window.localStorage.getItem(key);
        }
    }catch(error){
        console.warn("Migrasi localStorage SellerBooks gagal dibaca:",error);
    }
    return legacy;
}

function sellerBooksClearLegacyLocalData(){
    try{
        const keys=[];
        for(let i=0;i<window.localStorage.length;i++){
            const key=window.localStorage.key(i);
            if(key && key.startsWith("sellerbooks_"))keys.push(key);
        }
        keys.forEach(function(key){window.localStorage.removeItem(key);});
    }catch(error){
        console.warn("Data lokal lama SellerBooks tidak dapat dibersihkan:",error);
    }
}

async function sellerBooksReadCloudRow(){
    const {data,error}=await sellerBooksSupabase
        .from("sellerbooks_user_data")
        .select("data,updated_at")
        .eq("user_id",sellerBooksAuthUser.id)
        .maybeSingle();
    if(error)throw error;
    return {
        exists:!!data,
        data:(data&&data.data&&typeof data.data==="object")?data.data:{},
        updatedAt:data?.updated_at||null
    };
}

async function sellerBooksWriteCloudSnapshot(snapshot,expectedUpdatedAt,allowInsert,returnSavedData){
    const userId=sellerBooksAuthUser.id;
    const nextUpdatedAt=new Date().toISOString();
    const responseFields=returnSavedData ? "data,updated_at" : "updated_at";

    if(expectedUpdatedAt){
        const {data,error}=await sellerBooksSupabase
            .from("sellerbooks_user_data")
            .update({data:snapshot,updated_at:nextUpdatedAt})
            .eq("user_id",userId)
            .eq("updated_at",expectedUpdatedAt)
            .select(responseFields);
        if(error)throw error;
        if(!data||data.length===0)return {conflict:true};

        const result={
            conflict:false,
            updatedAt:data[0].updated_at||nextUpdatedAt
        };
        if(returnSavedData)result.data=data[0].data||{};
        return result;
    }

    if(!allowInsert)return {conflict:true};

    const {data,error}=await sellerBooksSupabase
        .from("sellerbooks_user_data")
        .insert({user_id:userId,data:snapshot,updated_at:nextUpdatedAt})
        .select(responseFields);
    if(error){
        if(String(error.code||"")==="23505")return {conflict:true};
        throw error;
    }

    const result={
        conflict:false,
        updatedAt:data?.[0]?.updated_at||nextUpdatedAt
    };
    if(returnSavedData)result.data=data?.[0]?.data||snapshot;
    return result;
}

async function sellerBooksReloadCloudAfterConflict(){
    const row=await sellerBooksReadCloudRow();
    sellerBooksCloudUpdatedAt=row.updatedAt;
    sellerBooksCloudBaseState=sellerBooksCloneCloudState(row.data);
    sellerBooksCloudState=sellerBooksCloneCloudState(row.data);
    sellerBooksCloudDirtyKeys.clear();
    sellerBooksCloudClearRequested=false;
    sellerBooksCloudReady=true;
    sellerBooksCloudLoading=false;
    await sellerBooksSaveFastCache();
    sellerBooksRefreshRuntimeFromCloud();
    sellerBooksRefreshAllViewsFromCloud();
    return row;
}

async function sellerBooksPersistCloudDataNow(){
    if(!sellerBooksAuthUser||!sellerBooksCloudReady||sellerBooksCloudLoading)return;

    const saveGeneration=sellerBooksCloudGeneration;
    const saveUserId=sellerBooksAuthUser.id;

    sellerBooksCloudSavePromise=sellerBooksCloudSavePromise.then(async function(){
        if(!sellerBooksCloudReady||sellerBooksCloudLoading||
           sellerBooksCloudGeneration!==saveGeneration||
           !sellerBooksAuthUser||sellerBooksAuthUser.id!==saveUserId)return;

        let snapshot=sellerBooksCloneCloudState(sellerBooksCloudState);
        let expectedUpdatedAt=sellerBooksCloudUpdatedAt;

        for(let attempt=0;attempt<2;attempt++){
            const result=await sellerBooksWriteCloudSnapshot(
                snapshot,expectedUpdatedAt,!expectedUpdatedAt
            );

            if(!result.conflict){
                sellerBooksCloudUpdatedAt=result.updatedAt;
                sellerBooksCloudBaseState=sellerBooksCloneCloudState(snapshot);
                sellerBooksCloudState=sellerBooksCloneCloudState(snapshot);
                sellerBooksCloudDirtyKeys.clear();
                sellerBooksCloudClearRequested=false;
                await sellerBooksSaveFastCache();
                return;
            }

            if(sellerBooksCloudConflictHandling){
                throw new Error("Konflik sinkronisasi SellerBooks sedang diproses.");
            }

            sellerBooksCloudConflictHandling=true;
            try{
                const remote=await sellerBooksReadCloudRow();
                if(!remote.exists&&expectedUpdatedAt){
                    throw new Error("Data cloud tidak ditemukan saat sinkronisasi. Penulisan dibatalkan demi keamanan.");
                }
                snapshot=sellerBooksBuildConcurrentSnapshot(
                    sellerBooksCloudBaseState,
                    sellerBooksCloudState,
                    sellerBooksCloneCloudState(remote.data)
                );
                expectedUpdatedAt=remote.updatedAt;
                sellerBooksCloudUpdatedAt=remote.updatedAt;
                sellerBooksCloudState=sellerBooksCloneCloudState(snapshot);
            }finally{
                sellerBooksCloudConflictHandling=false;
            }
        }

        throw new Error("Sinkronisasi gagal karena data berubah bersamaan.");
    }).catch(function(error){
        console.error("Sinkronisasi data SellerBooks ke Supabase gagal:",error);
        if(/Data penjualan berubah|data cloud berubah|tidak ditemukan|Konflik sinkronisasi/i.test(String(error?.message||""))){
            sellerBooksReloadCloudAfterConflict().catch(function(reloadError){
                console.error("Reload cloud setelah konflik gagal:",reloadError);
            });
        }
    });

    return sellerBooksCloudSavePromise;
}

async function sellerBooksPersistCloudDataStrict(expectedSnapshot,verification){
    if(!sellerBooksAuthUser||!sellerBooksCloudReady)throw new Error("Sinkronisasi Supabase belum siap.");

    const saveUserId=String(sellerBooksAuthUser.id||"");
    const saveGeneration=sellerBooksCloudGeneration;

    /*
       Serialisasi cloud harus pulih walau operasi sebelumnya gagal.
       Snapshot diambil DI DALAM antrean agar autosave yang selesai lebih
       dahulu tidak ditimpa snapshot lama dari awal import.
    */
    sellerBooksCloudSavePromise=sellerBooksCloudSavePromise
      .catch(function(previousError){
          console.warn("Melanjutkan antrean cloud setelah operasi sebelumnya gagal:",previousError);
      })
      .then(async function(){
        if(!sellerBooksAuthUser||String(sellerBooksAuthUser.id||"")!==saveUserId){
            throw new Error("Akun berubah sebelum import selesai disimpan.");
        }
        if(!sellerBooksCloudReady||sellerBooksCloudLoading||
           sellerBooksCloudGeneration!==saveGeneration){
            throw new Error("Sinkronisasi cloud berubah saat import berlangsung. Silakan coba lagi.");
        }

        /* Gunakan state terbaru, termasuk record import yang baru dibuat. */
        let snapshot=sellerBooksCloneCloudState(sellerBooksCloudState);
        let expectedUpdatedAt=sellerBooksCloudUpdatedAt;
        let result=null;

        for(let attempt=0;attempt<3;attempt++){
            try{
                result=await sellerBooksWriteCloudSnapshot(
                    snapshot,expectedUpdatedAt,!expectedUpdatedAt,true
                );
            }catch(writeError){
                /* Retry hanya untuk kegagalan jaringan/server sementara.
                   Update snapshot ke row yang sama bersifat idempotent. */
                if(attempt>=2)throw writeError;
                await new Promise(function(resolve){setTimeout(resolve,250*(attempt+1));});
                continue;
            }

            if(!result.conflict)break;

            if(attempt>=2){
                throw new Error("Konflik penyimpanan cloud: data berubah bersamaan. Import tidak dikonfirmasi tersimpan.");
            }

            const remote=await sellerBooksReadCloudRow();
            if(!remote.exists&&expectedUpdatedAt){
                throw new Error("Data cloud tidak ditemukan saat sinkronisasi. Penulisan dibatalkan demi keamanan.");
            }
            snapshot=sellerBooksBuildConcurrentSnapshot(
                sellerBooksCloudBaseState,
                sellerBooksCloudState,
                sellerBooksCloneCloudState(remote.data)
            );
            expectedUpdatedAt=remote.updatedAt;
        }

        if(!result||result.conflict){
            throw new Error("Penyimpanan cloud belum dapat dikonfirmasi.");
        }

        /* Verifikasi melalui pembacaan baru dari Supabase, bukan hanya
           respons UPDATE. Ini memastikan record tetap ada setelah refresh. */
        const readBack=await sellerBooksReadCloudRow();
        if(!readBack.exists || !readBack.updatedAt){
            throw new Error("Verifikasi cloud gagal: data tidak ditemukan setelah disimpan.");
        }
        if(typeof verification==="function"&&!verification(readBack.data)){
            throw new Error("Verifikasi gagal: data yang dibaca kembali dari cloud tidak sesuai.");
        }

        sellerBooksCloudUpdatedAt=readBack.updatedAt;
        sellerBooksCloudBaseState=sellerBooksCloneCloudState(readBack.data);
        sellerBooksCloudState=sellerBooksCloneCloudState(readBack.data);
        sellerBooksCloudDirtyKeys.clear();
        sellerBooksCloudClearRequested=false;
        /* Supabase read-back above is the durable confirmation.
           IndexedDB fast-cache failure must not report a saved import as failed:
           the next page load can rebuild this optional cache from Supabase. */
        try{
            await sellerBooksSaveFastCache();
        }catch(cacheError){
            console.warn("SellerBooks: cloud save confirmed; fast cache update failed:",cacheError);
        }
    });

    return sellerBooksCloudSavePromise;
}

function sellerBooksQueueCloudSave(){
    if(!sellerBooksAuthUser||!sellerBooksCloudReady)return;
    clearTimeout(sellerBooksCloudSaveTimer);
    /*
       Simpan sesegera mungkin setelah perubahan sinkron selesai.
       Timer 0 ms tetap menggabungkan beberapa setItem dalam satu proses
       JavaScript, tetapi tidak menahan perubahan selama 250 ms.
       Semua penulisan tetap diserialisasi oleh sellerBooksCloudSavePromise.
    */
    sellerBooksCloudSaveTimer=setTimeout(function(){
        sellerBooksCloudSaveTimer=null;
        sellerBooksPersistCloudDataNow();
    },0);
}

async function sellerBooksMigrateLogoDataUrl(settings){
    /*
       Logo lama tetap disimpan sebagai data URL di
       sellerbooks_user_data agar seluruh data SellerBooks
       berada pada Supabase dan tidak bergantung pada Storage RLS.
    */
    return settings;
}

async function sellerBooksLoadCloudData(){
    if(!sellerBooksAuthUser)return;
    const loadUserId=String(sellerBooksAuthUser.id||"");
    if(!loadUserId)return;
    if(
        sellerBooksCloudLoadPromise &&
        sellerBooksCloudLoadUserId === loadUserId
    ){
        return sellerBooksCloudLoadPromise;
    }

    sellerBooksCloudLoadUserId=loadUserId;
    const currentLoadPromise=sellerBooksLoadCloudDataInternal(loadUserId);
    sellerBooksCloudLoadPromise=currentLoadPromise;

    try{
        return await currentLoadPromise;
    }finally{
        if(sellerBooksCloudLoadPromise === currentLoadPromise){
            sellerBooksCloudLoadPromise=null;
            sellerBooksCloudLoadUserId="";
        }
    }
}

async function sellerBooksLoadCloudDataInternal(loadUserId){
    if(!sellerBooksAuthUser)return;

    /*
       SAFETY GUARD:
       Jangan membuang autosave yang sudah dijadwalkan saat pembacaan cloud
       dimulai. Operasi simpan yang tertunda harus diberi kesempatan selesai
       terlebih dahulu agar refresh/login tidak membaca snapshot lama.
    */
    const hadPendingCloudSave = sellerBooksCloudSaveTimer !== null;
    clearTimeout(sellerBooksCloudSaveTimer);
    sellerBooksCloudSaveTimer=null;

    if(hadPendingCloudSave && sellerBooksCloudReady && !sellerBooksCloudLoading){
        await sellerBooksPersistCloudDataNow();
    }else if(sellerBooksCloudSavePromise){
        await sellerBooksCloudSavePromise;
    }

    sellerBooksCloudGeneration++;
    sellerBooksCloudLoading=true;
    sellerBooksCloudReady=false;

    try{
        const {data,error}=await sellerBooksSupabase
            .from("sellerbooks_user_data")
            .select("data,updated_at")
            .eq("user_id",sellerBooksAuthUser.id)
            .maybeSingle();
        if(error)throw error;

        sellerBooksCloudUpdatedAt = data?.updated_at || null;

        const legacy=sellerBooksGetLegacyLocalData();
    const hasLegacy=Object.keys(legacy).length>0;
    const existingCloudData=(data && data.data && typeof data.data === "object") ? data.data : {};
    const shouldMigrateLegacy=Object.keys(existingCloudData).length===0 && hasLegacy;
    let cloudData=shouldMigrateLegacy ? {...legacy} : {...existingCloudData};

    sellerBooksCloudState=cloudData;
    sellerBooksCloudBaseState=sellerBooksCloneCloudState(existingCloudData);
    sellerBooksCloudDirtyKeys.clear();
    sellerBooksCloudClearRequested=false;
    sellerBooksCloudReady=true;
    sellerBooksCloudLoading=false;

    /*
       Bahasa adalah konfigurasi tambahan. Kegagalan membaca/menyimpan
       bahasa tidak boleh memblokir akun yang sudah APPROVED.
    */
    try{
        await sellerBooksEnsureDefaultLanguage();
    }catch(languageError){
        console.warn("Sinkronisasi bahasa SellerBooks dilewati:",languageError);
    }

    /* Bahasa bukan bagian dari sellerbooks_user_data. Hapus key bahasa lama
       dari state user bila masih ada, tanpa menyentuh setting aplikasi lain. */
    if(Object.prototype.hasOwnProperty.call(sellerBooksCloudState,SELLERBOOKS_LANGUAGE_KEY)){
        delete sellerBooksCloudState[SELLERBOOKS_LANGUAGE_KEY];
        sellerBooksCloudDirtyKeys.delete(SELLERBOOKS_LANGUAGE_KEY);
    }

    /* Migrasikan logo data-url lama ke Supabase Storage bila masih ada. */
    try{
        const settingsText=sellerBooksStorageGetItem("sellerbooks_settings");
        if(settingsText){
            const settings=JSON.parse(settingsText);
            if(settings && settings.logo && String(settings.logo).startsWith("data:image/")){
                const migrated=await sellerBooksMigrateLogoDataUrl(settings);
                sellerBooksCloudState["sellerbooks_settings"]=JSON.stringify(migrated);
            }
        }
    }catch(error){
        console.warn("Migrasi pengaturan SellerBooks gagal:",error);
    }

    if(shouldMigrateLegacy ||
       sellerBooksCloudState["sellerbooks_settings"]!==existingCloudData["sellerbooks_settings"]){
        await sellerBooksPersistCloudDataNow();
    }

    /* Setelah data berhasil berada di Supabase, hapus salinan data aplikasi lama. */
    sellerBooksClearLegacyLocalData();
    sellerBooksSaveFastCache();

    /*
       Inisialisasi bucket hari berjalan setelah data cloud benar-benar
       tersedia. Edit berikutnya akan terus memperbarui bucket hari ini.
    */
    sellerBooksEnsureTodaySnapshot();
    sellerBooksStartDailySnapshotClock();

    sellerBooksCloudReady=true;
    sellerBooksCloudLoading=false;

    /*
       Preferensi tampilan adalah state UI lokal, bukan data cloud.
       Setelah user diketahui, setiap refresh dimulai dari Hari Ini untuk
       Dashboard, Laporan, dan Rincian secara independen.
    */
    try{
        prepareDailyViewState(true);
    }catch(viewPreferenceError){
        console.warn(
            "Inisialisasi preferensi tampilan gagal:",
            viewPreferenceError
        );
    }

    }catch(error){
        sellerBooksCloudLoading=false;
        sellerBooksCloudReady=false;
        throw error;
    }
}

function sellerBooksRefreshRuntimeFromCloud(){
    try{
        if(typeof marketplaces!=="undefined"){
            marketplaces=JSON.parse(sellerBooksStorageGetItem("sellerbooks_marketplaces")||"[]") || marketplaces;
        }
    }catch(error){}
    try{
        if(typeof stores!=="undefined"){
            stores=JSON.parse(sellerBooksStorageGetItem("sellerbooks_stores")||"[]") || stores;
        }
    }catch(error){}
    try{
        if(typeof products!=="undefined"){
            products=JSON.parse(sellerBooksStorageGetItem("sellerbooks_products")||"[]") || products;
        }
    }catch(error){}
    try{
        if(typeof costs!=="undefined"){
            costs=JSON.parse(sellerBooksStorageGetItem("sellerbooks_costs")||"[]") || costs;
        }
    }catch(error){}
    /* Pastikan logo tersimpan langsung diterapkan saat pertama masuk/refresh. */
    try{
        if(typeof renderSettingsLogo==="function"){
            renderSettingsLogo();
        }
    }catch(error){}

    try{
        sellerBooksSyncLanguageControl();
    }catch(error){}
}

let sellerBooksAuthUser=null;
let sellerBooksProfile=null;
let sellerBooksApprovalTimer=null;


let sellerBooksApprovalPromise = null;
let sellerBooksApprovalPromiseUserId = "";







sellerBooksSupabase.auth.onAuthStateChange(function(event,session){
    if(session?.user){
        sellerBooksAuthUser=session.user;
        setTimeout(function(){sellerBooksCheckApproval(false);},0);
    }else{
        /*
           Jangan menganggap event null sementara sebagai logout.
           Hanya SIGNED_OUT yang boleh menghapus language lock.
        */
        if(event === "SIGNED_OUT"){
            sellerBooksAuthUser=null;
            sellerBooksProfile=null;
            sellerBooksLoginLanguageOverrideActive=false;
            try{
                window.sessionStorage.removeItem(
                    SELLERBOOKS_SESSION_LANGUAGE_KEY
                );
            }catch(error){}
        }
        applyBusinessLogoToInterface("");
        sellerBooksShowOnly("loginPage");
        sellerBooksApplyLoginLanguage();
    }
});
/* =====================================================
   SELLERBOOKS REALTIME ACCOUNT GUARD
   Hanya memantau perubahan status akun / penghapusan profile.
   Tidak mengubah alur login atau data aplikasi.
===================================================== */
let sellerBooksAccountRealtimeChannel=null;
let sellerBooksAccountRealtimeHandling=false;
let sellerBooksDataRealtimeChannel=null;
let sellerBooksDataRealtimeApplying=false;
















/* Mulai / hentikan guard mengikuti sesi login yang sudah ada. */
sellerBooksSupabase.auth.onAuthStateChange(function(event,session){
    if(session?.user){
        sellerBooksAuthUser=session.user;
        sellerBooksStartAccountRealtime();
        sellerBooksStartDataRealtime();
        sellerBooksStartIntegrationRealtime();
        sellerBooksStartIntegrationStatusPolling();
        sellerBooksStartAccountPolling();
    }else{
        sellerBooksStopAccountRealtime();
        sellerBooksStopDataRealtime();
        sellerBooksStopIntegrationRealtime();
        sellerBooksStopIntegrationStatusPolling();
        sellerBooksStoreConnections = new Map();
        sellerBooksStoreConnectionsUserId = "";
        sellerBooksStoreConnectionsInitialized = false;
        sellerBooksStopAccountPolling();
    }
});

/* =====================================================
   APK FALLBACK ACCOUNT GUARD
   WebView HP kadang tidak mempertahankan WebSocket Realtime.
   Karena itu APK melakukan pengecekan ringan berkala hanya
   saat aplikasi berjalan aktif. Tidak mengubah data aplikasi.
===================================================== */
let sellerBooksAccountPollingTimer=null;
let sellerBooksAccountPollingBusy=false;







/* =====================================================
   SIMPAN NAMA PEMILIK KE SUPABASE
===================================================== */

async function saveOwnerName(){
    const input=document.getElementById("ownerNameInput");
    const ownerName=input.value.trim();
    if(!ownerName){sellerBooksAlert(sellerBooksOwnerSetupText("nameRequired"),sellerBooksOwnerSetupText("title"));input.focus();return;}
    if(!sellerBooksAuthUser){sellerBooksAlert(sellerBooksOwnerSetupText("session"),sellerBooksOwnerSetupText("title"));sellerBooksShowOnly("loginPage");
        sellerBooksApplyLoginLanguage();return;}
    try{
        const {error}=await sellerBooksSupabase.from("sellerbooks_profiles").update({owner_name:ownerName,contact_name:ownerName,updated_at:new Date().toISOString()}).eq("user_id",sellerBooksAuthUser.id);
        if(error)throw error;
        sellerBooksProfile=await sellerBooksLoadProfile(sellerBooksAuthUser);
        sellerBooksStorage.setItem("sellerbooks_owner_name",ownerName);
        updateSidebarOwner();
        document.getElementById("ownerSetupPage").style.display="none";
        document.getElementById("loginPage").style.display="none";
        document.getElementById("app").style.display="block";
        sellerBooksAlert(sellerBooksOwnerSetupText("success")+ownerName,sellerBooksOwnerSetupText("title"));
    }catch(error){console.error("Gagal menyimpan Nama Pemilik:",error);sellerBooksAlert(sellerBooksOwnerSetupText("failed")+"\n\n"+error.message,sellerBooksOwnerSetupText("title"));}
}

/* =====================================================
   NAVIGATION
===================================================== */

const pageData = {

    dashboard:{
        title:"Dashboard",
        subtitle:"Ringkasan bisnis marketplace Anda"
    },

    marketplace:{
        title:"Marketplace",
        subtitle:"Kelola marketplace bisnis Anda"
    },

    stores:{
        title:"Akun Toko",
        subtitle:"Kelola seluruh akun toko"
    },

    products:{
        title:"Master Produk",
        subtitle:"Kelola produk dan SKU"
    },

    import:{
        title:"Import Penjualan",
        subtitle:"Upload dan proses laporan penjualan"
    },

    costs:{
        title:"Biaya Lain",
        subtitle:"Kelola biaya tambahan bisnis"
    },

    reports:{
        title:"Laporan",
        subtitle:"Analisis bisnis marketplace Anda"
    },

    productAnalysis:{
        title:"Rincian",
        subtitle:"Analisis laba dan kerugian setiap produk"
    },

    settings:{
        title:"Pengaturan",
        subtitle:"Pengaturan SellerBooks"
    }

};


/* =====================================================
   NAVIGATION SELLERBOOKS
   + HISTORY BACK HP
===================================================== */


/* =========================================================
   RINCIAN PRODUK - ANALISIS LABA PER SKU
   FILTER BERDIRI SENDIRI, TIDAK MENGUBAH LAPORAN UTAMA
========================================================= */













/* =========================================================
   RINCIAN PENJUALAN PER PRODUK - PAGINATION
   Default 20 baris, pilihan 20/40/50/80/100
========================================================= */
let productAnalysisPage = 1;
let productAnalysisPageSize = 20;
let productAnalysisPaginationFilterKey = "";




function escapeHtml(value){
    return escapeHtmlProductAnalysis(value);
}




/* Preferensi Rincian tetap terpisah saat berpindah kartu/menu. */



/* =====================================================
   MARKETPLACE DATABASE
   SEMENTARA LOCAL STORAGE
===================================================== */

let marketplaces = JSON.parse(

    sellerBooksStorage.getItem("sellerbooks_marketplaces")

) || [

    {
        id:"shopee",
        name:"Shopee",
        icon:"🛍️",
        status:"active",
        system:true
    },

    {
        id:"tiktok",
        name:"TikTok Shop",
        icon:"🎵",
        status:"active",
        system:true
    },

    {
        id:"tokopedia",
        name:"Tokopedia",
        icon:"🟢",
        status:"inactive",
        system:true
    },

    {
        id:"lazada",
        name:"Lazada",
        icon:"🔵",
        status:"inactive",
        system:true
    },

    {
        id:"toco",
        name:"Toco",
        icon:"🟣",
        status:"inactive",
        system:true
    },

    {
        id:"blibli",
        name:"Blibli",
        icon:"🔷",
        status:"inactive",
        system:true
    }

];


let editingMarketplaceId = null;


/* =====================================================
   SAVE LOCAL
===================================================== */



/* =====================================================
   MARKETPLACE LOGO
   LOGO STATIS DARI GITHUB REPOSITORY
===================================================== */



/* =====================================================
   RENDER MARKETPLACE
===================================================== */


/* =====================================================
   DASHBOARD DIAGRAM STATISTIK
   Menggunakan data transaksi yang sama dengan kartu Dashboard.
===================================================== */



/* PATCH H: hindari rebuild grafik Dashboard jika dataset + periode tidak berubah. */
let sellerBooksDashboardChartsCache = {
    transactions:null,
    period:"",
    rendered:false
};


/* =====================================================
   DASHBOARD PERFORMANCE MARKETPLACE
   MENAMPILKAN MARKETPLACE YANG AKTIF
===================================================== */

let sellerBooksDashboardTransactionsCache = {
    sourceTransactions:null,
    key:"",
    transactions:null
};
let sellerBooksDashboardMarketplaceRowsCache = {
    transactions:null,
    marketplaces:null,
    stores:null,
    products:null,
    costs:null,
    period:"",
    rows:null
};




/* =====================================================
   PATCH G: CACHE DASHBOARD MASTER DATA + MARKETPLACE INDEX
   ===================================================== */

const sellerBooksDashboardMasterArrayCache = {};


let sellerBooksDashboardProductMapCache = {
    source:null,
    map:null
};


let sellerBooksDashboardStoresIndexCache = {
    source:null,
    index:null
};


let sellerBooksDashboardTransactionMarketplaceIndexCache = {
    source:null,
    index:null
};



let sellerBooksDashboardMarketplaceCostsCache = {
    source:null,
    period:"",
    index:null
};






/* =====================================================
   SAVE MARKETPLACE
===================================================== */



/* =====================================================
   EDIT MARKETPLACE
===================================================== */



/* =====================================================
   ACTIVATE / DEACTIVATE
===================================================== */




/* =====================================================
   GO TO STORE
===================================================== */


/* =====================================================
   AKUN TOKO DATABASE
   SEMENTARA MENGGUNAKAN LOCAL STORAGE
===================================================== */

let stores = JSON.parse(

    sellerBooksStorage.getItem("sellerbooks_stores")

) || [];


/* ID TOKO YANG SEDANG DIEDIT */

let editingStoreId = null;


/* MARKETPLACE YANG DIPILIH DARI TOMBOL KELOLA TOKO */

let selectedMarketplaceId = null;



/* =====================================================
   SIMPAN DATA TOKO
===================================================== */




/* =====================================================
   AMBIL MARKETPLACE AKTIF
===================================================== */




/* =====================================================
   RENDER PILIHAN MARKETPLACE
===================================================== */




/* =====================================================
   RENDER FILTER MARKETPLACE
===================================================== */








/* =====================================================
   INTEGRASI AKUN TOKO
===================================================== */



/* =====================================================
   COPOT INTEGRASI AKUN TOKO
===================================================== */

async function disconnectStoreAccount(storeId){

    const store = stores.find(function(item){
        return String(item.id) === String(storeId);
    });

    if(!store){
        sellerBooksAlert(sellerBooksStoreText("storeNotFound"),sellerBooksStoreText("disconnectTitle"));
        return;
    }

    const marketplace = marketplaces.find(function(item){
        return String(item.id) === String(store.marketplaceId);
    });

    if(!marketplace){
        sellerBooksAlert(sellerBooksStoreText("marketplaceNotFound"),sellerBooksStoreText("disconnectTitle"));
        return;
    }

    const connection = getStoreIntegrationConnection(store);

    if(!connection ||
       String(connection.connection_status || "").toUpperCase() !== "CONNECTED"){
        await refreshStoreIntegrationStates(true);
        return;
    }

    const confirmed = await sellerBooksConfirm(
        sellerBooksStoreText("disconnectConfirm") + " " + marketplace.name + " " +
        (sellerBooksCurrentLanguage() === "en" ? "from store account \"" : "dari akun toko \"") +
        store.name + "\"?\n\n" +
        sellerBooksStoreText("disconnectWarning"),
        sellerBooksStoreText("disconnectTitle")
    );

    if(!confirmed) return;

    try{
        const {data,error} = await sellerBooksSupabase.rpc(
            "sellerbooks_api_disconnect_marketplace",
            {
                p_connection_id: connection.id,
                p_store_id: String(store.id),
                /*
                   sellerbooks_api_connections memakai marketplace_id
                   kanonik konektor (contoh: "lazada", "tiktok"),
                   sedangkan store.marketplaceId adalah ID marketplace
                   milik user (contoh: "marketplace_...").
                   Gunakan ID dari row koneksi yang sudah ditemukan
                   oleh getStoreIntegrationConnection().
                */
                p_marketplace_id: String(
                    connection.marketplace_id ||
                    sellerBooksCanonicalMarketplaceId(
                        store.marketplaceId,
                        marketplace.name
                    )
                )
            }
        );

        if(error) throw error;

        if(!data?.ok){
            throw new Error("Koneksi tidak berhasil dicopot.");
        }

        sellerBooksStoreConnectionsUserId = "";
        await refreshStoreIntegrationStates(true);

        sellerBooksAlert(
            (sellerBooksCurrentLanguage() === "en" ? "Integration for " : "Integrasi ") +
            marketplace.name +
            (sellerBooksCurrentLanguage() === "en" ? " was disconnected successfully." : " berhasil dicopot."),
            sellerBooksStoreText("disconnectTitle")
        );
    }catch(error){
        console.error("Copot integrasi gagal:",error);
        sellerBooksAlert(
            (sellerBooksCurrentLanguage() === "en"
                ? "Failed to disconnect integration.\n\n"
                : "Integrasi gagal dicopot.\n\n") +
            (error?.message ||
                (sellerBooksCurrentLanguage() === "en"
                    ? "A server error occurred."
                    : "Terjadi kesalahan pada server.")),
            sellerBooksStoreText("disconnectTitle")
        );
    }
}

async function sellerBooksEnsureCloudStore(store){
    const sessionResult = await sellerBooksSupabase.auth.getSession();
    const session = sessionResult?.data?.session;
    if(sessionResult?.error || !session?.user?.id || !session?.access_token){
        throw new Error(sellerBooksCurrentLanguage() === "en"
            ? "Session expired. Please sign in again."
            : "Sesi berakhir. Silakan login kembali.");
    }
    if(!store || !store.id || !store.marketplaceId || !String(store.name || "").trim()){
        throw new Error(sellerBooksCurrentLanguage() === "en"
            ? "Store data is incomplete."
            : "Data toko belum lengkap.");
    }
    const storeMarketplace = Array.isArray(marketplaces)
        ? marketplaces.find(item => String(item.id) === String(store.marketplaceId))
        : null;
    const canonicalMarketplaceId = sellerBooksCanonicalMarketplaceId(
        store.marketplaceId,
        storeMarketplace?.name || store.marketplace || ""
    );
    const row = {
        id: String(store.id),
        owner_user_id: session.user.id,
        marketplace_id: String(canonicalMarketplaceId),
        store_code: String(store.code || ""),
        store_name: String(store.name).trim(),
        description: String(store.description || ""),
        fee_percent: Number(store.feePercent || 0),
        status: String(store.status || "active").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        updated_at: new Date().toISOString()
    };
    const saved = await sellerBooksSupabase
        .from("sellerbooks_stores")
        .upsert(row, { onConflict: "owner_user_id,id" });
    if(saved.error) throw saved.error;
    return session;
}

async function connectBlibliStoreManually(store, marketplace){
    const en = sellerBooksCurrentLanguage() === "en";
    const L = en ? {
        title:"Connect Blibli API",intro:"Enter your API Seller Key and store details from Blibli Seller Center to connect your store to SellerBooks.",
        sellerKey:"API Seller Key",storeCode:"Blibli Store Code",help:"How to connect",helpTitle:"How to Connect Blibli API",helpClose:"Close",
        username:"Seller Center Email Account",storeId:"Store ID",channelId:"Channel ID",
        note:"Credentials are saved securely and will not be displayed again.",
        consent:"I confirm these details are correct and agree to save them securely in SellerBooks MBI.",
        cancel:"Cancel",submit:"Save & Connect",required:"Complete all fields and confirm the checkbox. Nothing has been saved yet.",
        session:"SellerBooks session expired. Please sign in again.",create:"Could not create the Blibli API connection.",
        connected:"Blibli API connected successfully. No orders were imported. You can continue to the order-sync step next.",
        failed:"Blibli connection failed.",server:"Server error."
    } : {
        title:"Hubungkan API Blibli",intro:"Masukkan API Seller Key dan Kode Toko dari Seller Center Blibli agar SellerBooks dapat menghubungkan toko Anda.",
        sellerKey:"API Seller Key",storeCode:"Kode Toko Blibli",help:"Cara menghubungkan",helpTitle:"Cara Menghubungkan API Blibli",helpClose:"Tutup",
        username:"Email Akun Seller Center",storeId:"Store ID",channelId:"Channel ID",
        note:"Kredensial disimpan dengan aman dan tidak akan ditampilkan kembali.",
        consent:"Saya memastikan data sudah benar dan setuju menyimpannya dengan aman pada SellerBooks MBI.",
        cancel:"Batal",submit:"Simpan & Hubungkan",required:"Lengkapi semua kolom dan centang persetujuan. Belum ada data yang disimpan.",
        session:"Sesi SellerBooks kedaluwarsa. Silakan login kembali.",create:"Tidak bisa membuat koneksi API Blibli.",
        connected:"API Blibli berhasil terhubung. Belum ada pesanan yang diimpor. Berikutnya kita lanjutkan tahap pengambilan pesanan.",
        failed:"Koneksi Blibli gagal.",server:"Terjadi kesalahan server."
    };
    const credentials = await new Promise(resolve => {
        document.getElementById("sellerbooks-blibli-modal")?.remove();
        if(!document.getElementById("sellerbooks-blibli-modal-style")){
            const style = document.createElement("style");
            style.id = "sellerbooks-blibli-modal-style";
            style.textContent = ".sb-blibli-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,15,30,.68);backdrop-filter:blur(5px);font-family:inherit}.sb-blibli-dialog{width:min(680px,100%);max-height:92vh;overflow:auto;background:var(--card-bg,#fff);color:var(--text-color,#172033);border:1px solid rgba(120,135,160,.25);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.3);animation:sbBlibliIn .18s ease-out}.sb-blibli-header{display:flex;align-items:flex-start;gap:13px;padding:22px 24px 17px;border-bottom:1px solid rgba(120,135,160,.2)}.sb-blibli-mark{flex:0 0 42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#e7f7ed;color:#087b42;font-size:22px;font-weight:800}.sb-blibli-heading{flex:1;min-width:0}.sb-blibli-heading h2{margin:1px 0 7px;font-size:20px;line-height:1.3;font-weight:750}.sb-blibli-heading p{margin:0;font-size:13px;line-height:1.55;opacity:.76}.sb-blibli-close{border:0;background:transparent;color:inherit;opacity:.65;font-size:28px;cursor:pointer}.sb-blibli-help-trigger{display:inline-flex;align-items:center;gap:7px;margin:0 0 16px;border:1px solid #bfdbfe;border-radius:9px;padding:9px 12px;background:#eff6ff;color:#1d4ed8;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.sb-blibli-help-overlay{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,15,30,.72);backdrop-filter:blur(4px)}.sb-blibli-help-dialog{width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;color:#172033;border-radius:17px;box-shadow:0 24px 80px rgba(0,0,0,.35)}.sb-blibli-help-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:12px;padding:17px 20px;background:#fff;border-bottom:1px solid #e2e8f0}.sb-blibli-help-head h3{flex:1;margin:0;font-size:18px}.sb-blibli-help-head button{border:0;background:#eef2f7;border-radius:8px;padding:7px 11px;cursor:pointer}.sb-blibli-help-body{padding:18px 22px 22px}.sb-blibli-help-body ol{padding-left:23px;margin:0 0 18px}.sb-blibli-help-body li{padding-left:4px;margin:0 0 11px;line-height:1.5;font-size:14px}.sb-blibli-example{display:block;width:100%;height:auto;border:1px solid #dbe2ea;border-radius:10px;margin-top:12px;background:#f8fafc}.sb-blibli-form{padding:20px 24px 24px}.sb-blibli-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sb-blibli-grid label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:650}.sb-blibli-grid input{width:100%;min-width:0;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;background:var(--input-bg,#fff);color:var(--text-color,#172033);padding:11px 12px;font:inherit;font-size:14px;outline:none}.sb-blibli-grid input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.13)}.sb-blibli-full{grid-column:1/-1}.sb-blibli-secure{display:flex;gap:9px;margin-top:17px;padding:11px 12px;border-radius:10px;background:rgba(16,185,129,.09);font-size:12px;line-height:1.45}.sb-blibli-consent{display:flex;align-items:flex-start;gap:9px;margin-top:15px;font-size:12px;line-height:1.5;cursor:pointer}.sb-blibli-consent input{margin-top:3px;accent-color:#2563eb}.sb-blibli-error{display:none;margin-top:12px;padding:10px 12px;border-radius:9px;background:#fff1f2;color:#be123c;font-size:12px}.sb-blibli-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.sb-blibli-actions button{border:0;border-radius:10px;padding:11px 16px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.sb-blibli-cancel{background:#e8edf5;color:#263247}.sb-blibli-submit{background:#1459d9;color:#fff}.sb-blibli-submit:disabled{opacity:.65;cursor:wait}@keyframes sbBlibliIn{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:560px){.sb-blibli-overlay{padding:9px}.sb-blibli-dialog{border-radius:15px;max-height:95vh}.sb-blibli-header{padding:17px 15px 13px}.sb-blibli-form{padding:15px}.sb-blibli-grid{grid-template-columns:1fr;gap:12px}.sb-blibli-full{grid-column:auto}.sb-blibli-heading h2{font-size:18px}.sb-blibli-actions button{flex:1}}";
            document.head.appendChild(style);
        }
        const modal = document.createElement("div");
        modal.id = "sellerbooks-blibli-modal";
        modal.className = "sb-blibli-overlay";
        modal.innerHTML = "<section class=\"sb-blibli-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"sb-blibli-title\"><header class=\"sb-blibli-header\"><div class=\"sb-blibli-mark\">B</div><div class=\"sb-blibli-heading\"><h2 id=\"sb-blibli-title\">"+L.title+"</h2><p>"+L.intro+"</p></div><button type=\"button\" class=\"sb-blibli-close\" aria-label=\""+L.cancel+"\">×</button></header><form class=\"sb-blibli-form\"><button type=\"button\" class=\"sb-blibli-help-trigger\">ⓘ "+L.help+"</button><div class=\"sb-blibli-grid\"><label>"+L.sellerKey+"<input name=\"sellerKey\" type=\"password\" autocomplete=\"new-password\" required placeholder=\""+(en?"Enter the API password you generated":"Masukkan sandi API yang sudah dibuat")+"\" /></label><label>"+L.storeCode+"<input name=\"storeCode\" required placeholder=\"" +(en?"Enter your Blibli store code":"Masukkan kode toko Blibli")+"\" /></label><label>"+L.username+"<input name=\"username\" autocomplete=\"username\" required /></label><label>"+L.storeId+"<input name=\"storeId\" required value=\"10001\" /></label><label class=\"sb-blibli-full\">"+L.channelId+"<input name=\"channelId\" required value=\"SellerBooks MBI\" /></label></div><div class=\"sb-blibli-secure\"><span aria-hidden=\"true\">🔒</span><span>"+L.note+"</span></div><label class=\"sb-blibli-consent\"><input name=\"consent\" type=\"checkbox\" required /><span>"+L.consent+"</span></label><div class=\"sb-blibli-error\" role=\"alert\" aria-live=\"polite\"></div><footer class=\"sb-blibli-actions\"><button type=\"button\" class=\"sb-blibli-cancel\">"+L.cancel+"</button><button type=\"submit\" class=\"sb-blibli-submit\">"+L.submit+"</button></footer></form></section>";
        document.body.appendChild(modal);
        const helpButton = modal.querySelector(".sb-blibli-help-trigger");
        helpButton.addEventListener("click", () => {
            document.getElementById("sellerbooks-blibli-help")?.remove();
            const help = document.createElement("div");
            help.id = "sellerbooks-blibli-help";
            help.className = "sb-blibli-help-overlay";
            const steps = en ? [
                "Log in to your Blibli Seller Center.",
                "Open your profile and find Seller API Settings.",
                "Under Connect Manually, create an API password by clicking Create.",
                "Scroll down to Connect API Client, enter <strong><code>mta-api-adiimasadistribu-6e304</code></strong> without quotation marks, then click Connect.",
                "Copy the store code and API password into the matching fields in SellerBooks.",
                "Enter the username/email used for your Blibli Seller Center store.",
                "Leave Store ID and Channel ID at their default values. Do not change them.",
                "Tick the consent checkbox and click Save & Connect."
            ] : [
                "Login pada Seller Center Blibli Anda.",
                "Masuk ke profil dan cari Pengaturan Seller API.",
                "Pada Hubungkan manual, atur kata sandi API dengan cara klik Buat.",
                "Lalu scroll ke bawah, pada Hubungkan API Klien salin kode <strong><code>mta-api-adiimasadistribu-6e304</code></strong> dan paste pada kolom, lalu klik Hubungkan.",
                "Salin kode toko dan kata sandi API ke kolom yang tersedia di SellerBooks.",
                "Masukkan username/email toko Blibli Anda.",
                "Store ID dan Channel ID biarkan default, jangan dirubah.",
                "Centang persetujuan, lalu klik Simpan & Hubungkan."
            ];
            const example = '<img class="sb-blibli-example" src="/contoh-api-blibli.png?v=20261015" alt="' + (en ? "Blibli Seller Center API settings screenshot" : "Screenshot pengaturan API Seller Center Blibli") + '" loading="lazy" />';
            help.innerHTML = "<section class=\"sb-blibli-help-dialog\" role=\"dialog\" aria-modal=\"true\"><header class=\"sb-blibli-help-head\"><h3>" + L.helpTitle + "</h3><button type=\"button\" class=\"sb-blibli-help-close\">" + L.helpClose + "</button></header><div class=\"sb-blibli-help-body\"><ol>" + steps.map(step => "<li>" + step + "</li>").join("") + "</ol><strong>" + (en ? "Seller Center API settings example" : "Contoh tampilan pengaturan API Seller Center") + "</strong>" + example + "</div></section>";
            document.body.appendChild(help);
            const closeHelp = () => help.remove();
            help.querySelector(".sb-blibli-help-close").addEventListener("click", closeHelp);
            help.addEventListener("click", event => { if (event.target === help) closeHelp(); });
        });
        const form = modal.querySelector("form");
        form.noValidate = true; // Use SellerBooks-localized validation messages instead of browser-language tooltips.
        let settled = false;
        const finish = value => { if(settled)return; settled=true; document.removeEventListener("keydown",onKey); modal.remove(); resolve(value); };
        const onKey = event => { if(event.key==="Escape") finish(null); };
        document.addEventListener("keydown",onKey);
        modal.querySelector(".sb-blibli-close").addEventListener("click",()=>finish(null));
        modal.querySelector(".sb-blibli-cancel").addEventListener("click",()=>finish(null));
        modal.addEventListener("click",event=>{if(event.target===modal)finish(null);});
        form.addEventListener("submit",event=>{
            event.preventDefault();
            const d=new FormData(form);
            const values={api_seller_key:String(d.get("sellerKey")||"").trim(),store_code:String(d.get("storeCode")||"").trim(),username:String(d.get("username")||"").trim(),store_id:String(d.get("storeId")||"").trim(),channel_id:String(d.get("channelId")||"").trim()};
            const error=modal.querySelector(".sb-blibli-error");
            if(Object.values(values).some(v=>!v)||!d.get("consent")){error.textContent=L.required;error.style.display="block";return;}
            finish(values);
        });
        modal.querySelector('input[name="sellerKey"]').focus();
    });
    if(!credentials)return;
    try{
        const sessionResult=await sellerBooksSupabase.auth.getSession();
        const session=sessionResult?.data?.session;
        if(sessionResult?.error||!session?.access_token)throw new Error(L.session);
        // Mirror the authenticated owner's store into the relational table before creating its API connection.
        await sellerBooksEnsureCloudStore(store);
        const canonicalMarketplaceId = sellerBooksCanonicalMarketplaceId(
            store.marketplaceId,
            marketplace.name || "Blibli"
        );
        const upsert=await sellerBooksSupabase.rpc("sellerbooks_api_upsert_connection",{
            p_store_id:String(store.id),
            p_marketplace_id:String(canonicalMarketplaceId),
            p_marketplace:String(marketplace.name||"Blibli")
        });
        if(upsert.error)throw upsert.error;
        const connection=Array.isArray(upsert.data)?upsert.data[0]:upsert.data;
        if(!connection?.id)throw new Error(L.create);
        const saved=await sellerBooksSupabase.rpc("sellerbooks_api_set_secret",{p_connection_id:String(connection.id),p_secret:JSON.stringify(credentials)});
        if(saved.error)throw saved.error;
        const response=await fetch(SELLERBOOKS_SUPABASE_URL+"/functions/v1/sellerbooks-blibli-test-connection",{method:"POST",headers:{apikey:SELLERBOOKS_SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({connection_id:String(connection.id)})});
        const result=await response.json().catch(()=>({}));
        await refreshStoreIntegrationStates(true);
        if(!response.ok||!result.ok)throw new Error(result.error||(en?"Blibli connection test failed.":"Tes koneksi Blibli gagal."));
        sellerBooksAlert(L.connected,sellerBooksStoreText("connectTitle"));
    }catch(error){
        console.error("Koneksi Blibli gagal:",error);
        await refreshStoreIntegrationStates(true).catch(()=>{});
        sellerBooksAlert(L.failed+"\n\n"+(error?.message||L.server),sellerBooksStoreText("connectTitle"));
    }
}
async function integrateStoreAccount(storeId){

    const store = stores.find(function(item){
        return String(item.id) === String(storeId);
    });

    if(!store){
        sellerBooksAlert(sellerBooksStoreText("storeNotFound"),sellerBooksStoreText("connectTitle"));
        return;
    }

    const marketplace = marketplaces.find(function(item){
        return item.id === store.marketplaceId;
    });

    if(!marketplace){
        sellerBooksAlert(sellerBooksStoreText("marketplaceNotFound"),sellerBooksStoreText("connectTitle"));
        return;
    }

    const initialMarketplaceKey = String(marketplace.name || "").toLowerCase().replace(/\\s+/g,"");
    if(initialMarketplaceKey.includes("blibli")){
        await connectBlibliStoreManually(store, marketplace);
        return;
    }

    /*
       UNIVERSAL MARKETPLACE OAUTH - SESSION BRIDGE
       ------------------------------------------------
       OAuth INIT sekarang dijalankan DI WEBVIEW/halaman SellerBooks
       yang sedang login, bukan di browser tujuan.

       Browser eksternal hanya menerima authorization_url dari backend
       dan menangani login/consent marketplace.

       Dengan pola ini:
       - Chrome tidak perlu login SellerBooks.
       - WebView Windows tetap menjadi sumber session SellerBooks.
       - APK Android tetap menjadi sumber session SellerBooks.
       - Semua marketplace memakai lifecycle init -> browser -> callback
         yang sama; adapter OAuth provider tetap berbeda di backend.
    */
    const providerMap = {
        tiktok:  "sellerbooks-tiktok-oauth",
        shopee:  "sellerbooks-shopee-oauth",
        lazada:  "sellerbooks-lazada-oauth"
    };

    const marketplaceKey = String(marketplace.name || "")
        .toLowerCase()
        .replace(/\s+/g,"")
        .replace(/shop$/,"shop");

    let endpoint = "";

    if(marketplaceKey.includes("tiktok")){
        endpoint = providerMap.tiktok;
    }else if(marketplaceKey.includes("shopee")){
        endpoint = providerMap.shopee;
    }else if(marketplaceKey.includes("lazada")){
        endpoint = providerMap.lazada;
    }

    /*
       TikTok Shop, Shopee, dan Lazada memakai lifecycle OAuth yang sama.
       Shopee menggunakan Edge Function sellerbooks-shopee-oauth yang sudah ada.
       Marketplace lain tetap menampilkan popup "Segera Hadir".
    */
    if(!endpoint){
        sellerBooksAlert(
            sellerBooksStoreText("integrationUnavailable")
                .replace("{marketplace}", String(marketplace.name || "marketplace")),
            sellerBooksStoreText("soonTitle")
        );
        return;
    }

    /*
       WAJIB buka window secara sinkron dari klik user.
       Setelah itu kita boleh menunggu auth.getSession() dan backend init.
       Popup sementara tetap berada pada launcher/loading page.
    */
    const launcherUrl = new URL(
        "marketplace-oauth-launcher.html" +
        "?v=20260930-session-bridge" +
        "&store_id=" + encodeURIComponent(String(store.id)) +
        "&marketplace_id=" + encodeURIComponent(String(store.marketplaceId || "")) +
        "&marketplace_name=" + encodeURIComponent(String(marketplace.name || "")) +
        "&handoff=pending",
        window.location.href
    ).href;

    /*
       WINDOWS ADMIN:
       Jangan membuka launcher di dalam WebView lalu mencoba memindahkannya
       setelah await. WebView2 dapat mengembalikan WindowProxy kosong setelah
       NewWindowRequested diambil alih native. Untuk aplikasi Windows, URL
       OAuth final dikirim langsung ke host native melalui WebView2 message.

       Browser biasa tetap memakai popup launcher seperti sebelumnya.
    */
    const isSellerBooksWindowsApp =
        /SellerBooksAdmin\/1\.0/i.test(navigator.userAgent.replace(/\s+/g,""));

    /*
       ANDROID APK:
       MainActivity sudah menangani URL OAuth marketplace secara native
       dan membukanya dengan browser eksternal melalui ACTION_VIEW.
       Jangan membuka marketplace-oauth-launcher.html dengan window.open()
       di Android karena setSupportMultipleWindows(false) membuat window.open()
       dapat menggantikan halaman SellerBooks saat init masih menunggu.
       Akibatnya launcher akan berhenti di "Menyiapkan halaman otorisasi".
    */
    const isSellerBooksAndroidApp =
        /SellerBooksAPK\/1\.0/i.test(navigator.userAgent.replace(/\s+/g,""));

    let oauthTab = null;

    if(!isSellerBooksWindowsApp && !isSellerBooksAndroidApp){        const popupWidth = 520;
        const popupHeight = 760;
        const screenLeft = typeof window.screenLeft === "number" ? window.screenLeft : window.screenX;
        const screenTop = typeof window.screenTop === "number" ? window.screenTop : window.screenY;
        const outerWidth = window.outerWidth || window.innerWidth;
        const outerHeight = window.outerHeight || window.innerHeight;

        const popupLeft = Math.max(0, screenLeft + Math.round((outerWidth - popupWidth) / 2));
        const popupTop = Math.max(0, screenTop + Math.round((outerHeight - popupHeight) / 2));

        oauthTab = window.open(
            launcherUrl,
            "SellerBooksMarketplaceOAuth",
            [
                "popup=yes",
                "width=" + popupWidth,
                "height=" + popupHeight,
                "left=" + popupLeft,
                "top=" + popupTop,
                "resizable=yes",
                "scrollbars=yes"
            ].join(",")
        );

        if(!oauthTab){
            sellerBooksAlert(
                "Popup/tab baru diblokir browser. Silakan izinkan pop-up untuk SellerBooks lalu klik Integrasikan Akun lagi.",
                "Integrasikan Akun"
            );
            return;
        }
    }

    try{
        /*
           Session SellerBooks diambil dari client Supabase yang hidup
           di halaman asal. TIDAK membaca localStorage Chrome.
        */
        const sessionResult = await sellerBooksSupabase.auth.getSession();
        const session = sessionResult?.data?.session;

        if(!session?.access_token){
            throw new Error("Sesi SellerBooks tidak tersedia. Silakan login kembali.");
        }

        const response = await fetch(
            SELLERBOOKS_SUPABASE_URL +
            "/functions/v1/" + endpoint +
            "?action=init",
            {
                method:"POST",
                headers:{
                    "apikey":SELLERBOOKS_SUPABASE_KEY,
                    "Authorization":"Bearer " + session.access_token,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    store_id:String(store.id),
                    marketplace_id:String(store.marketplaceId || ""),
                    marketplace_name:String(marketplace.name || "")
                })
            }
        );

        const data = await response.json().catch(function(){ return {}; });

        if(!response.ok || !data.authorization_url){
            throw new Error(
                data.error ||
                ("OAuth " + String(marketplace.name || "Marketplace") + " tidak dapat dimulai.")
            );
        }

        /*
           Inilah handoff sebenarnya:
           authorization_url sudah dibuat oleh backend menggunakan
           session SellerBooks dari WEBVIEW.

           Browser eksternal tidak perlu mengetahui access token SellerBooks.
        */
        if(isSellerBooksWindowsApp){
            /*
               Handoff native Windows:
               - Jangan buka authorization_url langsung dari native host.
               - Native host membuka SATU browser window kecil berisi
                 marketplace-oauth-launcher.html.
               - Launcher kemudian location.replace() ke authorization_url,
                 sehingga login marketplace tetap berada pada TAB YANG SAMA.
               - Tidak ada fallback window.open(), ACK timer, Alt+F4/Ctrl+W,
                 atau pembunuhan proses browser.
            */
            if(window.chrome?.webview?.postMessage){
                const launcherUrl =
                    "https://sellerbooks.github.io/marketplace-oauth-launcher.html" +
                    "?handoff=windows" +
                    "&marketplace_name=" + encodeURIComponent(String(marketplace.name || "")) +
                    "&authorization_url=" + encodeURIComponent(String(data.authorization_url));

                window.chrome.webview.postMessage(JSON.stringify({
                    type:"sellerbooks.oauth.launch",
                    marketplace:String(marketplace.name || ""),
                    authorization_url:String(data.authorization_url),
                    launcher_url:launcherUrl
                }));
            }else{
                throw new Error("Bridge native SellerBooks Admin tidak tersedia. Silakan gunakan build SellerBooks Admin terbaru.");
            }
        }else if(isSellerBooksAndroidApp){
            /*
               Handoff native Android:
               MainActivity.shouldOverrideUrlLoading() akan menangkap URL
               OAuth marketplace ini lalu membuka browser eksternal dengan
               ACTION_VIEW. SellerBooks session tetap tinggal di WebView APK.
            */
            window.location.href = data.authorization_url;
        }else if(oauthTab && !oauthTab.closed){
            oauthTab.location.replace(data.authorization_url);
        }

    }catch(error){
        console.error("Marketplace OAuth init gagal:",error);

        try{
            if(oauthTab && !oauthTab.closed){
                oauthTab.close();
            }
        }catch(e){}

        sellerBooksAlert(
            "Integrasi " + String(marketplace.name || "Marketplace") +
            " gagal dimulai.\n\n" +
            (error?.message || "Terjadi kesalahan saat menyiapkan OAuth."),
            "Integrasikan Akun"
        );
    }
}


let sellerBooksExcelDispatchRunning=false;
let sellerBooksExcelDispatchRerunRequested=false;
let sellerBooksExcelDispatchRerunShowResult=false;

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

function sellerBooksSetPullOrderBusy(storeId,busy,marketplace){
    const id=String(storeId||"");
    const name=String(marketplace||"").toLowerCase();
    const selector='button[onclick*="syncTikTokOrdersNow"],button[onclick*="syncShopeeOrdersNow"],button[onclick*="syncLazadaOrdersNow"],button[onclick*="syncBlibliOrdersNow"]';
    document.querySelectorAll(selector).forEach(function(button){
        const handler=String(button.getAttribute("onclick")||"").toLowerCase();
        if(id && !handler.includes(id.toLowerCase()))return;
        if(name && !handler.includes(name.toLowerCase()))return;
        if(busy){
            if(button.dataset.sellerbooksPullBusy==="true")return;
            button.dataset.sellerbooksPullBusy="true";
            button.dataset.sellerbooksPullOriginalText=button.textContent||"";
            button.dataset.sellerbooksPullWasDisabled=button.disabled?"true":"false";
            button.disabled=true;
            button.setAttribute("aria-busy","true");
            button.textContent=sellerBooksPullOrderIsEN()?"Fetching & saving…":"Sedang mengambil & menyimpan…";
        }else if(button.dataset.sellerbooksPullBusy==="true"){
            button.disabled=button.dataset.sellerbooksPullWasDisabled==="true";
            button.textContent=button.dataset.sellerbooksPullOriginalText||button.textContent;
            button.removeAttribute("aria-busy");
            delete button.dataset.sellerbooksPullBusy;
            delete button.dataset.sellerbooksPullOriginalText;
            delete button.dataset.sellerbooksPullWasDisabled;
        }
    });
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

async function syncTikTokOrdersNowInternal(storeId){
    const store=stores.find(function(item){
        return String(item.id)===String(storeId);
    });

    if(!store){
        sellerBooksAlert(
            sellerBooksPullOrderText("missingStore","TikTok"),
            sellerBooksPullOrderText("loadingTitle","TikTok")
        );
        return;
    }

    const connection=getStoreIntegrationConnection(store);

    if(
        !connection ||
        String(connection.connection_status||"").toUpperCase()!=="CONNECTED"
    ){
        sellerBooksAlert(
            sellerBooksPullOrderText("notConnected","TikTok"),
            sellerBooksPullOrderText("loadingTitle","TikTok")
        );
        return;
    }

    try{
        sellerBooksSetPullOrderBusy(storeId,true,"TikTok");
        sellerBooksAlert(
            sellerBooksPullOrderText("loading","TikTok"),
            sellerBooksPullOrderText("loadingTitle","TikTok")
        );

        const sessionResult=
            await sellerBooksSupabase.auth.getSession();

        const session=sessionResult?.data?.session;

        if(!session?.access_token){
            throw new Error(
                sellerBooksPullOrderText("noSession","TikTok")
            );
        }

        const now=Math.floor(Date.now()/1000);
        const timeFrom=now-(7*24*60*60);

        const response=await fetch(
            SELLERBOOKS_SUPABASE_URL+
            "/functions/v1/sellerbooks-tiktok-sync-orders",
            {
                method:"POST",
                headers:{
                    "apikey":SELLERBOOKS_SUPABASE_KEY,
                    "Authorization":"Bearer "+session.access_token,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    connection_id:String(connection.id),
                    store_id:String(store.id),
                    time_from:timeFrom,
                    time_to:now
                })
            }
        );

        const data=await response.json().catch(function(){
            return {};
        });

        if(!response.ok||!data.ok){
            let message=
                data.error ||
                sellerBooksPullOrderText("failedFetch","TikTok");

            if(data.diagnostic){
                message+=
                    "\n\nDIAGNOSTIC:\n"+
                    JSON.stringify(
                        data.diagnostic,
                        null,
                        2
                    );
            }

            throw new Error(message);
        }

        const result=Array.isArray(data.results)
            ? data.results.find(function(x){
                return String(x.connection_id||"")===
                    String(connection.id);
            })||data.results[0]
            : null;

        if(!result){
            throw new Error(
                sellerBooksPullOrderText("noFile","TikTok")
            );
        }

        if(result.status==="ERROR"){
            throw new Error(
                String(
                    result.error||
                    sellerBooksPullOrderText("apiError","TikTok")
                )
            );
        }

        if(result.status==="NO_ORDERS"){
            sellerBooksAlert(
                sellerBooksPullOrderText("noOrders","TikTok",Number(result.orders_found||0)),
                sellerBooksPullOrderText("resultTitle","TikTok")
            );
            return;
        }

        if(result.status==="RAW_FILE_READY"){
            await sellerBooksDispatchExcelQueue({showResult:true});
            return;
        }

        sellerBooksAlert(
            sellerBooksPullOrderText("status","TikTok")+
            String(result.status||"UNKNOWN"),
            sellerBooksPullOrderText("resultTitle","TikTok")
        );

    }catch(error){
        console.error(
            "Tarik order TikTok gagal:",
            error
        );

        sellerBooksAlert(
            sellerBooksPullOrderText("failedOrders","TikTok")+"\n\n"+
            (error?.message||
                sellerBooksPullOrderText("unexpected","TikTok")),
            sellerBooksPullOrderText("loadingTitle","TikTok")
        );
    }
}
async function syncTikTokOrdersNow(storeId){
    const key=String(storeId||"");
    if(window.__sellerBooksPullBusyStore===key && key)return;
    window.__sellerBooksPullBusyStore=key;
    const store=stores.find(function(item){return String(item.id)===key;});
    try{
        return await syncTikTokOrdersNowInternal(storeId);
    }finally{
        sellerBooksSetPullOrderBusy(storeId,false,"TikTok");
        if(window.__sellerBooksPullBusyStore===key)window.__sellerBooksPullBusyStore=null;
    }
}


/* =====================================================
   TARIK ORDER SHOPEE
   Mengikuti pola session -> Edge Function -> hasil sync.
   Tidak menyentuh mesin TikTok.
===================================================== */

async function syncShopeeOrdersNowInternal(storeId){
    const store=stores.find(item=>String(item.id)===String(storeId));
    if(!store){sellerBooksAlert(sellerBooksPullOrderText("missingStore","Shopee"),"Tarik Order Shopee");return;}
    const marketplace=marketplaces.find(item=>item.id===store.marketplaceId);
    if(!String(marketplace?.name||"").toLowerCase().replace(/\s+/g,"").includes("shopee")){sellerBooksAlert(sellerBooksPullOrderText("wrongMarketplace","Shopee"),"Tarik Order Shopee");return;}
    const connection=getStoreIntegrationConnection(store);
    if(!connection||String(connection.connection_status||"").toUpperCase()!=="CONNECTED"){sellerBooksAlert(sellerBooksPullOrderText("notConnected","Shopee"),"Tarik Order Shopee");return;}
    try{
        sellerBooksSetPullOrderBusy(storeId,true,"Shopee");
        sellerBooksAlert(sellerBooksPullOrderText("loading","Shopee"),sellerBooksPullOrderText("errorTitle","Shopee"));
        const session=(await sellerBooksSupabase.auth.getSession())?.data?.session;
        if(!session?.access_token)throw new Error(sellerBooksPullOrderText("noSession","Shopee"));
        const now=Date.now(),timeFrom=new Date(now-7*86400000).toISOString(),timeTo=new Date(now).toISOString();
        const response=await fetch(SELLERBOOKS_SUPABASE_URL+"/functions/v1/sellerbooks-shopee-sync-orders",{method:"POST",headers:{apikey:SELLERBOOKS_SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({connection_id:String(connection.id),store_id:String(store.id),time_from:timeFrom,time_to:timeTo})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.ok)throw new Error(data.error||sellerBooksPullOrderText("failedFetch","Shopee"));
        if(data.status==="NO_ORDERS"){sellerBooksAlert(sellerBooksPullOrderText("noOrders","Shopee",Number(data.orders_found||0)),sellerBooksPullOrderText("resultTitle","Shopee"));return;}
        if(data.status==="RAW_FILE_READY"){await sellerBooksDispatchExcelQueue({showResult:true});return;}
        throw new Error(sellerBooksPullOrderText("status","Shopee")+String(data.status||"UNKNOWN"));
    }catch(error){console.error("Tarik order Shopee gagal:",error);sellerBooksAlert(sellerBooksPullOrderText("failedOrders","Shopee")+"\n\n"+(error?.message||"Terjadi kesalahan."),sellerBooksPullOrderText("errorTitle","Shopee"));}
}
async function syncShopeeOrdersNow(storeId){
    const key=String(storeId||"");
    if(window.__sellerBooksPullBusyStore===key && key)return;
    window.__sellerBooksPullBusyStore=key;
    const store=stores.find(function(item){return String(item.id)===key;});
    try{
        return await syncShopeeOrdersNowInternal(storeId);
    }finally{
        sellerBooksSetPullOrderBusy(storeId,false,"Shopee");
        if(window.__sellerBooksPullBusyStore===key)window.__sellerBooksPullBusyStore=null;
    }
}


/* =====================================================
   TARIK ORDER LAZADA
   Mengikuti pola session -> Edge Function -> hasil sync.
   Tidak menyentuh mesin TikTok.
===================================================== */

async function syncLazadaOrdersNowInternal(storeId){
    const store=stores.find(item=>String(item.id)===String(storeId));
    if(!store){sellerBooksAlert(sellerBooksPullOrderText("missingStore","Lazada"),"Tarik Order Lazada");return;}
    const marketplace=marketplaces.find(item=>item.id===store.marketplaceId);
    if(!String(marketplace?.name||"").toLowerCase().replace(/\s+/g,"").includes("lazada")){sellerBooksAlert(sellerBooksPullOrderText("wrongMarketplace","Lazada"),"Tarik Order Lazada");return;}
    const connection=getStoreIntegrationConnection(store);
    if(!connection||String(connection.connection_status||"").toUpperCase()!=="CONNECTED"){sellerBooksAlert(sellerBooksPullOrderText("notConnected","Lazada"),"Tarik Order Lazada");return;}
    try{
        sellerBooksSetPullOrderBusy(storeId,true,"Lazada");
        sellerBooksAlert(sellerBooksPullOrderText("loading","Lazada"),sellerBooksPullOrderText("errorTitle","Lazada"));
        const session=(await sellerBooksSupabase.auth.getSession())?.data?.session;
        if(!session?.access_token)throw new Error(sellerBooksPullOrderText("noSession","Lazada"));
        const now=Math.floor(Date.now()/1000),timeFrom=now-7*86400,timeTo=now;
        const response=await fetch(SELLERBOOKS_SUPABASE_URL+"/functions/v1/sellerbooks-lazada-sync-orders",{method:"POST",headers:{apikey:SELLERBOOKS_SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({connection_id:String(connection.id),store_id:String(store.id),time_from:timeFrom,time_to:timeTo})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.ok)throw new Error(data.error||sellerBooksPullOrderText("failedFetch","Lazada"));
        const result=Array.isArray(data.results)?data.results.find(x=>String(x.connection_id||"")===String(connection.id))||data.results[0]:null;
        if(!result)throw new Error(sellerBooksPullOrderText("noFile","Lazada"));
        if(result.status==="ERROR")throw new Error(String(result.error||sellerBooksPullOrderText("apiError","Lazada")));
        if(result.status==="NO_ORDERS"){sellerBooksAlert(sellerBooksPullOrderText("noOrders","Lazada",Number(result.orders_found||0)),sellerBooksPullOrderText("resultTitle","Lazada"));return;}
        if(result.status==="RAW_FILE_READY"){await sellerBooksDispatchExcelQueue({showResult:true});return;}
        throw new Error(sellerBooksPullOrderText("status","Lazada")+String(result.status||"UNKNOWN"));
    }catch(error){console.error("Tarik order Lazada gagal:",error);sellerBooksAlert(sellerBooksPullOrderText("failedOrders","Lazada")+"\n\n"+(error?.message||"Terjadi kesalahan."),sellerBooksPullOrderText("errorTitle","Lazada"));}
}
async function syncLazadaOrdersNow(storeId){
    const key=String(storeId||"");
    if(window.__sellerBooksPullBusyStore===key && key)return;
    window.__sellerBooksPullBusyStore=key;
    const store=stores.find(function(item){return String(item.id)===key;});
    try{
        return await syncLazadaOrdersNowInternal(storeId);
    }finally{
        sellerBooksSetPullOrderBusy(storeId,false,"Lazada");
        if(window.__sellerBooksPullBusyStore===key)window.__sellerBooksPullBusyStore=null;
    }
}


/* =====================================================
   TARIK ORDER BLIBLI
   Adapter Blibli terpisah; data mentah masuk antrean impor
   yang sama dan tetap diproses oleh mesin Import Penjualan.
===================================================== */
async function syncBlibliOrdersNowInternal(storeId){
    const store=stores.find(item=>String(item.id)===String(storeId));
    if(!store){sellerBooksAlert(sellerBooksPullOrderText("missingStore","Blibli"),sellerBooksPullOrderText("loadingTitle","Blibli"));return;}
    const marketplace=marketplaces.find(item=>item.id===store.marketplaceId);
    if(!String(marketplace?.name||"").toLowerCase().replace(/\s+/g,"").includes("blibli")){sellerBooksAlert(sellerBooksPullOrderText("wrongMarketplace","Blibli"),sellerBooksPullOrderText("loadingTitle","Blibli"));return;}
    const connection=getStoreIntegrationConnection(store);
    if(!connection||String(connection.connection_status||"").toUpperCase()!=="CONNECTED"){sellerBooksAlert(sellerBooksPullOrderText("notConnected","Blibli"),sellerBooksPullOrderText("loadingTitle","Blibli"));return;}
    try{
        sellerBooksSetPullOrderBusy(storeId,true,"Blibli");
        sellerBooksAlert(sellerBooksPullOrderText("loading","Blibli"),sellerBooksPullOrderText("loadingTitle","Blibli"));
        const session=(await sellerBooksSupabase.auth.getSession())?.data?.session;
        if(!session?.access_token)throw new Error(sellerBooksPullOrderText("noSession","Blibli"));
        const now=Math.floor(Date.now()/1000),timeFrom=now-7*86400,timeTo=now;
        const response=await fetch(SELLERBOOKS_SUPABASE_URL+"/functions/v1/sellerbooks-blibli-sync-orders",{method:"POST",headers:{apikey:SELLERBOOKS_SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({connection_id:String(connection.id),store_id:String(store.id),time_from:timeFrom,time_to:timeTo})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.ok)throw new Error(data.error||sellerBooksPullOrderText("failedFetch","Blibli"));
        if(data.status==="NO_ORDERS"){sellerBooksAlert(sellerBooksPullOrderText("noOrders","Blibli",Number(data.orders_found||0)),sellerBooksPullOrderText("resultTitle","Blibli"));return;}
        if(data.status==="RAW_FILE_READY"){await sellerBooksDispatchExcelQueue({showResult:true});return;}
        throw new Error(sellerBooksPullOrderText("status","Blibli")+String(data.status||"UNKNOWN"));
    }catch(error){console.error("Tarik order Blibli gagal:",error);sellerBooksAlert(sellerBooksPullOrderText("failedOrders","Blibli")+"\n\n"+(error?.message||"Terjadi kesalahan."),sellerBooksPullOrderText("loadingTitle","Blibli"));}
}
async function syncBlibliOrdersNow(storeId){
    const key=String(storeId||"");
    if(window.__sellerBooksPullBusyStore===key && key)return;
    window.__sellerBooksPullBusyStore=key;
    try{
        return await syncBlibliOrdersNowInternal(storeId);
    }finally{
        sellerBooksSetPullOrderBusy(storeId,false,"Blibli");
        if(window.__sellerBooksPullBusyStore===key)window.__sellerBooksPullBusyStore=null;
    }
}

/* =====================================================
   HASIL OAUTH SHOPEE
===================================================== */

function handleShopeeOAuthResult(){

    const params = new URLSearchParams(window.location.search);

    const result = params.get("sellerbooks_shopee_oauth");

    if(!result) return;

    if(result === "success"){

        sellerBooksIntegrationRealtimeSuppressMarketplace("shopee");

        sellerBooksAlert(
            "Akun Shopee berhasil terhubung ke SellerBooks.",
            "Integrasikan Akun"
        );

        try{

            window.history.replaceState(
                {},
                document.title,
                window.location.pathname + window.location.hash
            );

        }catch(e){}

        if(typeof loadStores === "function"){

            setTimeout(function(){

                loadStores();

            },300);

        }else if(typeof renderStores === "function"){

            setTimeout(function(){

                renderStores();

            },300);

        }

        return;

    }

    const reason = params.get("reason") || "OAUTH_FAILED";

    sellerBooksAlert(
        "Integrasi Shopee gagal.\n\n" +
        "Kode: " + reason,
        "Integrasikan Akun"
    );

    try{

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.hash
        );

    }catch(e){}

}


/* =====================================================
   CEK HASIL OAUTH SAAT HALAMAN DIBUKA
===================================================== */

/* =====================================================
   HASIL OAUTH MARKETPLACE DARI POPUP
   Mekanisme diseragamkan mengikuti alur TikTok Shop
   yang sudah terbukti realtime + tombol Copot berjalan.
===================================================== */

if(!window.sellerBooksMarketplaceOAuthMessageHandler){

    window.sellerBooksMarketplaceOAuthMessageHandler = true;

    window.addEventListener("message", function(event){

        if(event.origin !== window.location.origin){
            return;
        }

        const data = event.data || {};
        const source = String(data.source || "");

        const marketplaceMatch =
            source.match(/^sellerbooks-(tiktok|shopee|lazada|toco|tokopedia|blibli)-oauth$/i);

        if(!marketplaceMatch){
            return;
        }

        const marketplace =
            String(marketplaceMatch[1] || "").toLowerCase();

        const labels = {
            tiktok:"TikTok Shop",
            shopee:"Shopee",
            lazada:"Lazada",
            toco:"Toco",
            tokopedia:"Tokopedia",
            blibli:"Blibli"
        };

        const marketplaceLabel =
            labels[marketplace] || "Marketplace";

        if(data.status === "success"){

            /*
               INI SENGAJA MENGIKUTI MEKANISME TIKTOK SHOP:
               1. Callback kirim hasil ke window utama.
               2. Langsung tampilkan notif sukses.
               3. Langsung sinkronkan status koneksi.
               4. Jika callback membawa connection_id, gunakan row
                  tersebut sebagai sumber kebenaran utama.
               5. Tetap jalankan refresh sebagai verifikasi/fallback.
            */

            sellerBooksAlert(
                "Akun " + marketplaceLabel +
                " berhasil terhubung ke SellerBooks.",
                "Integrasikan Akun"
            );

            if(data.connection_id){

                sellerBooksApplyOAuthConnectionState(
                    data.connection_id
                ).catch(function(error){
                    console.warn(
                        "Sinkronisasi OAuth " + marketplaceLabel + " gagal:",
                        error
                    );
                });

            }

            setTimeout(function(){

                sellerBooksStoreConnectionsUserId = "";

                refreshStoreIntegrationStates(true);

            },300);

            return;
        }

        const reason =
            String(data.reason || "OAUTH_FAILED");

        const alreadyConnectedReasons = {
            tiktok:"TIKTOK_ACCOUNT_ALREADY_CONNECTED",
            shopee:"SHOPEE_ACCOUNT_ALREADY_CONNECTED",
            lazada:"LAZADA_ACCOUNT_ALREADY_CONNECTED",
            toco:"TOCO_ACCOUNT_ALREADY_CONNECTED",
            tokopedia:"TOKOPEDIA_ACCOUNT_ALREADY_CONNECTED",
            blibli:"BLIBLI_ACCOUNT_ALREADY_CONNECTED"
        };

        if(reason === alreadyConnectedReasons[marketplace]){

            sellerBooksAlert(
                "Akun " + marketplaceLabel +
                " ini sudah terhubung ke akun atau toko SellerBooks lain.",
                "Integrasikan Akun"
            );

        }else{

            sellerBooksAlert(
                "Integrasi " + marketplaceLabel +
                " gagal.\n\nKode: " + reason,
                "Integrasikan Akun"
            );

        }

    });

}


/* =====================================================
   HASIL OAUTH SHOPEE/LINK LAMA
   Tetap dipanggil untuk kompatibilitas callback URL lama.
===================================================== */

handleShopeeOAuthResult();


/* =====================================================
   CALLBACK OAUTH DARI APK SELLERBOOKS
   Chrome -> OAuth -> APK -> WebView
===================================================== */

window.onMarketplaceOAuthReturn = function(marketplace, status, reason, connectionId){

    marketplace = String(marketplace || "").toLowerCase();
    status = String(status || "").toLowerCase();
    reason = String(reason || "");

    if(status === "success"){

        var marketplaceLabel =
            marketplace === "shopee" ? "Shopee" :
            marketplace === "tiktok" ? "TikTok Shop" :
            marketplace === "lazada" ? "Lazada" :
            marketplace || "Marketplace";

        const callbackStoreId =
            String(new URLSearchParams(window.location.search).get("store_id") || "");

        if(
            callbackStoreId &&
            marketplace
        ){
            sellerBooksIntegrationRealtimeSuppressSuccess(
                callbackStoreId,
                marketplace
            );
        }

        if(callbackStoreId && marketplace){
            sellerBooksMarkIntegrationSuccessNotice(
                callbackStoreId,
                marketplace
            );
        }

        /*
           Gunakan connection_id dari callback sebagai jalur langsung.
           Dengan ini kartu berubah segera setelah backend menyelesaikan
           OAuth, tanpa menunggu Realtime atau polling.
        */
        if(connectionId){
            sellerBooksApplyOAuthConnectionState(connectionId);
        }

        sellerBooksAlert(
            "Akun " + marketplaceLabel + " berhasil terhubung ke SellerBooks.",
            "Integrasikan Akun"
        );

        /*
           Setelah OAuth sukses, koneksi sudah ditulis ke Supabase.
           Jangan hanya melakukan satu refresh karena callback popup
           bisa selesai sedikit lebih cepat daripada state sesi utama.
           Paksa sinkronisasi beberapa kali sampai tombol kartu berubah
           menjadi "Copot Integrasi".
        */
        sellerBooksStoreConnectionsUserId = "";

        [200, 700, 1500, 3000].forEach(function(delay){
            setTimeout(function(){
                sellerBooksStoreConnectionsUserId = "";
                refreshStoreIntegrationStates(true);
            }, delay);
        });

        return;
    }

    var errorLabel =
        marketplace === "shopee" ? "Shopee" :
        marketplace === "tiktok" ? "TikTok Shop" :
        marketplace === "lazada" ? "Lazada" :
        marketplace || "Marketplace";

    sellerBooksAlert(
        "Integrasi " + errorLabel + " gagal." +
        (reason ? "\n\nKode: " + reason : ""),
        "Integrasikan Akun"
    );

    setTimeout(function(){
        refreshStoreIntegrationStates(true);
    }, 200);
};

/* =====================================================
   STATUS INTEGRASI AKUN TOKO
===================================================== */





/* =====================================================
   BUKA MODAL TAMBAH TOKO
===================================================== */




/* =====================================================
   TUTUP MODAL
===================================================== */




/* =====================================================
   SIMPAN AKUN TOKO
===================================================== */




/* =====================================================
   EDIT AKUN TOKO
===================================================== */




/* =====================================================
   AKTIF / NONAKTIF TOKO
===================================================== */




/* =====================================================
   HAPUS TOKO
===================================================== */




/* =====================================================
   UPDATE JUMLAH TOKO DI DASHBOARD
===================================================== */




/* =====================================================
   FUNGSI TAMBAHAN
   UPDATE MARKETPLACE PERFORMANCE
===================================================== */

/* =====================================================
   BIAYA PACKING
   DIHITUNG PER ORDER / IDENTITAS PACKING UNIK
===================================================== */



/* =====================================================
   MASTER PRODUK DATABASE
===================================================== */

let products = JSON.parse(

    sellerBooksStorage.getItem("sellerbooks_products")

) || [];


/* PRODUK YANG SEDANG DIEDIT */

let editingProductId = null;



/* =====================================================
   SIMPAN DATABASE PRODUK
===================================================== */

function saveProductData(options){
    options = options || {};

    sellerBooksStorage.setItem(

        "sellerbooks_products",

        JSON.stringify(products)

    );

    /*
       DAILY SNAPSHOT:
       Simpan kondisi TERAKHIR Master Produk pada hari berjalan.
       Setelah tanggal berganti, bucket hari tersebut tidak pernah
       ditimpa lagi.
    */
    sellerBooksRecordTodayProductSnapshots();

    /*
       Master Produk berubah -> hasil cache Rincian harus dihitung ulang.
       Hanya membatalkan cache tampilan; tidak mengubah data bisnis,
       transaksi, snapshot, atau rumus perhitungan.
    */
    if(typeof sellerBooksProductAnalysisRowsCache !== "undefined"){
        sellerBooksProductAnalysisRowsCache = {
            sourceTransactions:null,
            key:"",
            rows:null
        };
    }

    /*
       PERUBAHAN MASTER PRODUK:
       Mulai sinkronisasi cloud segera, bukan menunggu debounce 250 ms.
       UI tetap responsif; promise ini hanya menunggu penyimpanan di belakang.
       Jika cloud belum siap (misalnya halaman baru mulai memuat), mekanisme
       load cloud tetap menjadi sumber data utama dan save tidak dipaksakan.
    */
    if(!options.deferCloudPersist){
    try{
        if(typeof sellerBooksCloudSaveTimer !== "undefined" && sellerBooksCloudSaveTimer){
            clearTimeout(sellerBooksCloudSaveTimer);
            sellerBooksCloudSaveTimer = null;
        }
        if(typeof sellerBooksPersistCloudDataNow === "function" &&
           sellerBooksAuthUser &&
           sellerBooksCloudReady &&
           !sellerBooksCloudLoading){
            sellerBooksPersistCloudDataNow();
        }
    }catch(error){
        console.error("Gagal memulai sinkronisasi Master Produk:", error);
    }
    }

}



/* =====================================================
   KURS MATA UANG SELLERBOOKS
===================================================== */

/* =====================================================
   RENDER MASTER PRODUK
===================================================== */

/* =====================================================
   MASTER PRODUK - STATE PAGINATION
===================================================== */
let productPage = 1;
let productPageSize = 20;
let productPaginationFilterKey = "";

/* =====================================================
   IMPORT PROGRESS + PROTEKSI NAVIGASI
   Progres mencakup pemrosesan file, penyimpanan cloud,
   dan verifikasi hasil simpan. Tidak mengubah rumus bisnis.
===================================================== */
window.sellerBooksImportInProgress = false;
window.sellerBooksProgressOperation = "import";

function sellerBooksDeleteProgressStart(){
    window.sellerBooksProgressOperation = "delete";
    sellerBooksImportProgressShow();
    sellerBooksImportProgressUpdate(20,"processing");
}

async function sellerBooksDeleteProgressFinish(){
    try{
        sellerBooksImportProgressUpdate(65,"saving");
        if(!sellerBooksAuthUser || !sellerBooksCloudReady || sellerBooksCloudLoading){
            throw new Error("cloud_not_ready");
        }
        if(typeof sellerBooksCloudSaveTimer !== "undefined" && sellerBooksCloudSaveTimer){
            clearTimeout(sellerBooksCloudSaveTimer);
            sellerBooksCloudSaveTimer = null;
        }
        const expectedSnapshot=sellerBooksCloneCloudState(sellerBooksCloudState);
        await sellerBooksPersistCloudDataStrict(expectedSnapshot);
        sellerBooksImportProgressUpdate(92,"verifying");
        if(sellerBooksCloudDirtyKeys && sellerBooksCloudDirtyKeys.size){
            throw new Error("cloud_save_unconfirmed");
        }
        sellerBooksImportProgressUpdate(100,"done");
        await new Promise(function(resolve){setTimeout(resolve,500);});
        sellerBooksImportProgressHide();
        window.sellerBooksProgressOperation = "import";
        return true;
    }catch(error){
        console.error("Penghapusan belum terkonfirmasi di cloud:",error);
        sellerBooksImportProgressFailure(error);
        return false;
    }
}

/* =====================================================
   IMPORT EXCEL
===================================================== */

async function logoutSellerBooks(){

    if(window.sellerBooksImportInProgress){
        const isEN=typeof sellerBooksCurrentLanguage==="function"&&sellerBooksCurrentLanguage()==="EN";
        sellerBooksAlert(isEN ? "A save is still in progress. Please wait for cloud confirmation before logging out." : "Penyimpanan masih berlangsung. Mohon tunggu konfirmasi cloud sebelum logout.");
        return;
    }

    try{

        /*
           HENTIKAN TIMER APPROVAL
        */
        if(sellerBooksApprovalTimer){
            clearInterval(
                sellerBooksApprovalTimer
            );

            sellerBooksApprovalTimer = null;
        }

        /*
           HAPUS IDENTITAS LOKAL
        */
        sellerBooksStorage.removeItem(
            "sellerbooks_owner_name"
        );

        /*
           KOSONGKAN STATE USER
        */
        sellerBooksAuthUser = null;
        sellerBooksProfile = null;

        /*
           LOGOUT DARI SUPABASE AUTH
           INI BAGIAN PALING PENTING.
           Setelah ini refresh TIDAK boleh
           mengembalikan user ke dashboard.
        */
        const { error } =
            await sellerBooksSupabase.auth.signOut();

        if(error){
            throw error;
        }

        /*
           PAKSA TAMPIL LOGIN
        */
        sellerBooksShowOnly(
            "loginPage"
        );

    }catch(error){

        console.error(
            "Logout SellerBooks gagal:",
            error
        );

        /*
           Walaupun terjadi error,
           jangan biarkan tampilan dashboard
           tetap terbuka.
        */
        sellerBooksAuthUser = null;
        sellerBooksProfile = null;

        if(sellerBooksApprovalTimer){
            clearInterval(
                sellerBooksApprovalTimer
            );

            sellerBooksApprovalTimer = null;
        }

        sellerBooksStorage.removeItem(
            "sellerbooks_owner_name"
        );

        sellerBooksShowOnly(
            "loginPage"
        );

        sellerBooksAlert(
            "❌ Logout gagal.\n\n" +
            error.message
        );
    }
}
/* =========================================
   RESET IDENTITAS
========================================= */


async function resetIdentity(){
    /* =========================================
       PENGAMAN RESET IDENTITAS
       HANYA BOLEH DARI KOMPUTER
    ========================================= */

    const mobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
        .test(navigator.userAgent);

    if(mobileDevice){

        sellerBooksAlert(
            sellerBooksResetIdentityText("mobile"),
            sellerBooksResetIdentityText("failedTitle")
        );

        return;
    }
    const confirmReset = await sellerBooksConfirm(
        sellerBooksResetIdentityText("confirm"),
        sellerBooksResetIdentityText("confirmTitle")
    );

    if(!confirmReset){
        return;
    }

    /*
       PASTIKAN USER MASIH LOGIN
    */
    if(!sellerBooksAuthUser){

        sellerBooksAlert(
            sellerBooksResetIdentityText("session"),
            sellerBooksResetIdentityText("sessionTitle")
        );

        sellerBooksShowOnly(
            "loginPage"
        );

        return;
    }

    try{

        /*
           RESET HANYA IDENTITAS PEMILIK.
           TIDAK LOGOUT GOOGLE.
           TIDAK MENGUBAH STATUS APPROVAL.
        */
        const {
            error
        } =
            await sellerBooksSupabase
                .from("sellerbooks_profiles")
                .update({
                    owner_name:null,
                    contact_name:null,
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "user_id",
                    sellerBooksAuthUser.id
                );

        if(error){
            throw error;
        }

        /*
           AMBIL PROFILE TERBARU
        */
        sellerBooksProfile =
            await sellerBooksLoadProfile(
                sellerBooksAuthUser
            );

        /*
           HAPUS IDENTITAS LOKAL
        */
        sellerBooksStorage.removeItem(
            "sellerbooks_owner_name"
        );

        /*
           PAKSA MASUK KE LEVEL 2
           TANPA LOGOUT GOOGLE
        */
        sellerBooksShowOnly(
            "ownerSetupPage"
        );

        if(typeof sellerBooksApplyOwnerSetupLanguage==="function"){
            sellerBooksApplyOwnerSetupLanguage();
        }

        /*
           KOSONGKAN INPUT NAMA
        */
        const input =
            document.getElementById(
                "ownerNameInput"
            );

        if(input){

            input.value = "";

            setTimeout(
                function(){

                    input.focus();

                },
                100
            );
        }

        /*
           UPDATE SIDEBAR JIKA ADA
        */
        if(
            typeof updateSidebarOwner ===
            "function"
        ){

            updateSidebarOwner();
        }

        sellerBooksAlert(
            sellerBooksResetIdentityText("success"),
            sellerBooksResetIdentityText("successTitle")
        );

    }catch(error){

        console.error(
            "Gagal mereset Nama Pemilik:",
            error
        );

        sellerBooksAlert(
            sellerBooksResetIdentityText("failed") + "\n\n" + error.message,
            sellerBooksResetIdentityText("failedTitle")
        );
    }
}
/* =====================================================
   SELLERBOOKS
   BACK BUTTON HP / BROWSER
===================================================== */

window.addEventListener(
    "popstate",
    function(event){

        /* =========================================
           JIKA ADA RIWAYAT HALAMAN
        ========================================= */

        if(
            event.state &&
            event.state.sellerbooksPage
        ){

            showView(

                event.state.sellerbooksPage,

                null,

                false

            );

        }

        else{

            /* =========================================
               KEMBALI KE DASHBOARD
            ========================================= */

            showView(

                "dashboard",

                null,

                false

            );

        }

    }
);

/* =====================================================
   SET DASHBOARD SEBAGAI HALAMAN AWAL
===================================================== */

window.addEventListener(
    "DOMContentLoaded",
    function(){

        if(

            document.getElementById("app") &&
            document.getElementById("app").style.display !== "none"

        ){

            history.replaceState(

                {
                    sellerbooksPage:"dashboard"
                },

                "",

                "#dashboard"

            );

        }

    }
);

/* =========================================
   TAMPILKAN NAMA PEMILIK DI SIDEBAR
========================================= */


document.addEventListener(
    "DOMContentLoaded",
    function(){

        updateSidebarOwner();

    }
);
/* =========================================
   RESET OTOMATIS PERIODE HARIAN
   Data lama TETAP tersimpan untuk histori/delete.
   Tampilan operasional otomatis kembali ke Hari Ini
   ketika kalender berganti hari.
========================================= */
/* PATCH E: filter Dashboard disimpan di memory, bukan dibaca dari DOM/storage saat render. */
let sellerBooksDashboardFilterState = {
    period:"today",
    dateFrom:"",
    dateTo:"",
    viewDay:""
};

let currentDashboardPeriod = "today";

/* PATCH E: inisialisasi filter setelah currentDashboardPeriod tersedia. */
sellerBooksSyncDashboardFilterState();

setInterval(sellerBooksCheckWibDayRollover, 60 * 1000);


let dashboardCustomDateConfirmed = false;

/* =========================================
   LOAD PERIODE TERAKHIR
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function(){

        const todayKey = getSellerBooksDayKey();
        const savedDashboardDay =
            sellerBooksGetDashboardPreference(
                "viewDay",
                ""
            );

        if(savedDashboardDay !== todayKey){
            sellerBooksWriteDashboardPreferences({
                viewDay:todayKey,
                period:"today"
            });
        }

        sellerBooksSyncDashboardFilterState();

        const savedPeriod =
            sellerBooksGetDashboardPreference(
                "period",
                "today"
            );


        const periodSelect =
            document.getElementById(
                "dashboardPeriod"
            );


        if(
            savedPeriod
            &&
            periodSelect
        ){

            currentDashboardPeriod =
                savedPeriod;

            periodSelect.value =
                savedPeriod;

        }

        loadDashboardCustomDates();
        updateDashboardByPeriod();

    }
);

/* =========================================
   SELLERBOOKS NOTIFICATION SYSTEM
========================================= */

/* =====================================================
   BIAYA LAIN
   DATABASE SEMENTARA LOCAL STORAGE
===================================================== */

let costs = JSON.parse(
    sellerBooksStorage.getItem(
        "sellerbooks_costs"
    )
) || [];


/* =====================================================
   ID BIAYA YANG SEDANG DIEDIT
===================================================== */

let editingCostId = null;




/* =====================================================
   SIMPAN DATA BIAYA
===================================================== */

/* =====================================================
   SELLERBOOKS - PENGATURAN
   TAMBAHAN BARU, TIDAK MENGHAPUS FUNGSI LAMA
===================================================== */

const SELLERBOOKS_SETTINGS_KEY = "sellerbooks_settings";

const DEFAULT_SELLERBOOKS_SETTINGS = {
    businessName: "",
    logo: "",
    currency: "IDR",
    packingCost: 0,
    rounding: "none",
    exchangeRates: {
        IDR: 1,
        USD: 16500,
        SGD: 12900,
        MYR: 3900
    }
};












document.addEventListener(
    "DOMContentLoaded",
    async function(){
        await sellerBooksLoadGlobalLanguage();
        sellerBooksApplyLoginLanguage();
        loadSellerBooksSettings();
        sellerBooksHandleAuthSession();
    }
);

