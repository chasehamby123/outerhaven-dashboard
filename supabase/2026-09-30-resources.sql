-- Lead-magnet resource builder: HQ queues a job, the resource-request edge function fires a
-- Claude Code routine (runs on the owner's Claude subscription), the routine builds the
-- resource with the lead-magnet-resource-builder skill and writes the result back here.

create table if not exists public.resource_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  requested_by text,
  post_id uuid references public.daily_ops_posts(id) on delete set null,
  format text not null check (format in ('notion', 'pdf', 'list')),
  poster text not null check (poster in ('Peter Plaut', 'Tengku Harris', 'Chase Hamby', 'Anaz Azlan')),
  brand text not null default 'OuterHaven Advisory',
  client jsonb,                -- client brand: {name, cta_person, booking_link, colours}
  topic text not null,
  caption text not null,
  creative_path text,          -- growth-assets bucket path, uploaded from HQ
  creative_url text,           -- or the LinkedIn media URL of a scraped post
  list_brief text,             -- lists: what to scrape, for whom, how many rows
  notes text,                  -- anything else: source material, facts the team supplies
  status text not null default 'queued' check (status in ('queued', 'building', 'ready', 'failed', 'cancelled')),
  progress text,
  output_url text,
  output_title text,
  judgment_calls text[],
  error text,
  session_url text,
  fired_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists resource_jobs_created on public.resource_jobs (created_at desc);

alter table public.resource_jobs enable row level security;
drop policy if exists resource_jobs_team_read on public.resource_jobs;
create policy resource_jobs_team_read on public.resource_jobs for select to authenticated using (public.can_access_daily_ops());
-- Inserts go through the edge function (service role) so the daily cap can't be bypassed.
drop policy if exists resource_jobs_admin_update on public.resource_jobs;
create policy resource_jobs_admin_update on public.resource_jobs for update to authenticated
  using (public.can_access_dashboard()) with check (public.can_access_dashboard());

do $$ begin
  alter publication supabase_realtime add table public.resource_jobs;
exception when duplicate_object then null; end $$;

alter table public.growth_settings
  add column if not exists resource_daily_cap integer not null default 6,
  add column if not exists notion_parent_url text,
  add column if not exists drive_folder_url text;

-- Admins paste the routine URL + token from claude.ai/code/routines. Write-only from the browser.
create or replace function public.set_routine_secret(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_dashboard() then raise exception 'admins only'; end if;
  if p_key not in ('ROUTINE_FIRE_URL', 'ROUTINE_FIRE_TOKEN') then raise exception 'unknown key'; end if;
  if coalesce(trim(p_value), '') = '' then
    delete from public.integration_secrets where key = p_key;
  else
    insert into public.integration_secrets (key, secret_value, updated_at) values (p_key, trim(p_value), now())
    on conflict (key) do update set secret_value = excluded.secret_value, updated_at = now();
  end if;
end $$;
revoke all on function public.set_routine_secret(text, text) from public, anon;
grant execute on function public.set_routine_secret(text, text) to authenticated;

create or replace function public.resource_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.can_access_daily_ops() then jsonb_build_object(
    'connected', (select count(*) = 2 from integration_secrets where key in ('ROUTINE_FIRE_URL', 'ROUTINE_FIRE_TOKEN') and secret_value <> ''),
    'daily_cap', (select resource_daily_cap from growth_settings where id = 1),
    'used_today', (select count(*) from resource_jobs where status <> 'cancelled' and fired_at >= date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur'),
    'notion_parent_url', (select notion_parent_url from growth_settings where id = 1),
    'drive_folder_url', (select drive_folder_url from growth_settings where id = 1)
  ) end;
$$;
revoke all on function public.resource_config() from public, anon;
grant execute on function public.resource_config() to authenticated;
