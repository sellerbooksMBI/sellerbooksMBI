
(function(){
 const open=document.getElementById("sellerBooksAppCSOpen");
 const modal=document.getElementById("sellerBooksAppCSModal");
 const close=document.getElementById("sellerBooksAppCSClose");
 const title=document.getElementById("sellerBooksAppCSTitle");
 const desc=document.getElementById("sellerBooksAppCSDesc");
 if(!open||!modal||!close||!title||!desc)return;

 function updateLanguage(){
   let language="id";
   try{
     if(typeof sellerBooksCurrentLanguage==="function"){
       language=sellerBooksCurrentLanguage();
     }else{
       language=window.sessionStorage.getItem("sellerbooks_language")||"id";
     }
   }catch(error){}
   language=String(language||"id").toLowerCase().startsWith("en")?"en":"id";
   const text=language==="en"
     ? {open:"Open SellerBooks Customer Service",service:"Customer Service",title:"Customer Service SellerBooks",desc:"Please choose a channel to contact us.",contact:"Call me",close:"Close"}
     : {open:"Buka Layanan Pelanggan SellerBooks",service:"Layanan Pelanggan",title:"Layanan Pelanggan SellerBooks",desc:"Silakan pilih kanal yang ingin digunakan untuk menghubungi kami.",contact:"Telephone",close:"Tutup"};
   open.setAttribute("aria-label",text.open);
   open.setAttribute("title",text.service);
   close.setAttribute("aria-label",text.close);
   title.textContent=text.title;
   desc.textContent=text.desc;
   const contactLabel=document.getElementById("sellerBooksAppCSContactLabel");
   if(contactLabel)contactLabel.textContent=text.contact;
 }

 const hide=()=>modal.classList.remove("show");
 open.addEventListener("click",()=>{updateLanguage();modal.classList.add("show")});
 close.addEventListener("click",hide);
 modal.addEventListener("click",e=>{if(e.target===modal)hide()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")hide()});

 // Sinkronkan juga bila bahasa aplikasi berubah saat popup sedang terbuka.
 document.addEventListener("sellerbooks:language-changed",updateLanguage);
})();
