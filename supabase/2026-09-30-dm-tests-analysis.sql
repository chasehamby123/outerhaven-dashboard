-- DM A/B tests, one-tap meeting logging, and the weekly Claude analysis.
-- Applied as hq_dm_tests_and_analysis.

-- 1. DM tests: a test has 2+ versions of a message; the team logs sends and replies per version from Today.
create table if not exists public.dm_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hypothesis text,
  context text,                        -- when this DM is sent, e.g. "resource DM after someone comments the keyword"
  status text not null default 'running' check (status in ('running', 'complete', 'paused')),
  winner uuid,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  completed_at timestamptz
);
create table if not exists public.dm_variants (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.dm_tests(id) on delete cascade,
  label text not null,                 -- A, B, C
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists dm_variants_test on public.dm_variants (test_id);
-- One row per tap: sent or replied (meetings live in growth_meetings with dm_variant_id).
create table if not exists public.dm_events (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.dm_variants(id) on delete cascade,
  event text not null check (event in ('sent', 'replied')),
  account_name text,
  work_date date not null default ((now() at time zone 'Asia/Kuala_Lumpur') - interval '2 hours')::date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists dm_events_variant on public.dm_events (variant_id, event);

alter table public.growth_meetings add column if not exists dm_variant_id uuid references public.dm_variants(id) on delete set null;

alter table public.dm_tests enable row level security;
alter table public.dm_variants enable row level security;
alter table public.dm_events enable row level security;
drop policy if exists dm_tests_team on public.dm_tests;
create policy dm_tests_team on public.dm_tests for all to authenticated using (public.can_access_daily_ops()) with check (public.can_access_daily_ops());
drop policy if exists dm_variants_team on public.dm_variants;
create policy dm_variants_team on public.dm_variants for all to authenticated using (public.can_access_daily_ops()) with check (public.can_access_daily_ops());
drop policy if exists dm_events_team on public.dm_events;
create policy dm_events_team on public.dm_events for all to authenticated using (public.can_access_daily_ops()) with check (public.can_access_daily_ops());

-- Ops (Anaz) logs meetings from Today, so the meetings table must be writable by the team (it already is: growth_meetings_team).

-- Per-version totals for HQ.
create or replace view public.dm_variant_stats with (security_invoker = true) as
  select v.id as variant_id, v.test_id, v.label,
    (select count(*) from public.dm_events e where e.variant_id = v.id and e.event = 'sent')::int as sent,
    (select count(*) from public.dm_events e where e.variant_id = v.id and e.event = 'replied')::int as replied,
    (select count(*) from public.growth_meetings m where m.dm_variant_id = v.id and coalesce(m.status, '') <> 'cancelled')::int as meetings
  from public.dm_variants v;

do $$ begin
  alter publication supabase_realtime add table public.dm_events;
exception when duplicate_object then null; end $$;

-- 2. Weekly Claude analysis runs through the same routine as resources, as a job of kind 'analysis'.
alter table public.resource_jobs add column if not exists kind text not null default 'resource';
alter table public.resource_jobs drop constraint if exists resource_jobs_kind_check;
alter table public.resource_jobs add constraint resource_jobs_kind_check check (kind in ('resource', 'analysis'));
alter table public.resource_jobs alter column poster drop not null;
alter table public.resource_jobs alter column topic drop not null;
alter table public.resource_jobs drop constraint if exists resource_jobs_format_check;
alter table public.resource_jobs add constraint resource_jobs_format_check check (format in ('notion', 'pdf', 'list', 'other', 'analysis'));

-- Factors Claude reads off each post: creative (from the image) and caption (from the text). Manual tags win.
alter table public.daily_ops_posts add column if not exists ai_tags jsonb;
alter table public.daily_ops_posts add column if not exists ai_tagged_at timestamptz;

create table if not exists public.growth_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  created_at timestamptz not null default now(),
  job_id uuid references public.resource_jobs(id) on delete set null,
  summary text,                        -- short markdown: what worked, what didn't, per account
  findings jsonb,                      -- [{title, detail, evidence, confidence}]
  next_tests jsonb                     -- [{title, variable, a, b, why, metric}]
);
alter table public.growth_reports enable row level security;
drop policy if exists growth_reports_team_read on public.growth_reports;
create policy growth_reports_team_read on public.growth_reports for select to authenticated using (public.can_access_daily_ops());

alter table public.growth_settings add column if not exists analysis_enabled boolean not null default true;

-- Also applied: resource_jobs.payload jsonb (resource_jobs_payload); resource_config() counts only kind='resource';
-- invoke_weekly_growth_analysis() + pg_cron 'weekly-growth-analysis' '5 2 * * 1' (weekly_analysis_cron).

-- Also applied: dm_conversations (+ match_dm_variant, dm_variant_stats counting captured conversations) as
-- migration dm_conversations; edge function dm-capture receives chats from the browser extension.
