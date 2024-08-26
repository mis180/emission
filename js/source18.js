function calculateEmissionsForSource18() {
    const Q = parseFloat(document.getElementById('Q').value);
    const N1 = parseFloat(document.getElementById('N1').value);
    const NN1 = parseFloat(document.getElementById('NN1').value);
    const T = parseFloat(document.getElementById('T').value);

    // Common Calculations
    const G = Q * NN1 / 3.6;
    const M = (Q * N1 * T) / 1000;

    document.getElementById('general_peak').textContent = G.toFixed(6);
    document.getElementById('general_year').textContent = M.toFixed(6);

    // Calculations for each substance
    const substances = [
        { CI: 72.46, yearElementId: 'c1c5_year', peakElementId: 'c1c5_peak' },
        { CI: 26.8, yearElementId: 'c6c10_year', peakElementId: 'c6c10_peak' },
        { CI: 0.35, yearElementId: 'benzene_year', peakElementId: 'benzene_peak' },
        { CI: 0.22, yearElementId: 'toluene_year', peakElementId: 'toluene_peak' },
        { CI: 0.11, yearElementId: 'xylenes_year', peakElementId: 'xylenes_peak' },
        { CI: 0.06, yearElementId: 'h2s_year', peakElementId: 'h2s_peak' }
    ];

    substances.forEach(substance => {
        const M_final = substance.CI * M / 100;
        const G_final = substance.CI * G / 100;
        document.getElementById(substance.yearElementId).textContent = M_final.toFixed(6);
        document.getElementById(substance.peakElementId).textContent = G_final.toFixed(6);
    });
}
