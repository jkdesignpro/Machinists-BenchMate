# Machinists BenchMate

A free, open-source (AGPLv3) machinist's calculator, built to sit beside the machine. Native, offline, no account. For all machinists and all machines: mills, lathes, Swiss-type and more.

**Status:** early (v0.1.0). The Rust formula core, a first set of 13 tools and the app UI (AMW look) work in a browser. The native Tauri wrapper for Windows and Apple Silicon comes next.

## Principles
- **Accuracy first.** Every formula cites a standard reference (Machinery's Handbook, ISO, manufacturer-published formulas) in its doc comment, and has a unit test against a worked example.
- **Original work.** Our own UI, code and data tables. Not derived from any other calculator's code, artwork or data.
- **Offline.** Works on air-gapped shop PCs.
- **Honest inputs.** Material-dependent numbers (e.g. specific cutting force kc) are user inputs or clearly sourced table entries, never silent guesses.

## Layout
- `core/` - `benchmate-core`, pure Rust formulas (no dependencies)
- `wasm/` - plain C-ABI WebAssembly wrapper so the UI calls the same Rust formulas (no JS copies)
- `app/` - the UI: `index.html`, `tools.js` (declarative tool registry, one entry per calculator), `gdt.js` (GD&T guide, frame builder, stack), `shop.js` (capability, temperature compensation, fractions, setup sheet), `geometry.js` (triangles, arcs, fillets, dovetails, weight, sine bar, indexing), `app.js`, `tokens.css`
- `scripts/build-web.sh` - builds the WebAssembly module
- `data/` - reference data (material equivalents), generated from `scripts/materials_seed.py`
- `docs/sources.md` - every source referenced; `docs/gdt.md` - GD&T sources and decisions; `docs/shop-helpers.md` - shop helper sources and decisions; `docs/geometry.md` - geometry sources and decisions
- `CHANGELOG.md` - every change, per version

## Build, test and run
```
cargo test                      # formula tests
rustup target add wasm32-unknown-unknown
scripts/build-web.sh            # builds app/benchmate.wasm
cd app && python3 -m http.server 8765   # then open http://localhost:8765
```
Adding a calculator means adding one entry to `app/tools.js` and, if needed, a formula to `core/` with a cited source and a test.

## GD&T
A GD&T reference guide (datums, Rule #1 vs ISO independency, every characteristic, modifiers, ASME/ISO comparison), a feature control frame builder with plain-English explanation and validity checks, and calculators for true position, bonus/virtual/resultant condition, position/plus-minus conversion, fastener tolerances, worst-case/RSS stacks, a composite position (PLTZF/FRTZF) checker, an unequal profile (U) zone calculator, and a datum reference frame / degrees-of-freedom explainer. Written for ASME Y14.5-2018 and current ISO GPS editions; see `docs/gdt.md`.

## Geometry
Triangle solver (right and oblique, incl. the two-solution case) with a drawing; chord, arc, sagitta and three-point circle; corner and line-to-arc fillets with tangent points; dovetail and V-groove measurement over pins; stock weight for bar, tube, flat, plate and sheet; sheet-metal bend allowance and deduction; sine bar with a fewest-block gauge stack; dividing head and rotary table indexing (simple, angular, differential) with your own plates and gears. See `docs/geometry.md`.

## Shop helpers
Process capability (Cp, Cpk, Pp, Ppk, expected ppm, histogram with normal fit) from pasted measurements or a mean and sigma; temperature compensation of measurements to 20 °C for part and gauge expansion; coolant concentration from a refractometer reading and the fluid's own factor, plus mix and top-up amounts; fraction / decimal inch / mm converter with nearest fraction and error; a printable setup sheet (job, machine, tools, work offsets, notes) saved in the browser with JSON export and import. See `docs/shop-helpers.md`.

## Planned
Speeds and feeds, turning/finish, drilling and tapping, threads (UN, metric, NPT), taper and trig, bolt circles, drill/tap/fit charts, unit converter, materials table, Swiss-lathe helpers, second-opinion feeds from published manufacturer data, link-up with Alkart Mega Wizard.

## Licence
GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). See `LICENSE`. If you run a modified version for others over a network, you must offer them its source.
