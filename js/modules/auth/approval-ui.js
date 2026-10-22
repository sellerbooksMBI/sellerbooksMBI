/* =====================================================
   SELLERBOOKS AUTH / APPROVAL UI
   Existing access-state and approval UI helpers, relocated unchanged.
===================================================== */

function sellerBooksShowOnly(pageId){
    ["loginPage","ownerSetupPage","app","sellerbooksApprovalPage"].forEach(function(id){
        const el=document.getElementById(id);
        if(!el)return;
        el.style.display=id===pageId?(id==="app"?"block":"flex"):"none";
    });
}
function sellerBooksAccessText(key){
    const en = sellerBooksCurrentLanguage() === "en";
    const messages = {
        title: en ? "Waiting for Core Adiimasa Approval" : "Menunggu Persetujuan Core Adiimasa",
        pending: en ? "Your account has been signed in successfully. Please wait for Core Adiimasa to approve your access before using SellerBooks." : "Akun Anda sudah berhasil login. Silakan menunggu persetujuan dari Core Adiimasa sebelum menggunakan SellerBooks.",
        rejected: en ? "Your SellerBooks access request has been rejected by Core Adiimasa. Please contact Core Adiimasa for more information." : "Permintaan akses SellerBooks Anda ditolak oleh Core Adiimasa. Silakan hubungi Core Adiimasa untuk informasi lebih lanjut.",
        suspended: en ? "Your SellerBooks account has been suspended by Core Adiimasa. Please contact Core Adiimasa for more information." : "Akun SellerBooks Anda sedang ditangguhkan oleh Core Adiimasa. Silakan hubungi Core Adiimasa.",
        inactive: en ? "Your SellerBooks account is currently inactive. Please contact Core Adiimasa for more information." : "Akses akun SellerBooks Anda saat ini tidak aktif. Silakan hubungi Core Adiimasa untuk informasi lebih lanjut.",
        deleted: en ? "Your SellerBooks account has been deleted by Core Adiimasa. Please contact Core Adiimasa for more information." : "Akun SellerBooks Anda telah dihapus oleh Core Adiimasa. Silakan hubungi Core Adiimasa untuk informasi lebih lanjut.",
        unavailable: en ? "Your SellerBooks account can no longer be used. Please contact Core Adiimasa for more information." : "Akun SellerBooks Anda sudah tidak dapat digunakan. Silakan hubungi Core Adiimasa untuk informasi lebih lanjut.",
        profileMissing: en ? "You signed in successfully, but your SellerBooks profile has not been created yet. Please try again shortly." : "Akun berhasil login, tetapi profile SellerBooks belum terbentuk. Silakan coba lagi beberapa saat lagi.",
        readError: en ? "Unable to retrieve your account status at this time. Check your internet connection and try again." : "Tidak dapat membaca status akun saat ini. Periksa koneksi internet lalu coba lagi.",
        approvalPending: en ? "Your account is still waiting for approval from Core Adiimasa." : "Status akun masih menunggu persetujuan Core Adiimasa.",
        check: en ? "🔄 Check Approval Status" : "🔄 Cek Status Persetujuan",
        logout: en ? "Log Out" : "Keluar",
        changed: en ? "⚠️ Account Access Changed" : "⚠️ Akses Akun Berubah"
    };
    return messages[key] || key;
}
function sellerBooksApplyApprovalLanguage(){
    const page=document.getElementById("sellerbooksApprovalPage");
    if(!page)return;
    const heading=page.querySelector("h2");
    const check=page.querySelector('button[onclick="sellerBooksCheckApproval(true)"]');
    const logout=page.querySelector('button[onclick="sellerBooksLogout()"]');
    if(heading)heading.textContent=sellerBooksAccessText("title");
    if(check)check.textContent=sellerBooksAccessText("check");
    if(logout)logout.textContent=sellerBooksAccessText("logout");
}
function sellerBooksGetApprovalPage(){
    let page=document.getElementById("sellerbooksApprovalPage");
    if(page){sellerBooksApplyApprovalLanguage();return page;}
    page=document.createElement("section"); page.id="sellerbooksApprovalPage";
    page.style.cssText="min-height:100vh;display:none;align-items:center;justify-content:center;padding:20px;background:#f8fafc;";
    page.innerHTML=`<div style="width:100%;max-width:560px;background:#fff;border-radius:24px;padding:40px 30px;text-align:center;box-shadow:0 20px 60px rgba(15,23,42,.12);border:1px solid #e2e8f0"><div style="font-size:54px;margin-bottom:14px">⏳</div><h2 style="margin-bottom:10px;color:#0f172a"></h2><p id="sellerbooksApprovalEmail" style="color:#2563eb;font-weight:700;margin-bottom:16px;word-break:break-word"></p><p id="sellerbooksApprovalText" style="color:#64748b;line-height:1.7;margin-bottom:24px"></p><button type="button" onclick="sellerBooksCheckApproval(true)" style="border:0;background:#2563eb;color:#fff;padding:12px 20px;border-radius:12px;font-weight:700;cursor:pointer"></button><button type="button" onclick="sellerBooksLogout()" style="display:block;margin:14px auto 0;border:0;background:transparent;color:#64748b;padding:8px 16px;cursor:pointer"></button></div>`;
    document.body.appendChild(page);
    sellerBooksApplyApprovalLanguage();
    return page;
}
function sellerBooksShowApproval(message){
    const page=sellerBooksGetApprovalPage();
    const email=document.getElementById("sellerbooksApprovalEmail");
    const text=document.getElementById("sellerbooksApprovalText");
    if(email)email.textContent=sellerBooksAuthUser?.email||"";
    if(text)text.textContent=message||sellerBooksAccessText("pending");
    sellerBooksApplyApprovalLanguage();
    sellerBooksShowOnly("sellerbooksApprovalPage");
}
