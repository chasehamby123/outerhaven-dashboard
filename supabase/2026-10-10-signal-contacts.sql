-- Signal contacts (10 Oct 2026, Tengku): who to contact at each Credit / BDC / UCC target and how.
-- Public companies: CFO / CEO names from the SEC certifications (scripts/officers.py on GitHub).
-- Everyone: LinkedIn profile + company website via Brave Search, work email via Hunter (edge function signal-contacts).
-- people: [{name, title, role 'cfo'|'ceo'|'other', source 'sec'|'search', source_url, filed, linkedin, email, email_score,
--           email_status, status 'confirmed'|'wrong'|null, by, at}]
create table if not exists public.signal_contacts (
  kind text not null check (kind in ('credit', 'bdc', 'ucc')),
  key text not null,                 -- credit: cik, bdc / ucc: company_key
  company_name text,
  people jsonb not null default '[]'::jsonb,
  phone text,
  website text,
  domain text,
  officer_change jsonb,              -- SEC 8-K Item 5.02 filed after the certification: {date, url}
  sec_checked_at timestamptz,
  looked_up_at timestamptz,          -- last Brave lookup
  lookup_note text,
  updated_at timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.signal_contacts enable row level security;
create policy signal_contacts_read on public.signal_contacts for select to authenticated using (public.can_access_dashboard());
-- Writes go through the edge function (service role) only.

-- Search + email keys: pasted by an admin in HQ (write-only), read by the edge function.
create or replace function public.set_contact_key(p_name text, p_value text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.can_access_dashboard() then raise exception 'admins only'; end if;
  if p_name not in ('BRAVE_SEARCH_KEY', 'HUNTER_API_KEY') then raise exception 'unknown key'; end if;
  if coalesce(trim(p_value), '') = '' then raise exception 'empty key'; end if;
  insert into public.integration_secrets (key, secret_value, updated_at) values (p_name, trim(p_value), now())
  on conflict (key) do update set secret_value = excluded.secret_value, updated_at = now();
end $$;
create or replace function public.contact_keys_set() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case when public.can_access_dashboard() then jsonb_build_object(
    'brave', exists (select 1 from public.integration_secrets where key = 'BRAVE_SEARCH_KEY'),
    'hunter', exists (select 1 from public.integration_secrets where key = 'HUNTER_API_KEY')) else '{}'::jsonb end
$$;
grant execute on function public.set_contact_key(text, text), public.contact_keys_set() to authenticated;

-- Cron: every 30 min, look up the next batch of targets with no lookup yet (capped per day in the function).
create or replace function public.invoke_signal_contacts() returns bigint
language plpgsql security definer set search_path to '' as $$
declare k text; rid bigint;
begin
  select secret_value into k from public.integration_secrets where key = 'LINKEDIN_CRON_SECRET';
  if k is null then raise exception 'LINKEDIN_CRON_SECRET is missing'; end if;
  select net.http_post(
    url := 'https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/signal-contacts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-outerhaven-cron', k),
    body := '{"action":"cron"}'::jsonb, timeout_milliseconds := 10000) into rid;
  return rid;
end $$;
select cron.schedule('signal-contacts', '*/30 * * * *', 'select public.invoke_signal_contacts();');
