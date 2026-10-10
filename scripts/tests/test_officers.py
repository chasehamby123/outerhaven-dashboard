"""Offline tests for scripts/officers.py parsers: python3 -I scripts/tests/test_officers.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from officers import cert_name, cert_title, exhibits, role_of, text_of  # noqa: E402

cert = text_of("""<p>CERTIFICATION PURSUANT TO RULE 13a-14(a)</p><p>I, John A. Markovich, certify that:</p><p>1. I have reviewed this
quarterly report on Form 10-Q of OmniGuide Holdings, Inc.;</p><p>Date: August 14, 2026</p><p>/s/ John A. Markovich</p>
<p>John A. Markovich</p><p>Chief Financial Officer</p><p>(Principal Financial Officer)</p>""")
assert cert_name(cert) == "John A. Markovich", cert_name(cert)
assert cert_title(cert, "EX-31.2") == "Principal Financial Officer", cert_title(cert, "EX-31.2")
assert role_of(cert_title(cert, "EX-31.2"), "EX-31.2") == "cfo"
assert cert_name("I, Mary O'Neil-Smith, Chief Executive Officer of Acme Corp, certify that: ...") == "Mary O'Neil-Smith"
assert cert_name("I, Robert Allen, Jr., certify that") is None or cert_name("I, Robert Allen, Jr., certify that") in ("Robert Allen", "Jr.")
assert cert_name("I, the undersigned officer, hereby certify") is None
assert cert_name("I, Ludwig van Beethoven, hereby certify that") == "Ludwig van Beethoven"
ceo = text_of("<p>I, Ajay Patel, certify that:</p><p>/s/ Ajay Patel</p><p>President and Chief Executive Officer</p>")
assert role_of(cert_title(ceo, "EX-31.1"), "EX-31.1") == "ceo"

idx = """<table class="tableFile"><tr><th>Seq</th><th>Description</th><th>Document</th><th>Type</th><th>Size</th></tr>
<tr><td>1</td><td>10-Q</td><td><a href="/Archives/edgar/data/1/000/q.htm">q.htm</a></td><td>10-Q</td><td>1</td></tr>
<tr><td>2</td><td>CERT</td><td><a href="/Archives/edgar/data/1/000/ex311.htm">ex311.htm</a></td><td>EX-31.1</td><td>1</td></tr>
<tr><td>3</td><td>CERT</td><td><a href="/Archives/edgar/data/1/000/ex312.htm">ex312.htm</a></td><td>EX-31.2</td><td>1</td></tr></table>"""
assert exhibits(idx) == {"EX-31.1": "https://www.sec.gov/Archives/edgar/data/1/000/ex311.htm", "EX-31.2": "https://www.sec.gov/Archives/edgar/data/1/000/ex312.htm"}, exhibits(idx)
print("officers: all tests passed")
