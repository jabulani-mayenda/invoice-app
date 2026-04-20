/* ============================================
   KWEZA - DATABASE + SUPABASE SYNC
   ============================================ */

const rawDb = new Dexie('KwezaInvoiceDB');

// v6 — existing schema (preserved for upgrade path)
rawDb.version(6).stores({
  clients: '++id, clientCode, name, phone, email, company, source, address, createdAt, departmentId',
  serviceRequests: '++id, requestCode, clientId, departmentId, service, status, createdAt',
  sales: '++id, saleCode, requestId, clientId, service, total, status, assignedDepartmentId, createdAt',
  catalog: '++id, name, category, price, description, unit, departmentId',
  quotations: '++id, clientId, saleId, number, date, validityDays, status, subtotal, discount, tax, total, currency, notes, departmentId',
  invoices: '++id, quotationId, clientId, saleId, number, date, dueDate, status, subtotal, discount, tax, total, currency, notes, departmentId',
  lineItems: '++id, docType, docId, description, rate, qty, discount, amount, catalogId',
  payments: '++id, invoiceId, date, amount, method, notes',
  operationTasks: '++id, taskCode, saleId, departmentId, task, status, createdAt',
  projectReports: '++id, reportCode, departmentId, saleId, invoiceId, taskId, type, status, date',
  loans: '++id, clientId, amount, balance, date, dueDate, status, description, interestRate, departmentId',
  installments: '++id, loanId, dueDate, amount, paid, paidDate',
  settings: 'key',
  activity: '++id, type, description, amount, date, refId, refType',
  users: 'id, name, department, role',
  departments: 'id, name, code, createdAt',
  employees: '++id, fullName, departmentId, position, email, phone, status, createdAt'
});

// v7 — upgraded schema with new tables
rawDb.version(7).stores({
  clients:            '++id, clientCode, name, phone, email, company, source, address, createdAt, departmentId, leadId',
  serviceRequests:    '++id, requestCode, clientId, departmentId, service, status, createdAt',
  sales:              '++id, saleCode, requestId, clientId, leadId, service, total, status, assignedDepartmentId, createdAt',
  catalog:            '++id, name, category, price, description, unit, departmentId',
  quotations:         '++id, clientId, saleId, number, date, validityDays, status, subtotal, discount, tax, total, currency, notes, departmentId, approvedBy, approvedAt',
  invoices:           '++id, quotationId, clientId, saleId, projectId, number, date, dueDate, status, subtotal, discount, tax, total, currency, notes, departmentId',
  lineItems:          '++id, docType, docId, description, rate, qty, discount, amount, catalogId',
  payments:           '++id, invoiceId, date, amount, method, notes, recordedBy',
  operationTasks:     '++id, taskCode, saleId, projectId, departmentId, task, status, createdAt',
  projectReports:     '++id, reportCode, departmentId, saleId, invoiceId, taskId, type, status, date',
  loans:              '++id, clientId, amount, balance, date, dueDate, status, description, interestRate, departmentId',
  installments:       '++id, loanId, dueDate, amount, paid, paidDate',
  settings:           'key',
  activity:           '++id, type, description, amount, date, refId, refType',
  users:              'id, name, department, role, passwordHash, isActive',
  departments:        'id, name, code, createdAt',
  employees:          '++id, fullName, departmentId, position, email, phone, status, createdAt',
  leads:              '++id, leadCode, name, company, phone, email, source, status, assignedDeptId, clientId, departmentId, createdAt',
  projects:           '++id, projectCode, invoiceId, clientId, saleId, name, status, departmentId, startDate, dueDate, createdAt',
  projectTasks:       '++id, taskCode, projectId, departmentId, assignedTo, task, status, dueDate, createdAt',
  projectMilestones:  '++id, projectId, title, status, dueDate, createdAt',
  departmentReports:  '++id, reportCode, departmentId, projectId, saleId, type, status, date, submittedBy',
  qaReviews:          '++id, projectId, reviewerId, reviewerDept, result, createdAt',
  notifications:      '++id, userId, deptId, type, isRead, createdAt, refId, refType',  // isRead indexed in v7
  auditLogs:          '++id, userId, action, tableName, recordId, createdAt',
  sessionTokens:      '++id, userId, token, expiresAt, createdAt'
});

// v8 — fix: remove isRead from notifications index (boolean is not a valid IDBKeyRange key)
//           filtering by isRead is now done in JS after .toArray()
rawDb.version(8).stores({
  notifications: '++id, userId, deptId, type, createdAt, refId, refType'
}).upgrade(tx => {
  // No destructive changes — isRead field stays on the records, just no longer indexed
  return Promise.resolve();
});


const TABLE_CONFIG = {
  clients:           { pk: 'id',  remote: 'clients' },
  serviceRequests:   { pk: 'id',  remote: 'service_requests' },
  sales:             { pk: 'id',  remote: 'sales' },
  catalog:           { pk: 'id',  remote: 'catalog' },
  quotations:        { pk: 'id',  remote: 'quotations' },
  invoices:          { pk: 'id',  remote: 'invoices' },
  lineItems:         { pk: 'id',  remote: 'line_items' },
  payments:          { pk: 'id',  remote: 'payments' },
  operationTasks:    { pk: 'id',  remote: 'operation_tasks' },
  projectReports:    { pk: 'id',  remote: 'project_reports' },
  loans:             { pk: 'id',  remote: 'loans' },
  installments:      { pk: 'id',  remote: 'installments' },
  settings:          { pk: 'key', remote: 'settings' },
  activity:          { pk: 'id',  remote: 'activity' },
  users:             { pk: 'id',  remote: 'users' },
  departments:       { pk: 'id',  remote: 'departments' },
  employees:         { pk: 'id',  remote: 'employees' },
  // ─── NEW ───
  leads:             { pk: 'id',  remote: 'leads' },
  projects:          { pk: 'id',  remote: 'projects' },
  projectTasks:      { pk: 'id',  remote: 'project_tasks' },
  projectMilestones: { pk: 'id',  remote: 'project_milestones' },
  departmentReports: { pk: 'id',  remote: 'department_reports' },
  qaReviews:         { pk: 'id',  remote: 'qa_reviews' },
  notifications:     { pk: 'id',  remote: 'notifications' },
  auditLogs:         { pk: 'id',  remote: 'audit_logs' },
  sessionTokens:     { pk: 'id',  remote: 'session_tokens' }
};

const SYNC_TABLES = Object.keys(TABLE_CONFIG);
const SYNC_INTERVAL_MS = 15000;

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
    signature: null,
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

const DEFAULT_MASTER_DEPARTMENTS = [
  { id: 'administration', name: 'Administration', code: 'ADMIN', description: 'Oversight, approvals and governance', color: '#455A64' },
  { id: 'ict', name: 'ICT', code: 'ICT', description: 'Technology, systems and infrastructure', color: '#1565C0' },
  { id: 'marketing', name: 'Marketing', code: 'MKT', description: 'Campaigns, brand and communications', color: '#E65100' },
  { id: 'sales', name: 'Sales', code: 'SALES', description: 'Core engine for quotations and invoices', color: '#6A1B9A' },
  { id: 'sales-operations', name: 'Sales Operations', code: 'SALOPS', description: 'Commercial coordination and internal handovers', color: '#5E35B1' },
  { id: 'finance', name: 'Finance', code: 'FIN', description: 'Billing, payments and financial records', color: '#2E7D32' },
  { id: 'operations', name: 'Operations', code: 'OPS', description: 'Service execution and delivery', color: '#795548' },
  { id: 'business-development', name: 'Business Development', code: 'BIZDEV', description: 'Partnerships and growth initiatives', color: '#00897B' },
  { id: 'design', name: 'Design', code: 'DSN', description: 'Graphics and visual delivery', color: '#C2185B' }
];

const syncState = {
  enabled: false,
  lastSyncAt: 0,
  syncing: null,
  warned: false
};

/* ── PENDING WRITES QUEUE ────────────────────────────────────────
   Any write that fails to reach Supabase is queued here.
   flushPendingWrites() is called at the start of every sync cycle
   so records eventually reach the cloud once connectivity returns.
   ─────────────────────────────────────────────────────────────── */
const pendingWrites = [];   // { tableName, method, payload, options }

function queueFailedWrite(tableName, method, payload, options = {}) {
  // De-duplicate: if same table+id is already queued, replace it
  const pk = TABLE_CONFIG[tableName]?.pk || 'id';
  const id = payload?.[pk];
  const idx = id != null
    ? pendingWrites.findIndex(p => p.tableName === tableName && p.payload?.[pk] === id)
    : -1;
  const entry = { tableName, method, payload, options };
  if (idx >= 0) pendingWrites[idx] = entry;
  else pendingWrites.push(entry);
}

async function flushPendingWrites() {
  if (!syncState.enabled || pendingWrites.length === 0) return;
  const batch = pendingWrites.splice(0, pendingWrites.length);
  for (const op of batch) {
    try {
      await remoteRequest(op.tableName, { method: op.method, body: op.payload, ...op.options });
    } catch {
      // Still failing — re-queue for next cycle
      pendingWrites.push(op);
    }
  }
}

function getRemoteConfig() {
  return window.KwezaSupabase?.getConfig?.() || { url: '', anonKey: '' };
}

function isCloudEnabled() {
  const config = getRemoteConfig();
  return !!config.url && !!config.anonKey;
}

function cleanRecord(record) {
  return Object.fromEntries(
    Object.entries(record || {}).filter(([, value]) => value !== undefined)
  );
}

function serializeFilterValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function makeHeaders(extra = {}) {
  const { anonKey } = getRemoteConfig();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function remoteRequest(tableName, options = {}) {
  const config = TABLE_CONFIG[tableName];
  const supabase = getRemoteConfig();
  if (!config || !isCloudEnabled()) return null;

  const url = new URL(`${supabase.url}/rest/v1/${config.remote}`);
  const filters = options.filters || [];

  if (options.select !== false) {
    url.searchParams.set('select', options.select || '*');
  }

  filters.forEach(filter => {
    const operator = filter.op === 'neq' ? 'neq' : 'eq';
    url.searchParams.append(filter.field, `${operator}.${serializeFilterValue(filter.value)}`);
  });

  if (options.orderBy) {
    url.searchParams.set('order', `${options.orderBy}.${options.ascending === false ? 'desc' : 'asc'}`);
  }

  if (options.limit) {
    url.searchParams.set('limit', String(options.limit));
  }

  if (options.onConflict) {
    url.searchParams.set('on_conflict', options.onConflict);
  }

  const headers = makeHeaders(options.headers || {});
  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed for ${tableName}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function reportCloudIssue(error) {
  console.warn('[Kweza] Supabase sync warning:', error.message || error);
  // Reset warned flag after 60 s so status changes are re-reported
  if (!syncState.warned && typeof window.showToast === 'function') {
    syncState.warned = true;
    setTimeout(() => { syncState.warned = false; }, 60000);
    window.showToast('Cloud sync failed — data saved locally and will retry automatically.', 'warning');
  }
}

/**
 * Non-destructive merge: only updates local cache when Supabase returns actual rows.
 * Never clears local data — preserves locally-written records that haven't reached Supabase yet.
 */
async function syncTableFromRemote(tableName) {
  try {
    const rows = await remoteRequest(tableName, { method: 'GET' });
    if (Array.isArray(rows) && rows.length > 0) {
      // Merge into local — do NOT clear first (preserves local-only records)
      await rawDb.table(tableName).bulkPut(rows.map(cleanRecord));
    }
    // If rows is empty or null, keep local data intact
  } catch (err) {
    // Table may not exist in remote yet — don't crash full sync
    console.warn(`[Kweza] Skipping remote sync for "${tableName}": ${err.message}`);
  }
}

async function refreshFromRemote(options = {}) {
  if (!syncState.enabled) return false;
  if (!options.force && Date.now() - syncState.lastSyncAt < SYNC_INTERVAL_MS) return false;
  if (syncState.syncing) return syncState.syncing;

  const tables = options.tables || SYNC_TABLES;
  syncState.syncing = (async () => {
    try {
      // First: flush any queued writes so remote is up-to-date before we pull
      await flushPendingWrites();
      // Then: pull remote data into local cache (non-destructive merge)
      await Promise.all(tables.map(syncTableFromRemote));
      syncState.lastSyncAt = Date.now();
      return true;
    } catch (error) {
      reportCloudIssue(error);
      return false;
    } finally {
      syncState.syncing = null;
    }
  })();

  return syncState.syncing;
}

async function remoteInsert(tableName, payload) {
  return remoteRequest(tableName, {
    method: 'POST',
    body: payload,
    headers: { Prefer: 'return=representation' }
  });
}

async function remoteUpsert(tableName, payload) {
  const config = TABLE_CONFIG[tableName];
  return remoteRequest(tableName, {
    method: 'POST',
    body: payload,
    onConflict: config.pk,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
  });
}

async function remotePatch(tableName, id, payload) {
  const config = TABLE_CONFIG[tableName];
  return remoteRequest(tableName, {
    method: 'PATCH',
    body: payload,
    filters: [{ field: config.pk, op: 'eq', value: id }],
    headers: { Prefer: 'return=representation' }
  });
}

async function remoteDeleteByFilters(tableName, filters) {
  return remoteRequest(tableName, {
    method: 'DELETE',
    filters,
    select: false
  });
}

/* ── CLOUD-FIRST COLLECTION WRAPPER ──────────────────────────────
   toArray() fetches live from Supabase and updates local cache.
   Falls back to IndexedDB only when offline / Supabase unavailable.
   ──────────────────────────────────────────────────────────────── */
function createCollectionWrapper(tableName, localCollection, filters = [], orderSpec = null, limitVal = null) {
  return {
    async toArray() {
      if (syncState.enabled) {
        try {
          const opts = { method: 'GET', filters };
          if (orderSpec) { opts.orderBy = orderSpec.field; opts.ascending = orderSpec.ascending; }
          if (limitVal)  { opts.limit = limitVal; }
          const rows = await remoteRequest(tableName, opts);
          // If online and we get results, update local cache and return remote truth.
          if (Array.isArray(rows)) {
            if (rows.length > 0) {
              rawDb.table(tableName).bulkPut(rows.map(cleanRecord)).catch(() => {});
            }
            return rows;
          }
        } catch (err) {
          console.warn(`[Kweza] Remote read failed for ${tableName}, falling back to local cache:`, err.message);
        }
      }
      return localCollection.toArray();
    },
    async first() {
      const rows = await this.toArray();
      return rows[0];
    },
    async count() {
      if (syncState.enabled) {
        try {
          const rows = await remoteRequest(tableName, { method: 'GET', filters, select: 'id' });
          if (rows) return rows.length;
        } catch {}
      }
      return localCollection.count();
    },
    reverse() {
      const base = orderSpec || { field: TABLE_CONFIG[tableName]?.pk || 'id', ascending: true };
      return createCollectionWrapper(tableName, localCollection.reverse(), filters, { field: base.field, ascending: !base.ascending }, limitVal);
    },
    limit(value) {
      return createCollectionWrapper(tableName, localCollection.limit(value), filters, orderSpec, value);
    },
    async delete() {
      if (syncState.enabled && filters.length) {
        try { await remoteDeleteByFilters(tableName, filters); } catch (err) { reportCloudIssue(err); }
      }
      return localCollection.delete();
    }
  };
}

function createWhereWrapper(tableName, fieldName) {
  const table = rawDb.table(tableName);
  return {
    equals(value) {
      return createCollectionWrapper(
        tableName,
        table.where(fieldName).equals(value),
        [{ field: fieldName, op: 'eq', value }]
      );
    },
    notEqual(value) {
      return createCollectionWrapper(
        tableName,
        table.where(fieldName).notEqual(value),
        [{ field: fieldName, op: 'neq', value }]
      );
    }
  };
}

function createTableWrapper(tableName) {
  const config  = TABLE_CONFIG[tableName];
  const rawTable = rawDb.table(tableName);

  // ── Helper: cache one row silently ──
  function cacheRow(row) {
    if (row) rawTable.put(cleanRecord(row)).catch(() => {});
  }

  return {
    /* ── READ: always live from Supabase ── */
    async get(id) {
      if (syncState.enabled) {
        try {
          const rows = await remoteRequest(tableName, {
            method: 'GET',
            filters: [{ field: config.pk, op: 'eq', value: id }]
          });
          if (rows && rows.length) { cacheRow(rows[0]); return rows[0]; }
        } catch (err) {
          console.warn(`[Kweza] Remote get failed for ${tableName}#${id}:`, err.message);
        }
      }
      return rawTable.get(id);
    },
    async toArray() {
      if (syncState.enabled) {
        try {
          const rows = await remoteRequest(tableName, { method: 'GET' });
          if (Array.isArray(rows)) {
            if (rows.length > 0) {
              rawTable.bulkPut(rows.map(cleanRecord)).catch(() => {});
            }
            return rows;
          }
        } catch (err) {
          console.warn(`[Kweza] Remote toArray failed for ${tableName}:`, err.message);
        }
      }
      return rawTable.toArray();
    },
    async count() {
      if (syncState.enabled) {
        try {
          const rows = await remoteRequest(tableName, { method: 'GET', select: config.pk });
          if (rows) return rows.length;
        } catch {}
      }
      return rawTable.count();
    },

    /* ── WRITE: Supabase first, local cache updated after ── */
    async add(data) {
      const record = cleanRecord(data);
      let localId;
      if (syncState.enabled) {
        try {
          const rows = await remoteInsert(tableName, record);
          const inserted = Array.isArray(rows) ? rows[0] : rows;
          if (inserted) { cacheRow(inserted); return inserted[config.pk]; }
        } catch (error) {
          reportCloudIssue(error);
          // Save locally first, then queue the write for retry
          localId = await rawTable.add(record);
          queueFailedWrite(tableName, 'POST', { ...record, [config.pk]: localId }, {
            headers: { Prefer: 'return=representation' }
          });
          return localId;
        }
      }
      return rawTable.add(record);
    },
    async put(data) {
      const record = cleanRecord(data);
      if (syncState.enabled) {
        try {
          const rows = await remoteUpsert(tableName, record);
          const inserted = Array.isArray(rows) ? rows[0] : rows;
          if (inserted) { cacheRow(inserted); return inserted[config.pk]; }
        } catch (error) {
          reportCloudIssue(error);
          // Save locally then queue for retry
          const localId = await rawTable.put(record);
          queueFailedWrite(tableName, 'POST', record, {
            onConflict: config.pk,
            headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
          });
          return localId;
        }
      }
      return rawTable.put(record);
    },
    async update(id, changes) {
      const payload = cleanRecord(changes);
      if (syncState.enabled) {
        try {
          const rows = await remotePatch(tableName, id, payload);
          const updated = Array.isArray(rows) ? rows[0] : rows;
          if (updated) { cacheRow(updated); return 1; }
        } catch (error) {
          reportCloudIssue(error);
          // Save locally then queue for retry
          await rawTable.update(id, payload);
          queueFailedWrite(tableName, 'PATCH', payload, {
            filters: [{ field: config.pk, op: 'eq', value: id }],
            headers: { Prefer: 'return=representation' }
          });
          return 1;
        }
      }
      return rawTable.update(id, payload);
    },
    async delete(id) {
      if (syncState.enabled) {
        try { await remoteDeleteByFilters(tableName, [{ field: config.pk, op: 'eq', value: id }]); }
        catch (error) { reportCloudIssue(error); }  // delete failures are not re-queued to avoid phantom deletes
      }
      return rawTable.delete(id);
    },
    async clear() {
      if (syncState.enabled) {
        try {
          const rows = await remoteRequest(tableName, { method: 'GET', select: config.pk });
          if (rows && rows.length) {
            for (const row of rows) {
              await remoteDeleteByFilters(tableName, [{ field: config.pk, op: 'eq', value: row[config.pk] }]);
            }
          }
        } catch (error) { reportCloudIssue(error); }
      }
      return rawTable.clear();
    },
    async bulkAdd(items) {
      const payload = items.map(cleanRecord);
      if (syncState.enabled && payload.length) {
        try {
          const rows = await remoteInsert(tableName, payload);
          if (Array.isArray(rows) && rows.length) {
            await rawTable.bulkPut(rows.map(cleanRecord));
            return rows.length;
          }
        } catch (error) {
          reportCloudIssue(error);
          // Save locally then queue each item for retry
          const localIds = await rawTable.bulkAdd(payload, { allKeys: true });
          payload.forEach((rec, i) => queueFailedWrite(tableName, 'POST', { ...rec, [config.pk]: localIds[i] }, {
            headers: { Prefer: 'return=representation' }
          }));
          return localIds.length;
        }
      }
      return rawTable.bulkAdd(payload);
    },
    async bulkPut(items) {
      const payload = items.map(cleanRecord);
      if (syncState.enabled && payload.length) {
        try { await remoteUpsert(tableName, payload); } catch (error) {
          reportCloudIssue(error);
          // Queue each item for retry
          payload.forEach(rec => queueFailedWrite(tableName, 'POST', rec, {
            onConflict: config.pk,
            headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
          }));
        }
      }
      return rawTable.bulkPut(payload);
    },

    /* ── QUERY BUILDERS ── */
    orderBy(fieldName) {
      return createCollectionWrapper(
        tableName,
        rawTable.orderBy(fieldName),
        [],
        { field: fieldName, ascending: true }
      );
    },
    where(query) {
      if (typeof query === 'string') return createWhereWrapper(tableName, query);
      const filters    = Object.entries(query || {}).map(([field, value]) => ({ field, op: 'eq', value }));
      const collection = rawTable.toCollection().filter(row =>
        Object.entries(query || {}).every(([field, value]) => row[field] === value)
      );
      return createCollectionWrapper(tableName, collection, filters);
    },
    toCollection() {
      return createCollectionWrapper(tableName, rawTable.toCollection(), []);
    }
  };
}

const db = {
  async open() {
    // Enable cloud sync if Supabase is configured
    syncState.enabled = isCloudEnabled();
    await rawDb.open();
    // Seed local defaults (settings, departments) — only used as offline fallback
    await seedLocalDefaults();
    if (syncState.enabled) {
      // Seed cloud defaults silently — don't block app startup
      seedCloudDefaults().catch(err => console.warn('[Kweza] seedCloudDefaults skipped:', err.message));
    }
  }
};

Object.keys(TABLE_CONFIG).forEach(tableName => {
  db[tableName] = createTableWrapper(tableName);
});

function slugifyId(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getNextSequenceCode(sequenceKey, prefix) {
  const current = (await getSetting(sequenceKey)) || 1;
  return `${prefix}-${String(current).padStart(4, '0')}`;
}

async function incrementSequence(sequenceKey) {
  const current = (await getSetting(sequenceKey)) || 1;
  await setSetting(sequenceKey, current + 1);
}

async function getSetting(key) {
  const row = await db.settings.get(key);
  return row ? row.value : null;
}

async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

async function getAllSettings() {
  const result = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const rows = await db.settings.toArray();
  rows.forEach(row => {
    const [section, field] = String(row.key || '').split('.');
    if (field && result[section]) {
      result[section][field] = row.value;
    }
  });

  const company = await getSetting('company');
  const branding = await getSetting('branding');
  const defaults = await getSetting('defaults');

  if (company) result.company = { ...result.company, ...company };
  if (branding) result.branding = { ...result.branding, ...branding };
  if (defaults) result.defaults = { ...result.defaults, ...defaults };
  return result;
}

async function getNextQuoteNumber() {
  const branding = (await getSetting('branding')) || DEFAULT_SETTINGS.branding;
  const value = branding.nextQuoteNumber || 1;
  return `${branding.quotePrefix || 'KFS-Q'}-${String(value).padStart(3, '0')}`;
}

async function getNextInvoiceNumber() {
  const branding = (await getSetting('branding')) || DEFAULT_SETTINGS.branding;
  const value = branding.nextInvoiceNumber || 1;
  return `${branding.invoicePrefix || 'KFS'}-${String(value).padStart(3, '0')}`;
}

async function incrementQuoteNumber() {
  const branding = { ...DEFAULT_SETTINGS.branding, ...((await getSetting('branding')) || {}) };
  branding.nextQuoteNumber = (branding.nextQuoteNumber || 1) + 1;
  await setSetting('branding', branding);
}

async function incrementInvoiceNumber() {
  const branding = { ...DEFAULT_SETTINGS.branding, ...((await getSetting('branding')) || {}) };
  branding.nextInvoiceNumber = (branding.nextInvoiceNumber || 1) + 1;
  await setSetting('branding', branding);
}

async function logActivity(type, description, amount = 0, refId = null, refType = null) {
  await db.activity.add({
    type,
    description,
    amount,
    date: new Date().toISOString(),
    refId,
    refType
  });

  const count = await db.activity.count();
  if (count > 100) {
    const oldest = await db.activity.orderBy('id').first();
    if (oldest) await db.activity.delete(oldest.id);
  }
}

async function getDashboardStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
  const [clients, invoices, quotations, loans] = await Promise.all([
    db.clients.count(),
    db.invoices.toArray(),
    db.quotations.toArray(),
    db.loans.toArray()
  ]);

  const monthInvoices = invoices.filter(item => item.date >= monthStart && item.date <= monthEnd);
  const monthRevenue = monthInvoices.filter(item => item.status === 'paid').reduce((sum, item) => sum + (item.total || 0), 0);
  const outstanding = invoices.filter(item => item.status !== 'paid').reduce((sum, item) => sum + (item.total || 0), 0);
  const totalRevenue = invoices.filter(item => item.status === 'paid').reduce((sum, item) => sum + (item.total || 0), 0);
  const overdueLoan = loans.filter(item => item.status === 'overdue' || (item.dueDate && item.dueDate < now.toISOString() && item.status !== 'paid')).length;
  const pendingQuotes = quotations.filter(item => item.status === 'pending').length;

  return { clients, monthRevenue, outstanding, totalRevenue, overdueLoan, pendingQuotes, totalInvoices: invoices.length };
}

async function getMonthlyRevenue() {
  const invoices = await db.invoices.where('status').equals('paid').toArray();
  const months = [];
  for (let index = 5; index >= 0; index -= 1) {
    const current = new Date();
    current.setMonth(current.getMonth() - index);
    const label = current.toLocaleDateString('en', { month: 'short', year: '2-digit' });
    const start = new Date(current.getFullYear(), current.getMonth(), 1).toISOString();
    const end = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const total = invoices.filter(inv => inv.date >= start && inv.date <= end).reduce((sum, inv) => sum + (inv.total || 0), 0);
    months.push({ label, total });
  }
  return months;
}

async function getClientWithStats(clientId) {
  const [client, clientInvoices, clientLoans] = await Promise.all([
    db.clients.get(clientId),
    db.invoices.where('clientId').equals(clientId).toArray(),
    db.loans.where('clientId').equals(clientId).toArray()
  ]);

  const totalBilled = clientInvoices.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalPaid = clientInvoices.filter(item => item.status === 'paid').reduce((sum, item) => sum + (item.total || 0), 0);
  const outstandingLoan = clientLoans.reduce((sum, item) => sum + (item.balance || 0), 0);
  return { ...client, totalBilled, totalPaid, outstandingLoan, invoiceCount: clientInvoices.length };
}

async function saveLineItems(docType, docId, items) {
  await db.lineItems.where({ docType, docId }).delete();
  const payload = items.map(item => ({ ...item, docType, docId }));
  if (payload.length) {
    await db.lineItems.bulkAdd(payload);
  }
}

async function getLineItems(docType, docId) {
  return db.lineItems.where({ docType, docId }).toArray();
}

async function recordPayment(invoiceId, amount, method, notes) {
  const existingInvoice = await db.invoices.get(invoiceId);
  if (!existingInvoice) throw new Error('Invoice not found.');
  if (existingInvoice.status === 'paid') throw new Error('This invoice is already fully paid and locked.');

  await db.payments.add({
    invoiceId,
    amount,
    method,
    notes,
    date: new Date().toISOString()
  });

  const [payments, invoice] = await Promise.all([
    db.payments.where('invoiceId').equals(invoiceId).toArray(),
    Promise.resolve(existingInvoice)
  ]);

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  let status = 'unpaid';
  if (totalPaid >= invoice.total) status = 'paid';
  else if (totalPaid > 0) status = 'partial';

  await db.invoices.update(invoiceId, { status });
  await logActivity('payment', `Payment received for invoice ${invoice.number}`, amount, invoiceId, 'invoice');
  return status;
}

async function recordInstallment(loanId, amount, paidDate) {
  const loan = await db.loans.get(loanId);
  const newBalance = Math.max(0, (loan.balance || loan.amount) - amount);
  await db.installments.add({
    loanId,
    amount,
    paid: true,
    paidDate: paidDate || new Date().toISOString(),
    dueDate: null
  });

  const status = newBalance <= 0 ? 'paid' : 'active';
  await db.loans.update(loanId, { balance: newBalance, status });
  const client = await db.clients.get(loan.clientId);
  await logActivity('loan_payment', `Installment received from ${client?.name || 'client'}`, amount, loanId, 'loan');
  return newBalance;
}

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
    clientId: quote.clientId,
    saleId: quote.saleId || null,
    number: invoiceNumber,
    date: new Date().toISOString(),
    dueDate: dueDate.toISOString(),
    status: 'unpaid',
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax: quote.tax,
    total: quote.total,
    currency: quote.currency,
    notes: quote.notes,
    departmentId: quote.departmentId || null,
    preparedBy: quote.preparedBy || '',
    preparedByDept: quote.preparedByDept || ''
  });

  await saveLineItems('invoice', invoiceId, lineItems.map(({ id, docType, docId, ...rest }) => rest));
  await db.quotations.update(quotationId, { status: 'converted' });
  await incrementInvoiceNumber();
  await logActivity('invoice', `Invoice ${invoiceNumber} created from quotation`, quote.total, invoiceId, 'invoice');
  return invoiceId;
}

async function getAllDepartments() {
  return db.departments.orderBy('name').toArray();
}

async function saveDepartment(data) {
  const now = new Date().toISOString();
  const record = {
    id: data.id || slugifyId(data.name || data.code || `dept-${Date.now()}`),
    name: data.name || '',
    code: data.code || '',
    description: data.description || '',
    color: data.color || '#1565C0',
    createdAt: data.createdAt || now
  };
  await db.departments.put(record);
  return record;
}

async function deleteDepartment(departmentId) {
  const linkedEmployees = (await db.employees.where('departmentId').equals(departmentId).toArray()).length;
  if (linkedEmployees > 0) {
    throw new Error('Move or remove employees in this department before deleting it.');
  }
  await db.departments.delete(departmentId);
}

async function getAllEmployees() {
  return db.employees.orderBy('fullName').toArray();
}

async function saveEmployee(data) {
  const record = {
    ...data,
    fullName: data.fullName || '',
    departmentId: data.departmentId || null,
    position: data.position || '',
    email: data.email || '',
    phone: data.phone || '',
    status: data.status || 'active',
    createdAt: data.createdAt || new Date().toISOString()
  };

  if (record.id) {
    await db.employees.put(record);
    return record;
  }

  const id = await db.employees.add(record);
  return { ...record, id };
}

async function deleteEmployee(employeeId) {
  await db.employees.delete(employeeId);
}

async function createClientRecord(data) {
  const clientCode = data.clientCode || await getNextSequenceCode('clientNumberSeq', 'CL');
  const id = await db.clients.add({
    ...data,
    clientCode,
    createdAt: data.createdAt || new Date().toISOString()
  });
  if (!data.clientCode) await incrementSequence('clientNumberSeq');
  return { ...(await db.clients.get(id)) };
}

async function createServiceRequest(data) {
  const requestCode = data.requestCode || await getNextSequenceCode('requestNumberSeq', 'REQ');
  const id = await db.serviceRequests.add({
    ...data,
    requestCode,
    status: data.status || 'Pending',
    createdAt: data.createdAt || new Date().toISOString()
  });
  if (!data.requestCode) await incrementSequence('requestNumberSeq');
  return { ...(await db.serviceRequests.get(id)) };
}

async function createSale(data) {
  const saleCode = data.saleCode || await getNextSequenceCode('saleNumberSeq', 'SAL');
  const id = await db.sales.add({
    ...data,
    saleCode,
    status: data.status || 'Open',
    createdAt: data.createdAt || new Date().toISOString()
  });
  if (data.requestId) {
    await db.serviceRequests.update(data.requestId, { status: 'Converted to Sale' });
  }
  if (!data.saleCode) await incrementSequence('saleNumberSeq');
  return { ...(await db.sales.get(id)) };
}

async function createOperationTask(data) {
  const taskCode = data.taskCode || await getNextSequenceCode('taskNumberSeq', 'TSK');
  const id = await db.operationTasks.add({
    ...data,
    taskCode,
    status: data.status || 'Pending',
    createdAt: data.createdAt || new Date().toISOString()
  });
  if (!data.taskCode) await incrementSequence('taskNumberSeq');
  return { ...(await db.operationTasks.get(id)) };
}

async function createProjectReport(data) {
  const reportCode = data.reportCode || await getNextSequenceCode('reportNumberSeq', 'RPT');
  const id = await db.projectReports.add({
    ...data,
    reportCode,
    status: data.status || 'Open',
    date: data.date || new Date().toISOString()
  });
  if (!data.reportCode) await incrementSequence('reportNumberSeq');
  return { ...(await db.projectReports.get(id)) };
}

async function getWorkflowStats() {
  const [requests, sales, tasks, reports] = await Promise.all([
    db.serviceRequests.toArray(),
    db.sales.toArray(),
    db.operationTasks.toArray(),
    db.projectReports.toArray()
  ]);

  return {
    activeRequests: requests.filter(item => item.status !== 'Completed').length,
    activeSales: sales.filter(item => !['Closed', 'Completed'].includes(item.status)).length,
    activeTasks: tasks.filter(item => !['Completed', 'Closed'].includes(item.status)).length,
    completedTasks: tasks.filter(item => item.status === 'Completed').length,
    reportCount: reports.length
  };
}

async function seedLocalDefaults() {
  const settingsRows = await rawDb.table('settings').count();
  if (settingsRows === 0) {
    await rawDb.table('settings').bulkPut([
      { key: 'company',          value: DEFAULT_SETTINGS.company },
      { key: 'branding',         value: DEFAULT_SETTINGS.branding },
      { key: 'defaults',         value: DEFAULT_SETTINGS.defaults },
      { key: 'clientNumberSeq',  value: 1 },
      { key: 'requestNumberSeq', value: 1 },
      { key: 'saleNumberSeq',    value: 1 },
      { key: 'taskNumberSeq',    value: 1 },
      { key: 'reportNumberSeq',  value: 1 },
      { key: 'leadNumberSeq',    value: 1 },
      { key: 'projectNumberSeq', value: 1 }
    ]);
  }

  for (const department of DEFAULT_MASTER_DEPARTMENTS) {
    const existing = await rawDb.table('departments').get(department.id);
    if (!existing) {
      await rawDb.table('departments').put({ ...department, createdAt: new Date().toISOString() });
    }
  }
}

/* ─── DEPT-SCOPED QUERY HELPER ───────────────────────────────── */
/**
 * Returns all records from a table, filtered by departmentId if the
 * current user is not admin. Admin sees everything.
 * @param {string} tableName — Dexie table name
 * @param {string} [deptField='departmentId'] — field to filter on
 */
async function getDeptScoped(tableName, deptField = 'departmentId') {
  const table   = db[tableName];
  const user    = window.KwezaAuth?.getCurrentUser?.();
  const isAdmin = user?.role === 'admin';
  if (isAdmin || !user || !user.id) return table.toArray();
  // Guard: .where().equals() requires a defined non-boolean primitive
  const deptId = user.id;
  if (deptId === undefined || deptId === null) return table.toArray();
  return table.where(deptField).equals(String(deptId)).toArray();
}

/* ─── AUDIT LOGGING ──────────────────────────────────────────── */
async function logAudit(action, tableName, recordId, before = null, after = null) {
  const user = window.KwezaAuth?.getCurrentUser?.();
  try {
    await db.auditLogs.add({
      userId:    user?.id   || 'system',
      userDept:  user?.department || '',
      action,
      tableName,
      recordId:  String(recordId || ''),
      diff:      (before || after) ? { before, after } : null,
      createdAt: new Date().toISOString()
    });
  } catch {
    // non-critical
  }
}

/* ─── LEAD FUNCTIONS ─────────────────────────────────────────── */
async function createLead(data) {
  const leadCode = data.leadCode || await getNextSequenceCode('leadNumberSeq', 'LEAD');
  const id = await db.leads.add({
    ...data,
    leadCode,
    status:    data.status    || 'New',
    createdAt: data.createdAt || new Date().toISOString()
  });
  if (!data.leadCode) await incrementSequence('leadNumberSeq');
  await logAudit('create', 'leads', id, null, data);
  return { ...(await db.leads.get(id)) };
}

async function convertLeadToClient(leadId, clientData) {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error('Lead not found.');

  const client = await createClientRecord({
    ...clientData,
    name:    clientData.name    || lead.name,
    company: clientData.company || lead.company,
    phone:   clientData.phone   || lead.phone,
    email:   clientData.email   || lead.email,
    source:  lead.source,
    leadId:  String(leadId)
  });

  await db.leads.update(leadId, {
    status:      'Converted',
    clientId:    client.id,
    convertedAt: new Date().toISOString()
  });

  await logAudit('update', 'leads', leadId, { status: lead.status }, { status: 'Converted', clientId: client.id });
  return client;
}

/* ─── PROJECT FUNCTIONS ──────────────────────────────────────── */
async function createProject(data) {
  const projectCode = data.projectCode || await getNextSequenceCode('projectNumberSeq', 'PRJ');
  const id = await db.projects.add({
    ...data,
    projectCode,
    status:    data.status    || 'Pending',
    createdAt: data.createdAt || new Date().toISOString(),
    createdBy: data.createdBy || window.KwezaAuth?.getCurrentUser?.()?.id || ''
  });
  if (!data.projectCode) await incrementSequence('projectNumberSeq');

  // Update linked invoice to project_created status
  if (data.invoiceId) {
    await db.invoices.update(data.invoiceId, { projectId: id, status: 'project_created' });
  }

  await logAudit('create', 'projects', id, null, data);

  // Notify relevant dept
  await createNotification({
    deptId:  data.departmentId,
    type:    'action',
    title:   'New Project Assigned',
    message: `Project ${projectCode} has been created and assigned to your department.`,
    refId:   id,
    refType: 'project'
  });

  return { ...(await db.projects.get(id)) };
}

async function getProjectWithDetails(projectId) {
  const [project, tasks, milestones, reports, qaReviews] = await Promise.all([
    db.projects.get(projectId),
    db.projectTasks.where('projectId').equals(projectId).toArray(),
    db.projectMilestones.where('projectId').equals(projectId).toArray(),
    db.departmentReports.where('projectId').equals(projectId).toArray(),
    db.qaReviews.where('projectId').equals(projectId).toArray()
  ]);
  return { ...project, tasks, milestones, reports, qaReviews };
}

/**
 * Check if a project can be completed:
 * - all tasks must be Done
 * - at least one Completion report submitted
 * - QA must have a passing review
 */
async function canCompleteProject(projectId) {
  const [tasks, reports, qaReviews] = await Promise.all([
    db.projectTasks.where('projectId').equals(projectId).toArray(),
    db.departmentReports.where('projectId').equals(projectId).toArray(),
    db.qaReviews.where('projectId').equals(projectId).toArray()
  ]);

  const allTasksDone    = tasks.length > 0 && tasks.every(t => t.status === 'Done');
  const hasCompletionReport = reports.some(r => r.type === 'Completion');
  const qaApproved      = qaReviews.some(r => r.result === 'pass');

  return {
    canComplete: allTasksDone && hasCompletionReport && qaApproved,
    allTasksDone,
    hasCompletionReport,
    qaApproved,
    taskCount:   tasks.length,
    doneCount:   tasks.filter(t => t.status === 'Done').length
  };
}

async function completeProject(projectId) {
  const check = await canCompleteProject(projectId);
  if (!check.canComplete) {
    const reasons = [];
    if (!check.allTasksDone)         reasons.push('Not all tasks are done');
    if (!check.hasCompletionReport)  reasons.push('No completion report submitted');
    if (!check.qaApproved)           reasons.push('QA has not approved this project');
    throw new Error('Cannot complete: ' + reasons.join('; '));
  }

  const now = new Date().toISOString();
  await db.projects.update(projectId, { status: 'Completed', completedAt: now, lockedAt: now });
  await logAudit('update', 'projects', projectId, { status: 'In Progress' }, { status: 'Completed' });
}

/* ─── NOTIFICATIONS ──────────────────────────────────────────── */
async function createNotification(data) {
  try {
    await db.notifications.add({
      ...data,
      isRead:    false,
      createdAt: new Date().toISOString()
    });
  } catch {
    // non-critical
  }
}

async function getUnreadNotifications(userId, deptId) {
  // NOTE: Boolean values are not valid IDBKeyRange keys, so we must
  // fetch all notifications and filter in JS — never use .where('isRead').equals(false)
  const all = await db.notifications.toArray();
  return all.filter(n =>
    !n.isRead &&
    (!n.userId || n.userId === userId) &&
    (!n.deptId || n.deptId === deptId)
  );
}

/* ─── QA FUNCTIONS ───────────────────────────────────────────── */
async function submitQAReview(data) {
  const user = window.KwezaAuth?.getCurrentUser?.();
  const id = await db.qaReviews.add({
    ...data,
    reviewerId:   data.reviewerId   || user?.id || '',
    reviewerDept: data.reviewerDept || user?.department || '',
    createdAt:    new Date().toISOString()
  });

  // On fail — push project back to Revision
  if (data.result === 'fail') {
    await db.projects.update(data.projectId, { status: 'Revision' });
    await createNotification({
      deptId:  (await db.projects.get(data.projectId))?.departmentId,
      type:    'warning',
      title:   'QA Review Failed',
      message: 'A QA review has failed. The project has been returned to Revision.',
      refId:   data.projectId,
      refType: 'project'
    });
  } else if (data.result === 'pass') {
    const now = new Date().toISOString();
    await db.projects.update(data.projectId, {
      status:      'QA',
      qaApprovedAt: now,
      qaApprovedBy: data.reviewerId || user?.id || ''
    });
  }

  await logAudit('create', 'qa_reviews', id, null, data);
  return id;
}

async function seedCloudDefaults() {
  try {
    await Promise.all([
      setSetting('company',          (await getSetting('company'))          || DEFAULT_SETTINGS.company),
      setSetting('branding',         (await getSetting('branding'))         || DEFAULT_SETTINGS.branding),
      setSetting('defaults',         (await getSetting('defaults'))         || DEFAULT_SETTINGS.defaults),
      setSetting('clientNumberSeq',  (await getSetting('clientNumberSeq'))  || 1),
      setSetting('requestNumberSeq', (await getSetting('requestNumberSeq')) || 1),
      setSetting('saleNumberSeq',    (await getSetting('saleNumberSeq'))    || 1),
      setSetting('taskNumberSeq',    (await getSetting('taskNumberSeq'))    || 1),
      setSetting('reportNumberSeq',  (await getSetting('reportNumberSeq'))  || 1),
      setSetting('leadNumberSeq',    (await getSetting('leadNumberSeq'))    || 1),
      setSetting('projectNumberSeq', (await getSetting('projectNumberSeq')) || 1)
    ]);

    for (const department of DEFAULT_MASTER_DEPARTMENTS) {
      await saveDepartment({ ...department, createdAt: department.createdAt || new Date().toISOString() });
    }
  } catch (error) {
    reportCloudIssue(error);
  }
}

window.KwezaDB = {
  db,
  rawDb,
  getSetting,
  setSetting,
  getAllSettings,
  getNextQuoteNumber,
  getNextInvoiceNumber,
  incrementQuoteNumber,
  incrementInvoiceNumber,
  logActivity,
  logAudit,
  getDashboardStats,
  getMonthlyRevenue,
  getClientWithStats,
  saveLineItems,
  getLineItems,
  recordPayment,
  recordInstallment,
  convertQuoteToInvoice,
  refreshFromRemote,
  flushPendingWrites,
  pendingWriteCount: () => pendingWrites.length,
  getAllDepartments,
  saveDepartment,
  deleteDepartment,
  getAllEmployees,
  saveEmployee,
  deleteEmployee,
  createClientRecord,
  createServiceRequest,
  createSale,
  createOperationTask,
  createProjectReport,
  getWorkflowStats,
  getNextSequenceCode,
  slugifyId,
  getDeptScoped,
  // ─── NEW ───
  createLead,
  convertLeadToClient,
  createProject,
  getProjectWithDetails,
  canCompleteProject,
  completeProject,
  submitQAReview,
  createNotification,
  getUnreadNotifications,
  DEFAULT_SETTINGS,
  DEFAULT_MASTER_DEPARTMENTS
};
