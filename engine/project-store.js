/**
 * project-store.js — Project Session Model
 * Manages the current project state, facilities, and sources.
 */
const ProjectStore = (() => {
    const SCHEMA_VERSION = 2;

    function migrateState(data) {
        if (!data || typeof data !== 'object') return data;
        let v = data.schema_version || 1;
        // Future migrations go here
        return data;
    }

    const _DB_NAME = 'emission_db';
    const _DB_VERSION = 1;
    const _STORE_NAME = 'projects';

    function _openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(_DB_NAME, _DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(_STORE_NAME)) {
                    db.createObjectStore(_STORE_NAME);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function _idbSave(key, data) {
        if (!window.supabaseClient || !window.currentUser) return;
        try {
            // Upsert project
            await window.supabaseClient.from('projects').upsert({
                id: data.id,
                user_id: window.currentUser.id,
                name: data.name,
                company: data.company,
                license: data.license,
                lat: data.lat,
                lng: data.lng,
                geo_meteo: data.geo_meteo || {},
                schema_version: data.schema_version,
                date_created: data.date_created,
                date_modified: data.date_modified
            });
            
            // Upsert facilities
            if (data.facilities && data.facilities.length > 0) {
                const facToInsert = data.facilities.map((fac, idx) => ({
                    id: String(fac.id),
                    project_id: data.id,
                    name: fac.name,
                    type: fac.type,
                    address: fac.address,
                    description: fac.description,
                    phase: fac.phase,
                    lat: fac.lat,
                    lng: fac.lng,
                    boundary: fac.boundary,
                    sanitary_zone: fac.sanitary_zone,
                    sort_order: idx
                }));
                await window.supabaseClient.from('facilities').upsert(facToInsert);
                
                // Upsert sources
                const srcToInsert = [];
                data.facilities.forEach(fac => {
                    if (fac.sources) {
                        fac.sources.forEach(src => {
                            srcToInsert.push({
                                id: String(src.id),
                                facility_id: String(fac.id),
                                name: src.name,
                                source_number: src.source_number,
                                methodic_id: src.methodic_id,
                                methodic_name: src.methodic_name,
                                source_type: src.source_type,
                                calc_method: src.calc_method,
                                category: src.category,
                                formula_code: src.formula_code,
                                inputs: src.inputs || {},
                                results: src.results || {},
                                composition: src.composition || [],
                                lat: src.lat,
                                lng: src.lng,
                                elevation: src.elevation,
                                m_value: src.M,
                                g_value: src.G
                            });
                        });
                    }
                });
                if (srcToInsert.length > 0) {
                    await window.supabaseClient.from('sources').upsert(srcToInsert);
                }
            }
        } catch (e) {
            console.error('[ProjectStore] Supabase save failed:', e);
            throw e;
        }
    }

    async function _idbLoad(key) {
        if (!key || !window.currentUser || !window.supabaseClient) return null;
        try {
            const { data: proj, error } = await window.supabaseClient.from('projects').select('*').eq('id', key).single();
            if (error || !proj) return null;
            
            const { data: facilities } = await window.supabaseClient.from('facilities').select('*').eq('project_id', key).order('sort_order', { ascending: true });
            const { data: sources } = await window.supabaseClient.from('sources').select('*').in('facility_id', facilities && facilities.length > 0 ? facilities.map(f => f.id) : ['none']);
            
            const state = {
                id: proj.id,
                name: proj.name,
                company: proj.company || "",
                license: proj.license || "",
                date_created: proj.date_created,
                date_modified: proj.date_modified,
                lat: proj.lat,
                lng: proj.lng,
                geo_meteo: proj.geo_meteo || {},
                schema_version: proj.schema_version,
                facilities: []
            };
            
            if (facilities) {
                facilities.forEach(f => {
                    const fac = {
                        id: f.id,
                        name: f.name,
                        type: f.type,
                        address: f.address,
                        description: f.description,
                        phase: f.phase,
                        lat: f.lat,
                        lng: f.lng,
                        boundary: f.boundary,
                        sanitary_zone: f.sanitary_zone,
                        sources: []
                    };
                    if (sources) {
                        fac.sources = sources.filter(s => s.facility_id === f.id).map(s => ({
                            id: s.id,
                            name: s.name,
                            source_number: s.source_number,
                            methodic_id: s.methodic_id,
                            methodic_name: s.methodic_name,
                            source_type: s.source_type,
                            calc_method: s.calc_method,
                            category: s.category,
                            formula_code: s.formula_code,
                            inputs: s.inputs || {},
                            results: s.results || {},
                            composition: s.composition || [],
                            lat: s.lat,
                            lng: s.lng,
                            elevation: s.elevation,
                            M: s.m_value,
                            G: s.g_value
                        }));
                    }
                    state.facilities.push(fac);
                });
            }
            return state;
        } catch (e) {
            console.error('[ProjectStore] Supabase load failed:', e);
            return null;
        }
    }

    async function _idbDelete(key) {
        if (!window.currentUser || !window.supabaseClient) return;
        await window.supabaseClient.from('projects').delete().eq('id', key);
    }

    async function _idbList() {
        if (!window.currentUser || !window.supabaseClient) return [];
        const { data, error } = await window.supabaseClient.from('projects').select('id, name, date_created, date_modified').order('date_modified', { ascending: false });
        return data || [];
    }

    function createDefaultGeoMeteoState() {
        return {
            facility_boundary: null,      // GeoJSON Polygon or null
            coordinate_system: "WGS84",   // "WGS84" | "SK95" | "SK42"
            receptors: [],                // { id, name, type, lat, lng, elevation, description }
            source_geometries: [],        // { source_id, geometry_type, geojson, release_height_m }
            geometries: [],                // { id, type, name, geojson } - General geometries
            met_datasets: [],             // { id, name, source_type, region_id, lat, lng, ... }
            active_met_dataset_id: null,
            sanitary_class_override: null,
            nominal_zone_m: null,
            scenarios: [],                // { id, name, description, active_source_ids, ... }
            active_scenario_id: null,
            plume_enabled: false,
            plume_results: null,
            layer_styles: {
                sources: { color: '#4f46e5', weight: 2 },
                receptors: { color: '#8b5cf6', weight: 2 },
                boundary: { color: '#3b82f6', weight: 2, dashArray: '5, 5' },
                sanitary_zones: { color: '#ef4444', weight: 1, fillOpacity: 0.1 },
                plume: { color: '#f59e0b', weight: 1 }
            }
        };
    }

    function createDefaultProjectState() {
        return {
            id: 'proj_' + Date.now(),
            name: "Новый проект",
            company: "",
            license: "",
            date_created: new Date().toISOString().split('T')[0],
            lat: null,
            lng: null,
            facilities: [], // Hierarchical store
            geo_meteo: createDefaultGeoMeteoState(),
            schema_version: SCHEMA_VERSION
        };
    }

    const _state = createDefaultProjectState();

    function getState() {
        return _state;
    }

    function setName(name) {
        _state.name = name;
        save();
    }
    
    function setProjectMeta(meta) {
        if (meta.company !== undefined) _state.company = meta.company;
        if (meta.license !== undefined) _state.license = meta.license;
        if (meta.date_created !== undefined) _state.date_created = meta.date_created;
        save();
    }

    function setCoordinates(lat, lng) {
        if (lat !== undefined) _state.lat = lat;
        if (lng !== undefined) _state.lng = lng;
        save();
    }

    // setRegion() removed — regions system no longer used

    // --- Facility CRUD ---

    function addFacility(facilityData) {
        const newFacility = {
            id: "fac_" + Date.now(),
            name: facilityData.name || "Новый объект",
            type: facilityData.type || "other",
            address: facilityData.address || "",
            description: facilityData.description || "",
            phase: facilityData.phase || "operation",
            lat: facilityData.lat !== undefined ? facilityData.lat : null,
            lng: facilityData.lng !== undefined ? facilityData.lng : null,
            boundary: facilityData.boundary || null, // Per-facility GeoJSON
            sanitary_zone: facilityData.sanitary_zone || null,
            sources: []
        };
        _state.facilities.push(newFacility);
        save();
        return newFacility;
    }

    function updateFacility(facilityId, data) {
        const idx = _state.facilities.findIndex(f => f.id === facilityId);
        if (idx !== -1) {
            // Do not overwrite ID or sources array
            const { id, sources, ...updatable } = data;
            _state.facilities[idx] = { ..._state.facilities[idx], ...updatable };
            save();
        }
    }

    function removeFacility(facilityId) {
        _state.facilities = _state.facilities.filter(f => f.id !== facilityId);
        if (window.currentUser && window.supabaseClient) {
            window.supabaseClient.from('facilities').delete().eq('id', facilityId).then();
        }
        save();
    }

    function duplicateFacility(facilityId) {
        const fac = _state.facilities.find(f => f.id === facilityId);
        if (fac) {
            const copy = JSON.parse(JSON.stringify(fac));
            copy.id = "fac_" + Date.now();
            copy.name = copy.name + ' (Копия)';
            // Give new IDs to all sources
            copy.sources.forEach(src => {
                src.id = Date.now() + Math.floor(Math.random() * 1000);
            });
            _state.facilities.push(copy);
            save();
            return copy;
        }
        return null;
    }

    function getFacility(facilityId) {
        return _state.facilities.find(f => f.id === facilityId) || null;
    }

    function getAllFacilities() {
        return _state.facilities;
    }

    // --- Source CRUD (scoped to facility) ---

    function addSourceToFacility(facilityId, sourceData) {
        const fac = getFacility(facilityId);
        if (!fac) return null;
        
        // Calculate source number based on existing sources
        let srcCount = 0;
        _state.facilities.forEach(f => srcCount += f.sources.length);

        const newSource = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            name: sourceData.name || `Источник №${6001 + srcCount}`,
            source_number: sourceData.source_number || `${6001 + srcCount}`,
            methodic_id: sourceData.methodic_id || sourceData.methodic_name, // fallback for legacy
            methodic_name: sourceData.methodic_name,
            source_type: sourceData.source_type,
            calc_method: sourceData.calc_method,
            category: sourceData.category || 'operation',
            formula_code: sourceData.formula_code,
            inputs: JSON.parse(JSON.stringify(sourceData.inputs || {})),
            results: JSON.parse(JSON.stringify(sourceData.results || {})),
            composition: JSON.parse(JSON.stringify(sourceData.composition || [])),
            lat: sourceData.lat !== undefined ? sourceData.lat : (fac.lat !== null ? fac.lat : _state.lat),
            lng: sourceData.lng !== undefined ? sourceData.lng : (fac.lng !== null ? fac.lng : _state.lng),
            elevation: sourceData.elevation !== undefined ? sourceData.elevation : null,
            M: (sourceData.results && sourceData.results.M !== undefined) ? sourceData.results.M : null,
            G: (sourceData.results && sourceData.results.G !== undefined) ? sourceData.results.G : null
        };
        fac.sources.push(newSource);
        save();
        return newSource;
    }

    function updateSourceInFacility(facilityId, sourceId, data) {
        const fac = getFacility(facilityId);
        if (!fac) return;
        const idx = fac.sources.findIndex(s => s.id === sourceId);
        if (idx !== -1) {
            fac.sources[idx] = { ...fac.sources[idx], ...data };
            
            // Re-sync M and G if results changed
            if (data.results) {
                if (data.results.M !== undefined) fac.sources[idx].M = data.results.M;
                if (data.results.G !== undefined) fac.sources[idx].G = data.results.G;
            }
            save();
        }
    }

    function removeSourceFromFacility(facilityId, sourceId) {
        const fac = getFacility(facilityId);
        if (fac) {
            fac.sources = fac.sources.filter(s => s.id !== sourceId);
            if (window.currentUser && window.supabaseClient) {
                window.supabaseClient.from('sources').delete().eq('id', sourceId).then();
            }
            save();
        }
    }
    


    function clear() {
        Object.assign(_state, createDefaultProjectState());
        localStorage.setItem('emission_last_project_id', _state.id);
        save();
    }

    let _saveTimeout = null;
    function save(sync = false) {
        const doSave = () => {
            if (!_state.id) _state.id = 'proj_' + Date.now();
            _state.date_modified = new Date().toISOString();
            
            // Primary: IndexedDB
            _idbSave(_state.id, JSON.parse(JSON.stringify(_state))).catch(err => {
                console.error('[ProjectStore] IndexedDB save failed:', err);
            });
            // Secondary fallback: try localStorage for quick recovery
            try {
                localStorage.setItem('emission_last_project_id', _state.id);
                localStorage.setItem('emission_project', JSON.stringify(_state));
            } catch (e) {
                console.warn('[ProjectStore] localStorage quota exceeded, using IndexedDB only');
            }
        };

        if (sync) {
            if (_saveTimeout) clearTimeout(_saveTimeout);
            doSave();
            return;
        }
        if (_saveTimeout) clearTimeout(_saveTimeout);
        _saveTimeout = setTimeout(doSave, 500);
    }

    // Ensure data is saved if user closes tab while debounce is pending
    window.addEventListener('beforeunload', () => save(true));



    /**
     * Ensure all required state fields exist with sane defaults.
     * Protects against old exports, partial saves, or malformed imports.
     */
    function normalizeState() {
        // Top-level scalars
        if (typeof _state.name !== 'string') _state.name = "Новый проект";
        if (typeof _state.company !== 'string') _state.company = "";
        if (typeof _state.license !== 'string') _state.license = "";
        if (!_state.date_created) _state.date_created = new Date().toISOString().split('T')[0];
        
        // Arrays
        if (!Array.isArray(_state.facilities)) _state.facilities = [];

        // Ensure each facility has a sources array
        _state.facilities.forEach(fac => {
            if (!Array.isArray(fac.sources)) fac.sources = [];
        });
        
        // geo_meteo sub-tree
        if (!_state.geo_meteo || typeof _state.geo_meteo !== 'object') {
            _state.geo_meteo = createDefaultGeoMeteoState();
        }
        const gm = _state.geo_meteo;
        if (!Array.isArray(gm.receptors)) gm.receptors = [];
        if (!Array.isArray(gm.source_geometries)) gm.source_geometries = [];
        if (!Array.isArray(gm.geometries)) gm.geometries = [];
        if (!Array.isArray(gm.met_datasets)) gm.met_datasets = [];
        if (!Array.isArray(gm.scenarios)) gm.scenarios = [];
        if (!gm.coordinate_system) gm.coordinate_system = "WGS84";
        if (!gm.layer_styles || typeof gm.layer_styles !== 'object') {
            gm.layer_styles = createDefaultGeoMeteoState().layer_styles;
        }
    }

    async function load(forcedId = null) {
        let data = null;
        
        let lastId = forcedId || localStorage.getItem('emission_last_project_id');

        try {
            if (lastId) {
                data = await _idbLoad(lastId);
            }
            // Migrate legacy data
            if (!data) {
                const legacy = await _idbLoad('active_project');
                if (legacy) {
                    legacy.id = 'proj_' + Date.now();
                    await _idbSave(legacy.id, legacy);
                    await _idbDelete('active_project');
                    data = legacy;
                    localStorage.setItem('emission_last_project_id', data.id);
                }
            }
        } catch (e) {
            console.warn('[ProjectStore] IndexedDB load failed:', e);
        }
        
        if (!data) {
            const saved = localStorage.getItem('emission_project');
            if (saved) {
                try {
                    data = JSON.parse(saved);
                } catch (e) {
                    console.error('[ProjectStore] Corrupt localStorage:', e);
                    localStorage.removeItem('emission_project');
                }
            }
        }
        
        if (data) {
            const defaults = createDefaultProjectState();
            data = migrateState(data);
            for (const key of Object.keys(defaults)) {
                if (data[key] !== undefined) _state[key] = data[key];
            }
            if (!data.id) _state.id = 'proj_' + Date.now(); // ensure id exists
            _state.schema_version = SCHEMA_VERSION;
            normalizeState();
            localStorage.setItem('emission_last_project_id', _state.id);
        }
    }

    async function listProjects() { return await _idbList(); }
    
    async function switchProject(id) {
        const data = await _idbLoad(id);
        if (data) {
             Object.keys(_state).forEach(k => delete _state[k]); // Clear current
             Object.assign(_state, data);
             normalizeState();
             localStorage.setItem('emission_last_project_id', _state.id);
             return true;
        }
        return false;
    }
    
    async function deleteProject(id) {
        await _idbDelete(id);
        if (_state.id === id) {
             clear();
        }
    }
    
    function createNewProject() {
        clear();
    }

    function loadFromJSON(jsonString) {
        let data;
        try {
            data = JSON.parse(jsonString);
        } catch (e) {
            console.error('[ProjectStore] Invalid JSON in import file:', e);
            return false;
        }
        
        if (!data || typeof data !== 'object') {
            console.error('[ProjectStore] Import data is not an object');
            return false;
        }

        const defaults = createDefaultProjectState();
        Object.assign(_state, defaults);
        
        data = migrateState(data);
        for (const key of Object.keys(defaults)) {
            if (data[key] !== undefined) _state[key] = data[key];
        }
        _state.schema_version = SCHEMA_VERSION;
        normalizeState();
        save();
        return true;
    }

    // --- Aggregation ---

    function getProjectTotals() {
        let totalM = 0;
        let totalG = 0;
        const byFacility = [];
        const pollutantMap = {};
        
        for (const fac of _state.facilities) {
            let facM = 0;
            let facG = 0;
            
            for (const src of fac.sources) {
                const m = src.M || 0;
                const g = src.G || 0;
                facM += m;
                facG += g;
                
                // Aggregate pollutants
                if (src.composition && Array.isArray(src.composition)) {
                    src.composition.forEach(comp => {
                        const key = comp.name;
                        if (!pollutantMap[key]) pollutantMap[key] = { name: key, M: 0, G: 0 };
                        pollutantMap[key].M += m * (comp.pct / 100);
                        pollutantMap[key].G += g * (comp.pct / 100);
                    });
                }
            }
            
            totalM += facM;
            totalG += facG;
            byFacility.push({ 
                id: fac.id, 
                name: fac.name, 
                type: fac.type,
                phase: fac.phase,
                M: facM, 
                G: facG, 
                sourceCount: fac.sources.length 
            });
        }
        
        return {
            totalM,
            totalG,
            byFacility,
            byPollutant: Object.values(pollutantMap).sort((a,b) => b.G - a.G)
        };
    }

    function getFacilityTotals(facilityId) {
        const fac = getFacility(facilityId);
        if (!fac) return { M: 0, G: 0, sourceCount: 0, byPollutant: [] };
        
        let facM = 0;
        let facG = 0;
        const pollutantMap = {};
        
        for (const src of fac.sources) {
            const m = src.M || 0;
            const g = src.G || 0;
            facM += m;
            facG += g;
            
            if (src.composition && Array.isArray(src.composition)) {
                src.composition.forEach(comp => {
                    const key = comp.name;
                    if (!pollutantMap[key]) pollutantMap[key] = { name: key, M: 0, G: 0 };
                    pollutantMap[key].M += m * (comp.pct / 100);
                    pollutantMap[key].G += g * (comp.pct / 100);
                });
            }
        }
        
        return {
            M: facM,
            G: facG,
            sourceCount: fac.sources.length,
            byPollutant: Object.values(pollutantMap).sort((a,b) => b.G - a.G)
        };
    }

    function getTotalSourceCount() {
        let count = 0;
        _state.facilities.forEach(f => count += (f.sources ? f.sources.length : 0));
        return count;
    }

    function saveScenario(name) {
        const scenario = {
            id: "scen_" + Date.now(),
            name: name || "Сценарий " + new Date().toLocaleString(),
            timestamp: new Date().toISOString(),
            facilities: JSON.parse(JSON.stringify(_state.facilities))
        };
        _state.geo_meteo.scenarios.push(scenario);
        save();
        return scenario;
    }

    function removeScenario(id) {
        _state.geo_meteo.scenarios = _state.geo_meteo.scenarios.filter(s => s.id !== id);
        if (_state.geo_meteo.active_scenario_id === id) _state.geo_meteo.active_scenario_id = null;
        save();
    }

    function getAllScenarios() {
        return _state.geo_meteo.scenarios;
    }

    function addMetDataset(data) {
        const newDataset = { id: "met_" + Date.now(), ...data };
        _state.geo_meteo.met_datasets.push(newDataset);
        if (!_state.geo_meteo.active_met_dataset_id) _state.geo_meteo.active_met_dataset_id = newDataset.id;
        save();
        return newDataset;
    }

    function updateMetDataset(id, data) {
        const idx = _state.geo_meteo.met_datasets.findIndex(d => d.id === id);
        if (idx !== -1) {
            _state.geo_meteo.met_datasets[idx] = { ..._state.geo_meteo.met_datasets[idx], ...data };
            save();
        }
    }

    function removeMetDataset(id) {
        _state.geo_meteo.met_datasets = _state.geo_meteo.met_datasets.filter(d => d.id !== id);
        if (_state.geo_meteo.active_met_dataset_id === id) _state.geo_meteo.active_met_dataset_id = null;
        save();
    }

    function setActiveMetDataset(id) {
        _state.geo_meteo.active_met_dataset_id = id;
        save();
    }

    function getActiveMetDataset() {
        return _state.geo_meteo.met_datasets.find(d => d.id === _state.geo_meteo.active_met_dataset_id) || null;
    }

    function addReceptor(data) {
        const newReceptor = { id: "rec_" + Date.now(), ...data };
        _state.geo_meteo.receptors.push(newReceptor);
        save();
        return newReceptor;
    }

    function updateReceptor(id, data) {
        const idx = _state.geo_meteo.receptors.findIndex(r => r.id === id);
        if (idx !== -1) {
            _state.geo_meteo.receptors[idx] = { ..._state.geo_meteo.receptors[idx], ...data };
            save();
        }
    }

    function removeReceptor(id) {
        _state.geo_meteo.receptors = _state.geo_meteo.receptors.filter(r => r.id !== id);
        save();
    }

    function getAllReceptors() {
        return _state.geo_meteo.receptors;
    }

    function setActiveScenario(id) {
        _state.geo_meteo.active_scenario_id = id;
        save();
    }

    function getActiveScenario() {
        return _state.geo_meteo.scenarios.find(s => s.id === _state.geo_meteo.active_scenario_id) || null;
    }

    function duplicateScenario(id) {
        const scen = _state.geo_meteo.scenarios.find(s => s.id === id);
        if (scen) {
            const copy = JSON.parse(JSON.stringify(scen));
            copy.id = "scen_" + Date.now();
            copy.name += " (Копия)";
            _state.geo_meteo.scenarios.push(copy);
            save();
            return copy;
        }
        return null;
    }

    function setSourceGeometry(sourceId, geometryType, geojson, releaseHeight) {
        const idx = _state.geo_meteo.source_geometries.findIndex(g => g.source_id === sourceId);
        const entry = { source_id: sourceId, geometry_type: geometryType, geojson, release_height_m: releaseHeight };
        if (idx !== -1) {
            _state.geo_meteo.source_geometries[idx] = entry;
        } else {
            _state.geo_meteo.source_geometries.push(entry);
        }
        save();
    }

    function getSourceGeometry(sourceId) {
        return _state.geo_meteo.source_geometries.find(g => g.source_id === sourceId) || null;
    }

    function setGlobalBoundary(geojsonPolygon) {
        _state.geo_meteo.facility_boundary = geojsonPolygon;
        save();
    }

    function getGeoMeteo() {
        return _state.geo_meteo;
    }

    function updateGeoMeteo(partialData) {
        _state.geo_meteo = { ..._state.geo_meteo, ...partialData };
        save();
    }

    function addGeometry(data) {
        const newGeom = { id: "geom_" + Date.now(), ...data };
        _state.geo_meteo.geometries.push(newGeom);
        save();
        return newGeom;
    }

    function removeGeometry(id) {
        _state.geo_meteo.geometries = _state.geo_meteo.geometries.filter(g => g.id !== id);
        save();
    }

    function updateLayerStyle(layerId, style) {
        if (!_state.geo_meteo.layer_styles[layerId]) _state.geo_meteo.layer_styles[layerId] = {};
        _state.geo_meteo.layer_styles[layerId] = { ..._state.geo_meteo.layer_styles[layerId], ...style };
        save();
    }

    function setFacilityBoundary(facilityId, geojson) {
        const fac = getFacility(facilityId);
        if (fac) {
            fac.boundary = geojson;
            save();
        }
    }

    function getFacilityBoundary(facilityId) {
        const fac = getFacility(facilityId);
        return fac ? fac.boundary : null;
    }

    return {
        createDefaultProjectState, createDefaultGeoMeteoState,
        getState, setName, setProjectMeta, setCoordinates,
        clear, save, load, listProjects, switchProject, deleteProject, createNewProject, loadFromJSON,
        addFacility, updateFacility, removeFacility, duplicateFacility, getFacility, getAllFacilities,
        addSourceToFacility, updateSourceInFacility, removeSourceFromFacility,
        getProjectTotals, getFacilityTotals, getTotalSourceCount,
        saveScenario, removeScenario, getAllScenarios, setActiveScenario, getActiveScenario, duplicateScenario,
        addMetDataset, updateMetDataset, removeMetDataset, setActiveMetDataset, getActiveMetDataset,
        addReceptor, updateReceptor, removeReceptor, getAllReceptors,
        setSourceGeometry, getSourceGeometry, setGlobalBoundary,
        getGeoMeteo, updateGeoMeteo, addGeometry, removeGeometry, updateLayerStyle,
        setFacilityBoundary, getFacilityBoundary
    };
})();
