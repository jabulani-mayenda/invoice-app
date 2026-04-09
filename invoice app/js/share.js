/* ============================================
   KWEZA – WHATSAPP & WEB SHARE
   ============================================ */

async function shareViaWhatsApp(docType, docId) {
  const { db, getLineItems, getAllSettings } = window.KwezaDB;
  const settings  = await getAllSettings();
  const isInvoice = docType === 'invoice';
  const doc     = isInvoice ? await db.invoices.get(docId) : await db.quotations.get(docId);
  const client  = await db.clients.get(doc.clientId);
  const currency = doc.currency || settings.defaults.currency || 'MWK';
  const fmt = n => `${currency} ${Number(n).toLocaleString()}`;

  const type = isInvoice ? 'Invoice' : 'Quotation';
  const dateStr = new Date(doc.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  let message = `*${settings.company.name}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📄 *${type}* ${doc.number}\n`;
  message += `📅 Date: ${dateStr}\n`;
  if (isInvoice && doc.dueDate) {
    message += `⏰ Due: ${new Date(doc.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `👤 Client: *${client?.name || 'N/A'}*\n`;

  const lineItems = await getLineItems(docType, docId);
  if (lineItems.length > 0) {
    message += `\n*Services:*\n`;
    lineItems.forEach(item => {
      message += `• ${item.description} — ${fmt(item.amount)}\n`;
    });
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (doc.discount > 0) message += `Discount: ${doc.discount}%\n`;
  if (doc.tax > 0) message += `VAT: ${doc.tax}%\n`;
  message += `💰 *TOTAL: ${fmt(doc.total)}*\n`;

  if (isInvoice) {
    message += `\n💳 Status: ${doc.status?.toUpperCase()}\n`;
  } else if (doc.validityDays) {
    message += `\nValid for: ${doc.validityDays} days\n`;
  }

  if (doc.notes) message += `\n📝 ${doc.notes}\n`;

  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📧 ${settings.company.email}\n`;
  message += `📞 ${settings.company.phone}`;

  // Try phone number from client
  let phoneNumber = '';
  if (client?.phone) {
    phoneNumber = client.phone.replace(/\D/g, '');
    // Malawi prefix
    if (phoneNumber.startsWith('0')) phoneNumber = '265' + phoneNumber.slice(1);
    if (!phoneNumber.startsWith('265') && !phoneNumber.startsWith('+')) phoneNumber = '265' + phoneNumber;
  }

  const encoded = encodeURIComponent(message);
  const url = phoneNumber
    ? `https://wa.me/${phoneNumber}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(url, '_blank');
  showToast('Opening WhatsApp...', 'info');
}

async function shareNative(docType, docId) {
  if (!navigator.share) {
    await shareViaWhatsApp(docType, docId);
    return;
  }
  const { db, getAllSettings } = window.KwezaDB;
  const settings  = await getAllSettings();
  const isInvoice = docType === 'invoice';
  const doc    = isInvoice ? await db.invoices.get(docId) : await db.quotations.get(docId);
  const client = await db.clients.get(doc.clientId);
  const type   = isInvoice ? 'Invoice' : 'Quotation';

  try {
    await navigator.share({
      title: `${type} ${doc.number} – ${settings.company.name}`,
      text: `Please find your ${type.toLowerCase()} ${doc.number} from ${settings.company.name}. Total: ${doc.currency || 'MWK'} ${Number(doc.total).toLocaleString()}`,
    });
  } catch (e) {
    if (e.name !== 'AbortError') await shareViaWhatsApp(docType, docId);
  }
}

window.KwezaShare = { shareViaWhatsApp, shareNative };
