# Manufacturer data, PDF import and the learning profile

## 1. Manufacturer speeds and feeds
Every recommendation carries provenance: vendor, document, page, date, and the vendor's own range. Values are never merged silently; the UI shows each source side by side as a second opinion next to the BenchMate handbook baseline.

Record shape (one row per tool family x size band x material group):
`source{vendor,doc,page,imported_on}`, `tool{family,dia,flutes,coating,geometry}`, `material{iso_group P/M/K/N/S/H, name, hardness_range}`, `vc{nom,min,max,unit}`, `feed{nom,min,max,kind: fz|fn|ipm, unit}`, `ap_max`, `ae_range`, `notes`.

Data location: imported catalogue data stays on the user's machine (a local profile folder). It is **not** committed to this public repo or redistributed; the repo ships only the importer, schema, and our own baseline tables built from standards and handbooks.

## 2. PDF import with smart recognition
Pipeline: extract text with positions (layout aware) -> find table regions -> recognise header cells against a dictionary of synonyms and units (`Cutting Speed (m/min)`, `Vc`, `SFM`, `Feed (mm/rev)`, `fz mm/tooth`, `IPT`, `Diameter`, ISO material letters, `Alu`, `Stainless`...) -> parse cell patterns such as `90 (40 - 140)`, `<220`, `0.07`, ranges and fractions -> show a preview where the user confirms or corrects the column mapping and the units -> save, remembering the mapping per vendor layout so the next PDF from that vendor needs one click.

Seen so far in two sample PDFs (both parse with this approach): a milling catalogue page with a size table (diameter, flutes, fz) and a material band row of Vc limits, and a drilling sheet with Vc (min-max) and feed (min-max) per diameter band per material. Scanned/image PDFs: out of scope for v1 (OCR later).

Online tools (Harvey, MSC and similar): no scraping. Supported inputs are the user's own exports, copy/paste of result tables, saved pages, and PDFs. Each vendor's terms of use apply to what the user imports.

## 3. Adaptive profile (lightweight, local, transparent)
Profile key: machine + tool (holder, insert/cutter, coating) + material + operation.
- The user logs outcomes for a run: good, chatter, poor finish, short tool life, built-up edge, broke, with optional measured tool life and surface finish.
- The model is a small online Bayesian update of multiplicative correction factors on Vc and feed (and a depth limit), starting at 1.0 around the vendor nominal. It is not a black box: the profile screen shows each factor, the evidence behind it and a "reset" button.
- Hard clamps: recommendations never leave the vendor's published min-max, the machine's spindle and power limits, or user-set limits. Anything outside is flagged, never auto-applied.
- Cold start uses vendor nominal; sparse data shrinks toward the nominal; related tools/materials borrow strength with a low weight.
- Runs entirely offline, profile stored as a plain readable file the user can back up.

## 4. Build order
1. Schema + local store. 2. Baseline handbook tables (own). 3. PDF import for table layouts like the two samples. 4. Side-by-side comparison UI. 5. Outcome logging and the adaptive factors.
