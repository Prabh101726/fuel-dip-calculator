-- Direct-to-driver isolation: each driver only sees their own row and calcs.
-- Previously SELECT was company-scoped (safe only while 1 driver = 1 company).

drop policy if exists "drivers read own company" on drivers;
create policy "drivers read own"
  on drivers for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "dip_calculations read own company" on dip_calculations;
create policy "dip_calculations read own"
  on dip_calculations for select to authenticated
  using (driver_id = (select auth.uid()));

-- Writes already require driver_id = auth.uid(); tighten to (select auth.uid())
-- for initplan performance while recreating.
drop policy if exists "dip_calculations insert own" on dip_calculations;
create policy "dip_calculations insert own"
  on dip_calculations for insert to authenticated
  with check (
    company_id = my_company_id()
    and driver_id = (select auth.uid())
    and my_trial_active()
  );

drop policy if exists "dip_calculations update own" on dip_calculations;
create policy "dip_calculations update own"
  on dip_calculations for update to authenticated
  using (
    company_id = my_company_id()
    and driver_id = (select auth.uid())
    and my_trial_active()
  );

comment on policy "drivers read own" on drivers is
  'Driver may only SELECT their own drivers row (no peer sharing).';
comment on policy "dip_calculations read own" on dip_calculations is
  'Driver may only SELECT their own calculations (no peer sharing).';
