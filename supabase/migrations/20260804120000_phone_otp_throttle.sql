-- Phone OTP throttle + ensure_trial_driver phone-aware company names.
-- Pattern matches Detours Fleet request_otp_throttle (anon-callable SECURITY DEFINER).

create table if not exists public.otp_throttle (
  phone text primary key,
  last_sent_at timestamptz not null default now(),
  hourly_count int not null default 0,
  daily_count int not null default 0,
  hour_window_start timestamptz not null default now(),
  day_window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.otp_throttle enable row level security;
-- Deny-all direct access: RLS on, zero policies. Only SECURITY DEFINER RPC writes.

create or replace function public.request_otp_throttle(p_phone text)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $$
declare
  rec    public.otp_throttle;
  now_ts timestamptz := now();
begin
  -- Fuel Dip: NANP +1 only (Canada / US).
  if p_phone is null or not p_phone ~ '^\+1\d{10}$' then
    raise exception 'invalid phone'
      using errcode = 'P0001',
            hint = 'Enter a valid Canada / US phone number (+1).';
  end if;

  select * into rec from public.otp_throttle where phone = p_phone for update;

  if rec is null then
    insert into public.otp_throttle (phone, last_sent_at, hour_window_start, day_window_start)
    values (p_phone, now_ts, now_ts, now_ts);
    return;
  end if;

  if rec.last_sent_at > now_ts - interval '60 seconds' then
    raise exception 'otp_cooldown'
      using errcode = 'P0001',
            hint = 'Please wait a moment before requesting another code.';
  end if;

  if rec.hour_window_start < now_ts - interval '1 hour' then
    rec.hourly_count := 0;
    rec.hour_window_start := now_ts;
  end if;

  if rec.day_window_start < now_ts - interval '1 day' then
    rec.daily_count := 0;
    rec.day_window_start := now_ts;
  end if;

  if rec.hourly_count >= 5 then
    raise exception 'otp_hourly_limit'
      using errcode = 'P0002',
            hint = 'Too many codes sent. Try again in about an hour.';
  end if;

  if rec.daily_count >= 15 then
    raise exception 'otp_daily_limit'
      using errcode = 'P0003',
            hint = 'Daily limit reached. Try again tomorrow.';
  end if;

  update public.otp_throttle set
    last_sent_at = now_ts,
    hourly_count = rec.hourly_count + 1,
    daily_count = rec.daily_count + 1,
    hour_window_start = rec.hour_window_start,
    day_window_start = rec.day_window_start,
    updated_at = now_ts
  where phone = p_phone;
end;
$$;

revoke all on function public.request_otp_throttle(text) from public;
grant execute on function public.request_otp_throttle(text) to anon, authenticated;

comment on function public.request_otp_throttle(text) is
  'Pre-login OTP throttle (+1 NANP). Anon EXECUTE required before signInWithOtp. Cooldown 60s / 5 per hour / 15 per day.';

-- Phone-first signups have null/empty email; name from phone last-4 or email local-part.
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

  insert into drivers (id, company_id, role)
  values (uid, new_company_id, 'driver');
end;
$$;

revoke all on function public.ensure_trial_driver() from public;
revoke all on function public.ensure_trial_driver() from anon;
grant execute on function public.ensure_trial_driver() to authenticated;

comment on function public.ensure_trial_driver() is
  'First login/signup: provision company (7-day trial) + drivers row. Supports email or phone auth users. No-op if driver exists.';
