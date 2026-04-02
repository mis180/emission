/**
 * app.js — Data-driven emissions calculator
 *
 * Thin orchestrator that wires the engine modules (Wizard, Evaluator, Lookup)
 * to the UI. No hardcoded scenarios or formulas — everything comes from JSON.
 */

// --- APP STATE --- //
let currentStep = 1;
const totalSteps = 6;

// Global Project Store is handled by engine/project-store.js

let state = {
    // Methodic selection
    methodicId: null,
    methodicPath: null,
    methodicData: null,

    // Wizard choices
    sourceType: null,
    calcMethod: null,
    formulaCode: null,

    // User inputs
    inputs: {},
    composition: [],

    // Results
    results: null,

    // Available methodics
    methodics: []
};

// --- DOM ELEMENTS --- //
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const stepperItems = document.querySelectorAll('.step');
const stepPanes = document.querySelectorAll('.step-pane');

// --- INITIALIZATION --- //
async function init() {
    btnNext.addEventListener('click', handleNext);
    btnPrev.addEventListener('click', handlePrev);

    // Load registry and render methodic cards
    try {
        const methodics = await Wizard.loadRegistry();
        state.methodics = methodics;
        renderMethodicCards(methodics);
    } catch (e) {
        console.error('Failed to load registry:', e);
        showToast('Критическая ошибка: Не удалось загрузить список методик. Убедитесь, что приложение запущено через HTTP сервер.', 'danger');
        document.getElementById('methodic-grid').innerHTML =
            '<p style="color:red;">Ошибка загрузки методик. Проверьте подключение или data/registry.json</p>';
    }

    updateNavigation();
    initProjectWorkflow();
    
    // Load from localStorage
    ProjectStore.load();
    const loadedState = ProjectStore.getState();
    const nameInput = document.getElementById('project-name');
    if (nameInput && loadedState.name) nameInput.value = loadedState.name;
    const headerName = document.getElementById('header-project-name');
    if (headerName && loadedState.name) headerName.textContent = loadedState.name;
    const latInput = document.getElementById('proj-lat');
    if (latInput && loadedState.lat) latInput.value = loadedState.lat;
    const lngInput = document.getElementById('proj-lng');
    if (lngInput && loadedState.lng) lngInput.value = loadedState.lng;
    
    // Load regions and populate dropdown
    await loadRegionsAndPopulateDropddown(loadedState.regionId);
    
    renderProjectTree();
    showProjectDashboard();

    // Global Error Handling for Async Errors
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        showToast('Произошла системная ошибка: ' + (event.reason.message || event.reason), 'danger');
    });
}

let globalRegionsData = [];

async function loadRegionsAndPopulateDropddown(savedRegionId) {
    try {
        const cacheBuster = `?v=${Date.now()}`;
        const res = await fetch('data/regions.json' + cacheBuster);
        const data = await res.json();
        globalRegionsData = data.regions || [];
        
        const select = document.getElementById('proj-region');
        if (select) {
            select.innerHTML = '<option value="">-- Выберите регион --</option>';
            globalRegionsData.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                if (savedRegionId === r.id) {
                    opt.selected = true;
                    // Initial render for sidebar
                    renderRegionDetails(r);
                }
                select.appendChild(opt);
            });
            
            select.addEventListener('change', (e) => {
                const regionId = e.target.value;
                const regionObj = globalRegionsData.find(r => r.id === regionId);
                ProjectStore.setRegion(regionId, regionObj || {});
                
                // Auto-fill coordinates if region has them
                if (regionObj && regionObj.lat && regionObj.lng) {
                    const latInput = document.getElementById('proj-lat');
                    const lngInput = document.getElementById('proj-lng');
                    if (latInput) latInput.value = regionObj.lat;
                    if (lngInput) lngInput.value = regionObj.lng;
                    ProjectStore.setCoordinates(regionObj.lat, regionObj.lng);
                }
                
                // Need to re-render if we are inside a methodic parameters tab
                if (currentStep === 1 && state.methodics && state.methodics.length > 0) {
                    renderMethodicCards(state.methodics);
                }
                
                // Render region info in sidebar
                renderRegionDetails(regionObj || {});
                
                if (currentStep === 3) {
                    renderParameters();
                }
            });
        }
    } catch (e) {
        console.error('Failed to load regions.json', e);
    }
}

/**
 * Render Region details in side panel
 */
function renderRegionDetails(region) {
    const card = document.getElementById('region-details-card');
    if (!card) return;

    if (!region || !region.id) {
        card.style.display = 'none';
        return;
    }

    const windLabels = {
        'weak': 'Слабый',
        'calm': 'Слабый',
        'moderate': 'Умеренный',
        'strong': 'Сильный'
    };

    const zoneLabels = {
        'middle': 'Средняя',
        'south': 'Южная',
        'north': 'Северная'
    };

    const windIcon = region.wind_class === 'strong' ? '💨' : (region.wind_class === 'calm' ? '🍃' : '🌬️');

    card.innerHTML = `
        <div class="project-header" style="margin-bottom: 12px; border-bottom: 2px solid var(--primary);">
            <h3 style="color: var(--primary); font-size: 0.95rem; text-transform: uppercase;">🌍 ${region.name_en || region.name}</h3>
        </div>
        <div style="font-size: 0.85rem; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px;">
            <div><small style="color: var(--text-muted);">🌡 T.max</small><br><strong>${region.t_max} °C</strong></div>
            <div><small style="color: var(--text-muted);">❄ T.min</small><br><strong>${region.t_min} °C</strong></div>
            ${region.t_avg_year != null ? `<div><small style="color: var(--text-muted);">📊 T.сред</small><br><strong>${region.t_avg_year} °C</strong></div>` : ''}
            <div><small style="color: var(--text-muted);">🗺 Климат</small><br><strong>${zoneLabels[region.climate_zone] || region.climate_zone}</strong></div>
            <div><small style="color: var(--text-muted);">${windIcon} Ветер</small><br><strong>${windLabels[region.wind_class] || region.wind_class}${region.wind_speed_avg_m_s ? ' (' + region.wind_speed_avg_m_s + ' м/с)' : ''}</strong></div>
            ${region.humidity_avg_pct != null ? `<div><small style="color: var(--text-muted);">💧 Влажность</small><br><strong>${region.humidity_avg_pct}%</strong></div>` : ''}
            ${region.elevation_m != null ? `<div><small style="color: var(--text-muted);">⛰ Высота</small><br><strong>${region.elevation_m} м</strong></div>` : ''}
            ${region.pressure_hPa != null ? `<div><small style="color: var(--text-muted);">📏 Давление</small><br><strong>${region.pressure_hPa} гПа</strong></div>` : ''}
        </div>
        ${region.lat && region.lng ? `<div style="margin-top: 8px; font-size: 0.78rem; color: var(--text-muted);">📍 ${region.lat.toFixed(4)}, ${region.lng.toFixed(4)}</div>` : ''}
        ${region.source ? `<div style="margin-top: 4px; font-size: 0.72rem; color: var(--text-muted); opacity: 0.7;">Источник: ${region.source}</div>` : ''}
    `;
    card.style.display = 'block';
    card.style.background = 'white';
    card.style.padding = '16px';
    card.style.borderRadius = '12px';
    card.style.border = '1px solid var(--border)';
    card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
}

/**
 * Global Toast Notification System
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'danger' ? '#fee2e2' : '#e0f2fe'};
        color: ${type === 'danger' ? '#991b1b' : '#0369a1'};
        border: 1px solid ${type === 'danger' ? '#fecaca' : '#bae6fd'};
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        pointer-events: auto;
        font-size: 0.9rem;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    toast.innerHTML = (type === 'danger' ? '⚠️ ' : 'ℹ️ ') + message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * Defensive KaTeX renderer helper
 */
const renderLatex = (latex) => {
    if (!latex || typeof latex !== 'string' || typeof katex === 'undefined') return latex;
    try {
        return katex.renderToString(latex, { throwOnError: false, strict: false });
    } catch (e) {
        console.warn('KaTeX rendering error:', e);
        return latex;
    }
};

// ========================================================================
// STEP 1: METHODIC SELECTION
// ========================================================================
function renderMethodicCards(methodics) {
    const grid = document.getElementById('methodic-grid');
    grid.innerHTML = '';

    if (methodics.length === 0) {
        grid.innerHTML = '<p>Нет доступных методик.</p>';
        return;
    }

    methodics.forEach(m => {
        const card = document.createElement('div');
        card.className = `scenario-card ${state.methodicId === m.id ? 'selected' : ''}`;
        card.innerHTML = `
            <h4>${m.name}</h4>
            <p><small>${m.name_en || ''}</small></p>
            <p class="mt-4"><small>Версия: <strong>${m.version}</strong> • Формулы: ${m.formula_codes.length}</small></p>
        `;
        card.addEventListener('click', async () => {
            state.methodicId = m.id;
            state.methodicPath = m.path;
            state.sourceType = null;
            state.calcMethod = null;
            state.formulaCode = null;

            // Reset all downstream state
            state.inputs = {};
            state.composition = [];
            state.results = null;

            // Clear stale UI
            const lookupPanel = document.getElementById('lookup-provenance-panel');
            if (lookupPanel) lookupPanel.style.display = 'none';
            const userGrid = document.getElementById('user-input-grid');
            if (userGrid) userGrid.innerHTML = '';
            const lookupGrid = document.getElementById('lookup-input-grid');
            if (lookupGrid) lookupGrid.innerHTML = '';
            const formulaInfo = document.getElementById('formula-info');
            if (formulaInfo) formulaInfo.style.display = 'none';

            currentStep = 1;

            // Load all methodic data
            try {
                state.methodicData = await Wizard.loadMethodic(state.methodicPath);
                document.getElementById('methodic-badge').textContent = m.name;
                renderMethodicCards(methodics); // Re-render to show selection
                updateNavigation();
            } catch (e) {
                console.error('Failed to load methodic:', e);
                showToast('Ошибка загрузки данных методики: ' + e.message, 'danger');
            }
        });
        grid.appendChild(card);
    });
}

// ========================================================================
// STEP 2: SOURCE TYPE + CALC METHOD
// ========================================================================
function renderSourceTypes() {
    if (!state.methodicData) return;

    const meta = state.methodicData.meta;
    const sourceTypes = Wizard.getSourceTypes(meta);
    const grid = document.getElementById('source-type-grid');
    if (!grid) return;
    grid.innerHTML = '';

    sourceTypes.forEach(st => {
        const card = document.createElement('div');
        card.className = `scenario-card ${state.sourceType === st.value ? 'selected' : ''}`;
        card.innerHTML = `
            <h4>${st.label}</h4>
            <p><small>Формулы: ${st.formula_codes.join(', ')}</small></p>
        `;
        card.addEventListener('click', () => {
            state.sourceType = st.value;
            state.calcMethod = null;
            state.formulaCode = null;
            renderSourceTypes();
            renderCalcMethods();
            updateNavigation();
        });
        grid.appendChild(card);
    });
}

function renderCalcMethods() {
    if (!state.sourceType || !state.methodicData || !state.methodicData.meta) return;

    const meta = state.methodicData.meta;
    const methods = Wizard.getCalcMethods(meta, state.sourceType);
    const section = document.getElementById('calc-method-section');
    const grid = document.getElementById('calc-method-grid');

    if (!methods || methods.length === 0) {
        // No sub-methods — use _default flow
        if (section) section.style.display = 'none';
        state.calcMethod = '_default';
        state.formulaCode = Wizard.getFormulaCode(
            state.methodicData.questions, state.sourceType, '_default'
        );
        updateNavigation();
        return;
    }

    if (section) section.style.display = 'block';
    const label = document.getElementById('calc-method-label');
    if (label) label.textContent = 'Метод расчёта';
    
    if (grid) {
        grid.innerHTML = '';
        methods.forEach(cm => {
            const card = document.createElement('div');
            card.className = `scenario-card ${state.calcMethod === cm.value ? 'selected' : ''}`;
            card.innerHTML = `
                <h4>${cm.label}</h4>
                <p><small>Формула ${cm.formula_code}</small></p>
            `;
            card.addEventListener('click', () => {
                state.calcMethod = cm.value;
                state.formulaCode = cm.formula_code;
                renderCalcMethods();
                updateNavigation();
            });
            grid.appendChild(card);
        });

        // Auto-select if only one method
        if (methods.length === 1 && !state.calcMethod) {
            state.calcMethod = methods[0].value;
            state.formulaCode = methods[0].formula_code;
            renderCalcMethods();
            updateNavigation();
        }
    }
}

// ========================================================================
// STEP 3: PARAMETERS
// ========================================================================
function renderParameters() {
    if (!state.methodicData || !state.sourceType) return;

    const varIds = Wizard.getRequiredVariables(
        state.methodicData.questions, state.sourceType, state.calcMethod
    );
    const questions = Wizard.buildQuestions(state.methodicData, varIds);

    // Show formula info
    const formulaCode = state.formulaCode || Wizard.getFormulaCode(
        state.methodicData.questions, state.sourceType, state.calcMethod
    );
    state.formulaCode = formulaCode;

    const infoBar = document.getElementById('formula-info');
    if (formulaCode) {
        const eqInfo = Wizard.getEquationInfo(state.methodicData, formulaCode);
        const eqDesc = eqInfo.length > 0 && eqInfo[0].formula_name ? eqInfo[0].formula_name : '';
        const eqStrings = eqInfo.map(eq => {
            if (eq.latex && typeof katex !== 'undefined') {
                try {
                    return `<div class="equation-formula latex-rendered" style="margin: 8px 0;">${katex.renderToString(eq.latex, { throwOnError: false, displayMode: true })}</div>`;
                } catch(e) { console.error('KaTeX error:', e); }
            }
            return `<span class="equation-formula" style="font-family: monospace; display: block; margin: 4px 0;">${eq.lhs} = ${eq.rhs}</span>`;
        }).join('');
        
        infoBar.innerHTML = `
            <div class="formula-header">
                <span class="formula-code">Формула ${formulaCode}</span>
                ${eqDesc ? `<span class="formula-desc">${eqDesc}</span>` : ''}
            </div>
            <div class="formula-math">
                ${eqStrings}
            </div>
        `;
        infoBar.style.display = 'block';
    } else {
        infoBar.style.display = 'none';
    }

    // Split questions into User Input and Lookup Values
    const isLookup = q => q.lookup_table || q.auto_lookup || q.input_method === 'lookup' || q.data_source === 'lookup';
    const userQuestions = questions.filter(q => !isLookup(q));
    const lookupQuestions = questions.filter(q => isLookup(q));

    // Render User Inputs
    const userGrid = document.getElementById('user-input-grid');
    renderQuestionGrid(userGrid, userQuestions, false);

    // Render Lookup Values
    const lookupGrid = document.getElementById('lookup-input-grid');
    const lookupSection = document.getElementById('lookup-section');
    if (lookupQuestions.length > 0) {
        lookupSection.style.display = 'block';
        renderQuestionGrid(lookupGrid, lookupQuestions, true);
    } else {
        lookupSection.style.display = 'none';
    }

    // Merge Global Project State (Climate, Temp) into Wizard Context
    const project = ProjectStore.getState();
    if (project.locationData) {
        state.inputs['climate_zone'] = project.locationData.climate_zone;
        state.inputs['t_max'] = project.locationData.t_max || state.inputs['t_max'];
        state.inputs['t_min'] = project.locationData.t_min || state.inputs['t_min'];
    }

    // Initial lookup run
    Wizard.runAutoLookups(state.methodicData, state.inputs);
    
    // Refresh provenance immediately for visual feedback
    renderLookupProvenancePanel();
}

function renderQuestionGrid(container, questions, isReadOnly) {
    if (!container) return;
    container.innerHTML = '';

    questions.forEach(q => {
        // Init state input if empty
        if (state.inputs[q.variable_id] === undefined && q.default != null) {
            state.inputs[q.variable_id] = q.default;
        }

        const group = document.createElement('div');
        group.className = `input-group ${isReadOnly ? 'read-only' : ''}`;

        if (q.type === 'select' && q.options) {
            // Check for visualization metadata
            const traceText = state.inputs[`${q.variable_id}_trace`];
            const hasLookup = q.auto_lookup || q.lookup_table;
            const tableId = q.auto_lookup ? q.auto_lookup.table : q.lookup_table;
            
            // Dropdown
            const currentVal = state.inputs[q.variable_id] || '';
            group.innerHTML = `
                <label for="input-${q.variable_id}">
                    ${hasLookup ? `<span class="table-preview-wrapper"><span style="text-decoration: underline dotted #3B82F6;">${q.label}</span>${formatTraceHTML(traceText, true)}</span>` : q.label} 
                    ${tableId ? `<button class="handbook-inline-btn" title="Посмотреть справочник" onclick="openHandbookModal('${tableId}')">📖</button>` : ''}
                    ${q.unit ? `<span class="unit">[${q.unit}]</span>` : ''}
                    ${q.token && !q.latex ? `<span class="token-badge">(${q.token})</span>` : ''}
                    ${q.latex ? `<span class="latex-hint" style="margin-left:8px; font-size:1.1em;">${typeof katex !== 'undefined' ? katex.renderToString(q.latex, {throwOnError: false}) : q.latex}</span>` : ''}
                </label>
                <select id="input-${q.variable_id}" class="select-input" ${isReadOnly ? 'disabled' : ''}>
                    <option value="">-- Выберите --</option>
                    ${q.options.map(o => `<option value="${o.value}" ${currentVal === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
                ${q.help_text ? `<span class="help-text">${q.help_text}</span>` : ''}
                ${state.inputs[`${q.variable_id}_trace`] ? `<span class="help-text" style="color:#0f5132; margin-top:2px; font-weight:500;">${formatTraceHTML(state.inputs[`${q.variable_id}_trace`])}</span>` : ''}
            `;
            const select = group.querySelector('select');
            select.addEventListener('change', (e) => {
                const val = e.target.value;
                state.inputs[q.variable_id] = val;
                if (val) select.classList.add('input-valid');
                else select.classList.remove('input-valid');

                // Generic auto-lookup runner
                Wizard.runAutoLookups(state.methodicData, state.inputs);
                
                // Refresh the UI to show updated lookup values
                updateLookupValuesUI();
                renderLookupProvenancePanel();
            });
        } else {
            // Number input
            let currentVal = state.inputs[q.variable_id];
            
            // Check Global Mapping Inheritence
            let globalInheritedVal = null;
            let isGloballyInherited = false;
            let projectLocationData = ProjectStore.getState().locationData || {};
            
            if (q.global_mapping && projectLocationData[q.global_mapping] !== undefined) {
                globalInheritedVal = projectLocationData[q.global_mapping];
                // If the user hasn't typed an override, force the global value into state
                if (currentVal == null && !state.inputs[`${q.variable_id}_override`]) {
                    state.inputs[q.variable_id] = globalInheritedVal;
                    currentVal = globalInheritedVal;
                    isGloballyInherited = true;
                }
            }

            if (currentVal == null || currentVal === undefined) {
                currentVal = '';
            } else if (isReadOnly && typeof currentVal === 'number' && !state.inputs[`${q.variable_id}_override`]) {
                currentVal = Number(currentVal.toFixed(4));
            }

            const isLookup = q.auto_lookup || q.lookup_table || q.data_source === 'lookup';
            const isOverridden = state.inputs[`${q.variable_id}_override`];

            const hasLookup = q.auto_lookup || q.lookup_table;
            const tableId = q.auto_lookup ? q.auto_lookup.table : q.lookup_table;
            const traceText = state.inputs[`${q.variable_id}_trace`];

            group.innerHTML = `
                <label for="input-${q.variable_id}">
                    ${hasLookup ? `<span class="table-preview-wrapper"><span style="text-decoration: underline dotted #3B82F6;">${q.label}</span>${formatTraceHTML(traceText, true)}</span>` : q.label} 
                    ${tableId ? `<button class="handbook-inline-btn" title="Посмотреть справочник" onclick="openHandbookModal('${tableId}')">📖</button>` : ''}
                    ${q.unit ? `<span class="unit">[${q.unit}]</span>` : ''}
                    ${q.token && !q.latex ? `<span class="token-badge">(${q.token})</span>` : ''}
                    ${isGloballyInherited ? `<span class="override-badge" style="background:#0284c7; color:white;">🌍 Из региона</span>` : (isOverridden ? `<span class="override-badge">Вручную</span>` : '')}
                    ${q.latex ? `<span class="latex-hint" style="margin-left:8px; font-size:1.1em;">${typeof katex !== 'undefined' ? katex.renderToString(q.latex, {throwOnError: false}) : q.latex}</span>` : ''}
                </label>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" step="any" id="input-${q.variable_id}" value="${currentVal}"
                        ${(q.disabled && !isLookup) || isGloballyInherited ? 'disabled' : ''}
                        ${q.min != null ? `min="${q.min}"` : ''}
                        ${q.max != null ? `max="${q.max}"` : ''}
                        placeholder="${q.default != null ? q.default : 'введите значение'}"
                        style="flex:1; min-width: 120px;">
                    ${isGloballyInherited || globalInheritedVal !== null ? `<button id="unlock-${q.variable_id}" class="btn btn-secondary" style="padding:4px 8px;" title="Разблокировать для ручного ввода" >🔓</button>` : ''}
                </div>
                ${q.default != null ? `<span class="help-text" style="color:#0284c7;">ℹ <strong>По умолчанию: ${q.default}</strong>${q.help_text ? ' — ' + (q.help_text.startsWith(String(q.default)) ? q.help_text.substring(String(q.default).length).replace(/^[\s=—]+/, '') : q.help_text) : ''}</span>` : (q.help_text ? `<span class="help-text">${q.help_text}</span>` : '')}
                <div id="trace-${q.variable_id}" class="help-text trace-block">${traceText ? formatTraceHTML(traceText) : ''}</div>
            `;
            const input = group.querySelector('input');
            const unlockBtn = group.querySelector(`#unlock-${q.variable_id}`);
            
            if (unlockBtn) {
                unlockBtn.addEventListener('click', () => {
                    input.disabled = false;
                    input.focus();
                    state.inputs[`${q.variable_id}_override`] = true;
                    unlockBtn.style.display = 'none';
                    // Strip the global badge
                    const badge = group.querySelector('.override-badge');
                    if (badge) badge.remove();
                });
            }

            input.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                input.classList.remove('input-valid', 'input-invalid');
                if (!isNaN(val)) {
                    state.inputs[q.variable_id] = val;
                    if (isLookup) state.inputs[`${q.variable_id}_override`] = true;
                    // Inline Validation
                    if ((q.min != null && val < q.min) || (q.max != null && val > q.max)) {
                        input.classList.add('input-invalid');
                    } else {
                        input.classList.add('input-valid');
                    }
                } else {
                    delete state.inputs[q.variable_id];
                    if (isLookup) delete state.inputs[`${q.variable_id}_override`];
                }

                // Generic auto-lookup runner
                Wizard.runAutoLookups(state.methodicData, state.inputs);
                
                updateLookupValuesUI();
                renderLookupProvenancePanel();
            });
        }

        container.appendChild(group);
    });
}

function updateLookupValuesUI() {
    const varIds = Wizard.getRequiredVariables(
        state.methodicData.questions, state.sourceType, state.calcMethod
    );
    const questions = Wizard.buildQuestions(state.methodicData, varIds);

    questions.forEach(q => {
        if (q.disabled || q.lookup_table || q.auto_lookup || state.inputs[`${q.variable_id}_trace`]) {
            const el = document.getElementById(`input-${q.variable_id}`);
            // Only update the value if the input box is not currently being edited by the user
            if (el && document.activeElement !== el) {
                let val = state.inputs[q.variable_id];
                if (typeof val === 'number') {
                    val = Number(val.toFixed(4));
                }
                el.value = (val != null) ? val : '';
                
                // Update trace explicitly
                const traceId = `trace-${q.variable_id}`;
                let traceEl = document.getElementById(traceId);
                const traceText = state.inputs[`${q.variable_id}_trace`];
                
                if (traceText) {
                    if (traceEl) {
                        traceEl.innerHTML = formatTraceHTML(traceText);
                    }
                } else if (traceEl) {
                    traceEl.innerHTML = '';
                }
                
                if (val != null && val !== '') {
                    el.classList.add('input-valid');
                    el.classList.remove('input-pending');
                } else if (q.auto_lookup || q.lookup_table) {
                    el.classList.add('input-pending');
                    el.classList.remove('input-valid');
                }
                
                // Update override badge
                const label = el.previousElementSibling;
                if (label) {
                    let badge = label.querySelector('.override-badge');
                    if (state.inputs[`${q.variable_id}_override`]) {
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'override-badge';
                            badge.textContent = 'Вручную';
                            label.insertBefore(badge, label.querySelector('.latex-hint'));
                        }
                    } else if (badge) {
                        badge.remove();
                    }
                }
            }
        }
    });
}

// Generic lookups are now handled by Wizard.runAutoLookups using variables.json metadata

/**
 * Render the lookup provenance panel showing all auto-looked-up coefficients.
 * Reads all _trace keys from state.inputs and displays them in a structured table.
 * Adds hover tooltips showing the full table data for each referenced table.
 */
function renderLookupProvenancePanel() {
    const panel = document.getElementById('lookup-provenance-panel');
    const tbody = document.getElementById('provenance-tbody');
    const countEl = document.getElementById('provenance-count');
    if (!panel || !tbody) return;

    tbody.innerHTML = '';
    let count = 0;

    // Collect all trace entries from state.inputs
    for (const [key, val] of Object.entries(state.inputs)) {
        if (!key.endsWith('_trace') || !val) continue;

        const varId = key.replace('_trace', '');

        // Parse trace string: "Таблица X (Trace details...)"
        let tableName = '—';
        let keyInfo = '—';
        let resultVal = '—';
        let paramMethod = '—';

        if (typeof val === 'object' && val.source_type) {
            if (val.source_type === 'equation') {
                tableName = 'Уравнение';
                keyInfo = val.expression || '—';
                resultVal = val.result;
                paramMethod = val.formula_code ? 'Form ' + val.formula_code : 'equation';
            } else {
                tableName = val.table_id || '—';
                keyInfo = Object.entries(val.keys || {}).map(([k,v]) => `${k}=${v}`).join(', ');
                resultVal = val.result ? Object.values(val.result)[0] : '—';
                paramMethod = val.method || val.source_type || '—';
            }
            // Also format numbers
            if (typeof resultVal === 'number') resultVal = resultVal.toFixed(6);
        } else {
            // Try new format: "Таблица TableID (Trace details...)"
            const newTraceMatch = String(val).match(/Таблица\s+(\S+)\s+\((.+)\)/);
            if (newTraceMatch) {
                tableName = newTraceMatch[1];
                const traceDetails = newTraceMatch[2];
                keyInfo = traceDetails;
                
                // Try to extract result if it follows the ➔ pattern
                const resMatch = traceDetails.match(/[➔→]\s*([\d\.]+)/);
                if (resMatch) resultVal = resMatch[1];
                else resultVal = state.inputs[varId] != null ? state.inputs[varId] : '—';
            } else {
                // Fallback for any other format
                resultVal = String(val);
            }
        }

        // Find human-readable variable label from current methodic data
        let varLabel = varId;
        if (state.methodicData && state.methodicData.variables) {
            const varList = Array.isArray(state.methodicData.variables)
                ? state.methodicData.variables
                : (state.methodicData.variables.variables || []);
            const varDef = varList.find(v => v.id === varId);
            if (varDef) varLabel = varDef.label || varId;
        }

        // Build table preview tooltip HTML
        const previewHTML = buildTablePreviewHTML(tableName, keyInfo);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${varLabel}</strong><br><small style="color:#888;">${varId}</small></td>
            <td>
                <span class="table-preview-wrapper">
                    <code class="prov-table-name ${previewHTML ? 'has-preview' : ''}">${tableName}</code>
                    ${previewHTML ? `<div class="table-preview-tooltip">${previewHTML}</div>` : ''}
                </span>
            </td>
            <td><code>${keyInfo}</code></td>
            <td><span style="font-size: 0.85em; padding: 2px 6px; background: #eef2f6; border-radius: 4px; color: #444;">${paramMethod}</span></td>
            <td><strong class="prov-result">${resultVal}</strong></td>
        `;
        tbody.appendChild(tr);
        count++;
    }

    if (count > 0) {
        panel.style.display = 'block';
        if (countEl) countEl.textContent = count;
    } else {
        panel.style.display = 'none';
    }
}

/**
 * Build HTML for a table preview tooltip.
 * Reads the unified tables data and generates a compact preview table.
 *
 * @param {string} tableName - Table identifier (e.g. "Table-10", "10")
 * @param {string} keyInfo - Current key info string (e.g. "n=35" or "substance=benzene")
 * @returns {string} HTML string, or empty string if table not found
 */
function buildTablePreviewHTML(tableName, keyInfo) {
    if (!state.methodicData || !state.methodicData.tables) return '';

    // Try to find the table in unified format
    const tables = state.methodicData.tables.tables || [];
    let table = tables.find(t => t.id === tableName);

    // Also try matching without "Table-" prefix or with it
    if (!table) {
        table = tables.find(t => t.id === `Table-${tableName}`) ||
                tables.find(t => t.id === `table_${tableName}`);
    }
    if (!table || !table.data || table.data.length === 0) return '';

    const data = table.data;
    const lookupType = table.lookup_type || 'exact';
    const title = table.title || table.id;

    // Parse current key from keyInfo (e.g. "n=35" → {n: "35"})
    const currentKeys = {};
    if (keyInfo && keyInfo !== '—') {
        keyInfo.split(/[,;]\s*/).forEach(part => {
            const eqPos = part.indexOf('=');
            if (eqPos > 0) {
                currentKeys[part.substring(0, eqPos).trim()] = part.substring(eqPos + 1).trim();
            }
        });
    }

    // Determine columns to show (all keys from first row)
    const allCols = Object.keys(data[0] || {});
    const MAX_ROWS = 30;
    const rowsToShow = data.slice(0, MAX_ROWS);
    const hasMore = data.length > MAX_ROWS;

    // Build header
    let html = `<div class="tooltip-header">
        <span class="tooltip-title">📊 ${title}</span>
        <span class="tooltip-badge">${lookupType} • ${data.length} rows</span>
    </div>`;

    // Build table
    html += '<table class="tooltip-table"><thead><tr>';
    allCols.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    rowsToShow.forEach(row => {
        // Check if this row matches current keys (for highlighting)
        let isHighlighted = false;
        if (Object.keys(currentKeys).length > 0) {
            isHighlighted = Object.entries(currentKeys).every(([k, v]) => {
                const rv = row[k];
                if (rv == null) return false;
                return String(rv) === String(v) || String(rv).split(',').includes(String(v));
            });
        }

        html += `<tr${isHighlighted ? ' class="tooltip-highlight"' : ''}>`;
        allCols.forEach(col => {
            const val = row[col];
            const displayVal = val == null ? '—' : (typeof val === 'number' ? val : val);
            html += `<td>${displayVal}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';

    if (hasMore) {
        html += `<div class="tooltip-more">... и ещё ${data.length - MAX_ROWS} строк</div>`;
    }

    return html;
}

function safeDisplay(val) {
    if (val == null || val === undefined) return '';
    if (typeof val === 'object') return val.display || JSON.stringify(val);
    return String(val);
}

/**
 * Parses trace string and wraps table name and results with the hover preview UI.
 * @param {string} traceText 
 * @param {boolean} onlyTooltip - If true, returns only the tooltip div, not the "ℹ Таблица..." prefix
 * @returns {string} Formatted HTML
 */
function formatTraceHTML(traceText, onlyTooltip = false) {
    if (!traceText) return '';
    
    // Handle structured object
    if (typeof traceText === 'object' && traceText.display) {
        traceText = traceText.display;
    }
    
    // New format: "Таблица TableID (Trace details...)"
    const traceMatch = String(traceText).match(/Таблица\s+(\S+)\s+\((.+)\)/);
    if (traceMatch) {
        const tableName = traceMatch[1];
        const traceDetails = traceMatch[2];
        const previewHTML = buildTablePreviewHTML(tableName, traceDetails);
        
        if (onlyTooltip) {
            return previewHTML ? `<div class="table-preview-tooltip">${previewHTML}</div>` : '';
        }
        return `ℹ Таблица <span class="table-preview-wrapper"><code class="prov-table-name ${previewHTML ? 'has-preview' : ''}">${tableName}</code>${previewHTML ? `<div class="table-preview-tooltip">${previewHTML}</div>` : ''}</span> (${traceDetails})`;
    }
    return onlyTooltip ? '' : `ℹ ${traceText}`;
}

let _provenanceOpen = true;

/**
 * Toggle the provenance panel body visibility.
 */
function toggleProvenance() {
    const body = document.getElementById('provenance-body');
    const chevron = document.getElementById('provenance-chevron');
    if (!body) return;
    _provenanceOpen = !_provenanceOpen;
    body.style.display = _provenanceOpen ? 'block' : 'none';
    if (chevron) chevron.textContent = _provenanceOpen ? '▼' : '▶';
}



// ========================================================================
// STEP 4: COMPOSITION
// ========================================================================
function renderComposition() {
    const list = document.getElementById('composition-list');
    list.innerHTML = '';

    if (state.composition.length === 0) {
        state.composition = Composition.getDefault(state.methodicData, state.sourceType, state.calcMethod);
    }

    state.composition.forEach((comp, idx) => {
        const item = document.createElement('div');
        item.className = 'comp-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.innerHTML = `
            <span style="flex:1;">${comp.name}</span>
            <div class="comp-input-group" style="display:flex; align-items:center; gap: 8px;">
                <input type="number" step="0.01" value="${comp.pct}" id="comp-${idx}"> %
                <button class="btn btn-danger btn-remove-comp" title="Удалить" style="padding: 2px 6px; font-size: 12px; margin-left: 8px;">✖</button>
            </div>
        `;

        const input = item.querySelector('input');
        input.addEventListener('input', (e) => {
            state.composition[idx].pct = parseFloat(e.target.value) || 0;
        });

        const btnRemove = item.querySelector('.btn-remove-comp');
        btnRemove.addEventListener('click', () => {
            state.composition.splice(idx, 1);
            renderComposition(); // Re-render list
        });

        list.appendChild(item);
    });

    // Add button to add custom pollutant
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary mt-4';
    addBtn.textContent = '+ Добавить компонент';
    addBtn.style.alignSelf = 'flex-start';
    addBtn.addEventListener('click', () => {
        const name = prompt('Название загрязняющего вещества:');
        if (name) {
            state.composition.push({ name, pct: 0 });
            renderComposition();
        }
    });
    list.appendChild(addBtn);
}

// ========================================================================
// STEP 5: RESULTS
// ========================================================================

/**
 * Collect all current input values from the DOM into state.inputs.
 * Called before calculating to ensure all user-entered values are captured.
 */
function collectAllInputs() {
    const varIds = Wizard.getRequiredVariables(
        state.methodicData.questions, state.sourceType, state.calcMethod
    );
    varIds.forEach(varId => {
        const el = document.getElementById(`input-${varId}`);
        if (!el) return;
        if (el.tagName === 'SELECT') {
            state.inputs[varId] = el.value;
        } else {
            const val = parseFloat(el.value);
            if (!isNaN(val)) {
                state.inputs[varId] = val;
            }
        }
    });
}



function runCalculationsAndRenderResults() {
    if (!state.methodicData || !state.formulaCode) return;

    // Collect all current input values from the DOM
    collectAllInputs();

    const { equations } = state.methodicData;

    // Run the data-driven equation evaluator
    const result = Evaluator.evaluateFormulaCode(
        equations.active_equations,
        state.formulaCode,
        state.inputs
    );

    state.results = result;

    // Render summary table
    const tbodySummary = document.querySelector('#summary-table tbody');
    tbodySummary.innerHTML = '';

    const addRow = (label, value, highlight) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${label}</strong></td>
            <td${highlight ? ` style="color:var(--primary);font-weight:700;"` : ''}>${value}</td>
        `;
        tbodySummary.appendChild(tr);
    };

    addRow('Методика', state.methodicData.meta.name || state.methodicData.meta.name_en);
    
    // Find Russian labels for source type and calc method
    const stObj = state.methodicData.meta.source_types.find(s => s.value === state.sourceType);
    const cmList = state.methodicData.meta.calc_methods[state.sourceType] || [];
    const cmObj = cmList.find(c => c.value === state.calcMethod);
    
    addRow('Тип источника', stObj ? stObj.label : state.sourceType);
    addRow('Метод расчёта', cmObj ? cmObj.label : (state.calcMethod === '_default' ? 'Основной метод' : state.calcMethod));
    addRow('Формула', state.formulaCode);
    // Find LaTeX for G and M totals
    const varsArray = state.methodicData.variables.variables || [];
    const vM = varsArray.find(vr => vr.token === result.mKey);
    const vG = varsArray.find(vr => vr.token === result.gKey);

    const mLabel = (vM && vM.latex) ? 
        `<span style="margin-left:4px;">${renderLatex(vM.latex)}</span>` : 
        `(${result.mKey})`;
    
    const gLabel = (vG && vG.latex) ? 
        `<span style="margin-left:4px;">${renderLatex(vG.latex)}</span>` : 
        `(${result.gKey})`;

    addRow(`Макс. выбросы ${mLabel}`, result.M != null ? `${result.M.toFixed(6)} г/с` : 'N/A', true);
    addRow(`Годовые выбросы ${gLabel}`, result.G != null ? `${result.G.toFixed(6)} т/год` : 'N/A', true);

    // Show all intermediate results
    for (const [key, val] of Object.entries(result.results)) {
        if (key !== result.mKey && key !== result.gKey && val != null) {
            // Find variable for latex symbol
            const v = varsArray.find(vr => vr.token === key);
            const label = (v && v.latex) ? 
                `<span style="font-size:1.1em;">${renderLatex(v.latex)}</span>` : 
                key;
            addRow(label, typeof val === 'number' ? val.toFixed(6) : val);
        }
    }

    // Render pollutant split table
    const tbodySplit = document.querySelector('#split-table tbody');
    tbodySplit.innerHTML = '';

    if (result.pollutants && Object.keys(result.pollutants).length > 0) {
        // CASE A: Methodology calculates individual pollutants (M_SO2, G_SO2, etc.)
        for (const [id, vals] of Object.entries(result.pollutants)) {
            // Find pretty name from composition or metadata
            const comp = state.composition.find(c => c.token === `M_${id}` || c.token === `G_${id}` || c.name.includes(id));
            const name = comp ? comp.name : id;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${name}</td>
                <td>N/A (Calculated)</td>
                <td>${vals.G != null ? vals.G.toFixed(6) : '0.000000'}</td>
                <td>${vals.M != null ? vals.M.toFixed(6) : '0.000000'}</td>
            `;
            tbodySplit.appendChild(tr);
        }
    } else if (result.M != null || result.G != null) {
        // CASE B: Methodology calculates a total mass (M, G) and we split it by %
        state.composition.forEach(comp => {
            const pct = comp.pct / 100.0;
            const m_part = result.M * pct;
            const g_part = result.G * pct;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${comp.name}</td>
                <td>${comp.pct.toFixed(2)}</td>
                <td>${g_part.toFixed(6)}</td>
                <td>${m_part.toFixed(6)}</td>
            `;
            tbodySplit.appendChild(tr);
        });
    }

    // Show step-by-step equations used (with full transparency / derivation)
    const eqList = document.getElementById('equations-used-list');
    eqList.innerHTML = '';
    
    if (result.calculation_steps && result.calculation_steps.length > 0) {
        result.calculation_steps.forEach(step => {
            const badgeClass = 'badge-trusted'; // All executed steps are trusted
            // Format output purely
            const resultVal = typeof step.result === 'number' ? 
                              (Math.abs(step.result) < 0.0001 && step.result !== 0 ? step.result.toExponential(4) : step.result.toFixed(6)) 
                              : step.result;

            const div = document.createElement('div');
            div.className = 'equation-item';
            div.innerHTML = `
                <div class="eq-header">
                    <strong>${step.formula_name || step.lhs}</strong>
                    <span class="confidence-badge ${badgeClass}">выполнено</span>
                </div>
                <div class="eq-math" style="margin-top:8px;">
                    ${step.latex ? 
                        `<div style="font-size:1.1em; padding:4px 0;">${renderLatex(step.latex)}</div>` : 
                        `<code style="font-size:0.95em;">${step.lhs} = ${step.raw}</code>`
                    }
                </div>
                <div class="eq-derivation" style="margin-top:4px; padding: 6px; background: #eef2f6; border-radius: 4px;">
                    <code style="font-size:0.95em; color:#0f5132;">${step.lhs} = ${step.substituted} = <b style="font-size:1.1em;">${resultVal}</b></code>
                </div>
            `;
            eqList.appendChild(div);
        });
    } else {
        eqList.innerHTML = '<p>Нет данных о вычислениях.</p>';
    }
}


// ========================================================================
// NAVIGATION LOGIC / REVIEW STEP
// ========================================================================
function populateReviewStep() {
    const tbody = document.querySelector('#review-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Find Russian labels for source type and calc method
    const stObj = state.methodicData.meta.source_types.find(s => s.value === state.sourceType);
    const cmList = state.methodicData.meta.calc_methods[state.sourceType] || [];
    const cmObj = cmList.find(c => c.value === state.calcMethod);

    tbody.innerHTML += `<tr><th colspan="2" style="background:#f1f5f9; text-align: left;">Методика и Метод расчёта</th></tr>`;
    tbody.innerHTML += `<tr><td>Название</td><td><strong>${state.methodicData.meta.name}</strong></td></tr>`;
    tbody.innerHTML += `<tr><td>Тип источника</td><td>${stObj ? stObj.label : state.sourceType}</td></tr>`;
    tbody.innerHTML += `<tr><td>Метод расчёта</td><td>${cmObj ? cmObj.label : (state.calcMethod === '_default' ? 'Основной метод' : state.calcMethod)}</td></tr>`;
    tbody.innerHTML += `<tr><td>Формула</td><td>${state.formulaCode}</td></tr>`;
    
    // Add User Inputs
    tbody.innerHTML += `<tr><th colspan="2" style="background:#f1f5f9; text-align: left;">Введенные параметры</th></tr>`;
    const varIds = Wizard.getRequiredVariables(state.methodicData.questions, state.sourceType, state.calcMethod);
    const questions = Wizard.buildQuestions(state.methodicData, varIds);
    questions.forEach(q => {
        const val = state.inputs[q.variable_id];
        const isLookup = q.auto_lookup || q.lookup_table || q.data_source === 'lookup';
        const displayVal = safeDisplay(val);
        const sourceMark = state.inputs[`${q.variable_id}_override`] ? ' [Вручную]' : (isLookup ? ' [Справочник]' : '');
        const latexHint = (q.latex && typeof q.latex === 'string') ? 
            `<span class="latex-hint" style="margin-left:6px; font-size:1.05em; color:var(--primary); opacity:0.9;">${renderLatex(q.latex)}</span>` : 
            `<small style="color:#888; font-size:0.8em; margin-left: 4px;">${q.variable_id}</small>`;
        
        tbody.innerHTML += `<tr><td>${q.label} ${latexHint}</td><td><strong>${displayVal}</strong> <span style="color:#888;font-size:0.8em;">${sourceMark}</span></td></tr>`;
    });
    
    // Add Composition
    if (state.composition && state.composition.length > 0) {
        tbody.innerHTML += `<tr><th colspan="2" style="background:#f1f5f9; text-align: left;">Состав загрязняющих веществ</th></tr>`;
        state.composition.forEach(c => {
            tbody.innerHTML += `<tr><td>${c.name}</td><td><strong>${c.pct}%</strong></td></tr>`;
        });
    }
}

function updateHelpPanel() {
    const panel = document.getElementById('help-panel');
    const content = document.getElementById('help-content');
    if (!panel || !content) return;
    
    if (state.methodicData && state.methodicData.meta && state.methodicData.meta.help) {
        const helpMap = state.methodicData.meta.help;
        let helpText = '';
        
        if (currentStep === 1) helpText = helpMap.step_1;
        else if (currentStep === 2) helpText = helpMap.step_2;
        else if (currentStep === 3) helpText = helpMap.step_3;
        else if (currentStep === 4) helpText = helpMap.step_4;
        else if (currentStep === 5) helpText = helpMap.step_5 || "Проверьте данные.";
        else if (currentStep === 6) helpText = helpMap.step_6;

        if (helpText) {
            content.innerHTML = helpText;
            panel.style.display = 'block';
            return;
        }
    }
    panel.style.display = 'none';
}

function handleNext() {
    if (currentStep < totalSteps) {
        // Validation before moving forward
        if (currentStep === 1 && !state.methodicData) {
            alert('Пожалуйста, выберите методику.');
            return;
        }

        if (currentStep === 2 && !state.sourceType) {
            alert('Пожалуйста, выберите тип расчёта.');
            return;
        }

        if (currentStep === 2 && !state.calcMethod) {
            alert('Пожалуйста, выберите метод расчёта.');
            return;
        }

        // Prepare next step content
        if (currentStep === 1) {
            renderSourceTypes();
        }
        if (currentStep === 2) {
            renderParameters();
        }
        if (currentStep === 3) {
            collectAllInputs();
            const varIds = Wizard.getRequiredVariables(
                state.methodicData.questions, state.sourceType, state.calcMethod
            );
            const missing = varIds.filter(id => {
                const val = state.inputs[id];
                return val == null || val === '' || (typeof val === 'number' && isNaN(val));
            });
            if (missing.length > 0) {
                // Highlight missing fields and BLOCK
                missing.forEach(id => {
                    const el = document.getElementById(`input-${id}`);
                    if (el) {
                        el.style.borderColor = '#dc3545';
                        el.classList.add('input-invalid');
                    }
                });
                showToast('Пожалуйста, заполните все обязательные поля (выделены красным).', 'danger');
                return;
            }
            renderComposition();
        }
        if (currentStep === 4) {
            populateReviewStep();
        }
        if (currentStep === 5) {
            runCalculationsAndRenderResults();
        }

        currentStep++;
        updateNavigation();
    } else {
        // On Result step
        saveWizardResultToFacility();
    }
}

function handlePrev() {
    if (currentStep > 1) {
        currentStep--;
        updateNavigation();
    }
}

function updateNavigation() {
    // Update panes
    stepPanes.forEach(pane => {
        const paneStep = parseInt(pane.id.replace('pane-', ''));
        if (paneStep === currentStep) {
            pane.style.display = 'block';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    pane.classList.add('active');
                });
            });
        } else {
            pane.classList.remove('active');
            setTimeout(() => {
                if (parseInt(pane.id.replace('pane-', '')) !== currentStep) {
                    pane.style.display = 'none';
                }
            }, 300);
        }
    });

    // Update horizontal stepper
    const stepperItems = document.querySelectorAll('#stepper .step');
    stepperItems.forEach(item => {
        const stepNum = parseInt(item.getAttribute('data-step'));
        item.classList.remove('active', 'completed');
        
        if (stepNum === currentStep) {
            item.classList.add('active');
        } else if (stepNum < currentStep) {
            item.classList.add('completed');
        }
    });

    // Update buttons
    btnPrev.disabled = currentStep === 1;

    if (currentStep === totalSteps) {
        btnNext.textContent = 'Сохранить расчёт';
    } else {
        btnNext.textContent = 'Далее';
    }

    // Disable next based on state
    let canProceed = true;
    if (currentStep === 1 && !state.methodicData) canProceed = false;
    if (currentStep === 2 && (!state.sourceType || !state.calcMethod)) canProceed = false;

    btnNext.disabled = !canProceed;

    // Update progress bar
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        const progress = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
        progressFill.style.width = `${progress}%`;
    }

    // Update Help Panel context
    updateHelpPanel();
}

// Start
document.addEventListener('DOMContentLoaded', init);

// ========================================================================
// PROJECT & FACILITY WORKFLOW
// ========================================================================

const FACILITY_TYPES = [
    { value: "fuel_station",     label: "АЗС (Автозаправочная станция)", icon: "⛽" },
    { value: "fuel_depot",       label: "Нефтебаза / Склад ГСМ",         icon: "🛢️" },
    { value: "industrial_site",  label: "Промышленная площадка",         icon: "🏭" },
    { value: "construction",     label: "Строительная площадка",         icon: "🏗️" },
    { value: "boiler_house",     label: "Котельная",                     icon: "🔥" },
    { value: "warehouse",        label: "Склад / Хранилище",             icon: "📦" },
    { value: "workshop",         label: "Цех / Мастерская",              icon: "🔧" },
    { value: "transport_base",   label: "Транспортная база",             icon: "🚛" },
    { value: "mining_site",      label: "Горная площадка",               icon: "⛏️" },
    { value: "other",            label: "Другое",                        icon: "📋" }
];

let _activeDashboardPane = 'project-dashboard';
let _selectedFacilityId = null;

function initProjectWorkflow() {
    // Listen for project name
    const nameInput = document.getElementById('project-name');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            ProjectStore.setName(e.target.value);
            const hn = document.getElementById('header-project-name');
            if (hn) hn.textContent = e.target.value;
            renderProjectTree();
        });
    }

    // Global coords
    const latInput = document.getElementById('proj-lat');
    const lngInput = document.getElementById('proj-lng');
    if (latInput) latInput.addEventListener('input', (e) => ProjectStore.setCoordinates(parseFloat(e.target.value), undefined));
    if (lngInput) lngInput.addEventListener('input', (e) => ProjectStore.setCoordinates(undefined, parseFloat(e.target.value)));

    // Report
    const btnReportMain = document.getElementById('btn-generate-report-main');
    if (btnReportMain) {
        btnReportMain.addEventListener('click', () => {
            ReportGenerator.generatePDF(ProjectStore.getState());
        });
    }
    
    initUtilityPanels();
}

// Map, Weather, Export/Import
function initUtilityPanels() {
    // Map Logic
    const btnShowMap = document.getElementById('btn-show-map');
    if (btnShowMap) {
        btnShowMap.addEventListener('click', () => {
            const modal = document.getElementById('map-modal');
            modal.style.display = 'flex';
            const stateObj = ProjectStore.getState();
            if (!document.getElementById('map-container').innerHTML) {
                MapModule.init('map-container', stateObj.lat, stateObj.lng);
            }
            MapModule.invalidateSize();
            // Adapt markers to nested sources
            let allSources = [];
            if (stateObj.facilities) {
                stateObj.facilities.forEach(fac => {
                    if (fac.sources) {
                        fac.sources.forEach(src => {
                            allSources.push({...src, name: src.name || fac.name});
                        });
                    }
                });
            }
            MapModule.refreshMarkers(allSources);
        });
    }

    // Weather
    const btnFetchWeather = document.getElementById('btn-fetch-weather');
    if (btnFetchWeather) {
        btnFetchWeather.addEventListener('click', async () => {
            const stateObj = ProjectStore.getState();
            if (!stateObj.lat || !stateObj.lng) {
                showToast("Укажите координаты проекта (Широта и Долгота) или выберите регион.", "danger");
                return;
            }
            btnFetchWeather.textContent = "Загрузка...";
            const meteoRes = document.getElementById('meteo-results');
            if (meteoRes) {
                meteoRes.style.display = 'block';
                meteoRes.innerHTML = '<em>Подключение к OpenMeteo...</em>';
            }
            
            const today = new Date().toISOString().split('T')[0];
            const data = await WeatherModule.fetchFromOpenMeteo(stateObj.lat, stateObj.lng, today);
            
            if (meteoRes) {
                if (data && data.hourly) {
                    const temp = data.hourly.temperature_2m[12];
                    const wind = data.hourly.windspeed_10m[12];
                    meteoRes.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>🌡 Температура (12:00)</span>
                            <strong>${temp} °C</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>💨 Ветер (скорость)</span>
                            <strong>${wind} м/с</strong>
                        </div>
                    `;
                } else {
                    meteoRes.innerHTML = `<span style="color:#dc2626;">Ошибка получения данных погоды.</span>`;
                }
            }
            btnFetchWeather.textContent = "☁️ Обновить";
        });
    }

    // Export/Import JSON
    const actionsContainer = document.getElementById('cart-actions');
    if (actionsContainer && !document.getElementById('btn-export-json-new')) {
        let oldExport = document.getElementById('btn-export-json');
        if (oldExport) oldExport.remove();

        const btnExport = document.createElement('button');
        btnExport.id = 'btn-export-json-new';
        btnExport.className = 'btn btn-secondary btn-block mt-3';
        btnExport.textContent = '💾 Экспорт JSON';
        btnExport.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ProjectStore.getState()));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `project_${Date.now()}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
        actionsContainer.appendChild(btnExport);

        const btnImportContainer = document.createElement('div');
        btnImportContainer.style.marginTop = '12px';
        btnImportContainer.innerHTML = `<label class="btn btn-secondary btn-block" style="display:block; text-align:center; cursor:pointer;">📂 Импорт JSON<input type="file" id="import-json-file" accept=".json" style="display:none;"></label>`;
        actionsContainer.appendChild(btnImportContainer);

        document.getElementById('import-json-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                if (ProjectStore.loadFromJSON(evt.target.result)) {
                    const stateObj = ProjectStore.getState();
                    if (stateObj.name) document.getElementById('project-name').value = stateObj.name;
                    if (stateObj.lat) document.getElementById('proj-lat').value = stateObj.lat;
                    if (stateObj.lng) document.getElementById('proj-lng').value = stateObj.lng;
                    renderProjectTree();
                    showProjectDashboard();
                    alert('Проект успешно импортирован!');
                } else {
                    alert('Ошибка импорта проекта. Неверный формат файла.');
                }
            };
            reader.readAsText(file);
        });
    }
}

// ------ VIEW SWITCHING LOGIC ------
function switchPane(paneId) {
    const panes = ['project-dashboard', 'facility-dashboard', 'facility-form-pane', 'calculator-wizard'];
    panes.forEach(p => {
        const el = document.getElementById(p);
        if (el) {
            if (p === paneId) {
                el.style.display = 'block';
                el.classList.add('active');
            } else {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        }
    });
    _activeDashboardPane = paneId;
    
    // Auto-switch sidebar tab if needed
    if (paneId === 'calculator-wizard') {
        // Optional: switch to environment tab if we want to show meteo while calculating
        // switchSidebarTab('environment');
    }
    
    // Update active highlight in tree
    const treeHeaders = document.querySelectorAll('.tree-facility-header');
    treeHeaders.forEach(el => el.classList.remove('active'));
    
    if (paneId === 'facility-dashboard' || paneId === 'calculator-wizard') {
        if (_selectedFacilityId) {
            const facNode = document.querySelector(`.tree-facility[data-facility-id="${_selectedFacilityId}"]`);
            if (facNode) {
                const facHeader = facNode.querySelector('.tree-facility-header');
                if (facHeader) facHeader.classList.add('active');
            }
        }
    }
}

// ------ SIDEBAR TABS ------
function switchSidebarTab(tabName) {
    const panes = {
        'hierarchy': 'sidebar-pane-hierarchy',
        'environment': 'sidebar-pane-environment'
    };
    
    const tabs = {
        'hierarchy': 'tab-hierarchy',
        'environment': 'tab-environment'
    };
    
    Object.keys(panes).forEach(key => {
        const pane = document.getElementById(panes[key]);
        const tab = document.getElementById(tabs[key]);
        if (pane) pane.style.display = (key === tabName) ? 'block' : 'none';
        if (tab) {
            if (key === tabName) tab.classList.add('active');
            else tab.classList.remove('active');
        }
    });
}

function showProjectDashboard() {
    switchPane('project-dashboard');
    _selectedFacilityId = null;
    const totals = ProjectStore.getProjectTotals();
    
    // Update dashboard title
    const stateObj = ProjectStore.getState();
    document.getElementById('proj-dashboard-title').textContent = `Проект: ${stateObj.name || 'Обзор'}`;
    
    // Update project stats element
    const statsEl = document.getElementById('project-summary-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="facility-total-card" style="margin-top:0; border:1px solid #c7d2fe; background:linear-gradient(135deg, #f8fafc, #eff6ff);">
                <div class="total-block">
                    <h4 style="color:#1e40af; font-size:0.75rem;">Суммарный выброс (г/с)</h4>
                    <div class="val" style="color:#1d4ed8; font-size:2.2rem;">${totals.totalM.toFixed(6)}</div>
                </div>
                <div class="total-block">
                    <h4 style="color:#1e40af; font-size:0.75rem;">Валовый выброс (т/год)</h4>
                    <div class="val" style="color:#1d4ed8; font-size:2.2rem;">${totals.totalG.toFixed(6)}</div>
                </div>
            </div>
            
            <div style="margin-top:24px; display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:20px;">
                <div style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0;">
                    <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Объекты</div>
                    <div style="font-size:1.8rem; font-weight:700; margin-top:4px;">${stateObj.facilities ? stateObj.facilities.length : 0}</div>
                </div>
                <div style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0;">
                    <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Источники</div>
                    <div style="font-size:1.8rem; font-weight:700; margin-top:4px;">${ProjectStore.getTotalSourceCount()}</div>
                </div>
            </div>
        `;
    }
}

function showFacilityDashboard(facilityId) {
    const fac = ProjectStore.getFacility(facilityId);
    if (!fac) return;
    _selectedFacilityId = facilityId;
    switchPane('facility-dashboard');
    
    const totals = ProjectStore.getFacilityTotals(facilityId);
    const typeObj = FACILITY_TYPES.find(t => t.value === fac.type) || FACILITY_TYPES[FACILITY_TYPES.length - 1];
    
    const container = document.getElementById('facility-dashboard');
    container.innerHTML = `
        <div class="facility-dashboard-header">
            <div>
                <h2 style="margin:0; font-size:1.6rem;">${typeObj.icon} ${fac.name}</h2>
                <div style="color:var(--text-muted); margin-top:4px;">${typeObj.label} • ${fac.phase === 'operation' ? 'Эксплуатация' : 'Строительство'}</div>
            </div>
            <div class="actions" style="display:flex; gap:12px;">
                <button class="btn btn-secondary" onclick="editFacility('${fac.id}')">Редактировать</button>
                <button class="btn btn-secondary" onclick="duplicateFacility('${fac.id}')" title="Дублировать">⎘</button>
                <button class="btn btn-secondary" onclick="deleteFacility('${fac.id}')" style="color:#ef4444; border-color:#fef2f2; background:#fef2f2;">✖</button>
            </div>
        </div>
        
        <div class="facility-header-card">
            ${fac.address ? `<div style="font-size:0.95rem; margin-bottom:12px;">📍 ${fac.address}</div>` : ''}
            ${fac.description ? `<div style="font-size:0.9rem; color:var(--text-secondary);">${fac.description}</div>` : ''}
            
            <div class="facility-total-card ml-0 mr-0 mt-4 mb-0">
                <div class="total-block">
                    <h4>Итого по объекту (M)</h4>
                    <div class="val">${totals.M.toFixed(6)} <span style="font-size:1rem;">г/с</span></div>
                </div>
                <div class="total-block">
                    <h4>Валовый Выброс (G)</h4>
                    <div class="val">${totals.G.toFixed(6)} <span style="font-size:1rem;">т/год</span></div>
                </div>
            </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="margin:0;">Источники выбросов (${totals.sourceCount})</h3>
            <button class="btn btn-primary" onclick="startNewSource('${fac.id}')">+ Обновить / Расчёт</button>
        </div>
        
        <div id="fac-sources-table-container"></div>
    `;
    
    renderFacilitySourcesTable(fac);
}

function renderFacilitySourcesTable(fac) {
    const container = document.getElementById('fac-sources-table-container');
    if (!container) return;
    
    if (!fac.sources || fac.sources.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:48px 24px; background:white; border-radius:12px; border:1px dashed #cbd5e1;">
                <div style="font-size:3rem; margin-bottom:16px;">📭</div>
                <h4 style="margin:0 0 8px 0; color:#334155;">Нет добавленных источников</h4>
                <p style="color:#64748b; font-size:0.9rem; max-width:300px; margin:0 auto 20px auto;">
                    Добавьте первый источник выбросов, чтобы начать формировать расчёты по объекту.
                </p>
                <button class="btn btn-primary" onclick="startNewSource('${fac.id}')">+ Создать расчёт</button>
            </div>
        `;
        return;
    }
    
    let html = `<table class="facility-sources-table">
        <thead>
            <tr><th>#</th><th>Название источника</th><th>Методика</th><th>Форм.</th><th>M (г/с)</th><th>G (т/год)</th><th style="width:100px;">Действия</th></tr>
        </thead>
        <tbody>
    `;
    
    fac.sources.forEach((src, idx) => {
        const num = src.source_number || `000${idx+1}`;
        html += `
            <tr>
                <td style="color:var(--text-muted); font-size:0.8rem; font-weight:600;">${num}</td>
                <td style="font-weight:500;">${src.name || 'Безымянный источник'}</td>
                <td style="font-size:0.8rem; color:#64748b;">${src.methodic_name}</td>
                <td style="font-size:0.8rem;">${src.formula_code || '—'}</td>
                <td style="color:#047857; font-weight:600;">${(src.M || 0).toFixed(6)}</td>
                <td style="color:#047857; font-weight:600;">${(src.G || 0).toFixed(6)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-icon" onclick="editSource('${fac.id}', '${src.id}')" title="Редактировать">✏️</button>
                        <button class="btn-icon" onclick="duplicateSourceInFacility('${fac.id}', '${src.id}')" title="Копировать">⎘</button>
                        <button class="btn-icon danger" onclick="deleteSourceFromFacility('${fac.id}', '${src.id}')" title="Удалить">✖</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ------ TREE RENDERING ------
function renderProjectTree() {
    const container = document.getElementById('project-tree-container');
    if (!container) return;
    
    const stateObj = ProjectStore.getState();
    const facilities = stateObj.facilities || [];
    const totals = ProjectStore.getProjectTotals();
    
    let html = `
        <div class="tree-header">
            <h3 style="margin:0; font-size:0.9rem; font-weight:700; color:var(--text-main); text-transform:uppercase; cursor:pointer;" onclick="showProjectDashboard()">
                📁 Проект: ${stateObj.name || 'Новый проект'}
            </h3>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                ΣG = ${totals.totalG.toFixed(4)} т/год
            </div>
            <button class="btn btn-secondary btn-block" style="margin-top:16px;" onclick="showFacilityForm()">+ Объект</button>
        </div>
        <ul class="project-tree">
    `;
    
    facilities.forEach(fac => {
        const typeObj = FACILITY_TYPES.find(t => t.value === fac.type) || FACILITY_TYPES[FACILITY_TYPES.length - 1];
        const isExpanded = _selectedFacilityId === fac.id || (fac.sources && fac.sources.length > 0);
        
        html += `<li class="tree-facility" data-facility-id="${fac.id}">
            <div class="tree-facility-header ${_selectedFacilityId === fac.id ? 'active' : ''}" onclick="toggleTreeFacility(event, '${fac.id}')">
                <span class="tree-chevron ${isExpanded ? 'expanded' : ''}">▶</span>
                <span class="tree-icon">${typeObj.icon}</span>
                <span class="tree-label">${fac.name}</span>
                <span class="tree-badge">${fac.sources ? fac.sources.length : 0}</span>
            </div>
            <div class="tree-sources" id="tree-sources-${fac.id}" style="display:${isExpanded ? 'block' : 'none'};">
        `;
        
        if (fac.sources) {
            fac.sources.forEach(src => {
                html += `
                <div class="tree-source" onclick="editSource('${fac.id}', '${src.id}')">
                    <span class="tree-dot">●</span>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${src.name || 'Источник'}</span>
                    <span class="tree-mini-result">${(src.G || 0).toFixed(4)}</span>
                </div>`;
            });
        }
        
        html += `
                <button class="btn-add-source-tree" onclick="startNewSource('${fac.id}')">+ Добавить расчёт</button>
            </div>
        </li>`;
    });
    
    html += `</ul>`;
    container.innerHTML = html;
}

window.toggleTreeFacility = function(e, facId) {
    if (e.target.closest('.btn-add-source-tree') || e.target.closest('.tree-source')) return;
    showFacilityDashboard(facId);
    const srcDiv = document.getElementById(`tree-sources-${facId}`);
    const chev = e.currentTarget.querySelector('.tree-chevron');
    if (srcDiv) {
        if (srcDiv.style.display === 'none') {
            srcDiv.style.display = 'block';
            chev.classList.add('expanded');
        } else {
            srcDiv.style.display = 'none';
            chev.classList.remove('expanded');
        }
    }
};

// ------ FACILITY FORM ------
function showFacilityForm() {
    switchPane('facility-form-pane');
    document.getElementById('fac-form-id').value = '';
    document.getElementById('fac-form-name').value = '';
    document.getElementById('fac-form-type').value = 'other';
    document.getElementById('fac-form-phase').value = 'operation';
    document.getElementById('fac-form-address').value = '';
    document.getElementById('fac-form-desc').value = '';
}

function editFacility(facId) {
    const fac = ProjectStore.getFacility(facId);
    if (!fac) return;
    switchPane('facility-form-pane');
    document.getElementById('fac-form-id').value = fac.id;
    document.getElementById('fac-form-name').value = fac.name || '';
    document.getElementById('fac-form-type').value = fac.type || 'other';
    document.getElementById('fac-form-phase').value = fac.phase || 'operation';
    document.getElementById('fac-form-address').value = fac.address || '';
    document.getElementById('fac-form-desc').value = fac.description || '';
}

window.saveFacilityForm = function() {
    const id = document.getElementById('fac-form-id').value;
    const name = document.getElementById('fac-form-name').value.trim();
    if (!name) { showToast('Укажите название объекта', 'danger'); return; }
    
    const data = {
        name,
        type: document.getElementById('fac-form-type').value,
        phase: document.getElementById('fac-form-phase').value,
        address: document.getElementById('fac-form-address').value,
        description: document.getElementById('fac-form-desc').value
    };
    
    if (id) {
        ProjectStore.updateFacility(id, data);
        showFacilityDashboard(id);
    } else {
        const newFac = ProjectStore.addFacility(data);
        showFacilityDashboard(newFac.id);
    }
    renderProjectTree();
};

window.deleteFacility = function(facId) {
    if (confirm('ВНИМАНИЕ: Вы удаляете весь объект и все связанные с ним источники. Продолжить?')) {
        ProjectStore.removeFacility(facId);
        showProjectDashboard();
        renderProjectTree();
    }
};

window.duplicateFacility = function(facId) {
    ProjectStore.duplicateFacility(facId);
    renderProjectTree();
};

// ------ CALCULATOR WIZARD CONTEXT ------
window._wizardContext = null;

function returnToContext() {
    if (_wizardContext && _wizardContext.facilityId) {
        showFacilityDashboard(_wizardContext.facilityId);
    } else {
        showProjectDashboard();
    }
}

window.deleteSourceFromFacility = function(facId, sourceId) {
    if (confirm('Вы уверены, что хотите удалить этот источник?')) {
        ProjectStore.removeSourceFromFacility(facId, sourceId);
        showFacilityDashboard(facId);
        renderProjectTree();
    }
};

window.duplicateSourceInFacility = function(facId, sourceId) {
    // Uses the new scoped method handling
    const fac = ProjectStore.getFacility(facId);
    const src = fac.sources.find(s => s.id === sourceId);
    if (src) {
        const clonedSrc = JSON.parse(JSON.stringify(src));
        clonedSrc.id = "src_" + Date.now() + Math.floor(Math.random() * 1000);
        clonedSrc.name = (clonedSrc.name || "Копия") + " (Копия)";
        ProjectStore.addSourceToFacility(facId, clonedSrc);
        showFacilityDashboard(facId);
        renderProjectTree();
    }
};

window.editSource = function(facId, sourceId) {
    const fac = ProjectStore.getFacility(facId);
    if (!fac) return;
    const src = fac.sources.find(s => s.id === sourceId);
    if (!src) return;
    
    _wizardContext = { facilityId: facId, sourceId: sourceId };
    
    // Auto-fill wizard state
    state.inputs = JSON.parse(JSON.stringify(src.inputs || {}));
    state.composition = src.composition ? JSON.parse(JSON.stringify(src.composition)) : [];
    document.getElementById('wizard-source-name').value = src.name || '';
    
    document.getElementById('wizard-context-title').textContent = 'Редактирование расчёта';
    document.getElementById('wizard-context-subtitle').textContent = `Объект: ${fac.name}`;
    
    // We launch into step 1 so user can change methodic or keep it.
    // If they change methodic, the inputs clear.
    currentStep = 1;
    switchPane('calculator-wizard');
    if (state.methodics) renderMethodicCards(state.methodics);
    updateNavigation();
};

window.startNewSource = function(facilityId) {
    const fac = ProjectStore.getFacility(facilityId);
    if (!fac) return;
    
    _wizardContext = { facilityId };
    
    state.methodicId = null;
    state.methodicData = null;
    state.inputs = {};
    state.results = null;
    currentStep = 1;
    document.getElementById('wizard-source-name').value = '';
    
    document.getElementById('wizard-context-title').textContent = 'Новый расчёт';
    document.getElementById('wizard-context-subtitle').textContent = `Объект: ${fac.name}`;
    
    switchPane('calculator-wizard');
    if (state.methodics) renderMethodicCards(state.methodics);
    updateNavigation();
};

// Re-write wizard finish button to save to facility
function saveWizardResultToFacility() {
    if (!state.results || currentStep < 5) return;
    if (!_wizardContext || !_wizardContext.facilityId) { showToast("Контекст объекта не найден", "danger"); return; }
    
    const srcName = document.getElementById('wizard-source-name').value || (state.methodicData ? state.methodicData.meta.name : 'Источник');
    
    const sourceData = {
        name: srcName,
        methodic_name: state.methodicData.meta.name,
        category: state.methodicData.meta.category || 'operation',
        formula_code: state.formulaCode,
        inputs: state.inputs,
        results: state.results,
        composition: state.composition
    };

    if (_wizardContext.sourceId) {
        ProjectStore.updateSourceInFacility(_wizardContext.facilityId, _wizardContext.sourceId, sourceData);
    } else {
        ProjectStore.addSourceToFacility(_wizardContext.facilityId, sourceData);
    }

    renderProjectTree();
    showFacilityDashboard(_wizardContext.facilityId);
    showToast("Расчёт успешно сохранен", "success");
}


/**
 * Handbook Table Modal Logic
 */
let _currentHandbookTable = null;
async function openHandbookModal(tableId) {
    if (!tableId || !state.methodicData || !state.methodicData.tables) return;
    
    // Find table in unified format: tables.tables[]
    const tablesArray = state.methodicData.tables.tables || [];
    let table = tablesArray.find(t => t.id === tableId);
    
    // Try alternate ID formats
    if (!table) {
        table = tablesArray.find(t => t.id === `Table-${tableId}`) ||
                tablesArray.find(t => t.id === `table_${tableId}`) ||
                tablesArray.find(t => t.id === tableId.replace('-', '_'));
    }
    
    _currentHandbookTable = table;
    if (!table || !table.data || table.data.length === 0) {
        showToast(`Таблица "${tableId}" не найдена или пуста.`, 'danger');
        return;
    }

    const modal = document.getElementById('handbook-modal');
    const container = document.getElementById('handbook-table-container');
    const titleEl = document.getElementById('handbook-title');

    const title = table.title || table.id;
    const lookupType = table.lookup_type || 'exact';
    const sourceDoc = table.source ? (typeof table.source === 'string' ? table.source : table.source.document || '') : '';
    const columns = Object.keys(table.data[0]);
    const rowCount = table.data.length;

    titleEl.innerHTML = `${title} <span style="font-size:0.75em; color:#64748b; font-weight:400; margin-left:12px;">${tableId} &bull; ${lookupType} &bull; ${rowCount} rows${sourceDoc ? ' &bull; ' + sourceDoc : ''}</span>`;
    
    // State for sorting
    let sortCol = null;
    let sortAsc = true;
    let searchQuery = '';

    function renderTable() {
        let filteredData = table.data;

        // Apply search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredData = filteredData.filter(row => 
                columns.some(col => String(row[col] ?? '').toLowerCase().includes(q))
            );
        }

        // Apply sort
        if (sortCol) {
            filteredData = [...filteredData].sort((a, b) => {
                let va = a[sortCol], vb = b[sortCol];
                if (typeof va === 'number' && typeof vb === 'number') {
                    return sortAsc ? va - vb : vb - va;
                }
                return sortAsc 
                    ? String(va ?? '').localeCompare(String(vb ?? '')) 
                    : String(vb ?? '').localeCompare(String(va ?? ''));
            });
        }

        // Determine which columns are input_keys vs output_keys
        const inputKeys = new Set(table.input_keys || []);
        const outputKeys = new Set(table.output_keys || []);

        let html = `<div style="display:flex; gap:12px; margin-bottom:16px; align-items:center;">
            <input type="text" id="handbook-search" placeholder="Поиск по таблице..." value="${searchQuery}" 
                style="flex:1; padding:8px 12px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.9rem;">
            <span style="font-size:0.85rem; color:#64748b;">${filteredData.length} из ${rowCount} строк</span>
        </div>`;

        html += '<table class="handbook-view-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">';
        html += '<thead><tr>';
        columns.forEach(col => {
            const isInput = inputKeys.has(col);
            const isOutput = outputKeys.has(col);
            const sortIndicator = sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';
            const colStyle = isInput ? 'background:#eff6ff; color:#1d4ed8;' : 
                            (isOutput ? 'background:#f0fdf4; color:#166534;' : '');
            html += `<th data-col="${col}" style="cursor:pointer; padding:8px 10px; border-bottom:2px solid #e2e8f0; text-align:left; user-select:none; ${colStyle} font-weight:600; white-space:nowrap;">
                ${col}${sortIndicator}
                ${isInput ? ' <span style="font-size:0.7em; opacity:0.7;">[key]</span>' : ''}
                ${isOutput ? ' <span style="font-size:0.7em; opacity:0.7;">[out]</span>' : ''}
            </th>`;
        });
        html += '</tr></thead><tbody>';

        filteredData.forEach((row, rowIdx) => {
            // Find original row index in table.data for editing
            const origIdx = table.data.indexOf(row);
            html += `<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">`;
            columns.forEach(col => {
                const val = row[col];
                const displayVal = val == null ? '—' : val;
                const isEditable = outputKeys.has(col) || inputKeys.has(col);
                html += `<td style="padding:6px 10px; ${isEditable ? 'cursor:pointer;' : ''}" 
                    ${isEditable ? `ondblclick="handbookEditCell(this, ${origIdx}, '${col}')" title="Двойной клик для редактирования"` : ''}>
                    ${displayVal}
                </td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';

        container.innerHTML = html;

        // Wire search
        const searchInput = document.getElementById('handbook-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderTable();
            });
            // Refocus and restore cursor position
            searchInput.focus();
            searchInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }

        // Wire column header sort
        container.querySelectorAll('th[data-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-col');
                if (sortCol === col) {
                    sortAsc = !sortAsc;
                } else {
                    sortCol = col;
                    sortAsc = true;
                }
                renderTable();
            });
        });
    }

    renderTable();
    modal.style.display = 'flex';
}

/**
 * In-session cell editing for handbook modal tables.
 * User can double-click a cell to edit its value.
 * Changes update state.methodicData.tables in memory (session only).
 */
function handbookEditCell(td, rowIndex, colName) {
    if (!_currentHandbookTable || !_currentHandbookTable.data) return;
    
    const targetTable = _currentHandbookTable;
    if (!targetTable.data[rowIndex]) return;

    const currentVal = targetTable.data[rowIndex][colName];
    const input = document.createElement('input');
    input.type = typeof currentVal === 'number' ? 'number' : 'text';
    input.step = 'any';
    input.value = currentVal ?? '';
    input.style.cssText = 'width:100%; padding:4px; border:2px solid #3B82F6; border-radius:4px; font-size:0.85rem; background:#eff6ff;';
    
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
        const newVal = input.type === 'number' ? parseFloat(input.value) : input.value;
        if (!isNaN(newVal) || input.type === 'text') {
            targetTable.data[rowIndex][colName] = input.type === 'number' ? newVal : input.value;
            td.textContent = input.type === 'number' ? newVal : input.value;
            td.style.background = '#fef3c7';  // Yellow tint to show modified
            td.title = `Изменено (было: ${currentVal})`;
            
            // Re-run lookups in case this table data affects current calculations
            if (state.methodicData && state.inputs) {
                Wizard.runAutoLookups(state.methodicData, state.inputs);
                updateLookupValuesUI();
                renderLookupProvenancePanel();
            }
            showToast(`Значение обновлено: ${colName} = ${input.type === 'number' ? newVal : input.value}`, 'info');
        } else {
            td.textContent = currentVal ?? '—';
        }
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { td.textContent = currentVal ?? '—'; }
    });
}

