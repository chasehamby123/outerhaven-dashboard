-- 8 Oct 2026 (RULES_VERSION 15): each next-fund row keeps the manager's own funds, so timing uses their own pace (blended with
-- the market median) and the step-up between funds is scored. history = managerHistory() at judge time (shown on the card);
-- prior_funds = earlier funds the adviser job found on EDGAR (null = never looked up); next_expected = estimated next launch.
alter table public.fund_signals add column if not exists history jsonb;
alter table public.fund_signals add column if not exists prior_funds jsonb;
alter table public.fund_signals add column if not exists next_expected date;

-- Credit signals: Peter's leverage screen (CREDIT_RULES_VERSION 4). Last calendar year EBITDA (operating income + D&A) and
-- interest expense from SEC XBRL frames (scripts/credit_signals.py).
alter table public.credit_signals add column if not exists ebitda numeric;
alter table public.credit_signals add column if not exists interest_expense numeric;
