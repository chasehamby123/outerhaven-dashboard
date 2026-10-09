-- 9 Oct 2026 (Tengku): three things.
--  1. Reply assist: per-account persona + a log of drafts (edge function `reply-assist`, extension "Draft a reply").
--  2. Track record: RPC `track_record(from, to)` = per person per day, how many tasks were planned / done / skipped / left open,
--     and days nobody opened HQ (no rows were ever created) where the templates say work existed.
--  3. Post scores: view `post_scores` = every own post vs its own account's median engagement, with the merged creative+caption tags.
-- Additive only. Admin only (can_access_dashboard).

-- ---------- 1. Reply assist ----------
create table if not exists public.reply_personas (
  account_name text primary key,
  who_they_are text,      -- the account's real background / role / credentials. The ONLY facts the draft may claim.
  audience text,          -- who usually writes in (e.g. founders raising, family office principals)
  voice text,             -- tone, length, how they open and close
  rules text,             -- never say / always do
  offer text,             -- what we offer and the usual next step (resource, call, intro)
  booking_link text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.reply_personas enable row level security;
create policy reply_personas_admin on public.reply_personas for all to authenticated
  using (public.can_access_dashboard()) with check (public.can_access_dashboard());
grant select, insert, update, delete on public.reply_personas to authenticated;

create table if not exists public.reply_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_name text, requested_by text, thread_key text,
  prospect_name text, prospect_headline text,
  intent text, needs_human boolean, flags text[],
  draft text, model text, input_tokens int, output_tokens int,
  persona_missing boolean not null default false
);
create index if not exists reply_drafts_when on public.reply_drafts (created_at desc);
alter table public.reply_drafts enable row level security;
create policy reply_drafts_admin_read on public.reply_drafts for select to authenticated using (public.can_access_dashboard());
grant select on public.reply_drafts to authenticated;

alter table public.growth_settings add column if not exists reply_daily_cap int not null default 60;

-- Drafts per person today (Malaysia day), for the cap and the HQ usage line.
create or replace function public.reply_usage() returns table(requested_by text, drafts_today int, drafts_7d int)
language sql stable security definer set search_path to 'public' as $$
  select d.requested_by,
    count(*) filter (where d.created_at >= (date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur'))::int,
    count(*)::int
  from public.reply_drafts d
  where public.can_access_dashboard() and d.created_at >= now() - interval '7 days'
  group by 1 order by 2 desc
$$;
grant execute on function public.reply_usage() to authenticated;

-- ---------- 2. Track record ----------
-- Ops day rolls over at 2 AM GMT+8, like sync_daily_ops_today. Today is returned but the UI shows it as in progress.
-- Rows in daily_ops_schedule only exist for days someone opened HQ (the sync runs from the browser), so for a day+person with
-- no rows we count what the templates say should have existed (weekly posts for Anaz, team tasks created on or before that day)
-- and flag it no_record = true.
create or replace function public.track_record(p_from date, p_to date)
returns table(day date, assignee text, planned int, done int, skipped int, open int, no_record boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_today date := (((current_timestamp at time zone 'Asia/Singapore') - interval '2 hours'))::date;
begin
  if not public.can_access_dashboard() then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
  with days as (select g::date as d from generate_series(p_from, least(p_to, v_today), interval '1 day') g),
  actual as (
    select s.work_date as d, coalesce(s.assignee, 'Anaz') as a, count(*)::int as planned,
      (count(*) filter (where s.status = 'done'))::int as done,
      (count(*) filter (where s.status = 'skipped'))::int as skipped,
      (count(*) filter (where s.status not in ('done', 'skipped')))::int as open
    from public.daily_ops_schedule s where s.work_date between p_from and least(p_to, v_today) group by 1, 2),
  tmpl as (
    select d.d, 'Anaz'::text as a, count(*)::int as n from days d
      join public.daily_ops_weekly_posts w on w.day_of_week = extract(dow from d.d)::int and coalesce(w.active, true) group by 1
    union all
    select d.d, t.assignee, count(*)::int from days d
      join public.team_tasks t on t.active and t.created_at::date <= d.d and (t.until_date is null or t.until_date >= d.d)
        and ((t.repeat = 'daily') or (t.repeat = 'weekdays' and extract(dow from d.d) between 1 and 5)
          or (t.repeat = 'weekly' and extract(dow from d.d)::int = any (t.days)) or (t.repeat = 'once' and t.on_date = d.d))
      group by 1, 2),
  expd as (select x.d, x.a, sum(x.n)::int as n from tmpl x group by 1, 2)
  select coalesce(ac.d, e.d), coalesce(ac.a, e.a),
    coalesce(ac.planned, e.n), coalesce(ac.done, 0), coalesce(ac.skipped, 0), coalesce(ac.open, e.n),
    (ac.d is null)
  from actual ac full join expd e on e.d = ac.d and e.a = ac.a
  order by 1, 2;
end $$;
grant execute on function public.track_record(date, date) to authenticated;

-- ---------- 3. Post scores ----------
create or replace function public.ohq_num(t text) returns numeric language sql immutable as $$
  select case when t ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then t::numeric end $$;

create or replace view public.post_scores with (security_invoker = true) as
with own as (
  select p.id, p.account_id, a.owner_name as account, coalesce(p.posted_at, p.work_date::timestamptz) as posted_at,
    p.linkedin_post_url as url, p.post_name, left(coalesce(p.post_text, ''), 400) as caption, p.content_type, p.creative_path,
    coalesce(public.ohq_num(p.metrics->>'comments'), p.external_comment_count, p.commenter_count, 0)
      + coalesce(public.ohq_num(p.metrics->>'reactions'), p.reaction_count, 0)
      + coalesce(public.ohq_num(p.metrics->>'reposts'), p.repost_count, 0) as engagement,
    -- Claude's weekly tags fill the gaps; hand tags win (same rule as hq/insights.js toPost)
    jsonb_strip_nulls(coalesce(p.ai_tags, '{}'::jsonb) || coalesce(p.tags, '{}'::jsonb)) as factors
  from public.daily_ops_posts p join public.daily_ops_accounts a on a.id = p.account_id
  where not coalesce(p.is_repost, false)),
base as (select account_id, percentile_cont(0.5) within group (order by engagement) as account_median, count(*)::int as account_posts from own group by 1),
meet as (select post_id, count(*)::int as n from public.growth_meetings where status <> 'cancelled' and post_id is not null group by 1),
ranked as (
  select o.*, b.account_median, b.account_posts, coalesce(m.n, 0) as meetings,
    round(((o.engagement + 1) / (b.account_median + 1))::numeric, 2) as lift_ratio,
    percent_rank() over (partition by o.account_id order by o.engagement) as pr
  from own o join base b using (account_id) left join meet m on m.post_id = o.id)
select id, account, posted_at, url, post_name, caption, content_type, creative_path, engagement, account_median, account_posts,
  lift_ratio, round(pr::numeric, 2) as pct_in_account, meetings,
  case when meetings > 0 then 'converted' when account_posts < 4 then 'too_early'
       when pr >= 0.75 then 'winner' when pr <= 0.25 then 'flop' else 'typical' end as outcome,
  factors
from ranked;
grant select on public.post_scores to authenticated;
