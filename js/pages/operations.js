/* ============================================
   KWEZA - OPERATIONS PAGE (v2)
   Dept-scoped task view, linked to projects
   ============================================ */

async function renderOperations() {
  const { db } = window.KwezaDB;
  const user   = window.KwezaAuth.getCurrentUser();
  const deptId = window.KwezaAuth.getDeptFilter();

  let [tasks, sales, departments, invoices, reports, projects] = await Promise.all([
    db.operationTasks.orderBy('id').reverse().toArray(),
    db.sales.toArray(),
    db.departments.toArray(),
    db.invoices.toArray(),
    db.projectReports.toArray(),
    db.projects.toArray()
  ]);

  // Dept scope — ICT / Operations / Design only see their tasks
  if (deptId) {
    tasks = tasks.filter(t => t.departmentId === deptId);
  }

  const salesMap       = Object.fromEntries(sales.map(s => [s.id, s]));
  const departmentMap  = Object.fromEntries(departments.map(d => [d.id, d]));
  const projectMap     = Object.fromEntries(projects.map(p => [p.id, p]));
  const reportsBySale  = reports.reduce((map, r) => {
    const key = r.saleId || 'none';
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});
  const paidInvoiceSaleIds = new Set(
    invoices.filter(i => ['paid','project_created'].includes(i.status)).map(i => i.saleId).filter(Boolean)
  );

  // Stats
  const pending    = tasks.filter(t => t.status === 'Pending').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const completed  = tasks.filter(t => t.status === 'Completed').length;

  document.getElementById('operations-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Operations</h2>
        <p>Legacy task execution — new tasks live in <a href="#" onclick="navigate('projects');return false;" style="color:var(--primary);">Projects</a></p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" onclick="navigate('projects')">🚀 Go to Projects</button>
        <button class="btn btn-primary" onclick="openOperationTaskModal()">+ New Task</button>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-value">${tasks.length}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#E65100">${pending}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#1565C0">${inProgress}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#2E7D32">${completed}</div>
        <div class="stat-label">Completed</div>
      </div>
    </div>

    ${tasks.length === 0
      ? `<div class="empty-state">
          <div class="empty-state-icon">⚙️</div>
          <h3>${deptId ? 'No tasks assigned to your department' : 'No operation tasks yet'}</h3>
          <p>Create tasks here for legacy workflows or use the <a href="#" onclick="navigate('projects');return false;" style="color:var(--primary);">Projects section</a> for new work.</p>
         </div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${tasks.map(t => operationTaskHTML(t, salesMap[t.saleId], departmentMap[t.departmentId], reportsBySale, paidInvoiceSaleIds, projectMap[t.projectId])).join('')}</div>`}
  `;
}

function operationTaskHTML(task, sale, department, reportsBySale, paidInvoiceSaleIds, project) {
  const reportCount = reportsBySale[task.saleId || 'none'] || 0;
  const paidFlag    = sale?.id && paidInvoiceSaleIds.has(sale.id) ? '✅ Paid' : '⏳ Awaiting payment';
  const statusColors = {
    Pending:      '#607D8B',
    Ready:        '#1565C0',
    'In Progress':'#E65100',
    Blocked:      '#C62828',
    Testing:      '#6A1B9A',
    Completed:    '#2E7D32'
  };
  const color = statusColors[task.status] || '#607D8B';

  return `
    <div class="doc-card">
      <div class="doc-card-icon" style="background:${color}20;color:${color};font-size:20px;">⚙️</div>
      <div class="doc-card-info">
        <div class="doc-number">${task.taskCode || '—'} · ${task.task || '—'}</div>
        <div class="doc-client">${sale?.saleCode || 'No sale linked'} · ${department?.name || task.departmentId || '—'}</div>
        <div class="doc-date">${paidFlag} · ${reportCount} report${reportCount !== 1 ? 's' : ''}</div>
        ${project ? `<div class="doc-prepared">🚀 Project: <a href="#" onclick="navigate('projects/${project.id}');return false;" style="color:var(--primary);">${project.projectCode} — ${project.name}</a></div>` : ''}
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">${task.status || 'Pending'}</span>
        <button class="btn btn-secondary btn-sm" onclick="openOperationTaskModal(${task.id})">Edit</button>
      </div>
    </div>
  `;
}

async function openOperationTaskModal(taskId = null) {
  if (!window.KwezaAuth.hasRole('operations', 'ict', 'design', 'admin', 'administration')) {
    showToast('Only Operations, ICT or Design can manage execution tasks.', 'error');
    return;
  }

  const [sales, departments, task, projects] = await Promise.all([
    window.KwezaDB.db.sales.orderBy('id').reverse().toArray(),
    window.KwezaDB.db.departments.orderBy('name').toArray(),
    taskId ? window.KwezaDB.db.operationTasks.get(taskId) : Promise.resolve(null),
    window.KwezaDB.db.projects.orderBy('id').reverse().toArray()
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
              ${sales.map(s => `<option value="${s.id}" ${task?.saleId === s.id ? 'selected' : ''}>${s.saleCode} · ${s.service}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Department</label>
            <select class="form-control" id="op-department">
              ${departments.map(d => `<option value="${d.id}" ${task?.departmentId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Link to Project (optional)</label>
          <select class="form-control" id="op-project">
            <option value="">— No project —</option>
            ${projects.map(p => `<option value="${p.id}" ${task?.projectId === p.id ? 'selected' : ''}>${p.projectCode} — ${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Task <span>*</span></label>
          <textarea class="form-control" id="op-task" rows="3" placeholder="Build website, prepare graphics, deploy solution">${task?.task || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="op-status">
            ${['Pending', 'Ready', 'In Progress', 'Blocked', 'Testing', 'Completed'].map(s => `<option value="${s}" ${task?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
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
  if (!window.KwezaAuth.hasRole('operations', 'ict', 'design', 'admin', 'administration')) {
    showToast('Only Operations, ICT or Design can manage execution tasks.', 'error');
    return;
  }

  const saleId   = parseInt(document.getElementById('op-sale')?.value, 10);
  const taskText = document.getElementById('op-task')?.value?.trim();
  const status   = document.getElementById('op-status')?.value;

  if (!saleId || !taskText) {
    showToast('Sale and task details are required.', 'error');
    return;
  }

  if (status === 'Completed') {
    const reports = await window.KwezaDB.db.projectReports.where('saleId').equals(saleId).toArray();
    const hasFinalReport = reports.some(r => r.type === 'Completion');
    if (!hasFinalReport) {
      showToast('A completion report is required before closing a task.', 'error');
      return;
    }
  }

  const projectIdVal = document.getElementById('op-project')?.value;
  const payload = {
    saleId,
    departmentId: document.getElementById('op-department')?.value,
    task:         taskText,
    status,
    projectId:    parseInt(projectIdVal, 10) || null
  };

  if (taskId) {
    await window.KwezaDB.db.operationTasks.update(taskId, payload);
  } else {
    await window.KwezaDB.createOperationTask(payload);
  }

  showToast('Operation task saved.', 'success');
  closeModal();
  await renderOperations();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderOperations, openOperationTaskModal, saveOperationTask });
