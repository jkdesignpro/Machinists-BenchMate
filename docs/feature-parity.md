# Feature parity tracker

Goal: at minimum match the breadth of commercial machinist calculators, built only from free knowledge (standards, textbooks, manufacturer-published formulas, public-domain data).

Statuses match the strict line-by-line audit in `parity-audit.md` (2026-11-10, judged from the code): `done` (in the app and working), `partial` (in the app, covers only part), `missing` (not in the app; a formula in `benchmate-core` with no screen counts as missing), `in progress` (on an unmerged branch; still missing until merged). The "Audit rows" column points at the rows in `parity-audit.md` section 1.

Every item needs: cited source, unit tests against worked examples, own UI.

| Area | Feature | Status | BenchMate tool | Audit rows |
|---|---|---|---|---|
| Turning | Cutting speed and feed recommendations by material | partial (turning advisor since 0.3.0: speed by material for HSS and carbide, feed from the nose radius, depth and feed held to spindle power and torque; no insert grade picker, hardness input or chip-breaker window) | `advturn` | U1, U2 |
| Turning | Spindle speed conversion | done | `rpm` | U3 |
| Turning | Feed rate conversion (per rev / per minute) | done | `lathefeed` | U4 |
| Turning | Roughing pass cut time | done (passes from stock and depth, RPM per pass) | `roughtime`, `passtime` | U5 |
| Turning | Part-off / grooving cut time (CSS) | done (groove and cut-off program with CSS time) | `cycgroove` | U6 |
| Turning | Taper calculation | done | `taper` | U7 |
| Turning | Lathe taper G-code, lathe cycle generator | done (taper) / partial (G71/G70 from typed points, no CAD input) | `cyctaper`, `cycg71` | U8, U11 |
| Turning | Boring bar deflection | done (bar materials, coolant bore, cutting force, overhang guidance per maker) | `boringbar` | U9 |
| Turning | C-axis feed converter | done (deg/min, circumference feed, inverse time F) | `caxis` | U10 |
| Turning | Surface finish from nose radius | done | `finish` | U12 |
| Turning | Tool nose radius compensation (hand shifts, tip 0-9, G41/G42) | done (ours) | `tnrc` | |
| Turning | Bar stock planner (parts per bar, weight, cost) | done (ours) | `bar` | |
| Milling | Speeds and feeds with chip thinning, deflection, power check | partial (checks a cut you enter; no starting data, kc by hand) | `cutopt` | U13, U18 |
| Milling | Spindle speed and table feed | done | `rpm`, `feed` | U14, U15 |
| Milling | Radial chip thinning | done (compensated feed for a target chip) | `chipthin`, `cutopt` | U16 |
| Milling | MRR and power | done (MRR) / partial (power needs kc) | `mrr`, `cutopt` | U17, U18 |
| Milling | Arc feed correction (internal/external), corner engagement feed | done | `arcfeed`, `cornerfeed` | U21 |
| Milling | Helical interpolation / ramp angle and pitch | done (ours) | `helix` | |
| Milling | Tool deflection, cut optimiser | done (ours) | `deflection`, `cutopt` | |
| Milling | Ball end mill cusp height and effective diameter | done (effective diameter with tool tilt) | `ballcusp`, `balleff` | U19, U20 |
| Milling | Tool runout, slitting saw speeds and feeds | done | `runout`, `slitsaw` | U22, U23 |
| Milling | Thread milling calculator and program | done | `cyctmill` | U24, U25 |
| Economics | Taylor tool life, cost per part, economic tool life | done (ours) | `toollife` | |
| Drilling | Drill speed/feed recommendations | partial (drilling advisor since 0.3.0: speed by material, feed by diameter, point length, time, removal rate, torque, thrust, power, drilling cycle; no coating factor, none found in an open source) | `advdrill` | U28 |
| Drilling | Drill point length | done | `drillpoint` | U29 |
| Drilling | Center drill depth / spot drill depth | partial (depth both ways; no centre drill size table) | `spotdepth` | U32 |
| Drilling | Reaming, gun drill, tapping speed | done (reaming, gun drilling) / partial (tapping speed: one publisher's table) | `advream`, `gundrill`, `advtap` | U33-U35 |
| Reference | Drill chart (fraction, number, letter, metric) | done | `drillchart` | U30 |
| Reference | Tap drill sizes (cut and form) | done | `tapdrill` | U31 |
| Reference | Thread data and limits: UNC/UNF/UNEF, metric M | done | `threaddata` | U38, U43, U52 |
| Reference | Thread data: UN constant pitch / UNS | done (8, 12, 16-UN lists to 2 in; any UNS size through the custom size) | `unseries`, `threaddata` | U39 |
| Reference | NPT, BSPP, BSW, BSF, BA | done (basic dimensions, NPTF notes; no tolerances) | `pipethreads`, `whitworth` | U47, U48, U50 |
| Reference | Thread measurement over wires | done (60, 55, 30, 29 degree; lead angle neglected) | `wires` | U51 |
| Threads | UNJ, UNR | done (UNJ radius and minor limits; UNR rule, no UNR minor limits) / partial | `unjunr` | U40, U41 |
| Threads | UNM | done | `unm` | U42 |
| Threads | ACME, Stub ACME | done (2G-4G, 2C-4C, Stub; single start) | `acme` | U45, U46 |
| Threads | STI | done (tapped-hole sizes, three makers) | `sti` | U49 |
| Threads | Plating and anodize allowance | partial (allowance and before-coating limits; no special-size tables) | `coating` | U44 |
| Threads | Trapezoidal, buttress, multi-start | done (basic dimensions; no tolerances) | `trapezoidal`, `buttress`, `multistart` | |
| Reference | ISO fits and tolerances | partial (no j/J, up to 500 mm) | `fits` | U61 |
| Reference | G-code and M-code reference per control dialect, custom macros | done (G/M codes, twelve controls and builders with sources and compare; macro facts and system variables searchable by number; gaps listed on the page: Mitsubishi and Heidenhain macros are thin, Fanuc system variables partly from one source) | `gmcodes`, `macroref` | U92-U94 |
| Reference | Material properties | partial (material card: composition chart for 37 steels, machinability rings, properties; non-ferrous compositions and cutting speed per grade missing) | `materials` | U82 |
| Reference | Material weight | partial (bar only; full tool in progress on `claude/geometry`) | `bar` | U81 |
| Reference | Hardness conversion | missing (in progress, `claude/ref-data-3`) | | U67 |
| Reference | Thermal expansion | done (measurement correction, growth, shrink-fit temperatures, press-fit pressure) | `tempcomp`, `shrinkfit` | U68 |
| Reference | Socket head cap screw holes (counterbore and clearance) | done (metric and inch; publisher disagreements shown) | `shcs`, `clearance` | U71 |
| Reference | Knurling, reaming | done (knurl blank by four methods: diametral pitch, circular pitch, measure and count, trial and error with a tick-off procedure; reaming speeds, feeds and allowance) | `knurl`, `advream` | U87, U33 |
| Fasteners | Bolt grades, torque and preload (VDI 2230), spanner sizes, T-slots | done (beyond Ultra; friction always user-entered) | `boltgrade`, `bolttorque`, `spanner`, `tslots` | MH198-MH212 (section 2) |
| Machine elements | Keys and keyways, O-ring glands, bearing L10 | partial (no Woodruff, no ISO 3601 G series, no bearing fits) | `keys`, `oring`, `bearinglife` | MH285, MH288, MH294 (section 2) |
| Geometry | Bolt circle | done | `bolt` | U72 |
| Geometry | Rectangular hole pattern, coordinate export | done (grid, bolt circle, pasted list; CSV and G-code) | `cycdrill` | U73, U74 |
| Geometry | Triangle solver, arc calculator, geometry, angles | missing (in progress, `claude/geometry`) | | U75-U78 |
| Geometry | Sine bar, gauge block stack | missing (in progress, `claude/geometry`) | | U69, U65 |
| Geometry | Height over ball (countersinks, tapered bores) | done (one or two balls; tapers over rolls too) | `ballcone`, `taperrolls` | U70 |
| Geometry | Areas and volumes, compound angles (ours) | done | `figures`, `compound` | |
| Turning | Lathe change gears (ours) | done (simple and compound trains from your gears) | `changegears` | |
| Reference | ISO 2768-1 general tolerances, micrometer reading aid, drawing abbreviations (ours) | done | `gentol`, `scales`, `abbrev` | |
| Economics | Machine hourly rate, break-even, payback (ours) | done | `economics` | |
| GD&T | True position with MMC/LMC bonus | done | `gdttp`, `gdtbonus` | U62 |
| GD&T | Learning centre (no quiz), frame builder | done | `gdtguide`, `gdtfcf`, `gdtdof` and others | U63, U64 |
| Finish | Surface finish (lathe, mill, conversions) | partial (lathe only; conversions in progress) | `finish` | U66 |
| Tools | Keyway broach G-code, G76, G84, G81/82/83/73 generators | done (generic Fanuc-style and Haas; other controls not yet supported, see `cycles.md`) | `cycbroach`, `cycthread`, `cycdrill` | U36, U37, U53, U54, U88 |
| Tools | Unit conversions | done (17 quantities, NIST SP 811) | `units`, `fraction` | U79 |
| Tools | Scientific calculator | done (typed expressions, own parser; no RPN or graphing) | `calc` | U80 |
| Tools | Bandsaw cut time | done (cut rate or down-feed, chip per tooth) | `bandsaw` | U90 |
| Tools | G-code simulator | partial | `gsim` | U95: editor (undo, insert and delete line, tidy, inch/mm), 2D and 3D backplot with view cube, cycle time, errors by line; no stock removal, G71-G76 not simulated |
| Tools | 2D CAD / DXF generator | yes | `sketch` (2D sketcher: point, line, arc, circle, rectangle, text, layers, snaps incl. tangent and square, measure, angle between lines, undo, DXF in and out, R2000/R12), `dxfbolt`, `dxfgrid`, `dxfslot`, `dxfrect`, `dxfpoly`, `dxfring`, `dxfprofile` (parametric shapes, live preview, open in the sketcher) | U96 |
| Shop | Coolant concentration and mix | done | `coolconc`, `coolmix` | U89 |
| Shop | Chatter finder (mic, stable-speed lobes) | done (microphone or typed frequency, mill and lathe, on-device) | `chatter` | U26 |
| Shop | Vibration check (device sensor) | missing | | U27 |
| Grinding | Equivalent diameter, grit conversion, plunge, surface, wheel/workpiece speed | done (grit values per publisher with disagreements shown; max wheel speed never defaulted) | `grindspeed`, `grindtime`, `grindsurf`, `gritconv` | U55-U57, U59, U60 |
| Grinding | Wheel marking decoder | done (marking only; no shapes or selection) | `wheelcode` | MH163, BB60 (partial) |
| Grinding | Cylindricity error from RPM | done (wheel to work rpm ratio: whole numbers and simple fractions flagged, work speeds to avoid, wheel wear, chatter mark count; rule from one author, marked single-source) | `grindratio` | U58 |
| Gears/splines | Spur gear data, ISO 4156, ANSI B92.1 | done (spur gear data and measurement; involute splines with basic dimensions and pin measurement, fit class tolerances not shown) | `spurgear`, `gearmeasure`, `spline` | U83-U85 |
| Gears/splines | SAE J499a parallel side splines | done (4, 6, 10 and 16 splines, fits A, B and C: width, depth, small diameter, torque capacity, section to scale; formulas from one publisher, checked against 37 printed values and marked so) | `saespline` | U86 |
| Library | Formula library | done (312 entries, searchable, opens the tool; registry in `app/formulas.js`) | `formulas` | U97 |
| Library | Tool wear information | done (ten wear types with our own drawings, causes and remedies from two makers; two types have one source and are marked) | `toolwear`, `cncguide` | U91 |
| Library | CNC knowledge guide (axes, coordinates, offsets, program structure, climb/conventional, chips, troubleshooting, workholding, safety) | done (ours; book rows in `parity-audit.md`) | `cncguide` | |
| Library | CNC mill setup guide (start-up, control keys, tool lengths four ways, work offsets, first run, adjusting, shut-down) | done (ours, 0.6.0; 13 public sources, single-source statements marked) | `millsetup` | |
| Library | Milling toolpath guide (model to part, 2D and 3D, features, contour with cutter compensation, pockets, slots, chamfer and radius, holes, 3D toolpaths, rest machining, tolerances) | done (ours, 0.6.0; 7 public sources, single-source statements marked) | `toolpaths` | |
| Library | Workholding guide (vise and accessories, aligning, jaws and soft jaws, squaring a block, clamps and fixture plates, thin parts, round and many parts) | done (ours, 0.6.0; 9 public sources, single-source statements marked) | `workholding` | |
| Milling | Chamfer mill: tip depth, centre offset, cutting diameter, widest chamfer | done (ours, 0.6.0; own cone geometry, drawing to scale) | `chamfermill` | |
| Library | Tip of the day | done (own tips, Home widget) | `tips.js` | U98 |
| Library | Assistant, community cut data | missing (assistant: stage 5, optional and off by default; a shared cut library is not in the spec for 0.2 to 1.0) | | U101, U102 |
| Library | Indexable insert catalogue | done (decode or tap a code together; insert drawn to scale from above and in section; nose radius to the turning advisor, outline to the sketcher) | `insertcode`, `holdercode`, `iso513` | U103 |
| Shop | Tool library and favourites | done | `toollib` (fill into rpm, feed, arcfeed, helix, deflection, cutopt, drillpoint, tapdrill, finish); star in the side list or by the title | U106, U109 |
| Threads | Thread gauge limits (not in Ultra; idea 14) | done for Unified (GO and NOT GO plug and ring pitch diameters with the X tolerance, a published chart beside); ISO metric gauges missing (no public table of ISO 1502 tolerances) | `threadgauge` | |
| Quality | Gauge R&R (not in Ultra; idea 13) | done (average and range method: EV, AV, GRR, PV, percent of total variation and of tolerance, ndc; constants computed and checked against the published ones; ANOVA method not included) | `grr` | |
| Threads | Rolled thread blank diameter (not in Ultra; idea 10) | done (a thread roll maker's rule on the maximum pitch diameter, the handbook's amounts for the size beside it as a different rule, correction of the blank after a trial) | `rollblank` | |
| Process | Wire EDM (not in Ultra; idea 18) | done (kerf, wire offset for the first cut and the final skim, smallest inside corner radius, taper both ways with the guide distance, cut time from the cutting rate with skim cuts; gap and rate are inputs, published gap ranges that differ are both shown) | `edmoffset`, `edmtaper`, `edmtime` | |
| Shop | Collet nut and pull stud torque (not in Ultra; idea 8) | done (ER nut torque by size, bore and nut from the maker's table with a second maker beside it; pull stud torque from three makers side by side, nothing averaged) | `holdertorque` | |
| Machine elements | Compression springs (book rows MH40) | done for round-wire compression springs (rate, Wahl stress, coils, solid length, pitch, load at a length; modulus from two makers); extension, torsion and disc springs missing | `spring` | |
| Geometry | Prismoidal formula, irregular areas, tank contents (book row MH9) | done (each formula from two publishers, three published examples reproduced) | `prismoid`, `irregular`, `tankvol` | |
| Stock | Sheet metal and wire gauges (book rows MH296, BB55) | done (two publishers per table value, differences shown; AWG from its rule) | `gauges` | |
| Machine elements | Taper pins, inch series (book row MH214) | partial (one publisher for the sizes, marked; no other pin types) | `taperpin` | |
| Machine elements | Belt and chain drives (book rows MH289, MH290, BB46) | done for geometry (belt length exact and short, centre distance from a length, chain length in even pitches, sprocket pitch diameters, ratio, wrap); belt sections and power ratings missing | `beltdrive`, `chaindrive` | |
| Shop | SI prefixes, defining constants, Greek alphabet (book rows MH300, MH301, ED2) | done (each entry printed the same by two publishers) | `symbols` | |
| Shop | Home dashboard | done (widgets, reorder and resize) | `dashboard.js` | U107 |
| Shop | Decimal precision, reorderable menu | partial (more and fewer decimals per calculator, remembered; no global setting. Home widgets can be rearranged; the tool lists and the rail cannot) | `app.js`, `dashboard.js` | U105, U108 |
| Platform | Inch/metric toggle | done | `app.js` | U104 |
| Platform | Offline, web/desktop link | partial (local web app; no installable offline build) | | U110, U111 |
| Platform | Mobile apps, languages | missing (later phase) | | U112, U113 |

Count against Ultra (from `parity-audit.md`): 113 rows, 61 done, 13 partial, 37 missing (8 of them in progress), 2 out of scope. The build order is in `parity-audit.md` section 6.

Beyond parity (ours): manufacturer speeds and feeds with PDF import, an adaptive per-machine learning profile (see `vendor-data-and-learning.md`), Swiss-lathe helpers, "show the working" steps for every result, AMW link-up.


**Scope rule:** BenchMate is for all machinists and all machines. The Citizen L20 is just the first machine profile to be verified. Nothing machine-specific goes in the general tools: G/M codes, cycles and limits live in selectable control/machine profiles.

**Dropped by Jacob:** quiz and tolerance-stack mini game (not wanted).
