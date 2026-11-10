//! Machinists BenchMate core formulas.
//!
//! Pure functions, no I/O. Every function documents its formula and source.
//! Units are in the function name or doc: `_in` inches, `_mm` millimetres,
//! `sfm` surface feet/min, `vc` metres/min.
//!
//! Sources (standard references, formulas are not copyrightable):
//! * [MH] Machinery's Handbook, Industrial Press (speeds/feeds, threads, taper chapters)
//! * [ISO] ISO 3002-1 / ISO 3685 style symbols (Vc, fn, ap, ae)
//! * [SAN] Sandvik Coromant "Formulas and definitions" (turning/milling/drilling), public

use std::f64::consts::PI;

/// Spindle speed in RPM from surface speed in SFM and diameter in inches.
/// `n = 12 * SFM / (pi * D)` [MH]
pub fn rpm_from_sfm(sfm: f64, dia_in: f64) -> f64 {
    12.0 * sfm / (PI * dia_in)
}

/// Spindle speed in RPM from cutting speed Vc (m/min) and diameter (mm).
/// `n = 1000 * Vc / (pi * D)` [ISO][SAN]
pub fn rpm_from_vc(vc_m_min: f64, dia_mm: f64) -> f64 {
    1000.0 * vc_m_min / (PI * dia_mm)
}

/// Surface speed in SFM from RPM and diameter in inches.
pub fn sfm_from_rpm(rpm: f64, dia_in: f64) -> f64 {
    PI * dia_in * rpm / 12.0
}

/// Cutting speed Vc (m/min) from RPM and diameter (mm).
pub fn vc_from_rpm(rpm: f64, dia_mm: f64) -> f64 {
    PI * dia_mm * rpm / 1000.0
}

/// Table feed (per min) for a multi-tooth tool: `Vf = n * fz * z` [MH][SAN]
pub fn table_feed(rpm: f64, feed_per_tooth: f64, teeth: u32) -> f64 {
    rpm * feed_per_tooth * teeth as f64
}

/// Feed per tooth from table feed: `fz = Vf / (n * z)`
pub fn feed_per_tooth(table_feed: f64, rpm: f64, teeth: u32) -> f64 {
    table_feed / (rpm * teeth as f64)
}

/// Turning material removal rate, mm: Q (cm^3/min) = Vc * ap * f [SAN]
/// (Vc m/min, ap mm, f mm/rev).
pub fn mrr_turning_cm3_min(vc_m_min: f64, ap_mm: f64, f_mm_rev: f64) -> f64 {
    vc_m_min * ap_mm * f_mm_rev
}

/// Turning material removal rate, inch: Q (in^3/min) = 12 * SFM * DOC * IPR [MH]
pub fn mrr_turning_in3_min(sfm: f64, doc_in: f64, ipr: f64) -> f64 {
    12.0 * sfm * doc_in * ipr
}

/// Milling material removal rate, Q = ae * ap * Vf (same units cubed per min) [MH][SAN]
pub fn mrr_milling(ae: f64, ap: f64, table_feed: f64) -> f64 {
    ae * ap * table_feed
}

/// Net spindle power at the cut, kW: `Pc = Q(cm^3/min) * kc(N/mm^2) / (60 000)`.
/// With kc in N/mm^2 (= MPa) and Q in cm^3/min this gives kW before efficiency [SAN].
/// Divide by machine efficiency (`eta`, 0..1) for motor power.
/// `kc` is a user input; BenchMate does not guess it.
pub fn power_kw(q_cm3_min: f64, kc_n_mm2: f64, eta: f64) -> f64 {
    q_cm3_min * kc_n_mm2 / (60_000.0 * eta)
}

/// Theoretical peak-to-valley roughness for a round nose, `Rt = f^2 / (8 r)`
/// (f feed per rev, r nose radius, same units; valid for f < 2r) [MH]
pub fn rt_theoretical(feed: f64, nose_radius: f64) -> f64 {
    feed * feed / (8.0 * nose_radius)
}

/// Theoretical arithmetic roughness `Ra ~ f^2 / (32 r)` (same units) [MH][SAN].
/// This is a geometric ideal; real finish is usually worse.
pub fn ra_theoretical(feed: f64, nose_radius: f64) -> f64 {
    feed * feed / (32.0 * nose_radius)
}

/// Feed per rev needed for a target theoretical Ra: `f = sqrt(32 r Ra)`
pub fn feed_for_ra(ra: f64, nose_radius: f64) -> f64 {
    (32.0 * nose_radius * ra).sqrt()
}

/// Machining time (min) for a single pass: `T = L / (f * n)` [MH]
pub fn pass_time_min(length: f64, feed_per_rev: f64, rpm: f64) -> f64 {
    length / (feed_per_rev * rpm)
}

/// Included taper angle (degrees) from large dia, small dia, length.
/// `tan(half) = (D - d) / (2 L)` [MH]
pub fn taper_included_angle_deg(large: f64, small: f64, length: f64) -> f64 {
    2.0 * ((large - small) / (2.0 * length)).atan().to_degrees()
}

/// Taper per unit length (dia change over length): `(D - d) / L` [MH]
pub fn taper_per_length(large: f64, small: f64, length: f64) -> f64 {
    (large - small) / length
}

/// Small diameter from large dia, length and included angle (deg).
pub fn taper_small_dia(large: f64, length: f64, included_deg: f64) -> f64 {
    large - 2.0 * length * (included_deg.to_radians() / 2.0).tan()
}

/// Drill point length (axial) for point angle in degrees: `h = (d/2) / tan(angle/2)` [MH]
pub fn drill_point_length(dia: f64, point_angle_deg: f64) -> f64 {
    (dia / 2.0) / (point_angle_deg.to_radians() / 2.0).tan()
}

/// Basic pitch diameter of a 60 deg symmetric thread (UN or ISO metric):
/// `E = D - 0.649519 P` [MH][ISO 68-1]. Pass pitch P (inches = 1/TPI, or mm).
pub fn thread_pitch_dia_basic(major: f64, pitch: f64) -> f64 {
    major - 0.649519 * pitch
}

/// Best-size wire for 60 deg threads: `w = 0.57735 P` [MH]
pub fn thread_best_wire(pitch: f64) -> f64 {
    0.577350269 * pitch
}

/// Measurement over three wires, 60 deg thread:
/// `M = E + 3w - 0.866025 P` [MH]. (Lead angle correction neglected, per the
/// basic formula; significant only on coarse multi-start threads.)
pub fn thread_three_wire_m(pitch_dia: f64, wire: f64, pitch: f64) -> f64 {
    pitch_dia + 3.0 * wire - 0.866025404 * pitch
}

/// Hole coordinates on a bolt circle: returns (x, y) for `n` equally spaced
/// holes, first at `start_deg` measured counter-clockwise from +X [MH].
pub fn bolt_circle(n: u32, dia: f64, start_deg: f64, cx: f64, cy: f64) -> Vec<(f64, f64)> {
    (0..n)
        .map(|i| {
            let a = (start_deg + 360.0 * i as f64 / n as f64).to_radians();
            (cx + dia / 2.0 * a.cos(), cy + dia / 2.0 * a.sin())
        })
        .collect()
}

/// f64-argument helpers used by the WebAssembly layer (teeth as a number).
pub fn table_feed_f(rpm: f64, fz: f64, teeth: f64) -> f64 { table_feed(rpm, fz, teeth as u32) }
pub fn feed_per_tooth_f(vf: f64, rpm: f64, teeth: f64) -> f64 { feed_per_tooth(vf, rpm, teeth as u32) }

pub const MM_PER_IN: f64 = 25.4; // exact by definition

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    #[test] fn rpm_imperial() { close(rpm_from_sfm(100.0, 0.5), 763.944, 0.001); }
    #[test] fn rpm_metric() { close(rpm_from_vc(100.0, 10.0), 3183.099, 0.001); }
    #[test] fn sfm_roundtrip() { close(sfm_from_rpm(rpm_from_sfm(250.0, 0.375), 0.375), 250.0, 1e-9); }
    #[test] fn feed_table() { close(table_feed(2000.0, 0.002, 4), 16.0, 1e-9); }
    #[test] fn fz_roundtrip() { close(feed_per_tooth(16.0, 2000.0, 4), 0.002, 1e-12); }
    #[test] fn mrr_turn_metric() { close(mrr_turning_cm3_min(200.0, 2.0, 0.2), 80.0, 1e-9); }
    #[test] fn mrr_turn_inch() { close(mrr_turning_in3_min(300.0, 0.05, 0.005), 0.9, 1e-9); }
    #[test] fn mrr_mill() { close(mrr_milling(0.25, 0.5, 20.0), 2.5, 1e-9); }
    #[test] fn power() { close(power_kw(80.0, 2000.0, 1.0), 2.6667, 1e-3); }
    #[test] fn finish() {
        close(rt_theoretical(0.1, 0.4), 0.003125, 1e-9);
        close(ra_theoretical(0.1, 0.4), 0.00078125, 1e-9);
        close(feed_for_ra(0.00078125, 0.4), 0.1, 1e-9);
    }
    #[test] fn time() { close(pass_time_min(30.0, 0.05, 6000.0), 0.1, 1e-12); }
    #[test] fn taper() {
        // 1:20-ish check: D=1.0, d=0.5, L=2.5 -> half angle atan(0.1)=5.7106 deg
        close(taper_included_angle_deg(1.0, 0.5, 2.5), 11.4212, 1e-3);
        close(taper_per_length(1.0, 0.5, 2.5), 0.2, 1e-12);
        close(taper_small_dia(1.0, 2.5, 11.4212), 0.5, 1e-4);
    }
    #[test] fn drill_point() { close(drill_point_length(10.0, 118.0), 3.0041, 1e-3); }
    #[test] fn thread_3wire() {
        // 1/2-13 UNC: P=1/13, E = 0.5 - 0.649519/13 = 0.450037
        let p = 1.0 / 13.0;
        let e = thread_pitch_dia_basic(0.5, p);
        close(e, 0.450037, 1e-6);
        let w = thread_best_wire(p);
        close(w, 0.044411, 1e-6);
        close(thread_three_wire_m(e, w, p), 0.516654, 1e-5);
    }
    #[test] fn bolt() {
        let h = bolt_circle(4, 100.0, 0.0, 0.0, 0.0);
        close(h[0].0, 50.0, 1e-9);
        close(h[1].1, 50.0, 1e-9);
        close(h[2].0, -50.0, 1e-9);
    }
}
