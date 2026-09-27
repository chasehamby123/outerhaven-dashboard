-- Outerhaven HQ · Growth module migration (internal dashboard project nfcysxqdwpdhrdpgxrlo)
-- Safe to re-run: every statement is idempotent. Adds columns/tables only; drops nothing.

-- 1. Post tags + manual metrics on the existing synced posts table.
alter table public.daily_ops_posts add column if not exists tags jsonb not null default '{}'::jsonb;
alter table public.daily_ops_posts add column if not exists metrics jsonb not null default '{}'::jsonb;

-- 2. Experiments: creative images, primary metric, which accounts each variant ran on.
alter table public.daily_ops_experiments add column if not exists assets jsonb not null default '[]'::jsonb;
alter table public.daily_ops_experiments add column if not exists primary_metric text not null default 'comments';
alter table public.daily_ops_experiments add column if not exists account_a text;
alter table public.daily_ops_experiments add column if not exists account_b text;

-- 3. Meetings log with a source, so inbound vs outbound can be measured.
create table if not exists public.growth_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null default current_date,
  account_name text,
  source text not null check (source in ('inbound_post','inbound_dm','comment_to_dm','outbound_dm','outbound_email','referral','other')),
  post_id uuid references public.daily_ops_posts(id) on delete set null,
  experiment_id uuid references public.daily_ops_experiments(id) on delete set null,
  lead_name text,
  company text,
  status text not null default 'booked' check (status in ('booked','held','qualified','no_show','cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_meetings_date_idx on public.growth_meetings(meeting_date desc);
alter table public.growth_meetings enable row level security;
drop policy if exists growth_meetings_team on public.growth_meetings;
create policy growth_meetings_team on public.growth_meetings for all to authenticated
  using (public.dashboard_role() in ('admin','ops')) with check (public.dashboard_role() in ('admin','ops'));

-- 4. Private bucket for experiment creatives (served through short-lived signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('growth-assets','growth-assets', false, 15728640, array['image/png','image/jpeg','image/webp','image/gif','video/mp4','application/pdf'])
on conflict (id) do nothing;
drop policy if exists growth_assets_team_read on storage.objects;
drop policy if exists growth_assets_team_write on storage.objects;
drop policy if exists growth_assets_team_delete on storage.objects;
create policy growth_assets_team_read on storage.objects for select to authenticated
  using (bucket_id = 'growth-assets' and public.dashboard_role() in ('admin','ops'));
create policy growth_assets_team_write on storage.objects for insert to authenticated
  with check (bucket_id = 'growth-assets' and public.dashboard_role() in ('admin','ops'));
create policy growth_assets_team_delete on storage.objects for delete to authenticated
  using (bucket_id = 'growth-assets' and public.dashboard_role() in ('admin','ops'));

-- 5. Realtime for the new table.
do $$ begin
  alter publication supabase_realtime add table public.growth_meetings;
exception when duplicate_object then null; end $$;

-- 6. Scraper control: on/off switch, schedule, cost + budget cap, run log.
create table if not exists public.growth_settings (
  id int primary key default 1 check (id = 1),
  scrape_enabled boolean not null default false,
  scrape_frequency text not null default 'daily' check (scrape_frequency in ('daily','twice_daily','every_6h','weekly')),
  scrape_hour int not null default 9 check (scrape_hour between 0 and 23),        -- Malaysia time (GMT+8)
  cost_per_run numeric(8,2) not null default 0.19,
  monthly_budget numeric(8,2) not null default 15,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.growth_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.growth_scrape_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('auto','manual')),
  status text not null default 'running' check (status in ('running','ok','partial','failed','skipped')),
  stage text,                                  -- auto runs: posts -> comments -> done
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  posts_saved int, profiles_checked int, comment_threads int,
  cost_usd numeric(8,2) not null default 0,
  detail jsonb not null default '{}'::jsonb,
  triggered_by uuid default auth.uid()
);
create index if not exists growth_scrape_runs_started_idx on public.growth_scrape_runs(started_at desc);

alter table public.growth_settings enable row level security;
alter table public.growth_scrape_runs enable row level security;
drop policy if exists growth_settings_read on public.growth_settings;
drop policy if exists growth_settings_admin on public.growth_settings;
create policy growth_settings_read on public.growth_settings for select to authenticated using (public.dashboard_role() in ('admin','ops'));
create policy growth_settings_admin on public.growth_settings for update to authenticated using (public.dashboard_role() = 'admin') with check (public.dashboard_role() = 'admin');
drop policy if exists growth_runs_read on public.growth_scrape_runs;
drop policy if exists growth_runs_write on public.growth_scrape_runs;
drop policy if exists growth_runs_update on public.growth_scrape_runs;
create policy growth_runs_read on public.growth_scrape_runs for select to authenticated using (public.dashboard_role() in ('admin','ops'));
create policy growth_runs_write on public.growth_scrape_runs for insert to authenticated with check (public.dashboard_role() = 'admin' and trigger = 'manual');
create policy growth_runs_update on public.growth_scrape_runs for update to authenticated using (public.dashboard_role() = 'admin' and trigger = 'manual');

do $$ begin
  alter publication supabase_realtime add table public.growth_settings;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.growth_scrape_runs;
exception when duplicate_object then null; end $$;
