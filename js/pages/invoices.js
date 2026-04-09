/* ============================================
   KWEZA – INVOICES PAGE  (with dept isolation)
   ============================================ */
let invoiceLineItems = [];
let invoiceFilter = 'all';

/* ── Helper: filter records for current department ──
   Also shows legacy records (null/undefined departmentId)
   so data created before dept-isolation is never hidden. ── */
function applyDeptFilter(records) {
  const deptId = window.KwezaAuth?.getDeptFilter?.();
  if (!deptId) return records; // admin sees all
  return records.filter(r => r.departmentId === deptId || r.departmentId == null);
}

function setInvoiceStep(step) {
  document.querySelectorAll('#invoices-page .wizard-step').forEach((el, i) => {
    if (i + 1 === step) el.classList.add('active'); else el.classList.remove('active');
    if (i + 1 < step) el.classList.add('completed'); else el.classList.remove('completed');
  });
  document.querySelectorAll('#invoices-page .wizard-content').forEach((el, i) => {
    if (i + 1 === step) el.classList.add('active'); else el.classList.remove('active');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function renderInvoices(subpage = '') {
  if (subpage === 'new') { await renderInvoiceBuilder(null); return; }
  if (subpage && !isNaN(subpage)) { await renderInvoiceDetail(parseInt(subpage)); return; }

  const { db, getAllSettings } = window.KwezaDB;
  const [allInvoices, clients, settings] = await Promise.all([
    db.invoices.orderBy('id').reverse().toArray(),
    db.clients.toArray(),
    getAllSettings()
  ]);
  const invoices = applyDeptFilter(allInvoices);
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const currency = settings.defaults.currency || 'MWK';
  const fmt = n => `${currency} ${Number(n || 0).toLocaleString()}`;
  const filtered = invoiceFilter === 'all' ? invoices : invoices.filter(i => i.status === invoiceFilter);

  document.getElementById('invoices-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Invoices</h2>
        <p>${invoices.length} total invoice${invoices.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('invoices/new')">+ New Invoice</button>
    </div>
    <div class="tabs">
      ${['all','unpaid','partial','paid'].map(s => `
        <button class="tab-btn ${invoiceFilter===s?'active':''}" onclick="invoiceFilter='${s}';renderInvoices()">
          ${s.charAt(0).toUpperCase()+s.slice(1)}
          <span class="badge badge-muted" style="margin-left:4px;">${s==='all'?invoices.length:invoices.filter(i=>i.status===s).length}</span>
        </button>`).join('')}
    </div>
    ${filtered.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">🧾</div><h3>No invoices</h3>
         <button class="btn btn-primary mt-12" onclick="navigate('invoices/new')">+ Create Invoice</button></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${filtered.map(inv => invoiceCardHTML(inv, clientMap[inv.clientId], fmt)).join('')}</div>`
    }`;
}

function invoiceCardHTML(inv, client, fmt) {
  const statusMap = { unpaid:'badge-warning', partial:'badge-gold', paid:'badge-success' };
  const badge = statusMap[inv.status] || 'badge-muted';
  const date  = new Date(inv.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  const isOverdue = inv.status!=='paid' && inv.dueDate && new Date(inv.dueDate) < new Date();
  const preparedInfo = inv.preparedBy ? `<div class="doc-prepared">👤 ${inv.preparedBy}${inv.preparedByDept ? ' · ' + inv.preparedByDept : ''}</div>` : '';
  return `
    <div class="doc-card" onclick="navigate('invoices/${inv.id}')">
      <div class="doc-card-icon invoice">🧾</div>
      <div class="doc-card-info">
        <div class="doc-number">${inv.number} ${isOverdue?'<span class="badge badge-danger" style="font-size:9px;">OVERDUE</span>':''}</div>
        <div class="doc-client">${client?.name||'—'}</div>
        <div class="doc-date">${date}${inv.dueDate?' · Due '+new Date(inv.dueDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):''}</div>
        ${preparedInfo}
      </div>
      <div class="doc-card-right">
        <div class="doc-amount">${fmt(inv.total)}</div>
        <span class="badge ${badge}">${inv.status||'unpaid'}</span>
      </div>
      <div class="action-row" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="navigate('invoices/${inv.id}')">View</button>
        ${inv.status!=='paid'?`<button class="btn btn-success btn-sm" onclick="openPaymentModal(${inv.id})">💳 Pay</button>`:''}
        <button class="btn btn-ghost btn-icon" onclick="window.KwezaPDF.generatePDF('invoice',${inv.id})" title="Download">⬇️</button>
        <button class="btn btn-ghost btn-icon" onclick="window.KwezaShare.shareViaWhatsApp('invoice',${inv.id})" title="WhatsApp">💬</button>
        <button class="btn btn-ghost btn-icon" onclick="deleteInvoice(${inv.id})" title="Del">🗑</button>
      </div>
    </div>`;
}

async function renderInvoiceDetail(invoiceId) {
  const { db, getLineItems, getAllSettings } = window.KwezaDB;
  const [invoice, settings] = await Promise.all([db.invoices.get(invoiceId), getAllSettings()]);
  if (!invoice) { navigate('invoices'); return; }
  const client    = await db.clients.get(invoice.clientId);
  const lineItems = await getLineItems('invoice', invoiceId);
  const payments  = await db.payments.where('invoiceId').equals(invoiceId).toArray();
  const currency  = invoice.currency || settings.defaults.currency || 'MWK';
  const fmt = n => `${currency} ${Number(n||0).toLocaleString()}`;
  const totalPaid = payments.reduce((s,p) => s+p.amount, 0);
  const balance   = (invoice.total||0) - totalPaid;
  const statusMap = { unpaid:'badge-warning', partial:'badge-gold', paid:'badge-success' };

  document.getElementById('invoices-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>${invoice.number}</h2>
        <p><span class="badge ${statusMap[invoice.status]||'badge-muted'}">${invoice.status||'unpaid'}</span></p>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" onclick="renderInvoices()">← Back</button>
        <button class="btn btn-secondary" onclick="window.KwezaPDF.printDocument('invoice',${invoiceId})">🖨 Print</button>
        <button class="btn btn-secondary" onclick="window.KwezaPDF.generatePDF('invoice',${invoiceId})">⬇️ Download PDF</button>
        <button class="btn btn-gold"      onclick="window.KwezaShare.shareViaWhatsApp('invoice',${invoiceId})">💬 WhatsApp</button>
        ${invoice.status!=='paid'?`<button class="btn btn-success" onclick="openPaymentModal(${invoiceId})">💳 Record Payment</button>`:''}
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
        <div class="card-title" style="margin-bottom:8px;">Invoice Summary</div>
        <div class="summary-row"><span class="text-muted">Invoice No.</span><span class="font-bold">${invoice.number}</span></div>
        <div class="summary-row"><span class="text-muted">Date</span><span>${new Date(invoice.date).toLocaleDateString('en-GB')}</span></div>
        ${invoice.dueDate?`<div class="summary-row"><span class="text-muted">Due</span><span>${new Date(invoice.dueDate).toLocaleDateString('en-GB')}</span></div>`:''}
        ${invoice.preparedBy?`<div class="summary-row"><span class="text-muted">Prepared by</span><span class="font-bold" style="color:var(--primary)">${invoice.preparedBy}${invoice.preparedByDept?' · '+invoice.preparedByDept:''}</span></div>`:''}
        <div class="summary-row total"><span>Balance</span><span style="color:var(--danger)">${fmt(balance)}</span></div>
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
          <div class="summary-row"><span>Subtotal</span><span>${fmt(invoice.subtotal)}</span></div>
          ${invoice.discount>0?`<div class="summary-row"><span>Discount (${invoice.discount}%)</span><span style="color:var(--danger)">−${fmt(invoice.subtotal*invoice.discount/100)}</span></div>`:''}
          ${invoice.tax>0?`<div class="summary-row"><span>VAT (${invoice.tax}%)</span><span>+${fmt((invoice.subtotal-invoice.subtotal*(invoice.discount||0)/100)*invoice.tax/100)}</span></div>`:''}
          <div class="summary-row total"><span>TOTAL</span><span>${fmt(invoice.total)}</span></div>
        </div>
      </div>
    </div>
    <div class="card mt-20" style="margin-top:20px;">
      <div class="card-header">
        <div class="card-title">Payment History</div>
        <span class="badge ${totalPaid>=invoice.total?'badge-success':'badge-warning'}">Paid: ${fmt(totalPaid)}</span>
      </div>
      ${payments.length===0?'<div class="text-muted text-sm">No payments recorded yet.</div>'
        :`<table class="data-table"><thead><tr><th>Date</th><th>Method</th><th>Notes</th><th style="text-align:right;">Amount</th></tr></thead><tbody>
        ${payments.map(p=>`<tr><td>${new Date(p.date).toLocaleDateString('en-GB')}</td><td>${p.method||'—'}</td><td>${p.notes||'—'}</td><td style="text-align:right;font-weight:700;color:var(--success)">${fmt(p.amount)}</td></tr>`).join('')}
        </tbody></table>`}
    </div>`;
}

async function renderInvoiceBuilder(invoiceId) {
  const { db, getNextInvoiceNumber, getAllSettings } = window.KwezaDB;
  const isEdit = invoiceId !== null;
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;

  // Clients: staff see their dept's clients; admin sees all
  // Also include legacy clients with no departmentId so old data isn't lost
  let allClients = await db.clients.toArray();
  if (deptId) allClients = allClients.filter(c => c.departmentId === deptId || c.departmentId == null);

  const [settings, invoice] = await Promise.all([
    getAllSettings(),
    isEdit ? db.invoices.get(invoiceId) : Promise.resolve(null)
  ]);
  invoiceLineItems = isEdit ? await window.KwezaDB.getLineItems('invoice', invoiceId) : [{description:'',rate:0,qty:1,discount:0,amount:0}];
  const nextNum = isEdit ? invoice.number : await getNextInvoiceNumber();
  const today = new Date().toISOString().split('T')[0];
  const due30 = new Date(); due30.setDate(due30.getDate()+30);
  const currency = settings.defaults.currency||'MWK';

  document.getElementById('invoices-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>${isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
        <p>Step-by-step Invoice Builder</p>
      </div>
      <div class="flex gap-8 builder-top-actions">
        <button class="btn btn-secondary" onclick="renderInvoices()">← Back</button>
        <button class="btn btn-success" onclick="saveInvoice(${invoiceId})">💾 Save Invoice</button>
      </div>
    </div>

    <!-- WIZARD PROGRESS BAR -->
    <div class="wizard-steps" style="padding: 0 10%;">
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

    <!-- STEP 1: DETAILS -->
    <div class="wizard-content active" id="iw-step-1">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:16px;">Client & Details</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client <span>*</span></label>
            <select class="form-control" id="inv-client">
              <option value="">— Select Client —</option>
              ${allClients.map(c=>`<option value="${c.id}" ${invoice?.clientId==c.id?'selected':''}>${c.name}${c.company?' ('+c.company+')':''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Invoice Number</label>
            <input class="form-control" id="inv-number" value="${nextNum}" />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-control" id="inv-date" type="date" value="${invoice?invoice.date.split('T')[0]:today}" />
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input class="form-control" id="inv-due" type="date" value="${invoice?.dueDate?invoice.dueDate.split('T')[0]:due30.toISOString().split('T')[0]}" />
          </div>
        </div>
        <div class="form-row mt-12" style="margin-top:12px;">
          <div class="form-group">
            <label class="form-label">Currency</label>
            <select class="form-control" id="inv-currency">
              <option value="MWK" ${(invoice?.currency||currency)==='MWK'?'selected':''}>MWK</option>
              <option value="USD" ${(invoice?.currency||currency)==='USD'?'selected':''}>USD</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Discount (%)</label>
            <input class="form-control" id="inv-discount" type="number" min="0" max="100" value="${invoice?.discount||0}" oninput="recalcInvTotals()" />
          </div>
          <div class="form-group">
            <label class="form-label">VAT (%)</label>
            <input class="form-control" id="inv-tax" type="number" min="0" value="${invoice?.tax??settings.defaults.vatRate??16.5}" oninput="recalcInvTotals()" />
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="inv-status">
              <option value="unpaid" ${invoice?.status==='unpaid'?'selected':''}>Unpaid</option>
              <option value="partial" ${invoice?.status==='partial'?'selected':''}>Partial</option>
              <option value="paid" ${invoice?.status==='paid'?'selected':''}>Paid</option>
            </select>
          </div>
        </div>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="renderInvoices()">Cancel</button>
        <button class="btn btn-primary" onclick="window.KwezaPages.setInvoiceStep(2)">Next: Services →</button>
      </div>
    </div>

    <!-- STEP 2: SERVICES & ITEMS -->
    <div class="wizard-content" id="iw-step-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Services Overview</div>
          <div class="flex gap-8">
            <button class="btn btn-secondary btn-sm" onclick="openInvCatalogPicker()">📦 Catalog</button>
            <button class="btn btn-primary btn-sm" onclick="addInvLineItem()">+ Add Service</button>
          </div>
        </div>
        <table class="line-items-table" id="inv-line-items-table">
          <thead><tr>
            <th style="width:40%;">Description</th><th style="width:15%;text-align:right;">Rate</th>
            <th style="width:8%;text-align:center;">Qty</th><th style="width:10%;text-align:center;">Disc%</th>
            <th style="width:18%;text-align:right;">Amount</th><th style="width:9%;"></th>
          </tr></thead>
          <tbody id="inv-line-items-body"></tbody>
        </table>
      </div>
      <div class="wizard-actions">
        <button class="btn btn-secondary" onclick="window.KwezaPages.setInvoiceStep(1)">← Back</button>
        <button class="btn btn-primary" onclick="window.KwezaPages.setInvoiceStep(3)">Next: Review →</button>
      </div>
    </div>

    <!-- STEP 3: REVIEW & TOTALS -->
    <div class="wizard-content" id="iw-step-3">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:16px;">Summary & Notes</h3>
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-control" id="inv-notes" rows="6">${invoice?.notes||''}</textarea>
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
        <button class="btn btn-success" onclick="saveInvoice(${invoiceId})">💾 Save Invoice</button>
      </div>
    </div>
  renderInvLineItemRows(); recalcInvTotals();
}

function fmtNum(n) { return Number(n||0).toLocaleString('en-MW',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function renderInvLineItemRows() {
  const tbody = document.getElementById('inv-line-items-body');
  if (!tbody) return;
  tbody.innerHTML = invoiceLineItems.map((item,i) => `
    <tr>
      <td><input class="form-control" value="${item.description||''}" placeholder="Service…" oninput="invoiceLineItems[${i}].description=this.value" /></td>
      <td><input class="form-control" type="number" min="0" value="${item.rate||0}" style="text-align:right;" oninput="invoiceLineItems[${i}].rate=parseFloat(this.value)||0;recalcInvRow(${i})" /></td>
      <td><input class="form-control" type="number" min="1" value="${item.qty||1}" style="text-align:center;" oninput="invoiceLineItems[${i}].qty=parseFloat(this.value)||1;recalcInvRow(${i})" /></td>
      <td><input class="form-control" type="number" min="0" max="100" value="${item.discount||0}" style="text-align:center;" oninput="invoiceLineItems[${i}].discount=parseFloat(this.value)||0;recalcInvRow(${i})" /></td>
      <td class="amount-cell" id="iamt-${i}">${fmtNum(item.amount||0)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="removeInvLineItem(${i})" ${invoiceLineItems.length<=1?'disabled':''}>✕</button></td>
    </tr>`).join('');
}

function recalcInvRow(i) {
  const item = invoiceLineItems[i];
  item.amount = (item.rate||0)*(item.qty||1)*(1-(item.discount||0)/100);
  const el = document.getElementById(`iamt-${i}`); if(el) el.textContent=fmtNum(item.amount);
  recalcInvTotals();
}
function recalcInvTotals() {
  const sub=invoiceLineItems.reduce((s,i)=>s+(i.amount||0),0);
  const d=parseFloat(document.getElementById('inv-discount')?.value)||0;
  const t=parseFloat(document.getElementById('inv-tax')?.value)||0;
  const dA=sub*d/100, tA=(sub-dA)*t/100, tot=sub-dA+tA;
  const cur=document.getElementById('inv-currency')?.value||'MWK';
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('is-subtotal',`${cur} ${fmtNum(sub)}`); set('is-discount',dA>0?`— ${cur} ${fmtNum(dA)}`:'—');
  set('is-vat',tA>0?`+ ${cur} ${fmtNum(tA)}`:'—'); set('is-total',`${cur} ${fmtNum(tot)}`);
}
function addInvLineItem(){invoiceLineItems.push({description:'',rate:0,qty:1,discount:0,amount:0});renderInvLineItemRows();recalcInvTotals();}
function removeInvLineItem(i){invoiceLineItems.splice(i,1);renderInvLineItemRows();recalcInvTotals();}

function openInvCatalogPicker() {
  window.KwezaDB.db.catalog.toArray().then(items => {
    const modal=document.getElementById('modal-overlay');
    modal.innerHTML=`<div class="modal"><div class="modal-header"><h3>📦 Catalog</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body" style="max-height:400px;overflow-y:auto;">
      ${items.map(item=>`<div class="catalog-card" style="margin-bottom:8px;" onclick="addInvFromCatalog(${item.id});closeModal()">
        <div class="catalog-icon">📦</div><div style="flex:1"><div class="catalog-name">${item.name}</div></div>
        <div class="catalog-price">MWK ${Number(item.price).toLocaleString()}</div></div>`).join('')}
    </div></div>`;
    modal.classList.add('active');
  });
}
function addInvFromCatalog(id){window.KwezaDB.db.catalog.get(id).then(item=>{if(!item)return;invoiceLineItems.push({description:item.name,rate:item.price,qty:1,discount:0,amount:item.price});renderInvLineItemRows();recalcInvTotals();});}

async function saveInvoice(invoiceId) {
  const clientId=parseInt(document.getElementById('inv-client')?.value);
  if(!clientId){showToast('Select a client','error');return;}
  const sub=invoiceLineItems.reduce((s,i)=>s+(i.amount||0),0);
  const d=parseFloat(document.getElementById('inv-discount')?.value)||0;
  const t=parseFloat(document.getElementById('inv-tax')?.value)||0;
  const dA=sub*d/100,tA=(sub-dA)*t/100,total=sub-dA+tA;

  const user = window.KwezaAuth?.getCurrentUser?.() || {};
  const data = {
    clientId,
    number:        document.getElementById('inv-number')?.value||'',
    date:          document.getElementById('inv-date')?.value,
    dueDate:       document.getElementById('inv-due')?.value,
    currency:      document.getElementById('inv-currency')?.value||'MWK',
    discount:      d, tax:t, subtotal:sub, total,
    status:        document.getElementById('inv-status')?.value||'unpaid',
    notes:         document.getElementById('inv-notes')?.value||'',
    departmentId:  user.id   || null,
    preparedBy:    user.name || '',
    preparedByDept:user.department || ''
  };

  const {db,saveLineItems,incrementInvoiceNumber,logActivity}=window.KwezaDB;
  let id=invoiceId;
  if(invoiceId){await db.invoices.update(invoiceId,data);showToast('Invoice updated!','success');}
  else{id=await db.invoices.add(data);await incrementInvoiceNumber();const client=await db.clients.get(clientId);await logActivity('invoice',`Invoice ${data.number} for ${client?.name}`,total,id,'invoice');showToast('Invoice created!','success');}
  await saveLineItems('invoice',id,invoiceLineItems.filter(i=>i.description));
  navigate(`invoices/${id}`);
}

function openPaymentModal(invoiceId) {
  const modal=document.getElementById('modal-overlay');
  modal.innerHTML=`<div class="modal modal-sm"><div class="modal-header"><h3>💳 Record Payment</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label class="form-label">Amount <span>*</span></label><input class="form-control" id="pay-amount" type="number" min="0" placeholder="Enter amount" /></div>
      <div class="form-group"><label class="form-label">Method</label><select class="form-control" id="pay-method"><option>Bank Transfer</option><option>Mobile Money</option><option>Cash</option><option>Cheque</option><option>Other</option></select></div>
      <div class="form-group"><label class="form-label">Notes</label><input class="form-control" id="pay-notes" placeholder="Reference…" /></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-success" onclick="submitPayment(${invoiceId})">✓ Record</button></div>
  </div>`;
  modal.classList.add('active');
}
async function submitPayment(invoiceId) {
  const amount=parseFloat(document.getElementById('pay-amount')?.value);
  if(!amount||amount<=0){showToast('Enter a valid amount','error');return;}
  const status=await window.KwezaDB.recordPayment(invoiceId,amount,document.getElementById('pay-method')?.value,document.getElementById('pay-notes')?.value);
  showToast(`Payment recorded! Status: ${status}.`,'success');
  closeModal(); renderInvoiceDetail(invoiceId);
}
async function deleteInvoice(id){if(!confirm('Delete this invoice?'))return;await window.KwezaDB.db.invoices.delete(id);showToast('Invoice deleted','info');renderInvoices();}

window.KwezaPages=window.KwezaPages||{};
Object.assign(window.KwezaPages,{renderInvoices,renderInvoiceDetail,renderInvoiceBuilder,addInvLineItem,removeInvLineItem,recalcInvTotals,recalcInvRow,openInvCatalogPicker,addInvFromCatalog,saveInvoice,openPaymentModal,submitPayment,deleteInvoice,setInvoiceStep});
