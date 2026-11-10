# Feature ideas beyond parity

Ideas from looking at other machinist tools (G-Wizard, HSMAdvisor, FSWizard, open-source optimisers) and common shop-floor needs. All would be built from free, citable knowledge. Ranked by usefulness vs effort.

## Tier 1: high value
1. **Machine profiles.** (built: v0.1 profiles and checks; cut optimiser next) Spindle RPM range, power and torque curve, max feed, rigidity, control type. Every result is checked against the machine and flagged if it can't be reached (e.g. RPM capped, torque short at low RPM). Multiple machines, L20 first.
2. **Cut optimiser with deflection and torque checks.** Tool stick-out and diameter give tool deflection (cantilever beam); spindle torque/power curve gives a limit; solve for the best width/depth/feed inside those limits. Shows *why* a limit binds.
3. **Arc and helix feed correction.** *(Done: Arc feed correction, Helical interpolation and ramping. Plunge roughing still to do.)* Feed compensation for internal/external arcs (tool centre vs cutting edge), helical interpolation and ramp angles, plunge roughing. Common cause of broken tools and rarely done by hand.
4. **Cost per part and tool life.** *(Done: Tool life and cost per part.)* Taylor tool-life equation, economic cutting speed, cycle time x machine rate + tool cost per edge + material cost. Answers "is running faster actually cheaper?".
5. **Bar stock planner (Swiss and bar-fed lathes).** *(Done. Guide-bushing loss can be entered as part of the remnant.)* Parts per bar from part length, cutoff width, facing allowance, remnant and guide-bushing loss; bar weight and material cost per part.
6. **Shop knowledge base.** Log what worked for a tool + material + machine, searchable; feeds the adaptive learning profile already planned.
7. **Material equivalents.** AISI/SAE, EN/BS, DIN W.Nr, JIS cross-reference with machinability groups (ISO P/M/K/N/S/H). Useful in UK shops quoting US drawings.

## Tier 2: useful
8. **Setup sheet generator.** Tools, offsets, speeds, notes, printable; export to PDF.
9. **Turning chip-breaking window.** Feed and depth inside the insert's chip-breaker range from imported catalogue data.
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
