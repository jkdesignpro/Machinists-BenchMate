//! Inspection round 2: ISO 286 above 500 mm and the j/J classes, ANSI B4.1
//! inch fits, preferred numbers (ISO 3 Renard series), control charts
//! (X-bar/R and individuals/moving range) and single sampling plan OC curves.
//!
//! Sources (see docs/inspection.md and docs/sources.md):
//! * [ISO286] ISO 286-1:2010 (Cor 1:2013), annex formulas for sizes over 500
//!   to 3150 mm (cited by name; the standard text was not read). Checked
//!   value by value against the IT table printed by Wikipedia ("IT Grade") and
//!   the shaft deviations of GOST 25346-89 Table 2 (tests below).
//! * [B41] ANSI B4.1-1967 (R1999, R2004 reaffirmations), preferred limits and
//!   fits for cylindrical parts: values in thousandths of an inch. The tables
//!   are data (data/refdata/ansi-fits-evidence.json); this file only does the
//!   arithmetic of a fit.
//! * [ISO3] ISO 3:1973 preferred numbers: theoretical value 10^(i/R). The
//!   rounded series values are data (data/refdata/preferred-evidence.json).
//! * [NIST] NIST/SEMATECH e-Handbook of Statistical Methods, 6.3.2.1 (X-bar
//!   and R charts: A2 = 3 / (d2 sqrt n), D3 = 1 - 3 d3/d2, D4 = 1 + 3 d3/d2,
//!   table for n = 2 to 10) and 6.3.2.2 (individuals chart: x-bar +/- 3 MR-bar
//!   / 1.128, worked flow-rate example). [YORK] University of York, Department
//!   of Mathematics, "Factors useful in the construction of control charts"
//!   (second table, same constants; differs from NIST in the last digit for a
//!   few D3/D4 values).
//! * d2 and d3 are also computed here from their definitions (expected value
//!   and standard deviation of the range of n standard normal values) by
//!   numerical integration, so both printed tables can be checked.
//! * Sampling: probability of acceptance of a single sampling plan (n, c) is
//!   the binomial (or Poisson) cumulative probability of c or fewer defectives.

use crate::shop::erfc;

// ---------------------------------------------------------------------------
// ISO 286 over 500 mm

/// Standard tolerance unit for sizes over 500 mm, um: I = 0.004 D + 2.1, D the
/// geometric mean of the size step in mm [ISO286].
pub fn iso286_tolerance_unit_large(d_mean: f64) -> f64 { 0.004 * d_mean + 2.1 }

/// Multiplier of I for IT1 to IT18 over 500 mm [ISO286]: IT1 = 2 I, IT2 = 2.7 I,
/// IT3 = 3.7 I, IT4 = 5 I, then the same multipliers as below 500 mm (IT5 = 7 I
/// ... IT18 = 2500 I).
pub fn iso286_it_multiplier_large(grade: u32) -> f64 {
    const M: [f64; 18] = [2.0, 2.7, 3.7, 5.0, 7.0, 10.0, 16.0, 25.0, 40.0, 64.0, 100.0, 160.0, 250.0, 400.0, 640.0, 1000.0, 1600.0, 2500.0];
    if (1..=18).contains(&grade) { M[(grade - 1) as usize] } else { f64::NAN }
}

/// Unrounded IT value over 500 mm, um. IT01 and IT0 are not defined there.
pub fn iso286_it_formula_large(d_mean: f64, grade: u32) -> f64 {
    iso286_it_multiplier_large(grade) * iso286_tolerance_unit_large(d_mean)
}

/// Unrounded shaft fundamental deviation over 500 mm, um, from the annex
/// formulas [ISO286]. D = geometric mean of the size step (main step for d to
/// p, intermediate step for r to u). `it7` = IT7 of the main step, `p_dev` =
/// fundamental deviation of p on the main step (for r = sqrt(p s)).
/// d = -16 D^0.44, e = -11 D^0.41, f = -5.5 D^0.41, g = -2.5 D^0.34, h = 0,
/// k = 0, m = 0.024 D + 12.6, n = 0.04 D + 21, p = 0.072 D + 37.8,
/// r = sqrt(p s), s = IT7 + 0.4 D, t = IT7 + 0.63 D, u = IT7 + D.
/// Letter codes as [`crate::fits::LETTERS`]; NaN for letters ISO 286-1 does
/// not define above 500 mm.
pub fn iso286_shaft_fd_formula_large(letter: u32, d: f64, it7: f64, p_dev: f64) -> f64 {
    let s = it7 + 0.4 * d;
    match letter {
        5 => -16.0 * d.powf(0.44),
        6 => -11.0 * d.powf(0.41),
        8 => -5.5 * d.powf(0.41),
        10 => -2.5 * d.powf(0.34),
        11 | 13 => 0.0,
        14 => 0.024 * d + 12.6,
        15 => 0.04 * d + 21.0,
        16 => 0.072 * d + 37.8,
        17 => (p_dev * s).sqrt(),
        18 => s,
        19 => it7 + 0.63 * d,
        20 => it7 + d,
        _ => f64::NAN,
    }
}

/// Limits of a j shaft or J hole class, um: (upper, lower). ISO 286 tabulates
/// j5, j6, j7 (shafts, lower deviation ei) and J6, J7, J8 (holes, upper
/// deviation ES) per class; there is no formula. Shaft: es = ei + IT;
/// hole: EI = ES - IT. `dev` is ei for a shaft, ES for a hole.
pub fn iso286_j_limits(dev: f64, it: f64, hole: bool) -> (f64, f64) {
    if hole { (dev, dev - it) } else { (dev + it, dev) }
}

/// f64 interface: `hole` 1 for J, 0 for j; `which` 0 upper, 1 lower.
pub fn iso286_j_limit_f(dev: f64, it: f64, hole: f64, which: f64) -> f64 {
    let (u, l) = iso286_j_limits(dev, it, hole > 0.5);
    if which > 0.5 { l } else { u }
}

/// f64 interface for [`iso286_shaft_fd_formula_large`].
pub fn iso286_shaft_fd_formula_large_f(letter: f64, d: f64, it7: f64, p_dev: f64) -> f64 {
    iso286_shaft_fd_formula_large(letter as u32, d, it7, p_dev)
}

/// f64 interface for [`iso286_it_formula_large`].
pub fn iso286_it_formula_large_f(d_mean: f64, grade: f64) -> f64 { iso286_it_formula_large(d_mean, grade as u32) }

// ---------------------------------------------------------------------------
// ANSI B4.1 fits

/// The fit of an ANSI B4.1 class from its hole and shaft limits (thousandths
/// of an inch, as the tables print them) [B41]. `interference_print`: LN and FN
/// tables print limits of interference (min, max); RC, LC and LT tables print
/// limits of clearance (min, max), a minus sign meaning interference.
/// `which`: 0 first printed limit, 1 second printed limit, 2 maximum clearance
/// (hole upper - shaft lower), 3 minimum clearance (hole lower - shaft upper;
/// negative = interference), 4 fit type (1 clearance, 2 transition, 3 interference).
pub fn ansi_fit_f(interference_print: f64, hole_plus: f64, hole_minus: f64, shaft_plus: f64, shaft_minus: f64, which: f64) -> f64 {
    let (max_c, min_c) = crate::fits::iso286_fit(hole_plus, hole_minus, shaft_plus, shaft_minus);
    let (a, b) = if interference_print > 0.5 { (-max_c, -min_c) } else { (min_c, max_c) };
    match which as i32 {
        0 => a, 1 => b, 2 => max_c, 3 => min_c, 4 => crate::fits::iso286_fit_type(max_c, min_c),
        _ => f64::NAN,
    }
}

// ---------------------------------------------------------------------------
// Preferred numbers (ISO 3)

/// Theoretical value of term `i` of the Renard series R`r` (r = 5, 10, 20, 40,
/// 80): 10^(i / r) [ISO3]. Term 0 is 1; term r is 10.
pub fn renard_theoretical(r: f64, i: f64) -> f64 {
    if !(r > 0.0) { return f64::NAN; }
    10f64.powf(i / r)
}

/// Fractional term number of `x` in the series R`r`: r log10(x). Round it to
/// get the nearest term (nearest in ratio, not in difference).
pub fn renard_index(r: f64, x: f64) -> f64 {
    if !(r > 0.0 && x > 0.0) { return f64::NAN; }
    r * x.log10()
}

// ---------------------------------------------------------------------------
// Control charts

fn phi(x: f64) -> f64 { 0.5 * erfc(-x / std::f64::consts::SQRT_2) }

const GRID_LO: f64 = -8.0;
const GRID_HI: f64 = 8.0;

/// d2(n): expected range of n independent standard normal values,
/// d2 = integral of [1 - Phi(x)^n - (1 - Phi(x))^n] dx (definition of the
/// mean range; Simpson's rule on -8..8, step 0.005).
pub fn range_d2(n: u32) -> f64 {
    if n < 2 { return f64::NAN; }
    let m = 3200; // even
    let h = (GRID_HI - GRID_LO) / m as f64;
    let mut s = 0.0;
    for k in 0..=m {
        let x = GRID_LO + k as f64 * h;
        let p = phi(x);
        let f = 1.0 - p.powi(n as i32) - (1.0 - p).powi(n as i32);
        let w = if k == 0 || k == m { 1.0 } else if k % 2 == 1 { 4.0 } else { 2.0 };
        s += w * f;
    }
    s * h / 3.0
}

/// d3(n): standard deviation of the range of n standard normal values.
/// E[W^2] = 2 double integral over x < y of
/// [1 - Phi(y)^n - (1 - Phi(x))^n + (Phi(y) - Phi(x))^n] dx dy
/// (from W^2 = 2 double integral over min <= x < y < max), d3 = sqrt(E[W^2] - d2^2).
/// Trapezoidal rule on the triangle, step 0.01 (check: n = 2 gives
/// sqrt(2 - 4/pi) = 0.85250 to 5 digits, see tests).
pub fn range_d3(n: u32) -> f64 {
    if n < 2 { return f64::NAN; }
    let m = 1600;
    let h = (GRID_HI - GRID_LO) / m as f64;
    let ni = n as i32;
    let p: Vec<f64> = (0..=m).map(|k| phi(GRID_LO + k as f64 * h)).collect();
    let mut s = 0.0;
    for j in 0..=m {
        let fy = p[j].powi(ni);
        let wy = if j == 0 || j == m { 0.5 } else { 1.0 };
        for i in 0..=j {
            let wx = if i == 0 { 0.5 } else { 1.0 } * if i == j { 0.5 } else { 1.0 };
            let f = 1.0 - fy - (1.0 - p[i]).powi(ni) + (p[j] - p[i]).powi(ni);
            s += wx * wy * f;
        }
    }
    let ew2 = 2.0 * s * h * h;
    let d2 = range_d2(n);
    (ew2 - d2 * d2).max(0.0).sqrt()
}

/// Control chart constants from d2 and d3 [NIST 6.3.2.1]: `which` 0 d2, 1 d3,
/// 2 A2 = 3 / (d2 sqrt n), 3 D3 = max(0, 1 - 3 d3 / d2), 4 D4 = 1 + 3 d3 / d2,
/// 5 E2 = 3 / d2 (individuals chart factor for moving ranges of n values).
pub fn spc_constant_computed(n: u32, which: u32) -> f64 {
    let d2 = range_d2(n);
    match which {
        0 => d2,
        1 => range_d3(n),
        2 => 3.0 / (d2 * (n as f64).sqrt()),
        3 => (1.0 - 3.0 * range_d3(n) / d2).max(0.0),
        4 => 1.0 + 3.0 * range_d3(n) / d2,
        5 => 3.0 / d2,
        _ => f64::NAN,
    }
}

/// f64 interface for [`spc_constant_computed`].
pub fn spc_constant_computed_f(n: f64, which: f64) -> f64 { spc_constant_computed(n as u32, which as u32) }

/// Published three-decimal constants as NIST e-Handbook 6.3.2.1 prints them
/// (n = 2..10): `which` 2 A2, 3 D3, 4 D4. These are the values the limits
/// below use, so that results match hand calculations from the table.
pub fn spc_constant_table(n: u32, which: u32) -> f64 {
    const A2: [f64; 9] = [1.880, 1.023, 0.729, 0.577, 0.483, 0.419, 0.373, 0.337, 0.308];
    const D3: [f64; 9] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.076, 0.136, 0.184, 0.223];
    const D4: [f64; 9] = [3.267, 2.575, 2.282, 2.115, 2.004, 1.924, 1.864, 1.816, 1.777];
    if !(2..=10).contains(&n) { return f64::NAN; }
    let k = (n - 2) as usize;
    match which { 0 => crate::shop::d2(n as usize), 2 => A2[k], 3 => D3[k], 4 => D4[k], _ => f64::NAN }
}

/// f64 interface for [`spc_constant_table`].
pub fn spc_constant_table_f(n: f64, which: f64) -> f64 { spc_constant_table(n as u32, which as u32) }

/// X-bar and R chart from consecutive subgroups of size `sg` (2..=10) of `xs`
/// in production order; a last incomplete subgroup is not used [NIST 6.3.2.1]:
/// X-bar chart: grand mean +/- A2 R-bar; R chart: D3 R-bar and D4 R-bar.
/// `which`: 0 number of subgroups k, 1 grand mean, 2 R-bar, 3 UCL x-bar,
/// 4 LCL x-bar, 5 UCL R, 6 LCL R, 7 sigma estimate R-bar / d2;
/// 10000 + i: mean of subgroup i; 20000 + i: range of subgroup i.
pub fn spc_xbar_r(xs: &[f64], sg: usize, which: u32) -> f64 {
    if !(2..=10).contains(&sg) { return f64::NAN; }
    let k = xs.len() / sg;
    if k == 0 { return f64::NAN; }
    let groups: Vec<&[f64]> = (0..k).map(|i| &xs[i * sg..(i + 1) * sg]).collect();
    let mean = |g: &[f64]| g.iter().sum::<f64>() / g.len() as f64;
    let range = |g: &[f64]| g.iter().cloned().fold(f64::NEG_INFINITY, f64::max) - g.iter().cloned().fold(f64::INFINITY, f64::min);
    if which >= 20000 { return groups.get((which - 20000) as usize).map(|g| range(g)).unwrap_or(f64::NAN); }
    if which >= 10000 { return groups.get((which - 10000) as usize).map(|g| mean(g)).unwrap_or(f64::NAN); }
    let xbb = groups.iter().map(|g| mean(g)).sum::<f64>() / k as f64;
    let rbar = groups.iter().map(|g| range(g)).sum::<f64>() / k as f64;
    let n = sg as u32;
    match which {
        0 => k as f64, 1 => xbb, 2 => rbar,
        3 => xbb + spc_constant_table(n, 2) * rbar, 4 => xbb - spc_constant_table(n, 2) * rbar,
        5 => spc_constant_table(n, 4) * rbar, 6 => spc_constant_table(n, 3) * rbar,
        7 => rbar / crate::shop::d2(sg),
        _ => f64::NAN,
    }
}

/// Individuals and moving range chart (moving range of 2 consecutive values)
/// [NIST 6.3.2.2]: centre x-bar, limits x-bar +/- 3 MR-bar / 1.128; MR chart
/// UCL = D4(2) MR-bar = 3.267 MR-bar, LCL = 0.
/// `which`: 0 n, 1 mean, 2 MR-bar, 3 UCL x, 4 LCL x, 5 UCL MR, 6 LCL MR,
/// 7 sigma estimate MR-bar / 1.128; 10000 + i: value i; 20000 + i: MR i (i >= 1).
pub fn spc_imr(xs: &[f64], which: u32) -> f64 {
    let n = xs.len();
    if n < 2 { return f64::NAN; }
    if which >= 20000 {
        let i = (which - 20000) as usize;
        return if i >= 1 && i < n { (xs[i] - xs[i - 1]).abs() } else { f64::NAN };
    }
    if which >= 10000 { return xs.get((which - 10000) as usize).copied().unwrap_or(f64::NAN); }
    let mean = xs.iter().sum::<f64>() / n as f64;
    let mr = xs.windows(2).map(|w| (w[1] - w[0]).abs()).sum::<f64>() / (n - 1) as f64;
    let d2 = crate::shop::d2(2);
    match which {
        0 => n as f64, 1 => mean, 2 => mr,
        3 => mean + 3.0 * mr / d2, 4 => mean - 3.0 * mr / d2,
        5 => spc_constant_table(2, 4) * mr, 6 => 0.0, 7 => mr / d2,
        _ => f64::NAN,
    }
}

// ---------------------------------------------------------------------------
// Single sampling plans

/// Probability of accepting a lot with fraction defective `p` under the plan
/// "inspect n, accept with c or fewer defectives", binomial model (large lot):
/// Pa = sum over k = 0..c of C(n, k) p^k (1 - p)^(n - k).
pub fn sampling_pa_binomial(n: u32, c: u32, p: f64) -> f64 {
    if !(0.0..=1.0).contains(&p) { return f64::NAN; }
    if c >= n { return 1.0; }
    if p == 0.0 { return 1.0; }
    if p == 1.0 { return 0.0; }
    // log of the k = 0 term, then the ratio term(k+1)/term(k) = (n-k)/(k+1) * p/(1-p)
    let mut lt = n as f64 * (1.0 - p).ln();
    let r = (p / (1.0 - p)).ln();
    let mut s = lt.exp();
    for k in 0..c {
        lt += ((n - k) as f64 / (k + 1) as f64).ln() + r;
        s += lt.exp();
    }
    s.min(1.0)
}

/// Same with the Poisson approximation, lambda = n p:
/// Pa = sum over k = 0..c of e^-lambda lambda^k / k!.
pub fn sampling_pa_poisson(n: u32, c: u32, p: f64) -> f64 {
    if !(p >= 0.0) { return f64::NAN; }
    let lam = n as f64 * p;
    let mut t = (-lam).exp();
    let mut s = t;
    for k in 0..c { t *= lam / (k + 1) as f64; s += t; }
    s.min(1.0)
}

/// Average outgoing quality with rectifying inspection (rejected lots are
/// 100 % inspected and defectives replaced): AOQ = p Pa (N - n) / N, lot size N.
pub fn sampling_aoq(n: u32, c: u32, p: f64, lot: f64) -> f64 {
    if !(lot >= n as f64) { return f64::NAN; }
    p * sampling_pa_binomial(n, c, p) * (lot - n as f64) / lot
}

/// f64 interface: `which` 0 Pa binomial, 1 Pa Poisson, 2 AOQ (binomial).
pub fn sampling_f(n: f64, c: f64, p: f64, lot: f64, which: f64) -> f64 {
    if !(n >= 1.0 && c >= 0.0) { return f64::NAN; }
    let (n, c) = (n as u32, c as u32);
    match which as i32 { 0 => sampling_pa_binomial(n, c, p), 1 => sampling_pa_poisson(n, c, p), 2 => sampling_aoq(n, c, p, lot), _ => f64::NAN }
}

#[cfg(test)]
mod tests;
