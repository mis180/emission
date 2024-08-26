function calculateEmissionsForSource12() {
    const Q = parseFloat(document.getElementById('Q').value);
    const N1 = parseFloat(document.getElementById('N1').value);
    const NN1 = parseFloat(document.getElementById('NN1').value);
    const T = parseFloat(document.getElementById('T').value);

    // Calculations for Hydrocarbons C12-C19
    const CI_HC = 99.72;
    const G_HC = Q * NN1 / 3.6;
    const M_HC = (Q * N1 * T) / 1000;
    const M_HC_final = CI_HC * M_HC / 100;
    const G_HC_final = CI_HC * G_HC / 100;

    // Display Hydrocarbons C12-C19 results
    document.getElementById('hc_year').textContent = M_HC_final.toFixed(4);
    document.getElementById('hc_peak').textContent = G_HC_final.toFixed(6);

    // Calculations for Hydrogen Sulfide
    const CI_H2S = 0.28;
    const M_H2S_final = CI_H2S * M_HC / 100;
    const G_H2S_final = CI_H2S * G_HC / 100;

    // Display Hydrogen Sulfide results
    document.getElementById('h2s_year').textContent = M_H2S_final.toFixed(4);
    document.getElementById('h2s_peak').textContent = G_H2S_final.toFixed(6);

    // Enable the Export to Excel button
    enableExportButton();
}
