-- interpolate_dip_volume() is trigger-only (called by recompute_dip_volumes).
-- The Jul 29 hardening revoked PUBLIC + anon but left authenticated EXECUTE,
-- so the helper was still callable via /rest/v1/rpc/interpolate_dip_volume.
-- Match recompute_dip_volumes: Data API cannot call it.

revoke execute on function public.interpolate_dip_volume(uuid, numeric) from authenticated;
revoke execute on function public.interpolate_dip_volume(uuid, numeric) from anon;
revoke execute on function public.interpolate_dip_volume(uuid, numeric) from public;

comment on function public.interpolate_dip_volume(uuid, numeric) is
  'Linear dip-chart interpolation for recompute_dip_volumes(). Not callable via Data API (anon/authenticated EXECUTE revoked Oct 21 2026).';
