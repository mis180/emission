/**
 * composition.js — Pollutant splitting and composition rules
 */
const Composition = (() => {
    function getDefault(methodicData, sourceType, calcMethod) {
        const compositions = methodicData && methodicData.composition ? methodicData.composition : {
            'default': [
                { name: 'Загрязняющее вещество (всего)', pct: 100 }
            ]
        };
        
        const src = sourceType || '';
        let compKey = 'default';
        if (src.includes('kerosene') || calcMethod === 'other_products_C20') {
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
