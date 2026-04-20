/* ============================================
   KWEZA – LOANS PAGE (with dept isolation)
   ============================================ */
async function renderLoans(subpage='') {
  if (subpage==='new') { openLoanModal(); return; }
  const { db, getAllSettings } = window.KwezaDB;

  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;
  let allLoans = await db.loans.orderBy('id').reverse().toArray();
  if (deptId) allLoans = allLoans.filter(l => l.departmentId === deptId);

  const [clients, settings] = await Promise.all([
    db.clients.toArray(),
    getAllSettings()
  ]);
  const clientMap = Object.fromEntries(clients.map(c=>[c.id,c]));
  const currency = settings.defaults.currency||'MWK';
  const fmt = n => `${currency} ${Number(n||0).toLocaleString()}`;

  const totalLoaned = allLoans.reduce((s,l)=>s+(l.amount||0),0);
  const totalOutstanding = allLoans.filter(l=>l.status!=='paid').reduce((s,l)=>s+(l.balance||0),0);

  document.getElementById('loans-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Loan Tracker</h2><p>${allLoans.length} loan${allLoans.length!==1?'s':''} tracked</p></div>
      <button class="btn btn-primary" onclick="openLoanModal()">+ New Loan</button>
    </div>
    <div class="grid grid-3 mb-20" style="margin-bottom:20px;">
      <div class="stat-card gold"><div class="stat-card-icon">💰</div><div class="stat-card-value">${fmt(totalLoaned)}</div><div class="stat-card-label">Total Loaned</div></div>
      <div class="stat-card red"><div class="stat-card-icon">⏳</div><div class="stat-card-value">${fmt(totalOutstanding)}</div><div class="stat-card-label">Outstanding</div></div>
      <div class="stat-card green"><div class="stat-card-icon">✅</div><div class="stat-card-value">${allLoans.filter(l=>l.status==='paid').length}</div><div class="stat-card-label">Fully Paid</div></div>
    </div>
    ${allLoans.length===0
      ? `<div class="empty-state"><div class="empty-state-icon">💸</div><h3>No loans tracked</h3><p>Track money you've lent to clients</p>
         <button class="btn btn-primary mt-12" onclick="openLoanModal()">+ Add First Loan</button></div>`
      : `<div style="display:flex;flex-direction:column;gap:14px;">${allLoans.map(l=>loanCardHTML(l,clientMap[l.clientId],fmt)).join('')}</div>`}`;
}

function loanCardHTML(loan, client, fmt) {
  const pct = loan.amount>0 ? Math.min(100,Math.round(((loan.amount-(loan.balance||loan.amount))/loan.amount)*100)) : 0;
  const statusMap = { active:'badge-warning', paid:'badge-success', overdue:'badge-danger' };
  const badge = statusMap[loan.status]||'badge-muted';
  const isOverdue = loan.status!=='paid' && loan.dueDate && new Date(loan.dueDate)<new Date();
  const preparedInfo = loan.preparedBy ? `<div class="doc-prepared" style="margin-top:4px;">👤 ${loan.preparedBy}${loan.preparedByDept ? ' · ' + loan.preparedByDept : ''}</div>` : '';
  return `
    <div class="loan-card">
      <div class="loan-card-header">
        <div>
          <div class="font-bold">${client?.name||'Unknown Client'}</div>
          <div class="loan-amount-display">${fmt(loan.amount)}</div>
          <div class="loan-paid-display">Balance: ${fmt(loan.balance??loan.amount)}</div>
          ${loan.date?`<div class="text-muted text-xs">Since ${new Date(loan.date).toLocaleDateString('en-GB')}</div>`:''}
          ${isOverdue?'<span class="badge badge-danger mt-4" style="margin-top:4px;">OVERDUE</span>':''}
          ${preparedInfo}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
          <span class="badge ${badge}">${loan.status||'active'}</span>
          <span style="font-size:var(--text-xs);color:var(--text-muted);">${pct}% paid</span>
          <div class="flex gap-8 mt-8" style="margin-top:8px;">
            ${loan.status!=='paid'?`<button class="btn btn-success btn-sm" onclick="openInstallmentModal('${loan.id}')">💰 Pay</button>`:''}
            <button class="btn btn-ghost btn-sm" onclick="deleteLoan('${loan.id}')">🗑</button>
          </div>
        </div>
      </div>
      <div class="loan-progress">
        <div class="progress-bar"><div class="progress-fill ${pct>=100?'success':pct>50?'':'warning'}" style="width:${pct}%"></div></div>
      </div>
      ${loan.description?`<div class="text-muted text-xs mt-8" style="margin-top:8px;">${loan.description}</div>`:''}
    </div>`;
}

async function openLoanModal() {
  const deptId = window.KwezaAuth?.getDeptFilter?.() || null;
  let allClients = await window.KwezaDB.db.clients.toArray();
  if (deptId) allClients = allClients.filter(c => c.departmentId === deptId);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header"><h3>💸 New Loan</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Client <span>*</span></label>
          <select class="form-control" id="ln-client">
            <option value="">— Select Client —</option>
            ${allClients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Amount Loaned <span>*</span></label><input class="form-control" id="ln-amount" type="number" min="0" placeholder="0" /></div>
          <div class="form-group"><label class="form-label">Interest Rate (%)</label><input class="form-control" id="ln-interest" type="number" min="0" value="0" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Date Given</label><input class="form-control" id="ln-date" type="date" value="${new Date().toISOString().split('T')[0]}" /></div>
          <div class="form-group"><label class="form-label">Due Date</label><input class="form-control" id="ln-due" type="date" /></div>
        </div>
        <div class="form-group"><label class="form-label">Description / Purpose</label><textarea class="form-control" id="ln-desc" rows="2" placeholder="What is this loan for?"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveLoan()">+ Add Loan</button>
      </div>
    </div>`;
  modal.classList.add('active');
}

async function saveLoan() {
  const clientId = document.getElementById('ln-client')?.value;
  const amount   = parseFloat(document.getElementById('ln-amount')?.value);
  if(!clientId){showToast('Select a client','error');return;}
  if(!amount||amount<=0){showToast('Enter a valid amount','error');return;}

  const user = window.KwezaAuth?.getCurrentUser?.() || {};

  const data = {
    clientId, amount, balance: amount,
    interestRate: parseFloat(document.getElementById('ln-interest')?.value)||0,
    date:    document.getElementById('ln-date')?.value||new Date().toISOString(),
    dueDate: document.getElementById('ln-due')?.value||null,
    description: document.getElementById('ln-desc')?.value||'',
    status: 'active',
    departmentId:  user.id   || null,
    preparedBy:    user.name || '',
    preparedByDept:user.department || ''
  };
  const { db, logActivity } = window.KwezaDB;
  const id = await db.loans.add(data);
  const client = await db.clients.get(clientId);
  await logActivity('loan', `Loan of MWK ${amount.toLocaleString()} to ${client?.name}`, amount, id, 'loan');
  showToast('Loan recorded!','success');
  closeModal(); renderLoans();
}

function openInstallmentModal(loanId) {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header"><h3>💰 Record Installment</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Amount Received <span>*</span></label><input class="form-control" id="inst-amount" type="number" min="0" placeholder="Enter amount" /></div>
        <div class="form-group"><label class="form-label">Date Received</label><input class="form-control" id="inst-date" type="date" value="${new Date().toISOString().split('T')[0]}" /></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="submitInstallment('${loanId}')">✓ Record</button>
      </div>
    </div>`;
  modal.classList.add('active');
}

async function submitInstallment(loanId) {
  const amount = parseFloat(document.getElementById('inst-amount')?.value);
  const date   = document.getElementById('inst-date')?.value;
  if(!amount||amount<=0){showToast('Enter a valid amount','error');return;}
  const newBal = await window.KwezaDB.recordInstallment(loanId,amount,date);
  showToast(newBal<=0?'Loan fully paid! 🎉':`Payment recorded! Balance: MWK ${newBal.toLocaleString()}`,'success');
  closeModal(); renderLoans();
}

async function deleteLoan(id) {
  if(!confirm('Delete this loan record?'))return;
  await window.KwezaDB.db.loans.delete(id);
  await window.KwezaDB.db.installments.where('loanId').equals(id).delete();
  showToast('Loan deleted','info'); renderLoans();
}

window.KwezaPages=window.KwezaPages||{};
Object.assign(window.KwezaPages,{renderLoans,openLoanModal,saveLoan,openInstallmentModal,submitInstallment,deleteLoan});
