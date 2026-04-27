/**
 * wizard.js — Data-driven question-flow state machine
 *
 * Loads methodic data from JSON files and provides the wizard engine
 * that determines which questions to show and which equations to use.
 */

const Wizard = (() => {
    // Cached data per methodic
    let _cache = {};
    let _globalRegistries = null;

    /**
     * Load all JSON data for a methodic.
     *
     * @param {string} basePath - e.g. "data/methodics/M1_2011-07"
     * @returns {Promise<Object>} { meta, equations, variables, questions, tables }
     */
    async function loadMethodic(basePath) {
        if (_cache[basePath]) return _cache[basePath];

        const fetchJson = async (url, optional = false) => {
            try {
                const cacheBuster = `?v=${typeof APP_VERSION !== 'undefined' ? APP_VERSION : Date.now()}`;
                const r = await fetch(url + cacheBuster);
                if (!r.ok) {
                    if (optional) return null;
                    throw new Error(`Failed to load ${url}: ${r.status} ${r.statusText}`);
                }
                return await r.json();
            } catch (e) {
                if (optional) return null;
                throw e;
            }
        };

        // NEW: Try loading the self-contained bundle first
        const bundle = await fetchJson(`${basePath}/build/bundle.json`, true);
        
        let meta, equations, variables, tables, flow, ui, composition, aliases, enums, lookupBindings, catalogUnits;

        if (bundle) {
            meta = bundle.meta;
            equations = bundle.equations;
            variables = bundle.variables;
            tables = bundle.tables;
            flow = bundle.flow;
            ui = bundle.ui;
            composition = bundle.composition;
            aliases = bundle.aliases;
            enums = bundle.enums;
            lookupBindings = bundle.lookup_bindings;
            catalogUnits = bundle.units;
        } else {
            // FALLBACK: Load individual files
            [meta, equations, variables, tables, flow, ui, composition, aliases, enums, lookupBindings, catalogUnits] = await Promise.all([
                fetchJson(`${basePath}/meta.json`),
                fetchJson(`${basePath}/build/equations.json`, true).then(r => r || fetchJson(`${basePath}/equations.json`)),
                fetchJson(`${basePath}/build/variables.json`, true).then(r => r || fetchJson(`${basePath}/variables.json`)),
                fetchJson(`${basePath}/build/tables.json`, true).then(r => r || fetchJson(`${basePath}/tables.json`)),
                fetchJson(`${basePath}/build/flow.json`, true).then(r => r || fetchJson(`${basePath}/flow.json`, true)),
                fetchJson(`${basePath}/build/ui.json`, true).then(r => r || fetchJson(`${basePath}/ui.json`, true)),
                fetchJson(`${basePath}/catalog/composition.json`, true).then(r => r || fetchJson(`${basePath}/composition.json`, true)),
                fetchJson(`${basePath}/catalog/aliases.json`, true).then(r => r || fetchJson(`${basePath}/aliases.json`, true)),
                fetchJson(`${basePath}/catalog/enums.json`, true).then(r => r || fetchJson(`${basePath}/enums.json`, true)),
                fetchJson(`${basePath}/build/lookup_bindings.json`, true).then(r => r || fetchJson(`${basePath}/lookup_bindings.json`, true)),
                fetchJson(`${basePath}/catalog/units.json`, true).then(r => r || null),
            ]);
        }

        const registries = await loadGlobalRegistries();

        // Standardize the data structure for the wizard
        const consolidatedFlow = flow ? (flow.calculator_methods || flow) : {};
        const consolidatedUI = (ui && ui.questions) ? ui.questions : (ui || []);

        const consolidatedVariables = (variables && variables.variables) ? variables.variables : (Array.isArray(variables) ? variables : []);

        // A6: expose catalog units as a flat array for unit_id resolution in buildQuestions
        const consolidatedCatalogUnits = catalogUnits ? (catalogUnits.units || catalogUnits) : [];

        const data = { 
            meta, 
            equations, 
            variables: consolidatedVariables, 
            flow: consolidatedFlow,
            ui: consolidatedUI,
            tables, 
            composition, 
            aliases, 
            enums: enums ? (enums.enums || enums) : [],
            lookup_bindings: lookupBindings ? lookupBindings.bindings : [],
            catalog_units: consolidatedCatalogUnits,
            registries 
        };
        _cache[basePath] = data;
        return data;
    }

    /**
     * Load global registries (symbols, units) once.
     */
    async function loadGlobalRegistries() {
        if (_globalRegistries) return _globalRegistries;

        const fetchJson = async (url, optional = false) => {
            try {
                const cacheBuster = `?v=${typeof APP_VERSION !== 'undefined' ? APP_VERSION : Date.now()}`;
                const r = await fetch(url + cacheBuster);
                if (!r.ok) {
                    if (optional) return null;
                    throw new Error(`Failed to load ${url}: ${r.status} ${r.statusText}`);
                }
                return await r.json();
            } catch (e) {
                if (optional) return null;
                throw e;
            }
        };

        const [symbols, units] = await Promise.all([
            fetchJson('data/symbols.json'),
            fetchJson('data/units.json')
        ]);

        _globalRegistries = { 
            symbols: symbols.symbols, 
            units: units.units,
            ui_catalog: []
        };
        return _globalRegistries;
    }

    /**
     * Load the registry of all available methodics.
     *
     * @returns {Promise<Array>} Array of methodic metadata objects
     */
    async function loadRegistry() {
        const cacheBuster = `?v=${typeof APP_VERSION !== 'undefined' ? APP_VERSION : Date.now()}`;
        const res = await fetch('data/registry.json' + cacheBuster);
        if (!res.ok) throw new Error(`Failed to load registry: ${res.status} ${res.statusText}`);
        const data = await res.json();
        return data.methodics || [];
    }

    function _unique(items) {
        return Array.from(new Set((items || []).filter(Boolean)));
    }

    function _getSourceTypeFormulaCodes(meta, sourceType, flow) {
        const sourceDef = (meta.source_types || []).find(st => st.value === sourceType);
        if (sourceDef && Array.isArray(sourceDef.formula_codes) && sourceDef.formula_codes.length > 0) {
            const declared = _unique(sourceDef.formula_codes);
            return flow ? declared.filter(fc => flow[fc]) : declared;
        }

        const legacyMethods = meta.calc_methods || {};
        if (Array.isArray(legacyMethods[sourceType]) && legacyMethods[sourceType].length > 0) {
            const derived = _unique(
                legacyMethods[sourceType].map(item => item && (item.formula_code || item.value))
            );
            return flow ? derived.filter(fc => flow[fc]) : derived;
        }

        if (flow && flow[sourceType] && flow[sourceType].formula_code) {
            return [flow[sourceType].formula_code];
        }

        return [];
    }

    function _isSourceTypeVisible(sourceType, options = {}) {
        const visibility = String(sourceType && (sourceType.visibility_status || sourceType.release_status) || 'ready_public').toLowerCase();
        const mode = String(options.mode || 'normal').toLowerCase();
        const readyStates = ['ready_public', 'active'];
        const betaStates = ['beta_limited', 'beta'];
        if (mode === 'expert') {
            return readyStates.includes(visibility) || betaStates.includes(visibility);
        }
        return readyStates.includes(visibility);
    }

    /**
     * Get source types available for a methodic.
     */
    function getSourceTypes(meta, flow, options = {}) {
        return (meta.source_types || [])
            .map(st => ({
                ...st,
                formula_codes: _getSourceTypeFormulaCodes(meta, st.value, flow)
            }))
            .filter(st => _isSourceTypeVisible(st, options));
    }

    /**
     * Get calc methods available for a given source type.
     * A3: Derives methods from meta.source_types formula_codes + the loaded flow,
     * falling back to the legacy meta.calc_methods if present.
     *
     * Returns array of { value, label, formula_code } or null if none (use _default).
     *
     * @param {Object} meta - Methodic meta data
     * @param {string} sourceType - The source_type value selected by the user
     * @param {Object} [flow] - The flat calculator_methods flow object (optional)
     */
    function getCalcMethods(meta, sourceType, flow) {
        // A3 NEW PATH: derive from source_types formula_codes when multiple codes exist
        const formulaCodes = _getSourceTypeFormulaCodes(meta, sourceType, flow);
        if (formulaCodes.length > 1 && flow) {
            const methods = formulaCodes
                .filter(fc => flow[fc]) // only include codes that have flow entries
                .map(fc => ({
                    value: fc,
                    formula_code: fc,
                    label: (flow[fc] && flow[fc].label) || fc
                }));
            if (methods.length > 1) return methods;
        }
        // LEGACY PATH: check meta.calc_methods (old architecture)
        const legacyMethods = meta.calc_methods || {};
        return legacyMethods[sourceType] || null;
    }

    function _normalizeKey(val) {
        return String(val || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function _textScore(s) {
        if (typeof s !== 'string') return -Infinity;
        const cyr = (s.match(/[\u0400-\u04FF]/g) || []).length;
        const lat = (s.match(/[A-Za-z]/g) || []).length;
        const badMarkers = (s.match(/[\u00C3\u00C2\u00D0\u00D1]/g) || []).length;
        const replacement = (s.match(/\uFFFD/g) || []).length;
        const controls = (s.match(/[\u0000-\u001F\u007F-\u009F]/g) || []).length;
        return (cyr * 3) + lat - (badMarkers * 3) - (replacement * 4) - (controls * 6);
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
        for (let i = 0; i < 8; i++) {
            if (!/[\u00C3\u00C2\u00D0\u00D1]/.test(best)) break;
            const candidate = _decodeAsUtf8FromLatin1(best);
            if (!candidate || candidate === best) break;
            const score = _textScore(candidate);
            if (score <= bestScore) break;
            best = candidate;
            bestScore = score;
        }
        return best;
    }

    function resolveFlowSelection(methodicData, sourceType, calcMethod, fallbackFormulaCode = null) {
        const flow = methodicData && methodicData.flow ? methodicData.flow : {};
        const meta = methodicData && methodicData.meta ? methodicData.meta : {};
        const calcMethods = meta.calc_methods || {};

        // A2: FAST PATH — calcMethod is itself a formula_code key in the flat flow.
        // This happens when the new getCalcMethods returns formula_codes as values.
        if (calcMethod && flow[calcMethod] && flow[calcMethod].formula_code) {
            return {
                source_type: sourceType,
                calc_method: calcMethod,
                formula_code: flow[calcMethod].formula_code,
                variables: Array.isArray(flow[calcMethod].variables) ? flow[calcMethod].variables : [],
                entry: flow[calcMethod]
            };
        }

        // A2: FAST PATH — fallbackFormulaCode is a direct key in the flat flow.
        if (fallbackFormulaCode && flow[fallbackFormulaCode] && flow[fallbackFormulaCode].formula_code) {
            return {
                source_type: sourceType,
                calc_method: fallbackFormulaCode,
                formula_code: flow[fallbackFormulaCode].formula_code,
                variables: Array.isArray(flow[fallbackFormulaCode].variables) ? flow[fallbackFormulaCode].variables : [],
                entry: flow[fallbackFormulaCode]
            };
        }

        let resolvedSourceType = sourceType;

        if (!flow[resolvedSourceType] && fallbackFormulaCode) {
            outer:
            for (const [stKey, stFlow] of Object.entries(flow)) {
                if (!stFlow || typeof stFlow !== 'object') continue;
                for (const [mKey, mEntry] of Object.entries(stFlow)) {
                    if (mEntry && mEntry.formula_code === fallbackFormulaCode) {
                        resolvedSourceType = stKey;
                        if (!calcMethod) calcMethod = mKey;
                        break outer;
                    }
                }
            }
        }

        const sourceFlow = flow[resolvedSourceType];
        
        // If the flow is already a flat method entry (new modular structure)
        if (!sourceFlow && flow[sourceType] && flow[sourceType].formula_code) {
             return {
                source_type: sourceType,
                calc_method: calcMethod || '_default',
                formula_code: flow[sourceType].formula_code,
                variables: Array.isArray(flow[sourceType].variables) ? flow[sourceType].variables : [],
                entry: flow[sourceType]
             };
        }

        // A1: NEW RESCUE — map source_type value → formula_code via meta.source_types.
        // This bridges the gap where source_type is a semantic label (e.g. 'azs_tank_receiving')
        // but flow keys are formula_codes (e.g. '7.1_receive').
        if (!sourceFlow) {
            const formulaCodes = _unique([
                ..._getSourceTypeFormulaCodes(meta, resolvedSourceType, flow),
                ..._getSourceTypeFormulaCodes(meta, sourceType, flow)
            ]);
            if (formulaCodes.length > 0) {
                // For source types with a single formula_code, resolve directly
                // For multi-formula source types, use calcMethod if it matches, else first
                const targetFc = (calcMethod && formulaCodes.includes(calcMethod))
                    ? calcMethod
                    : (fallbackFormulaCode && formulaCodes.includes(fallbackFormulaCode))
                        ? fallbackFormulaCode
                        : formulaCodes[0];
                if (targetFc && flow[targetFc] && flow[targetFc].formula_code) {
                    return {
                        source_type: sourceType,
                        calc_method: targetFc,
                        formula_code: flow[targetFc].formula_code,
                        variables: Array.isArray(flow[targetFc].variables) ? flow[targetFc].variables : [],
                        entry: flow[targetFc]
                    };
                }
            }
        }

        if (!sourceFlow || typeof sourceFlow !== 'object') return null;

        const hasEntry = (k) => !!(k && Object.prototype.hasOwnProperty.call(sourceFlow, k) && sourceFlow[k]);

        let resolvedCalcMethod = null;
        let entry = null;

        if (hasEntry(calcMethod)) {
            resolvedCalcMethod = calcMethod;
            entry = sourceFlow[calcMethod];
        }

        // Match by formula code if a stale calcMethod was stored.
        if (!entry && fallbackFormulaCode) {
            const byFormula = Object.entries(sourceFlow).find(([, v]) => v && v.formula_code === fallbackFormulaCode);
            if (byFormula) {
                resolvedCalcMethod = byFormula[0];
                entry = byFormula[1];
            }
        }

        if (!entry && hasEntry('_default')) {
            resolvedCalcMethod = '_default';
            entry = sourceFlow._default;
        }

        // Loose normalized match for legacy key variations.
        if (!entry && calcMethod) {
            const target = _normalizeKey(calcMethod);
            const byNormalized = Object.entries(sourceFlow).find(([k]) => _normalizeKey(k) === target);
            if (byNormalized) {
                resolvedCalcMethod = byNormalized[0];
                entry = byNormalized[1];
            }
        }

        // Meta-guided fallback: first valid calc method for this source type.
        if (!entry && Array.isArray(calcMethods[resolvedSourceType])) {
            const methods = calcMethods[resolvedSourceType];
            const byFormula = fallbackFormulaCode
                ? methods.find(m => m && m.formula_code === fallbackFormulaCode && hasEntry(m.value))
                : null;
            const fallbackMethod = byFormula || methods.find(m => m && hasEntry(m.value));
            if (fallbackMethod) {
                resolvedCalcMethod = fallbackMethod.value;
                entry = sourceFlow[fallbackMethod.value];
            }
        }

        // Final fallback: if branch has exactly one runtime entry, use it.
        if (!entry) {
            const runtimeEntries = Object.entries(sourceFlow)
                .filter(([, v]) => v && typeof v === 'object' && (v.formula_code || Array.isArray(v.variables)));
            if (runtimeEntries.length === 1) {
                resolvedCalcMethod = runtimeEntries[0][0];
                entry = runtimeEntries[0][1];
            }
        }

        if (!entry) return null;

        return {
            source_type: resolvedSourceType,
            calc_method: resolvedCalcMethod,
            formula_code: entry.formula_code || null,
            variables: Array.isArray(entry.variables) ? entry.variables : [],
            entry
        };
    }

    function getFormulaCode(methodicData, sourceType, calcMethod, fallbackFormulaCode = null) {
        const resolved = resolveFlowSelection(methodicData, sourceType, calcMethod, fallbackFormulaCode);
        return resolved ? resolved.formula_code : null;
    }

    /**
     * Get the variable IDs needed for a given source type + calc method.
     *
     * @returns {Array<string>} List of variable IDs in display order
     */
    function getRequiredVariables(methodicData, sourceType, calcMethod, fallbackFormulaCode = null) {
        const resolved = resolveFlowSelection(methodicData, sourceType, calcMethod, fallbackFormulaCode);
        return resolved ? resolved.variables : [];
    }

    /**
     * Build question objects for the wizard from variable IDs.
     * Merges question metadata from questions.json and variable metadata from variables.json.
     *
     * @param {Object} data - The loaded methodic data
     * @param {Array<string>} variableIds - List of variable IDs to show
     * @returns {Array<Object>} Enriched question objects for rendering
     */
    function buildQuestions(data, variableIds) {
        const localUI = data.ui || [];
        const globalUI = (data.registries && data.registries.ui_catalog) ? data.registries.ui_catalog : [];
        const variablesList = Array.isArray(data.variables) ? data.variables : (data.variables.variables || []);

        const variablesMap = {};
        for (const v of variablesList) {
            variablesMap[v.id] = v;
        }

        // Map UI metadata by variable_id
        const uiMap = {};
        // 1. Load from Global Catalog
        for (const q of globalUI) {
            uiMap[q.variable_id] = q;
        }
        // 2. Load from Local UI (overwrites global)
        for (const q of localUI) {
            uiMap[q.variable_id] = q;
        }

        return variableIds.map(varId => {
            const q = uiMap[varId] || {};
            const v = variablesMap[varId] || {};

            let options = q.options || v.options || v.enum_options || null;
            
            // Resolve options from table if specified
            if (q.options_from_table && data.tables) {
                const tableName = q.options_from_table;
                const tables = data.tables.tables || [];
                const table = tables.find(t => t.id === tableName);
                if (table && table.data) {
                    options = table.data.map(row => {
                        const val = row.substance || row.id || Object.values(row)[0];
                        const lbl = _normalizeText(row.label || row.name || val);
                        return { value: val, label: lbl };
                    }).filter((v, i, a) => a.findIndex(t => t.value === v.value) === i); // Unique
                }
            }

            // A5: Resolve options from enum_id referencing catalog/enums.json
            // This handles the new normalized architecture where variables use enum_id
            // instead of inline options arrays.
            if (!options && v.enum_id) {
                const enumList = Array.isArray(data.enums) ? data.enums : [];
                const enumDef = enumList.find(e => e.id === v.enum_id);
                if (enumDef && Array.isArray(enumDef.values)) {
                    options = enumDef.values.map(ev => ({
                        value: ev.value,
                        label: _normalizeText(ev.label || ev.value)
                    }));
                }
            }

            if (Array.isArray(options)) {
                options = options.map(o => {
                    if (o && typeof o === 'object') {
                        return {
                            ...o,
                            label: _normalizeText((o.label != null) ? String(o.label) : ''),
                        };
                    }
                    return {
                        value: o,
                        label: _normalizeText(o != null ? String(o) : '')
                    };
                });
            }

            let helpText = _normalizeText(q.help_text || v.description || null);
            if (typeof helpText === 'string' && helpText.includes('System-handled field added for flow/UI coverage audit.')) {
                helpText = 'Поле используется для автоматического подбора коэффициентов.';
            }

            // A7: Resolve unit display string from unit_id via catalog/units.json
            // The new architecture uses unit_id (e.g. 'g_per_m3') not inline unit strings.
            let unitDisplay = q.unit || v.unit || null;
            if (!unitDisplay && v.unit_id) {
                const catalogUnits = data.catalog_units || 
                    (data.registries && data.registries.units) || [];
                const unitEntry = catalogUnits.find(u => u.id === v.unit_id);
                unitDisplay = unitEntry
                    ? (unitEntry.symbol || unitEntry.symbol_en || v.unit_id)
                    : v.unit_id;
            }

            // A4: Category-based auto-fill classification.
            // In the new normalized architecture, variables use category='lookup' or 'calculated'
            // instead of the deprecated auto_lookup / lookup_table fields.
            // We set auto_lookup to a truthy sentinel to preserve backward-compat with UI filters.
            const categoryIsAutoFilled = (v.category === 'lookup' || v.category === 'calculated' || v.category === 'derived_input' || v.category === 'meta');
            const effectiveAutoLookup = v.auto_lookup || (categoryIsAutoFilled ? { _from_category: v.category } : null);

            // A8: Cross-reference lookup bindings to inject table_id for UI handbook links
            const bindings = Array.isArray(data.lookup_bindings) ? data.lookup_bindings : [];
            const binding = bindings.find(b => b.target_variable === varId);
            const boundTableId = binding ? binding.table_id : null;

            return {
                variable_id: varId,
                label: _normalizeText(q.label || v.label || varId),
                type: q.type || ((options) ? 'select' : (v.datatype === 'enum' || v.enum_id ? 'select' : 'number')),
                unit: _normalizeText(unitDisplay),
                default: q.default != null ? q.default : (v.default != null ? v.default : null),
                min: q.min != null ? q.min : (v.min != null ? v.min : null),
                max: q.max != null ? q.max : (v.max != null ? v.max : null),
                precision: q.precision != null ? q.precision : (v.precision != null ? v.precision : 6),
                required: q.required != null ? q.required : true,
                help_text: helpText,
                options: options,
                latex: v.latex || null,
                section_ref: v.section_ref || null,
                lookup_table: v.lookup_table || boundTableId,
                lookup_parameter: v.lookup_parameter || null,
                auto_lookup: effectiveAutoLookup,
                disabled: q.disabled != null ? q.disabled : (v.disabled != null ? v.disabled : false),
                input_method: v.input_method || null,
                data_source: v.data_source || null,
                token: v.token || v.id || null,
                global_mapping: v.global_mapping || null,
                category: v.category || null,
                hidden: q.hidden != null ? q.hidden : !!v.hidden,
                is_calc: v.is_calc != null ? v.is_calc : (v.category === 'calculated'),
                integer_only: q.integer_only != null ? q.integer_only : !!v.integer_only,
                enum_id: v.enum_id || q.enum_id || null,
                why_needed: _normalizeText(q.why_needed || v.why_needed || null),
                where_to_find: _normalizeText(q.where_to_find || v.where_to_find || null),
                example_value: q.example_value != null ? q.example_value : (v.example_value != null ? v.example_value : null),
            };
        });
    }


    /**
     * Get equations info (with confidence) for display in the results.
     */
    function getEquationInfo(data, formulaCode) {
        const eqs = Evaluator.getEquationsForCode(data.equations.active_equations, formulaCode);
        return eqs.map(eq => ({
            lhs: eq.lhs_token || eq.lhs,
            rhs: eq.rhs,
            latex: eq.latex || null,
            confidence: eq.confidence || 'unknown',
            status: eq.status || 'unknown',
            formula_name: _normalizeText(eq.formula_name || null),
            notes: Array.isArray(eq.notes) ? eq.notes.map(n => _normalizeText(n)) : []
        }));
    }

    /**
     * Run all auto-lookups defined in variables.json.
     * Updates the inputs object in-place.
     *
     * Supports:
     * - table as array (tries each table sequentially)
     * - key values as arrays (tries each variable sequentially)
     * - intermediate calculated variables (runs Evaluator if needed)
     *
     * @param {Object} data - Methodic data
     * @param {Object} inputs - Current user inputs
     * @param {Object} auditTrail - Optional object to collect { lookups, equations, conversions }
     */
    function runAutoLookups(data, inputs, auditTrail = null, options = {}) {
        if (!data || !data.variables) return;
        const variablesList = Array.isArray(data.variables) ? data.variables : (data.variables.variables || []);
        const activeEquations = data.equations && data.equations.active_equations ? data.equations.active_equations : [];
        const uiCatalog = (data.registries && data.registries.ui_catalog) ? data.registries.ui_catalog : [];
        const localUI = data.ui || [];
        const allowDefaultFallback = options.allowDefaultFallback !== undefined ? !!options.allowDefaultFallback : true;
        const allowDefaultForHidden = options.allowDefaultForHidden !== undefined ? !!options.allowDefaultForHidden : false;

        // Helper to find label
        const getLabel = (varId) => {
            const local = localUI.find(q => q.variable_id === varId);
            if (local && local.label) return _normalizeText(local.label);
            const catalog = uiCatalog.find(q => q.variable_id === varId);
            if (catalog && catalog.label) return _normalizeText(catalog.label);
            const vDef = variablesList.find(v => v.id === varId);
            return (vDef && vDef.label) ? _normalizeText(vDef.label) : varId;
        };

        const defaultByVar = {};
        for (const v of variablesList) {
            if (v && v.id && v.default != null) {
                defaultByVar[v.id] = v.default;
            }
        }
        const uiHiddenByVar = {};
        for (const q of localUI) {
            if (!q || !q.variable_id) continue;
            uiHiddenByVar[q.variable_id] = !!q.hidden;
        }
        const canUseDefaultForVar = (varId) => {
            if (allowDefaultFallback) return true;
            if (!allowDefaultForHidden) return false;
            if (!Object.prototype.hasOwnProperty.call(uiHiddenByVar, varId)) return true;
            return !!uiHiddenByVar[varId];
        };

        const getInputOrDefault = (varId) => {
            const existing = inputs[varId];
            if (existing != null && existing !== '') return existing;
            if (canUseDefaultForVar(varId) && Object.prototype.hasOwnProperty.call(defaultByVar, varId)) {
                const fallback = defaultByVar[varId];
                if (fallback != null && fallback !== '') {
                    if (!Object.prototype.hasOwnProperty.call(inputs, varId)) {
                        inputs[varId] = fallback;
                    }
                    return fallback;
                }
            }
            return null;
        };

        const mapAliasValue = (tableName, colName, rawValue) => {
            if (rawValue == null || rawValue === '') return rawValue;
            const aliases = data.aliases || {};
            const asStr = String(rawValue);
            const asLower = asStr.toLowerCase();

            const fromMap = (map) => {
                if (!map || typeof map !== 'object') return null;
                if (Object.prototype.hasOwnProperty.call(map, rawValue)) return map[rawValue];
                if (Object.prototype.hasOwnProperty.call(map, asStr)) return map[asStr];
                if (Object.prototype.hasOwnProperty.call(map, asLower)) return map[asLower];
                return null;
            };

            const tableScoped = aliases[tableName] && aliases[tableName][colName];
            const mappedTableScoped = fromMap(tableScoped);
            if (mappedTableScoped != null && mappedTableScoped !== '') return mappedTableScoped;

            const globalMap = aliases[colName];
            const mappedGlobal = fromMap(globalMap);
            if (mappedGlobal != null && mappedGlobal !== '') return mappedGlobal;

            return rawValue;
        };

        const buildLookupIssueTrace = (targetVar, tableName, status, keyMap, message, extra = {}) => ({
            variable_id: targetVar,
            label: getLabel(targetVar),
            source_type: 'lookup',
            table_id: tableName,
            method: extra.method || 'lookup',
            status,
            keys: { ...(keyMap || {}) },
            message: _normalizeText(message),
            display: _normalizeText(message),
            ...extra
        });

        let plan = [];
        let error = null;
        
        if (typeof GraphResolver !== 'undefined') {
            const res = GraphResolver.getExecutionPlan(variablesList, activeEquations, data.lookup_bindings);
            plan = res.plan;
            error = res.error;
        } else {
            console.error("[Wizard] GraphResolver missing. Cannot resolve dependencies.");
            return;
        }

        if (error) {
            inputs._error = error;
            console.error(`[Wizard] Graph Error: ${error}`);
        } else {
            delete inputs._error;
        }

        // Execute the topologially sorted plan
        for (const node of plan) {
            if (node.type === 'LOOKUP') {
                const payload = node.payload;
                const targetVar = node.is_binding ? payload.target_variable : payload.id;
                
                const isOverridden = !!inputs[`${targetVar}_override`];

                delete inputs[`${targetVar}_auto_value`];
                delete inputs[`${targetVar}_auto_meta`];

                let tablesToTry, keyConfig, outputField, interpolateKey, axisInput;

                if (node.is_binding) {
                    tablesToTry = [payload.table_id];
                    keyConfig = payload.selectors || payload.keys;
                    outputField = payload.output_key;
                    interpolateKey = payload.interpolate_key;
                    axisInput = payload.axis_input || null;
                } else {
                    const al = payload.auto_lookup || {};
                    tablesToTry = Array.isArray(al.table) ? al.table : [al.table];
                    keyConfig = al.key;
                    outputField = al.output;
                    interpolateKey = al.interpolate_key;
                    axisInput = null;
                }

                let lookupSuccessful = false;
                let lastLookupIssue = null;
                // Try each table in the array
                for (const tableName of (tablesToTry || [])) {
                    if (!tableName) continue;
                    const tablesArray = (data.tables && data.tables.tables) ? data.tables.tables : [];
                    const tableMeta = tablesArray.find(t => t.table_id === tableName || t.id === tableName) || null;
                    const axisMeta = tableMeta && tableMeta.axis ? tableMeta.axis : null;
                    const axisField = axisMeta ? (axisMeta.field || axisMeta.name) : interpolateKey;

                    // Build the key map from lookup configuration
                    const keyMap = {};
                    let missingKey = false;
                    const missingFields = [];

                    if (typeof keyConfig === 'string') {
                        let val = getInputOrDefault(keyConfig);
                        if (val != null && val !== '') {
                            val = mapAliasValue(tableName, keyConfig, val);
                            keyMap[keyConfig] = val;
                        } else {
                            missingKey = true;
                            missingFields.push(getLabel(keyConfig));
                        }
                    } else if (Array.isArray(keyConfig)) {
                        for (const k of keyConfig) {
                            let val = getInputOrDefault(k);
                            if (val != null && val !== '') {
                                val = mapAliasValue(tableName, k, val);
                                keyMap[k] = val;
                            } else {
                                missingKey = true;
                                missingFields.push(getLabel(k));
                            }
                        }
                    } else if (typeof keyConfig === 'object') {
                        for (const [colName, varCandidates] of Object.entries(keyConfig)) {
                            const candidates = Array.isArray(varCandidates) ? varCandidates : [varCandidates];
                            let foundCandidate = false;
                            for (const cand of candidates) {
                                let val = getInputOrDefault(cand);
                                if (val != null && val !== '') {
                                    if (colName === 't' && axisField !== 't') {
                                        val = Math.round(val);
                                    }
                                    val = mapAliasValue(tableName, colName, val);
                                    keyMap[colName] = val;
                                    foundCandidate = true;
                                    break;
                                }
                            }
                            if (!foundCandidate) {
                                missingKey = true;
                                missingFields.push(getLabel(candidates[0]));
                            }
                        }
                    }

                    if (!missingKey && axisInput && axisField && !(axisField in keyMap)) {
                        const axisCandidates = Array.isArray(axisInput) ? axisInput : [axisInput];
                        let foundAxis = false;
                        for (const cand of axisCandidates) {
                            let val = getInputOrDefault(cand);
                            if (val != null && val !== '') {
                                if (axisField === 't') {
                                    val = Math.round(val);
                                }
                                keyMap[axisField] = mapAliasValue(tableName, axisField, val);
                                foundAxis = true;
                                break;
                            }
                        }
                        if (!foundAxis) {
                            missingKey = true;
                            missingFields.push(getLabel(axisCandidates[0]));
                        }
                    }

                    if (missingKey) {
                        const uniqueMissingFields = [...new Set(missingFields)];
                        lastLookupIssue = buildLookupIssueTrace(
                            targetVar,
                            tableName,
                            'waiting_inputs',
                            keyMap,
                            `Ожидает поля: ${uniqueMissingFields.join(', ')}.`,
                            { missing_fields: uniqueMissingFields }
                        );
                        continue;
                    }

                    if (!missingKey) {
                        // All keys found for this table, try resolving
                        
                        // NEW ENGINE INTEGRATION
                        let result;
                        let lookupError = null;
                        if (!data._lookupEngine) {
                            data._lookupEngine = new LookupEngine(data);
                        }
                        try {
                            result = data._lookupEngine.resolve(tableName, keyMap, outputField);
                        } catch (e) {
                            lookupError = e;
                            const isNoMatchError = typeof e.message === 'string' && e.message.includes('No match found');
                            if (!isNoMatchError) {
                                console.warn(`[Wizard] LookupEngine error for ${targetVar}: ${e.message}`);
                            }
                        }

                        if (result && result.value != null) {
                            const traceEntry = {
                                variable_id: targetVar,
                                label: getLabel(targetVar),
                                source_type: 'lookup',
                                table_id: tableName,
                                method: result.method,
                                keys: { ...keyMap },
                                result: { [outputField]: result.value },
                                display: `Таблица ${tableName} (${result.trace})`
                            };
                            inputs[`${targetVar}_auto_value`] = result.value;
                            inputs[`${targetVar}_auto_meta`] = traceEntry;
                            inputs[`${targetVar}_trace`] = traceEntry;
                            if (!isOverridden) {
                                inputs[targetVar] = result.value;
                            }
                            if (auditTrail && auditTrail.lookups) {
                                auditTrail.lookups.push(traceEntry);
                            }
                            lookupSuccessful = true;
                            lastLookupIssue = null;
                            // Update internal math scope immediately if needed for dependent equations
                            break; 
                        }

                        const keySummary = Object.entries(keyMap)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(', ');
                        const errorMessage = lookupError && lookupError.message
                            ? lookupError.message.replace(/^\[LookupEngine\]\s*/, '')
                            : `В таблице ${tableName} нет строки для ${keySummary}.`;
                        lastLookupIssue = buildLookupIssueTrace(
                            targetVar,
                            tableName,
                            'no_match',
                            keyMap,
                            errorMessage
                        );
                    }
                }

                // If no lookup was successful for this variable, clear its value if it's not a calculated variable
                // BUT only if it was a lookup node. Do NOT delete manual inputs.
                if (!lookupSuccessful && node.type === 'LOOKUP' && !inputs[`${targetVar}_is_calc`]) {
                    if (lastLookupIssue) {
                        inputs[`${targetVar}_auto_meta`] = lastLookupIssue;
                        inputs[`${targetVar}_trace`] = lastLookupIssue;
                    } else {
                        delete inputs[`${targetVar}_auto_meta`];
                        delete inputs[`${targetVar}_trace`];
                    }
                    delete inputs[`${targetVar}_auto_value`];
                    if (!isOverridden) {
                        delete inputs[targetVar];
                    }
                }
            } else if (node.type === 'EQUATION') {
                const eq = node.payload;
                try {
                    // Use Symbol Registry to resolve symbols like f_i -> f_i_valve
                    const mathScope = Evaluator.buildMathScope(inputs, data);
                    const value = math.evaluate(eq.rhs, mathScope);
                    
                    const lhs = eq.lhs_token || eq.lhs;
                    if (value != null && isFinite(value)) {
                        inputs[lhs] = value;
                        const traceEntry = {
                            variable_id: lhs,
                            label: getLabel(lhs),
                            source_type: 'equation',
                            formula_code: eq.formula_code,
                            expression: eq.rhs,
                            result: value,
                            display: `Формула ${eq.formula_name || eq.formula_code} (${eq.rhs} = ${value.toFixed(6)})`
                        };
                        inputs[`${lhs}_trace`] = traceEntry;
                        if (auditTrail && auditTrail.equations) {
                            auditTrail.equations.push(traceEntry);
                        }
                    }
                } catch (e) {
                    // Silent - dependency not yet available
                }
            }
        }
    }

    return {
        loadMethodic,
        loadRegistry,
        getSourceTypes,
        getCalcMethods,
        resolveFlowSelection,
        getFormulaCode,
        getRequiredVariables,
        buildQuestions,
        getEquationInfo,
        runAutoLookups
    };
})();
