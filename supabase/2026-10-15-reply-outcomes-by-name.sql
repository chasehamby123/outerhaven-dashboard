-- LinkedIn's inbox list no longer carries thread links (seen 15 Oct 2026), so Sync inbox keys threads by name ('name:…').
-- Drafts still key by the open chat's thread id, so outcomes also match on the person's name key.
create or replace view public.reply_outcomes with (security_invoker = true) as
select d.id, d.created_at, d.account_name, d.approach, d.lead_type, d.intent,
  case when exists (select 1 from public.reply_drafts n where n.thread_key = d.thread_key and n.account_name = d.account_name and n.created_at > d.created_at + interval '10 minutes')
         or exists (select 1 from public.inbox_threads t where lower(t.account_name) = lower(d.account_name)
                      and (t.thread_key = d.thread_key or t.name_key = public.ohq_name_key(d.prospect_name))
                      and t.last_sender = 'them' and t.last_at > d.created_at + interval '10 minutes')
       then 'replied'
       when d.created_at > now() - interval '24 hours' then 'pending' else 'no_reply' end as outcome
from public.reply_drafts d where d.status = 'ready' and d.thread_key is not null;
