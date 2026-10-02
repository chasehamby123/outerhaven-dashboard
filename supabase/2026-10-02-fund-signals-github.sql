-- Fund signals v2: the GitHub Actions job (edgartools) posts to fund-signals action ingest with x-fund-ingest.
insert into public.integration_secrets (key, secret_value)
select 'FUND_INGEST_SECRET', encode(extensions.gen_random_bytes(24), 'hex')
where not exists (select 1 from public.integration_secrets where key = 'FUND_INGEST_SECRET');

-- Admins copy the key from HQ (Fund signals → Settings) into the GitHub secret FUND_INGEST_KEY.
create or replace function public.fund_ingest_key()
 returns text language plpgsql security definer set search_path to ''
as $function$
begin
  if public.dashboard_role() is distinct from 'admin' then raise exception 'Admins only' using errcode = '42501'; end if;
  return (select secret_value from public.integration_secrets where key = 'FUND_INGEST_SECRET');
end;
$function$;
revoke all on function public.fund_ingest_key() from public, anon;
grant execute on function public.fund_ingest_key() to authenticated;

-- "Check for Fund II" in HQ queues the signal through the edge function (action queue); the GitHub job picks queued ones up hourly.
