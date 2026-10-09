-- Reply assist runs on the Claude Code routine (no API key): reply_drafts holds the job input and the routine writes the draft back.
alter table public.reply_drafts
  add column if not exists status text not null default 'ready',
  add column if not exists input jsonb,
  add column if not exists job_id uuid,
  add column if not exists background text,
  add column if not exists next_step text,
  add column if not exists error text,
  add column if not exists progress text,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists reply_drafts_working on public.reply_drafts (status, created_at) where status = 'working';
-- Drafts stuck > 15 min become errors (same idea as chat_sweep).
create or replace function public.reply_sweep() returns int language sql security definer set search_path to 'public' as $$
  with u as (update public.reply_drafts set status = 'error', error = 'Claude did not finish in time. Press Draft again.', updated_at = now()
    where status = 'working' and created_at < now() - interval '15 minutes' returning 1) select count(*)::int from u $$;
