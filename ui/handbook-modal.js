// --- HANDBOOK MODAL MODULE ---
/**
 * Handbook Table Modal Logic
 */
let _currentHandbookTable = null;
let _currentHandbookImagePath = null;

function normalizeHandbookAssetPath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/\/+$/, '');
}

function getHandbookImagePath(table) {
    if (!table || !state.methodicPath) return null;

    // 0. Shared Catalog Evidence (New Model)
    if (table.source && table.source.image_ref) {
        let ref = table.source.image_ref;
        // If it's a bundled asset, it lives in the build/ directory
        if (ref.startsWith('assets/')) {
            ref = 'build/' + ref;
        }
        return `${normalizeHandbookAssetPath(state.methodicPath)}/${ref}`;
    }

    // A: Support data-driven evidence mapping (Legacy/Systematic)
    if (table.evidence && table.evidence.image) {
        return `${normalizeHandbookAssetPath(state.methodicPath)}/lookup_tables/${table.evidence.image}`;
    }

    // B: Support explicit image field (Legacy)
    if (table.image) {
        return `${normalizeHandbookAssetPath(state.methodicPath)}/lookup_tables/${table.image}`;
    }

    const tableId = table.table_id || table.id || '';
    let appendixNumber = null;

    // C: Robust pattern matching for Appendix-based tables
    const appendixMatch = tableId.match(/^Table_App_(\d+)/i) || 
                         tableId.match(/^Table_Appendix_(\d+)/i) ||
                         tableId.match(/^App_(\d+)/i);

    if (appendixMatch) {
        appendixNumber = appendixMatch[1];
    } else if (/^Table_12/i.test(tableId)) {
        appendixNumber = '12';
    } else if (/^Table_15/i.test(tableId)) {
        appendixNumber = '15';
    }

    if (!appendixNumber) return null;
    return `${normalizeHandbookAssetPath(state.methodicPath)}/lookup_tables/app_${appendixNumber}.png`;
}

function handbookImageExists(path) {
    return new Promise((resolve) => {
        if (!path) {
            resolve(false);
            return;
        }

        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = encodeURI(path);
    });
}

async function openHandbookModal(tableId, startWithImage = false) {
    if (!tableId || !state.methodicData || !state.methodicData.tables) return;

    const tablesArray = state.methodicData.tables.tables || [];
    let table = tablesArray.find(t => t.table_id === tableId || t.id === tableId);

    if (!table) {
        table = tablesArray.find(t => t.id === `Table-${tableId}`) ||
            tablesArray.find(t => t.id === `table_${tableId}`) ||
            tablesArray.find(t => t.id === tableId.replace('-', '_')) ||
            tablesArray.find(t => t.table_id === tableId);
    }

    _currentHandbookTable = table;
    _currentHandbookImagePath = null;
    let forceImage = startWithImage;

    if (!table || !table.rows) {
        showToast(`Таблица "${tableId}" не найдена или пуста.`, 'danger');
        return;
    }

    const modal = document.getElementById('handbook-modal');
    const container = document.getElementById('handbook-table-container');
    const titleEl = document.getElementById('handbook-title');

    const title = table.title || table.id || table.table_id;
    const lookupType = table.resolution || 'exact';
    const sourceDoc = table.source
        ? (typeof table.source === 'string' ? table.source : table.source.document || '')
        : '';
    const tableData = table.rows;
    const columns = tableData && tableData.length > 0 ? Object.keys(tableData[0]) : [];
    const rowCount = tableData ? tableData.length : 0;
    const tableKey = table.table_id || table.id || tableId;

    let sortCol = null;
    let sortAsc = true;
    let searchQuery = '';

    modal.style.display = 'flex';
    container.innerHTML = '<div style="padding:24px; color:#64748b;">Загрузка справочника...</div>';

    const candidateImagePath = getHandbookImagePath(table);
    const hasImage = candidateImagePath ? await handbookImageExists(candidateImagePath) : false;
    _currentHandbookImagePath = hasImage ? candidateImagePath : null;

    function renderHeader() {
        const evidenceSection = (table.source && table.source.section)
            ? table.source.section
            : ((table.source && table.source.page) ? `стр. ${table.source.page}` : null);
        const evidenceDoc = (table.source && table.source.document) ? table.source.document : '';
        
        const pdfRef = (state.methodicData && state.methodicData.meta && state.methodicData.meta.source_pdf)
            ? state.methodicData.meta.source_pdf
            : 'reference/2011_fuel_stations.pdf';
        
        const pdfs = Array.isArray(pdfRef) ? pdfRef : [pdfRef];
        const pdfLink = `${normalizeHandbookAssetPath(state.methodicPath)}/${pdfs[0]}`;

        const activeTab = (_currentHandbookImagePath && (forceImage || !tableData || tableData.length === 0)) ? 'image' : 'table';
        const tabs = hasImage ? `
            <div class="handbook-tabs" style="display:flex; border-bottom:1px solid #e2e8f0; margin: 12px 0;">
                <div class="handbook-tab ${activeTab === 'table' ? 'active' : ''}" 
                     onclick="forceImage=false; renderHeader(); renderTableView();" 
                     style="padding:8px 16px; cursor:pointer; font-weight:600; font-size:0.9rem; border-bottom:2px solid ${activeTab === 'table' ? '#3b82f6' : 'transparent'}; color:${activeTab === 'table' ? '#3b82f6' : '#64748b'};">
                     📊 Данные
                </div>
                <div class="handbook-tab ${activeTab === 'image' ? 'active' : ''}" 
                     onclick="forceImage=true; renderHeader(); renderImageView();" 
                     style="padding:8px 16px; cursor:pointer; font-weight:600; font-size:0.9rem; border-bottom:2px solid ${activeTab === 'image' ? '#3b82f6' : 'transparent'}; color:${activeTab === 'image' ? '#3b82f6' : '#64748b'};">
                     🖼️ Изображение
                </div>
            </div>
        ` : '';

        titleEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; width:100%;">
                <div>
                    ${escapeHTML(title)}
                    <span style="font-size:0.75em; color:#64748b; font-weight:400; margin-left:12px;">
                        ${escapeHTML(tableKey)} &bull; ${escapeHTML(lookupType)} &bull; ${rowCount} rows
                        ${sourceDoc || evidenceDoc ? ' &bull; ' + escapeHTML(sourceDoc || evidenceDoc) : ''}
                        ${evidenceSection ? ' &bull; ' + escapeHTML(evidenceSection) : ''}
                    </span>
                </div>
                <div>
                    <a href="${pdfLink}" target="_blank" class="btn btn-secondary" style="font-size:0.8rem; padding:6px 12px; text-decoration:none; display:flex; align-items:center; gap:8px;">
                        <span>📄</span> PDF
                    </a>
                </div>
            </div>
            ${tabs}
        `;
    }

    function renderImageView() {
        if (!_currentHandbookImagePath) {
            renderHeader();
            renderTableView();
            return;
        }

        const encodedPath = encodeURI(_currentHandbookImagePath);

        container.innerHTML = `
            <div style="border:1px solid #e2e8f0; border-radius:16px; background:#f8fafc; padding:16px; overflow:auto;">
                <img
                    src="${encodedPath}"
                    alt="${escapeHTML(title)}"
                    style="display:block; max-width:100%; height:auto; margin:0 auto; border-radius:10px; box-shadow:0 12px 32px rgba(15, 23, 42, 0.12);"
                >
            </div>
        `;

        const imageEl = container.querySelector('img');
        if (imageEl) {
            imageEl.addEventListener('error', () => {
                _currentHandbookImagePath = null;
                renderHeader();
                renderTableView();
            }, { once: true });
        }
    }

    function renderTableView() {
        let filteredData = tableData;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredData = filteredData.filter(row =>
                columns.some(col => String(row[col] ?? '').toLowerCase().includes(query))
            );
        }

        if (sortCol) {
            filteredData = [...filteredData].sort((a, b) => {
                const valueA = a[sortCol];
                const valueB = b[sortCol];
                if (typeof valueA === 'number' && typeof valueB === 'number') {
                    return sortAsc ? valueA - valueB : valueB - valueA;
                }
                return sortAsc
                    ? String(valueA ?? '').localeCompare(String(valueB ?? ''))
                    : String(valueB ?? '').localeCompare(String(valueA ?? ''));
            });
        }

        const inputKeys = new Set(
            (table.selectors || []).map(k => typeof k === 'string' ? k : k.name)
        );
        if (table.axis) inputKeys.add(table.axis.name);

        const outputKeys = new Set(
            (table.outputs || []).map(o => typeof o === 'string' ? o : o.name)
        );

        const unitsMap = {};
        if (table.outputs) table.outputs.forEach(output => { unitsMap[output.name] = output.unit_id; });
        if (table.selectors) table.selectors.forEach(key => { unitsMap[key.name] = key.unit_id; });
        if (table.axis) unitsMap[table.axis.name] = table.axis.unit_id;

        let html = `<div style="display:flex; gap:12px; margin-bottom:16px; align-items:center;">
            <input type="text" id="handbook-search" placeholder="Поиск по таблице..." value="${escapeHTML(searchQuery)}"
                style="flex:1; padding:8px 12px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.9rem;">
            <span style="font-size:0.85rem; color:#64748b;">${filteredData.length} из ${rowCount} строк</span>
        </div>`;

        html += '<table class="handbook-view-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">';
        html += '<thead><tr>';
        columns.forEach(col => {
            const isInput = inputKeys.has(col);
            const isOutput = outputKeys.has(col);
            const unit = unitsMap[col];
            const sortIndicator = sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';
            const colStyle = isInput
                ? 'background:#eff6ff; color:#1d4ed8;'
                : (isOutput ? 'background:#f0fdf4; color:#166534;' : '');

            html += `<th data-col="${escapeHTML(col)}" style="cursor:pointer; padding:12px 10px; border-bottom:2px solid #e2e8f0; text-align:left; user-select:none; ${colStyle} font-weight:600; white-space:nowrap;">
                ${escapeHTML(col)}${sortIndicator}
                ${isInput ? ' <span style="font-size:0.7em; opacity:0.7;">[key]</span>' : ''}
                ${isOutput ? ' <span style="font-size:0.7em; opacity:0.7;">[out]</span>' : ''}
                ${unit ? `<div style="font-size:0.7rem; font-weight:400; opacity:0.6;">${escapeHTML(unit)}</div>` : ''}
            </th>`;
        });
        html += '</tr></thead><tbody>';

        filteredData.forEach(row => {
            const originalIndex = tableData.indexOf(row);
            html += '<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">';
            columns.forEach(col => {
                const value = row[col];
                const displayValue = value == null ? '—' : escapeHTML(value);
                const isEditable = outputKeys.has(col) || inputKeys.has(col);
                const safeColumn = JSON.stringify(col);

                html += `<td style="padding:6px 10px; ${isEditable ? 'cursor:pointer;' : ''}"
                    ${isEditable ? `ondblclick='handbookEditCell(this, ${originalIndex}, ${safeColumn})' title="Двойной клик для редактирования"` : ''}>
                    ${displayValue}
                </td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';

        container.innerHTML = html;
        container.scrollTop = 0;

        const searchInput = document.getElementById('handbook-search');
        if (searchInput) {
            searchInput.addEventListener('input', event => {
                searchQuery = event.target.value;
                renderTableView();
            });
            searchInput.focus();
            searchInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }

        container.querySelectorAll('th[data-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-col');
                if (sortCol === col) {
                    sortAsc = !sortAsc;
                } else {
                    sortCol = col;
                    sortAsc = true;
                }
                renderTableView();
            });
        });
    }

    function renderActiveView() {
        if (_currentHandbookImagePath && (forceImage || !tableData)) {
            renderImageView();
        } else {
            renderTableView();
        }
    }

    renderHeader();
    renderActiveView();
}

/**
 * In-session cell editing for handbook modal tables.
 * User can double-click a cell to edit its value.
 * Changes update state.methodicData.tables in memory (session only).
 */
function handbookEditCell(td, rowIndex, colName) {
    if (!_currentHandbookTable) return;
    const tableData = _currentHandbookTable.rows;
    if (!tableData || !tableData[rowIndex]) return;

    const currentVal = tableData[rowIndex][colName];
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
            tableData[rowIndex][colName] = input.type === 'number' ? newVal : input.value;
            td.textContent = input.type === 'number' ? newVal : input.value;
            td.style.background = '#fef3c7';
            td.title = `Изменено (было: ${currentVal})`;

            if (state.methodicData && state.inputs) {
                Wizard.runAutoLookups(state.methodicData, state.inputs);
                if (typeof runCalculationsAndRenderResults === 'function' && currentStep === 5) {
                    runCalculationsAndRenderResults();
                }
            }
            showToast(`Значение обновлено: ${colName} = ${td.textContent}`, 'info');
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
