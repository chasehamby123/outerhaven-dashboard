"""UCC signals: sizable PRIVATE companies that need private credit (Peter's lane), from state UCC lien filings.

Runs on GitHub Actions (.github/workflows/fund-signals.yml, mode `ucc`, and inside the daily run) and posts companies to the
`ucc-signals` edge function (action ingest, kind `ucc`). Judging is server-side (classifyUcc in ucc-signals/rules.js).

Why UCC: a UCC-1 is a lender's public notice that it holds a lien on a company's assets. It is the only free public record
of who lends to private companies. One filing means little (every business leases a truck); the patterns that matter:
  * merchant cash advance / alternative lenders (filed "as representative" by CSC, CT Corp, First Corporate Solutions…),
    especially several in 18 months (stacking): expensive short-term money a private credit facility replaces;
  * IRS, state tax and labor-department liens, judgment liens: cash strain;
  * an active bank / agent lien that lapses in 3–12 months with no continuation: the facility is likely up for renewal.

Sources (free, public; every state that publishes UCC data at no cost, checked 7 Oct 2026):
  Connecticut  data.ct.gov xfev-8smz (one table: lien, debtor, secured party, lapse, status), nightly
  Colorado     data.colorado.gov wffy-3uut (filings), 8upq-58vz (debtors), ap62-sav4 (secured parties), nightly
  Oregon       data.oregon.gov snfi-f79b: LAST MONTH's filings only (all lien types, debtors + secured parties). Each run
               stores them in ucc_filing_archive (edge function kind archive_put) so the history builds up; older months
               are backfilled once from Wayback Machine copies of the CSV export.
  Florida      federal tax liens only (Florida's UCC registry is privatised): free SFTP sftp.floridados.gov (user Public,
               password published by the state), quarterly full file doc/quarterly/flr + daily files doc/flr/*.
  Not free: Vermont (free weekly bulk promised, no download found), West Virginia (subscription), Texas ($1,150 master).
UCC filings sit in the state where the company is ORGANIZED, so a Delaware LLC based in Connecticut files in Delaware
(no open data) and is missed.

Size: UCC filings carry no revenue, so every debtor is matched by normalized name + state to the SBA's PPP loan data
(data.sba.gov, loans of $150K+, cached by the workflow). PPP loan ≈ 2.5 months of 2019/20 payroll, plus jobs reported.
Only companies with a PPP loan of $500K+ are considered (≈ $7M+ revenue); the rules decide what is big enough.
Needs env: FUND_INGEST_KEY (same secret as fund signals).
"""
import argparse
import csv
import datetime as dt
import io
import os
import re
import sys
import time
import zipfile

import httpx

FN = os.environ.get("UCC_SIGNALS_URL", "https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/ucc-signals")
KEY = os.environ.get("FUND_INGEST_KEY", "")
PPP_URL = "https://data.sba.gov/sites/default/files/distribution/SBA-OCA-2022-07-001/public_150k_plus_240930.csv"
PPP_PATH = os.environ.get("PPP_CSV", "data/ppp/public_150k_plus_240930.csv")
PPP_MIN = 500_000
WINDOW_DAYS = 912          # look back 30 months for distress filings
PAGE = 50_000
TODAY = dt.date.today()
STATS = {"errors": []}
DRY = False                # --dry: read sources and print counts, post nothing


def log(*a):
    print(*a, flush=True)


# ---------- names ----------
SUFFIX = re.compile(r"\b(INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LIMITED|LTD|L L C|LLC|LLP|L L P|LP|L P|PLLC|PC|P C|PA|THE)\b")


def biz_key(name):
    s = (name or "").upper()
    s = re.split(r"\s+(D/?B/?A|A/?K/?A|F/?K/?A|T/?A)\b", s)[0]          # "ACME INC DBA ACME TOOLS" -> ACME
    s = re.sub(r",?\s+(A|AN)\s+([A-Z]+\s+){0,3}(CORPORATION|CORP|COMPANY|PARTNERSHIP|LLC|L\.L\.C\.)\b.*$", "", s)   # Oregon: "ACME INC, A CORPORATION"
    s = s.replace("&", " AND ")
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = SUFFIX.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


# ---------- secured party classes (order matters) ----------
CLASSES = [
    ("irs", r"INTERNAL REVENUE|\bIRS\b|DEPARTMENT OF THE TREASURY|UNITED STATES OF AMERICA"),
    ("state_tax", r"DEPARTMENT OF REVENUE|DEPT\.? OF REVENUE|REVENUE SERVICES|DEPARTMENT OF LABOR|DEPT\.? OF LABOR|EMPLOYMENT SECURITY|UNEMPLOYMENT|LABOR AND EMPLOYMENT|DEPARTMENT OF TAXATION|FRANCHISE TAX"),
    ("local_tax", r"TAX COLLECTOR|COLLECTOR OF (TAXES|REVENUE)|^(CITY|TOWN|BOROUGH|COUNTY|VILLAGE) OF\b|TREASURER|ASSESSOR"),
    ("sba", r"SMALL BUSINESS ADMINISTRATION"),
    ("fintech", r"WEBBANK|SHOPIFY|PAYPAL|SQUARE (CAPITAL|FINANCIAL)|\bBLOCK,? INC|AMAZON|STRIPE|CELTIC BANK|FUNDBOX|BLUEVINE|KABBAGE|ON ?DECK|LENDIO|FUNDING CIRCLE|INTUIT|QUICKBOOKS|CLEARCO|WAYFLYER|PARAFIN|HEADWAY CAPITAL"),
    # Equipment and vehicle finance before the cash-advance names: "LEAF Capital Funding" and "Med One Capital Funding" are lessors.
    ("equipment", r"LEASING|LEASE|CREDIT CORP|CAPITAL FUNDING|\bLEAF\b|MED ONE|SNAP.ON|KUBOTA|DEERE|CATERPILLAR|\bDLL\b|DE LAGE|TOYOTA|FORD MOTOR|DAIMLER|PACCAR|VOLVO|NAVISTAR|CNH |KOMATSU|XEROX|CANON|RICOH|GOODLEAP|SUNRUN|SUNNOVA|EVERBRIGHT|IGS |ENFIN|VENDOR FIN|EQUIPMENT|SHEFFIELD|MARLIN|NAVITAS|ASCENTIUM|BALBOA|DELL FIN|CISCO|HITACHI|MITSUBISHI HC|ISUZU|HYUNDAI|MERCEDES|BMW FIN|HONDA|NISSAN|ALLY|SANTANDER CONSUMER|CREDIT ACCEPTANCE|CAPITAL ONE AUTO|PAWNEE|TIME PAYMENT|AMUR|CLICKLEASE|STEARNS BANK"),
    # Named merchant cash advance / revenue-based funders (strong signal).
    ("mca", r"MERCHANT|CASH ADVANCE|ADVANCE (LLC|INC|GROUP)|\bFUNDING (GROUP|SOLUTIONS|EXPERTS|PARTNERS|SOURCE|NOW)|LCF GROUP|YELLOWSTONE|PEARL (DELTA|CAPITAL)|LIBERTAS|KAPITUS|FORA FINANCIAL|CREDIBLY|MULLIGAN|EVEREST BUSINESS|\bEBF\b|VELOCITY CAPITAL|RAPID FINANCE|CFG MERCHANT|ITRIA|FOX (CAPITAL|BUSINESS FUNDING)|WYNWOOD|CAPYTAL|GREENBOX|SPARTAN CAPITAL|1ST GLOBAL|CLOUDFUND|IOU (CENTRAL|FINANCIAL)|BYZFUNDER|FUNDKITE|IRUKA|PARKVIEW ADVANCE|MANTIS|ROK FINANCIAL|NEWCO CAPITAL|BITTY|LENDINI|LAST CHANCE FUNDING|UNIQUE FUNDING|VOX FUNDING|LEGEND FUNDING|FUNDFI|BLUETAPE|EXPANSION CAPITAL|FORWARD FINANCING|NATIONAL FUNDING|NATIONAL BUSINESS CAPITAL|BIZ2CREDIT|TBF GROUP|ELEVATE FUNDING|GOLDEN PEAK|LG FUNDING|SAMSON|PIRS CAPITAL|DIAMOND CAPITAL|AMERICAN CAPITAL ADVANCE|FUNDAMENTAL CAPITAL|ESSENTIAL FUNDING|STREAMLINE FUNDING|FINANCIAL PACIFIC|QUICK BRIDGE|SECURE ACCOUNT|BREAKOUT CAPITAL|BEST BUSINESS FUNDING|EQUITY BASED CAPITAL"),
    # Filing agents that hide the real lender ("CSC / CT Corporation / First Corporate Solutions, as representative"): cash-advance
    # funders use them a lot, but so do equipment lessors and banks. Weak on its own; several in a short time is a pattern.
    ("rep", r"AS (SECURED PARTY )?REPRESENTATIVE"),
    ("factoring", r"FACTOR|RECEIVABLES? (FINANCE|FUNDING|PURCHAS)|INVOICE"),
    ("agent", r"AS (ADMINISTRATIVE |COLLATERAL )?AGENT\b"),
    ("abl", r"CAPITAL FINANCE|BUSINESS CREDIT|COMMERCIAL FINANCE|ASSET.BASED|BUSINESS CAPITAL|CREDIT PARTNERS|CAPITAL PARTNERS|DIRECT LENDING|PRIVATE CREDIT|MEZZANINE"),
    ("bank", r"\bBANK\b|\bN\.? ?A\.?$|,? N\.A\.|SAVINGS|CREDIT UNION|BANCORP|BANCSHARES|TRUST COMPANY|BANKING|FARM CREDIT"),
]
CLASSES = [(k, re.compile(p)) for k, p in CLASSES]
LENDERS = {"bank", "agent", "abl"}


def classify(party):
    p = (party or "").upper()
    for k, rx in CLASSES:
        if rx.search(p):
            return k
    return "other"


def day(v):
    try:
        return dt.date.fromisoformat(str(v)[:10]) if v else None
    except ValueError:
        return None


# ---------- HTTP ----------
client = httpx.Client(timeout=180, headers={"User-Agent": "OuterHaven HQ ucc-signals (open data)"})


def get_json(url, params):
    for attempt in range(5):
        try:
            r = client.get(url, params=params)
            if r.status_code == 200:
                return r.json()
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:  # noqa: BLE001
            if attempt == 4:
                raise
            log("  retry", url, e)
            time.sleep(4 * (attempt + 1))


def soda(domain, ds, where, select, order=":id"):
    """Every row of a Socrata query, paged."""
    out, off = [], 0
    while True:
        rows = get_json(f"https://{domain}/resource/{ds}.json", {"$select": select, "$where": where, "$order": order, "$limit": PAGE, "$offset": off})
        out += rows
        if len(rows) < PAGE:
            return out
        off += PAGE


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


# ---------- PPP (size) ----------
def load_ppp(path=PPP_PATH):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        log("ppp: downloading", PPP_URL)
        with httpx.stream("GET", PPP_URL, timeout=600, follow_redirects=True) as r, open(path + ".part", "wb") as f:
            r.raise_for_status()
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
        os.replace(path + ".part", path)
    idx, by_key = {}, {}
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        for r in csv.DictReader(f):
            try:
                amt = float(r.get("CurrentApprovalAmount") or r.get("InitialApprovalAmount") or 0)
            except ValueError:
                continue
            if amt < PPP_MIN:
                continue
            st = (r.get("BorrowerState") or r.get("ProjectState") or "").strip().upper()
            k = biz_key(r.get("BorrowerName"))
            if not k or not st:
                continue
            try:
                jobs = int(float(r.get("JobsReported") or 0))
            except ValueError:
                jobs = 0
            cur = idx.get((k, st))
            if cur:
                cur["amount"] = max(cur["amount"], round(amt)); cur["jobs"] = max(cur["jobs"], jobs); cur["loans"] += 1
                continue
            rec = {"name": r.get("BorrowerName"), "amount": round(amt), "jobs": jobs, "naics": (r.get("NAICSCode") or "").strip(),
                   "business_type": r.get("BusinessType") or "", "approved": r.get("DateApproved") or "", "lender": r.get("OriginatingLender") or "",
                   "city": (r.get("BorrowerCity") or "").title(), "zip": (r.get("BorrowerZip") or "")[:5], "loans": 1,
                   "nonprofit": (r.get("NonProfit") or "").upper() == "Y"}
            idx[(k, st)] = rec
            by_key.setdefault(k, []).append(st)
    log(f"ppp: {len(idx)} borrowers with a loan of ${PPP_MIN:,}+")
    return idx, by_key


def public_names():
    """Names of SEC-listed companies (they belong in Credit signals, and their liens are often securitisations)."""
    try:
        r = client.get("https://www.sec.gov/files/company_tickers.json", headers={"User-Agent": os.environ.get("SEC_IDENTITY") or "OuterHaven HQ ops@outerhaven.example"})
        r.raise_for_status()
        out = {}
        for v in r.json().values():
            out.setdefault(biz_key(v.get("title")), v.get("ticker"))
        log(f"sec: {len(out)} listed company names")
        return out
    except Exception as e:  # noqa: BLE001
        log("sec tickers unavailable:", e)
        return {}


def match(idx, by_key, name, state):
    k = biz_key(name)
    if not k:
        return None, None
    rec = idx.get((k, state))
    if rec:
        return k, rec
    return k, None      # same name in another state is too often a different company (checked 7 Oct 2026)


# ---------- sources -> filings ----------
# filing = {src, no, kind, cls, party, filed, lapse, status, debtor, key, state, city, address, zip}
def ct_filings(cut, lapse_from, lapse_to):
    cols = "id_lien_flng_nbr,lien_status,cd_flng_type,debtor_nm_bus,debtor_ad_str1,debtor_ad_city,debtor_ad_state,debtor_ad_zip,sec_party_nm_bus,sec_party_nm_first,sec_party_nm_last,dt_lapse,dt_accept"
    ds = ("data.ct.gov", "xfev-8smz")
    rows = soda(*ds, f"dt_accept >= '{cut}' AND cd_flng_type in ('ORIG FIN STMT','JUDGMENT LIEN') AND debtor_nm_bus IS NOT NULL", cols)
    log(f"ct: {len(rows)} filings since {cut}")
    rows += soda(*ds, f"lien_status = 'Active' AND cd_flng_type = 'ORIG FIN STMT' AND dt_lapse between '{lapse_from}' and '{lapse_to}' AND dt_accept < '{cut}' AND debtor_nm_bus IS NOT NULL", cols)
    STATS["ct_rows"] = len(rows)
    out = []
    for r in rows:
        party = r.get("sec_party_nm_bus") or " ".join(x for x in (r.get("sec_party_nm_first"), r.get("sec_party_nm_last")) if x)
        judgment = r.get("cd_flng_type") == "JUDGMENT LIEN"
        out.append({"src": "CT", "no": r.get("id_lien_flng_nbr"), "kind": "judgment" if judgment else "ucc",
                    "cls": "judgment" if judgment else classify(party), "party": (party or "").strip()[:120],
                    "filed": day(r.get("dt_accept")), "lapse": day(r.get("dt_lapse")),
                    "status": "active" if (r.get("lien_status") or "").lower() == "active" else "released",
                    "debtor": r.get("debtor_nm_bus"), "state": (r.get("debtor_ad_state") or "CT").strip().upper()[:2] or "CT",
                    "city": (r.get("debtor_ad_city") or "").title(), "address": r.get("debtor_ad_str1") or "", "zip": (r.get("debtor_ad_zip") or "")[:5]})
    return out


def co_filings(idx, by_key, cut, refi_from, refi_to):
    dom, F, D, S = "data.colorado.gov", "wffy-3uut", "8upq-58vz", "ap62-sav4"
    lo = get_json(f"https://{dom}/resource/{F}.json", {"$select": "min(fileid) as f", "$where": f"filingdate >= '{cut}'"})[0]["f"]
    rr = get_json(f"https://{dom}/resource/{F}.json", {"$select": "min(fileid) as a, max(fileid) as b", "$where": f"filingdate between '{refi_from}' and '{refi_to}'"})[0]
    where = f"(fileid >= {int(lo)}" + (f" OR fileid between {int(rr['a'])} and {int(rr['b'])})" if rr.get("a") else ")") + " AND organizationname IS NOT NULL"
    debtors = soda(dom, D, where, "fileid,organizationname,address1,city,state,zipcode,recordstatus", order="fileid,debtorid")
    log(f"co: {len(debtors)} business debtor rows")
    STATS["co_debtor_rows"] = len(debtors)
    # Only debtors we can size go further: a few thousand filings instead of hundreds of thousands.
    keep = {}
    for d in debtors:
        if (d.get("recordstatus") or "active").lower() != "active":
            continue
        st = (d.get("state") or "CO").strip().upper()[:2] or "CO"
        k, rec = match(idx, by_key, d.get("organizationname"), st)
        if rec:
            keep.setdefault(d["fileid"], []).append(d | {"st": st})
    ids = list(keep)
    log(f"co: {len(ids)} filings name a sized company")
    STATS["co_sized_filings"] = len(ids)
    filings, parties = {}, {}
    for i in range(0, len(ids), 150):
        chunk = ",".join(str(int(x)) for x in ids[i:i + 150])
        for f in get_json(f"https://{dom}/resource/{F}.json", {"$where": f"fileid in ({chunk})", "$limit": 5000}):
            filings[f["fileid"]] = f
        for p in get_json(f"https://{dom}/resource/{S}.json", {"$where": f"fileid in ({chunk})", "$limit": 5000}):
            if (p.get("recordstatus") or "active").lower() == "active":
                parties.setdefault(p["fileid"], []).append(p)
    # Amendments to these filings: terminations release the lien, continuations push the lapse date.
    masters = [f["transactionid"] for f in filings.values() if f.get("transactiontype") == "Initial Filing"]
    ended, lapse = set(), {}
    for i in range(0, len(masters), 100):
        chunk = ",".join(f"'{m}'" for m in masters[i:i + 100])
        for a in get_json(f"https://{dom}/resource/{F}.json", {"$select": "masterdocumentid,documenttype,terminationflag,continuation,lapsedate",
                                                                "$where": f"masterdocumentid in ({chunk}) AND transactiontype = 'Amendment'", "$limit": 5000}):
            m, doc = a.get("masterdocumentid"), (a.get("documenttype") or "").lower()
            if a.get("terminationflag") is True or "termination" in doc or "release" in doc:
                ended.add(m)
            if a.get("continuation") is True and day(a.get("lapsedate")):
                lapse[m] = max(lapse.get(m) or dt.date.min, day(a.get("lapsedate")))
    out = []
    for fid, f in filings.items():
        if f.get("transactiontype") != "Initial Filing":
            continue
        ft = f.get("filingtype") or ""
        if ft in ("lien_hosp", "efs") or f.get("manufacturedhometransactions") is True:
            continue
        m = f.get("transactionid")
        for p in parties.get(fid, []) or [{}]:
            party = p.get("organizationname") or " ".join(x for x in (p.get("firstname"), p.get("lastname")) if x)
            cls = "irs" if ft == "lien_irs" else classify(party)
            if ft == "lien_othr_stat" and cls not in ("irs", "state_tax", "local_tax"):
                cls = "statutory"
            for d in keep[fid]:
                out.append({"src": "CO", "no": m, "kind": ft or "ucc", "cls": cls, "party": (party or "").strip()[:120],
                            "filed": day(f.get("filingdate")), "lapse": lapse.get(m) or day(f.get("lapsedate")),
                            "status": "released" if (m in ended or f.get("terminationflag") is True) else "active",
                            "debtor": d.get("organizationname"), "state": d["st"], "city": (d.get("city") or "").title(),
                            "address": d.get("address1") or "", "zip": (d.get("zipcode") or "")[:5]})
    return out


# ---------- archive (rolling-window states) ----------
def archive_put(src, filings):
    rows = [{**f, "filed": str(f["filed"]) if f["filed"] else None, "lapse": str(f["lapse"]) if f["lapse"] else None} for f in filings]
    for i in range(0, len(rows), 1000):
        if not DRY:
            post({"action": "ingest", "kind": "archive_put", "items": rows[i:i + 1000]})


def archive_get(src, since):
    out, off, months = [], 0, []
    while True:
        j = post({"action": "ingest", "kind": "archive_get", "src": src, "since": since, "offset": off})
        if off == 0:
            months = j.get("months") or []
        out += j.get("rows") or []
        if len(j.get("rows") or []) < 1000:
            break
        off += 1000
    for f in out:
        f["filed"], f["lapse"] = day(f["filed"]), day(f["lapse"])
    return out, set(months)


def any_day(v):
    v = (v or "").strip()
    if not v:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%Y %I:%M:%S %p", "%Y%m%d", "%m%d%Y"):
        try:
            return dt.datetime.strptime(v[:26] if "T" in v else v, fmt).date()
        except ValueError:
            pass
    return day(v)


# ---------- Oregon ----------
OR_CSV = "https://data.oregon.gov/api/views/snfi-f79b/rows.csv?accessType=DOWNLOAD"
OR_SKIP = {"EFS"}                         # farm-products effective financing statements


def or_rows_to_filings(rows):
    """Oregon rows are one per party (DB debtor / SP secured party) per file number."""
    by = {}
    for r in rows:
        n = {re.sub(r"[^a-z0-9]+", "_", (k or "").strip().lower()).strip("_"): (v if isinstance(v, str) else (v or "")) for k, v in r.items()}
        lt = (n.get("lien_type") or "").upper()
        if lt in OR_SKIP:
            continue
        fno = n.get("original_file_number") or (n.get("file_number") or "").split("-")[0]
        g = by.setdefault(fno, {"db": [], "sp": [], "lt": lt, "initial": False, "filed": None, "lapse": None, "released": False})
        ft = (n.get("file_type") or "").upper()
        if ft == "INITIAL":
            g["initial"], g["lt"] = True, lt
            g["filed"] = any_day(n.get("filing_date"))
        if lt.endswith("-X"):                      # IRS-X: release of a federal tax lien
            g["released"] = True
        g["lapse"] = any_day(n.get("lapse_date")) or g["lapse"]
        if ft != "INITIAL":
            continue
        ent = (n.get("entity") or "").strip()
        if (n.get("party_type") or "").upper() == "SP":
            g["sp"].append(ent)
        elif (n.get("party_type") or "").upper() == "DB" and (n.get("entity_type") or "").upper() == "ORG":
            g["db"].append({"debtor": ent, "state": (n.get("st_cd_txt") or n.get("state") or "OR").strip().upper()[:2] or "OR",
                            "city": (n.get("city_descr") or n.get("city") or "").title(), "address": n.get("mail_addr_1") or "",
                            "zip": (n.get("zip_code_txt") or n.get("zip_code") or "")[:5]})
    out = []
    for fno, g in by.items():
        if not g["initial"] or not g["db"]:
            continue
        for party in g["sp"] or [""]:
            cls = "irs" if g["lt"].startswith("IRS") else classify(party)
            if g["lt"] not in ("UCC", "IRS") and cls not in ("irs", "state_tax", "local_tax"):
                cls = "statutory"
            for d in g["db"]:
                out.append({"src": "OR", "no": fno, "kind": g["lt"].lower() or "ucc", "cls": cls, "party": party[:120], "filed": g["filed"],
                            "lapse": g["lapse"], "status": "released" if g["released"] else "active", **d})
    return out


def or_filings(cut):
    current = soda("data.oregon.gov", "snfi-f79b", "1=1", "*")
    got = or_rows_to_filings(current)
    log(f"or: {len(current)} rows last month -> {len(got)} business filings")
    archive_put("OR", got)
    have = archive_get("OR", cut)[1] if not DRY else set()
    # One-time backfill from Wayback Machine copies of the monthly CSV (only months the archive doesn't have yet).
    try:
        caps = client.get("https://web.archive.org/cdx/search/cdx", params={"url": "data.oregon.gov/api/views/snfi-f79b/rows.csv*", "output": "json",
                                                                           "filter": "statuscode:200", "from": cut[:4]}).json()[1:]
    except Exception as e:  # noqa: BLE001
        caps = []
        print(f"::warning title=ucc OR backfill::Wayback index unavailable: {e}", flush=True)
    STATS["or_wayback_captures"] = len(caps)
    for cap in caps:
        ts, orig = cap[1], cap[2]
        month = (dt.date(int(ts[:4]), int(ts[4:6]), 1) - dt.timedelta(days=1)).strftime("%Y-%m")   # the CSV holds the previous month
        if month in have or month < cut[:7]:
            continue
        try:
            r = client.get(f"https://web.archive.org/web/{ts}id_/{orig}", follow_redirects=True)
            rows = list(csv.DictReader(io.StringIO(r.text)))
            back = or_rows_to_filings(rows)
            archive_put("OR", back)
            have |= {f["filed"].strftime("%Y-%m") for f in back if f["filed"]}
            STATS.setdefault("or_backfill", {})[month] = len(back)
            log(f"or: backfilled {ts} -> {len(back)} filings")
        except Exception as e:  # noqa: BLE001
            print(f"::warning title=ucc OR backfill::{ts}: {e}", flush=True)
    if DRY:
        return got
    rows, months = archive_get("OR", cut)
    STATS["or_months"] = sorted(months)
    log(f"or: {len(rows)} archived filings since {cut} ({len(months)} months)")
    return rows


# ---------- Florida (federal tax liens) ----------
FL_HOST = "sftp.floridados.gov"


def fl_filings(cut):
    import paramiko
    t = paramiko.Transport((FL_HOST, 22))
    t.connect(username="Public", password=os.environ.get("FL_SFTP_PASSWORD", "PubAccess1845!"))   # published on dos.fl.gov
    sftp = paramiko.SFTPClient.from_transport(t)
    root = next((p for p in ("/Public/doc", "/doc", "doc", "Public/doc") if _isdir(sftp, p)), None)
    if not root:
        raise RuntimeError("FL: doc folder not found; top level = " + ",".join(sftp.listdir(".")))
    os.makedirs("data/fl", exist_ok=True)
    cutd = dt.date.fromisoformat(cut)
    filings, debtors = {}, {}

    def read_lines(name, data):
        if name.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                for m in z.namelist():
                    yield m, z.read(m).decode("latin-1").splitlines()
        else:
            yield name, data.decode("latin-1").splitlines()

    def take(name, lines):
        base = os.path.basename(name).lower().split(".")[0]
        kind = base[-1:]
        for ln in lines:
            if kind == "f" and len(ln) >= 56:
                if ln[31:32] != "F":
                    continue
                filings[ln[0:12].strip()] = {"filed": any_day(ln[12:20]), "status": ln[30:31], "exp": any_day(ln[48:56])}
            elif kind == "d" and len(ln) >= 196:
                if ln[68:69] != "C":
                    continue
                debtors.setdefault(ln[1:13].strip(), []).append({"debtor": ln[13:68].strip(), "address": ln[69:113].strip(), "city": ln[157:185].strip().title(),
                                                                "state": ln[185:187].strip().upper() or "FL", "zip": ln[187:192].strip()})

    qdir = f"{root}/quarterly/flr"
    qfiles = sorted(sftp.listdir_attr(qdir), key=lambda a: a.st_mtime)
    log("fl: quarterly", [(a.filename, a.st_size) for a in qfiles])
    q_time = 0
    for a in qfiles:
        buf = io.BytesIO(); sftp.getfo(f"{qdir}/{a.filename}", buf)
        for m, lines in read_lines(a.filename, buf.getvalue()):
            take(m, lines)
        q_time = max(q_time, a.st_mtime)
    for sub in ("filings", "debtors"):
        d = f"{root}/flr/{sub}"
        try:
            daily = [a for a in sftp.listdir_attr(d) if a.st_mtime >= q_time - 86400]
        except OSError as e:
            log("fl: no daily folder", d, e); continue
        for a in sorted(daily, key=lambda a: a.filename):
            buf = io.BytesIO(); sftp.getfo(f"{d}/{a.filename}", buf)
            for m, lines in read_lines(a.filename, buf.getvalue()):
                take(m, lines)
        log(f"fl: {len(daily)} daily {sub} files")
    sftp.close(); t.close()
    out = []
    for no, f in filings.items():
        if not f["filed"] or f["filed"] < cutd:
            continue
        for d in debtors.get(no, []):
            out.append({"src": "FL", "no": no, "kind": "lien_irs", "cls": "irs", "party": "Internal Revenue Service", "filed": f["filed"],
                        "lapse": f["exp"], "status": "active" if f["status"] == "A" else "released", **d})
    STATS["fl_liens"] = len(out)
    log(f"fl: {len(filings)} federal tax liens on file, {len(out)} business debtor rows since {cut}")
    return out


def _isdir(sftp, p):
    try:
        sftp.listdir(p)
        return True
    except OSError:
        return False


# ---------- per company ----------
def companies(filings, idx, by_key, listed=None):
    listed = listed or {}
    groups = {}
    for f in filings:
        k, rec = match(idx, by_key, f["debtor"], f["state"])
        if not rec:
            continue
        g = groups.setdefault(f"{k}|{f['state']}", {"key": k, "rec": rec, "filings": {}})
        g["filings"].setdefault((f["src"], f["no"], f["party"]), f)
    items = []
    for ck, g in groups.items():
        fl = sorted(g["filings"].values(), key=lambda x: x["filed"] or dt.date.min, reverse=True)
        live = [f for f in fl if f["status"] == "active"]

        def within(f, days):
            return f["filed"] and (TODAY - f["filed"]).days <= days

        cnt = lambda cls, days: sum(1 for f in live if f["cls"] == cls and within(f, days))  # noqa: E731
        mca18 = {(f["src"], f["no"]) for f in live if f["cls"] == "mca" and within(f, 548)}   # separate filings (one agent files for many funders)
        # First lapse only (filed ~5 years before it lapses): a 5-year-old facility is often reaching maturity. A lien that has
        # been continued for decades is an evergreen bank relationship, not a maturity, so it doesn't count.
        refi = [f for f in live if f["cls"] in LENDERS and f["lapse"] and f["filed"] and 90 <= (f["lapse"] - TODAY).days <= 365
                and (f["lapse"] - f["filed"]).days <= 1860]
        facts = {"mca_12m": cnt("mca", 365), "mca_18m": len(mca18), "irs_24m": cnt("irs", 730), "state_tax_24m": cnt("state_tax", 730),
                 "judgment_24m": cnt("judgment", 730), "factoring_24m": cnt("factoring", 730), "fintech_18m": cnt("fintech", 548),
                 "rep_12m": cnt("rep", 365), "rep_18m": len({(f["src"], f["no"]) for f in live if f["cls"] == "rep" and within(f, 548)}),
                 "sba": sum(1 for f in live if f["cls"] == "sba"), "bank_active": sum(1 for f in live if f["cls"] == "bank"),
                 "agent_active": sum(1 for f in live if f["cls"] in ("agent", "abl")),
                 "refi": [{"party": f["party"], "filed": str(f["filed"]), "lapse": str(f["lapse"])} for f in refi[:3]],
                 "released_24m": sum(1 for f in fl if f["status"] == "released" and f["cls"] in ("irs", "state_tax", "mca", "judgment") and within(f, 730))}
        trigger = facts["mca_12m"] or facts["mca_18m"] or facts["irs_24m"] or facts["state_tax_24m"] or facts["judgment_24m"] \
            or facts["factoring_24m"] or facts["fintech_18m"] or facts["refi"] or facts["rep_12m"]
        if not trigger:
            continue
        shown = [f for f in fl if f["cls"] not in ("equipment", "local_tax", "other")][:25]
        first = fl[0]
        names = {}
        for f in fl:
            names[f["debtor"]] = names.get(f["debtor"], 0) + 1
        items.append({"company_key": ck, "company_name": max(names, key=names.get), "name_key": g["key"], "state": first["state"],
                      "city": first["city"] or g["rec"]["city"], "address": first["address"], "zip": first["zip"] or g["rec"]["zip"],
                      "sources": sorted({f["src"] for f in fl}), "ppp": g["rec"] | ({"ticker": listed[g["key"]]} if g["key"] in listed else {}), "naics": g["rec"]["naics"], "facts": facts,
                      "latest_filing": str(max((f["filed"] for f in fl if f["cls"] not in ("equipment", "local_tax", "other", "bank") and f["filed"]), default=first["filed"])),
                      "liens": [{"src": f["src"], "no": f["no"], "class": f["cls"], "party": f["party"], "filed": str(f["filed"]) if f["filed"] else None,
                                 "lapse": str(f["lapse"]) if f["lapse"] else None, "status": f["status"], "kind": f["kind"]} for f in shown]})
    return items


def run():
    run_id = "ucc-" + dt.datetime.utcnow().strftime("%Y%m%d%H%M")
    cut = (TODAY - dt.timedelta(days=WINDOW_DAYS)).isoformat()
    lapse_from, lapse_to = (TODAY + dt.timedelta(days=90)).isoformat(), (TODAY + dt.timedelta(days=365)).isoformat()
    # A UCC-1 lapses 5 years after filing; originals filed 4–4.75 years ago lapse in the next 3–12 months.
    refi_from, refi_to = (TODAY + dt.timedelta(days=90) - dt.timedelta(days=1826)).isoformat(), (TODAY + dt.timedelta(days=365) - dt.timedelta(days=1826)).isoformat()
    idx, by_key = load_ppp()
    filings, ok = [], not ONLY
    sources = (("CT", lambda: ct_filings(cut, lapse_from, lapse_to)), ("CO", lambda: co_filings(idx, by_key, cut, refi_from, refi_to)),
               ("OR", lambda: or_filings(cut)), ("FL", lambda: fl_filings(cut)))
    for name, fn in sources:
        if ONLY and name not in ONLY:
            continue
        try:
            got = fn()
            filings += got
            log(f"{name}: {len(got)} filings kept")
            STATS.setdefault("by_source", {})[name] = len(got)
            if DRY:
                print(f"::notice title=ucc {name}::{len(got)} filings; " + str({k: v for k, v in STATS.items() if k.lower().startswith(name.lower())}), flush=True)
            elif name == "OR":
                print(f"::notice title=ucc OR::{len(got)} archived filings; wayback captures {STATS.get('or_wayback_captures')}, backfilled {STATS.get('or_backfill')}", flush=True)
        except Exception as e:  # noqa: BLE001
            ok = False
            print(f"::error title=ucc {name}::{e}", flush=True)
            STATS["errors"].append(f"{name}: {e}")
            log(f"{name} FAILED:", e)
    items = companies(filings, idx, by_key, public_names())
    STATS.update({"filings": len(filings), "companies": len(items), "window_from": cut})
    log(f"companies with a trigger and a size match: {len(items)}")
    if DRY:
        by = {}
        for it in items:
            for src in it["sources"]:
                by[src] = by.get(src, 0) + 1
        print(f"::notice title=ucc dry run::{len(filings)} filings, {len(items)} sized companies with a trigger, by source {by}", flush=True)
        return
    sent = 0
    for i in range(0, len(items), 150):
        r = post({"action": "ingest", "kind": "ucc", "items": items[i:i + 150], "run": run_id})
        sent += len(items[i:i + 150])
        log(f"  sent {sent} (new {r.get('added')})")
    r = post({"action": "ingest", "kind": "ucc_done", "run": run_id, "complete": ok, "items": sent, "stats": STATS})
    log(f"done: {sent} companies, dropped {r.get('dropped')}")
    if STATS["errors"]:
        sys.exit("a source failed: " + "; ".join(STATS["errors"]))


ONLY = set()

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma-separated registries, e.g. FL,OR (a partial run never drops companies)")
    ap.add_argument("--dry", action="store_true", help="read and count only; post nothing")
    a = ap.parse_args()
    ONLY = {x.strip().upper() for x in a.only.split(",") if x.strip()}
    DRY = a.dry
    if not KEY and not DRY:
        sys.exit("Set the FUND_INGEST_KEY secret in GitHub.")
    run()
