-- Deals: a Claude teaser rewrite no longer wipes the current teaser. teaser_job_id = the latest job asked for,
-- teaser_ready_job = the job the stored teaser came from; HQ copies a finished job over only when they differ.
alter table public.deals add column if not exists teaser_ready_job uuid;
-- one-off backfill (run 10 Oct 2026 via SQL): update deals set teaser_ready_job = teaser_job_id where teaser is not null;
