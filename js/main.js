

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









let sellerBooksExcelDispatchRunning=false;
let sellerBooksExcelDispatchRerunRequested=false;
let sellerBooksExcelDispatchRerunShowResult=false;




















/* =====================================================
   TARIK ORDER SHOPEE
   Mengikuti pola session -> Edge Function -> hasil sync.
   Tidak menyentuh mesin TikTok.
===================================================== */





/* =====================================================
   TARIK ORDER LAZADA
   Mengikuti pola session -> Edge Function -> hasil sync.
   Tidak menyentuh mesin TikTok.
===================================================== */





/* =====================================================
   TARIK ORDER BLIBLI
   Adapter Blibli terpisah; data mentah masuk antrean impor
   yang sama dan tetap diproses oleh mesin Import Penjualan.
===================================================== */



/* =====================================================
   HASIL OAUTH SHOPEE
===================================================== */




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

