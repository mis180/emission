/**
 * validation.js — Data-driven validation engine for emissions calculations.
 * 
 * Provides:
 * - Field state calculation (empty, valid, invalid, warning).
 * - Standard rules (range, integer, percent, lat/lng).
 * - Cross-field rules (lessThan, sum).
 * - Warning thresholds for "unusually high" values.
 */

const Validation = (() => {

    /**
     * Constants for field states
     */
    const STATES = {
        EMPTY: 'empty',
        VALID: 'valid',
        INVALID: 'invalid',
        WARNING: 'warning',
        PENDING: 'pending' // Required but not yet entered
    };

    /**
     * Core validation rules
     */
    const RULES = {
        required: (v) => v !== null && v !== undefined && v !== '',
        
        number: (v) => !isNaN(parseFloat(v)) && isFinite(v),
        
        integer: (v) => Number.isInteger(parseFloat(v)),
        
        range: (v, min, max) => {
            const val = parseFloat(v);
            if (min !== null && val < min) return false;
            if (max !== null && val > max) return false;
            return true;
        },

        latitude: (v) => {
            const val = parseFloat(v);
            return val >= -90 && val <= 90;
        },

        longitude: (v) => {
            const val = parseFloat(v);
            return val >= -180 && val <= 180;
        },

        percent: (v) => {
            const val = parseFloat(v);
            return val >= 0 && val <= 100;
        }
    };

    /**
     * Validate a single field based on its metadata and current value.
     * 
     * @param {Object} metadata - Variable/Question metadata (required, min, max, type, etc.)
     * @param {any} value - Current value
     * @returns {Object} { state, message }
     */
    function validateField(metadata, value) {
        const isSet = RULES.required(value);

        if (!isSet) {
            if (metadata.required !== false) {
                return { state: STATES.PENDING, message: 'Обязательное поле' };
            }
            return { state: STATES.EMPTY, message: null };
        }

        // Numeric checks (skip if explicitly marked as text or select)
        if (metadata.type !== 'select' && metadata.type !== 'text') {
            if (!RULES.number(value)) {
                return { state: STATES.INVALID, message: 'Должно быть числом' };
            }

            const val = parseFloat(value);

            // Integer check
            if (metadata.integer_only || metadata.variable_id?.includes('count')) {
                if (!RULES.integer(value)) {
                    return { state: STATES.INVALID, message: 'Должно быть целым числом' };
                }
            }

            // Range check
            if (metadata.min !== null || metadata.max !== null) {
                if (!RULES.range(val, metadata.min, metadata.max)) {
                    let msg = 'Значение вне диапазона';
                    if (metadata.min !== null && metadata.max !== null) msg = `Должно быть от ${metadata.min} до ${metadata.max}`;
                    else if (metadata.min !== null) msg = `Должно быть не менее ${metadata.min}`;
                    else if (metadata.max !== null) msg = `Должно быть не более ${metadata.max}`;
                    return { state: STATES.INVALID, message: msg };
                }
            }

            // Hardcoded Domain Rules
            if (metadata.variable_id === 'lat' || metadata.label?.toLowerCase().includes('широта')) {
                if (!RULES.latitude(val)) return { state: STATES.INVALID, message: 'Широта должна быть от -90 до 90' };
            }
            if (metadata.variable_id === 'lng' || metadata.label?.toLowerCase().includes('долгота')) {
                if (!RULES.longitude(val)) return { state: STATES.INVALID, message: 'Долгота должна быть от -180 до 180' };
            }
            if (metadata.unit === '%' || metadata.label?.toLowerCase().includes('процент')) {
                if (!RULES.percent(val)) return { state: STATES.INVALID, message: 'Должно быть от 0 до 100%' };
            }

            // Warning Thresholds (Example: Operating time T > 8760)
            if ((metadata.variable_id === 'T' || metadata.token === 'T') && val > 8760) {
                return { state: STATES.WARNING, message: 'Время работы превышает количество часов в году (8760)' };
            }
        }

        return { state: STATES.VALID, message: null };
    }

    /**
     * Validate cross-field constraints.
     * 
     * @param {Object} inputs - All current inputs
     * @param {Array} questions - Visible questions in current step
     * @returns {Array} List of { varId, state, message }
     */
    function validateCrossField(inputs, questions) {
        const results = [];

        // Rule: t_min < t_max
        const tMinQ = questions.find(q => q.variable_id?.includes('t_min') || q.token === 't_min');
        const tMaxQ = questions.find(q => q.variable_id?.includes('t_max') || q.token === 't_max');

        if (tMinQ && tMaxQ) {
            const vMin = parseFloat(inputs[tMinQ.variable_id]);
            const vMax = parseFloat(inputs[tMaxQ.variable_id]);

            if (!isNaN(vMin) && !isNaN(vMax) && vMin >= vMax) {
                results.push({
                    varId: tMaxQ.variable_id,
                    state: STATES.INVALID,
                    message: 'Макс. температура должна быть строго больше мин. температуры'
                });
            }
        }

        return results;
    }

    /**
     * Validate composition total.
     * 
     * @param {Array} composition - Array of { name, pct }
     * @returns {Object} { valid, total, message, state }
     */
    function validateComposition(composition) {
        if (!composition || composition.length === 0) {
            return { valid: false, total: 0, message: 'Состав не заполнен', state: STATES.INVALID };
        }

        const total = composition.reduce((sum, item) => sum + (parseFloat(item.pct) || 0), 0);
        const tolerance = 0.01;
        const diff = Math.abs(100 - total);

        if (diff > tolerance) {
            const msg = total > 100 ? `Превышение 100% (сумма: ${total.toFixed(2)}%)` : `Сумма меньше 100% (сумма: ${total.toFixed(2)}%)`;
            return { valid: false, total, message: msg, state: STATES.INVALID };
        }

        return { valid: true, total, message: 'Сумма 100% (ОК)', state: STATES.VALID };
    }

    return {
        STATES,
        validateField,
        validateCrossField,
        validateComposition
    };
})();
