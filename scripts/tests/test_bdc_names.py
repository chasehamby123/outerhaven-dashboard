"""Offline checks for scripts/bdc_signals.py name / maturity parsing, on real identifier strings from the Aug 2026 SEC BDC data set.
Run: python3 -I scripts/tests/test_bdc_names.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bdc_signals as b  # noqa: E402

CASES = [  # (identifier text, expected name, expected maturity or None)
    ("Investments - non-controlled/non-affiliated Secured Debt Insurance AMBA Buyer, Inc. Asset Type First Lien Term Loan Reference Rate and Spread S + 5.25% Interest Rate 9.00% Maturity Date 7/30/2027 One", "AMBA Buyer, Inc.", "2027-07-30"),
    ("Investment in Senior Secured Loan -178.8% Florida Food Products, LLC Food Products Interest Rate 9.15% Reference Rate and Spread S + 5.50% Floor 2.00% Maturity 10/15/2030", "Florida Food Products, LLC", "2030-10-15"),
    ("Debt Investments United Kingdom 1st Lien/Senior Secured Debt Consilio Midco Limited (dba Cyncly) Industry Software Interest Rate 8.48% Reference Rate and Spread S + 4.75% Initial Acquisition Date 04/08/25 Maturity 04/16/32 One", "Consilio Midco, Limited", "2032-04-16"),
    ("Debt Investments - Diversified telecommunication services - Network Connex (f/k/a NTI Connect, LLC) - First lien senior secured loan - Interest Rate 8.57% - Spread 4.90% - Reference SOFR(Q) - Maturity Date 7/31/2027", "Network Connex", "2027-07-31"),
    ("NCNA Brdy Sdct Lns Automobile Components Clarios Global LP (fka Power Solutions) Type Term loan, first lien senior secured Acquisition date 5/21/2026", "Clarios Global, LP", None),
    ("Portfolio Company Debt Investments Aerospace and Defense Peraton Corp. Investment First Lien Senior Secured Loan Interest Rate 7.51% (S +CSA + 3.75%)", "Peraton, Corp.", None),
    ("Portfolio Company Non-Controlled/Non-Affiliated Investments 1st Lien/Secured Loans Canada Arterra Wines Canada Inc Instrument 1st Lien Term Loan Indus", "Arterra Wines Canada, Inc", None),
    ("Investments -- NCNA First Lien Debt Health Care Services Fertility (ITC) Investment Holdco, LLC/Fertility (ITC) Buyer, Inc. Type Delayed Draw Term Loa", "Fertility Investment Holdco, LLC", None),
    ("Investments Debt Investments United States Arrow Management Acquisition, LLC Investment Type Unitranche First Lien Delayed Draw Term Loan", "Arrow Management Acquisition, LLC", None),
    ("Controlled/Non-Affiliated Investments, Senior Secured First Lien Loans, Industry, Company Velocity Buyer, Inc., Type of Investment Revolver", "Velocity Buyer, Inc.", None),
    ("Debt Investments - non-controlled/affiliated Professional Services KWOR Acquisition, Inc. First Lien Debt Reference Rate and Spread S + 6.25%", "KWOR Acquisition, Inc.", None),
    ("Aerospace & Defense Accel International Accel International Holdings, LLC Investment Type First Lien Secured Debt - Term Loan Interest Rate S+450, 0.5", "Accel International Holdings, LLC", None),
    ("Aerospace & Defense Beaufort Eagle U.S. Purchaser, Inc. First Lien Secured Debt - Revolver S+500, 0.75% Floor Maturity Date 12/31/32", "Beaufort Eagle U.S. Purchaser, Inc.", "2032-12-31"),
    ("Affiliated Investments - MB Precision Investment Holdings LLC - Aerospace & Defense - Senior Secured 6th Amendment Term loan", "MB Precision Investment Holdings, LLC", None),
    ("All States Ag Parts, LLC | Trading Companies & Distributors | S+650 | 1.00% | 10.49% | 9/2026", "All States Ag Parts, LLC", "2026-09-28"),
    ("Debt Investment, Automobile Components, Fenix Intermediate LLC, Acquisition Date 03/28/24 Investment Term Loan B - 10.74% (SOFR + 7.00%, 1.75% Floor)", "Fenix Intermediate, LLC", None),
    ("Bank Debt/Senior Secured Loans  233.6% | Blazing Star Parent, LLC | Consumer Staples Distribution & Retail | S+700 | 1.00% | 10.67% | 8/2025 | 8/2030", "Blazing Star Parent, LLC", "2030-08-28"),
    ("First Lien Senior Secured Canadian Debt Information Tulip.io Inc. Facility Type Term Loan All in Rate 16.50% Benchmark P Spread 4.00% PIK 4.50% Floor", "Tulip.io, Inc.", None),
    ("AB Centers Acquisition Corporation First Lien Secured Revolving Loan", "AB Centers Acquisition, Corporation", None),
    ("Investments At Fair Value | First Lien Loans | Advertising | Tranzact", "Tranzact", None),
    ("Accurate Neuromonitoring Unitranche DDTL Maturity 3/13/2031", "Accurate Neuromonitoring", "2031-03-13"),
    ("NCNA Debt Inv. | FLSS | Advertising | Amplify Buyer, Inc. Term Loan | RR & S/F | 3M SOFR + 4.75% / 0.75% | Cash IR / PIK Rate | 8.42% | MD | 9/17/2032", "Amplify Buyer, Inc.", "2032-09-17"),
    ("Controlled Affiliates, AutoAlert, LLC, Senior Secured 1st Lien Term Loan, SOFR + 5.4%, 1% SOFR Floor, PIK toggle, due 3/31/28", "AutoAlert, LLC", "2028-03-31"),
    ("Cannabis | Devi Holdings Inc.", "Devi Holdings, Inc.", None),
    ("Debt Investments- United States Diversified Consumer Services SSI Parent, LLC (fka School Specialty, Inc. Date 09/15/20 Term Loan  11.76% (SOFR + 8.00", "SSI Parent, LLC", None),
    ("Investments United States Debt Investments Retailing MeriCal, LLC Investment Type Unitranche", "MeriCal, LLC", None),
    ("Investments United States Debt Investments Software and Services Marlabs Investment Type S", "Marlabs", None),
    ("PCI Pharma Services 1", "PCI Pharma Services", None),
    ("Investments United States Debt Investments Technology, Hardware & Equipment Gener8, LLC Investment Type Senior", "Gener8, LLC", None),
]

bad = 0
for text, name, mat in CASES:
    got = b.candidate(text)
    m = b.maturity_of({"maturity": "", "text": text, "period": "2026-06-30"})
    ok = got == name and (m.isoformat() if m else None) == mat
    bad += not ok
    print(("ok  " if ok else "BAD ") + f"{got!r} (want {name!r})  mat {m} (want {mat})")
assert b.key_of("Curium BidCo S.a.r.l.") == b.key_of("Curium Bidco, S.a.r.l."), b.key_of("Curium BidCo S.a.r.l.")
assert b.key_of("TITAN BW BORROWER, L.P.") == b.key_of("Titan BW Borrower L.P.")
assert b.name_options("Zeta Technologies, Inc.") == ["Zeta Technologies, Inc."]  # never shortened to a bare business word
print(f"{len(CASES) - bad}/{len(CASES)} ok")
sys.exit(1 if bad else 0)
