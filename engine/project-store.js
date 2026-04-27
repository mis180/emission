/**
 * project-store.js - Project Session Model
 * Manages the current project state, facilities, and sources.
 */
const ProjectStore = (() => {
    const SCHEMA_VERSION = 2;

    function _textScore(s) {
        if (typeof s !== 'string') return -Infinity;
        const cyr = (s.match(/[\u0400-\u04FF]/g) || []).length;
        const lat = (s.match(/[A-Za-z]/g) || []).length;
        const badMarkers = (s.match(/[\u00C3\u00C2\u00D0\u00D1]/g) || []).length;
        const replacement = (s.match(/\uFFFD/g) || []).length;
        const controls = (s.match(/[\u0000-\u001F\u007F-\u009F]/g) || []).length;
        return (cyr * 3) + lat - (badMarkers * 3) - (replacement * 4) - (controls * 6);
    }

    function _badMarkerCount(s) {
        if (typeof s !== 'string') return Infinity;
        const markers = (s.match(/[\u00C3\u00C2\u00D0\u00D1]/g) || []).length;
        const replacement = (s.match(/\uFFFD/g) || []).length;
        return markers + replacement;
    }

    function _decodeAsUtf8FromLatin1(input) {
        if (typeof input !== 'string' || typeof TextDecoder === 'undefined') return input;
        const cp1252Extra = {
            0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
            0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
            0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
            0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
            0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
            0x017E: 0x9E, 0x0178: 0x9F
        };
        const bytes = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const code = input.charCodeAt(i);
            if (code <= 0xFF) {
                bytes[i] = code;
                continue;
            }
            const mapped = cp1252Extra[code];
            if (mapped == null) return input;
            bytes[i] = mapped;
        }
        try {
            return new TextDecoder('utf-8').decode(bytes);
        } catch (_) {
            return input;
        }
    }

    function _normalizeText(input) {
        if (typeof input !== 'string' || input.length === 0) return input;
        let best = input;
        let bestScore = _textScore(best);
        let bestMarkers = _badMarkerCount(best);
        for (let i = 0; i < 8; i++) {
            if (!/[\u00C3\u00C2\u00D0\u00D1]/.test(best)) break;
            const candidate = _decodeAsUtf8FromLatin1(best);
            if (!candidate || candidate === best) break;
            const score = _textScore(candidate);
            const markers = _badMarkerCount(candidate);
            if (score <= bestScore && markers >= bestMarkers) break;
            best = candidate;
            bestScore = score;
            bestMarkers = markers;
        }
        return best;
    }

    function _normalizeTextField(obj, field) {
        if (!obj || typeof obj !== 'object') return;
        if (typeof obj[field] !== 'string') return;
        obj[field] = _normalizeText(obj[field]);
    }

    function migrateState(data) {
        if (!data || typeof data !== 'object') return data;
        let v = data.schema_version || 1;

        _normalizeTextField(data, 'name');
        _normalizeTextField(data, 'company');
        _normalizeTextField(data, 'license');
        
        // P5: Phase Terminology Migration
        if (data.facilities && Array.isArray(data.facilities)) {
            data.facilities.forEach(fac => {
                _normalizeTextField(fac, 'name');
                _normalizeTextField(fac, 'address');
                _normalizeTextField(fac, 'description');

                if (fac.phase === 'usage') fac.phase = 'operation';
                if (fac.phase === 'building') fac.phase = 'construction';
                if (!fac.phase) fac.phase = 'both';
                
                // workflowVersion mapping
                if (fac.type === 'fuel_station' && fac.equipmentProfile) {
                    fac.workflowVersion = 'template';
                } else if (!fac.workflowVersion) {
                    fac.workflowVersion = 'manual';
                }

                if (Array.isArray(fac.sources)) {
                    fac.sources.forEach(src => {
                        _normalizeTextField(src, 'name');
                        _normalizeTextField(src, 'methodic_name');

                        if (src.methodic_id === 'fuel_stations_2011' && typeof FuelStations2011Migration !== 'undefined') {
                            FuelStations2011Migration.migrateSource(src);
                        }
                    });
                }
            });
        }

        if (data.geo_meteo && typeof data.geo_meteo === 'object') {
            if (Array.isArray(data.geo_meteo.scenarios)) {
                data.geo_meteo.scenarios.forEach(scen => {
                    _normalizeTextField(scen, 'name');
                    _normalizeTextField(scen, 'description');
                });
            }
            if (Array.isArray(data.geo_meteo.receptors)) {
                data.geo_meteo.receptors.forEach(rec => {
                    _normalizeTextField(rec, 'name');
                    _normalizeTextField(rec, 'description');
                });
            }
            if (Array.isArray(data.geo_meteo.met_datasets)) {
                data.geo_meteo.met_datasets.forEach(ds => {
                    _normalizeTextField(ds, 'name');
                });
            }
        }
        
        // Future migrations go here
        return data;
    }


    const _DB_NAME = 'emission_db';
    const _DB_VERSION = 1;
    const _STORE_NAME = 'projects';



    let _serverVersionAtLoad = null;
    let _syncState = { status: 'synced', lastSynced: null, error: null };

    async function _cloudSave(key, data) {
        if (!window.supabaseClient || !window.currentUser) {
            _updateSyncStatus('offline');
            return;
        }
        if (window.currentUser.id === 'local_test_user') return;
        
        _updateSyncStatus('syncing');

        try {
            const isConflicting = await checkForConflicts();
            if (isConflicting) {
                _updateSyncStatus('conflict');
                window.dispatchEvent(new CustomEvent('emission-conflict-detected', { detail: { projectId: key } }));
                return;
            }

            const modifiedAt = new Date().toISOString();
            data.date_modified = modifiedAt;

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
                date_modified: modifiedAt
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
                                inputs: { ...(src.inputs || {}), _meta: { _is_template: src._is_template, _is_not_implemented: src._is_not_implemented } },
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

            _serverVersionAtLoad = modifiedAt;
            _updateSyncStatus('synced');
            _syncState.lastSynced = modifiedAt;
        } catch (e) {
            console.error('[ProjectStore] Supabase save failed:', e);
            _updateSyncStatus('error', e.message);
            throw e;
        }
    }

    function _updateSyncStatus(status, error = null) {
        _syncState.status = status;
        _syncState.error = error;
        window.dispatchEvent(new CustomEvent('emission-sync-status-changed', { detail: _syncState }));
    }

    async function checkForConflicts() {
        if (!window.supabaseClient || !_serverVersionAtLoad) return false;
        try {
            const { data, error } = await window.supabaseClient
                .from('projects')
                .select('date_modified')
                .eq('id', _state.id)
                .single();
            
            if (error || !data) return false;
            
            // If the server version is newer than what we have at load, it's a conflict
            return new Date(data.date_modified) > new Date(_serverVersionAtLoad);
        } catch (e) {
            return false;
        }
    }

    async function _cloudLoad(key) {
        if (!key || !window.currentUser || !window.supabaseClient) return null;
        if (window.currentUser.id === 'local_test_user') return null;
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
                            G: s.g_value,
                            _is_template: s.inputs && s.inputs._meta ? s.inputs._meta._is_template : false,
                            _is_not_implemented: s.inputs && s.inputs._meta ? s.inputs._meta._is_not_implemented : false
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

    async function _cloudDelete(key) {
        if (!window.currentUser || !window.supabaseClient) return;
        if (window.currentUser.id === 'local_test_user') return;
        await window.supabaseClient.from('projects').delete().eq('id', key);
    }

    /**
     * Saves an immutable snapshot of a calculation for a specific source.
     */
    async function saveCalculationSnapshot(facilityId, source) {
        if (!window.supabaseClient || !window.currentUser) return null;
        if (window.currentUser.id === 'local_test_user') return null;
        
        try {
            const snapshotData = {
                project_id: _state.id,
                facility_id: facilityId,
                source_id: source.id,
                methodic_id: source.methodic_id,
                formula_code: source.formula_code,
                inputs: source.inputs,
                results: source.results, // Full trace is stored here
                composition: source.composition,
                M: source.M,
                G: source.G,
                timestamp: new Date().toISOString()
            };

            const { data, error } = await window.supabaseClient.from('calculation_snapshots').insert({
                project_id: _state.id,
                user_id: window.currentUser.id,
                snapshot_data: snapshotData,
                created_at: snapshotData.timestamp
            }).select();

            if (error) throw error;
            
            console.log('[ProjectStore] Saved immutable calculation snapshot:', data[0].id);
            return data[0].id;
        } catch (e) {
            console.error('[ProjectStore] Failed to save calculation snapshot:', e);
            return null;
        }
    }

    /**
     * Retrieves the calculation history for a specific source.
     */
    async function getCalculationHistory(sourceId) {
        if (!window.supabaseClient || !window.currentUser) return [];
        if (window.currentUser.id === 'local_test_user') return [];

        try {
            const { data, error } = await window.supabaseClient
                .from('calculation_snapshots')
                .select('*')
                .eq('snapshot_data->>source_id', sourceId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[ProjectStore] Failed to fetch calculation history:', e);
            return [];
        }
    }

    async function _cloudList() {
        if (!window.currentUser || !window.supabaseClient) return [];
        if (window.currentUser.id === 'local_test_user') return [];
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
            name: "\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0435\u043a\u0442",
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
        _state.name = _normalizeText(name);
        save();
    }
    
    function setProjectMeta(meta) {
        if (meta.company !== undefined) _state.company = _normalizeText(meta.company);
        if (meta.license !== undefined) _state.license = _normalizeText(meta.license);
        if (meta.date_created !== undefined) _state.date_created = meta.date_created;
        save();
    }

    function setCoordinates(lat, lng) {
        if (lat !== undefined) _state.lat = lat;
        if (lng !== undefined) _state.lng = lng;
        save();
    }

    // setRegion() removed - regions system no longer used

    // --- Facility CRUD ---

    function addFacility(facilityData) {
        const newFacility = {
            id: "fac_" + Date.now(),
            name: _normalizeText(facilityData.name || "\u041d\u043e\u0432\u044b\u0439 \u043e\u0431\u044a\u0435\u043a\u0442"),
            type: facilityData.type || "other",
            address: _normalizeText(facilityData.address || ""),
            description: _normalizeText(facilityData.description || ""),
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
            if (updatable.name !== undefined) updatable.name = _normalizeText(updatable.name);
            if (updatable.address !== undefined) updatable.address = _normalizeText(updatable.address);
            if (updatable.description !== undefined) updatable.description = _normalizeText(updatable.description);
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
            copy.name = copy.name + ' (\u043a\u043e\u043f\u0438\u044f)';
            // Give new IDs to all sources
            copy.sources.forEach(src => {
                src.id = "src_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
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

    function validateSourceCompatibility(facilityId, sourceData, ignoreSourceId = null) {
        const fac = getFacility(facilityId);
        if (!fac) {
            return { valid: false, message: 'Facility context not found.' };
        }

        const methodicId = sourceData && (sourceData.methodic_id || sourceData.methodic_name);
        
        // Delegate to methodic-specific migration logic if it exists
        if (methodicId === 'fuel_stations_2011' && typeof FuelStations2011Migration !== 'undefined' && FuelStations2011Migration.validateSourceCompatibility) {
            return FuelStations2011Migration.validateSourceCompatibility(fac, sourceData, ignoreSourceId);
        }

        return { valid: true };
    }

    // --- Source CRUD (scoped to facility) ---
    function addSourceToFacility(facilityId, sourceData) {
        const fac = getFacility(facilityId);
        if (!fac) return null;

        const sourceDraft = { ...(sourceData || {}) };
        const methodicId = sourceDraft.methodic_id || sourceDraft.methodic_name;
        if (methodicId === 'fuel_stations_2011' && typeof FuelStations2011Migration !== 'undefined') {
            FuelStations2011Migration.migrateSource(sourceDraft);
        }

        const compatibility = validateSourceCompatibility(facilityId, sourceDraft);
        if (!compatibility.valid) return null;

        // Calculate source number based on existing sources
        let srcCount = 0;
        _state.facilities.forEach(f => srcCount += f.sources.length);

        const newSource = {
            id: "src_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
            name: sourceDraft.name || `Source #${1001 + srcCount}`,
            source_number: sourceDraft.source_number || `${1001 + srcCount}`,
            methodic_id: sourceDraft.methodic_id || sourceDraft.methodic_name, // fallback for legacy
            methodic_name: sourceDraft.methodic_name,
            source_type: sourceDraft.source_type,
            calc_method: sourceDraft.calc_method,
            category: sourceDraft.category || 'operation',
            formula_code: sourceDraft.formula_code,
            inputs: JSON.parse(JSON.stringify(sourceDraft.inputs || {})),
            results: JSON.parse(JSON.stringify(sourceDraft.results || {})),
            composition: JSON.parse(JSON.stringify(sourceDraft.composition || [])),
            lat: sourceDraft.lat !== undefined ? sourceDraft.lat : (fac.lat !== null ? fac.lat : _state.lat),
            lng: sourceDraft.lng !== undefined ? sourceDraft.lng : (fac.lng !== null ? fac.lng : _state.lng),
            elevation: sourceDraft.elevation !== undefined ? sourceDraft.elevation : null,
            M: (sourceDraft.results && sourceDraft.results.M !== undefined) ? sourceDraft.results.M : null,
            G: (sourceDraft.results && sourceDraft.results.G !== undefined) ? sourceDraft.results.G : null,
            _is_template: sourceDraft._is_template || false,
            _is_not_implemented: sourceDraft._is_not_implemented || false
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
            const nextSource = { ...fac.sources[idx], ...data };
            const methodicId = nextSource.methodic_id || nextSource.methodic_name;
            if (methodicId === 'fuel_stations_2011' && typeof FuelStations2011Migration !== 'undefined') {
                FuelStations2011Migration.migrateSource(nextSource);
            }
            const compatibility = validateSourceCompatibility(facilityId, nextSource, sourceId);
            if (!compatibility.valid) return false;

            fac.sources[idx] = nextSource;
            
            // Re-sync M and G if results changed
            if (data.results) {
                if (data.results.M !== undefined) fac.sources[idx].M = data.results.M;
                if (data.results.G !== undefined) fac.sources[idx].G = data.results.G;
            }
            
            // Clear template flag on intentional edit/update
            if (data.inputs || data.results) {
                fac.sources[idx]._is_template = false;
                
                // Automatically create a snapshot if it's a real calculation
                if (fac.sources[idx].M != null && fac.sources[idx].G != null) {
                    saveCalculationSnapshot(facilityId, fac.sources[idx]).then(snapId => {
                        if (snapId) {
                            fac.sources[idx].latest_snapshot_id = snapId;
                            save(); // Persist the snapshot pointer
                        }
                    });
                }
            }
            
            save();
            return true;
        }
        return false;
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
            
            // Primary: Supabase Cloud
            _cloudSave(_state.id, JSON.parse(JSON.stringify(_state))).catch(err => {
                console.error('[ProjectStore] Supabase Cloud save failed:', err);
            });
            // Secondary fallback: try localStorage for quick recovery
            try {
                localStorage.setItem('emission_last_project_id', _state.id);
                localStorage.setItem('emission_project', JSON.stringify(_state));
            } catch (e) {
                console.warn('[ProjectStore] localStorage quota exceeded. Offline fallback disabled.');
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
        if (typeof _state.name !== 'string') _state.name = "\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0435\u043a\u0442";
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
                data = await _cloudLoad(lastId);
            }
            // Migrate legacy data
            if (!data) {
                const legacy = await _cloudLoad('active_project');
                if (legacy) {
                    legacy.id = 'proj_' + Date.now();
                    await _cloudSave(legacy.id, legacy);
                    await _cloudDelete('active_project');
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
            _serverVersionAtLoad = _state.date_modified;
            localStorage.setItem('emission_last_project_id', _state.id);
            localStorage.setItem('emission_project', JSON.stringify(_state));
        }
    }

    async function listProjects() { return await _cloudList(); }
    
    async function switchProject(id) {
        const data = await _cloudLoad(id);
        if (data) {
             Object.keys(_state).forEach(k => delete _state[k]); // Clear current
             Object.assign(_state, data);
             normalizeState();
             localStorage.setItem('emission_last_project_id', _state.id);
             localStorage.setItem('emission_project', JSON.stringify(_state));
             return true;
        }
        return false;
    }
    
    async function deleteProject(id) {
        await _cloudDelete(id);
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
            name: _normalizeText(name || "\u0421\u0446\u0435\u043d\u0430\u0440\u0438\u0439 " + new Date().toLocaleString()),
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
            copy.name += " (\u043a\u043e\u043f\u0438\u044f)";
            _state.geo_meteo.scenarios.push(copy);
            save();
            return copy;
        }
        return null;
    }

    /**
     * Determine the status of a calculation source.
     * returns { status: 'ready'|'template'|'not_implemented'|'error', label: string, color: string }
     */
    function getSourceReadinessStatus(src) {
        if (!src) return { status: 'error', label: '\u041e\u0448\u0438\u0431\u043a\u0430', color: '#ef4444' };
        
        if (src._is_not_implemented) {
            return { status: 'not_implemented', label: '\u0412 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435', color: '#94a3b8' };
        }
        
        if (src._is_template) {
            return { status: 'template', label: '\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435', color: '#b45309' };
        }
        
        // If it has results, it's ready
        if (src.M !== null && src.G !== null) {
            return { status: 'ready', label: '\u0413\u043e\u0442\u043e\u0432\u043e', color: '#047857' };
        }
        
        // Fallback
        return { status: 'template', label: '\u041d\u0435 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d', color: '#b45309' };
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
        clear, save, load, listProjects, switchProject, deleteProject, createNewProject, loadFromJSON, saveCalculationSnapshot,
        addFacility, updateFacility, removeFacility, duplicateFacility, getFacility, getAllFacilities,
        addSourceToFacility, updateSourceInFacility, removeSourceFromFacility, validateSourceCompatibility,
        getProjectTotals, getFacilityTotals, getTotalSourceCount,
        saveScenario, removeScenario, getAllScenarios, setActiveScenario, getActiveScenario, duplicateScenario,
        addMetDataset, updateMetDataset, removeMetDataset, setActiveMetDataset, getActiveMetDataset,
        addReceptor, updateReceptor, removeReceptor, getAllReceptors,
        setSourceGeometry, getSourceGeometry, setGlobalBoundary,
        getGeoMeteo, updateGeoMeteo, addGeometry, removeGeometry, updateLayerStyle,
        setFacilityBoundary, getFacilityBoundary,
        getSourceReadinessStatus, saveCalculationSnapshot, getCalculationHistory,
        getSyncState: () => _syncState, checkForConflicts
    };
})();
