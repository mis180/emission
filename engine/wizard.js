/**
 * wizard.js — Data-driven question-flow state machine
 *
 * Loads methodic data from JSON files and provides the wizard engine
 * that determines which questions to show and which equations to use.
 */

const Wizard = (() => {
    // Cached data per methodic
    let _cache = {};

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

        const [meta, equations, variables, questions, tables, composition, aliases] = await Promise.all([
            fetchJson(`${basePath}/meta.json`),
            fetchJson(`${basePath}/equations.json`),
            fetchJson(`${basePath}/variables.json`),
            fetchJson(`${basePath}/questions.json`),
            fetchJson(`${basePath}/tables.json`),
            fetchJson(`${basePath}/composition.json`, true),
            fetchJson(`${basePath}/aliases.json`, true),
        ]);

        const data = { meta, equations, variables, questions, tables, composition, aliases };
        _cache[basePath] = data;
        return data;
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

    /**
     * Get source types available for a methodic.
     */
    function getSourceTypes(meta) {
        return meta.source_types || [];
    }

    /**
     * Get calc methods available for a given source type.
     * Returns array of { value, label, formula_code } or null if none (use _default).
     */
    function getCalcMethods(meta, sourceType) {
        const methods = meta.calc_methods || {};
        return methods[sourceType] || null;
    }

    /**
     * Get the formula code for a given source type + calc method.
     *
     * @param {Object} questionsData - The questions.json data with flow mapping
     * @param {string} sourceType
     * @param {string} calcMethod - or null if no sub-method choice
     * @returns {string|null} Formula code like "4.2"
     */
    function getFormulaCode(questionsData, sourceType, calcMethod) {
        const flow = questionsData.flow || {};
        const sourceFlow = flow[sourceType];
        if (!sourceFlow) return null;

        // Try specific calc method first, then _default
        const entry = sourceFlow[calcMethod] || sourceFlow['_default'];
        return entry ? entry.formula_code : null;
    }

    /**
     * Get the variable IDs needed for a given source type + calc method.
     *
     * @returns {Array<string>} List of variable IDs in display order
     */
    function getRequiredVariables(questionsData, sourceType, calcMethod) {
        const flow = questionsData.flow || {};
        const sourceFlow = flow[sourceType];
        if (!sourceFlow) return [];

        const entry = sourceFlow[calcMethod] || sourceFlow['_default'];
        return entry ? (entry.variables || []) : [];
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
        const questionsList = Array.isArray(data.questions) ? data.questions : (data.questions.questions || []);
        const variablesList = Array.isArray(data.variables) ? data.variables : (data.variables.variables || []);

        const questionsMap = {};
        for (const q of questionsList) {
            questionsMap[q.variable_id] = q;
        }

        const variablesMap = {};
        for (const v of variablesList) {
            variablesMap[v.id] = v;
        }

        return variableIds.map(varId => {
            const q = questionsMap[varId] || {};
            const v = variablesMap[varId] || {};

            let options = q.options || v.options || v.enum_options || null;
            
            // Resolve options from table if specified
            if (q.options_from_table && data.tables) {
                const tableName = q.options_from_table;
                const tables = data.tables.tables || [];
                const table = tables.find(t => t.id === tableName);
                if (table && table.data) {
                    // Assume Table-12 structure: { substance, ... } or some standard
                    // We'll use the first key as value and label if not specified, 
                    // or look for 'substance' or 'name'
                    options = table.data.map(row => {
                        const val = row.substance || row.id || Object.values(row)[0];
                        const lbl = row.label || row.name || val;
                        return { value: val, label: lbl };
                    }).filter((v, i, a) => a.findIndex(t => t.value === v.value) === i); // Unique
                }
            }

            return {
                variable_id: varId,
                label: q.label || v.label || varId,
                type: q.type || ((options) ? 'select' : (v.datatype === 'enum' ? 'select' : 'number')),
                unit: q.unit || v.unit || null,
                default: q.default != null ? q.default : (v.default != null ? v.default : null),
                min: q.min != null ? q.min : (v.min != null ? v.min : null),
                max: q.max != null ? q.max : (v.max != null ? v.max : null),
                precision: q.precision != null ? q.precision : (v.precision != null ? v.precision : 6),
                required: q.required != null ? q.required : true,
                help_text: q.help_text || v.description || null,
                options: options,
                latex: v.latex || null,
                section_ref: v.section_ref || null,
                lookup_table: v.lookup_table || null,
                lookup_parameter: v.lookup_parameter || null,
                auto_lookup: v.auto_lookup || null,
                disabled: q.disabled != null ? q.disabled : (v.disabled != null ? v.disabled : false),
                input_method: v.input_method || null,
                data_source: v.data_source || null,
                token: v.token || v.id || null,
                global_mapping: v.global_mapping || null,
            };
        });
    }

    /**
     * Get default composition for a product (if available in the scenario).
     * This is a placeholder — compositions should eventually come from the data layer.
     */
    function getDefaultCompositions(data) {
        if (data && data.composition) {
            return data.composition;
        }
        // Fallback minimal default
        return {
            'default': [
                { name: 'Загрязняющее вещество (всего)', pct: 100 }
            ]
        };
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
            formula_name: eq.formula_name || null,
            notes: eq.notes || []
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
     */
    function runAutoLookups(data, inputs) {
        if (!data || !data.variables) return;
        const variablesList = Array.isArray(data.variables) ? data.variables : (data.variables.variables || []);
        const activeEquations = data.equations && data.equations.active_equations ? data.equations.active_equations : [];
        let plan = [];
        
        if (typeof GraphResolver !== 'undefined') {
            plan = GraphResolver.getExecutionPlan(variablesList, activeEquations);
        } else {
            console.error("[Wizard] GraphResolver missing. Cannot resolve dependencies.");
            return;
        }

        // Execute the topologially sorted plan
        for (const node of plan) {
            if (node.type === 'LOOKUP') {
                const v = node.payload;
                if (inputs[`${v.id}_override`]) continue;

                const al = v.auto_lookup;
                const tablesToTry = Array.isArray(al.table) ? al.table : [al.table];
                const outputField = al.output;

                let lookupSuccessful = false;
                // Try each table in the array
                for (const tableName of tablesToTry) {
                    // Build the key map from auto_lookup configuration
                    const keyConfig = al.key; // Can be string, array, or object { "col": "var_or_array" }
                    const keyMap = {};
                    let missingKey = false;
                    let traceKeys = [];

                    if (typeof keyConfig === 'string') {
                        let val = inputs[keyConfig];
                        if (val != null && val !== '') {
                            if (data.aliases && data.aliases[keyConfig] && data.aliases[keyConfig][val]) {
                                val = data.aliases[keyConfig][val];
                            }
                            keyMap[keyConfig] = val;
                            traceKeys.push(`${keyConfig}=${val}`);
                        } else {
                            missingKey = true;
                        }
                    } else if (Array.isArray(keyConfig)) {
                        for (const k of keyConfig) {
                            let val = inputs[k];
                            if (val != null && val !== '') {
                                if (data.aliases && data.aliases[k] && data.aliases[k][val]) {
                                    val = data.aliases[k][val];
                                }
                                keyMap[k] = val;
                                traceKeys.push(`${k}=${val}`);
                            } else {
                                missingKey = true;
                            }
                        }
                    } else if (typeof keyConfig === 'object') {
                        for (const [colName, varCandidates] of Object.entries(keyConfig)) {
                            const candidates = Array.isArray(varCandidates) ? varCandidates : [varCandidates];
                            let foundCandidate = false;
                            for (const cand of candidates) {
                                let val = inputs[cand];
                                if (val != null && val !== '') {
                                    if (colName === 't' && al.interpolate_key !== 't') {
                                        val = Math.round(val);
                                    }
                                    if (data.aliases && data.aliases[colName] && data.aliases[colName][val]) {
                                        val = data.aliases[colName][val];
                                    }
                                    keyMap[colName] = val;
                                    traceKeys.push(`${colName}=${val}`);
                                    foundCandidate = true;
                                    break;
                                }
                            }
                            if (!foundCandidate) missingKey = true;
                        }
                    }

                    if (!missingKey) {
                        // All keys found for this table, try resolving
                        const result = Lookup.resolve(data.tables, tableName, keyMap, outputField, al.interpolate_key);
                        if (result && result.value != null) {
                            inputs[v.id] = result.value;
                            inputs[`${v.id}_trace`] = {
                                source_type: 'lookup',
                                table_id: tableName,
                                method: result.method,
                                keys: { ...keyMap },
                                result: { [outputField]: result.value },
                                display: `Таблица ${tableName} (${result.trace})`
                            };
                            lookupSuccessful = true;
                            break; // Match found in this table, stop trying others
                        }
                    }
                }

                // If no lookup was successful for this variable, clear its value if it's not a calculated variable
                if (!lookupSuccessful && !inputs[`${v.id}_is_calc`]) {
                    delete inputs[v.id];
                    delete inputs[`${v.id}_trace`];
                }
            } else if (node.type === 'EQUATION') {
                const eq = node.payload;
                try {
                    const value = math.evaluate(eq.rhs, inputs);
                    const lhs = eq.lhs_token || eq.lhs;
                    if (value != null && isFinite(value)) {
                        inputs[lhs] = value;
                        inputs[`${lhs}_trace`] = {
                            source_type: 'equation',
                            formula_code: eq.formula_code,
                            expression: eq.rhs,
                            result: value,
                            display: `Формула ${eq.formula_name || eq.formula_code} (${eq.rhs} = ${value.toFixed(6)})`
                        };
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
        getFormulaCode,
        getRequiredVariables,
        buildQuestions,
        getDefaultCompositions,
        getEquationInfo,
        runAutoLookups
    };
})();
