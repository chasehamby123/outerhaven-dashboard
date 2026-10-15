-- LinkedIn first, email later (10 Oct 2026, Tengku): a target with a LinkedIn profile goes to Prosp on send day; its email
-- waits email_delay_days and only goes to PlusVibe if they haven't replied on LinkedIn (outreach cron sends it).
alter table public.outreach_settings add column if not exists email_delay_days int not null default 3;
alter table public.outreach_enrollments add column if not exists email_due_at timestamptz;
alter table public.outreach_enrollments add column if not exists email_payload jsonb;
