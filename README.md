# Machinists BenchMate

A free, open-source (AGPLv3) machinist's calculator, built to sit beside the machine. Native, offline, no account. For all machinists and all machines: mills, lathes, Swiss-type and more.

**Status:** early (v0.1.0). The Rust formula core and the app UI (AMW look) work in a browser and as a native desktop app (Tauri 2) for Windows, macOS (Apple Silicon) and Linux.

## Download and install
Get the files from the [Releases page](https://github.com/jkdesignpro/Machinists-BenchMate/releases). The app is fully offline and has no account or updater; everything you save stays on your computer.

- **Windows 10/11 (x64):** run `Machinists-BenchMate_<version>_windows_x64-setup.exe` (installs for your user, no admin) or the `.msi`. Until the installers are code signed, **SmartScreen** says "Windows protected your PC": click **More info**, then **Run anyway**.
- **macOS (Apple Silicon, macOS 11+):** open the `.dmg` and drag the app to Applications, or unzip the `.app.zip`. The app is ad hoc signed but not notarised by Apple, so the first launch is blocked: open it once, then go to **System Settings > Privacy & Security**, scroll down and click **Open Anyway** (then confirm). After that it opens normally.
- **Linux (x86_64):** `chmod +x Machinists-BenchMate_<version>_linux_x86_64.AppImage` and run it, or on Debian/Ubuntu `sudo apt install ./machinists-benchmate_<version>_amd64.deb`.

Check a download against `SHA256SUMS.txt` on the release page if you like (`sha256sum -c`, or `certutil -hashfile <file> SHA256` on Windows).

## Principles
- **Accuracy first.** Every formula cites a standard reference (Machinery's Handbook, ISO, manufacturer-published formulas) in its doc comment, and has a unit test against a worked example.
- **Original work.** Our own UI, code and data tables. Not derived from any other calculator's code, artwork or data.
- **Offline.** Works on air-gapped shop PCs.
- **Honest inputs.** Material-dependent numbers (e.g. specific cutting force kc) are user inputs or clearly sourced table entries, never silent guesses.

## Layout
- `core/` - `benchmate-core`, pure Rust formulas (no dependencies)
- `wasm/` - plain C-ABI WebAssembly wrapper so the UI calls the same Rust formulas (no JS copies)
- `app/` - the UI: `index.html`, `tools.js` (declarative tool registry, one entry per calculator), `gdt.js` (GD&T guide, frame builder, stack), `shop.js` (capability, temperature compensation, fractions, setup sheet), `geometry.js` (triangles, arcs, fillets, dovetails, weight, sine bar, indexing), `cad.js` (DXF generator screens), `toollib.js` (tool library), `cycles.js` (G-code cycle generators), `app.js` (shell, favourites), `tokens.css`
- `desktop/` - the Tauri 2 desktop wrapper: serves `app/` from the app bundle (no network), native save dialog for exports, icons in `desktop/icons/` (from `icon.svg`)
- `tests/smoke/` - headless Chromium smoke test of `app/`; `scripts/check-versions.py` - checks the version is the same everywhere
- `.github/workflows/` - CI (`ci.yml`) and release builds (`release.yml`); see `docs/release.md`
- `scripts/build-web.sh` - builds the WebAssembly module; `scripts/check_dxf.py` - checks generated DXF files with the independent ezdxf reader
- `data/` - reference data (material equivalents), generated from `scripts/materials_seed.py`
- `docs/sources.md` - every source referenced; `docs/gdt.md` - GD&T sources and decisions; `docs/shop-helpers.md` - shop helper sources and decisions; `docs/geometry.md` - geometry sources and decisions; `docs/cad-dxf.md` - DXF format, shapes, validation, tool library and favourites; `docs/cycles.md` - G-code cycle syntax sources, dialect support and decisions
- `CHANGELOG.md` - every change, per version

## Build, test and run
```
cargo test                      # formula tests
rustup target add wasm32-unknown-unknown
scripts/build-web.sh            # builds app/benchmate.wasm
cd app && python3 -m http.server 8765   # then open http://localhost:8765
```
Desktop app (needs the Tauri prerequisites, see `docs/release.md`):
```
scripts/build-web.sh
cargo install tauri-cli --version "^2" --locked
cd desktop && cargo tauri build      # installers in desktop/target/release/bundle/
```
Smoke test of the UI: `cd tests/smoke && npm ci && npx playwright install chromium && cd ../.. && node tests/smoke/smoke.mjs`.

Adding a calculator means adding one entry to `app/tools.js` and, if needed, a formula to `core/` with a cited source and a test.

## GD&T
A GD&T reference guide (datums, Rule #1 vs ISO independency, every characteristic, modifiers, ASME/ISO comparison), a feature control frame builder with plain-English explanation and validity checks, and calculators for true position, bonus/virtual/resultant condition, position/plus-minus conversion, fastener tolerances, worst-case/RSS stacks, a composite position (PLTZF/FRTZF) checker, an unequal profile (U) zone calculator, and a datum reference frame / degrees-of-freedom explainer. Written for ASME Y14.5-2018 and current ISO GPS editions; see `docs/gdt.md`.

## Geometry
Triangle solver (right and oblique, incl. the two-solution case) with a drawing; chord, arc, sagitta and three-point circle; corner and line-to-arc fillets with tangent points; dovetail and V-groove measurement over pins; stock weight for bar, tube, flat, plate and sheet; sheet-metal bend allowance and deduction; sine bar with a fewest-block gauge stack; dividing head and rotary table indexing (simple, angular, differential) with your own plates and gears. See `docs/geometry.md`.

## Shop helpers
Process capability (Cp, Cpk, Pp, Ppk, expected ppm, histogram with normal fit) from pasted measurements or a mean and sigma; temperature compensation of measurements to 20 °C for part and gauge expansion; coolant concentration from a refractometer reading and the fluid's own factor, plus mix and top-up amounts; fraction / decimal inch / mm converter with nearest fraction and error; a printable setup sheet (job, machine, tools, work offsets, notes) saved in the browser with JSON export and import. See `docs/shop-helpers.md`.

## G-code cycles
Program generators for drilling and tapping (G81, G82, G83, G73, G84 rigid or floating) on a bolt circle, grid or pasted holes with CSV export; thread milling (internal/external, climb/conventional, arc-in/out, optional G41/G42, several passes); lathe threading with G76 or G92 passes and an infeed table (constant volume, constant depth, custom, minimum cut, spring passes); taper turning and boring; groove and cut-off with CSS; keyway broaching; G71/G70 from a simple profile. Output for a generic ISO 6983 / Fanuc-style control and for Haas; other controls are shown as not yet supported until their syntax is confirmed. Each program has a backplot, an estimated cycle time and a check against the active machine. Always prove out a generated program in single block. See `docs/cycles.md`.
## CAD / DXF
Parametric 2D shapes exported as DXF for CAM: bolt circle (with outside diameter and centre bore), rectangular hole grid on an optional plate, straight and arc slots, rectangle with corner radii and corner holes, regular polygon from across flats or corners, circle and ring, keyhole, D-flat and double-D. Live SVG preview with overall dimensions, hole callouts and a hole position table. Inch or mm (`$INSUNITS` set), layers OUTLINE / HOLES / CENTRE, optional centre marks, origin at the centre or lower-left, DXF R2000 (LWPOLYLINE with bulges) or R12 (POLYLINE/VERTEX). The writer is in the Rust core, tested by reading its own output back, and the files load and audit cleanly in ezdxf. See `docs/cad-dxf.md`.

## Tool library and favourites
Save end mills, drills, taps, reamers and inserts (type, diameter, shank, flutes, flute length, overall length, stick-out, corner radius, point angle, pitch, material, coating, maker, part number, notes) in the browser, with JSON export and import that never overwrites. "Fill from tool library" on spindle speed, milling feed, arc feed, helical interpolation, tool deflection, cut optimiser, drill point, tap drill and surface finish, converting inch and mm. Star any tool to put it in a Favourites group at the top of the list.

## Planned
Speeds and feeds, turning/finish, drilling and tapping, threads (UN, metric, NPT), taper and trig, bolt circles, drill/tap/fit charts, unit converter, materials table, Swiss-lathe helpers, second-opinion feeds from published manufacturer data, link-up with Alkart Mega Wizard.

## Licence
GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). See `LICENSE`. If you run a modified version for others over a network, you must offer them its source.
