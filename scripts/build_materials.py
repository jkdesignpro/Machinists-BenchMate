#!/usr/bin/env python3
"""Build data/materials.json from the evidence files in data/evidence/.

Evidence = what each source actually prints for a grade (one record per source,
with the verbatim table row where available). Nothing is typed in from memory.
This script works out, per designation field, which values the sources print and
how many independent publishers print each one, and gives each grade a status:
  confirmed  - the key designation's top value is printed by 2+ independent
               publishers and no other value for it has 2+ publishers
  differs    - two or more values each have 2+ publishers (sources disagree)
  review     - fewer than 2 independent publishers so far
Material properties (density, E, Rm, Rp0.2, elongation, hardness, thermal
expansion, thermal conductivity, machinability) are printed per source row under
"properties"; see PROPS below and docs/material-equivalents.md for the rules.
Run: python3 scripts/build_materials.py
"""
import json, re, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
EVID = ROOT / "data" / "evidence"
# Sources known to copy another publisher's text word for word (not independent).
COPIES = {"aluminium:SMITHS_6082": "Aalco", "copper:RIGHTON_CW614N": "Aalco",
          "props-round2:SMITHS_C101_PROPS": "Aalco"}  # Smiths C101 physical values = Aalco CW004A figure for figure
# Same grade under a different label in different evidence files.
ALIAS = {"17-4PH (630)": "17-4PH"}
FAMILY_FIELDS = {
    "Steel": [("aisi", "AISI / SAE"), ("uns", "UNS"), ("en_number", "EN / W.-Nr."), ("en_name", "EN name"),
              ("bs970", "BS 970 / 4659"), ("uk_en", "UK old EN"), ("jis", "JIS"), ("gb", "GB (China)")],
    "Aluminium": [("aa", "AA / ASTM"), ("en_aw", "EN AW"), ("en_name", "EN name"), ("din_wnr", "DIN / W.-Nr."),
                  ("bs_old", "Old BS"), ("uns", "UNS"), ("jis", "JIS")],
    "Copper alloy": [("en_number", "EN CW / CC"), ("en_name", "EN name"), ("uns", "UNS / CDA"), ("bs_old", "Old BS"),
                     ("din_wnr", "DIN / W.-Nr."), ("iso", "ISO"), ("jis", "JIS")],
    "Titanium": [("common", "Common name"), ("astm", "ASTM / AISI"), ("uns", "UNS"), ("w_nr", "W.-Nr."), ("din_en_name", "DIN / EN name"), ("bs", "BS")],
    "Nickel alloy": [("common", "Common name"), ("astm", "ASTM / AISI"), ("uns", "UNS"), ("w_nr", "W.-Nr."), ("din_en_name", "DIN / EN name"), ("bs", "BS")],
    "Cast iron": [("common", "Common name"), ("en_name", "EN 1561 / 1563 name"), ("en_number", "EN number"),
                  ("din_en_name", "Old DIN name"), ("w_nr", "Old DIN W.-Nr."), ("astm", "ASTM"), ("bs", "Old BS"), ("jis", "JIS")],
    "Plastic": [("abbrev", "Abbreviation"), ("generic", "Generic name"), ("trade", "Trade names")],
}
# Field(s) whose agreement decides the status; the first one with data is used.
# Aluminium: AA and EN AW numbers are the same registered number, so agreement
# is judged on the cross-system numbers that actually cause confusion.
KEY_FIELD = {"Steel": ["en_number"], "Aluminium": ["din_wnr", "bs_old", "en_aw"], "Copper alloy": ["en_number"],
             "Titanium": ["w_nr"], "Nickel alloy": ["w_nr"], "Cast iron": ["w_nr"], "Plastic": ["abbrev"]}

def publisher(key, src):
    if key in COPIES: return COPIES[key]
    p = src.get("publisher") or key
    return re.split(r" \(| - ", p)[0].strip()

def split_values(v):
    if v is None: return []
    parts = re.split(r"\s*/\s*|; |, (?=\S)", str(v))
    return [p.strip() for p in parts if p.strip() and p.strip() not in ("-", "–")]

def norm(v, field=""):
    v = re.sub(r"^UNS\s*", "", v.strip(), flags=re.I)
    v = re.sub(r"\s*\([^)]*\)", "", v) or v  # 'CZ121 (BS2874)' == 'CZ121'
    if field == "en_aw": v = re.sub(r"^(EN\s*)?AW\s*-?\s*", "", v, flags=re.I)  # 'EN AW-6082' == 'AW-6082' == '6082'
    return re.sub(r"[\s\-]", "", v).upper()

# ---------------------------------------------------------------- properties
# Canonical SI unit per property, and the printed units accepted (factor to the
# canonical unit). The evidence keeps value and unit exactly as printed; the
# build converts. "mech": mechanical property, which must carry a real condition.
PROPS = {
    "density":   {"label": "Density", "unit": "kg/m³", "mech": False,
                  "units": {"kg/m3": 1, "g/cm3": 1000, "kg/dm3": 1000, "mg/m3": 1000, "t/m3": 1000, "lb/in3": 27679.9047, "sg": 1000, "g/cc": 1000}},
    "e_modulus": {"label": "Young's modulus", "unit": "GPa", "mech": False,
                  "units": {"gpa": 1, "mpa": 0.001, "n/mm2": 0.001, "kn/mm2": 1, "msi": 6.894757, "ksi": 0.006894757, "psi": 6.894757e-6}},
    "rm":        {"label": "Tensile strength Rm", "unit": "MPa", "mech": True,
                  "units": {"mpa": 1, "n/mm2": 1, "ksi": 6.894757, "psi": 0.006894757}},
    "rp02":      {"label": "Yield / proof Rp0.2", "unit": "MPa", "mech": True,
                  "units": {"mpa": 1, "n/mm2": 1, "ksi": 6.894757, "psi": 0.006894757}},
    "elongation": {"label": "Elongation", "unit": "%", "mech": True, "units": {"%": 1}},
    "hardness":  {"label": "Hardness", "unit": "(scale)", "mech": True, "units": None},
    "cte":       {"label": "Thermal expansion", "unit": "µm/m·K", "mech": False,
                  "units": {"um/mk": 1, "1e-6/k": 1, "um/mc": 1, "1e-6/c": 1, "uin/inf": 1.8, "1e-6/f": 1.8, "1e-5/k": 10, "1e-5/c": 10}},
    "k":         {"label": "Thermal conductivity", "unit": "W/m·K", "mech": False,
                  "units": {"w/mk": 1, "w/mc": 1, "btu/hftf": 1.730735, "btuin/hft2f": 0.1442279, "w/km": 1}},
    "machinability": {"label": "Machinability rating", "unit": "%", "mech": False, "units": {"%": 1}},
}
# Two printed values count as "the same value" when, after conversion to the
# canonical unit: density within 1 %; any other property exactly equal when both
# sources print it in the canonical unit, or within 0.5 % when either had to be
# converted (rounding of ksi/psi/imperial figures). Ranges agree only if both
# ends agree; a range never agrees with a single value. Hardness compares only
# within the same scale (HB = HBW = HBS) and is never converted between scales.
# Machinability compares only on the same basis. Different conditions, and min
# vs typical, are never compared.
TOL = {"density": 0.01}
HARD_SCALES = {"HB": "HB", "HBW": "HB", "HBS": "HB", "BHN": "HB", "HV": "HV", "HRC": "HRC", "HRB": "HRB",
               "SHORE D": "Shore D", "SHORE A": "Shore A", "HRM": "HRM", "HRR": "HRR", "ROCKWELL M": "HRM", "ROCKWELL R": "HRR",
               "BALL INDENTATION": "Ball indentation (MPa)"}
BASES = ("min", "max", "typical", "range", "unstated")

def unit_key(u):
    """'W/m°C', 'W/(m·K)', 'x10^-6 /K', 'µm/m-K' -> 'w/mc', 'w/mk', '1e-6/k', 'um/mk'."""
    u = u.lower().replace("µ", "u").replace("μ", "u").replace("³", "3").replace("²", "2").replace("−", "-").replace("⁻", "-").replace("⁶", "6").replace("⁵", "5")
    u = re.sub(r"x?\s*10\s*\^?\s*-\s*([56])", r"1e-\1", u)
    return re.sub(r"[\s°·.*()\-]|(?<=1e)-", "", u).replace("1e6", "1e-6").replace("1e5", "1e-5").replace("/m/", "/m")

def canon(prop, e, where):
    if prop == "hardness":
        sc = HARD_SCALES.get(e["unit"].upper().strip())
        if not sc: raise SystemExit(f"{where}: unknown hardness scale {e['unit']!r}")
        return 1.0, sc
    f = PROPS[prop]["units"].get(unit_key(e["unit"]))
    if f is None: raise SystemExit(f"{where}: unit {e['unit']!r} not accepted for {prop}")
    return f, PROPS[prop]["unit"]

def same(prop, a, b):
    if (a["max"] is None) != (b["max"] is None): return False
    pairs = [(a["value"], b["value"])] + ([(a["max"], b["max"])] if a["max"] is not None else [])
    exact = not a["converted"] and not b["converted"] and prop not in TOL
    tol = TOL.get(prop, 0.005)
    for x, y in pairs:
        if exact:
            if x != y: return False
        elif abs(x - y) > tol * max(abs(x), abs(y)): return False
    return True

def build_props(name, printed):
    groups = collections.OrderedDict()
    for p in printed:
        for i, e in enumerate(p.get("properties") or []):
            where = f"{name} / {p['source']} / properties[{i}]"
            prop = e.get("prop")
            if prop not in PROPS: raise SystemExit(f"{where}: unknown prop {prop!r}")
            if e.get("basis") not in BASES: raise SystemExit(f"{where}: basis must be one of {BASES}")
            if not e.get("cond") or not e.get("condition"): raise SystemExit(f"{where}: cond and condition are required")
            if PROPS[prop]["mech"] and e["cond"].lower() in ("any", "all"): raise SystemExit(f"{where}: mechanical property without a condition")
            if not e.get("verbatim"): raise SystemExit(f"{where}: verbatim text is required")
            if prop == "machinability" and not e.get("ref"): raise SystemExit(f"{where}: machinability needs its basis in 'ref'")
            f, unit = canon(prop, e, where)
            v = {"value": round(e["value"] * f, 6), "max": None if e.get("max") is None else round(e["max"] * f, 6), "converted": f != 1}
            gk = (prop, e["cond"], e["basis"], unit if prop == "hardness" else "", (e.get("ref") or "").strip().lower())
            g = groups.setdefault(gk, {"prop": prop, "cond": e["cond"], "basis": e["basis"], "unit": unit, "ref": e.get("ref"),
                                       "conditions": [], "clusters": []})
            if e["condition"] not in g["conditions"]: g["conditions"].append(e["condition"])
            rec = {"source": p["source"], "publisher": sources[p["source"]]["publisher_norm"],
                   "printed": f"{e['value']}{'' if e.get('max') is None else '-' + str(e['max'])} {e['unit']}",
                   "condition": e["condition"], "verbatim": e["verbatim"], "note": e.get("note")}
            for c in g["clusters"]:
                if same(prop, c["v"], v): c["recs"].append(rec); c["vals"].append((v["value"], v["max"])); break
            else: g["clusters"].append({"v": v, "recs": [rec], "vals": [(v["value"], v["max"])]})
    res = []
    for g in groups.values():
        vals = []
        for c in g["clusters"]:
            # Shown value: the one printed most often in the cluster (first printed on a tie); every
            # distinct value inside the agreement tolerance is kept in "printed_values".
            mode = collections.Counter(c["vals"]).most_common(1)[0][0]
            vals.append({"value": mode[0], "max": mode[1], "printed_values": [list(x) for x in dict.fromkeys(c["vals"])],
                         "publishers": sorted({r["publisher"] for r in c["recs"]}), "evidence": c["recs"]})
        vals.sort(key=lambda x: -len(x["publishers"]))
        strong = [v for v in vals if len(v["publishers"]) >= 2]
        allpubs = {pp for v in vals for pp in v["publishers"]}
        # Same rule as designations, plus: 2+ publishers who all print different values = differs.
        status = ("differs" if len(strong) >= 2 or (not strong and len(vals) >= 2 and len(allpubs) >= 2)
                  else "confirmed" if len(strong) == 1 else "review")
        res.append({"prop": g["prop"], "cond": g["cond"], "conditions": g["conditions"], "basis": g["basis"], "unit": g["unit"],
                    "ref": g["ref"], "status": status, "publisher_count": len(allpubs), "values": vals})
    order = list(PROPS)
    res.sort(key=lambda x: (order.index(x["prop"]), x["cond"], x["basis"]))
    return res

sources, grades = {}, collections.OrderedDict()
for f in sorted(EVID.glob("*.json")):
    d = json.loads(f.read_text())
    stem = f.stem
    for k, s in d["sources"].items():
        sources[stem + ":" + k] = dict(s, publisher_norm=publisher(stem + ":" + k, s))
    for g in d["grades"]:
        name = ALIAS.get(g["grade"], g["grade"])
        fam = g["family"]
        rec = grades.setdefault((fam, name), {"grade": name, "family": fam, "subfamily": None, "iso_group": None,
                                              "printed": [], "unsourced": {}, "notes": []})
        rec["subfamily"] = rec["subfamily"] or g.get("subfamily")
        rec["iso_group"] = rec["iso_group"] or g.get("iso_group")
        for p in g["printed"]:
            rec["printed"].append(dict(p, source=stem + ":" + p["source"]))
        rec["unsourced"].update(g.get("unsourced") or {})
        if g.get("disagreements"): rec["notes"].append(g["disagreements"])

out = []
for (fam, name), r in grades.items():
    fields = {}
    for fk, _ in FAMILY_FIELDS.get(fam, []):
        groups = collections.OrderedDict()
        for p in r["printed"]:
            pub = sources[p["source"]]["publisher_norm"]
            for v in split_values(p["values"].get(fk)):
                gk = norm(v, fk)
                g = groups.setdefault(gk, {"forms": collections.Counter(), "publishers": set(), "sources": []})
                g["forms"][v] += 1; g["publishers"].add(pub)
                if p["source"] not in g["sources"]: g["sources"].append(p["source"])
        vals = [{"value": g["forms"].most_common(1)[0][0], "publishers": sorted(g["publishers"]), "sources": g["sources"]}
                for g in groups.values()]
        vals.sort(key=lambda x: -len(x["publishers"]))
        if vals: fields[fk] = vals
    key = next((fields[k] for k in KEY_FIELD.get(fam, []) if k in fields), [])
    strong = [v for v in key if len(v["publishers"]) >= 2]
    status = "differs" if len(strong) >= 2 else "confirmed" if len(strong) == 1 else "review"
    pubs = sorted({sources[p["source"]]["publisher_norm"] for p in r["printed"] if p.get("values")})
    props = build_props(name, r["printed"])
    out.append({"grade": name, "family": fam, "subfamily": r["subfamily"], "iso_group": r["iso_group"], "status": status,
                "publishers": pubs, "fields": fields, "unsourced": r["unsourced"], "notes": r["notes"], "printed": r["printed"],
                "properties": props})

doc = {"schema": 3, "property_defs": {k: {"label": v["label"], "unit": v["unit"], "mechanical": v["mech"]} for k, v in PROPS.items()}, "families": {k: v for k, v in FAMILY_FIELDS.items()}, "key_field": KEY_FIELD,
       "sources": {k: {kk: vv for kk, vv in s.items()} for k, s in sources.items()}, "materials": out}
(ROOT / "data" / "materials.json").write_text(json.dumps(doc, ensure_ascii=False, indent=0) + "\n")
c = collections.Counter((m["family"], m["status"]) for m in out)
print(len(out), "grades from", len(sources), "sources")
for (f, s), n in sorted(c.items()): print(f"  {f:13} {s:9} {n}")
withp = [m for m in out if m["properties"]]
print(len(withp), "grades with properties;", sum(len(m["properties"]) for m in out), "property groups")
pc = collections.Counter((pp["prop"], pp["status"]) for m in out for pp in m["properties"])
for k in PROPS:
    print(f"  {k:13}", ", ".join(f"{st} {pc[(k, st)]}" for st in ("confirmed", "differs", "review") if pc[(k, st)]) or "-")

# Reference list of every material source, for docs.
lines = ["# Material data sources", "", "Generated by scripts/build_materials.py from data/evidence/. Every document used, grouped by publisher.", ""]
bypub = collections.defaultdict(list)
for k, s_ in sources.items(): bypub[s_["publisher_norm"]].append((k, s_))
for p_ in sorted(bypub):
    lines.append("## " + p_)
    for k, s_ in sorted(bypub[p_]):
        rev = f" Revision/date printed: {s_['revision']}." if s_.get("revision") else ""
        lines.append(f"- `{k}`: {s_.get('title','')}.{rev} {s_.get('url','')} (accessed {s_.get('accessed','')})")
    lines.append("")
(ROOT / "docs" / "material-sources.md").write_text("\n".join(lines))

# Property coverage table, kept current in docs/material-equivalents.md between markers.
ABBR = {"density": "Density", "e_modulus": "E", "rm": "Rm", "rp02": "Rp0.2", "elongation": "A", "hardness": "Hardness",
        "cte": "CTE", "k": "λ", "machinability": "Mach."}
cov = ["<!-- props-coverage:start (generated by scripts/build_materials.py) -->",
       f"{len(withp)} of {len(out)} grades have at least one property. Columns: publishers printing properties for the grade, then for each "
       "property the number of condition groups that are confirmed / differ / single-source.", "",
       "| Family | Grade | Publishers | " + " | ".join(ABBR[k] for k in PROPS) + " |", "|" + "---|" * (3 + len(PROPS))]
for m in withp:
    pp = sorted({pub for p in m["properties"] for v in p["values"] for pub in v["publishers"]})
    cells = []
    for k in PROPS:
        c_ = collections.Counter(p["status"] for p in m["properties"] if p["prop"] == k)
        cells.append(f"{c_['confirmed']}/{c_['differs']}/{c_['review']}" if c_ else "")
    cov.append(f"| {m['family']} | {m['grade']} | {len(pp)} | " + " | ".join(cells) + " |")
cov += ["", "Totals (condition groups, confirmed/differ/single-source): " + "; ".join(
    f"{PROPS[k]['label']} " + "/".join(str(pc[(k, st)]) for st in ("confirmed", "differs", "review")) for k in PROPS) + ".",
    "", "Grades with no property data yet: " + ", ".join(m["grade"] for m in out if not m["properties"]) + ".",
    "<!-- props-coverage:end -->"]
mdp = ROOT / "docs" / "material-equivalents.md"
md = mdp.read_text()
if "<!-- props-coverage:start" in md:
    md = re.sub(r"<!-- props-coverage:start.*?<!-- props-coverage:end -->", lambda _: "\n".join(cov), md, flags=re.S)
    mdp.write_text(md)
