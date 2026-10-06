-- In-app chat (HQ chat button): everyone's own tabs (threads) + permanent history.
-- A message goes to edge function hq-chat, which stores it and fires the "OuterHaven resource builder" routine
-- (job row in resource_jobs with payload.type = 'chat'); the routine follows routines/chat.md and writes its answer
-- into the assistant placeholder row in chat_messages. Nothing is ever deleted: closing a tab only archives it.
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  owner_email text,
  title text not null default 'New chat',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete restrict,
  role text not null check (role in ('user', 'assistant')),
  body text not null default '',
  status text not null default 'done' check (status in ('working', 'done', 'error')),
  progress text,
  author_email text,
  page text,
  job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_messages_thread on public.chat_messages (thread_id, created_at);
create index if not exists chat_threads_owner on public.chat_threads (owner_id, updated_at desc);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
-- You only ever see your own tabs. Messages are written by the edge function / routine (service role), never by the browser.
create policy chat_threads_own_read on public.chat_threads for select to authenticated using (owner_id = auth.uid() and public.can_access_daily_ops());
create policy chat_threads_own_update on public.chat_threads for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy chat_messages_own_read on public.chat_messages for select to authenticated
  using (public.can_access_daily_ops() and exists (select 1 from public.chat_threads t where t.id = thread_id and t.owner_id = auth.uid()));
grant select on public.chat_messages to authenticated;
grant select on public.chat_threads to authenticated;
grant update (title, archived) on public.chat_threads to authenticated;
alter publication supabase_realtime add table public.chat_messages;

alter table public.growth_settings add column if not exists chat_daily_cap int not null default 40;

-- Replies that never came back (routine failed or timed out) stop spinning after 20 minutes.
create or replace function public.chat_sweep() returns int
language sql security definer set search_path to 'public' as $$
  with u as (
    update public.chat_messages set status = 'error', progress = null, updated_at = now(),
      body = case when body = '' then 'Claude did not answer in time. Send the message again.' else body end
    where role = 'assistant' and status = 'working' and created_at < now() - interval '20 minutes' and public.can_access_daily_ops()
    returning 1)
  select count(*)::int from u
$$;
grant execute on function public.chat_sweep() to authenticated;
