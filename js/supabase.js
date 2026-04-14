(function () {
  const defaultConfig = {
    url: 'https://yqdhpfwkpftkfyexzwkm.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZGhwZndrcGZ0a2Z5ZXh6d2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzkwNzMsImV4cCI6MjA5MTYxNTA3M30.LAwlkd89Z2su6lZMN9JP7dUyuPC2WHFduWMw-RCuh1E'
  };

  function getConfig() {
    const override = window.__KWEZA_SUPABASE_CONFIG__ || {};
    return {
      url:     (override.url     || defaultConfig.url     || '').trim(),
      anonKey: (override.anonKey || defaultConfig.anonKey || '').trim()
    };
  }

  /**
   * Build headers including session token for authenticated requests.
   */
  function getHeaders() {
    const { anonKey } = getConfig();
    const token = window.KwezaAuth?.getSessionToken?.();
    return {
      'Content-Type':  'application/json',
      'apikey':         anonKey,
      'Authorization': `Bearer ${token || anonKey}`
    };
  }

  /**
   * Generic REST fetch against Supabase PostgREST.
   * @param {string} table  — remote table name (snake_case)
   * @param {object} opts   — { select, filter, body, method }
   */
  async function sbFetch(table, opts = {}) {
    const { url } = getConfig();
    if (!url) throw new Error('Supabase URL not configured');

    const { select = '*', filter = '', body = null, method = 'GET' } = opts;
    const path = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter ? `&${filter}` : ''}`;

    const res = await fetch(path, {
      method,
      headers: {
        ...getHeaders(),
        'Prefer': method === 'GET' ? 'return=representation' : 'return=representation'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) throw new Error(`[Supabase] ${method} ${table}: ${res.status} ${res.statusText}`);
    return res.json();
  }

  /**
   * Pull all rows from a Supabase table.
   */
  async function pullTable(table) {
    return sbFetch(table);
  }

  /**
   * Upsert a record to Supabase (POST with on-conflict update).
   */
  async function upsertRecord(table, record) {
    const { url } = getConfig();
    if (!url) throw new Error('Supabase URL not configured');

    const res = await fetch(`${url}/rest/v1/${table}`, {
      method:  'POST',
      headers: { ...getHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body:    JSON.stringify(record)
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[Supabase] upsert ${table}: ${res.status} — ${detail}`);
    }
    return res.json();
  }

  /**
   * Delete a record from Supabase.
   */
  async function deleteRecord(table, id) {
    const { url } = getConfig();
    if (!url) throw new Error('Supabase URL not configured');

    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
      method:  'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(`[Supabase] delete ${table}: ${res.status}`);
    return true;
  }

  /**
   * All local→remote sync-able tables.
   * Add any new table here to enable cloud round-trip.
   */
  const SYNC_TABLES = [
    { local: 'clients',            remote: 'clients' },
    { local: 'serviceRequests',    remote: 'service_requests' },
    { local: 'sales',              remote: 'sales' },
    { local: 'catalog',            remote: 'catalog' },
    { local: 'quotations',         remote: 'quotations' },
    { local: 'invoices',           remote: 'invoices' },
    { local: 'lineItems',          remote: 'line_items' },
    { local: 'payments',           remote: 'payments' },
    { local: 'operationTasks',     remote: 'operation_tasks' },
    { local: 'projectReports',     remote: 'project_reports' },
    { local: 'loans',              remote: 'loans' },
    { local: 'installments',       remote: 'installments' },
    { local: 'settings',           remote: 'settings' },
    { local: 'activity',           remote: 'activity' },
    { local: 'users',              remote: 'users' },
    { local: 'departments',        remote: 'departments' },
    { local: 'employees',          remote: 'employees' },
    // ─── NEW TABLES (v7 schema) ───
    { local: 'leads',              remote: 'leads' },
    { local: 'projects',           remote: 'projects' },
    { local: 'projectTasks',       remote: 'project_tasks' },
    { local: 'projectMilestones',  remote: 'project_milestones' },
    { local: 'departmentReports',  remote: 'department_reports' },
    { local: 'qaReviews',          remote: 'qa_reviews' },
    { local: 'notifications',      remote: 'notifications' },
    { local: 'auditLogs',          remote: 'audit_logs' }
    // sessionTokens intentionally excluded from sync (security)
  ];

  window.KwezaSupabase = {
    getConfig,
    getHeaders,
    sbFetch,
    pullTable,
    upsertRecord,
    deleteRecord,
    SYNC_TABLES
  };
})();
