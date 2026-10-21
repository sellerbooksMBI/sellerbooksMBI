
(function(){

    const SELLERBOOKS_ANALYTICS_CLIENT = "SELLERBOOKS";
    const SELLERBOOKS_ANALYTICS_MODULE = "SELLERBOOKS";

    /*
       WebView Android bawaan APK SellerBooks biasanya membawa
       marker "; wv)" pada User-Agent.
       Website biasa tidak membawa marker tersebut.
    */
    function isSellerBooksAPK(){
        const ua = String(navigator.userAgent || "");

        return (
            /;\s*wv\)/i.test(ua) ||
            (
                /Android/i.test(ua) &&
                /Version\/4\.0/i.test(ua) &&
                /Chrome\//i.test(ua) &&
                !/CriOS/i.test(ua)
            )
        );
    }

    function detectDeviceType(){
        if(isSellerBooksAPK()){
            return "apk";
        }

        const ua = String(navigator.userAgent || "");

        if(/Android|iPhone|iPad|iPod|Mobile/i.test(ua)){
            return "mobile_web";
        }

        return "desktop_web";
    }

    function detectOperatingSystem(){
        const ua = String(navigator.userAgent || "");

        if(/Windows NT/i.test(ua)) return "Windows";
        if(/Mac OS X/i.test(ua)) return "macOS";
        if(/Android/i.test(ua)) return "Android";
        if(/iPhone|iPad|iPod/i.test(ua)) return "iOS";
        if(/Linux/i.test(ua)) return "Linux";

        return "Unknown";
    }

    function detectBrowser(){
        const ua = String(navigator.userAgent || "");

        if(/Edg\//i.test(ua)) return "Edge";
        if(/OPR\//i.test(ua)) return "Opera";
        if(/SamsungBrowser/i.test(ua)) return "Samsung Internet";
        if(/Firefox\//i.test(ua)) return "Firefox";
        if(/CriOS\//i.test(ua)) return "Chrome iOS";
        if(/Chrome\//i.test(ua)) return "Chrome";
        if(/Safari\//i.test(ua) && !/Chrome|CriOS/i.test(ua)) return "Safari";

        return "Unknown";
    }

    function getOrCreateId(storageKey, prefix){
        try{
            let value = localStorage.getItem(storageKey);

            if(!value){
                value =
                    prefix +
                    "_" +
                    Date.now().toString(36) +
                    "_" +
                    Math.random().toString(36).slice(2,12);

                localStorage.setItem(storageKey, value);
            }

            return value;

        }catch(error){
            return (
                prefix +
                "_" +
                Date.now().toString(36) +
                "_" +
                Math.random().toString(36).slice(2,12)
            );
        }
    }

    function getAnalyticsSessionId(){
        const key = "sellerbooks_analytics_session";
        const timeKey = "sellerbooks_analytics_session_time";
        const now = Date.now();

        try{
            let sessionId = localStorage.getItem(key);
            const lastTime = Number(localStorage.getItem(timeKey) || 0);

            /*
               Sesi baru setelah 30 menit tidak aktif.
            */
            if(
                !sessionId ||
                !lastTime ||
                (now - lastTime) > (30 * 60 * 1000)
            ){
                sessionId =
                    "sess_" +
                    now.toString(36) +
                    "_" +
                    Math.random().toString(36).slice(2,12);

                localStorage.setItem(key, sessionId);
            }

            localStorage.setItem(timeKey, String(now));

            return sessionId;

        }catch(error){
            return (
                "sess_" +
                now.toString(36) +
                "_" +
                Math.random().toString(36).slice(2,12)
            );
        }
    }

    function getReferrerDomain(){
        try{
            if(!document.referrer){
                return null;
            }

            return new URL(document.referrer).hostname || null;

        }catch(error){
            return null;
        }
    }

    async function trackSellerBooksAnalytics(){

        /*
           Pastikan client Supabase sudah tersedia.
        */
        if(
            typeof sellerBooksSupabase === "undefined" ||
            !sellerBooksSupabase
        ){
            return;
        }

        const visitorId =
            getOrCreateId(
                "sellerbooks_analytics_visitor",
                "visitor"
            );

        const sessionId =
            getAnalyticsSessionId();

        const deviceType =
            detectDeviceType();

        const payload = {
            p_visitor_id: visitorId,
            p_session_id: sessionId,

            p_client_name:
                SELLERBOOKS_ANALYTICS_CLIENT,

            p_module_slug:
                SELLERBOOKS_ANALYTICS_MODULE,

            p_page_path:
                location.pathname || "/",

            p_page_title:
                document.title || "SellerBooks",

            p_page_url:
                location.href,

            p_device_type:
                deviceType,

            p_operating_system:
                detectOperatingSystem(),

            p_browser:
                detectBrowser(),

            p_screen_width:
                Number(window.screen?.width) || null,

            p_screen_height:
                Number(window.screen?.height) || null,

            p_timezone:
                Intl.DateTimeFormat().resolvedOptions().timeZone || null,

            p_language:
                navigator.language || null,

            p_referrer:
                document.referrer || null,

            p_referrer_domain:
                getReferrerDomain()
        };

        try{

            const { error } =
                await sellerBooksSupabase
                    .rpc(
                        "track_platform_analytics",
                        payload
                    );

            if(error){
                console.warn(
                    "SellerBooks Analytics gagal:",
                    error
                );

                return;
            }

            console.log(
                "SellerBooks Analytics:",
                deviceType === "apk"
                    ? "APK"
                    : "Website"
            );

        }catch(error){

            /*
               Analytics tidak boleh mengganggu
               fungsi utama SellerBooks.
            */
            console.warn(
                "SellerBooks Analytics exception:",
                error
            );
        }
    }

    /*
       Jalankan satu kali untuk setiap pembukaan/reload
       halaman SellerBooks.
    */
    document.addEventListener(
        "DOMContentLoaded",
        function(){

            setTimeout(
                function(){
                    trackSellerBooksAnalytics();
                },
                800
            );

        }
    );

})();
