function sellerBooksImportProgressCopy(){
    const currentLanguage = typeof sellerBooksCurrentLanguage === "function" ? sellerBooksCurrentLanguage() : "ID";
    const isEN = String(currentLanguage || "ID").trim().toUpperCase() === "EN";
    if(window.sellerBooksProgressOperation === "delete"){
        return isEN ? {
            title:"Deletion in progress", subtitle:"Please wait. Do not refresh or leave this page.",
            reading:"Preparing deletion…", processing:"Applying deletion…", saving:"Saving changes to cloud…",
            verifying:"Verifying saved data…", done:"Deletion saved and verified successfully.",
            warning:"Keep this page open until the cloud save is confirmed."
        } : {
            title:"Penghapusan sedang berjalan", subtitle:"Mohon tunggu. Jangan refresh atau pindah halaman.",
            reading:"Menyiapkan penghapusan…", processing:"Memproses penghapusan…", saving:"Menyimpan perubahan ke cloud…",
            verifying:"Memastikan data tersimpan…", done:"Penghapusan berhasil disimpan dan diverifikasi.",
            warning:"Biarkan halaman tetap terbuka sampai penyimpanan cloud terkonfirmasi."
        };
    }
    return isEN ? {
        title:"Import in progress", subtitle:"Please wait. Do not refresh or leave this page.",
        reading:"Reading Excel file…", processing:"Processing product rows…", saving:"Saving data to cloud…",
        verifying:"Verifying saved data…", done:"Import saved and verified successfully.",
        warning:"Keep this page open until the cloud save is confirmed."
    } : {
        title:"Import sedang berjalan", subtitle:"Mohon tunggu. Jangan refresh atau pindah halaman.",
        reading:"Membaca file Excel…", processing:"Memproses baris produk…", saving:"Menyimpan data ke cloud…",
        verifying:"Memastikan data tersimpan…", done:"Import berhasil disimpan dan diverifikasi.",
        warning:"Biarkan halaman tetap terbuka sampai penyimpanan cloud terkonfirmasi."
    };
}


function sellerBooksImportProgressShow(){
    window.sellerBooksImportInProgress = true;
    if(!document.getElementById("sellerBooksImportProgressOverlay")){
        const overlay = document.createElement("div");
        overlay.id = "sellerBooksImportProgressOverlay";
        overlay.setAttribute("role","dialog");
        overlay.setAttribute("aria-modal","true");
        overlay.setAttribute("aria-live","polite");
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.62);backdrop-filter:blur(3px);";
        overlay.innerHTML = '<div style="width:100%;max-width:460px;background:var(--card-bg,#fff);color:var(--text-primary,#0f172a);border:1px solid rgba(148,163,184,.3);border-radius:20px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.28);font-family:inherit;">' +
          '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">' +
          '<div style="width:48px;height:48px;flex:0 0 48px;border-radius:14px;background:#dcfce7;color:#15803d;display:flex;align-items:center;justify-content:center;font-size:25px;">⇧</div>' +
          '<div style="flex:1;min-width:0;"><div id="sellerBooksImportProgressTitle" style="font-size:18px;font-weight:800;line-height:1.3;"></div><div id="sellerBooksImportProgressSubtitle" style="font-size:13px;line-height:1.5;color:var(--text-secondary,#64748b);margin-top:4px;"></div></div>' +
          '<div id="sellerBooksImportProgressPercent" style="font-size:24px;font-weight:800;color:#16a34a;font-variant-numeric:tabular-nums;">0%</div>' +
          '</div>' +
          '<div style="height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden;"><div id="sellerBooksImportProgressBar" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#16a34a,#22c55e);transition:width .25s ease;"></div></div>' +
          '<div id="sellerBooksImportProgressStage" style="font-size:14px;font-weight:700;margin-top:16px;"></div>' +
          '<div style="display:flex;align-items:flex-start;gap:8px;margin-top:16px;padding:11px 12px;border-radius:12px;background:rgba(234,179,8,.12);color:var(--text-secondary,#64748b);font-size:12px;line-height:1.5;"><span aria-hidden="true">⚠️</span><span id="sellerBooksImportProgressWarning"></span></div>' +
          '</div>';
        document.body.appendChild(overlay);
    }
    const copy=sellerBooksImportProgressCopy();
    const title=document.getElementById("sellerBooksImportProgressTitle");
    const subtitle=document.getElementById("sellerBooksImportProgressSubtitle");
    const warning=document.getElementById("sellerBooksImportProgressWarning");
    if(title)title.textContent=copy.title;
    if(subtitle)subtitle.textContent=copy.subtitle;
    if(warning)warning.textContent=copy.warning;
    sellerBooksImportProgressUpdate(3,"reading");
}

function sellerBooksImportProgressUpdate(percent,stage){
    const copy=sellerBooksImportProgressCopy();
    const safePercent=Math.max(0,Math.min(100,Math.round(Number(percent)||0)));
    const labels={reading:copy.reading,processing:copy.processing,saving:copy.saving,verifying:copy.verifying,done:copy.done};
    const bar=document.getElementById("sellerBooksImportProgressBar");
    const number=document.getElementById("sellerBooksImportProgressPercent");
    const label=document.getElementById("sellerBooksImportProgressStage");
    if(bar)bar.style.width=safePercent+"%";
    if(number)number.textContent=safePercent+"%";
    if(label)label.textContent=labels[stage]||copy.processing;
}

function sellerBooksImportProgressHide(){
    window.sellerBooksImportInProgress = false;
    const overlay=document.getElementById("sellerBooksImportProgressOverlay");
    if(overlay)overlay.remove();
}

function sellerBooksImportProgressFailure(error){
    const copy=sellerBooksImportProgressCopy();
    const overlay=document.getElementById("sellerBooksImportProgressOverlay");
    const title=document.getElementById("sellerBooksImportProgressTitle");
    const subtitle=document.getElementById("sellerBooksImportProgressSubtitle");
    const percent=document.getElementById("sellerBooksImportProgressPercent");
    const bar=document.getElementById("sellerBooksImportProgressBar");
    const stage=document.getElementById("sellerBooksImportProgressStage");
    const warning=document.getElementById("sellerBooksImportProgressWarning");
    const failureLanguage = String(typeof sellerBooksCurrentLanguage === "function" ? sellerBooksCurrentLanguage() : "ID").trim().toUpperCase();
    const failureIsEN = failureLanguage === "EN";
    if(title)title.textContent=window.sellerBooksProgressOperation==="delete" ? (failureIsEN ? "Deletion not confirmed" : "Penghapusan belum terkonfirmasi") : (failureIsEN ? "Cloud save not confirmed" : "Penyimpanan cloud belum terkonfirmasi");
    if(subtitle)subtitle.textContent=window.sellerBooksProgressOperation==="delete" ? (failureIsEN ? "Do not refresh or leave this page yet." : "Jangan refresh atau tinggalkan halaman dulu.") : (failureIsEN ? "Do not refresh or import the file again yet." : "Jangan refresh atau import file lagi dulu.");
    if(percent)percent.textContent="!";
    if(bar){bar.style.width="100%";bar.style.background="#dc2626";}
    if(stage)stage.textContent= sellerBooksProgressOperation==="delete" ? (sellerBooksCurrentLanguage()==="EN" ? "Deletion could not be confirmed in the cloud." : "Penghapusan belum dapat dikonfirmasi di cloud.") : (sellerBooksCurrentLanguage()==="EN" ? "Import could not be confirmed in the cloud." : "Import belum dapat dikonfirmasi di cloud.");
    if(warning)warning.textContent= sellerBooksProgressOperation==="delete" ? (sellerBooksCurrentLanguage()==="EN" ? "Do not refresh or repeat the deletion until the issue is checked." : "Jangan refresh atau ulangi penghapusan sampai masalah diperiksa.") : (sellerBooksCurrentLanguage()==="EN" ? "Do not refresh or import the file again yet." : "Jangan refresh atau import file lagi dulu.");
    if(overlay){
        let close=document.getElementById("sellerBooksImportProgressClose");
        if(!close){
            close=document.createElement("button");
            close.id="sellerBooksImportProgressClose";
            close.type="button";
            close.textContent=sellerBooksCurrentLanguage()==="EN" ? "Close message" : "Tutup pesan";
            close.style.cssText="margin-top:16px;width:100%;border:0;border-radius:10px;padding:11px 16px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;";
            close.onclick=function(){sellerBooksImportProgressHide();window.sellerBooksProgressOperation="import";};
            overlay.firstElementChild.appendChild(close);
        }
    }
}

window.addEventListener("beforeunload",function(event){
    if(!window.sellerBooksImportInProgress)return;
    event.preventDefault();
    event.returnValue="";
});

