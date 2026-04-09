/* ============================================
   KWEZA – REPORTS PAGE
   ============================================ */

async function renderReports() {
  document.getElementById('reports-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Reports</h2>
        <p>Export full data reports</p>
      </div>
    </div>
    <div class="card" style="max-width:500px">
      <div class="form-group">
        <label class="form-label">Report Type</label>
        <select class="form-control" id="report-type">
          <option value="invoices">Invoices</option>
          <option value="quotations">Quotations</option>
          <option value="clients">Clients</option>
          <option value="payments">Payments</option>
          <option value="loans">Loans</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="window.KwezaPages.downloadReport()" style="margin-top: 10px;">⬇️ Download Full Report</button>
    </div>
  `;
}

async function downloadReport() {
  const type = document.getElementById('report-type').value;
  const { db } = window.KwezaDB;
  let records = [];
  
  if (type === 'invoices') records = await db.invoices.toArray();
  else if (type === 'quotations') records = await db.quotations.toArray();
  else if (type === 'clients') records = await db.clients.toArray();
  else if (type === 'payments') records = await db.payments.toArray();
  else if (type === 'loans') records = await db.loans.toArray();

  if (records.length === 0) {
    window.showToast('No records found for this report.', 'error');
    return;
  }

  // Convert to CSV
  const keys = Object.keys(records[0]).filter(k => typeof records[0][k] !== 'object');
  const csvRows = [];
  csvRows.push(keys.join(',')); // Header
  
  for (const row of records) {
    const values = keys.map(k => {
      const val = row[k];
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kweza_${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.showToast('Report downloaded!', 'success');
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderReports, downloadReport });
