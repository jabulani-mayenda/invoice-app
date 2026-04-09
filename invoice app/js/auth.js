/* ============================================
   KWEZA – AUTHENTICATION & DEPARTMENT SYSTEM
   ============================================ */

const AUTH_SESSION_KEY = 'kweza_auth_v1';

/** Default department accounts — seeded into DB on first launch */
const DEFAULT_DEPARTMENTS = [
  { id: 'admin',       name: 'Administrator',    department: 'Admin Office',     password: 'kweza2025',    role: 'admin', color: '#1565C0', icon: '👑' },
  { id: 'care',        name: 'Kweza Care',        department: 'Kweza Care',       password: 'care2025',     role: 'staff', color: '#00897B', icon: '💚' },
  { id: 'developers',  name: 'Kweza Developers',  department: 'Kweza Developers', password: 'dev2025',      role: 'staff', color: '#5E35B1', icon: '💻' },
  { id: 'marketing',   name: 'Marketing',         department: 'Marketing',        password: 'mkt2025',      role: 'staff', color: '#E65100', icon: '📣' },
  { id: 'designer',    name: 'Designer',          department: 'Design',           password: 'design2025',   role: 'staff', color: '#C2185B', icon: '🎨' },
  { id: 'finance',     name: 'Finance',           department: 'Finance',          password: 'fin2025',      role: 'staff', color: '#2E7D32', icon: '💰' },
  { id: 'loans',       name: 'Loans Dept',        department: 'Loans',            password: 'loans2025',    role: 'staff', color: '#F57F17', icon: '🏦' },
  { id: 'consultancy', name: 'Consultancy',       department: 'Consultancy',      password: 'consult2025',  role: 'staff', color: '#0097A7', icon: '🤝' },
];

/* ── Session Management ── */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
/** Returns departmentId to filter queries by, or null if admin (sees all) */
function getDeptFilter() {
  const u = getCurrentUser();
  if (!u || u.role === 'admin') return null;
  return u.id;
}

/* ── Seed default users into DB on first run ── */
async function seedDefaultUsers() {
  const { db } = window.KwezaDB;
  for (const dept of DEFAULT_DEPARTMENTS) {
    const existing = await db.users.get(dept.id);
    if (!existing) await db.users.put(dept);
  }
}

/* ── Login ── */
async function attemptLogin(deptId, password) {
  const { db } = window.KwezaDB;
  const user = await db.users.get(deptId);
  if (!user) return { ok: false, error: 'Department not found.' };
  if (user.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' };
  const session = { id: user.id, name: user.name, department: user.department, role: user.role, color: user.color, icon: user.icon };
  setCurrentUser(session);
  return { ok: true, user: session };
}

/* ── Logout ── */
function logout() {
  clearSession();
  location.reload();
}

/* ── Render Login Screen ── */
function renderLoginScreen() {
  const screen = document.getElementById('login-screen');
  if (!screen) return;

  screen.innerHTML = `
    <div class="login-bg">
      <div class="login-card">

        <div class="login-logo-wrap" style="margin-bottom:20px;">
          <img src="./assets/logo.png" alt="Kweza" class="login-logo-img" style="height:64px;width:auto;"
               onerror="this.style.display='none';document.getElementById('lf').style.display='flex'" />
          <div id="lf" class="login-logo-fallback" style="width:64px;height:64px;font-size:20px;margin:0 auto;">KFS</div>
        </div>

        <h1 class="login-title">Kweza Invoice</h1>
        <p class="login-subtitle">Sign in to your department account</p>

        <div class="login-form">
          <div class="form-group">
            <label class="form-label">Department</label>
            <div class="custom-select" id="dept-custom-select">
              <div class="custom-select-trigger" onclick="window.KwezaAuth.toggleDeptSelect()">
                <span id="selected-dept-label">— Select your department —</span>
                <span class="arrow">▼</span>
              </div>
              <div class="custom-select-options" id="dept-options">
                ${DEFAULT_DEPARTMENTS.map(d => `<div class="custom-select-option" data-value="${d.id}" onclick="window.KwezaAuth.selectDept('${d.id}', '${d.icon} ${d.department}')">${d.icon} ${d.department}</div>`).join('')}
              </div>
            </div>
            <input type="hidden" id="login-dept" value="" onchange="window.KwezaAuth.onDeptChange()">
          </div>

          <div class="form-group" id="login-pass-grp" style="display:none;margin-top:16px;">
            <label class="form-label">Password</label>
            <div class="password-wrap">
              <input class="form-control" id="login-pass" type="password"
                     placeholder="Enter password" autocomplete="current-password" />
              <button class="password-toggle" type="button"
                      onclick="window.KwezaAuth.togglePass()">👁</button>
            </div>
          </div>

          <p class="login-error" id="login-error"></p>

          <button class="btn login-btn" id="login-btn"
                  onclick="window.KwezaAuth.doLogin()" style="display:none;">
            Sign In &nbsp;→
          </button>
        </div>

        <p class="login-footer-note">
          © ${new Date().getFullYear()} Kweza Financial Solutions Ltd<br>
          <span>All data stored securely on this device</span>
        </p>
      </div>
    </div>
  `;

  screen.classList.add('active');
  document.getElementById('app').style.display = 'none';

  document.getElementById('login-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  
  // Close the custom select when clicking outside
  document.addEventListener('click', e => {
    const customSelect = document.getElementById('dept-custom-select');
    if (customSelect && !customSelect.contains(e.target)) {
      customSelect.classList.remove('open');
    }
  });
}

function toggleDeptSelect() {
  const customSelect = document.getElementById('dept-custom-select');
  if (customSelect) customSelect.classList.toggle('open');
}

function selectDept(deptId, label) {
  const inp = document.getElementById('login-dept');
  const labelEl = document.getElementById('selected-dept-label');
  const customSelect = document.getElementById('dept-custom-select');
  
  if (inp) {
    inp.value = deptId;
    labelEl.innerHTML = label;
    customSelect.classList.remove('open');
    
    // Update active visual state
    document.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.custom-select-option[data-value="${deptId}"]`)?.classList.add('selected');
    
    onDeptChange();
  }
}

function onDeptChange() {
  const show = !!document.getElementById('login-dept')?.value;
  document.getElementById('login-pass-grp').style.display = show ? '' : 'none';
  document.getElementById('login-btn').style.display     = show ? '' : 'none';
  document.getElementById('login-error').textContent     = '';
  if (show) setTimeout(() => document.getElementById('login-pass')?.focus(), 50);
}

function togglePass() {
  const inp = document.getElementById('login-pass');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function doLogin() {
  const deptId   = document.getElementById('login-dept')?.value;
  const password = document.getElementById('login-pass')?.value?.trim();
  const errorEl  = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  errorEl.textContent = '';
  if (!deptId)   { errorEl.textContent = 'Please select a department.'; return; }
  if (!password) { errorEl.textContent = 'Please enter your password.'; return; }

  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  const result = await attemptLogin(deptId, password);
  if (result.ok) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app').style.display = '';
    if (window._kwezaAfterLogin) await window._kwezaAfterLogin(result.user);
  } else {
    btn.disabled   = false;
    btn.innerHTML  = 'Sign In &nbsp;→';
    errorEl.textContent = result.error;
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
  }
}

window.KwezaAuth = {
  getCurrentUser, setCurrentUser, clearSession, isAdmin, getDeptFilter,
  seedDefaultUsers, attemptLogin, logout,
  renderLoginScreen, selectDept, onDeptChange, togglePass, doLogin, toggleDeptSelect,
  DEFAULT_DEPARTMENTS
};
