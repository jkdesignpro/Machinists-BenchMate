//! Stability chart (stability lobes) for milling from a simple tool-tip model.
//!
//! Method: Tlusty's average tooth angle approach as printed in [TS13] and
//! [TTS15]: the limiting axial depth is `b_lim = -1 / (2 Ks Re[G_or] Nt*)`,
//! the chatter frequency `fc` and the spindle speed are tied by
//! `fc / (Omega Nt) = N + eps / (2 pi)` with `eps = 2 pi - 2 atan(Re[G_or] / Im[G_or])`,
//! and `Nt*` is the average number of teeth in the cut.
//!
//! The tool-tip model is the simplest that can be drawn from numbers a machinist
//! has: the tool as a uniform round bar clamped at the holder face, one vibration
//! mode with the first bending frequency of that bar [THOM] and its static tip
//! stiffness 3 E I / L^3 [GERE], and a damping ratio that is assumed or measured.
//! Holder and spindle are left out; they often set the real chatter frequency.
//! A tap test (natural frequency, stiffness, damping ratio) replaces the model.
//!
//! Sources (docs/sources.md, "Stability chart"):
//! * [TS13] C. T. Tyler, T. L. Schmitz, "Analytical process damping stability
//!   prediction", J. Manuf. Processes 15(1), 2013, 69-76: eqs. 4, 5, 8, 13, 14, 15,
//!   the directional orientation factors and the worked turning example.
//! * [TTS15] C. T. Tyler, J. Troutman, T. L. Schmitz, "Radial depth of cut stability
//!   lobe diagrams with process damping effects", Precision Engineering 40, 2015,
//!   318-324: the same equations (1) to (4).
//! * [THOM] W. T. Thomson, Theory of Vibration with Applications: clamped-free beam,
//!   first root 1.875104 of cos x cosh x = -1.

use std::f64::consts::PI;
use crate::{second_moment_round, stable_rpm};

fn pos(x: f64) -> bool { x > 0.0 && x.is_finite() }

/// Receptance of one vibration mode at frequency `f` (Hz): with r = f / fn,
/// `G = 1 / (k (1 - r^2 + 2 i zeta r))` (the same as 1 / (-m w^2 + i c w + k), [TS13] eq. 8).
/// Returns [Re, Im] in the inverse unit of `k`.
pub fn sdof_frf(k: f64, zeta: f64, fn_hz: f64, f: f64) -> [f64; 2] {
    if !(pos(k) && pos(zeta) && pos(fn_hz) && f >= 0.0) { return [f64::NAN; 2]; }
    let r = f / fn_hz;
    let (a, b) = (1.0 - r * r, 2.0 * zeta * r);
    let den = k * (a * a + b * b);
    [a / den, -b / den]
}

/// Most negative real part of that receptance: -1 / (4 k zeta (1 + zeta)), at r = sqrt(1 + 2 zeta)
/// (from d Re / d r = 0; checked in a test by scanning).
pub fn sdof_min_real(k: f64, zeta: f64) -> f64 {
    if !(pos(k) && pos(zeta)) { return f64::NAN; }
    -1.0 / (4.0 * k * zeta * (1.0 + zeta))
}

/// First bending natural frequency (Hz) of a uniform round bar of diameter `d` (mm)
/// clamped at one end and free at the other, length `l` (mm), modulus `e_gpa`, density
/// `rho` (kg/m^3): f1 = (1.875104^2 / (2 pi)) sqrt(E I / (rho A L^4)), I / A = d^2 / 16. [THOM]
pub fn cantilever_fn_hz(d: f64, l: f64, e_gpa: f64, rho: f64) -> f64 {
    if !(pos(d) && pos(l) && pos(e_gpa) && pos(rho)) { return f64::NAN; }
    let bl: f64 = 1.875_104_068_711_961;
    let (dm, lm) = (d / 1000.0, l / 1000.0);
    bl * bl / (2.0 * PI) * (e_gpa * 1e9 * dm * dm / 16.0 / (rho * lm.powi(4))).sqrt()
}

/// Static stiffness (N/mm) at the tip of that bar: 3 E I / L^3. [GERE]
pub fn cantilever_tip_stiffness(d: f64, l: f64, e_gpa: f64) -> f64 {
    if !(pos(d) && pos(l) && pos(e_gpa)) { return f64::NAN; }
    3.0 * e_gpa * 1000.0 * second_moment_round(d) / l.powi(3)
}

/// Resultant specific force Ks (N/mm^2) from the tangential specific cutting force kc and the
/// force angle `beta_deg` between the resultant force and the surface normal: the tangential
/// part of F = Ks b h is F sin(beta), so Ks = kc / sin(beta). (Definitions of [TS13]; own algebra.)
pub fn ks_resultant(kc: f64, beta_deg: f64) -> f64 {
    if !(pos(kc) && beta_deg > 0.0 && beta_deg <= 90.0) { return f64::NAN; }
    kc / beta_deg.to_radians().sin()
}

/// Directional orientation factors [mu_x, mu_y] of [TS13] section 3.3 for the average tooth
/// angle `phi_ave_deg`: up milling (`down` = 0) cos(beta - (90 - phi)) cos(90 - phi) and
/// cos(180 - phi - beta) cos(180 - phi); down milling cos(beta + phi - 90) cos(phi - 90) and
/// cos(beta - (180 - phi)) cos(180 - phi). For a tool with the same response in x and y the
/// oriented response is (mu_x + mu_y) G, and mu_x + mu_y = cos(beta) at every angle (tested).
pub fn orientation_factors(beta_deg: f64, phi_ave_deg: f64, down: f64) -> [f64; 2] {
    let (b, p) = (beta_deg.to_radians(), phi_ave_deg.to_radians());
    let (q, h) = (PI / 2.0, PI);
    if down > 0.0 { [(b + p - q).cos() * (p - q).cos(), (b - (h - p)).cos() * (h - p).cos()] }
    else { [(b - (q - p)).cos() * (q - p).cos(), (h - p - b).cos() * (h - p).cos()] }
}

/// Limiting axial depth (mm), [TS13] eq. 13: b_lim = -1 / (2 Ks Re[G_or] Nt*), Ks in N/mm^2,
/// Re[G_or] in mm/N (negative), Nt* the average number of teeth in the cut (1 for turning, eq. 4).
pub fn lobe_blim(ks: f64, re_or: f64, nt_star: f64) -> f64 {
    if !(pos(ks) && pos(nt_star) && re_or < 0.0) { return f64::NAN; }
    -1.0 / (2.0 * ks * re_or * nt_star)
}

/// Phase between the waves left by one tooth and the next (rad): eps = 2 pi - 2 atan(Re / Im). [TS13]
pub fn lobe_phase(re_or: f64, im_or: f64) -> f64 { 2.0 * PI - 2.0 * (re_or / im_or).atan() }

/// Spindle speed (rpm) at which the chatter frequency `fc` (Hz) sits on lobe `n` (0, 1, 2, ...):
/// fc / (Omega Nt) = N + eps / (2 pi), Omega in rev/s. [TS13] eq. 14
pub fn lobe_rpm(fc: f64, nt: f64, n: f64, eps: f64) -> f64 { 60.0 * fc / (nt * (n + eps / (2.0 * PI))) }

/// Depth of cut (mm) that is stable at every spindle speed: the lowest point of every lobe,
/// -1 / (2 Ks cos(beta) min Re[G] Nt*), for a tool with the same response in x and y.
pub fn lobe_critical_depth(k: f64, zeta: f64, ks: f64, beta_deg: f64, nt_star: f64) -> f64 {
    lobe_blim(ks, beta_deg.to_radians().cos() * sdof_min_real(k, zeta), nt_star)
}

/// Stability limit at a spindle speed, for a tool with one mode (stiffness `k` N/mm, damping
/// ratio `zeta`, natural frequency `fn_hz`) and the same response in x and y:
/// the lowest b_lim over all lobes that reach that speed. Lobe N starts at the speed
/// 60 fn / (Nt (N + 1)) and its speed rises with the chatter frequency, so each lobe has one
/// point at a given speed, found by bisection.
/// Returns [limiting depth mm, chatter frequency Hz at the limit, lobe number N].
#[allow(clippy::too_many_arguments)]
pub fn lobe_limit_at_rpm(k: f64, zeta: f64, fn_hz: f64, ks: f64, beta_deg: f64, nt_star: f64, nt: f64, rpm: f64) -> [f64; 3] {
    if !(pos(k) && pos(zeta) && pos(fn_hz) && pos(ks) && pos(nt_star) && pos(nt) && pos(rpm) && beta_deg > 0.0 && beta_deg < 90.0) { return [f64::NAN; 3]; }
    let mu = beta_deg.to_radians().cos();
    let r_low = (1.0 + 2.0 * zeta).sqrt();
    // speed of lobe n at frequency ratio r (> 1)
    let speed = |r: f64, n: f64| { let g = sdof_frf(k, zeta, fn_hz, r * fn_hz); lobe_rpm(r * fn_hz, nt, n, lobe_phase(mu * g[0], mu * g[1])) };
    let mut best = [f64::INFINITY, f64::NAN, f64::NAN];
    // the first lobe that reaches this speed: 60 fn / (Nt (N + 1)) < rpm
    let mut n = (60.0 * fn_hz / (nt * rpm) - 1.0).floor().max(0.0);
    for _ in 0..100_000 {
        if stable_rpm(fn_hz, nt, n) < rpm {
            let (mut lo, mut hi) = (1.0, 2.0);
            while speed(hi, n) < rpm && hi < 1e6 { hi *= 2.0; }
            for _ in 0..80 { let mid = (lo + hi) / 2.0; if speed(mid, n) < rpm { lo = mid; } else { hi = mid; } }
            let r = (lo + hi) / 2.0;
            let b = lobe_blim(ks, mu * sdof_frf(k, zeta, fn_hz, r * fn_hz)[0], nt_star);
            if b < best[0] { best = [b, r * fn_hz, n]; }
            // past the lowest point of a lobe the limit only rises, and higher lobes sit further past it
            if r > r_low && b > best[0] { break; }
        }
        n += 1.0;
    }
    if best[0].is_finite() { best } else { [f64::NAN; 3] }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    #[test]
    fn published_turning_stability_limit() {
        // [TS13] section 4.1: k = 6.48e6 N/m, m = 0.561 kg, c = 145 N s/m, Ks = 2927 N/mm2, beta = 61.79 deg,
        // alpha = 0: "asymptotic stability limit" about 0.37 mm.
        let (k, m, c) = (6.48e6f64, 0.561f64, 145.0f64);
        let zeta = c / (2.0 * (k * m).sqrt());
        assert!(close(zeta, 0.03803, 1e-5));
        let b = lobe_critical_depth(k / 1000.0, zeta, 2927.0, 61.79, 1.0);
        assert!(close(b, 0.37, 0.005), "{b}");
        // the same from eq. 8 directly at the frequency of the most negative real part
        let fnat = (k / m).sqrt() / (2.0 * PI);
        let g = sdof_frf(k / 1000.0, zeta, fnat, fnat * (1.0 + 2.0 * zeta).sqrt());
        let w = 2.0 * PI * fnat * (1.0 + 2.0 * zeta).sqrt();
        let den = (k - m * w * w).powi(2) + (c * w).powi(2);
        assert!(close(g[0], (k - m * w * w) / den * 1000.0, 1e-12) && close(g[1], -c * w / den * 1000.0, 1e-12));
        assert!(close(lobe_blim(2927.0, 61.79f64.to_radians().cos() * g[0], 1.0), b, 1e-9));
    }

    #[test]
    fn one_mode_response() {
        // static: 1 / k; at resonance: Re = 0, Im = -1 / (2 k zeta)
        let g0 = sdof_frf(5000.0, 0.03, 900.0, 0.0);
        assert!(close(g0[0], 1.0 / 5000.0, 1e-15) && g0[1] == 0.0);
        let g1 = sdof_frf(5000.0, 0.03, 900.0, 900.0);
        assert!(close(g1[0], 0.0, 1e-15) && close(g1[1], -1.0 / (2.0 * 5000.0 * 0.03), 1e-12));
        // the most negative real part, by scanning
        let mut lo = 0.0f64;
        for i in 0..200_000 { let f = 900.0 + i as f64 * 0.005; lo = lo.min(sdof_frf(5000.0, 0.03, 900.0, f)[0]); }
        assert!(close(lo, sdof_min_real(5000.0, 0.03), 1e-9) && close(sdof_min_real(5000.0, 0.03), -1.0 / (4.0 * 5000.0 * 0.03 * 1.03), 1e-15));
    }

    #[test]
    fn tool_as_a_bar() {
        // 12 mm carbide bar, 40 mm out, E 580 GPa, 14 450 kg/m3:
        // sqrt(E / rho) = 6335.5 m/s; f1 = 3.51602 / (2 pi) x (0.012 / 4) / 0.04^2 x 6335.5 = 6647 Hz
        let f = cantilever_fn_hz(12.0, 40.0, 580.0, 14450.0);
        assert!(close(f, 3.516_015 / (2.0 * PI) * 0.003 / 0.0016 * (580e9f64 / 14450.0).sqrt(), 0.01) && close(f, 6647.0, 1.0), "{f}");
        // twice the stick-out: a quarter of the frequency, an eighth of the stiffness
        assert!(close(cantilever_fn_hz(12.0, 80.0, 580.0, 14450.0), f / 4.0, 1e-9));
        // k = 3 x 580000 x (pi 12^4 / 64) / 40^3 = 27 674 N/mm
        let k = cantilever_tip_stiffness(12.0, 40.0, 580.0);
        assert!(close(k, 3.0 * 580000.0 * 1017.876 / 64000.0, 0.5) && close(k, 27674.0, 1.0), "{k}");
        assert!(close(cantilever_tip_stiffness(12.0, 80.0, 580.0), k / 8.0, 1e-9));
        // Ks from kc: beta 90 means the force is all tangential
        assert!(close(ks_resultant(2000.0, 90.0), 2000.0, 1e-9) && close(ks_resultant(2000.0, 30.0), 4000.0, 1e-9));
    }

    #[test]
    fn orientation_factors_sum_to_cos_beta() {
        for &beta in &[55.0f64, 62.0, 70.0, 80.0] {
            for i in 1..36 {
                let phi = i as f64 * 5.0;
                for &down in &[0.0, 1.0] {
                    let m = orientation_factors(beta, phi, down);
                    assert!(close(m[0] + m[1], beta.to_radians().cos(), 1e-12), "{beta} {phi} {down}");
                }
            }
        }
        // a slot in up milling (average angle 90): mu_x = cos(beta), mu_y = 0 ([TS13] 3.3.1)
        let m = orientation_factors(70.0, 90.0, 0.0);
        assert!(close(m[0], 70f64.to_radians().cos(), 1e-12) && close(m[1], 0.0, 1e-12));
    }

    #[test]
    fn lobes_at_a_speed() {
        // [TS13] section 4.2 system: 3 teeth, 50 % radial immersion (Nt* = 3 x 90 / 360 = 0.75),
        // k = 9e6 N/m, fn = 900 Hz, zeta = 0.03, Ks = 2000 N/mm2, beta = 70 deg.
        let (k, z, f, ks, beta, nts, nt) = (9000.0, 0.03, 900.0, 2000.0, 70.0, 0.75, 3.0);
        let crit = lobe_critical_depth(k, z, ks, beta, nts);
        // -1 / (2 x 2000 x cos 70 x (-1 / (4 x 9000 x 0.03 x 1.03)) x 0.75) = 1.0842 mm
        assert!(close(crit, 4.0 * 9000.0 * 0.03 * 1.03 / (2.0 * 2000.0 * 70f64.to_radians().cos() * 0.75), 1e-9) && close(crit, 1.0842, 1e-3), "{crit}");
        // never below the critical depth, and equal to it somewhere on each lobe
        let mut lowest = f64::INFINITY;
        for i in 0..4000 {
            let rpm = 2000.0 + i as f64 * 5.0;
            let b = lobe_limit_at_rpm(k, z, f, ks, beta, nts, nt, rpm);
            assert!(b[0] >= crit - 1e-9, "{rpm} {:?}", b);
            lowest = lowest.min(b[0]);
        }
        assert!(close(lowest, crit, 1e-3));
        // just above the best speeds 60 fn / (Nt (N + 1)) = 18 000, 9 000, 6 000 rpm the limit is far above the critical depth
        for &p in &[18000.0, 9000.0, 6000.0] {
            let b = lobe_limit_at_rpm(k, z, f, ks, beta, nts, nt, p * 1.002);
            assert!(b[0] > 3.0 * crit, "{p} {:?}", b);
        }
        // cross-check one speed against a direct scan of every lobe
        let rpm = 7300.0;
        let got = lobe_limit_at_rpm(k, z, f, ks, beta, nts, nt, rpm);
        let mu = beta.to_radians().cos();
        let mut best = f64::INFINITY;
        for n in 0..40 {
            let mut prev = f64::NAN;
            for i in 1..400_000 {
                let fc = f * (1.0 + i as f64 * 2e-5);
                let g = sdof_frf(k, z, f, fc);
                let s = lobe_rpm(fc, nt, n as f64, lobe_phase(mu * g[0], mu * g[1]));
                if prev < rpm && s >= rpm { best = best.min(lobe_blim(ks, mu * g[0], nts)); }
                prev = s;
            }
        }
        assert!(close(got[0], best, 2e-3 * best), "{:?} {best}", got);
        assert!(got[1] > f && got[2] >= 0.0);
        assert!(lobe_limit_at_rpm(k, z, f, ks, 95.0, nts, nt, rpm)[0].is_nan());
    }
}
