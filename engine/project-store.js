/**
 * project-store.js — Project Session Model
 * Manages the current project state, facilities, and sources.
 */
const ProjectStore = (() => {
    const _state = {
        name: "Новый проект",
        company: "",
        license: "",
        date_created: new Date().toISOString().split('T')[0],
        lat: null,
        lng: null,
        regionId: null,
        locationData: {},
        facilities: [], // New hierarchical store
        sources: []     // Legacy flat sources (kept for migration)
    };

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

    function setRegion(regionId, locationData) {
        _state.regionId = regionId;
        if (locationData) {
            _state.locationData = locationData;
        } else {
            _state.locationData = {};
        }
        save();
    }

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

    // Legacy method for backward compatibility
    function addSource(sourceData) {
        if (_state.facilities.length === 0) {
            addFacility({ name: "Основной объект", type: "other" });
        }
        const targetFacilityId = _state.facilities[0].id;
        return addSourceToFacility(targetFacilityId, sourceData);
    }
    
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
            save();
        }
    }
    
    // Legacy support
    function removeSource(id) {
        _state.facilities.forEach(fac => {
            fac.sources = fac.sources.filter(s => s.id !== id);
        });
        save();
    }

    // Legacy support
    function duplicateSource(id) {
        for (const fac of _state.facilities) {
            const src = fac.sources.find(s => s.id === id);
            if (src) {
                const copy = JSON.parse(JSON.stringify(src));
                copy.id = Date.now() + Math.floor(Math.random() * 1000);
                copy.name = copy.name + ' (Копия)';
                fac.sources.push(copy);
                save();
                return copy;
            }
        }
        return null;
    }

    function clear() {
        _state.facilities = [];
        _state.sources = [];
        save();
    }

    function save() {
        localStorage.setItem('emission_project', JSON.stringify(_state));
    }

    function migrateFromLegacy() {
        // Migration: If we have flat sources but no facilities, move them to a generic facility
        if (_state.sources && _state.sources.length > 0 && 
            (!_state.facilities || _state.facilities.length === 0)) {
            
            // Fix up legacy sources M and G
            _state.sources.forEach(src => {
                if (src.M === undefined && src.results && src.results.M !== undefined) src.M = src.results.M;
                if (src.G === undefined && src.results && src.results.G !== undefined) src.G = src.results.G;
            });
            
            _state.facilities = [{
                id: "fac_migrated_" + Date.now(),
                name: "Импортированные источники",
                type: "other",
                phase: "operation",
                address: "",
                description: "Автоматически созданный объект для старых источников",
                lat: null,
                lng: null,
                sources: _state.sources.map(s => ({...s}))
            }];
            _state.sources = []; // clear legacy
            save();
        }
    }

    function load() {
        const saved = localStorage.getItem('emission_project');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(_state, data);
            
            // Reinitialize empty arrays if missing from JSON
            if (!_state.facilities) _state.facilities = [];
            if (!_state.sources) _state.sources = [];
            
            migrateFromLegacy();
        }
    }

    function loadFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            Object.assign(_state, data);
            // Reinitialize empty arrays if missing from JSON
            if (!_state.facilities) _state.facilities = [];
            if (!_state.sources) _state.sources = [];
            
            migrateFromLegacy();
            save();
            return true;
        } catch (e) {
            console.error('Invalid JSON project file', e);
            return false;
        }
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

    return {
        getState,
        setName,
        setProjectMeta,
        setCoordinates,
        setRegion,
        addSource, // legacy
        clear,
        save,
        load,
        removeSource, // legacy
        duplicateSource, // legacy
        loadFromJSON,
        
        // Facility methods
        addFacility,
        updateFacility,
        removeFacility,
        duplicateFacility,
        getFacility,
        getAllFacilities,
        
        // Scoped source methods
        addSourceToFacility,
        updateSourceInFacility,
        removeSourceFromFacility,
        
        // Analytics
        getProjectTotals,
        getFacilityTotals,
        getTotalSourceCount: () => {
            let count = 0;
            _state.facilities.forEach(f => count += (f.sources ? f.sources.length : 0));
            return count;
        }
    };
})();
