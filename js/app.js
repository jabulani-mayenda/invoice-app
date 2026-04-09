/* ============================================
   KWEZA – APP ROUTER & INITIALIZATION
   ============================================ */

// ── Global Toast ──
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}
window.showToast = showToast;

// ── Modal ──
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) { overlay.classList.remove('active'); overlay.innerHTML = ''; }
}
window.closeModal = closeModal;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', e => {
  const overlay = document.getElementById('modal-overlay');
  if (overlay && e.target === overlay) closeModal();
});

// ── ROUTER ──
const ROUTES = {
  dashboard:  () => window.KwezaPages.renderDashboard(),
  clients:    () => window.KwezaPages.renderClients().then(() => window.KwezaPages.loadClientStats()),
  catalog:    () => window.KwezaPages.renderCatalog(),
  quotations: (sub) => window.KwezaPages.renderQuotations(sub),
  invoices:   (sub) => window.KwezaPages.renderInvoices(sub),
  loans:      (sub) => window.KwezaPages.renderLoans(sub),
  reports:    () => window.KwezaPages.renderReports(),
  settings:   () => window.KwezaPages.renderSettings(),
};

const PAGE_IDS = {
  dashboard:  'dashboard-page',
  clients:    'clients-page',
  catalog:    'catalog-page',
  quotations: 'quotations-page',
  invoices:   'invoices-page',
  loans:      'loans-page',
  reports:    'reports-page',
  settings:   'settings-page',
};

const PAGE_TITLES = {
  dashboard:  { title: 'Dashboard', sub: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
  clients:    { title: 'Clients', sub: 'Manage your client database' },
  catalog:    { title: 'Catalog', sub: 'Products & services' },
  quotations: { title: 'Quotations', sub: 'Create & manage quotations' },
  invoices:   { title: 'Invoices', sub: 'Billing & payments' },
  loans:      { title: 'Loan Tracker', sub: 'Track payments & balances' },
  reports:    { title: 'Reports', sub: 'Export system data' },
  settings:   { title: 'Settings', sub: 'Configure your app' },
};

let currentPage = 'dashboard';

async function navigate(path) {
  const parts   = path.split('/');
  const page    = parts[0];
  const subpage = parts.slice(1).join('/');

  if (!ROUTES[page]) { navigate('dashboard'); return; }

  Object.values(PAGE_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const targetId = PAGE_IDS[page];
  const targetEl = document.getElementById(targetId);
  if (targetEl) targetEl.classList.add('active');

  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  const info = PAGE_TITLES[page] || { title: page, sub: '' };
  const titleEl = document.getElementById('topbar-title');
  const subEl   = document.getElementById('topbar-subtitle');
  if (titleEl) titleEl.textContent = info.title;
  if (subEl)   subEl.textContent   = info.sub;

  const newHash = subpage ? `#${page}/${subpage}` : `#${page}`;
  if (window.location.hash !== newHash) history.pushState(null, '', newHash);

  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');

  try {
    await ROUTES[page](subpage);
  } catch (err) {
    console.error(`[Kweza] Error rendering page "${page}":`, err);
    const el = document.getElementById(targetId);
    if (el) el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Something went wrong</h3><p>${err.message}</p><button class="btn btn-primary mt-12" onclick="navigate('dashboard')">Go Home</button></div>`;
  }
}
window.navigate = navigate;

// ── Expose page functions globally ──
function exposePageFunctions() {
  const pages = window.KwezaPages || {};
  Object.assign(window, pages);
  Object.assign(window, window.KwezaShare || {});
}

// ── PWA Install Prompt ──
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window._pwaInstallEvent = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'inline-flex';
});

// ── Offline Detection ──
function updateOnlineStatus() {
  document.body.classList.toggle('offline', !navigator.onLine);
  if (!navigator.onLine) showToast('You are offline. Data is saved locally.', 'warning');
  else showToast('Back online!', 'success');
}
window.addEventListener('online',  () => updateOnlineStatus());
window.addEventListener('offline', () => updateOnlineStatus());

// ── Service Worker ──
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('[Kweza] SW registered:', reg.scope);
    } catch (e) {
      console.warn('[Kweza] SW failed:', e);
    }
  }
}

// ── Load Settings ──
async function loadAppSettings() {
  const { getAllSettings } = window.KwezaDB;
  const settings = await getAllSettings();
  if (settings.branding.logo) {
    const img = document.getElementById('sidebar-logo-img');
    if (img) img.src = settings.branding.logo;
  }
}

// ── Mobile Menu ──
function toggleMobileMenu() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('active');
}
window.toggleMobileMenu = toggleMobileMenu;

// ── Nav Badges ──
async function updateNavBadges() {
  const { db } = window.KwezaDB;
  const deptId = window.KwezaAuth?.getDeptFilter?.();
  let invoices;
  if (deptId) {
    invoices = await db.invoices.where('departmentId').equals(deptId).toArray();
  } else {
    invoices = await db.invoices.toArray();
  }
  const unpaid = invoices.filter(i => i.status !== 'paid').length;
  const el = document.getElementById('invoice-badge');
  if (el) { el.textContent = unpaid; el.style.display = unpaid > 0 ? 'inline' : 'none'; }
}

// ── Sidebar User Panel ──
function updateSidebarUser(user) {
  const el = document.getElementById('sidebar-user');
  if (!el || !user) return;
  el.innerHTML = `
    <div class="sidebar-user-inner">
      <div class="user-avatar" style="background:${user.color || '#1565C0'}">
        ${user.icon || '👤'}
      </div>
      <div class="user-details">
        <div class="user-name-text">${user.name}</div>
        <div class="user-dept-text">${user.department}${user.role === 'admin' ? ' <span class="admin-tag">ADMIN</span>' : ''}</div>
      </div>
      <button class="logout-btn" onclick="window.KwezaAuth.logout()" title="Sign Out">⏏</button>
    </div>
  `;
}

// ── Full App Initialization (post-login) ──
async function initApp(user) {
  registerSW();
  exposePageFunctions();
  updateSidebarUser(user);
  await loadAppSettings();
  await updateNavBadges();

  setTimeout(async () => {
    try { await window.KwezaReminders.runReminderCheck(); } catch(e) { /* silent */ }
  }, 3000);

  // Hide settings and reports from non-admins
  const settingsItem = document.querySelector('.nav-item[data-page="settings"]');
  if (settingsItem) {
    settingsItem.style.display = user.role === 'admin' ? 'flex' : 'none';
  }
  const reportsItem = document.querySelector('.nav-item[data-page="reports"]');
  if (reportsItem) {
    reportsItem.style.display = user.role === 'admin' ? 'flex' : 'none';
  }

  const hash = window.location.hash.replace('#', '') || 'dashboard';
  await navigate(hash);

  window.addEventListener('popstate', () => {
    const h = window.location.hash.replace('#', '') || 'dashboard';
    navigate(h);
  });

  // Update topbar date
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

// ── Boot Sequence ──
async function init() {
  // Open DB first
  await window.KwezaDB.db.open();

  // Seed default department accounts
  await window.KwezaAuth.seedDefaultUsers();

  // Check existing session
  const user = window.KwezaAuth.getCurrentUser();

  if (!user) {
    // Show login — auth module will call _kwezaAfterLogin on success
    window.KwezaAuth.renderLoginScreen();
    return;
  }

  // Already logged in — go straight to app
  await initApp(user);
}

// Callback invoked by auth.js after successful login
window._kwezaAfterLogin = async (user) => {
  exposePageFunctions();
  await initApp(user);
};

document.addEventListener('DOMContentLoaded', init);
