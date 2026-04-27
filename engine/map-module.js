/**
 * map-module.js - GIS Rendering Engine
 * Layer-aware Leaflet manager with custom markers, emission-intensity coloring,
 * and helpers for plume visualization.
 */
const MapModule = (() => {
    let _map = null;
    let _layers = {};
    let _clickCallback = null;
    let _legendControl = null;

    const LAYER_NAMES = {
        SOURCES:    'sources',
        RECEPTORS:  'receptors',
        BOUNDARY:   'boundary',
        SAN_ZONES:  'sanitary_zones',
        PLUME:      'plume_contours',
        SENSITIVE:  'sensitive_areas',
        MANUAL:     'manual_geometries'
    };

    /* ==============================
     *  INTENSITY HELPERS
     * ============================== */

    const INTENSITY_COLORS = {
        low:      { bg: '#10b981', border: '#059669', label: '< 0.01 \u0442/\u0433' },
        medium:   { bg: '#f59e0b', border: '#d97706', label: '0.01\u20130.1 \u0442/\u0433' },
        high:     { bg: '#ef4444', border: '#dc2626', label: '0.1\u20131.0 \u0442/\u0433' },
        critical: { bg: '#7c2d12', border: '#451a03', label: '\u2265 1.0 \u0442/\u0433' }
    };

    function getIntensityLevel(gTonsPerYear) {
        if (gTonsPerYear < 0.01) return 'low';
        if (gTonsPerYear < 0.1)  return 'medium';
        if (gTonsPerYear < 1.0)  return 'high';
        return 'critical';
    }

    function escapeHtml(value) {
        if (value == null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ==============================
     *  FACILITY TYPE ICONS
     * ============================== */

    const FACILITY_TYPE_ICONS = {
        fuel_station:    '\u26FD',
        fuel_depot:      '\uD83D\uDEE2\uFE0F',
        industrial_site: '\uD83C\uDFED',
        construction:    '\uD83C\uDFD7\uFE0F',
        boiler_house:    '\uD83D\uDD25',
        warehouse:       '\uD83D\uDCE6',
        workshop:        '\uD83D\uDD27',
        transport_base:  '\uD83D\uDE8C',
        mining_site:     '\u26CF\uFE0F',
        other:           '\uD83D\uDCCD'
    };

    /* ==============================
     *  MAP LIFECYCLE
     * ============================== */

    function init(containerId, lat, lng) {
        if (!window.L) return;

        // Guard: if map already exists for this container, just re-center
        if (_map) {
            _map.setView([lat || 43.2, lng || 76.9], 12);
            return;
        }

        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        });

        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        });

        const yandexMap = L.tileLayer('https://vec0{s}.maps.yandex.net/tiles?l=map&v=9.14.0&x={x}&y={y}&z={z}&scale=1&lang=ru_RU', {
            subdomains: '1234',
            attribution: '&copy; Yandex'
        });

        const yandexSat = L.tileLayer('https://sat0{s}.maps.yandex.net/tiles?l=sat&v=3.585.0&x={x}&y={y}&z={z}&scale=1&lang=ru_RU', {
            subdomains: '1234',
            attribution: '&copy; Yandex'
        });

        _map = L.map(containerId, {
            layers: [osm],
            minZoom: 4,
            maxZoom: 22
        }).setView([lat || 43.2, lng || 76.9], 12);

        // Basemap switching
        const baseMaps = {
            "OpenStreetMap": osm,
            "Satellite (Esri)": satellite,
            "Yandex Map": yandexMap,
            "Yandex Satellite": yandexSat
        };

        // Initialize layer groups
        Object.values(LAYER_NAMES).forEach(name => {
            _layers[name] = L.layerGroup().addTo(_map);
        });

        const overlays = {
            "\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438": _layers[LAYER_NAMES.SOURCES],
            "\u0420\u0435\u0446\u0435\u043f\u0442\u043e\u0440\u044b": _layers[LAYER_NAMES.RECEPTORS],
            "\u0413\u0440\u0430\u043d\u0438\u0446\u0430": _layers[LAYER_NAMES.BOUNDARY],
            "\u0421\u0430\u043d. \u0437\u043e\u043d\u044b": _layers[LAYER_NAMES.SAN_ZONES],
            "\u0428\u043b\u0435\u0439\u0444": _layers[LAYER_NAMES.PLUME],
            "\u041e\u0431\u044a\u0435\u043a\u0442\u044b": _layers[LAYER_NAMES.MANUAL]
        };

        L.control.layers(baseMaps, overlays, { position: 'topright' }).addTo(_map);

        // Geoman Drawing Tools
        if (_map.pm) {
            _map.pm.addControls({
                position: 'topleft',
                drawCircleMarker: false,
                drawMarker: true,
                drawPolyline: true,
                drawRectangle: true,
                drawCircle: true,
                drawPolygon: true,
                editMode: true,
                dragMode: true,
                cutPolygon: false,
                removalMode: true,
            });

            _map.on('pm:create', (e) => {
                const { shape, layer } = e;
                
                // Measurement Tooltips
                if (shape === 'Line') {
                    const dist = calculateLeafletLength(layer);
                    layer.bindTooltip(`\u0414\u043b\u0438\u043d\u0430: ${dist > 1000 ? (dist/1000).toFixed(2) + ' \u043a\u043c' : dist.toFixed(0) + ' \u043c'}`, {permanent: true, direction: 'center', className: 'measure-tooltip'}).openTooltip();
                } else if (shape === 'Polygon' || shape === 'Rectangle') {
                    const area = calculateLeafletArea(layer);
                    layer.bindTooltip(`\u041f\u043b\u043e\u0449\u0430\u0434\u044c: ${area > 10000 ? (area/10000).toFixed(2) + ' \u0433\u0430' : area.toFixed(0) + ' \u043c\u00b2'}`, {permanent: true, direction: 'center', className: 'measure-tooltip'}).openTooltip();
                }

                const geojson = layer.toGeoJSON();
                if (shape === 'Circle') {
                    geojson.properties.radius = layer.getRadius();
                }

                if (window.GeoMeteoWorkspace) {
                    GeoMeteoWorkspace.handleGeomanCreate(shape, geojson);
                }
            });
        }

        _map.on('click', (e) => {
            if (_clickCallback) {
                _clickCallback(e.latlng.lat, e.latlng.lng);
                _clickCallback = null;
                document.getElementById(containerId).style.cursor = '';
            }
        });

        L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(_map);

        // Map Legend
        if (!_legendControl) {
            _legendControl = L.control({ position: 'bottomright' });
            _legendControl.onAdd = function() {
                const div = L.DomUtil.create('div', 'map-legend');
                L.DomEvent.disableClickPropagation(div);
                
                div.innerHTML = `
                    <div class="map-legend-title" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        <span>\u041b\u0435\u0433\u0435\u043d\u0434\u0430 \u0441\u043b\u043e\u0435\u0432</span><span style="font-size:0.7em;">\u25BC</span>
                    </div>
                    <div style="display:block;">
                    <div style="font-size: 0.8rem; margin-bottom: 8px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                        <label style="display:flex; align-items:center; gap:6px; margin-bottom:4px; cursor:pointer;"><input type="checkbox" checked onchange="MapModule.toggleLayer('sources', this.checked)"> \u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 (\uD83D\uDCCD)</label>
                        <label style="display:flex; align-items:center; gap:6px; margin-bottom:4px; cursor:pointer;"><input type="checkbox" checked onchange="MapModule.toggleLayer('sanitary_zones', this.checked)"> \u0421\u0430\u043d. \u0437\u043e\u043d\u044b (\u2B55)</label>
                        <label style="display:flex; align-items:center; gap:6px; margin-bottom:4px; cursor:pointer;"><input type="checkbox" checked onchange="MapModule.toggleLayer('receptors', this.checked)"> \u0420\u0435\u0446\u0435\u043f\u0442\u043e\u0440\u044b (\uD83D\uDFE3)</label>
                        <label style="display:flex; align-items:center; gap:6px; margin-bottom:4px; cursor:pointer;"><input type="checkbox" checked onchange="MapModule.toggleLayer('plume_contours', this.checked)"> \u0428\u043b\u0435\u0439\u0444 \u0440\u0430\u0441\u0441\u0435\u0438\u0432\u0430\u043d\u0438\u044f (\uD83D\uDCA8)</label>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; gap:16px;">
                        <div>
                            <div class="map-legend-title" style="font-size:0.75rem; margin-bottom:4px; color:#64748b;">\u0412\u044b\u0431\u0440\u043e\u0441\u044b (G)</div>
                            <div class="map-legend-item"><div class="map-legend-swatch" style="background:#10b981; border-radius:50%;"></div><div class="map-legend-label">\u041d\u0438\u0437\u043a\u0438\u0435</div></div>
                            <div class="map-legend-item"><div class="map-legend-swatch" style="background:#f59e0b; border-radius:50%;"></div><div class="map-legend-label">\u0421\u0440\u0435\u0434\u043d\u0438\u0435</div></div>
                            <div class="map-legend-item"><div class="map-legend-swatch" style="background:#ef4444; border-radius:50%;"></div><div class="map-legend-label">\u0412\u044b\u0441\u043e\u043a\u0438\u0435</div></div>
                            <div class="map-legend-item"><div class="map-legend-swatch" style="background:#7c2d12; border-radius:50%;"></div><div class="map-legend-label">\u041a\u0440\u0438\u0442.</div></div>
                        </div>
                        <div>
                            <div class="map-legend-title" style="font-size:0.75rem; margin-bottom:4px; color:#64748b;">\u0420\u0430\u0441\u0441\u0435\u0438\u0432\u0430\u043d\u0438\u0435</div>
                            <div class="map-legend-item"><div class="map-legend-swatch" style="background:rgba(16, 185, 129, 0.25); border:1px solid #10b981;"></div><div class="map-legend-label">0.1 Cmax</div></div>
                            <div class="map-legend-item"><div class="map-legend-swatch" style="background:rgba(234, 179, 8, 0.35); border:1px solid #eab308;"></div><div class="map-legend-label">0.25 Cmax</div></div>
                            <div class="map-legend-item"><div class="map-legend-swatch" style="background:rgba(249, 115, 22, 0.45); border:1px solid #f97316;"></div><div class="map-legend-label">0.5 Cmax</div></div>
                            <div class="map-legend-item"><div class="map-legend-swatch" style="background:rgba(239, 68, 68, 0.55); border:1px solid #ef4444;"></div><div class="map-legend-label">0.8 Cmax</div></div>
                        </div>
                    </div>
                    <hr style="margin:8px 0; border:0; border-top:1px solid #e2e8f0;">
                    <div style="display:flex; justify-content:space-between; gap:16px;">
                        <div class="map-legend-item"><div class="map-legend-swatch" style="background:#8b5cf6; border-radius:50%;"></div><div class="map-legend-label">\u0420\u0435\u0446\u0435\u043f\u0442\u043e\u0440</div></div>
                        <div class="map-legend-item"><div class="map-legend-swatch" style="background:transparent; border:2px dashed #64748b;"></div><div class="map-legend-label">\u0421\u0417\u0417 / \u0413\u0440\u0430\u043d\u0438\u0446\u0430</div></div>
                    </div>
                    </div>
                `;
                return div;
            };
            _legendControl.addTo(_map);
        }
    }

    // --- Measurement Analytics --- //

    function haversineDistance(latlng1, latlng2) {
        const R = 6371e3;
        const f1 = latlng1.lat * Math.PI/180;
        const f2 = latlng2.lat * Math.PI/180;
        const df = (latlng2.lat-latlng1.lat) * Math.PI/180;
        const dl = (latlng2.lng-latlng1.lng) * Math.PI/180;
        const a = Math.sin(df/2) ** 2 + Math.cos(f1) * Math.cos(f2) * (Math.sin(dl/2) ** 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    }

    function calculateLeafletLength(layer) {
        let length = 0;
        const latlngs = layer.getLatLngs();
        const pts = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
        if(pts && pts.length > 0) {
            for (let i = 0; i < pts.length - 1; i++) {
                length += haversineDistance(pts[i], pts[i+1]);
            }
        }
        return length;
    }
    
    function calculateLeafletArea(layer) {
        const latlngs = layer.getLatLngs();
        const pts = Array.isArray(latlngs[0]) ? (Array.isArray(latlngs[0][0]) ? latlngs[0][0] : latlngs[0]) : latlngs;
        let area = 0;
        if (pts && pts.length > 2) {
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                area += (p2.lng - p1.lng) * Math.PI/180 * (2 + Math.sin(p1.lat * Math.PI/180) + Math.sin(p2.lat * Math.PI/180));
            }
            area = Math.abs(area * 6371000 * 6371000 / 2.0);
        }
        return area;
    }

    function destroy() {
        if (_map) {
            if (_legendControl) {
                _map.removeControl(_legendControl);
                _legendControl = null;
            }
            if (_map.pm) {
                 _map.pm.removeControls();
                 _map.pm.disableDraw();
            }
            _map.off();
            _map.remove();
            _map = null;
            _layers = {};
            _clickCallback = null;
        }
    }

    function getMap() {
        return _map;
    }

    /* ==============================
     *  LAYER MANAGEMENT
     * ============================== */

    function clearLayer(name) {
        if (_layers[name]) _layers[name].clearLayers();
    }

    function toggleLayer(name, visible) {
        if (!_layers[name] || !_map) return;
        if (visible) {
            _layers[name].addTo(_map);
        } else {
            _map.removeLayer(_layers[name]);
        }
    }

    function setLayerOpacity(name, opacity) {
        if (!_layers[name]) return;
        _layers[name].eachLayer((layer) => {
            if (layer.setStyle) {
                // If it's a path (polygon/circle)
                layer.setStyle({ fillOpacity: opacity * 0.1, opacity: opacity });
            } else if (layer.setOpacity) {
                // If it's an image overlay or marker
                layer.setOpacity(opacity);
            }
        });
    }

    /**
     * Add any Leaflet layer object to a named layer group.
     * This is the key helper that was missing - used by GeoMeteoWorkspace for plume rendering.
     */
    function addToLayer(layerName, leafletObj) {
        const target = _layers[layerName] || _layers[LAYER_NAMES.MANUAL];
        if (target && leafletObj) {
            target.addLayer(leafletObj);
        }
    }

    /* ==============================
     *  CUSTOM SOURCE MARKERS
     * ============================== */

    function createSourceIcon(source, facilityType) {
        const intensity = getIntensityLevel(source.G || 0);
        const c = INTENSITY_COLORS[intensity];
        const typeEmoji = FACILITY_TYPE_ICONS[facilityType] || '\uD83D\uDCCD';

        const scaleFactor = Math.min(1.5, Math.max(0.8, 1 + (source.G || 0.1) * 0.5));
        const finalSize = Math.floor(36 * scaleFactor);

        return L.divIcon({
            className: 'emission-source-marker',
            html: `<div class="source-pin" style="background:${c.bg}; border-color:${c.border}; width:${finalSize}px; height:${finalSize}px;">
                     <span class="source-pin-icon" style="font-size:${Math.floor(16*scaleFactor)}px;">${typeEmoji}</span>
                   </div>
                   <span class="source-pin-number" style="bottom:-10px;">${escapeHtml(source.source_number || '')}</span>`,
            iconSize: [finalSize, finalSize + 8],
            iconAnchor: [finalSize / 2, finalSize + 8],
            popupAnchor: [0, -(finalSize + 8)]
        });
    }

    function createPopupContent(source, facilityName) {
        const mNum = Number(source.M);
        const gNum = Number(source.G);
        const mDisp = Number.isFinite(mNum) ? mNum.toFixed(4) : '\u2014';
        const gDisp = Number.isFinite(gNum) ? gNum.toFixed(4) : '\u2014';
        const intensity = getIntensityLevel(source.G || 0);
        const c = INTENSITY_COLORS[intensity];
        const sourceName = escapeHtml(source.name || '\u2014');
        const sourceSubtitle = escapeHtml(facilityName || '');
        const sourceNumber = escapeHtml(source.source_number || '\u2014');
        const methodicLabel = escapeHtml(source.methodic_name || source.methodic_id || '\u2014');

        return `
            <div class="source-popup">
                <div class="source-popup-header" style="border-left: 4px solid ${c.bg}; padding-left: 10px;">
                    <div class="source-popup-title">${sourceName}</div>
                    <div class="source-popup-subtitle">${sourceSubtitle}</div>
                </div>
                <div class="source-popup-body">
                    <div class="source-popup-row">
                        <span class="source-popup-label">\u2116 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0430:</span>
                        <span class="source-popup-value">${sourceNumber}</span>
                    </div>
                    <div class="source-popup-row">
                        <span class="source-popup-label">\u041c\u0435\u0442\u043e\u0434\u0438\u043a\u0430:</span>
                        <span class="source-popup-value">${methodicLabel}</span>
                    </div>
                    <div class="source-popup-divider"></div>
                    <div class="source-popup-metrics">
                        <div class="source-popup-metric">
                            <div class="source-popup-metric-label">M (\u0433/\u0441)</div>
                            <div class="source-popup-metric-value">${mDisp}</div>
                        </div>
                        <div class="source-popup-metric">
                            <div class="source-popup-metric-label">G (\u0442/\u0433\u043e\u0434)</div>
                            <div class="source-popup-metric-value" style="color:${c.bg}; font-weight:700;">${gDisp}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function addSourceMarker(source, facilityType, facilityName) {
        if (!_map || !source.lat || !source.lng) return;

        // Use custom icon
        const icon = createSourceIcon(source, facilityType);
        const marker = L.marker([source.lat, source.lng], { icon: icon });
        marker.bindPopup(createPopupContent(source, facilityName), {
            maxWidth: 280,
            className: 'source-popup-container'
        });
        marker.on('click', () => {
            if (window.GeoMeteoWorkspace) GeoMeteoWorkspace.selectSource(source.id);
        });
        _layers[LAYER_NAMES.SOURCES].addLayer(marker);

        // Draw sanitary zone circle
        let radius = getSanitaryRadius(source.inputs && source.inputs.sanitary_class);
        if (source.inputs && source.inputs.sanitary_radius_m) {
            radius = parseFloat(source.inputs.sanitary_radius_m);
        }

        if (radius > 0) {
            const circle = L.circle([source.lat, source.lng], {
                radius: radius,
                color: getSanitaryColor(source.inputs && source.inputs.sanitary_class),
                fillColor: getSanitaryColor(source.inputs && source.inputs.sanitary_class),
                fillOpacity: 0.1,
                weight: 1
            });
            _layers[LAYER_NAMES.SAN_ZONES].addLayer(circle);
        }
    }

    /**
     * Refresh all source markers on the map.
     * Now accepts full facility data for proper icon + popup rendering.
     */
    function refreshMarkers(facilities) {
        if (!_map) return;
        clearLayer(LAYER_NAMES.SOURCES);
        clearLayer(LAYER_NAMES.SAN_ZONES);

        if (!facilities) return;

        // Handle both old format (flat source array) and new format (facilities array with sources)
        if (Array.isArray(facilities) && facilities.length > 0 && facilities[0].sources) {
            // New format: array of facility objects
            facilities.forEach(fac => {
                if (!fac.sources) return;
                fac.sources.forEach(src => {
                    addSourceMarker(src, fac.type, fac.name);
                });
            });
        } else if (Array.isArray(facilities)) {
            // Legacy format: flat array of source objects
            facilities.forEach(src => {
                addSourceMarker(src, 'other', '');
            });
        }
    }

    function addReceptor(receptor) {
        if (!_map || !receptor.lat || !receptor.lng) return;

        const dot = L.circleMarker([receptor.lat, receptor.lng], {
            radius: 6,
            fillColor: '#8b5cf6',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        dot.bindTooltip(`<b>${receptor.name}</b> (${receptor.type})`, { permanent: false, direction: 'top' });
        dot.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            if (window.GeoMeteoWorkspace) GeoMeteoWorkspace.selectReceptor(receptor.id);
        });
        _layers[LAYER_NAMES.RECEPTORS].addLayer(dot);
    }

    function setFacilityBoundary(geojson) {
        if (!_map || !geojson) return;
        clearLayer(LAYER_NAMES.BOUNDARY);
        const poly = L.geoJSON(geojson, {
            style: { color: "#3b82f6", weight: 2, dashArray: "5, 5", fillOpacity: 0 }
        });
        _layers[LAYER_NAMES.BOUNDARY].addLayer(poly);
    }

    /* ==============================
     *  SANITARY ZONE HELPERS
     * ============================== */

    function getSanitaryRadius(cls) {
        switch(cls) {
            case 1: return 1000;
            case 2: return 500;
            case 3: return 300;
            case 4: return 100;
            case 5: return 50;
            default: return 0;
        }
    }

    function getSanitaryColor(cls) {
        switch(cls) {
            case 1: return '#dc2626';
            case 2: return '#ea580c';
            case 3: return '#ca8a04';
            case 4: return '#16a34a';
            case 5: return '#4b5563';
            default: return '#3b82f6';
        }
    }

    /* ==============================
     *  UTILITIES
     * ============================== */

    function enableClickPlacement(callback) {
        _clickCallback = callback;
        if (_map) {
            const container = document.getElementById(_map._container.id);
            if (container) container.style.cursor = 'crosshair';
        }
    }

    function invalidateSize() {
        if (_map) setTimeout(() => _map.invalidateSize(), 200);
    }

    function flyTo(lat, lng, zoom) {
        if (_map) _map.flyTo([lat, lng], zoom || 18);
    }

    async function fetchElevation(lat, lng) {
        try {
            const url = `https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lng}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK' && data.results && data.results.length > 0) {
                return data.results[0].elevation;
            }
            return null;
        } catch (e) {
            console.error("Elevation API failed", e);
            return null;
        }
    }

    function setGlobalDrawStyle(options) {
        if (!_map || !_map.pm) return;
        _map.pm.setPathOptions(options);
    }

    function enableDraw(shape) {
        if (!_map || !_map.pm) return;
        _map.pm.enableDraw(shape);
    }

    function disableDraw() {
        if (!_map || !_map.pm) return;
        _map.pm.disableDraw();
    }

    function addGeometry(geom, style, layerName) {
        if (!_map || !geom.geojson) return;
        const targetLayer = layerName || LAYER_NAMES.MANUAL;
        const layer = L.geoJSON(geom.geojson, {
            style: style || { color: '#3388ff', weight: 2 },
            pointToLayer: (feature, latlng) => {
                if (feature.properties && feature.properties.radius) {
                    return L.circle(latlng, { radius: feature.properties.radius });
                }
                return L.marker(latlng);
            }
        });
        layer.bindTooltip(geom.name || '\u041e\u0431\u044a\u0435\u043a\u0442');
        if (_layers[targetLayer]) {
            _layers[targetLayer].addLayer(layer);
        } else {
            _layers[LAYER_NAMES.MANUAL].addLayer(layer);
        }
    }

    return {
        init, destroy, getMap,
        clearLayer, toggleLayer, setLayerOpacity, addToLayer,
        createSourceIcon, addSourceMarker, refreshMarkers,
        addReceptor, setFacilityBoundary,
        getSanitaryRadius, getSanitaryColor,
        enableClickPlacement, invalidateSize, flyTo,
        fetchElevation, setGlobalDrawStyle, addGeometry,
        enableDraw, disableDraw,
        haversineDistance, // Exported haversine
        LAYER_NAMES, INTENSITY_COLORS, FACILITY_TYPE_ICONS,
        getIntensityLevel
    };
})();
