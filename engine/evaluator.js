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
     * @returns {Object} { results: {lhs_token: value, ...}, ... }
     */
    function evaluate(equations, variableValues, options = {}) {
        // Build scope from user-provided values
        const scope = Object.assign({}, variableValues);
        const results = {};
        const calculation_steps = [];

        for (const eq of equations) {
            try {
                // ... (substitution logic remains same)
                let subStr = eq.rhs;
                const sortedKeys = Object.keys(scope).sort((a,b) => b.length - a.length);
                for (const k of sortedKeys) {
                    if (scope[k] !== undefined && scope[k] !== null) {
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
                const lhs = eq.lhs_token || eq.lhs;
                if (!options.silent) {
                    console.error(`Failed to evaluate ${lhs} = ${eq.rhs}:`, e.message);
                }
                if (lhs) results[lhs] = null;
            }
        }

        // Standard M/G extraction (common emission output names)
        const mKey = Object.keys(results).find(k =>
            k === 'M' || k === 'M_i' || k === 'M_equip' || k === 'M_wastewater' ||
            k === 'M_sludge' || k === 'M_gas_station' || k.startsWith('M_')
        );
        const gKey = Object.keys(results).find(k =>
            k === 'G' || k === 'G_i' || k === 'G_equip' || k === 'G_wastewater' ||
            k === 'G_sludge' || k === 'G_gas_station' || k === 'G_station_total' || k === 'G_adj' || k.startsWith('G_')
        );

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
            M: mKey ? results[mKey] : null,
            G: gKey ? results[gKey] : null,
            mKey: mKey || 'M',
            gKey: gKey || 'G',
            pollutants // { "SO2": { M: val, G: val }, "ash": { ... } }
        };
    }

    /**
     * Convenience: load equations for a formula code and evaluate.
     */
    function evaluateFormulaCode(activeEquations, formulaCode, variableValues) {
        const equations = getEquationsForCode(activeEquations, formulaCode);
        if (equations.length === 0) {
            console.warn(`No equations found for formula code: ${formulaCode}`);
            return { results: {}, M: null, G: null, mKey: 'M', gKey: 'G' };
        }
        return evaluate(equations, variableValues);
    }

    return {
        getEquationsForCode,
        evaluate,
        evaluateFormulaCode
    };
})();
