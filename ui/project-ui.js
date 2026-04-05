// --- PROJECT UI MODULE ---\n// ========================================================================
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
            updateReportReadiness();
        });
    }

    if (companyInput) {
        companyInput.addEventListener('input', (e) => {
            const val = e.target.value;
            ProjectStore.setProjectMeta({ company: val });
            const res = Validation.validateField({ required: true, label: 'Заказчик', type: 'text' }, val);
            updateInlineValidation(companyInput, res);
            updateReportReadiness();
        });
    }

    if (licenseInput) {
        licenseInput.addEventListener('input', (e) => {
            const val = e.target.value;
            ProjectStore.setProjectMeta({ license: val });
            const res = Validation.validateField({ required: true, label: 'Лицензия', type: 'text' }, val);
            updateInlineValidation(licenseInput, res);
            updateReportReadiness();
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
    
    initUtilityPanels();
}

// Utility Panel Logic (Removed for Clean UI)
function initUtilityPanels() {
    // No-op - moved logic or deleted
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
 * BREADCRUMBS (Global UX)
 */
function renderBreadcrumbs(path = []) {
    const gb = document.getElementById('global-breadcrumb');
    if (!gb) return;
    
    let html = `<li><a href="#" onclick="showProjectDashboard(); return false;">Проекты</a></li>`;
    path.forEach((p, idx) => {
        const isLast = idx === path.length - 1;
        if (isLast) {
            html += `<li class="active">${p.label}</li>`;
        } else {
            html += `<li><a href="#" onclick="${p.action}; return false;">${p.label}</a></li>`;
        }
    });
    gb.innerHTML = html;
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
    
    const container = document.getElementById('facility-dashboard');
    container.innerHTML = `
        <div class="facility-dashboard-header">
            <div>
                <h2 style="margin:0; font-size:1.6rem;">${typeObj.icon} ${escapeHTML(fac.name)}</h2>
                <div style="color:var(--text-muted); margin-top:4px;">${typeObj.label} • ${fac.phase === 'operation' ? 'Эксплуатация' : 'Строительство'}</div>
            </div>
            <div class="actions" style="display:flex; gap:12px;">
                <button class="btn btn-secondary" onclick="GeoMeteoWorkspace.openWithContext('facility', '${escapeHTML(fac.id)}')">🗺️ Карта</button>
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
                <td style="color:var(--text-muted); font-size:0.8rem; font-weight:600;">${escapeHTML(num)}</td>
                <td style="font-weight:500;">${escapeHTML(src.name || 'Безымянный источник')}</td>
                <td style="font-size:0.8rem; color:#64748b;">${escapeHTML(src.methodic_name)}</td>
                <td style="font-size:0.8rem;">${src.formula_code || '—'}</td>
                <td style="color:#047857; font-weight:600;">${(src.M || 0).toFixed(6)}</td>
                <td style="color:#047857; font-weight:600;">${(src.G || 0).toFixed(6)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-icon" onclick="editSource('${escapeHTML(fac.id)}', '${escapeHTML(src.id)}')" title="Редактировать">✏️</button>
                        <button class="btn-icon" onclick="duplicateSourceInFacility('${escapeHTML(fac.id)}', '${escapeHTML(src.id)}')" title="Копировать">⎘</button>
                        <button class="btn-icon danger" onclick="deleteSourceFromFacility('${escapeHTML(fac.id)}', '${escapeHTML(src.id)}')" title="Удалить">✖</button>
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


