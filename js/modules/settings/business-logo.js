/* =====================================================
   SELLERBOOKS BUSINESS LOGO SETTINGS
   Function bodies are preserved as classic-script globals.
===================================================== */

function renderSettingsLogo(){
    const settings =
        getSellerBooksSettings();

    /*
       Logo bisnis hanya boleh tampil saat ada sesi user.
       Setelah logout, halaman login tetap menggunakan identitas SB.
       Logo upload hanya diterapkan pada sidebar dashboard.
       Data logo di cloud tetap aman.
    */
    const visibleLogo =
        sellerBooksAuthUser
            ? settings.logo
            : "";

    const preview =
        document.getElementById(
            "settingsLogoPreview"
        );

    if(preview){
        if(visibleLogo){
            preview.innerHTML =
                '<img src="' +
                visibleLogo +
                '" alt="Logo Bisnis">';
        }else{
            preview.textContent = "SB";
        }
    }

    applyBusinessLogoToInterface(
        visibleLogo
    );
}


function applyBusinessLogoToInterface(logo){
    const logoTargets =
        document.querySelectorAll(
            ".sidebar-logo"
        );

    logoTargets.forEach(function(target){
        if(logo){
            target.innerHTML =
                '<img src="' +
                logo +
                '" alt="Logo Bisnis" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;">';
        }else{
            target.textContent = "SB";
        }
    });
}


function handleSettingsLogoUpload(input){
    const file =
        input?.files?.[0];

    if(!file){
        return;
    }

    if(file.size > 1024 * 1024){
        sellerBooksAlert(sellerBooksSettingsText("logoTooLarge"));
        input.value = "";
        return;
    }

    if(
        ![
            "image/png",
            "image/jpeg",
            "image/webp"
        ].includes(file.type)
    ){
        sellerBooksAlert(sellerBooksSettingsText("logoFormat"));
        input.value = "";
        return;
    }

    if(!sellerBooksAuthUser || !sellerBooksCloudReady){
        sellerBooksAlert(sellerBooksSettingsText("sessionNotReady"));
        input.value = "";
        return;
    }

    const reader =
        new FileReader();

    reader.onload = function(event){
        try{
            const current =
                getSellerBooksSettings();

            current.logo =
                event.target.result || "";

            current.logoPath = "";

            sellerBooksStorage.setItem(
                SELLERBOOKS_SETTINGS_KEY,
                JSON.stringify(current)
            );

            renderSettingsLogo();
            input.value = "";

            sellerBooksAlert(sellerBooksSettingsText("logoSaved"));
        }catch(error){
            console.error(
                "Gagal menyimpan logo bisnis ke Supabase:",
                error
            );
            input.value = "";
            sellerBooksAlert(
                sellerBooksSettingsText("logoSaveFailed") + "\n\n" + error.message
            );
        }
    };

    reader.onerror = function(){
        input.value = "";
        sellerBooksAlert(sellerBooksSettingsText("logoReadFailed"));
    };

    reader.readAsDataURL(file);
}


async function removeSettingsLogo(){
    const confirmed =
        await sellerBooksConfirm(
            sellerBooksSettingsText("removeLogoConfirm")
        );

    if(!confirmed){
        return;
    }

    try{
        const settings =
            getSellerBooksSettings();

        settings.logo = "";
        settings.logoPath = "";

        sellerBooksStorage.setItem(
            SELLERBOOKS_SETTINGS_KEY,
            JSON.stringify(settings)
        );

        renderSettingsLogo();

        const input =
            document.getElementById(
                "settingsLogoInput"
            );

        if(input){
            input.value = "";
        }
    }catch(error){
        console.error(
            "Gagal menghapus logo bisnis:",
            error
        );
        sellerBooksAlert(
            sellerBooksSettingsText("removeLogoFailed") + "\n\n" +
            error.message
        );
    }
}
