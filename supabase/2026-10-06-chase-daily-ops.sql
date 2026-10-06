-- Chase-only recurring Daily Ops blocks.
-- Definitions recur every day; completions are tracked per work date.

create table if not exists public.chase_daily_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_time time,
  duration_min integer,
  notes text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chase_daily_block_completions (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.chase_daily_blocks(id) on delete cascade,
  work_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (block_id, work_date)
);

create index if not exists chase_daily_blocks_active_sort_idx
  on public.chase_daily_blocks (active, sort_order, start_time);

create index if not exists chase_daily_completions_date_idx
  on public.chase_daily_block_completions (work_date);

create or replace function public.can_access_chase_daily()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'chasehamby@chproduction.org'
    and exists (
      select 1
      from public.dashboard_access
      where lower(email) = 'chasehamby@chproduction.org'
        and role = 'admin'
    );
$$;

alter table public.chase_daily_blocks enable row level security;
alter table public.chase_daily_block_completions enable row level security;

drop policy if exists chase_daily_blocks_chase_only on public.chase_daily_blocks;
create policy chase_daily_blocks_chase_only
on public.chase_daily_blocks
for all
to authenticated
using (public.can_access_chase_daily())
with check (public.can_access_chase_daily());

drop policy if exists chase_daily_completions_chase_only on public.chase_daily_block_completions;
create policy chase_daily_completions_chase_only
on public.chase_daily_block_completions
for all
to authenticated
using (public.can_access_chase_daily())
with check (public.can_access_chase_daily());

grant select, insert, update, delete on public.chase_daily_blocks to authenticated;
grant select, insert, update, delete on public.chase_daily_block_completions to authenticated;
