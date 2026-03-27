/**
 * project-store.js — Project Session Model
 * Manages the current project state, sources cart, and reporting data.
 */
const ProjectStore = (() => {
    const _state = {
        name: "Новый проект",
        lat: null,
        lng: null,
        sources: []
    };

    function getState() {
        return _state;
    }

    function setName(name) {
        _state.name = name;
        save();
    }

    function setCoordinates(lat, lng) {
        if (lat !== undefined) _state.lat = lat;
        if (lng !== undefined) _state.lng = lng;
        save();
    }

    function addSource(sourceData) {
        const newSource = {
            id: Date.now(),
            name: sourceData.name || `Источник №${6000 + _state.sources.length + 1}`,
            methodic_name: sourceData.methodic_name,
            category: sourceData.category || 'operation',
            formula_code: sourceData.formula_code,
            inputs: JSON.parse(JSON.stringify(sourceData.inputs || {})),
            results: JSON.parse(JSON.stringify(sourceData.results || {})),
            composition: JSON.parse(JSON.stringify(sourceData.composition || [])),
            lat: _state.lat,
            lng: _state.lng,
            // Mirror M and G results to the root for UI/Map consistency
            M: (sourceData.results && sourceData.results.M !== undefined) ? sourceData.results.M : null,
            G: (sourceData.results && sourceData.results.G !== undefined) ? sourceData.results.G : null
        };
        _state.sources.push(newSource);
        save();
        return newSource;
    }

    function clear() {
        _state.sources = [];
        save();
    }

    function save() {
        localStorage.setItem('emission_project', JSON.stringify(_state));
    }

    function load() {
        const saved = localStorage.getItem('emission_project');
        if (saved) {
            const data = JSON.parse(saved);
            // Migration: Ensure all sources have top-level M and G derived from results
            if (data.sources) {
                data.sources.forEach(src => {
                    if (src.M === undefined && src.results && src.results.M !== undefined) src.M = src.results.M;
                    if (src.G === undefined && src.results && src.results.G !== undefined) src.G = src.results.G;
                });
            }
            Object.assign(_state, data);
        }
    }

    function removeSource(id) {
        _state.sources = _state.sources.filter(s => s.id !== id);
        save();
    }

    function updateSource(id, data) {
        const idx = _state.sources.findIndex(s => s.id === id);
        if (idx !== -1) {
            _state.sources[idx] = { ..._state.sources[idx], ...data };
            save();
        }
    }

    function duplicateSource(id) {
        const src = _state.sources.find(s => s.id === id);
        if (src) {
            const copy = JSON.parse(JSON.stringify(src));
            copy.id = Date.now();
            copy.name = copy.name + ' (Копия)';
            _state.sources.push(copy);
            save();
        }
    }

    function loadFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            Object.assign(_state, data);
            save();
            return true;
        } catch (e) {
            console.error('Invalid JSON project file', e);
            return false;
        }
    }

    return {
        getState,
        setName,
        setCoordinates,
        addSource,
        clear,
        save,
        load,
        removeSource,
        updateSource,
        duplicateSource,
        loadFromJSON
    };
})();
