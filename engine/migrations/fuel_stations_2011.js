/**
 * Migration handler for fuel_stations_2011 methodology.
 * This file is isolated to prevent bloating the core ProjectStore.
 */
const FuelStations2011Migration = {
    methodic_id: 'fuel_stations_2011',

    migrateSource(src) {
        if (!src) return;

        const legacyMethodToFormula = {
            combined: '7.1_combined',
            receive: '7.1_receive',
            refuel: '7.1_refuel',
            storage: '7.1_storage',
            gas_discharge: '7.2',
            flanges: '6.1',
            equipment: '6.2',
            stationary_seals: '6.3',
            sample_purge: '6.4.1',
            relief_valves: '6.4',
            wastewater: '6.5',
            sludge: '6.6',
            industrial_general_4_1: '4.1',
            turnover_helper: '4.1.13',
            oil_gasoline_r38: '4.2',
            pollutant_split: '4.2_split',
            pure_substance: '4.3',
            known_mixture: '4.4',
            gas_in_water: '4.5',
            other_products_c20: '4.6'
        };

        const sourceTypeToFormula = {
            azs_combined: '7.1_combined',
            azs_tank_receiving: '7.1_receive',
            azs_vehicle_refueling: '7.1_refuel',
            azs_tank_storage: '7.1_storage',
            azgs_gas: '7.2'
        };

        const formulaToSourceType = {
            '7.1_combined': 'azs_combined',
            '7.1_receive': 'azs_tank_receiving',
            '7.1_refuel': 'azs_vehicle_refueling',
            '7.1_storage': 'azs_tank_storage',
            '7.2': 'azgs_gas'
        };

        const rawMethod = String(src.calc_method || '').toLowerCase();
        const methodFormula = legacyMethodToFormula[rawMethod];

        // Normalize legacy aliases to canonical source types.
        if (src.source_type === 'agzs' || src.source_type === 'azgs') {
            src.source_type = 'azgs_gas';
        }

        // Convert legacy method names to formula codes.
        if (methodFormula) {
            if (!src.formula_code || src.formula_code === rawMethod) {
                src.formula_code = methodFormula;
            }
            src.calc_method = methodFormula;
        }

        // Migrate legacy azs + method pair into semantic source_type.
        if (src.source_type === 'azs') {
            const fc = src.formula_code || methodFormula;
            if (fc && formulaToSourceType[fc]) {
                src.source_type = formulaToSourceType[fc];
            }
        }

        // Keep calc_method and formula_code canonical where possible.
        if (!src.formula_code && sourceTypeToFormula[src.source_type]) {
            src.formula_code = sourceTypeToFormula[src.source_type];
        }

        if (src.formula_code) {
            if (formulaToSourceType[src.formula_code] && (src.source_type === 'azs' || !src.source_type)) {
                src.source_type = formulaToSourceType[src.formula_code];
            }
            if (!src.calc_method || src.calc_method === '_default' || legacyMethodToFormula[String(src.calc_method).toLowerCase()]) {
                src.calc_method = src.formula_code;
            }
        }

        if (sourceTypeToFormula[src.source_type] && (!src.calc_method || src.calc_method === '_default')) {
            src.calc_method = sourceTypeToFormula[src.source_type];
        }
    },

    validateSourceCompatibility(fac, sourceData, ignoreSourceId = null) {
        if (!fac) return { valid: false, message: 'Facility context not found.' };

        const formulaCode = sourceData && sourceData.formula_code;
        if (!['7.1_combined', '7.1_storage'].includes(formulaCode)) {
            return { valid: true };
        }

        const conflictingFormula = formulaCode === '7.1_combined' ? '7.1_storage' : '7.1_combined';
        const conflict = (fac.sources || []).find(src =>
            src &&
            src.id !== ignoreSourceId &&
            (src.methodic_id === 'fuel_stations_2011' || src.methodic_name === 'fuel_stations_2011') &&
            src.formula_code === conflictingFormula
        );

        if (!conflict) return { valid: true };

        return {
            valid: false,
            conflict_source_id: conflict.id,
            conflict_formula_code: conflictingFormula,
            message: formulaCode === '7.1_combined'
                ? '7.1_combined already includes tank storage losses. Remove the separate 7.1_storage source for this facility or use separate receiving/refueling methods.'
                : 'This facility already has 7.1_combined, which includes tank storage losses. Adding 7.1_storage separately would double-count storage.'
        };
    }
};
