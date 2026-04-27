/**
 * seed-loader.js — Hydrates a project from a seed config via ProjectStore APIs.
 */

const SeedLoader = (() => {
    
    async function startFromSeed(seedUrl, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        try {
            if (typeof showToast === 'function') showToast('Загрузка шаблона...', 'info');
            
            const cacheBuster = `?v=${typeof APP_VERSION !== 'undefined' ? APP_VERSION : Date.now()}`;
            const res = await fetch(seedUrl + cacheBuster);
            if (!res.ok) throw new Error('Не удалось загрузить файл шаблона');
            
            const seedData = await res.json();
            await hydrateSeed(seedData);
            
            showToast('Шаблон успешно применен', 'info');
            if (typeof showProjectDashboard === 'function') showProjectDashboard();
            
        } catch (e) {
            console.error('[SeedLoader] Error loading seed:', e);
            showToast('Ошибка загрузки шаблона: ' + e.message, 'danger');
        }
    }

    async function hydrateSeed(seedData) {
        // Create the facility using the seed data
        const facData = seedData.facility || {};
        const equipment = seedData.equipmentProfile || {};
        
        // Pass equipment inside data, ProjectStore will save it.
        // Wait, ProjectStore.addFacility saves the facility. We should pass the workflowVersion and everything.
        const newFac = ProjectStore.addFacility({
            name: facData.name,
            type: facData.type,
            subtype: facData.subtype,
            phase: facData.phase,
            workflowVersion: facData.workflowVersion,
            equipmentProfile: equipment
        });

        // Add sources from seed
        if (seedData.sources_template && Array.isArray(seedData.sources_template)) {
            const facId = newFac.id;
            for (const sourceTpl of seedData.sources_template) {
                // Determine methodic name from registry if possible
                let mName = null;
                if (sourceTpl.methodic_id && window.getMethodicRegistry) {
                    const m = window.getMethodicRegistry().find(m => m.id === sourceTpl.methodic_id);
                    if (m) mName = m.name;
                }

                ProjectStore.addSourceToFacility(facId, {
                    name: sourceTpl.name,
                    source_number: sourceTpl.source_number,
                    methodic_id: sourceTpl.methodic_id || null,
                    methodic_name: mName,
                    source_type: sourceTpl.source_type || null,
                    calc_method: sourceTpl.calc_method || null,
                    formula_code: sourceTpl.formula_code || null,
                    _is_template: sourceTpl._is_template !== undefined ? sourceTpl._is_template : true,
                    _is_not_implemented: sourceTpl._is_not_implemented || false
                });
            }
        }
        
        // Also update the store if needed
        const fac = ProjectStore.getFacility(newFac.id);
        if (fac) {
            // Force the _is_template flag on the added sources since addSourceToFacility might not persist it directly unless modified
            fac.sources.forEach((s, idx) => {
                if (seedData.sources_template[idx] && seedData.sources_template[idx]._is_template) {
                    s._is_template = true;
                }
            });
            fac.equipmentProfile = equipment;
            fac.workflowVersion = facData.workflowVersion;
            ProjectStore.updateFacility(fac.id, fac); // force save
        }
        
        return newFac;
    }

    return {
        startFromSeed,
        hydrateSeed
    };
})();
