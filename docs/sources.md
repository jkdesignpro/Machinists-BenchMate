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
- **Standards (cited by name, year and clause only; status checked on the standards bodies' catalogue pages):** ASME Y14.5-2018 (R2024); ISO 1101:2017; ISO 5459:2024, edition 3, 2024-10 (ISO 5459:2011 withdrawn); ISO 2692:2021; ISO 8015:2011; ISO 14405-1 (envelope requirement); ISO 22081:2021 (ISO 2768-2:1989 withdrawn). No text, figures or tables from them were copied.
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
- Round 3 (accessed 2026-11-10/11): **[PTC]** PTC Creo help (ASME optional modifiers; datum label rules); **[GLS12]** Stolter / Geometric Learning Systems edition comparison chart, 2012 (RFS symbol by edition, composite profile); **[HEX]** Hexagon PC-DMIS help, profile of a line (composite segments); **[SIS]** Swedish Institute for Standards, ISO 2768-2:1989 replaced by ISO 22081:2021; **[BSI]** BSI Knowledge, BS EN ISO 5459:2024 (published 2024-10-31, supersedes 2011); **[QM]** E. Morse, "Tolerancing standards: a comparison", Quality Magazine, 2016 (position on planes, ISO vs ASME); **[MMS]** G. Schuetz (Mahr), Modern Machine Shop, 2008, and **[PMPA]** Precision Machined Products Association (lobed parts and two-point gauges). ISO 5459:2024 edition 3 (2024-10) read on committee.iso.org.

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

## CAD / DXF (`core/src/dxf.rs`, `core/src/cad.rs`, `app/cad.js`)
Full list, the check table and open items: **`docs/cad-dxf.md`**. Summary:
- **[DXF]** Autodesk, *DXF Reference* (AutoCAD 2012 PDF edition and the current online edition): HEADER variables `$ACADVER`, `$HANDSEED`, `$INSUNITS` (1 inches, 4 millimetres), `$MEASUREMENT`; TABLES, BLOCKS and OBJECTS structure; LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE/VERTEX/SEQEND group codes; bulge = tan(theta / 4). Cited by name (the Autodesk site could not be reached from the build session).
- **[EZDXF]** ezdxf 1.4.5 (MIT), https://ezdxf.mozman.at/ : independent reader used to load and audit the generated files (`scripts/check_dxf.py`); not a source of code.
- Regular polygon relations: [MH] (regular polygons); bolt circle: [MH] (hole circles).

## Tool library and favourites (`app/toollib.js`, `app/app.js`)
- Own design. Unit conversion 1 in = 25.4 mm exactly: NIST SP 811, appendix B.

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
- **[STOODY]** Stoody Industrial & Welding Supply, decimal equivalents, catalogue page 444. https://www.stoodyind.com/Catalogs/FISC/current/05catpg444.pdf (accessed 2026-11-10). It was the first source for the metric drill list; MISUMI (below) confirms the 0.5 mm steps.
- **[LOBBEN]** P. Lobben, *Machinists' and Draftsmen's Handbook* (1910, public domain), p. 148, Tables 19 and 20. https://runeberg.org/lobben/0168.html (accessed 2026-11-10).
- **[MISUMI]** MISUMI USA, "Drill bit size chart" (blog), metric table in 0.5 mm steps from 0.5 to 20 mm. https://blog.misumiusa.com/drill-bit-size-chart/ (accessed 2026-11-10). It is the second source for those 40 metric sizes. The other metric sizes still have one source (Stoody).
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

- **Forming taps against a tap maker:** Balax, a maker of thread forming taps, publishes "A Balax, Inc. Guide to Tapping in the 21st Century" (2011/2012). It prints hole sizes for 75, 65 and 55 % thread on p. 3 (0-80 to 3-48) and p. 20 (M0.7 to M1.4). Copy read at https://powelltoolsupplyinc.assets-ascend-prod.roccommercecloud.com/assets%2FProduction%2Fc43a93116cca1ca5638577fadbf11477/Balax_10725_Catalog.pdf (accessed 2026-11-10).
  - Balax does not state a formula.
  - Its holes are 0 to 0.0016 in larger than D - 0.0068 x % x P gives; one cell is 0.0002 in smaller (test `form_tap_vs_balax`).
  - The 0.0068 rule is therefore labelled a rule of thumb, and the app tells users to use the tap maker's recommended hole.
  - No maker catalogue was found that states the formula itself.

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

- **Unified class 2B, against [AF_2B]:** American Fastener, "Nuts: internal threads, class 2B", https://www.americanfastener.com/wp-content/uploads/2020/06/NUTS-INTERNAL-THREADS-%E2%80%93-CLASS-2B-AMERICAN-FASTENER.pdf (accessed 2026-11-10); 74 rows, used in tests.
  - **Minor diameter rule.** The ASME B1.1 rule reproduces 71 of the 74 rows:
    - minimum = basic minor diameter;
    - tolerance = 0.25 P - 0.40 P^2 for 1/4 in and larger;
    - tolerance = 0.05 P^(2/3) + 0.03 P/D - 0.002 below 1/4 in, kept between 0.120 P and 0.394 P;
    - the basic minor diameter and the tolerance are each rounded to 0.0001 in, and the sum is rounded to 4 decimals up to No. 5 and to 3 decimals above.
  - **The 3 rows it does not reproduce:**
    - 3/8-24: maximum printed .0340, a digit error for .340.
    - 1-14 UNS: a special series; the rule gives .939, the table prints .938.
    - 1 3/4-5: minimum printed 1.534, where the basic minor diameter is 1.53349; the maximum agrees.
  - **Pitch diameter.** TD2 = 1.3 x the *unrounded* 2A tolerance, added to E rounded to 0.0001. This reproduces 69 rows.
    - BenchMate previously applied the factor to the rounded 2A tolerance, which was 0.0001 in off in 20 rows; this is now corrected.
    - 1/4-20 and 1 7/8-8 sit on a rounding tie and are 0.0001 in off.
    - 3 rows are digit errors in the table.
  - **Classes 1A, 3A, 1B and 3B** use the standard's class factors and have not been compared with a published table; the app marks them "not checked". The 1B and 3B minor limits are not computed.
- **Other ISO metric classes** (4h, 6e, 6f, 6h, 8g, 5H, 6G, 7H) are computed from the same ISO 965-1 formulas and are not checked against a published table. The app says so.

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

## Pipe threads, Whitworth and BA threads (`data/refdata/threads-other-evidence.json`, `core/src/thread_forms.rs`)
Same evidence model as above. Series values come from at least two publishers where found; dimensions that follow from a formula are computed and checked against the printed values in `core/src/thread_forms.rs`.

### Standards cited (current editions, from catalogue listings found on 2026-11-10)
- ISO 228-1:2000 (G, parallel; joint not made on the thread).
- ISO 7-1:1994 with Cor 1:2007 (R, Rp, Rc; pressure-tight joint made on the thread; taper 1:16).
- ASME B1.20.1-2013, reaffirmed 2018 (NPT), listed on asme.org. ANSI B2.1-1968 is its predecessor.
- BS 84:2007 (Whitworth form; listed on the BSI knowledge site).
- BS 93:2008 (BA). This edition is the one Wikipedia names; it was not found on BSI's catalogue in this session.

### Publishers
- **[WIKI_BSP]** Wikipedia, "British Standard Pipe". https://en.wikipedia.org/wiki/British_Standard_Pipe
- **[ETB_BSP]** The Engineering ToolBox, "ISO 228 - Pipe threads where pressure tight joints are not made on the threads". https://engineeringtoolbox.com/iso-228-pipe-threads-d_2037.html
- **[WIKI_NPT]** Wikipedia, "National pipe thread". https://en.wikipedia.org/wiki/National_pipe_thread
- **[UWASHER_NPT]** Ultimate Washer Inc., NPT dimensions chart (credited to ANSI B2.1-1968). https://ultimatewasher.com/dimensionschart.htm
- **[WIKI_BSW]** Wikipedia, "British Standard Whitworth". https://en.wikipedia.org/wiki/British_Standard_Whitworth
- **[EE_WHIT]** Engineers Edge, Whitworth BSW and BSF chart. https://engineersedge.com/hardware/whitworth-screw-threads-chart.htm
- **[BF_BSF]** British Fasteners, BSF table. https://britishfasteners.com/threads-bsf
- **[WIKI_BA]** Wikipedia, "British Association screw threads". https://en.wikipedia.org/wiki/British_Association_screw_threads
- **[BF_BA]** British Fasteners, BA table (inch). https://britishfasteners.com/threads-ba

All were accessed 2026-11-10.

### Findings
- **NPT.** E0 = D - (0.050 D + 1.1) p, E1 = E0 + 0.0625 L1 and L2 = (0.80 D + 6.8) p reproduce every E1 and L2 that Wikipedia prints, 1/16 to 24 in.
  - 1/16 is printed with D = .313; the published values come out with 0.3125.
  - For 4 in, E1 = 4.387125 exactly: Wikipedia prints 4.38713 and Ultimate Washer prints 4.38712. The app shows these as Sources differ.
- **BSP.** For G 1 3/4, Wikipedia prints 53.746 mm and The Engineering ToolBox prints 53.74 (all its other values are rounded, not cut). The app shows Sources differ.
  - The Engineering ToolBox "minor (nut) diameter" column is not the basic minor diameter, so it is not compared.
  - The ISO 7-1 gauge lengths come from one source so far.
- **BSW/BSF.** Only TPI is compared between publishers; the diameters come from the BS 84 profile (h = 0.640327 P, r = 0.137329 P).
  - Engineers Edge and British Fasteners print D - 2 x (h rounded to 0.0001 in), which differs from the exact formula in the last digit.
  - Engineers Edge digit errors: BSW 1/8 minor .0903 (should be .0930); BSF 7/16 minor .3363 (should be .3663, as British Fasteners prints).
  - An Engineers Edge row labelled 4 3/4 carries the 5 in dimensions; it is not used.
- **BA.** BS 93 defines P = 0.9^n mm and D = 6 P^1.2 mm, both tabulated to two significant figures. This reproduces Wikipedia's table (0 to 10 BA and 25 BA). The TPI of the two publishers agree.
  - British Fasteners' inch diameters differ slightly from the metric values converted (0 BA .2360 in, against 6.0 mm = .2362 in), so only TPI is compared.

## Machine tapers (`data/refdata/tapers-evidence.json`)
### Standards cited (current editions, from catalogue listings found on 2026-11-10)
- ISO 296:1991 (self-holding tapers, Morse).
- ISO 7388-1:2007 (7/24 shanks, forms A/AD/AF/U/UD/UF; reviewed and confirmed 2023 per the Indian adoption listing).
- ISO 7388-2:2007 (forms J/JD/JF, the BT type).
- ISO 7388-3:2016 (retention knobs AD, AF, UD, UF, JD, JF).
- ISO 12164-1:2023 (HSK shanks of types A, AB, C, CB and EB; iso.org/standard/77916).
- ASME B5.50-2015, reaffirmed 2025 (CAT 7/24 taper).
- JIS B 6339 (BT): edition not confirmed.

### Publishers
- **[WIKI_MT]** Wikipedia, "Machine taper" (Morse, Jacobs, HSK, R8 in prose). https://en.wikipedia.org/wiki/Machine_taper
- **[LMS]** Little Machine Shop, "Dimensions of standard tapers". https://littlemachineshop.com/pages/dimensions-of-standard-tapers
- **[TNG]** Tools-n-Gizmos, taper specifications (credited to the Kennametal catalogue 7060). https://tools-n-gizmos.com/specs/Tapers.html
- **[PARLEC]** Parlec catalogue p. 6, CAT and BT taper specifications. https://allindustrial.com/content/catalogs/vendors/parlec/files/basic-html/page6.html

All were accessed 2026-11-10.

### Findings
- **Morse.** The gauge diameters and taper per foot agree between Wikipedia and Little Machine Shop for MT 0 to 7, except MT 4 1/2:
  - large end: 1.4895 in (Wikipedia) against 1.5000 in (Little Machine Shop);
  - taper: 1:19.128 against 0.6240 in/ft.
  - Wikipedia's ratio is converted to taper per foot at 3 decimals for the comparison.
- **Jacobs.** Small end, large end and length agree between the two publishers for every size.
- **CAT and BT.** Gauge diameter, flange diameter and retention knob thread agree between Tools-n-Gizmos and Parlec where both print them.
  - Tools-n-Gizmos prints the CAT 40 flange as "2.500 (63.05)", but 2.500 in is 63.50 mm.
  - The ISO 7388-1 (SK) rows, HSK and R8 have one source so far; no free second publisher was found. Previews of the paid standards were not used.
- **Pull studs.** Only the standard references and the thread sizes are given. Knob profiles differ between machine builders.

## Inserts, holders, cutting material groups (`data/refdata/inserts-evidence.json`, `iso513-evidence.json`, `core/src/tooling.rs`)
### Standards cited (current editions, iso.org listings checked 2026-11-10)
- ISO 1832:2017 (indexable inserts for cutting tools: designation; iso.org/standard/69202).
- ISO 5608:2012 (turning and copying tool holders and cartridges for indexable inserts: designation; iso.org/standard/60180).
- ISO 513:2012 (classification and application of hard cutting materials).
- Mentioned, not decoded: ANSI B212.4 (inch insert designation) and ISO 6261 (boring bars); editions not checked.

### Publishers (all accessed 2026-11-10)
- **[WALTER]** Walter AG, designation key Walter Turn cutting inserts. https://cdn2.walter-tools.com/files/a5ea48ae-5fa6-0161-3cb3-0ac22248a0fb/7f0801eb-595f-4dda-8f3c-cd3acbacc456/turning-designation-key-walter-turn-cutting-inserts-en-gb.pdf
- **[MITSUBISHI]** Mitsubishi Materials, toolholder identification system. https://mitsubishicarbide.net/contents/mhg/de/html/product/product_guide/information/turning/bite_1.html
- **[KORLOY]** Korloy turning insert code system (Cutwel PDF). https://www.cutwel.co.uk/media/product-pdfs/downloads/Korloy%20Turning%20Inserts.pdf
- **[PRAMET]** Pramet catalogue (inch), holder key p. T179. https://powelltoolsupplyinc.assets-ascend-prod.roccommercecloud.com/assets%2FProduction%2F2c09719daaecbb19072d1c095c6d3a1e/Pramet_6753291_Catalog.pdf
- **[KENNAMETAL]** Kennametal Turning Inserts Master Catalog, pp. B4-B7. https://www.productivity.com/wp-content/uploads/pdfs/Kennametal%20Turning%20Inserts%20-%20Master%20Catalog.pdf
- **[YG1]** YG-1 YU-IT23 indexable insert catalogue, pp. 4 and 6-7. https://www.yg1usa.com/downloads/INDEXABLE-INSERT_YU-IT23.pdf
- **[ZCC]** ZCC Cutting Tools turning holder catalogue 2022-2023. https://sakusakuec.com/download/zcc_catalog_2022-2023_TurningHolder.pdf
- **[ISCAR]** ISCAR turning catalogue 2022, ISOTURN key (HTML view). https://iscar.com/Catalogs/flipview/flipview2022/english-1/TURNING-CATALOG-42_2022-p121-254/files/basic-html/page2.html
- **[DORMER_PRAMET]** Dormer Pramet, workpiece material groups. https://dormerpramet.com/WMG
- **[FMCARBIDE]** FM Carbide, ISO material group. https://fmcarbide.com/pages/iso-material-group
- **[CTE]** Cutting Tool Engineering, "Inserts show their true colors" (1999). https://ctemag.com/articles/inserts-show-their-true-colors/
- **[SECO]** Seco Tools, the ISO application standardization. https://www.secotools.com/article/120339

### Findings
- **Size codes follow from geometry.** Every ISO insert with tangent sides has edge l = (d/2)(cot(a1/2) + cot(a2/2)).
  - The whole-mm code matches all 33 rows checked (Mitsubishi table, Korloy and Walter where they print the same sizes).
  - One rounding rule is needed: the triangle with d = 25.4 mm has l = 43.994 mm and is coded 44, so lengths within 0.01 mm below a whole number round up.
- **Inch catalogues.** Kennametal and YG-1 print tolerances, thickness and corner radius in inch. These are converted to mm and compared at the coarser precision; where makers agree, the metric printing is shown.
- **Holder style G.** YG-1 prints kr 90 deg; ZCC's product tables print 91 deg. Shown as "Sources differ".
- **ISO 513 colour for S.** Orange (Dormer Pramet) against brown (FM Carbide). Shown as printed.
- **One maker only so far:**
  - tolerance classes A, F, J, K, L, M, N, U (Walter);
  - insert type letters (YG-1; A also ISCAR);
  - edge F and insert hand (Kennametal);
  - holder clamping C and D; styles D, E, H, P; several tool length letters.
  - Edge letters other than F, and holder styles not listed, are not decoded.
- **Not used.** Walter, ISCAR, Kyocera and Tungaloy keys show some columns only as drawings or extract scrambled; those columns were not used. Sandvik product pages need JavaScript and could not be read.

## Surface texture (`data/refdata/surface-evidence.json`)
### Standards cited
- ISO 21920-1:2021 (indication of surface texture), ISO 21920-2:2021 (terms, definitions and parameters), ISO 21920-3:2021 (specification operators): current per iso.org.
- ISO 1302:2002: withdrawn 2021-12-20, replaced by ISO 21920-1.
- ASME Y14.36 for US drawings: mentioned, edition not checked.

### Publishers (all accessed 2026-11-10)
- **[CERATIZIT]** CERATIZIT, bar peeling hints and tips: surface quality. https://cuttingtools.ceratizit.com/bg/en/industries/bar-peeling/hints-and-tips/surface-quality.html
- **[WERK24]** Werk24, N-grades. https://werk24.io/knowledge-base/n-grades
- **[ENGINEERSEDGE]** Engineers Edge, surface roughness conversion chart. https://ns2.engineersedge.com/manufacturing/surface-roughness-conversion.htm
- **[MECHENG]** Mechanical-Engineering.com, surface roughness chart (2018). https://mechanical-engineering.com/surface-roughness-chart/
- **[AUTODESK]** Autodesk Inventor 2020 help, press fit surface quality. https://help.autodesk.com/cloudhelp/2020/ENU/Inventor-Help/files/GUID-AB89A817-38AB-4DC0-8594-54847FB0034B.htm

### Findings
- **N grades.** N1 to N12 agree across four publishers except N6: Engineers Edge prints 0.5 um, the other three 0.8 um. The series doubles at each step, so 0.8 fits.
- **Rz and Rt beside the N grades.** CERATIZIT (Rz) and Mechanical-Engineering.com (Rt) print values about 3 to 13 times Ra. They are shown as evidence that Ra and Rz do not convert, not used as a conversion.
- **Process ranges.** The two charts differ in grouping and limits for every process. Both are shown, with the range both include. Labelled approximate.

## Hardness conversion (`data/refdata/hardness-evidence.json`)
### Standards cited
- ISO 18265:2013 (metallic materials, conversion of hardness values; iso.org/standard/53810), current.
- ASTM E140-26 (hardness conversion tables for metals), current per the DIN Media listing; its tables were not used.
- Older practice: DIN 50150 was replaced by DIN EN ISO 18265.

### Publishers (all accessed 2026-11-10)
- **[OPTIMAS]** Optimas Solutions, hardness conversion table (according to ISO 18265). https://optimas.com/technical-resources/hardness-conversion-table/
- **[BOSSARD]** Bossard, technical information TG.006 (g-002-de), comparison table tensile strength and hardness (ISO 18265). https://www.bossard.com/ch-de/-/media/bossard-group/website/documents/technical-resources/de/g-002-de.pdf

### Findings
- **Agreement.** All 97 rows (HV 80 to 940) agree in every column both print.
- **Bracketed HRB values above 100** (101, 102, 104, 105) sit one row lower in the Optimas printing (HV 255, 265, 275, 285) than in Bossard's (HV 260, 270, 280, 290). Each shows as one source and is not used for interpolation.
- **Not used.**
  - Righton Blackburns and a tube maker print the same BS 860 based table for stainless steel: not independent of each other, and for another material group.
  - Kemet prints only a few points.

## Knurling (`data/refdata/knurl-evidence.json`)
### Standards cited
- DIN 82:1973-01 (knurls), current per DIN Media.
- DIN 403 (knurling wheels): pitches as quoted by Hommel+Keller; edition not confirmed.

### Publishers (all accessed 2026-11-10)
- **[DORIAN]** Dorian Tool, knurling catalogue. https://www.productivity.com/wp-content/uploads/2015/05/Dorian-Knurling.pdf
- **[HOMMEL_KELLER]** Hommel+Keller Zeus catalogue 2021, pp. 35-46. https://cdn.shopify.com/s/files/1/0564/9065/5778/files/HOMMEL_KELLER_ZEUS_kataloog_2021.pdf

### Findings
- **Pitch relations.** Both makers give the same relations: CP pitch = 25.4 / TPI mm, DP pitch = pi / DP in. Dorian also gives the tooth count and the 30 deg diagonal correction (cos 30).
- **Checks.** The core reproduces:
  - Dorian's examples: 17.32 transverse TPI at 20 TPI; 83.14 teeth on 1 in at 96 DP and 30 deg; a 0.998 in blank for 83 teeth;
  - Hommel+Keller's pitch examples: CP 20 = 1.27 mm, DP 64 = 1.25 mm.
- **Dorian DP table.** It prints 23.6 TPI at 30 deg for 64 DP, where the formula gives 23.5; the other rows agree. Not used.
- **Diameter growth** for form knurling is empirical and differs by maker: Dorian by TPI in inch, Hommel+Keller by material, diameter and pitch in mm. It is not tabulated; the tool tells the user to make a trial.

## G and M codes, macros (`data/refdata/gcodes-evidence.json`, `app/gmcodes.js`)
Full list with editions, sections, coverage counts, gaps and disagreements: **`docs/gm-codes.md`**. All accessed 2026-11-10. Summary:
- **Standards cited:** ISO 6983-1:2009 (program format and address words), by name only. **[NIST]** T. R. Kramer, F. M. Proctor, E. Messina, *The NIST RS274NGC Interpreter - Version 3*, NISTIR 6556, 2000 (public domain), Tables 4 and 5, section 3.6.
- **[LCNC_OV] [LCNC_M]** LinuxCNC G-code overview (modal groups) and M-code pages.
- **Fanuc:** [FAN_M] 0i-F Plus Operator's Manual (Machining Center), B-64694EN-2/01; [FAN_T] 0i-F lathe manual, B-64604EN-1/01 (public copies on manualmachine.com); [MFG_FT] [MFG_F31] mfgrobots.com lists; [TIE] TIE / fanucworld list; [IMD_SYS] Industrial Monitor Direct A/B/C article.
- **Haas:** [HAAS_MG] Mill Operator's Manual ch. 17 (2025); [HAAS_MWB] Mill Programming Workbook (2015); [HAAS_LC] lathe G&M code card (2002); [HFO_L] Haas Factory Outlet lathe programming manual (12/2024); [HAAS_MAC] Macro Programming Information (2017).
- **Mitsubishi:** [MIT_EL] [MIT_EM] e-learning BNP-C8027-688/689 (2020); [MIT_70L] M700L/M70L Programming Manual; [MIT_M60] MELDAS 60/60S programming manual BNP-B2181.
- **Siemens:** [SIE_C101] SINUMERIK Handbook G codes & M codes; [SIE_ISOM] 840D sl ISO Milling 06/2009 (6FC5398-7BP10-1BA0); [SIE_PGA] Job Planning 03/2013 (6FC5398-2BP40-3BA1).
- **Heidenhain:** [HEI_320] TNC 320 DIN/ISO user's manual 77185x-01 (7/2014, French), p. 553; [HEI_426] TNC 426 B ISO manual, p. 275; [ICAM_H] ICAM Heidenhain ISO syntax.
- **Okuma:** [OKU_P200L] OSP-P200L/P20L Programming Manual 3rd ed. (2007); [OKU_BLOG] Okuma America blog; [OKU_MTH] Machine Tool Help list; [ICAM_O] ICAM Okuma syntax.
- **Mazak:** [MAZ_T] Programming EIA/ISO for MAZATROL turning, C734PBT018E (2002).
- **Macros:** [TORNOS] Tornos Tips & Tricks B Macro (2017); [CNCC] CNCCookbook parameterized programming.

## Feature research
- CNC Machinist Calculator Ultra: in-app menus viewed 2026-11-10 and public pages https://cncmachinistcalculatorultra.com/homePage , https://cncmachinistcalculatorultra.com/tools/machining-chatter , https://apps.apple.com/app/id6474093839 . Used only as a feature checklist.
- CNCCookbook, "28 feeds and speeds features to try in G-Wizard Calculator". https://www.cnccookbook.com/28-feeds-and-speeds-features-to-try-in-g-wizard-calculator
- better-tool-library, feeds and speeds notes. https://github.com/knipknap/better-tool-library/blob/main/docs/feeds-and-speeds.md
- FSWizard store listing. https://play.google.com/store/apps/details?id=com.beta.fswizard
- Sample manufacturer catalogue pages supplied by Jacob (Cutwel Alu-Splitter milling range; MAE/MAS drilling conditions sheet), used to design the PDF importer. Not redistributed.

## Design
- Alkart Mega Wizard (jkdesignpro) UI tokens, `amw/static/index.html`.

## G-code cycles (`core/src/cycles.rs`, `core/src/gcode.rs`, `app/cycles.js`)
Full list with URLs, access dates (2026-11-10), the dialect support matrix and decisions is in **`docs/cycles.md`**. Summary:
- **Control syntax:** FANUC Series 0i-F Plus Operator's Manual B-64694EN-2/01 (canned cycles, public copy); Haas Automation Mill Programming Workbook, Haas G84 Tapping guide and lathe G76 page (haascnc.com); Haas Factory Outlet Lathe Programming (G71 one-block, G70, G92, G50, G96/G97, G98/G99); CIMCO CNC programming book ch. 5 and appendix D; CIMCO Edit Fanuc turning exercise (G76 words without decimal point); Cutting Tool Engineering, single-point thread programming (two-block G76); NPTEL Module 7 (G71/G70); Industrial Monitor Direct (Fanuc G71, G76 and G-code systems A/B/C); makeitfrommetal.com and CNCCookbook (Fanuc dwell P in ms, M29 rigid tapping); P. Smid, CNC Programming Handbook ch. 45 (helical milling).
- **Formulas:** ISCAR threading catalogue 2023 (constant chip area infeed and worked example); Haas G76 (D x sqrt(N)); Harvey Performance and Travers Tool (thread-mill feed adjustment worked examples); [SAN] (CSS spindle speed); ISO 965-1 / ISO 68-1 thread depths (cited by name).

## Fasteners and machine elements (`data/refdata/fasteners-evidence.json`, `core/src/fasteners.rs`, `app/fasteners.js`)
### Standards cited (by name and clause only; nothing reproduced)
Editions confirmed on the standards body's catalogue page (iso.org, dinmedia.de), checked 2026-11-10:
- ISO 898-1:2013, property classes of bolts, screws and studs. Current; a revision is at working-draft stage.
- ISO 4762:2004, hexagon socket head cap screws. Current.
- ISO 273:1979, clearance holes for bolts and screws. Current.
- ISO 272:1982, widths across flats. Current; a DIS revision is in progress.
- ISO 299:1987, machine tool tables, T-slots and corresponding bolts. Current.
- ISO 3601-1:2012 + Amd 1:2019, O-rings, dimensions. Current.
- ISO 281:2007, rolling bearings, dynamic load ratings and rating life, clause 6. Current; a DIS revision is in progress.
- DIN 6885-1:2021-11, parallel keys. Current (replaces 2021-06). The free tables follow the 08/1968 edition and could not be compared with the new one; the tool says so.

Cited by the edition the publishers name; not checked on a catalogue page:
- VDI 2230 Part 1:2015 (systematic calculation of bolted joints), equations R7 and R13. FVA and Bossard cite the 2015 edition.
- ISO 773, JIS B 1301:1996, ASME B17.1-1967 (R2013), ASME B18.3, ASME B18.3.1M, ASME B18.2.1, ASME B18.2.8, JIS B 1001:1985, JIS B 1176, SAE J429, ASTM A574, SAE AS568, ANSI/ASME B5.1M-1985.

### Publishers (all accessed 2026-11-10 unless noted)
- **Grades:** [MUTUAL] Mutual Screw & Supply, bolt grade markings and strength chart, https://mutualscrew.com/pages/bolt-grade-markings-strength-chart ; [BOSSARD] Bossard technical sheet F-013 (SAE J429, ISO 898-1 markings), https://media.bossard.com/-/media/bossard-group/website/documents/technical-resources/en/f-013-en.pdf ; [WESTFIELD] Westfield Fasteners, strength specifications of metric fasteners, https://www.westfieldfasteners.co.uk/Ref-Strength-Spec.html ; [OPTIMAS] Optimas, mechanical and physical properties of steel fasteners, https://optimas.com/technical-resources/mechanical-physical-properties-steel-fasteners/
- **Socket head cap screws:** [MSC] MSC Industrial Supply, socket head cap screws PDF, https://www1.mscdirect.com/PDF/FASTENERS/SocketHeadCapScrews.pdf ; [AFT] AFT Fasteners, https://www.aftfasteners.com/socket-cap-screws-dimensions-and-mechanical-properties/ ; [AMFAST] American Fastener, https://www.americanfastener.com/sockets/ ; [MISUMI] MISUMI blog and technical data p. 2847 and p. 3557-3558, https://blog.misumiusa.com/metric-socket-head-cap-screws-dimensions/ , https://id.misumi-ec.com/pdf/tech/mech/p2847.pdf , https://mx.misumi-ec.com/es/pdf/tech/mech/US2010_fa_p3557_3558.pdf
- **Clearance holes:** [NBK] NBK, clearance holes and counterbores (JIS B 1001), https://static.nbk1560.com/images/en-US/product/technical_data/boltana_zagurikei_NBK/boltana_zagurikei_NBK_1.pdf ; [FRACTORY] Fractory, metric clearance hole sizes, https://fractory.com/?p=21620 ; [OPTIMAS_TAP] Optimas, tapping sizes, https://optimas.com/technical-resources/tapping-sizes/ ; [TRF] TR Fastenings, tapping sizes and clearance holes, https://www.trfastenings.com/Knowledge-Base/Engineering-Data/tapping-sizes-and-clearance-holes
- **Across flats:** [WIKI_AF] Wikipedia, width across flats, https://en.wikipedia.org/wiki/Width_across_flats ; [ACCU] Accu, https://accu.co.uk/p/464-across-flats-bolt-size-spanner-size-chart ; [SLS] SLS Bearings, https://www.slsbearings.com/slsbnn/spanner.html
- **Keys:** [FASTENIT] fasten.it DIN 6885-1, https://fasten.it/en/norms/norm/din_6885-1 ; [AIMS] AIMS Industrial keyway guide, https://aimsindustrial.com.au/blogs/product-guides/keyway-guide ; [EE_KEY] Engineers Edge, https://ns1.engineersedge.com/gears/shaft_diameter_vs_key_sizes_14411.htm ; [AMES_KEY] AMES Web, https://amesweb.info/Keys/Key-Size-Shaft-Diameter.aspx ; MISUMI (above).
- **T-slots:** [EE_TSLOT] Engineers Edge, https://engineersedge.com/hardware/dimension_table_for_tslots_bolts_and_nuts_13508.htm ; [ITEH_299] iTeh free preview of ISO 299:1987, https://cdn.standards.iteh.ai/samples/4229/42fffe9a850f46e9a81d5b0cadcdd408/ISO-299-1987.pdf
- **O-rings:** [GTWEED] Greene Tweed AS568 chart, https://www.gtweed.com/wp-content/uploads/AS568-standard-o-ring-sizing.pdf ; [EFUNDA] eFunda, https://www.efunda.com/designstandards/oring/oring_as568.cfm ; [ORINGSINC] O-Rings, Inc. AS568A PDF, https://www.oringsusa.com/o/wp-content/uploads/2024/10/AS568A.pdf ; [GLOBAL_ORING] Global O-Ring and Seal, groove design, https://www.globaloring.com/o-ring-groove-design/ ; [APPLE] Apple Rubber seal design guide, https://applerubber.com/seal-design-guide/seal-types-and-gland-design/o-ring-installation ; Parker O-Ring Handbook ORD 5700 cited by name.
- **Torque and preload:** [FVA] FVA-Workbench 9 documentation, bolt connection (VDI 2230-1:2015 eq. 229-231, 259), https://doc.fva-service.de/90/en/root-bolt-connection.html ; [HAMEEDI] Hameedi and Völgyi, ÉPKO 2025, eq. (3), https://ojs.emt.ro/EPKO/article/download/2030/2087/3136 ; [BOSSARD_VDI] Bossard, approximate values for metric coarse threads (VDI 2230), https://www.bossard.com/en/assembly-technology-expert/technical-information-and-tools/technical-resources/preload-and-tightening-torques/approximate-values-for-metric-coarse-threads-vdi-2230/ ; [BOSSARD_F044] Bossard technical sheet TF.049, friction classes A to E, https://www.bossard.com.cn/-/media/bossard-group/website/documents/technical-resources/en/f-044-en.pdf ; [MAREK] marek.eu technical information pp. 1287-1288, https://www.marek.eu/katalog-obrazku/produkt-24858/58479-technical-information-screws-nuts-en.pdf (worked-example check only).
- **Bearing life:** ZKL, designer information section 5 (determining the bearing size), C/P against L10 and L10h tables, https://www.zkl.cz/ru/produkty/obecne-informace-pro-konstruktery/5-urceni-velikosti-loziska (accessed 2026-11-11; test check only).

### Findings
- **Torque formula.** FVA and Hameedi and Völgyi print the same VDI 2230 relation, MA = F (0.16 P + 0.58 d2 muG + DKm/2 muK); 0.58 is 1/(2 cos 30 deg) rounded. The core reproduces the marek table (M8 to M16, muG = muK) within 2.5 % using ISO 273 medium holes and ISO across flats for DKm. The permitted preload uses the fully plastic section modulus pi d0^3/12, consistent with the 3/2 factor in R13; M10 8.8 at mu 0.12 gives 29.6 kN.
- **Friction is never defaulted.** Bossard's classes A to E are shown as cited ranges; both friction fields start empty and the tool waits for them.
- **ISO 898-1 class 8.8 proof stress disagrees.** For d up to 16 mm: Mutual 600, Westfield 660, Optimas 580 MPa. Over 16 mm: Westfield 580, Optimas 600. The tool lists all of them when 8.8 is chosen and tells the user to check their certificate or enter the value.
- **Metric clearance holes.** For M12, M14 and M16 medium, NBK and TR print 13.5 / 15.5 / 17.5 mm, Optimas and Fractory 14 / 16 / 18. Coarse differs too (NBK 14.5 / 16.5 / 18.5 against 15 / 17 / 19). Fractory alone prints M3 3.35, M6 6.5, M2.5 2.8 and M30 32. All shown.
- **Inch close-fit clearance.** MSC (decimals) and TR (drill names) differ at every size from #2 to 3/8 and at 1 1/4 and 1 1/2; both shown.
- **Metric counterbores.** MSC (ASME B18.3.1M) and MISUMI (JIS B 1176) differ at every size by 0.25 to 1.5 mm; both shown, with MISUMI's depths.
- **Inch across flats.** At 7/16 and 9/16 SLS gives the cap screw size (5/8, 13/16), Accu the heavy/nut size (11/16, 7/8).
- **Keys.** Metric key sizes, t1 and t2 agree across fasten.it, AIMS and MISUMI; the length ranges for 28x16 and 32x18 differ (315 against 320, 355 against 360). AIMS and Engineers Edge read the ASME B17.1 square to rectangular boundary differently; both shown.
- **AS568.** Greene Tweed and eFunda differ on the ID tolerance of -102 and -113. Greene Tweed prints -391 ID 21.995, which looks like a typo against the size steps around it; shown as printed.
- **Single-source values, labelled.** ASTM A574 yield and tensile (MSC; hardness confirmed by AFT), T-slot depth h (ISO 299 preview only), inch counterbores (MSC only).
- **Left out:** Woodruff keys (no second free source for seat dimensions), ISO 3601-1 G series and AS568 -9xx, bearing shaft and housing fits (no two makers compared), DIN 471/472 retaining rings and dowel pins.
## Small milling and turning (`core/src/millturn.rs`, `app/millturn.js`, tools in `app/tools.js`)
All web sources accessed 2026-11-10. Drawings are our own SVG. Worked-example tests in `core/src/millturn.rs` were computed independently (hand examples and brute-force scans).
- **[MD]** Machining Doctor, chip thinning calculator. https://www.machiningdoctor.com/calculators/chip-thinning-calculator/ . Radial chip thinning factor RCTF = 1 / sqrt(1 - (1 - 2 ae / D)^2) for ae < D/2; ball nose axial factor D / sqrt(D^2 - (D - 2 ap)^2).
- **[ALT]** Altintas (above), Ch. 2: h(phi) = c sin(phi). Engagement angle on a straight wall; on an inside corner or a convex boss it is derived here with the law of cosines and tested against a numerical scan.
- **[ISCAR-TI]** ISCAR, *Machining Titanium* (2019), p. 46, Table 28: ball nose effective diameter 2 sqrt(D ap - ap^2) with the axis normal to the surface. https://iscar.co.za/Catalogs/flipview/reference-user-guides/machining_titanium_05_2019/files/basic-html/page46.html
- **[IMCO]** IMCO Carbide Tool, "Adjustments for ball nose end mills": speed from the effective diameter, adjusted fz = D fz / De, scallop height about ae^2 / (8 R). https://cms.imcousa.com/wp-content/uploads/2021/01/Adjustments-for-Ball-Nose-Endmills.pdf . BenchMate uses the exact circle form h = R - sqrt(R^2 - (s/2)^2), which the IMCO approximation tends to.
- **Tilted ball nose (derived here, not taken from a source):** a point at polar angle psi from the tool axis turns on a diameter D sin(psi); with the axis tilted beta, the band in cut reaches psi = acos(1 - 2 ap / D) + beta, so De = D sin(min(that, 90 deg)). With beta = 0 it reduces to [ISCAR-TI].
- **[KD]** W. A. Kline, R. E. DeVor, "The effect of runout on cutting geometry and forces in end milling", *Int. J. Mach. Tool Des. Res.* 23(2/3), 1983 (pages to be verified; the paper was not read for this project). Chip per tooth with radial runout: tooth i cuts the minimum over k of (k fz + r_i - r_(i-k)). BenchMate models one eccentricity giving the dial-indicator TIR; the largest chip is then fz + TIR sin(pi / z). Tested by a brute-force scan.
- **[RS274]** NISTIR 6556 (see "G and M codes" above), inverse time feed G93: F = 1 / minutes for the move. Not re-read for this batch; the Haas G93 page could not be fetched.
- **[GERE]** (above): boring bar as a cantilever, delta = F L^3 / (3 E I), I = pi (d^4 - di^4) / 64 with an optional coolant bore. **[SAN]** (above): turning force Fc = kc ap fn.
- **Boring bar overhang guidance (shown per maker, not merged):**
  - Seco Tools, boring bar article. https://www.secotools.com/article/89275 . Steel 4 x D, carbide 8 x D, heavy metal 6 x D, damped (Steadyline) 10 x D.
  - Kennametal, "The basics of boring". https://dev65.kennametal.com/ar/en/resources/blog/metal-cutting/the-basics-of-boring.html . Steel 3 x D, carbide 6 x D, heavy metal 6 x D, damped 10 x D or more.
  - Cutwel, "Expert guide to using boring bars in metalworking". https://www.cutwel.co.uk/blog/expert-guide-to-using-boring-bars-in-metalworking . Steel 4 x D, carbide 6-8 x D.
- **Bar modulus presets (`BAR_E`):** steel 210 GPa (Ovako 4140 / 42CrMo4, see `docs/material-sources.md`); solid carbide 580 GPa (Ceratizit CTS20L, see "Tool material data" above); tungsten heavy metal 360 GPa from Plansee, *Tungsten heavy metal (W-MMC)* brochure 09.2021, Densimet D176, https://cdn.plansee-group.com/is/content/planseemedia/plansee/downloads/werkstoffe/W_MMC_Broschuere_Plansee_09-2021.pdf . Users can type their own modulus.
- **[STAR]** L. S. Starrett, *Band saw cutting rate chart*, Bulletin 193: cutting rate as area per minute. https://origin-www.starrett.com/docs/other-downloadable-resources/band-saw-cutting-rate-chart---bulletin-193.pdf
- **[KASCO]** KASCO, "How to calculate surface feet per minute and teeth per minute": teeth per minute = teeth per foot x blade speed. https://kasco.com/blogs/buying-guides/how-to-calculate-surface-feet-per-minute-sfpm-and-teeth-per-minute-tpm
- Slitting saw, lathe feed (mm/rev = mm/min / rpm), multi-pass turning time, cutter approach, teeth engaged, spot drill depth (chamfer diameter / (2 tan(point angle / 2))): standard geometry and the speed and feed relations of [SAN] and [MH]. Centre drill depth: pilot length (user input, from the maker or measured) plus the cone. No centre drill size table is shipped.

## Chatter (`core/src/chatter.rs`, `app/chatter.js`)
- **[SMITH10]** S. Smith, "Finding harmony in stable cutting", *Cutting Tool Engineering*, Dec. 2010. https://ctemag.com/articles/finding-harmony-stable-cutting/ (accessed 2026-11-10). Choose a speed whose tooth-passing frequency matches the chatter frequency, n = 60 fc / z; chatter frequency is near, not equal to, a natural frequency; use the running speed. Test: 427 Hz with 2 teeth gives 12 810 rpm.
- **[ST92]** S. Smith, J. Tlusty, "Stabilizing chatter by automatic spindle speed regulation", *CIRP Annals* 41(1), 1992 (pages to be verified; not read). Speed selection from the measured chatter frequency, repeated.
- **[ALT]** (above), Ch. 3: regenerative chatter and stability lobes; stable speeds n = 60 fc / (z (N + 1)) for lobe N.
- **[CT65]** J. W. Cooley, J. W. Tukey, "An algorithm for the machine calculation of complex Fourier series", *Math. Comp.* 19 (1965), 297-301: radix-2 FFT. Hann window and its coherent gain: Press et al., *Numerical Recipes*, 2nd ed., 12.2 and 13.4. Tests: FFT against a direct DFT, Parseval, and a synthetic tone found with spindle harmonics skipped.
- **[HARRIS]** F. J. Harris, "On the use of windows for harmonic analysis with the discrete Fourier transform", *Proc. IEEE* 66(1), 1978 (cited by name, pages to be verified): Hann window highest side lobe -31.5 dB, fall-off 18 dB per octave, main lobe +-2 bins. Used for peak picking: a peak inside the main lobe of a stronger one, or less than 15 dB (our margin) above its side-lobe envelope, is treated as leakage. The envelope is also checked numerically in a test. The 40 dB listing floor and the 15 dB margin are our own choices.
- Microphone capture uses the browser's `getUserMedia` and Web Audio `AnalyserNode` (W3C specifications). Echo cancellation, noise suppression and auto gain are off. The sound is analysed in memory, never stored or sent.

## Grinding (`core/src/grinding.rs`, `app/grinding.js`, `data/refdata/grinding-evidence.json`)
All web sources accessed 2026-11-10.
### Formulas
- **[GOETZ]** D. S. Goetz, "Wear mechanics of cylindrical grinding wheels", *Cutting Tool Engineering*, 24 Oct 2017. https://ctemag.com/news/wear-mechanics-cylindrical-grinding-wheels/ . Wheel speed sfpm = 0.2618 D (in) rpm; equivalent diameter De = Dwheel Dwork / (Dwheel + Dwork); contact length sqrt(doc De).
- **[MALKIN]** S. Malkin, C. Guo, *Grinding Technology*, 2nd ed., Industrial Press, 2008, Ch. 2 (cited by name): equivalent diameter (+ external, - internal, wheel diameter for surface grinding), contact length, equivalent chip thickness heq = ae vw / vs, specific removal rate Q'w = ae vw.
- **[ROWE]** W. B. Rowe, *Principles of Modern Grinding Technology*, 2nd ed., Elsevier, 2014 (cited by name): speed ratio q = vs / vw; overlap ratio = wheel width / traverse per work revolution.
- **[BED]** B. Bednarski (Saint-Gobain Abrasives), quoted in "Working an inside job", *American Machinist*, 19 Oct 2006. https://www.americanmachinist.com/machining-cutting/working-inside-job . Speed ratio about 25:1 to 65:1, shown as guidance, never as a default.
- Surface grinding time (strokes x down-feed layers plus spark-out) and plunge and traverse time: own derivation from the table and wheel motions; tests are hand examples.
- **Wheel speed:** the maximum operating speed marked on the wheel is never defaulted. Every grinding screen tells the user to obey the speed marked on the wheel or its label.
### Standards cited (iso.org listings checked 2026-11-10)
- ISO 525:2020, Bonded abrasive products, general requirements (current, confirmed 2026). https://www.iso.org/standard/78476.html
- ISO 8486-1:1996 (macrogrits F4 to F220) and ISO 8486-2:2007 (microgrits F230 to F2000), bonded abrasives grain size (both current, confirmed 2021). https://www.iso.org/standard/15695.html , https://www.iso.org/standard/42206.html
- ISO 6344-2 and -3:2021, coated abrasives, P grits; EN 12413, safety of bonded abrasive products; ANSI B7.1, safety code for abrasive wheels. All cited by name.
- ANSI B74.13-2016, markings for grinding wheels and other bonded abrasives. Edition from the NSAI shop listing (https://shop.standards.ie/en-ie/standards/ansi-b74-13-2016-1066989_saig_uama_uama_2480763); the UAMA page was not read.
### Publishers (grit sizes and wheel marking; keys as in the evidence file)
- **[NORITAKE]** Noritake, technical support: grain (tables after JIS R6001 / R6010 / B4130). https://www.noritake.co.jp/eng/supports/detail/25/ . F4-F220 as the control-sieve aperture (not a mean size); F230-F1200 as ds-50.
- **[HAPSTONE]** Hapstone, "What is the FEPA grit system?" (27 May 2026). https://hapstone.eu/en-eu/blogs/news/what-is-the-fepa-grit-system
- **[TEDPELLA]** Ted Pella, abrasive grit grading systems (tables courtesy of 3M). https://www.tedpella.com/Material-Sciences_html/Abrasive_Grit_Grading_Systems.aspx
- **[STEELDATA]** Steel Data, grit size table (ANSI B74.18-1996 / CAMI and FEPA 43-GB-1984 mid-points). https://steeldata.info/semi/demo/help/others/grit_size_table.html
- **[UNITED]** United Abrasives, ANSI standard marking system (6 Aug 2023). https://www.unitedabrasives.com/?p=40696
- **[CGW]** CGW (Camel Grinding Wheels), vitrified and surface grinding wheels catalogue pp. 119-125, hosted by Travers Tool. https://docs.travers.com/assets/pdf/105547_tech.pdf
- **[NAVY]** US Navy, Machinery Repairman training manual, Figure 5-4 (public domain). https://enginemechanics.tpub.com/14345/Figure-5-4-Standard-Marking-System-For-Grinding-Wheels-Except-Diamond-103.html
- **[HST]** High Speed Training, "Understanding the marking system for abrasive wheels" (2016, updated 2023). https://www.highspeedtraining.co.uk/hub/?p=6487 . Commodious (commodious.co.uk) prints the same lists word for word, so it is not counted as a second source.
### Findings (from `scripts/build_refdata.py`)
- Grit sizes are shown per system with the value each publisher prints and a badge; they are not averaged. Coated-abrasive gradings (P, ANSI/CAMI) and bonded gradings (F) differ, and the screen says so. ANSI: 6 confirmed, 10 differ, 9 single source; FEPA F: 2 confirmed, 3 differ, 23 single source; FEPA P: 9 confirmed, 8 differ, 11 single source.
- Marking: abrasive letters 5 confirmed, 20 maker-specific or single source, 1 differs (AZ: zirconia [HST], blue aluminium oxide [CGW]). Bond letters 4 confirmed, 4 single source, 2 differ (E: shellac [UNITED], epoxy [HST]; O: oxychloride [UNITED], magnesia [HST]). Grit groups: coarse 8-24 [UNITED][CGW] against 10-24 [NAVY]; fine 70-180 [UNITED][NAVY] against 80-180 [CGW].
- Not used: Gritomatic, metallographic.com and several PDF grit charts (images, scrambled text, or no clear primary source).

## Measurement and shop maths (`core/src/measure.rs`, `core/src/units.rs`, `core/src/expr.rs`, `app/maths.js`, `data/refdata/iso2768-evidence.json`, `data/refdata/abbrev-evidence.json`)
Web sources accessed 2026-11-11 unless stated. Book titles are cited by name only; nothing is copied from them.
### Formulas and worked examples
- **Ball in a countersink or tapered bore** (`ballcone`): own derivation (a circle tangent to both flanks of the cone section): h = r + r / sin a - D / (2 tan a), inverse D = 2 (r / cos a - (h - r) tan a), two balls sin a = (r2 - r1) / (c2 - c1). Checked against an independent form of the same relation, M. Biegert, "Measuring Countersink Diameter Using Gage Balls", Math Encounters blog, Sept 2014, Eq. 2 D = B / cos(A/2) + (B - 2H) tan(A/2). https://mathscinotes.com/2014/09/measuring-countersink-diameter-using-gage-balls/ . Round trips (two balls placed in a constructed bore give back its angle and diameter) in the tests. Machinery's Handbook, "measuring tapers with balls" (by name).
- **Taper over rolls** (`taperrolls`): own derivation; M = D_H + d (1 + tan(45° + a/2)), identical to 1 + tan a + sec a (checked in a test) and to the handbook form with cot ½(90° - a) (Machinery's Handbook, "measuring tapers with rolls", by name). Two-height relation tan a = (M2 - M1) / (2 (H2 - H1)) checked against the worked set-up in NIMI, CITS Fitter Trade Theory, p. 113 (rollers 61.5 mm and 69.3 mm on 70 mm slip gauges; included angle 6.3778° computed by us). https://nimi.co.in/cits_ebooks1/Fitter/Fitter_Trade_Theory/files/basic-html/page113.html
- **Shrink and press fits** (`shrinkfit`): linear expansion dL = alpha L dT; temperature for a growth dT = (i + c) / (alpha d) (own rearrangement). Press fit: Lame thick-walled cylinders, contact pressure from diametral interference with two materials and a hollow shaft, hub hoop stress at the bore, holding torque mu p pi d² L / 2 and axial force mu p pi d L (the forms in Shigley's Mechanical Engineering Design, interference fits, by name). Hub hoop stress checked against Engineers Edge, "Interference Press Fit Cylinder Design Calculator" (PDF), Eq. 13: p = 3.000, do = 2.0000 in, contact 1.5050 in gives 10.83305. https://engineersedge.com/graphics/Interference-Press-Fit-Calculator.pdf . Same-material, solid-shaft special case p = E delta (do² - d²) / (2 d do²) in the tests. Expansion coefficients, E, Poisson's ratio and friction are always the user's entries; the picker lists only CTE values with status "confirmed" (two publishers agree) from `data/materials.json` (none at the time of writing).
- **Compound angles** (`compound`): own derivation by rotating the face normal n = (sin C cos b, sin C sin b, cos C). Apparent angles tan ax = tan C cos b, tan ay = tan C sin b (so tan C = sqrt(tan² ax + tan² ay)); two successive tilts (about X, then about the tilted Y) n = (sin a2, sin a1 cos a2, cos a1 cos a2), cos C = cos a1 cos a2. Tests: 30°/30° apparent = 39.2315° (= atan sqrt(2/3)), 30° then 30° tilted = 41.4096° (= acos 0.75), and round trips. Machinery's Handbook, "compound angles" (by name).
- **Lathe change gears** (`changegears`): ratio needed = target lead / (leadscrew lead x fixed ratio); every simple pair and compound four of different gears from the user's list is tried and sorted by relative error. 127 = 5 x 25.4 follows from the inch defined as 25.4 mm (NIST SP 811). Tests: 1.5 mm on an 8 TPI leadscrew needs 60/127 exactly; 0.7 mm needs a compound train. Machinery's Handbook, "lathe change gears" (by name).
- **Shop economics** (`economics`): capital recovery factor CRF = i(1+i)^n / ((1+i)^n - 1), yearly capital cost (P - S) CRF + S i, present value of an annuity (1 - (1+i)^-n) / i, discounted payback n = -ln(1 - I i / A) / ln(1 + i), break-even = fixed / (price - variable): standard engineering-economy interest formulas (Machinery's Handbook, "engineering economics", by name). CRF(10 %, 5 years) = 0.2637975 checked in the tests and recomputed independently (Python) during development. No default prices, rates or lives.
- **Plane figures and solids** (`figures`): standard mensuration formulas (Machinery's Handbook, "areas and volumes", by name). Polygon side = AF tan(180°/n), AC = AF / cos(180°/n). Torus by Pappus' theorem. Ellipse perimeter: Ramanujan's second approximation (S. Ramanujan, "Modular equations and approximations to pi", Quart. J. Math. 45, 1914, by name); our test value 24.2211206 for axes 10 and 5 was checked by numerical integration of the complete elliptic integral (24.22112055, 200 000-step midpoint rule) during development.
- **Calculator** (`calc`, `core/src/expr.rs`): our own recursive-descent parser; precedence as in common mathematical convention (power right-associative, above unary minus, so -2^2 = -4). Functions are the Rust standard library's IEEE 754 double-precision routines. Involute inv a = tan a - a; test value inv 20° = 0.0149044 (recomputed in Python: 0.01490438). Input is limited to 1000 characters and 64 nesting levels; unknown names are an error; nothing is evaluated as code.
- **Micrometer and vernier reading** (`scales`): resolution and scale layout per kind in `scale_spec`. Tests reproduce the worked readings in Mitutoyo, *Quick Guide to Precision Measuring Instruments*, catalogue E11003(7) (7.37 mm micrometer, 6.213 mm vernier micrometer, 16.15 mm 0.05 mm caliper), https://mitutoyo.com/webfoo/wp-content/uploads/E11003-Quick-Guide.pdf , and Precision Graphic Instruments, "How to read an outside micrometer" (.226 in and .2262 in), hosted at https://www.me.psu.edu/cimbala/me345/Lectures/Labs/Basic_statistics/How_to_read_micrometer.pdf . MSC Industrial Supply, "What Is a Micrometer & How to Use One" (40 TPI spindle, 25 thimble divisions of 0.001 in), https://www.mscdirect.com/resources/buying-guides/outside-micrometers . Drawings are our own, schematic, not copies of any maker's scale. Machinery's Handbook, "reading verniers and micrometers" (by name).
### Unit converter (`units`, `core/src/units.rs`)
- **[SP811]** A. Thompson, B. N. Taylor, *Guide for the Use of the International System of Units (SI)*, NIST Special Publication 811, 2008 edition, Appendix B.8 and B.9 ("factors in boldface are exact"). https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9 . Every factor is built from exact definitions only: inch 0.0254 m, foot 0.3048 m, pound 0.453 592 37 kg, standard gravity 9.806 65 m/s², US gallon 231 in³, UK gallon 4.546 09 L, calorie (thermochemical) 4.184 J and (IT) 4.1868 J, Btu (IT) 1055.055 852 62 J, standard atmosphere 101 325 Pa, horsepower 550 ft·lbf/s, °F to K (t + 459.67)/1.8. Tests compare 18 factors with the 7-digit values printed in B.9 (lbf 4.448 222, psi 6.894 757 E+03, lbf·ft 1.355 818, lbf·in 1.129 848 E-01, hp 7.456 999 E+02, Btu/h, US gallon, mmHg 1.333 224 E+02, inHg 3.386 389 E+03, inH₂O 2.490 889 E+02, lb/in³ 2.767 990 E+04, slug 1.459 390 E+01 and others). mmHg, inHg and inH₂O are SP 811's conventional values (marked "conventional" in the app).
### ISO 2768-1 general tolerances (`gentol`, `data/refdata/iso2768-evidence.json`)
- Standard: ISO 2768-1:1989, edition 1 (1989-11). iso.org shows it as published, last reviewed and confirmed in 2022, stage 90.92 (to be revised), no replacement named. https://www.iso.org/standard/7748.html (checked 2026-11-11). ISO 2768-2 (geometrical) is withdrawn and replaced by ISO 22081 (see the GD&T sources).
- Publishers (values as printed, signs dropped, angles converted to minutes): AmesWeb https://amesweb.info/fits-tolerances/iso-2768-linear-dimensions-tolerances.aspx ; Star Rapid https://cdn2.starrapid.com/wp-content/uploads/2023/09/General_Tolerances-DIN-ISO-2768.pdf ; Modulus Metal https://www.modulusmetal.com/iso-2768-1-and-iso-2768-2-tolerances ; CamCut Group https://www.camcut-group.com/en-us/support/instructions/measuring/general-tolerances/general-tolerances-for-linear-dimensions/ ; Wevolver https://www.wevolver.com/article/iso-2768-general-tolerances-tables-classes-current-status .
- Findings: all 32 linear cells (4 or 5 publishers), 12 broken-edge cells and 20 angular cells are confirmed by at least two publishers; no disagreements. Several publishers print merged columns (f with m, c with v); where the merged header names both classes the value is recorded for both, otherwise only the classes shown are recorded (notes in the evidence file).
### Drawing abbreviations (`abbrev`, `data/refdata/abbrev-evidence.json`)
- Standards (by name only): ASME Y14.38-2019, *Abbreviations and Acronyms for Use in Product Definition and Related Documents* (asme.org lists 2019 as the edition in effect, stabilized maintenance), https://www.asme.org/codes-standards/find-codes-standards/y14-38-abbreviations-acronyms-use-drawings-related-documents ; ISO 128-1:2020, *Technical product documentation (TPD) - General principles of representation - Part 1* (edition 2, published, confirmed 2026), https://www.iso.org/standard/65296.html .
- Publishers: Wikipedia, "Engineering drawing abbreviations and symbols", https://en.wikipedia.org/wiki/Engineering_drawing_abbreviations_and_symbols ; Bureau of Indian Standards, IS 11670:1993 *Technical drawings - Abbreviations and symbols for use in technical drawings*, Table 1, via Public.Resource.Org, https://law.resource.org/pub/in/bis/S01/is.11670.1993.pdf .
- BenchMate's list (65 entries) and wording are our own; 34 are listed by both publishers with the same meaning, 31 by one (shown as "One source"). Wikipedia prints DRG (not DWG) and EQS; IS 11670 prints EQUI SP and SFACE. Weld symbols are not covered.
