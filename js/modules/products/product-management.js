/* =====================================================
   SELLERBOOKS PRODUCT MANAGEMENT
   Existing product rendering and CRUD functions, relocated unchanged.
===================================================== */

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



