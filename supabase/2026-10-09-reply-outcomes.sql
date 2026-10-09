-- Reply assist learns from results: every draft records the play (approach) and the lead type; reply_outcomes marks whether the
-- lead wrote back (a later draft on the same chat, or the inbox sync shows them as last sender after the draft). The routine prefers
-- the play with the best reply rate per lead type once a pair has 20+ finished drafts (reply_approach_stats).
alter table public.reply_drafts add column if not exists approach text, add column if not exists prospect_url text, add column if not exists lead_type text;
create or replace view public.reply_outcomes with (security_invoker = true) as
select d.id, d.created_at, d.account_name, d.approach, d.lead_type, d.intent,
  case when exists (select 1 from public.reply_drafts n where n.thread_key = d.thread_key and n.account_name = d.account_name and n.created_at > d.created_at + interval '10 minutes')
         or exists (select 1 from public.inbox_threads t where t.thread_key = d.thread_key and lower(t.account_name) = lower(d.account_name) and t.last_sender = 'them' and t.last_at > d.created_at + interval '10 minutes')
       then 'replied'
       when d.created_at > now() - interval '24 hours' then 'pending' else 'no_reply' end as outcome
from public.reply_drafts d where d.status = 'ready' and d.thread_key is not null;
grant select on public.reply_outcomes to authenticated;
create or replace view public.reply_approach_stats with (security_invoker = true) as
select approach, lead_type, count(*) filter (where outcome <> 'pending')::int as n,
  count(*) filter (where outcome = 'replied')::int as replied,
  round(100.0 * count(*) filter (where outcome = 'replied') / nullif(count(*) filter (where outcome <> 'pending'), 0), 1) as reply_rate
from public.reply_outcomes where approach is not null group by 1, 2;
grant select on public.reply_approach_stats to authenticated;
-- Persona offers were rewritten the same day to follow the hostage rule (questions first, resource after); see reply-personas.sql.
