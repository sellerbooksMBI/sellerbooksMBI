/* =====================================================
   SELLERBOOKS COST MANAGEMENT
   Classic-script compatibility is intentional: functions remain
   global for inline handlers and existing Dashboard/language calls.
   State variables (costs, editingCostId) remain in main.js.
===================================================== */

function saveCostData(){

    sellerBooksStorage.setItem(
        "sellerbooks_costs",
        JSON.stringify(costs)
    );

}


function getCostMarketplaceName(id){
    if(!id) return "-";
    const item = getCostMarketplacesData().find(function(marketplace){
        return String(marketplace.id) === String(id);
    });
    return item ? (item.name || "Marketplace") : "Marketplace tidak ditemukan";
}


function getCostStoreName(id){
    if(!id) return "-";
    const item = getCostStoresData().find(function(store){
        return String(store.id) === String(id);
    });
    return item ? (item.name || "Akun Toko") : "Akun tidak ditemukan";
}


/* =====================================================
   SNAPSHOT HARIAN BIAYA LAIN
   Hanya biaya bertanggal hari ini yang boleh diedit.
   Begitu tanggal berganti 00:00 WIB, biaya tanggal sebelumnya
   menjadi snapshot dan tidak dapat diubah lagi.
===================================================== */
function isCostEditableToday(cost){
    if(!cost || !cost.date){
        return false;
    }
    const today = getIndonesiaDateString(new Date());
    return String(cost.date) === String(today);
}

function isCostSnapshotLocked(cost){
    return !isCostEditableToday(cost);
}


/* =====================================================
   RENDER BIAYA
===================================================== */

function sellerBooksCostText(key){
    const language=sellerBooksCurrentLanguage();
    const id={
        pageTitle:"Biaya Lain",pageSubtitle:"Catat biaya tambahan yang mempengaruhi laba bisnis.",add:"Tambah Biaya",total:"Total Biaya Lain",listTitle:"Daftar Biaya",listSubtitle:"Semua biaya tambahan yang telah dicatat.",
        emptyTitle:"Belum Ada Biaya Tambahan",emptyDescription:"Tambahkan biaya seperti iklan, transport, operasional atau biaya lainnya.",date:"Tanggal",marketplace:"Marketplace",storeAccount:"Akun Toko",category:"Kategori",description:"Keterangan",amount:"Nominal",notes:"Catatan",actions:"Aksi",edit:"Edit",delete:"Hapus",
        addTitle:"Tambah Biaya",editTitle:"Edit Biaya",selectMarketplace:"-- Pilih Marketplace --",marketplaceHelp:"Pilih marketplace tempat biaya ini terjadi.",selectStore:"-- Pilih Akun Toko --",storeHelp:"Hanya akun dari marketplace yang dipilih yang ditampilkan.",
        categoryLabel:"Kategori Biaya",selectCategory:"-- Pilih Kategori --",advertising:"Iklan",transport:"Transport",operations:"Operasional",other:"Lainnya",descriptionLabel:"Keterangan",descriptionPlaceholder:"Contoh: Biaya iklan TikTok bulan ini",amountLabel:"Nominal Biaya",amountPlaceholder:"Contoh: 50000",notesLabel:"Catatan",optional:"(Opsional)",notesPlaceholder:"Catatan tambahan...",cancel:"Batal",save:"Simpan Biaya",
        requiredDate:"Tanggal biaya wajib diisi.",requiredMarketplace:"Marketplace wajib dipilih.",requiredStore:"Akun toko wajib dipilih.",requiredCategory:"Kategori biaya wajib dipilih.",requiredDescription:"Keterangan biaya wajib diisi.",invalidAmount:"Nominal biaya harus lebih dari 0.",notFound:"Data biaya tidak ditemukan.",lockedEdit:"Biaya tanggal {date} sudah menjadi snapshot dan tidak dapat diedit lagi.",deleteConfirm:"Hapus biaya \"{description}\" sebesar {amount}?"
    };
    const en={
        pageTitle:"Other Costs",pageSubtitle:"Record additional costs that affect your business profit.",add:"Add Cost",total:"Total Other Costs",listTitle:"Cost List",listSubtitle:"All additional costs that have been recorded.",
        emptyTitle:"No Additional Costs",emptyDescription:"Add costs such as advertising, transport, operations, or other expenses.",date:"Date",marketplace:"Marketplace",storeAccount:"Store Account",category:"Category",description:"Description",amount:"Amount",notes:"Notes",actions:"Actions",edit:"Edit",delete:"Delete",
        addTitle:"Add Cost",editTitle:"Edit Cost",selectMarketplace:"-- Select Marketplace --",marketplaceHelp:"Select the marketplace where this cost occurred.",selectStore:"-- Select Store Account --",storeHelp:"Only accounts from the selected marketplace are shown.",
        categoryLabel:"Cost Category",selectCategory:"-- Select Category --",advertising:"Advertising",transport:"Transport",operations:"Operations",other:"Other",descriptionLabel:"Description",descriptionPlaceholder:"Example: TikTok advertising cost this month",amountLabel:"Cost Amount",amountPlaceholder:"Example: 50000",notesLabel:"Notes",optional:"(Optional)",notesPlaceholder:"Additional notes...",cancel:"Cancel",save:"Save Cost",
        requiredDate:"Cost date is required.",requiredMarketplace:"A marketplace must be selected.",requiredStore:"A store account must be selected.",requiredCategory:"A cost category must be selected.",requiredDescription:"Cost description is required.",invalidAmount:"Cost amount must be greater than 0.",notFound:"Cost data was not found.",lockedEdit:"The cost dated {date} is already a snapshot and can no longer be edited.",deleteConfirm:"Delete cost \"{description}\" for {amount}?"
    };
    const source=language==="en"?en:id;
    return source[key] ?? id[key] ?? key;
}

function sellerBooksCostCategoryLabel(value){
    const map={"Iklan":"advertising","Transport":"transport","Operasional":"operations","Lainnya":"other"};
    const key=map[String(value||"").trim()];
    return key ? sellerBooksCostText(key) : String(value||"");
}

function sellerBooksApplyCostLanguage(){
    const root=document.getElementById("costs"), modal=document.getElementById("costModal");
    const topTitle=document.getElementById("topTitle"), topSubtitle=document.getElementById("topSubtitle");
    if(!root && !modal)return;
    const t=sellerBooksCostText;
    if(root){
        const q=(x)=>root.querySelector(x);
        if(q(".page-header h2"))q(".page-header h2").textContent=t("pageTitle");
        if(q(".page-header p"))q(".page-header p").textContent=t("pageSubtitle");
        const add=q(".page-header button"); if(add)add.textContent="+ "+t("add");
        const total=root.querySelector("#costTotal"); if(total&&total.previousElementSibling)total.previousElementSibling.textContent=t("total");
        const hs=root.querySelectorAll("h3"); if(hs[0])hs[0].textContent=t("listTitle");
        const lp=hs[0]?.nextElementSibling; if(lp)lp.textContent=t("listSubtitle");
        const et=document.querySelector("#costEmptyState h3"), ep=document.querySelector("#costEmptyState p"); if(et)et.textContent=t("emptyTitle"); if(ep)ep.textContent=t("emptyDescription");
        const headers=root.querySelectorAll("table thead th");
        [t("date"),t("marketplace"),t("storeAccount"),t("category"),t("description"),t("amount"),t("notes"),t("actions")].forEach((v,i)=>{if(headers[i])headers[i].textContent=v;});
    }
    if(modal){
        const title=document.getElementById("costModalTitle"); if(title)title.textContent=editingCostId?t("editTitle"):t("addTitle");
        const labels=modal.querySelectorAll(".form-group > label");
        [t("date")+" *",t("marketplace")+" *",t("storeAccount")+" *",t("categoryLabel")+" *",t("descriptionLabel")+" *",t("amountLabel")+" *"].forEach((v,i)=>{if(labels[i])labels[i].textContent=v;});
        if(labels[6])labels[6].innerHTML=t("notesLabel")+" <span style=\"color:#94a3b8;\">"+t("optional")+"</span>";
        const mp=document.getElementById("costMarketplace"); if(mp?.options[0])mp.options[0].textContent=t("selectMarketplace");
        const st=document.getElementById("costStore"); if(st?.options[0])st.options[0].textContent=t("selectStore");
        const cat=document.getElementById("costCategory");
        if(cat){const map={"":"selectCategory","Iklan":"advertising","Transport":"transport","Operasional":"operations","Lainnya":"other"};Array.from(cat.options).forEach(o=>{if(map[o.value])o.textContent=t(map[o.value]);});}
        const desc=document.getElementById("costDescription"), amt=document.getElementById("costAmount"), notes=document.getElementById("costNotes");
        if(desc)desc.placeholder=t("descriptionPlaceholder"); if(amt)amt.placeholder=t("amountPlaceholder"); if(notes)notes.placeholder=t("notesPlaceholder");
        const smalls=modal.querySelectorAll(".form-group small"); if(smalls[0])smalls[0].textContent=t("marketplaceHelp"); if(smalls[1])smalls[1].textContent=t("storeHelp");
        const buttons=modal.querySelectorAll(".modal-body .secondary-button,.modal-body .primary-button"); if(buttons[0])buttons[0].textContent=t("cancel"); if(buttons[1])buttons[1].textContent=t("save");
    }
    if(document.getElementById("costs")?.classList.contains("active")){if(topTitle)topTitle.textContent=t("pageTitle");if(topSubtitle)topSubtitle.textContent=t("pageSubtitle");}
}

function renderCosts(){

    const tableBody =
        document.getElementById(
            "costTableBody"
        );

    const emptyState =
        document.getElementById(
            "costEmptyState"
        );

    const tableWrapper =
        document.getElementById(
            "costTableWrapper"
        );

    const totalElement =
        document.getElementById(
            "costTotal"
        );


    if(
        !tableBody ||
        !emptyState ||
        !tableWrapper ||
        !totalElement
    ){

        return;

    }


    /* =========================================
       TOTAL
    ========================================= */

    const totalCost =
        costs.reduce(
            function(total, cost){

                return total +
                    (
                        Number(
                            cost.amount
                        ) || 0
                    );

            },
            0
        );


    totalElement.textContent =
        formatCostCurrency(
            totalCost
        );


    /* =========================================
       KOSONG
    ========================================= */

    if(costs.length === 0){

        tableBody.innerHTML = "";

        emptyState.style.display =
            "block";

        tableWrapper.style.display =
            "none";

        return;

    }


    /* =========================================
       ADA DATA
    ========================================= */

    emptyState.style.display =
        "none";

    tableWrapper.style.display =
        "block";


    /* =========================================
       URUTKAN TERBARU
    ========================================= */

    const sortedCosts =
        [...costs].sort(
            function(a,b){

                return (
                    String(b.date || "")
                    .localeCompare(
                        String(a.date || "")
                    )
                );

            }
        );


    /* =========================================
       RENDER TABLE
    ========================================= */

    tableBody.innerHTML =
        sortedCosts
            .map(
                function(cost){

                    return `

                        <tr>

                            <td>
                                ${formatCostDate(cost.date)}
                            </td>

                            <td>
                                ${escapeCostHtml(getCostMarketplaceName(cost.marketplaceId))}
                            </td>

                            <td>
                                ${escapeCostHtml(getCostStoreName(cost.storeId))}
                            </td>

                            <td>
                                <span
                                    style="
                                        display:inline-block;
                                        padding:5px 10px;
                                        border-radius:999px;
                                        background:#fef3c7;
                                        color:#92400e;
                                        font-size:12px;
                                        font-weight:600;
                                    "
                                >
                                    ${escapeCostHtml(sellerBooksCostCategoryLabel(cost.category))}
                                </span>
                            </td>

                            <td>
                                <strong>
                                    ${escapeCostHtml(cost.description)}
                                </strong>
                            </td>

                            <td>
                                <strong
                                    style="color:#dc2626;"
                                >
                                    ${formatCostCurrency(cost.amount)}
                                </strong>
                            </td>

                            <td>
                                ${
                                    cost.notes
                                    ? escapeCostHtml(cost.notes)
                                    : '<span style="color:#94a3b8;">-</span>'
                                }
                            </td>

                            <td>

                                <div
                                    style="
                                        display:flex;
                                        gap:6px;
                                    "
                                >

                                    ${
                                        isCostSnapshotLocked(cost)
                                            ? `<!-- Aksi Snapshot disembunyikan untuk biaya yang sudah terkunci. -->`
                                            : `
                                            <button
                                                type="button"
                                                class="secondary-button"
                                                onclick="editCost('${cost.id}')"
                                            >
                                                ${sellerBooksCostText("edit")}
                                            </button>
                                        `
                                    }

                                    <button
                                        type="button"
                                        class="secondary-button"
                                        onclick="deleteCost('${cost.id}')"
                                        style="
                                            color:#dc2626;
                                            border-color:#fecaca;
                                        "
                                    >
                                        ${sellerBooksCostText("delete")}
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}




/* =====================================================
   MARKETPLACE & AKUN TOKO UNTUK BIAYA
===================================================== */

function getCostMarketplacesData(){

    try{

        return JSON.parse(
            sellerBooksStorage.getItem(
                "sellerbooks_marketplaces"
            ) || "[]"
        ) || [];

    }catch(error){

        return [];

    }

}


function getCostStoresData(){

    try{

        return JSON.parse(
            sellerBooksStorage.getItem(
                "sellerbooks_stores"
            ) || "[]"
        ) || [];

    }catch(error){

        return [];

    }

}


function loadCostMarketplaceOptions(selectedId){

    const select = document.getElementById("costMarketplace");

    if(!select) return;

    const current =
        selectedId !== undefined
            ? String(selectedId || "")
            : String(select.value || "");

    select.innerHTML = `
        <option value="">
            ${sellerBooksCostText("selectMarketplace")}
        </option>
    `;

    getCostMarketplacesData()
        .filter(function(marketplace){
            return marketplace.status !== "inactive";
        })
        .forEach(function(marketplace){
            const option = document.createElement("option");
            option.value = marketplace.id;
            option.textContent = marketplace.name || "Marketplace";
            select.appendChild(option);
        });

    if(current) select.value = current;

}


function loadCostStoreOptions(selectedId){

    const marketplaceSelect = document.getElementById("costMarketplace");
    const storeSelect = document.getElementById("costStore");

    if(!marketplaceSelect || !storeSelect) return;

    const marketplaceId = String(marketplaceSelect.value || "");
    const current =
        selectedId !== undefined
            ? String(selectedId || "")
            : String(storeSelect.value || "");

    storeSelect.innerHTML = `
        <option value="">
            ${sellerBooksCostText("selectStore")}
        </option>
    `;

    if(!marketplaceId) return;

    getCostStoresData()
        .filter(function(store){
            return (
                store.status !== "inactive" &&
                String(store.marketplaceId) === marketplaceId
            );
        })
        .forEach(function(store){
            const option = document.createElement("option");
            option.value = store.id;
            option.textContent = store.name || "Akun Toko";
            storeSelect.appendChild(option);
        });

    if(current) storeSelect.value = current;

}


/* =====================================================
   BUKA MODAL TAMBAH BIAYA
===================================================== */

function openCostModal(){

    editingCostId = null;


    document.getElementById(
        "costModalTitle"
    ).textContent =
        sellerBooksCostText("addTitle");


    document.getElementById(
        "costDate"
    ).value =
        getIndonesiaDateString(new Date());


    loadCostMarketplaceOptions("");
    loadCostStoreOptions("");

    document.getElementById(
        "costCategory"
    ).value = "";


    document.getElementById(
        "costDescription"
    ).value = "";


    document.getElementById(
        "costAmount"
    ).value = "";


    document.getElementById(
        "costNotes"
    ).value = "";


    document.getElementById(
        "costModal"
    ).classList.add(
        "show"
    );

}


/* =====================================================
   TUTUP MODAL
===================================================== */

function closeCostModal(){

    document.getElementById(
        "costModal"
    ).classList.remove(
        "show"
    );

}


/* =====================================================
   SIMPAN BIAYA
===================================================== */

function saveCost(){

    const date =
        document.getElementById(
            "costDate"
        ).value;


    const marketplaceId =
        document.getElementById(
            "costMarketplace"
        ).value;

    const storeId =
        document.getElementById(
            "costStore"
        ).value;

    const category =
        document.getElementById(
            "costCategory"
        ).value.trim();


    const description =
        document.getElementById(
            "costDescription"
        ).value.trim();


    const amount =
        Number(
            document.getElementById(
                "costAmount"
            ).value
        );


    const notes =
        document.getElementById(
            "costNotes"
        ).value.trim();


    /* =========================================
       VALIDASI
    ========================================= */

    if(!date){

        sellerBooksAlert(
            sellerBooksCostText("requiredDate")
        );

        return;

    }


    if(!marketplaceId){

        sellerBooksAlert(
            sellerBooksCostText("requiredMarketplace")
        );

        return;

    }


    if(!storeId){

        sellerBooksAlert(
            sellerBooksCostText("requiredStore")
        );

        return;

    }


    if(!category){

        sellerBooksAlert(
            sellerBooksCostText("requiredCategory")
        );

        return;

    }


    if(!description){

        sellerBooksAlert(
            sellerBooksCostText("requiredDescription")
        );

        return;

    }


    if(
        !Number.isFinite(amount) ||
        amount <= 0
    ){

        sellerBooksAlert(
            sellerBooksCostText("invalidAmount")
        );

        return;

    }


    /* =========================================
       EDIT
    ========================================= */

    if(editingCostId){

        const existingCost =
            costs.find(function(cost){
                return String(cost.id) === String(editingCostId);
            });

        if(!existingCost){
            sellerBooksAlert(sellerBooksCostText("notFound"));
            return;
        }

        if(isCostSnapshotLocked(existingCost)){
            sellerBooksAlert(sellerBooksCostText("lockedEdit").replace("{date}",formatCostDate(existingCost.date)));
            return;
        }

        const index =
            costs.findIndex(
                function(cost){

                    return String(cost.id) ===
                        String(editingCostId);

                }
            );


        if(index !== -1){

            costs[index] = {

                ...costs[index],

                date:date,

                marketplaceId:marketplaceId,

                storeId:storeId,

                category:category,

                description:description,

                amount:amount,

                notes:notes,

                updatedAt:
                    new Date().toISOString()

            };

        }

    }

    /* =========================================
       TAMBAH
    ========================================= */

    else{

        costs.push({

            id:
                "cost_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .substring(2,8),

            date:date,

            marketplaceId:marketplaceId,

            storeId:storeId,

            category:category,

            description:description,

            amount:amount,

            notes:notes,

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()

        });

    }


    /* =========================================
       SIMPAN
    ========================================= */

    saveCostData();


    /* =========================================
       RENDER
    ========================================= */

    renderCosts();


    /* =========================================
       TUTUP
    ========================================= */

    closeCostModal();

}


/* =====================================================
   EDIT BIAYA
===================================================== */

function editCost(id){

    const cost =
        costs.find(
            function(item){

                return String(item.id) ===
                    String(id);

            }
        );


    if(!cost){

        return;

    }

    if(isCostSnapshotLocked(cost)){
        sellerBooksAlert(sellerBooksCostText("lockedEdit").replace("{date}",formatCostDate(cost.date)));
        return;
    }


    editingCostId =
        cost.id;


    document.getElementById(
        "costModalTitle"
    ).textContent =
        sellerBooksCostText("editTitle");


    document.getElementById(
        "costDate"
    ).value =
        cost.date || "";


    loadCostMarketplaceOptions(
        cost.marketplaceId || ""
    );

    loadCostStoreOptions(
        cost.storeId || ""
    );

    document.getElementById(
        "costCategory"
    ).value =
        cost.category || "";


    document.getElementById(
        "costDescription"
    ).value =
        cost.description || "";


    document.getElementById(
        "costAmount"
    ).value =
        Number(cost.amount) || 0;


    document.getElementById(
        "costNotes"
    ).value =
        cost.notes || "";


    document.getElementById(
        "costModal"
    ).classList.add(
        "show"
    );

}


/* =====================================================
   HAPUS BIAYA
===================================================== */

async function deleteCost(id){

    const cost =
        costs.find(
            function(item){

                return String(item.id) ===
                    String(id);

            }
        );


    if(!cost){

        return;

    }


    const confirmed =
        await sellerBooksConfirm(
            sellerBooksCostText("deleteConfirm")
                .replace("{description}",cost.description)
                .replace("{amount}",formatCostCurrency(cost.amount))
        );

    if(!confirmed){

        return;

    }


    costs =
        costs.filter(
            function(item){

                return String(item.id) !==
                    String(id);

            }
        );


    saveCostData();


    renderCosts();

}


/* =====================================================
   INITIALIZE BIAYA
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function(){

        renderCosts();
        if(typeof sellerBooksApplyCostLanguage === "function"){
            sellerBooksApplyCostLanguage();
        }

    }
);

