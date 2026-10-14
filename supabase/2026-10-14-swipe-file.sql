-- Swipe file (14 Oct 2026, Tengku): other people's LinkedIn posts we want to learn from. Someone drops screenshots + caption +
-- numbers in Growth → Playbook → "Break down a post"; resource-request action 'breakdown' fires the routine, which follows
-- routines/breakdown.md (post-breakdown skill) and writes breakdown / recreate / archetype back here.
create table if not exists public.swipe_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  added_by text,
  url text,
  author text,
  author_followers int,
  reactions int,
  comments int,
  reposts int,
  hours_live numeric,            -- how long it had been up when the numbers were read
  caption text,
  image_paths jsonb not null default '[]'::jsonb,   -- paths in the private 'swipe' bucket, in order
  note text,                     -- why we saved it
  archetype text,                -- from the breakdown (post-breakdown skill v2 list)
  breakdown jsonb,
  recreate jsonb,
  status text not null default 'new' check (status in ('new', 'queued', 'ready', 'failed')),
  job_id uuid,
  error text,
  broken_down_at timestamptz
);
alter table public.swipe_posts enable row level security;
create policy swipe_posts_admin on public.swipe_posts for all to authenticated using (public.can_access_dashboard()) with check (public.can_access_dashboard());
create index if not exists swipe_posts_created on public.swipe_posts (created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('swipe', 'swipe', false, 15728640, array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy swipe_admin_read on storage.objects for select to authenticated using (bucket_id = 'swipe' and public.can_access_dashboard());
create policy swipe_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'swipe' and public.can_access_dashboard());
