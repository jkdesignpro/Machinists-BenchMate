//! ISO limits and fits (ISO 286-1:2010, ISO code system for tolerances on
//! linear sizes).
//!
//! ISO 286-1 gives the standard tolerances (IT grades) and fundamental
//! deviations as normative tables. The formulas they were derived from are
//! stated in the standard's annex and in ISO/R 286:1962, but the tables do
//! not follow the formulas exactly: some values were set from experience
//! (notably sizes up to 3 mm, IT1 to IT4, and letters a, b, c, u to zc below
//! about 10 mm) and the rounding differs in places. BenchMate therefore:
//!
//! * takes the tabulated IT values and shaft fundamental deviations from
//!   published tables, each value printed by at least two independent
//!   publishers (`data/refdata/iso286-evidence.json`), and
//! * computes everything else here: the formula values (shown alongside so
//!   the user can see the derivation), the hole deviations from the shaft
//!   deviations by the ISO 286-1 rules (general rule, the delta rule for
//!   K, M, N and P to ZC), the limits of a tolerance class, and the
//!   clearance or interference of a fit.
//!
//! Units: sizes in mm, deviations and tolerances in micrometres (um).

/// Standard tolerance factor `i = 0.45 D^(1/3) + 0.001 D` (um), D = geometric
/// mean of the size step in mm (ISO 286-1 annex; ISO/R 286:1962 clause 2.1.2.1).
/// For the first step (up to 3 mm) the geometric mean of 1 and 3 is used.
pub fn iso286_tolerance_factor(d_mean: f64) -> f64 {
    0.45 * d_mean.cbrt() + 0.001 * d_mean
}

/// Geometric mean of a size step (lo, hi]; lo = 0 is taken as 1 mm.
pub fn iso286_step_mean(lo: f64, hi: f64) -> f64 {
    (if lo > 0.0 { lo } else { 1.0 } * hi).sqrt()
}

/// Multiplier of `i` for IT5 to IT18 (ISO 286-1 annex):
/// 7, 10, 16, 25, 40, 64, 100, 160, 250, 400, 640, 1000, 1600, 2500.
pub fn iso286_it_multiplier(grade: u32) -> f64 {
    const M: [f64; 14] = [7.0, 10.0, 16.0, 25.0, 40.0, 64.0, 100.0, 160.0, 250.0, 400.0, 640.0, 1000.0, 1600.0, 2500.0];
    if (5..=18).contains(&grade) { M[(grade - 5) as usize] } else { f64::NAN }
}

/// Unrounded standard tolerance from the formulas, um. Grade codes: 0 = IT0,
/// 100 = IT01, 1..18 = IT1..IT18. IT01 = 0.3 + 0.008 D, IT0 = 0.5 + 0.012 D,
/// IT1 = 0.8 + 0.020 D; IT2 to IT4 are spaced geometrically between IT1 and
/// IT5; IT5 to IT18 = multiplier x i.
pub fn iso286_it_formula(d_mean: f64, grade: u32) -> f64 {
    let i = iso286_tolerance_factor(d_mean);
    match grade {
        100 => 0.3 + 0.008 * d_mean,
        0 => 0.5 + 0.012 * d_mean,
        1 => 0.8 + 0.020 * d_mean,
        2..=4 => {
            let it1 = 0.8 + 0.020 * d_mean;
            let it5 = 7.0 * i;
            it1 * (it5 / it1).powf((grade - 1) as f64 / 4.0)
        }
        5..=18 => iso286_it_multiplier(grade) * i,
        _ => f64::NAN,
    }
}

/// The formula value rounded the way the published IT5 to IT10 values
/// above 3 mm are rounded (reconstructed by BenchMate from the tables, not
/// quoted from the standard): to 1 um up to 100 um, 5 um up to 200 um,
/// 10 um above. Grades 11 and up are 10 x the grade five lower (rounded),
/// which the published tables follow exactly. See `tests` for where this
/// reproduces the tables and where it does not.
pub fn iso286_it_rounded(d_mean: f64, grade: u32) -> f64 {
    if grade >= 11 && grade <= 18 { return 10.0 * iso286_it_rounded(d_mean, grade - 5); }
    let v = iso286_it_formula(d_mean, grade);
    let step = if v <= 100.0 { 1.0 } else if v <= 200.0 { 5.0 } else { 10.0 };
    (v / step).round() * step
}

/// Delta for the hole rules: `delta = IT(n) - IT(n-1)` from the tabulated
/// values (ISO 286-1, holes K, M, N up to IT8 and P to ZC up to IT7).
/// Zero for sizes up to 3 mm and over 500 mm, where the rule does not apply
/// (above 500 mm holes K to U follow the general rule ES = -ei; checked
/// against GOST 25346-89 Table 3 in `inspect` tests).
pub fn iso286_delta(it_n: f64, it_n_minus_1: f64, size_hi: f64) -> f64 {
    if size_hi <= 3.0 || size_hi > 500.0 { 0.0 } else { it_n - it_n_minus_1 }
}

/// Letter codes used by the f64 interface (shafts lower case, holes the same
/// code): a 1, b 2, c 3, cd 4, d 5, e 6, ef 7, f 8, fg 9, g 10, h 11, js 12,
/// k 13, m 14, n 15, p 16, r 17, s 18, t 19, u 20, v 21, x 22, y 23, z 24,
/// za 25, zb 26, zc 27.
pub const LETTERS: [&str; 28] = ["", "a", "b", "c", "cd", "d", "e", "ef", "f", "fg", "g", "h", "js", "k", "m", "n",
                                 "p", "r", "s", "t", "u", "v", "x", "y", "z", "za", "zb", "zc"];

/// Limits of a shaft tolerance class, um: returns (es, ei).
/// `fd` = tabulated fundamental deviation of the letter (es for a..h, ei for
/// k..zc; for k pass the IT4-IT7 value: ISO 286-1 makes it 0 for IT3 and
/// below and IT8 and above, which is applied here); `it` = IT value of the grade.
pub fn iso286_shaft_limits(letter: u32, grade: u32, fd: f64, it: f64) -> (f64, f64) {
    match letter {
        1..=11 => (fd, fd - it),
        12 => (it / 2.0, -it / 2.0),
        13 => { let ei = if (4..=7).contains(&grade) { fd } else { 0.0 }; (ei + it, ei) }
        14..=27 => (fd + it, fd),
        _ => (f64::NAN, f64::NAN),
    }
}

/// Fundamental deviation of a hole, um, from the shaft deviation of the same
/// letter by the ISO 286-1 rules. Returns EI for A..H and ES for K..ZC
/// (JS is symmetric and handled by [`iso286_hole_limits`]).
/// * A to H: `EI = -es`.
/// * K: up to IT8, `ES = -ei(k, IT4-7 value) + delta`; above IT8, `ES = 0`;
///   up to 3 mm, `ES = 0`.
/// * M: up to IT8, `ES = -ei(m) + delta`; above IT8, `ES = -ei(m)`;
///   one tabulated exception, M6 over 250 to 315 mm, ES = -9.
/// * N: up to IT8, `ES = -ei(n) + delta`; above IT8, `ES = 0`; up to 3 mm,
///   `ES = -4` for all grades (= -ei(n)).
/// * P to ZC: up to IT7, `ES = -ei + delta`; above IT7, `ES = -ei`.
/// `shaft_fd` = tabulated shaft fundamental deviation; `delta` from
/// [`iso286_delta`] (0 for sizes up to 3 mm).
pub fn iso286_hole_fd(letter: u32, grade: u32, shaft_fd: f64, delta: f64, size_lo: f64, size_hi: f64) -> f64 {
    let small = size_hi <= 3.0;
    match letter {
        1..=11 => -shaft_fd,
        13 => if small || grade > 8 { 0.0 } else { -shaft_fd + delta },
        14 => {
            if grade == 6 && size_lo >= 250.0 && size_hi <= 315.0 { return -9.0; }
            if grade <= 8 { -shaft_fd + delta } else { -shaft_fd }
        }
        15 => if small { -shaft_fd } else if grade <= 8 { -shaft_fd + delta } else { 0.0 },
        16..=27 => if grade <= 7 { -shaft_fd + delta } else { -shaft_fd },
        _ => f64::NAN,
    }
}

/// Limits of a hole tolerance class, um: returns (ES, EI).
pub fn iso286_hole_limits(letter: u32, grade: u32, shaft_fd: f64, delta: f64, it: f64, size_lo: f64, size_hi: f64) -> (f64, f64) {
    match letter {
        1..=11 => { let ei = iso286_hole_fd(letter, grade, shaft_fd, delta, size_lo, size_hi); (ei + it, ei) }
        12 => (it / 2.0, -it / 2.0),
        13..=27 => { let es = iso286_hole_fd(letter, grade, shaft_fd, delta, size_lo, size_hi); (es, es - it) }
        _ => (f64::NAN, f64::NAN),
    }
}

/// Fit between a hole (ES, EI) and a shaft (es, ei), um. Returns
/// (maximum clearance, minimum clearance) = (ES - ei, EI - es). A negative
/// clearance is an interference. Both positive: clearance fit; both
/// negative: interference fit; otherwise transition fit.
pub fn iso286_fit(hole_es: f64, hole_ei: f64, shaft_es: f64, shaft_ei: f64) -> (f64, f64) {
    (hole_es - shaft_ei, hole_ei - shaft_es)
}

/// Fit type code: 1 clearance, 2 transition, 3 interference.
pub fn iso286_fit_type(max_clearance: f64, min_clearance: f64) -> f64 {
    if min_clearance >= 0.0 { 1.0 } else if max_clearance <= 0.0 { 3.0 } else { 2.0 }
}

/// Formula value of a shaft fundamental deviation (um) from ISO 286-1's
/// annex formulas, for comparison with the tables only. `d` = geometric mean
/// of the size step (main step for d to n; intermediate step for a, b, c and
/// r to zc), `it6..it10` = tabulated IT values of that step. p, r and s up to
/// 50 mm are defined in the standard as ranges ("IT7 + 0 to 5", "IT8 + 1 to
/// 4"), so the lower end is returned and flagged by the caller.
/// Letter codes as [`LETTERS`]. Returns NaN for js and letters without a formula.
#[allow(clippy::too_many_arguments)]
pub fn iso286_shaft_fd_formula(letter: u32, d: f64, it6: f64, it7: f64, it8: f64, it9: f64, it10: f64) -> f64 {
    let a = |d: f64| if d <= 120.0 { -(265.0 + 1.3 * d) } else { -3.5 * d };
    let b = |d: f64| if d <= 160.0 { -(140.0 + 0.85 * d) } else { -1.8 * d };
    let c = |d: f64| if d <= 40.0 { -52.0 * d.powf(0.2) } else { -(95.0 + 0.8 * d) };
    let dd = |d: f64| -16.0 * d.powf(0.44);
    let e = |d: f64| -11.0 * d.powf(0.41);
    let f = |d: f64| -5.5 * d.powf(0.41);
    let g = |d: f64| -2.5 * d.powf(0.34);
    let p = it7;
    let s = if d <= 50.0 { it8 + 1.0 } else { it7 + 0.4 * d };
    match letter {
        1 => a(d), 2 => b(d), 3 => c(d), 4 => -(c(d) * dd(d)).sqrt(), 5 => dd(d), 6 => e(d),
        7 => -(e(d) * f(d)).sqrt(), 8 => f(d), 9 => -(f(d) * g(d)).sqrt(), 10 => g(d), 11 => 0.0,
        13 => 0.6 * d.cbrt(), 14 => it7 - it6, 15 => 5.0 * d.powf(0.34), 16 => p,
        17 => (p * s).sqrt(), 18 => s, 19 => it7 + 0.63 * d, 20 => it7 + d, 21 => it7 + 1.25 * d,
        22 => it7 + 1.6 * d, 23 => it7 + 2.0 * d, 24 => it7 + 2.5 * d, 25 => it8 + 3.15 * d,
        26 => it9 + 4.0 * d, 27 => it10 + 5.0 * d,
        _ => f64::NAN,
    }
}

/// f64 interface for WebAssembly. `which`: 0 es/ES (upper), 1 ei/EI (lower).
pub fn iso286_shaft_limit_f(letter: f64, grade: f64, fd: f64, it: f64, which: f64) -> f64 {
    let (u, l) = iso286_shaft_limits(letter as u32, grade as u32, fd, it);
    if which > 0.5 { l } else { u }
}

/// f64 interface for WebAssembly. `which`: 0 ES (upper), 1 EI (lower).
#[allow(clippy::too_many_arguments)]
pub fn iso286_hole_limit_f(letter: f64, grade: f64, shaft_fd: f64, it_n: f64, it_n1: f64, size_lo: f64, size_hi: f64, which: f64) -> f64 {
    let delta = iso286_delta(it_n, it_n1, size_hi);
    let (u, l) = iso286_hole_limits(letter as u32, grade as u32, shaft_fd, delta, it_n, size_lo, size_hi);
    if which > 0.5 { l } else { u }
}

/// f64 interface: `which` 0 max clearance, 1 min clearance, 2 fit type code.
pub fn iso286_fit_f(hole_es: f64, hole_ei: f64, shaft_es: f64, shaft_ei: f64, which: f64) -> f64 {
    let (mx, mn) = iso286_fit(hole_es, hole_ei, shaft_es, shaft_ei);
    match which as i32 { 0 => mx, 1 => mn, 2 => iso286_fit_type(mx, mn), _ => f64::NAN }
}

#[cfg(test)]
mod tests;

/// f64 interface: [`iso286_it_formula`].
pub fn iso286_it_formula_f(d_mean: f64, grade: f64) -> f64 { iso286_it_formula(d_mean, grade as u32) }

/// f64 interface: [`iso286_shaft_fd_formula`].
pub fn iso286_shaft_fd_formula_f(letter: f64, d: f64, it6: f64, it7: f64, it8: f64, it9: f64, it10: f64) -> f64 {
    iso286_shaft_fd_formula(letter as u32, d, it6, it7, it8, it9, it10)
}
