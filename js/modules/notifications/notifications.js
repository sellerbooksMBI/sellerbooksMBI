/* =====================================================
   SELLERBOOKS NOTIFICATIONS
   Classic-script compatibility is intentional: functions remain
   global for inline handlers and existing language/navigation calls.
===================================================== */

function toggleNotifications(){

    const panel =
        document.getElementById(
            "notificationPanel"
        );

    if(!panel){
        return;
    }

    panel.classList.toggle("show");

    renderNotifications();

}


/* =========================================
   TUTUP NOTIFIKASI
========================================= */

function closeNotifications(){

    const panel =
        document.getElementById(
            "notificationPanel"
        );

    if(panel){

        panel.classList.remove("show");

    }

}

/* =========================================
   CEK PRODUK STOK MENIPIS
========================================= */
function getLowStockProducts(){

    let productsData = [];

    try{
        productsData =
            JSON.parse(
                sellerBooksStorage.getItem(
                    "sellerbooks_products"
                )
            ) || [];
    }catch(error){
        productsData = [];
    }

    return productsData.filter(
        function(product){

            const stock =
                Number(product.stock);

            return (
                product.status !== "inactive"
                &&
                Number.isFinite(stock)
                &&
                stock <= 5
            );

        }
    );

}
/* =========================================
   BUAT NOTIFIKASI
========================================= */

function sellerBooksNotificationText(key, count){
    const language = sellerBooksCurrentLanguage();
    const translations = {
        id:{
            header:"Notifikasi",
            safeTitle:"Semua aman",
            safeText:"Tidak ada notifikasi penting untuk saat ini.",
            productsEmptyTitle:"Master Produk masih kosong",
            productsEmptyText:"Tambahkan produk terlebih dahulu agar data penjualan dapat dihitung.",
            identityTitle:"Identitas belum diatur",
            identityText:"Silakan lengkapi nama pemilik SellerBooks.",
            importTitle:"Import penjualan belum selesai",
            importText:"SKU dan QTY dari file penjualan perlu dikonfirmasi.",
            lowStockTitle:function(n){return n+" produk stok menipis";},
            lowStockText:"Ada produk dengan stok 5 atau kurang. Segera lakukan pengisian ulang."
        },
        en:{
            header:"Notifications",
            safeTitle:"All Clear",
            safeText:"There are no important notifications at this time.",
            productsEmptyTitle:"Master Products is empty",
            productsEmptyText:"Add products first so sales data can be calculated.",
            identityTitle:"Identity is not set",
            identityText:"Please complete the SellerBooks owner name.",
            importTitle:"Sales import is incomplete",
            importText:"The SKU and QTY from the sales file need to be confirmed.",
            lowStockTitle:function(n){return n+" products are low in stock";},
            lowStockText:"Some products have 5 or fewer units in stock. Please restock them soon."
        }
    };
    const t=translations[language]||translations.id;
    if(key==="lowStockTitle") return t.lowStockTitle(Number(count)||0);
    return t[key] ?? key;
}

function sellerBooksApplyNotificationLanguage(){
    const header=document.getElementById("notificationPanelTitle");
    if(header) header.textContent=sellerBooksNotificationText("header");

    const button=document.getElementById("notificationButton");
    if(button) button.setAttribute("title",sellerBooksNotificationText("header"));

    if(typeof renderNotifications==="function"){
        renderNotifications();
    }
}

function getSellerBooksNotifications(){

    const notifications = [];


    /* =====================================
       CEK MASTER PRODUK
    ===================================== */

    let productsData = [];

    try{

        productsData =
            JSON.parse(
                sellerBooksStorage.getItem(
                    "sellerbooks_products"
                )
            ) || [];

    }catch(error){

        productsData = [];

    }


    if(productsData.length === 0){

        notifications.push({

            icon:"📦",

            title:sellerBooksNotificationText("productsEmptyTitle"),

            text:
                sellerBooksNotificationText("productsEmptyText")

        });

    }


    /* =====================================
       CEK IDENTITAS
    ===================================== */

    const ownerName =
        sellerBooksStorage.getItem(
            "sellerbooks_owner_name"
        );


    if(!ownerName){

        notifications.push({

            icon:"👤",

            title:sellerBooksNotificationText("identityTitle"),

            text:
                sellerBooksNotificationText("identityText")

        });

    }


    /* =====================================
       STATUS IMPORT PENJUALAN
    ===================================== */

    if(
        typeof currentSalesImport !==
        "undefined"
        &&
        currentSalesImport
    ){

        if(
            !currentSalesImport.columnsConfirmed
        ){

            notifications.push({

                icon:"📥",

                title:sellerBooksNotificationText("importTitle"),

                text:
                    sellerBooksNotificationText("importText")

            });

        }

    }

/* =====================================
   CEK STOK MENIPIS
===================================== */

const lowStockProducts =
    getLowStockProducts();


if(lowStockProducts.length > 0){

    notifications.push({

        icon:"⚠️",

        title:
            sellerBooksNotificationText("lowStockTitle",lowStockProducts.length),

        text:
            sellerBooksNotificationText("lowStockText")

    });

}
    /* =====================================
       JIKA TIDAK ADA MASALAH
    ===================================== */

    if(notifications.length === 0){

        notifications.push({

            icon:"✅",

            title:sellerBooksNotificationText("safeTitle"),

            text:
                sellerBooksNotificationText("safeText")

        });

    }


    return notifications;

}


/* =========================================
   TAMPILKAN NOTIFIKASI
========================================= */

function renderNotifications(){

    const list =
        document.getElementById(
            "notificationList"
        );

    const badge =
        document.getElementById(
            "notificationBadge"
        );


    if(!list){
        return;
    }


    const notifications =
        getSellerBooksNotifications();


    list.innerHTML = "";


    notifications.forEach(
        function(notification){

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "notification-item";


            item.innerHTML = `

                <div class="notification-icon">

                    ${notification.icon}

                </div>


                <div class="notification-content">

                    <div class="notification-title">

                        ${notification.title}

                    </div>


                    <div class="notification-text">

                        ${notification.text}

                    </div>

                </div>

            `;


            list.appendChild(item);

        }
    );


    /* BADGE */

    if(badge){

        const realCount =
            notifications.filter(
                function(item){

                    return (
                        item.title !==
                        "Semua aman"
                    );

                }
            ).length;


        if(realCount > 0){

            badge.innerText =
                realCount;

            badge.style.display =
                "flex";

        }else{

            badge.style.display =
                "none";

        }

    }

}


/* =========================================
   KLIK DI LUAR PANEL
========================================= */

document.addEventListener(
    "click",
    function(event){

        const wrapper =
            document.querySelector(
                ".notification-wrapper"
            );

        const panel =
            document.getElementById(
                "notificationPanel"
            );


        if(
            wrapper &&
            panel &&
            !wrapper.contains(event.target)
        ){

            panel.classList.remove(
                "show"
            );

        }
    }
);


/* =========================================
   LOAD NOTIFIKASI
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function(){

        renderNotifications();

    }
);
