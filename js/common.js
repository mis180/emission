// Function to navigate back to index.html
function goBack() {
    window.location.href = 'index.html';
}

// Function to create and manage the Export to Excel button
function initializeExportButton() {
    console.log("Initializing Export Button");
    const exportButton = document.getElementById('exportButton');
    
    // Ensure the export button exists
    if (!exportButton) {
        console.error('Export button not found in the DOM.');
        return;
    }

    // Set up the button to be disabled initially
    exportButton.disabled = true;

    // Set up the click event handler to export data to Excel
    exportButton.addEventListener('click', exportToExcelFromDOM);

    // Enable the export button when any calculate button is clicked
    document.querySelectorAll('.calculate-btn').forEach(button => {
        console.log("Attaching event to calculate button");
        button.addEventListener('click', function() {
            enableExportButton();
        });
    });
}

// Function to enable the Export button after calculation
function enableExportButton() {
    console.log("Enabling Export Button");
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.disabled = false;
    } else {
        console.error('Export button not found when trying to enable it.');
    }
}
function exportToExcelFromDOM() {
    console.log("Exporting to Excel");
    const container = document.querySelector('body');

    // Collect the emitter-source and emission-source details
    const emitterSource = document.querySelector('.emitter-source')?.textContent.trim() || 'Источник загрязнения: Unknown';
    const emissionSource = document.querySelector('.emission-source')?.textContent.trim() || 'Источник выделения: Unknown';

    // Prepare the header for inputs with the emitter and emission sources as the first two rows
    const inputs = [
        [emitterSource], // First row with emitter-source
        [emissionSource], // Second row with emission-source
        [], // Empty row for spacing
        ['Input Parameter', 'Value'] // Headers for the actual input data
    ];

    // Collect inputs with header
    container.querySelectorAll('.input-group').forEach(inputGroup => {
        const label = inputGroup.querySelector('.input-label');
        const input = inputGroup.querySelector('.input-field');

        if (label && input) {
            const labelText = label.textContent.trim();
            const inputValue = parseFloat(input.value) || 0;
            inputs.push([labelText, inputValue]);
        }
    });

    // Collect results and formulas with header, including the Код column
    const results = [['Code', 'Emission', 'Output/Value', 'Formula']];
    container.querySelectorAll('.result-block').forEach(resultBlock => {
        const pollutantName = resultBlock.querySelector('.result-header').textContent.trim();
        const pollutantCode = resultBlock.querySelector('.result-subheader').textContent.split(':')[1].trim(); // Extracting the code after "Код:"

        // Gather all sub-results within this block
        resultBlock.querySelectorAll('.sub-result').forEach(subResult => {
            const labelElement = subResult;
            const valueElement = subResult.querySelector('.result-value');
            const formulaElement = subResult.querySelector('.formula');

            if (labelElement && valueElement) {
                const labelText = labelElement.textContent.split(':')[0].trim();
                const value = valueElement.textContent.trim();
                const formula = formulaElement ? formulaElement.textContent.trim() : '';

                // Create a new row for each sub-result
                results.push([pollutantCode, `${pollutantName}`, `${labelText}: ${value}`, formula]);
            }
        });
    });

    // Create the Excel workbook and add sheets
    const wb = XLSX.utils.book_new();

    // Add Inputs sheet with header
    const wsInputs = XLSX.utils.aoa_to_sheet(inputs);
    XLSX.utils.book_append_sheet(wb, wsInputs, 'Inputs');

    // Add Results sheet with header, including the Код column
    const wsResults = XLSX.utils.aoa_to_sheet(results);
    XLSX.utils.book_append_sheet(wb, wsResults, 'Results');

    // Save the Excel file
    XLSX.writeFile(wb, 'emission_calculations.xlsx');
}


// Initialize the export button when the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeExportButton();
});
