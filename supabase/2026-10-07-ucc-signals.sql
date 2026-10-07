-- UCC signals (HQ → Pipeline → UCC signals): sizable PRIVATE companies that need private credit (Peter's lane).
-- Filled by the GitHub job scripts/ucc_signals.py: state UCC open data (Connecticut data.ct.gov xfev-8smz, Colorado
-- data.colorado.gov wffy-3uut / 8upq-58vz / ap62-sav4) joined by company name + state to SBA PPP loan data (size: jobs,
-- loan ≈ 2.5 months of payroll). Posted to edge function ucc-signals (ingest kind 'ucc'); judged there by classifyUcc()
-- in supabase/functions/ucc-signals/rules.js. One row per company (name_key + state); numbers refresh, status/notes stay.
create table if not exists public.ucc_signals (
  id uuid primary key default gen_random_uuid(),
  company_key text not null unique,      -- name_key|state
  company_name text not null,            -- as filed on the UCC
  name_key text not null,
  state text,
  city text,
  address text,
  zip text,
  sources text[] not null default '{}',  -- UCC registries the filings came from: CT, CO
  ppp jsonb,                             -- {name, amount, jobs, naics, business_type, approved, lender, city}
  est_revenue numeric,                   -- rough revenue estimate from PPP payroll and jobs
  naics text,
  facts jsonb not null default '{}',     -- counts per lien class + refi window details
  liens jsonb not null default '[]',     -- relevant filings, newest first: {src,no,class,party,filed,lapse,status,kind}
  latest_filing date,
  verdict text not null default 'maybe',
  score smallint not null default 0,
  reasons jsonb not null default '[]',
  rules_version smallint not null default 0,
  last_run text,
  on_latest boolean not null default true,
  status text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  person_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ucc_signals_verdict on public.ucc_signals (verdict, score desc);
alter table public.ucc_signals enable row level security;
create policy ucc_signals_read on public.ucc_signals for select to authenticated using (public.can_access_dashboard());
create policy ucc_signals_write on public.ucc_signals for update to authenticated using (public.can_access_dashboard()) with check (public.can_access_dashboard());
grant select on public.ucc_signals to authenticated;
grant update (status, person_id, notes, updated_at) on public.ucc_signals to authenticated;

create table if not exists public.ucc_signal_runs (
  id uuid primary key default gen_random_uuid(),
  run text,
  items integer default 0,
  added integer default 0,
  stats jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.ucc_signal_runs enable row level security;
create policy ucc_signal_runs_read on public.ucc_signal_runs for select to authenticated using (public.can_access_dashboard());
grant select on public.ucc_signal_runs to authenticated;
