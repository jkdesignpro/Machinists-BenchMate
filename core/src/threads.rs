//! Screw thread reference formulas: basic profile dimensions (60 degree
//! ISO metric and Unified inch threads), tap drill sizes from percent of
//! thread for cut and form taps, and ISO metric tolerance limits.
//!
//! Standards are cited by name and clause only; no text or tables from them
//! are reproduced. Every value here is computed from the published formulas.
//! See docs/sources.md ("Threads and tapping") for full references.

/// Height of the fundamental triangle of a 60 degree thread: `H = (sqrt 3 / 2) P`.
/// ISO 68-1 (basic profile) and ASME B1.1 (basic form of UN threads) define the
/// same basic profile.
pub fn thread_fundamental_h(p: f64) -> f64 {
    3f64.sqrt() / 2.0 * p
}

/// Basic pitch diameter `d2 = d - 2 x (3/8) H = d - 0.649519 P` (ISO 68-1, ASME B1.1).
pub fn thread_basic_pitch_dia(d: f64, p: f64) -> f64 {
    d - 0.75 * thread_fundamental_h(p)
}

/// Basic minor diameter `d1 = d - 2 x (5/8) H = d - 1.082532 P` (ISO 68-1,
/// ASME B1.1). This is the minor diameter of the internal thread (nut) at the
/// basic size, and the reference for 100 % "basic" thread engagement.
pub fn thread_basic_minor_dia(d: f64, p: f64) -> f64 {
    d - 1.25 * thread_fundamental_h(p)
}

/// Basic thread height (depth of engagement, radial) `H1 = (5/8) H = 0.541266 P`.
pub fn thread_basic_height(p: f64) -> f64 {
    0.625 * thread_fundamental_h(p)
}

/// Minor diameter of an ISO metric external thread with the rounded root used
/// for tolerancing in ISO 965-1: `d3 = d1 - H/6 = d - 1.226869 P`.
pub fn thread_iso_d3(d: f64, p: f64) -> f64 {
    thread_basic_minor_dia(d, p) - thread_fundamental_h(p) / 6.0
}

/// Unified number size major diameter: `D = 0.060 + 0.013 N` inch for size
/// No. N (No. 0 to No. 12). ASME B1.1 (number sizes).
pub fn un_number_major_in(n: f64) -> f64 {
    0.060 + 0.013 * n
}

// ---------------------------------------------------------------------------
// Tap drills
// ---------------------------------------------------------------------------

/// Thread depth that the cut-tap "percent of thread" convention calls 100 %:
/// 2 x (3/4) H on the diameter, i.e. 1.299038 P. This is the convention behind
/// the widely published inch formula `drill = D - 0.01299 x %thread / TPI`
/// (and the metric form `drill = D - %thread x P / 76.98`). Note that it is
/// larger than the basic engagement 2 x (5/8) H = 1.0825 P, so "100 %" in this
/// convention is deeper than the basic profile; a drill at the basic minor
/// diameter gives 83.3 %.
pub const CUT_TAP_FULL_DEPTH_PER_P: f64 = 1.299_038_105_676_658; // 1.5 * sqrt(3)/2

/// Cut tap drill diameter for a target percent of thread:
/// `drill = D - 1.299038 P x pct / 100` (same length units for D, P).
pub fn tap_drill_cut(d: f64, p: f64, pct: f64) -> f64 {
    d - CUT_TAP_FULL_DEPTH_PER_P * p * pct / 100.0
}

/// Percent of thread a cut tap produces in a hole of diameter `drill`:
/// `pct = 100 (D - drill) / (1.299038 P)`.
pub fn tap_pct_cut(d: f64, p: f64, drill: f64) -> f64 {
    100.0 * (d - drill) / (CUT_TAP_FULL_DEPTH_PER_P * p)
}

/// Form (roll, fluteless) tap constant: `drill = D - 0.0068 x %thread x P`
/// (inch: `D - 0.0068 x %thread / TPI`), as published by tap makers. The
/// formed material flows up toward the tap's minor diameter, so the hole is
/// larger than for a cut tap at the same percent.
pub const FORM_TAP_K: f64 = 0.0068;

/// Form tap hole diameter for a target percent of thread: `D - 0.0068 pct P`.
pub fn tap_drill_form(d: f64, p: f64, pct: f64) -> f64 {
    d - FORM_TAP_K * pct * p
}

/// Percent of thread from a form tap hole: `pct = (D - hole) / (0.0068 P)`.
pub fn tap_pct_form(d: f64, p: f64, hole: f64) -> f64 {
    (d - hole) / (FORM_TAP_K * p)
}

// ---------------------------------------------------------------------------
// ISO metric thread tolerances (ISO 965-1)
// ---------------------------------------------------------------------------

/// Preferred numbers R40 (ISO 3), one decade, used to round ISO 965-1 values.
const R40: [f64; 40] = [
    1.00, 1.06, 1.12, 1.18, 1.25, 1.32, 1.40, 1.50, 1.60, 1.70, 1.80, 1.90, 2.00, 2.12, 2.24, 2.36,
    2.50, 2.65, 2.80, 3.00, 3.15, 3.35, 3.55, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00, 5.30, 5.60, 6.00,
    6.30, 6.70, 7.10, 7.50, 8.00, 8.50, 9.00, 9.50,
];

/// Nearest R40 preferred number (nearest on a log scale), then to a whole
/// micrometre (half to even). The tolerances and fundamental deviations in
/// ISO 965-1 are the formula values rounded this way; see the tests and
/// docs/sources.md for the published values this reproduces and the exceptions.
pub fn round_r40_um(x: f64) -> f64 {
    if !(x > 0.0) || !x.is_finite() { return x; }
    let dec = 10f64.powf(x.log10().floor());
    let m = x / dec;
    let mut best = 1.0; let mut bd = f64::INFINITY;
    for &r in R40.iter().chain([10.0].iter()) {
        let dd = (m.ln() - (r as f64).ln()).abs();
        if dd < bd { bd = dd; best = r; }
    }
    let v = best * dec;
    let f = v.floor();
    let frac = v - f;
    if (frac - 0.5).abs() < 1e-9 { if f % 2.0 == 0.0 { f } else { f + 1.0 } } else { v.round() }
}

/// Basic major diameter steps of ISO 965-1 (mm). A diameter d belongs to the
/// step (lo, hi].
const ISO965_STEPS: [f64; 11] = [0.99, 1.4, 2.8, 5.6, 11.2, 22.4, 45.0, 90.0, 180.0, 355.0, 600.0];

/// Geometric mean of the ISO 965-1 diameter step that contains `d` (mm), used
/// in the pitch diameter tolerance formula. NaN outside 0.99 to 600 mm.
pub fn iso965_step_mean(d: f64) -> f64 {
    for w in ISO965_STEPS.windows(2) {
        if d > w[0] && d <= w[1] { return (w[0] * w[1]).sqrt(); }
    }
    f64::NAN
}

/// Tolerance grade factor relative to grade 6 (ISO 965-1): 3 0.5, 4 0.63,
/// 5 0.8, 6 1, 7 1.25, 8 1.6, 9 2.
pub fn iso965_grade_factor(grade: u32) -> f64 {
    match grade { 3 => 0.5, 4 => 0.63, 5 => 0.8, 6 => 1.0, 7 => 1.25, 8 => 1.6, 9 => 2.0, _ => f64::NAN }
}

/// Unrounded pitch diameter tolerance of the external thread, grade 6 (um):
/// `Td2(6) = 90 P^0.4 d^0.1`, P in mm, d = geometric mean of the diameter step.
pub fn iso965_td2_6_raw(d: f64, p: f64) -> f64 {
    90.0 * p.powf(0.4) * iso965_step_mean(d).powf(0.1)
}

/// External thread pitch diameter tolerance Td2 (um), grade 3..9, rounded.
pub fn iso965_td2(d: f64, p: f64, grade: u32) -> f64 {
    round_r40_um(iso965_td2_6_raw(d, p) * iso965_grade_factor(grade))
}

/// Internal thread pitch diameter tolerance TD2 (um), grade 4..8, rounded:
/// `TD2(G) = 1.32 x Td2(6) x factor(G)`.
pub fn iso965_td2_internal(d: f64, p: f64, grade: u32) -> f64 {
    if !(4..=8).contains(&grade) { return f64::NAN; }
    round_r40_um(1.32 * iso965_td2_6_raw(d, p) * iso965_grade_factor(grade))
}

/// External thread major diameter tolerance Td (um), grades 4, 6, 8, rounded:
/// `Td(6) = 180 P^(2/3) - 3.15 / sqrt(P)`.
pub fn iso965_td(p: f64, grade: u32) -> f64 {
    if ![4, 6, 8].contains(&grade) { return f64::NAN; }
    round_r40_um((180.0 * p.powf(2.0 / 3.0) - 3.15 / p.sqrt()) * iso965_grade_factor(grade))
}

/// Internal thread minor diameter tolerance TD1 (um), grades 4..8, rounded:
/// `TD1(6) = 433 P - 190 P^1.22` for P 0.2 to 0.8 mm, `230 P^0.7` for P >= 1 mm.
pub fn iso965_td1(p: f64, grade: u32) -> f64 {
    if !(4..=8).contains(&grade) { return f64::NAN; }
    let t6 = if p < 1.0 { 433.0 * p - 190.0 * p.powf(1.22) } else { 230.0 * p.powf(0.7) };
    round_r40_um(t6 * iso965_grade_factor(grade))
}

/// Fundamental deviation (um) for an ISO metric thread tolerance position.
/// External (upper deviation es): e -(50 + 11P), f -(30 + 11P),
/// g -(15 + 11P), h 0. Internal (lower deviation EI): G +(15 + 11P), H 0.
/// `pos`: 1 e, 2 f, 3 g, 4 h, 11 G, 12 H.
pub fn iso965_fundamental_dev(p: f64, pos: u32) -> f64 {
    let raw = match pos { 1 => -(50.0 + 11.0 * p), 2 => -(30.0 + 11.0 * p), 3 => -(15.0 + 11.0 * p),
                          11 => 15.0 + 11.0 * p, 4 | 12 => 0.0, _ => return f64::NAN };
    raw.signum() * round_r40_um(raw.abs())
}

/// Limits of an ISO metric thread with tolerance class `grade` + position, in mm.
/// `which`: 0 major max, 1 major min, 2 pitch max, 3 pitch min, 4 minor max,
/// 5 minor min. External (pos e/f/g/h): major and pitch from es, Td, Td2;
/// minor is the d3 maximum only (index 4; index 5 NaN, the root is not
/// toleranced directly). Internal (G/H): minor from EI and TD1, pitch from EI
/// and TD2, major minimum only (index 1; index 0 NaN).
pub fn iso965_limit(d: f64, p: f64, grade: u32, pos: u32, which: u32) -> f64 {
    let fd = iso965_fundamental_dev(p, pos) / 1000.0;
    let d2 = thread_basic_pitch_dia(d, p);
    let d1 = thread_basic_minor_dia(d, p);
    if pos >= 11 {
        let td2 = iso965_td2_internal(d, p, grade) / 1000.0;
        let td1 = iso965_td1(p, grade) / 1000.0;
        match which { 1 => d + fd, 2 => d2 + fd + td2, 3 => d2 + fd, 4 => d1 + fd + td1, 5 => d1 + fd, _ => f64::NAN }
    } else {
        let td2 = iso965_td2(d, p, grade) / 1000.0;
        // Major tolerance exists only for grades 4, 6, 8; ISO 965-1 pairs the
        // other pitch grades with major grade 6 in common classes (e.g. 5g6g).
        let td = iso965_td(p, if [4, 6, 8].contains(&grade) { grade } else { 6 }) / 1000.0;
        match which { 0 => d + fd, 1 => d + fd - td, 2 => d2 + fd, 3 => d2 + fd - td2,
                      4 => thread_iso_d3(d, p) + fd, _ => f64::NAN }
    }
}

// ---------------------------------------------------------------------------
// Unified inch thread tolerances (ASME B1.1)
// ---------------------------------------------------------------------------

/// Pitch diameter tolerance, class 2A (inch), ASME B1.1 formula (title of its
/// Table 4): `0.0015 D^(1/3) + 0.0015 sqrt(LE) + 0.015 P^(2/3)`, here with the
/// length of engagement LE equal to the basic major diameter D. With LE = D
/// the formula reproduces every class 2A limit checked in a published table
/// (see `unified_2a_vs_published`); LE = 5P, which one free source states as
/// the default, does not (it gives 1-12 UNF 0.0053 in against the published
/// 0.0059 in). Not rounded; the standard tabulates limits to 0.0001 in.
pub fn un_pd_tol_2a(d: f64, p: f64) -> f64 {
    un_pd_tol_2a_le(d, p, d)
}

/// As [`un_pd_tol_2a`] with an explicit length of engagement `le` (inch).
pub fn un_pd_tol_2a_le(d: f64, p: f64, le: f64) -> f64 {
    0.0015 * d.cbrt() + 0.0015 * le.sqrt() + 0.015 * p.powf(2.0 / 3.0)
}

/// Pitch diameter tolerance for a Unified class, as a multiple of class 2A
/// (ASME B1.1): 1A 1.500, 2A 1.000, 3A 0.750, 1B 1.950, 2B 1.300, 3B 0.975.
/// `class`: 1, 2, 3 external (A); 11, 12, 13 internal (B).
pub fn un_pd_tol(d: f64, p: f64, class: u32) -> f64 {
    let k = match class { 1 => 1.5, 2 => 1.0, 3 => 0.75, 11 => 1.95, 12 => 1.3, 13 => 0.975, _ => return f64::NAN };
    // External classes: the factor applies to Td2(2A) as tabulated (0.0001 in);
    // internal classes: to the unrounded Td2(2A). This is the order that
    // reproduces the published 2A and 2B tables (see the tests).
    if class >= 11 { k * un_pd_tol_2a(d, p) } else { k * round4(un_pd_tol_2a(d, p)) }
}

/// Allowance (es) for classes 1A and 2A: `0.300 x Td2(2A)` (ASME B1.1);
/// zero for 3A and all internal classes.
pub fn un_allowance(d: f64, p: f64, class: u32) -> f64 {
    match class { 1 | 2 => round4(0.3 * round4(un_pd_tol_2a(d, p))), _ => 0.0 }
}

/// Major diameter tolerance, external: 2A and 3A `0.060 P^(2/3)`,
/// 1A `0.090 P^(2/3)` (ASME B1.1).
pub fn un_major_tol(p: f64, class: u32) -> f64 {
    match class { 1 => 0.090 * p.powf(2.0 / 3.0), 2 | 3 => 0.060 * p.powf(2.0 / 3.0), _ => f64::NAN }
}

fn round4(x: f64) -> f64 { (x * 10_000.0).round() / 10_000.0 }

/// Round half up to `dp` decimals, guarding against binary representation
/// (a tabulated 0.9385 must round to 0.939).
fn round_half_up(x: f64, dp: i32) -> f64 {
    let k = 10f64.powi(dp);
    ((x * k) + 1e-7).round() / k
}

/// Minor diameter tolerance of a class 2B internal Unified thread (inch),
/// ASME B1.1 rule: sizes 1/4 in and larger `0.25 P - 0.40 P^2`; smaller sizes
/// `0.05 P^(2/3) + 0.03 P / D - 0.002`, kept between 0.120 P and 0.394 P.
/// Rounded to 0.0001 in. This rule (with the rounding in [`un_minor_2b`])
/// reproduces 71 of the 74 rows of a published class 2B table; see
/// `unified_2b_minor_vs_published`.
pub fn un_minor_tol_2b(d: f64, p: f64) -> f64 {
    let t = if d >= 0.25 { 0.25 * p - 0.40 * p * p } else {
        (0.05 * p.powf(2.0 / 3.0) + 0.03 * p / d - 0.002).clamp(0.120 * p, 0.394 * p)
    };
    round4(t)
}

/// Class 2B minor diameter limits (inch): `which` 0 min, 1 max. The minimum is
/// the basic minor diameter D - 1.082532 P; the maximum is the basic minor
/// diameter (to 0.0001) plus the tolerance. Tabulated to 4 decimals for sizes
/// up to No. 5 (0.125 in) and to 3 decimals above, as the published tables are.
pub fn un_minor_2b(d: f64, p: f64, which: u32) -> f64 {
    let basic = thread_basic_minor_dia(d, p);
    let dp = if d <= 0.125 + 1e-9 { 4 } else { 3 };
    match which {
        0 => round_half_up(basic, dp),
        1 => round_half_up(round4(basic) + un_minor_tol_2b(d, p), dp),
        _ => f64::NAN,
    }
}

/// Unified thread limits, inch, rounded to 0.0001 in as tabulated in ASME B1.1.
/// `which`: 0 major max, 1 major min, 2 pitch max, 3 pitch min. Internal
/// classes give the pitch limits and the major minimum (basic). Minor
/// diameter limits of internal threads use several size-dependent rules and
/// are not computed here.
pub fn un_limit(d: f64, p: f64, class: u32, which: u32) -> f64 {
    let e = round4(thread_basic_pitch_dia(d, p));
    let a = un_allowance(d, p, class);
    let t = round4(un_pd_tol(d, p, class));
    if class >= 11 {
        return match which { 1 => d, 2 => round4(e + t), 3 => e, _ => f64::NAN };
    }
    let tm = round4(un_major_tol(p, class));
    match which { 0 => round4(d - a), 1 => round4(d - a - tm), 2 => round4(e - a), 3 => round4(e - a - t), _ => f64::NAN }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    #[test] fn basic_profile_constants() {
        close(thread_basic_pitch_dia(0.0, 1.0), -0.649519, 1e-6);
        close(thread_basic_minor_dia(0.0, 1.0), -1.082532, 1e-6);
        close(thread_iso_d3(0.0, 1.0), -1.226869, 1e-6);
        close(thread_basic_height(1.0), 0.541266, 1e-6);
    }
    #[test] fn m10_basic() {
        // M10 x 1.5: d2 = 9.026, D1 = 8.376, d3 = 8.160 (ISO 724 values are these, rounded to 0.001)
        close(thread_basic_pitch_dia(10.0, 1.5), 9.026, 5e-4);
        close(thread_basic_minor_dia(10.0, 1.5), 8.376, 5e-4);
        close(thread_iso_d3(10.0, 1.5), 8.160, 5e-4);
    }
    #[test] fn un_number_sizes() {
        close(un_number_major_in(0.0), 0.060, 1e-12);
        close(un_number_major_in(10.0), 0.190, 1e-12);
        close(un_number_major_in(12.0), 0.216, 1e-12);
    }
    #[test] fn cut_tap_rules() {
        // 1/4-20 at 75 %: 0.25 - 0.01299 x 75 / 20 = 0.20129
        close(tap_drill_cut(0.25, 1.0 / 20.0, 75.0), 0.201286, 1e-6);
        // Rule of thumb D - P is 76.98 % in this convention
        close(tap_pct_cut(6.0, 1.0, 5.0), 76.98, 0.01);
        close(tap_pct_cut(10.0, 1.5, tap_drill_cut(10.0, 1.5, 65.0)), 65.0, 1e-9);
        // drill at the basic minor diameter = 83.33 %
        close(tap_pct_cut(10.0, 1.5, thread_basic_minor_dia(10.0, 1.5)), 83.333, 1e-3);
    }
    #[test] fn form_tap_rules() {
        // M6 x 1 at 65 %: 6 - 0.0068 x 65 x 1 = 5.558
        close(tap_drill_form(6.0, 1.0, 65.0), 5.558, 1e-9);
        // 1/4-20 at 65 %: 0.25 - 0.0068 x 65 / 20 = 0.2279
        close(tap_drill_form(0.25, 0.05, 65.0), 0.2279, 1e-9);
        close(tap_pct_form(6.0, 1.0, 5.558), 65.0, 1e-9);
    }
    /// Basic dimensions printed by Optimas (ISO metric table, accessed
    /// 2026-11-10): d2, d3, D1 in mm, against the ISO 68-1 formulas. Two rows
    /// are left out because Optimas misprints them (M17x1 d3 15.733 for 15.773,
    /// M48 D1 42.857 for 42.587); see docs/sources.md.
    #[test] fn metric_basic_vs_optimas() {
        let rows: [(f64, f64, f64, f64, f64); 13] = [
            (1.0, 0.25, 0.838, 0.693, 0.729), (3.0, 0.5, 2.675, 2.387, 2.459), (6.0, 1.0, 5.35, 4.773, 4.917),
            (8.0, 1.25, 7.188, 6.466, 6.647), (10.0, 1.5, 9.026, 8.16, 8.376), (12.0, 1.75, 10.863, 9.853, 10.106),
            (16.0, 2.0, 14.701, 13.546, 13.835), (20.0, 2.5, 18.376, 16.933, 17.294), (24.0, 3.0, 22.051, 20.319, 20.752),
            (30.0, 3.5, 27.727, 25.706, 26.211), (36.0, 4.0, 33.402, 31.093, 31.67), (64.0, 6.0, 60.103, 56.639, 57.505),
            (12.0, 1.5, 11.026, 10.16, 10.376),
        ];
        for (d, p, d2, d3, d1) in rows {
            close(thread_basic_pitch_dia(d, p), d2, 6e-4);
            close(thread_iso_d3(d, p), d3, 6e-4);
            close(thread_basic_minor_dia(d, p), d1, 6e-4);
        }
        // the two misprints really are misprints
        assert!((thread_iso_d3(17.0, 1.0) - 15.733).abs() > 0.03);
        assert!((thread_basic_minor_dia(48.0, 5.0) - 42.857).abs() > 0.2);
    }

    /// Unified basic pitch diameter and internal minor diameter printed by
    /// Optimas (UNC/UNF table, accessed 2026-11-10), inch.
    #[test] fn unified_basic_vs_optimas() {
        let rows: [(f64, f64, f64, f64); 8] = [
            (0.25, 20.0, 0.2175, 0.1959), (0.5, 13.0, 0.4500, 0.4167), (0.19, 32.0, 0.1697, 0.1562), (0.75, 10.0, 0.6850, 0.6417),
            (1.0, 8.0, 0.9188, 0.8647), (0.112, 40.0, 0.0958, 0.0849), (0.25, 28.0, 0.2268, 0.2113), (4.0, 4.0, 3.8376, 3.7294),
        ];
        for (d, tpi, e, d1) in rows {
            close(thread_basic_pitch_dia(d, 1.0 / tpi), e, 6e-5);
            close(thread_basic_minor_dia(d, 1.0 / tpi), d1, 6e-5);
        }
    }

    /// Class 2A limits printed in a fastener supplier's table (American
    /// Fastener, "Cap screws", accessed 2026-11-10): (D, TPI, allowance, major
    /// max, major min, pitch max, pitch min). Two rows with obvious misprints
    /// (7/8-14 major max 0.0834; 1-1/4-7 allowance 0.0220) are left out.
    #[test] fn unified_2a_vs_published() {
        let rows: [(f64, f64, f64, f64, f64, f64, f64); 30] = [
            (0.060, 80.0, 0.0005, 0.0595, 0.0563, 0.0514, 0.0496), (0.073, 64.0, 0.0006, 0.0724, 0.0686, 0.0623, 0.0603),
            (0.073, 72.0, 0.0006, 0.0724, 0.0689, 0.0634, 0.0615), (0.086, 56.0, 0.0006, 0.0854, 0.0813, 0.0738, 0.0717),
            (0.112, 40.0, 0.0008, 0.1112, 0.1061, 0.0950, 0.0925), (0.138, 32.0, 0.0008, 0.1372, 0.1312, 0.1169, 0.1141),
            (0.164, 32.0, 0.0009, 0.1631, 0.1571, 0.1428, 0.1399), (0.190, 24.0, 0.0010, 0.1890, 0.1818, 0.1619, 0.1586),
            (0.190, 32.0, 0.0009, 0.1891, 0.1831, 0.1688, 0.1658), (0.250, 20.0, 0.0011, 0.2489, 0.2408, 0.2164, 0.2127),
            (0.250, 28.0, 0.0010, 0.2490, 0.2425, 0.2258, 0.2225), (0.3125, 18.0, 0.0012, 0.3113, 0.3026, 0.2752, 0.2712),
            (0.3125, 24.0, 0.0011, 0.3114, 0.3042, 0.2843, 0.2806), (0.375, 16.0, 0.0013, 0.3737, 0.3643, 0.3331, 0.3287),
            (0.375, 24.0, 0.0011, 0.3739, 0.3667, 0.3468, 0.3430), (0.4375, 14.0, 0.0014, 0.4361, 0.4258, 0.3897, 0.3850),
            (0.500, 13.0, 0.0015, 0.4985, 0.4876, 0.4485, 0.4435), (0.500, 20.0, 0.0013, 0.4987, 0.4906, 0.4662, 0.4619),
            (0.5625, 12.0, 0.0016, 0.5609, 0.5495, 0.5068, 0.5016), (0.625, 11.0, 0.0016, 0.6234, 0.6113, 0.5644, 0.5589),
            (0.750, 10.0, 0.0018, 0.7482, 0.7353, 0.6832, 0.6773), (0.750, 16.0, 0.0015, 0.7485, 0.7391, 0.7079, 0.7029),
            (0.875, 9.0, 0.0019, 0.8731, 0.8592, 0.8009, 0.7946), (1.0, 8.0, 0.0020, 0.9980, 0.9830, 0.9168, 0.9100),
            (1.0, 12.0, 0.0018, 0.9982, 0.9868, 0.9441, 0.9382), (1.5, 6.0, 0.0024, 1.4976, 1.4794, 1.3893, 1.3812),
            (1.75, 5.0, 0.0027, 1.7473, 1.7268, 1.6174, 1.6085), (2.0, 4.5, 0.0029, 1.9971, 1.9751, 1.8528, 1.8433),
            (3.0, 4.0, 0.0032, 2.9968, 2.9730, 2.8344, 2.8237), (4.0, 8.0, 0.0027, 3.9973, 3.9823, 3.9161, 3.9070),
        ];
        let mut bad = Vec::new();
        for (d, tpi, a, mj, mn, px, pn) in rows {
            let p = 1.0 / tpi;
            let got = [un_allowance(d, p, 2), un_limit(d, p, 2, 0), un_limit(d, p, 2, 1), un_limit(d, p, 2, 2), un_limit(d, p, 2, 3)];
            let want = [a, mj, mn, px, pn];
            for k in 0..5 { if (got[k] - want[k]).abs() > 1.5e-4 { bad.push((d, tpi, k, got[k], want[k])); } }
        }
        assert!(bad.is_empty(), "{bad:?}");
    }

    /// Class 6g limits printed by Optimas ("ISO metric screw thread
    /// tolerances", coarse, accessed 2026-11-10), mm:
    /// (d, P, major max, major min, pitch max, pitch min).
    /// M2.5 is left out: its pitch minimum is printed 2.117 (above the
    /// maximum 2.118, a misprint of 2.017? see docs/sources.md).
    pub(crate) const OPTIMAS_6G: [(f64, f64, f64, f64, f64, f64); 26] = [
        (1.0, 0.25, 1.0, 0.933, 0.838, 0.785), (1.2, 0.25, 1.2, 1.133, 1.038, 0.985), (1.4, 0.3, 1.4, 1.325, 1.205, 1.149),
        (1.6, 0.35, 1.581, 1.496, 1.354, 1.291), (1.8, 0.35, 1.781, 1.696, 1.554, 1.491), (2.0, 0.4, 1.981, 1.886, 1.721, 1.654),
        (3.0, 0.5, 2.98, 2.874, 2.655, 2.58), (3.5, 0.6, 3.479, 3.354, 3.089, 3.004), (4.0, 0.7, 3.978, 3.838, 3.523, 3.433),
        (5.0, 0.8, 4.976, 4.826, 4.456, 4.361), (6.0, 1.0, 5.974, 5.794, 5.324, 5.212), (7.0, 1.0, 6.974, 6.794, 6.324, 6.212),
        (8.0, 1.25, 7.972, 7.76, 7.16, 7.042), (10.0, 1.5, 9.968, 9.732, 8.994, 8.862), (12.0, 1.75, 11.966, 11.701, 10.829, 10.679),
        (14.0, 2.0, 13.962, 13.682, 12.663, 12.503), (16.0, 2.0, 15.962, 15.682, 14.663, 14.503), (18.0, 2.5, 17.958, 17.623, 16.334, 16.164),
        (20.0, 2.5, 19.958, 19.623, 18.334, 18.164), (22.0, 2.5, 21.958, 21.623, 20.334, 20.164), (24.0, 3.0, 23.952, 23.577, 22.003, 21.803),
        (27.0, 3.0, 26.952, 26.577, 25.003, 24.803), (30.0, 3.5, 29.947, 29.522, 27.674, 27.462), (33.0, 3.5, 32.947, 32.522, 30.674, 30.462),
        (36.0, 4.0, 35.94, 35.465, 33.342, 33.118), (39.0, 4.0, 38.94, 38.465, 36.342, 36.118),
    ];

    /// Class 6H limits printed by CDE Fasteners ("Nuts: internal threads,
    /// class 6H", June 2000, accessed 2026-11-10), mm:
    /// (D, P, pitch min, pitch max, minor min, minor max).
    pub(crate) const CDE_6H: [(f64, f64, f64, f64, f64, f64); 20] = [
        (1.6, 0.35, 1.373, 1.458, 1.221, 1.321), (2.0, 0.4, 1.740, 1.830, 1.567, 1.679), (2.5, 0.45, 2.208, 2.303, 2.013, 2.138),
        (3.0, 0.5, 2.675, 2.775, 2.459, 2.599), (4.0, 0.7, 3.545, 3.663, 3.242, 3.422), (5.0, 0.8, 4.480, 4.605, 4.134, 4.334),
        (6.0, 1.0, 5.350, 5.500, 4.917, 5.153), (8.0, 1.25, 7.188, 7.348, 6.647, 6.912), (10.0, 1.5, 9.026, 9.206, 8.376, 8.676),
        (12.0, 1.75, 10.863, 11.063, 10.106, 10.441), (14.0, 2.0, 12.701, 12.913, 11.835, 12.210), (16.0, 2.0, 14.701, 14.913, 13.835, 14.210),
        (20.0, 2.5, 18.376, 18.600, 17.294, 17.744), (24.0, 3.0, 22.051, 22.316, 20.752, 21.252), (30.0, 3.5, 27.727, 28.007, 26.211, 26.771),
        (36.0, 4.0, 33.402, 33.702, 31.670, 32.270), (42.0, 4.5, 39.077, 39.392, 37.129, 37.799), (48.0, 5.0, 44.752, 45.087, 42.587, 43.297),
        (56.0, 5.5, 52.428, 52.783, 50.046, 50.796), (64.0, 6.0, 60.103, 60.478, 57.505, 58.305),
    ];

    /// Number of R40 steps between two tolerance values (um).
    fn r40_steps(a: f64, b: f64) -> f64 { ((a / b).ln() / (10f64.ln() / 40.0)).abs().round() }

    /// 6g (and 6h for M1 to M1.4, which Optimas prints as 6h) against the
    /// published limits. The formulas reproduce every value except the ones
    /// listed, where the published value is one R40 step away from the
    /// formula value: the standard's tables, not the formulas, are normative.
    #[test] fn iso965_6g_vs_published() {
        let exceptions = [(3.0, 3usize), (36.0, 1), (39.0, 1)];
        let mut bad = Vec::new();
        for (d, p, mx, mn, px, pn) in OPTIMAS_6G {
            let pos = if d < 1.5 { 4 } else { 3 };
            let got = [iso965_limit(d, p, 6, pos, 0), iso965_limit(d, p, 6, pos, 1), iso965_limit(d, p, 6, pos, 2), iso965_limit(d, p, 6, pos, 3)];
            for (k, w) in [mx, mn, px, pn].iter().enumerate() {
                let off = (got[k] - w).abs() > 6e-4;
                let listed = exceptions.contains(&(d, k));
                if off != listed { bad.push((d, p, k, got[k], *w)); }
            }
        }
        assert!(bad.is_empty(), "{bad:?}");
        // the listed cases are one R40 step off: M3 Td2 75 (formula 80), M36/M39 Td 475 (formula 450)
        assert_eq!(r40_steps(iso965_td2(3.0, 0.5, 6), 75.0), 1.0);
        assert_eq!(r40_steps(iso965_td(4.0, 6), 475.0), 1.0);
    }

    #[test] fn iso965_6h_vs_published() {
        // (D, index): 0 pitch min, 1 pitch max, 2 minor min, 3 minor max
        let exceptions = [(2.5, 1usize), (3.0, 1), (3.0, 3), (10.0, 1), (20.0, 3), (42.0, 1)];
        let mut bad = Vec::new();
        for (d, p, pn, px, mn, mx) in CDE_6H {
            let got = [iso965_limit(d, p, 6, 12, 3), iso965_limit(d, p, 6, 12, 2), iso965_limit(d, p, 6, 12, 5), iso965_limit(d, p, 6, 12, 4)];
            for (k, w) in [pn, px, mn, mx].iter().enumerate() {
                let off = (got[k] - w).abs() > 6e-4;
                if off != exceptions.contains(&(d, k)) { bad.push((d, p, k, got[k], *w)); }
            }
        }
        assert!(bad.is_empty(), "{bad:?}");
        // each exception is one R40 step: TD2 M2.5 95 (90), M3 100 (106), M10 180 (170), M42 315 (300); TD1 M3 140 (132), M20 450 (425)
        assert_eq!(r40_steps(iso965_td2_internal(2.5, 0.45, 6), 95.0), 1.0);
        assert_eq!(r40_steps(iso965_td2_internal(3.0, 0.5, 6), 100.0), 1.0);
        assert_eq!(r40_steps(iso965_td2_internal(10.0, 1.5, 6), 180.0), 1.0);
        assert_eq!(r40_steps(iso965_td2_internal(42.0, 4.5, 6), 315.0), 1.0);
        assert_eq!(r40_steps(iso965_td1(0.5, 6), 140.0), 1.0);
        assert_eq!(r40_steps(iso965_td1(2.5, 6), 450.0), 1.0);
    }

    const AF_2B_MINOR: [(&str, f64, f64, f64, f64); 74] = [
        ("0-80 UNF", 0.06, 80.0, 0.0465, 0.0514),
        ("1-64 UNC", 0.073, 64.0, 0.0561, 0.0623),
        ("1-72 UNF", 0.073, 72.0, 0.058, 0.0635),
        ("2-56 UNC", 0.086, 56.0, 0.0667, 0.0737),
        ("2-64 UNF", 0.086, 64.0, 0.0691, 0.0753),
        ("3-48 UNC", 0.099, 48.0, 0.0764, 0.0845),
        ("3-56 UNF", 0.099, 56.0, 0.0797, 0.0865),
        ("4-40 UNC", 0.112, 40.0, 0.0849, 0.0939),
        ("4-48 UNF", 0.112, 48.0, 0.0894, 0.0968),
        ("5-40 UNC", 0.125, 40.0, 0.0979, 0.1062),
        ("5-44 UNF", 0.125, 44.0, 0.1004, 0.1079),
        ("6-32 UNC", 0.138, 32.0, 0.104, 0.114),
        ("6-40 UNF", 0.138, 40.0, 0.111, 0.119),
        ("8-32 UNC", 0.164, 32.0, 0.13, 0.139),
        ("8-36 UNF", 0.164, 36.0, 0.134, 0.142),
        ("10-24 UNC", 0.19, 24.0, 0.145, 0.156),
        ("10-32 UNF", 0.19, 32.0, 0.156, 0.164),
        ("12-24 UNC", 0.216, 24.0, 0.171, 0.181),
        ("12-28 UNF", 0.216, 28.0, 0.177, 0.186),
        ("1/4-20 UNC", 0.25, 20.0, 0.196, 0.207),
        ("1/4-28 UNF", 0.25, 28.0, 0.211, 0.22),
        ("5/16-18 UNC", 0.3125, 18.0, 0.252, 0.265),
        ("5/16-24 UNF", 0.3125, 24.0, 0.267, 0.277),
        ("3/8-16 UNC", 0.375, 16.0, 0.307, 0.321),
        ("3/8-24 UNF", 0.375, 24.0, 0.33, 0.034),
        ("7/16-14 UNC", 0.4375, 14.0, 0.36, 0.376),
        ("7/16-20 UNF", 0.4375, 20.0, 0.383, 0.395),
        ("1/2-13 UNC", 0.5, 13.0, 0.417, 0.434),
        ("1/2-20 UNF", 0.5, 20.0, 0.446, 0.457),
        ("9/16-12 UNC", 0.5625, 12.0, 0.472, 0.49),
        ("9/16-18 UNF", 0.5625, 18.0, 0.502, 0.515),
        ("5/8-11 UNC", 0.625, 11.0, 0.527, 0.546),
        ("5/8-18 UNF", 0.625, 18.0, 0.565, 0.578),
        ("3/4-10 UNC", 0.75, 10.0, 0.642, 0.663),
        ("3/4-16 UNF", 0.75, 16.0, 0.682, 0.696),
        ("7/8-9 UNC", 0.875, 9.0, 0.755, 0.778),
        ("7/8-14 UNF", 0.875, 14.0, 0.798, 0.814),
        ("1-8 UNC", 1.0, 8.0, 0.865, 0.89),
        ("1-12 UNF", 1.0, 12.0, 0.91, 0.928),
        ("1-14 UNS", 1.0, 14.0, 0.923, 0.938),
        ("11/8-7 UNC", 1.125, 7.0, 0.97, 0.998),
        ("11/8-8 UN", 1.125, 8.0, 0.99, 1.015),
        ("11/812 UNF", 1.125, 12.0, 1.035, 1.053),
        ("11/4-7 UNC", 1.25, 7.0, 1.095, 1.123),
        ("11/4-8 UN", 1.25, 8.0, 1.115, 1.14),
        ("11/4-12 UNF", 1.25, 12.0, 1.16, 1.178),
        ("1 3/8-6 UNC", 1.375, 6.0, 1.195, 1.225),
        ("1 3/8-8 UN", 1.375, 8.0, 1.24, 1.265),
        ("1 3/8-12 UNF", 1.375, 12.0, 1.285, 1.303),
        ("11/2-6 UNC", 1.5, 6.0, 1.32, 1.35),
        ("11/2-8 UN", 1.5, 8.0, 1.365, 1.39),
        ("11/2-12 UNC", 1.5, 12.0, 1.41, 1.428),
        ("1 5/8-8 UN", 1.625, 8.0, 1.49, 1.515),
        ("1 3/4-5 UNC", 1.75, 5.0, 1.534, 1.568),
        ("1 3/4-8 UN", 1.75, 8.0, 1.615, 1.64),
        ("1 7/8-8 UN", 1.875, 8.0, 1.74, 1.765),
        ("2-41/2 UNC", 2.0, 4.5, 1.759, 1.795),
        ("2-8 UN", 2.0, 8.0, 1.865, 1.89),
        ("2 1/4-4.5 UNC", 2.25, 4.5, 2.009, 2.045),
        ("2 1/4-8 UN", 2.25, 8.0, 2.115, 2.14),
        ("2 1/2-4 UNC", 2.5, 4.0, 2.229, 2.267),
        ("2 1/2-8 UN", 2.5, 8.0, 2.365, 2.39),
        ("2 3/4-4 UNC", 2.75, 4.0, 2.479, 2.517),
        ("2 3/4-8 UN", 2.75, 8.0, 2.615, 2.64),
        ("3-4 UNC", 3.0, 4.0, 2.729, 2.767),
        ("3-8 UN", 3.0, 8.0, 2.865, 2.89),
        ("3 1/4-4 UNC", 3.25, 4.0, 2.979, 3.017),
        ("31/4-8 UN", 3.25, 8.0, 3.115, 3.14),
        ("3 1/2-4 UNC", 3.5, 4.0, 3.229, 3.267),
        ("31/2-8 UN", 3.5, 8.0, 3.365, 3.39),
        ("3 3/4-4 UNC", 3.75, 4.0, 3.479, 3.517),
        ("3 3/4-8 UN", 3.75, 8.0, 3.615, 3.64),
        ("4-4 UNC", 4.0, 4.0, 3.729, 3.767),
        ("4-8 UN", 4.0, 8.0, 3.865, 3.89),
    ];
    const AF_2B_PITCH: [(&str, f64, f64, f64, f64); 74] = [
        ("0-80 UNF", 0.06, 80.0, 0.0519, 0.0542),
        ("1-64 UNC", 0.073, 64.0, 0.0629, 0.0655),
        ("1-72 UNF", 0.073, 72.0, 0.064, 0.0665),
        ("2-56 UNC", 0.086, 56.0, 0.0744, 0.0772),
        ("2-64 UNF", 0.086, 64.0, 0.0759, 0.0786),
        ("3-48 UNC", 0.099, 48.0, 0.0855, 0.0885),
        ("3-56 UNF", 0.099, 56.0, 0.0874, 0.0902),
        ("4-40 UNC", 0.112, 40.0, 0.0958, 0.0991),
        ("4-48 UNF", 0.112, 48.0, 0.0985, 0.1016),
        ("5-40 UNC", 0.125, 40.0, 0.1088, 0.1121),
        ("5-44 UNF", 0.125, 44.0, 0.1102, 0.1134),
        ("6-32 UNC", 0.138, 32.0, 0.1177, 0.1214),
        ("6-40 UNF", 0.138, 40.0, 0.1218, 0.1252),
        ("8-32 UNC", 0.164, 32.0, 0.1437, 0.1475),
        ("8-36 UNF", 0.164, 36.0, 0.146, 0.1496),
        ("10-24 UNC", 0.19, 24.0, 0.1629, 0.1672),
        ("10-32 UNF", 0.19, 32.0, 0.1697, 0.1736),
        ("12-24 UNC", 0.216, 24.0, 0.1889, 0.1933),
        ("12-28 UNF", 0.216, 28.0, 0.1928, 0.197),
        ("1/4-20 UNC", 0.25, 20.0, 0.2175, 0.2224),
        ("1/4-28 UNF", 0.25, 28.0, 0.2268, 0.2311),
        ("5/16-18 UNC", 0.3125, 18.0, 0.2764, 0.2817),
        ("5/16-24 UNF", 0.3125, 24.0, 0.2854, 0.2902),
        ("3/8-16 UNC", 0.375, 16.0, 0.3344, 0.3401),
        ("3/8-24 UNF", 0.375, 24.0, 0.3479, 0.3528),
        ("7/16-14 UNC", 0.4375, 14.0, 0.3911, 0.3972),
        ("7/16-20 UNF", 0.4375, 20.0, 0.405, 0.4104),
        ("1/2-13 UNC", 0.5, 13.0, 0.45, 0.4565),
        ("1/2-20 UNF", 0.5, 20.0, 0.4675, 0.4731),
        ("9/16-12 UNC", 0.5625, 12.0, 0.5084, 0.5152),
        ("9/16-18 UNF", 0.5625, 18.0, 0.5264, 0.5323),
        ("5/8-11 UNC", 0.625, 11.0, 0.566, 0.5732),
        ("5/8-18 UNF", 0.625, 18.0, 0.5889, 0.5949),
        ("3/4-10 UNC", 0.75, 10.0, 0.685, 0.6927),
        ("3/4-16 UNF", 0.75, 16.0, 0.7094, 0.7159),
        ("7/8-9 UNC", 0.875, 9.0, 0.8028, 0.811),
        ("7/8-14 UNF", 0.875, 14.0, 0.8286, 0.8356),
        ("1-8 UNC", 1.0, 8.0, 0.9188, 0.9276),
        ("1-12 UNF", 1.0, 12.0, 0.9459, 0.9535),
        ("1-14 UNS", 1.0, 14.0, 0.9536, 0.9609),
        ("11/8-7 UNC", 1.125, 7.0, 1.322, 1.0416),
        ("11/8-8 UN", 1.125, 8.0, 1.0438, 0.0528),
        ("11/812 UNF", 1.125, 12.0, 1.0709, 1.0787),
        ("11/4-7 UNC", 1.25, 7.0, 1.1572, 1.668),
        ("11/4-8 UN", 1.25, 8.0, 1.1688, 1.178),
        ("11/4-12 UNF", 1.25, 12.0, 1.1959, 1.2039),
        ("1 3/8-6 UNC", 1.375, 6.0, 1.2667, 1.2771),
        ("1 3/8-8 UN", 1.375, 8.0, 1.2938, 1.3031),
        ("1 3/8-12 UNF", 1.375, 12.0, 1.3209, 1.3291),
        ("11/2-6 UNC", 1.5, 6.0, 1.3917, 1.4022),
        ("11/2-8 UN", 1.5, 8.0, 1.4188, 1.4283),
        ("11/2-12 UNC", 1.5, 12.0, 1.4459, 1.4542),
        ("1 5/8-8 UN", 1.625, 8.0, 1.5438, 1.5535),
        ("1 3/4-5 UNC", 1.75, 5.0, 1.6201, 1.6317),
        ("1 3/4-8 UN", 1.75, 8.0, 1.6688, 1.6786),
        ("1 7/8-8 UN", 1.875, 8.0, 1.7938, 1.8038),
        ("2-41/2 UNC", 2.0, 4.5, 1.8557, 1.8681),
        ("2-8 UN", 2.0, 8.0, 1.9188, 1.9289),
        ("2 1/4-4.5 UNC", 2.25, 4.5, 2.1057, 2.1183),
        ("2 1/4-8 UN", 2.25, 8.0, 2.1688, 2.1792),
        ("2 1/2-4 UNC", 2.5, 4.0, 2.3376, 2.3511),
        ("2 1/2-8 UN", 2.5, 8.0, 2.4188, 2.4294),
        ("2 3/4-4 UNC", 2.75, 4.0, 2.5876, 2.6013),
        ("2 3/4-8 UN", 2.75, 8.0, 2.6688, 2.6796),
        ("3-4 UNC", 3.0, 4.0, 2.8376, 2.8515),
        ("3-8 UN", 3.0, 8.0, 2.9188, 2.9299),
        ("3 1/4-4 UNC", 3.25, 4.0, 3.0876, 3.1017),
        ("31/4-8 UN", 3.25, 8.0, 3.1688, 3.1801),
        ("3 1/2-4 UNC", 3.5, 4.0, 3.3376, 3.3519),
        ("31/2-8 UN", 3.5, 8.0, 3.4188, 3.4303),
        ("3 3/4-4 UNC", 3.75, 4.0, 3.5876, 3.6021),
        ("3 3/4-8 UN", 3.75, 8.0, 3.6688, 3.6805),
        ("4-4 UNC", 4.0, 4.0, 3.8376, 3.8523),
        ("4-8 UN", 4.0, 8.0, 3.9188, 3.9307),
    ];
    /// Balax (a forming-tap maker), "A Balax, Inc. Guide to Tapping in the 21st
    /// Century" (2011/2012), p. 3 and p. 20: hole sizes for 75 / 65 / 55 %
    /// thread for its thread forming taps, miniature sizes (inch). The maker
    /// does not state its formula. The D - 0.0068 x % / TPI rule published by
    /// FM Carbide and Engineers Edge gives holes 0 to 0.0016 in smaller than
    /// Balax prints (one cell 0.0002 in larger), so it is an approximation of
    /// the maker's practice, not its formula.
    /// American Fastener, "Nuts: internal threads, class 2B" (accessed
    /// 2026-11-10): minor diameter min and max. Three rows are not reproduced:
    /// 3/8-24 max printed .0340 (a digit error for .340), 1-14 UNS (special
    /// series; the rule gives .939 against .938 printed) and 1 3/4-5 min
    /// printed 1.534 (basic minor 1.53349; the max 1.568 agrees).
    /// Same American Fastener class 2B table: pitch diameter min and max.
    /// Printed digit errors: 1 1/8-7 min 1.3220 (1.0322), 1 1/8-8 max 0.0528
    /// (1.0528), 1 1/4-7 max 1.6680 (1.1668). Two rows sit on a rounding tie
    /// of the unrounded tolerance and differ by 0.0001 in: 1/4-20 (.2224
    /// printed, E + TD2 = .222350) and 1 7/8-8 (1.8038 printed).
    #[test] fn unified_2b_pitch_vs_published() {
        let misprint = ["11/8-7 UNC", "11/8-8 UN", "11/4-7 UNC"];
        let tie = ["1/4-20 UNC", "1 7/8-8 UN"];
        let mut n = 0;
        for (name, d, tpi, pmin, pmax) in AF_2B_PITCH {
            let p = 1.0 / tpi;
            if misprint.contains(&name) { continue; }
            close(un_limit(d, p, 12, 3), pmin, 1e-9);
            if tie.contains(&name) { close(un_limit(d, p, 12, 2), pmax, 1.0001e-4); continue; }
            close(un_limit(d, p, 12, 2), pmax, 1e-9);
            n += 1;
        }
        assert_eq!(n, 69);
    }

    #[test] fn unified_2b_minor_vs_published() {
        let skip = ["3/8-24 UNF", "1-14 UNS", "1 3/4-5 UNC"];
        let mut n = 0;
        for (name, d, tpi, mn, mx) in AF_2B_MINOR {
            let p = 1.0 / tpi;
            if skip.contains(&name) { continue; }
            close(un_minor_2b(d, p, 0), mn, 1e-9);
            close(un_minor_2b(d, p, 1), mx, 1e-9);
            n += 1;
        }
        assert_eq!(n, 71);
        // the exceptions, as recorded
        close(un_minor_2b(0.375, 1.0 / 24.0, 1), 0.340, 1e-9);
        close(un_minor_2b(1.0, 1.0 / 14.0, 1), 0.939, 1e-9);
        close(un_minor_2b(1.75, 0.2, 0), 1.533, 1e-9);
        close(un_minor_2b(1.75, 0.2, 1), 1.568, 1e-9);
    }

    #[test] fn form_tap_vs_balax() {
        let rows: [(f64, f64, [f64; 3]); 9] = [
            (0.060, 80.0, [0.0546, 0.0552, 0.0558]), (0.073, 64.0, [0.066, 0.067, 0.068]), (0.073, 72.0, [0.067, 0.068, 0.069]),
            (0.086, 56.0, [0.078, 0.079, 0.080]), (0.086, 64.0, [0.079, 0.080, 0.081]), (0.099, 48.0, [0.090, 0.091, 0.092]),
            (1.0 / 25.4, 101.6, [0.0348, 0.0353, 0.0358]), (1.2 / 25.4, 101.6, [0.0427, 0.0432, 0.0437]), (1.4 / 25.4, 25.4 / 0.3, [0.0493, 0.0499, 0.0505]),
        ];
        for (d, tpi, holes) in rows {
            for (i, pct) in [75.0, 65.0, 55.0].into_iter().enumerate() {
                let diff = holes[i] - tap_drill_form(d, 1.0 / tpi, pct);
                assert!((-0.0003..=0.0017).contains(&diff), "D {d} TPI {tpi} {pct}%: Balax {} formula diff {diff}", holes[i]);
            }
        }
    }

    #[test] fn r40_rounding() {
        close(round_r40_um(130.18), 132.0, 0.0);
        close(round_r40_um(233.3), 236.0, 0.0);
        close(round_r40_um(230.0), 236.0, 0.0); // tie on a linear scale, R40 decides on log scale
        close(round_r40_um(31.5), 32.0, 0.0);
        close(round_r40_um(42.5), 42.0, 0.0);
        close(round_r40_um(64.5), 63.0, 0.0);
    }
}

/// f64 interface for WebAssembly: see [`iso965_limit`].
pub fn iso965_limit_f(d: f64, p: f64, grade: f64, pos: f64, which: f64) -> f64 {
    iso965_limit(d, p, grade as u32, pos as u32, which as u32)
}

/// f64 interface: `what` 0 Td2, 1 TD2, 2 Td, 3 TD1 (um, rounded), 4 fundamental
/// deviation of position `grade` (here the position code, see
/// [`iso965_fundamental_dev`]).
pub fn iso965_value_f(d: f64, p: f64, grade: f64, what: f64) -> f64 {
    let g = grade as u32;
    match what as i32 { 0 => iso965_td2(d, p, g), 1 => iso965_td2_internal(d, p, g), 2 => iso965_td(p, g), 3 => iso965_td1(p, g),
                        4 => iso965_fundamental_dev(p, g), _ => f64::NAN }
}

/// f64 interface for WebAssembly: see [`un_limit`]; `which` 4 = PD tolerance,
/// 6, 7 = class 2B minor diameter min, max (other classes NaN),
/// 5 = allowance.
pub fn un_limit_f(d: f64, p: f64, class: f64, which: f64) -> f64 {
    let c = class as u32;
    match which as i32 { 4 => round4(un_pd_tol(d, p, c)), 5 => un_allowance(d, p, c),
                         6 if c == 12 => un_minor_2b(d, p, 0), 7 if c == 12 => un_minor_2b(d, p, 1), 6 | 7 => f64::NAN,
                         w => un_limit(d, p, c, w as u32) }
}
