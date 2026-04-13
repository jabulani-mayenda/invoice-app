-- ============================================================
--  KWEZA MIS — SUPABASE SCHEMA
--  Full clean schema — no patch ALTERs, all tables defined here
-- ============================================================

-- ─── SETTINGS ────────────────────────────────────────────────
create table if not exists public.settings (
  "key"   text primary key,
  "value" jsonb not null default '{}'::jsonb
);

-- ─── USERS (department accounts) ─────────────────────────────
create table if not exists public.users (
  "id"         text primary key,
  "name"        text not null,
  "department"  text not null,
  "password"    text not null,
  "role"        text not null default 'staff',
  "color"       text,
  "icon"        text
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
  "createdAt"      timestamptz default now(),
  "departmentId"   text,
  "preparedBy"     text,
  "preparedByDept" text
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
  "status"         text,
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

-- ─── INVOICES ────────────────────────────────────────────────
create table if not exists public.invoices (
  "id"             bigserial primary key,
  "quotationId"    bigint,
  "clientId"       bigint,
  "saleId"         bigint,
  "number"         text,
  "date"           timestamptz,
  "dueDate"        timestamptz,
  "status"         text,
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
  "notes"     text
);

-- ─── OPERATION TASKS ─────────────────────────────────────────
create table if not exists public.operation_tasks (
  "id"           bigserial primary key,
  "taskCode"     text,
  "saleId"       bigint not null,
  "departmentId" text,
  "task"         text not null,
  "status"       text default 'Pending',
  "createdAt"    timestamptz default now()
);

-- ─── PROJECT REPORTS ─────────────────────────────────────────
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

-- ─── ROW LEVEL SECURITY (disabled — anon key used for direct access) ──
alter table public.settings         disable row level security;
alter table public.users            disable row level security;
alter table public.departments      disable row level security;
alter table public.employees        disable row level security;
alter table public.clients          disable row level security;
alter table public.service_requests disable row level security;
alter table public.sales            disable row level security;
alter table public.catalog          disable row level security;
alter table public.quotations       disable row level security;
alter table public.invoices         disable row level security;
alter table public.line_items       disable row level security;
alter table public.payments         disable row level security;
alter table public.operation_tasks  disable row level security;
alter table public.project_reports  disable row level security;
alter table public.loans            disable row level security;
alter table public.installments     disable row level security;
alter table public.activity         disable row level security;
