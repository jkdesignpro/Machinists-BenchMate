//! Cycle formulas: thread-turning infeed tables, thread-milling path radius
//! and feed, constant surface speed (CSS) spindle speed and plunge time,
//! tapping feed. Program text is built from these in `gcode.rs`.
//!
//! Lengths are in one unit throughout (mm or inch); `metric` picks the
//! speed formula (Vc in m/min with mm, or SFM with inch). Sources and worked
//! examples are listed in docs/cycles.md.

use std::f64::consts::PI;

// ---------------------------------------------------------------------------
// Thread turning infeed

/// Cumulative radial depths for constant-volume infeed driven by the first
/// cut: depth after pass n = first x sqrt(n), the rule the Fanuc-style and
/// Haas G76 cycles use (Haas G76 page: "Each successive cut is determined by
/// the equation D*sqrt(N)"). Each increment is at least `min_cut` (as the
/// control's minimum-cut value does). Stops at `total - finish`; the last
/// pass goes to `total` (finish allowance). Returns cumulative depths, last
/// = total. Empty on bad input.
pub fn infeed_by_first_cut(total: f64, first: f64, min_cut: f64, finish: f64) -> Vec<f64> {
    if !(total > 0.0 && first > 0.0) || !(finish >= 0.0) || finish >= total || !(min_cut >= 0.0) { return vec![]; }
    let rough_to = total - finish;
    let mut v = Vec::new();
    let mut prev = 0.0;
    let mut n = 1.0f64;
    while prev < rough_to - 1e-12 && v.len() < 500 {
        let mut d = first * n.sqrt();
        if d - prev < min_cut { d = prev + min_cut; }
        if d > rough_to { d = rough_to; }
        v.push(d); prev = d; n += 1.0;
    }
    if finish > 0.0 { v.push(total); }
    v
}

/// Cumulative radial depths for constant-volume (constant chip area) infeed
/// over `passes` roughing passes, with the first pass reduced by
/// `first_factor` (0.3 in the cutting-tool makers' formula): depth after pass
/// i = rough x sqrt(c_i / (passes - 1)), c_1 = first_factor, c_i = i - 1 for
/// i >= 2. Worked example: ISCAR threading catalogue (ap 0.78 mm, 6 passes
/// -> 0.19, 0.35, 0.49, 0.60, 0.70, 0.78). `finish` > 0 adds a final pass.
pub fn infeed_by_passes(total: f64, passes: u32, first_factor: f64, finish: f64) -> Vec<f64> {
    if !(total > 0.0) || passes == 0 || !(finish >= 0.0) || finish >= total { return vec![]; }
    let rough = total - finish;
    let mut v = Vec::new();
    if passes == 1 { v.push(rough); } else {
        let k = (passes - 1) as f64;
        for i in 1..=passes {
            let c = if i == 1 { first_factor.clamp(0.0, 1.0) } else { (i - 1) as f64 };
            v.push(rough * (c / k).sqrt());
        }
    }
    if finish > 0.0 { v.push(total); }
    v
}

/// Cumulative depths for constant-depth infeed: equal radial steps of `step`
/// (the last roughing step may be smaller; a remainder under a quarter of
/// a step is merged into the step before), then the finish allowance.
pub fn infeed_constant_depth(total: f64, step: f64, finish: f64) -> Vec<f64> {
    if !(total > 0.0 && step > 0.0) || !(finish >= 0.0) || finish >= total { return vec![]; }
    let rough = total - finish;
    let n = (rough / step - 1e-9).ceil().max(1.0) as usize;
    let mut v: Vec<f64> = (1..=n).map(|i| (i as f64 * step).min(rough)).collect();
    // A last step under a quarter of the step is merged into the one before.
    if v.len() >= 2 && rough - v[v.len() - 2] < 0.25 * step { v.pop(); }
    if let Some(l) = v.last_mut() { *l = rough; }
    if finish > 0.0 { v.push(total); }
    v
}

/// Cumulative depths from a list of per-pass depths (custom table). Returns
/// empty if any value is not positive.
pub fn infeed_custom(steps: &[f64]) -> Vec<f64> {
    if steps.is_empty() || steps.iter().any(|s| !(*s > 0.0)) { return vec![]; }
    let mut acc = 0.0;
    steps.iter().map(|s| { acc += s; acc }).collect()
}

/// Thread depth (radial) of an ISO metric / Unified external thread from the
/// major diameter to the d3 root used for single-point turning, 0.613435 P
/// (ISO 965-1: d3 = d - 1.226869 P).
pub fn thread_depth_external(p: f64) -> f64 { 0.613435 * p }
/// Basic internal thread depth (5/8 H = 0.541266 P, ISO 68-1), from the
/// minor diameter D1 to the major diameter D.
pub fn thread_depth_internal(p: f64) -> f64 { 0.541266 * p }

// ---------------------------------------------------------------------------
// Thread milling

/// Tool-centre path radius for thread milling. `cut_dia` is the diameter the
/// cutter reaches: the major diameter for an internal thread, the root
/// (minor) diameter for an external one. Internal: (D - d) / 2; external:
/// (D + d) / 2.
pub fn thread_mill_path_radius(cut_dia: f64, tool_dia: f64, internal: bool) -> f64 {
    if internal { (cut_dia - tool_dia) / 2.0 } else { (cut_dia + tool_dia) / 2.0 }
}

/// Tool-centre feed for a wanted feed at the cutting edge: internal F x (D -
/// d) / D, external F x (D + d) / D (Harvey Performance and Travers worked
/// examples; same relation as arc feed correction).
pub fn thread_mill_centre_feed(edge_feed: f64, cut_dia: f64, tool_dia: f64, internal: bool) -> f64 {
    if !(cut_dia > 0.0) { return f64::NAN; }
    if internal { edge_feed * (cut_dia - tool_dia) / cut_dia } else { edge_feed * (cut_dia + tool_dia) / cut_dia }
}

/// Feed along the helix (3D) for a feed `f_plane` measured in the plane of
/// the arc: the helix rises `pitch` per turn of radius `r`, so the 3D path is
/// longer by sqrt(1 + (pitch / 2 pi r)^2). Use it when a control applies F
/// along the full helical path rather than the arc in the plane.
pub fn helix_path_feed(f_plane: f64, r: f64, pitch: f64) -> f64 {
    if !(r > 0.0) { return f64::NAN; }
    f_plane * (1.0 + (pitch / (2.0 * PI * r)).powi(2)).sqrt()
}

/// Helix lead angle in degrees for a path of radius `r` and `pitch` per turn.
pub fn helix_lead_angle_deg(r: f64, pitch: f64) -> f64 { (pitch / (2.0 * PI * r)).atan() * 180.0 / PI }

// ---------------------------------------------------------------------------
// Spindle speed and constant surface speed

/// Spindle speed for a surface speed at a diameter: metric n = 1000 Vc /
/// (pi D) (Vc m/min, D mm); inch n = 12 V / (pi D) (V SFM, D in).
pub fn css_rpm_raw(v: f64, dia: f64, metric: bool) -> f64 {
    let d = dia.abs();
    if !(d > 0.0) { return f64::INFINITY; }
    if metric { 1000.0 * v / (PI * d) } else { 12.0 * v / (PI * d) }
}

/// Spindle speed under constant surface speed with a maximum speed clamp
/// (G50 S on Fanuc-style lathes): min(css_rpm_raw, max).
pub fn css_rpm(v: f64, dia: f64, max_rpm: f64, metric: bool) -> f64 {
    let n = css_rpm_raw(v, dia, metric);
    if max_rpm > 0.0 { n.min(max_rpm) } else { n }
}

/// Time in minutes to feed radially from diameter `d0` to `d1` at `f_rev`
/// per revolution under constant surface speed `v`, clamped at `max_rpm`.
/// Above the clamp diameter, n = k / D with k = 1000 Vc / pi (metric) or
/// 12 V / pi (inch), and the radial travel dr per revolution is f, so
/// t = integral of dr / (f n) = pi (r0^2 - r1^2) / (f k') with r the radius;
/// below it, t = (r0 - r1) / (f n_max).
pub fn css_plunge_time_min(d0: f64, d1: f64, f_rev: f64, v: f64, max_rpm: f64, metric: bool) -> f64 {
    if !(f_rev > 0.0 && v > 0.0) { return f64::NAN; }
    let (hi, lo) = if d0 >= d1 { (d0.abs(), d1.abs()) } else { (d1.abs(), d0.abs()) };
    let k = if metric { 1000.0 * v / PI } else { 12.0 * v / PI }; // n = k / D
    let d_clamp = if max_rpm > 0.0 { k / max_rpm } else { 0.0 };
    // Part of the travel with CSS active (D >= d_clamp): n = k / D,
    // dt = (dD / 2) / (f k / D) = D dD / (2 f k).
    let mut t = 0.0;
    let css_lo = lo.max(d_clamp);
    if hi > css_lo { t += (hi * hi - css_lo * css_lo) / (4.0 * f_rev * k); }
    let clamp_hi = hi.min(d_clamp);
    if clamp_hi > lo && max_rpm > 0.0 { t += (clamp_hi - lo) / 2.0 / (f_rev * max_rpm); }
    t
}

/// Tapping feed per minute: pitch x rpm x starts (feed per rev = lead).
pub fn tap_feed(pitch: f64, rpm: f64) -> f64 { pitch * rpm }

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    #[test] fn iscar_constant_volume_example() {
        // ISCAR threading catalogue: P 1.25, ap 0.78 mm, 6 passes, first-pass factor 0.3.
        let v = infeed_by_passes(0.78, 6, 0.3, 0.0);
        let want = [0.19, 0.35, 0.49, 0.60, 0.70, 0.78];
        assert_eq!(v.len(), 6);
        for (a, b) in v.iter().zip(want) { close(*a, b, 0.006); }
    }
    #[test] fn first_cut_sqrt_rule() {
        // Haas G76: D*sqrt(N). D = 0.2, total 0.92, no minimum, finish 0.05.
        let v = infeed_by_first_cut(0.92, 0.2, 0.0, 0.05);
        close(v[0], 0.2, 1e-12); close(v[1], 0.2 * 2f64.sqrt(), 1e-12); close(v[3], 0.4, 1e-12);
        // 0.2 sqrt(n) >= 0.87 at n = 19 (0.8718): 19 roughing passes then finish.
        assert_eq!(v.len(), 20); close(v[18], 0.87, 1e-12); close(v[19], 0.92, 1e-12);
        // With a minimum cut of 0.05 the later increments are clamped.
        let w = infeed_by_first_cut(0.92, 0.2, 0.05, 0.05);
        // all but the last roughing step (clamped to the finish depth) and the finish pass
        for p in w.windows(2).take(w.len() - 3) { assert!(p[1] - p[0] >= 0.05 - 1e-12); }
        assert!(w.len() < v.len());
    }
    #[test] fn constant_depth() {
        let v = infeed_constant_depth(0.92, 0.2, 0.05);
        assert_eq!(v.len(), 6); close(v[3], 0.8, 1e-12); close(v[4], 0.87, 1e-12); close(v[5], 0.92, 1e-12);
        let m = infeed_constant_depth(0.92, 0.2, 0.0); // 0.2 .. 0.8, remainder 0.12 kept
        assert_eq!(m.len(), 5);
        let r = infeed_constant_depth(0.84, 0.2, 0.0); // remainder 0.04 < 0.05 merged: last step 0.24
        assert_eq!(r.len(), 4); close(r[2], 0.6, 1e-12); close(r[3], 0.84, 1e-12);
        let c = infeed_custom(&[0.3, 0.2, 0.1]); close(c[0], 0.3, 1e-12); close(c[1], 0.5, 1e-12); close(c[2], 0.6, 1e-12);
        assert!(infeed_custom(&[0.3, -0.1]).is_empty());
    }
    #[test] fn thread_depths() {
        // M10 x 1.5: d3 = 10 - 1.226869 x 1.5 = 8.160 (ISO 965-1 table value 8.160).
        close(10.0 - 2.0 * thread_depth_external(1.5), 8.160, 0.001);
        close(thread_depth_internal(1.5), 0.812, 0.001);
    }
    #[test] fn thread_mill_feed_examples() {
        // Harvey Performance: 9/16-18 internal, 0.370 cutter, 8.3 IPM linear -> 2.8 internal, 13.8 external.
        close(thread_mill_centre_feed(8.3, 0.562, 0.370, true), 2.8, 0.05);
        close(thread_mill_centre_feed(8.3, 0.562, 0.370, false), 13.8, 0.05);
        // Travers: 3/8-16, 0.285 cutter, 24 IPM -> 5.76 IPM.
        close(thread_mill_centre_feed(24.0, 0.375, 0.285, true), 5.76, 1e-9);
        close(thread_mill_path_radius(12.0, 8.0, true), 2.0, 1e-12);
        close(thread_mill_path_radius(8.16, 8.0, false), 8.08, 1e-12);
    }
    #[test] fn helix_feed() {
        // r = 1/(2 pi) so one turn of the plane circle is 1 long; pitch 1 -> 3D path sqrt(2) longer, 45 deg.
        let r = 1.0 / (2.0 * PI);
        close(helix_path_feed(100.0, r, 1.0), 100.0 * 2f64.sqrt(), 1e-9);
        close(helix_lead_angle_deg(r, 1.0), 45.0, 1e-9);
    }
    #[test] fn css() {
        // Vc 200 m/min at 50 mm: 1000 x 200 / (pi x 50) = 1273.24 rpm.
        close(css_rpm(200.0, 50.0, 0.0, true), 1273.24, 0.01);
        close(css_rpm(200.0, 10.0, 3000.0, true), 3000.0, 1e-9);
        // 500 SFM at 2 in: 12 x 500 / (pi x 2) = 954.93 rpm.
        close(css_rpm(500.0, 2.0, 0.0, false), 954.93, 0.01);
    }
    #[test] fn css_plunge_time() {
        // Hand example: cut-off 50 mm to 0, f 0.1 mm/rev, Vc 150 m/min, max 2500 rpm.
        // k = 150000/pi = 47746.48; clamp diameter = k / 2500 = 19.0986 mm.
        // CSS part: (50^2 - 19.0986^2) / (4 x 0.1 x 47746.48) = 2135.244 / 19098.59 = 0.111801 min.
        // Clamped part: (19.0986 / 2) / (0.1 x 2500) = 0.038197 min. Total 0.149998 min.
        close(css_plunge_time_min(50.0, 0.0, 0.1, 150.0, 2500.0, true), 0.149998, 2e-6);
        // Check against direct numerical integration of dr / (f n(r)).
        let (f, v, nmax) = (0.1, 150.0, 2500.0);
        let steps = 200000; let mut t = 0.0;
        for i in 0..steps { let d = 50.0 - 50.0 * (i as f64 + 0.5) / steps as f64; t += (25.0 / steps as f64) / (f * css_rpm(v, d, nmax, true)); }
        close(css_plunge_time_min(50.0, 0.0, f, v, nmax, true), t, 1e-6);
        // Without CSS reaching the clamp: plain fixed-rpm check (clamp below range).
        close(css_plunge_time_min(40.0, 30.0, 0.1, 150.0, 100000.0, true), (1600.0 - 900.0) / (0.4 * 150000.0 / PI), 1e-12);
    }
    #[test] fn tapping() { close(tap_feed(1.75, 500.0), 875.0, 1e-12); close(tap_feed(1.0 / 13.0, 500.0), 38.4615, 1e-4); }
}

// Flat (f64-only) forms for the WebAssembly wrapper: booleans as 1/0.
pub fn css_rpm_f(v: f64, dia: f64, max_rpm: f64, metric: f64) -> f64 { css_rpm(v, dia, max_rpm, metric != 0.0) }
pub fn css_plunge_time_min_f(d0: f64, d1: f64, f_rev: f64, v: f64, max_rpm: f64, metric: f64) -> f64 { css_plunge_time_min(d0, d1, f_rev, v, max_rpm, metric != 0.0) }
pub fn thread_mill_path_radius_f(cut_dia: f64, tool_dia: f64, internal: f64) -> f64 { thread_mill_path_radius(cut_dia, tool_dia, internal != 0.0) }
pub fn thread_mill_centre_feed_f(edge_feed: f64, cut_dia: f64, tool_dia: f64, internal: f64) -> f64 { thread_mill_centre_feed(edge_feed, cut_dia, tool_dia, internal != 0.0) }
