-- Daily "Sync inbox" task per LinkedIn account (9 Oct 2026, Tengku).
-- Why: inbox_syncs was empty, so HQ could not tell how many DMs are waiting on a reply. The extension only syncs when someone opens
-- linkedin.com/messaging in that account's AdsPower browser and presses HQ -> Sync inbox. One daily task per account makes it a
-- ticked-off habit on Today. Assignee = Tengku (he does the clicking); the account chip shows which profile.
-- Additive; idempotent (skips accounts that already have one).
insert into public.team_tasks (title, notes, assignee, account, repeat, sort)
select 'Sync inbox: ' || n,
       'Open ' || n || '''s browser profile, go to linkedin.com/messaging, press the HQ button, then Sync inbox. It only scrolls the list (never opens or sends). HQ then shows how many DMs are waiting on a reply.',
       'Tengku', n, 'daily', 100 + i
from unnest(array['Peter','Chase','Tengku','Razeen','Sara','Dev','Sahid','Reza','Anaz']) with ordinality as x(n, i)
where not exists (select 1 from public.team_tasks t where t.active and t.title = 'Sync inbox: ' || n);
