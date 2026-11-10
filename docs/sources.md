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
