-- Defense-in-depth against direct /auth/v1/otp SMS-pumping bots:
-- 1. Tighten request_otp_throttle() to strict NANP (+1[2-9]XX[2-9]XXXXXX).
-- 2. BEFORE INSERT OR UPDATE trigger on auth.users that:
--    a) rejects any non-NANP phone before GoTrue can call Twilio, and
--    b) requires a fresh (<30s) public.otp_throttle entry on INSERT (which runs
--       in GoTrue SignupNewUser BEFORE sendPhoneConfirmation / Twilio) and on
--       confirmation_sent_at UPDATE (+ 55s cooldown gap), blocking direct
--       /auth/v1/otp calls that skip request_otp_throttle().

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
  -- Fuel Dip: strict NANP +1 only (Canada / US).
  if p_phone is null or not p_phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$' then
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

create or replace function public.enforce_auth_users_nanp_otp()
returns trigger
language plpgsql
security definer
set search_path to public, pg_temp
as $$
declare
  v_digits text;
begin
  if new.phone is not null then
    v_digits := regexp_replace(new.phone, '\D', '', 'g');

    if v_digits !~ '^1[2-9][0-9]{2}[2-9][0-9]{6}$' then
      raise exception 'Only Canada / US (+1) phone numbers are allowed.'
        using errcode = 'P0001';
    end if;

    if tg_op = 'INSERT'
       or (new.confirmation_sent_at is not null and new.confirmation_sent_at is distinct from old.confirmation_sent_at) then
      if tg_op = 'UPDATE'
         and old.confirmation_sent_at is not null
         and new.confirmation_sent_at < old.confirmation_sent_at + interval '55 seconds' then
        raise exception 'otp_cooldown'
          using errcode = 'P0001',
                hint = 'Please wait a moment before requesting another code.';
      end if;

      if not exists (
        select 1
        from public.otp_throttle t
        where t.phone = '+' || v_digits
          and t.last_sent_at >= now() - interval '30 seconds'
      ) then
        raise exception 'otp_throttle_required'
          using errcode = 'P0001',
                hint = 'Please request a verification code from the sign-in screen.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_auth_users_nanp_otp() from public, anon, authenticated;
grant execute on function public.enforce_auth_users_nanp_otp() to postgres, supabase_auth_admin;

drop trigger if exists enforce_auth_users_nanp_otp_trg on auth.users;
create trigger enforce_auth_users_nanp_otp_trg
  before insert or update of phone, confirmation_sent_at
  on auth.users
  for each row
  execute function public.enforce_auth_users_nanp_otp();
