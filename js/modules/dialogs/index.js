/* =====================================================
   SELLERBOOKS CUSTOM ALERT / CONFIRM
   Tidak menggunakan window.alert/window.confirm
===================================================== */
(function(){
    let sellerBooksDialogQueue = [];
    let sellerBooksDialogBusy = false;

    function sellerBooksShowDialog(message, options){
        options = options || {};
        const overlay = document.getElementById("sellerBooksDialogOverlay");
        const title = document.getElementById("sellerBooksDialogTitle");
        const body = document.getElementById("sellerBooksDialogMessage");
        const ok = document.getElementById("sellerBooksDialogOk");
        const cancel = document.getElementById("sellerBooksDialogCancel");
        const icon = document.getElementById("sellerBooksDialogIcon");

        if(!overlay || !title || !body || !ok || !cancel){
            // Fallback hanya jika elemen custom belum tersedia.
            return Promise.resolve(false);
        }

        return new Promise(function(resolve){
            sellerBooksDialogQueue.push({
                message:String(message ?? ""),
                title:options.title || "SellerBooks",
                confirm:!!options.confirm,
                resolve:resolve
            });
            sellerBooksProcessDialogQueue();
        });
    }

    function sellerBooksProcessDialogQueue(){
        if(sellerBooksDialogBusy || !sellerBooksDialogQueue.length) return;

        sellerBooksDialogBusy = true;

        const item = sellerBooksDialogQueue.shift();
        const overlay = document.getElementById("sellerBooksDialogOverlay");
        const title = document.getElementById("sellerBooksDialogTitle");
        const body = document.getElementById("sellerBooksDialogMessage");
        const ok = document.getElementById("sellerBooksDialogOk");
        const cancel = document.getElementById("sellerBooksDialogCancel");
        const icon = document.getElementById("sellerBooksDialogIcon");

        const dialogLanguage =
            typeof sellerBooksCurrentLanguage === "function"
                ? sellerBooksCurrentLanguage()
                : "id";

        const dialogTranslations = dialogLanguage === "en"
            ? {
                confirmation:"Confirmation",
                cancel:"Cancel",
                continue:"Continue",
                ok:"OK"
            }
            : {
                confirmation:"Konfirmasi",
                cancel:"Batal",
                continue:"Lanjutkan",
                ok:"OK"
            };

        title.textContent =
            item.title ||
            (item.confirm
                ? dialogTranslations.confirmation
                : "SellerBooks");

        body.textContent = item.message;
        icon.textContent = item.confirm ? "?" : "✓";
        cancel.style.display = item.confirm ? "" : "none";
        cancel.textContent = dialogTranslations.cancel;
        ok.textContent = item.confirm
            ? dialogTranslations.continue
            : dialogTranslations.ok;

        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden","false");

        let finished = false;

        function finish(value){
            if(finished) return;
            finished = true;

            overlay.classList.remove("show");
            overlay.setAttribute("aria-hidden","true");

            ok.removeEventListener("click", onOk);
            cancel.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onKey);

            item.resolve(value);
            sellerBooksDialogBusy = false;
            setTimeout(sellerBooksProcessDialogQueue, 0);
        }

        function onOk(){
            finish(true);
        }

        function onCancel(){
            finish(false);
        }

        function onKey(event){
            if(event.key === "Escape"){
                finish(false);
            }else if(event.key === "Enter"){
                finish(true);
            }
        }

        ok.addEventListener("click", onOk);
        cancel.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKey);

        setTimeout(function(){
            (item.confirm ? cancel : ok).focus();
        }, 0);
    }

    window.sellerBooksAlert = function(message, title){
        sellerBooksShowDialog(message, {
            title:title || "SellerBooks",
            confirm:false
        });
    };

    window.sellerBooksConfirm = function(message, title){
        const language =
            typeof sellerBooksCurrentLanguage === "function"
                ? sellerBooksCurrentLanguage()
                : "id";

        return sellerBooksShowDialog(message, {
            title:title || (language === "en" ? "Confirmation" : "Konfirmasi"),
            confirm:true
        });
    };
})();
