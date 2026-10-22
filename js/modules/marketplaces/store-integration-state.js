let sellerBooksStoreConnections = new Map();
let sellerBooksStoreConnectionsUserId = "";
let sellerBooksStoreConnectionsLoading = false;
let sellerBooksStoreConnectionsQueued = false;
let sellerBooksStoreConnectionsInitialized = false;
let sellerBooksIntegrationStatusPollingTimer = null;

function sellerBooksStoreConnectionKey(storeId, marketplaceId){
    return String(storeId || "") + "|" + String(marketplaceId || "").trim().toLowerCase();
}

function sellerBooksConnectionMarketplaceKey(connection){
    if(!connection) return "";
    return sellerBooksCanonicalMarketplaceId(
        connection.marketplace_id,
        connection.marketplace
    );
}

async function refreshStoreIntegrationStates(force){
    if(!sellerBooksAuthUser) return;

    const userId = String(sellerBooksAuthUser.id || "");
    if(!userId) return;

    if(sellerBooksStoreConnectionsLoading){
        /*
           Request sebelumnya sedang berjalan. Jangan biarkan permintaan
           yang macet mengunci semua percobaan ulang selamanya.
           Paksa retry boleh melepaskan lock dan memulai request baru;
           response lama tidak boleh mengganti state setelah lock diambil
           oleh request yang lebih baru.
        */
        if(force && !sellerBooksStoreConnectionsQueued){
            sellerBooksStoreConnectionsQueued = true;
            setTimeout(function(){
                sellerBooksStoreConnectionsQueued = false;
                if(sellerBooksStoreConnectionsLoading){
                    sellerBooksStoreConnectionsLoading = false;
                }
                refreshStoreIntegrationStates(true);
            }, 1500);
        }
        return;
    }

    if(!force && sellerBooksStoreConnectionsUserId === userId){
        return;
    }

    sellerBooksStoreConnectionsLoading = true;

    try{
        /*
           Batas waktu eksplisit: jika jaringan/RPC Supabase macet,
           jangan biarkan sellerBooksStoreConnectionsLoading terkunci
           selamanya. Promise.race tidak membatalkan request yang tertinggal,
           tetapi memungkinkan UI keluar ke catch/finally dan menyediakan retry.
        */
        let connectionTimeoutId = null;
        const connectionRequest = sellerBooksSupabase.rpc(
            "sellerbooks_api_list_connections"
        );
        const connectionTimeout = new Promise(function(resolve,reject){
            connectionTimeoutId = setTimeout(function(){
                reject(new Error(
                    "Waktu tunggu status integrasi habis. Periksa koneksi cloud lalu coba lagi."
                ));
            },15000);
        });

        let connectionResult;
        try{
            connectionResult = await Promise.race([
                connectionRequest,
                connectionTimeout
            ]);
        }finally{
            if(connectionTimeoutId !== null){
                clearTimeout(connectionTimeoutId);
            }
        }

        const {data,error} = connectionResult;
        if(error) throw error;

        const next = new Map();

        (Array.isArray(data) ? data : []).forEach(function(connection){
            const canonicalMarketplaceId =
                sellerBooksConnectionMarketplaceKey(connection);

            if(!canonicalMarketplaceId){
                return;
            }

            next.set(
                sellerBooksStoreConnectionKey(
                    connection.store_id,
                    canonicalMarketplaceId
                ),
                connection
            );
        });

        const previousConnections = sellerBooksStoreConnections;

        sellerBooksStoreConnections = next;
        sellerBooksStoreConnectionsUserId = userId;

        // Bandingkan status lama vs status terbaru. Ini menjadi fallback
        // realtime untuk WebView/browser yang tidak menerima WebSocket
        // Supabase Realtime secara konsisten.
        //
        // Selain CONNECTED -> CONNECTED, perubahan kebalikannya juga
        // harus langsung diterapkan: CONNECTED -> DISCONNECTED/EXPIRED/ERROR
        // atau koneksi hilang dari hasil RPC. Dengan begitu semua client
        // mengikuti kondisi Supabase tanpa refresh.
        if(sellerBooksStoreConnectionsInitialized){

            // 1. Status berubah menjadi CONNECTED.
            next.forEach(function(connection, key){
                const previous = previousConnections.get(key);

                const previousStatus = String(
                    previous?.connection_status || ""
                ).toUpperCase();

                const nextStatus = String(
                    connection?.connection_status || ""
                ).toUpperCase();

                if(
                    previousStatus !== "CONNECTED" &&
                    nextStatus === "CONNECTED"
                ){
                    const marketplaceId =
                        String(connection.marketplace_id || "").toLowerCase();

                    const suppressedUntil =
                        sellerBooksIntegrationRealtimeSuppress.get(
                            "__MARKETPLACE__|" + marketplaceId
                        ) || 0;

                    if(suppressedUntil > Date.now()){
                        sellerBooksIntegrationRealtimeSuppress.delete(
                            "__MARKETPLACE__|" + marketplaceId
                        );
                    }
                    /*
                       Perubahan status CONNECTED di background hanya
                       memperbarui state/tombol akun toko.
                       Popup "Integrasi Berhasil" hanya boleh muncul
                       dari alur OAuth saat akun benar-benar pertama kali
                       diintegrasikan, bukan saat Tarik Order / refresh.
                    */
                }

                // 2. Status berubah dari CONNECTED menjadi tidak aktif.
                // Tidak memakai alert untuk setiap polling agar tidak spam;
                // UI/button tetap langsung berubah di semua client.
            });

            // 3. Koneksi dihapus dari tabel. Ini penting untuk kasus
            // tombol "Copot Integrasi" yang benar-benar menghapus row.
            previousConnections.forEach(function(previous, key){
                if(next.has(key)) return;

                const previousStatus = String(
                    previous?.connection_status || ""
                ).toUpperCase();

                if(previousStatus === "CONNECTED"){
                    // Row sudah hilang dari Supabase, sehingga renderStores()
                    // di bawah akan otomatis menampilkan "Integrasikan Akun".
                }
            });
        }

        sellerBooksStoreConnectionsInitialized = true;

        // Setiap kali status koneksi selesai dibaca dari Supabase,
        // render ulang kartu akun toko hanya jika halaman Stores sedang aktif.
        // Polling tetap berjalan dan state koneksi tetap diperbarui di background,
        // tetapi halaman lain tidak ikut menerima render DOM setiap 1,5 detik.
        const storesView = document.getElementById("stores");
        const storesViewIsActive =
            !!storesView && storesView.classList.contains("active");

        if(
            storesViewIsActive &&
            typeof renderStores === "function"
        ){
            renderStores(true);
        }
    }catch(error){
        console.warn("Status integrasi akun toko gagal dimuat:",error);

        /*
           Jangan biarkan halaman Akun Toko menampilkan loading tanpa akhir
           ketika RPC gagal. Tampilkan pesan yang bisa dipahami dan tombol
           coba lagi; jangan menandai koneksi sebagai DISCONNECTED karena
           kegagalan membaca cloud bukan bukti bahwa integrasi terputus.
        */
        const storesView = document.getElementById("stores");
        const grid = document.getElementById("storesGrid");
        const storesViewIsActive =
            !!storesView && storesView.classList.contains("active");

        if(storesViewIsActive && grid && !grid.querySelector(".store-card")){
            const en = String(
                typeof sellerBooksCurrentLanguage === "function"
                    ? sellerBooksCurrentLanguage()
                    : "ID"
            ).trim().toUpperCase() === "EN";

            grid.innerHTML =
                '<div class="store-empty">' +
                    '<div class="store-empty-icon">⚠️</div>' +
                    '<h3>' +
                        (en
                            ? 'Could not load marketplace connection status'
                            : 'Status integrasi marketplace gagal dimuat') +
                    '</h3>' +
                    '<p>' +
                        (en
                            ? 'Your connection data has not been changed. Please try again.'
                            : 'Data integrasi tidak diubah. Silakan coba muat kembali statusnya.') +
                    '</p>' +
                    '<button type="button" class="store-action-button store-integrate-button" ' +
                        'onclick="refreshStoreIntegrationStates(true)">' +
                        (en ? 'Try again' : 'Coba Lagi') +
                    '</button>' +
                '</div>';
        }
    }finally{
        sellerBooksStoreConnectionsLoading = false;
    }
}

function sellerBooksCanonicalMarketplaceId(value, marketplaceName){
    const normalize = function(input){
        return String(input || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    };

    const idKey = normalize(value);
    const nameKey = normalize(marketplaceName);

    const aliases = {
        shopee: "shopee",
        tiktok: "tiktok",
        tiktokshop: "tiktok",
        tokopedia: "tokopedia",
        tokped: "tokopedia",
        lazada: "lazada",
        toco: "toco",
        blibli: "blibli"
    };

    if(aliases[idKey]){
        return aliases[idKey];
    }

    if(aliases[nameKey]){
        return aliases[nameKey];
    }

    return String(value || "");
}

function getStoreIntegrationConnection(store){
    if(!store) return null;

    /*
       Akun toko menyimpan marketplaceId sebagai ID marketplace
       milik user, misalnya "marketplace_1790509307069".
       Tabel sellerbooks_api_connections memakai ID kanonik
       konektor, misalnya "tiktok".
       Cari marketplace berdasarkan ID toko lalu normalkan ke ID
       konektor agar status CONNECTED dapat dipasangkan ke kartu
       toko yang benar.
    */
    const marketplace = Array.isArray(marketplaces)
        ? marketplaces.find(function(item){
            return String(item.id) === String(store.marketplaceId);
        })
        : null;

    const canonicalMarketplaceId =
        sellerBooksCanonicalMarketplaceId(
            store.marketplaceId,
            marketplace?.name
        );

    return sellerBooksStoreConnections.get(
        sellerBooksStoreConnectionKey(
            store.id,
            canonicalMarketplaceId
        )
    ) || sellerBooksStoreConnections.get(
        sellerBooksStoreConnectionKey(
            store.id,
            store.marketplaceId
        )
    ) || null;
}

function sellerBooksStartIntegrationStatusPolling(){
    if(sellerBooksIntegrationStatusPollingTimer){
        clearInterval(sellerBooksIntegrationStatusPollingTimer);
    }

    // 1,5 detik sebagai fallback realtime. Tidak bergantung pada
    // refresh halaman dan tetap bekerja pada Chrome, Windows WebView,
    // maupun Android WebView jika WebSocket Realtime gagal.
    const check=function(){
        if(!sellerBooksAuthUser)return;
        refreshStoreIntegrationStates(true);
    };

    check();

    sellerBooksIntegrationStatusPollingTimer =
        setInterval(check,1500);
}

function sellerBooksStopIntegrationStatusPolling(){
    if(sellerBooksIntegrationStatusPollingTimer){
        clearInterval(
            sellerBooksIntegrationStatusPollingTimer
        );
        sellerBooksIntegrationStatusPollingTimer = null;
    }
}



/* =====================================================
   REALTIME STATUS INTEGRASI AKUN TOKO
   Semua perangkat/tab yang sedang login menerima perubahan
   status koneksi tanpa perlu refresh.
===================================================== */

let sellerBooksIntegrationRealtimeChannel = null;
let sellerBooksIntegrationRealtimeSuppress = new Map();

/*
   Anti-duplicate notification:
   callback OAuth dan Supabase Realtime sama-sama dapat memberitahu
   bahwa koneksi berhasil. Simpan waktu notifikasi langsung agar
   realtime hanya menjadi fallback, bukan ikut membungkam notifikasi.
*/
let sellerBooksIntegrationSuccessNoticeAt = new Map();

function sellerBooksMarkIntegrationSuccessNotice(
    storeId,
    marketplaceId
){
    const key = sellerBooksStoreConnectionKey(
        storeId,
        marketplaceId
    );

    sellerBooksIntegrationSuccessNoticeAt.set(
        key,
        Date.now()
    );

    setTimeout(function(){
        const noticedAt =
            sellerBooksIntegrationSuccessNoticeAt.get(key) || 0;

        if(noticedAt && Date.now() - noticedAt >= 10000){
            sellerBooksIntegrationSuccessNoticeAt.delete(key);
        }
    },10500);
}

function sellerBooksShouldShowIntegrationSuccessNotice(
    storeId,
    marketplaceId
){
    const key = sellerBooksStoreConnectionKey(
        storeId,
        marketplaceId
    );

    const noticedAt =
        sellerBooksIntegrationSuccessNoticeAt.get(key) || 0;

    if(noticedAt && Date.now() - noticedAt < 10000){
        return false;
    }

    sellerBooksIntegrationSuccessNoticeAt.set(
        key,
        Date.now()
    );

    return true;
}

function sellerBooksStopIntegrationRealtime(){
    if(sellerBooksIntegrationRealtimeChannel){
        sellerBooksSupabase.removeChannel(
            sellerBooksIntegrationRealtimeChannel
        );
        sellerBooksIntegrationRealtimeChannel = null;
    }
}

function sellerBooksIntegrationRealtimeSuppressMarketplace(
    marketplaceId
){
    const key =
        "__MARKETPLACE__|" +
        String(marketplaceId || "").toLowerCase();

    sellerBooksIntegrationRealtimeSuppress.set(
        key,
        Date.now() + 10000
    );

    setTimeout(function(){
        const expiresAt =
            sellerBooksIntegrationRealtimeSuppress.get(key) || 0;

        if(expiresAt <= Date.now()){
            sellerBooksIntegrationRealtimeSuppress.delete(key);
        }
    },10500);
}

function sellerBooksIntegrationRealtimeSuppressSuccess(
    storeId,
    marketplaceId
){
    const key = sellerBooksStoreConnectionKey(
        storeId,
        marketplaceId
    );

    sellerBooksIntegrationRealtimeSuppress.set(
        key,
        Date.now() + 10000
    );

    setTimeout(function(){
        const expiresAt =
            sellerBooksIntegrationRealtimeSuppress.get(key) || 0;

        if(expiresAt <= Date.now()){
            sellerBooksIntegrationRealtimeSuppress.delete(key);
        }
    },10500);
}

function sellerBooksIntegrationMarketplaceLabel(marketplaceId, marketplaceName){
    const id = String(marketplaceId || "").toLowerCase();

    if(id === "tiktok" || id === "tiktokshop"){
        return "TikTok Shop";
    }

    if(id === "shopee"){
        return "Shopee";
    }

    if(id === "lazada"){
        return "Lazada";
    }

    if(id === "toco"){
        return "Toco";
    }

    if(id === "tokopedia"){
        return "Tokopedia";
    }

    if(id === "blibli"){
        return "Blibli";
    }

    return String(marketplaceName || marketplaceId || "Marketplace");
}

async function sellerBooksApplyOAuthConnectionState(connectionId){
    const id = String(connectionId || "").trim();
    if(!id || !sellerBooksAuthUser || !sellerBooksSupabase){
        return false;
    }

    try{
        const {data,error} = await sellerBooksSupabase
            .from("sellerbooks_api_connections")
            .select(
                "id,store_id,marketplace_id,marketplace,connection_status,sync_enabled,external_store_id,updated_at"
            )
            .eq("id", id)
            .maybeSingle();

        if(error) throw error;
        if(!data) return false;

        const canonicalMarketplaceId =
            sellerBooksConnectionMarketplaceKey(data);

        if(!canonicalMarketplaceId){
            return false;
        }

        const key = sellerBooksStoreConnectionKey(
            data.store_id,
            canonicalMarketplaceId
        );

        const next = new Map(sellerBooksStoreConnections);

        if(
            String(data.connection_status || "").toUpperCase() === "CONNECTED"
        ){
            next.set(key, data);
        }else{
            next.delete(key);
        }

        sellerBooksStoreConnections = next;
        sellerBooksStoreConnectionsUserId =
            String(sellerBooksAuthUser.id || "");
        sellerBooksStoreConnectionsInitialized = true;

        if(typeof renderStores === "function"){
            renderStores(true);
        }

        return String(data.connection_status || "").toUpperCase() === "CONNECTED";
    }catch(error){
        console.warn("Status koneksi OAuth langsung gagal dibaca:", error);
        return false;
    }
}

function sellerBooksHandleIntegrationRealtimePayload(payload){
    const eventType = String(payload?.eventType || "").toUpperCase();
    const record = payload?.new || {};
    const oldRecord = payload?.old || {};

    const storeId = String(
        record.store_id ||
        oldRecord.store_id ||
        ""
    );

    const rawMarketplaceId = String(
        record.marketplace_id ||
        oldRecord.marketplace_id ||
        ""
    );

    const marketplaceId = sellerBooksCanonicalMarketplaceId(
        rawMarketplaceId,
        record.marketplace || oldRecord.marketplace
    );

    if(!storeId || !marketplaceId){
        return;
    }

    /*
       REALTIME HARDENING
       Jangan menunggu RPC/polling untuk mengubah UI.
       Begitu event Supabase masuk, langsung terapkan row tersebut
       ke Map lokal dan render kartu. Setelah itu tetap lakukan RPC
       sebagai verifikasi/sinkronisasi penuh.
       
       Ini penting untuk:
       - Chrome -> Android WebView
       - Android WebView -> Chrome
       - Windows WebView -> Chrome
       - CONNECTED -> DISCONNECTED
       - DISCONNECTED -> CONNECTED
    */
    const canonicalMarketplaceId =
        sellerBooksCanonicalMarketplaceId(
            marketplaceId,
            record.marketplace || oldRecord.marketplace
        );

    const key = sellerBooksStoreConnectionKey(
        storeId,
        canonicalMarketplaceId
    );

    const nextConnections =
        new Map(sellerBooksStoreConnections);

    if(eventType === "DELETE"){
        nextConnections.delete(key);
    }else if(record && record.id){
        nextConnections.set(key, record);
    }

    sellerBooksStoreConnections = nextConnections;
    sellerBooksStoreConnectionsUserId =
        String(sellerBooksAuthUser?.id || "");

    sellerBooksStoreConnectionsInitialized = true;

    if(typeof renderStores === "function"){
        renderStores(true);
    }

    /*
       Verifikasi ulang dari database. Jika WebView kehilangan event
       atau event datang sebelum sesi siap, polling/RPC tetap menjadi
       fallback.
    */
    sellerBooksStoreConnectionsUserId = "";
    refreshStoreIntegrationStates(true);

    const newStatus = String(
        record.connection_status || ""
    ).toUpperCase();

    const oldStatus = String(
        oldRecord.connection_status || ""
    ).toUpperCase();

    // Notifikasi hanya ketika status benar-benar berubah menjadi CONNECTED.
    if(
        newStatus !== "CONNECTED" ||
        oldStatus === "CONNECTED"
    ){
        return;
    }

    /*
       Jangan membungkam event realtime hanya karena callback OAuth
       juga mengirim notifikasi. Realtime tetap menjadi fallback.
       Hanya cegah notifikasi ganda dalam window 10 detik.
    */
    if(!sellerBooksShouldShowIntegrationSuccessNotice(
        storeId,
        marketplaceId
    )){
        return;
    }

    /*
       Realtime hanya menyinkronkan status koneksi.
       Notifikasi "Integrasi Berhasil" ditampilkan oleh callback OAuth
       ketika integrasi benar-benar dilakukan, bukan oleh perubahan
       status CONNECTED saat refresh atau Tarik Order.
    */
}

function sellerBooksStartIntegrationRealtime(){
    if(!sellerBooksAuthUser){
        return;
    }

    sellerBooksStopIntegrationRealtime();

    const userId = String(
        sellerBooksAuthUser.id || ""
    );

    if(!userId){
        return;
    }

    sellerBooksIntegrationRealtimeChannel =
        sellerBooksSupabase
            .channel("sellerbooks-integration-" + userId)
            .on(
                "postgres_changes",
                {
                    event:"INSERT",
                    schema:"public",
                    table:"sellerbooks_api_connections",
                    filter:"owner_user_id=eq." + userId
                },
                sellerBooksHandleIntegrationRealtimePayload
            )
            .on(
                "postgres_changes",
                {
                    event:"UPDATE",
                    schema:"public",
                    table:"sellerbooks_api_connections",
                    filter:"owner_user_id=eq." + userId
                },
                sellerBooksHandleIntegrationRealtimePayload
            )
            .on(
                "postgres_changes",
                {
                    event:"DELETE",
                    schema:"public",
                    table:"sellerbooks_api_connections",
                    filter:"owner_user_id=eq." + userId
                },
                function(payload){
                    // DELETE berarti koneksi benar-benar sudah dicopot.
                    // Paksa baca ulang sekarang agar semua browser/WebView
                    // langsung menampilkan tombol "Integrasikan Akun".
                    sellerBooksStoreConnectionsUserId = "";
                    refreshStoreIntegrationStates(true);
                }
            )
            .subscribe(function(status){
                if(
                    status !== "SUBSCRIBED" &&
                    status !== "CHANNEL_ERROR" &&
                    status !== "TIMED_OUT"
                ){
                    return;
                }

                if(status !== "SUBSCRIBED"){
                    console.warn(
                        "Realtime integrasi SellerBooks:",
                        status
                    );
                }
            });
}


/* =====================================================
   RENDER AKUN TOKO
===================================================== */

function sellerBooksRetryStoreConnections(){
    sellerBooksStoreConnectionsLoading=false;
    sellerBooksStoreConnectionsQueued=false;
    sellerBooksStoreConnectionsUserId="";
    const grid=document.getElementById("storesGrid");
    if(grid)delete grid.dataset.integrationWatchdog;
    refreshStoreIntegrationStates(true);
}
