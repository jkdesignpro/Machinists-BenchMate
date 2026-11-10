# Source of truth for data/materials.json (generated). Edit here, then run:
#   python3 scripts/materials_seed.py
# Rules (see docs/material-equivalents.md):
# * Every shown value lists the sources that print it. A value with no source
#   goes in "unsourced" and the app shows it greyed as "not yet sourced".
# * A grade is "confirmed" only when two independent sources agree on the
#   main pairing (US grade <-> EN/W.-Nr. number). Otherwise "review".
# * Sources often disagree or carry typos; disagreements are kept in notes,
#   never silently "fixed".
import json, pathlib

SOURCES = {
 "TWI": "TWI Ltd, FAQ 'equivalent European and American standards for common stainless steels' (BS EN 10088-1). twi-global.com",
 "WYS": "West Yorkshire Steel, international standards cross-reference tables (stainless, carbon and alloy, tool steel). westyorkssteel.com",
 "MMC": "Mitsubishi Materials, cutting tools catalogue: material cross reference (pages N028-N031). mitsubishicarbide.net",
 "WIKI": "Wikipedia, 'SAE steel grades' (SAE to UNS table for stainless). en.wikipedia.org/wiki/SAE_steel_grades",
}
SYS = ["aisi", "uns", "en_number", "en_name", "bs970", "uk_en", "jis", "gb"]

def g(id, family, iso, pair, f, unsourced=None, notes=""):
    """pair: sources agreeing on the main US <-> EN number pairing.
       f: {system: (value, [sources])}"""
    fields = {k: {"value": v, "sources": s} for k, (v, s) in f.items()}
    return {"id": id, "family": family, "iso_group": iso, "fields": fields,
            "unsourced": unsourced or {}, "pair_sources": pair,
            "status": "confirmed" if len(set(pair)) >= 2 else "review", "notes": notes}

S, C, T = "Stainless steel", "Carbon and alloy steel", "Tool steel"
MAT = [
 g("301", S, "M", ["TWI"], {"aisi": ("301", ["TWI","WIKI"]), "uns": ("S30100", ["TWI","WIKI"]), "en_number": ("1.4310", ["TWI"]), "en_name": ("X10CrNi18-8", ["TWI"])},
   {"jis": "SUS301", "bs970": "301S21"}),
 g("303", S, "M", ["TWI","WYS","MMC"], {"aisi": ("303", ["TWI","WYS","MMC"]), "uns": ("S30300", ["TWI","WIKI"]), "en_number": ("1.4305", ["TWI","WYS","MMC"]),
   "bs970": ("303S31", ["WYS"]), "jis": ("SUS303", ["WYS","MMC"])}, {"en_name": "X8CrNiS18-9", "uk_en": "EN58M"},
   "Free-machining 18/8. Names printed by sources: X8CrNi18-9 (TWI), X10CrNiS18-9 (WYS), X12CrNiS18-8 (MMC, old DIN)."),
 g("304", S, "M", ["TWI","WYS"], {"aisi": ("304", ["TWI","WYS","MMC"]), "uns": ("S30400", ["TWI","WIKI"]), "en_number": ("1.4301", ["TWI","WYS"]),
   "en_name": ("X5CrNi18-10", ["TWI","WYS"]), "bs970": ("304S15", ["WYS"]), "jis": ("SUS304", ["WYS","MMC"])}, {"bs970": "304S31", "uk_en": "EN58E"},
   "MMC prints 1.4350 for 304; TWI and WYS give 1.4301, the standard 304 grade. WYS gives BS 304S15 (also a sheet designation); 304S31 is commonly quoted for bar but not yet sourced."),
 g("304L", S, "M", ["TWI","WYS","MMC"], {"aisi": ("304L", ["TWI","WYS","MMC"]), "uns": ("S30403", ["TWI","WIKI"]), "en_number": ("1.4306 / 1.4307", ["TWI","WYS","MMC"]),
   "en_name": ("X2CrNi19-11 (1.4306)", ["TWI"]), "bs970": ("304S11", ["WYS"]), "jis": ("SUS304L", ["WYS","MMC"])}, {},
   "1.4306 is printed by all three sources; WYS also lists 1.4307 (X2CrNi18-9), the common bar grade."),
 g("310S", S, "M", ["WYS"], {"aisi": ("310 / 310S", ["WYS"]), "uns": ("S31008", ["WIKI"]), "en_number": ("1.4845", ["WYS"]), "en_name": ("X12CrNi25-21", ["WYS"]),
   "jis": ("SUS310S", ["WYS"])}, {}, "TWI pairs 310 with 1.4951 (a pressure-vessel grade) and its own footnote disagrees on that grade's name."),
 g("316", S, "M", ["TWI","MMC"], {"aisi": ("316", ["TWI","WYS","MMC"]), "uns": ("S31600", ["TWI","WIKI"]), "en_number": ("1.4401", ["TWI","MMC"]),
   "en_name": ("X5CrNiMo17-12-2", ["TWI"]), "bs970": ("316S31", ["WYS"]), "jis": ("SUS316", ["WYS","MMC"])}, {"uk_en": "EN58J"}),
 g("316L", S, "M", ["TWI","WYS"], {"aisi": ("316L", ["TWI","WYS","MMC"]), "uns": ("S31603", ["TWI","WIKI"]), "en_number": ("1.4404", ["TWI","WYS"]),
   "en_name": ("X2CrNiMo17-12-2", ["TWI"]), "bs970": ("316S11", ["WYS"]), "jis": ("SUS316L", ["WYS","MMC"])}, {},
   "MMC pairs 316L with 1.4435 (higher Ni/Mo variant)."),
 g("316Ti", S, "M", ["TWI"], {"aisi": ("316Ti", ["TWI"]), "uns": ("S31635", ["TWI"]), "en_number": ("1.4571", ["TWI"]), "en_name": ("X6CrNiMoTi17-12-2", ["TWI"])},
   {"bs970": "320S31", "jis": "SUS316Ti"}),
 g("317L", S, "M", ["TWI"], {"uns": ("S31703", ["WIKI"]), "en_number": ("1.4438", ["TWI"]), "en_name": ("X2CrNiMo18-15-4", ["TWI"])}, {"aisi": "317L"},
   "TWI pairs 1.4438 with 317 (S31700); the X2 name means low carbon, i.e. 317L-type. Needs a second source."),
 g("321", S, "M", ["TWI","WYS"], {"aisi": ("321", ["TWI","WYS"]), "uns": ("S32100", ["TWI","WIKI"]), "en_number": ("1.4541", ["TWI","WYS"]),
   "en_name": ("X6CrNiTi18-10", ["TWI","WYS"]), "bs970": ("321S31", ["WYS"]), "jis": ("SUS321", ["WYS"])}, {"uk_en": "EN58B"}),
 g("347", S, "M", ["TWI"], {"aisi": ("347", ["TWI","WIKI"]), "uns": ("S34700", ["TWI","WIKI"]), "en_number": ("1.4550", ["TWI"]), "en_name": ("X6CrNiNb18-10", ["TWI"])},
   {"bs970": "347S31", "jis": "SUS347"}),
 g("904L", S, "M", [], {}, {"aisi": "904L", "uns": "N08904", "en_number": "1.4539", "en_name": "X1NiCrMoCu25-20-5"}, "Not yet sourced."),
 g("405", S, "M", ["TWI"], {"aisi": ("405", ["TWI","WIKI"]), "uns": ("S40500", ["TWI","WIKI"]), "en_number": ("1.4002", ["TWI"]), "en_name": ("X6CrAl13", ["TWI"])}),
 g("409", S, "M", ["TWI"], {"aisi": ("409", ["TWI","WIKI"]), "uns": ("S40900", ["TWI","WIKI"]), "en_number": ("1.4512", ["TWI"]), "en_name": ("X2CrTi12", ["TWI"])}),
 g("410", S, "M", ["TWI","WYS","MMC"], {"aisi": ("410", ["TWI","WYS","MMC"]), "uns": ("S41000", ["TWI","WIKI"]), "en_number": ("1.4006", ["TWI","WYS","MMC"]),
   "en_name": ("X12Cr13", ["TWI","WYS"]), "bs970": ("410S21", ["WYS"]), "jis": ("SUS410", ["WYS","MMC"])}, {"uk_en": "EN56A"}),
 g("410S", S, "M", ["TWI"], {"aisi": ("410S", ["TWI"]), "uns": ("S41008", ["TWI"]), "en_number": ("1.4000", ["TWI"]), "en_name": ("X6Cr13", ["TWI"])}),
 g("416", S, "M", ["TWI","WYS","MMC"], {"aisi": ("416", ["TWI","WYS","MMC"]), "uns": ("S41600", ["TWI","WIKI"]), "en_number": ("1.4005", ["TWI","WYS","MMC"]),
   "en_name": ("X12CrS13", ["TWI","WYS","MMC"]), "bs970": ("416S21", ["WYS"]), "jis": ("SUS416", ["WYS","MMC"])}),
 g("420", S, "M", ["TWI","WYS","MMC"], {"aisi": ("420", ["TWI","WYS","MMC"]), "uns": ("S42000", ["TWI","WIKI"]), "en_number": ("1.4021", ["TWI","WYS","MMC"]),
   "en_name": ("X20Cr13", ["TWI","WYS"]), "bs970": ("420S37", ["WYS"]), "jis": ("SUS420J1", ["WYS"])}, {"uk_en": "EN56C"}),
 g("420-highC", S, "M", ["WYS"], {"en_number": ("1.4028", ["WYS"]), "en_name": ("X30Cr13", ["WYS"]), "bs970": ("420S45", ["WYS"]), "jis": ("SUS420J2", ["WYS"])},
   {"aisi": "420 (higher carbon)"}, "WYS labels this 420F; 420F is a free-machining variant (UNS S42020), so treat as higher-carbon 420."),
 g("430", S, "M", ["TWI","MMC"], {"aisi": ("430", ["TWI","MMC"]), "uns": ("S43000", ["TWI","WIKI"]), "en_number": ("1.4016", ["TWI","MMC"]),
   "en_name": ("X6Cr17", ["TWI"]), "jis": ("SUS430", ["MMC"])}, {"bs970": "430S17", "uk_en": "EN60"}),
 g("431", S, "M", ["TWI","WYS","MMC"], {"aisi": ("431", ["TWI","WYS","MMC"]), "uns": ("S43100", ["TWI"]), "en_number": ("1.4057", ["TWI","WYS","MMC"]),
   "en_name": ("X17CrNi16-2", ["TWI"]), "bs970": ("431S29", ["WYS"]), "jis": ("SUS431", ["WYS","MMC"])}, {"uk_en": "EN57"},
   "Wikipedia prints S41623 for 431 (the 416Se number), a typo there; TWI gives S43100."),
 g("440C", S, "M", [], {"aisi": ("440C", ["WIKI"]), "uns": ("S44004", ["WIKI"])}, {"en_number": "1.4125", "en_name": "X105CrMo17", "jis": "SUS440C"}),
 g("17-4PH", S, "M", ["WYS","MMC"], {"aisi": ("630 (17-4PH)", ["WYS","MMC","WIKI"]), "uns": ("S17400", ["WIKI"]), "en_number": ("1.4542", ["WYS","MMC"])},
   {"en_name": "X5CrNiCuNb16-4", "jis": "SUS630"}),
 g("15-5PH", S, "M", [], {}, {"aisi": "15-5PH", "uns": "S15500", "en_number": "1.4545", "en_name": "X5CrNiCu15-5"}, "Not yet sourced."),
 g("2205", S, "M", ["TWI"], {"aisi": ("2205 (common name)", ["TWI"]), "uns": ("S31803", ["TWI"]), "en_number": ("1.4462", ["TWI"]), "en_name": ("X2CrNiMoN22-5-3", ["TWI"])},
   {"uns": "S32205"}, "'2205' is a common name, not a true AISI number (TWI)."),
 g("2304", S, "M", ["TWI"], {"aisi": ("2304 (common name)", ["TWI"]), "uns": ("S32304", ["TWI"]), "en_number": ("1.4362", ["TWI"]), "en_name": ("X2CrNiN23-4", ["TWI"])}),

 g("1015", C, "P", ["WYS","MMC"], {"aisi": ("1015", ["WYS","MMC"]), "en_number": ("1.0401", ["WYS","MMC"]), "en_name": ("C15", ["WYS","MMC"]),
   "bs970": ("080A15 / 080M13", ["WYS"]), "jis": ("S15C", ["WYS"]), "gb": ("15", ["MMC"])}, {"uns": "G10150", "uk_en": "EN32"}),
 g("1020", C, "P", ["WYS","MMC"], {"aisi": ("1020", ["WYS","MMC"]), "en_number": ("1.0402", ["WYS","MMC"]), "en_name": ("C22", ["WYS","MMC"]),
   "bs970": ("070M20", ["WYS"]), "jis": ("S20C / S22C", ["WYS"]), "gb": ("20", ["MMC"])}, {"uns": "G10200", "uk_en": "EN3B"}),
 g("1040", C, "P", ["WYS"], {"aisi": ("1040", ["WYS"]), "en_number": ("1.0511", ["WYS"]), "en_name": ("C40", ["WYS"]), "bs970": ("080M40", ["WYS"])},
   {"uns": "G10400", "uk_en": "EN8", "jis": "S40C"}),
 g("1045", C, "P", ["MMC"], {"aisi": ("1045", ["MMC"]), "en_number": ("1.0503 (C45) / 1.1191 (C45E, Ck45)", ["MMC"]), "bs970": ("080M46", ["MMC"]),
   "jis": ("S45C", ["MMC"]), "gb": ("45", ["MMC"])}, {"uns": "G10450"}),
 g("1055", C, "P", ["WYS","MMC"], {"aisi": ("1055", ["WYS","MMC"]), "en_number": ("1.0535", ["WYS","MMC"]), "en_name": ("C55", ["WYS","MMC"]),
   "bs970": ("070M55", ["WYS","MMC"]), "jis": ("S55C", ["WYS"]), "gb": ("55", ["MMC"])}, {"uns": "G10550", "uk_en": "EN9"}),
 g("1213", C, "P", ["WYS","MMC"], {"aisi": ("1213", ["WYS","MMC"]), "en_number": ("1.0715", ["WYS","MMC"]), "en_name": ("9SMn28 (old DIN)", ["WYS","MMC"]),
   "bs970": ("230M07", ["WYS","MMC"]), "jis": ("SUM22", ["WYS","MMC"]), "gb": ("Y15", ["MMC"])}, {"en_name": "11SMn30 (EN 10087)", "uk_en": "EN1A"},
   "WYS prints the number as 1.07159 (typo)."),
 g("1215", C, "P", ["MMC"], {"aisi": ("1215", ["MMC"]), "en_number": ("1.0736", ["MMC"]), "en_name": ("9SMn36 (old DIN)", ["MMC"]), "gb": ("Y13", ["MMC"])},
   {"en_name": "11SMn37 (EN 10087)", "jis": "SUM25"}),
 g("12L14", C, "P", ["MMC"], {"aisi": ("12L14", ["MMC"]), "en_number": ("1.0737", ["MMC"]), "en_name": ("9SMnPb36 (old DIN)", ["MMC"])},
   {"en_number": "1.0718 (11SMnPb30) is also widely quoted", "jis": "SUM24L"}),
 g("4130", C, "P", ["MMC"], {"aisi": ("4130", ["MMC"]), "en_number": ("1.7218", ["MMC"]), "en_name": ("25CrMo4", ["MMC"]), "jis": ("SCM420 / SCM430", ["MMC"])}, {"uns": "G41300"}),
 g("4140", C, "P", ["WYS"], {"aisi": ("4140 / 4142", ["WYS","MMC"]), "en_number": ("1.7225", ["WYS"]), "en_name": ("42CrMo4", ["WYS"]),
   "bs970": ("708M40 / 709M40", ["WYS","MMC"]), "jis": ("SCM440", ["MMC"]), "gb": ("40CrMoA", ["MMC"])}, {"uns": "G41400", "uk_en": "EN19"},
   "MMC pairs 4140 with 1.7223 41CrMo4 (a close sister grade). WYS prints JIS 'SCN440' (typo for SCM440)."),
 g("4340", C, "P", ["WYS","MMC"], {"aisi": ("4340", ["WYS","MMC"]), "en_number": ("1.6582", ["WYS","MMC"]), "en_name": ("34CrNiMo6", ["WYS","MMC"]),
   "bs970": ("817M40", ["WYS","MMC"]), "gb": ("40CrNiMoA", ["MMC"])}, {"uns": "G43400", "uk_en": "EN24", "jis": "SNCM439"},
   "WYS prints JIS 'SNcM447'; MMC gives none. SNCM439 is commonly quoted but not yet sourced."),
 g("8620", C, "P", ["MMC"], {"aisi": ("8620", ["MMC"]), "en_number": ("1.6523", ["MMC"]), "en_name": ("21NiCrMo2", ["MMC"]), "bs970": ("805M20", ["MMC"]), "jis": ("SNCM220", ["MMC"])},
   {"uns": "G86200", "uk_en": "EN362"}),
 g("52100", C, "P", ["MMC"], {"aisi": ("52100", ["MMC"]), "en_number": ("1.3505", ["MMC"]), "en_name": ("100Cr6", ["MMC"]), "bs970": ("534A99", ["MMC"]), "jis": ("SUJ2", ["MMC"])},
   {"uk_en": "EN31", "bs970": "535A99 also quoted"}),
 g("EN40B", C, "P", ["WYS"], {"en_number": ("1.7361", ["WYS"]), "en_name": ("32CrMo12", ["WYS"]), "bs970": ("722M24", ["WYS"])}, {"uk_en": "EN40B"}, "Nitriding steel."),
 g("EN41B", C, "P", ["WYS"], {"en_number": ("1.8509", ["WYS"]), "en_name": ("41CrAlMo7", ["WYS"]), "bs970": ("905M31 / 905M39", ["WYS"]), "jis": ("SACM645", ["WYS"])}, {"uk_en": "EN41B"}, "Nitriding steel."),
 g("EN36", C, "P", ["WYS"], {"aisi": ("3310 / 9314", ["WYS"]), "en_number": ("1.5752", ["WYS"]), "en_name": ("14NiCr14", ["WYS"]), "bs970": ("655M13 / 655H13", ["WYS"]), "jis": ("SNC815", ["WYS"])},
   {"uk_en": "EN36"}, "Case-hardening steel."),
 g("EN30B", C, "P", ["WYS"], {"en_number": ("1.6747", ["WYS"]), "en_name": ("30NiCrMo16-6", ["WYS"]), "bs970": ("835M30", ["WYS"])}, {"uk_en": "EN30B"}),

 g("O1", T, "P", ["WYS"], {"aisi": ("O1", ["WYS"]), "en_number": ("1.2510", ["WYS"]), "en_name": ("100MnCrW4", ["WYS"]), "bs970": ("BO1 (BS 4659)", ["WYS"]), "jis": ("SKS3 (approx.)", ["WYS"])}, {"uns": "T31501"}),
 g("O2", T, "P", ["WYS"], {"aisi": ("O2", ["WYS"]), "en_number": ("1.2842", ["WYS"]), "en_name": ("90MnCrV8", ["WYS"]), "bs970": ("BO2 (BS 4659)", ["WYS"])}, {"uns": "T31502"}),
 g("A2", T, "P", ["WYS","MMC"], {"aisi": ("A2", ["WYS","MMC"]), "en_number": ("1.2363", ["WYS","MMC"]), "en_name": ("X100CrMoV5", ["MMC"]), "bs970": ("BA2 (BS 4659)", ["WYS"]),
   "jis": ("SKD12", ["WYS","MMC"]), "gb": ("Cr5Mo1V", ["MMC"])}, {"uns": "T30102"}),
 g("D2", T, "P", ["WYS"], {"aisi": ("D2", ["WYS","MMC"]), "en_number": ("1.2379", ["WYS"]), "bs970": ("BD2 (BS 4659)", ["WYS"]), "jis": ("SKD11", ["WYS","MMC"]), "gb": ("Cr12MoV", ["MMC"])},
   {"uns": "T30402", "en_name": "X153CrMoV12"}, "MMC pairs D2 with 1.2601 (a close sister grade); WYS with 1.2379, the usual D2 equivalent. Names printed: X155CrVMo12-1 (WYS), X153CrMoV12 (MMC, for 1.2601)."),
 g("D3", T, "P", ["WYS","MMC"], {"aisi": ("D3", ["WYS","MMC"]), "en_number": ("1.2080", ["WYS","MMC"]), "en_name": ("X210Cr12", ["WYS","MMC"]), "bs970": ("BD3 (BS 4659)", ["WYS"]), "jis": ("SKD1", ["WYS","MMC"])}, {"uns": "T30403"}),
 g("H13", T, "P", ["WYS","MMC"], {"aisi": ("H13", ["WYS","MMC"]), "en_number": ("1.2344", ["WYS","MMC"]), "en_name": ("X40CrMoV5-1", ["WYS","MMC"]), "bs970": ("BH13 (BS 4659)", ["WYS"]),
   "jis": ("SKD61", ["WYS","MMC"]), "gb": ("40CrMoV5", ["MMC"])}, {"uns": "T20813"}),
 g("S1", T, "P", ["WYS"], {"aisi": ("S1", ["WYS","MMC"]), "en_number": ("1.2550", ["WYS"]), "en_name": ("60WCrV7 / 60WCrV8", ["WYS"]), "bs970": ("BS1 (BS 4659)", ["WYS"])},
   {"uns": "T41901"}, "MMC pairs S1 with 1.2542 45WCrV7 (lower carbon sister grade)."),
 g("P20", T, "P", ["WYS"], {"aisi": ("P20", ["WYS"]), "en_number": ("1.2311", ["WYS"]), "en_name": ("40CrMnMo7", ["WYS"]), "bs970": ("BP20 (BS 4659)", ["WYS"])}, {"uns": "T51620"}),
 g("M2", T, "P", ["WYS","MMC"], {"aisi": ("M2", ["WYS","MMC"]), "en_number": ("1.3343", ["WYS","MMC"]), "en_name": ("S6-5-2 (old DIN)", ["MMC"]), "bs970": ("BM2 (BS 4659)", ["WYS"]),
   "jis": ("SKH51", ["MMC"])}, {"uns": "T11302", "en_name": "HS6-5-2C (EN ISO 4957)"}),
 g("M42", T, "P", ["WYS"], {"aisi": ("M42", ["WYS"]), "en_number": ("1.3247", ["WYS"]), "bs970": ("BM42 (BS 4659)", ["WYS"]), "jis": ("SKH59", ["WYS"])},
   {"uns": "T11342", "en_name": "HS2-10-1-8"}, "WYS prints the name as S2-1-1-8 (typo)."),
]
out = {"schema": 1, "systems": SYS, "sources": SOURCES, "materials": MAT}
p = pathlib.Path(__file__).resolve().parent.parent / "data" / "materials.json"
p.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
n = len(MAT); c = sum(m["status"] == "confirmed" for m in MAT)
print(f"{n} grades, {c} confirmed by 2+ sources, {n-c} need review")
