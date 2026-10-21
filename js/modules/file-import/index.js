// SellerBooks file-import helpers. Extracted without changing behavior.

(function(){
    window.sellerBooksOpenFilePicker=function(inputId){
        var input=document.getElementById(inputId);
        if(!input)return;
        try{input.value="";}catch(e){}
        try{if(typeof input.showPicker==="function"){input.showPicker();return;}}catch(e){}
        try{input.click();}catch(e){try{input.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));}catch(e2){}}
    };
    function loadScript(src){return new Promise(function(resolve,reject){var s=document.createElement("script");s.src=src;s.async=true;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
    window.sellerBooksEnsureXLSX=async function(){
        if(typeof XLSX!=="undefined")return true;
        try{await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");}
        catch(e){try{await loadScript("https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js");}catch(e2){sellerBooksAlert("Library Excel tidak dapat dimuat. Periksa koneksi internet HP lalu coba lagi.");return false;}}
        return typeof XLSX!=="undefined";
    };
    window.sellerBooksEnsureExcelJS=async function(){
        if(typeof ExcelJS!=="undefined")return true;
        try{await loadScript("https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js");}
        catch(e){try{await loadScript("https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js");}catch(e2){sellerBooksAlert("Library Excel Export tidak dapat dimuat. Periksa koneksi internet HP lalu coba lagi.");return false;}}
        return typeof ExcelJS!=="undefined";
    };
})();
