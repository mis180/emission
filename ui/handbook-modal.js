// --- HANDBOOK MODAL MODULE ---
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

    titleEl.innerHTML = `${escapeHTML(title)} <span style="font-size:0.75em; color:#64748b; font-weight:400; margin-left:12px;">${escapeHTML(tableId)} &bull; ${escapeHTML(lookupType)} &bull; ${rowCount} rows${sourceDoc ? ' &bull; ' + escapeHTML(sourceDoc) : ''}</span>`;
    
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


