-- Hard data checks for fund signals (scripts/fund_signals.py modes selftest / audit, also run by the daily job).
-- selftest: known cases checked against live SEC data (fails the GitHub run if any is wrong).
-- audit: every list row re-verified against the SEC's own filing index (newest amendment used, missing ones fixed).
create table if not exists public.fund_data_checks (
  id uuid primary key default gen_random_uuid(),
  kind text not null,              -- selftest | audit
  ok boolean not null,
  checked integer default 0,
  stale integer default 0,         -- rows whose numbers were not from the newest amendment
  fixed integer default 0,
  errors integer default 0,
  failures jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.fund_data_checks enable row level security;
create policy fund_data_checks_read on public.fund_data_checks for select to authenticated using (public.can_access_dashboard());
grant select on public.fund_data_checks to authenticated;
