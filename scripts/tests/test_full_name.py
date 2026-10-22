"""Offline: python3 -I scripts/tests/test_full_name.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from adviser_aum import full_name
for raw, want in [("Portal Ventures Fund II, LP", "Portal Ventures"), ("TriCoastal Capital Fund II LP", "TriCoastal Capital"),
                  ("Roers Income Fund II, LLC", "Roers Income"), ("Mana Up Capital Partners II, L.P.", "Mana Up Capital Partners"),
                  ("ego death capital fund II (AI), LP", "ego death capital"), ("8090 Industries Decarbonization Fund II, LP", "8090 Industries Decarbonization"),
                  ("Modi Ventures TBF II, LP", "Modi Ventures TBF"), ("Collab Fund II, L.P.", "Collab")]:
    got = full_name(raw)
    assert got == want, (raw, got)
print("full_name ok")
