// --- PROJECT UI MODULE ---
// ========================================================================
// PROJECT & FACILITY WORKFLOW
// ========================================================================

// (FACILITY_TYPES is now loaded from data/constants.js)

let _activeDashboardPane = 'project-dashboard';
let _selectedFacilityId = null;
let _wizardContext = { facilityId: null, sourceId: null };

function initProjectWorkflow() {
    // Project metadata listeners
    const nameInput = document.getElementById('project-name');
    const companyInput = document.getElementById('project-company');
    const licenseInput = document.getElementById('project-license');

    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            const val = e.target.value;
            ProjectStore.setName(val);
            const hn = document.getElementById('header-project-name');
            if (hn) hn.textContent = val || 'Новый проект';
            
            const res = Validation.validateField({ required: true, label: 'Название проекта', type: 'text' }, val);
            updateInlineValidation(nameInput, res);
// updateReportReadiness();
        });
    }

    if (companyInput) {
        companyInput.addEventListener('input', (e) => {
            const val = e.target.value;
            ProjectStore.setProjectMeta({ company: val });
            const res = Validation.validateField({ required: true, label: 'Заказчик', type: 'text' }, val);
            updateInlineValidation(companyInput, res);
// updateReportReadiness();
        });
    }

    if (licenseInput) {
        licenseInput.addEventListener('input', (e) => {
            const val = e.target.value;
            ProjectStore.setProjectMeta({ license: val });
            const res = Validation.validateField({ required: true, label: 'Лицензия', type: 'text' }, val);
            updateInlineValidation(licenseInput, res);
// updateReportReadiness();
        });
    }

    // Global Report Buttons (Step 4 & Readiness Card)
    const btnReportMain = document.getElementById('btn-generate-report-main');
    const btnReportFinal = document.getElementById('btn-generate-report-final');
    
    if (btnReportMain) {
        btnReportMain.onclick = showProjectValidation;
    }
    if (btnReportFinal) {
        btnReportFinal.onclick = showProjectValidation;
    }
}

// --- INTERACTIVE MINI-MAP --- //
let _miniMap = null;
let _miniMapMarkers = [];

function initMiniMap() {
    if (!window.L) return;
    
    const container = document.getElementById('project-map-mini');
    if (!container) return;
    
    // If mini-map already exists, just refresh markers
    if (_miniMap) {
        refreshMiniMap();
        _miniMap.invalidateSize();
        return;
    }
    
    const pState = ProjectStore.getState();
    const lat = pState.lat || 43.2;
    const lng = pState.lng || 76.9;
    
    _miniMap = L.map('project-map-mini', {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        minZoom: 3,
        maxZoom: 18
    }).setView([lat, lng], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        opacity: 0.85
    }).addTo(_miniMap);
    
    // Compact zoom control
    L.control.zoom({ position: 'topright' }).addTo(_miniMap);
    
    refreshMiniMap();
}

function refreshMiniMap() {
    if (!_miniMap) return;
    
    // Clear existing markers
    _miniMapMarkers.forEach(m => _miniMap.removeLayer(m));
    _miniMapMarkers = [];
    
    const facilities = ProjectStore.getAllFacilities();
    const pState = ProjectStore.getState();
    const bounds = [];
    
    facilities.forEach(fac => {
        const lat = fac.lat || pState.lat;
        const lng = fac.lng || pState.lng;
        if (!lat || !lng) return;
        
        const totals = ProjectStore.getFacilityTotals(fac.id);
        const intensity = MapModule ? MapModule.getIntensityLevel(totals.G) : 'low';
        const colors = MapModule ? MapModule.INTENSITY_COLORS : { low: { bg: '#10b981' }, medium: { bg: '#f59e0b' }, high: { bg: '#ef4444' }, critical: { bg: '#7c2d12' } };
        const c = colors[intensity];
        const typeIcons = MapModule ? MapModule.FACILITY_TYPE_ICONS : {};
        const typeEmoji = typeIcons[fac.type] || '📍';
        
        // Create a rich div icon for the mini-map
        const icon = L.divIcon({
            className: 'minimap-facility-marker',
            html: `<div class="minimap-pin" style="background:${c.bg}; border-color:${c.border || c.bg};">
                     <span class="minimap-pin-icon">${typeEmoji}</span>
                   </div>
                   <div class="minimap-pin-label">${fac.name.length > 15 ? fac.name.substring(0, 15) + '…' : fac.name}</div>`,
            iconSize: [100, 44],
            iconAnchor: [50, 34]
        });
        
        const marker = L.marker([lat, lng], { icon: icon }).addTo(_miniMap);
        
        marker.bindTooltip(`
            <div style="font-weight:700; margin-bottom:4px;">${fac.name}</div>
            <div style="font-size:0.85em; color:#64748b;">G: ${totals.G.toFixed(4)} т/г</div>
            <div style="font-size:0.85em; color:#64748b;">M: ${totals.M.toFixed(4)} г/с</div>
            <div style="font-size:0.85em; color:#64748b;">Источников: ${totals.sourceCount}</div>
        `, { direction: 'top', offset: [0, -36] });
        
        marker.on('click', () => {
            selectFacility(fac.id);
        });
        
        _miniMapMarkers.push(marker);
        bounds.push([lat, lng]);
    });
    
    // Also add project-level pin if no facilities have custom coords
    if (bounds.length === 0 && pState.lat && pState.lng) {
        const projMarker = L.circleMarker([pState.lat, pState.lng], {
            radius: 6,
            fillColor: '#4f46e5',
            color: '#fff',
            weight: 2,
            fillOpacity: 0.8
        }).addTo(_miniMap);
        projMarker.bindTooltip('Координаты проекта', { direction: 'top' });
        _miniMapMarkers.push(projMarker);
        bounds.push([pState.lat, pState.lng]);
    }
    
    if (bounds.length > 1) {
        _miniMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } else if (bounds.length === 1) {
        _miniMap.setView(bounds[0], 12);
    }
}


function showProjectDashboard() {
    _activeDashboardPane = 'project-dashboard';
    _selectedFacilityId = null;

    // Hide all panes
    document.querySelectorAll('.dashboard-pane').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.dashboard-pane').forEach(p => p.classList.remove('active'));
    
    const dash = document.getElementById('project-dashboard');
    dash.style.display = 'block';
    dash.classList.add('active');
    
    const pState = ProjectStore.getState();
    document.getElementById('proj-dashboard-title').textContent = `Управление Проектом: ${pState.name || 'Сводка'}`;
    
    // Sync metadata values
    if (document.getElementById('project-name')) document.getElementById('project-name').value = pState.name || '';
    if (document.getElementById('project-company')) document.getElementById('project-company').value = pState.company || '';
    if (document.getElementById('project-license')) document.getElementById('project-license').value = pState.license || '';
    
    renderProjectSummaryTotals();
    renderProjectFacilitiesPreview();
    updateReportReadiness();
    
    // Initialize the interactive mini-map
    setTimeout(() => initMiniMap(), 100);
}

function renderProjectSummaryTotals() {
    const container = document.getElementById('project-summary-totals');
    if (!container) return;
    
    const totals = ProjectStore.getProjectTotals();
    const facCount = ProjectStore.getAllFacilities().length;
    const srcCount = ProjectStore.getTotalSourceCount();
    
    container.innerHTML = `
        <div style="background:linear-gradient(135deg, #4f46e5, #6366f1); padding:20px; border-radius:12px; color:white; box-shadow:0 10px 15px -3px rgba(79, 70, 229, 0.2);">
            <div style="font-size:0.75rem; opacity:0.8; text-transform:uppercase; font-weight:600; letter-spacing:0.05em;">Всего выбросов (G)</div>
            <div style="font-size:1.8rem; font-weight:800; margin:4px 0;">${totals.totalG.toFixed(4)} <span style="font-size:0.9rem; font-weight:400;">т/г</span></div>
            <div style="font-size:0.8rem; opacity:0.9;">Объектов: ${facCount} | Источников: ${srcCount}</div>
        </div>
        <div style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; justify-content:center;">
            <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase; font-weight:600; letter-spacing:0.05em;">Максимальный выброс (M)</div>
            <div style="font-size:1.5rem; font-weight:700; color:#0f172a; margin:4px 0;">${totals.totalM.toFixed(4)} <span style="font-size:0.8rem; font-weight:400; color:#64748b;">г/с</span></div>
            <div style="font-size:0.75rem; color:#10b981; font-weight:600;">⬤ Стабильный расчет</div>
        </div>
    `;
}

function renderProjectFacilitiesPreview() {
    const container = document.getElementById('project-facilities-list-preview');
    if (!container) return;
    
    const facilities = ProjectStore.getAllFacilities();
    if (facilities.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px 40px; color:#64748b; border:2px dashed #cbd5e1; border-radius:16px; background:#f8fafc; animation: fadeIn 0.5s ease-out;">
                <div style="font-size:3rem; margin-bottom:16px; opacity:0.5;">🏭</div>
                <h3 style="margin-bottom:8px; color:#1e293b;">Добро пожаловать в проект!</h3>
                <p style="margin-bottom:24px; font-size:0.9rem; max-width:400px; margin-left:auto; margin-right:auto;">Каждый отчет состоит из одного или нескольких производственных объектов. Начните с создания вашего первого объекта (например, АЗС, Склад или Цех).</p>
                <button class="btn btn-primary" style="padding:12px 24px;" onclick="showFacilityForm()">+ Создать первый объект</button>
            </div>
        `;
        return;
    }
    
    let html = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Расчетов</th>
                    <th>G (т/г)</th>
                    <th>Действие</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    facilities.forEach(fac => {
        const facTotals = ProjectStore.getFacilityTotals(fac.id);
        html += `
            <tr>
                <td style="font-weight:600; color:#4f46e5; cursor:pointer;" onclick="selectFacility('${escapeHTML(fac.id)}')">${escapeHTML(fac.name)}</td>
                <td><small>${fac.type}</small></td>
                <td>${fac.sources.length}</td>
                <td><strong>${facTotals.G.toFixed(4)}</strong></td>
                <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="selectFacility('${escapeHTML(fac.id)}')">Открыть</button></td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function updateReportReadiness() {
    const pState = ProjectStore.getState();
    const totals = ProjectStore.getProjectTotals();
    const facCount = pState.facilities.length;
    const srcCount = ProjectStore.getTotalSourceCount();
    
    const checks = {
        meta: !!(pState.name && pState.company && pState.license),
        facs: facCount > 0,
        calcs: srcCount > 0
    };
    
    updateCheckItem('check-metadata', checks.meta);
    updateCheckItem('check-facilities', checks.facs);
    updateCheckItem('check-calculations', checks.calcs);
    
    const isReady = Object.values(checks).every(v => v === true);
    const btn = document.getElementById('btn-generate-report-final');
    if (btn) {
        btn.disabled = !isReady;
        btn.title = isReady ? 'Сформировать отчет' : 'Заполните все данные проекта для формирования отчета';
    }
}

/**
 * Update inline validation display for an input.
 */
function updateInlineValidation(input, res) {
    if (!input) return;
    const parent = input.parentElement;
    let msgEl = parent.querySelector('.validation-message');
    
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.className = 'validation-message';
        parent.appendChild(msgEl);
    }
    
    input.classList.remove('is-invalid', 'is-valid', 'is-warning');
    msgEl.classList.remove('is-invalid', 'is-warning');
    msgEl.textContent = '';
    
    if (res.state === Validation.STATES.INVALID) {
        input.classList.add('is-invalid');
        msgEl.classList.add('is-invalid');
        msgEl.textContent = res.message;
    } else if (res.state === Validation.STATES.WARNING) {
        input.classList.add('is-warning');
        msgEl.classList.add('is-warning');
        msgEl.textContent = res.message;
    } else if (res.state === Validation.STATES.VALID && input.value) {
        input.classList.add('is-valid');
    }
}

function updateCheckItem(id, isDone) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isDone) el.classList.add('done');
    else el.classList.remove('done');
}



/**
 * FACILITY ACTIONS (Step 6)
 */
function selectFacility(id) {
    const fac = ProjectStore.getFacility(id);
    if (!fac) return;
    _selectedFacilityId = id;
    showFacilityDashboard(id);
}

// showFacilityDashboard() and renderFacilitySourcesTable() are defined below (after startCalculationForFacility)

function startCalculationForFacility(facId, sourceId = null) {
    _selectedFacilityId = facId;
    _wizardContext = { facilityId: facId, sourceId: sourceId };
    
    // Switch to Wizard view
    document.querySelectorAll('.dashboard-pane').forEach(p => p.style.display = 'none');
    document.getElementById('calculator-wizard').style.display = 'block';
    clearSuccessOverlay(); // Remove success overlay so pane-6 DOM is intact for next calc
    
    // Reset wizard to step 1 (or load source if editing)
    if (sourceId) {
        // Load existing source logic (future phase)
        showToast('Редактирование источника ' + sourceId, 'info');
    } else {
        // Reset state
        state.methodicId = null;
        state.sourceType = null;
        state.calcMethod = null;
        state.formulaCode = null;
        state.inputs = {};
        state.composition = [];
        state.results = null;
        currentStep = 1;
        updateNavigation();
        renderMethodicCards(state.methodics);
    }
}

function showFacilityDashboard(facilityId) {
    const fac = ProjectStore.getFacility(facilityId);
    if (!fac) return;
    _selectedFacilityId = facilityId;
    switchPane('facility-dashboard');
    
    const totals = ProjectStore.getFacilityTotals(facilityId);
    const typeObj = FACILITY_TYPES.find(t => t.value === fac.type) || FACILITY_TYPES[FACILITY_TYPES.length - 1];
    
    // P8: Dispersion Gating logic
    const emissionsComplete = fac.sources && fac.sources.length > 0 && fac.sources.every(s => s.M != null && s.G != null && !s._is_template);
    const hasAnySources = fac.sources && fac.sources.length > 0;
    const hasSomeCalc = fac.sources && fac.sources.some(s => s.M != null && s.G != null);
    
    let gisBtnHtml = '';
    if (!hasAnySources) {
        gisBtnHtml = `<button class="btn btn-secondary" disabled title="Сначала добавьте источники выбросов" style="opacity:0.6; cursor:not-allowed;">🗺️ Карта</button>`;
    } else if (!emissionsComplete && hasSomeCalc) {
        gisBtnHtml = `<button class="btn btn-secondary" style="border-color:#eab308; color:#a16207;" onclick="if(confirm('⚠️ Выполнено не для всех источников — всё равно перейти?')) GeoMeteoWorkspace.openWithContext('facility', '${escapeHTML(fac.id)}')">🗺️ Карта (содержит пустые)</button>`;
    } else if (emissionsComplete) {
        gisBtnHtml = `<button class="btn btn-primary" style="background:#10b981; border-color:#059669;" onclick="GeoMeteoWorkspace.openWithContext('facility', '${escapeHTML(fac.id)}')">✅ Перейти к рассеиванию</button>`;
    } else {
        gisBtnHtml = `<button class="btn btn-secondary" disabled title="Сначала рассчитайте источники" style="opacity:0.6; cursor:not-allowed;">🗺️ Карта</button>`;
    }
    
    const container = document.getElementById('facility-dashboard');
    container.innerHTML = `
        <div class="facility-dashboard-header">
            <div>
                <h2 style="margin:0; font-size:1.6rem;">${typeObj.icon} ${escapeHTML(fac.name)}</h2>
                <div style="color:var(--text-muted); margin-top:4px;">${typeObj.label} • ${fac.phase === 'operation' ? 'Эксплуатация' : 'Строительство'}</div>
            </div>
            <div class="actions" style="display:flex; gap:12px;">
                ${gisBtnHtml}
                <button class="btn btn-secondary" onclick="editFacility('${escapeHTML(fac.id)}')">Редактировать</button>
                <button class="btn btn-secondary" onclick="duplicateFacility('${escapeHTML(fac.id)}')" title="Дублировать">⎘</button>
                <button class="btn btn-secondary" onclick="deleteFacility('${escapeHTML(fac.id)}')" style="color:#ef4444; border-color:#fef2f2; background:#fef2f2;">✖</button>
            </div>
        </div>
        
        <div class="facility-header-card">
            ${fac.address ? `<div style="font-size:0.95rem; margin-bottom:12px;">📍 ${escapeHTML(fac.address)}</div>` : ''}
            ${fac.description ? `<div style="font-size:0.9rem; color:var(--text-secondary);">${escapeHTML(fac.description)}</div>` : ''}
            
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
            ${fac.workflowVersion === 'template' ? 
                `<button class="btn btn-primary" onclick="if(typeof startEquipmentWizard==='function') startEquipmentWizard('${fac.id}')">⚙️ Настроить оборудование</button>` :
                `<button class="btn btn-primary" onclick="startNewSource('${fac.id}')">+ Обновить / Расчёт</button>`
            }
        </div>
        
        <div id="fac-sources-table-container"></div>
        
        <!-- P7: Pollutant totals card appended here -->
        <div id="fac-pollutant-totals-container" style="margin-top:24px;"></div>
    `;
    
    renderFacilitySourcesTable(fac);
    renderFacilityPollutantTotals(fac);
}

// P6: Source filter state
let _sourceFilters = { scenario: 'all', status: 'all', search: '' };

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

    // Collect unique values for filter dropdowns
    const scenarios = new Set();
    const statuses = new Set();
    fac.sources.forEach(src => {
        scenarios.add(src.category === 'construction' ? 'construction' : 'operation');
        if (src._is_not_implemented) statuses.add('not_implemented');
        else if (src.M != null && src.G != null && !src._is_template) statuses.add('ready');
        else if (src._is_template) statuses.add('template');
        else statuses.add('pending');
    });

    const statusLabels = {
        'all': 'Все',
        'ready': '✅ Завершено',
        'pending': '⏳ Ожидает',
        'template': '⚠️ Шаблон',
        'not_implemented': '🚧 В разработке'
    };
    const scenarioLabels = {
        'all': 'Все',
        'operation': 'Эксплуатация',
        'construction': 'Строительство'
    };

    // P6: Filter controls bar
    let html = `
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:12px; padding:12px 16px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0;">
            <div style="display:flex; align-items:center; gap:6px;">
                <label style="font-size:0.75rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.03em;">Сценарий:</label>
                <select id="src-filter-scenario" class="cart-input" style="padding:5px 10px; font-size:0.8rem; min-width:140px; border-radius:6px;" onchange="window._applySourceFilter('${fac.id}')">
                    <option value="all" ${_sourceFilters.scenario === 'all' ? 'selected' : ''}>Все</option>
                    ${[...scenarios].map(s => `<option value="${s}" ${_sourceFilters.scenario === s ? 'selected' : ''}>${scenarioLabels[s] || s}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <label style="font-size:0.75rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.03em;">Статус:</label>
                <select id="src-filter-status" class="cart-input" style="padding:5px 10px; font-size:0.8rem; min-width:140px; border-radius:6px;" onchange="window._applySourceFilter('${fac.id}')">
                    <option value="all" ${_sourceFilters.status === 'all' ? 'selected' : ''}>Все</option>
                    ${[...statuses].map(s => `<option value="${s}" ${_sourceFilters.status === s ? 'selected' : ''}>${statusLabels[s] || s}</option>`).join('')}
                </select>
            </div>
            <div style="flex:1; min-width:150px;">
                <input type="text" id="src-filter-search" class="cart-input" placeholder="🔍 Поиск по названию..." value="${escapeHTML(_sourceFilters.search)}" style="width:100%; padding:5px 10px; font-size:0.8rem; border-radius:6px;" oninput="window._applySourceFilter('${fac.id}')">
            </div>
            <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem; border-radius:6px;" onclick="window._resetSourceFilters('${fac.id}')">Сбросить</button>
        </div>
    `;

    // Apply filters
    const filtered = fac.sources.filter(src => {
        const srcScenario = src.category === 'construction' ? 'construction' : 'operation';
        if (_sourceFilters.scenario !== 'all' && srcScenario !== _sourceFilters.scenario) return false;

        if (_sourceFilters.status !== 'all') {
            const isReady = src.M != null && src.G != null && !src._is_template;
            const isNotImpl = src._is_not_implemented;
            const isTemplate = src._is_template && !isNotImpl;
            const isPending = !isReady && !isNotImpl && !isTemplate;
            if (_sourceFilters.status === 'ready' && !isReady) return false;
            if (_sourceFilters.status === 'not_implemented' && !isNotImpl) return false;
            if (_sourceFilters.status === 'template' && !isTemplate) return false;
            if (_sourceFilters.status === 'pending' && !isPending) return false;
        }

        if (_sourceFilters.search) {
            const q = _sourceFilters.search.toLowerCase();
            const name = (src.name || '').toLowerCase();
            const num = (src.source_number || '').toLowerCase();
            if (!name.includes(q) && !num.includes(q)) return false;
        }

        return true;
    });

    const filteredCount = filtered.length;
    const totalCount = fac.sources.length;
    const isFiltered = _sourceFilters.scenario !== 'all' || _sourceFilters.status !== 'all' || _sourceFilters.search !== '';

    if (isFiltered) {
        html += `<div style="font-size:0.75rem; color:#64748b; margin-bottom:8px; padding-left:4px;">Показано: ${filteredCount} из ${totalCount} источников</div>`;
    }

    // P6: Updated Table columns
    html += `<div style="overflow-x:auto;">
        <table class="facility-sources-table">
        <thead>
            <tr><th>№</th><th>Наименование</th><th>Сценарий</th><th>Модуль</th><th>ЗВ</th><th>M (г/с)</th><th>G (т/год)</th><th>Статус</th><th style="width:100px;">Действия</th></tr>
        </thead>
        <tbody>
    `;
    
    if (filtered.length === 0) {
        html += `<tr><td colspan="9" style="text-align:center; padding:24px; color:#94a3b8; font-style:italic;">Нет источников, соответствующих фильтрам</td></tr>`;
    }
    
    filtered.forEach((src, idx) => {
        const num = src.source_number || `000${idx+1}`;
        const isReady = src.M != null && src.G != null && !src._is_template;
        const isNotImpl = src._is_not_implemented;
        
        let displayMethodic = src.methodic_name || '—';
        if (displayMethodic === '—' && src.methodic_id && window.getMethodicRegistry) {
            const m = window.getMethodicRegistry().find(reg => reg.id === src.methodic_id);
            if (m) displayMethodic = m.name;
        }

        let statusHtml = '';
        if (isNotImpl) {
            statusHtml = `<span style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">🚧 НЕТ В РЕЕСТРЕ</span>`;
        } else if (isReady) {
            statusHtml = `<span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">✅ ГОТОВО</span>`;
        } else if (src._is_template) {
            statusHtml = `<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">⚠️ ШАБЛОН</span>`;
        } else {
            statusHtml = `<span style="background:#e0f2fe; color:#075985; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">⏳ ОЖИДАЕТ</span>`;
        }

        const hasError = src.inputs && src.inputs._error;
        if (hasError) {
            statusHtml = `<span title="${escapeHTML(src.inputs._error)}" style="background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700; cursor:help;">❌ ОШИБКА</span>`;
        }
        
        const zvCount = src.composition ? src.composition.length : 0;
        const scenario = src.category === 'construction' ? 'Строительство' : 'Эксплуатация';

        let subtext = '';
        let moduleCellContent = `
            <div style="font-size:0.8rem; color:#334155; font-weight:500;">${escapeHTML(displayMethodic)}</div>
            <div style="color:#94a3b8; font-size:0.7rem; margin-top:2px;">Формула: ${src.formula_code || '—'}</div>
        `;

        if (isNotImpl) {
            subtext = `<div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Методика в разработке</div>`;
            moduleCellContent = `<div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">Расчёт не реализован</div>`;
        } else if (hasError) {
            subtext = `<div style="font-size:0.7rem; color:#ef4444; margin-top:4px; font-weight:600;">⚠️ Ошибка в структуре</div>`;
        } else if (src._is_template) {
            subtext = `<div style="font-size:0.7rem; color:#b45309; margin-top:4px;">Требуется заполнение</div>`;
        }

        html += `
            <tr style="${src._is_template || isNotImpl ? 'background:#fafaf9;' : ''}">
                <td style="color:var(--text-muted); font-size:0.8rem; font-weight:600;">${escapeHTML(num)}</td>
                <td style="font-weight:500;">
                    ${escapeHTML(src.name || 'Источник')}
                    ${subtext}
                </td>
                <td style="font-size:0.8rem; color:#64748b;">${scenario}</td>
                <td>${moduleCellContent}</td>
                <td style="font-size:0.85rem; color:#475569; text-align:center;">${zvCount}</td>
                <td style="color:${isReady ? '#047857' : '#94a3b8'}; font-weight:600;">${isReady ? (src.M || 0).toFixed(6) : '—'}</td>
                <td style="color:${isReady ? '#047857' : '#94a3b8'}; font-weight:600;">${isReady ? (src.G || 0).toFixed(6) : '—'}</td>
                <td style="text-align:center;">${statusHtml}</td>
                <td>
                    <div class="row-actions">
                        ${(src._is_template && !isNotImpl) ? 
                            `<button class="btn btn-primary" style="padding:4px 10px; font-size:0.75rem; border-radius:6px; font-weight:600;" onclick="startCalculationFromModule('${escapeHTML(fac.id)}', ProjectStore.getFacility('${escapeHTML(fac.id)}').sources.find(s => s.id === '${escapeHTML(src.id)}'))">Заполнить</button>` :
                            `<button class="btn-icon" 
                                    onclick="editSource('${escapeHTML(fac.id)}', '${escapeHTML(src.id)}')" 
                                    title="${isNotImpl ? 'Методика в разработке' : 'Редактировать параметры расчёта'}" 
                                    ${isNotImpl ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>✏️</button>`
                        }
                        <button class="btn-icon" onclick="duplicateSourceInFacility('${escapeHTML(fac.id)}', '${escapeHTML(src.id)}')" title="Копировать источник">⎘</button>
                        <button class="btn-icon" onclick="HistoryUI.renderSourceHistory('${escapeHTML(fac.id)}', '${escapeHTML(src.id)}')" title="История расчётов">📜</button>
                        <button class="btn-icon danger" onclick="deleteSourceFromFacility('${escapeHTML(fac.id)}', '${escapeHTML(src.id)}')" title="Удалить">✖</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;

    const emissionsComplete = fac.sources.length > 0 && fac.sources.every(s => s.M != null && s.G != null && !s._is_template);
    const hasSomeCalc = fac.sources.some(s => s.M != null && s.G != null);
    const calcDone = fac.sources.filter(s => s.M != null && s.G != null && !s._is_template).length;
    const calcTotal = fac.sources.length;

    html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding:16px 20px; background:white; border-radius:10px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="font-size:0.85rem; color:#64748b;">
                Завершено: <strong style="color:${emissionsComplete ? '#059669' : '#d97706'};">${calcDone} / ${calcTotal}</strong> источников
            </div>
            <div>
    `;
    if (!fac.sources.length) {
        html += `<button class="btn btn-secondary" disabled style="opacity:0.5; cursor:not-allowed;">🗺️ Перейти к рассеиванию</button>`;
    } else if (emissionsComplete) {
        html += `<button class="btn btn-primary" style="background:#10b981; border-color:#059669; padding:8px 20px;" onclick="GeoMeteoWorkspace.openWithContext('facility', '${escapeHTML(fac.id)}')">✅ Перейти к рассеиванию</button>`;
    } else if (hasSomeCalc) {
        html += `<button class="btn btn-secondary" style="border-color:#eab308; color:#a16207; padding:8px 20px;" onclick="if(confirm('⚠️ Выполнено ${calcDone} из ${calcTotal} источников — всё равно перейти?')) GeoMeteoWorkspace.openWithContext('facility', '${escapeHTML(fac.id)}')">🗺️ Перейти к рассеиванию (${calcDone}/${calcTotal})</button>`;
    } else {
        html += `<button class="btn btn-secondary" disabled style="opacity:0.5; cursor:not-allowed;" title="Сначала рассчитайте источники">🗺️ Перейти к рассеиванию</button>`;
    }
    html += `</div></div>`;

    container.innerHTML = html;
}

// P6: Filter helpers
window._applySourceFilter = function(facId) {
    _sourceFilters.scenario = document.getElementById('src-filter-scenario')?.value || 'all';
    _sourceFilters.status = document.getElementById('src-filter-status')?.value || 'all';
    _sourceFilters.search = document.getElementById('src-filter-search')?.value || '';
    const fac = ProjectStore.getFacility(facId);
    if (fac) renderFacilitySourcesTable(fac);
};

window._resetSourceFilters = function(facId) {
    _sourceFilters = { scenario: 'all', status: 'all', search: '' };
    const fac = ProjectStore.getFacility(facId);
    if (fac) renderFacilitySourcesTable(fac);
};

function renderFacilityPollutantTotals(fac) {
    const container = document.getElementById('fac-pollutant-totals-container');
    if (!container) return;
    
    const totals = ProjectStore.getFacilityTotals(fac.id);
    
    if (!totals.byPollutant || totals.byPollutant.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = `
        <div class="results-card" style="margin-top: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="margin:0;">Сводка по загрязняющим веществам</h4>
                <div style="font-size:0.8rem; color:#64748b;">ЗВ: ${totals.byPollutant.length} шт.</div>
            </div>
            <table class="results-table" style="font-size:0.85rem;">
                <thead>
                    <tr>
                        <th style="text-align:left;">Название вещества</th>
                        <th style="width:120px;">M (г/с)</th>
                        <th style="width:120px;">G (т/год)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    totals.byPollutant.forEach(p => {
        html += `
            <tr>
                <td style="font-weight:500;">${escapeHTML(p.name)}</td>
                <td style="color:#047857; font-weight:600;">${p.M.toFixed(6)}</td>
                <td style="color:#0f766e; font-weight:600;">${p.G.toFixed(6)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
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
                📁 Проект: ${escapeHTML(stateObj.name || 'Новый проект')}
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
        
        html += `<li class="tree-facility" data-facility-id="${escapeHTML(fac.id)}">
            <div class="tree-facility-header ${_selectedFacilityId === fac.id ? 'active' : ''}" onclick="toggleTreeFacility(event, '${escapeHTML(fac.id)}')">
                <span class="tree-chevron ${isExpanded ? 'expanded' : ''}">▶</span>
                <span class="tree-icon">${typeObj.icon}</span>
                <span class="tree-label">${escapeHTML(fac.name)}</span>
                <span class="tree-badge">${fac.sources ? fac.sources.length : 0}</span>
            </div>
            <div class="tree-sources" id="tree-sources-${fac.id}" style="display:${isExpanded ? 'block' : 'none'};">
        `;
        
        if (fac.sources) {
            fac.sources.forEach(src => {
                html += `
                <div class="tree-source" onclick="editSource('${escapeHTML(fac.id)}', '${escapeHTML(src.id)}')">
                    <span class="tree-dot">●</span>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(src.name || 'Источник')}</span>
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
    
    if (typeof renderFacilityTypeGrid === 'function') renderFacilityTypeGrid();
    if (typeof updatePhaseDesc === 'function') updatePhaseDesc();

    // Default coordinates from Project if available
    const pState = ProjectStore.getState();
    document.getElementById('fac-form-lat').value = pState.lat ? pState.lat.toFixed(6) : '';
    document.getElementById('fac-form-lng').value = pState.lng ? pState.lng.toFixed(6) : '';
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
    
    if (typeof renderFacilityTypeGrid === 'function') renderFacilityTypeGrid();
    if (typeof updatePhaseDesc === 'function') updatePhaseDesc();

    // Load Coordinates
    document.getElementById('fac-form-lat').value = fac.lat || '';
    document.getElementById('fac-form-lng').value = fac.lng || '';
    
    // Clear validation states
    ['fac-form-name', 'fac-form-lat', 'fac-form-lng'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.classList.remove('is-invalid', 'is-valid');
            const msg = input.parentElement.querySelector('.validation-message');
            if (msg) msg.textContent = '';
        }
    });
}

window.saveFacilityForm = function() {
    const id = document.getElementById('fac-form-id').value;
    const nameInput = document.getElementById('fac-form-name');
    const latInput = document.getElementById('fac-form-lat');
    const lngInput = document.getElementById('fac-form-lng');

    const nameVal = nameInput.value.trim();
    const latVal = latInput.value;
    const lngVal = lngInput.value;

    const resName = Validation.validateField({ required: true, label: 'Название объекта', type: 'text' }, nameVal);
    const resLat = Validation.validateField({ variable_id: 'lat', label: 'Широта' }, latVal);
    const resLng = Validation.validateField({ variable_id: 'lng', label: 'Долгота' }, lngVal);

    updateInlineValidation(nameInput, resName);
    updateInlineValidation(latInput, resLat);
    updateInlineValidation(lngInput, resLng);

    if (resName.state === Validation.STATES.INVALID || resLat.state === Validation.STATES.INVALID || resLng.state === Validation.STATES.INVALID) {
        showToast('Пожалуйста, исправьте ошибки в данных объекта', 'danger');
        return;
    }
    
    const data = {
        name: nameVal,
        type: document.getElementById('fac-form-type').value,
        phase: document.getElementById('fac-form-phase').value,
        address: document.getElementById('fac-form-address').value,
        description: document.getElementById('fac-form-desc').value,
        lat: parseFloat(latVal) || null,
        lng: parseFloat(lngVal) || null
    };
    
    if (id) {
        ProjectStore.updateFacility(id, data);
        showFacilityDashboard(id);
    } else {
        const newFac = ProjectStore.addFacility(data);
        showFacilityDashboard(newFac.id);
    }

    // Auto-meteorology fetch: If project has no active met data but we have coordinates, pull OpenMeteo
    const gmState = ProjectStore.getGeoMeteo();
    if (data.lat && data.lng && (!gmState.active_met_dataset_id || gmState.met_datasets.length === 0)) {
        // Silently sync project coordinates if they are empty
        const pState = ProjectStore.getState();
        if (!pState.lat || !pState.lng) {
            ProjectStore.setCoordinates(data.lat, data.lng);
        }
        
        console.log("Auto-triggering meteorology fetch for coordinates:", data.lat, data.lng);
        showToast("Загрузка метеоданных для локации...", "info");
        GeoMeteoWorkspace.fetchOpenMeteo();
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

window.renderFacilityTypeGrid = function() {
    const grid = document.getElementById('fac-form-type-grid');
    const hiddenInput = document.getElementById('fac-form-type');
    if (!grid) return;
    
    let html = '';
    FACILITY_TYPES.forEach(t => {
        const isSelected = hiddenInput.value === t.value;
        
        html += `
            <div class="facility-type-card ${isSelected ? 'active' : ''}" 
                 onclick="selectFacilityType('${t.value}')"
                 style="position:relative; border:2px solid ${isSelected ? '#4f46e5' : '#e2e8f0'}; background:${isSelected ? '#eff6ff' : 'white'}; border-radius:12px; padding:16px; cursor:pointer; text-align:center; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="font-size:2rem; margin-bottom:8px;">${t.icon}</div>
                <div style="font-size:0.85rem; font-weight:600; color:#1e293b; line-height:1.2;">${t.label}</div>
            </div>
        `;
    });
    grid.innerHTML = html;
    
};

window.selectFacilityType = function(val) {
    document.getElementById('fac-form-type').value = val;
    renderFacilityTypeGrid();
};

window.updatePhaseDesc = function() {
    const val = document.getElementById('fac-form-phase').value;
    const desc = document.getElementById('fac-form-phase-desc');
    if (!desc) return;
    if (val === 'operation') desc.textContent = "Повседневная работа: заправка, приём топлива, хранение";
    if (val === 'construction') desc.textContent = "Монтажные работы: земляные работы, сварка, покрытие";
    if (val === 'both') desc.textContent = "Расчёт для строительства и эксплуатации в одном проекте";
};

// Listen to phase changes
document.addEventListener('DOMContentLoaded', () => {
    const phaseSelect = document.getElementById('fac-form-phase');
    if (phaseSelect) {
        phaseSelect.addEventListener('change', window.updatePhaseDesc);
    }
});
