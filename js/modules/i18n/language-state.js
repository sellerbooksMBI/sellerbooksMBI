/* =====================================================
   SELLERBOOKS LANGUAGE FOUNDATION
   Bahasa disimpan di state akun SellerBooks yang tersimpan
   di Supabase (sellerbooks_user_data), bukan hanya browser.
   Default akun baru: Bahasa Indonesia.
===================================================== */

const SELLERBOOKS_LANGUAGE_KEY = "sellerbooks_language";
const SELLERBOOKS_DEFAULT_LANGUAGE = "id";
let sellerBooksGlobalLanguage = SELLERBOOKS_DEFAULT_LANGUAGE;
let sellerBooksGlobalLanguageReady = false;

/*
   Session language lock.
   Setelah user memilih bahasa di Login, pilihan tersebut tidak boleh
   ditimpa oleh approval check, warm cache, cloud reload, atau auth event
   yang berjalan ulang beberapa detik kemudian.
*/
let sellerBooksLoginLanguageOverrideActive = false;

async function sellerBooksLoadGlobalLanguage(){
    /*
       Jangan pernah membaca Supabase untuk menimpa pilihan Login yang
       sedang dikunci pada sesi ini. Ini penting karena ada beberapa
       approval/auth/cloud callback yang dapat berjalan berurutan.
    */
    try{
        const sessionLanguage =
            window.sessionStorage.getItem(
                SELLERBOOKS_SESSION_LANGUAGE_KEY
            );

        if(sessionLanguage){
            sellerBooksLoginLanguageOverrideActive = true;
            sellerBooksGlobalLanguage =
                sellerBooksNormalizeLanguage(sessionLanguage);
            sellerBooksGlobalLanguageReady = true;
            return sellerBooksGlobalLanguage;
        }

        /*
           OAuth dapat kembali melalui browsing context yang tidak membawa
           sessionStorage. Karena itu pilihan Login yang belum dikonsumsi
           harus tetap diprioritaskan dari localStorage.
        */
        const loginTouched =
            window.localStorage.getItem(
                SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY
            ) === "1";
        const loginLanguage =
            window.localStorage.getItem(
                SELLERBOOKS_LOGIN_LANGUAGE_KEY
            );

        if(loginTouched && loginLanguage){
            sellerBooksLoginLanguageOverrideActive = true;
            sellerBooksGlobalLanguage =
                sellerBooksNormalizeLanguage(loginLanguage);
            sellerBooksGlobalLanguageReady = true;
            return sellerBooksGlobalLanguage;
        }
    }catch(error){}

    if(sellerBooksLoginLanguageOverrideActive){
        sellerBooksGlobalLanguageReady = true;
        return sellerBooksGlobalLanguage;
    }

    try{
        const {data,error}=await sellerBooksSupabase
            .from("sellerbooks_language_settings")
            .select("language")
            .eq("id",1)
            .maybeSingle();
        if(error) throw error;
        sellerBooksGlobalLanguage = sellerBooksNormalizeLanguage(
            data?.language || SELLERBOOKS_DEFAULT_LANGUAGE
        );
        sellerBooksGlobalLanguageReady = true;
        return sellerBooksGlobalLanguage;
    }catch(error){
        console.warn("Bahasa global SellerBooks gagal dimuat:",error);
        sellerBooksGlobalLanguageReady = false;
        return sellerBooksGlobalLanguage;
    }
}

async function sellerBooksSaveGlobalLanguage(value){
    const language=sellerBooksNormalizeLanguage(value);

    /*
       PERSISTENCE LANGUAGE SAJA.
       Setelah UPDATE, baca kembali row yang sama untuk memastikan nilai
       benar-benar tersimpan di Supabase. Jangan menganggap UPDATE berhasil
       hanya karena tidak mengembalikan error.
    */
    const {error:updateError}=await sellerBooksSupabase
        .from("sellerbooks_language_settings")
        .update({
            language:language,
            updated_at:new Date().toISOString()
        })
        .eq("id",1);

    if(updateError) throw updateError;

    const {data:verifyData,error:verifyError}=await sellerBooksSupabase
        .from("sellerbooks_language_settings")
        .select("language")
        .eq("id",1)
        .maybeSingle();

    if(verifyError) throw verifyError;

    const savedLanguage=sellerBooksNormalizeLanguage(
        verifyData?.language || ""
    );

    if(!verifyData || savedLanguage !== language){
        throw new Error(
            "Bahasa SellerBooks belum terkonfirmasi tersimpan di Supabase."
        );
    }

    sellerBooksGlobalLanguage=language;
    sellerBooksGlobalLanguageReady=true;
    return sellerBooksGlobalLanguage;
}

 /*
    LANGUAGE SELECTION
    - Login menyediakan pilihan ID / EN sebelum autentikasi.
    - Pilihan pra-login hanya menjadi preferensi sementara.
    - Setelah akun berhasil dimuat, bahasa akun di Supabase tetap menjadi sumber utama.
    - Untuk akun yang belum memiliki bahasa, pilihan pra-login akan menjadi bahasa akun
      dan kemudian disimpan ke sellerbooks_user_data.
 */
const SELLERBOOKS_LOGIN_LANGUAGE_KEY = "sb_login_language";
const SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY = "sb_login_language_touched";
const SELLERBOOKS_SESSION_LANGUAGE_KEY = "sb_session_language";

function sellerBooksNormalizeLanguage(value){
    return String(value || "").toLowerCase() === "en" ? "en" : "id";
}

function sellerBooksGetLoginLanguagePreference(){
    try{
        return sellerBooksNormalizeLanguage(
            window.localStorage.getItem(SELLERBOOKS_LOGIN_LANGUAGE_KEY) ||
            SELLERBOOKS_DEFAULT_LANGUAGE
        );
    }catch(error){
        return SELLERBOOKS_DEFAULT_LANGUAGE;
    }
}

function sellerBooksSetLoginLanguage(value){
    const language = sellerBooksNormalizeLanguage(value);

    /*
       Dropdown Login = pengganti langsung dropdown Bahasa di Pengaturan.
       Sebelum autentikasi, pilihan hanya ditahan sementara di localStorage
       karena user belum mempunyai sesi untuk menulis ke Supabase.
       Setelah login, sellerBooksEnsureDefaultLanguage() menyimpannya ke
       sellerbooks_language_settings.
    */
    try{
        window.localStorage.setItem(
            SELLERBOOKS_LOGIN_LANGUAGE_KEY,
            language
        );
        window.localStorage.setItem(
            SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY,
            "1"
        );
        /*
           sessionStorage menjadi sumber paling kuat selama tab/session ini.
           Ini bertahan melewati redirect Google dan mencegah callback lain
           mengembalikan bahasa ke default ID.
        */
        window.sessionStorage.setItem(
            SELLERBOOKS_SESSION_LANGUAGE_KEY,
            language
        );
    }catch(error){}

    /*
       Kunci pilihan user untuk seluruh proses login/session.
       Callback lain tidak boleh menggantinya kembali ke ID.
    */
    sellerBooksLoginLanguageOverrideActive = true;
    sellerBooksGlobalLanguage = language;
    sellerBooksGlobalLanguageReady = true;

    /*
       Terapkan engine bahasa lama secara penuh, bukan hanya halaman Login.
    */
    sellerBooksApplyAllLanguage();

    return language;
}

function sellerBooksCurrentLanguage(){
    try{
        /*
           Urutan sumber bahasa:
           1. sessionStorage pilihan Login (paling kuat selama sesi)
           2. runtime global language
           3. preferensi Login sementara
           4. default ID
        */
        const sessionLanguage =
            window.sessionStorage.getItem(
                SELLERBOOKS_SESSION_LANGUAGE_KEY
            );

        if(sessionLanguage){
            return sellerBooksNormalizeLanguage(sessionLanguage);
        }

        /*
           Jika user baru saja memilih bahasa di Login, pilihan tersebut
           mengalahkan bahasa global lama sampai autentikasi selesai.
        */
        const loginTouched =
            window.localStorage.getItem(
                SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY
            ) === "1";
        const loginLanguage =
            window.localStorage.getItem(
                SELLERBOOKS_LOGIN_LANGUAGE_KEY
            );

        if(loginTouched && loginLanguage){
            return sellerBooksNormalizeLanguage(loginLanguage);
        }

        if(sellerBooksGlobalLanguageReady){
            return sellerBooksNormalizeLanguage(
                sellerBooksGlobalLanguage || SELLERBOOKS_DEFAULT_LANGUAGE
            );
        }

        return sellerBooksGetLoginLanguagePreference();
    }catch(error){
        return sellerBooksGlobalLanguageReady
            ? sellerBooksNormalizeLanguage(
                sellerBooksGlobalLanguage || SELLERBOOKS_DEFAULT_LANGUAGE
              )
            : SELLERBOOKS_DEFAULT_LANGUAGE;
    }
}

















function sellerBooksLanguageName(language){
    return sellerBooksNormalizeLanguage(language) === "en"
        ? "English"
        : "Bahasa Indonesia";
}


function sellerBooksApplyAllLanguage(){
    /*
       MASTER LANGUAGE ENGINE
       Seluruh modul SellerBooks wajib melewati satu jalur ini.
       Dropdown Login sekarang memakai engine yang sama dengan
       dropdown Bahasa yang dahulu berada di Pengaturan.
    */
    const language = sellerBooksCurrentLanguage();

    if(typeof sellerBooksApplyDateInputLanguage === "function"){
        sellerBooksApplyDateInputLanguage();
    }
    if(typeof sellerBooksApplyLoginLanguage === "function"){
        sellerBooksApplyLoginLanguage();
    }
    if(typeof sellerBooksApplyDashboardLanguage === "function"){
        sellerBooksApplyDashboardLanguage();
    }
    if(typeof sellerBooksApplyMarketplaceLanguage === "function"){
        sellerBooksApplyMarketplaceLanguage();
    }
    if(typeof sellerBooksApplyStoreLanguage === "function"){
        sellerBooksApplyStoreLanguage();
    }
    if(typeof sellerBooksApplyProductLanguage === "function"){
        sellerBooksApplyProductLanguage();
    }
    if(typeof sellerBooksApplyDetailsLanguage === "function"){
        sellerBooksApplyDetailsLanguage();
    }
    if(typeof sellerBooksApplySalesImportLanguage === "function"){
        sellerBooksApplySalesImportLanguage();
    }
    if(typeof sellerBooksApplyCostLanguage === "function"){
        sellerBooksApplyCostLanguage();
    }
    if(typeof sellerBooksApplyReportsLanguage === "function"){
        sellerBooksApplyReportsLanguage();
    }
    if(typeof sellerBooksApplySettingsLanguage === "function"){
        sellerBooksApplySettingsLanguage();
    }
    if(typeof sellerBooksApplyOwnerSetupLanguage === "function"){
        sellerBooksApplyOwnerSetupLanguage();
    }
    if(typeof sellerBooksApplyNotificationLanguage === "function"){
        sellerBooksApplyNotificationLanguage();
    }
    if(typeof window.sbPiutangApplyLanguage === "function"){
        window.sbPiutangApplyLanguage();
    }

    /* Pastikan tombol hapus transaksi terpilih mengikuti bahasa global. */
    const deleteSelectedTransactionsButton = document.getElementById("deleteSelectedReportTransactionsButton");
    if(deleteSelectedTransactionsButton){
        const isEN = String(language || "ID").trim().toUpperCase() === "EN";
        const count = document.getElementById("selectedReportTransactionCount");
        deleteSelectedTransactionsButton.innerHTML = (isEN ? "🗑️ Delete Selected (" : "🗑️ Hapus Terpilih (") + '<span id="selectedReportTransactionCount">' + (count ? count.textContent : "0") + "</span>)";
    }

    return language;
}

function sellerBooksSyncLanguageControl(){
    const select = document.getElementById("settingsLanguage");
    const language = sellerBooksApplyAllLanguage();

    if(select){
        select.value = language;
        select.disabled = !sellerBooksCloudReady;
    }

    const info = document.getElementById("settingsLanguageInfo");
    if(info){
        info.textContent =
            sellerBooksCloudReady
                ? sellerBooksSettingsText("languageSaved")
                : (
                    language === "en"
                        ? "Preparing language..."
                        : "Menyiapkan bahasa..."
                );
    }
}

async function sellerBooksSaveLanguage(value){
    const language = sellerBooksNormalizeLanguage(value);

    if(!sellerBooksAuthUser){
        sellerBooksSyncLanguageControl();
        return false;
    }

    try{
        /*
           Bahasa sekarang disimpan sebagai setting global SellerBooks
           di Supabase, BUKAN di sellerbooks_user_data dan BUKAN pada
           akun Gmail/user_id.
        */
        sellerBooksGlobalLanguage=language;
        sellerBooksGlobalLanguageReady=true;

        /*
           Jalankan SATU master engine yang sebelumnya dipicu dari
           Pengaturan. Tidak ada modul yang boleh tertinggal.
        */
        sellerBooksApplyAllLanguage();

        if(typeof currentSalesImport !== "undefined" && currentSalesImport){
            if(typeof populateSalesStoreAccounts === "function"){
                populateSalesStoreAccounts();
            }
            if(typeof updatePackingCalculation === "function"){
                updatePackingCalculation();
            }
            if(typeof updatePreviewColumns === "function" && document.getElementById("salesPreviewModal")?.classList.contains("active")){
                updatePreviewColumns();
            }
        }

        const info = document.getElementById("settingsLanguageInfo");
        if(info){
            info.textContent =
                language === "en"
                    ? "Saving English..."
                    : "Menyimpan Bahasa Indonesia...";
        }

        /*
           Simpan ke Supabase di background. Mekanisme cloud yang sudah ada
           tetap menjadi sumber penyimpanan akun, tetapi tidak menghambat
           respons tombol/dropdown.
        */
        sellerBooksSaveGlobalLanguage(language)
            .then(function(){
                const latest = sellerBooksCurrentLanguage();
                if(info && latest === language){
                    info.textContent =
                        language === "en"
                            ? "English saved to SellerBooks."
                            : "Bahasa Indonesia tersimpan di SellerBooks.";
                }
            })
            .catch(function(error){
                console.error("Gagal menyimpan bahasa SellerBooks:",error);
                if(info && sellerBooksCurrentLanguage() === language){
                    info.textContent =
                        sellerBooksSettingsText("languageSaveFailed");
                }
            });

        /*
           Tahap berikutnya akan memakai nilai ini untuk menerapkan seluruh
           terjemahan UI secara global.
        */
        return true;
    }catch(error){
        console.error("Gagal menerapkan bahasa SellerBooks:",error);
        sellerBooksSyncLanguageControl();
        return false;
    }
}





async function sellerBooksEnsureDefaultLanguage(){
    if(!sellerBooksAuthUser) return;

    let languagePersistenceCommitted = false;
    const preferred = sellerBooksGetLoginLanguagePreference();
    let loginLanguageWasChosen = sellerBooksLoginLanguageOverrideActive;
    let sessionLanguage = "";
    try{
        sessionLanguage =
            window.sessionStorage.getItem(
                SELLERBOOKS_SESSION_LANGUAGE_KEY
            ) || "";
        loginLanguageWasChosen =
            loginLanguageWasChosen ||
            !!sessionLanguage ||
            window.localStorage.getItem(SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY) === "1";
    }catch(error){}

    /*
       PENTING:
       Jika user memilih bahasa di halaman Login, pilihan tersebut adalah
       keputusan terbaru user dan TIDAK BOLEH ditimpa oleh nilai lama dari
       Supabase saat proses login.

       Sebelumnya urutannya:
       Login EN -> load Supabase(ID) -> EN baru disimpan.
       Jika save gagal/terlambat, UI sudah terlanjur kembali ID.

       Sekarang:
       Login EN -> kunci runtime ke EN -> terapkan seluruh engine ->
       baru simpan EN ke Supabase.
    */
    if(loginLanguageWasChosen){
        const selectedLanguage =
            sellerBooksNormalizeLanguage(
                sessionLanguage
                    ? sessionLanguage
                    : (
                        sellerBooksLoginLanguageOverrideActive
                            ? sellerBooksGlobalLanguage
                            : (preferred || SELLERBOOKS_DEFAULT_LANGUAGE)
                      )
            );

        sellerBooksLoginLanguageOverrideActive = true;
        sellerBooksGlobalLanguage = selectedLanguage;
        sellerBooksGlobalLanguageReady = true;
        try{
            window.sessionStorage.setItem(
                SELLERBOOKS_SESSION_LANGUAGE_KEY,
                selectedLanguage
            );
        }catch(error){}

        /*
           Terapkan seluruh fungsi bahasa lama SEBELUM cloud data/approval
           melanjutkan proses. Tidak boleh ada fase kembali ke ID.
        */
        sellerBooksApplyAllLanguage();

        try{
            await sellerBooksSaveGlobalLanguage(selectedLanguage);
            languagePersistenceCommitted = true;
        }catch(error){
            /*
               Kegagalan penyimpanan tidak boleh mengubah tampilan yang
               sudah dipilih user. Runtime tetap menggunakan selectedLanguage.
               Handoff localStorage sengaja dipertahankan agar restart APK
               tetap memakai pilihan terakhir sampai Supabase berhasil.
            */
            sellerBooksGlobalLanguage = selectedLanguage;
            sellerBooksGlobalLanguageReady = true;
            console.warn("Penyimpanan bahasa global SellerBooks gagal:",error);
        }
    }else{
        /*
           Tidak ada pilihan baru dari Login -> baru baca bahasa tersimpan
           di Supabase. Default Supabase adalah ID.
        */
        try{
            await sellerBooksLoadGlobalLanguage();
            languagePersistenceCommitted = sellerBooksGlobalLanguageReady === true;
        }catch(error){
            sellerBooksGlobalLanguage =
                SELLERBOOKS_DEFAULT_LANGUAGE;
            sellerBooksGlobalLanguageReady = true;
            languagePersistenceCommitted = false;
        }

        sellerBooksApplyAllLanguage();
    }

    sellerBooksSyncLanguageControl();

    /*
       HANYA hapus handoff Login setelah Supabase benar-benar terverifikasi.
       Jika penyimpanan gagal, biarkan EN/ID tetap tersimpan di localStorage
       sebagai fallback agar restart APK tidak mengembalikan bahasa ke default.
    */
    if(languagePersistenceCommitted){
        try{
            window.localStorage.removeItem(SELLERBOOKS_LOGIN_LANGUAGE_KEY);
            window.localStorage.removeItem(SELLERBOOKS_LOGIN_LANGUAGE_TOUCHED_KEY);
        }catch(error){}
    }

    /*
       Jangan reset sellerBooksLoginLanguageOverrideActive di sini.
       Lock ini harus bertahan selama sesi login agar callback kedua/ketiga
       tidak membaca ID lama dari Supabase dan mengubah UI kembali.
    */
}

