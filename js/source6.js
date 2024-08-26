function calculateEmissionsForSource6() {
    const N = parseFloat(document.getElementById('N').value);
    const N1 = parseFloat(document.getElementById('N1').value);
    const T = parseFloat(document.getElementById('T').value);
    const B = parseFloat(document.getElementById('B').value);
    const BB = parseFloat(document.getElementById('BB').value);
    const SR = parseFloat(document.getElementById('SR').value);
    const H2S = parseFloat(document.getElementById('H2S').value);
    const E = 1.37;
    const NN = 18;
    const GK = 47;
    const A = 1.3;
    const V = 0.88;
    const KNO2 = 0.8;
    const KNO = 0.13;

    // Sulfur Dioxide (SO2) Emissions
    const M_SO2 = B * (2 * SR * BB + 1.88 * H2S * (1 - BB)) * 0.01;
    const M_SO2_year = N * M_SO2 * T * 1e-3; // tons/year
    const G_SO2_peak = N1 * M_SO2 / 3.6; // g/s

    // Carbon Monoxide (CO) Emissions
    const M_CO = 1.5 * B * 1e-3;
    const M_CO_year = N * M_CO * T * 1e-3; // tons/year
    const G_CO_peak = N1 * M_CO / 3.6; // g/s

    // Methane (CH4) Emissions
    const M_CH4 = 1.5 * B * 1e-3;
    const M_CH4_year = N * M_CH4 * T * 1e-3; // tons/year
    const G_CH4_peak = N1 * M_CH4 / 3.6; // g/s

    // Nitrogen Oxides (NOx) Emissions
    const QP = GK * 4.1868 * 103 / NN; // MJ/hour
    const QF = 29.4 * E * B / NN; // MJ/hour
    const CNOX = 1.073 * (180 + 60 * BB) * QF / QP * Math.sqrt(A) * V * 1e-6; // kg/m3
    const VR = 7.84 * A * B * E; // m3/hour
    const VO = VR / 3600; // m3/s
    const M_NOX = VR * CNOX; // kg/hour
    const M_NOX_year = N * M_NOX * T * 1e-3; // tons/year
    const G_NOX_peak = N1 * M_NOX / 3.6; // g/s

    // Nitrogen Dioxide (NO2) Emissions
    const M_NO2_year = KNO2 * M_NOX_year; // tons/year
    const G_NO2_peak = KNO2 * G_NOX_peak; // g/s

    // Nitric Oxide (NO) Emissions
    const M_NO_year = KNO * M_NOX_year; // tons/year
    const G_NO_peak = KNO * G_NOX_peak; // g/s

    // Carbon (Soot) Emissions
    const AR = 0.009;
    const M_Carbon = B * BB * AR * 0.01;
    const M_Carbon_year = N * M_Carbon * T * 1e-3; // tons/year
    const G_Carbon_peak = N1 * M_Carbon / 3.6; // g/s

    // Display the results
    document.getElementById('so2_hour').textContent = M_SO2.toFixed(4);
    document.getElementById('so2_year').textContent = M_SO2_year.toFixed(4);
    document.getElementById('so2_peak').textContent = G_SO2_peak.toFixed(4);

    document.getElementById('co_hour').textContent = M_CO.toFixed(4);
    document.getElementById('co_year').textContent = M_CO_year.toFixed(4);
    document.getElementById('co_peak').textContent = G_CO_peak.toFixed(4);

    document.getElementById('ch4_hour').textContent = M_CH4.toFixed(4);
    document.getElementById('ch4_year').textContent = M_CH4_year.toFixed(4);
    document.getElementById('ch4_peak').textContent = G_CH4_peak.toFixed(4);

    document.getElementById('nox_hour').textContent = M_NOX.toFixed(4);
    document.getElementById('nox_year').textContent = M_NOX_year.toFixed(4);
    document.getElementById('nox_peak').textContent = G_NOX_peak.toFixed(4);

    document.getElementById('no2_year').textContent = M_NO2_year.toFixed(4);
    document.getElementById('no2_peak').textContent = G_NO2_peak.toFixed(4);

    document.getElementById('no_year').textContent = M_NO_year.toFixed(4);
    document.getElementById('no_peak').textContent = G_NO_peak.toFixed(4);

    document.getElementById('carbon_hour').textContent = M_Carbon.toFixed(4);
    document.getElementById('carbon_year').textContent = M_Carbon_year.toFixed(4);
    document.getElementById('carbon_peak').textContent = G_Carbon_peak.toFixed(4);

    // Enable the Export to Excel button
    enableExportButton();
}
