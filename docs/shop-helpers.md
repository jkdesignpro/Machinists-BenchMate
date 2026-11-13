# Shop helpers: sources and decisions

Covers process capability, temperature compensation, coolant
concentration and mixing, the fraction converter and the setup sheet
(`core/src/shop.rs`, `app/shop.js`, entries in `app/tools.js`).
All formulas run in the Rust core and are covered by tests in
`core/src/shop.rs`. Sources accessed 2026-11-10 unless stated.

## Sources

- **[NIST]** NIST/SEMATECH e-Handbook of Statistical Methods (US
  government work, public domain).
  - 6.1.6 "What is process capability?"
    https://www.itl.nist.gov/div898/handbook/pmc/section1/pmc16.htm
    Used for: Cp = (USL - LSL) / 6 sigma; Cpk = min(Cpu, Cpl) with
    Cpu = (USL - mean) / 3 sigma, Cpl = (mean - LSL) / 3 sigma; one-sided
    specs use only Cpu or Cpl; normality assumption; about 50 values as a
    minimum for a usable estimate; table of Cp against expected rejects
    (Cp 1.00: 0.27 %, 1.33: 64 ppm, 1.66: 0.6 ppm), which the tests
    reproduce. The page does not mention Pp/Ppk or within vs overall sigma.
  - 6.3.2.1 "Shewhart X-bar and R and S control charts"
    https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc321.htm
    Used for: sigma estimate = mean range / d2; table of A2 = 3 / (d2 sqrt n)
    for n = 2..10. The page does not print d2 itself; BenchMate's d2 values
    (1.128 ... 3.078) reproduce every printed A2 to the third decimal, which
    a test checks.
- **[MTB]** Minitab support, "Methods and formulas for normal capability
  analysis: methods (standard deviations)".
  https://support.minitab.com/minitab/help-and-how-to/quality-and-process-improvement/capability-analysis/how-to/capability-analysis/normal-capability-analysis/methods-and-formulas/methods
  Used for: overall sigma = sample standard deviation of all values (no
  unbiasing constant by default); within sigma for subgroup size 1 by the
  average moving range of span 2 / d2; for larger subgroups the mean
  subgroup range / d2 is one of the offered estimators (pooled standard
  deviation is another, and appears to be Minitab's default).
- **[NR]** W. H. Press, S. A. Teukolsky, W. T. Vetterling, B. P. Flannery,
  *Numerical Recipes*, 2nd ed., Cambridge University Press, section 6.2:
  Chebyshev approximation of erfc with fractional error below 1.2e-7. The
  coefficients are a published numerical method, not a table of data; the
  tests check erfc(1) and the NIST ppm table.
- **[ISO1]** ISO 1:2022, Geometrical product specifications (GPS) - Standard
  reference temperature for the specification of geometrical and
  dimensional properties. ISO catalogue: edition 4, 2022-06, published.
  https://www.iso.org/standard/80702.html (the catalogue page does not
  print the value; cited by name only).
- **[DOI]** T. Doiron, "20 °C - A short history of the standard reference
  temperature for industrial dimensional measurements", *Journal of
  Research of NIST* 112(1), 2007, pp. 1-23 (public domain).
  https://nvlpubs.nist.gov/nistpubs/jres/112/1/V112.N01.A01.pdf
  Used for: 20 °C adopted by the CIPM in 1931, first ISO standard (ISO 1)
  in 1951; parts and gauges change size with temperature, so measurements
  away from 20 °C need a correction from each material's expansion
  coefficient; the coefficients are uncertain, so the correction adds
  uncertainty; with part and gauge at the same temperature only the
  difference between their coefficients matters.
- **[SP811]** NIST Special Publication 811, Guide for the use of the
  International System of Units, 1991 edition (archived; superseded by the
  2008 edition, which keeps the factor), appendix B: inch to metre
  2.540 000 E-02, marked exact; appendix C: yard redefined in 1959 as
  0.9144 m exactly. https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication811e1991.pdf
- **[FAS]** Fastenal, "Tool Talk: Refractometers" (no date shown).
  https://www.digiedition.fastenal.com/Metalworking/tool-talks/refractometers/?Page=1
  Used for: concentration % = Brix reading x refractometer factor from the
  product data sheet; the factor differs between fluids (example product
  3.4; some read 1:1); divide the needed concentration by the factor to
  choose the refractometer range; add concentrate to water, never the
  reverse; a blurred line suggests replacing the fluid.
- **[ZEB]** Zebra Skimmers Corporation, "Zebra refractometers product
  profile" (no date shown).
  https://res.cloudinary.com/zebra-skimmers-corp/image/upload/v1666796846/Website%20Documents/Refractometer-Profile.pdf
  Used for: if the coolant does not read 1:1 on the Brix scale, get the
  refractometer factor from the coolant supplier and multiply the reading
  by it.

Read but not used: NIST "Approximate conversions from U.S. customary
measures to metric" (lists 2.54 cm per inch but calls all its factors
approximate and points to SP 811 for exact ones).

## Statement check list

| Statement | Sources | Status |
|---|---|---|
| Cp = (USL - LSL) / 6 sigma; Cpk = min of the one-sided indices | NIST 6.1.6, MTB | confirmed |
| One-sided limit: only Cpu or Cpl; Cp undefined | NIST 6.1.6 | one source (follows from the definitions) |
| Pp/Ppk: same formulas with the overall standard deviation; Cp/Cpk with the within sigma | MTB (overall and within estimators) | to be verified (see below) |
| Within sigma (individuals) = mean moving range / 1.128 | MTB, NIST 6.3.2.1 (d2 and A2 table) | confirmed |
| Within sigma (subgroups) = mean range / d2(n) | NIST 6.3.2.1, MTB | confirmed |
| d2 values for n = 2..10 | NIST 6.3.2.1 (via A2), test | confirmed by reproduction of the printed A2 |
| Expected ppm from normal tail areas; Cp 1 centred = 0.27 % | NIST 6.1.6 | confirmed (test) |
| About 50 values needed; normal, stable process assumed | NIST 6.1.6 | one source; shown as advice |
| Reference temperature 20 °C, set by ISO 1 (current edition ISO 1:2022) | DOI (value and history), ISO catalogue (current edition) | confirmed |
| Correction for part and gauge expansion with each coefficient; coefficient uncertainty adds to the measurement uncertainty | DOI; exact ratio form is a BenchMate derivation (tests) | principle from one source; formula derived |
| Concentration % = Brix x refractometer factor; factor from the fluid's data sheet or supplier, differs between fluids | FAS, ZEB | confirmed |
| Add concentrate to water, not water to concentrate | FAS | one source; shown as advice |
| Mixing and top-up formulas | volume mass balance, BenchMate derivation, tests check that the result mixes back to the target | derivation |
| 1 in = 25.4 mm exactly | SP811 (factor marked exact; 1959 yard = 0.9144 m exactly, so 0.9144 / 36 = 0.0254) | national definition; one publication |

## To be verified

The shared web fetch budget was exhausted for most of this round, so
these are still open:

1. **Pp/Ppk naming.** MTB's methods page gives the overall and within
   standard deviations; the Minitab pages that state Pp/Ppk = the Cp/Cpk
   formulas with the overall sigma were not read, and NIST 6.1.6 does not
   mention Pp/Ppk. The usage is standard (AIAG SPC manual, Minitab), but a
   second public source is still to be read. The UI shows both sets with
   the sigma each uses, so the numbers are unambiguous either way.
2. **"About 50 values"** and the normality and stability advice come from
   NIST 6.1.6 only.
3. **Mixing formulas** are a volume mass balance (BenchMate derivation);
   tests check that each result mixes back to the target. No supplier
   page with the same formulas was read. Volume-based mixing assumes the
   concentrate and water volumes simply add.
4. **Thermal expansion coefficients in the material data**: none is
   Confirmed yet, so the picker is empty until the materials research
   confirms one.

## Decisions

- **Indices are labelled by the sigma they use.** With measurements,
  BenchMate shows Cp/Cpk (within sigma) and Pp/Ppk (overall sigma) side by
  side. With an entered mean and sigma it shows one set and says that they
  are Cp/Cpk or Pp/Ppk depending on which sigma was entered.
- **Within sigma for subgroups uses the mean range / d2**, not the pooled
  standard deviation, so it can be checked by hand. Subgroups are
  consecutive values; an incomplete last subgroup is left out and the
  screen says so.
- **No unbiasing constant (c4) on the overall sigma**, as in Minitab's
  default.
- **Histogram bins: Sturges' rule** (ceil(log2 n) + 1). Display only.
- **The 1.33 "minimum"** is shown as a common rule of thumb, not a rule;
  the customer's requirement governs.
- **Expansion coefficients have no defaults.** The temperature screen
  offers only values with status Confirmed in the material data (two or
  more independent publishers printing the same value). At the time of
  writing none of the 72 thermal expansion entries is Confirmed (they
  differ slightly between publishers, or have one publisher), so the
  picker says so and the user enters the coefficient from the data sheet.
- **Temperature formula is the exact ratio**, L20 = reading x (1 + a_g dT_g)
  / (1 + a_p dT_p), not the linearised form; the difference is far below
  any shop measurement, but the inverse is then exact.
- **Refractometer factor is never defaulted**; without it the screen asks
  for it and shows no concentration.
- **Concentrate strength defaults to 100 %** (neat concentrate), which is a
  definition, not a fluid property; it can be changed for pre-diluted
  stock.
- **Fraction converter**: a plain number is read in the unit selected on
  the top bar, and the screen says which way it read it.
- **Setup sheets are stored in the browser** (localStorage key
  `bm.setups`) and exported as `{ "benchmate_setup": 1, "sheet": {...} }`.
  Import adds a new sheet; it never overwrites one.
- **Operations on a setup sheet** (0.7.0) are kept in the sheet's `ops`
  list (number, what is done, holding, tools, speed, feed, check). Sheets
  and files from before 0.7.0 have none and open with an empty list. Nothing
  on the sheet is calculated.
