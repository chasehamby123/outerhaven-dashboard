-- Inbox tracking + outbound funnel + needle metrics (5 Oct 2026). Additive only.
--
-- Flow: staff open LinkedIn Messaging in each AdsPower browser -> extension "Sync inbox" -> dm-capture action `inbox_sync`
-- -> inbox_threads (one row per conversation per account) + inbox_syncs (one row per sync, for accountability).
-- missed_commenters() cross-references the scraper (daily_ops_post_comments) with the synced inbox:
-- an audience comment nobody on the team replied to, from someone who is not in that account's inbox = probably missed.
-- Prosp accounts (Peter, Chase, Tengku) get their outbound funnel from the Prosp API (edge function prosp-sync -> prosp_stats).

-- ---------- name matching: "Dr. Jane Tan, CFA | Family Office" and "Jane Tan" must meet ----------
create or replace function public.ohq_name_key(p text) returns text
language sql immutable as $$
  with s as (
    select regexp_replace(
             regexp_replace(
               regexp_replace(
                 translate(lower(split_part(split_part(split_part(coalesce(p,''), ',', 1), ' - ', 1), '|', 1)),
                   'áàâäãåçéèêëíìîïñóòôöõúùûüýÿšž', 'aaaaaaceeeeiiiinooooouuuuyysz'),
                 '\(.*?\)', ' ', 'g'),
               '[^a-z ]', ' ', 'g'),
             '\m(cfa|cpa|mba|phd|dr|md|esq|frsa|cfp|pmp|jd|msc|bsc|cima|caia|frm|mr|mrs|ms)\M', ' ', 'g') as t
  ), a as (select regexp_split_to_array(nullif(trim(regexp_replace(t, '\s+', ' ', 'g')), ''), ' ') as w from s)
  select case when w is null then null when array_length(w, 1) = 1 then w[1] else w[1] || ' ' || w[array_length(w, 1)] end from a
$$;

-- ---------- tables ----------
create table if not exists public.inbox_syncs (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  synced_by text,
  synced_at timestamptz not null default now(),
  thread_count int not null default 0,
  awaiting_us int not null default 0,
  awaiting_them int not null default 0,
  unread int not null default 0,
  oldest_loaded_at timestamptz,
  is_baseline boolean not null default false,
  strategy text,
  notes jsonb
);
create index if not exists inbox_syncs_acct on public.inbox_syncs (account_name, synced_at desc);

create table if not exists public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  thread_key text not null,
  thread_url text,
  participant text,
  name_key text,
  last_sender text not null default 'unknown' check (last_sender in ('us', 'them', 'unknown')),
  last_snippet text,
  last_at timestamptz,
  unread boolean not null default false,
  first_seen_at timestamptz not null default now(),
  first_seen_baseline boolean not null default false,
  last_seen_at timestamptz not null default now(),
  gone boolean not null default false,
  unique (account_name, thread_key)
);
create index if not exists inbox_threads_waiting on public.inbox_threads (account_name, last_sender) where not gone;
create index if not exists inbox_threads_name on public.inbox_threads (account_name, name_key);

-- who answers which inbox (staff see their own list; admins see who is behind)
create table if not exists public.inbox_owners (account_name text primary key, responder text not null);

-- "not needed / handled elsewhere": thread refs include the day of the last message, so a new message brings it back
create table if not exists public.inbox_dismissals (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('thread', 'comment')),
  ref text not null,
  account_name text,
  by_email text,
  note text,
  created_at timestamptz not null default now(),
  unique (kind, ref)
);

create table if not exists public.prosp_stats (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  campaign_id text not null,
  campaign_name text,
  sender text,
  account_name text,
  leads int not null default 0,
  queued int not null default 0,
  invited int not null default 0,
  connected int not null default 0,
  messaged int not null default 0,
  replied int not null default 0,
  other int not null default 0,
  statuses jsonb not null default '{}'::jsonb,
  truncated boolean not null default false
);
create index if not exists prosp_stats_campaign on public.prosp_stats (campaign_id, captured_at desc);

create table if not exists public.prosp_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ok boolean not null default false,
  campaigns int not null default 0,
  leads int not null default 0,
  error text,
  detail jsonb
);

-- ---------- access ----------
alter table public.inbox_syncs enable row level security;
alter table public.inbox_threads enable row level security;
alter table public.inbox_owners enable row level security;
alter table public.inbox_dismissals enable row level security;
alter table public.prosp_stats enable row level security;
alter table public.prosp_sync_runs enable row level security;

create policy inbox_syncs_read on public.inbox_syncs for select to authenticated using (public.can_access_daily_ops());
create policy inbox_threads_read on public.inbox_threads for select to authenticated using (public.can_access_daily_ops());
create policy inbox_owners_read on public.inbox_owners for select to authenticated using (public.can_access_daily_ops());
create policy inbox_owners_admin on public.inbox_owners for all to authenticated using (public.can_access_dashboard()) with check (public.can_access_dashboard());
create policy inbox_dismissals_read on public.inbox_dismissals for select to authenticated using (public.can_access_daily_ops());
create policy inbox_dismissals_add on public.inbox_dismissals for insert to authenticated with check (public.can_access_daily_ops());
create policy prosp_stats_read on public.prosp_stats for select to authenticated using (public.can_access_dashboard());
create policy prosp_sync_runs_read on public.prosp_sync_runs for select to authenticated using (public.can_access_dashboard());
grant select on public.inbox_syncs, public.inbox_threads, public.prosp_stats, public.prosp_sync_runs to authenticated;
grant select, insert on public.inbox_dismissals to authenticated;
grant all on public.inbox_owners to authenticated;

-- Manual AdsPower accounts: Anaz works them. Peter / Chase / Tengku run Prosp and keep Chase on their inboxes (existing "Reply in X's inbox" tasks).
insert into public.inbox_owners (account_name, responder)
select a.owner_name, case when lower(a.owner_name) in ('peter', 'chase', 'tengku') then 'Chase' else 'Anaz' end
from public.daily_ops_accounts a where a.active
on conflict (account_name) do nothing;

-- ---------- reads ----------
-- Conversations where they spoke last and we owe a reply (dismissed ones hidden; very old ones ignored).
create or replace function public.inbox_waiting(p_max_days int default 45)
returns table (account_name text, responder text, thread_key text, thread_url text, participant text, last_snippet text,
               last_at timestamptz, unread boolean, ref text, days_waiting int)
language sql stable security definer set search_path to 'public' as $$
  select t.account_name, coalesce(o.responder, 'Anaz'), t.thread_key, t.thread_url, t.participant, t.last_snippet, t.last_at, t.unread,
         t.account_name || '|' || t.thread_key || '@' || to_char(coalesce(t.last_at, t.first_seen_at) at time zone 'UTC', 'YYYYMMDD'),
         greatest(0, floor(extract(epoch from (now() - coalesce(t.last_at, t.first_seen_at))) / 86400))::int
  from public.inbox_threads t
  left join public.inbox_owners o on o.account_name = t.account_name
  where public.can_access_daily_ops() and not t.gone and t.last_sender = 'them'
    and coalesce(t.last_at, t.first_seen_at) >= now() - make_interval(days => p_max_days)
    and not exists (select 1 from public.inbox_dismissals d where d.kind = 'thread'
      and d.ref = t.account_name || '|' || t.thread_key || '@' || to_char(coalesce(t.last_at, t.first_seen_at) at time zone 'UTC', 'YYYYMMDD'))
$$;

-- Audience comments nobody replied to. verdict: missed = not in the inbox and the inbox was synced after the comment;
-- unverified = inbox synced before the comment (sync again to know); unsynced = this account's inbox was never synced; in_inbox = they are in the DMs.
create or replace function public.missed_commenters(p_days int default 14)
returns table (account_name text, responder text, comment_id text, author_name text, author_url text, body text, posted_at timestamptz,
               post_url text, post_name text, verdict text)
language sql stable security definer set search_path to 'public' as $$
  with last_sync as (select s.account_name, max(s.synced_at) as at from public.inbox_syncs s group by 1),
  cands as (
    select a.owner_name as account_name, c.comment_id, c.author_name, c.author_url, c.body, coalesce(c.posted_at, c.scraped_at) as posted_at,
           p.linkedin_post_url as post_url, p.post_name, public.ohq_name_key(c.author_name) as k
    from public.daily_ops_post_comments c
    join public.daily_ops_posts p on p.id = c.post_id
    join public.daily_ops_accounts a on a.id = p.account_id
    where public.can_access_daily_ops()
      and c.comment_type = 'comment' and not c.is_team and not coalesce(c.is_post_author, false)
      and coalesce(p.is_repost, false) = false
      and coalesce(c.author_name, '') !~* '^linkedin member$'
      and coalesce(c.posted_at, c.scraped_at) >= now() - make_interval(days => p_days)
      and not exists (select 1 from public.daily_ops_post_comments r where r.post_id = c.post_id and r.parent_comment_id = c.comment_id and r.is_team)
      and not exists (select 1 from public.inbox_dismissals d where d.kind = 'comment' and d.ref = c.comment_id)
  )
  select x.account_name, coalesce(o.responder, 'Anaz'), x.comment_id, x.author_name, x.author_url, x.body, x.posted_at, x.post_url, x.post_name,
    case when ls.at is null then 'unsynced'
         when x.k is not null and exists (select 1 from public.inbox_threads t where t.account_name = x.account_name and not t.gone and t.name_key = x.k) then 'in_inbox'
         when ls.at < x.posted_at + interval '3 hours' then 'unverified'
         else 'missed' end
  from cands x
  left join last_sync ls on ls.account_name = x.account_name
  left join public.inbox_owners o on o.account_name = x.account_name
$$;

create or replace function public.inbox_state()
returns table (account_name text, responder text, last_sync_at timestamptz, last_sync_by text, threads int, awaiting_us int,
               oldest_days int, awaiting_them int, new_7d int, strategy text)
language sql stable security definer set search_path to 'public' as $$
  select a.owner_name, coalesce(o.responder, 'Anaz'), ls.synced_at, ls.synced_by,
    (select count(*)::int from public.inbox_threads t where t.account_name = a.owner_name and not t.gone),
    (select count(*)::int from public.inbox_waiting() w where w.account_name = a.owner_name),
    (select max(w.days_waiting)::int from public.inbox_waiting() w where w.account_name = a.owner_name),
    (select count(*)::int from public.inbox_threads t where t.account_name = a.owner_name and not t.gone and t.last_sender = 'us'),
    (select count(*)::int from public.inbox_threads t where t.account_name = a.owner_name and not t.gone and not t.first_seen_baseline and t.first_seen_at >= now() - interval '7 days'),
    ls.strategy
  from public.daily_ops_accounts a
  left join public.inbox_owners o on o.account_name = a.owner_name
  left join lateral (select s.synced_at, s.synced_by, s.strategy from public.inbox_syncs s where s.account_name = a.owner_name order by s.synced_at desc limit 1) ls on true
  where public.can_access_daily_ops() and a.active
  order by a.sort_order
$$;

-- The numbers that move the needle, computed once on the server so Overview and Outbound agree.
create or replace function public.needle_metrics(p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare cur timestamptz := now() - make_interval(days => p_days); prv timestamptz := now() - make_interval(days => p_days * 2); r jsonb;
begin
  if not public.can_access_daily_ops() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'days', p_days,
    'meetings', jsonb_build_object(
      'inbound', (select count(*) from public.growth_meetings m where m.meeting_date >= cur::date and m.status <> 'cancelled' and m.source in ('inbound_post', 'inbound_dm', 'comment_to_dm')),
      'outbound', (select count(*) from public.growth_meetings m where m.meeting_date >= cur::date and m.status <> 'cancelled' and m.source in ('outbound_dm', 'outbound_email')),
      'inbound_prev', (select count(*) from public.growth_meetings m where m.meeting_date >= prv::date and m.meeting_date < cur::date and m.status <> 'cancelled' and m.source in ('inbound_post', 'inbound_dm', 'comment_to_dm')),
      'outbound_prev', (select count(*) from public.growth_meetings m where m.meeting_date >= prv::date and m.meeting_date < cur::date and m.status <> 'cancelled' and m.source in ('outbound_dm', 'outbound_email'))),
    'comments', (
      select jsonb_build_object('total', count(*), 'replied', count(*) filter (where replied)) from (
        select exists (select 1 from public.daily_ops_post_comments r2 where r2.post_id = c.post_id and r2.parent_comment_id = c.comment_id and r2.is_team) as replied
        from public.daily_ops_post_comments c join public.daily_ops_posts p on p.id = c.post_id
        where c.comment_type = 'comment' and not c.is_team and not coalesce(c.is_post_author, false) and coalesce(p.is_repost, false) = false
          and coalesce(c.posted_at, c.scraped_at) >= cur) q),
    'median_reply_hours', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from (r2.posted_at - c.posted_at)) / 3600))::numeric, 1)
      from public.daily_ops_post_comments c join public.daily_ops_post_comments r2 on r2.post_id = c.post_id and r2.parent_comment_id = c.comment_id and r2.is_team
      where c.comment_type = 'comment' and not c.is_team and c.posted_at >= cur and r2.posted_at >= c.posted_at),
    'missed', (select jsonb_build_object('missed', count(*) filter (where verdict = 'missed'), 'unverified', count(*) filter (where verdict in ('unverified', 'unsynced')),
        'in_inbox', count(*) filter (where verdict = 'in_inbox')) from public.missed_commenters(p_days)),
    'waiting', (select jsonb_build_object('threads', count(*), 'oldest_days', coalesce(max(days_waiting), 0)) from public.inbox_waiting()),
    'prosp', (select jsonb_build_object('leads', coalesce(sum(leads), 0), 'queued', coalesce(sum(queued), 0), 'invited', coalesce(sum(invited), 0), 'connected', coalesce(sum(connected), 0),
        'messaged', coalesce(sum(messaged), 0), 'replied', coalesce(sum(replied), 0), 'as_of', max(captured_at))
      from (select distinct on (campaign_id) * from public.prosp_stats order by campaign_id, captured_at desc) s),
    'replies', jsonb_build_object(
      'now', (select count(*) from public.lead_intake l where l.source = 'Prosp' and l.created_at >= cur),
      'prev', (select count(*) from public.lead_intake l where l.source = 'Prosp' and l.created_at >= prv and l.created_at < cur),
      'qualified', (select count(*) from public.lead_intake l where l.source = 'Prosp' and l.created_at >= cur and l.decision like 'qualified%')),
    'manual', (select jsonb_build_object('new_convos', coalesce(sum(new_7d), 0), 'awaiting_them', coalesce(sum(awaiting_them), 0)) from public.inbox_state())
  ) into r;
  return r;
end $$;

grant execute on function public.inbox_waiting(int), public.missed_commenters(int), public.inbox_state(), public.needle_metrics(int) to authenticated;

-- Prosp API key: write-only from HQ (admins), read only by the edge function with the service role.
create or replace function public.set_prosp_key(p_value text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.can_access_dashboard() then raise exception 'admins only'; end if;
  if coalesce(trim(p_value), '') = '' then raise exception 'empty key'; end if;
  insert into public.integration_secrets (key, secret_value, updated_at) values ('PROSP_API_KEY', trim(p_value), now())
  on conflict (key) do update set secret_value = excluded.secret_value, updated_at = now();
end $$;
create or replace function public.prosp_key_set() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.can_access_dashboard() and exists (select 1 from public.integration_secrets where key = 'PROSP_API_KEY')
$$;
grant execute on function public.set_prosp_key(text), public.prosp_key_set() to authenticated;

-- Cron: the Prosp funnel refreshes itself every 6 hours (needs the key above; fails quietly until it is set).
create or replace function public.invoke_prosp_sync() returns bigint
language plpgsql security definer set search_path to '' as $$
declare k text; rid bigint;
begin
  select secret_value into k from public.integration_secrets where key = 'LINKEDIN_CRON_SECRET';
  if k is null then raise exception 'LINKEDIN_CRON_SECRET is missing'; end if;
  select net.http_post(
    url := 'https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/prosp-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-outerhaven-cron', k),
    body := '{"action":"cron"}'::jsonb, timeout_milliseconds := 10000) into rid;
  return rid;
end $$;
select cron.schedule('prosp-sync', '20 */6 * * *', 'select public.invoke_prosp_sync();');

-- name_key is always derived from the participant name by the database, never by clients.
create or replace function public.inbox_threads_set_key() returns trigger language plpgsql as $$
begin
  new.name_key := public.ohq_name_key(new.participant);
  return new;
end $$;
create trigger trg_inbox_threads_key before insert or update of participant on public.inbox_threads
  for each row execute function public.inbox_threads_set_key();
