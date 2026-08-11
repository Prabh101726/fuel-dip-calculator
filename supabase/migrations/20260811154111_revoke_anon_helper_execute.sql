-- Harden SECURITY DEFINER surface:
-- - my_company_id(): used in RLS for authenticated only — revoke anon
-- - recompute_dip_volumes(): trigger-only — revoke anon + authenticated RPC access
-- Keep request_otp_throttle() executable by anon (pre-login phone OTP).

revoke execute on function public.my_company_id() from anon;
revoke execute on function public.my_company_id() from public;

revoke execute on function public.recompute_dip_volumes() from anon;
revoke execute on function public.recompute_dip_volumes() from authenticated;
revoke execute on function public.recompute_dip_volumes() from public;

comment on function public.my_company_id() is
  'Returns auth user company id for RLS. EXECUTE: authenticated only (anon revoked Aug 11 2026).';

comment on function public.recompute_dip_volumes() is
  'BEFORE INSERT/UPDATE trigger on dip_calculations. Not callable via Data API (anon/authenticated EXECUTE revoked Aug 11 2026).';
