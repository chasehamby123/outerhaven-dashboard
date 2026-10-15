-- BDC lanes + ownership (12 Oct 2026; bdc-signals rules v4). Global Integrated Flooring ranked No. 1 while it was a stressed,
-- PE-owned $13M loan: a lender's problem, not a company that hires us.
--   lane 'refi'      = performing loan with a deadline: outreach to the company (Daily 3, Send today's batch).
--   lane 'loan_sale' = marked under 85¢ / non-accrual / past due and marked down: Peter pitches the BDC to sell the loan.
--   owner*           = PE or corporate owner found by signal-contacts (Brave search); refi rows with an owner drop to Maybe.
alter table public.bdc_signals add column if not exists lane text;
alter table public.bdc_signals add column if not exists owner text;
alter table public.bdc_signals add column if not exists owner_url text;
alter table public.bdc_signals add column if not exists owner_checked_at timestamptz;
create index if not exists bdc_signals_lane on public.bdc_signals (lane, verdict, score desc);

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
            where verdict = 'target' and coalesce(status, 'new') not in ('added', 'dismissed')),
    'bdc', (select count(*) from bdc_signals
            where verdict = 'target' and coalesce(lane, 'refi') = 'refi' and coalesce(status, 'new') not in ('added', 'dismissed')),
    'bdc_sale', (select count(*) from bdc_signals
            where verdict = 'target' and lane = 'loan_sale' and coalesce(status, 'new') not in ('added', 'dismissed'))
  );
$$;
grant execute on function public.signal_target_counts() to authenticated;
