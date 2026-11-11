# Inspection round 2 (parity batch B5)

What was added on `claude/inspection-2`, where each number comes from, how it
was checked, and what is still single-source. Code: `core/src/inspect.rs`
(tests in `core/src/inspect/tests.rs`), `core/src/fits.rs` (delta rule),
`app/inspect.js`, `app/refdata.js` (ISO fits screen), `scripts/build_refdata.py`
(`build_ansi_fits`, `build_preferred`, `build_iso286`), evidence in
`data/refdata/ansi-fits-evidence.json`, `preferred-evidence.json` and
`iso286-evidence.json`.

All web pages were read on 2026-11-11 with a text-extraction tool. Book tables
were not used. Values are stored per publisher exactly as transcribed;
where a transcription does not add up it is kept and flagged, never corrected
silently.

## Already present before this batch (checked, not rebuilt)

- ISO 2768-1 general tolerances (`gentol`) and the micrometer and vernier
  reading aid (`scales`, our own scale drawings): built on
  `claude/measure-maths`. The "how to read" reference asked for in B5 is
  covered by `scales`, so nothing new was added for it.
- `capability` already gives Cp, Cpk, Pp, Ppk; it had no control charts.
- ISO 286 fits up to 500 mm with js; no j/J and nothing over 500 mm.

## 1. ANSI B4.1 inch fits (`ansifits`)

**Standard:** ANSI B4.1-1967, Preferred Limits and Fits for Cylindrical
Parts, reaffirmed R1999 and R2004 (cited by name; its status today was not
confirmed). Values are deviations in thousandths of an inch for size ranges
from 0 to 19.69 in (the standard goes on to 200 in; those rows were not read).

**Classes and symbols** (AmesWeb): RC1 H5/g4, RC2 H6/g5, RC3 H7/f6, RC4 H8/f7,
RC5 H8/e7, RC6 H9/e8, RC7 H9/d8, RC8 H10/c9, RC9 H11/-; LC1 H6/h5, LC2 H7/h6,
LC3 H8/h7, LC4 H10/h9, LC5 H7/g6, LC6 H9/f8, LC7 H10/e9, LC8 H10/d9, LC9
H11/c10, LC10 H12/-, LC11 H13/-; LT1 H7/js6, LT2 H8/js7, LT3 H7/k6, LT4 H8/k7,
LT5 H7/n6, LT6 H7/n7; LN1 H6/n5, LN2 H7/p6, LN3 H7/r6; FN1 H6/-, FN2 H7/s6,
FN3 H7/t6, FN4 H7/u6, FN5 H8/x7 ("-": no shaft symbol in the standard).

**Structure used for checking.** Every class is hole basis (hole lower
deviation 0). Hole tolerance = the standard tolerance of its grade in that
size range, so every class with the same hole grade (H7 is used by twelve classes)
must show the same hole tolerance, and likewise for shaft grades. The printed
limits of clearance or interference must equal hole upper - shaft lower and
hole lower - shaft upper. `build_ansi_fits` runs both checks on every row of
every publisher.

**Sources read**

| Key | Publisher | What it gives |
|---|---|---|
| KSU | King Saud University course material, "fits_us_tables_ansi_b4.1-1967_r1987.pdf" | Full Tables 3 to 9: RC1-RC9, LC1-LC11, LT1-LT6, LN1-LN3, FN1-FN5, 0 to 19.69 in (FN on its finer size breaks) |
| EE | Engineers Edge, "Standard Preferred Tolerance Limits Fits ANSI B4.1" | One worked example: RC5 at 2 in (hole +1.8/0, shaft -2.5/-3.7, clearance 2.5 to 5.5) |
| AMES | AmesWeb, ANSI preferred tolerances and fits charts | Class symbols and descriptions, no values |

**Second source not found.** Engineers Edge's and AmesWeb's fit calculators
compute on the server, so their tables could not be read; a University of
Florida slide deck, a Bureau of Standards publication and a Scribd copy had no
readable values. Result:

- **Confirmed by two publishers:** 1 row of 492 (RC5, 1.97 to 3.15 in; all six
  cells agree).
- **Needs 2nd source:** the other 491 rows, all 34 classes. The screen marks
  them "One source, needs 2nd source".
- **Internal checks:** 487 rows pass both checks. 5 rows fail the arithmetic
  check as transcribed and are shown with a warning:
  RC3 0.12-0.24 (printed max clearance 1.12, limits give 1.2),
  LC6 1.97-3.15 (printed min clearance 1.2, limits give 1.0),
  LC8 0-0.12 (printed max clearance 2.0, limits give 3.6),
  LC8 1.19-1.97 (printed min clearance 3.6, limits give 3.0),
  LT1 9.85-12.41 (shaft lower printed -6.6; with -0.6 the row adds up).
  Each is most likely a misprint or a text-extraction slip; which number is
  wrong is not decided here.
- **Grade checks:** no row fails: every hole and shaft grade has one tolerance
  per size range across all classes that use it.
- **Placement correction (KSU).** Text extraction drops blank cells. For 0 to
  0.24 in, LT3 and LT4 are blank and the values first landed in LT3/LT5; for
  0 to 0.95 in, FN3 is blank and its neighbours shifted. The values were put
  back in the class whose hole and shaft grades they fit (LT5 H7/n6, LT6
  H7/n7, FN4 H7/u6: the tolerance of each limit pair equals that grade's
  tolerance in the same size range in the rest of the table). The evidence
  file's source note says so.

## 2. ISO 286: j/J classes and sizes over 500 mm (`fits`)

**Standard:** ISO 286-1:2010 (with Cor 1:2013) and ISO 286-2:2010, by name.

**j and J** are tabulated per class (ISO 286-2), with no formula: shafts j5,
j6, j7 (lower deviation ei; es = ei + IT), holes J6, J7, J8 (upper deviation
ES; EI = ES - IT). Not defined above 500 mm.

| Values | Sources | Result |
|---|---|---|
| j5, j6, j7 over 3 to 400 mm | Simply Bearings (limits), RoyMech (compared, not republished) | 27 cells confirmed; j5 and j6 over 18 to 80 mm (6 cells) differ: Simply Bearings -4, -5, -7, RoyMech as transcribed -3, -4, -5. Simply Bearings' upper limits satisfy es - ei = IT, and RoyMech's sub-step values look shifted by one row, but both are shown |
| j5, j6, j7 over 0 to 3 and 400 to 500 mm | RoyMech only | 6 cells, one source |
| J6, J7, J8 over 3 to 400 mm | Simply Bearings, GOST 25346-89 Table 3 | 33 cells confirmed |
| J6, J7, J8 over 0 to 3 and 400 to 500 mm | GOST 25346 only | 6 cells, one source |

Simply Bearings' extracted rows had wrong size labels (the page leaves rows
blank); they were placed on the main steps 3-6 ... 315-400 using upper -
lower = IT of the grade, which every row then satisfies.

**Over 500 to 3150 mm.** ISO 286-1 gives formulas for this range:

- standard tolerance unit I = 0.004 D + 2.1 (um), D the geometric mean of the
  size step in mm; IT1 = 2 I, IT2 = 2.7 I, IT3 = 3.7 I, IT4 = 5 I, IT5 = 7 I,
  IT6 = 10 I, IT7 = 16 I, IT8 = 25 I, IT9 = 40 I, IT10 = 64 I, IT11 = 100 I,
  ... IT18 = 2500 I (IT01 and IT0 not defined);
- shafts: d = -16 D^0.44, e = -11 D^0.41, f = -5.5 D^0.41, g = -2.5 D^0.34,
  h = 0, js, k = 0, m = 0.024 D + 12.6, n = 0.04 D + 21, p = 0.072 D + 37.8,
  r = sqrt(p s), s = IT7 + 0.4 D, t = IT7 + 0.63 D, u = IT7 + D (r to u on the
  intermediate steps); other letters are not defined;
- holes: general rule, no delta (ES = -ei for K to U, K = 0).

Worked check (500 to 630 mm): D = sqrt(500 x 630) = 561.2 mm, I = 4.345 um,
IT7 = 16 I = 69.5 -> table 70; d = -16 x 561.2^0.44 = -259.3 -> table -260;
m = 26.1 -> table 26.

The values used are the tabulated ones: IT from Wikipedia ("IT Grade", all
144 cells over 500 mm) and shaft deviations from GOST 25346-89 Table 2 (120
cells). Only one table each was read (Ganter's DIN ISO 286 extract stops at
500 mm), so the screen marks them "One table, formula agrees": the core tests
(`iso286_large_*`) check that every printed value is within 7 % (IT) and 6 %
(deviations) of the formula, the remainder being the standard's rounding to
preferred-like numbers. The hole rule is checked against GOST 25346 Table 3
(M -26, N -44, P -78, R -150, S -280, T -400 at 500 to 560 mm). Holes K, M
and N above 500 mm are shown only up to IT8 (the only grade column that could
be read); hole U above 500 mm follows the general rule (its table column was
not read).

GOST printing notes: d over 630 to 710 mm printed "290" without the minus
sign (recorded as -290), u over 500 to 560 printed "*+*600" (recorded as 600).

## 3. Preferred numbers (`prefnum`)

**Standard:** ISO 3:1973, Preferred numbers, series of preferred numbers
(iTeh catalogue: first edition 1973-04; SIST ISO 3:1995 identical); ISO 17 and
ISO 497 (1973) give guidance and the more rounded series (not covered).

Theoretical term i of series R is 10^(i/R). The published values are rounded
to three figures but not always to the nearest (3.15 for 3.162, 1.18 for
1.189; 3.00 and 6.00 in R40 chosen as rounder numbers), so they are data, not
computed. The screen shows both and the percentage difference.

| Series | Sources | Result |
|---|---|---|
| R5, R10, R20 | iTeh preview of ISO 3:1973 (OCR text), Wikipedia "Renard series" (R40 column contains every R20/R10/R5 value at its nested position) | 35 values, all confirmed |
| R40, the 20 values not in R20 | Wikipedia only (the iTeh R40 column was not legible) | 20 values, needs 2nd source |
| R80, the 40 values not in R40 | Wikipedia only | 40 values, needs 2nd source |

Wikipedia's "Preferred number" article (same publisher) also prints R5 and is
not counted again.

## 4. Micrometer and vernier reading

Already covered by `scales` (our own drawings of the scales and a breakdown of
the reading; no quiz or game). Nothing new.

## 5. Control charts (`ctrlchart`)

Individuals and moving range (moving range of 2), and X-bar and R for
subgroups of 2 to 10 in production order. Only rule 1 (a point beyond a
control limit) is marked.

- Individuals: x-bar +/- 3 MR-bar / 1.128; MR chart UCL = 3.267 MR-bar, LCL 0
  (NIST e-Handbook 6.3.2.2; D4 for n = 2 from 6.3.2.1).
- X-bar: grand mean +/- A2 R-bar; R chart D3 R-bar to D4 R-bar; A2 = 3 / (d2
  sqrt n), D3 = 1 - 3 d3/d2, D4 = 1 + 3 d3/d2 (NIST 6.3.2.1).
- The limits use the three-decimal NIST table, so results match hand
  calculations. NIST's worked example (flow rate, 10 batches: mean 50.81,
  MR-bar 1.8778, UCL 55.8041, LCL 45.8159) is reproduced in the core tests.

**Constants checked three ways:** NIST table (A2, D3, D4), the University of
York table (A2, D3, D4, d2, d3 and more), and BenchMate's own computation of
d2 and d3 from their definitions (expected value and standard deviation of the
range of n standard normal values, by numerical integration; n = 2 checked
against the closed form d2 = 2/sqrt(pi), d3 = sqrt(2 - 4/pi)).

| n | A2 | D3 NIST / York | D4 NIST / York | computed D3, D4 |
|---|---|---|---|---|
| 2 | 1.880 both | 0 | 3.267 / 3.266 | 0, 3.26656 |
| 3 | 1.023 both | 0 | 2.575 / 2.574 | 0, 2.57461 |
| 4 | 0.729 both | 0 | 2.282 / 2.281 | 0, 2.28207 |
| 5 | 0.577 both | 0 | 2.115 / 2.114 | 0, 2.11451 |
| 6 | 0.483 both | 0 | 2.004 / 2.003 | 0, 2.00384 |
| 7 | 0.419 both | 0.076 both | 1.924 both | 0.07570, 1.92430 |
| 8 | 0.373 both | 0.136 / 0.137 | 1.864 / 1.863 | 0.13616, 1.86384 |
| 9 | 0.337 both | 0.184 both | 1.816 both | 0.18400, 1.81600 |
| 10 | 0.308 both | 0.223 both | 1.777 both | 0.22301, 1.77699 |

A2 agrees everywhere. Where the two tables differ in the last digit, the
computed value rounds to NIST's (York appears to truncate); the screen shows
the York value with a "differs" mark. Cp/Cpk stay in `capability`.

## 6. Sampling (`sampling`)

ISO 2859-1 and ANSI/ASQ Z1.4 plans come from copyrighted tables (sample size
code letters by lot size and inspection level, then n and acceptance numbers by
AQL), so those tables are **not included**. Instead the screen explains, in
our own words, how the schemes choose a plan (AQL, inspection levels I, II,
III and S-1 to S-4, code letters, normal, tightened and reduced inspection and
the switching rules) and evaluates any single sampling plan the user enters:

- probability of acceptance, binomial Pa = sum_{k=0..c} C(n,k) p^k (1-p)^(n-k),
  and the Poisson approximation with lambda = n p;
- AOQ = p Pa (N - n) / N for rectifying inspection, and its maximum (AOQL);
- the defective levels accepted 95 % and 10 % of the time;
- the OC curve.

Sources: the binomial and Poisson distributions and the AOQ relation as in the
NIST/SEMATECH e-Handbook 6.2.3 (cited by name, not re-read in this batch);
ISO 2859-1:1999 and ANSI/ASQ Z1.4-2003 by name only (current editions not
re-checked). Tests check the binomial sum against a direct evaluation, the
c = 0 closed form and the Poisson sum.

## Not done in this batch

- ANSI B4.1 above 19.69 in, and a second full source for ANSI B4.1 (see 1).
- ISO 286 j8 (only tabulated for the smallest sizes), and hole K, M, N above
  IT8 over 500 mm.
- Run rules (Western Electric, Nelson) on the control charts; s charts.
- ISO 2859-1 / Z1.4 code letter and plan tables (copyright; not included).
- Thread gauges, measurement over pins for a radius (other B5 items, not in
  this round's scope).
