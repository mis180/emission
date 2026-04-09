async function runProjectStoreTests() {
    logMsg('\n--- Running ProjectStore Tests ---');

    ProjectStore.clear();

    const initialState = ProjectStore.getState();
    assertEq(initialState.facilities.length, 0, "ProjectStore starts empty after clear");
    assertEq(initialState.schema_version, 2, "Schema version is set to 2");

    // Test add and read
    const fac = ProjectStore.addFacility({ name: "Test Fac", type: "other" });
    assert(fac && fac.id.startsWith("fac_"), "Facility created with ID");
    
    ProjectStore.addSourceToFacility(fac.id, { name: "Test Source 1", results: { M: 1.5, G: 2.5 } });
    
    let totals = ProjectStore.getProjectTotals();
    assertEq(totals.totalM, 1.5, "Project M total calculates correctly");
    assertEq(totals.totalG, 2.5, "Project G total calculates correctly");

    // Test import/export
    const stateJson = JSON.stringify(ProjectStore.getState());
    ProjectStore.clear();
    assertEq(ProjectStore.getState().facilities.length, 0, "State is empty before load");

    const res = ProjectStore.loadFromJSON(stateJson);
    assert(res, "loadFromJSON returned true");

    const reloadedState = ProjectStore.getState();
    assertEq(reloadedState.facilities.length, 1, "Facility reloaded");
    assertEq(reloadedState.facilities[0].sources.length, 1, "Source reloaded");
    assertEq(reloadedState.schema_version, 2, "Schema version preserved");

    // Test invalid import
    const badRes = ProjectStore.loadFromJSON('{"broken json');
    assertEq(badRes, false, "loadFromJSON handles malformed input safely");

    // Test migration and stale field pruning
    const legacyState = {
        name: "Legacy Project",
        legacy_unwanted_key: "delete_me",
        // No schema_version
        facilities: []
    };
    ProjectStore.loadFromJSON(JSON.stringify(legacyState));
    const migratedState = ProjectStore.getState();
    assertEq(migratedState.name, "Legacy Project", "Known keys imported");
    assertEq(migratedState.legacy_unwanted_key, undefined, "Unknown keys pruned");
    assertEq(migratedState.schema_version, 2, "Schema version injected");
    assert(migratedState.geo_meteo != null, "Missing complex keys receive defaults");

    logMsg('--- ProjectStore Tests Complete ---');
}
