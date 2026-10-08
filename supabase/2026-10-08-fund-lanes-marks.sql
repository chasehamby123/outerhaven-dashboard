-- 8 Oct 2026 (Tengku + Peter call): fund signals get a stage (is the current fund still raising, closed, or unclear?) and a
-- strategy tag, both written by classify() in supabase/functions/fund-signals/rules.js. Plus team stars and flags on every
-- signal table (shared: everyone sees who starred/flagged what).
alter table public.fund_signals add column if not exists stage text;
alter table public.fund_signals add column if not exists strategy text;

alter table public.fund_signals   add column if not exists starred_by text, add column if not exists starred_at timestamptz,
  add column if not exists flagged_by text, add column if not exists flagged_at timestamptz, add column if not exists flag_note text;
alter table public.credit_signals add column if not exists starred_by text, add column if not exists starred_at timestamptz,
  add column if not exists flagged_by text, add column if not exists flagged_at timestamptz, add column if not exists flag_note text;
alter table public.ucc_signals    add column if not exists starred_by text, add column if not exists starred_at timestamptz,
  add column if not exists flagged_by text, add column if not exists flagged_at timestamptz, add column if not exists flag_note text;

create index if not exists fund_signals_marked on public.fund_signals (list) where starred_at is not null or flagged_at is not null;
