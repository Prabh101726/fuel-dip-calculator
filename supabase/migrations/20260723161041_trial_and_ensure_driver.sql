-- 14-day trial clock on companies + first-login auto-provision for magic-link users.

alter table companies
  add column if not exists trial_ends_at timestamptz;

update companies
set trial_ends_at = now() + interval '14 days'
where trial_ends_at is null;

alter table companies
  alter column trial_ends_at set default (now() + interval '14 days');

alter table companies
  alter column trial_ends_at set not null;

-- Creates a trial company + drivers row for the calling auth user if missing.
-- Does NOT reset trial_ends_at when the driver already exists.
create or replace function ensure_trial_driver()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  company_name text;
  new_company_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from drivers where id = uid) then
    return;
  end if;

  select u.email into user_email from auth.users u where u.id = uid;
  company_name := coalesce(nullif(split_part(coalesce(user_email, ''), '@', 1), ''), 'Trial company');

  insert into companies (name, trial_ends_at)
  values (company_name, now() + interval '14 days')
  returning id into new_company_id;

  insert into drivers (id, company_id, role)
  values (uid, new_company_id, 'driver');
end;
$$;

revoke all on function ensure_trial_driver() from public;
revoke all on function ensure_trial_driver() from anon;
grant execute on function ensure_trial_driver() to authenticated;

create or replace function my_trial_ends_at()
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$
  select c.trial_ends_at
  from companies c
  where c.id = public.my_company_id();
$$;

revoke all on function my_trial_ends_at() from public;
revoke all on function my_trial_ends_at() from anon;
grant execute on function my_trial_ends_at() to authenticated;

comment on function ensure_trial_driver() is
  'First magic-link login: provision company (14-day trial) + drivers row. No-op if driver exists.';
comment on function my_trial_ends_at() is
  'Returns the calling user company trial_ends_at for auth gates.';
comment on column companies.trial_ends_at is
  'Trial expiry; access to calculator/history denied after this timestamp.';
