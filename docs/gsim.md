# G-code backplot (simulator)

Screen: **G-code backplot (simulator)** (`gsim`), group "G-code cycles", code in
`app/gsim.js`. Parser and simulation: `core/src/gsim.rs`, tests in
`core/src/gsim/tests.rs`. WebAssembly exports `gsim_*` in `wasm/src/lib.rs`.
Parity batch A5 (`docs/parity-audit.md`, U95): 2D backplot and cycle-time estimate done;
3D, stock removal and the remaining canned cycles later.

**It is a backplot of the programmed path, not a machine verification.** There is
no stock, tool shape, cutter or nose radius compensation, machine travel limit,
fixture or collision check. A program that plots cleanly can still crash a
machine. The screen says so above the controls.

## Controls

Same profile ideas as the cycle generators and the G/M-code reference
(`docs/gm-codes.md`): **Generic ISO 6983 / Fanuc-style** first, **Haas** read the
same way. Mitsubishi, Siemens (ISO mode), Heidenhain (ISO) and Okuma are listed as
"not yet supported"; the core refuses them with an error rather than guess.
Lathe programs are read in Fanuc **G-code system A** (Haas lathes use it too):
G90, G92 and G94 are cycles, G98 / G99 are feed per minute / per revolution, X is a
diameter and U / W are incremental X / Z.

## What is read

| Item | Handling |
|---|---|
| Words | Letter + number, any case, spaces between words optional. `N` labels (for G70 P/Q), `O` / `:` program numbers ignored, `/` block delete ignored (the block runs). |
| Comments | `( ... )` anywhere (brackets inside a comment are counted, so `(4 HOLE(S))` is one comment) and `;` to the end of the line. An unclosed `(` is an error. |
| Numbers without a decimal point | Read as whole units (calculator-type input), with one warning naming the first such word: on a Fanuc-style control with standard input `X10` is 0.010 mm. |
| G0, G1 | Rapid and feed, modal. Two motion codes in one block is an error. |
| G2, G3 | Centre from I/J/K (incremental from the start) or radius R (negative R = more than 180 degrees). Full circles with I/J/K; a full circle with R is an error. A linear axis outside the plane makes a helix. |
| Arc check | The start and end radius about the centre may differ by at most the tolerance (default 0.005 mm / 0.0002 in, editable). More is an error on that line, with both radii. An R smaller than half the chord is an error. |
| G17, G18, G19 | Planes XY, ZX, YZ with the usual handedness (G18: G3 is counter-clockwise looking from +Y). Mill default G17, lathe G18. |
| G20, G21 | Units change at the block that gives them, including for the other words in that block. A switch after moves is warned. Without either, the units chosen on the screen are assumed and warned. |
| G90, G91 | Absolute / incremental (mill). |
| G94, G95 / G98, G99 | Feed per minute / per revolution (mill / lathe). Mill G98 / G99 pick the drilling-cycle return level. |
| G96, G97, G50 S | Constant surface speed with the G50 clamp; when the program has no G50, the "max rpm" entry is used (if blank the rpm is unbounded near X0, which only shortens the time estimate). |
| G4 | Dwell: P with a decimal point in seconds, without one in milliseconds; X or U in seconds. |
| G28 | The move to the intermediate point is drawn; the move to the reference point is not (its position in work coordinates is unknown) and is noted. |
| F, S, T, M | Modal feed and speed; lathe T0101 = tool 1. M30 / M02 end the run (later blocks with moves are warned). M98, M97, M99 are warned as not simulated. |
| G40-G42, G43, G49, G54-G59, G61, G64, G80 | Accepted; G41 / G42 add a note that compensation is not applied. |

### Cycles

| Cycle | Handling |
|---|---|
| Mill G81, G82, G85, G86, G89, G84, G74 | Drawn per hole: rapid to X/Y, rapid to R, feed to Z, dwell P where the cycle has one, out by feed (G84, G74, G85, G89) or rapid; then to R (G99) or the initial level (G98). G91: R from the initial level, Z from R. K or L repeats. |
| Mill G83, G73 | Pecks of Q; G83 rapids back to R, G73 backs off; the re-entry rapid stops 0.5 mm / 0.02 in above the last depth (a control parameter, the same value the cycle generators assume). |
| Lathe G70 P Q | Runs blocks P..Q with their own feeds, then a rapid back to the start point. |
| Lathe G71, G72, G73 | "Roughing not simulated yet": the program continues after the Q block, as on the control. The contour is drawn when G70 runs it. |
| Lathe G90, G92, G94 | Single box cycles from the start point (with R taper); modal, so a block with only X repeats with the last Z. G92 feeds at F per revolution (the lead). G32 is a straight feed. |
| Lathe G74, G75, G76; mill G76, G87, G88; G8x on a lathe | "Not simulated yet" warning, no move drawn. |
| Macros (`#`, `[`, `=`, IF, GOTO, WHILE), G10, G52, G53, G68, G92 preset on the mill, G93 | Warned and skipped. |

## Results

- Toolpath pieces, rapid or feed, each tied to the block that made it. Arcs are cut
  into pieces of at most 2 degrees for drawing; lengths use the true arc length.
- Steps: one per executed block, in execution order (a G70 lists its P..Q blocks
  again), with the position after the block, modal F (output units per minute or
  per revolution), rpm, tool and the cumulative time.
- Bounding box of all moves and of feed moves only; lathe X shown as a diameter.
- Feed and rapid distance; feed, rapid and dwell time and their total.

### Time estimate

Each feed block: length / F, or length / (F x rpm) per revolution. Under G96 the
rpm is evaluated along the move (16 sub-steps per block) up to the G50 clamp, which
agrees with the closed form in `core/src/cycles.rs` (test
`css_facing_time_matches_closed_form`). Helical arcs are timed along the arc in
the plane (Fanuc and Haas apply F to the circular component). Rapids use the rapid
rate entered, or the active machine profile's rapid rate.

**Assumed: no acceleration or deceleration, no block processing time, no tool
change, spindle start or M-code waits, no G28 travel to the reference point.**
The real time is longer.

A feed block with no F, or per revolution with no spindle speed, is not timed and is
counted on the screen.

## Screen

- Paste or type a program, or load a file (`.nc`, `.ngc`, `.tap`, `.txt`, ...). The
  text is kept in this browser (local storage, up to 300 kB).
- Mill views XY, XZ, YZ; lathe Z across with X up as a radius (diameter halved) and
  the centreline. Rapids dashed, feeds solid, the current block thicker, blocks not
  reached yet faint. Wheel to zoom, drag to pan, Fit to reset.
- Step with the buttons, the slider, the arrow keys on the plot, or Play. The
  listing highlights the current line and colours lines with errors or warnings;
  clicking a line or a message jumps to it.
- Statistics and the message list (errors, warnings, notes, each with its line).
- Theme colours come from the CSS tokens; no inline script or eval (desktop CSP).

## Tests

`cargo test -p benchmate-core gsim` and the golden tests in `core/src/gcode/tests.rs`:

- Every `core/src/gcode/golden/*.nc` program is read back with no errors, in mm and
  inch output; and for each generated program the backplot feed time and dwell
  time agree with the generator's own move list within 1 % (programs with G41/G42,
  G71 or G76 excepted: the generator times the tool-centre path or the cycle's own
  passes).
- Arc maths: quarter arcs by I/J and by R, G02 270 degree arcs, negative R, full
  circle, helix length and time, G18 and G19 planes, lathe I/K radius values,
  radius mismatch with the default and a tighter tolerance, R too small, no centre.
- Incremental mode (lines and arcs), unit switch mid-program (distance, time,
  inch output, assumed units), lathe diameter and U/W, per-rev feed with and
  without S, CSS time against the closed form, rapid time and bounding box, drilling
  G98/G99/G91 with K repeats, G82 dwell, G83 and G73 pecks, lathe G90/G92 cycles,
  G28, M30, macros, unsupported controls, line numbers in errors.

## Sources

- FANUC Series 0i-F Plus Operator's Manual B-64694EN: interpolation (G00-G03,
  helical interpolation, feed along the arc), canned cycles for drilling, lathe
  G-code system A, G70-G76 multiple repetitive cycles, G90/G92/G94 single cycles.
- Haas Mill and Lathe Operator's Manuals, G-code chapters (same readings for the
  codes listed here; Haas lathe G71 single-block form).
- NIST RS274NGC interpreter, version 3 (Kramer, Proctor, Messina, NISTIR 6556):
  word and comment format, arc end-point radius check.
