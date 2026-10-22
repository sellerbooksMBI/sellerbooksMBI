/* =====================================================
   SELLERBOOKS DATA BACKUP / RESTORE
   Existing data operations are relocated without changing logic.
   Global functions are required by the Settings inline handlers.
===================================================== */

function backupSellerBooksData(){
    const backup = {
        app:"SellerBooks",
        version:1,
        exportedAt:new Date().toISOString(),
        data:{}
    };

    /*
       Backup seluruh localStorage agar data
       SellerBooks dari file ini ikut tersimpan.
    */
    for(let i=0;i<sellerBooksStorage.length;i++){
        const key =
            sellerBooksStorage.key(i);

        if(!key){
            continue;
        }

        backup.data[key] =
            sellerBooksStorage.getItem(key);
    }

    const blob =
        new Blob(
            [
                JSON.stringify(
                    backup,
                    null,
                    2
                )
            ],
            {
                type:"application/json"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    const date =
        new Date()
            .toISOString()
            .slice(0,10);

    link.href = url;
    link.download =
        "SellerBooks_Backup_" +
        date +
        ".json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function(){
        URL.revokeObjectURL(url);
    },1000);

    sellerBooksAlert(
        sellerBooksSettingsText("backupSuccess"),
        sellerBooksSettingsText("backupSuccessTitle")
    );
}


async function restoreSellerBooksData(input){
    const file =
        input?.files?.[0];

    if(!file){
        return;
    }

    const confirmed =
        await sellerBooksConfirm(
            sellerBooksSettingsText("restoreConfirm")
        );

    if(!confirmed){
        input.value = "";
        return;
    }

    const reader =
        new FileReader();

    reader.onload = function(event){
        try{
            const backup =
                JSON.parse(
                    event.target.result
                );

            if(
                !backup ||
                backup.app !== "SellerBooks" ||
                !backup.data ||
                typeof backup.data !== "object"
            ){
                throw new Error(
                    sellerBooksSettingsText("invalidBackup")
                );
            }

            /*
               Hapus data lokal saat ini.
               File backup berisi pasangan key/value
               sellerBooksStorage.
            */
            sellerBooksStorage.clear();

            Object.keys(
                backup.data
            ).forEach(function(key){
                const value =
                    backup.data[key];

                if(
                    typeof value === "string"
                ){
                    sellerBooksStorage.setItem(
                        key,
                        value
                    );
                }else{
                    sellerBooksStorage.setItem(
                        key,
                        JSON.stringify(value)
                    );
                }
            });

            sellerBooksAlert(
                sellerBooksSettingsText("restoreSuccess")
            );

            location.reload();

        }catch(error){
            console.error(
                "Restore SellerBooks gagal:",
                error
            );

            sellerBooksAlert(
                sellerBooksSettingsText("restoreInvalid")
            );
        }finally{
            input.value = "";
        }
    };

    reader.onerror = function(){
        input.value = "";
        sellerBooksAlert(
            sellerBooksSettingsText("restoreReadFailed")
        );
    };

    reader.readAsText(file);
}
