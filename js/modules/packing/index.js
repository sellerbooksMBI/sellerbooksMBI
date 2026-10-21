/* =========================================================
   SELLERBOOKS FEATURE MODULE: PACKING COSTS
   Scope: packing modal UI and packing-settings interaction.
   Dependencies intentionally remain global for compatibility:
   - packingCosts / savePackingCosts()
   - formatRupiah()
   - sellerBooksAlert()
========================================================= */

function openPackingModal(){
    document.getElementById("packingThermal").value = packingCosts.thermal || 0;
    document.getElementById("packingLakban").value = packingCosts.lakban || 0;
    document.getElementById("packingPlastik").value = packingCosts.plastik || 0;
    document.getElementById("packingBubble").value = packingCosts.bubble || 0;
    updatePackingPreview();
    document.getElementById("packingModal").classList.add("show");
}

function closePackingModal(){
    document.getElementById("packingModal").classList.remove("show");
}

function updatePackingPreview(){
    const thermal = Number(document.getElementById("packingThermal").value) || 0;
    const lakban = Number(document.getElementById("packingLakban").value) || 0;
    const plastik = Number(document.getElementById("packingPlastik").value) || 0;
    const bubble = Number(document.getElementById("packingBubble").value) || 0;
    const total = thermal + lakban + plastik + bubble;
    document.getElementById("packingTotalPreview").innerText = formatRupiah(total);
}

function savePackingSettings(){
    packingCosts = {
        thermal: Number(document.getElementById("packingThermal").value) || 0,
        lakban: Number(document.getElementById("packingLakban").value) || 0,
        plastik: Number(document.getElementById("packingPlastik").value) || 0,
        bubble: Number(document.getElementById("packingBubble").value) || 0
    };
    savePackingCosts();
    closePackingModal();
    sellerBooksAlert("Pengaturan biaya packing berhasil disimpan.");
}

document.addEventListener("input", function(event){
    if(event.target && (
        event.target.id === "packingThermal" ||
        event.target.id === "packingLakban" ||
        event.target.id === "packingPlastik" ||
        event.target.id === "packingBubble"
    )){
        updatePackingPreview();
    }
});
