# Material equivalents tool

Goal: a large, trustworthy cross-reference of material grades across standards, because published equivalence tables often disagree or contain typos.

## How the data works
- **Evidence, not opinion.** `data/evidence/*.json` records what each source actually prints for a grade: one record per source, with the verbatim table row where available, the URL and the access date. Nothing is typed in from memory. Values a source doesn't print are null.
- **Built consensus.** `scripts/build_materials.py` builds `data/materials.json`. For every designation field it groups the values sources print (ignoring spacing, hyphens, "UNS"/"EN AW" prefixes and bracketed notes), counts independent publishers per value, and keeps every alternative.
- **Independence.** Publishers, not documents, are counted. Sources found to copy another publisher's text word for word are counted as that publisher (`COPIES` in the script).
- **Status per grade**, judged on the key designation (EN/W.-Nr. number for steels and copper, DIN/W.-Nr. or old BS for aluminium, W.-Nr. for titanium, nickel, cast iron, abbreviation for plastics):
  - *Confirmed*: the top value is printed by 2+ independent publishers and no other value has 2+.
  - *Sources differ*: two or more values each have 2+ publishers (e.g. 304L is 1.4306 and 1.4307).
  - *Needs 2nd source*: fewer than two independent publishers so far.
- **Disagreements and typos are shown, never silently fixed.** Examples found: Wikipedia gives 431 the 416Se UNS number; one stockholder prints 4140's JIS grade as "SCN440"; another prints "1.652" for 1.6582; Outokumpu prints 316Ti's UNS as S32100 (that is 321); 708M40 and 709M40 are each given for 4140/EN19 by five publishers. Round 2: NeoNickel prints Monel 400's W.-Nr. as 2.4630 (Kennametal and VDM: 2.4360) and gives Ti 6-2-4-2 the Ti-6Al-4V numbers; KIPP gives GG-25 / EN-GJL-250 ASTM A48 No. 25 B where two tables give No 35 B; 3.3206 is printed for both 6060 and 6063.
- **In the app:** each value shows a count of publishers; click a grade to see exactly what each source prints, with links.
- **Equivalent means comparable, not identical.** Chemistry and properties differ between standards; check the standard or mill certificate before substituting.

## Coverage (data v2, evidence round 2; properties round 2)
128 grades (1018 added: AISI 1018 / UNS G10180 printed by MakeItFrom and Online Metals; no EN number found yet, so it shows Needs 2nd source); 132 designation source documents plus 76 property documents (208 in all): steels (stainless, carbon, alloy, tool, old UK EN numbers), aluminium (wrought and LM casting alloys), copper alloys, titanium, nickel alloys, grey and ductile cast iron, engineering plastics (trade vs generic names; key = abbreviation). Run the build script for current counts by status. After round 2 every copper and nickel grade is confirmed.

## Gaps to fill
- Copper: JIS numbers (no fetched source printed one; Alumeco prints '-' in its JIS field); C103 vs C104 old-BS link for Cu-OF.
- Aluminium: second W.-Nr./BS sources for 6060, 6262, LM6, LM9, LM25; second JIS source beyond 6061 (Xometry is the only JIS source for most wrought grades).
- Titanium: second source for grade 3 (3.7055). Grade 5 shows "Sources differ" only because two W.-Nr. (3.7164 and 3.7165) are both printed for it.
- Cast iron: EN-GJL / EN-GJS names against old GG/GGG for more than GG 25 (ACTech prints EN names with 5.xxxx numbers but no old names); old W.-Nr. for GG 10, GGG 60, GGG 80; BS 1452 / BS 2789 from a source other than the tool-maker style tables.
- Plastics: nylon abbreviation (PA vs PA 6 C), PA6 vs PA66 split, second PEEK/PTFE trade-name sources.

## Material properties
Per grade: density, Young's modulus, tensile strength Rm, yield/proof strength Rp0.2, elongation, hardness, thermal expansion, thermal conductivity and, where a source gives one, a machinability rating. Shown in the grade detail (click a grade), metric or inch units following the app's toggle.

### Evidence
Property evidence lives in `data/evidence/props-*.json`, same layout as the designation evidence (sources, then grades with one `printed` row per source). A row carries `printed_as` (the designation the source used, e.g. "42CrMo4 (1.7225)") and a `properties` list. Each entry:

| Field | Meaning |
|---|---|
| `prop` | `density`, `e_modulus`, `rm`, `rp02`, `elongation`, `hardness`, `cte`, `k`, `machinability` |
| `value`, `max` | Number(s) exactly as printed; `max` set when the source prints a range |
| `unit` | Unit exactly as printed (`N/mm2`, `ksi`, `kg/dm3`, `10-6/°C`, `BTU.in/h.ft2.F` ...). For hardness the scale: `HB`/`HBW`, `HV`, `HRC`, `HRB`, `HRM`, `HRR`, `Shore D` |
| `cond` | Condition key used to group values across publishers: temper/heat treatment plus size band and standard where the values depend on them (`+QT 40-100 mm`, `T6 bar 20-150 mm`, `ASTM min, annealed (S30400)`, `H900`). Physical properties use the temperature: `RT`, `20-100C`, `20-300C`, `100C` |
| `condition` | Full condition as the source states it (product form, size, standard, designation used) |
| `basis` | `min`, `max` (spec limits), `range` (specified range), `typical`, or `unstated` (source gives no label) |
| `verbatim` | The printed row or line |
| `ref` | Machinability only: the basis of the rating, e.g. "% of AISI B1112", "% of free-cutting brass CW614N / CZ121 (= 100)" |
| `note` | Anything odd about the printing |

Sources record a `revision` (edition or date printed on the document; "no date printed" when none). Older editions and withdrawn standards are named there and in the condition text: BS 970 EN-series conditions (EN8R, EN24T...), BS 4659 (BO1), DIN 1561 (GG-25), BS 2870-2874 copper specs, Mil-T-9047G.

Rules, in addition to the designation rules above:
- **No condition, no mechanical value.** The build refuses a mechanical property (Rm, Rp0.2, elongation, hardness) whose `cond` is empty/"any". Sources that print one mechanical range across all tempers (Aalco copper alloys, Smiths CZ121) or no condition (MakeItFrom Ti-6Al-4V) are listed in the source notes and not recorded.
- **Physical properties** (density, E, expansion, conductivity) are recorded as `typical` when the source labels them typical or gives no label (they are not specification limits); temperature or range goes in `cond`. A source that prints expansion without a temperature range gets `cond` "range not stated" and is never compared with ranged values.
- **Hardness is never converted between scales.** Values are kept on the scale the source printed. Sources that print values "estimated from Rockwell C" without citing ISO 18265 / ASTM E140 are not recorded (Aerospace Metals Ti-6Al-4V sheet). Any future conversion must cite ISO 18265 or ASTM E140 and be shown as a conversion.
- **Elongation** gauge length goes in the condition (A = 5.65√S0, A50 mm, 2 in, 4D).
- Values are typed from a text extraction of the document made at access time; where the extraction showed a column mapping that was unclear, the value was left out (noted per source) or the order-based mapping is stated in `note`.

### Consensus (build_materials.py)
Values are grouped per grade by (property, `cond`, `basis`, hardness scale, machinability basis). Min, typical and range values are never compared with each other, and different conditions are never compared. Within a group, values are converted to SI (kg/m³, GPa, MPa, %, µm/m·K, W/m·K) and clustered:
- **Density**: same value if within 1 %.
- **All other properties**: exactly equal if both sources print the canonical unit (MPa = N/mm²), or within 0.5 % if either was converted from another unit (ksi, psi, Msi, BTU, °F). 0.5 % covers rounding of ksi/MPa dual printing (130 ksi = 896 MPa) without merging genuinely different figures.
- **Ranges** agree only if both ends agree; a range never agrees with a single value.
- Clusters are seeded by the first value met (evidence file order) and each later value joins the first cluster it agrees with. The value shown is the one printed most often in the cluster; all values inside the tolerance are listed.

Status per group: *Confirmed*: one value has 2+ independent publishers and no other has 2+. *Sources differ*: two values each have 2+ publishers, **or** 2+ publishers print values and no two agree. *Needs 2nd source*: one publisher so far. Independence is counted by publisher as for designations.

### Units in the app
Data stays SI. Inch mode shows lb/in³, Msi, ksi, µin/in·°F and BTU/h·ft·°F (factors: 1 kg/m³ = 3.6127e-5 lb/in³; 1 ksi = 6.894757 MPa; 1 µm/m·K = 1/1.8 µin/in·°F; 1 W/m·K = 0.5778 BTU/h·ft·°F). Hardness, elongation and machinability are unit-free and unchanged.

### Coverage
<!-- props-coverage:start (generated by scripts/build_materials.py) -->
54 of 128 grades have at least one property. Columns: publishers printing properties for the grade, then for each property the number of condition groups that are confirmed / differ / single-source.

| Family | Grade | Publishers | Density | E | Rm | Rp0.2 | A | Hardness | CTE | λ | Mach. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Aluminium | 1050 / 1050A | 1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  |
| Aluminium | 2011 | 3 | 0/1/0 | 0/1/0 | 0/0/3 | 0/0/3 | 0/0/4 | 0/0/3 | 0/1/0 | 0/1/0 |  |
| Aluminium | 2024 | 1 |  |  | 0/0/4 | 0/0/4 | 0/0/5 | 0/0/4 |  |  |  |
| Aluminium | 5052 | 1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  | 0/0/1 | 0/0/1 | 0/0/1 |  |
| Aluminium | 5083 | 2 | 0/1/0 | 0/1/0 | 0/0/3 | 0/0/3 | 0/0/1 | 0/0/3 | 0/1/0 | 0/1/0 |  |
| Aluminium | 5251 | 1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  | 0/0/1 | 0/0/1 | 0/0/1 |  |
| Aluminium | 5754 | 1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  |
| Aluminium | 6060 | 1 |  |  | 0/0/1 | 0/0/1 | 0/0/2 | 0/0/1 |  |  |  |
| Aluminium | 6061 | 1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  |
| Aluminium | 6082 | 3 | 1/0/0 | 0/1/0 | 4/0/1 | 4/0/1 | 4/0/2 | 4/0/1 | 0/1/0 | 0/1/0 |  |
| Aluminium | 7075 | 2 | 0/0/1 | 0/0/1 | 0/0/5 | 0/0/5 | 0/0/6 | 0/0/5 | 0/0/1 | 0/0/1 |  |
| Aluminium | 6063 | 2 | 0/0/1 | 0/0/1 | 1/0/1 | 1/0/1 | 2/0/1 | 1/0/1 | 0/0/1 | 0/0/1 |  |
| Aluminium | 6262 | 1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/2 | 0/0/1 | 0/0/1 | 0/0/1 |  |
| Copper alloy | CW451K CuSn5 (PB102, phosphor bronze) | 2 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  | 0/0/1 | 0/0/1 |
| Copper alloy | CW307G (CA104, aluminium bronze) | 1 | 0/0/1 | 0/0/1 | 0/0/2 | 0/0/2 | 0/0/2 | 0/0/2 | 0/0/1 | 0/0/1 | 0/0/1 |
| Copper alloy | CW004A Cu-ETP (C101) | 1 | 0/0/1 | 0/0/1 |  |  |  |  | 0/0/1 | 0/0/1 | 0/0/1 |
| Copper alloy | CW024A Cu-DHP (C106) | 1 | 0/0/1 | 0/0/1 |  |  |  |  | 0/0/1 | 0/0/1 | 0/0/1 |
| Copper alloy | CW508L CuZn37 (CZ108) | 1 | 0/0/1 | 0/0/1 |  |  |  |  | 0/0/1 | 0/0/1 |  |
| Copper alloy | CW721R (CZ114, high tensile brass / 'manganese bronze') | 1 | 0/0/1 | 0/0/1 |  |  |  |  |  | 0/0/1 | 0/0/1 |
| Copper alloy | CW614N CuZn39Pb3 (CZ121, free-cutting brass) | 3 | 1/0/0 | 0/0/1 |  |  |  |  | 0/0/2 | 0/0/1 | 1/0/0 |
| Copper alloy | CW617N CuZn40Pb2 (CZ122) | 2 | 1/0/0 |  |  |  |  |  | 0/0/1 | 1/0/0 |  |
| Copper alloy | CW712R CuZn36Sn1Pb (CZ112, naval brass) | 1 | 0/0/1 |  |  |  |  |  |  |  | 0/0/1 |
| Plastic | Acetal (POM) | 1 | 0/0/1 |  | 0/0/1 |  |  | 0/0/1 |  |  |  |
| Plastic | Nylon (PA) | 1 | 0/0/2 |  | 0/0/2 |  |  | 0/0/2 |  |  |  |
| Plastic | PEEK | 1 | 0/0/1 |  | 0/0/1 |  |  | 0/0/1 |  |  |  |
| Plastic | PTFE | 2 | 0/1/0 |  | 0/0/2 |  | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  |
| Plastic | UHMW-PE | 2 | 1/0/0 | 0/0/1 | 0/0/2 |  | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  |
| Steel | 416 | 2 | 1/0/0 | 1/0/0 | 0/0/7 | 0/0/2 | 0/0/1 | 0/0/1 | 0/0/3 | 0/0/2 | 0/0/1 |
| Steel | 2205 | 3 | 1/0/0 | 1/0/0 | 0/1/3 | 1/0/3 | 1/0/3 | 0/0/3 | 0/0/5 | 0/0/3 |  |
| Steel | 410 | 2 | 1/0/0 | 0/1/0 | 0/0/2 | 0/0/2 | 0/0/2 |  | 0/0/3 | 0/0/2 |  |
| Steel | 420 | 3 | 1/0/0 | 1/0/0 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/5 | 0/0/3 |  |
| Steel | 430 | 3 | 1/0/0 | 1/0/0 | 0/0/2 | 0/0/2 | 0/0/2 | 0/0/3 | 0/0/5 | 0/0/3 |  |
| Steel | 440C | 1 | 0/0/1 | 0/0/1 |  |  |  |  | 0/0/1 | 0/0/1 |  |
| Steel | 304L | 3 | 1/0/0 | 1/0/0 | 1/0/3 | 1/0/3 | 1/0/3 | 0/0/3 | 0/0/5 | 0/0/3 |  |
| Steel | 316L | 3 | 1/0/0 | 1/0/0 | 1/0/3 | 1/0/3 | 1/0/3 | 0/0/3 | 0/0/5 | 0/0/3 |  |
| Steel | EN24 | 3 |  |  | 0/0/12 | 0/0/12 | 0/0/12 | 1/0/11 |  |  |  |
| Steel | D2 | 4 | 1/0/0 | 0/0/1 |  |  |  | 1/0/8 | 0/0/2 | 0/1/0 |  |
| Steel | H13 | 2 | 0/0/1 | 0/0/1 | 0/0/2 | 0/0/2 |  | 0/0/3 | 0/0/2 | 0/1/0 |  |
| Steel | O1 | 3 | 0/0/1 | 0/0/1 |  |  |  | 0/0/6 | 0/0/2 | 0/1/0 |  |
| Titanium | Ti-6Al-4V (Grade 5) | 3 | 1/0/0 | 0/1/0 | 0/0/4 | 0/0/4 | 0/0/4 | 0/0/2 | 0/0/4 | 0/1/1 |  |
| Nickel alloy | Inconel 718 | 2 | 0/0/3 | 0/1/0 | 1/0/2 | 1/0/2 | 0/0/3 | 0/0/3 |  | 0/0/3 |  |
| Nickel alloy | Inconel 625 | 1 | 0/0/1 | 0/0/2 | 0/0/2 | 0/0/2 | 0/0/2 | 0/0/2 | 0/0/1 | 0/0/1 |  |
| Steel | 1018 | 2 | 1/0/0 | 0/1/0 |  |  |  |  | 0/0/1 | 1/0/0 |  |
| Steel | 304 | 3 | 1/0/0 | 1/0/0 | 1/0/3 | 1/0/3 | 1/0/3 | 0/0/3 | 0/0/5 | 0/0/3 |  |
| Steel | 303 | 3 | 1/0/0 | 1/0/0 | 0/0/4 | 0/0/4 | 0/0/4 | 0/0/2 | 0/0/5 | 0/0/3 |  |
| Steel | 316 | 3 | 1/0/0 | 1/0/0 | 1/0/3 | 1/0/3 | 1/0/3 | 0/0/3 | 0/0/5 | 0/0/3 |  |
| Steel | 321 | 2 | 0/1/0 | 0/1/0 | 1/0/2 | 1/0/2 | 1/0/2 | 0/0/2 | 0/0/4 | 0/0/2 |  |
| Steel | 17-4PH | 4 | 1/0/0 | 1/0/0 | 0/0/12 | 0/0/11 | 0/0/11 | 0/0/9 | 0/0/4 | 0/0/2 | 0/0/2 |
| Steel | 4140 | 2 | 1/0/0 | 0/0/1 | 2/0/3 | 2/0/3 | 0/0/6 | 0/0/7 | 0/0/1 | 0/0/1 |  |
| Steel | 4340 | 2 | 1/0/0 | 0/0/1 | 0/0/4 | 0/0/4 | 0/0/4 | 0/0/5 | 0/0/1 | 0/1/0 |  |
| Steel | EN8 | 1 |  |  | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 |  |  |  |
| Steel | 431 | 1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/1 | 0/0/2 | 0/0/1 |  |
| Steel | 1045 | 2 | 1/0/0 | 0/0/1 | 1/0/4 | 1/0/4 | 0/0/5 | 0/0/6 | 0/0/2 | 0/0/1 |  |
| Cast iron | Grey iron GG 25 | 1 | 0/0/1 | 0/0/1 | 0/0/1 |  | 0/0/1 | 0/0/1 |  |  |  |

Totals (condition groups, confirmed/differ/single-source): Density 21/4/28; Young's modulus 10/8/27; Tensile strength Rm 14/1/116; Yield / proof Rp0.2 15/0/101; Elongation 12/0/108; Hardness 7/0/122; Thermal expansion 0/3/90; Thermal conductivity 2/8/58; Machinability rating 1/0/9.

Grades with no property data yet: 1200, 2014 / 2014A, 7020, LM24 (AlSi8Cu3Fe), LM6 (AlSi12), LM25 (AlSi7Mg), LM9 (AlSi10Mg), LG2 leaded gunmetal (CC491K), Beryllium copper CW101C (CuBe2), CW008A Cu-OF (C103?), 301, 310S, 316Ti, 317L, 347, 904L, 405, 409, 410S, 420-highC, 15-5PH, 2304, 1015, 1020, 1040, 1055, 1213, 1215, 12L14, 4130, 8620, 52100, EN40B, EN41B, EN36, EN30B, O2, A2, D3, S1, P20, M2, M42, 420 (1.4028 X30Cr13 / 1.4021 X20Cr13), EN1A, EN3B, EN9, EN16, EN19, EN31, EN32, EN56 (A-D), EN57, EN58 (A-J, M), Ti CP Grade 1 (Ti 99.8), Ti CP Grade 2 (Ti 99.7), Ti CP Grade 4 (Ti 99.5), Ti CP Grade 3 (Ti 99.6), Inconel 600, Monel 400, Monel K-500, Hastelloy C-276, Grey iron GG 10, Grey iron GG 15, Grey iron GG 20, Grey iron GG 30, Grey iron GG 35, Grey iron GG 40, Ductile iron GGG 35.3, Ductile iron GGG 40, Ductile iron GGG 50, Ductile iron GGG 60, Ductile iron GGG 70, Ductile iron GGG 80.
<!-- props-coverage:end -->

### Notable disagreements found (properties)
- 2205 ASTM minimum Rm: Outokumpu prints 655 MPa (plate, A240), Atlas Steels 620 MPa (most common product); the ASTM plate and bar specs differ.
- 304, 304L, 303, 321 density: Outokumpu 7.9 kg/dm³, Atlas Steels 8000 kg/m³ (1.3 % apart). Austenitic E: Outokumpu 200 GPa, Atlas 193 GPa. 17-4PH E: Outokumpu 200, Aalco and Atlas 196 GPa.
- MakeItFrom prints 7075 at 3.0 g/cm³ and 2011 at 3.1 g/cm³ (two significant figures); Aalco prints 2011 at 2.83 g/cm³.
- 6082 thermal conductivity: Aalco 180, MakeItFrom 160 W/m·K. Ti-6Al-4V conductivity: TIMET 6.6, Aerospace Metals 6.7, MakeItFrom 6.8 W/m·K.
- 42CrMo4 +QT 40-100 mm hardness: Lucefin prints 271-331 HBW "for information", Ovako 270-320 HB.
- 17-4PH machinability: Smiths prints "50% of B-112" (annealed) and "75% of B-1112" (over-aged) on the same sheet.
- Aalco's 5083 page prints the density as "265 g/cm³" (checked on the page). Recorded as printed with a misprint note, not corrected; it shows as a disagreement against the other sources.
- Aalco's 410 page prints Young's modulus as 300 GPa (other martensitic sheets 200 GPa). Recorded as printed with a note.
- EN24 (817M40) condition U Rm: West Yorkshire Steel 925-1075 MPa, Smiths 925-1000 MPa.
- D2 annealed hardness: Dörrenberg/Lucefin max 255 HB, Uddeholm Sverker 21 approx. 210 HB. D2 conductivity: Dörrenberg 16.7, Uddeholm 20.0 W/m·K. H13 conductivity: Dörrenberg 25.6, Uddeholm (Orvar Supreme, a premium H13) 25 W/m·K.
- Inconel 718 Young's modulus: VDM 204 GPa, Special Metals 29.0 Msi (199.9 GPa). The AMS 5596 sheet minimums (1034 / 1241 MPa) are now confirmed by VDM and Special Metals.
- Inconel 625 (Special Metals bulletin): thermal conductivity at 70 °F is printed as 776 Btu·in/ft²·h·°F with 129 W/m·°C in the metric column; 776 Btu·in converts to about 112 W/m·K. The inch figure is recorded as printed with a note; neither is corrected. Its tensile table is a composite range "not suitable for specification purposes" and is recorded as ranges with that note.
- Smiths CZ122 physical values match the Alumeco CW617N sheet figure for figure (a shared origin cannot be ruled out). Smiths C101, C106 and CZ112 sheets copy Aalco's text: C101 counts as Aalco (`COPIES`), C106 and CZ112 were not added.
- Online Metals prints 1018 machinability "78%" without a basis; not recorded.

### Property gaps
- Most grades still have one publisher per condition. Round 2 added a second source for 6063/6082/2011/2024/6060/7075 bar minimums (ColorMetal EN 755-2 table), EN24 (West Yorkshire Steel, Macsteel), D2/O1/H13 (Uddeholm) and Inconel 718 (VDM). Still needed: 6061 bar minimums from a second EN 755-2 / ASTM B211 publisher; EN8 (Murray's sheet was unreadable, West Yorkshire Steel's 080M40 page has no table); D2/O1/H13 hardened hardness from a second publisher (Uddeholm prints tempering curves, not table values); CW614N and PB102 by temper; GGG 40 and other cast iron grades; plastics (Ensinger/Mitsubishi per-grade sheets).
- Not usable (ranges across all tempers with no condition): Aalco 15-5PH, 420 and 440C mechanical values; Smiths CZ108 and C101; MakeItFrom 1018 mechanical values.
- Machinability ratings: only CW614N/CW451K (vs CZ121) and 17-4PH (vs B1112) so far.

All sources: `docs/material-sources.md` (generated).
