# Mechanics for the shop (parity batch B8)

Formulas in `core/src/mechanics.rs` (module `mechanics`, 12 tests), WebAssembly
exports `mech_*` in `wasm/src/lib.rs`, screens in `app/tools.js` (group
"Mechanics"), unit helpers and drawings in `app/mechanics.js`, formula library
entries in `app/formulas.js`.

The relations here are classical mechanics. Where a textbook is named
(Gere and Goodno, Roark, Shigley, Thomson) it is cited **by name for the
relation only**; nothing is copied from it. Numbers in the tests come from
free public sources or are derived below. No table from Machinery's Handbook or
any other copyrighted book is reproduced.

## Units

The core formulas are unit-consistent: the inch screens pass in, lbf and psi
(E entered in Mpsi, stresses shown in ksi), the mm screens pass mm, N and MPa
(E in GPa, moments shown in N·m). Mass, speed and power are converted to SI in
the screen before the call. Unit factors are exact (NIST SP 811 appendix B):
1 lbf = 4.4482216152605 N, 1 lb = 0.45359237 kg, 1 in = 25.4 mm,
1 hp = 550 ft·lbf/s = 745.69987 W, 1 oz = 28.349523125 g. Standard gravity
g = 9.80665 m/s² (exact).

## Screens

| Tool | What it does | Sources |
|---|---|---|
| `section` Section properties | A, centroid, Ix, Iy, Ixy, principal I1/I2 and angle, Sx and Sy at each fibre, rx, ry, least r, J for round and tube | GERE; AISC Manual (area check) |
| `beam` Beam deflection and bending stress | Cantilever, simply supported, fixed both ends; point load anywhere plus a full uniform load; reactions, shear, moment, deflection, slope, stress; drawing | ROARK Table 8.1, GERE ch. 9; AWC DA 6 |
| `torsion` Shaft torsion and power | tau, angle of twist, power/torque/speed, G from E and nu, solid diameter for a stress | GERE ch. 3; NIST SP 811 |
| `column` Column buckling | Euler, Johnson, switch-over, K factors, allowable load; column curve drawing | GERE ch. 11, SHIG; AISC 360-16 Table C-A-7.1 |
| `stressconc` Stress concentration (holes) | Hole in a finite-width plate (net-section fit), elliptical hole, Kf from q; **stepped shafts not included** | FMO; Inglis 1913; EE |
| `fatigue` Fatigue | Se' estimate, Marin ka and kb, user kc/kd/ke, Kf; Goodman, Soderberg, Gerber, Langer; Haigh drawing | EE; SHIG; PSU |
| `chuckforce` Centrifugal force and chuck grip | F = m r omega², jaw force, grip at speed, speeds for one third and zero grip, speed for a needed grip | OpenStax; VDI 3106 (by name); Optimum manual; Berg |
| `balance` Balancing | ISO 21940-11 U_per and e_per, two-plane split with the 30-70 % check, correction mass, force, grade reached | ISO 21940-11 (by name); IRD paper |
| `critspeed` Critical speed of a shaft | Rayleigh and Dunkerley with up to three discs plus shaft mass, plain-shaft exact value, static sag | THOM; derivation below |

## Sources

- **[GERE]** J. M. Gere, B. J. Goodno, *Mechanics of Materials* (Cengage).
  Relations only: parallel-axis theorem and principal axes (ch. 12), torsion
  of circular bars and power transmission (ch. 3), beam deflections (ch. 9),
  columns (ch. 11).
- **[ROARK]** W. C. Young, R. G. Budynas, A. M. Sadegh, *Roark's Formulas for
  Stress and Strain*, 8th ed., Table 8.1. Relations only.
- **[AWC]** American Wood Council, *Design Aid No. 6: Beam Design Formulas
  with Shear and Moment Diagrams* (free PDF from awc.org). The closed-form
  maxima (P L³/48EI, 5wL⁴/384EI, P L³/3EI, wL⁴/8EI, wL⁴/384EI, PL³/192EI,
  the off-centre simple-beam maximum and the fixed-end load-anywhere case) are
  the oracles in `beam_published_maxima`. These formulas are the same in every
  mechanics text.
- **[AISC]** AISC 360-16 *Specification for Structural Steel Buildings*,
  Commentary Table C-A-7.1 (free from aisc.org): theoretical K 0.5, 0.7, 1.0,
  2.0 and recommended design values 0.65, 0.80, 1.0, 2.1 for fixed-fixed,
  fixed-pinned, pinned-pinned and fixed-free. Shown as text on the column
  screen; the user picks K.
- **[SHIG]** R. G. Budynas, J. K. Nisbett, *Shigley's Mechanical Engineering
  Design*. Relations only: Johnson parabola and its tangency with Euler,
  Goodman/Soderberg/Gerber lines, Gerber closed-form factor of safety, Langer
  yield line, Marin equation structure. Shigley's newer editions print a
  revised surface-factor fit (see "Fatigue" below); we do not use it.
- **[EE]** Engineers Edge, *Marin endurance limit calculator* (after T. H.
  Brown, *Marks' Calculations for Machine Design*), fetched 2026-11-11:
  Se' = 0.504 Sut up to 1400 MPa / 200 kpsi, 700 MPa / 100 kpsi above;
  ka = a Sut^b with ground 1.58 / 1.34, -0.085; machined or cold-drawn 4.51 /
  2.70, -0.265; hot-rolled 57.7 / 14.4, -0.718; as forged 272 / 39.9, -0.995
  (a in MPa / kpsi); kb = (d/7.62)^-0.1133 for 2.79-51 mm; Kf = 1 + q (Kt - 1).
  Its check rows (machined 455 MPa: 0.89; forged 455 MPa: 0.63; machined
  875 MPa: 0.75; forged 875 MPa: 0.33) are tests.
- **[PSU]** Penn State ME 360 notes `n06_fatigue.pdf` (me.psu.edu, after
  Norton): Goodman N = Na Nm / (Na + Nm); Norton example 6-5 gives Na = 2.507,
  Nm = 7.533, N = 1.88 (test).
- **[FMO]** B. McGinty, *Stress Concentrations at Holes*, fracturemechanics.org:
  Kirsch Kt = 3 for a hole in an infinite plate; finite-width fit
  Kt = 3 - 3.14 (d/W) + 3.667 (d/W)² - 1.527 (d/W)³ on the net-section stress
  F / ((W - d) t), and the warning that Kt falling toward 2 does not mean the
  peak stress falls.
- **Inglis 1913**: C. E. Inglis, Stresses in a plate due to the presence of
  cracks and sharp corners, Trans. Inst. Naval Architects 55 (1913). Exact
  elastic result Kt = 1 + 2a/b (circle: 3, consistent with Kirsch).
- **[IRD]** IRD Balancing, *Technical Paper 1: Balance Quality Requirements of
  Rigid Rotors* (free; slideshare copy fetched 2026-11-11):
  U_per = 9549 G W / N (g·mm, kg), 6.015 G W / N (oz·in, lb); plane split
  U_L = U_per hR / b, U_R = U_per hL / b, each 30-70 % of U_per; worked
  example 1000 lb, 900 rpm, G 6.3 gives 21 oz·in per plane and G 2.5 gives
  8.3 oz·in per plane (tests). We compute 1000 G m / omega, which is
  9549.3 G m / n; the printed constant 9549 is the same to 0.003 %.
- **ISO 21940-11:2016** (replaces ISO 1940-1:2003), cited by name; its rotor
  type table is not reproduced.
- **F = m r omega²**: OpenStax *University Physics* Vol. 1, section 6.3
  (centripetal force), free.
- **[VDI3106]** VDI 3106, *Determination of permissible speed of lathe chucks*
  (cited by name). The structure Fsp0 = Ssp (Fsp +- Fc), Ssp >= 1.5, and the
  sign rule are printed in the Optimum Optiturn lathe manual, section 4.23.8
  (manualslib). Berg Spanntechnik's speed notes (free PDF) define the chuck's
  rated speed as the speed where the jaw centrifugal force equals two thirds
  of the standstill grip, leaving one third.
- **[THOM]** W. T. Thomson, *Theory of Vibration with Applications*. Rayleigh's
  method with the static deflection curve (upper bound), Dunkerley's formula
  (lower bound), beam eigenvalues beta L = pi (pinned-pinned) and
  1.875104 (cantilever, root of cos x cosh x = -1).

## Decisions and checks

### Section properties
Built up from rectangles with the parallel-axis theorem; sharp corners (no
root fillets), so rolled-section catalogue values differ a little: the L4x4x½
angle gives A = 3.75 in² and y = 1.183 in (AISC Manual: 3.75 in², 1.18 in),
Ix = 5.56 in⁴ against a catalogue value that includes fillets. Tests: b h³/12,
pi D⁴/64, box = outer - inner, I-beam closed form [b h³ - (b - tw)(h - 2tf)³]/12,
channel Ix equal to the I-beam's, tee hand calculation, equal angle principal
axes at 45° with I1,2 = Ix ∓ Ixy.

### Beams
Closed forms for each case, written as y(x), slope, M(x) and V(x) with
E I y'' = -M. The test `beam_equations_consistent` differentiates every case
numerically and checks E I y'' = -M, slope = dy/dx and V = dM/dx, plus the
boundary conditions and continuity at the load; `beam_published_maxima`
checks the maxima against AWC DA 6. Maxima along the span are found by dense
sampling plus a golden-section refinement (relative error below 1e-9 in the
tests). Not included: shear deformation (Timoshenko), partial uniform loads,
overhangs, propped cantilevers, moving loads.

### Torsion
Round shafts and tubes only (non-circular torsion needs St Venant
coefficients that we would have to take from a copyrighted table).
kW = N·m x rpm / 9549.3 and hp = lbf·in x rpm / 63 025 both follow from
P = T omega with exact unit factors.

### Columns
Johnson below the transition slenderness sqrt(2 pi² E / Sy), Euler above;
the test checks that both give Sy/2 with the same slope at the transition.
Least radius of gyration from the principal I2, so angles buckle about their
weak principal axis. Warning on screen that ideal-column values are upper
limits and design codes reduce them.

### Stress concentration
Only the two hole cases with a free printed source or an exact solution.
**Not included:** stepped shafts and shoulder fillets, grooves, keyways,
cross holes and plates with fillets. Peterson-style curve fits for these exist
(Peterson's Stress Concentration Factors, Roark Table 17.1, Shigley
Appendix A-15) but we found no free public source printing a fit we could
check, so the screen says "not included" and does not invent one. The notch
sensitivity q is the user's own value for the same reason.

### Fatigue
All endurance numbers are labelled estimates on screen. Two published
surface-factor fits disagree by a few percent: the one used here (Engineers
Edge / Marks', same as Shigley 8th-9th ed.) and the revised fit in Shigley's
10th and 11th editions (an F-Chart EES page gives ka = 0.2921 for as-forged
steel at Sut = 1000 MPa from the 11th edition, against 0.282 here). The MPa and
kpsi constants of the same fit also differ by about 2 % for as-forged steel;
the tests allow for that. The load, temperature and reliability factors are
user inputs (default 1) because published values differ (axial kc 0.7 in
Norton, 0.85 in Shigley). For a compressive mean stress the factor shown is
Se / sa.

### Centrifugal force and chuck grip
F = m r omega² per jaw; grip at speed Fsp0 - sum(m r) omega² when gripping
an outside diameter, plus when gripping a bore. Rigid jaws assumed; the screen
says that real chucks lose more grip (body and jaw flexibility, which VDI 3106
covers with factors we do not reproduce) and that the chuck maker's maximum
speed always governs. The one-third rule is shown as the makers' basis for
the rated speed, not as a safe limit.

### Balancing
U_per from the definition G = e omega (e in mm, omega in rad/s). Plane
split for planes between the bearings; the screen warns when a share falls
outside 30-70 % (narrow and overhung rotors need the other ISO 21940-11
rules, not implemented). G grades offered: 0.4, 1, 2.5, 6.3, 16, 40 and own.
Rotor type examples from the standard are not reproduced.

### Critical speed
Influence coefficients come from the beam formulas (unit point load), so the
critical speed shares their tests. Rayleigh uses the static deflection curve
under gravity, with the shaft lumped into 100 pieces; Dunkerley adds the
plain-shaft term. Derivation of the Rayleigh check for a plain pinned-pinned
shaft: y = q x (L³ - 2 L x² + x³)/(24 EI), ∫y dx = q L⁵/(120 EI),
∫y² dx = (q/24EI)² L⁹ x 31/630, so omega² = (576 x 630)/(120 x 31) EI/(mu L⁴)
= 3024/31 EI/(mu L⁴), omega = 9.8767 sqrt(EI/(mu L⁴)) against the exact
pi² = 9.8696 (0.07 % high, as an upper bound should be). Also tested: a single
disc at mid-span sqrt(48 EI/(m L³)) (Rayleigh and Dunkerley both exact),
overhung disc sqrt(3 EI/(m L³)), cantilever plain shaft 3.5160, and
Dunkerley < Rayleigh. Assumptions shown on screen: rigid bearings, point-mass
discs (no gyroscopic effect), uniform shaft, no damping.

## Not verified / open

- Beam formulas and the Rayleigh/Dunkerley results are verified by our own
  derivations and the AWC closed forms, not by a second free worked example
  with numbers.
- The VDI 3106 text itself was not read (paid); the grip relation is the
  physics plus the structure printed in a lathe manual.
- AISC Table C-A-7.1 values are quoted from the commentary from memory of
  the free document and were not re-fetched in this session.
- Peterson q (notch sensitivity) formulas and Neuber constants are not
  included.
