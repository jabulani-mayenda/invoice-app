/* ============================================
   KWEZA – DASHBOARD PAGE (with dept isolation)
   ============================================ */

/* ── Helper: get isolated stats ── */
async function getIsolatedDashboardStats() {
  const { db } = window.KwezaDB;
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  let [clients, invoices, quotations, loans] = await Promise.all([
    db.clients.toArray(),
    db.invoices.toArray(),
    db.quotations.toArray(),
    db.loans.toArray()
  ]);

  if (deptId) {
    // Include records with matching dept OR null dept (legacy data created before dept isolation)
    clients    = clients.filter(c => c.departmentId === deptId || c.departmentId === null || c.departmentId === undefined);
    invoices   = invoices.filter(i => i.departmentId === deptId || i.departmentId === null || i.departmentId === undefined);
    quotations = quotations.filter(q => q.departmentId === deptId || q.departmentId === null || q.departmentId === undefined);
    loans      = loans.filter(l => l.departmentId === deptId || l.departmentId === null || l.departmentId === undefined);
  }

  const monthInvoices = invoices.filter(i => i.date >= monthStart && i.date <= monthEnd);
  const monthRevenue  = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const outstanding   = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const totalRevenue  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const overdueLoan   = loans.filter(l => l.status === 'overdue' || (l.dueDate && l.dueDate < now.toISOString() && l.status !== 'paid')).length;
  const pendingQuotes = quotations.filter(q => q.status === 'pending').length;

  return { clients: clients.length, monthRevenue, outstanding, totalRevenue, overdueLoan, pendingQuotes, totalInvoices: invoices.length };
}

async function renderDashboard() {
  const { getAllSettings, db } = window.KwezaDB;
  const user   = window.KwezaAuth?.getCurrentUser?.();
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;

  const [stats, settings, recentActivity] = await Promise.all([
    getIsolatedDashboardStats(),
    getAllSettings(),
    db.activity.orderBy('id').reverse().limit(8).toArray()
  ]);
  const currency = settings.defaults.currency || 'MWK';
  const fmt = n => `${currency} ${Number(n||0).toLocaleString()}`;
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  document.getElementById('dashboard-page').innerHTML = `
    <!-- Welcome Banner -->
    <div style="margin-bottom:24px;padding:20px 24px;background:linear-gradient(135deg,rgba(0,97,107,0.35),rgba(0,151,167,0.15));border:1px solid rgba(0,151,167,0.25);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:22px;font-weight:800;color:#E2EBF6;">${greeting}, ${user?.name || 'there'} ${user?.icon || '👋'}</div>
        <div style="font-size:13px;color:#4E6A8A;margin-top:4px;">${user?.department || 'Kweza Financial'} · ${now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="navigate('quotations/new')">✨ New Quote</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('invoices/new')">🧾 New Invoice</button>
      </div>
    </div>

    <!-- Primary Stats -->
    <div class="grid grid-3">
      <div class="stat-card teal animate-in">
        <div class="stat-card-icon">💵</div>
        <div class="stat-card-label">Revenue This Month</div>
        <div class="stat-card-value">${fmt(stats.monthRevenue)}</div>
        <div class="stat-card-trend up">↑ Paid invoices</div>
      </div>
      <div class="stat-card gold animate-in">
        <div class="stat-card-icon">⏳</div>
        <div class="stat-card-label">Outstanding</div>
        <div class="stat-card-value">${fmt(stats.outstanding)}</div>
        <div class="stat-card-trend">Unpaid invoices</div>
      </div>
      <div class="stat-card green animate-in">
        <div class="stat-card-icon">📈</div>
        <div class="stat-card-label">Total Collected</div>
        <div class="stat-card-value">${fmt(stats.totalRevenue)}</div>
        <div class="stat-card-trend up">All time</div>
      </div>
    </div>

    <!-- Secondary Stats -->
    <div class="grid grid-3" style="margin-top:16px;">
      <div class="stat-card outline animate-in" onclick="navigate('clients')" style="cursor:pointer;">
        <div class="stat-card-icon">👥</div>
        <div class="stat-card-label">Total Clients</div>
        <div class="stat-card-value">${stats.clients}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('quotations')" style="cursor:pointer;">
        <div class="stat-card-icon">📋</div>
        <div class="stat-card-label">Pending Quotes</div>
        <div class="stat-card-value">${stats.pendingQuotes}</div>
      </div>
      <div class="stat-card outline animate-in" onclick="navigate('loans')" style="cursor:pointer;">
        <div class="stat-card-icon">🏦</div>
        <div class="stat-card-label">Overdue Loans</div>
        <div class="stat-card-value" style="${stats.overdueLoan > 0 ? 'color:#EF5350;' : ''}">${stats.overdueLoan}</div>
      </div>
    </div>

    <!-- Chart + Activity -->
    <div class="grid grid-2" style="margin-top:24px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 Revenue (Last 6 Months)</div>
        </div>
        <div class="chart-container"><canvas id="revenue-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚡ Recent Activity</div>
        </div>
        <div class="activity-feed">
          ${recentActivity.length === 0
            ? '<div class="empty-state" style="padding:30px 10px;"><div class="empty-state-icon" style="font-size:32px;">🌱</div><p>No activity yet — create your first invoice!</p></div>'
            : recentActivity.map((a, idx) => `
              <div class="activity-item animate-in" style="animation-delay:${idx * 50}ms;">
                <div class="activity-icon ${a.type==='payment'?'bg-success':a.type==='invoice'?'bg-primary':a.type==='loan_payment'?'bg-green':'bg-gold'}">
                  ${a.type==='payment'?'💰':a.type==='invoice'?'🧾':a.type==='loan_payment'?'🏦':'📋'}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;color:#E2EBF6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.description}</div>
                  <div style="font-size:11px;color:#4E6A8A;margin-top:2px;">${new Date(a.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                ${a.amount > 0 ? `<div style="font-weight:700;font-size:13px;color:${a.type==='payment'||a.type==='loan_payment'?'#00E676':'#E2EBF6'};white-space:nowrap;">${a.type==='payment'||a.type==='loan_payment'?'+':''}${fmt(a.amount)}</div>` : ''}
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="margin-top:20px;">
      <div class="section-title">Quick Actions</div>
      <div class="grid grid-4">
        <button class="btn btn-secondary" style="flex-direction:column;gap:8px;padding:18px;height:auto;" onclick="navigate('clients')">
          <span style="font-size:24px;">👥</span><span style="font-size:13px;">Add Client</span>
        </button>
        <button class="btn btn-secondary" style="flex-direction:column;gap:8px;padding:18px;height:auto;" onclick="navigate('quotations/new')">
          <span style="font-size:24px;">📋</span><span style="font-size:13px;">New Quote</span>
        </button>
        <button class="btn btn-secondary" style="flex-direction:column;gap:8px;padding:18px;height:auto;" onclick="navigate('invoices/new')">
          <span style="font-size:24px;">🧾</span><span style="font-size:13px;">New Invoice</span>
        </button>
        <button class="btn btn-secondary" style="flex-direction:column;gap:8px;padding:18px;height:auto;" onclick="navigate('loans')">
          <span style="font-size:24px;">💰</span><span style="font-size:13px;">Record Loan</span>
        </button>
      </div>
    </div>
  `;

  // Revenue chart
  const months = await getIsolatedMonthlyRevenue();
  const ctx = document.getElementById('revenue-chart')?.getContext('2d');
  if (ctx) {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [{
          label: 'Revenue',
          data: months.map(m => m.total),
          backgroundColor: months.map((m, i) => i === months.length - 1 ? '#0097A7' : 'rgba(0,151,167,0.35)'),
          borderRadius: 6,
          borderSkipped: false
        }, {
          label: 'Target',
          data: months.map(() => 0),
          type: 'line',
          borderColor: 'rgba(0,200,83,0.3)',
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(14,28,47,0.95)',
            borderColor: 'rgba(0,151,167,0.3)',
            borderWidth: 1,
            titleColor: '#E2EBF6',
            bodyColor: '#8FA3BF',
            padding: 12,
            callbacks: { label: ctx => ` ${currency} ${Number(ctx.raw).toLocaleString()}` }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#4E6A8A', font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#4E6A8A', font: { size: 11 },
              callback: v => v >= 1000000 ? `${v/1000000}M` : v >= 1000 ? `${v/1000}k` : v
            }
          }
        }
      }
    });
  }
}

async function getIsolatedMonthlyRevenue() {
  const { db } = window.KwezaDB;
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;
  let invoices = await db.invoices.where('status').equals('paid').toArray();
  if (deptId) {
    invoices = invoices.filter(i => i.departmentId === deptId || i.departmentId === null || i.departmentId === undefined);
  }

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const total = invoices.filter(inv => inv.date >= start && inv.date <= end).reduce((s, inv) => s + (inv.total || 0), 0);
    months.push({ label, total });
  }
  return months;
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderDashboard });
