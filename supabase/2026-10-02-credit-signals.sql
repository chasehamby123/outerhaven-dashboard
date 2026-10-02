-- Credit signals (HQ → Pipeline → Credit signals): small US public companies that need private credit.
-- Filled by the GitHub job scripts/credit_signals.py (edgartools: XBRL frames + full-text search + submissions)
-- through fund-signals action ingest kind 'credit'; judged by classifyCredit() in supabase/functions/fund-signals/rules.js.
create table if not exists public.credit_signals (
  id uuid primary key default gen_random_uuid(),
  cik text not null unique,
  company_name text not null,
  tickers text,
  exchange text,
  sic text,
  sic_desc text,
  state text,
  period_end date,              -- balance sheet date the numbers come from
  debt_current numeric,         -- debt due within 12 months
  debt_noncurrent numeric,
  cash numeric,
  revenue numeric,              -- latest fiscal year
  public_float numeric,
  flags jsonb not null default '{}',   -- { going_concern: {date,url,form}, forbearance: {date,url,form} }
  filing_url text,              -- latest 10-K / 10-Q
  verdict text not null default 'maybe',
  score smallint not null default 0,
  reasons jsonb not null default '[]',
  rules_version smallint not null default 0,
  status text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  person_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credit_signals_verdict on public.credit_signals (verdict, score desc);
alter table public.credit_signals enable row level security;
create policy credit_signals_read on public.credit_signals for select to authenticated using (public.can_access_dashboard());
create policy credit_signals_write on public.credit_signals for update to authenticated using (public.can_access_dashboard()) with check (public.can_access_dashboard());
grant select on public.credit_signals to authenticated;
grant update (status, person_id, notes, updated_at) on public.credit_signals to authenticated;

-- One row per GitHub ingest call (what ran, how many companies, when).
create table if not exists public.credit_signal_runs (
  id uuid primary key default gen_random_uuid(),
  items integer default 0,
  added integer default 0,
  params jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.credit_signal_runs enable row level security;
create policy credit_signal_runs_read on public.credit_signal_runs for select to authenticated using (public.can_access_dashboard());
grant select on public.credit_signal_runs to authenticated;
