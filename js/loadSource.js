// function loadSource() {
//     const selectedSource = document.getElementById('sourceSelect').value;
//     if (selectedSource) {
//         fetch(selectedSource)
//             .then(response => response.text())
//             .then(data => {
//                 document.getElementById('dynamicContent').innerHTML = data;
//             })
//             .catch(error => console.error('Error loading source:', error));
//     } else {
//         document.getElementById('dynamicContent').innerHTML = '';
//     }
// }



function loadSource() {
    const selectElement = document.getElementById('sourceSelect');
    const selectedSource = selectElement.value;
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const jsFile = selectedOption.getAttribute('data-js');

    if (selectedSource) {
        // Load the HTML content
        fetch(selectedSource)
            .then(response => response.text())
            .then(data => {
                document.getElementById('dynamicContent').innerHTML = data;

                // If there is a JS file specified, load and execute it
                if (jsFile) {
                    loadAndExecuteJS(jsFile);
                }
            })
            .catch(error => console.error('Error loading source:', error));
    } else {
        document.getElementById('dynamicContent').innerHTML = '';
    }
}

// Function to load and execute the JavaScript file
function loadAndExecuteJS(jsFile) {
    const scriptTag = document.createElement('script');
    scriptTag.src = jsFile;
    document.body.appendChild(scriptTag);
}