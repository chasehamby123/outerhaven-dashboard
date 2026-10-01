-- Post creation schedule: weekly blocks where creatives get made for each account (HQ → Schedule → Post creation).
-- sync_daily_ops_today() also turns today's blocks into Today tasks (auto_key 'create:<id>').
create table if not exists public.daily_ops_creation_blocks (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  owner_name text not null,            -- the account the creatives are for
  maker text default 'Anaz',           -- who makes them
  creatives smallint not null default 1 check (creatives between 1 and 50),
  minutes_per smallint not null default 30 check (minutes_per between 5 and 240),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.daily_ops_creation_blocks enable row level security;
drop policy if exists creation_blocks_rw on public.daily_ops_creation_blocks;
create policy creation_blocks_rw on public.daily_ops_creation_blocks for all to authenticated
  using (public.can_access_daily_ops()) with check (public.can_access_daily_ops());
grant select, insert, update, delete on public.daily_ops_creation_blocks to authenticated;
alter publication supabase_realtime add table public.daily_ops_creation_blocks;

insert into public.daily_ops_creation_blocks (day_of_week, start_time, owner_name, creatives)
select * from (values
  (6,'10:00'::time,'Sara',4),(6,'12:00','Peter',4),(6,'14:00','Chase',3),(6,'15:30','Anaz',1),
  (0,'10:00','Anaz',2),(0,'11:00','Tengku',3),(0,'12:30','Razeen',3),(0,'14:00','Sahid',2),(0,'15:00','Dev',1),(0,'15:30','Reza',1)
) v(d,t,o,c)
where not exists (select 1 from public.daily_ops_creation_blocks);

create or replace function public.sync_daily_ops_today()
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_work_date date; v_dow int; v_first_start int; v_cursor int := null; v_sched int;
  v_post_start int; v_post_end int; v_engage_end int; v_account uuid; v_sara_account uuid;
  v_owner text; v_count int := 0; r record; c record; v_cs int; v_ce int;
begin
  if not public.can_access_daily_ops() then
    raise exception 'Not authorized for Daily Ops' using errcode = '42501';
  end if;

  v_work_date := (((current_timestamp at time zone 'Asia/Singapore') - interval '2 hours'))::date;
  v_dow := extract(dow from v_work_date)::int;

  delete from public.daily_ops_schedule s
  where s.work_date = v_work_date and s.auto_generated = true and s.auto_key is not null
    and s.auto_key <> 'pre:sara-comments' and s.auto_key not like 'create:%'
    and not exists (
      select 1 from public.daily_ops_weekly_posts w
      where w.active = true and w.day_of_week = v_dow
        and (s.auto_key = 'post:' || w.id::text
             or (s.auto_key = 'engage:' || w.id::text and lower(trim(coalesce(w.owner_name,''))) <> 'sara')));

  select min(extract(hour from w.start_time)::int * 60 + extract(minute from w.start_time)::int)
    into v_first_start
  from public.daily_ops_weekly_posts w where w.active = true and w.day_of_week = v_dow;

  if v_first_start is not null then
    select a.id into v_sara_account from public.daily_ops_accounts a
    where a.active = true and lower(trim(a.owner_name)) = 'sara' order by a.sort_order limit 1;

    insert into public.daily_ops_schedule
      (work_date,start_time,end_time,task,account_id,priority,status,notes,auto_generated,auto_key,created_by,updated_by)
    values (v_work_date,
      make_time((((v_first_start - 30 + 1440) % 1440) / 60)::int, ((v_first_start - 30 + 1440) % 60)::int, 0),
      make_time(((v_first_start % 1440) / 60)::int, (v_first_start % 60)::int, 0),
      'Sara · Respond to 20 comments', v_sara_account, 'high', 'due',
      'Respond to 20 comments on Sara''s posts before the posting run begins.', true, 'pre:sara-comments', auth.uid(), auth.uid())
    on conflict (work_date, auto_key) where auto_key is not null
    do update set start_time = excluded.start_time, end_time = excluded.end_time, task = excluded.task,
      account_id = excluded.account_id, priority = excluded.priority, notes = excluded.notes,
      auto_generated = true, updated_at = now(), updated_by = auth.uid();
    v_count := v_count + 1;
  else
    delete from public.daily_ops_schedule
    where work_date = v_work_date and auto_generated = true and auto_key = 'pre:sara-comments';
  end if;

  for r in select * from public.daily_ops_weekly_posts where active = true and day_of_week = v_dow order by start_time loop
    v_owner := lower(trim(coalesce(r.owner_name,'')));
    select a.id into v_account from public.daily_ops_accounts a
    where a.active = true and lower(trim(a.owner_name)) = v_owner order by a.sort_order limit 1;

    v_sched := extract(hour from r.start_time)::int * 60 + extract(minute from r.start_time)::int;
    if v_cursor is null or v_sched > v_cursor then v_cursor := v_sched; end if;
    v_post_start := v_cursor; v_post_end := v_post_start + 60;

    insert into public.daily_ops_schedule
      (work_date,start_time,end_time,task,account_id,priority,status,notes,auto_generated,auto_key,created_by,updated_by)
    values (v_work_date,
      make_time(((v_post_start % 1440) / 60)::int,(v_post_start % 60)::int,0),
      make_time(((v_post_end % 1440) / 60)::int,(v_post_end % 60)::int,0),
      coalesce(r.owner_name,'Account') || ' · Post ' || coalesce(r.content_code,'Post'), v_account, 'high','due',
      '1-hour posting block · GMT+8 · ' || coalesce(r.label,r.owner_name,'Account'), true, 'post:' || r.id::text, auth.uid(),auth.uid())
    on conflict (work_date, auto_key) where auto_key is not null
    do update set start_time = excluded.start_time, end_time = excluded.end_time, task = excluded.task,
      account_id = excluded.account_id, priority = excluded.priority, notes = excluded.notes,
      auto_generated = true, updated_at = now(), updated_by = auth.uid();
    v_count := v_count + 1;

    if v_owner <> 'sara' then
      v_engage_end := v_post_end + 15;
      insert into public.daily_ops_schedule
        (work_date,start_time,end_time,task,account_id,priority,status,notes,auto_generated,auto_key,created_by,updated_by)
      values (v_work_date,
        make_time(((v_post_end % 1440) / 60)::int,(v_post_end % 60)::int,0),
        make_time(((v_engage_end % 1440) / 60)::int,(v_engage_end % 60)::int,0),
        coalesce(r.owner_name,'Account') || ' · Respond to past post comments', v_account, 'high','due',
        'Immediately after posting · 15-minute block to respond to comments on ' || coalesce(r.owner_name,'Account') || '''s past post.',
        true, 'engage:' || r.id::text, auth.uid(),auth.uid())
      on conflict (work_date, auto_key) where auto_key is not null
      do update set start_time = excluded.start_time, end_time = excluded.end_time, task = excluded.task,
        account_id = excluded.account_id, priority = excluded.priority, notes = excluded.notes,
        auto_generated = true, updated_at = now(), updated_by = auth.uid();
      v_count := v_count + 1;
      v_cursor := v_engage_end;
    else
      delete from public.daily_ops_schedule
      where work_date = v_work_date and auto_generated = true and auto_key = 'engage:' || r.id::text;
      v_cursor := v_post_end;
    end if;
  end loop;

  -- Post creation blocks (HQ → Schedule → Post creation)
  delete from public.daily_ops_schedule s
  where s.work_date = v_work_date and s.auto_generated = true and s.auto_key like 'create:%'
    and not exists (select 1 from public.daily_ops_creation_blocks b
                    where b.active and b.day_of_week = v_dow and s.auto_key = 'create:' || b.id::text);

  for c in select * from public.daily_ops_creation_blocks where active and day_of_week = v_dow order by start_time loop
    select a.id into v_account from public.daily_ops_accounts a
    where a.active = true and lower(trim(a.owner_name)) = lower(trim(c.owner_name)) order by a.sort_order limit 1;
    v_cs := extract(hour from c.start_time)::int * 60 + extract(minute from c.start_time)::int;
    v_ce := v_cs + c.creatives * c.minutes_per;
    insert into public.daily_ops_schedule
      (work_date,start_time,end_time,task,account_id,priority,status,notes,auto_generated,auto_key,created_by,updated_by)
    values (v_work_date,
      make_time(((v_cs % 1440) / 60)::int,(v_cs % 60)::int,0),
      make_time(((v_ce % 1440) / 60)::int,(v_ce % 60)::int,0),
      c.owner_name || ' · Create ' || c.creatives || ' creative' || case when c.creatives = 1 then '' else 's' end,
      v_account, 'high', 'due',
      c.creatives || ' × ' || c.minutes_per || ' min' || coalesce(' · made by ' || c.maker, '') || coalesce(' · ' || nullif(c.notes,''), ''),
      true, 'create:' || c.id::text, auth.uid(), auth.uid())
    on conflict (work_date, auto_key) where auto_key is not null
    do update set start_time = excluded.start_time, end_time = excluded.end_time, task = excluded.task,
      account_id = excluded.account_id, notes = excluded.notes, auto_generated = true, updated_at = now(), updated_by = auth.uid();
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'work_date', v_work_date, 'day_of_week', v_dow, 'generated', v_count);
end;
$function$;
