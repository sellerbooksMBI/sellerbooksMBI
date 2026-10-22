/* =====================================================
   SELLERBOOKS STORE MANAGEMENT
   Store UI and CRUD functions are relocated unchanged as
   classic-script globals. Shared store/integration state and
   marketplace API/OAuth workers remain in main.js.
===================================================== */

function goToStores(id){

    /*
       SIMPAN MARKETPLACE YANG DIPILIH
    */

    selectedMarketplaceId = id;


    /*
       PINDAH KE HALAMAN AKUN TOKO
    */

    showView("stores");


    /*
       FILTER LANGSUNG
       KE MARKETPLACE TERSEBUT
    */

    renderStoreMarketplaceFilter();


    const filter =

        document.getElementById(
            "storeMarketplaceFilter"
        );


    if(filter){

        filter.value = id;

    }


    renderStores();

}


function saveStoreData(){

    sellerBooksStorage.setItem(

        "sellerbooks_stores",

        JSON.stringify(stores)

    );

    /*
       DAILY SNAPSHOT:
       Simpan Admin % Akun Toko TERAKHIR pada hari berjalan.
       Setelah tanggal berganti, snapshot hari tersebut immutable.
    */
    sellerBooksRecordTodayStoreSnapshots();

}


function getActiveMarketplaces(){

    return marketplaces.filter(function(marketplace){

        return marketplace.status === "active";

    });

}


function renderStoreMarketplaceOptions(){

    const select =

        document.getElementById(
            "storeMarketplace"
        );


    if(!select) return;


    const currentValue = select.value;


    select.innerHTML = `

        <option value="">

            ${sellerBooksStoreText("chooseMarketplace")}

        </option>

    `;


    const activeMarketplaces =

        getActiveMarketplaces();


    activeMarketplaces.forEach(function(marketplace){

        select.innerHTML += `

            <option value="${marketplace.id}">

                ${marketplace.icon}
                ${marketplace.name}

            </option>

        `;

    });


    /* KEMBALIKAN PILIHAN LAMA JIKA MASIH ADA */

    if(currentValue){

        select.value = currentValue;

    }

}


function renderStoreMarketplaceFilter(){

    const filter =

        document.getElementById(
            "storeMarketplaceFilter"
        );


    const customFilter =

        document.getElementById(
            "storeMarketplaceCustomFilter"
        );


    const customButtonContent =

        document.getElementById(
            "storeMarketplaceCustomButtonContent"
        );


    const customOptions =

        document.getElementById(
            "storeMarketplaceCustomOptions"
        );


    if(!filter) return;


    const currentValue = filter.value || "all";


    filter.innerHTML = `

        <option value="all">

            ${sellerBooksStoreText("allMarketplaces")}

        </option>

    `;


    const activeMarketplaces =

        getActiveMarketplaces();


    activeMarketplaces.forEach(function(marketplace){

        filter.innerHTML += `

            <option value="${marketplace.id}">

                ${marketplace.name}

            </option>

        `;

    });


    /* JIKA MARKETPLACE MASIH AKTIF */

    const stillExists =

        currentValue === "all" ||

        activeMarketplaces.some(function(marketplace){

            return marketplace.id === currentValue;

        });


    filter.value =

        stillExists
        ? currentValue
        : "all";


    if(!customFilter || !customButtonContent || !customOptions){
        return;
    }


    const selectedMarketplace =

        filter.value === "all"
        ? null
        : activeMarketplaces.find(function(marketplace){

            return marketplace.id === filter.value;

        });


    customButtonContent.innerHTML = selectedMarketplace

        ? `
            <span class="store-marketplace-custom-logo">
                ${getMarketplaceLogoHTML(selectedMarketplace)}
            </span>
            <span class="store-marketplace-custom-label">
                ${selectedMarketplace.name}
            </span>
        `

        : `
            <span class="store-marketplace-custom-logo">
                <span style="font-size:15px;">▦</span>
            </span>
            <span class="store-marketplace-custom-label">
                ${sellerBooksStoreText("allMarketplaces")}
            </span>
        `;


    customOptions.innerHTML = `

        <button
            type="button"
            class="store-marketplace-custom-option ${filter.value === "all" ? "active" : ""}"
            onclick="selectStoreMarketplaceFilter('all', event)"
        >
            <span class="store-marketplace-custom-logo">
                <span style="font-size:15px;">▦</span>
            </span>
            <span class="store-marketplace-custom-label">
                ${sellerBooksStoreText("allMarketplaces")}
            </span>
        </button>

    `;


    activeMarketplaces.forEach(function(marketplace){

        customOptions.innerHTML += `

            <button
                type="button"
                class="store-marketplace-custom-option ${filter.value === marketplace.id ? "active" : ""}"
                onclick="selectStoreMarketplaceFilter('${marketplace.id}', event)"
            >
                <span class="store-marketplace-custom-logo">
                    ${getMarketplaceLogoHTML(marketplace)}
                </span>
                <span class="store-marketplace-custom-label">
                    ${marketplace.name}
                </span>
            </button>

        `;

    });

}


function toggleStoreMarketplaceFilter(event){

    if(event){
        event.stopPropagation();
    }

    const customFilter =
        document.getElementById("storeMarketplaceCustomFilter");

    if(!customFilter) return;

    customFilter.classList.toggle("open");

}


function selectStoreMarketplaceFilter(value, event){

    if(event){
        event.stopPropagation();
    }

    const filter =
        document.getElementById("storeMarketplaceFilter");

    const customFilter =
        document.getElementById("storeMarketplaceCustomFilter");

    if(!filter) return;

    filter.value = value;

    if(customFilter){
        customFilter.classList.remove("open");
    }

    renderStores();

}


if(!window.sellerBooksStoreMarketplaceFilterOutsideHandler){

    window.sellerBooksStoreMarketplaceFilterOutsideHandler = true;

    document.addEventListener("click", function(){

        const customFilter =
            document.getElementById("storeMarketplaceCustomFilter");

        if(customFilter){
            customFilter.classList.remove("open");
        }

    });

}


function renderStores(skipIntegrationRefresh){

    const grid =
        document.getElementById("storesGrid");

    const count =
        document.getElementById("storeCount");

    if(!grid) return;

    /*
       Samakan perilaku dengan kartu Marketplace: render kartu toko langsung,
       tanpa layar loading yang menutupi seluruh daftar. Status koneksi
       diperbarui di background dan kartu akan dirender ulang setelah RPC
       berhasil, tanpa mengubah data atau aturan integrasi.
    */
    if(!skipIntegrationRefresh){
        refreshStoreIntegrationStates(false);
    }

    renderStoreMarketplaceFilter();


    const filter =

        document.getElementById(
            "storeMarketplaceFilter"
        );


    const filterValue =

        filter
        ? filter.value
        : "all";


    /*
       HANYA TAMPILKAN TOKO
       DARI ${sellerBooksStoreText("marketplace")} YANG AKTIF
    */

    let visibleStores =

        stores.filter(function(store){

            const marketplace =

                marketplaces.find(function(item){

                    return item.id === store.marketplaceId;

                });


            if(!marketplace){

                return false;

            }


            if(marketplace.status !== "active"){

                return false;

            }


            if(
                filterValue !== "all" &&
                store.marketplaceId !== filterValue
            ){

                return false;

            }


            return true;

        });


    /*
       HITUNG TOTAL TOKO YANG TAMPIL
    */

    if(count){

        count.innerText = sellerBooksStoreCountText(visibleStores.length);

    }


    grid.innerHTML = "";


    /*
       EMPTY STATE
    */

    if(visibleStores.length === 0){

        grid.innerHTML = `

            <div class="store-empty">

                <div class="store-empty-icon">

                    🏬

                </div>


                <h3>

                    ${sellerBooksStoreText("noStoresTitle")}

                </h3>


                <p>

                    ${sellerBooksStoreText("noStoresText")}

                </p>


            </div>

        `;


        return;

    }



    /* =================================================
       BUAT CARD TOKO
    ================================================= */

    visibleStores.forEach(function(store){

        const marketplace =

            marketplaces.find(function(item){

                return item.id === store.marketplaceId;

            });


        if(!marketplace) return;


        const statusText =

            store.status === "active"

            ? sellerBooksStoreText("active")

            : sellerBooksStoreText("inactive");


        const statusClass =

            store.status === "active"

            ? "active"

            : "inactive";

        const integration = getStoreIntegrationConnection(store);
        const isIntegrated =
            String(integration?.connection_status || "").toUpperCase() === "CONNECTED";

        const integrationStatusHtml = isIntegrated
            ? `
                <div class="store-integration-success">
                    ✓ ${sellerBooksStoreText("activeIntegrated")}
                </div>
              `
            : "";

        const marketplaceKey = String(marketplace.name || "")
            .toLowerCase()
            .replace(/\s+/g,"");

        const isTikTokStore = marketplaceKey.includes("tiktok");
        const isShopeeStore = marketplaceKey.includes("shopee");
        const isLazadaStore = marketplaceKey.includes("lazada");
        const isBlibliStore = marketplaceKey.includes("blibli");

        /*
           TikTok tetap memakai mesin yang sudah berjalan.
           Shopee + Lazada hanya ditambahkan sebagai adapter UI baru
           menuju Edge Function masing-masing. Mekanisme TikTok TIDAK
           diubah.
        */
        let orderSyncButtonHtml = "";

        if(isTikTokStore){
            orderSyncButtonHtml = `
                <div class="store-action-order-row">
                    <button
                        type="button"
                        class="store-action-button store-integrate-button"
                        onclick="syncTikTokOrdersNow('${store.id}')"
                        title="${sellerBooksStoreText("syncTikTokTitle")}"
                    >
                        🔄 ${sellerBooksStoreText("syncOrders")}
                    </button>
                </div>`;
        }else if(isShopeeStore){
            orderSyncButtonHtml = `
                <div class="store-action-order-row">
                    <button
                        type="button"
                        class="store-action-button store-integrate-button"
                        onclick="syncShopeeOrdersNow('${store.id}')"
                        title="${sellerBooksStoreText("syncShopeeTitle")}"
                    >
                        🔄 ${sellerBooksStoreText("syncOrders")}
                    </button>
                </div>`;
        }else if(isLazadaStore){
            orderSyncButtonHtml = `
                <div class="store-action-order-row">
                    <button
                        type="button"
                        class="store-action-button store-integrate-button"
                        onclick="syncLazadaOrdersNow('${store.id}')"
                        title="${sellerBooksStoreText("syncLazadaTitle")}"
                    >
                        🔄 ${sellerBooksStoreText("syncOrders")}
                    </button>
                </div>`;
        }

        else if(isBlibliStore){
            orderSyncButtonHtml = '<div class="store-action-order-row"><button type="button" class="store-action-button store-integrate-button" onclick="syncBlibliOrdersNow(\''+store.id+'\')" title="Tarik Order Blibli">🔄 '+sellerBooksStoreText("syncOrders")+'</button></div>';
        }
        const integrationButtonHtml = isIntegrated
            ? `
                <button
                    type="button"                    class="store-action-button store-disconnect-button"
                    onclick="disconnectStoreAccount('${store.id}')"
                    title="${sellerBooksStoreText("disconnectIntegration")}"
                >
                    ⛓ ${sellerBooksStoreText("disconnectIntegration")}
                </button>
                ${orderSyncButtonHtml}
              `
            : `
                <button
                    type="button"
                    class="store-action-button store-integrate-button"
                    onclick="integrateStoreAccount('${store.id}')"
                >
                    🔗 ${sellerBooksStoreText("manageIntegration")}
                </button>
              `;

        grid.innerHTML += `

            <div class="store-card">


                <div class="store-card-top">


                    <div class="store-marketplace">


                        <div class="store-marketplace-icon">

                            ${getMarketplaceLogoHTML(marketplace)}

                        </div>


                        <div>


                            <div class="store-marketplace-name">

                                ${marketplace.name}

                            </div>


                            <span class="status ${statusClass}">

                                ${statusText}

                            </span>


                        </div>


                    </div>


                </div>



                <div class="store-name">

                    ${store.name}

                </div>



                <div class="store-description">

                    ${
                        store.description
                        ? store.description
                        : sellerBooksStoreText("noDescription")
                    }

                </div>



                <div class="store-info">


                    <div class="store-info-item">

                        ${sellerBooksStoreText("storeCode")}

                        <strong>

                            ${
                                store.code
                                ? store.code
                                : "-"
                            }

                        </strong>

                    </div>



                    <div class="store-info-item">

                        ${sellerBooksStoreText("marketplace")}

                        <strong>

                            ${marketplace.name}

                        </strong>

                    </div>
<div class="store-info-item">

    ${sellerBooksStoreText("adminFee")}

    <strong>
        ${
            store.feePercent !== undefined &&
            store.feePercent !== null &&
            store.feePercent !== ""
            ? Number(store.feePercent) + "%"
            : "-"
        }
    </strong>

</div>


                </div>


                ${integrationStatusHtml}

                <div class="store-actions">

                    ${integrationButtonHtml}


                    <button
                        class="
                            store-action-button
                            store-toggle-button
                        "
                        onclick="toggleStore('${store.id}')"
                    >

                        ${
                            store.status === "active"
                            ? sellerBooksStoreText("disable")
                            : sellerBooksStoreText("enable")
                        }

                    </button>


                    <button
                        class="
                            store-action-button
                            store-edit-button
                        "
                        onclick="editStore('${store.id}')"
                    >

                        ✏️ ${sellerBooksStoreText("edit")}

                    </button>


                    <button
                        class="
                            store-action-button
                            store-delete-button
                        "
                        onclick="deleteStore('${store.id}')"
                    >

                        🗑

                    </button>

                </div>


            </div>

        `;

    });


    /*
       UPDATE DASHBOARD
    */

    updateMarketplaceStoreCounts();

}


function openStoreModal(){

    const activeMarketplaces =

        getActiveMarketplaces();


    /*
       CEK APAKAH ADA MARKETPLACE AKTIF
    */

    if(activeMarketplaces.length === 0){

        sellerBooksAlert(
            sellerBooksStoreText("noStoresText")
        );

        return;

    }


    editingStoreId = null;


    document.getElementById(
        "storeModalTitle"
    ).innerText =

        sellerBooksStoreText("addTitle");


    /*
       KOSONGKAN FORM
    */

    document.getElementById(
        "storeName"
    ).value = "";


    document.getElementById(
        "storeCode"
    ).value = "";

document.getElementById(
    "storeFeePercent"
).value = "";

    document.getElementById(
        "storeDescription"
    ).value = "";


    document.getElementById(
        "storeStatus"
    ).value = "active";


    renderStoreMarketplaceOptions();
    sellerBooksApplyStoreLanguage();


    /*
       JIKA MASUK DARI TOMBOL
       KELOLA TOKO MARKETPLACE
    */

    if(selectedMarketplaceId){

        document.getElementById(
            "storeMarketplace"
        ).value = selectedMarketplaceId;

    }


    document
        .getElementById("storeModal")
        .classList
        .add("show");

}


function closeStoreModal(){

    document
        .getElementById("storeModal")
        .classList
        .remove("show");


    editingStoreId = null;

    selectedMarketplaceId = null;

}


function saveStore(){

    const marketplaceId =

        document.getElementById(
            "storeMarketplace"
        ).value;


    const name =

        document.getElementById(
            "storeName"
        ).value
        .trim();


    const code =

        document.getElementById(
            "storeCode"
        ).value
        .trim();


    const description =

        document.getElementById(
            "storeDescription"
        ).value
        .trim();


    const status =

        document.getElementById(
            "storeStatus"
        ).value;

const feePercent =
    parseFloat(
        document.getElementById(
            "storeFeePercent"
        ).value
    ) || 0;



    /*
       VALIDASI
    */

    if(!marketplaceId){

        sellerBooksAlert(
            sellerBooksStoreText("chooseMarketplaceError")
        );

        return;

    }


    if(!name){

        sellerBooksAlert(
            sellerBooksStoreText("nameRequired")
        );

        return;

    }

if(feePercent < 0 || feePercent > 100){

    sellerBooksAlert(
        sellerBooksStoreText("feeInvalid")
    );

    return;
}

    /*
       CEK MARKETPLACE MASIH AKTIF
    */

    const marketplace =

        marketplaces.find(function(item){

            return item.id === marketplaceId;

        });


    if(
        !marketplace ||
        marketplace.status !== "active"
    ){

        sellerBooksAlert(

            sellerBooksStoreText("marketplaceInactive")

        );

        return;

    }



    /* EDIT TOKO */

    if(editingStoreId){


        const store =

            stores.find(function(item){

                return item.id === editingStoreId;

            });


        if(store){

            store.marketplaceId = marketplaceId;

            store.name = name;

            store.code = code;

            store.feePercent = feePercent;

            store.description = description;

            store.status = status;

            store.updatedAt =
                new Date().toISOString();

        }


    }


    /* TAMBAH TOKO BARU */

    else{


        /*
           CEK NAMA TOKO GANDA
           DALAM MARKETPLACE YANG SAMA
        */

        const duplicate =

            stores.some(function(store){

                return (

                    store.marketplaceId === marketplaceId &&

                    store.name.toLowerCase() ===
                    name.toLowerCase()

                );

            });


        if(duplicate){

            sellerBooksAlert(

                sellerBooksStoreText("duplicate")

            );

            return;

        }



        stores.push({

            id:"store_" + Date.now(),

            marketplaceId:marketplaceId,

            name:name,

            code:code,

            feePercent:feePercent,

            description:description,

            status:status,

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()

        });

    }



    saveStoreData();

    renderStores();

    renderMarketplaceStoreCounts();

    closeStoreModal();

}


function editStore(id){

    const store =

        stores.find(function(item){

            return item.id === id;

        });


    if(!store) return;


    editingStoreId = id;


    selectedMarketplaceId = null;


    document.getElementById(
        "storeModalTitle"
    ).innerText =

        sellerBooksStoreText("editTitle");


    renderStoreMarketplaceOptions();


    document.getElementById(
        "storeMarketplace"
    ).value = store.marketplaceId;


    document.getElementById(
        "storeName"
    ).value = store.name;


    document.getElementById(
        "storeCode"
    ).value = store.code || "";

document.getElementById(
    "storeFeePercent"
).value =
    store.feePercent ?? "";

    document.getElementById(
        "storeDescription"
    ).value = store.description || "";


    document.getElementById(
        "storeStatus"
    ).value = store.status;


    document
        .getElementById("storeModal")
        .classList
        .add("show");

}


function toggleStore(id){

    const store =

        stores.find(function(item){

            return item.id === id;

        });


    if(!store) return;


    store.status =

        store.status === "active"

        ? "inactive"

        : "active";


    store.updatedAt =
        new Date().toISOString();


    saveStoreData();

    renderStores();

    renderMarketplaceStoreCounts();

}


async function deleteStore(id){

    const store =

        stores.find(function(item){

            return item.id === id;

        });


    if(!store) return;


    const confirmation = await sellerBooksConfirm(
        sellerBooksStoreText("deleteQuestion") +
        ' "' +
        store.name +
        '"?'
    );


    if(!confirmation){

        return;

    }


    stores =

        stores.filter(function(item){

            return item.id !== id;

        });


    saveStoreData();

    renderStores();

    renderMarketplaceStoreCounts();

}


function renderMarketplaceStoreCounts(){

    /*
       JIKA SUDAH ADA ENGINE
       PERFORMA MARKETPLACE
    */

    if(
        typeof renderMarketplacePerformance
        === "function"
    ){

        renderMarketplacePerformance();

    }

}


function updateMarketplaceStoreCounts(){

    /*
       FUNGSI INI DISIAPKAN UNTUK
       INTEGRASI DASHBOARD
    */

    if(
        typeof renderMarketplacePerformance
        === "function"
    ){

        renderMarketplacePerformance();

    }

}
