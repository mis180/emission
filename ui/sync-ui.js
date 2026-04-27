/**
 * sync-ui.js — Sync Status & Conflict Resolution UI
 */
const SyncUI = (() => {

    function init() {
        // Listen for sync status changes
        window.addEventListener('emission-sync-status-changed', (e) => {
            updateStatusIndicator(e.detail);
        });

        // Listen for conflict detection
        window.addEventListener('emission-conflict-detected', (e) => {
            showConflictModal(e.detail.projectId);
        });
    }

    function updateStatusIndicator(state) {
        const el = document.getElementById('sync-status-indicator');
        if (!el) return;

        let icon = '☁️';
        let color = '#94a3b8'; // grey
        let title = 'Автономный режим';

        switch (state.status) {
            case 'syncing':
                icon = '⏳';
                color = '#3b82f6'; // blue
                title = 'Синхронизация...';
                break;
            case 'synced':
                icon = '✅';
                color = '#22c55e'; // green
                title = `Сохранено в облаке: ${new Date(state.lastSynced).toLocaleTimeString()}`;
                break;
            case 'conflict':
                icon = '⚠️';
                color = '#f59e0b'; // orange
                title = 'Конфликт версий!';
                break;
            case 'error':
                icon = '❌';
                color = '#ef4444'; // red
                title = `Ошибка: ${state.error}`;
                break;
            case 'offline':
                icon = '☁️';
                color = '#94a3b8';
                title = 'Оффлайн (сохранено локально)';
                break;
        }

        el.innerHTML = icon;
        el.style.color = color;
        el.title = title;
    }

    function showConflictModal(projectId) {
        let modal = document.getElementById('conflict-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'conflict-modal';
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                z-index: 10000; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
                display: flex; align-items: center; justify-content: center;
            `;
            modal.innerHTML = `
                <div style="background: white; width: 90%; max-width: 450px; padding: 32px; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
                    <h3 style="margin: 0 0 12px; font-size: 1.25rem; color: #0f172a;">Конфликт версий</h3>
                    <p style="color: #64748b; font-size: 0.95rem; line-height: 1.5; margin-bottom: 24px;">
                        Проект был изменен другим пользователем или в другой вкладке. Ваши локальные изменения могут перезаписать чужую работу.
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button class="btn btn-primary" onclick="SyncUI.resolveConflict('overwrite')" style="width:100%;">Перезаписать версию на сервере</button>
                        <button class="btn btn-secondary" onclick="SyncUI.resolveConflict('reload')" style="width:100%;">Загрузить версию с сервера (потерять локальные)</button>
                        <button class="btn btn-secondary" onclick="document.getElementById('conflict-modal').remove()" style="width:100%; opacity: 0.7;">Отмена</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }

    function resolveConflict(choice) {
        const modal = document.getElementById('conflict-modal');
        if (modal) modal.remove();

        if (choice === 'overwrite') {
            showToast('Сохраняем поверх серверной версии...', 'info');
            // Re-save ignoring conflict by temporarily clearing the base version
            // (A more robust way would be a specific flag in _cloudSave)
            ProjectStore.save(true); 
        } else if (choice === 'reload') {
            window.location.reload();
        }
    }

    return { init, resolveConflict };
})();
