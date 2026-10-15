-- Omnichannel outreach (10 Oct 2026, Tengku): one click sends the day's batch to LinkedIn (Prosp) and email (PlusVibe).
-- Sequences and copy live in the Prosp / PlusVibe campaigns; HQ enrols leads with personalisation fields and stops the other
-- channel when someone replies. Edge function: supabase/functions/outreach.

-- Settings (id 1). prosp: [{owner, campaign_id, list_id, sender, per_day}] = one Prosp campaign per LinkedIn account.
create table if not exists public.outreach_settings (
  id int primary key default 1 check (id = 1),
  prosp jsonb not null default '[]'::jsonb,
  plusvibe_workspace_id text,
  plusvibe_campaign_id text,
  bdc_per_day int not null default 10,
  credit_per_day int not null default 10,
  min_email_score int not null default 90,
  updated_at timestamptz not null default now()
);
insert into public.outreach_settings (id) values (1) on conflict do nothing;
alter table public.outreach_settings enable row level security;
create policy outreach_settings_read on public.outreach_settings for select to authenticated using (public.can_access_dashboard());
create policy outreach_settings_write on public.outreach_settings for update to authenticated using (public.can_access_dashboard()) with check (public.can_access_dashboard());

-- One row per company enrolled (kind + key, same keys as signal_contacts).
create table if not exists public.outreach_enrollments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('credit', 'bdc', 'ucc')),
  key text not null,
  company_name text,
  person_name text,
  title text,
  linkedin_url text,
  email text,
  owner text,                          -- which LinkedIn account / person runs it
  person_id uuid references public.people(id) on delete set null,
  prosp_campaign_id text,
  prosp_status text,                   -- added | skipped | failed
  prosp_error text,
  plusvibe_status text,                -- added | skipped | failed | stopped
  plusvibe_error text,
  status text not null default 'sent' check (status in ('sent', 'replied', 'stopped', 'failed')),
  reply_channel text,
  replied_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  unique (kind, key)
);
alter table public.outreach_enrollments enable row level security;
create policy outreach_enrollments_read on public.outreach_enrollments for select to authenticated using (public.can_access_dashboard());

-- Daily channel numbers (Prosp analytics + PlusVibe events), for the Scoreboard.
create table if not exists public.outreach_daily (
  day date not null,
  channel text not null,               -- linkedin | email
  action text not null,                -- e.g. connection_sent, message_sent, replied, email_sent, bounced
  count int not null default 0,
  primary key (day, channel, action)
);
alter table public.outreach_daily enable row level security;
create policy outreach_daily_read on public.outreach_daily for select to authenticated using (public.can_access_dashboard());

-- Keys: PlusVibe joins the write-only key setter; status shows which are saved.
create or replace function public.set_contact_key(p_name text, p_value text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.can_access_dashboard() then raise exception 'admins only'; end if;
  if p_name not in ('BRAVE_SEARCH_KEY', 'HUNTER_API_KEY', 'PLUSVIBE_API_KEY', 'PROSP_API_KEY') then raise exception 'unknown key'; end if;
  if coalesce(trim(p_value), '') = '' then raise exception 'empty key'; end if;
  insert into public.integration_secrets (key, secret_value, updated_at) values (p_name, trim(p_value), now())
  on conflict (key) do update set secret_value = excluded.secret_value, updated_at = now();
end $$;
create or replace function public.contact_keys_set() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case when public.can_access_dashboard() then jsonb_build_object(
    'brave', exists (select 1 from public.integration_secrets where key = 'BRAVE_SEARCH_KEY'),
    'hunter', exists (select 1 from public.integration_secrets where key = 'HUNTER_API_KEY'),
    'plusvibe', exists (select 1 from public.integration_secrets where key = 'PLUSVIBE_API_KEY'),
    'prosp', exists (select 1 from public.integration_secrets where key = 'PROSP_API_KEY')) else '{}'::jsonb end
$$;

-- PlusVibe webhook token (random, made once) so the reply webhook URL can be pasted into PlusVibe.
insert into public.integration_secrets (key, secret_value, updated_at)
select 'PLUSVIBE_WEBHOOK_TOKEN', replace(gen_random_uuid()::text, '-', ''), now()
where not exists (select 1 from public.integration_secrets where key = 'PLUSVIBE_WEBHOOK_TOKEN');
create or replace function public.plusvibe_webhook_url() returns text
language sql stable security definer set search_path to 'public' as $$
  select case when public.can_access_dashboard() then
    'https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/outreach?hook=plusvibe&token=' || (select secret_value from public.integration_secrets where key = 'PLUSVIBE_WEBHOOK_TOKEN') end
$$;
grant execute on function public.plusvibe_webhook_url() to authenticated;

-- Cron: every 20 min, stop the other channel for anyone who replied, and pull channel analytics once a day.
create or replace function public.invoke_outreach_cron() returns bigint
language plpgsql security definer set search_path to '' as $$
declare k text; rid bigint;
begin
  select secret_value into k from public.integration_secrets where key = 'LINKEDIN_CRON_SECRET';
  if k is null then raise exception 'LINKEDIN_CRON_SECRET is missing'; end if;
  select net.http_post(
    url := 'https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/outreach',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-outerhaven-cron', k),
    body := '{"action":"cron"}'::jsonb, timeout_milliseconds := 10000) into rid;
  return rid;
end $$;
select cron.schedule('outreach-cron', '*/20 * * * *', 'select public.invoke_outreach_cron();');
