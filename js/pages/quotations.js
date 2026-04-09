/* ============================================
   KWEZA – QUOTATIONS PAGE (with dept isolation)
   ============================================ */
let quoteLineItems = [];
let quoteFilter = 'all';

/* ── Helper: filter records for current department ──
   Also shows legacy records (null/undefined departmentId)
   so data created before dept-isolation is never hidden. ── */
function applyDeptFilter(records) {
  const deptId = window.KwezaAuth?.getDeptFilter?.();
  if (!deptId) return records; // admin sees all
  return records.filter(r => r.departmentId === deptId || r.departmentId == null);
}

function setQuoteStep(step) {
  document.querySelectorAll('#quotations-page .wizard-step').forEach((el, i) => {
    if (i + 1 === step) el.classList.add('active'); else el.classList.remove('active');
    if (i + 1 < step) el.classList.add('completed'); else el.classList.remove('completed');
  });
  document.querySelectorAll('#quotations-page .wizard-content').forEach((el, i) => {
    if (i + 1 === step) el.classList.add('active'); else el.classList.remove('active');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function renderQuotations(subpage = '') {
  if (subpage === 'new') { await renderQuoteBuilder(null); return; }
  if (subpage && subpage.endsWith('/edit')) { await renderQuoteBuilder(parseInt(subpage.split('/')[0])); return; }
  if (subpage && !isNaN(subpage)) { await renderQuoteDetail(parseInt(subpage)); return; }

  const { db, getAllSettings } = window.KwezaDB;
  const [allQuotations, clients, settings] = await Promise.all([
    db.quotations.orderBy('id').reverse().toArray(),
    db.clients.toArray(),
    getAllSettings()
  ]);
  const quotations = applyDeptFilter(allQuotations);
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const currency = settings.defaults.currency || 'MWK';
  const fmt = n => `${currency} ${Number(n || 0).toLocaleString()}`;

  const filtered = quoteFilter === 'all' ? quotations : quotations.filter(q => q.status === quoteFilter);

  document.getElementById('quotations-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Quotations</h2>
        <p>${quotations.length} total quotation${quotations.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('quotations/new')">+ New Quotation</button>
    </div>

    <div class="tabs">
      ${['all','pending','converted','expired'].map(s => `
        <button class="tab-btn ${quoteFilter===s?'active':''}" onclick="quoteFilter='${s}';renderQuotations()">
          ${s.charAt(0).toUpperCase()+s.slice(1)}
          <span class="badge badge-muted" style="margin-left:4px;">${s==='all'?quotations.length:quotations.filter(q=>q.status===s).length}</span>
        </button>`).join('')}
    </div>

    ${filtered.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No quotations${quoteFilter!=='all'?' with status "'+quoteFilter+'"':''}</h3>
         <button class="btn btn-primary mt-12" onclick="navigate('quotations/new')">+ Create First Quotation</button></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${filtered.map(q => quoteCardHTML(q, clientMap[q.clientId], fmt)).join('')}</div>`
    }
  `;
}

function quoteCardHTML(q, client, fmt) {
  const statusMap = { pending:'badge-warning', converted:'badge-success', expired:'badge-danger', draft:'badge-muted' };
  const badge = statusMap[q.status] || 'badge-muted';
  const date = new Date(q.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const preparedInfo = q.preparedBy ? `<div class="doc-prepared">👤 ${q.preparedBy}${q.preparedByDept ? ' · ' + q.preparedByDept : ''}</div>` : '';
  return `
    <div class="doc-card" onclick="navigate('quotations/${q.id}')">
      <div class="doc-card-icon quote">📋</div>
      <div class="doc-card-info">
        <div class="doc-number">${q.number}</div>
        <div class="doc-client">${client?.name || '—'}</div>
        <div class="doc-date">${date} · Valid ${q.validityDays || 14} days</div>
        ${preparedInfo}
      </div>
      <div class="doc-card-right">
        <div class="doc-amount">${fmt(q.total)}</div>
        <span class="badge ${badge}">${q.status || 'pending'}</span>
      </div>
      <div class="action-row" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="navigate('quotations/${q.id}')">View</button>
        ${q.status !== 'converted' ? `<button class="btn btn-success btn-sm" onclick="convertQuote(${q.id})">→ Invoice</button>` : ''}
        <button class="btn btn-ghost btn-icon" onclick="window.KwezaPDF.generatePDF('quotation',${q.id})" title="Download">⬇️</button>
        <button class="btn btn-ghost btn-icon" onclick="window.KwezaShare.shareViaWhatsApp('quotation',${q.id})" title="WhatsApp">💬</button>
        <button class="btn btn-ghost btn-icon" onclick="deleteQuote(${q.id})" title="Delete">🗑</button>
      </div>
    </div>`;
}

async function renderQuoteBuilder(quoteId = null) {
  const { db, getNextQuoteNumber, getAllSettings } = window.KwezaDB;
  const isEdit = quoteId !== null;
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;

  let allClients = await db.clients.toArray();
  // Also include legacy clients with no departmentId so old data isn't lost
  if (deptId) allClients = allClients.filter(c => c.departmentId === deptId || c.departmentId == null);

  const [catalogItems, settings, quote] = await Promise.all([
    db.catalog.toArray(),
    getAllSettings(),
    isEdit ? db.quotations.get(quoteId) : Promise.resolve(null)
  ]);

  const lineItemsData = isEdit ? await window.KwezaDB.getLineItems('quotation', quoteId) : [];
  quoteLineItems = isEdit ? lineItemsData.map(i => ({ ...i })) : [{ description:'', rate:0, qty:1, discount:0, amount:0 }];

  const nextNum = isEdit ? quote.number : await getNextQuoteNumber();
  const today = new Date().toISOString().split('T')[0];
  const currency = settings.defaults.currency || 'MWK';

  document.getElementById('quotations-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>${isEdit ? 'Edit Quotation' : 'New Quotation'}</h2>
        <p>Step-by-step Quote Builder</p>
      </div>
      <div class="flex gap-8 builder-top-actions">
        <button class="btn btn-secondary" onclick="renderQuotations()">← Back</button>
        <button class="btn btn-success" onclick="saveQuotation(${quoteId})">💾 Save Quotation</button>
      </div>
    </div>

    <!-- WIZARD PROGRESS BAR -->
    <div class="wizard-steps" style="padding: 0 10%;">
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

    <!-- STEP 1: DETAILS -->
    <div class="wizard-content active" id="qw-step-1">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:16px;">Client & Details</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client <span>*</span></label>
            <select class="form-control" id="q-client" onchange="updateQuoteHeader?.()">
              <option value="">— Select Client —</option>
              ${allClients.map(c => `<option value="${c.id}" ${quote?.clientId==c.id?'selected':''}>${c.name}${c.company?' ('+c.company+')':''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Quotation Number</label>
            <input class="form-control" id="q-number" value="${nextNum}" />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-control" id="q-date" type="date" value="${quote ? quote.date.split('T')[0] : today}" />
          </div>
          <div class="form-group">
            <label class="form-label">Valid for (days)</label>
            <input class="form-control" id="q-validity" type="number" value="${quote?.validityDays || settings.defaults.validityDays || 14}" min="1" />
          </div>
        </div>
        <div class="form-row mt-12" style="margin-top:12px;">
          <div class="form-group">
            <label class="form-label">Currency</label>
            <select class="form-control" id="q-currency">
              <option value="MWK" ${(quote?.currency||currency)==='MWK'?'selected':''}>MWK – Malawian Kwacha</option>
              <option value="USD" ${(quote?.currency||currency)==='USD'?'selected':''}>USD – US Dollar</option>
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
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="q-status">
              <option value="pending"   ${quote?.status==='pending'?'selected':''}>Pending</option>
              <option value="draft"     ${quote?.status==='draft'?'selected':''}>Draft</option>
              <option value="expired"   ${quote?.status==='expired'?'selected':''}>Expired</option>
            </select>
          </div>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="renderQuotations()">Cancel</button>
        <button class="btn btn-primary" onclick="window.KwezaPages.setQuoteStep(2)">Next: Services →</button>
      </div>
    </div>

    <!-- STEP 2: SERVICES & ITEMS -->
    <div class="wizard-content" id="qw-step-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Services Overview</div>
          <div class="flex gap-8">
            <button class="btn btn-secondary btn-sm" onclick="openCatalogPicker()">📦 From Catalog</button>
            <button class="btn btn-primary btn-sm" onclick="addLineItem()">+ Add Service</button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="line-items-table" id="line-items-table">
            <thead><tr>
              <th style="width:40%;">Description</th>
              <th style="width:15%;text-align:right;">Rate (${currency})</th>
              <th style="width:8%;text-align:center;">Qty</th>
              <th style="width:10%;text-align:center;">Disc %</th>
              <th style="width:18%;text-align:right;">Amount</th>
              <th style="width:9%;"></th>
            </tr></thead>
            <tbody id="line-items-body"></tbody>
          </table>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="window.KwezaPages.setQuoteStep(1)">← Back</button>
        <button class="btn btn-primary" onclick="window.KwezaPages.setQuoteStep(3)">Next: Review →</button>
      </div>
    </div>

    <!-- STEP 3: REVIEW & TOTALS -->
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
            <div class="summary-row"><span>Discount</span><span id="s-discount" style="color:var(--danger)">— MWK 0.00</span></div>
            <div class="summary-row"><span>VAT</span><span id="s-vat">+ MWK 0.00</span></div>
            <div class="summary-row total"><span>TOTAL</span><span id="s-total">MWK 0.00</span></div>
          </div>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="window.KwezaPages.setQuoteStep(2)">← Back</button>
        <button class="btn btn-success" onclick="saveQuotation(${quoteId})">💾 Save Quotation</button>
      </div>
    </div>
  `;
  renderLineItemRows();
  recalcTotals();
}

function renderLineItemRows() {
  const tbody = document.getElementById('line-items-body');
  if (!tbody) return;
  tbody.innerHTML = quoteLineItems.map((item, i) => `
    <tr id="li-row-${i}">
      <td><input class="form-control" value="${item.description||''}" placeholder="Service description…"
          oninput="quoteLineItems[${i}].description=this.value" /></td>
      <td><input class="form-control" type="number" min="0" value="${item.rate||0}" style="text-align:right;"
          oninput="quoteLineItems[${i}].rate=parseFloat(this.value)||0;recalcRow(${i})" /></td>
      <td><input class="form-control" type="number" min="1" value="${item.qty||1}" style="text-align:center;"
          oninput="quoteLineItems[${i}].qty=parseFloat(this.value)||1;recalcRow(${i})" /></td>
      <td><input class="form-control" type="number" min="0" max="100" value="${item.discount||0}" style="text-align:center;"
          oninput="quoteLineItems[${i}].discount=parseFloat(this.value)||0;recalcRow(${i})" /></td>
      <td class="amount-cell" id="li-amt-${i}">${fmtNum(item.amount||0)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="removeLineItem(${i})" ${quoteLineItems.length<=1?'disabled':''}>✕</button></td>
    </tr>`).join('');
}

function fmtNum(n) { return Number(n||0).toLocaleString('en-MW', {minimumFractionDigits:2, maximumFractionDigits:2}); }

function recalcRow(i) {
  const item = quoteLineItems[i];
  item.amount = (item.rate || 0) * (item.qty || 1) * (1 - (item.discount || 0) / 100);
  const el = document.getElementById(`li-amt-${i}`);
  if (el) el.textContent = fmtNum(item.amount);
  recalcTotals();
}

function recalcTotals() {
  const subtotal  = quoteLineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const discPct   = parseFloat(document.getElementById('q-discount')?.value) || 0;
  const taxPct    = parseFloat(document.getElementById('q-tax')?.value) || 0;
  const discAmt   = subtotal * discPct / 100;
  const taxable   = subtotal - discAmt;
  const taxAmt    = taxable * taxPct / 100;
  const total     = taxable + taxAmt;
  const cur       = document.getElementById('q-currency')?.value || 'MWK';

  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('s-subtotal', `${cur} ${fmtNum(subtotal)}`);
  set('s-discount', discAmt > 0 ? `— ${cur} ${fmtNum(discAmt)}` : '—');
  set('s-vat',      taxAmt > 0  ? `+ ${cur} ${fmtNum(taxAmt)}`  : '—');
  set('s-total',    `${cur} ${fmtNum(total)}`);
}

function addLineItem() {
  quoteLineItems.push({ description:'', rate:0, qty:1, discount:0, amount:0 });
  renderLineItemRows();
  recalcTotals();
}
function removeLineItem(i) {
  quoteLineItems.splice(i, 1);
  renderLineItemRows();
  recalcTotals();
}

function openCatalogPicker() {
  window.KwezaDB.db.catalog.toArray().then(items => {
    const modal = document.getElementById('modal-overlay');
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>📦 Pick from Catalog</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
        <div class="modal-body" style="max-height:420px;overflow-y:auto;">
          ${items.length === 0
            ? `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Catalog is empty</h3><p>Add items in the Catalog section first</p></div>`
            : items.map(item => `
              <div class="catalog-card" style="margin-bottom:8px;" onclick="addFromCatalog(${item.id});closeModal()">
                <div class="catalog-icon">📦</div>
                <div style="flex:1;"><div class="catalog-name">${item.name}</div><div class="catalog-category">${item.category}</div></div>
                <div class="catalog-price">MWK ${Number(item.price).toLocaleString()}</div>
              </div>`).join('')}
        </div>
      </div>`;
    modal.classList.add('active');
  });
}

function addFromCatalog(catalogId) {
  window.KwezaDB.db.catalog.get(catalogId).then(item => {
    if (!item) return;
    quoteLineItems.push({ description: item.name, rate: item.price, qty: 1, discount: 0, amount: item.price, catalogId });
    renderLineItemRows();
    recalcTotals();
  });
}

async function saveQuotation(quoteId) {
  const clientId = parseInt(document.getElementById('q-client')?.value);
  if (!clientId) { showToast('Please select a client', 'error'); return; }
  if (quoteLineItems.every(i => !i.description)) { showToast('Add at least one line item', 'error'); return; }

  const subtotal = quoteLineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const discPct  = parseFloat(document.getElementById('q-discount')?.value) || 0;
  const taxPct   = parseFloat(document.getElementById('q-tax')?.value) || 0;
  const discAmt  = subtotal * discPct / 100;
  const taxAmt   = (subtotal - discAmt) * taxPct / 100;
  const total    = subtotal - discAmt + taxAmt;

  const user = window.KwezaAuth?.getCurrentUser?.() || {};
  const data = {
    clientId,
    number:        document.getElementById('q-number')?.value || '',
    date:          document.getElementById('q-date')?.value || new Date().toISOString().split('T')[0],
    validityDays:  parseInt(document.getElementById('q-validity')?.value) || 14,
    currency:      document.getElementById('q-currency')?.value || 'MWK',
    discount:      discPct, tax: taxPct, subtotal, total,
    status:        document.getElementById('q-status')?.value || 'pending',
    notes:         document.getElementById('q-notes')?.value || '',
    departmentId:  user.id   || null,
    preparedBy:    user.name || '',
    preparedByDept:user.department || ''
  };

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
  await saveLineItems('quotation', id, quoteLineItems.filter(i => i.description));
  navigate(`quotations/${id}`);
}

async function convertQuote(quoteId) {
  if (!confirm('Convert this quotation to an invoice?')) return;
  try {
    const invoiceId = await window.KwezaDB.convertQuoteToInvoice(quoteId);
    showToast('Invoice created successfully!', 'success');
    navigate(`invoices/${invoiceId}`);
  } catch(e) {
    showToast('Error converting: ' + e.message, 'error');
  }
}

async function deleteQuote(id) {
  if (!confirm('Delete this quotation?')) return;
  await window.KwezaDB.db.quotations.delete(id);
  await window.KwezaDB.db.lineItems.where({ docType:'quotation', docId: id }).delete();
  showToast('Quotation deleted', 'info');
  renderQuotations();
}

async function renderQuoteDetail(quoteId) {
  const { db, getLineItems, getAllSettings } = window.KwezaDB;
  const [quote, settings] = await Promise.all([db.quotations.get(quoteId), getAllSettings()]);
  if (!quote) { navigate('quotations'); return; }
  const client    = await db.clients.get(quote.clientId);
  const lineItems = await getLineItems('quotation', quoteId);
  const currency  = quote.currency || settings.defaults.currency || 'MWK';
  const fmt = n => `${currency} ${Number(n||0).toLocaleString()}`;
  const statusMap = { pending:'badge-warning', converted:'badge-success', draft:'badge-muted', expired:'badge-danger' };

  document.getElementById('quotations-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>${quote.number}</h2>
        <p><span class="badge ${statusMap[quote.status]||'badge-muted'}">${quote.status||'pending'}</span></p>
      </div>
      <div class="flex gap-8 builder-top-actions">
        <button class="btn btn-secondary" onclick="renderQuotations()">← Back</button>
        <button class="btn btn-primary" onclick="navigate('quotations/${quoteId}/edit')">✏️ Edit</button>
        <button class="btn btn-secondary" onclick="window.KwezaPDF.printDocument('quotation',${quoteId})">🖨 Print</button>
        <button class="btn btn-secondary" onclick="window.KwezaPDF.generatePDF('quotation',${quoteId})">⬇️ Download PDF</button>
        <button class="btn btn-gold"      onclick="window.KwezaShare.shareViaWhatsApp('quotation',${quoteId})">💬 WhatsApp</button>
        ${quote.status !== 'converted' ? `<button class="btn btn-success" onclick="convertQuote(${quoteId})">→ Convert to Invoice</button>` : ''}
      </div>
    </div>
    
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title" style="margin-bottom:8px;">Client Details</div>
        <div class="font-bold">${client?.name||'—'}</div>
        ${client?.company?`<div class="text-muted text-sm">${client.company}</div>`:''}
        ${client?.phone?`<div class="text-sm mt-4">${client.phone}</div>`:''}
        ${client?.email?`<div class="text-sm">${client.email}</div>`:''}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:8px;">Quotation Summary</div>
        <div class="summary-row"><span class="text-muted">Quotation No.</span><span class="font-bold">${quote.number}</span></div>
        <div class="summary-row"><span class="text-muted">Date</span><span>${new Date(quote.date).toLocaleDateString('en-GB')}</span></div>
        <div class="summary-row"><span class="text-muted">Valid For</span><span>${quote.validityDays || 14} days</span></div>
        ${quote.preparedBy?`<div class="summary-row"><span class="text-muted">Prepared by</span><span class="font-bold" style="color:var(--primary)">${quote.preparedBy}${quote.preparedByDept?' · '+quote.preparedByDept:''}</span></div>`:''}
        <div class="summary-row total"><span>Total Amount</span><span style="color:var(--primary)">${fmt(quote.total)}</span></div>
      </div>
    </div>
    
    <div class="card mt-20" style="margin-top:20px;">
      <div class="card-title" style="margin-bottom:12px;">Line Items</div>
      <table class="data-table"><thead><tr>
        <th>Description</th><th style="text-align:right;">Rate</th>
        <th style="text-align:center;">Qty</th><th style="text-align:center;">Disc%</th><th style="text-align:right;">Amount</th>
      </tr></thead><tbody>
        ${lineItems.map(i=>`<tr>
          <td>${i.description}</td><td style="text-align:right;">${fmt(i.rate)}</td>
          <td style="text-align:center;">${i.qty}</td><td style="text-align:center;">${i.discount>0?i.discount+'%':'—'}</td>
          <td style="text-align:right;font-weight:600;">${fmt(i.amount)}</td>
        </tr>`).join('')}
      </tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <div class="summary-box" style="width:280px;">
          <div class="summary-row"><span>Subtotal</span><span>${fmt(quote.subtotal)}</span></div>
          ${quote.discount>0?`<div class="summary-row"><span>Discount (${quote.discount}%)</span><span style="color:var(--danger)">−${fmt(quote.subtotal*quote.discount/100)}</span></div>`:''}
          ${quote.tax>0?`<div class="summary-row"><span>VAT (${quote.tax}%)</span><span>+${fmt((quote.subtotal-quote.subtotal*(quote.discount||0)/100)*quote.tax/100)}</span></div>`:''}
          <div class="summary-row total"><span>TOTAL</span><span>${fmt(quote.total)}</span></div>
        </div>
      </div>
    </div>
  `;
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, {
  renderQuotations, renderQuoteBuilder, renderQuoteDetail, addLineItem, removeLineItem,
  recalcTotals, recalcRow, openCatalogPicker, addFromCatalog,
  saveQuotation, convertQuote, deleteQuote, setQuoteStep
});
