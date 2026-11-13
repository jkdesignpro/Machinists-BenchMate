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
- **[EZDXF]** ezdxf 1.4.5 (MIT), https://ezdxf.mozman.at/ : independent reader used to load and audit the generated files (`scripts/check_dxf.py`); not a source of code. Since 0.4.0 the files are also opened in LibreCAD, Inkscape and OpenSCAD (`scripts/check_dxf_cad.py`).
- Regular polygon relations: [MH] (regular polygons); bolt circle: [MH] (hole circles).

## Angle forms in the unit converter (`core/src/units.rs`, `app/maths.js`)
All accessed 2026-11-11.
- Exact factors: degree = pi/180 rad, gon = pi/200 rad, minute and second of arc (NIST SP 811 Appendix B, as for the other units).
- Slope: percent = 100 tan(a), "1 in n" with n = 1 / tan(a), a from the horizontal. Wikipedia, "Grade (slope)", https://en.wikipedia.org/wiki/Grade_(slope) (examples 45 deg = 100 %, 5.71 deg = 10 % = 1 in 10, used in a test). Second source: the same relation is the definition of the tangent (OpenStax, cited above); no second slope-specific page was read.
- Taper: rate of taper C = (D - d) / L = 2 tan(a/2) = 1 : (1/2) cot(a/2), a the included angle. ISO/R 1119:1969 public preview, https://cdn.standards.iteh.ai/samples/393/59b5e966c1344a30b4189b766d61e88e/ISO-R-1119-1969.pdf (1:20 = 2 deg 51' 51.1", used in a test; current edition ISO 1119:2011, cited by name). Taper per foot = 12 (D - d) / L: Omni Calculator, "Taper calculator", https://www.omnicalculator.com/construction/taper (worked example half angle 80.5 deg, taper 11.952, used in a test); Machinery's Handbook, tapers (by name). NPT check: 3/4 in per foot is a half angle of 1 deg 47' 24" (Wikipedia "National pipe thread").

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
- **Suggested engagement (tap drill slider, added 2026-11-11):** 75 % for cutting taps and 65 % for forming taps, the defaults of the 55 to 85 % slider.
  - Cutting, 75 %: USCTI, "Tapping tip: Don't let percent of thread derail your part" (https://www.uscti.com/uscti-pages/Tapping%20Tip-Don't%20Let%20Percent%20of%20Thread%20Derail%20Your%20Part.pdf, accessed 2026-11-11): 75 % is the general rule for 2B / 3B, a little higher in soft and lower in hard material, not less than 65 % in holes shallower than 3 x D. FM Carbide (tapping formulas page above, read again 2026-11-11): cut taps 65 to 75 %, calculator default 75 %.
  - Forming, 65 %: Besly Products in Cutting Tool Engineering, "Threads will roll" (1995, https://ctemag.com/articles/threads-will-roll/): 65 to 75 % is adequate, worked example 1/4-20 at 65 % = 0.2280 in, not above 75 %. FM Carbide: form taps 60 to 65 % in steel, stainless and ductile alloys. North American Tool gives 55 to 75 %.
  - The two sources for each figure give ranges that include it rather than one identical number; the app says so and shows the ranges.
  - Nearest drills per series (number, letter, fractional, metric) are looked up in the drill chart data; the engagement each gives is computed with the cut and form formulas above.
- **Rule of thumb "tap drill = D - P":** checked against the formula, it gives about 77 % thread. The app labels it as an approximation.
- **Forming taps:** hole = D - 0.0068 x % x P, as published by FM Carbide (above) and Engineers Edge (both accessed 2026-11-10):
  - https://www.engineersedge.com/calculators/theoretical_tapping_hole_size_16209.htm
  - https://www.engineersedge.com/calculators/hole_sizes_cold_form_tapping_metric_threads_16210.htm
  - Confirmed by two forming tap makers on 2026-11-11: North American Tool (TRU-FLO engineering data, 0.0068 and 147.06) and Besly Products (Cutting Tool Engineering, 1995). See the tooling reference section.

- **Forming taps against a tap maker:** Balax, a maker of thread forming taps, publishes "A Balax, Inc. Guide to Tapping in the 21st Century" (2011/2012). It prints hole sizes for 75, 65 and 55 % thread on p. 3 (0-80 to 3-48) and p. 20 (M0.7 to M1.4). Copy read at https://powelltoolsupplyinc.assets-ascend-prod.roccommercecloud.com/assets%2FProduction%2Fc43a93116cca1ca5638577fadbf11477/Balax_10725_Catalog.pdf (accessed 2026-11-10).
  - Balax does not state a formula.
  - Its holes are 0 to 0.0016 in larger than D - 0.0068 x % x P gives; one cell is 0.0002 in smaller (test `form_tap_vs_balax`).
  - The 0.0068 rule is therefore labelled a rule of thumb, and the app tells users to use the tap maker's recommended hole.
  - (2026-11-11) North American Tool and Besly state the formula; Balax still prints larger holes for miniature sizes.

### Centre drills (`data/refdata/centredrills-evidence.json`, spot and centre drill tool)
All accessed 2026-11-11. Inch fractions are stored as exact decimals; consensus as for drills (inch: agree at the coarser printing; metric: agree only when equal).
- **Inch plain type (#000 to #10, 60 deg; 82 and 90 deg in #1 to #8):** ICS Cutting Tools catalogue p. 114 (https://www.icscuttingtools.com/catalog/page_114.pdf); Greenfield Industries (Cleveland) style 217 via ME Campbell (https://www.mecampbell.com/media/pdf/GREENFE00009_131.pdf); Michigan Drill catalogue 582 (body and drill diameter only); Linear Tools data sheet LDS 1082 via Farnell (https://www.farnell.com/datasheets/2804844.pdf).
  - Body and pilot diameters: confirmed by two to four publishers for every size.
  - Pilot length: ICS and Greenfield agree for #1 to #8 (length = pilot diameter). #00 (.025 vs .030) and #0 (1/32 vs .038) differ. #000, #4-1/2, #9 and #10 lengths are single-source (ICS). Linear Tools (UK, BS 328 practice) prints longer pilot lengths for every size; shown as an outlier.
  - ICS prints the #00 drill diameter as "0.25", a misprint for .025 (its drill length column and the other makers print .025); recorded as .025 with a note.
- **Inch bell type (#11 to #20, 60 deg with a 120 deg bell chamfer):** Greenfield style 217B; Exact Tooling (https://exacttooling.com/pages/cuttingtools-solidround-combineddrills-countersinks-belltype); Michigan Drill list 587; Linear Tools. #11 to #18 confirmed by three; #20 by two (Exact, Michigan); #19 single-source (Exact). Linear Tools differs on pilot lengths and on the #14 pilot (1/8 vs 7/64).
- **Metric type A (ISO 866 / DIN 333 A):** ZPS-FN form A page (https://zps-fn.cz/en/drills/detail/centre-drills-60-form-a,-din-333a,-high-speed-steel-hss) and Linear Tools. Body, pilot and smallest pilot length confirmed for all sizes both print (Linear has no 8 mm); the largest pilot length is ZPS only.
- **Metric type B (ISO 2540):** the public preview of ISO 2540:2016 Table 1 (https://cdn.standards.iteh.ai/samples/64194/2a14d980bea94904bca92bcfb2a6daf7/ISO-2540-2016.pdf); the 1973 edition preview prints the same numbers but is the same standard. TECWERK confirms only the 3.15 mm shank (11.2 mm). Everything else is single-source.
- **Metric type R (ISO 2541):** the public preview of ISO 2541:2016 Table 1 and the ZPS-FN form R page. Pilot and body diameters confirmed; radius limits single-source and read from a text extract whose headings were misaligned (to be checked against the printed table). The depth for a countersink diameter is not computed for type R.
- Not found in a free source: where the makers measure the pilot length from (tip, or the parallel part only). The tool assumes from the tip and shows the point length to add otherwise.
- Standards cited by name: ISO 866:2016, ISO 2540:2016, ISO 2541:2016, DIN 333:1986 (60 deg centre drills, types R, A and B).

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
- j and J and sizes over 500 mm: added in inspection round 2; sources and findings in `docs/inspection.md` (section 2). Over 500 mm: Wikipedia "IT Grade" (IT1-IT18) and GOST 25346-89 Table 2 (d to u) and Table 3 (holes, https://dnaop.com/html/65935_3.html), each checked against the ISO 286-1 annex formulas (I = 0.004 D + 2.1); j5-j7 from Simply Bearings and RoyMech, J6-J8 from Simply Bearings and GOST 25346 (all accessed 2026-11-11).

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

## Threads round 3: ACME, Stub ACME, trapezoidal, buttress, UNJ, UNR, UNM, UN constant pitch, STI, coatings, wires (`data/refdata/threads-power-evidence.json`, `core/src/power_threads.rs`, `app/threads3.js`)
Same evidence model as above: series and published limits are transcribed per publisher; every dimension is computed by the Rust core and the tests compare it with printed rows. Wording and tables are our own; no book or standard text is reproduced.

### Standards cited (current editions, checked on the standards bodies' pages on 2026-11-11)
- ASME B1.5-1997 (R2024), Acme screw threads (general purpose and centralizing). asme.org lists it as reaffirmed 2024 and on stabilized maintenance: https://www.asme.org/codes-standards/find-codes-standards/b1-5-acme-screw-threads
- ASME B1.8-1988 (R2021), Stub Acme screw threads: https://www.asme.org/codes-standards/find-codes-standards/b1-8-stub-acme-screw-threads
- ASME B1.9-1973 (R2025), Buttress inch screw threads, 7/45 form with 0.6 pitch basic height of thread engagement: https://www.asme.org/codes-standards/find-codes-standards/b1-9-buttress-inch-screw-threads-7-45-form-0-6-pitch-basic-height-thread-engagement
- ASME B1.15-1995, Unified inch screw threads, UNJ thread form: asme.org says it is on stabilized maintenance and "has been incorporated into B1.1-2019" (https://asme.org/codes-standards/find-codes-standards/b1-15-unified-inch-screw-threads-unj-thread-form-errata). The current B1.1 is the 2024 edition (see above).
- ASME B1.10M-2004, Unified miniature screw threads (edition as named by Thread Check; AMESweb names the 1997 edition). Not checked on asme.org in this session.
- ASME B1.20.3-1976 (R2023), Dryseal pipe threads (inch): https://www.asme.org/codes-standards/find-codes-standards/b1-20-3-dryseal-pipe-threads-inch
- ISO 2904:2020 (edition 2), ISO metric trapezoidal screw threads, basic dimensions; iso.org shows it confirmed in 2025: https://www.iso.org/standard/78729.html
- ISO 2903 (tolerances): iso.org lists ISO 2903:1993 as withdrawn (https://www.iso.org/standard/7938.html); BSI lists BS ISO 2903:2016 as the current adoption. ISO 2901:2016 (basic profile) as listed by iTeh. Trapezoidal tolerances are not computed.
- NASM33537 (inch) and MA1567 (metric) are the insert specifications the makers name for STI tapped holes; not read.

All publisher pages below were accessed 2026-11-11.

### Publishers
- **[NBS_H28]** National Bureau of Standards, Handbook H28 (1957) Part III, https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook28supp1957pt3.pdf (US government, public domain; used for ACME and Stub ACME formulas only).
- **[TORQ_ACME]** Torqbolt, Unified ACME threads, https://torqbolt.com/unified-acme-threads-dimensions-specifications ; **[TORQ_STUB]** Torqbolt, Stub ACME, https://torqbolt.com/stub-acme-dimensions-specifications ; **[TORQ_UNJ]** Torqbolt, UNJC threads, https://torqbolt.com/unjc-unified-coarse-threads-aerospace-fasteners ; **[TORQ_UN]** Torqbolt, diameter-pitch combinations, https://mail.torqbolt.com/pitch-diameter-combinations-un-unr-thread-series
- **[MD_ACME]** MachiningDoctor, ACME charts and formulas, https://machiningdoctor.com/charts/acme , and the 2-4 ACME page https://www.machiningdoctor.com/threadinfo-acme?tid=5014
- **[RM_TR]** RoyMech, metric trapezoidal threads, https://roymech.org/Useful_Tables/Screws/Trapezoidal.html ; **[ETB_TR]** The Engineering ToolBox, https://www.engineeringtoolbox.com/trapezoidal-metric-screw-threads-d_2042.html
- **[AMES_BUTT]** AMESweb, buttress thread chart, https://amesweb.info/Screws/buttress-thread-chart-calculator.aspx ; **[AMES_UN]** AMESweb, thread pitch chart, https://amesweb.info/Screws/Tables/Thread-Pitch-Chart-UNC-UNF-UNEF-UN.aspx ; **[AMES_UNM]** AMESweb, unified miniature threads, https://amesweb.info/Screws/unified-miniature-screw-threads.aspx
- **[RPG_UNJ]** Gage Crib Worldwide (ring-plug-thread-gages.com), UNJ vs UN, https://ring-plug-thread-gages.com/ti-UNJ-vs-UN.htm
- **[TC_UNR]** Thread Check Inc., UNR screw thread form, https://www.threadcheck.com/unr-screw-thread-form/technicalinfo/ ; **[TC_UNM]** Thread Check, UNM per ASME B1.10M-2004, https://www.threadcheck.com/unified-miniature-screw-threads-per-asme-b1-10m-2004/technicalinfo/ ; **[TC_PLATE]** Thread Check, pre-plate gauges, https://www.threadcheck.com/calculating-pre-plate-screw-threads-gages/technicalinfo/ ; **[TC_WIRE]** Thread Check, approximate formulas for measured pitch diameter, https://www.threadcheck.com/approximate-formulas-for-measured-pitch-diameter/technicalinfo/
- **[RECOIL]** Alcoa Fastening Systems, Recoil catalogue p. 25, https://www.newmantools.com/sti/Recoil2007ntCatalog.pdf ; **[KATO]** Kato Fastening Systems catalogue (2003) pp. 10, 12, https://www.hardwarespecialty.com/products/pdf/vendor_kato_tang_tangless_catalog.pdf ; **[KATO_PLATE]** Kato, "The effects of plating", https://katofastening.com/article/effectsplating.html ; **[VARGUS_HC]** Vargus, Heli-Coil drilling and thread data, https://vargen.vargus.com/VargusGenWeb/help/helicoil.pdf
- **[WIKI_NPT]** Wikipedia, National pipe thread (NPTF section), as above.

### Findings
- **ACME general purpose.** Formulas confirmed in [NBS_H28] and [MD_ACME]; the major and minor rules also in [TORQ_ACME]: allowance es = 0.008, 0.006, 0.004 sqrt D (2G, 3G, 4G); pitch diameter tolerance 0.030 sqrt P + 0.006 sqrt D (2G), 0.014 sqrt P + 0.0028 sqrt D (3G), 0.010 sqrt P + 0.002 sqrt D (4G); clearance 0.020 in at 10 TPI and coarser, 0.010 in finer; screw major and nut minor tolerance 0.05 P (at least 0.005 in); screw minor tolerance 1.5 x pitch diameter tolerance.
  - The 2-4 rows of [MD_ACME] for 2G, 3G, 4G, 2C, 3C and 4C are reproduced exactly (36 values), but only when the allowance and pitch diameter tolerance are rounded to 0.0001 in before they are applied, while the minor tolerance uses the unrounded value. For 3G the order matters: unrounded gives 1.8556, the table prints 1.8555.
  - Two constants on the MachiningDoctor formula page are misprinted (0.002 for 0.020 in, TPI/20 for P/20) and its class labels repeat "3C"; the values on its 2-4 page agree with the standard's rules.
  - Centralizing major diameter rules (screw tolerance 0.0035, 0.0015, 0.0010 sqrt D; nut from D + 0.001 sqrt D with tolerance 0.0035 or 0.0020 sqrt D) come from one size of one publisher; the H28 scan of that table was unreadable. The nut minor minimum K + 0.1 P is confirmed by [NBS_H28] and [MD_ACME].
  - Basic dimensions and lead angles of 23 sizes from [TORQ_ACME] fit the formulas; Torqbolt prints 0.18535 as 0.1853 and Stub 0.23125 as 0.2312 (round half to even or cut).
  - Series (TPI per size) has one full publisher; MachiningDoctor confirms only 2-4. Shown as "One source".
  - Not included: classes 5G, 5C, 6C (appendices), multi-start and long-engagement allowance increases.
- **Stub ACME.** h = 0.3 P, flat 0.4224 P, minor D - 0.6 P in [NBS_H28] and [TORQ_STUB]; class 2G allowances and tolerances per [TORQ_STUB]. The 0.005 in floor on the 0.05 P crest tolerances is taken from the general purpose rule (Torqbolt says the major and minor allowances match general purpose). Modified forms 1 (0.375 P) and 2 (0.25 P) are not included.
- **Trapezoidal.** Profile formulas from [RM_TR]; clearances ac and the nut crest 0.366 P from [ETB_TR]; 8 rows of d2, D4, d3, D1 reproduced. ac = 1 mm for P 14 to 44 is stated in the profile rule but no printed row with such a pitch was checked. RoyMech's Tr 32 x 6 nut major was read as 32.500, against 33.000 from its own d3; the row is left out.
- **Buttress 7/45.** Constants from [AMES_BUTT]. Each one is derived again in the core from the angles, h = 0.6 P (the standard's title) and r = 0.07141 P, and agrees to 0.00005 P. Allowances and tolerances are not published in a free source found here; only maximum material dimensions are given.
- **UNJ.** Root radius 0.15011 P to 0.18042 P in [TORQ_UNJ] and [RPG_UNJ]. The internal minor minimum D - 0.974279 P and the screw minor diameters (E - 2 (H/2 - r), with E max and r max, E min and r min) reproduce the four UNJC 3A/3B rows of [TORQ_UNJ] (printed in mm to 0.01 after the inch limits are rounded to 0.0001 in). This minor diameter rule is our derivation from the root geometry; one publisher's rows check it.
- **UNR.** [TC_UNR] quotes ASME B1.1 para. 2.3.1: radius not less than 0.10825318 P, tangency point at least 0.625 H below the basic major diameter, external only. No second free source states the numbers; the UNR minor diameter limits are not computed.
- **UN constant pitch.** 8-UN, 12-UN, 16-UN membership 1 to 2 in is the same in [AMES_UN] and [TORQ_UN]; the smaller sizes (12-UN from 9/16, 16-UN from 5/16) are from AMESweb only. AMESweb prints the number where Torqbolt prints UNC or UNF for the same pitch; the app takes the designation from its UNC/UNF table.
- **UNM.** Basic and design diameters of all 14 sizes agree between [TC_UNM] and [AMES_UNM] except two AMESweb values: 1.00 UNM external pitch diameter max 0.839 (basic 0.838) and 0.50 UNM internal minor min 0.390 (its own max less tolerance is 0.380). Both are shown as Sources differ. The limits of size have one source.
- **STI.** The tapped thread equals the nominal thread with each diameter larger by 1.299038 P: major min D + 1.299038 P (Recoil, 7 sizes), pitch min D + 0.649519 P (Recoil 7 sizes, Heli-Coil per Vargus 1/4-20 and M10), minor min D + 0.216506 P (Recoil, Kato inch and metric, Vargus). Recoil prints 1/2-13 pitch min .5499 against .54996, and Kato and Vargus print M10 minor 10.324 against 10.3248.
  - Disagreements: 1/4-20 class 2B pitch max .2863 (Recoil) against .2864 (Heli-Coil per Vargus); 4-40 minor max .122 (Recoil) against .1252 (Kato); 10-24 minor max .205 against .2080. These are shown side by side.
- **Coatings.** "Four times the coating thickness" on a 60 degree pitch diameter is stated by [TC_PLATE] and [KATO_PLATE]; the Thread Check 1/2-20 worked example is in the tests. The general 2 t / sin(a/2) is geometry; Kato's doubling for coated inserts is shown.
- **Wires.** Best wire P / (2 cos(a/2)) and M = E + w (1 + 1/sin(a/2)) - (P/2) cot(a/2) reduce to the constants [TC_WIRE] prints (0.57735, 0.56369, 0.51645; 3 / 0.86603, 3.16568 / 0.96049, 4.9939 / 1.933357). Lead angle is ignored; Thread Check limits these approximate formulas to lead angles up to 5 degrees.
- **NPTF.** Notes only, from the ASME B1.20.3 catalogue page and [WIKI_NPT]; truncation limits and classes are not given.
- Not included: Whitworth tolerances, British and metric buttress forms, metric MJ, ISO miniature, NPSM/NPSL, the trapezoidal tolerance grades.

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
- ISO 3364 (indexable hardmetal inserts with rounded corners, with cylindrical fixing hole: dimensions). Current edition ISO 3364:2017 (iso.org/standard/69204.html, listing seen 2026-11-11), **not read**. Read: the public preview (pages 1 to 9) of the third edition, **ISO 3364:1997**, see [ISO3364] below.

### Insert outline to scale (`insertcode`, `core/src/insert.rs`), accessed 2026-11-11
- **Geometry:** every ISO insert shape with equal sides has an inscribed circle touching every side, and its angle bisectors meet at the centre of that circle (Wikipedia, "Tangential polygon", https://en.wikipedia.org/wiki/Tangential_polygon ; Wolfram MathWorld, "Incircle", https://mathworld.wolfram.com/Incircle.html ). From the right triangle between the centre, a corner and a tangent point: corner at (d/2) / sin(a/2) from the centre, tangent point 90 - a/2 degrees round from the corner; a radius r meets each side r / tan(a/2) from the sharp corner and its tip sits r (1/sin(a/2) - 1) back. Own algebra, with core tests: every straight touches the inscribed circle, every arc has radius r and its centre on the bisector, side lengths equal the edge length formula, and the area equals the closed form.
- **[ISO3364]** ISO 3364:1997, public preview, https://cdn.standards.iteh.ai/samples/23733/1b8d97bdd1584c9b94ec6a034fee61a1/ISO-3364-1997.pdf . Used three ways. (1) **Check values:** the corner heights m printed in tables 2, 3 and 5: triangular d 9.525: 13.891, 13.494, 13.097; d 12.7: 18.256, 17.859, 17.463; d 15.875: 22.622, 22.225; square d 9.525: 1.808, 1.644; d 12.7: 2.466, 2.301, 2.137; d 25.4: 4.274; rhombic 55 degree d 12.7: 6.939, 6.477, 6.014, 5.552. The core reproduces all 18 to 0.001 mm with m = (d/2 - r)(1/sin(a/2) - 1) (triangle: 3d/2 - r) **when r is the inch radius** (code 04 = 1/64 in = 0.397 mm, 08 = 1/32 in = 0.794, 12 = 3/64 in = 1.191, 16 = 1/16 in = 1.588, 24 = 3/32 in = 2.381). With the nominal 0.4, 0.8, 1.2 ... the result differs by up to 0.008 mm; the page uses the nominal radius of the code and says so. The text layer of the preview's tables is scrambled, so the values were matched to their inserts by size and radius, not by row; the definition of m (Annex B) is not in the preview, and "nose tip beyond the inscribed circle, triangle: above the opposite side" is what the 18 values fit. m is not shown for pentagon, hexagon, octagon and trigon inserts, where nothing printed could be checked. (2) **Type letters:** the standard covers inserts with cylindrical fixing hole and 0 degree clearance, type A without chip breakers, M with chip breakers on one face, G on both faces. (3) **Fixing hole d1** (Table 1, tolerance +0.08): d 6.35: 2.26; 9.525: 3.81; 12.7: 5.16; 15.875: 6.35; 19.05: 7.94; 25.4: 9.12.
- **[TUNGALOY]** Tungaloy general catalogue 2023-2024, section B, CNMG dimension table, https://tungaloy.com/wpdata/wp-content/uploads/GC_2023-2024_G_B_Insert.pdf : D1 3.81 for IC 9.525 and 5.16 for IC 12.7 (second source for those two hole sizes; the other four are ISO 3364 only and marked one source). Only the first part of the file could be read.
- **BenchMate's own choices:** how each shape is turned on the page; the section taken across the inscribed circle; the hole drawn as a dashed circle of 0.4 d where no table gives its size; chipbreakers, edge preparation and wiper flats not drawn.

### Text engraving (`engrave`, `core/src/engrave.rs`, `data/fonts/hershey/`), accessed 2026-11-12
- **Letters:** the Hershey fonts as SVG font files, copied unchanged from the Inkscape 1.2.2 package. Use notice and acknowledgements (Dr. A. V. Hershey; data format by James Hurt, Cognition, Inc.; SVG fonts prepared by Windell H. Oskay) are inside each file and in `data/fonts/hershey/README.md`. The same notice is on the Fedora licensing wiki, https://fedoraproject.org/wiki/Licensing/HersheyFontLicense . The README of the upstream collection (gitlab.com/oskay/svg-fonts) could not be read.
- **Line width of a pointed cutter:** BenchMate geometry, checked against the FlatCAM wiki groove table (https://bitbucket.org/jpcgt/flatcam/wiki/V-Shaped_bits__Groove_Dimension_Tables : 60 degrees, 0.1 flat, 0.05 deep, 0.158) and the Calculator Academy chamfer example (https://calculator.academy/chamfer-diameter-calculator/ : 82 degrees, 5.0 to 9.4, 2.53 deep). Both are core tests.
- **Program words:** as for the drilling cycles, see `docs/cycles.md`.
- **BenchMate's own choices:** the height is measured on the capital H; curves in 10 pieces; text round a circle by angle = distance / radius; strokes inside a letter taken nearest end first. See `docs/engraving.md`.

### Rotary axis helper (`rotpoint`, `rotfeed`, `core/src/rotary.rs`), accessed 2026-11-12
- **Axis names and directions:** ISO 841:1974, public preview, https://cdn.standards.iteh.ai/samples/5211/54d3a19b58444bb19d13c750347dad9a/ISO-841-1974.pdf (clauses 2.1, 2.6, 6.1, 6.2, 10: A, B, C about X, Y, Z by the right-hand screw rule, stated for the tool relative to the work; the scan is partly garbled). BobCAD-CAM help, "Understanding the right-hand rule", https://bobcad.com/components/webhelp/BCC/Content/Merge/CAM/Undertanding_RightHandRule.htm (the same rule, and that builders do not always follow the standard direction).
- **Rotation about an axis:** MathWorks documentation, `rotx`, https://www.mathworks.com/help/phased/ref/rotx.html (worked example rotx(30) on (2, -2, 4), a core test and the page's proof); Wikipedia, "Rotation matrix" (direction of a positive turn; the matrices themselves did not come through when read).
- **Feed of a rotary block:** Fadal user manual, section 12 "Rotary axes", https://itscnc.com/pub/media/documents/fadal_manuals/user_manual/Sect_12_Rotary_Axes.pdf (move distance, degrees per minute, inverse time feed, worked example 4.3439 / 517.97 / 5.755); Industrial Monitor Direct, https://industrialmonitordirect.com/blogs/knowledgebase/cnc-rotary-axis-feedrate-sync-with-linear-axis-g-code (the same distance formula, example 6.288 in and 3.144 min); CNC Cookbook, https://cnccookbook.com/feed-rate-mode-g-codes-g93-g94-and-g95 (a G93 block takes 1/F minutes, F on every cutting block); Haas UK, https://www.haas.co.uk/?p=1329 (60 / F seconds); RapidRotary README, https://github.com/sgano/RapidRotary (90 degrees per minute is 4 minutes a turn). All are core tests.
- **Disagreement, shown and not used:** two lines on the Industrial Monitor Direct page (2,880 degrees per minute; a G93 block with F3.144) do not follow from its own formula or from the G93 rule in the other three sources. See `docs/rotary.md`.
- **Not read:** the G93 section of the LinuxCNC G-code reference (not in the text that came back).
- **BenchMate's own choices:** the direction of a positive angle is a box (table carries the part by default), with a row telling the user to check by jogging; no G94 feed word is printed for a block that turns and moves, because controls read it differently and only the Fadal reading has a source.

### G-code snippets (`app/snippets.js`, `gcode::gen_words`, the snippet of every generator)
- No new sources. A snippet is the cycle blocks of the program the generator already writes, so its formats and sources are those in `docs/cycles.md`. The spindle and feed words use S, M03, G97, G96 with G50 S, G98 and G99 (lathe, G-code system A) from [CIM-D] and [HFO-L] there, and G94 on mills from the Fanuc and Haas rows of the G and M code reference (`data/refdata.json`). See `docs/snippets.md`.
- **BenchMate's own choices:** the comment lines that say what must be set before the blocks; the F word on a line of its own under a comment (no source read says these controls take F alone in a block, so it is not claimed); no blocks for a control whose format is not confirmed; no speed, feed or depth filled in by BenchMate.

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
## Small milling and turning (`core/src/millturn.rs`, tools in `app/tools.js`, drawings in `app/diagrams-cut.js`)
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
- **Cut time from a cutting rate (bundle cutting, added 2026-11-11):** time = metal area cut / cutting rate. Two sources: [STAR] (the chart lists minutes per cut against bar area for each rate in in^2/min; it does not define the rate in words) and Machinery's Handbook 31st ed., "Band saw blades", printed p. 1245 (read on the publisher's flipbook, https://online.flippingbook.com/view/954192180/1401, accessed 2026-11-11: example 5.5 in^2 at about 4 in^2/min = 1.375 min; cited by name and used as a test value, no text copied). Bundle geometry (n across, m high, packed square; metal area, feed height, effective width) is own arithmetic (`saw_section`, tests). Bundle practice: A. Popson, "Bundles of joy", The Tube and Pipe Journal, 10 Jul 2007, https://www.thefabricator.com/tubepipejournal/article/sawing/bundles-of-joy (at least three teeth in the work, bimetal bands, widest band); "How to optimize sawing operations", Fabricating and Metalworking, May 2020, https://fandmmag.com/2020/05/how-to-optimize-sawing-operations (base the pitch on the average section in a bundle). Neither gives a bundle rate correction; the app says bundles of rounds usually cut slower than a solid-section rate suggests and does not invent a factor.
- Slitting saw, lathe feed (mm/rev = mm/min / rpm), multi-pass turning time, cutter approach, teeth engaged, spot drill depth (chamfer diameter / (2 tan(point angle / 2))): standard geometry and the speed and feed relations of [SAN] and [MH]. Centre drill depth: pilot length (user input, from the maker or measured, or from the centre drill table, see "Centre drills" above) plus the cone.
- **Part-off and groove time (`partoff_time`, tool `partofftime`, added 2026-11-11):** t = integral of dD / (2 f n(D)); n = 1000 Vc / (pi D) [SAN] above the clamp diameter Dc = 1000 Vc / (pi nmax), nmax below it, giving t1 = pi (Da^2 - Db^2) / (4000 f Vc) and t2 = (Da - Db) / (2 f nmax). The closed form is our own derivation and is checked in a test against Simpson integration. Two sources describe the two regions: E. Isakov, "Cutting time for facing", Cutting Tool Engineering, 15 Mar 2011, https://www.ctemag.com/articles/cutting-time-facing (defines Rmin, the radius where the spindle reaches nmax; reports constant-sfm facing about half the constant-rpm time, 0.98 vs 1.90 min, which the no-clamp case reproduces exactly as 1/2 in a test); SmartLathe, "Calculation of machining time for facing, parting off and deep grooving on a CNC lathe", https://smart-lathe.squarespace.com/blogs-1/calculation-of-machining-time-for-facing-parting-off-and-deep-grooving-on-a-cnc-lathe (time by integration, a separate simpler formula below the clamping diameter; its formulas are images that could not be read, so the closed forms could not be compared with it). Multi-pass turning time (`roughtime`) already had the G50 / G92 limit (each pass at the rpm of its finished diameter, capped).

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

## Tooling reference (`data/refdata/tooling-evidence.json`, `core/src/tooling.rs`, `app/tooling.js`)
Batch B3, branch `claude/tooling-ref`. Decisions and the results of the checks are in `docs/tooling.md`. Standard cited by name only, not read: ASME B94.9 (taps).

### Publishers
- [OSG] OSG USA, Tap drill size and pitch diameter limit chart, vol. 3, 2024: https://res.cloudinary.com/osg-usa-inc/image/upload/v1717093846/Literature/03%20-%20Charts%20and%20Guides/OSG_-_Chart_-_Tap_Drill_Size_and_Pitch_Diameter_Limit_-_Vol_3_-_2024_-_IA.pdf (accessed 2026-11-11).
- [USCTI] US Cutting Tool Institute (information from GWS Tool Group), Tapping tips: How H-limits relate to class of fit (part 1) and Finding the perfect tap: https://www.uscti.com/uscti-pages/Tapping Tip-Finding the Perfect Tap.pdf (accessed 2026-11-11).
- [MSC] MSC Industrial Supply, Taps buying guide; Thread forming taps buying guide: https://www.mscdirect.com/resources/buying-guides/taps (accessed 2026-11-11).
- [CTS] Cutting Tool Supply (Addison, IL), Manufacturing tips: H limits and class of fit: https://cutting-tool-supply.com/tech-tips/tapping/h-limits-class/h-limits-class.htm (accessed 2026-11-11).
- [NAT] North American Tool Corporation, TRU-FLO thread forming taps, engineering data (spec sheet 19000): https://cdn.dgisupply.ca/img/product-images/Asset_URL/North_American_Tool_19000_Specification_Sheet.pdf (accessed 2026-11-11).
- [BESLY] Besly Products Corp. (D. Gajdosik), in Cutting Tool Engineering, Threads will roll, Cutting Tool Engineering, 1 Aug 1995: https://ctemag.com/articles/threads-will-roll/ (accessed 2026-11-11).
- [FMC] FM Carbide, TechTips: tapping formulas: https://fmcarbide.com/pages/tapping-formulas (accessed 2026-11-10).
- [EE] Engineers Edge, Theoretical tapping hole size, cold form threads: https://www.engineersedge.com/calculators/theoretical_tapping_hole_size_16209.htm (accessed 2026-11-10).
- [BALZERS] Oerlikon Balzers, Cutting tools coating overview HQ189EN (2509): https://www.oerlikon.com/ecoma/files/HQ189EN_CUTTING-TOOLS_Overview.pdf?download=1 (accessed 2026-11-11).
- [HARTNER] Hartner GmbH, Coatings (HARTNER_Beschichtungen_EN): https://www.hartner.de/wp-content/uploads/2017/08/HARTNER_Beschichtungen_EN.pdf (accessed 2026-11-11).
- [GWS] GWS Tool Group, Tool coatings: https://www.gwstoolgroup.com/tool-coatings/ (accessed 2026-11-11).
- [BRYCOAT] Brycoat, PVD coating properties: https://brycoat.com/surface-engineering/brycoat-pvd-coating-solutions/pvd-coating-properties/ (accessed 2026-11-11).
- [IJS] Jozef Stefan Institute, Department F3 (thin films), Coating types: https://www.ijs.si/ijs/dept/f3/TrdePrevleke_A.htm (accessed 2026-11-11).
- [PRODINC] Productivity Inc (S. Hudis), Selecting the right end mill for your machining set up, 21 Apr 2026: https://productivity.com/blog/selecting-the-right-end-mill-for-your-machining-set-up/ (accessed 2026-11-11).
- [BROTHER] Brother Industries (machine tools), What is an end mill? (Speedio navi article a0046), 11 Jun 2024: https://machinetool.global.brother/en-us/speedio-navi/articles/a0046 (accessed 2026-11-11).
- [REGAL] Regal Cutting Tools, Which drill point angle should I be using?, 30 Oct 2024: https://regalcuttingtools.com/which-drill-point-angle-should-i-be-using/ (accessed 2026-11-11).
- [TRAVERS] Travers Tool Co., How to choose the right drill (2025); Tapping right (2021): https://solutions.travers.com/how-to-choose-the-right-drill-in-depth-guide-travers-tool (accessed 2026-11-11).
- [GAMMONS] Gammons Hoaglund, Reaming FAQ: https://gammons.com/reaming-faq (accessed 2026-11-11).
- [CUTWEL] Cutwel, Types of reamers: https://www.cutwel.co.uk/blog/types-of-reamers.html (accessed 2026-11-11).
- [STARRETT] L.S. Starrett (J. Gordon), Sawing starts with the material, 4 May 2023: https://www.starrett.com/news-events/sawing-starts-with-the-material (accessed 2026-11-11).
- [RMT] Revolution Machine Tools (RMT), Do I have the right TPI and tooth pitch for my cut?: https://rmtus.com/?p=27937 (accessed 2026-11-11).
- [RAPID] RapidDirect, How to remove broken taps (2022, updated 2026): https://www.rapiddirect.com/blog/how-to-remove-broken-taps/ (accessed 2026-11-11).
- [RS] RS Components (L. Little), How to use thread-forming taps, 2026: https://uk.rs-online.com/web/content/discovery/ideas-and-advice/how-to-use-thread-forming-taps (accessed 2026-11-11).
- [MMC], [SECO]: as in the CNC guide section below (crater wear and aluminium oxide coatings).

### Findings
- H and D number steps of 0.0005 in confirmed (OSG with MSC, USCTI, Cutting Tool Supply); the over-1-in band, L numbers, D minimums and the 40 % rule are single-source and flagged.
- Forming tap rule D - 0.0068 x % x P is now printed by two forming tap makers (North American Tool, Besly), so the Tap drill size note no longer calls it unconfirmed by a maker. MSC's metric line repeats the 0.0068 factor and is shown as a disagreement.
- Coating temperatures: only CVD diamond (600 °C) is confirmed with no other value; TiCN 400 °C and TiAlN 800 °C have two publishers each with others differing; every other coating shows all values.
- Saw pitch: at least 3 teeth in the cut confirmed (Starrett, RMT); the upper figures differ (10 to 14, 6 to 12) and both are shown.

## CNC guide and TNRC (`core/src/tnrc.rs`, `app/cncguide.js`, `app/formulas.js`)
Read for this batch on 2026-11-11 unless noted. Keys are the ones shown in the app. Every statement in the guide carries its keys; one with fewer than two independent public sources is shown as "to be verified" automatically (Haas manuals republished by Haas Factory Outlet count as one publisher).
### Standards (by name and edition only; nothing reproduced)
- **[ISO841]** ISO 841:2001, *Industrial automation systems and integration - Numerical control of machines - Coordinate system and motion nomenclature*, edition 2, published 2001-10, last reviewed and confirmed 2023, current. https://www.iso.org/standard/23949.html
- **[ISO6983]** ISO 6983-1:2009, *Program format and definitions of address words - Part 1*, cited by name. The iso.org page (https://www.iso.org/standard/34608.html) was found but could not be read in this session (fetch budget), so its current status is to be verified; the 1982 edition (https://www.iso.org/standard/13540.html) is the older one.
### Tool nose radius compensation
- **[KENTECH]** "Stop scratching your head and make some chips", reprinted courtesy of Kentech Inc., (c) 2000 TWI Press, on a Florida International University course page. https://web.eng.fiu.edu/zicarell/EIN3390L%20DATA/2%20LATHE/Stop%20Scratching%20Your%20Head%20and%20Make%20Some%20Chips%20!!.htm . Z shift at the end point = TNR (1 - tan(angle/2)); X shift at the start point = 2 tan(angle) x Z shift (diameter); radius: Z shift = TNR + R, X shift = 2 (TNR + R). BenchMate's tests compute these printed formulas for r = 0.8 mm at 45 degrees (0.468629 and 0.937258) and for a 2 mm corner with r = 0.8 mm.
- **[IA]** Industry Arena forum (mirror of CNCzone), "Manual tool comp partial radius lathe", posts 2005-2009. https://en.industryarena.com/forum/manual-tool-comp-partial-radius-lathe--85688.html . z comp = r - r tan(a/2); x comp = 2 (r - r tan(45 - a/2)); program a corner radius as R + r. Tests: r = 0.031 in at 30 degrees (0.022694 and 0.026204). The two forms of the X shift are equal (tan a (1 - tan(a/2)) = 1 - tan(45 - a/2)), which the tests also check for several angles.
- **[OWN]** General solver: the tip path is the part line moved by r n + r t and cut at the moved neighbour line; arcs R + r or R - r about the centre moved by r t. Tests in `core/src/tnrc.rs` check it against both sources, against the nose circle being exactly r from the line, and for OD, ID, centre-tip, convex and concave cases.
- **[HFO_OP]** Haas Factory Outlet (Productivity Inc.), *Haas Lathe Operator* (NGC), rev. 12/2018, pp. 14-16, 26, 27, 39, 46. https://productivity.com/wp-content/uploads/2019/01/Haas-Lathe-Operator-wNG2.pdf . Tip 3 for a turning tool, tip 2 for a boring tool, 4 and 1 for back turning and back boring; X offsets in diameter; lathe work offset X left at zero; wear offsets for small corrections.
- **[HFO_L]** Haas Factory Outlet, *Lathe Programming*, 2025, pp. 23-24. https://www.productivity.com/wp-content/uploads/2025/05/Lathe-Programming.pdf . G41 tool left of the path, G42 right; approach move G00/G01 on the line with G41/G42, fully compensated at its end; TNC not needed for moves along X or Z; G74, G75, G76, G92 ignore TNC. Its figure caption contradicts the text on G41/G42; BenchMate follows the text and NIST.
- **[MACH]** MachMotion, "Lathe tool tip types" (BookStack, about 2019-2023). https://support.machmotion.com/books/z-manual-source-material/page/lathe-tool-tip-types . For a rear-turret lathe: OD turning tips 2, 6, 1; boring 3, 8, 4; facing 2, 7, 3; back facing 1, 5, 4. Same 3 x 3 layout as Haas but mirrored in X: shown in the app as a disagreement.
- **[CIMCO]** CIMCO, CNC programming book, "Imaginary tool tip". https://www.cimco.com/docs/cncbook/en/Ch08_ImaginaryToolTip.html
- **[LCNC]** LinuxCNC documentation, lathe user information (source text). https://secure.diyhpl.us/cgit/linuxcnc/plain/docs/src/lathe/lathe-user.txt . Control point definition; typical lathe axes (+Z away from the spindle, +X toward the operator with front tools); and the G-code overview (modal groups), https://linuxcnc.org/docs/html/gcode/overview.html (accessed 2026-11-10 for the G-code reference).
- Not usable: Tungaloy "Machining program compensation" (434, wiper inserts only); MachMotion "Lathe tool nose radius compensation" and CNC Training Centre part 2 (no formulas or tip mapping in the text); the Haas online manual and workbook pages could not be fetched.
### Coordinates, offsets and program structure
- **[NIST]** T. R. Kramer, F. M. Proctor, E. Messina, *The NIST RS274/NGC Interpreter - Version 3*, NISTIR 6556, 2000-08-17 (public domain). https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6556.pdf . Sections 2.1.1-2.1.2 (right-handed X, Y, Z; A, B, C parallel to them; motion of the controlled point relative to the work), 3.2.2, 3.5.5, 3.5.13 (G54-G59.3, G10 L2), 3.5.12 (G53, non-modal), 3.5.11 (G43 H, G49), 3.5.10 (G41 left, G42 right, G40, D), 3.3.4 (comments in parentheses), 3.3 and 2.2.2 (block delete), 3.3.5 and 3.4 (one G word per modal group per line), 3.1 and 3.6.1 (M2, M30), 3.3.1-3.3.2 (N numbers, words).
- **[MIT_EM]** Mitsubishi Electric, *The Basics of CNC Machining Programming (for Machining center)*, e-learning, 2020. https://www.mitsubishielectric.com/fa/service-support/global/e-learning/pdf/eng/7-CNC_Programming_For_MC_na_eng.pdf . Sections 1.3 (words, blocks, EOB), 1.5 (N numbers), 1.6 (modal and unmodal, group 00), 1.9 (M30), 1.10 (comments in parentheses), 2.8 (G43 H), 3.1-3.4 (machine and workpiece coordinate systems, reference position, workpiece offset, G54).
### Milling, chips and tool wear
- **[HARV]** Harvey Performance Company, In The Loupe, "Climb milling vs. conventional milling", 2017-05-05 (tag page). https://www.harveyperformance.com/in-the-loupe/tag/backlash-eliminator/
- **[MMC]** Mitsubishi Materials, "Causes of tool damage" (types of cutting edge damage and solutions), course 78. https://www.mmc-carbide.com/permanent/courses/78/causes-of-tool-damage.html
- **[SECO]** Seco Tools, "Tool wear patterns: how to recognize and to optimize them". https://www.secotools.com/article/122073
- Sandvik Coromant's wear and troubleshooting pages (https://www.sandvik.coromant.com/en-gb/knowledge/materials/wear-on-cutting-edges and the troubleshooting-turning and troubleshooting-milling pages) need JavaScript and could not be read.
### Safety
- **[HSE_EM]** Health and Safety Executive, "Using emery cloth on metalworking lathes", updated 2026-08-18. https://www.hse.gov.uk/engineering/lathes.htm . Never hold emery cloth by hand on a rotating part; use a holder in the tool post; see EIS2.

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
### Everyday helpers (`tolmid`, `offsetadj`, `threadid`)
- **Limits and middle of a tolerance** (`tolmid`): upper limit = size + larger deviation, lower limit = size + smaller deviation, middle = (upper + lower) / 2. The terms follow ISO 286-1:2010 clause 3 and ASME Y14.5-2018 (by name); the middle is plain arithmetic.
- **Wear offset adjustment** (`offsetadj`), accessed 2026-11-11:
  - Turned diameter: Modern Machine Shop, "Taking full advantage of geometry and wear offsets", https://www.mmsonline.com/columns/taking-full-advantage-of-geometry-and-wear-offsets (a diameter 0.002 in oversize gets -0.002 in the X register of the wear offset). Same sign for bores and outside diameters in Industrial Monitor Direct, "The fundamental rule for all tool offsets", https://industrialmonitordirect.com/blogs/knowledgebase/cnc-tool-offset-direction-lathe-and-mill-adjustment-guide .
  - Outside size milled with cutter compensation: Autodesk Fusion blog, "Cutter compensation for beginners", https://www.autodesk.com/products/fusion-360/blog/cutter-compensation/ (boss 1.001 for 1.000: -0.001 in a diameter table); CIMCO CNC Handbook chapter 6, "Adjusting CDC offsets", https://www.cimco.com/documentation/online/cncbook/en/Ch06_AdjustingCDCOffsets.html (target minus actual: 1.0120 for 1.0000 gives -0.0120).
  - G43 adds the length offset to the Z position: Machinist Guides, "G43 G-code", https://www.machinistguides.com/g43-code/ .
  - Own arithmetic, no second publisher yet: half the error for a radius value; the inside size rule (a smaller D value removes more on an inside wall too, so the change is +error); depth below Z zero (+error) and height left (-error) from G43.
  - Disagreement, shown and not followed: the Industrial Monitor Direct page says a pocket cut too deep needs a smaller Z offset. With G43 adding the offset to the Z position a smaller value sends the tool deeper, so BenchMate gives +error for a depth. The tool tells the user to cut and measure again.
- **Thread identifier** (`threadid`): pitch = 25.4 / threads per inch (inch defined as 25.4 mm, NIST SP 811). Candidate sizes, pitches and basic diameters are those of the thread tools and their sources. The window (6 % on pitch; 6 % on diameter, at least 0.3 mm) and the score are BenchMate's own search rule, chosen so that caliper and pitch-gauge readings of in-tolerance screws stay inside it; it is not from a standard.
### Milling surface finish and RMS (`millfinish`, `surface`), accessed 2026-11-11
- Floor, corner radius: Rth = fz² / (8 r). I. M. Soltan, *Surface Roughness Prediction in End-Milling Process*, M.Sc. thesis, Assiut University, 2008, https://kfs.edu.eg/staff_site/abstracts/Surface%20Roughness%20Prediction%20in%20End-Milling%20Process.pdf ; JM CNC, "What are milling cutter marks?", https://jmcncmachine.com/what-are-milling-cutter-marks/ . The thesis also gives Ra close to fz² / (18 sqrt 3 r), the exact average for arc-shaped marks; BenchMate keeps f² / (32 r) as in the turning tool (2.6 % lower) and says so.
- Wall: S. Wojciechowski, "Machined surface roughness including cutter displacements in milling of hardened steel", *Metrology and Measurement Systems* 18 (2011) no. 3, 429-440, https://journals.pan.pl//Content/89802/PDF/Journal10178-VolumeXVIII%20Issue3_09paper.pdf : Rt0 = R - sqrt(R² - fz² / 4) for cylindrical milling (the equation was read from a garbled text layer and matches the circle geometry). The Martellotti form fz² / (8 (R - fz z / pi)), printed in "Analytical and simulation-based prediction of surface roughness for micromilling hardened HSS", *J. Manuf. Mater. Process.* 3 (2019) 70, https://www.mdpi.com/2504-4494/3/3/70 , is noted and not used (difference under 1 % at finishing feeds; the sign for up and down milling was not confirmed).
- One tooth marking the surface (runout): own geometry, the same marks a feed per revolution apart. That runout changes the theoretical roughness is the subject of "A method for the determination of theoretical roughness in face milling considering the run-out of the inserts", *Solid State Phenomena* 261 (title only, not read).
- RMS: Rq / Ra = pi / (2 sqrt 2) = 1.1107 for a sine wave is our derivation (tests sample each ideal profile). Printed as 1.11 by Quality Magazine, "Apples, oranges and surface finish parameters", https://www.qualitymag.com/articles/84224-apples-oranges-and-surface-finish-parameters (also the measured ratios by process, one source) and by Wevolver, "Surface finish chart: Ra, Rq and N grade conversions", https://www.wevolver.com/article/surface-finish-chart-ra-rq-and-n-grade-conversions .
### Cutting forces (`kcforce`, `drillforce`, `taptorque`, `leadthin`, `slender`; `core/src/cutforce.rs`, `app/cutforce.js`), accessed 2026-11-11
- **Specific cutting force table.** Iscar, "Materials and grades" (table after DIN / ISO 513 and VDI 3323), https://www.iscar.com/lms/wp-content/uploads/2021/04/Materials-group.pdf : kc1.1 ("specific cutting force for 1 mm2 chip section") and mc ("chip thickness factor") for material groups 1 to 41. Groups 29 and 30 (plastics, hard rubber) have no values and are left out. Groups 38 to 41 (hardened) have no mc printed; BenchMate uses kc1.1 unchanged for them and says so. Rows 6, 7, 14, 16, 21, 22, 36, 37 and 38 to 41 were read a second time from the text layer.
- **Kienzle's formula** kc = kc1.1 x h^(-mc): the definitions in the Iscar footnotes; Sandvik Coromant's page "Specific cutting force" (https://www.sandvik.coromant.com/en-gb/knowledge/materials/specific-cutting-force) could not be read in this session (script-only page), and Wikipedia's article shows the table but lost the equation. Cross-check: Mitsubishi Materials prints kc against the feed per tooth, and four of its rows fitted in the core test fall on a power law within 6 % with exponents between 0.15 and 0.40. No rake angle or wear correction is applied.
- **Second and third publishers, shown beside the table, never mixed in:** Sandvik Coromant values as listed in Wikipedia, "Cutting force (machining)", https://en.wikipedia.org/wiki/Cutting_force_(machining) (the article says they were collected from Sandvik Coromant manuals; no edition is named); Mitsubishi Materials, "Cutting power for face milling", https://www.mmc-carbide.com/en_jp/technical_information/formula/tec_milling_power_formula (kc at 0.1 to 0.6 mm per tooth for 20 materials).
- **Disagreement shown:** austenitic stainless steel at 0.2 mm chip thickness: Iscar group 14 gives 2150 x 0.2^-0.20 = 2966 N/mm2, Sandvik's listed values give 2800 x 0.2^-0.21 = 3926, Mitsubishi prints 1970. Aluminium: Iscar 700 against Sandvik's listed 350 for kc1.1. Which rows of the other publishers sit beside which Iscar group is BenchMate's own matching by material name and strength.
- **Chip thickness.** h = f sin(entering angle): Iscar, *Machining titanium* user guide (05/2019), p. 33, equation 7 and table 19 (feed per tooth = basic feed x 1 / sin of the cutting edge angle; 1, 1.03, 1.1, 1.15, 1.4, 2 for 90, 75, 65, 60, 45, 30 degrees), https://iscar.co.za/Catalogs/flipview/reference-user-guides/machining_titanium_05_2019/files/basic-html/page33.html . Mitsubishi Materials, "Lead angle (KAPR) and cutting characteristics", says in words that the chip at 45 degrees is "approx. 75 %" of that at 90 (sin 45 is 0.71), https://www.mmc-carbide.com/en_jp/technical_information/tec_rotating_tools/technical/tec_milling_function_cutting_edge_angle . Round insert: hex = fz sqrt(iC^2 - (iC - 2 ap)^2) / iC is the same rule at the angle where the edge leaves the work; it is the axial factor [MD] prints for a ball nose (above). Drill lip: h = (fn / 2) sin(point angle / 2), the same rule with two lips (own).
- **Drilling.** Sandvik Coromant, "Formulas and definitions" for drilling (metric), https://cdn.sandvik.coromant.com/files/sitecollectiondocuments/services/metal-cutting-e-learning/formulas-and-definitions/formulas-and-deinitions-for-drilling-metric-enu.pdf : Pc = vc Dc fn kc / (240 x 10^3), Mc = Pc 30 x 10^3 / (pi n), Ff = 0.5 kc (Dc / 2) fn sin kr (fractions rebuilt from a garbled text layer; they match the units). One publisher. Comparison figure only, no material named: Mitsubishi Materials, "Basic drilling: drilling forces" (10 mm drill, 0.3 mm/rev: 15 N m, 2500 N), https://www.mmc-carbide.com/permanent/courses/81/drilling-forces.html ; BenchMate gives 8.7 N m and 1630 N for group 2 steel, the same order.
- **Tapping.** Cutting tap: Lubero, "Calculation formulas: tapping and thread forming", https://www.lubero.de/en/technology/calculations : Md = kc h^2 d1 / 8000 (h pitch), P = Md n / 9500 (BenchMate uses the exact 2 pi n M / 60 000 = M n / 9549), and the kc table used in the tool. One publisher; the P^2 / 4 in it is the section of one thread groove (exact for the ISO form: 0.2368 P^2, core test). Forming tap: Yamawa, European catalogue YEU21, p. 644, https://www.yamawa.eu/wp-content/uploads/Catalogo_sfogliabile_YEU21/files/basic-html/page644.html : T = Kf Dc P^2 / 1000 for a thread 1.5 D long at 75 % thread height, with Kf ranges. One publisher.
- **Disagreement shown:** ECL taps (Precision Tools and Tooling), https://precisiontoolstooling.au/pages/ecl-taps-technical-information-trouble-shooting , prints Md = A Ks D / 1000 with A = 0.2 P, linear in the pitch, and 1.5 times that for forming taps; its own worked example does not use its stated Ks. Not used.
- **Slender part.** Beam cases from [ROARK] Table 8.1 and [GERE], as in Mechanics. The propped cantilever under a load at a: F a^3 b^2 (3 L + b) / (12 L^3 E I), checked against 7 F L^3 / (768 E I) at mid-span; worst place a = (2 - sqrt 2) L from d/da = 0. That the diameter error is twice the radial deflection is geometry. E presets are from the BenchMate material data.
- Not readable in this session (script-only pages): Sandvik Coromant threading, drilling and milling knowledge pages; Kennametal "Torque, thrust and power" calculator page. Machinery's Handbook has sections on drilling thrust, torque and power; not used.
### Advisor (`advmill`, `advdrill`, `advream`, `advturn`; `core/src/advisor.rs`, `app/advisor.js`), accessed 2026-11-11
Starting speeds and chip loads are kept as each publisher prints them, one table per publisher in `app/advisor.js`, never merged or averaged. The page shows every publisher that lists the material side by side and says which one was used. Every cell was read twice, because table extraction from PDF and web pages loses empty cells.
- **[LMS]** LittleMachineShop, "Cutting Speeds", https://littlemachineshop.com/reference/cuttingspeeds.php : turning (HSS and carbide), milling, drilling and reaming speeds in ft/min for 16 material rows. The turning table states its basis: 0.004 in/rev, 0.040 in depth of cut, 180 minutes tool life. The milling and drilling tables do not name the tool material; BenchMate uses the drilling and reaming columns for HSS only and shows the milling column as "speed only, tool material not stated". Single publisher for turning speeds.
- **[UF]** University of Florida, MAE design lab, "Speeds and Feeds" (web page), https://web.mae.ufl.edu/designlab/Advanced%20Manufacturing/Speeds%20and%20Feeds/Speeds%20and%20Feeds.htm , and the lab handout EML2322L "Drilling and Milling Speeds and Feeds", https://web.mae.ufl.edu/designlab/Lab%20Assignments/EML2322L-Drilling%20and%20Milling%20Speeds%20and%20Feeds.pdf : HSS cutting speeds by material, end mill feed per tooth for 1/2 to 1-1/2 in cutters, drill feed per revolution by drill diameter, and the rules used as factors: carbide 2.5 times the HSS speed; oil put on by hand 60 % of speed and feed; reamers half the drill speed and twice its feed; countersinks 25 % of the drill speed; deep holes without through coolant up to half speed, with pecking. Worked examples 1A, 1B, 2A, 2B, 3, 4 and 5 are in the handout.
- **Disagreement shown (two editions of one publisher):** the handout prints drill feeds of 0.008 to 0.012 in/rev for 1/2 to 1 in and 0.012 to 0.020 for 1 in and over; the web page prints 0.008 to 0.016 and "0.016 and up". The end mill chip load tables also differ between the two. BenchMate takes speeds and chip loads from the web page and the drill feed bands from the handout (the lower ones), and the drilling page prints both figures from 1/2 in up.
- **[HAR]** Harvey Tool, "General Machining Guidelines", https://harveytool.com/resources/general-machining-guidelines : carbide end mills, speed range in ft/min and chip load per tooth at 1/8, 3/16, 1/4, 3/8, 1/2, 5/8, 3/4 and 1 in, 13 material rows used.
- **[RED]** RedLine Tools catalogue, p. 216, "General purpose carbide end mills: speeds and feeds", https://redlinetools.com/customer/docs/SKUDocs/General-Purpose-Carbide-Endmills-Speeds-Feeds-p216.pdf : speed ranges uncoated, AlTiN and TiCN and chip load ranges at 1/8 to 1 in, 10 rows used. Aluminium is printed as "over 500" ft/min; BenchMate uses 500 and says so. Footnote: reduce speed 25 % for extra long end mills (noted here, not applied). The rows for steels over 32 HRC look to contain misprints and are not used.
- **[UPN]** University of Pennsylvania, MEAM design guides, "Feeds and Speeds", https://medesign.seas.upenn.edu/index.php/Guides/FeedsAndSpeeds : carbide and HSS speeds and chip loads at 1/8, 1/4 and 1/2 in for six materials. Aluminium and plastics carbide speeds are printed as "600+".
- **[OO]** Open Oregon Educational Resources, "Manufacturing Processes 4-5", unit 2, Table 1 "Cutting speeds for material types", https://openoregon.pressbooks.pub/manufacturingprocesses45/?p=173 : the table names neither the tool material nor the operation, so it is shown for comparison only on the drilling and turning pages and never used as the start. Its worked example (3/8 in two-flute HSS end mill at 90 ft/min: 960 rpm, 3.84 in/min) is a core test.
- **[ICS]** ICS Cutting Tools, "Reaming recommendations", https://www.icscuttingtools.com/pdfs/Reaming-Recommendations.pdf : reaming speed and feed by material class, stock to leave by reamer diameter up to 3/4 in. No feed is printed for steel under Rockwell C30; the page says so and falls back to twice the drill feed [UF].
- **[GAM]** Gammons Hoaglund, "Reaming guide", https://gammons.com/reaming-guide : stock about 3 % of the hole diameter (examples 0.010 in on 1/4 in, 0.015 in on 1/2 in, up to 0.025 in on 1-1/2 in); speed two thirds of the drilling speed; feed 200 to 300 % of the drilling feed; a twist drill cuts 0.002 to 0.004 in oversize.
- **Disagreement shown (reaming speed):** [UF] says half the drilling speed, [GAM] two thirds and, lower down the same page, a third to a half as a start, [LMS] and [ICS] print their own columns. Each is a line in the table on the reaming page; the user picks.
- **Feed from the nose radius (turning):** Mitsubishi Materials, technical information for turning, "Corner radius", https://www.mmc-carbide.com/in/technical_information/tec_turning_tools/technical/tec_turning_radius : "a corner radius 2-3 times the feed is recommended", so the feed is a third to a half of the radius. Single publisher. The depth of cut suggested for turning is the 0.040 in the [LMS] speed table is based on.
- **Width and depth of cut (milling):** Mitsubishi Materials course "Depth of cut" and Helical Solutions, *Machining Guidebook* (2016) pp. 11, 31-32, as cited under Small milling and turning. Slot depth 0.2 D to 1 D and shoulder roughing half the diameter wide (Mitsubishi); high-efficiency path 7 to 30 % of D wide and up to 2 D deep, finishing 2 to 5 % of D wide (Helical).
- **Saws (`slitsaw`):** Gaylee Corporation, "Cutting speed recommendations: circular saws" (solid carbide, carbide-tipped and HSS saws), copy at https://www.homemadetools.net/forum/attachments/useful-charts-calculators-working-metals-other-materials-gl-engineering-data-circular-saw-cutting-speeds.pdf-25717d1537669265 : a speed range in ft/min for carbide and for HSS saws for each material group (the groups and hardness ranges are credited to the Machining Data Handbook, 3rd ed.), and one feed per tooth range for all materials (carbide 0.0002 to 0.0015 in, HSS 0.002 to 0.006 in). Kyocera, "Slitting saw parameters", https://cdn.shopify.com/s/files/1/0612/0733/files/Kyocera_Slitting_Saw_Parameters.pdf , reprints the carbide column and the carbide feed range unchanged, so the carbide figures were read from two copies and the HSS figures twice from one; it is still one publisher. Each range spans the whole hardness range of a group (for example 85 to 425 HB), which the page says. 13 rows used; which row a BenchMate material class reads is our own matching. No second publisher was found (GenSwiss's page could not be fetched; CNCCookbook's article prints no figures).
- **Tapping (`advtap`):** RedLine Tools, "Taps tech", https://www.redlinetools.com/customer/docs/Taps_Tech_RedLine.pdf : the speed table for general purpose taps, a range in surface feet per minute for each material row, read twice with the same result. 12 rows used (low and medium carbon steel, high strength tool steel, austenitic and martensitic stainless, gray cast iron, brass and bronze, aluminium alloys, high silicon aluminium, titanium, nickel base alloys, composites and plastics); the rows for precipitation hardening stainless, ductile and malleable iron, copper, magnesium, cobalt base and iron base alloys have no BenchMate material class yet. The sheet's first table (HSSE colour ring taps) lost its header in extraction and is not used. One publisher: the Productivity Inc. chart could not be read and no other open table was found, so nothing confirms these figures and the page says so. Own choices: which row a material class reads (free-machining steels read low carbon steel; 4140 annealed and 1137/1144 read medium carbon steel, where the sheet lists 4120 to 4161 and 1140 to 1151; 303 reads the austenitic row; cast aluminium reads the lower, high silicon row); heat treated alloy steel and W1 have no row; no coolant factor (none is printed for tapping). Feed rate = pitch x spindle speed (Haas G84 tapping guide, under Cycle generators); the rule that a limit slows the spindle and never changes the feed per revolution follows from that. Rounding the speed down to a whole RPM is our own choice so that S x pitch = F exactly.
- **Plunge roughing (`advplunge`):** three publishers print a rule for feeding an end mill straight down and they do not agree, so each is shown as printed and the most cautious is the default. [UF] University of Florida design lab, "Speeds and Feeds": "Plunging (endmills and annular cutters): 75% of the peripheral speed and 25% of the peripheral feed"; BenchMate reads "feed" as the feed per tooth (read as the feed rate it would be a third higher, which the page says). CGS Tool, general purpose end mill speeds and feeds sheet, https://www.cgstool.com/content/GP%20Speeds%20and%20Feeds.pdf : "Plunge Operations: Reduce feed per tooth 50-65%" (read twice; taken as 35 to 50 % of the side-milling feed, the cautious 35 % used; the sheet does not change the speed). MIT Center for Bits and Atoms, feeds and speeds calculator notes, "Plunge rate", https://pub.pages.cba.mit.edu/feed_speeds/parameter_explanations/plungerate.html : "a plunge rate should be less than 50% of the feed rate" (50 % used as the most the page allows; the page also says plunge cuts should be ramped and that the cutting speed falls to zero at the centre of an end mill). The side-milling speed and chip load come from the milling advisor tables above. Own geometry, with core tests: cusp between two plunges h = R - sqrt(R^2 - (s/2)^2); largest spacing that still meets inside the stepover 2 sqrt(ae (D - ae)); removal rate while going down Q = stepover x spacing x Vf (the cusps a row leaves are taken by the next row). Power: Pc = Q kc / 60 000 [SAN] with kc from the Iscar table at a chip thickness equal to the feed per tooth; that choice of chip thickness is our own and the row is labelled an estimate. Accessed 2026-11-11.
- **Holder and spindle stiffness (`deflection`, `cutopt`, `advmill`):** the holder, its taper and the spindle bearings are taken together as one spring at the holder face; under the side force F the holder face moves F / k and that is added to the bending of the tool (Hooke's law, springs in series; [GERE]). k is the user's own figure, typed or worked out from a push test (k = force / indicator reading). No typical stiffness is printed because no open table of measured spindle and holder stiffness was found; the research papers found model single machines. Left out and said on the page: the tilt of the holder face, which adds a tip movement that grows with the stick-out. Core tests are hand examples.
- **Chip breaker range (`advturn`):** the feed and depth range is the user's own figure, read from the insert box or the maker's catalogue (or saved with the insert in the tool library); BenchMate ships no chip breaker ranges. What being outside the range means is worded from Seco Tools, "The geometry factor", https://www.secotools.com/article/the_geometry_factor_825130c (accessed 2026-11-11): the practical limits of feed and depth together form the chip breaking area of an insert; a feed that is too small turns cutting into rubbing; below the lower depth limit chips tend to get longer; too high a depth or depth x feed risks overloading and breaking the insert. One publisher; Sandvik Coromant's pages on the same subject load by script and could not be read. Holding the suggested feed and depth inside the range, and the note when the nose radius rule and the range do not overlap, are our own choices.
- **Boring bar (`boringbar`):** deflection and overhang guidance as cited under Small milling and turning. New in 0.3.0: the cutting force from the work material (kc from the Iscar table at h = fn sin(entering angle)), the feed from the nose radius (Mitsubishi Materials, above), the deepest cut inside an allowed deflection, ap = allowed / (deflection for 1 mm of depth), and the overhang that fits a cut, L = cbrt(3 E I x allowed / F): both are the cantilever formula [GERE] turned round (own algebra, core tests). The damped bar option uses the makers' overhang guidance for damped bars (Seco Tools 10 x D, Kennametal 10 x D or more) and works the deflection out as for a plain steel bar, which the page says. Which limit is named (the larger share of its limit) is BenchMate's own rule.
- **Formulas.** n = 1000 Vc / (pi D), Vf = n z fz, Q = ae ap Vf, Pc = Q kc / 60 000, torque and P(n) as in the cut optimiser [SAN]; radial chip thinning [MD]; mean chip thickness [ALT]; kc = kc1.1 h^(-mc) with the Iscar table (Cutting forces, above); cantilever deflection [GERE][ROARK]; turning h = f sin(entering angle), Fc = kc ap f [SAN]; drilling as in Cutting forces.
- **Published worked examples run as core tests (10, with the turning stability limit under Stability chart):** [UF] 1A end mill in aluminium, drill in cast iron, reamer in mild steel (750 rpm, 6.0 in/min), carbide end mill in aluminium (4700 rpm, 56 in/min), countersink in aluminium (550 rpm, 3.3 in/min); Mitsubishi Materials face milling power example; Mitsubishi Materials, "Cutting power for turning", https://www.mmc-carbide.com/us/technical_information/formula/tec_turning_cutting_power_formula (mild steel, 120 m/min, 3 mm, 0.2 mm/rev, 80 %, Kc 3100 MPa: 4.65 kW); Mitsubishi Materials, "Formulas for drilling", https://www.mmc-carbide.com/us/technical_information/formula/tec_drilling_formula (12 mm at 1350 rpm: 50.9 m/min; 0.2 mm/rev: 270 mm/min; 1.2 in hole at 165 SFM and 0.006 in/rev: 11.2 s; the page rounds pi to 3.14, so the test allows 0.1 %); [OO] end mill in mild steel (within 5 %, because the book rounds rpm = 4 x speed / D). Each test states its tolerance.
- **BenchMate's own choices, which no publisher prints (all said on the page):** 1 D depth for shoulder roughing and 1.5 D for finishing; allowed tip deflection 0.05 mm roughing and 0.01 mm finishing when the box is blank; bending force taken equal to the tangential force unless a ratio is typed; the tool treated as a solid rod unless an effective flute diameter is typed; chip load read along a straight line between two printed diameters, scaled down with the diameter below the smallest and held above the largest; tile colours at 80 % and 100 % of a limit; which publisher row matches which BenchMate material class; which Iscar group gives kc for each class; the order in which limits are met (depth, then width, then feed; a locked value is never changed).
- **Ball nose in the milling advisor:** the largest diameter in the cut, De = 2 sqrt(ap (D - ap)) (Iscar, as cited under Ball-nose cutters); the spindle speed is set so the table speed is reached at De. Own choices: De is taken at the starting depth, so a depth reduced for a limit runs a little under the table speed; the feed is not raised for the thinner chip of a shallow ball cut.
- **Finish estimate in the milling advisor and machine check on the removal rate page:** the wall finish is the `millfinish` calculation (sources under "Milling surface finish and RMS") with the advised feed per tooth and the cutter radius; a geometric lower bound, said on the page. The removal rate page compares its power with the spindle characteristic already used by the advisors, P(n) = min(P_max, T_max x 2 pi n / 60 000), at n = 1000 Vc / (pi D).
- **More of BenchMate's own choices:** the machine's rigidity class only sets where the "How hard is this cut" slider starts (Light 25 %, Medium 50 %, Heavy 75 %); the stick-out slider words cover 1.5 to 6.5 tool diameters in thirds. Tool life in the advisors uses Taylor's equation with the user's own n and C ([TAY], as on the Tool life page).
- **Left out because no source was found:** a factor for dry or mist cutting (the table figures are used unchanged, with a note); a hardness correction (the "speed in the printed range" slider takes its place); Taylor exponents for tool life (no open table found yet).
- **Not usable in this session:** Haas turning insert chart and Productivity Inc. tapping chart (PDF columns lost in extraction); Sandvik Coromant knowledge pages and Kennametal calculators (script-only pages).
### Stability chart (`core/src/lobes.rs`, `app/lobechart.js`, inside `advmill`), accessed 2026-11-11
- **[TS13]** C. T. Tyler, T. L. Schmitz, "Analytical process damping stability prediction", *Journal of Manufacturing Processes* 15(1), 2013, 69-76, author copy at https://mtrc.utk.edu/wp-content/uploads/sites/45/2019/09/process_damping.pdf : Tlusty's average tooth angle approach. Limiting chip width b_lim = -1 / (2 Ks Re[G_or]) for turning (eq. 4) and b_lim = -1 / (2 Ks Re[G_or] Nt*) for milling (eq. 13); fc / (Omega Nt) = N + eps / (2 pi) (eqs. 5, 14); eps = 2 pi - 2 atan(Re[G_or] / Im[G_or]); average teeth in the cut Nt* = (phi_e - phi_s) / (360 / Nt) (eq. 15); one-mode response G = 1 / (-m w^2 + i c w + k) (eq. 8); directional orientation factors for up and down milling (sections 3.3.1 and 3.3.2).
- **[TTS15]** C. T. Tyler, J. Troutman, T. L. Schmitz, "Radial depth of cut stability lobe diagrams with process damping effects", *Precision Engineering* 40, 2015, 318-324, author copy at https://mtrc.utk.edu/wp-content/uploads/sites/45/2019/09/tyler_troutman_schmitz_radial.pdf : the same equations (1) to (4). Same research group as [TS13], so this confirms the reading of the equations, not the method. The text layer of both PDFs loses the pi in "eps / (2 pi)" and "2 pi - 2 atan": rebuilt from the units and checked by the worked example below.
- **Published worked example (core test):** [TS13] section 4.1: k = 6.48 x 10^6 N/m, m = 0.561 kg, c = 145 N s/m, Ks = 2927 N/mm2, beta = 61.79 deg: stability limit about 0.37 mm at low speed without process damping. BenchMate gives 0.370 mm.
- **Tool-tip model (BenchMate's own, simple on purpose):** the tool as a uniform round bar of the shank diameter clamped at the holder face; one mode at the first bending frequency of a clamped-free bar, f1 = (1.875104^2 / (2 pi)) sqrt(E I / (rho A L^4)) [THOM], with the static tip stiffness 3 E I / L^3 [GERE] (the exact modal stiffness of that mode is 3.09 E I / L^3). Density: solid carbide 14.45 g/cm3 (Ceratizit CTS20L, same listing as its modulus under Tool material data), HSS M2 8.07 kg/dm3 (voestalpine data sheet, same as its modulus). Holder, spindle and the flutes are left out, which the chart says; a tap test (natural frequency, stiffness, damping ratio) replaces the model in Expert mode.
- **Stand-in values when nothing is measured, both said on the chart:** damping ratio 0.03 (the value of the milling example in [TS13] section 4.2; the flexures measured there had 0.018 to 0.063) and force angle beta 62 degrees (measured in [TS13] for a 19.05 mm cutter; 61.8 to 63.5 in the paper, 70 in its simulation).
- **Own algebra (core tests):** for a tool with the same response in x and y the two orientation factors add up to cos(beta) at every tooth angle, for up and down milling, so the oriented response is cos(beta) G; Ks = kc / sin(beta) from the definition of the force angle; the most negative real part of a one-mode response is -1 / (4 k zeta (1 + zeta)); each lobe has one point at a given speed, found by bisection and checked against a direct scan.
- **Chatter tile and limit card in the milling advisor (BenchMate's own wording and choice):** the tile compares the advised depth with the limit at the advised speed. The card names chatter only when no machine or deflection limit is active, the cut is above the line and the best speeds are far enough apart to aim for; it is worded as a warning from a simple model. The suggested speed is the nearest best speed above the cut that the machine can reach, else the one below.
- **Not modelled:** process damping (the subject of both papers; their force model goes with depth / cutting speed, so it grows as the speed falls). The chart says that cuts above the line are common at low speed and that it cannot judge them. The 5 % spacing below which the best speeds are called "too close to aim for" is BenchMate's own wording threshold.
### G-code tidy tools (`core/src/gtidy.rs`, in `gsim`), accessed 2026-11-11
- **Decimal point reading:** FANUC decimal point programming, reprinted at https://www.mfgrobots.com/Article/equipment/cnc/46531.html : parameter 3401 bit 0 (DPI) chooses the pocket calculator type (a value with no decimal point is in mm, inch or degrees) or the standard type (in least input increments); X1000 is 1000 mm or 1 mm. Haas names the same choice Setting 162 (page not readable here; named, not counted).
- **Least input increment:** Modern Machine Shop, "Reducing a CNC's least input increment value", https://mmsonline.com/columns/reducing-a-cncs-least-input-increment-value : typically 0.001 mm in metric and 0.0001 in in inch. Agrees with the FANUC table above for mm; one publisher for the inch figure.
- **G76 two-block format:** CNC Training Centre, https://www.cnctrainingcentre.com/tag/g76-haas : first block P (passes, chamfer, angle), Q minimum cut, R finishing allowance; second block X, Z, P thread depth and Q first cut "no decimal point", F pitch. One publisher; the G71 to G73 P and Q block numbers are in the simulator's sources (docs/gsim.md).
- **Exact factors:** 1 in = 25.4 mm, 1 ft = 0.3048 m [SP811].
- **BenchMate's own choices:** which words are lengths (listed in docs/gsim.md), the decimals written (4 in inch, 3 in mm, more for small feeds), the weights that tell a lathe program from a mill program, and that every lathe cycle block is listed for a check by hand.
### 2D sketcher and DXF reader (`sketch`, `core/src/sketch.rs`, `core/src/dxf.rs`), accessed 2026-11-11
Full list, the check table and what is left out: **`docs/cad-dxf.md`**. Summary:
- **[MWCIRC]** Wolfram MathWorld, "Circumcircle", https://mathworld.wolfram.com/Circumcircle.html : circumcentre x0 = -bx / (2a), y0 = -by / (2a), with a the determinant of the rows (x, y, 1) and bx, by the same with x^2 + y^2 in place of a column (equations 11 and 12). Used for the arc through three points. Confirmed by core tests on a unit circle and the 3-4-5 triangle.
- **[MWCC]** Wolfram MathWorld, "Circle-Circle Intersection", https://mathworld.wolfram.com/Circle-CircleIntersection.html : x = (d^2 - r^2 + R^2) / (2d) from the first centre (equation 5), half chord from y^2 = R^2 - x^2. Confirmed by a core test (two r 5 circles 6 apart cross at x = 3, y = +-4).
- **DXF text, signs and planes:** Autodesk DXF reference pages "TEXT (DXF)", "About Arbitrary Axis Algorithm (DXF)" and "About ASCII Control Characters in DXF Files", and the AutoCAD LT "Control Codes and Special Characters Reference" (`%%d`, `%%p`, `%%c`); second reading: the ezdxf documentation ("Object Coordinate System (OCS)", "DXF Tags"). Links in `docs/cad-dxf.md`.
- **Own algebra (core tests):** line with line and line with circle crossings (parametric line, quadratic), tangent points from a point (cos of the angle at the centre = r / d, because the radius is square to the tangent), the foot of a perpendicular, the angle between two lines from the cross and dot products of their directions.
- **Other programs, used only to open our files:** LibreCAD 2.2.0.2 (GPLv2), Inkscape 1.2.2 (GPL) and OpenSCAD 2021.01 (GPLv2), with PyMuPDF to measure LibreCAD's PDF. `scripts/check_dxf_cad.py`. No code from any of them.
- **BenchMate's own choices:** which snap wins (the nearest; a point on a line and the grid only when nothing better is in reach), the reach of 10 pixels, text taken as 0.7 x height per character wide, 250 characters per text, 200 undo steps, and the list of what the sketcher leaves out.
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

## Gears and splines (`core/src/gears.rs`, `app/gears.js`)

Full list of formulas, sources, worked examples and single-source warnings in `docs/gears.md`.
Main sources: KHK Gear Technical Reference (khkgears.us, Tables 4.3 and 4.9, and the span,
over-pin and chordal articles from Gear Solutions 2020); SDP/SI Elements of Metric Gear
Technology; MESYS AG online gear calculation (calc.mesys.ch); ISO 53, ISO 21771-1, DIN 3960,
ANSI B92.1 and ISO 4156-1 (cited by name); Engineers Edge involute spline formulas.

## Mechanics (`core/src/mechanics.rs`, `app/mechanics.js`, tools in `app/tools.js`)

Full list of formulas, decisions, checks and what is not verified in `docs/mechanics.md`.
Textbooks cited by name for the relations only (nothing copied): Gere and Goodno, Mechanics of
Materials (sections, torsion, beams, columns); Young, Budynas and Sadegh, Roark's Formulas for
Stress and Strain, 8th ed., Table 8.1 (beam cases); Budynas and Nisbett, Shigley's Mechanical
Engineering Design (Johnson, Goodman, Soderberg, Gerber, Langer, Marin); W. T. Thomson, Theory of
Vibration with Applications (Rayleigh, Dunkerley). Free sources used for numbers and tests:
- American Wood Council, Design Aid No. 6, Beam Design Formulas with Shear and Moment Diagrams (awc.org): beam maxima.
- AISC 360-16, Commentary Table C-A-7.1 (aisc.org): effective length factors (shown as text; values not re-fetched, see docs/mechanics.md).
- Engineers Edge, Marin endurance limit calculator (engineersedge.com/calculators/marin_endurance_limit_15637.htm), after T. H. Brown, Marks' Calculations for Machine Design: Se' = 0.504 Sut, surface factor table, size factor, Kf.
- Penn State ME 360 notes n06_fatigue (me.psu.edu/sommer/me360/n06_fatigue.pdf), after Norton: Goodman worked example.
- B. McGinty, Stress Concentrations at Holes (fracturemechanics.org/hole.html): Kirsch Kt = 3, finite-width fit on net section. Inglis 1913 (by name) for the elliptical hole.
- IRD Balancing, Technical Paper 1, Balance Quality Requirements of Rigid Rotors: ISO 1940 / 21940-11 formula, plane allocation, worked example. ISO 21940-11:2016 cited by name.
- OpenStax, University Physics Vol. 1, 6.3 (F = m r omega^2). VDI 3106 (by name); Optimum Optiturn manual 4.23.8 (manualslib.de) for Fsp0 = Ssp (Fsp +- Fc); Berg Spanntechnik speed notes (backup.berg-spanntechnik.de, drehzahlhinweise.pdf) for the one-third rule.
- NIST SP 811 appendix B: exact unit factors (lbf, lb, hp, oz).
## Inspection round 2 (`core/src/inspect.rs`, `app/inspect.js`, `data/refdata/ansi-fits-evidence.json`, `preferred-evidence.json`)

Full detail, counts and disagreements in `docs/inspection.md`. All pages accessed 2026-11-11.
- **Standards (by name only; nothing reproduced):** ANSI B4.1-1967 (R1999, R2004), preferred limits and fits for cylindrical parts; ISO 286-1:2010 (Cor 1:2013) annex formulas for sizes over 500 mm; ISO 3:1973 preferred numbers (and ISO 17:1973, ISO 497:1973 by name); ISO 2859-1:1999 and ANSI/ASQ Z1.4-2003 attribute sampling (tables not used).
- **[KSU]** King Saud University course material, ANSI B4.1-1967 (R1987) Tables 3 to 9, https://fac.ksu.edu.sa/sites/default/files/fits_us_tables_ansi_b4.1-1967_r1987.pdf . The only full ANSI fit table read: 491 of 492 rows are single-source ("needs 2nd source").
- **[EE]** Engineers Edge, Standard Preferred Tolerance Limits Fits ANSI B4.1 (RC5 at 2 in worked example), https://ns1.engineersedge.com/mechanical,045tolerances/preffered-mechanical-tolerances.htm .
- **[AMES]** AmesWeb, ANSI preferred tolerances and fits charts (symbols and descriptions), https://amesweb.info/fits-tolerances/ansi-preferred-tolerances-fits-charts.aspx .
- **[ITEH_ISO3]** iTeh Standards catalogue preview of ISO 3:1973, https://iteh.es/catalog/standards/iso/e9d7acbc-57da-4556-8352-b3cf61d8ac97/iso-3-1973 (R5, R10, R20).
- **[WIKI_RENARD]** Wikipedia, "Renard series", https://en.wikipedia.org/wiki/Renard_series (R5, R40, R80 extra values); **[WIKI_PREF]** Wikipedia, "Preferred number", https://en.wikipedia.org/wiki/Preferred_number (same publisher, R5).
- **[NISTSEM]** NIST/SEMATECH e-Handbook of Statistical Methods, 6.3.2.1 Shewhart X-bar and R and S control charts (A2, D3, D4 table; A2 = 3/(d2 sqrt n), D3/D4 = 1 -/+ 3 d3/d2), https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc321.htm ; 6.3.2.2 Individuals control charts (limits x-bar +/- 3 MR-bar/1.128, flow-rate worked example), https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc322.htm . Section 6.2.3 (single sampling plans, OC curve, AOQ) cited by name.
- **[YORK]** University of York, Department of Mathematics, "Factors useful in the construction of control charts", https://www.york.ac.uk/depts/maths/tables/controlfactors.htm . Agrees with NIST on A2; differs in the last digit on D4 for n = 2 to 6 and 8 and D3 for n = 8 (the computed values round to NIST's).
- **Own derivation (tests):** d2 and d3 by numerical integration of the range distribution of n standard normal values (Simpson and trapezoid rules; n = 2 against the closed forms 2/sqrt(pi) and sqrt(2 - 4/pi)); binomial and Poisson acceptance probabilities checked against direct sums.

## Materials reference (`app/matref.js`, `core/src/matref.rs`, `data/refdata/matref-evidence.json`)

Temper and heat-tint colours, heat treatment, galvanic series and two-metal check, machining
plastics, metal identification. Decisions, agreement rules and findings in
`docs/materials-reference.md`. All accessed 2026-11-11; the app lists each source under its
screen with title and URL.

### Colours
- **[NAVY_AM]** US Navy, Aviation Structural Mechanic (AM) training manual, Table 6-2 (public domain). https://navyaviation.tpub.com/14315/Table-6-2-Color-Chart-For-Various-Tempering-Temperatures-Of-Carbon-Steel-251.html
- **[WYS]** West Yorkshire Steel, Steel tempering temperatures colour chart. https://www.westyorkssteel.com/technical-information/steel-heat-treatment/tempering-temperatures/
- **[WIKI_HC]** Wikipedia, Heat coloring of metals (steel row citing O. P. Kraemer 1983; stainless row citing the British Stainless Steel Association, counted as **[BSSA]**). https://en.wikipedia.org/wiki/Heat_coloring_of_metals
- **[HTT]** Heat Treat Today, D. Herring, "What are the heat tint colors for stainless steel and when do they form?" (2026-07-21). https://www.heattreattoday.com/?p=69814

### Heat treatment (steel makers' and stockists' data sheets)
- Uddeholm (voestalpine): Arne (O1, ed. 11 2019), Sverker 21 (D2, ed. 13 2019), Orvar Supreme (H13, ed. 13 2021); voestalpine HPM Denmark HSS/M2 1.3343 (2025). URLs in the evidence file.
- Doerrenberg Edelstahl: 1.2510, 1.2363, 1.2344 (02/24). Lucefin Group: C45E and 42CrMo4 (rev. 2024), 1.2379 (rev. 2018).
- Hudson Tool Steel: A2, S7 technical data. GMH Gruppe: SWG 2357 (AISI S7, 09/2020).
- Atlas Steels: 4340 (2021), 416, 420, 630/17-4PH (print date 8 June 2021). Aalco: 1.4005 (416, same text as Atlas, counted once), 1.4125 (440C), 1.4542 (17-4PH naming rule). ATI: 410/420/425 Mod/440A/440C data sheet v1 (2014).

### Galvanic corrosion
- **[GERR]** Dave Gerr, Controlling Galvanic Corrosion, part 1 (1991, 2010): seawater series in mV vs Ag/AgCl; 0.20 V rule. https://www.gerrmarine.com/Articles/controllingcorrosionpt1.pdf
- **[WIKI_GS]** Wikipedia, Galvanic series (order in stagnant seawater, citing MIL-STD-889C). https://en.wikipedia.org/wiki/Galvanic_series
- **[EE_GALV]** Engineers Edge, Galvanic compatibility (anodic index; 0.15 / 0.25 / 0.50 V). https://www.engineersedge.com/galvanic_capatability.htm
- **[CARRLANE]** Carr Lane, Practical guideline for the anodic index of materials in different environments. https://www.carrlane.com/engineering-resources/technical-information/galvanic-corrosion/practical-guideline-for-the-anodic-index-of-materials-in-different-environments
- **[MISUMI_GALV]** MISUMI USA, Galvanic compatibility and corrosion table (different scale; listed, not used in the check). https://us.misumi-ec.com/blog/galvanic-compatiblity-and-corrosion-table/
- MIL-STD-889 (Dissimilar metals) is cited by name only, through the sources above.

### Plastics
- **[MCAM_TK]** Mitsubishi Chemical Advanced Materials, Guide to machining plastic parts (Machinist Toolkit, A4 EU metric). https://www.mcam.com/mam/41701/MCG-Machinist-Toolkit-A4-EU-metric.pdf
- **[ENSINGER_MG]** Ensinger, Machining Engineering Plastics (hosted by Curbell Plastics; 09/12 edition). https://www.curbellplastics.com/wp-content/uploads/2022/11/Machining-Engineering-Plastics.pdf
- **[BOEDEKER_T]** Boedeker Plastics, Plastic turning machining guidelines. https://www.boedeker.com/Technical-Resources/Plastic-Machining-Guidelines/Plastic-Turning-Machining-Guidelines
- **[WSH]** W.S. Hampshire, Thermoplastic properties chart. https://catalog.wshampshire.com/Asset/Plastic-Properties.pdf
- **[PROPLAS_T]** Professional Plastics, Thermal properties of plastic materials. https://www.professionalplastics.com/professionalplastics/content/downloads/ThermalPropertiesofPlasticMaterials.pdf

### Metal identification
- **[NAVY_SW]** US Navy, Steelworker training manual, chapter 1, spark, chip and magnetic tests (public domain). https://tpub.com/steelworker1/6.htm

### Findings (from `scripts/build_refdata.py`)
- Temper colours of carbon steel: 7 confirmed, 1 with an outlier, 1 differs, 4 single source. Stainless heat tint: 5 single source (BSSA).
- Heat treatment: 70 values for 12 steels: 2 confirmed (D2 hardening, 420 annealing), 16 differ, 38 single source, 14 printed text. 17-4PH: naming rule confirmed; H900-H1150 °C, times and properties single source (Atlas). Tempering-hardness tables: none shown (no two publishers agree on one).
- Galvanic: seawater potentials (33) and anodic indices (19) single source; environment limits confirmed (3).
- Plastics: 79 values: 15 confirmed (10 of 12 maximum service temperatures, 3 expansions, PA6 annealing, PEI rake), 39 differ (all but one of the cutting-data comparisons), 25 single source.
