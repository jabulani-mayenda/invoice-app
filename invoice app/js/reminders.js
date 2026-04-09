/* ── REMINDERS ── */
async function checkReminders() {
  const { db } = window.KwezaDB;
  const now = new Date();
  const reminders = [];

  // Overdue invoices
  const invoices = await db.invoices.where('status').notEqual('paid').toArray();
  invoices.forEach(inv => {
    if (inv.dueDate && new Date(inv.dueDate) < now) {
      const days = Math.floor((now - new Date(inv.dueDate)) / 86400000);
      reminders.push({ type: 'overdue', message: `Invoice ${inv.number} is ${days} day(s) overdue`, refId: inv.id, refType: 'invoice' });
    }
  });

  // Expiring quotes
  const quotes = await db.quotations.where('status').equals('pending').toArray();
  quotes.forEach(q => {
    if (q.date && q.validityDays) {
      const expires = new Date(q.date);
      expires.setDate(expires.getDate() + (q.validityDays || 14));
      const daysLeft = Math.floor((expires - now) / 86400000);
      if (daysLeft <= 2 && daysLeft >= 0) {
        reminders.push({ type: 'expiring', message: `Quotation ${q.number} expires in ${daysLeft} day(s)`, refId: q.id, refType: 'quotation' });
      }
    }
  });

  // Overdue loans
  const loans = await db.loans.where('status').equals('active').toArray();
  loans.forEach(l => {
    if (l.dueDate && new Date(l.dueDate) < now) {
      reminders.push({ type: 'loan', message: `Loan for client overdue`, refId: l.id, refType: 'loan' });
    }
  });

  return reminders;
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function sendNotification(title, body, icon = './assets/logo.png') {
  const perm = await requestNotificationPermission();
  if (!perm) return;
  const n = new Notification(title, { body, icon });
  n.onclick = () => window.focus();
}

async function runReminderCheck() {
  const reminders = await checkReminders();
  reminders.forEach(r => sendNotification('Kweza Reminder', r.message));
  return reminders;
}

window.KwezaReminders = { checkReminders, runReminderCheck, requestNotificationPermission };
