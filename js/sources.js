function loadSource() {
    const selectedSource = document.getElementById('sourceSelect').value;
    const dynamicContent = document.getElementById('dynamicContent');

    if (selectedSource) {
        fetch(selectedSource)
            .then(response => response.text())
            .then(data => {
                dynamicContent.innerHTML = data;
            })
            .catch(error => console.error('Error loading the source content:', error));
    } else {
        dynamicContent.innerHTML = ''; // Clear the content if no source is selected
    }
}
