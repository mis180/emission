// --- VALIDATION & REPORT UI MODULE ---
/**
 * Step 15: Project Validation View
 */
function showProjectValidation() {
    switchPane('project-validation-pane');
    
    const state = ProjectStore.getState();
    const facilities = state.facilities || [];
    const totals = ProjectStore.getProjectTotals();
    
    // 1. Facilities Summary
    const facSummary = document.getElementById('validation-facilities-summary');
    if (facSummary) {
        facSummary.innerHTML = facilities.map(f => {
            const typeObj = FACILITY_TYPES.find(t => t.value === f.type) || FACILITY_TYPES[FACILITY_TYPES.length-1];
            const facTotals = ProjectStore.getFacilityTotals(f.id);
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f1f5f9;">
                    <div>
                        <span style="font-size:1.2rem; margin-right:8px;">${typeObj.icon}</span>
                        <span style="font-weight:600;">${f.name}</span>
                        <div style="font-size:0.75rem; color:#64748b; margin-left:28px;">${f.sources ? f.sources.length : 0} источников</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.85rem; font-weight:700;">${facTotals.G.toFixed(4)} т/год</div>
                        <div style="font-size:0.7rem; color:#94a3b8;">${facTotals.M.toFixed(4)} г/с</div>
                    </div>
                </div>
            `;
        }).join('') || '<p style="color:#ef4444;">Объекты не найдены. Вернитесь назад и добавьте хотя бы один объект.</p>';
    }
    
    // 2. Sources Registry
    const srcRegistry = document.getElementById('validation-sources-registry');
    if (srcRegistry) {
        let html = `
            <table class="results-table" style="font-size:0.8rem;">
                <thead>
                    <tr><th>Название</th><th>Методика</th><th>G (т/г)</th><th>M (г/с)</th></tr>
                </thead>
                <tbody>
        `;
        facilities.forEach(f => {
            if (f.sources) {
                f.sources.forEach(s => {
                    html += `
                        <tr>
                            <td>${s.name} <br><small style="color:#94a3b8;">(${f.name})</small></td>
                            <td><small>${s.methodic_id || '—'}</small></td>
                            <td style="font-weight:600;">${(s.G || 0).toFixed(6)}</td>
                            <td>${(s.M || 0).toFixed(6)}</td>
                        </tr>
                    `;
                });
            }
        });
        html += `</tbody></table>`;
        srcRegistry.innerHTML = html;
    }
    
    // 3. Grand Totals
    const grandTotals = document.getElementById('validation-grand-totals');
    if (grandTotals) {
        grandTotals.innerHTML = `
            <div style="margin-bottom:16px;">
                <div style="font-size:0.8rem; color:#64748b;">Суммарный валовый выброс (ΣG):</div>
                <div style="font-size:1.8rem; font-weight:800; color:var(--primary);">${totals.totalG.toFixed(6)} <small style="font-weight:400; font-size:0.9rem;">т/год</small></div>
            </div>
            <div>
                <div style="font-size:0.8rem; color:#64748b;">Максимальный разовый выброс (ΣM):</div>
                <div style="font-size:1.4rem; font-weight:700; color:#1e293b;">${totals.totalM.toFixed(6)} <small style="font-weight:400; font-size:0.8rem;">г/с</small></div>
            </div>
        `;
    }
}

/**
 * Step 16: Report Setup
 */
function showReportSetup() {
    switchPane('report-setup-pane');
    // Pre-fill date
    const dateInput = document.getElementById('report-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

/**
 * Step 17/18: Final Generation & Success
 */
async function generateFinalReport() {
    const btn = document.getElementById('btn-generate-final-pdf');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '⌛ Сборка документа...';
        
        const options = {
            lang: document.getElementById('report-lang').value,
            signatory: document.getElementById('report-signatory').value,
            position: document.getElementById('report-position').value,
            date: document.getElementById('report-date').value
        };
        
        const state = ProjectStore.getState();
        
        // Connect to ReportGenerator (Assumed to be in separate file reportGenerator.js)
        if (typeof ReportGenerator === 'undefined') {
            throw new Error("Модуль генерации отчетов не найден. Проверьте подключение reportGenerator.js");
        }
        
        const pdfBlob = await ReportGenerator.generateProjectPDF(state, options);
        const url = URL.createObjectURL(pdfBlob);
        
        // Show success
        switchPane('report-success-pane');
        const downloadBtn = document.getElementById('report-download-link');
        downloadBtn.href = url;
        downloadBtn.download = `Emission_Report_${state.name || 'Project'}_${options.date}.pdf`;
        
        showToast("Отчет успешно сформирован", "success");
        
    } catch (e) {
        console.error(e);
        showToast("Ошибка при генерации отчета: " + e.message, "danger");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}




