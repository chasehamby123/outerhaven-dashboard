-- Extra Apify accounts for the scraper (slots 2-9). Slot 1 is the original APIFY_TOKEN.
-- Tokens are write-only from the browser: admins paste one in HQ -> Growth -> Scraper; nothing ever reads them back.
create or replace function public.set_apify_token(p_slot int, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_dashboard() then raise exception 'admins only'; end if;
  if p_slot is null or p_slot < 2 or p_slot > 9 then raise exception 'slot must be 2-9'; end if;
  if coalesce(trim(p_value), '') = '' then
    delete from public.integration_secrets where key = 'APIFY_TOKEN_' || p_slot;
  else
    insert into public.integration_secrets (key, secret_value, updated_at) values ('APIFY_TOKEN_' || p_slot, trim(p_value), now())
    on conflict (key) do update set secret_value = excluded.secret_value, updated_at = now();
  end if;
end $$;
revoke all on function public.set_apify_token(int, text) from public, anon;
grant execute on function public.set_apify_token(int, text) to authenticated;

create or replace function public.apify_token_slots()
returns int[] language sql stable security definer set search_path = public as $$
  select case when public.can_access_dashboard()
    then coalesce((select array_agg(substring(key from 13)::int order by substring(key from 13)::int) from public.integration_secrets where key ~ '^APIFY_TOKEN_[0-9]+$' and secret_value <> ''), '{}')
    else '{}'::int[] end;
$$;
revoke all on function public.apify_token_slots() from public, anon;
grant execute on function public.apify_token_slots() to authenticated;
