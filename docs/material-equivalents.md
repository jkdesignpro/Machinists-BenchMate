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

## Coverage (data v2, evidence round 2)
127 grades from 130 source documents: steels (stainless, carbon, alloy, tool, old UK EN numbers), aluminium (wrought and LM casting alloys), copper alloys, titanium, nickel alloys, grey and ductile cast iron, engineering plastics (trade vs generic names; key = abbreviation). Run the build script for current counts by status. After round 2 every copper and nickel grade is confirmed.

## Gaps to fill
- Copper: JIS numbers (no fetched source printed one; Alumeco prints '-' in its JIS field); C103 vs C104 old-BS link for Cu-OF.
- Aluminium: second W.-Nr./BS sources for 6060, 6262, LM6, LM9, LM25; second JIS source beyond 6061 (Xometry is the only JIS source for most wrought grades).
- Titanium: second source for grade 3 (3.7055). Grade 5 shows "Sources differ" only because two W.-Nr. (3.7164 and 3.7165) are both printed for it.
- Cast iron: EN-GJL / EN-GJS names against old GG/GGG for more than GG 25 (ACTech prints EN names with 5.xxxx numbers but no old names); old W.-Nr. for GG 10, GGG 60, GGG 80; BS 1452 / BS 2789 from a source other than the tool-maker style tables.
- Plastics: nylon abbreviation (PA vs PA 6 C), PA6 vs PA66 split, second PEEK/PTFE trade-name sources.

All sources: `docs/material-sources.md` (generated).
