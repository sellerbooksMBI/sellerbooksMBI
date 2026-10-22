/* =====================================================
   SELLERBOOKS AUTH / SESSION LIFECYCLE
   Existing function bodies relocated unchanged; shared state and auth listeners remain in main.js.
===================================================== */

async function sellerBooksLoadProfile(user){
    const columns="user_id,email,owner_name,contact_name,status,approved_at,approved_by,created_at,updated_at";
    const {data,error}=await sellerBooksSupabase.from("sellerbooks_profiles").select(columns).eq("user_id",user.id).maybeSingle();
    if(error)throw error;
    if(data)return data;

    /*
       Jika user Auth sudah ada tetapi profile SellerBooks belum terbentuk
       (misalnya akun dibuat sebelum trigger profile dipasang), buat profile
       secara otomatis sebagai PENDING. Status tidak pernah diambil dari client.
    */
    const {error:insertError}=await sellerBooksSupabase.from("sellerbooks_profiles").insert({
    user_id:user.id,
    email:user.email||null,
    owner_name:null,
    contact_name:null,
    status:"pending"
});

    if(insertError && insertError.code!=="23505")throw insertError;

    const {data:profile,error:reloadError}=await sellerBooksSupabase.from("sellerbooks_profiles").select(columns).eq("user_id",user.id).maybeSingle();
    if(reloadError)throw reloadError;
    return profile;
}

async function sellerBooksCheckApproval(showAlert){
    if(!sellerBooksAuthUser)return;
    const approvalUserId=String(sellerBooksAuthUser.id||"");
    if(!approvalUserId)return;

    if(
        sellerBooksApprovalPromise &&
        sellerBooksApprovalPromiseUserId === approvalUserId
    ){
        return sellerBooksApprovalPromise;
    }

    sellerBooksApprovalPromiseUserId=approvalUserId;
    const currentApprovalPromise=sellerBooksCheckApprovalInternal(showAlert);
    sellerBooksApprovalPromise=currentApprovalPromise;

    try{
        return await currentApprovalPromise;
    }finally{
        if(sellerBooksApprovalPromise === currentApprovalPromise){
            sellerBooksApprovalPromise=null;
            sellerBooksApprovalPromiseUserId="";
        }
    }
}

async function sellerBooksCheckApprovalInternal(showAlert){
    if(!sellerBooksAuthUser)return;
    try{
        const {data:coreAdmin,error:coreCheckError}=await sellerBooksSupabase.rpc("sellerbooks_is_core_admin");
        if(coreCheckError)throw coreCheckError;
        if(coreAdmin===true){
            sellerBooksProfile=null;
            sellerBooksShowApproval("Akun ini adalah akun Core. Silakan gunakan akun client SellerBooks untuk masuk.");
            return;
        }
        sellerBooksProfile=await sellerBooksLoadProfile(sellerBooksAuthUser);
        if(!sellerBooksProfile){ sellerBooksShowApproval(sellerBooksAccessText("profileMissing")); return; }
        const status=String(sellerBooksProfile.status||"pending").toLowerCase();
        if(status==="approved"){
            if(sellerBooksApprovalTimer){clearInterval(sellerBooksApprovalTimer);sellerBooksApprovalTimer=null;}

            /*
               Setelah akun disetujui Core Adiimasa:
               - Jika Nama Pemilik sudah tersimpan di profile akun ini -> masuk Dashboard.
               - Jika belum ada -> tampilkan tingkat 2 untuk membuat Nama Pemilik.
               - localStorage TIDAK dipakai untuk menentukan apakah setup sudah selesai,
                 agar identitas antar akun Google tidak tercampur.
            */
            await sellerBooksLoadCloudData();
            sellerBooksRefreshRuntimeFromCloud();

            /*
               Filter Report tetap disiapkan setelah cloud siap,
               tetapi jangan langsung render Report di sini.
               sellerBooksRefreshActiveView() menjadi satu-satunya
               render awal untuk view yang sedang aktif.
            */
            if(typeof initializeReports==="function"){
                initializeReports(false);
            }

            sellerBooksOpenApplication();
            sellerBooksRefreshActiveView();
            return;
        }
        if(status==="rejected"){sellerBooksShowApproval(sellerBooksAccessText("rejected"));return;}
        if(status==="suspended"){sellerBooksShowApproval(sellerBooksAccessText("suspended"));return;}
        sellerBooksShowApproval(sellerBooksAccessText("pending"));
        if(showAlert)sellerBooksAlert(sellerBooksAccessText("approvalPending"));
    }catch(error){console.error(error);sellerBooksShowApproval(sellerBooksAccessText("readError"));}
}

function sellerBooksOpenApplication(){
    const ownerName = String(sellerBooksProfile?.owner_name || "").trim();

    /*
       Penentu utama identitas adalah profile SellerBooks milik user Google
       yang sedang login, bukan sellerBooksStorage.
    */
    if(ownerName){
        sellerBooksStorage.setItem("sellerbooks_owner_name",ownerName);
        sellerBooksShowOnly("app");
    }else{
        sellerBooksStorage.removeItem("sellerbooks_owner_name");
        sellerBooksShowOnly("ownerSetupPage");
        if(typeof sellerBooksApplyOwnerSetupLanguage==="function"){
            sellerBooksApplyOwnerSetupLanguage();
        }

        const input=document.getElementById("ownerNameInput");
        if(input){
            input.value="";
            setTimeout(function(){input.focus();},50);
        }
    }

    if(typeof updateSidebarOwner==="function")updateSidebarOwner();
}

async function loginGoogle(){
    try{

        /*
           WINDOWS SELLERBOOKS OPERATOR/ADMIN:
           Login Google harus tetap berlangsung di WebView yang sama.
           Jangan biarkan client OAuth menyerahkan navigasi ke browser
           eksternal, karena verifier PKCE tersimpan pada storage WebView.
        */
        const isSellerBooksWindowsApp =
            /SellerBooks(Admin|Operator)\/1\.0/i.test(
                navigator.userAgent.replace(/\s+/g,"")
            );

        if(isSellerBooksWindowsApp){
            const {data,error}=await sellerBooksSupabase.auth.signInWithOAuth({
                provider:"google",

                options:{
                    redirectTo:"https://sellerbooksmbi.github.io/",
                    skipBrowserRedirect:true,
                    queryParams:{
                        prompt:"select_account"
                    }
                }
            });

            if(error){
                console.error("Google Login gagal:",error);
                sellerBooksAlert("❌ Login Google gagal.\n\n"+error.message);
                return;
            }

            if(data && data.url){
                /*
                   Navigasi langsung pada WebView aktif.
                   Dengan cara ini PKCE verifier dibuat dan callback
                   kembali ke storage WebView yang sama.
                */
                window.location.assign(data.url);
            }

            return;
        }

        const {error}=await sellerBooksSupabase.auth.signInWithOAuth({
            provider:"google",

            options:{
                redirectTo:"https://sellerbooksmbi.github.io/",

                queryParams:{
                    prompt:"select_account"
                }
            }
        });

        if(error){
            console.error("Google Login gagal:",error);
            sellerBooksAlert("❌ Login Google gagal.\n\n"+error.message);
        }

    }catch(error){

        console.error(error);

        sellerBooksAlert(
            "❌ Terjadi kesalahan saat menghubungkan Login Google."
        );

    }
}

async function sellerBooksHandleAuthSession(){

    try{

        const {
            data,
            error
        } =
            await sellerBooksSupabase
                .auth                .getSession();

        if(error){
            throw error;
        }

        /*
           TIDAK ADA SESI SUPABASE
           = WAJIB LOGIN ULANG
        */
        if(!data?.session?.user){

            sellerBooksAuthUser = null;
            sellerBooksProfile = null;
            sellerBooksLoginLanguageOverrideActive = false;

            if(sellerBooksApprovalTimer){
                clearInterval(
                    sellerBooksApprovalTimer
                );

                sellerBooksApprovalTimer = null;
            }

            sellerBooksShowOnly(
                "loginPage"
            );

            return;
        }

        /*
           SESI MASIH VALID
           = LANJUTKAN LOGIN NORMAL
        */
        sellerBooksAuthUser =
            data.session.user;

        const warmedFromCache =
            await sellerBooksWarmStartFromCache(
                data.session.user
            );

        if(warmedFromCache){
            sellerBooksCheckApproval(false).catch(function(error){
                console.error("Verifikasi sesi SellerBooks gagal:",error);
            });
        }else{
            await sellerBooksCheckApproval(false);
        }

        /*
           TIMER APPROVAL
        */
        if(
            sellerBooksProfile &&
            String(
                sellerBooksProfile.status
            ).toLowerCase() === "pending" &&
            !sellerBooksApprovalTimer
        ){

            sellerBooksApprovalTimer =
                setInterval(
                    function(){

                        sellerBooksCheckApproval(
                            false
                        );

                    },
                    30000
                );
        }

    }catch(error){

        console.error(
            "Inisialisasi SellerBooks Auth gagal:",
            error
        );

        sellerBooksAuthUser = null;
        sellerBooksProfile = null;

        if(sellerBooksApprovalTimer){

            clearInterval(
                sellerBooksApprovalTimer
            );

            sellerBooksApprovalTimer = null;
        }

        sellerBooksShowOnly(
            "loginPage"
        );
    }
}

function sellerBooksRefreshActiveView(){
    const activeView=document.querySelector(".view.active");
    const viewId=activeView ? activeView.id : "dashboard";
    try{
        if(viewId==="dashboard" && typeof updateDashboardByPeriod==="function")updateDashboardByPeriod();
        else if(viewId==="marketplace" && typeof renderMarketplaces==="function")renderMarketplaces();
        else if(viewId==="stores" && typeof renderStores==="function")renderStores();
        else if(viewId==="products" && typeof renderProducts==="function")renderProducts();
        else if(viewId==="costs" && typeof renderCosts==="function")renderCosts();
        else if(viewId==="productAnalysis" && typeof renderProductAnalysis==="function")renderProductAnalysis();
        else if(viewId==="reports" && typeof updateReports==="function")updateReports();
        else if(viewId==="settings" && typeof loadSellerBooksSettings==="function")loadSellerBooksSettings();
        if(typeof renderNotifications==="function")renderNotifications();
    }catch(error){console.error("Refresh view SellerBooks gagal:",error);}
}

function sellerBooksRefreshAllViewsFromCloud(){
    if(typeof sellerBooksRefreshRuntimeFromCloud==="function")sellerBooksRefreshRuntimeFromCloud();
    sellerBooksRefreshActiveView();
}

function sellerBooksStopDataRealtime(){
    if(sellerBooksDataRealtimeChannel){
        sellerBooksSupabase.removeChannel(sellerBooksDataRealtimeChannel);
        sellerBooksDataRealtimeChannel=null;
    }
}

function sellerBooksStartDataRealtime(){
    if(!sellerBooksAuthUser)return;

    sellerBooksStopDataRealtime();
    const userId=sellerBooksAuthUser.id;

    sellerBooksDataRealtimeChannel=sellerBooksSupabase
        .channel("sellerbooks-data-"+userId)
        .on("postgres_changes",{
            event:"INSERT",
            schema:"public",
            table:"sellerbooks_user_data",
            filter:"user_id=eq."+userId
        },function(payload){
            sellerBooksApplyRealtimeCloudData(payload?.new?.data,payload?.new?.updated_at);
        })
        .on("postgres_changes",{
            event:"UPDATE",
            schema:"public",
            table:"sellerbooks_user_data",
            filter:"user_id=eq."+userId
        },function(payload){
            sellerBooksApplyRealtimeCloudData(payload?.new?.data,payload?.new?.updated_at);
        })
        .on("postgres_changes",{
            event:"DELETE",
            schema:"public",
            table:"sellerbooks_user_data"
        },function(payload){
            const deletedUserId=String(payload?.old?.user_id||"");
            if(deletedUserId===String(userId)){
                sellerBooksCloudState={};
                sellerBooksCloudReady=true;
                sellerBooksRefreshAllViewsFromCloud();
            }
        })
        .subscribe(function(status){
            if(status!=="SUBSCRIBED" && status!=="CHANNEL_ERROR" && status!=="TIMED_OUT")return;
            if(status!=="SUBSCRIBED")console.warn("Realtime data SellerBooks:",status);
        });
}

function sellerBooksApplyRealtimeCloudData(data,updatedAt){
    if(sellerBooksDataRealtimeApplying)return;
    if(!data||typeof data!=="object")return;

    sellerBooksDataRealtimeApplying=true;
    try{
        const incoming=sellerBooksCloneCloudState(data);
        const current=sellerBooksCloneCloudState(sellerBooksCloudState);

        sellerBooksCloudDirtyKeys.forEach(function(key){
            if(key==="sellerbooks_sales_imports"){
                try{
                    const merged=sellerBooksMergeSalesImportsForConflict(
                        sellerBooksCloudBaseState[key],current[key],incoming[key]
                    );
                    incoming[key]=merged.conflict?current[key]:merged.value;
                }catch(error){
                    incoming[key]=current[key];
                }
            }else if(current[key]!==undefined){
                incoming[key]=current[key];
            }else{
                delete incoming[key];
            }
        });

        sellerBooksCloudState=incoming;
        if(updatedAt){
            sellerBooksCloudUpdatedAt=updatedAt;
        }

        const incomingKeys=new Set(Object.keys(incoming));
        Object.keys(sellerBooksCloudBaseState).forEach(function(key){
            if(!sellerBooksCloudDirtyKeys.has(key) && !incomingKeys.has(key)){
                delete sellerBooksCloudBaseState[key];
            }
        });
        Object.keys(incoming).forEach(function(key){
            if(!sellerBooksCloudDirtyKeys.has(key)){
                sellerBooksCloudBaseState[key]=incoming[key];
            }
        });

        sellerBooksCloudReady=true;
        sellerBooksSaveFastCache();
        sellerBooksRefreshAllViewsFromCloud();
    }catch(error){
        console.error("Refresh realtime data SellerBooks gagal:",error);
    }finally{
        sellerBooksDataRealtimeApplying=false;
    }
}

function sellerBooksStopAccountRealtime(){
    if(sellerBooksAccountRealtimeChannel){
        sellerBooksSupabase.removeChannel(sellerBooksAccountRealtimeChannel);
        sellerBooksAccountRealtimeChannel=null;
    }
}

function sellerBooksHandleRealtimeAccountAction(status){
    if(sellerBooksAccountRealtimeHandling)return;
    sellerBooksAccountRealtimeHandling=true;

    const normalized=String(status||"").toLowerCase();
    let message=sellerBooksAccessText("unavailable");

    if(normalized==="suspended"){
        message=sellerBooksAccessText("suspended");
    }else if(normalized==="rejected"){
        message=sellerBooksAccessText("rejected");
    }else if(normalized==="pending"){
        message=sellerBooksAccessText("inactive");
    }else if(normalized==="deleted"){
        message=sellerBooksAccessText("deleted");
    }

    sellerBooksStopAccountRealtime();
    sellerBooksStopDataRealtime();
    sellerBooksStopAccountPolling();
    if(sellerBooksApprovalTimer){clearInterval(sellerBooksApprovalTimer);sellerBooksApprovalTimer=null;}

    sellerBooksSupabase.auth.signOut().catch(function(error){
        console.error("Realtime logout gagal:",error);
    }).finally(function(){
        sellerBooksAuthUser=null;
        sellerBooksProfile=null;
        sellerBooksStorage.removeItem("sellerbooks_owner_name");
        sellerBooksShowOnly("loginPage");
        sellerBooksApplyLoginLanguage();
        sellerBooksAlert(sellerBooksAccessText("changed")+"\n\n"+message);
        sellerBooksAccountRealtimeHandling=false;
    });
}

function sellerBooksStartAccountRealtime(){
    if(!sellerBooksAuthUser)return;

    sellerBooksStopAccountRealtime();
    const userId=sellerBooksAuthUser.id;

    sellerBooksAccountRealtimeChannel=sellerBooksSupabase
        .channel("sellerbooks-account-"+userId)
        .on("postgres_changes",{
            event:"UPDATE",
            schema:"public",
            table:"sellerbooks_profiles",
            filter:"user_id=eq."+userId
        },function(payload){
            const status=String(payload?.new?.status||"").toLowerCase();
            if(status!=="approved"){
                sellerBooksHandleRealtimeAccountAction(status);
            }
        })
        .on("postgres_changes",{
            event:"DELETE",
            schema:"public",
            table:"sellerbooks_profiles"
        },function(payload){
            const deletedUserId=String(payload?.old?.user_id||"");
            if(deletedUserId===String(userId)){
                sellerBooksHandleRealtimeAccountAction("deleted");
            }
        })
        .subscribe(function(status){
            if(status!=="SUBSCRIBED" && status!=="CHANNEL_ERROR" && status!=="TIMED_OUT"){
                return;
            }
            if(status!=="SUBSCRIBED"){
                console.warn("Realtime status akun:",status);
            }
        });
}

function sellerBooksStartAccountPolling(){
    if(!/SellerBooksAPK\/1\.0/i.test(navigator.userAgent||""))return;
    if(sellerBooksAccountPollingTimer)clearInterval(sellerBooksAccountPollingTimer);

    const check=function(){
        if(sellerBooksAccountPollingBusy || !sellerBooksAuthUser || sellerBooksAccountRealtimeHandling)return;
        sellerBooksAccountPollingBusy=true;

        sellerBooksSupabase
            .from("sellerbooks_profiles")
            .select("status")
            .eq("user_id",sellerBooksAuthUser.id)
            .maybeSingle()
            .then(function(result){
                if(result.error){
                    console.warn("Pengecekan status akun APK gagal:",result.error);
                    return;
                }

                if(!result.data){
                    sellerBooksHandleRealtimeAccountAction("deleted");
                    return;
                }

                const status=String(result.data.status||"").toLowerCase();
                if(status!=="approved")sellerBooksHandleRealtimeAccountAction(status);
            })
            .catch(function(error){
                console.warn("Pengecekan status akun APK gagal:",error);
            })
            .finally(function(){
                sellerBooksAccountPollingBusy=false;
            });
    };

    check();
    sellerBooksAccountPollingTimer=setInterval(check,3000);
}

function sellerBooksStopAccountPolling(){
    if(sellerBooksAccountPollingTimer){
        clearInterval(sellerBooksAccountPollingTimer);
        sellerBooksAccountPollingTimer=null;
    }
}

async function sellerBooksLogout(){
    sellerBooksLoginLanguageOverrideActive = false;
    try{
        window.sessionStorage.removeItem(SELLERBOOKS_SESSION_LANGUAGE_KEY);
    }catch(error){}
    try{await sellerBooksSupabase.auth.signOut();}catch(error){console.error("Logout gagal:",error);}
    if(sellerBooksApprovalTimer){clearInterval(sellerBooksApprovalTimer);sellerBooksApprovalTimer=null;}
    sellerBooksStorage.removeItem("sellerbooks_owner_name");
    applyBusinessLogoToInterface("");
    sellerBooksShowOnly("loginPage");
        sellerBooksApplyLoginLanguage();
}
