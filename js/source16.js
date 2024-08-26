function calculateEmissionsForSource16() {
    const Q = parseFloat(document.getElementById('Q').value);
    const N1 = parseFloat(document.getElementById('N1').value);
    const NN1 = parseFloat(document.getElementById('NN1').value);
    const T = parseFloat(document.getElementById('T').value);

    // Calculations for Hydrocarbons C1-C5
    const CI_HC_C1C5 = 72.46;
    const G_HC_C1C5 = Q * NN1 / 3.6;
    const M_HC_C1C5 = (Q * N1 * T) / 1000;
    const M_HC_C1C5_final = CI_HC_C1C5 * M_HC_C1C5 / 100;
    const G_HC_C1C5_final = CI_HC_C1C5 * G_HC_C1C5 / 100;
    document.getElementById('c1c5_year').textContent = M_HC_C1C5_final.toFixed(9);
    document.getElementById('c1c5_peak').textContent = G_HC_C1C5_final.toFixed(9);

    // Calculations for Hydrocarbons C6-C10
    const CI_HC_C6C10 = 26.8;
    const M_HC_C6C10_final = CI_HC_C6C10 * M_HC_C1C5 / 100;
    const G_HC_C6C10_final = CI_HC_C6C10 * G_HC_C1C5 / 100;
    document.getElementById('c6c10_year').textContent = M_HC_C6C10_final.toFixed(6);
    document.getElementById('c6c10_peak').textContent = G_HC_C6C10_final.toFixed(6);

    // Calculations for Benzene
    const CI_Benzene = 0.35;
    const M_Benzene_final = CI_Benzene * M_HC_C1C5 / 100;
    const G_Benzene_final = CI_Benzene * G_HC_C1C5 / 100;
    document.getElementById('benzene_year').textContent = M_Benzene_final.toFixed(6);
    document.getElementById('benzene_peak').textContent = G_Benzene_final.toFixed(6);

    // Calculations for Toluene (Methylbenzene)
    const CI_Toluene = 0.22;
    const M_Toluene_final = CI_Toluene * M_HC_C1C5 / 100;
    const G_Toluene_final = CI_Toluene * G_HC_C1C5 / 100;
    document.getElementById('toluene_year').textContent = M_Toluene_final.toFixed(6);
    document.getElementById('toluene_peak').textContent = G_Toluene_final.toFixed(6);

    // Calculations for Xylenes (Dimethylbenzene)
    const CI_Xylenes = 0.11;
    const M_Xylenes_final = CI_Xylenes * M_HC_C1C5 / 100;
    const G_Xylenes_final = CI_Xylenes * G_HC_C1C5 / 100;
    document.getElementById('xylenes_year').textContent = M_Xylenes_final.toFixed(6);
    document.getElementById('xylenes_peak').textContent = G_Xylenes_final.toFixed(6);

    // Calculations for Hydrogen Sulfide (H2S)
    const CI_H2S = 0.06;
    const M_H2S_final = CI_H2S * M_HC_C1C5 / 100;
    const G_H2S_final = CI_H2S * G_HC_C1C5 / 100;
    document.getElementById('h2s_year').textContent = M_H2S_final.toFixed(6);
    document.getElementById('h2s_peak').textContent = G_H2S_final.toFixed(6);

    // Enable the Export to Excel button
    enableExportButton();
}
