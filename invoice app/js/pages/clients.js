/* ============================================
   KWEZA – CLIENTS PAGE (with dept isolation)
   ============================================ */
let clientSearch = '';

/* ── Helper: filter records for current department ──
   Also shows legacy records (null/undefined departmentId)
   so data created before dept-isolation is never hidden. ── */
function applyDeptFilter(records) {
  const deptId = window.KwezaAuth?.getDeptFilter?.();
  if (!deptId) return records; // admin sees all
  return records.filter(r => r.departmentId === deptId || r.departmentId == null);
}

async function renderClients() {
  const { db } = window.KwezaDB;
  const page = document.getElementById('clients-page');

  let allClients = await db.clients.orderBy('name').toArray();
  let clients = applyDeptFilter(allClients);

  if (clientSearch) {
    const q = clientSearch.toLowerCase();
    clients = clients.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q));
  }

  page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Clients</h2>
        <p>${clients.length} client${clients.length !== 1 ? 's' : ''} saved</p>
      </div>
      <button class="btn btn-primary" onclick="openClientModal()">+ Add Client</button>
    </div>

    <div class="search-bar mb-20" style="margin-bottom:20px;max-width:380px;">
      <span class="search-icon">🔍</span>
      <input type="text" class="form-control" placeholder="Search clients…" value="${clientSearch}"
        oninput="clientSearch=this.value;renderClients()" />
    </div>

    ${clients.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No clients yet</h3><p>Add your first client to get started</p>
         <button class="btn btn-primary mt-12" onclick="openClientModal()">+ Add Client</button></div>`
      : `<div class="grid grid-2">${clients.map(clientCardHTML).join('')}</div>`
    }
  `;
}

function clientCardHTML(c) {
  const initials = (c.name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const preparedInfo = c.preparedBy ? `<div class="text-xs text-muted mt-4">👤 ${c.preparedBy}${c.preparedByDept ? ' · ' + c.preparedByDept : ''}</div>` : '';
  return `
    <div class="client-card" id="client-${c.id}">
      <div class="avatar" style="width:48px;height:48px;font-size:1rem;">${initials}</div>
      <div class="client-meta">
        <div class="client-name">${c.name}</div>
        ${c.company ? `<div class="client-contact">🏢 ${c.company}</div>` : ''}
        ${c.phone   ? `<div class="client-contact">📞 ${c.phone}</div>` : ''}
        ${c.email   ? `<div class="client-contact">✉️ ${c.email}</div>` : ''}
        ${c.address ? `<div class="client-contact">📍 ${c.address}</div>` : ''}
        <div class="client-stats mt-8">
          <div class="client-stat-item"><strong id="stat-inv-${c.id}">–</strong>Invoices</div>
          <div class="client-stat-item"><strong id="stat-total-${c.id}">–</strong>Billed</div>
        </div>
        ${preparedInfo}
      </div>
      <div class="flex gap-8" style="flex-direction:column;align-items:flex-end;">
        <button class="btn btn-secondary btn-sm" onclick="openClientModal(${c.id})">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteClient(${c.id})">🗑</button>
        ${c.phone ? `<a href="https://wa.me/265${c.phone.replace(/\D/g,'').replace(/^0/,'')}?text=Hello ${encodeURIComponent(c.name)}" target="_blank" class="btn btn-success btn-sm">WhatsApp</a>` : ''}
      </div>
    </div>`;
}

// Load stats per client asynchronously
async function loadClientStats() {
  const { db } = window.KwezaDB;
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;

  let clients = await db.clients.toArray();
  if (deptId) clients = clients.filter(c => c.departmentId === deptId || c.departmentId == null);

  clients.forEach(async c => {
    let invs = await db.invoices.where('clientId').equals(c.id).toArray();
    if (deptId) invs = invs.filter(i => i.departmentId === deptId || i.departmentId == null);

    const total = invs.reduce((s, i) => s + (i.total || 0), 0);
    const invEl   = document.getElementById(`stat-inv-${c.id}`);
    const totEl   = document.getElementById(`stat-total-${c.id}`);
    if (invEl) invEl.textContent = invs.length;
    if (totEl) totEl.textContent = `MWK ${Number(total).toLocaleString()}`;
  });
}

function openClientModal(clientId = null) {
  const isEdit = !!clientId;
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${isEdit ? '✏️ Edit Client' : '👤 Add New Client'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div id="client-form-msg"></div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name <span>*</span></label>
            <input class="form-control" id="cf-name" placeholder="e.g. John Banda" required />
          </div>
          <div class="form-group">
            <label class="form-label">Company / Organisation</label>
            <input class="form-control" id="cf-company" placeholder="e.g. GO Foundations" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" id="cf-phone" placeholder="+265 (0) 882…" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-control" id="cf-email" type="email" placeholder="email@example.com" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <textarea class="form-control" id="cf-address" rows="2" placeholder="Mangochi Town, Malawi"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveClient(${clientId})">
          ${isEdit ? 'Save Changes' : '+ Add Client'}
        </button>
      </div>
    </div>`;
  modal.classList.add('active');

  if (isEdit) {
    window.KwezaDB.db.clients.get(clientId).then(c => {
      if (!c) return;
      document.getElementById('cf-name').value    = c.name || '';
      document.getElementById('cf-company').value = c.company || '';
      document.getElementById('cf-phone').value   = c.phone || '';
      document.getElementById('cf-email').value   = c.email || '';
      document.getElementById('cf-address').value = c.address || '';
    });
  }
}

async function saveClient(clientId) {
  const name = document.getElementById('cf-name').value.trim();
  if (!name) { showToast('Client name is required', 'error'); return; }

  const user = window.KwezaAuth?.getCurrentUser?.() || {};

  const data = {
    name,
    company:   document.getElementById('cf-company').value.trim(),
    phone:     document.getElementById('cf-phone').value.trim(),
    email:     document.getElementById('cf-email').value.trim(),
    address:   document.getElementById('cf-address').value.trim(),
    createdAt: new Date().toISOString(),
    departmentId:  user.id   || null,
    preparedBy:    user.name || '',
    preparedByDept:user.department || ''
  };

  const { db, logActivity } = window.KwezaDB;

  if (clientId) {
    // preserve existing department info if editing
    const existing = await db.clients.get(clientId);
    if(existing) {
        data.departmentId = existing.departmentId;
        data.preparedBy = existing.preparedBy;
        data.preparedByDept = existing.preparedByDept;
    }
    await db.clients.update(clientId, data);
    showToast('Client updated!', 'success');
  } else {
    const id = await db.clients.add(data);
    await logActivity('client', `New client added: ${name}`, 0, id, 'client');
    showToast('Client added!', 'success');
  }
  closeModal();
  renderClients().then(loadClientStats);
}

async function deleteClient(clientId) {
  if (!confirm('Delete this client? This will not delete their invoices.')) return;
  await window.KwezaDB.db.clients.delete(clientId);
  showToast('Client deleted', 'info');
  renderClients();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderClients, loadClientStats, openClientModal, saveClient, deleteClient });
