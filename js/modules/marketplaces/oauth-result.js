/* =====================================================
   SELLERBOOKS MARKETPLACE OAUTH RESULT HANDLER
   Existing Shopee OAuth callback handler relocated unchanged.
===================================================== */

function handleShopeeOAuthResult(){

    const params = new URLSearchParams(window.location.search);

    const result = params.get("sellerbooks_shopee_oauth");

    if(!result) return;

    if(result === "success"){

        sellerBooksIntegrationRealtimeSuppressMarketplace("shopee");

        sellerBooksAlert(
            "Akun Shopee berhasil terhubung ke SellerBooks.",
            "Integrasikan Akun"
        );

        try{

            window.history.replaceState(
                {},
                document.title,
                window.location.pathname + window.location.hash
            );

        }catch(e){}

        if(typeof loadStores === "function"){

            setTimeout(function(){

                loadStores();

            },300);

        }else if(typeof renderStores === "function"){

            setTimeout(function(){

                renderStores();

            },300);

        }

        return;

    }

    const reason = params.get("reason") || "OAUTH_FAILED";

    sellerBooksAlert(
        "Integrasi Shopee gagal.\n\n" +
        "Kode: " + reason,
        "Integrasikan Akun"
    );

    try{

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.hash
        );

    }catch(e){}

}
