/* ============================================
   KWEZA - CLIENTS PAGE
   ============================================ */
let clientSearch = '';

function applyDeptFilter(records) {
  const deptId = window.KwezaAuth?.getDeptFilter?.();
  if (!deptId) return records;
  return records.filter(record => record.departmentId === deptId || record.departmentId == null);
}

async function renderClients() {
  const { db } = window.KwezaDB;
  const page = document.getElementById('clients-page');

  let clients = applyDeptFilter(await db.clients.orderBy('name').toArray());
  if (clientSearch) {
    const query = clientSearch.toLowerCase();
    clients = clients.filter(client =>
      client.name?.toLowerCase().includes(query) ||
      client.phone?.includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.clientCode?.toLowerCase().includes(query)
    );
  }

  page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Clients</h2>
        <p>${clients.length} client${clients.length !== 1 ? 's' : ''} registered</p>
      </div>
      <button class="btn btn-primary" onclick="openClientModal()">+ Add Client</button>
    </div>

    <div class="search-bar mb-20" style="margin-bottom:20px;max-width:420px;">
      <span class="search-icon">🔍</span>
      <input type="text" class="form-control" placeholder="Search by name, phone, email or client ID..." value="${clientSearch}"
        oninput="clientSearch=this.value;renderClients()" />
    </div>

    ${clients.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No clients yet</h3><p>Register your first client to start the workflow.</p><button class="btn btn-primary mt-12" onclick="openClientModal()">+ Add Client</button></div>`
      : `<div class="grid grid-2">${clients.map(clientCardHTML).join('')}</div>`}
  `;
}

function clientCardHTML(client) {
  const initials = (client.name || '?').split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
  return `
    <div class="client-card" id="client-${client.id}">
      <div class="avatar" style="width:48px;height:48px;font-size:1rem;">${initials}</div>
      <div class="client-meta">
        <div class="client-name">${client.name}</div>
        <div class="client-contact">Client ID: ${client.clientCode || '-'}</div>
        ${client.company ? `<div class="client-contact">Company: ${client.company}</div>` : ''}
        ${client.source ? `<div class="client-contact">Source: ${client.source}</div>` : ''}
        ${client.phone ? `<div class="client-contact">Phone: ${client.phone}</div>` : ''}
        ${client.email ? `<div class="client-contact">Email: ${client.email}</div>` : ''}
      </div>
      <div class="flex gap-8" style="flex-direction:column;align-items:flex-end;">
        <button class="btn btn-secondary btn-sm" onclick="openClientModal(${client.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteClient(${client.id})">Delete</button>
      </div>
    </div>
  `;
}

async function loadClientStats() {
  return;
}

function openClientModal(clientId = null) {
  const isEdit = !!clientId;
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Client' : 'Add New Client'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name <span>*</span></label>
            <input class="form-control" id="cf-name" placeholder="John Banda" />
          </div>
          <div class="form-group">
            <label class="form-label">Company / Organisation</label>
            <input class="form-control" id="cf-company" placeholder="Acme Limited" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" id="cf-phone" placeholder="+265..." />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-control" id="cf-email" type="email" placeholder="email@example.com" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Lead Source</label>
          <select class="form-control" id="cf-source">
            <option value="Marketing">Marketing</option>
            <option value="ICT">ICT</option>
            <option value="Referral">Referral</option>
            <option value="Walk-in">Walk-in</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <textarea class="form-control" id="cf-address" rows="2" placeholder="Lilongwe, Malawi"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveClient(${clientId})">${isEdit ? 'Save Changes' : '+ Add Client'}</button>
      </div>
    </div>
  `;
  modal.classList.add('active');

  if (isEdit) {
    window.KwezaDB.db.clients.get(clientId).then(client => {
      if (!client) return;
      document.getElementById('cf-name').value = client.name || '';
      document.getElementById('cf-company').value = client.company || '';
      document.getElementById('cf-phone').value = client.phone || '';
      document.getElementById('cf-email').value = client.email || '';
      document.getElementById('cf-source').value = client.source || 'Marketing';
      document.getElementById('cf-address').value = client.address || '';
    });
  }
}

async function saveClient(clientId) {
  const name = document.getElementById('cf-name').value.trim();
  if (!name) {
    showToast('Client name is required', 'error');
    return;
  }

  const user = window.KwezaAuth?.getCurrentUser?.() || {};
  const data = {
    name,
    company: document.getElementById('cf-company').value.trim(),
    phone: document.getElementById('cf-phone').value.trim(),
    email: document.getElementById('cf-email').value.trim(),
    source: document.getElementById('cf-source').value,
    address: document.getElementById('cf-address').value.trim(),
    createdAt: new Date().toISOString(),
    departmentId: user.id || null,
    preparedBy: user.name || '',
    preparedByDept: user.department || ''
  };

  if (clientId) {
    const existing = await window.KwezaDB.db.clients.get(clientId);
    if (existing?.clientCode) data.clientCode = existing.clientCode;
    await window.KwezaDB.db.clients.update(clientId, data);
    showToast('Client updated', 'success');
  } else {
    const created = await window.KwezaDB.createClientRecord(data);
    await window.KwezaDB.logActivity('client', `New client added: ${name}`, 0, created.id, 'client');
    showToast('Client added', 'success');
  }

  closeModal();
  await renderClients();
}

async function deleteClient(clientId) {
  if (!confirm('Delete this client?')) return;
  await window.KwezaDB.db.clients.delete(clientId);
  showToast('Client deleted', 'info');
  await renderClients();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderClients, loadClientStats, openClientModal, saveClient, deleteClient });
