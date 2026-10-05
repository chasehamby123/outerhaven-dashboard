-- Fund cadence study: how long managers take from Fund I to their next fund, and Fund II to the next, counting renamed funds
-- (same people, any name). Filled by scripts/fund_signals.py --mode study (GitHub workflow mode `study`) through
-- fund-signals ingest kinds study_add / study_check; judged with the same readCheck() as the Fund II check.
create table if not exists public.fund_gap_study (
  id uuid primary key default gen_random_uuid(),
  cohort text not null,                 -- e.g. 'fund1-2019'
  accession text not null unique,
  company_name text not null,
  cik text,
  fund_no smallint not null,
  manager_key text,
  check_keyword text,
  filing_date date,
  offering numeric,
  sold numeric,
  state text,
  executives jsonb not null default '[]',
  status text,                          -- clear | next | unsure | error (null = not checked yet)
  next_name text,
  next_date date,
  next_renamed boolean,
  gap_months numeric,
  later jsonb,
  note text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fund_gap_study_cohort on public.fund_gap_study (cohort, status);
alter table public.fund_gap_study enable row level security;
create policy fund_gap_study_read on public.fund_gap_study for select to authenticated using (public.can_access_dashboard());
grant select on public.fund_gap_study to authenticated;

-- One row per fund number: how many managers raised again, and how fast (months between Form D filings).
create or replace view public.fund_gap_stats with (security_invoker = true) as
select fund_no,
  count(*) filter (where status is not null) checked,
  count(*) filter (where status = 'next') raised_next,
  round(100.0 * count(*) filter (where status = 'next') / nullif(count(*) filter (where status is not null), 0), 1) pct_raised_next,
  count(*) filter (where status = 'next' and next_renamed) renamed,
  round(avg(gap_months) filter (where status = 'next'), 1) avg_months,
  round((percentile_cont(0.25) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) p25_months,
  round((percentile_cont(0.5) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) median_months,
  round((percentile_cont(0.75) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) p75_months,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 24) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_24m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 36) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_36m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 48) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_48m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 60) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_60m
from public.fund_gap_study group by fund_no;
grant select on public.fund_gap_stats to authenticated;

-- Distinct funds started after the scanned one (fund families: amendments, feeders, parallel/-A/-B and series SPVs folded).
alter table public.fund_signals add column if not exists later_count integer;
alter table public.fund_gap_study add column if not exists later_count integer;
create or replace view public.fund_gap_stats with (security_invoker = true) as
select fund_no,
  count(*) filter (where status is not null) checked,
  count(*) filter (where status = 'next') raised_next,
  round(100.0 * count(*) filter (where status = 'next') / nullif(count(*) filter (where status is not null), 0), 1) pct_raised_next,
  count(*) filter (where status = 'next' and next_renamed) renamed,
  round(avg(gap_months) filter (where status = 'next'), 1) avg_months,
  round((percentile_cont(0.25) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) p25_months,
  round((percentile_cont(0.5) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) median_months,
  round((percentile_cont(0.75) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) p75_months,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 24) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_24m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 36) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_36m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 48) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_48m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 60) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_60m,
  round(avg(coalesce(later_count, 0)) filter (where status is not null), 2) avg_funds_since,
  round((percentile_cont(0.5) within group (order by later_count) filter (where status = 'next'))::numeric, 1) median_funds_since_if_raised,
  round(100.0 * count(*) filter (where later_count >= 2) / nullif(count(*) filter (where status is not null), 0), 1) pct_2plus_funds_since
from public.fund_gap_study group by fund_no;
grant select on public.fund_gap_stats to authenticated;

-- Per cohort (v1 cohorts of 5 Oct counted series SPVs and feeders as funds; use the -v2 ones).
create or replace view public.fund_gap_stats_by_cohort with (security_invoker = true) as
select cohort, fund_no,
  count(*) filter (where status is not null) checked,
  round(100.0 * count(*) filter (where status = 'next') / nullif(count(*) filter (where status is not null), 0), 1) pct_raised_next,
  round(100.0 * count(*) filter (where status = 'next' and next_renamed) / nullif(count(*) filter (where status = 'next'), 0), 1) pct_next_renamed,
  round(avg(gap_months) filter (where status = 'next'), 1) avg_months,
  round((percentile_cont(0.25) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) p25_months,
  round((percentile_cont(0.5) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) median_months,
  round((percentile_cont(0.75) within group (order by gap_months) filter (where status = 'next'))::numeric, 1) p75_months,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 24) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_24m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 36) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_36m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 48) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_48m,
  round(100.0 * count(*) filter (where status = 'next' and gap_months <= 60) / nullif(count(*) filter (where status is not null), 0), 1) pct_within_60m,
  round(avg(coalesce(later_count, 0)) filter (where status is not null), 2) avg_funds_since,
  round(100.0 * count(*) filter (where later_count >= 2) / nullif(count(*) filter (where status is not null), 0), 1) pct_2plus_funds_since
from public.fund_gap_study group by cohort, fund_no;
grant select on public.fund_gap_stats_by_cohort to authenticated;
