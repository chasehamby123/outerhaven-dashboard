-- Fund signals (HQ → Pipeline → Fund signals): US Form D filings pulled through Apify, judged by rules, checked for a later fund.
-- Edge function fund-signals writes; admins read and update status / person_id / notes from HQ.
create table if not exists public.fund_signals (
  id uuid primary key default gen_random_uuid(),
  accession text not null unique,
  list text not null check (list in ('live', 'fund1')),
  company_name text not null,
  cik text,
  fund_no smallint default 0,
  manager_key text,
  fund_key text,
  check_keyword text,
  filing_date date,
  form_type text,
  offering numeric,
  offering_text text,
  sold numeric,
  investors integer,
  first_sale date,
  commissions numeric default 0,
  finders numeric default 0,
  exemptions text,
  state text,
  city text,
  phone text,
  industry text,
  executives jsonb not null default '[]',
  executives_text text,
  filing_url text,
  edgar_url text,
  verdict text not null default 'maybe',
  score smallint not null default 0,
  reasons jsonb not null default '[]',
  check_status text,            -- null | checking | clear | next | error
  check_note text,
  checked_at timestamptz,
  later jsonb,
  still_raising text,
  status text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  person_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fund_signals_list_verdict on public.fund_signals (list, verdict, score desc);
create index if not exists fund_signals_manager on public.fund_signals (manager_key);

create table if not exists public.fund_signal_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('scan_live', 'scan_fund1', 'check')),
  apify_run_id text,
  dataset_id text,
  params jsonb not null default '{}',
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  cost_usd numeric default 0,
  cap_usd numeric default 0,
  items integer default 0,
  added integer default 0,
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists fund_signal_runs_status on public.fund_signal_runs (status, created_at desc);

alter table public.fund_signals enable row level security;
alter table public.fund_signal_runs enable row level security;
create policy fund_signals_read on public.fund_signals for select to authenticated using (public.can_access_dashboard());
create policy fund_signals_write on public.fund_signals for update to authenticated using (public.can_access_dashboard()) with check (public.can_access_dashboard());
create policy fund_signal_runs_read on public.fund_signal_runs for select to authenticated using (public.can_access_dashboard());
grant select on public.fund_signals to authenticated;
grant update (status, person_id, notes, updated_at) on public.fund_signals to authenticated;
grant select on public.fund_signal_runs to authenticated;

alter table public.growth_settings add column if not exists fund_scan_enabled boolean not null default false;
alter table public.growth_settings add column if not exists fund_monthly_budget numeric not null default 10;

-- Cron secret for the poll / weekly scan (generated here, never shown in HQ).
insert into public.integration_secrets (key, secret_value)
select 'FUND_CRON_SECRET', encode(extensions.gen_random_bytes(24), 'hex')
where not exists (select 1 from public.integration_secrets where key = 'FUND_CRON_SECRET');

create or replace function public.invoke_fund_signals()
 returns bigint language plpgsql security definer set search_path to ''
as $function$
declare k text; rid bigint;
begin
  select secret_value into k from public.integration_secrets where key = 'FUND_CRON_SECRET';
  if k is null then raise exception 'FUND_CRON_SECRET is missing'; end if;
  select net.http_post(
    url := 'https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/fund-signals',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-outerhaven-cron', k),
    body := '{"action":"cron"}'::jsonb, timeout_milliseconds := 10000) into rid;
  return rid;
end;
$function$;
revoke all on function public.invoke_fund_signals() from public, anon, authenticated;

-- Every 15 min: collect finished Apify runs. The weekly scan only runs when HQ's switch is on (off by default).
select cron.schedule('fund-signals', '*/15 * * * *', 'select public.invoke_fund_signals();');
