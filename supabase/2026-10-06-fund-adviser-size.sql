-- Adviser size for fund leads (6 Oct 2026): who manages the fund (SEC Form ADV) and how much they manage in total.
-- Tengku's rule: manager total under $150M = top target, $150-500M = keep but lower priority, over $500M = cut.
alter table public.fund_signals add column if not exists adviser_crd text;
alter table public.fund_signals add column if not exists adviser_name text;
alter table public.fund_signals add column if not exists adviser_type text;          -- 'Registered' | 'Exempt reporting'
alter table public.fund_signals add column if not exists adviser_raum numeric;       -- Form ADV 5.F(2)(c), registered only
alter table public.fund_signals add column if not exists adviser_pf_gav numeric;     -- total gross assets of its private funds (Sched. D 7.B.1)
alter table public.fund_signals add column if not exists adviser_pf_count int;
alter table public.fund_signals add column if not exists adviser_match text;         -- how the fund was tied to the adviser
alter table public.fund_signals add column if not exists adviser_filed date;         -- adviser's latest Form ADV
alter table public.fund_signals add column if not exists adviser_checked_at timestamptz;
alter table public.fund_signals add column if not exists manager_total numeric;      -- the size the rule uses
alter table public.fund_signals add column if not exists manager_total_src text;     -- where it came from
