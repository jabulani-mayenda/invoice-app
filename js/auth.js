/* ============================================
   KWEZA - AUTHENTICATION & DEPARTMENT SYSTEM
   ============================================ */

const AUTH_SESSION_KEY = 'kweza_auth_v1';

const DEFAULT_DEPARTMENTS = [
  { id: 'admin', name: 'Administrator', department: 'Admin Office', password: 'admin123', role: 'admin', color: '#1565C0', icon: '👑' },
  { id: 'administration', name: 'Administration', department: 'Administration', password: 'adminoffice123', role: 'administration', color: '#455A64', icon: '🗂' },
  { id: 'ict', name: 'ICT', department: 'ICT', password: 'ict123', role: 'staff', color: '#1565C0', icon: '💻' },
  { id: 'marketing', name: 'Marketing', department: 'Marketing', password: 'marketing123', role: 'staff', color: '#E65100', icon: '📣' },
  { id: 'sales', name: 'Sales', department: 'Sales', password: 'sales123', role: 'sales', color: '#6A1B9A', icon: '📈' },
  { id: 'sales-operations', name: 'Sales Operations', department: 'Sales Operations', password: 'salesops123', role: 'sales-operations', color: '#5E35B1', icon: '🔗' },
  { id: 'business-development', name: 'Business Development', department: 'Business Development', password: 'bizdev123', role: 'staff', color: '#00897B', icon: '🤝' },
  { id: 'finance', name: 'Finance', department: 'Finance', password: 'finance123', role: 'finance', color: '#2E7D32', icon: '💰' },
  { id: 'operations', name: 'Operations', department: 'Operations', password: 'ops123', role: 'operations', color: '#795548', icon: '⚙️' },
  { id: 'design', name: 'Design', department: 'Design', password: 'design123', role: 'design', color: '#C2185B', icon: '🎨' }
];

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function isAdmin() {
  return getCurrentUser()?.role === 'admin';
}

function hasRole(...roles) {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return roles.includes(user.role) || roles.includes(user.id);
}

function getDeptFilter() {
  const user = getCurrentUser();
  if (!user || user.role === 'admin') return null;
  return user.id;
}

async function seedDefaultUsers() {
  const { db } = window.KwezaDB;
  for (const department of DEFAULT_DEPARTMENTS) {
    const existing = await db.users.get(department.id);
    if (!existing) {
      await db.users.put(department);
    }
  }
}

async function getLoginAccounts() {
  const { db, refreshFromRemote } = window.KwezaDB;
  await refreshFromRemote({ force: true, tables: ['users'] });
  const accounts = await db.users.orderBy('department').toArray();
  return accounts.length ? accounts : DEFAULT_DEPARTMENTS;
}

async function attemptLogin(deptId, password) {
  const { db, refreshFromRemote } = window.KwezaDB;
  await refreshFromRemote({ force: true, tables: ['users'] });
  const user = await db.users.get(deptId);

  if (!user) return { ok: false, error: 'Department not found.' };
  if (user.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' };

  const session = {
    id: user.id,
    name: user.name,
    department: user.department,
    role: user.role,
    color: user.color,
    icon: user.icon
  };

  setCurrentUser(session);
  return { ok: true, user: session };
}

function logout() {
  clearSession();
  location.reload();
}

async function renderLoginScreen() {
  const screen = document.getElementById('login-screen');
  if (!screen) return;

  const [accounts, settings] = await Promise.all([
    getLoginAccounts(),
    window.KwezaDB.getAllSettings().catch(() => null)
  ]);

  const brandName = settings?.company?.name || 'Kweza Invoice';
  const brandSubtitle = settings?.company?.tagline || 'Sign in to your department account';
  const brandLogo = settings?.branding?.logo || './assets/logo.png';

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
            <input type="hidden" id="login-dept" value="" onchange="window.KwezaAuth.onDeptChange()">
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

function toggleDeptSelect() {
  const customSelect = document.getElementById('dept-custom-select');
  if (customSelect) customSelect.classList.toggle('open');
}

function selectDept(deptId, label) {
  const input = document.getElementById('login-dept');
  const labelEl = document.getElementById('selected-dept-label');
  const customSelect = document.getElementById('dept-custom-select');

  if (!input) return;

  input.value = deptId;
  if (labelEl) labelEl.innerHTML = label;
  customSelect?.classList.remove('open');

  document.querySelectorAll('.custom-select-option').forEach(option => option.classList.remove('selected'));
  document.querySelector(`.custom-select-option[data-value="${deptId}"]`)?.classList.add('selected');

  onDeptChange();
}

function onDeptChange() {
  const show = !!document.getElementById('login-dept')?.value;
  document.getElementById('login-pass-grp').style.display = show ? '' : 'none';
  document.getElementById('login-btn').style.display = show ? '' : 'none';
  document.getElementById('login-error').textContent = '';
  if (show) setTimeout(() => document.getElementById('login-pass')?.focus(), 50);
}

function togglePass() {
  const input = document.getElementById('login-pass');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

async function doLogin() {
  const deptId = document.getElementById('login-dept')?.value;
  const password = document.getElementById('login-pass')?.value?.trim();
  const errorEl = document.getElementById('login-error');
  const button = document.getElementById('login-btn');

  errorEl.textContent = '';
  if (!deptId) {
    errorEl.textContent = 'Please select a department.';
    return;
  }
  if (!password) {
    errorEl.textContent = 'Please enter your password.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Signing in...';

  const result = await attemptLogin(deptId, password);
  if (result.ok) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app').style.display = '';
    if (window._kwezaAfterLogin) await window._kwezaAfterLogin(result.user);
    return;
  }

  button.disabled = false;
  button.innerHTML = 'Sign In &nbsp;→';
  errorEl.textContent = result.error;
  document.getElementById('login-pass').value = '';
  document.getElementById('login-pass').focus();
}

window.KwezaAuth = {
  getCurrentUser,
  setCurrentUser,
  clearSession,
  isAdmin,
  hasRole,
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
  DEFAULT_DEPARTMENTS
};
