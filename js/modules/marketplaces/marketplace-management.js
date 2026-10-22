/* =====================================================
   SELLERBOOKS MARKETPLACE MANAGEMENT UI
   Existing marketplace CRUD and rendering functions are relocated
   unchanged as classic-script globals. Shared marketplace state
   remains in main.js.
===================================================== */

function saveMarketplaceData(){

    sellerBooksStorage.setItem(

        "sellerbooks_marketplaces",

        JSON.stringify(marketplaces)

    );

}


function getMarketplaceLogoHTML(marketplace){

    const logoMap = {

        "shopee":
            "assets/marketplace/shopee.png",

        "tiktok":
            "assets/marketplace/tiktok-shop.png",

        "tiktokshop":
            "assets/marketplace/tiktok-shop.png",

        "tokopedia":
            "assets/marketplace/tokopedia.png",

        "tokped":
            "assets/marketplace/tokopedia.png",

        "lazada":
            "assets/marketplace/lazada.png",

        "toco":
            "assets/marketplace/toco.png",

        "blibli":
            "assets/marketplace/blibli.png"

    };

    const normalizeMarketplaceKey =
        function(value){

            return String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

        };

    const marketplaceId =
        normalizeMarketplaceKey(
            marketplace && marketplace.id
        );

    const marketplaceName =
        normalizeMarketplaceKey(
            marketplace && marketplace.name
        );

    const logoPath =
        logoMap[marketplaceId] ||
        logoMap[marketplaceName];

    if(!logoPath){

        return marketplace && marketplace.icon
            ? marketplace.icon
            : "";

    }

    const displayName =
        marketplace && marketplace.name
        ? String(marketplace.name)
        : "Marketplace";

    return `
        <img
            src="${logoPath}"
            alt="${displayName}"
            loading="lazy"
        >
    `;

}


function renderMarketplaces(){

    const grid = document.getElementById("marketplaceGrid");
    const count = document.getElementById("marketplaceCount");

    if(!grid) return;

    if(count){
        count.textContent = sellerBooksMarketplaceCountText(marketplaces.length);
    }

    grid.innerHTML = "";

    marketplaces.forEach(function(marketplace){

        const isActive = marketplace.status === "active";
        const statusText = isActive
            ? sellerBooksMarketplaceText("active")
            : sellerBooksMarketplaceText("inactive");

        const statusClass = isActive ? "active" : "inactive";

        const card = document.createElement("div");
        card.className = "marketplace-card";

        card.innerHTML = `
            <div class="marketplace-card-top">
                <div class="marketplace-card-icon">
                    ${getMarketplaceLogoHTML(marketplace)}
                </div>

                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="status ${statusClass}">
                        ${statusText}
                    </span>

                    <button
                        type="button"
                        class="marketplace-more"
                        onclick="editMarketplace('${String(marketplace.id).replace(/'/g,"\\'")}')"
                        title="${sellerBooksMarketplaceText("more")}"
                        aria-label="${sellerBooksMarketplaceText("more")}"
                    >
                        ⋮
                    </button>
                </div>
            </div>

            <h3>${escapeHtml(marketplace.name)}</h3>

            <p>
                ${isActive
                    ? sellerBooksMarketplaceText("activeReady")
                    : sellerBooksMarketplaceText("inactiveUnused")}
            </p>

            <div class="marketplace-card-actions">

                <button
                    type="button"
                    class="card-button primary"
                    onclick="goToStores('${String(marketplace.id).replace(/'/g,"\\'")}')"
                >
                    ${sellerBooksMarketplaceText("manageStores")}
                </button>

                <button
                    type="button"
                    class="card-button secondary"
                    onclick="toggleMarketplace('${String(marketplace.id).replace(/'/g,"\\'")}')"
                >
                    ${isActive
                        ? sellerBooksMarketplaceText("disable")
                        : sellerBooksMarketplaceText("enable")}
                </button>

                <button
                    type="button"
                    class="card-button"
                    style="background:#fef2f2;color:#dc2626;"
                    onclick="deleteMarketplace('${String(marketplace.id).replace(/'/g,"\\'")}')"
                >
                    ${sellerBooksMarketplaceText("delete")}
                </button>

            </div>
        `;

        grid.appendChild(card);
    });

    /*
       Marketplace hanya merender daftar Marketplace.
       Dashboard performance dan daftar Akun Toko tidak perlu
       dihitung ulang saat navigasi ke halaman ini.
    */
    sellerBooksApplyMarketplaceLanguage();
}


function openMarketplaceModal(){

    editingMarketplaceId = null;


    document.getElementById(
        "marketplaceModalTitle"
    ).innerText = sellerBooksMarketplaceText("addTitle");


    document.getElementById(
        "marketplaceName"
    ).value = "";


    document.getElementById(
        "marketplaceStatus"
    ).value = "active";


    document
        .getElementById("marketplaceModal")
        .classList
        .add("show");

}


function closeMarketplaceModal(){

    document
        .getElementById("marketplaceModal")
        .classList
        .remove("show");

}


function saveMarketplace(){

    const name =
        document
        .getElementById("marketplaceName")
        .value
        .trim();


    const status =
        document
        .getElementById("marketplaceStatus")
        .value;

    if(name === ""){

        sellerBooksAlert(sellerBooksMarketplaceText("nameRequired"));

        return;

    }


    if(editingMarketplaceId){

        const marketplace =
            marketplaces.find(function(item){

                return item.id === editingMarketplaceId;

            });


        if(marketplace){
    marketplace.name = name;
    marketplace.status = status;
    marketplace.updatedAt = new Date().toISOString();}

    }else{

        const id =
            "marketplace_" + Date.now();


        marketplaces.push({
    id:id,
    name:name,
    icon:"🏪",
    status:status,
    system:false,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
});

    }


    saveMarketplaceData();

    renderMarketplaces();

    closeMarketplaceModal();

}


function editMarketplace(id){

    const marketplace =
        marketplaces.find(function(item){

            return item.id === id;

        });


    if(!marketplace) return;


    editingMarketplaceId = id;


    document.getElementById(
        "marketplaceModalTitle"
    ).innerText = sellerBooksMarketplaceText("editTitle");


    document.getElementById(
        "marketplaceName"
    ).value = marketplace.name;


    document.getElementById(
        "marketplaceStatus"
    ).value = marketplace.status;


    document
        .getElementById("marketplaceModal")
        .classList
        .add("show");

}


async function deleteMarketplace(id){

    const marketplace =
        marketplaces.find(function(item){
            return item.id === id;
        });

    if(!marketplace) return;

    if(!await sellerBooksConfirm(
        sellerBooksMarketplaceText("deleteConfirm") +
        " \"" +
        (marketplace.name || sellerBooksMarketplaceText("pageTitle")) +
        "\"?\n\n" +
        sellerBooksMarketplaceText("deleteWarning")
    )){
        return;
    }

    /* Simpan kondisi lama agar bisa dikembalikan jika database gagal. */
    const oldMarketplaces = JSON.parse(JSON.stringify(marketplaces));
    const oldStores = Array.isArray(stores)
        ? JSON.parse(JSON.stringify(stores))
        : stores;

    marketplaces = marketplaces.filter(function(item){
        return item.id !== id;
    });

    if(Array.isArray(stores)){
        stores = stores.filter(function(store){
            return String(store.marketplaceId || "") !== String(id);
        });
    }

    saveMarketplaceData();
    if(typeof saveStoreData === "function")saveStoreData();

    renderMarketplaces();
    if(typeof renderStores === "function")renderStores();

    try{
        if(typeof sellerBooksPersistCloudDataStrict !== "function")
            throw new Error("Fungsi sinkronisasi kritis belum tersedia.");

        /*
           Karena storage SellerBooks disimpan sebagai JSON di
           sellerbooks_user_data.data, verifikasi dilakukan terhadap
           field marketplace dan toko setelah Supabase membaca ulang data.
        */
        const expectedSnapshot = {...sellerBooksCloudState};

        await sellerBooksPersistCloudDataStrict(
            expectedSnapshot,
            function(savedData){
                let savedMarketplaces = [];
                let savedStores = [];

                try{
                    savedMarketplaces = JSON.parse(
                        savedData["sellerbooks_marketplaces"] || "[]"
                    ) || [];
                }catch(error){
                    return false;
                }

                try{
                    savedStores = JSON.parse(
                        savedData["sellerbooks_stores"] || "[]"
                    ) || [];
                }catch(error){
                    return false;
                }

                const marketplaceStillExists = savedMarketplaces.some(function(item){
                    return String(item.id || "") === String(id);
                });

                if(marketplaceStillExists)return false;

                const linkedStoreStillExists = savedStores.some(function(store){
                    return String(store.marketplaceId || "") === String(id);
                });

                return !linkedStoreStillExists;
            }
        );

        sellerBooksAlert(
            sellerBooksMarketplaceText("deleteSuccess") + " \"" +
            (marketplace.name || sellerBooksMarketplaceText("pageTitle")) +
            "\" " +
            sellerBooksMarketplaceText("deleteSuccessSuffix")
        );

    }catch(error){
        console.error("Penghapusan marketplace gagal disimpan ke Supabase:",error);

        /* Jangan biarkan tampilan lokal berbeda dari database jika gagal. */
        marketplaces = oldMarketplaces;
        stores = oldStores;

        saveMarketplaceData();
        if(typeof saveStoreData === "function")saveStoreData();
        renderMarketplaces();
        if(typeof renderStores === "function")renderStores();

        sellerBooksAlert(
            sellerBooksMarketplaceText("deleteFailedTitle") + "\n\n" +
            sellerBooksMarketplaceText("deleteFailedBody") + "\n\n" +
            sellerBooksMarketplaceText("deleteFailedDetail") + " " +
            (error && error.message ? error.message : error)
        );
    }
}


function toggleMarketplace(id){

    const marketplace =
        marketplaces.find(function(item){

            return item.id === id;

        });


    if(!marketplace) return;


    marketplace.status =
        marketplace.status === "active"
        ? "inactive"
        : "active";


    saveMarketplaceData();

    renderMarketplaces();

}
