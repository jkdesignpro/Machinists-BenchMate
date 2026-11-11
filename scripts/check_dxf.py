#!/usr/bin/env python3
"""Check BenchMate DXF output with an independent reader (ezdxf).

Usage:
  python3 -m venv .venv && .venv/bin/pip install ezdxf
  mkdir -p /tmp/dxf && BENCHMATE_DXF_OUT=/tmp/dxf cargo test -p benchmate-core write_samples
  .venv/bin/python scripts/check_dxf.py /tmp/dxf/*.dxf

For each file: strict read with ezdxf.readfile (not the recover loader),
then doc.audit(); prints the DXF version, $INSUNITS, entity counts per layer
and every audit error or fix. Exits non-zero if any file fails to load or
has audit errors.
"""
import math
import os
import sys
from collections import Counter

import ezdxf
from ezdxf.math import bulge_to_arc


def outline_area(e):
    """Area of a closed polyline: shoelace plus, for every bulge, the circular
    segment of the arc that ezdxf's bulge_to_arc() reads from it."""
    if e.dxftype() == "LWPOLYLINE":
        v = [(x, y, b) for x, y, b in e.get_points("xyb")]
    else:
        v = [(p.dxf.location.x, p.dxf.location.y, p.dxf.bulge) for p in e.vertices]
    a = 0.0
    for i, (x, y, b) in enumerate(v):
        x2, y2, _ = v[(i + 1) % len(v)]
        a += (x * y2 - x2 * y) / 2
        if b:
            _, a0, a1, r = bulge_to_arc((x, y), (x2, y2), b)
            sweep = (a1 - a0) % (2 * math.pi)
            a += math.copysign(r * r / 2 * (sweep - math.sin(sweep)), b)
    return a


# Expected outline areas of the samples written by the `write_samples` test,
# from closed-form geometry (same values as the Rust tests), so the areas
# ezdxf computes from its own reading of the bulges can be compared.
R, B = 10.0, 4.0
YC = math.sqrt(R * R - B * B)
SEG = lambda r, d: r * r * math.acos(d / r) - d * math.sqrt(r * r - d * d)
EXPECTED_AREA = {
    "grid": 80 * 50 - (4 - math.pi) * 25,
    "slot": 40 * 10 + math.pi * 25,
    "arcslot": math.radians(250) * 50 * 10 + math.pi * 25,
    "rect": 100 * 60 - (4 - math.pi) * 64,
    "hex": 3 * math.sqrt(3) / 2 * (15 / math.cos(math.pi / 6)) ** 2,
    "keyhole": math.pi * R * R + 2 * B * (25 - YC) - SEG(R, YC) + math.pi * B * B / 2,
    "dflat": math.pi * R * R - SEG(R, 7.0),
    "doubled": math.pi * R * R - 2 * SEG(R, 8.0),
}


def check(path):
    doc = ezdxf.readfile(path)
    auditor = doc.audit()
    msp = doc.modelspace()
    layers = Counter((e.dxftype(), e.dxf.layer) for e in msp)
    units = doc.header.get("$INSUNITS", "-")
    print(f"{path}: {doc.dxfversion} INSUNITS={units} entities={sum(layers.values())} "
          f"errors={len(auditor.errors)} fixes={len(auditor.fixes)}")
    for e in auditor.errors:
        print("  error:", e.message)
    for f in auditor.fixes:
        print("  fix:", f.message)
    name = os.path.basename(path).split("-")[0]
    outl = [e for e in msp if e.dxf.layer == "OUTLINE" and e.dxftype() in ("LWPOLYLINE", "POLYLINE")]
    if name in EXPECTED_AREA and "-in" not in path:
        a = outline_area(outl[0])
        exp = EXPECTED_AREA[name]
        good = abs(a - exp) / exp < 1e-9
        print(f"  outline area (ezdxf bulge_to_arc) {a:.6f} expected {exp:.6f} {'ok' if good else 'MISMATCH'}")
        if not good:
            return False
    # Geometry sanity: closed polylines have at least two vertices, circles positive radius.
    for e in msp:
        if e.dxftype() == "LWPOLYLINE":
            assert e.closed and len(e) >= 2, path
        if e.dxftype() == "POLYLINE":
            assert e.is_closed and len(e.vertices) >= 2, path
        if e.dxftype() in ("CIRCLE", "ARC"):
            assert e.dxf.radius > 0, path
    return len(auditor.errors) == 0


def main(paths):
    ok = True
    for p in paths:
        try:
            ok = check(p) and ok
        except Exception as ex:  # report and carry on
            print(f"{p}: FAILED to load: {ex}")
            ok = False
    print("ezdxf", ezdxf.__version__, "all files OK" if ok else "PROBLEMS FOUND")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
