//! Speeds and feeds advisor (0.3.0). Starts from a published speed and chip
//! load, then applies the checks already in this crate: chip thinning, the
//! machine's speed and feed limits, specific cutting force at the real chip
//! thickness, power and torque against the spindle curve, and tool
//! deflection. Where a limit is passed it reduces one thing, in a fixed
//! order, and reports which limit it was. A value the user locked is never
//! changed. Sources: docs/sources.md, "Advisor".

use crate::{boring_bar_deflection, second_moment_tube, turning_force, tap_feed, LIMIT_DEFLECTION,
            chip_thickness_max, chip_thickness_mean, cut_check, drill_chip_thickness, drill_power_kw, drill_thrust_n, drill_torque_nm,
            kienzle_kc, lead_chip_thickness, mrr_turning_cm3_min, power_kw, rctf, rpm_from_vc, spindle_power_available_kw,
            torque_for_power_nm, vc_from_rpm, CutInput, LIMIT_POWER, LIMIT_TORQUE};

fn pos(x: f64) -> bool { x > 0.0 && x.is_finite() }

/// A value inside a published range: `lo + (hi - lo) t`, t held to 0..1.
/// The advisor uses t = 0 for the cautious end and 1 for the bold end.
pub fn range_pick(lo: f64, hi: f64, t: f64) -> f64 {
    if !(lo.is_finite() && hi.is_finite()) { return f64::NAN; }
    lo + (hi - lo) * t.clamp(0.0, 1.0)
}

/// Operation codes for [`mill_engagement`].
pub const OP_SLOT: u8 = 0;
pub const OP_ROUGH: u8 = 1;
pub const OP_HSM: u8 = 2;
pub const OP_FINISH: u8 = 3;

/// Starting radial width ae and axial depth ap for an end mill, as
/// `[ae, ap, source code for ae, source code for ap]` (mm). `boldness` 0..1.
/// * Slot: ae = D; ap from 0.2 D (ordinary edge) to 1 D (roughing edge) [MIT-DOC].
/// * Roughing on the side: ae = 0.5 D [MIT-DOC] (roughing edge; also the first
///   pass in [HEL] p. 9); ap = 1 D, BenchMate's own starting figure.
/// * High-speed or adaptive paths: ae from 7 % to 30 % of D, ap 2 D [HEL] pp. 31-32.
/// * Finishing: ae from 2 % to 5 % of D [HEL] p. 11; ap 1.5 D, own figure.
/// ap is held to the flute length when one is given.
/// Source codes: 1 Mitsubishi, 2 Helical, 3 BenchMate's own figure, 4 geometry.
pub fn mill_engagement(op: f64, d: f64, flute_len: f64, boldness: f64) -> [f64; 4] {
    if !pos(d) { return [f64::NAN; 4]; }
    let t = boldness.clamp(0.0, 1.0);
    let (ae, ap, sa, sp) = match op as i32 {
        0 => (d, range_pick(0.2, 1.0, t) * d, 4.0, 1.0),
        1 => (0.5 * d, d, 1.0, 3.0),
        2 => (range_pick(0.07, 0.30, t) * d, 2.0 * d, 2.0, 2.0),
        3 => (range_pick(0.02, 0.05, t) * d, 1.5 * d, 2.0, 3.0),
        _ => return [f64::NAN; 4],
    };
    let ap = if pos(flute_len) { ap.min(flute_len) } else { ap };
    [ae, ap, sa, sp]
}

/// Limit codes reported by the advisor (1 to 6 as in [`crate::cut_check`]).
pub const ADV_RPM: u8 = 7;   // machine's top spindle speed
pub const ADV_FEED: u8 = 8;  // machine's top feed rate

/// What the advisor reduced to get inside a limit.
pub const CUT_NOTHING: u8 = 0;
pub const CUT_AP: u8 = 1;
pub const CUT_AE: u8 = 2;
pub const CUT_FEED: u8 = 3;

/// A milling job for [`advise_mill`]. Metric: mm, m/min, N/mm^2, GPa, kW, N m.
/// A value <= 0 for an optional input means "not given".
#[derive(Clone, Copy, Debug, Default)]
pub struct MillJob {
    pub d: f64,
    pub z: f64,
    pub d_shank: f64,
    pub stickout: f64,
    pub flute_len: f64,
    pub flute_factor: f64,
    pub e_gpa: f64,
    /// Starting cutting speed from the table, after the material and coolant choices.
    pub vc: f64,
    /// Chip thickness to aim for: the table's feed per tooth for a full-width cut.
    pub chip: f64,
    pub kc11: f64,
    pub mc: f64,
    pub ae: f64,
    pub ap: f64,
    pub ae_locked: bool,
    pub ap_locked: bool,
    pub n_max: f64,
    pub vf_max: f64,
    pub p_max: f64,
    pub t_max: f64,
    pub eta: f64,
    /// Bending force as a share of the tangential force.
    pub radial_ratio: f64,
    pub defl_limit: f64,
}

/// Result of [`advise_mill`].
#[derive(Clone, Copy, Debug, Default)]
pub struct MillAdvice {
    pub rpm: f64,
    pub rpm_table: f64,
    pub vc: f64,
    pub fz: f64,
    pub vf: f64,
    pub ae: f64,
    pub ap: f64,
    pub hm: f64,
    pub hex: f64,
    pub kc: f64,
    pub q: f64,
    pub p_net: f64,
    pub p_spindle: f64,
    pub p_avail: f64,
    pub torque: f64,
    pub defl: f64,
    /// Share of each limit used by the advised cut: deflection, power or torque.
    pub use_defl: f64,
    pub use_power: f64,
    /// The limit that shaped the advice (0 none), and what was reduced for it.
    pub limit: u8,
    pub reduced: u8,
    pub rpm_capped: bool,
    pub feed_capped: bool,
    /// True when no effective flute diameter was given, so the tool is treated as a solid rod.
    pub solid_assumed: bool,
}

struct Eval { vf: f64, fz: f64, hm: f64, kc: f64, r: crate::CutResult, worst: f64, code: u8 }

fn eval(j: &MillJob, rpm: f64, vc: f64, ae: f64, ap: f64, feed_scale: f64) -> Eval {
    let fz = j.chip * rctf(ae, j.d) * feed_scale;
    let hm = chip_thickness_mean(fz, ae, j.d);
    let kc = if pos(j.kc11) { kienzle_kc(j.kc11, j.mc.max(0.0), hm) } else { f64::NAN };
    let solid = !pos(j.flute_factor);
    let c = CutInput {
        d: j.d, d_shank: j.d_shank, stickout: j.stickout,
        flute_len: if solid { 0.0 } else { j.flute_len }, flute_factor: j.flute_factor, e_gpa: j.e_gpa,
        z: j.z, ae, ap, fz, vc, kc: if kc.is_finite() { kc } else { 0.0 }, eta: j.eta,
        radial_ratio: j.radial_ratio, f_direct: 0.0, defl_limit: j.defl_limit, p_max: j.p_max, t_max: j.t_max,
    };
    let r = cut_check(&c);
    let mut worst = 0.0; let mut code = 0u8;
    for k in 1..=3usize { let u = r.used[k]; if u.is_finite() && u > worst { worst = u; code = k as u8; } }
    Eval { vf: rpm * fz * j.z, fz, hm, kc, r, worst, code }
}

/// Milling advice. Order of work:
/// 1. Spindle speed from the starting cutting speed, held to the machine's top speed.
/// 2. Feed per tooth = chip thickness x radial chip thinning factor for the width of cut.
/// 3. Table feed held to the machine's top feed (the feed per tooth is reduced).
/// 4. kc at the mean chip thickness, then power, torque and deflection.
/// 5. If a limit is passed: reduce the depth ap; if ap is locked, the width ae;
///    if both are locked, the feed. Locked values are returned unchanged.
pub fn advise_mill(j: &MillJob) -> MillAdvice {
    let nan = f64::NAN;
    let mut a = MillAdvice { rpm: nan, rpm_table: nan, vc: nan, fz: nan, vf: nan, ae: nan, ap: nan, hm: nan, hex: nan, kc: nan, q: nan,
        p_net: nan, p_spindle: nan, p_avail: nan, torque: nan, defl: nan, use_defl: nan, use_power: nan, ..Default::default() };
    if !(pos(j.d) && pos(j.z) && pos(j.vc) && pos(j.chip) && pos(j.ae) && pos(j.ap)) { return a; }
    a.solid_assumed = !pos(j.flute_factor);
    a.rpm_table = rpm_from_vc(j.vc, j.d);
    a.rpm = a.rpm_table;
    if pos(j.n_max) && a.rpm > j.n_max { a.rpm = j.n_max; a.rpm_capped = true; a.limit = ADV_RPM; }
    a.vc = vc_from_rpm(a.rpm, j.d);
    let mut ae = j.ae.min(j.d);
    let mut ap = j.ap;
    let mut scale = 1.0;
    // machine feed limit
    let e0 = eval(j, a.rpm, a.vc, ae, ap, scale);
    if pos(j.vf_max) && e0.vf > j.vf_max { scale = j.vf_max / e0.vf; a.feed_capped = true; a.limit = ADV_FEED; a.reduced = CUT_FEED; }
    let mut e = eval(j, a.rpm, a.vc, ae, ap, scale);
    if e.worst > 1.0 {
        a.limit = e.code;
        if !j.ap_locked {
            // power, torque and force are proportional to ap at a fixed width and feed
            ap /= e.worst; a.reduced = CUT_AP;
        } else if !j.ae_locked {
            // the load rises with ae: bisect for the widest cut inside the limits
            let (mut lo, mut hi) = (0.0, ae);
            for _ in 0..60 { let mid = (lo + hi) / 2.0; if eval(j, a.rpm, a.vc, mid, ap, scale).worst > 1.0 { hi = mid; } else { lo = mid; } }
            ae = lo; a.reduced = CUT_AE;
        } else {
            let (mut lo, mut hi) = (0.0, scale);
            for _ in 0..60 { let mid = (lo + hi) / 2.0; if eval(j, a.rpm, a.vc, ae, ap, mid).worst > 1.0 { hi = mid; } else { lo = mid; } }
            scale = lo; a.reduced = CUT_FEED;
        }
        e = eval(j, a.rpm, a.vc, ae, ap, scale);
    }
    a.ae = ae; a.ap = ap; a.fz = e.fz; a.vf = e.vf; a.hm = e.hm; a.kc = e.kc;
    a.hex = chip_thickness_max(e.fz, ae, j.d);
    a.q = e.r.q; a.p_net = e.r.p_net; a.p_spindle = e.r.p_spindle; a.p_avail = e.r.p_avail; a.torque = e.r.torque; a.defl = e.r.defl;
    a.use_defl = e.r.used[1];
    a.use_power = if e.r.used[2].is_finite() { e.r.used[2] } else { e.r.used[3] };
    a
}

/// f64 wrapper for the WebAssembly layer. `lock`: 0 none, 1 ap locked, 2 ae locked, 3 both.
/// `out`: 0 rpm, 1 vc, 2 fz, 3 vf, 4 ae, 5 ap, 6 hm, 7 hex, 8 kc, 9 Q (cm^3/min), 10 net power,
/// 11 spindle power, 12 torque, 13 deflection, 14 limit code, 15 what was reduced,
/// 16 rpm capped, 17 feed capped, 18 share of the deflection limit, 19 share of the power
/// (or torque) available, 20 power available, 21 solid tool assumed, 22 rpm before the cap.
#[allow(clippy::too_many_arguments)]
pub fn advise_mill_f(d: f64, z: f64, d_shank: f64, stickout: f64, flute_len: f64, flute_factor: f64, e_gpa: f64,
                     vc: f64, chip: f64, kc11: f64, mc: f64, ae: f64, ap: f64, lock: f64,
                     n_max: f64, vf_max: f64, p_max: f64, t_max: f64, eta: f64, radial_ratio: f64, defl_limit: f64, out: f64) -> f64 {
    let lk = lock as i32;
    let j = MillJob { d, z, d_shank, stickout, flute_len, flute_factor, e_gpa, vc, chip, kc11, mc, ae, ap,
        ap_locked: lk == 1 || lk == 3, ae_locked: lk == 2 || lk == 3, n_max, vf_max, p_max, t_max, eta, radial_ratio, defl_limit };
    let a = advise_mill(&j);
    let b = |x: bool| if x { 1.0 } else { 0.0 };
    match out as i32 {
        0 => a.rpm, 1 => a.vc, 2 => a.fz, 3 => a.vf, 4 => a.ae, 5 => a.ap, 6 => a.hm, 7 => a.hex, 8 => a.kc, 9 => a.q,
        10 => a.p_net, 11 => a.p_spindle, 12 => a.torque, 13 => a.defl, 14 => a.limit as f64, 15 => a.reduced as f64,
        16 => b(a.rpm_capped), 17 => b(a.feed_capped), 18 => a.use_defl, 19 => a.use_power, 20 => a.p_avail,
        21 => b(a.solid_assumed), 22 => a.rpm_table,
        _ => f64::NAN,
    }
}

/// Feed per revolution for a two-flute twist drill by diameter (inches in,
/// inches per revolution out), `[low, high]`: under 1/8 in up to 0.002;
/// 1/8 to 1/4: 0.002 to 0.004; 1/4 to 1/2: 0.004 to 0.008; 1/2 to 1: 0.008 to
/// 0.012; 1 in and over: 0.012 to 0.020 [UF-PDF]. Under 1/8 in the low figure
/// is 1 % of the diameter, the low end of the same publisher's "1 to 3 % of
/// the drill diameter" rule [UF-WEB]. Use the low figure for hard or strong
/// materials and the high one for soft materials.
pub fn drill_feed_range_in(d_in: f64) -> [f64; 2] {
    if !pos(d_in) { return [f64::NAN; 2]; }
    if d_in < 0.125 { [(0.01 * d_in).min(0.002), 0.002] }
    else if d_in < 0.25 { [0.002, 0.004] }
    else if d_in < 0.5 { [0.004, 0.008] }
    else if d_in < 1.0 { [0.008, 0.012] }
    else { [0.012, 0.020] }
}

/// Drilling or reaming advice from a starting speed and feed per revolution:
/// `[rpm, vc actual, feed per rev, penetration rate, rpm before the cap, limit code]`.
/// Metric: m/min, mm, mm/rev, mm/min. The speed is held to the machine's top
/// speed and the penetration rate to its top feed (codes [`ADV_RPM`], [`ADV_FEED`]).
pub fn advise_hole(vc: f64, d: f64, fnr: f64, n_max: f64, vf_max: f64) -> [f64; 6] {
    if !(pos(vc) && pos(d) && pos(fnr)) { return [f64::NAN; 6]; }
    let table = rpm_from_vc(vc, d);
    let mut rpm = table; let mut f = fnr; let mut limit = 0.0;
    if pos(n_max) && rpm > n_max { rpm = n_max; limit = ADV_RPM as f64; }
    if pos(vf_max) && rpm * f > vf_max { f = vf_max / rpm; limit = ADV_FEED as f64; }
    [rpm, vc_from_rpm(rpm, d), f, rpm * f, table, limit]
}

/// A table read between two printed points: the straight line through
/// `(x0, y0)` and `(x1, y1)` at `x`. Publishers print chip loads for a few
/// cutter diameters; between two printed sizes BenchMate reads along the
/// straight line (its own method, stated on the page). `x0 == x1` gives `y0`.
pub fn lerp_at(x0: f64, y0: f64, x1: f64, y1: f64, x: f64) -> f64 {
    if !(x0.is_finite() && y0.is_finite() && x1.is_finite() && y1.is_finite() && x.is_finite()) { return f64::NAN; }
    if x1 == x0 { return y0; }
    y0 + (y1 - y0) * (x - x0) / (x1 - x0)
}

/// A published correction applied to a table figure: `x k`. The factors the
/// advisor uses, each from one publisher and named on the page: 0.6 on speed
/// and feed for oil put on by hand, 2.5 on a high speed steel speed for a
/// carbide tool, 0.5 on speed and 2 on feed for a reamer against the drill of
/// the same size [UF-WEB]; 2/3 on the drilling speed for a reamer [GAM].
pub fn apply_factor(x: f64, k: f64) -> f64 {
    if !(x.is_finite() && k.is_finite() && k >= 0.0) { return f64::NAN; }
    x * k
}

/// Hole to make before reaming: reamer diameter less the stock left on the
/// diameter for the reamer to remove (the stock figures are the publishers',
/// shown on the page).
pub fn ream_predrill(d: f64, stock_on_dia: f64) -> f64 {
    if !(pos(d) && stock_on_dia >= 0.0 && stock_on_dia < d) { return f64::NAN; }
    d - stock_on_dia
}

/// Time to drill a hole (min): the drill feeds through the depth of the full
/// diameter plus its point length, `t = (depth + point) / (fn n)`.
pub fn drill_time_min(depth: f64, point_len: f64, fnr: f64, rpm: f64) -> f64 {
    if !(pos(depth) && point_len >= 0.0 && pos(fnr) && pos(rpm)) { return f64::NAN; }
    (depth + point_len) / (fnr * rpm)
}

/// Removal rate of a drill in solid material (cm^3/min): `Q = pi/4 Dc^2 vf / 1000`,
/// Dc in mm and the penetration rate vf in mm/min. [SAN]
pub fn mrr_drilling_cm3_min(d: f64, vf: f64) -> f64 {
    if !(pos(d) && pos(vf)) { return f64::NAN; }
    std::f64::consts::FRAC_PI_4 * d * d * vf / 1000.0
}

/// What the turning and drilling advice reduced.
pub const CUT_NOTHING_LEFT: u8 = 4; // every value is locked: the cut is reported as over the limit

/// A turning or boring cut for [`advise_turn`]. Metric: mm, m/min, mm/rev, N/mm^2, kW, N m.
#[derive(Clone, Copy, Debug, Default)]
pub struct TurnJob {
    /// Diameter being cut (the larger one, where the speed is highest).
    pub d: f64,
    pub vc: f64,
    pub f: f64,
    pub ap: f64,
    pub kappa_deg: f64,
    pub kc11: f64,
    pub mc: f64,
    pub f_locked: bool,
    pub ap_locked: bool,
    pub n_max: f64,
    pub p_max: f64,
    pub t_max: f64,
    pub eta: f64,
}

/// Result of [`advise_turn`].
#[derive(Clone, Copy, Debug, Default)]
pub struct TurnAdvice {
    pub rpm: f64, pub rpm_table: f64, pub vc: f64, pub f: f64, pub ap: f64, pub h: f64, pub kc: f64, pub q: f64,
    pub fc: f64, pub p_net: f64, pub p_spindle: f64, pub p_avail: f64, pub torque: f64, pub use_power: f64,
    pub limit: u8, pub reduced: u8, pub rpm_capped: bool,
}

fn turn_eval(j: &TurnJob, rpm: f64, vc: f64, f: f64, ap: f64) -> (f64, f64, f64, f64, f64, f64, f64, f64) {
    let h = lead_chip_thickness(f, j.kappa_deg);
    let kc = if pos(j.kc11) { kienzle_kc(j.kc11, j.mc.max(0.0), h) } else { f64::NAN };
    let q = mrr_turning_cm3_min(vc, ap, f);
    let fc = kc * ap * f;
    let p_net = power_kw(q, kc, 1.0);
    let p_sp = if pos(j.eta) { power_kw(q, kc, j.eta) } else { f64::NAN };
    let p_av = if pos(j.p_max) { spindle_power_available_kw(rpm, j.p_max, j.t_max.max(0.0)) } else { f64::NAN };
    (h, kc, q, fc, p_net, p_sp, p_av, if p_sp.is_finite() && p_av.is_finite() { p_sp / p_av } else { f64::NAN })
}

/// Turning advice. Order of work:
/// 1. Spindle speed from the starting cutting speed at the diameter, held to the machine's top speed.
/// 2. Chip thickness h = f sin(entering angle); kc at that thickness (Kienzle).
/// 3. Cutting force Fc = kc ap f; power Pc = Fc vc / 60 000; spindle power = Pc / efficiency;
///    torque from the power and speed; power available from the spindle curve.
/// 4. If the spindle is short of power: reduce the depth of cut; if that is locked, the feed;
///    if both are locked nothing is changed and the share of the limit used comes back above 1.
pub fn advise_turn(j: &TurnJob) -> TurnAdvice {
    let nan = f64::NAN;
    let mut a = TurnAdvice { rpm: nan, rpm_table: nan, vc: nan, f: nan, ap: nan, h: nan, kc: nan, q: nan, fc: nan,
        p_net: nan, p_spindle: nan, p_avail: nan, torque: nan, use_power: nan, ..Default::default() };
    if !(pos(j.d) && pos(j.vc) && pos(j.f) && pos(j.ap) && j.kappa_deg > 0.0 && j.kappa_deg < 180.0) { return a; }
    a.rpm_table = rpm_from_vc(j.vc, j.d);
    a.rpm = a.rpm_table;
    if pos(j.n_max) && a.rpm > j.n_max { a.rpm = j.n_max; a.rpm_capped = true; a.limit = ADV_RPM; }
    a.vc = vc_from_rpm(a.rpm, j.d);
    let (mut f, mut ap) = (j.f, j.ap);
    let mut e = turn_eval(j, a.rpm, a.vc, f, ap);
    if e.7.is_finite() && e.7 > 1.0 {
        a.limit = if pos(j.t_max) && e.6 < j.p_max { LIMIT_TORQUE } else { LIMIT_POWER };
        if !j.ap_locked { ap /= e.7; a.reduced = CUT_AP; }
        else if !j.f_locked {
            let (mut lo, mut hi) = (0.0, f);
            for _ in 0..60 { let mid = (lo + hi) / 2.0; if turn_eval(j, a.rpm, a.vc, mid, ap).7 > 1.0 { hi = mid; } else { lo = mid; } }
            f = lo; a.reduced = CUT_FEED;
        } else { a.reduced = CUT_NOTHING_LEFT; }
        e = turn_eval(j, a.rpm, a.vc, f, ap);
    }
    a.f = f; a.ap = ap; a.h = e.0; a.kc = e.1; a.q = e.2; a.fc = e.3; a.p_net = e.4; a.p_spindle = e.5; a.p_avail = e.6; a.use_power = e.7;
    a.torque = if e.5.is_finite() { torque_for_power_nm(e.5, a.rpm) } else { nan };
    a
}

/// f64 wrapper for the WebAssembly layer. `lock`: 0 none, 1 depth locked, 2 feed locked, 3 both.
/// `out`: 0 rpm, 1 vc, 2 feed, 3 depth, 4 chip thickness, 5 kc, 6 Q (cm^3/min), 7 cutting force (N),
/// 8 net power, 9 spindle power, 10 power available, 11 torque, 12 share of the power available,
/// 13 limit code, 14 what was reduced, 15 rpm capped, 16 rpm before the cap.
#[allow(clippy::too_many_arguments)]
pub fn advise_turn_f(d: f64, vc: f64, f: f64, ap: f64, kappa_deg: f64, kc11: f64, mc: f64, lock: f64,
                     n_max: f64, p_max: f64, t_max: f64, eta: f64, out: f64) -> f64 {
    let lk = lock as i32;
    let a = advise_turn(&TurnJob { d, vc, f, ap, kappa_deg, kc11, mc, ap_locked: lk == 1 || lk == 3, f_locked: lk == 2 || lk == 3, n_max, p_max, t_max, eta });
    match out as i32 {
        0 => a.rpm, 1 => a.vc, 2 => a.f, 3 => a.ap, 4 => a.h, 5 => a.kc, 6 => a.q, 7 => a.fc, 8 => a.p_net, 9 => a.p_spindle,
        10 => a.p_avail, 11 => a.torque, 12 => a.use_power, 13 => a.limit as f64, 14 => a.reduced as f64,
        15 => if a.rpm_capped { 1.0 } else { 0.0 }, 16 => a.rpm_table,
        _ => f64::NAN,
    }
}

/// Drilling advice with the spindle check, as
/// `[rpm, vc, feed per rev, penetration rate, rpm before the cap, limit code, kc, torque (N m),
///   thrust (N), spindle power (kW), power available (kW), share of the power available]`.
/// The speed is held to the machine's top speed and the penetration rate to its
/// top feed as in [`advise_hole`]; then, if the spindle is short of power or
/// torque, the feed per revolution is reduced until it is not (kc is taken at
/// the chip thickness of each lip, so it rises a little as the feed drops).
/// `feed_locked` > 0: the feed is yours, so it is left alone and the share comes back above 1.
#[allow(clippy::too_many_arguments)]
pub fn advise_drill(vc: f64, d: f64, fnr: f64, point_deg: f64, kc11: f64, mc: f64, feed_locked: f64,
                    n_max: f64, vf_max: f64, p_max: f64, t_max: f64, eta: f64) -> [f64; 12] {
    let h0 = advise_hole(vc, d, fnr, n_max, vf_max);
    if !h0[0].is_finite() { return [f64::NAN; 12]; }
    let (rpm, vca, table) = (h0[0], h0[1], h0[4]);
    let mut f = h0[2]; let mut limit = h0[5];
    let eval = |f: f64| {
        let kc = if pos(kc11) { kienzle_kc(kc11, mc.max(0.0), drill_chip_thickness(f, point_deg)) } else { f64::NAN };
        let p_sp = if pos(eta) { drill_power_kw(vca, d, f, kc) / eta } else { f64::NAN };
        let p_av = if pos(p_max) { spindle_power_available_kw(rpm, p_max, t_max.max(0.0)) } else { f64::NAN };
        (kc, p_sp, p_av, if p_sp.is_finite() && p_av.is_finite() { p_sp / p_av } else { f64::NAN })
    };
    let mut e = eval(f);
    if e.3.is_finite() && e.3 > 1.0 {
        limit = if pos(t_max) && e.2 < p_max { LIMIT_TORQUE as f64 } else { LIMIT_POWER as f64 };
        if !(feed_locked > 0.0) {
            let (mut lo, mut hi) = (0.0, f);
            for _ in 0..60 { let mid = (lo + hi) / 2.0; if eval(mid).3 > 1.0 { hi = mid; } else { lo = mid; } }
            f = lo; e = eval(f);
        }
    }
    [rpm, vca, f, rpm * f, table, limit, e.0, drill_torque_nm(d, f, e.0), drill_thrust_n(e.0, d, f, point_deg), e.1, e.2, e.3]
}

// ---------------- Plunge roughing ----------------
/// Height of the cusp left on the wall between two neighbouring plunges of a cutter of
/// diameter `d` spaced `step` apart along the wall. The two circles cross midway, so
/// `h = R - sqrt(R^2 - (step / 2)^2)` (own geometry). NaN when the plunges do not overlap.
pub fn plunge_cusp(d: f64, step: f64) -> f64 {
    if !(pos(d) && pos(step)) || step > d { return f64::NAN; }
    let r = d / 2.0;
    r - (r * r - step * step / 4.0).sqrt()
}

/// Largest spacing along the wall at which neighbouring plunges still meet inside a
/// stepover `ae`: there the cusp is as high as the stepover, `2 sqrt(ae (d - ae))`; from a
/// stepover of half the diameter up it is the diameter itself (own geometry).
pub fn plunge_max_step(d: f64, ae: f64) -> f64 {
    if !(pos(d) && pos(ae)) { return f64::NAN; }
    if ae >= d / 2.0 { d } else { 2.0 * (ae * (d - ae)).sqrt() }
}

/// Removal rate (cm^3/min) while the cutter is going down. Each plunge clears a strip one
/// stepover wide and one spacing long (the cusps a row leaves are taken by the next row),
/// so `Q = ae x step x Vf / 1000`.
pub fn plunge_mrr_cm3_min(ae: f64, step: f64, vf: f64) -> f64 {
    if !(pos(ae) && pos(step) && pos(vf)) { return f64::NAN; }
    ae * step * vf / 1000.0
}

/// Plunges in a row of length `len` at a spacing `step`, with a plunge at each end.
pub fn plunge_count(len: f64, step: f64) -> f64 {
    if !(pos(len) && pos(step)) { return f64::NAN; }
    (len / step - 1e-9).ceil().max(0.0) + 1.0
}

/// Time going down (min) for `count` plunges to `depth` (mm) at a feed rate `vf` (mm/min):
/// `count x depth / Vf`. Retracts and moves between plunges are not counted.
pub fn plunge_rough_time_min(depth: f64, vf: f64, count: f64) -> f64 {
    if !(pos(depth) && pos(vf) && pos(count)) { return f64::NAN; }
    count * depth / vf
}

/// Plunge roughing with an end mill: the cutter feeds straight down, steps along the wall and
/// goes down again. `vc` and `fz` are the speed and the feed per tooth DOWN, after the
/// publisher's plunging rule has been applied. Returns
/// `[rpm, vc reached, feed per tooth, feed rate down, rpm before the cap, limit, kc, removal rate
///   (cm^3/min), spindle power (kW), power available (kW), share of the power available, reduced]`.
/// Speed and feed are held to the machine as in [`advise_hole`] with a feed per revolution of
/// `z x fz`. Power: `Pc = Q kc / 60 000` [SAN] with kc at a chip thickness equal to the feed per
/// tooth (the end teeth cut square to the feed). If the spindle is short the feed per tooth is
/// reduced, unless it is locked (`fz_locked` > 0), in which case the share comes back above 1.
#[allow(clippy::too_many_arguments)]
pub fn advise_plunge(vc: f64, d: f64, z: f64, fz: f64, ae: f64, step: f64, kc11: f64, mc: f64, fz_locked: f64,
                     n_max: f64, vf_max: f64, p_max: f64, t_max: f64, eta: f64) -> [f64; 12] {
    if !(pos(z) && pos(fz)) { return [f64::NAN; 12]; }
    let h0 = advise_hole(vc, d, z * fz, n_max, vf_max);
    if !h0[0].is_finite() { return [f64::NAN; 12]; }
    let (rpm, vca, table) = (h0[0], h0[1], h0[4]);
    let mut f = h0[2] / z; let mut limit = h0[5]; let mut reduced = if h0[2] < z * fz * (1.0 - 1e-12) { 1.0 } else { 0.0 };
    let eval = |f: f64| {
        let kc = if pos(kc11) { kienzle_kc(kc11, mc.max(0.0), f) } else { f64::NAN };
        let q = plunge_mrr_cm3_min(ae, step, rpm * z * f);
        let p_sp = if pos(eta) { power_kw(q, kc, eta) } else { f64::NAN };
        let p_av = if pos(p_max) { spindle_power_available_kw(rpm, p_max, t_max.max(0.0)) } else { f64::NAN };
        (kc, q, p_sp, p_av, if p_sp.is_finite() && p_av.is_finite() { p_sp / p_av } else { f64::NAN })
    };
    let mut e = eval(f);
    if e.4.is_finite() && e.4 > 1.0 {
        limit = if pos(t_max) && e.3 < p_max { LIMIT_TORQUE as f64 } else { LIMIT_POWER as f64 };
        if !(fz_locked > 0.0) {
            let (mut lo, mut hi) = (0.0, f);
            for _ in 0..60 { let mid = (lo + hi) / 2.0; if eval(mid).4 > 1.0 { hi = mid; } else { lo = mid; } }
            f = lo; e = eval(f); reduced = 1.0;
        }
    }
    [rpm, vca, f, rpm * z * f, table, limit, e.0, e.1, e.2, e.3, e.4, reduced]
}

// ---------------- Tapping ----------------
/// Tapping speed and feed. A tap must feed one pitch per revolution, so the feed rate is
/// `pitch x rpm` and a machine limit can only be met by slowing the spindle:
/// rpm = min(table speed, top spindle speed, top feed rate / pitch), rounded down to a whole
/// revolution per minute (above 1 rpm) so that the S and F words of the program multiply out exactly.
/// Returns [rpm, cutting speed actually reached (m/min), feed rate (mm/min), rpm the table asks for, limit]
/// with limit 0, ADV_RPM or ADV_FEED. `n_max` / `vf_max` of 0 mean "not checked".
pub fn advise_tap(vc: f64, d: f64, pitch: f64, n_max: f64, vf_max: f64) -> [f64; 5] {
    if !(pos(vc) && pos(d) && pos(pitch)) { return [f64::NAN; 5]; }
    let table = rpm_from_vc(vc, d);
    let (mut rpm, mut limit) = (table, 0u8);
    if pos(n_max) && rpm > n_max { rpm = n_max; limit = ADV_RPM; }
    if pos(vf_max) && tap_feed(pitch, rpm) > vf_max { rpm = vf_max / pitch; limit = ADV_FEED; }
    if rpm >= 1.0 { rpm = (rpm + 1e-9).floor(); }
    [rpm, vc_from_rpm(rpm, d), tap_feed(pitch, rpm), table, limit as f64]
}

/// Time (min) to tap to `depth` (mm) and back out at the same speed: 2 depth / (pitch x rpm).
/// The stop and reversal of the spindle at the bottom is not included.
pub fn tap_time_min(depth: f64, pitch: f64, rpm: f64) -> f64 {
    if !(pos(depth) && pos(pitch) && pos(rpm)) { return f64::NAN; }
    2.0 * depth / tap_feed(pitch, rpm)
}

// ---------------- Boring bar ----------------
pub const ADV_OVERHANG: u8 = 9; // overhang past the bar maker's guidance in bar diameters

/// Deepest cut (mm) that keeps the tip of a boring bar at `defl_limit` (mm): the
/// deflection is linear in the force and Fc = kc ap fn [SAN], so
/// `ap = defl_limit / (deflection for 1 mm of depth)`. Bar as in [`boring_bar_deflection`].
pub fn bore_depth_for_deflection(defl_limit: f64, l: f64, d: f64, di: f64, e_gpa: f64, kc: f64, fnr: f64) -> f64 {
    if !(pos(defl_limit) && pos(kc) && pos(fnr)) { return f64::NAN; }
    defl_limit / boring_bar_deflection(turning_force(kc, 1.0, fnr), l, d, di, e_gpa)
}

/// Longest overhang (mm) that keeps the tip at `defl_limit` under the force `f_n`:
/// from delta = F L^3 / (3 E I) [GERE], `L = cbrt(3 E I delta / F)`.
pub fn bore_overhang_for_deflection(defl_limit: f64, f_n: f64, d: f64, di: f64, e_gpa: f64) -> f64 {
    if !(pos(defl_limit) && pos(f_n) && pos(d) && pos(e_gpa) && di < d) { return f64::NAN; }
    (3.0 * e_gpa * 1000.0 * second_moment_tube(d, di) * defl_limit / f_n).cbrt()
}

/// Boring bar advice. The bar is a cantilever clamped at the holder face. The force is
/// `f_known` (N) if given, otherwise Fc = kc ap fn. Two shares are reported: the tip
/// deflection against `defl_limit` (mm, 0 = not checked) and the overhang L/D against
/// `ld_guide` (a bar maker's guidance in bar diameters, 0 = not checked).
/// If the depth would bend the bar past the allowed deflection it is reduced to the
/// deepest cut that fits, unless `ap_locked` > 0 (a locked depth is never changed) or
/// the force was typed. The limit named is the larger share when it is over 1, or the
/// deflection when the depth was reduced and the overhang is inside its guidance.
/// Returns [force, deflection, share of the allowed deflection, L/D, share of the guidance,
/// limit (0, LIMIT_DEFLECTION or ADV_OVERHANG), depth used, deepest depth inside the
/// deflection, reduced (0 or 1), overhang at which the starting depth fits].
#[allow(clippy::too_many_arguments)]
pub fn advise_bore(l: f64, d: f64, di: f64, e_gpa: f64, kc: f64, fnr: f64, ap: f64, ap_locked: f64,
                   f_known: f64, defl_limit: f64, ld_guide: f64) -> [f64; 10] {
    if !(pos(l) && pos(d) && pos(e_gpa) && di < d) { return [f64::NAN; 10]; }
    let typed = pos(f_known);
    let ap_max = if typed { f64::NAN } else { bore_depth_for_deflection(defl_limit, l, d, di, e_gpa, kc, fnr) };
    let f0 = if typed { f_known } else if pos(kc) && pos(fnr) && pos(ap) { turning_force(kc, ap, fnr) } else { f64::NAN };
    let mut ap_used = if typed { f64::NAN } else { ap };
    let mut reduced = 0.0;
    if !typed && !(ap_locked > 0.0) && ap_max.is_finite() && ap > ap_max { ap_used = ap_max; reduced = 1.0; }
    let force = if typed { f_known } else if reduced > 0.0 { turning_force(kc, ap_used, fnr) } else { f0 };
    let defl = boring_bar_deflection(force, l, d, di, e_gpa);
    let share_d = if pos(defl_limit) { defl / defl_limit } else { f64::NAN };
    let ld = l / d;
    let share_l = if pos(ld_guide) { ld / ld_guide } else { f64::NAN };
    let over_d = share_d.is_finite() && (share_d > 1.0 + 1e-9 || reduced > 0.0);
    let over_l = share_l.is_finite() && share_l > 1.0 + 1e-9;
    let limit = if over_l && (!over_d || share_l > share_d) { ADV_OVERHANG } else if over_d { LIMIT_DEFLECTION } else { 0 };
    [force, defl, share_d, ld, share_l, limit as f64, ap_used, ap_max, reduced, bore_overhang_for_deflection(defl_limit, f0, d, di, e_gpa)]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{LIMIT_POWER, LIMIT_TORQUE, MM_PER_IN};
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }
    const SFM: f64 = 0.3048; // m/min per ft/min

    fn job() -> MillJob {
        // 12 mm 4-flute carbide end mill, 40 mm stick-out, steel group 2
        MillJob { d: 12.0, z: 4.0, d_shank: 12.0, stickout: 40.0, flute_len: 26.0, flute_factor: 0.0, e_gpa: 580.0,
            vc: 120.0, chip: 0.05, kc11: 1500.0, mc: 0.22, ae: 6.0, ap: 12.0, ae_locked: false, ap_locked: false,
            n_max: 0.0, vf_max: 0.0, p_max: 0.0, t_max: 0.0, eta: 0.8, radial_ratio: 1.0, defl_limit: 0.0 }
    }

    /// Published worked example: University of Florida, EML2322L "Drilling and
    /// milling speeds and feeds": a 1 in 4-flute HSS end mill in aluminium,
    /// V = 250 sfm, gives N of about 950 rpm, and 0.008 in/tooth gives about
    /// 30 in/min. Exact: 954.9 rpm, 30.56 in/min. Tolerance 2 %.
    #[test]
    fn published_uf_end_mill_in_aluminium() {
        let j = MillJob { d: 25.4, z: 4.0, vc: 250.0 * SFM, chip: 0.008 * MM_PER_IN, ae: 25.4, ap: 5.0, ..job() };
        let a = advise_mill(&j);
        assert!((a.rpm / 950.0 - 1.0).abs() < 0.02, "{}", a.rpm);
        assert!((a.vf / MM_PER_IN / 30.0 - 1.0).abs() < 0.02, "{}", a.vf / MM_PER_IN);
        assert_eq!(a.limit, 0);
        // the same page scales speed and feed to 60 % for oil put on by hand: 570 rpm, 18 in/min
        let j6 = MillJob { vc: j.vc * 0.6, ..j };
        let a6 = advise_mill(&j6);
        assert!((a6.rpm / 570.0 - 1.0).abs() < 0.02 && (a6.vf / MM_PER_IN / 18.0 - 1.0).abs() < 0.03, "{} {}", a6.rpm, a6.vf / MM_PER_IN);
    }

    /// Published worked example, same document: a 1/4 in HSS drill in soft cast
    /// iron, V = 100 sfm, gives about 1500 rpm, and 0.004 in/rev gives 6.0 in/min.
    /// Exact: 1527.9 rpm, 6.11 in/min. Tolerance 2 %. At 60 %: 900 rpm, 3.6 in/min.
    #[test]
    fn published_uf_drill_in_cast_iron() {
        let h = advise_hole(100.0 * SFM, 0.25 * MM_PER_IN, 0.004 * MM_PER_IN, 0.0, 0.0);
        assert!((h[0] / 1500.0 - 1.0).abs() < 0.02, "{}", h[0]);
        assert!((h[3] / MM_PER_IN / 6.0 - 1.0).abs() < 0.02, "{}", h[3] / MM_PER_IN);
        let h6 = advise_hole(60.0 * SFM, 0.25 * MM_PER_IN, 0.004 * MM_PER_IN, 0.0, 0.0);
        assert!((h6[0] / 900.0 - 1.0).abs() < 0.02 && (h6[3] / MM_PER_IN / 3.6 - 1.0).abs() < 0.02);
        // the feed table: 1/4 in sits at the bottom of the 1/4 to 1/2 in band
        assert_eq!(drill_feed_range_in(0.25), [0.004, 0.008]);
        assert_eq!(drill_feed_range_in(0.2), [0.002, 0.004]);
        assert_eq!(drill_feed_range_in(0.75), [0.008, 0.012]);
        assert_eq!(drill_feed_range_in(1.5), [0.012, 0.020]);
        assert!(close(drill_feed_range_in(0.0625)[0], 0.000625, 1e-12));
    }

    /// Published worked example: Mitsubishi Materials, "Cutting power for face
    /// milling": tool steel, ap 2 mm, ae 80 mm, vf 280 mm/min, kc 1800 MPa,
    /// machine coefficient 0.8: Pc = 1.68 kW.
    #[test]
    fn published_mitsubishi_face_milling_power() {
        let q = crate::mrr_milling(80.0, 2.0, 280.0) / 1000.0;
        assert!(close(crate::power_kw(q, 1800.0, 0.8), 1.68, 0.005));
        // and its spindle speed and feed per tooth: 250 mm cutter at 80 m/min = 101.9 rpm; 280 / (12 x 101.9) = 0.228 mm
        let n = rpm_from_vc(80.0, 250.0);
        assert!(close(n, 101.9, 0.05) && close(crate::feed_per_tooth(280.0, n, 12), 0.229, 0.001));
    }

    #[test]
    fn chip_thinning_sets_the_feed() {
        // ae = D/2 or more: feed per tooth is the chip thickness; at 10 % of D it is 1.667 x
        let a = advise_mill(&job());
        assert!(close(a.fz, 0.05, 1e-12) && close(a.hex, 0.05, 1e-12));
        let b = advise_mill(&MillJob { ae: 1.2, ..job() });
        assert!(close(b.fz, 0.05 / 0.6, 1e-12) && close(b.hex, 0.05, 1e-12));
        // n = 1000 x 120 / (pi x 12) = 3183.1; vf = n x 4 x fz
        assert!(close(a.rpm, 3183.1, 0.05) && close(a.vf, a.rpm * 4.0 * 0.05, 1e-9));
        assert!(a.solid_assumed);
    }

    #[test]
    fn names_the_limit() {
        // spindle speed: 3 mm tool at 300 m/min wants 31 831 rpm, the machine has 12 000
        let a = advise_mill(&MillJob { d: 3.0, d_shank: 3.0, vc: 300.0, ae: 1.5, ap: 3.0, n_max: 12_000.0, ..job() });
        assert!(a.rpm_capped && a.limit == ADV_RPM && close(a.rpm, 12_000.0, 1e-9) && close(a.rpm_table, 31_831.0, 1.0));
        assert!(close(a.vc, 113.1, 0.05));
        // feed rate: capped at 500 mm/min, the feed per tooth drops, depth and width stay
        let a = advise_mill(&MillJob { vf_max: 500.0, ..job() });
        assert!(a.feed_capped && a.limit == ADV_FEED && a.reduced == CUT_FEED && close(a.vf, 500.0, 1e-6) && a.ap == 12.0 && a.ae == 6.0);
        // power: 1 kW machine
        let a = advise_mill(&MillJob { p_max: 1.0, ..job() });
        assert!(a.limit == LIMIT_POWER && a.reduced == CUT_AP && a.ap < 12.0 && close(a.p_spindle, 1.0, 1e-9) && close(a.use_power, 1.0, 1e-9));
        // torque: 10 kW but only 2 N m below base speed (2 N m at 3183 rpm = 0.667 kW)
        let a = advise_mill(&MillJob { p_max: 10.0, t_max: 2.0, ..job() });
        assert!(a.limit == LIMIT_TORQUE && close(a.torque, 2.0, 1e-9), "{} {}", a.limit, a.torque);
        // deflection: long stick-out, 0.02 mm allowed
        let a = advise_mill(&MillJob { stickout: 80.0, defl_limit: 0.02, ..job() });
        assert!(a.limit == LIMIT_DEFLECTION && close(a.defl, 0.02, 1e-9) && a.ap < 12.0);
        // nothing in the way: the table values come back untouched
        let a = advise_mill(&MillJob { p_max: 50.0, defl_limit: 5.0, ..job() });
        assert!(a.limit == 0 && a.reduced == CUT_NOTHING && a.ap == 12.0 && a.ae == 6.0);
    }

    #[test]
    fn locked_values_never_change() {
        let tight = MillJob { p_max: 1.0, ..job() };
        // ap locked: the width gives way
        let a = advise_mill(&MillJob { ap_locked: true, ..tight });
        assert!(a.ap == 12.0 && a.ae < 6.0 && a.reduced == CUT_AE && a.use_power <= 1.0 + 1e-9 && a.use_power > 0.999);
        // ae locked: the depth gives way
        let a = advise_mill(&MillJob { ae_locked: true, ..tight });
        assert!(a.ae == 6.0 && a.ap < 12.0 && a.reduced == CUT_AP);
        // both locked: only the feed gives way
        let a = advise_mill(&MillJob { ae_locked: true, ap_locked: true, ..tight });
        assert!(a.ae == 6.0 && a.ap == 12.0 && a.reduced == CUT_FEED && a.fz < 0.05 && a.use_power <= 1.0 + 1e-9 && a.use_power > 0.999);
        // through the wrapper too, for every limit
        for (p, t, dl, st) in [(1.0, 0.0, 0.0, 40.0), (10.0, 2.0, 0.0, 40.0), (0.0, 0.0, 0.01, 90.0)] {
            let f = |lock: f64, out: f64| advise_mill_f(12.0, 4.0, 12.0, st, 26.0, 0.0, 580.0, 120.0, 0.05, 1500.0, 0.22, 6.0, 12.0, lock, 0.0, 0.0, p, t, 0.8, 1.0, dl, out);
            assert_eq!(f(3.0, 4.0), 6.0); assert_eq!(f(3.0, 5.0), 12.0);
            assert_eq!(f(1.0, 5.0), 12.0); assert_eq!(f(2.0, 4.0), 6.0);
            assert!(f(0.0, 14.0) > 0.0);
        }
    }

    #[test]
    fn engagement_suggestions() {
        // 12 mm tool, 26 mm of flute
        assert_eq!(mill_engagement(0.0, 12.0, 26.0, 0.0)[..2], [12.0, 0.2 * 12.0]);
        assert!(close(mill_engagement(0.0, 12.0, 26.0, 1.0)[1], 12.0, 1e-12));
        assert_eq!(mill_engagement(1.0, 12.0, 26.0, 0.5)[..2], [6.0, 12.0]);
        let h = mill_engagement(2.0, 12.0, 26.0, 0.0);
        assert!(close(h[0], 0.84, 1e-12) && close(h[1], 24.0, 1e-12));
        assert!(close(mill_engagement(2.0, 12.0, 26.0, 1.0)[0], 3.6, 1e-12));
        // the flute length caps the depth
        assert_eq!(mill_engagement(2.0, 12.0, 18.0, 0.0)[1], 18.0);
        let f = mill_engagement(3.0, 12.0, 26.0, 0.0);
        assert!(close(f[0], 0.24, 1e-12) && close(f[1], 18.0, 1e-12));
        assert!(close(mill_engagement(3.0, 12.0, 26.0, 1.0)[0], 0.6, 1e-12));
        assert!(close(range_pick(60.0, 100.0, 0.25), 70.0, 1e-12) && range_pick(60.0, 100.0, 7.0) == 100.0);
    }

    /// Published worked example: University of Florida design lab, "Speeds and
    /// Feeds" (web page), example 1B: a 1/4 in HSS reamer in mild steel runs at
    /// half the drill's speed and twice its feed: 750 rpm and 6.0 in/min.
    /// Exact: 763.9 rpm, 6.11 in/min. Tolerance 2 %.
    #[test]
    fn published_uf_reamer_in_mild_steel() {
        let h = advise_hole(0.5 * 100.0 * SFM, 0.25 * MM_PER_IN, 2.0 * 0.004 * MM_PER_IN, 0.0, 0.0);
        assert!((h[0] / 750.0 - 1.0).abs() < 0.02 && (h[3] / MM_PER_IN / 6.0 - 1.0).abs() < 0.02, "{} {}", h[0], h[3] / MM_PER_IN);
    }

    /// Published worked example, same page, example 2B: a 1/2 in 3-flute carbide
    /// end mill in aluminium, V = 2.5 x 250 = 625 sfm, 0.004 in/tooth: 4700 rpm
    /// and 56 in/min. Exact: 4774.6 rpm, 57.3 in/min. Tolerance 2.5 % (the page
    /// rounds the speed down to a round figure).
    #[test]
    fn published_uf_carbide_end_mill_in_aluminium() {
        let j = MillJob { d: 12.7, z: 3.0, vc: 625.0 * SFM, chip: 0.004 * MM_PER_IN, ae: 12.7, ap: 3.0, ..job() };
        let a = advise_mill(&j);
        assert!((a.rpm / 4700.0 - 1.0).abs() < 0.025 && (a.vf / MM_PER_IN / 56.0 - 1.0).abs() < 0.025, "{} {}", a.rpm, a.vf / MM_PER_IN);
    }

    /// Published worked example, same page, example 3: an HSS countersink of
    /// 0.42 in largest diameter in aluminium at a quarter of 250 sfm, 0.006 in/rev:
    /// 550 rpm and 3.3 in/min. Exact: 568.4 rpm, 3.41 in/min. Tolerance 4 %.
    #[test]
    fn published_uf_countersink_in_aluminium() {
        let h = advise_hole(0.25 * 250.0 * SFM, 0.42 * MM_PER_IN, 0.006 * MM_PER_IN, 0.0, 0.0);
        assert!((h[0] / 550.0 - 1.0).abs() < 0.04 && (h[3] / MM_PER_IN / 3.3 - 1.0).abs() < 0.04, "{} {}", h[0], h[3] / MM_PER_IN);
    }

    /// Published worked example: Open Oregon, "Manufacturing Processes 4-5",
    /// unit 2: a 3/8 in two-flute HSS end mill in mild steel at 90 sfm:
    /// 960 rpm, and 0.002 in/tooth gives 3.84 in/min. The book uses the
    /// shortcut rpm = 4 x speed / diameter (12 / pi is 3.82), so its figures
    /// sit 4.7 % above the exact 916.7 rpm and 3.67 in/min. Tolerance 5 %.
    #[test]
    fn published_open_oregon_end_mill_in_mild_steel() {
        let j = MillJob { d: 0.375 * MM_PER_IN, z: 2.0, vc: 90.0 * SFM, chip: 0.002 * MM_PER_IN, ae: 0.375 * MM_PER_IN, ap: 3.0, ..job() };
        let a = advise_mill(&j);
        assert!((a.rpm / 960.0 - 1.0).abs() < 0.05 && (a.vf / MM_PER_IN / 3.84 - 1.0).abs() < 0.05, "{} {}", a.rpm, a.vf / MM_PER_IN);
        assert!(close(a.rpm, 916.7, 0.1));
    }

    #[test]
    fn published_corrections() {
        // oil by hand: 60 % of 950 rpm is 570 rpm [UF]; carbide: 2.5 x 250 sfm = 625 sfm [UF]
        assert!(close(apply_factor(950.0, 0.6), 570.0, 1e-9) && close(apply_factor(250.0, 2.5), 625.0, 1e-9));
        assert!(apply_factor(1.0, -1.0).is_nan());
    }

    /// Published figures: Gammons Hoaglund, "Reaming guide": about 3 % of the
    /// hole diameter is left for the reamer; its examples are 0.010 in on a
    /// 1/4 in hole and 0.015 in on a 1/2 in hole (3 % gives 0.0075 and 0.015 in).
    #[test]
    fn reaming_stock() {
        assert!(close(apply_factor(0.5, 0.03), 0.015, 1e-12));
        assert!(close(ream_predrill(0.5, 0.015), 0.485, 1e-12) && close(ream_predrill(0.25, 0.010), 0.240, 1e-12));
        assert!(ream_predrill(0.25, 0.3).is_nan());
    }

    #[test]
    fn drilling_time_and_removal() {
        // 10 mm drill, 118 degree point (3.004 mm), 20 mm deep, 0.15 mm/rev at 2546.5 rpm: 23.004 / 381.97 = 0.06022 min
        let pt = crate::drill_point_length(10.0, 118.0);
        assert!(close(drill_time_min(20.0, pt, 0.15, 2546.5), 0.060224, 1e-5), "{}", drill_time_min(20.0, pt, 0.15, 2546.5));
        // Q = pi/4 x 100 x 381.97 / 1000 = 30.0 cm3/min
        assert!(close(mrr_drilling_cm3_min(10.0, 381.97), 30.0, 0.001));
        assert!(drill_time_min(0.0, 1.0, 0.1, 100.0).is_nan());
    }

    #[test]
    fn table_read_between_printed_sizes() {
        // a chip load printed as 0.002 in at 1/4 in and 0.003 in at 3/8 in: 5/16 in sits half way
        assert!(close(lerp_at(0.25, 0.002, 0.375, 0.003, 0.3125), 0.0025, 1e-12));
        assert_eq!(lerp_at(0.25, 0.002, 0.375, 0.003, 0.25), 0.002);
        assert_eq!(lerp_at(0.25, 0.002, 0.25, 0.009, 0.25), 0.002);
        assert!(lerp_at(f64::NAN, 0.0, 1.0, 1.0, 0.5).is_nan());
    }

    fn tjob() -> TurnJob {
        // 50 mm bar, steel group 2, 95 degree holder
        TurnJob { d: 50.0, vc: 200.0, f: 0.25, ap: 3.0, kappa_deg: 95.0, kc11: 1500.0, mc: 0.22, f_locked: false, ap_locked: false,
            n_max: 0.0, p_max: 0.0, t_max: 0.0, eta: 0.8 }
    }

    #[test]
    fn turning_advice() {
        let a = advise_turn(&tjob());
        // n = 1000 x 200 / (pi x 50) = 1273.2; h = 0.25 sin 95 = 0.24905; kc = 1500 x h^-0.22 = 2036.6
        assert!(close(a.rpm, 1273.24, 0.01) && close(a.h, 0.249049, 1e-6) && close(a.kc, 2036.6, 0.1), "{} {} {}", a.rpm, a.h, a.kc);
        // Fc = kc ap f = 1527.5 N; Pc = Fc vc / 60 000 = 5.092 kW; spindle 6.364 kW; Q = 150 cm3/min
        assert!(close(a.fc, 1527.5, 0.1) && close(a.p_net, 5.0915, 0.001) && close(a.p_spindle, 6.3644, 0.001) && close(a.q, 150.0, 1e-9), "{} {} {}", a.fc, a.p_net, a.p_spindle);
        assert!(close(a.torque, 6.3644 * 60_000.0 / (2.0 * std::f64::consts::PI * 1273.24), 0.01));
        assert!(a.limit == 0 && a.reduced == CUT_NOTHING && a.use_power.is_nan());
        // a 3.7 kW spindle: the depth gives way, in proportion
        let b = advise_turn(&TurnJob { p_max: 3.7, ..tjob() });
        assert!(b.limit == LIMIT_POWER && b.reduced == CUT_AP && close(b.ap, 3.0 * 3.7 / 6.3644, 0.001) && b.f == 0.25 && close(b.use_power, 1.0, 1e-9));
        // depth locked: the feed gives way and the depth is untouched
        let c = advise_turn(&TurnJob { p_max: 3.7, ap_locked: true, ..tjob() });
        assert!(c.ap == 3.0 && c.f < 0.25 && c.reduced == CUT_FEED && c.use_power <= 1.0 + 1e-9 && c.use_power > 0.999);
        // both locked: nothing changes and the cut is reported as over
        let d = advise_turn(&TurnJob { p_max: 3.7, ap_locked: true, f_locked: true, ..tjob() });
        assert!(d.ap == 3.0 && d.f == 0.25 && d.reduced == CUT_NOTHING_LEFT && d.use_power > 1.7);
        assert_eq!(advise_turn_f(50.0, 200.0, 0.25, 3.0, 95.0, 1500.0, 0.22, 3.0, 0.0, 3.7, 0.0, 0.8, 3.0), 3.0);
        assert_eq!(advise_turn_f(50.0, 200.0, 0.25, 3.0, 95.0, 1500.0, 0.22, 3.0, 0.0, 3.7, 0.0, 0.8, 2.0), 0.25);
        // top speed: 10 mm bar at 200 m/min wants 6366 rpm, the lathe has 4000; torque limit named below base speed
        let e = advise_turn(&TurnJob { d: 10.0, n_max: 4000.0, ..tjob() });
        assert!(e.rpm_capped && e.limit == ADV_RPM && close(e.vc, 125.66, 0.01) && close(e.rpm_table, 6366.2, 0.1));
        let t = advise_turn(&TurnJob { p_max: 15.0, t_max: 20.0, ..tjob() });
        assert!(t.limit == LIMIT_TORQUE && close(t.torque, 20.0, 1e-6), "{} {}", t.limit, t.torque);
    }

    #[test]
    fn drilling_advice_with_the_spindle() {
        // 10 mm drill, 0.15 mm/rev, 80 m/min, 140 degree point, steel group 2: the cutting force tools give
        // h = 0.0705 mm, kc = 2689, torque 5.04 N m, thrust 947 N (smoke test figures for the same cut)
        let a = advise_drill(80.0, 10.0, 0.15, 140.0, 1500.0, 0.22, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8);
        assert!(close(a[0], 2546.5, 0.1) && close(a[2], 0.15, 1e-12) && close(a[7], 5.04, 0.01) && close(a[8], 947.0, 1.0), "{:?}", a);
        assert!(close(a[9], 80.0 * 10.0 * 0.15 * a[6] / 240_000.0 / 0.8, 1e-9) && a[5] == 0.0);
        // a 1 kW spindle: the feed gives way
        let b = advise_drill(80.0, 10.0, 0.15, 140.0, 1500.0, 0.22, 0.0, 0.0, 0.0, 1.0, 0.0, 0.8);
        assert!(b[5] == LIMIT_POWER as f64 && b[2] < 0.15 && b[11] <= 1.0 + 1e-9 && b[11] > 0.999, "{:?}", b);
        // feed locked: untouched, reported over
        let c = advise_drill(80.0, 10.0, 0.15, 140.0, 1500.0, 0.22, 1.0, 0.0, 0.0, 1.0, 0.0, 0.8);
        assert!(c[2] == 0.15 && c[11] > 1.0);
    }

    #[test]
    fn boring_bar_advice() {
        // 20 mm steel bar (210 GPa), 60 mm overhang: I = pi 20^4 / 64 = 7853.98 mm^4.
        // kc 2000, 0.1 mm/rev, 1 mm deep: Fc = 200 N; delta = 200 x 60^3 / (3 x 210000 x 7853.98) = 0.008731 mm
        let i = std::f64::consts::PI * 20f64.powi(4) / 64.0;
        let a = advise_bore(60.0, 20.0, 0.0, 210.0, 2000.0, 0.1, 1.0, 0.0, 0.0, 0.05, 4.0);
        assert!(close(a[0], 200.0, 1e-9) && close(a[1], 200.0 * 216000.0 / (3.0 * 210000.0 * i), 1e-12) && close(a[1], 0.008731, 1e-6));
        assert!(close(a[2], a[1] / 0.05, 1e-12) && close(a[3], 3.0, 1e-12) && close(a[4], 0.75, 1e-12) && a[5] == 0.0 && a[8] == 0.0 && a[6] == 1.0);
        // deepest cut inside 0.05 mm: 0.05 / 0.008731 = 5.727 mm; at that depth the deflection is the limit
        assert!(close(a[7], 0.05 / a[1], 1e-9) && close(advise_bore(60.0, 20.0, 0.0, 210.0, 2000.0, 0.1, a[7], 1.0, 0.0, 0.05, 4.0)[2], 1.0, 1e-9));
        // 120 mm overhang (6 x D against 4 x D): 8 times the deflection for the same force. A 0.5 mm cut bends the bar
        // 4 x 0.008731 = 0.0349 mm, inside 0.05 mm, so the depth stays and the overhang is named
        let b = advise_bore(120.0, 20.0, 0.0, 210.0, 2000.0, 0.1, 0.5, 0.0, 0.0, 0.05, 4.0);
        assert!(close(b[1], 4.0 * a[1], 1e-12) && close(b[4], 1.5, 1e-12) && b[5] == ADV_OVERHANG as f64 && b[8] == 0.0);
        // finishing limit 0.01 mm at 60 mm: a 2 mm depth (0.01746 mm) is reduced to 0.01 / 0.008731 = 1.145 mm
        let c = advise_bore(60.0, 20.0, 0.0, 210.0, 2000.0, 0.1, 2.0, 0.0, 0.0, 0.01, 4.0);
        assert!(c[8] == 1.0 && close(c[6], 0.01 / a[1], 1e-9) && close(c[1], 0.01, 1e-12) && c[5] == LIMIT_DEFLECTION as f64);
        // the starting 2 mm depth would fit at L = 60 x cbrt(0.01 / 0.017462) = 49.83 mm
        assert!(close(c[9], 60.0 * (0.01f64 / (2.0 * a[1])).cbrt(), 1e-9) && close(c[9], 49.83, 0.01));
        // locked depth: never changed, reported over
        let l = advise_bore(60.0, 20.0, 0.0, 210.0, 2000.0, 0.1, 2.0, 1.0, 0.0, 0.01, 4.0);
        assert!(l[6] == 2.0 && l[8] == 0.0 && close(l[2], 2.0 * a[1] / 0.01, 1e-9) && l[5] == LIMIT_DEFLECTION as f64);
        // both over: the larger share is named (overhang 1.5 against deflection 8 x 2 x 0.8731 = 13.97: deflection)
        let m = advise_bore(120.0, 20.0, 0.0, 210.0, 2000.0, 0.1, 2.0, 1.0, 0.0, 0.01, 4.0);
        assert!(m[5] == LIMIT_DEFLECTION as f64 && m[2] > m[4]);
        // depth reduced to fit and the overhang past its guidance: the overhang is named
        let n = advise_bore(120.0, 20.0, 0.0, 210.0, 2000.0, 0.1, 2.0, 0.0, 0.0, 0.01, 4.0);
        assert!(n[8] == 1.0 && close(n[2], 1.0, 1e-9) && n[5] == ADV_OVERHANG as f64);
        // a typed force: no depth advice; a coolant hole softens the bar by d^4 / (d^4 - di^4)
        let t = advise_bore(60.0, 20.0, 6.0, 210.0, 0.0, 0.0, 0.0, 0.0, 200.0, 0.0, 0.0);
        assert!(t[6].is_nan() && t[7].is_nan() && t[2].is_nan() && t[5] == 0.0 && close(t[1] / a[1], 160000.0 / (160000.0 - 1296.0), 1e-9));
        assert!(advise_bore(60.0, 20.0, 20.0, 210.0, 2000.0, 0.1, 1.0, 0.0, 0.0, 0.05, 4.0)[0].is_nan());
    }

    #[test]
    fn plunge_roughing() {
        // 12 mm cutter, plunges 3 mm apart: cusp 6 - sqrt(36 - 2.25) = 0.1905 mm; at a 3 mm stepover they meet up to 2 sqrt(3 x 9) = 10.39 mm apart
        assert!(close(plunge_cusp(12.0, 3.0), 0.19052, 1e-4) && close(plunge_max_step(12.0, 3.0), 10.3923, 1e-3));
        assert!(plunge_cusp(12.0, 12.0) == 6.0 && plunge_cusp(12.0, 13.0).is_nan() && plunge_max_step(12.0, 6.0) == 12.0 && plunge_max_step(12.0, 8.0) == 12.0);
        // at the largest spacing the cusp is as high as the stepover
        assert!(close(plunge_cusp(12.0, plunge_max_step(12.0, 3.0)), 3.0, 1e-9));
        // a 50 mm row at 3 mm: 17 steps, 18 plunges; an exact multiple does not gain one
        assert!(plunge_count(50.0, 3.0) == 18.0 && plunge_count(30.0, 3.0) == 11.0);
        // 18 plunges 20 mm deep at 80 mm/min: 18 x 20 / 80 = 4.5 min in the cut
        assert!(close(plunge_rough_time_min(20.0, 80.0, 18.0), 4.5, 1e-12) && plunge_rough_time_min(0.0, 80.0, 1.0).is_nan());
        // 4 teeth, 60 m/min, 0.0125 mm per tooth down: n = 60000 / (pi x 12) = 1591.5 rpm, Vf = 1591.5 x 4 x 0.0125 = 79.58 mm/min,
        // Q = 3 x 3 x 79.58 / 1000 = 0.7162 cm3/min; kc = 1500 x 0.0125^-0.25 = 4486 N/mm2; P = 0.7162 x 4486 / 60000 / 0.8 = 0.0669 kW
        let a = advise_plunge(60.0, 12.0, 4.0, 0.0125, 3.0, 3.0, 1500.0, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8);
        assert!(close(a[0], 1591.55, 0.01) && close(a[3], 79.58, 0.01) && close(a[7], 0.7162, 1e-3) && close(a[6], 4486.0, 1.0) && close(a[8], 0.0669, 1e-3));
        assert!(a[5] == 0.0 && a[11] == 0.0 && a[9].is_nan() && close(a[2], 0.0125, 1e-12));
        // a 1000 rpm machine: the speed is held, the feed per tooth is not touched
        let b = advise_plunge(60.0, 12.0, 4.0, 0.0125, 3.0, 3.0, 1500.0, 0.25, 0.0, 1000.0, 0.0, 0.0, 0.0, 0.8);
        assert!(b[0] == 1000.0 && b[5] == ADV_RPM as f64 && close(b[3], 50.0, 1e-9) && close(b[2], 0.0125, 1e-12));
        // a 0.05 kW spindle is short of power: the feed per tooth comes down until the cut fits
        let c = advise_plunge(60.0, 12.0, 4.0, 0.0125, 3.0, 3.0, 1500.0, 0.25, 0.0, 0.0, 0.0, 0.05, 0.0, 0.8);
        assert!(c[5] == LIMIT_POWER as f64 && c[11] == 1.0 && c[2] < 0.0125 && close(c[10], 1.0, 1e-6) && close(c[8], 0.05, 1e-6));
        // locked: nothing is changed and the share is over 1
        let l = advise_plunge(60.0, 12.0, 4.0, 0.0125, 3.0, 3.0, 1500.0, 0.25, 1.0, 0.0, 0.0, 0.05, 0.0, 0.8);
        assert!(l[5] == LIMIT_POWER as f64 && l[11] == 0.0 && close(l[2], 0.0125, 1e-12) && close(l[10], 0.0669 / 0.05, 2e-3));
        // no stepover given: speed and feed still come back, power does not
        let n = advise_plunge(60.0, 12.0, 4.0, 0.0125, 0.0, 0.0, 1500.0, 0.25, 0.0, 0.0, 0.0, 5.0, 0.0, 0.8);
        assert!(close(n[3], 79.58, 0.01) && n[7].is_nan() && n[10].is_nan() && n[5] == 0.0);
    }

    #[test]
    fn tapping_advice() {
        // M10 x 1.5 at 30 ft/min = 9.144 m/min: n = 9144 / (pi x 10) = 291.06, run at 291 rpm; feed 291 x 1.5 = 436.5 mm/min;
        // speed reached pi x 10 x 291 / 1000 = 9.1421 m/min
        let a = advise_tap(9.144, 10.0, 1.5, 0.0, 0.0);
        assert!(a[0] == 291.0 && close(a[2], 436.5, 1e-9) && a[4] == 0.0 && close(a[1], 9.1421, 0.0001) && close(a[3], 291.06, 0.01));
        // M3 x 0.5 in aluminium at 80 ft/min = 24.384 m/min wants 2587 rpm; a 2000 rpm tapping limit holds it, feed stays one pitch per rev
        let b = advise_tap(24.384, 3.0, 0.5, 2000.0, 0.0);
        assert!(close(b[3], 2587.2, 0.1) && b[0] == 2000.0 && close(b[2], 1000.0, 1e-9) && b[4] == ADV_RPM as f64 && close(b[1], 18.85, 0.01));
        // a top feed of 600 mm/min: the spindle slows to 1200 rpm so the feed is still pitch x rpm
        let c = advise_tap(24.384, 3.0, 0.5, 2000.0, 600.0);
        assert!(close(c[0], 1200.0, 1e-9) && close(c[2], 600.0, 1e-9) && c[4] == ADV_FEED as f64 && close(c[2] / c[0], 0.5, 1e-12));
        // a top feed of 1000 mm/min on a 0.7 mm pitch: 1428.57 rounds down to 1428 rpm, feed 999.6 mm/min
        let e = advise_tap(40.0, 4.0, 0.7, 0.0, 1000.0);
        assert!(e[0] == 1428.0 && close(e[2], 999.6, 1e-9) && e[4] == ADV_FEED as f64);
        // 15 mm deep at 291 rpm x 1.5: in and out 2 x 15 / 436.5 = 0.06873 min = 4.124 s
        assert!(close(tap_time_min(15.0, 1.5, a[0]), 30.0 / a[2], 1e-12) && close(tap_time_min(15.0, 1.5, a[0]) * 60.0, 4.124, 0.001));
        assert!(advise_tap(0.0, 10.0, 1.5, 0.0, 0.0)[0].is_nan());
    }

    #[test]
    fn hole_limits() {
        // 3 mm drill at 80 m/min wants 8488 rpm; the machine has 6000
        let h = advise_hole(80.0, 3.0, 0.06, 6000.0, 0.0);
        assert!(h[5] == ADV_RPM as f64 && h[0] == 6000.0 && close(h[4], 8488.3, 0.1) && close(h[1], 56.55, 0.01));
        let h = advise_hole(80.0, 3.0, 0.06, 0.0, 300.0);
        assert!(h[5] == ADV_FEED as f64 && close(h[3], 300.0, 1e-9) && close(h[2], 300.0 / 8488.26, 1e-6));
    }
}
