/**
 * LookupEngine.js  — v2
 * First-class resolution engine for regulatory lookups.
 *
 * Resolver modes (schema_version 2):
 *   exact       — categorical matching on any number of selector columns
 *   interpolate — linear interpolation on a numeric axis; selectors used as pre-filters
 *   range       — explicit [min, max) interval matching; selectors used as pre-filters
 *
 * Legacy v1 type names (multi_key_exact, interpolate_with_filter, range_match) are
 * normalised transparently during migration. Remove legacy entries from
 * _normalizeResolutionMode() after all tables have been migrated to v2.
 *
 * Features:
 *   - Strategy-based matching (Exact, Interpolate, Range)
 *   - Normalisation via Enum Registry (aliases, localised keys)
 *   - Structured traceability for regulatory audit
 *   - Explicit failure policies (error, warn, warn_and_null)
 *   - Explicit boundary policies per table (clamp, error, warn_and_clamp)
 *   - Unit awareness for output values
 */

class LookupEngine {
    constructor(methodicData) {
        this.tables = (methodicData.tables && methodicData.tables.tables)
            ? methodicData.tables.tables
            : (Array.isArray(methodicData.tables) ? methodicData.tables : []);

        this.enums = Array.isArray(methodicData.enums)
            ? methodicData.enums
            : (methodicData.enums && methodicData.enums.enums ? methodicData.enums.enums : []);

        this.strategies = {
            'exact':       new ExactMatchStrategy(this),
            'interpolate': new InterpolationStrategy(this),
            'range':       new RangeMatchStrategy(this)
        };
    }

    /**
     * Resolve a lookup request.
     * @param {string} tableId
     * @param {Object} inputs - Key/Value pairs of input variables
     * @param {string} outputKey - The specific column to return
     * @returns {Object} { value, trace, tableMeta, unit }
     */
    resolve(tableId, inputs, outputKey) {
        const table = this.tables.find(t => t.table_id === tableId || t.id === tableId);
        if (!table) {
            throw new Error(`[LookupEngine] Table not found: ${tableId}`);
        }

        // Support v2 schema strictly
        const mode = this._normalizeResolutionMode(table.resolution);
        const strategy = this.strategies[mode];
        if (!strategy) {
            throw new Error(`[LookupEngine] Unsupported resolution mode: "${mode}" (table: ${table.table_id || table.id})`);
        }

        const resolution = strategy.execute(table, inputs, outputKey);

        if (!resolution || resolution.value === null || resolution.value === undefined) {
            return this._handleMissing(table, tableId, inputs);
        }

        // Attach table-level metadata to the trace
        resolution.tableMeta = {
            id:        table.table_id || table.id,
            title:     table.title,
            authority: table.authority,
            source:    table.source
        };

        // Resolve unit for the output key
        const outputMeta = (table.outputs || []).find(o => o.name === outputKey);
        resolution.unit = outputMeta ? outputMeta.unit_id : null;

        return resolution;
    }

    /**
     * Normalise resolution mode keys and enforce validity.
     */
    _normalizeResolutionMode(raw) {
        const validModes = {
            'exact': true,
            'interpolate': true,
            'range': true
        };
        if (!validModes[raw]) {
            throw new Error(`[LookupEngine] Unknown resolution mode: ${raw}`);
        }
        return raw;
    }

    _handleMissing(table, tableId, inputs) {
        const policy = table.missing_policy || 'error';
        const msg = `No match found in table ${tableId} for inputs: ${JSON.stringify(inputs)}`;

        if (policy === 'error') {
            throw new Error(`[LookupEngine] ${msg}`);
        }
        if (policy === 'default_zero') {
            console.warn(`[LookupEngine] default_zero is deprecated for normative tables. Returning null. ${msg}`);
            return { value: null, trace: 'No match found (policy: default_zero deprecated)', status: 'missing' };
        }
        if (policy === 'warn' || policy === 'warn_and_null') {
            console.warn(`[LookupEngine] ${msg}`);
            return { value: null, trace: 'No match found (policy: warn)', status: 'missing' };
        }
        return { value: null, trace: 'No match found', status: 'missing' };
    }

    /**
     * Get all possible valid representations of a value for table matching.
     * Returns an array of candidates: [normalised_id, label, alias1, alias2, ...]
     */
    getMatchCandidates(enumId, value) {
        if (!enumId || value == null) return [value];
        const registry = this.enums.find(e => e.id === enumId);
        if (!registry) return [value];

        const valStr = String(value).toLowerCase().trim();
        const found = registry.values.find(v =>
            v.value.toLowerCase() === valStr ||
            (v.label && v.label.toLowerCase() === valStr) ||
            (v.aliases && v.aliases.some(a => a.toLowerCase() === valStr))
        );

        if (found) {
            const result = new Set();
            result.add(found.value);
            if (found.label) result.add(found.label);
            if (found.aliases) found.aliases.forEach(a => result.add(a));
            return Array.from(result);
        }

        return [value];
    }
}

// ---------------------------------------------------------------------------
// Base strategy
// ---------------------------------------------------------------------------

class LookupStrategy {
    constructor(engine) {
        this.engine = engine;
    }
}

// ---------------------------------------------------------------------------
// ExactMatchStrategy
// Handles resolution: "exact"
// Reads v2 fields (selectors, rows) strictly.
// ---------------------------------------------------------------------------

class ExactMatchStrategy extends LookupStrategy {
    execute(table, inputs, outputKey) {
        const data = table.rows || [];
        const keys = table.selectors || [];

        for (const row of data) {
            let match = true;
            const traceInputs = [];

            for (const keyDef of keys) {
                const colName = typeof keyDef === 'string' ? keyDef : keyDef.name;
                const enumId  = typeof keyDef === 'string' ? null  : keyDef.enum_id;

                const rawInput   = inputs[colName];
                const candidates = this.engine.getMatchCandidates(enumId, rawInput);
                const rowValue   = row[colName];

                const isMatch = candidates.some(cand =>
                    String(cand).toLowerCase() === String(rowValue).toLowerCase()
                );

                if (!isMatch) { match = false; break; }
                traceInputs.push(`${colName}=${rowValue}`);
            }

            if (match) {
                return {
                    value:  row[outputKey],
                    trace:  `Exact match: ${traceInputs.join(', ')}`,
                    method: 'exact'
                };
            }
        }

        console.warn(`[LookupEngine] No exact match in ${table.table_id || table.id}. Inputs:`, inputs);
        return null;
    }
}

// ---------------------------------------------------------------------------
// InterpolationStrategy
// Handles resolution: "interpolate"
// Reads v2 axis object strictly.
// ---------------------------------------------------------------------------

class InterpolationStrategy extends LookupStrategy {
    execute(table, inputs, outputKey) {
        // Resolve the axis field name
        const axis = table.axis || {};
        const ik   = axis.field || axis.name;
        if (!ik) {
            console.warn(`[LookupEngine] No axis field defined on interpolate table ${table.table_id || table.id}`);
            return null;
        }

        const queryValue = Number(inputs[ik]);
        if (isNaN(queryValue)) return null;

        // Apply categorical selectors as pre-filters
        const rawData  = table.rows || [];
        const filtered = this._applySelectors(table, rawData, inputs);

        const pts = this._extractPoints(filtered, ik, outputKey);
        if (pts.length < 2) {
            console.warn(`[LookupEngine] Insufficient interpolation points (${pts.length}) in ${table.table_id || table.id} after filtering`);
            return null;
        }

        return this._interpolate(pts, queryValue, ik, table.boundary_policy);
    }

    /**
     * Apply categorical selectors as row pre-filters.
     */
    _applySelectors(table, data, inputs) {
        const selectors = table.selectors || [];
        
        if (selectors.length === 0) return data;

        return data.filter(row => {
            for (const sel of selectors) {
                const col      = typeof sel === 'string' ? sel : sel.name;
                const enumId   = (typeof sel === 'object' && sel.enum_id) ? sel.enum_id : null;
                const rawInput = inputs[col];
                if (rawInput == null) continue; // selector not provided → skip filter
                const candidates = this.engine.getMatchCandidates(enumId, rawInput);
                const cSet = new Set(candidates.map(c => String(c).toLowerCase()));
                if (!cSet.has(String(row[col]).toLowerCase())) return false;
            }
            return true;
        });
    }

    _extractPoints(data, ik, ok) {
        return (data || [])
            .map(r => ({ key: Number(r[ik]), value: Number(r[ok]) }))
            .filter(p => !isNaN(p.key) && !isNaN(p.value))
            .sort((a, b) => a.key - b.key);
    }

    /**
     * Linear interpolation with explicit boundary policy.
     * boundary_policy: "clamp" (default) | "error" | "warn_and_clamp"
     */
    _interpolate(pts, queryValue, ik, boundaryPolicy) {
        const policy = boundaryPolicy || 'clamp';

        if (queryValue <= pts[0].key) {
            if (policy === 'error') {
                throw new Error(`[LookupEngine] ${ik}=${queryValue} is below interpolation range (min=${pts[0].key})`);
            }
            if (policy === 'warn_and_clamp') {
                console.warn(`[LookupEngine] ${ik}=${queryValue} clamped to min=${pts[0].key}`);
            }
            return { value: pts[0].value, trace: `Clamped to min (${queryValue} <= ${pts[0].key})`, method: 'clamped' };
        }

        if (queryValue >= pts[pts.length - 1].key) {
            if (policy === 'error') {
                throw new Error(`[LookupEngine] ${ik}=${queryValue} is above interpolation range (max=${pts[pts.length - 1].key})`);
            }
            if (policy === 'warn_and_clamp') {
                console.warn(`[LookupEngine] ${ik}=${queryValue} clamped to max=${pts[pts.length - 1].key}`);
            }
            return { value: pts[pts.length - 1].value, trace: `Clamped to max (${queryValue} >= ${pts[pts.length - 1].key})`, method: 'clamped' };
        }

        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            if (queryValue >= p1.key && queryValue <= p2.key) {
                const t   = (queryValue - p1.key) / (p2.key - p1.key);
                const val = p1.value + t * (p2.value - p1.value);
                return {
                    value:  val,
                    trace:  `Linear interpolation between ${p1.key} and ${p2.key} for ${ik}=${queryValue}`,
                    method: 'interpolate'
                };
            }
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// RangeMatchStrategy
// Handles resolution: "range"
// Explicit [min, max) bounds ONLY.
// ---------------------------------------------------------------------------

class RangeMatchStrategy extends LookupStrategy {
    execute(table, inputs, outputKey) {
        const data = table.rows || [];

        // Resolve axis field names
        const axis        = table.axis || {};
        const rangeKey    = axis.name;
        const rangeMinKey = axis.min_field;
        const rangeMaxKey = axis.max_field;

        if (!rangeKey || !rangeMinKey || !rangeMaxKey) {
            console.warn(`[LookupEngine] Missing axis name or bounds fields on range table ${table.table_id || table.id}`);
            return null;
        }

        const queryValue = Number(inputs[rangeKey]);
        if (isNaN(queryValue)) return null;

        // Apply categorical pre-filters
        const selectors = table.selectors || [];
        
        let filtered = data;
        if (selectors.length > 0) {
            filtered = data.filter(row => {
                for (const sel of selectors) {
                    const col    = typeof sel === 'string' ? sel : sel.name;
                    const enumId = (typeof sel === 'object' && sel.enum_id) ? sel.enum_id : null;
                    if (!(col in inputs)) continue;
                    const candidates = this.engine.getMatchCandidates(enumId, inputs[col]);
                    const cSet = new Set(candidates.map(c => String(c).toLowerCase()));
                    if (!cSet.has(String(row[col]).toLowerCase())) return false;
                }
                return true;
            });
        }

        const rows = filtered.length > 0 ? filtered : data;
        return this._matchExplicitRange(rows, rangeKey, rangeMinKey, rangeMaxKey, queryValue, outputKey);
    }

    _matchExplicitRange(rows, rangeKey, rangeMinKey, rangeMaxKey, queryValue, outputKey) {
        const sorted = rows
            .map(row => ({
                row,
                min: row[rangeMinKey] == null || row[rangeMinKey] === '' ? Number.NEGATIVE_INFINITY : Number(row[rangeMinKey]),
                max: row[rangeMaxKey] == null || row[rangeMaxKey] === '' ? Number.POSITIVE_INFINITY : Number(row[rangeMaxKey])
            }))
            .filter(item => !isNaN(item.min) && !isNaN(item.max))
            .sort((a, b) => a.min - b.min);

        for (let i = 0; i < sorted.length; i++) {
            const current = sorted[i];
            const next    = sorted[i + 1];
            const nextStartsHere = next && next.min === queryValue;

            // Standard [min, max) interval
            if (queryValue >= current.min && queryValue < current.max) {
                return {
                    value:  current.row[outputKey],
                    trace:  `Range match: ${rangeKey}=${queryValue} in [${current.min}, ${current.max})`,
                    method: 'range'
                };
            }

            // Handle exact upper-bound hit when no next interval starts there
            if (!nextStartsHere && queryValue === current.max) {
                return {
                    value:  current.row[outputKey],
                    trace:  `Range match: ${rangeKey}=${queryValue} at upper bound ${current.max}`,
                    method: 'range'
                };
            }
        }

        return null;
    }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LookupEngine;
} else {
    window.LookupEngine = LookupEngine;
}
