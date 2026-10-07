-- UCC filing archive: states that only publish a rolling window (Oregon: last month's filings) are kept here so the
-- history builds up month by month. Written and read only by the ucc-signals edge function (ingest kinds
-- 'archive_put' / 'archive_get'); no client access. One row per filing × debtor × secured party.
create table if not exists public.ucc_filing_archive (
  id bigint generated always as identity primary key,
  src text not null,                 -- registry: OR, FL…
  no text not null,                  -- filing number
  debtor text not null,
  party text not null default '',
  kind text,
  cls text,
  filed date,
  lapse date,
  status text,
  state text,
  city text,
  address text,
  zip text,
  created_at timestamptz not null default now(),
  unique (src, no, debtor, party)
);
create index if not exists ucc_filing_archive_src_filed on public.ucc_filing_archive (src, filed);
alter table public.ucc_filing_archive enable row level security;

-- Months already archived per registry (the script skips backfill snapshots it already has).
create or replace function public.ucc_archive_months(p_src text) returns text[] language sql stable as $$
  select coalesce(array_agg(m order by m), '{}') from (select distinct to_char(filed, 'YYYY-MM') m from public.ucc_filing_archive where src = p_src and filed is not null) x
$$;
revoke all on function public.ucc_archive_months(text) from public, anon, authenticated;
