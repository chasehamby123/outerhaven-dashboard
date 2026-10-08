"""BDC signals: private companies that borrow from BDCs (business development companies), from the SEC's BDC data sets.

Why: UCC filings never show a loan amount, so private-company size was a guess. Every BDC lists each loan it holds in its
Schedule of Investments every quarter (XBRL-tagged since Aug 2022; the SEC publishes the table monthly). Per loan we get the
borrower (inside free text), principal, cost, fair value (the lender's own mark), maturity, rate / spread, PIK.
Source: https://www.sec.gov/data-research/sec-markets-data/bdc-data-sets

How it works
  1. Download the last few monthly zips; keep each BDC's latest quarter (and the one before, for mark changes).
  2. Pull the borrower name out of the identifier text (every BDC formats it differently): text up to a company suffix
     (LLC, Inc., Corp, L.P., Ltd ...), walking back to a boundary; without a suffix, the first segment that isn't
     investment-type / industry vocabulary. Then a vote across BDC families picks the shortest common form, so industry words
     glued in front ("Insurance AMBA Buyer, Inc.") fall off when another BDC lists "AMBA Buyer, Inc.".
  3. Group by a normalised name key across all BDCs: facility seen by BDCs = sum of principal (a LOWER bound: lenders also hold
     pieces in private funds), lender mark = fair value / principal, the main tranche's maturity, PIK, non-accrual, holders.
  4. Post companies that are in Peter's size range or show a trigger to the `bdc-signals` edge function (judged by
     classifyBdc in supabase/functions/bdc-signals/rules.js).
Modes: default = run and post; --dry = print stats and samples as GitHub annotations (the sandbox can't reach sec.gov);
--probe <zip> = raw look at one zip.
Needs env: FUND_INGEST_KEY, SEC_IDENTITY.
"""
import argparse
import csv
import datetime as dt
import io
import json
import os
import random
import re
import sys
import time
import zipfile
from collections import Counter, defaultdict

import httpx

csv.field_size_limit(10_000_000)
BASE = "https://www.sec.gov/files/datastandardsinnovation/data/business-development-company-bdc-data-sets/"
FN = os.environ.get("BDC_SIGNALS_URL", "https://nfcysxqdwpdhrdpgxrlo.supabase.co/functions/v1/bdc-signals")
KEY = os.environ.get("FUND_INGEST_KEY", "")
UA = os.environ.get("SEC_IDENTITY") or "OuterHaven Advisory research@outerhaven.group"
TODAY = dt.date.today()


def log(*a):
    print(*a, flush=True)


def note(title, msg, level="notice"):
    msg = str(msg).replace("\r", " ").replace("\n", " | ")
    print(f"::{level} title={title}::{msg[:60000]}", flush=True)


# ---------------------------------------------------------------- download

def zip_names(months=6):
    """Monthly zips from 2026 on (YYYY_MM_bdc.zip), quarterly before (YYYYqN_bdc.zip), newest first."""
    out, y, m = [], TODAY.year, TODAY.month
    for _ in range(months):
        if y >= 2026:
            out.append(f"{y}_{m:02d}_bdc.zip")
        else:
            q = f"{y}q{(m - 1) // 3 + 1}_bdc.zip"
            if q not in out:
                out.append(q)
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def fetch(name):
    for attempt in range(3):
        try:
            r = httpx.get(BASE + name, headers={"User-Agent": UA, "Accept-Encoding": "gzip, deflate"}, timeout=600,
                          follow_redirects=True)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return zipfile.ZipFile(io.BytesIO(r.content))
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise
            log("  retry", name, e)
            time.sleep(10 * (attempt + 1))


# Columns kept (the SOI table has ~300; labels follow the SEC's taxonomy year, so several names map to one field).
FIELDS = {
    "adsh": ["adsh"], "cik": ["cik"], "bdc": ["name"], "form": ["form"], "filed": ["filed"], "period": ["period"],
    "url": ["inlineurl"],
    "text": ["Investment, Identifier Axis", "Investment, Issuer Name Axis", "Investment, Name Axis", "Investee"],
    "industry_axis": ["Industry Sector Axis"], "affil": ["Investment, Issuer Affiliation Axis"],
    "type_axis": ["Investment Type Axis"], "rate": ["Investment Interest Rate"],
    "spread": ["Investment, Basis Spread, Variable Rate"], "maturity": ["Investment Maturity Date"],
    "principal": ["Investment Owned, Balance, Principal Amount", "Investment Owned, Face Amount"],
    "cost": ["Investment Owned, Cost", "Adjusted cost basis"],
    "fair": ["Investment Owned, Fair Value", "Initial fair value of Investment"],
    "pik": ["Investment, Interest Rate, Paid in Kind"], "nonincome": ["Investment, Non-income Producing [true false]"],
    "shares": ["Investment shares", "Investment Owned, Balance, Shares"],
    "perf": ["InvestmentPerformanceStatus", "Financial Instrument Performance Status Axis"],
}


def soi_rows(z):
    member = next((i.filename for i in z.infolist() if i.filename.lower().endswith("soi.tsv")), None)
    if not member:
        return
    with z.open(member) as f:
        rd = csv.reader(io.TextIOWrapper(f, encoding="utf-8", errors="replace", newline=""), delimiter="\t",
                        quoting=csv.QUOTE_NONE)
        head = next(rd, None)
        if not head:
            return                      # months with no BDC filings ship an empty table
        idx = {k: [head.index(c) for c in cols if c in head] for k, cols in FIELDS.items()}
        for row in rd:
            rec = {}
            for k, ix in idx.items():
                v = ""
                for i in ix:
                    if i < len(row) and row[i]:
                        v = row[i]
                        break
                rec[k] = v
            yield rec


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- names

SUFFIX = (r"L\.?\s?L\.?\s?C\.?|Inc\.?|Incorporated|Corp\.?|Corporation|L\.?\s?P\.?|LLLP|Ltd\.?|Limited|Co\.|Company|GmbH|"
          r"S\.?\s?[àa]\.?\s?r\.?\s?l\.?|S\.A\.|B\.V\.|N\.V\.|PLC|Plc|plc|Pty\.?\s?Ltd\.?|PTY\.?\s?LTD\.?|ULC|LLP|SAS|S\.p\.A\.|AG|Oyj|ApS")
SUFFIX_CS = re.compile(r"(?:,\s*)?\b(?:" + SUFFIX + r")(?![A-Za-z])")
SUFFIX_END = re.compile(r",? (?:" + SUFFIX + r")$")
PAREN = re.compile(r"\((?:[^()]*)\)")
# Words that are never part of a borrower name: investment vocabulary, instrument types, layout words.
VOCAB = set("""investments investment invs inv inv. in debt equity non-controlled/non-affiliated non-controlled/affiliated non-controlled
non-affiliated controlled affiliated affiliate non-control/non-affiliate non-control non-affiliate control portfolio company companies
ncna ptfl cmp brdy sdct lns at fair value of shareholder's shareholders made total first second 1st 2nd lien liens senior junior
secured unsecured loans loan term revolver revolving delayed draw ddtl unitranche last-out first-out super subordinated mezzanine
notes note bonds bond corporate type asset instrument facility issuer name interest rate reference spread sofr libor prime floor
maturity due date acquisition initial original purchase industry coupon cash pik toggle incremental tranche convertible
preferred common stock units unit shares warrants warrant class series credit line lines other private securities security bank
structured finance sector region country geography information canadian u.s. prtfl comp flsd - -- | ~ / : investments-non-controlled/non-affiliated
""".split())
COUNTRIES = ["United Kingdom", "Canada", "Australia", "France", "Germany", "Ireland", "Netherlands", "Luxembourg", "Spain", "Italy",
             "Sweden", "Norway", "Denmark", "Finland", "Switzerland", "Belgium", "Japan", "Singapore", "New Zealand", "Israel",
             "Cayman Islands", "Jersey", "Guernsey", "Bermuda", "Mexico", "Brazil", "India", "Austria", "Poland", "United States",
             "United States of America"]
COUNTRY_RE = re.compile(r"\b(" + "|".join(sorted(COUNTRIES, key=len, reverse=True)) + r")\b")
# GICS industries plus the variants BDCs use; longest first so "Health Care Providers & Services" beats "Health Care".
INDUSTRIES = sorted(set(x.strip() for x in """Aerospace & Defense|Aerospace and Defense|Air Freight & Logistics|Air freight and logistics|Airlines|
Automobile Components|Auto Components|Automobiles & Automobile Parts|Automobiles|Automotive|Banks|Beverages|Biotechnology|Broadline Retail|
Building Products|Capital Markets|Chemicals|Commercial Services & Supplies|Commercial and Professional Services|Commercial & Professional Services|
Communications Equipment|Construction & Engineering|Construction Materials|Consumer Finance|Consumer Staples Distribution & Retail|
Containers & Packaging|Distributors|Diversified Consumer Services|Diversified Financial Services|Diversified Telecommunication Services|
Electric Utilities|Electrical Equipment|Electronic Equipment, Instruments & Components|Energy Equipment & Services|Entertainment|Financial Services|
Food Products|Food & Staples Retailing|Gas Utilities|Ground Transportation|Health Care Equipment & Supplies|Health Care Providers & Services|
Health Care Technology|Health Care Services|Healthcare & Pharmaceuticals|Healthcare|Health Care|Hotels, Restaurants & Leisure|Household Durables|
Household Products|Independent Power and Renewable Electricity Producers|Industrial Conglomerates|Insurance|Interactive Media & Services|
Interactive Media and Services|Internet Software & Services|IT Services|Leisure Products|Life Sciences Tools & Services|Machinery|
Marine Transportation|Media|Metals & Mining|Multi-Utilities|Oil, Gas & Consumable Fuels|Paper & Forest Products|Passenger Airlines|
Personal Care Products|Pharmaceuticals|Professional Services|Real Estate Management & Development|Semiconductors & Semiconductor Equipment|
Software|Application Software|Systems Software|Enterprise SaaS|Specialty Retail|Technology Hardware, Storage & Peripherals|
Textiles, Apparel & Luxury Goods|Tobacco|Trading Companies & Distributors|Transportation Infrastructure|Water Utilities|
Wireless Telecommunication Services|Business Services|Consumer Services|Education|Cannabis|Wholesale|Retail|Transportation|Telecommunications|
Utilities: Services|Utilities|Services: Business|Services: Consumer|High Tech Industries|Construction & Building|Beverage, Food & Tobacco|
Media: Advertising, Printing & Publishing|Advertising|Containers, Packaging & Glass|Consumer goods: Durable|Consumer goods: Non-durable|
Environmental Industries|Hotel, Gaming & Leisure|Aerospace / MRO Services|Food and Beverage|Specialty Chemicals|Diversified Manufacturing|
Manufacturing|Information Technology|Technology|Diversified telecommunication services|Aerospace & defense|Software & Services|
Technology Hardware & Equipment|Technology, Hardware & Equipment|Retailing|Real Estate|Real Estate Management and Development|Media & Entertainment|
Consumer Durables & Apparel|Capital Goods|Automobiles & Components|Food, Beverage & Tobacco|Household & Personal Products|
Health Care Equipment & Services|Pharmaceuticals, Biotechnology & Life Sciences|Diversified Financials|Telecommunication Services|Materials|Energy|
Semiconductors|Publishing|Printing|Environmental & Facilities Services|IT Consulting|Consumer Products|Consumer Discretionary|Consumer Staples|
Industrials|Financials|Communication Services|Business Products|Healthcare Services|Healthcare Technology|Healthcare Providers|Specialty Finance|
Insurance Services|Buildings & Real Estate|Leisure & Entertainment|Chemicals, Plastics & Rubber|Metals & Mining|Forest Products & Paper|
Sovereign & Public Finance|Banking, Finance, Insurance & Real Estate|Wholesale Distribution|Distribution|Restaurants|Gaming|Hospitality|Hardware & Equipment|
Media: Diversified & Production|Media: Diversified and Production|Media: Broadcasting & Subscription|Media: Advertising, Printing & Publishing|
Services: Business|Services: Consumer|Consumer Goods: Durable|Consumer Goods: Non-Durable|Consumer Goods: Non-durable|Hotel, Gaming & Leisure|
Healthcare & Pharmaceuticals|High Tech Industries|Banking, Finance, Insurance & Real Estate|Capital Equipment|Wholesale|Utilities: Electric|
Utilities: Oil & Gas|Energy: Oil & Gas|Energy: Electricity|Transportation: Cargo|Transportation: Consumer|Forest Products & Paper|
Aerospace & Defense|Automotive|Beverage, Food & Tobacco|Chemicals, Plastics & Rubber|Construction & Building|Containers, Packaging & Glass|
Environmental Industries|Metals & Mining|Retail|Telecommunications|Sovereign & Public Finance|
Diversified & Production|Diversified and Production|Broadcasting & Subscription|Advertising, Printing & Publishing|Oil & Gas""".replace("\n", "").split("|")),
                    key=len, reverse=True)
INDUSTRIES = sorted(set(INDUSTRIES) | {i.replace(" & ", " and ") for i in INDUSTRIES} | {i.replace(" and ", " & ") for i in INDUSTRIES}, key=len, reverse=True)
IND_RE = re.compile(r"\b(" + "|".join(re.escape(i) for i in INDUSTRIES) + r")(?![A-Za-z])", re.I)
SEPS = re.compile(r"\s+[-–—|~]+\s+|\s*\|\s*|\s*;\s*|\s+--\s+|,\s+")
INSTR_RE = re.compile(r"\b(First|Second|1st|2nd|Senior|Super Senior|Unitranche|Term Loan|Revolv\w*|Delayed Draw|DDTL|Incremental|Subordinated|"
                      r"Mezzanine|Unsecured|Secured|Investment Type|Asset Type|Type of Investment|Instrument|Facility Type|Interest Rate|Reference Rate|"
                      r"Spread|SOFR|LIBOR|Maturity|Due \d|Acquisition Date|Initial Acquisition|Industry|Current Coupon|Floor|PIK|Convertible|"
                      r"Notes?\b|Bonds?\b|Warrants?\b|Preferred|Common|Class [A-Z0-9]\b|Series [A-Z0-9]|Units?\b|Shares?\b|Loan\b|Term\b|Revolver)")
GENERIC = {"holdings", "holding", "intermediate", "parent", "buyer", "acquisition", "acquisitions", "acquiror", "midco", "bidco", "topco",
           "holdco", "opco", "purchaser", "borrower", "finance", "financing", "finco", "group", "the", "us", "u", "s", "co", "company",
           "investment", "investments", "merger", "sub", "newco", "lux", "uk", "and", "of", "acquisitionco", "holdco", "i", "ii", "iii", "iv", "v",
           "vi", "vii", "viii", "ix", "x", "1", "2", "3", "4", "5"}
BUSINESS = set("""technologies technology tech services service solutions systems system health healthcare partners partner management global
enterprises enterprise international brands brand products product industries industry usa america american capital software consulting
operations network networks digital media marketing labs lab care medical dental logistics energy foods food financial insurance engineering
communications data group corp inc llc services, north south east west national united""".split())
SUFFIX_WORDS = {"llc", "l", "c", "inc", "incorporated", "corp", "corporation", "lp", "p", "lllp", "ltd", "limited", "gmbh", "sarl", "sa",
                "bv", "nv", "plc", "pty", "ulc", "llp", "sas", "spa", "oyj", "aps", "dba", "fka"}


def norm_words(s):
    s = PAREN.sub(" ", s).replace("&", " and ")
    return [w for w in re.sub(r"[^a-z0-9 ]+", " ", s.lower()).split() if w]


def key_of(name):
    """Grouping key across BDCs: lowercase words without legal suffixes and holdco words ("Buyer", "Midco", "Holdings")."""
    ws = norm_words(SUFFIX_END.sub("", name))
    core = [w for w in ws if w not in SUFFIX_WORDS and w not in GENERIC]
    return " ".join(core or [w for w in ws if w not in SUFFIX_WORDS] or ws)


def clean_text(t):
    t = t.replace("[Member]", " ").strip()
    t = re.sub(r"(?<=[a-z])Member$", "", t)
    for _ in range(2):
        t = PAREN.sub(" ", t)        # (dba ...), (fka ...), (Term Loan), (-12.3%)
    t = re.sub(r"\s+", " ", t)
    return t.strip(" ,;-|")


def strip_lead(s):
    """Drop leading vocabulary, % / number tokens, countries and an industry phrase."""
    while True:
        before = s
        s = re.sub(r"^[\s,:;|\-–~/.&]+", "", s)
        s = re.sub(r"^(?:and|of)\s+", "", s, flags=re.I)
        s = re.sub(r"^-?\d+(?:\.\d+)?%\s*", "", s)
        m = COUNTRY_RE.match(s)
        if m:
            s = s[m.end():]
        m = IND_RE.match(s)
        if m and len(s) > m.end() + 1:
            s = s[m.end():]
        first = s.split(" ", 1)
        if len(first) > 1 and first[0].lower().strip(",:;|-") in VOCAB:
            s = first[1]
        if s == before:
            return s.strip(" ,;-|")


def candidate(text):
    """Best-guess borrower name inside one identifier string (before the cross-BDC vote)."""
    t = clean_text(text)
    if not t:
        return ""
    m = SUFFIX_CS.search(t)
    while m:
        name = _before_suffix(t, m)
        if name:
            return name
        m = SUFFIX_CS.search(t, m.end())
    return _no_suffix(t)


def _before_suffix(t, m):
    """Name words walking back from a legal suffix; '' when there are none (e.g. 'Portfolio Company')."""
    if m.start() < 2:
        return ""
    head = t[:m.start()]
    cut = max(head.rfind(" - "), head.rfind("|"), head.rfind(";"), head.rfind(": "), head.rfind("% "), head.rfind(" -- "),
              head.rfind(" ~ "), head.rfind(" – "))
    head = head[cut + 1:] if cut >= 0 else head
    if "," in head:                       # "Industry, Company Velocity Buyer" → the last comma clause
        head = head[head.rfind(",") + 1:]
    words = head.split()
    keep = []
    for w in reversed(words):
        lw = w.lower().strip(",:;|")
        named = any(k.lower().strip(",.") not in GENERIC and k.lower().strip(",:;|") not in VOCAB for k in keep)
        if len(keep) >= 9 or (lw in VOCAB and lw not in GENERIC and lw not in ("and", "of", "the") and named):
            break
        keep.append(w)
    name = strip_lead(" ".join(reversed(keep)))
    ws = name.split()
    for n in range(len(ws) // 2, 0, -1):          # Apollo: "Accel International Accel International Holdings"
        if [w.lower() for w in ws[:n]] == [w.lower() for w in ws[n:2 * n]]:
            ws = ws[n:]
            break
    name = " ".join(ws)
    if not name or all(w.lower().strip(",.") in VOCAB | GENERIC for w in ws):
        return ""
    sfx = m.group(0).lstrip(", ").strip()
    return f"{name}{', ' if m.group(0).lstrip().startswith(',') else ' '}{sfx}"   # keep the filer's punctuation


def _no_suffix(t):
    # No legal suffix: take segments, drop vocabulary / industry / country segments, cut at the instrument description.
    for seg in SEPS.split(t):
        seg = seg.strip(" ,")
        if not seg:
            continue
        mi = INSTR_RE.search(seg)
        part = seg[:mi.start()] if mi else seg
        part = strip_lead(part)
        part = re.sub(r"\s+-?\d+(?:\.\d+)?%.*$", "", part).strip(" ,-")
        if not part or all(w.lower().strip(",") in VOCAB for w in part.split()):
            continue
        if IND_RE.fullmatch(part) or COUNTRY_RE.fullmatch(part) or re.fullmatch(r"[\d.%/ +-]+", part):
            continue
        part = re.sub(r"\s+\d{1,2}$", "", part).strip()
        if part.lower() in BUSINESS or part.lower() in VOCAB:
            continue
        return part[:120]
    return ""


def name_options(name):
    """Shorter forms of a candidate (dropping leading words), for the vote: 'Insurance AMBA Buyer, Inc.' → 'AMBA Buyer, Inc.'"""
    m = SUFFIX_END.search(name)
    base, sfx = (name[:m.start()], m.group(0)) if m else (name, "")
    ws = base.split()
    out = []
    for i in range(len(ws)):
        core = ws[i:]
        if all(w.lower().strip(",.") in GENERIC or w.lower().strip(",.") in BUSINESS for w in core):
            break
        out.append(" ".join(core) + sfx)
    return out or [name]


FOREIGN_FORM = re.compile(r"\b(AB|AS|A/S|GmbH|S\.?[àa]\.?\s?r\.?\s?l\.?|B\.V\.|N\.V\.|Pty|PTY|S\.A\.|SAS|S\.p\.A\.|Oyj?|ApS|PLC|plc)\b")


def family(bdc):
    return re.sub(r"[^A-Z]", "", (bdc or "").upper().split(" ")[0])[:8]


# ---------------------------------------------------------------- maturity / flags from text

MAT_KW = re.compile(r"(?:Maturity(?:\s*Date)?|Matures?|Due|MD|Exp(?:iration)?)\s*[:|]?\s*\|?\s*(\d{1,2}/\d{1,2}/\d{2,4}|\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2})", re.I)
ACQ_DATE = re.compile(r"(?:Initial |Original )?(?:Acquisition|Acquired|Purchase|Investment|Origination|Closing)\s*(?:Date)?\s*[-:|]?\s*"
                      r"(?:\d{1,2}/\d{1,2}/\d{2,4}|\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2})", re.I)
ANY_DATE = re.compile(r"(?<![\d/])(\d{1,2}/\d{1,2}/\d{2,4}|\d{1,2}/\d{4})(?![\d/])")


def parse_date(s):
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%m/%Y"):
        try:
            d = dt.datetime.strptime(s, fmt).date()
            return d.replace(day=28) if fmt == "%m/%Y" else d
        except ValueError:
            continue
    return None


def maturity_of(rec):
    if rec["maturity"]:
        d = parse_date(rec["maturity"][:10])
        if d:
            return d
    t = ACQ_DATE.sub(" ", rec["text"])
    m = MAT_KW.search(t)
    if m:
        return parse_date(m.group(1))
    # No keyword: the latest date after removing purchase dates, and only if it's after the balance sheet date (else it's an
    # acquisition / amendment date, not a maturity).
    dates = [d for d in (parse_date(x) for x in ANY_DATE.findall(t)) if d]
    per = parse_date((rec.get("period") or "")[:10]) if rec.get("period") else None
    if dates and (not per or max(dates) > per):
        return max(dates)
    return None


EQUITY_RE = re.compile(r"\b(equity|warrants?|preferred|common stock|common units?|class [a-z] units?|membership units?|shares|LP interest|"
                       r"partnership interest|co-invest)\b", re.I)
DEBT_RE = re.compile(r"\b(loan|lien|debt|notes?|bonds?|revolv\w*|unitranche|term|ddtl|delayed draw|senior secured|subordinated|mezzanine)\b", re.I)
SKIP_RE = re.compile(r"(\bCLO\b|collateralized loan|senior loan fund|\bSLF\b|joint venture|\bJV\b|money market|treasury|government obligations|"
                     r"cash equivalents|structured finance|liquidating trust|total investments|fund securities|\bfund\b,? (?:L\.?P|LLC)|collateri[sz]ed|unfunded|"
                     r"\b(?:19|20)\d{2}-[A-Z0-9]{1,6}\b|\bCMBS\b|\bABS\b|forward contract|swap)", re.I)
NONACCRUAL_RE = re.compile(r"non[- ]?accru", re.I)
PIK_RE = re.compile(r"\bPIK\b|paid[- ]in[- ]kind", re.I)


def control_flags(t, affil):
    lt = t.lower()[:200]
    controlled = bool(re.search(r"(?<!non-)(?<!non )(?<!non)\bcontrol(?:led)?\b", lt)) or affil.lower().startswith("investment, controlled")
    affiliated = bool(re.search(r"non-control(?:led)?[ /-]*affiliat|(?<!non-)(?<!non )affiliate investments", lt)) \
        or affil.lower().startswith("investment, affiliated")
    return controlled, affiliated


# ---------------------------------------------------------------- main

LOADED = []


def load(months):
    """Latest and previous quarter of every BDC across the last `months` monthly zips."""
    by_period = defaultdict(list)      # (cik, period) -> rows
    adsh = {}
    for name in zip_names(months):
        z = fetch(name)
        if not z:
            log("  missing", name)
            continue
        n = 0
        for r in soi_rows(z):
            if r["form"] not in ("10-K", "10-Q", "10-K/A", "10-Q/A"):
                continue
            k = (r["cik"], r["period"])
            if k in adsh and adsh[k] != r["adsh"]:
                if adsh[k] > r["adsh"]:
                    continue                    # keep the newest filing for a period (amendments)
                by_period[k] = []
            adsh[k] = r["adsh"]
            by_period[k].append(r)
            n += 1
        log(f"  {name}: {n} rows")
        LOADED.append(f"{name}:{n}")
    latest, prev = {}, {}
    periods = defaultdict(set)
    for (cik, period) in by_period:
        periods[cik].add(period)
    for cik, ps in periods.items():
        ps = sorted(ps, reverse=True)
        latest[cik] = by_period[(cik, ps[0])]
        if len(ps) > 1:
            prev[cik] = by_period[(cik, ps[1])]
    return latest, prev


def rows_to_holdings(rows):
    """Per row: name candidate + numbers. Skips subtotals, funds, cash."""
    out = []
    for r in rows:
        t = r["text"]
        if not t or SKIP_RE.search(t):
            continue
        cand = candidate(t)
        if not cand or len(cand) < 3:
            continue
        principal, fair, cost = num(r["principal"]), num(r["fair"]), num(r["cost"])
        eq_text = bool(EQUITY_RE.search(t)) and not DEBT_RE.search(t)
        debt = (bool(principal) or bool(DEBT_RE.search(t))) and not eq_text and not (r["shares"] and not principal)
        # Unfunded commitments (delayed draw / revolver not drawn): principal = commitment, cost and fair ~0 or negative.
        if debt and principal and (cost is None or cost <= 0.05 * principal) and (fair is None or fair <= 0.05 * principal):
            continue
        equity = not debt and (bool(r["shares"]) or bool(EQUITY_RE.search(t)))
        controlled, affiliated = control_flags(t, r["affil"])
        cm = COUNTRY_RE.search(t[:220])
        im = IND_RE.search(t)
        out.append({
            "cand": cand, "bdc": r["bdc"], "cik": r["cik"], "period": r["period"], "url": r["url"], "text": t[:300],
            "debt": debt, "equity": equity, "principal": principal or (cost if debt else 0) or 0.0, "fair": fair, "cost": cost,
            "maturity": maturity_of(r) if debt else None, "spread": num(r["spread"]), "rate": num(r["rate"]),
            "pik": (num(r["pik"]) or 0) > 0 or bool(PIK_RE.search(t)),
            "nonaccrual": bool(NONACCRUAL_RE.search(t)) or "nonaccrual" in r["perf"].lower() or "nonperforming" in r["perf"].lower()
                          or (debt and r["nonincome"].lower() == "true"),
            "controlled": controlled, "affiliated": affiliated,
            "country": cm.group(1) if cm and not cm.group(1).startswith("United States") else None,
            "industry": im.group(1) if im else (re.sub(r"\s*Sector$", "", r["industry_axis"].replace("[Member]", "").strip()) or None),
        })
    return out


def vote_names(holdings):
    """Each holding's name: the longest option of its candidate that 2+ BDC families also use, else the candidate."""
    fams = defaultdict(set)
    for h in holdings:
        for o in name_options(h["cand"]):
            fams[key_of(o)].add(family(h["bdc"]))
    def safe_drop(full, short_):
        """Words dropped from the front must be industry / vocabulary / country, unless the short form is distinctive and
        widely shared (Apollo writes '<brand> <legal name>'). Stops 'GrapeTree Medical Staffing' merging into 'Medical Staffing'."""
        dropped = full[:len(full) - len(short_)].strip()
        if not dropped or not strip_lead(dropped + " X").strip() or strip_lead(dropped + " X") == "X":
            return True
        core = [w for w in key_of(short_).split() if w not in BUSINESS and len(w) > 2]
        return len(core) >= 2 and len(fams[key_of(short_)]) >= 3

    for h in holdings:
        opts = name_options(h["cand"])
        pick = next((o for o in opts if len(fams[key_of(o)]) >= 2 and len(key_of(o)) >= 3 and safe_drop(opts[0], o)), None)
        h["name"] = pick or opts[0]
        h["key"] = key_of(h["name"])


def mark_of(hs):
    """Fair value / principal (fallback fair / cost) across the holdings, as % of par."""
    num_, den = 0.0, 0.0
    for h in hs:
        base = h["principal"] or h["cost"] or 0
        if base > 0 and h["fair"] is not None:
            num_ += h["fair"]
            den += base
    return round(100 * num_ / den, 1) if den > 0 else None


def build(latest, prev):
    hold = [h for rows in latest.values() for h in rows_to_holdings(rows)]
    phold = [h for rows in prev.values() for h in rows_to_holdings(rows)]
    vote_names(hold + phold)
    groups, pgroups = defaultdict(list), defaultdict(list)
    for h in hold:
        groups[h["key"]].append(h)
    for h in phold:
        pgroups[h["key"]].append(h)
    items = []
    for key, hs in groups.items():
        debt = [h for h in hs if h["debt"] and h["principal"] > 0]
        if not debt or not key:
            continue
        principal = sum(h["principal"] for h in debt)
        main = max(debt, key=lambda h: h["principal"])
        mats = [h["maturity"] for h in debt if h["maturity"] and h["principal"] >= 0.2 * principal]
        maturity = main["maturity"] or (min(mats) if mats else None)
        earliest = min(mats) if mats else maturity
        names = Counter(h["name"] for h in hs)
        by_bdc = {}
        for h in debt:
            b = by_bdc.setdefault(h["bdc"], {"principal": 0.0, "fair": 0.0, "tranches": 0, "maturity": None})
            b["principal"] += h["principal"]
            b["fair"] += h["fair"] or 0
            b["tranches"] += 1
            b["period"], b["url"] = h["period"], h["url"]
            if h["maturity"] and (not b["maturity"] or h["maturity"].isoformat() > b["maturity"]):
                b["maturity"] = h["maturity"].isoformat()
        holders = sorted(({"bdc": k, **{kk: (round(vv) if isinstance(vv, float) else vv) for kk, vv in v.items()}} for k, v in by_bdc.items()),
                         key=lambda x: -x["principal"])
        sp = [(h["spread"], h["principal"]) for h in debt if h["spread"]]
        w = sum(p for _, p in sp)
        spread = round(sum(s * p for s, p in sp) / w * 100, 2) if sp and w else None
        pmark = mark_of([h for h in pgroups.get(key, []) if h["debt"]])
        countries = Counter(h["country"] for h in hs if h["country"])
        if not countries and FOREIGN_FORM.search(names.most_common(1)[0][0]):
            countries["Outside the US"] = 1
        inds = Counter(h["industry"] for h in hs if h["industry"])
        items.append({
            "company_key": key[:200], "company_name": names.most_common(1)[0][0][:200],
            "industry": inds.most_common(1)[0][0][:80] if inds else None,
            "country": countries.most_common(1)[0][0] if countries else None,
            "facility": round(principal), "fair": round(sum(h["fair"] or 0 for h in debt)),
            "mark": mark_of(debt), "prev_mark": pmark,
            "maturity": maturity.isoformat() if maturity else None, "earliest_maturity": earliest.isoformat() if earliest else None,
            "spread": spread, "pik": any(h["pik"] for h in debt), "nonaccrual": any(h["nonaccrual"] for h in debt),
            "controlled": any(h["controlled"] for h in hs), "affiliated": any(h["affiliated"] for h in hs),
            "equity_held": any(h["equity"] for h in hs), "lenders": len(by_bdc), "holders": holders[:15],
            "period": max(h["period"] for h in debt), "sample": main["text"][:300],
        })
    return items


def wanted(it):
    """Send what the rules can use: debt seen by BDCs in a plausible range, plus any trigger."""
    if it["facility"] < 3e6 or it["facility"] > 600e6:
        return False
    mat = dt.date.fromisoformat(it["earliest_maturity"]) if it["earliest_maturity"] else None
    soon = bool(mat and (mat - TODAY).days <= 30 * 30)
    stressed = it["mark"] is not None and it["mark"] < 95
    dropped = it["mark"] is not None and it["prev_mark"] is not None and it["prev_mark"] - it["mark"] >= 3
    return bool(soon or stressed or dropped or it["pik"] or it["nonaccrual"])


def public_keys():
    try:
        r = httpx.get("https://www.sec.gov/files/company_tickers.json", headers={"User-Agent": UA}, timeout=60)
        r.raise_for_status()
        return {key_of(v["title"]): v["ticker"] for v in r.json().values()}
    except Exception as e:  # noqa: BLE001
        log("  tickers unavailable:", e)
        return {}


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


def fmt(i):
    return (f"{i['company_name']} [{i['industry']}] ${i['facility'] / 1e6:.1f}M mark {i['mark']} (prev {i['prev_mark']}) mat {i['earliest_maturity']} "
            f"lenders {i['lenders']}: {', '.join(h['bdc'][:22] for h in i['holders'][:3])}{' PIK' if i['pik'] else ''}"
            f"{' NONACCRUAL' if i['nonaccrual'] else ''}{' CTRL' if i['controlled'] else ''}{' AFF' if i['affiliated'] else ''} <<{i['sample'][:110]}>>")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", default="")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--months", type=int, default=6)
    a = ap.parse_args()
    if a.probe:
        z = fetch(a.probe)
        rows = list(soi_rows(z))
        note("bdc probe", f"{len(rows)} rows; first: {json.dumps(rows[:3])[:3000]}")
        return
    if not a.dry and not KEY:
        sys.exit("Set FUND_INGEST_KEY.")
    latest, prev = load(a.months)
    log(f"{len(latest)} BDCs with a latest quarter, {len(prev)} with the one before")
    items = build(latest, prev)
    tick = public_keys()
    for it in items:
        it["public_ticker"] = tick.get(it["company_key"])
    send = [it for it in items if wanted(it)]
    log(f"{len(items)} borrowers, {len(send)} sent")
    if a.dry:
        sizes = Counter("<10M" if i["facility"] < 10e6 else "10-75M" if i["facility"] < 75e6 else "75-150M" if i["facility"] < 150e6 else ">150M"
                        for i in items)
        multi = sum(1 for i in items if i["lenders"] > 1)
        note("bdc dry stats", f"zips {LOADED}; {len(latest)} BDCs; {len(items)} borrowers ({multi} with 2+ BDC lenders); sizes {dict(sizes)}; sent {len(send)}; "
             f"public matches {sum(1 for i in items if i['public_ticker'])}; no maturity {sum(1 for i in items if not i['maturity'])}; "
             f"controlled {sum(1 for i in items if i['controlled'])}, affiliated {sum(1 for i in items if i['affiliated'])}, "
             f"nonaccrual {sum(1 for i in items if i['nonaccrual'])}, pik {sum(1 for i in items if i['pik'])}")
        inrange = [i for i in send if 10e6 <= i["facility"] <= 150e6]
        soon = (TODAY + dt.timedelta(days=548)).isoformat()
        mat = sorted([i for i in inrange if i["earliest_maturity"] and i["earliest_maturity"] <= soon], key=lambda i: i["earliest_maturity"])
        stressed = sorted([i for i in inrange if i["mark"] is not None and i["mark"] < 90], key=lambda i: i["mark"])
        note("bdc maturing 10-150M", f"{len(mat)}: " + " || ".join(fmt(i) for i in mat[:35]))
        note("bdc stressed 10-150M", f"{len(stressed)}: " + " || ".join(fmt(i) for i in stressed[:35]))
        multi_ex = sorted([i for i in items if i["lenders"] >= 3], key=lambda i: -i["lenders"])[:30]
        note("bdc multi-lender names", " || ".join(f"{i['company_name']} ({i['lenders']}, ${i['facility'] / 1e6:.0f}M)" for i in multi_ex))
        random.seed(1)
        smp = random.sample(items, min(70, len(items)))
        note("bdc random names", " || ".join(f"{i['company_name']} <<{i['sample'][:90]}>>" for i in smp))
        return
    run = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    sent = 0
    for i in range(0, len(send), 300):
        j = post({"kind": "bdc", "run": run, "items": send[i:i + 300]})
        sent += len(send[i:i + 300])
        log(f"  posted {sent}/{len(send)} (+{j.get('added')})")
    post({"kind": "bdc_done", "run": run, "complete": len(latest) >= 100, "items": len(send),
          "stats": {"bdcs": len(latest), "borrowers": len(items), "sent": len(send)}})
    note("bdc run", f"{len(latest)} BDCs, {len(items)} borrowers, {len(send)} sent")


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001  (raw logs are unreadable from the session, so failures go out as an annotation)
        import traceback
        note("bdc failed", traceback.format_exc()[-3000:], "error")
        raise
