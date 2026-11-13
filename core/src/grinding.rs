//! Grinding calculators (parity batch A8): wheel and work speed, speed ratio,
//! equivalent wheel diameter, contact length, specific removal rate, equivalent
//! chip thickness, traverse per revolution, surface grinding and plunge time.
//!
//! The wheel's marked maximum operating speed is never defaulted: it is printed on
//! the wheel (or its label) and must be obeyed; these functions only compare.
//!
//! Sources (docs/sources.md, section "Grinding"):
//! * [GOETZ] D. S. Goetz, "Wear mechanics of cylindrical grinding wheels", Cutting Tool
//!   Engineering, 24 Oct 2017: wheel speed sfpm = 0.2618 x D (in) x rpm; equivalent
//!   diameter De = Dwheel Dwork / (Dwheel + Dwork); contact length sqrt(doc x De).
//! * [MALKIN] S. Malkin, C. Guo, Grinding Technology, 2nd ed., Industrial Press, 2008,
//!   Ch. 2 (equivalent diameter: + external, - internal, = wheel diameter for surface
//!   grinding; contact length; equivalent chip thickness; specific removal rate).
//! * [ROWE] W. B. Rowe, Principles of Modern Grinding Technology, 2nd ed., Elsevier,
//!   2014 (speed ratio, overlap ratio = wheel width / traverse per revolution).
//! * [BED] B. Bednarski (Saint-Gobain Abrasives), in "Working an inside job",
//!   American Machinist, 19 Oct 2006: work speed from wheel speed and a 25:1 to 65:1 ratio.
//! * [BADGER10] J. Badger, "Overcoming waviness", Cutting Tool Engineering, 15 Jun 2010:
//!   rpm ratio = wheel rpm / workpiece rpm; a whole number catches the same wave every
//!   turn, a simple fraction (1/4, 1/3, 1/2, 2/3, 3/4) leaves scallops, a long decimal
//!   is what to aim for. [BADGER11] "Origins of chatter", same column, 15 Apr 2011:
//!   marks per work revolution against the rpm ratio, and marks x work rpm / 60 in Hz.
//!   [BADGER25] "Varying the workpiece rpm", same column, 18 Apr 2025: examples of
//!   ratios to avoid and to aim for. One author: single source for the rule.
//!   Units: mm, m/s (wheel), m/min (work), mm/min (feeds), minutes.

use std::f64::consts::PI;

/// Wheel peripheral speed (m/s) from diameter (mm) and rpm: pi d n / 60 000.
pub fn wheel_speed_ms(d_mm: f64, rpm: f64) -> f64 { PI * d_mm * rpm / 60000.0 }

/// Wheel rpm for a peripheral speed vs (m/s) at diameter d (mm).
pub fn wheel_rpm_ms(vs: f64, d_mm: f64) -> f64 { vs * 60000.0 / (PI * d_mm) }

/// Speed ratio q = vs / vw with vs in m/s and vw in m/min (same units after x 60). [ROWE]
pub fn speed_ratio(vs_ms: f64, vw_m_min: f64) -> f64 { vs_ms * 60.0 / vw_m_min }

/// Equivalent wheel diameter. mode 0 external cylindrical: dw ds / (dw + ds);
/// 1 internal: dw ds / (dw - ds) (wheel smaller than the bore); 2 surface: ds.
/// [GOETZ][MALKIN]
pub fn equiv_dia(dw: f64, ds: f64, mode: u32) -> f64 {
    if !(ds > 0.0) { return f64::NAN; }
    match mode {
        0 if dw > 0.0 => dw * ds / (dw + ds),
        1 if dw > ds => dw * ds / (dw - ds),
        2 => ds,
        _ => f64::NAN,
    }
}
pub fn equiv_dia_f(dw: f64, ds: f64, mode: f64) -> f64 { equiv_dia(dw, ds, mode as u32) }

/// Geometric contact length (mm): sqrt(ae de), ae the depth of cut (mm). [GOETZ][MALKIN]
pub fn contact_length(ae: f64, de: f64) -> f64 { (ae * de).sqrt() }

/// Specific material removal rate Q'w (mm^3/mm/s) = ae (mm) x vw (m/min) x 1000 / 60. [MALKIN]
pub fn specific_mrr(ae: f64, vw_m_min: f64) -> f64 { ae * vw_m_min * 1000.0 / 60.0 }

/// Equivalent chip thickness heq (um) = ae vw / vs = Q'w / vs, ae mm, vw m/min, vs m/s. [MALKIN]
pub fn equiv_chip_um(ae: f64, vw_m_min: f64, vs_ms: f64) -> f64 { ae * 1000.0 * vw_m_min / 60.0 / vs_ms }

/// Traverse speed (mm/min) = traverse per work revolution fa (mm) x work rpm.
pub fn traverse_speed(fa: f64, nw: f64) -> f64 { fa * nw }

/// Overlap ratio = wheel width / traverse per work revolution. [ROWE]
pub fn overlap_ratio(bs: f64, fa: f64) -> f64 { bs / fa }

/// Surface grinding (reciprocating table): strokes per layer = ceil(cross travel /
/// cross-feed) + 1, layers = ceil(stock / down-feed) + spark-out layers, each stroke
/// (length + 2 x overtravel) at table speed vt (m/min). `both` = 1 grinds in both
/// directions (cross-feed at each end); 0 grinds one way and returns empty, so each
/// stroke takes twice as long. Returns minutes; `which` 1 = strokes per layer, 2 = layers.
#[allow(clippy::too_many_arguments)]
pub fn surface_grind(len: f64, overtravel: f64, cross_travel: f64, cross_feed: f64, vt_m_min: f64,
                     stock: f64, down_feed: f64, spark: f64, both: f64, which: u32) -> f64 {
    if !(len > 0.0 && overtravel >= 0.0 && cross_travel >= 0.0 && cross_feed > 0.0 && vt_m_min > 0.0 && stock > 0.0 && down_feed > 0.0) { return f64::NAN; }
    let strokes = (cross_travel / cross_feed - 1e-9).ceil().max(0.0) + 1.0;
    let layers = (stock / down_feed - 1e-9).ceil() + spark.max(0.0).floor();
    let t_stroke = (len + 2.0 * overtravel) / (vt_m_min * 1000.0) * if both > 0.5 { 1.0 } else { 2.0 };
    match which { 1 => strokes, 2 => layers, _ => strokes * layers * t_stroke }
}

/// Plunge grinding time (min): radial stock (mm) / radial infeed rate (mm/min), plus spark-out (s).
pub fn plunge_time(stock_radial: f64, infeed_mm_min: f64, spark_s: f64) -> f64 {
    if !(stock_radial > 0.0 && infeed_mm_min > 0.0) { return f64::NAN; }
    stock_radial / infeed_mm_min + spark_s.max(0.0) / 60.0
}

/// Specific removal rate in plunge grinding (mm^3/mm/s): pi dw vfr / 60 (dw mm, vfr mm/min radial).
pub fn plunge_specific_mrr(dw: f64, vfr: f64) -> f64 { PI * dw * vfr / 60.0 }

/// Traverse (cylindrical) grinding time (min) for `passes` over length L at traverse fa x nw.
pub fn traverse_time(len: f64, fa: f64, nw: f64, passes: f64) -> f64 {
    if !(len > 0.0 && fa > 0.0 && nw > 0.0 && passes > 0.0) { return f64::NAN; }
    len / traverse_speed(fa, nw) * passes
}

/// 1 when a wheel speed exceeds its marked maximum (m/s), 0 when within, NaN when no maximum is given.
pub fn over_marked_max(vs: f64, vmax: f64) -> f64 { if !(vmax > 0.0) { f64::NAN } else if vs > vmax { 1.0 } else { 0.0 } }

// ---------------------------------------------------------------------------
// Wheel to work rpm ratio (waviness from a wheel that runs out or is out of balance)
// ---------------------------------------------------------------------------

/// Rpm ratio: wheel rpm divided by workpiece rpm [BADGER10]. A wheel that runs
/// out or is out of balance touches the work once per wheel revolution, so this
/// is also the number of waves it leaves per work revolution [BADGER11].
pub fn rpm_ratio(wheel_rpm: f64, work_rpm: f64) -> f64 { wheel_rpm / work_rpm }

/// How far a ratio is from the nearest whole number (0 to 0.5).
pub fn rpm_ratio_off_whole(ratio: f64) -> f64 { (ratio - ratio.round()).abs() }

/// The simple fractions named in [BADGER10]: 1/4, 1/3, 1/2, 2/3, 3/4.
pub const RPM_RATIO_FRACTIONS: [f64; 5] = [0.25, 1.0 / 3.0, 0.5, 2.0 / 3.0, 0.75];

/// Index (0 to 4) of the fraction in [`RPM_RATIO_FRACTIONS`] nearest to the
/// fractional part of the ratio.
pub fn rpm_ratio_near_fraction(ratio: f64) -> f64 {
    let fr = ratio - ratio.floor();
    let mut best = 0usize;
    for (i, f) in RPM_RATIO_FRACTIONS.iter().enumerate() {
        if (fr - f).abs() < (fr - RPM_RATIO_FRACTIONS[best]).abs() { best = i; }
    }
    best as f64
}

/// How far the fractional part of a ratio is from the nearest of those fractions.
pub fn rpm_ratio_off_fraction(ratio: f64) -> f64 {
    let fr = ratio - ratio.floor();
    (fr - RPM_RATIO_FRACTIONS[rpm_ratio_near_fraction(ratio) as usize]).abs()
}

/// BenchMate's limit for "close to": 0.02. No source gives a figure. It sits
/// between the examples in [BADGER25]: 8.0000, 9.013 and 8.9924 are called bad
/// (0.013 or less from a whole number), 9.36488 and 8.916742 good (0.083 from a
/// whole number, 0.031 from 1/3).
pub fn rpm_ratio_tol() -> f64 { 0.02 }

/// Class of an rpm ratio with the limit `tol`: 1 close to a whole number, 2
/// close to one of the simple fractions, 0 neither (a "long decimal").
pub fn rpm_ratio_class(ratio: f64, tol: f64) -> f64 {
    if !(ratio.is_finite() && ratio > 0.0) { return f64::NAN; }
    if rpm_ratio_off_whole(ratio) <= tol { 1.0 } else if rpm_ratio_off_fraction(ratio) <= tol { 2.0 } else { 0.0 }
}

/// Work rpm that gives a stated rpm ratio at a wheel rpm.
pub fn work_rpm_for_ratio(wheel_rpm: f64, ratio: f64) -> f64 { wheel_rpm / ratio }

/// Frequency (Hz) of marks counted round the work: marks per revolution x
/// work rpm / 60 [BADGER11].
pub fn marks_frequency_hz(marks_per_rev: f64, work_rpm: f64) -> f64 { marks_per_rev * work_rpm / 60.0 }

/// Once-per-revolution frequency (Hz) of a spindle: rpm / 60.
pub fn rev_frequency_hz(rpm: f64) -> f64 { rpm / 60.0 }

/// Spacing round the work of `waves` waves per revolution on diameter `d`.
pub fn wave_spacing(d: f64, waves: f64) -> f64 { PI * d / waves }

/// Difference, in percent of the ratio, between marks counted and the rpm ratio.
pub fn marks_vs_ratio_pct(marks_per_rev: f64, ratio: f64) -> f64 { (marks_per_rev - ratio) / ratio * 100.0 }

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    /// [BADGER10]: 40 m/s on a wheel worn from 500 to 350 mm is 1,528 to 2,182 rpm;
    /// with the work at 200 rpm the ratio goes from 7.63 to 10.91 (1528 / 200 is
    /// 7.64; the article prints 7.63). [BADGER11]: 12,000 sfm on a 16 in wheel is
    /// printed as 2,866 rpm and 9,000 sfm as 2,150 (the article uses pi = 3.14;
    /// with pi it is 2,864.8 and 2,148.6); work at 40 rpm gives 71.65 and 53.75
    /// (71.62 and 53.71 here); 70 marks at 40 rpm is 47 Hz.
    #[test]
    fn rpm_ratio_examples() {
        let n0 = wheel_rpm_ms(40.0, 500.0); let n1 = wheel_rpm_ms(40.0, 350.0);
        assert!(close(n0, 1528.0, 0.5) && close(n1, 2182.0, 1.0));
        assert!(close(rpm_ratio(n0, 200.0), 7.63, 0.011) && close(rpm_ratio(n1, 200.0), 10.91, 0.005));
        let w = crate::rpm_from_sfm(12000.0, 16.0);
        assert!(close(w, 2866.0, 1.5) && close(w, 12000.0 * 12.0 / (PI * 16.0), 1e-9));
        assert!(close(rpm_ratio(w, 40.0), 71.65, 0.04));
        assert!(close(rpm_ratio(crate::rpm_from_sfm(9000.0, 16.0), 40.0), 53.75, 0.04));
        assert!(close(marks_frequency_hz(70.0, 40.0), 47.0, 0.5));
        assert!(close(marks_vs_ratio_pct(70.0, 71.62), -2.26, 0.01));
        assert!(close(rev_frequency_hz(2866.0), 47.77, 0.005));
        assert!(close(work_rpm_for_ratio(1528.0, 8.0), 191.0, 1e-9));
        assert!(close(wave_spacing(50.0, 8.0), PI * 50.0 / 8.0, 1e-12));
    }

    /// [BADGER25] examples: 8.0000, 9.013 and 8.9924 are "round numbers" to
    /// avoid; 9.36488 and 8.916742 are good. [BADGER10]: 7.84923785 is ideal;
    /// 1/4, 1/3, 1/2, 2/3 and 3/4 leave scallops.
    #[test]
    fn rpm_ratio_classes() {
        let t = rpm_ratio_tol();
        for r in [8.0, 9.013, 8.9924] { assert_eq!(rpm_ratio_class(r, t), 1.0, "{r}"); }
        for r in [9.36488, 8.916742, 7.84923785] { assert_eq!(rpm_ratio_class(r, t), 0.0, "{r}"); }
        for (r, k) in [(7.25, 0.0), (7.0 + 1.0 / 3.0, 1.0), (7.5, 2.0), (7.0 + 2.0 / 3.0, 3.0), (7.75, 4.0)] {
            assert_eq!(rpm_ratio_class(r, t), 2.0, "{r}");
            assert_eq!(rpm_ratio_near_fraction(r), k, "{r}");
        }
        assert!(close(rpm_ratio_off_whole(9.013), 0.013, 1e-9) && close(rpm_ratio_off_fraction(9.36488), 0.031547, 1e-5));
        assert!(rpm_ratio_class(f64::NAN, t).is_nan() && rpm_ratio_class(0.0, t).is_nan());
    }

    #[test]
    fn wheel_speed() {
        // 300 mm wheel at 2865 rpm: pi 0.3 x 2865 / 60 = 45.003 m/s (hand)
        assert!(close(wheel_speed_ms(300.0, 2865.0), PI * 0.3 * 2865.0 / 60.0, 1e-9));
        assert!(close(wheel_rpm_ms(35.0, 400.0), 35.0 * 60000.0 / (PI * 400.0), 1e-9));
        // [GOETZ] form sfpm = 0.2618 D(in) rpm equals pi D n / 12 (0.261799...)
        assert!(close(crate::sfm_from_rpm(1800.0, 14.0), 0.2618 * 14.0 * 1800.0, 0.2618 * 14.0 * 1800.0 * 1e-4));
        // 35 m/s wheel, 20 m/min work: q = 105
        assert!(close(speed_ratio(35.0, 20.0), 105.0, 1e-12));
    }

    #[test]
    fn equivalent_diameter() {
        // External: 50 mm work, 400 mm wheel: 20000/450 = 44.444
        assert!(close(equiv_dia(50.0, 400.0, 0), 20000.0 / 450.0, 1e-12));
        // Internal: 50 mm bore, 40 mm wheel: 2000 / 10 = 200
        assert!(close(equiv_dia(50.0, 40.0, 1), 200.0, 1e-12));
        assert!(equiv_dia(40.0, 50.0, 1).is_nan());
        assert_eq!(equiv_dia(0.0, 250.0, 2), 250.0);
        // contact length sqrt(0.01 x 44.444) = 0.6667
        assert!(close(contact_length(0.01, 20000.0 / 450.0), (0.01f64 * 20000.0 / 450.0).sqrt(), 1e-12));
    }

    #[test]
    fn removal_and_chip() {
        // ae 0.01 mm, vw 20 m/min: Q'w = 0.01 x 20000 / 60 = 3.333 mm^3/mm/s
        assert!(close(specific_mrr(0.01, 20.0), 10.0 / 3.0, 1e-12));
        // heq = Q'w / vs = 3.333 / 35 mm^3/mm/s / (m/s) = 0.0952 um
        assert!(close(equiv_chip_um(0.01, 20.0, 35.0), 10.0 / 3.0 / 35.0, 1e-12));
        // plunge: 50 mm work, 0.5 mm/min radial: pi 50 0.5 / 60 = 1.309
        assert!(close(plunge_specific_mrr(50.0, 0.5), PI * 25.0 / 60.0, 1e-12));
    }

    #[test]
    fn traverse_and_times() {
        // wheel 25 mm, 1/3 of the width per rev: fa 8.333, nw 150 -> 1250 mm/min; overlap 3
        assert!(close(traverse_speed(25.0 / 3.0, 150.0), 1250.0, 1e-9));
        assert!(close(overlap_ratio(25.0, 25.0 / 3.0), 3.0, 1e-12));
        assert!(close(traverse_time(100.0, 25.0 / 3.0, 150.0, 5.0), 0.4, 1e-12));
        // Surface: 200 mm + 2 x 20 overtravel = 240 mm at 15 m/min = 0.016 min per stroke.
        // Cross travel 60 mm at 5 mm -> 13 strokes; 0.1 stock / 0.02 = 5 layers + 2 spark = 7.
        let t = surface_grind(200.0, 20.0, 60.0, 5.0, 15.0, 0.1, 0.02, 2.0, 1.0, 0);
        assert!(close(t, 13.0 * 7.0 * 0.016, 1e-12));
        assert_eq!(surface_grind(200.0, 20.0, 60.0, 5.0, 15.0, 0.1, 0.02, 2.0, 1.0, 1), 13.0);
        assert_eq!(surface_grind(200.0, 20.0, 60.0, 5.0, 15.0, 0.1, 0.02, 2.0, 1.0, 2), 7.0);
        assert!(close(surface_grind(200.0, 20.0, 60.0, 5.0, 15.0, 0.1, 0.02, 2.0, 0.0, 0), 2.0 * t, 1e-12));
        // plunge: 0.15 mm radial at 0.5 mm/min plus 6 s spark-out = 0.4 min
        assert!(close(plunge_time(0.15, 0.5, 6.0), 0.4, 1e-12));
        assert!(over_marked_max(45.0, 0.0).is_nan());
        assert_eq!(over_marked_max(45.1, 45.0), 1.0);
    }
}
