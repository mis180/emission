/**
 * evaluator.js — Data-driven equation evaluator using math.js
 *
 * Reads equation strings from equations.json and evaluates them
 * in order, building up a scope of intermediate results.
 */

const Evaluator = (() => {
    /**
     * Filter active equations by formula code.
     * Returns them sorted by equation_order.
     */
    function getEquationsForCode(activeEquations, formulaCode) {
        return activeEquations
            .filter(eq => eq.formula_code === formulaCode)
            .sort((a, b) => a.equation_order - b.equation_order);
    }

    /**
     * Evaluate a set of equations in order.
     *
     * @param {Array} equations - Sorted array of equation objects with lhs_token and rhs
     * @param {Object} variableValues - Map of variable_id -> numeric value
     * @param {Object} options - { silent: boolean }
     * @param {Object} methodicData - { variables, registries }
     * @returns {Object} { results: {lhs_token: value, ...}, ... }
     */
    function evaluate(equations, variableValues, options = {}, methodicData = null) {
        const results = {};
        const calculation_steps = [];
        
        // Audit trail for traceability
        if (!options.auditTrail) options.auditTrail = { conversions: [], lookups: [] };
        
        // Build scope from user-provided values and symbol registry
        const scope = buildMathScope(variableValues, methodicData, options.auditTrail);
        
        const plan = options.executionPlan || null;

        // Unified evaluation loop (Plan-driven vs. List-driven)
        const sequence = plan || equations;

        for (const node of sequence) {
            try {
                let eq = null;
                if (plan) {
                    if (node.type !== 'EQUATION') continue; // Final evaluator usually only runs equations
                    eq = node.payload;
                } else {
                    eq = node;
                }

                // Substitution logic
                let subStr = eq.rhs;
                const sortedKeys = Object.keys(scope).sort((a,b) => b.length - a.length);
                for (const k of sortedKeys) {
                    if (scope[k] !== undefined && scope[k] !== null && typeof scope[k] !== 'object') {
                        let valFormat = typeof scope[k] === 'number' ? Number((scope[k]).toFixed(6)).toString() : scope[k];
                        subStr = subStr.split(new RegExp('\\b' + k + '\\b')).join(valFormat);
                    }
                }

                const value = math.evaluate(eq.rhs, scope);
                const lhs = eq.lhs_token || eq.lhs;
                scope[lhs] = value;
                results[lhs] = value;

                calculation_steps.push({
                    lhs: lhs,
                    formula_name: eq.formula_name || 'Формула',
                    raw: eq.rhs,
                    latex: eq.latex,
                    substituted: subStr,
                    result: value
                });
            } catch (e) {
                const eq = plan ? node.payload : node;
                const lhs = eq.lhs_token || eq.lhs;
                if (!options.silent) {
                    console.error(`Failed to evaluate ${lhs} = ${eq.rhs}:`, e.message);
                }
                if (lhs) results[lhs] = null;
            }
        }

        // Extract meta tags from equations if available
        let metaMKey = null;
        let metaGKey = null;
        sequence.forEach(node => {
            const eq = node.payload || node;
            const lhs = eq.lhs_token || eq.lhs;
            if (eq.is_final_M || eq.output_type === 'M') metaMKey = lhs;
            if (eq.is_final_G || eq.output_type === 'G') metaGKey = lhs;
        });

        const pickOutputKey = (preferredKeys, prefix) => {
            const resultKeys = Object.keys(results);
            for (const key of preferredKeys) {
                if (Object.prototype.hasOwnProperty.call(results, key)) {
                    return key;
                }
            }
            return resultKeys.find(k => k.startsWith(prefix));
        };

        // Standard M/G extraction (with meta priority). Prefer exact final outputs
        // before intermediate structural values such as G_zak or M_recv.
        const mKey = metaMKey || pickOutputKey([
            'M', 'M_i', 'M_equip', 'M_wastewater', 'M_sludge', 'M_gas_station'
        ], 'M_');
        const gKey = metaGKey || pickOutputKey([
            'G', 'G_i', 'G_equip', 'G_wastewater', 'G_sludge', 'G_gas_station',
            'G_station_total', 'G_adj'
        ], 'G_');

        // Map of all individual pollutants found in results (anything starting with M_ or G_)
        const pollutants = {};
        const structuralBases = [
            'total', 'equip', 'wastewater', 'sludge', 'gas_station', 'station_total', 
            'receive', 'refuel', 'adj', 'i', 'module', 'net', 'gross',
            'avg', 'max', 'min', 'part', 'branch',
            'trans', 'storage', 'annual', 'filling', 'unloading'
        ];

        Object.keys(results).forEach(k => {
            if (k.startsWith('M_') || k.startsWith('G_')) {
                const base = k.substring(2);
                if (structuralBases.includes(base)) return; // Skip structural totals

                if (!pollutants[base]) pollutants[base] = {};
                pollutants[base][k.startsWith('M_') ? 'M' : 'G'] = results[k];
            }
        });

        return {
            results,
            calculation_steps,
            trace: {
                equations: calculation_steps,
                conversions: (options.auditTrail ? options.auditTrail.conversions : [])
            },
            M: mKey ? results[mKey] : null,
            G: gKey ? results[gKey] : null,
            mKey: mKey || 'M',
            gKey: gKey || 'G',
            pollutants // { "SO2": { M: val, G: val }, "ash": { ... } }
        };
    }

    /**
     * Convenience wrapper to filter and evaluate.
     */
    function evaluateFormulaCode(activeEquations, formulaCode, variableValues, options = {}, methodicData = null) {
        const eqs = getEquationsForCode(activeEquations, formulaCode);
        return evaluate(eqs, variableValues, options, methodicData);
    }

    /**
     * Map variable_ids to canonical_symbols based on the registry.
     */
    function buildMathScope(variableValues, methodicData, auditTrail = null) {
        let scope = Object.assign({}, variableValues);
        
        if (methodicData && methodicData.registries && methodicData.registries.symbols) {
            const symbols = methodicData.registries.symbols;
            const units = methodicData.registries.units || [];
            const variables = methodicData.variables || [];
            const varsList = Array.isArray(variables) ? variables : (variables.variables || []);

            for (const v of varsList) {
                if (v.symbol_id && variableValues[v.id] != null) {
                    const symbol = symbols.find(s => s.id === v.symbol_id);
                    if (symbol) {
                        let value = variableValues[v.id];
                        // Unit conversion
                        if (v.unit && symbol.base_unit && v.unit !== symbol.base_unit) {
                            const converted = convertValue(value, v.unit, symbol.base_unit, units);
                            if (auditTrail && auditTrail.conversions) {
                                auditTrail.conversions.push({
                                    variable_id: v.id,
                                    label: v.label || v.id,
                                    from: v.unit,
                                    to: symbol.base_unit,
                                    input_value: value,
                                    result_value: converted
                                });
                            }
                            value = converted;
                        }
                        scope[symbol.canonical_symbol] = value;
                    }
                }
            }
        }
        return scope;
    }

    /**
     * Convert a value between units using the global units registry.
     */
    function convertValue(value, fromUnitId, toUnitId, unitsRegistry) {
        if (fromUnitId === toUnitId) return value;
        
        const fromUnit = unitsRegistry.find(u => u.id === fromUnitId || (u.aliases && u.aliases.includes(fromUnitId)));
        const toUnit = unitsRegistry.find(u => u.id === toUnitId || (u.aliases && u.aliases.includes(toUnitId)));
        
        if (!fromUnit || !toUnit) return value;

        // Convert to base unit first
        let baseValue = value;
        if (fromUnit.to_base) baseValue *= fromUnit.to_base;
        if (fromUnit.offset_from_base) baseValue += fromUnit.offset_from_base;

        // Convert from base unit to target unit
        let targetValue = baseValue;
        if (toUnit.offset_from_base) targetValue -= toUnit.offset_from_base;
        if (toUnit.to_base) targetValue /= toUnit.to_base;

        return targetValue;
    }

    return {
        getEquationsForCode,
        evaluate,
        evaluateFormulaCode,
        convertValue,
        buildMathScope
    };
})();
