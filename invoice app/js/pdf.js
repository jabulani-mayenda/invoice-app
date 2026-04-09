/* ============================================
   KWEZA – PDF GENERATOR (with preparedBy)
   ============================================ */

async function generatePDF(docType, docId) {
  const { db, getLineItems, getAllSettings } = window.KwezaDB;
  const doc = await db[docType + 's'].get(docId);
  if (!doc) return;
  const client = await db.clients.get(doc.clientId);
  const items = await getLineItems(docType, docId);
  const settings = await getAllSettings();

  const container = document.createElement('div');
  container.className = 'pdf-container';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const currency = doc.currency || settings.defaults.currency || 'MWK';
  const fmt = n => `${currency} ${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2})}`;
  const totalDisc = items.reduce((s,i)=>s+((i.rate||0)*(i.qty||1)*(i.discount||0)/100),0) + (doc.subtotal*(doc.discount||0)/100);
  const isInvoice = docType === 'invoice';

  container.innerHTML = `
    <div style="width: 800px; padding: 50px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; box-sizing: border-box; line-height: 1.5;">
      <!-- Header -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
        <tr>
          <td style="vertical-align: top; width: 60%;">
            ${settings.branding.logo ? `<img src="${settings.branding.logo}" style="max-height: 80px; max-width: 250px; margin-bottom: 15px;" />` : `<div style="font-size: 32px; font-weight: bold; color: ${settings.branding.primaryColor||'#1565C0'}; margin-bottom: 15px;">${settings.company.name}</div>`}
            <div style="font-size: 13px; color: #666;">
              ${settings.company.tagline ? `<strong>${settings.company.tagline}</strong><br>` : ''}
              ${settings.company.address ? settings.company.address.replace(/\n/g,'<br>') + '<br>' : ''}
              ${settings.company.phone ? `Tel: ${settings.company.phone}<br>` : ''}
              ${settings.company.phone2 ? `Tel 2: ${settings.company.phone2}<br>` : ''}
              ${settings.company.email ? `Email: ${settings.company.email}<br>` : ''}
            </div>
          </td>
          <td style="vertical-align: top; text-align: right; width: 40%;">
            <div style="font-size: 36px; font-weight: 800; color: #111; letter-spacing: 1px; text-transform: uppercase;">
              ${isInvoice ? 'INVOICE' : 'QUOTATION'}
            </div>
            <div style="font-size: 14px; color: #555; margin-top: 10px;">
              <strong>Number:</strong> ${doc.number}<br>
              <strong>Date:</strong> ${new Date(doc.date).toLocaleDateString('en-GB')}<br>
              ${isInvoice && doc.dueDate ? `<strong>Due Date:</strong> ${new Date(doc.dueDate).toLocaleDateString('en-GB')}<br>` : ''}
              ${!isInvoice && doc.validityDays ? `<strong>Valid Until:</strong> ${new Date(new Date(doc.date).getTime() + doc.validityDays*24*60*60*1000).toLocaleDateString('en-GB')}<br>` : ''}
            </div>
          </td>
        </tr>
      </table>

      <!-- Client Info -->
      <div style="margin-bottom: 40px; padding-top: 20px; border-top: 2px solid #eee;">
        <div style="font-size: 12px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 8px;">Billed To</div>
        <div style="font-size: 16px; font-weight: bold; color: #111;">${client?.name || '—'}</div>
        ${client?.company ? `<div style="font-size: 14px; color: #444; margin-top: 3px;">${client.company}</div>` : ''}
        <div style="font-size: 13px; color: #555; margin-top: 5px;">
          ${client?.address ? client.address.replace(/\n/g,'<br>') + '<br>' : ''}
          ${client?.phone ? `Tel: ${client.phone}<br>` : ''}
          ${client?.email ? `${client.email}` : ''}
        </div>
      </div>

      <!-- Line Items -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #f8f9fa; border-bottom: 2px solid #ddd;">
            <th style="padding: 12px; text-align: left; font-size: 12px; color: #555; text-transform: uppercase;">Description</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; color: #555; text-transform: uppercase;">Rate</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; color: #555; text-transform: uppercase;">Qty</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; color: #555; text-transform: uppercase;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px; font-size: 14px; color: #222;">${item.description}</td>
              <td style="padding: 12px; text-align: right; font-size: 14px; color: #444;">${fmt(item.rate)}</td>
              <td style="padding: 12px; text-align: center; font-size: 14px; color: #444;">${item.qty} ${item.discount>0 ? `<span style="font-size:11px;color:#888;"><br>(-${item.discount}%)</span>` : ''}</td>
              <td style="padding: 12px; text-align: right; font-size: 14px; color: #111; font-weight: 500;">${fmt((item.rate||0)*(item.qty||1)*(1-(item.discount||0)/100))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Totals Area -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 50px;">
        <tr>
          <!-- Notes & Payment Info -->
          <td style="vertical-align: top; width: 60%; padding-right: 30px;">
            <div style="font-size: 13px; color: #555; background: #fdfdfd; padding: 15px; border-radius: 4px; border: 1px solid #eee; min-height: 100px;">
              <div style="font-weight: bold; font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 6px;">Notes / Terms</div>
              ${(doc.notes || '').replace(/\n/g, '<br>')}
              ${isInvoice ? `
                <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                  <div style="font-weight: bold; font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 6px;">Payment Details</div>
                  Bank: <strong>${settings.defaults.bankName || '—'}</strong><br>
                  Account: <strong>${settings.defaults.bankAccount || '—'}</strong><br>
                  Branch: <strong>${settings.defaults.bankBranch || '—'}</strong>
                </div>
              ` : ''}
              
              <!-- Authenticity Stamp -->
              ${doc.preparedBy ? `
                <div style="margin-top:20px; font-size:11px; color:#666; border-top:1px dashed #ccc; padding-top:8px;">
                  ${settings.branding.signature ? `<img src="${settings.branding.signature}" style="max-height: 40px; margin-bottom: 5px; display: block;" />` : ''}
                  Prepared by: <strong>${doc.preparedBy}</strong> ${doc.preparedByDept ? `(${doc.preparedByDept})` : ''}
                </div>
              ` : ''}

            </div>
          </td>
          <!-- Calculations -->
          <td style="vertical-align: top; width: 40%;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: #555;">Subtotal:</td>
                <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #111;">${fmt(doc.subtotal)}</td>
              </tr>
              ${totalDisc > 0 ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: #555;">Total Discount:</td>
                <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #D32F2F;">-${fmt(totalDisc)}</td>
              </tr>
              ` : ''}
              ${doc.tax > 0 ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: #555;">VAT (${doc.tax}%):</td>
                <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #111;">+${fmt((doc.subtotal - doc.subtotal*(doc.discount||0)/100)*doc.tax/100)}</td>
              </tr>
              ` : ''}
              <tr>
                <td colspan="2" style="padding: 15px 0 0 0;">
                  <div style="background: ${settings.branding.primaryColor||'#1565C0'}; color: white; padding: 12px 15px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 18px; font-weight: bold;">
                    <span>Total:</span>
                    <span>${fmt(doc.total)}</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Footer -->
      <div style="text-align: center; font-size: 12px; color: #999; margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px;">
        Generated by Kweza Invoice System
      </div>
    </div>
  `;

  const originalMaxWidth = document.body.style.maxWidth;
  const originalOverflowX = document.body.style.overflowX;
  document.body.style.maxWidth = 'none';
  document.body.style.overflowX = 'visible';

  try {
    const canvas = await html2canvas(container.firstElementChild, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jspdf.jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${isInvoice?'Invoice':'Quotation'}_${doc.number}_${client?.name.replace(/\s+/g,'_')}.pdf`);
  } catch (err) {
    console.error('PDF generation error:', err);
    window.showToast?.('Error generating PDF', 'error');
  } finally {
    document.body.style.maxWidth = originalMaxWidth;
    document.body.style.overflowX = originalOverflowX;
    document.body.removeChild(container);
  }
}

async function printDocument(docType, docId) {
  // Use same logic as PDF generation, just open in window.print
  // For simplicity, generate the HTML and put it in an iframe.
  const { db, getLineItems, getAllSettings } = window.KwezaDB;
  const doc = await db[docType + 's'].get(docId);
  if (!doc) return;
  const client = await db.clients.get(doc.clientId);
  const items = await getLineItems(docType, docId);
  const settings = await getAllSettings();

  const currency = doc.currency || settings.defaults.currency || 'MWK';
  const fmt = n => `${currency} ${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2})}`;
  const totalDisc = items.reduce((s,i)=>s+((i.rate||0)*(i.qty||1)*(i.discount||0)/100),0) + (doc.subtotal*(doc.discount||0)/100);
  const isInvoice = docType === 'invoice';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${isInvoice?'Invoice':'Quotation'} ${doc.number}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.5; padding: 20px; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .table th { background: #f8f9fa; border-bottom: 2px solid #ddd; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
        .table td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
        .text-right { text-align: right !important; }
        .text-center { text-align: center !important; }
        @media print { margin: 0; padding: 0; }
      </style>
    </head>
    <body onload="window.print(); setTimeout(()=>window.close(), 500);">
      <table style="width: 100%; margin-bottom: 40px;">
        <tr>
          <td style="width: 60%; vertical-align: top;">
            ${settings.branding.logo ? `<img src="${settings.branding.logo}" style="max-height: 80px; max-width: 250px; margin-bottom: 15px;" />` : `<div style="font-size: 28px; font-weight: bold; color: ${settings.branding.primaryColor||'#1565C0'}; margin-bottom: 15px;">${settings.company.name}</div>`}
            <div style="font-size: 12px; color: #666;">
              ${settings.company.address ? settings.company.address.replace(/\n/g,'<br>') + '<br>' : ''}
              ${settings.company.phone ? `${settings.company.phone}<br>` : ''}
              ${settings.company.email ? `${settings.company.email}` : ''}
            </div>
          </td>
          <td style="width: 40%; text-align: right; vertical-align: top;">
            <div style="font-size: 32px; font-weight: bold; text-transform: uppercase; color: #111;">${isInvoice ? 'INVOICE' : 'QUOTATION'}</div>
            <div style="font-size: 13px; color: #555; margin-top: 10px;">
              <strong># ${doc.number}</strong><br>
              Date: ${new Date(doc.date).toLocaleDateString('en-GB')}<br>
              ${isInvoice && doc.dueDate ? `Due date: ${new Date(doc.dueDate).toLocaleDateString('en-GB')}` : ''}
            </div>
          </td>
        </tr>
      </table>

      <div style="margin-bottom: 30px;">
        <div style="font-size: 11px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 5px;">Billed To:</div>
        <div style="font-size: 15px; font-weight: bold;">${client?.name}</div>
        ${client?.company ? `<div style="font-size: 13px;">${client.company}</div>` : ''}
        ${client?.address ? `<div style="font-size: 13px; color: #555;">${client.address.replace(/\n/g,'<br>')}</div>` : ''}
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Rate</th>
            <th class="text-center">Qty</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.description}</td>
              <td class="text-right">${fmt(item.rate)}</td>
              <td class="text-center">${item.qty} ${item.discount>0 ? `(-${item.discount}%)` : ''}</td>
              <td class="text-right"><strong>${fmt((item.rate||0)*(item.qty||1)*(1-(item.discount||0)/100))}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <table style="width: 100%;">
        <tr>
          <td style="width: 60%; vertical-align: top; padding-right: 30px;">
            <div style="font-size: 12px; color: #555;">
              <strong>Notes:</strong><br>
              ${(doc.notes || '').replace(/\n/g, '<br>')}
              ${isInvoice ? `
              <br><br><strong>Bank Details:</strong><br>
              ${settings.defaults.bankName} - ${settings.defaults.bankAccount} (${settings.defaults.bankBranch})
              ` : ''}
            </div>
            ${doc.preparedBy ? `
              <div style="margin-top:20px; font-size:11px; color:#666; border-top:1px dashed #ccc; padding-top:8px;">
                ${settings.branding.signature ? `<img src="${settings.branding.signature}" style="max-height: 40px; margin-bottom: 5px; display: block;" />` : ''}
                Prepared by: <strong>${doc.preparedBy}</strong> ${doc.preparedByDept ? `(${doc.preparedByDept})` : ''}
              </div>
            ` : ''}
          </td>
          <td style="width: 40%; vertical-align: top;">
            <table style="width: 100%;">
              <tr><td style="padding: 5px 0;">Subtotal:</td><td class="text-right">${fmt(doc.subtotal)}</td></tr>
              ${totalDisc>0 ? `<tr><td style="padding: 5px 0;">Discount:</td><td class="text-right" style="color:red;">-${fmt(totalDisc)}</td></tr>` : ''}
              ${doc.tax>0 ? `<tr><td style="padding: 5px 0;">VAT (${doc.tax}%):</td><td class="text-right">+${fmt((doc.subtotal - doc.subtotal*(doc.discount||0)/100)*doc.tax/100)}</td></tr>` : ''}
              <tr>
                <td colspan="2" style="padding-top: 10px;">
                  <div style="background: #eee; padding: 10px; font-size: 16px; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>Total:</span><span>${fmt(doc.total)}</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  const printWin = window.open('', '_blank');
  printWin.document.write(html);
  printWin.document.close();
}

window.KwezaPDF = { generatePDF, printDocument };
