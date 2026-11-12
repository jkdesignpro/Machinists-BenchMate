//! Helical compression springs of round wire: rate, stress with the Wahl
//! factor, coils and lengths by end type. Any consistent units (inch, lbf,
//! psi or mm, N, MPa).
//!
//! Formulas as printed by AMES (amesweb.info, Compression spring formulas),
//! MechRef (University of Illinois) and RoyMech; see docs/sources.md, Springs.

use std::f64::consts::PI;

/// Mean coil diameter from the outside diameter and the wire diameter.
pub fn spring_mean_dia(od: f64, d: f64) -> f64 {
    if !(od > 0.0 && d > 0.0 && od > 2.0 * d) { return f64::NAN; }
    od - d
}

/// Spring index C = D / d.
pub fn spring_index(dm: f64, d: f64) -> f64 {
    if !(dm > 0.0 && d > 0.0) { return f64::NAN; }
    dm / d
}

/// Spring rate k = G d^4 / (8 D^3 Na).
pub fn spring_rate(d: f64, dm: f64, na: f64, g: f64) -> f64 {
    if !(d > 0.0 && dm > 0.0 && na > 0.0 && g > 0.0) { return f64::NAN; }
    g * d.powi(4) / (8.0 * dm.powi(3) * na)
}

/// Wahl factor Kw = (4C - 1) / (4C - 4) + 0.615 / C.
pub fn spring_wahl(c: f64) -> f64 {
    if !(c > 1.0) { return f64::NAN; }
    (4.0 * c - 1.0) / (4.0 * c - 4.0) + 0.615 / c
}

/// Shear stress in the wire at load `f`, with the Wahl factor: Kw 8 F D / (pi d^3).
pub fn spring_stress(f: f64, dm: f64, d: f64) -> f64 {
    if !(f >= 0.0 && dm > 0.0 && d > 0.0) { return f64::NAN; }
    spring_wahl(dm / d) * 8.0 * f * dm / (PI * d.powi(3))
}

/// Coils and lengths by end type. `end`: 0 plain, 1 plain and ground,
/// 2 closed (squared), 3 closed and ground. `which`: 0 total coils Nt,
/// 1 solid length, 2 pitch for the free length `lf`, 3 free length for the
/// pitch given in `lf`.
pub fn spring_ends(end: f64, na: f64, d: f64, lf: f64, which: f64) -> f64 {
    if !(na > 0.0 && d > 0.0) { return f64::NAN; }
    let e = end as i32;
    if !(0..=3).contains(&e) || (end - e as f64).abs() > 1e-9 { return f64::NAN; }
    let nt = match e { 0 => na, 1 => na + 1.0, _ => na + 2.0 };
    // Ends that are not ground stand one wire higher when solid.
    let ls = if e == 0 || e == 2 { d * (nt + 1.0) } else { d * nt };
    match which as i32 {
        0 => nt,
        1 => ls,
        2 => {
            if !(lf > 0.0) { return f64::NAN; }
            match e { 0 => (lf - d) / na, 1 => lf / (na + 1.0), 2 => (lf - 3.0 * d) / na, _ => (lf - 2.0 * d) / na }
        }
        3 => {
            if !(lf > 0.0) { return f64::NAN; }
            match e { 0 => lf * na + d, 1 => lf * (na + 1.0), 2 => lf * na + 3.0 * d, _ => lf * na + 2.0 * d }
        }
        _ => f64::NAN,
    }
}

/// A spring with free length `lf` under a load or at a length. `which`: 0 travel from free to solid,
/// 1 load at solid, 2 deflection for the load `x`, 3 length under the load `x` (NaN if it would go
/// solid first), 4 load at the length `x` (NaN outside solid..free), 5 deflection at the length `x`.
#[allow(clippy::too_many_arguments)]
pub fn spring_state(d: f64, dm: f64, na: f64, g: f64, end: f64, lf: f64, x: f64, which: f64) -> f64 {
    let k = spring_rate(d, dm, na, g);
    let ls = spring_ends(end, na, d, 0.0, 1.0);
    let w = which as i32;
    if w == 2 { return if x >= 0.0 { x / k } else { f64::NAN }; }
    if !(lf > ls) { return f64::NAN; }
    match w {
        0 => lf - ls,
        1 => k * (lf - ls),
        3 => { let l = lf - x / k; if x >= 0.0 && l >= ls { l } else { f64::NAN } }
        4 => if x >= ls && x <= lf { k * (lf - x) } else { f64::NAN },
        5 => if x >= ls && x <= lf { lf - x } else { f64::NAN },
        _ => f64::NAN,
    }
}

/// Modulus of rigidity G in psi as two spring makers print it (Lee Spring,
/// Acxess Spring), by material group: 1 carbon and alloy spring steels
/// (music wire, hard drawn, oil tempered, chrome vanadium, chrome silicon),
/// 2 stainless 302/304 and 316, 3 stainless 17-7 PH; one maker only (Lee
/// Spring): 4 phosphor bronze, 5 beryllium copper.
pub fn spring_g_psi(mat: f64) -> f64 {
    match mat as i32 { 1 => 11.5e6, 2 => 10.0e6, 3 => 11.0e6, 4 => 6.25e6, 5 => 7.0e6, _ => f64::NAN }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    // AMES, "Compression spring fatigue design example": music wire, d 0.080 in, OD 0.625 in,
    // 22 active coils, squared and ground, free length 4 in, loads 22 and 8 lbf. Printed: D 0.545,
    // C 6.81 (6.812), Nt 24, k 16.89 lbf/in, solid height 1.92, deflection to solid 2.08, pitch 0.17,
    // Kw 1.22, stress amplitude 23.14 ksi (load amplitude 7 lbf). The page does not print its shear
    // modulus; 11.75e6 psi reproduces the printed rate.
    #[test]
    fn ames_fatigue_example() {
        let (d, od, na) = (0.080, 0.625, 22.0);
        let dm = spring_mean_dia(od, d);
        close(dm, 0.545, 1e-12);
        close(spring_index(dm, d), 6.812, 5e-4);
        close(spring_ends(3.0, na, d, 0.0, 0.0), 24.0, 1e-12);
        close(spring_rate(d, dm, na, 11.75e6), 16.89, 5e-3);
        close(spring_ends(3.0, na, d, 0.0, 1.0), 1.92, 1e-12);
        close(4.0 - spring_ends(3.0, na, d, 0.0, 1.0), 2.08, 1e-12);
        close(spring_ends(3.0, na, d, 4.0, 2.0), 0.17, 5e-3);
        close(spring_wahl(spring_index(dm, d)), 1.22, 5e-3);
        close(spring_stress(7.0, dm, d) / 1000.0, 23.14, 5e-3);
        close(spring_state(d, dm, na, 11.75e6, 3.0, 4.0, 0.0, 0.0), 2.08, 1e-12);
        let k = spring_rate(d, dm, na, 11.75e6);
        close(spring_state(d, dm, na, 11.75e6, 3.0, 4.0, 0.0, 1.0), k * 2.08, 1e-9);
        close(spring_state(d, dm, na, 11.75e6, 3.0, 4.0, 22.0, 2.0), 22.0 / k, 1e-12);
        close(spring_state(d, dm, na, 11.75e6, 3.0, 4.0, 22.0, 3.0), 4.0 - 22.0 / k, 1e-12);
        close(spring_state(d, dm, na, 11.75e6, 3.0, 4.0, 3.0, 4.0), k, 1e-9);
        close(spring_state(d, dm, na, 11.75e6, 3.0, 4.0, 3.0, 5.0), 1.0, 1e-12);
        assert!(spring_state(d, dm, na, 11.75e6, 3.0, 4.0, 40.0, 3.0).is_nan()); // 40 lbf: solid first (35.1 lbf at solid)
        assert!(spring_state(d, dm, na, 11.75e6, 3.0, 4.0, 1.5, 4.0).is_nan());  // shorter than solid
        assert!(spring_state(d, dm, na, 11.75e6, 3.0, 1.5, 0.0, 0.0).is_nan());  // free length under solid
    }

    // RoyMech prints the Wahl factor by spring index: 3 1.58, 4 1.40, 5 1.31, 6 1.25, 7 1.21, 8 1.18,
    // 9 1.16, 10 1.14, 12 1.12, 16 1.09.
    #[test]
    fn wahl_table() {
        for (c, k) in [(3.0, 1.58), (4.0, 1.40), (5.0, 1.31), (6.0, 1.25), (7.0, 1.21), (8.0, 1.18), (9.0, 1.16), (10.0, 1.14), (12.0, 1.12), (16.0, 1.09)] {
            close(spring_wahl(c), k, 6e-3);
        }
    }

    #[test]
    fn ends_and_limits() {
        // Total coils and solid length (AMES and RoyMech): plain Na, d(Nt+1); plain and ground Na+1, d Nt;
        // closed Na+2, d(Nt+1); closed and ground Na+2, d Nt.
        close(spring_ends(0.0, 10.0, 2.0, 0.0, 0.0), 10.0, 1e-12); close(spring_ends(0.0, 10.0, 2.0, 0.0, 1.0), 22.0, 1e-12);
        close(spring_ends(1.0, 10.0, 2.0, 0.0, 0.0), 11.0, 1e-12); close(spring_ends(1.0, 10.0, 2.0, 0.0, 1.0), 22.0, 1e-12);
        close(spring_ends(2.0, 10.0, 2.0, 0.0, 0.0), 12.0, 1e-12); close(spring_ends(2.0, 10.0, 2.0, 0.0, 1.0), 26.0, 1e-12);
        close(spring_ends(3.0, 10.0, 2.0, 0.0, 0.0), 12.0, 1e-12); close(spring_ends(3.0, 10.0, 2.0, 0.0, 1.0), 24.0, 1e-12);
        // Pitch and free length are inverses (AMES): plain p Na + d, plain and ground p(Na+1), closed p Na + 3d, closed and ground p Na + 2d.
        for e in 0..4 {
            let p = spring_ends(e as f64, 10.0, 2.0, 60.0, 2.0);
            close(spring_ends(e as f64, 10.0, 2.0, p, 3.0), 60.0, 1e-9);
        }
        close(spring_ends(2.0, 10.0, 2.0, 60.0, 2.0), 5.4, 1e-12);
        assert!(spring_ends(4.0, 10.0, 2.0, 60.0, 0.0).is_nan());
        assert!(spring_mean_dia(1.0, 0.6).is_nan());
        assert!(spring_wahl(1.0).is_nan());
        close(spring_g_psi(1.0), 11.5e6, 1e-6);
        assert!(spring_g_psi(0.0).is_nan());
        // mm, N, MPa: d 2, D 20, 10 coils, G 79 300 MPa: k = 79300 x 16 / (8 x 8000 x 10) = 1.9825 N/mm.
        close(spring_rate(2.0, 20.0, 10.0, 79_300.0), 1.9825, 1e-12);
    }
}
