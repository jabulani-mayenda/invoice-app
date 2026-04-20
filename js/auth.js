/* ============================================
   KWEZA - AUTHENTICATION & RBAC SYSTEM v2
   SHA-256 hashed passwords + server session tokens
   ============================================ */

const AUTH_SESSION_KEY = 'kweza_auth_v1';
const AUTH_TOKEN_KEY   = 'kweza_token_v1';
const SESSION_TTL_HOURS = 24;

/* ─── DEFAULT DEPARTMENT ACCOUNTS ───────────────────────────── */
const DEFAULT_DEPARTMENTS = [
  { id: 'admin',              name: 'Administrator',      department: 'Admin Office',         password: 'admin123',      role: 'admin',               color: '#1565C0', icon: '👑' },
  { id: 'administration',     name: 'Administration',     department: 'Administration',        password: 'adminoffice123', role: 'administration',     color: '#455A64', icon: '🗂' },
  { id: 'ict',                name: 'ICT',                department: 'ICT',                   password: 'ict123',        role: 'ict',                 color: '#1565C0', icon: '💻' },
  { id: 'marketing',          name: 'Marketing',          department: 'Marketing',             password: 'marketing123',  role: 'marketing',           color: '#E65100', icon: '📣' },
  { id: 'sales',              name: 'Sales',              department: 'Sales',                 password: 'sales123',      role: 'sales',               color: '#6A1B9A', icon: '📈' },
  { id: 'sales-operations',   name: 'Sales Operations',   department: 'Sales Operations',      password: 'salesops123',   role: 'sales-operations',    color: '#5E35B1', icon: '🔗' },
  { id: 'business-development', name: 'Business Development', department: 'Business Development', password: 'bizdev123', role: 'business-development', color: '#00897B', icon: '🤝' },
  { id: 'finance',            name: 'Finance',            department: 'Finance',               password: 'finance123',    role: 'finance',             color: '#2E7D32', icon: '💰' },
  { id: 'operations',         name: 'Operations',         department: 'Operations',            password: 'ops123',        role: 'operations',          color: '#795548', icon: '⚙️' },
  { id: 'design',             name: 'Design',             department: 'Design',                password: 'design123',     role: 'design',              color: '#C2185B', icon: '🎨' }
];

/* ─── ROLE PERMISSIONS MAP (client-side mirror of DB roles) ─── */
const ROLE_PERMISSIONS = {
  admin:                { leads:true,  clients:true,  requests:true,  sales:true,  catalog:true,  quotations:true,  invoices:true,  payments:true,  projects:true,  operations:true,  reports:true,  qa:true,  organization:true,  settings:true,  loans:true },
  finance:              { leads:false, clients:true,  requests:false, sales:false, catalog:false, quotations:true,  invoices:true,  payments:true,  projects:false, operations:false, reports:true,  qa:false, organization:false, settings:false, loans:true },
  sales:                { leads:true,  clients:true,  requests:true,  sales:true,  catalog:true,  quotations:true,  invoices:false, payments:false, projects:false, operations:false, reports:false, qa:false, organization:false, settings:false, loans:false },
  ict:                  { leads:false, clients:false, requests:false, sales:false, catalog:false, quotations:false, invoices:false, payments:false, projects:true,  operations:true,  reports:true,  qa:false, organization:false, settings:false, loans:false },
  operations:           { leads:false, clients:false, requests:false, sales:false, catalog:false, quotations:false, invoices:false, payments:false, projects:true,  operations:true,  reports:true,  qa:false, organization:false, settings:false, loans:false },
  design:               { leads:false, clients:false, requests:false, sales:false, catalog:true,  quotations:false, invoices:false, payments:false, projects:true,  operations:true,  reports:true,  qa:false, organization:false, settings:false, loans:false },
  marketing:            { leads:true,  clients:true,  requests:true,  sales:false, catalog:false, quotations:false, invoices:false, payments:false, projects:false, operations:false, reports:false, qa:false, organization:false, settings:false, loans:false },
  'business-development': { leads:true, clients:true, requests:true,  sales:true,  catalog:false, quotations:true,  invoices:false, payments:false, projects:false, operations:false, reports:false, qa:false, organization:false, settings:false, loans:false },
  administration:       { leads:true,  clients:true,  requests:true,  sales:true,  catalog:false, quotations:true,  invoices:true,  payments:false, projects:true,  operations:false, reports:true,  qa:true,  organization:true,  settings:false, loans:false },
  'sales-operations':   { leads:true,  clients:true,  requests:true,  sales:true,  catalog:true,  quotations:true,  invoices:true,  payments:false, projects:true,  operations:true,  reports:true,  qa:false, organization:false, settings:false, loans:false },
  staff:                { leads:false, clients:false, requests:true,  sales:false, catalog:false, quotations:false, invoices:false, payments:false, projects:false, operations:false, reports:false, qa:false, organization:false, settings:false, loans:false }
};

/* ─── CRYPTO UTILITIES ───────────────────────────────────────── */
async function hashPassword(plainText) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText + 'kweza_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ─── SESSION MANAGEMENT ─────────────────────────────────────── */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSessionToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || null;
}

function setCurrentUser(user, token = null) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/* ─── ROLE CHECKS ────────────────────────────────────────────── */
function isAdmin() {
  return getCurrentUser()?.role === 'admin';
}

function hasRole(...roles) {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return roles.includes(user.role) || roles.includes(user.id);
}

/**
 * Check if current user has permission to access a module.
 * @param {string} module — e.g. 'invoices', 'projects', 'leads'
 */
function hasPermission(module) {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  const perms = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS['staff'];
  return !!perms[module];
}

/**
 * Returns the department ID to scope queries by, or null for admin (sees all).
 */
function getDeptFilter() {
  const user = getCurrentUser();
  if (!user || user.role === 'admin') return null;
  return user.id;
}

/* ─── USER SEEDING ───────────────────────────────────────────── */
async function seedDefaultUsers() {
  const { db, rawDb } = window.KwezaDB;
  for (const department of DEFAULT_DEPARTMENTS) {
    // Read from local IndexedDB ONLY — avoid hitting Supabase here, which would
    // trigger a pull that could overwrite freshly-seeded local users before they
    // are flushed to the cloud.
    const existing = await rawDb.table('users').get(department.id);
    if (!existing) {
      const passwordHash = await hashPassword(department.password);
      const record = { ...department, passwordHash };
      // Save to local cache immediately
      await rawDb.table('users').put(record);
      // Then push to Supabase (non-blocking — will be picked up by next sync cycle)
      db.users.put(record).catch(err => console.warn('[Kweza] seedDefaultUsers cloud push failed:', err.message));
    } else if (!existing.passwordHash) {
      // Backfill hash for existing users that only have plaintext password
      const passwordHash = await hashPassword(existing.password || department.password);
      await rawDb.table('users').update(existing.id, { passwordHash });
      db.users.update(existing.id, { passwordHash }).catch(() => {});
    }
  }
}

async function getLoginAccounts() {
  const { db } = window.KwezaDB;
  // NOTE: We intentionally do NOT call refreshFromRemote here.
  // seedDefaultUsers() (called just before this) already flushed users to Supabase.
  // Calling refreshFromRemote at this point risks wiping local users if Supabase
  // hasn't received them yet (race condition on first run).
  // The background cloudSyncTimer handles keeping users in sync after login.
  const accounts = await db.users.orderBy('department').toArray();
  return accounts.length ? accounts : DEFAULT_DEPARTMENTS;
}

/* ─── LOGIN FLOW ─────────────────────────────────────────────── */
async function attemptLogin(deptId, password) {
  const { rawDb } = window.KwezaDB;

  // Read user from local IndexedDB directly — avoids triggering a Supabase
  // pull that could wipe local users if the cloud table is empty.
  let user = await rawDb.table('users').get(deptId);

  // If not found locally, fall back to the DEFAULT_DEPARTMENTS hardcoded list
  // (handles fresh installs where Supabase hasn't been seeded yet)
  if (!user) {
    const fallback = DEFAULT_DEPARTMENTS.find(d => d.id === deptId);
    if (fallback) user = fallback;
  }

  if (!user) return { ok: false, error: 'Department not found.' };
  if (user.isActive === false) return { ok: false, error: 'This account has been deactivated.' };

  // SHA-256 hash check (preferred)
  const inputHash = await hashPassword(password);
  const hashMatch = user.passwordHash && user.passwordHash === inputHash;

  // Plaintext fallback (for accounts not yet hashed)
  const plaintextMatch = !user.passwordHash && user.password === password;

  if (!hashMatch && !plaintextMatch) {
    return { ok: false, error: 'Incorrect password. Please try again.' };
  }

  // If user still has plaintext password, upgrade to hash
  if (plaintextMatch && !user.passwordHash) {
    try {
      await db.users.update(deptId, { passwordHash: inputHash });
    } catch {
      // non-critical
    }
  }

  // Create server-backed session token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();

  try {
    await db.sessionTokens.add({ userId: deptId, token, expiresAt, createdAt: new Date().toISOString() });
  } catch {
    // non-critical if fails — app still works with localStorage
  }

  const session = {
    id: user.id,
    name: user.name,
    department: user.department,
    role: user.role,
    color: user.color,
    icon: user.icon
  };

  setCurrentUser(session, token);

  // Log login audit
  try {
    await window.KwezaDB.logAudit('login', 'users', deptId, null, session);
  } catch {
    // non-critical
  }

  return { ok: true, user: session };
}

async function logout() {
  const user = getCurrentUser();
  const token = getSessionToken();

  if (user && token) {
    try {
      const { db } = window.KwezaDB;
      await db.sessionTokens.where({ token }).delete();
      await window.KwezaDB.logAudit('logout', 'users', user.id, null, null);
    } catch {
      // non-critical
    }
  }

  clearSession();
  location.reload();
}

/* ─── LOGIN SCREEN RENDERER ──────────────────────────────────── */
async function renderLoginScreen() {
  const screen = document.getElementById('login-screen');
  if (!screen) return;

  const [accounts, settings] = await Promise.all([
    getLoginAccounts(),
    window.KwezaDB.getAllSettings().catch(() => null)
  ]);

  const brandName     = settings?.company?.name || 'Kweza MIS';
  const brandSubtitle = settings?.company?.tagline || 'Sign in to your department account';
  const brandLogo     = settings?.branding?.logo || './assets/logo.png';

  screen.innerHTML = `
    <div class="login-bg">
      <div class="login-card">
        <div class="login-logo-wrap" style="margin-bottom:20px;">
          <img src="${brandLogo}" alt="${brandName}" class="login-logo-img" style="height:64px;width:auto;"
               onerror="this.style.display='none';document.getElementById('lf').style.display='flex'" />
          <div id="lf" class="login-logo-fallback" style="width:64px;height:64px;font-size:20px;margin:0 auto;">KFS</div>
        </div>

        <h1 class="login-title">${brandName}</h1>
        <p class="login-subtitle">${brandSubtitle}</p>

        <div class="login-form">
          <div class="form-group">
            <label class="form-label">Department</label>
            <div class="custom-select" id="dept-custom-select">
              <div class="custom-select-trigger" onclick="window.KwezaAuth.toggleDeptSelect()">
                <span id="selected-dept-label">- Select your department -</span>
                <span class="arrow">▼</span>
              </div>
              <div class="custom-select-options" id="dept-options">
                ${accounts.map(account => `
                  <div class="custom-select-option" data-value="${account.id}" onclick="window.KwezaAuth.selectDept('${account.id}', '${account.icon} ${account.department}')">
                    ${account.icon} ${account.department}
                  </div>`).join('')}
              </div>
            </div>
            <input type="hidden" id="login-dept" value="" onchange="window.KwezaAuth.onDeptChange()" />
          </div>

          <div class="form-group" id="login-pass-grp" style="display:none;margin-top:16px;">
            <label class="form-label">Password</label>
            <div class="password-wrap">
              <input class="form-control" id="login-pass" type="password" placeholder="Enter password" autocomplete="current-password" />
              <button class="password-toggle" type="button" onclick="window.KwezaAuth.togglePass()">👁</button>
            </div>
          </div>

          <p class="login-error" id="login-error"></p>

          <button class="btn login-btn" id="login-btn" onclick="window.KwezaAuth.doLogin()" style="display:none;">
            Sign In &nbsp;→
          </button>
        </div>

        <p class="login-footer-note">
          © ${new Date().getFullYear()} ${brandName}<br>
          <span>Shared company data sync is powered by Supabase</span>
        </p>
      </div>
    </div>
  `;

  screen.classList.add('active');
  document.getElementById('app').style.display = 'none';

  document.getElementById('login-pass')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') window.KwezaAuth.doLogin();
  });

  document.addEventListener('click', event => {
    const customSelect = document.getElementById('dept-custom-select');
    if (customSelect && !customSelect.contains(event.target)) {
      customSelect.classList.remove('open');
    }
  });
}

/* ─── LOGIN UI HELPERS ──────────────────────────────────────── */
function toggleDeptSelect() {
  document.getElementById('dept-custom-select')?.classList.toggle('open');
}

function selectDept(deptId, label) {
  const input   = document.getElementById('login-dept');
  const labelEl = document.getElementById('selected-dept-label');
  if (!input) return;

  input.value = deptId;
  if (labelEl) labelEl.innerHTML = label;
  document.getElementById('dept-custom-select')?.classList.remove('open');
  document.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
  document.querySelector(`.custom-select-option[data-value="${deptId}"]`)?.classList.add('selected');
  onDeptChange();
}

function onDeptChange() {
  const show = !!document.getElementById('login-dept')?.value;
  document.getElementById('login-pass-grp').style.display = show ? '' : 'none';
  document.getElementById('login-btn').style.display      = show ? '' : 'none';
  document.getElementById('login-error').textContent = '';
  if (show) setTimeout(() => document.getElementById('login-pass')?.focus(), 50);
}

function togglePass() {
  const input = document.getElementById('login-pass');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

async function doLogin() {
  const deptId   = document.getElementById('login-dept')?.value;
  const password = document.getElementById('login-pass')?.value?.trim();
  const errorEl  = document.getElementById('login-error');
  const button   = document.getElementById('login-btn');

  errorEl.textContent = '';
  if (!deptId)    { errorEl.textContent = 'Please select a department.'; return; }
  if (!password)  { errorEl.textContent = 'Please enter your password.';  return; }

  button.disabled  = true;
  button.textContent = 'Signing in...';

  const result = await attemptLogin(deptId, password);
  if (result.ok) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app').style.display = '';
    if (window._kwezaAfterLogin) await window._kwezaAfterLogin(result.user);
    return;
  }

  button.disabled  = false;
  button.innerHTML = 'Sign In &nbsp;→';
  errorEl.textContent = result.error;
  document.getElementById('login-pass').value = '';
  document.getElementById('login-pass').focus();
}

/* ─── PUBLIC API ─────────────────────────────────────────────── */
window.KwezaAuth = {
  getCurrentUser,
  getSessionToken,
  setCurrentUser,
  clearSession,
  isAdmin,
  hasRole,
  hasPermission,
  getDeptFilter,
  seedDefaultUsers,
  attemptLogin,
  logout,
  renderLoginScreen,
  selectDept,
  onDeptChange,
  togglePass,
  doLogin,
  toggleDeptSelect,
  hashPassword,
  DEFAULT_DEPARTMENTS,
  ROLE_PERMISSIONS
};
