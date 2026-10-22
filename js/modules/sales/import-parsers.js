/* =====================================================
   SELLERBOOKS SALES IMPORT CONFIG / PARSERS
   Existing marketplace column rules and parser helpers, relocated unchanged.
===================================================== */

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

