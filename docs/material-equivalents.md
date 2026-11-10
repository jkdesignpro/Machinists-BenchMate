# Material equivalents tool

Goal: a large, trustworthy cross-reference of material grades across standards, because mismatched equivalents cause real problems on the shop floor.

## Rules
1. **Every value is sourced.** Each designation lists the source keys that print it (see `docs/sources.md`). A value with no source yet is kept in `unsourced` and shown greyed with an "unsourced" tag; it is never presented as fact.
2. **Confirmed means two sources.** A grade is *Confirmed* only when two independent sources agree on the main pairing (US grade to EN/W.-Nr. number). Otherwise it is *Review*.
3. **Disagreements are shown, not fixed.** Sources often disagree or contain typos (examples found so far: Wikipedia lists 431 as S41623; one stockholder prints 4140's JIS grade as SCN440). These go in the grade's notes.
4. **Equivalent means comparable, not identical.** Chemistry and properties differ between standards; the app says so on every screen.

## Data
Generated: `data/materials.json` from `scripts/materials_seed.py`. Fields per grade: family, ISO 513 machining group (P/M/K/N/S/H), designations (`aisi`, `uns`, `en_number`, `en_name`, `bs970`, `uk_en`, `jis`, `gb`) each with sources, `unsourced`, `pair_sources`, `status`, `notes`.

Current coverage (v0.1 data): 53 grades (stainless, carbon and alloy, tool steels); 21 confirmed by two or more sources.

## Next data batches
Aluminium (EN AW / AA / old BS such as HE30, HE15), copper alloys (CW/CC numbers, CDA C-numbers, old BS CZ/PB/CA), titanium (ASTM grades, W.-Nr. 3.7xxx), nickel alloys (UNS N0xxxx, W.-Nr. 2.4xxx), cast irons (EN-GJL/GJS vs ASTM A48/A536), plastics (common engineering plastics trade and generic names), plus more steels and the UK old EN numbers (EN1A, EN8, EN19, EN24...). Each batch needs at least two independent sources per grade, and ideally the governing standard.
