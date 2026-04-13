/* ============================================
   KWEZA - DASHBOARD PAGE
   ============================================ */

async function renderDashboard() {
  const { getAllSettings, db, getWorkflowStats } = window.KwezaDB;
  const user = window.KwezaAuth?.getCurrentUser?.();

  const [settings, invoices, workflow, recentActivity, reports] = await Promise.all([
    getAllSettings(),
    db.invoices.toArray(),
    getWorkflowStats(),
    db.activity.orderBy('id').reverse().limit(8).toArray(),
    db.projectReports.toArray()
  ]);

  const currency = settings.defaults.currency || 'MWK';
  const paidInvoices = invoices.filter(invoice => invoice.status === 'paid');
  const totalRevenue = paidInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
  const outstanding = invoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + (invoice.total || 0), 0);
  const progressReports = reports.filter(report => report.type === 'Progress').length;

  document.getElementById('dashboard-page').innerHTML = `
    <div style="margin-bottom:24px;padding:20px 24px;background:linear-gradient(135deg,rgba(0,97,107,0.35),rgba(0,151,167,0.15));border:1px solid rgba(0,151,167,0.25);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:#E2EBF6;">Welcome, ${user?.name || 'Team'}</div>
        <div style="font-size:13px;color:#4E6A8A;margin-top:4px;">Client → Request → Sale → Quote → Invoice → Payment → Operations → Report → Completion</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="navigate('requests')">New Request</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('sales')">Sales Queue</button>
      </div>
    </div>

    <div class="grid grid-3">
      <div class="stat-card teal animate-in">
        <div class="stat-card-icon">💵</div>
        <div class="stat-card-label">Total Revenue</div>
        <div class="stat-card-value">${currency} ${Number(totalRevenue).toLocaleString()}</div>
      </div>
      <div class="stat-card gold animate-in">
        <div class="stat-card-icon">⏳</div>
        <div class="stat-card-label">Outstanding Balances</div>
        <div class="stat-card-value">${currency} ${Number(outstanding).toLocaleString()}</div>
      </div>
      <div class="stat-card green animate-in">
        <div class="stat-card-icon">📈</div>
        <div class="stat-card-label">Active Projects</div>
        <div class="stat-card-value">${workflow.activeTasks}</div>
      </div>
    </div>

    <div class="grid grid-3" style="margin-top:16px;">
      <div class="stat-card outline animate-in" onclick="navigate('operations')" style="cursor:pointer;">
        <div class="stat-card-icon">✅</div>
        <div class="stat-card-label">Completed Projects</div>
        <div class="stat-card-value">${workflow.completedTasks}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('reports')" style="cursor:pointer;">
        <div class="stat-card-icon">🧩</div>
        <div class="stat-card-label">ICT / Progress Reports</div>
        <div class="stat-card-value">${progressReports}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('organization')" style="cursor:pointer;">
        <div class="stat-card-icon">🏢</div>
        <div class="stat-card-label">Department Performance Inputs</div>
        <div class="stat-card-value">${workflow.reportCount}</div>
      </div>
    </div>

    <div class="grid grid-3" style="margin-top:16px;">
      <div class="stat-card outline animate-in" onclick="navigate('requests')" style="cursor:pointer;">
        <div class="stat-card-icon">📨</div>
        <div class="stat-card-label">Open Requests</div>
        <div class="stat-card-value">${workflow.activeRequests}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('sales')" style="cursor:pointer;">
        <div class="stat-card-icon">🛒</div>
        <div class="stat-card-label">Active Sales</div>
        <div class="stat-card-value">${workflow.activeSales}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('invoices')" style="cursor:pointer;">
        <div class="stat-card-icon">🧾</div>
        <div class="stat-card-label">Invoices Issued</div>
        <div class="stat-card-value">${invoices.length}</div>
      </div>
    </div>

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
          ${recentActivity.length === 0
            ? '<div class="empty-state" style="padding:30px 10px;"><div class="empty-state-icon" style="font-size:32px;">🌱</div><p>No activity yet.</p></div>'
            : recentActivity.map(item => `
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
  const ctx = document.getElementById('revenue-chart')?.getContext('2d');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(month => month.label),
      datasets: [{
        label: 'Revenue',
        data: months.map(month => month.total),
        backgroundColor: months.map((month, index) => index === months.length - 1 ? '#0097A7' : 'rgba(0,151,167,0.35)'),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

async function getMonthlyRevenueForDashboard() {
  const invoices = await window.KwezaDB.db.invoices.where('status').equals('paid').toArray();
  const months = [];
  for (let index = 5; index >= 0; index -= 1) {
    const current = new Date();
    current.setMonth(current.getMonth() - index);
    const label = current.toLocaleDateString('en', { month: 'short', year: '2-digit' });
    const start = new Date(current.getFullYear(), current.getMonth(), 1).toISOString();
    const end = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const total = invoices.filter(invoice => invoice.date >= start && invoice.date <= end).reduce((sum, invoice) => sum + (invoice.total || 0), 0);
    months.push({ label, total });
  }
  return months;
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderDashboard });
