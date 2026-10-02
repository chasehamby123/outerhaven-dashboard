# OuterHaven dashboard: notes for Claude

Read this first in any session on this repo. It is the hand-off from the sessions that built HQ (Sept 2026).

## What this repo is
- **Public site**: `index.html`, `firm.html`, `advisory.html`, `industries.html`, `team/`. Strategic-advisory look
  (Moelis / Houlihan Lokey): serif headings, navy/charcoal, generous whitespace. Styles in `finance-firm.css` and
  `headline-partner-platform.css` (type tokens `--fs-*`, `--serif`, `--sans`).
- **HQ** (internal app): `hq.html` + `hq/*.js` (ES modules, no build step) + `hq/app.css`. Pages: Overview, Today,
  Schedule, Pipeline, Growth (scraper, posts, experiments, insights, meetings, sheet), Resources.
- **Legacy**: everything else at the root (`originator-*`, `pipeline*`, `daily-ops-*`, `shared.html`). Don't extend it.
- Hosting: Vercel static deploy from `main` (https://outerhaven-dashboard.vercel.app). `.vercelignore` keeps
  `.claude`, `routines`, `supabase`, `sheets` off the site. Pushing to `main` deploys.

## Access (already set up; don't ask the user to redo it)
- **GitHub**: chasehamby123/outerhaven-dashboard, public. The Claude GitHub App is installed, so push to `main` works.
- **Supabase**: project `nfcysxqdwpdhrdpgxrlo`, via the Supabase connector (`execute_sql`, `apply_migration`,
  `deploy_edge_function`). Publishable key is in `hq/core.js`.
- **Notion, Google Drive**: connectors on Tengku's account.
- **Apify**: token in `public.integration_secrets` (`APIFY_TOKEN`). Never print it.
- The session sandbox can't reach supabase.co or api.apify.com directly; go through the connectors (or
  `extensions.http` from SQL for testing edge functions).

## Roles
`dashboard_access` table → `dashboard_role()`: `admin` (Tengku, Chase, Peter, Anaz) sees everything; `ops` sees
Today, Schedule, Resources (no one holds it right now, the role still exists). RLS helpers: `can_access_daily_ops()` (admin or ops), `can_access_dashboard()` (admin).

## Data you'll touch
- `daily_ops_accounts` (owner_name = first name: Sara, Dev, Sahid, Tengku, Razeen, Peter, Chase, Reza, Anaz).
- `daily_ops_weekly_posts`: the weekly posting template. `sync_daily_ops_today()` turns it into today's
  `daily_ops_schedule` rows (post 60 min, then 15-min reply block except Sara; Sara's 30-min comment block before the
  first post; posts run back to back). Ops day rolls over at 2 AM GMT+8. Edited by HQ → Schedule (drag and drop).
- `daily_ops_creation_blocks`: the weekend post creation batch (HQ → Schedule, slider → Post creation, `hq/creation.js`).
  Block = day + start + account + creatives × minutes_per (end derived). `sync_daily_ops_today()` adds today's blocks to
  Today as 'create:<id>' tasks. Migration: `supabase/2026-10-02-creation-schedule.sql`.
- Team tasks (`team_tasks`, `hq/tasks.js`): everyone's own once / daily / weekdays / weekly tasks (Today → Add task, or
  Schedule → Team tasks). `sync_team_tasks()` (called by HQ after `sync_daily_ops_today`) upserts today's occurrences into
  `daily_ops_schedule` (auto_key 'task:<id>', `assignee`, auto_generated=false so the posting sync never deletes them);
  stale untouched ones are deleted client-side. `daily_ops_schedule.assignee`: null/posting rows = Anaz (trigger).
  Today has a "Team today" switcher in the side rail (below the hero on narrow screens; never above the hero, the % ring stays the hero; `hq-today-who`); nav badge and
  whip count only your own tasks. Chase has a daily "Reply in X's inbox" task per account except Anaz.
  Note: the Supabase connector cancels migrations containing DROP/DELETE/UPDATE; ask the user to run those in the SQL editor.
- `daily_ops_posts`: scraped LinkedIn posts. `post_key` comes from a trigger. `is_repost` is set by trigger; reshares
  are boosts, never the account's own post. `tags` / `metrics` jsonb hold HQ tagging and `no_resource`.
- Comments from our own accounts never count. `daily_ops_post_comments.is_team` is set by trigger;
  `daily_ops_posts.external_comment_count` (audience), `team_comment_count`, and `unreplied_count` (audience comments
  no team account answered) are kept current by `recount_post_comments()`. `commenter_count` is LinkedIn's raw total
  (includes ours); only use it as a fallback before a thread is scraped. Reply quota: 20 comments/account/day.
- `growth_settings` (id 1): scraper on/off (`scrape_enabled`), `scrape_hour`, `monthly_budget`, resource cap and
  Drive folder.
- Scraper (v9: comment threads run one Apify run per post inside a 120 s budget, unfinished runs are aborted and stay pending; a thread costs ~$0.60-1.30 and the log now records real per-run cost; account pool: `APIFY_TOKEN` = slot 1 capped by the HQ budget, extras `APIFY_TOKEN_2..9` added write-only in HQ → Growth → Scraper → Apify accounts via RPC `set_apify_token`, each run goes to the account with most credit left, extras use up to their own plan limit): edge function `daily-ops-linkedin-auto` (Apify actors atomus/linkedin-posts-scraper-pro and
  comments-scraper-pro), pg_cron every 30 min, runs once a day after `scrape_hour` MYT. Log:
  `daily_ops_linkedin_auto_log`. The user turned it off on 28 Sept; only they turn it back on.
- Google Sheet "OuterHaven LinkedIn Accounts KPI" (id `1RGhFmIzQDCulzW6EVlFpVl8mmWEn_QU7rbSnzq1I01g`): HQ reads it via
  gviz CSV; `sheets/outerhaven-kpi-autofill.gs` (Apps Script) fills scraped columns from RPC `sheet_post_stats`.

## Overview: "Did the posts go out?" (`hq/postcheck.js`)
- Top card on Overview. Scheduled post tasks for the ops day (last night's until tonight's first slot starts) checked two
  ways: ticked on Today vs found by the scraper (`daily_ops_posts`, own post, same `work_date`). If finished slots can't be
  verified (scraper off / no posts run since), a popup shows once per ops day per browser (localStorage `hq-postcheck-<day>`)
  with "Check LinkedIn now" = one manual posts run (~$0.18). It never turns the scraper on.

- Second card on Overview: "Waiting on our reply" (`renderReplyQueue` in pipeline.js): top 8 unanswered outreach replies by `leadHeat`, links to `#/pipeline/leads` (opens the LinkedIn leads tab).
- HQ checks `/hq/main.js` ETag every 5 min and shows an "HQ has been updated · Reload" bar, because people leave the tab open for days.

## Pipeline (HQ → Pipeline, `hq/pipeline.js`, admin only)
- Reads `opportunities`, `people`, `tasks`, `lead_intake` (same tables as the old `shared.html` board; both stay in sync).
  Item = live deal (`pipeline_active`), or a live person with no live deal. Ball = `waiting_on` ('us'/'them'/null), clock = `waiting_on_since`.
- Flags: ours 3d warn / 7d red; theirs 7d warn / 14d red; nobody owns the move; no next step; overdue task; no movement 21d.
  Layout: slim header + filter chips, stage board first, then one tabbed card (Needs you | LinkedIn leads | Parked). Chips filter the list and highlight matching board cards. Nav badge = red items. Stage board per side (stage lists mirror `pipeline.js` at the root); third tab **Both** = `people.primary_side='Both'` (IBs that are also capital), relationships only with a short stage list (deals can't be Both: `opportunities.side` check).
- Leads panel: `lead_intake` rows with no `person_id`, not reviewed, not `not_qualified`. "Add as sell/buy side" inserts/reuses a
  `people` row, adds a task (owner from the lead's `source_account` profile slug) and stamps the lead. Quick actions ("Next stage →" on cards and rows moves one stage; "DMs" opens every logged reply from `lead_intake` plus any extension-saved `dm_conversations` thread) write
  `waiting_on`/`waiting_on_since` to the deal and its person. Old board is linked in the nav as "Old pipeline board".
- Leads are ranked by `leadHeat()` (pipeline.js): asks for a call / gives contact = "Wants to talk", deal words = "Has a deal", polite no = "Looks like a no". Chase's inbox tasks on Today show unanswered outreach replies per account (by `source_account` slug).
- Outbound reality (Oct 2026): Peter, Tengku, Chase run campaigns in Prosp (replies arrive in `lead_intake` via webhook; sends are not tracked); the other 6 accounts are manual in AdsPower.

## Fund signals (Pipeline → Fund signals tab, `hq/funds.js`, admin only)
- Finds US funds raising now (Form D, II/III in the name, pooled fund, $50–250M, <60% sold, no sales commissions) and Fund I
  managers 3–4 years in who haven't filed a Fund II.
- **Source: GitHub Actions** `.github/workflows/fund-signals.yml` runs `scripts/fund_signals.py` (edgartools, SEC direct, free):
  daily 01:40 UTC (new II/III filings, the Fund I window turning 3.5 years, checks) and hourly :10 (queued checks). Backfills:
  Actions → Fund signals → Run workflow (mode live/fund1 + dates). Repo secrets: `FUND_INGEST_KEY` (= `FUND_INGEST_SECRET`, admins copy it
  in the tab's Setup via RPC `fund_ingest_key()`) and `SEC_IDENTITY` (name + email). The user sets both; never set them yourself.
  The sandbox and the DB can't reach sec.gov (blocked), so test the parser offline (`edgar.offerings.exempt.formd.FormD.from_xml`).
- Python only fetches and maps to the item shape; edge function `fund-signals` (verify_jwt=false) action `ingest` (header `x-fund-ingest`)
  stores and judges with `supabase/functions/fund-signals/rules.js` (pure JS; every verdict stores `reasons`; bump `RULES_VERSION` and the
  15-min cron re-judges). Check = same CIK later filings (amendment numbers) + EFTS full-text search on the manager name (higher fund
  number = cut). HQ "Check" queues (`action: queue`); the hourly job picks queued up. Deploy index.ts + rules.js together.
- Apify actor `logiover/sec-edgar-form-d-scraper` is a fallback only (it silently returned a partial list on 2 Oct 2026); weekly Apify
  scan stays off (`growth_settings.fund_scan_enabled`), budget `fund_monthly_budget`.
- Tables `fund_signals` (one row per filing, `fund_key` groups feeder/parallel vehicles) and `fund_signal_runs` (`params.source='github'`
  for GitHub calls). Migrations: `supabase/2026-10-02-fund-signals.sql`, `supabase/2026-10-02-fund-signals-github.sql`.
- "Add to pipeline" creates Sell Side `people` (source 'Form D') + a task. Fund placement for a success fee needs a US broker-dealer.

## Resources (lead magnets)
- HQ → Resources: queue of posts needing a resource, library (generated + manual links), Generate form.
- Generate → edge function `resource-request` (daily cap, fires the routine) → Claude Code routine
  "OuterHaven resource builder" (created by Tengku at claude.ai/code/routines, API trigger, custom environment
  allowing api.apify.com, the supabase.co host, media.licdn.com) → follows `routines/resource-builder.md` and
  `.claude/skills/lead-magnet-resource-builder/SKILL.md` → writes back to `resource_jobs`.
- Routine URL/token live in `integration_secrets` (`ROUTINE_FIRE_URL`, `ROUTINE_FIRE_TOKEN`), set by an admin in
  HQ → Resources → Generate → Settings. Output folder: Drive "OuterHaven Lead Magnets".
- Posts auto-link to resources by caption similarity (trigger `auto_link_resource` on `daily_ops_posts`).
- Weekly Claude analysis uses the same routine: `resource_jobs.kind = 'analysis'` (pg_cron `weekly-growth-analysis`,
  Mondays 02:05 UTC, or Growth → Insights → Run analysis now). Instructions: `routines/weekly-analysis.md`. It writes
  `daily_ops_posts.ai_tags` (creative + caption factors; hand tags in `tags` win) and a row in `growth_reports`.

## Deal teasers (Resources → Deal teasers, `hq/teasers.js`)
- One-page anonymised teaser from what a lead told us. Start from Resources → Deal teasers, Pipeline → LinkedIn leads
  ("Make teaser") or a lead's DMs window. `resource-request` action `teaser` inserts a `resource_jobs` row (kind 'resource',
  format 'pdf', `payload.type = 'teaser'`, caption = the lead's messages) and fires the same routine. The routine reaches
  `routines/teaser-builder.md` via a redirect at the top of the repo skill (the saved routine prompt didn't change).
  Output: `payload.teaser` JSON (+ Drive PDF in "OuterHaven Teasers" when possible). HQ renders it as an editable A4 page
  and downloads a PDF client-side (html2pdf.js from cdnjs). Teasers count toward the daily Claude job cap.

## DM tests and meetings
- `dm_tests` → `dm_variants` (A/B/…) → `dm_events` (one row per tap: sent / replied). Meetings live in
  `growth_meetings` (with `dm_variant_id` / `post_id`). `dm_variant_stats` view gives per-version totals.
- Today shows the running DM test (tap + Sent / + Reply / Meeting booked) and a "Meeting booked" button.
  Growth → DM tests compares versions; a winner needs 30+ sends per version and p < 0.05.
- Browser extension v2 (no sign-in): `hq/outerhaven-hq-extension.zip` is a public TEMPLATE with `__OHQ_CAPTURE_KEY__` in
  background.js. HQ → Growth → DM tests "Download" (dms.js `downloadExtension`) fetches it, gets the key from admin-only RPC
  `extension_capture_key()` (secret `EXT_CAPTURE_KEY`), injects it with JSZip and downloads a connected copy. `dm-capture`
  (verify_jwt=false) accepts `x-capture-key` or a user JWT; with the key, `booked_by` (team name) and `account` come from the
  extension's pickers (remembered per browser profile). Rotate by changing EXT_CAPTURE_KEY (old zips stop working).
- Browser extension `extension/outerhaven-capture` (MV3; zipped to `hq/outerhaven-hq-extension.zip` for download):
  HQ button on LinkedIn chats → `dm-capture` edge function → `dm_conversations` (one row per thread, re-save updates,
  opening message fuzzy-matched to a DM version via `match_dm_variant`, "meeting booked" creates a growth_meetings row).
  `dm_variant_stats` counts saved conversations as sends/replies. Re-zip after editing the extension.

## Rules
- Mandates are under NDA. The US$108M Mauritius branded villas deal is shown anonymised; never name the brand.
- Never enter passwords, API keys or tokens for the user, even with permission. Point them to the HQ field.
- UI (redesigned 30 Sept): navy ink on cool mist, brass (`--brass`) as the one brand accent, serif page titles, and a
  colour per account (`--c1`…`--c12`, mapped in `acIdx()` in `hq/core.js`; use `avatar()` / `acctChip()` / `data-ac`).
  Light/dark/tan via tokens in `hq/app.css`; every colour is a token. No pill-shaped primary buttons, no decorative gradients.
- Today is about today only (week history lives on Overview; Today only keeps one red line for unfinished earlier-this-week tasks, expandable to Done now / Skip). Opening it with today's slots already ended and unticked shows, once per ops day per browser (localStorage `hq-whip-day`), `hq/whip.js`, a pixel
  knight whipping a slave sprite with CRACK! / "Work harder!" (user asked for it; shown to everyone incl. ops). Nav badge
  on Today = tasks left (red = overdue). Must work at 390px wide with no
  horizontal page scroll.
- Migrations: additive, saved under `supabase/` and applied with `apply_migration`.
- Testing HQ locally: `python3 -m http.server 8765`, open `hq.html?mock` (admin), `?mock=ops` (Anaz),
  `?mock=noconn`. `hq/mock.js` fakes Supabase and only loads on localhost. Playwright Chromium is at
  `/opt/pw-browsers/chromium`.
- The user (Tengku) wants short answers, pushback when warranted, and finished work rather than options.
