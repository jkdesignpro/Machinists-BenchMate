# Changelog

All notable changes to Machinists BenchMate. Versions follow semver.

## [Unreleased]
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
