async function runLookupTests() {
    logMsg('\n--- Running Lookup Tests ---');

    const mockTablesData = {
        tables: [
            {
                id: "exact_table",
                lookup_type: "exact",
                input_keys: ["type"],
                output_keys: ["factor"],
                data: [
                    { type: "gas", factor: 1.5 },
                    { type: "oil", factor: 2.5 }
                ]
            },
            {
                id: "interp_table",
                lookup_type: "interpolate",
                interpolate_key: "temp",
                output_keys: ["density"],
                interpolation: { out_of_range: "clamp" },
                data: [
                    { temp: 10, density: 100 },
                    { temp: 20, density: 200 }
                ]
            },
            {
                id: "range_table",
                lookup_type: "range_match",
                input_keys: ["size"],
                output_keys: ["coef"],
                data: [
                    { size: 0, coef: 0.1 },
                    { size: 50, coef: 0.5 },
                    { size: 100, coef: 1.0 }
                ]
            }
        ]
    };

    // Exact match
    const r1 = Lookup.resolve(mockTablesData, "exact_table", { type: "oil" }, "factor");
    assert(r1 && r1.value === 2.5, "Exact match resolves correctly");

    const r2 = Lookup.resolve(mockTablesData, "exact_table", { type: "coal" }, "factor");
    assertEq(r2, null, "Mismatch exact returns null");

    // Interpolation
    const r3 = Lookup.resolve(mockTablesData, "interp_table", { temp: 15 }, "density");
    assert(r3 && r3.value === 150, "Interpolation midpoint resolves correctly");

    const r4 = Lookup.resolve(mockTablesData, "interp_table", { temp: 5 }, "density");
    assert(r4 && r4.value === 100, "Interpolation clamp lower resolves correctly");

    const r5 = Lookup.resolve(mockTablesData, "interp_table", { temp: 30 }, "density");
    assert(r5 && r5.value === 200, "Interpolation clamp upper resolves correctly");

    // Range match
    const r6 = Lookup.resolve(mockTablesData, "range_table", { size: 25 }, "coef");
    assert(r6 && r6.value === 0.1, "Range match bucket 1 resolves correctly");

    const r7 = Lookup.resolve(mockTablesData, "range_table", { size: 75 }, "coef");
    assert(r7 && r7.value === 0.5, "Range match bucket 2 resolves correctly");

    logMsg('--- Lookup Tests Complete ---');
}
