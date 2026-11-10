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
- `app/` - the UI: `index.html`, `tools.js` (declarative tool registry, one entry per calculator), `gdt.js` (GD&T guide, frame builder, stack), `shop.js` (capability, temperature compensation, fractions, setup sheet), `geometry.js` (triangles, arcs, fillets, dovetails, weight, sine bar, indexing), `cad.js` (DXF generator screens), `toollib.js` (tool library), `app.js` (shell, favourites), `tokens.css`
- `scripts/build-web.sh` - builds the WebAssembly module; `scripts/check_dxf.py` - checks generated DXF files with the independent ezdxf reader
- `data/` - reference data (material equivalents), generated from `scripts/materials_seed.py`
- `docs/sources.md` - every source referenced; `docs/gdt.md` - GD&T sources and decisions; `docs/shop-helpers.md` - shop helper sources and decisions; `docs/geometry.md` - geometry sources and decisions; `docs/cad-dxf.md` - DXF format, shapes, validation, tool library and favourites
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

## CAD / DXF
Parametric 2D shapes exported as DXF for CAM: bolt circle (with outside diameter and centre bore), rectangular hole grid on an optional plate, straight and arc slots, rectangle with corner radii and corner holes, regular polygon from across flats or corners, circle and ring, keyhole, D-flat and double-D. Live SVG preview with overall dimensions, hole callouts and a hole position table. Inch or mm (`$INSUNITS` set), layers OUTLINE / HOLES / CENTRE, optional centre marks, origin at the centre or lower-left, DXF R2000 (LWPOLYLINE with bulges) or R12 (POLYLINE/VERTEX). The writer is in the Rust core, tested by reading its own output back, and the files load and audit cleanly in ezdxf. See `docs/cad-dxf.md`.

## Tool library and favourites
Save end mills, drills, taps, reamers and inserts (type, diameter, shank, flutes, flute length, overall length, stick-out, corner radius, point angle, pitch, material, coating, maker, part number, notes) in the browser, with JSON export and import that never overwrites. "Fill from tool library" on spindle speed, milling feed, arc feed, helical interpolation, tool deflection, cut optimiser, drill point, tap drill and surface finish, converting inch and mm. Star any tool to put it in a Favourites group at the top of the list.

## Planned
Speeds and feeds, turning/finish, drilling and tapping, threads (UN, metric, NPT), taper and trig, bolt circles, drill/tap/fit charts, unit converter, materials table, Swiss-lathe helpers, second-opinion feeds from published manufacturer data, link-up with Alkart Mega Wizard.

## Licence
GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). See `LICENSE`. If you run a modified version for others over a network, you must offer them its source.
