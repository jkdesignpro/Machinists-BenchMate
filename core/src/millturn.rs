//! Small milling and turning calculators (parity batch A9): radial chip
//! thinning and corner engagement, ball-nose cusp height and effective
//! diameter, runout and chip load, slitting saws, lathe feed and multi-pass
//! time, C-axis feed, boring bar deflection, bandsaw cut time, spot and
//! centre drill depth.
//!
//! Sources (full list in docs/sources.md, section "Small milling and turning"):
//! * [MD] Machining Doctor, chip thinning calculator: RCTF = 1 / sqrt(1 - (1 - 2 ae / D)^2);
//!   ball nose axial factor D / sqrt(D^2 - (D - 2 ap)^2).
//! * [ALT] Y. Altintas, Manufacturing Automation, 2nd ed. 2012, Ch. 2: h(phi) = c sin(phi).
//! * [ISCAR-TI] ISCAR, Machining Titanium guide (2019), p. 46, Table 28: ball nose
//!   effective diameter de = 2 sqrt(d ap - ap^2) with the axis normal to the surface.
//! * [IMCO] IMCO Carbide Tool, "Adjustments for ball nose end mills": rpm from the
//!   effective diameter; fz_adj = D fz / De; scallop h ~ ae^2 / (8 R).
//! * [KD] W. A. Kline, R. E. DeVor, "The effect of runout on cutting geometry and
//!   forces in end milling", Int. J. Mach. Tool Des. Res. 23(2/3), 1983 (chip load
//!   per tooth with radial runout; page range to be verified).
//! * [RS274] T. R. Kramer, F. M. Proctor, E. R. Messina, The NIST RS274NGC
//!   Interpreter, version 3, NISTIR 6556 (2000): inverse time feed (G93), F = 1 / minutes.
//! * [GERE] Gere and Goodno, Mechanics of Materials: cantilever F L^3 / (3 E I).
//! * [SAN] Sandvik Coromant turning formulas: Fc = kc ap fn.
//! * [STAR] Starrett Bulletin 193 (cutting rate in square inches per minute);
//!   [KASCO] KASCO, teeth per minute = teeth per foot x blade speed (ft/min).
//!   All internal units are mm, mm/min, m/min, N, GPa unless the name says otherwise.

use std::f64::consts::PI;

/// Radial engagement angle (radians) of a tool of diameter `d` at radial width `ae`
/// on a straight wall: phi = acos(1 - 2 ae / d), capped at pi for ae >= d. [ALT]
pub fn engagement_rad(ae: f64, d: f64) -> f64 {
    if !(ae > 0.0 && d > 0.0) { return f64::NAN; }
    (1.0 - 2.0 * (ae / d).min(1.0)).acos()
}

/// Radial chip thinning factor: the feed per tooth that gives a target max chip
/// thickness is target x RCTF. RCTF = 1 / sin(phi) = 1 / sqrt(1 - (1 - 2 ae/D)^2)
/// for ae < D/2; 1 for ae >= D/2 (the chip reaches fz). [MD][ALT]
pub fn rctf(ae: f64, d: f64) -> f64 {
    if !(ae > 0.0 && d > 0.0) { return f64::NAN; }
    if ae >= d / 2.0 { return 1.0; }
    let x = 1.0 - 2.0 * ae / d;
    1.0 / (1.0 - x * x).sqrt()
}

/// Max chip thickness for a given engagement angle phi (radians): fz sin(phi), fz once phi >= 90 deg. [ALT]
pub fn hex_for_engagement(fz: f64, phi: f64) -> f64 {
    if phi >= PI / 2.0 { fz } else { fz * phi.sin() }
}

/// Engagement angle (radians) on a circular wall of radius `r_wall` (the radius of
/// the finished wall at the cutting edge) with radial width `ae`, tool diameter `d`.
/// `inside` = true: concave wall (pocket corner, tool centre at r_wall - r); false:
/// convex wall (boss, tool centre at r_wall + r). From the triangle corner centre /
/// tool centre / edge of the previous wall and the law of cosines; tends to the
/// straight-wall angle as r_wall grows. NaN if the tool does not fit (inside, r_wall <= r).
pub fn engagement_arc_rad(ae: f64, d: f64, r_wall: f64, inside: bool) -> f64 {
    let r = d / 2.0;
    if !(ae > 0.0 && d > 0.0 && r_wall > 0.0) { return f64::NAN; }
    let c = if inside {
        if r_wall <= r { return f64::NAN; }
        let a = r_wall - r; let b = (r_wall - ae).max(0.0);
        (b * b - a * a - r * r) / (2.0 * r * a)
    } else {
        let a = r_wall + r; let b = r_wall + ae;
        (a * a + r * r - b * b) / (2.0 * r * a)
    };
    c.clamp(-1.0, 1.0).acos()
}

/// Ball-nose scallop (cusp) height on a flat surface for stepover `s`, ball radius `r`:
/// h = r - sqrt(r^2 - (s/2)^2). Exact circle geometry; [IMCO] gives the small-s
/// approximation s^2 / (8 r). NaN when s > 2r.
pub fn cusp_height(r: f64, s: f64) -> f64 {
    if !(r > 0.0 && s >= 0.0) || s > 2.0 * r { return f64::NAN; }
    r - (r * r - s * s / 4.0).sqrt()
}

/// Stepover for a scallop height `h` with ball radius `r`: s = 2 sqrt(2 r h - h^2) (h <= r).
pub fn stepover_for_cusp(r: f64, h: f64) -> f64 {
    if !(r > 0.0 && h >= 0.0) || h > r { return f64::NAN; }
    2.0 * (2.0 * r * h - h * h).sqrt()
}

/// Half-angle (radians, from the tool axis) of the ball band in cut at depth ap,
/// measured normal to the surface: theta0 = acos(1 - 2 ap / D).
fn ball_band(d: f64, ap: f64) -> f64 { (1.0 - 2.0 * (ap / d).min(1.0)).acos() }

/// Largest effective cutting diameter of a ball-nose tool of diameter `d` at depth
/// `ap` with the axis tilted `tilt_deg` from the surface normal (in the feed or
/// cross direction): De = D sin(min(theta0 + tilt, 90 deg)). With no tilt this is
/// 2 sqrt(ap (D - ap)) [ISCAR-TI]. Derived from the sphere: a point at polar angle psi
/// from the axis turns on a diameter D sin(psi), and the band in cut spans
/// tilt - theta0 .. tilt + theta0.
pub fn ball_eff_dia(d: f64, ap: f64, tilt_deg: f64) -> f64 {
    if !(d > 0.0 && ap > 0.0) || !(0.0..90.0).contains(&tilt_deg) { return f64::NAN; }
    let a = (ball_band(d, ap) + tilt_deg.to_radians()).min(PI / 2.0);
    d * a.sin()
}

/// Smallest effective diameter in cut (0 when the tool centre is in the cut, i.e. tilt <= theta0).
pub fn ball_min_dia(d: f64, ap: f64, tilt_deg: f64) -> f64 {
    if !(d > 0.0 && ap > 0.0) || !(0.0..90.0).contains(&tilt_deg) { return f64::NAN; }
    let a = tilt_deg.to_radians() - ball_band(d, ap);
    if a <= 0.0 { 0.0 } else { d * a.sin() }
}

/// Per-tooth chip load with radial runout (TIR) for `z` equally spaced teeth, at the
/// tooth phase that makes the worst tooth largest. Tooth radii are
/// r_i = (TIR/2) cos(lambda - 2 pi i / z); tooth i removes the least of
/// (k fz + r_i - r_{i-k}) over k = 1..z, and never less than 0 (a tooth that falls
/// inside the surface left by an earlier tooth does not cut, and the next one takes
/// more). [KD][ALT]
pub fn runout_chips(fz: f64, tir: f64, z: usize) -> Vec<f64> {
    if !(fz > 0.0 && tir >= 0.0) || z == 0 { return vec![]; }
    let rho = tir / 2.0;
    let lam = PI / 2.0 - PI / z as f64; // tooth 0 then has the largest r_0 - r_{-1}
    let r: Vec<f64> = (0..z).map(|i| rho * (lam - 2.0 * PI * i as f64 / z as f64).cos()).collect();
    (0..z).map(|i| {
        (1..=z).map(|k| k as f64 * fz + r[i] - r[(i + z * 2 - k) % z]).fold(f64::INFINITY, f64::min).max(0.0)
    }).collect()
}

/// Largest per-tooth chip with runout when every tooth cuts: fz + TIR sin(pi / z).
pub fn runout_chip_max(fz: f64, tir: f64, z: f64) -> f64 {
    if !(z >= 1.0) { return f64::NAN; }
    fz + tir * (PI / z.round()).sin()
}

/// Feed per tooth so the worst tooth carries `target`: target - TIR sin(pi / z) (NaN if <= 0).
pub fn runout_fz_for_max(target: f64, tir: f64, z: f64) -> f64 {
    let f = target - tir * (PI / z.round().max(1.0)).sin();
    if f > 0.0 { f } else { f64::NAN }
}

/// Approach (half chord) length for a disc cutter of diameter `d` at depth `ae`
/// to reach full depth: sqrt(ae (d - ae)); d/2 once ae >= d/2.
pub fn cutter_approach(d: f64, ae: f64) -> f64 {
    if !(d > 0.0 && ae > 0.0) { return f64::NAN; }
    if ae >= d / 2.0 { d / 2.0 } else { (ae * (d - ae)).sqrt() }
}

/// Number of teeth in the cut at once: z x engagement angle / 360 deg.
pub fn teeth_engaged(z: f64, ae: f64, d: f64) -> f64 { z * engagement_rad(ae, d) / (2.0 * PI) }

/// Number of equal roughing passes to remove radial stock (d0 - d1)/2 with at most
/// `ap_max` per pass.
pub fn turn_passes(d0: f64, d1: f64, ap_max: f64) -> f64 {
    let stock = (d0 - d1) / 2.0;
    if !(stock > 0.0 && ap_max > 0.0) { return f64::NAN; }
    (stock / ap_max - 1e-9).ceil().max(1.0)
}

/// Multi-pass turning (outside diameter, metric): passes from d0 down to d1 with
/// equal depth of cut not over ap_max, each over `len` at feed `f` (mm/rev).
/// `vc` > 0: constant surface speed at each pass's finished diameter, rpm limited
/// to `n_max` (if > 0); otherwise constant `rpm`. Returns per pass
/// (finished diameter, rpm, minutes).
#[allow(clippy::too_many_arguments)]
pub fn turn_rough(d0: f64, d1: f64, ap_max: f64, len: f64, f: f64, vc: f64, rpm: f64, n_max: f64) -> Vec<(f64, f64, f64)> {
    let n = turn_passes(d0, d1, ap_max);
    if !(n.is_finite() && len > 0.0 && f > 0.0 && (vc > 0.0 || rpm > 0.0)) { return vec![]; }
    let ap = (d0 - d1) / 2.0 / n;
    (1..=n as usize).map(|i| {
        let dia = d0 - 2.0 * ap * i as f64;
        let mut s = if vc > 0.0 { crate::rpm_from_vc(vc, dia) } else { rpm };
        if n_max > 0.0 && s > n_max { s = n_max; }
        (dia, s, len / (f * s))
    }).collect()
}

/// C axis: angular feed (deg/min) for a feed `vf` along the circumference at diameter `d`:
/// deg/min = vf x 360 / (pi d).
pub fn c_axis_deg_min(vf: f64, d: f64) -> f64 { vf * 360.0 / (PI * d) }

/// Feed along the circumference (same length unit as d, per min) from deg/min.
pub fn c_axis_feed_from_deg(deg_min: f64, d: f64) -> f64 { deg_min * PI * d / 360.0 }

/// Inverse time feed number (G93) for a move with linear length `lin` and rotation
/// `deg` at cutting diameter `d`, so the tool runs at `vf` along its path:
/// path = sqrt(lin^2 + (pi d deg / 360)^2), F = vf / path (1/min). [RS274]
pub fn inverse_time_f(lin: f64, deg: f64, d: f64, vf: f64) -> f64 {
    let arc = PI * d * deg.abs() / 360.0;
    let path = (lin * lin + arc * arc).sqrt();
    if !(path > 0.0 && vf > 0.0) { return f64::NAN; }
    vf / path
}

/// Second moment of area of a round bar with an optional coaxial hole: pi (d^4 - di^4) / 64.
pub fn second_moment_tube(d: f64, di: f64) -> f64 { PI * (d.powi(4) - di.max(0.0).powi(4)) / 64.0 }

/// Boring bar tip deflection (mm): F (N) at overhang L (mm), bar diameter d (mm),
/// optional coolant bore di (mm), E (GPa): F L^3 / (3 E I). [GERE]
pub fn boring_bar_deflection(f_n: f64, l: f64, d: f64, di: f64, e_gpa: f64) -> f64 {
    if !(l > 0.0 && d > 0.0 && e_gpa > 0.0 && di < d) { return f64::NAN; }
    crate::cantilever_tip_deflection(f_n, l, e_gpa * 1000.0, second_moment_tube(d, di))
}

/// Main (tangential) cutting force in turning: Fc = kc ap fn (N, with kc in N/mm^2, mm). [SAN]
pub fn turning_force(kc: f64, ap: f64, fnr: f64) -> f64 { kc * ap * fnr }

/// Bandsaw chip per tooth (mm) from down-feed `vf` (mm/min), blade speed `vb`
/// (m/min) and teeth per inch: vf / teeth per minute, teeth per minute = vb x 1000 / 25.4 x TPI. [KASCO]
pub fn bandsaw_chip_per_tooth(vf: f64, vb: f64, tpi: f64) -> f64 { vf / (vb * 1000.0 / crate::MM_PER_IN * tpi) }

/// Section a bandsaw cuts through: one piece or a bundle of `nx` pieces across
/// (side by side, across the blade) and `ny` layers high (stacked in the feed
/// direction), packed square. `shape`: 1 round bar (diameter a), 2 rectangle
/// (width a across the blade, height b), 3 tube (outside diameter a, wall b).
/// `which`: 0 metal area cut (all pieces), 1 height the blade feeds through,
/// 2 effective width (the longest path of the blade in the bundle, across it),
/// 3 number of pieces. Same length unit throughout; area in that unit squared.
/// NaN for impossible input (tube wall over half the diameter).
pub fn saw_section(shape: f64, a: f64, b: f64, nx: f64, ny: f64, which: f64) -> f64 {
    let (nx, ny) = (nx.max(1.0).floor(), ny.max(1.0).floor());
    if !(a > 0.0) { return f64::NAN; }
    let (area, w, h) = match shape as i32 {
        1 => (PI / 4.0 * a * a, a, a),
        2 if b > 0.0 => (a * b, a, b),
        3 if b > 0.0 && b < a / 2.0 => (PI / 4.0 * (a * a - (a - 2.0 * b).powi(2)), a, a),
        _ => return f64::NAN,
    };
    match which as i32 { 0 => area * nx * ny, 1 => h * ny, 2 => w * nx, 3 => nx * ny, _ => f64::NAN }
}

/// Bandsaw cut time (min) from the metal area cut and a cutting rate in area
/// per minute (in^2/min or cm^2/min, the figure saw and blade makers quote):
/// t = area / rate. [Starrett Bulletin 193; Machinery's Handbook, band saw blades]
pub fn saw_cut_time(area: f64, rate: f64) -> f64 { if area >= 0.0 && rate > 0.0 { area / rate } else { f64::NAN } }

/// Spot or countersink depth from the tool tip for a chamfer (countersink) diameter
/// `dc` with included angle `angle`: (dc/2) / tan(angle/2).
pub fn spot_depth(dc: f64, angle_deg: f64) -> f64 {
    if !(dc > 0.0 && angle_deg > 0.0 && angle_deg < 180.0) { return f64::NAN; }
    dc / 2.0 / (angle_deg.to_radians() / 2.0).tan()
}

/// Chamfer diameter a pointed tool of included angle `angle` cuts at depth `z`
/// from its tip: 2 z tan(angle/2) (inverse of `spot_depth`).
pub fn spot_chamfer_dia(z: f64, angle_deg: f64) -> f64 {
    if !(z >= 0.0 && angle_deg > 0.0 && angle_deg < 180.0) { return f64::NAN; }
    2.0 * z * (angle_deg.to_radians() / 2.0).tan()
}

/// Centre drill depth from its tip for countersink diameter `dc`: the length from the
/// tip to where the countersink cone starts (`l_pilot`, measured or from the maker),
/// plus the cone from the pilot diameter `dp` out to dc: l + (dc - dp) / (2 tan(angle/2)).
pub fn centre_drill_depth(dc: f64, dp: f64, l_pilot: f64, angle_deg: f64) -> f64 {
    if !(dc >= dp && dp > 0.0 && l_pilot >= 0.0 && angle_deg > 0.0 && angle_deg < 180.0) { return f64::NAN; }
    l_pilot + (dc - dp) / 2.0 / (angle_deg.to_radians() / 2.0).tan()
}

/// Countersink diameter reached by a centre drill at depth `z` from its tip (inverse of the above).
pub fn centre_drill_dia(z: f64, dp: f64, l_pilot: f64, angle_deg: f64) -> f64 {
    if z < l_pilot || !(dp > 0.0 && angle_deg > 0.0 && angle_deg < 180.0) { return f64::NAN; }
    dp + 2.0 * (z - l_pilot) * (angle_deg.to_radians() / 2.0).tan()
}

/// f64-argument helpers for the WebAssembly layer.
pub fn engagement_deg_f(ae: f64, d: f64) -> f64 { engagement_rad(ae, d).to_degrees() }
pub fn engagement_arc_deg_f(ae: f64, d: f64, r_wall: f64, inside: f64) -> f64 { engagement_arc_rad(ae, d, r_wall, inside != 0.0).to_degrees() }

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    #[test]
    fn chip_thinning_factor() {
        // 10 % stepover: 1 - 2(0.1) = 0.8, sqrt(1 - 0.64) = 0.6, RCTF = 1.6667 (hand).
        assert!(close(rctf(1.0, 10.0), 1.0 / 0.6, 1e-12));
        // agrees with the existing hex formula: hex = fz / RCTF
        assert!(close(crate::chip_thickness_max(0.1, 1.0, 10.0), 0.1 / rctf(1.0, 10.0), 1e-12));
        assert_eq!(rctf(6.0, 10.0), 1.0);
        // RCTF = D / (2 sqrt(ae (D - ae))): 12 mm tool, ae 0.6: 12 / (2 sqrt(6.84)) = 2.29416
        assert!(close(rctf(0.6, 12.0), 12.0 / (2.0 * (0.6f64 * 11.4).sqrt()), 1e-12));
    }

    #[test]
    fn arc_engagement() {
        // Very large radius tends to the straight wall in both directions.
        let s = engagement_rad(2.0, 10.0);
        assert!(close(engagement_arc_rad(2.0, 10.0, 1e7, true), s, 1e-5));
        assert!(close(engagement_arc_rad(2.0, 10.0, 1e7, false), s, 1e-5));
        // Inside corners engage more, outside less.
        assert!(engagement_arc_rad(2.0, 10.0, 8.0, true) > s);
        assert!(engagement_arc_rad(2.0, 10.0, 8.0, false) < s);
        // Brute force: sample the tool circle and find the last point still outside the
        // previous wall (inside corner, R = 8, r = 5, ae = 2, previous wall R - ae = 6).
        let (r, rw, ae) = (5.0f64, 8.0f64, 2.0f64);
        let a = rw - r;
        let mut last = 0.0;
        for i in 0..=200000 { let t = PI * i as f64 / 200000.0; let x = a + r * t.cos(); let y = r * t.sin(); if (x * x + y * y).sqrt() > rw - ae { last = t; } }
        assert!(close(engagement_arc_rad(ae, 2.0 * r, rw, true), last, 2e-5));
        assert!(engagement_arc_rad(2.0, 10.0, 5.0, true).is_nan());
    }

    #[test]
    fn cusp_and_stepover() {
        // R 5, stepover 1: 5 - sqrt(24.75) = 0.025063 (hand); IMCO approx 1/40 = 0.025.
        assert!(close(cusp_height(5.0, 1.0), 5.0 - 24.75f64.sqrt(), 1e-12));
        assert!(close(cusp_height(5.0, 1.0), 1.0 / 40.0, 1e-4));
        assert!(close(stepover_for_cusp(5.0, cusp_height(5.0, 1.0)), 1.0, 1e-9));
        // 1/2 in ball (R 0.25), 0.0002 in cusp: 2 sqrt(0.0001 - 4e-8) = 0.019996
        assert!(close(stepover_for_cusp(0.25, 0.0002), 2.0 * (0.0001f64 - 4e-8).sqrt(), 1e-12));
    }

    #[test]
    fn ball_effective_diameter() {
        // ISCAR form, no tilt: D 10, ap 1 -> 2 sqrt(10 - 1) = 6.0
        assert!(close(ball_eff_dia(10.0, 1.0, 0.0), 6.0, 1e-12));
        assert_eq!(ball_min_dia(10.0, 1.0, 0.0), 0.0);
        // Tilt 15 deg: theta0 = acos(0.8) = 36.87 deg, De = 10 sin(51.87) = 7.8673
        assert!(close(ball_eff_dia(10.0, 1.0, 15.0), 10.0 * (0.8f64.acos() + 15f64.to_radians()).sin(), 1e-12));
        // Tilt 45 deg: band 8.13..81.87 deg, min De = 10 sin(8.13 deg) = 1.4142
        assert!(close(ball_min_dia(10.0, 1.0, 45.0), 10.0 * (45f64.to_radians() - 0.8f64.acos()).sin(), 1e-12));
        // ap past the equator: full diameter
        assert!(close(ball_eff_dia(10.0, 6.0, 0.0), 10.0, 1e-12));
        // IMCO / Machining Doctor axial factor: fz_adj = D fz / De, = D / sqrt(D^2 - (D - 2ap)^2)
        let de = ball_eff_dia(10.0, 1.0, 0.0);
        assert!(close(10.0 / de, 10.0 / (100.0f64 - 64.0).sqrt(), 1e-12));
    }

    #[test]
    fn runout() {
        // Two flutes, fz 0.05, TIR 0.02: one tooth 0.07, the other 0.03.
        let c = runout_chips(0.05, 0.02, 2);
        assert!(close(c[0], 0.07, 1e-12) && close(c[1], 0.03, 1e-12));
        // TIR larger than fz on 2 flutes: one tooth takes 2 fz, the other none.
        let c = runout_chips(0.01, 0.03, 2);
        assert!(close(c[0], 0.02, 1e-12) && close(c[1], 0.0, 1e-12));
        // z teeth: worst tooth fz + TIR sin(pi/z); chips always add up to z fz.
        for z in 1..9 {
            let c = runout_chips(0.1, 0.01, z);
            let mx = c.iter().cloned().fold(0.0, f64::max);
            assert!(close(mx, runout_chip_max(0.1, 0.01, z as f64), 1e-12), "z {z}");
            assert!(close(c.iter().sum::<f64>(), 0.1 * z as f64, 1e-12));
        }
        // Brute-force scan of the runout phase: no phase gives a larger worst tooth.
        for z in [2usize, 3, 4, 5] {
            let rho = 0.005; let fz = 0.1; let mut best = 0.0f64;
            for p in 0..3600 { let lam = 2.0 * PI * p as f64 / 3600.0;
                for i in 0..z { let ri = rho * (lam - 2.0 * PI * i as f64 / z as f64).cos(); let rj = rho * (lam - 2.0 * PI * ((i + z - 1) % z) as f64 / z as f64).cos(); best = best.max(fz + ri - rj); } }
            assert!(best <= runout_chip_max(fz, 2.0 * rho, z as f64) + 1e-12);
            assert!(best >= runout_chip_max(fz, 2.0 * rho, z as f64) - 1e-6);
        }
        assert!(close(runout_fz_for_max(0.07, 0.02, 2.0), 0.05, 1e-12));
    }

    #[test]
    fn saw_and_teeth() {
        // 100 mm saw, 10 mm deep: approach sqrt(10 x 90) = 30
        assert!(close(cutter_approach(100.0, 10.0), 30.0, 1e-12));
        // engagement acos(0.8) = 36.87 deg; 40 teeth -> 4.097 teeth in cut
        assert!(close(teeth_engaged(40.0, 10.0, 100.0), 40.0 * 0.8f64.acos() / (2.0 * PI), 1e-12));
    }

    #[test]
    fn lathe_passes() {
        assert_eq!(turn_passes(50.0, 40.0, 2.0), 3.0); // 5 mm stock -> 3 passes of 1.667
        assert_eq!(turn_passes(50.0, 42.0, 2.0), 2.0); // exactly 2 passes of 2
        // Constant rpm 1000, 3 passes, 100 mm at 0.2 mm/rev: 0.5 min each.
        let p = turn_rough(50.0, 40.0, 2.0, 100.0, 0.2, 0.0, 1000.0, 0.0);
        assert_eq!(p.len(), 3);
        assert!(close(p.iter().map(|x| x.2).sum::<f64>(), 1.5, 1e-12));
        assert!(close(p[2].0, 40.0, 1e-12));
        // CSS 200 m/min: pass 1 finished at 50 - 10/3 = 46.667 mm -> 1364.2 rpm (hand: 200000 / (pi 46.667))
        let p = turn_rough(50.0, 40.0, 2.0, 100.0, 0.2, 200.0, 0.0, 0.0);
        assert!(close(p[0].1, 200000.0 / (PI * (50.0 - 10.0 / 3.0)), 1e-9));
        // rpm cap
        let p = turn_rough(50.0, 40.0, 2.0, 100.0, 0.2, 200.0, 0.0, 1400.0);
        assert!(close(p[2].1, 1400.0, 1e-12));
    }

    #[test]
    fn c_axis() {
        // 100 mm/min at 50 mm diameter: 100 x 360 / (pi 50) = 229.18 deg/min
        assert!(close(c_axis_deg_min(100.0, 50.0), 36000.0 / (PI * 50.0), 1e-9));
        assert!(close(c_axis_feed_from_deg(c_axis_deg_min(100.0, 50.0), 50.0), 100.0, 1e-9));
        // 90 deg at 40 mm diameter = 31.416 mm arc, plus 30 mm linear; at 300 mm/min
        // path sqrt(900 + 986.96) = 43.439 mm -> 0.1448 min -> F 6.906
        let f = inverse_time_f(30.0, 90.0, 40.0, 300.0);
        assert!(close(f, 300.0 / (900.0 + (10.0 * PI).powi(2)).sqrt(), 1e-12));
    }

    #[test]
    fn boring_bar() {
        // Steel bar 20 mm, overhang 80 mm, 500 N, E 210 GPa:
        // I = pi 20^4 / 64 = 7853.98 mm^4; d = 500 x 80^3 / (3 x 210000 x 7853.98) = 0.051737 mm
        let i = PI * 20f64.powi(4) / 64.0;
        assert!(close(boring_bar_deflection(500.0, 80.0, 20.0, 0.0, 210.0), 500.0 * 512000.0 / (3.0 * 210000.0 * i), 1e-12));
        // A 6 mm coolant hole removes (6/20)^4 = 0.81 % of I.
        let r = boring_bar_deflection(500.0, 80.0, 20.0, 6.0, 210.0) / boring_bar_deflection(500.0, 80.0, 20.0, 0.0, 210.0);
        assert!(close(r, 1.0 / (1.0 - 0.0081), 1e-12));
        assert!(close(turning_force(2000.0, 2.0, 0.2), 800.0, 1e-12));
    }

    #[test]
    fn bandsaw_and_drills() {
        // 60 m/min blade, 6 TPI, 30 mm/min down-feed: teeth per min = 60000/25.4 x 6 = 14173.2,
        // chip = 0.0021167 mm
        assert!(close(bandsaw_chip_per_tooth(30.0, 60.0, 6.0), 30.0 / (60000.0 / 25.4 * 6.0), 1e-15));
        // Machinery's Handbook (band saw blades) example: 5.5 in^2 at about 4 in^2/min = 1.375 min.
        assert!(close(saw_cut_time(5.5, 4.0), 1.375, 1e-15));
        assert!(saw_cut_time(5.5, 0.0).is_nan());
        // Single 4 in round: area 12.566 in^2, height and width 4 in.
        assert!(close(saw_section(1.0, 4.0, 0.0, 1.0, 1.0, 0.0), 4.0 * PI, 1e-12));
        assert!(close(saw_section(1.0, 4.0, 0.0, 1.0, 1.0, 1.0), 4.0, 1e-15));
        // Bundle of 2 in rounds, 3 across and 2 high: 6 pieces, metal area 6 pi = 18.85 in^2,
        // feed through 4 in, blade crosses 6 in.
        assert!(close(saw_section(1.0, 2.0, 0.0, 3.0, 2.0, 0.0), 6.0 * PI, 1e-12));
        assert!(close(saw_section(1.0, 2.0, 0.0, 3.0, 2.0, 1.0), 4.0, 1e-15));
        assert!(close(saw_section(1.0, 2.0, 0.0, 3.0, 2.0, 2.0), 6.0, 1e-15));
        assert!(close(saw_section(1.0, 2.0, 0.0, 3.0, 2.0, 3.0), 6.0, 1e-15));
        // Rectangles 50 x 20 mm, 4 across, 3 high: area 12 000 mm^2, height 60, width 200.
        assert!(close(saw_section(2.0, 50.0, 20.0, 4.0, 3.0, 0.0), 12_000.0, 1e-9));
        assert!(close(saw_section(2.0, 50.0, 20.0, 4.0, 3.0, 1.0), 60.0, 1e-12));
        assert!(close(saw_section(2.0, 50.0, 20.0, 4.0, 3.0, 2.0), 200.0, 1e-12));
        // Tube 60 x 3 wall: pi/4 (3600 - 2916) = 171 pi = 537.21 mm^2 per piece.
        assert!(close(saw_section(3.0, 60.0, 3.0, 2.0, 2.0, 0.0), 4.0 * 171.0 * PI, 1e-9));
        assert!(saw_section(3.0, 60.0, 30.0, 1.0, 1.0, 0.0).is_nan());
        // 90 deg spot drill, 10 mm chamfer diameter: depth 5 mm
        assert!(close(spot_depth(10.0, 90.0), 5.0, 1e-12));
        // 120 deg: 5 / tan 60 = 2.8868
        assert!(close(spot_depth(10.0, 120.0), 5.0 / 3f64.sqrt(), 1e-12));
        // centre drill, 60 deg, pilot 2.5 mm, 3 mm to the cone, 6 mm countersink:
        // 3 + 1.75 / tan 30 = 3 + 3.0311 = 6.0311
        let z = centre_drill_depth(6.0, 2.5, 3.0, 60.0);
        assert!(close(z, 3.0 + 1.75 * 3f64.sqrt(), 1e-12));
        assert!(close(centre_drill_dia(z, 2.5, 3.0, 60.0), 6.0, 1e-12));
        // spot_chamfer_dia inverts spot_depth
        assert!(close(spot_chamfer_dia(spot_depth(8.0, 118.0), 118.0), 8.0, 1e-12));
        assert!(close(spot_chamfer_dia(5.0, 90.0), 10.0, 1e-12));
        // Table sizes (data/refdata/centredrills-evidence.json):
        // ISO 866 type A, pilot 2.5 mm, pilot length 3.1 mm (min), full countersink at the
        // 6.3 mm body: 3.1 + 1.9 / tan 30 = 6.3909 mm.
        assert!(close(centre_drill_depth(6.3, 2.5, 3.1, 60.0), 3.1 + 1.9 * 3f64.sqrt(), 1e-12));
        // Inch #3 plain (7/64 pilot and length), 60 deg, 0.200 in countersink:
        // 0.109375 + 0.090625 / (2 tan 30) = 0.18786 in
        assert!(close(centre_drill_depth(0.2, 0.109375, 0.109375, 60.0), 0.109375 + 0.090625 / 2.0 * 3f64.sqrt(), 1e-12));
    }
}

