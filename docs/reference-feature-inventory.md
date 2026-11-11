# Reference feature inventory

Names of the tool categories seen in a commercial calculator app (CNC Machinist Calculator Ultra) on 2026-11-10, recorded only as a checklist of what machinists expect. BenchMate's screens, code, wording, art and data are written independently; nothing here is copied from that app.

## Top-level categories
Turning, Milling, Drilling, Tap Drill Size, 2D CAD & DXF Generator, True Position, Surface Finish, Cutting Speed, Hole Pattern, Gauge Block Stack, Thread Size Tolerance Data, Lathe Taper G-code, G-codes reference, M-codes reference, Center Drill Hole, Drill Chart, Geometric Tolerancing, Arc Calculator, Hardness Conversions, Gun Drill, Unit Conversions, Tool Wear Info, Material Properties, Custom Macro Info, Geometry Calculations, Thread Programming, Knowledge Test, Material Weight, Keyway Broach G-code, Triangle Solver, Socket Head Cap Screws, AI assistant, Thermal Expansion, Grinding, Knurling, ISO Fit Tolerances, Reaming, Spline Functions, G-code Simulator, Bandsaw Cut Time.

## Turning
Cutting speed recommendations, cut time for part-off/grooving, cut time for roughing passes, spindle speed conversion, feed rate conversion, boring bar deflection, C-axis feed converter.

## Milling
Advanced speeds and feeds (chip thinning, deflection, power checks), spindle speed conversion, feed rate conversion, radial chip thinning, thread milling G-code, MRR and machine power, ball endmill cusp height, ball endmill effective cut diameter, adaptive feed for rounded corners, max tool runout, slitting saw speeds and feeds.

## UI ideas worth keeping
Inch/metric toggle, adjustable decimal precision, favourites, home dashboard.

## Walkthrough 2 (2026-11-10): "New Features" list and sample screens
Additional tools listed: shared machining data (community speeds/feeds with validation), GD&T learning centre with quizzes, indexable insert catalogue (decode and build ISO insert designations, links to cut data), 2D/3D G-code simulator with cycle-time estimate, involute spline data (ISO 4156, ANSI B92.1), SAE J499a spline data (internal/external), tolerance stack mini game, 2D CAD and DXF generator, machining formulas library with worked calculators, band saw cut time, coolant ratio, C-axis feed converter, G83/G81/G82/G73 drilling cycle generator, G84 tap cycle, G76 thread cycle, rectangular hole pattern, MMC/LMC bonus tolerance and true position, boring bar deflection, reaming calculator, Whitworth threads, stub Acme threads, special UN threads with plating allowance (ASME B1.1), ISO fits and tolerances (ISO 286-1), height over ball for countersinks and tapered bores, thread mill program generator, knurl calculator, gauge block stack, keyway broach program generator.

Screens inspected in detail: lathe cutting speed (material picker with AISI machinability rating, hardness slider, insert and strategy, outputs speed/RPM/feed/depth), drill cutting speed (point angle, tool material, coating, coolant; outputs speed, RPM, feed, point length, MRR, G-code), tap drill (tap type, thread select, % engagement 55-85 with suggested 65% roll form / 75% cut), true position (X/Y deviation with MMC/LMC toggle), surface finish (lathe, mill, conversions tabs), hole pattern (circular and rectangular, origin, start angle, count).

Not yet inspected in detail: the sub-screens of most other items, settings, and any account or credits features (some outputs appear locked behind credits; BenchMate will have no locks).

## Walkthrough 3: public product pages and store listing (2026-11-10)
Additional tools not previously on this list (names only, as a checklist):
- Chatter listener (microphone finds chatter tone; stable speed = 60 x f / (teeth x lobe); mill and lathe modes; on-device only) and a vibration check using the phone sensor.
- Grinding: equivalent diameter, grit size conversion, plunge grind, grind RPM cylindricity error, wheel and workpiece speed, surface grind.
- Threads: UNC/UNF/UNEF/UNJ/UNM/UNR/UNS, metric M, NPT, BSPP, STI and special threads, Whitworth BSF/BSW, ACME and Stub ACME, over-wire data, thread milling.
- Measurement and geometry: sine bar, spur gear data, socket head cap screw hole dimensions, height over ball, countersink and tapered bore over-ball, scientific calculator, unit converter.
- Milling and lathe extras: TrueFeed-style physics speeds and feeds, cutting speed with cycle time, adaptive feed control, CAD profile to canned cycles, taper programming, lathe cycle generator, tapping speeds, center drill dimensions.
- Learning and help: machining formula library (172 formulas), 1,500+ tips of the day, quiz, virtual assistant, GD&T learning centre, community cut library, tool wear information.
- Platform: web, iOS and Android, offline mode, 23 languages beyond English, favourites.
BenchMate targets all of these. Language support and mobile are later phases; desktop first.

## Walkthrough 4: Jacob's screenshots of the full menu and New Features list
Menu order seen: Turning, Milling, Chatter Listener, Vibration Check, Drilling, Tap Drill Size, 2D CAD & DXF, True Position, Surface Finish, Cutting Speed, Hole Pattern, Gauge Block Stack, Thread Size Tolerance Data, CNC Lathe Taper G-code, G-codes, M-codes, Center Drill Hole, Drill Chart, Geometric Tolerancing, Arc Calculator, Hardness Conversions, Gun Drill, Unit Conversions, Tool Wear Info, Material Properties, Custom Macro Info, Geometry, Thread Programming, Machinist Knowledge Test, Material Weight, Keyway Broach G-code, Triangle Solver, Socket Head Cap Screws, Machinist Assistant, Thermal Expansion, Grinding, Knurl, ISO Fit Tolerances, Reaming, Spline Functions, G-Code Simulator, Bandsaw Cut Time, Machining Formulas, Indexable Inserts, Settings.
New Features also lists: arrange menu (hold an item to move it), tool library (save end mills, drills, taps, reamers once, then fill any calculator with one tap), link to web app.
