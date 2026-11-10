# Sources

Every formula, table value and design idea in BenchMate is referenced here. Data files carry short keys (e.g. `TWI`) that resolve to this list. Accessed dates are when the source was read for this project.

## Formulas (`core/src/lib.rs`)
These are standard machining formulas, published in many references. Each function's doc comment names where it is published. Worked-example tests in `core/src/lib.rs` were computed independently.
- **[MH]** Oberg, Jones, Horton, Ryffel. *Machinery's Handbook*, Industrial Press (31st edition, 2020). Chapters: speeds and feeds; surface texture; tapers; twist drills; screw thread systems and three-wire measurement; hole circles; machining econometrics (tool life, minimum-cost cutting); areas of plane figures (bar stock sections).
- **[SAN]** Sandvik Coromant, "Formulas and definitions" for turning, milling and drilling (public web pages and Technical Guide). Milling includes circular ramping and helical interpolation: feed at tool centre = Vf x (Dm - Dc) / Dm inside a hole, Vf x (Dm + Dc) / Dm outside. sandvik.coromant.com
- **[ISO 68-1]** ISO 68-1:1998, ISO general purpose screw threads, basic profile (basis of the 0.649519 P pitch-diameter relation).
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

## Tool material data (Young's modulus presets, `app/tools.js` `E_PRESETS`)
- **Solid carbide, 580 GPa:** Ceratizit grade CTS20L (cemented carbide, 10% Co binder), elastic modulus 580 GPa at 23 C. Read from the grade's property listing as republished at https://www.mfgrobots.com/Article/material/composite/33306.html (accessed 2026-11-10); the Ceratizit primary data sheet (cdn.plansee-group.com) could not be fetched in this session and should be checked. Range check: Tungaloy catalogue grade table (page 38, https://allindustrial.com/content/catalogs/vendors/tungaloy/files/basic-html/page38.html, accessed 2026-11-10) lists cemented carbide grades from 490 GPa (UX30) to 660 GPa (G1F); the same listing site shows Ceratizit CTS22D 570, CTU16L 605, CTU06M 665 GPa. The preset is therefore one typical grade, not a universal value; users should enter their tool maker's figure.
- **HSS (M2, 1.3343), 219 GPa:** voestalpine High Performance Metals Denmark, "Datablad HSS/M2/W 1.3343" (Uddeholm site), physical properties at 20 C, elasticitetsmodul 219 x 10^3 N/mm^2. https://www.uddeholm.com/app/uploads/sites/239/2025/08/Datablad-HSS_M2_W-1.3343.pdf (accessed 2026-11-10).

Status: the formulas are standard and were checked against worked examples; page-level citations (edition and page) are still to be added for each function.

## Material equivalents (`data/evidence/`, `data/materials.json`)
Every material source document (102 so far, from publishers including TWI, Outokumpu, the International Stainless Steel Forum (ISO 15510), Atlas Steels, Aalco, Lucefin, Ovako, Smiths Metal Centres, Kennametal, Mitsubishi Materials, West Yorkshire Steel, Doerrenberg, Erasteel, BGH, Aubert & Duval, the Aluminum Association, Diehl, Alumeco and others) is listed with title, URL and access date in **`docs/material-sources.md`** (generated) and in the app under the table. Values were read through an automated page reader; verbatim rows are stored so any transcription can be checked.

Underlying standards the designations come from (not yet read directly): EN 10027-1/-2, EN 10088, EN 10083/10084/10087, EN ISO 4957, ISO 15510, BS 970, BS 4659, EN 573-3, EN 1706, EN 1412/CEN TS 13388, EN 1561, EN 1563, ASTM A48, ASTM A536, JIS G4051/G4053/G4303/G4404, SAE J403/J404, SAE HS-1086 (UNS).

## Feature research
- CNC Machinist Calculator Ultra: in-app menus viewed 2026-11-10 and public pages https://cncmachinistcalculatorultra.com/homePage , https://cncmachinistcalculatorultra.com/tools/machining-chatter , https://apps.apple.com/app/id6474093839 . Used only as a feature checklist.
- CNCCookbook, "28 feeds and speeds features to try in G-Wizard Calculator". https://www.cnccookbook.com/28-feeds-and-speeds-features-to-try-in-g-wizard-calculator
- better-tool-library, feeds and speeds notes. https://github.com/knipknap/better-tool-library/blob/main/docs/feeds-and-speeds.md
- FSWizard store listing. https://play.google.com/store/apps/details?id=com.beta.fswizard
- Sample manufacturer catalogue pages supplied by Jacob (Cutwel Alu-Splitter milling range; MAE/MAS drilling conditions sheet), used to design the PDF importer. Not redistributed.

## Design
- Alkart Mega Wizard (jkdesignpro) UI tokens, `amw/static/index.html`.
