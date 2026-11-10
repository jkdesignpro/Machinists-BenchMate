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

Status: **built** = in the app; **planned** = to build. Book topics outside
machining (careers, thermodynamics, aerodynamics, pressure vessels and similar)
are not part of BenchMate.

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
- Hardness conversion: ISO 18265 (2013) and ASTM E140 current revision.
- Tool and insert codes: check current ISO 1832, ISO 5608 and ISO 513
  editions.

Where a book's reasoning or rule of thumb is superseded, BenchMate uses the
current practice and says so in the tool's notes.

## Machining

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Spindle speed, feed, chip load, MRR, power | MH31 EBB | built | [MH] formulas, [SAN] |
| Tool life, cost per part (Taylor, Gilbert) | MH31 | built | [TAY] [GIL] |
| Cut optimiser, tool deflection | MH31 EDB | built | [GERE] [ROARK] |
| Arc and helix feed, ramping | CNCH | built | geometry |
| Chip thinning, radial engagement | MH31 | planned | geometry, own derivation |
| Turning surface finish, cut time, taper | MH31 EBB | built | geometry |
| Speeds and feeds starting values by material | MH31 EBB | planned | manufacturer catalogues (Sandvik, Kennametal, Guhring, OSG, Dormer Pramet free PDFs) via the vendor import, never book tables |
| Drilling: point length, thrust, torque, peck | MH31 EBB | partial | geometry; thrust/torque from manufacturer formulas |
| Reaming allowances | MH31 | planned | manufacturer data |
| Grinding: wheel speed, marking system, dressing | MH31 EBB | planned | ISO 525 / ANSI B74.13 (cited), wheel maker guides (Norton, Tyrolit) |
| Micromachining | MH31 | planned | manufacturer data |
| Band saw and hacksaw blade selection | EBB | planned | blade maker guides |
| Cutting fluids, refractometer concentration | MH31 EBB | built (concentration from Brix x the fluid's factor, mix and top-up; branch `claude/shop-helpers`) | fluid maker data sheets; docs/shop-helpers.md |
| Machining non-ferrous and plastics | MH31 | planned | material supplier machining guides |
| EDM (wire and sinker) basics | MH31 | planned | public process guides |
| Knurling: diameter for pitch | MH31 EBB | planned | ANSI B94.6 (cited), knurl maker data |
| Broaching | MH31 | planned | geometry, maker data |
| Indexing (dividing head, rotary table) | EBB | built (branch `claude/geometry`): simple, angular, differential with user plates and gears | US Navy Machinery Repairman ch. 7 (public domain); docs/geometry.md |
| Sine bar, sine plate, gauge block stack | MH31 EBB | built (branch `claude/geometry`): sine bar height/angle, fewest-block stack; metric 112 and inch 81 sets confirmed by two makers | Mitutoyo, Insize, Starrett listings; docs/geometry.md |
| CNC: coordinates, work offsets, G/M codes per control | MH31 CNCH EBB | planned | control makers' public manuals; generic profile from ISO 6983 (cited) |
| CNC: 2D/3D toolpath concepts, setups | CNCH | planned | own explanations |
| Shop safety notes | CNCH | planned | HSE / OSHA public guidance |

## Tooling

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Drill sizes: fractional, letter, number, metric, decimal chart | EBB MH31 | built | ASME B94.11M / ISO 235 (cited); number/letter sizes are public facts, cross-checked against several maker charts |
| Tap drill sizes (cut and form taps), percent thread | EBB MH31 | built | formulas from thread standards; form-tap formula from tap makers |
| Broken tap removal, screw extractor drill sizes | EBB | planned | maker data |
| Thread chasers | EBB | planned | maker data |
| Drill point geometry by material, grinding faults | EBB MH31 | planned | own diagrams, maker data |
| End mill types, cutter geometry | EBB MH31 | planned | own explanations |
| Carbide grades, ISO P/M/K/N/S/H groups | EBB MH31 | planned | ISO 513 (cited), maker grade charts |
| Insert designation (ISO 1832) and holder designation (ISO 5608) | EBB | planned | decoder built from the code structure, cited |
| Tool coatings | EBB | planned | coating maker data (Oerlikon Balzers, Ionbond) |
| Tool steels and cutting tool materials | MH31 EBB | planned | supplier data |
| Tapers: Morse, Jacobs, ISO/SK, BT, CAT, HSK, R8 | EBB MH31 | planned | standards cited (ISO 296, DIN 238, ISO 7388, ISO 12164, JIS B 6339, ASME B5.50), dimensions cross-checked against maker data |
| Pull studs and retention knobs | EBB | planned | maker data, cited standards |
| Collets (ER sizes and ranges) | MH31 | planned | ISO 15488 (cited), maker data |
| Burrs, mounted points, files | EBB MH31 | planned | maker data |
| Hole saws | EBB | planned | maker data |
| Tool sharpening and wear | MH31 | planned | own explanations |

## Threads

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Thread over wires | MH31 | built | [MH] wire formula, ISO 68-1 |
| Unified (UNC/UNF/UNEF/UN), all classes | MH31 EBB | partial: UNC/UNF/UNEF basic dimensions, classes 2A/3A/2B/3B; not yet 1A/1B or internal minor-diameter limits | ASME B1.1 formulas (cited), values computed and cross-checked |
| ISO metric coarse/fine, tolerance classes | MH31 EBB | partial: coarse/fine basic dimensions, 6g/6H | ISO 68-1, ISO 261, ISO 965 (cited), computed |
| BSW, BSF, BA, BSP (G and R), NPT, NPTF | EBB MH31 | planned | BS 84, BS 93, ISO 228, ISO 7, ASME B1.20.1 (cited) |
| ACME, stub ACME, trapezoidal, buttress | MH31 | planned | ASME B1.5, ISO 2904, ASME B1.9 (cited) |
| Thread forms overview and symbols | EBB | planned | own diagrams |
| Single-point threading: infeed, passes | MH31 | planned | insert maker guides |
| Thread milling | MH31 | planned | own derivation, maker guides |
| Thread rolling blank diameter | MH31 | planned | maker data |
| Helical coil inserts (tap sizes) | MH31 | planned | insert maker data |

## Dimensioning, fits and inspection

| Topic | Books | Status | Planned source |
|---|---|---|---|
| **GD&T: symbols, datums, modifiers, tolerance zones, bonus tolerance, virtual condition** | MH31 EDB | built (guide, frame builder, calculators; see docs/gdt.md) | see "GD&T" below |
| ISO limits and fits (IT grades, all hole/shaft deviations) | MH31 EBB EDB | built: up to 500 mm, without j/J | ISO 286-1 formulas (cited), computed and checked |
| ANSI preferred fits (RC, LC, LT, LN, FN) | MH31 | planned | ANSI B4.1 (cited) |
| General tolerances (ISO 2768) | EDB | planned | ISO 2768 (cited) |
| Surface texture: Ra/Rz, symbols, process ranges, N grades | MH31 EBB EDB | partial | ISO 21920 / ISO 1302, ASME B46.1 (cited) |
| Measuring: micrometer, vernier, dial reading | MH31 | planned | own explanations |
| Temperature compensation of measurements | MH31 | planned | thermal expansion data with sources |
| Statistics: Cpk, SPC, tolerance stack (worst case, RSS) | MH31 | partial (1D worst-case and RSS stack; Cp/Cpk/Pp/Ppk with histogram; control charts still to do) | stack: Accendo, Five Flute (docs/gdt.md); Cpk/SPC: NIST/SEMATECH e-Handbook (public domain) |
| Hardness conversion | EBB MH31 | planned | ASTM E140 / ISO 18265 (cited); conversion values cross-checked |
| Drawing standards and abbreviations | EBB EDB | planned | own wording, ISO 128 / ASME Y14 cited |

## Mathematics and geometry

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Bolt circle, hole coordinates | EBB | built | geometry |
| Right and oblique triangles | MH31 EBB | built (branch `claude/geometry`) incl. the ambiguous SSA case | trigonometry |
| Chords, segments, arcs, tangent points | MH31 EBB | built (branch `claude/geometry`): arc solver, 3-point circle, corner and line-arc fillets, dovetail and V-groove over pins | geometry |
| Plane area and solid volume, weight | MH31 EBB | partial (stock sections and weight built; general solids still to do) | geometry, densities from supplier data |
| Bar, tube and sheet weights | EBB | built (branch `claude/geometry`) | geometry × cited density |
| Sheet gauges, bend allowance, K-factor | EBB MH31 | partial (bend allowance, setback, deduction, K from a test bend built; gauge tables still to do) | gauge tables from public standards; bend formula |
| Fractions, decimals, unit conversions | EBB MH31 | partial (fraction / decimal / mm converter built) | NIST SP 811 (public domain) |
| Engineering economics (payback, hourly rate) | MH31 | planned | standard formulas |

## Mechanics and machine elements

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Beams, deflection, stress, torsion, columns | MH31 EDB | planned | [GERE] [ROARK]; public-domain MIL-HDBK-5 era formulas |
| Bolt torque and preload, grade marks | EBB MH31 EDB | planned | VDI 2230 method (cited), ISO 898-1, SAE J429 |
| Spanner and socket sizes | EBB | planned | ISO 272, ASME B18.2 (cited) |
| Screw heads, drives, cap and set screws | EBB MH31 | planned | ISO 4762 etc. (cited), own drawings |
| Keys and keyways | EBB MH31 | planned | DIN 6885 / BS 4235 / ASME B17.1 (cited) |
| T-slots | EBB MH31 | planned | ISO 299 / DIN 650 (cited) |
| Spur gears, gear trains, splines | EBB MH31 EDB | planned | ISO 53, ISO 54, AGMA public formulas; ANSI B92.1 (cited) |
| Belt and pulley, chains | EBB MH31 EDB | planned | ISO 4183, maker data |
| Bearings: life (L10), fits | MH31 EDB | planned | ISO 281 formula (cited), bearing maker data |
| O-rings, seals | MH31 EDB | planned | AS568 / ISO 3601 (cited), maker groove guides |
| Retaining rings, pins, rivets, inserts | MH31 | planned | cited standards, maker data |
| Springs | MH31 | planned | standard spring formulas |
| Adhesives and sealants | EBB MH31 | planned | maker guides |
| Shaft alignment | MH31 | planned | own derivation |
| Electric motors (power, torque, speed) | MH31 | planned | formulas |
| Fluid power basics | MH31 | planned | formulas |

## Materials

| Topic | Books | Status | Planned source |
|---|---|---|---|
| Material equivalents | EBB EDB | built (v2) | evidence model, 100+ cited publishers |
| Physical properties of metals | EBB MH31 | planned | supplier data sheets, NIST, public-domain MIL-HDBK-5J |
| Heat treatment: terms, temper colours, hardening | EBB MH31 EDB | planned | steel supplier data |
| Engineering plastics | EBB MH31 EDB | planned (materials round 2) | supplier data |
| Corrosion and galvanic series | MH31 EDB | planned | public-domain MIL-STD-889 |
| Elements, chemical symbols | EBB | planned | IUPAC / NIST public data |

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
