/* ============================================
   KWEZA - OPERATIONS PAGE
   ============================================ */

async function renderOperations() {
  const { db } = window.KwezaDB;
  const [tasks, sales, departments, invoices, reports] = await Promise.all([
    db.operationTasks.orderBy('id').reverse().toArray(),
    db.sales.toArray(),
    db.departments.toArray(),
    db.invoices.toArray(),
    db.projectReports.toArray()
  ]);

  const salesMap = Object.fromEntries(sales.map(sale => [sale.id, sale]));
  const departmentMap = Object.fromEntries(departments.map(department => [department.id, department]));
  const reportsBySale = reports.reduce((map, report) => {
    const key = report.saleId || 'none';
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});
  const paidInvoiceSaleIds = new Set(
    invoices.filter(invoice => invoice.status === 'paid').map(invoice => invoice.saleId).filter(Boolean)
  );

  document.getElementById('operations-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Operations</h2>
        <p>Execution starts after the sale is commercially ready</p>
      </div>
      <button class="btn btn-primary" onclick="openOperationTaskModal()">+ New Task</button>
    </div>

    ${tasks.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">⚙️</div><h3>No operation tasks yet</h3><p>Create tasks for ICT, Design or Operations once a sale is ready for execution.</p></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${tasks.map(task => operationTaskHTML(task, salesMap[task.saleId], departmentMap[task.departmentId], reportsBySale, paidInvoiceSaleIds)).join('')}</div>`}
  `;
}

function operationTaskHTML(task, sale, department, reportsBySale, paidInvoiceSaleIds) {
  const reportCount = reportsBySale[task.saleId || 'none'] || 0;
  const paidFlag = sale?.id && paidInvoiceSaleIds.has(sale.id) ? 'Paid' : 'Awaiting payment';
  return `
    <div class="doc-card">
      <div class="doc-card-icon invoice">⚙️</div>
      <div class="doc-card-info">
        <div class="doc-number">${task.taskCode || '-'}</div>
        <div class="doc-client">${sale?.saleCode || 'No sale linked'} · ${department?.name || task.departmentId || '-'}</div>
        <div class="doc-date">${task.task || '-'}</div>
        <div class="doc-prepared">${paidFlag} · ${reportCount} report${reportCount !== 1 ? 's' : ''}</div>
      </div>
      <div class="doc-card-right">
        <span class="badge badge-muted">${task.status || 'Pending'}</span>
        <button class="btn btn-secondary btn-sm" onclick="openOperationTaskModal(${task.id})">Edit</button>
      </div>
    </div>
  `;
}

async function openOperationTaskModal(taskId = null) {
  if (!window.KwezaAuth.hasRole('operations', 'ict', 'design')) {
    showToast('Only Operations, ICT or Design can manage execution tasks.', 'error');
    return;
  }

  const [sales, departments, task] = await Promise.all([
    window.KwezaDB.db.sales.orderBy('id').reverse().toArray(),
    window.KwezaDB.db.departments.orderBy('name').toArray(),
    taskId ? window.KwezaDB.db.operationTasks.get(taskId) : Promise.resolve(null)
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${task ? 'Edit Operation Task' : 'New Operation Task'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Sale <span>*</span></label>
            <select class="form-control" id="op-sale">
              <option value="">- Select sale -</option>
              ${sales.map(sale => `<option value="${sale.id}" ${task?.saleId === sale.id ? 'selected' : ''}>${sale.saleCode} · ${sale.service}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Department</label>
            <select class="form-control" id="op-department">
              ${departments.map(department => `<option value="${department.id}" ${task?.departmentId === department.id ? 'selected' : ''}>${department.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Task <span>*</span></label>
          <textarea class="form-control" id="op-task" rows="3" placeholder="Build website, prepare graphics, deploy solution">${task?.task || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="op-status">
            ${['Pending', 'Ready', 'In Progress', 'Blocked', 'Testing', 'Completed'].map(status => `<option value="${status}" ${task?.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveOperationTask(${taskId || 'null'})">Save Task</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}

async function saveOperationTask(taskId = null) {
  if (!window.KwezaAuth.hasRole('operations', 'ict', 'design')) {
    showToast('Only Operations, ICT or Design can manage execution tasks.', 'error');
    return;
  }

  const saleId = parseInt(document.getElementById('op-sale').value, 10);
  const taskText = document.getElementById('op-task').value.trim();
  const status = document.getElementById('op-status').value;
  if (!saleId || !taskText) {
    showToast('Sale and task details are required.', 'error');
    return;
  }

  if (status === 'Completed') {
    const reports = await window.KwezaDB.db.projectReports.where('saleId').equals(saleId).toArray();
    const hasFinalReport = reports.some(report => report.type === 'Completion');
    if (!hasFinalReport) {
      showToast('A completion report is required before closing a task.', 'error');
      return;
    }
  }

  const payload = {
    saleId,
    departmentId: document.getElementById('op-department').value,
    task: taskText,
    status
  };

  if (taskId) {
    await window.KwezaDB.db.operationTasks.update(taskId, payload);
  } else {
    await window.KwezaDB.createOperationTask(payload);
  }

  showToast('Operation task saved', 'success');
  closeModal();
  await renderOperations();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderOperations, openOperationTaskModal, saveOperationTask });
