/* ============================================
   KWEZA - SERVICE REQUESTS PAGE
   ============================================ */

async function renderRequests() {
  const { db } = window.KwezaDB;
  const [requests, clients, departments] = await Promise.all([
    db.serviceRequests.orderBy('id').reverse().toArray(),
    db.clients.toArray(),
    db.departments.toArray()
  ]);

  const clientMap = Object.fromEntries(clients.map(client => [client.id, client]));
  const departmentMap = Object.fromEntries(departments.map(department => [department.id, department]));

  document.getElementById('requests-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Service Requests</h2>
        <p>Entry point for all departments</p>
      </div>
      <button class="btn btn-primary" onclick="openRequestModal()">+ New Request</button>
    </div>

    ${requests.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📨</div><h3>No service requests yet</h3><p>Marketing, ICT, business development and other teams can submit work here.</p></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${requests.map(request => requestCardHTML(request, clientMap[request.clientId], departmentMap[request.departmentId])).join('')}</div>`}
  `;
}

function requestCardHTML(request, client, department) {
  return `
    <div class="doc-card">
      <div class="doc-card-icon quote">📨</div>
      <div class="doc-card-info">
        <div class="doc-number">${request.requestCode || '-'}</div>
        <div class="doc-client">${client?.name || 'No client linked'}</div>
        <div class="doc-date">${department?.name || request.departmentId || 'Department not set'} · ${request.service || '-'}</div>
        <div class="doc-prepared">${request.description || 'No description'}</div>
      </div>
      <div class="doc-card-right">
        <div class="doc-amount">${request.status || 'Pending'}</div>
        <button class="btn btn-secondary btn-sm" onclick="openRequestModal(${request.id})">Edit</button>
      </div>
    </div>
  `;
}

async function openRequestModal(requestId = null) {
  const [clients, departments, request] = await Promise.all([
    window.KwezaDB.db.clients.orderBy('name').toArray(),
    window.KwezaDB.db.departments.orderBy('name').toArray(),
    requestId ? window.KwezaDB.db.serviceRequests.get(requestId) : Promise.resolve(null)
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${request ? 'Edit Request' : 'New Service Request'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Department <span>*</span></label>
            <select class="form-control" id="rq-department">
              ${departments.map(department => `<option value="${department.id}" ${request?.departmentId === department.id ? 'selected' : ''}>${department.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Client</label>
            <select class="form-control" id="rq-client">
              <option value="">- Select client -</option>
              ${clients.map(client => `<option value="${client.id}" ${request?.clientId === client.id ? 'selected' : ''}>${client.clientCode || ''} ${client.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service <span>*</span></label>
            <input class="form-control" id="rq-service" value="${request?.service || ''}" placeholder="Website project, lead handover, branding package" />
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="rq-status">
              ${['Pending', 'Submitted to Sales', 'Converted to Sale', 'Cancelled', 'Completed'].map(status => `<option value="${status}" ${request?.status === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="rq-description" rows="4" placeholder="What needs to be delivered?">${request?.description || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveRequest(${requestId || 'null'})">Save Request</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}

async function saveRequest(requestId = null) {
  const service = document.getElementById('rq-service').value.trim();
  if (!service) {
    showToast('Service is required', 'error');
    return;
  }

  const payload = {
    clientId: parseInt(document.getElementById('rq-client').value, 10) || null,
    departmentId: document.getElementById('rq-department').value,
    service,
    description: document.getElementById('rq-description').value.trim(),
    status: document.getElementById('rq-status').value
  };

  if (requestId) {
    await window.KwezaDB.db.serviceRequests.update(requestId, payload);
  } else {
    const created = await window.KwezaDB.createServiceRequest(payload);
    await window.KwezaDB.logActivity('request', `Service request ${created.requestCode} created`, 0, created.id, 'request');
  }

  showToast('Request saved', 'success');
  closeModal();
  await renderRequests();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderRequests, openRequestModal, saveRequest });
