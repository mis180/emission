function calculateEmissions() {
    const N = parseFloat(document.getElementById('N').value);
    const N1 = parseFloat(document.getElementById('N1').value);
    const T = parseFloat(document.getElementById('T').value);
    const B = parseFloat(document.getElementById('B').value);
    const BB = parseFloat(document.getElementById('BB').value);
    const SR = parseFloat(document.getElementById('SR').value);
    const H2S = parseFloat(document.getElementById('H2S').value);
    const E = parseFloat(document.getElementById('E').value);
    const NN = parseFloat(document.getElementById('NN').value);
    const GK = parseFloat(document.getElementById('GK').value);
    const A = parseFloat(document.getElementById('A').value);
    const V = parseFloat(document.getElementById('V').value);
    const KNO2 = parseFloat(document.getElementById('KNO2').value);
    const KNO = parseFloat(document.getElementById('KNO').value);

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
}

function changeUnit() {
    const selectedUnit = document.getElementById('unitSelect').value;
    // Logic to change the form fields and calculations based on the selected unit
    if (selectedUnit === 'c3421') {
        // For Печь прокалки нефтяного кокса С-3421, печь дожига
        // You can add the logic here if additional units are introduced
    }
}


function exportToExcel() {
    const wb = XLSX.utils.book_new();

    // Gather Input Data
    const inputData = [
        ["Входные данные"],
        ["Общее количество топок, шт. (N)", document.getElementById('N').value],
        ["Количество одновременно работающих топок, шт. (N1)", document.getElementById('N1').value],
        ["Время работы одной топки, час/год (T)", document.getElementById('T').value],
        ["Теплопроизводительность одной топки, Гкал/час (GK)", document.getElementById('GK').value],
        ["Число форсунок на одну топку, шт. (NN)", document.getElementById('NN').value],
        ["Максимальный расход топлива одной топкой, кг/час (B)", document.getElementById('B').value],
        ["Массовая доля жидкого топлива, в долях единицы (BB)", document.getElementById('BB').value],
        ["Содержание серы в топливе, % (SR)", document.getElementById('SR').value],
        ["Содержание сероводорода в топливе, % по массе (H2S)", document.getElementById('H2S').value],
        ["Энергетический эквивалент топлива (E)", document.getElementById('E').value],
        ["Коэффициент избытка воздуха в уходящих дымовых газах (A)", document.getElementById('A').value],
        ["Отношение Vсг/Vг при заданном коэфф. избытка воздуха (V)", document.getElementById('V').value],
        ["Коэффициент трансформации для NO2 (KNO2)", document.getElementById('KNO2').value],
        ["Коэффициент трансформации для NO (KNO)", document.getElementById('KNO').value],
    ];

    const wsInput = XLSX.utils.aoa_to_sheet(inputData);
    XLSX.utils.book_append_sheet(wb, wsInput, "Input Data");

    // Gather Output Data
    const outputData = [
        ["Результаты"],
        ["Примесь", "Kоличество выбросов, кг/час", "Валовый выброс, т/год", "Максимальный из разовых выброс, г/с"],
        ["Сера диоксид (SO2)", document.getElementById('so2_hour').textContent, document.getElementById('so2_year').textContent, document.getElementById('so2_peak').textContent],
        ["Углерод оксид (CO)", document.getElementById('co_hour').textContent, document.getElementById('co_year').textContent, document.getElementById('co_peak').textContent],
        ["Метан (CH4)", document.getElementById('ch4_hour').textContent, document.getElementById('ch4_year').textContent, document.getElementById('ch4_peak').textContent],
        ["Окислы азота (NOx)", document.getElementById('nox_hour').textContent, document.getElementById('nox_year').textContent, document.getElementById('nox_peak').textContent],
        ["Азота диоксид (NO2)", document.getElementById('no2_year').textContent, document.getElementById('no2_peak').textContent],
        ["Азот оксид (NO)", document.getElementById('no_year').textContent, document.getElementById('no_peak').textContent],
    ];

    const wsOutput = XLSX.utils.aoa_to_sheet(outputData);
    XLSX.utils.book_append_sheet(wb, wsOutput, "Output Results");

    // Export Excel File
    XLSX.writeFile(wb, 'emission_report.xlsx');
}

function printPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(12);
    doc.text("Расчеты выбросов загрязняющих веществ в атмосферу", 10, 10);

    const rows = [
        ["Примесь", "Kоличество выбросов, кг/час", "Валовый выброс, т/год", "Максимальный из разовых выброс, г/с"],
        ["Сера диоксид (SO2)", document.getElementById('so2_hour').textContent, document.getElementById('so2_year').textContent, document.getElementById('so2_peak').textContent],
        ["Углерод оксид (CO)", document.getElementById('co_hour').textContent, document.getElementById('co_year').textContent, document.getElementById('co_peak').textContent],
        ["Метан (CH4)", document.getElementById('ch4_hour').textContent, document.getElementById('ch4_year').textContent, document.getElementById('ch4_peak').textContent],
        ["Окислы азота (NOx)", document.getElementById('nox_hour').textContent, document.getElementById('nox_year').textContent, document.getElementById('nox_peak').textContent],
        ["Азота диоксид (NO2)", document.getElementById('no2_year').textContent, document.getElementById('no2_peak').textContent],
        ["Азот оксид (NO)", document.getElementById('no_year').textContent, document.getElementById('no_peak').textContent],
    ];

    doc.autoTable({
        head: [rows[0]],
        body: rows.slice(1),
    });

    doc.save('emission_report.pdf');
}
