# Changelog

All notable changes to Machinists BenchMate. Versions follow semver.

## [Unreleased]
### Added (GD&T)
- New **GD&T** group. All rules written in our own words; standards (ASME Y14.5-2018 (R2024), ISO 1101:2017, ISO 5459:2024, ISO 2692:2021, ISO 8015:2011, ISO 22081:2021) cited by name only, editions checked on the ASME and ISO catalogue pages. Every rule is confirmed in two independent public sources or marked "to be verified" (`docs/gdt.md`).
- GD&T reference guide: purpose and datums (3-2-1, precedence, datum targets, MMB), Rule #1 versus ISO 8015 independency, all 14 characteristics (12 in Y14.5-2018 plus ISO concentricity/coaxiality and symmetry) with own SVG zone sketches, inspection notes and common mistakes, modifiers, ASME/ISO comparison, current editions and superseded practice (concentricity/symmetry removed in Y14.5-2018; ISO 2768-2 withdrawn). Source keys shown on every statement.
- Feature control frame builder: characteristic, zone shape, value, material condition, modifiers (P, F, T, U, ST, CF) and up to three datums with MMB/LMB; draws the frame, explains it in plain English and flags invalid or doubtful combinations.
- Calculators: true position check (2 x sqrt(dX^2 + dY^2), bonus, pass/fail); bonus, virtual and resultant condition (internal/external, MMC/LMC, RFS boundaries); position to/from plus/minus conversion; floating and fixed fastener formulas; one-dimensional tolerance stack (worst case and RSS, up to 10 dimensions).
- `benchmate-core` module `gdt`: `mmc_size`, `lmc_size`, `bonus_tolerance`, `total_tolerance`, `virtual_condition`, `resultant_condition`, `true_position_dia(_3d)`, `position_dia_from_plus_minus`, `plus_minus_from_position_dia`, fastener functions, `tolerance_stack`, `stack_worst_case`, `stack_rss`, with worked-example tests; matching WebAssembly exports (`gdt_*`).
- `docs/gdt.md`: sources with URLs and access dates, statement check table, open items, decisions.
### Added (milling: deflection and cut optimiser)
- Tool deflection (Milling): end mill as a two-section cantilever (solid shank + fluted length at an effective diameter), load at the tip. Force entered directly, or from net cutting power and speed (Ft = Pc x 60 000 / Vc) times a user-entered Fr/Ft ratio. Young's modulus presets: solid carbide 580 GPa (Ceratizit CTS20L), HSS M2 219 GPa (voestalpine data sheet), or enter E. Effective flute diameter / D is an editable input, blank by default (no verified source for a default).
- Cut check and optimiser (Milling): RPM, feed, MRR, mean and max chip thickness, net and spindle power, spindle torque, tangential and radial force, deflection; share of each limit used and which binds first; largest ap for the given ae (or largest ae for the given ap) inside deflection, spindle power, spindle torque (below base speed), flute length and tool diameter limits. Machine power/torque come from the active machine profile unless entered. RPM, feed and power rows carry machine checks.
- `benchmate-core`: `second_moment_round`, `cantilever_tip_deflection`, `stepped_cantilever_tip_deflection`, `tool_deflection_mm`, `tangential_force_n`, `engagement_angle_deg`, `chip_thickness_max`, `chip_thickness_mean`, `cut_check` (`CutInput`/`CutResult`), `proportional_limit`, `cut_optimise`, with worked-example tests (including stepped = uniform when diameters match, and a torque-limited case); matching WebAssembly exports.
- `docs/sources.md`: Gere and Goodno, Roark, Altintas, Kops and Vo, and the E preset sources.
### Changed (materials)
- Material data rebuilt on an evidence model: per-source printed values with verbatim rows, URLs and access dates (`data/evidence/`), consensus and status built by `scripts/build_materials.py`. Now 122 grades from 102 documents across steels, aluminium, copper alloys, titanium, nickel alloys and cast irons. Statuses: Confirmed / Sources differ / Needs 2nd source.
- App: per-value publisher counts, alternatives shown, click a grade for each source's exact printing; family and status filters.
- `docs/material-sources.md` generated list of every material source.
### Added (machines)
- Machine profiles: add machines (speed range, power, torque, live tool speed, max feed); pick the active machine in the top bar; results over a limit are highlighted with the reason. Power is checked against the torque curve at low speed. Export/import as a JSON file for air-gapped PCs.
- Core: `spindle_power_available_kw`, `torque_for_power_nm` with tests.
### Added (calculators, batch 2)
- Arc feed correction (Milling): tool-centre feed for internal (Fe x (R - r) / R) and external (Fe x (R + r) / R) arcs, with the ratios.
- Helical interpolation and ramping (Milling): tool-centre path diameter for a hole or boss, pitch per turn from ramp angle, ramp angle from pitch, axial feed for both control feed conventions (F in the plane: F tan a; F along the helix: F sin a).
- Bar stock planner (Turning): parts per bar, bar used per part, scrap per bar, bar and part weight for round, hex and square bar from a user-entered density, material cost per part from bar price.
- Tool life and cost per part (Speeds and feeds): Taylor tool life and speed (V T^n = C, n and C user inputs), cost per part, Gilbert minimum-cost and maximum-production tool life and speeds.
- `benchmate-core`: `arc_feed_internal/external`, `helix_*`, `bar_*` (with `BarShape`), `taylor_life`, `taylor_speed`, `cost_per_part`, `economic_tool_life`, `max_production_tool_life`, each with a cited source and worked-example tests; matching WebAssembly exports.
- App: tool fields can be drop-downs (`options` in `tools.js`).
### Added (materials)
- Material equivalents tool: search any designation across AISI/SAE, UNS, EN/W.-Nr., BS 970/4659, UK old EN, JIS and GB; per-value sources, Confirmed/Review status, disagreements in notes. 53 grades, 21 confirmed.
- `docs/sources.md`: full reference list for formulas, data and research. `docs/material-equivalents.md`: rules and roadmap.
### Changed
- Licence changed from GPLv3 to AGPLv3 (AGPL-3.0-or-later) at the copyright holder's request; crate metadata updated.
- README: scope is all machinists and machines, not one machine.
### Added (app)
- First UI: tool list with search, inch/mm toggle, light/dark theme, results with the working and source shown. Tools: spindle speed, milling feed rate, MRR and power, surface finish from nose radius, cut time, taper, drill point length, thread measurement over wires, bolt circle.
- `benchmate-wasm` crate: plain C-ABI WebAssembly wrapper so the UI uses the Rust formulas.
### Added
- `benchmate-core` 0.1.0: first formula set (RPM/SFM, Vc, feed per tooth, table feed, turning/milling MRR, spindle power, theoretical Rt/Ra, pass time, taper, drill point length, 60 deg thread pitch diameter, best wire and three-wire measurement, bolt circle) with unit tests. Each function cites its source in its doc comment.
- `docs/reference-feature-inventory.md`: checklist of tool categories machinists expect.
- `ui/tokens.css` and `docs/design.md`: design tokens matching Alkart Mega Wizard.
- `docs/vendor-data-and-learning.md`: design for manufacturer data, PDF import and the adaptive profile.
- Reference inventory extended with the full "New Features" list and sample screens.
- Reference inventory and parity tracker extended from the public website and store listing.
- Parity tracker: all-machinists scope rule, control profiles for G/M codes, tool library, from the full menu screenshots.
- Dropped quiz/mini game from parity scope.
- `docs/feature-ideas.md`: ranked ideas beyond parity.
