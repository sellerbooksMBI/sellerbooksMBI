function updateSidebarOwner(){

    /*
       Nama di baris atas = Nama Pemilik yang disimpan pada
       sellerbooks_profiles untuk akun Google yang sedang login.
    */
    const ownerName = String(
        sellerBooksProfile?.owner_name || ""
    ).trim();

    /*
       Email di bawah = email Google/Supabase Auth yang sedang login.
       Tidak pernah mengambil email dari sellerBooksStorage.
    */
    const userEmailValue = String(
        sellerBooksAuthUser?.email ||
        sellerBooksProfile?.email ||
        ""
    ).trim();

    const userName =
        document.getElementById(
            "userName"
        );

    const userEmail =
        document.getElementById(
            "userEmail"
        );

    const userAvatar =
        document.getElementById(
            "userAvatar"
        );


    if(userName){
        userName.innerText =
            ownerName || "Nama Pemilik";
    }

    if(userEmail){
        userEmail.innerText =
            userEmailValue || "Email Google";
    }

    if(userAvatar){
        userAvatar.innerText =
            ownerName
            ? ownerName.charAt(0).toUpperCase()
            : "U";
    }

}
