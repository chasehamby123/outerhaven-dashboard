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


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="probe")
    ap.add_argument("--q", default="Solomon Hess")
    a = ap.parse_args()
    if a.mode == "probe":
        probe(a.q)
    else:
        sys.exit("unknown mode")
