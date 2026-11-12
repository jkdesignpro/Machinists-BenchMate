# GD&T section: sources and decisions

This file records where every rule in BenchMate's GD&T section comes from,
how it was checked, and what is still open. It goes with:

- `core/src/gdt.rs`: the formulas (bonus, virtual and resultant condition,
  true position, position / plus-minus conversion, fastener formulas,
  worst-case and RSS stacks), with tests against our own worked examples;
- `app/gdt.js`: the reference guide, the feature control frame builder and
  the stack screen; symbols and diagrams are our own SVG drawings;
- the GD&T entries in `app/tools.js`.

## Ground rules

1. **No copying.** ASME Y14.5 and the ISO GPS standards are copyrighted, and
   so are Machinery's Handbook and the other books. Nothing was copied from
   them: no text, figures, tables or worked examples. Standards are cited by
   name, year and (where a public source gives it) clause number only. The
   Machinery's Handbook PDF was not opened for this section.
2. **Two independent sources.** Every rule stated in the UI is confirmed in
   at least two independent free public sources (listed below). Each
   statement in the guide shows the keys of the sources that confirm it.
   Where we found only one source, or sources disagree, the UI says
   **"to be verified"** and the item is listed at the end of this file.
3. **Current editions.** BenchMate is written for the current editions.
   Each edition and its status was checked on the standards body's own
   catalogue page (table below). Older practice is called out where it
   differs.
4. **Pure arithmetic** (e.g. 2 x sqrt(dx^2 + dy^2), the circle round a
   square, RSS of a list) is our own derivation with tests; it is cited as
   `OWN` and also checked against published explanations.

## Current editions (checked 2026-11-10)

| Standard | Status on the standards body's catalogue | URL |
|---|---|---|
| ASME Y14.5-2018 | Current; shown as "Y14.5 - 2018 (R2024)", i.e. reaffirmed 2024; on stabilized maintenance; replaces Y14.5-2009 | https://www.asme.org/codes-standards/find-codes-standards/y14-5-dimensioning-tolerancing/2018 |
| ISO 1101:2017 | Published, edition 4 (2017-02); last reviewed and confirmed 2022; remains current | https://www.iso.org/standard/66777.html |
| ISO 5459:2024 | Published, edition 3 (2024-10, stage 60.60 on 2024-10-04), 115 pages, ISO/TC 213; ISO 5459:2011 listed under "Previously" as **withdrawn** (round 3, read on committee.iso.org, the ISO committee mirror of the catalogue page). BSI's page for BS EN ISO 5459:2024 agrees (published 2024-10-31 as the British adoption, current, supersedes the 2011 edition) and summarises the changes: surface classes beyond planes, cylinders and spheres (Annex B), new definitions, some symbols and modifiers added or clarified | https://committee.iso.org/standard/87855.html ; https://knowledge.bsigroup.com/products/geometrical-product-specifications-gps-geometrical-tolerancing-datums-and-datum-systems-2 ; https://www.iso.org/standard/40358.html |
| ISO 2692:2021 | Published, edition 4 (2021-06); under systematic review (90.20), no newer edition listed | https://www.iso.org/standard/74592.html |
| ISO 8015:2011 | Published, edition 2 (2011-06); last reviewed and confirmed 2021; remains current | https://www.iso.org/standard/55979.html |
| ISO 22081:2021 | Published, edition 1 (2021-02); last reviewed and confirmed 2026; remains current. Refers to ISO 8015:2011 clause 5.12 for general specifications | https://www.iso.org/standard/72514.html |
| ISO 2768-2:1989 | **Withdrawn** (status 95.99). The ISO page does not name a replacement; SIS (Swedish standards body) lists "Replaced by: ISO 22081:2021" and Genorma gives withdrawal 2021-02-04 and "revised by ISO 22081:2021" (round 3) | https://www.iso.org/standard/7749.html |

Superseded practice noted in the UI:

- **Concentricity and symmetry** were in ASME Y14.5-2009 and are removed
  from Y14.5-2018 (sources MIT, GLS). They remain in ISO 1101:2017 (KEY lists
  both). The builder flags them as invalid on an ASME Y14.5-2018 frame.
- **ISO 2768-2:1989** (general geometrical tolerances) is withdrawn in the
  ISO catalogue; ISO 22081:2021 is the current ISO standard for general
  geometrical specifications. Whether ISO formally names 22081 as the
  replacement could not be confirmed on iso.org (the 22081 page does not
  mention 2768-2). Round 2: the Genorma catalogue [GEN] gives the withdrawal
  date 2021-02-04 and lists ISO 22081:2021 under "revised by". Round 3: the
  Swedish standards body SIS [SIS] lists ISO 2768-2:1989 as withdrawn and
  "Replaced by: ISO 22081:2021". Two sources: **confirmed**, flag removed.
- **Circled S (RFS symbol)** appears on older drawings (UIUC notes, SKL).
  Round 3: the 2012 GLS/Stolter edition chart [GLS12] gives the symbol as
  required for RFS position in ANSI Y14.5M-1982, "OK for position, legacy"
  in Y14.5M-1994 and "default condition; no symbol" in Y14.5-2009. That
  reconciles OEP (dropped as a requirement in 1994) and KEY (gone in 2009):
  1994 made RFS the default and kept the symbol only as a legacy option;
  2009 removed it. **Confirmed** in that form.
- **ISO 5459:2011, ISO 2692:2014, ISO 8015:1985** are superseded by the
  editions above.
- Several public sources (e.g. GD&T Basics' standard overview, 2020-2022)
  still teach Y14.5-2009; BenchMate used them only for rules that are
  unchanged in 2018 and cross-checked against a 2018-era source (GLS chart,
  MIT presentation) where the rule could have changed.

## Sources (all accessed 2026-11-10)

Standards bodies (status only, not content):

- **[ISO]** ISO online catalogue pages listed in the table above.
- **[ASME]** ASME catalogue page for Y14.5-2018, URL above.

Independent public explanations (each counts as one source):

- **[MIT]** J. Salsbury, "GD&T and the new ASME Y14.5-2018", Mitutoyo America
  Corporation (Mitutoyo Institute of Metrology), 2019.
  https://www.mitutoyo.com/webfoo/wp-content/uploads/ASME_Y14.5-2018_Salsbury.pdf
  Used for: concentricity and symmetry removed in 2018 (the presentation
  points to Y14.5-2018 para. A-8.4 in the appendix of changes); new rules
  4.1(q) and 4.1(s).
- **[GLS]** Geometric Learning Systems, GD&T reference chart for ASME
  Y14.5-2018, 2019. https://gdtseminars.com/wp-content/uploads/2019/10/GDTreferenceChart2018.pdf
  Used for: datum use per characteristic (form never; orientation, runout,
  position always, position except coaxial; profile usually), concentricity
  and symmetry marked removed in 2018, list of modifiers (M, L, I, F, P, U, T),
  MMB/LMB on datum references, runout without MMC. The PDF text extraction
  scrambled some columns, so only rows that are consistent with a second
  source were used.
- **[GDTB]** GD&T Basics (gdandtbasics.com), articles:
  virtual condition at RFS (https://www.gdandtbasics.com/?p=7052),
  ISO vs ASME (https://www.gdandtbasics.com/iso-vs-asme-standards/),
  independency (https://www.gdandtbasics.com/independency/ and https://www.gdandtbasics.com/?p=8430),
  envelope requirement (https://www.gdandtbasics.com/envelope_requirement/),
  datums and degrees of freedom (https://www.gdandtbasics.com/datums-control-degrees-of-freedom/),
  true position (https://www.gdandtbasics.com/true-position/),
  the ASME Y14.5 standard (https://www.gdandtbasics.com/asme-y14-5-gdt-standard/),
  circularity (https://www.gdandtbasics.com/circularity/),
  cylindricity (https://www.gdandtbasics.com/cylindricity/),
  flatness (https://www.gdandtbasics.com/flatness/),
  flatness surface vs feature of size (https://www.gdandtbasics.com/flatness-surface-vs-feature-of-size/),
  straightness (https://www.gdandtbasics.com/straightness/),
  MMC (https://www.gdandtbasics.com/maximum-material-condition/),
  unequally disposed profile (https://www.gdandtbasics.com/unequally-disposed-profile/),
  profile of a surface (https://www.gdandtbasics.com/profile-of-a-surface/),
  parallelism (https://www.gdandtbasics.com/parallelism/),
  symbols (https://www.gdandtbasics.com/gdt-symbols/),
  runout (https://www.gdandtbasics.com/runout/),
  total runout (https://www.gdandtbasics.com/total-runout/).
- **[KEY]** KEYENCE, "GD&T" measurement guide: symbol list
  (https://www.keyence.com/ss/products/measure-sys/gd-and-t/symbol-list/),
  datum targets (https://www.keyence.com/ss/products/measure-sys/gd-and-t/datum/target.jsp),
  datum systems, position, MMC/LMC pages under the same path.
  Used for: modifier list incl. which are ASME-only (T, U, ST, CF; ISO uses UZ),
  E as the envelope requirement, F, P, L, M, datum targets, MMC/LMC use.
- **[UIUC]** University of Illinois Urbana-Champaign, ME 170 Engineering
  Drawing Notes (part C, unit 8, pp. 83-91).
  https://courses.grainger.illinois.edu/me170/fa2019/Engineering_Drawing_Notes_B.pdf
  Used for: purpose of GD&T; form tolerances take no datum; zones of each
  characteristic; MMC/LMC definitions; datum order (first letter primary);
  projected tolerance zone; runout types; basic dimensions. These notes
  show older practice in places (circled S for RFS), so they were only used
  where a current source agrees.
- **[HZ]** Z. Humienny, P. Zdrojewski, "ISO GPS and ASME GD&T standards:
  differences and similarities in definitions of measurands", Metrology and
  Measurement Systems 30(4), 2023, pp. 791-808. https://czasopisma.pan.pl/Content/130314
  Used for: ISO 8015 independency principle as the ISO default and two-point
  size; ASME Rule #1; envelope requirement in ISO 14405-1; straightness of an
  axis cancels Rule #1; ISO invocation principle; ASME position only for
  features of size (ISO also for planes); ISO common datum A-A.
- **[SKL]** Skill-Lync resources: material condition modifiers
  (https://resources.skill-lync.com/courses/gdt-fundamentals/material-modifiers)
  and floating/fixed fastener formulas
  (https://resources.skill-lync.com/branches/mechanical-engineering/questions/design-cad/gdt-fastener-floating-fixed).
- **[OEP]** Open Exam Prep, ASME GDTP study guide: fixed and floating fastener
  formulas (https://open-exam-prep.com/study-guides/asme-gdtp-senior/location-2/fixed-floating-fasteners)
  and virtual/resultant condition formulas
  (https://open-exam-prep.com/study-guides/asme-gdtp-senior/strategy-calculations/virtual-condition-calc-reference).
- **[JLC]** JLCCNC blog, "Maximum Material Condition (MMC) in GD&T" and
  "Least Material Condition (LMC) in GD&T", 2026.
  https://jlccnc.com/blog/maximum-material-condition ; https://jlccnc.com/blog/least-material-condition
- **[CNCC]** CNCCookbook, "Beginner's Guide to GD&T: Datums" (updated
  2024-03-16). https://www.cnccookbook.com/gdt-course-datums/
- **[WEV]** B. O'Neill, "True position in GD&T: formula, tolerance zones and
  MMC", Wevolver, 2026. https://www.wevolver.com/article/true-position-in-gdt-formula-tolerance-zones-and-mmc
- **[ACC]** F. Schenkelberg, "Root sum squared tolerance analysis method",
  Accendo Reliability. https://accendoreliability.com/root-sum-squared-tolerance-analysis-method/
- **[FARO]** O. Ekinci, "Understanding composite positional tolerances in
  GD&T", FARO Technologies (cites ASME Y14.5-2018 section 10.5).
  https://www.faro.com/en/Resource-Library/Article/understanding-composite-positional-tolerances-in-gd-t
  Used for: PLTZF/FRTZF meaning; lower row datums orient only; lower row
  zones move as a group.
- **[DCS]** Dimensional Control Systems, 3DCS help manual, "Composite GD&T".
  https://community.3dcs.com/help_manual/composite-gdt.htm
  Used for: upper row locates the pattern, lower row relates the features to
  each other; lower row repeats datums for orientation only.
- **[GDTB]** (round 2 addition) "Composite position vs multiple single
  segment" https://www.gdandtbasics.com/composite-position-vs-multiple-single-segment-tolerances/
- **[OEP]** (round 2 additions):
  unequal disposition, citing Y14.5-2009 8.3.1.2 (https://open-exam-prep.com/study-guides/asme-gdtp-technologist/ch10/disposition-unequally-disposed);
  profile modifiers, citing Y14.5-2009 8.5 (https://open-exam-prep.com/study-guides/asme-gdtp-technologist/ch10/profile-combined-controls-modifiers);
  LMC position (https://open-exam-prep.com/study-guides/asme-gdtp-technologist/ch9/lmc-position-applications);
  material condition concepts (https://open-exam-prep.com/study-guides/asme-gdtp-technologist/ch2/material-condition-concepts).
- **[KEY]** (round 2 addition) location tolerance page
  https://www.keyence.com/ss/products/measure-sys/gd-and-t/type/location-tolerance.jsp
  Used for: coaxiality zone (cylinder about the datum axis), symmetry zone
  (two planes symmetric about the datum centre plane), RFS symbol history.
- **[GEN]** Genorma standards catalogue, ISO 2768-2:1989 page
  https://genorma.com/en/standards/iso-2768-2-1989
  Used for: withdrawal date 2021-02-04 and "revised by ISO 22081:2021".
- **[PTC]** PTC Creo Parametric 13 help, model-based definition (round 3):
  "Optional modifiers (ASME)"
  (https://support.ptc.com/help/creo/creo_pma/r13/usascii/model-based_definition/optional_modifiers.html)
  and "Datum feature label has syntax errors (ASME)"
  (https://support.ptc.com/help/creo/creo_pma/r13/usascii/model-based_definition/gdt_datum_label_invalid.html).
  Used for: statistical tolerance note and use; projected zone (minimum
  height, feature of size, limits tilt, fixed fasteners); tangent plane
  applies to the contacting plane of a surface; datum labels exclude I, O, Q.
- **[GLS12]** Stolter LLC and Geometric Learning Systems, edition comparison
  chart (ASME Y14.5-2009, Y14.5M-1994, ANSI Y14.5M-1982, ISO), 2012, hosted
  on the ZEISS Quality Forum.
  https://qualityforum.zeiss.com/migration/images/164_7dbf6b039a080958cc59411c619ac190.pdf
  Used for: RFS symbol by edition; composite profile defined in 1994 and 2009.
  GLS is the same company as [GLS]; the two are not counted as two
  sources for the same statement.
- **[HEX]** Hexagon Manufacturing Intelligence, PC-DMIS 2023.1 help,
  "Profile of a line".
  https://docs.hexagonmi.com/pcdmis/2023.1/en/helpcenter/mergedprojects/core/geometric_tolerances/Profile_of_a_Line.htm
  Used for: composite profile lower segments unlocked in translation from the
  datum reference frame, still located and oriented to each other; lower
  segment datums: same datums, same order, same modifiers, may drop trailing
  ones.
- **[SIS]** SIS Swedish Institute for Standards, ISO 2768-2:1989 page.
  https://www.sis.se/en/produkter/metrology-and-measurement-physical-phenomena/linear-and-angular-measurements/limits-and-fits/iso276821989
  Used for: withdrawn, "Replaced by: ISO 22081:2021".
- **[QM]** E. Morse, "Tolerancing standards: a comparison", Quality
  Magazine, 2016-08-01. https://www.qualitymag.com/articles/93437-tolerancing-standards-a-comparison
  Used for: ISO allows position on a single plane; ASME does not (a plane is
  not a feature of size), profile of a surface instead. (Written against
  Y14.5-2009; this rule is unchanged in 2018 per HZ.)
- **[PMPA]** Precision Machined Products Association, "pseudo-round" parts
  article (about 2010). https://www.pmpa.org/tag/pseudoround/
  Used for: odd-lobed parts read round on a two-point gauge; V-block
  included angle chosen from the lobe count.
- **[MMS]** G. Schuetz (Director of Precision Gages, Mahr Inc.), "Approximating
  geometry measurement", Modern Machine Shop, 2008-08-20.
  https://mmsonline.com/columns/approximating-geometry-measurement
  Used for: a two-point gauge cannot detect three-lobed out-of-roundness; odd
  lobing from three-jaw chucks, even lobing in precision boring.
- **[OEP]** (round 3 additions): statistical tolerancing, citing Y14.5 2.17
  (https://open-exam-prep.com/study-guides/asme-gdtp-technologist/ch3/threads-tapers-radius-statistical);
  composite profile, citing Y14.5-2009 8.6
  (https://open-exam-prep.com/study-guides/asme-gdtp-technologist/ch10/composite-profile-patterns);
  Appendix B position calculations
  (https://open-exam-prep.com/study-guides/asme-gdtp-senior/location-2/position-coordinate-conversion);
  virtual and resultant condition (senior)
  (https://open-exam-prep.com/study-guides/asme-gdtp-senior/location-1/virtual-resultant-condition).
- **[GDTB]** (round 3 addition) "Datum" article, author's replies in the
  comments (M. Derr): letters I, O, Q prohibited; AA, AB ... after Z.
  https://www.gdandtbasics.com/datum/
- **[FF]** W. Burke, "Introduction to root sum squared (RSS) tolerance
  analysis", Five Flute. https://fiveflute.com/guide/introduction-to-root-sum-squared-rss-tolerance-analysis

Read in round 3 but not used to confirm anything: GLS "What is resultant
condition?" (https://gdtseminars.com/?p=71, gives the MMC hole case only);
WASY Research, "Wall-thickness analysis and LMC modifiers" (LMC virtual
condition only, no resultant condition); GD&T Basics LMC article
(https://www.gdandtbasics.com/?p=2590, no boundary formulas); GLS "The new
ASME Y14.5-2018 standard" (2019, lists dynamic profile, nothing on profile
at MMC); Effective Training / geotol.com "2018 standards" page (list of 2018
changes, nothing on the open items); OEP senior "coaxial feature controls"
page (single requirement for coaxial features, but datums not discussed).
Not used: a copy of the ASME standard found by search on a third-party site
(copyright); eng-tips and Reddit threads (forums).

Read but not used to confirm anything (did not cover the points): MMS
(Modern Machine Shop), G. Schuetz, "Determining out-of-roundness at the point
of manufacture", 2022 (excerpt only, nothing usable on lobing); Sigmetrix,
"Comparing GD&T standards: ISO GPS vs. ASME Y14.5" (2025/2026); GrabCAD
tutorial on Y14.5-2018 terms; ZEISS Quality Forum thread on ISO 8015
(user forum, not ZEISS staff).

## Statement check list

| Statement | Sources |
|---|---|
| True position deviation (diameter) = 2 x sqrt(dx^2 + dy^2); factor 2 because the zone is a diameter | GDTB, WEV, OWN |
| Square plus/minus zone versus circle round it: about 57% more area (pi/2) | GDTB, WEV, OWN |
| MMC = smallest hole / largest pin; LMC the opposite | GDTB, SKL, JLC, UIUC |
| Bonus = departure from MMC (MMC modifier) or from LMC (LMC modifier); none at RFS | GDTB, SKL, JLC, OEP |
| RFS is the default when no modifier is shown | GDTB, SKL |
| Virtual condition: MMC hole = MMC - t, MMC pin = MMC + t, LMC hole = LMC + t, LMC pin = LMC - t | GDTB, SKL, JLC, OEP |
| Inner/outer boundary at RFS has the same arithmetic but is not a virtual condition | GDTB (one source; shown as RFS boundary only) |
| Resultant condition at MMC: hole = LMC + t + size tol., pin = LMC - t - size tol. | OEP, OWN (follows from the confirmed bonus and VC rules) |
| Resultant condition at LMC | OWN only. Round 3 read GLS, OEP (senior), WASY and GDTB LMC pages: none gives the LMC case. **to be verified** |
| Functional gauge pin = hole MMC - position tolerance, at basic locations | GDTB, SKL (pin VC example) |
| Floating fastener T = H - F each part | OEP, SKL |
| Fixed fastener t1 + t2 = H - F; equal split (H - F)/2 | OEP, SKL |
| Fastener formulas are in a Y14.5 nonmandatory appendix (B in 2009) | GDTB (appendix B, 2009), OEP senior ("Appendix B, Formulas for Positional Tolerancing", "for every revision"): 2018 letter has one source, **to be verified**; UI names B for 2009 |
| Worst case = sum of tolerances; RSS = sqrt(sum of squares), assumes independent, normal, centred, tolerance = 3 sigma | ACC, FF, OWN |
| Form tolerances never take datums | GLS, UIUC, GDTB |
| Orientation and runout always need a datum | GLS, UIUC, GDTB |
| Position needs datums (coaxial exception) | GLS, GDTB: exception detail from GLS only, **to be verified** |
| Profile: datums optional; without datums controls form only; equal bilateral by default | GDTB, GLS ("usually"), KEY (profile listed with form) |
| MMC/LMC only on features of size | GDTB, JLC, SKL |
| No MMC on circularity, cylindricity, runout, concentricity, symmetry | GDTB, SKL, GLS |
| MMC/LMC on the profile tolerance value: not allowed in Y14.5-2009 (profile is RFS) | GDTB, OEP (cites 2009 8.5). SKL notes a 2018 use: 2018 position **to be verified**, builder warns |
| MMB/LMB on datum references of a profile frame is allowed when the datum feature is a feature of size | OEP, GLS |
| Straightness/flatness on a feature of size: derived median line/plane, MMC allowed, overrides Rule #1 | GDTB, HZ |
| Circularity zone: two concentric circles, radial; cylindricity: two coaxial cylinders | GDTB, UIUC |
| No diameter symbol on runout, cylindricity | GDTB, UIUC (zones are radial) |
| Parallelism on a surface implies flatness; orientation does not locate | GDTB, UIUC |
| Total runout controls cylindricity, straightness, taper, coaxiality; on a face, flatness | GDTB, UIUC |
| Flatness inspection: part on granite without levelling measures parallelism | GDTB (inspection note, not a rule) |
| Rule #1: perfect form at MMC; independency (I) switches it off; ASME only | GDTB, HZ, GLS |
| ISO 8015 independency principle is the ISO default; envelope (E) on request, ISO 14405-1 | HZ, GDTB, KEY |
| ISO invocation: one GPS reference invokes the system; ASME cites its edition | HZ only: **to be verified** |
| Datum feature / datum / simulator definitions | GDTB, KEY, CNCC |
| 3-2-1 contacts and six degrees of freedom (3, 2, 1 removed) | GDTB, CNCC |
| Datum order = order in the frame, not alphabetical | UIUC, CNCC, GDTB |
| Datum targets | KEY, CNCC |
| MMB on a datum feature of size: simulator fixed at boundary; part may shift; shift is not bonus | GLS, GDTB, OEP: confirmed (round 2) |
| A plane datum feature has no size, so takes no MMB/LMB | OEP, GDTB |
| Concentricity and symmetry removed in Y14.5-2018 | MIT, GLS |
| ISO coaxiality zone: cylinder of the tolerance diameter about the datum axis; concentricity: circle about the datum point in a section | KEY, UIUC: confirmed (round 2) |
| ISO symmetry zone: two parallel planes symmetric about the datum centre plane | KEY, UIUC: confirmed (round 2) |
| Circled S (RFS): required for RFS position in 1982; legacy option only in 1994; no symbol from 2009 | GLS12 (all three editions), OEP (1994), KEY (2009): confirmed (round 3) |
| Composite position: one symbol, two rows; upper row (PLTZF) locates the pattern to the datums | FARO, DCS, GDTB |
| Lower row (FRTZF): tighter, controls the features relative to each other; its zones move as a group; its datums orient only | FARO, DCS, GDTB |
| Multiple single-segment (two symbols) differs: the lower row's datums also locate | GDTB, DCS |
| Each feature must lie in both its PLTZF and FRTZF zones | FARO, DCS |
| Projected zone above the part for mating parts, threaded/press-fit holes | UIUC, KEY, GDTB |
| Free state, tangent plane, CF | KEY, GDTB, GLS |
| Unequal profile: U in ASME, UZ in ISO | KEY, GDTB |
| Second value after U = part of the zone on the material-adding side (outside the material); 0 = all inside, equal to total = all outside | GDTB (cites 2018 6.3.22), OEP (cites 2009 8.3.1.2): confirmed (round 2) |
| Statistical tolerance (ST): assigned by a statistical stack; drawing note requires SPC; ASME only | KEY, OEP (cites 2.17), PTC: confirmed (round 3) |
| Position applies to plane surfaces in ISO, not in ASME | HZ, QM: confirmed (round 3) |
| ISO invocation principle | HZ only: **to be verified** |
| Datum letters I, O, Q not used; AA, AB ... after Z | PTC, GDTB (author's comments): confirmed (round 3); the builder now marks I, O, Q invalid (its letter list already leaves them out) |
| Composite profile: upper row locates and orients; lower row smaller, zone unlocked in translation, lower datums orient only; same datums in the same order, trailing ones may be dropped | OEP, HEX: confirmed (round 3); defined in 1994 and 2009 per GLS12, OEP |
| Projected zone: feature of size, limits tilt, fixed fasteners; minimum height stated | UIUC, KEY, GDTB, PTC: confirmed (round 3), builder warning no longer flagged |
| Tangent plane applies to a surface (contacting plane), not an axis | KEY, PTC: confirmed. "Normally with orientation tolerances": not stated by either, the builder note stays flagged |
| Spherical diameter zone normally for position of a sphere | GDTB only: **to be verified** |
| Two-point gauge can read odd-lobed parts (three lobes from a three-jaw chuck, five...) as round, so it is not a roundness check | PMPA, MMS (Schuetz, Mahr, 2008): confirmed (round 3) |
| V-block shows lobing; V included angle chosen from the lobe count | PMPA only: **to be verified** |
| Position without datums for coaxial features | GLS only; OEP senior page describes a single requirement for coaxial features but not the missing datums: **to be verified** |

## Items left "to be verified" (round 2 outcome)

Round 1 left 15 items. Round 2 outcome, item by item:

1. Resultant condition with the LMC modifier: **still flagged.** OEP's LMC
   page covers only the virtual condition; BenchMate's value stays a
   derivation.
2. Position without datums for coaxial features: **still flagged** (GLS
   only).
3. MMB datum feature shift: **confirmed** (GLS, GDTB, OEP). Added: a plane
   datum feature takes no MMB/LMB.
4. MMC/LMC on profile: **corrected, still flagged.** Y14.5-2009 does not
   allow it (GDTB, OEP); the 2018 position is unclear (SKL). The builder
   warning now says this.
5. Value after U: **confirmed** (GDTB citing 2018 6.3.22, OEP citing 2009
   8.3.1.2). The Unequal profile (U) zone calculator is built on it.
6. Statistical tolerance (ST): **still flagged** (KEY only).
7. ISO invocation principle and ISO position on planes: **still flagged**
   (HZ only).
8. ISO coaxiality/concentricity and symmetry zones: **confirmed** (KEY,
   UIUC). The guide text no longer carries the flag.
9. Edition that dropped the circled S: **still flagged, conflict narrowed.**
   All sources agree current ASME shows no RFS symbol; OEP says 1994, KEY
   says 2009.
10. Lobing on V-block and two-point roundness checks: **still flagged** (no
    usable source read).
11. Datum letters I, O, Q: **still flagged** (no source read).
12. Tangent plane, projected zone and spherical diameter usage limits:
    **still flagged** (builder shows these as warnings, not errors).
13. ISO 5459:2024 edition details: **still flagged** (detail page not read).
14. Fastener appendix letter in Y14.5-2018: **still flagged** (UI says
    "nonmandatory appendix" without a letter).
15. ISO 22081 as the replacement for ISO 2768-2: **partly confirmed.** GEN
    gives the withdrawal date (2021-02-04) and lists 22081 as the revision;
    ISO's own page does not say so. One source, so still flagged.

The shared web fetch budget ran out during round 2, which is why items 6, 7,
10-14 were not researched further. Candidate pages for the next round: PTC
Creo help "Optional modifiers (ASME)" and an ETS (Montreal) paper on profile
and ST for item 6; the OEP projected zone and fastener chapter for items 12
and 14; the Mitutoyo RA-10 roundness brochure for item 10.

## Round 3 outcome (2026-11-10/11)

Each open item from round 2, plus the two additions asked for:

1. Resultant condition with the LMC modifier: **still flagged.** GLS's
   resultant condition article, OEP's senior virtual/resultant page, WASY
   Research's LMC wall-thickness article and GD&T Basics' LMC article were
   read; none states the LMC case. The calculator keeps "(derived, see
   note)".
2. Position without datums for coaxial features: **still flagged.** OEP's
   senior coaxial page describes one position requirement for coaxial
   features but does not say the datums are left out.
3. Statistical tolerance (ST): **confirmed** (KEY, OEP citing 2.17, PTC).
   The guide now says what it is (a tolerance from a statistical stack) and
   that the drawing must carry the SPC note; the builder note is no longer
   flagged.
4. ISO invocation principle: **still flagged** (HZ only). ISO position on
   planes: **confirmed** (HZ, QM); flag removed in the comparison table.
5. Lobing: **partly confirmed.** A two-point gauge can read an odd-lobed part
   as round (PMPA, MMS). The V-block angle rule has one source (PMPA) and
   keeps its flag. The Mitutoyo RA-10 brochure could not be read (the site
   refuses automated reads).
6. Datum letters I, O, Q: **confirmed** (PTC; GD&T Basics author's replies),
   plus double letters after Z. The builder now marks I, O, Q invalid (its
   letter list already leaves them out) and the guide has a "Datum letters"
   paragraph.
7. Tangent plane / projected zone / spherical diameter limits: projected
   zone **confirmed** (UIUC, KEY, GDTB, PTC: feature of size, limits tilt,
   fixed fasteners, minimum height), warnings no longer flagged. Tangent
   plane on a surface, not an axis: confirmed (KEY, PTC); "normally with
   orientation tolerances" **still flagged**. Spherical diameter "normally
   for position of a sphere": **still flagged** (GDTB only).
8. ISO 5459:2024 details: **confirmed** (ISO committee page: edition 3,
   2024-10, 115 pages; BSI: published 2024-10-31, supersedes 2011, what
   changed). Editions table and comparison row updated.
9. Y14.5-2018 fastener appendix letter: **still flagged, narrowed.** GDTB
   gives Appendix B for 2009; OEP's senior guide calls it "Nonmandatory
   Appendix B, Formulas for Positional Tolerancing" and says the body of
   knowledge names it for every revision. One source for 2018; the UI says
   B for 2009 and flags the 2018 letter. The ANSI webstore preview of
   Y14.5-2018 (which would show the contents) failed to load.
10. ISO 22081 as replacement of ISO 2768-2: **confirmed** (SIS, GEN).
11. MMC/LMC on profile in Y14.5-2018: **still flagged.** No public source
    read in this round addresses the 2018 rule (GLS 2019 article and the
    geotol.com list of 2018 changes do not mention it).
12. Edition that dropped the circled S: **confirmed and corrected**
    (GLS12: required for RFS position in 1982, legacy option in 1994, no
    symbol from 2009; agrees with OEP for 1994 and KEY for 2009).
13. Composite profile: **added** to the guide (OEP, HEX; defined since
    1994 per GLS12 and OEP). No checker: a CMM best fit constrained per row
    is needed.
14. Letter-address table (parity BB73): not present elsewhere (checked
    `app/` on this branch and on `claude/fasteners`, `claude/qa-audit`,
    `claude/ref-data-3`, `claude/calcs-3`, `claude/parity-audit`), so it was
    added to the G and M codes screen. See `docs/gm-codes.md`.

The shared fetch budget ran out several times in this round, so each read was
paced. Candidate pages for round 4: the ANSI webstore preview of Y14.5-2018
(contents list, for the appendix letter and the profile clauses); Mahr or
Taylor Hobson roundness guides (V-block angles); a university GD&T course on
resultant condition with LMC; ISO 8015:2011 preview pages on iso.org OBP
(invocation principle); KEYENCE pages on profile and spherical zones.

## Decisions

- **RFS has no virtual condition.** `virtual_condition` returns NaN at RFS;
  the calculator shows the inner/outer boundary instead, labelled as such
  (GDTB explains they share the numbers but are not the same thing).
- **Out-of-size parts get no bonus.** `bonus_tolerance` returns NaN when the
  actual size is outside its limits, and the calculator says "reject for
  size".
- **Datum feature shift is not added** to position in the true position
  check. It depends on the datum simulator and the whole pattern, so a single
  hole calculator would overstate the allowance.
- **Stack uses mean-centred dimensions.** Unequal plus/minus tolerances are
  converted to a mean and symmetric half tolerance before worst case and RSS.
- **Symbols are drawn as SVG**, not Unicode GD&T glyphs (U+2300-U+23FF,
  circled letters U+24B6-U+24E9), because common shop PCs lack fonts with
  those glyphs. Strokes use `currentColor` and CSS tokens, so they follow the
  light and dark themes.
- **Composite position solver.** The lower row (FRTZF) check finds the
  shift (and, when only the primary datum is repeated in the lower row, the
  small rotation about the pattern centroid) of the zone group that
  minimises the worst hole's need, max over holes of (2 x distance to its
  moved zone centre - bonus). The problem is convex, so nested golden-section
  search finds the exact minimum; tests compare it with grid searches and
  with a minimal enclosing circle. Rotation is linearised (small angles).
- **Composite checker leaves out** perpendicularity to the primary datum
  (also controlled by the lower row; measure it separately) and datum
  feature shift.
- **Unequal profile calculator** gives the two zone limits, the equivalent
  offset (u - t/2 towards the outside) with +/- t/2 for CMM software that
  only takes equal zones, and a pass/fail margin for a measured deviation.
- **Degrees of freedom explainer** uses a three-plane frame: A (removes Tz, Rx, Ry),
  B square to A (Tx, Rz), C square to both (Ty).
  The axis names are BenchMate's choice; sources describe the 3-2-1 counts.
- **Composite profile** is explained in the guide only; there is no
  checker. Its lower row is a best fit with translation free and rotation
  held by the repeated datums, which a CMM does better than a calculator.
- **Frame read-out (0.4.0).** The builder reads the built frame out in plain
  words: the frame said aloud, the demand in one sentence with the zone
  sketch, the datum set-up order, each box in turn, worked sizes, and the
  checking and common-mistake notes of that characteristic from the guide.
  It adds no new rules: every sentence is a rewording of a statement already
  in the check list above (zone shapes, modifiers, datum order, datum
  feature shift, functional gauge at the virtual condition). The worked
  sizes (MMC and LMC size, bonus, tolerance allowed, virtual condition) are
  calls to `core/src/gdt.rs`; the JavaScript only words them. The read-out
  shows the two limit sizes only, so no size is computed in the UI. The
  smoke test checks a hole 10.0 to 10.2 with diameter 0.25 at MMC (0.25 at
  10.00, 0.45 at 10.20, virtual condition 9.75), the same limits as a pin
  (virtual condition 10.45) and at LMC. The zone sketch is the equal case;
  with the U modifier a note says so. An invalid frame is still read box by
  box, under a warning, because seeing what each box would say helps find
  the mistake.
- **ASME is the default** in the builder (US shop drawings); switching to
  ISO 1101:2017 allows concentricity and symmetry.
