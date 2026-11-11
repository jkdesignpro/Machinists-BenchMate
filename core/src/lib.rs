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
//! * [GERE] J. M. Gere, B. J. Goodno, Mechanics of Materials, Cengage (cantilever
//!   deflection, nonprismatic beams, Castigliano's theorem)
//! * [ROARK] W. C. Young, R. G. Budynas, A. M. Sadegh, Roark's Formulas for Stress
//!   and Strain, McGraw-Hill, 8th ed. (Ch. 8 straight beams, Table 8.1)
//! * [ALT] Y. Altintas, Manufacturing Automation, Cambridge Univ. Press, 2nd ed.
//!   2012, Ch. 2 (milling chip thickness h = c sin(phi))
//! * [KV] L. Kops, D. T. Vo, "Determination of the equivalent diameter of an end
//!   mill based on its compliance", CIRP Annals 39(1), 1990 (pages to be verified)
//! * GD&T formulas (module `gdt`): sources listed in docs/gdt.md
//!   See docs/sources.md for full references.

use std::f64::consts::PI;

pub mod gdt;
pub use gdt::*;

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

/// Share of a limit that a value uses: `x / limit` (1 = at the limit). NaN
/// when there is no limit to compare with.
pub fn share_of(x: f64, limit: f64) -> f64 {
    if !(x.is_finite() && limit.is_finite() && limit > 0.0) { return f64::NAN; }
    x / limit
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

// ---------------------------------------------------------------------------
// Tool deflection (end mill as a cantilever) and cut check / optimiser
// ---------------------------------------------------------------------------

/// Second moment of area of a solid round section about a diameter:
/// `I = pi d^4 / 64` (d in mm gives mm^4). [GERE][ROARK]
pub fn second_moment_round(d: f64) -> f64 {
    PI * d.powi(4) / 64.0
}

/// Tip deflection of a uniform cantilever with a point load at the free end:
/// `delta = F L^3 / (3 E I)`. Consistent units (N, mm, N/mm^2, mm^4 -> mm).
/// [GERE] (deflections of cantilever beams) [ROARK] (Table 8.1, case 1a)
pub fn cantilever_tip_deflection(f: f64, l: f64, e: f64, i: f64) -> f64 {
    f * l.powi(3) / (3.0 * e * i)
}

/// Tip deflection of a two-section (stepped) cantilever with a point load at
/// the free end. The root section (next to the holder, length `L - a`) has
/// second moment `i_root`; the tip section (length `a`, the fluted part of an
/// end mill) has `i_tip`. From the unit-load method / Castigliano's theorem
/// with M(x) = F (L - x), x measured from the holder face:
/// `delta = (F / 3E) * [ (L^3 - a^3) / I_root + a^3 / I_tip ]`.
/// Reduces to `F L^3 / (3 E I)` when `I_root = I_tip`. `a` is clamped to 0..L.
/// [GERE] (nonprismatic beams; Castigliano's theorem) [ROARK] (Ch. 8, unit-load method)
pub fn stepped_cantilever_tip_deflection(f: f64, l: f64, a: f64, e: f64, i_root: f64, i_tip: f64) -> f64 {
    let a = a.clamp(0.0, l);
    f / (3.0 * e) * ((l.powi(3) - a.powi(3)) / i_root + a.powi(3) / i_tip)
}

/// Sideways movement of the holder face under a side force, mm: the holder, its taper and
/// the spindle bearings taken together as one spring of stiffness `k_n_um` (N/um) measured at
/// the holder face, `delta = F / k` (Hooke's law; springs in series add their deflections, so
/// this is added to the tool's own bending). 0 when no stiffness is given: a rigid holder.
/// Only the sideways give is covered; the tilt of the holder, which grows with stick-out, is not.
pub fn holder_deflection_mm(f_n: f64, k_n_um: f64) -> f64 {
    if k_n_um > 0.0 && k_n_um.is_finite() && f_n.is_finite() { f_n / (k_n_um * 1000.0) } else { 0.0 }
}

/// Tip movement of the tool with the holder's give added: [`tool_deflection_mm`] plus
/// [`holder_deflection_mm`] (springs in series).
pub fn tool_and_holder_deflection_mm(f_n: f64, stickout_mm: f64, flute_mm: f64, d_shank_mm: f64, d_flute_mm: f64, e_gpa: f64, k_n_um: f64) -> f64 {
    tool_deflection_mm(f_n, stickout_mm, flute_mm, d_shank_mm, d_flute_mm, e_gpa) + holder_deflection_mm(f_n, k_n_um)
}

/// Stiffness from a push test, N/um: a known force `f_n` (N) and the indicator reading
/// `defl_mm` (mm) it causes, `k = F / delta`.
pub fn stiffness_n_um(f_n: f64, defl_mm: f64) -> f64 {
    if f_n > 0.0 && defl_mm > 0.0 && f_n.is_finite() && defl_mm.is_finite() { f_n / (defl_mm * 1000.0) } else { f64::NAN }
}

/// End-mill tip deflection, mm, modelled as a stepped cantilever clamped at
/// the holder face: solid shank of diameter `d_shank_mm` from the holder to
/// the start of the flutes, then the fluted length `flute_mm` with an
/// effective (equivalent solid) diameter `d_flute_mm`. Force `f_n` (N) at the
/// tip, stick-out `stickout_mm`, Young's modulus `e_gpa` (GPa = 1000 N/mm^2).
/// Load at the tip is conservative (the real load is spread over ap).
/// Holder and spindle compliance are not included. [GERE][ROARK]; the
/// equivalent-diameter idea for the flutes is from [KV].
pub fn tool_deflection_mm(f_n: f64, stickout_mm: f64, flute_mm: f64, d_shank_mm: f64, d_flute_mm: f64, e_gpa: f64) -> f64 {
    stepped_cantilever_tip_deflection(f_n, stickout_mm, flute_mm, e_gpa * 1000.0,
        second_moment_round(d_shank_mm), second_moment_round(d_flute_mm))
}

/// Mean tangential (cutting) force, N, from net cutting power (kW) and
/// cutting speed Vc (m/min): `Ft = Pc * 60 000 / Vc` (from Pc = Ft * Vc).
/// Use net power at the cut (efficiency 1), not motor power. [SAN][MH]
pub fn tangential_force_n(pc_kw: f64, vc_m_min: f64) -> f64 {
    pc_kw * 60_000.0 / vc_m_min
}

/// Radial engagement angle (deg) of a side-milling cut, edge entering at the
/// wall: `phi = arccos(1 - 2 ae / D)`, ae clamped to 0..D. [ALT][SAN]
pub fn engagement_angle_deg(ae: f64, d: f64) -> f64 {
    (1.0 - 2.0 * (ae / d).clamp(0.0, 1.0)).acos().to_degrees()
}

/// Maximum chip thickness for a straight-edged (kappa 90 deg) end mill,
/// from h(phi) = fz sin(phi): `hex = fz sin(phi_e)` for ae < D/2, `fz` for
/// ae >= D/2. Exact geometry (circular tooth path approximation). [ALT][SAN]
pub fn chip_thickness_max(fz: f64, ae: f64, d: f64) -> f64 {
    if ae >= d / 2.0 { fz } else { fz * engagement_angle_deg(ae, d).to_radians().sin() }
}

/// Mean (arc-averaged) chip thickness, exact for h = fz sin(phi):
/// `hm = fz (1 - cos phi_e) / phi_e = fz (2 ae / D) / phi_e`, phi_e in radians.
/// For small ae/D this tends to the common approximation `fz sqrt(ae/D)`. [ALT][SAN]
pub fn chip_thickness_mean(fz: f64, ae: f64, d: f64) -> f64 {
    let phi = engagement_angle_deg(ae, d).to_radians();
    if phi <= 0.0 { return 0.0; }
    fz * (1.0 - phi.cos()) / phi
}

/// Inputs to the milling cut check. All metric: mm, m/min, N/mm^2, GPa, kW, N*m, N.
/// A value <= 0 (or NaN) for an optional input means "not given".
#[derive(Clone, Copy, Debug, Default)]
pub struct CutInput {
    pub d: f64,            // cutting diameter
    pub d_shank: f64,      // shank diameter (<= 0: same as d)
    pub stickout: f64,     // holder face to tool tip
    pub flute_len: f64,    // fluted length (<= 0: whole stick-out at shank diameter)
    pub flute_factor: f64, // effective flute diameter / d
    pub e_gpa: f64,
    pub z: f64,
    pub ae: f64,
    pub ap: f64,
    pub fz: f64,
    pub vc: f64,
    pub kc: f64,
    pub eta: f64,
    pub radial_ratio: f64, // Fr / Ft (optional)
    pub f_direct: f64,     // radial force entered directly, N (optional, wins over ratio)
    pub defl_limit: f64,   // mm (optional)
    pub p_max: f64,        // machine continuous power, kW (optional)
    pub t_max: f64,        // machine max torque, N*m (optional)
    pub holder_k: f64,     // holder and spindle stiffness at the holder face, N/um (optional: not given = rigid)
}

/// Results of [`cut_check`]. NaN where an input needed for it was not given.
#[derive(Clone, Copy, Debug, Default)]
pub struct CutResult {
    pub rpm: f64,
    pub vf: f64,        // mm/min
    pub q: f64,         // cm^3/min
    pub p_net: f64,     // kW at the cut
    pub p_spindle: f64, // kW at the motor (p_net / eta)
    pub torque: f64,    // N*m at the spindle for p_spindle
    pub ft: f64,        // mean tangential force, N
    pub fr: f64,        // radial force used for deflection, N
    pub defl: f64,      // mm
    pub p_avail: f64,   // kW available at this RPM (power/torque curve)
    /// Fraction of each limit used by the current cut, by limit code (index 0 unused).
    pub used: [f64; 6],
    pub binding: u8,    // limit code that binds first (highest use), 0 if none
}

/// Limit codes: 1 deflection, 2 spindle power, 3 spindle torque (below base
/// speed), 4 flute length (ap only), 5 tool diameter (ae only).
pub const LIMIT_DEFLECTION: u8 = 1;
pub const LIMIT_POWER: u8 = 2;
pub const LIMIT_TORQUE: u8 = 3;
pub const LIMIT_FLUTE: u8 = 4;
pub const LIMIT_DIAMETER: u8 = 5;
/// Returned by [`cut_optimise`] only: ap capped at the stick-out because no flute length was given.
pub const LIMIT_STICKOUT: u8 = 6;

fn given(x: f64) -> bool { x > 0.0 && x.is_finite() }

/// Milling cut check. Chains the cited formulas above:
/// n = 1000 Vc / (pi D); Vf = n fz z; Q = ae ap Vf / 1000 (cm^3/min);
/// Pc = Q kc / 60 000 (net), P_spindle = Pc / eta; T = P_spindle 60 000 / (2 pi n);
/// Ft = Pc 60 000 / Vc; Fr = ratio x Ft (or the force entered directly);
/// deflection from [`tool_deflection_mm`]. Power available from
/// [`spindle_power_available_kw`]. kc and the radial/tangential ratio are user
/// inputs; BenchMate does not guess them. [SAN][MH][GERE]
pub fn cut_check(c: &CutInput) -> CutResult {
    let nan = f64::NAN;
    let mut r = CutResult { ft: nan, fr: nan, defl: nan, p_avail: nan, p_net: nan, p_spindle: nan, torque: nan, ..Default::default() };
    r.used = [nan; 6];
    r.rpm = rpm_from_vc(c.vc, c.d);
    r.vf = r.rpm * c.fz * c.z;
    r.q = mrr_milling(c.ae, c.ap, r.vf) / 1000.0;
    if given(c.kc) {
        r.p_net = power_kw(r.q, c.kc, 1.0);
        r.ft = tangential_force_n(r.p_net, c.vc);
        if given(c.eta) {
            r.p_spindle = power_kw(r.q, c.kc, c.eta);
            r.torque = torque_for_power_nm(r.p_spindle, r.rpm);
        }
    }
    r.fr = if given(c.f_direct) { c.f_direct } else if given(c.radial_ratio) { c.radial_ratio * r.ft } else { nan };
    if given(c.e_gpa) && given(c.stickout) && r.fr.is_finite() {
        let ds = if given(c.d_shank) { c.d_shank } else { c.d };
        // No flute length: uniform cantilever at shank diameter. Flute length
        // without an effective-diameter factor: no result (we do not guess it).
        let geom = if !given(c.flute_len) { Some((0.0, ds)) }
                   else if given(c.flute_factor) { Some((c.flute_len, c.flute_factor * c.d)) }
                   else { None };
        if let Some((lf, df)) = geom {
            r.defl = tool_deflection_mm(r.fr, c.stickout, lf, ds, df, c.e_gpa) + holder_deflection_mm(r.fr, c.holder_k);
        }
    }
    if r.defl.is_finite() && given(c.defl_limit) { r.used[LIMIT_DEFLECTION as usize] = r.defl / c.defl_limit; }
    if given(c.p_max) {
        r.p_avail = spindle_power_available_kw(r.rpm, c.p_max, if given(c.t_max) { c.t_max } else { 0.0 });
        if r.p_spindle.is_finite() {
            let torque_limited = given(c.t_max) && r.p_avail < c.p_max;
            let k = if torque_limited { LIMIT_TORQUE } else { LIMIT_POWER };
            r.used[k as usize] = r.p_spindle / r.p_avail;
        }
    }
    r.binding = binding(&r.used, &[LIMIT_DEFLECTION, LIMIT_POWER, LIMIT_TORQUE]);
    r
}

fn binding(used: &[f64; 6], codes: &[u8]) -> u8 {
    let mut best = 0u8; let mut u = f64::NEG_INFINITY;
    for &k in codes { let v = used[k as usize]; if v.is_finite() && v > u { u = v; best = k; } }
    best
}

/// Largest value of x for a quantity y that is proportional to x, keeping
/// y at or under `y_limit`: `x_max = x * y_limit / y`. Used by the optimiser,
/// where (with constant kc) MRR, power, torque, cutting force and therefore
/// deflection are all proportional to ap at fixed ae, and to ae at fixed ap
/// (Q = ae ap Vf; Pc = Q kc / 60 000; Ft = Pc 60 000 / Vc; delta proportional to F).
pub fn proportional_limit(x: f64, y: f64, y_limit: f64) -> f64 {
    x * y_limit / y
}

/// Cut optimiser. `vary_ae = false`: largest ap for the given ae;
/// `true`: largest ae for the given ap. Each active limit gives
/// x_max = x / (fraction of that limit used) ([`proportional_limit`]); the
/// smallest wins. Geometric caps: ap <= flute length (or, when no flute
/// length is given, ap <= stick-out: a cutter cannot cut deeper than it
/// sticks out of the holder), ae <= D.
/// Returns (x_max, limit code). NaN and 0 if no limit is active.
/// Assumes kc constant (in reality kc rises a little as chip thickness falls).
pub fn cut_optimise(c: &CutInput, vary_ae: bool) -> (f64, u8) {
    let r = cut_check(c);
    let x = if vary_ae { c.ae } else { c.ap };
    let mut used = r.used;
    if vary_ae { used[LIMIT_DIAMETER as usize] = c.ae / c.d; }
    else if given(c.flute_len) { used[LIMIT_FLUTE as usize] = c.ap / c.flute_len; }
    let by_stickout = !vary_ae && !given(c.flute_len) && given(c.stickout);
    if by_stickout { used[LIMIT_FLUTE as usize] = c.ap / c.stickout; }
    let k = binding(&used, &[LIMIT_DEFLECTION, LIMIT_POWER, LIMIT_TORQUE, LIMIT_FLUTE, LIMIT_DIAMETER]);
    if k == 0 { return (f64::NAN, 0); }
    (proportional_limit(x, used[k as usize], 1.0), if by_stickout && k == LIMIT_FLUTE { LIMIT_STICKOUT } else { k })
}

/// f64 wrapper for the WebAssembly layer: `out` selects the result.
/// 0 rpm, 1 vf, 2 q, 3 p_net, 4 p_spindle, 5 torque, 6 ft, 7 fr, 8 defl,
/// 9 p_avail, 10 binding code, 11..15 fraction used of limit 1..5.
#[allow(clippy::too_many_arguments)]
pub fn cut_check_f(d: f64, d_shank: f64, stickout: f64, flute_len: f64, flute_factor: f64, e_gpa: f64, z: f64,
                   ae: f64, ap: f64, fz: f64, vc: f64, kc: f64, eta: f64, radial_ratio: f64, f_direct: f64,
                   defl_limit: f64, p_max: f64, t_max: f64, holder_k: f64, out: f64) -> f64 {
    let c = CutInput { d, d_shank, stickout, flute_len, flute_factor, e_gpa, z, ae, ap, fz, vc, kc, eta, radial_ratio, f_direct, defl_limit, p_max, t_max, holder_k };
    let r = cut_check(&c);
    match out as i32 {
        0 => r.rpm, 1 => r.vf, 2 => r.q, 3 => r.p_net, 4 => r.p_spindle, 5 => r.torque,
        6 => r.ft, 7 => r.fr, 8 => r.defl, 9 => r.p_avail, 10 => r.binding as f64,
        k @ 11..=15 => r.used[(k - 10) as usize],
        _ => f64::NAN,
    }
}

/// f64 wrapper for the WebAssembly layer: `vary_ae` 0 = max ap, 1 = max ae;
/// `out` 0 = value, 1 = limit code.
#[allow(clippy::too_many_arguments)]
pub fn cut_optimise_f(d: f64, d_shank: f64, stickout: f64, flute_len: f64, flute_factor: f64, e_gpa: f64, z: f64,
                      ae: f64, ap: f64, fz: f64, vc: f64, kc: f64, eta: f64, radial_ratio: f64, f_direct: f64,
                      defl_limit: f64, p_max: f64, t_max: f64, holder_k: f64, vary_ae: f64, out: f64) -> f64 {
    let c = CutInput { d, d_shank, stickout, flute_len, flute_factor, e_gpa, z, ae, ap, fz, vc, kc, eta, radial_ratio, f_direct, defl_limit, p_max, t_max, holder_k };
    let (x, k) = cut_optimise(&c, vary_ae > 0.5);
    if out > 0.5 { k as f64 } else { x }
}

/// f64-argument helpers used by the WebAssembly layer (teeth as a number).
pub fn table_feed_f(rpm: f64, fz: f64, teeth: f64) -> f64 { table_feed(rpm, fz, teeth as u32) }
pub fn feed_per_tooth_f(vf: f64, rpm: f64, teeth: f64) -> f64 { feed_per_tooth(vf, rpm, teeth as u32) }

pub const MM_PER_IN: f64 = 25.4; // exact by definition

pub mod threads;
pub mod fits;
pub use threads::*;
pub use fits::*;
pub mod shop;
pub use shop::*;
pub mod geometry;
pub use geometry::*;
pub mod thread_forms;
pub use thread_forms::*;
pub mod cycles;
pub use cycles::*;
pub mod gcode;
pub mod gsim;
pub mod gtidy;
pub mod dxf;
pub mod cad;
pub mod tooling;
pub use tooling::*;
pub mod fasteners;
pub use fasteners::*;
pub mod millturn;
pub use millturn::*;
pub mod chatter;
pub use chatter::*;
pub mod grinding;
pub use grinding::*;
pub mod tnrc;
pub mod measure;
pub mod power_threads;
pub use power_threads::*;
pub use measure::*;
pub mod units;
pub mod expr;
pub mod gears;
pub mod mechanics;
pub mod inspect;
pub use inspect::*;
pub mod matref;
pub mod cutforce;
pub mod advisor;
pub mod lobes;
pub use cutforce::*;
pub use advisor::*;
pub use lobes::*;

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
        // share of a limit: 2.5 kW of the 2.617994 kW available at 500 RPM
        close(share_of(2.5, spindle_power_available_kw(500.0, 3.7, 50.0)), 0.954930, 1e-6);
        assert!(share_of(2.5, 0.0).is_nan() && share_of(f64::NAN, 1.0).is_nan());
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

    // Deflection (python3): I(10 mm) = pi 10^4 / 64 = 490.873852 mm^4; I(8) = 201.061930.
    // Uniform: F 100 N, L 40, E 600 GPa = 600 000 N/mm^2:
    //   100 * 40^3 / (3 * 600000 * 490.873852) = 0.00724332 mm.
    // Stepped: L 40, flutes 25 at 8 mm effective, shank 10:
    //   100/(3*600000) * ((40^3 - 25^3)/490.873852 + 25^3/201.061930) = 0.00979228 mm.
    //   Checked independently by numerically integrating M m / (E I) over x in python3
    //   (200 000 strips): 0.00979228 mm.
    #[test] fn deflection() {
        close(second_moment_round(10.0), 490.873852, 1e-6);
        close(second_moment_round(8.0), 201.061930, 1e-6);
        let i = second_moment_round(10.0);
        close(cantilever_tip_deflection(100.0, 40.0, 600_000.0, i), 0.00724332, 1e-8);
        close(tool_deflection_mm(100.0, 40.0, 25.0, 10.0, 8.0, 600.0), 0.00979228, 1e-8);
        // Stepped reduces to uniform when both diameters are equal, for any flute length.
        for a in [0.0, 10.0, 25.0, 40.0] {
            close(stepped_cantilever_tip_deflection(100.0, 40.0, a, 600_000.0, i, i), cantilever_tip_deflection(100.0, 40.0, 600_000.0, i), 1e-15);
        }
        // Whole length fluted -> uniform at the flute diameter.
        close(tool_deflection_mm(100.0, 40.0, 40.0, 10.0, 8.0, 600.0), cantilever_tip_deflection(100.0, 40.0, 600_000.0, second_moment_round(8.0)), 1e-15);
        // Flute length longer than stick-out is clamped.
        close(tool_deflection_mm(100.0, 40.0, 60.0, 10.0, 8.0, 600.0), tool_deflection_mm(100.0, 40.0, 40.0, 10.0, 8.0, 600.0), 1e-15);
    }

    // Ft = 2 kW * 60000 / 150 m/min = 800 N.
    // D 10, ae 2.5: phi = acos(1 - 0.5) = 60 deg; fz 0.05: hex = 0.05 sin 60 = 0.0433013;
    // hm = 0.05 (1 - cos 60) / (pi/3) = 0.0238732 (approximation fz sqrt(ae/D) = 0.025).
    // Slot (ae = D): hm = 2 fz / pi = 0.0318310, hex = fz.
    #[test] fn force_and_chip() {
        close(tangential_force_n(2.0, 150.0), 800.0, 1e-12);
        close(engagement_angle_deg(2.5, 10.0), 60.0, 1e-9);
        close(chip_thickness_max(0.05, 2.5, 10.0), 0.0433013, 1e-7);
        close(chip_thickness_mean(0.05, 2.5, 10.0), 0.0238732, 1e-7);
        close(chip_thickness_mean(0.05, 10.0, 10.0), 0.0318310, 1e-7);
        close(chip_thickness_max(0.05, 6.0, 10.0), 0.05, 1e-15);
        // small ae/D: exact mean tends to fz sqrt(ae/D)
        close(chip_thickness_mean(0.05, 0.01, 10.0), 0.05 * (0.001f64).sqrt(), 1e-6);
    }

    // Cut check (python3): D 10, z 4, ae 2.5, ap 10, fz 0.05, Vc 150, kc 1800, eta 0.8,
    // Fr/Ft 0.4, stick-out 40, flutes 25 at factor 0.8, E 600, limit 0.02 mm, 3.7 kW, 20 N*m.
    // n = 150000/(10 pi) = 4774.648; Vf = 954.930; Q = 2.5*10*954.930/1000 = 23.873241;
    // Pc = 23.873241*1800/60000 = 0.716197 kW; spindle 0.895247 kW; T = 1.790493 N*m;
    // Ft = 286.478898 N; Fr = 114.591559 N; deflection = 0.0112211 mm.
    // Available at 4774.6 RPM = min(3.7, 20*2pi*4774.6/60000 = 10.0) = 3.7 kW.
    // Max ap: deflection 10*0.02/0.0112211 = 17.8235; power 10*3.7/0.895247 = 41.3294;
    // flute 25 -> deflection binds at 17.8235. Max ae: 2.5*0.02/0.0112211 = 4.45588 (D cap 10).
    fn sample() -> CutInput {
        CutInput { d: 10.0, d_shank: 0.0, stickout: 40.0, flute_len: 25.0, flute_factor: 0.8, e_gpa: 600.0, z: 4.0,
                   ae: 2.5, ap: 10.0, fz: 0.05, vc: 150.0, kc: 1800.0, eta: 0.8, radial_ratio: 0.4, f_direct: 0.0,
                   defl_limit: 0.02, p_max: 3.7, t_max: 20.0, holder_k: 0.0 }
    }
    #[test] fn cut_check_example() {
        let r = cut_check(&sample());
        close(r.rpm, 4774.648293, 1e-5);
        close(r.vf, 954.929659, 1e-5);
        close(r.q, 23.873241, 1e-6);
        close(r.p_net, 0.716197, 1e-6);
        close(r.p_spindle, 0.895247, 1e-6);
        close(r.torque, 1.790493, 1e-6);
        close(r.ft, 286.478898, 1e-5);
        close(r.fr, 114.591559, 1e-5);
        close(r.defl, 0.0112211, 1e-7);
        close(r.p_avail, 3.7, 1e-12);
        assert_eq!(r.binding, LIMIT_DEFLECTION);
        let (ap, k) = cut_optimise(&sample(), false);
        close(ap, 17.823515, 1e-5); assert_eq!(k, LIMIT_DEFLECTION);
        let (ae, k) = cut_optimise(&sample(), true);
        close(ae, 4.455879, 1e-5); assert_eq!(k, LIMIT_DEFLECTION);
        // Re-running at the optimum puts deflection exactly on the limit.
        let mut c = sample(); c.ap = ap;
        close(cut_check(&c).defl, 0.02, 1e-12);
        // Without a deflection limit the flute length (25) binds before power (41.3).
        let mut c = sample(); c.defl_limit = 0.0;
        let (ap, k) = cut_optimise(&c, false);
        close(ap, 25.0, 1e-9); assert_eq!(k, LIMIT_FLUTE);
        // No flute length given: the stick-out (40) caps ap before power (41.3).
        let mut c2 = sample(); c2.defl_limit = 0.0; c2.flute_len = 0.0;
        let (ap, k) = cut_optimise(&c2, false);
        close(ap, 40.0, 1e-9); assert_eq!(k, LIMIT_STICKOUT);
        // ... and for ae the tool diameter (10) binds before power (10.3323).
        let (ae, k) = cut_optimise(&c, true);
        close(ae, 10.0, 1e-9); assert_eq!(k, LIMIT_DIAMETER);
        // Direct force 100 N, no flutes given -> uniform 10 mm cantilever, 0.00724332 mm.
        let mut c = sample(); c.f_direct = 100.0; c.flute_len = 0.0;
        close(cut_check(&c).defl, 0.00724332, 1e-8);
        // Flute length given but no factor: no deflection (not guessed).
        let mut c = sample(); c.flute_factor = 0.0;
        assert!(cut_check(&c).defl.is_nan());
        // f64 wrapper
        close(cut_check_f(10.0, 0.0, 40.0, 25.0, 0.8, 600.0, 4.0, 2.5, 10.0, 0.05, 150.0, 1800.0, 0.8, 0.4, 0.0, 0.02, 3.7, 20.0, 0.0, 8.0), 0.0112211, 1e-7);
        close(cut_optimise_f(10.0, 0.0, 40.0, 25.0, 0.8, 600.0, 4.0, 2.5, 10.0, 0.05, 150.0, 1800.0, 0.8, 0.4, 0.0, 0.02, 3.7, 20.0, 0.0, 0.0, 1.0), 1.0, 0.0);
        // Holder and spindle as a spring at the holder face: 20 N/um under Fr = 114.591559 N gives 5.7296 um, added to the
        // tool's own 0.0112211 mm: 0.0169507 mm. The deflection limit of 0.02 then allows ap = 10 x 0.02 / 0.0169507 = 11.799.
        close(holder_deflection_mm(114.591559, 20.0), 0.0057295780, 1e-9);
        close(tool_and_holder_deflection_mm(100.0, 40.0, 25.0, 10.0, 8.0, 600.0, 20.0), 0.00979228 + 0.005, 1e-8);
        assert_eq!(holder_deflection_mm(100.0, 0.0), 0.0);
        close(stiffness_n_um(200.0, 0.01), 20.0, 1e-12);
        assert!(stiffness_n_um(200.0, 0.0).is_nan());
        let mut c = sample(); c.holder_k = 20.0;
        close(cut_check(&c).defl, 0.0169507, 1e-6);
        let (ap, k) = cut_optimise(&c, false);
        close(ap, 11.799, 1e-3); assert_eq!(k, LIMIT_DEFLECTION);
        close(cut_check_f(10.0, 0.0, 40.0, 25.0, 0.8, 600.0, 4.0, 2.5, 10.0, 0.05, 150.0, 1800.0, 0.8, 0.4, 0.0, 0.02, 3.7, 20.0, 20.0, 8.0), 0.0169507, 1e-6);
    }
    // Torque-limited (python3): Vc 20 -> n = 636.620; Vf = 127.324; Q = 3.183099;
    // spindle 3.183099*1800/60000/0.8 = 0.119366 kW; T_max 0.5 N*m gives
    // 0.5*2pi*636.620/60000 = 0.033333 kW available (< 3.7), so torque binds;
    // max ap = 10 * 0.033333/0.119366 = 2.792527.
    #[test] fn cut_torque_limited() {
        let mut c = sample(); c.vc = 20.0; c.t_max = 0.5; c.defl_limit = 0.0;
        let r = cut_check(&c);
        close(r.p_avail, 0.0333333, 1e-7);
        assert_eq!(r.binding, LIMIT_TORQUE);
        let (ap, k) = cut_optimise(&c, false);
        close(ap, 2.792527, 1e-6); assert_eq!(k, LIMIT_TORQUE);
    }
}
