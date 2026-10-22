/* =====================================================
   DASHBOARD VIEW PREFERENCES
   Preferensi tampilan Dashboard bukan data bisnis.
   Simpan lokal per akun agar perubahan dropdown tidak
   ikut mengubah sellerBooksCloudState / Supabase.
===================================================== */
let sellerBooksDashboardPreferencesCache = null;
let sellerBooksDashboardPreferencesCacheKey = "";

function sellerBooksDashboardPreferenceKey(){
    const userId = String(sellerBooksAuthUser?.id || "guest");
    return "sellerbooks_dashboard_prefs_" + userId;
}

function sellerBooksReadDashboardPreferences(){
    const cacheKey = sellerBooksDashboardPreferenceKey();

    /* PATCH E: cache preferensi tampilan agar tidak parse localStorage berulang. */
    if(
        sellerBooksDashboardPreferencesCache &&
        sellerBooksDashboardPreferencesCacheKey === cacheKey
    ){
        return {...sellerBooksDashboardPreferencesCache};
    }

    let prefs = {};
    try{
        prefs = JSON.parse(
            window.localStorage.getItem(cacheKey) || "{}"
        ) || {};
    }catch(error){
        prefs = {};
    }

    /* Kompatibilitas satu kali dengan preferensi lama di cloud state. */
    const legacy = function(key){
        if(prefs[key] !== undefined && prefs[key] !== null) return prefs[key];
        return sellerBooksCloudState[key];
    };

    prefs = {
        period: legacy("sellerbooks_dashboard_period") || "today",
        viewDay: legacy("sellerbooks_dashboard_view_day") || "",
        dateFrom: legacy("sellerbooks_dashboard_date_from") || "",
        dateTo: legacy("sellerbooks_dashboard_date_to") || ""
    };

    sellerBooksDashboardPreferencesCacheKey = cacheKey;
    sellerBooksDashboardPreferencesCache = {...prefs};

    return {...prefs};
}

function sellerBooksWriteDashboardPreferences(patch){
    const prefs = sellerBooksReadDashboardPreferences();

    Object.keys(patch || {}).forEach(function(key){
        prefs[key] = patch[key];
    });

    sellerBooksDashboardPreferencesCacheKey =
        sellerBooksDashboardPreferenceKey();

    sellerBooksDashboardPreferencesCache = {...prefs};

    try{
        window.localStorage.setItem(
            sellerBooksDashboardPreferencesCacheKey,
            JSON.stringify(prefs)
        );
    }catch(error){
        console.warn("Preferensi Dashboard lokal gagal disimpan:",error);
    }
}

function sellerBooksGetDashboardPreference(key, fallback){
    const prefs = sellerBooksReadDashboardPreferences();
    return prefs[key] !== undefined && prefs[key] !== null
        ? prefs[key]
        : fallback;
}

/* =====================================================
   INDEPENDENT VIEW PREFERENCES — LAPORAN & RINCIAN
   Preferensi filter tiap kartu disimpan terpisah dari
   sellerBooksCloudState / sellerBooksStorage.
   Jadi perubahan filter satu kartu tidak pernah
   mengubah filter kartu lain atau data bisnis.
===================================================== */
let sellerBooksIndependentViewPreferencesCache = {};

function sellerBooksIndependentViewPreferenceKey(view){
    const userId = String(sellerBooksAuthUser?.id || "guest");
    return "sellerbooks_" + view + "_view_prefs_" + userId;
}

function sellerBooksReadIndependentViewPreferences(view){
    const cacheKey = sellerBooksIndependentViewPreferenceKey(view);

    if(
        sellerBooksIndependentViewPreferencesCache[view] &&
        sellerBooksIndependentViewPreferencesCache[view].key === cacheKey
    ){
        return {
            ...sellerBooksIndependentViewPreferencesCache[view].value
        };
    }

    let prefs = {};
    try{
        prefs = JSON.parse(
            window.localStorage.getItem(cacheKey) || "{}"
        ) || {};
    }catch(error){
        prefs = {};
    }

    sellerBooksIndependentViewPreferencesCache[view] = {
        key: cacheKey,
        value: {...prefs}
    };

    return {...prefs};
}

function sellerBooksWriteIndependentViewPreferences(view, patch){
    const prefs = sellerBooksReadIndependentViewPreferences(view);

    Object.keys(patch || {}).forEach(function(key){
        prefs[key] = patch[key];
    });

    const cacheKey = sellerBooksIndependentViewPreferenceKey(view);

    sellerBooksIndependentViewPreferencesCache[view] = {
        key: cacheKey,
        value: {...prefs}
    };

    try{
        window.localStorage.setItem(
            cacheKey,
            JSON.stringify(prefs)
        );
    }catch(error){
        console.warn(
            "Preferensi tampilan " + view + " lokal gagal disimpan:",
            error
        );
    }
}

function sellerBooksGetIndependentViewPreference(view,key,fallback){
    const prefs = sellerBooksReadIndependentViewPreferences(view);
    return prefs[key] !== undefined && prefs[key] !== null
        ? prefs[key]
        : fallback;
}

