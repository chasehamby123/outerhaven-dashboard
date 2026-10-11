-- Outreach personalisation test (11 Oct 2026, Tengku: "should we even personalise?").
-- Each Prosp account can have a second, PLAIN campaign (same message without the {{deadline}} line). Leads with a dated trigger
-- are split between the dated and plain campaigns (test_split = share that gets dated); leads without a date go plain.
-- outreach_enrollments.variant records which one each lead got, so reply rates can be compared.
alter table public.outreach_enrollments add column if not exists variant text;          -- dated | plain | email_only
alter table public.outreach_enrollments add column if not exists deadline text;         -- the exact phrase sent as {{deadline}}
alter table public.outreach_settings add column if not exists test_split numeric not null default 0.5;
-- Copies of the two Prosp LinkedIn messages, for HQ's preview in the send window (Prosp has no API to read a campaign's copy).
-- Keep them in sync with Prosp: Daily 3 → Outreach setup.
alter table public.outreach_settings add column if not exists li_template_dated text default E'Hi {{First name}},\n\nNoticed {{company}} has {{deadline}}.\n\nI''ve spent 30+ years in private credit and know most of the lenders personally. I can tell you what they''d offer {{company}} today.\n\nWould that be of interest?\n\nPeter';
alter table public.outreach_settings add column if not exists li_template_plain text default E'Hi {{First name}},\n\nI''ve spent 30+ years in private credit and know most of the lenders personally. I can tell you what they''d offer {{company}} today.\n\nWould that be of interest?\n\nPeter';
