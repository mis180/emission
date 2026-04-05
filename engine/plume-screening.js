/**
 * plume-screening.js
 * Extracts plume math bounding box calculations and visualizations.
 */
const PlumeScreening = (() => {

    function runGaussianScreening(sourceId) {
        const state = ProjectStore.getState();
        const gmState = ProjectStore.getGeoMeteo();
        
        let source = null;
        state.facilities.forEach(f => {
            if(f.sources) {
                const s = f.sources.find(src => src.id == sourceId);
                if (s) source = s;
            }
        });

        if (!source) {
            console.error("Source not found for plume calculation");
            return;
        }

        const met = ProjectStore.getActiveMetDataset();
        if (!met) {
            alert("Сначала выберите или создайте метео-датасет во вкладке Метеорология.");
            return;
        }

        const Q = source.M || parseFloat(source.inputs?.emission_rate) || 1;
        const H = parseFloat(source.inputs?.release_height) || 10;
        const srcLat = source.lat || state.lat || 43.2;
        const srcLng = source.lng || state.lng || 76.9;
        
        const cleanSource = { lat: srcLat, lng: srcLng, Q: Q, H: H };
        
        const points = WeatherModule.runScreeningGrid(cleanSource, met, { x_max: 3000, step: 100 });

        let maxPoint = points.length > 0 ? points.reduce((m, p) => p.conc > m.conc ? p : m, points[0]) : null;
        let isopleths = [];
        
        if (maxPoint && maxPoint.conc > 0) {
            const maxC = maxPoint.conc;
            const targetColorOpacity = 0.5;
            const targetBorderOpacity = 1.0;
            const thresholds = [
                { level: 0.1, value: maxC * 0.1, label: '0.1 × Cmax', color: `rgba(16, 185, 129, ${targetColorOpacity})`, borderColor: `rgba(16, 185, 129, ${targetBorderOpacity})` },
                { level: 0.25, value: maxC * 0.25, label: '0.25 × Cmax', color: `rgba(234, 179, 8, ${targetColorOpacity})`, borderColor: `rgba(234, 179, 8, ${targetBorderOpacity})` },
                { level: 0.5, value: maxC * 0.5, label: '0.5 × Cmax', color: `rgba(249, 115, 22, ${targetColorOpacity})`, borderColor: `rgba(249, 115, 22, ${targetBorderOpacity})` },
                { level: 0.8, value: maxC * 0.8, label: '0.8 × Cmax', color: `rgba(239, 68, 68, ${targetColorOpacity})`, borderColor: `rgba(239, 68, 68, ${targetBorderOpacity})` }
            ];
            isopleths = WeatherModule.calculateIsopleths(cleanSource, met, thresholds);
        }

        ProjectStore.updateGeoMeteo({
            plume_enabled: true,
            plume_results: {
                source_id: sourceId,
                points: points, 
                isopleths: isopleths,
                wind_dir: met.dominant_direction
            }
        });

        visualizePlume(maxPoint, isopleths, source, met.dominant_direction);
        GeoMeteoWorkspace.switchTab('map');
    }

    function visualizePlume(maxPoint, isopleths, source, windDir) {
        if (!MapModule) return;
        MapModule.clearLayer('plume_contours');
        
        if (isopleths && isopleths.length > 0) {
            isopleths.forEach(iso => {
                const polygon = L.polygon(iso.points, {
                    color: iso.borderColor,
                    weight: 2,
                    fillColor: iso.fillColor,
                    fillOpacity: 1, 
                    smoothFactor: 1
                });
                polygon.bindTooltip(`Концентрация: ${iso.label}`, { direction: 'center', sticky: true });
                MapModule.addToLayer('plume_contours', polygon);
            });
        }
        
        if (maxPoint && maxPoint.conc > 0) {
            const starMarker = L.marker([maxPoint.lat, maxPoint.lng], {
                icon: L.divIcon({
                    className: 'cmax-marker',
                    html: `<div class="cmax-star">★</div>
                           <div class="cmax-label">Cmax: ${maxPoint.conc.toFixed(4)}</div>`,
                    iconSize: [80, 40],
                    iconAnchor: [40, 20]
                })
            });
            MapModule.addToLayer('plume_contours', starMarker);
        }

        if (source && windDir) {
            const angle = WeatherModule.getDegFromSector(windDir);
            const arrowMarker = L.marker([source.lat, source.lng], {
                icon: L.divIcon({
                    className: 'wind-arrow-marker',
                    html: `<div class="wind-arrow-icon" style="transform: rotate(${angle}deg); font-size: 24px; color: #1e293b; text-shadow: 0 0 4px white;">⬇</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                })
            });
            MapModule.addToLayer('plume_contours', arrowMarker);
        }
        
        MapModule.toggleLayer('plume_contours', true);
    }

    return {
        runGaussianScreening,
        visualizePlume
    };
})();
