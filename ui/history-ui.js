/**
 * history-ui.js — Calculation History UI Component
 * Renders the timeline of immutable snapshots for a source.
 */
const HistoryUI = (() => {

    function renderSourceHistory(facilityId, sourceId) {
        const fac = ProjectStore.getFacility(facilityId);
        const src = fac ? fac.sources.find(s => s.id === sourceId) : null;
        if (!src) return;

        // Show loading state in a modal
        const modal = createHistoryModal(src.name || 'Источник');
        modal.style.display = 'flex';
        
        const container = document.getElementById('history-timeline-container');
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">⏳ Загрузка истории расчётов...</div>';

        ProjectStore.getCalculationHistory(sourceId).then(history => {
            if (!history || history.length === 0) {
                container.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #64748b;">
                        <div style="font-size: 2rem; margin-bottom: 16px;">📂</div>
                        <p>История расчётов пуста.</p>
                        <p style="font-size: 0.8rem;">Снимки создаются автоматически при сохранении готовых расчётов.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = '';
            
            history.forEach((snap, idx) => {
                const data = snap.snapshot_data;
                const isLatest = idx === 0;
                
                const item = document.createElement('div');
                item.className = 'history-item';
                item.style.cssText = `
                    padding: 16px;
                    border: 1px solid ${isLatest ? 'var(--primary)' : '#e2e8f0'};
                    border-radius: 12px;
                    margin-bottom: 12px;
                    background: ${isLatest ? '#f0f9ff' : 'white'};
                    position: relative;
                `;

                const dateStr = new Date(snap.created_at).toLocaleString('ru-RU');
                
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
                                ${isLatest ? '✨ Текущая версия' : `Версия от ${dateStr}`}
                            </div>
                            <div style="font-size: 1.1rem; font-weight: 700; color: #0f172a;">
                                M = ${data.M.toFixed(6)} г/с | G = ${data.G.toFixed(6)} т/год
                            </div>
                            <div style="font-size: 0.8rem; color: #475569; margin-top: 4px;">
                                Методика: ${escapeHTML(data.methodic_id || '—')} | Код: ${escapeHTML(data.formula_code || '—')}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="HistoryUI.viewSnapshot('${snap.id}')">📊 Просмотр</button>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        });
    }

    function createHistoryModal(sourceName) {
        let modal = document.getElementById('history-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'history-modal';
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                z-index: 9500; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
                display: none; align-items: center; justify-content: center;
            `;
            modal.innerHTML = `
                <div style="background: white; width: 90%; max-width: 600px; max-height: 85vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                    <div style="padding: 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.25rem; color: #0f172a;">История расчётов</h3>
                            <div id="history-modal-subtitle" style="font-size: 0.85rem; color: #64748b; margin-top: 4px;"></div>
                        </div>
                        <button class="btn btn-secondary" onclick="document.getElementById('history-modal').style.display='none'">Закрыть</button>
                    </div>
                    <div id="history-timeline-container" style="flex: 1; overflow: auto; padding: 24px; background: #f1f5f9;"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        document.getElementById('history-modal-subtitle').textContent = sourceName;
        return modal;
    }

    function viewSnapshot(snapshotId) {
        // Future: Load snapshot into a Readonly Wizard view
        showToast('Просмотр архивных снимков будет доступен в следующем обновлении.', 'info');
    }

    return { renderSourceHistory, viewSnapshot };
})();
