function calculateEmissionsForSource3() {
    const N = 1;
    const N1 = 1;
    const T = 8760;
    const B = 2264.6;
    const BB = 0;
    const SR = 0;
    const H2S = 0.09;
    const E = 2.3;
    const NN = 18;
    const GK = 47;
    const A = 1.3;
    const V = 0.81;
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
    const CNOX = 0.8 * 1.073 * (180 + 60 * BB) * QF / QP * Math.sqrt(A) * V * 1e-6; // kg/m3
    const VR = 7.84 * A * B * E; // m3/hour
    const M_NOX = VR * CNOX; // kg/hour
    const M_NOX_year = N * M_NOX * T * 1e-3; // tons/year
    const G_NOX_peak = N1 * M_NOX / 3.6; // g/s

    // Nitrogen Dioxide (NO2) Emissions
    const M_NO2_year = KNO2 * M_NOX_year; // tons/year
    const G_NO2_peak = KNO2 * G_NOX_peak; // g/s

    // Nitric Oxide (NO) Emissions
    const M_NO_year = KNO * M_NOX_year; // tons/year
    const G_NO_peak = KNO * G_NOX_peak; // g/s

    // Display the results
    document.getElementById('so2_hour_source3').textContent = M_SO2.toFixed(4);
    document.getElementById('so2_year_source3').textContent = M_SO2_year.toFixed(4);
    document.getElementById('so2_peak_source3').textContent = G_SO2_peak.toFixed(4);

    document.getElementById('co_hour_source3').textContent = M_CO.toFixed(4);
    document.getElementById('co_year_source3').textContent = M_CO_year.toFixed(4);
    document.getElementById('co_peak_source3').textContent = G_CO_peak.toFixed(4);

    document.getElementById('ch4_hour_source3').textContent = M_CH4.toFixed(4);
    document.getElementById('ch4_year_source3').textContent = M_CH4_year.toFixed(4);
    document.getElementById('ch4_peak_source3').textContent = G_CH4_peak.toFixed(4);

    document.getElementById('nox_hour_source3').textContent = M_NOX.toFixed(4);
    document.getElementById('nox_year_source3').textContent = M_NOX_year.toFixed(4);
    document.getElementById('nox_peak_source3').textContent = G_NOX_peak.toFixed(4);

    document.getElementById('no2_year_source3').textContent = M_NO2_year.toFixed(4);
    document.getElementById('no2_peak_source3').textContent = G_NO2_peak.toFixed(4);

    document.getElementById('no_year_source3').textContent = M_NO_year.toFixed(4);
    document.getElementById('no_peak_source3').textContent = G_NO_peak.toFixed(4);
}
