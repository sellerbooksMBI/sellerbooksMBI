/* =====================================================
   SELLERBOOKS OWNER PROFILE MANAGEMENT
   Existing profile save/reset functions relocated unchanged.
===================================================== */

async function saveOwnerName(){
    const input=document.getElementById("ownerNameInput");
    const ownerName=input.value.trim();
    if(!ownerName){sellerBooksAlert(sellerBooksOwnerSetupText("nameRequired"),sellerBooksOwnerSetupText("title"));input.focus();return;}
    if(!sellerBooksAuthUser){sellerBooksAlert(sellerBooksOwnerSetupText("session"),sellerBooksOwnerSetupText("title"));sellerBooksShowOnly("loginPage");
        sellerBooksApplyLoginLanguage();return;}
    try{
        const {error}=await sellerBooksSupabase.from("sellerbooks_profiles").update({owner_name:ownerName,contact_name:ownerName,updated_at:new Date().toISOString()}).eq("user_id",sellerBooksAuthUser.id);
        if(error)throw error;
        sellerBooksProfile=await sellerBooksLoadProfile(sellerBooksAuthUser);
        sellerBooksStorage.setItem("sellerbooks_owner_name",ownerName);
        updateSidebarOwner();
        document.getElementById("ownerSetupPage").style.display="none";
        document.getElementById("loginPage").style.display="none";
        document.getElementById("app").style.display="block";
        sellerBooksAlert(sellerBooksOwnerSetupText("success")+ownerName,sellerBooksOwnerSetupText("title"));
    }catch(error){console.error("Gagal menyimpan Nama Pemilik:",error);sellerBooksAlert(sellerBooksOwnerSetupText("failed")+"\n\n"+error.message,sellerBooksOwnerSetupText("title"));}
}

async function resetIdentity(){
    /* =========================================
       PENGAMAN RESET IDENTITAS
       HANYA BOLEH DARI KOMPUTER
    ========================================= */

    const mobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
        .test(navigator.userAgent);

    if(mobileDevice){

        sellerBooksAlert(
            sellerBooksResetIdentityText("mobile"),
            sellerBooksResetIdentityText("failedTitle")
        );

        return;
    }
    const confirmReset = await sellerBooksConfirm(
        sellerBooksResetIdentityText("confirm"),
        sellerBooksResetIdentityText("confirmTitle")
    );

    if(!confirmReset){
        return;
    }

    /*
       PASTIKAN USER MASIH LOGIN
    */
    if(!sellerBooksAuthUser){

        sellerBooksAlert(
            sellerBooksResetIdentityText("session"),
            sellerBooksResetIdentityText("sessionTitle")
        );

        sellerBooksShowOnly(
            "loginPage"
        );

        return;
    }

    try{

        /*
           RESET HANYA IDENTITAS PEMILIK.
           TIDAK LOGOUT GOOGLE.
           TIDAK MENGUBAH STATUS APPROVAL.
        */
        const {
            error
        } =
            await sellerBooksSupabase
                .from("sellerbooks_profiles")
                .update({
                    owner_name:null,
                    contact_name:null,
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "user_id",
                    sellerBooksAuthUser.id
                );

        if(error){
            throw error;
        }

        /*
           AMBIL PROFILE TERBARU
        */
        sellerBooksProfile =
            await sellerBooksLoadProfile(
                sellerBooksAuthUser
            );

        /*
           HAPUS IDENTITAS LOKAL
        */
        sellerBooksStorage.removeItem(
            "sellerbooks_owner_name"
        );

        /*
           PAKSA MASUK KE LEVEL 2
           TANPA LOGOUT GOOGLE
        */
        sellerBooksShowOnly(
            "ownerSetupPage"
        );

        if(typeof sellerBooksApplyOwnerSetupLanguage==="function"){
            sellerBooksApplyOwnerSetupLanguage();
        }

        /*
           KOSONGKAN INPUT NAMA
        */
        const input =
            document.getElementById(
                "ownerNameInput"
            );

        if(input){

            input.value = "";

            setTimeout(
                function(){

                    input.focus();

                },
                100
            );
        }

        /*
           UPDATE SIDEBAR JIKA ADA
        */
        if(
            typeof updateSidebarOwner ===
            "function"
        ){

            updateSidebarOwner();
        }

        sellerBooksAlert(
            sellerBooksResetIdentityText("success"),
            sellerBooksResetIdentityText("successTitle")
        );

    }catch(error){

        console.error(
            "Gagal mereset Nama Pemilik:",
            error
        );

        sellerBooksAlert(
            sellerBooksResetIdentityText("failed") + "\n\n" + error.message,
            sellerBooksResetIdentityText("failedTitle")
        );
    }
}
