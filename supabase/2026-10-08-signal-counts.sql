-- Pipeline tab counts without downloading the signal tables (8 Oct 2026: Fund signals took ~2 min to open because HQ
-- pulled all 17k fund_signals rows, 89% of them cut). Security invoker: RLS (admin only) still applies.
create or replace function public.signal_target_counts()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'funds', (select count(distinct coalesce(fund_key, id::text)) from fund_signals
              where verdict = 'target' and coalesce(status, 'new') not in ('added', 'dismissed')),
    'funds_cut', json_build_object(
      'live', (select count(distinct coalesce(fund_key, id::text)) from fund_signals
               where list = 'live' and verdict = 'cut' and coalesce(status, 'new') not in ('added', 'dismissed')),
      'fund1', (select count(distinct coalesce(fund_key, id::text)) from fund_signals
                where list = 'fund1' and verdict = 'cut' and coalesce(status, 'new') not in ('added', 'dismissed'))),
    'credit', (select count(*) from credit_signals
               where verdict = 'target' and coalesce(status, 'new') not in ('added', 'dismissed')),
    'ucc', (select count(*) from ucc_signals
            where verdict = 'target' and coalesce(status, 'new') not in ('added', 'dismissed'))
  );
$$;
grant execute on function public.signal_target_counts() to authenticated;
