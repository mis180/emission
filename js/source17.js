function calculateEmissionsForSource17() {
    const Q = parseFloat(document.getElementById('Q').value);
    const N1 = parseFloat(document.getElementById('N1').value);
    const NN1 = parseFloat(document.getElementById('NN1').value);
    const T = parseFloat(document.getElementById('T').value);

    // General calculations
    const G_general = Q * NN1 / 3.6;
    const M_general = (Q * N1 * T) / 1000;

    // Update general results
    document.getElementById('general_peak').textContent = G_general.toFixed(6);
    document.getElementById('general_year').textContent = M_general.toFixed(6);

    // Calculations and updates for each substance
    updateSubstanceResults('c1c5', 72.46, M_general, G_general);
    updateSubstanceResults('c6c10', 26.8, M_general, G_general);
    updateSubstanceResults('benzene', 0.35, M_general, G_general);
    updateSubstanceResults('toluene', 0.22, M_general, G_general);
    updateSubstanceResults('xylenes', 0.11, M_general, G_general);
    updateSubstanceResults('ethylbenzene', 0.06, M_general, G_general);
}

function updateSubstanceResults(substanceId, CI, M_general, G_general) {
    const M_substance = CI * M_general / 100;
    const G_substance = CI * G_general / 100;

    document.getElementById(`${substanceId}_year`).textContent = M_substance.toFixed(6);
    document.getElementById(`${substanceId}_peak`).textContent = G_substance.toFixed(6);
}
