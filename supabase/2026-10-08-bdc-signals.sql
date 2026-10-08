-- BDC loans (HQ → Pipeline → BDC loans): private companies that borrow from BDCs, from the SEC's BDC data sets (every BDC's
-- schedule of investments, XBRL, monthly). Filled by scripts/bdc_signals.py (GitHub workflow mode `bdc`, also in daily), posted to
-- edge function bdc-signals (ingest kind 'bdc' / 'bdc_done'), judged by classifyBdc() in supabase/functions/bdc-signals/rules.js.
-- One row per borrower (normalised name across BDCs); numbers refresh every run, status / person / notes / marks stay.
create table if not exists public.bdc_signals (
  id uuid primary key default gen_random_uuid(),
  company_key text not null unique,      -- normalised name (no legal suffix, no Buyer / Midco / Holdings)
  company_name text not null,
  industry text,
  country text,                          -- non-US country named in the holding, else null
  facility numeric,                      -- principal held by all BDCs together (a floor: lenders also hold pieces off-BDC)
  fair numeric,                          -- BDCs' fair value of that debt
  mark numeric,                          -- fair / principal, % of par
  prev_mark numeric,                     -- same, one quarter earlier
  maturity date,                         -- maturity of the largest tranche
  earliest_maturity date,                -- earliest maturity among tranches >= 20% of the facility
  spread numeric,                        -- principal-weighted spread over the base rate, %
  pik boolean not null default false,
  nonaccrual boolean not null default false,
  controlled boolean not null default false,
  affiliated boolean not null default false,
  equity_held boolean not null default false,
  lenders integer not null default 0,
  holders jsonb not null default '[]',   -- [{bdc, principal, fair, tranches, maturity, period, url}]
  period date,
  sample text,                           -- one identifier string as the BDC wrote it (to check the name)
  public_ticker text,
  verdict text not null default 'maybe',
  score smallint not null default 0,
  reasons jsonb not null default '[]',
  rules_version smallint not null default 0,
  last_run text,
  on_latest boolean not null default true,
  status text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  person_id uuid,
  notes text,
  starred_by text, starred_at timestamptz, flagged_by text, flagged_at timestamptz, flag_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bdc_signals_verdict on public.bdc_signals (verdict, score desc);
alter table public.bdc_signals enable row level security;
create policy bdc_signals_read on public.bdc_signals for select to authenticated using (public.can_access_dashboard());
create policy bdc_signals_write on public.bdc_signals for update to authenticated using (public.can_access_dashboard()) with check (public.can_access_dashboard());
grant select on public.bdc_signals to authenticated;
grant update (status, person_id, notes, updated_at, starred_by, starred_at, flagged_by, flagged_at, flag_note) on public.bdc_signals to authenticated;

create table if not exists public.bdc_signal_runs (
  id uuid primary key default gen_random_uuid(),
  run text,
  items integer default 0,
  added integer default 0,
  stats jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.bdc_signal_runs enable row level security;
create policy bdc_signal_runs_read on public.bdc_signal_runs for select to authenticated using (public.can_access_dashboard());
grant select on public.bdc_signal_runs to authenticated;

create or replace function public.signal_target_counts()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'funds', (select count(distinct coalesce(fund_key, id::text)) from fund_signals
              where verdict = 'target' and coalesce(status, 'new') not in ('added', 'dismissed')),
    'funds_cut', json_build_object(
      'live', (select count(distinct coalesce(fund_key, id::text)) from fund_signals
               where list = 'live' and verdict = 'cut' and coalesce(status, 'new') not in ('added', 'dismissed')),
      'fund1', (select count(distinct coalesce(fund_key, id::text)) from fund_signals
                where list = 'fund1' and verdict = 'cut' and coalesce(status, 'new') not in ('added', 'dismissed'))),
    'credit', (select count(*) from credit_signals
               where verdict = 'target' and coalesce(status, 'new') not in ('added', 'dismissed')),
    'ucc', (select count(*) from ucc_signals
            where verdict = 'target' and coalesce(status, 'new') not in ('added', 'dismissed')),
    'bdc', (select count(*) from bdc_signals
            where verdict = 'target' and coalesce(status, 'new') not in ('added', 'dismissed'))
  );
$$;
grant execute on function public.signal_target_counts() to authenticated;
