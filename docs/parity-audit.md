# Parity audit

A strict, line-by-line check of what BenchMate has against (a) the commercial
app CNC Machinist Calculator Ultra and (b) four reference books. Written
2026-11-10 against branch `claude/scaffold-core` at commit `47e9ecb`.

**How it was judged.** From the code (`app/*.js`, `core/src/*.rs`), not from
the docs. A function in `benchmate-core` with no screen counts as missing.

- **done**: a tool in the app covers the item and works.
- **partial**: a tool covers only part of the item. The last column says what is missing.
- **missing**: nothing in the app. "In progress" means a branch that is not merged yet:
  `claude/geometry` (triangle, arc, fillet, dovetail, stock weight, bend
  allowance, sine bar and gauge-block stack, indexing), `claude/material-props-2`
  (material properties round 2), `claude/ref-data-3` (insert codes, surface
  finish, hardness; no commits yet). These still count as missing.
- **out of scope**: Jacob ruled it out (careers, thermodynamics, steam,
  aerodynamics, pressure vessels, turbines, refrigeration, engines, human body,
  wood screws and nails, wire rope, casting and welding process detail, quizzes
  and games).
- **out of scope?**: the auditor's call, not on Jacob's list (general maths
  theory, design methodology, project management and similar). Jacob should
  confirm. These are counted apart so they don't hide anything.

When in doubt the status is the lower one. Book topics are listed by subject
name only (from the contents pages), never with the books' text or data. Ultra
features are names only.

## Summary

| Checklist | Rows | Done | Partial | Missing (of which in progress) | Out of scope | Out of scope? | Done, of in-scope rows |
|---|---|---|---|---|---|---|---|
| CNC Machinist Calculator Ultra | 113 | 68 | 14 | 29 (8) | 2 | 0 | 61 % |
| Machinery's Handbook 31 | 306 | 47 | 95 | 130 (12) | 6 | 28 | 17 % |
| Engineers' Data Book | 94 | 10 | 27 | 19 (1) | 12 | 26 | 18 % |
| Engineers Black Book | 80 | 23 | 26 | 30 (9) | 1 | 0 | 29 % |
| CNC Machining handbook | 83 | 13 | 17 | 49 (0) | 0 | 4 | 16 % |
| **All** | **676** | **161** | **179** | **257 (30)** | **21** | **58** | **27 %** |

**Update (branch `claude/cycles`, 2026-11-10):** batches A1 and A2 (cycle generators) are built; the rows they close are marked in section 1. The summary counts were recounted from section 1 after merging the other branches' row changes.

**Update (branch `claude/gmcodes`, 2026-11-10):** batch A4 (G/M-code and macro reference) is built: U92, U93, CN21, CN22, CN81 done; U94, BB73 partial. CN23 and CN24 (program characters and layout) are not covered yet. Summary counts updated for these rows.

**Update (branch `claude/fasteners`, 2026-11-11):** batch B1 and part of B2 are built (bolt grades, bolt torque and preload, socket head cap screws with counterbores, clearance holes, spanner sizes, T-slots, keys, O-ring glands, bearing L10). U71, MH199, MH205, MH206, MH251, ED68, BB3, BB16, BB43, BB48 done; MH112, MH198, MH200, MH202, MH204, MH210, MH212, MH285, MH288, MH294, ED65, ED71, BB5, BB44, BB49 partial. Still missing from B1/B2: thread engagement length, wrench clearances, helical inserts, pins, retaining rings, Woodruff keys, bearing fits. Summary counts recounted from the rows after merging `claude/calcs-3` and `claude/gdt-3`.

**Update (branch `claude/calcs-3`, 2026-11-10):** batches A7, A8 and A9 are built: U4, U5, U9, U10, U16, U19-U23, U26, U55, U56, U57, U59, U60, U90 and MH149 done; U32, MH163, MH166, MH167, MH169 and BB60 partial. Not built: U58 (cylindricity from RPM) and U27 (vibration sensor). Summary counts recounted from section 1.

**Update (branch `claude/measure-maths`, 2026-11-11):** batches A13 (except SHCS holes, done on `claude/fasteners`, and the knurl calculator), B7 (shop maths), part of B5 (ISO 2768-1, micrometer and vernier reading, measurement over balls and rolls) and part of B11 (drawing abbreviations) are built. U68, U70, U79, U80, MH1, MH2, MH10, MH12, MH15, MH18, MH44, MH76, MH82, MH303-MH305, ED13, BB31-BB34, BB70, BB79 done; MH3, MH9, MH11, MH16, MH19, MH24, MH84, MH86, MH92, MH256, MH301, MH306, ED3, ED10 partial. Not built: ANSI B4.1 fits (MH77), j/J deviations (U61, MH79), weld symbols (ED86). Summary counts recounted from all rows.

**Update (branch `claude/materials-ref`, 2026-11-11):** batch B4 (materials round 3) partly built: temper and heat-tint colours, heat treatment reference, galvanic series and two-metal check, machining plastics, metal identification. MH68, BB76, BB77 done; MH51, MH56, MH57, MH58, MH65, MH66, ED62, ED64 partial. Not built: tool steel selection, nonferrous and non-metal machining (MH159, MH160), mill certificates (ED63), zinc and magnesium (ED58), titanium heat tint. Summary counts for the three books recounted from the rows by script (the Ultra row left as it was).

**Update (branch `claude/gdt-3`, 2026-11-11):** BB73 done (letter-address table added to the G and M codes screen). GD&T round 3 (composite profile added to the guide) changes no row status. Summary counts updated for BB73.

**Update (branch `claude/cnc-guide`, 2026-11-11):** batch B6 (first part) and the rest of A15 except tips: tool nose radius compensation calculator (`tnrc`), CNC knowledge guide (`cncguide`: axes, coordinate systems, offsets, program structure, climb/conventional, chip formation, tool wear, troubleshooting, workholding, safety) and the formula library (`formulas`). U91, U97, MH131, MH176, MH178, MH183, CN8, CN10, CN12, CN13, CN15, CN16, CN20, CN24, CN48 done; MH100, MH137, MH174, CN4, CN5, CN23, CN41, CN49, CN62, CN63, CN64 partial. Not built: tip of the day (U98), toolpath strategies, CSS explainer, operator procedures (CN25-CN34), 3D toolpaths, glossary. Summary counts recounted from all rows.

**Update (branch `claude/threads-3`, 2026-11-11):** batch A12 (threads round 3) is built except Whitworth tolerances, taper and buttress wire measurement and the trapezoidal tolerances. U39, U40, U42, U45, U46, U49, MH222, MH224, MH225, MH232 done; U41, U44, MH207, MH220, MH221, MH228, MH230, MH233, MH234, MH238, MH247 partial (U47, U51, MH246, BB7 notes updated). Summary counts recounted from all rows by script after merging `claude/cnc-guide` (the in-progress column kept as it was).

**Update (branch `claude/mechanics`, 2026-11-11):** batch B8 (mechanics for the shop) is built: section properties, beams, torsion, columns, stress concentration at holes, fatigue, centrifugal force and chuck grip, balancing, critical speed. MH30, MH35, MH36, MH37, ED30, ED31, ED32, ED36 done; MH31, MH32, MH33, MH39, ED23, ED38, ED42, ED43 partial. Not built: stepped-shaft and groove stress concentration (no free source prints a checkable fit), combined stresses (MH34), springs (MH40, MH41), vibration severity (ED24, ED25), stress-strain basics (ED29, ED39). Summary counts recounted from all rows by script (the Ultra row was one partial/missing off before this change; the in-progress column kept as it was).

**Update (branch `claude/tooling-ref`, 2026-11-11):** batch B3 (tooling reference) is built: tooling guide (`toolguide`), tap pitch diameter limits (`taplimits`), saw blade pitch (`sawtpi`) and a forming-tap makers' comparison in `tapdrill`. BB63 done; MH96, MH101, MH103, MH107, MH109, MH114, MH115, MH156, BB8, BB13, BB19, BB22, BB25, BB26, BB64, BB65, CN6 partial. MH97 (done, `insertcode`) and MH98 (partial, `holdercode`) corrected: those tools were merged earlier but the rows still said missing. Not built: hole saw speeds (BB24: no two independent charts compared), broaching, burrs, mounted points, files, drill and toolbit sharpening, colour-coded taps. Summary counts recounted from all rows by script (the in-progress column changed only for MH97).
**Update (branch `claude/inspection-2`, 2026-11-11):** batch B5 (inspection round 2) is built except thread gauges and measurement over pins for a radius: ANSI B4.1 inch fits (`ansifits`, one full source, so its rows are marked "needs 2nd source"), ISO 286 j/J and sizes up to 3150 mm (`fits`), preferred numbers (`prefnum`), control charts (`ctrlchart`) and sampling plan OC curves (`sampling`; ISO 2859-1 / Z1.4 tables not included). U61, MH79, ED79 done; MH77, MH81, ED81 partial. Summary counts updated for these six rows. Details in `docs/inspection.md`.

"Done, of in-scope rows" = done / (done + partial + missing). Some Data Book
rows bundle several out-of-scope entries (for example all of section 8), so
its row count is smaller than its number of contents entries.

The short answer for Jacob: **no, BenchMate does not have parity yet.**

- Against Ultra, about one feature in five is done and one in seven is
  partial. The biggest gaps are everything that writes or reads G-code
  (cycle generators, simulator, G/M-code and macro references, DXF/CAD),
  cutting-data recommendations by material (Ultra's core screens for
  turning, milling and drilling), grinding, chatter, gears and splines, ACME
  and other thread families, and the app shell (tool library, favourites,
  precision).
- Where BenchMate is strong, it goes further than Ultra: GD&T (10 tools),
  ISO fits and thread limits computed from the standards' formulas,
  material equivalents with evidence, cut optimiser with machine profiles,
  tool life and cost, process capability, coolant and setup sheets.
- Against the books, coverage is thin outside speeds and feeds, threads,
  fits and GD&T. Fasteners, tooling reference, heat treatment, grinding,
  gears, machine elements and the CNC programming and setup material are
  almost entirely missing.
- Merging the three branches in progress would move about 35 rows from
  missing to done or partial, mostly geometry, hardness and insert codes.

## What BenchMate has today (40 tools)

Speeds and feeds: `rpm`, `feed`, `mrr`, `toollife`. Milling: `arcfeed`,
`helix`, `deflection`, `cutopt`. Turning: `finish`, `passtime`, `taper`,
`bar`. Drilling and tapping: `drillpoint`, `drillchart`, `tapdrill`. Threads:
`wires`, `threaddata`, `pipethreads`, `whitworth`. Setup: `machinetapers`,
`machines`, `setupsheet`. Fits: `fits`. Geometry: `bolt`. GD&T: `gdtguide`,
`gdtfcf`, `gdttp`, `gdtbonus`, `gdtconv`, `gdtfast`, `gdtcomp`, `gdtprofu`,
`gdtdof`, `gdtstack`. Quality: `capability`, `tempcomp`. Shop: `coolconc`,
`coolmix`, `fraction`. Materials: `materials` (127 grades, equivalents and
properties: Rm, Rp0.2, hardness, elongation, CTE, conductivity, density, E).
Shell: search, inch/metric toggle, light/dark theme, active machine checks.
There is no decimal-precision setting, no favourites, no tool library and no
offline/PWA manifest.

**Update (2026-11-11, merge of mechanics, tooling, inspection round 2 and materials reference):** summary recounted by script from the row statuses after all four merges.

## 1. CNC Machinist Calculator Ultra

Sources: `docs/reference-feature-inventory.md` (walkthroughs 1-4), the public
site (cncmachinistcalculatorultra.com/homePage), the App Store listing and a
2026 press release. The Google Play listing could not be fetched; the App
Store list is the fuller of the two store lists.

### Turning

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U1 | Lathe cutting speed and feed recommendations (material, machinability, hardness, insert, strategy) | missing | | No cutting-data database: `rpm` only converts a speed you already know |
| U2 | Turning feed and depth-of-cut engine | missing | | Chip-breaker window, feed/DOC suggestion |
| U3 | Lathe spindle speed conversion (SFM/Vc and RPM) | done | `rpm` | |
| U4 | Lathe feed rate conversion (per rev and per minute) | done | `lathefeed` | mm/rev and mm/min (IPR and IPM) both ways from RPM (`claude/calcs-3`) |
| U5 | Rough pass cut time | done | `roughtime`, `passtime` | Number of passes from stock and depth of cut, RPM per pass at constant Vc (capped at the machine max), time per pass and total; CSS within a single facing pass is in `cycgroove` (`claude/calcs-3`) |
| U6 | Groove and cut-off cycle time | done | `cycgroove` | Groove and cut-off program with CSS, G50 clamp, cut time integrated as the diameter shrinks (`claude/cycles`) |
| U7 | Taper calculation | done | `taper` | |
| U8 | Lathe taper G-code / taper programming | done | `cyctaper` | Roughing along the cone and finish pass, external or internal (`claude/cycles`) |
| U9 | Boring bar deflection | done | `boringbar` | Steel, carbide and heavy metal presets (or own E), coolant bore, Fc = kc ap f, overhang L/D guidance from Seco, Kennametal and Cutwel shown per maker (`claude/calcs-3`) |
| U10 | C-axis rotational feed converter | done | `caxis` | Degrees/min, feed along the circumference, combined linear and rotary path, inverse time F (G93) (`claude/calcs-3`) |
| U11 | Lathe cycle generator, CAD profile to canned cycles (G71/G70 style) | partial | `cycg71` | G71/G70 from a typed list of points (straight lines, type I only); no CAD/DXF input, no arcs (`claude/cycles`) |
| U12 | Lathe surface finish | done | `finish` | |

### Milling

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U13 | Mill speeds and feeds with physics engine (chip thinning, deflection, power) | partial | `cutopt` | Checks a cut you enter against power, torque and deflection. No recommended starting speed or feed for a material and tool, no kc by material |
| U14 | Mill spindle speed / SFM | done | `rpm` | |
| U15 | Mill feed rate conversion | done | `feed` | |
| U16 | Radial chip thinning | done | `chipthin` | Compensated feed for a target chip thickness, RCTF, engagement angle, drawing (`claude/calcs-3`) |
| U17 | Metal removal rate | done | `mrr` (turning), `cutopt` (milling) | Milling MRR only inside `cutopt` |
| U18 | Horsepower / machine power | partial | `mrr`, `cutopt` | You have to enter kc yourself; no unit-power or kc table by material |
| U19 | Ball end mill cusp height | done | `ballcusp` | Cusp from step-over and step-over for a cusp, exact circle form (`claude/calcs-3`) |
| U20 | Ball end mill effective cutting diameter | done | `balleff` | Effective diameter at depth with tool tilt; corrected RPM and feed (`claude/calcs-3`) |
| U21 | Adaptive feed control (rounded corners) | done | `cornerfeed`, `arcfeed` | Engagement angle into an inside corner or round a boss and the feed that keeps the straight-wall chip (`claude/calcs-3`) |
| U22 | Max tool runout / endmill runout | done | `runout` | Worst-tooth chip from dial TIR (Kline and DeVor model), per-tooth table, feed that keeps the worst tooth at target (`claude/calcs-3`) |
| U23 | Slitting saw speeds and feeds | done | `slitsaw` | RPM, feed from fz and teeth, cut time (`claude/calcs-3`) |
| U24 | Thread milling calculators | done | `cyctmill` | Path radius, tool-centre feed, helix angle and 3D helix feed (`claude/cycles`) |
| U25 | Thread mill program generator | done | `cyctmill` | Internal/external, RH/LH, climb/conventional, arc-in/out, G41/G42 option, radial and spring passes (`claude/cycles`) |

### Chatter and vibration

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U26 | Chatter listener (microphone, stable speeds from lobes, mill and lathe) | done | `chatter` | Microphone (Web Audio, FFT in Rust) or typed frequency; harmonics of spindle and tooth passing marked; stable speeds per lobe; mill (teeth) and lathe (one); on-device only (`claude/calcs-3`); microphone also enabled in the desktop app (`claude/gdt-3`: verified on Linux, macOS and Windows set up but not run) |
| U27 | Vibration check (device sensor) | missing | | Desktop first; needs a phone build or a USB sensor |

### Drilling and tapping

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U28 | Drill cutting speed and feed recommendations (point angle, tool material, coating, coolant, MRR, G-code) | missing | | |
| U29 | Drill point length | done | `drillpoint` | |
| U30 | Drill chart | done | `drillchart` | |
| U31 | Tap drill size (cut and form, % thread 55-85) | done | `tapdrill` | |
| U32 | Center drill dimensions / center drill hole depth | partial | `spotdepth` | Spot and centre drill depth for a countersink diameter and the reverse; centre drill pilot length is an input, no centre drill size table (`claude/calcs-3`) |
| U33 | Reaming speeds, feeds and allowance | missing | | |
| U34 | Gun drill calculators | missing | | |
| U35 | Tapping speed calculators | missing | | |
| U36 | G84 tap cycle generator | done | `cycdrill` | Rigid (Fanuc-style M29) or floating; F = pitch x rpm (`claude/cycles`) |
| U37 | G81/G82/G83/G73 drill cycle generator | done | `cycdrill` | Generic Fanuc-style and Haas (`claude/cycles`) |

### Threads

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U38 | UNC, UNF, UNEF data and class limits | done | `threaddata` | 2A/2B checked against published tables; 1A/3A/1B/3B computed, not checked; no 1B/3B minor limits |
| U39 | UN constant-pitch and UNS (special) threads | done | `unseries`, `threaddata` (custom size) | 8-UN, 12-UN, 16-UN lists to 2 in with publisher counts; UNS designation explained, limits through the custom size; no 4, 6, 20, 28, 32-UN lists (`claude/threads-3`) |
| U40 | UNJ threads | done | `unjunr` | Root radius range, screw minor limits, nut minor minimum for any UN size, classes 2 and 3; checked against published UNJC rows (`claude/threads-3`) |
| U41 | UNR threads | partial | `unjunr` | UNR rule (root radius at least 0.108 P, external only) stated; UNR minor diameter limits not computed (`claude/threads-3`) |
| U42 | UNM (miniature) threads | done | `unm` | 0.30 to 1.40 UNM basic and design sizes from two publishers, limits of size from one (`claude/threads-3`) |
| U43 | Metric M profile threads | done | `threaddata` | 6g/6H checked; other classes computed only |
| U44 | Special UN and metric sizes with anodize and plating allowance | partial | `coating` | Pitch diameter change and before-coating limits for any thread angle; no tables of special coated sizes (`claude/threads-3`) |
| U45 | ACME threads | done | `acme` | General purpose 2G-4G and centralizing 2C-4C limits, single start; no 5G/5C/6C or multi-start allowance (`claude/threads-3`) |
| U46 | Stub ACME threads | done | `acme` | Stub ACME (2G fit); no modified forms 1 and 2 (`claude/threads-3`) |
| U47 | NPT threads | done | `pipethreads` | Basic dimensions; NPTF notes; no tolerances (`claude/threads-3`) |
| U48 | BSPP threads | done | `pipethreads` | |
| U49 | STI (helical insert) threads | done | `sti` | Tapped-hole major, pitch, minor from the nominal thread, three makers' limits side by side (`claude/threads-3`) |
| U50 | Whitworth BSW and BSF | done | `whitworth` | Basic dimensions; no tolerances |
| U51 | Thread data and over-wire measurement | done | `wires` | 60, 55, 30 and 29 degree threads; lead angle neglected (`claude/threads-3`) |
| U52 | Thread size tolerance data (menu item) | done | `threaddata` | |
| U53 | G76 lathe thread program generator | done | `cycthread` | G76 (Fanuc-style two-block, Haas one-block) or G92 per pass, with infeed table (`claude/cycles`) |
| U54 | Thread programming (menu item) | done | `cycthread` | (`claude/cycles`) |

### Grinding

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U55 | Grinding equivalent diameter | done | `grindspeed` | External, internal and surface; contact length (`claude/calcs-3`) |
| U56 | Grit size conversion | done | `gritconv` | ANSI, FEPA F, FEPA P from four publishers, values per source with badges (`claude/calcs-3`) |
| U57 | Plunge grinding | done | `grindtime` | Plunge time and specific removal rate, plus traverse time (`claude/calcs-3`) |
| U58 | Grind RPM cylindricity error | missing | | |
| U59 | Wheel and workpiece speed | done | `grindspeed` | Wheel m/s and sfpm, RPM for a speed, work speed from a speed ratio; checked against the marked max speed the user types (never defaulted) (`claude/calcs-3`) |
| U60 | Surface grinding | done | `grindsurf` | Strokes, down-feed layers, spark-out, overtravel, total time (`claude/calcs-3`) |

### Inspection and measurement

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U61 | ISO 286 fits and tolerances | done | `fits` | j5-j7 and J6-J8 added; sizes up to 3150 mm (over 500 mm: one table each, checked against the ISO 286-1 formulas) (`claude/inspection-2`) |
| U62 | True position with MMC/LMC bonus | done | `gdttp`, `gdtbonus` | |
| U63 | GD&T learning centre (without quizzes) | done | `gdtguide`, `gdtdof` | Quiz part out of scope |
| U64 | Feature control frame builder | done | `gdtfcf` | |
| U65 | Gauge block stack | missing | | In progress (`claude/geometry`, `sinebar`) |
| U66 | Surface finish (lathe, mill, conversions) | partial | `finish` | Lathe only; no milling (stepover/cusp) finish, no Ra/Rz/RMS/N-grade conversions (conversions in progress on `claude/ref-data-3`) |
| U67 | Hardness conversions | missing | | In progress (`claude/ref-data-3`) |
| U68 | Thermal expansion calculator | done | `tempcomp`, `shrinkfit` | Measurement correction to 20 °C; plain growth, shrink-fit heating/cooling temperatures and press-fit pressure (`claude/measure-maths`) |
| U69 | Sine bar | missing | | In progress (`claude/geometry`) |
| U70 | Height over ball for countersinks and tapered bores | done | `ballcone`, `taperrolls` | Ball height in countersinks and tapered bores, face diameter from a ball, angle from two balls; external taper over rolls (`claude/measure-maths`) |
| U71 | Socket head cap screw hole dimensions | done | `shcs`, `clearance` | Metric and inch counterbores and clearance holes, publisher disagreements shown (`claude/fasteners`) |

### Shop maths and geometry

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U72 | Bolt circle | done | `bolt` | |
| U73 | Rectangular hole pattern | done | `cycdrill` | Grid pattern in zigzag order (`claude/cycles`) |
| U74 | Hole pattern coordinate export | done | `cycdrill` | CSV download and G-code for bolt circle, grid or pasted holes (`claude/cycles`) |
| U75 | Triangle solver | missing | | In progress (`claude/geometry`) |
| U76 | Arc calculator | missing | | In progress (`claude/geometry`) |
| U77 | Geometry calculations | missing | | In progress (`claude/geometry`: chord, sagitta, fillet, dovetail) |
| U78 | Angle solving | missing | | In progress (`claude/geometry`) |
| U79 | Unit converter | done | `units`, `fraction` | 17 quantities from NIST SP 811 exact definitions (`claude/measure-maths`) |
| U80 | Scientific calculator | done | `calc` | Expression calculator (own parser in Rust, no eval), degrees/radians, DMS, prime factors, interpolation (`claude/measure-maths`) |
| U81 | Material weight | partial | `bar` | Round, hex and square bar with a density you enter; no plate, tube or sections. Full tool in progress (`claude/geometry`, `weight`) |
| U82 | Material property search with SFM data | partial | `materials` | Properties exist; no cutting speed/SFM or machinability data per grade. Round 2 in progress |
| U83 | Spur gear data | missing | | |
| U84 | Involute splines per ANSI B92.1 | missing | | |
| U85 | Involute splines per ISO 4156 | missing | | |
| U86 | SAE J499a splines | missing | | |
| U87 | Knurl calculator | missing | | |
| U88 | Keyway broach program generator | done | `cycbroach` | Lathe or mill, depth per stroke, lift, spring strokes (`claude/cycles`) |
| U89 | Coolant concentration | done | `coolconc`, `coolmix` | |
| U90 | Bandsaw cut time | done | `bandsaw` | Cut time from cutting rate or down-feed, chip per tooth from blade speed and TPI (`claude/calcs-3`) |
| U91 | Tool wear information | done | `cncguide` | Wear types (flank, crater, notch, built-up edge, chipping, thermal cracks, plastic deformation) with causes and remedies from Mitsubishi Materials and Seco, own sketches (`claude/cnc-guide`) |

### G-code and programming

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U92 | G-code reference | done | `gmcodes` | Ten controls (generic RS274NGC, Fanuc mill and lathe A/B/C, Haas mill and lathe, Mitsubishi M70/M80, MELDAS 60, Siemens native and ISO, Heidenhain ISO, Okuma OSP lathe, Mazak EIA turning), search, mill/lathe filter, side-by-side compare, source per row (`claude/gmcodes`) |
| U93 | M-code reference | done | `gmcodes` | Program-control and builder M codes where the maker prints them; builder-specific codes are flagged; Heidenhain, Mazak and Siemens ISO M codes are gaps (`claude/gmcodes`) |
| U94 | Custom macro information | partial | `macroref` | Fanuc Macro B, Haas, Siemens R parameters and control structures, Okuma VC/IF, Heidenhain Q jumps; Mitsubishi variable ranges and IF/WHILE not yet confirmed (`claude/gmcodes`) |
| U95 | G-code simulator (2D/3D, cycle time) | partial | `gsim` | 2D backplot (XY/XZ/YZ, lathe XZ), step through, distances, extents, cycle time, arc check; mill drilling cycles and lathe G70/G90/G92/G94 drawn; G71-G76 reported, no 3D. See docs/gsim.md |
| U96 | 2D CAD and DXF generator (snapping, angle measure) | partial | `dxfbolt`, `dxfgrid`, `dxfslot`, `dxfrect`, `dxfpoly`, `dxfring`, `dxfprofile` | Parametric shapes with DXF export (branch `claude/dxf-toollib`); no free sketching, snapping or angle measure |

### Learning and data

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U97 | Machining formula library | done | `formulas` | Searchable library of 151 formulas from 85 tools with variables, units, tool link and source key, built from the registry in `app/formulas.js` (`claude/cnc-guide`) |
| U98 | Machinist tip of the day | missing | | |
| U99 | Machinist knowledge test / quiz | out of scope | | Jacob dropped quizzes |
| U100 | Tolerance stack mini game | out of scope | | Jacob dropped games (a stack calculator exists: `gdtstack`) |
| U101 | Virtual machining assistant (AI) | missing | | |
| U102 | Community cut library / shared machining data | missing | | |
| U103 | Indexable insert catalogue (decode/build ISO designations) | missing | | In progress (`claude/ref-data-3`) |

### Platform and UI

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| U104 | Inch/metric toggle | done | `app.js` | |
| U105 | Adjustable decimal precision | missing | | |
| U106 | Favourites | done | side list, title button | Branch `claude/dxf-toollib` |
| U107 | Home dashboard | missing | | |
| U108 | Arrange menu (reorder) | missing | | |
| U109 | Tool library (save tools, one-tap fill) | done | `toollib` | Branch `claude/dxf-toollib`: fill into the nine calculators that take a tool diameter, flutes or lengths |
| U110 | Offline use | partial | | Runs from local files with no network calls; no installable offline build (no manifest or service worker) |
| U111 | Web app / link to desktop | partial | | BenchMate is a web app; no phone-to-desktop link |
| U112 | iOS and Android apps | missing | | Later phase |
| U113 | 23 languages | missing | | English only |

## 2. Machinery's Handbook, 31st edition

Rows follow the section contents pages (main entries, sub-entries grouped).

### Mathematics

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH1 | Real numbers, fractions, decimals, ratio, percentage | done | `calc`, `fraction` | Expression calculator and fraction converter (`claude/measure-maths`) |
| MH2 | Powers, roots, scientific notation, factorials, combinations | done | `calc` | Powers, roots, logs, factorials, nCr, nPr; numbers in e notation (`claude/measure-maths`) |
| MH3 | Prime factorization and prime/factor tables | partial | `calc` | Prime factors of any whole number to 10^12; no printed factor tables (`claude/measure-maths`) |
| MH4 | Algebra: expressions, equations, rearranging formulas, polynomials, quadratic/cubic | out of scope? | | Maths teaching, not a machining tool |
| MH5 | Functions, logarithms, sequences | out of scope? | | |
| MH6 | Analytic geometry: lines, slopes, circle, ellipse, sphere, parabola, hyperbola | missing | | Line/circle intersections, ellipse points. Partly in progress (`claude/geometry`) |
| MH7 | Complex numbers | out of scope? | | |
| MH8 | Pure geometry propositions and geometric constructions | missing | | |
| MH9 | Area and volume rules (prismoidal, Pappus, irregular areas, tank contents) | partial | `figures` | Torus (Pappus), frustum, cap; no prismoidal formula, irregular areas or tank contents (`claude/measure-maths`) |
| MH10 | Dimensions of plane figures, polygons, segments of a circle | done | `figures`, `arc` | Squares, rectangles, parallelograms, trapezoids, circles, rings, ellipses, regular polygons, sectors; segments in `arc` (`claude/measure-maths`) |
| MH11 | Circles and squares of equal area; diagonals of squares and hexagons | partial | `figures` | Across corners and flats of any regular polygon; no equal-area circle/square table (`claude/measure-maths`) |
| MH12 | Volumes of solids | done | `figures` | Cube, box, cylinder, tube, cone, frustum, sphere, cap, pyramid, torus, hex bar (`claude/measure-maths`) |
| MH13 | Trigonometry: angle measure, ratios, laws of sines and cosines, identities | missing | | In progress (`claude/geometry`) |
| MH14 | Solution of right and oblique triangles | missing | | In progress (`claude/geometry`, `triangle`) |
| MH15 | Angular measure conversion (degrees-minutes-seconds, radians) | done | `calc`, `units` | Decimal degrees, DMS, radians, gon, revolutions (`claude/measure-maths`) |
| MH16 | Trig function values, versed sine, involute functions | partial | `calc` | Any trig value and the involute function; no versed sine, no printed tables (`claude/measure-maths`) |
| MH17 | Spherical trigonometry | out of scope? | | |
| MH18 | Compound angles | done | `compound` | True angle from apparent angles or two tilts; swivel-and-tilt and compound sine plate settings (`claude/measure-maths`) |
| MH19 | Interpolation | partial | `calc` | Linear interpolation only (`claude/measure-maths`) |
| MH20 | Matrices | out of scope? | | |
| MH21 | Calculus, Newton's method, series | out of scope? | | |
| MH22 | Statistics: probability and normal distribution | partial | `capability` | Normal fit and ppm only |
| MH23 | Applying statistics: minimum number of tests, comparing averages | missing | | |
| MH24 | Engineering economics: interest, present value, annuities, depreciation | partial | `economics` | Capital recovery factor, machine hourly rate, break-even, payback, discounted payback, NPV; no depreciation schedules (`claude/measure-maths`) |

### Mechanics and strength of materials

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH25 | Mechanics terms, units, force systems, couples | out of scope? | | |
| MH26 | Friction laws and coefficients | missing | | Clamping and workholding friction |
| MH27 | Simple mechanisms: levers, wedge, pulleys, screw, Geneva, toggle | out of scope? | | Toggle/screw clamps could matter for fixtures |
| MH28 | Pendulums | out of scope? | | |
| MH29 | Velocity, acceleration, work, energy, momentum, power | out of scope? | | |
| MH30 | Centrifugal force | done | `chuckforce` | F = m r omega^2, jaw centrifugal force and grip left at speed, OD and ID gripping (`claude/mechanics`) |
| MH31 | Balancing rotating parts, balancing lathe fixtures | partial | `balance` | ISO 21940-11 permissible unbalance, two-plane split, correction mass; no trial-weight balancing procedure or lathe fixture counterweight layout (`claude/mechanics`) |
| MH32 | Critical speeds | partial | `critspeed` | Uniform shaft with up to three discs, Rayleigh and Dunkerley; no stepped shafts or flexible bearings (`claude/mechanics`) |
| MH33 | Mechanical properties, stress and strain, factor of safety, stress concentration | partial | `stressconc`, `fatigue` | Holes in plates, fatigue factors of safety; no stress-strain basics, no stepped-shaft or groove Kt (no free source) (`claude/mechanics`) |
| MH34 | Combined and 3D stresses, loaded rings, strength of taper pins | missing | | |
| MH35 | Centre of gravity, radius of gyration, moment of inertia, section modulus | done | `section` | Eight shapes built up from rectangles, principal axes, S, r, J (`claude/mechanics`) |
| MH36 | Beams: stresses and deflections | done | `beam`, `deflection` | Cantilever, simply supported, fixed-fixed; point and uniform loads; no overhangs or partial loads (`claude/mechanics`) |
| MH37 | Columns | done | `column` | Euler and Johnson, end-condition K (`claude/mechanics`) |
| MH38 | Plates, shells and cylinders | out of scope | | Pressure vessels |
| MH39 | Shafts: torsion, deflection, design, keyway effect | partial | `torsion`, `critspeed` | Torsion, power, twist, critical speed; no keyway effect or combined bending and torsion design (`claude/mechanics`) |
| MH40 | Springs: materials, stresses, compression/extension/torsion design | missing | | |
| MH41 | Disc springs | missing | | |

### Properties, treatment and testing of materials

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH42 | The elements | missing | | Symbol and property table |
| MH43 | Latent heat, specific heat, heat loss from steam pipes | out of scope | | Thermodynamics, steam |
| MH44 | Thermal properties; adjusting length for temperature | done | `tempcomp`, `shrinkfit`, `materials` (CTE) | Measurement correction and plain growth for a temperature change (`claude/measure-maths`) |
| MH45 | Density and specific gravity | partial | `materials` | Density for 34 grade/condition entries only |
| MH46 | Weight of piles, molecular weight, mole, air, alligation, soil weight | out of scope? | | |
| MH47 | Properties of wood | out of scope? | | |
| MH48 | Tabulated properties of ceramics, plastics, investment-casting and powder metal alloys | partial | `materials` | 5 plastics; no ceramics, casting or PM alloys |
| MH49 | Elastic properties; effect of temperature on strength | partial | `materials` | E for 27 entries; no temperature effect |
| MH50 | Standard steels: classification, AISI/SAE/UNS numbering | partial | `materials` | Equivalents only; no numbering-system explainer |
| MH51 | Identifying metals | partial | `metalid` | Spark, magnet and chip tests (one source); no chemical spot tests |
| MH52 | Compositions of carbon, alloy and stainless steels | missing | | Chemistry not stored |
| MH53 | Applications and mechanical properties of steels | partial | `materials` | Properties for some grades; no applications |
| MH54 | Tool steels: properties, faults, classification, selection, HSS, hot/cold work, mould steels | partial | `materials` | 10 tool-steel grades as equivalents; no selection guide, faults or heat treatment |
| MH55 | Tool steel mill forms, machining allowances, decarburization limits | missing | | |
| MH56 | Heat treatment: definitions, hardness and hardenability | partial | `heattreat` | Terms in our words (7 of 12 used by two publishers); no hardness and hardenability theory |
| MH57 | Hardening, quenching, tempering temperatures, annealing, normalising | partial | `heattreat`, `tempercolours` | 12 steels side by side (2 confirmed, 16 differ); no tempering-hardness tables (no two sources agree) |
| MH58 | Case hardening: carburising, nitriding, flame and induction hardening | partial | `heattreat` | Terms and 4340 nitriding only; no case depth or process data |
| MH59 | Heat treating high-speed steels; subzero treatment | missing | | |
| MH60 | Hardness tests: Brinell, Rockwell, Vickers, Knoop, Shore, Mohs, durometer | missing | | In progress (`claude/ref-data-3`) |
| MH61 | Comparison of hardness scales | missing | | In progress (`claude/ref-data-3`) |
| MH62 | Nonferrous: copper alloys | partial | `materials` | 12 copper alloys; no temper explainer |
| MH63 | Aluminium: temper designations, alloy designations, heat-treatability | partial | `materials` | Grades only; no temper (T6, H32...) explainer |
| MH64 | Magnesium, nickel, titanium alloys | partial | `materials` | Ni and Ti present; no magnesium |
| MH65 | Corrosion types and galvanic corrosion | partial | `galvanic` | Galvanic series and two-metal check; no other corrosion types |
| MH66 | Plastics: families, properties, design analysis | partial | `materials`, `plastics` | 12 plastics with service temperature and expansion; no design data |
| MH67 | Plastics processing (thermoforming, moulding) and additive manufacturing | out of scope? | | |
| MH68 | Machining plastics | done | `plastics` | Makers' turning data side by side, annealing, notes (`claude/materials-ref`) |

### Dimensioning, gauging and measuring

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH69 | Drafting practices: sheet sizes, line types, section lining | missing | | |
| MH70 | ASME and ISO geometric symbols | done | `gdtguide` | |
| MH71 | Surface texture symbols | missing | | In progress (`claude/ref-data-3`) |
| MH72 | GD&T, datum referencing, positional tolerance | done | `gdtguide`, `gdtdof`, `gdttp`, `gdtfcf` | |
| MH73 | GD&T and CAD models, digital product definition | missing | | |
| MH74 | Checking designs and drawings, arrangement of views | out of scope? | | Design office work |
| MH75 | Limits and fits basics: unilateral/bilateral tolerances | partial | `fits` | Only via ISO classes |
| MH76 | Force, expansion and shrink fits; temperatures for shrinkage fits | done | `shrinkfit` | Shrink-fit temperatures (hub heated, shaft cooled, both) and Lame press-fit pressure, stress, torque; inputs are yours (`claude/measure-maths`) |
| MH77 | ANSI/ASME standard fits (RC, LC, LT, LN, FN) | partial | `ansifits` | All 34 classes 0 to 19.69 in, but only one full table read: 491 of 492 rows need a 2nd source; above 19.69 in not covered (`claude/inspection-2`) |
| MH78 | ANSI preferred metric limits and fits | partial | `fits` | Any class works; preferred fits not listed |
| MH79 | ISO metric limits and fits | done | `fits` | j/J and up to 3150 mm added (`claude/inspection-2`) |
| MH80 | Tolerance stack-up chain, analysis and assignment | partial | `gdtstack` | 1D worst case and RSS; no tolerance assignment |
| MH81 | Preferred numbers and sizes | partial | `prefnum` | Renard R5 to R80 (R40-only and R80 values single-source); no more-rounded R' and R'' series, no preferred metric sizes (`claude/inspection-2`) |
| MH82 | Reading verniers and micrometers | done | `scales` | Reading aid for micrometers (0.01, 0.001 mm; 0.001, 0.0001 in) and vernier calipers (0.02, 0.05 mm; 0.001 in) (`claude/measure-maths`) |
| MH83 | Sine bar use and constants | missing | | In progress (`claude/geometry`, `sinebar`) |
| MH84 | Measuring tapers with V-block; dimensioning tapers; taper per foot | partial | `taper`, `machinetapers`, `taperrolls` | Taper per foot, angle, over-rolls measurement; no V-block method (`claude/measure-maths`) |
| MH85 | Measuring angles and dovetail slides | missing | | In progress (`claude/geometry`, `dovetail`) |
| MH86 | Measurement over pins and rolls; V-groove; radius of arc | partial | `dovetail`, `taperrolls`, `ballcone` | Dovetails, V-grooves, tapers over rolls, balls in bores; no radius-of-arc over rolls (`claude/measure-maths`) |
| MH87 | Checking shaft conditions | missing | | |
| MH88 | Coordinates for hole circles; chord lengths; hole coordinate tables | done | `bolt` | |
| MH89 | Gauge blocks and gauge block sets | missing | | In progress (`claude/geometry`, `sinebar`) |
| MH90 | Surface plates, V-blocks, parallels, angle plates and their calibration | missing | | |
| MH91 | Measurements using light, interferometer | out of scope? | | |
| MH92 | Micrometers, verniers, dial and digital calipers; their calibration | partial | `scales` | Reading only; no calibration (`claude/measure-maths`) |
| MH93 | Surface texture: terms, sampling lengths, roughness and waviness parameters | missing | | In progress (`claude/ref-data-3`) |
| MH94 | Roughness average values, lay symbols, castings | partial | `finish` | Theoretical Ra/Rt from feed and nose radius only |
| MH95 | ISO surface finish standards and profiles | missing | | In progress (`claude/ref-data-3`) |

### Tooling and toolmaking

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH96 | Single-point tool terms: contour, relief, rake, lead angles, nose radius, chipbreakers | partial | `toolguide` | Rake, clearance, entering/lead angle, helix, nose radius, chip breaker and edge hone in own words with drawings (mostly marked "needs 2nd source"); no tool signature or contour terms (`claude/tooling-ref`) |
| MH97 | Indexable insert identification system | done | `insertcode` | Decode and build ISO 1832 codes with evidence (`claude/ref-data-3`); status corrected on `claude/tooling-ref` |
| MH98 | Indexable insert holder identification and selection | partial | `holdercode` | ISO 5608 external holder codes decoded; no selection guide (status corrected on `claude/tooling-ref`) |
| MH99 | Carbide blanks and carbide-tipped tool styles | missing | | |
| MH100 | Insert radius compensation (NC); threading insert radius | partial | `tnrc` | Nose radius shifts for chamfers, tapers and arcs, any tip 0-9, G41/G42 explained; no threading insert radius (`claude/cnc-guide`) |
| MH101 | Cemented carbides, ceramics, superhard materials | partial | `toolguide` | One-paragraph summary of HSS, carbide, cermet, ceramic, CBN, PCD (needs 2nd source); no property data (`claude/tooling-ref`) |
| MH102 | ISO classification of hardmetals (P/M/K/N/S/H) | partial | `materials` (ISO group) | Groups shown on work materials; no grade chart |
| MH103 | Milling cutters: selection, number of teeth, plain/side/T-slot/angle/shell/end mills | partial | `toolguide` | End mill flutes, end shapes, roughers, variable helix, high-feed; no plain, side, T-slot, angle or shell cutters (`claude/tooling-ref`) |
| MH104 | Metal slitting saws | missing | | |
| MH105 | Keyseat and Woodruff cutters, spline-shaft cutters | missing | | |
| MH106 | Cutter grinding: wheel speeds, clearance angles, indicator drop method | missing | | |
| MH107 | Reamers: types, sizes, difficulties | partial | `toolguide` | Reamer types, flute direction by hole, stock allowance and speed (two sources shown); no reamer sizes or tolerances (`claude/tooling-ref`) |
| MH108 | Dimensions of centres; countersink and spot drill depths | missing | | |
| MH109 | Twist drill terms and types | partial | `toolguide` | Drill types and point angles 118/135/140, split point, spot drill angle; no terms drawing (`claude/tooling-ref`) |
| MH110 | Drill sizes: fractional, gauge, letter, metric | done | `drillchart` | |
| MH111 | Taper-shank drills; tolerance on diameter; accuracy of drilled holes | missing | | |
| MH112 | Counterboring, counterbore sizes for bolts | partial | `shcs` | Counterbore sizes for socket head cap screws only (two makers, shown side by side); no counterboring practice or other head types |
| MH113 | Boring tools | missing | | |
| MH114 | Taps: forms, marking, series designations, tap terms and dimensions | partial | `toolguide` | Tap types (spiral point, spiral flute, straight, forming) and chamfer lengths; no marking, series or tap dimensions (`claude/tooling-ref`) |
| MH115 | Tap thread limits (H and D limits), pipe and insert taps | partial | `taplimits` | Inch H and L, metric D numbers computed and checked against 1B/2B/3B and 6H/5H/7H/6G; no pipe or STI tap limits; D minimums only where OSG prints them (`claude/tooling-ref`) |
| MH116 | Acme and square-threaded taps | missing | | |
| MH117 | Morse tapers | done | `machinetapers` | |
| MH118 | Brown & Sharpe and Jarno tapers | missing | | |
| MH119 | ANSI machine tapers and 7/24 tool shanks | done | `machinetapers` | |
| MH120 | British standard tapers | missing | | |
| MH121 | Jacobs tapers and threads | partial | `machinetapers` | Tapers only; no Jacobs threaded mounts |
| MH122 | Spindle noses, draw-in bolts, V-flange shanks and retention knobs | partial | `machinetapers` | Retention knob standard references only; no dimensions |
| MH123 | Plug and ring gauges for tapers | missing | | |
| MH124 | R8 collet | done | `machinetapers` | |
| MH125 | ER and other collets | missing | | |
| MH126 | Portable tool spindles, square drives, hex chucks | out of scope? | | Portable power tools |
| MH127 | Mounted wheels and points | missing | | |
| MH128 | Broaches and broaching: tooth pitch, depth per tooth, broach design | missing | | |
| MH129 | Files and burs; speeds of rotary burs | missing | | |
| MH130 | Knurls and knurling: sizes, formulas for knurled work, tolerances | missing | | |
| MH131 | Tool wear: flank wear, cratering, chipping, deformation | done | `cncguide` | See U91 (`claude/cnc-guide`) |
| MH132 | Sharpening twist drills, point thinning, carbide tool grinding, diamond wheels | missing | | |
| MH133 | Sieves, mesh and abrasive grit numbers | missing | | |

### Machining operations

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH134 | Work materials and cutting tool materials | missing | | |
| MH135 | Cutting speed, feed, depth of cut, tool wear and tool life | partial | `toollife` | Taylor life only |
| MH136 | Selecting cutting conditions | missing | | |
| MH137 | Tool troubleshooting | partial | `cncguide` | Short turning and milling troubleshooting tables (chatter, finish, tool life, burrs); not a full maker guide (`claude/cnc-guide`) |
| MH138 | Cutting speed formulas; RPM for drills and diameters | done | `rpm` | |
| MH139 | Speeds and feeds tables for turning (by material) | missing | | Starting data from tool makers |
| MH140 | Speeds and feeds tables for milling (by material), slit milling | missing | | |
| MH141 | Speed, radial depth of cut and tool life adjustment factors | partial | `cutopt`, `toollife` | Chip thickness and Taylor only; no feed/speed adjustment factors |
| MH142 | Speeds and feeds for drilling, reaming and threading (by material) | missing | | |
| MH143 | Cutting speed for broaching | missing | | |
| MH144 | Planing and shaping speeds and times | out of scope? | | Planers and shapers rare now |
| MH145 | Cutting time for turning, boring and facing | partial | `passtime` | One pass at fixed RPM; no facing with CSS |
| MH146 | Speeds for metal-cutting saws | missing | | |
| MH147 | Estimating machining power: power constants, feed and wear factors | partial | `mrr`, `cutopt` | kc entered by user; no constants |
| MH148 | Drilling thrust, torque and power | missing | | |
| MH149 | Boring: cutting force and boring bar deflection | done | `boringbar` | See U9 (`claude/calcs-3`) |
| MH150 | Micromachining: tools, stiffness, offsets, fluids, micromilling/drilling/turning | missing | | |
| MH151 | Tool wear and tool life: ECT, Taylor, G and H curves | partial | `toollife` | Taylor only; no ECT or extended Taylor |
| MH152 | Minimum cost, production rate, cost function, global optimum | partial | `toollife` | Cost per part and economic life; no max-production or feed/speed optimisation |
| MH153 | Machine settings and calculation of costs (all operations incl. grinding) | partial | `toollife` | Single tool only |
| MH154 | High-speed machining econometrics, chip geometry in milling, mean chip thickness | partial | `cutopt` | Mean chip thickness only |
| MH155 | Automatic screw machines: knurling, cams, speeds, stock | partial | `bar` | Bar stock per part only; cam work missing |
| MH156 | Band saw blade selection, speeds, feeds, break-in | partial | `sawtpi`, `bandsaw` | 3-teeth-in-cut pitch rule (two sources) and cut time; no speeds or break-in (`claude/tooling-ref`) |
| MH157 | Cutting fluids: selection, cutting oils, water-miscible fluids | missing | | |
| MH158 | Metalworking fluids: classes, maintenance, exposure | partial | `coolconc`, `coolmix` | Concentration and mix only |
| MH159 | Machining nonferrous metals (aluminium, magnesium, zinc, nickel, copper) | missing | | |
| MH160 | Machining non-metals (hard rubber, laminates) | missing | | |
| MH161 | Grinding feeds and speeds: wheel life, grinding ratio, optimum data, spark-out, forces | missing | | |
| MH162 | Grinding data selection and grindability groups | missing | | |
| MH163 | Grinding wheels: abrasives, bonds, structure, ANSI markings, shapes, selection | partial | `wheelcode`, `gritconv` | Abrasives, bonds, grade, structure and markings decoded with sources; no wheel shapes or selection guide (`claude/calcs-3`) |
| MH164 | Dressing and truing; diamond sizes | missing | | |
| MH165 | Diamond wheels: shapes, designations, selection | missing | | |
| MH166 | Grinding wheel safety and safe operating speeds | partial | `grindspeed`, `wheelcode` | Speed check against the marked max speed and the rule to obey it; no full safety code (`claude/calcs-3`) |
| MH167 | Cylindrical grinding (traverse, plunge, high speed, troubles) | partial | `grindtime`, `grindspeed` | Traverse and plunge time, speed ratio, equivalent diameter; no high-speed grinding or troubleshooting (`claude/calcs-3`) |
| MH168 | Centerless grinding | missing | | |
| MH169 | Surface grinding | partial | `grindsurf` | Cycle time only; no wheel or feed recommendations (`claude/calcs-3`) |
| MH170 | Offhand, belt grinding and abrasive cutting | missing | | |
| MH171 | Honing | missing | | |
| MH172 | Laps and lapping | missing | | |
| MH173 | Nontraditional: water jet, ultrasonic, abrasive flow, laser, plasma, electron beam | missing | | Low priority |
| MH174 | CNC introduction, coordinate geometry, word address format, program structure | partial | `cncguide` | Axes, coordinate systems, block and word format, modal groups, program order; no coordinate geometry worked examples (`claude/cnc-guide`) |
| MH175 | M-codes, G20/G21, G90/G91, S, F, inverse time feed, T | missing | | |
| MH176 | Tool nose radius compensation | done | `tnrc` | Hand compensation and G41/G42 with tip numbers (`claude/cnc-guide`) |
| MH177 | Rapid, linear, circular and helical interpolation | partial | `helix`, `arcfeed` | Feed maths only; no G-code reference or output |
| MH178 | Work offsets, tool length offsets, cutter radius offsets | done | `cncguide` | Work offsets (G54-G59 and extended), tool length, cutter radius and wear offsets explained (`claude/cnc-guide`) |
| MH179 | Fixed (canned) cycles for holes | partial | `cycdrill` | Generator for G81/G82/G83/G73/G84; no reference text on the cycles |
| MH180 | Contouring, turning and boring on CNC | missing | | |
| MH181 | Thread cutting on CNC lathes: depth, infeed, G32, G76, multi-start | partial | `cycthread` | Depth, infeed, G76 and G92; no G32, no multi-start, no tapered threads |
| MH182 | Subprograms, macros and parametric programming | missing | | |
| MH183 | Axis nomenclature | done | `cncguide` | ISO 841 right-hand rule, mill and lathe axes, rotary axes (`claude/cnc-guide`) |
| MH184 | Total indicator reading | missing | | |
| MH185 | CAD/CAM: drawing types, projections, exchange standards | missing | | |

### Manufacturing processes

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH186 | Sheet metal: shearing, blanking force, stripper force | missing | | Low priority |
| MH187 | Sheet metal bending (bend allowance) | missing | | In progress (`claude/geometry`, `bend`) |
| MH188 | Stretch forming, dies, presses, tube bending | out of scope? | | Press shop, not machining |
| MH189 | EDM: terms, process, wire EDM | missing | | |
| MH190 | Metal casting, moulding and extrusion | out of scope | | Casting process detail |
| MH191 | Powder metallurgy and metal additive manufacturing | out of scope? | | |
| MH192 | Soldering and brazing | out of scope? | | Joining, like welding |
| MH193 | Welding processes | out of scope | | |
| MH194 | Weld and welding symbols | missing | | Drawing reading; low priority |
| MH195 | Nondestructive testing | out of scope? | | |
| MH196 | Finishing: brushing, polishing, buffing, etching | missing | | Low priority |
| MH197 | Conversion coatings, anodising, plating, flame spraying | missing | | Plating/anodise allowance matters for threads and fits |

### Fasteners

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH198 | Torque and tension: tightening, wrench torque, preload, friction | partial | `bolttorque` | VDI 2230 torque from preload with your own friction (cited classes shown); no torque-angle or yield-controlled tightening, no tightening factor (scatter) |
| MH199 | Thread tensile-stress area, torque-tension relationships | done | `bolttorque` | Stress area (ISO and Unified), torque-preload relation with the share of each term (`claude/fasteners`) |
| MH200 | Grade marks, material properties, counterfeit detection | partial | `boltgrade` | ISO 898-1, SAE J429 and ASTM A574 minimums and head marks; no counterfeit detection |
| MH201 | Working strength, engagement length, breaking force, lock wire | missing | | Thread engagement length is a common shop question |
| MH202 | Inch bolts, screws, nuts and washers (dimensions) | partial | `shcs`, `spanner` | Socket head cap screw heads and hex widths across flats only; no full bolt, nut and washer dimensions |
| MH203 | Wrench clearances | missing | | |
| MH204 | Metric hex screws, bolts, nuts and washers | partial | `spanner` | Widths across flats (ISO 272, old DIN, JIS) only; no head heights, nuts or washers |
| MH205 | Socket head cap screws (inch and metric) | done | `shcs` | ISO 4762 and ASME B18.3 head diameter, height and key (`claude/fasteners`) |
| MH206 | Clearance holes for bolts, screws and studs (inch and metric) | done | `clearance` | ISO 273 fine/medium/coarse and inch close/normal/free, with disagreements (`claude/fasteners`) |
| MH207 | Helical coil screw thread inserts (STI) | partial | `sti` | Tapped-hole sizes; no insert lengths or installation data (`claude/threads-3`) |
| MH208 | British fasteners | missing | | |
| MH209 | Machine screws and nuts (inch, metric, British) | missing | | |
| MH210 | Cap screws and set screws; drill and counterbore sizes; hex keys | partial | `shcs`, `clearance`, `spanner` | Cap screws, clearance and counterbore holes and hex keys; no set screws |
| MH211 | Self-threading and thread-forming screws; hole sizes | missing | | |
| MH212 | T-slots, T-bolts and T-nuts | partial | `tslots` | ISO 299 T-slot dimensions and pitches; no T-bolt or T-nut dimensions |
| MH213 | Rivets and riveted joints | out of scope? | | |
| MH214 | Pins and studs: dowel pins, taper pins, spring pins, grooved pins, cotter pins | missing | | Dowel hole fits matter |
| MH215 | Retaining rings | missing | | Groove dimensions |
| MH216 | Wing nuts, wing screws and thumb screws | missing | | Low priority |
| MH217 | Nails, spikes and wood screws | out of scope | | |

### Threads and threading

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH218 | Screw thread forms and definitions | partial | `threaddata` | Data, no forms overview |
| MH219 | Unified threads: form, series (coarse, fine, extra-fine), classes, designation | done | `threaddata` | |
| MH220 | Unified constant-pitch series (4 to 28 threads) and UNS | partial | `unseries`, `threaddata` (custom) | 8, 12 and 16-UN lists only (`claude/threads-3`) |
| MH221 | Coated 60-degree threads | partial | `coating` | Allowance and before-coating pitch diameter limits; no coated-thread tables (`claude/threads-3`) |
| MH222 | Multiple-start threads | done | `multistart`, `acme`, `trapezoidal` | Lead, pitch, lead angle, indexing between starts (`claude/threads-3`) |
| MH223 | Hole sizes for tapping, internal thread minor diameter tolerances | done | `tapdrill`, `threaddata` | |
| MH224 | Unified miniature threads | done | `unm` | (`claude/threads-3`) |
| MH225 | UNJ threads | done | `unjunr` | (`claude/threads-3`) |
| MH226 | Calculating and rounding thread dimensions | done | `threaddata` | |
| MH227 | Metric M profile: limits and fits, formulas, tolerance grades | done | `threaddata` | 6g/6H checked, others computed |
| MH228 | Metric limits for coated threads | partial | `coating` | General allowance only; no ISO 965 coated-thread limits (`claude/threads-3`) |
| MH229 | Metric MJ profile | missing | | |
| MH230 | Trapezoidal metric threads | partial | `trapezoidal` | ISO 2904 basic dimensions; no ISO 2903 tolerances (`claude/threads-3`) |
| MH231 | ISO miniature threads | missing | | |
| MH232 | ACME general purpose and centralizing threads | done | `acme` | Single-start limits; no 5G/5C/6C (`claude/threads-3`) |
| MH233 | Stub ACME, alternate stub, 60-degree stub, square thread | partial | `acme` | Stub ACME only; no modified stub, 60-degree stub or square thread (`claude/threads-3`) |
| MH234 | Buttress threads (British and 7/45 inch) | partial | `buttress` | 7/45 inch basic dimensions only; no tolerances, no British form (`claude/threads-3`) |
| MH235 | Whitworth BSW and BSF: form, tolerances, basic dimensions | partial | `whitworth` | No tolerances |
| MH236 | Taper pipe threads (NPT): dimensions, engagement, tolerances | partial | `pipethreads` | No tolerances |
| MH237 | Straight pipe threads (NPSM, NPSL etc.) | missing | | |
| MH238 | Dryseal pipe threads (NPTF) | partial | `pipethreads` | Notes only (form, sealing, related Dryseal types); no truncation limits (`claude/threads-3`) |
| MH239 | British pipe threads (BSP) | done | `pipethreads` | |
| MH240 | Hose coupling and fire hose threads | missing | | Low priority |
| MH241 | Interference-fit threads | missing | | |
| MH242 | Spark plug, lamp base and electrical fixture threads | out of scope? | | |
| MH243 | Instrument threads; British Association (BA) | partial | `whitworth` | BA done; instrument and microscope threads missing |
| MH244 | Historical and miscellaneous threads | out of scope? | | |
| MH245 | Measuring threads: pitch, lead, thread and ball micrometers | missing | | |
| MH246 | Three-wire method, best wire sizes, formulas | partial | `wires` | 60, 55, 30, 29 degree; no lead-angle correction (`claude/threads-3`) |
| MH247 | Wire measurement of Whitworth, ACME, stub ACME, taper and buttress threads | partial | `wires`, `acme`, `trapezoidal` | Whitworth, ACME, Stub ACME and trapezoidal; no taper or buttress wires (`claude/threads-3`) |
| MH248 | Thread gauges, gauge tolerances | missing | | |
| MH249 | Tapping: selection of taps, rake angles, cutting speed, lubricants | missing | | |
| MH250 | Tap drill diameter, percentage of thread, cold form tapping | done | `tapdrill` | |
| MH251 | Tap and clearance drills; tolerances of tapped holes | done | `tapdrill`, `threaddata`, `clearance` | Clearance holes added in `clearance` (`claude/fasteners`) |
| MH252 | Removing a broken tap | missing | | |
| MH253 | Tap drills and power for pipe taps | missing | | |
| MH254 | High-speed CNC tapping; combined drilling and tapping | missing | | |
| MH255 | Relief angles for thread cutting tools | missing | | |
| MH256 | Lathe change gears (inch, metric, fractional, quick-change gearbox) | partial | `changegears` | Simple and compound trains from your gears for TPI, mm, module and DP; no quick-change gearbox tables (`claude/measure-maths`) |
| MH257 | Relieving helical-fluted hobs | out of scope? | | |
| MH258 | Thread rolling: machines, blank diameter, roll diameter, speeds | missing | | |
| MH259 | Thread grinding | missing | | |
| MH260 | Thread milling: methods, helix angles | partial | `cyctmill` | Program, helix angle, feed; no method guide |

### Gears, splines and cams

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH261 | Gear terms, involute, diametral and circular pitch | missing | | |
| MH262 | Spur gear formulas, tooth proportions, outside and root diameters | missing | | |
| MH263 | Centre distance, tooth thickness, chordal addendum and thickness | missing | | |
| MH264 | Gear milling cutters (involute cutter numbers) | missing | | |
| MH265 | Contact ratio, undercut, minimum teeth, enlarged pinions | missing | | |
| MH266 | Backlash | missing | | |
| MH267 | Internal gears | missing | | |
| MH268 | British and ISO gear standards; addendum modification | missing | | |
| MH269 | Hypoid and bevel gears | missing | | |
| MH270 | Worm gearing | missing | | |
| MH271 | Helical gearing; milling helical gears; hobbing change gears | missing | | |
| MH272 | Elliptic, planetary and ratchet gearing | missing | | Low priority |
| MH273 | Module system gear design | missing | | |
| MH274 | Checking gear sizes: over wires/balls, chordal measurement | missing | | |
| MH275 | Gear materials | missing | | |
| MH276 | Involute splines (ANSI B92.1) | missing | | |
| MH277 | Metric module splines (ISO 4156) | missing | | |
| MH278 | Straight splines; polygon shaft connections | missing | | |
| MH279 | Spline inspection with gauges and pins | missing | | |
| MH280 | Cams and cam design; cam milling | missing | | |

### Machine elements

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH281 | Plain bearings: types, design, lubrication | out of scope? | | Design rather than machining |
| MH282 | Plain bearings: machining bores, hardness and finish; bearing materials | missing | | |
| MH283 | Rolling bearings: types, designation, tolerances | missing | | |
| MH284 | Shaft and housing fits for bearings; mounting | missing | | |
| MH285 | Bearing load ratings and life (L10) | partial | `bearinglife` | ISO 281 basic rating life L10 and equivalent load with your X and Y; no modified life (aISO) or static safety factor |
| MH286 | Lubrication theory, lubricants, contamination | out of scope? | | |
| MH287 | Couplings, clutches, brakes | out of scope? | | Cutting clutch teeth is the only machining part |
| MH288 | Keys and keyseats (metric, inch, Woodruff), keyseat depths | partial | `keys` | Metric (DIN 6885-1 / ISO 773) and inch (ASME B17.1) parallel keys and keyseat depths; no Woodruff (no second source) |
| MH289 | Belts and pulleys (flat, V, synchronous) | missing | | |
| MH290 | Transmission chains and sprockets | missing | | |
| MH291 | Ball and ACME leadscrews | missing | | |
| MH292 | Electric motors | missing | | |
| MH293 | Adhesives and sealants, retaining compounds, threadlocking | missing | | |
| MH294 | O-rings and glands | partial | `oring` | AS568 sizes and a squeeze, stretch and fill check; no ISO 3601-1 G series, no -9xx sizes, no back-up rings |
| MH295 | Rolled steel sections, aluminium structural shapes | missing | | |
| MH296 | Wire and sheet metal gauges | missing | | |
| MH297 | Wire rope | out of scope | | |
| MH298 | Shaft alignment with dial indicators | missing | | |
| MH299 | Fluid power: circuits, pressure and flow, tube fittings, pneumatics | missing | | Low priority |

### Measuring units

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| MH300 | Greek alphabet, abbreviations, mathematical signs, letter symbols | missing | | |
| MH301 | SI system, prefixes, US customary system, constants | partial | `units` | US customary and SI units; no prefix or constants table (`claude/measure-maths`) |
| MH302 | Length conversions (inches, fractions, mm, feet) | done | `fraction` | |
| MH303 | Area, volume and flow conversions | done | `units` | Area, volume, flow (`claude/measure-maths`) |
| MH304 | Mass, density, pressure, force and torque conversions | done | `units` | Mass, density, pressure, force, torque (`claude/measure-maths`) |
| MH305 | Energy, power, heat and temperature conversions | done | `units` | Energy, power, temperature and temperature difference (`claude/measure-maths`) |
| MH306 | Velocity, acceleration, viscosity and miscellaneous units | partial | `units` | Speed, feed and angle; no acceleration or viscosity (`claude/measure-maths`) |

## 3. Engineers' Data Book (Clifford Matthews)

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| ED1 | 1.1-1.7 Engineering careers (7 entries) | out of scope | | |
| ED2 | 2.1 Greek alphabet | missing | | |
| ED3 | 2.2 Units systems | partial | `units` | SI and US customary conversions; no units-system explainer (`claude/measure-maths`) |
| ED4 | 2.3 Units and conversions | partial | `fraction` | Length only |
| ED5 | 2.4 Consistency of units | out of scope? | | |
| ED6 | 2.5 Dimensional analysis | out of scope? | | |
| ED7 | 2.6 Essential engineering mathematics | missing | | Scientific calculator, trig (in progress) |
| ED8 | 2.7 Maths and the real world | out of scope? | | |
| ED9 | 3.1-3.12 Engineering design process and principles (12 entries) | out of scope? | | Design methodology |
| ED10 | 4.1 Engineering abbreviations | partial | `abbrev` | Drawing abbreviations only (`claude/measure-maths`) |
| ED11 | 4.2 Datums and tolerances: principles | done | `gdtguide`, `gdtdof` | |
| ED12 | 4.3 Toleranced dimensions | partial | `gdtguide`, `gdtstack` | No guide to plus/minus dimensioning |
| ED13 | 4.4 General tolerances (ISO 2768) | done | `gentol` | ISO 2768-1 linear, broken edges and angles, five publishers; ISO 2768-2 is withdrawn (`claude/measure-maths`) |
| ED14 | 4.5 Holes | partial | `fits` | |
| ED15 | 4.6 Screw threads | done | `threaddata` | |
| ED16 | 4.7 Limits and fits | partial | `fits` | No j/J |
| ED17 | 4.8 Surface finish | partial | `finish` | Conversions and symbols in progress |
| ED18 | 5.1 Equilibrium | out of scope? | | |
| ED19 | 5.2 Motion equations | out of scope? | | |
| ED20 | 5.3 Newton's laws | out of scope? | | |
| ED21 | 5.4 Simple harmonic motion | out of scope? | | |
| ED22 | 5.5 Understanding acceleration | out of scope? | | |
| ED23 | 5.6 Dynamic balancing | partial | `balance` | Permissible unbalance and two-plane split; no balancing procedure (`claude/mechanics`) |
| ED24 | 5.7 Vibration | missing | | Basis for chatter tools |
| ED25 | 5.8 Machine vibration | missing | | Severity limits |
| ED26 | 5.9 Machinery noise | out of scope? | | |
| ED27 | 6.1 Mechanical notation | out of scope? | | |
| ED28 | 6.2 Engineering structures, pin joints | out of scope? | | |
| ED29 | 6.3 Simple stress and strain | missing | | |
| ED30 | 6.4 Simple elastic bending | done | `beam` | M c / I for eight sections (`claude/mechanics`) |
| ED31 | 6.5 Slope and deflection of beams | done | `beam` | Three support cases, point and uniform loads (`claude/mechanics`) |
| ED32 | 6.6 Torsion | done | `torsion` | Round shafts and tubes (`claude/mechanics`) |
| ED33 | 6.7 Thin cylinders | out of scope | | Pressure vessels |
| ED34 | 6.8 Cylindrical vessels with hemispherical ends | out of scope | | |
| ED35 | 6.9 Thick cylinders | out of scope | | Note: Lamé equations would serve a press-fit pressure tool |
| ED36 | 6.10 Buckling of struts | done | `column` | Euler and Johnson (`claude/mechanics`) |
| ED37 | 6.11 Flat circular plates | out of scope? | | |
| ED38 | 6.12 Stress concentration factors | partial | `stressconc` | Holes in plates only (`claude/mechanics`) |
| ED39 | 7.1 How materials fail | missing | | |
| ED40 | 7.2 LEFM method | out of scope? | | |
| ED41 | 7.3 Multi-axis stress states | out of scope? | | |
| ED42 | 7.4 Fatigue | partial | `fatigue` | Infinite life (Goodman, Soderberg, Gerber, Marin); no finite-life S-N (`claude/mechanics`) |
| ED43 | 7.5 Factors of safety | partial | `fatigue`, `column` | Factors of safety for fatigue and buckling; no general guidance (`claude/mechanics`) |
| ED44 | 7.6 United States practice | out of scope? | | |
| ED45 | 7.7 What everything is made of | partial | `materials` | |
| ED46 | 8 Thermodynamics and cycles (10 entries) | out of scope | | |
| ED47 | 9 Fluid mechanics and aerodynamics (16 entries) | out of scope | | |
| ED48 | 10 Fluid equipment: turbines, refrigeration, diesel engines, heat exchangers, pumps (6 entries) | out of scope | | |
| ED49 | 11 Pressure vessels and flanges (7 entries) | out of scope | | |
| ED50 | 12.1 Crystals: order and disorder | out of scope? | | |
| ED51 | 12.2 Carbon steels | partial | `materials` | No compositions, heat treatment |
| ED52 | 12.3 Low-alloy steels | partial | `materials` | |
| ED53 | 12.4 Alloy steels | partial | `materials` | |
| ED54 | 12.5 Cast iron | partial | `materials` | |
| ED55 | 12.6 Stainless steels | partial | `materials` | |
| ED56 | 12.7 Non-ferrous alloys | partial | `materials` | |
| ED57 | 12.8 Nickel alloys | partial | `materials` | |
| ED58 | 12.9 Zinc alloys | missing | | |
| ED59 | 12.10 Copper alloys | partial | `materials` | |
| ED60 | 12.11 Aluminium alloys | partial | `materials` | No temper explainer |
| ED61 | 12.12 Titanium alloys | partial | `materials` | |
| ED62 | 12.13 Engineering plastics | partial | `materials`, `plastics` | 12 plastics in `plastics` |
| ED63 | 12.14 Material traceability and documentation (certificates) | missing | | Reading a mill cert |
| ED64 | 12.15 Corrosion | partial | `galvanic` | Galvanic corrosion only |
| ED65 | 13.1 Screw fasteners | partial | `bolttorque`, `boltgrade` | Torque, preload and grades; no joint stiffness or fatigue |
| ED66 | 13.2 Bearings | missing | | |
| ED67 | 13.3 Ball and roller bearings | missing | | |
| ED68 | 13.4 Bearing lifetime | done | `bearinglife` | Basic rating life L10 (`claude/fasteners`) |
| ED69 | 13.5 Coefficient of friction | missing | | |
| ED70 | 13.6 Gear trains | missing | | |
| ED71 | 13.7 Seals | partial | `oring` | O-rings only |
| ED72 | 13.8 Shaft couplings | out of scope? | | |
| ED73 | 13.9 Cam mechanisms | missing | | |
| ED74 | 13.10 Clutches | out of scope? | | |
| ED75 | 13.11 Pulley mechanisms | missing | | |
| ED76 | 13.12 Drive types | missing | | |
| ED77 | 14.1-14.3 ISO 9001 quality systems and certification | out of scope? | | Management system |
| ED78 | 14.4 Taguchi methods | missing | | Low priority |
| ED79 | 14.5 Statistical process control | done | `capability`, `ctrlchart` | Cp/Cpk; X-bar/R and individuals/MR charts; run rules not applied (`claude/inspection-2`) |
| ED80 | 14.6 Normal distribution | done | `capability` | |
| ED81 | 14.7 Binomial and Poisson distributions | partial | `sampling` | Binomial and Poisson OC curves of single sampling plans; ISO 2859-1 / Z1.4 tables not included (copyright); no general distribution calculator (`claude/inspection-2`) |
| ED82 | 14.8-14.10 Reliability and design for reliability | out of scope? | | |
| ED83 | 15.1-15.5 Project engineering (planning, CPA, Gantt, prototyping, value analysis) | out of scope? | | |
| ED84 | 16.1 Welding processes | out of scope | | |
| ED85 | 16.2 Weld types and orientation | out of scope | | |
| ED86 | 16.3 Welding symbols | missing | | Drawing reading; low priority |
| ED87 | 16.4 Welding defects | out of scope | | |
| ED88 | 16.5 Welding documentation | out of scope | | |
| ED89 | 17.1-17.6 Non-destructive testing | out of scope? | | |
| ED90 | 18.1 Painting | out of scope? | | |
| ED91 | 18.2 Galvanizing | out of scope? | | |
| ED92 | 18.3 Chrome plating | missing | | Plating allowance; low priority |
| ED93 | 18.4 Rubber linings | out of scope? | | |
| ED94 | 19 Metallurgical terms | missing | | Glossary |

## 4. Engineers Black Book, 2nd edition

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| BB1 | Conversion factors inch/metric | partial | `fraction` | Length only |
| BB2 | Drill size and decimal equivalent chart | done | `drillchart` | |
| BB3 | Spanner selection chart | done | `spanner` | (`claude/fasteners`) |
| BB4 | Torque conversion chart | missing | | |
| BB5 | Socket size cross-reference inch/metric | partial | `spanner` | Lookup of a spanner size against metric and inch heads; no socket cross-reference chart |
| BB6 | Abbreviations for standard threads | partial | `threaddata` | Series names only |
| BB7 | Thread forms used in engineering | partial | `threaddata`, `pipethreads`, `whitworth`, `acme`, `trapezoidal`, `buttress` | ACME, trapezoidal and buttress added; no forms overview drawing (`claude/threads-3`) |
| BB8 | Types of ground thread taps | partial | `toolguide` | Tap types and chamfers; H limits in `taplimits` (`claude/tooling-ref`) |
| BB9 | Colour-coded high-performance taps and applications | missing | | Maker-specific; low priority |
| BB10 | Tapping drill formulae | done | `tapdrill` | |
| BB11 | Tapping drill sizes for cutting taps | done | `tapdrill` | |
| BB12 | Tapping drill sizes for fluteless (forming) taps | done | `tapdrill` | |
| BB13 | Removal of broken taps | partial | `toolguide` | Own summary of removal methods and prevention, one source so far (flagged) (`claude/tooling-ref`) |
| BB14 | Coventry/OSG style chasers | missing | | |
| BB15 | Drill sizes for screw extractors, self-tappers | missing | | |
| BB16 | Drill sizes for socket head screws | done | `shcs`, `clearance` | (`claude/fasteners`) |
| BB17 | Hole coordinates | done | `bolt` | |
| BB18 | Drill point sharpening and effects of bad grinding | missing | | |
| BB19 | Drill point geometry by material | partial | `toolguide` | Point angle by material (118 general, 135 harder, over 140 very hard); no full geometry table (`claude/tooling-ref`) |
| BB20 | Speeds and feeds for HSS twist drills | missing | | |
| BB21 | Speeds and feeds for solid carbide drills | missing | | |
| BB22 | End mills | partial | `toolguide` | Types, flutes by material, end shapes, roughers; no dimensions (`claude/tooling-ref`) |
| BB23 | Cutting speed to RPM conversion | done | `rpm` | |
| BB24 | Hole saws and recommended speeds | missing |  | Not built: no two independent hole saw speed charts compared (`claude/tooling-ref`) |
| BB25 | Hacksaw and power saw blade selection | partial | `sawtpi` | Pitch from the 3-teeth rule; no hacksaw blade chart (`claude/tooling-ref`) |
| BB26 | Bandsaw blade selection | partial | `sawtpi`, `bandsaw` | Pitch selection (min 3 teeth confirmed, upper rule shown from two makers) and cut time; no blade width or speed chart (`claude/tooling-ref`) |
| BB27 | Sharpening HSS toolbits | missing | | |
| BB28 | Lubricants and coolants for cutting tools | partial | `coolconc`, `coolmix` | No selection guide |
| BB29 | Trigonometry, Pythagoras, rise per degree, 3-4-5 rule | missing | | In progress (`claude/geometry`) |
| BB30 | Geometrical construction | missing | | |
| BB31 | Formulae for dimensions of plane figures | done | `figures` | (`claude/measure-maths`) |
| BB32 | Area and measurement of plane figures | done | `figures` | (`claude/measure-maths`) |
| BB33 | Distance across corners of squares and hexagons | done | `figures` | Any regular polygon, across flats to across corners (`claude/measure-maths`) |
| BB34 | Area and volume of solid figures | done | `figures` | (`claude/measure-maths`) |
| BB35 | Tapers | done | `taper`, `machinetapers` | |
| BB36 | Taper turning and sine bar formulae | partial | `taper` | No tailstock set-over or compound setting; sine bar in progress |
| BB37 | Dividing head / rotary table indexing | missing | | In progress (`claude/geometry`, `indexing`) |
| BB38 | Tolerances and preferred fits | partial | `fits` | Preferred fits not listed |
| BB39 | Fits for shafts and holes | partial | `fits` | No j/J |
| BB40 | Morse, Jacobs and DIN tapers | partial | `machinetapers` | DIN metric tapers missing |
| BB41 | Milling machine tapers | done | `machinetapers` | |
| BB42 | Pull studs and retention knobs | partial | `machinetapers` | Standard references only, no dimensions |
| BB43 | T-slots | done | `tslots` | (`claude/fasteners`) |
| BB44 | Keys and keyways | partial | `keys` | Parallel keys metric and inch; no Woodruff |
| BB45 | Spur gear calculations | missing | | |
| BB46 | Belt and gear drive calculations | missing | | |
| BB47 | V-belt cross sections | missing | | |
| BB48 | Bolts and nuts identification and grades | done | `boltgrade` | (`claude/fasteners`) |
| BB49 | Bolt and screw heads, types and drives | partial | `shcs` | Socket head cap screws only; no other head types or drives |
| BB50 | Weights of round, square and hex bars | partial | `bar` | Density entered by hand; full tool in progress (`claude/geometry`, `weight`) |
| BB51 | Weights of round tubes | missing | | In progress (`claude/geometry`, `weight`) |
| BB52 | Weights of sheet metal | missing | | In progress (`claude/geometry`, `weight`) |
| BB53 | Symbols for elements; viscosity chart | missing | | Low priority |
| BB54 | Physical properties of metals and compounds | partial | `materials` | |
| BB55 | Sheet metal and wire gauges; bend allowance | missing | | In progress (`claude/geometry`, `bend`) |
| BB56 | Workshop metals | partial | `materials` | |
| BB57 | Workpiece material comparison table | done | `materials` | |
| BB58 | Engineering plastics | partial | `materials` | 5 plastics |
| BB59 | Engineering adhesives | missing | | |
| BB60 | Grinding wheels: markings, specs, shapes, faces | partial | `wheelcode` | Markings and specs decoded; no shapes or faces (`claude/calcs-3`) |
| BB61 | Mounted wheels and points | missing | | |
| BB62 | Tungsten carbide burrs | missing | | |
| BB63 | Surface coatings (tool coatings) | done | `toolguide` | Ten coatings with use; max temperatures with every publisher value, confirmed only where two agree (`claude/tooling-ref`) |
| BB64 | Relative position of cutting tool materials | partial | `toolguide` | Tool materials summary; no ranking chart (`claude/tooling-ref`) |
| BB65 | Carbide grades and grade comparison chart | partial | `iso513`, `toolguide` | ISO 513 groups; no maker grade comparison chart (`claude/tooling-ref`) |
| BB66 | Carbide insert identification | missing | | In progress (`claude/ref-data-3`) |
| BB67 | Quick visual identification of insert shapes | missing | | In progress (`claude/ref-data-3`) |
| BB68 | Carbide toolholder identification | missing | | |
| BB69 | Carbide toolholder selection and application | missing | | |
| BB70 | Abbreviations used in drawings | done | `abbrev` | 65 abbreviations in our words, 34 listed by two publishers (`claude/measure-maths`) |
| BB71 | Standards for engineering drawings | missing | | |
| BB72 | Human physical dimensions | out of scope | | |
| BB73 | G-codes, letter addresses, miscellaneous function words | done | `gmcodes` | G and M words per control; letter-address table A-Z (NIST RS274NGC and Haas mill columns, each from its own document) under the code list (`claude/gdt-3`) |
| BB74 | Surface roughness tables | partial | `finish` | Conversions in progress (`claude/ref-data-3`) |
| BB75 | Surface finish expected from manufacturing processes | missing | | In progress (`claude/ref-data-3`) |
| BB76 | Terms used in heat treatment of steel | done | `heattreat` | 12 terms in our words (`claude/materials-ref`) |
| BB77 | Hardening and tempering temperatures by colour | done | `tempercolours`, `heattreat` | Temper colours with three publishers, hardening and tempering temperatures (`claude/materials-ref`) |
| BB78 | Hardness comparison chart | missing | | In progress (`claude/ref-data-3`) |
| BB79 | Natural sines and tangents table | done | `calc` | Any sine or tangent from the calculator instead of a table (`claude/measure-maths`) |
| BB80 | Drill point sharpening gauge (back cover) | missing | | |

## 5. CNC Machining for Engineers and Makers (course handbook)

One row per learning objective.

| # | Item | Status | BenchMate | What's missing |
|---|---|---|---|---|
| CN1 | L1 Course goals, audience, tools, lessons, resources | out of scope? | | Course administration |
| CN2 | L1 Subtractive vs additive rapid prototyping | out of scope? | | |
| CN3 | L1 Overall CAD/CAM/CNC process | missing | | Explainer |
| CN4 | L2 Shop safety awareness, rules, clothing, conduct | partial | `cncguide` | Short safety page (guards, dress, chips, coolant, lock-out); points to HSE/OSHA, not a full course (`claude/cnc-guide`) |
| CN5 | L2 Safety precautions when running a new CNC program | partial | `cncguide` | Prove-out steps in the safety page (`claude/cnc-guide`) |
| CN6 | L3 Common CNC tools | partial | `toolguide` | End mills, drills, reamers, taps described; no course-specific tool list (`claude/tooling-ref`) |
| CN7 | L3 Spindle rotation direction | missing | | |
| CN8 | L3 Chip formation | done | `cncguide` | Shear zone, chip types, chip thickness (`claude/cnc-guide`) |
| CN9 | L3 Chip load definition | partial | `feed`, `cutopt` | Used, not explained |
| CN10 | L3 Climb vs conventional milling | done | `cncguide` | With drawing (`claude/cnc-guide`) |
| CN11 | L3 Speeds and feeds from reference tables | partial | `rpm`, `feed` | Formulas only; no tables |
| CN12 | L4 Cartesian coordinate system | done | `cncguide` | Right-handed axes (`claude/cnc-guide`) |
| CN13 | L4 Work coordinate system and how to choose it | done | `cncguide` | Work coordinates and where to put part zero (`claude/cnc-guide`) |
| CN14 | L4 Closed-loop servo control | out of scope? | | Machine design |
| CN15 | L4 Machine coordinate system | done | `cncguide` | Machine coordinates, G53 (`claude/cnc-guide`) |
| CN16 | L4 Fixture offset XY | done | `cncguide`, `setupsheet` | Explainer in the guide; offsets recorded on the setup sheet (`claude/cnc-guide`) |
| CN17 | L4 Tool length offset with a 1-2-3 block | missing | | |
| CN18 | L4 Fixture offset Z with 1-2-3 block and indicator | missing | | |
| CN19 | L4 Inch and metric programming units | partial | `app.js` (unit toggle) | No G20/G21 explanation |
| CN20 | L5 What a CNC program is; sequence of operations | done | `cncguide` | Program as blocks, typical order of one tool (`claude/cnc-guide`) |
| CN21 | L5 Common G-codes | done | `gmcodes` | |
| CN22 | L5 Common M-codes | done | `gmcodes` | |
| CN23 | L5 Special characters in a program | partial | `cncguide` | Comments and block delete; no full character list (`claude/cnc-guide`) |
| CN24 | L5 Organisation of a simple program | done | `cncguide` | Safe start line, block anatomy, tool order (`claude/cnc-guide`) |
| CN25 | L6 Steps to set up and run a CNC mill | missing | | |
| CN26 | L6 Control panel layout (one control maker) | missing | | Per control profile |
| CN27 | L6 Start and home the machine | missing | | |
| CN28 | L6 Load tools | missing | | |
| CN29 | L6 Set tool length offsets | missing | | |
| CN30 | L6 Set fixture offsets | missing | | |
| CN31 | L6 Load a program | missing | | |
| CN32 | L6 Run a new program safely | missing | | |
| CN33 | L6 Adjust offsets for wear and deflection | partial | `deflection` | Estimates deflection only |
| CN34 | L6 Shut down | missing | | |
| CN35 | L7 2.5D, 3D and 4-axis parts | missing | | |
| CN36 | L7 CAD/CAM graphics views | out of scope? | | CAM software usage |
| CN37 | L7 Identifying 2D machining features | missing | | |
| CN38 | L7 Machining parameters for 2D toolpaths (stepover, stepdown) | missing | | |
| CN39 | L7 Facing toolpaths | missing | | |
| CN40 | L7 2D contour toolpaths | missing | | |
| CN41 | L7 Cutter diameter compensation rules | partial | `cncguide`, `tnrc` | G41/G42 sides and entry/exit rules; no mill contour worked example (`claude/cnc-guide`) |
| CN42 | L7 Pocketing toolpaths | missing | | |
| CN43 | L7 Slot milling | missing | | |
| CN44 | L7 Chamfer milling | missing | | Chamfer mill depth for width |
| CN45 | L7 Radius milling | missing | | |
| CN46 | L7 Drilling and peck drilling | missing | | |
| CN47 | L7 Tapping toolpaths | missing | | |
| CN48 | L8 Lathe coordinate system | done | `cncguide`, `tnrc` | Lathe Z and X, diameter programming, imaginary tip (`claude/cnc-guide`) |
| CN49 | L8 Lathe workholding | partial | `cncguide` | Chuck speed, stick-out, support; no collet or chuck selection (`claude/cnc-guide`) |
| CN50 | L8 Common lathe tools | missing | | |
| CN51 | L8 Lathe speeds and feeds | partial | `rpm`, `passtime` | No recommendations |
| CN52 | L8 Constant surface speed | missing | | |
| CN53 | L8 Lathe toolpaths: face, turn, groove, cut-off, thread, drill | partial | `cycg71`, `cycgroove`, `cycthread`, `cyctaper` | Turn, groove, cut-off, thread; no facing or drilling on the lathe |
| CN54 | L8 Live tools | partial | `machines` | Live-tool speed limit check only |
| CN55 | L9 3D tool compensation | missing | | |
| CN56 | L9 3D cut tolerances | missing | | |
| CN57 | L9 Geometric features in 3D toolpaths | missing | | |
| CN58 | L9 3D roughing toolpaths | missing | | |
| CN59 | L9 3D finishing toolpaths (and scallop height) | missing | | |
| CN60 | L9 Rest milling | missing | | |
| CN61 | L9 Pencil milling | missing | | |
| CN62 | L10 CNC workholding components | partial | `cncguide` | Locate then clamp, vise on parallels; no fixture plate or clamp kit detail (`claude/cnc-guide`) |
| CN63 | L10 CNC vise parts and accessories | partial | `cncguide` | Vise practice paragraph (`claude/cnc-guide`) |
| CN64 | L10 Hard, step and soft jaws | partial | `cncguide` | Soft jaws mentioned only (`claude/cnc-guide`) |
| CN65 | App A: align a vise | missing | | |
| CN66 | App A: square a block | missing | | |
| CN67 | App A: 2D contour with cutter compensation | missing | | |
| CN68 | App A: vise jaw types; installing and aligning jaws | missing | | |
| CN69 | App A: making and using soft jaws | missing | | |
| CN70 | App A: multiple parts from one bar | missing | | |
| CN71 | App A: fixture plates | missing | | |
| CN72 | App A: clamps and bolts | missing | | |
| CN73 | App A: thin-walled parts | missing | | |
| CN74 | App A: angle plates for multi-sided parts | missing | | |
| CN75 | App A: shoulder bolts and dowel pins for two-sided parts | missing | | |
| CN76 | App A: double-sided tape | missing | | |
| CN77 | App B: tool length offset with paper | missing | | |
| CN78 | App B: tool length offset with a 1-2-3 block from a finished face | missing | | |
| CN79 | App B: tool length offset with a tool probe | missing | | |
| CN80 | App C: CNC process planning form | partial | `setupsheet` | Setup sheet, no operation-sequence plan |
| CN81 | App D: G and M code reference | done | `gmcodes` | |
| CN82 | App E: glossary | missing | | |
| CN83 | App F: drill chart and decimal equivalents | done | `drillchart` | |

## 6. Prioritised build list

Each batch is about one agent session. "Research" means mostly collecting and
cross-checking published data (standards, maker catalogues); "maths/UI" means
mostly formulas, drawing and screens from knowledge we already have.

### Ultra gaps first

| Batch | Contents | Closes | Work type |
|---|---|---|---|
| A1 | **Canned-cycle generators, mill** (built on `claude/cycles`): G81/G82/G83/G73 drilling, G84 tapping, rectangular hole pattern, bolt-circle and pattern coordinate export (CSV and G-code), thread mill program. Generic Fanuc-style output first, then per control profile | U36, U37, U73, U74, U24, U25 | maths/UI; light research (control manuals for syntax) |
| A2 | **Canned-cycle generators, lathe** (built on `claude/cycles`): G76 threading with infeed/pass table, lathe taper program, groove/cut-off with CSS time, keyway broach program, G71/G70 profile cycle | U53, U54, U8, U6, U88, U11 | maths/UI; light research |
| A3 | **2D CAD and DXF generator**: sketch lines/arcs/circles, snapping (end, mid, intersection, tangent), dimensions and angle measure, DXF export; reuse for A2 profile input | U96 | maths/UI (large; may take two sessions) |
| A4 | **G-code and M-code reference, custom macro reference** per control profile (generic ISO 6983 set, then Fanuc-style, Haas, Siemens, Mitsubishi, Citizen) | U92, U93, U94, BB73, CN21-24, CN81 | heavy research |
| A5 | **G-code simulator**: 2D backplot of G0-G3, canned cycles from A1/A2, cycle-time estimate; 3D later | U95 | maths/UI |
| A6 | **Tool library and app shell**: saved tools (end mills, drills, taps, reamers) with one-click fill into any tool; favourites; decimal precision; home dashboard; reorderable menu | U109, U105, U106, U107, U108 | maths/UI |
| A7 | **Chatter finder and vibration** (chatter finder built on `claude/calcs-3`; vibration sensor not built): microphone FFT, tooth-passing and stable-speed lobes for mill and lathe, all on-device | U26 (U27 later with mobile) | maths/UI |
| A8 | **Grinding calculators** (built on `claude/calcs-3` except cylindricity from RPM): equivalent diameter, wheel and work speed, plunge, surface grind, cylindricity from RPM, grit size conversion, wheel marking decoder | U55-U60, MH163, BB60 | maths/UI plus moderate research (grit tables, ANSI B74.13 / ISO 525 marking) |
| A9 | **Small milling and turning calculators** (built on `claude/calcs-3`; no centre drill size table): ball-nose cusp height and effective diameter, runout, slitting saw feeds, chip-thinning compensated feed, corner engagement feed, lathe feed conversion, multi-pass rough time, C-axis feed converter, boring bar deflection presets, bandsaw cut time, center drill dimensions and depth | U19-U23, U16, U21, U4, U5, U10, U9, U90, U32 | maths/UI; light research (center drill sizes) |
| A10 | **Cutting-data engine, part 1 (turning and milling)**: starting Vc and fz/f by ISO material group and tool material from free maker catalogues, kc table, hardness correction, link to `materials` | U1, U2, U13, U18, U82, MH139-141, MH147 | heavy research |
| A11 | **Cutting-data engine, part 2 (holes)**: drilling (HSS/carbide, point angle, coating, coolant), reaming speeds and allowance, tapping speeds, gun drilling | U28, U33, U34, U35, MH142, BB20, BB21 | heavy research |
| A12 | **Threads round 3**: ACME, stub ACME, trapezoidal, buttress, UNJ, UNM, UNR root, constant-pitch UN series, coated-thread (plating/anodise) allowance, STI, Whitworth tolerances, NPTF, wire measurement for ACME and Whitworth | U39-U46, U49, MH220-238, MH247 | heavy research (standards formulas, cross-checks) |
| A13 | **Measurement round 2**: height over ball for countersinks and tapered bores, SHCS counterbore and clearance holes, plain thermal expansion and shrink-fit temperature, full unit converter, scientific calculator, knurl calculator | U70, U71, U68, U79, U80, U87 | maths/UI; moderate research (screw and knurl dimensions) |
| A14 | **Gears and splines**: spur gear data, over-pins measurement, ANSI B92.1, ISO 4156, SAE J499a splines | U83-U86, MH261-266, MH274, MH276-279 | heavy research |
| A15 | **Learning and data**: formula library browser (built from each tool's working), tip of the day, tool wear guide | U97, U98, U91, MH131 | writing in our own words; light research |
| A16 | **Assistant and community cut library** | U101, U102 | needs a design decision first (hosting, privacy); not a single session |
| A17 | **Platform**: installable offline build, then mobile, then languages | U110-U113 | build/UI; later phase |

Already in progress and not repeated above: triangle, arc, geometry, angle,
sine bar, gauge-block stack, weight, bend, indexing (`claude/geometry`);
insert catalogue, surface-finish conversions, hardness (`claude/ref-data-3`);
material properties round 2 (`claude/material-props-2`). When those merge,
U65, U67, U69, U75-U78, U81 and U103 move to done or partial.

### Book gaps

| Batch | Contents | Closes | Work type |
|---|---|---|---|
| B1 | **Fasteners**: clearance and counterbore holes, hex/SHCS/cap/set screw dimensions, spanner and socket sizes, bolt grades and marks, thread engagement length, torque and preload, T-slots, dowel and taper pins, retaining-ring grooves, helical inserts | MH198-216, BB3, BB5, BB15, BB16, BB43, BB48, BB49, ED65 | heavy research |
| B2 | **Machine elements for machinists**: keys and keyways (incl. Woodruff), bearing shaft/housing fits and L10, belts and pulleys, chains and sprockets, O-ring glands, adhesives and threadlockers | MH283-296, BB44, BB46, BB47, BB59, ED66-71, ED75-76 | heavy research |
| B3 | **Tooling reference**: tool geometry terms, carbide grades (ISO 513) and coatings, end mill and drill types, drill point geometry and sharpening, reamers, tap types and H limits, broaching, burrs, mounted points, files, hole saws and saw blade selection, broken-tap removal | MH96-133, BB8-9, BB13-14, BB18-19, BB22, BB24-27, BB61-65, BB68-69 | heavy research |
| B4 | **Materials round 3**: heat treatment terms and temperatures, temper colours, tool steel selection, corrosion and galvanic series, machining plastics and nonferrous metals, metal identification, mill certificates, zinc and magnesium | MH51-68, MH159-160, BB76-77, ED58, ED63-64 | heavy research; partly built on `claude/materials-ref` (colours, heat treatment, galvanic, plastics, metal ID) |
| B5 | **Inspection round 2** (built on `claude/measure-maths` and `claude/inspection-2` except thread gauges and radius over pins; ANSI fits single-source): ANSI fits (RC/LC/LT/LN/FN), ISO 2768 general tolerances, j/J classes and over 500 mm, preferred numbers, measurement over pins/rolls and radius, micrometer and vernier reading, thread gauges, control charts, sampling | MH75-95, MH245, MH248, ED13, ED79, ED81 | mixed: maths/UI plus moderate research |
| B6 | **CNC knowledge guide**: coordinate systems, work and tool offsets, TNRC and cutter compensation, program structure, 2D/3D and lathe toolpath strategies, CSS, workholding and vise practice, operator procedures, shop safety, glossary; plus a TNRC calculator | MH174-185, CN3-CN82 | writing in our own words, some maths; light research |
| B7 | **Shop maths**: plane and solid figures beyond the geometry branch, across corners, angle conversion, compound angles, interpolation, involute function, prime factors, lathe change gears, engineering economics | MH1-24, MH256, BB29-34, BB79 | maths/UI |
| B8 | **Mechanics for the shop** (built on `claude/mechanics`; no stepped-shaft Kt, springs or combined stresses): beam, torsion, column and section properties, stress concentration, fatigue basics, centrifugal force on chucks, balancing, critical speed | MH25-41, ED23-25, ED29-43 | maths/UI |
| B9 | **Grinding and abrasive processes, depth**: wheel selection, dressing, cylindrical/centerless/surface practice, honing, lapping, EDM basics, micromachining notes | MH150, MH161-173, MH189 | heavy research |
| B10 | **Gears, depth**: helical, bevel, worm, internal gears, gear cutting and cutter numbers, cams | MH264-273, MH280 | heavy research; low priority |
| B11 | **Units and symbols**: Greek alphabet, abbreviations, drawing abbreviations and standards, weld symbols, elements table | MH300-306, BB70-71, BB53, ED2-3, ED10, ED86, ED94 | light research |
