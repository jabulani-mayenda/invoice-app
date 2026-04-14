/* ============================================
   KWEZA - APP ROUTER & INITIALIZATION v2
   Role-based nav, permission guards, new routes
   ============================================ */

let currentPage    = 'dashboard';
let currentSubpage = '';
let cloudSyncTimer = null;

/* ─── TOAST ──────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast  = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = '0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
window.showToast = showToast;

/* ─── MODAL ──────────────────────────────────────────────────── */
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) { overlay.classList.remove('active'); overlay.innerHTML = ''; }
}
window.closeModal = closeModal;

document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
document.addEventListener('click',   event => {
  const overlay = document.getElementById('modal-overlay');
  if (overlay && event.target === overlay) closeModal();
});

/* ─── ROUTES ─────────────────────────────────────────────────── */
const ROUTES = {
  dashboard:   ()    => window.KwezaPages.renderDashboard(),
  clients:     ()    => window.KwezaPages.renderClients().then(() => window.KwezaPages.loadClientStats()),
  requests:    ()    => window.KwezaPages.renderRequests(),
  sales:       ()    => window.KwezaPages.renderSales(),
  catalog:     ()    => window.KwezaPages.renderCatalog(),
  organization:()    => window.KwezaPages.renderOrganization(),
  quotations:  sub   => window.KwezaPages.renderQuotations(sub),
  invoices:    sub   => window.KwezaPages.renderInvoices(sub),
  operations:  ()    => window.KwezaPages.renderOperations(),
  reports:     ()    => window.KwezaPages.renderReports(),
  settings:    ()    => window.KwezaPages.renderSettings(),
  leads:       ()    => window.KwezaPages.renderLeads(),
  projects:    sub   => window.KwezaPages.renderProjects(sub),
  qa:          ()    => window.KwezaPages.renderQA()
};

const PAGE_IDS = {
  dashboard:    'dashboard-page',
  clients:      'clients-page',
  requests:     'requests-page',
  sales:        'sales-page',
  catalog:      'catalog-page',
  organization: 'organization-page',
  quotations:   'quotations-page',
  invoices:     'invoices-page',
  operations:   'operations-page',
  reports:      'reports-page',
  settings:     'settings-page',
  leads:        'leads-page',
  projects:     'projects-page',
  qa:           'qa-page'
};

const PAGE_TITLES = {
  dashboard:   { title: 'Dashboard',        sub: new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) },
  clients:     { title: 'Clients',          sub: 'Manage your client database' },
  requests:    { title: 'Service Requests', sub: 'Entry point for all departments' },
  sales:       { title: 'Sales',            sub: 'Commercial pipeline and conversion control' },
  catalog:     { title: 'Catalog',          sub: 'Products and services shared across departments' },
  organization:{ title: 'Organization',    sub: 'Shared departments and employees' },
  quotations:  { title: 'Quotations',       sub: 'Create and manage quotations' },
  invoices:    { title: 'Invoices',         sub: 'Billing and payments' },
  operations:  { title: 'Operations',       sub: 'Task execution and delivery' },
  reports:     { title: 'Reports',          sub: 'Department progress, issues and completion reports' },
  settings:    { title: 'Settings',         sub: 'Configure your app' },
  leads:       { title: 'Leads',            sub: 'CRM — track prospects and convert to clients' },
  projects:    { title: 'Projects',         sub: 'Execution workspace — tasks, milestones and delivery' },
  qa:          { title: 'QA Reviews',       sub: 'Quality assurance — approve or reject project delivery' }
};

/* ─── ROUTE HELPERS ──────────────────────────────────────────── */
function getCurrentRoute() {
  const hash  = window.location.hash.replace(/^#/, '') || 'dashboard';
  const parts = hash.split('/');
  return { hash, page: parts[0] || 'dashboard', subpage: parts.slice(1).join('/') };
}

function isEditingRoute(subpage) {
  if (!subpage) return false;
  return subpage === 'new' || subpage.endsWith('/edit');
}

/* ─── NAVIGATION WITH PERMISSION GUARD ───────────────────────── */
async function navigate(path, options = {}) {
  const parts   = String(path || 'dashboard').split('/');
  const page    = parts[0] || 'dashboard';
  const subpage = parts.slice(1).join('/');

  // Unknown route → dashboard
  if (!ROUTES[page]) { await navigate('dashboard', options); return; }

  // Permission guard (skip for dashboard)
  if (page !== 'dashboard') {
    const allowed = window.KwezaAuth?.hasPermission?.(page) ?? true;
    if (!allowed) {
      showToast(`Your department doesn't have access to ${PAGE_TITLES[page]?.title || page}.`, 'error');
      await navigate('dashboard', options);
      return;
    }
  }

  currentPage    = page;
  currentSubpage = subpage;

  showActivePage(page);
  updateSidebarNav(page);
  updateTopbar(page);

  const newHash = subpage ? `#${page}/${subpage}` : `#${page}`;
  if (!options.skipHistory && window.location.hash !== newHash) {
    history.pushState(null, '', newHash);
  }

  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');

  try {
    await window.KwezaDB.refreshFromRemote();
    await loadAppSettings();
    await updateNavBadges();
    await ROUTES[page](subpage);
  } catch (error) {
    console.error(`[Kweza] Error rendering page "${page}":`, error);
    const pageEl = document.getElementById(PAGE_IDS[page]);
    if (pageEl) {
      pageEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p>${error.message}</p>
          <button class="btn btn-primary mt-12" onclick="navigate('dashboard')">Go Home</button>
        </div>
      `;
    }
  }
}
window.navigate = navigate;

/* ─── UI HELPERS ─────────────────────────────────────────────── */
async function applyBranding(settings = null) {
  const resolvedSettings = settings || await window.KwezaDB.getAllSettings();
  const brandName    = resolvedSettings.company?.name     || 'Kweza MIS';
  const brandTagline = resolvedSettings.company?.tagline  || 'Sales, Billing and Operations';
  const brandLogo    = resolvedSettings.branding?.logo    || './assets/logo.png';
  const themeColor   = resolvedSettings.branding?.primaryColor || '#1565C0';

  const sidebarLogo = document.getElementById('sidebar-logo-img');
  if (sidebarLogo) sidebarLogo.src = brandLogo;

  const brandNameEl = document.getElementById('sidebar-brand-name');
  if (brandNameEl) brandNameEl.textContent = brandName;

  const brandTaglineEl = document.getElementById('sidebar-brand-tagline');
  if (brandTaglineEl) brandTaglineEl.textContent = brandTagline;

  document.title = brandName;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', themeColor);

  document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(link => {
    link.setAttribute('href', brandLogo);
  });

  return resolvedSettings;
}

async function loadAppSettings() { return applyBranding(); }

function updateTopbar(page) {
  const info    = PAGE_TITLES[page] || { title: page, sub: '' };
  const titleEl = document.getElementById('topbar-title');
  const subEl   = document.getElementById('topbar-subtitle');
  if (titleEl) titleEl.textContent = info.title;
  if (subEl)   subEl.textContent   = info.sub;
}

function updateSidebarNav(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
}

function showActivePage(page) {
  Object.values(PAGE_IDS).forEach(id => {
    const element = document.getElementById(id);
    if (element) element.classList.remove('active');
  });
  const target = document.getElementById(PAGE_IDS[page]);
  if (target) target.classList.add('active');
}

/* ─── ROLE-BASED NAV FILTERING ───────────────────────────────── */
function applyNavPermissions(user) {
  const perms = window.KwezaAuth?.ROLE_PERMISSIONS?.[user?.role] || {};

  // Map nav item data-page to permission key
  const navPermMap = {
    leads:        'leads',
    clients:      'clients',
    requests:     'requests',
    sales:        'sales',
    catalog:      'catalog',
    organization: 'organization',
    quotations:   'quotations',
    invoices:     'invoices',
    operations:   'operations',
    reports:      'reports',
    settings:     'settings',
    projects:     'projects',
    qa:           'qa'
  };

  const isAdmin = user?.role === 'admin';

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    const page = item.dataset.page;
    if (page === 'dashboard') { item.style.display = 'flex'; return; }

    const perm = navPermMap[page];
    const visible = isAdmin || (perm && perms[perm]);
    item.style.display = visible ? 'flex' : 'none';
  });
}

/* ─── NAV BADGES ─────────────────────────────────────────────── */
async function updateNavBadges() {
  const { db } = window.KwezaDB;
  const user   = window.KwezaAuth?.getCurrentUser?.();
  const deptId = window.KwezaAuth?.getDeptFilter?.();

  // Invoice unpaid badge
  const invoices = deptId
    ? await db.invoices.where('departmentId').equals(deptId).toArray()
    : await db.invoices.toArray();
  const unpaid = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'project_created').length;
  const invBadge = document.getElementById('invoice-badge');
  if (invBadge) { invBadge.textContent = unpaid; invBadge.style.display = unpaid > 0 ? 'inline' : 'none'; }

  // Project active badge
  const allProjects = await db.projects.toArray();
  const myProjects  = deptId
    ? allProjects.filter(p => p.departmentId === deptId)
    : allProjects;
  const activeProjects = myProjects.filter(p => ['Pending','Active','In Progress','Revision'].includes(p.status)).length;
  const projBadge = document.getElementById('projects-badge');
  if (projBadge) { projBadge.textContent = activeProjects; projBadge.style.display = activeProjects > 0 ? 'inline' : 'none'; }

  // QA pending badge (admin/administration only)
  if (!deptId || user?.role === 'administration') {
    const qaProjects = allProjects.filter(p => p.status === 'QA').length;
    const qaBadge = document.getElementById('qa-badge');
    if (qaBadge) { qaBadge.textContent = qaProjects; qaBadge.style.display = qaProjects > 0 ? 'inline' : 'none'; }
  }

  // Unread notifications bell
  if (user) {
    const notifs = await window.KwezaDB.getUnreadNotifications(user.id, user.id);
    const notifBadge = document.getElementById('notif-badge');
    if (notifBadge) { notifBadge.textContent = notifs.length; notifBadge.style.display = notifs.length > 0 ? 'inline' : 'none'; }
  }
}

/* ─── SIDEBAR USER WIDGET ────────────────────────────────────── */
function updateSidebarUser(user) {
  const container = document.getElementById('sidebar-user');
  if (!container || !user) return;

  const roleLabel = user.role === 'admin' ? ' <span class="admin-tag">ADMIN</span>' : '';
  container.innerHTML = `
    <div class="sidebar-user-inner">
      <div class="user-avatar" style="background:${user.color || '#1565C0'}">
        ${user.icon || '👤'}
      </div>
      <div class="user-details">
        <div class="user-name-text">${user.name}</div>
        <div class="user-dept-text">${user.department}${roleLabel}</div>
      </div>
      <button class="logout-btn" onclick="window.KwezaAuth.logout()" title="Sign Out">⏻</button>
    </div>
  `;
}

/* ─── CLOUD SYNC ─────────────────────────────────────────────── */
function startCloudSync() {
  if (cloudSyncTimer) clearInterval(cloudSyncTimer);

  const config = window.KwezaSupabase?.getConfig?.();
  if (!config?.url || !config?.anonKey) return;

  cloudSyncTimer = window.setInterval(async () => {
    if (document.hidden) return;

    try {
      const synced = await window.KwezaDB.refreshFromRemote({ force: true });
      if (!synced) return;

      await loadAppSettings();
      await updateNavBadges();

      const modalOpen = document.getElementById('modal-overlay')?.classList.contains('active');
      if (modalOpen || isEditingRoute(currentSubpage)) return;

      await ROUTES[currentPage]?.(currentSubpage);
    } catch (error) {
      console.warn('[Kweza] Background sync skipped:', error);
    }
  }, 20000);
}

/* ─── PWA ────────────────────────────────────────────────────── */
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  window._pwaInstallEvent = event;
  const button = document.getElementById('pwa-install-btn');
  if (button) button.style.display = 'inline-flex';
});

function triggerPWAInstall() {
  if (window._pwaInstallEvent) window._pwaInstallEvent.prompt();
}
window.triggerPWAInstall = triggerPWAInstall;

/* ─── ONLINE STATUS ──────────────────────────────────────────── */
function updateOnlineStatus() {
  document.body.classList.toggle('offline', !navigator.onLine);
  if (!navigator.onLine) {
    showToast('You are offline. Data is saved locally.', 'warning');
  } else {
    showToast('Back online!', 'success');
  }
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

/* ─── SERVICE WORKER ─────────────────────────────────────────── */
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    console.log('[Kweza] SW registered:', reg.scope);
  } catch (error) {
    console.warn('[Kweza] SW failed:', error);
  }
}

/* ─── MOBILE MENU ────────────────────────────────────────────── */
function toggleMobileMenu() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('active');
}
window.toggleMobileMenu = toggleMobileMenu;

/* ─── PAGE FUNCTION EXPOSURE ─────────────────────────────────── */
function exposePageFunctions() {
  const pages = window.KwezaPages || {};
  Object.assign(window, pages);
  Object.assign(window, window.KwezaShare || {});
}

/* ─── APP INIT ───────────────────────────────────────────────── */
async function initApp(user) {
  registerSW();
  exposePageFunctions();
  updateSidebarUser(user);
  applyNavPermissions(user);
  await loadAppSettings();
  await updateNavBadges();
  startCloudSync();

  setTimeout(async () => {
    try { await window.KwezaReminders.runReminderCheck(); } catch { /* ignore */ }
  }, 3000);

  const route = getCurrentRoute();
  await navigate(route.hash, { skipHistory: true });

  if (!window._kwezaPopstateBound) {
    window._kwezaPopstateBound = true;
    window.addEventListener('popstate', () => {
      const r = getCurrentRoute();
      navigate(r.hash, { skipHistory: true });
    });
  }

  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  }
}

async function init() {
  await window.KwezaDB.db.open();
  await window.KwezaAuth.seedDefaultUsers();

  const user = window.KwezaAuth.getCurrentUser();
  if (!user) {
    await window.KwezaAuth.renderLoginScreen();
    return;
  }

  await initApp(user);
}

window._kwezaAfterLogin = async user => {
  exposePageFunctions();
  await initApp(user);
};

window.KwezaApp = { applyBranding, loadAppSettings, updateNavBadges, applyNavPermissions };

document.addEventListener('DOMContentLoaded', init);
