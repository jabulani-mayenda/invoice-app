/* ============================================
   KWEZA - INVOICES PAGE
   ============================================ */

let invoiceLineItems = [];
let invoiceFilter = 'all';

function applyInvoiceDeptFilter(records) {
  const deptId = window.KwezaAuth?.getDeptFilter?.();
  if (!deptId) return records;
  return records.filter(record => record.departmentId === deptId || record.departmentId == null);
}

function setInvoiceStep(step) {
  document.querySelectorAll('#invoices-page .wizard-step').forEach((element, index) => {
    element.classList.toggle('active', index + 1 === step);
    element.classList.toggle('completed', index + 1 < step);
  });

  document.querySelectorAll('#invoices-page .wizard-content').forEach((element, index) => {
    element.classList.toggle('active', index + 1 === step);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function invoiceCurrencyFormatter(currency) {
  return amount => `${currency} ${Number(amount || 0).toLocaleString()}`;
}

function invoiceStatusBadge(status) {
  return {
    unpaid:          'badge-warning',
    partial:         'badge-gold',
    paid:            'badge-success',
    project_created: 'badge-muted'
  }[status] || 'badge-muted';
}

function invoiceStatusLabel(status) {
  return {
    unpaid:          'Unpaid',
    partial:         'Partial',
    paid:            'Paid',
    project_created: '🚀 Project Created'
  }[status] || status || 'unpaid';
}

async function renderInvoices(subpage = '') {
  if (subpage === 'new') {
    await renderInvoiceBuilder(null);
    return;
  }

  if (subpage && subpage.endsWith('/edit')) {
    await renderInvoiceBuilder(parseInt(subpage.split('/')[0], 10));
    return;
  }

  if (subpage && !Number.isNaN(parseInt(subpage, 10))) {
    await renderInvoiceDetail(parseInt(subpage, 10));
    return;
  }

  const { db, getAllSettings } = window.KwezaDB;
  const [allInvoices, clients, sales, settings] = await Promise.all([
    db.invoices.orderBy('id').reverse().toArray(),
    db.clients.toArray(),
    db.sales.toArray(),
    getAllSettings()
  ]);

  const invoices = applyInvoiceDeptFilter(allInvoices);
  const clientMap = Object.fromEntries(clients.map(client => [client.id, client]));
  const salesMap = Object.fromEntries(sales.map(sale => [sale.id, sale]));
  const currency = settings.defaults.currency || 'MWK';
  const fmt = invoiceCurrencyFormatter(currency);
  const filtered = invoiceFilter === 'all' ? invoices : invoices.filter(invoice => invoice.status === invoiceFilter);

  document.getElementById('invoices-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Invoices</h2>
        <p>${invoices.length} total invoice${invoices.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('invoices/new')">+ New Invoice</button>
    </div>

    <div class="tabs">
      ${['all', 'unpaid', 'partial', 'paid', 'project_created'].map(status => `
        <button class="tab-btn ${invoiceFilter === status ? 'active' : ''}" onclick="invoiceFilter='${status}';renderInvoices()">
          ${invoiceStatusLabel(status)}
          <span class="badge badge-muted" style="margin-left:4px;">
            ${status === 'all' ? invoices.length : invoices.filter(invoice => invoice.status === status).length}
          </span>
        </button>`).join('')}
    </div>

    ${filtered.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">🧾</div><h3>No invoices</h3>
         <button class="btn btn-primary mt-12" onclick="navigate('invoices/new')">+ Create Invoice</button></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${filtered.map(invoice => invoiceCardHTML(invoice, clientMap[invoice.clientId], salesMap[invoice.saleId], fmt)).join('')}</div>`
    }`;
}

function invoiceCardHTML(invoice, client, sale, fmt) {
  const date = new Date(invoice.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const isOverdue = invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) < new Date();
  const preparedBy = invoice.preparedBy
    ? `<div class="doc-prepared">👤 ${invoice.preparedBy}${invoice.preparedByDept ? ` · ${invoice.preparedByDept}` : ''}</div>`
    : '';
  const saleInfo = sale?.saleCode ? ` · ${sale.saleCode}` : '';

  return `
    <div class="doc-card" onclick="navigate('invoices/${invoice.id}')">
      <div class="doc-card-icon invoice">🧾</div>
      <div class="doc-card-info">
        <div class="doc-number">${invoice.number} ${isOverdue ? '<span class="badge badge-danger" style="font-size:9px;">OVERDUE</span>' : ''}</div>
        <div class="doc-client">${client?.name || '—'}</div>
        <div class="doc-date">${date}${invoice.dueDate ? ` · Due ${new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}${saleInfo}</div>
        ${preparedBy}
      </div>
      <div class="doc-card-right">
        <div class="doc-amount">${fmt(invoice.total)}</div>
        <span class="badge ${invoiceStatusBadge(invoice.status)}">${invoiceStatusLabel(invoice.status)}</span>
      </div>
      <div class="action-row" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="navigate('invoices/${invoice.id}')">View</button>
        ${!['paid','project_created'].includes(invoice.status) ? `<button class="btn btn-success btn-sm" onclick="openPaymentModal(${invoice.id})">Pay</button>` : ''}
        ${invoice.status === 'paid' && !invoice.projectId ? `<button class="btn btn-primary btn-sm" onclick="openCreateProjectModal(${invoice.id})" style="background:#2E7D32;">🚀 Create Project</button>` : ''}
        ${invoice.projectId ? `<button class="btn btn-secondary btn-sm" onclick="navigate('projects/${invoice.projectId}')">🚀 View Project</button>` : ''}
        <button class="btn btn-ghost btn-icon" onclick="window.KwezaPDF.generatePDF('invoice', ${invoice.id})" title="Download">⬇</button>
        <button class="btn btn-ghost btn-icon" onclick="window.KwezaShare.shareViaWhatsApp('invoice', ${invoice.id})" title="WhatsApp">💬</button>
        <button class="btn btn-ghost btn-icon" onclick="deleteInvoice(${invoice.id})" title="Delete">🗑</button>
      </div>
    </div>`;
}

async function renderInvoiceBuilder(invoiceId = null) {
  const { db, getNextInvoiceNumber, getAllSettings } = window.KwezaDB;
  const isEdit = invoiceId !== null;
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;

  let clients = await db.clients.toArray();
  if (deptId) {
    clients = clients.filter(client => client.departmentId === deptId || client.departmentId == null);
  }

  const [sales, settings, invoice] = await Promise.all([
    db.sales.orderBy('id').reverse().toArray(),
    getAllSettings(),
    isEdit ? db.invoices.get(invoiceId) : Promise.resolve(null)
  ]);

  invoiceLineItems = isEdit
    ? await window.KwezaDB.getLineItems('invoice', invoiceId)
    : [{ description: '', rate: 0, qty: 1, discount: 0, amount: 0 }];

  if (!invoiceLineItems.length) {
    invoiceLineItems = [{ description: '', rate: 0, qty: 1, discount: 0, amount: 0 }];
  }

  const nextNumber = isEdit ? invoice.number : await getNextInvoiceNumber();
  const today = new Date().toISOString().split('T')[0];
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  const currency = settings.defaults.currency || 'MWK';

  document.getElementById('invoices-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>${isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
        <p>Step-by-step invoice builder</p>
      </div>
      <div class="flex gap-8 builder-top-actions">
        <button class="btn btn-secondary" onclick="renderInvoices()">← Back</button>
        <button class="btn btn-success" onclick="saveInvoice(${invoiceId})">Save Invoice</button>
      </div>
    </div>

    <div class="wizard-steps" style="padding:0 10%;">
      <div class="wizard-step active" onclick="window.KwezaPages.setInvoiceStep(1)">
        <div class="wizard-step-circle">1</div>
        <div class="wizard-step-label">Details</div>
      </div>
      <div class="wizard-step" onclick="window.KwezaPages.setInvoiceStep(2)">
        <div class="wizard-step-circle">2</div>
        <div class="wizard-step-label">Services</div>
      </div>
      <div class="wizard-step" onclick="window.KwezaPages.setInvoiceStep(3)">
        <div class="wizard-step-circle">3</div>
        <div class="wizard-step-label">Review</div>
      </div>
    </div>

    <div class="wizard-content active" id="iw-step-1">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:16px;">Client & Details</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Linked Sale</label>
            <select class="form-control" id="inv-sale" onchange="syncInvoiceClientFromSale()">
              <option value="">— Optional sale linkage —</option>
              ${sales.map(sale => `<option value="${sale.id}" data-client-id="${sale.clientId || ''}" ${invoice?.saleId == sale.id ? 'selected' : ''}>${sale.saleCode} · ${sale.service}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Client <span>*</span></label>
            <select class="form-control" id="inv-client">
              <option value="">— Select Client —</option>
              ${clients.map(client => `<option value="${client.id}" ${invoice?.clientId == client.id ? 'selected' : ''}>${client.name}${client.company ? ` (${client.company})` : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Invoice Number</label>
            <input class="form-control" id="inv-number" value="${nextNumber}" />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-control" id="inv-date" type="date" value="${invoice?.date ? invoice.date.split('T')[0] : today}" />
          </div>
        </div>
        <div class="form-row mt-12" style="margin-top:12px;">
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input class="form-control" id="inv-due" type="date" value="${invoice?.dueDate ? invoice.dueDate.split('T')[0] : dueDate.toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label class="form-label">Currency</label>
            <select class="form-control" id="inv-currency">
              <option value="MWK" ${(invoice?.currency || currency) === 'MWK' ? 'selected' : ''}>MWK</option>
              <option value="USD" ${(invoice?.currency || currency) === 'USD' ? 'selected' : ''}>USD</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Discount (%)</label>
            <input class="form-control" id="inv-discount" type="number" min="0" max="100" value="${invoice?.discount || 0}" oninput="recalcInvTotals()" />
          </div>
          <div class="form-group">
            <label class="form-label">VAT (%)</label>
            <input class="form-control" id="inv-tax" type="number" min="0" value="${invoice?.tax ?? settings.defaults.vatRate ?? 16.5}" oninput="recalcInvTotals()" />
          </div>
        </div>
        <div class="form-row mt-12" style="margin-top:12px;">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="inv-status">
              ${['unpaid', 'partial', 'paid'].map(status => `<option value="${status}" ${invoice?.status === status ? 'selected' : ''}>${status.charAt(0).toUpperCase() + status.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="renderInvoices()">Cancel</button>
        <button class="btn btn-primary" onclick="window.KwezaPages.setInvoiceStep(2)">Next: Services →</button>
      </div>
    </div>

    <div class="wizard-content" id="iw-step-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Services Overview</div>
          <div class="flex gap-8">
            <button class="btn btn-secondary btn-sm" onclick="openInvCatalogPicker()">Catalog</button>
            <button class="btn btn-primary btn-sm" onclick="addInvLineItem()">+ Add Service</button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="line-items-table">
            <thead>
              <tr>
                <th style="width:40%;">Description</th>
                <th style="width:15%;text-align:right;">Rate</th>
                <th style="width:8%;text-align:center;">Qty</th>
                <th style="width:10%;text-align:center;">Disc%</th>
                <th style="width:18%;text-align:right;">Amount</th>
                <th style="width:9%;"></th>
              </tr>
            </thead>
            <tbody id="inv-line-items-body"></tbody>
          </table>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="window.KwezaPages.setInvoiceStep(1)">← Back</button>
        <button class="btn btn-primary" onclick="window.KwezaPages.setInvoiceStep(3)">Next: Review →</button>
      </div>
    </div>

    <div class="wizard-content" id="iw-step-3">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:16px;">Summary & Notes</h3>
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-control" id="inv-notes" rows="6">${invoice?.notes || ''}</textarea>
          </div>
          <div class="summary-box">
            <div class="summary-row"><span>Subtotal</span><span id="is-subtotal">MWK 0.00</span></div>
            <div class="summary-row"><span>Discount</span><span id="is-discount">—</span></div>
            <div class="summary-row"><span>VAT</span><span id="is-vat">—</span></div>
            <div class="summary-row total"><span>TOTAL</span><span id="is-total">MWK 0.00</span></div>
          </div>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="window.KwezaPages.setInvoiceStep(2)">← Back</button>
        <button class="btn btn-success" onclick="saveInvoice(${invoiceId})">Save Invoice</button>
      </div>
    </div>
  `;

  renderInvLineItemRows();
  recalcInvTotals();
  syncInvoiceClientFromSale(true);
}

function fmtInvNum(value) {
  return Number(value || 0).toLocaleString('en-MW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderInvLineItemRows() {
  const tbody = document.getElementById('inv-line-items-body');
  if (!tbody) return;

  tbody.innerHTML = invoiceLineItems.map((item, index) => `
    <tr>
      <td><input class="form-control" value="${item.description || ''}" placeholder="Service"
        oninput="invoiceLineItems[${index}].description=this.value"></td>
      <td><input class="form-control" type="number" min="0" value="${item.rate || 0}" style="text-align:right;"
        oninput="invoiceLineItems[${index}].rate=parseFloat(this.value)||0;recalcInvRow(${index})"></td>
      <td><input class="form-control" type="number" min="1" value="${item.qty || 1}" style="text-align:center;"
        oninput="invoiceLineItems[${index}].qty=parseFloat(this.value)||1;recalcInvRow(${index})"></td>
      <td><input class="form-control" type="number" min="0" max="100" value="${item.discount || 0}" style="text-align:center;"
        oninput="invoiceLineItems[${index}].discount=parseFloat(this.value)||0;recalcInvRow(${index})"></td>
      <td class="amount-cell" id="iamt-${index}">${fmtInvNum(item.amount || 0)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="removeInvLineItem(${index})" ${invoiceLineItems.length <= 1 ? 'disabled' : ''}>✕</button></td>
    </tr>`).join('');
}

function recalcInvRow(index) {
  const item = invoiceLineItems[index];
  item.amount = (item.rate || 0) * (item.qty || 1) * (1 - (item.discount || 0) / 100);
  const amountEl = document.getElementById(`iamt-${index}`);
  if (amountEl) amountEl.textContent = fmtInvNum(item.amount);
  recalcInvTotals();
}

function recalcInvTotals() {
  const subtotal = invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const discountPct = parseFloat(document.getElementById('inv-discount')?.value) || 0;
  const taxPct = parseFloat(document.getElementById('inv-tax')?.value) || 0;
  const discountAmount = subtotal * discountPct / 100;
  const taxAmount = (subtotal - discountAmount) * taxPct / 100;
  const total = subtotal - discountAmount + taxAmount;
  const currency = document.getElementById('inv-currency')?.value || 'MWK';

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText('is-subtotal', `${currency} ${fmtInvNum(subtotal)}`);
  setText('is-discount', discountAmount > 0 ? `- ${currency} ${fmtInvNum(discountAmount)}` : '—');
  setText('is-vat', taxAmount > 0 ? `+ ${currency} ${fmtInvNum(taxAmount)}` : '—');
  setText('is-total', `${currency} ${fmtInvNum(total)}`);
}

function addInvLineItem() {
  invoiceLineItems.push({ description: '', rate: 0, qty: 1, discount: 0, amount: 0 });
  renderInvLineItemRows();
  recalcInvTotals();
}

function removeInvLineItem(index) {
  invoiceLineItems.splice(index, 1);
  renderInvLineItemRows();
  recalcInvTotals();
}

function syncInvoiceClientFromSale(force = false) {
  const saleSelect = document.getElementById('inv-sale');
  const clientSelect = document.getElementById('inv-client');
  if (!saleSelect || !clientSelect) return;

  const selected = saleSelect.selectedOptions?.[0];
  const clientId = selected?.dataset?.clientId;
  if (clientId && (force || !clientSelect.value)) {
    clientSelect.value = clientId;
  }
}

function openInvCatalogPicker() {
  Promise.all([
    window.KwezaDB.db.catalog.toArray(),
    window.KwezaDB.getAllDepartments()
  ]).then(([items, departments]) => {
    const departmentMap = Object.fromEntries(departments.map(department => [department.id, department]));
    const modal = document.getElementById('modal-overlay');

    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Catalog</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body" style="max-height:400px;overflow-y:auto;">
          ${items.length === 0
            ? `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Catalog is empty</h3><p>Add items in the Catalog section first.</p></div>`
            : items.map(item => `
              <div class="catalog-card" style="margin-bottom:8px;" onclick="addInvFromCatalog(${item.id});closeModal()">
                <div class="catalog-icon">📦</div>
                <div style="flex:1">
                  <div class="catalog-name">${item.name}</div>
                  <div class="catalog-category">${item.category}${departmentMap[item.departmentId]?.name ? ` · ${departmentMap[item.departmentId].name}` : ''}</div>
                </div>
                <div class="catalog-price">MWK ${Number(item.price || 0).toLocaleString()}</div>
              </div>`).join('')}
        </div>
      </div>`;

    modal.classList.add('active');
  });
}

function addInvFromCatalog(id) {
  window.KwezaDB.db.catalog.get(id).then(item => {
    if (!item) return;

    invoiceLineItems.push({
      description: item.name,
      rate: item.price,
      qty: 1,
      discount: 0,
      amount: item.price,
      catalogId: id
    });

    renderInvLineItemRows();
    recalcInvTotals();
  });
}

async function saveInvoice(invoiceId = null) {
  if (!window.KwezaAuth.hasRole('sales', 'finance', 'sales-operations', 'administration')) {
    showToast('Only Sales, Finance or Sales Operations can create invoices.', 'error');
    return;
  }

  const clientId = parseInt(document.getElementById('inv-client')?.value, 10);
  if (!clientId) {
    showToast('Select a client', 'error');
    return;
  }

  if (invoiceLineItems.every(item => !item.description)) {
    showToast('Add at least one line item', 'error');
    return;
  }

  const subtotal = invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const discountPct = parseFloat(document.getElementById('inv-discount')?.value) || 0;
  const taxPct = parseFloat(document.getElementById('inv-tax')?.value) || 0;
  const discountAmount = subtotal * discountPct / 100;
  const taxAmount = (subtotal - discountAmount) * taxPct / 100;
  const total = subtotal - discountAmount + taxAmount;

  const user = window.KwezaAuth?.getCurrentUser?.() || {};
  const data = {
    clientId,
    saleId: parseInt(document.getElementById('inv-sale')?.value, 10) || null,
    number: document.getElementById('inv-number')?.value || '',
    date: document.getElementById('inv-date')?.value || new Date().toISOString().split('T')[0],
    dueDate: document.getElementById('inv-due')?.value || null,
    currency: document.getElementById('inv-currency')?.value || 'MWK',
    discount: discountPct,
    tax: taxPct,
    subtotal,
    total,
    status: document.getElementById('inv-status')?.value || 'unpaid',
    notes: document.getElementById('inv-notes')?.value || '',
    departmentId: user.id || null,
    preparedBy: user.name || '',
    preparedByDept: user.department || ''
  };

  const { db, saveLineItems, incrementInvoiceNumber, logActivity } = window.KwezaDB;
  let id = invoiceId;

  if (invoiceId) {
    await db.invoices.update(invoiceId, data);
    showToast('Invoice updated!', 'success');
  } else {
    id = await db.invoices.add(data);
    await incrementInvoiceNumber();
    const client = await db.clients.get(clientId);
    await logActivity('invoice', `Invoice ${data.number} for ${client?.name}`, total, id, 'invoice');
    showToast('Invoice created!', 'success');
  }

  await saveLineItems('invoice', id, invoiceLineItems.filter(item => item.description));
  navigate(`invoices/${id}`);
}

async function renderInvoiceDetail(invoiceId) {
  const { db, getLineItems, getAllSettings } = window.KwezaDB;
  const [invoice, settings] = await Promise.all([
    db.invoices.get(invoiceId),
    getAllSettings()
  ]);

  if (!invoice) {
    navigate('invoices');
    return;
  }

  const [client, sale, lineItems, payments] = await Promise.all([
    db.clients.get(invoice.clientId),
    invoice.saleId ? db.sales.get(invoice.saleId) : Promise.resolve(null),
    getLineItems('invoice', invoiceId),
    db.payments.where('invoiceId').equals(invoiceId).toArray()
  ]);

  const currency = invoice.currency || settings.defaults.currency || 'MWK';
  const fmt = invoiceCurrencyFormatter(currency);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = (invoice.total || 0) - totalPaid;

  document.getElementById('invoices-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>${invoice.number}</h2>
        <p><span class="badge ${invoiceStatusBadge(invoice.status)}">${invoiceStatusLabel(invoice.status)}</span></p>
      </div>
      <div class="flex gap-8" style="flex-wrap:wrap;">
        <button class="btn btn-secondary" onclick="renderInvoices()">← Back</button>
        <button class="btn btn-primary" onclick="navigate('invoices/${invoiceId}/edit')">Edit</button>
        <button class="btn btn-secondary" onclick="window.KwezaPDF.printDocument('invoice', ${invoiceId})">Print</button>
        <button class="btn btn-secondary" onclick="window.KwezaPDF.generatePDF('invoice', ${invoiceId})">Download PDF</button>
        <button class="btn btn-gold" onclick="window.KwezaShare.shareViaWhatsApp('invoice', ${invoiceId})">WhatsApp</button>
        ${!['paid','project_created'].includes(invoice.status) ? `<button class="btn btn-success" onclick="openPaymentModal(${invoiceId})">Record Payment</button>` : ''}
        ${invoice.status === 'paid' && !invoice.projectId ? `<button class="btn btn-primary" onclick="openCreateProjectModal(${invoiceId})" style="background:#2E7D32;">🚀 Create Project</button>` : ''}
        ${invoice.projectId ? `<button class="btn btn-secondary" onclick="navigate('projects/${invoice.projectId}')">🚀 View Project</button>` : ''}
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title" style="margin-bottom:8px;">Client Details</div>
        <div class="font-bold">${client?.name || '—'}</div>
        ${client?.company ? `<div class="text-muted text-sm">${client.company}</div>` : ''}
        ${client?.phone ? `<div class="text-sm mt-4">${client.phone}</div>` : ''}
        ${client?.email ? `<div class="text-sm">${client.email}</div>` : ''}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:8px;">Invoice Summary</div>
        <div class="summary-row"><span class="text-muted">Invoice No.</span><span class="font-bold">${invoice.number}</span></div>
        <div class="summary-row"><span class="text-muted">Date</span><span>${new Date(invoice.date).toLocaleDateString('en-GB')}</span></div>
        ${invoice.dueDate ? `<div class="summary-row"><span class="text-muted">Due</span><span>${new Date(invoice.dueDate).toLocaleDateString('en-GB')}</span></div>` : ''}
        ${sale?.saleCode ? `<div class="summary-row"><span class="text-muted">Linked Sale</span><span>${sale.saleCode}</span></div>` : ''}
        ${invoice.preparedBy ? `<div class="summary-row"><span class="text-muted">Prepared by</span><span class="font-bold" style="color:var(--primary)">${invoice.preparedBy}${invoice.preparedByDept ? ` · ${invoice.preparedByDept}` : ''}</span></div>` : ''}
        <div class="summary-row total"><span>Balance</span><span style="color:var(--danger)">${fmt(balance)}</span></div>
      </div>
    </div>

    <div class="card mt-20" style="margin-top:20px;">
      <div class="card-title" style="margin-bottom:12px;">Line Items</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:right;">Rate</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:center;">Disc%</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(item => `
            <tr>
              <td>${item.description}</td>
              <td style="text-align:right;">${fmt(item.rate)}</td>
              <td style="text-align:center;">${item.qty}</td>
              <td style="text-align:center;">${item.discount > 0 ? `${item.discount}%` : '—'}</td>
              <td style="text-align:right;font-weight:600;">${fmt(item.amount)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <div class="summary-box" style="width:280px;">
          <div class="summary-row"><span>Subtotal</span><span>${fmt(invoice.subtotal)}</span></div>
          ${invoice.discount > 0 ? `<div class="summary-row"><span>Discount (${invoice.discount}%)</span><span style="color:var(--danger)">-${fmt(invoice.subtotal * invoice.discount / 100)}</span></div>` : ''}
          ${invoice.tax > 0 ? `<div class="summary-row"><span>VAT (${invoice.tax}%)</span><span>+${fmt((invoice.subtotal - invoice.subtotal * (invoice.discount || 0) / 100) * invoice.tax / 100)}</span></div>` : ''}
          <div class="summary-row total"><span>TOTAL</span><span>${fmt(invoice.total)}</span></div>
        </div>
      </div>
    </div>

    <div class="card mt-20" style="margin-top:20px;">
      <div class="card-header">
        <div class="card-title">Payment History</div>
        <span class="badge ${totalPaid >= invoice.total ? 'badge-success' : 'badge-warning'}">Paid: ${fmt(totalPaid)}</span>
      </div>
      ${payments.length === 0
        ? '<div class="text-muted text-sm">No payments recorded yet.</div>'
        : `<table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Notes</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(payment => `
                <tr>
                  <td>${new Date(payment.date).toLocaleDateString('en-GB')}</td>
                  <td>${payment.method || '—'}</td>
                  <td>${payment.notes || '—'}</td>
                  <td style="text-align:right;font-weight:700;color:var(--success)">${fmt(payment.amount)}</td>
                </tr>`).join('')}
            </tbody>
          </table>`}
    </div>`;
}

function openPaymentModal(invoiceId) {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header">
        <h3>Record Payment</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Amount <span>*</span></label>
          <input class="form-control" id="pay-amount" type="number" min="0" placeholder="Enter amount" />
        </div>
        <div class="form-group">
          <label class="form-label">Method</label>
          <select class="form-control" id="pay-method">
            <option>Bank Transfer</option>
            <option>Mobile Money</option>
            <option>Cash</option>
            <option>Cheque</option>
            <option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input class="form-control" id="pay-notes" placeholder="Reference" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="submitPayment(${invoiceId})">Record</button>
      </div>
    </div>`;

  modal.classList.add('active');
}

async function submitPayment(invoiceId) {
  if (!window.KwezaAuth.hasRole('finance', 'admin', 'administration')) {
    showToast('Only Finance can record payments.', 'error');
    return;
  }

  const amount = parseFloat(document.getElementById('pay-amount')?.value);
  if (!amount || amount <= 0) {
    showToast('Enter a valid amount', 'error');
    return;
  }

  const user   = window.KwezaAuth.getCurrentUser();
  const status = await window.KwezaDB.recordPayment(
    invoiceId,
    amount,
    document.getElementById('pay-method')?.value,
    document.getElementById('pay-notes')?.value
  );

  // Update payment with who recorded it
  try {
    const allPayments = await window.KwezaDB.db.payments.where('invoiceId').equals(invoiceId).toArray();
    const latest = allPayments[allPayments.length - 1];
    if (latest) await window.KwezaDB.db.payments.update(latest.id, { recordedBy: user?.id || '' });
  } catch { /* non-critical */ }

  showToast(`Payment recorded! Status: ${status}.`, 'success');
  closeModal();

  // Auto-prompt project creation when fully paid
  if (status === 'paid') {
    const invoice = await window.KwezaDB.db.invoices.get(invoiceId);
    if (invoice && !invoice.projectId) {
      setTimeout(() => {
        if (confirm(`Invoice ${invoice.number} is fully paid! 🎉\n\nCreate a Project now to start execution?`)) {
          window.KwezaPages.openCreateProjectModal(invoiceId);
        } else {
          renderInvoiceDetail(invoiceId);
        }
      }, 400);
      return;
    }
  }

  await renderInvoiceDetail(invoiceId);
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  await window.KwezaDB.db.invoices.delete(id);
  await window.KwezaDB.db.lineItems.where({ docType: 'invoice', docId: id }).delete();
  await window.KwezaDB.db.payments.where({ invoiceId: id }).delete();
  showToast('Invoice deleted', 'info');
  await renderInvoices();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, {
  renderInvoices,
  renderInvoiceDetail,
  renderInvoiceBuilder,
  addInvLineItem,
  removeInvLineItem,
  recalcInvTotals,
  recalcInvRow,
  openInvCatalogPicker,
  addInvFromCatalog,
  saveInvoice,
  openPaymentModal,
  submitPayment,
  deleteInvoice,
  setInvoiceStep,
  syncInvoiceClientFromSale,
  invoiceStatusLabel
});
