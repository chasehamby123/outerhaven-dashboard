"""Fund signals from SEC EDGAR with edgartools (runs on GitHub Actions, see .github/workflows/fund-signals.yml).

Reads Form D filings straight from the SEC, turns each into the same item shape the edge function already understands,
and posts them to the `fund-signals` edge function (action `ingest`). Judging (rules.js) stays on the server, so HQ shows
the same verdicts and reasons whichever source found the filing.

Modes
  daily   new Fund II/III filings (last 4 days) + the Fund I day-window that turned 3.5 years old + queued checks
  live    Fund II/III filings between --from and --to
  fund1   next-fund watch: Fund I and Fund II filings between --from and --to (default: 48 to 36 months ago)
  check   Fund II checks for queued / unchecked Fund I targets (fund name + every named person)
  recheck re-queue every checked Fund I target, then check
  probe   print the Form Ds naming people (--from "Name One;Name Two")
  selftest known cases against live SEC data (fails the run if wrong); also first step of daily
  audit   re-verify every list row against the SEC filing index (newest amendment), fix stale rows; also run daily
  study1 / study2  cadence study: how long Fund I / Fund II managers take to file their next fund (fund_gap_stats view)

Needs env: SEC_IDENTITY (name + email, the SEC requires it), FUND_INGEST_KEY (from HQ → Pipeline → Fund signals → Settings).
"""
import argparse
import datetime as dt
import os
import re
import sys
import time

import httpx
from edgar import Company, get_filings, search_filings, set_identity

FN = os.environ.get("FUND_SIGNALS_URL", "https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/fund-signals")
KEY = os.environ.get("FUND_INGEST_KEY", "")
LIVE_RE = re.compile(r"\b(II|III)(-[A-Z0-9]+)?\b")
FUND1_RE = re.compile(r"\bI(-[A-Z0-9]+)?\b")
NEXT_RE = re.compile(r"\bII?(-[A-Z0-9]+)?\b")  # next-fund watch: Fund I and Fund II filings
LATER_RE = re.compile(r"\b(II|III|IV|V|VI|VII|VIII|IX|X)(-[A-Z0-9]+)?\b|\bFund\s+[2-9]\b", re.I)
POOLED = "Pooled Investment Fund"


def log(*a):
    print(*a, flush=True)


def sec(fn, *args, tries=5, **kw):
    """Call the SEC with retries. Under load the SEC answers with an error page instead of the filing ("returned HTML
    instead of SGML", 429, timeouts); treating that as "no data" is how a fund with a $28M amendment showed $0."""
    for i in range(tries):
        try:
            return fn(*args, **kw)
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            wait = (3, 8, 20, 45)[min(i, 3)]
            log(f"    SEC retry in {wait}s: {str(e)[:100]}")
            time.sleep(wait)


def post(body):
    for attempt in range(3):
        try:
            r = httpx.post(FN, json=body, headers={"x-fund-ingest": KEY}, timeout=150)
            j = r.json()
            if r.is_success and j.get("ok"):
                return j
            raise RuntimeError(j.get("error") or f"HTTP {r.status_code}")
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise
            log("  retry ingest:", e)
            time.sleep(5 * (attempt + 1))


def txt(v):
    return None if v is None else str(v).strip() or None


def item_from(filing, fd):
    """One Form D → the item shape used by rules.js normalize() (same field names the Apify actor used)."""
    iss, od = fd.primary_issuer, fd.offering_data
    addr = getattr(iss, "primary_address", None)
    osa, inv, fees = od.offering_sales_amounts, od.investors, od.sales_commission_finders_fees
    ig = od.industry_group
    people = []
    for p in fd.related_persons or []:
        a = getattr(p, "address", None)
        people.append({
            "firstName": txt(p.first_name) or "", "lastName": txt(p.last_name) or "",
            "title": ", ".join(getattr(p, "relationships", []) or []),
            "location": ", ".join(x for x in [getattr(a, "city", None), getattr(a, "state_or_country", None)] if x) if a else "",
        })
    cik = str(int(filing.cik))
    return {
        "companyName": txt(iss.entity_name) or filing.company, "cik": cik, "entityType": txt(iss.entity_type),
        "phone": txt(iss.phone_number), "city": txt(getattr(addr, "city", None)), "state": txt(getattr(addr, "state_or_country", None)),
        "industryGroup": txt(ig.industry_group_type) if ig else None,
        "investmentFundType": txt(ig.investment_fund_info.investment_fund_type) if ig and ig.investment_fund_info else None,
        "federalExemptions": ", ".join(od.federal_exemptions or []),
        "dateOfFirstSale": txt(od.date_of_first_sale),
        "totalOfferingAmount": txt(osa.total_offering_amount) if osa else None,
        "totalAmountSold": txt(osa.total_amount_sold) if osa else None,
        "totalRemaining": txt(osa.total_remaining) if osa else None,
        "numberOfInvestors": txt(inv.total_already_invested) if inv else None,
        "salesCommissions": txt(fees.sales_commission) if fees else None,
        "findersFeesExpenses": txt(fees.finders_fees) if fees else None,
        "executivesDetail": people,
        "executives": "; ".join(f"{p['firstName']} {p['lastName']} ({p['title']})" for p in people),
        "filingDate": str(filing.filing_date), "formType": filing.form, "accessionNumber": filing.accession_no,
        "filingUrl": filing.homepage_url, "edgarUrl": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=D",
    }


def latest_amendment(cik, since):
    """Numbers from the newest D/A the fund filed after `since`, straight from the SEC's filing index for that CIK.
    Returns None when there is none. Raises when the SEC can't be read, so a failure is never mistaken for "no amendment"."""
    amends = sorted((f for f in sec(lambda: list(Company(int(cik)).get_filings(form="D/A"))) if str(f.filing_date) > str(since)),
                    key=lambda f: str(f.filing_date), reverse=True)
    if not amends:
        return None
    last_err = None
    for f in amends[:3]:
        try:
            fd = sec(f.obj)
            osa, inv = fd.offering_data.offering_sales_amounts, fd.offering_data.investors
            return {"date": str(f.filing_date), "url": f.homepage_url,
                    "offering": txt(osa.total_offering_amount) if osa else None, "sold": txt(osa.total_amount_sold) if osa else None,
                    "remaining": txt(osa.total_remaining) if osa else None,
                    "investors": txt(inv.total_already_invested) if inv else None,
                    "firstSale": txt(fd.offering_data.date_of_first_sale)}
        except Exception as e:  # noqa: BLE001
            last_err = e
    raise RuntimeError(f"newest D/A of CIK {cik} unreadable: {last_err}")


AMEND_ERRORS = []
GATHER_ERRORS = []


def with_latest(item, cik, since):
    """Overwrite the first Form D's numbers with the newest amendment's: the first filing is made within 15 days of the
    first close, so its "amount sold" is only the first cheque (Eventide Healthcare Innovation Fund I: $0 on the
    original, $64.65M on its D/A). Keeps the original filing date; adds amendedAt. Read failures are recorded (the audit
    retries them), never silently treated as "no amendment"."""
    try:
        a = latest_amendment(cik, since)
    except Exception as e:  # noqa: BLE001
        AMEND_ERRORS.append(f"{item.get('companyName')}: {str(e)[:150]}")
        item["amendError"] = True
        return item
    if a:
        for k_item, k_a in (("totalOfferingAmount", "offering"), ("totalAmountSold", "sold"), ("totalRemaining", "remaining"),
                            ("numberOfInvestors", "investors"), ("dateOfFirstSale", "firstSale")):
            if a.get(k_a) is not None:
                item[k_item] = a[k_a]
        item["amendedAt"], item["amendmentUrl"] = a["date"], a["url"]
    return item


# ---- Hard checks ----
# Known cases verified by hand against EDGAR. If the code ever reads them wrong again, the GitHub run fails (red, emailed)
# and HQ shows the failure. Add every case someone catches by hand.
KNOWN = [
    {"name": "Eventide Healthcare Innovation Fund I", "cik": 1901436, "since": "2022-11-29", "amended": "2023-11-29", "sold": (64_000_000, 65_000_000)},
    {"name": "Hartbeat Ventures I", "cik": 1950228, "since": "2022-10-17", "amended": "2024-01-29", "sold": (27_500_000, 28_500_000)},
]


def selftest():
    fails = []
    for k in KNOWN:
        try:
            a = latest_amendment(k["cik"], k["since"])
            sold = float(a["sold"]) if a and a.get("sold") not in (None, "") else None
            if not a or a["date"] != k["amended"]:
                fails.append(f'{k["name"]}: newest D/A should be {k["amended"]}, read {a and a["date"]}')
            elif sold is None or not (k["sold"][0] <= sold <= k["sold"][1]):
                fails.append(f'{k["name"]}: raised should be {k["sold"][0]:,.0f}-{k["sold"][1]:,.0f}, read {sold}')
        except Exception as e:  # noqa: BLE001
            fails.append(f'{k["name"]}: {e}')
    # Full-text search must see original Form Ds (several forms in one call once returned only amendments).
    try:
        total, results = efts('"Electric Capital"')
        if sum(1 for r in results if r.form == "D") < 10:
            fails.append(f"full-text search: only {sum(1 for r in results if r.form == 'D')} original Form Ds for Electric Capital (expected 10+)")
    except Exception as e:  # noqa: BLE001
        fails.append(f"full-text search failed: {e}")
    # Person search must find renamed funds (Mike Abbaei: NTV Frontier Fund 2020, NTV Prosperity Fund 2021).
    try:
        names = " | ".join(r.company or "" for r in efts('"Abbaei"')[1]).lower()
        for want in ("ntv frontier fund", "ntv prosperity fund"):
            if want not in names:
                fails.append(f"person search: {want} not found for Abbaei")
    except Exception as e:  # noqa: BLE001
        fails.append(f"person search failed: {e}")
    post({"action": "ingest", "kind": "data_check", "check": "selftest", "ok": not fails, "checked": len(KNOWN) + 2, "failures": fails})
    log("selftest:", "ok" if not fails else f"{len(fails)} FAILED: " + " / ".join(fails))
    return fails


def audit():
    """Re-verify every list row against the SEC's filing index for its CIK: numbers must come from the newest amendment.
    Stale rows are fixed on the spot; anything unreadable is counted and listed."""
    rows = post({"action": "ingest", "kind": "audit_todo"}).get("rows", [])
    stale = fixed = errors = 0
    fails = []
    for i, r in enumerate(rows):
        try:
            a = latest_amendment(r["cik"], r["filing_date"])
            newest = a["date"] if a else None
            if newest != r.get("amended_at"):
                stale += 1
                if a:
                    post({"action": "ingest", "kind": "audit_fix", "id": r["id"], "amendment": a})
                    fixed += 1
        except Exception as e:  # noqa: BLE001
            errors += 1
            if len(fails) < 50:
                fails.append(f'{r.get("company_name")}: {str(e)[:150]}')
        if i % 200 == 0:
            log(f"  audit {i}/{len(rows)}: {stale} stale, {errors} errors")
    post({"action": "ingest", "kind": "data_check", "check": "audit", "ok": errors == 0, "checked": len(rows), "stale": stale, "fixed": fixed,
          "errors": errors, "failures": fails})
    log(f"audit: {len(rows)} rows, {stale} stale ({fixed} fixed), {errors} errors")


def flush(batch, list_name, start, end, sent):
    r = post({"action": "ingest", "kind": "scan", "list": list_name, "items": batch, "from": start, "to": end})
    log(f"  sent {sent + len(batch)} (new {r.get('added')})")
    return len(batch)


def scan(list_name, start, end):
    """Form D filings (originals) in [start, end] whose name has the fund number we want; pooled funds only."""
    rx = LIVE_RE if list_name == "live" else NEXT_RE
    fs = sec(get_filings, form="D", amendments=False, filing_date=f"{start}:{end}")
    if fs is None or len(fs) == 0:
        log(f"{list_name}: no Form D filings {start}..{end}")
        return
    cands = [f for f in fs if rx.search(f.company or "")]
    log(f"{list_name}: {len(fs)} Form D filings {start}..{end}, {len(cands)} with the right fund number")
    batch, sent, skipped, unreadable = [], 0, 0, []
    for f in cands:
        try:
            fd = sec(f.obj)
            if fd is None or not hasattr(fd, "offering_data"):
                skipped += 1
                continue
            ig = fd.offering_data.industry_group
            if not ig or ig.industry_group_type != POOLED:
                skipped += 1
                continue
            batch.append(with_latest(item_from(f, fd), f.cik, f.filing_date))
        except Exception as e:  # noqa: BLE001
            log(f"  UNREADABLE {f.company}: {e}")
            unreadable.append(f"{f.company} ({f.accession_no}): {str(e)[:120]}")
        if len(batch) >= 100:
            sent += flush(batch, list_name, start, end, sent)
            batch = []
    # Leftovers go after the loop: when the last candidates were skipped, an in-loop "last item" check never fired
    # and up to 99 funds per window were silently dropped (fixed 2 Oct 2026).
    if batch:
        sent += flush(batch, list_name, start, end, sent)
    log(f"{list_name}: {sent} pooled funds sent, {skipped} not pooled funds, {len(unreadable)} unreadable, {len(AMEND_ERRORS)} amendment read errors")
    # Hard check: every candidate must be either read or listed as unreadable, never silently dropped.
    post({"action": "ingest", "kind": "data_check", "check": f"scan {list_name} {start}..{end}", "ok": not unreadable and not AMEND_ERRORS,
          "checked": len(cands), "errors": len(unreadable) + len(AMEND_ERRORS), "failures": (unreadable + AMEND_ERRORS)[:50]})
    AMEND_ERRORS.clear()


def efts(query, start=None, limit=100):
    """EDGAR full-text search over Form D and D/A. They must be searched SEPARATELY: asking for forms=["D", "D/A"] in one call
    returns only the amendments (found 5 Oct 2026: "Electric Capital" gave 3 results combined vs 18 originals alone), which
    silently hid most later funds from the Fund II check. Returns (total, results)."""
    total, out = 0, []
    for form in ("D", "D/A"):
        res = sec(search_filings, query, forms=[form], start_date=start, limit=limit)
        total += res.total
        out += list(res.results)
    return total, out


def person_filings(s, start, seen, cap=12):
    """Later Form Ds that name the same people, whatever the fund is called. Managers often raise Fund II and III under
    new names (Stratos Venture Partners Fund I, then "Frontier Fund", "Prosperity Fund"), so the name search alone misses
    them. Very common names (over 60 filings) are skipped: too many strangers share them. The server decides."""
    out = []
    for p in (s.get("executives") or [])[:4]:
        name = (p.get("name") or "").strip()
        if len(name.split()) < 2:
            continue
        # Surname first: filings spell first names differently ("Mike" vs "Michael", middle initials), and an uncommon
        # surname is the better key ("Abbaei" finds NTV Frontier Fund + NTV Prosperity Fund; "Mike Abbaei" finds nothing).
        # Common surnames fall back to the full name. The server matches people by first initial + surname.
        total, results = None, []
        for q in (name.split()[-1], name):
            if len(q) < 4:
                continue
            try:
                total, results = efts(f'"{q}"', start, limit=60)
            except Exception as e:  # noqa: BLE001
                log(f"    person {q}: search failed {e}")
                total = None
                continue
            if total <= 60:
                break
        if total is None or total > 60:
            log(f"    person {name}: too common to use ({total} filings)")
            continue
        opened = 0
        for r in sorted(results, key=lambda r: str(r.filed)):
            if r.accession_number in seen or (s.get("cik") and str(r.cik) == str(s["cik"])) or opened >= cap:
                continue
            seen.add(r.accession_number)
            try:
                f = sec(r.get_filing)
                item = item_from(f, sec(f.obj))
                item["via"] = "person"
                out.append(item)
                opened += 1
            except Exception as e:  # noqa: BLE001
                log(f"    could not open {r.company}: {e}")
                GATHER_ERRORS.append(r.company or "?")
        log(f"    person {name}: {total} filings, {opened} opened")
    return out


def probe(names):
    """Debug: print every Form D naming these people (GitHub run, mode probe, from = names separated by ';')."""
    for name in names:
        total, results = efts(f'"{name}"')
        lines = [f"{name}: {total} filings"] + [f"{r.filed} {r.form} CIK {r.cik} {r.company}" for r in sorted(results, key=lambda r: str(r.filed))]
        log("\n".join(lines))
        # Also as a GitHub annotation, readable through the API when the raw log isn't reachable.
        print(f"::notice title=probe {name}::" + "%0A".join(x.replace("%", "%25") for x in lines)[:3900], flush=True)


def gather(s):
    """Every filing after s's own that could be its next fund: the same CIK (amendments), the manager's name (full-text
    search) and every named person (person_filings). The server reads them with readCheck()."""
    since = s.get("filing_date") or "2015-01-01"
    start = (dt.date.fromisoformat(since) + dt.timedelta(days=1)).isoformat()
    items, seen = [], set()
    if s.get("cik"):
        for f in sec(lambda: list(Company(int(s["cik"])).get_filings(form=["D", "D/A"]))):
            if str(f.filing_date) <= since or f.accession_no in seen:
                continue
            seen.add(f.accession_no)
            try:
                items.append(item_from(f, sec(f.obj)))
            except Exception:  # noqa: BLE001
                items.append({"companyName": f.company, "cik": str(f.cik), "filingDate": str(f.filing_date), "formType": f.form, "accessionNumber": f.accession_no})
    for r in efts(f'"{s["check_keyword"]}"', start)[1]:
        if r.accession_number in seen:
            continue
        seen.add(r.accession_number)
        name = re.sub(r"\s*\((?:[A-Z.\-]+\)\s*\()?CIK \d+\)\s*$", "", r.company or "").strip()
        light = {"companyName": name, "cik": r.cik, "filingDate": r.filed, "formType": r.form, "accessionNumber": r.accession_number}
        # A possible later fund: open the filing so the server can compare the named people with this fund's.
        if LATER_RE.search(name):
            try:
                f = sec(r.get_filing)
                full = item_from(f, sec(f.obj))
                full["companyName"] = name or full["companyName"]
                items.append(full)
                continue
            except Exception as e:  # noqa: BLE001
                log(f"    could not open {name}: {e}")
                GATHER_ERRORS.append(name)
        items.append(light)
    items += person_filings(s, start, seen)
    if GATHER_ERRORS:
        # A possible later fund we couldn't read: never report "clear" on half the evidence. The check is marked as an
        # error and picked up again by a later run.
        bad = list(GATHER_ERRORS)
        GATHER_ERRORS.clear()
        raise RuntimeError(f"{len(bad)} later filing(s) unreadable after retries: {', '.join(bad[:3])}")
    return items


def check():
    """For each queued / unchecked Fund I target: gather() later filings, the server judges them."""
    todo = post({"action": "ingest", "kind": "todo"}).get("signals", [])
    groups = {}
    for s in todo:
        groups.setdefault(s["manager_key"], []).append(s)
    log(f"check: {len(todo)} signals, {len(groups)} managers")
    for key, group in groups.items():
        s = group[0]
        try:
            items = gather(s)
            post({"action": "ingest", "kind": "check", "signal_ids": [x["id"] for x in group], "items": items})
            log(f"  {s['check_keyword']}: {len(items)} later filings")
        except Exception as e:  # noqa: BLE001
            log(f"  {s['check_keyword']}: failed {e}")
            post({"action": "ingest", "kind": "check_error", "signal_ids": [x["id"] for x in group], "error": str(e)[:300]})


FUND2_RE = re.compile(r"\bII(-[A-Z0-9]+)?\b")
VEHICLE_RE = re.compile(r"\b(spv|co-?invest\w*|series of|splitter|blocker|continuation|sidecar|aggregator|access fund|annex|feeder|offshore|parallel)\b|\bseries\s+(?!fund\b)[a-z0-9]", re.I)


def study(fund_no, start, end, sample=250):
    """Cadence study: a random sample of Fund I (or Fund II) filings from an old window, each checked for its next fund
    with the same logic as the Fund II check. Stored in fund_gap_study; summary in the fund_gap_stats view.
    Only original filings of pooled funds, $10M+ target or raised, no feeder/parallel/offshore twins (one per manager)."""
    import random
    cohort = f"fund{fund_no}-{start[:4]}-v2"  # v2: series SPVs excluded, later funds counted per fund family
    rx = FUND1_RE if fund_no == 1 else FUND2_RE
    fs = get_filings(form="D", amendments=False, filing_date=f"{start}:{end}")
    cands = [f for f in fs if rx.search(f.company or "") and not VEHICLE_RE.search(f.company or "")]
    random.Random(42).shuffle(cands)
    log(f"study {cohort}: {len(fs)} Form Ds, {len(cands)} named like Fund {fund_no}")
    picked, batch, managers = 0, [], set()
    for f in cands:
        if picked >= sample:
            break
        try:
            fd = sec(f.obj)
            ig = fd.offering_data.industry_group
            if not ig or ig.industry_group_type != POOLED:
                continue
            it = item_from(f, fd)
            off = float(it["totalOfferingAmount"] or 0) if str(it["totalOfferingAmount"] or "").replace(".", "").isdigit() else 0
            sold = float(it["totalAmountSold"] or 0) if str(it["totalAmountSold"] or "").replace(".", "").isdigit() else 0
            if max(off, sold) < 10e6:
                continue
            key = re.split(r"\b(?:fund|I|II)\b", (it["companyName"] or "").lower())[0].strip()
            if key in managers:
                continue
            managers.add(key)
            batch.append(it)
            picked += 1
        except Exception as e:  # noqa: BLE001
            log(f"  skip {f.company}: {e}")
        if len(batch) >= 50:
            post({"action": "ingest", "kind": "study_add", "cohort": cohort, "fund_no": fund_no, "items": batch})
            batch = []
    if batch:
        post({"action": "ingest", "kind": "study_add", "cohort": cohort, "fund_no": fund_no, "items": batch})
    todo = post({"action": "ingest", "kind": "study_todo", "cohort": cohort}).get("rows", [])
    log(f"study {cohort}: {picked} sampled, {len(todo)} to check")
    for i, s in enumerate(todo):
        try:
            items = gather(s)
            post({"action": "ingest", "kind": "study_check", "id": s["id"], "items": items})
        except Exception as e:  # noqa: BLE001
            post({"action": "ingest", "kind": "study_check", "id": s["id"], "error": str(e)[:300]})
        if i % 25 == 0:
            log(f"  {i}/{len(todo)} checked")
    log(f"study {cohort}: done")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="daily", choices=["daily", "live", "fund1", "check", "probe", "recheck", "study1", "study2", "selftest", "audit"])
    ap.add_argument("--from", dest="start")
    ap.add_argument("--to", dest="end")
    a = ap.parse_args()
    if not KEY or not os.environ.get("SEC_IDENTITY"):
        sys.exit("Set the FUND_INGEST_KEY and SEC_IDENTITY secrets in GitHub (see the workflow file).")
    set_identity(os.environ["SEC_IDENTITY"])
    today = dt.date.today()
    if a.mode == "selftest":
        sys.exit(1 if selftest() else 0)
    if a.mode == "audit":
        audit()
        return
    if a.mode == "daily":
        fails = selftest()
        scan("live", (today - dt.timedelta(days=4)).isoformat(), today.isoformat())
        c = today - dt.timedelta(days=round(42 * 30.44))
        scan("fund1", (c - dt.timedelta(days=3)).isoformat(), c.isoformat())
        audit()
        check()
        if fails:
            sys.exit(1)  # the run shows red on GitHub (and is emailed) when a known case reads wrong
    elif a.mode == "live":
        scan("live", a.start or (today - dt.timedelta(days=30)).isoformat(), a.end or today.isoformat())
        audit()
    elif a.mode == "fund1":
        start = dt.date.fromisoformat(a.start) if a.start else today - dt.timedelta(days=round(48 * 30.44))
        end = dt.date.fromisoformat(a.end) if a.end else today - dt.timedelta(days=round(36 * 30.44))
        cur = start
        while cur <= end:  # a quarter at a time keeps each index download small
            nxt = min(cur + dt.timedelta(days=90), end)
            scan("fund1", cur.isoformat(), nxt.isoformat())
            cur = nxt + dt.timedelta(days=1)
        audit()
    elif a.mode in ("study1", "study2"):  # cadence study on an old window (default: the year 7 years ago)
        y = today.year - 7
        study(int(a.mode[-1]), a.start or f"{y}-01-01", a.end or f"{y}-12-31")
    elif a.mode == "probe":
        probe([n.strip() for n in (a.start or "").split(";") if n.strip()])
    elif a.mode == "recheck":  # queue every Fund I target already checked, then check them again (new person search)
        log(f"recheck: {post({'action': 'ingest', 'kind': 'requeue'}).get('queued')} queued")
        check()
    else:
        check()


if __name__ == "__main__":
    main()
