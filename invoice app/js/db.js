/* ============================================
   KWEZA – DATABASE (Dexie.js / IndexedDB)
   ============================================ */

const db = new Dexie('KwezaInvoiceDB');

/* version 2 – kept for smooth migration */
db.version(2).stores({
  clients:      '++id, name, phone, email, company, address, createdAt',
  catalog:      '++id, name, category, price, description, unit',
  quotations:   '++id, clientId, number, date, validityDays, status, subtotal, discount, tax, total, currency, notes',
  invoices:     '++id, quotationId, clientId, number, date, dueDate, status, subtotal, discount, tax, total, currency, notes',
  lineItems:    '++id, docType, docId, description, rate, qty, discount, amount, catalogId',
  payments:     '++id, invoiceId, date, amount, method, notes',
  loans:        '++id, clientId, amount, balance, date, dueDate, status, description, interestRate',
  installments: '++id, loanId, dueDate, amount, paid, paidDate',
  settings:     'key',
  activity:     '++id, type, description, amount, date, refId, refType'
});

/* version 3 – department accounts + per-department data isolation */
db.version(3).stores({
  clients:      '++id, name, phone, email, company, address, createdAt, departmentId',
  quotations:   '++id, clientId, number, date, validityDays, status, subtotal, discount, tax, total, currency, notes, departmentId',
  invoices:     '++id, quotationId, clientId, number, date, dueDate, status, subtotal, discount, tax, total, currency, notes, departmentId',
  loans:        '++id, clientId, amount, balance, date, dueDate, status, description, interestRate, departmentId',
  users:        'id, name, department, role'
});

/* ── Default Settings ── */
const DEFAULT_SETTINGS = {
  company: {
    name: 'Kweza Financial Solutions Ltd',
    tagline: 'Kweza Developers',
    email: 'kwezafinancialsolutions@gmail.com',
    phone: '+265 (0) 983501964',
    phone2: '+265 (0) 893624209',
    address: '',
    website: ''
  },
  branding: {
    logo: null,
    primaryColor: '#1565C0',
    invoicePrefix: 'KFS',
    quotePrefix: 'KFS-Q',
    nextInvoiceNumber: 1,
    nextQuoteNumber: 1
  },
  defaults: {
    currency: 'MWK',
    vatRate: 16.5,
    validityDays: 14,
    paymentTerms: 'Net 30',
    invoiceNotes: 'Thank you for your business!',
    bankName: '',
    bankAccount: '',
    bankBranch: ''
  }
};

/* ── Settings Helpers ── */
async function getSetting(key) {
  const row = await db.settings.get(key);
  return row ? row.value : null;
}
async function setSetting(key, value) {
  await db.settings.put({ key, value });
}
async function getAllSettings() {
  const rows = await db.settings.toArray();
  const result = { ...DEFAULT_SETTINGS };
  rows.forEach(r => {
    const [section, field] = r.key.split('.');
    if (result[section]) result[section][field] = r.value;
  });
  // Also handle full-section saves
  const company  = await getSetting('company');
  const branding = await getSetting('branding');
  const defaults = await getSetting('defaults');
  if (company)  result.company  = { ...result.company,  ...company };
  if (branding) result.branding = { ...result.branding, ...branding };
  if (defaults) result.defaults = { ...result.defaults, ...defaults };
  return result;
}

/* ── Number Generation ── */
async function getNextQuoteNumber() {
  const branding = await getSetting('branding') || DEFAULT_SETTINGS.branding;
  const num = branding.nextQuoteNumber || 1;
  const prefix = branding.quotePrefix || 'KFS-Q';
  return `${prefix}-${String(num).padStart(3, '0')}`;
}
async function getNextInvoiceNumber() {
  const branding = await getSetting('branding') || DEFAULT_SETTINGS.branding;
  const num = branding.nextInvoiceNumber || 1;
  const prefix = branding.invoicePrefix || 'KFS';
  return `${prefix}-${String(num).padStart(3, '0')}`;
}
async function incrementQuoteNumber() {
  const branding = await getSetting('branding') || { ...DEFAULT_SETTINGS.branding };
  branding.nextQuoteNumber = (branding.nextQuoteNumber || 1) + 1;
  await setSetting('branding', branding);
}
async function incrementInvoiceNumber() {
  const branding = await getSetting('branding') || { ...DEFAULT_SETTINGS.branding };
  branding.nextInvoiceNumber = (branding.nextInvoiceNumber || 1) + 1;
  await setSetting('branding', branding);
}

/* ── Activity Log ── */
async function logActivity(type, description, amount = 0, refId = null, refType = null) {
  await db.activity.add({ type, description, amount, date: new Date().toISOString(), refId, refType });
  // Keep last 100 entries
  const count = await db.activity.count();
  if (count > 100) {
    const oldest = await db.activity.orderBy('id').first();
    if (oldest) await db.activity.delete(oldest.id);
  }
}

/* ── Dashboard Stats ── */
async function getDashboardStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const [clients, invoices, quotations, loans] = await Promise.all([
    db.clients.count(),
    db.invoices.toArray(),
    db.quotations.toArray(),
    db.loans.toArray()
  ]);

  const monthInvoices = invoices.filter(i => i.date >= monthStart && i.date <= monthEnd);
  const monthRevenue  = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const outstanding   = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const totalRevenue  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const overdueLoan   = loans.filter(l => l.status === 'overdue' || (l.dueDate && l.dueDate < now.toISOString() && l.status !== 'paid')).length;
  const pendingQuotes = quotations.filter(q => q.status === 'pending').length;

  return { clients, monthRevenue, outstanding, totalRevenue, overdueLoan, pendingQuotes, totalInvoices: invoices.length };
}

/* ── Monthly Revenue (last 6 months) ── */
async function getMonthlyRevenue() {
  const invoices = await db.invoices.where('status').equals('paid').toArray();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const total = invoices.filter(inv => inv.date >= start && inv.date <= end).reduce((s, inv) => s + (inv.total || 0), 0);
    months.push({ label, total });
  }
  return months;
}

/* ── Client with stats ── */
async function getClientWithStats(clientId) {
  const [client, clientInvoices, clientLoans] = await Promise.all([
    db.clients.get(clientId),
    db.invoices.where('clientId').equals(clientId).toArray(),
    db.loans.where('clientId').equals(clientId).toArray()
  ]);
  const totalBilled     = clientInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid       = clientInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const outstandingLoan = clientLoans.reduce((s, l) => s + (l.balance || 0), 0);
  return { ...client, totalBilled, totalPaid, outstandingLoan, invoiceCount: clientInvoices.length };
}

/* ── Line Items Helpers ── */
async function saveLineItems(docType, docId, items) {
  await db.lineItems.where({ docType, docId }).delete();
  const toAdd = items.map(item => ({ ...item, docType, docId }));
  await db.lineItems.bulkAdd(toAdd);
}
async function getLineItems(docType, docId) {
  return db.lineItems.where({ docType, docId }).toArray();
}

/* ── Payment Helpers ── */
async function recordPayment(invoiceId, amount, method, notes) {
  await db.payments.add({ invoiceId, amount, method, notes, date: new Date().toISOString() });
  const payments = await db.payments.where('invoiceId').equals(invoiceId).toArray();
  const invoice  = await db.invoices.get(invoiceId);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  let status = 'unpaid';
  if (totalPaid >= invoice.total) status = 'paid';
  else if (totalPaid > 0) status = 'partial';
  await db.invoices.update(invoiceId, { status });
  await logActivity('payment', `Payment received for invoice ${invoice.number}`, amount, invoiceId, 'invoice');
  return status;
}

/* ── Loan Helpers ── */
async function recordInstallment(loanId, amount, paidDate) {
  const loan = await db.loans.get(loanId);
  const newBalance = Math.max(0, (loan.balance || loan.amount) - amount);
  await db.installments.add({ loanId, amount, paid: true, paidDate: paidDate || new Date().toISOString(), dueDate: null });
  const status = newBalance <= 0 ? 'paid' : 'active';
  await db.loans.update(loanId, { balance: newBalance, status });
  const client = await db.clients.get(loan.clientId);
  await logActivity('loan_payment', `Installment received from ${client?.name || 'client'}`, amount, loanId, 'loan');
  return newBalance;
}

/* ── Convert Quote to Invoice ── */
async function convertQuoteToInvoice(quotationId) {
  const [quote, lineItems] = await Promise.all([
    db.quotations.get(quotationId),
    getLineItems('quotation', quotationId)
  ]);
  const invoiceNumber = await getNextInvoiceNumber();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoiceId = await db.invoices.add({
    quotationId,
    clientId:      quote.clientId,
    number:        invoiceNumber,
    date:          new Date().toISOString(),
    dueDate:       dueDate.toISOString(),
    status:        'unpaid',
    subtotal:      quote.subtotal,
    discount:      quote.discount,
    tax:           quote.tax,
    total:         quote.total,
    currency:      quote.currency,
    notes:         quote.notes,
    departmentId:  quote.departmentId  || null,
    preparedBy:    quote.preparedBy    || '',
    preparedByDept:quote.preparedByDept|| ''
  });

  await saveLineItems('invoice', invoiceId, lineItems.map(({ id, docType, docId, ...rest }) => rest));
  await db.quotations.update(quotationId, { status: 'converted' });
  await incrementInvoiceNumber();
  await logActivity('invoice', `Invoice ${invoiceNumber} created from quotation`, quote.total, invoiceId, 'invoice');
  return invoiceId;
}

window.KwezaDB = {
  db,
  getSetting, setSetting, getAllSettings,
  getNextQuoteNumber, getNextInvoiceNumber,
  incrementQuoteNumber, incrementInvoiceNumber,
  logActivity, getDashboardStats, getMonthlyRevenue,
  getClientWithStats, saveLineItems, getLineItems,
  recordPayment, recordInstallment, convertQuoteToInvoice,
  DEFAULT_SETTINGS
};
