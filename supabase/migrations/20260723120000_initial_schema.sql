-- Company-private data
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references companies (id) on delete restrict,
  role text not null default 'driver' check (role in ('driver', 'admin')),
  created_at timestamptz not null default now()
);

-- Shared reference data (not tenant-scoped)
create table tank_types (
  id uuid primary key default gen_random_uuid(),
  chart_number text not null unique,
  manufacturer text not null,
  capacity_liters numeric not null,
  created_at timestamptz not null default now()
);

create table dip_chart_points (
  id uuid primary key default gen_random_uuid(),
  tank_type_id uuid not null references tank_types (id) on delete cascade,
  dip_cm numeric not null,
  volume_liters numeric not null,
  unique (tank_type_id, dip_cm)
);

-- Company-private data (mirrors the paper "Safe Discharge Sheet" #1-#7 fields)
create table dip_calculations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete restrict,
  driver_id uuid not null references drivers (id) on delete restrict,
  tank_type_id uuid not null references tank_types (id) on delete restrict,
  location_label text,
  safe_fill_pct numeric not null check (safe_fill_pct in (0.90, 0.95)),
  product_grade text,
  compartment_no text,
  safe_fill_liters numeric not null, -- #1
  before_dip_cm numeric not null,
  before_volume_liters numeric not null, -- #2
  tank_will_hold_liters numeric not null, -- #3
  planned_delivery_liters numeric not null, -- #4
  after_dip_cm numeric,
  after_volume_liters numeric, -- #5
  receipt_volume_liters numeric, -- #6
  volume_difference_liters numeric, -- #7
  diverted_to text,
  new_bol_no text,
  liters_retained numeric,
  driver_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Returns the calling user's company_id. security definer so RLS policies on
-- `drivers` itself don't recurse when this function reads from `drivers`.
create or replace function my_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from drivers where id = auth.uid();
$$;

alter table companies enable row level security;
alter table drivers enable row level security;
alter table tank_types enable row level security;
alter table dip_chart_points enable row level security;
alter table dip_calculations enable row level security;

-- Shared catalog: any authenticated user can read; only service_role (bypasses
-- RLS) can write, via the seed script.
create policy "tank_types readable by authenticated"
  on tank_types for select to authenticated using (true);

create policy "dip_chart_points readable by authenticated"
  on dip_chart_points for select to authenticated using (true);

-- Company-private data, scoped by my_company_id()
create policy "companies read own"
  on companies for select to authenticated using (id = my_company_id());

create policy "drivers read own company"
  on drivers for select to authenticated using (company_id = my_company_id());

create policy "dip_calculations read own company"
  on dip_calculations for select to authenticated using (company_id = my_company_id());

create policy "dip_calculations insert own"
  on dip_calculations for insert to authenticated
  with check (company_id = my_company_id() and driver_id = auth.uid());

create policy "dip_calculations update own"
  on dip_calculations for update to authenticated
  using (company_id = my_company_id() and driver_id = auth.uid());
