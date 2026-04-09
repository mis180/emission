/**
 * composition.js — Pollutant splitting and composition rules
 */
const Composition = (() => {
    function getDefault(methodicData, sourceType, calcMethod, inputs = {}) {
        const compositions = methodicData && methodicData.composition ? methodicData.composition : {
            'default': [
                { name: 'Загрязняющее вещество (всего)', pct: 100 }
            ]
        };
        
        const src = sourceType || '';
        const substance = inputs.substance || '';
        
        let compKey = 'default';
        
        // 1. Specific substance match (e.g. gasoline_auto)
        if (substance && compositions[substance]) {
            compKey = substance;
        } 
        // 2. Source-type + substance map (e.g. azs_tank_receiving_gasoline)
        else if (substance && compositions[`${src}_${substance}`]) {
            compKey = `${src}_${substance}`;
        }
        // 3. Fallbacks
        else if (src.includes('kerosene') || calcMethod === 'other_products_C20') {
            compKey = 'kerosene';
        } else if (compositions[src]) {
            compKey = src;
        }

        const compSource = compositions[compKey] || compositions['default'] || [];
        return compSource.map(c => ({...c}));
    }

    return {
        getDefault
    };
})();
