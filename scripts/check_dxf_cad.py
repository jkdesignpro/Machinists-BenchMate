#!/usr/bin/env python3
"""Open BenchMate DXF output in other programs and compare what they measure.

Usage:
  mkdir -p /tmp/dxf && BENCHMATE_DXF_OUT=/tmp/dxf cargo test -p benchmate-core write_samples
  python3 -m venv .venv && .venv/bin/pip install pymupdf
  .venv/bin/python scripts/check_dxf_cad.py /tmp/dxf

The sample writer leaves `expected-*.tsv` files beside the DXF files: for
each file the width and height of everything in it and of the part alone
(outline and holes), whether it has polyline arcs (bulges) and whether it
has old-style POLYLINE entities. Each program is asked to open the file and
the size of what it drew is compared with those numbers:

  LibreCAD   `librecad dxf2pdf -c -s 1` prints the drawing at scale 1; the
             size of the vector paths in the PDF is read with PyMuPDF and
             compared with the size of everything.
  OpenSCAD   `import("file.dxf")` exported as SVG; the size of the path
             points is compared with the size of the part (OpenSCAD keeps
             closed outlines only). OpenSCAD does not read polyline arcs or
             old-style POLYLINE entities, so those files are expected to
             differ and are reported as "limit", not as a failure.
  Inkscape   its DXF importer (extensions/dxf_input.py, scale 1) writes an
             SVG; the size of its shapes is read with Inkscape's own
             library and compared with the size of everything.

A program that is not installed is skipped and said so. Exits non-zero when
a program that is installed fails to open a file or measures another size.
"""
import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile

TOL_MM = 0.06  # LibreCAD's PDF has 1200 dots per inch: one dot is 0.021 mm.
INK_EXT = "/usr/share/inkscape/extensions"
INK_BBOX = r"""
import sys, inkex
svg = inkex.load_svg(sys.argv[1]).getroot()
box = None
for el in svg.iter():
    if not isinstance(el, inkex.ShapeElement) or isinstance(el, (inkex.Group, inkex.Use)): continue
    if any(isinstance(a, (inkex.Defs, inkex.Marker, inkex.Pattern)) for a in el.iterancestors()): continue
    bb = el.bounding_box(el.getparent().composed_transform())
    if bb is None: continue
    box = bb if box is None else box + bb
print(box.width, box.height)
"""


def expected(folder):
    rows = {}
    for t in sorted(glob.glob(os.path.join(folder, "expected-*.tsv"))):
        for line in open(t):
            f = line.rstrip("\n").split("\t")
            if len(f) >= 7:
                rows[f[0]] = dict(all=(float(f[1]), float(f[2])), part=(float(f[3]), float(f[4])), bulges=f[5] == "1", oldpoly=f[6] == "1")
    return rows


def librecad(path, tmp):
    import pymupdf
    work = os.path.join(tmp, os.path.basename(path))
    shutil.copy(path, work)  # LibreCAD writes the PDF beside the file it opens
    env = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    subprocess.run(["librecad", "dxf2pdf", "-c", "-s", "1", "-p", "500x500", "-m", work], env=env, capture_output=True, text=True, timeout=300)
    pdf = work[:-4] + ".pdf"
    if not os.path.exists(pdf):
        return None
    xs, ys = [], []
    for d in pymupdf.open(pdf)[0].get_drawings():
        for it in d["items"]:
            pts = {"l": lambda i: [i[1], i[2]], "c": lambda i: [i[1], i[2], i[3], i[4]], "re": lambda i: [i[1].tl, i[1].br],
                   "qu": lambda i: [i[1].ul, i[1].ur, i[1].ll, i[1].lr]}.get(it[0], lambda i: [])(it)
            xs += [p.x for p in pts]
            ys += [p.y for p in pts]
    if not xs:
        return None
    return ((max(xs) - min(xs)) * 25.4 / 72, (max(ys) - min(ys)) * 25.4 / 72)


def openscad(path, tmp):
    scad, svg = os.path.join(tmp, "t.scad"), os.path.join(tmp, "t.svg")
    if os.path.exists(svg):
        os.remove(svg)
    # Fine facets so a circle's box is its diameter to well under a micron.
    open(scad, "w").write('$fa = 1; $fs = 0.01;\nimport("%s");\n' % path)
    r = subprocess.run(["openscad", "-o", svg, scad], capture_output=True, text=True, timeout=300)
    warn = sorted(set(re.findall(r"WARNING: (Unsupported DXF Entity '\w+')", r.stderr)))
    if r.returncode != 0 or not os.path.exists(svg):
        return None, warn
    xs, ys = [], []
    for d in re.findall(r'<path d="([^"]*)"', open(svg).read()):
        n = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?(?:e-?\d+)?", d)]
        xs += n[0::2]
        ys += n[1::2]
    if not xs:
        return None, warn
    return (max(xs) - min(xs), max(ys) - min(ys)), warn


def inkscape(path, tmp):
    svg = os.path.join(tmp, "ink.svg")
    env = dict(os.environ, PYTHONPATH=INK_EXT)
    with open(svg, "w") as out:
        r = subprocess.run(["python3", os.path.join(INK_EXT, "dxf_input.py"), "--scalemethod=manual", "--scale=1.0", path], env=env, stdout=out, stderr=subprocess.PIPE, text=True, timeout=300)
    if r.returncode != 0:
        return None
    b = subprocess.run(["python3", "-c", INK_BBOX, svg], env=env, capture_output=True, text=True, timeout=300)
    try:
        w, h = [float(x) for x in b.stdout.split()]
    except ValueError:
        return None
    return (w * 25.4 / 96, h * 25.4 / 96)  # the importer writes 96 px to the inch


def main(folder):
    exp = expected(folder)
    if not exp:
        print("No expected-*.tsv in", folder, "(run the write_samples tests with BENCHMATE_DXF_OUT set)")
        return 1
    have = {"LibreCAD": shutil.which("librecad") is not None, "OpenSCAD": shutil.which("openscad") is not None,
            "Inkscape": os.path.exists(os.path.join(INK_EXT, "dxf_input.py"))}
    if have["LibreCAD"]:
        try:
            import pymupdf  # noqa: F401
        except ImportError:
            print("PyMuPDF is not installed: LibreCAD's PDF cannot be measured")
            have["LibreCAD"] = False
    for k, v in have.items():
        if not v:
            print(k, "is not installed: skipped")
    fmt = lambda s: "%.3f x %.3f" % s if s else "did not open"
    near = lambda a, b: a is not None and abs(a[0] - b[0]) <= TOL_MM and abs(a[1] - b[1]) <= TOL_MM
    count = {k: [0, 0, 0] for k in have}  # same size, expected limit, problem
    bad = []
    with tempfile.TemporaryDirectory() as tmp:
        for name in sorted(exp):
            e, path = exp[name], os.path.abspath(os.path.join(folder, name))
            line = "%-28s all %-19s part %-19s" % (name, fmt(e["all"]), fmt(e["part"]))
            if have["LibreCAD"]:
                s = librecad(path, tmp)
                ok = near(s, e["all"])
                count["LibreCAD"][0 if ok else 2] += 1
                line += " | LibreCAD %-19s %s" % (fmt(s), "ok" if ok else "DIFFERENT")
                if not ok:
                    bad.append(name + " (LibreCAD)")
            if have["OpenSCAD"]:
                s, warn = openscad(path, tmp)
                ok = near(s, e["part"])
                limit = e["bulges"] or e["oldpoly"]
                count["OpenSCAD"][0 if ok else 1 if limit else 2] += 1
                line += " | OpenSCAD %-19s %s" % (fmt(s), "ok" if ok else "limit: " + ("no old-style polylines" if e["oldpoly"] else "polyline arcs drawn straight") if limit else "DIFFERENT")
                if not ok and not limit:
                    bad.append(name + " (OpenSCAD)")
            if have["Inkscape"]:
                s = inkscape(path, tmp)
                ok = near(s, e["all"])
                count["Inkscape"][0 if ok else 2] += 1
                line += " | Inkscape %-19s %s" % (fmt(s), "ok" if ok else "DIFFERENT")
                if not ok:
                    bad.append(name + " (Inkscape)")
            print(line)
    print()
    for k, c in count.items():
        if have[k]:
            print("%-9s same size in %d files, known limit in %d, problems in %d" % (k, c[0], c[1], c[2]))
    if bad:
        print("PROBLEMS:", ", ".join(bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
