-- Security hardenings (Jul 26 audit): H1 trial RLS + H2 store-both volume recompute.

-- ---------------------------------------------------------------------------
-- H1: my_trial_active() + recreate write policies
-- Null trial_ends_at = active (matches middleware). Forward-compatible with
-- Stripe: later becomes trial active OR subscription_active.
-- ---------------------------------------------------------------------------

create or replace function my_trial_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select trial_ends_at > now()
      from companies
      where id = public.my_company_id()
    ),
    true
  );
$$;

revoke all on function my_trial_active() from public;
revoke all on function my_trial_active() from anon;
grant execute on function my_trial_active() to authenticated;

comment on function my_trial_active() is
  'True when caller company trial has not ended (null trial_ends_at = active). Used in dip_calculations write RLS.';

drop policy if exists "dip_calculations insert own" on dip_calculations;
create policy "dip_calculations insert own"
  on dip_calculations for insert to authenticated
  with check (
    company_id = my_company_id()
    and driver_id = auth.uid()
    and my_trial_active()
  );

drop policy if exists "dip_calculations update own" on dip_calculations;
create policy "dip_calculations update own"
  on dip_calculations for update to authenticated
  using (
    company_id = my_company_id()
    and driver_id = auth.uid()
    and my_trial_active()
  );

-- SELECT policy unchanged — expired trials keep read access to own rows.

-- ---------------------------------------------------------------------------
-- H2: server_* columns + volume_mismatch + BEFORE INSERT OR UPDATE trigger
-- Store-both: never RAISE; client columns kept; mismatch flagged for audit.
-- ---------------------------------------------------------------------------

alter table dip_calculations
  add column if not exists server_safe_fill_liters numeric,
  add column if not exists server_before_volume_liters numeric,
  add column if not exists server_after_volume_liters numeric,
  add column if not exists volume_mismatch boolean not null default false;

create index if not exists dip_calculations_volume_mismatch_idx
  on dip_calculations (id)
  where volume_mismatch;

comment on column dip_calculations.server_safe_fill_liters is
  'Server recompute of #1 safe fill (capacity * safe_fill_pct).';
comment on column dip_calculations.server_before_volume_liters is
  'Server recompute of #2 before volume via chart interpolation.';
comment on column dip_calculations.server_after_volume_liters is
  'Server recompute of #5 after volume via chart interpolation (null if no after dip).';
comment on column dip_calculations.volume_mismatch is
  'True when client volumes diverge from server recompute by > 0.5 L or dip is out of chart range.';

-- Linear interpolation helper: exact / between / out-of-range → null (no extrapolate).
-- Mirrors lib/dip-calculator/interpolate.ts.
create or replace function interpolate_dip_volume(
  p_tank_type_id uuid,
  p_dip_cm numeric
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min_cm numeric;
  v_max_cm numeric;
  v_exact numeric;
  v_lower_cm numeric;
  v_lower_vol numeric;
  v_upper_cm numeric;
  v_upper_vol numeric;
  v_ratio numeric;
begin
  if p_dip_cm is null then
    return null;
  end if;

  select min(dip_cm), max(dip_cm)
    into v_min_cm, v_max_cm
  from dip_chart_points
  where tank_type_id = p_tank_type_id;

  if v_min_cm is null or v_max_cm is null then
    return null;
  end if;

  if p_dip_cm < v_min_cm or p_dip_cm > v_max_cm then
    return null;
  end if;

  select volume_liters
    into v_exact
  from dip_chart_points
  where tank_type_id = p_tank_type_id
    and dip_cm = p_dip_cm
  limit 1;

  if v_exact is not null then
    return v_exact;
  end if;

  select dip_cm, volume_liters
    into v_lower_cm, v_lower_vol
  from dip_chart_points
  where tank_type_id = p_tank_type_id
    and dip_cm < p_dip_cm
  order by dip_cm desc
  limit 1;

  select dip_cm, volume_liters
    into v_upper_cm, v_upper_vol
  from dip_chart_points
  where tank_type_id = p_tank_type_id
    and dip_cm > p_dip_cm
  order by dip_cm asc
  limit 1;

  if v_lower_cm is null or v_upper_cm is null or v_upper_cm = v_lower_cm then
    return null;
  end if;

  v_ratio := (p_dip_cm - v_lower_cm) / (v_upper_cm - v_lower_cm);
  return v_lower_vol + v_ratio * (v_upper_vol - v_lower_vol);
end;
$$;

revoke all on function interpolate_dip_volume(uuid, numeric) from public;
revoke all on function interpolate_dip_volume(uuid, numeric) from anon;
-- Trigger runs as table owner / security definer helper; no grant to authenticated needed.

create or replace function recompute_dip_volumes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity numeric;
  v_tol numeric := 0.5;
  v_mismatch boolean := false;
  v_server_tank_will_hold numeric;
  v_server_receipt numeric;
  v_server_diff numeric;
begin
  select capacity_liters
    into v_capacity
  from tank_types
  where id = new.tank_type_id;

  if v_capacity is not null and new.safe_fill_pct is not null then
    new.server_safe_fill_liters := v_capacity * new.safe_fill_pct;
  else
    new.server_safe_fill_liters := null;
  end if;

  new.server_before_volume_liters :=
    interpolate_dip_volume(new.tank_type_id, new.before_dip_cm);

  if new.after_dip_cm is null then
    new.server_after_volume_liters := null;
  else
    new.server_after_volume_liters :=
      interpolate_dip_volume(new.tank_type_id, new.after_dip_cm);
  end if;

  -- Safe fill (#1)
  if new.server_safe_fill_liters is null then
    v_mismatch := true;
  elsif abs(new.safe_fill_liters - new.server_safe_fill_liters) > v_tol then
    v_mismatch := true;
  end if;

  -- Before volume (#2): present dip that can't be recomputed, or diverges
  if new.server_before_volume_liters is null then
    v_mismatch := true;
  elsif abs(new.before_volume_liters - new.server_before_volume_liters) > v_tol then
    v_mismatch := true;
  end if;

  -- #3 tank will hold (derived)
  if new.server_safe_fill_liters is not null
     and new.server_before_volume_liters is not null then
    v_server_tank_will_hold :=
      new.server_safe_fill_liters - new.server_before_volume_liters;
    if abs(new.tank_will_hold_liters - v_server_tank_will_hold) > v_tol then
      v_mismatch := true;
    end if;
  end if;

  -- After side: only when after_dip_cm is present (null after is not a mismatch)
  if new.after_dip_cm is not null then
    if new.server_after_volume_liters is null then
      v_mismatch := true;
    elsif new.after_volume_liters is not null
      and abs(new.after_volume_liters - new.server_after_volume_liters) > v_tol then
      v_mismatch := true;
    end if;

    if new.server_after_volume_liters is not null
       and new.server_before_volume_liters is not null then
      v_server_receipt :=
        new.server_after_volume_liters - new.server_before_volume_liters;
      if new.receipt_volume_liters is not null
         and abs(new.receipt_volume_liters - v_server_receipt) > v_tol then
        v_mismatch := true;
      end if;

      v_server_diff := v_server_receipt - new.planned_delivery_liters;
      if new.volume_difference_liters is not null
         and abs(new.volume_difference_liters - v_server_diff) > v_tol then
        v_mismatch := true;
      end if;
    end if;
  end if;

  new.volume_mismatch := v_mismatch;
  return new;
end;
$$;

drop trigger if exists trg_recompute_dip_volumes on dip_calculations;
create trigger trg_recompute_dip_volumes
  before insert or update on dip_calculations
  for each row
  execute function recompute_dip_volumes();

comment on function recompute_dip_volumes() is
  'Store-both: fills server_* volumes and volume_mismatch; never blocks the write.';
