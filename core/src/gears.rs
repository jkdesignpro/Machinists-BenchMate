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
// One tooth space with its measuring pin, for drawing

/// One tooth space of an involute spline or spur gear, with the measuring
/// pin that sits in it. See [`space_view`].
#[derive(Clone, Debug, PartialEq)]
pub struct SpaceView {
    /// Profile from the middle of one tooth, down the flank, across the root,
    /// up the next flank to the middle of the next tooth. The space is centred
    /// on the +y axis; the part centre is the origin.
    pub outline: Vec<(f64, f64)>,
    /// Radius of the pin centre (on the +y axis); NaN without a pin.
    pub pin_centre_r: f64,
    /// Radius of the circle where the pin touches the two flanks.
    pub contact_r: f64,
    /// The contact point on the right-hand flank (the other is its mirror image).
    pub contact: (f64, f64),
    /// What is wrong with this pin, added up: 1 it does not touch the involute
    /// part of the flanks (it rides on the tooth corners or sits below the
    /// flank), 2 it touches the root before the flanks, 4 it does not stand
    /// proud of the teeth, so the measuring faces would touch the teeth first.
    pub flags: u32,
}

/// Tooth space and pin from the dimensions the calculators give.
/// `internal` false: an external part, `t` is the tooth thickness on the
/// reference circle `d`, the space is what is left of the pitch;
/// true: an internal part, `t` is the space width on `d`.
/// `d_tip` and `d_root` are the tip and root circles of that part (external:
/// major and minor; internal: minor and major). `dp` is the pin diameter
/// (0 = no pin). `n` points per flank.
///
/// Flank: a tooth (or internal space) of thickness t on d has the half angle
/// psi(r) = t / d + inv a - inv a_r at radius r, cos a_r = d_b / (2r). Below
/// the base circle the flank is drawn as a radial line (the real fillet
/// depends on the cutting tool).
/// Pin: external inv phi = t / d + inv a + dp / d_b - pi / z, internal
/// inv phi = t / d + inv a - dp / d_b; the centre is at d_b / (2 cos phi) and
/// the pin touches the flank where the line from the centre, tangent to the
/// base circle, is dp / 2 shorter (external) or longer (internal).
/// `None` when the numbers do not make a tooth space.
#[allow(clippy::too_many_arguments)]
pub fn space_view(internal: bool, z: f64, d: f64, alpha_deg: f64, t: f64, d_tip: f64, d_root: f64, dp: f64, n: usize) -> Option<SpaceView> {
    let ok = |x: f64| x.is_finite() && x > 0.0;
    if !(ok(z) && z >= 3.0 && ok(d) && ok(t) && ok(d_tip) && ok(d_root) && alpha_deg > 0.0 && alpha_deg < 90.0 && dp >= 0.0 && dp.is_finite()) { return None; }
    if (internal && d_root <= d_tip) || (!internal && d_root >= d_tip) { return None; }
    let n = n.clamp(4, 400);
    let a = rad(alpha_deg);
    let rb = d * a.cos() / 2.0;
    let (rt, rr) = (d_tip / 2.0, d_root / 2.0);
    let half_pitch = PI / z;
    // Half angle of the tooth (external) or space (internal) at radius r.
    let psi = |r: f64| t / d + inv_r(a) - inv_r((rb / r.max(rb)).min(1.0).acos());
    // Half angle of the space at radius r.
    let gap = |r: f64| if internal { psi(r) } else { half_pitch - psi(r) };
    // The space must be open at the root and the teeth must have a land at the tip.
    if !(gap(rr) > 0.0 && gap(rt) > 0.0 && gap(rr) < half_pitch && gap(rt) < half_pitch) { return None; }
    let mut radii: Vec<f64> = (0..=n).map(|i| rt + (rr - rt) * i as f64 / n as f64).collect();
    // The reference circle and the base circle are on the profile exactly, when they cross it.
    for extra in [d / 2.0, rb] {
        if (extra - rt) * (extra - rr) < 0.0 { radii.push(extra); }
    }
    radii.sort_by(|p, q| if internal { p.partial_cmp(q).unwrap() } else { q.partial_cmp(p).unwrap() });
    radii.dedup_by(|p, q| (*p - *q).abs() < 1e-12 * d);
    let at = |r: f64, th: f64| (r * th.sin(), r * th.cos());
    let mut outline = Vec::with_capacity(2 * radii.len() + 16);
    let arc = |out: &mut Vec<(f64, f64)>, r: f64, from: f64, to: f64, steps: usize| {
        for i in 0..steps { out.push(at(r, from + (to - from) * i as f64 / steps as f64)); }
    };
    arc(&mut outline, rt, -half_pitch, -gap(rt), 4);
    for &r in &radii { outline.push(at(r, -gap(r))); }
    arc(&mut outline, rr, -gap(rr), gap(rr), 6);
    for &r in radii.iter().rev() { outline.push(at(r, gap(r))); }
    arc(&mut outline, rt, gap(rt), half_pitch, 4);
    outline.push(at(rt, half_pitch));
    let mut v = SpaceView { outline, pin_centre_r: f64::NAN, contact_r: f64::NAN, contact: (f64::NAN, f64::NAN), flags: 0 };
    if dp > 0.0 {
        let invf = if internal { t / d + inv_r(a) - dp / (2.0 * rb) } else { t / d + inv_r(a) + dp / (2.0 * rb) - half_pitch };
        let f = inv_angle_r(invf);
        if !f.is_finite() { v.flags = 1; return Some(v); }
        let rc = rb / f.cos();
        // Along the line from the pin centre, tangent to the base circle: its
        // length is rb tan phi, and the flank is dp / 2 nearer (external) or further (internal).
        let len = rb * f.tan() + if internal { dp / 2.0 } else { -dp / 2.0 };
        v.pin_centre_r = rc;
        let (lo, hi) = if internal { (rt, rr) } else { (rr.max(rb), rt) };
        if len < 0.0 {
            v.flags |= 1;
        } else {
            let cr = rb.hypot(len);
            v.contact_r = cr;
            v.contact = at(cr, gap(cr));
            if cr < lo - 1e-12 * d || cr > hi + 1e-12 * d { v.flags |= 1; }
        }
        if (!internal && rc - dp / 2.0 < rr) || (internal && rc + dp / 2.0 > rr) { v.flags |= 2; }
        if (!internal && rc + dp / 2.0 <= rt) || (internal && rc - dp / 2.0 >= rt) { v.flags |= 4; }
    }
    Some(v)
}

/// [`space_view`] as a flat list: diameter of the circle the pin centre is
/// on, diameter of the circle where the pin touches the flanks, contact x,
/// contact y, flags, number of outline points, then the points x, y.
#[allow(clippy::too_many_arguments)]
pub fn space_view_flat(internal: bool, z: f64, d: f64, alpha_deg: f64, t: f64, d_tip: f64, d_root: f64, dp: f64, n: usize) -> Vec<f64> {
    let Some(v) = space_view(internal, z, d, alpha_deg, t, d_tip, d_root, dp, n) else { return Vec::new() };
    let mut out = vec![2.0 * v.pin_centre_r, 2.0 * v.contact_r, v.contact.0, v.contact.1, v.flags as f64, v.outline.len() as f64];
    for p in &v.outline { out.push(p.0); out.push(p.1); }
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

/// SAE parallel side splines for soft broached holes (SAE J499, issued 1914;
/// the formulas of Machinery's Handbook, 31st ed., Table 22, p. 2360).
/// `n`: 4, 6, 10 or 16 splines. `fit`: 1 = A permanent fit, 2 = B to slide when
/// not under load, 3 = C to slide when under load (not given for 4 splines).
/// `d_nom`: nominal (large) diameter D. `which`: 0 = width W, 1 = depth h,
/// 2 = small diameter d, 3 = torque capacity per unit of bearing length at a
/// pressure of 1000 per unit area on the spline sides, T = 1000 N R h with
/// R = (D + d) / 4 (inch-pounds per inch at 1000 psi when D is in inches).
pub fn sae_spline(n: f64, fit: f64, d_nom: f64, which: f64) -> f64 {
    if !(d_nom.is_finite() && d_nom > 0.0) { return f64::NAN; }
    let col = match n as i64 { 4 => 0, 6 => 1, 10 => 2, 16 => 3, _ => return f64::NAN };
    const W: [f64; 4] = [0.241, 0.250, 0.156, 0.098];
    const H: [[f64; 4]; 3] = [[0.075, 0.050, 0.045, 0.045], [0.125, 0.075, 0.070, 0.070], [f64::NAN, 0.100, 0.095, 0.095]];
    const D: [[f64; 4]; 3] = [[0.850, 0.900, 0.910, 0.910], [0.750, 0.850, 0.860, 0.860], [f64::NAN, 0.800, 0.810, 0.810]];
    let row = match fit as i64 { 1 => 0, 2 => 1, 3 => 2, _ => return f64::NAN };
    let (h, d) = (H[row][col] * d_nom, D[row][col] * d_nom);
    match which as i64 {
        0 => if h.is_nan() { f64::NAN } else { W[col] * d_nom },
        1 => h,
        2 => d,
        3 => 1000.0 * n * ((d_nom + d) / 4.0) * h,
        _ => f64::NAN,
    }
}

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
/// Dri = (N + 1.35)/P, Dre = (N - 1.35)/P (Engineers Edge, table of basic formulas;
/// the Dre factor is stated for 2.5/5 through 12/24 pitch, finer pitches differ).
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
    if !(std == 1 || std == 2) { return f64::NAN; }
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

/// Number of the involute form milling cutter (set of eight) for a gear of `z` teeth.
/// `series` 0: diametral pitch cutters (No. 1 cuts 135 teeth to a rack ... No. 8 cuts 12
/// and 13 teeth); 1: metric module cutters, numbered the other way round (No. 1 cuts 12
/// and 13 teeth ... No. 8 cuts 135 teeth to a rack). NaN under 12 teeth.
pub fn involute_cutter_no(z: f64, series: f64) -> f64 {
    if !(z >= 12.0) || z.fract() != 0.0 { return f64::NAN; }
    let dp = if z >= 135.0 { 1.0 } else if z >= 55.0 { 2.0 } else if z >= 35.0 { 3.0 } else if z >= 26.0 { 4.0 }
        else if z >= 21.0 { 5.0 } else if z >= 17.0 { 6.0 } else if z >= 14.0 { 7.0 } else { 8.0 };
    match series as i32 { 0 => dp, 1 => 9.0 - dp, _ => f64::NAN }
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
        // KHK Table 4.3 / 4.9: inv 26.0886 deg = 0.034316, inv 23.1126 deg = 0.023405.
        close(involute(26.0886), 0.034316, 2e-6);
        close(involute(23.1126), 0.023405, 2e-6);
    }

    /// KHK Gear Technical Reference, Table 4.3 (profile shifted spur gears):
    /// m 3, alpha 20, z 12 / 24, x 0.6 / 0.36. Published: inv aw 0.034316,
    /// aw 26.0886, y 0.83329, a 56.4999, db 33.8289 / 67.6579, dw 37.667 / 75.333,
    /// ha 4.420 / 3.700, h 6.370, da 44.840 / 79.400, df 32.100 / 66.660.
    #[test]
    fn khk_profile_shifted_spur_pair() {
        let p = spur_pair(3.0, 12.0, 24.0, 20.0, 0.6, 0.36, 1.0, 1.25);
        close(p.inv_w, 0.034316, 1e-6);
        close(p.alpha_w, 26.0886, 1e-4);
        close(p.y, 0.83329, 1e-5);
        close(p.a, 56.4999, 1e-4);
        close(p.dw1, 37.667, 1e-3); close(p.dw2, 75.333, 1e-3);
        close(p.ha1, 4.420, 1e-3); close(p.ha2, 3.700, 1e-3); close(p.h, 6.370, 1e-3);
        close(p.da1, 44.840, 1e-3); close(p.da2, 79.400, 1e-3);
        close(p.df1, 32.100, 1e-3); close(p.df2, 66.660, 1e-3);
        let g1 = spur(3.0, 12.0, 20.0, 0.6, 1.0, 1.25);
        let g2 = spur(3.0, 24.0, 20.0, 0.36, 1.0, 1.25);
        close(g1.d, 36.0, 1e-12); close(g2.d, 72.0, 1e-12);
        close(g1.db, 33.8289, 1e-4); close(g2.db, 67.6579, 1e-4);
        // Inverse: the shift sum for that centre distance is x1 + x2 = 0.96.
        close(shift_sum_for_centre(3.0, 12.0, 24.0, 20.0, p.a), 0.96, 1e-9);
    }

    /// Unshifted pair: a = m (z1 + z2) / 2, aw = alpha, y = 0, and the
    /// textbook values z_min = 17.1 (20 deg) and 31.9 (14.5 deg) teeth
    /// (KHK section 4.2, SDP/SI section 4: 2 / sin^2 alpha).
    #[test]
    fn standard_spur_and_undercut() {
        let p = spur_pair(2.0, 20.0, 40.0, 20.0, 0.0, 0.0, 1.0, 1.25);
        close(p.a, 60.0, 1e-9); close(p.alpha_w, 20.0, 1e-9); close(p.y, 0.0, 1e-12);
        let g = spur(2.0, 20.0, 20.0, 0.0, 1.0, 1.25);
        close(g.da, 44.0, 1e-12); close(g.df, 35.0, 1e-12); close(g.h, 4.5, 1e-12);
        close(g.s, PI, 1e-12); close(g.e, PI, 1e-12); close(g.p, 2.0 * PI, 1e-12);
        close(spur(1.0, 20.0, 20.0, 0.0, 1.0, 1.25).z_min, 17.097, 1e-3);
        close(spur(1.0, 20.0, 14.5, 0.0, 1.0, 1.25).z_min, 31.903, 1e-3);
        // x_min for z 10 at 20 deg: 1 - 10 sin^2 20 / 2 = 0.415 (KHK 4.2 form).
        close(spur(1.0, 10.0, 20.0, 0.0, 1.0, 1.25).x_min, 0.41511, 1e-5);
        // Thickness at the reference diameter is s; at the base circle it grows.
        close(thickness_at(40.0, PI, 20.0, 40.0), PI, 1e-12);
        assert!(thickness_at(40.0, PI, 20.0, 40.0 * rad(20.0).cos()) > PI);
        assert!(thickness_at(40.0, PI, 20.0, 30.0).is_nan());
        // Contact ratio of a standard pair is between 1 and 2.
        assert!(p.eps > 1.4 && p.eps < 1.8, "{}", p.eps);
    }

    /// KHK Gear Technical Reference, Table 4.9 (helical gears, normal system):
    /// mn 3, an 20, beta 30, z 12 / 60, xn 0.09809 / 0. Published: at 22.79588,
    /// inv awt 0.023405, awt 23.1126, y 0.09744, d 41.569 / 207.846,
    /// db 38.322 / 191.611, a 125.000, da 48.153 / 213.842, df 34.657 / 200.346.
    #[test]
    fn khk_helical_normal_system() {
        let g1 = helical(3.0, 12.0, 20.0, 30.0, 0.09809, 1.0, 1.25);
        let g2 = helical(3.0, 60.0, 20.0, 30.0, 0.0, 1.0, 1.25);
        close(g1.alpha_t, 22.79588, 1e-5);
        close(g1.d, 41.569, 1e-3); close(g2.d, 207.846, 1e-3);
        close(g1.db, 38.322, 1e-3); close(g2.db, 191.611, 1e-3);
        let (a, awt, y) = helical_centre(3.0, 12.0, 60.0, 20.0, 30.0, 0.09809, 0.0);
        close(a, 125.000, 1e-3); close(awt, 23.1126, 1e-4); close(y, 0.09744, 1e-5);
        let p = helical_pair(3.0, 12.0, 60.0, 20.0, 30.0, 0.09809, 0.0, 1.0, 1.25);
        close(p[3], 48.153, 1e-3); close(p[4], 213.842, 1e-3);
        close(p[5], 34.657, 1e-3); close(p[6], 200.346, 1e-3);
        // Transverse module and conversions: mt = mn / cos b; pn = pt cos b.
        close(g1.mt, 3.0 / rad(30.0).cos(), 1e-12);
        close(g1.pn, g1.pt * rad(30.0).cos(), 1e-12);
        // sin bb = sin b cos an (KHK span article, second form of the base helix angle).
        close(rad(g1.beta_b).sin(), rad(30.0).sin() * rad(20.0).cos(), 1e-12);
        // Spur limit: beta = 0 gives the spur values.
        let s0 = helical(2.0, 20.0, 20.0, 0.0, 0.0, 1.0, 1.25);
        close(s0.d, 40.0, 1e-12); close(s0.alpha_t, 20.0, 1e-12); assert!(s0.lead.is_infinite());
        close(overlap_ratio(30.0, 3.0, 30.0), 30.0 * 0.5 / (PI * 3.0), 1e-12);
    }

    /// Span example of the KHK Gear Technical Reference (printed tooth
    /// thickness section): m 3, a 20, z 24, x 0.4: k = 4, W = 32.8266. The KHK
    /// web PDF we could open does not show that table, so this row is
    /// single-source (see docs/gears.md). MESYS AG calculation for m 1, z 20,
    /// x 0: W over 2 teeth 4.7083.
    #[test]
    fn span_measurement_examples() {
        close(span_k(24.0, 20.0, 0.0, 0.4), 4.0, 0.0);
        close(span_w(3.0, 24.0, 20.0, 0.0, 0.4, 4.0), 32.8266, 1e-4);
        close(span_w(1.0, 20.0, 20.0, 0.0, 0.0, 2.0), 4.7083, 1e-4);
        // Anvils on the circle used to pick k: contact diameter of W(k exact) is d + 2 x m.
        let kx = span_k_exact(24.0, 20.0, 0.0, 0.4);
        let w = span_w(3.0, 24.0, 20.0, 0.0, 0.4, kx);
        close(span_contact_dia(72.0 * rad(20.0).cos(), w, 0.0), 72.0 + 2.4, 1e-9);
        // For x = 0 the formula reduces to k = z alpha / 180 + 0.5 (z / 9 + 0.5 at 20 deg).
        for z in [12.0, 20.0, 30.0, 44.0, 80.0] { close(span_k(z, 20.0, 0.0, 0.0), (z / 9.0 + 0.5).round(), 0.0); }
    }

    /// MESYS AG online calculation (calc.mesys.ch, gear m 1, z 30, a 20, ball 1.7,
    /// with the generating profile shifts of its two tooth thickness limits):
    /// xE -0.0412: Wk(3) 7.7723, MdK 32.2380; xE -0.0824: Wk(3) 7.7441, MdK 32.1641.
    /// MESYS also gives MdK 22.2941 for m 1, z 20, x 0, dp 1.7.
    #[test]
    fn over_pins_and_span_against_mesys() {
        close(span_w(1.0, 30.0, 20.0, 0.0, -0.0412, 3.0), 7.7723, 1e-4);
        close(span_w(1.0, 30.0, 20.0, 0.0, -0.0824, 3.0), 7.7441, 1e-4);
        close(mop_spur(1.0, 30.0, 20.0, -0.0412, 1.7), 32.2380, 1e-4);
        close(mop_spur(1.0, 30.0, 20.0, -0.0824, 1.7), 32.1641, 1e-4);
        close(mop_spur(1.0, 20.0, 20.0, 0.0, 1.7), 22.2941, 1e-4);
        close(span_k(30.0, 20.0, 0.0, 0.0), 4.0, 0.0);
    }

    /// The ideal pin touches the flanks on the reference circle (x = 0) or on
    /// d + 2 x m; checked with the independent contact-diameter formula.
    #[test]
    fn ideal_pins_touch_where_intended() {
        for &(z, x) in &[(20.0, 0.0), (31.0, 0.0), (24.0, 0.4), (15.0, 0.3)] {
            let r = gear_measure(1.0, z, 20.0, 0.0, x, 0.0, false);
            close(r[4], z + 2.0 * x, 1e-9);
        }
        // m 1, z 20, 20 deg: ideal pin 1.72445 (own computation from the KHK formula).
        close(ideal_pin_ext(1.0, 20.0, 20.0, 0.0), 1.72445, 1e-5);
        for &(z, x) in &[(40.0, 0.0), (60.0, 0.0), (50.0, 0.2)] {
            let r = gear_measure(1.0, z, 20.0, 0.0, x, 0.0, true);
            close(r[4], z + 2.0 * x, 1e-9);
            assert!(r[0] < z && r[0] > z - 4.0, "{:?}", r);
        }
        // Odd tooth count: the pin-centre diameter is reduced by cos(90/z).
        let odd = gear_measure(1.0, 21.0, 20.0, 0.0, 0.0, 1.7, false);
        close(odd[0], odd[3] * (PI / 42.0).cos() + 1.7, 1e-12);
    }

    /// Over balls of a helical gear by the transverse form agrees with the spur
    /// form for beta = 0, and the KHK helical ball (spur formula on zv) is used.
    #[test]
    fn helical_over_balls_consistency() {
        let s = gear_measure(1.0, 20.0, 20.0, 0.0, 0.0, 1.7, false);
        close(s[0], 22.2941, 1e-4);
        let h = gear_measure(3.0, 12.0, 20.0, 30.0, 0.09809, 0.0, false);
        let zv = 12.0 / rad(30.0).cos().powi(3);
        close(h[2], ideal_pin_ext(3.0, zv, 20.0, 0.09809), 1e-12);
        assert!(h[0] > 48.153 && h[0] < 52.0, "{:?}", h);
    }

    /// Chordal tooth thickness, m 10, a 20, z 12, x 0.3, ha 13.000, worked by
    /// hand from the KHK formulas psi = 90/z + 360 x tan a / (pi z):
    /// psi = 8.5427 deg, s = 17.8256, h = 13.6657. Hand check only, no printed
    /// result row read (flagged in docs/gears.md).
    #[test]
    fn chordal_thickness() {
        let (sc, hc) = chordal(10.0, 12.0, 20.0, 0.3, 13.0);
        close(sc, 17.8256, 1e-4); close(hc, 13.6657, 1e-4);
        // Large z: chordal thickness tends to the arc thickness, height to ha.
        let (s2, h2) = chordal(1.0, 2000.0, 20.0, 0.0, 1.0);
        close(s2, PI / 2.0, 1e-6); close(h2, 1.0, 1e-3);
        let (s3, _) = chordal_at(20.0, PI / 2.0, 22.0);
        close(s3, 20.0 * (PI / 40.0).sin(), 1e-12);
    }

    /// Involute splines, 30 deg flat root side fit. ANSI B92.1 8/16 pitch,
    /// 24 teeth (basic formulas as printed by Engineers Edge; Dre factor 1.35 is
    /// stated there for 2.5/5 to 12/24 pitch only): D 3, Do 3.125, Di 2.875,
    /// Dri 3.16875, Dre 2.83125, space width pi / (2P) = 0.19635. Then the
    /// 16/32 pins check below uses only D and the space width.
    /// ISO 4156 m 2, z 20: D 40, Dee 42, Dei 43, Die 37 (ISO 4156:1981 table 2).
    #[test]
    fn spline_basic_dimensions() {
        let a: Vec<f64> = (0..8).map(|i| spline_flat(1, 1.0 / 8.0, 24.0, i)).collect();
        close(a[0], 3.0, 1e-12); close(a[1], 3.0 * 0.75f64.sqrt(), 1e-12);
        close(a[3], 0.19635, 1e-5); close(a[4], 3.125, 1e-12); close(a[5], 2.875, 1e-12);
        close(a[6], 3.16875, 1e-12); close(a[7], 2.83125, 1e-12);
        let i: Vec<f64> = (0..8).map(|k| spline_flat(2, 2.0, 20.0, k)).collect();
        close(i[0], 40.0, 1e-12); close(i[4], 42.0, 1e-12); close(i[6], 43.0, 1e-12); close(i[7], 37.0, 1e-12);
        assert!(i[5].is_nan());
        assert!(spline_flat(3, 2.0, 20.0, 0).is_nan());
        // Over pins with the ideal pin: pins touch at the pitch diameter.
        let m = 1.0 / 16.0;
        let dp = ideal_pin_ext(m, 24.0, 30.0, 0.0);
        let mm = over_pins_ext(24.0, 1.5, 30.0, PI * m / 2.0, dp);
        close(pin_contact_dia(1.5 * rad(30.0).cos(), mm - dp, dp, false), 1.5, 1e-9);
        // Between pins of the mating internal spline, same basic space width.
        let di = ideal_pin_int(m, 24.0, 30.0, 0.0);
        let mi = between_pins_int(24.0, 1.5, 30.0, PI * m / 2.0, di);
        close(pin_contact_dia(1.5 * rad(30.0).cos(), mi + di, di, true), 1.5, 1e-9);
    }

    /// The tooth space drawing against the computed dimensions, ANSI B92.1
    /// 8/16 pitch, 24 teeth and ISO 4156 m 2, z 21 (odd), external and internal:
    /// the tooth thickness (space width) measured on the drawn profile at the
    /// pitch circle is the calculator's value; the pin centre is where the
    /// measurement over (between) pins puts it; the pin touches both flanks
    /// (nearest profile point is dp / 2 away, at the contact point the core
    /// gives) and nothing is nearer; the ideal pin touches on the pitch circle.
    #[test]
    fn space_view_matches_computed_dimensions() {
        for (std, m, z) in [(1u32, 0.125, 24.0), (2, 2.0, 21.0), (1, 1.0 / 12.0, 9.0), (2, 1.0, 60.0)] {
            let g: Vec<f64> = (0..8).map(|i| spline_flat(std, m, z, i)).collect();
            let (d, t) = (g[0], g[3]);
            let minor_int = if g[5].is_finite() { g[5] } else { m * (z - 1.0) };
            for internal in [false, true] {
                let (tip, root) = if internal { (minor_int, g[6]) } else { (g[4], g[7]) };
                let dp = if internal { ideal_pin_int(m, z, 30.0, 0.0) } else { ideal_pin_ext(m, z, 30.0, 0.0) };
                let v = space_view(internal, z, d, 30.0, t, tip, root, dp, 200).unwrap();
                assert_eq!(v.flags & 3, 0, "{std} {z} {internal}");
                // thickness on the pitch circle, from the drawn points
                let on_pitch: Vec<&(f64, f64)> = v.outline.iter().filter(|p| (p.0.hypot(p.1) - d / 2.0).abs() < 1e-9 * d).collect();
                assert_eq!(on_pitch.len(), 2, "{std} {z} {internal}");
                let space = 2.0 * on_pitch[1].0.atan2(on_pitch[1].1) * d / 2.0;
                close(if internal { space } else { PI * m - space }, t, 1e-9 * d);
                // the profile runs from the middle of one tooth to the middle of the next
                let (first, last) = (v.outline[0], *v.outline.last().unwrap());
                close(first.0.atan2(first.1), -PI / z, 1e-12); close(last.0.atan2(last.1), PI / z, 1e-12);
                close(first.0.hypot(first.1), tip / 2.0, 1e-12);
                // pin centre against the measurement over or between pins
                let k = if (z as i64) % 2 != 0 { (PI / (2.0 * z)).cos() } else { 1.0 };
                let mm = if internal { between_pins_int(z, d, 30.0, t, dp) } else { over_pins_ext(z, d, 30.0, t, dp) };
                close(2.0 * v.pin_centre_r * k + if internal { -dp } else { dp }, mm, 1e-9 * d);
                // contact: dp / 2 from the centre, on the pitch circle for the ideal pin, and the same as pin_contact_dia
                let c = (0.0, v.pin_centre_r);
                close((v.contact.0 - c.0).hypot(v.contact.1 - c.1), dp / 2.0, 1e-9 * d);
                close(2.0 * v.contact_r, d, 1e-9 * d);
                close(2.0 * v.contact_r, pin_contact_dia(g[1], 2.0 * v.pin_centre_r, dp, internal), 1e-9 * d);
                // nothing on the flanks is nearer to the pin centre than the contact point
                let nearest = v.outline.iter().map(|p| (p.0 - c.0).hypot(p.1 - c.1)).fold(f64::INFINITY, f64::min);
                assert!(nearest >= dp / 2.0 - 1e-9 * d, "{std} {z} {internal}: {nearest} < {}", dp / 2.0);
                assert!(nearest <= dp / 2.0 + 2e-4 * d, "{std} {z} {internal}: {nearest}");
            }
        }
    }

    /// Pins that do not measure: too large (rides on the tooth corners), too
    /// small (sits on the root, or below the tips), and numbers that are no tooth space.
    #[test]
    fn space_view_pin_checks() {
        let (m, z) = (0.125, 24.0);
        let g: Vec<f64> = (0..8).map(|i| spline_flat(1, m, z, i)).collect();
        let ext = |dp: f64| space_view(false, z, g[0], 30.0, g[3], g[4], g[7], dp, 40).unwrap();
        let int = |dp: f64| space_view(true, z, g[0], 30.0, g[3], g[5], g[6], dp, 40).unwrap();
        assert_eq!(ext(0.24).flags, 0);
        assert_eq!(ext(0.40).flags, 1); // would touch above the major diameter: it rides on the tooth corners
        assert_eq!(ext(0.17).flags, 2); // reaches the root before the flanks
        assert_eq!(ext(0.15).flags, 6); // on the root and below the tips
        assert_eq!(int(0.21).flags, 0);
        assert_eq!(int(0.30).flags, 1); // would touch inside the minor diameter
        assert_eq!(int(0.36).flags, 1); // no position at all: the centre would be inside the base circle
        assert!(int(0.36).pin_centre_r.is_nan());
        assert_eq!(int(0.12).flags, 6);
        assert!(ext(0.0).pin_centre_r.is_nan());
        assert!(space_view(false, z, g[0], 30.0, g[3], g[7], g[4], 0.2, 40).is_none()); // tip and root swapped
        assert!(space_view(false, z, g[0], 30.0, 0.5, g[4], g[7], 0.2, 40).is_none()); // tooth wider than the pitch
        assert!(space_view(false, 2.0, g[0], 30.0, g[3], g[4], g[7], 0.2, 40).is_none());
        assert!(space_view_flat(false, z, g[0], 30.0, f64::NAN, g[4], g[7], 0.2, 40).is_empty());
        let flat = space_view_flat(false, z, g[0], 30.0, g[3], g[4], g[7], 0.24, 40);
        assert_eq!(flat.len(), 6 + 2 * flat[5] as usize);
        close(flat[0], 2.0 * ext(0.24).pin_centre_r, 1e-12); close(flat[1], 2.0 * ext(0.24).contact_r, 1e-12);
    }

    /// Gear trains: compound 20/60 x 18/54 is 9 : 1; Willis for a 24 / 72 set
    /// with the ring held gives 1 + 72/24 = 4 : 1 (SDP/SI section 13 form).
    #[test]
    fn trains_and_planetary() {
        close(train_ratio(&[20.0, 60.0, 18.0, 54.0]), 9.0, 1e-12);
        assert!(train_ratio(&[20.0]).is_nan());
        close(train_sign(2.0), 1.0, 0.0); close(train_sign(3.0), -1.0, 0.0);
        close(willis(24.0, 72.0, 1000.0, 0.0, f64::NAN), 250.0, 1e-9);
        close(willis(24.0, 72.0, f64::NAN, 0.0, 250.0), 1000.0, 1e-9);
        close(willis(24.0, 72.0, 1000.0, f64::NAN, 0.0), -1000.0 / 3.0, 1e-9);
        close(planet_teeth(24.0, 72.0), 24.0, 0.0);
        assert!(planets_assemble(24.0, 72.0, 3.0));
        assert!(!planets_assemble(24.0, 72.0, 5.0));
        // Change-gear finder (benchmate_core::change_gear_trains) finds 1 : 9 exactly
        // from a 20..80 by 5 set as a compound train.
        let set: Vec<u32> = (20..=80).step_by(5).collect();
        let t = crate::change_gear_trains(&set, 1.0 / 9.0, true, 3);
        close(t[0].ratio, 1.0 / 9.0, 1e-12); assert!(t[0].c > 0);
    }

    /// Worm: mx 3, one start, 30 teeth, d1 44: lead 3 pi, tan g = 3 / 44,
    /// a = (44 + 90) / 2 = 67 (KHK section on cylindrical worm gear pairs, form only).
    #[test]
    fn worm_basics() {
        let w = worm(3.0, 1.0, 30.0, 44.0);
        close(w[0], 3.0 * PI, 1e-12); close(w[1], deg((3.0f64 / 44.0).atan()), 1e-12);
        close(w[2], 30.0, 0.0); close(w[3], 67.0, 1e-12); close(w[4], 90.0, 1e-12);
    }

    #[test]
    fn tooth_outline_is_symmetric_and_bounded() {
        let g = spur(2.0, 20.0, 20.0, 0.0, 1.0, 1.25);
        let p = tooth_outline(g.d, g.db, g.da, g.df, g.s, 20);
        assert!(p.len() > 40 && p.len() % 2 == 0);
        let n = p.len();
        close(p[0], -p[n - 2], 1e-12); close(p[1], p[n - 1], 1e-12);
        for c in p.chunks(2) { let r = c[0].hypot(c[1]); assert!(r <= g.da / 2.0 + 1e-9 && r >= g.df / 2.0 - 1e-9); }
    }
    /// SAE parallel side splines against the values printed in Machinery's
    /// Handbook, 31st ed., Tables 18, 20 and 21 (pp. 2359-2360): the maximum of
    /// each dimension and the torque capacity T.
    #[test]
    fn sae_parallel_side_splines() {
        let c = |a: f64, b: f64, tol: f64| assert!((a - b).abs() <= tol, "{a} vs {b}");
        // 4A and 4B at 3/4 and 2 in.
        c(sae_spline(4.0, 1.0, 0.75, 0.0), 0.181, 5e-4); c(sae_spline(4.0, 1.0, 0.75, 2.0), 0.637, 6e-4); c(sae_spline(4.0, 1.0, 0.75, 1.0), 0.056, 5e-4);
        c(sae_spline(4.0, 1.0, 0.75, 3.0), 78.0, 0.5); c(sae_spline(4.0, 2.0, 0.75, 3.0), 123.0, 0.5);
        c(sae_spline(4.0, 1.0, 2.0, 0.0), 0.482, 1e-9); c(sae_spline(4.0, 1.0, 2.0, 2.0), 1.700, 1e-9); c(sae_spline(4.0, 1.0, 2.0, 1.0), 0.150, 1e-9);
        c(sae_spline(4.0, 1.0, 2.0, 3.0), 555.0, 0.5); c(sae_spline(4.0, 2.0, 2.0, 2.0), 1.500, 1e-9); c(sae_spline(4.0, 2.0, 2.0, 1.0), 0.250, 1e-9); c(sae_spline(4.0, 2.0, 2.0, 3.0), 875.0, 0.5);
        c(sae_spline(4.0, 1.0, 3.0, 0.0), 0.723, 1e-9); c(sae_spline(4.0, 1.0, 3.0, 3.0), 1249.0, 0.5); c(sae_spline(4.0, 2.0, 3.0, 3.0), 1969.0, 0.5);
        // 6A, 6B, 6C at 3 in.
        c(sae_spline(6.0, 1.0, 3.0, 0.0), 0.750, 1e-9); c(sae_spline(6.0, 1.0, 3.0, 2.0), 2.700, 1e-9); c(sae_spline(6.0, 1.0, 3.0, 3.0), 1283.0, 0.6);
        c(sae_spline(6.0, 2.0, 3.0, 2.0), 2.550, 1e-9); c(sae_spline(6.0, 2.0, 3.0, 3.0), 1873.0, 0.5); c(sae_spline(6.0, 3.0, 3.0, 2.0), 2.400, 1e-9); c(sae_spline(6.0, 3.0, 3.0, 3.0), 2430.0, 0.5);
        // 10A, 10B, 10C at 2 and 6 in.
        c(sae_spline(10.0, 1.0, 2.0, 0.0), 0.312, 1e-9); c(sae_spline(10.0, 1.0, 2.0, 2.0), 1.820, 1e-9); c(sae_spline(10.0, 1.0, 2.0, 3.0), 860.0, 0.6);
        c(sae_spline(10.0, 2.0, 2.0, 2.0), 1.720, 1e-9); c(sae_spline(10.0, 2.0, 2.0, 3.0), 1302.0, 0.5); c(sae_spline(10.0, 3.0, 2.0, 2.0), 1.620, 1e-9); c(sae_spline(10.0, 3.0, 2.0, 3.0), 1720.0, 0.6);
        c(sae_spline(10.0, 1.0, 6.0, 0.0), 0.936, 1e-9); c(sae_spline(10.0, 1.0, 6.0, 3.0), 7735.0, 0.6); c(sae_spline(10.0, 2.0, 6.0, 3.0), 11718.0, 0.6); c(sae_spline(10.0, 3.0, 6.0, 3.0), 15475.0, 0.6);
        // 16A, 16B, 16C at 2 and 6 in.
        c(sae_spline(16.0, 1.0, 2.0, 0.0), 0.196, 1e-9); c(sae_spline(16.0, 1.0, 2.0, 3.0), 1375.0, 0.5); c(sae_spline(16.0, 2.0, 2.0, 3.0), 2083.0, 0.5); c(sae_spline(16.0, 3.0, 2.0, 3.0), 2751.0, 0.5);
        c(sae_spline(16.0, 1.0, 6.0, 0.0), 0.588, 1e-9); c(sae_spline(16.0, 1.0, 6.0, 3.0), 12377.0, 0.6); c(sae_spline(16.0, 2.0, 6.0, 3.0), 18749.0, 0.6); c(sae_spline(16.0, 3.0, 6.0, 3.0), 24760.0, 1.0); // the formula gives 24760.8
        // No fit C for 4 splines; other spline counts are not in the standard.
        assert!(sae_spline(4.0, 3.0, 2.0, 0.0).is_nan() && sae_spline(4.0, 3.0, 2.0, 3.0).is_nan() && sae_spline(8.0, 1.0, 2.0, 0.0).is_nan() && sae_spline(6.0, 1.0, 0.0, 0.0).is_nan());
    }

    // Victor Machinery Exchange, Travers / TTC (All Industrial catalogue p. 371) and Evolvent Design print the same
    // ranges for diametral pitch cutters; the last two print the module series in the reverse order.
    #[test]
    fn involute_cutter_numbers() {
        for (lo, hi, no) in [(135.0, 400.0, 1.0), (55.0, 134.0, 2.0), (35.0, 54.0, 3.0), (26.0, 34.0, 4.0), (21.0, 25.0, 5.0), (17.0, 20.0, 6.0), (14.0, 16.0, 7.0), (12.0, 13.0, 8.0)] {
            for z in [lo, hi] {
                assert_eq!(involute_cutter_no(z, 0.0), no);
                assert_eq!(involute_cutter_no(z, 1.0), 9.0 - no);
            }
        }
        assert!(involute_cutter_no(11.0, 0.0).is_nan());
        assert!(involute_cutter_no(20.5, 0.0).is_nan());
        assert!(involute_cutter_no(20.0, 2.0).is_nan());
    }
}
