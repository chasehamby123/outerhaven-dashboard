"""Adviser size for every fund lead: who manages the fund, and how much they manage in total.

Source (SEC, free): the monthly "Information about Registered Investment Advisers and Exempt Reporting Advisers" files
(Form ADV Part 1A, Item 5.F regulatory assets under management for SEC-registered advisers; exempt reporting advisers
file no AUM), plus the IAPD search API (firm names and every other name the firm uses, e.g. its GP entities).

Mode probe: print the files' columns and the rows matching --q (debug, GitHub annotation).
"""
import argparse
import csv
import io
import os
import re
import sys
import time
import zipfile

import httpx

UA = os.environ.get("SEC_IDENTITY") or "OuterHaven Advisory ops@outerhaven.example"
PAGE = "https://www.sec.gov/data-research/sec-markets-data/information-about-registered-investment-advisers-exempt-reporting-advisers"
H = {"User-Agent": UA, "Accept-Encoding": "gzip, deflate"}


def log(*a):
    print(*a, flush=True)


def note(title, lines):
    print(f"::notice title={title}::" + "%0A".join(str(x).replace("%", "%25") for x in lines)[:3900], flush=True)


def get(url, tries=5, **kw):
    for i in range(tries):
        try:
            r = httpx.get(url, headers=H, timeout=180, follow_redirects=True, **kw)
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep((3, 8, 20, 45)[min(i, 3)])
            log("retry", url, str(e)[:100])


def latest_files():
    html = get(PAGE).text
    links = sorted(set(re.findall(r'href="([^"]*?/ia(\d{6})(-exempt)?\.zip)"', html)), key=lambda x: (x[1][4:6], x[1][0:4]), reverse=True)
    if not links:
        raise RuntimeError("no ia*.zip links on the SEC page")
    date = links[0][1]
    pick = {("exempt" if ex else "registered"): (u if u.startswith("http") else "https://www.sec.gov" + u) for u, d, ex in links if d == date}
    return date, pick


def rows(url):
    z = zipfile.ZipFile(io.BytesIO(get(url).content))
    name = [n for n in z.namelist() if n.lower().endswith((".csv", ".txt"))][0]
    raw = z.read(name)
    text = raw.decode("utf-8", errors="replace") if raw[:3] != b"\xef\xbb\xbf" else raw[3:].decode("utf-8", errors="replace")
    if "\x00" in text[:1000]:
        text = raw.decode("utf-16", errors="replace")
    delim = "|" if text[:2000].count("|") > text[:2000].count(",") else ","
    return list(csv.DictReader(io.StringIO(text), delimiter=delim))


def probe(q):
    date, files = latest_files()
    out = [f"files {date}: {files}"]
    for kind, url in files.items():
        rs = rows(url)
        cols = list(rs[0].keys()) if rs else []
        out.append(f"{kind}: {len(rs)} rows, {len(cols)} cols")
        note(f"cols {kind}", [" | ".join(cols[i:i + 12]) for i in range(0, len(cols), 12)])
        hits = [r for r in rs if q.lower() in " ".join(str(v) for v in r.values()).lower()][:3]
        for h in hits:
            note(f"hit {kind}", [f"{k}={v}" for k, v in h.items() if v not in ("", None)])
    r = get(f"https://api.adviserinfo.sec.gov/search/firm?query={q}&nrows=5&start=0&wt=json").json()
    out.append(str(r)[:2500])
    note("summary", out)


# ---- Matching funds to advisers ----
FN = os.environ.get("FUND_FN_URL", "https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/fund-signals")
KEY = os.environ.get("FUND_INGEST_KEY", "")
SUFFIX = {"llc", "lp", "l", "p", "inc", "ltd", "co", "corp", "corporation", "the", "company", "limited", "partnership", "lllp", "llp", "pllc", "pc"}


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


def norm(name):
    w = re.sub(r"[^a-z0-9 ]", " ", str(name or "").lower().replace("&", " and ")).split()
    return " ".join(x for x in w if x not in SUFFIX)


def money_num(v):
    try:
        return float(str(v).replace(",", "").strip()) if str(v or "").strip() not in ("", ".00") else None
    except ValueError:
        return None


def iso(d):
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(d or ""))
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}" if m else None


def entities(executives_text):
    """Entity names on the Form D (GP, manager, adviser LLCs): 'N/A KHC Partners GP II LLC (Executive Officer)'."""
    out = []
    for part in str(executives_text or "").split(";"):
        nm = re.sub(r"\s*\([^)]*\)\s*$", "", part).strip()
        m = re.match(r"^(?:n/?a|-+|none|\.)\s+(.+)$", nm, re.I)
        if m:
            out.append(m.group(1))
        elif re.search(r"\b(llc|l\.?p\.?|inc|ltd|management|advisors|advisers|capital|partners)\b", nm, re.I):
            out.append(nm)
    generic = {"capital", "partners", "management", "fund", "funds", "gp", "advisors", "advisers", "group", "holdings", "investments",
               "ventures", "equity", "general", "partner", "i", "ii", "iii", "and", "of"}
    return [e for e in out if len(norm(e)) >= 4 and any(w not in generic for w in norm(e).split())]


def load_advisers():
    date, files = latest_files()
    by_crd, by_name = {}, {}
    for kind, url in files.items():
        for r in rows(url):
            crd = str(r.get("Organization CRD#") or "").strip()
            if not crd:
                continue
            rec = {"crd": crd, "name": (r.get("Primary Business Name") or r.get("Legal Name") or "").strip(),
                   "type": "Registered" if kind == "registered" else "Exempt reporting",
                   "raum": money_num(r.get("5F(2)(c)")) if kind == "registered" else None,
                   "gav": money_num(r.get("Total Gross Assets of Private Funds")),
                   "pf": money_num(r.get("Count of Private Funds - 7B(1)")),
                   "filed": iso(r.get("Latest ADV Filing Date")), "state": (r.get("Main Office State") or "").strip()}
            by_crd[crd] = rec
            for n in {norm(r.get("Primary Business Name")), norm(r.get("Legal Name"))}:
                if n:
                    by_name.setdefault(n, set()).add(crd)
    log(f"advisers {date}: {len(by_crd)} ({sum(1 for x in by_crd.values() if x['type'] == 'Registered')} registered)")
    return date, by_crd, by_name


IAPD = {}


def iapd(q):
    if q in IAPD:
        return IAPD[q]
    hits = []
    for i in range(4):
        try:
            r = httpx.get("https://api.adviserinfo.sec.gov/search/firm", params={"query": q, "nrows": 12, "start": 0, "wt": "json"},
                          headers=H, timeout=60)
            if r.status_code == 429:
                raise RuntimeError("429")
            r.raise_for_status()
            hits = [h.get("_source", {}) for h in (r.json().get("hits") or {}).get("hits", [])]
            break
        except Exception as e:  # noqa: BLE001
            if i == 3:
                log("  IAPD failed", q, str(e)[:80])
                IAPD[q] = None
                return None
            time.sleep((3, 10, 30)[i])
    time.sleep(0.35)
    IAPD[q] = hits
    return hits


def match(s, by_crd, by_name):
    """Tie a fund to its adviser. Strong: a filing entity's name IS the adviser's name (or one of its other names on IAPD).
    Medium: the adviser's name starts with the manager's name and it sits in the same state."""
    ents = entities(s.get("executives_text"))
    en = {norm(e) for e in ents}
    for e in en:
        for crd in by_name.get(e, ()):
            return by_crd[crd], f"filing names the adviser ({by_crd[crd]['name']})"
    key, kw = norm(s.get("manager_key")), s.get("check_keyword") or ""
    hits = iapd(kw) if kw else []
    if hits is None:
        return None, "lookup failed"
    for h in hits:
        names = {norm(h.get("firm_name"))} | {norm(x) for x in (h.get("firm_other_names") or [])}
        if names & en:
            crd = str(h.get("firm_source_id"))
            return by_crd.get(crd) or {"crd": crd, "name": h.get("firm_name"), "type": "Not in SEC files (state-registered or relying adviser)",
                                       "raum": None, "gav": None, "pf": None, "filed": None}, "adviser's other names include a filing entity"
    if len(key) >= 5 and (len(key.split()) >= 2 or len(key) >= 7):
        st = (s.get("state") or "").upper()
        for h in hits:
            addr = h.get("firm_ia_address_details") or {}
            if isinstance(addr, str):
                try:
                    import json
                    addr = json.loads(addr)
                except Exception:  # noqa: BLE001
                    addr = {}
            hst = ((addr.get("officeAddress") or {}).get("state") or "").upper()
            names = [norm(h.get("firm_name"))] + [norm(x) for x in (h.get("firm_other_names") or [])]
            if st and hst == st and any(n == key or n.startswith(key + " ") for n in names):
                crd = str(h.get("firm_source_id"))
                rec = by_crd.get(crd) or {"crd": crd, "name": h.get("firm_name"), "type": "Not in SEC files (state-registered or relying adviser)", "raum": None, "gav": None, "pf": None, "filed": None}
                return rec, "same name and state"
    return None, None


def run():
    date, by_crd, by_name = load_advisers()
    todo = post({"action": "ingest", "kind": "adviser_todo"}).get("rows", [])
    log(f"{len(todo)} fund rows to size")
    batch, stats = [], {"strong": 0, "name_state": 0, "none": 0, "failed": 0}
    for i, s in enumerate(todo):
        rec, how = match(s, by_crd, by_name)
        if how == "lookup failed":
            stats["failed"] += 1
            continue
        if rec:
            stats["name_state" if how == "same name and state" else "strong"] += 1
            batch.append({"id": s["id"], "adviser_crd": rec["crd"], "adviser_name": rec["name"], "adviser_type": rec.get("type"),
                          "adviser_raum": rec.get("raum"), "adviser_pf_gav": rec.get("gav"), "adviser_pf_count": rec.get("pf"),
                          "adviser_match": how, "adviser_filed": rec.get("filed")})
        else:
            stats["none"] += 1
            batch.append({"id": s["id"]})
        if len(batch) >= 200:
            post({"action": "ingest", "kind": "adviser", "rows": batch})
            batch = []
        if i % 200 == 0:
            log(f"  {i}/{len(todo)} {stats}")
    if batch:
        post({"action": "ingest", "kind": "adviser", "rows": batch})
    log("done", stats)
    post({"action": "ingest", "kind": "data_check", "check": f"adviser {date}", "ok": stats["failed"] == 0, "checked": len(todo),
          "fixed": stats["strong"] + stats["name_state"], "errors": stats["failed"],
          "failures": [f"matched by filing entity: {stats['strong']}", f"matched by name + state: {stats['name_state']}", f"no adviser found: {stats['none']}"]})
    note("adviser run", [f"{k}: {v}" for k, v in stats.items()])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="probe")
    ap.add_argument("--q", default="Solomon Hess")
    a = ap.parse_args()
    if a.mode == "probe":
        probe(a.q)
    elif a.mode == "run":
        run()
    else:
        sys.exit("unknown mode")
