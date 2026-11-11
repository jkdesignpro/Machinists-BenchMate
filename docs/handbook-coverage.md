# Handbook coverage plan

Jacob asked that BenchMate cover "basically everything" in four published
reference books, sourced properly or remade. These books are copyrighted. They
are used **only** as a checklist of topics and as a private cross-check of our
numbers. Nothing from them (text, tables, figures, worked examples, layout) is
copied into BenchMate. Every value in the app is rebuilt from sources we may use
and is cited in `docs/sources.md`:

- formulas defined by standards (we cite the standard and clause, we do not
  reproduce its text);
- public-domain works (US government handbooks such as MIL-HDBK, NASA and
  NIST publications, pre-1931 editions of engineering handbooks);
- free manufacturer and standards-body publications;
- our own derivations, with tests against independent worked examples.

Topic names below are generic subject headings, not the books' wording.

Checklist books (names only, never quoted):

- **[MH31]** Machinery's Handbook, 31st ed., Industrial Press, 2020.
- **[EDB]** Clifford Matthews, Engineers' Data Book.
- **[EBB]** Pat Rapp, Engineers Black Book, 2nd ed., 2004.
- **[CNCH]** CNC Machining for Engineers and Makers (course handbook).

Status (re-checked against the code on 2026-11-10; `parity-audit.md`
sections 2-5 list every book's contents line by line): **built** = in the app
and working; **partial** = in the app but covers only part of the topic;
**missing** = not in the app yet, with "in progress" when an unmerged branch is
building it. Book topics outside machining (careers, thermodynamics,
aerodynamics, pressure vessels and similar) are not part of BenchMate.

## Currency check

The books are dated (Engineers Black Book 2004; Machinery's Handbook 2020)
and standards move. For every topic we cite the **current** edition of the
standard and check whether the books' approach still holds. Known changes to
watch, each to be confirmed against the standards body's own catalogue page:

- Surface texture: ISO 1302 and ISO 4287 superseded by ISO 21920 (2021).
- General tolerances: ISO 2768-2 withdrawn; ISO 22081 (2021) is the GPS
  replacement for general geometric tolerances.
- GD&T: ASME Y14.5-2018 removed concentricity and symmetry; ISO 1101 2017
  edition.
- Old national standards (BS 1452, BS 2789, DIN 1691/1693, BS 970 EN
  numbers) are withdrawn; shown as "old" names next to current EN names.
- Hardness conversion: ISO 18265:2013 is current; ASTM E140-26 is the current
  ASTM edition (DIN Media listing, 2026-11-10).
- Tool and insert codes: ISO 1832:2017, ISO 5608:2012 and ISO 513:2012 are
  current (iso.org, 2026-11-10).

Where a book's reasoning or rule of thumb is superseded, BenchMate uses the
current practice and says so in the tool's notes.

## Machining

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Spindle speed, feed, chip load, MRR, power | MH31 EBB | partial (formulas built; power needs kc entered by hand, no kc table) | [MH] formulas, [SAN] |
| Tool life, cost per part (Taylor, Gilbert) | MH31 | built | [TAY] [GIL] |
| Cut optimiser, tool deflection | MH31 EDB | built | [GERE] [ROARK] |
| Arc and helix feed, ramping | CNCH | built | geometry |
| Chip thinning, radial engagement | MH31 | partial (hm and hex in `cutopt`; no compensated feed) | geometry, own derivation |
| Turning surface finish, cut time, taper | MH31 EBB | partial (finish and taper built; cut time is one pass at fixed RPM, no CSS, no taper set-over) | geometry |
| Speeds and feeds starting values by material | MH31 EBB | missing | manufacturer catalogues (Sandvik, Kennametal, Guhring, OSG, Dormer Pramet free PDFs) via the vendor import, never book tables |
| Drilling: point length, thrust, torque, peck | MH31 EBB | partial (point length only) | geometry; thrust/torque from manufacturer formulas |
| Reaming allowances | MH31 | missing | manufacturer data |
| Grinding: wheel speed, marking system, dressing | MH31 EBB | missing | ISO 525 / ANSI B74.13 (cited), wheel maker guides (Norton, Tyrolit) |
| Micromachining | MH31 | missing | manufacturer data |
| Band saw and hacksaw blade selection | EBB | missing | blade maker guides |
| Cutting fluids, refractometer concentration | MH31 EBB | partial (concentration from Brix x the fluid's factor, mix and top-up built; fluid selection missing) | fluid maker data sheets; docs/shop-helpers.md |
| Machining non-ferrous and plastics | MH31 | missing | material supplier machining guides |
| EDM (wire and sinker) basics | MH31 | missing | public process guides |
| Knurling: diameter for pitch | MH31 EBB | built (blank diameter for a whole tooth count, CP/TPI/DP, straight and 30 deg; diameter growth left to trial, makers' tables cited) | DIN 82:1973-01, DIN 403; Dorian and Hommel+Keller catalogues |
| Broaching | MH31 | missing | geometry, maker data |
| Indexing (dividing head, rotary table) | EBB | missing (in progress on `claude/geometry`) | own derivation (40:1 ratio arithmetic) |
| Sine bar, sine plate, gauge block stack | MH31 EBB | missing (in progress on `claude/geometry`) | geometry; gauge sets from ISO 3650 / maker lists |
| CNC: coordinates, work offsets, G/M codes per control | MH31 CNCH EBB | missing | control makers' public manuals; generic profile from ISO 6983 (cited) |
| CNC: 2D/3D toolpath concepts, setups | CNCH | missing | own explanations |
| Shop safety notes | CNCH | missing | HSE / OSHA public guidance |

## Tooling

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Drill sizes: fractional, letter, number, metric, decimal chart | EBB MH31 | built | ASME B94.11M / ISO 235 (cited); number/letter sizes are public facts, cross-checked against several maker charts |
| Tap drill sizes (cut and form taps), percent thread | EBB MH31 | built | formulas from thread standards; form-tap formula from tap makers |
| Broken tap removal, screw extractor drill sizes | EBB | missing | maker data |
| Thread chasers | EBB | missing | maker data |
| Drill point geometry by material, grinding faults | EBB MH31 | missing | own diagrams, maker data |
| End mill types, cutter geometry | EBB MH31 | missing | own explanations |
| Carbide grades, ISO P/M/K/N/S/H groups | EBB MH31 | partial (ISO 513 groups, colours and numbering built; no maker grade chart) | ISO 513:2012 (cited), maker pages |
| Insert designation (ISO 1832) and holder designation (ISO 5608) | EBB | built (metric insert decoder and builder, external holder decoder; inch ANSI B212.4 inserts and ISO 6261 boring bars not decoded; some letters one maker only) | ISO 1832:2017, ISO 5608:2012 (cited); eight maker code keys |
| Tool coatings | EBB | missing | coating maker data (Oerlikon Balzers, Ionbond) |
| Tool steels and cutting tool materials | MH31 EBB | partial (10 tool-steel grades in material equivalents; no selection or heat-treatment data) | supplier data |
| Tapers: Morse, Jacobs, ISO/SK, BT, CAT, HSK, R8 | EBB MH31 | partial: Morse, Jacobs, CAT and BT checked against two publishers; ISO/SK, HSK-A and R8 one source so far; Brown & Sharpe, Jarno, British and DIN metric tapers missing | standards cited (ISO 296, DIN 238, ISO 7388, ISO 12164, JIS B 6339, ASME B5.50), dimensions cross-checked against maker data |
| Pull studs and retention knobs | EBB | partial (standard references only, no dimensions) | maker data, cited standards |
| Collets (ER sizes and ranges) | MH31 | missing (R8 only, under tapers) | ISO 15488 (cited), maker data |
| Burrs, mounted points, files | EBB MH31 | missing | maker data |
| Hole saws | EBB | missing | maker data |
| Tool sharpening and wear | MH31 | missing | own explanations |

## Threads

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Thread over wires | MH31 | partial (60-degree threads, lead angle neglected; no ACME or Whitworth wires) | [MH] wire formula, ISO 68-1 |
| Unified (UNC/UNF/UNEF/UN), all classes | MH31 EBB | partial: basic dimensions; 2A and 2B (including 2B minor) checked against published tables; 1A/3A/1B/3B computed, not checked; no 1B/3B minor limits | ASME B1.1 formulas (cited), values computed and cross-checked |
| ISO metric coarse/fine, tolerance classes | MH31 EBB | partial: coarse/fine basic dimensions, 6g/6H checked; 4h, 6e, 6f, 6h, 8g, 5H, 6G, 7H computed, not checked | ISO 68-1, ISO 261, ISO 965 (cited), computed |
| BSW, BSF, BA, BSP (G and R), NPT, NPTF | EBB MH31 | partial: BSW, BSF, BA, BSP and NPT basic dimensions built; NPTF and tolerances missing | BS 84, BS 93, ISO 228, ISO 7, ASME B1.20.1 (cited) |
| ACME, stub ACME, trapezoidal, buttress | MH31 | missing | ASME B1.5, ISO 2904, ASME B1.9 (cited) |
| Thread forms overview and symbols | EBB | missing | own diagrams |
| Single-point threading: infeed, passes | MH31 | missing | insert maker guides |
| Thread milling | MH31 | missing | own derivation, maker guides |
| Thread rolling blank diameter | MH31 | missing | maker data |
| Helical coil inserts (tap sizes) | MH31 | missing | insert maker data |

## Dimensioning, fits and inspection

| Topic | Books | Status | Planned source |
|---|---|---|---|
| **GD&T: symbols, datums, modifiers, tolerance zones, bonus tolerance, virtual condition** | MH31 EDB | built (guide, frame builder, calculators; see docs/gdt.md) | see "GD&T" below |
| ISO limits and fits (IT grades, all hole/shaft deviations) | MH31 EBB EDB | partial: up to 500 mm, without j/J | ISO 286-1 formulas (cited), computed and checked |
| ANSI preferred fits (RC, LC, LT, LN, FN) | MH31 | missing | ANSI B4.1 (cited) |
| General tolerances (ISO 2768) | EDB | built (`gentol`: ISO 2768-1 linear, edges, angles; five publishers) | ISO 2768-1:1989 (cited), publisher tables |
| Surface texture: Ra/Rz, symbols, process ranges, N grades | MH31 EBB EDB | built (N grades, Ra/Rz caution with computed profile ratios, ISO 21920-1 vs ISO 1302 in our words, process ranges from two publishers; no symbol drawing tool) | ISO 21920-1/-2/-3:2021 (cited), ISO 1302:2002 withdrawn |
| Measuring: micrometer, vernier, dial reading | MH31 | partial (`scales`: micrometer and vernier caliper reading aid; no dial reading) | own drawings; Mitutoyo and PGI reading guides |
| Balls and rolls: countersinks, tapered bores, tapers | MH31 | built (`ballcone`, `taperrolls`) | own derivation, checked against Biegert and NIMI |
| Shrink and press fits | MH31 | built (`shrinkfit`; inputs are yours) | expansion law, Lame equations |
| Temperature compensation of measurements | MH31 | built (`tempcomp`) | thermal expansion data with sources |
| Statistics: Cpk, SPC, tolerance stack (worst case, RSS) | MH31 | partial (1D worst-case and RSS stack; Cp/Cpk/Pp/Ppk with histogram; control charts still to do) | stack: Accendo, Five Flute (docs/gdt.md); Cpk/SPC: NIST/SEMATECH e-Handbook (public domain) |
| Hardness conversion | EBB MH31 | built (steel, ISO 18265 table from two publishers, interpolation shown; no ASTM E140 tables, no non-steel tables) | ISO 18265:2013, ASTM E140-26 (cited) |
| Drawing standards and abbreviations | EBB EDB | partial (`abbrev`: 65 abbreviations in our words; no drawing-standards guide, no weld symbols) | own wording, ISO 128 / ASME Y14.38 cited; Wikipedia, IS 11670 |

## Mathematics and geometry

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Bolt circle, hole coordinates | EBB | built | geometry |
| Right and oblique triangles | MH31 EBB | missing (in progress on `claude/geometry`) | trigonometry |
| Chords, segments, arcs, tangent points | MH31 EBB | missing (in progress on `claude/geometry`) | geometry |
| Plane area and solid volume, weight | MH31 EBB | built (`figures`; weight in `weight`) | geometry, densities from supplier data |
| Compound angles | MH31 | built (`compound`) | vector geometry |
| Calculator, angle conversion, prime factors, interpolation | MH31 EBB | built (`calc`) | own parser |
| Lathe change gears | MH31 | partial (`changegears`: trains from your gears; no quick-change gearbox tables) | ratio arithmetic |
| Bar, tube and sheet weights | EBB | partial (round/hex/square bar in the bar stock planner with your density; full tool in progress on `claude/geometry`) | geometry × cited density |
| Sheet gauges, bend allowance, K-factor | EBB MH31 | missing (bend allowance in progress on `claude/geometry`) | gauge tables from public standards; bend formula |
| Fractions, decimals, unit conversions | EBB MH31 | built (`fraction`, `units`: 17 quantities) | NIST SP 811 (public domain) |
| Engineering economics (payback, hourly rate) | MH31 | built (`economics`; no depreciation schedules) | standard interest formulas |

## Mechanics and machine elements

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Beams, deflection, stress, torsion, columns | MH31 EDB | missing | [GERE] [ROARK]; public-domain MIL-HDBK-5 era formulas |
| Bolt torque and preload, grade marks | EBB MH31 EDB | built (`bolttorque`, `boltgrade`: VDI 2230 torque and permitted preload, friction user-entered; ISO 898-1, SAE J429, ASTM A574 minimums and head marks; no torque-angle, no engagement length) | VDI 2230-1:2015 (cited), FVA, Hameedi and Völgyi, Bossard; three to four publishers per grade table |
| Spanner and socket sizes | EBB | built (`spanner`: ISO 272, old DIN, JIS and inch across flats, hex keys, lookup by spanner size) | ISO 272:1982, ASME B18.2.1 (cited); Wikipedia, Accu, SLS Bearings |
| Screw heads, drives, cap and set screws | EBB MH31 | partial (`shcs`, `clearance`: socket head cap screws metric and inch with counterbores and clearance holes; no set screws, other heads or drives) | ISO 4762:2004, ISO 273:1979, ASME B18.3 (cited); eight publishers |
| Keys and keyways | EBB MH31 | partial (`keys`: metric and inch parallel keys, keyseat depths and check dimensions; no Woodruff) | DIN 6885-1, ISO 773, ASME B17.1 (cited); fasten.it, AIMS, MISUMI, Engineers Edge, AMES |
| T-slots | EBB MH31 | built (`tslots`: slot dimensions and pitches; no T-bolt or T-nut dimensions) | ISO 299:1987 (cited); Engineers Edge, iTeh preview |
| Spur gears, gear trains, splines | EBB MH31 EDB | missing | ISO 53, ISO 54, AGMA public formulas; ANSI B92.1 (cited) |
| Belt and pulley, chains | EBB MH31 EDB | missing | ISO 4183, maker data |
| Bearings: life (L10), fits | MH31 EDB | partial (`bearinglife`: L10, L10h, required C, equivalent load; no fits, no aISO) | ISO 281:2007 clause 6 (cited) |
| O-rings, seals | MH31 EDB | partial (`oring`: AS568 sizes, piston/rod/face gland squeeze, stretch and fill against two makers; no ISO 3601-1 G series) | AS568, ISO 3601-1:2012 (cited); Greene Tweed, eFunda, O-Rings Inc., Global O-Ring and Seal, Apple Rubber |
| Retaining rings, pins, rivets, inserts | MH31 | missing | cited standards, maker data |
| Springs | MH31 | missing | standard spring formulas |
| Adhesives and sealants | EBB MH31 | missing | maker guides |
| Shaft alignment | MH31 | missing | own derivation |
| Electric motors (power, torque, speed) | MH31 | missing | formulas |
| Fluid power basics | MH31 | missing | formulas |

## Materials

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Material equivalents | EBB EDB | built (v2) | evidence model, 100+ cited publishers |
| Physical properties of metals | EBB MH31 | partial (127 grades, properties for some conditions; round 2 in progress on `claude/material-props-2`) | supplier data sheets, NIST, public-domain MIL-HDBK-5J |
| Heat treatment: terms, temper colours, hardening | EBB MH31 EDB | missing | steel supplier data |
| Engineering plastics | EBB MH31 EDB | partial (5 plastics in material equivalents) | supplier data |
| Corrosion and galvanic series | MH31 EDB | missing | public-domain MIL-STD-889 |
| Elements, chemical symbols | EBB | missing | IUPAC / NIST public data |

## GD&T section plan

A full guide plus calculators, written in our own words with our own
diagrams. Standards are cited by name and clause only:

- ASME Y14.5-2018 (R2024) (US), ASME Y14.5.1-2019 (mathematical definition);
- ISO 1101:2017 (geometrical tolerancing), ISO 5459:2024 (datums),
  ISO 2692:2021 (maximum material requirement), ISO 8015:2011 (independency
  principle), ISO 14405 (size), ISO 22081:2021 (general geometrical
  specifications; ISO 2768-2:1989 is withdrawn).

Status: built on branch `claude/gdt` (guide, frame builder, true position,
bonus/virtual/resultant condition, position conversion, fasteners, stack).
Round 2 (branch `claude/gdt-2`) added the composite position checker, the
unequal profile (U) zone offset calculator and a degrees-of-freedom
explainer. Sources and open items: `docs/gdt.md`.

Contents:

1. What GD&T is for: function, datums, and why ± tolerances fail on location.
2. Rule #1 (envelope) versus the ISO independency principle: the biggest
   US/ISO difference, explained side by side.
3. Datums: datum features, simulators, the 3-2-1 reference frame, datum
   targets, order of precedence, datum features of size at MMB/LMB.
4. Each characteristic with its own diagram, tolerance zone, what it
   controls, typical inspection method, and common mistakes:
   form (straightness, flatness, circularity, cylindricity), orientation
   (perpendicularity, parallelism, angularity), location (position,
   profile), runout (circular, total), and the ISO-only and withdrawn
   symbols (concentricity, symmetry in Y14.5-2018).
5. Modifiers: MMC/LMC/RFS, projected zone, free state, tangent plane,
   unequal profile, statistical tolerance, continuous feature, and their ISO
   equivalents.
6. Calculators: bonus tolerance, virtual and resultant condition, true
   position from measured X/Y (diametral), position to coordinate
   tolerance conversion, fixed and floating fastener formulas, composite
   position, profile zone offset, simple stack-ups.
7. Feature control frame builder: assemble a frame, BenchMate explains it in
   plain English and flags invalid combinations.
8. ASME/ISO symbol comparison table.

Accuracy rule: every statement about the standards is checked against at
least two independent public sources (standards bodies' free previews,
university course notes, metrology maker guides, public-domain military
training manuals), and anything we could not confirm is marked "to be
verified" rather than guessed.
