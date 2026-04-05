/**
 * geo-meteo-workspace.js — Geo/Meteo Workspace Orchestrator
 * Manages GIS layers, meteorology data visualization, and scenario screening.
 */
const GeoMeteoWorkspace = (() => {
    let _activeTab = 'map';
    let _mapInstance = null;
    let _layerGroups = {};
    let _activeDrawLayer = null;
    let _selectedPlumeSourceId = null;
    let _currentContext = null; // { type: 'facility'|'source', id: string }
    const LAYER_CONFIG = {
        sources: { label: 'Источники', icon: '📍', canDraw: true, canCalc: false, drawingShape: 'Marker' },
        sanitary_zones: { label: 'Сан. зоны', icon: '⭕', canDraw: true, canCalc: false, drawingShape: 'Circle' },
        receptors: { label: 'Рецепторы', icon: '🏠', canDraw: true, canCalc: false, drawingShape: 'Marker' },
        boundary: { label: 'Граница объекта', icon: '📐', canDraw: true, canCalc: false, drawingShape: 'Polygon' },
        plume: { label: 'Контуры рассеивания', icon: '💨', canDraw: false, canCalc: true }
    };

    // --- Core Lifecycle ---

    function open() {
        document.getElementById('geo-meteo-workspace').style.display = 'flex';
        // Hide other main dashboard views if necessary
        // Update project name in top bar
        const state = ProjectStore.getState();
        document.getElementById('gm-project-name').textContent = state.name || "Новый проект";
        
        initMap();
        renderLocationSetup();
        refreshLayersPanel();
        switchTab(_activeTab);
    }

    function openWithContext(type, id) {
        _currentContext = { type, id };
        open();
        
        // Context-aware logic
        if (type === 'facility') {
            const fac = ProjectStore.getFacility(id);
            if (fac && fac.lat && fac.lng) {
                MapModule.flyTo(fac.lat, fac.lng, 16);
            }
            // Auto-select boundary layer for drawing if opening a facility
            _activeDrawLayer = 'boundary';
            refreshLayersPanel();
        } else if (type === 'source') {
            const sources = ProjectStore.getAllFacilities().flatMap(f => f.sources);
            const src = sources.find(s => s.id === id || s.id == id);
            if (src && src.lat && src.lng) {
                MapModule.flyTo(src.lat, src.lng, 18);
                selectSource(id);
            }
        }
    }

    function close() {
        document.getElementById('geo-meteo-workspace').style.display = 'none';
    }

    // --- Tab Switching ---

    function switchTab(tabId) {
        _activeTab = tabId;
        
        // Update UI buttons
        document.querySelectorAll('.gm-tab').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`gm-tab-${tabId}`).classList.add('active');
        
        // Update panes
        document.querySelectorAll('.gm-pane').forEach(pane => pane.style.display = 'none');
        document.getElementById(`gm-pane-${tabId}`).style.display = 'block';
        
        // Specific tab logic
        if (tabId === 'map') {
            if (MapModule) MapModule.invalidateSize();
        } else if (tabId === 'meteorology') {
            renderMeteorologyTab();
        } else if (tabId === 'sanitary') {
            renderSanitaryZoneTab();
        } else if (tabId === 'scenarios') {
            renderScenariosTab();
        } else if (tabId === 'handoff') {
            renderHandoffTab();
        }
    }

    // --- Map Implementation ---

    function initMap() {
        if (!MapModule) return;
        const state = ProjectStore.getState();
        MapModule.init('gm-map-container', state.lat, state.lng);
        refreshAllMapLayers();
    }

    function refreshAllMapLayers() {
        if (!MapModule) return;
        const state = ProjectStore.getState();
        const gmState = ProjectStore.getGeoMeteo();
        
        // Sources layer — pass full facility objects for custom icons
        MapModule.refreshMarkers(state.facilities);
        
        // Receptors layer
        MapModule.clearLayer('receptors');
        gmState.receptors.forEach(r => MapModule.addReceptor(r));
        
        // Facility Boundaries layer
        MapModule.clearLayer('boundary');
        state.facilities.forEach(fac => {
            if (fac.boundary) {
                // Use a marker or color to distinguish if it's the "active" facility? 
                // For now, draw all.
                const style = (fac.id === _currentContext?.id) 
                    ? { color: '#2563eb', weight: 3, fillOpacity: 0.1 } 
                    : { color: '#94a3b8', weight: 2, dashArray: '5, 5', fillOpacity: 0 };
                
                MapModule.addGeometry({ name: fac.name, geojson: fac.boundary }, style, 'boundary');
            }
        });
        
        // Legacy Boundary (if still exists)
        if (gmState.facility_boundary) MapModule.setFacilityBoundary(gmState.facility_boundary);
        
        // Manual Geometries
        MapModule.clearLayer('manual_geometries'); 
        gmState.geometries.forEach(g => {
            const style = gmState.layer_styles[g.layerId] || { color: '#666' };
            MapModule.addGeometry(g, style);
        });
        
        // Restore Plume if exists
        if (gmState.plume_enabled && gmState.plume_results) {
            const r = gmState.plume_results;
            let src = null;
            state.facilities.forEach(f => {
                if(f.sources) {
                    const s = f.sources.find(s => s.id === r.source_id);
                    if(s) src = s;
                }
            });
            const maxP = (r.points && r.points.length > 0) ? r.points.reduce((m,p) => p.conc > m.conc ? p : m, r.points[0]) : null;
            visualizePlume(maxP, r.isopleths, src, r.wind_dir);
        }
        
        refreshReceptorList();
    }


    function renderLocationSetup() {
        const container = document.getElementById('gm-location-setup');
        if (!container) return;
        
        const state = ProjectStore.getState();
        const lat = state.lat ? state.lat.toFixed(4) : '—';
        const lng = state.lng ? state.lng.toFixed(4) : '—';
        
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div style="font-size:0.75rem; color:#64748b; font-weight:600;">
                    Текущие координаты: <span style="color:#0f172a;">${lat}, ${lng}</span>
                </div>
                <!-- Address Search Input -->
                <div style="display:flex; gap:4px; position:relative;">
                    <input type="text" id="gm-address-search-input" 
                           placeholder="Поиск адреса или города..." 
                           style="flex:1; font-size:0.8rem; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0; outline:none;"
                           onkeypress="if(event.key === 'Enter') GeoMeteoWorkspace.searchAddress(this.value)">
                    <button class="btn btn-primary" onclick="GeoMeteoWorkspace.searchAddress(document.getElementById('gm-address-search-input').value)" 
                            style="padding:8px 12px; display:flex; align-items:center; justify-content:center;">
                        🔍
                    </button>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary" onclick="GeoMeteoWorkspace.enableMapLocationPick()" style="flex:1; font-size:0.7rem; padding:8px;">📍 Указать на карте</button>
                </div>
            </div>
        `;
    }

    /**
     * Search address using Nominatim (OpenStreetMap) API.
     * Context-aware: Updates Facility if in facility context, otherwise Project.
     */
    async function searchAddress(query) {
        if (!query || query.trim().length < 3) {
            showToast("Введите минимум 3 символа для поиска", "warning");
            return;
        }

        const btn = document.querySelector('button[onclick*="searchAddress"]');
        const input = document.getElementById('gm-address-search-input');
        
        if (btn) btn.innerHTML = "⏳";
        
        try {
            // Encode query and restrict to Kazakhstan
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=kz&limit=1`;
            const res = await fetch(url, {
                headers: { 'Accept-Language': 'ru,kk,en' }
            });
            const data = await res.json();

            if (data && data.length > 0) {
                const first = data[0];
                const lat = parseFloat(first.lat);
                const lng = parseFloat(first.lon);

                // Context-aware update
                if (_currentContext && _currentContext.type === 'facility') {
                    ProjectStore.updateFacility(_currentContext.id, { lat, lng });
                    showToast(`Координаты объекта обновлены: ${first.display_name}`, "success");
                } else if (_currentContext && _currentContext.type === 'facility-form') {
                    // Update the form inputs if we are in the creation form
                    const latInput = document.getElementById('fac-form-lat');
                    const lngInput = document.getElementById('fac-form-lng');
                    if (latInput) latInput.value = lat.toFixed(6);
                    if (lngInput) lngInput.value = lng.toFixed(6);
                    showToast("Координаты подставлены в форму", "success");
                } else {
                    ProjectStore.setCoordinates(lat, lng);
                    showToast(`Координаты проекта обновлены: ${first.display_name}`, "success");
                }

                if (MapModule) MapModule.flyTo(lat, lng, 15);
                renderLocationSetup();
            } else {
                showToast("Адрес не найден в Казахстане", "warning");
            }
        } catch (e) {
            console.error("Geocoding error:", e);
            showToast("Ошибка сервиса геокодирования", "danger");
        } finally {
            if (btn) btn.innerHTML = "🔍";
        }
    }

    function enableMapLocationPick() {
        if (MapModule) {
            const isFacilityForm = _currentContext && _currentContext.type === 'facility-form';
            const toastMsg = isFacilityForm 
                ? 'Кликните на карту, чтобы выбрать координаты объекта' 
                : 'Кликните на карту, чтобы установить координаты проекта';
            
            if (typeof showToast !== 'undefined') showToast(toastMsg, 'info');

            MapModule.enableClickPlacement((lat, lng) => {
                if (isFacilityForm) {
                    const latInput = document.getElementById('fac-form-lat');
                    const lngInput = document.getElementById('fac-form-lng');
                    if (latInput) latInput.value = lat.toFixed(6);
                    if (lngInput) lngInput.value = lng.toFixed(6);
                } else {
                    ProjectStore.setCoordinates(lat, lng);
                    renderLocationSetup();
                    // Legacy fallback
                    const latInput = document.getElementById('proj-lat');
                    if (latInput) latInput.value = lat.toFixed(6);
                    const lngInput = document.getElementById('proj-lng');
                    if (lngInput) lngInput.value = lng.toFixed(6);
                }
                
                if (typeof showToast !== 'undefined') showToast('Координаты выбраны', 'success');
            });
        }
    }

    function refreshLayersPanel() {
        const list = document.getElementById('gm-layers-list');
        if (!list) return;

        const gmState = ProjectStore.getGeoMeteo();
        const sources = ProjectStore.getAllFacilities().flatMap(f => f.sources);
        
        list.innerHTML = Object.entries(LAYER_CONFIG).map(([id, cfg]) => {
            let extraUI = '';
            
            if (id === 'plume') {
                extraUI = `
                    <div style="margin-top:6px; background:white; padding:8px; border-radius:6px; border:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; color:#64748b; margin-bottom:4px;">Источник для расчета:</div>
                        <select id="plume-source-select" onchange="GeoMeteoWorkspace.setSelectedPlumeSource(this.value)" 
                                style="width:100%; font-size:0.75rem; padding:4px; border-radius:4px; border:1px solid #cbd5e1; margin-bottom:8px;">
                            <option value="">-- Выберите --</option>
                            ${sources.map(s => `<option value="${s.id}" ${s.id == _selectedPlumeSourceId ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary btn-block" onclick="GeoMeteoWorkspace.calculateSelectedPlume()" style="font-size:0.7rem; padding:6px;">
                            Рассчитать
                        </button>
                    </div>
                `;
            }

            return `
                <div class="gm-layer-container" style="margin-bottom:8px;">
                    <div class="gm-layer-row ${id === _activeDrawLayer ? 'active' : ''}" style="display:flex; align-items:center; gap:8px; padding:6px; border-radius:6px; ${id === _activeDrawLayer ? 'background:#eff6ff;' : ''}">
                        <input type="checkbox" checked onchange="GeoMeteoWorkspace.toggleLayer('${id}', this.checked)" style="width:14px; height:14px;">
                        <span style="font-size:1.2rem; cursor:help;" title="${cfg.label}">${cfg.icon}</span>
                        <span style="flex:1; font-size:0.85rem; font-weight:500;">${cfg.label}</span>
                        
                        <input type="color" value="${gmState.layer_styles[id]?.color || '#000000'}" 
                               onchange="GeoMeteoWorkspace.updateLayerColor('${id}', this.value)"
                               style="width:20px; height:20px; padding:0; border:none; border-radius:4px; cursor:pointer; background:none;">
                        
                        ${cfg.canDraw ? `
                            <button class="btn btn-secondary ${id === _activeDrawLayer ? 'active' : ''}" 
                                    onclick="GeoMeteoWorkspace.setActiveDrawLayer('${id}')" 
                                    style="padding:4px 8px; font-size:0.7rem; border-color:${id === _activeDrawLayer ? '#3b82f6' : '#e2e8f0'}">
                                ✏️
                            </button>
                        ` : ''}
                    </div>
                    ${extraUI}
                </div>
            `;
        }).join('');
    }

    function setSelectedPlumeSource(id) {
        _selectedPlumeSourceId = id;
    }

    function calculateSelectedPlume() {
        if (!_selectedPlumeSourceId) {
            showToast("Сначала выберите источник в выпадающем списке слоя рассеивания.", "warning");
            return;
        }
        PlumeScreening.runGaussianScreening(_selectedPlumeSourceId);
    }

    function setActiveDrawLayer(layerId) {
        if (_activeDrawLayer === layerId) {
            _activeDrawLayer = null;
            if (MapModule) {
                MapModule.setGlobalDrawStyle({});
                MapModule.disableDraw();
            }
        } else {
            _activeDrawLayer = layerId;
            const cfg = LAYER_CONFIG[layerId];
            const gmState = ProjectStore.getGeoMeteo();
            const style = gmState.layer_styles[layerId] || { color: '#3388ff' };
            if (MapModule) {
                MapModule.setGlobalDrawStyle(style);
                if (cfg && cfg.drawingShape) {
                    MapModule.enableDraw(cfg.drawingShape);
                    if (typeof showToast !== 'undefined') showToast(`Инструмент: ${cfg.label}. Кликните на карту.`, 'info');
                }
            }
        }
        refreshLayersPanel();
    }

    function updateLayerColor(layerId, color) {
        ProjectStore.updateLayerStyle(layerId, { color });
        if (_activeDrawLayer === layerId && MapModule) {
            MapModule.setGlobalDrawStyle(ProjectStore.getGeoMeteo().layer_styles[layerId]);
        }
        refreshAllMapLayers();
        refreshLayersPanel();
    }

    function refreshReceptorList() {
        const receptors = ProjectStore.getAllReceptors();
        const listContainer = document.getElementById('gm-receptor-list');
        const countSpan = document.getElementById('gm-receptor-count');
        
        if (countSpan) countSpan.textContent = receptors.length;
        if (!listContainer) return;

        listContainer.innerHTML = receptors.map(r => `
            <div class="gm-receptor-item" onclick="GeoMeteoWorkspace.selectReceptor('${r.id}')" style="padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; cursor:pointer; background:white; font-size:0.85rem;">
                <div style="font-weight:600;">${r.name}</div>
                <div style="color:#64748b; font-size:0.75rem;">${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}</div>
            </div>
        `).join('');
    }

    function selectReceptor(id) {
        const r = ProjectStore.getAllReceptors().find(rec => rec.id === id);
        if (r) renderDetailPanel('receptor', r);
    }

    function renderDetailPanel(type, data) {
        const panel = document.getElementById('gm-detail-panel');
        if (!panel) return;
        panel.style.display = 'block';
        const closeBtnHtml = `<button onclick="document.getElementById('gm-detail-panel').style.display='none';" style="position:absolute; top:24px; right:24px; background:none; border:none; font-size:1.5rem; color:#64748b; cursor:pointer; line-height:1;">&times;</button>`;

        if (type === 'receptor') {
            panel.innerHTML = `
                ${closeBtnHtml}
                <div class="gm-detail-header" style="margin-bottom:20px; padding-right:20px;">
                    <h3 style="margin:0;">${data.name}</h3>
                    <span class="badge" style="background:#8b5cf6; color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:700;">РЕЦЕПТОР</span>
                </div>
                <div class="gm-detail-body">
                    <div class="input-group">
                        <label>Название</label>
                        <input type="text" value="${data.name}" onchange="GeoMeteoWorkspace.updateReceptor('${data.id}', {name: this.value})" class="cart-input" style="width:100%;">
                    </div>
                    <div class="input-group mt-3">
                        <label>Тип</label>
                        <select onchange="GeoMeteoWorkspace.updateReceptor('${data.id}', {type: this.value})" class="cart-input" style="width:100%;">
                            <option value="residential" ${data.type === 'residential' ? 'selected' : ''}>Жилая зона</option>
                            <option value="sanitary" ${data.type === 'sanitary' ? 'selected' : ''}>Охранная зона</option>
                            <option value="other" ${data.type === 'other' ? 'selected' : ''}>Прочее</option>
                        </select>
                    </div>
                    <div class="input-group mt-3">
                        <label>Высота рельефа (Z)</label>
                        <div style="display:flex; gap:8px;">
                            <input type="number" value="${data.elevation || ''}" onchange="GeoMeteoWorkspace.updateReceptor('${data.id}', {elevation: parseFloat(this.value)})" class="cart-input" style="flex:1;">
                            <button class="btn btn-secondary" onclick="GeoMeteoWorkspace.fetchReceptorElevation('${data.id}')" style="padding:4px 8px; font-size:0.7rem;">📡 API</button>
                        </div>
                    </div>
                    <div class="mt-4">
                        <button class="btn btn-secondary btn-block btn-danger" onclick="GeoMeteoWorkspace.deleteReceptor('${data.id}')" style="background:#fee2e2; color:#ef4444; border-color:#fca5a5;">Удалить</button>
                    </div>
                </div>
            `;
        } else if (type === 'source') {
            panel.innerHTML = `
                ${closeBtnHtml}
                <div class="gm-detail-header" style="margin-bottom:20px; padding-right:20px;">
                    <h3 style="margin:0;">${data.name}</h3>
                    <span class="badge" style="background:#4f46e5; color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:700;">ИСТОЧНИК ИВ</span>
                </div>
                <div class="gm-detail-body">
                    <div style="font-size:0.85rem; color:#64748b; margin-bottom:16px;">
                        <div>Номер: ${data.source_number}</div>
                        <div>Методика: ${data.methodic_name || '—'}</div>
                        <div>Выброс (G): ${data.G?.toFixed(4) || 0} т/год</div>
                        <div style="margin-top:4px; font-weight:600; color:#0d9488;">Высота рельефа: ${data.elevation ? data.elevation.toFixed(1) + ' м' : 'не определена'}</div>
                    </div>
                    <hr class="gm-hr">
                    <h4 class="section-label" style="font-size:0.8rem;">Анализ рассеивания</h4>
                    <p style="font-size:0.75rem; color:#64748b; margin-bottom:12px;">
                        Построить ориентировочный Гауссовый шлейф на основе текущих метеоусловий.
                    </p>
                    <button class="btn btn-primary btn-block" onclick="GeoMeteoWorkspace.runGaussianScreening('${data.id}')" style="font-size:0.8rem; padding:10px;">
                        🚀 Расчет шлейфа
                    </button>
                    <p style="font-size:0.65rem; color:#94a3b8; font-style:italic; margin-top:8px;">
                        * Только для предварительной оценки. Не является нормативным расчетом.
                    </p>
                </div>
            `;
        }
    }

    function selectSource(id) {
        let source = null;
        ProjectStore.getAllFacilities().forEach(fac => {
            const s = fac.sources.find(src => src.id === id || src.id == id);
            if (s) source = s;
        });
        if (source) {
            renderDetailPanel('source', source);
            _selectedPlumeSourceId = id;
            refreshLayersPanel();
        }
    }

    function updateReceptor(id, data) {
        ProjectStore.updateReceptor(id, data);
        refreshAllMapLayers();
    }

    function deleteReceptor(id) {
        if (confirm("Удалить этот рецептор?")) {
            ProjectStore.removeReceptor(id);
            const panel = document.getElementById('gm-detail-panel');
            if (panel) panel.style.display = 'none';
            refreshAllMapLayers();
        }
    }

    function toggleLayer(layerName, visible) {
        if (MapModule) MapModule.toggleLayer(layerName, visible);
    }

    function enableReceptorPlacement() {
        if (MapModule) {
            MapModule.enableClickPlacement(async (lat, lng) => {
                const name = prompt("Название рецептора:", "Рецептор №" + (ProjectStore.getAllReceptors().length + 1));
                if (name) {
                    const elevation = await MapModule.fetchElevation(lat, lng);
                    ProjectStore.addReceptor({ name, lat, lng, elevation, type: "residential" });
                    refreshAllMapLayers();
                }
            });
        }
    }

    async function fetchReceptorElevation(id) {
        const r = ProjectStore.getAllReceptors().find(rec => rec.id === id);
        if (r) {
            const el = await MapModule.fetchElevation(r.lat, r.lng);
            if (el !== null) {
                ProjectStore.updateReceptor(id, { elevation: el });
                renderDetailPanel('receptor', { ...r, elevation: el });
            }
        }
    }

    function handleGeomanCreate(shape, geojson) {
        if (!_activeDrawLayer) {
            showToast("Сначала выберите активный слой для рисования (иконка ✏️ в панели слоев).", "warning");
            return;
        }

        let name = "";
        const layerId = _activeDrawLayer;

        if (layerId === 'sources') {
            name = prompt("Имя источника:", "Источник " + Date.now());
            if (name) {
                if (geojson.geometry.type === 'Point') {
                    const [lng, lat] = geojson.geometry.coordinates;
                    if (_currentContext?.type === 'facility') {
                        ProjectStore.addSourceToFacility(_currentContext.id, { name, lat, lng });
                    } else {
                        ProjectStore.addSource({ name, lat, lng });
                    }
                } else {
                    ProjectStore.addGeometry({ name, layerId, shape, geojson });
                }
            }
        } else if (layerId === 'boundary') {
            if (_currentContext?.type === 'facility') {
                ProjectStore.setFacilityBoundary(_currentContext.id, geojson);
            } else {
                name = prompt("Имя границы:", "Граница " + Date.now());
                ProjectStore.addGeometry({ name, layerId, shape, geojson });
            }
        } else if (layerId === 'receptors') {
            name = prompt("Имя рецептора:", "Рецептор " + Date.now());
            if (name) {
                const [lng, lat] = (geojson.geometry.type === 'Point') ? geojson.geometry.coordinates : [null, null];
                if (lat) ProjectStore.addReceptor({ name, lat, lng, type: 'residential' });
                else ProjectStore.addGeometry({ name, layerId, shape, geojson });
            }
        } else if (layerId === 'sanitary_zones') {
            if (shape === 'Circle') {
                const [lng, lat] = geojson.geometry.coordinates;
                const radius = geojson.properties.radius;
                if (_currentContext?.type === 'facility') {
                    name = "СЗЗ объекта";
                    ProjectStore.updateFacility(_currentContext.id, { sanitary_zone: geojson, sanitary_radius_m: radius });
                } else {
                    name = prompt("Имя сан. зоны:", "Сан. зона " + Date.now());
                    ProjectStore.addGeometry({ name, layerId, shape, geojson });
                }
            } else {
                name = prompt("Имя сан. зоны:", "Сан. зона " + Date.now());
                ProjectStore.addGeometry({ name, layerId, shape, geojson });
            }
        } else {
            name = prompt(`Имя для объекта ${LAYER_CONFIG[layerId].label}:`, LAYER_CONFIG[layerId].label + " " + Date.now());
            if (name) ProjectStore.addGeometry({ name, layerId, shape, geojson });
        }
        
        refreshAllMapLayers();
    }

    function promptPlumeCalculation() {
        const sources = ProjectStore.getAllFacilities().flatMap(f => f.sources);
        if (sources.length === 0) {
            showToast("Сначала создайте хотя бы один источник.", "warning");
            return;
        }
        // Simplified: run for first or current source
        const id = sources[0].id;
        runGaussianScreening(id);
    }

    function enableBoundaryDraw() {
        showToast("Функция рисования границы будет доступна в следующем обновлении. Пока используйте координаты из ProjectStore.", "info");
    }

    // --- Meteorology Implementation ---

    function renderMeteorologyTab() {
        const gmState = ProjectStore.getGeoMeteo();
        const activeId = gmState.active_met_dataset_id;
        const dataset = gmState.met_datasets.find(d => d.id === activeId);
        
        renderMetDatasetList();
        
        const detail = document.getElementById('gm-met-detail');
        if (!detail) return; // Silent return if panel is not currently rendered

        if (dataset) {
            renderMetDetail(dataset);
        } else {
            detail.innerHTML = '<div class="gm-empty-state"><p>Выберите или создайте метео-датасет</p></div>';
        }
    }

    function renderMetDatasetList() {
        const datasets = ProjectStore.getGeoMeteo().met_datasets;
        const list = document.getElementById('gm-met-dataset-list');
        if (!list) return;

        list.innerHTML = datasets.map(d => `
            <div class="gm-dataset-item ${d.id === ProjectStore.getGeoMeteo().active_met_dataset_id ? 'active' : ''}" 
                 onclick="GeoMeteoWorkspace.setActiveMetDataset('${d.id}')"
                 style="padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; cursor:pointer; background:white;">
                <div style="font-weight:600;">${d.name}</div>
                <div style="color:#64748b; font-size:0.75rem;">${d.source_type === 'regional' ? 'Из базы (СП)' : 'OpenMeteo'}</div>
            </div>
        `).join('');
    }

    function setActiveMetDataset(id) {
        ProjectStore.setActiveMetDataset(id);
        renderMeteorologyTab();
    }

    function renderMetDetail(dataset) {
        // UI for detailed met data
        const detail = document.getElementById('gm-met-detail');
        if (!detail) return;

        // Ensure elements exist (we added them to index.html)
        // ... grid is already in index.html, we just need to trigger draws
        
        setTimeout(() => {
            if (dataset.wind_rose_pct) {
                WindRoseUI.renderWindRose('gm-wind-rose-canvas', dataset.wind_rose_pct, dataset.calm_pct);
            }
            if (dataset.stability_freq) {
                WindRoseUI.renderStabilityChart('gm-stability-canvas', dataset.stability_freq);
            }
            if (dataset.wind_speed_profile) {
                WindRoseUI.renderProfileChart('gm-profile-canvas', dataset.wind_speed_profile);
            }
        }, 100);
    }




    async function fetchOpenMeteo() {
        const state = ProjectStore.getState();
        if (!state.lat || !state.lng) {
            showToast("Координаты проекта не заданы. Установите локацию перед загрузкой метео.", "warning");
            return;
        }

        const btn = document.querySelector('button[onclick="GeoMeteoWorkspace.fetchOpenMeteo()"]');
        if (btn) {
            btn.dataset.original = btn.innerHTML;
            btn.innerHTML = "⏳ Загрузка...";
            btn.disabled = true;
        }

        try {
            const date = new Date();
            const toStr = new Date(date).toISOString().split('T')[0];
            date.setMonth(date.getMonth() - 1);
            const fromStr = date.toISOString().split('T')[0];

            let rawData;
            try {
                rawData = await WeatherModule.fetchHistoricalRange(state.lat, state.lng, fromStr, toStr);
            } catch (e) {
                console.warn("OpenMeteo API unreachable, falling back to synthetic data", e);
            }
            
            if (rawData && rawData.hourly && rawData.hourly.windspeed_10m) {
                const wind_rose = WeatherModule.aggregateToWindRose(rawData, state.lat);
                const stability_freq = wind_rose.stability_freq;
                
                // Real temp profile from OpenMeteo if available
                let temp_profile = [];
                if (rawData.hourly.temperature_2m) {
                    // Aggregate hourly temp to monthly average
                    const temps = rawData.hourly.temperature_2m;
                    const months = rawData.hourly.time.map(t => new Date(t).getMonth());
                    const monthlySum = Array(12).fill(0);
                    const monthlyCount = Array(12).fill(0);
                    
                    temps.forEach((t, i) => {
                        monthlySum[months[i]] += t;
                        monthlyCount[months[i]]++;
                    });
                    
                    temp_profile = monthlySum.map((v, i) => ({
                        month: i + 1,
                        avg: monthlyCount[i] > 0 ? (v / monthlyCount[i]) : 15
                    }));
                } else {
                    temp_profile = Array(12).fill(0).map((_, i) => ({ month: i+1, avg: 10 + Math.floor(Math.random()*15) }));
                }
                
                ProjectStore.addMetDataset({
                    name: `OpenMeteo (${fromStr} - ${toStr})`,
                    source_type: 'open-meteo',
                    data_quality: 'measured',
                    wind_rose_pct: wind_rose.wind_rose_pct || {},
                    calm_pct: wind_rose.calm_pct || 0,
                    dominant_direction: wind_rose.dominant_direction || 'N',
                    dominant_stability: wind_rose.dominant_stability || 'D',
                    wind_speed_avg_ms: wind_rose.wind_speed_avg_ms || 3.5,
                    stability_freq: stability_freq,
                    temp_profile: temp_profile
                });
                renderMeteorologyTab();
                showToast("Данные OpenMeteo успешно загружены!", "success");
            } else {
                throw new Error("Invalid API format returned from OpenMeteo.");
            }
        } catch (e) {
            console.error(e);
            console.warn("Generating Synthetic Meteo Data due to API failure");
            
            const syntheticWindRose = {
                "N": 15, "NE": 5, "E": 10, "SE": 20, "S": 5, "SW": 25, "W": 10, "NW": 10
            };
            const stability_freq = { "A": 5, "B": 20, "C": 25, "D": 35, "E": 10, "F": 5 };
            const temp_profile = Array(12).fill(0).map((_, i) => ({ month: i+1, avg: 5 + i }));
            
            ProjectStore.addMetDataset({
                name: `Синтетические данные (Офлайн Резерв)`,
                source_type: 'synthetic',
                data_quality: 'synthetic',
                wind_rose_pct: syntheticWindRose,
                calm_pct: 12.5,
                dominant_direction: 'SW',
                dominant_stability: 'D',
                wind_speed_avg_ms: 4.2,
                stability_freq: stability_freq,
                temp_profile: temp_profile
            });
            renderMeteorologyTab();
            showToast("Использованы синтетические данные (сгенерировано), так как API недоступно или лимит исчерпан.", "warning");
        } finally {
            if (btn) {
                btn.innerHTML = btn.dataset.original || "☁️ Загрузить метео";
                btn.disabled = false;
            }
        }
    }

    // --- Sanitary Zone Implementation ---

    function renderSanitaryZoneTab() {
        const gmState = ProjectStore.getGeoMeteo();
        const receptors = ProjectStore.getAllReceptors();
        const facilities = ProjectStore.getAllFacilities();
        const content = document.getElementById('gm-sanitary-content');
        if (!content) return;

        const conflicts = [];

        receptors.forEach(r => {
            facilities.forEach(fac => {
                fac.sources.forEach(src => {
                    const radius = MapModule.getSanitaryRadius(src.inputs?.sanitary_class);
                    if (radius > 0) {
                        const dist = MapModule.haversineDistance({lat: r.lat, lng: r.lng}, {lat: src.lat || fac.lat, lng: src.lng || fac.lng});
                        if (dist < radius) {
                            conflicts.push({
                                receptor: r.name,
                                source: src.name,
                                facility: fac.name,
                                distance: dist,
                                radius: radius,
                                severity: 'high'
                            });
                        }
                    }
                });
            });
        });

        let html = `
            <div style="margin-bottom: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; display:flex; align-items:center; gap:16px;">
                <label style="font-weight:600; font-size: 0.9rem;">Прозрачность сан. зон:</label>
                <input type="range" id="sanitary-opacity-slider" min="0" max="10" value="1" style="flex:1; max-width: 200px;" 
                       oninput="if(window.MapModule) MapModule.setLayerOpacity('sanitary_zones', this.value)">
                <button class="btn btn-secondary" onclick="GeoMeteoWorkspace.switchTab('map');" style="margin-left:auto;">🌍 Посмотреть зоны на карте</button>
            </div>
        `;

        if (conflicts.length === 0) {
            html += '<div class="badge badge-success" style="background:#10b981; color:white; padding:12px; border-radius:8px;">Нарушений санитарных разрывов не обнаружено.</div>';
            content.innerHTML = html;
        } else {
            html += `
                <div class="badge badge-danger" style="background:#ef4444; color:white; padding:12px; border-radius:8px; margin-bottom:16px;">
                    Обнаружено конфликтов: ${conflicts.length}
                </div>
                <table class="results-table">
                    <thead><tr><th>Рецептор</th><th>Источник</th><th>Объект</th><th>Расстояние</th><th>Норматив</th></tr></thead>
                    <tbody>
                        ${conflicts.map(c => `
                            <tr>
                                <td><b>${c.receptor}</b></td>
                                <td>${c.source}</td>
                                <td>${c.facility}</td>
                                <td style="color:#ef4444; font-weight:600;">${c.distance.toFixed(0)} м</td>
                                <td>${c.radius} м</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }



    // --- Scenarios Implementation ---

    function renderScenariosTab() {
        const gmState = ProjectStore.getGeoMeteo();
        const content = document.getElementById('gm-scenarios-content');
        if (!content) return;

        const scenarios = ProjectStore.getAllScenarios();

        content.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h4 style="margin:0;">Сценарии развития</h4>
                <button class="btn btn-primary" onclick="GeoMeteoWorkspace.addScenarioPrompt()">💾 Сохранить Текущий как Сценарий</button>
            </div>
            <div id="gm-scenario-list" class="scenario-grid"></div>
            <div id="gm-scenario-comparison" style="margin-top:32px; display:none;"></div>
        `;

        const list = document.getElementById('gm-scenario-list');
        if (!list) return;

        if (scenarios.length === 0) {
            list.innerHTML = '<div class="gm-empty-state"><p>У вас еще нет сохраненных сценариев. Сохраните текущее состояние проекта для сравнения в будущем.</p></div>';
            return;
        }

        list.innerHTML = scenarios.map(s => `
            <div class="scenario-card" style="position:relative;">
                <h4 style="margin-right:30px;">${escapeHTML(s.name)}</h4>
                <p style="font-size:0.75rem; color:#64748b; margin-bottom:12px;">Создан: ${new Date(s.timestamp).toLocaleString()}</p>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary btn-block" style="font-size:0.75rem; padding:6px;" onclick="GeoMeteoWorkspace.compareScenario('${s.id}')">📊 Сравнить с текущим</button>
                    <button class="btn-icon-only" onclick="GeoMeteoWorkspace.deleteScenario('${s.id}')" style="background:#fee2e2; color:#ef4444; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    function setActiveScenario(id) {
        ProjectStore.updateGeoMeteo({ active_scenario_id: id });
        renderScenariosTab();
    }

    function addScenarioPrompt() {
        const name = prompt("Название сценария:", "Сценарий " + new Date().toLocaleDateString());
        if (name) {
            ProjectStore.saveScenario(name);
            renderScenariosTab();
            showToast('Сценарий успешно сохранен', 'success');
        }
    }

    function deleteScenario(id) {
        if (confirm('Удалить этот сценарий?')) {
            ProjectStore.removeScenario(id);
            renderScenariosTab();
        }
    }

    function compareScenario(scenarioId) {
        const scenarios = ProjectStore.getAllScenarios();
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;

        const currentState = ProjectStore.getState();
        const currentTotals = ProjectStore.getProjectTotals();
        
        // Calculate scenario totals
        // For simplicity, we assume scenario.facilities has the same structure
        const scenarioTotals = calculateTotalsFromFacilities(scenario.facilities);

        const compDiv = document.getElementById('gm-scenario-comparison');
        compDiv.style.display = 'block';
        compDiv.scrollIntoView({ behavior: 'smooth' });

        compDiv.innerHTML = `
            <div class="results-card" style="background:white; border:2px solid #4f46e5;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h4 style="margin:0; color:#1e293b;">Сравнение: Текущий vs ${escapeHTML(scenario.name)}</h4>
                    <button class="btn-icon-only" onclick="this.parentElement.parentElement.parentElement.style.display='none'">✕</button>
                </div>
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Параметр</th>
                            <th>Текущий</th>
                            <th>${escapeHTML(scenario.name)}</th>
                            <th>Разница</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Всего выбросов (М, г/с)</td>
                            <td>${currentTotals.totalM.toFixed(4)}</td>
                            <td>${scenarioTotals.totalM.toFixed(4)}</td>
                            <td style="color:${currentTotals.totalM > scenarioTotals.totalM ? 'red' : 'green'}">${(currentTotals.totalM - scenarioTotals.totalM).toFixed(4)}</td>
                        </tr>
                        <tr>
                            <td>Всего выбросов (G, т/год)</td>
                            <td>${currentTotals.totalG.toFixed(4)}</td>
                            <td>${scenarioTotals.totalG.toFixed(4)}</td>
                            <td style="color:${currentTotals.totalG > scenarioTotals.totalG ? 'red' : 'green'}">${(currentTotals.totalG - scenarioTotals.totalG).toFixed(4)}</td>
                        </tr>
                        <tr>
                            <td>Количество объектов</td>
                            <td>${currentState.facilities.length}</td>
                            <td>${scenario.facilities.length}</td>
                            <td>${currentState.facilities.length - scenario.facilities.length}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    function calculateTotalsFromFacilities(facilities) {
        let totalM = 0;
        let totalG = 0;
        facilities.forEach(f => {
            (f.sources || []).forEach(s => {
                totalM += parseFloat(s.M || 0);
                totalG += parseFloat(s.G || 0);
            });
        });
        return { totalM, totalG };
    }

    // --- Plume Logic ---



    // --- Handoff Implementation ---

    function renderHandoffTab() {
        const content = document.getElementById('gm-handoff-content');
        if (!content) return;

        content.innerHTML = `
            <div class="gm-handoff-grid">
                <div class="results-card">
                    <h4>Экспорт проекта (GeoJSON)</h4>
                    <p class="subtitle">Включает источники, рецепторы и границу объекта для ГИС-систем.</p>
                    <button class="btn btn-primary" onclick="GeoMeteoWorkspace.exportToGeoJSON()">Скачать GeoJSON</button>
                </div>
                </div>
                <div class="results-card mt-4">
                    <h4>Экспорт карты (PNG)</h4>
                    <p class="subtitle">Скриншот высокого разрешения (300 DPI) для отчета.</p>
                    <button class="btn btn-secondary" onclick="GeoMeteoWorkspace.exportMapImage(event)">📸 Сохранить карту (PNG)</button>
                </div>
                <div class="results-card mt-4">
                    <h4>Пакет для ЭРА / Интеграл (CSV)</h4>
                    <p class="subtitle">Упрощенная таблица источников для внешних расчетных систем.</p>
                    <button class="btn btn-secondary" onclick="GeoMeteoWorkspace.exportToCSV()">Скачать CSV</button>
                </div>
                <div class="results-card mt-4">
                    <h4>Климатическая справка (JSON)</h4>
                    <p class="subtitle">Полный метео-датасет в машиночитаемом виде.</p>
                    <button class="btn btn-secondary" onclick="GeoMeteoWorkspace.exportMetJSON()">Скачать Метео JSON</button>
                </div>
            </div>
        `;
    }

    function exportToGeoJSON() {
        const state = ProjectStore.getState();
        const gm = ProjectStore.getGeoMeteo();
        
        const features = [];
        
        // Sources
        state.facilities.forEach(fac => {
            fac.sources.forEach(src => {
                if (src.lat && src.lng) {
                    features.push({
                        type: "Feature",
                        geometry: { type: "Point", coordinates: [src.lng, src.lat] },
                        properties: { name: src.name, type: "source", source_number: src.source_number, M: src.M, G: src.G }
                    });
                }
            });
        });

        // Receptors
        gm.receptors.forEach(r => {
            features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [r.lng, r.lat] },
                properties: { name: r.name, type: "receptor", r_type: r.type }
            });
        });

        // Boundary
        if (gm.facility_boundary) {
            features.push({
                type: "Feature",
                geometry: gm.facility_boundary,
                properties: { name: "Граница объекта", type: "boundary" }
            });
        }

        const geojson = { type: "FeatureCollection", features: features };
        downloadFile(JSON.stringify(geojson, null, 2), "emission_geo_export.geojson", "application/geo+json");
    }

    function downloadFile(content, fileName, contentType) {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    }

    function exportMapImage(event) {
        if (!MapModule) return;
        const mapContainer = document.getElementById('gm-map-container');
        if (!mapContainer || !window.html2canvas) {
            alert("Библиотека html2canvas не загружена или контейнер карты не найден.");
            return;
        }

        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ Экспорт...";
        btn.disabled = true;

        const pState = ProjectStore.getState();
        
        // Inject Print Layout Elements
        const printLayer = document.createElement('div');
        printLayer.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999;";
        
        const titleBlock = document.createElement('div');
        titleBlock.style.cssText = "position:absolute; top:20px; left:60px; background:white; padding:16px; border:2px solid #1e293b; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:Inter,sans-serif; max-width:320px;";
        titleBlock.innerHTML = `
            <div style="font-weight:800; font-size:1.1rem; color:#0f172a; margin-bottom:6px;">КАРТА РАССЕИВАНИЯ</div>
            <div style="font-size:0.85rem; color:#475569; margin-bottom:4px;"><b>Проект:</b> ${pState.name || 'Без названия'}</div>
            ${pState.lat ? `<div style="font-size:0.8rem; color:#64748b; margin-bottom:8px;"><b>Координаты:</b> ${pState.lat.toFixed(4)}, ${pState.lng.toFixed(4)}</div>` : ''}
            <div style="font-size:0.7rem; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:6px;">Платформа EMISSION • ${new Date().toLocaleDateString('ru-RU')}</div>
        `;
        
        const northArrow = document.createElement('div');
        northArrow.style.cssText = "position:absolute; top:20px; right:20px; font-size:40px; text-shadow:0 0 10px white, 0 0 5px white; font-family:Arial,sans-serif; line-height:1; text-align:center; color:#0f172a;";
        northArrow.innerHTML = `⬆<div style="font-size:14px; font-weight:900; margin-top:-6px;">N</div>`;
        
        printLayer.appendChild(titleBlock);
        printLayer.appendChild(northArrow);
        mapContainer.appendChild(printLayer);

        // Allow DOM to update before capture
        setTimeout(() => {
            html2canvas(mapContainer, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#e5e7eb',
                scale: 2 // High resolution
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'emission_map_export.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            }).catch(err => {
                console.error(err);
                alert("Ошибка при экспорте карты.");
                btn.innerHTML = originalText;
                btn.disabled = false;
            }).finally(() => {
                if (printLayer.parentNode) printLayer.remove();
            });
        }, 100);
    }

    function exportToCSV() {
        const state = ProjectStore.getState();
        const facilities = state.facilities || [];

        // CSV header
        const headers = ['Код источника', 'Наименование', 'Объект', 'Тип объекта', 'Методика', 'Формула', 'Широта', 'Долгота', 'M (г/с)', 'G (т/год)'];
        const rows = [headers.join(';')];

        facilities.forEach(fac => {
            if (!fac.sources) return;
            fac.sources.forEach(src => {
                const row = [
                    src.source_number || '—',
                    `"${(src.name || 'Безымянный').replace(/"/g, '""')}"`,
                    `"${(fac.name || '').replace(/"/g, '""')}"`,
                    fac.type || '—',
                    `"${(src.methodic_name || '—').replace(/"/g, '""')}"`,
                    src.formula_code || '—',
                    src.lat || state.lat || '',
                    src.lng || state.lng || '',
                    (src.M || 0).toFixed(6),
                    (src.G || 0).toFixed(6)
                ];
                rows.push(row.join(';'));
            });
        });

        // BOM for Excel Cyrillic support
        const bom = '\uFEFF';
        downloadFile(bom + rows.join('\n'), `emission_sources_${Date.now()}.csv`, 'text/csv;charset=utf-8');
    }

    function exportMetJSON() {
        const gmState = ProjectStore.getGeoMeteo();
        const activeDataset = gmState.met_datasets.find(d => d.id === gmState.active_met_dataset_id);

        if (!activeDataset) {
            alert('Нет активного метео-датасета. Создайте или выберите датасет во вкладке Метеорология.');
            return;
        }

        const exportData = {
            export_date: new Date().toISOString(),
            project_name: ProjectStore.getState().name,
            coordinate_system: gmState.coordinate_system,
            dataset: activeDataset
        };

        downloadFile(
            JSON.stringify(exportData, null, 2),
            `meteo_dataset_${activeDataset.name.replace(/\s+/g, '_')}_${Date.now()}.json`,
            'application/json'
        );
    }

    // Exporting public API
    return {
        open, close, switchTab, openWithContext,
        refreshAllMapLayers, toggleLayer,
        enableReceptorPlacement, enableBoundaryDraw,
        selectSource, selectReceptor, updateReceptor, deleteReceptor,
        setActiveMetDataset, renderMeteorologyTab,
        fetchOpenMeteo,
        renderSanitaryZoneTab,
        renderScenariosTab, addScenarioPrompt, setActiveScenario,
        handleGeomanCreate, fetchReceptorElevation,
        setActiveDrawLayer, updateLayerColor,
        renderLocationSetup, searchAddress, enableMapLocationPick,
        setSelectedPlumeSource, calculateSelectedPlume,
        promptPlumeCalculation,
        renderHandoffTab, exportToGeoJSON, exportMapImage, exportToCSV, exportMetJSON,
        deleteScenario, compareScenario,
        invalidateSize: () => MapModule && MapModule.invalidateSize(),
        resetView: () => {
            const state = ProjectStore.getState();
            if (MapModule) MapModule.flyTo(state.lat, state.lng, 12);
        }
    };
})();
