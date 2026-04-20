/* ============================================
   KWEZA - LEADS (CRM) PAGE
   Lead → Qualified → Converted to Client
   ============================================ */

const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
const LEAD_SOURCES  = ['Walk-in', 'Referral', 'Social Media', 'Website', 'Phone', 'Email', 'Exhibition', 'Other'];

const LEAD_STATUS_COLORS = {
  New:       '#1565C0',
  Contacted: '#E65100',
  Qualified: '#6A1B9A',
  Converted: '#2E7D32',
  Lost:      '#757575'
};

async function renderLeads() {
  const { db } = window.KwezaDB;
  const user    = window.KwezaAuth.getCurrentUser();
  const deptId  = window.KwezaAuth.getDeptFilter();

  let leads = await db.leads.orderBy('id').reverse().toArray();
  if (deptId) leads = leads.filter(l => l.departmentId === deptId);

  // Stats
  const total     = leads.length;
  const newLeads  = leads.filter(l => l.status === 'New').length;
  const qualified = leads.filter(l => l.status === 'Qualified').length;
  const converted = leads.filter(l => l.status === 'Converted').length;
  const lost      = leads.filter(l => l.status === 'Lost').length;
  const winRate   = total > 0 ? Math.round((converted / total) * 100) : 0;

  document.getElementById('leads-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Leads</h2>
        <p>Track prospects from first contact to conversion</p>
      </div>
      <button class="btn btn-primary" onclick="openLeadModal()">+ New Lead</button>
    </div>

    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total Leads</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#1565C0">${newLeads}</div>
        <div class="stat-label">New</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#6A1B9A">${qualified}</div>
        <div class="stat-label">Qualified</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#2E7D32">${converted}</div>
        <div class="stat-label">Converted</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#E65100">${winRate}%</div>
        <div class="stat-label">Win Rate</div>
      </div>
    </div>

    <div class="filter-bar" style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;">
      <input class="form-control" id="lead-search" placeholder="🔍 Search leads..." style="max-width:260px;" oninput="filterLeads()" />
      <select class="form-control" id="lead-status-filter" style="max-width:180px;" onchange="filterLeads()">
        <option value="">All Statuses</option>
        ${LEAD_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>

    ${leads.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">🎯</div><h3>No leads yet</h3><p>Add your first lead to start your CRM pipeline.</p></div>`
      : `<div id="leads-list" style="display:flex;flex-direction:column;gap:10px;">
          ${leads.map(lead => leadCardHTML(lead)).join('')}
        </div>`}
  `;
}

function leadCardHTML(lead) {
  const color      = LEAD_STATUS_COLORS[lead.status] || '#757575';
  const followUp   = lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString('en-GB') : '—';
  const isOverdue  = lead.followUpDate && new Date(lead.followUpDate) < new Date() && !['Converted','Lost'].includes(lead.status);

  return `
    <div class="doc-card lead-card" data-lead-status="${lead.status}" data-lead-name="${(lead.name || '').toLowerCase()}" data-lead-company="${(lead.company || '').toLowerCase()}">
      <div class="doc-card-icon" style="background:${color}20;color:${color};font-size:20px;">🎯</div>
      <div class="doc-card-info">
        <div class="doc-number">${lead.leadCode || '—'} · <strong>${lead.name}</strong>${lead.company ? ` · ${lead.company}` : ''}</div>
        <div class="doc-client">${lead.interest || 'No interest specified'} · Source: ${lead.source || '—'}</div>
        <div class="doc-date">Follow-up: <span style="color:${isOverdue ? '#E53935' : 'inherit'}">${followUp}${isOverdue ? ' ⚠️ Overdue' : ''}</span></div>
        ${lead.notes ? `<div class="doc-prepared" style="font-style:italic;">${lead.notes.substring(0, 80)}${lead.notes.length > 80 ? '...' : ''}</div>` : ''}
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">${lead.status}</span>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="openLeadModal('${lead.id}')">Edit</button>
          ${lead.status !== 'Converted' && lead.status !== 'Lost'
            ? `<button class="btn btn-primary btn-sm" onclick="openConvertLeadModal('${lead.id}')">Convert</button>`
            : ''}
        </div>
      </div>
    </div>
  `;
}

function filterLeads() {
  const search  = (document.getElementById('lead-search')?.value || '').toLowerCase();
  const status  = document.getElementById('lead-status-filter')?.value || '';
  const cards   = document.querySelectorAll('.lead-card');

  cards.forEach(card => {
    const nameMatch    = card.dataset.leadName?.includes(search);
    const compMatch    = card.dataset.leadCompany?.includes(search);
    const statusMatch  = !status || card.dataset.leadStatus === status;
    card.style.display = (nameMatch || compMatch) && statusMatch ? '' : 'none';
  });
}
window.filterLeads = filterLeads;

/* ─── LEAD MODAL ─────────────────────────────────────────────── */
async function openLeadModal(leadId = null) {
  const { db } = window.KwezaDB;
  const [lead, departments] = await Promise.all([
    leadId ? db.leads.get(leadId) : Promise.resolve(null),
    window.KwezaDB.getAllDepartments()
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal" style="max-width:560px;">
      <div class="modal-header">
        <h3>${lead ? 'Edit Lead' : 'New Lead'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Prospect Name <span>*</span></label>
            <input class="form-control" id="lead-name" type="text" value="${lead?.name || ''}" placeholder="Full name or company contact" />
          </div>
          <div class="form-group">
            <label class="form-label">Company</label>
            <input class="form-control" id="lead-company" type="text" value="${lead?.company || ''}" placeholder="Company name" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" id="lead-phone" type="tel" value="${lead?.phone || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-control" id="lead-email" type="email" value="${lead?.email || ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Source</label>
            <select class="form-control" id="lead-source">
              ${LEAD_SOURCES.map(s => `<option value="${s}" ${lead?.source === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="lead-status">
              ${LEAD_STATUSES.filter(s => s !== 'Converted').map(s => `<option value="${s}" ${lead?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Interested In</label>
          <input class="form-control" id="lead-interest" type="text" value="${lead?.interest || ''}" placeholder="Web development, ICT support, Marketing..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Assigned Department</label>
            <select class="form-control" id="lead-dept">
              <option value="">— Not assigned —</option>
              ${departments.map(d => `<option value="${d.id}" ${lead?.assignedDeptId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Follow-up Date</label>
            <input class="form-control" id="lead-followup" type="date" value="${lead?.followUpDate ? lead.followUpDate.substring(0, 10) : ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="lead-notes" rows="3" placeholder="Any additional context...">${lead?.notes || ''}</textarea>
        </div>
        ${lead?.status === 'Lost' ? `
        <div class="form-group">
          <label class="form-label">Lost Reason</label>
          <input class="form-control" id="lead-lost-reason" type="text" value="${lead?.lostReason || ''}" placeholder="Why did we lose this lead?" />
        </div>` : ''}
      </div>
      <div class="modal-footer">
        ${lead ? `<button class="btn btn-danger" onclick="deleteLead('${lead.id}')">Delete</button>` : ''}
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveLead('${leadId || ''}')">Save Lead</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openLeadModal = openLeadModal;

async function saveLead(leadId = null) {
  const user = window.KwezaAuth.getCurrentUser();
  const name = document.getElementById('lead-name')?.value?.trim();
  if (!name) { showToast('Prospect name is required.', 'error'); return; }

  const followUpVal = document.getElementById('lead-followup')?.value;
  const payload = {
    name,
    company:      document.getElementById('lead-company')?.value?.trim() || '',
    phone:        document.getElementById('lead-phone')?.value?.trim()   || '',
    email:        document.getElementById('lead-email')?.value?.trim()   || '',
    source:       document.getElementById('lead-source')?.value          || '',
    status:       document.getElementById('lead-status')?.value          || 'New',
    interest:     document.getElementById('lead-interest')?.value?.trim()|| '',
    assignedDeptId: document.getElementById('lead-dept')?.value          || '',
    followUpDate: followUpVal ? new Date(followUpVal).toISOString()      : null,
    notes:        document.getElementById('lead-notes')?.value?.trim()   || '',
    lostReason:   document.getElementById('lead-lost-reason')?.value?.trim() || '',
    departmentId: user?.id || '',
    preparedBy:   user?.id || ''
  };

  if (leadId) {
    await window.KwezaDB.db.leads.update(leadId, payload);
    await window.KwezaDB.logAudit('update', 'leads', leadId, null, payload);
    showToast('Lead updated.', 'success');
  } else {
    await window.KwezaDB.createLead(payload);
    showToast('Lead created.', 'success');
  }

  closeModal();
  await renderLeads();
}
window.saveLead = saveLead;

async function deleteLead(leadId) {
  if (!confirm('Delete this lead? This cannot be undone.')) return;
  await window.KwezaDB.db.leads.delete(leadId);
  await window.KwezaDB.logAudit('delete', 'leads', leadId, null, null);
  showToast('Lead deleted.', 'info');
  closeModal();
  await renderLeads();
}
window.deleteLead = deleteLead;

/* ─── CONVERT LEAD MODAL ─────────────────────────────────────── */
async function openConvertLeadModal(leadId) {
  const lead = await window.KwezaDB.db.leads.get(leadId);
  if (!lead) return;

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <h3>Convert Lead to Client</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="info-banner" style="background:#E3F2FD;border-left:4px solid #1565C0;padding:12px;border-radius:6px;margin-bottom:16px;">
          <strong>${lead.name}</strong>${lead.company ? ` — ${lead.company}` : ''}<br>
          <span style="font-size:12px;color:#555;">This will create a new Client record linked to this lead.</span>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client Name <span>*</span></label>
            <input class="form-control" id="conv-name" type="text" value="${lead.name}" />
          </div>
          <div class="form-group">
            <label class="form-label">Company</label>
            <input class="form-control" id="conv-company" type="text" value="${lead.company || ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" id="conv-phone" type="tel" value="${lead.phone || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-control" id="conv-email" type="email" value="${lead.email || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input class="form-control" id="conv-address" type="text" placeholder="Physical address" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="confirmConvertLead('${leadId}')">✓ Convert to Client</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.openConvertLeadModal = openConvertLeadModal;

async function confirmConvertLead(leadId) {
  const user = window.KwezaAuth.getCurrentUser();
  const name = document.getElementById('conv-name')?.value?.trim();
  if (!name) { showToast('Client name is required.', 'error'); return; }

  try {
    const client = await window.KwezaDB.convertLeadToClient(leadId, {
      name,
      company:   document.getElementById('conv-company')?.value?.trim() || '',
      phone:     document.getElementById('conv-phone')?.value?.trim()   || '',
      email:     document.getElementById('conv-email')?.value?.trim()   || '',
      address:   document.getElementById('conv-address')?.value?.trim() || '',
      departmentId: user?.id || '',
      preparedBy:   user?.id || '',
      preparedByDept: user?.department || ''
    });

    showToast(`Lead converted — Client ${client.clientCode} created.`, 'success');
    closeModal();
    await renderLeads();
  } catch (error) {
    showToast(error.message, 'error');
  }
}
window.confirmConvertLead = confirmConvertLead;

/* ─── REGISTER ────────────────────────────────────────────────── */
window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderLeads, openLeadModal, saveLead, deleteLead, openConvertLeadModal, confirmConvertLead, filterLeads });
