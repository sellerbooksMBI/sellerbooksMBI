/* PATCH K: jadwalkan render berat agar navigasi/dropdown tidak memblokir UI.
   Jika user mengganti halaman/periode beberapa kali dengan cepat,
   render yang belum sempat berjalan dibatalkan dan hanya state terakhir diproses. */
let sellerBooksDeferredRenderToken = 0;

function sellerBooksScheduleDeferredRender(callback){
    const token = ++sellerBooksDeferredRenderToken;

    setTimeout(function(){
        if(token !== sellerBooksDeferredRenderToken){
            return;
        }
        try{
            callback();
        }catch(error){
            console.error("Render tertunda SellerBooks gagal:",error);
        }
    },0);
}

