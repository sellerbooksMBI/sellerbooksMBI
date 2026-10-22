/* =====================================================
   SELLERBOOKS STORE CONNECTION ACTIONS
   Existing store connection handlers relocated unchanged.
===================================================== */

async function disconnectStoreAccount(storeId){

    const store = stores.find(function(item){
        return String(item.id) === String(storeId);
    });

    if(!store){
        sellerBooksAlert(sellerBooksStoreText("storeNotFound"),sellerBooksStoreText("disconnectTitle"));
        return;
    }

    const marketplace = marketplaces.find(function(item){
        return String(item.id) === String(store.marketplaceId);
    });

    if(!marketplace){
        sellerBooksAlert(sellerBooksStoreText("marketplaceNotFound"),sellerBooksStoreText("disconnectTitle"));
        return;
    }

    const connection = getStoreIntegrationConnection(store);

    if(!connection ||
       String(connection.connection_status || "").toUpperCase() !== "CONNECTED"){
        await refreshStoreIntegrationStates(true);
        return;
    }

    const confirmed = await sellerBooksConfirm(
        sellerBooksStoreText("disconnectConfirm") + " " + marketplace.name + " " +
        (sellerBooksCurrentLanguage() === "en" ? "from store account \"" : "dari akun toko \"") +
        store.name + "\"?\n\n" +
        sellerBooksStoreText("disconnectWarning"),
        sellerBooksStoreText("disconnectTitle")
    );

    if(!confirmed) return;

    try{
        const {data,error} = await sellerBooksSupabase.rpc(
            "sellerbooks_api_disconnect_marketplace",
            {
                p_connection_id: connection.id,
                p_store_id: String(store.id),
                /*
                   sellerbooks_api_connections memakai marketplace_id
                   kanonik konektor (contoh: "lazada", "tiktok"),
                   sedangkan store.marketplaceId adalah ID marketplace
                   milik user (contoh: "marketplace_...").
                   Gunakan ID dari row koneksi yang sudah ditemukan
                   oleh getStoreIntegrationConnection().
                */
                p_marketplace_id: String(
                    connection.marketplace_id ||
                    sellerBooksCanonicalMarketplaceId(
                        store.marketplaceId,
                        marketplace.name
                    )
                )
            }
        );

        if(error) throw error;

        if(!data?.ok){
            throw new Error("Koneksi tidak berhasil dicopot.");
        }

        sellerBooksStoreConnectionsUserId = "";
        await refreshStoreIntegrationStates(true);

        sellerBooksAlert(
            (sellerBooksCurrentLanguage() === "en" ? "Integration for " : "Integrasi ") +
            marketplace.name +
            (sellerBooksCurrentLanguage() === "en" ? " was disconnected successfully." : " berhasil dicopot."),
            sellerBooksStoreText("disconnectTitle")
        );
    }catch(error){
        console.error("Copot integrasi gagal:",error);
        sellerBooksAlert(
            (sellerBooksCurrentLanguage() === "en"
                ? "Failed to disconnect integration.\n\n"
                : "Integrasi gagal dicopot.\n\n") +
            (error?.message ||
                (sellerBooksCurrentLanguage() === "en"
                    ? "A server error occurred."
                    : "Terjadi kesalahan pada server.")),
            sellerBooksStoreText("disconnectTitle")
        );
    }
}

async function sellerBooksEnsureCloudStore(store){
    const sessionResult = await sellerBooksSupabase.auth.getSession();
    const session = sessionResult?.data?.session;
    if(sessionResult?.error || !session?.user?.id || !session?.access_token){
        throw new Error(sellerBooksCurrentLanguage() === "en"
            ? "Session expired. Please sign in again."
            : "Sesi berakhir. Silakan login kembali.");
    }
    if(!store || !store.id || !store.marketplaceId || !String(store.name || "").trim()){
        throw new Error(sellerBooksCurrentLanguage() === "en"
            ? "Store data is incomplete."
            : "Data toko belum lengkap.");
    }
    const storeMarketplace = Array.isArray(marketplaces)
        ? marketplaces.find(item => String(item.id) === String(store.marketplaceId))
        : null;
    const canonicalMarketplaceId = sellerBooksCanonicalMarketplaceId(
        store.marketplaceId,
        storeMarketplace?.name || store.marketplace || ""
    );
    const row = {
        id: String(store.id),
        owner_user_id: session.user.id,
        marketplace_id: String(canonicalMarketplaceId),
        store_code: String(store.code || ""),
        store_name: String(store.name).trim(),
        description: String(store.description || ""),
        fee_percent: Number(store.feePercent || 0),
        status: String(store.status || "active").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        updated_at: new Date().toISOString()
    };
    const saved = await sellerBooksSupabase
        .from("sellerbooks_stores")
        .upsert(row, { onConflict: "owner_user_id,id" });
    if(saved.error) throw saved.error;
    return session;
}

async function connectBlibliStoreManually(store, marketplace){
    const en = sellerBooksCurrentLanguage() === "en";
    const L = en ? {
        title:"Connect Blibli API",intro:"Enter your API Seller Key and store details from Blibli Seller Center to connect your store to SellerBooks.",
        sellerKey:"API Seller Key",storeCode:"Blibli Store Code",help:"How to connect",helpTitle:"How to Connect Blibli API",helpClose:"Close",
        username:"Seller Center Email Account",storeId:"Store ID",channelId:"Channel ID",
        note:"Credentials are saved securely and will not be displayed again.",
        consent:"I confirm these details are correct and agree to save them securely in SellerBooks MBI.",
        cancel:"Cancel",submit:"Save & Connect",required:"Complete all fields and confirm the checkbox. Nothing has been saved yet.",
        session:"SellerBooks session expired. Please sign in again.",create:"Could not create the Blibli API connection.",
        connected:"Blibli API connected successfully. No orders were imported. You can continue to the order-sync step next.",
        failed:"Blibli connection failed.",server:"Server error."
    } : {
        title:"Hubungkan API Blibli",intro:"Masukkan API Seller Key dan Kode Toko dari Seller Center Blibli agar SellerBooks dapat menghubungkan toko Anda.",
        sellerKey:"API Seller Key",storeCode:"Kode Toko Blibli",help:"Cara menghubungkan",helpTitle:"Cara Menghubungkan API Blibli",helpClose:"Tutup",
        username:"Email Akun Seller Center",storeId:"Store ID",channelId:"Channel ID",
        note:"Kredensial disimpan dengan aman dan tidak akan ditampilkan kembali.",
        consent:"Saya memastikan data sudah benar dan setuju menyimpannya dengan aman pada SellerBooks MBI.",
        cancel:"Batal",submit:"Simpan & Hubungkan",required:"Lengkapi semua kolom dan centang persetujuan. Belum ada data yang disimpan.",
        session:"Sesi SellerBooks kedaluwarsa. Silakan login kembali.",create:"Tidak bisa membuat koneksi API Blibli.",
        connected:"API Blibli berhasil terhubung. Belum ada pesanan yang diimpor. Berikutnya kita lanjutkan tahap pengambilan pesanan.",
        failed:"Koneksi Blibli gagal.",server:"Terjadi kesalahan server."
    };
    const credentials = await new Promise(resolve => {
        document.getElementById("sellerbooks-blibli-modal")?.remove();
        if(!document.getElementById("sellerbooks-blibli-modal-style")){
            const style = document.createElement("style");
            style.id = "sellerbooks-blibli-modal-style";
            style.textContent = ".sb-blibli-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,15,30,.68);backdrop-filter:blur(5px);font-family:inherit}.sb-blibli-dialog{width:min(680px,100%);max-height:92vh;overflow:auto;background:var(--card-bg,#fff);color:var(--text-color,#172033);border:1px solid rgba(120,135,160,.25);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.3);animation:sbBlibliIn .18s ease-out}.sb-blibli-header{display:flex;align-items:flex-start;gap:13px;padding:22px 24px 17px;border-bottom:1px solid rgba(120,135,160,.2)}.sb-blibli-mark{flex:0 0 42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#e7f7ed;color:#087b42;font-size:22px;font-weight:800}.sb-blibli-heading{flex:1;min-width:0}.sb-blibli-heading h2{margin:1px 0 7px;font-size:20px;line-height:1.3;font-weight:750}.sb-blibli-heading p{margin:0;font-size:13px;line-height:1.55;opacity:.76}.sb-blibli-close{border:0;background:transparent;color:inherit;opacity:.65;font-size:28px;cursor:pointer}.sb-blibli-help-trigger{display:inline-flex;align-items:center;gap:7px;margin:0 0 16px;border:1px solid #bfdbfe;border-radius:9px;padding:9px 12px;background:#eff6ff;color:#1d4ed8;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.sb-blibli-help-overlay{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,15,30,.72);backdrop-filter:blur(4px)}.sb-blibli-help-dialog{width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;color:#172033;border-radius:17px;box-shadow:0 24px 80px rgba(0,0,0,.35)}.sb-blibli-help-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:12px;padding:17px 20px;background:#fff;border-bottom:1px solid #e2e8f0}.sb-blibli-help-head h3{flex:1;margin:0;font-size:18px}.sb-blibli-help-head button{border:0;background:#eef2f7;border-radius:8px;padding:7px 11px;cursor:pointer}.sb-blibli-help-body{padding:18px 22px 22px}.sb-blibli-help-body ol{padding-left:23px;margin:0 0 18px}.sb-blibli-help-body li{padding-left:4px;margin:0 0 11px;line-height:1.5;font-size:14px}.sb-blibli-example{display:block;width:100%;height:auto;border:1px solid #dbe2ea;border-radius:10px;margin-top:12px;background:#f8fafc}.sb-blibli-form{padding:20px 24px 24px}.sb-blibli-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sb-blibli-grid label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:650}.sb-blibli-grid input{width:100%;min-width:0;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;background:var(--input-bg,#fff);color:var(--text-color,#172033);padding:11px 12px;font:inherit;font-size:14px;outline:none}.sb-blibli-grid input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.13)}.sb-blibli-full{grid-column:1/-1}.sb-blibli-secure{display:flex;gap:9px;margin-top:17px;padding:11px 12px;border-radius:10px;background:rgba(16,185,129,.09);font-size:12px;line-height:1.45}.sb-blibli-consent{display:flex;align-items:flex-start;gap:9px;margin-top:15px;font-size:12px;line-height:1.5;cursor:pointer}.sb-blibli-consent input{margin-top:3px;accent-color:#2563eb}.sb-blibli-error{display:none;margin-top:12px;padding:10px 12px;border-radius:9px;background:#fff1f2;color:#be123c;font-size:12px}.sb-blibli-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.sb-blibli-actions button{border:0;border-radius:10px;padding:11px 16px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.sb-blibli-cancel{background:#e8edf5;color:#263247}.sb-blibli-submit{background:#1459d9;color:#fff}.sb-blibli-submit:disabled{opacity:.65;cursor:wait}@keyframes sbBlibliIn{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:560px){.sb-blibli-overlay{padding:9px}.sb-blibli-dialog{border-radius:15px;max-height:95vh}.sb-blibli-header{padding:17px 15px 13px}.sb-blibli-form{padding:15px}.sb-blibli-grid{grid-template-columns:1fr;gap:12px}.sb-blibli-full{grid-column:auto}.sb-blibli-heading h2{font-size:18px}.sb-blibli-actions button{flex:1}}";
            document.head.appendChild(style);
        }
        const modal = document.createElement("div");
        modal.id = "sellerbooks-blibli-modal";
        modal.className = "sb-blibli-overlay";
        modal.innerHTML = "<section class=\"sb-blibli-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"sb-blibli-title\"><header class=\"sb-blibli-header\"><div class=\"sb-blibli-mark\">B</div><div class=\"sb-blibli-heading\"><h2 id=\"sb-blibli-title\">"+L.title+"</h2><p>"+L.intro+"</p></div><button type=\"button\" class=\"sb-blibli-close\" aria-label=\""+L.cancel+"\">×</button></header><form class=\"sb-blibli-form\"><button type=\"button\" class=\"sb-blibli-help-trigger\">ⓘ "+L.help+"</button><div class=\"sb-blibli-grid\"><label>"+L.sellerKey+"<input name=\"sellerKey\" type=\"password\" autocomplete=\"new-password\" required placeholder=\""+(en?"Enter the API password you generated":"Masukkan sandi API yang sudah dibuat")+"\" /></label><label>"+L.storeCode+"<input name=\"storeCode\" required placeholder=\"" +(en?"Enter your Blibli store code":"Masukkan kode toko Blibli")+"\" /></label><label>"+L.username+"<input name=\"username\" autocomplete=\"username\" required /></label><label>"+L.storeId+"<input name=\"storeId\" required value=\"10001\" /></label><label class=\"sb-blibli-full\">"+L.channelId+"<input name=\"channelId\" required value=\"SellerBooks MBI\" /></label></div><div class=\"sb-blibli-secure\"><span aria-hidden=\"true\">🔒</span><span>"+L.note+"</span></div><label class=\"sb-blibli-consent\"><input name=\"consent\" type=\"checkbox\" required /><span>"+L.consent+"</span></label><div class=\"sb-blibli-error\" role=\"alert\" aria-live=\"polite\"></div><footer class=\"sb-blibli-actions\"><button type=\"button\" class=\"sb-blibli-cancel\">"+L.cancel+"</button><button type=\"submit\" class=\"sb-blibli-submit\">"+L.submit+"</button></footer></form></section>";
        document.body.appendChild(modal);
        const helpButton = modal.querySelector(".sb-blibli-help-trigger");
        helpButton.addEventListener("click", () => {
            document.getElementById("sellerbooks-blibli-help")?.remove();
            const help = document.createElement("div");
            help.id = "sellerbooks-blibli-help";
            help.className = "sb-blibli-help-overlay";
            const steps = en ? [
                "Log in to your Blibli Seller Center.",
                "Open your profile and find Seller API Settings.",
                "Under Connect Manually, create an API password by clicking Create.",
                "Scroll down to Connect API Client, enter <strong><code>mta-api-adiimasadistribu-6e304</code></strong> without quotation marks, then click Connect.",
                "Copy the store code and API password into the matching fields in SellerBooks.",
                "Enter the username/email used for your Blibli Seller Center store.",
                "Leave Store ID and Channel ID at their default values. Do not change them.",
                "Tick the consent checkbox and click Save & Connect."
            ] : [
                "Login pada Seller Center Blibli Anda.",
                "Masuk ke profil dan cari Pengaturan Seller API.",
                "Pada Hubungkan manual, atur kata sandi API dengan cara klik Buat.",
                "Lalu scroll ke bawah, pada Hubungkan API Klien salin kode <strong><code>mta-api-adiimasadistribu-6e304</code></strong> dan paste pada kolom, lalu klik Hubungkan.",
                "Salin kode toko dan kata sandi API ke kolom yang tersedia di SellerBooks.",
                "Masukkan username/email toko Blibli Anda.",
                "Store ID dan Channel ID biarkan default, jangan dirubah.",
                "Centang persetujuan, lalu klik Simpan & Hubungkan."
            ];
            const example = '<img class="sb-blibli-example" src="/contoh-api-blibli.png?v=20261015" alt="' + (en ? "Blibli Seller Center API settings screenshot" : "Screenshot pengaturan API Seller Center Blibli") + '" loading="lazy" />';
            help.innerHTML = "<section class=\"sb-blibli-help-dialog\" role=\"dialog\" aria-modal=\"true\"><header class=\"sb-blibli-help-head\"><h3>" + L.helpTitle + "</h3><button type=\"button\" class=\"sb-blibli-help-close\">" + L.helpClose + "</button></header><div class=\"sb-blibli-help-body\"><ol>" + steps.map(step => "<li>" + step + "</li>").join("") + "</ol><strong>" + (en ? "Seller Center API settings example" : "Contoh tampilan pengaturan API Seller Center") + "</strong>" + example + "</div></section>";
            document.body.appendChild(help);
            const closeHelp = () => help.remove();
            help.querySelector(".sb-blibli-help-close").addEventListener("click", closeHelp);
            help.addEventListener("click", event => { if (event.target === help) closeHelp(); });
        });
        const form = modal.querySelector("form");
        form.noValidate = true; // Use SellerBooks-localized validation messages instead of browser-language tooltips.
        let settled = false;
        const finish = value => { if(settled)return; settled=true; document.removeEventListener("keydown",onKey); modal.remove(); resolve(value); };
        const onKey = event => { if(event.key==="Escape") finish(null); };
        document.addEventListener("keydown",onKey);
        modal.querySelector(".sb-blibli-close").addEventListener("click",()=>finish(null));
        modal.querySelector(".sb-blibli-cancel").addEventListener("click",()=>finish(null));
        modal.addEventListener("click",event=>{if(event.target===modal)finish(null);});
        form.addEventListener("submit",event=>{
            event.preventDefault();
            const d=new FormData(form);
            const values={api_seller_key:String(d.get("sellerKey")||"").trim(),store_code:String(d.get("storeCode")||"").trim(),username:String(d.get("username")||"").trim(),store_id:String(d.get("storeId")||"").trim(),channel_id:String(d.get("channelId")||"").trim()};
            const error=modal.querySelector(".sb-blibli-error");
            if(Object.values(values).some(v=>!v)||!d.get("consent")){error.textContent=L.required;error.style.display="block";return;}
            finish(values);
        });
        modal.querySelector('input[name="sellerKey"]').focus();
    });
    if(!credentials)return;
    try{
        const sessionResult=await sellerBooksSupabase.auth.getSession();
        const session=sessionResult?.data?.session;
        if(sessionResult?.error||!session?.access_token)throw new Error(L.session);
        // Mirror the authenticated owner's store into the relational table before creating its API connection.
        await sellerBooksEnsureCloudStore(store);
        const canonicalMarketplaceId = sellerBooksCanonicalMarketplaceId(
            store.marketplaceId,
            marketplace.name || "Blibli"
        );
        const upsert=await sellerBooksSupabase.rpc("sellerbooks_api_upsert_connection",{
            p_store_id:String(store.id),
            p_marketplace_id:String(canonicalMarketplaceId),
            p_marketplace:String(marketplace.name||"Blibli")
        });
        if(upsert.error)throw upsert.error;
        const connection=Array.isArray(upsert.data)?upsert.data[0]:upsert.data;
        if(!connection?.id)throw new Error(L.create);
        const saved=await sellerBooksSupabase.rpc("sellerbooks_api_set_secret",{p_connection_id:String(connection.id),p_secret:JSON.stringify(credentials)});
        if(saved.error)throw saved.error;
        const response=await fetch(SELLERBOOKS_SUPABASE_URL+"/functions/v1/sellerbooks-blibli-test-connection",{method:"POST",headers:{apikey:SELLERBOOKS_SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({connection_id:String(connection.id)})});
        const result=await response.json().catch(()=>({}));
        await refreshStoreIntegrationStates(true);
        if(!response.ok||!result.ok)throw new Error(result.error||(en?"Blibli connection test failed.":"Tes koneksi Blibli gagal."));
        sellerBooksAlert(L.connected,sellerBooksStoreText("connectTitle"));
    }catch(error){
        console.error("Koneksi Blibli gagal:",error);
        await refreshStoreIntegrationStates(true).catch(()=>{});
        sellerBooksAlert(L.failed+"\n\n"+(error?.message||L.server),sellerBooksStoreText("connectTitle"));
    }
}

async function integrateStoreAccount(storeId){

    const store = stores.find(function(item){
        return String(item.id) === String(storeId);
    });

    if(!store){
        sellerBooksAlert(sellerBooksStoreText("storeNotFound"),sellerBooksStoreText("connectTitle"));
        return;
    }

    const marketplace = marketplaces.find(function(item){
        return item.id === store.marketplaceId;
    });

    if(!marketplace){
        sellerBooksAlert(sellerBooksStoreText("marketplaceNotFound"),sellerBooksStoreText("connectTitle"));
        return;
    }

    const initialMarketplaceKey = String(marketplace.name || "").toLowerCase().replace(/\\s+/g,"");
    if(initialMarketplaceKey.includes("blibli")){
        await connectBlibliStoreManually(store, marketplace);
        return;
    }

    /*
       UNIVERSAL MARKETPLACE OAUTH - SESSION BRIDGE
       ------------------------------------------------
       OAuth INIT sekarang dijalankan DI WEBVIEW/halaman SellerBooks
       yang sedang login, bukan di browser tujuan.

       Browser eksternal hanya menerima authorization_url dari backend
       dan menangani login/consent marketplace.

       Dengan pola ini:
       - Chrome tidak perlu login SellerBooks.
       - WebView Windows tetap menjadi sumber session SellerBooks.
       - APK Android tetap menjadi sumber session SellerBooks.
       - Semua marketplace memakai lifecycle init -> browser -> callback
         yang sama; adapter OAuth provider tetap berbeda di backend.
    */
    const providerMap = {
        tiktok:  "sellerbooks-tiktok-oauth",
        shopee:  "sellerbooks-shopee-oauth",
        lazada:  "sellerbooks-lazada-oauth"
    };

    const marketplaceKey = String(marketplace.name || "")
        .toLowerCase()
        .replace(/\s+/g,"")
        .replace(/shop$/,"shop");

    let endpoint = "";

    if(marketplaceKey.includes("tiktok")){
        endpoint = providerMap.tiktok;
    }else if(marketplaceKey.includes("shopee")){
        endpoint = providerMap.shopee;
    }else if(marketplaceKey.includes("lazada")){
        endpoint = providerMap.lazada;
    }

    /*
       TikTok Shop, Shopee, dan Lazada memakai lifecycle OAuth yang sama.
       Shopee menggunakan Edge Function sellerbooks-shopee-oauth yang sudah ada.
       Marketplace lain tetap menampilkan popup "Segera Hadir".
    */
    if(!endpoint){
        sellerBooksAlert(
            sellerBooksStoreText("integrationUnavailable")
                .replace("{marketplace}", String(marketplace.name || "marketplace")),
            sellerBooksStoreText("soonTitle")
        );
        return;
    }

    /*
       WAJIB buka window secara sinkron dari klik user.
       Setelah itu kita boleh menunggu auth.getSession() dan backend init.
       Popup sementara tetap berada pada launcher/loading page.
    */
    const launcherUrl = new URL(
        "marketplace-oauth-launcher.html" +
        "?v=20260930-session-bridge" +
        "&store_id=" + encodeURIComponent(String(store.id)) +
        "&marketplace_id=" + encodeURIComponent(String(store.marketplaceId || "")) +
        "&marketplace_name=" + encodeURIComponent(String(marketplace.name || "")) +
        "&handoff=pending",
        window.location.href
    ).href;

    /*
       WINDOWS ADMIN:
       Jangan membuka launcher di dalam WebView lalu mencoba memindahkannya
       setelah await. WebView2 dapat mengembalikan WindowProxy kosong setelah
       NewWindowRequested diambil alih native. Untuk aplikasi Windows, URL
       OAuth final dikirim langsung ke host native melalui WebView2 message.

       Browser biasa tetap memakai popup launcher seperti sebelumnya.
    */
    const isSellerBooksWindowsApp =
        /SellerBooksAdmin\/1\.0/i.test(navigator.userAgent.replace(/\s+/g,""));

    /*
       ANDROID APK:
       MainActivity sudah menangani URL OAuth marketplace secara native
       dan membukanya dengan browser eksternal melalui ACTION_VIEW.
       Jangan membuka marketplace-oauth-launcher.html dengan window.open()
       di Android karena setSupportMultipleWindows(false) membuat window.open()
       dapat menggantikan halaman SellerBooks saat init masih menunggu.
       Akibatnya launcher akan berhenti di "Menyiapkan halaman otorisasi".
    */
    const isSellerBooksAndroidApp =
        /SellerBooksAPK\/1\.0/i.test(navigator.userAgent.replace(/\s+/g,""));

    let oauthTab = null;

    if(!isSellerBooksWindowsApp && !isSellerBooksAndroidApp){        const popupWidth = 520;
        const popupHeight = 760;
        const screenLeft = typeof window.screenLeft === "number" ? window.screenLeft : window.screenX;
        const screenTop = typeof window.screenTop === "number" ? window.screenTop : window.screenY;
        const outerWidth = window.outerWidth || window.innerWidth;
        const outerHeight = window.outerHeight || window.innerHeight;

        const popupLeft = Math.max(0, screenLeft + Math.round((outerWidth - popupWidth) / 2));
        const popupTop = Math.max(0, screenTop + Math.round((outerHeight - popupHeight) / 2));

        oauthTab = window.open(
            launcherUrl,
            "SellerBooksMarketplaceOAuth",
            [
                "popup=yes",
                "width=" + popupWidth,
                "height=" + popupHeight,
                "left=" + popupLeft,
                "top=" + popupTop,
                "resizable=yes",
                "scrollbars=yes"
            ].join(",")
        );

        if(!oauthTab){
            sellerBooksAlert(
                "Popup/tab baru diblokir browser. Silakan izinkan pop-up untuk SellerBooks lalu klik Integrasikan Akun lagi.",
                "Integrasikan Akun"
            );
            return;
        }
    }

    try{
        /*
           Session SellerBooks diambil dari client Supabase yang hidup
           di halaman asal. TIDAK membaca localStorage Chrome.
        */
        const sessionResult = await sellerBooksSupabase.auth.getSession();
        const session = sessionResult?.data?.session;

        if(!session?.access_token){
            throw new Error("Sesi SellerBooks tidak tersedia. Silakan login kembali.");
        }

        const response = await fetch(
            SELLERBOOKS_SUPABASE_URL +
            "/functions/v1/" + endpoint +
            "?action=init",
            {
                method:"POST",
                headers:{
                    "apikey":SELLERBOOKS_SUPABASE_KEY,
                    "Authorization":"Bearer " + session.access_token,
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    store_id:String(store.id),
                    marketplace_id:String(store.marketplaceId || ""),
                    marketplace_name:String(marketplace.name || "")
                })
            }
        );

        const data = await response.json().catch(function(){ return {}; });

        if(!response.ok || !data.authorization_url){
            throw new Error(
                data.error ||
                ("OAuth " + String(marketplace.name || "Marketplace") + " tidak dapat dimulai.")
            );
        }

        /*
           Inilah handoff sebenarnya:
           authorization_url sudah dibuat oleh backend menggunakan
           session SellerBooks dari WEBVIEW.

           Browser eksternal tidak perlu mengetahui access token SellerBooks.
        */
        if(isSellerBooksWindowsApp){
            /*
               Handoff native Windows:
               - Jangan buka authorization_url langsung dari native host.
               - Native host membuka SATU browser window kecil berisi
                 marketplace-oauth-launcher.html.
               - Launcher kemudian location.replace() ke authorization_url,
                 sehingga login marketplace tetap berada pada TAB YANG SAMA.
               - Tidak ada fallback window.open(), ACK timer, Alt+F4/Ctrl+W,
                 atau pembunuhan proses browser.
            */
            if(window.chrome?.webview?.postMessage){
                const launcherUrl =
                    "https://sellerbooks.github.io/marketplace-oauth-launcher.html" +
                    "?handoff=windows" +
                    "&marketplace_name=" + encodeURIComponent(String(marketplace.name || "")) +
                    "&authorization_url=" + encodeURIComponent(String(data.authorization_url));

                window.chrome.webview.postMessage(JSON.stringify({
                    type:"sellerbooks.oauth.launch",
                    marketplace:String(marketplace.name || ""),
                    authorization_url:String(data.authorization_url),
                    launcher_url:launcherUrl
                }));
            }else{
                throw new Error("Bridge native SellerBooks Admin tidak tersedia. Silakan gunakan build SellerBooks Admin terbaru.");
            }
        }else if(isSellerBooksAndroidApp){
            /*
               Handoff native Android:
               MainActivity.shouldOverrideUrlLoading() akan menangkap URL
               OAuth marketplace ini lalu membuka browser eksternal dengan
               ACTION_VIEW. SellerBooks session tetap tinggal di WebView APK.
            */
            window.location.href = data.authorization_url;
        }else if(oauthTab && !oauthTab.closed){
            oauthTab.location.replace(data.authorization_url);
        }

    }catch(error){
        console.error("Marketplace OAuth init gagal:",error);

        try{
            if(oauthTab && !oauthTab.closed){
                oauthTab.close();
            }
        }catch(e){}

        sellerBooksAlert(
            "Integrasi " + String(marketplace.name || "Marketplace") +
            " gagal dimulai.\n\n" +
            (error?.message || "Terjadi kesalahan saat menyiapkan OAuth."),
            "Integrasikan Akun"
        );
    }
}
