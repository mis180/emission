/**
 * app.js — Data-driven emissions calculator
 *
 * Thin orchestrator that wires the engine modules (Wizard, Evaluator, Lookup)
 * to the UI. No hardcoded scenarios or formulas — everything comes from JSON.
 */

// --- APP STATE --- //
const APP_VERSION = '1.0.1';
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

// --- UTILITIES --- //
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- INITIALIZATION --- //
async function init() {
    btnNext.addEventListener('click', handleNext);
    btnPrev.addEventListener('click', handlePrev);

    // Fetch recent projects for the landing screen
    const projects = await ProjectStore.listProjects();
    renderRecentProjects(projects);

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
    
    // Don't auto-load the project state if we are still on the landing screen!
    // openProject() will be called when the user clicks a project.

    // Global Error Handling for Async Errors
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        showToast('Произошла системная ошибка: ' + (event.reason.message || event.reason), 'danger');
    });

    // Check initial auth state
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            // Not logged in, the auth state listener will handle showing the login screen
            console.log('No active session.');
        } else {
            console.log('Active session found.');
            // auth listener will handle the rest
        }
    });
}

/**
 * AUTHENTICATION HANDLERS
 */
async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';

    if (!email || !password) {
        errorEl.textContent = 'Введите email и пароль';
        errorEl.style.display = 'block';
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        errorEl.textContent = 'Ошибка: ' + error.message;
        errorEl.style.display = 'block';
    }
}

async function handleSignup() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';

    if (!email || !password) {
        errorEl.textContent = 'Введите email и пароль';
        errorEl.style.display = 'block';
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    
    if (error) {
        errorEl.textContent = 'Ошибка: ' + error.message;
        errorEl.style.display = 'block';
    } else {
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            errorEl.textContent = 'Этот email уже зарегистрирован. Выполните вход.';
            errorEl.style.display = 'block';
        } else {
             showToast('Аккаунт создан! Теперь вы в системе.', 'info');
        }
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
}

/**
 * LANDING PAGE ACTIONS (Step 1)
 */
function selectProfile(type) {
    const avatars = document.querySelectorAll('.profile-avatar');
    avatars.forEach(a => a.classList.remove('active'));
    event.currentTarget.classList.add('active');
    state.currentProfile = type;
    showToast(`Профиль изменен: ${type}`, 'info');
}

function startNewProjectWorkflow() {
    ProjectStore.clear();
    // Default name
    ProjectStore.setName("Новый отчет " + new Date().toLocaleDateString());
    
    // Refresh UI before showing
    const loadedState = ProjectStore.getState();
    document.getElementById('project-name').value = loadedState.name;
    document.getElementById('project-company').value = "";
    document.getElementById('project-license').value = "";
    document.getElementById('header-project-name').textContent = loadedState.name;
    
    renderProjectTree();
    
    // Transition to App
    document.getElementById('landing-screen').style.display = 'none';
    document.getElementById('main-app-container').style.display = 'grid';
    
    // Open project creation wizard dashboard (Step 3)
    showProjectDashboard();
    
    // Scroll to metadata form
    const metaCard = document.querySelector('.project-meta-card');
    if (metaCard) metaCard.scrollIntoView({ behavior: 'smooth' });
    
    showToast('Начните с настройки данных проекта', 'info');
}

async function openProject(projectId) {
    if (projectId) {
        await ProjectStore.switchProject(projectId);
    } else {
        await ProjectStore.load(); // loads last open
    }
    
    // Refresh global UI with loaded state
    const loadedState = ProjectStore.getState();
    
    // Update basic fields
    const nameInput = document.getElementById('project-name');
    if (nameInput) nameInput.value = loadedState.name || "";
    
    const companyInput = document.getElementById('project-company');
    if (companyInput) companyInput.value = loadedState.company || "";
    
    const licenseInput = document.getElementById('project-license');
    if (licenseInput) licenseInput.value = loadedState.license || "";
    
    const headerName = document.getElementById('header-project-name');
    if (headerName) headerName.textContent = loadedState.name || "Новый проект";
    
    // Refresh sidebar and main view
    renderProjectTree();

    document.getElementById('landing-screen').style.display = 'none';
    document.getElementById('main-app-container').style.display = 'grid';
    
    showProjectDashboard();
    showToast('Проект загружен', 'info');
}

function exitToLanding() {
    document.getElementById('main-app-container').style.display = 'none';
    document.getElementById('landing-screen').style.display = 'flex';
    
    // Refresh list
    ProjectStore.listProjects().then(projects => {
        renderRecentProjects(projects);
    });
}

async function deleteProjectAndRefresh(id, event) {
    if (event) event.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить этот проект? Это действие необратимо.')) return;
    
    await ProjectStore.deleteProject(id);
    const projects = await ProjectStore.listProjects();
    renderRecentProjects(projects);
    showToast('Проект удален', 'warning');
}

function renderRecentProjects(projects) {
    const list = document.getElementById('recent-projects-container');
    if (!list) return;
    
    if (projects.length === 0) {
        list.innerHTML = '<div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">Нет недавних проектов. Нажмите "Новый проект".</div>';
        return;
    }
    
    list.innerHTML = projects.map(p => `
        <div class="action-card recent-project-item" onclick="openProject('${p.id}')" style="width:100%; border:1px solid #e2e8f0; padding:12px 16px; border-radius:8px; cursor:pointer; position:relative; display:flex; justify-content:space-between; align-items:center; transition: all 0.2s;" title="Открыть">
            <div style="flex:1;">
                <div style="font-weight:600; color:#1e293b; font-size:0.95rem; margin-bottom:2px;">${escapeHTML(p.name)}</div>
                <div style="font-size:0.75rem; color:#64748b;">Изменен: ${new Date(p.date_modified).toLocaleString()}</div>
            </div>
            <button class="btn-icon-only" onclick="deleteProjectAndRefresh('${p.id}', event)" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; padding:4px;" title="Удалить">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        </div>
    `).join('');
}

// Region and Weather logic removed.

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
        return katex.renderToString(latex, { throwOnError: false, strict: "ignore" });
    } catch (e) {
        console.warn('KaTeX rendering error:', e);
        return latex;
    }
};



// Start
document.addEventListener('DOMContentLoaded', init);


// ------ VIEW SWITCHING LOGIC ------
function switchPane(paneId) {
    const panes = ['project-dashboard', 'facility-dashboard', 'facility-form-pane', 'calculator-wizard', 'project-validation-pane', 'report-setup-pane', 'report-success-pane'];
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
// switchSidebarTab removed



