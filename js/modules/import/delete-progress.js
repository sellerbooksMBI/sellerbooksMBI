/* =====================================================
   SELLERBOOKS DELETE PROGRESS
   Existing progress callbacks are relocated unchanged.
   They remain classic-script globals for existing callers.
===================================================== */

function sellerBooksDeleteProgressStart(){
    window.sellerBooksProgressOperation = "delete";
    sellerBooksImportProgressShow();
    sellerBooksImportProgressUpdate(20,"processing");
}

async function sellerBooksDeleteProgressFinish(){
    try{
        sellerBooksImportProgressUpdate(65,"saving");
        if(!sellerBooksAuthUser || !sellerBooksCloudReady || sellerBooksCloudLoading){
            throw new Error("cloud_not_ready");
        }
        if(typeof sellerBooksCloudSaveTimer !== "undefined" && sellerBooksCloudSaveTimer){
            clearTimeout(sellerBooksCloudSaveTimer);
            sellerBooksCloudSaveTimer = null;
        }
        const expectedSnapshot=sellerBooksCloneCloudState(sellerBooksCloudState);
        await sellerBooksPersistCloudDataStrict(expectedSnapshot);
        sellerBooksImportProgressUpdate(92,"verifying");
        if(sellerBooksCloudDirtyKeys && sellerBooksCloudDirtyKeys.size){
            throw new Error("cloud_save_unconfirmed");
        }
        sellerBooksImportProgressUpdate(100,"done");
        await new Promise(function(resolve){setTimeout(resolve,500);});
        sellerBooksImportProgressHide();
        window.sellerBooksProgressOperation = "import";
        return true;
    }catch(error){
        console.error("Penghapusan belum terkonfirmasi di cloud:",error);
        sellerBooksImportProgressFailure(error);
        return false;
    }
}
