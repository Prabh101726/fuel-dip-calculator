-- Feedback table + referral columns, RPCs, and unique referral_code backfill.
-- Keep ensure_trial_driver 7-day trial; only add referral_code on insert.

alter table public.drivers
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.drivers (id),
  add column if not exists referral_rewarded_at timestamptz,
  add column if not exists referral_days_granted integer not null default 0;

-- Backfill unique codes for existing rows. Translate 0/1/O/I so the
-- result matches REFERRAL_ALPHABET (no hex 0/1).
update public.drivers d
set referral_code = 'FD' || translate(
  upper(substr(replace(d.id::text, '-', ''), 1, 4)),
  '01OI', '2345'
)
where d.referral_code is null;

-- Collision bump
do $$
declare
  r record;
  n int;
  candidate text;
begin
  for r in select id, referral_code from public.drivers loop
    candidate := r.referral_code;
    n := 0;
    while exists (
      select 1 from public.drivers x
      where x.referral_code = candidate and x.id <> r.id
    ) loop
      n := n + 1;
      candidate := 'FD' || translate(
        upper(substr(md5(r.id::text || n::text), 1, 4)),
        '01OI', '2345'
      );
    end loop;
    update public.drivers set referral_code = candidate where id = r.id;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from public.drivers
    where referral_code is null
       or referral_code !~ '^FD[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$'
  ) then
    raise exception 'invalid referral_code backfill';
  end if;
end $$;

alter table public.drivers
  alter column referral_code set not null;

create unique index if not exists drivers_referral_code_key
  on public.drivers (referral_code);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy feedback_select_own on public.feedback
  for select to authenticated
  using (driver_id = auth.uid());

create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (driver_id = auth.uid());

-- ensure_trial_driver: copy from 20260804120000 except unique referral_code.
create or replace function public.ensure_trial_driver()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  user_phone text;
  company_name text;
  new_company_id uuid;
  v_code text;
  i int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from drivers where id = uid) then
    return;
  end if;

  select u.email, u.phone into user_email, user_phone
  from auth.users u
  where u.id = uid;

  company_name := coalesce(
    nullif(split_part(coalesce(user_email, ''), '@', 1), ''),
    case
      when user_phone is not null and length(regexp_replace(user_phone, '\D', '', 'g')) >= 4
        then 'driver-' || right(regexp_replace(user_phone, '\D', '', 'g'), 4)
      else null
    end,
    'Trial company'
  );

  insert into companies (name, trial_ends_at)
  values (company_name, now() + interval '7 days')
  returning id into new_company_id;

  for i in 1..32 loop
    v_code := 'FD';
    for j in 1..4 loop
      v_code := v_code || substr(
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        1 + floor(random() * 32)::int,
        1
      );
    end loop;
    begin
      insert into drivers (id, company_id, role, referral_code)
      values (uid, new_company_id, 'driver', v_code);
      exit;
    exception
      when unique_violation then
        if i = 32 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke all on function public.ensure_trial_driver() from public;
revoke all on function public.ensure_trial_driver() from anon;
grant execute on function public.ensure_trial_driver() to authenticated;

comment on function public.ensure_trial_driver() is
  'First login/signup: provision company (7-day trial) + drivers row with unique referral_code. Supports email or phone auth users. No-op if driver exists.';

create or replace function public.claim_referral(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  code text;
  referrer uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
  if code is null or length(code) <> 6 or left(code, 2) <> 'FD' then
    return;
  end if;
  if exists (select 1 from drivers where id = uid and referred_by is not null) then
    return;
  end if;
  select id into referrer from drivers where referral_code = code;
  if referrer is null or referrer = uid then
    return;
  end if;
  update drivers set referred_by = referrer where id = uid and referred_by is null;
end;
$$;

revoke all on function public.claim_referral(text) from public;
revoke all on function public.claim_referral(text) from anon;
grant execute on function public.claim_referral(text) to authenticated;

-- Claim first (atomic), increment referral_days_granted in the same function.
-- If apply later fails, unclaim_referral_reward rolls both back.
create or replace function public.claim_referral_reward(p_referred uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  update public.drivers
  set referral_rewarded_at = now()
  where id = p_referred
    and referral_rewarded_at is null
    and referred_by is not null
  returning referred_by into v_referrer;

  if v_referrer is null then
    return null;
  end if;

  update public.drivers
  set referral_days_granted = referral_days_granted + 14
  where id = v_referrer;

  return v_referrer;
end;
$$;

create or replace function public.unclaim_referral_reward(p_referred uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  update public.drivers
  set referral_rewarded_at = null
  where id = p_referred
    and referral_rewarded_at is not null
  returning referred_by into v_referrer;

  if v_referrer is not null then
    update public.drivers
    set referral_days_granted = greatest(0, referral_days_granted - 14)
    where id = v_referrer;
  end if;
end;
$$;

revoke all on function public.claim_referral_reward(uuid) from public;
revoke all on function public.claim_referral_reward(uuid) from anon;
revoke all on function public.claim_referral_reward(uuid) from authenticated;
grant execute on function public.claim_referral_reward(uuid) to service_role;

revoke all on function public.unclaim_referral_reward(uuid) from public;
revoke all on function public.unclaim_referral_reward(uuid) from anon;
revoke all on function public.unclaim_referral_reward(uuid) from authenticated;
grant execute on function public.unclaim_referral_reward(uuid) to service_role;

create or replace function public.submit_feedback(p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned text;
  recent int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  cleaned := trim(coalesce(p_body, ''));
  if cleaned = '' then
    raise exception 'Feedback is empty' using errcode = '22023';
  end if;
  if char_length(cleaned) > 2000 then
    raise exception 'Feedback is too long' using errcode = '22023';
  end if;
  if not exists (select 1 from drivers where id = uid) then
    raise exception 'Driver not found';
  end if;
  select count(*) into recent
  from feedback
  where driver_id = uid and created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'Too many feedback messages' using errcode = 'P0001';
  end if;
  insert into feedback (driver_id, body) values (uid, cleaned);
end;
$$;

revoke all on function public.submit_feedback(text) from public;
revoke all on function public.submit_feedback(text) from anon;
grant execute on function public.submit_feedback(text) to authenticated;
