# Machinists BenchMate

A free, open-source (GPLv3) machinist's calculator, built to sit beside the machine. Native, offline, no account. Designed first for a Citizen L20 Swiss-type lathe shop, useful for any turning and milling work.

**Status:** early (v0.1.0). The Rust formula core, a first set of 9 tools and the app UI (AMW look) work in a browser. The native Tauri wrapper for Windows and Apple Silicon comes next.

## Principles
- **Accuracy first.** Every formula cites a standard reference (Machinery's Handbook, ISO, manufacturer-published formulas) in its doc comment, and has a unit test against a worked example.
- **Original work.** Our own UI, code and data tables. Not derived from any other calculator's code, artwork or data.
- **Offline.** Works on air-gapped shop PCs.
- **Honest inputs.** Material-dependent numbers (e.g. specific cutting force kc) are user inputs or clearly sourced table entries, never silent guesses.

## Layout
- `core/` - `benchmate-core`, pure Rust formulas (no dependencies)
- `wasm/` - plain C-ABI WebAssembly wrapper so the UI calls the same Rust formulas (no JS copies)
- `app/` - the UI: `index.html`, `tools.js` (declarative tool registry, one entry per calculator), `app.js`, `tokens.css`
- `scripts/build-web.sh` - builds the WebAssembly module
- `CHANGELOG.md` - every change, per version

## Build, test and run
```
cargo test                      # formula tests
rustup target add wasm32-unknown-unknown
scripts/build-web.sh            # builds app/benchmate.wasm
cd app && python3 -m http.server 8765   # then open http://localhost:8765
```
Adding a calculator means adding one entry to `app/tools.js` and, if needed, a formula to `core/` with a cited source and a test.

## Planned
Speeds and feeds, turning/finish, drilling and tapping, threads (UN, metric, NPT), taper and trig, bolt circles, drill/tap/fit charts, unit converter, materials table, Swiss-lathe helpers, second-opinion feeds from published manufacturer data, link-up with Alkart Mega Wizard.

## Licence
GPL-3.0-or-later. See `LICENSE`.
