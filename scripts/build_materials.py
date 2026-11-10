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
Run: python3 scripts/build_materials.py
"""
import json, re, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
EVID = ROOT / "data" / "evidence"
# Sources known to copy another publisher's text word for word (not independent).
COPIES = {"aluminium:SMITHS_6082": "Aalco", "copper:RIGHTON_CW614N": "Aalco"}
# Same grade under a different label in different evidence files.
ALIAS = {"17-4PH (630)": "17-4PH"}
FAMILY_FIELDS = {
    "Steel": [("aisi", "AISI / SAE"), ("uns", "UNS"), ("en_number", "EN / W.-Nr."), ("en_name", "EN name"),
              ("bs970", "BS 970 / 4659"), ("uk_en", "UK old EN"), ("jis", "JIS"), ("gb", "GB (China)")],
    "Aluminium": [("aa", "AA / ASTM"), ("en_aw", "EN AW"), ("en_name", "EN name"), ("din_wnr", "DIN / W.-Nr."),
                  ("bs_old", "Old BS"), ("uns", "UNS"), ("jis", "JIS")],
    "Copper alloy": [("en_number", "EN CW / CC"), ("en_name", "EN name"), ("uns", "UNS / CDA"), ("bs_old", "Old BS"),
                     ("din_wnr", "DIN / W.-Nr."), ("iso", "ISO")],
    "Titanium": [("common", "Common name"), ("astm", "ASTM / AISI"), ("w_nr", "W.-Nr."), ("din_en_name", "DIN / EN name"), ("bs", "BS")],
    "Nickel alloy": [("common", "Common name"), ("astm", "ASTM / AISI"), ("w_nr", "W.-Nr."), ("din_en_name", "DIN / EN name"), ("bs", "BS")],
    "Cast iron": [("common", "Common name"), ("astm", "ASTM / AISI"), ("w_nr", "W.-Nr."), ("din_en_name", "DIN / EN name"), ("bs", "BS")],
}
# Field(s) whose agreement decides the status; the first one with data is used.
# Aluminium: AA and EN AW numbers are the same registered number, so agreement
# is judged on the cross-system numbers that actually cause confusion.
KEY_FIELD = {"Steel": ["en_number"], "Aluminium": ["din_wnr", "bs_old", "en_aw"], "Copper alloy": ["en_number"],
             "Titanium": ["w_nr"], "Nickel alloy": ["w_nr"], "Cast iron": ["w_nr"]}

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
    pubs = sorted({sources[p["source"]]["publisher_norm"] for p in r["printed"]})
    out.append({"grade": name, "family": fam, "subfamily": r["subfamily"], "iso_group": r["iso_group"], "status": status,
                "publishers": pubs, "fields": fields, "unsourced": r["unsourced"], "notes": r["notes"], "printed": r["printed"]})

doc = {"schema": 2, "families": {k: v for k, v in FAMILY_FIELDS.items()}, "key_field": KEY_FIELD,
       "sources": {k: {kk: vv for kk, vv in s.items()} for k, s in sources.items()}, "materials": out}
(ROOT / "data" / "materials.json").write_text(json.dumps(doc, ensure_ascii=False, indent=0) + "\n")
c = collections.Counter((m["family"], m["status"]) for m in out)
print(len(out), "grades from", len(sources), "sources")
for (f, s), n in sorted(c.items()): print(f"  {f:13} {s:9} {n}")

# Reference list of every material source, for docs.
lines = ["# Material data sources", "", "Generated by scripts/build_materials.py from data/evidence/. Every document used, grouped by publisher.", ""]
bypub = collections.defaultdict(list)
for k, s_ in sources.items(): bypub[s_["publisher_norm"]].append((k, s_))
for p_ in sorted(bypub):
    lines.append("## " + p_)
    for k, s_ in sorted(bypub[p_]):
        lines.append(f"- `{k}`: {s_.get('title','')}. {s_.get('url','')} (accessed {s_.get('accessed','')})")
    lines.append("")
(ROOT / "docs" / "material-sources.md").write_text("\n".join(lines))
