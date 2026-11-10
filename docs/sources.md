# Sources

Every formula, table value and design idea in BenchMate is referenced here. Data files carry short keys (e.g. `TWI`) that resolve to this list. Accessed dates are when the source was read for this project.

## Formulas (`core/src/lib.rs`)
These are standard machining formulas, published in many references. Each function's doc comment names where it is published. Worked-example tests in `core/src/lib.rs` were computed independently.
- **[MH]** Oberg, Jones, Horton, Ryffel. *Machinery's Handbook*, Industrial Press (31st edition, 2020). Chapters: speeds and feeds; surface texture; tapers; twist drills; screw thread systems and three-wire measurement; hole circles; machining econometrics (tool life, minimum-cost cutting); areas of plane figures (bar stock sections).
- **[SAN]** Sandvik Coromant, "Formulas and definitions" for turning, milling and drilling (public web pages and Technical Guide). Milling includes circular ramping and helical interpolation: feed at tool centre = Vf x (Dm - Dc) / Dm inside a hole, Vf x (Dm + Dc) / Dm outside. sandvik.coromant.com
- **[ISO 68-1]** ISO 68-1:2023, ISO general purpose screw threads, basic profile (basis of the 0.649519 P pitch-diameter relation; supersedes the 1998 edition).
- **[TAY]** F. W. Taylor, "On the Art of Cutting Metals", *Transactions of the ASME* 28 (1907), pp. 31-350 (page range to be verified). Origin of the tool-life equation V T^n = C.
- **[GIL]** W. W. Gilbert, "Economics of Machining", in *Machining: Theory and Practice*, American Society for Metals, Cleveland, 1950, pp. 465-485 (page range to be verified). Minimum-cost tool life T = (1/n - 1)(Ct/Cm + tc) and maximum-production tool life T = (1/n - 1) tc. The same results are given in [MH] ("Machining econometrics") and in standard texts such as Kalpakjian and Schmid, *Manufacturing Engineering and Technology* (economics of machining).
- **[ISO 3002-1]** ISO 3002-1, basic quantities in cutting and grinding (symbols Vc, fn, ap, ae).
- **[GERE]** J. M. Gere, B. J. Goodno, *Mechanics of Materials*, Cengage Learning (9th ed., 2018). Chapter "Deflections of beams": cantilever with end load, delta = F L^3 / (3 E I); nonprismatic (stepped) beams; Castigliano's theorem. Used for `cantilever_tip_deflection`, `stepped_cantilever_tip_deflection`, `tool_deflection_mm`. Second moment of a circle, I = pi d^4 / 64 (appendix, properties of plane areas).
- **[ROARK]** W. C. Young, R. G. Budynas, A. M. Sadegh, *Roark's Formulas for Stress and Strain*, McGraw-Hill (8th ed., 2012). Chapter 8 (straight beams), Table 8.1 case 1a (cantilever, end load); unit-load method for beams with varying section. Same formulas as [GERE]; the two-section result was also checked in a test by numerical integration of M m / (E I).
- **[ALT]** Y. Altintas, *Manufacturing Automation: Metal Cutting Mechanics, Machine Tool Vibrations, and CNC Design*, Cambridge University Press (2nd ed., 2012), Chapter 2 (mechanics of milling): chip thickness h(phi) = c sin(phi). BenchMate derives from it the engagement angle phi_e = acos(1 - 2 ae / D), max chip thickness fz sin(phi_e) (ae < D/2) and the exact arc-averaged mean chip thickness hm = fz (1 - cos phi_e) / phi_e. [SAN] gives the mean chip thickness for milling and the approximation hm ~ fz sqrt(ae / D) for small ae/D, which the exact form tends to.
- **[KV]** L. Kops, D. T. Vo, "Determination of the equivalent diameter of an end mill based on its compliance", *CIRP Annals* 39(1), 1990 (page range to be verified). Source of the idea of modelling the fluted part of an end mill as a solid cylinder of an equivalent (effective) diameter. **Not verified:** a factor of about 0.8 x D is often quoted from this work, but the paper could not be read for this project, so BenchMate leaves the factor blank for the user to enter.
- Force from power: Pc = Ft x Vc, so Ft (N) = Pc (kW) x 60 000 / Vc (m/min) [SAN][MH]. The radial / tangential force ratio depends on engagement, helix and rake and is a user input.

## GD&T (`core/src/gdt.rs`, `app/gdt.js`)
Full list with URLs, access dates (2026-11-10), the per-statement check table and the items still "to be verified" is in **`docs/gdt.md`**. Summary:
- **Standards (cited by name, year and clause only; status checked on the standards bodies' catalogue pages):** ASME Y14.5-2018 (R2024); ISO 1101:2017; ISO 5459:2024 (ISO 5459:2011 withdrawn); ISO 2692:2021; ISO 8015:2011; ISO 14405-1 (envelope requirement); ISO 22081:2021 (ISO 2768-2:1989 withdrawn). No text, figures or tables from them were copied.
- **[MIT]** J. Salsbury, "GD&T and the new ASME Y14.5-2018", Mitutoyo America, 2019.
- **[GLS]** Geometric Learning Systems, GD&T reference chart for ASME Y14.5-2018, 2019.
- **[GDTB]** GD&T Basics, educational articles (gdandtbasics.com).
- **[KEY]** KEYENCE, GD&T measurement guide (keyence.com).
- **[UIUC]** University of Illinois, ME 170 Engineering Drawing Notes.
- **[HZ]** Z. Humienny, P. Zdrojewski, Metrology and Measurement Systems 30(4), 2023, pp. 791-808 (ISO GPS vs ASME).
- **[SKL]** Skill-Lync; **[OEP]** Open Exam Prep GDTP study guide; **[JLC]** JLCCNC blog; **[CNCC]** CNCCookbook; **[WEV]** Wevolver (true position formula).
- **[ACC]** Accendo Reliability and **[FF]** Five Flute, RSS tolerance analysis (stack helpers).
- **[FARO]** O. Ekinci, composite positional tolerances, FARO; **[DCS]** 3DCS help manual, Composite GD&T (composite position checker).
- **[GEN]** Genorma catalogue, ISO 2768-2:1989 status (withdrawn 2021-02-04, revised by ISO 22081:2021).

## Shop helpers (`core/src/shop.rs`, `app/shop.js`)
Full list with URLs, the statement check table and open items: **`docs/shop-helpers.md`**. Summary:
- **[NIST]** NIST/SEMATECH e-Handbook of Statistical Methods, 6.1.6 (process capability) and 6.3.2.1 (mean range / d2, A2 table) (public domain).
- **[MTB]** Minitab support, methods and formulas for normal capability analysis (overall and within standard deviations).
- **[NR]** Press et al., *Numerical Recipes*, 2nd ed., 6.2 (erfc approximation).
- **[ISO1]** ISO 1:2022 standard reference temperature (cited); **[DOI]** T. Doiron, J. Res. NIST 112(1), 2007.
- **[SP811]** NIST SP 811, appendix B: 1 in = 25.4 mm exactly.
- **[FAS]** Fastenal, Tool Talk: Refractometers; **[ZEB]** Zebra Skimmers, refractometer product profile (concentration = Brix x the fluid's factor).

## Geometry (`core/src/geometry.rs`, `app/geometry.js`)
Full list and the statement check table: **`docs/geometry.md`**. Summary:
- Gauge-block sets: Mitutoyo (Cutwel PDF, Penn Tool and Transcat listings), Insize 112-piece, Starrett RS81.
- Sheet metal: KETIV Technologies, sheet metal unfold rule equations; Aircraft Systems Tech, making straight line bends (FAA-based).
- Indexing: US Navy Machinery Repairman training manual, ch. 7 (differential indexing).
- Trigonometry: OpenStax Algebra and Trigonometry 2e, ch. 10 (cited).

## Tool material data (Young's modulus presets, `app/tools.js` `E_PRESETS`)
- **Solid carbide, 580 GPa:** Ceratizit grade CTS20L (cemented carbide, 10% Co binder), elastic modulus 580 GPa at 23 C. Read from the grade's property listing as republished at https://www.mfgrobots.com/Article/material/composite/33306.html (accessed 2026-11-10); the Ceratizit primary data sheet (cdn.plansee-group.com) could not be fetched in this session and should be checked. Range check: Tungaloy catalogue grade table (page 38, https://allindustrial.com/content/catalogs/vendors/tungaloy/files/basic-html/page38.html, accessed 2026-11-10) lists cemented carbide grades from 490 GPa (UX30) to 660 GPa (G1F); the same listing site shows Ceratizit CTS22D 570, CTU16L 605, CTU06M 665 GPa. The preset is therefore one typical grade, not a universal value; users should enter their tool maker's figure.
- **HSS (M2, 1.3343), 219 GPa:** voestalpine High Performance Metals Denmark, "Datablad HSS/M2/W 1.3343" (Uddeholm site), physical properties at 20 C, elasticitetsmodul 219 x 10^3 N/mm^2. https://www.uddeholm.com/app/uploads/sites/239/2025/08/Datablad-HSS_M2_W-1.3343.pdf (accessed 2026-11-10).

Status: the formulas are standard and were checked against worked examples; page-level citations (edition and page) are still to be added for each function.

## Material equivalents (`data/evidence/`, `data/materials.json`)
Every material source document (102 so far, from publishers including TWI, Outokumpu, the International Stainless Steel Forum (ISO 15510), Atlas Steels, Aalco, Lucefin, Ovako, Smiths Metal Centres, Kennametal, Mitsubishi Materials, West Yorkshire Steel, Doerrenberg, Erasteel, BGH, Aubert & Duval, the Aluminum Association, Diehl, Alumeco and others) is listed with title, URL and access date in **`docs/material-sources.md`** (generated) and in the app under the table. Values were read through an automated page reader; verbatim rows are stored so any transcription can be checked.

Underlying standards the designations come from (not yet read directly): EN 10027-1/-2, EN 10088, EN 10083/10084/10087, EN ISO 4957, ISO 15510, BS 970, BS 4659, EN 573-3, EN 1706, EN 1412/CEN TS 13388, EN 1561, EN 1563, ASTM A48, ASTM A536, JIS G4051/G4053/G4303/G4404, SAE J403/J404, SAE HS-1086 (UNS).

## Reference data: drills, tap drills, threads, limits and fits (`data/refdata/`, `core/src/threads.rs`, `core/src/fits.rs`)
Evidence model: `data/refdata/*-evidence.json` records what each free publisher prints, with the URL and access date. `scripts/build_refdata.py` builds `data/refdata.json` and gives every value a status:
- **Confirmed**: two or more independent publishers agree, to the precision of the coarser printing.
- **Confirmed, one outlier**: two or more agree and one prints something else.
- **Sources differ**: the publishers print different values; all of them are shown.
- **One source**: only one publisher so far.

Nothing was typed in from memory and no handbook was used. The formulas are in the Rust core, with tests. Where a published table and a standard's formula differ, the app shows the published value and the formula value side by side.

### Standards cited (by name and clause only; current editions confirmed on the standards bodies' catalogues, 2026-11-10)
- ISO 286-1:2010 + Cor 1:2013 (ISO code system for tolerances, bases of tolerances and fits; https://www.iso.org/standard/45975.html) and ISO 286-2:2010 (tables of standard tolerance classes). These supersede ISO 286-1:1988, which allowed js values to be rounded to even numbers. The JIS B 0401 tables still print that older practice.
- ISO 965-1 (metric thread tolerances, principles and basic data): the 2026 edition (https://www.iso.org/standard/87889.html) replaces the 2013 edition. BenchMate's formulas follow the 2013 clauses, and **the 2026 changes have not been checked**. Also cited: ISO 965-3:2021 (deviations for constructional threads).
- ISO 68-1:2023 (basic profile), ISO 261:1998 (general plan; no newer edition found), ISO 262:2023 (selected sizes) and ISO 724:2023 (basic dimensions).
- ASME B1.1-2024 (Unified inch screw threads), issued June 28, 2024, revising B1.1-2019. The edition was confirmed from ASME's catalogue sheet https://www.asme.org/wwwasmeorg/media/codes-standards/find-codes/c-t_b1_1_2024.pdf .
- ASME B94.11M-1993 (twist drills; number sizes up to 97) and ISO 235:2016 (parallel shank jobber and stub series drills; metric diameters).

### Drill sizes
- **[WIKI]** Wikipedia, "Drill bit sizes" (number and letter tables). https://en.wikipedia.org/wiki/Drill_bit_sizes (accessed 2026-11-10).
- **[STOODY]** Stoody Industrial & Welding Supply, decimal equivalents, catalogue page 444. https://www.stoodyind.com/Catalogs/FISC/current/05catpg444.pdf (accessed 2026-11-10). This is the only source so far for the metric drill list, so those sizes are shown as One source.
- **[LOBBEN]** P. Lobben, *Machinists' and Draftsmen's Handbook* (1910, public domain), p. 148, Tables 19 and 20. https://runeberg.org/lobben/0168.html (accessed 2026-11-10).
- Fractional sizes are n/64 in by definition and are shown as Exact.
- Disagreements:
  - Letter K: Stoody prints .2610, the same as G and out of sequence. Wikipedia and Lobben print .281.
  - Letter O: Stoody prints .3150. The other two print .316.
  - Both are shown as Confirmed, one outlier.

### Tap drills
- **Cutting taps:** drill = D - 1.299038 x P x %/100. Two publishers give this formula (both accessed 2026-11-10):
  - OSG USA, "Tap drill size and pitch diameter limit chart", vol. 3, 2024, as drill = D - 0.01299 x % / TPI: https://res.cloudinary.com/osg-usa-inc/image/upload/v1717093846/Literature/03%20-%20Charts%20and%20Guides/OSG_-_Chart_-_Tap_Drill_Size_and_Pitch_Diameter_Limit_-_Vol_3_-_2024_-_IA.pdf
  - FM Carbide, in metric form as D - % x P / 76.98: https://fmcarbide.com/pages/tapping-formulas
  - In this convention a hole at the basic minor diameter gives 83.3 % thread.
- **Rule of thumb "tap drill = D - P":** checked against the formula, it gives about 77 % thread. The app labels it as an approximation.
- **Forming taps:** hole = D - 0.0068 x % x P, as published by FM Carbide (above) and Engineers Edge (both accessed 2026-11-10):
  - https://www.engineersedge.com/calculators/theoretical_tapping_hole_size_16209.htm
  - https://www.engineersedge.com/calculators/hole_sizes_cold_form_tapping_metric_threads_16210.htm
  - **No forming-tap maker's own catalogue has confirmed this formula yet.**

### Threads
- **[WIKI_ISO]** Wikipedia, "ISO metric screw thread" (preferred sizes from ISO 262). https://en.wikipedia.org/wiki/ISO_metric_screw_thread (accessed 2026-11-10).
- **[OPTIMAS_M]** Optimas Solutions, ISO metric thread dimensions. https://optimas.com/technical-resources/metric-thread-dimensions (accessed 2026-11-10). Checked against the ISO 68-1 formulas, two basic dimensions look like transposed digits:
  - M17x1 d3 is printed 15.733; the formula gives 15.773.
  - M48 D1 is printed 42.857; the formula gives 42.587.
- **[WIKI_UTS]** Wikipedia, "Unified Thread Standard". https://en.wikipedia.org/wiki/Unified_Thread_Standard (accessed 2026-11-10).
- **[OPTIMAS_UN]** Optimas Solutions, UNC, UNF and UNEF thread table. https://optimas.com/technical-resources/unc-and-unf-thread/ (accessed 2026-11-10).
- **[OPTIMAS_TOL]** Optimas Solutions, ISO metric screw thread tolerances (6g; M1 to M1.4 printed as 6h). https://optimas.com/technical-resources/iso-metric-screw-thread-tolerances/ (accessed 2026-11-10).
- **[GANTER_13]** Otto Ganter GmbH, metric ISO threads 6g/6H (DIN 13 extract). https://www.ganternorm.com/fileadmin/user_upload/downloads/technischer%20anhang/technical_information/13_gewinde.pdf (accessed 2026-11-10).
- **[CDE_6H]** CDE Fasteners, internal threads class 6H. https://cdefasteners.com/sites/default/files/product-specs/metintthread.pdf (accessed 2026-11-10).
- **[AF_2A]** American Fastener, class 2A cap screw thread limits (used in the tests only). https://www.americanfastener.com/wp-content/uploads/2020/03/CAP-SCREWS-Screws-Bolts-Class-2A.pdf (accessed 2026-11-10).
- **ISO 965-1 formulas against the published 6g/6H tables:** the formulas (Td2, TD2, Td, TD1, es), rounded to an R40 number and then to an integer, reproduce the tables except in these cells, where they differ by one R40 step (the tests list them):
  - 6g Td2 for M3: 75 against 80.
  - 6g Td for M36 and M39: 475 against 450.
  - 6H TD2 for M2.5, M3, M10 and M42.
  - 6H TD1 for M3 and M20.
- **6g M2.5 pitch diameter max:** Optimas prints 2.118; Ganter prints 2.188, and the formula gives 2.188. The app shows this value as Sources differ.
- **ASME B1.1 class 2A pitch-diameter tolerance:** with length of engagement LE = D, the formula reproduces all 30 American Fastener rows. LE = 5P, which MachiningDoctor (https://machiningdoctor.com/charts/unified-inch-threads-charts) gives as the default, does not.
- Not computed yet: the minor-diameter limits of Unified internal threads.

### ISO limits and fits
- **[WIKI_IT]** Wikipedia, "IT Grade". https://en.wikipedia.org/wiki/IT_Grade (accessed 2026-11-10).
- **[GANTER_IT]** Otto Ganter GmbH, DIN ISO 286 Grundtoleranzen. https://ganternorm.com/fileadmin/user_upload/downloads/technischer%20anhang/286_1.pdf (accessed 2026-11-10).
- **[GOST_25346]** GOST 25346-89 (the national adoption of ISO 286-1:1988), Tables 2 and 3, transcribed at https://dnaop.com/html/65935_2.html (accessed 2026-11-10).
- **[ROYMECH]** RoyMech, ISO shaft fundamental deviations. https://www.roymech.co.uk/Useful_Tables/ISO_Tolerances/ISO_SHAFT_LIM_1.html (accessed 2026-11-10). It was compared value by value with GOST: 517 of 517 values are equal. Its table is not republished because the site does not permit substantial reproduction.
- **[SIMPLYB]** Simply Bearings, ISO 286 limits and fits reference. https://simplybearings.co.uk/shop/Info-Pages-ISO-Limits/c4746_4779/index.html (accessed 2026-11-10).
- **[OSG_JIS]** OSG Corporation, shaft deviations for common fits (JIS B 0401 extract). https://www.osg.co.jp/media_dl/technical/file/hameai.pdf (accessed 2026-11-10).
- **Rounding findings:**
  - The annex formula is i = 0.45 D^(1/3) + 0.001 D, with D the geometric mean of the size step, followed by the standard rounding rules.
  - Above 3 mm, it matches the IT5 to IT10 table except in 10 cells: 3-6 mm IT6, IT9, IT10; 6-10 mm IT7, IT10; 10-18 mm IT7, IT10; 315-400 mm IT6; 400-500 mm IT6, IT7.
  - The standard tabulates the values, and the table governs.
  - In the table, IT(n+5) = 10 x IT(n) holds from IT7 up.
  - The hole delta, IT(n) - IT(n-1), matches the delta table printed in GOST.
- **Disagreements and misprints:**
  - IT18 over 315-400 mm: Ganter prints 2200, out of sequence with its neighbours; Wikipedia prints 8900. The app shows this value as Sources differ.
  - Simply Bearings prints E7 over 315-400 mm as +185, but the rule gives +182. The tests treat it as a misprint.
  - Shaft k over 400-500 mm has only one source.
- Not included: letters j and J (they are tabulated only and have no formula).

## Feature research
- CNC Machinist Calculator Ultra: in-app menus viewed 2026-11-10 and public pages https://cncmachinistcalculatorultra.com/homePage , https://cncmachinistcalculatorultra.com/tools/machining-chatter , https://apps.apple.com/app/id6474093839 . Used only as a feature checklist.
- CNCCookbook, "28 feeds and speeds features to try in G-Wizard Calculator". https://www.cnccookbook.com/28-feeds-and-speeds-features-to-try-in-g-wizard-calculator
- better-tool-library, feeds and speeds notes. https://github.com/knipknap/better-tool-library/blob/main/docs/feeds-and-speeds.md
- FSWizard store listing. https://play.google.com/store/apps/details?id=com.beta.fswizard
- Sample manufacturer catalogue pages supplied by Jacob (Cutwel Alu-Splitter milling range; MAE/MAS drilling conditions sheet), used to design the PDF importer. Not redistributed.

## Design
- Alkart Mega Wizard (jkdesignpro) UI tokens, `amw/static/index.html`.
