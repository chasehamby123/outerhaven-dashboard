-- Team tasks: everyone's own one-off / daily / weekday / weekly tasks on Today (applied 2 Oct 2026).
-- team_tasks = definitions. sync_team_tasks() (called by HQ after sync_daily_ops_today) upserts today's occurrences into
-- daily_ops_schedule with auto_key 'task:<id>', assignee, auto_generated = false (so sync_daily_ops_today's cleanup
-- never touches them). Stale untouched occurrences are removed client-side (hq/tasks.js syncTeamTasks).
-- Posting / reply / creation rows get assignee 'Anaz' via trigger; rows with null assignee are treated as Anaz in HQ.
alter table public.daily_ops_schedule add column if not exists assignee text;
alter table public.daily_ops_schedule alter column start_time drop not null;   -- "any time today" tasks

create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, notes text, assignee text not null, account text,
  repeat text not null default 'once' check (repeat in ('once','daily','weekdays','weekly')),
  days smallint[] not null default '{}', on_date date, until_date date, start_time time,
  duration_min smallint check (duration_min is null or duration_min between 5 and 720),
  sort smallint not null default 0, active boolean not null default true,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.team_tasks enable row level security;
create policy team_tasks_rw on public.team_tasks for all to authenticated
  using (public.can_access_daily_ops()) with check (public.can_access_daily_ops());
grant select, insert, update, delete on public.team_tasks to authenticated;
alter publication supabase_realtime add table public.team_tasks;

create or replace function public.daily_ops_default_assignee() returns trigger language plpgsql as $$
begin
  if new.assignee is null and coalesce(new.auto_key,'') ~ '^(post|engage|pre|create):' then new.assignee := 'Anaz'; end if;
  return new;
end $$;
create or replace trigger trg_daily_ops_default_assignee before insert or update on public.daily_ops_schedule
  for each row execute function public.daily_ops_default_assignee();

insert into public.team_tasks (title, notes, assignee, account, repeat, sort)
select 'Reply in ' || n || '''s inbox', 'Open ' || n || '''s LinkedIn inbox and answer everyone waiting on a reply.', 'Chase', n, 'daily', i
from unnest(array['Peter','Chase','Tengku','Razeen','Sara','Dev','Sahid','Reza']) with ordinality as x(n, i)
where not exists (select 1 from public.team_tasks where assignee = 'Chase' and title like 'Reply in %inbox');

create or replace function public.sync_team_tasks() returns int
language plpgsql security definer set search_path to 'public' as $$
declare v_day date; v_dow int; v_n int;
begin
  if not public.can_access_daily_ops() then raise exception 'Not authorized' using errcode = '42501'; end if;
  v_day := (((current_timestamp at time zone 'Asia/Singapore') - interval '2 hours'))::date;
  v_dow := extract(dow from v_day)::int;
  insert into public.daily_ops_schedule
    (work_date, start_time, end_time, task, account_id, assignee, priority, status, notes, auto_generated, auto_key, created_by, updated_by)
  select v_day, t.start_time,
    case when t.start_time is not null and t.duration_min is not null then t.start_time + make_interval(mins => t.duration_min) end,
    t.title,
    (select a.id from public.daily_ops_accounts a where a.active and lower(trim(a.owner_name)) = lower(trim(t.account)) order by a.sort_order limit 1),
    t.assignee, 'normal', 'due', t.notes, false, 'task:' || t.id::text, auth.uid(), auth.uid()
  from public.team_tasks t
  where t.active
    and ((t.repeat = 'once' and t.on_date = v_day)
      or (t.repeat <> 'once' and (t.on_date is null or t.on_date <= v_day) and (t.until_date is null or t.until_date >= v_day)
          and (t.repeat = 'daily' or (t.repeat = 'weekdays' and v_dow between 1 and 5) or (t.repeat = 'weekly' and v_dow = any(t.days)))))
  on conflict (work_date, auto_key) where auto_key is not null
  do update set start_time = excluded.start_time, end_time = excluded.end_time, task = excluded.task,
    account_id = excluded.account_id, assignee = excluded.assignee, notes = excluded.notes, updated_at = now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.sync_team_tasks() to authenticated;
