# Sources

Every formula, table value and design idea in BenchMate is referenced here. Data files carry short keys (e.g. `TWI`) that resolve to this list. Accessed dates are when the source was read for this project.

## Formulas (`core/src/lib.rs`)
These are standard machining formulas, published in many references. Each function's doc comment names where it is published. Worked-example tests in `core/src/lib.rs` were computed independently.
- **[MH]** Oberg, Jones, Horton, Ryffel. *Machinery's Handbook*, Industrial Press (31st edition, 2020). Chapters: speeds and feeds; surface texture; tapers; twist drills; screw thread systems and three-wire measurement; hole circles; machining econometrics (tool life, minimum-cost cutting); areas of plane figures (bar stock sections).
- **[SAN]** Sandvik Coromant, "Formulas and definitions" for turning, milling and drilling (public web pages and Technical Guide). Milling includes circular ramping and helical interpolation: feed at tool centre = Vf x (Dm - Dc) / Dm inside a hole, Vf x (Dm + Dc) / Dm outside. sandvik.coromant.com
- **[ISO 68-1]** ISO 68-1:1998, ISO general purpose screw threads, basic profile (basis of the 0.649519 P pitch-diameter relation).
- **[TAY]** F. W. Taylor, "On the Art of Cutting Metals", *Transactions of the ASME* 28 (1907), pp. 31-350. Origin of the tool-life equation V T^n = C.
- **[GIL]** W. W. Gilbert, "Economics of Machining", in *Machining: Theory and Practice*, American Society for Metals, Cleveland, 1950, pp. 465-485. Minimum-cost tool life T = (1/n - 1)(Ct/Cm + tc) and maximum-production tool life T = (1/n - 1) tc. The same results are given in [MH] ("Machining econometrics") and in standard texts such as Kalpakjian and Schmid, *Manufacturing Engineering and Technology* (economics of machining).
- **[ISO 3002-1]** ISO 3002-1, basic quantities in cutting and grinding (symbols Vc, fn, ap, ae).

Status: the formulas are standard and were checked against worked examples; page-level citations (edition and page) are still to be added for each function.

## Material equivalents (`data/materials.json`)
All accessed 2026-11-10. Read through an automated page reader, so values were transcribed, not copy-pasted; "Confirmed" grades are cross-checked between sources, which also guards against transcription slips.
- **TWI**: TWI Ltd, "What are the equivalent European and American standards for common stainless steels?" https://www.twi-global.com/technical-knowledge/faqs/faq-what-are-the-equivalent-european-and-american-standards-for-common-stainless-steels (based on BS EN 10088-1:2005; BS EN 10028-7:2007 for 1.4951).
- **WYS**: West Yorkshire Steel Co. Ltd, international standards tables: stainless https://www.westyorkssteel.com/steel-specifications/international-standards/stainless-steel/ ; carbon and alloy https://www.westyorkssteel.com/steel-specifications/international-standards/carbon-and-alloy-steel/ ; tool steel https://www.westyorkssteel.com/steel-specifications/international-standards/tool-steel/
- **MMC**: Mitsubishi Materials Corporation, cutting tools general catalogue, "Material cross reference" (pages N028-N031). https://www.mitsubishicarbide.net/contents/mhg/ru/manual/material_cross_reference.pdf
- **WIKI**: Wikipedia, "SAE steel grades" (stainless SAE to UNS table). https://en.wikipedia.org/wiki/SAE_steel_grades (CC BY-SA 4.0).

Underlying standards the designations come from (not yet read directly): EN 10027-1/-2 (steel names and numbers), EN 10088 (stainless), EN 10083 / 10084 / 10087 (quenched and tempered, case hardening, free-cutting steels), EN ISO 4957 (tool steels), BS 970 (wrought steels), BS 4659 (tool steels), JIS G4051/G4053/G4303/G4404, SAE J403/J404, ASTM/SAE UNS (SAE HS-1086).

## Feature research
- CNC Machinist Calculator Ultra: in-app menus viewed 2026-11-10 and public pages https://cncmachinistcalculatorultra.com/homePage , https://cncmachinistcalculatorultra.com/tools/machining-chatter , https://apps.apple.com/app/id6474093839 . Used only as a feature checklist.
- CNCCookbook, "28 feeds and speeds features to try in G-Wizard Calculator". https://www.cnccookbook.com/28-feeds-and-speeds-features-to-try-in-g-wizard-calculator
- better-tool-library, feeds and speeds notes. https://github.com/knipknap/better-tool-library/blob/main/docs/feeds-and-speeds.md
- FSWizard store listing. https://play.google.com/store/apps/details?id=com.beta.fswizard
- Sample manufacturer catalogue pages supplied by Jacob (Cutwel Alu-Splitter milling range; MAE/MAS drilling conditions sheet), used to design the PDF importer. Not redistributed.

## Design
- Alkart Mega Wizard (jkdesignpro) UI tokens, `amw/static/index.html`.
