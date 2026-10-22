/* =====================================================
   SELLERBOOKS MASTER PRODUCT LOOKUP CACHE
   Existing cache state and lookup helpers, relocated unchanged.
===================================================== */

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
