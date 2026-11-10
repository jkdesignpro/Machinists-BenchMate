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
//! * [GIL] W. W. Gilbert, "Economics of Machining", in Machining: Theory and Practice,
//!   ASM, 1950 (minimum-cost tool life); also [MH] "Machining econometrics"
//! * [TAY] F. W. Taylor, "On the Art of Cutting Metals", Trans. ASME 28, 1907 (V T^n = C)

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

/// Spindle power available at a given speed (kW), for a spindle modelled as
/// constant torque up to its base speed and constant power above it:
/// `P(n) = min(P_max, T_max * 2 * pi * n / 60 000)` with T in N*m, n in RPM.
/// Standard motor/spindle characteristic used by machine builders and in [SAN]
/// (power and torque diagrams). If `torque_max_nm` <= 0, only `p_max_kw` applies.
pub fn spindle_power_available_kw(rpm: f64, p_max_kw: f64, torque_max_nm: f64) -> f64 {
    if torque_max_nm <= 0.0 { return p_max_kw; }
    p_max_kw.min(torque_max_nm * 2.0 * PI * rpm / 60_000.0)
}

/// Spindle torque needed for a cutting power (kW) at a speed (RPM), N*m:
/// `T = P * 60 000 / (2 * pi * n)`.
pub fn torque_for_power_nm(power_kw: f64, rpm: f64) -> f64 {
    power_kw * 60_000.0 / (2.0 * PI * rpm)
}

// ---------------------------------------------------------------------------
// Arc feed correction and helical interpolation (milling)
// ---------------------------------------------------------------------------

/// Tool-centre feed for an internal arc (pocket, bore) so the cutting edge
/// runs at the desired feed `fe`: `Fc = Fe * (R - r) / R`.
/// `R` = part arc radius (the contour the edge cuts), `r` = tool radius.
/// Valid for `R > r`. Same linear units for R and r; feed in any units.
/// [SAN] (helical/circular interpolation: Vf,centre = Vf * (Dm - Dc) / Dm)
pub fn arc_feed_internal(fe: f64, part_r: f64, tool_r: f64) -> f64 {
    fe * (part_r - tool_r) / part_r
}

/// Tool-centre feed for an external arc (boss, outside corner):
/// `Fc = Fe * (R + r) / R`. [SAN] (Vf,centre = Vf * (Dm + Dc) / Dm)
pub fn arc_feed_external(fe: f64, part_r: f64, tool_r: f64) -> f64 {
    fe * (part_r + tool_r) / part_r
}

/// Tool-centre path diameter for helical interpolation in a hole:
/// `Dpath = Dhole - Dtool`. [SAN] (circular ramping / helical interpolation)
pub fn helix_path_dia_internal(hole_dia: f64, tool_dia: f64) -> f64 {
    hole_dia - tool_dia
}

/// Tool-centre path diameter around a boss: `Dpath = Dboss + Dtool`. [SAN]
pub fn helix_path_dia_external(boss_dia: f64, tool_dia: f64) -> f64 {
    boss_dia + tool_dia
}

/// Helix pitch (axial drop per revolution of the tool path) from the ramp
/// angle measured at the tool-centre path: `pitch = pi * Dpath * tan(angle)`.
/// Unrolling one turn of the helix gives a right triangle with base pi*Dpath
/// and height = pitch. [SAN][MH] (helix geometry)
pub fn helix_pitch(path_dia: f64, ramp_deg: f64) -> f64 {
    PI * path_dia * ramp_deg.to_radians().tan()
}

/// Ramp angle (deg) at the tool-centre path from the helix pitch:
/// `angle = atan(pitch / (pi * Dpath))`. Inverse of [`helix_pitch`].
pub fn helix_ramp_deg(path_dia: f64, pitch: f64) -> f64 {
    (pitch / (PI * path_dia)).atan().to_degrees()
}

/// Axial (Z) feed rate during a helix when the programmed feed `vf_plane`
/// applies to the circular (in-plane) component, as on ISO/Fanuc-style
/// controls by default: `Vz = Vf * tan(angle)` (= Vf * pitch / (pi * Dpath)).
pub fn helix_axial_feed_plane(vf_plane: f64, ramp_deg: f64) -> f64 {
    vf_plane * ramp_deg.to_radians().tan()
}

/// Axial (Z) feed rate when the programmed feed `vf_path` applies along the
/// full 3D helix path (some controls / settings): `Vz = Vf * sin(angle)`.
pub fn helix_axial_feed_path(vf_path: f64, ramp_deg: f64) -> f64 {
    vf_path * ramp_deg.to_radians().sin()
}

// ---------------------------------------------------------------------------
// Bar stock planning (bar-fed and Swiss-type lathes)
// ---------------------------------------------------------------------------

/// Bar cross-section shape.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum BarShape { Round, Hex, Square }

/// Cross-section area. `size` = diameter (round) or across flats (hex, square).
/// Round `pi d^2 / 4`; regular hexagon across flats `s` is `(sqrt(3)/2) s^2`;
/// square `s^2`. [MH] (areas of plane figures)
pub fn bar_section_area(shape: BarShape, size: f64) -> f64 {
    match shape {
        BarShape::Round => PI * size * size / 4.0,
        BarShape::Hex => 3f64.sqrt() / 2.0 * size * size,
        BarShape::Square => size * size,
    }
}

/// Bar length consumed by one part: part length + cut-off width + facing allowance.
pub fn bar_length_per_part(part_len: f64, cutoff: f64, facing: f64) -> f64 {
    part_len + cutoff + facing
}

/// Whole parts from one bar:
/// `floor((bar - remnant - start_facing) / (part + cutoff + facing))`, never below 0.
/// The remnant is the unusable end held by the collet/bar feeder.
pub fn bar_parts_per_bar(bar_len: f64, part_len: f64, cutoff: f64, facing: f64, remnant: f64, start_facing: f64) -> f64 {
    let per = bar_length_per_part(part_len, cutoff, facing);
    let usable = bar_len - remnant - start_facing;
    if per <= 0.0 || usable <= 0.0 { return 0.0; }
    // Small epsilon so an exact fit is not lost to floating-point rounding.
    (usable / per + 1e-9).floor()
}

/// Scrap per bar (length): bar length minus what the parts consume
/// (includes remnant, start facing and the unusable leftover).
pub fn bar_scrap_len(bar_len: f64, parts: f64, per_part: f64) -> f64 {
    bar_len - parts * per_part
}

/// f64 shape code for the WebAssembly layer: 1 round, 2 hex, 3 square.
pub fn bar_section_area_f(shape: f64, size: f64) -> f64 {
    match shape as i32 {
        1 => bar_section_area(BarShape::Round, size),
        2 => bar_section_area(BarShape::Hex, size),
        3 => bar_section_area(BarShape::Square, size),
        _ => f64::NAN,
    }
}

// ---------------------------------------------------------------------------
// Tool life and machining economics
// ---------------------------------------------------------------------------

/// Taylor tool life: from `V T^n = C`, `T = (C / V)^(1/n)` (minutes).
/// `n` and `C` are user inputs (tool maker or shop data); V and C in the
/// same speed units. [TAY][MH]
pub fn taylor_life(v: f64, n: f64, c: f64) -> f64 {
    (c / v).powf(1.0 / n)
}

/// Taylor cutting speed for a target tool life: `V = C / T^n`. [TAY][MH]
pub fn taylor_speed(t_min: f64, n: f64, c: f64) -> f64 {
    c / t_min.powf(n)
}

/// Cost per part = cycle time x machine rate + tool cost per edge x
/// (cutting time / tool life) + material cost per part. [GIL][MH]
/// Times in minutes, `machine_rate_per_min` in currency per minute.
pub fn cost_per_part(cycle_min: f64, machine_rate_per_min: f64, tool_cost_per_edge: f64,
                     cut_min: f64, tool_life_min: f64, material_cost: f64) -> f64 {
    cycle_min * machine_rate_per_min + tool_cost_per_edge * cut_min / tool_life_min + material_cost
}

/// Tool life for minimum cost per part (Gilbert):
/// `T = (1/n - 1) * (Ct / Cm + tc)`, Ct tool cost per edge, Cm machine and
/// labour rate per minute, tc tool change time in minutes. [GIL][MH]
pub fn economic_tool_life(n: f64, tool_cost_per_edge: f64, machine_rate_per_min: f64, tool_change_min: f64) -> f64 {
    (1.0 / n - 1.0) * (tool_cost_per_edge / machine_rate_per_min + tool_change_min)
}

/// Tool life for maximum production rate (Gilbert): `T = (1/n - 1) * tc`. [GIL][MH]
pub fn max_production_tool_life(n: f64, tool_change_min: f64) -> f64 {
    (1.0 / n - 1.0) * tool_change_min
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
    #[test] fn spindle_power() {
        // 50 N*m at 1000 RPM = 50*2*pi*1000/60000 = 5.23599 kW, capped at 3.7 kW
        close(spindle_power_available_kw(1000.0, 3.7, 50.0), 3.7, 1e-12);
        // at 500 RPM: 2.61799 kW (torque limited)
        close(spindle_power_available_kw(500.0, 3.7, 50.0), 2.617994, 1e-6);
        close(spindle_power_available_kw(500.0, 3.7, 0.0), 3.7, 1e-12);
        close(torque_for_power_nm(2.617994, 500.0), 50.0, 1e-4);
    }
    #[test] fn bolt() {
        let h = bolt_circle(4, 100.0, 0.0, 0.0, 0.0);
        close(h[0].0, 50.0, 1e-9);
        close(h[1].1, 50.0, 1e-9);
        close(h[2].0, -50.0, 1e-9);
    }

    // Arc feed: Fe 100, part arc R 50, tool r 10.
    // Internal 100*(50-10)/50 = 80; external 100*(50+10)/50 = 120 (python3).
    #[test] fn arc_feed() {
        close(arc_feed_internal(100.0, 50.0, 10.0), 80.0, 1e-12);
        close(arc_feed_external(100.0, 50.0, 10.0), 120.0, 1e-12);
        // inch: Fe 20 ipm, R 0.75, tool 0.5 dia (r 0.25): 20*0.5/0.75 = 13.3333
        close(arc_feed_internal(20.0, 0.75, 0.25), 13.333333, 1e-6);
    }
    // Helix: 20 mm hole, 12 mm tool -> Dpath 8. 3 deg ramp:
    // pitch = pi*8*tan(3 deg) = 1.317151 mm (python3). Pitch 1.0 -> atan(1/(8 pi)) = 2.278525 deg.
    // Vf 500 in plane: Vz = 500 tan 3 = 26.20389; along path: 500 sin 3 = 26.16798.
    #[test] fn helix() {
        let d = helix_path_dia_internal(20.0, 12.0);
        close(d, 8.0, 1e-12);
        close(helix_path_dia_external(20.0, 12.0), 32.0, 1e-12);
        close(helix_pitch(d, 3.0), 1.317151, 1e-6);
        close(helix_ramp_deg(d, 1.0), 2.278525, 1e-6);
        close(helix_ramp_deg(d, helix_pitch(d, 3.0)), 3.0, 1e-12);
        close(helix_axial_feed_plane(500.0, 3.0), 26.20389, 1e-5);
        close(helix_axial_feed_path(500.0, 3.0), 26.16798, 1e-5);
    }
    // Bar: 3000 bar, 25 part, 2 cutoff, 0.5 facing, 150 remnant, 1 start facing.
    // per part 27.5; (3000-150-1)/27.5 = 103.6 -> 103 parts; scrap 3000-103*27.5 = 167.5.
    // 20 mm areas: round 314.159265, hex 346.410162, square 400 (python3).
    #[test] fn bar_stock() {
        let per = bar_length_per_part(25.0, 2.0, 0.5);
        close(per, 27.5, 1e-12);
        let n = bar_parts_per_bar(3000.0, 25.0, 2.0, 0.5, 150.0, 1.0);
        close(n, 103.0, 0.0);
        close(bar_scrap_len(3000.0, n, per), 167.5, 1e-9);
        close(bar_section_area(BarShape::Round, 20.0), 314.159265, 1e-6);
        close(bar_section_area(BarShape::Hex, 20.0), 346.410162, 1e-6);
        close(bar_section_area(BarShape::Square, 20.0), 400.0, 1e-12);
        close(bar_section_area_f(2.0, 20.0), 346.410162, 1e-6);
        assert!(bar_section_area_f(9.0, 20.0).is_nan());
        // remnant longer than bar -> 0 parts
        close(bar_parts_per_bar(100.0, 25.0, 2.0, 0.0, 150.0, 0.0), 0.0, 0.0);
        // exact fit with inexact binary fractions: 0.3 / 0.1 must give 3, not 2
        close(bar_parts_per_bar(0.3, 0.07, 0.03, 0.0, 0.0, 0.0), 3.0, 0.0);
        // inch: 144 in bar, 1.0 part, 0.093 cutoff, 0.01 facing, 6 remnant, 0.02 start
        // (144-6-0.02)/1.103 = 125.09 -> 125 parts
        close(bar_parts_per_bar(144.0, 1.0, 0.093, 0.01, 6.0, 0.02), 125.0, 0.0);
    }
    // Taylor: V 200, n 0.25, C 400 -> T = 2^4 = 16 min; T 15 -> V = 400/15^0.25 = 203.2531.
    // Economics: n 0.25, Ct 5, Cm 1/min, tc 2 -> T = 3*(5+2) = 21 min; max production 3*2 = 6.
    // Cost: cycle 3 min at 1/min, tool 5/edge, cut 2 min, life 16, material 1.5 -> 3+0.625+1.5 = 5.125.
    #[test] fn tool_life_economics() {
        close(taylor_life(200.0, 0.25, 400.0), 16.0, 1e-9);
        close(taylor_speed(15.0, 0.25, 400.0), 203.253099, 1e-6);
        close(taylor_speed(taylor_life(200.0, 0.25, 400.0), 0.25, 400.0), 200.0, 1e-9);
        close(economic_tool_life(0.25, 5.0, 1.0, 2.0), 21.0, 1e-12);
        close(max_production_tool_life(0.25, 2.0), 6.0, 1e-12);
        close(cost_per_part(3.0, 1.0, 5.0, 2.0, 16.0, 1.5), 5.125, 1e-12);
    }
}
