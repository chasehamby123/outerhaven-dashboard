-- Deal book (7 Oct 2026, Tengku): deals that were PROVIDED to OuterHaven (mandates, teasers, CIMs from sponsors / IBs /
-- introducers), for Peter to review. Not outbound targets (those are Fund / Credit signals). HQ → Pipeline → Deals.
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  codename text not null,                       -- what we call it internally (anonymised names for NDA deals)
  opportunity_id uuid references public.opportunities(id) on delete set null,
  source_name text,                             -- who gave it to us (introducer, sponsor, bank)
  source_person_id uuid references public.people(id) on delete set null,
  received_at date default current_date,
  deal_type text,                               -- Equity raise | Debt / private credit | M&A sell-side | Real estate | Fund raise | Other
  sector text,
  geography text,
  ask_amount numeric,                           -- USD
  ask_text text,                                -- as given ("$150M raise", "SGD 10m for 20%")
  valuation_text text,
  structure text,
  summary text,
  doc_links jsonb not null default '[]'::jsonb, -- [{label, url}]
  nda_status text default 'None',               -- None | Requested | Signed
  fee_terms text,
  status text not null default 'To review',     -- To review | Need info | Interested | Shopping to buyers | Passed | Closed
  peter_verdict text,                           -- Fit | Maybe | Pass
  peter_notes text,
  peter_reviewed_at timestamptz,
  next_step text,
  owner_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.deals enable row level security;
create policy deals_admin_all on public.deals for all using (public.can_access_dashboard()) with check (public.can_access_dashboard());
create index if not exists deals_status_idx on public.deals (status, received_at desc);

-- Seed: the sell-side opportunities already logged as received, linked so both stay findable.
insert into public.deals (codename, opportunity_id, source_name, source_person_id, received_at, ask_text, ask_amount, sector, geography, summary, owner_name)
select o.title, o.id, p.name, o.person_id, o.created_at::date, o.opportunity_size,
       case when o.opportunity_size ~* '^\$?\s*[0-9.]+\s*m' then (regexp_replace(o.opportunity_size, '[^0-9.]', '', 'g'))::numeric * 1e6 end,
       nullif(o.sector, ''), o.geography, o.notes, o.owner_name
from public.opportunities o left join public.people p on p.id = o.person_id
where o.side = 'Sell Side' and not exists (select 1 from public.deals d where d.opportunity_id = o.id);

-- Teasers (7 Oct): the facts a one-page teaser needs, so HQ can draft one straight from the deal (and Claude can polish it).
alter table public.deals add column if not exists headline text;          -- one line: what the opportunity is
alter table public.deals add column if not exists highlights text;        -- one per line
alter table public.deals add column if not exists use_of_funds text;      -- one per line
alter table public.deals add column if not exists financials text;        -- revenue / EBITDA / NOI / IRR as given
alter table public.deals add column if not exists ideal_investor text;
alter table public.deals add column if not exists timeline text;
alter table public.deals add column if not exists contact text;           -- OuterHaven contact on the teaser
alter table public.deals add column if not exists teaser jsonb;           -- Claude-written teaser (routines/teaser-builder.md shape)
alter table public.deals add column if not exists teaser_html text;       -- saved edits of the teaser page
alter table public.deals add column if not exists teaser_job_id uuid;

-- Private bucket for teasers / CIMs people upload to a deal (viewed through short-lived signed links).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-docs', 'deal-docs', false, 26214400, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
create policy deal_docs_admin_read on storage.objects for select to authenticated using (bucket_id = 'deal-docs' and public.can_access_dashboard());
create policy deal_docs_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'deal-docs' and public.can_access_dashboard());
