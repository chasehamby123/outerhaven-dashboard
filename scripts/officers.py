"""SEC officer names for Credit signals targets (10 Oct 2026): who to contact at each public company.

Every 10-K and 10-Q carries two certifications signed by name: Exhibit 31.1 (principal executive officer, the CEO) and
Exhibit 31.2 (principal financial officer, the CFO). They start "I, <name>, certify that ...". This reads them from each
target's latest 10-K / 10-Q, flags an 8-K Item 5.02 (officer change) filed after it, and takes the company phone and website
from the SEC company file. Sends results to the signal-contacts edge function (kind 'officers'); LinkedIn and email are found
there (Brave Search, Hunter).

Runs on GitHub Actions (.github/workflows/fund-signals.yml, mode `officers`, and daily). Needs env: SEC_IDENTITY, FUND_INGEST_KEY.
Offline test: python3 -I scripts/tests/test_officers.py
"""
import html
import os
import re
import sys
import time

import httpx

FN = os.environ.get("CONTACTS_URL", "https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/signal-contacts")
KEY = os.environ.get("FUND_INGEST_KEY", "")
UA = os.environ.get("SEC_IDENTITY", "OuterHaven Advisory ops@outerhaven.example")
TITLE = re.compile(r"(interim\s+)?(chief\s+financial\s+officer|principal\s+financial\s+officer|chief\s+executive\s+officer|principal\s+executive\s+officer|"
                   r"president(\s+and\s+chief\s+executive\s+officer)?|chief\s+accounting\s+officer|treasurer|vice\s+president[,\s]+finance|"
                   r"executive\s+chairman|chairman\s+and\s+chief\s+executive\s+officer)", re.I)


def log(*a):
    print(*a, flush=True)


_last = [0.0]


def sec_get(url, as_json=False):
    """SEC fetch: identifies itself, max ~4 requests/s, retries."""
    for attempt in range(4):
        wait = 0.26 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            r = httpx.get(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip, deflate"}, timeout=40, follow_redirects=True)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json() if as_json else r.text
        except Exception as e:  # noqa: BLE001
            if attempt == 3:
                raise
            log("  retry", url, e)
            time.sleep(2 * (attempt + 1))


def text_of(raw):
    t = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw or "")
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


NAME = re.compile(r"^[A-Z][A-Za-z'’.\-]+(?:\s+(?:[A-Z][A-Za-z'’.\-]*|de|van|von|da|di|del|la|le)){1,4}$")


def cert_name(text):
    """'I, John A. Smith, certify that ...' → 'John A. Smith' (None if it doesn't look like a person's name)."""
    m = re.search(r"\bI\s*,\s*([^,]{3,70}?)\s*,\s*(?:[^,]{0,120},\s*)?(?:hereby\s+)?certify", text)
    if not m:
        return None
    name = re.sub(r"\s+", " ", m.group(1)).strip().strip(".")
    name = re.sub(r",?\s*(Jr|Sr|II|III|IV)\.?$", "", name)
    return name if NAME.match(name) and len(name.split()) <= 5 else None


def cert_title(text, exhibit):
    """Best title: the one written under the signature (end of the exhibit), else from the exhibit number."""
    tail = text[-700:]
    hits = [m.group(0) for m in TITLE.finditer(tail)]
    if hits:
        t = re.sub(r"\s+", " ", hits[-1]).strip()
        return t[0].upper() + t[1:]
    return "Chief Financial Officer" if exhibit.endswith("31.2") else "Chief Executive Officer"


def role_of(title, exhibit):
    t = (title or "").lower()
    if "financial" in t or "treasurer" in t or "finance" in t or "accounting" in t:
        return "cfo"
    if "executive" in t or "president" in t or "chairman" in t:
        return "ceo"
    return "cfo" if exhibit.endswith("31.2") else "ceo"


def exhibits(index_html):
    """Filing index page → {'EX-31.1': url, 'EX-31.2': url} (first of each)."""
    out = {}
    for row in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", index_html or ""):
        cells = re.findall(r"(?is)<td[^>]*>(.*?)</td>", row)
        if len(cells) < 4:
            continue
        typ = text_of(cells[3]).upper()
        href = re.search(r'href="([^"]+)"', cells[2])
        if typ in ("EX-31.1", "EX-31.2", "EX-31") and href and typ not in out:
            u = href.group(1)
            out[typ] = ("https://www.sec.gov" + u) if u.startswith("/") else u
    return out


def officers(cik):
    j = sec_get(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json", as_json=True) or {}
    recent = (j.get("filings") or {}).get("recent") or {}
    rows = list(zip(recent.get("form", []), recent.get("accessionNumber", []), recent.get("filingDate", []), recent.get("items", []) or [""] * len(recent.get("form", []))))
    cert = next(((f, a, d) for f, a, d, _ in rows if f in ("10-K", "10-Q", "10-K/A")), None)
    out = {"cik": str(int(cik)), "company_name": j.get("name"), "people": [],
           "phone": (j.get("phone") or (j.get("addresses") or {}).get("business", {}).get("phone") or None),
           "website": (j.get("website") or j.get("investorWebsite") or None)}
    if out["website"]:
        w = out["website"] if out["website"].startswith("http") else "https://" + out["website"]
        out["website"], out["domain"] = w, re.sub(r"^www\.", "", httpx.URL(w).host or "") or None
    if not cert:
        return out
    form, acc, filed = cert
    base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}"
    ex = exhibits(sec_get(f"{base}/{acc}-index.htm"))
    seen = {}
    for typ in ("EX-31.2", "EX-31.1", "EX-31"):
        if typ not in ex:
            continue
        t = text_of(sec_get(ex[typ]))
        name = cert_name(t)
        if not name:
            continue
        title = cert_title(t, typ)
        p = {"name": name, "title": title, "role": role_of(title, typ), "source_url": ex[typ], "filed": filed, "form": form}
        if name in seen:  # one person signs both (small companies): keep one entry with both roles
            seen[name]["title"] = seen[name]["title"] if "financial" in seen[name]["title"].lower() and "executive" in seen[name]["title"].lower() else f"{seen[name]['title']} and {title}"
            continue
        seen[name] = p
    out["people"] = list(seen.values())
    # Officer change announced after the certification: the names above may be out of date.
    for f, a, d, items in rows:
        if f in ("8-K", "8-K/A") and d > filed and "5.02" in (items or ""):
            out["officer_change"] = {"date": d, "url": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{a.replace('-', '')}/{a}-index.htm"}
            break
    return out


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
            time.sleep(3)


def main():
    if not KEY:
        sys.exit("FUND_INGEST_KEY missing")
    todo = post({"kind": "officers_todo"}).get("items") or []
    log(f"{len(todo)} credit targets need SEC officers")
    batch, found, failed = [], 0, 0
    for i, it in enumerate(todo, 1):
        try:
            o = officers(it["cik"])
            o["company_name"] = o.get("company_name") or it.get("company_name")
            found += 1 if o["people"] else 0
            batch.append(o)
        except Exception as e:  # noqa: BLE001
            failed += 1
            log("  failed", it.get("cik"), it.get("company_name"), e)
        if len(batch) >= 25 or (i == len(todo) and batch):
            post({"kind": "officers", "items": batch})
            batch = []
        if i % 50 == 0:
            log(f"  {i}/{len(todo)} read, {found} with names")
    log(f"done: {len(todo)} read, {found} with named officers, {failed} failed")
    if failed > max(5, len(todo) // 5):
        sys.exit(1)


if __name__ == "__main__":
    main()
