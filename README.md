# Machinists BenchMate

A free, open-source (GPLv3) machinist's calculator, built to sit beside the machine. Native, offline, no account. Designed first for a Citizen L20 Swiss-type lathe shop, useful for any turning and milling work.

**Status:** early. Only the calculation core exists so far; the app UI comes next.

## Principles
- **Accuracy first.** Every formula cites a standard reference (Machinery's Handbook, ISO, manufacturer-published formulas) in its doc comment, and has a unit test against a worked example.
- **Original work.** Our own UI, code and data tables. Not derived from any other calculator's code, artwork or data.
- **Offline.** Works on air-gapped shop PCs.
- **Honest inputs.** Material-dependent numbers (e.g. specific cutting force kc) are user inputs or clearly sourced table entries, never silent guesses.

## Layout
- `core/` - `benchmate-core`, pure Rust formulas (no dependencies)
- `CHANGELOG.md` - every change, per version

## Build and test
```
cargo test
```

## Planned
Speeds and feeds, turning/finish, drilling and tapping, threads (UN, metric, NPT), taper and trig, bolt circles, drill/tap/fit charts, unit converter, materials table, Swiss-lathe helpers, second-opinion feeds from published manufacturer data, link-up with Alkart Mega Wizard.

## Licence
GPL-3.0-or-later. See `LICENSE`.
