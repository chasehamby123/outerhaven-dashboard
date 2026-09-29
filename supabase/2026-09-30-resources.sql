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

-- ---------------------------------------------------------------------------
-- Library + queue (applied as hq_resource_library)
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;
alter table public.resource_jobs
  add column if not exists source text not null default 'generated',
  add column if not exists linked_by text,
  add column if not exists linked_at timestamptz;
alter table public.resource_jobs drop constraint if exists resource_jobs_source_check;
alter table public.resource_jobs add constraint resource_jobs_source_check check (source in ('generated', 'manual'));
alter table public.resource_jobs drop constraint if exists resource_jobs_poster_check;
alter table public.resource_jobs drop constraint if exists resource_jobs_format_check;
alter table public.resource_jobs add constraint resource_jobs_format_check check (format in ('notion', 'pdf', 'list', 'other'));
alter table public.resource_jobs alter column caption drop not null;
create index if not exists resource_jobs_post on public.resource_jobs (post_id);

drop policy if exists resource_jobs_team_manual on public.resource_jobs;
create policy resource_jobs_team_manual on public.resource_jobs for insert to authenticated
  with check (public.can_access_daily_ops() and source = 'manual' and status = 'ready' and output_url ~ '^https?://');

create or replace function public.link_resource(p_job uuid, p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_daily_ops() then raise exception 'team only'; end if;
  update resource_jobs set post_id = p_post, linked_by = (select email from auth.users where id = auth.uid()), linked_at = now() where id = p_job;
  if p_post is not null then
    update daily_ops_posts set tags = coalesce(tags, '{}'::jsonb) - 'no_resource' where id = p_post;
  end if;
end $$;
revoke all on function public.link_resource(uuid, uuid) from public, anon;
grant execute on function public.link_resource(uuid, uuid) to authenticated;

create or replace function public.set_post_no_resource(p_post uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_daily_ops() then raise exception 'team only'; end if;
  update daily_ops_posts set tags = case when p_value then coalesce(tags, '{}'::jsonb) || '{"no_resource": true}'::jsonb else coalesce(tags, '{}'::jsonb) - 'no_resource' end where id = p_post;
end $$;
revoke all on function public.set_post_no_resource(uuid, boolean) from public, anon;
grant execute on function public.set_post_no_resource(uuid, boolean) to authenticated;

-- Resources are usually built before the post goes out: when the scraper saves the post,
-- link it to the unlinked resource whose caption it matches.
create or replace function public.auto_link_resource_to_post()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare hit uuid;
begin
  if coalesce(new.is_repost, false) or coalesce(length(new.post_text), 0) < 40 then return new; end if;
  if exists (select 1 from resource_jobs where post_id = new.id) then return new; end if;
  select id into hit from resource_jobs
   where post_id is null and caption is not null and status in ('ready', 'building', 'queued')
     and created_at > now() - interval '45 days'
     and extensions.similarity(left(caption, 600), left(new.post_text, 600)) > 0.45
   order by extensions.similarity(left(caption, 600), left(new.post_text, 600)) desc limit 1;
  if hit is not null then
    update resource_jobs set post_id = new.id, linked_by = 'auto (caption match)', linked_at = now() where id = hit;
  end if;
  return new;
end $$;
drop trigger if exists auto_link_resource on public.daily_ops_posts;
create trigger auto_link_resource after insert or update of post_text on public.daily_ops_posts
  for each row execute function public.auto_link_resource_to_post();

-- ---------------------------------------------------------------------------
-- 30 Sept audit fixes
-- ---------------------------------------------------------------------------
-- Only pg_cron (postgres) should start the paid scraper (applied as lock_scraper_invoke).
revoke execute on function public.invoke_daily_ops_linkedin_auto() from public, anon, authenticated;
-- Saved copies of post creatives (applied as post_creatives); filled by every posts scrape.
alter table public.daily_ops_posts
  add column if not exists creative_path text,
  add column if not exists creative_type text,
  add column if not exists creative_saved_at timestamptz;

-- ---------------------------------------------------------------------------
-- Team comments excluded (applied as team_comments_excluded)
-- Comments by our own accounts (matched on profile slug or trailing LinkedIn id) are flagged is_team.
-- daily_ops_posts.external_comment_count = audience comments, team_comment_count = ours,
-- unreplied_count = audience top-level comments no team account has answered. Kept current by triggers;
-- sheet_post_stats reports audience comments. See the applied migration for the full function bodies.
-- ---------------------------------------------------------------------------
