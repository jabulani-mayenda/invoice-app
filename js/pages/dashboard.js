/* ============================================
   KWEZA - DASHBOARD PAGE (v2)
   Role-scoped KPIs — each dept sees their own data
   Admin/Finance see full revenue analytics
   ICT/Ops see project workspace
   Sales/Marketing see CRM pipeline
   ============================================ */

async function renderDashboard() {
  const { getAllSettings, db } = window.KwezaDB;
  const user   = window.KwezaAuth?.getCurrentUser?.();
  const role   = user?.role || 'staff';
  const deptId = window.KwezaAuth?.getDeptFilter?.();

  const settings = await getAllSettings();
  const currency = settings.defaults?.currency || 'MWK';
  const fmt      = amt => `${currency} ${Number(amt || 0).toLocaleString()}`;

  // Route to the correct dashboard view by role
  if (['ict','operations','design'].includes(role)) {
    return renderDeliveryDashboard(user, deptId, fmt);
  }
  if (['sales','marketing','business-development'].includes(role)) {
    return renderSalesDashboard(user, deptId, fmt);
  }
  if (role === 'finance') {
    return renderFinanceDashboard(user, deptId, currency, fmt);
  }
  // Admin, administration, sales-operations — full dashboard
  return renderAdminDashboard(user, deptId, currency, settings, fmt);
}

/* ─── ADMIN / FULL DASHBOARD ─────────────────────────────────── */
async function renderAdminDashboard(user, deptId, currency, settings, fmt) {
  const { db } = window.KwezaDB;
  const [invoices, projects, leads, payments, activity, qaReviews] = await Promise.all([
    db.invoices.toArray(),
    db.projects.toArray(),
    db.leads.toArray(),
    db.payments.toArray(),
    db.activity.orderBy('id').reverse().limit(8).toArray(),
    db.qaReviews.toArray()
  ]);

  const paidInvoices   = invoices.filter(i => ['paid','project_created'].includes(i.status));
  const totalRevenue   = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding    = invoices.filter(i => !['paid','project_created'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0);
  const activeProjects = projects.filter(p => ['Pending','Active','In Progress'].includes(p.status)).length;
  const inQA           = projects.filter(p => p.status === 'QA').length;
  const completedProj  = projects.filter(p => p.status === 'Completed').length;
  const newLeads       = leads.filter(l => l.status === 'New').length;
  const convLeads      = leads.filter(l => l.status === 'Converted').length;
  const convRate       = leads.length > 0 ? Math.round((convLeads / leads.length) * 100) : 0;

  document.getElementById('dashboard-page').innerHTML = `
    <div style="margin-bottom:24px;padding:20px 24px;background:linear-gradient(135deg,rgba(0,97,107,0.35),rgba(0,151,167,0.15));border:1px solid rgba(0,151,167,0.25);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:#E2EBF6;">Welcome, ${user?.name || 'Team'} 👋</div>
        <div style="font-size:13px;color:#4E6A8A;margin-top:4px;">Lead → Quote → Invoice → Payment → Project → QA → Completion</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="navigate('leads')">✨ New Lead</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('projects')">🚀 Projects</button>
        ${inQA > 0 ? `<button class="btn btn-secondary btn-sm" onclick="navigate('qa')" style="border-color:#6A1B9A;color:#6A1B9A;">✅ QA Queue (${inQA})</button>` : ''}
      </div>
    </div>

    <!-- Revenue Row -->
    <div class="grid grid-3">
      <div class="stat-card teal animate-in" onclick="navigate('invoices')" style="cursor:pointer;">
        <div class="stat-card-icon">💵</div>
        <div class="stat-card-label">Total Revenue Collected</div>
        <div class="stat-card-value">${fmt(totalRevenue)}</div>
      </div>
      <div class="stat-card gold animate-in" onclick="navigate('invoices')" style="cursor:pointer;">
        <div class="stat-card-icon">⏳</div>
        <div class="stat-card-label">Outstanding Balances</div>
        <div class="stat-card-value">${fmt(outstanding)}</div>
      </div>
      <div class="stat-card green animate-in" onclick="navigate('projects')" style="cursor:pointer;">
        <div class="stat-card-icon">🚀</div>
        <div class="stat-card-label">Active Projects</div>
        <div class="stat-card-value">${activeProjects}</div>
      </div>
    </div>

    <!-- Ops Row -->
    <div class="grid grid-3" style="margin-top:16px;">
      <div class="stat-card outline animate-in" onclick="navigate('qa')" style="cursor:pointer;">
        <div class="stat-card-icon">✅</div>
        <div class="stat-card-label">Awaiting QA</div>
        <div class="stat-card-value" style="color:${inQA > 0 ? '#6A1B9A' : 'inherit'}">${inQA}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('projects')" style="cursor:pointer;">
        <div class="stat-card-icon">🏁</div>
        <div class="stat-card-label">Completed Projects</div>
        <div class="stat-card-value" style="color:#2E7D32">${completedProj}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('leads')" style="cursor:pointer;">
        <div class="stat-card-icon">🎯</div>
        <div class="stat-card-label">Lead Conversion Rate</div>
        <div class="stat-card-value">${convRate}%</div>
      </div>
    </div>

    <!-- CRM Row -->
    <div class="grid grid-3" style="margin-top:16px;">
      <div class="stat-card outline animate-in" onclick="navigate('leads')" style="cursor:pointer;">
        <div class="stat-card-icon">🆕</div>
        <div class="stat-card-label">New Leads</div>
        <div class="stat-card-value">${newLeads}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('invoices')" style="cursor:pointer;">
        <div class="stat-card-icon">🧾</div>
        <div class="stat-card-label">Total Invoices</div>
        <div class="stat-card-value">${invoices.length}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('projects')" style="cursor:pointer;">
        <div class="stat-card-icon">📊</div>
        <div class="stat-card-label">Total Projects</div>
        <div class="stat-card-value">${projects.length}</div>
      </div>
    </div>

    <!-- Charts + Activity -->
    <div class="grid grid-2" style="margin-top:24px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Revenue (Last 6 Months)</div>
        </div>
        <div class="chart-container"><canvas id="revenue-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Recent Activity</div>
        </div>
        <div class="activity-feed">
          ${activity.length === 0
            ? '<div class="empty-state" style="padding:30px 10px;"><div class="empty-state-icon" style="font-size:32px;">🌱</div><p>No activity yet.</p></div>'
            : activity.map(item => `
              <div class="activity-item animate-in">
                <div class="activity-icon bg-primary">•</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;color:#E2EBF6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.description}</div>
                  <div style="font-size:11px;color:#4E6A8A;margin-top:2px;">${new Date(item.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>`).join('')}
        </div>
      </div>
    </div>
  `;

  const months = await getMonthlyRevenueForDashboard();
  const ctx    = document.getElementById('revenue-chart')?.getContext('2d');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   months.map(m => m.label),
      datasets: [{
        label: 'Revenue',
        data:  months.map(m => m.total),
        backgroundColor: months.map((m, i) => i === months.length - 1 ? '#0097A7' : 'rgba(0,151,167,0.35)'),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* ─── DELIVERY DASHBOARD (ICT / Operations / Design) ─────────── */
async function renderDeliveryDashboard(user, deptId, fmt) {
  const { db } = window.KwezaDB;
  let [projects, tasks, reports, notifications] = await Promise.all([
    db.projects.toArray(),
    db.projectTasks.toArray(),
    db.departmentReports.toArray(),
    db.notifications.where('isRead').equals(false).toArray()
  ]);

  // Dept scope
  if (deptId) {
    projects      = projects.filter(p => p.departmentId === deptId);
    tasks         = tasks.filter(t => t.departmentId    === deptId);
    reports       = reports.filter(r => r.departmentId  === deptId);
    notifications = notifications.filter(n => !n.deptId || n.deptId === deptId);
  }

  const activeProjects = projects.filter(p => ['Active','In Progress','Pending'].includes(p.status)).length;
  const myTasks        = tasks.filter(t  => ['Pending','In Progress','Blocked','Testing'].includes(t.status)).length;
  const doneTasks      = tasks.filter(t  => t.status === 'Done').length;
  const unread         = notifications.length;

  document.getElementById('dashboard-page').innerHTML = `
    <div style="margin-bottom:24px;padding:20px 24px;background:linear-gradient(135deg,rgba(21,101,192,0.3),rgba(25,118,210,0.1));border:1px solid rgba(25,118,210,0.25);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:#E2EBF6;">Welcome, ${user?.name || 'Team'} 💻</div>
        <div style="font-size:13px;color:#4E6A8A;margin-top:4px;">${user?.department} Workspace — ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="navigate('projects')">🚀 My Projects</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('reports')">📑 Submit Report</button>
      </div>
    </div>

    <div class="grid grid-3">
      <div class="stat-card teal animate-in" onclick="navigate('projects')" style="cursor:pointer;">
        <div class="stat-card-icon">🚀</div>
        <div class="stat-card-label">Active Projects</div>
        <div class="stat-card-value">${activeProjects}</div>
      </div>
      <div class="stat-card gold animate-in" onclick="navigate('projects')" style="cursor:pointer;">
        <div class="stat-card-icon">📋</div>
        <div class="stat-card-label">Open Tasks</div>
        <div class="stat-card-value">${myTasks}</div>
      </div>
      <div class="stat-card green animate-in" onclick="navigate('projects')" style="cursor:pointer;">
        <div class="stat-card-icon">✅</div>
        <div class="stat-card-label">Tasks Done</div>
        <div class="stat-card-value">${doneTasks}</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:24px;">
      <!-- Active Projects List -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">My Active Projects</div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('projects')">View All</button>
        </div>
        ${projects.filter(p => ['Active','In Progress','Pending'].includes(p.status)).length === 0
          ? '<div class="empty-state" style="padding:30px 10px;"><p>No active projects.</p></div>'
          : projects.filter(p => ['Active','In Progress','Pending'].includes(p.status)).slice(0, 5).map(p => `
            <div class="activity-item" onclick="navigate('projects/${p.id}')" style="cursor:pointer;">
              <div class="activity-icon" style="background:#1565C020;color:#1565C0;">🚀</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:#E2EBF6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
                <div style="font-size:11px;color:#4E6A8A;">${p.projectCode} · ${p.status}</div>
              </div>
            </div>`).join('')}
      </div>

      <!-- Notifications -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Notifications ${unread > 0 ? `<span class="nav-badge" style="display:inline;">${unread}</span>` : ''}</div>
        </div>
        ${notifications.length === 0
          ? '<div class="empty-state" style="padding:30px 10px;"><p>No new notifications.</p></div>'
          : notifications.map(n => `
            <div class="activity-item">
              <div class="activity-icon" style="background:${n.type === 'warning' ? '#FFECB3' : '#E3F2FD'};color:${n.type === 'warning' ? '#E65100' : '#1565C0'};">
                ${n.type === 'warning' ? '⚠️' : 'ℹ️'}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:#E2EBF6;">${n.title || 'Notification'}</div>
                <div style="font-size:12px;color:#4E6A8A;">${n.message}</div>
              </div>
            </div>`).join('')}
      </div>
    </div>
  `;
}

/* ─── SALES DASHBOARD ────────────────────────────────────────── */
async function renderSalesDashboard(user, deptId, fmt) {
  const { db } = window.KwezaDB;
  let [leads, clients, quotations, requests] = await Promise.all([
    db.leads.toArray(),
    db.clients.toArray(),
    db.quotations.toArray(),
    db.serviceRequests.toArray()
  ]);

  if (deptId) {
    leads       = leads.filter(l => l.departmentId === deptId);
    clients     = clients.filter(c => c.departmentId === deptId);
    quotations  = quotations.filter(q => q.departmentId === deptId);
    requests    = requests.filter(r => r.departmentId === deptId);
  }

  const newLeads  = leads.filter(l  => l.status === 'New').length;
  const qualified = leads.filter(l  => l.status === 'Qualified').length;
  const converted = leads.filter(l  => l.status === 'Converted').length;
  const winRate   = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0;
  const pendingQ  = quotations.filter(q => q.status === 'pending' || q.status === 'draft').length;

  document.getElementById('dashboard-page').innerHTML = `
    <div style="margin-bottom:24px;padding:20px 24px;background:linear-gradient(135deg,rgba(106,27,154,0.3),rgba(123,31,162,0.1));border:1px solid rgba(106,27,154,0.25);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:#E2EBF6;">Welcome, ${user?.name} 📈</div>
        <div style="font-size:13px;color:#4E6A8A;margin-top:4px;">${user?.department} — Pipeline Overview</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="navigate('leads')">✨ New Lead</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('quotations')">📋 Quotations</button>
      </div>
    </div>

    <div class="grid grid-3">
      <div class="stat-card teal animate-in" onclick="navigate('leads')" style="cursor:pointer;">
        <div class="stat-card-icon">🎯</div>
        <div class="stat-card-label">Total Leads</div>
        <div class="stat-card-value">${leads.length}</div>
      </div>
      <div class="stat-card gold animate-in" onclick="navigate('leads')" style="cursor:pointer;">
        <div class="stat-card-icon">⭐</div>
        <div class="stat-card-label">Qualified</div>
        <div class="stat-card-value">${qualified}</div>
      </div>
      <div class="stat-card green animate-in" onclick="navigate('leads')" style="cursor:pointer;">
        <div class="stat-card-icon">🏆</div>
        <div class="stat-card-label">Win Rate</div>
        <div class="stat-card-value">${winRate}%</div>
      </div>
    </div>
    <div class="grid grid-3" style="margin-top:16px;">
      <div class="stat-card outline animate-in" onclick="navigate('leads')" style="cursor:pointer;">
        <div class="stat-card-icon">🆕</div>
        <div class="stat-card-label">New Leads</div>
        <div class="stat-card-value">${newLeads}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('clients')" style="cursor:pointer;">
        <div class="stat-card-icon">👥</div>
        <div class="stat-card-label">Total Clients</div>
        <div class="stat-card-value">${clients.length}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('quotations')" style="cursor:pointer;">
        <div class="stat-card-icon">📋</div>
        <div class="stat-card-label">Pending Quotes</div>
        <div class="stat-card-value">${pendingQ}</div>
      </div>
    </div>
  `;
}

/* ─── FINANCE DASHBOARD ──────────────────────────────────────── */
async function renderFinanceDashboard(user, deptId, currency, fmt) {
  const { db } = window.KwezaDB;
  const [invoices, payments, loans] = await Promise.all([
    db.invoices.toArray(),
    db.payments.toArray(),
    db.loans.toArray()
  ]);

  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding    = invoices.filter(i => !['paid','project_created'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0);
  const overdue        = invoices.filter(i => i.dueDate && new Date(i.dueDate) < new Date() && !['paid','project_created'].includes(i.status)).length;
  const activeLoan     = loans.filter(l => l.status === 'active').reduce((s, l) => s + (l.balance || 0), 0);

  document.getElementById('dashboard-page').innerHTML = `
    <div style="margin-bottom:24px;padding:20px 24px;background:linear-gradient(135deg,rgba(46,125,50,0.3),rgba(56,142,60,0.1));border:1px solid rgba(46,125,50,0.25);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:#E2EBF6;">Finance Desk 💰</div>
        <div style="font-size:13px;color:#4E6A8A;margin-top:4px;">Revenue, billing and payment tracking</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="navigate('invoices')">🧾 Invoices</button>
      </div>
    </div>

    <div class="grid grid-3">
      <div class="stat-card teal animate-in">
        <div class="stat-card-icon">💵</div>
        <div class="stat-card-label">Total Collected</div>
        <div class="stat-card-value">${fmt(totalCollected)}</div>
      </div>
      <div class="stat-card gold animate-in">
        <div class="stat-card-icon">⏳</div>
        <div class="stat-card-label">Outstanding</div>
        <div class="stat-card-value">${fmt(outstanding)}</div>
      </div>
      <div class="stat-card outline animate-in" style="border-color:${overdue > 0 ? '#C62828' : 'inherit'};">
        <div class="stat-card-icon">🔴</div>
        <div class="stat-card-label">Overdue Invoices</div>
        <div class="stat-card-value" style="color:${overdue > 0 ? '#C62828' : 'inherit'}">${overdue}</div>
      </div>
    </div>
    <div class="grid grid-3" style="margin-top:16px;">
      <div class="stat-card outline animate-in">
        <div class="stat-card-icon">📄</div>
        <div class="stat-card-label">Total Invoices</div>
        <div class="stat-card-value">${invoices.length}</div>
      </div>
      <div class="stat-card outline animate-in">
        <div class="stat-card-icon">✅</div>
        <div class="stat-card-label">Paid</div>
        <div class="stat-card-value" style="color:#2E7D32">${invoices.filter(i => ['paid','project_created'].includes(i.status)).length}</div>
      </div>
      <div class="stat-card outline animate-in">
        <div class="stat-card-icon">💳</div>
        <div class="stat-card-label">Active Loan Balance</div>
        <div class="stat-card-value">${fmt(activeLoan)}</div>
      </div>
    </div>

    <div class="card" style="margin-top:24px;">
      <div class="card-header">
        <div class="card-title">Revenue (Last 6 Months)</div>
      </div>
      <div class="chart-container"><canvas id="revenue-chart"></canvas></div>
    </div>
  `;

  const months = await getMonthlyRevenueForDashboard();
  const ctx    = document.getElementById('revenue-chart')?.getContext('2d');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels:   months.map(m => m.label),
      datasets: [{
        label: 'Collected',
        data:  months.map(m => m.total),
        borderColor: '#2E7D32',
        backgroundColor: 'rgba(46,125,50,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* ─── REVENUE HELPER ─────────────────────────────────────────── */
async function getMonthlyRevenueForDashboard() {
  const payments = await window.KwezaDB.db.payments.toArray();
  const months   = [];
  for (let index = 5; index >= 0; index -= 1) {
    const current = new Date();
    current.setMonth(current.getMonth() - index);
    const label = current.toLocaleDateString('en', { month: 'short', year: '2-digit' });
    const start = new Date(current.getFullYear(), current.getMonth(), 1).toISOString();
    const end   = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const total = payments
      .filter(p => p.date >= start && p.date <= end)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    months.push({ label, total });
  }
  return months;
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderDashboard });
