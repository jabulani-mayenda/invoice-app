/* ============================================
   KWEZA - SALES PAGE
   ============================================ */

async function renderSales() {
  const { db } = window.KwezaDB;
  const [sales, clients, requests] = await Promise.all([
    db.sales.orderBy('id').reverse().toArray(),
    db.clients.toArray(),
    db.serviceRequests.toArray()
  ]);

  const clientMap = Object.fromEntries(clients.map(client => [client.id, client]));
  const requestMap = Object.fromEntries(requests.map(request => [request.id, request]));

  document.getElementById('sales-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Sales</h2>
        <p>Core engine for requests, quotations and invoices</p>
      </div>
      <button class="btn btn-primary" onclick="openSaleModal()">+ New Sale</button>
    </div>

    ${sales.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">🛒</div><h3>No sales yet</h3><p>Convert service requests into controlled sales records before quotation and invoicing.</p></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${sales.map(sale => saleCardHTML(sale, clientMap[sale.clientId], requestMap[sale.requestId])).join('')}</div>`}
  `;
}

function saleCardHTML(sale, client, request) {
  return `
    <div class="doc-card">
      <div class="doc-card-icon invoice">🛒</div>
      <div class="doc-card-info">
        <div class="doc-number">${sale.saleCode || '-'}</div>
        <div class="doc-client">${client?.name || 'No client linked'}</div>
        <div class="doc-date">${sale.service || '-'} ${request?.requestCode ? `· From ${request.requestCode}` : ''}</div>
      </div>
      <div class="doc-card-right">
        <div class="doc-amount">MWK ${Number(sale.total || 0).toLocaleString()}</div>
        <span class="badge badge-muted">${sale.status || 'Open'}</span>
      </div>
      <div class="action-row">
        <button class="btn btn-secondary btn-sm" onclick="openSaleModal(${sale.id})">Edit</button>
      </div>
    </div>
  `;
}

async function openSaleModal(saleId = null) {
  if (!window.KwezaAuth.hasRole('sales')) {
    showToast('Only Sales can create or edit sales records.', 'error');
    return;
  }

  const [requests, clients, sale] = await Promise.all([
    window.KwezaDB.db.serviceRequests.orderBy('id').reverse().toArray(),
    window.KwezaDB.db.clients.orderBy('name').toArray(),
    saleId ? window.KwezaDB.db.sales.get(saleId) : Promise.resolve(null)
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${sale ? 'Edit Sale' : 'New Sale'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Request</label>
            <select class="form-control" id="sl-request">
              <option value="">- Select request -</option>
              ${requests.map(request => `<option value="${request.id}" ${sale?.requestId === request.id ? 'selected' : ''}>${request.requestCode} · ${request.service}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Client <span>*</span></label>
            <select class="form-control" id="sl-client">
              <option value="">- Select client -</option>
              ${clients.map(client => `<option value="${client.id}" ${sale?.clientId === client.id ? 'selected' : ''}>${client.clientCode || ''} ${client.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service <span>*</span></label>
            <input class="form-control" id="sl-service" value="${sale?.service || ''}" placeholder="Business services package" />
          </div>
          <div class="form-group">
            <label class="form-label">Total</label>
            <input class="form-control" id="sl-total" type="number" min="0" value="${sale?.total || 0}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="sl-status">
            ${['Open', 'Quotation Pending', 'Quoted', 'Approved', 'Invoiced', 'In Progress', 'Completed', 'Closed'].map(status => `<option value="${status}" ${sale?.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveSale(${saleId || 'null'})">Save Sale</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}

async function saveSale(saleId = null) {
  if (!window.KwezaAuth.hasRole('sales')) {
    showToast('Only Sales can create or edit sales records.', 'error');
    return;
  }

  const clientId = parseInt(document.getElementById('sl-client').value, 10);
  const service = document.getElementById('sl-service').value.trim();
  if (!clientId || !service) {
    showToast('Client and service are required.', 'error');
    return;
  }

  const payload = {
    requestId: parseInt(document.getElementById('sl-request').value, 10) || null,
    clientId,
    service,
    total: parseFloat(document.getElementById('sl-total').value) || 0,
    status: document.getElementById('sl-status').value,
    assignedDepartmentId: 'sales'
  };

  if (saleId) {
    await window.KwezaDB.db.sales.update(saleId, payload);
  } else {
    const created = await window.KwezaDB.createSale(payload);
    await window.KwezaDB.logActivity('sale', `Sale ${created.saleCode} created`, created.total || 0, created.id, 'sale');
  }

  showToast('Sale saved', 'success');
  closeModal();
  await renderSales();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderSales, openSaleModal, saveSale });
