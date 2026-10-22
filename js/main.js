

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

function sellerBooksShowOnly(pageId){
    ["loginPage","ownerSetupPage","app","sellerbooksApprovalPage"].forEach(function(id){
        const el=document.getElementById(id);
        if(!el)return;
        el.style.display=id===pageId?(id==="app"?"block":"flex"):"none";
    });
}
function sellerBooksAccessText(key){
    const en = sellerBooksCurrentLanguage() === "en";
    const messages = {
        title: en ? "Waiting for Core Adiimasa Approval" : "Menunggu Persetujuan Core Adiimasa",
        pending: en ? "Your account has been signed in successfully. Please wait for Core Adiimasa to approve your access before using SellerBooks." : "Akun Anda sudah berhasil login. Silakan menunggu persetujuan dari Core Adiimasa sebelum menggunakan SellerBooks.",
        rejected: en ? "Your SellerBooks access request has been rejected by Core Adiimasa. Please contact Core Adiimasa for more information." : "Permintaan akses SellerBooks Anda ditolak oleh Core Adiimasa. Silakan hubungi Core Adiimasa untuk informasi lebih lanjut.",
        suspended: en ? "Your SellerBooks account has been suspended by Core Adiimasa. Please contact Core Adiimasa for more information." : "Akun SellerBooks Anda sedang ditangguhkan oleh Core Adiimasa. Silakan hubungi Core Adiimasa.",
        inactive: en ? "Your SellerBooks account is currently inactive. Please contact Core Adiimasa for more information." : "Akses akun SellerBooks Anda saat ini tidak aktif. Silakan hubungi Core Adiimasa untuk informasi lebih lanjut.",
        deleted: en ? "Your SellerBooks account has been deleted by Core Adiimasa. Please contact Core Adiimasa for more information." : "Akun SellerBooks Anda telah dihapus oleh Core Adiimasa. Silakan hubungi Core Adiimasa untuk informasi lebih lanjut.",
        unavailable: en ? "Your SellerBooks account can no longer be used. Please contact Core Adiimasa for more information." : "Akun SellerBooks Anda sudah tidak dapat digunakan. Silakan hubungi Core Adiimasa untuk informasi lebih lanjut.",
        profileMissing: en ? "You signed in successfully, but your SellerBooks profile has not been created yet. Please try again shortly." : "Akun berhasil login, tetapi profile SellerBooks belum terbentuk. Silakan coba lagi beberapa saat lagi.",
        readError: en ? "Unable to retrieve your account status at this time. Check your internet connection and try again." : "Tidak dapat membaca status akun saat ini. Periksa koneksi internet lalu coba lagi.",
        approvalPending: en ? "Your account is still waiting for approval from Core Adiimasa." : "Status akun masih menunggu persetujuan Core Adiimasa.",
        check: en ? "🔄 Check Approval Status" : "🔄 Cek Status Persetujuan",
        logout: en ? "Log Out" : "Keluar",
        changed: en ? "⚠️ Account Access Changed" : "⚠️ Akses Akun Berubah"
    };
    return messages[key] || key;
}
function sellerBooksApplyApprovalLanguage(){
    const page=document.getElementById("sellerbooksApprovalPage");
    if(!page)return;
    const heading=page.querySelector("h2");
    const check=page.querySelector('button[onclick="sellerBooksCheckApproval(true)"]');
    const logout=page.querySelector('button[onclick="sellerBooksLogout()"]');
    if(heading)heading.textContent=sellerBooksAccessText("title");
    if(check)check.textContent=sellerBooksAccessText("check");
    if(logout)logout.textContent=sellerBooksAccessText("logout");
}
function sellerBooksGetApprovalPage(){
    let page=document.getElementById("sellerbooksApprovalPage");
    if(page){sellerBooksApplyApprovalLanguage();return page;}
    page=document.createElement("section"); page.id="sellerbooksApprovalPage";
    page.style.cssText="min-height:100vh;display:none;align-items:center;justify-content:center;padding:20px;background:#f8fafc;";
    page.innerHTML=`<div style="width:100%;max-width:560px;background:#fff;border-radius:24px;padding:40px 30px;text-align:center;box-shadow:0 20px 60px rgba(15,23,42,.12);border:1px solid #e2e8f0"><div style="font-size:54px;margin-bottom:14px">⏳</div><h2 style="margin-bottom:10px;color:#0f172a"></h2><p id="sellerbooksApprovalEmail" style="color:#2563eb;font-weight:700;margin-bottom:16px;word-break:break-word"></p><p id="sellerbooksApprovalText" style="color:#64748b;line-height:1.7;margin-bottom:24px"></p><button type="button" onclick="sellerBooksCheckApproval(true)" style="border:0;background:#2563eb;color:#fff;padding:12px 20px;border-radius:12px;font-weight:700;cursor:pointer"></button><button type="button" onclick="sellerBooksLogout()" style="display:block;margin:14px auto 0;border:0;background:transparent;color:#64748b;padding:8px 16px;cursor:pointer"></button></div>`;
    document.body.appendChild(page);
    sellerBooksApplyApprovalLanguage();
    return page;
}
function sellerBooksShowApproval(message){
    const page=sellerBooksGetApprovalPage();
    const email=document.getElementById("sellerbooksApprovalEmail");
    const text=document.getElementById("sellerbooksApprovalText");
    if(email)email.textContent=sellerBooksAuthUser?.email||"";
    if(text)text.textContent=message||sellerBooksAccessText("pending");
    sellerBooksApplyApprovalLanguage();
    sellerBooksShowOnly("sellerbooksApprovalPage");
}
async function sellerBooksLoadProfile(user){
    const columns="user_id,email,owner_name,contact_name,status,approved_at,approved_by,created_at,updated_at";
    const {data,error}=await sellerBooksSupabase.from("sellerbooks_profiles").select(columns).eq("user_id",user.id).maybeSingle();
    if(error)throw error;
    if(data)return data;

    /*
       Jika user Auth sudah ada tetapi profile SellerBooks belum terbentuk
       (misalnya akun dibuat sebelum trigger profile dipasang), buat profile
       secara otomatis sebagai PENDING. Status tidak pernah diambil dari client.
    */
    const {error:insertError}=await sellerBooksSupabase.from("sellerbooks_profiles").insert({
    user_id:user.id,
    email:user.email||null,
    owner_name:null,
    contact_name:null,
    status:"pending"
});

    if(insertError && insertError.code!=="23505")throw insertError;

    const {data:profile,error:reloadError}=await sellerBooksSupabase.from("sellerbooks_profiles").select(columns).eq("user_id",user.id).maybeSingle();
    if(reloadError)throw reloadError;
    return profile;
}
let sellerBooksApprovalPromise = null;
let sellerBooksApprovalPromiseUserId = "";

async function sellerBooksCheckApproval(showAlert){
    if(!sellerBooksAuthUser)return;
    const approvalUserId=String(sellerBooksAuthUser.id||"");
    if(!approvalUserId)return;

    if(
        sellerBooksApprovalPromise &&
        sellerBooksApprovalPromiseUserId === approvalUserId
    ){
        return sellerBooksApprovalPromise;
    }

    sellerBooksApprovalPromiseUserId=approvalUserId;
    const currentApprovalPromise=sellerBooksCheckApprovalInternal(showAlert);
    sellerBooksApprovalPromise=currentApprovalPromise;

    try{
        return await currentApprovalPromise;
    }finally{
        if(sellerBooksApprovalPromise === currentApprovalPromise){
            sellerBooksApprovalPromise=null;
            sellerBooksApprovalPromiseUserId="";
        }
    }
}

async function sellerBooksCheckApprovalInternal(showAlert){
    if(!sellerBooksAuthUser)return;
    try{
        const {data:coreAdmin,error:coreCheckError}=await sellerBooksSupabase.rpc("sellerbooks_is_core_admin");
        if(coreCheckError)throw coreCheckError;
        if(coreAdmin===true){
            sellerBooksProfile=null;
            sellerBooksShowApproval("Akun ini adalah akun Core. Silakan gunakan akun client SellerBooks untuk masuk.");
            return;
        }
        sellerBooksProfile=await sellerBooksLoadProfile(sellerBooksAuthUser);
        if(!sellerBooksProfile){ sellerBooksShowApproval(sellerBooksAccessText("profileMissing")); return; }
        const status=String(sellerBooksProfile.status||"pending").toLowerCase();
        if(status==="approved"){
            if(sellerBooksApprovalTimer){clearInterval(sellerBooksApprovalTimer);sellerBooksApprovalTimer=null;}

            /*
               Setelah akun disetujui Core Adiimasa:
               - Jika Nama Pemilik sudah tersimpan di profile akun ini -> masuk Dashboard.
               - Jika belum ada -> tampilkan tingkat 2 untuk membuat Nama Pemilik.
               - localStorage TIDAK dipakai untuk menentukan apakah setup sudah selesai,
                 agar identitas antar akun Google tidak tercampur.
            */
            await sellerBooksLoadCloudData();
            sellerBooksRefreshRuntimeFromCloud();

            /*
               Filter Report tetap disiapkan setelah cloud siap,
               tetapi jangan langsung render Report di sini.
               sellerBooksRefreshActiveView() menjadi satu-satunya
               render awal untuk view yang sedang aktif.
            */
            if(typeof initializeReports==="function"){
                initializeReports(false);
            }

            sellerBooksOpenApplication();
            sellerBooksRefreshActiveView();
            return;
        }
        if(status==="rejected"){sellerBooksShowApproval(sellerBooksAccessText("rejected"));return;}
        if(status==="suspended"){sellerBooksShowApproval(sellerBooksAccessText("suspended"));return;}
        sellerBooksShowApproval(sellerBooksAccessText("pending"));
        if(showAlert)sellerBooksAlert(sellerBooksAccessText("approvalPending"));
    }catch(error){console.error(error);sellerBooksShowApproval(sellerBooksAccessText("readError"));}
}
function sellerBooksOpenApplication(){
    const ownerName = String(sellerBooksProfile?.owner_name || "").trim();

    /*
       Penentu utama identitas adalah profile SellerBooks milik user Google
       yang sedang login, bukan sellerBooksStorage.
    */
    if(ownerName){
        sellerBooksStorage.setItem("sellerbooks_owner_name",ownerName);
        sellerBooksShowOnly("app");
    }else{
        sellerBooksStorage.removeItem("sellerbooks_owner_name");
        sellerBooksShowOnly("ownerSetupPage");
        if(typeof sellerBooksApplyOwnerSetupLanguage==="function"){
            sellerBooksApplyOwnerSetupLanguage();
        }

        const input=document.getElementById("ownerNameInput");
        if(input){
            input.value="";
            setTimeout(function(){input.focus();},50);
        }
    }

    if(typeof updateSidebarOwner==="function")updateSidebarOwner();
}
async function loginGoogle(){
    try{

        /*
           WINDOWS SELLERBOOKS OPERATOR/ADMIN:
           Login Google harus tetap berlangsung di WebView yang sama.
           Jangan biarkan client OAuth menyerahkan navigasi ke browser
           eksternal, karena verifier PKCE tersimpan pada storage WebView.
        */
        const isSellerBooksWindowsApp =
            /SellerBooks(Admin|Operator)\/1\.0/i.test(
                navigator.userAgent.replace(/\s+/g,"")
            );

        if(isSellerBooksWindowsApp){
            const {data,error}=await sellerBooksSupabase.auth.signInWithOAuth({
                provider:"google",

                options:{
                    redirectTo:"https://sellerbooksmbi.github.io/",
                    skipBrowserRedirect:true,
                    queryParams:{
                        prompt:"select_account"
                    }
                }
            });

            if(error){
                console.error("Google Login gagal:",error);
                sellerBooksAlert("❌ Login Google gagal.\n\n"+error.message);
                return;
            }

            if(data && data.url){
                /*
                   Navigasi langsung pada WebView aktif.
                   Dengan cara ini PKCE verifier dibuat dan callback
                   kembali ke storage WebView yang sama.
                */
                window.location.assign(data.url);
            }

            return;
        }

        const {error}=await sellerBooksSupabase.auth.signInWithOAuth({
            provider:"google",

            options:{
                redirectTo:"https://sellerbooksmbi.github.io/",

                queryParams:{
                    prompt:"select_account"
                }
            }
        });

        if(error){
            console.error("Google Login gagal:",error);
            sellerBooksAlert("❌ Login Google gagal.\n\n"+error.message);
        }

    }catch(error){

        console.error(error);

        sellerBooksAlert(
            "❌ Terjadi kesalahan saat menghubungkan Login Google."
        );

    }
}
async function sellerBooksHandleAuthSession(){

    try{

        const {
            data,
            error
        } =
            await sellerBooksSupabase
                .auth                .getSession();

        if(error){
            throw error;
        }

        /*
           TIDAK ADA SESI SUPABASE
           = WAJIB LOGIN ULANG
        */
        if(!data?.session?.user){

            sellerBooksAuthUser = null;
            sellerBooksProfile = null;
            sellerBooksLoginLanguageOverrideActive = false;

            if(sellerBooksApprovalTimer){
                clearInterval(
                    sellerBooksApprovalTimer
                );

                sellerBooksApprovalTimer = null;
            }

            sellerBooksShowOnly(
                "loginPage"
            );

            return;
        }

        /*
           SESI MASIH VALID
           = LANJUTKAN LOGIN NORMAL
        */
        sellerBooksAuthUser =
            data.session.user;

        const warmedFromCache =
            await sellerBooksWarmStartFromCache(
                data.session.user
            );

        if(warmedFromCache){
            sellerBooksCheckApproval(false).catch(function(error){
                console.error("Verifikasi sesi SellerBooks gagal:",error);
            });
        }else{
            await sellerBooksCheckApproval(false);
        }

        /*
           TIMER APPROVAL
        */
        if(
            sellerBooksProfile &&
            String(
                sellerBooksProfile.status
            ).toLowerCase() === "pending" &&
            !sellerBooksApprovalTimer
        ){

            sellerBooksApprovalTimer =
                setInterval(
                    function(){

                        sellerBooksCheckApproval(
                            false
                        );

                    },
                    30000
                );
        }

    }catch(error){

        console.error(
            "Inisialisasi SellerBooks Auth gagal:",
            error
        );

        sellerBooksAuthUser = null;
        sellerBooksProfile = null;

        if(sellerBooksApprovalTimer){

            clearInterval(
                sellerBooksApprovalTimer
            );

            sellerBooksApprovalTimer = null;
        }

        sellerBooksShowOnly(
            "loginPage"
        );
    }
}
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

function sellerBooksRefreshActiveView(){
    const activeView=document.querySelector(".view.active");
    const viewId=activeView ? activeView.id : "dashboard";
    try{
        if(viewId==="dashboard" && typeof updateDashboardByPeriod==="function")updateDashboardByPeriod();
        else if(viewId==="marketplace" && typeof renderMarketplaces==="function")renderMarketplaces();
        else if(viewId==="stores" && typeof renderStores==="function")renderStores();
        else if(viewId==="products" && typeof renderProducts==="function")renderProducts();
        else if(viewId==="costs" && typeof renderCosts==="function")renderCosts();
        else if(viewId==="productAnalysis" && typeof renderProductAnalysis==="function")renderProductAnalysis();
        else if(viewId==="reports" && typeof updateReports==="function")updateReports();
        else if(viewId==="settings" && typeof loadSellerBooksSettings==="function")loadSellerBooksSettings();
        if(typeof renderNotifications==="function")renderNotifications();
    }catch(error){console.error("Refresh view SellerBooks gagal:",error);}
}
function sellerBooksRefreshAllViewsFromCloud(){
    if(typeof sellerBooksRefreshRuntimeFromCloud==="function")sellerBooksRefreshRuntimeFromCloud();
    sellerBooksRefreshActiveView();
}

function sellerBooksStopDataRealtime(){
    if(sellerBooksDataRealtimeChannel){
        sellerBooksSupabase.removeChannel(sellerBooksDataRealtimeChannel);
        sellerBooksDataRealtimeChannel=null;
    }
}

function sellerBooksStartDataRealtime(){
    if(!sellerBooksAuthUser)return;

    sellerBooksStopDataRealtime();
    const userId=sellerBooksAuthUser.id;

    sellerBooksDataRealtimeChannel=sellerBooksSupabase
        .channel("sellerbooks-data-"+userId)
        .on("postgres_changes",{
            event:"INSERT",
            schema:"public",
            table:"sellerbooks_user_data",
            filter:"user_id=eq."+userId
        },function(payload){
            sellerBooksApplyRealtimeCloudData(payload?.new?.data,payload?.new?.updated_at);
        })
        .on("postgres_changes",{
            event:"UPDATE",
            schema:"public",
            table:"sellerbooks_user_data",
            filter:"user_id=eq."+userId
        },function(payload){
            sellerBooksApplyRealtimeCloudData(payload?.new?.data,payload?.new?.updated_at);
        })
        .on("postgres_changes",{
            event:"DELETE",
            schema:"public",
            table:"sellerbooks_user_data"
        },function(payload){
            const deletedUserId=String(payload?.old?.user_id||"");
            if(deletedUserId===String(userId)){
                sellerBooksCloudState={};
                sellerBooksCloudReady=true;
                sellerBooksRefreshAllViewsFromCloud();
            }
        })
        .subscribe(function(status){
            if(status!=="SUBSCRIBED" && status!=="CHANNEL_ERROR" && status!=="TIMED_OUT")return;
            if(status!=="SUBSCRIBED")console.warn("Realtime data SellerBooks:",status);
        });
}

function sellerBooksApplyRealtimeCloudData(data,updatedAt){
    if(sellerBooksDataRealtimeApplying)return;
    if(!data||typeof data!=="object")return;

    sellerBooksDataRealtimeApplying=true;
    try{
        const incoming=sellerBooksCloneCloudState(data);
        const current=sellerBooksCloneCloudState(sellerBooksCloudState);

        sellerBooksCloudDirtyKeys.forEach(function(key){
            if(key==="sellerbooks_sales_imports"){
                try{
                    const merged=sellerBooksMergeSalesImportsForConflict(
                        sellerBooksCloudBaseState[key],current[key],incoming[key]
                    );
                    incoming[key]=merged.conflict?current[key]:merged.value;
                }catch(error){
                    incoming[key]=current[key];
                }
            }else if(current[key]!==undefined){
                incoming[key]=current[key];
            }else{
                delete incoming[key];
            }
        });

        sellerBooksCloudState=incoming;
        if(updatedAt){
            sellerBooksCloudUpdatedAt=updatedAt;
        }

        const incomingKeys=new Set(Object.keys(incoming));
        Object.keys(sellerBooksCloudBaseState).forEach(function(key){
            if(!sellerBooksCloudDirtyKeys.has(key) && !incomingKeys.has(key)){
                delete sellerBooksCloudBaseState[key];
            }
        });
        Object.keys(incoming).forEach(function(key){
            if(!sellerBooksCloudDirtyKeys.has(key)){
                sellerBooksCloudBaseState[key]=incoming[key];
            }
        });

        sellerBooksCloudReady=true;
        sellerBooksSaveFastCache();
        sellerBooksRefreshAllViewsFromCloud();
    }catch(error){
        console.error("Refresh realtime data SellerBooks gagal:",error);
    }finally{
        sellerBooksDataRealtimeApplying=false;
    }
}

function sellerBooksStopAccountRealtime(){
    if(sellerBooksAccountRealtimeChannel){
        sellerBooksSupabase.removeChannel(sellerBooksAccountRealtimeChannel);
        sellerBooksAccountRealtimeChannel=null;
    }
}

function sellerBooksHandleRealtimeAccountAction(status){
    if(sellerBooksAccountRealtimeHandling)return;
    sellerBooksAccountRealtimeHandling=true;

    const normalized=String(status||"").toLowerCase();
    let message=sellerBooksAccessText("unavailable");

    if(normalized==="suspended"){
        message=sellerBooksAccessText("suspended");
    }else if(normalized==="rejected"){
        message=sellerBooksAccessText("rejected");
    }else if(normalized==="pending"){
        message=sellerBooksAccessText("inactive");
    }else if(normalized==="deleted"){
        message=sellerBooksAccessText("deleted");
    }

    sellerBooksStopAccountRealtime();
    sellerBooksStopDataRealtime();
    sellerBooksStopAccountPolling();
    if(sellerBooksApprovalTimer){clearInterval(sellerBooksApprovalTimer);sellerBooksApprovalTimer=null;}

    sellerBooksSupabase.auth.signOut().catch(function(error){
        console.error("Realtime logout gagal:",error);
    }).finally(function(){
        sellerBooksAuthUser=null;
        sellerBooksProfile=null;
        sellerBooksStorage.removeItem("sellerbooks_owner_name");
        sellerBooksShowOnly("loginPage");
        sellerBooksApplyLoginLanguage();
        sellerBooksAlert(sellerBooksAccessText("changed")+"\n\n"+message);
        sellerBooksAccountRealtimeHandling=false;
    });
}

function sellerBooksStartAccountRealtime(){
    if(!sellerBooksAuthUser)return;

    sellerBooksStopAccountRealtime();
    const userId=sellerBooksAuthUser.id;

    sellerBooksAccountRealtimeChannel=sellerBooksSupabase
        .channel("sellerbooks-account-"+userId)
        .on("postgres_changes",{
            event:"UPDATE",
            schema:"public",
            table:"sellerbooks_profiles",
            filter:"user_id=eq."+userId
        },function(payload){
            const status=String(payload?.new?.status||"").toLowerCase();
            if(status!=="approved"){
                sellerBooksHandleRealtimeAccountAction(status);
            }
        })
        .on("postgres_changes",{
            event:"DELETE",
            schema:"public",
            table:"sellerbooks_profiles"
        },function(payload){
            const deletedUserId=String(payload?.old?.user_id||"");
            if(deletedUserId===String(userId)){
                sellerBooksHandleRealtimeAccountAction("deleted");
            }
        })
        .subscribe(function(status){
            if(status!=="SUBSCRIBED" && status!=="CHANNEL_ERROR" && status!=="TIMED_OUT"){
                return;
            }
            if(status!=="SUBSCRIBED"){
                console.warn("Realtime status akun:",status);
            }
        });
}

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

function sellerBooksStartAccountPolling(){
    if(!/SellerBooksAPK\/1\.0/i.test(navigator.userAgent||""))return;
    if(sellerBooksAccountPollingTimer)clearInterval(sellerBooksAccountPollingTimer);

    const check=function(){
        if(sellerBooksAccountPollingBusy || !sellerBooksAuthUser || sellerBooksAccountRealtimeHandling)return;
        sellerBooksAccountPollingBusy=true;

        sellerBooksSupabase
            .from("sellerbooks_profiles")
            .select("status")
            .eq("user_id",sellerBooksAuthUser.id)
            .maybeSingle()
            .then(function(result){
                if(result.error){
                    console.warn("Pengecekan status akun APK gagal:",result.error);
                    return;
                }

                if(!result.data){
                    sellerBooksHandleRealtimeAccountAction("deleted");
                    return;
                }

                const status=String(result.data.status||"").toLowerCase();
                if(status!=="approved")sellerBooksHandleRealtimeAccountAction(status);
            })
            .catch(function(error){
                console.warn("Pengecekan status akun APK gagal:",error);
            })
            .finally(function(){
                sellerBooksAccountPollingBusy=false;
            });
    };

    check();
    sellerBooksAccountPollingTimer=setInterval(check,3000);
}

function sellerBooksStopAccountPolling(){
    if(sellerBooksAccountPollingTimer){
        clearInterval(sellerBooksAccountPollingTimer);
        sellerBooksAccountPollingTimer=null;
    }
}

async function sellerBooksLogout(){
    sellerBooksLoginLanguageOverrideActive = false;
    try{
        window.sessionStorage.removeItem(SELLERBOOKS_SESSION_LANGUAGE_KEY);
    }catch(error){}
    try{await sellerBooksSupabase.auth.signOut();}catch(error){console.error("Logout gagal:",error);}
    if(sellerBooksApprovalTimer){clearInterval(sellerBooksApprovalTimer);sellerBooksApprovalTimer=null;}
    sellerBooksStorage.removeItem("sellerbooks_owner_name");
    applyBusinessLogoToInterface("");
    sellerBooksShowOnly("loginPage");
        sellerBooksApplyLoginLanguage();
}

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



function showView(viewId, button, saveHistory = true){

    if(window.sellerBooksImportInProgress){
        const isEN = typeof sellerBooksCurrentLanguage === "function" && sellerBooksCurrentLanguage() === "EN";
        if(typeof sellerBooksAlert === "function") sellerBooksAlert(isEN ? "Import is still running. Please wait until the save is verified." : "Import masih berjalan. Mohon tunggu sampai penyimpanan terverifikasi.");
        return;
    }

    /* =========================================
       TUTUP SEMUA HALAMAN
    ========================================= */

    document
        .querySelectorAll(".view")
        .forEach(function(view){

            view.classList.remove("active");

        });


    /* =========================================
       TAMPILKAN HALAMAN TERPILIH
    ========================================= */

    const targetView =
        document.getElementById(viewId);

    if(!targetView){
        return;
    }

    targetView.classList.add("active");

    /*
       Render berat dijadwalkan setelah navigasi selesai.
       Rincian memakai initializeProductAnalysis() karena fungsi itu
       sudah sekaligus menyiapkan filter + melakukan render pertama.
    */
    sellerBooksScheduleDeferredRender(function(){
        if(viewId === "dashboard" && typeof updateDashboardByPeriod === "function") updateDashboardByPeriod();
        else if(viewId === "marketplace" && typeof renderMarketplaces === "function") renderMarketplaces();
        else if(viewId === "stores" && typeof renderStores === "function") renderStores();
        else if(viewId === "products" && typeof renderProducts === "function") renderProducts();
        else if(viewId === "costs" && typeof renderCosts === "function") renderCosts();
        else if(viewId === "reports" && typeof updateReports === "function") updateReports();
        else if(viewId === "productAnalysis" && typeof initializeProductAnalysis === "function") initializeProductAnalysis();
        else if(viewId === "settings" && typeof loadSellerBooksSettings === "function") loadSellerBooksSettings();
    });


    /* =========================================
       UPDATE MENU AKTIF
    ========================================= */

    document
        .querySelectorAll(".menu-item")
        .forEach(function(menu){

            menu.classList.remove("active");

        });


    if(button){

        button.classList.add("active");

    }

    else{

        /* Cari menu berdasarkan onclick */

        const menuButtons =
            document.querySelectorAll(".menu-item");

        menuButtons.forEach(function(menu){

            const onclickValue =
                menu.getAttribute("onclick") || "";

            if(
                onclickValue.includes(
                    "showView('" + viewId + "'"
                )
            ){

                menu.classList.add("active");

            }

        });

    }


    /* =========================================
       UPDATE JUDUL HALAMAN
    ========================================= */

    if(pageData[viewId]){

        document.getElementById("topTitle").innerText =
            pageData[viewId].title;

        document.getElementById("topSubtitle").innerText =
            pageData[viewId].subtitle;

    }

    /*
       Sembunyikan subtitle topbar pada semua halaman selain Dashboard,
       karena deskripsi halaman sudah tampil di area konten.
       Dashboard tetap mempertahankan subtitle topbar.
    */
    const topSubtitle = document.getElementById("topSubtitle");
    if(topSubtitle){
        topSubtitle.hidden = (viewId !== "dashboard");
        topSubtitle.setAttribute(
            "aria-hidden",
            viewId !== "dashboard" ? "true" : "false"
        );
    }

    /*
       Dashboard memakai bahasa akun aktif.
       Halaman login tetap berada di luar engine i18n.
    */
    if(
        viewId === "dashboard" &&
        typeof sellerBooksApplyDashboardLanguage === "function"
    ){
        sellerBooksApplyDashboardLanguage();
    }

    if(
        viewId === "marketplace" &&
        typeof sellerBooksApplyMarketplaceLanguage === "function"
    ){
        sellerBooksApplyMarketplaceLanguage();
    }

    if(
        viewId === "stores" &&
        typeof sellerBooksApplyStoreLanguage === "function"
    ){
        sellerBooksApplyStoreLanguage();
    }

    if(
        viewId === "products" &&
        typeof sellerBooksApplyProductLanguage === "function"
    ){
        sellerBooksApplyProductLanguage();
    }

    if(
        viewId === "import" &&
        typeof sellerBooksApplySalesImportLanguage === "function"
    ){
        sellerBooksApplySalesImportLanguage();
    }
    if(viewId === "costs" && typeof sellerBooksApplyCostLanguage === "function"){
        sellerBooksApplyCostLanguage();
    }
    if(viewId === "productAnalysis" && typeof sellerBooksApplyDetailsLanguage === "function"){
        sellerBooksApplyDetailsLanguage();
    }
    if(viewId === "reports" && typeof sellerBooksApplyReportsLanguage === "function"){
        sellerBooksApplyReportsLanguage();
    }
    if(viewId === "settings" && typeof sellerBooksApplySettingsLanguage === "function"){
        sellerBooksApplySettingsLanguage();
    }
    if(typeof sellerBooksApplyNotificationLanguage === "function"){
        sellerBooksApplyNotificationLanguage();
    }


    /* =========================================
       TUTUP SIDEBAR DI HP
    ========================================= */

    if(window.innerWidth <= 900){

        const sidebar =
            document.getElementById("sidebar");

        if(sidebar){

            sidebar.classList.remove("show");

        }

    }


    /* =========================================
       SIMPAN RIWAYAT HALAMAN
    ========================================= */

    if(saveHistory){

        history.pushState(
            {
                sellerbooksPage:viewId
            },
            "",
            "#" + viewId
        );

    }


    /* =========================================
       KEMBALI KE ATAS
    ========================================= */

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

}

/* =====================================================
   MOBILE SIDEBAR
===================================================== */

function toggleSidebar(){

    document
        .getElementById("sidebar")
        .classList
        .toggle("show");

}

/* =====================================================
   TUTUP SIDEBAR SAAT KLIK DI LUAR SIDEBAR
   KHUSUS MOBILE / TABLET
   ===================================================== */

document.addEventListener("click", function(event) {

    // Hanya aktif pada layar mobile/tablet
    if (window.innerWidth > 900) {
        return;
    }

    const sidebar = document.querySelector(".sidebar");
    const mobileMenu = document.querySelector(".mobile-menu");

    if (!sidebar) {
        return;
    }

    // Jika sidebar sedang terbuka
    if (sidebar.classList.contains("show")) {

        // Klik di dalam sidebar → jangan tutup
        if (sidebar.contains(event.target)) {
            return;
        }

        // Klik tombol hamburger → jangan tutup dari kode ini
        if (mobileMenu && mobileMenu.contains(event.target)) {
            return;
        }

        // Klik area putih di luar sidebar → tutup
        sidebar.classList.remove("show");
    }
});
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

let sellerBooksStoreConnections = new Map();
let sellerBooksStoreConnectionsUserId = "";
let sellerBooksStoreConnectionsLoading = false;
let sellerBooksStoreConnectionsQueued = false;
let sellerBooksStoreConnectionsInitialized = false;
let sellerBooksIntegrationStatusPollingTimer = null;

function sellerBooksStoreConnectionKey(storeId, marketplaceId){
    return String(storeId || "") + "|" + String(marketplaceId || "").trim().toLowerCase();
}

function sellerBooksConnectionMarketplaceKey(connection){
    if(!connection) return "";
    return sellerBooksCanonicalMarketplaceId(
        connection.marketplace_id,
        connection.marketplace
    );
}

async function refreshStoreIntegrationStates(force){
    if(!sellerBooksAuthUser) return;

    const userId = String(sellerBooksAuthUser.id || "");
    if(!userId) return;

    if(sellerBooksStoreConnectionsLoading){
        /*
           Request sebelumnya sedang berjalan. Jangan biarkan permintaan
           yang macet mengunci semua percobaan ulang selamanya.
           Paksa retry boleh melepaskan lock dan memulai request baru;
           response lama tidak boleh mengganti state setelah lock diambil
           oleh request yang lebih baru.
        */
        if(force && !sellerBooksStoreConnectionsQueued){
            sellerBooksStoreConnectionsQueued = true;
            setTimeout(function(){
                sellerBooksStoreConnectionsQueued = false;
                if(sellerBooksStoreConnectionsLoading){
                    sellerBooksStoreConnectionsLoading = false;
                }
                refreshStoreIntegrationStates(true);
            }, 1500);
        }
        return;
    }

    if(!force && sellerBooksStoreConnectionsUserId === userId){
        return;
    }

    sellerBooksStoreConnectionsLoading = true;

    try{
        /*
           Batas waktu eksplisit: jika jaringan/RPC Supabase macet,
           jangan biarkan sellerBooksStoreConnectionsLoading terkunci
           selamanya. Promise.race tidak membatalkan request yang tertinggal,
           tetapi memungkinkan UI keluar ke catch/finally dan menyediakan retry.
        */
        let connectionTimeoutId = null;
        const connectionRequest = sellerBooksSupabase.rpc(
            "sellerbooks_api_list_connections"
        );
        const connectionTimeout = new Promise(function(resolve,reject){
            connectionTimeoutId = setTimeout(function(){
                reject(new Error(
                    "Waktu tunggu status integrasi habis. Periksa koneksi cloud lalu coba lagi."
                ));
            },15000);
        });

        let connectionResult;
        try{
            connectionResult = await Promise.race([
                connectionRequest,
                connectionTimeout
            ]);
        }finally{
            if(connectionTimeoutId !== null){
                clearTimeout(connectionTimeoutId);
            }
        }

        const {data,error} = connectionResult;
        if(error) throw error;

        const next = new Map();

        (Array.isArray(data) ? data : []).forEach(function(connection){
            const canonicalMarketplaceId =
                sellerBooksConnectionMarketplaceKey(connection);

            if(!canonicalMarketplaceId){
                return;
            }

            next.set(
                sellerBooksStoreConnectionKey(
                    connection.store_id,
                    canonicalMarketplaceId
                ),
                connection
            );
        });

        const previousConnections = sellerBooksStoreConnections;

        sellerBooksStoreConnections = next;
        sellerBooksStoreConnectionsUserId = userId;

        // Bandingkan status lama vs status terbaru. Ini menjadi fallback
        // realtime untuk WebView/browser yang tidak menerima WebSocket
        // Supabase Realtime secara konsisten.
        //
        // Selain CONNECTED -> CONNECTED, perubahan kebalikannya juga
        // harus langsung diterapkan: CONNECTED -> DISCONNECTED/EXPIRED/ERROR
        // atau koneksi hilang dari hasil RPC. Dengan begitu semua client
        // mengikuti kondisi Supabase tanpa refresh.
        if(sellerBooksStoreConnectionsInitialized){

            // 1. Status berubah menjadi CONNECTED.
            next.forEach(function(connection, key){
                const previous = previousConnections.get(key);

                const previousStatus = String(
                    previous?.connection_status || ""
                ).toUpperCase();

                const nextStatus = String(
                    connection?.connection_status || ""
                ).toUpperCase();

                if(
                    previousStatus !== "CONNECTED" &&
                    nextStatus === "CONNECTED"
                ){
                    const marketplaceId =
                        String(connection.marketplace_id || "").toLowerCase();

                    const suppressedUntil =
                        sellerBooksIntegrationRealtimeSuppress.get(
                            "__MARKETPLACE__|" + marketplaceId
                        ) || 0;

                    if(suppressedUntil > Date.now()){
                        sellerBooksIntegrationRealtimeSuppress.delete(
                            "__MARKETPLACE__|" + marketplaceId
                        );
                    }
                    /*
                       Perubahan status CONNECTED di background hanya
                       memperbarui state/tombol akun toko.
                       Popup "Integrasi Berhasil" hanya boleh muncul
                       dari alur OAuth saat akun benar-benar pertama kali
                       diintegrasikan, bukan saat Tarik Order / refresh.
                    */
                }

                // 2. Status berubah dari CONNECTED menjadi tidak aktif.
                // Tidak memakai alert untuk setiap polling agar tidak spam;
                // UI/button tetap langsung berubah di semua client.
            });

            // 3. Koneksi dihapus dari tabel. Ini penting untuk kasus
            // tombol "Copot Integrasi" yang benar-benar menghapus row.
            previousConnections.forEach(function(previous, key){
                if(next.has(key)) return;

                const previousStatus = String(
                    previous?.connection_status || ""
                ).toUpperCase();

                if(previousStatus === "CONNECTED"){
                    // Row sudah hilang dari Supabase, sehingga renderStores()
                    // di bawah akan otomatis menampilkan "Integrasikan Akun".
                }
            });
        }

        sellerBooksStoreConnectionsInitialized = true;

        // Setiap kali status koneksi selesai dibaca dari Supabase,
        // render ulang kartu akun toko hanya jika halaman Stores sedang aktif.
        // Polling tetap berjalan dan state koneksi tetap diperbarui di background,
        // tetapi halaman lain tidak ikut menerima render DOM setiap 1,5 detik.
        const storesView = document.getElementById("stores");
        const storesViewIsActive =
            !!storesView && storesView.classList.contains("active");

        if(
            storesViewIsActive &&
            typeof renderStores === "function"
        ){
            renderStores(true);
        }
    }catch(error){
        console.warn("Status integrasi akun toko gagal dimuat:",error);

        /*
           Jangan biarkan halaman Akun Toko menampilkan loading tanpa akhir
           ketika RPC gagal. Tampilkan pesan yang bisa dipahami dan tombol
           coba lagi; jangan menandai koneksi sebagai DISCONNECTED karena
           kegagalan membaca cloud bukan bukti bahwa integrasi terputus.
        */
        const storesView = document.getElementById("stores");
        const grid = document.getElementById("storesGrid");
        const storesViewIsActive =
            !!storesView && storesView.classList.contains("active");

        if(storesViewIsActive && grid && !grid.querySelector(".store-card")){
            const en = String(
                typeof sellerBooksCurrentLanguage === "function"
                    ? sellerBooksCurrentLanguage()
                    : "ID"
            ).trim().toUpperCase() === "EN";

            grid.innerHTML =
                '<div class="store-empty">' +
                    '<div class="store-empty-icon">⚠️</div>' +
                    '<h3>' +
                        (en
                            ? 'Could not load marketplace connection status'
                            : 'Status integrasi marketplace gagal dimuat') +
                    '</h3>' +
                    '<p>' +
                        (en
                            ? 'Your connection data has not been changed. Please try again.'
                            : 'Data integrasi tidak diubah. Silakan coba muat kembali statusnya.') +
                    '</p>' +
                    '<button type="button" class="store-action-button store-integrate-button" ' +
                        'onclick="refreshStoreIntegrationStates(true)">' +
                        (en ? 'Try again' : 'Coba Lagi') +
                    '</button>' +
                '</div>';
        }
    }finally{
        sellerBooksStoreConnectionsLoading = false;
    }
}

function sellerBooksCanonicalMarketplaceId(value, marketplaceName){
    const normalize = function(input){
        return String(input || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    };

    const idKey = normalize(value);
    const nameKey = normalize(marketplaceName);

    const aliases = {
        shopee: "shopee",
        tiktok: "tiktok",
        tiktokshop: "tiktok",
        tokopedia: "tokopedia",
        tokped: "tokopedia",
        lazada: "lazada",
        toco: "toco",
        blibli: "blibli"
    };

    if(aliases[idKey]){
        return aliases[idKey];
    }

    if(aliases[nameKey]){
        return aliases[nameKey];
    }

    return String(value || "");
}

function getStoreIntegrationConnection(store){
    if(!store) return null;

    /*
       Akun toko menyimpan marketplaceId sebagai ID marketplace
       milik user, misalnya "marketplace_1790509307069".
       Tabel sellerbooks_api_connections memakai ID kanonik
       konektor, misalnya "tiktok".
       Cari marketplace berdasarkan ID toko lalu normalkan ke ID
       konektor agar status CONNECTED dapat dipasangkan ke kartu
       toko yang benar.
    */
    const marketplace = Array.isArray(marketplaces)
        ? marketplaces.find(function(item){
            return String(item.id) === String(store.marketplaceId);
        })
        : null;

    const canonicalMarketplaceId =
        sellerBooksCanonicalMarketplaceId(
            store.marketplaceId,
            marketplace?.name
        );

    return sellerBooksStoreConnections.get(
        sellerBooksStoreConnectionKey(
            store.id,
            canonicalMarketplaceId
        )
    ) || sellerBooksStoreConnections.get(
        sellerBooksStoreConnectionKey(
            store.id,
            store.marketplaceId
        )
    ) || null;
}

function sellerBooksStartIntegrationStatusPolling(){
    if(sellerBooksIntegrationStatusPollingTimer){
        clearInterval(sellerBooksIntegrationStatusPollingTimer);
    }

    // 1,5 detik sebagai fallback realtime. Tidak bergantung pada
    // refresh halaman dan tetap bekerja pada Chrome, Windows WebView,
    // maupun Android WebView jika WebSocket Realtime gagal.
    const check=function(){
        if(!sellerBooksAuthUser)return;
        refreshStoreIntegrationStates(true);
    };

    check();

    sellerBooksIntegrationStatusPollingTimer =
        setInterval(check,1500);
}

function sellerBooksStopIntegrationStatusPolling(){
    if(sellerBooksIntegrationStatusPollingTimer){
        clearInterval(
            sellerBooksIntegrationStatusPollingTimer
        );
        sellerBooksIntegrationStatusPollingTimer = null;
    }
}



/* =====================================================
   REALTIME STATUS INTEGRASI AKUN TOKO
   Semua perangkat/tab yang sedang login menerima perubahan
   status koneksi tanpa perlu refresh.
===================================================== */

let sellerBooksIntegrationRealtimeChannel = null;
let sellerBooksIntegrationRealtimeSuppress = new Map();

/*
   Anti-duplicate notification:
   callback OAuth dan Supabase Realtime sama-sama dapat memberitahu
   bahwa koneksi berhasil. Simpan waktu notifikasi langsung agar
   realtime hanya menjadi fallback, bukan ikut membungkam notifikasi.
*/
let sellerBooksIntegrationSuccessNoticeAt = new Map();

function sellerBooksMarkIntegrationSuccessNotice(
    storeId,
    marketplaceId
){
    const key = sellerBooksStoreConnectionKey(
        storeId,
        marketplaceId
    );

    sellerBooksIntegrationSuccessNoticeAt.set(
        key,
        Date.now()
    );

    setTimeout(function(){
        const noticedAt =
            sellerBooksIntegrationSuccessNoticeAt.get(key) || 0;

        if(noticedAt && Date.now() - noticedAt >= 10000){
            sellerBooksIntegrationSuccessNoticeAt.delete(key);
        }
    },10500);
}

function sellerBooksShouldShowIntegrationSuccessNotice(
    storeId,
    marketplaceId
){
    const key = sellerBooksStoreConnectionKey(
        storeId,
        marketplaceId
    );

    const noticedAt =
        sellerBooksIntegrationSuccessNoticeAt.get(key) || 0;

    if(noticedAt && Date.now() - noticedAt < 10000){
        return false;
    }

    sellerBooksIntegrationSuccessNoticeAt.set(
        key,
        Date.now()
    );

    return true;
}

function sellerBooksStopIntegrationRealtime(){
    if(sellerBooksIntegrationRealtimeChannel){
        sellerBooksSupabase.removeChannel(
            sellerBooksIntegrationRealtimeChannel
        );
        sellerBooksIntegrationRealtimeChannel = null;
    }
}

function sellerBooksIntegrationRealtimeSuppressMarketplace(
    marketplaceId
){
    const key =
        "__MARKETPLACE__|" +
        String(marketplaceId || "").toLowerCase();

    sellerBooksIntegrationRealtimeSuppress.set(
        key,
        Date.now() + 10000
    );

    setTimeout(function(){
        const expiresAt =
            sellerBooksIntegrationRealtimeSuppress.get(key) || 0;

        if(expiresAt <= Date.now()){
            sellerBooksIntegrationRealtimeSuppress.delete(key);
        }
    },10500);
}

function sellerBooksIntegrationRealtimeSuppressSuccess(
    storeId,
    marketplaceId
){
    const key = sellerBooksStoreConnectionKey(
        storeId,
        marketplaceId
    );

    sellerBooksIntegrationRealtimeSuppress.set(
        key,
        Date.now() + 10000
    );

    setTimeout(function(){
        const expiresAt =
            sellerBooksIntegrationRealtimeSuppress.get(key) || 0;

        if(expiresAt <= Date.now()){
            sellerBooksIntegrationRealtimeSuppress.delete(key);
        }
    },10500);
}

function sellerBooksIntegrationMarketplaceLabel(marketplaceId, marketplaceName){
    const id = String(marketplaceId || "").toLowerCase();

    if(id === "tiktok" || id === "tiktokshop"){
        return "TikTok Shop";
    }

    if(id === "shopee"){
        return "Shopee";
    }

    if(id === "lazada"){
        return "Lazada";
    }

    if(id === "toco"){
        return "Toco";
    }

    if(id === "tokopedia"){
        return "Tokopedia";
    }

    if(id === "blibli"){
        return "Blibli";
    }

    return String(marketplaceName || marketplaceId || "Marketplace");
}

async function sellerBooksApplyOAuthConnectionState(connectionId){
    const id = String(connectionId || "").trim();
    if(!id || !sellerBooksAuthUser || !sellerBooksSupabase){
        return false;
    }

    try{
        const {data,error} = await sellerBooksSupabase
            .from("sellerbooks_api_connections")
            .select(
                "id,store_id,marketplace_id,marketplace,connection_status,sync_enabled,external_store_id,updated_at"
            )
            .eq("id", id)
            .maybeSingle();

        if(error) throw error;
        if(!data) return false;

        const canonicalMarketplaceId =
            sellerBooksConnectionMarketplaceKey(data);

        if(!canonicalMarketplaceId){
            return false;
        }

        const key = sellerBooksStoreConnectionKey(
            data.store_id,
            canonicalMarketplaceId
        );

        const next = new Map(sellerBooksStoreConnections);

        if(
            String(data.connection_status || "").toUpperCase() === "CONNECTED"
        ){
            next.set(key, data);
        }else{
            next.delete(key);
        }

        sellerBooksStoreConnections = next;
        sellerBooksStoreConnectionsUserId =
            String(sellerBooksAuthUser.id || "");
        sellerBooksStoreConnectionsInitialized = true;

        if(typeof renderStores === "function"){
            renderStores(true);
        }

        return String(data.connection_status || "").toUpperCase() === "CONNECTED";
    }catch(error){
        console.warn("Status koneksi OAuth langsung gagal dibaca:", error);
        return false;
    }
}

function sellerBooksHandleIntegrationRealtimePayload(payload){
    const eventType = String(payload?.eventType || "").toUpperCase();
    const record = payload?.new || {};
    const oldRecord = payload?.old || {};

    const storeId = String(
        record.store_id ||
        oldRecord.store_id ||
        ""
    );

    const rawMarketplaceId = String(
        record.marketplace_id ||
        oldRecord.marketplace_id ||
        ""
    );

    const marketplaceId = sellerBooksCanonicalMarketplaceId(
        rawMarketplaceId,
        record.marketplace || oldRecord.marketplace
    );

    if(!storeId || !marketplaceId){
        return;
    }

    /*
       REALTIME HARDENING
       Jangan menunggu RPC/polling untuk mengubah UI.
       Begitu event Supabase masuk, langsung terapkan row tersebut
       ke Map lokal dan render kartu. Setelah itu tetap lakukan RPC
       sebagai verifikasi/sinkronisasi penuh.
       
       Ini penting untuk:
       - Chrome -> Android WebView
       - Android WebView -> Chrome
       - Windows WebView -> Chrome
       - CONNECTED -> DISCONNECTED
       - DISCONNECTED -> CONNECTED
    */
    const canonicalMarketplaceId =
        sellerBooksCanonicalMarketplaceId(
            marketplaceId,
            record.marketplace || oldRecord.marketplace
        );

    const key = sellerBooksStoreConnectionKey(
        storeId,
        canonicalMarketplaceId
    );

    const nextConnections =
        new Map(sellerBooksStoreConnections);

    if(eventType === "DELETE"){
        nextConnections.delete(key);
    }else if(record && record.id){
        nextConnections.set(key, record);
    }

    sellerBooksStoreConnections = nextConnections;
    sellerBooksStoreConnectionsUserId =
        String(sellerBooksAuthUser?.id || "");

    sellerBooksStoreConnectionsInitialized = true;

    if(typeof renderStores === "function"){
        renderStores(true);
    }

    /*
       Verifikasi ulang dari database. Jika WebView kehilangan event
       atau event datang sebelum sesi siap, polling/RPC tetap menjadi
       fallback.
    */
    sellerBooksStoreConnectionsUserId = "";
    refreshStoreIntegrationStates(true);

    const newStatus = String(
        record.connection_status || ""
    ).toUpperCase();

    const oldStatus = String(
        oldRecord.connection_status || ""
    ).toUpperCase();

    // Notifikasi hanya ketika status benar-benar berubah menjadi CONNECTED.
    if(
        newStatus !== "CONNECTED" ||
        oldStatus === "CONNECTED"
    ){
        return;
    }

    /*
       Jangan membungkam event realtime hanya karena callback OAuth
       juga mengirim notifikasi. Realtime tetap menjadi fallback.
       Hanya cegah notifikasi ganda dalam window 10 detik.
    */
    if(!sellerBooksShouldShowIntegrationSuccessNotice(
        storeId,
        marketplaceId
    )){
        return;
    }

    /*
       Realtime hanya menyinkronkan status koneksi.
       Notifikasi "Integrasi Berhasil" ditampilkan oleh callback OAuth
       ketika integrasi benar-benar dilakukan, bukan oleh perubahan
       status CONNECTED saat refresh atau Tarik Order.
    */
}

function sellerBooksStartIntegrationRealtime(){
    if(!sellerBooksAuthUser){
        return;
    }

    sellerBooksStopIntegrationRealtime();

    const userId = String(
        sellerBooksAuthUser.id || ""
    );

    if(!userId){
        return;
    }

    sellerBooksIntegrationRealtimeChannel =
        sellerBooksSupabase
            .channel("sellerbooks-integration-" + userId)
            .on(
                "postgres_changes",
                {
                    event:"INSERT",
                    schema:"public",
                    table:"sellerbooks_api_connections",
                    filter:"owner_user_id=eq." + userId
                },
                sellerBooksHandleIntegrationRealtimePayload
            )
            .on(
                "postgres_changes",
                {
                    event:"UPDATE",
                    schema:"public",
                    table:"sellerbooks_api_connections",
                    filter:"owner_user_id=eq." + userId
                },
                sellerBooksHandleIntegrationRealtimePayload
            )
            .on(
                "postgres_changes",
                {
                    event:"DELETE",
                    schema:"public",
                    table:"sellerbooks_api_connections",
                    filter:"owner_user_id=eq." + userId
                },
                function(payload){
                    // DELETE berarti koneksi benar-benar sudah dicopot.
                    // Paksa baca ulang sekarang agar semua browser/WebView
                    // langsung menampilkan tombol "Integrasikan Akun".
                    sellerBooksStoreConnectionsUserId = "";
                    refreshStoreIntegrationStates(true);
                }
            )
            .subscribe(function(status){
                if(
                    status !== "SUBSCRIBED" &&
                    status !== "CHANNEL_ERROR" &&
                    status !== "TIMED_OUT"
                ){
                    return;
                }

                if(status !== "SUBSCRIBED"){
                    console.warn(
                        "Realtime integrasi SellerBooks:",
                        status
                    );
                }
            });
}


/* =====================================================
   RENDER AKUN TOKO
===================================================== */

function sellerBooksRetryStoreConnections(){
    sellerBooksStoreConnectionsLoading=false;
    sellerBooksStoreConnectionsQueued=false;
    sellerBooksStoreConnectionsUserId="";
    const grid=document.getElementById("storesGrid");
    if(grid)delete grid.dataset.integrationWatchdog;
    refreshStoreIntegrationStates(true);
}




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
function getPackingCostPerOrder(){return Number(sellerBooksStorage.getItem("sellerbooks_packing_unit_cost")||0)||0;}
function getTotalPackingCost(){const imports=JSON.parse(sellerBooksStorage.getItem("sellerbooks_sales_imports")||"[]");return imports.reduce(function(total,item){return total+Number(item.totalPackingCost||0);},0);}

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

function getSellerBooksExchangeRates(){
    const settings =
        getSellerBooksSettings();

    const defaults = {
        IDR: 1,
        USD: 16500,
        SGD: 12900,
        MYR: 3900
    };

    const savedRates =
        settings &&
        settings.exchangeRates &&
        typeof settings.exchangeRates === "object"
            ? settings.exchangeRates
            : {};

    return {
        IDR: 1,
        USD:
            Number(savedRates.USD) > 0
                ? Number(savedRates.USD)
                : defaults.USD,
        SGD:
            Number(savedRates.SGD) > 0
                ? Number(savedRates.SGD)
                : defaults.SGD,
        MYR:
            Number(savedRates.MYR) > 0
                ? Number(savedRates.MYR)
                : defaults.MYR
    };
}


/* =====================================================
   FORMAT RUPIAH
===================================================== */

function formatRupiah(value){

    /*
       SEMUA NOMINAL INTERNAL SELLERBOOKS DISIMPAN DALAM IDR.
       Pengaturan mata uang hanya menentukan mata uang tampilan,
       tetapi sekarang nilai juga DIKONVERSI dari IDR ke mata uang pilihan.
    */
    if(
        typeof getSellerBooksSettings === "function"
    ){
        const settings =
            getSellerBooksSettings();

        const currency =
            settings.currency || "IDR";

        const rounding =
            settings.rounding || "none";

        let numeric =
            Number(value) || 0;

        /*
           KURS KONVERSI
           Basis seluruh data SellerBooks = IDR.
           Nilai kurs diambil dari Pengaturan agar
           pengguna dapat memperbaruinya kapan saja.
        */
        const exchangeRates =
            getSellerBooksExchangeRates();

        /* Pembulatan tetap dilakukan pada nilai dasar IDR. */
        if(
            rounding !== "none"
        ){
            const unit =
                Number(rounding);

            if(
                Number.isFinite(unit) &&
                unit > 0
            ){
                numeric =
                    Math.round(
                        numeric / unit
                    ) * unit;
            }
        }

        const currencyConfig = {
            IDR:{
                locale:"id-ID",
                currency:"IDR",
                minimumFractionDigits:0,
                maximumFractionDigits:0
            },
            USD:{
                locale:"en-US",
                currency:"USD",
                minimumFractionDigits:2,
                maximumFractionDigits:2
            },
            SGD:{
                locale:"en-SG",
                currency:"SGD",
                minimumFractionDigits:2,
                maximumFractionDigits:2
            },
            MYR:{
                locale:"ms-MY",
                currency:"MYR",
                minimumFractionDigits:2,
                maximumFractionDigits:2
            }
        };

        const config =
            currencyConfig[currency] ||
            currencyConfig.IDR;

        const exchangeRate =
            Number(exchangeRates[currency]) || 1;

        /*
           Konversi IDR -> mata uang pilihan.
           Contoh: Rp25.000 / 16.500 = USD 1,52.
        */
        numeric =
            numeric / exchangeRate;

        return new Intl.NumberFormat(
            config.locale,
            {
                style:"currency",
                currency:config.currency,
                minimumFractionDigits:
                    config.minimumFractionDigits,
                maximumFractionDigits:
                    config.maximumFractionDigits
            }
        ).format(numeric);
    }

    return new Intl.NumberFormat(
        "id-ID",
        {
            style:"currency",
            currency:"IDR",
            minimumFractionDigits:0
        }    ).format(value || 0);

}



/* =====================================================
   RENDER MASTER PRODUK
===================================================== */

/* =====================================================
   MASTER PRODUK - STATE PAGINATION
===================================================== */
let productPage = 1;
let productPageSize = 20;
let productPaginationFilterKey = "";

function renderProducts(){

    const tableBody =

        document.getElementById(
            "productsTableBody"
        );


    const productCount =

        document.getElementById(
            "productCount"
        );


    if(!tableBody){

        return;

    }



    /* SEARCH */

    const searchInput =

        document.getElementById(
            "productSearch"
        );


    const search =

        searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";



    /* FILTER STATUS */

    const statusFilter =

        document.getElementById(
            "productStatusFilter"
        );


    const status =

        statusFilter
        ? statusFilter.value
        : "all";



    let filteredProducts =

        products.filter(function(product){


            const matchSearch =

                product.sku
                .toLowerCase()
                .includes(search)

                ||

                product.name
                .toLowerCase()
                .includes(search);



            const matchStatus =

                status === "all"

                ||

                product.status === status;



            return matchSearch && matchStatus;

        });


    /* RESET HALAMAN JIKA SEARCH / FILTER BERUBAH */
    const productFilterKey = [search, status].join("|");

    if(productPaginationFilterKey !== productFilterKey){
        productPage = 1;
        productPaginationFilterKey = productFilterKey;
    }

    if(!Number.isFinite(productPageSize) || productPageSize < 1){
        productPageSize = 20;
    }

    const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / productPageSize));

    if(productPage > productTotalPages){
        productPage = productTotalPages;
    }

    if(productPage < 1){
        productPage = 1;
    }

    const productStartIndex = (productPage - 1) * productPageSize;
    const productEndIndex = Math.min(productStartIndex + productPageSize, filteredProducts.length);
    const visibleProducts = filteredProducts.slice(productStartIndex, productEndIndex);

    const productPagination = document.getElementById("productPagination");
    const productPaginationControls = document.getElementById("productPaginationControls");
    const productPageSizeSelect = document.getElementById("productPageSize");


    /* UPDATE JUMLAH */

    if(productCount){

        productCount.innerText = sellerBooksProductCountText(filteredProducts.length);

    }



    /* KOSONGKAN TABLE */

    tableBody.innerHTML = "";

    const selectAllProducts =
        document.getElementById(
            "selectAllProducts"
        );

    if(selectAllProducts){

        selectAllProducts.checked = false;

    }

    updateSelectedProductUI();



    /* EMPTY STATE */

    if(filteredProducts.length === 0){

        if(productPagination){
            productPagination.style.display = "none";
        }

        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                >

                    <div class="product-empty">

                        <div class="product-empty-icon">

                            📦

                        </div>


                        <h3>

                            ${sellerBooksProductText("noProducts")}

                        </h3>


                        <p>

                            ${sellerBooksProductText("noProductsText")}

                        </p>

                    </div>

                </td>

            </tr>

        `;


        return;

    }



    /* =================================================
       BUAT BARIS PRODUK
    ================================================= */

    visibleProducts.forEach(function(product){


        const statusText =

            product.status === "active"

            ? sellerBooksProductText("active")

            : sellerBooksProductText("inactive");


        const statusClass =

            product.status === "active"

            ? "active"

            : "inactive";



        tableBody.innerHTML += `

            <tr>


                <td class="product-select-column">

                    <input
                        type="checkbox"
                        class="product-select-checkbox product-row-checkbox"
                        value="${product.id}"
                        onchange="updateSelectedProductUI()"
                    >

                </td>


                <td>

                    <span class="product-sku">

                        ${product.sku}

                    </span>

                </td>



                <td>

                    <div class="product-name">

                        ${product.name}

                    </div>

                </td>



                <td>

                    <span class="product-category">

                        ${
                            product.category
                            ? product.category
                            : "-"
                        }

                    </span>

                </td>



                <td>

                    <span class="product-price">

                        ${formatRupiah(product.price)}

                    </span>

                </td>



                <td>

                    <span class="product-price">

                        ${formatRupiah(product.cost)}

                    </span>

                </td>

                <td>

                    <span class="product-price">

                        ${
                            product.adminFeePercent !== undefined &&
                            product.adminFeePercent !== null &&
                            product.adminFeePercent !== ""
                                ? Number(product.adminFeePercent).toLocaleString("id-ID", {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2
                                }) + "%"
                                : "-"
                        }

                    </span>

                </td>

                <td>
                   <span class="product-stock">
        
                        ${Number(product.stock) || 0}
    
                    </span>
               
                </td>

                <td>

                    <span class="status ${statusClass}">

                        ${statusText}

                    </span>

                </td>



                <td>


                    <div class="product-actions">


                        <button
                            class="
                                product-action-button
                                product-edit
                            "
                            onclick="editProduct('${product.id}')"
                        >

                            ✏️

                        </button>



                        <button
                            class="
                                product-action-button
                                product-toggle
                            "
                            onclick="toggleProduct('${product.id}')"
                        >

                            ${
                                product.status === "active"

                                ? sellerBooksProductText("disable")

                                : sellerBooksProductText("enable")
                            }

                        </button>



                        <button
                            class="
                                product-action-button
                                product-delete
                            "
                            onclick="deleteProduct('${product.id}')"
                        >

                            🗑️

                        </button>


                    </div>


                </td>


            </tr>

        `;

    });


    /* PAGINATION */
    if(productPagination){
        productPagination.style.display = "flex";
    }

    if(productPageSizeSelect){
        productPageSizeSelect.value = String(productPageSize);
    }

    if(productPaginationControls){
        let controlsHtml = "";

        controlsHtml += `<span class="product-page-info">${sellerBooksProductText("range").replace("{start}",productStartIndex + 1).replace("{end}",productEndIndex).replace("{total}",filteredProducts.length)}</span>`;

        controlsHtml += `
            <button type="button" class="product-page-button" onclick="goToProductPage(${productPage - 1})" ${productPage <= 1 ? "disabled" : ""} aria-label="${sellerBooksProductText("previous")}">‹</button>
        `;

        const maxButtons = 7;
        let pageStart = Math.max(1, productPage - 3);
        let pageEnd = Math.min(productTotalPages, pageStart + maxButtons - 1);
        pageStart = Math.max(1, pageEnd - maxButtons + 1);

        if(pageStart > 1){
            controlsHtml += `<button type="button" class="product-page-button" onclick="goToProductPage(1)">1</button>`;
            if(pageStart > 2){
                controlsHtml += `<span class="product-page-info">...</span>`;
            }
        }

        for(let page = pageStart; page <= pageEnd; page++){
            controlsHtml += `<button type="button" class="product-page-button ${page === productPage ? "active" : ""}" onclick="goToProductPage(${page})" aria-current="${page === productPage ? "page" : "false"}">${page}</button>`;
        }

        if(pageEnd < productTotalPages){
            if(pageEnd < productTotalPages - 1){
                controlsHtml += `<span class="product-page-info">...</span>`;
            }
            controlsHtml += `<button type="button" class="product-page-button" onclick="goToProductPage(${productTotalPages})">${productTotalPages}</button>`;
        }

        controlsHtml += `<button type="button" class="product-page-button" onclick="goToProductPage(${productPage + 1})" ${productPage >= productTotalPages ? "disabled" : ""} aria-label="${sellerBooksProductText("next")}">${sellerBooksProductText("next")} ›</button>`;

        productPaginationControls.innerHTML = controlsHtml;
    }

}


function goToProductPage(page){

    const search = document.getElementById("productSearch")?.value.toLowerCase().trim() || "";
    const status = document.getElementById("productStatusFilter")?.value || "all";

    const filteredProducts = products.filter(function(product){
        const matchSearch = product.sku.toLowerCase().includes(search) || product.name.toLowerCase().includes(search);
        const matchStatus = status === "all" || product.status === status;
        return matchSearch && matchStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productPageSize));
    productPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    renderProducts();
}


function changeProductPageSize(value){

    const parsed = Number(value);
    productPageSize = [20,40,50,80,100].includes(parsed) ? parsed : 20;
    productPage = 1;
    renderProducts();
}



/* =====================================================
   BUKA MODAL TAMBAH PRODUK
===================================================== */

function openProductModal(){

    editingProductId = null;


    document.getElementById(
        "productModalTitle"
    ).innerText = sellerBooksProductText("addTitle");


    document.getElementById(
        "productSKU"
    ).value = "";


    document.getElementById(
        "productName"
    ).value = "";


    document.getElementById(
        "productCategory"
    ).value = "";


    document.getElementById(
        "productPrice"
    ).value = "";


    document.getElementById(
        "productCost"
    ).value = "";

    document.getElementById(
        "productAdminFeePercent"
    ).value = "";

    
    document.getElementById(
    "productStock"
    ).value = "0";

    
    document.getElementById(
        "productStatus"
    ).value = "active";


    document
        .getElementById("productModal")
        .classList
        .add("show");

}



/* =====================================================
   TUTUP MODAL
===================================================== */

function closeProductModal(){

    document
        .getElementById("productModal")
        .classList
        .remove("show");


    editingProductId = null;

}



/* =====================================================
   SIMPAN PRODUK
===================================================== */

async function saveProduct(){

    const sku =

        document.getElementById(
            "productSKU"
        )
        .value
        .trim();


    const name =

        document.getElementById(
            "productName"
        )
        .value
        .trim();


    const category =

        document.getElementById(
            "productCategory"
        )
        .value
        .trim();


    const price =

        Number(

            document.getElementById(
                "productPrice"
            ).value

        ) || 0;


    const cost =

        Number(

            document.getElementById(
                "productCost"
            ).value

        ) || 0;


    const adminFeePercentInput = document.getElementById("productAdminFeePercent");
    const adminFeePercentRaw = adminFeePercentInput ? adminFeePercentInput.value.trim() : "";
    const adminFeePercent = adminFeePercentRaw === "" ? "" : Number(adminFeePercentRaw);


    const stock =
        Math.max(
            0,
        Number(
            document.getElementById(
                "productStock"
            ).value
        ) || 0
    );
   

    const status =

        document.getElementById(
            "productStatus"
        ).value;



    if(adminFeePercent !== "" && (!Number.isFinite(adminFeePercent) || adminFeePercent < 0 || adminFeePercent > 100)){
        sellerBooksAlert(sellerBooksProductText("adminInvalid"));
        return;
    }


    /* VALIDASI SKU */

    if(!sku){

        sellerBooksAlert(
            sellerBooksProductText("skuRequired")
        );

        return;

    }



    /* VALIDASI NAMA */

    if(!name){

        sellerBooksAlert(
            sellerBooksProductText("nameRequired")
        );

        return;

    }



    /* VALIDASI HPP */

    if(

        document.getElementById(
            "productCost"
        ).value === ""

    ){

        sellerBooksAlert(
            sellerBooksProductText("costRequired")
        );

        return;

    }



    /* EDIT PRODUK */

    if(editingProductId){


        /*
           CEK SKU GANDA
           SELAIN PRODUK YANG DIEDIT
        */

        const duplicateSKU =

            products.some(function(product){

                return (

                    product.sku.toLowerCase()
                    === sku.toLowerCase()

                    &&

                    product.id !== editingProductId

                );

            });


        if(duplicateSKU){

            sellerBooksAlert(
                sellerBooksProductText("duplicateEdit")
            );

            return;

        }



        const product =

            products.find(function(item){

                return item.id === editingProductId;

            });


        if(product){

            product.sku = sku;

            product.name = name;

            product.category = category;

            product.price = price;

            product.stock = stock;

            product.cost = cost;

            product.adminFeePercent = adminFeePercent;

            product.status = status;

            product.updatedAt =
                new Date().toISOString();

        }

    }



    /* TAMBAH PRODUK BARU */

    else{


        const duplicateSKU =

            products.some(function(product){

                return (

                    product.sku.toLowerCase()

                    ===

                    sku.toLowerCase()

                );

            });


        if(duplicateSKU){

            sellerBooksAlert(
                sellerBooksProductText("duplicateAdd")
            );

            return;

        }



        products.push({

            id:
                "product_" +
                Date.now(),


            sku:sku,

            name:name,

            category:category,

            price:price,

            cost:cost,

            adminFeePercent:adminFeePercent,

            stock:stock,

            status:status,


            createdAt:
                new Date().toISOString(),


            updatedAt:
                new Date().toISOString()

        });

    }



    /*
       SIMPAN LOKAL TERLEBIH DAHULU.
       Ini tetap memakai mekanisme penyimpanan yang sudah ada.
    */
    saveProductData();

    /*
       TUTUP MODAL SEGERA.
       Jangan menunggu proses Supabase selesai karena proses jaringan
       sebelumnya membuat tombol Simpan terasa lambat/lemot.
    */
    closeProductModal();

    /*
       RENDER SETELAH BROWSER SELESAI MENGGAMBAR MODAL YANG SUDAH DITUTUP.
       Dengan begitu klik Simpan langsung terasa responsif.
    */
    requestAnimationFrame(function(){
        renderProducts();        renderNotifications();
    });

    /*
       SINKRONISASI CLOUD TETAP DILAKUKAN, tetapi berjalan di belakang
       tanpa menahan modal/UI. Timer lama dibatalkan agar penyimpanan
       dimulai sekarang, bukan menunggu antrean 250ms.
    */
    try{
        if(typeof sellerBooksCloudSaveTimer!=="undefined" && sellerBooksCloudSaveTimer){
            clearTimeout(sellerBooksCloudSaveTimer);
            sellerBooksCloudSaveTimer=null;
        }

        if(typeof sellerBooksPersistCloudDataNow==="function" &&
           sellerBooksAuthUser &&
           sellerBooksCloudReady){
            sellerBooksPersistCloudDataNow();
        }
    }catch(error){
        console.error("Penyimpanan Master Produk ke cloud gagal dimulai:",error);
    }

}



/* =====================================================
   EDIT PRODUK
===================================================== */

function editProduct(id){

    const product =

        products.find(function(item){

            return item.id === id;

        });


    if(!product){

        return;

    }


    editingProductId = id;


    document.getElementById(
        "productModalTitle"
    ).innerText = sellerBooksProductText("editTitle");


    document.getElementById(
        "productSKU"
    ).value = product.sku;


    document.getElementById(
        "productName"
    ).value = product.name;


    document.getElementById(
        "productCategory"
    ).value = product.category || "";


    document.getElementById(
        "productPrice"
    ).value = product.price || "";


    document.getElementById(
        "productCost"
    ).value = product.cost || "";

document.getElementById("productAdminFeePercent").value =
    product.adminFeePercent !== undefined && product.adminFeePercent !== null
        ? product.adminFeePercent
        : "";


document.getElementById(
    "productStock"
).value =
    Number(product.stock) || 0;

    document.getElementById(
        "productStatus"
    ).value = product.status;


    document
        .getElementById("productModal")
        .classList
        .add("show");

}



/* =====================================================
   AKTIF / NONAKTIF PRODUK
===================================================== */

function toggleProduct(id){

    const product =

        products.find(function(item){

            return item.id === id;

        });


    if(!product){

        return;

    }


    product.status =

        product.status === "active"

        ? "inactive"

        : "active";


    product.updatedAt =
        new Date().toISOString();


    saveProductData();

    renderProducts();

    renderNotifications();

}



/* =====================================================
   PILIH & HAPUS BEBERAPA PRODUK SEKALIGUS
===================================================== */

function getSelectedProductIds(){

    return Array.from(
        document.querySelectorAll(
            ".product-row-checkbox:checked"
        )
    ).map(function(checkbox){

        return checkbox.value;

    });

}


function updateSelectedProductUI(){

    const selectedIds = getSelectedProductIds();

    const deleteButton =
        document.getElementById(
            "deleteSelectedProductsButton"
        );

    const selectedCount =
        document.getElementById(
            "selectedProductCount"
        );

    if(selectedCount){

        selectedCount.innerText =
            selectedIds.length;

    }

    if(deleteButton){

        deleteButton.style.display =
            selectedIds.length > 0
            ? "inline-block"
            : "none";

    }

    const selectAll =
        document.getElementById(
            "selectAllProducts"
        );

    const rowCheckboxes =
        document.querySelectorAll(
            ".product-row-checkbox"
        );

    if(selectAll){

        selectAll.checked =
            rowCheckboxes.length > 0 &&
            selectedIds.length === rowCheckboxes.length;

    }

}


function toggleSelectAllProducts(checkbox){

    document
        .querySelectorAll(
            ".product-row-checkbox"
        )
        .forEach(function(rowCheckbox){

            rowCheckbox.checked =
                checkbox.checked;

        });

    updateSelectedProductUI();

}


async function deleteSelectedProducts(){

    const selectedIds = getSelectedProductIds();

    if(selectedIds.length === 0){

        return;

    }

    const confirmation = await sellerBooksConfirm(
        sellerBooksProductText("deleteSelectedConfirm").replace("{count}",selectedIds.length)
    );

    if(!confirmation){

        return;

    }

    sellerBooksDeleteProgressStart();
    products = products.filter(function(product){
        return !selectedIds.includes(product.id);
    });
    saveProductData();
    renderProducts();
    renderNotifications();
    await sellerBooksDeleteProgressFinish();

}


/* =====================================================
   HAPUS PRODUK
===================================================== */

async function deleteProduct(id){

    const product =

        products.find(function(item){

            return item.id === id;

        });


    if(!product){

        return;

    }


    const confirmation = await sellerBooksConfirm(
        sellerBooksProductText("deleteConfirm") +
        ' "' +
        product.name +
        '"?'
    );


    if(!confirmation){

        return;

    }


    sellerBooksDeleteProgressStart();
    products = products.filter(function(item){ return item.id !== id; });
    saveProductData();
    renderProducts();
    renderNotifications();
    await sellerBooksDeleteProgressFinish();

}



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

async function importProducts(input){

    const file = input.files[0];


    if(!file){

        return;

    }

    sellerBooksImportProgressShow();

    if(!(await sellerBooksEnsureXLSX())){
        sellerBooksImportProgressHide();
        input.value = "";
        return;
    }


    const reader = new FileReader();
    reader.onerror = function(){
        sellerBooksImportProgressHide();
        input.value = "";
        sellerBooksAlert(sellerBooksProductText("importError"));
    };


    reader.onload = async function(event){


        try{


            sellerBooksImportProgressUpdate(12,"reading");
            const workbook = XLSX.read(

                event.target.result,

                {

                    type:"array"

                }

            );


            const firstSheet =

                workbook.Sheets[
                    workbook.SheetNames[0]
                ];


            const excelData =

                XLSX.utils.sheet_to_json(

                    firstSheet,

                    {

                        defval:""

                    }

                );

            sellerBooksImportProgressUpdate(24,"processing");



            if(excelData.length === 0){

                sellerBooksAlert(
                    sellerBooksProductText("importEmpty")
                );

                return;

            }



            let successCount = 0;

            let duplicateCount = 0;

            let errorCount = 0;



            excelData.forEach(function(row){


                /*
                   MENERIMA BEBERAPA NAMA KOLOM
                */

                const sku = String(

                    row["SKU"]

                    ||

                    row["sku"]

                    ||

                    ""

                ).trim();



                const name = String(

                    row["Nama Produk"] || row["Product Name"]

                    ||

                    row["NAMA PRODUK"]

                    ||

                    row["Nama"]

                    ||

                    row["nama"]

                    ||

                    ""

                ).trim();



                const category = String(

                    row["Kategori"] || row["Category"]

                    ||

                    row["KATEGORI"]

                    ||

                    ""

                ).trim();



 /* =====================================================
   PARSE HARGA EXCEL
   Menjaga harga marketplace seperti:
   26,999
   13,999
   7,999
   agar tidak berubah menjadi 27 / 14 / 8
===================================================== */

function parseExcelPrice(value){

    if(value === null || value === undefined || value === ""){
        return 0;
    }

    /* Jika Excel sudah membaca sebagai number */
    if(typeof value === "number"){

        /*
           Excel bisa membaca 26,999 sebagai
           angka 26.999.

           Untuk harga marketplace Indonesia,
           bagian desimal 999 dianggap pemisah
           ribuan.
        */

        const decimalPart =
            value.toString().split(".")[1];

        if(decimalPart && decimalPart.length === 3){

            return Math.round(value * 1000);
        }

        return value;
    }

    /* Jika Excel membaca sebagai text */
    let text = String(value).trim();

    /* Hilangkan Rp dan spasi */
    text = text
        .replace(/Rp/gi, "")
        .replace(/\s/g, "");

    /*
       Format:
       26,999
       13,999
       7,999

       dianggap sebagai harga ribuan.
    */
    if(/^\d+,\d{3}$/.test(text)){

        return Number(
            text.replace(",", "")
        );
    }

    /*
       Format:
       26.999
       13.999
       7.999
    */
    if(/^\d+\.\d{3}$/.test(text)){

        return Number(
            text.replace(".", "")
        );
    }

    /*
       Format angka biasa
       contoh:
       25000
       5000
    */
    text = text.replace(/,/g, "");

    const result = Number(text);

    return Number.isFinite(result)
        ? result
        : 0;
}


/* HARGA JUAL */

const price = parseExcelPrice(
    row["Harga Jual"] || row["Selling Price"]
    ||
    row["HARGA JUAL"]
    ||
    row["Harga"]
    ||
    0
);


/* HPP / MODAL */

const cost = parseExcelPrice(
    row["HPP"] || row["Cost"]
    ||
    row["Modal"] || row["Cost"]
    ||
    row["HPP / Modal"] || row["Product Cost"]
    ||
    row["HPP/MODAL"] || row["Product Cost"]
    ||
    0
);


const adminFeePercentRaw =
    row["Admin % SKU"] !== undefined ? row["Admin % SKU"] :
    (row["ADMIN % SKU"] !== undefined ? row["ADMIN % SKU"] :
    (row["Admin SKU %"] !== undefined ? row["Admin SKU %"] : ""));

const adminFeePercentText =
    String(adminFeePercentRaw)
        .trim()
        .replace("%", "")
        .trim();

/*
   Terima desimal Excel Indonesia maupun internasional:
   23,8
   23.8
   23,8%
   23.8%
*/
const adminFeePercent =
    adminFeePercentText === ""
        ? ""
        : Number(
            adminFeePercentText.replace(",", ".")
        );


const stock = Math.max(
    0,
    Number(
        row["Stok"] || row["Stock"]
        ||
        row["STOK"]
        ||
        row["Stock"]
        ||
        0
    )
);

                const importedStatusRaw =
                    row["Status Produk"] !== undefined ? row["Status Produk"] :
                    (row["Product Status"] !== undefined ? row["Product Status"] :
                    (row["STATUS PRODUK"] !== undefined ? row["STATUS PRODUK"] :
                    (row["Status"] !== undefined ? row["Status"] : "Aktif")));

                const importedStatus = String(importedStatusRaw).trim().toLowerCase();

                const status = importedStatus === ""
                    ? ""
                    : (
                        importedStatus === "tidak aktif" ||
                        importedStatus === "inactive" ||
                        importedStatus === "nonaktif" ||
                        importedStatus === "non-active"
                    ? "inactive"
                    : "active");


                /*
                   VALIDASI DATA
                */

                if(!sku){

                    errorCount++;

                    return;

                }

                if(adminFeePercent !== "" && (!Number.isFinite(adminFeePercent) || adminFeePercent < 0 || adminFeePercent > 100)){
                    errorCount++;
                    return;
                }



                /*
                   CEK SKU GANDA
                */

                const existingProduct =

                    products.find(function(product){

                        return (

                            product.sku.toLowerCase()

                            ===

                            sku.toLowerCase()

                        );

                    });



                /*
                   JIKA SUDAH ADA:
                   JANGAN BUAT DUPLIKAT
                */

                if(existingProduct){

                    existingProduct.name = name;
                    existingProduct.category = category;
                    existingProduct.price = price;
                    existingProduct.cost = cost;
                    existingProduct.adminFeePercent = adminFeePercent;
                    existingProduct.stock = stock;
                    existingProduct.status = status;
                    existingProduct.updatedAt = new Date().toISOString();

                    successCount++;

                    return;

                }

                if(!name){

                    errorCount++;

                    return;

                }

                /*
                   SKU BARU:
                   SIMPAN PRODUK BARU.
                */

                products.push({

                    id:
                        "product_" +
                        Date.now() +
                        "_" +
                        Math.random()
                        .toString(36)
                        .substring(2,7),


                    sku:sku,

                    name:name,

                    category:category,

                    price:price,

                    cost:cost,

                    adminFeePercent:adminFeePercent,
           
                    stock:stock,

                    status:status,


                    createdAt:
                        new Date().toISOString(),


                    updatedAt:
                        new Date().toISOString()

                });


                successCount++;

            });



            sellerBooksImportProgressUpdate(68,"saving");
            saveProductData({deferCloudPersist:true});
            /* Import mengirim satu snapshot penuh saja. Batalkan debounce yang
               dipicu oleh perubahan produk dan daily snapshot sebelum save ketat. */
            if(sellerBooksCloudSaveTimer){
                clearTimeout(sellerBooksCloudSaveTimer);
                sellerBooksCloudSaveTimer=null;
            }

            /*
               IMPORT MASTER PRODUK HARUS MENUNGGU KONFIRMASI CLOUD.
               Jangan mengumumkan import berhasil sebelum snapshot produk
               berhasil ditulis dan jumlah SKU hasil simpan terverifikasi.
            */
            try{
                if(!sellerBooksAuthUser || !sellerBooksCloudReady || sellerBooksCloudLoading){
                    throw new Error("Cloud belum siap. Import belum dapat diverifikasi.");
                }

                const expectedProducts = products.map(function(product){
                    return Object.assign({}, product);
                });
                const expectedSkuCount = expectedProducts.length;
                const expectedSnapshot = sellerBooksCloneCloudState(sellerBooksCloudState);
                const expectedBySku = new Map(expectedProducts.map(function(product){
                    return [String(product && product.sku || "").trim().toLowerCase(), product];
                }));
                function verifyImportedProducts(savedData){
                    let savedProducts = savedData && savedData.sellerbooks_products;
                    if(typeof savedProducts === "string"){
                        try{ savedProducts = JSON.parse(savedProducts); }
                        catch(error){ return false; }
                    }
                    if(!Array.isArray(savedProducts) || savedProducts.length !== expectedSkuCount) return false;
                    const savedBySku = new Map(savedProducts.map(function(product){
                        return [String(product && product.sku || "").trim().toLowerCase(), product];
                    }));
                    if(savedBySku.size !== expectedSkuCount) return false;
                    return Array.from(expectedBySku.entries()).every(function(entry){
                        const sku=entry[0], expected=entry[1], saved=savedBySku.get(sku);
                        if(!saved) return false;
                        return String(saved.name||"")===String(expected.name||"") &&
                            String(saved.category||"")===String(expected.category||"") &&
                            Number(saved.price||0)===Number(expected.price||0) &&
                            Number(saved.cost||0)===Number(expected.cost||0) &&
                            String(saved.adminFeePercent??"")===String(expected.adminFeePercent??"") &&
                            Number(saved.stock||0)===Number(expected.stock||0) &&
                            String(saved.status||"")===String(expected.status||"");
                    });
                }

                sellerBooksImportProgressUpdate(80,"saving");
                await sellerBooksPersistCloudDataStrict(
                    expectedSnapshot,
                    function(savedData){
                        return verifyImportedProducts(savedData);
                    }
                );

                sellerBooksImportProgressUpdate(93,"verifying");
                const verifiedCloudRow = await sellerBooksReadCloudRow();
                let verifiedProducts = verifiedCloudRow.data && verifiedCloudRow.data.sellerbooks_products;
                if(typeof verifiedProducts === "string"){
                    verifiedProducts = JSON.parse(verifiedProducts);
                }
                if(!verifyImportedProducts(verifiedCloudRow.data)){
                    throw new Error("Verifikasi cloud gagal: SKU atau isi produk yang tersimpan tidak sama dengan hasil import.");
                }
                sellerBooksImportProgressUpdate(100,"done");
                renderProducts();
                renderNotifications();
                sellerBooksAlert(
                    sellerBooksProductText("importDone")
                        .replace("{success}",successCount)
                        .replace("{duplicate}",duplicateCount)
                        .replace("{error}",errorCount)
                );
            }catch(saveError){
                console.error("Import Master Produk gagal diverifikasi di cloud:",saveError);
                sellerBooksImportProgressFailure(saveError);
                return;
            }


        }

        catch(error){


            console.error(error);


            sellerBooksAlert(

                sellerBooksProductText("importError")

            );

        }

        finally{
            /* Overlay tetap terlihat jika penyimpanan cloud gagal; hanya ditutup
               otomatis setelah jalur sukses atau kesalahan pemrosesan umum. */
            if(!document.getElementById("sellerBooksImportProgressClose")){
                sellerBooksImportProgressHide();
            }
        }

        /*
           RESET INPUT
        */

        input.value = "";

    };


    reader.readAsArrayBuffer(file);

}



/* =====================================================
   EXPORT EXCEL MASTER PRODUK SELLERBOOKS
   DENGAN DROPDOWN STATUS
===================================================== */



async function exportProducts(){

    try{

        const t=function(key){
            return sellerBooksProductText(key);
        };

        const language=sellerBooksCurrentLanguage();
        const fileName="MASTER_PRODUK_SELLERBOOKS.xlsx";

        /*
           ExcelJS tetap menjadi jalur utama agar dropdown Status
           dan struktur export lama tetap dipertahankan.
           Validasi hanya dibuat sampai jumlah baris yang relevan
           + 50 baris kosong, bukan 1000 baris.
        */
        if(typeof ExcelJS!=="undefined"){

            try{

                const workbook=new ExcelJS.Workbook();
                const worksheet=workbook.addWorksheet(t("exportMaster"));

                worksheet.addRow([
                    t("sku"),
                    t("productName"),
                    t("category"),
                    t("sellingPrice"),
                    t("cost"),
                    t("adminSku"),
                    t("stock"),
                    t("status")
                ]);

                if(Array.isArray(products) && products.length>0){

                    products.forEach(function(product){

                        worksheet.addRow([
                            product.sku || "",
                            product.name || "",
                            product.category || "",
                            Number(product.price) || 0,
                            Number(product.cost) || 0,
                            product.adminFeePercent === "" ||
                            product.adminFeePercent === undefined ||
                            product.adminFeePercent === null
                                ? ""
                                : Number(product.adminFeePercent),
                            Number(product.stock) || 0,
                            product.status === "active"
                                ? t("active")
                                : t("inactive")
                        ]);

                    });

                }else{

                    worksheet.addRow([
                        language==="en" ? "EXAMPLE-SKU-001" : "CONTOH-SKU-001",
                        language==="en" ? "Example Product Name" : "Contoh Nama Produk",
                        language==="en" ? "Example Category" : "Contoh Kategori",
                        10000,
                        5000,
                        "",
                        0,
                        t("active")
                    ]);

                }

                worksheet.getRow(1).font={bold:true};

                [22,35,22,18,18,16,15,20].forEach(function(width,index){
                    worksheet.getColumn(index+1).width=width;
                });

                worksheet.getColumn(4).numFmt="#,##0";
                worksheet.getColumn(5).numFmt="#,##0";
                worksheet.getColumn(6).numFmt="0.0#";
                worksheet.getColumn(7).numFmt="0.##";

                const statusFormula=
                    language==="en"
                        ? '"Active,Inactive"'
                        : '"Aktif,Tidak Aktif"';

                const validationEnd=Math.max(
                    rowsForExportCount()+50,
                    50
                );

                for(let row=2;row<=validationEnd;row++){

                    worksheet.getCell(row,8).dataValidation={
                        type:"list",
                        allowBlank:true,
                        formulae:[statusFormula],
                        showErrorMessage:true,
                        errorTitle:t("statusInvalidTitle"),
                        error:t("statusInvalid"),
                        showInputMessage:true,
                        promptTitle:t("statusPromptTitle"),
                        prompt:t("statusPrompt")
                    };

                }

                const instructionSheet=workbook.addWorksheet(t("exportInstructions"));

                [
                    [t("exportColumn"),t("exportGuide")],
                    [t("sku"),t("requiredSku")],
                    [t("productName"),t("requiredName")],
                    [t("category"),t("optionalCategory")],
                    [t("sellingPrice"),t("priceGuide")],
                    [t("cost"),t("costGuide")],
                    [t("stock"),t("stockGuide")],
                    [t("status"),t("statusGuide")],
                    [],
                    [t("exportRules"),""],
                    ["1",t("rule1")],
                    ["2",t("rule2")],
                    ["3",t("rule3")],
                    ["4",t("rule4")],
                    ["5",t("rule5")],
                    ["6",t("rule6")]
                ].forEach(function(row){
                    instructionSheet.addRow(row);
                });

                instructionSheet.getColumn(1).width=25;
                instructionSheet.getColumn(2).width=90;

                const readmeSheet=workbook.addWorksheet(t("exportReadme"));

                [
                    [t("exportTemplateTitle")],
                    [],
                    [t("exportTemplateDescription")],
                    [],
                    [t("howTo")],
                    ["1. "+t("how1")],
                    ["2. "+t("how2")],
                    ["3. "+t("how3")],
                    ["4. "+t("how4")],
                    ["5. "+t("how5")],
                    ["6. "+t("how6")],
                    ["7. "+t("how7")],
                    ["8. "+t("how8")],
                    ["9. "+t("how9")],
                    ["10. "+t("how10")],
                    [],
                    [t("importantNotes")],
                    [t("note1")],
                    [t("note2")],
                    [t("note3")],
                    [t("note4")]
                ].forEach(function(row){
                    readmeSheet.addRow(row);
                });

                readmeSheet.getColumn(1).width=100;

                const writePromise=workbook.xlsx.writeBuffer();

                const buffer=await Promise.race([
                    writePromise,
                    new Promise(function(_,reject){
                        setTimeout(function(){
                            reject(new Error("ExcelJS writeBuffer timeout"));
                        },10000);
                    })
                ]);

                await sellerBooksDownloadExcelBlob(
                    new Blob(
                        [buffer],
                        {
                            type:
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        }
                    ),
                    fileName
                );

                sellerBooksAlert(
                    sellerBooksProductText("exportSuccess"),
                    sellerBooksProductText("exportSuccessTitle")
                );

                return;

            }catch(excelJsError){

                console.warn(
                    "ExcelJS export gagal, menggunakan fallback XLSX:",
                    excelJsError
                );

            }

        }

        /*
           Fallback: SheetJS. Ini memastikan export tetap dapat
           menghasilkan file walaupun ExcelJS gagal/timeout.
        */
        if(typeof XLSX==="undefined"){

            if(typeof sellerBooksEnsureXLSX==="function"){
                const ready=await sellerBooksEnsureXLSX();
                if(!ready){
                    throw new Error("XLSX library tidak tersedia.");
                }
            }

        }

        if(typeof XLSX==="undefined"){
            throw new Error("Tidak ada library Excel yang tersedia.");
        }

        const rows=[
            [
                t("sku"),
                t("productName"),
                t("category"),
                t("sellingPrice"),
                t("cost"),
                t("adminSku"),
                t("stock"),
                t("status")
            ]
        ];

        if(Array.isArray(products) && products.length>0){

            products.forEach(function(product){
                rows.push([
                    product.sku || "",
                    product.name || "",
                    product.category || "",
                    Number(product.price) || 0,
                    Number(product.cost) || 0,
                    product.adminFeePercent === "" ||
                    product.adminFeePercent === undefined ||
                    product.adminFeePercent === null
                        ? ""
                        : Number(product.adminFeePercent),
                    Number(product.stock) || 0,
                    product.status === "active"
                        ? t("active")
                        : t("inactive")
                ]);
            });

        }else{

            rows.push([
                language==="en" ? "EXAMPLE-SKU-001" : "CONTOH-SKU-001",
                language==="en" ? "Example Product Name" : "Contoh Nama Produk",
                language==="en" ? "Example Category" : "Contoh Kategori",
                10000,
                5000,
                "",
                0,
                t("active")
            ]);

        }

        const fallbackWorkbook=XLSX.utils.book_new();
        const fallbackSheet=XLSX.utils.aoa_to_sheet(rows);

        fallbackSheet["!cols"]=[
            {wch:22},{wch:35},{wch:22},{wch:18},
            {wch:18},{wch:16},{wch:15},{wch:20}
        ];

        fallbackSheet["!autofilter"]={
            ref:"A1:H"+rows.length
        };

        XLSX.utils.book_append_sheet(
            fallbackWorkbook,
            fallbackSheet,
            t("exportMaster")
        );

        const instructionRows=[
            [t("exportColumn"),t("exportGuide")],
            [t("sku"),t("requiredSku")],
            [t("productName"),t("requiredName")],
            [t("category"),t("optionalCategory")],
            [t("sellingPrice"),t("priceGuide")],
            [t("cost"),t("costGuide")],
            [t("stock"),t("stockGuide")],
            [t("status"),t("statusGuide")],
            [],
            [t("exportRules"),""],
            ["1",t("rule1")],
            ["2",t("rule2")],
            ["3",t("rule3")],
            ["4",t("rule4")],
            ["5",t("rule5")],
            ["6",t("rule6")]
        ];

        const fallbackInstruction=XLSX.utils.aoa_to_sheet(instructionRows);
        fallbackInstruction["!cols"]=[{wch:25},{wch:90}];

        XLSX.utils.book_append_sheet(
            fallbackWorkbook,
            fallbackInstruction,
            t("exportInstructions")
        );

        const readmeRows=[
            [t("exportTemplateTitle")],
            [],
            [t("exportTemplateDescription")],
            [],
            [t("howTo")],
            ["1. "+t("how1")],
            ["2. "+t("how2")],
            ["3. "+t("how3")],
            ["4. "+t("how4")],
            ["5. "+t("how5")],
            ["6. "+t("how6")],
            ["7. "+t("how7")],
            ["8. "+t("how8")],
            ["9. "+t("how9")],
            ["10. "+t("how10")],
            [],
            [t("importantNotes")],
            [t("note1")],
            [t("note2")],
            [t("note3")],
            [t("note4")]
        ];

        const fallbackReadme=XLSX.utils.aoa_to_sheet(readmeRows);
        fallbackReadme["!cols"]=[{wch:100}];

        XLSX.utils.book_append_sheet(
            fallbackWorkbook,
            fallbackReadme,
            t("exportReadme")
        );

        const output=XLSX.write(
            fallbackWorkbook,
            {
                bookType:"xlsx",
                type:"array"
            }
        );

        await sellerBooksDownloadExcelBlob(
            new Blob(
                [output],
                {
                    type:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            ),
            fileName
        );

        sellerBooksAlert(
            sellerBooksProductText("exportSuccess"),
            sellerBooksProductText("exportSuccessTitle")
        );

    }catch(error){

        console.error(
            "SellerBooks Export Master Produk Error:",
            error
        );

        sellerBooksAlert(
            sellerBooksProductText("exportError") ||
            "Export Excel gagal. Silakan coba lagi."
        );

    }

}

function rowsForExportCount(){
    return Array.isArray(products) ? products.length + 1 : 2;
}

async function sellerBooksDownloadExcelBlob(blob,fileName){

    if(!blob || !blob.size){
        throw new Error("File Excel kosong.");
    }

    const isMobile=
        /Android|iPhone|iPad|iPod/i.test(
            navigator.userAgent || ""
        );

    if(
        isMobile &&
        typeof navigator.share==="function" &&
        typeof File!=="undefined" &&
        typeof navigator.canShare==="function"
    ){

        try{

            const file=new File(
                [blob],
                fileName,
                {type:blob.type}
            );

            if(navigator.canShare({files:[file]})){

                await navigator.share({
                    files:[file],
                    title:fileName
                });

                return;

            }

        }catch(shareError){

            console.warn(
                "Native share export gagal, lanjut download:",
                shareError
            );

        }

    }

    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");

    anchor.href=url;
    anchor.download=fileName;
    anchor.setAttribute("download",fileName);
    anchor.rel="noopener";
    anchor.style.position="fixed";
    anchor.style.left="-9999px";
    anchor.style.top="0";
    anchor.style.width="1px";
    anchor.style.height="1px";
    anchor.style.opacity="0";

    document.body.appendChild(anchor);

    try{
        anchor.click();
    }finally{

        setTimeout(function(){

            try{
                anchor.remove();
            }catch(e){
                try{
                    document.body.removeChild(anchor);
                }catch(e2){}
            }

            try{
                URL.revokeObjectURL(url);
            }catch(e3){}

        },3000);

    }

}



/* =====================================================
   SELLERBOOKS SALES IMPORT ENGINE
===================================================== */


/*
========================================================
FILE IMPORT SEMENTARA
========================================================
*/

let currentSalesImport = null;



/*
========================================================
DAFTAR KATA SKU
========================================================
*/

const SKU_KEYWORDS = [

    "nomor referensi sku",

    "seller sku",
    "sku seller",
    "sku blibli",

    "sellersku",

    "product sku",

    "merchant sku",

    "sku produk",

    "kode produk",

    "kode barang",

    "item sku",

    "product code",

    "seller_sku",

    "product_sku"

];



/*
========================================================
DAFTAR KATA QTY
========================================================
*/

const QTY_KEYWORDS = [

    "qty",

    "quantity",

    "jumlah",

    "jumlah produk",

    "kuantitas",

    "jumlah pesanan",

    "qty pesanan",

    "quantity ordered",

    "product quantity",
    
    "total barang",
    "total produk",

    "item quantity"

];



/* =====================================================
   MARKETPLACE FILE FINGERPRINT + PACKING ENGINE
===================================================== */
const SALES_MARKETPLACE_RULES={
    Shopee:{
        /* Shopee: file REGULER dan KILAT dapat berbeda posisi kolom.
           Semua kolom dicari berdasarkan nama header, bukan posisi.
           Packing WAJIB hanya No. Resi. */
        required:["nomor referensi sku","no. resi"],
        packingAliases:["no. resi"],
        orderAliases:["no. pesanan","booking sn"],
        priceAliases:["subtotal pesanan"],
        dateAliases:["waktu pesanan dibuat"]
    },

    TikTok:{
        required:["order id","seller sku","quantity"],
        packingAliases:["order id","tracking id"],
        orderAliases:["order id"],
        priceAliases:["sku subtotal after discount","sku unit original price"],
        dateAliases:["created time"]
    },

    Blibli:{
        /* Format Blibli saat ini:
           Nomor pesanan | SKU Seller | Total produk
           beserta kolom transaksi Blibli lainnya.
        */
        required:["nomor pesanan","sku seller","total produk"],
        /* Blibli memiliki 2 template:
           Template 1 -> kolom I: Nomor resi/AWB
           Template 2 -> kolom L: No. Awb
           Packing TIDAK memakai Nomor Pesanan/No. Order.
        */
        packingAliases:["nomor resi/awb","no. awb"],
        orderAliases:["nomor pesanan"],
        priceAliases:["harga produk","total harga produk"],
        dateAliases:["tanggal pesanan","tanggal order"]
    },

    Toco:{
        required:["invoice number","sku","jumlah produk"],
        packingAliases:["no. resi pesanan"],
        orderAliases:["invoice number"],
        priceAliases:["harga setelah diskon","total harga produk"],
        dateAliases:["waktu pesanan dibuat"]
    },

    Lazada:{
        /* Lazada khusus:
           SKU = sellerSku
           QTY = jumlah kemunculan sellerSku
           Packing = trackingCode saja
           orderItemId tidak digunakan
           Harga = unitPrice
        */
        required:["sellersku","ordernumber"],
        packingAliases:["trackingcode"],
        orderAliases:["ordernumber"],
        priceAliases:["unitprice"],
        dateAliases:["ordercreatedat","createdat","order date"]
    },

    Tokopedia:{
        required:["nomor invoice","nomor sku","jumlah produk dibeli"],
        packingAliases:["no resi / kode booking"],
        orderAliases:["nomor invoice"],
        priceAliases:["harga produk","harga"],
        dateAliases:["tanggal pembayaran"]
    }
};
function findAliasColumn(headers,aliases){const r=findBestColumn(headers,aliases||[]);return r&&r.column?r.column:null;}
function detectSalesMarketplace(headers,fileName){
    const h=headers.map(normalizeHeader);
    let best=null,scoreBest=0;

    /*
       SHOPEE KILAT / ADVANCE FULFILMENT:
       File logistik ini tidak membawa harga jual, jumlah produk,
       atau header "No. Pesanan". Setiap baris produk yang memiliki
       Booking SN + Nomor Referensi SKU + No. Resi adalah satu unit
       untuk perhitungan berbasis Master Produk.
    */
    const isShopeeKilatFile =
        h.indexOf("booking sn")>=0 &&
        h.indexOf("nomor referensi sku")>=0 &&
        h.indexOf("no. resi")>=0 &&
        h.indexOf("opsi pengiriman")>=0;

    if(isShopeeKilatFile){
        return {marketplace:"Shopee",score:100};
    }

    Object.keys(SALES_MARKETPLACE_RULES).forEach(function(name){
        const rule=SALES_MARKETPLACE_RULES[name];
        let score=0;
        rule.required.forEach(function(k){
            if(h.indexOf(normalizeHeader(k))>=0)score+=3;
        });
        if(name==="Lazada"&&h.indexOf("lazadaid")>=0)score+=4;
        if(name==="TikTok"&&h.indexOf("tracking id")>=0)score+=2;
        if(name==="Shopee"&&h.indexOf("no. pesanan")>=0)score+=4;
        if(name==="Tokopedia"&&h.indexOf("nomor invoice")>=0)score+=4;
        if(name==="Blibli"&&(h.indexOf("no. order")>=0||h.indexOf("nomor pesanan")>=0))score+=4;
        if(name==="Toco"&&h.indexOf("invoice number")>=0)score+=4;
        if(score>scoreBest){scoreBest=score;best=name;}
    });
    if(!best){
        const n=String(fileName||"").toLowerCase();
        ["Shopee","TikTok","Blibli","Toco","Lazada","Tokopedia"].some(function(x){
            if(n.includes(x.toLowerCase())){best=x;return true;}
            return false;
        });
    }
    return {marketplace:best,score:scoreBest};
}
function getPackingColumn(data){const rule=SALES_MARKETPLACE_RULES[data.marketplace];if(!rule)return null;for(let i=0;i<rule.packingAliases.length;i++){const c=findAliasColumn(data.headers,[rule.packingAliases[i]]);if(c)return c;}return null;}
function getFirstValue(row,headers,aliases){const c=findAliasColumn(headers,aliases);if(!c)return "";const i=headers.indexOf(c);return i>=0?row[i]:"";}
/* =====================================================
   HELPER LAPORAN PENJUALAN
===================================================== */

function parseSalesNumber(value){

    if(value === null || value === undefined){
        return 0;
    }

    if(typeof value === "number"){
        return Number.isFinite(value) ? value : 0;
    }

    let text = String(value)
        .trim()
        .replace(/Rp/gi,"")
        .replace(/\s/g,"");

    if(!text){
        return 0;
    }

    /*
       FORMAT INDONESIA
       50.000
       50.000,50
    */
    if(text.includes(",") && text.includes(".")){
        text = text
            .replace(/\./g,"")
            .replace(",",".");
    }

    /*
       50.000
       Jika tidak ada desimal koma,
       anggap titik sebagai pemisah ribuan.
    */
    else if(text.includes(".")){
        text = text.replace(/\./g,"");
    }

    else if(text.includes(",")){
        text = text.replace(",",".");
    }

    const number = Number(text);

    return Number.isFinite(number) ? number : 0;
}


/* Lazada ONLY: unitPrice kolom AV memakai desimal Excel, mis. 60000.00 = Rp60.000. */
function parseLazadaUnitPrice(value){
    if(value === null || value === undefined){
        return 0;
    }

    if(typeof value === "number"){
        return Number.isFinite(value) ? value : 0;
    }

    let text = String(value)
        .trim()
        .replace(/Rp/gi,"")
        .replace(/\s/g,"");

    if(!text){
        return 0;
    }

    /* Lazada: 60000.00 = 60000, bukan 6000000. */
    if(text.includes(",") && text.includes(".")){
        text = text.replace(/,/g,"");
    }else if(text.includes(",")){
        text = text.replace(/,/g,".");
    }

    const number = Number(text);
    return Number.isFinite(number) ? number : 0;}


function parseSalesDate(value){

    if(!value){
        return null;
    }

    if(value instanceof Date){
        return isNaN(value.getTime())
            ? null
            : value.toISOString();
    }

    /*
       Excel serial date
    */
    if(typeof value === "number"){

        const excelDate =
            new Date(
                Date.UTC(
                    1899,
                    11,
                    30
                ) +
                value * 86400000
            );

        if(!isNaN(excelDate.getTime())){
            return excelDate.toISOString();
        }
    }

    const text = String(value).trim();

    if(!text){
        return null;
    }

    const date = new Date(text);

    if(!isNaN(date.getTime())){
        return date.toISOString();
    }

    /*
       DD/MM/YYYY HH:mm:ss
    */
    const match =
        text.match(
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/
        );

    if(match){

        const day =
            Number(match[1]);

        const month =
            Number(match[2]) - 1;

        const year =
            Number(match[3]);

        const result =
            new Date(
                year,
                month,
                day
            );

        if(!isNaN(result.getTime())){
            return result.toISOString();
        }
    }

    return null;
}


/* =========================================================
   HARGA PENJUALAN WAJIB DARI MASTER PRODUK
   FILE MARKETPLACE HANYA MENYUMBANG SKU + QTY
========================================================= */

/* PATCH O: cache lookup Master Produk untuk laporan.
   Sumber storage dan runtime tetap dibandingkan seperti sebelumnya;
   yang berubah hanya cara lookup agar tidak JSON.parse + find() berulang. */
let sellerBooksMasterProductsCacheRaw = null;
let sellerBooksMasterProductsCacheMap = null;
let sellerBooksRuntimeProductsCacheSource = null;
let sellerBooksRuntimeProductsCacheMap = null;

function sellerBooksGetMasterProductsCache(){
    let storedMap = sellerBooksMasterProductsCacheMap;

    try{
        const raw =
            sellerBooksStorage.getItem("sellerbooks_products") || "[]";

        if(
            sellerBooksMasterProductsCacheMap === null ||
            sellerBooksMasterProductsCacheRaw !== raw
        ){
            const parsed = JSON.parse(raw);
            const map = new Map();

            if(Array.isArray(parsed)){
                parsed.forEach(function(product){
                    const key = String(product?.sku || "")
                        .trim()
                        .toLowerCase();

                    if(key){
                        map.set(key, product);
                    }
                });
            }

            sellerBooksMasterProductsCacheRaw = raw;
            sellerBooksMasterProductsCacheMap = map;
        }

        storedMap = sellerBooksMasterProductsCacheMap;
    }catch(error){
        storedMap = new Map();
    }

    return storedMap;
}

function sellerBooksGetRuntimeMasterProductsCache(){
    if(
        sellerBooksRuntimeProductsCacheMap === null ||
        sellerBooksRuntimeProductsCacheSource !== products
    ){
        const map = new Map();

        try{
            if(Array.isArray(products)){
                products.forEach(function(product){
                    const key = String(product?.sku || "")
                        .trim()
                        .toLowerCase();

                    if(key){
                        map.set(key, product);
                    }
                });
            }
        }catch(error){}

        sellerBooksRuntimeProductsCacheSource = products;
        sellerBooksRuntimeProductsCacheMap = map;
    }

    return sellerBooksRuntimeProductsCacheMap;
}

function getMasterProductBySku(sku){

    const normalizedSku =
        String(sku || "")
            .trim()
            .toLowerCase();

    if(!normalizedSku){
        return null;
    }

    /*
       SUMBER MASTER PRODUK HARUS KONSISTEN SAAT IMPORT.
       Storage dan runtime tetap dibandingkan. Cache hanya
       menghindari pembacaan/parsing/pencarian berulang.
    */
    let storedProduct = null;
    let runtimeProduct = null;

    try{
        storedProduct =
            sellerBooksGetMasterProductsCache().get(normalizedSku) || null;
    }catch(error){
        storedProduct = null;
    }

    try{
        runtimeProduct =
            sellerBooksGetRuntimeMasterProductsCache().get(normalizedSku) || null;
    }catch(error){
        runtimeProduct = null;
    }

    /*
       REGRESSION GUARD:
       Cache runtime sebelumnya hanya dibangun ulang ketika referensi array
       products berubah. Jika produk dimuat/diperbarui dengan mutasi array
       yang sama, cache dapat tertinggal dan SKU yang terlihat di Master
       Produk tidak ditemukan saat import. Jika kedua cache miss, gunakan
       pencarian langsung pada data runtime saat ini (perilaku lama).
    */
    if(!storedProduct && !runtimeProduct){
        try{
            const liveProduct = Array.isArray(products)
                ? products.find(function(item){
                    return String(item && item.sku || "")
                        .trim()
                        .toLowerCase() === normalizedSku;
                })
                : null;
            if(liveProduct){
                return {...liveProduct};
            }
        }catch(error){}
        return null;
    }

    if(!storedProduct){
        return {...runtimeProduct};
    }

    if(!runtimeProduct){
        return {...storedProduct};
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

    return merged;
}


/* =========================================================
   STOK OTOMATIS DARI IMPORT PENJUALAN
   Setiap QTY transaksi yang berhasil di-import akan
   mengurangi stok Master Produk berdasarkan SKU.
   SKU yang tidak ada di Master Produk tidak mengurangi stok.
========================================================= */
function reduceProductStockFromImport(record){

    if(!record || record.stockDeducted){
        return {
            changed:0,
            totalQty:0,
            missingSkus:[],
            details:[]
        };
    }

    /*
       SELALU AMBIL DATA MASTER PRODUK TERBARU DARI
       localStorage agar stok yang dipakai benar-benar
       stok terakhir, bukan salinan lama di memory.
    */
    try{
        const latestProducts = JSON.parse(
            sellerBooksStorage.getItem("sellerbooks_products") || "[]"
        );
        if(Array.isArray(latestProducts)){
            products = latestProducts;
        }
    }catch(error){}

    const transactions =
        Array.isArray(record.transactions)
            ? record.transactions
            : [];

    const qtyBySku = new Map();

    transactions.forEach(function(item){

        const sku =
            String(item && item.sku || '')
                .trim()
                .toLowerCase();

        const qty =
            Number(item && item.qty) || 0;

        if(!sku || qty <= 0){
            return;
        }

        qtyBySku.set(
            sku,
            (qtyBySku.get(sku) || 0) + qty
        );
    });

    let changed = 0;
    let totalQty = 0;
    const missingSkus = [];
    const stockDetails = [];

    qtyBySku.forEach(function(qty, sku){

        const product =
            products.find(function(item){
                return String(item && item.sku || '')
                    .trim()
                    .toLowerCase() === sku;
            }) || null;

        if(!product){
            missingSkus.push(sku);
            return;
        }

        const oldStock =
            Math.max(0, Number(product.stock) || 0);

        /*
           Hanya jumlah yang benar-benar berhasil dipotong
           yang dicatat untuk refund. Ini penting jika QTY
           penjualan lebih besar dari stok sehingga stok
           berhenti di 0.
        */
        const deductedQty = Math.min(oldStock, qty);
        const newStock = Math.max(0, oldStock - qty);

        product.stock = newStock;
        product.updatedAt =
            new Date().toISOString();

        if(oldStock !== newStock){
            changed++;
        }

        totalQty += qty;

        stockDetails.push({
            productId: product.id || "",
            sku: product.sku || sku,
            soldQty: qty,
            deductedQty: deductedQty,
            stockBefore: oldStock,
            stockAfter: newStock
        });
    });

    if(qtyBySku.size > 0){
        saveProductData();
    }

    record.stockDeducted = true;
    record.stockDeductedAt =
        new Date().toISOString();
    record.stockDeductedQty = totalQty;
    record.stockDeductedProductCount = changed;
    record.stockMissingSku = missingSkus;
    record.stockDeductionDetails = stockDetails;

    return {
        changed:changed,
        totalQty:totalQty,
        missingSkus:missingSkus,
        details:stockDetails
    };

}

/* =========================================================
   KEMBALIKAN STOK SAAT LAPORAN DIHAPUS
   Hanya mengembalikan stok yang benar-benar dipotong
   oleh import yang sedang dihapus.
========================================================= */
function restoreProductStockFromDeletedImports(deletedImports){

    if(!Array.isArray(deletedImports) || deletedImports.length === 0){
        return { restoredQty:0, productCount:0 };
    }

    /* Ambil Master Produk TERBARU sebelum refund stok. */
    let latestProducts = [];
    try{
        latestProducts = JSON.parse(
            sellerBooksStorage.getItem("sellerbooks_products") || "[]"
        );
    }catch(error){
        latestProducts = [];
    }

    if(!Array.isArray(latestProducts)){
        latestProducts = [];
    }

    products = latestProducts;

    const restoreByProduct = new Map();

    deletedImports.forEach(function(record){

        if(!record){
            return;
        }

        /*
           Import baru memiliki detail stok yang benar-benar
           dipotong. Gunakan ini agar refund tidak pernah
           mengembalikan stok lebih banyak dari yang dipotong.
        */
        if(Array.isArray(record.stockDeductionDetails)){

            record.stockDeductionDetails.forEach(function(detail){

                const deductedQty =
                    Math.max(0, Number(detail && detail.deductedQty) || 0);

                if(deductedQty <= 0){
                    return;
                }

                const key =
                    String(detail.productId || "sku:" + String(detail.sku || "").trim().toLowerCase());

                restoreByProduct.set(
                    key,
                    {
                        productId: detail.productId || "",
                        sku: detail.sku || "",
                        qty: (restoreByProduct.get(key)?.qty || 0) + deductedQty
                    }
                );
            });

            return;
        }

        /*
           Fallback untuk laporan lama yang dibuat sebelum detail
           stok tersedia. Jumlah QTY transaksi dikembalikan satu kali.
        */
        const transactions =
            Array.isArray(record.transactions)
                ? record.transactions
                : [];

        transactions.forEach(function(item){

            const sku =
                String(item && item.sku || "")
                    .trim()
                    .toLowerCase();

            const qty =
                Number(item && item.qty) || 0;

            if(!sku || qty <= 0){
                return;
            }

            const key = "sku:" + sku;
            const existing = restoreByProduct.get(key);

            restoreByProduct.set(
                key,
                {
                    productId: existing?.productId || "",
                    sku: sku,
                    qty: (existing?.qty || 0) + qty
                }
            );
        });
    });

    let restoredQty = 0;
    let productCount = 0;

    restoreByProduct.forEach(function(info){

        const product =
            products.find(function(item){
                const sameId =
                    info.productId &&
                    String(item && item.id || "") === String(info.productId);

                const sameSku =
                    String(item && item.sku || "")
                        .trim()
                        .toLowerCase() === String(info.sku || "")
                        .trim()
                        .toLowerCase();

                return sameId || sameSku;
            }) || null;

        if(!product){
            return;
        }

        const oldStock =
            Math.max(0, Number(product.stock) || 0);

        const restoreQty =
            Math.max(0, Number(info.qty) || 0);

        if(restoreQty <= 0){
            return;
        }

        product.stock = oldStock + restoreQty;
        product.updatedAt =
            new Date().toISOString();

        restoredQty += restoreQty;
        productCount++;
    });

    if(restoreByProduct.size > 0){
        saveProductData();
    }

    return {
        restoredQty:restoredQty,
        productCount:productCount
    };
}

function getReportTransactionSalesAmount(item){

    if(!item){
        return 0;
    }

    /*
       SNAPSHOT HARIAN:
       - Marketplace/API memiliki salesAmount yang sudah berasal dari
         harga transaksi/order, sehingga nilai tersebut tetap dipakai.
       - Untuk transaksi manual SellerBooks, transaksi hari ini boleh
         membaca Master Produk terbaru.
       - Setelah hari berganti, gunakan priceSnapshot yang disimpan
         saat transaksi/import dibuat.
       - Dengan demikian edit harga Master Produk tidak mengubah
         penjualan hari-hari sebelumnya.
    */
    if(
        item.marketplace === "TikTok" ||
        item.marketplace === "TikTok Shop" ||
        item.marketplace === "Shopee" ||
        item.marketplace === "Blibli" ||
        item.marketplace === "Lazada"
    ){
        return Number(item.salesAmount) || 0;
    }

    const qty =
        Number(item.qty) || 0;

    if(qty <= 0){
        return 0;
    }

    return getReportTransactionPrice(item) * qty;

}


function getSalesAmount(row,data){

    const skuIndex =
        data.skuIndex != null
            ? data.skuIndex
            : data.headers.indexOf(
                data.skuColumn
            );

    const qtyIndex =
        data.qtyIndex != null
            ? data.qtyIndex
            : data.headers.indexOf(
                data.qtyColumn
            );

    const sku =
        skuIndex >= 0
            ? String(
                row[skuIndex] || ""
            ).trim()
            : "";

    const qty =
        data.marketplace === "Lazada" ||
        (data.marketplace === "Shopee" && data.qtyColumn === "__SHOPEE_QTY_PER_ROW__")

            ? 1

            : (
                qtyIndex >= 0
                    ? parseSalesNumber(
                        row[qtyIndex]
                    )
                    : 0
            );

    if(data.marketplace === "Lazada"){

        /* Lazada: Harga Jual wajib dari kolom AV (unitPrice). */
        return parseLazadaUnitPrice(row[47]) * qty;

    }

    if(
        data.marketplace === "TikTok" ||
        data.marketplace === "TikTok Shop"
    ){
        /* TikTok file export: kolom SKU Subtotal After Discount. */
        return parseSalesNumber(row[15]);
    }

    if(data.marketplace === "Shopee"){
        const rule =
            SALES_MARKETPLACE_RULES[data.marketplace];
        const marketplacePrice =
            getFirstValue(
                row,
                data.headers,
                rule && rule.priceAliases ? rule.priceAliases : []
            );

        /*
           SHOPEE ONLY:
           Jika Subtotal Pesanan (kolom U pada file reguler)
           memiliki nilai > 0, gunakan subtotal tersebut.
           Jika 0 / "-" / kosong, fallback ke Harga Jual
           Master Produk x QTY.
        */
        const subtotal = parseSalesNumber(marketplacePrice);
        if(subtotal > 0){
            return subtotal;
        }

        const product = getMasterProductBySku(sku);
        const masterPrice = product
            ? (Number(product.price) || 0)
            : 0;

        return masterPrice * qty;
    }

    if(data.marketplace === "Blibli"){
        /*
           Blibli memiliki 2 format file:
           - Format 1: Harga produk di kolom I
           - Format 2: Harga produk di kolom W
           Kunci berdasarkan HEADER "Harga produk", sehingga kedua
           format terbaca tanpa memakai Master Produk dan tanpa
           mengambil "Total" order.
        */
        const blibliPriceIndex = data.headers.findIndex(function(header){
            return normalizeHeader(header) === "harga produk";
        });
        const fallbackPriceIndex = blibliPriceIndex >= 0
            ? blibliPriceIndex
            : (
                row.length > 22 && row[22] !== "" ? 22 :
                8
            );
        return parseSalesNumber(row[fallbackPriceIndex]) * qty;
    }

    const product =
        getMasterProductBySku(sku);

    /*
       SKU tidak ditemukan:
       transaksi tetap diimport,
       harga = Rp0,
       HPP = Rp0,
       dan masuk daftar peringatan.
    */
    if(!product){
        return 0;
    }

    const masterPrice =
        Number(
            product.price
        ) || 0;

    return masterPrice * qty;
}


function getSalesTransactionDate(row,data){

    const rule =
        SALES_MARKETPLACE_RULES[
            data.marketplace
        ];

    if(!rule){
        return null;
    }

    const value =
        getFirstValue(
            row,
            data.headers,
            rule.dateAliases || []
        );

    return parseSalesDate(value);
}
function getCleanSalesRows(data){if(!data)return [];const si=data.skuIndex!=null?data.skuIndex:data.headers.indexOf(data.skuColumn),qi=data.qtyIndex!=null?data.qtyIndex:data.headers.indexOf(data.qtyColumn);return data.dataRows.filter(function(row){const sku=String(row[si]||"").trim().toLowerCase(),qty=String(row[qi]||"").trim().toLowerCase();return sku!=="seller sku input by the seller in the product system."&&qty!=="sku sold quantity in the order."&&(sku||qty);});}
function calculateUniquePacking(data){const c=getPackingColumn(data),i=c?data.headers.indexOf(c):-1,u=new Set();getCleanSalesRows(data).forEach(function(row){if(i>=0){const v=String(row[i]||"").trim();if(v)u.add(v);}});return {column:c,count:u.size,identifiers:Array.from(u)};}
function populateSalesStoreAccounts(){

    const select =
        document.getElementById(
            "salesStoreAccount"
        );

    const info =
        document.getElementById(
            "salesStoreAccountInfo"
        );

    if(
        !select ||
        !currentSalesImport
    ){
        return;
    }


    /* =========================================
       RESET DROPDOWN
    ========================================= */

    select.innerHTML =
        '<option value="">'+sellerBooksSalesImportText("chooseStore")+'</option>';


    /* =========================================
       AMBIL MARKETPLACE TERDETEKSI
    ========================================= */

    const detectedMarketplace =
        String(
            currentSalesImport.marketplace || ""
        )
        .trim()
        .toLowerCase();


    /*
       DETEKSI MENGGUNAKAN NAMA SINGKAT,
       SEDANGKAN DATABASE MARKETPLACE
       BISA MENGGUNAKAN NAMA LENGKAP.
    */

    const marketplaceAlias = {

        "shopee":
            "shopee",

        "tiktok":
            "tiktok",

        "tiktok shop":
            "tiktok",

        "tokopedia":
            "tokopedia",

        "lazada":
            "lazada",

        "blibli":
            "blibli",

        "toco":
            "toco"

    };


    const normalizedMarketplace =
        marketplaceAlias[
            detectedMarketplace
        ] || detectedMarketplace;


    /* =========================================
       CARI MARKETPLACE BERDASARKAN ID / NAMA
    ========================================= */

    const mp =
        marketplaces.find(function(item){

            const itemId =
                String(
                    item.id || ""
                )
                .trim()
                .toLowerCase();

            const itemName =
                String(
                    item.name || ""
                )
                .trim()
                .toLowerCase();

            const sameMarketplace =
                itemId === normalizedMarketplace
                ||
                itemName === detectedMarketplace
                ||
                (
                    normalizedMarketplace === "tiktok" &&
                    (
                        itemId === "tiktok" ||
                        itemName === "tiktok shop" ||
                        itemName === "tiktokshop"
                    )
                );

            if(!sameMarketplace){
                return false;
            }

            /* Jika ada marketplace duplikat, pilih yang memiliki
               akun toko aktif agar dropdown Import tidak kosong. */
            return stores.some(function(store){
                return store.status === "active" &&
                    String(store.marketplaceId || "") === String(item.id || "");
            });

        }) ||
        marketplaces.find(function(item){
            const itemId = String(item.id || "").trim().toLowerCase();
            const itemName = String(item.name || "").trim().toLowerCase();

            return itemId === normalizedMarketplace
                || itemName === detectedMarketplace
                || (normalizedMarketplace === "tiktok" &&
                    (itemId === "tiktok" || itemName === "tiktok shop" || itemName === "tiktokshop"));
        });


    /* =========================================
       SIMPAN MARKETPLACE ID
    ========================================= */

    currentSalesImport.marketplaceId =
        mp
        ? mp.id
        : null;


    /* =========================================
       JIKA MARKETPLACE TIDAK DITEMUKAN
    ========================================= */

    if(
        !currentSalesImport.marketplaceId
    ){

        if(info){

            info.innerText =
                sellerBooksSalesImportText("marketplaceUnknown");

            info.style.color =
                "#dc2626";

        }

        return;
    }


    /* =========================================
       CARI AKUN TOKO
       SESUAI MARKETPLACE
    ========================================= */

    const list =
        stores.filter(function(store){

            return (

                store.status === "active"

                &&

                String(
                    store.marketplaceId
                ) ===
                String(
                    currentSalesImport.marketplaceId
                )

            );

        });


    /* =========================================
       MASUKKAN AKUN TOKO KE DROPDOWN
    ========================================= */

    list.forEach(function(store){

        const option =
            document.createElement(
                "option"
            );

        option.value =
            store.id;

        option.textContent =
            store.name +
            (
                store.code
                ? " • " + store.code
                : ""
            );

        select.appendChild(
            option
        );

    });


    /* =========================================
       INFO AKUN TOKO
    ========================================= */

    if(info){

        if(list.length){

            info.innerText =
                list.length +
                (sellerBooksCurrentLanguage()==="en" ? " active store accounts available." : " akun toko aktif tersedia.");

            info.style.color =
                "";

        }else{

            info.innerText =
                sellerBooksCurrentLanguage()==="en" ? "No active store accounts are available for this marketplace." : "Belum ada akun toko aktif untuk marketplace ini.";

            info.style.color =
                "#dc2626";

        }

    }

}
function updatePackingCalculation(){if(!currentSalesImport)return;const r=calculateUniquePacking(currentSalesImport),unit=Math.max(0,Number(document.getElementById("packingCostPerOrder")?.value)||0);const c=document.getElementById("uniquePackingCount"),t=document.getElementById("totalPackingImportCost"),i=document.getElementById("packingIdentifierInfo");if(c)c.innerText=r.count.toLocaleString("id-ID");if(t)t.innerText=formatRupiah(r.count*unit);if(i)i.innerText=r.column?sellerBooksSalesImportText("packingIdentity")+" "+r.column+sellerBooksSalesImportText("uniquePackingSuffix"):sellerBooksSalesImportText("packingNotFound");}
function buildSalesImportFingerprint(currentImport, storeId, transactions){
    /*
       IDENTITAS FILE/ISI IMPORT.
       Tidak bergantung pada nomor baris Excel atau waktu upload.
       Jika isi transaksi yang sama pernah tersimpan pada akun toko
       dan marketplace yang sama, import dianggap sudah pernah masuk.
    */
    const marketplace = String(
        currentImport?.marketplace || ""
    ).trim().toLowerCase();

    const store = String(storeId || "").trim().toLowerCase();

    const list = (Array.isArray(transactions) ? transactions : [])
        .map(function(item){
            return [
                String(item.sku || "").trim().toLowerCase(),
                String(item.orderId || "").trim().toLowerCase(),
                String(item.packingId || "").trim().toLowerCase(),
                Number(item.qty) || 0,
                Number(item.salesAmount) || 0
            ].join("~");
        })
        .sort();

    const source = marketplace + "|" + store + "|" + list.join("||");
    /* Hash sederhana dan stabil, cukup untuk identitas import lokal. */
    let hash = 2166136261;
    for(let i = 0; i < source.length; i++){
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return "SBIMP-" + (hash >>> 0).toString(16) + "-" + list.length;
}


function saveSalesImportData(){

    if(!currentSalesImport){
        return null;
    }

    const storeId =
        document.getElementById(
            "salesStoreAccount"
        ).value;

    const storesForImport =
        getReportStoresData();

    const store =
        storesForImport.find(function(x){
            return String(x.id) ===
                String(storeId);
        });

    const packing =
        calculateUniquePacking(
            currentSalesImport
        );

    const packingInput =
        document.getElementById(
            "packingCostPerOrder"
        );

    const packingUnit =
        Math.max(
            0,
            Number(
                packingInput?.value
            ) || 0
        );

    const rows =
        getCleanSalesRows(
            currentSalesImport
        );

    const skuIndex =
        currentSalesImport.headers.indexOf(
            currentSalesImport.skuColumn
        );

    const qtyIndex =
        currentSalesImport.headers.indexOf(
            currentSalesImport.qtyColumn
        );

    const rule =
        SALES_MARKETPLACE_RULES[
            currentSalesImport.marketplace
        ];

    const packingIndex =
        packing.column
            ? currentSalesImport.headers.indexOf(
                packing.column
            )
            : -1;

    /* =====================================================
       TANGGAL LAPORAN PERMANEN
    ===================================================== */
    const importedAt =
        new Date().toISOString();

    const reportDate =
        getIndonesiaDateString(importedAt);

    let transactions =
        rows.map(function(row,rowIndex){

            const qty =
                currentSalesImport.marketplace === "Lazada"

                    ? 1

                    : (
                        currentSalesImport.marketplace === "Shopee" &&
                        currentSalesImport.qtyColumn === "__SHOPEE_QTY_PER_ROW__"
                            ? 1
                            : (
                                qtyIndex >= 0
                                    ? parseSalesNumber(
                                        row[qtyIndex]
                                    )
                                    : 0
                            )
                    );

            const salesAmount =
                getSalesAmount(
                    row,
                    currentSalesImport
                );

            const transactionDate =
                getSalesTransactionDate(
                    row,
                    currentSalesImport
                );

            const transactionSku =
                skuIndex >= 0
                    ? String(row[skuIndex] || "").trim()
                    : "";

            /*
               SNAPSHOT IMPORT — ambil Master Produk dari sumber
               runtime + cloud/cache yang sudah diselaraskan.
               Nilai ini dibekukan di transaksi dan tidak boleh
               dihitung ulang dari Master Produk setelah hari berganti.
            */
            const masterProductAtImport =
                getMasterProductBySku(transactionSku);

            const adminFeeSkuSnapshot =
                masterProductAtImport &&
                masterProductAtImport.adminFeePercent !== undefined &&
                masterProductAtImport.adminFeePercent !== null &&
                masterProductAtImport.adminFeePercent !== ""
                    ? Number(masterProductAtImport.adminFeePercent)
                    : "";

            const priceSnapshot =
                qty > 0
                    ? (Number(salesAmount) || 0) / qty
                    : (masterProductAtImport ? (Number(masterProductAtImport.price) || 0) : 0);

            const costSnapshot =
                masterProductAtImport
                    ? (Number(masterProductAtImport.cost) || 0)
                    : 0;

            return {

                marketplace:
                    currentSalesImport.marketplace,

                marketplaceId:
                    currentSalesImport.marketplaceId,

                storeId:
                    storeId,

                storeName:
                    store
                        ? store.name
                        : "",

                /*
                   Admin % SKU transaksi.
                   Disimpan langsung agar urutan sumber pertama
                   selalu memiliki nilai bila tersedia saat import.
                */
                adminFeeSku:
                    adminFeeSkuSnapshot,

                /*
                   Snapshot Admin % Akun saat import.
                   Field adminFeePercent tetap dipertahankan untuk
                   kompatibilitas data lama.
                */
                adminFeeAccountSnapshot:
                    store
                        ? (Number(store.feePercent) || 0)
                        : 0,

                adminFeePercent:
                    store
                        ? (Number(store.feePercent) || 0)
                        : 0,

                /* Snapshot Admin % SKU saat import. */
                adminFeeSkuSnapshot:
                    adminFeeSkuSnapshot,

                priceSnapshot:
                    priceSnapshot,

                costSnapshot:
                    costSnapshot,

                sku:
                    skuIndex >= 0
                        ? String(
                            row[skuIndex] || ""
                        ).trim()
                        : "",

                qty:
                    qty,

                salesAmount:
                    salesAmount,

                orderId:
                    currentSalesImport.marketplace === "Shopee"
                        ? (
                            String(
                                getFirstValue(
                                    row,
                                    currentSalesImport.headers,
                                    ["no. pesanan"]
                                ) || ""
                            ).trim()
                            ||
                            String(
                                getFirstValue(
                                    row,
                                    currentSalesImport.headers,
                                    ["booking sn"]
                                ) || ""
                            ).trim()
                        )
                        : (
                            rule
                                ? getFirstValue(
                                    row,
                                    currentSalesImport.headers,
                                    rule.orderAliases
                                )
                                : ""
                        ),

                packingId:
                    packingIndex >= 0
                        ? String(
                            row[packingIndex] || ""
                        ).trim()
                        : "",

                transactionDate:
                    transactionDate,

                reportDate:
                    reportDate,

                /* Penanda baris khusus Lazada agar
                   SKU yang sama dalam order yang sama
                   tidak digabung menjadi 1 transaksi. */
                sourceRowIndex:
                    currentSalesImport.marketplace === "Lazada"
                        ? rowIndex
                        : null,

                importedAt:
                    importedAt
            };

        });


    const imports =
        JSON.parse(
            sellerBooksStorage.getItem(
                "sellerbooks_sales_imports"
            ) || "[]"
        );

    /* =====================================================
       CEK FILE/ISI IMPORT SUDAH PERNAH DISIMPAN
       Jika file yang sama sudah pernah masuk untuk marketplace
       + akun toko yang sama, IMPORT DITOLAK TOTAL.
       Tidak boleh ada nilai penjualan/QTY baru yang masuk.
    ===================================================== */
    const importFingerprint =
        buildSalesImportFingerprint(
            currentSalesImport,
            storeId,
            transactions
        );

    const duplicateImport =
        imports.some(function(existingImport){
            if(
                String(existingImport.marketplace || "").trim().toLowerCase() !==
                String(currentSalesImport.marketplace || "").trim().toLowerCase()
            ){
                return false;
            }

            if(
                String(existingImport.storeId || "").trim() !==
                String(storeId || "").trim()
            ){
                return false;
            }

            if(
                existingImport.importFingerprint &&
                String(existingImport.importFingerprint) === importFingerprint
            ){
                return true;
            }

            /*
               BACKWARD COMPATIBILITY:
               record lama belum memiliki fingerprint.
               Buat fingerprint dari transaksi lama agar file
               yang sama tetap ditolak setelah update ini.
            */
            const oldFingerprint =
                buildSalesImportFingerprint(
                    {
                        marketplace: existingImport.marketplace
                    },
                    existingImport.storeId,
                    existingImport.transactions || []
                );

            return oldFingerprint === importFingerprint;
        });

    if(duplicateImport){
        console.warn(
            "Import ditolak: file/data penjualan yang sama sudah pernah disimpan.",
            importFingerprint
        );
        return null;
    }



    /* =====================================================
       UPDATE / MERGE IMPORT
       Import berikutnya tidak menggandakan transaksi lama.
       Kunci transaksi:
       Marketplace + Akun Toko + Order ID + SKU.
       Jika Order ID kosong, gunakan Packing ID + SKU.
       Transaksi yang sudah ada tetap dipertahankan;
       hanya transaksi baru yang ditambahkan.
    ===================================================== */
    const existingTransactionKeys =
        new Set();

    imports.forEach(function(existingImport){

        (existingImport.transactions || [])
            .forEach(function(existingTransaction){

                /*
                   Gunakan identity yang sama dengan Cloud Sync.
                   Khusus Lazada, sourceRowIndex ikut menjadi bagian
                   identity agar baris SKU yang sama dalam Order Number
                   yang sama tidak digabung.
                */
                const identityKey =
                    sellerBooksGetSalesImportIdentity(existingTransaction);

                if(identityKey){
                    existingTransactionKeys.add(identityKey);
                }

            });

    });


    const newTransactions =
        [];

    const incomingTransactionKeys =
        new Set();

    transactions.forEach(function(transaction){

        /*
           Gunakan identity pusat yang sama dengan Cloud Sync.
           Khusus Lazada, sourceRowIndex menjaga setiap baris Excel
           tetap terpisah meskipun Order Number + Seller SKU sama.
        */
        const identityKey =
            sellerBooksGetSalesImportIdentity(transaction);

        /*
           identityKey sekarang menjadi satu-satunya sumber kunci
           transaksi. Variabel orderKey/packingKey lama tidak lagi
           dipakai karena sudah dihapus saat penyelarasan identity.
        */
        if(
            identityKey &&
            existingTransactionKeys.has(identityKey)
        ){
            return;
        }

        /*
           Cegah baris dengan identity yang sama muncul dua kali
           dalam file import yang sedang diproses.
           Khusus Lazada, sourceRowIndex membuat setiap baris Excel
           tetap berbeda.
        */
        if(
            identityKey &&
            incomingTransactionKeys.has(identityKey)
        ){
            return;
        }

        if(identityKey){
            incomingTransactionKeys.add(identityKey);
        }

        newTransactions.push(
            transaction
        );

    });

    /*
       Jika seluruh isi file sudah pernah disimpan,
       jangan membuat record kosong/Rp0.
       Kembalikan null agar muncul:
       "Data penjualan gagal disimpan."
    */
    if(
        transactions.length > 0 &&
        newTransactions.length === 0
    ){
        return null;
    }

    transactions =
        newTransactions;


    const totalSales =
        transactions.reduce(
            function(total,item){

                return total +
                    getReportTransactionSalesAmount(item);

            },
            0
        );


    const totalQty =
        transactions.reduce(
            function(total,item){

                return total +
                    Number(
                        item.qty
                    ) || 0;

            },
            0
        );


    /* =====================================================
       PACKING HANYA UNTUK TRANSAKSI BARU
       Satu order tetap dihitung satu kali.
    ===================================================== */
    const newPackingKeys =
        new Set();

    transactions.forEach(function(item){

        const isShopeePacking =
            String(item.marketplace || "").trim().toLowerCase() === "shopee";

        const packingKey =
            String(
                isShopeePacking
                    ? (item.packingId || "")
                    : (item.packingId || item.orderId || "")
            ).trim().toLowerCase();

        if(packingKey){
            newPackingKeys.add(
                String(item.marketplaceId || item.marketplace || "")
                    .trim().toLowerCase() + "|" +
                String(item.storeId || "")
                    .trim().toLowerCase() + "|" +
                packingKey
            );
        }

    });

    const newPackingCount =
        newPackingKeys.size;


    const record = {

        id:
            "sales_import_" +
            Date.now(),

        fileName:
            currentSalesImport.fileName,

        fileType:
            currentSalesImport.fileType,

        marketplace:
            currentSalesImport.marketplace,

        marketplaceId:
            currentSalesImport.marketplaceId,

        storeId:
            storeId,

        storeName:
            store
                ? store.name
                : "",

        adminFeePercent:
            store
                ? (Number(store.feePercent) || 0)
                : 0,

        skuColumn:
            currentSalesImport.skuColumn,

        qtyColumn:
            currentSalesImport.qtyColumn,

        packingColumn:
            packing.column,

        uniquePackingCount:
            newPackingCount,

        packingCostPerOrder:
            packingUnit,

        totalPackingCost:
            newPackingCount *
            packingUnit,

        rowCount:
            transactions.length,

        totalSales:
            totalSales,

        totalQty:
            totalQty,

        reportDate:
            reportDate,

        importedAt:
            importedAt,

        importFingerprint:
            importFingerprint,

        transactions:
            transactions
    };


    /* =====================================================
       STOK OTOMATIS
       Hanya transaksi BARU yang dikurangi dari stok.
    ===================================================== */
    const stockResult =
        reduceProductStockFromImport(record);

    record.stockDeductedQty =
        stockResult.totalQty;


    /*
       Jika tidak ada transaksi baru, tidak perlu membuat
       record import kosong yang dapat mengganggu laporan.
    */
    if(!transactions.length){
        return null;
    }


    imports.push(record);


    sellerBooksStorage.setItem(
        "sellerbooks_sales_imports",
        JSON.stringify(imports)
    );


    sellerBooksStorage.setItem(
        "sellerbooks_packing_unit_cost",
        String(packingUnit)
    );


    return record;
}

/*
========================================================
NORMALISASI HEADER
========================================================
*/

function normalizeHeader(value){

    return String(value || "")

        .toLowerCase()

        .trim()

        .replace(/[_\-]+/g," ")

        .replace(/\s+/g," ");

}



/*
========================================================
CARI KOLOM TERBAIK
========================================================
*/

function findBestColumn(headers,keywords){

    let bestMatch = null;

    let bestScore = 0;


    headers.forEach(function(header){


        const normalizedHeader =

            normalizeHeader(header);



        keywords.forEach(function(keyword){


            const normalizedKeyword =

                normalizeHeader(keyword);



            let score = 0;



            /*
            EXACT MATCH
            */

            if(

                normalizedHeader ===
                normalizedKeyword

            ){

                score = 100;

            }



            /*
            HEADER MENGANDUNG KEYWORD
            */

            else if(

                normalizedHeader.includes(
                    normalizedKeyword
                )

            ){

                score = 80;

            }



            /*
            KEYWORD MENGANDUNG HEADER
            */

            else if(

                normalizedKeyword.includes(
                    normalizedHeader
                )

            ){

                score = 60;

            }



            if(score > bestScore){

                bestScore = score;

                bestMatch = header;

            }


        });


    });



    return {

        column:bestMatch,

        score:bestScore

    };

}



/*
========================================================
ANALYZE FILE
========================================================
*/

async function analyzeSalesFile(input){


    const file = input.files[0];


    if(!file){

        return;

    }



    /*
    VALIDASI FORMAT
    */

    const fileName =

        file.name.toLowerCase();



    const supportedFormats = [

        ".xlsx",

        ".xls",

        ".csv"

    ];



    const validFormat =

        supportedFormats.some(function(format){

            return fileName.endsWith(format);

        });



    if(!validFormat){


        sellerBooksAlert(

            sellerBooksSalesImportText("unsupported")

        );


        input.value = "";

        return;

    }



    /*
    CEK SHEETJS
    */

    if(!(await sellerBooksEnsureXLSX())){
        return;
    }



    /*
    TAMPILKAN STATUS
    */

    const analysisBox =

        document.getElementById(
            "salesImportAnalysis"
        );


    analysisBox.style.display = "block";


    document.getElementById(
        "analysisStatus"
    ).innerText =

        sellerBooksSalesImportText("readingFile");


    document.getElementById(
        "continueSalesImportButton"
    ).disabled = true;



    /*
    FILE READER
    */

    const reader = new FileReader();



    reader.onload = function(event){


        try{


            const workbook =

                XLSX.read(

                    event.target.result,

                    {

                        type:"array"

                    }

                );



            /*
            AMBIL SHEET PERTAMA
            UNTUK FASE AWAL
            */

            const firstSheetName =

                workbook.SheetNames[0];


            const worksheet =

                workbook.Sheets[
                    firstSheetName
                ];



            /*
            CONVERT KE ARRAY
            */

            const rawData =

                XLSX.utils.sheet_to_json(

                    worksheet,

                    {

                        header:1,

                        defval:""

                    }

                );



            if(rawData.length < 2){


                sellerBooksAlert(

                    sellerBooksSalesImportText("insufficient")

                );


                resetSalesImport();

                return;

            }



            /*
            CARI HEADER YANG VALID

            Engine memeriksa beberapa
            baris pertama karena laporan
            marketplace kadang memiliki
            judul laporan di atas header.
            */

            let headerRowIndex = -1;

            let headers = [];



            const maxCheckRows =

                Math.min(

                    rawData.length,

                    15

                );



            for(

                let i = 0;

                i < maxCheckRows;

                i++

            ){


                const row = rawData[i];


                const nonEmptyValues =

                    row.filter(function(value){

                        return String(value).trim() !== "";

                    });


                /*
                HEADER minimal memiliki
                2 kolom terisi
                */

                if(nonEmptyValues.length >= 2){


                    const possibleHeaders =

                        row.map(function(value){

                            return String(value).trim();

                        });


                    /*
                    CEK APAKAH ADA KATA SKU
                    ATAU QTY
                    */

                    const skuTest =

                        findBestColumn(

                            possibleHeaders,

                            SKU_KEYWORDS

                        );


                    const qtyTest =

                        findBestColumn(

                            possibleHeaders,

                            QTY_KEYWORDS

                        );



                    if(

                        skuTest.column ||

                        qtyTest.column

                    ){


                        headerRowIndex = i;

                        headers = possibleHeaders;

                        break;

                    }

                }

            }



            /*
            JIKA TIDAK MENEMUKAN
            HEADER BERDASARKAN SKU/QTY
            GUNAKAN BARIS PERTAMA
            */

            if(headerRowIndex === -1){


                headerRowIndex = 0;


                headers =

                    rawData[0].map(function(value){

                        return String(value).trim();

                    });

            }



            /*
            HAPUS HEADER KOSONG
            TAPI TETAP PERTAHANKAN POSISI
            UNTUK ANALISIS
            */

            const cleanHeaders =

                headers.filter(function(header){

                    return header !== "";

                });



            /*
            CARI SKU
            */

            let skuResult =

                findBestColumn(

                    cleanHeaders,

                    SKU_KEYWORDS

                );



            /*
            CARI QTY
            */

            let qtyResult =

                findBestColumn(

                    cleanHeaders,

                    QTY_KEYWORDS

                );


            /* =================================================
               KHUSUS LAZADA
               Tidak ada kolom QTY di file Lazada.
               SKU wajib sellerSku.
               QTY dihitung dari jumlah kemunculan sellerSku.
            ================================================= */
            const detectedLazada =

                detectSalesMarketplace(

                    cleanHeaders,

                    file.name

                ).marketplace === "Lazada";


            if(detectedLazada){

                const lazadaSkuResult =

                    findBestColumn(

                        cleanHeaders,

                        [

                            "sellersku",

                            "seller sku"

                        ]

                    );

                if(lazadaSkuResult.column){

                    skuResult = lazadaSkuResult;

                }

                qtyResult = {

                    column:"__LAZADA_QTY_BY_SELLERSKU__",

                    score:100

                };

            }

            /* =================================================
               KHUSUS SHOPEE
               File REGULER memiliki kolom Jumlah.
               File KILAT/Advance Fulfilment dapat tidak memiliki
               kolom Jumlah dan No. Pesanan. Dalam kondisi itu
               setiap baris SKU dihitung 1 pcs.
               SKU tetap dicari dari Nomor Referensi SKU.
            ================================================= */
            const detectedShopee =
                detectSalesMarketplace(
                    cleanHeaders,
                    file.name
                ).marketplace === "Shopee";

            if(detectedShopee){

                const shopeeSkuResult =
                    findBestColumn(
                        cleanHeaders,
                        [
                            "nomor referensi sku"
                        ]
                    );

                if(shopeeSkuResult.column){
                    skuResult = shopeeSkuResult;
                }

                const shopeeQtyResult =
                    findBestColumn(
                        cleanHeaders,
                        [
                            "jumlah"
                        ]
                    );

                qtyResult = shopeeQtyResult.column
                    ? shopeeQtyResult
                    : {
                        column:"__SHOPEE_QTY_PER_ROW__",
                        score:100
                    };
            }



            /*
            JUMLAH BARIS DATA
            */

            const dataRows =

                rawData.slice(

                    headerRowIndex + 1

                )

                .filter(function(row){


                    return row.some(function(value){

                        return String(value).trim() !== "";

                    });


                });



            /*
            SIMPAN HASIL ANALISIS
            */

            currentSalesImport = {

                file:file,

                fileName:file.name,

                fileType:

                    fileName.split(".").pop()

                    .toUpperCase(),


                sheetName:

                    firstSheetName,


                rawData:rawData,


                headerRowIndex:

                    headerRowIndex,


                headers:

                    cleanHeaders,


                dataRows:

                    dataRows,


                skuColumn:

                    skuResult.column,


                skuScore:

                    skuResult.score,


                qtyColumn:

                    qtyResult.column,


                qtyScore:

                    qtyResult.score,

                marketplace:
                    detectSalesMarketplace(cleanHeaders,file.name).marketplace,

                marketplaceScore:
                    detectSalesMarketplace(cleanHeaders,file.name).score,

                skuIndex:
                    skuResult.column
                        ? cleanHeaders.indexOf(skuResult.column)
                        : -1,

                qtyIndex:
                    detectedLazada ||
                    (detectedShopee && qtyResult.column === "__SHOPEE_QTY_PER_ROW__")
                        ? -1
                        : (
                            qtyResult.column
                                ? cleanHeaders.indexOf(qtyResult.column)
                                : -1
                        ),

                /* Lazada: Harga Jual wajib dari kolom AV (index 47). */
                priceColumn:
                    detectedLazada
                        ? (cleanHeaders[47] || "unitPrice")
                        : null,

                priceIndex:
                    detectedLazada
                        ? 47
                        : -1

            };



            /*
            TAMPILKAN HASIL
            */

            renderSalesAnalysis();


        }

        catch(error){


            console.error(error);


            sellerBooksAlert(

                sellerBooksSalesImportText("unreadable") +
                (sellerBooksCurrentLanguage()==="en" ? "\n\nMake sure the file is not corrupted." : "\n\nPastikan file tidak rusak.")

            );


            resetSalesImport();

        }


    };



    reader.readAsArrayBuffer(file);

}



/*
========================================================
RENDER HASIL ANALISIS
========================================================
*/

function renderSalesAnalysis(){


    if(!currentSalesImport){

        return;

    }



    const data =

        currentSalesImport;

    const marketplaceElement=document.getElementById("detectedMarketplaceName");
    if(marketplaceElement) marketplaceElement.value=data.marketplace?data.marketplace+" ✓":sellerBooksSalesImportText("notDetected");




    /*
    FILE INFO
    */

    document.getElementById(

        "analysisFileName"

    ).innerText =

        data.fileName;



    document.getElementById(

        "analysisFileType"

    ).innerText =

        data.fileType;



    document.getElementById(

        "analysisRowCount"

    ).innerText =

        data.dataRows.length
        .toLocaleString("id-ID");



    document.getElementById(

        "analysisColumnCount"

    ).innerText =

        data.headers.length;



    /*
    STATUS
    */

    const statusElement =

        document.getElementById(
            "analysisStatus"
        );


    /*
    SKU
    */

    const skuResultElement =

        document.getElementById(
            "skuRecognitionResult"
        );


    const skuConfidenceElement =

        document.getElementById(
            "skuRecognitionConfidence"
        );


    if(data.skuColumn){


        skuResultElement.innerText =

            data.skuColumn;


        skuConfidenceElement.innerText =

            sellerBooksSalesImportText("autoDetected") +

            data.skuScore +

            sellerBooksSalesImportText("matchSuffix");


    }

    else{


        skuResultElement.innerText =

            sellerBooksSalesImportText("notFound");


        skuConfidenceElement.innerText =

            sellerBooksSalesImportText("skuNotRecognized");

    }



    /*
    QTY
    */

    const qtyResultElement =

        document.getElementById(
            "qtyRecognitionResult"
        );


    const qtyConfidenceElement =

        document.getElementById(
            "qtyRecognitionConfidence"
        );


    if(
        data.marketplace === "Lazada"
    ){

        qtyResultElement.innerText =

            sellerBooksSalesImportText("lazadaQty");

        qtyConfidenceElement.innerText =

            sellerBooksSalesImportText("lazadaQtyInfo");

    }

    else if(
        data.marketplace === "Shopee" &&
        data.qtyColumn === "__SHOPEE_QTY_PER_ROW__"
    ){

        qtyResultElement.innerText =
            sellerBooksSalesImportText("shopeeQty");

        qtyConfidenceElement.innerText =
            sellerBooksSalesImportText("shopeeQtyInfo");

    }

    else if(data.qtyColumn){


        qtyConfidenceElement.innerText =

            sellerBooksSalesImportText("autoDetected") +

            data.qtyScore +

            sellerBooksSalesImportText("matchSuffix");


    }

    else{


        qtyResultElement.innerText =

            sellerBooksSalesImportText("notFound");


        qtyConfidenceElement.innerText =

            sellerBooksSalesImportText("qtyNotRecognized");

    }


    /* =====================================================
       HARGA JUAL RECOGNITION - KHUSUS LAZADA
       Sumber wajib: kolom AV = unitPrice
    ===================================================== */

    const lazadaPriceCard =
        document.getElementById("lazadaPriceRecognitionCard");

    const lazadaPriceResult =
        document.getElementById("lazadaPriceRecognitionResult");

    const lazadaPriceConfidence =
        document.getElementById("lazadaPriceRecognitionConfidence");

    if(data.marketplace === "Lazada"){

        if(lazadaPriceCard){
            lazadaPriceCard.style.display = "";
        }

        if(lazadaPriceResult){
            lazadaPriceResult.innerText =
                sellerBooksSalesImportText("lazadaPrice");
        }

        if(lazadaPriceConfidence){
            lazadaPriceConfidence.innerText =
                sellerBooksSalesImportText("lazadaPriceInfo");
        }

    }else{

        if(lazadaPriceCard){
            lazadaPriceCard.style.display = "none";
        }

    }



    /*
    HEADER TAGS
    */

    const headersContainer =

        document.getElementById(
            "detectedHeaders"
        );


    headersContainer.innerHTML = "";



    data.headers.forEach(function(header){


        const tag =

            document.createElement("div");


        tag.className =

            "header-tag";


        /*
        TANDAI SKU
        */

        if(

            header === data.skuColumn

        ){

            tag.classList.add(
                "sku-header"
            );

        }


        /*
        TANDAI QTY
        */

        if(

            header === data.qtyColumn

        ){

            tag.classList.add(
                "qty-header"
            );

        }


        tag.innerText = header;


        headersContainer.appendChild(tag);


    });



    /*
    VALIDASI
    */

    const continueButton =

        document.getElementById(
            "continueSalesImportButton"
        );



    if(

        data.skuColumn &&

        data.qtyColumn

    ){


        statusElement.innerText =

            sellerBooksSalesImportText("statusFound");


        continueButton.disabled = false;

    }

    else{


        statusElement.innerText =

            sellerBooksSalesImportText("statusManual");


        continueButton.disabled = true;

    }

}



/* =====================================================
   RESET IMPORT PENJUALAN - KEMBALI KE AWAL
===================================================== */

function resetSalesImport(){

    /* RESET DATA SEMENTARA */
    currentSalesImport = null;


    /* RESET INPUT FILE */
    const fileInput =
        document.getElementById(
            "salesImportFile"
        );

    if(fileInput){
        fileInput.value = "";
    }


    /* SEMBUNYIKAN HASIL ANALISIS */
    const analysisBox =
        document.getElementById(
            "salesImportAnalysis"
        );

    if(analysisBox){
        analysisBox.style.display = "none";
    }


    /* RESET KOLOM SKU */
    const skuSelect =
        document.getElementById(
            "manualSkuColumn"
        );

    if(skuSelect){

        skuSelect.innerHTML =
            '<option value="">'+sellerBooksSalesImportText("chooseSku")+'</option>';

        skuSelect.value = "";

    }


    /* RESET KOLOM QTY */
    const qtySelect =
        document.getElementById(
            "manualQtyColumn"
        );

    if(qtySelect){

        qtySelect.innerHTML =
            '<option value="">'+sellerBooksSalesImportText("chooseQty")+'</option>';

        qtySelect.value = "";

    }


    /* RESET MARKETPLACE */
    const marketplace =
        document.getElementById(
            "detectedMarketplaceName"
        );

    if(marketplace){
        marketplace.value =
            sellerBooksSalesImportText("notDetected");
    }


    /* RESET AKUN TOKO */
    const storeSelect =
        document.getElementById(
            "salesStoreAccount"
        );

    if(storeSelect){

        storeSelect.innerHTML =
            '<option value="">'+sellerBooksSalesImportText("chooseStore")+'</option>';

        storeSelect.value = "";

    }


    /* RESET INFO AKUN */
    const storeInfo =
        document.getElementById(
            "salesStoreAccountInfo"
        );

    if(storeInfo){

        storeInfo.innerText =
            sellerBooksSalesImportText("storeRequired");

        storeInfo.style.color = "";

    }


    /* RESET BIAYA PACKING */
    const packingInput =
        document.getElementById(
            "packingCostPerOrder"
        );

    if(packingInput){
        packingInput.value = "";
    }


    /* RESET HASIL PACKING */
    const packingCount =
        document.getElementById(
            "uniquePackingCount"
        );

    if(packingCount){
        packingCount.innerText = "0";
    }


    const packingTotal =
        document.getElementById(
            "totalPackingImportCost"
        );

    if(packingTotal){
        packingTotal.innerText = "Rp 0";
    }


    const packingInfo =
        document.getElementById(
            "packingIdentifierInfo"
        );

    if(packingInfo){

        packingInfo.innerText =
            sellerBooksSalesImportText("packingIdentifier");

    }


    /* RESET STATUS VALIDASI */
    const validation =
        document.getElementById(
            "previewValidationStatus"
        );

    if(validation){

        validation.className =
            "preview-validation-status";

        validation.innerText =
            sellerBooksSalesImportText("validationChoose");

    }


    /* RESET STATUS ANALISIS */
    const analysisStatus =
        document.getElementById(
            "analysisStatus"
        );

    if(analysisStatus){

        analysisStatus.innerText =
            sellerBooksSalesImportText("waitingAnalysis");

    }


    /* RESET INFO FILE */
    const fileName =
        document.getElementById(
            "analysisFileName"
        );

    if(fileName){
        fileName.innerText = "-";
    }


    const fileType =
        document.getElementById(
            "analysisFileType"
        );

    if(fileType){
        fileType.innerText = "-";
    }


    const rowCount =
        document.getElementById(
            "analysisRowCount"
        );

    if(rowCount){
        rowCount.innerText = "0";
    }


    /* RESET TOMBOL LANJUTKAN */
    const continueButton =
        document.getElementById(
            "continueSalesImportButton"
        );

    if(continueButton){
        continueButton.disabled = true;
    }


    /* RESET TOMBOL KONFIRMASI */
    const confirmButton =
        document.getElementById(
            "confirmSalesColumnsButton"
        );

    if(confirmButton){
        confirmButton.disabled = true;
    }

    /* RESET PREVIEW */
    const previewFileName =
        document.getElementById(
            "previewFileName"
        );

    if(previewFileName){
        previewFileName.innerText = "-";
    }


    const previewRowCount =
        document.getElementById(
            "previewRowCount"
        );

    if(previewRowCount){
        previewRowCount.innerText = "0";
    }

}



/* =====================================================
   FASE 2 - LANJUT KE PREVIEW
===================================================== */

function continueSalesImport(){

    if(!currentSalesImport){

        sellerBooksAlert(
            sellerBooksSalesImportText("noFile")
        );

        return;

    }

    openSalesPreview();

}


/* =====================================================
   FASE 2 - OPEN SALES PREVIEW
===================================================== */

function openSalesPreview(){


    /*
    PASTIKAN ADA DATA FILE
    */

    if(!currentSalesImport){

        return;

    }


    /*
    AMBIL DATA HASIL ANALISIS FASE 1
    */

    const data = currentSalesImport;



    /* =========================================
       TAMPILKAN NAMA FILE
    ========================================= */

    document.getElementById(
        "previewFileName"
    ).innerText = data.fileName;



    /* =========================================
       TAMPILKAN JUMLAH BARIS DATA
    ========================================= */

    document.getElementById(
        "previewRowCount"
    ).innerText =

        data.dataRows.length
        .toLocaleString("id-ID");



    /* =========================================
       AMBIL DROPDOWN SKU
    ========================================= */

    const skuSelect =

        document.getElementById(
            "manualSkuColumn"
        );



    /* =========================================
       AMBIL DROPDOWN QTY
    ========================================= */

    const qtySelect =

        document.getElementById(
            "manualQtyColumn"
        );



    /* =========================================
       KOSONGKAN DROPDOWN SEBELUM DIISI ULANG
    ========================================= */

    skuSelect.innerHTML =

        '<option value="">'+sellerBooksSalesImportText("chooseSku")+'</option>';


    qtySelect.innerHTML =

        '<option value="">'+sellerBooksSalesImportText("chooseQty")+'</option>';


    /* =========================================
       KHUSUS LAZADA:
       QTY bukan kolom fisik.
       SellerBooks menghitung jumlah kemunculan sellerSku.
    ========================================= */

    if(data.marketplace === "Lazada"){

        const lazadaQtyOption =

            document.createElement("option");

        lazadaQtyOption.value =
            "__LAZADA_QTY_BY_SELLERSKU__";

        lazadaQtyOption.textContent =
            sellerBooksSalesImportText("lazadaQty");

        qtySelect.appendChild(
            lazadaQtyOption
        );

        qtySelect.value = "__LAZADA_QTY_BY_SELLERSKU__";

    }

    if(
        data.marketplace === "Shopee" &&
        data.qtyColumn === "__SHOPEE_QTY_PER_ROW__"
    ){
        const shopeeQtyOption = document.createElement("option");
        shopeeQtyOption.value = "__SHOPEE_QTY_PER_ROW__";
        shopeeQtyOption.textContent = sellerBooksSalesImportText("shopeeQty");
        qtySelect.appendChild(shopeeQtyOption);
        qtySelect.value = "__SHOPEE_QTY_PER_ROW__";
    }



    /* =========================================
       MASUKKAN SEMUA HEADER FILE
       KE DROPDOWN
    ========================================= */

    data.headers.forEach(function(header){


        /*
        OPTION UNTUK SKU
        */

        const skuOption =

            document.createElement("option");


        skuOption.value = header;

        skuOption.textContent = header;


        skuSelect.appendChild(
            skuOption
        );



        /*
        OPTION UNTUK QTY
        */

        const qtyOption =

            document.createElement("option");


        qtyOption.value = header;

        qtyOption.textContent = header;


        qtySelect.appendChild(
            qtyOption
        );


    });



    /* =========================================
       AUTO PILIH SKU
       JIKA SUDAH DITEMUKAN ENGINE
    ========================================= */

    if(data.skuColumn){

        skuSelect.value =
            data.skuColumn;

    }



    /* =========================================
       AUTO PILIH QTY
       JIKA SUDAH DITEMUKAN ENGINE
    ========================================= */

    if(data.qtyColumn){

        qtySelect.value =
            data.qtyColumn;

    }



    /* =========================================
       BUKA MODAL PREVIEW
    ========================================= */

const marketplaceElement=document.getElementById("detectedMarketplaceName");
    if(marketplaceElement) marketplaceElement.value=data.marketplace?data.marketplace+" ✓":"Tidak dikenali";
    populateSalesStoreAccounts();
    const packingInput=document.getElementById("packingCostPerOrder");
    if(packingInput) packingInput.value=sellerBooksStorage.getItem("sellerbooks_packing_unit_cost")||"";
    updatePackingCalculation();

document.getElementById(
    "salesPreviewModal"
).classList.add(
    "active"
);

updatePreviewColumns();

}
/* =====================================================
   FASE 2 - UPDATE PREVIEW COLUMNS
===================================================== */

function updatePreviewColumns(){


    /*
    PASTIKAN DATA IMPORT ADA
    */

    if(!currentSalesImport){

        return;

    }


    /* =========================================
       AMBIL PILIHAN KOLOM SKU
    ========================================= */

    const skuColumn =

        document.getElementById(
            "manualSkuColumn"
        ).value;



    /* =========================================
       AMBIL PILIHAN KOLOM QTY
    ========================================= */

    const qtyColumn =

        document.getElementById(
            "manualQtyColumn"
        ).value;



    /* =========================================
       AMBIL STATUS VALIDASI
    ========================================= */

    const statusElement =

        document.getElementById(
            "previewValidationStatus"
        );



    /* =========================================
       AMBIL TOMBOL KONFIRMASI
    ========================================= */

    const confirmButton =

        document.getElementById(
            "confirmSalesColumnsButton"
        );



    /*
    RESET STATUS
    */

    statusElement.className =

        "preview-validation-status";


    confirmButton.disabled = true;



    /* =========================================
       KONDISI 1:
       SKU ATAU QTY BELUM DIPILIH
    ========================================= */

    const isLazadaImport =

        currentSalesImport.marketplace === "Lazada";

    const isShopeePerRow =
        currentSalesImport.marketplace === "Shopee" &&
        qtyColumn === "__SHOPEE_QTY_PER_ROW__";


    if(

    !skuColumn ||

    (!qtyColumn && !isLazadaImport)

){


    statusElement.innerText =

        isLazadaImport

            ? sellerBooksSalesImportText("lazadaQtyInfo")

            : sellerBooksSalesImportText("validationChoose");


    /*
    UPDATE PREVIEW TABLE
    */

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );


    return;

}


    /* =========================================
       KONDISI 2:
       SKU DAN QTY TIDAK BOLEH SAMA
    ========================================= */

    if(

    !isLazadaImport &&
    !isShopeePerRow &&

    skuColumn === qtyColumn

){


    statusElement.classList.add(

        "error"

    );


    statusElement.innerText =

        sellerBooksSalesImportText("sameColumns");


    /*
    TETAP UPDATE PREVIEW
    */

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );


    return;

}



    /* =========================================
       KONDISI 3:
       SEMUA SUDAH BENAR
    ========================================= */

    statusElement.classList.add(

        "success"

    );


    statusElement.innerText =

        isLazadaImport

            ? sellerBooksSalesImportText("lazadaReady")

            : isShopeePerRow
                ? sellerBooksSalesImportText("shopeeReady")
                : sellerBooksSalesImportText("columnsReady");


    /*
    AKTIFKAN TOMBOL KONFIRMASI
    */

    confirmButton.disabled = false;

/*
UPDATE PREVIEW TABLE
*/

renderPreviewTable(
    skuColumn,
    qtyColumn
);

    /*
    LANGKAH 6 NANTI:

    renderPreviewTable(
        skuColumn,
        qtyColumn
    );

    */

}

/* =====================================================
   FASE 2 - RENDER PREVIEW TABLE
===================================================== */

function renderPreviewTable(

    skuColumn,

    qtyColumn

){


    /*
    AMBIL BAGIAN BODY TABLE
    */

    const body =

        document.getElementById(
            "previewTableBody"
        );



    /*
    AMBIL HEADER SKU
    */

    const skuHeader =

        document.getElementById(
            "previewSkuHeader"
        );



    /*
    AMBIL HEADER QTY
    */

    const qtyHeader =

        document.getElementById(
            "previewQtyHeader"
        );



    /*
    KOSONGKAN DATA TABLE LAMA
    */

    body.innerHTML = "";



    /*
    UBAH NAMA HEADER SESUAI
    KOLOM YANG DIPILIH CLIENT
    */

    skuHeader.innerText =

        skuColumn || "SKU";


    qtyHeader.innerText =

        (
            currentSalesImport &&
            currentSalesImport.marketplace === "Lazada"
        )
            ? "QTY • sellerSku"
            : (
                currentSalesImport &&
                currentSalesImport.marketplace === "Shopee" &&
                qtyColumn === "__SHOPEE_QTY_PER_ROW__"
            )
                ? (sellerBooksCurrentLanguage()==="en" ? "QTY • 1 pc/row" : "QTY • 1 pcs/baris")
                : (qtyColumn || "QTY");



    /*
    PASTIKAN DATA IMPORT ADA
    */

    if(!currentSalesImport){

        return;

    }



    /*
    AMBIL DATA IMPORT
    */

    const data = currentSalesImport;



    /*
    CARI POSISI / INDEX
    KOLOM SKU
    */

    const skuIndex =

        data.headers.indexOf(
            skuColumn
        );



    /*
    CARI POSISI / INDEX
    KOLOM QTY
    */

    const qtyIndex =

        data.headers.indexOf(
            qtyColumn
        );



    /* =========================================
   BERSIHKAN BARIS KETERANGAN / INSTRUKSI
   BAWAAN FILE MARKETPLACE
========================================= */

const cleanRows = data.dataRows.filter(function(row){

    const skuValue = String(
        row[skuIndex] || ""
    )
    .trim()
    .toLowerCase();


    const qtyValue = String(
        row[qtyIndex] || ""
    )
    .trim()
    .toLowerCase();


    /*
    FILTER KHUSUS FILE TIKTOK

    Baris ini bukan transaksi,
    hanya keterangan bawaan export TikTok.
    */

    if(
        skuValue ===
        "seller sku input by the seller in the product system."
    ){

        return false;

    }


    if(
        qtyValue ===
        "sku sold quantity in the order."
    ){

        return false;

    }


    /*
    JANGAN TAMPILKAN BARIS
    YANG SKU DAN QTY-NYA SAMA-SAMA KOSONG
    */

    if(!skuValue && !qtyValue){

        return false;

    }


    return true;

});


/* =========================================
   TAMPILKAN SEMUA TRANSAKSI
   Nomor baris otomatis 1, 2, 3, dst.
========================================= */

const previewRows = cleanRows;



    /*
    LOOP SETIAP BARIS
    */

    previewRows.forEach(

        function(row,index){


            /*
            BUAT BARIS BARU
            */

            const tr =

                document.createElement(
                    "tr"
                );



            /*
            =====================
            NOMOR
            =====================
            */

            const numberCell =

                document.createElement(
                    "td"
                );


            numberCell.innerText =

                index + 1;



            /*
            =====================
            SKU
            =====================
            */

            const skuCell =

                document.createElement(
                    "td"
                );


            skuCell.innerText =

                skuIndex >= 0

                ? row[skuIndex] || ""

                : "";



            /*
            =====================
            QTY
            =====================
            */

            const qtyCell =

                document.createElement(
                    "td"
                );


            qtyCell.innerText =

                (
                    data.marketplace === "Lazada" ||
                    (
                        data.marketplace === "Shopee" &&
                        qtyColumn === "__SHOPEE_QTY_PER_ROW__"
                    )
                )

                ? "1"

                : (
                    qtyIndex >= 0
                        ? row[qtyIndex] || ""
                        : ""
                );



            /*
            MASUKKAN SEMUA CELL
            KE BARIS
            */

            tr.appendChild(
                numberCell
            );


            tr.appendChild(
                skuCell
            );


            tr.appendChild(
                qtyCell
            );



            /*
            MASUKKAN BARIS
            KE TABLE
            */

            body.appendChild(
                tr
            );


        }

    );


}

/* =====================================================
   FASE 2 - KONFIRMASI KOLOM FINAL
===================================================== */

async function confirmSalesColumns(){

    if(!currentSalesImport){

        sellerBooksAlert(
            sellerBooksSalesImportText("noImportData")
        );

        return;
    }


    const skuColumn =
        document.getElementById(
            "manualSkuColumn"
        ).value;


    const qtyColumn =
        document.getElementById(
            "manualQtyColumn"
        ).value;


    if(!skuColumn){

        sellerBooksAlert(
            sellerBooksSalesImportText("chooseSkuFirst")
        );

        return;
    }


    const isLazadaImport =

        currentSalesImport.marketplace === "Lazada";

    const isShopeePerRow =
        currentSalesImport.marketplace === "Shopee" &&
        qtyColumn === "__SHOPEE_QTY_PER_ROW__";


    if(
        !qtyColumn &&
        !isLazadaImport
    ){

        sellerBooksAlert(
            sellerBooksSalesImportText("chooseQtyFirst")
        );

        return;
    }


    if(
        !isLazadaImport &&
        !isShopeePerRow &&
        skuColumn === qtyColumn
    ){

        sellerBooksAlert(
            sellerBooksSalesImportText("sameColumns")
        );

        return;
    }


    currentSalesImport.skuColumn =
        skuColumn;

    currentSalesImport.qtyColumn =
        isLazadaImport
            ? "__LAZADA_QTY_BY_SELLERSKU__"
            : qtyColumn;

    currentSalesImport.skuIndex =
        currentSalesImport.headers.indexOf(
            skuColumn
        );

    currentSalesImport.qtyIndex =
        (isLazadaImport || isShopeePerRow)
            ? -1
            : currentSalesImport.headers.indexOf(
                qtyColumn
            );

    currentSalesImport.columnsConfirmed =
        true;

    currentSalesImport.confirmedAt =
        new Date().toISOString();


    if(!currentSalesImport.marketplace){

        sellerBooksAlert(
            sellerBooksSalesImportText("marketplaceUnknown")
        );

        return;
    }


    const storeId =
        document.getElementById(
            "salesStoreAccount"
        ).value;


    if(!storeId){

        sellerBooksAlert(
            sellerBooksSalesImportText("chooseStoreFirst")
        );

        return;
    }


    const packingInput =
        document.getElementById(
            "packingCostPerOrder"
        );


    if(
        !packingInput ||
        packingInput.value === ""
    ){

        sellerBooksAlert(
            sellerBooksSalesImportText("packingRequired")
        );

        return;
    }


    /* Tampilkan status segera dan cegah klik konfirmasi berulang. */
    const confirmButton=document.getElementById("confirmSalesColumnsButton");
    if(confirmButton && confirmButton.dataset.saving==="true")return;
    const originalButtonText=confirmButton ? confirmButton.textContent : "";
    if(confirmButton){
        confirmButton.dataset.saving="true";
        confirmButton.disabled=true;
        confirmButton.textContent=sellerBooksCurrentLanguage()==="en"
            ? "Saving… Please wait"
            : "Sedang menyimpan…";
        confirmButton.setAttribute("aria-busy","true");
    }
    const restoreConfirmButton=function(){
        if(!confirmButton)return;
        confirmButton.dataset.saving="false";
        confirmButton.disabled=false;
        confirmButton.textContent=originalButtonText;
        confirmButton.removeAttribute("aria-busy");
    };

    /* SIMPAN DATA */
    let record = null;

    try{
        record = saveSalesImportData();
    }catch(error){
        console.error("SellerBooks: saveSalesImportData gagal:", error);
        restoreConfirmButton();
        sellerBooksAlert(
            sellerBooksSalesImportText("saveError") +
            (error?.message || String(error))
        );

        return;
    }

    if(!record){

        restoreConfirmButton();
        sellerBooksAlert(
            sellerBooksSalesImportText("saveFailed")
        );

        return;
    }

    /* Jangan nyatakan import berhasil sebelum snapshot penjualan
       benar-benar tersimpan dan terkonfirmasi oleh Supabase. */
    try{
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
    }catch(error){
        console.error("Import Penjualan belum terkonfirmasi tersimpan di cloud:",error);
        restoreConfirmButton();
        sellerBooksAlert(sellerBooksCurrentLanguage()==="en"
            ? "The import could not be confirmed in the cloud. Please check the report before importing again."
            : "Import belum dapat dikonfirmasi tersimpan di cloud. Periksa laporan sebelum mengimpor ulang.");
        return;
    }

    /* TUTUP PREVIEW */
    closeSalesPreview();


    /*
       KONFIRMASI KE USER

       RESET BELUM DIJALANKAN
       AGAR RESET TERJADI SETELAH
       USER MENEKAN OKE.
    */

    sellerBooksAlert(
        sellerBooksSalesImportText("saved") + "\n\n" +

        sellerBooksSalesImportText("marketplace") + " " +
        record.marketplace +

        "\n" + sellerBooksSalesImportText("store") + " " +
        record.storeName +

        "\n" + sellerBooksSalesImportText("transactions") + " " +
        record.rowCount.toLocaleString("id-ID") +

        "\n" + sellerBooksSalesImportText("uniquePackingLabel") + " " +
        record.uniquePackingCount.toLocaleString("id-ID") +

        "\n" + sellerBooksSalesImportText("packingCostLabel") + " " +
        formatRupiah(
            record.totalPackingCost
        )
    );


    /*
       SETELAH USER KLIK OKE
       KEMBALI KE KONDISI AWAL
    */

        resetSalesImport();

    /*
       REFRESH LAPORAN
       Setelah import berhasil disimpan,
       laporan langsung membaca data terbaru.
    */

    if(
        typeof updateReports === "function"
    ){
        updateReports();
    }

    /*
       Refresh Master Produk agar stok langsung terlihat
       berkurang, sekaligus mempertahankan sistem notifikasi
       stok menipis yang sudah ada.
    */
    if(
        typeof renderProducts === "function"
    ){
        renderProducts();
    }

    if(
        typeof renderNotifications === "function"
    ){
        renderNotifications();
    }

}
/* =====================================================
   SEMENTARA - PERSIAPAN FASE 3
===================================================== */

function checkSalesImportDuplicate(){


    /*
    FASE 3 BELUM DIAKTIFKAN.
    */

    console.log(
        "FASE 2 SELESAI. Siap masuk pemeriksaan duplikat."
    );


    sellerBooksAlert(
        sellerBooksSalesImportText("confirmed")
    );


}

/* =====================================================
   FASE 2 - CLOSE SALES PREVIEW
===================================================== */

function closeSalesPreview(){


    /* =========================================
       AMBIL MODAL PREVIEW
    ========================================= */

    const modal =

        document.getElementById(
            "salesPreviewModal"
        );


    /* =========================================
       JIKA MODAL TIDAK DITEMUKAN
       JANGAN LANJUTKAN AGAR TIDAK ERROR
    ========================================= */

    if(!modal){

        return;

    }


    /* =========================================
       TUTUP MODAL
    ========================================= */

    modal.classList.remove(
        "active"
    );


    /* =========================================
       RESET STATUS VALIDASI
    ========================================= */

    const statusElement =

        document.getElementById(
            "previewValidationStatus"
        );


    if(statusElement){

        statusElement.className =

            "preview-validation-status";


        statusElement.innerText =

            sellerBooksSalesImportText("validationChoose");

    }


    /* =========================================
       NONAKTIFKAN TOMBOL KONFIRMASI
    ========================================= */

    const confirmButton =

        document.getElementById(
            "confirmSalesColumnsButton"
        );


    if(confirmButton){

        confirmButton.disabled = true;

    }


}
/* =====================================================
   INITIALIZE APP
===================================================== */

document.addEventListener(

    "DOMContentLoaded",

    function(){

        if(typeof sellerBooksApplySalesImportLanguage === "function"){
            sellerBooksApplySalesImportLanguage();
        }
        if(typeof sellerBooksApplyReportsLanguage === "function"){
            sellerBooksApplyReportsLanguage();
        }
        if(typeof window.sbPiutangApplyLanguage === "function"){
            window.sbPiutangApplyLanguage();
        }
        if(typeof sellerBooksApplyCostLanguage === "function"){
            sellerBooksApplyCostLanguage();
        }


        /* MARKETPLACE */

        renderMarketplaces();


        /* AKUN TOKO */

        if(typeof renderStores === "function"){

            renderStores();

        }


        /* MASTER PRODUK */

        renderProducts();


        /* TIKTOK API RAW-FILE QUEUE */
        startSellerBooksTikTokApiQueueWorker();


        /* DASHBOARD */

        if(
            typeof renderMarketplacePerformance
            === "function"
        ){

            renderMarketplacePerformance();

        }


    }

);
/* =========================================
   LOGOUT SELLERBOOKS - BENAR-BENAR KELUAR
========================================= */

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

function updateSidebarOwner(){

    /*
       Nama di baris atas = Nama Pemilik yang disimpan pada
       sellerbooks_profiles untuk akun Google yang sedang login.
    */
    const ownerName = String(
        sellerBooksProfile?.owner_name || ""
    ).trim();

    /*
       Email di bawah = email Google/Supabase Auth yang sedang login.
       Tidak pernah mengambil email dari sellerBooksStorage.
    */
    const userEmailValue = String(
        sellerBooksAuthUser?.email ||
        sellerBooksProfile?.email ||
        ""
    ).trim();

    const userName =
        document.getElementById(
            "userName"
        );

    const userEmail =
        document.getElementById(
            "userEmail"
        );

    const userAvatar =
        document.getElementById(
            "userAvatar"
        );


    if(userName){
        userName.innerText =
            ownerName || "Nama Pemilik";
    }

    if(userEmail){
        userEmail.innerText =
            userEmailValue || "Email Google";
    }

    if(userAvatar){
        userAvatar.innerText =
            ownerName
            ? ownerName.charAt(0).toUpperCase()
            : "U";
    }

}

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
function getSellerBooksDayKey(){
    return getIndonesiaTodayKey();
}

/* PATCH E: filter Dashboard disimpan di memory, bukan dibaca dari DOM/storage saat render. */
let sellerBooksDashboardFilterState = {
    period:"today",
    dateFrom:"",
    dateTo:"",
    viewDay:""
};

function sellerBooksSyncDashboardFilterState(){
    const prefs = sellerBooksReadDashboardPreferences();

    sellerBooksDashboardFilterState = {
        period:prefs.period || "today",
        dateFrom:prefs.dateFrom || "",
        dateTo:prefs.dateTo || "",
        viewDay:prefs.viewDay || ""
    };

    currentDashboardPeriod =
        sellerBooksDashboardFilterState.period;

    return sellerBooksDashboardFilterState;
}

function sellerBooksSetDashboardFilterState(patch){
    sellerBooksDashboardFilterState = {
        ...sellerBooksDashboardFilterState,
        ...(patch || {})
    };

    if(sellerBooksDashboardFilterState.period){
        currentDashboardPeriod =
            sellerBooksDashboardFilterState.period;
    }

    return sellerBooksDashboardFilterState;
}

function prepareDailyViewState(forceToday = false){
    const todayKey = getSellerBooksDayKey();
    let dashboardChanged = false;
    let reportChanged = false;
    let productAnalysisChanged = false;

    const dashboardDay = sellerBooksGetDashboardPreference("viewDay", "");
    if(forceToday || dashboardDay !== todayKey){
        sellerBooksWriteDashboardPreferences({
            viewDay:todayKey,
            period:"today"
        });
        dashboardChanged = true;
    }

    const reportDay = sellerBooksGetIndependentViewPreference(
        "report",
        "viewDay",
        ""
    );

    if(forceToday || reportDay !== todayKey){
        sellerBooksWriteIndependentViewPreferences("report",{
            viewDay:todayKey,
            period:"today",
            dateFrom:"",
            dateTo:""
        });
        reportChanged = true;
    }

    const productAnalysisDay = sellerBooksGetIndependentViewPreference(
        "productAnalysis",
        "viewDay",
        ""
    );

    if(forceToday || productAnalysisDay !== todayKey){
        sellerBooksWriteIndependentViewPreferences("productAnalysis",{
            viewDay:todayKey,
            period:"today",
            dateFrom:"",
            dateTo:""
        });
        productAnalysisChanged = true;
    }

    if(reportChanged){
        const reportPeriod =
            document.getElementById("reportPeriod");
        if(reportPeriod) reportPeriod.value = "today";

        const reportDateFrom =
            document.getElementById("reportDateFrom");
        const reportDateTo =
            document.getElementById("reportDateTo");
        if(reportDateFrom) reportDateFrom.value = "";
        if(reportDateTo) reportDateTo.value = "";
    }

    if(productAnalysisChanged){
        const productAnalysisPeriod =
            document.getElementById("productAnalysisPeriod");
        if(productAnalysisPeriod) productAnalysisPeriod.value = "today";

        const productAnalysisDateFrom =
            document.getElementById("productAnalysisDateFrom");
        const productAnalysisDateTo =
            document.getElementById("productAnalysisDateTo");
        if(productAnalysisDateFrom) productAnalysisDateFrom.value = "";
        if(productAnalysisDateTo) productAnalysisDateTo.value = "";
    }

    return {
        todayKey: todayKey,
        dashboardChanged: dashboardChanged,
        reportChanged: reportChanged,
        productAnalysisChanged: productAnalysisChanged
    };
}

/* Preferensi tampilan diinisialisasi setelah Auth + data cloud siap,
   sehingga key lokal selalu terikat ke user yang sedang login. */
/* =========================================
   DASHBOARD FILTER PERIODE
========================================= */

let currentDashboardPeriod = "today";

/* PATCH E: inisialisasi filter setelah currentDashboardPeriod tersedia. */
sellerBooksSyncDashboardFilterState();

/*
   Cek rollover hari berdasarkan WIB setiap menit.
   Jadi ketika browser tetap terbuka melewati 00:00 WIB,
   Dashboard tidak tetap memakai "Hari Kemarin".
*/
let sellerBooksLastWibDayKey = getSellerBooksDayKey();

function sellerBooksCheckWibDayRollover(){
    const todayKey = getSellerBooksDayKey();

    if(!todayKey || todayKey === sellerBooksLastWibDayKey){
        return;
    }

    sellerBooksLastWibDayKey = todayKey;

    const state = prepareDailyViewState();

    if(state.dashboardChanged){
        sellerBooksSetDashboardFilterState({
            period:"today",
            viewDay:todayKey
        });

        currentDashboardPeriod = "today";

        const dashboardPeriod =
            document.getElementById("dashboardPeriod");

        if(dashboardPeriod){
            dashboardPeriod.value = "today";
        }

        dashboardCustomDateConfirmed = true;

        if(typeof updateDashboardCustomDateUI === "function"){
            updateDashboardCustomDateUI();
        }

        if(typeof updateDashboardByPeriod === "function"){
            updateDashboardByPeriod();
        }
    }

    if(state.reportChanged){
        const reportPeriod =
            document.getElementById("reportPeriod");

        if(reportPeriod){
            reportPeriod.value = "today";
        }

        const reportDateFrom =
            document.getElementById("reportDateFrom");
        const reportDateTo =
            document.getElementById("reportDateTo");
        if(reportDateFrom) reportDateFrom.value = "";
        if(reportDateTo) reportDateTo.value = "";

        if(typeof updateReportCustomDateUI === "function"){
            updateReportCustomDateUI();
        }

        if(typeof renderReport === "function"){
            renderReport();
        }
    }

    if(state.productAnalysisChanged){
        const productAnalysisPeriod =
            document.getElementById("productAnalysisPeriod");

        if(productAnalysisPeriod){
            productAnalysisPeriod.value = "today";
        }

        const productAnalysisDateFrom =
            document.getElementById("productAnalysisDateFrom");
        const productAnalysisDateTo =
            document.getElementById("productAnalysisDateTo");
        if(productAnalysisDateFrom) productAnalysisDateFrom.value = "";
        if(productAnalysisDateTo) productAnalysisDateTo.value = "";

        if(typeof updateProductAnalysisCustomDateUI === "function"){
            updateProductAnalysisCustomDateUI();
        }

        if(typeof renderProductAnalysis === "function"){
            renderProductAnalysis();
        }
    }
}

setInterval(sellerBooksCheckWibDayRollover, 60 * 1000);


async function sellerBooksManualRefreshDashboard(){

    /*
       REFRESH TOMBOL DASHBOARD:
       Ambil ulang data langsung dari Supabase.
       Tidak melakukan setItem / penyimpanan ulang,
       sehingga tombol refresh tidak dapat menimpa data cloud.
    */

    if(!sellerBooksAuthUser){
        return;
    }

    try{

        const {data,error} =
            await sellerBooksSupabase
                .from("sellerbooks_user_data")
                .select("data")
                .eq(
                    "user_id",
                    sellerBooksAuthUser.id
                )
                .maybeSingle();

        if(error){
            console.error(
                "Refresh Dashboard dari Supabase gagal:",
                error
            );
            return;
        }

        sellerBooksCloudState =
            (data &&
             data.data &&
             typeof data.data === "object")
                ? {...data.data}
                : {};

        sellerBooksCloudReady = true;
        sellerBooksSaveFastCache();

        if(
            typeof sellerBooksRefreshRuntimeFromCloud ===
            "function"
        ){
            sellerBooksRefreshRuntimeFromCloud();
        }

        if(
            typeof updateDashboardByPeriod ===
            "function"
        ){
            updateDashboardByPeriod();
        }

    }catch(error){

        console.error(
            "Refresh Dashboard dari Supabase gagal:",
            error
        );

    }

}

function refreshDashboard(){

    /* REFRESH DASHBOARD */
    prepareDailyViewState();

    const periodSelect =
        document.getElementById(
            "dashboardPeriod"
        );

    const savedPeriod =
        sellerBooksGetDashboardPreference(
            "period",
            "today"
        );

    if(
        savedPeriod &&
        periodSelect
    ){
        periodSelect.value = savedPeriod;
        currentDashboardPeriod = savedPeriod;
    }

    loadDashboardCustomDates();
    updateDashboardByPeriod();

}

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

/* =====================================================
   SELLERBOOKS LANGUAGE FOUNDATION
   Bahasa disimpan di state akun SellerBooks yang tersimpan
   di Supabase (sellerbooks_user_data), bukan hanya browser.
   Default akun baru: Bahasa Indonesia.
===================================================== */

const SELLERBOOKS_LANGUAGE_KEY = "sellerbooks_language";
const SELLERBOOKS_DEFAULT_LANGUAGE = "id";
let sellerBooksGlobalLanguage = SELLERBOOKS_DEFAULT_LANGUAGE;
let sellerBooksGlobalLanguageReady = false;

/*
   Session language lock.
   Setelah user memilih bahasa di Login, pilihan tersebut tidak boleh
   ditimpa oleh approval check, warm cache, cloud reload, atau auth event
   yang berjalan ulang beberapa detik kemudian.
*/
let sellerBooksLoginLanguageOverrideActive = false;

async function sellerBooksLoadGlobalLanguage(){
    /*
       Jangan pernah membaca Supabase untuk menimpa pilihan Login yang
       sedang dikunci pada sesi ini. Ini penting karena ada beberapa
       approval/auth/cloud callback yang dapat berjalan berurutan.
    */
    try{
        const sessionLanguage =
            window.sessionStorage.getItem(
                SELLERBOOKS_SESSION_LANGUAGE_KEY
            );

        if(sessionLanguage){
            sellerBooksLoginLanguageOverrideActive = true;
            sellerBooksGlobalLanguage =
                sellerBooksNormalizeLanguage(sessionLanguage);
            sellerBooksGlobalLanguageReady = true;
            return sellerBooksGlobalLanguage;
        }

        /*
           OAuth dapat kembali melalui browsing context yang tidak membawa
           sessionStorage. Karena itu pilihan Login yang belum dikonsumsi
           harus tetap diprioritaskan dari localStorage.
        */
        const loginTouched =
            window.localStorage.getItem(
                SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY
            ) === "1";
        const loginLanguage =
            window.localStorage.getItem(
                SELLERBOOKS_LOGIN_LANGUAGE_KEY
            );

        if(loginTouched && loginLanguage){
            sellerBooksLoginLanguageOverrideActive = true;
            sellerBooksGlobalLanguage =
                sellerBooksNormalizeLanguage(loginLanguage);
            sellerBooksGlobalLanguageReady = true;
            return sellerBooksGlobalLanguage;
        }
    }catch(error){}

    if(sellerBooksLoginLanguageOverrideActive){
        sellerBooksGlobalLanguageReady = true;
        return sellerBooksGlobalLanguage;
    }

    try{
        const {data,error}=await sellerBooksSupabase
            .from("sellerbooks_language_settings")
            .select("language")
            .eq("id",1)
            .maybeSingle();
        if(error) throw error;
        sellerBooksGlobalLanguage = sellerBooksNormalizeLanguage(
            data?.language || SELLERBOOKS_DEFAULT_LANGUAGE
        );
        sellerBooksGlobalLanguageReady = true;
        return sellerBooksGlobalLanguage;
    }catch(error){
        console.warn("Bahasa global SellerBooks gagal dimuat:",error);
        sellerBooksGlobalLanguageReady = false;
        return sellerBooksGlobalLanguage;
    }
}

async function sellerBooksSaveGlobalLanguage(value){
    const language=sellerBooksNormalizeLanguage(value);

    /*
       PERSISTENCE LANGUAGE SAJA.
       Setelah UPDATE, baca kembali row yang sama untuk memastikan nilai
       benar-benar tersimpan di Supabase. Jangan menganggap UPDATE berhasil
       hanya karena tidak mengembalikan error.
    */
    const {error:updateError}=await sellerBooksSupabase
        .from("sellerbooks_language_settings")
        .update({
            language:language,
            updated_at:new Date().toISOString()
        })
        .eq("id",1);

    if(updateError) throw updateError;

    const {data:verifyData,error:verifyError}=await sellerBooksSupabase
        .from("sellerbooks_language_settings")
        .select("language")
        .eq("id",1)
        .maybeSingle();

    if(verifyError) throw verifyError;

    const savedLanguage=sellerBooksNormalizeLanguage(
        verifyData?.language || ""
    );

    if(!verifyData || savedLanguage !== language){
        throw new Error(
            "Bahasa SellerBooks belum terkonfirmasi tersimpan di Supabase."
        );
    }

    sellerBooksGlobalLanguage=language;
    sellerBooksGlobalLanguageReady=true;
    return sellerBooksGlobalLanguage;
}

 /*
    LANGUAGE SELECTION
    - Login menyediakan pilihan ID / EN sebelum autentikasi.
    - Pilihan pra-login hanya menjadi preferensi sementara.
    - Setelah akun berhasil dimuat, bahasa akun di Supabase tetap menjadi sumber utama.
    - Untuk akun yang belum memiliki bahasa, pilihan pra-login akan menjadi bahasa akun
      dan kemudian disimpan ke sellerbooks_user_data.
 */
const SELLERBOOKS_LOGIN_LANGUAGE_KEY = "sb_login_language";
const SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY = "sb_login_language_touched";
const SELLERBOOKS_SESSION_LANGUAGE_KEY = "sb_session_language";

function sellerBooksNormalizeLanguage(value){
    return String(value || "").toLowerCase() === "en" ? "en" : "id";
}

function sellerBooksGetLoginLanguagePreference(){
    try{
        return sellerBooksNormalizeLanguage(
            window.localStorage.getItem(SELLERBOOKS_LOGIN_LANGUAGE_KEY) ||
            SELLERBOOKS_DEFAULT_LANGUAGE
        );
    }catch(error){
        return SELLERBOOKS_DEFAULT_LANGUAGE;
    }
}

function sellerBooksSetLoginLanguage(value){
    const language = sellerBooksNormalizeLanguage(value);

    /*
       Dropdown Login = pengganti langsung dropdown Bahasa di Pengaturan.
       Sebelum autentikasi, pilihan hanya ditahan sementara di localStorage
       karena user belum mempunyai sesi untuk menulis ke Supabase.
       Setelah login, sellerBooksEnsureDefaultLanguage() menyimpannya ke
       sellerbooks_language_settings.
    */
    try{
        window.localStorage.setItem(
            SELLERBOOKS_LOGIN_LANGUAGE_KEY,
            language
        );
        window.localStorage.setItem(
            SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY,
            "1"
        );
        /*
           sessionStorage menjadi sumber paling kuat selama tab/session ini.
           Ini bertahan melewati redirect Google dan mencegah callback lain
           mengembalikan bahasa ke default ID.
        */
        window.sessionStorage.setItem(
            SELLERBOOKS_SESSION_LANGUAGE_KEY,
            language
        );
    }catch(error){}

    /*
       Kunci pilihan user untuk seluruh proses login/session.
       Callback lain tidak boleh menggantinya kembali ke ID.
    */
    sellerBooksLoginLanguageOverrideActive = true;
    sellerBooksGlobalLanguage = language;
    sellerBooksGlobalLanguageReady = true;

    /*
       Terapkan engine bahasa lama secara penuh, bukan hanya halaman Login.
    */
    sellerBooksApplyAllLanguage();

    return language;
}

function sellerBooksCurrentLanguage(){
    try{
        /*
           Urutan sumber bahasa:
           1. sessionStorage pilihan Login (paling kuat selama sesi)
           2. runtime global language
           3. preferensi Login sementara
           4. default ID
        */
        const sessionLanguage =
            window.sessionStorage.getItem(
                SELLERBOOKS_SESSION_LANGUAGE_KEY
            );

        if(sessionLanguage){
            return sellerBooksNormalizeLanguage(sessionLanguage);
        }

        /*
           Jika user baru saja memilih bahasa di Login, pilihan tersebut
           mengalahkan bahasa global lama sampai autentikasi selesai.
        */
        const loginTouched =
            window.localStorage.getItem(
                SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY
            ) === "1";
        const loginLanguage =
            window.localStorage.getItem(
                SELLERBOOKS_LOGIN_LANGUAGE_KEY
            );

        if(loginTouched && loginLanguage){
            return sellerBooksNormalizeLanguage(loginLanguage);
        }

        if(sellerBooksGlobalLanguageReady){
            return sellerBooksNormalizeLanguage(
                sellerBooksGlobalLanguage || SELLERBOOKS_DEFAULT_LANGUAGE
            );
        }

        return sellerBooksGetLoginLanguagePreference();
    }catch(error){
        return sellerBooksGlobalLanguageReady
            ? sellerBooksNormalizeLanguage(
                sellerBooksGlobalLanguage || SELLERBOOKS_DEFAULT_LANGUAGE
              )
            : SELLERBOOKS_DEFAULT_LANGUAGE;
    }
}

















function sellerBooksLanguageName(language){
    return sellerBooksNormalizeLanguage(language) === "en"
        ? "English"
        : "Bahasa Indonesia";
}


function sellerBooksApplyAllLanguage(){
    /*
       MASTER LANGUAGE ENGINE
       Seluruh modul SellerBooks wajib melewati satu jalur ini.
       Dropdown Login sekarang memakai engine yang sama dengan
       dropdown Bahasa yang dahulu berada di Pengaturan.
    */
    const language = sellerBooksCurrentLanguage();

    if(typeof sellerBooksApplyDateInputLanguage === "function"){
        sellerBooksApplyDateInputLanguage();
    }
    if(typeof sellerBooksApplyLoginLanguage === "function"){
        sellerBooksApplyLoginLanguage();
    }
    if(typeof sellerBooksApplyDashboardLanguage === "function"){
        sellerBooksApplyDashboardLanguage();
    }
    if(typeof sellerBooksApplyMarketplaceLanguage === "function"){
        sellerBooksApplyMarketplaceLanguage();
    }
    if(typeof sellerBooksApplyStoreLanguage === "function"){
        sellerBooksApplyStoreLanguage();
    }
    if(typeof sellerBooksApplyProductLanguage === "function"){
        sellerBooksApplyProductLanguage();
    }
    if(typeof sellerBooksApplyDetailsLanguage === "function"){
        sellerBooksApplyDetailsLanguage();
    }
    if(typeof sellerBooksApplySalesImportLanguage === "function"){
        sellerBooksApplySalesImportLanguage();
    }
    if(typeof sellerBooksApplyCostLanguage === "function"){
        sellerBooksApplyCostLanguage();
    }
    if(typeof sellerBooksApplyReportsLanguage === "function"){
        sellerBooksApplyReportsLanguage();
    }
    if(typeof sellerBooksApplySettingsLanguage === "function"){
        sellerBooksApplySettingsLanguage();
    }
    if(typeof sellerBooksApplyOwnerSetupLanguage === "function"){
        sellerBooksApplyOwnerSetupLanguage();
    }
    if(typeof sellerBooksApplyNotificationLanguage === "function"){
        sellerBooksApplyNotificationLanguage();
    }
    if(typeof window.sbPiutangApplyLanguage === "function"){
        window.sbPiutangApplyLanguage();
    }

    /* Pastikan tombol hapus transaksi terpilih mengikuti bahasa global. */
    const deleteSelectedTransactionsButton = document.getElementById("deleteSelectedReportTransactionsButton");
    if(deleteSelectedTransactionsButton){
        const isEN = String(language || "ID").trim().toUpperCase() === "EN";
        const count = document.getElementById("selectedReportTransactionCount");
        deleteSelectedTransactionsButton.innerHTML = (isEN ? "🗑️ Delete Selected (" : "🗑️ Hapus Terpilih (") + '<span id="selectedReportTransactionCount">' + (count ? count.textContent : "0") + "</span>)";
    }

    return language;
}

function sellerBooksSyncLanguageControl(){
    const select = document.getElementById("settingsLanguage");
    const language = sellerBooksApplyAllLanguage();

    if(select){
        select.value = language;
        select.disabled = !sellerBooksCloudReady;
    }

    const info = document.getElementById("settingsLanguageInfo");
    if(info){
        info.textContent =
            sellerBooksCloudReady
                ? sellerBooksSettingsText("languageSaved")
                : (
                    language === "en"
                        ? "Preparing language..."
                        : "Menyiapkan bahasa..."
                );
    }
}

async function sellerBooksSaveLanguage(value){
    const language = sellerBooksNormalizeLanguage(value);

    if(!sellerBooksAuthUser){
        sellerBooksSyncLanguageControl();
        return false;
    }

    try{
        /*
           Bahasa sekarang disimpan sebagai setting global SellerBooks
           di Supabase, BUKAN di sellerbooks_user_data dan BUKAN pada
           akun Gmail/user_id.
        */
        sellerBooksGlobalLanguage=language;
        sellerBooksGlobalLanguageReady=true;

        /*
           Jalankan SATU master engine yang sebelumnya dipicu dari
           Pengaturan. Tidak ada modul yang boleh tertinggal.
        */
        sellerBooksApplyAllLanguage();

        if(typeof currentSalesImport !== "undefined" && currentSalesImport){
            if(typeof populateSalesStoreAccounts === "function"){
                populateSalesStoreAccounts();
            }
            if(typeof updatePackingCalculation === "function"){
                updatePackingCalculation();
            }
            if(typeof updatePreviewColumns === "function" && document.getElementById("salesPreviewModal")?.classList.contains("active")){
                updatePreviewColumns();
            }
        }

        const info = document.getElementById("settingsLanguageInfo");
        if(info){
            info.textContent =
                language === "en"
                    ? "Saving English..."
                    : "Menyimpan Bahasa Indonesia...";
        }

        /*
           Simpan ke Supabase di background. Mekanisme cloud yang sudah ada
           tetap menjadi sumber penyimpanan akun, tetapi tidak menghambat
           respons tombol/dropdown.
        */
        sellerBooksSaveGlobalLanguage(language)
            .then(function(){
                const latest = sellerBooksCurrentLanguage();
                if(info && latest === language){
                    info.textContent =
                        language === "en"
                            ? "English saved to SellerBooks."
                            : "Bahasa Indonesia tersimpan di SellerBooks.";
                }
            })
            .catch(function(error){
                console.error("Gagal menyimpan bahasa SellerBooks:",error);
                if(info && sellerBooksCurrentLanguage() === language){
                    info.textContent =
                        sellerBooksSettingsText("languageSaveFailed");
                }
            });

        /*
           Tahap berikutnya akan memakai nilai ini untuk menerapkan seluruh
           terjemahan UI secara global.
        */
        return true;
    }catch(error){
        console.error("Gagal menerapkan bahasa SellerBooks:",error);
        sellerBooksSyncLanguageControl();
        return false;
    }
}





async function sellerBooksEnsureDefaultLanguage(){
    if(!sellerBooksAuthUser) return;

    let languagePersistenceCommitted = false;
    const preferred = sellerBooksGetLoginLanguagePreference();
    let loginLanguageWasChosen = sellerBooksLoginLanguageOverrideActive;
    let sessionLanguage = "";
    try{
        sessionLanguage =
            window.sessionStorage.getItem(
                SELLERBOOKS_SESSION_LANGUAGE_KEY
            ) || "";
        loginLanguageWasChosen =
            loginLanguageWasChosen ||
            !!sessionLanguage ||
            window.localStorage.getItem(SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY) === "1";
    }catch(error){}

    /*
       PENTING:
       Jika user memilih bahasa di halaman Login, pilihan tersebut adalah
       keputusan terbaru user dan TIDAK BOLEH ditimpa oleh nilai lama dari
       Supabase saat proses login.

       Sebelumnya urutannya:
       Login EN -> load Supabase(ID) -> EN baru disimpan.
       Jika save gagal/terlambat, UI sudah terlanjur kembali ID.

       Sekarang:
       Login EN -> kunci runtime ke EN -> terapkan seluruh engine ->
       baru simpan EN ke Supabase.
    */
    if(loginLanguageWasChosen){
        const selectedLanguage =
            sellerBooksNormalizeLanguage(
                sessionLanguage
                    ? sessionLanguage
                    : (
                        sellerBooksLoginLanguageOverrideActive
                            ? sellerBooksGlobalLanguage
                            : (preferred || SELLERBOOKS_DEFAULT_LANGUAGE)
                      )
            );

        sellerBooksLoginLanguageOverrideActive = true;
        sellerBooksGlobalLanguage = selectedLanguage;
        sellerBooksGlobalLanguageReady = true;
        try{
            window.sessionStorage.setItem(
                SELLERBOOKS_SESSION_LANGUAGE_KEY,
                selectedLanguage
            );
        }catch(error){}

        /*
           Terapkan seluruh fungsi bahasa lama SEBELUM cloud data/approval
           melanjutkan proses. Tidak boleh ada fase kembali ke ID.
        */
        sellerBooksApplyAllLanguage();

        try{
            await sellerBooksSaveGlobalLanguage(selectedLanguage);
            languagePersistenceCommitted = true;
        }catch(error){
            /*
               Kegagalan penyimpanan tidak boleh mengubah tampilan yang
               sudah dipilih user. Runtime tetap menggunakan selectedLanguage.
               Handoff localStorage sengaja dipertahankan agar restart APK
               tetap memakai pilihan terakhir sampai Supabase berhasil.
            */
            sellerBooksGlobalLanguage = selectedLanguage;
            sellerBooksGlobalLanguageReady = true;
            console.warn("Penyimpanan bahasa global SellerBooks gagal:",error);
        }
    }else{
        /*
           Tidak ada pilihan baru dari Login -> baru baca bahasa tersimpan
           di Supabase. Default Supabase adalah ID.
        */
        try{
            await sellerBooksLoadGlobalLanguage();
            languagePersistenceCommitted = sellerBooksGlobalLanguageReady === true;
        }catch(error){
            sellerBooksGlobalLanguage =
                SELLERBOOKS_DEFAULT_LANGUAGE;
            sellerBooksGlobalLanguageReady = true;
            languagePersistenceCommitted = false;
        }

        sellerBooksApplyAllLanguage();
    }

    sellerBooksSyncLanguageControl();

    /*
       HANYA hapus handoff Login setelah Supabase benar-benar terverifikasi.
       Jika penyimpanan gagal, biarkan EN/ID tetap tersimpan di localStorage
       sebagai fallback agar restart APK tidak mengembalikan bahasa ke default.
    */
    if(languagePersistenceCommitted){
        try{
            window.localStorage.removeItem(SELLERBOOKS_LOGIN_LANGUAGE_KEY);
            window.localStorage.removeItem(SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY);
        }catch(error){}
    }

    /*
       Jangan reset sellerBooksLoginLanguageOverrideActive di sini.
       Lock ini harus bertahan selama sesi login agar callback kedua/ketiga
       tidak membaca ID lama dari Supabase dan mengubah UI kembali.
    */
}

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

