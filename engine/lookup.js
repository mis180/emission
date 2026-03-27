/**
 * lookup.js — Unified table lookup + linear interpolation for coefficients
 *
 * Works with the new unified tables format where each table has:
 *   - id: unique identifier
 *   - lookup_type: "exact" | "interpolate" | "interpolate_with_filter" | "multi_key_exact"
 *   - data: flat array of row objects
 *   - interpolation: { "out_of_range": "clamp" | "fail" | "extrapolate" } (optional)
 */

const Lookup = (() => {

    /**
     * Find a table by id in the unified format.
     */
    function getTable(tablesData, tableId) {
        if (!tablesData) return null;
        const tables = tablesData.tables || [];
        return tables.find(t => t.id === tableId) || null;
    }

    /**
     * Main unified resolver — dispatches to the correct lookup strategy
     */
    function resolve(tablesData, tableId, inputMap, outputCol, preferredInterpolateKey) {
        const table = getTable(tablesData, tableId);
        if (!table) {
            return null; // Legacy fallbacks removed
        }

        const lookupType = table.lookup_type || 'exact';

        switch (lookupType) {
            case 'exact':
            case 'multi_key_exact':
                return _resolveExact(table, inputMap, outputCol);
            case 'interpolate':
                return _resolveInterpolate(table, inputMap, outputCol, preferredInterpolateKey);
            case 'interpolate_with_filter':
                return _resolveFilteredInterpolate(table, inputMap, outputCol, preferredInterpolateKey);
            case 'smart':
                return _resolveSmart(table, inputMap, outputCol, preferredInterpolateKey);
            case 'range_match':
                return _resolveRangeMatch(table, inputMap, outputCol);
            default:
                console.warn(`[Lookup] Unknown lookup_type: ${lookupType} for table ${tableId}`);
                return null;
        }
    }

    function _resolveExact(table, inputMap, outputCol) {
        const data = table.data || [];
        for (const row of data) {
            let match = true;
            const matchDetails = [];
            for (const k of (table.input_keys || [])) {
                const v = inputMap[k];
                if (v == null) { match = false; break; }
                const rv = row[k];
                if (rv == null) { match = false; break; }
                
                const rvStr = String(rv);
                const vStr = String(v);
                if (rvStr !== vStr && !rvStr.split(',').map(s => s.trim()).includes(vStr)) {
                    match = false;
                    break;
                }
                matchDetails.push(`${k}=${v}`);
            }
            if (match) {
                const oc = outputCol || (table.output_keys && table.output_keys[0]);
                const res = oc ? (row[oc] != null ? row[oc] : null) : row;
                return {
                    value: res,
                    trace: `Точное совпадение: ${matchDetails.join(', ')}`,
                    method: 'exact'
                };
            }
        }
        return null;
    }

    function _resolveInterpolate(table, inputMap, outputCol, preferredInterpolateKey) {
        const ik = preferredInterpolateKey || table.interpolate_key;
        if (!ik) return null;

        const queryValue = inputMap[ik];
        if (queryValue == null) return null;

        const oc = outputCol || (table.output_keys && table.output_keys[0]);
        if (!oc) return null;

        const policy = (table.interpolation && table.interpolation.out_of_range) || 'clamp';
        return _interpolateColumn(table.data || [], ik, Number(queryValue), oc, policy);
    }

    function _resolveFilteredInterpolate(table, inputMap, outputCol, preferredInterpolateKey) {
        const fk = table.filter_key;
        const ik = preferredInterpolateKey || table.interpolate_key;
        const filterVal = inputMap[fk];
        const queryValue = inputMap[ik];
        if (filterVal == null || queryValue == null) return null;

        const oc = outputCol || (table.output_keys && table.output_keys[0]);
        if (!oc) return null;

        const filtered = (table.data || []).filter(r => {
            const rv = r[fk];
            if (rv == null) return false;
            const rvStr = String(rv);
            const fvStr = String(filterVal);
            return rvStr === fvStr || rvStr.split(',').map(s => s.trim()).includes(fvStr);
        });

        const policy = (table.interpolation && table.interpolation.out_of_range) || 'clamp';
        const res = _interpolateColumn(filtered, ik, Number(queryValue), oc, policy);
        if (res && res.trace) {
            res.trace = `Фильтр [${fk}=${filterVal}] + ${res.trace}`;
        }
        return res;
    }

    function _resolveSmart(table, inputMap, outputCol, preferredInterpolateKey) {
        const exact = _resolveExact(table, inputMap, outputCol);
        if (exact) return exact;

        const ik = preferredInterpolateKey || table.interpolate_key || (table.input_keys && table.input_keys[0]);
        if (ik && !isNaN(Number(inputMap[ik]))) {
            return _resolveInterpolate(table, inputMap, outputCol, ik);
        }
        return null;
    }

    function _interpolateColumn(rows, keyCol, queryValue, valueCol, outOfRangePolicy) {
        const pts = [];
        for (const r of rows) {
            const k = r[keyCol];
            const v = r[valueCol];
            if (k == null || v == null) continue;
            const nk = Number(k);
            if (isNaN(nk)) continue;
            pts.push({ key: nk, value: v });
        }

        if (pts.length === 0) return null;
        pts.sort((a, b) => a.key - b.key);

        const exact = pts.find(p => p.key === queryValue);
        if (exact) {
            return {
                value: exact.value,
                trace: `Точное совпадение ключа ${keyCol}=${queryValue}`,
                method: 'exact'
            };
        }

        if (queryValue <= pts[0].key) {
            if (outOfRangePolicy === 'fail') return null;
            if (outOfRangePolicy === 'extrapolate' && pts.length > 1) {
                return _extrapolate(pts[0], pts[1], queryValue, keyCol);
            }
            return {
                value: pts[0].value,
                trace: `Ниже диапазона (${queryValue} < ${pts[0].key}), возвращено мин. значение`,
                method: 'clamped'
            };
        }
        if (queryValue >= pts[pts.length - 1].key) {
            if (outOfRangePolicy === 'fail') return null;
            if (outOfRangePolicy === 'extrapolate' && pts.length > 1) {
                return _extrapolate(pts[pts.length - 2], pts[pts.length - 1], queryValue, keyCol);
            }
            return {
                value: pts[pts.length - 1].value,
                trace: `Выше диапазона (${queryValue} > ${pts[pts.length - 1].key}), возвращено макс. значение`,
                method: 'clamped'
            };
        }

        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            if (queryValue >= p1.key && queryValue <= p2.key) {
                const t = (queryValue - p1.key) / (p2.key - p1.key);
                const val = p1.value + t * (p2.value - p1.value);
                return {
                    value: val,
                    trace: `Интерполяция между ${p1.key} и ${p2.key} (Вход: ${queryValue} ➔ ${val.toFixed(6)})`,
                    method: 'interpolate'
                };
            }
        }

        return null;
    }
    
    function _resolveRangeMatch(table, inputMap, outputCol) {
        const keyCol = table.input_keys[0];
        const queryValue = Number(inputMap[keyCol]);
        if (isNaN(queryValue)) return null;

        const oc = outputCol || (table.output_keys && table.output_keys[0]);
        if (!oc) return null;

        const rows = (table.data || []).map(r => ({
            key: Number(r[keyCol]),
            value: r[oc]
        })).filter(r => !isNaN(r.key) && r.value != null);

        if (rows.length === 0) return null;
        rows.sort((a, b) => a.key - b.key);

        if (queryValue < rows[0].key) {
            return {
                value: rows[0].value,
                trace: `Ниже диапазона (${queryValue} < ${rows[0].key}), возвращено мин. значение`,
                method: 'clamped'
            };
        }

        for (let i = 0; i < rows.length; i++) {
            const current = rows[i];
            const next = rows[i + 1];
            if (!next || (queryValue >= current.key && queryValue < next.key)) {
                return {
                    value: current.value,
                    trace: `Попадание в диапазон (${keyCol} = ${queryValue})`,
                    method: 'range_match'
                };
            }
        }
        return null;
    }

    function _extrapolate(p1, p2, queryValue, keyCol) {
        const slope = (p2.value - p1.value) / (p2.key - p1.key);
        const val = p1.value + slope * (queryValue - p1.key);
        return {
            value: val,
            trace: `Экстраполяция (${keyCol}=${queryValue} ➔ ${val.toFixed(6)})`,
            method: 'extrapolate'
        };
    }

    return {
        resolve,
        getTable
    };
})();
