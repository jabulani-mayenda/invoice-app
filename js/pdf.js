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

  const primary = settings.branding.primaryColor || '#1565C0';
  const tableHeaderBg = primary;
  const tableHeaderColor = '#ffffff';

  container.innerHTML = `
    <div style="width: 800px; padding: 0; background: #ffffff; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; box-sizing: border-box; line-height: 1.6; position: relative;">
      
      <!-- Top Accent Bar -->
      <div style="height: 12px; width: 100%; background: ${primary};"></div>

      <div style="padding: 40px 50px;">
        <!-- Header -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <tr>
            <td style="vertical-align: top; width: 50%;">
              ${settings.branding.logo ? `<img src="${settings.branding.logo}" style="max-height: 90px; max-width: 250px; object-fit: contain; margin-bottom: 10px;" />` : `<div style="font-size: 32px; font-weight: 800; color: ${primary}; margin-bottom: 10px; letter-spacing: -0.5px;">${settings.company.name}</div>`}
              <div style="font-size: 13px; color: #555;">
                ${settings.company.tagline ? `<strong style="color: ${primary};">${settings.company.tagline}</strong><br>` : ''}
                ${settings.company.address ? settings.company.address.replace(/\n/g,'<br>') + '<br>' : ''}
                ${settings.company.phone ? `Tel: ${settings.company.phone}<br>` : ''}
                ${settings.company.email ? `Email: ${settings.company.email}` : ''}
              </div>
            </td>
            <td style="vertical-align: top; text-align: right; width: 50%;">
              <div style="font-size: 42px; font-weight: 900; color: ${primary}; letter-spacing: 1px; text-transform: uppercase; line-height: 1.1; margin-bottom: 15px;">
                ${isInvoice ? 'INVOICE' : 'QUOTATION'}
              </div>
              <div style="display: inline-block; text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px;">
                <table style="width: 100%; text-align: right; border-collapse: collapse;">
                  <tr><td style="padding: 3px 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; padding-right: 20px;">Number</td><td style="padding: 3px 0; font-weight: 800; color: #1a202c; font-size: 14px;">${doc.number}</td></tr>
                  <tr><td style="padding: 3px 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; padding-right: 20px;">Date</td><td style="padding: 3px 0; font-weight: 600; color: #2d3748; font-size: 14px;">${new Date(doc.date).toLocaleDateString('en-GB')}</td></tr>
                  ${isInvoice && doc.dueDate ? `<tr><td style="padding: 3px 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; padding-right: 20px;">Due Date</td><td style="padding: 3px 0; color: #e53e3e; font-weight: 700; font-size: 14px;">${new Date(doc.dueDate).toLocaleDateString('en-GB')}</td></tr>` : ''}
                  ${!isInvoice && doc.validityDays ? `<tr><td style="padding: 3px 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; padding-right: 20px;">Valid Until</td><td style="padding: 3px 0; color: #2d3748; font-weight: 600; font-size: 14px;">${new Date(new Date(doc.date).getTime() + doc.validityDays*24*60*60*1000).toLocaleDateString('en-GB')}</td></tr>` : ''}
                </table>
              </div>
            </td>
          </tr>
        </table>

        <!-- Client Info Block -->
        <div style="background: #f8fafc; border-left: 4px solid ${primary}; padding: 20px; border-radius: 4px; margin-bottom: 35px;">
          <div style="font-size: 11px; font-weight: 800; color: ${primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Billed To</div>
          <div style="font-size: 18px; font-weight: 800; color: #1a202c;">${client?.name || '—'}</div>
          ${client?.company ? `<div style="font-size: 14px; font-weight: 600; color: #4a5568; margin-top: 2px;">${client.company}</div>` : ''}
          <div style="font-size: 13px; color: #4a5568; margin-top: 8px; display: flex; gap: 30px; flex-wrap: wrap;">
            ${client?.address ? `<div><strong style="color:#718096">Address:</strong><br>${client.address.replace(/\n/g,'<br>')}</div>` : ''}
            <div>
              ${client?.phone ? `<strong style="color:#718096">Tel:</strong> ${client.phone}<br>` : ''}
              ${client?.email ? `<strong style="color:#718096">Email:</strong> ${client.email}` : ''}
            </div>
          </div>
        </div>

        <!-- Line Items Table -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr>
              <th style="background: ${tableHeaderBg}; color: ${tableHeaderColor}; padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
              <th style="background: ${tableHeaderBg}; color: ${tableHeaderColor}; padding: 14px 16px; text-align: right; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Rate</th>
              <th style="background: ${tableHeaderBg}; color: ${tableHeaderColor}; padding: 14px 16px; text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
              <th style="background: ${tableHeaderBg}; color: ${tableHeaderColor}; padding: 14px 16px; text-align: right; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 14px 16px; font-size: 14px; color: #2d3748; border-bottom: 1px solid #e2e8f0;">${item.description}</td>
                <td style="padding: 14px 16px; text-align: right; font-size: 14px; color: #4a5568; border-bottom: 1px solid #e2e8f0;">${fmt(item.rate)}</td>
                <td style="padding: 14px 16px; text-align: center; font-size: 14px; color: #4a5568; border-bottom: 1px solid #e2e8f0;">${item.qty} ${item.discount>0 ? `<span style="font-size:11px;color:#e53e3e;font-weight:600;"><br>(-${item.discount}%)</span>` : ''}</td>
                <td style="padding: 14px 16px; text-align: right; font-size: 14px; color: #1a202c; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${fmt((item.rate||0)*(item.qty||1)*(1-(item.discount||0)/100))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Bottom Layout: Notes/Terms/Bank vs Totals -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <tr>
            <!-- Left Side: Notes & Bank -->
            <td style="vertical-align: top; width: 55%; padding-right: 30px;">
              ${doc.notes ? `
                <div style="margin-bottom: 20px;">
                  <div style="font-size: 12px; font-weight: 800; color: ${primary}; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Notes & Terms</div>
                  <div style="font-size: 13px; color: #4a5568; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    ${doc.notes.replace(/\n/g, '<br>')}
                  </div>
                </div>
              ` : ''}

              ${isInvoice ? `
                <div style="margin-bottom: 20px;">
                  <div style="font-size: 12px; font-weight: 800; color: ${primary}; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Payment Details</div>
                  <div style="font-size: 13px; color: #4a5568; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <table style="border-collapse: collapse; width: 100%;">
                      <tr><td style="padding: 2px 0; color:#718096; width: 70px;">Bank:</td><td style="padding: 2px 0; font-weight: 600; color: #1a202c;">${settings.defaults.bankName || '—'}</td></tr>
                      <tr><td style="padding: 2px 0; color:#718096;">Account:</td><td style="padding: 2px 0; font-weight: 700; color: #1a202c;">${settings.defaults.bankAccount || '—'}</td></tr>
                      <tr><td style="padding: 2px 0; color:#718096;">Branch:</td><td style="padding: 2px 0; font-weight: 600; color: #1a202c;">${settings.defaults.bankBranch || '—'}</td></tr>
                    </table>
                  </div>
                </div>
              ` : ''}
              
              <!-- Signature Area -->
              ${doc.preparedBy ? `
                <div style="margin-top: 30px;">
                  <div style="font-size: 12px; font-weight: 800; color: ${primary}; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">Authorized By</div>
                  ${settings.branding.signature ? `<img src="${settings.branding.signature}" style="max-height: 60px; margin-bottom: 5px; display: block;" />` : '<div style="height:40px;"></div>'}
                  <div style="font-size: 14px; font-weight: 700; color: #1a202c; border-top: 2px solid #e2e8f0; width: 220px; padding-top: 8px;">
                    ${doc.preparedBy} <span style="color:#718096; font-weight:400; font-size: 12px;">${doc.preparedByDept ? `(${doc.preparedByDept})` : ''}</span>
                  </div>
                </div>
              ` : ''}
            </td>

            <!-- Right Side: Calculations -->
            <td style="vertical-align: top; width: 45%;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #4a5568; font-weight: 600;">Subtotal</td>
                    <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #1a202c; font-weight: 700;">${fmt(doc.subtotal)}</td>
                  </tr>
                  ${totalDisc > 0 ? `
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #4a5568; font-weight: 600;">Discount</td>
                    <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #e53e3e; font-weight: 700;">-${fmt(totalDisc)}</td>
                  </tr>
                  ` : ''}
                  ${doc.tax > 0 ? `
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #4a5568; font-weight: 600;">VAT (${doc.tax}%)</td>
                    <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #1a202c; font-weight: 700;">+${fmt((doc.subtotal - doc.subtotal*(doc.discount||0)/100)*doc.tax/100)}</td>
                  </tr>
                  ` : ''}
                </table>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #cbd5e0; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 18px; font-weight: 800; color: #1a202c;">Total</span>
                  <span style="font-size: 24px; font-weight: 900; color: ${primary};">${fmt(doc.total)}</span>
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <div style="text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px;">
          Generated by <strong>Kweza Financial Solutions</strong> System
        </div>
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

  const primary = settings.branding.primaryColor || '#1565C0';
  const tableHeaderBg = primary;
  const tableHeaderColor = '#ffffff';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${isInvoice?'Invoice':'Quotation'} ${doc.number}</title>
      <style>
        body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 0; margin: 0; background: #ffffff; }
        .wrapper { padding: 40px 50px; box-sizing: border-box; }
        .top-accent { height: 12px; width: 100%; background: ${primary}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .table th { background: ${tableHeaderBg}; color: ${tableHeaderColor}; padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .table td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .text-right { text-align: right !important; }
        .text-center { text-align: center !important; }
        @media print { margin: 0; padding: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      </style>
    </head>
    <body onload="setTimeout(()=>window.print(), 500); setTimeout(()=>window.close(), 1000);">
      <div class="top-accent"></div>
      <div class="wrapper">
        <!-- Header -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <tr>
            <td style="vertical-align: top; width: 50%;">
              ${settings.branding.logo ? `<img src="${settings.branding.logo}" style="max-height: 90px; max-width: 250px; object-fit: contain; margin-bottom: 10px;" />` : `<div style="font-size: 32px; font-weight: 800; color: ${primary}; margin-bottom: 10px; letter-spacing: -0.5px;">${settings.company.name}</div>`}
              <div style="font-size: 13px; color: #555;">
                ${settings.company.tagline ? `<strong style="color: ${primary};">${settings.company.tagline}</strong><br>` : ''}
                ${settings.company.address ? settings.company.address.replace(/\n/g,'<br>') + '<br>' : ''}
                ${settings.company.phone ? `Tel: ${settings.company.phone}<br>` : ''}
                ${settings.company.email ? `Email: ${settings.company.email}` : ''}
              </div>
            </td>
            <td style="vertical-align: top; text-align: right; width: 50%;">
              <div style="font-size: 42px; font-weight: 900; color: ${primary}; letter-spacing: 1px; text-transform: uppercase; line-height: 1.1; margin-bottom: 15px;">
                ${isInvoice ? 'INVOICE' : 'QUOTATION'}
              </div>
              <div style="display: inline-block; text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px;">
                <table style="width: 100%; text-align: right; border-collapse: collapse;">
                  <tr><td style="padding: 3px 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; padding-right: 20px;">Number</td><td style="padding: 3px 0; font-weight: 800; color: #1a202c; font-size: 14px;">${doc.number}</td></tr>
                  <tr><td style="padding: 3px 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; padding-right: 20px;">Date</td><td style="padding: 3px 0; font-weight: 600; color: #2d3748; font-size: 14px;">${new Date(doc.date).toLocaleDateString('en-GB')}</td></tr>
                  ${isInvoice && doc.dueDate ? `<tr><td style="padding: 3px 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; padding-right: 20px;">Due Date</td><td style="padding: 3px 0; color: #e53e3e; font-weight: 700; font-size: 14px;">${new Date(doc.dueDate).toLocaleDateString('en-GB')}</td></tr>` : ''}
                  ${!isInvoice && doc.validityDays ? `<tr><td style="padding: 3px 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; padding-right: 20px;">Valid Until</td><td style="padding: 3px 0; color: #2d3748; font-weight: 600; font-size: 14px;">${new Date(new Date(doc.date).getTime() + doc.validityDays*24*60*60*1000).toLocaleDateString('en-GB')}</td></tr>` : ''}
                </table>
              </div>
            </td>
          </tr>
        </table>

        <!-- Client Info Block -->
        <div style="background: #f8fafc; border-left: 4px solid ${primary}; padding: 20px; border-radius: 4px; margin-bottom: 35px;">
          <div style="font-size: 11px; font-weight: 800; color: ${primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Billed To</div>
          <div style="font-size: 18px; font-weight: 800; color: #1a202c;">${client?.name || '—'}</div>
          ${client?.company ? `<div style="font-size: 14px; font-weight: 600; color: #4a5568; margin-top: 2px;">${client.company}</div>` : ''}
          <div style="font-size: 13px; color: #4a5568; margin-top: 8px; display: flex; gap: 30px; flex-wrap: wrap;">
            ${client?.address ? `<div><strong style="color:#718096">Address:</strong><br>${client.address.replace(/\n/g,'<br>')}</div>` : ''}
            <div>
              ${client?.phone ? `<strong style="color:#718096">Tel:</strong> ${client.phone}<br>` : ''}
              ${client?.email ? `<strong style="color:#718096">Email:</strong> ${client.email}` : ''}
            </div>
          </div>
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
            ${items.map((item, index) => `
              <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="color: #2d3748;">${item.description}</td>
                <td class="text-right" style="color: #4a5568;">${fmt(item.rate)}</td>
                <td class="text-center" style="color: #4a5568;">${item.qty} ${item.discount>0 ? `(-${item.discount}%)` : ''}</td>
                <td class="text-right" style="color: #1a202c; font-weight: 600;">${fmt((item.rate||0)*(item.qty||1)*(1-(item.discount||0)/100))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Bottom Layout -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <tr>
            <td style="vertical-align: top; width: 55%; padding-right: 30px;">
              ${doc.notes ? `
                <div style="margin-bottom: 20px;">
                  <div style="font-size: 12px; font-weight: 800; color: ${primary}; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Notes & Terms</div>
                  <div style="font-size: 13px; color: #4a5568; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    ${doc.notes.replace(/\n/g, '<br>')}
                  </div>
                </div>
              ` : ''}

              ${isInvoice ? `
                <div style="margin-bottom: 20px;">
                  <div style="font-size: 12px; font-weight: 800; color: ${primary}; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Payment Details</div>
                  <div style="font-size: 13px; color: #4a5568; background: #f8fafc; padding: 14px 16px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <table style="border-collapse: collapse; width: 100%;">
                      <tr><td style="padding: 2px 0; color:#718096; width: 70px;">Bank:</td><td style="padding: 2px 0; font-weight: 600; color: #1a202c;">${settings.defaults.bankName || '—'}</td></tr>
                      <tr><td style="padding: 2px 0; color:#718096;">Account:</td><td style="padding: 2px 0; font-weight: 700; color: #1a202c;">${settings.defaults.bankAccount || '—'}</td></tr>
                      <tr><td style="padding: 2px 0; color:#718096;">Branch:</td><td style="padding: 2px 0; font-weight: 600; color: #1a202c;">${settings.defaults.bankBranch || '—'}</td></tr>
                    </table>
                  </div>
                </div>
              ` : ''}
              
              <!-- Signature Area -->
              ${doc.preparedBy ? `
                <div style="margin-top: 30px;">
                  <div style="font-size: 12px; font-weight: 800; color: ${primary}; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">Authorized By</div>
                  ${settings.branding.signature ? `<img src="${settings.branding.signature}" style="max-height: 60px; margin-bottom: 5px; display: block;" />` : '<div style="height:40px;"></div>'}
                  <div style="font-size: 14px; font-weight: 700; color: #1a202c; border-top: 2px solid #e2e8f0; width: 220px; padding-top: 8px;">
                    ${doc.preparedBy} <span style="color:#718096; font-weight:400; font-size: 12px;">${doc.preparedByDept ? `(${doc.preparedByDept})` : ''}</span>
                  </div>
                </div>
              ` : ''}
            </td>
            <td style="vertical-align: top; width: 45%;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #4a5568; font-weight: 600;">Subtotal</td>
                    <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #1a202c; font-weight: 700;">${fmt(doc.subtotal)}</td>
                  </tr>
                  ${totalDisc > 0 ? `
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #4a5568; font-weight: 600;">Discount</td>
                    <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #e53e3e; font-weight: 700;">-${fmt(totalDisc)}</td>
                  </tr>
                  ` : ''}
                  ${doc.tax > 0 ? `
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #4a5568; font-weight: 600;">VAT (${doc.tax}%)</td>
                    <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #1a202c; font-weight: 700;">+${fmt((doc.subtotal - doc.subtotal*(doc.discount||0)/100)*doc.tax/100)}</td>
                  </tr>
                  ` : ''}
                </table>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #cbd5e0; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 18px; font-weight: 800; color: #1a202c;">Total</span>
                  <span style="font-size: 24px; font-weight: 900; color: ${primary};">${fmt(doc.total)}</span>
                </div>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <div style="text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px;">
          Generated by <strong>Kweza Financial Solutions</strong> System
        </div>
      </div>
    </body>
    </html>
  `;
  const printWin = window.open('', '_blank');
  printWin.document.write(html);
  printWin.document.close();
}

window.KwezaPDF = { generatePDF, printDocument };
