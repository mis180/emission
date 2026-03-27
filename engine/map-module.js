const MapModule = (() => {
    let _map = null;
    let _markers = [];
    let _clickCallback = null;

    function init(containerId, lat, lng) {
        if (!window.L) return; // Leaflet not loaded
        _map = L.map(containerId).setView([lat || 43.2, lng || 76.9], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; OpenStreetMap contributors'
        }).addTo(_map);

        _map.on('click', (e) => {
            if (_clickCallback) {
                _clickCallback(e.latlng.lat, e.latlng.lng);
                _clickCallback = null;
                document.getElementById(containerId).style.cursor = '';
            }
        });
    }

    function addSourceMarker(source) {
        if (!_map || !source.lat || !source.lng) return;
        
        let pColor = '#3388ff';
        let radius = 0;

        // Basic radius logic for MP3 Sanitary zone: I=red 1000m, II=orange 500m, III=yellow 300m, IV=green 100m, V=gray 50m
        const cls = source.inputs && source.inputs.sanitary_class;
        if (cls === 1) { radius = 1000; pColor = 'red'; }
        else if (cls === 2) { radius = 500; pColor = 'orange'; }
        else if (cls === 3) { radius = 300; pColor = 'yellow'; }
        else if (cls === 4) { radius = 100; pColor = 'green'; }
        else if (cls === 5) { radius = 50; pColor = 'gray'; }

        if (radius > 0) {
            L.circle([source.lat, source.lng], {
                color: pColor,
                fillColor: pColor,
                fillOpacity: 0.1,
                radius: radius
            }).addTo(_map);
        }

        const mDisp = (source.M != null) ? source.M.toFixed(4) : '—';
        const gDisp = (source.G != null) ? source.G.toFixed(4) : '—';
        const marker = L.marker([source.lat, source.lng]).addTo(_map);
        marker.bindPopup(`<b>${source.name}</b><br>${source.methodic_name}<br>M: ${mDisp} г/с<br>G: ${gDisp} т/год`);
        _markers.push(marker);
    }

    function refreshMarkers(sources) {
        if (!_map) return;
        // Naive refresh to clear map entities (including circles drawn prior)
        _map.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
                _map.removeLayer(layer);
            }
        });
        _markers = [];
        sources.forEach(addSourceMarker);
    }

    function enableClickPlacement(callback) {
        _clickCallback = callback;
        const container = document.getElementById(_map._container.id);
        if (container) container.style.cursor = 'crosshair';
    }

    function invalidateSize() {
        if (_map) setTimeout(() => _map.invalidateSize(), 200);
    }

    return { init, addSourceMarker, refreshMarkers, enableClickPlacement, invalidateSize };
})();
