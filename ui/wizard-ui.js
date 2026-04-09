// --- WIZARD UI MODULE ---\n// ========================================================================
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
        const hasPdfMap = {
            'M1_storage': ['reference/M1_storage/source.pdf'],
            'M2_welding': ['reference/M2_welding/source.pdf'],
            'M3_unorganized': ['reference/M3_unorganized/source.pdf'],
            'M4_fuel_stations': ['reference/M4_fuel_stations/source.pdf'],
            'M12_tanks': ['reference/M12_tanks/source.pdf'],
            'M9_flares': ['reference/M9_flares/source_part1.pdf', 'reference/M9_flares/source_part2.pdf']
        };

        let pdfLinksHtml = '';
        if (hasPdfMap[m.id]) {
            pdfLinksHtml = `<div class="mt-2">` + hasPdfMap[m.id].map((link, i) => 
                `<a href="${link}" target="_blank" class="btn btn-secondary" style="font-size: 0.7rem; padding: 4px 8px; margin-right: 4px; text-decoration: none;" onclick="event.stopPropagation()">📥 PDF ${hasPdfMap[m.id].length > 1 ? (i+1) : ''}</a>`
            ).join('') + `</div>`;
        }

        const card = document.createElement('div');
        card.className = `scenario-card ${state.methodicId === m.id ? 'selected' : ''}`;
        card.innerHTML = `
            <h4>${m.name}</h4>
            <p><small>${m.name_en || ''}</small></p>
            <p class="mt-4"><small>Версия: <strong>${m.version}</strong> • Формулы: ${m.formula_codes.length}</small></p>
            ${pdfLinksHtml}
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

    // Global Mapping sync removed for Clean UI (user selected manually)

    // Run auto-lookups first to establish initial state
    Wizard.runAutoLookups(state.methodicData, state.inputs);

    const root = document.getElementById('param-workspace-root');
    if (!root) return;
    root.innerHTML = '';

    // Create Workspace Container
    const workspace = document.createElement('div');
    workspace.className = 'param-workspace';

    // --- LEFT COLUMN ---
    const mainCol = document.createElement('div');
    mainCol.className = 'param-main-col';

    // 1. Hero Card
    const heroCard = document.createElement('div');
    heroCard.className = 'param-hero-card';
    
    // Calculate Stats
    const manualCount = questions.filter(q => !q.lookup_table && !q.auto_lookup && !q.is_calc).length;
    const regionCount = questions.filter(q => q.global_mapping && !state.inputs[`${q.variable_id}_override`]).length;
    const lookupCount = questions.filter(q => (q.lookup_table || q.auto_lookup) && !state.inputs[`${q.variable_id}_override`]).length;

    heroCard.innerHTML = `
        <h2>Настройка параметров</h2>
        <p>Заполните исходные данные для расчета. Коэффициенты и региональные значения будут подставлены автоматически.</p>
        
        <div style="margin: 24px 0;">
            <label style="display:block; color:rgba(255,255,255,0.8); font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-bottom:8px;">Название источника</label>
            <input type="text" id="workspace-source-name" value="${escapeHTML(document.getElementById('wizard-source-name').value)}" 
                placeholder="Например: Резервуар РВС-5000 №1"
                style="width:100%; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:8px; padding:12px; color:white; font-weight:600; outline:none;">
        </div>

        <div class="param-hero-stats">
            <span class="hero-stat-chip">Полей ввода: ${manualCount}</span>
            <span class="hero-stat-chip">Справочник: ${lookupCount}</span>
            <span class="hero-stat-chip" id="hero-readiness-chip" style="background:var(--primary); color:white;">Загрузка...</span>
        </div>
        <div id="hero-validation-summary" style="margin-top:12px; font-size:0.85rem; color:rgba(255,255,255,0.9); font-weight:500;"></div>
    `;
    mainCol.appendChild(heroCard);

    // Sync source name to hidden input
    const nameInput = heroCard.querySelector('#workspace-source-name');
    nameInput.addEventListener('input', (e) => {
        document.getElementById('wizard-source-name').value = e.target.value;
    });

    // 2. Manual Input Cards
    const manualQuestions = questions.filter(q => !q.lookup_table && !q.auto_lookup && !q.is_calc);
    manualQuestions.forEach(q => {
        mainCol.appendChild(renderParamCard(q));
    });

    workspace.appendChild(mainCol);

    // --- RIGHT COLUMN (SIDEBAR) ---
    const sidebar = document.createElement('div');
    sidebar.className = 'param-sidebar';

    // 1. Live Preview Card
    const previewPanel = document.createElement('div');
    previewPanel.className = 'sidebar-panel';
    previewPanel.innerHTML = `
        <div class="sidebar-panel-header">⚡ Предварительный расчет</div>
        <div class="sidebar-panel-body" id="live-preview-container">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div style="text-align:center;">
                    <small style="color:#6b7280; display:block; margin-bottom:4px;">G (т/г)</small>
                    <div id="preview-G" class="preview-result">—</div>
                </div>
                <div style="text-align:center;">
                    <small style="color:#6b7280; display:block; margin-bottom:4px;">M (г/с)</small>
                    <div id="preview-M" class="preview-result">—</div>
                </div>
            </div>
            <div id="preview-formula-code" style="margin-top:12px; font-size:0.7rem; color:#9ca3af; text-align:center; font-family:monospace;">Код: ${state.formulaCode || '—'}</div>
        </div>
    `;
    sidebar.appendChild(previewPanel);

    // 2. Formula Accordion
    const formulaPanel = document.createElement('div');
    formulaPanel.className = 'sidebar-panel';
    const formulaCode = state.formulaCode || Wizard.getFormulaCode(state.methodicData.questions, state.sourceType, state.calcMethod);
    const eqInfo = Wizard.getEquationInfo(state.methodicData, formulaCode);
    
    const sourceTypeDef = state.methodicData.meta.source_types.find(st => st.value === state.sourceType);
    const branchLabel = sourceTypeDef ? sourceTypeDef.label : (eqInfo[0]?.formula_name || '');
    
    formulaPanel.innerHTML = `
        <div class="sidebar-panel-header" style="cursor:pointer;" onclick="const b = this.nextElementSibling; b.style.display = b.style.display==='none'?'block':'none';">
            📐 Формула расчета
            <span>▼</span>
        </div>
        <div class="sidebar-panel-body" style="display:none; background:#f9fafb;">
            <div style="font-weight:700; margin-bottom:8px; font-size:0.85rem;">${branchLabel}</div>
            ${eqInfo.map(eq => `
                <div style="margin-bottom:8px; font-size:0.8rem;">
                    ${eq.latex ? `<div style="overflow-x:auto;">${renderLatex(eq.latex)}</div>` : `<code>${eq.lhs} = ${eq.rhs}</code>`}
                </div>
            `).join('')}
        </div>
    `;
    sidebar.appendChild(formulaPanel);

    // 3. Auto-filled & Calculated Variables
    const autoQuestions = questions.filter(q => q.lookup_table || q.auto_lookup || q.is_calc);
    if (autoQuestions.length > 0) {
        const autoPanel = document.createElement('div');
        autoPanel.className = 'sidebar-panel';
        autoPanel.innerHTML = `
            <div class="sidebar-panel-header">🤖 Автозаполнение</div>
            <div class="sidebar-panel-body" style="padding:0;">
                <div id="auto-vars-container"></div>
            </div>
        `;
        sidebar.appendChild(autoPanel);
        const autoContainer = autoPanel.querySelector('#auto-vars-container');
        autoQuestions.forEach(q => {
            autoContainer.appendChild(renderParamCard(q, true));
        });
    }

    // 4. Provenance Panel
    const provPanel = document.createElement('div');
    provPanel.className = 'sidebar-panel';
    provPanel.setAttribute('id', 'lookup-provenance-panel');
    provPanel.innerHTML = `
        <div class="sidebar-panel-header" style="cursor:pointer;" onclick="const b = this.nextElementSibling; b.style.display = b.style.display==='none'?'block':'none';">
            📋 Аудит данных
            <span class="hero-stat-chip" id="provenance-count" style="background:#e5e7eb; color:#374151; margin-left:8px;">0</span>
            <span style="margin-left:auto;">▼</span>
        </div>
        <div class="sidebar-panel-body" style="display:none; padding:0;">
            <table class="provenance-table" style="width:100%; font-size:0.75rem;"><tbody id="provenance-tbody"></tbody></table>
        </div>
    `;
    sidebar.appendChild(provPanel);

    workspace.appendChild(sidebar);
    root.appendChild(workspace);

    updateLookupValuesUI();
    updateLivePreview();
    validateStep3(); // Initial validation pass
}

/**
 * Renders a single parameter heart/card with the new design.
 */
function renderParamCard(q, isSidebar = false) {
    const card = document.createElement('div');
    card.className = `param-card ${isSidebar ? 'sidebar-style' : ''}`;
    card.setAttribute('data-var-id', q.variable_id);

    const status = getStatus(q);
    const tableId = q.auto_lookup ? q.auto_lookup.table : q.lookup_table;
    const isReadOnly = q.is_calc || ( (q.auto_lookup || q.lookup_table) && !state.inputs[`${q.variable_id}_override`] );

    card.innerHTML = `
        <div class="param-card-header">
            <div class="param-label">${q.label}</div>
            <div class="status-badge ${status.class}">${status.label}</div>
        </div>
        
        <div class="param-meta-row">
            ${q.unit ? `<span class="chip chip-unit">${q.unit}</span>` : ''}
            <span class="chip chip-token">${q.token || q.variable_id}</span>
            ${q.latex ? `<span class="chip chip-latex">${renderLatex(q.latex)}</span>` : ''}
        </div>

        ${q.help_text ? `<div class="param-help">${q.help_text}</div>` : ''}

        <div class="param-control-row">
            <div class="param-input-wrapper">
                ${q.type === 'select' 
                    ? `
                        <select class="cart-input" style="width:100%;" ${isReadOnly ? 'disabled' : ''}>
                            <option value="">-- Выберите --</option>
                            ${(q.options || []).map(o => `<option value="${o.value}" ${state.inputs[q.variable_id] == o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    `
                    : `
                        <input type="number" step="any" class="cart-input" style="width:100%;" 
                            value="${state.inputs[q.variable_id] ?? ''}"
                            ${isReadOnly ? 'disabled' : ''}
                            placeholder="${q.default ?? '0.00'}">
                    `
                }
            </div>
            ${tableId ? `<button class="btn btn-secondary" style="padding:8px 12px;" onclick="openHandbookModal('${tableId}')" title="Открыть справочник">📖</button>` : ''}
            ${(q.auto_lookup || q.lookup_table || q.global_mapping) ? 
                `<button class="btn btn-secondary override-toggle" style="padding:8px 12px;" title="${state.inputs[`${q.variable_id}_override`] ? 'Вернуть авто-значение' : 'Изменить вручную'}">
                    ${state.inputs[`${q.variable_id}_override`] ? '🔒' : '🔓'}
                </button>` : ''
            }
        </div>

        <div class="param-card-footer" id="footer-${q.variable_id}">
            ${getSourceSummary(q)}
        </div>

        <div class="validation-message" id="msg-${q.variable_id}"></div>
    `;

    const input = card.querySelector('input, select');
    
    // Use input event for live feedback, but we still need to manage state.inputs
    input.addEventListener('input', (e) => {
        let val = q.type === 'select' ? e.target.value : parseFloat(e.target.value);
        if (q.type !== 'select' && isNaN(val)) {
            delete state.inputs[q.variable_id];
        } else if (val !== "") {
            state.inputs[q.variable_id] = val;
            if (q.auto_lookup || q.lookup_table || q.global_mapping) {
                state.inputs[`${q.variable_id}_override`] = true;
            }
        } else {
            delete state.inputs[q.variable_id];
        }
        
        // Run lookups but don't full re-render yet to avoid losing focus
        Wizard.runAutoLookups(state.methodicData, state.inputs);
        validateStep3();
        updateLivePreview();
    });

    // Re-render on blur/change for full UI sync
    input.addEventListener('change', () => {
        renderParameters();
    });

    const overrideBtn = card.querySelector('.override-toggle');
    if (overrideBtn) {
        overrideBtn.onclick = () => {
            if (state.inputs[`${q.variable_id}_override`]) {
                delete state.inputs[`${q.variable_id}_override`];
                // When unlocking, we might want to clear the manual value so auto-lookup takes over
                delete state.inputs[q.variable_id];
            } else {
                state.inputs[`${q.variable_id}_override`] = true;
            }
            Wizard.runAutoLookups(state.methodicData, state.inputs);
            renderParameters();
        };
    }

    return card;
}

function getStatus(q) {
    if (state.inputs[`${q.variable_id}_override`]) return { label: 'Вручную', class: 'badge-manual' };
    if (q.is_calc) return { label: 'Расчет', class: 'badge-calc' };
    if (q.auto_lookup || q.lookup_table) {
        return state.inputs[q.variable_id] != null ? { label: 'Справочник', class: 'badge-lookup' } : { label: 'Ожидает', class: 'badge-wait' };
    }
    if (q.global_mapping) return { label: 'Из региона', class: 'badge-region' };
    return { label: 'Ввод', class: 'badge-input' };
}

function getSourceSummary(q) {
    const trace = state.inputs[`${q.variable_id}_trace`];
    if (state.inputs[`${q.variable_id}_override`]) return 'Значение введено пользователем вручную.';
    if (q.is_calc) return 'Значение вычислено по формуле.';
    if (trace) {
        if (trace.source_type === 'lookup') return `Получено из таблицы ${trace.table_id}.`;
        if (trace.source_type === 'equation') return `Вычислено автоматически.`;
    }
    if (q.global_mapping && state.inputs[q.variable_id] != null) return 'Унаследовано из настроек региона проекта.';
    if (q.auto_lookup || q.lookup_table) return 'Ожидает заполнения зависимых полей для поиска в справочнике.';
    return 'Требуется ввод данных.';
}

function updateLivePreview() {
    if (!state.methodicData || !state.formulaCode) return;
    
    // Evaluate silently
    try {
        const result = Evaluator.evaluateFormulaCode(
            state.methodicData.equations.active_equations,
            state.formulaCode,
            state.inputs
        );
        
        const gEl = document.getElementById('preview-G');
        const mEl = document.getElementById('preview-M');
        
        if (gEl) gEl.textContent = result.G != null ? result.G.toFixed(4) : '—';
        if (mEl) mEl.textContent = result.M != null ? result.M.toFixed(4) : '—';
    } catch (e) {
        // Fail silently
    }
}

/**
 * Validates all visible fields in Step 3 and updates UI states.
 */
function validateStep3() {
    if (!state.methodicData) return;

    const varIds = Wizard.getRequiredVariables(
        state.methodicData.questions, state.sourceType, state.calcMethod
    );
    const questions = Wizard.buildQuestions(state.methodicData, varIds);
    
    let errorCount = 0;
    let warningCount = 0;
    let pendingCount = 0;
    let totalRequired = 0;

    // 1. Individual Field Validation
    questions.forEach(q => {
        const val = state.inputs[q.variable_id];
        const res = Validation.validateField(q, val);
        const card = document.querySelector(`.param-card[data-var-id="${q.variable_id}"]`);
        const input = card?.querySelector('.cart-input');
        const msgEl = document.getElementById(`msg-${q.variable_id}`);

        if (q.required) totalRequired++;

        // Reset classes
        if (card) {
            card.classList.remove('is-invalid', 'is-valid', 'is-warning', 'is-pending');
            input?.classList.remove('is-invalid', 'is-valid', 'is-warning');
        }
        if (msgEl) {
            msgEl.classList.remove('is-invalid', 'is-warning');
            msgEl.textContent = '';
        }

        // Apply state
        if (res.state === Validation.STATES.INVALID) {
            errorCount++;
            card?.classList.add('is-invalid');
            input?.classList.add('is-invalid');
            if (msgEl) {
                msgEl.classList.add('is-invalid');
                msgEl.textContent = res.message;
            }
        } else if (res.state === Validation.STATES.WARNING) {
            warningCount++;
            card?.classList.add('is-warning');
            input?.classList.add('is-warning');
            if (msgEl) {
                msgEl.classList.add('is-warning');
                msgEl.textContent = res.message;
            }
        } else if (res.state === Validation.STATES.PENDING) {
            pendingCount++;
            card?.classList.add('is-pending');
        } else if (res.state === Validation.STATES.VALID && val != null) {
            card?.classList.add('is-valid');
            input?.classList.add('is-valid');
        }

        // Add Lookup Clamping Warnings
        const trace = state.inputs[`${q.variable_id}_trace`];
        if (trace && trace.method === 'clamped') {
            warningCount++;
            card?.classList.add('is-warning');
            if (msgEl) {
                msgEl.classList.add('is-warning');
                msgEl.textContent = (msgEl.textContent ? msgEl.textContent + ' • ' : '') + 'Значение ограничено границей таблицы';
            }
        }
    });

    // 2. Cross-field Validation
    const crossRes = Validation.validateCrossField(state.inputs, questions);
    crossRes.forEach(res => {
        errorCount++;
        const card = document.querySelector(`.param-card[data-var-id="${res.varId}"]`);
        const input = card?.querySelector('.cart-input');
        const msgEl = document.getElementById(`msg-${res.varId}`);
        
        card?.classList.add('is-invalid');
        input?.classList.add('is-invalid');
        if (msgEl) {
            msgEl.classList.add('is-invalid');
            msgEl.textContent = (msgEl.textContent ? msgEl.textContent + ' • ' : '') + res.message;
        }
    });

    // 3. Update Hero Summary
    const chip = document.getElementById('hero-readiness-chip');
    const summary = document.getElementById('hero-validation-summary');
    if (chip) {
        const filled = totalRequired - pendingCount;
        const pct = totalRequired > 0 ? Math.round((filled / totalRequired) * 100) : 100;
        chip.textContent = `Готовность: ${pct}%`;
        chip.style.background = pct === 100 ? 'var(--success)' : 'var(--primary)';
    }
    if (summary) {
        if (errorCount > 0) summary.innerHTML = `⚠️ Найдено ошибок: ${errorCount}. Проверьте поля, отмеченные красным.`;
        else if (pendingCount > 0) summary.innerHTML = `📝 Ожидается заполнение еще ${pendingCount} обязательных полей.`;
        else if (warningCount > 0) summary.innerHTML = `ℹ️ Есть ${warningCount} предупреждения (не блокируют расчет).`;
        else summary.innerHTML = `✅ Все данные заполнены корректно.`;
    }

    // Update global state for next-button blocking
    state.isStep3Valid = (errorCount === 0 && pendingCount === 0);
    updateNavigation();
}

function updateLookupValuesUI() {
    renderLookupProvenancePanel();
}


// Generic lookups are now handled by Wizard.runAutoLookups using variables.json metadata

/**
 * Render the lookup provenance panel showing all auto-looked-up coefficients.
 * Reads all _trace keys from state.inputs and displays them in a structured table.
 * Adds hover tooltips showing the full table data for each referenced table.
 */
function renderLookupProvenancePanel() {
    const tbody = document.getElementById('provenance-tbody');
    const countEl = document.getElementById('provenance-count');
    if (!tbody) return;

    tbody.innerHTML = '';
    let count = 0;

    // Collect all trace entries from state.inputs
    for (const [key, val] of Object.entries(state.inputs)) {
        if (!key.endsWith('_trace') || !val) continue;

        const varId = key.replace('_trace', '');
        let varLabel = varId;
        if (state.methodicData && state.methodicData.variables) {
            const varList = Array.isArray(state.methodicData.variables) ? state.methodicData.variables : (state.methodicData.variables.variables || []);
            const varDef = varList.find(v => v.id === varId);
            if (varDef) varLabel = varDef.label || varId;
        }

        let tableName = '—', keyInfo = '—', resultVal = '—', paramMethod = '—';

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
            if (typeof resultVal === 'number') resultVal = resultVal.toFixed(6);
        }

        const previewHTML = buildTablePreviewHTML(tableName, keyInfo);

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f3f4f6';
        tr.innerHTML = `
            <td style="padding:12px; vertical-align:top;">
                <div style="font-weight:700; color:#1f2937;">${varLabel}</div>
                <div style="font-size:0.7rem; color:#9ca3af;">${varId}</div>
            </td>
            <td style="padding:12px; vertical-align:top;">
                <div class="table-preview-wrapper" style="position:relative; display:inline-block;">
                    <code style="background:#f3f4f6; padding:2px 4px; border-radius:4px; font-size:0.75rem;">${tableName}</code>
                    ${previewHTML ? `<div class="table-preview-tooltip">${previewHTML}</div>` : ''}
                </div>
                <div style="font-size:0.7rem; color:#6b7280; margin-top:4px;">${keyInfo}</div>
            </td>
            <td style="padding:12px; vertical-align:top; text-align:right;">
                <div style="font-weight:800; color:#065f46;">${resultVal}</div>
                <div style="font-size:0.7rem; color:#9ca3af;">${paramMethod}</div>
            </td>
        `;
        tbody.appendChild(tr);
        count++;
    }

    if (countEl) countEl.textContent = count;
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
        state.composition = Composition.getDefault(state.methodicData, state.sourceType, state.calcMethod, state.inputs);
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
            updateCompositionTotalUI();
        });

        const btnRemove = item.querySelector('.btn-remove-comp');
        btnRemove.addEventListener('click', () => {
            state.composition.splice(idx, 1);
            renderComposition(); // Re-render list
        });

        list.appendChild(item);
    });

    // Add button to add custom pollutant
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.marginTop = '24px';
    footer.style.padding = '16px';
    footer.style.background = '#f8fafc';
    footer.style.borderRadius = '12px';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary';
    addBtn.textContent = '+ Добавить компонент';
    addBtn.addEventListener('click', () => {
        const name = prompt('Название загрязняющего вещества:');
        if (name) {
            state.composition.push({ name, pct: 0 });
            renderComposition();
        }
    });

    const totalDisplay = document.createElement('div');
    totalDisplay.id = 'comp-total-display';
    totalDisplay.style.fontWeight = '700';
    totalDisplay.style.fontSize = '1.1rem';

    footer.appendChild(addBtn);
    footer.appendChild(totalDisplay);
    list.appendChild(footer);

    updateCompositionTotalUI();
}

/**
 * Update the composition total display and validate.
 */
function updateCompositionTotalUI() {
    const res = Validation.validateComposition(state.composition);
    const display = document.getElementById('comp-total-display');
    if (display) {
        display.textContent = `Итого: ${res.total.toFixed(2)}%`;
        display.style.color = res.valid ? 'var(--success)' : 'var(--danger)';
        
        // Add hint message
        let hint = document.getElementById('comp-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'comp-hint';
            hint.style.fontSize = '0.8rem';
            hint.style.marginTop = '4px';
            display.parentElement.appendChild(hint);
        }
        hint.textContent = res.valid ? '✅ Состав сбалансирован' : '⚠️ ' + res.message;
        hint.style.color = res.valid ? 'var(--success)' : 'var(--danger)';
    }
    
    state.isStep4Valid = res.valid;
    updateNavigation();
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
        const card = document.querySelector(`.param-card[data-var-id="${varId}"]`);
        if (!card) return;
        const el = card.querySelector('.cart-input');
        if (!el) return;
        
        let val;
        if (el.tagName === 'SELECT') {
            val = el.value;
        } else {
            val = parseFloat(el.value);
            if (isNaN(val)) val = null;
        }
        
        if (val !== null && val !== "") {
            state.inputs[varId] = val;
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
    let tbodySummary = document.querySelector('#summary-table tbody');
    if (!tbodySummary) {
        const tableSummary = document.getElementById('summary-table');
        if (tableSummary) {
            tbodySummary = document.createElement('tbody');
            tableSummary.appendChild(tbodySummary);
        }
    }
    if (tbodySummary) tbodySummary.innerHTML = '';

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
    let tbodySplit = document.querySelector('#split-table tbody');
    if (!tbodySplit) {
        const tableSplit = document.getElementById('split-table');
        if (tableSplit) {
            tbodySplit = document.createElement('tbody');
            tableSplit.appendChild(tbodySplit);
        }
    }
    if (tbodySplit) tbodySplit.innerHTML = '';

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
            showToast('Пожалуйста, выберите методику.', 'warning');
            return;
        }

        if (currentStep === 2 && !state.sourceType) {
            showToast('Пожалуйста, выберите тип расчёта.', 'warning');
            return;
        }

        if (currentStep === 2 && !state.calcMethod) {
            showToast('Пожалуйста, выберите метод расчёта.', 'warning');
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
            validateStep3(); // Final check before next
            if (!state.isStep3Valid) {
                showToast('Пожалуйста, исправьте ошибки в параметрах (выделены красным).', 'danger');
                return;
            }
            renderComposition();
        }
        if (currentStep === 4) {
            const compRes = Validation.validateComposition(state.composition);
            if (!compRes.valid) {
                showToast('Ошибка в составе: ' + compRes.message, 'danger');
                return;
            }
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
    if (currentStep === 3 && state.isStep3Valid === false) canProceed = false;
    if (currentStep === 4 && state.isStep4Valid === false) canProceed = false;

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

window.editSource = async function(facId, sourceId) {
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
    
    // Attempt full restoration
    if (src.methodic_id || src.methodic_name) {
        state.methodicId = src.methodic_id || src.methodic_name;
        state.sourceType = src.source_type || null;
        state.calcMethod = src.calc_method || null;
        state.formulaCode = src.formula_code || null;
        
        const methodic = state.methodics.find(m => m.id === state.methodicId || m.name === state.methodicId);
        if (methodic) {
            state.methodicPath = methodic.path;
            state.methodicId = methodic.id; // Normalize to ID
            
            try {
                // Load the JSON data
                state.methodicData = await window.Wizard.loadMethodic(state.methodicPath);
                document.getElementById('methodic-badge').textContent = methodic.name;
                
                // Set up the UI for step 3
                currentStep = 3;
                switchPane('calculator-wizard');
                
                // Initialize background UI state just in case user goes backward
                renderMethodicCards(state.methodics);
                if (state.sourceType) {
                    renderSourceTypes();
                    if (state.calcMethod) {
                        renderCalcMethods();
                    }
                }
                
                // Render Step 3 Parameter Grid
                // Wait, handleNext() does: renderParameters(); but renderParameters might be sufficient?
                renderParameters();
                // updateNavigation() only toggles visibility, doesn't build step 3
                updateNavigation();
                
                return;
            } catch(e) {
                console.error("Failed to restore methodic data during edit", e);
            }
        }
    }
    
    // Fallback if unable to restore
    currentStep = 1;
    switchPane('calculator-wizard');
    if (state.methodics) renderMethodicCards(state.methodics);
    updateNavigation();
};

window.startNewSource = function(facilityId) {
    const fac = ProjectStore.getFacility(facilityId);
    if (!fac) return;
    
    _wizardContext = { facilityId };
    clearSuccessOverlay(); // Remove success overlay so pane-6 DOM is intact
    
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

window.editSource = async function(facilityId, sourceId) {
    const fac = ProjectStore.getFacility(facilityId);
    if (!fac) return;
    const src = fac.sources.find(s => s.id == sourceId);
    if (!src) return;

    _wizardContext = { facilityId, sourceId };
    clearSuccessOverlay();

    state.methodicId = src.methodic_id;
    state.sourceType = src.source_type || null;
    state.calcMethod = src.calc_method || null;
    state.formulaCode = src.formula_code || null;
    state.inputs = JSON.parse(JSON.stringify(src.inputs || {}));
    state.composition = JSON.parse(JSON.stringify(src.composition || []));
    state.results = JSON.parse(JSON.stringify(src.results || {}));

    const wizardNameEl = document.getElementById('wizard-source-name');
    if (wizardNameEl) wizardNameEl.value = src.name || '';
    
    const titleEl = document.getElementById('wizard-context-title');
    if (titleEl) titleEl.textContent = 'Редактировать расчёт';
    const subtitleEl = document.getElementById('wizard-context-subtitle');
    if (subtitleEl) subtitleEl.textContent = `Объект: ${fac.name}`;

    switchPane('calculator-wizard');

    try {
        const methodicMeta = state.methodics.find(m => m.id === state.methodicId) || state.methodics.find(m => m.name === src.methodic_name);
        if (!methodicMeta) throw new Error("Methodic missing from registry");
        
        state.methodicId = methodicMeta.id;
        state.methodicPath = methodicMeta.path;
        state.methodicData = await Wizard.loadMethodic(state.methodicPath);
        
        document.getElementById('methodic-badge').textContent = state.methodicData.meta.name;
        
        // Jump to inputs (Step 3) since type is already known
        currentStep = 3; 
        updateNavigation();
        renderParameters();
    } catch (e) {
        console.error(e);
        showToast("Ошибка загрузки методики", "danger");
    }
};

// Step 13: Final Success Screen Logic
function saveWizardResultToFacility() {
    if (!state.results || currentStep < 6) return;
    if (!_wizardContext || !_wizardContext.facilityId) { 
        showToast("Контекст объекта не найден", "danger"); 
        return; 
    }
    
    const wizardNameEl = document.getElementById('wizard-source-name');
    const typedName = wizardNameEl ? wizardNameEl.value.trim() : '';
    const srcName = typedName || ((state.methodicData && state.methodicData.meta) ? state.methodicData.meta.name : 'Источник');
    
    const sourceData = {
        name: srcName,
        methodic_name: state.methodicData.meta.name,
        methodic_id: state.methodicId,
        source_type: state.sourceType,
        calc_method: state.calcMethod,
        category: state.methodicData.meta.category || 'operation',
        formula_code: state.formulaCode,
        inputs: JSON.parse(JSON.stringify(state.inputs)),
        results: JSON.parse(JSON.stringify(state.results)),
        composition: JSON.parse(JSON.stringify(state.composition)),
        M: state.results.M,
        G: state.results.G
    };

    if (_wizardContext.sourceId) {
        ProjectStore.updateSourceInFacility(_wizardContext.facilityId, _wizardContext.sourceId, sourceData);
    } else {
        ProjectStore.addSourceToFacility(_wizardContext.facilityId, sourceData);
    }

    // Phase 3: Transition to Success Panel (Step 13) instead of just closing
    renderSuccessPanel();
    showToast("Расчёт успешно сохранен", "success");
}

function renderSuccessPanel() {
    const pane = document.getElementById('pane-6'); // Result pane
    if (!pane) return;
    
    // Remove any existing overlay first
    const existing = pane.querySelector('.success-screen-overlay');
    if (existing) existing.remove();
    
    // Append overlay ON TOP of existing DOM instead of replacing innerHTML.
    // This preserves summary-table, split-table, equations-used-list for future calculations.
    const overlay = document.createElement('div');
    overlay.className = 'success-screen-overlay';
    overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:var(--bg, #f8fafc); z-index:10; display:flex; align-items:center; justify-content:center;';
    overlay.innerHTML = `
        <div style="text-align:center; padding:60px 40px; animation: fadeIn 0.5s ease-out;">
            <div style="font-size:4rem; margin-bottom:24px;">✅</div>
            <h2 style="color:var(--primary); font-size:1.8rem; margin-bottom:12px;">Расчет завершен успешно!</h2>
            <p style="color:var(--text-muted); max-width:500px; margin:0 auto 32px;">Ваши данные сохранены в реестр источников объекта. Вы можете продолжить расчеты или вернуться к сводному отчету.</p>
            
            <div style="display:flex; justify-content:center; gap:16px;">
                <button class="btn btn-secondary" onclick="startCalculationForFacility('${_wizardContext.facilityId}')" style="min-width:180px; padding:12px 24px;">+ Добавить еще</button>
                <button class="btn btn-primary" onclick="showFacilityDashboard('${_wizardContext.facilityId}')" style="min-width:180px; padding:12px 24px;">К списку источников</button>
            </div>
            
            <div style="margin-top:48px; padding-top:24px; border-top:1px solid #e2e8f0;">
                <button class="btn btn-secondary" style="border:none; color:var(--primary); text-decoration:underline;" onclick="showProjectDashboard()">🏠 На главную проекта</button>
            </div>
        </div>
    `;
    
    // Ensure pane has relative positioning for the overlay
    pane.style.position = 'relative';
    pane.appendChild(overlay);
}

/**
 * Clean up success overlay so pane-6 DOM is usable again.
 * Called when starting a new calculation.
 */
function clearSuccessOverlay() {
    const pane = document.getElementById('pane-6');
    if (pane) {
        const overlay = pane.querySelector('.success-screen-overlay');
        if (overlay) overlay.remove();
    }
}


