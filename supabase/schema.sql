-- ============================================================
--  KWEZA MIS — SUPABASE SCHEMA v2
--  Full upgraded schema: RBAC + Projects + QA + Leads
--  Run this fresh in Supabase SQL editor
-- ============================================================

-- ─── EXTENSIONS ───────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── SETTINGS ────────────────────────────────────────────────
create table if not exists public.settings (
  "key"   text primary key,
  "value" jsonb not null default '{}'::jsonb
);

-- ─── ROLES ───────────────────────────────────────────────────
-- Each role defines what modules and actions a department can access
create table if not exists public.roles (
  "id"          text primary key,
  "name"        text not null,
  "permissions" jsonb not null default '{}'::jsonb,
  -- permissions shape: { "leads": true, "quotations": true, "invoices": false, ... }
  "createdAt"   timestamptz default now()
);

-- ─── USERS (department accounts) ─────────────────────────────
create table if not exists public.users (
  "id"           text primary key,
  "name"         text not null,
  "department"   text not null,
  "password"     text,                   -- kept for legacy fallback
  "passwordHash" text,                   -- SHA-256 hex of password
  "role"         text not null default 'staff',
  "color"        text,
  "icon"         text,
  "isActive"     boolean default true,
  "createdAt"    timestamptz default now()
);

-- ─── SESSION TOKENS ──────────────────────────────────────────
-- Server-backed sessions created on login
create table if not exists public.session_tokens (
  "id"        bigserial primary key,
  "userId"    text not null references public.users("id") on delete cascade,
  "token"     text not null unique,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default now()
);

-- ─── DEPARTMENTS ─────────────────────────────────────────────
create table if not exists public.departments (
  "id"          text primary key,
  "name"        text not null,
  "code"        text,
  "description" text,
  "color"       text,
  "createdAt"   timestamptz default now()
);

-- ─── EMPLOYEES ───────────────────────────────────────────────
create table if not exists public.employees (
  "id"           bigserial primary key,
  "fullName"     text not null,
  "departmentId" text references public.departments("id") on delete set null,
  "position"     text,
  "email"        text,
  "phone"        text,
  "status"       text default 'active',
  "createdAt"    timestamptz default now()
);

-- ─── CLIENTS ─────────────────────────────────────────────────
create table if not exists public.clients (
  "id"             bigserial primary key,
  "clientCode"     text,
  "name"           text not null,
  "phone"          text,
  "email"          text,
  "company"        text,
  "source"         text,
  "address"        text,
  "leadId"         bigint,               -- FK to leads (set when converted)
  "createdAt"      timestamptz default now(),
  "departmentId"   text,
  "preparedBy"     text,
  "preparedByDept" text
);

-- ─── LEADS ───────────────────────────────────────────────────
-- CRM entry point — before a client is confirmed
create table if not exists public.leads (
  "id"              bigserial primary key,
  "leadCode"        text,
  "name"            text not null,       -- prospect name
  "company"         text,
  "phone"           text,
  "email"           text,
  "source"          text,               -- Referral, Walk-in, Social Media, Website, etc.
  "interest"        text,               -- what service they're interested in
  "status"          text default 'New', -- New | Contacted | Qualified | Converted | Lost
  "assignedDeptId"  text references public.departments("id") on delete set null,
  "assignedTo"      text,               -- user id
  "clientId"        bigint,             -- set when converted to client
  "followUpDate"    timestamptz,
  "lostReason"      text,
  "notes"           text,
  "createdAt"       timestamptz default now(),
  "convertedAt"     timestamptz,
  "departmentId"    text,               -- which dept created this lead
  "preparedBy"      text
);

-- ─── SERVICE REQUESTS ────────────────────────────────────────
create table if not exists public.service_requests (
  "id"           bigserial primary key,
  "requestCode"  text,
  "clientId"     bigint,
  "departmentId" text,
  "service"      text not null,
  "description"  text,
  "status"       text default 'Pending',
  "createdAt"    timestamptz default now()
);

-- ─── SALES ───────────────────────────────────────────────────
create table if not exists public.sales (
  "id"                   bigserial primary key,
  "saleCode"             text,
  "requestId"            bigint,
  "clientId"             bigint,
  "leadId"               bigint,
  "service"              text not null,
  "total"                numeric default 0,
  "status"               text default 'Open',
  "assignedDepartmentId" text,
  "createdAt"            timestamptz default now()
);

-- ─── CATALOG ─────────────────────────────────────────────────
create table if not exists public.catalog (
  "id"           bigserial primary key,
  "name"         text not null,
  "category"     text,
  "price"        numeric default 0,
  "description"  text,
  "unit"         text,
  "departmentId" text
);

-- ─── QUOTATIONS ──────────────────────────────────────────────
create table if not exists public.quotations (
  "id"             bigserial primary key,
  "clientId"       bigint,
  "saleId"         bigint,
  "number"         text,
  "date"           timestamptz,
  "validityDays"   integer,
  "status"         text,               -- draft | pending | approved | rejected | converted
  "subtotal"       numeric default 0,
  "discount"       numeric default 0,
  "tax"            numeric default 0,
  "total"          numeric default 0,
  "currency"       text,
  "notes"          text,
  "approvedBy"     text,
  "approvedAt"     timestamptz,
  "departmentId"   text,
  "preparedBy"     text,
  "preparedByDept" text
);

-- ─── INVOICES ────────────────────────────────────────────────
create table if not exists public.invoices (
  "id"             bigserial primary key,
  "quotationId"    bigint,
  "clientId"       bigint,
  "saleId"         bigint,
  "projectId"      bigint,             -- set after payment creates project
  "number"         text,
  "date"           timestamptz,
  "dueDate"        timestamptz,
  "status"         text,               -- unpaid | partial | paid | project_created
  "subtotal"       numeric default 0,
  "discount"       numeric default 0,
  "tax"            numeric default 0,
  "total"          numeric default 0,
  "currency"       text,
  "notes"          text,
  "departmentId"   text,
  "preparedBy"     text,
  "preparedByDept" text
);

-- ─── LINE ITEMS ───────────────────────────────────────────────
create table if not exists public.line_items (
  "id"          bigserial primary key,
  "docType"     text not null,
  "docId"       bigint not null,
  "description" text,
  "rate"        numeric default 0,
  "qty"         numeric default 1,
  "discount"    numeric default 0,
  "amount"      numeric default 0,
  "catalogId"   bigint
);

-- ─── PAYMENTS ────────────────────────────────────────────────
create table if not exists public.payments (
  "id"        bigserial primary key,
  "invoiceId" bigint,
  "date"      timestamptz default now(),
  "amount"    numeric default 0,
  "method"    text,
  "notes"     text,
  "recordedBy" text
);

-- ─── PROJECTS ────────────────────────────────────────────────
-- Created automatically when an invoice is fully or partially paid
create table if not exists public.projects (
  "id"              bigserial primary key,
  "projectCode"     text,
  "invoiceId"       bigint references public.invoices("id") on delete set null,
  "clientId"        bigint references public.clients("id") on delete set null,
  "saleId"          bigint,
  "name"            text not null,
  "description"     text,
  "departmentId"    text,             -- primary responsible dept
  "status"          text default 'Pending',
  -- Pending | Active | In Progress | QA | Revision | Completed | Closed
  "priority"        text default 'Normal', -- Low | Normal | High | Critical
  "startDate"       timestamptz,
  "dueDate"         timestamptz,
  "completedAt"     timestamptz,
  "qaApprovedAt"    timestamptz,
  "qaApprovedBy"    text,
  "lockedAt"        timestamptz,      -- set when QA approved + reports done
  "createdAt"       timestamptz default now(),
  "createdBy"       text
);

-- ─── PROJECT TASKS ────────────────────────────────────────────
create table if not exists public.project_tasks (
  "id"           bigserial primary key,
  "taskCode"     text,
  "projectId"    bigint not null references public.projects("id") on delete cascade,
  "departmentId" text,               -- which dept owns this task
  "assignedTo"   text,               -- user id
  "task"         text not null,
  "status"       text default 'Pending',
  -- Pending | In Progress | Blocked | Testing | Done
  "priority"     text default 'Normal',
  "dueDate"      timestamptz,
  "completedAt"  timestamptz,
  "createdAt"    timestamptz default now()
);

-- ─── PROJECT MILESTONES ───────────────────────────────────────
create table if not exists public.project_milestones (
  "id"          bigserial primary key,
  "projectId"   bigint not null references public.projects("id") on delete cascade,
  "title"       text not null,
  "description" text,
  "dueDate"     timestamptz,
  "completedAt" timestamptz,
  "status"      text default 'Pending', -- Pending | Done | Missed
  "createdAt"   timestamptz default now()
);

-- ─── OPERATION TASKS (legacy — keep for existing data) ───────
create table if not exists public.operation_tasks (
  "id"           bigserial primary key,
  "taskCode"     text,
  "saleId"       bigint not null,
  "projectId"    bigint,            -- backfill link to project when available
  "departmentId" text,
  "task"         text not null,
  "status"       text default 'Pending',
  "createdAt"    timestamptz default now()
);

-- ─── DEPARTMENT REPORTS (formerly project_reports) ────────────
create table if not exists public.department_reports (
  "id"           bigserial primary key,
  "reportCode"   text,
  "departmentId" text,
  "projectId"    bigint references public.projects("id") on delete set null,
  "saleId"       bigint,            -- legacy fallback
  "invoiceId"    bigint,
  "taskId"       bigint,
  "type"         text not null,     -- Daily | Weekly | Issue | Completion
  "description"  text,
  "status"       text default 'Open', -- Open | Reviewed | Approved
  "attachments"  text,             -- comma-separated URLs or base64
  "date"         timestamptz default now(),
  "submittedBy"  text
);

-- ─── PROJECT REPORTS (legacy table — keep for sync) ──────────
create table if not exists public.project_reports (
  "id"           bigserial primary key,
  "reportCode"   text,
  "departmentId" text,
  "saleId"       bigint not null,
  "invoiceId"    bigint,
  "taskId"       bigint,
  "type"         text not null,
  "description"  text,
  "status"       text default 'Open',
  "date"         timestamptz default now()
);

-- ─── QA REVIEWS ──────────────────────────────────────────────
create table if not exists public.qa_reviews (
  "id"          bigserial primary key,
  "projectId"   bigint not null references public.projects("id") on delete cascade,
  "reviewerId"  text not null,      -- user id of reviewer
  "reviewerDept" text,
  "result"      text not null,      -- pass | fail | conditional
  "score"       integer,            -- optional 1–10
  "notes"       text,
  "checklist"   jsonb,              -- { "docs_complete": true, "client_signed": false, ... }
  "createdAt"   timestamptz default now(),
  "resolvedAt"  timestamptz        -- when a failed review was addressed
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
create table if not exists public.notifications (
  "id"        bigserial primary key,
  "userId"    text,               -- null = broadcast to all
  "deptId"    text,               -- null = not dept-scoped
  "type"      text,               -- info | warning | action | approval
  "title"     text,
  "message"   text not null,
  "isRead"    boolean default false,
  "refId"     bigint,
  "refType"   text,               -- project | invoice | lead | task | qa_review
  "createdAt" timestamptz default now()
);

-- ─── AUDIT LOGS ──────────────────────────────────────────────
create table if not exists public.audit_logs (
  "id"         bigserial primary key,
  "userId"     text,
  "userDept"   text,
  "action"     text not null,     -- create | update | delete | login | logout | approve | reject
  "tableName"  text,
  "recordId"   text,
  "diff"       jsonb,             -- { before: {}, after: {} }
  "ip"         text,
  "createdAt"  timestamptz default now()
);

-- ─── LOANS ───────────────────────────────────────────────────
create table if not exists public.loans (
  "id"           bigserial primary key,
  "clientId"     bigint,
  "amount"       numeric default 0,
  "balance"      numeric default 0,
  "date"         timestamptz default now(),
  "dueDate"      timestamptz,
  "status"       text default 'active',
  "description"  text,
  "interestRate" numeric default 0,
  "departmentId" text
);

-- ─── INSTALLMENTS ────────────────────────────────────────────
create table if not exists public.installments (
  "id"       bigserial primary key,
  "loanId"   bigint,
  "dueDate"  timestamptz,
  "amount"   numeric default 0,
  "paid"     boolean default false,
  "paidDate" timestamptz
);

-- ─── ACTIVITY LOG ────────────────────────────────────────────
create table if not exists public.activity (
  "id"          bigserial primary key,
  "type"        text,
  "description" text,
  "amount"      numeric default 0,
  "date"        timestamptz default now(),
  "refId"       bigint,
  "refType"     text
);

-- ============================================================
--  DEFAULT ROLE DEFINITIONS
-- ============================================================
insert into public.roles ("id", "name", "permissions") values
  ('admin', 'Administrator', '{"leads":true,"clients":true,"requests":true,"sales":true,"catalog":true,"quotations":true,"invoices":true,"payments":true,"projects":true,"operations":true,"reports":true,"qa":true,"organization":true,"settings":true,"loans":true}'),
  ('finance', 'Finance', '{"leads":false,"clients":true,"requests":false,"sales":false,"catalog":false,"quotations":true,"invoices":true,"payments":true,"projects":false,"operations":false,"reports":true,"qa":false,"organization":false,"settings":false,"loans":true}'),
  ('sales', 'Sales', '{"leads":true,"clients":true,"requests":true,"sales":true,"catalog":true,"quotations":true,"invoices":false,"payments":false,"projects":false,"operations":false,"reports":false,"qa":false,"organization":false,"settings":false,"loans":false}'),
  ('ict', 'ICT', '{"leads":false,"clients":false,"requests":false,"sales":false,"catalog":false,"quotations":false,"invoices":false,"payments":false,"projects":true,"operations":true,"reports":true,"qa":false,"organization":false,"settings":false,"loans":false}'),
  ('operations', 'Operations', '{"leads":false,"clients":false,"requests":false,"sales":false,"catalog":false,"quotations":false,"invoices":false,"payments":false,"projects":true,"operations":true,"reports":true,"qa":false,"organization":false,"settings":false,"loans":false}'),
  ('design', 'Design', '{"leads":false,"clients":false,"requests":false,"sales":false,"catalog":true,"quotations":false,"invoices":false,"payments":false,"projects":true,"operations":true,"reports":true,"qa":false,"organization":false,"settings":false,"loans":false}'),
  ('marketing', 'Marketing', '{"leads":true,"clients":true,"requests":true,"sales":false,"catalog":false,"quotations":false,"invoices":false,"payments":false,"projects":false,"operations":false,"reports":false,"qa":false,"organization":false,"settings":false,"loans":false}'),
  ('business-development', 'Business Development', '{"leads":true,"clients":true,"requests":true,"sales":true,"catalog":false,"quotations":true,"invoices":false,"payments":false,"projects":false,"operations":false,"reports":false,"qa":false,"organization":false,"settings":false,"loans":false}'),
  ('administration', 'Administration', '{"leads":true,"clients":true,"requests":true,"sales":true,"catalog":false,"quotations":true,"invoices":true,"payments":false,"projects":true,"operations":false,"reports":true,"qa":true,"organization":true,"settings":false,"loans":false}'),
  ('sales-operations', 'Sales Operations', '{"leads":true,"clients":true,"requests":true,"sales":true,"catalog":true,"quotations":true,"invoices":true,"payments":false,"projects":true,"operations":true,"reports":true,"qa":false,"organization":false,"settings":false,"loans":false}'),
  ('staff', 'Staff', '{"leads":false,"clients":false,"requests":true,"sales":false,"catalog":false,"quotations":false,"invoices":false,"payments":false,"projects":false,"operations":false,"reports":false,"qa":false,"organization":false,"settings":false,"loans":false}')
on conflict ("id") do update set
  "name" = excluded."name",
  "permissions" = excluded."permissions";

-- ============================================================
--  ROW LEVEL SECURITY
--  Using anon key — policies allow all access for now
--  (upgrade to Supabase Auth JWT for full enforcement)
-- ============================================================
alter table public.settings           enable row level security;
alter table public.roles              enable row level security;
alter table public.users              enable row level security;
alter table public.session_tokens     enable row level security;
alter table public.departments        enable row level security;
alter table public.employees          enable row level security;
alter table public.clients            enable row level security;
alter table public.leads              enable row level security;
alter table public.service_requests   enable row level security;
alter table public.sales              enable row level security;
alter table public.catalog            enable row level security;
alter table public.quotations         enable row level security;
alter table public.invoices           enable row level security;
alter table public.line_items         enable row level security;
alter table public.payments           enable row level security;
alter table public.projects           enable row level security;
alter table public.project_tasks      enable row level security;
alter table public.project_milestones enable row level security;
alter table public.operation_tasks    enable row level security;
alter table public.department_reports enable row level security;
alter table public.project_reports    enable row level security;
alter table public.qa_reviews         enable row level security;
alter table public.notifications      enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.loans              enable row level security;
alter table public.installments       enable row level security;
alter table public.activity           enable row level security;

-- Allow full anon access (app uses anon key with dept-level filtering in JS)
-- These policies give the anon key read/write to all rows.
-- ICT scoping is enforced in application logic (getDeptScoped).
do $$
declare
  tbl text;
  tables text[] := array[
    'settings','roles','users','session_tokens','departments','employees',
    'clients','leads','service_requests','sales','catalog','quotations',
    'invoices','line_items','payments','projects','project_tasks',
    'project_milestones','operation_tasks','department_reports',
    'project_reports','qa_reviews','notifications','audit_logs',
    'loans','installments','activity'
  ];
begin
  foreach tbl in array tables loop
    execute format('
      drop policy if exists "anon_all" on public.%I;
      create policy "anon_all" on public.%I for all to anon using (true) with check (true);
    ', tbl, tbl);
  end loop;
end $$;
