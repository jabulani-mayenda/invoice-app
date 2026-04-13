/* ============================================
   KWEZA - REPORTS PAGE
   ============================================ */

async function renderReports() {
  const { db } = window.KwezaDB;
  const [reports, departments, sales, invoices] = await Promise.all([
    db.projectReports.orderBy('id').reverse().toArray(),
    db.departments.toArray(),
    db.sales.toArray(),
    db.invoices.toArray()
  ]);

  const departmentMap = Object.fromEntries(departments.map(department => [department.id, department]));
  const salesMap = Object.fromEntries(sales.map(sale => [sale.id, sale]));
  const invoiceMap = Object.fromEntries(invoices.map(invoice => [invoice.id, invoice]));

  document.getElementById('reports-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Department Reports</h2>
        <p>Progress, issues, completion and financial reports linked to sales.</p>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" onclick="openExportModal()">Export</button>
        <button class="btn btn-primary" onclick="openProjectReportModal()">+ New Report</button>
      </div>
    </div>

    ${reports.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📑</div><h3>No reports yet</h3><p>Every project should have progress and completion reporting.</p></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${reports.map(report => projectReportCardHTML(report, departmentMap[report.departmentId], salesMap[report.saleId], invoiceMap[report.invoiceId])).join('')}</div>`}
  `;
}

function projectReportCardHTML(report, department, sale, invoice) {
  return `
    <div class="doc-card">
      <div class="doc-card-icon quote">📑</div>
      <div class="doc-card-info">
        <div class="doc-number">${report.reportCode || '-'}</div>
        <div class="doc-client">${department?.name || report.departmentId || '-'} · ${report.type || '-'}</div>
        <div class="doc-date">${sale?.saleCode || 'No sale linked'} ${invoice?.number ? `· ${invoice.number}` : ''}</div>
        <div class="doc-prepared">${report.description || 'No description'}</div>
      </div>
      <div class="doc-card-right">
        <span class="badge badge-muted">${report.status || 'Open'}</span>
        <button class="btn btn-secondary btn-sm" onclick="openProjectReportModal(${report.id})">Edit</button>
      </div>
    </div>
  `;
}

async function openProjectReportModal(reportId = null) {
  const [departments, sales, invoices, tasks, report] = await Promise.all([
    window.KwezaDB.db.departments.orderBy('name').toArray(),
    window.KwezaDB.db.sales.orderBy('id').reverse().toArray(),
    window.KwezaDB.db.invoices.orderBy('id').reverse().toArray(),
    window.KwezaDB.db.operationTasks.orderBy('id').reverse().toArray(),
    reportId ? window.KwezaDB.db.projectReports.get(reportId) : Promise.resolve(null)
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${report ? 'Edit Report' : 'New Report'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Department</label>
            <select class="form-control" id="rp-department">
              ${departments.map(department => `<option value="${department.id}" ${report?.departmentId === department.id ? 'selected' : ''}>${department.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-control" id="rp-type">
              ${['Progress', 'Issue', 'Completion', 'Financial'].map(type => `<option value="${type}" ${report?.type === type ? 'selected' : ''}>${type}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Sale</label>
            <select class="form-control" id="rp-sale">
              <option value="">- Select sale -</option>
              ${sales.map(sale => `<option value="${sale.id}" ${report?.saleId === sale.id ? 'selected' : ''}>${sale.saleCode} · ${sale.service}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Invoice</label>
            <select class="form-control" id="rp-invoice">
              <option value="">- Select invoice -</option>
              ${invoices.map(invoice => `<option value="${invoice.id}" ${report?.invoiceId === invoice.id ? 'selected' : ''}>${invoice.number}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Task</label>
          <select class="form-control" id="rp-task">
            <option value="">- Select task -</option>
            ${tasks.map(task => `<option value="${task.id}" ${report?.taskId === task.id ? 'selected' : ''}>${task.taskCode} · ${task.task}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="rp-description" rows="4" placeholder="Provide the update or issue summary">${report?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="rp-status">
            ${['Open', 'Submitted', 'Approved', 'Closed'].map(status => `<option value="${status}" ${report?.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProjectReport(${reportId || 'null'})">Save Report</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}

async function saveProjectReport(reportId = null) {
  const saleId = parseInt(document.getElementById('rp-sale').value, 10) || null;
  if (!saleId) {
    showToast('Every report must be linked to a sale.', 'error');
    return;
  }

  const payload = {
    departmentId: document.getElementById('rp-department').value,
    saleId,
    invoiceId: parseInt(document.getElementById('rp-invoice').value, 10) || null,
    taskId: parseInt(document.getElementById('rp-task').value, 10) || null,
    type: document.getElementById('rp-type').value,
    description: document.getElementById('rp-description').value.trim(),
    status: document.getElementById('rp-status').value,
    date: new Date().toISOString()
  };

  if (reportId) {
    await window.KwezaDB.db.projectReports.update(reportId, payload);
  } else {
    await window.KwezaDB.createProjectReport(payload);
  }

  showToast('Report saved', 'success');
  closeModal();
  await renderReports();
}

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
            <option value="projectReports">Project Reports</option>
            <option value="serviceRequests">Service Requests</option>
            <option value="sales">Sales</option>
            <option value="operationTasks">Operation Tasks</option>
            <option value="invoices">Invoices</option>
            <option value="quotations">Quotations</option>
            <option value="clients">Clients</option>
            <option value="payments">Payments</option>
            <option value="departments">Departments</option>
            <option value="employees">Employees</option>
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

async function downloadReport() {
  const type = document.getElementById('report-type').value;
  const { db } = window.KwezaDB;
  const records = await db[type].toArray();

  if (!records.length) {
    window.showToast('No records found for this dataset.', 'error');
    return;
  }

  const keys = Object.keys(records[0]).filter(key => typeof records[0][key] !== 'object');
  const csvRows = [keys.join(',')];
  for (const row of records) {
    csvRows.push(keys.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Kweza_${type}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  closeModal();
  window.showToast('Report downloaded', 'success');
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderReports, openProjectReportModal, saveProjectReport, openExportModal, downloadReport });
