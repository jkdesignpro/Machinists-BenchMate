# Changelog

All notable changes to Machinists BenchMate. Versions follow semver.

## [Unreleased]
### Added (reference data: drills, tap drills, threads, limits and fits)
- Drill size chart (Drilling and tapping): fractional, letter, number (#1 to #97) and metric drills in decimal inch and mm, searchable, with a nearest-drill finder. Each size shows its evidence status: Exact, Confirmed, Confirmed with one outlier, or One source.
- Tap drill size (Drilling and tapping):
  - Cutting taps from the percent-of-thread formula, D - 1.299 P x %/100 (OSG, FM Carbide).
  - Forming taps from D - 0.0068 x % x P (FM Carbide, Engineers Edge).
  - Percent thread at the basic minor diameter and for the "D - P" rule of thumb, which is labelled as an approximation (about 77 %).
  - The nearest standard drills, with their percent thread.
- Thread data and limits (Threads):
  - ISO metric coarse/fine series (ISO 261/262) and UNC/UNF/UNEF series, with basic dimensions from the ISO 68-1 / ASME B1.1 basic profile.
  - ISO 965-1 6g/6H limits: the published value, with the formula value beside it.
  - Unified classes 2A/3A/2B/3B from the ASME B1.1-2024 formulas.
- ISO limits and fits (new group "Limits and fits"):
  - IT01 to IT18 and all hole and shaft fundamental deviations up to 500 mm (a to zc and A to ZC, except j/J), from published tables checked against two or more publishers.
  - Hole and shaft limits and presets for common fits.
  - The fit type (clearance, transition or interference) with its maximum and minimum values.
  - The formula value beside each table value, and notes on standard editions: ISO 286-1:2010 supersedes the 1988 rounding of js values.
- `benchmate-core`, with tests against published tables (table/formula exceptions are listed in the tests) and matching WebAssembly exports:
  - `threads` module: basic profile, tap drill formulas, ISO 965 tolerances with R40 rounding, ASME B1.1 class tolerances.
  - `fits` module: ISO 286 tolerance factor, IT formula, delta rule, shaft and hole limits, fit type.
- Evidence files in `data/refdata/`, and `scripts/build_refdata.py` (run by `scripts/build-web.sh`), which builds `data/refdata.json` with per-value publisher counts and disagreements.
- `docs/sources.md`: reference data sources, current standard editions, disagreements and unverified items.
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
