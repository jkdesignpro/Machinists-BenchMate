# Gears and splines

Code: `core/src/gears.rs` (formulas and tests), `wasm/src/lib.rs` (`gear_*` exports),
screens in `app/tools.js` (group "Gears and splines"), drawing in `app/gears.js`,
formula entries in `app/formulas.js` (keys KHK, SDPSI, MESYS, ISO53, ISO21771, KAPEL,
FRENCO, WILLIS, B92, ISO4156).

All lengths are in one unit. Inch gears use the module m = 1 / P (P = diametral pitch).
Every formula is written out from public material and derived again where possible;
no table is copied from Machinery's Handbook or from the standards.

## Screens

| Screen | What it gives |
| --- | --- |
| Spur gear data (`spurgear`) | d, db, da, df, ha, hf, h, p, pb, tooth thickness on the reference circle and at the tip, undercut limit; for a pair: working pressure angle, y, centre distance, working pitch diameters, tips for standard clearance, transverse contact ratio. Drawing of three teeth from the true involute. |
| Gear measurement (`gearmeasure`) | Span W over k teeth with the suggested k (unrounded value shown), anvil contact diameter, least face width (helical); over pins or balls (external) or between pins (internal) with the ideal pin size, pin centre circle and contact diameter; chordal tooth thickness and height. |
| Helical gears (`helicalgear`) | mt, at, base helix angle, normal, transverse and axial pitch, lead, zv, centre distance with normal profile shift, tips for standard clearance, transverse, overlap and total contact ratio. |
| Gear train ratio (`geartrain`) | Simple and compound ratio for up to four pairs, output speed and direction, and a change-gear finder for a wanted ratio from a gear set (smallest, largest, step). |
| Planetary gear set (`planetary`) | Willis' formula for any blank speed, the three usual ratios, planet teeth, equal spacing check. |
| Involute splines (`spline`) | ANSI B92.1 and ISO 4156, 30 degree flat root side fit: D, Db, p, basic s = e, major and minor diameters, measurement over and between pins. Live drawing of one tooth space of the shaft and of the hub, enlarged, with the pin, where it touches, and a check that the pin can measure (0.4.0). |
| Worm and wheel (`worm`) | Lead, lead angle, ratio, wheel pitch diameter, centre distance, normal module. |

## Formulas and sources

- **Basic rack**: ISO 53:1998 and the AGMA full depth system (cited by name):
  ha* = 1, hf* = 1.25. Both are inputs.
- **Spur geometry, profile shift, centre distance, contact ratio**: KHK Gear Technical
  Reference, "Calculation of gear dimensions"
  (https://khkgears.us/media/izojpong/gear_guide1.pdf, Table 4.3); SDP/SI, Elements of
  Metric Gear Technology, sections 4 and 6.
- **Helical, normal system**: KHK Table 4.9 (same PDF); SDP/SI section 6.
  sin bb = sin b cos an: KHK span article (below).
- **Span measurement**: ISO 21771-1:2024 and DIN 3960 (cited by name); KHK, "How to
  calculate the nominal values of span measurement"
  (https://www.khkgears.us/media/1275/how-to-calculate-the-nominal-values-of-span-measurement-of-teeth-of-various-types-of-gearing.pdf,
  Gear Solutions 2020), which also gives b_min = W sin bb + 3 mm; A. Kapelevich,
  Gear Technology Jan/Feb 2011.
- **Over pins and balls, ideal pin, internal gears**: KHK, "How to calculate the nominal
  values of over pin or ball measurement"
  (https://www.khkgears.us/media/1276/how-to-calculate-the-nominal-values-of-over-pin-or-ball-measurement-of-teeth-for-various-types-of-gearing.pdf);
  SDP/SI section 10. Helical balls use the spur ideal-pin formula on zv = z / cos^3 b
  (KHK). Odd helical gears: FRENCO (P. Jukl, R. Och, GETPRO 2015) shows the true
  two-ball size is a little smaller than the transverse formula; the screen says so.
- **Chordal tooth thickness**: KHK, "How to calculate the nominal values of chordal tooth
  thickness" (https://www.khkgears.us/media/1274/how-to-calculate-the-nominal-values-of-chordal-tooth-thickness-in-all-types-of-gearing.pdf).
- **Gear trains, planetary**: ratio arithmetic; R. Willis, Principles of Mechanism (1841);
  SDP/SI section 13. The change-gear finder reuses `change_gear_trains` (the lathe change
  gears search in `core/src/measure.rs`).
- **Splines**: ANSI B92.1-1996 and ISO 4156-1:2021 (cited by name). ANSI factors from
  Engineers Edge, involute spline basic formulas
  (https://www.engineersedge.com/gears/involute_spline_13649.htm); ISO factors from the
  ISO 4156:1981 table 2 free preview (iTeh). Pins as for gears.
- **Worm**: KHK, cylindrical worm gear pair; SDP/SI section 9.

## Tests (worked examples)

`cargo test -p benchmate-core gears` (14 tests):

- KHK Table 4.3 (m 3, z 12 / 24, x 0.6 / 0.36): inv aw, aw 26.0886, y 0.83329,
  a 56.4999, dw, ha, h, da 44.840 / 79.400, df 32.100 / 66.660 all reproduced.
- KHK Table 4.9 (mn 3, b 30, z 12 / 60, xn 0.09809): at 22.79588, awt 23.1126, y 0.09744,
  a 125.000, d, db, da 48.153 / 213.842, df 34.657 / 200.346 reproduced.
- MESYS AG online calculation (calc.mesys.ch), m 1, z 30, ball 1.7 at the two generating
  shifts xE -0.0412 and -0.0824: Wk(3) 7.7723 / 7.7441 and MdK 32.2380 / 32.1641
  reproduced to 1e-4; m 1, z 20: W2 4.7083 and MdK 22.2941.
- Span m 3, z 24, x 0.4: k 4, W 32.8266 (KHK printed example).
- Ideal pins (external and internal, with shift) touch the flanks at d + 2 x m,
  checked with the independent contact-diameter formula.
- Spline basic dimensions for ANSI 8/16 x 24 and ISO m 2 x 20; spline pins touch at D.
- **Tooth space drawing (0.4.0, `space_view`)**: for ANSI 8/16 x 24, ISO m 2 x 21 (odd),
  ANSI 12/24 x 9 (root below the base circle) and ISO m 1 x 60, external and internal:
  the thickness measured on the drawn profile at the pitch circle is the calculator's
  tooth thickness or space width; the pin centre is where the measurement over or between
  pins puts it (odd tooth counts included); the contact point is half a pin diameter from
  the pin centre, on the pitch circle for the ideal pin, and on the same circle as the
  independent contact-diameter formula; no drawn point is nearer the pin centre than that.
- Trains, Willis (24 / 72 set), change-gear finder (exact 1 : 9 from 20..80 by 5), worm,
  tooth outline symmetry and bounds.

## Single-source or unverified values (warnings)

- **Span m 3, z 24, x 0.4 (W 32.8266)**: the KHK web PDF we could open does not show the
  table; the value matches our formula but rests on one source.
- **Chordal example (m 10, z 12, x 0.3)**: hand check from the KHK formulas only; no
  printed result row read.
- **ANSI B92.1 diameter factors**: one free source (Engineers Edge). The external minor
  diameter rule (N - 1.35)/P is stated there for 2.5/5 to 12/24 pitch only; the screen
  does not give a value for finer pitches.
- **ISO 4156 diameter factors** (Dee = m(z + 1), Dei = m(z + 1.5), Die = m(z - 1.5)):
  one source (the 1981 table in a free preview); the internal minor diameter is not given.
- **Spline measuring pins**: the screen uses pins that touch at the pitch diameter. ANSI
  B92.1 and ISO 4156 list their own pin sizes, which we have not verified from a free
  source; enter the size from your drawing.
- **Internal gear between pins**: formula from KHK and SDP/SI, tested for self-consistency
  only (no published worked value checked).
- **Odd tooth count helical over balls**: transverse formula; the true two-ball reading is
  slightly smaller (FRENCO).
- **Tooth space drawing**: the flanks are the true involute, psi(r) = t / d + inv a - inv a_r
  (the same relation as the over-pins formulas, KHK and SDP/SI). Below the base circle (splines
  of fewer than about 10 teeth) the flank is drawn as a radial line; the real root fillet depends
  on the cutting tool and is not drawn. Where the source gives no minor diameter (ISO internal;
  ANSI external finer than 12/24) the drawing uses m (z - 1) or m (z - 1.35) and says so under
  the picture. The three pin checks (does not touch the involute, sits on the root, does not
  stand proud of the teeth) are our own geometry on the nominal profile, not limits from a
  standard: a real part has fillets, chamfers and tolerances.
- SAE J499a (parallel side splines): no free source found yet; not included.
- Spline fit classes, tolerances and effective/actual space width limits are not included.
