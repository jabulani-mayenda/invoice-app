/* ============================================
   KWEZA - QUOTATIONS PAGE
   ============================================ */

let quoteLineItems = [];
let quoteFilter = 'all';

function applyQuoteDeptFilter(records) {
  const deptId = window.KwezaAuth?.getDeptFilter?.();
  if (!deptId) return records;
  return records.filter(record => record.departmentId === deptId || record.departmentId == null);
}

function setQuoteStep(step) {
  document.querySelectorAll('#quotations-page .wizard-step').forEach((element, index) => {
    element.classList.toggle('active', index + 1 === step);
    element.classList.toggle('completed', index + 1 < step);
  });

  document.querySelectorAll('#quotations-page .wizard-content').forEach((element, index) => {
    element.classList.toggle('active', index + 1 === step);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function quoteCurrencyFormatter(currency) {
  return amount => `${currency} ${Number(amount || 0).toLocaleString()}`;
}

function quoteStatusBadge(status) {
  return {
    pending: 'badge-warning',
    approved: 'badge-success',
    converted: 'badge-success',
    expired: 'badge-danger',
    rejected: 'badge-danger',
    draft: 'badge-muted'
  }[status] || 'badge-muted';
}

async function renderQuotations(subpage = '') {
  if (subpage === 'new') {
    await renderQuoteBuilder(null);
    return;
  }

  if (subpage && subpage.endsWith('/edit')) {
    await renderQuoteBuilder(subpage.split('/')[0]);
    return;
  }

  if (subpage && subpage !== 'new') {
    await renderQuoteDetail(subpage);
    return;
  }

  const { db, getAllSettings } = window.KwezaDB;
  const [allQuotations, clients, sales, settings] = await Promise.all([
    db.quotations.orderBy('id').reverse().toArray(),
    db.clients.toArray(),
    db.sales.toArray(),
    getAllSettings()
  ]);

  const quotations = applyQuoteDeptFilter(allQuotations);
  const clientMap = Object.fromEntries(clients.map(client => [client.id, client]));
  const salesMap = Object.fromEntries(sales.map(sale => [sale.id, sale]));
  const currency = settings.defaults.currency || 'MWK';
  const fmt = quoteCurrencyFormatter(currency);
  const filtered = quoteFilter === 'all' ? quotations : quotations.filter(quote => quote.status === quoteFilter);

  document.getElementById('quotations-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Quotations</h2>
        <p>${quotations.length} total quotation${quotations.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('quotations/new')">+ New Quotation</button>
    </div>

    <div class="tabs">
      ${['all', 'pending', 'approved', 'converted', 'expired', 'draft'].map(status => `
        <button class="tab-btn ${quoteFilter === status ? 'active' : ''}" onclick="quoteFilter='${status}';renderQuotations()">
          ${status.charAt(0).toUpperCase() + status.slice(1)}
          <span class="badge badge-muted" style="margin-left:4px;">
            ${status === 'all' ? quotations.length : quotations.filter(quote => quote.status === status).length}
          </span>
        </button>`).join('')}
    </div>

    ${filtered.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No quotations${quoteFilter !== 'all' ? ` with status "${quoteFilter}"` : ''}</h3>
         <button class="btn btn-primary mt-12" onclick="navigate('quotations/new')">+ Create First Quotation</button></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${filtered.map(quote => quoteCardHTML(quote, clientMap[quote.clientId], salesMap[quote.saleId], fmt)).join('')}</div>`
    }
  `;
}

function quoteCardHTML(quote, client, sale, fmt) {
  const date = new Date(quote.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const preparedBy = quote.preparedBy
    ? `<div class="doc-prepared">👤 ${quote.preparedBy}${quote.preparedByDept ? ` · ${quote.preparedByDept}` : ''}</div>`
    : '';
  const saleInfo = sale?.saleCode ? ` · ${sale.saleCode}` : '';

  return `
    <div class="doc-card" onclick="navigate('quotations/${quote.id}')">
      <div class="doc-card-icon quote">📋</div>
      <div class="doc-card-info">
        <div class="doc-number">${quote.number}</div>
        <div class="doc-client">${client?.name || '—'}</div>
        <div class="doc-date">${date}${saleInfo} · Valid ${quote.validityDays || 14} days</div>
        ${preparedBy}
      </div>
      <div class="doc-card-right">
        <div class="doc-amount">${fmt(quote.total)}</div>
        <span class="badge ${quoteStatusBadge(quote.status)}">${quote.status || 'pending'}</span>
      </div>
      <div class="action-row" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="navigate('quotations/${quote.id}')">View</button>
        ${quote.status !== 'converted' ? `<button class="btn btn-success btn-sm" onclick="convertQuote('${quote.id}')">→ Invoice</button>` : ''}
        <button class="btn btn-ghost btn-icon" onclick="window.KwezaPDF.generatePDF('quotation', '${quote.id}')" title="Download">⬇</button>
        <button class="btn btn-ghost btn-icon" onclick="window.KwezaShare.shareViaWhatsApp('quotation', '${quote.id}')" title="WhatsApp">💬</button>
        <button class="btn btn-ghost btn-icon" onclick="deleteQuote('${quote.id}')" title="Delete">🗑</button>
      </div>
    </div>`;
}

async function renderQuoteBuilder(quoteId = null) {
  const { db, getNextQuoteNumber, getAllSettings } = window.KwezaDB;
  const isEdit = quoteId !== null;
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;

  let clients = await db.clients.toArray();
  if (deptId) {
    clients = clients.filter(client => client.departmentId === deptId || client.departmentId == null);
  }

  const [catalogItems, sales, settings, quote] = await Promise.all([
    db.catalog.toArray(),
    db.sales.orderBy('id').reverse().toArray(),
    getAllSettings(),
    isEdit ? db.quotations.get(quoteId) : Promise.resolve(null)
  ]);

  const lineItems = isEdit ? await window.KwezaDB.getLineItems('quotation', quoteId) : [];
  quoteLineItems = isEdit && lineItems.length
    ? lineItems.map(item => ({ ...item }))
    : [{ description: '', rate: 0, qty: 1, discount: 0, amount: 0 }];

  const nextNumber = isEdit ? quote.number : await getNextQuoteNumber();
  const today = new Date().toISOString().split('T')[0];
  const currency = settings.defaults.currency || 'MWK';

  document.getElementById('quotations-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>${isEdit ? 'Edit Quotation' : 'New Quotation'}</h2>
        <p>Step-by-step quote builder</p>
      </div>
      <div class="flex gap-8 builder-top-actions">
        <button class="btn btn-secondary" onclick="renderQuotations()">← Back</button>
        <button class="btn btn-success" onclick="saveQuotation('${quoteId || ''}')">Save Quotation</button>
      </div>
    </div>

    <div class="wizard-steps" style="padding:0 10%;">
      <div class="wizard-step active" onclick="window.KwezaPages.setQuoteStep(1)">
        <div class="wizard-step-circle">1</div>
        <div class="wizard-step-label">Details</div>
      </div>
      <div class="wizard-step" onclick="window.KwezaPages.setQuoteStep(2)">
        <div class="wizard-step-circle">2</div>
        <div class="wizard-step-label">Services</div>
      </div>
      <div class="wizard-step" onclick="window.KwezaPages.setQuoteStep(3)">
        <div class="wizard-step-circle">3</div>
        <div class="wizard-step-label">Review</div>
      </div>
    </div>

    <div class="wizard-content active" id="qw-step-1">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:16px;">Client & Details</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Linked Sale</label>
            <select class="form-control" id="q-sale" onchange="syncQuoteClientFromSale()">
              <option value="">— Optional sale linkage —</option>
              ${sales.map(sale => `<option value="${sale.id}" data-client-id="${sale.clientId || ''}" ${quote?.saleId == sale.id ? 'selected' : ''}>${sale.saleCode} · ${sale.service}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Client <span>*</span></label>
            <select class="form-control" id="q-client">
              <option value="">— Select Client —</option>
              ${clients.map(client => `<option value="${client.id}" ${quote?.clientId == client.id ? 'selected' : ''}>${client.name}${client.company ? ` (${client.company})` : ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Quotation Number</label>
            <input class="form-control" id="q-number" value="${nextNumber}" />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-control" id="q-date" type="date" value="${quote?.date ? quote.date.split('T')[0] : today}" />
          </div>
        </div>
        <div class="form-row mt-12" style="margin-top:12px;">
          <div class="form-group">
            <label class="form-label">Valid for (days)</label>
            <input class="form-control" id="q-validity" type="number" min="1" value="${quote?.validityDays || settings.defaults.validityDays || 14}" />
          </div>
          <div class="form-group">
            <label class="form-label">Currency</label>
            <select class="form-control" id="q-currency">
              <option value="MWK" ${(quote?.currency || currency) === 'MWK' ? 'selected' : ''}>MWK - Malawian Kwacha</option>
              <option value="USD" ${(quote?.currency || currency) === 'USD' ? 'selected' : ''}>USD - US Dollar</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Discount (%)</label>
            <input class="form-control" id="q-discount" type="number" min="0" max="100" value="${quote?.discount || 0}" oninput="recalcTotals()" />
          </div>
          <div class="form-group">
            <label class="form-label">VAT (%)</label>
            <input class="form-control" id="q-tax" type="number" min="0" value="${quote?.tax ?? settings.defaults.vatRate ?? 16.5}" oninput="recalcTotals()" />
          </div>
        </div>
        <div class="form-row mt-12" style="margin-top:12px;">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="q-status">
              ${['pending', 'approved', 'rejected', 'draft', 'expired'].map(status => `<option value="${status}" ${quote?.status === status ? 'selected' : ''}>${status.charAt(0).toUpperCase() + status.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="renderQuotations()">Cancel</button>
        <button class="btn btn-primary" onclick="window.KwezaPages.setQuoteStep(2)">Next: Services →</button>
      </div>
    </div>

    <div class="wizard-content" id="qw-step-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Services Overview</div>
          <div class="flex gap-8">
            <button class="btn btn-secondary btn-sm" onclick="openCatalogPicker()">From Catalog</button>
            <button class="btn btn-primary btn-sm" onclick="addLineItem()">+ Add Service</button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="line-items-table">
            <thead>
              <tr>
                <th style="width:40%;">Description</th>
                <th style="width:15%;text-align:right;">Rate (${currency})</th>
                <th style="width:8%;text-align:center;">Qty</th>
                <th style="width:10%;text-align:center;">Disc %</th>
                <th style="width:18%;text-align:right;">Amount</th>
                <th style="width:9%;"></th>
              </tr>
            </thead>
            <tbody id="line-items-body"></tbody>
          </table>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="window.KwezaPages.setQuoteStep(1)">← Back</button>
        <button class="btn btn-primary" onclick="window.KwezaPages.setQuoteStep(3)">Next: Review →</button>
      </div>
    </div>

    <div class="wizard-content" id="qw-step-3">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:16px;">Summary & Notes</h3>
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Notes / Terms</label>
            <textarea class="form-control" id="q-notes" rows="6" placeholder="${settings.defaults.invoiceNotes || 'Thank you for your business!'}">${quote?.notes || ''}</textarea>
          </div>
          <div class="summary-box">
            <div class="summary-row"><span>Subtotal</span><span id="s-subtotal">MWK 0.00</span></div>
            <div class="summary-row"><span>Discount</span><span id="s-discount" style="color:var(--danger)">—</span></div>
            <div class="summary-row"><span>VAT</span><span id="s-vat">—</span></div>
            <div class="summary-row total"><span>TOTAL</span><span id="s-total">MWK 0.00</span></div>
          </div>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="window.KwezaPages.setQuoteStep(2)">← Back</button>
        <button class="btn btn-success" onclick="saveQuotation('${quoteId || ''}')">Save Quotation</button>
      </div>
    </div>
  `;

  renderLineItemRows();
  recalcTotals();
  syncQuoteClientFromSale(true);

  if (catalogItems.length === 0 && !isEdit) {
    // Nothing to do; the check simply warms the catalog load path used by the picker.
  }
}

function renderLineItemRows() {
  const tbody = document.getElementById('line-items-body');
  if (!tbody) return;

  tbody.innerHTML = quoteLineItems.map((item, index) => `
    <tr id="li-row-${index}">
      <td><input class="form-control" value="${item.description || ''}" placeholder="Service description"
        oninput="quoteLineItems[${index}].description=this.value"></td>
      <td><input class="form-control" type="number" min="0" value="${item.rate || 0}" style="text-align:right;"
        oninput="quoteLineItems[${index}].rate=parseFloat(this.value)||0;recalcRow(${index})"></td>
      <td><input class="form-control" type="number" min="1" value="${item.qty || 1}" style="text-align:center;"
        oninput="quoteLineItems[${index}].qty=parseFloat(this.value)||1;recalcRow(${index})"></td>
      <td><input class="form-control" type="number" min="0" max="100" value="${item.discount || 0}" style="text-align:center;"
        oninput="quoteLineItems[${index}].discount=parseFloat(this.value)||0;recalcRow(${index})"></td>
      <td class="amount-cell" id="li-amt-${index}">${fmtNum(item.amount || 0)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="removeLineItem(${index})" ${quoteLineItems.length <= 1 ? 'disabled' : ''}>✕</button></td>
    </tr>`).join('');
}

function fmtNum(value) {
  return Number(value || 0).toLocaleString('en-MW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function recalcRow(index) {
  const item = quoteLineItems[index];
  item.amount = (item.rate || 0) * (item.qty || 1) * (1 - (item.discount || 0) / 100);
  const amountEl = document.getElementById(`li-amt-${index}`);
  if (amountEl) amountEl.textContent = fmtNum(item.amount);
  recalcTotals();
}

function recalcTotals() {
  const subtotal = quoteLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const discountPct = parseFloat(document.getElementById('q-discount')?.value) || 0;
  const taxPct = parseFloat(document.getElementById('q-tax')?.value) || 0;
  const discountAmount = subtotal * discountPct / 100;
  const taxable = subtotal - discountAmount;
  const taxAmount = taxable * taxPct / 100;
  const total = taxable + taxAmount;
  const currency = document.getElementById('q-currency')?.value || 'MWK';

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText('s-subtotal', `${currency} ${fmtNum(subtotal)}`);
  setText('s-discount', discountAmount > 0 ? `- ${currency} ${fmtNum(discountAmount)}` : '—');
  setText('s-vat', taxAmount > 0 ? `+ ${currency} ${fmtNum(taxAmount)}` : '—');
  setText('s-total', `${currency} ${fmtNum(total)}`);
}

function addLineItem() {
  quoteLineItems.push({ description: '', rate: 0, qty: 1, discount: 0, amount: 0 });
  renderLineItemRows();
  recalcTotals();
}

function removeLineItem(index) {
  quoteLineItems.splice(index, 1);
  renderLineItemRows();
  recalcTotals();
}

function syncQuoteClientFromSale(force = false) {
  const saleSelect = document.getElementById('q-sale');
  const clientSelect = document.getElementById('q-client');
  if (!saleSelect || !clientSelect) return;

  const selected = saleSelect.selectedOptions?.[0];
  const clientId = selected?.dataset?.clientId;
  if (clientId && (force || !clientSelect.value)) {
    clientSelect.value = clientId;
  }
}

function openCatalogPicker() {
  Promise.all([
    window.KwezaDB.db.catalog.toArray(),
    window.KwezaDB.getAllDepartments()
  ]).then(([items, departments]) => {
    const departmentMap = Object.fromEntries(departments.map(department => [department.id, department]));
    const modal = document.getElementById('modal-overlay');

    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Pick from Catalog</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body" style="max-height:420px;overflow-y:auto;">
          ${items.length === 0
            ? `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Catalog is empty</h3><p>Add items in the Catalog section first.</p></div>`
            : items.map(item => `
              <div class="catalog-card" style="margin-bottom:8px;" onclick="addFromCatalog('${item.id}');closeModal()">
                <div class="catalog-icon">📦</div>
                <div style="flex:1;">
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

function addFromCatalog(catalogId) {
  window.KwezaDB.db.catalog.get(catalogId).then(item => {
    if (!item) return;

    quoteLineItems.push({
      description: item.name,
      rate: item.price,
      qty: 1,
      discount: 0,
      amount: item.price,
      catalogId
    });

    renderLineItemRows();
    recalcTotals();
  });
}

async function saveQuotation(quoteId = null) {
  if (!window.KwezaAuth.hasRole('sales', 'finance')) {
    showToast('Only Sales or Finance can create or edit quotations.', 'error');
    return;
  }

  const clientId = document.getElementById('q-client')?.value;
  if (!clientId) {
    showToast('Please select a client', 'error');
    return;
  }

  if (quoteLineItems.every(item => !item.description)) {
    showToast('Add at least one line item', 'error');
    return;
  }

  const subtotal = quoteLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const discountPct = parseFloat(document.getElementById('q-discount')?.value) || 0;
  const taxPct = parseFloat(document.getElementById('q-tax')?.value) || 0;
  const discountAmount = subtotal * discountPct / 100;
  const taxAmount = (subtotal - discountAmount) * taxPct / 100;
  const total = subtotal - discountAmount + taxAmount;

  const user = window.KwezaAuth?.getCurrentUser?.() || {};
  const data = {
    clientId,
    number: document.getElementById('q-number')?.value || '',
    date: document.getElementById('q-date')?.value || new Date().toISOString().split('T')[0],
    validityDays: parseInt(document.getElementById('q-validity')?.value, 10) || 14,
    currency: document.getElementById('q-currency')?.value || 'MWK',
    discount: discountPct,
    tax: taxPct,
    subtotal,
    total,
    status: document.getElementById('q-status')?.value || 'pending',
    notes: document.getElementById('q-notes')?.value || '',
    departmentId: user.id || null,
    preparedBy: user.name || '',
    preparedByDept: user.department || ''
  };

  const saleId = document.getElementById('q-sale')?.value;
  if (saleId) data.saleId = saleId;

  const { db, saveLineItems, incrementQuoteNumber, logActivity } = window.KwezaDB;
  let id = quoteId;

  if (quoteId) {
    await db.quotations.update(quoteId, data);
    showToast('Quotation updated!', 'success');
  } else {
    id = await db.quotations.add(data);
    await incrementQuoteNumber();
    const client = await db.clients.get(clientId);
    await logActivity('quotation', `Quotation ${data.number} created for ${client?.name}`, total, id, 'quotation');
    showToast('Quotation created!', 'success');
  }

  await saveLineItems('quotation', id, quoteLineItems.filter(item => item.description));
  navigate(`quotations/${id}`);
}

async function convertQuote(quoteId) {
  if (!window.KwezaAuth.hasRole('sales', 'finance')) {
    showToast('Only Sales or Finance can convert quotations to invoices.', 'error');
    return;
  }

  if (!confirm('Convert this quotation to an invoice?')) return;

  try {
    const quote = await window.KwezaDB.db.quotations.get(quoteId);
    if (quote?.status !== 'approved') {
      showToast('Quotation must be approved before invoicing.', 'error');
      return;
    }

    const invoiceId = await window.KwezaDB.convertQuoteToInvoice(quoteId);
    showToast('Invoice created successfully!', 'success');
    navigate(`invoices/${invoiceId}`);
  } catch (error) {
    showToast(`Error converting quotation: ${error.message}`, 'error');
  }
}

async function deleteQuote(id) {
  if (!confirm('Delete this quotation?')) return;
  await window.KwezaDB.db.quotations.delete(id);
  await window.KwezaDB.db.lineItems.where({ docType: 'quotation', docId: id }).delete();
  showToast('Quotation deleted', 'info');
  await renderQuotations();
}

async function renderQuoteDetail(quoteId) {
  const { db, getLineItems, getAllSettings } = window.KwezaDB;
  const [quote, settings] = await Promise.all([
    db.quotations.get(quoteId),
    getAllSettings()
  ]);

  if (!quote) {
    navigate('quotations');
    return;
  }

  const [client, sale, lineItems] = await Promise.all([
    db.clients.get(quote.clientId),
    quote.saleId ? db.sales.get(quote.saleId) : Promise.resolve(null),
    getLineItems('quotation', quoteId)
  ]);

  const currency = quote.currency || settings.defaults.currency || 'MWK';
  const fmt = quoteCurrencyFormatter(currency);

  document.getElementById('quotations-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>${quote.number}</h2>
        <p><span class="badge ${quoteStatusBadge(quote.status)}">${quote.status || 'pending'}</span></p>
      </div>
      <div class="flex gap-8 builder-top-actions">
        <button class="btn btn-secondary" onclick="renderQuotations()">← Back</button>
        <button class="btn btn-primary" onclick="navigate('quotations/${quoteId}/edit')">Edit</button>
        <button class="btn btn-secondary" onclick="window.KwezaPDF.printDocument('quotation', '${quoteId}')">Print</button>
        <button class="btn btn-secondary" onclick="window.KwezaPDF.generatePDF('quotation', '${quoteId}')">Download PDF</button>
        <button class="btn btn-gold" onclick="window.KwezaShare.shareViaWhatsApp('quotation', '${quoteId}')">WhatsApp</button>
        ${quote.status !== 'converted' ? `<button class="btn btn-success" onclick="convertQuote('${quoteId}')">Convert to Invoice</button>` : ''}
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
        <div class="card-title" style="margin-bottom:8px;">Quotation Summary</div>
        <div class="summary-row"><span class="text-muted">Quotation No.</span><span class="font-bold">${quote.number}</span></div>
        <div class="summary-row"><span class="text-muted">Date</span><span>${new Date(quote.date).toLocaleDateString('en-GB')}</span></div>
        ${sale?.saleCode ? `<div class="summary-row"><span class="text-muted">Linked Sale</span><span>${sale.saleCode}</span></div>` : ''}
        <div class="summary-row"><span class="text-muted">Valid For</span><span>${quote.validityDays || 14} days</span></div>
        ${quote.preparedBy ? `<div class="summary-row"><span class="text-muted">Prepared by</span><span class="font-bold" style="color:var(--primary)">${quote.preparedBy}${quote.preparedByDept ? ` · ${quote.preparedByDept}` : ''}</span></div>` : ''}
        <div class="summary-row total"><span>Total Amount</span><span style="color:var(--primary)">${fmt(quote.total)}</span></div>
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
          <div class="summary-row"><span>Subtotal</span><span>${fmt(quote.subtotal)}</span></div>
          ${quote.discount > 0 ? `<div class="summary-row"><span>Discount (${quote.discount}%)</span><span style="color:var(--danger)">-${fmt(quote.subtotal * quote.discount / 100)}</span></div>` : ''}
          ${quote.tax > 0 ? `<div class="summary-row"><span>VAT (${quote.tax}%)</span><span>+${fmt((quote.subtotal - quote.subtotal * (quote.discount || 0) / 100) * quote.tax / 100)}</span></div>` : ''}
          <div class="summary-row total"><span>TOTAL</span><span>${fmt(quote.total)}</span></div>
        </div>
      </div>
    </div>
  `;
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, {
  renderQuotations,
  renderQuoteBuilder,
  renderQuoteDetail,
  addLineItem,
  removeLineItem,
  recalcTotals,
  recalcRow,
  openCatalogPicker,
  addFromCatalog,
  saveQuotation,
  convertQuote,
  deleteQuote,
  setQuoteStep,
  syncQuoteClientFromSale
});
