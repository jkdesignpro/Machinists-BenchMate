# Feature ideas beyond parity

Ideas from looking at other machinist tools (G-Wizard, HSMAdvisor, FSWizard, open-source optimisers) and common shop-floor needs. All would be built from free, citable knowledge. Ranked by usefulness vs effort.

## Tier 1: high value
1. **Machine profiles.** (built: v0.1 profiles and checks; cut optimiser built) Spindle RPM range, power and torque curve, max feed, rigidity, control type. Every result is checked against the machine and flagged if it can't be reached (e.g. RPM capped, torque short at low RPM). Multiple machines, L20 first.
2. **Cut optimiser with deflection and torque checks.** *(Done: Tool deflection, Cut check and optimiser, with an optional holder and spindle stiffness from a push test. Chatter is in the stability chart of the milling advisor.)* Tool stick-out and diameter give tool deflection (cantilever beam); spindle torque/power curve gives a limit; solve for the best width/depth/feed inside those limits. Shows *why* a limit binds.
3. **Arc and helix feed correction.** *(Done: Arc feed correction, Helical interpolation and ramping, Plunge roughing.)* Feed compensation for internal/external arcs (tool centre vs cutting edge), helical interpolation and ramp angles, plunge roughing. Common cause of broken tools and rarely done by hand.
4. **Cost per part and tool life.** *(Done: Tool life and cost per part.)* Taylor tool-life equation, economic cutting speed, cycle time x machine rate + tool cost per edge + material cost. Answers "is running faster actually cheaper?".
5. **Bar stock planner (Swiss and bar-fed lathes).** *(Done. Guide-bushing loss can be entered as part of the remnant.)* Parts per bar from part length, cutoff width, facing allowance, remnant and guide-bushing loss; bar weight and material cost per part.
6. **Shop knowledge base.** Log what worked for a tool + material + machine, searchable; feeds the adaptive learning profile already planned.
7. **Material equivalents.** AISI/SAE, EN/BS, DIN W.Nr, JIS cross-reference with machinability groups (ISO P/M/K/N/S/H). Useful in UK shops quoting US drawings.

## Tier 2: useful
8. **Setup sheet generator.** Tools, offsets, speeds, notes, printable; export to PDF.
9. **Turning chip-breaking window.** *(Done in the turning advisor: the range is typed from the insert box or catalogue, or saved with the insert in the tool library. Filling it from an imported catalogue comes with the catalogue import.)* Feed and depth inside the insert's chip-breaker range from imported catalogue data.
10. **Thread extras.** Rolled-thread blank diameter, tap torque estimate, minor-diameter checks for percent engagement, thread depth/infeed tables for G76-style cycles per control profile.
11. **Inspection helpers.** Functional tolerance stack (worst case and RSS), Cpk from measured parts, temperature compensation for measurements.
12. **Coolant with refractometer.** Concentration from Brix reading and the coolant's refractive factor; top-up mix.
13. **Fraction / decimal / metric quick calculator.** Inch fractions in and out, nearest drill, nearest fraction.
14. **Troubleshooting guide.** Symptom (chatter, built-up edge, poor finish, notch wear) -> likely causes -> fixes, written in our own words.

## Tier 3: later
15. **G-code snippets per control profile** from any calculator (drill cycles, thread cycles, bolt circles), checked against that control's manual.
16. **Profile export/import by file**, for air-gapped PCs (USB), no cloud needed.
17. **Link with Alkart Mega Wizard**: send speeds, feeds and cycle times into an AMW job.
18. **Phone/tablet build** of the same app for use at the machine.

Sources looked at: G-Wizard feature list (cnccookbook.com), HSMAdvisor forum discussions, FSWizard store listing, better-tool-library feeds-and-speeds notes (GitHub). Ideas only; no code or data taken.

## Agreed additions (owner decision, 2026-11-11)
The owner asked for all 18 ideas from the review "what is missing, new ideas and sources" and for every missing Ultra feature, except a mobile app and a link to another app or device. The vibration check is to work with any sensor. They are built in the stage where they fit; each still needs its sources (two publishers, or marked single source).

| # | Idea | Stage | State |
|---|---|---|---|
| 1 | Thread identifier (`threadid`) | 0 (0.2.0) | built |
| 2 | Limits and middle of a tolerance (`tolmid`) | 0 (0.2.0) | built |
| 3 | Wear offset adjustment (`offsetadj`) | 0 (0.2.0) | built |
| 4 | Worked example panel: a published example beside BenchMate's answer | 0 (0.2.0) | built; five tools have an example, more to add |
| 5 | Print a page and copy a link with the numbers | 0 (0.2.0) | built |
| 6 | G-code tidy tools (renumber, strip, convert) | 2 (0.4.0) | built, in the G-code editor and simulator (`gsim`) |
| 7 | Text engraving with the Hershey fonts (`engrave`) | 2 (0.4.0) | built |
| 8 | Collet and pull stud torque (`holdertorque`) | 3 (0.5.0) | built |
| 9 | Slender part deflection (`slender`) | 1 (0.3.0) | built |
| 10 | High-feed chip thinning (`leadthin`) | 1 (0.3.0) | built |
| 11 | Drill thrust and torque (`drillforce`) | 1 (0.3.0) | built |
| 12 | Tap torque (`taptorque`) | 1 (0.3.0) | built |
| 13 | Gauge R&R | 3 (0.5.0) | to do |
| 14 | Thread gauge limits | 3 (0.5.0) | to do |
| 15 | Rotary axis helper (`rotpoint`, `rotfeed`) | 2 (0.4.0) | built |
| 16 | Job time and quote | 5 (0.9.0) | to do |
| 17 | Vendor data import and cut log | 5 (0.9.0) | to do |
| 18 | Wire EDM | 3 (0.5.0) | to do |

Built in 0.3.0 so far (branch `claude/advisor`): the cutting-force tools and the milling, turning, drilling and reaming advisors with locks and limit cards. The boring bar and slitting saw pages now take their material data from the advisor. The stability chart with a draggable speed marker is in the milling advisor. The tapping advisor gives a speed and the feed that goes with it. Plunge roughing is its own page with three publishers' rules side by side. The milling and turning advisors open the tool life page with their speed (Taylor exponents stay the user's own figures: no open table was found). The deflection checks take an optional holder and spindle stiffness (typed, or from a push test). The turning advisor holds its suggestions inside the insert's chip breaker range when you give it one.

Missing Ultra rows (docs/parity-audit.md) keep the stage the spec gives them: cutting-data advisors for turning, milling and drilling, reaming and tapping speeds in stage 1; gun drill, RPM cylindricity, SAE J499a and milling surface finish with RMS in stage 3; the vibration check in stage 5.

**Vibration check, any sensor:** the check takes a typed frequency and amplitude, a CSV from any accelerometer or data logger (time and one to three axes), or a sound recording, and uses the device's own motion sensor only where one exists. It compares like with like (same machine, same place, same speed) and never depends on one make of sensor. Everything stays on the device.

Not planned for now: a phone or tablet app, and links to another app or device (confirmed by the owner, 2026-11-11: "yes no links").

### Every idea in this document (owner, 2026-11-11: "add every single feature in that markdown doc")
State of the tier list above, with the stage for what is still to build.

| Tier item | State | Still to build | Stage |
|---|---|---|---|
| 1 Machine profiles | built | | |
| 2 Cut optimiser with deflection and torque checks | built | | |
| 3 Arc and helix feed correction | built | | |
| 4 Cost per part and tool life | built | | |
| 5 Bar stock planner | built | | |
| 6 Shop knowledge base | to do | Log what worked for a tool, material and machine, searchable; with the cut log (idea 17) | 5 (0.9.0) |
| 7 Material equivalents | built | | |
| 8 Setup sheet generator | built | | |
| 9 Turning chip-breaking window | built | Filling the range from an imported catalogue (with the catalogue import) | 5 (0.9.0) |
| 10 Thread extras | part | Rolled-thread blank diameter, tap torque (idea 12), percent engagement check on the minor diameter, infeed tables for G76-style cycles | 1 (0.3.0) and 3 (0.5.0) |
| 11 Inspection helpers | built | | |
| 12 Coolant with refractometer | built | | |
| 13 Fraction, decimal and metric quick calculator | built | | |
| 14 Troubleshooting guide | built (turning and milling troubles in the CNC guide) | Drilling, tapping and grinding symptoms | 3 (0.5.0) |
| 15 G-code snippets per control profile | built (0.4.0): the cycle blocks only on every generator page, and a G-code box on the bolt circle, hole grid, drill point, spot drill depth, tap drill, spindle speed, milling feed and lathe feed pages, for Generic ISO / Fanuc-style and Haas (`docs/snippets.md`) | Other controls, once their manuals can be read | |
| 16 Profile export and import by file | part (tool library, setup sheet, machines) | One file for everything | 5 (0.9.0) |
| 17 Link with Alkart Mega Wizard | not planned | No links | |
| 18 Phone or tablet build | not planned for now | | |

Also built in 0.2.0 after the review: milling surface finish and the RMS (Rq) conversion, which closed Ultra row U66.
