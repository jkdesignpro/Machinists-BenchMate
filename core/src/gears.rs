//! Gears and splines: involute spur and helical gear geometry, gear
//! measurement (span over k teeth, over pins or balls, chordal tooth
//! thickness), gear trains (simple, compound, planetary by Willis' formula),
//! involute spline basic dimensions (ANSI B92.1 and ISO 4156 flat root side
//! fit) and worm gearing basics.
//!
//! Lengths are in any one unit: give the module in that unit. For inch gears
//! use m = 1 / P (P = diametral pitch, teeth per inch of pitch diameter); the
//! caller converts. Angles are in degrees at the API.
//!
//! Sources and the worked examples the tests use are listed in
//! docs/sources.md (section "Gears and splines") and docs/gears.md.

use std::f64::consts::PI;

fn rad(d: f64) -> f64 { d * PI / 180.0 }
fn deg(r: f64) -> f64 { r * 180.0 / PI }
fn inv_r(a: f64) -> f64 { a.tan() - a }

/// Involute function of an angle in degrees: inv a = tan a - a (a in radians).
pub fn involute(alpha_deg: f64) -> f64 { inv_r(rad(alpha_deg)) }

/// Angle in degrees whose involute is `inv` (inverse involute, Newton's
/// method from a start that is good for the whole range 0 < a < 90 deg).
pub fn inv_angle_deg(inv: f64) -> f64 { deg(inv_angle_r(inv)) }

fn inv_angle_r(inv: f64) -> f64 {
    if !(inv >= 0.0) || !inv.is_finite() { return f64::NAN; }
    if inv == 0.0 { return 0.0; }
    // Start: a = (3 inv)^(1/3) is the small-angle form; cap below 90 deg.
    let mut a = (3.0 * inv).cbrt().min(1.5);
    for _ in 0..60 {
        let f = inv_r(a) - inv;
        let t = a.tan();
        let df = t * t; // d/da (tan a - a) = tan^2 a
        let step = f / df;
        let mut next = a - step;
        if next <= 0.0 { next = a / 2.0; }
        if next >= PI / 2.0 { next = (a + PI / 2.0) / 2.0; }
        if (next - a).abs() < 1e-15 { a = next; break; }
        a = next;
    }
    a
}

// ---------------------------------------------------------------------------
// Spur gears (ISO 53 / AGMA full-depth basic rack, addendum ha* m, dedendum hf* m)

/// One external spur gear. `ha_k`, `hf_k`: addendum and dedendum of the basic
/// rack as multiples of the module (1.0 and 1.25 for ISO 53 and AGMA full
/// depth). `x` is the profile shift coefficient.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Spur {
    pub d: f64, pub db: f64, pub da: f64, pub df: f64,
    pub ha: f64, pub hf: f64, pub h: f64,
    pub p: f64, pub pb: f64,
    /// Tooth thickness and space width on the reference circle (arc).
    pub s: f64, pub e: f64,
    /// Smallest tooth count without undercut (x = 0) and smallest x for this z.
    pub z_min: f64, pub x_min: f64,
    /// Tooth thickness (arc) at the tip circle.
    pub sa: f64,
}

pub fn spur(m: f64, z: f64, alpha_deg: f64, x: f64, ha_k: f64, hf_k: f64) -> Spur {
    let a = rad(alpha_deg);
    let d = m * z;
    let db = d * a.cos();
    let ha = m * (ha_k + x);
    let hf = m * (hf_k - x);
    let da = d + 2.0 * ha;
    let df = d - 2.0 * hf;
    let p = PI * m;
    let s = m * (PI / 2.0 + 2.0 * x * a.tan());
    let sa = thickness_at(d, s, alpha_deg, da);
    Spur {
        d, db, da, df, ha, hf, h: ha + hf, p, pb: p * a.cos(), s, e: p - s,
        z_min: 2.0 * ha_k / a.sin().powi(2), x_min: ha_k - z * a.sin().powi(2) / 2.0, sa,
    }
}

/// Arc tooth thickness at diameter `dy` from the thickness `s` at reference
/// diameter `d`: s_y = d_y (s / d + inv a - inv a_y), cos a_y = d_b / d_y.
pub fn thickness_at(d: f64, s: f64, alpha_deg: f64, dy: f64) -> f64 {
    let db = d * rad(alpha_deg).cos();
    if !(dy >= db) { return f64::NAN; }
    let ay = (db / dy).acos();
    dy * (s / d + involute(alpha_deg) - inv_r(ay))
}

/// A pair of external spur gears with profile shift, standard clearance kept
/// by shortening the tips (the method of the KHK technical reference):
/// inv a_w = 2 tan a (x1 + x2) / (z1 + z2) + inv a;
/// y = (z1 + z2) / 2 (cos a / cos a_w - 1); a = ((z1 + z2) / 2 + y) m;
/// ha1 = (ha* + y - x2) m, ha2 = (ha* + y - x1) m; h = (ha* + hf* + y - x1 - x2) m.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SpurPair {
    pub inv_w: f64, pub alpha_w: f64, pub y: f64,
    pub a0: f64, pub a: f64,
    pub dw1: f64, pub dw2: f64,
    pub ha1: f64, pub ha2: f64, pub h: f64,
    pub da1: f64, pub da2: f64, pub df1: f64, pub df2: f64,
    /// Transverse contact ratio with these tip diameters.
    pub eps: f64,
}

pub fn spur_pair(m: f64, z1: f64, z2: f64, alpha_deg: f64, x1: f64, x2: f64, ha_k: f64, hf_k: f64) -> SpurPair {
    let a = rad(alpha_deg);
    let inv_w = 2.0 * a.tan() * (x1 + x2) / (z1 + z2) + inv_r(a);
    let aw = inv_angle_r(inv_w);
    let zs = (z1 + z2) / 2.0;
    let y = zs * (a.cos() / aw.cos() - 1.0);
    let cd = (zs + y) * m;
    let (d1, d2) = (m * z1, m * z2);
    let (db1, db2) = (d1 * a.cos(), d2 * a.cos());
    let ha1 = (ha_k + y - x2) * m;
    let ha2 = (ha_k + y - x1) * m;
    let h = (ha_k + hf_k + y - x1 - x2) * m;
    let (da1, da2) = (d1 + 2.0 * ha1, d2 + 2.0 * ha2);
    let eps = contact_ratio(da1, db1, da2, db2, cd, deg(aw), PI * m * a.cos());
    SpurPair {
        inv_w, alpha_w: deg(aw), y, a0: zs * m, a: cd,
        dw1: db1 / aw.cos(), dw2: db2 / aw.cos(), ha1, ha2, h, da1, da2,
        df1: da1 - 2.0 * h, df2: da2 - 2.0 * h, eps,
    }
}

/// Transverse contact ratio of an external pair:
/// eps = [sqrt(ra1^2 - rb1^2) + sqrt(ra2^2 - rb2^2) - a sin a_w] / p_b.
pub fn contact_ratio(da1: f64, db1: f64, da2: f64, db2: f64, a: f64, alpha_w_deg: f64, pb: f64) -> f64 {
    let g1 = ((da1 / 2.0).powi(2) - (db1 / 2.0).powi(2)).sqrt();
    let g2 = ((da2 / 2.0).powi(2) - (db2 / 2.0).powi(2)).sqrt();
    (g1 + g2 - a * rad(alpha_w_deg).sin()) / pb
}

/// Profile shift sum for a wanted centre distance `a` (inverse of
/// `spur_pair`): cos a_w = a0 cos a / a; x1 + x2 = (z1 + z2)(inv a_w - inv a) / (2 tan a).
pub fn shift_sum_for_centre(m: f64, z1: f64, z2: f64, alpha_deg: f64, a: f64) -> f64 {
    let al = rad(alpha_deg);
    let a0 = m * (z1 + z2) / 2.0;
    let c = a0 * al.cos() / a;
    if !(c.abs() <= 1.0) { return f64::NAN; }
    let aw = c.acos();
    (z1 + z2) * (inv_r(aw) - inv_r(al)) / (2.0 * al.tan())
}

// ---------------------------------------------------------------------------
// Helical gears (normal system: mn, alpha_n, xn given in the normal plane)

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Helical {
    pub mt: f64, pub alpha_t: f64, pub d: f64, pub db: f64, pub da: f64, pub df: f64,
    pub beta_b: f64, pub lead: f64, pub px: f64, pub pn: f64, pub pt: f64, pub zv: f64,
}

/// m_t = m_n / cos b; tan a_t = tan a_n / cos b; d = z m_t; d_b = d cos a_t;
/// da = d + 2 (ha* + xn) mn; df = d - 2 (hf* - xn) mn; tan b_b = tan b cos a_t;
/// lead = pi d / tan b; axial pitch px = pi mn / sin b; zv = z / cos^3 b.
pub fn helical(mn: f64, z: f64, alpha_n_deg: f64, beta_deg: f64, xn: f64, ha_k: f64, hf_k: f64) -> Helical {
    let b = rad(beta_deg);
    let mt = mn / b.cos();
    let at = (rad(alpha_n_deg).tan() / b.cos()).atan();
    let d = z * mt;
    let bb = (b.tan() * at.cos()).atan();
    Helical {
        mt, alpha_t: deg(at), d, db: d * at.cos(),
        da: d + 2.0 * (ha_k + xn) * mn, df: d - 2.0 * (hf_k - xn) * mn,
        beta_b: deg(bb), lead: if b.sin().abs() > 1e-12 { PI * d / b.tan() } else { f64::INFINITY },
        px: if b.sin().abs() > 1e-12 { PI * mn / b.sin() } else { f64::INFINITY },
        pn: PI * mn, pt: PI * mt, zv: z / b.cos().powi(3),
    }
}

/// Centre distance of a parallel helical pair with normal profile shifts
/// (transverse plane method): inv a_wt = 2 tan a_n (xn1 + xn2) / (z1 + z2) + inv a_t;
/// a = (z1 + z2) m_t / 2 * cos a_t / cos a_wt. Returns (a, a_wt in degrees, y).
pub fn helical_centre(mn: f64, z1: f64, z2: f64, alpha_n_deg: f64, beta_deg: f64, xn1: f64, xn2: f64) -> (f64, f64, f64) {
    let b = rad(beta_deg);
    let an = rad(alpha_n_deg);
    let at = (an.tan() / b.cos()).atan();
    let inv_wt = 2.0 * an.tan() * (xn1 + xn2) / (z1 + z2) + inv_r(at);
    let awt = inv_angle_r(inv_wt);
    let zs = (z1 + z2) / (2.0 * b.cos());
    let y = zs * (at.cos() / awt.cos() - 1.0);
    ((zs + y) * mn, deg(awt), y)
}

/// Overlap (face) contact ratio eps_b = b sin(beta) / (pi m_n).
pub fn overlap_ratio(face: f64, mn: f64, beta_deg: f64) -> f64 { face * rad(beta_deg).sin() / (PI * mn) }

// ---------------------------------------------------------------------------
// Span measurement (base tangent length) over k teeth, ISO 21771 / DIN 3960 form

/// Base tangent length over `k` teeth, external spur or helical gear
/// (beta = 0 for spur), measured in the normal plane:
/// W = m_n cos a_n [pi (k - 0.5) + z inv a_t] + 2 x_n m_n sin a_n.
pub fn span_w(mn: f64, z: f64, alpha_n_deg: f64, beta_deg: f64, xn: f64, k: f64) -> f64 {
    let an = rad(alpha_n_deg);
    let at = (an.tan() / rad(beta_deg).cos()).atan();
    mn * an.cos() * (PI * (k - 0.5) + z * inv_r(at)) + 2.0 * xn * mn * an.sin()
}

/// Number of teeth to span so that the anvils touch the flanks near the
/// circle d + 2 x_n m_n (rounded to the nearest whole number, at least 1).
/// Unrounded value: k' = [ (W' - 2 x_n m_n sin a_n) / (m_n cos a_n) - z inv a_t ] / pi + 0.5,
/// W' = 2 sqrt(r_x^2 - r_b^2) / cos b_b, r_x = d / 2 + x_n m_n. For a spur gear this is
/// k' = (z / pi)(tan a_x - inv a - 2 x tan a / z) + 0.5, cos a_x = d_b / (d + 2 x m).
pub fn span_k_exact(z: f64, alpha_n_deg: f64, beta_deg: f64, xn: f64) -> f64 {
    let mn = 1.0;
    let g = helical(mn, z, alpha_n_deg, beta_deg, xn, 1.0, 1.25);
    let rb = g.db / 2.0;
    let rx = g.d / 2.0 + xn * mn;
    if !(rx > rb) { return f64::NAN; }
    let an = rad(alpha_n_deg);
    let w = 2.0 * (rx * rx - rb * rb).sqrt() / rad(g.beta_b).cos();
    ((w - 2.0 * xn * mn * an.sin()) / (mn * an.cos()) - z * inv_r(rad(g.alpha_t))) / PI + 0.5
}

pub fn span_k(z: f64, alpha_n_deg: f64, beta_deg: f64, xn: f64) -> f64 {
    let k = span_k_exact(z, alpha_n_deg, beta_deg, xn);
    if !k.is_finite() { return f64::NAN; }
    k.round().max(1.0)
}

/// Smallest face width for a helical span measurement: b = W sin b_b (no margin).
pub fn span_min_face(w: f64, beta_b_deg: f64) -> f64 { w * rad(beta_b_deg).sin() }

// ---------------------------------------------------------------------------
// Measurement over pins or balls (external) and between pins (internal)

/// Pin roll angle for an external gear from the transverse tooth thickness
/// `s` at reference diameter `d`: inv phi = s / d + inv a_t + d_p / d_b - pi / z.
/// Measurement: M = d_b / cos phi + d_p (even z), d_b cos(90 / z) / cos phi + d_p (odd z).
/// For a helical gear give transverse values (a_t, d, s_t) and d_b; the ball
/// diameter d_p is used as for the transverse section, which is the usual form
/// (dp / cos b_b is NOT applied: pass d_p / cos(b_b) if your source does).
pub fn over_pins_ext(z: f64, d: f64, alpha_t_deg: f64, s: f64, dp: f64) -> f64 {
    let db = d * rad(alpha_t_deg).cos();
    let invf = s / d + involute(alpha_t_deg) + dp / db - PI / z;
    let f = inv_angle_r(invf);
    let odd = (z.round() as i64) % 2 != 0;
    let k = if odd { (PI / (2.0 * z)).cos() } else { 1.0 };
    db * k / f.cos() + dp
}

/// Between pins of an internal gear from the space width `e` at reference
/// diameter `d`: inv phi = e / d + inv a - d_p / d_b; M = d_b / cos phi - d_p
/// (even z), d_b cos(90 / z) / cos phi - d_p (odd z).
pub fn between_pins_int(z: f64, d: f64, alpha_deg: f64, e: f64, dp: f64) -> f64 {
    let db = d * rad(alpha_deg).cos();
    let invf = e / d + involute(alpha_deg) - dp / db;
    let f = inv_angle_r(invf);
    let odd = (z.round() as i64) % 2 != 0;
    let k = if odd { (PI / (2.0 * z)).cos() } else { 1.0 };
    db * k / f.cos() - dp
}

/// Pin diameter that touches an external gear's flanks on the circle d + 2 x m
/// (the usual "ideal" pin): psi = pi / (2z) - inv a - 2 x tan a / z;
/// cos a_x = d_b / (d + 2 x m); phi = tan a_x + psi; d_p = z m cos a (inv phi + psi).
pub fn ideal_pin_ext(m: f64, z: f64, alpha_deg: f64, x: f64) -> f64 {
    let a = rad(alpha_deg);
    let d = m * z;
    let db = d * a.cos();
    let c = db / (d + 2.0 * x * m);
    if !(c > 0.0 && c < 1.0) { return f64::NAN; }
    let psi = PI / (2.0 * z) - inv_r(a) - 2.0 * x * a.tan() / z;
    let phi = c.acos().tan() + psi;
    db * (inv_r(phi) + psi)
}

/// Pin diameter for an internal gear touching on the circle d + 2 x m:
/// psi = pi / (2z) + inv a + 2 x tan a / z; phi = tan a_x - psi; d_p = z m cos a (psi - inv phi).
pub fn ideal_pin_int(m: f64, z: f64, alpha_deg: f64, x: f64) -> f64 {
    let a = rad(alpha_deg);
    let d = m * z;
    let db = d * a.cos();
    let c = db / (d + 2.0 * x * m);
    if !(c > 0.0 && c < 1.0) { return f64::NAN; }
    let psi = PI / (2.0 * z) + inv_r(a) + 2.0 * x * a.tan() / z;
    let phi = c.acos().tan() - psi;
    if !(phi > 0.0) { return f64::NAN; }
    db * (psi - inv_r(phi))
}

/// Diameter of the circle where a pin or ball touches the flanks, for a pin
/// whose centre lies on the circle of diameter `dc` (`dc = M - dp` for an even
/// external gear, `M + dp` internal). External: tan a_c = tan phi - dp / d_b;
/// internal: tan a_c = tan phi + dp / d_b; with cos phi = d_b / dc; result d_b / cos a_c.
/// For a helical gear give the transverse base diameter and d_p / cos b_b.
pub fn pin_contact_dia(db: f64, dc: f64, dp: f64, internal: bool) -> f64 {
    if !(dc >= db) { return f64::NAN; }
    let f = (db / dc).acos();
    let t = if internal { f.tan() + dp / db } else { f.tan() - dp / db };
    if !(t >= 0.0) { return f64::NAN; }
    db / t.atan().cos()
}

/// Diameter where the anvils of a span measurement touch the flanks:
/// d = 2 sqrt(r_b^2 + (W cos b_b / 2)^2), r_b the transverse base radius.
pub fn span_contact_dia(db: f64, w: f64, beta_b_deg: f64) -> f64 {
    2.0 * ((db / 2.0).powi(2) + (w * rad(beta_b_deg).cos() / 2.0).powi(2)).sqrt()
}

/// Over pins of a standard (x) external spur gear.
pub fn mop_spur(m: f64, z: f64, alpha_deg: f64, x: f64, dp: f64) -> f64 {
    let s = m * (PI / 2.0 + 2.0 * x * rad(alpha_deg).tan());
    over_pins_ext(z, m * z, alpha_deg, s, dp)
}

/// Between pins of an internal spur gear with profile shift x (space width
/// e = m (pi / 2 + 2 x tan a), the sign convention of the KHK reference).
pub fn mbp_internal(m: f64, z: f64, alpha_deg: f64, x: f64, dp: f64) -> f64 {
    let e = m * (PI / 2.0 + 2.0 * x * rad(alpha_deg).tan());
    between_pins_int(z, m * z, alpha_deg, e, dp)
}

/// Over balls (external) or between balls (internal) of a spur or helical
/// gear in the normal system. Transverse tooth thickness (external) or space
/// width (internal) at the reference circle s_t = m_t (pi / 2 + 2 x_n tan a_n);
/// external inv phi = s_t / d + inv a_t + d_p / (z m_n cos a_n) - pi / z,
/// internal inv phi = s_t / d + inv a_t - d_p / (z m_n cos a_n) (z m_n cos a_n = d_b cos b_b);
/// M = d_b / cos phi (x cos(90 / z) for odd z) +/- d_p.
/// `dp` <= 0 or NaN uses the ideal size (spur formula on the virtual tooth
/// count z_v = z / cos^3 b with m_n and a_n, as the KHK reference does).
/// Returns [M, d_p used, ideal d_p, ball centre circle, contact diameter (spur only), phi deg].
#[allow(clippy::too_many_arguments)]
pub fn gear_measure(mn: f64, z: f64, alpha_n_deg: f64, beta_deg: f64, xn: f64, dp: f64, internal: bool) -> [f64; 6] {
    let g = helical(mn, z, alpha_n_deg, beta_deg, xn, 1.0, 1.25);
    let ideal = if internal { ideal_pin_int(mn, g.zv, alpha_n_deg, xn) } else { ideal_pin_ext(mn, g.zv, alpha_n_deg, xn) };
    let dp = if dp > 0.0 { dp } else { ideal };
    let st = g.mt * (PI / 2.0 + 2.0 * xn * rad(alpha_n_deg).tan());
    let q = dp / (z * mn * rad(alpha_n_deg).cos());
    let invf = if internal { st / g.d + involute(g.alpha_t) - q } else { st / g.d + involute(g.alpha_t) + q - PI / z };
    let f = inv_angle_r(invf);
    let odd = (z.round() as i64) % 2 != 0;
    let k = if odd { (PI / (2.0 * z)).cos() } else { 1.0 };
    let dc = g.db / f.cos();
    let m = if internal { dc * k - dp } else { dc * k + dp };
    let contact = if beta_deg == 0.0 { pin_contact_dia(g.db, dc, dp, internal) } else { f64::NAN };
    [m, dp, ideal, dc, contact, deg(f)]
}

// ---------------------------------------------------------------------------
// Chordal tooth thickness and chordal addendum (gear tooth caliper)

/// Chordal thickness and chordal addendum at the reference circle of a spur
/// gear (helical: give m_n and the virtual tooth count z_v = z / cos^3 b):
/// psi = pi / (2z) + 2 x tan a / z; s_c = z m sin psi; h_c = h_a + (z m / 2)(1 - cos psi),
/// with h_a the addendum measured from the actual tip. Returns (s_c, h_c).
pub fn chordal(m: f64, z: f64, alpha_deg: f64, x: f64, ha: f64) -> (f64, f64) {
    let psi = PI / (2.0 * z) + 2.0 * x * rad(alpha_deg).tan() / z;
    (z * m * psi.sin(), ha + z * m / 2.0 * (1.0 - psi.cos()))
}

/// Chordal thickness and height at any diameter `dy` from the arc thickness s_y
/// there: half angle psi_y = s_y / d_y; s_c = d_y sin psi_y; h_c = (da - d_y cos psi_y) / 2.
pub fn chordal_at(dy: f64, sy: f64, da: f64) -> (f64, f64) {
    let psi = sy / dy;
    (dy * psi.sin(), (da - dy * psi.cos()) / 2.0)
}

// ---------------------------------------------------------------------------
// Involute tooth outline for drawing

/// Points (x, y) of one tooth of an external gear, symmetric about the y axis,
/// from the root circle to the tip and back: the flanks are the true involute
/// from the base circle (or the root circle if larger) to the tip circle; below
/// the base circle the flank is drawn as a radial line to the root circle (a
/// drawing simplification: the real fillet depends on the cutting tool).
/// `n` points per flank. Returned flat as x0, y0, x1, y1, ...
pub fn tooth_outline(d: f64, db: f64, da: f64, df: f64, s: f64, n: usize) -> Vec<f64> {
    let n = n.clamp(4, 200);
    let rb = db / 2.0;
    let ra = da / 2.0;
    let rf = df / 2.0;
    let alpha = (db / d).acos();
    // Half angle of the tooth at the base circle (polar angle of the flank start).
    let half_b = s / d + inv_r(alpha);
    let r0 = rb.max(rf);
    let mut right: Vec<(f64, f64)> = Vec::new();
    for i in 0..=n {
        let ry = r0 + (ra - r0) * i as f64 / n as f64;
        let ay = (rb / ry).min(1.0).acos();
        let th = half_b - inv_r(ay); // polar angle from the tooth centre line
        right.push((ry * th.sin(), ry * th.cos()));
    }
    let mut out = Vec::new();
    // Left flank from root to tip (mirror), then tip arc, then right flank down.
    if rf < rb {
        out.push(-(rf * half_b.sin())); out.push(rf * half_b.cos());
    }
    for &(x, y) in right.iter() { out.push(-x); out.push(y); }
    let tip_half = right.last().map(|p| p.0.atan2(p.1)).unwrap_or(0.0);
    for i in 1..8 {
        let t = -tip_half + 2.0 * tip_half * i as f64 / 8.0;
        out.push(ra * t.sin()); out.push(ra * t.cos());
    }
    for &(x, y) in right.iter().rev() { out.push(x); out.push(y); }
    if rf < rb {
        out.push(rf * half_b.sin()); out.push(rf * half_b.cos());
    }
    out
}

// ---------------------------------------------------------------------------
// Gear trains

/// Ratio of a train of meshing pairs: product of (driven teeth / driver teeth).
/// `pairs` = [driver1, driven1, driver2, driven2, ...]; idlers cancel, so give
/// each meshing pair once. Output speed = input speed / ratio. The sign
/// (direction) of an external train is (-1)^pairs; the caller tracks idlers.
pub fn train_ratio(pairs: &[f64]) -> f64 {
    if pairs.len() < 2 || pairs.len() % 2 != 0 { return f64::NAN; }
    pairs.chunks(2).map(|c| c[1] / c[0]).product()
}

/// Willis' formula for a simple planetary set (sun, ring, carrier):
/// (n_s - n_c) / (n_r - n_c) = -z_r / z_s. Give two of the three speeds and
/// NaN for the one to solve; returns the missing speed.
pub fn willis(zs: f64, zr: f64, ns: f64, nr: f64, nc: f64) -> f64 {
    let k = zr / zs;
    // n_s + k n_r - (1 + k) n_c = 0
    if ns.is_nan() { (1.0 + k) * nc - k * nr }
    else if nr.is_nan() { ((1.0 + k) * nc - ns) / k }
    else if nc.is_nan() { (ns + k * nr) / (1.0 + k) }
    else { f64::NAN }
}

/// Direction of the output of a train of `n_ext` external meshes (idlers
/// included): +1 same as the input, -1 opposite: (-1)^n_ext.
pub fn train_sign(n_ext: f64) -> f64 { if (n_ext.round() as i64) % 2 == 0 { 1.0 } else { -1.0 } }

/// Planet tooth count for a standard (unshifted) planetary set: z_p = (z_r - z_s) / 2.
pub fn planet_teeth(zs: f64, zr: f64) -> f64 { (zr - zs) / 2.0 }

/// Equal spacing check for n planets: (z_s + z_r) / n must be a whole number.
pub fn planets_assemble(zs: f64, zr: f64, n: f64) -> bool {
    let q = (zs + zr) / n;
    n >= 1.0 && (q - q.round()).abs() < 1e-9
}

// ---------------------------------------------------------------------------
// Involute splines, flat root side fit (basic dimensions)

/// Basic dimensions of an involute spline. `m` is the module (ISO 4156) or
/// 1 / P (ANSI B92.1, P = the first number of the pitch fraction). Major and
/// minor diameters use factors c for d = m (z + c):
/// returns (D, D_b, p, s = e, D_ee (major ext), D_ii (minor int), D_ei (major int), D_ie (minor ext)).
pub fn spline_basic(m: f64, z: f64, alpha_deg: f64, c_ee: f64, c_ii: f64, c_ei: f64, c_ie: f64) -> [f64; 8] {
    let d = m * z;
    [d, d * rad(alpha_deg).cos(), PI * m, PI * m / 2.0, m * (z + c_ee), m * (z + c_ii), m * (z + c_ei), m * (z + c_ie)]
}

/// Diameter factors c (d = m (z + c)) for 30 deg flat root side fit splines,
/// in the order (major external, minor internal, major internal, minor external).
/// `std` 1 = ANSI B92.1 (m = 1 / P): Do = (N + 1)/P, Di = (N - 1)/P,
/// Dri = (N + 1.35)/P, Dre = (N - 1.35)/P (Engineers Edge, table of basic formulas).
/// `std` 2 = ISO 4156: Dee max = m (z + 1), Dei min = m (z + 1.5), Die max = m (z - 1.5)
/// (ISO 4156:1981 table 2, read in the publisher's free preview); the
/// internal minor diameter Dii is not given as a plain factor there (NaN).
/// Basic values only: the standards apply tolerances and deviations to these.
pub fn spline_factors(std: u32) -> [f64; 4] {
    match std {
        1 => [1.0, -1.0, 1.35, -1.35],
        2 => [1.0, f64::NAN, 1.5, -1.5],
        _ => [f64::NAN; 4],
    }
}

/// Spline basic dimensions for a standard (see `spline_factors`), pressure angle 30 deg.
/// which 0 D, 1 Db, 2 p, 3 s = e, 4 major ext, 5 minor int, 6 major int, 7 minor ext.
pub fn spline_flat(std: u32, m: f64, z: f64, which: u32) -> f64 {
    let c = spline_factors(std);
    spline_basic(m, z, 30.0, c[0], c[1], c[2], c[3]).get(which as usize).copied().unwrap_or(f64::NAN)
}

// ---------------------------------------------------------------------------
// Worm gearing basics (axial module m_x of the worm = transverse module of the wheel)

/// Worm and wheel: lead L = z1 pi m_x, lead angle tan g = z1 m_x / d1,
/// ratio = z2 / z1, centre distance a = (d1 + z2 m_x) / 2, normal module m_n = m_x cos g.
/// Returns (lead, lead angle deg, ratio, centre distance, wheel pitch dia, normal module, axial pitch).
pub fn worm(mx: f64, z1: f64, z2: f64, d1: f64) -> [f64; 7] {
    let g = (z1 * mx / d1).atan();
    let d2 = z2 * mx;
    [z1 * PI * mx, deg(g), z2 / z1, (d1 + d2) / 2.0, d2, mx * g.cos(), PI * mx]
}

// ---------------------------------------------------------------------------
// Flat wrappers for the WebAssembly interface

pub fn spur_flat(m: f64, z: f64, alpha: f64, x: f64, ha_k: f64, hf_k: f64, which: u32) -> f64 {
    let g = spur(m, z, alpha, x, ha_k, hf_k);
    [g.d, g.db, g.da, g.df, g.ha, g.hf, g.h, g.p, g.pb, g.s, g.e, g.z_min, g.x_min, g.sa]
        .get(which as usize).copied().unwrap_or(f64::NAN)
}

#[allow(clippy::too_many_arguments)]
pub fn spur_pair_flat(m: f64, z1: f64, z2: f64, alpha: f64, x1: f64, x2: f64, ha_k: f64, hf_k: f64, which: u32) -> f64 {
    let p = spur_pair(m, z1, z2, alpha, x1, x2, ha_k, hf_k);
    [p.inv_w, p.alpha_w, p.y, p.a0, p.a, p.dw1, p.dw2, p.ha1, p.ha2, p.h, p.da1, p.da2, p.df1, p.df2, p.eps]
        .get(which as usize).copied().unwrap_or(f64::NAN)
}

pub fn helical_flat(mn: f64, z: f64, alpha_n: f64, beta: f64, xn: f64, ha_k: f64, hf_k: f64, which: u32) -> f64 {
    let g = helical(mn, z, alpha_n, beta, xn, ha_k, hf_k);
    [g.mt, g.alpha_t, g.d, g.db, g.da, g.df, g.beta_b, g.lead, g.px, g.pn, g.pt, g.zv]
        .get(which as usize).copied().unwrap_or(f64::NAN)
}

/// Parallel helical pair with normal shifts, tips shortened to keep the
/// standard clearance (as `spur_pair`, in the normal module):
/// ha1 = (ha* + y - xn2) mn, ha2 = (ha* + y - xn1) mn, h = (ha* + hf* + y - xn1 - xn2) mn.
/// Returns [a, a_wt, y, da1, da2, df1, df2, eps_alpha (transverse), a0].
#[allow(clippy::too_many_arguments)]
pub fn helical_pair(mn: f64, z1: f64, z2: f64, alpha_n: f64, beta: f64, xn1: f64, xn2: f64, ha_k: f64, hf_k: f64) -> [f64; 9] {
    let (a, awt, y) = helical_centre(mn, z1, z2, alpha_n, beta, xn1, xn2);
    let g1 = helical(mn, z1, alpha_n, beta, xn1, ha_k, hf_k);
    let g2 = helical(mn, z2, alpha_n, beta, xn2, ha_k, hf_k);
    let da1 = g1.d + 2.0 * (ha_k + y - xn2) * mn;
    let da2 = g2.d + 2.0 * (ha_k + y - xn1) * mn;
    let h = (ha_k + hf_k + y - xn1 - xn2) * mn;
    let pbt = PI * g1.mt * rad(g1.alpha_t).cos();
    let eps = contact_ratio(da1, g1.db, da2, g2.db, a, awt, pbt);
    [a, awt, y, da1, da2, da1 - 2.0 * h, da2 - 2.0 * h, eps, (g1.d + g2.d) / 2.0]
}

/// Everything the gear measurement screen shows, in one call.
/// which: 0 M, 1 d_p used, 2 ideal d_p, 3 pin centre circle, 4 contact dia (spur),
/// 5 phi deg, 6 k used, 7 W, 8 span contact dia, 9 k unrounded, 10 face width
/// needed for W (helical), 11 chordal thickness, 12 chordal height, 13 z_v, 14 tip dia.
/// `k_in` <= 0 or NaN picks k; span and chordal values are external only (NaN internal).
#[allow(clippy::too_many_arguments)]
pub fn gear_measure_flat(mn: f64, z: f64, alpha_n: f64, beta: f64, xn: f64, dp: f64, internal: bool, k_in: f64, ha_k: f64, which: u32) -> f64 {
    if !(mn > 0.0 && z >= 3.0 && alpha_n > 0.0 && alpha_n < 60.0 && beta.abs() < 60.0) { return f64::NAN; }
    let w = which as usize;
    if w <= 5 { return gear_measure(mn, z, alpha_n, beta, xn, dp, internal)[w]; }
    if internal { return f64::NAN; }
    let g = helical(mn, z, alpha_n, beta, xn, ha_k, 1.25);
    let k = if k_in >= 1.0 { k_in.round() } else { span_k(z, alpha_n, beta, xn) };
    let wl = span_w(mn, z, alpha_n, beta, xn, k);
    let (sc, hc) = chordal(mn, g.zv, alpha_n, xn, mn * (ha_k + xn));
    match w {
        6 => k, 7 => wl, 8 => span_contact_dia(g.db, wl, g.beta_b), 9 => span_k_exact(z, alpha_n, beta, xn),
        10 => span_min_face(wl, g.beta_b), 11 => sc, 12 => hc, 13 => g.zv, 14 => g.da,
        _ => f64::NAN,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn helical_pair_flat(mn: f64, z1: f64, z2: f64, alpha_n: f64, beta: f64, xn1: f64, xn2: f64, ha_k: f64, hf_k: f64, which: u32) -> f64 {
    helical_pair(mn, z1, z2, alpha_n, beta, xn1, xn2, ha_k, hf_k).get(which as usize).copied().unwrap_or(f64::NAN)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    #[test]
    fn involute_and_inverse() {
        close(involute(20.0), 0.014_904_4, 1e-7);
        close(involute(14.5), 0.005_544_8, 1e-7);
        for a in [1.0, 14.5, 20.0, 26.0886, 45.0, 70.0, 85.0] { close(inv_angle_deg(involute(a)), a, 1e-9); }
    }
}
