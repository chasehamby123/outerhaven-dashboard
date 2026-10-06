-- Reliable fund-signal runs (6 Oct 2026). GitHub's own cron is best-effort: Oct 3-5 it fired ~6 of ~25 runs a day, hours
-- late. pg_cron here is on time, so it starts the GitHub workflow itself (workflow_dispatch) with a token an admin pastes in
-- HQ → Pipeline → Fund signals → Setup (write-only; never entered by Claude). Without a token the jobs do nothing.
create table if not exists public.fund_dispatch_log (
  id bigserial primary key,
  mode text not null,
  request_id bigint,
  created_at timestamptz not null default now()
);
alter table public.fund_dispatch_log enable row level security;
create policy fund_dispatch_log_admin on public.fund_dispatch_log for select using (public.can_access_dashboard());

create or replace function public.dispatch_fund_workflow(p_mode text)
returns bigint language plpgsql security definer set search_path = public as $$
declare tok text; rid bigint;
begin
  select secret_value into tok from public.integration_secrets where key = 'GITHUB_DISPATCH_TOKEN';
  if coalesce(tok, '') = '' then return null; end if;
  select net.http_post(
    url := 'https://api.github.com/repos/chasehamby123/outerhaven-dashboard/actions/workflows/fund-signals.yml/dispatches',
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('mode', p_mode)),
    headers := jsonb_build_object('Authorization', 'Bearer ' || tok, 'Accept', 'application/vnd.github+json',
                                  'User-Agent', 'outerhaven-hq', 'X-GitHub-Api-Version', '2022-11-28', 'Content-Type', 'application/json')
  ) into rid;
  insert into public.fund_dispatch_log (mode, request_id) values (p_mode, rid);
  return rid;
end $$;
revoke all on function public.dispatch_fund_workflow(text) from public, anon, authenticated;

create or replace function public.set_github_dispatch_token(p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_dashboard() then raise exception 'admins only'; end if;
  if coalesce(trim(p_value), '') = '' then
    delete from public.integration_secrets where key = 'GITHUB_DISPATCH_TOKEN';
  else
    insert into public.integration_secrets (key, secret_value, updated_at) values ('GITHUB_DISPATCH_TOKEN', trim(p_value), now())
    on conflict (key) do update set secret_value = excluded.secret_value, updated_at = now();
  end if;
end $$;

-- Status for HQ: token set? last dispatches and GitHub's answer (204 = started).
create or replace function public.github_dispatch_status()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_dashboard() then raise exception 'admins only'; end if;
  return jsonb_build_object(
    'token_set', exists (select 1 from public.integration_secrets where key = 'GITHUB_DISPATCH_TOKEN' and coalesce(secret_value, '') <> ''),
    'recent', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select l.mode, l.created_at, r.status_code, left(r.content::text, 200) as body
      from public.fund_dispatch_log l left join net._http_response r on r.id = l.request_id
      order by l.created_at desc limit 8) x), '[]'::jsonb));
end $$;
grant execute on function public.set_github_dispatch_token(text) to authenticated;
grant execute on function public.github_dispatch_status() to authenticated;

select cron.schedule('fund-signals-daily-dispatch', '40 1 * * *', $$select public.dispatch_fund_workflow('daily')$$);
select cron.schedule('fund-signals-check-dispatch', '10 * * * *', $$select public.dispatch_fund_workflow('check')$$);
