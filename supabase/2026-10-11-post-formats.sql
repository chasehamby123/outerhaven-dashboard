-- Post formats: plan a format per posting slot, detect what actually went out, check the two match (11 Oct 2026, Tengku).
-- A format is ours ("Presentation", "PDF carousel") and maps to what LinkedIn shows (linkedin_type) plus, for documents,
-- the page shape (landscape slides = Presentation, portrait/square pages = PDF carousel). Editable in HQ (Schedule → Formats).
create table if not exists public.post_formats (
  key text primary key,
  label text not null,
  linkedin_type text not null check (linkedin_type in ('text','image','multi_image','document','video','article','poll')),
  orientation text not null default 'any' check (orientation in ('any','landscape','portrait','square','portrait_or_square')),
  how_to text,
  sort int not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.post_formats enable row level security;
create policy post_formats_read on public.post_formats for select to authenticated using (public.can_access_daily_ops());
create policy post_formats_write on public.post_formats for all to authenticated using (public.can_access_dashboard()) with check (public.can_access_dashboard());

insert into public.post_formats (key, label, linkedin_type, orientation, how_to, sort) values
  ('image', 'Single image', 'image', 'any', 'One image attached to the post.', 10),
  ('multi_image', 'Multi-image', 'multi_image', 'any', 'Two or more images attached (LinkedIn shows a grid).', 20),
  ('presentation', 'Presentation', 'document', 'landscape', 'Slides exported as a PDF in 16:9 (landscape), uploaded with "Add a document".', 30),
  ('pdf', 'PDF carousel', 'document', 'portrait_or_square', 'Portrait (4:5) or square pages exported as a PDF, uploaded with "Add a document".', 40),
  ('video', 'Video', 'video', 'any', 'Native video upload (not a link).', 50),
  ('text', 'Text only', 'text', 'any', 'No media attached.', 60),
  ('poll', 'Poll', 'poll', 'any', 'LinkedIn poll.', 70),
  ('article', 'Article / link', 'article', 'any', 'Article or link preview card.', 80)
on conflict (key) do nothing;

-- The weekly template's default format per slot, and one-off plans for a slot on a date (overrides + experiments).
alter table public.daily_ops_weekly_posts add column if not exists format_key text references public.post_formats(key);
create table if not exists public.post_plan (
  id uuid primary key default gen_random_uuid(),
  weekly_post_id uuid not null references public.daily_ops_weekly_posts(id) on delete cascade,
  work_date date not null,
  format_key text references public.post_formats(key),
  experiment_id uuid references public.daily_ops_experiments(id) on delete set null,
  arm text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (weekly_post_id, work_date)
);
alter table public.post_plan enable row level security;
create policy post_plan_rw on public.post_plan for all to authenticated using (public.can_access_daily_ops()) with check (public.can_access_daily_ops());

-- What the scraper saw, and the match to the planned slot (written by daily-ops-linkedin-auto v11).
alter table public.daily_ops_posts add column if not exists detected_format text;          -- post_formats.key it looks like
alter table public.daily_ops_posts add column if not exists linkedin_type text;            -- text | image | multi_image | document | video | article | poll
alter table public.daily_ops_posts add column if not exists image_count int;
alter table public.daily_ops_posts add column if not exists doc_pages int;
alter table public.daily_ops_posts add column if not exists doc_orientation text;          -- landscape | portrait | square
alter table public.daily_ops_posts add column if not exists creative_paths jsonb not null default '[]'::jsonb;  -- every slide / image we saved
alter table public.daily_ops_posts add column if not exists text_features jsonb;           -- counted from the caption (scraper)
alter table public.daily_ops_posts add column if not exists breakdown jsonb;               -- creative + copy parts (Claude, post-breakdown skill)
alter table public.daily_ops_posts add column if not exists breakdown_at timestamptz;
alter table public.daily_ops_posts add column if not exists slot_weekly_id uuid;           -- the posting slot it filled
alter table public.daily_ops_posts add column if not exists slot_date date;
alter table public.daily_ops_posts add column if not exists planned_format text;
alter table public.daily_ops_posts add column if not exists format_check text;             -- match | mismatch | unplanned | unknown
alter table public.daily_ops_posts add column if not exists experiment_id uuid;
alter table public.daily_ops_posts add column if not exists experiment_arm text;

-- Format experiments: how many posts per arm, and which format each arm uses.
alter table public.daily_ops_experiments add column if not exists posts_per_arm int;
alter table public.daily_ops_experiments add column if not exists format_a text;
alter table public.daily_ops_experiments add column if not exists format_b text;
