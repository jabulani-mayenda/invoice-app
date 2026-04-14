/* ============================================
   KWEZA - REPORTS PAGE (v2)
   Reports now linked to Projects
   Dept-scoped: each role sees their own reports
   ============================================ */

const REPORT_TYPES = ['Daily', 'Weekly', 'Issue', 'Completion'];
const REPORT_TYPE_COLORS = {
  Daily:      '#1565C0',
  Weekly:     '#6A1B9A',
  Issue:      '#C62828',
  Completion: '#2E7D32'
};

async function renderReports() {
  const { db } = window.KwezaDB;
  const user   = window.KwezaAuth.getCurrentUser();
  const deptId = window.KwezaAuth.getDeptFilter();

  // Load both new (department_reports) and legacy (project_reports)
  const [newReports, legacyReports, projects, departments, sales, invoices] = await Promise.all([
    db.departmentReports.orderBy('id').reverse().toArray(),
    db.projectReports.orderBy('id').reverse().toArray(),
    db.projects.toArray(),
    db.departments.toArray(),
    db.sales.toArray(),
    db.invoices.toArray()
  ]);

  // Apply dept filter
  const filteredNew    = deptId ? newReports.filter(r => r.departmentId === deptId) : newReports;
  const filteredLegacy = deptId ? legacyReports.filter(r => r.departmentId === deptId) : legacyReports;

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const deptMap    = Object.fromEntries(departments.map(d => [d.id, d]));
  const salesMap   = Object.fromEntries(sales.map(s => [s.id, s]));
  const invoiceMap = Object.fromEntries(invoices.map(i => [i.id, i]));

  // Stats
  const completionCount = filteredNew.filter(r => r.type === 'Completion').length;
  const issueCount      = filteredNew.filter(r => r.type === 'Issue').length;
  const pendingCount    = filteredNew.filter(r => r.status === 'Open').length;

  document.getElementById('reports-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Department Reports</h2>
        <p>Progress, issues and completion reports linked to projects</p>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" onclick="openExportModal()">Export CSV</button>
        <button class="btn btn-primary" onclick="openNewReportModal()">+ New Report</button>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-value">${filteredNew.length}</div>
        <div class="stat-label">Total Reports</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#C62828">${issueCount}</div>
        <div class="stat-label">Issues Filed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#2E7D32">${completionCount}</div>
        <div class="stat-label">Completions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#E65100">${pendingCount}</div>
        <div class="stat-label">Open / Unreviewed</div>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      <select class="form-control" id="rpt-filter-type" style="max-width:180px;" onchange="filterReports()">
        <option value="">All Types</option>
        ${REPORT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
      <select class="form-control" id="rpt-filter-status" style="max-width:180px;" onchange="filterReports()">
        <option value="">All Statuses</option>
        ${['Open','Reviewed','Approved'].map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>

    ${filteredNew.length === 0 && filteredLegacy.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📑</div><h3>No reports yet</h3><p>Submit reports from the Project detail view or use the button above.</p></div>`
      : `<div id="reports-list" style="display:flex;flex-direction:column;gap:10px;">
          ${filteredNew.map(r => newReportCardHTML(r, projectMap[r.projectId], deptMap[r.departmentId])).join('')}
          ${filteredLegacy.length > 0 ? `
            <div style="margin:12px 0;font-size:12px;color:var(--text-secondary);font-weight:600;letter-spacing:0.05em;">⬇ LEGACY REPORTS (pre-project workflow)</div>
            ${filteredLegacy.map(r => legacyReportCardHTML(r, deptMap[r.departmentId], salesMap[r.saleId], invoiceMap[r.invoiceId])).join('')}
          ` : ''}
        </div>`}
  `;
}
window.renderReports = renderReports;

function newReportCardHTML(report, project, dept) {
  const color = REPORT_TYPE_COLORS[report.type] || '#607D8B';
  const date  = report.date ? new Date(report.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—';

  return `
    <div class="doc-card report-card" data-report-type="${report.type}" data-report-status="${report.status}">
      <div class="doc-card-icon" style="background:${color}20;color:${color};font-size:18px;">📑</div>
      <div class="doc-card-info">
        <div class="doc-number">${report.reportCode || '—'} · <strong>${report.type} Report</strong></div>
        <div class="doc-client">
          ${dept?.name || report.departmentId || '—'}
          ${project ? ` · <a href="#" onclick="navigate('projects/${project.id}');return false;" style="color:var(--primary);">${project.projectCode} — ${project.name}</a>` : ''}
        </div>
        <div class="doc-date">${date} · By: ${report.submittedBy || '—'}</div>
        ${report.description ? `<div class="doc-prepared">${report.description.substring(0, 120)}${report.description.length > 120 ? '...' : ''}</div>` : ''}
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${color}15;color:${color};border:1px solid ${color}30;">${report.type}</span>
        <span class="badge ${report.status === 'Approved' ? 'badge-success' : report.status === 'Reviewed' ? 'badge-gold' : 'badge-muted'}">${report.status}</span>
        ${window.KwezaAuth.hasRole('admin','administration')
          ? `<button class="btn btn-secondary btn-sm" onclick="openEditReportModal(${report.id})">Review</button>` : ''}
      </div>
    </div>`;
}

function legacyReportCardHTML(report, dept, sale, invoice) {
  return `
    <div class="doc-card report-card" data-report-type="${report.type}" data-report-status="${report.status}" style="opacity:0.75;">
      <div class="doc-card-icon" style="font-size:18px;color:#607D8B;">📄</div>
      <div class="doc-card-info">
        <div class="doc-number">${report.reportCode || '—'} · ${report.type}</div>
        <div class="doc-client">${dept?.name || report.departmentId || '—'} · ${sale?.saleCode || 'No sale'} ${invoice?.number ? `· ${invoice.number}` : ''}</div>
        <div class="doc-prepared">${report.description || 'No description'}</div>
      </div>
      <div class="doc-card-right">
        <span class="badge badge-muted">${report.status || 'Open'}</span>
        <button class="btn btn-secondary btn-sm" onclick="openEditLegacyReportModal(${report.id})">Edit</button>
      </div>
    </div>`;
}

function filterReports() {
  const type   = document.getElementById('rpt-filter-type')?.value   || '';
  const status = document.getElementById('rpt-filter-status')?.value || '';
  document.querySelectorAll('.report-card').forEach(card => {
    const typeMatch   = !type   || card.dataset.reportType   === type;
    const statusMatch = !status || card.dataset.reportStatus === status;
    card.style.display = typeMatch && statusMatch ? '' : 'none';
  });
}
window.filterReports = filterReports;

/* ─── NEW REPORT MODAL ───────────────────────────────────────── */
async function openNewReportModal() {
  const user = window.KwezaAuth.getCurrentUser();
  const deptId = window.KwezaAuth.getDeptFilter();

  let projects = await window.KwezaDB.db.projects.orderBy('id').reverse().toArray();
  if (deptId) projects = projects.filter(p => p.departmentId === deptId);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>New Report</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Report Type <span>*</span></label>
            <select class="form-control" id="new-rpt-type">
              ${REPORT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-control" id="new-rpt-date" type="date" value="${new Date().toISOString().substring(0,10)}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Linked Project</label>
          <select class="form-control" id="new-rpt-project">
            <option value="">— No project (standalone report) —</option>
            ${projects.map(p => `<option value="${p.id}">${p.projectCode} — ${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description <span>*</span></label>
          <textarea class="form-control" id="new-rpt-desc" rows="5" placeholder="Describe work done, issues found, or completion summary..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitNewReport()">Submit Report</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openNewReportModal = openNewReportModal;

async function submitNewReport() {
  const user = window.KwezaAuth.getCurrentUser();
  const desc = document.getElementById('new-rpt-desc')?.value?.trim();
  if (!desc) { showToast('Description is required.', 'error'); return; }

  const projectIdVal = document.getElementById('new-rpt-project')?.value;
  const dateVal      = document.getElementById('new-rpt-date')?.value;
  const reportCode   = await window.KwezaDB.getNextSequenceCode('reportNumberSeq', 'RPT');

  await window.KwezaDB.db.departmentReports.add({
    reportCode,
    projectId:    parseInt(projectIdVal, 10) || null,
    departmentId: user?.id || '',
    type:         document.getElementById('new-rpt-type')?.value || 'Daily',
    description:  desc,
    status:       'Open',
    date:         dateVal ? new Date(dateVal).toISOString() : new Date().toISOString(),
    submittedBy:  user?.id || '',
    createdAt:    new Date().toISOString()
  });

  showToast('Report submitted.', 'success');
  closeModal();
  await renderReports();
}
window.submitNewReport = submitNewReport;

/* ─── EDIT / REVIEW MODAL ────────────────────────────────────── */
async function openEditReportModal(reportId) {
  const report = await window.KwezaDB.db.departmentReports.get(reportId);
  if (!report) return;

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Review Report — ${report.reportCode}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="background:var(--surface);padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px;">
          <strong>${report.type} Report</strong> — ${new Date(report.date).toLocaleDateString('en-GB')}<br>
          <span style="color:var(--text-secondary);">By: ${report.submittedBy || '—'}</span><br>
          <p style="margin-top:8px;">${report.description}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Update Status</label>
          <select class="form-control" id="edit-rpt-status">
            ${['Open','Reviewed','Approved'].map(s => `<option value="${s}" ${report.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="updateReportStatus(${reportId})">Save</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openEditReportModal = openEditReportModal;

async function updateReportStatus(reportId) {
  const status = document.getElementById('edit-rpt-status')?.value;
  await window.KwezaDB.db.departmentReports.update(reportId, { status });
  showToast('Report status updated.', 'success');
  closeModal();
  await renderReports();
}
window.updateReportStatus = updateReportStatus;

/* ─── LEGACY REPORT EDIT ─────────────────────────────────────── */
async function openEditLegacyReportModal(reportId) {
  const [departments, sales, invoices, tasks, report] = await Promise.all([
    window.KwezaDB.db.departments.orderBy('name').toArray(),
    window.KwezaDB.db.sales.orderBy('id').reverse().toArray(),
    window.KwezaDB.db.invoices.orderBy('id').reverse().toArray(),
    window.KwezaDB.db.operationTasks.orderBy('id').reverse().toArray(),
    window.KwezaDB.db.projectReports.get(reportId)
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${report ? 'Edit Legacy Report' : 'New Report'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Department</label>
            <select class="form-control" id="rp-department">
              ${departments.map(d => `<option value="${d.id}" ${report?.departmentId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-control" id="rp-type">
              ${['Progress','Issue','Completion','Financial'].map(t => `<option value="${t}" ${report?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Sale</label>
            <select class="form-control" id="rp-sale">
              <option value="">- Select sale -</option>
              ${sales.map(s => `<option value="${s.id}" ${report?.saleId === s.id ? 'selected' : ''}>${s.saleCode} · ${s.service}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Invoice</label>
            <select class="form-control" id="rp-invoice">
              <option value="">- Select invoice -</option>
              ${invoices.map(i => `<option value="${i.id}" ${report?.invoiceId === i.id ? 'selected' : ''}>${i.number}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="rp-description" rows="4">${report?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="rp-status">
            ${['Open','Submitted','Approved','Closed'].map(s => `<option value="${s}" ${report?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveLegacyReport(${reportId || 'null'})">Save</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openEditLegacyReportModal = openEditLegacyReportModal;

async function saveLegacyReport(reportId = null) {
  const saleId = parseInt(document.getElementById('rp-sale')?.value, 10) || null;
  const payload = {
    departmentId: document.getElementById('rp-department')?.value,
    saleId:       saleId || 0,
    invoiceId:    parseInt(document.getElementById('rp-invoice')?.value, 10) || null,
    type:         document.getElementById('rp-type')?.value,
    description:  document.getElementById('rp-description')?.value?.trim(),
    status:       document.getElementById('rp-status')?.value,
    date:         new Date().toISOString()
  };

  if (reportId) {
    await window.KwezaDB.db.projectReports.update(reportId, payload);
  } else {
    await window.KwezaDB.createProjectReport({ ...payload, saleId: saleId || 0 });
  }

  showToast('Report saved.', 'success');
  closeModal();
  await renderReports();
}
window.saveLegacyReport = saveLegacyReport;

/* ─── EXPORT MODAL ───────────────────────────────────────────── */
async function openExportModal() {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header">
        <h3>Export Data</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Dataset</label>
          <select class="form-control" id="report-type">
            <option value="departmentReports">Project Reports (New)</option>
            <option value="projectReports">Reports (Legacy)</option>
            <option value="projects">Projects</option>
            <option value="projectTasks">Project Tasks</option>
            <option value="qaReviews">QA Reviews</option>
            <option value="serviceRequests">Service Requests</option>
            <option value="sales">Sales</option>
            <option value="operationTasks">Operation Tasks</option>
            <option value="invoices">Invoices</option>
            <option value="quotations">Quotations</option>
            <option value="clients">Clients</option>
            <option value="leads">Leads</option>
            <option value="payments">Payments</option>
            <option value="departments">Departments</option>
            <option value="employees">Employees</option>
            <option value="auditLogs">Audit Logs</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="downloadReport()">Download CSV</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openExportModal = openExportModal;

async function downloadReport() {
  const type    = document.getElementById('report-type')?.value;
  const { db }  = window.KwezaDB;
  const records = await db[type]?.toArray();

  if (!records || !records.length) {
    showToast('No records found for this dataset.', 'error');
    return;
  }

  const keys    = Object.keys(records[0]).filter(k => typeof records[0][k] !== 'object');
  const csvRows = [keys.join(',')];
  for (const row of records) {
    csvRows.push(keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','));
  }

  const blob   = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href     = url;
  anchor.download = `Kweza_${type}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  closeModal();
  showToast('Report downloaded.', 'success');
}
window.downloadReport = downloadReport;

/* ─── REGISTER ────────────────────────────────────────────────── */
window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, {
  renderReports, openNewReportModal, submitNewReport,
  openEditReportModal, updateReportStatus,
  openEditLegacyReportModal, saveLegacyReport,
  openExportModal, downloadReport, filterReports
});
