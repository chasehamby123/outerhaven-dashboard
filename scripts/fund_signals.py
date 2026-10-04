"""Fund signals from SEC EDGAR with edgartools (runs on GitHub Actions, see .github/workflows/fund-signals.yml).

Reads Form D filings straight from the SEC, turns each into the same item shape the edge function already understands,
and posts them to the `fund-signals` edge function (action `ingest`). Judging (rules.js) stays on the server, so HQ shows
the same verdicts and reasons whichever source found the filing.

Modes
  daily   new Fund II/III filings (last 4 days) + the Fund I day-window that turned 3.5 years old + queued checks
  live    Fund II/III filings between --from and --to
  fund1   Fund I filings between --from and --to (default: 48 to 36 months ago)
  check   Fund II checks for queued / unchecked Fund I targets (fund name + every named person)
  recheck re-queue every checked Fund I target, then check
  probe   print the Form Ds naming people (--from "Name One;Name Two")

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
LATER_RE = re.compile(r"\b(II|III|IV|V|VI|VII|VIII|IX|X)(-[A-Z0-9]+)?\b|\bFund\s+[2-9]\b", re.I)
POOLED = "Pooled Investment Fund"


def log(*a):
    print(*a, flush=True)


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


def flush(batch, list_name, start, end, sent):
    r = post({"action": "ingest", "kind": "scan", "list": list_name, "items": batch, "from": start, "to": end})
    log(f"  sent {sent + len(batch)} (new {r.get('added')})")
    return len(batch)


def scan(list_name, start, end):
    """Form D filings (originals) in [start, end] whose name has the fund number we want; pooled funds only."""
    rx = LIVE_RE if list_name == "live" else FUND1_RE
    fs = get_filings(form="D", amendments=False, filing_date=f"{start}:{end}")
    if fs is None or len(fs) == 0:
        log(f"{list_name}: no Form D filings {start}..{end}")
        return
    cands = [f for f in fs if rx.search(f.company or "")]
    log(f"{list_name}: {len(fs)} Form D filings {start}..{end}, {len(cands)} with the right fund number")
    batch, sent, skipped = [], 0, 0
    for f in cands:
        try:
            fd = f.obj()
            if fd is None or not hasattr(fd, "offering_data"):
                skipped += 1
                continue
            ig = fd.offering_data.industry_group
            if not ig or ig.industry_group_type != POOLED:
                skipped += 1
                continue
            batch.append(item_from(f, fd))
        except Exception as e:  # noqa: BLE001
            log(f"  skip {f.company}: {e}")
            skipped += 1
        if len(batch) >= 100:
            sent += flush(batch, list_name, start, end, sent)
            batch = []
    # Leftovers go after the loop: when the last candidates were skipped, an in-loop "last item" check never fired
    # and up to 99 funds per window were silently dropped (fixed 2 Oct 2026).
    if batch:
        sent += flush(batch, list_name, start, end, sent)
    log(f"{list_name}: {sent} pooled funds sent, {skipped} skipped (not a pooled fund or unreadable)")


def efts(query, start=None, limit=100):
    """EDGAR full-text search over Form D and D/A. They must be searched SEPARATELY: asking for forms=["D", "D/A"] in one call
    returns only the amendments (found 5 Oct 2026: "Electric Capital" gave 3 results combined vs 18 originals alone), which
    silently hid most later funds from the Fund II check. Returns (total, results)."""
    total, out = 0, []
    for form in ("D", "D/A"):
        res = search_filings(query, forms=[form], start_date=start, limit=limit)
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
        try:
            total, results = efts(f'"{name}"', start, limit=60)
        except Exception as e:  # noqa: BLE001
            log(f"    person {name}: search failed {e}")
            continue
        if total > 60:
            log(f"    person {name}: {total} filings, too common to use")
            continue
        opened = 0
        for r in sorted(results, key=lambda r: str(r.filed)):
            if r.accession_number in seen or (s.get("cik") and str(r.cik) == str(s["cik"])) or opened >= cap:
                continue
            seen.add(r.accession_number)
            try:
                f = r.get_filing()
                item = item_from(f, f.obj())
                item["via"] = "person"
                out.append(item)
                opened += 1
            except Exception as e:  # noqa: BLE001
                log(f"    could not open {r.company}: {e}")
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


def check():
    """For each queued / unchecked Fund I target: every later filing by the same fund (by CIK) and any later fund under the
    manager's name (EDGAR full-text search). The server reads them with readCheck()."""
    todo = post({"action": "ingest", "kind": "todo"}).get("signals", [])
    groups = {}
    for s in todo:
        groups.setdefault(s["manager_key"], []).append(s)
    log(f"check: {len(todo)} signals, {len(groups)} managers")
    for key, group in groups.items():
        s = group[0]
        since = s.get("filing_date") or "2015-01-01"
        start = (dt.date.fromisoformat(since) + dt.timedelta(days=1)).isoformat()
        items, seen = [], set()
        try:
            if s.get("cik"):
                for f in Company(int(s["cik"])).get_filings(form=["D", "D/A"]):
                    if str(f.filing_date) <= since or f.accession_no in seen:
                        continue
                    seen.add(f.accession_no)
                    try:
                        items.append(item_from(f, f.obj()))
                    except Exception:  # noqa: BLE001
                        items.append({"companyName": f.company, "cik": str(f.cik), "filingDate": str(f.filing_date), "formType": f.form, "accessionNumber": f.accession_no})
            for r in efts(f'"{s["check_keyword"]}"', start)[1]:
                if r.accession_number in seen:
                    continue
                seen.add(r.accession_number)
                name = re.sub(r"\s*\((?:[A-Z.\-]+\)\s*\()?CIK \d+\)\s*$", "", r.company or "").strip()
                light = {"companyName": name, "cik": r.cik, "filingDate": r.filed, "formType": r.form, "accessionNumber": r.accession_number}
                # A possible later fund: open the filing so the server can compare the named people with Fund I's.
                if LATER_RE.search(name):
                    try:
                        f = r.get_filing()
                        full = item_from(f, f.obj())
                        full["companyName"] = name or full["companyName"]
                        items.append(full)
                        continue
                    except Exception as e:  # noqa: BLE001
                        log(f"    could not open {name}: {e}")
                items.append(light)
            items += person_filings(s, start, seen)
            post({"action": "ingest", "kind": "check", "signal_ids": [x["id"] for x in group], "items": items})
            log(f"  {s['check_keyword']}: {len(items)} later filings")
        except Exception as e:  # noqa: BLE001
            log(f"  {s['check_keyword']}: failed {e}")
            post({"action": "ingest", "kind": "check_error", "signal_ids": [x["id"] for x in group], "error": str(e)[:300]})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="daily", choices=["daily", "live", "fund1", "check", "probe", "recheck"])
    ap.add_argument("--from", dest="start")
    ap.add_argument("--to", dest="end")
    a = ap.parse_args()
    if not KEY or not os.environ.get("SEC_IDENTITY"):
        sys.exit("Set the FUND_INGEST_KEY and SEC_IDENTITY secrets in GitHub (see the workflow file).")
    set_identity(os.environ["SEC_IDENTITY"])
    today = dt.date.today()
    if a.mode == "daily":
        scan("live", (today - dt.timedelta(days=4)).isoformat(), today.isoformat())
        c = today - dt.timedelta(days=round(42 * 30.44))
        scan("fund1", (c - dt.timedelta(days=3)).isoformat(), c.isoformat())
        check()
    elif a.mode == "live":
        scan("live", a.start or (today - dt.timedelta(days=30)).isoformat(), a.end or today.isoformat())
    elif a.mode == "fund1":
        start = dt.date.fromisoformat(a.start) if a.start else today - dt.timedelta(days=round(48 * 30.44))
        end = dt.date.fromisoformat(a.end) if a.end else today - dt.timedelta(days=round(36 * 30.44))
        cur = start
        while cur <= end:  # a quarter at a time keeps each index download small
            nxt = min(cur + dt.timedelta(days=90), end)
            scan("fund1", cur.isoformat(), nxt.isoformat())
            cur = nxt + dt.timedelta(days=1)
    elif a.mode == "probe":
        probe([n.strip() for n in (a.start or "").split(";") if n.strip()])
    elif a.mode == "recheck":  # queue every Fund I target already checked, then check them again (new person search)
        log(f"recheck: {post({'action': 'ingest', 'kind': 'requeue'}).get('queued')} queued")
        check()
    else:
        check()


if __name__ == "__main__":
    main()
