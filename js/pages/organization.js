/* ============================================
   KWEZA - ORGANIZATION PAGE
   ============================================ */

async function renderOrganization() {
  const { getAllDepartments, getAllEmployees } = window.KwezaDB;
  const [departments, employees] = await Promise.all([
    getAllDepartments(),
    getAllEmployees()
  ]);

  const departmentMap = Object.fromEntries(departments.map(department => [department.id, department]));

  document.getElementById('organization-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Organization</h2>
        <p>${departments.length} department${departments.length !== 1 ? 's' : ''} and ${employees.length} employee${employees.length !== 1 ? 's' : ''} shared across the system</p>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" onclick="openDepartmentModal()">+ Department</button>
        <button class="btn btn-primary" onclick="openEmployeeModal()">+ Employee</button>
      </div>
    </div>

    <div class="grid grid-3" style="margin-bottom:20px;">
      ${departments.map(department => departmentCardHTML(department, employees)).join('')}
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Employee Directory</div>
        <div class="text-muted text-sm">Everyone can see the same employee records once they are created.</div>
      </div>

      ${employees.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No employees yet</h3><p>Add your first employee record to share it with every department.</p></div>`
        : `<div class="grid grid-2">${employees.map(employee => employeeCardHTML(employee, departmentMap[employee.departmentId])).join('')}</div>`
      }
    </div>
  `;
}

function departmentCardHTML(department, employees) {
  const employeeCount = employees.filter(employee => employee.departmentId === department.id).length;
  return `
    <div class="card" style="border-top:4px solid ${department.color || '#1565C0'};">
      <div class="card-header">
        <div>
          <div class="card-title">${department.name}</div>
          <div class="text-muted text-sm">${department.code || department.id}</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="openDepartmentModal('${department.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="removeDepartment('${department.id}')">Delete</button>
        </div>
      </div>
      <div class="text-muted text-sm">${department.description || 'No description yet.'}</div>
      <div class="summary-row" style="margin-top:12px;">
        <span>Employees</span>
        <strong>${employeeCount}</strong>
      </div>
    </div>
  `;
}

function employeeCardHTML(employee, department) {
  return `
    <div class="client-card">
      <div class="avatar" style="width:48px;height:48px;font-size:1rem;">
        ${(employee.fullName || '?').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div class="client-meta">
        <div class="client-name">${employee.fullName}</div>
        ${employee.position ? `<div class="client-contact">Role: ${employee.position}</div>` : ''}
        <div class="client-contact">Department: ${department?.name || 'Unassigned'}</div>
        ${employee.email ? `<div class="client-contact">Email: ${employee.email}</div>` : ''}
        ${employee.phone ? `<div class="client-contact">Phone: ${employee.phone}</div>` : ''}
        <div class="client-contact">Status: ${employee.status || 'active'}</div>
      </div>
      <div class="flex gap-8" style="flex-direction:column;align-items:flex-end;">
        <button class="btn btn-secondary btn-sm" onclick="openEmployeeModal(${employee.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="removeEmployee(${employee.id})">Delete</button>
      </div>
    </div>
  `;
}

async function openDepartmentModal(departmentId = null) {
  const modal = document.getElementById('modal-overlay');
  const department = departmentId ? await window.KwezaDB.db.departments.get(departmentId) : null;

  modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header">
        <h3>${department ? 'Edit Department' : 'Add Department'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Department Name <span>*</span></label>
          <input class="form-control" id="org-dept-name" value="${department?.name || ''}" placeholder="Finance" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Code</label>
            <input class="form-control" id="org-dept-code" value="${department?.code || ''}" placeholder="FIN" />
          </div>
          <div class="form-group">
            <label class="form-label">Color</label>
            <input class="form-control" id="org-dept-color" type="color" value="${department?.color || '#1565C0'}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="org-dept-description" rows="3" placeholder="What this department handles">${department?.description || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveDepartmentRecord('${departmentId || ''}')">Save Department</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

async function saveDepartmentRecord(existingId = '') {
  const name = document.getElementById('org-dept-name')?.value.trim();
  if (!name) {
    showToast('Department name is required', 'error');
    return;
  }

  const code = document.getElementById('org-dept-code')?.value.trim();
  const description = document.getElementById('org-dept-description')?.value.trim();
  const color = document.getElementById('org-dept-color')?.value || '#1565C0';

  await window.KwezaDB.saveDepartment({
    id: existingId || window.KwezaDB.slugifyId(name),
    name,
    code,
    description,
    color
  });

  showToast('Department saved', 'success');
  closeModal();
  await renderOrganization();
}

async function removeDepartment(departmentId) {
  if (!confirm('Delete this department?')) return;

  try {
    await window.KwezaDB.deleteDepartment(departmentId);
    showToast('Department deleted', 'info');
    await renderOrganization();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function openEmployeeModal(employeeId = null) {
  const [departments, employee] = await Promise.all([
    window.KwezaDB.getAllDepartments(),
    employeeId ? window.KwezaDB.db.employees.get(employeeId) : Promise.resolve(null)
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${employee ? 'Edit Employee' : 'Add Employee'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name <span>*</span></label>
            <input class="form-control" id="org-employee-name" value="${employee?.fullName || ''}" placeholder="John Banda" />
          </div>
          <div class="form-group">
            <label class="form-label">Position</label>
            <input class="form-control" id="org-employee-position" value="${employee?.position || ''}" placeholder="Finance Officer" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Department</label>
            <select class="form-control" id="org-employee-department">
              <option value="">- Select department -</option>
              ${departments.map(department => `<option value="${department.id}" ${employee?.departmentId === department.id ? 'selected' : ''}>${department.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="org-employee-status">
              <option value="active" ${employee?.status === 'active' || !employee ? 'selected' : ''}>Active</option>
              <option value="inactive" ${employee?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-control" id="org-employee-email" value="${employee?.email || ''}" placeholder="name@company.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" id="org-employee-phone" value="${employee?.phone || ''}" placeholder="+265..." />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEmployeeRecord(${employeeId || 'null'})">Save Employee</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

async function saveEmployeeRecord(employeeId = null) {
  const fullName = document.getElementById('org-employee-name')?.value.trim();
  if (!fullName) {
    showToast('Employee name is required', 'error');
    return;
  }

  await window.KwezaDB.saveEmployee({
    id: employeeId || undefined,
    fullName,
    position: document.getElementById('org-employee-position')?.value.trim(),
    departmentId: document.getElementById('org-employee-department')?.value || null,
    email: document.getElementById('org-employee-email')?.value.trim(),
    phone: document.getElementById('org-employee-phone')?.value.trim(),
    status: document.getElementById('org-employee-status')?.value || 'active'
  });

  showToast('Employee saved', 'success');
  closeModal();
  await renderOrganization();
}

async function removeEmployee(employeeId) {
  if (!confirm('Delete this employee?')) return;
  await window.KwezaDB.deleteEmployee(employeeId);
  showToast('Employee deleted', 'info');
  await renderOrganization();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, {
  renderOrganization,
  openDepartmentModal,
  saveDepartmentRecord,
  removeDepartment,
  openEmployeeModal,
  saveEmployeeRecord,
  removeEmployee
});
