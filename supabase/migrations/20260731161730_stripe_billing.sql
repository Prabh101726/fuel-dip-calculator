-- Direct-to-driver Stripe billing columns + access RPC.

alter table drivers
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status text,
  add column if not exists subscription_price_id text,
  add column if not exists subscription_current_period_end timestamptz;

create or replace function my_access_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select c.trial_ends_at is null or c.trial_ends_at > now()
        from companies c
        where c.id = public.my_company_id()
      ),
      true
    )
    or coalesce(
      (
        select d.subscription_status in ('active', 'trialing', 'past_due')
        from drivers d
        where d.id = (select auth.uid())
      ),
      false
    );
$$;

revoke all on function my_access_active() from public;
revoke all on function my_access_active() from anon;
grant execute on function my_access_active() to authenticated;

comment on function my_access_active() is
  'True when shell-company trial is open OR calling driver has active/trialing/past_due Stripe subscription.';

-- Keep RLS policy name my_trial_active(); semantics become full access check.
create or replace function my_trial_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_access_active();
$$;

comment on function my_trial_active() is
  'Alias of my_access_active() for dip_calculations write RLS.';

comment on column drivers.stripe_customer_id is
  'Stripe Customer id (cus_…) for this driver.';
comment on column drivers.subscription_status is
  'Stripe subscription.status; null = never subscribed.';
