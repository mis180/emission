// --- WIZARD UI MODULE ---
// ========================================================================
// STEP 1: METHODIC SELECTION
// ========================================================================
function _uiTextScore(s) {
    if (typeof s !== 'string') return -Infinity;
    const cyr = (s.match(/[\u0400-\u04FF]/g) || []).length;
    const lat = (s.match(/[A-Za-z]/g) || []).length;
    const badMarkers = (s.match(/[\u00C3\u00C2\u00D0\u00D1]/g) || []).length;
    const replacement = (s.match(/\uFFFD/g) || []).length;
    return (cyr * 3) + lat - (badMarkers * 3) - (replacement * 4);
}

function _uiDecodeUtf8FromLatin1(input) {
    if (typeof input !== 'string' || typeof TextDecoder === 'undefined') return input;
    const cp1252Extra = {
        0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
        0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
        0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
        0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
        0x017E: 0x9E, 0x0178: 0x9F
    };
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        if (code <= 0xFF) {
            bytes[i] = code;
            continue;
        }
        const mapped = cp1252Extra[code];
        if (mapped == null) return input;
        bytes[i] = mapped;
    }
    try {
        return new TextDecoder('utf-8').decode(bytes);
    } catch (_) {
        return input;
    }
}

function uiText(input) {
    if (typeof input !== 'string' || input.length === 0) return input;
    let best = input;
    let bestScore = _uiTextScore(best);
    for (let i = 0; i < 8; i++) {
        if (!/[\u00C3\u00C2\u00D0\u00D1]/.test(best)) break;
        const candidate = _uiDecodeUtf8FromLatin1(best);
        if (!candidate || candidate === best) break;
        const score = _uiTextScore(candidate);
        if (score <= bestScore) break;
        best = candidate;
        bestScore = score;
    }
    return best;
}

function renderMethodicCards(methodics) {
    const grid = document.getElementById('methodic-grid');
    grid.innerHTML = '';
    const visibleMethodics = (methodics || []).filter(m => {
        const visibility = String(m.visibility_status || m.release_status || m.status || 'ready_public').toLowerCase();
        const visibleStates = new Set(['ready_public', 'active', 'beta_limited', 'beta']);
        return visibleStates.has(visibility);
    });

    if (visibleMethodics.length === 0) {
        grid.innerHTML = '<p>Нет доступных методик.</p>';
        return;
    }

    visibleMethodics.forEach(m => {
        // B1: Updated to use new semantic methodic IDs (fuel_stations_2011, etc.)
        // Old M#_ prefix IDs are deprecated and no longer valid.
        let pdfLinksHtml = '';
        if (m.source_pdf) {
            // Support either single string or array in case there are multiple
            const pdfs = Array.isArray(m.source_pdf) ? m.source_pdf : [m.source_pdf];
            // Path logic: the source_pdf is typically relative to methodic folder, e.g. "reference/2011_fuel_stations.pdf"
            // We need to resolve it relative to 'data/methodics/' + m.id + '/'
            pdfLinksHtml = `<div class="mt-2">` + pdfs.map((link, i) => {
                const fullPath = link.startsWith('http') ? link : `data/methodics/${m.id}/${link}`;
                return `<a href="${fullPath}" target="_blank" class="btn btn-secondary" style="font-size: 0.7rem; padding: 4px 8px; margin-right: 4px; text-decoration: none;" onclick="event.stopPropagation()">📥 PDF ${pdfs.length > 1 ? (i+1) : ''}</a>`;
            }).join('') + `</div>`;
        }

        const visibility = String(m.visibility_status || m.release_status || m.status || 'ready_public').toLowerCase();
        const readinessLabels = {
            active: 'Готово',
            ready_public: 'Готово',
            beta_limited: 'Бета',
            beta: 'Бета',
            hidden_internal: 'Внутреннее',
            internal: 'Внутреннее',
            blocked: 'Заблокировано',
            not_implemented: 'Заблокировано'
        };
        const readinessLabel = readinessLabels[visibility] || 'Готово';
        const readinessColors = {
            'Готово': 'background:#e8f5e9;color:#1b5e20;border-color:#a5d6a7;',
            'Бета': 'background:#fff8e1;color:#7a4f00;border-color:#ffe082;',
            'Внутреннее': 'background:#eceff1;color:#37474f;border-color:#cfd8dc;',
            'Заблокировано': 'background:#ffebee;color:#b71c1c;border-color:#ffcdd2;'
        };
        const formulaCount = Array.isArray(m.formula_codes) ? m.formula_codes.length : 0;
        const governanceNote = m.confidence_note || m.scope_note || '';
        const betaWarning = readinessLabel === 'Бета'
            ? '<p><small style="color:#7a4f00;">Бета-методика: результаты предварительные и требуют проверки.</small></p>'
            : '';

        const card = document.createElement('div');
        card.className = `scenario-card ${state.methodicId === m.id ? 'selected' : ''}`;
        card.innerHTML = `
            <h4 style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">${escapeHTML(uiText(m.name || ''))}<span style="font-size:0.65rem; line-height:1; padding:4px 7px; border:1px solid; border-radius:999px; ${readinessColors[readinessLabel]}">${readinessLabel}</span></h4>
            <p><small>${escapeHTML(uiText(m.name_en || ''))}</small></p>
            ${governanceNote ? `<p><small>${escapeHTML(uiText(governanceNote))}</small></p>` : ''}
            ${betaWarning}
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
                document.getElementById('methodic-badge').textContent = uiText(m.name || '');
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
function renderSourceTypeVisibilityControls() {
    const pane = document.getElementById('pane-2');
    const grid = document.getElementById('source-type-grid');
    if (!pane || !grid) return;

    let controls = document.getElementById('source-type-visibility-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'source-type-visibility-controls';
        controls.style.marginBottom = '12px';
        pane.insertBefore(controls, grid);
    }

    const betaEnabled = !!state.showBetaFormulas;
    controls.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px;">
            <label style="display:flex; align-items:center; gap:8px; margin:0; font-size:0.9rem; color:#0f172a;">
                <input type="checkbox" id="show-beta-formulas-toggle" ${betaEnabled ? 'checked' : ''} />
                Показать бета-формулы
            </label>
            <small style="color:#64748b;">Бета-формулы предварительные и могут измениться.</small>
        </div>
    `;

    const toggle = document.getElementById('show-beta-formulas-toggle');
    if (toggle) {
        toggle.onchange = () => {
            state.showBetaFormulas = !!toggle.checked;
            state.sourceType = null;
            state.calcMethod = null;
            state.formulaCode = null;
            renderSourceTypes();
            renderCalcMethods();
            updateNavigation();
        };
    }
}

function renderSourceTypes() {
    if (!state.methodicData) return;

    renderSourceTypeVisibilityControls();

    const meta = state.methodicData.meta;
    const sourceTypes = Wizard.getSourceTypes(
        meta,
        state.methodicData.flow,
        { mode: state.showBetaFormulas ? 'expert' : 'normal' }
    );
    const grid = document.getElementById('source-type-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!sourceTypes || sourceTypes.length === 0) {
        grid.innerHTML = '<p>Для текущего режима видимости типы источников не найдены.</p>';
        return;
    }

    sourceTypes.forEach(st => {
        const visibility = String(st.visibility_status || st.release_status || 'ready_public').toLowerCase();
        const isBeta = visibility === 'beta' || visibility === 'beta_limited';
        const card = document.createElement('div');
        const formulaList = Array.isArray(st.formula_codes) ? st.formula_codes.join(', ') : (st.formula_codes || '-');
        card.className = `scenario-card ${state.sourceType === st.value ? 'selected' : ''}`;
        card.innerHTML = `
            <h4 style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${escapeHTML(uiText(st.label || st.value || ''))}
                ${isBeta ? '<span style="font-size:0.65rem; line-height:1; padding:4px 7px; border:1px solid #ffe082; border-radius:999px; background:#fff8e1; color:#7a4f00;">Бета</span>' : ''}
            </h4>
            <p><small>Формулы: ${formulaList}</small></p>
            ${isBeta ? '<p><small style="color:#7a4f00;">Предварительная ветка: проверьте перед промышленным применением.</small></p>' : ''}
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

    if (state.calcMethod || state.formulaCode) {
        normalizeCurrentMethodSelection();
    }

    const meta = state.methodicData.meta;
    // B3: Pass data.flow so getCalcMethods can derive methods from formula_codes in new architecture
    const methods = Wizard.getCalcMethods(meta, state.sourceType, state.methodicData.flow);
    const section = document.getElementById('calc-method-section');
    const grid = document.getElementById('calc-method-grid');

    if (!methods || methods.length === 0) {
        // No sub-methods — use _default flow
        if (section) section.style.display = 'none';
        state.calcMethod = '_default';
        state.formulaCode = Wizard.getFormulaCode(
            state.methodicData, state.sourceType, '_default', state.formulaCode
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
                <h4>${escapeHTML(uiText(cm.label || cm.value || ''))}</h4>
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

function normalizeCurrentMethodSelection() {
    if (!state.methodicData || !state.sourceType) return;
    const resolved = Wizard.resolveFlowSelection(
        state.methodicData,
        state.sourceType,
        state.calcMethod,
        state.formulaCode
    );
    if (!resolved) return;
    state.sourceType = resolved.source_type;
    state.calcMethod = resolved.calc_method;
    state.formulaCode = resolved.formula_code;
}

function getCurrentWizardQuestions(includeHidden = true) {
    if (!state.methodicData || !state.sourceType) return [];

    normalizeCurrentMethodSelection();

    let varIds = Wizard.getRequiredVariables(
        state.methodicData, state.sourceType, state.calcMethod, state.formulaCode
    );

    if (varIds.length === 0) {
        const methods = Wizard.getCalcMethods(
            state.methodicData.meta,
            state.sourceType,
            state.methodicData.flow
        );
        if (methods && methods.length > 0) {
            state.calcMethod = methods[0].value;
            state.formulaCode = methods[0].formula_code;
            varIds = Wizard.getRequiredVariables(
                state.methodicData, state.sourceType, state.calcMethod, state.formulaCode
            );
        }
    }

    const questions = Wizard.buildQuestions(state.methodicData, varIds);
    return includeHidden ? questions : questions.filter(q => !q.hidden);
}

function isAutoQuestion(q) {
    return !!(
        q.is_calc || q.lookup_table || q.auto_lookup || q.global_mapping ||
        q.category === 'lookup' || q.category === 'calculated' ||
        q.category === 'derived_input' || q.category === 'meta'
    );
}

function isLookupDrivenQuestion(q) {
    return !!(
        q.lookup_table || q.auto_lookup || q.global_mapping ||
        q.category === 'lookup' || q.category === 'derived_input' || q.category === 'meta'
    );
}

function isManualQuestion(q) {
    return !isAutoQuestion(q);
}

function groupVisibleQuestions(questions) {
    const manualQuestions = questions.filter(isManualQuestion);
    return {
        selectors: sortQuestionsForDisplay(manualQuestions.filter(q =>
            (q.type === 'select' || q.category === 'selector') && q.required !== false
        )),
        requiredInputs: sortQuestionsForDisplay(manualQuestions.filter(q =>
            q.required !== false && q.type !== 'select' && q.category !== 'selector'
        )),
        optionalInputs: sortQuestionsForDisplay(manualQuestions.filter(q => q.required === false))
    };
}

function getQuestionSortScore(q) {
    const key = `${q.variable_id || ''} ${q.token || ''} ${q.label || ''}`.toLowerCase();
    const priorities = [
        ['product', 0],
        ['substance', 1],
        ['climate', 2],
        ['zone', 3],
        ['tank_type', 4],
        ['tank_construction', 5],
        ['construction', 6],
        ['tank_mode', 7],
        ['mode', 8],
        ['ssv', 9],
        ['gor', 10],
        ['temperature', 20],
        ['pressure', 21],
        ['volume', 22],
        ['density', 23],
        ['count', 24],
        ['колич', 24]
    ];

    for (const [marker, score] of priorities) {
        if (key.includes(marker)) return score;
    }
    return 100;
}

function sortQuestionsForDisplay(questions) {
    return [...questions].sort((a, b) => {
        const scoreDelta = getQuestionSortScore(a) - getQuestionSortScore(b);
        if (scoreDelta !== 0) return scoreDelta;
        return uiText(String(a.label || a.variable_id)).localeCompare(
            uiText(String(b.label || b.variable_id)),
            'ru'
        );
    });
}

function runUiAutoLookups(auditTrail = null) {
    Wizard.runAutoLookups(state.methodicData, state.inputs, auditTrail, {
        allowDefaultFallback: false,
        allowDefaultForHidden: true
    });
}

function getSmallIntegerOptions(q) {
    if (!q.integer_only || q.type === 'select') return null;
    if (q.min == null || q.max == null) return null;

    const min = Number(q.min);
    const max = Number(q.max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) return null;
    if ((max - min) > 4) return null;

    const options = [];
    for (let value = min; value <= max; value++) {
        options.push({ value, label: String(value) });
    }
    return options;
}

function getQuestionOptions(q) {
    if (Array.isArray(q.options) && q.options.length > 0) return q.options;
    return getSmallIntegerOptions(q) || [];
}

function isBinaryChoiceOptions(options) {
    if (!Array.isArray(options) || options.length !== 2) return false;
    const normalized = options.map(option => String((option && option.label != null) ? option.label : option.value).toLowerCase().trim());
    const joined = normalized.join('|');
    return (
        joined.includes('да') ||
        joined.includes('нет') ||
        joined.includes('yes') ||
        joined.includes('no') ||
        joined === '0|1' ||
        joined === '1|2'
    );
}

function getControlVariant(q) {
    const options = getQuestionOptions(q);
    if (options.length > 0) {
        if (options.length <= 3 || isBinaryChoiceOptions(options)) return 'segmented';
        if (options.length > 8) return 'search-select';
        return 'select';
    }
    if (q.integer_only || /(^n_|^np$|count|колич)/i.test(`${q.variable_id || ''} ${q.token || ''} ${q.label || ''}`)) {
        return 'stepper';
    }
    return 'number';
}

function normalizeOption(option) {
    if (option && typeof option === 'object') {
        return {
            value: option.value,
            label: option.label != null ? option.label : option.value
        };
    }
    return { value: option, label: option };
}

function findOptionByRawValue(q, rawValue) {
    const raw = String(rawValue ?? '').trim().toLowerCase();
    if (!raw) return null;
    return getQuestionOptions(q)
        .map(normalizeOption)
        .find(option => {
            const valueText = String(option.value ?? '').trim().toLowerCase();
            const labelText = uiText(String(option.label ?? '')).trim().toLowerCase();
            return raw === valueText || raw === labelText;
        }) || null;
}

function clearQuestionValues(questionIds) {
    questionIds.forEach(varId => {
        delete state.inputs[varId];
        delete state.inputs[`${varId}_override`];
        delete state.inputs[`${varId}_trace`];
        delete state.inputs[`${varId}_auto_value`];
        delete state.inputs[`${varId}_auto_meta`];
    });
    runUiAutoLookups();
    state.lastChangeImpact = null;
    renderParameters();
}

function getDisplayValueForQuestion(q) {
    const rawValue = state.inputs[q.variable_id];
    if (rawValue == null || rawValue === '') return '';

    const option = findOptionByRawValue(q, rawValue);
    if (option) return uiText(String(option.label ?? option.value ?? ''));
    return String(rawValue);
}

function coerceOptionValue(q, rawValue) {
    const options = getQuestionOptions(q).map(normalizeOption);
    const rawText = String(rawValue ?? '');
    const matchedByValue = options.find(option => String(option.value ?? '') === rawText);
    if (matchedByValue) return matchedByValue.value;

    const matchedByLabel = findOptionByRawValue(q, rawValue);
    return matchedByLabel ? matchedByLabel.value : rawValue;
}

function renderQuestionControl(q, controlVariant, isReadOnly, unitText) {
    const options = getQuestionOptions(q).map(normalizeOption);
    const currentValue = state.inputs[q.variable_id];
    const currentDisplayValue = escapeHTML(getDisplayValueForQuestion(q));
    const unitSuffix = unitText ? `<span class="param-input-suffix">${escapeHTML(unitText)}</span>` : '';
    const placeholderText = escapeHTML(getControlPlaceholder(q, controlVariant));
    const minAttr = q.min != null ? `min="${escapeHTML(String(q.min))}"` : '';
    const maxAttr = q.max != null ? `max="${escapeHTML(String(q.max))}"` : '';

    if (controlVariant === 'segmented') {
        return `
            <div class="param-segmented" data-role="segmented-group">
                ${options.map(option => `
                    <button type="button"
                        class="param-segmented-btn ${String(currentValue) === String(option.value) ? 'is-active' : ''}"
                        data-role="segmented-option"
                        data-value="${escapeHTML(String(option.value ?? ''))}"
                        ${isReadOnly ? 'disabled' : ''}>
                        ${escapeHTML(uiText(String(option.label ?? option.value ?? '')))}
                    </button>
                `).join('')}
            </div>
        `;
    }

    if (controlVariant === 'search-select') {
        return `
            <div class="param-searchable-select">
                <input type="search"
                    class="cart-input option-search-input"
                    data-role="option-search"
                    list="options-${q.variable_id}"
                    placeholder="${placeholderText}"
                    value="${currentDisplayValue}"
                    ${isReadOnly ? 'disabled' : ''}>
                <datalist id="options-${q.variable_id}">
                    ${options.map(option => `<option value="${escapeHTML(uiText(String(option.label ?? option.value ?? '')))}"></option>`).join('')}
                </datalist>
            </div>
        `;
    }

    if (controlVariant === 'select') {
        return `
            <select class="cart-input" data-role="primary-control" style="width:100%;" ${isReadOnly ? 'disabled' : ''}>
                <option value="">-- Выберите --</option>
                ${options.map(option => {
                    const selected = String(currentValue) === String(option.value) ? 'selected' : '';
                    return `<option value="${escapeHTML(String(option.value ?? ''))}" ${selected}>${escapeHTML(uiText(String(option.label ?? option.value ?? '')))}</option>`;
                }).join('')}
            </select>
        `;
    }

    if (controlVariant === 'stepper') {
        return `
            <div class="param-stepper">
                <button type="button" class="btn btn-secondary param-stepper-btn" data-role="step-down" ${isReadOnly ? 'disabled' : ''}>−</button>
                <div class="param-stepper-input-wrap">
                    <input type="number"
                        step="1"
                        class="cart-input"
                        data-role="primary-control"
                        style="width:100%;"
                        value="${currentValue ?? ''}"
                        ${isReadOnly ? 'disabled' : ''}
                        placeholder="${placeholderText}"
                        ${minAttr}
                        ${maxAttr}>
                    ${unitSuffix}
                </div>
                <button type="button" class="btn btn-secondary param-stepper-btn" data-role="step-up" ${isReadOnly ? 'disabled' : ''}>+</button>
            </div>
        `;
    }

    return `
        <div class="param-number-control">
            <input type="number"
                step="any"
                class="cart-input"
                data-role="primary-control"
                style="width:100%;"
                value="${currentValue ?? ''}"
                ${isReadOnly ? 'disabled' : ''}
                placeholder="${placeholderText}"
                ${minAttr}
                ${maxAttr}>
            ${unitSuffix}
        </div>
    `;
}

function getQuestionById(varId, questions = getCurrentWizardQuestions(true)) {
    return questions.find(q => q.variable_id === varId) || null;
}

function getQuestionLabelById(varId, questions = getCurrentWizardQuestions(true)) {
    const q = getQuestionById(varId, questions);
    return uiText(q ? (q.label || varId) : varId);
}

function formatCompactValue(value) {
    if (value == null || value === '') return '—';
    if (typeof value === 'number' && isFinite(value)) {
        const abs = Math.abs(value);
        const digits = abs >= 1000 ? 2 : (abs >= 1 ? 4 : 6);
        return value.toFixed(digits).replace(/\.?0+$/, '');
    }
    return uiText(String(value));
}

function getControlPlaceholder(q, controlVariant) {
    if (controlVariant === 'search-select') return 'Начните вводить для поиска по списку';
    if (controlVariant === 'select') return '';
    if (controlVariant === 'stepper' || controlVariant === 'number') {
        if (q.default != null && q.default !== '') return `Например: ${formatCompactValue(q.default)}`;
        if (q.min != null && q.max != null) return `${formatCompactValue(q.min)} – ${formatCompactValue(q.max)}`;
        if (q.min != null) return `Минимум: ${formatCompactValue(q.min)}`;
        if (q.max != null) return `Максимум: ${formatCompactValue(q.max)}`;
        return 'Введите значение';
    }
    return '';
}

function escapeSingleQuotedJs(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function createDerivedStateEntry(value, trace) {
    return {
        value,
        status: trace ? (trace.status || (trace.source_type === 'equation' ? 'equation' : trace.source_type) || null) : null,
        tableId: trace && trace.table_id ? trace.table_id : null,
        method: trace && trace.method ? trace.method : null,
        keys: JSON.stringify((trace && trace.keys) ? trace.keys : {}),
        message: trace && trace.message ? trace.message : ''
    };
}

function captureDerivedSnapshot(questions) {
    const snapshot = {};
    questions.forEach(q => {
        if (!isAutoQuestion(q)) return;
        snapshot[q.variable_id] = createDerivedStateEntry(
            state.inputs[q.variable_id],
            state.inputs[`${q.variable_id}_trace`]
        );
    });
    return snapshot;
}

function areDerivedStatesEqual(before, after) {
    const left = before || {};
    const right = after || {};
    return (
        left.value === right.value &&
        left.status === right.status &&
        left.tableId === right.tableId &&
        left.method === right.method &&
        left.keys === right.keys &&
        left.message === right.message
    );
}

function formatDerivedStateSummary(entry) {
    if (!entry) return '—';
    if (entry.status === 'waiting_inputs') return 'ожидает ввод';
    if (entry.status === 'no_match') return 'нет строки';
    if (entry.value != null && entry.value !== '') return formatCompactValue(entry.value);
    if (entry.status === 'equation') return 'расчет';
    return '—';
}

function buildLastChangeImpact(sourceVarId, beforeSnapshot, questions) {
    const changes = [];

    questions.forEach(q => {
        if (!isAutoQuestion(q) || q.variable_id === sourceVarId) return;

        const before = beforeSnapshot[q.variable_id] || createDerivedStateEntry(undefined, null);
        const after = createDerivedStateEntry(
            state.inputs[q.variable_id],
            state.inputs[`${q.variable_id}_trace`]
        );

        if (!areDerivedStatesEqual(before, after)) {
            changes.push({
                targetVar: q.variable_id,
                label: uiText(q.label || q.variable_id),
                beforeText: formatDerivedStateSummary(before),
                afterText: formatDerivedStateSummary(after)
            });
        }
    });

    if (changes.length === 0) return null;

    return {
        sourceVarId,
        sourceLabel: getQuestionLabelById(sourceVarId, questions),
        totalChanges: changes.length,
        changes: changes.slice(0, 4)
    };
}

function appendQuestionSection(container, title, subtitle, questions, options = {}) {
    if (!questions || questions.length === 0) return;

    const section = document.createElement('section');
    section.className = 'param-section';
    section.innerHTML = `
        <div class="param-section-header">
            <div>
                <h3>${escapeHTML(title)}</h3>
                ${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ''}
            </div>
            <div class="param-section-actions">
                ${options.resettable ? `<button type="button" class="btn btn-secondary param-section-reset">Очистить раздел</button>` : ''}
                <span class="param-section-count">${questions.length}</span>
            </div>
        </div>
        <div class="param-section-grid"></div>
    `;

    const grid = section.querySelector('.param-section-grid');
    questions.forEach(q => {
        grid.appendChild(renderParamCard(q));
    });

    const resetBtn = section.querySelector('.param-section-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearQuestionValues(questions.map(q => q.variable_id));
        });
    }

    container.appendChild(section);
}

// ========================================================================
// STEP 3: PARAMETERS
// ========================================================================
function renderParameters() {
    if (!state.methodicData || !state.sourceType) return;
    const allQuestions = getCurrentWizardQuestions(true);
    if (allQuestions.length === 0) return;

    const visibleQuestions = allQuestions.filter(q => !q.hidden);
    const groupedQuestions = groupVisibleQuestions(visibleQuestions);

    if (state.lastChangeImpact && !allQuestions.some(q => q.variable_id === state.lastChangeImpact.sourceVarId)) {
        state.lastChangeImpact = null;
    }

    // Global Mapping sync removed for Clean UI (user selected manually)

    // Run auto-lookups first to establish initial state
    runUiAutoLookups();

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
    const manualCount = visibleQuestions.filter(isManualQuestion).length;
    const lookupCount = allQuestions.filter(q =>
        isAutoQuestion(q) && !state.inputs[`${q.variable_id}_override`]
    ).length;

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

    // 2. Lookup Health
    const healthPanel = document.createElement('div');
    healthPanel.className = 'lookup-health-panel';
    healthPanel.setAttribute('id', 'lookup-health-panel');
    healthPanel.innerHTML = buildLookupHealthPanelHTML(allQuestions);
    mainCol.appendChild(healthPanel);

    // 3. Ordered Manual Input Sections
    appendQuestionSection(
        mainCol,
        'Определяющие параметры',
        'Сначала выберите параметры, которые управляют подбором справочных коэффициентов.',
        groupedQuestions.selectors,
        { resettable: true }
    );
    appendQuestionSection(
        mainCol,
        'Основные исходные данные',
        'Обязательные значения, без которых расчет не завершится.',
        groupedQuestions.requiredInputs,
        { resettable: true }
    );
    if (groupedQuestions.optionalInputs.length > 0) {
        appendQuestionSection(
            mainCol,
            'Дополнительные данные',
            'Необязательные поля и уточнения, которые можно заполнить позже.',
            groupedQuestions.optionalInputs,
            { resettable: true }
        );
    }

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
    const formulaCode = state.formulaCode || Wizard.getFormulaCode(
        state.methodicData, state.sourceType, state.calcMethod, state.formulaCode
    );
    const eqInfo = Wizard.getEquationInfo(state.methodicData, formulaCode);
    
    const sourceTypeDef = state.methodicData.meta.source_types.find(st => st.value === state.sourceType);
    const branchLabel = uiText(sourceTypeDef ? sourceTypeDef.label : (eqInfo[0]?.formula_name || ''));
    
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
    // B2: Include category='lookup' and category='calculated' in the sidebar auto panel.
    const lookupQuestions = allQuestions.filter(isLookupDrivenQuestion);
    if (lookupQuestions.length > 0) {
        const autoPanel = document.createElement('div');
        autoPanel.className = 'sidebar-panel';
        autoPanel.innerHTML = `
            <div class="sidebar-panel-header">📚 Справочные коэффициенты</div>
            <div class="sidebar-panel-body" style="padding:0;">
                <div id="auto-vars-container"></div>
            </div>
        `;
        sidebar.appendChild(autoPanel);
        const autoContainer = autoPanel.querySelector('#auto-vars-container');
        lookupQuestions.forEach(q => {
            autoContainer.appendChild(renderParamCard(q, true));
        });
    }

    const calcQuestions = allQuestions.filter(q => q.is_calc || q.category === 'calculated');
    if (calcQuestions.length > 0) {
        const calcPanel = document.createElement('div');
        calcPanel.className = 'sidebar-panel';
        calcPanel.innerHTML = `
            <div class="sidebar-panel-header">🧮 Расчетные значения</div>
            <div class="sidebar-panel-body" style="padding:0;">
                <div id="calc-vars-container"></div>
            </div>
        `;
        sidebar.appendChild(calcPanel);
        const calcContainer = calcPanel.querySelector('#calc-vars-container');
        calcQuestions.forEach(q => {
            if (lookupQuestions.some(item => item.variable_id === q.variable_id)) return;
            calcContainer.appendChild(renderParamCard(q, true));
        });
    }

    const overriddenQuestions = allQuestions.filter(q => state.inputs[`${q.variable_id}_override`]);
    if (overriddenQuestions.length > 0) {
        const overridePanel = document.createElement('div');
        overridePanel.className = 'sidebar-panel';
        overridePanel.innerHTML = `
            <div class="sidebar-panel-header">✍️ Ручные переопределения</div>
            <div class="sidebar-panel-body" style="padding:0;">
                <div id="override-vars-container"></div>
            </div>
        `;
        sidebar.appendChild(overridePanel);
        const overrideContainer = overridePanel.querySelector('#override-vars-container');
        overriddenQuestions.forEach(q => {
            overrideContainer.appendChild(renderParamCard(q, true));
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

    syncRenderedQuestionState(visibleQuestions);
    updateLookupValuesUI(allQuestions);
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
    const tableId = q.lookup_table || (q.auto_lookup ? q.auto_lookup.table : null);
    const isReadOnly = q.is_calc || ((q.auto_lookup || q.lookup_table || q.global_mapping) && !state.inputs[`${q.variable_id}_override`]);
    const labelText = escapeHTML(uiText(String(q.label || q.variable_id || '')));
    const unitText = q.unit ? escapeHTML(uiText(String(q.unit))) : '';
    const helpText = q.help_text ? escapeHTML(uiText(String(q.help_text))) : '';
    const sourceSummary = getSourceSummary(q) || '';
    const controlVariant = getControlVariant(q);
    const controlHtml = renderQuestionControl(q, controlVariant, isReadOnly, unitText);

    card.innerHTML = `
        <div class="param-card-header">
            <div class="param-label">${labelText}</div>
            <div class="status-badge ${status.class}" data-role="status-badge">${status.label}</div>
        </div>

        <div class="param-meta-row">
            ${q.unit ? `<span class="chip chip-unit">${unitText}</span>` : ''}
            <span class="chip chip-token">${q.token || q.variable_id}</span>
            ${q.latex ? `<span class="chip chip-latex">${renderLatex(q.latex)}</span>` : ''}
            ${controlVariant === 'search-select' ? `<span class="chip chip-search">Поиск</span>` : ''}
            ${controlVariant === 'segmented' ? `<span class="chip chip-choice">Выбор</span>` : ''}
            ${controlVariant === 'stepper' ? `<span class="chip chip-stepper">Шаговый ввод</span>` : ''}
        </div>

        ${q.help_text ? `<div class="param-help" style="margin-bottom: 12px; font-style: normal; color: #4b5563; line-height: 1.5;">${helpText}</div>` : ''}

        ${(q.why_needed || q.where_to_find || q.example_value != null) ? `
            <details class="param-disclosure" style="margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; transition: all 0.2s ease;">
                <summary style="font-size: 0.78rem; color: var(--primary); cursor: pointer; user-select: none; font-weight: 600; padding: 10px 14px; background: #f1f5f9; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1rem;">ℹ️</span> Помощь в заполнении
                </summary>
                <div style="padding: 12px 14px; font-size: 0.85rem; color: #334155; line-height: 1.5; border-top: 1px solid #e2e8f0;">
                    ${q.why_needed ? `<div style="margin-bottom: 10px; display: flex; gap: 8px;"><span style="color: #64748b; font-weight: 600; min-width: 90px;">Зачем:</span> <span>${escapeHTML(uiText(q.why_needed))}</span></div>` : ''}
                    ${q.where_to_find ? `<div style="margin-bottom: 10px; display: flex; gap: 8px;"><span style="color: #64748b; font-weight: 600; min-width: 90px;">Где искать:</span> <span>${escapeHTML(uiText(q.where_to_find))}</span></div>` : ''}
                    ${q.example_value != null ? `<div style="display: flex; gap: 8px;"><span style="color: #64748b; font-weight: 600; min-width: 90px;">Пример:</span> <code style="background: #ffffff; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; color: #0f172a; font-weight: 600;">${escapeHTML(String(q.example_value))}</code></div>` : ''}
                </div>
            </details>
        ` : ''}

        <div class="param-control-row">
            <div class="param-input-wrapper">
                ${controlHtml}
            </div>
            ${tableId ? `
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-secondary" style="padding:8px 10px;" onclick="openHandbookModal('${tableId}')" title="Открыть данные справочника">📖</button>
                    <button class="btn btn-secondary" style="padding:8px 10px;" onclick="openHandbookModal('${tableId}', true)" title="Посмотреть изображение таблицы">🖼️</button>
                </div>
            ` : ''}
            ${(q.auto_lookup || q.lookup_table || q.global_mapping) ? 
                `<button class="btn btn-secondary override-toggle" style="padding:8px 12px;" title="${state.inputs[`${q.variable_id}_override`] ? 'Вернуть авто-значение' : 'Изменить вручную'}">
                    ${state.inputs[`${q.variable_id}_override`] ? '🔒' : '🔓'}
                </button>` : ''
            }
        </div>

        <div class="param-card-footer" id="footer-${q.variable_id}" data-role="footer">
            ${sourceSummary}
        </div>

        <div class="validation-message" id="msg-${q.variable_id}"></div>
    `;

    const primaryControl = card.querySelector('[data-role="primary-control"], .option-search-input');

    const commitQuestionValue = (rawValue) => {
        const allQuestions = getCurrentWizardQuestions(true);
        const visibleQuestions = allQuestions.filter(item => !item.hidden);
        const beforeSnapshot = captureDerivedSnapshot(allQuestions);
        let val = rawValue;

        if (controlVariant === 'search-select') {
            const matchedOption = findOptionByRawValue(q, rawValue);
            val = matchedOption ? matchedOption.value : '';
        } else if (getQuestionOptions(q).length > 0) {
            val = coerceOptionValue(q, rawValue);
        } else {
            val = parseFloat(rawValue);
        }

        if (getQuestionOptions(q).length === 0 && (val == null || Number.isNaN(val))) {
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
        runUiAutoLookups();
        state.lastChangeImpact = buildLastChangeImpact(q.variable_id, beforeSnapshot, allQuestions);
        syncRenderedQuestionState(visibleQuestions);
        updateLookupValuesUI(allQuestions);
        validateStep3();
        updateLivePreview();
    };

    if (primaryControl) {
        primaryControl.addEventListener('input', (e) => {
            if (controlVariant === 'select' || controlVariant === 'search-select') return;
            commitQuestionValue(e.target.value);
        });

        primaryControl.addEventListener('change', (e) => {
            commitQuestionValue(e.target.value);
            renderParameters();
        });
    }

    if (controlVariant === 'segmented') {
        card.querySelectorAll('[data-role="segmented-option"]').forEach(btn => {
            btn.addEventListener('click', () => {
                commitQuestionValue(btn.getAttribute('data-value'));
                renderParameters();
            });
        });
    }

    if (controlVariant === 'stepper') {
        const numberInput = card.querySelector('[data-role="primary-control"]');
        const step = 1;
        const min = q.min != null ? Number(q.min) : null;
        const max = q.max != null ? Number(q.max) : null;
        const applyStep = (direction) => {
            const currentValue = numberInput.value === '' ? (q.default ?? min ?? 0) : Number(numberInput.value);
            let nextValue = Number(currentValue) + (direction * step);
            if (min != null) nextValue = Math.max(min, nextValue);
            if (max != null) nextValue = Math.min(max, nextValue);
            numberInput.value = nextValue;
            commitQuestionValue(String(nextValue));
            renderParameters();
        };
        const stepUpBtn = card.querySelector('[data-role="step-up"]');
        const stepDownBtn = card.querySelector('[data-role="step-down"]');
        if (stepUpBtn) stepUpBtn.addEventListener('click', () => applyStep(1));
        if (stepDownBtn) stepDownBtn.addEventListener('click', () => applyStep(-1));
    }

    if (controlVariant === 'search-select') {
        const searchInput = card.querySelector('.option-search-input');
        if (searchInput) {
            searchInput.setAttribute('list', `options-${q.variable_id}`);
            searchInput.setAttribute('placeholder', getControlPlaceholder(q, controlVariant));
        }
    }

    const overrideBtn = card.querySelector('.override-toggle');
    if (overrideBtn) {
        overrideBtn.onclick = () => {
            const allQuestions = getCurrentWizardQuestions(true);
            const beforeSnapshot = captureDerivedSnapshot(allQuestions);
            if (state.inputs[`${q.variable_id}_override`]) {
                delete state.inputs[`${q.variable_id}_override`];
                // When unlocking, we might want to clear the manual value so auto-lookup takes over
                delete state.inputs[q.variable_id];
            } else {
                state.inputs[`${q.variable_id}_override`] = true;
            }
            runUiAutoLookups();
            state.lastChangeImpact = buildLastChangeImpact(q.variable_id, beforeSnapshot, allQuestions);
            renderParameters();
        };
    }

    return card;
}


function getStatus(q) {
    const trace = state.inputs[`${q.variable_id}_trace`];
    if (state.inputs[`${q.variable_id}_override`]) return { label: '\u0412\u0440\u0443\u0447\u043d\u0443\u044e', class: 'badge-manual' };
    if (q.is_calc) return { label: '\u0420\u0430\u0441\u0447\u0435\u0442', class: 'badge-calc' };
    if (q.auto_lookup || q.lookup_table) {
        if (trace && trace.status === 'no_match') return { label: '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445', class: 'badge-wait' };
        return state.inputs[q.variable_id] != null
            ? { label: '\u0421\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a', class: 'badge-lookup' }
            : { label: '\u041e\u0436\u0438\u0434\u0430\u0435\u0442', class: 'badge-wait' };
    }
    if (q.global_mapping) return { label: '\u0418\u0437 \u0440\u0435\u0433\u0438\u043e\u043d\u0430', class: 'badge-region' };
    return { label: '\u0412\u0432\u043e\u0434', class: 'badge-input' };
}

function buildTraceKeyChips(keys) {
    const entries = Object.entries(keys || {});
    if (entries.length === 0) return '';

    return `
        <div class="param-chip-row">
            ${entries.map(([key, value]) => `
                <span class="param-mini-chip">${escapeHTML(uiText(String(key)))}=${escapeHTML(formatCompactValue(value))}</span>
            `).join('')}
        </div>
    `;
}

function getBoundaryHintHtml(q) {
    if (q.type === 'select' || (q.min == null && q.max == null)) return '';

    let text = '';
    if (q.min != null && q.max != null) {
        text = `Диапазон: ${formatCompactValue(q.min)} – ${formatCompactValue(q.max)}`;
    } else if (q.min != null) {
        text = `Минимум: ${formatCompactValue(q.min)}`;
    } else if (q.max != null) {
        text = `Максимум: ${formatCompactValue(q.max)}`;
    }

    return `<div class="param-note-line subtle">${escapeHTML(text)}</div>`;
}

function getImpactNoteHtml(q) {
    const impact = state.lastChangeImpact;
    if (!impact) return '';

    if (impact.sourceVarId === q.variable_id) {
        return `
            <div class="param-impact-box">
                <div class="param-impact-title">После изменения этого поля обновились ${impact.totalChanges} автозначения.</div>
                <ul class="param-impact-list">
                    ${impact.changes.map(change => `
                        <li>
                            <span>${escapeHTML(uiText(change.label || change.targetVar))}</span>
                            <strong>${escapeHTML(change.beforeText)} → ${escapeHTML(change.afterText)}</strong>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    const currentChange = impact.changes.find(change => change.targetVar === q.variable_id);
    if (!currentChange) return '';

    return `
        <div class="param-note-line impact">
            Обновлено после изменения поля «${escapeHTML(uiText(impact.sourceLabel || impact.sourceVarId))}»:
            ${escapeHTML(currentChange.beforeText)} → ${escapeHTML(currentChange.afterText)}
        </div>
    `;
}

function getSourceSummary(q) {
    const trace = state.inputs[`${q.variable_id}_trace`];
    const autoMeta = state.inputs[`${q.variable_id}_auto_meta`] || trace;
    const autoValue = state.inputs[`${q.variable_id}_auto_value`];
    const blocks = [];

    if (state.inputs[`${q.variable_id}_override`]) {
        const manualText = autoMeta && autoMeta.source_type === 'lookup'
            ? `Ручное значение. Автоподстановка из таблицы ${uiText(String(autoMeta.table_id || '—'))} временно отключена.`
            : 'Значение задано пользователем вручную.';
        blocks.push(`<div class="param-note-line">${escapeHTML(manualText)}</div>`);
        if (autoMeta && autoMeta.source_type === 'lookup') {
            if (autoValue != null && autoValue !== '') {
                blocks.push(`
                    <div class="param-note-line subtle">
                        Официальное авто-значение сейчас:
                        <strong>${escapeHTML(formatCompactValue(autoValue))}</strong>
                    </div>
                `);
            } else if (autoMeta.status === 'no_match') {
                blocks.push(`<div class="param-note-line warning">${escapeHTML(uiText(autoMeta.message || 'По текущим параметрам справочник не находит строку.'))}</div>`);
            } else if (autoMeta.status === 'waiting_inputs') {
                blocks.push(`<div class="param-note-line subtle">${escapeHTML(uiText(autoMeta.message || 'Автоподстановка ждет зависимые поля.'))}</div>`);
            }
            blocks.push(buildTraceKeyChips(autoMeta.keys));
        }
    } else if (q.is_calc) {
        const formulaText = trace && trace.formula_code
            ? `Формула ${uiText(String(trace.formula_code))} рассчитывает поле автоматически.`
            : 'Значение вычисляется автоматически по формуле.';
        blocks.push(`<div class="param-note-line">${escapeHTML(formulaText)}</div>`);
    } else if (trace && trace.source_type === 'lookup') {
        if (trace.status === 'waiting_inputs') {
            blocks.push(`<div class="param-note-line pending">${escapeHTML(uiText(trace.message || 'Ожидает зависимые поля.'))}</div>`);
            blocks.push(buildTraceKeyChips(trace.keys));
        } else if (trace.status === 'no_match') {
            blocks.push(`<div class="param-note-line error">${escapeHTML(uiText(trace.message || 'Нет строки в справочнике.'))}</div>`);
            blocks.push(buildTraceKeyChips(trace.keys));
        } else {
            const tableId = uiText(String(trace.table_id || '—'));
            blocks.push(`
                <div class="param-source-line">
                    <span class="param-source-title">Справочник:</span>
                    <code>${escapeHTML(tableId)}</code>
                    <a href="#" onclick="openHandbookModal('${escapeSingleQuotedJs(trace.table_id || '')}'); return false;">Открыть</a>
                </div>
            `);
            blocks.push(buildTraceKeyChips(trace.keys));
            if (trace.method === 'clamped') {
                blocks.push('<div class="param-note-line warning">Значение ограничено границей таблицы.</div>');
            }
        }
    } else if (q.global_mapping && state.inputs[q.variable_id] != null) {
        blocks.push('<div class="param-note-line">Значение унаследовано из региональных настроек проекта.</div>');
    } else if (q.auto_lookup || q.lookup_table) {
        blocks.push('<div class="param-note-line pending">Ожидает заполнения зависимых полей для поиска в справочнике.</div>');
    } else if (state.inputs[q.variable_id] != null && state.inputs[q.variable_id] !== '') {
        blocks.push('<div class="param-note-line">Значение введено пользователем.</div>');
    } else {
        blocks.push('<div class="param-note-line">Требуется ввод данных.</div>');
    }

    const boundaryHint = getBoundaryHintHtml(q);
    if (boundaryHint) blocks.push(boundaryHint);

    const impactNote = getImpactNoteHtml(q);
    if (impactNote) blocks.push(impactNote);

    return blocks.filter(Boolean).join('');
}

function updateRenderedQuestionCard(q) {
    const card = document.querySelector(`.param-card[data-var-id="${q.variable_id}"]`);
    if (!card) return;
    const controlVariant = getControlVariant(q);

    const statusBadge = card.querySelector('[data-role="status-badge"]');
    if (statusBadge) {
        const status = getStatus(q);
        statusBadge.className = `status-badge ${status.class}`;
        statusBadge.textContent = status.label;
    }

    const footer = card.querySelector('[data-role="footer"]');
    if (footer) {
        footer.innerHTML = getSourceSummary(q) || '';
    }

    if (controlVariant === 'segmented') {
        card.querySelectorAll('[data-role="segmented-option"]').forEach(btn => {
            btn.classList.toggle('is-active', String(btn.getAttribute('data-value')) === String(state.inputs[q.variable_id] ?? ''));
        });
        return;
    }

    const input = card.querySelector('[data-role="primary-control"], .option-search-input');
    if (!input || input === document.activeElement) return;

    const nextValue = state.inputs[q.variable_id] ?? '';
    if (controlVariant === 'search-select') {
        input.value = getDisplayValueForQuestion(q);
        return;
    }

    if (input.tagName === 'SELECT') {
        input.value = nextValue === '' ? '' : String(nextValue);
    } else if (input.disabled || controlVariant === 'stepper') {
        input.value = nextValue;
    }
}

function syncRenderedQuestionState(questions) {
    questions.forEach(q => updateRenderedQuestionCard(q));
}

function focusParamCard(varId) {
    const card = document.querySelector(`.param-card[data-var-id="${varId}"]`);
    if (!card) return;

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('param-card-focus');
    setTimeout(() => card.classList.remove('param-card-focus'), 1400);

    const input = card.querySelector('.cart-input:not([disabled]), .param-segmented-btn:not([disabled])');
    if (input) input.focus();
}

window.focusParamCard = focusParamCard;

function collectLookupHealth(questions) {
    const trackedQuestions = questions.filter(isLookupDrivenQuestion);
    const health = {
        total: trackedQuestions.length,
        resolved: 0,
        waiting: [],
        missing: [],
        clamped: [],
        overrides: []
    };

    trackedQuestions.forEach(q => {
        const trace = state.inputs[`${q.variable_id}_trace`];
        const issueBase = {
            varId: q.variable_id,
            label: uiText(q.label || q.variable_id),
            visible: !q.hidden || isAutoQuestion(q)
        };

        if (state.inputs[`${q.variable_id}_override`]) {
            health.overrides.push({
                ...issueBase,
                message: 'Значение зафиксировано вручную и больше не обновляется автоматически.'
            });
            return;
        }

        if (trace && trace.status === 'no_match') {
            health.missing.push({
                ...issueBase,
                message: uiText(trace.message || 'Нет строки в справочнике.')
            });
            return;
        }

        if (trace && trace.status === 'waiting_inputs') {
            health.waiting.push({
                ...issueBase,
                message: uiText(trace.message || 'Ожидает зависимые поля.')
            });
            return;
        }

        if (trace && trace.method === 'clamped') {
            health.clamped.push({
                ...issueBase,
                message: 'Значение ограничено диапазоном таблицы.'
            });
        }

        if (state.inputs[q.variable_id] != null) {
            health.resolved++;
        }
    });

    return health;
}

function buildLookupHealthPanelHTML(questions) {
    const health = collectLookupHealth(questions);
    const issues = [
        ...health.missing.map(item => ({ ...item, kind: 'Нет строки', className: 'error' })),
        ...health.waiting.map(item => ({ ...item, kind: 'Ждет ввод', className: 'pending' })),
        ...health.clamped.map(item => ({ ...item, kind: 'Граница', className: 'warning' })),
        ...health.overrides.map(item => ({ ...item, kind: 'Ручной режим', className: 'info' }))
    ];

    const chips = `
        <div class="lookup-health-chips">
            <span class="lookup-health-chip success">Готово: ${health.resolved}/${health.total}</span>
            <span class="lookup-health-chip pending">Ждет: ${health.waiting.length}</span>
            <span class="lookup-health-chip error">Нет строки: ${health.missing.length}</span>
            <span class="lookup-health-chip warning">Границы: ${health.clamped.length}</span>
            <span class="lookup-health-chip info">Ручной режим: ${health.overrides.length}</span>
        </div>
    `;

    const issueHtml = issues.length === 0
        ? '<div class="lookup-health-empty">Все связанные справочники сейчас определены автоматически.</div>'
        : `
            <div class="lookup-health-list">
                ${issues.slice(0, 6).map(item => `
                    <div class="lookup-health-item ${item.className}">
                        <div class="lookup-health-item-head">
                            <strong>${escapeHTML(item.label)}</strong>
                            <span>${escapeHTML(item.kind)}</span>
                        </div>
                        <div class="lookup-health-item-body">${escapeHTML(item.message)}</div>
                        <div class="lookup-health-item-foot">
                            ${item.visible
                                ? `<a href="#" onclick="focusParamCard('${escapeSingleQuotedJs(item.varId)}'); return false;">Показать поле</a>`
                                : '<span>Скрытое служебное поле</span>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

    return `
        <div class="lookup-health-header">
            <div>
                <h3>Связи и справочники</h3>
                <p>Здесь видно, какие автозначения уже подобраны, чего не хватает и где включено ручное переопределение.</p>
            </div>
        </div>
        ${chips}
        ${issueHtml}
    `;
}

function renderLookupHealthPanel(questions = getCurrentWizardQuestions(true)) {
    const panel = document.getElementById('lookup-health-panel');
    if (!panel) return;
    panel.innerHTML = buildLookupHealthPanelHTML(questions);
}

function buildValidationSummaryGroup(title, items, className) {
    if (!items || items.length === 0) return '';

    return `
        <div class="param-summary-group ${className}">
            <div class="param-summary-group-title">${escapeHTML(title)}: ${items.length}</div>
            <div class="param-summary-group-list">
                ${items.slice(0, 3).map(item => `
                    <a href="#"
                        class="param-summary-link"
                        onclick="focusParamCard('${escapeSingleQuotedJs(item.varId)}'); return false;">
                        <strong>${escapeHTML(item.label)}</strong>
                        ${item.message ? `<span>${escapeHTML(item.message)}</span>` : ''}
                    </a>
                `).join('')}
                ${items.length > 3 ? `<div class="param-summary-more">Еще ${items.length - 3}</div>` : ''}
            </div>
        </div>
    `;
}

function buildValidationSummaryHTML({ errors, pending, warnings }) {
    const totalIssues = errors.length + pending.length + warnings.length;
    if (totalIssues === 0) {
        return `
            <div class="param-summary-group success">
                <div class="param-summary-group-title">Готово</div>
                <div class="param-summary-group-list">
                    <span class="param-summary-link is-static">Все данные заполнены корректно. Можно переходить к расчету.</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="param-summary-grid">
            ${buildValidationSummaryGroup('Блокирующие ошибки', errors, 'error')}
            ${buildValidationSummaryGroup('Нужно заполнить', pending, 'pending')}
            ${buildValidationSummaryGroup('Предупреждения', warnings, 'warning')}
        </div>
    `;
}

function updateLivePreview() {
    normalizeCurrentMethodSelection();
    if (!state.methodicData || !state.formulaCode) return;
    
    // Sync current DOM values to state.inputs to avoid "Undefined symbol" errors
    collectAllInputs();

    // Evaluate silently
    try {
        const result = Evaluator.evaluateFormulaCode(
            state.methodicData.equations.active_equations,
            state.formulaCode,
            state.inputs,
            { silent: true },
            state.methodicData
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
    const allQuestions = getCurrentWizardQuestions(true);
    const questions = allQuestions.filter(q => !q.hidden || isAutoQuestion(q));
    
    let errorCount = 0;
    let warningCount = 0;
    let pendingCount = 0;
    let totalRequired = 0;
    const errorItems = [];
    const warningItems = [];
    const pendingItems = [];

    // 1. Individual Field Validation
    questions.forEach(q => {
        const val = state.inputs[q.variable_id];
        let res = Validation.validateField(q, val);
        const card = document.querySelector(`.param-card[data-var-id="${q.variable_id}"]`);
        const input = card?.querySelector('.cart-input');
        const msgEl = document.getElementById(`msg-${q.variable_id}`);
        const trace = state.inputs[`${q.variable_id}_trace`];

        if ((q.auto_lookup || q.lookup_table) && val == null && trace) {
            if (trace.status === 'no_match') {
                res = { state: Validation.STATES.INVALID, message: trace.message || 'Нет строки в справочнике.' };
            } else if (trace.status === 'waiting_inputs') {
                res = { state: Validation.STATES.PENDING, message: trace.message || 'Ожидает зависимые поля.' };
            }
        }

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
            errorItems.push({
                varId: q.variable_id,
                label: uiText(q.label || q.variable_id),
                message: uiText(res.message || 'Проверьте значение поля.')
            });
            card?.classList.add('is-invalid');
            input?.classList.add('is-invalid');
            if (msgEl) {
                msgEl.classList.add('is-invalid');
                msgEl.textContent = res.message;
            }
        } else if (res.state === Validation.STATES.WARNING) {
            warningCount++;
            warningItems.push({
                varId: q.variable_id,
                label: uiText(q.label || q.variable_id),
                message: uiText(res.message || 'Поле требует внимания.')
            });
            card?.classList.add('is-warning');
            input?.classList.add('is-warning');
            if (msgEl) {
                msgEl.classList.add('is-warning');
                msgEl.textContent = res.message;
            }
        } else if (res.state === Validation.STATES.PENDING) {
            pendingCount++;
            pendingItems.push({
                varId: q.variable_id,
                label: uiText(q.label || q.variable_id),
                message: uiText(res.message || 'Нужно заполнить поле.')
            });
            card?.classList.add('is-pending');
        } else if (res.state === Validation.STATES.VALID && val != null) {
            card?.classList.add('is-valid');
            input?.classList.add('is-valid');
        }

        // Add Lookup Clamping Warnings
        if (trace && trace.method === 'clamped') {
            warningCount++;
            warningItems.push({
                varId: q.variable_id,
                label: uiText(q.label || q.variable_id),
                message: 'Значение ограничено границей таблицы'
            });
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
        errorItems.push({
            varId: res.varId,
            label: getQuestionLabelById(res.varId, questions),
            message: uiText(res.message || 'Проверьте связанную комбинацию полей.')
        });
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
        summary.innerHTML = buildValidationSummaryHTML({
            errors: errorItems,
            pending: pendingItems,
            warnings: warningItems
        });
    }

    // Update global state for next-button blocking
    state.isStep3Valid = (errorCount === 0 && pendingCount === 0);
    updateNavigation();
}

function updateLookupValuesUI(questions = getCurrentWizardQuestions(true)) {
    renderLookupHealthPanel(questions);
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
            if (varDef) varLabel = uiText(varDef.label || varId);
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
                keyInfo = Object.entries(val.keys || {}).map(([k,v]) => `${k}=${uiText(String(v ?? ''))}`).join(', ');
                resultVal = val.result ? Object.values(val.result)[0] : '—';
                paramMethod = val.method || val.source_type || '—';
            }
            if (typeof resultVal === 'number') resultVal = resultVal.toFixed(6);
        }
        if (typeof resultVal === 'string') resultVal = uiText(resultVal);

        const previewHTML = buildTablePreviewHTML(tableName, keyInfo);

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f3f4f6';
        tr.innerHTML = `
            <td style="padding:12px; vertical-align:top;">
                <div style="font-weight:700; color:#1f2937;">${escapeHTML(uiText(String(varLabel || '')))}</div>
                <div style="font-size:0.7rem; color:#9ca3af;">${varId}</div>
            </td>
            <td style="padding:12px; vertical-align:top;">
                <div class="table-preview-wrapper" style="position:relative; display:inline-block;">
                    <code style="background:#f3f4f6; padding:2px 4px; border-radius:4px; font-size:0.75rem;">${escapeHTML(uiText(String(tableName || '')))}</code>
                    ${previewHTML ? `<div class="table-preview-tooltip">${previewHTML}</div>` : ''}
                </div>
                <div style="font-size:0.7rem; color:#6b7280; margin-top:4px;">${escapeHTML(uiText(String(keyInfo || '')))}</div>
            </td>
            <td style="padding:12px; vertical-align:top; text-align:right;">
                <div style="font-weight:800; color:#065f46;">${escapeHTML(uiText(String(resultVal ?? '')))}</div>
                <div style="font-size:0.7rem; color:#9ca3af;">${escapeHTML(uiText(String(paramMethod || '')))}</div>
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
    normalizeCurrentMethodSelection();
    const varIds = Wizard.getRequiredVariables(
        state.methodicData, state.sourceType, state.calcMethod, state.formulaCode
    );
    const questions = getCurrentWizardQuestions(true);
    const questionsById = new Map(questions.map(q => [q.variable_id, q]));
    varIds.forEach(varId => {
        const q = questionsById.get(varId);
        if (!q) return;
        const card = document.querySelector(`.param-card[data-var-id="${varId}"]`);
        if (!card) return;
        const controlVariant = getControlVariant(q);
        if (controlVariant === 'segmented') return;

        const el = card.querySelector('[data-role="primary-control"], .option-search-input');
        if (!el) return;
        
        let val = null;
        if (controlVariant === 'search-select') {
            const matchedOption = findOptionByRawValue(q, el.value);
            val = matchedOption ? matchedOption.value : null;
        } else if (el.tagName === 'SELECT' || getQuestionOptions(q).length > 0) {
            val = el.value === '' ? null : coerceOptionValue(q, el.value);
        } else {
            val = parseFloat(el.value);
            if (isNaN(val)) val = null;
        }
        
        if (val !== null && val !== "") {
            state.inputs[varId] = val;
        } else if (!state.inputs[`${varId}_override`] && !isAutoQuestion(q)) {
            delete state.inputs[varId];
        }
    });
}



function runCalculationsAndRenderResults() {
    normalizeCurrentMethodSelection();
    if (!state.methodicData || !state.formulaCode) return;

    // Collect all current input values from the DOM
    collectAllInputs();

    const auditTrail = { lookups: [], equations: [], conversions: [] };

    // Run auto-lookups to populate coefficients from tables
    runUiAutoLookups(auditTrail);

    // Run the data-driven equation evaluator
    const result = Evaluator.evaluateFormulaCode(
        state.methodicData.equations.active_equations,
        state.formulaCode,
        state.inputs,
        { auditTrail },
        state.methodicData
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
            <td><strong>${escapeHTML(uiText(String(label || '')))}</strong></td>
            <td${highlight ? ` style="color:var(--primary);font-weight:700;"` : ''}>${value}</td>
        `;
        tbodySummary.appendChild(tr);
    };

    addRow('Методика', escapeHTML(uiText(state.methodicData.meta.name || state.methodicData.meta.name_en || '')));
    
    // Find Russian labels for source type and calc method
    const meta = state.methodicData?.meta || {};
    const stObj = (meta.source_types || []).find(s => s.value === state.sourceType);
    
    // Defensive access to calc_methods (might be missing in modular format)
    const cmDict = meta.calc_methods || {};
    const cmList = cmDict[state.sourceType] || [];
    const cmObj = cmList.find(c => c.value === state.calcMethod);
    
    // Fallback label for calculation method
    let cmLabel = (state.calcMethod === '_default' ? 'Основной метод' : state.calcMethod || '');
    if (cmObj) cmLabel = cmObj.label;

    addRow('Тип источника', escapeHTML(uiText(stObj ? stObj.label : (state.sourceType || ''))));
    addRow('Метод расчёта', escapeHTML(uiText(cmLabel)));

    // Only show technical IDs/codes if launched in expert mode
    if (_wizardContext.mode === 'manual_expert') {
        addRow('Код формулы (Тех)', `<code>${escapeHTML(state.formulaCode || '') || '—'}</code>`);
    }
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
            
            // Hide intermediate results from summary in normal mode, 
            // they will be visible in the "Audit Trace" below.
            if (_wizardContext.mode === 'manual_expert' || (v && v.category === 'calculated_total')) {
                addRow(label, typeof val === 'number' ? val.toFixed(6) : val);
            }
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

    // Show step-by-step audit trail (Conversions -> Lookups -> Equations)
    const eqCard = document.getElementById('equations-used-card');
    const eqList = document.getElementById('equations-used-list');
    if (!eqCard || !eqList) return;

    eqList.innerHTML = '';

    // Hide audit trail by default in normal mode
    if (_wizardContext.mode !== 'manual_expert') {
        eqCard.style.display = 'none';
        
        // Add a "Show Technical Trace" button to summary if it's hidden
        const traceBtnRow = document.createElement('div');
        traceBtnRow.style.marginTop = '16px';
        traceBtnRow.innerHTML = `<button class="btn btn-secondary" onclick="document.getElementById('equations-used-card').style.display='block'; this.style.display='none';">🔍 Показать технический протокол расчёта</button>`;
        tbodySummary.closest('.results-card').appendChild(traceBtnRow);
    } else {
        eqCard.style.display = 'block';
    }

    const trace = result.trace || { conversions: [], equations: [], lookups: [] };

    // 1. Unit Conversions
    if (trace.conversions && trace.conversions.length > 0) {
        const header = document.createElement('h4');
        header.style.margin = '24px 0 12px';
        header.style.fontSize = '0.9rem';
        header.style.color = '#64748b';
        header.textContent = '📏 ПЕРЕСЧЕТ ЕДИНИЦ ИЗМЕРЕНИЯ';
        eqList.appendChild(header);

        trace.conversions.forEach(c => {
            const div = document.createElement('div');
            div.className = 'equation-item';
            div.style.borderLeftColor = '#3b82f6';
            div.innerHTML = `
                <div class="eq-header">
                        <strong>${escapeHTML(uiText(String(c.label || '')))}</strong>
                    <span class="confidence-badge" style="background:#dbeafe; color:#1d4ed8;">конвертация</span>
                </div>
                <div class="eq-derivation" style="margin-top:4px; padding: 6px; background: #eff6ff; border-radius: 4px;">
                    <span style="font-size:0.9em;">${c.from} → ${c.to}:</span>
                    <code style="font-size:1.05em; margin-left:8px;">${c.input_value} → <b>${c.result_value.toFixed(6)}</b></code>
                </div>
            `;
            eqList.appendChild(div);
        });
    }

    if (trace.lookups && trace.lookups.length > 0) {
        const header = document.createElement('h4');
        header.style.margin = '24px 0 12px';
        header.style.fontSize = '0.9rem';
        header.style.color = '#64748b';
        header.textContent = '📚 ВЫБОРКИ ИЗ СПРАВОЧНИКОВ';
        eqList.appendChild(header);

        trace.lookups.forEach(l => {
            const keys = Object.entries(l.keys).map(([k, v]) => `${escapeHTML(uiText(String(k)))}=<b>${escapeHTML(uiText(String(v ?? '')))}</b>`).join(', ');
            const div = document.createElement('div');
            div.className = 'equation-item lookup-item';
            div.style.borderLeftColor = '#f59e0b';
            
            // Rich meta from new engine
            const meta = l.tableMeta || {};
            const authority = meta.authority || 'normative';
            const source = meta.source ? (meta.source.document || meta.source) : '—';
            const unit = l.unit ? `<span style="color:#64748b; font-size:0.8em; margin-left:4px;">${l.unit}</span>` : '';

            div.innerHTML = `
                <div class="eq-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${escapeHTML(uiText(String(l.label || '')))}</strong>
                        <span class="confidence-badge" style="background:${authority === 'normative' ? '#dcfce7' : '#fef3c7'}; color:${authority === 'normative' ? '#166534' : '#b45309'}; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:700; text-transform:uppercase;">
                            ${authority === 'normative' ? '✅ Норматив' : '⚠️ Справочно'}
                        </span>
                    </div>
                    <button class="btn-icon-only" onclick="openHandbookModal('${l.table_id}')" title="Просмотреть таблицу в справочнике" 
                            style="background:white; border:1px solid #e2e8f0; padding:4px 10px; border-radius:6px; cursor:pointer; color:#3b82f6; font-size:0.8rem; display:flex; align-items:center; gap:6px; transition:all 0.2s;">
                        📖 Таблица ${l.table_id}
                    </button>
                </div>
                <div class="eq-math" style="font-size:0.85rem; color:#64748b; margin-top:8px; padding-left:12px; border-left:2px solid #e2e8f0;">
                    Ключи поиска: <code>${keys}</code> | Метод: <span style="font-weight:600;">${l.method}</span>
                    <div style="font-size:0.75rem; margin-top:2px;">Источник: ${source}</div>
                </div>
                <div class="eq-derivation" style="margin-top:8px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span style="font-size:0.8rem; color:#64748b; text-transform:uppercase; font-weight:600;">Получено:</span>
                        <code style="font-size:1.15em; color:#0f5132; font-weight:700; margin-left:8px;">${l.result[Object.keys(l.result)[0]]}</code> ${unit}
                    </div>
                    <div style="font-size:0.75rem; color:#64748b; font-style:italic;">
                        ${l.trace || ''}
                    </div>
                </div>
            `;
            eqList.appendChild(div);
        });
    }

    // 3. Equations
    const eqHeader = document.createElement('h4');
    eqHeader.style.margin = '24px 0 12px';
    eqHeader.style.fontSize = '0.9rem';
    eqHeader.style.color = '#64748b';
    eqHeader.textContent = '🧮 РАСЧЕТНЫЕ ФОРМУЛЫ';
    eqList.appendChild(eqHeader);
    
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
                    <strong>${escapeHTML(uiText(String(step.formula_name || step.lhs || '')))}</strong>
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
// P3 & P4: EQUIPMENT WIZARD & MODULE GENERATION (TEMPLATE WORKFLOW)
// ========================================================================

window.startEquipmentWizard = async function(facId) {
    _wizardContext = { facilityId: facId, sourceId: null };
    
    // Switch to Wizard view
    document.querySelectorAll('.dashboard-pane').forEach(p => p.style.display = 'none');
    document.getElementById('calculator-wizard').style.display = 'block';
    if(typeof clearSuccessOverlay === 'function') clearSuccessOverlay();
    
    const fac = ProjectStore.getFacility(facId);
    document.getElementById('wizard-context-title').textContent = 'Настройка оборудования';
    document.getElementById('wizard-context-subtitle').textContent = `Объект: ${fac.name}`;
    
    currentStep = 'template';
    updateNavigation();
    
    try {
        const cacheBuster = `?v=${Date.now()}`;
        const res = await fetch(`data/object_templates/${fac.type}.json${cacheBuster}`);
        if (!res.ok) throw new Error('Шаблон не найден');
        const template = await res.json();
        
        renderTemplateEquipForm(fac, template);
    } catch(e) {
        console.error("Equipment template error:", e);
        showToast('Ошибка загрузки шаблона оборудования', 'danger');
    }
};

/**
 * Evaluate template conditions with a constrained expression parser.
 * Supported:
 * - &&, ||, !
 * - ==, !=, ===, !==, <, <=, >, >=
 * - true/false, numbers, strings, identifiers from context only
 */
function evaluateCondition(expr, context = {}, options = {}) {
    if (!expr) return true;
    const defaultOnError = options.defaultOnError !== undefined ? !!options.defaultOnError : true;
    const source = String(expr);

    function tokenize(input) {
        const tokens = [];
        let i = 0;

        while (i < input.length) {
            const ch = input[i];

            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            const threeCharOp = input.slice(i, i + 3);
            if (threeCharOp === '===' || threeCharOp === '!==') {
                tokens.push({ type: 'op', value: threeCharOp });
                i += 3;
                continue;
            }

            const twoCharOp = input.slice(i, i + 2);
            if (twoCharOp === '&&' || twoCharOp === '||' || twoCharOp === '==' || twoCharOp === '!=' || twoCharOp === '<=' || twoCharOp === '>=') {
                tokens.push({ type: 'op', value: twoCharOp });
                i += 2;
                continue;
            }

            if (ch === '<' || ch === '>' || ch === '!') {
                tokens.push({ type: 'op', value: ch });
                i += 1;
                continue;
            }

            if (ch === '(' || ch === ')') {
                tokens.push({ type: 'paren', value: ch });
                i += 1;
                continue;
            }

            if (ch === '"' || ch === '\'') {
                const quote = ch;
                i++;
                let value = '';
                while (i < input.length) {
                    const c = input[i];
                    if (c === '\\') {
                        if (i + 1 >= input.length) {
                            throw new Error('Unterminated escape sequence in string literal');
                        }
                        value += input[i + 1];
                        i += 2;
                        continue;
                    }
                    if (c === quote) {
                        i++;
                        tokens.push({ type: 'string', value });
                        value = null;
                        break;
                    }
                    value += c;
                    i++;
                }
                if (value !== null) {
                    throw new Error('Unterminated string literal');
                }
                continue;
            }

            if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(input[i + 1] || ''))) {
                const start = i;
                i += (ch === '-') ? 1 : 0;
                while (i < input.length && /[0-9]/.test(input[i])) i++;
                if (input[i] === '.') {
                    i++;
                    while (i < input.length && /[0-9]/.test(input[i])) i++;
                }
                const raw = input.slice(start, i);
                const parsed = Number(raw);
                if (Number.isNaN(parsed)) {
                    throw new Error(`Invalid number literal "${raw}"`);
                }
                tokens.push({ type: 'number', value: parsed });
                continue;
            }

            if (/[A-Za-z_]/.test(ch)) {
                const start = i;
                i++;
                while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) i++;
                const ident = input.slice(start, i);
                if (ident === 'true' || ident === 'false') {
                    tokens.push({ type: 'bool', value: ident === 'true' });
                } else {
                    tokens.push({ type: 'ident', value: ident });
                }
                continue;
            }

            throw new Error(`Unsupported token "${ch}"`);
        }

        return tokens;
    }

    function compareValues(op, left, right) {
        if (op === '===') return left === right;
        if (op === '!==') return left !== right;
        if (op === '==') return left == right; // intentional non-strict for template ergonomics
        if (op === '!=') return left != right; // intentional non-strict for template ergonomics

        const leftNum = Number(left);
        const rightNum = Number(right);
        const bothNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);
        const a = bothNumeric ? leftNum : String(left ?? '');
        const b = bothNumeric ? rightNum : String(right ?? '');

        if (op === '<') return a < b;
        if (op === '<=') return a <= b;
        if (op === '>') return a > b;
        if (op === '>=') return a >= b;

        throw new Error(`Unsupported comparison operator "${op}"`);
    }

    try {
        const tokens = tokenize(source);
        let cursor = 0;

        function peek() {
            return tokens[cursor] || null;
        }

        function consume(expectedType = null, expectedValue = null) {
            const token = tokens[cursor];
            if (!token) {
                throw new Error('Unexpected end of expression');
            }
            if (expectedType && token.type !== expectedType) {
                throw new Error(`Expected token type "${expectedType}" but got "${token.type}"`);
            }
            if (expectedValue && token.value !== expectedValue) {
                throw new Error(`Expected token "${expectedValue}" but got "${token.value}"`);
            }
            cursor++;
            return token;
        }

        function parsePrimary() {
            const token = peek();
            if (!token) throw new Error('Expected expression');

            if (token.type === 'paren' && token.value === '(') {
                consume('paren', '(');
                const nested = parseOr();
                consume('paren', ')');
                return nested;
            }
            if (token.type === 'bool' || token.type === 'number' || token.type === 'string') {
                consume();
                return token.value;
            }
            if (token.type === 'ident') {
                consume();
                if (!Object.prototype.hasOwnProperty.call(context, token.value)) {
                    throw new Error(`Unknown identifier "${token.value}"`);
                }
                return context[token.value];
            }

            throw new Error(`Unexpected token "${token.value}"`);
        }

        function parseUnary() {
            const token = peek();
            if (token && token.type === 'op' && token.value === '!') {
                consume('op', '!');
                return !Boolean(parseUnary());
            }
            return parseComparison();
        }

        function parseComparison() {
            let left = parsePrimary();
            while (true) {
                const token = peek();
                if (!token || token.type !== 'op' || !['==', '!=', '===', '!==', '<', '<=', '>', '>='].includes(token.value)) {
                    break;
                }
                const op = consume('op').value;
                const right = parsePrimary();
                left = compareValues(op, left, right);
            }
            return left;
        }

        function parseAnd() {
            let left = parseUnary();
            while (true) {
                const token = peek();
                if (!token || token.type !== 'op' || token.value !== '&&') break;
                consume('op', '&&');
                const right = parseUnary();
                left = Boolean(left) && Boolean(right);
            }
            return left;
        }

        function parseOr() {
            let left = parseAnd();
            while (true) {
                const token = peek();
                if (!token || token.type !== 'op' || token.value !== '||') break;
                consume('op', '||');
                const right = parseAnd();
                left = Boolean(left) || Boolean(right);
            }
            return left;
        }

        const value = parseOr();
        if (cursor !== tokens.length) {
            throw new Error(`Unexpected token "${tokens[cursor].value}"`);
        }
        return Boolean(value);
    } catch (err) {
        console.warn(`[Condition] Failed to evaluate: "${source}"`, err);
        return defaultOnError;
    }
}

function renderTemplateEquipForm(fac, template) {
    const container = document.getElementById('template-equip-form');
    if (!container) return;
    container.innerHTML = '';
    
    const profile = fac.equipmentProfile || {};
    profile.phase = fac.phase || 'operation';

    if (!profile.subtype) profile.subtype = fac.subtype || (template.subtypes && template.subtypes.length > 0 ? template.subtypes[0].value : null);

    let html = `
        <div class="param-card">
            <div class="param-card-header"><div class="param-label">Сценарий расчета</div></div>
            <div class="param-control-row">
                <input type="text" class="cart-input" style="width:100%; color:var(--text-muted);" value="${template.phase_descriptions[profile.phase] || profile.phase}" disabled>
            </div>
            <div class="param-help">Определяется на этапе создания объекта. Для изменения вернитесь к редактированию объекта.</div>
        </div>
    `;

    if (template.subtypes) {
        html += `
            <div class="param-card">
                <div class="param-card-header"><div class="param-label">Конфигурация объекта</div></div>
                <div class="param-control-row">
                    <select id="tpl-subtype" class="cart-input" style="width:100%;">
                        ${template.subtypes.map(s => `<option value="${escapeHTML(String(s.value ?? ''))}" ${profile.subtype === s.value ? 'selected' : ''}>${escapeHTML(uiText(String(s.label ?? '')))} — ${escapeHTML(uiText(String(s.description ?? '')))}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
    }

    html += `<hr style="border:0; border-top:1px solid #e2e8f0; margin:16px 0;">`;
    
    template.equipment_questions.forEach(q => {
        let show = true;
        if (q.show_if) {
            show = evaluateCondition(q.show_if, { ...profile, subtype: profile.subtype }, { defaultOnError: false });
        }
        
        if (!show) return;

        html += `
            <div class="param-card">
                <div class="param-card-header"><div class="param-label">${escapeHTML(uiText(String(q.label || q.id || '')))}</div></div>
                <div class="param-control-row" style="align-items:center;">
                    ${q.type === 'boolean' ? 
                        `<label style="display:flex; align-items:center; cursor:pointer;">
                            <input type="checkbox" id="tpl-${q.id}" ${profile[q.id] ? 'checked' : ''} style="width:18px; height:18px; margin-right:8px;"> 
                            Да
                        </label>` 
                        : q.type === 'select' ?
                        `<select id="tpl-${q.id}" class="cart-input" style="width:100%;">
                            ${q.options.map(o => `<option value="${escapeHTML(String(o.value ?? ''))}" ${profile[q.id] === o.value ? 'selected' : ''}>${escapeHTML(uiText(String(o.label ?? '')))}</option>`).join('')}
                        </select>`
                        : 
                        `<input type="number" id="tpl-${q.id}" class="cart-input" style="width:100%;" value="${profile[q.id] || ''}"> ${q.unit ? `<span style="margin-left:8px; font-size:0.8rem; color:#64748b;">${q.unit}</span>` : ''}`
                    }
                </div>
            </div>
        `;
    });
    
    html += `
        <div style="margin-top:24px; display:flex; justify-content:space-between;">
            <button class="btn btn-secondary" onclick="returnToContext()">Отмена</button>
            <button class="btn btn-primary" onclick="generateTemplateModules('${fac.id}')">Сформировать модули</button>
        </div>
    `;

    container.innerHTML = html;
    
    const cbChange = () => {
        if (template.subtypes) profile.subtype = document.getElementById('tpl-subtype').value;
        template.equipment_questions.forEach(q => {
            const el = document.getElementById(`tpl-${q.id}`);
            if (el) {
                if (q.type === 'boolean') profile[q.id] = el.checked;
                else if (q.type === 'number') profile[q.id] = parseFloat(el.value);
                else profile[q.id] = el.value;
            }
        });
        fac.equipmentProfile = profile;
        ProjectStore.updateFacility(fac.id, fac);
        renderTemplateEquipForm(fac, template);
    };

    if (template.subtypes) {
        document.getElementById('tpl-subtype').addEventListener('change', cbChange);
    }
    template.equipment_questions.forEach(q => {
        const el = document.getElementById(`tpl-${q.id}`);
        if (el && q.type === 'boolean') el.addEventListener('change', cbChange);
    });
}

window.generateTemplateModules = async function(facId) {
    const fac = ProjectStore.getFacility(facId);
    if (!fac) return;
    
    const profile = fac.equipmentProfile || {};
    try {
        const cacheBuster = `?v=${Date.now()}`;
        const res = await fetch(`data/object_templates/${fac.type}.json${cacheBuster}`);
        if (!res.ok) throw new Error('Шаблон не найден');
        const template = await res.json();
        
        if (template.subtypes) profile.subtype = document.getElementById('tpl-subtype').value;
        template.equipment_questions.forEach(q => {
            const el = document.getElementById(`tpl-${q.id}`);
            if (el) {
                if (q.type === 'boolean') profile[q.id] = el.checked;
                else if (q.type === 'number') profile[q.id] = parseFloat(el.value);
                else profile[q.id] = el.value;
            }
        });
        fac.equipmentProfile = profile;
        ProjectStore.updateFacility(fac.id, fac);
        
        currentStep = 'template-modules';
        updateNavigation();
        
        renderTemplateModulesReview(fac, template, profile);
        
    } catch(e) {
        showToast("Ошибка", "danger");
    }
};

function renderTemplateModulesReview(fac, template, profile) {
    const container = document.getElementById('template-modules-list');
    if (!container) return;
    
    let proposedModules = [];
    template.module_rules.forEach(rule => {
        if (rule.scenario !== profile.phase && profile.phase !== 'both' && rule.scenario !== 'both') return;

        const ruleValid = !rule.condition || evaluateCondition(rule.condition, profile, { defaultOnError: false });

        if (ruleValid) {
            rule.modules.forEach(m => {
                let mShow = true;
                if (m.show_if) {
                    mShow = evaluateCondition(m.show_if, profile, { defaultOnError: false });
                }
                if (mShow) {
                    let why = m.why_generated_template || '';
                    why = why.replace(/{([a-zA-Z0-9_]+)}/g, (match, v) => profile[v] || '?');
                    m.why_resolved = why;
                    proposedModules.push(m);
                }
            });
        }
    });

    let html = '';
    
    if (proposedModules.length === 0) {
        html = `<div style="padding:24px; text-align:center; color:#64748b;">Модули не найдены для данной конфигурации.</div>`;
    } else {
        html += `<div style="display:flex; flex-direction:column; gap:12px;">`;
        proposedModules.forEach(m => {
            const isReady = m.status === 'ready';
            html += `
                <div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px; background:white; display:flex; align-items:center; justify-content:space-between;">
                    <div>
                        <h4 style="margin:0; font-size:1.1rem; color:#0f172a;">${escapeHTML(m.default_source_name || m.display_name)}</h4>
                        <div style="font-size:0.85rem; color:#64748b; margin-top:4px;">${escapeHTML(m.why_resolved)}</div>
                        <div style="font-size:0.75rem; margin-top:4px;"><span style="background:#e2e8f0; padding:2px 6px; border-radius:4px;">Ист. ${m.default_source_number}</span> &bull; ${m.expected_pollutants ? m.expected_pollutants.join(', ') : ''}</div>
                    </div>
                    <div>
                        ${isReady 
                            ? `<span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">Доступно</span>` 
                            : `<span style="background:#fee2e2; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">В разработке</span>`
                        }
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    window._lastProposedModules = proposedModules;

    html += `
        <div style="margin-top:24px; display:flex; justify-content:space-between;">
            <button class="btn btn-secondary" onclick="startEquipmentWizard('${fac.id}')">Назад</button>
            <button class="btn btn-primary" onclick="approveAndHydrateModules('${fac.id}')" ${proposedModules.length === 0 ? 'disabled' : ''}>Применить и сохранить</button>
        </div>
    `;

    container.innerHTML = html;
}

window.approveAndHydrateModules = function(facId) {
    const modules = window._lastProposedModules || [];
    const fac = ProjectStore.getFacility(facId);
    
    if (fac.sources) {
        fac.sources = fac.sources.filter(s => !s._is_template);
    } else {
        fac.sources = [];
    }
    
    modules.forEach(m => {
        let mName = null;
        if (m.methodic_id && state.methodics) {
            const registryEntry = state.methodics.find(reg => reg.id === m.methodic_id);
            if (registryEntry) mName = registryEntry.name;
        }

        ProjectStore.addSourceToFacility(facId, {
            source_number: m.default_source_number,
            name: m.default_source_name,
            methodic_id: m.methodic_id,
            methodic_name: mName,
            source_type: m.source_type,
            calc_method: m.calc_method || '_default',
            formula_code: m.formula_code || null,
            _is_template: true,
            _is_not_implemented: m.status !== 'ready'
        });
    });
    
    showToast("Модули успешно добавлены", "success");
    showFacilityDashboard(facId);
};// ========================================================================
// NAVIGATION LOGIC / REVIEW STEP
// ========================================================================
function populateReviewStep() {
    const tbody = document.querySelector('#review-table tbody');
    if (!tbody) return;
    normalizeCurrentMethodSelection();
    tbody.innerHTML = '';
    
    // Find Russian labels for source type and calc method
    const meta = state.methodicData?.meta || {};
    const stObj = (meta.source_types || []).find(s => s.value === state.sourceType);
    
    // Defensive access to calc_methods (might be missing in modular format)
    const cmDict = meta.calc_methods || {};
    const cmList = cmDict[state.sourceType] || [];
    const cmObj = cmList.find(c => c.value === state.calcMethod);

    tbody.innerHTML += `<tr><th colspan="2" style="background:#f1f5f9; text-align: left;">Методика и Метод расчёта</th></tr>`;
    tbody.innerHTML += `<tr><td>Название</td><td><strong>${escapeHTML(uiText(meta.name || ''))}</strong></td></tr>`;
    tbody.innerHTML += `<tr><td>Тип источника</td><td>${escapeHTML(uiText(stObj ? stObj.label : state.sourceType || ''))}</td></tr>`;
    
    // If calc_methods is missing, we might use the source_type label or just state.calcMethod
    let cmLabel = (state.calcMethod === '_default' ? 'Основной метод' : state.calcMethod || '');
    if (cmObj) cmLabel = cmObj.label;
    
    tbody.innerHTML += `<tr><td>Метод расчёта</td><td>${escapeHTML(uiText(cmLabel))}</td></tr>`;
    
    if (_wizardContext.mode === 'manual_expert') {
        tbody.innerHTML += `<tr><td>Формула</td><td>${state.formulaCode}</td></tr>`;
    }
    
    // Add User Inputs
    tbody.innerHTML += `<tr><th colspan="2" style="background:#f1f5f9; text-align: left;">Введенные параметры</th></tr>`;
    normalizeCurrentMethodSelection();
    const varIds = Wizard.getRequiredVariables(state.methodicData, state.sourceType, state.calcMethod, state.formulaCode);
    const questions = Wizard.buildQuestions(state.methodicData, varIds);
    questions.forEach(q => {
        const val = state.inputs[q.variable_id];
        const isLookup = q.auto_lookup || q.lookup_table || q.data_source === 'lookup';
        const displayVal = safeDisplay(val);
        const sourceMark = state.inputs[`${q.variable_id}_override`] ? ' [Вручную]' : (isLookup ? ' [Справочник]' : '');
        const latexHint = (q.latex && typeof q.latex === 'string') ? 
            `<span class="latex-hint" style="margin-left:6px; font-size:1.05em; color:var(--primary); opacity:0.9;">${renderLatex(q.latex)}</span>` : 
            `<small style="color:#888; font-size:0.8em; margin-left: 4px;">${q.variable_id}</small>`;
        
        tbody.innerHTML += `<tr><td>${escapeHTML(uiText(q.label || q.variable_id || ''))} ${latexHint}</td><td><strong>${displayVal}</strong> <span style="color:#888;font-size:0.8em;">${sourceMark}</span></td></tr>`;
    });
    
    // Add Composition
    if (state.composition && state.composition.length > 0) {
        tbody.innerHTML += `<tr><th colspan="2" style="background:#f1f5f9; text-align: left;">Состав загрязняющих веществ</th></tr>`;
        state.composition.forEach(c => {
            tbody.innerHTML += `<tr><td>${c.name}</td><td><strong>${c.pct}%</strong></td></tr>`;
        });
    }
}


function handleNext() {
    try {
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
    } catch (e) {
        console.error('[Wizard Error]', e);
        showToast('Произошла ошибка при вычислениях: ' + e.message, 'danger');
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

}

window.editSource = async function(facilityId, sourceId) {
    const fac = ProjectStore.getFacility(facilityId);
    if (!fac) return;
    const src = fac.sources.find(s => s.id == sourceId);
    if (!src) return;

    _wizardContext = { mode: 'existing_source_edit', facilityId, sourceId };
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
    
    document.getElementById('wizard-context-title').textContent = 'Редактировать расчёт';
    document.getElementById('wizard-context-subtitle').textContent = `Объект: ${fac.name}`;

    switchPane('calculator-wizard');

    try {
        const methodicMeta = state.methodics.find(m => m.id === state.methodicId) || state.methodics.find(m => m.name === src.methodic_name);
        
        if (methodicMeta) {
            state.methodicId = methodicMeta.id;
            state.methodicPath = methodicMeta.path;
            state.methodicData = await Wizard.loadMethodic(state.methodicPath);
            
            document.getElementById('methodic-badge').textContent = uiText(state.methodicData.meta.name || '');
            
            renderMethodicCards(state.methodics);

            // Attempt to resolve the selection to ensure we have all required flow data
            const resolved = Wizard.resolveFlowSelection(
                state.methodicData,
                state.sourceType,
                state.calcMethod,
                state.formulaCode
            );
            if (resolved) {
                state.sourceType = resolved.source_type;
                state.calcMethod = resolved.calc_method;
                state.formulaCode = resolved.formula_code;
            }

            if (state.sourceType && state.formulaCode) {
                currentStep = 3; // Parameters
            } else if (state.sourceType) {
                currentStep = 2; // Method/Formula selection
            } else {
                currentStep = 1; // Methodic selection
            }
            updateNavigation();
            if (currentStep === 3) renderParameters();
        } else {
            showToast("Методика не найдена в реестре.", "warning");
            currentStep = 1;
            renderMethodicCards(state.methodics);
            updateNavigation();
        }
    } catch (e) {
        console.error(e);
        showToast("Ошибка загрузки методики", "danger");
    }
};

window.startNewSource = function(facilityId) {
    const fac = ProjectStore.getFacility(facilityId);
    if (!fac) return;
    
    _wizardContext = { mode: 'manual_expert', facilityId };
    clearSuccessOverlay();
    
    state.methodicId = null;
    state.methodicData = null;
    state.inputs = {};
    state.composition = [];
    state.results = null;
    state.sourceType = null;
    state.calcMethod = null;
    state.formulaCode = null;
    currentStep = 1;
    
    document.getElementById('wizard-source-name').value = '';
    document.getElementById('wizard-context-title').textContent = 'Новый расчёт';
    document.getElementById('wizard-context-subtitle').textContent = `Объект: ${fac.name}`;
    
    switchPane('calculator-wizard');
    if (state.methodics) renderMethodicCards(state.methodics);
    updateNavigation();
};

/**
 * Start wizard directly from a module specification (Guided Mode).
 * Skips methodic and formula selection.
 */
window.startCalculationFromModule = async function(facilityId, moduleSpec) {
    const fac = ProjectStore.getFacility(facilityId);
    if (!fac) return;

    _wizardContext = { 
        mode: 'object_template_module', 
        facilityId, 
        moduleId: moduleSpec.module_id,
        sourceId: moduleSpec.id // might be a saved template source
    };
    clearSuccessOverlay();

    state.methodicId = moduleSpec.methodic_id;
    state.sourceType = moduleSpec.source_type;
    state.calcMethod = moduleSpec.calc_method || '_default';
    state.formulaCode = moduleSpec.formula_code;
    state.inputs = JSON.parse(JSON.stringify(moduleSpec.inputs || {}));
    state.composition = JSON.parse(JSON.stringify(moduleSpec.composition || []));
    state.results = null;

    const sourceName = moduleSpec.name || moduleSpec.default_source_name || moduleSpec.display_name || '';
    document.getElementById('wizard-source-name').value = sourceName;
    
    document.getElementById('wizard-context-title').textContent = 'Заполнение расчёта';
    document.getElementById('wizard-context-subtitle').textContent = `Объект: ${fac.name}`;

    switchPane('calculator-wizard');

    try {
        const methodicMeta = state.methodics.find(m => m.id === state.methodicId);
        if (methodicMeta) {
            state.methodicPath = methodicMeta.path;
            state.methodicData = await Wizard.loadMethodic(state.methodicPath);
            document.getElementById('methodic-badge').textContent = uiText(state.methodicData.meta.name || '');

            // Resolve flow selection
            const resolved = Wizard.resolveFlowSelection(
                state.methodicData,
                state.sourceType,
                state.calcMethod,
                state.formulaCode
            );
            if (resolved) {
                state.sourceType = resolved.source_type;
                state.calcMethod = resolved.calc_method;
                state.formulaCode = resolved.formula_code;
            }

            currentStep = 3; // Directly to parameters
            updateNavigation();
            renderParameters();
        } else {
            console.error('Methodic not found:', state.methodicId);
            showToast("Методика не найдена в реестре. Открыт ручной выбор.", "warning");
            startNewSource(facilityId);
        }
    } catch (e) {
        console.error(e);
        showToast("Ошибка при запуске расчёта", "danger");
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
    const srcName = typedName || ((state.methodicData && state.methodicData.meta) ? uiText(state.methodicData.meta.name || '') : 'Источник');
    
    const sourceData = {
        name: srcName,
        methodic_name: uiText(state.methodicData.meta.name || ''),
        methodic_id: state.methodicId,
        source_type: state.sourceType,
        calc_method: state.calcMethod,
        category: state.methodicData.meta.category || 'operation',
        formula_code: state.formulaCode,
        inputs: JSON.parse(JSON.stringify(state.inputs)),
        results: JSON.parse(JSON.stringify(state.results)),
        composition: JSON.parse(JSON.stringify(state.composition)),
        M: state.results.M,
        G: state.results.G,
        _is_template: false
    };

    const compatibility = ProjectStore.validateSourceCompatibility(
        _wizardContext.facilityId,
        sourceData,
        _wizardContext.sourceId || null
    );
    if (!compatibility.valid) {
        showToast(compatibility.message || 'Cannot save source because it conflicts with an existing source.', 'danger');
        return;
    }

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
    const totals = ProjectStore.getFacilityTotals(_wizardContext.facilityId);
    let totalsHtml = '';
    if (totals && totals.byPollutant && totals.byPollutant.length > 0) {
        totalsHtml = `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:0 auto 24px; max-width:500px; text-align:left; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                <div style="font-weight:600; margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:8px; display:flex; justify-content:space-between;">
                    <span>Итого по объекту:</span>
                    <span style="color:#64748b; font-weight:400; font-size:0.85rem;">ЗВ: ${totals.byPollutant.length}</span>
                </div>
                <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                    <thead><tr style="color:#64748b; text-align:left;"><th>Вещество</th><th style="width:80px">M (г/с)</th><th style="width:80px">G (т/год)</th></tr></thead>
                    <tbody>
                        ${totals.byPollutant.slice(0, 5).map(p => `
                            <tr>
                                <td style="padding:4px 0;">${escapeHTML(p.name)}</td>
                                <td style="padding:4px 0; color:#047857; font-weight:600;">${p.M.toFixed(4)}</td>
                                <td style="padding:4px 0; color:#0f766e; font-weight:600;">${p.G.toFixed(4)}</td>
                            </tr>
                        `).join('')}
                        ${totals.byPollutant.length > 5 ? `<tr><td colspan="3" style="text-align:center; padding-top:8px; color:#94a3b8; font-size:0.75rem;">... и ещё ${totals.byPollutant.length - 5} веществ</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }

    overlay.innerHTML = `
        <div style="text-align:center; padding:60px 40px; animation: fadeIn 0.5s ease-out; width:100%;">
            <div style="font-size:4rem; margin-bottom:16px;">✅</div>
            <h2 style="color:var(--primary); font-size:1.6rem; margin-bottom:12px;">Расчет завершен успешно!</h2>
            <p style="color:var(--text-muted); max-width:500px; margin:0 auto 24px;">Ваши данные сохранены в реестр источников объекта.</p>
            
            ${totalsHtml}
            
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
