-- Outerhaven HQ · automatic LinkedIn scrape scheduler.
-- Runs inside Supabase (pg_cron + pg_net), so it works with nobody logged in.
-- Obeys growth_settings: on/off switch, frequency, hour (Malaysia time) and monthly budget cap.
-- Requires: 2026-09-28-growth.sql applied, and a Vault secret named 'hq_scrape_auth' holding the
-- bearer token the daily-ops-linkedin-sync function accepts (added by a person in Dashboard → Vault).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.growth_scrape_call(p_mode text, p_run uuid)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'hq_scrape_auth' limit 1;
  if tok is null then raise exception 'Vault secret hq_scrape_auth is missing'; end if;
  return net.http_post(
    url := 'https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/daily-ops-linkedin-sync',
    body := jsonb_build_object('mode', p_mode, 'trigger', 'auto', 'run_id', p_run),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || tok),
    timeout_milliseconds := 300000);
end $$;

create or replace function public.growth_scrape_tick()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.growth_settings; r public.growth_scrape_runs; resp record;
  local_now timestamp := now() at time zone 'Asia/Kuala_Lumpur';
  hr int := extract(hour from local_now); spent numeric; last_auto timestamptz; due boolean; req bigint; body jsonb;
begin
  -- 1. Advance an in-flight auto run: posts -> comments -> done.
  select * into r from public.growth_scrape_runs where trigger = 'auto' and status = 'running' order by started_at desc limit 1;
  if found then
    select * into resp from net._http_response where id = (r.detail->>(r.stage || '_request'))::bigint;
    if resp is null then
      if now() - r.started_at > interval '40 minutes' then
        update public.growth_scrape_runs set status = 'failed', finished_at = now(), detail = detail || jsonb_build_object('error', 'Timed out waiting for ' || r.stage) where id = r.id;
      end if;
      return 'waiting on ' || r.stage;
    end if;
    body := case when resp.content is not null and left(resp.content, 1) = '{' then resp.content::jsonb else jsonb_build_object('raw', left(coalesce(resp.content, resp.error_msg, ''), 500)) end;
    if coalesce(resp.status_code, 0) not between 200 and 299 or coalesce((body->>'ok')::boolean, false) = false then
      update public.growth_scrape_runs set status = 'failed', finished_at = now(), detail = detail || jsonb_build_object(r.stage, body, 'http_status', resp.status_code) where id = r.id;
      return 'failed at ' || r.stage;
    end if;
    if r.stage = 'posts' then
      req := public.growth_scrape_call('comments', r.id);
      update public.growth_scrape_runs set stage = 'comments', posts_saved = (body->>'posts_saved')::int, profiles_checked = (body->>'profiles_checked')::int,
        detail = detail || jsonb_build_object('posts', body, 'comments_request', req) where id = r.id;
      return 'posts done, comments started';
    end if;
    update public.growth_scrape_runs set stage = 'done', finished_at = now(), comment_threads = (body->>'comment_posts_processed')::int,
      status = case when jsonb_array_length(coalesce(body->'missing_accounts', '[]')) + jsonb_array_length(coalesce(body->'incomplete_accounts', '[]'))
                        + jsonb_array_length(coalesce(r.detail->'posts'->'missing_profiles', '[]')) > 0 then 'partial' else 'ok' end,
      detail = detail || jsonb_build_object('comments', body) where id = r.id;
    return 'run complete';
  end if;

  -- 2. Start a new run if the switch is on, it's due, and the budget allows.
  select * into s from public.growth_settings where id = 1;
  if s is null or not s.scrape_enabled then return 'auto scrape is off'; end if;
  select max(started_at) into last_auto from public.growth_scrape_runs where trigger = 'auto' and status <> 'skipped';
  due := case s.scrape_frequency
    when 'every_6h'    then last_auto is null or now() - last_auto >= interval '5 hours 50 minutes'
    when 'twice_daily' then hr in (s.scrape_hour, (s.scrape_hour + 12) % 24) and (last_auto is null or now() - last_auto >= interval '11 hours')
    when 'weekly'      then extract(isodow from local_now) = 1 and hr = s.scrape_hour and (last_auto is null or now() - last_auto >= interval '6 days')
    else                    hr = s.scrape_hour and (last_auto is null or now() - last_auto >= interval '20 hours')
  end;
  if not due then return 'not due'; end if;
  select coalesce(sum(cost_usd), 0) into spent from public.growth_scrape_runs
    where status <> 'skipped' and started_at >= (date_trunc('month', local_now) at time zone 'Asia/Kuala_Lumpur');
  if spent + s.cost_per_run > s.monthly_budget then
    if not exists (select 1 from public.growth_scrape_runs where status = 'skipped' and started_at > now() - interval '20 hours') then
      insert into public.growth_scrape_runs (trigger, status, finished_at, detail, triggered_by)
      values ('auto', 'skipped', now(), jsonb_build_object('reason', format('Monthly budget of $%s reached ($%s spent)', s.monthly_budget, spent)), null);
    end if;
    return 'budget reached';
  end if;
  insert into public.growth_scrape_runs (trigger, stage, cost_usd, triggered_by) values ('auto', 'posts', s.cost_per_run, null) returning * into r;
  req := public.growth_scrape_call('posts', r.id);
  update public.growth_scrape_runs set detail = jsonb_build_object('posts_request', req) where id = r.id;
  return 'run started';
end $$;

revoke all on function public.growth_scrape_tick() from public, anon, authenticated;
revoke all on function public.growth_scrape_call(text, uuid) from public, anon, authenticated;

-- Every 10 minutes. The switch in HQ decides whether anything actually runs.
select cron.unschedule(jobid) from cron.job where jobname = 'hq-linkedin-scrape';
select cron.schedule('hq-linkedin-scrape', '*/10 * * * *', $$select public.growth_scrape_tick()$$);
