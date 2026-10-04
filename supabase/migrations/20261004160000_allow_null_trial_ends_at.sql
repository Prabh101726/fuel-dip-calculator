-- Null trial_ends_at means access-forever (matches my_access_active /
-- client isAccessActive). Original NOT NULL blocked that path; keep
-- DEFAULT for new companies.
alter table public.companies
  alter column trial_ends_at drop not null;

comment on column public.companies.trial_ends_at is
  'Trial end. Null = access forever. New companies default to now() + 7 days.';
