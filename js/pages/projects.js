/* ============================================
   KWEZA - PROJECTS PAGE
   Central execution object: Post-payment project lifecycle
   ICT sees only its assigned projects
   ============================================ */

const PROJECT_STATUSES  = ['Pending', 'Active', 'In Progress', 'QA', 'Revision', 'Completed', 'Closed'];
const PROJECT_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'];
const TASK_STATUSES     = ['Pending', 'In Progress', 'Blocked', 'Testing', 'Done'];

const PROJECT_STATUS_COLORS = {
  Pending:     '#607D8B',
  Active:      '#1565C0',
  'In Progress': '#E65100',
  QA:          '#6A1B9A',
  Revision:    '#C62828',
  Completed:   '#2E7D32',
  Closed:      '#424242'
};

const PRIORITY_COLORS = {
  Low:      '#78909C',
  Normal:   '#1565C0',
  High:     '#E65100',
  Critical: '#B71C1C'
};

/* ─── MAIN LIST VIEW ─────────────────────────────────────────── */
async function renderProjects(subpage) {
  if (subpage && subpage !== 'new') {
    return renderProjectDetail(subpage);
  }

  const { db } = window.KwezaDB;
  const user   = window.KwezaAuth.getCurrentUser();
  const deptId = window.KwezaAuth.getDeptFilter();

  let projects = await db.projects.orderBy('id').reverse().toArray();

  // ICT / Operations / Design — see ONLY their dept's projects
  if (deptId) projects = projects.filter(p => p.departmentId === deptId);

  const [clients, invoices, departments] = await Promise.all([
    db.clients.toArray(),
    db.invoices.toArray(),
    db.departments.toArray()
  ]);
  const clientMap  = Object.fromEntries(clients.map(c  => [c.id,  c]));
  const invoiceMap = Object.fromEntries(invoices.map(i  => [i.id,  i]));
  const deptMap    = Object.fromEntries(departments.map(d => [d.id, d]));

  // Stats
  const active    = projects.filter(p => ['Active','In Progress'].includes(p.status)).length;
  const inQA      = projects.filter(p => p.status === 'QA').length;
  const completed = projects.filter(p => p.status === 'Completed').length;
  const overdue   = projects.filter(p => p.dueDate && new Date(p.dueDate) < new Date() && !['Completed','Closed'].includes(p.status)).length;

  document.getElementById('projects-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Projects</h2>
        <p>Execution workspace — all work starts here after payment</p>
      </div>
      ${window.KwezaAuth.hasRole('admin','finance','sales-operations')
        ? `<button class="btn btn-primary" onclick="openCreateProjectModal()">+ New Project</button>`
        : ''}
    </div>

    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-value">${projects.length}</div>
        <div class="stat-label">Total Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#1565C0">${active}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#6A1B9A">${inQA}</div>
        <div class="stat-label">In QA</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#2E7D32">${completed}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#E53935">${overdue}</div>
        <div class="stat-label">Overdue</div>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      <input class="form-control" id="proj-search" placeholder="🔍 Search projects..." style="max-width:260px;" oninput="filterProjects()" />
      <select class="form-control" id="proj-status-filter" style="max-width:180px;" onchange="filterProjects()">
        <option value="">All Statuses</option>
        ${PROJECT_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>

    ${projects.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">🚀</div><h3>No projects yet</h3><p>Projects are created automatically when an invoice is paid, or manually by admin.</p></div>`
      : `<div id="projects-list" style="display:flex;flex-direction:column;gap:10px;">
          ${projects.map(p => projectCardHTML(p, clientMap[p.clientId], deptMap[p.departmentId])).join('')}
        </div>`}
  `;
}
window.renderProjects = renderProjects;

function projectCardHTML(project, client, dept) {
  const color   = PROJECT_STATUS_COLORS[project.status] || '#607D8B';
  const priColor = PRIORITY_COLORS[project.priority]    || '#1565C0';
  const dueDate  = project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-GB') : '—';
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && !['Completed','Closed'].includes(project.status);

  return `
    <div class="doc-card proj-card" data-proj-status="${project.status}" data-proj-name="${(project.name || '').toLowerCase()}">
      <div class="doc-card-icon" style="background:${color}20;color:${color};font-size:20px;">🚀</div>
      <div class="doc-card-info">
        <div class="doc-number">${project.projectCode || '—'} · <strong>${project.name}</strong></div>
        <div class="doc-client">${client?.name || 'No client'} · ${dept?.name || project.departmentId || '—'}</div>
        <div class="doc-date">Due: <span style="color:${isOverdue ? '#E53935' : 'inherit'}">${dueDate}${isOverdue ? ' ⚠️' : ''}</span></div>
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">${project.status}</span>
        <span class="badge" style="background:${priColor}15;color:${priColor};border:1px solid ${priColor}30;font-size:10px;">${project.priority || 'Normal'}</span>
        <button class="btn btn-secondary btn-sm" onclick="navigate('projects/${project.id}')">Open →</button>
      </div>
    </div>
  `;
}

function filterProjects() {
  const search = (document.getElementById('proj-search')?.value || '').toLowerCase();
  const status = document.getElementById('proj-status-filter')?.value || '';
  document.querySelectorAll('.proj-card').forEach(card => {
    const nameMatch   = card.dataset.projName?.includes(search);
    const statusMatch = !status || card.dataset.projStatus === status;
    card.style.display = nameMatch && statusMatch ? '' : 'none';
  });
}
window.filterProjects = filterProjects;

/* ─── PROJECT DETAIL VIEW ────────────────────────────────────── */
async function renderProjectDetail(projectId) {
  const { db } = window.KwezaDB;
  const user   = window.KwezaAuth.getCurrentUser();
  const deptId = window.KwezaAuth.getDeptFilter();

  const details = await window.KwezaDB.getProjectWithDetails(projectId);
  if (!details) {
    document.getElementById('projects-page').innerHTML = `<div class="empty-state"><h3>Project not found</h3><button class="btn btn-primary" onclick="navigate('projects')">← Back</button></div>`;
    return;
  }

  // ICT isolation — block if not their project
  if (deptId && details.departmentId !== deptId) {
    showToast('You do not have access to this project.', 'error');
    navigate('projects');
    return;
  }

  const [client, invoice, departments] = await Promise.all([
    details.clientId ? db.clients.get(details.clientId) : Promise.resolve(null),
    details.invoiceId ? db.invoices.get(details.invoiceId) : Promise.resolve(null),
    window.KwezaDB.getAllDepartments()
  ]);
  const deptMap = Object.fromEntries(departments.map(d => [d.id, d]));

  const check     = await window.KwezaDB.canCompleteProject(projectId);
  const color     = PROJECT_STATUS_COLORS[details.status] || '#607D8B';
  const totalTasks = details.tasks.length;
  const doneTasks  = details.tasks.filter(t => t.status === 'Done').length;
  const progress   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  document.getElementById('projects-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-secondary btn-sm" onclick="navigate('projects')" style="margin-bottom:8px;">← Back to Projects</button>
        <h2>${details.name}</h2>
        <p>${details.projectCode} · ${client?.name || 'No client'} · <span style="color:${color};font-weight:600;">${details.status}</span></p>
      </div>
      <div style="display:flex;gap:8px;">
        ${window.KwezaAuth.hasRole('admin','finance','sales-operations','administration')
          ? `<button class="btn btn-secondary" onclick="openEditProjectModal('${projectId}')">Edit Project</button>` : ''}
        ${check.canComplete && !['Completed','Closed'].includes(details.status)
          ? `<button class="btn btn-primary" onclick="markProjectComplete('${projectId}')" style="background:#2E7D32;">✓ Complete Project</button>` : ''}
      </div>
    </div>

    <!-- Progress Bar -->
    <div style="margin-bottom:24px;background:var(--surface);border-radius:12px;padding:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-weight:600;">Task Progress</span>
        <span style="color:${color};font-weight:700;">${progress}% (${doneTasks}/${totalTasks})</span>
      </div>
      <div style="background:var(--border);border-radius:8px;height:10px;overflow:hidden;">
        <div style="width:${progress}%;background:${color};height:100%;border-radius:8px;transition:width 0.5s;"></div>
      </div>
      ${!check.canComplete && !['Completed','Closed'].includes(details.status) ? `
      <div style="margin-top:12px;display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
        <span style="color:${check.allTasksDone ? '#2E7D32' : '#E53935'};">${check.allTasksDone ? '✓' : '✗'} All tasks done (${check.doneCount}/${check.taskCount})</span>
        <span style="color:${check.hasCompletionReport ? '#2E7D32' : '#E53935'};">${check.hasCompletionReport ? '✓' : '✗'} Completion report</span>
        <span style="color:${check.qaApproved ? '#2E7D32' : '#E53935'};">${check.qaApproved ? '✓' : '✗'} QA approved</span>
      </div>` : ''}
    </div>

    <!-- Project Info Row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px;">
      <div class="stat-card"><div class="stat-label">Client</div><div style="font-weight:600;">${client?.name || '—'}</div></div>
      <div class="stat-card"><div class="stat-label">Department</div><div style="font-weight:600;">${deptMap[details.departmentId]?.name || details.departmentId || '—'}</div></div>
      <div class="stat-card"><div class="stat-label">Invoice</div><div style="font-weight:600;">${invoice?.number || '—'}</div></div>
      <div class="stat-card"><div class="stat-label">Due Date</div><div style="font-weight:600;">${details.dueDate ? new Date(details.dueDate).toLocaleDateString('en-GB') : '—'}</div></div>
      <div class="stat-card"><div class="stat-label">Priority</div><div style="font-weight:600;color:${PRIORITY_COLORS[details.priority] || '#1565C0'}">${details.priority || 'Normal'}</div></div>
      <div class="stat-card"><div class="stat-label">QA Status</div><div style="font-weight:600;color:${details.qaApprovedAt ? '#2E7D32' : '#E65100'}">${details.qaApprovedAt ? 'Approved' : 'Pending'}</div></div>
    </div>

    <!-- Tabs -->
    <div class="tabs" style="display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:16px;">
      <button class="tab-btn active" id="tab-tasks"      onclick="switchProjectTab('tasks')">Tasks (${totalTasks})</button>
      <button class="tab-btn"        id="tab-milestones" onclick="switchProjectTab('milestones')">Milestones (${details.milestones.length})</button>
      <button class="tab-btn"        id="tab-reports"    onclick="switchProjectTab('reports')">Reports (${details.reports.length})</button>
      <button class="tab-btn"        id="tab-qa"         onclick="switchProjectTab('qa')">QA (${details.qaReviews.length})</button>
    </div>

    <!-- Tasks Panel -->
    <div id="panel-tasks">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Tasks</h3>
        <button class="btn btn-primary btn-sm" onclick="openTaskModal('${projectId}')">+ Add Task</button>
      </div>
      ${details.tasks.length === 0
        ? `<div class="empty-state" style="padding:40px 20px;"><div class="empty-state-icon">📋</div><p>No tasks yet</p></div>`
        : details.tasks.map(task => taskCardHTML(task, deptMap)).join('')}
    </div>

    <!-- Milestones Panel (hidden) -->
    <div id="panel-milestones" style="display:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Milestones</h3>
        <button class="btn btn-primary btn-sm" onclick="openMilestoneModal('${projectId}')">+ Add Milestone</button>
      </div>
      ${details.milestones.length === 0
        ? `<div class="empty-state" style="padding:40px 20px;"><div class="empty-state-icon">🏁</div><p>No milestones yet</p></div>`
        : details.milestones.map(ms => milestoneCardHTML(ms)).join('')}
    </div>

    <!-- Reports Panel (hidden) -->
    <div id="panel-reports" style="display:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Department Reports</h3>
        <button class="btn btn-primary btn-sm" onclick="openReportModal('${projectId}')">+ Submit Report</button>
      </div>
      ${details.reports.length === 0
        ? `<div class="empty-state" style="padding:40px 20px;"><div class="empty-state-icon">📑</div><p>No reports submitted yet</p></div>`
        : details.reports.map(r => reportCardHTML(r, deptMap)).join('')}
    </div>

    <!-- QA Panel (hidden) -->
    <div id="panel-qa" style="display:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">QA Reviews</h3>
        ${window.KwezaAuth.hasRole('admin','administration','qa')
          ? `<button class="btn btn-primary btn-sm" onclick="openQAReviewModal('${projectId}')">+ Submit QA Review</button>` : ''}
      </div>
      ${details.qaReviews.length === 0
        ? `<div class="empty-state" style="padding:40px 20px;"><div class="empty-state-icon">✅</div><p>No QA reviews yet</p></div>`
        : details.qaReviews.map(qa => qaCardHTML(qa)).join('')}
    </div>
  `;
}

function switchProjectTab(tab) {
  ['tasks','milestones','reports','qa'].forEach(t => {
    const btn   = document.getElementById(`tab-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    const active = t === tab;
    if (btn)   btn.classList.toggle('active', active);
    if (panel) panel.style.display = active ? '' : 'none';
  });
}
window.switchProjectTab = switchProjectTab;

/* ─── CARD RENDERERS ─────────────────────────────────────────── */
function taskCardHTML(task, deptMap) {
  const color = { Pending:'#607D8B', 'In Progress':'#E65100', Blocked:'#C62828', Testing:'#6A1B9A', Done:'#2E7D32' }[task.status] || '#607D8B';
  return `
    <div class="doc-card" style="margin-bottom:8px;">
      <div class="doc-card-info">
        <div class="doc-number">${task.taskCode || '—'} · ${task.task}</div>
        <div class="doc-client">${deptMap[task.departmentId]?.name || task.departmentId || '—'}${task.assignedTo ? ` · ${task.assignedTo}` : ''}</div>
        ${task.dueDate ? `<div class="doc-date">Due: ${new Date(task.dueDate).toLocaleDateString('en-GB')}</div>` : ''}
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">${task.status}</span>
        <button class="btn btn-secondary btn-sm" onclick="openTaskModal('${task.projectId}', '${task.id}')">Edit</button>
      </div>
    </div>`;
}

function milestoneCardHTML(ms) {
  const done = ms.status === 'Done';
  return `
    <div class="doc-card" style="margin-bottom:8px;">
      <div class="doc-card-icon" style="color:${done ? '#2E7D32' : '#607D8B'};font-size:18px;">${done ? '✅' : '🏁'}</div>
      <div class="doc-card-info">
        <div class="doc-number">${ms.title}</div>
        ${ms.description ? `<div class="doc-client">${ms.description}</div>` : ''}
        ${ms.dueDate ? `<div class="doc-date">Due: ${new Date(ms.dueDate).toLocaleDateString('en-GB')}</div>` : ''}
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${done ? '#E8F5E9' : '#ECEFF1'};color:${done ? '#2E7D32' : '#607D8B'};">${ms.status}</span>
        <button class="btn btn-secondary btn-sm" onclick="openMilestoneModal('${ms.projectId}', '${ms.id}')">Edit</button>
      </div>
    </div>`;
}

function reportCardHTML(report, deptMap) {
  const typeColors = { Daily:'#1565C0', Weekly:'#6A1B9A', Issue:'#C62828', Completion:'#2E7D32' };
  const color = typeColors[report.type] || '#607D8B';
  return `
    <div class="doc-card" style="margin-bottom:8px;">
      <div class="doc-card-icon" style="background:${color}20;color:${color};font-size:16px;">📑</div>
      <div class="doc-card-info">
        <div class="doc-number">${report.reportCode || '—'} · ${report.type} Report</div>
        <div class="doc-client">${deptMap[report.departmentId]?.name || report.departmentId || '—'} · ${report.submittedBy || '—'}</div>
        <div class="doc-date">${new Date(report.date).toLocaleDateString('en-GB')}</div>
        ${report.description ? `<div class="doc-prepared">${report.description.substring(0,100)}${report.description.length > 100 ? '...' : ''}</div>` : ''}
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${color}15;color:${color};border:1px solid ${color}30;">${report.status}</span>
      </div>
    </div>`;
}

function qaCardHTML(qa) {
  const color = qa.result === 'pass' ? '#2E7D32' : qa.result === 'fail' ? '#C62828' : '#E65100';
  const icon  = qa.result === 'pass' ? '✅' : qa.result === 'fail' ? '❌' : '⚠️';
  return `
    <div class="doc-card" style="margin-bottom:8px;">
      <div class="doc-card-icon" style="font-size:20px;">${icon}</div>
      <div class="doc-card-info">
        <div class="doc-number">QA Review — <span style="color:${color};font-weight:700;">${qa.result.toUpperCase()}</span></div>
        <div class="doc-client">${qa.reviewerDept || '—'} · ${qa.reviewerId}</div>
        <div class="doc-date">${new Date(qa.createdAt).toLocaleDateString('en-GB')}</div>
        ${qa.notes ? `<div class="doc-prepared">${qa.notes}</div>` : ''}
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">${qa.result}</span>
      </div>
    </div>`;
}

/* ─── TASK MODAL ─────────────────────────────────────────────── */
async function openTaskModal(projectId, taskId = null) {
  const { db } = window.KwezaDB;
  const [task, departments] = await Promise.all([
    taskId ? db.projectTasks.get(taskId) : Promise.resolve(null),
    window.KwezaDB.getAllDepartments()
  ]);
  const user = window.KwezaAuth.getCurrentUser();

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${task ? 'Edit Task' : 'New Task'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Task Description <span>*</span></label>
          <textarea class="form-control" id="task-text" rows="3" placeholder="Describe the task...">${task?.task || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Department</label>
            <select class="form-control" id="task-dept">
              ${departments.map(d => `<option value="${d.id}" ${task?.departmentId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="task-status">
              ${TASK_STATUSES.map(s => `<option value="${s}" ${task?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-control" id="task-priority">
              ${PROJECT_PRIORITIES.map(p => `<option value="${p}" ${task?.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input class="form-control" id="task-due" type="date" value="${task?.dueDate ? task.dueDate.substring(0,10) : ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Assigned To (User ID)</label>
          <input class="form-control" id="task-assigned" type="text" value="${task?.assignedTo || ''}" placeholder="User ID or name" />
        </div>
      </div>
      <div class="modal-footer">
        ${task ? `<button class="btn btn-danger" onclick="deleteTask('${taskId}', '${projectId}')">Delete</button>` : ''}
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveTask('${taskId || ''}', '${projectId}')">Save Task</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openTaskModal = openTaskModal;

async function saveTask(taskId, projectId) {
  const { db } = window.KwezaDB;
  const text    = document.getElementById('task-text')?.value?.trim();
  const status  = document.getElementById('task-status')?.value;
  if (!text) { showToast('Task description is required.', 'error'); return; }

  // Prevent Done without completion report check
  if (status === 'Done') {
    const reports = await db.departmentReports.where('projectId').equals(projectId).toArray();
    if (reports.length === 0) {
      showToast('Submit at least one report before marking a task as Done.', 'error');
      return;
    }
  }

  const dueVal = document.getElementById('task-due')?.value;
  const payload = {
    projectId,
    task:         text,
    departmentId: document.getElementById('task-dept')?.value      || '',
    status,
    priority:     document.getElementById('task-priority')?.value  || 'Normal',
    assignedTo:   document.getElementById('task-assigned')?.value  || '',
    dueDate:      dueVal ? new Date(dueVal).toISOString() : null,
    completedAt:  status === 'Done' ? new Date().toISOString() : null
  };

  if (taskId) {
    await db.projectTasks.update(taskId, payload);
    showToast('Task updated.', 'success');
  } else {
    const taskCode = await window.KwezaDB.getNextSequenceCode('taskNumberSeq', 'TSK');
    await db.projectTasks.add({ ...payload, taskCode, createdAt: new Date().toISOString() });
    await window.KwezaDB.db.settings.update('taskNumberSeq', {});  // trigger sequence (use incrementSequence if exposed)
    showToast('Task added.', 'success');
  }

  closeModal();
  await renderProjectDetail(projectId);
}
window.saveTask = saveTask;

async function deleteTask(taskId, projectId) {
  if (!confirm('Delete this task?')) return;
  await window.KwezaDB.db.projectTasks.delete(taskId);
  showToast('Task deleted.', 'info');
  closeModal();
  await renderProjectDetail(projectId);
}
window.deleteTask = deleteTask;

/* ─── MILESTONE MODAL ────────────────────────────────────────── */
async function openMilestoneModal(projectId, msId = null) {
  const { db } = window.KwezaDB;
  const ms = msId ? await db.projectMilestones.get(msId) : null;

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${ms ? 'Edit Milestone' : 'New Milestone'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Title <span>*</span></label>
          <input class="form-control" id="ms-title" type="text" value="${ms?.title || ''}" placeholder="Phase 1 completion, Client sign-off..." />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="ms-desc" rows="2">${ms?.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input class="form-control" id="ms-due" type="date" value="${ms?.dueDate ? ms.dueDate.substring(0,10) : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="ms-status">
              ${['Pending','Done','Missed'].map(s => `<option value="${s}" ${ms?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveMilestone('${msId || ''}', '${projectId}')">Save Milestone</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openMilestoneModal = openMilestoneModal;

async function saveMilestone(msId, projectId) {
  const { db } = window.KwezaDB;
  const title   = document.getElementById('ms-title')?.value?.trim();
  if (!title) { showToast('Title is required.', 'error'); return; }

  const dueVal = document.getElementById('ms-due')?.value;
  const status = document.getElementById('ms-status')?.value;
  const payload = {
    projectId,
    title,
    description: document.getElementById('ms-desc')?.value?.trim() || '',
    dueDate:     dueVal ? new Date(dueVal).toISOString() : null,
    status,
    completedAt: status === 'Done' ? new Date().toISOString() : null
  };

  if (msId) {
    await db.projectMilestones.update(msId, payload);
  } else {
    await db.projectMilestones.add({ ...payload, createdAt: new Date().toISOString() });
  }

  showToast('Milestone saved.', 'success');
  closeModal();
  await renderProjectDetail(projectId);
}
window.saveMilestone = saveMilestone;

/* ─── REPORT MODAL ───────────────────────────────────────────── */
async function openReportModal(projectId) {
  const user = window.KwezaAuth.getCurrentUser();
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Submit Report</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Report Type <span>*</span></label>
            <select class="form-control" id="rpt-type">
              ${['Daily','Weekly','Issue','Completion'].map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-control" id="rpt-date" type="date" value="${new Date().toISOString().substring(0,10)}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description <span>*</span></label>
          <textarea class="form-control" id="rpt-desc" rows="4" placeholder="Describe work done, issues, blockers, or completion summary..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProjectReport(${projectId})">Submit Report</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openReportModal = openReportModal;

async function saveProjectReport(projectId) {
  const user = window.KwezaAuth.getCurrentUser();
  const desc = document.getElementById('rpt-desc')?.value?.trim();
  if (!desc) { showToast('Description is required.', 'error'); return; }

  const reportCode = await window.KwezaDB.getNextSequenceCode('reportNumberSeq', 'RPT');
  const dateVal    = document.getElementById('rpt-date')?.value;

  await window.KwezaDB.db.departmentReports.add({
    reportCode,
    projectId,
    departmentId: user?.id || '',
    type:         document.getElementById('rpt-type')?.value || 'Daily',
    description:  desc,
    status:       'Open',
    date:         dateVal ? new Date(dateVal).toISOString() : new Date().toISOString(),
    submittedBy:  user?.id || '',
    createdAt:    new Date().toISOString()
  });

  showToast('Report submitted.', 'success');
  closeModal();
  await renderProjectDetail(projectId);
}
window.saveProjectReport = saveProjectReport;

/* ─── QA REVIEW INLINE MODAL ─────────────────────────────────── */
async function openQAReviewModal(projectId) {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <div class="modal-header">
        <h3>Submit QA Review</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Result <span>*</span></label>
          <div style="display:flex;gap:10px;">
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="radio" name="qa-result" value="pass"> ✅ Pass</label>
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="radio" name="qa-result" value="conditional"> ⚠️ Conditional</label>
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="radio" name="qa-result" value="fail"> ❌ Fail</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Score (Optional, 1–10)</label>
          <input class="form-control" id="qa-score" type="number" min="1" max="10" placeholder="e.g. 8" style="max-width:120px;" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="qa-notes" rows="3" placeholder="Feedback, issues found, or approval comments..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Checklist</label>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="qa-docs"> Documentation complete</label>
            <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="qa-client"> Client review done</label>
            <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="qa-final"> Final report submitted</label>
            <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="qa-delivery"> Delivery confirmed</label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitQAFromProject('${projectId}')">Submit Review</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openQAReviewModal = openQAReviewModal;

async function submitQAFromProject(projectId) {
  const result = document.querySelector('input[name="qa-result"]:checked')?.value;
  if (!result) { showToast('Select a result (Pass / Conditional / Fail).', 'error'); return; }

  const checklist = {
    docs_complete:  document.getElementById('qa-docs')?.checked     || false,
    client_review:  document.getElementById('qa-client')?.checked   || false,
    final_report:   document.getElementById('qa-final')?.checked    || false,
    delivery_confirmed: document.getElementById('qa-delivery')?.checked || false
  };

  await window.KwezaDB.submitQAReview({
    projectId,
    result,
    score:     parseInt(document.getElementById('qa-score')?.value, 10) || null,
    notes:     document.getElementById('qa-notes')?.value?.trim() || '',
    checklist
  });

  showToast(`QA review submitted — ${result.toUpperCase()}`, result === 'pass' ? 'success' : result === 'fail' ? 'error' : 'warning');
  closeModal();
  await renderProjectDetail(projectId);
  await window.KwezaApp.updateNavBadges();
}
window.submitQAFromProject = submitQAFromProject;

/* ─── CREATE PROJECT MODAL ───────────────────────────────────── */
async function openCreateProjectModal(invoiceId = null) {
  const [clients, departments, invoice] = await Promise.all([
    window.KwezaDB.db.clients.orderBy('name').toArray(),
    window.KwezaDB.getAllDepartments(),
    invoiceId ? window.KwezaDB.db.invoices.get(invoiceId) : Promise.resolve(null)
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal" style="max-width:560px;">
      <div class="modal-header">
        <h3>Create Project</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        ${invoice ? `<div style="background:#E8F5E9;border-left:4px solid #2E7D32;padding:12px;border-radius:6px;margin-bottom:16px;"><strong>Linked to Invoice:</strong> ${invoice.number}</div>` : ''}
        <div class="form-group">
          <label class="form-label">Project Name <span>*</span></label>
          <input class="form-control" id="proj-name" type="text" placeholder="e.g. Website Redesign — Client ABC" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client</label>
            <select class="form-control" id="proj-client">
              <option value="">— Select client —</option>
              ${clients.map(c => `<option value="${c.id}" ${invoice?.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Responsible Department <span>*</span></label>
            <select class="form-control" id="proj-dept">
              <option value="">— Select department —</option>
              ${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-control" id="proj-priority">
              ${PROJECT_PRIORITIES.map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input class="form-control" id="proj-due" type="date" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="proj-desc" rows="3" placeholder="Scope, deliverables, key notes..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewProject('${invoiceId || ''}')">Create Project</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openCreateProjectModal = openCreateProjectModal;

async function saveNewProject(invoiceId = null) {
  const name   = document.getElementById('proj-name')?.value?.trim();
  const deptId = document.getElementById('proj-dept')?.value;
  if (!name)   { showToast('Project name is required.', 'error'); return; }
  if (!deptId) { showToast('Select a responsible department.', 'error'); return; }

  const dueVal = document.getElementById('proj-due')?.value;
  const project = await window.KwezaDB.createProject({
    name,
    clientId:     document.getElementById('proj-client')?.value || null,
    departmentId: deptId,
    invoiceId:    invoiceId || null,
    priority:     document.getElementById('proj-priority')?.value || 'Normal',
    dueDate:      dueVal ? new Date(dueVal).toISOString() : null,
    description:  document.getElementById('proj-desc')?.value?.trim() || '',
    status:       'Active',
    startDate:    new Date().toISOString()
  });

  showToast(`Project ${project.projectCode} created.`, 'success');
  closeModal();
  await renderProjectDetail(project.id);
  navigate(`projects/${project.id}`);
}
window.saveNewProject = saveNewProject;

async function markProjectComplete(projectId) {
  if (!confirm('Mark this project as Completed? This action will lock the project.')) return;
  try {
    await window.KwezaDB.completeProject(projectId);
    showToast('Project marked as Completed!', 'success');
    await renderProjectDetail(projectId);
    await window.KwezaApp.updateNavBadges();
  } catch (error) {
    showToast(error.message, 'error');
  }
}
window.markProjectComplete = markProjectComplete;

/* ─── REGISTER ────────────────────────────────────────────────── */
window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, {
  renderProjects, openCreateProjectModal, saveNewProject, openTaskModal, saveTask, deleteTask,
  openMilestoneModal, saveMilestone, openReportModal, saveProjectReport,
  openQAReviewModal, submitQAFromProject, markProjectComplete, filterProjects, switchProjectTab
});
