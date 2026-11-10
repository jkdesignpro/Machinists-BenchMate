# Material equivalents tool

Goal: a large, trustworthy cross-reference of material grades across standards, because published equivalence tables often disagree or contain typos.

## How the data works
- **Evidence, not opinion.** `data/evidence/*.json` records what each source actually prints for a grade: one record per source, with the verbatim table row where available, the URL and the access date. Nothing is typed in from memory. Values a source doesn't print are null.
- **Built consensus.** `scripts/build_materials.py` builds `data/materials.json`. For every designation field it groups the values sources print (ignoring spacing, hyphens, "UNS"/"EN AW" prefixes and bracketed notes), counts independent publishers per value, and keeps every alternative.
- **Independence.** Publishers, not documents, are counted. Sources found to copy another publisher's text word for word are counted as that publisher (`COPIES` in the script).
- **Status per grade**, judged on the key designation (EN/W.-Nr. number for steels and copper, DIN/W.-Nr. or old BS for aluminium, W.-Nr. for titanium, nickel, cast iron):
  - *Confirmed*: the top value is printed by 2+ independent publishers and no other value has 2+.
  - *Sources differ*: two or more values each have 2+ publishers (e.g. 304L is 1.4306 and 1.4307).
  - *Needs 2nd source*: fewer than two independent publishers so far.
- **Disagreements and typos are shown, never silently fixed.** Examples found: Wikipedia gives 431 the 416Se UNS number; one stockholder prints 4140's JIS grade as "SCN440"; another prints "1.652" for 1.6582; Outokumpu prints 316Ti's UNS as S32100 (that is 321); 708M40 and 709M40 are each given for 4140/EN19 by five publishers.
- **In the app:** each value shows a count of publishers; click a grade to see exactly what each source prints, with links.
- **Equivalent means comparable, not identical.** Chemistry and properties differ between standards; check the standard or mill certificate before substituting.

## Coverage (data v2)
122 grades from 102 source documents: steels (stainless, carbon, alloy, tool, old UK EN numbers), aluminium (wrought and LM casting alloys), copper alloys, titanium, nickel alloys, grey and ductile cast iron. Run the build script for current counts by status.

## Gaps to fill
- Copper: second sources for PB102, CA104, plain coppers, beryllium copper, LG2; JIS for copper alloys.
- Aluminium JIS beyond 2014, 2024, 6061, 7075.
- Titanium and nickel: UNS numbers and second sources (Special Metals, Haynes, Smiths datasheets).
- Cast iron: EN-GJL / EN-GJS names and old BS 1452 / BS 2789 grades.
- Plastics (engineering plastics trade vs generic names).

All sources: `docs/material-sources.md` (generated).
