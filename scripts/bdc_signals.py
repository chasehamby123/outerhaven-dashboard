"""BDC signals: private companies that borrow from BDCs (business development companies), from the SEC's BDC data sets.

Every BDC lists each loan in its Schedule of Investments (SOI) every quarter; since Aug 2022 that table is XBRL-tagged and the
SEC publishes it as a monthly zip (2022-2025 quarterly). Per loan: the borrower (inside the "Investment, Identifier Axis" text),
industry, investment type, rate / spread, maturity date, principal, cost, fair value.
Source: https://www.sec.gov/data-research/sec-markets-data/bdc-data-sets

--probe: download one zip and print what's in it as GitHub annotations (the sandbox can't reach sec.gov).
"""
import argparse
import csv
import io
import os
import sys
import zipfile

import httpx

BASE = "https://www.sec.gov/files/datastandardsinnovation/data/business-development-company-bdc-data-sets/"
UA = os.environ.get("SEC_IDENTITY") or "OuterHaven Advisory research@outerhaven.group"


def log(*a):
    print(*a, flush=True)


def note(title, msg):
    msg = msg.replace("\r", " ").replace("\n", " | ")
    print(f"::notice title={title}::{msg[:60000]}", flush=True)


def fetch(name):
    r = httpx.get(BASE + name, headers={"User-Agent": UA, "Accept-Encoding": "gzip, deflate"}, timeout=600,
                  follow_redirects=True)
    r.raise_for_status()
    return zipfile.ZipFile(io.BytesIO(r.content))


def read_tsv(z, member):
    with z.open(member) as f:
        txt = io.TextIOWrapper(f, encoding="utf-8", errors="replace", newline="")
        yield from csv.DictReader(txt, delimiter="\t", quoting=csv.QUOTE_NONE)


def probe(name):
    """Max 10 notices per step on GitHub, so everything is packed into a few long ones."""
    z = fetch(name)
    soi = next((i.filename for i in z.infolist() if "soi" in i.filename.lower()), None)
    rows = list(read_tsv(z, soi))
    fill = {}
    for r in rows:
        for k, v in r.items():
            if v:
                fill[k] = fill.get(k, 0) + 1
    note("bdc fill", f"{len(rows)} rows; " + str(sorted([(k, n) for k, n in fill.items() if n >= 200], key=lambda x: -x[1])))
    cols = ("Investment, Issuer Name Axis", "Investee", "InvestmentsIdentifier", "Investment, Name Axis", "InvestmentPerformanceStatus",
            "Financial Instrument Performance Status Axis", "Investment, Non-income Producing [true false]", "Lien Category Axis",
            "Investment Type Axis", "Industry Sector Axis", "Investment, Issuer Affiliation Axis")
    note("bdc cols", " #### ".join(f"{c}: {fill.get(c, 0)} e.g. {[r[c][:80] for r in rows if r.get(c)][:8]}" for c in cols))
    by = {}
    for r in rows:
        if r.get("Investment, Identifier Axis") and r.get("Investment Maturity Date"):
            by.setdefault(r["cik"], []).append(r)
    ciks = list(by)
    chunk = (len(ciks) + 5) // 6
    for i in range(6):
        part = ciks[i * chunk:(i + 1) * chunk]
        note(f"bdc ids {i}", " || ".join(f"[{by[c][0]['name'][:25]}] " + " ~~ ".join(x["Investment, Identifier Axis"][:150] for x in by[c][3:5]) for c in part))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", default="")
    a = ap.parse_args()
    if a.probe:
        probe(a.probe)
        sys.exit(0)
