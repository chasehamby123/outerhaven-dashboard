-- Reply assist needs a Claude API key. Admins paste it in HQ -> Growth -> Reply assist (write-only, never shown again).
-- Same pattern as set_prosp_key. Secret name: ANTHROPIC_API_KEY (integration_secrets).
create or replace function public.set_anthropic_key(p_value text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.can_access_dashboard() then raise exception 'admins only'; end if;
  if coalesce(trim(p_value), '') = '' then raise exception 'empty key'; end if;
  insert into public.integration_secrets (key, secret_value, updated_at) values ('ANTHROPIC_API_KEY', trim(p_value), now())
  on conflict (key) do update set secret_value = excluded.secret_value, updated_at = now();
end $$;
create or replace function public.anthropic_key_set() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.can_access_dashboard() and exists (select 1 from public.integration_secrets where key = 'ANTHROPIC_API_KEY')
$$;
grant execute on function public.set_anthropic_key(text), public.anthropic_key_set() to authenticated;
