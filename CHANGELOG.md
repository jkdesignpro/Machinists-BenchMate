# Changelog

All notable changes to Machinists BenchMate. Versions follow semver.

## [Unreleased]
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
