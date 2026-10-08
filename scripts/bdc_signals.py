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
    print(f"::notice title={title}::{msg[:3900]}", flush=True)


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
    z = fetch(name)
    files = [(i.filename, i.file_size) for i in z.infolist()]
    note(f"bdc {name} files", str(files))
    soi = next((f for f, _ in files if "soi" in f.lower()), None)
    if not soi:
        return
    rows = list(read_tsv(z, soi))
    cols = list(rows[0].keys()) if rows else []
    note("bdc soi columns", f"{len(rows)} rows; columns: {cols}")
    bdcs = {}
    for r in rows:
        bdcs.setdefault(r.get("name"), 0)
        bdcs[r.get("name")] += 1
    note("bdc soi registrants", f"{len(bdcs)} BDCs; top: {sorted(bdcs.items(), key=lambda x: -x[1])[:25]}")
    def g(r, *keys):
        for k in r:
            if all(x.lower() in k.lower() for x in keys):
                return r[k]
        return ""
    with_mat = [r for r in rows if g(r, "maturity") and g(r, "principal")]
    note("bdc soi coverage", f"principal {sum(1 for r in rows if g(r, 'principal'))}, maturity {sum(1 for r in rows if g(r, 'maturity'))},"
         f" both {len(with_mat)}, fair value {sum(1 for r in rows if g(r, 'fair value'))}, forms {sorted({r.get('form') for r in rows})},"
         f" periods {sorted({r.get('period') for r in rows})[-8:]}")
    step = max(1, len(with_mat) // 12)
    for i, r in enumerate(with_mat[::step][:12]):
        note(f"bdc sample {i}", " ; ".join(f"{k}={v}" for k, v in r.items() if v and k not in ("inlineurl",)))
    nomat = [r for r in rows if not g(r, "maturity")][:4]
    for i, r in enumerate(nomat):
        note(f"bdc no-maturity sample {i}", " ; ".join(f"{k}={v}" for k, v in r.items() if v and k not in ("inlineurl",)))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", default="")
    a = ap.parse_args()
    if a.probe:
        probe(a.probe)
        sys.exit(0)
