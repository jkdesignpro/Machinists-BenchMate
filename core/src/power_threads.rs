//! Threads round 3: ACME (general purpose), Stub ACME, metric trapezoidal,
//! buttress, UNJ / UNR root rules, helical-insert (STI) tapped holes, coating
//! allowance on threads, measurement over wires for any symmetrical thread
//! angle, and multi-start lead.
//!
//! Standards are cited by name and clause only; no text or tables from them
//! are reproduced. Each formula here was confirmed in at least one free
//! publisher (see docs/sources.md, "Threads round 3") and is tested against
//! rows those publishers print.

// ---------------------------------------------------------------------------
// ACME general purpose (ASME B1.5), inch
// ---------------------------------------------------------------------------

/// Basic thread height of the 29 degree ACME form: `h = 0.5 P`.
pub fn acme_height(p: f64) -> f64 { 0.5 * p }

/// Basic width of the flat at crest (and at root before clearance):
/// `F = 0.3707 P`.
pub fn acme_flat(p: f64) -> f64 { 0.3707 * p }

/// Basic pitch diameter `E = D - 0.5 P`.
pub fn acme_pitch_dia(d: f64, p: f64) -> f64 { d - 0.5 * p }

/// Basic minor diameter `K = D - P`.
pub fn acme_minor_dia(d: f64, p: f64) -> f64 { d - p }

/// Major and minor diameter clearance (allowance) of general purpose ACME
/// threads: 0.020 in for 10 threads per inch and coarser, 0.010 in for finer
/// pitches. It is also the tolerance on the internal major diameter.
pub fn acme_clearance(p: f64) -> f64 {
    if 1.0 / p <= 10.0 + 1e-9 { 0.020 } else { 0.010 }
}

/// Tolerance on the external major diameter and on the internal minor
/// diameter: `0.05 P`, but not less than 0.005 in.
pub fn acme_crest_tol(p: f64) -> f64 { (0.05 * p).max(0.005) }

/// Pitch diameter allowance (minimum clearance, es) on the external thread,
/// single start: class 2G `0.008 sqrt D`, 3G `0.006 sqrt D`, 4G `0.004 sqrt D`.
/// `class`: 2, 3, 4.
pub fn acme_pd_allowance(d: f64, class: u32) -> f64 {
    let k = match class { 2 => 0.008, 3 => 0.006, 4 => 0.004, _ => return f64::NAN };
    k * d.sqrt()
}

/// Pitch diameter tolerance, same on external and internal threads:
/// class 2G `0.030 sqrt P + 0.006 sqrt D`, 3G `0.014 sqrt P + 0.0028 sqrt D`,
/// 4G `0.010 sqrt P + 0.002 sqrt D`.
pub fn acme_pd_tol(d: f64, p: f64, class: u32) -> f64 {
    let (a, b) = match class { 2 => (0.030, 0.006), 3 => (0.014, 0.0028), 4 => (0.010, 0.002), _ => return f64::NAN };
    a * p.sqrt() + b * d.sqrt()
}

fn round4(x: f64) -> f64 { ((x * 10_000.0) + 1e-7 * x.signum()).round() / 10_000.0 }

/// Centralizing class from a class code: 2, 3, 4 general purpose (G);
/// 12, 13, 14 centralizing 2C, 3C, 4C. Returns (grade, centralizing).
fn acme_class(class: u32) -> (u32, bool) {
    if class >= 12 { (class - 10, true) } else { (class, false) }
}

/// ACME limits (inch). `class` 2, 3, 4 = 2G, 3G, 4G; 12, 13, 14 = 2C, 3C,
/// 4C. `internal` false/true. `which`: 0 major max, 1 major min, 2 pitch
/// max, 3 pitch min, 4 minor max, 5 minor min.
///
/// Rounding follows the published tables: the pitch diameter allowance and
/// tolerance are rounded to 0.0001 in before they are applied; the external
/// minor diameter tolerance (1.5 x pitch diameter tolerance) is applied
/// unrounded; every limit is then given to 0.0001 in.
///
/// General purpose: external major max D, min D - max(0.05 P, 0.005);
/// external minor max K - c (c = 0.020 in at 10 TPI and coarser, else
/// 0.010); internal major D + c to D + 2c; internal minor K to K +
/// max(0.05 P, 0.005). Centralizing: external major tolerance 0.0035 sqrt D
/// (2C), 0.0015 sqrt D (3C), 0.0010 sqrt D (4C); internal major minimum
/// D + 0.001 sqrt D with tolerance 0.0035 sqrt D (2C, 3C) or 0.0020 sqrt D
/// (4C); internal minor minimum K + 0.1 P. Pitch diameters as general purpose.
pub fn acme_limit(d: f64, p: f64, class: u32, internal: bool, which: u32) -> f64 {
    let (g, cen) = acme_class(class);
    if !(2..=4).contains(&g) { return f64::NAN; }
    let e = acme_pitch_dia(d, p);
    let k = acme_minor_dia(d, p);
    let c = acme_clearance(p);
    let t_raw = acme_pd_tol(d, p, g);
    let t = round4(t_raw);
    let sd = d.sqrt();
    let v = if internal {
        let (maj_min, maj_tol) = if cen {
            (d + 0.001 * sd, if g == 4 { 0.0020 * sd } else { 0.0035 * sd })
        } else { (d + c, c) };
        let min_min = if cen { k + 0.1 * p } else { k };
        match which {
            1 => maj_min, 0 => round4(maj_min) + round4(maj_tol),
            3 => e, 2 => e + t,
            5 => min_min, 4 => min_min + acme_crest_tol(p),
            _ => f64::NAN,
        }
    } else {
        let es = round4(acme_pd_allowance(d, g));
        let maj_tol = if cen { [0.0035, 0.0015, 0.0010][(g - 2) as usize] * sd } else { acme_crest_tol(p) };
        match which {
            0 => d, 1 => d - maj_tol,
            2 => e - es, 3 => e - es - t,
            4 => k - c, 5 => k - c - 1.5 * t_raw,
            _ => f64::NAN,
        }
    };
    round4(v)
}

/// f64 interface for the WebAssembly layer: `internal` 0/1.
pub fn acme_limit_f(d: f64, p: f64, class: f64, internal: f64, which: f64) -> f64 {
    acme_limit(d, p, class as u32, internal > 0.5, which as u32)
}

// ---------------------------------------------------------------------------
// Stub ACME (ASME B1.8), inch
// ---------------------------------------------------------------------------

/// Basic thread height of the Stub ACME form: `h = 0.3 P`.
pub fn stub_acme_height(p: f64) -> f64 { 0.3 * p }

/// Basic flat at crest `F = 0.4224 P`.
pub fn stub_acme_flat(p: f64) -> f64 { 0.4224 * p }

/// Stub ACME limits (inch, to 0.0001 in, rounded as [`acme_limit`]). One
/// class, with the allowance and pitch diameter tolerance of general purpose
/// class 2G and the general purpose major and minor diameter rules, with
/// h = 0.3 P. `which` as [`acme_limit`].
pub fn stub_acme_limit(d: f64, p: f64, internal: bool, which: u32) -> f64 {
    let e = d - stub_acme_height(p);
    let k = d - 2.0 * stub_acme_height(p);
    let c = acme_clearance(p);
    let t_raw = acme_pd_tol(d, p, 2);
    let t = round4(t_raw);
    let v = if internal {
        match which {
            1 => d + c, 0 => d + 2.0 * c,
            3 => e, 2 => e + t,
            5 => k, 4 => k + acme_crest_tol(p),
            _ => f64::NAN,
        }
    } else {
        let pmax = e - round4(acme_pd_allowance(d, 2));
        match which {
            0 => d, 1 => d - acme_crest_tol(p),
            2 => pmax, 3 => pmax - t,
            4 => k - c, 5 => k - c - 1.5 * t_raw,
            _ => f64::NAN,
        }
    };
    round4(v)
}

/// f64 interface: `internal` 0/1.
pub fn stub_acme_limit_f(d: f64, p: f64, internal: f64, which: f64) -> f64 {
    stub_acme_limit(d, p, internal > 0.5, which as u32)
}

// ---------------------------------------------------------------------------
// Metric trapezoidal threads (ISO 2904 basic profile), mm
// ---------------------------------------------------------------------------

/// Crest clearance `ac` of the trapezoidal profile (mm): 0.15 for P = 1.5,
/// 0.25 for P 2 to 5, 0.5 for P 6 to 12, 1 for P 14 to 44.
pub fn trap_ac(p: f64) -> f64 {
    if p < 1.75 { 0.15 } else if p < 5.5 { 0.25 } else if p < 13.0 { 0.5 } else { 1.0 }
}

/// Trapezoidal basic dimensions (mm). `what`: 0 pitch diameter d2 = D2 =
/// d - 0.5P, 1 external minor d3 = d - 2 h3, 2 internal minor D1 = d - P,
/// 3 internal major D4 = d + 2 ac, 4 thread height h3 = H4 = 0.5P + ac,
/// 5 overlap H1 = 0.5P, 6 ac, 7 root radius R1 max = 0.5 ac, 8 R2 max = ac,
/// 9 flat at crest 0.366P (z = 0.25 P), 10 lead angle (deg) for one start.
pub fn trap_value(d: f64, p: f64, what: u32) -> f64 {
    let ac = trap_ac(p);
    let h3 = 0.5 * p + ac;
    match what {
        0 => d - 0.5 * p,
        1 => d - 2.0 * h3,
        2 => d - p,
        3 => d + 2.0 * ac,
        4 => h3,
        5 => 0.5 * p,
        6 => ac,
        7 => 0.5 * ac,
        8 => ac,
        9 => 0.366 * p,
        10 => lead_angle_deg(p, d - 0.5 * p),
        _ => f64::NAN,
    }
}

/// f64 interface for [`trap_value`].
pub fn trap_value_f(d: f64, p: f64, what: f64) -> f64 { trap_value(d, p, what as u32) }

// ---------------------------------------------------------------------------
// Buttress inch threads, 7/45 form (ASME B1.9), basic (maximum material)
// ---------------------------------------------------------------------------

/// Buttress 7/45 basic values (inch or any unit; `p` = pitch). Load flank 7
/// degrees and clearance flank 45 degrees from the perpendicular to the axis;
/// basic height of engagement h = 0.6 P (the standard's title). The other
/// constants follow from the geometry and the stated root radius
/// r = 0.07141 P: H = P / (tan 7 + tan 45) = 0.89064 P; crest truncation
/// f = (H - h) / 2 = 0.14532 P; crest flat F = f (tan 7 + tan 45) =
/// 0.16316 P; root truncation s = r (cos 19 / sin 26 - 1) = 0.08261 P (arc
/// tangent to both flanks); thread height hs = hn = H - f - s = 0.66271 P.
/// `what`: 0 H, 1 h, 2 r, 3 s, 4 f, 5 F, 6 hs, 7 internal major
/// D + 2 (hs - h) = D + 0.12542 P, 8 pitch diameter D - h, 9 external minor
/// D - 2 hs = D - 1.32542 P, 10 internal minor D - 2 h, 11 flat root width
/// for a flat-bottom root S = 0.0928 P (stated, not derived).
pub fn buttress_value(d: f64, p: f64, what: u32) -> f64 {
    let k = 7f64.to_radians().tan() + 1.0;
    let h_sharp = p / k;
    let h = 0.6 * p;
    let f = (h_sharp - h) / 2.0;
    let r = 0.07141 * p;
    let s = r * (19f64.to_radians().cos() / 26f64.to_radians().sin() - 1.0);
    let hs = h_sharp - f - s;
    match what {
        0 => h_sharp, 1 => h, 2 => r, 3 => s, 4 => f, 5 => f * k, 6 => hs,
        7 => d + 2.0 * (hs - h), 8 => d - h, 9 => d - 2.0 * hs, 10 => d - 2.0 * h,
        11 => 0.0928 * p,
        _ => f64::NAN,
    }
}

/// f64 interface for [`buttress_value`].
pub fn buttress_value_f(d: f64, p: f64, what: f64) -> f64 { buttress_value(d, p, what as u32) }

// ---------------------------------------------------------------------------
// UNJ (ASME B1.15) and UNR (ASME B1.1) root rules, inch
// ---------------------------------------------------------------------------

/// Minor diameter of a 60 degree external thread whose root is an arc of
/// radius `r` tangent to both flanks: `d3 = E - 2 (H/2 - r)`, E = pitch
/// diameter, H = 0.866025 P (the sharp-vee root lies H/2 below the pitch
/// line and the arc bottom lies r above it).
pub fn rounded_root_minor(e: f64, p: f64, r: f64) -> f64 {
    e - 2.0 * (crate::thread_fundamental_h(p) / 2.0 - r)
}

/// UNJ values (inch). `class` 3 (3A/3B) or 2 (2A/2B), as for UN.
/// `what`: 0 external root radius min 0.15011 P, 1 max 0.18042 P,
/// 2 external minor max (pitch diameter max, radius max), 3 external minor
/// min (pitch diameter min, radius min), 4 internal minor min
/// D - 0.974279 P (= D - 2 x 0.5625 H), 5 external pitch diameter max,
/// 6 external pitch diameter min (UN limits of the same class).
pub fn unj_value(d: f64, p: f64, class: u32, what: u32) -> f64 {
    let (rmin, rmax) = (0.15011 * p, 0.18042 * p);
    let emax = crate::un_limit(d, p, class, 2);
    let emin = crate::un_limit(d, p, class, 3);
    match what {
        0 => rmin, 1 => rmax,
        2 => rounded_root_minor(emax, p, rmax),
        3 => rounded_root_minor(emin, p, rmin),
        4 => d - 2.0 * 0.5625 * crate::thread_fundamental_h(p),
        5 => emax, 6 => emin,
        _ => f64::NAN,
    }
}

/// f64 interface for [`unj_value`].
pub fn unj_value_f(d: f64, p: f64, class: f64, what: f64) -> f64 { unj_value(d, p, class as u32, what as u32) }

// ---------------------------------------------------------------------------
// Unified miniature threads (UNM, ASME B1.10M), mm
// ---------------------------------------------------------------------------

/// UNM basic and design values (mm). 60 degree form, basic thread height
/// 0.48 P (shallower than UN), external design height 0.5725907 P, internal
/// design height 0.5160844 P. `what`: 0 pitch diameter D - 0.649519 P,
/// 1 external design minor D - 1.1451814 P, 2 internal minor D - 0.96 P,
/// 3 internal design major D + 0.0721688 P, 4 basic height 0.48 P,
/// 5 external root radius 0.1851815 P, 6 internal root radius 0.0721688 P.
pub fn unm_value(d: f64, p: f64, what: u32) -> f64 {
    match what {
        0 => crate::thread_basic_pitch_dia(d, p),
        1 => d - 2.0 * 0.5725907 * p,
        2 => d - 2.0 * 0.48 * p,
        3 => d - 2.0 * 0.48 * p + 2.0 * 0.5160844 * p,
        4 => 0.48 * p,
        5 => 0.1851815 * p,
        6 => 0.0721688 * p,
        _ => f64::NAN,
    }
}

/// f64 interface for [`unm_value`].
pub fn unm_value_f(d: f64, p: f64, what: f64) -> f64 { unm_value(d, p, what as u32) }

// ---------------------------------------------------------------------------
// Helical coil insert (STI) tapped holes, 60 degree threads
// ---------------------------------------------------------------------------

/// Basic diameters of the tapped (STI) thread for a helical coil insert that
/// gives a nominal 60 degree thread of major diameter `d` and pitch `p`
/// (inch or mm). The tapped thread is the nominal internal thread with every
/// diameter larger by `2 x 0.649519 P = 1.299038 P`, which is the rule the
/// insert makers' tables follow (tests below). `what`: 0 major (minimum)
/// D + 1.299038 P, 1 pitch diameter (minimum) D + 0.649519 P, 2 minor
/// (minimum) D + 0.216506 P, 3 the enlargement 1.299038 P.
pub fn sti_value(d: f64, p: f64, what: u32) -> f64 {
    let k = 2.0 * 0.75 * (3f64.sqrt() / 2.0); // 2 x (3/4) H / P = 1.299038
    match what {
        0 => d + k * p,
        1 => crate::thread_basic_pitch_dia(d, p) + k * p,
        2 => crate::thread_basic_minor_dia(d, p) + k * p,
        3 => k * p,
        _ => f64::NAN,
    }
}

/// f64 interface for [`sti_value`].
pub fn sti_value_f(d: f64, p: f64, what: f64) -> f64 { sti_value(d, p, what as u32) }

// ---------------------------------------------------------------------------
// Coating allowance, wires, multi-start
// ---------------------------------------------------------------------------

/// Change of pitch diameter for a uniform coating of thickness `t` on the
/// flanks of a symmetrical thread of included angle `angle_deg`:
/// `dE = 2 t / sin(angle / 2)`. For 60 degrees this is `4 t`.
pub fn coating_pd_change(t: f64, angle_deg: f64) -> f64 {
    2.0 * t / (angle_deg.to_radians() / 2.0).sin()
}

/// Best wire size for a symmetrical thread: the wire touching the flanks at
/// the pitch line, `w = P / (2 cos(a/2))` (0.57735 P at 60 deg, 0.51645 P at
/// 29 deg, 0.56368 P at 55 deg). Lead angle ignored.
pub fn best_wire(p: f64, angle_deg: f64) -> f64 {
    p / (2.0 * (angle_deg.to_radians() / 2.0).cos())
}

/// Measurement over three wires for a symmetrical thread, lead angle ignored:
/// `M = E + w (1 + 1 / sin(a/2)) - (P / 2) cot(a/2)`.
pub fn wire_measurement(e: f64, w: f64, p: f64, angle_deg: f64) -> f64 {
    let h = angle_deg.to_radians() / 2.0;
    e + w * (1.0 + 1.0 / h.sin()) - p / 2.0 / h.tan()
}

/// Pitch diameter from a measurement over three wires (inverse of
/// [`wire_measurement`]).
pub fn pitch_dia_from_wires(m: f64, w: f64, p: f64, angle_deg: f64) -> f64 {
    let h = angle_deg.to_radians() / 2.0;
    m - w * (1.0 + 1.0 / h.sin()) + p / 2.0 / h.tan()
}

/// Lead angle (helix angle at the pitch diameter) in degrees:
/// `atan(L / (pi E))`, L = lead.
pub fn lead_angle_deg(lead: f64, e: f64) -> f64 {
    (lead / (std::f64::consts::PI * e)).atan().to_degrees()
}

/// Largest and smallest wire for measuring a 60 degree thread, as printed
/// (NBS Letter Circular 23, 1923, table 1; Thread Check prints the largest as
/// 1.010362 P): 1.010363 P and 0.505182 P. Lead angle ignored.
pub fn max_wire_60(p: f64) -> f64 { 1.010363 * p }
pub fn min_wire_60(p: f64) -> f64 { 0.505182 * p }

/// Flats of the basic 60 degree profile (ISO 68-1, ASME B1.1): P/8 at the
/// major diameter, P/4 at the basic minor diameter.
pub fn basic_flat_60(p: f64, at_minor: bool) -> f64 { if at_minor { p / 4.0 } else { p / 8.0 } }

/// f64 interface: `what` 0 coating PD change (a = thickness, b = angle),
/// 1 best wire (a = P, b = angle), 2 lead angle (a = lead, b = pitch dia),
/// 3 largest and 4 smallest wire for 60 degrees (a = P), 5 basic flat at the
/// major and 6 at the minor diameter of the 60 degree profile (a = P).
pub fn thread_misc_f(a: f64, b: f64, what: f64) -> f64 {
    match what as i32 {
        0 => coating_pd_change(a, b),
        1 => best_wire(a, b),
        2 => lead_angle_deg(a, b),
        3 => max_wire_60(a),
        4 => min_wire_60(a),
        5 => basic_flat_60(a, false),
        6 => basic_flat_60(a, true),
        _ => f64::NAN,
    }
}

/// f64 interface: `inverse` 0 gives M from E, 1 gives E from M.
pub fn wire_measurement_f(x: f64, w: f64, p: f64, angle_deg: f64, inverse: f64) -> f64 {
    if inverse > 0.5 { pitch_dia_from_wires(x, w, p, angle_deg) } else { wire_measurement(x, w, p, angle_deg) }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b} (tol {tol})"); }

    /// 1/4-20 (P = 0.05 in): the printed constants times P, flats P/8 and P/4.
    #[test]
    fn wire_limits_and_flats() {
        let p = 1.0 / 20.0;
        close(thread_misc_f(p, 0.0, 3.0), 0.0505, 1e-4);
        close(thread_misc_f(p, 0.0, 4.0), 0.0253, 1e-4);
        close(thread_misc_f(p, 60.0, 1.0), 0.0289, 1e-4);
        close(thread_misc_f(p, 0.0, 5.0), 0.00625, 1e-9);
        close(thread_misc_f(p, 0.0, 6.0), 0.0125, 1e-9);
        // The largest wire touches the flank at the major-diameter flat: 7 P / (8 cos 30).
        close(max_wire_60(1.0), 7.0 / (8.0 * 30f64.to_radians().cos()), 1e-6);
    }

    /// 2-4 ACME as printed by MachiningDoctor (threadinfo-acme, tid 5014,
    /// accessed 2026-11-11). Class, external (major max, min, pitch max, min,
    /// minor max, min), internal (major min, max, pitch min, max, minor min, max).
    const ACME_2_4: [(u32, [f64; 6], [f64; 6]); 6] = [
        (2, [2.0, 1.9875, 1.8637, 1.8402, 1.73, 1.6948], [2.02, 2.04, 1.875, 1.8985, 1.75, 1.7625]),
        (3, [2.0, 1.9875, 1.8665, 1.8555, 1.73, 1.7136], [2.02, 2.04, 1.875, 1.886, 1.75, 1.7625]),
        (4, [2.0, 1.9875, 1.8693, 1.8615, 1.73, 1.7183], [2.02, 2.04, 1.875, 1.8828, 1.75, 1.7625]),
        (12, [2.0, 1.9951, 1.8637, 1.8402, 1.73, 1.6948], [2.0014, 2.0063, 1.875, 1.8985, 1.775, 1.7875]),
        (13, [2.0, 1.9979, 1.8665, 1.8555, 1.73, 1.7136], [2.0014, 2.0063, 1.875, 1.886, 1.775, 1.7875]),
        (14, [2.0, 1.9986, 1.8693, 1.8615, 1.73, 1.7183], [2.0014, 2.0042, 1.875, 1.8828, 1.775, 1.7875]),
    ];

    #[test] fn acme_vs_published() {
        let (d, p) = (2.0, 0.25);
        for (cl, ext, int) in ACME_2_4 {
            for (i, w) in [0u32, 1, 2, 3, 4, 5].iter().enumerate() { close(acme_limit(d, p, cl, false, *w), ext[i], 1e-9); }
            for (i, w) in [1u32, 0, 3, 2, 5, 4].iter().enumerate() { close(acme_limit(d, p, cl, true, *w), int[i], 1e-9); }
        }
    }

    #[test] fn acme_basic_vs_published() {
        // Torqbolt, ASME B1.5 basic dimensions table (accessed 2026-11-11):
        // size, TPI, pitch dia, minor dia, flat F, lead angle (deg, min)
        for (d, tpi, e, k, f, la) in [(0.25, 16.0, 0.2188, 0.1875, 0.0232, (5.0, 12.0)), (0.5, 10.0, 0.45, 0.4, 0.0371, (4.0, 3.0)),
                                      (1.0, 5.0, 0.9, 0.8, 0.0741, (4.0, 3.0)), (2.0, 4.0, 1.875, 1.75, 0.0927, (2.0, 26.0)),
                                      (2.25, 3.0, 2.0833, 1.9167, 0.1236, (2.0, 55.0)), (5.0, 2.0, 4.75, 4.5, 0.1853, (1.0, 55.0))] {
            let p = 1.0 / tpi;
            close(round4(acme_pitch_dia(d, p)), e, 1e-9);
            close(round4(acme_minor_dia(d, p)), k, 1e-9);
            close(acme_flat(p), f, 5.1e-5); // 0.18535 is printed 0.1853
            let a = lead_angle_deg(p, acme_pitch_dia(d, p));
            close((a * 60.0).round(), la.0 * 60.0 + la.1, 1e-9);
        }
        // Stub ACME (Torqbolt, ASME B1.8 basic table): pitch dia, minor, 0.4224 P
        for (d, tpi, e, k, f) in [(0.25, 16.0, 0.2312, 0.2125, 0.0264), (1.0, 5.0, 0.94, 0.88, 0.0845), (2.0, 4.0, 1.925, 1.85, 0.1056), (5.0, 2.0, 4.85, 4.7, 0.2112)] {
            let p = 1.0 / tpi;
            close(d - stub_acme_height(p), e, 5.1e-5); // 0.23125 is printed 0.2312
            close(round4(d - 2.0 * stub_acme_height(p)), k, 1e-9);
            close(round4(stub_acme_flat(p)), f, 1e-9);
        }
    }

    #[test] fn trapezoidal_vs_published() {
        // RoyMech, ISO 2904 basic dimensions (accessed 2026-11-11): d, P, d2, D4, d3, D1
        for (d, p, d2, d4, d3, d1) in [(8.0, 1.5, 7.25, 8.3, 6.2, 6.5), (10.0, 2.0, 9.0, 10.5, 7.5, 8.0), (12.0, 3.0, 10.5, 12.5, 8.5, 9.0),
                                       (20.0, 4.0, 18.0, 20.5, 15.5, 16.0), (24.0, 5.0, 21.5, 24.5, 18.5, 19.0), (40.0, 7.0, 36.5, 41.0, 32.0, 33.0),
                                       (60.0, 9.0, 55.5, 61.0, 50.0, 51.0), (100.0, 12.0, 94.0, 101.0, 87.0, 88.0)] {
            close(trap_value(d, p, 0), d2, 1e-9); close(trap_value(d, p, 3), d4, 1e-9);
            close(trap_value(d, p, 1), d3, 1e-9); close(trap_value(d, p, 2), d1, 1e-9);
        }
        // The Engineering ToolBox (ISO 2901 table): nut crest 0.366 P and clearance ac
        for (p, crest, ac) in [(1.5, 0.55, 0.15), (2.0, 0.73, 0.25), (3.0, 1.10, 0.25), (4.0, 1.46, 0.25), (5.0, 1.83, 0.25)] {
            close((trap_value(0.0, p, 9) * 100.0).round() / 100.0, crest, 1e-9);
            close(trap_ac(p), ac, 1e-12);
        }
    }

    #[test] fn plating_vs_published() {
        // Thread Check Inc. worked example: 1/2-20 UNF 2A, 0.0002-0.0003 in per side.
        close(round4(0.4662 - coating_pd_change(0.0003, 60.0)), 0.4650, 1e-9);
        close(round4(0.4619 - coating_pd_change(0.0002, 60.0)), 0.4611, 1e-9);
    }

    #[test] fn sti_vs_published() {
        // Recoil catalogue p. 25 (UNC): size, TPI, major min, pitch min, minor min
        for (d, tpi, maj, pd, mn) in [(0.112, 40.0, 0.1445, 0.1282, 0.118), (0.138, 32.0, 0.1786, 0.1583, 0.145), (0.164, 32.0, 0.2046, 0.1843, 0.171),
                                      (0.190, 24.0, 0.2441, 0.2171, 0.199), (0.25, 20.0, 0.3150, 0.2825, 0.261), (0.375, 16.0, 0.4562, 0.4156, 0.389),
                                      (0.5, 13.0, 0.5999, 0.5499, 0.517)] {
            let p = 1.0 / tpi;
            close(sti_value(d, p, 0), maj, 5.1e-5);
            // 1/2-13 is printed .5499 (formula .54996)
            close(sti_value(d, p, 1), pd, 7e-5);
            close(sti_value(d, p, 2), mn, 6e-4);
        }
        // Kato (pp. 10, 12) minor minimum: inch to 0.0001, metric to 0.001 mm
        for (d, p, mn) in [(0.19, 1.0 / 24.0, 0.1990), (0.25, 0.05, 0.2608), (0.5, 1.0 / 13.0, 0.5166),
                           (3.0, 0.5, 3.108), (6.0, 1.0, 6.217), (12.0, 1.75, 12.379)] {
            close(sti_value(d, p, 2), mn, if d > 1.0 { 5.1e-4 } else { 6e-5 });
        }
        // M10 x 1.5: both makers print minor 10.324 and pitch 10.974 (formula 10.3248, 10.9743)
        close(sti_value(10.0, 1.5, 2), 10.324, 9e-4);
        close(sti_value(10.0, 1.5, 1), 10.974, 5e-4);
    }

    #[test] fn unj_vs_published() {
        // Torqbolt UNJC 3A/3B table, printed in mm to 0.01 (accessed 2026-11-11):
        // size, TPI, ext minor max, ext minor min, root r min, r max, int minor min
        for (d, tpi, mx, mn, r0, r1, im) in [(0.19, 24.0, 3.60, 3.47, 0.16, 0.19, 3.79), (0.25, 20.0, 4.88, 4.73, 0.19, 0.23, 5.11),
                                             (0.375, 16.0, 7.69, 7.51, 0.24, 0.29, 7.98), (0.5, 13.0, 10.44, 10.23, 0.29, 0.35, 10.80)] {
            let p = 1.0 / tpi;
            let mm = |w: u32| round4(unj_value(d, p, 3, w)) * 25.4; // inch limits to 0.0001, then mm
            for (w, v) in [(2, mx), (3, mn), (0, r0), (1, r1), (4, im)] { close(mm(w), v, 0.0051); }
        }
    }

    #[test] fn buttress_constants_vs_published() {
        // AMESweb buttress chart (ANSI B1.9-1973 form): constants x P
        for (w, v) in [(0u32, 0.89064), (1, 0.6), (2, 0.07141), (3, 0.0826), (4, 0.14532), (5, 0.16316), (6, 0.66271)] {
            close(buttress_value(0.0, 1.0, w), v, 6e-5);
        }
        close(buttress_value(0.0, 1.0, 7), 0.12542, 2e-5);
        close(buttress_value(0.0, 1.0, 9), -1.32542, 2e-5);
    }

    #[test] fn unm_vs_published() {
        // Thread Check (ASME B1.10M-2004) and AMESweb: size, P, d2, ext minor, int minor, int major (Thread Check only)
        for (d, p, d2, ext, int, maj) in [(0.30, 0.080, 0.248, 0.208, 0.223, 0.306), (0.50, 0.125, 0.419, 0.357, 0.380, 0.509),
                                          (0.80, 0.200, 0.670, 0.571, 0.608, 0.814), (1.00, 0.250, 0.838, 0.714, 0.760, 1.018),
                                          (1.40, 0.300, 1.205, 1.056, 1.112, 1.422)] {
            close(unm_value(d, p, 0), d2, 5.1e-4);
            close(unm_value(d, p, 1), ext, 5.1e-4);
            close(unm_value(d, p, 2), int, 5.1e-4);
            close(unm_value(d, p, 3), maj, 5.1e-4);
        }
    }

    #[test] fn coating_60() {
        close(coating_pd_change(0.0005, 60.0), 0.002, 1e-12);
    }

    #[test] fn wire_constants() {
        close(best_wire(1.0, 60.0), 0.577350, 1e-6);
        close(best_wire(1.0, 29.0), 0.516450, 1e-6);
        // 60 deg reduces to M = E + 3w - 0.866025 P
        close(wire_measurement(0.0, 1.0, 0.0, 60.0), 3.0, 1e-12);
        close(wire_measurement(0.0, 0.0, 1.0, 60.0), -0.866025, 1e-6);
        close(pitch_dia_from_wires(wire_measurement(0.9, 0.1033, 0.2, 29.0), 0.1033, 0.2, 29.0), 0.9, 1e-12);
    }
}
