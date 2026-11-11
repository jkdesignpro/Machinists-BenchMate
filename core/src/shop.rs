//! Shop-floor helpers: process capability, temperature compensation of
//! measurements, coolant concentration, and inch fractions.
//!
//! Sources (see docs/shop-helpers.md for URLs and access dates):
//! * [NIST] NIST/SEMATECH e-Handbook of Statistical Methods (public domain):
//!   6.1.6 process capability (Cp, Cpk, Cpu, Cpl), 6.3.2.1 control chart
//!   constants (mean range / d2, A2 table).
//! * [MTB] Minitab support, "Methods and formulas for normal capability
//!   analysis" (within and overall sigma).
//! * [NR] W. H. Press et al., Numerical Recipes, 2nd ed., section 6.2
//!   (complementary error function, Chebyshev fit, fractional error < 1.2e-7).
//! * [ISO1] ISO 1:2022, standard reference temperature 20 C (cited only).
//! * [DOI] T. Doiron, "20 C - A short history of the standard reference
//!   temperature for industrial dimensional measurements", J. Res. NIST 112(1),
//!   2007 (public domain).
//! * [SP811] NIST SP 811, appendix B: 1 in = 0.0254 m exactly.
//! * [FAS] Fastenal Tool Talk, [ZEB] Zebra Skimmers: concentration = Brix x factor.

/// Sample mean.
pub fn cap_mean(xs: &[f64]) -> f64 {
    if xs.is_empty() { return f64::NAN; }
    xs.iter().sum::<f64>() / xs.len() as f64
}

/// Overall (long-term) sample standard deviation, divisor n - 1. [MTB]
pub fn cap_sigma_overall(xs: &[f64]) -> f64 {
    let n = xs.len();
    if n < 2 { return f64::NAN; }
    let m = cap_mean(xs);
    (xs.iter().map(|x| (x - m) * (x - m)).sum::<f64>() / (n - 1) as f64).sqrt()
}

/// Control chart constant d2 for subgroup size n = 2..=10 (expected range of
/// n normal values in units of sigma). [NIST 6.3.2.1] (checked against its A2 table), [MTB]
pub fn d2(n: usize) -> f64 {
    const T: [f64; 9] = [1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.970, 3.078];
    if (2..=10).contains(&n) { T[n - 2] } else { f64::NAN }
}

/// Within (short-term) sigma.
/// * `subgroup` = 1: average moving range of consecutive values / d2(2).
/// * `subgroup` = 2..=10: consecutive subgroups of that size, mean range / d2(k);
///   an incomplete last subgroup is ignored.
///
/// [NIST 6.3.2.1], [MTB]
pub fn cap_sigma_within(xs: &[f64], subgroup: usize) -> f64 {
    if subgroup <= 1 {
        if xs.len() < 2 { return f64::NAN; }
        let mr: f64 = xs.windows(2).map(|w| (w[1] - w[0]).abs()).sum::<f64>() / (xs.len() - 1) as f64;
        return mr / d2(2);
    }
    let groups: Vec<&[f64]> = xs.chunks_exact(subgroup).collect();
    if groups.is_empty() || !(2..=10).contains(&subgroup) { return f64::NAN; }
    let rbar = groups.iter().map(|g| {
        let mx = g.iter().cloned().fold(f64::MIN, f64::max);
        let mn = g.iter().cloned().fold(f64::MAX, f64::min);
        mx - mn
    }).sum::<f64>() / groups.len() as f64;
    rbar / d2(subgroup)
}

/// Capability indices for a mean and sigma. A missing limit is NaN.
/// Returns (C_p, C_pk, C_pl, C_pu). Cp needs both limits; Cpk is the smaller
/// of the one-sided indices that exist. [NIST 6.1.6]
/// Called with the within sigma these are Cp/Cpk; with the overall sigma, Pp/Ppk. [MTB]
pub fn cap_indices(mean: f64, sigma: f64, lsl: f64, usl: f64) -> (f64, f64, f64, f64) {
    if !(sigma > 0.0) || !mean.is_finite() { return (f64::NAN, f64::NAN, f64::NAN, f64::NAN); }
    let cpl = if lsl.is_finite() { (mean - lsl) / (3.0 * sigma) } else { f64::NAN };
    let cpu = if usl.is_finite() { (usl - mean) / (3.0 * sigma) } else { f64::NAN };
    let cp = if lsl.is_finite() && usl.is_finite() && usl > lsl { (usl - lsl) / (6.0 * sigma) } else { f64::NAN };
    let cpk = match (cpl.is_finite(), cpu.is_finite()) {
        (true, true) => cpl.min(cpu),
        (true, false) => cpl,
        (false, true) => cpu,
        _ => f64::NAN,
    };
    (cp, cpk, cpl, cpu)
}

/// Complementary error function. [NR 6.2] fractional error below 1.2e-7.
pub fn erfc(x: f64) -> f64 {
    let z = x.abs();
    let t = 1.0 / (1.0 + 0.5 * z);
    let ans = t * (-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418
        + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587
        + t * (-0.82215223 + t * 0.17087277))))))))).exp();
    if x >= 0.0 { ans } else { 2.0 - ans }
}

/// Standard normal upper tail P(Z > z).
pub fn normal_upper_tail(z: f64) -> f64 { 0.5 * erfc(z / std::f64::consts::SQRT_2) }

/// Normal probability density.
pub fn normal_pdf(x: f64, mean: f64, sigma: f64) -> f64 {
    if !(sigma > 0.0) { return f64::NAN; }
    let z = (x - mean) / sigma;
    (-0.5 * z * z).exp() / (sigma * (2.0 * std::f64::consts::PI).sqrt())
}

/// Expected parts per million below LSL and above USL for a normal process.
/// A missing limit gives 0 on that side.
pub fn cap_ppm(mean: f64, sigma: f64, lsl: f64, usl: f64) -> (f64, f64) {
    if !(sigma > 0.0) { return (f64::NAN, f64::NAN); }
    let lo = if lsl.is_finite() { normal_upper_tail((mean - lsl) / sigma) * 1e6 } else { 0.0 };
    let hi = if usl.is_finite() { normal_upper_tail((usl - mean) / sigma) * 1e6 } else { 0.0 };
    (lo, hi)
}

/// Number of histogram bins by Sturges' rule, ceil(log2 n) + 1, at least 1.
/// (BenchMate choice for the display only; it does not affect any index.)
pub fn sturges_bins(n: usize) -> usize {
    if n < 2 { return 1; }
    ((n as f64).log2().ceil() as usize + 1).max(1)
}

/// Histogram with `bins` equal bins from min to max. Returns (start, width, counts).
pub fn histogram(xs: &[f64], bins: usize) -> (f64, f64, Vec<usize>) {
    if xs.is_empty() || bins == 0 { return (f64::NAN, f64::NAN, vec![]); }
    let mn = xs.iter().cloned().fold(f64::MAX, f64::min);
    let mx = xs.iter().cloned().fold(f64::MIN, f64::max);
    let span = if mx > mn { mx - mn } else { 1e-9_f64.max(mn.abs() * 1e-9) };
    let w = span / bins as f64;
    let mut c = vec![0usize; bins];
    for &x in xs {
        let i = (((x - mn) / w).floor() as isize).clamp(0, bins as isize - 1) as usize;
        c[i] += 1;
    }
    (mn, w, c)
}

/// All capability outputs in one flat result (for the WebAssembly bridge).
/// `which`: 0 n, 1 mean, 2 sigma overall, 3 sigma within, 4 Cp, 5 Cpk, 6 Pp,
/// 7 Ppk, 8 Cpl, 9 Cpu, 10 Ppl, 11 Ppu, 12 ppm below (overall), 13 ppm above
/// (overall), 14 min, 15 max, 16 bins, 17 bin width, 18 histogram start,
/// 19 ppm below (within), 20 ppm above (within), 100 + i count in bin i.
pub fn capability_flat(xs: &[f64], lsl: f64, usl: f64, subgroup: usize, which: u32) -> f64 {
    let n = xs.len();
    let m = cap_mean(xs);
    let so = cap_sigma_overall(xs);
    let sw = cap_sigma_within(xs, subgroup);
    let bins = sturges_bins(n);
    match which {
        0 => n as f64,
        1 => m,
        2 => so,
        3 => sw,
        4 => cap_indices(m, sw, lsl, usl).0,
        5 => cap_indices(m, sw, lsl, usl).1,
        6 => cap_indices(m, so, lsl, usl).0,
        7 => cap_indices(m, so, lsl, usl).1,
        8 => cap_indices(m, sw, lsl, usl).2,
        9 => cap_indices(m, sw, lsl, usl).3,
        10 => cap_indices(m, so, lsl, usl).2,
        11 => cap_indices(m, so, lsl, usl).3,
        12 => cap_ppm(m, so, lsl, usl).0,
        13 => cap_ppm(m, so, lsl, usl).1,
        14 => xs.iter().cloned().fold(f64::MAX, f64::min),
        15 => xs.iter().cloned().fold(f64::MIN, f64::max),
        16 => bins as f64,
        17 => histogram(xs, bins).1,
        18 => histogram(xs, bins).0,
        19 => cap_ppm(m, sw, lsl, usl).0,
        20 => cap_ppm(m, sw, lsl, usl).1,
        k if k >= 100 => histogram(xs, bins).2.get((k - 100) as usize).map(|&c| c as f64).unwrap_or(f64::NAN),
        _ => f64::NAN,
    }
}

// ---------------------------------------------------------------------------
// Temperature compensation (reference temperature 20 C, ISO 1)

/// Reference temperature for dimensional measurement, degrees C. [ISO1], [DOI]
pub const REF_TEMP_C: f64 = 20.0;

/// Length at 20 C from a reading taken with the part at `t_part` and the gauge
/// (scale, micrometer, CMM scales) at `t_gauge`, both in C. Expansion
/// coefficients in 1/K.
/// The gauge's graduations grow by (1 + a_g dT_g), so the true length at the
/// part temperature is reading x (1 + a_g dT_g); that length is the 20 C length
/// grown by (1 + a_p dT_p). [DOI], [ISO1]
pub fn length_at_20(reading: f64, t_part: f64, t_gauge: f64, a_part: f64, a_gauge: f64) -> f64 {
    reading * (1.0 + a_gauge * (t_gauge - REF_TEMP_C)) / (1.0 + a_part * (t_part - REF_TEMP_C))
}

/// The reading to expect at these temperatures for a part that is `l20` long at 20 C
/// (inverse of `length_at_20`).
pub fn reading_for_length(l20: f64, t_part: f64, t_gauge: f64, a_part: f64, a_gauge: f64) -> f64 {
    l20 * (1.0 + a_part * (t_part - REF_TEMP_C)) / (1.0 + a_gauge * (t_gauge - REF_TEMP_C))
}

/// Change of length for a temperature change: dL = L x alpha x dT.
pub fn thermal_growth(length: f64, alpha: f64, dt: f64) -> f64 { length * alpha * dt }

/// Uncertainty contribution of an expansion coefficient uncertainty `u_alpha`
/// (1/K) at a temperature `t` (C): L x u_alpha x |t - 20|.
pub fn alpha_uncertainty(length: f64, u_alpha: f64, t: f64) -> f64 { length * u_alpha * (t - REF_TEMP_C).abs() }

// ---------------------------------------------------------------------------
// Coolant (water-miscible metalworking fluid)

/// Concentration % = refractometer reading (Brix) x the fluid's refractometer
/// factor. The factor comes from the fluid's data sheet; there is no default.
pub fn coolant_conc(brix: f64, factor: f64) -> f64 {
    if !(factor > 0.0) || !(brix >= 0.0) { return f64::NAN; }
    brix * factor
}

/// Concentrate to add to `vol` at `c_now` % to reach `c_target` %, with
/// concentrate of strength `c_conc` % (normally 100). Mass balance:
/// x = vol (c_target - c_now) / (c_conc - c_target). NaN if not a raise.
pub fn coolant_add_concentrate(vol: f64, c_now: f64, c_target: f64, c_conc: f64) -> f64 {
    if !(vol > 0.0) || !(c_target > c_now) || !(c_conc > c_target) || c_now < 0.0 { return f64::NAN; }
    vol * (c_target - c_now) / (c_conc - c_target)
}

/// Water to add to `vol` at `c_now` % to bring it down to `c_target` %:
/// w = vol (c_now - c_target) / c_target. NaN if not a reduction.
pub fn coolant_add_water(vol: f64, c_now: f64, c_target: f64) -> f64 {
    if !(vol > 0.0) || !(c_target > 0.0) || !(c_now > c_target) { return f64::NAN; }
    vol * (c_now - c_target) / c_target
}

/// Concentration % of the top-up mix that brings a sump from `v_now` at
/// `c_now` % to `v_full` at `c_target` %:
/// c_mix = (c_target v_full - c_now v_now) / (v_full - v_now).
/// The result can be below 0 or above the concentrate strength, meaning the
/// target cannot be reached by a top-up alone.
pub fn coolant_topup_mix(v_now: f64, c_now: f64, v_full: f64, c_target: f64) -> f64 {
    if !(v_full > v_now) || v_now < 0.0 || c_now < 0.0 || c_target < 0.0 { return f64::NAN; }
    (c_target * v_full - c_now * v_now) / (v_full - v_now)
}

/// Concentrate volume in `vol` of mix at `c` %, from concentrate at `c_conc` %.
pub fn coolant_concentrate_in(vol: f64, c: f64, c_conc: f64) -> f64 {
    if !(vol >= 0.0) || !(c >= 0.0) || !(c_conc > 0.0) || c > c_conc { return f64::NAN; }
    vol * c / c_conc
}

// ---------------------------------------------------------------------------
// Fractions

/// Greatest common divisor.
pub fn gcd(a: u64, b: u64) -> u64 { if b == 0 { a } else { gcd(b, a % b) } }

/// Numerator of the nearest fraction with denominator `den` (not reduced).
pub fn frac_nearest_num(x: f64, den: f64) -> f64 {
    if !(den >= 1.0) || !x.is_finite() { return f64::NAN; }
    (x * den).round()
}

/// Reduced (numerator, denominator) of num/den, sign kept on the numerator.
pub fn frac_reduce(num: f64, den: f64) -> (f64, f64) {
    if !(den >= 1.0) || !num.is_finite() { return (f64::NAN, f64::NAN); }
    let g = gcd(num.abs() as u64, den as u64).max(1) as f64;
    (num / g, den / g)
}

/// Mixed number to decimal: whole + num/den (sign of `whole` applies to all).
pub fn mixed_to_decimal(whole: f64, num: f64, den: f64) -> f64 {
    if !(den > 0.0) { return f64::NAN; }
    let f = num / den;
    if whole < 0.0 || (whole == 0.0 && whole.is_sign_negative()) { whole - f } else { whole + f }
}

/// Nearest fraction of `x` in steps of 1/`den` (e.g. 64), reduced:
/// [sign (1 or -1), whole, numerator, denominator, error], where error is
/// the fraction's value minus `x` (positive = the fraction is larger).
/// A value that rounds to a whole number has numerator 0 and denominator 1.
pub fn nearest_fraction(x: f64, den: f64) -> [f64; 5] {
    if !(den >= 1.0 && den <= 1e6) || !x.is_finite() || x.abs() > 1e12 { return [f64::NAN; 5]; }
    let den = den.round();
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let n = (x.abs() * den).round();
    let whole = (n / den).floor();
    let (num, d) = frac_reduce(n - whole * den, den);
    let (num, d) = if num == 0.0 { (0.0, 1.0) } else { (num, d) };
    let value = sign * (whole + num / d);
    [if n == 0.0 { 1.0 } else { sign }, whole, num, d, value - x]
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    #[test]
    fn nearest_fraction_64ths() {
        // 0.4375 = 7/16 exactly.
        assert_eq!(nearest_fraction(3.4375, 64.0), [1.0, 3.0, 7.0, 16.0, 0.0]);
        // 0.3 -> 19/64 = 0.296875, 0.003125 small.
        let f = nearest_fraction(0.3, 64.0);
        assert_eq!(&f[..4], &[1.0, 0.0, 19.0, 64.0]); close(f[4], -0.003125, 1e-12);
        // Negative: -1.2 -> -(1 13/64) = -1.203125, fraction 0.003125 below.
        let f = nearest_fraction(-1.2, 64.0);
        assert_eq!(&f[..4], &[-1.0, 1.0, 13.0, 64.0]); close(f[4], -0.003125, 1e-12);
        // Rounds up to the next whole number.
        assert_eq!(&nearest_fraction(1.999, 64.0)[..4], &[1.0, 2.0, 0.0, 1.0]);
        assert_eq!(&nearest_fraction(0.001, 64.0)[..4], &[1.0, 0.0, 0.0, 1.0]);
        assert!(nearest_fraction(f64::NAN, 64.0)[0].is_nan());
        assert!(nearest_fraction(1.0, 0.0)[0].is_nan());
    }

    #[test]
    fn capability_hand_example() {
        // 10 values; hand-checked in Python (statistics.stdev).
        let xs = [10.02, 9.98, 10.01, 10.00, 9.99, 10.03, 9.97, 10.01, 10.00, 9.99];
        close(cap_mean(&xs), 10.0, 1e-12);
        let so = cap_sigma_overall(&xs);
        close(so, 0.0182574185835, 1e-10);
        // moving ranges: .04 .03 .01 .01 .04 .06 .04 .01 .01 -> sum .25 / 9 / 1.128
        close(cap_sigma_within(&xs, 1), 0.25 / 9.0 / 1.128, 1e-12);
        // subgroups of 2: ranges .04 .01 .04 .04 .01 -> mean .028 / 1.128
        close(cap_sigma_within(&xs, 2), 0.028 / 1.128, 1e-12);
        let (pp, ppk, _, _) = cap_indices(10.0, so, 9.95, 10.06);
        close(pp, 0.11 / (6.0 * so), 1e-12);
        close(ppk, 0.05 / (3.0 * so), 1e-12);
        // 3 sigma subgroups of 3 (last value ignored): ranges .04 .04 .04 -> .04/1.693
        close(cap_sigma_within(&xs, 3), 0.04 / 1.693, 1e-12);
    }

    #[test]
    fn d2_matches_nist_a2_table() {
        // NIST e-Handbook 6.3.2.1 prints A2 = 3 / (d2 sqrt n) for n = 2..10.
        let a2 = [1.880, 1.023, 0.729, 0.577, 0.483, 0.419, 0.373, 0.337, 0.308];
        for (i, a) in a2.iter().enumerate() {
            let n = i + 2;
            close(3.0 / (d2(n) * (n as f64).sqrt()), *a, 0.0015);
        }
        assert!(d2(1).is_nan() && d2(11).is_nan());
    }

    #[test]
    fn one_sided() {
        let (cp, cpk, cpl, cpu) = cap_indices(5.0, 0.5, f64::NAN, 8.0);
        assert!(cp.is_nan() && cpl.is_nan());
        close(cpu, 2.0, 1e-12); close(cpk, 2.0, 1e-12);
    }

    #[test]
    fn ppm_matches_nist_table() {
        // NIST 6.1.6: Cp 1.00 centred -> 0.27 %; Cp 1.33 (8 sigma) -> 64 ppm; 10 sigma -> 0.6 ppm.
        let (a, b) = cap_ppm(0.0, 1.0, -3.0, 3.0);
        close(a + b, 2699.8, 0.5);
        let (a, b) = cap_ppm(0.0, 1.0, -4.0, 4.0);
        close(a + b, 63.3, 0.5);
        let (a, b) = cap_ppm(0.0, 1.0, -5.0, 5.0);
        close(a + b, 0.573, 0.01);
        close(erfc(0.0), 1.0, 1e-7);
        close(erfc(1.0), 0.157299207, 2e-8);
        close(erfc(-1.0), 1.842700793, 2e-8);
    }

    #[test]
    fn histogram_counts() {
        let xs = [1.0, 2.0, 2.0, 3.0, 4.0];
        assert_eq!(sturges_bins(5), 4);
        let (s, w, c) = histogram(&xs, 3);
        close(s, 1.0, 0.0); close(w, 1.0, 1e-12);
        assert_eq!(c, vec![1, 2, 2]);
        assert_eq!(c.iter().sum::<usize>(), 5);
        close(capability_flat(&xs, f64::NAN, f64::NAN, 1, 100), 1.0, 0.0);
        close(normal_pdf(0.0, 0.0, 1.0), 0.398942280, 1e-9);
    }

    #[test]
    fn temperature() {
        // Steel part 100 mm at 30 C, 11.5e-6/K, steel gauge at 20 C:
        // reading 100.0115 should give 100.000 at 20 C.
        let r = reading_for_length(100.0, 30.0, 20.0, 11.5e-6, 11.5e-6);
        close(r, 100.0115, 1e-9);
        close(length_at_20(r, 30.0, 20.0, 11.5e-6, 11.5e-6), 100.0, 1e-12);
        // Same material and same temperature: reading is already the 20 C length.
        close(length_at_20(50.0, 26.0, 26.0, 11.5e-6, 11.5e-6), 50.0, 1e-12);
        // Aluminium part (23e-6) at 25 C, steel gauge (11.5e-6) at 25 C, reading 200:
        // 200 x (1 + 11.5e-6 x 5) / (1 + 23e-6 x 5) = 199.98850...
        close(length_at_20(200.0, 25.0, 25.0, 23e-6, 11.5e-6), 200.0 * (1.0 + 5.75e-5) / (1.0 + 1.15e-4), 1e-12);
        close(length_at_20(200.0, 25.0, 25.0, 23e-6, 11.5e-6), 199.988501, 1e-6);
        close(thermal_growth(100.0, 11.5e-6, 10.0), 0.0115, 1e-12);
        close(alpha_uncertainty(100.0, 1e-6, 15.0), 0.0005, 1e-12);
    }

    #[test]
    fn coolant() {
        close(coolant_conc(4.0, 1.5), 6.0, 1e-12);
        assert!(coolant_conc(4.0, f64::NAN).is_nan());
        // 200 L at 4 % to 6 % with 100 % concentrate: 200 x 2 / 94 = 4.255 L
        close(coolant_add_concentrate(200.0, 4.0, 6.0, 100.0), 400.0 / 94.0, 1e-12);
        // check: (200 x 0.04 + 4.255) / 204.255 = 6 %
        let x = coolant_add_concentrate(200.0, 4.0, 6.0, 100.0);
        close((200.0 * 4.0 + x * 100.0) / (200.0 + x), 6.0, 1e-12);
        // 200 L at 8 % down to 6 %: 200 x 2 / 6 = 66.7 L water
        close(coolant_add_water(200.0, 8.0, 6.0), 400.0 / 6.0, 1e-12);
        // Sump 150 L at 7 %, fill to 200 L at 6 %: mix (1200 - 1050) / 50 = 3 %
        close(coolant_topup_mix(150.0, 7.0, 200.0, 6.0), 3.0, 1e-12);
        close(coolant_concentrate_in(50.0, 3.0, 100.0), 1.5, 1e-12);
        // Too rich to fix by top-up: negative mix
        assert!(coolant_topup_mix(190.0, 9.0, 200.0, 6.0) < 0.0);
    }

    #[test]
    fn fractions() {
        close(frac_nearest_num(0.3125, 64.0), 20.0, 0.0);
        assert_eq!(frac_reduce(20.0, 64.0), (5.0, 16.0));
        assert_eq!(frac_reduce(0.0, 64.0), (0.0, 1.0));
        // 0.3 in: nearest 64th is 19/64 = 0.296875, error 0.003125
        close(frac_nearest_num(0.3, 64.0), 19.0, 0.0);
        close(mixed_to_decimal(1.0, 3.0, 8.0), 1.375, 1e-12);
        close(mixed_to_decimal(-1.0, 1.0, 2.0), -1.5, 1e-12);
        close(10.0 / 25.4 * 64.0, 25.196850393700785, 1e-12);
        close(frac_nearest_num(10.0 / 25.4, 64.0), 25.0, 0.0);
    }
}
