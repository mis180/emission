function calculateEmissionsForSource11() {
    const Q = parseFloat(document.getElementById('Q').value);
    const N1 = parseFloat(document.getElementById('N1').value);
    const NN1 = parseFloat(document.getElementById('NN1').value);
    const T = parseFloat(document.getElementById('T').value);

    // General Emissions
    const G_general = Q * NN1 / 3.6; // g/s
    const M_general = (Q * N1 * T) / 1000; // tons/year

    document.getElementById('general_peak').textContent = G_general.toFixed(5);
    document.getElementById('general_year').textContent = M_general.toFixed(5);

    // Substances Emissions
    const substances = [
        { id: 'c1c5', CI: 67.67 },
        { id: 'c6c10', CI: 25.01 },
        { id: 'pentylenes', CI: 2.5 },
        { id: 'benzene', CI: 2.3 },
        { id: 'toluene', CI: 2.17 },
        { id: 'xylenes', CI: 0.29 },
        { id: 'ethylbenzene', CI: 0.06 }
    ];

    substances.forEach(substance => {
        const M_substance = substance.CI * M_general / 100;
        const G_substance = substance.CI * G_general / 100;

        document.getElementById(`${substance.id}_year`).textContent = M_substance.toFixed(5);
        document.getElementById(`${substance.id}_peak`).textContent = G_substance.toFixed(5);
    });
}
