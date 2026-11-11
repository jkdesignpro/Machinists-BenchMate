//! Tool nose radius compensation (TNRC) for lathes, worked by hand: where to
//! program the imaginary tool tip so that a tool with nose radius r cuts a
//! chamfer, taper or arc to size without G41/G42.
//!
//! Coordinates are (Z, X) with X as a diameter at the interface and as a radius
//! inside the maths. The drawing view is +Z to the right and +X up; "right of
//! travel" (G42) and "left of travel" (G41) are judged in that view.
//!
//! The imaginary (theoretical) tip P is where the lines tangent to the nose
//! circle and parallel to Z and X meet. P = C + r t, where C is the nose centre
//! and t is the tip direction: tip 3 = (-Z, -X) for an OD turning tool, tip 2 =
//! (-Z, +X) for a boring bar (Haas operator manual, see docs/sources.md [HFO_OP]);
//! tips 1 (+Z,+X), 4 (+Z,-X), 5 (+Z), 6 (+X), 7 (-Z), 8 (-X) follow the same
//! 3 x 3 chart; tips 0 and 9 put the control point at the nose centre.
//!
//! Method (own derivation, checked against the formulas published by [KENTECH]
//! and [IA]): the nose centre must stay r away from the part line on the tool
//! side, so the tip path is the part line shifted by s = r n + r t (n = unit
//! normal towards the tool). The ends of a shifted line are where it meets the
//! shifted neighbour line (a diameter or a face). For a chamfer at angle theta
//! to the Z axis cut by tip 3 this gives the classic results
//!   dz = r (1 - tan(theta / 2))               (end on a diameter moves in Z)
//!   dx = r (1 - tan((90 deg - theta) / 2))    (end on a face moves in X, radial)
//! and for a convex arc of radius R the tip path is an arc of radius R + r
//! (concave: R - r) about the part centre moved by r t.
//!
//! Sources (full list in docs/sources.md, section "CNC guide and TNRC"):
//! * [KENTECH] "Stop scratching your head and make some chips", Kentech Inc.,
//!   TWI Press 2000, reprinted on a Florida International University course page:
//!   Z shift = TNR (1 - tan(angle / 2)); X shift = 2 tan(angle) x Z shift;
//!   radius: Z shift = TNR + R, X shift = 2 (TNR + R).
//! * [IA] Industry Arena (CNCzone) forum thread "Manual tool comp partial radius
//!   lathe" (2005-2009): z comp = r - r tan(a / 2); x comp = 2 (r - r tan(45 - a / 2));
//!   program a corner radius as R + r.

/// Tip direction (tz, tx) for tip numbers 0-9; each component -1, 0 or +1.
/// Returns None for numbers above 9.
pub fn tip_vector(tip: u32) -> Option<(f64, f64)> {
    Some(match tip {
        1 => (1.0, 1.0),
        2 => (-1.0, 1.0),
        3 => (-1.0, -1.0),
        4 => (1.0, -1.0),
        5 => (1.0, 0.0),
        6 => (0.0, 1.0),
        7 => (-1.0, 0.0),
        8 => (0.0, -1.0),
        0 | 9 => (0.0, 0.0),
        _ => return None,
    })
}

/// Z shift of the end of a chamfer that meets a diameter, tip 3 or 2:
/// dz = r (1 - tan(theta / 2)), theta = chamfer angle to the Z axis in degrees.
/// [KENTECH][IA]
pub fn chamfer_dz(r: f64, theta_deg: f64) -> f64 {
    if !(r >= 0.0 && theta_deg > 0.0 && theta_deg < 90.0) { return f64::NAN; }
    r * (1.0 - (theta_deg.to_radians() / 2.0).tan())
}

/// Radial X shift of the end of a chamfer that meets a face, tip 3 or 2:
/// dx = r (1 - tan((90 - theta) / 2)); double it for a diameter. [IA]; equal to
/// tan(theta) x dz, the form printed by [KENTECH].
pub fn chamfer_dx(r: f64, theta_deg: f64) -> f64 {
    if !(r >= 0.0 && theta_deg > 0.0 && theta_deg < 90.0) { return f64::NAN; }
    r * (1.0 - ((90.0 - theta_deg).to_radians() / 2.0).tan())
}

/// Shortest distance from the nose centre to a chamfer at angle theta to Z when the
/// imaginary tip (tip 3 or 2) is programmed on the part line with no compensation:
/// the nose then stands off by r (sin theta + cos theta - 1). Own derivation.
pub fn chamfer_error(r: f64, theta_deg: f64) -> f64 {
    if !(r >= 0.0 && theta_deg >= 0.0 && theta_deg <= 90.0) { return f64::NAN; }
    let t = theta_deg.to_radians();
    r * (t.sin() + t.cos() - 1.0)
}

/// Error left in the middle of a 90 degree convex corner radius of any size when
/// the imaginary tip (tip 3) follows the part radius: r (sqrt 2 - 1). Own derivation.
pub fn corner_arc_error(r: f64) -> f64 {
    if !(r >= 0.0) { return f64::NAN; }
    r * (2f64.sqrt() - 1.0)
}

type P2 = (f64, f64);
fn sub(a: P2, b: P2) -> P2 { (a.0 - b.0, a.1 - b.1) }
fn add(a: P2, b: P2) -> P2 { (a.0 + b.0, a.1 + b.1) }
fn mul(a: P2, k: f64) -> P2 { (a.0 * k, a.1 * k) }
fn cross(a: P2, b: P2) -> f64 { a.0 * b.1 - a.1 * b.0 }
fn unit(a: P2) -> Option<P2> { let l = a.0.hypot(a.1); if l > 1e-12 { Some((a.0 / l, a.1 / l)) } else { None } }
/// Unit normal on the tool side of direction d: right of travel for side > 0 (G42).
fn tool_normal(d: P2, side: f64) -> P2 { if side > 0.0 { (d.1, -d.0) } else { (-d.1, d.0) } }

/// What the line meets at one end: 0 = nothing (offset at right angles),
/// 1 = a diameter (line parallel to Z), 2 = a face (line parallel to X).
fn end_point(a: P2, d: P2, s: P2, kind: u32, r: f64, t: P2, side: f64) -> P2 {
    let u = match kind {
        1 => (if d.0 >= 0.0 { 1.0 } else { -1.0 }, 0.0),
        2 => (0.0, if d.1 >= 0.0 { 1.0 } else { -1.0 }),
        _ => return add(a, s),
    };
    let sn = add(mul(tool_normal(u, side), r), mul(t, r));
    // a + s + p d = a + sn + q u  ->  p d - q u = sn - s
    let den = cross(d, mul(u, -1.0));
    if den.abs() < 1e-12 { return add(a, s); }
    let rhs = sub(sn, s);
    let p = cross(rhs, mul(u, -1.0)) / den;
    add(add(a, s), mul(d, p))
}

/// Tip-point path for a straight element (chamfer or taper) from (z1, x1) to
/// (z2, x2), X as diameters. `side` > 0: tool right of travel (G42), < 0: left
/// (G41). `end1`, `end2`: what each end meets (0 nothing, 1 diameter, 2 face).
/// Returns [z1', x1', z2', x2', nz, nx] (X as diameters; n = unit normal towards
/// the tool) or NaNs for bad input. Own derivation, see module notes.
#[allow(clippy::too_many_arguments)]
pub fn line_path(r: f64, tip: u32, z1: f64, x1: f64, z2: f64, x2: f64, side: f64, end1: u32, end2: u32) -> [f64; 6] {
    let nan = [f64::NAN; 6];
    let t = match tip_vector(tip) { Some(t) => t, None => return nan };
    if !(r >= 0.0) || side == 0.0 || ![z1, x1, z2, x2].iter().all(|v| v.is_finite()) { return nan; }
    let (a, b) = ((z1, x1 / 2.0), (z2, x2 / 2.0));
    let d = match unit(sub(b, a)) { Some(d) => d, None => return nan };
    let n = tool_normal(d, side);
    let s = add(mul(n, r), mul(t, r));
    let p1 = end_point(a, d, s, end1, r, t, side);
    let p2 = end_point(b, d, s, end2, r, t, side);
    [p1.0, p1.1 * 2.0, p2.0, p2.1 * 2.0, n.0, n.1]
}

/// Tip-point path for an arc from (z1, x1) to (z2, x2) of radius `rp` (X as
/// diameters), `ccw` = 1 counter-clockwise in the +Z right / +X up view, 0
/// clockwise; the shorter arc is used. `side` as for `line_path`.
/// Returns [z1', x1', z2', x2', R', cz', cx' (diameter), convex (1/0)] or NaNs
/// (no arc through the points, or a concave arc smaller than the nose).
#[allow(clippy::too_many_arguments)]
pub fn arc_path(r: f64, tip: u32, z1: f64, x1: f64, z2: f64, x2: f64, rp: f64, ccw: f64, side: f64) -> [f64; 8] {
    let nan = [f64::NAN; 8];
    let t = match tip_vector(tip) { Some(t) => t, None => return nan };
    if !(r >= 0.0 && rp > 0.0) || side == 0.0 { return nan; }
    let (a, b) = ((z1, x1 / 2.0), (z2, x2 / 2.0));
    let ch = sub(b, a);
    let c = ch.0.hypot(ch.1);
    if !(c > 1e-12) || c > 2.0 * rp + 1e-9 { return nan; }
    let h = (rp * rp - (c / 2.0) * (c / 2.0)).max(0.0).sqrt();
    let m = mul(add(a, b), 0.5);
    let u = (ch.0 / c, ch.1 / c);
    // For the shorter arc, a counter-clockwise move has its centre on the left of the chord.
    let left = (-u.1, u.0);
    let o = if ccw > 0.0 { add(m, mul(left, h)) } else { sub(m, mul(left, h)) };
    // Travel counter-clockwise: the right-hand normal points away from the centre.
    let convex = (ccw > 0.0) == (side > 0.0);
    let rr = if convex { rp + r } else { rp - r };
    if !(rr > 0.0) { return nan; }
    let oc = add(o, mul(t, r));
    let ua = match unit(sub(a, o)) { Some(v) => v, None => return nan };
    let ub = match unit(sub(b, o)) { Some(v) => v, None => return nan };
    let p1 = add(oc, mul(ua, rr));
    let p2 = add(oc, mul(ub, rr));
    [p1.0, p1.1 * 2.0, p2.0, p2.1 * 2.0, rr, oc.0, oc.1 * 2.0, if convex { 1.0 } else { 0.0 }]
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    // [KENTECH] worked with its own printed formulas: r = 0.8 mm, 45 degrees.
    // Z shift = 0.8 (1 - tan 22.5) = 0.468629; X shift = 2 tan 45 x 0.468629 = 0.937258.
    #[test]
    fn kentech_45_deg() {
        assert!(close(chamfer_dz(0.8, 45.0), 0.468629, 1e-6));
        assert!(close(2.0 * chamfer_dx(0.8, 45.0), 0.937258, 1e-6));
        // [KENTECH] X = 2 tan(A) x Z for other angles too
        for a in [10.0, 30.0, 60.0, 75.0f64] {
            let z = chamfer_dz(0.8, a);
            assert!(close(2.0 * chamfer_dx(0.8, a), 2.0 * a.to_radians().tan() * z, 1e-12));
        }
    }

    // [IA] worked with its printed formulas: r = 0.031 in, a = 30 degrees.
    // z = 0.031 - 0.031 tan 15 = 0.022694; x = 2 (0.031 - 0.031 tan 30) = 0.026204.
    #[test]
    fn forum_30_deg() {
        assert!(close(chamfer_dz(0.031, 30.0), 0.022694, 1e-6));
        assert!(close(2.0 * chamfer_dx(0.031, 30.0), 0.026204, 1e-6));
    }

    // OD end chamfer 1 x 45 on a 20 mm shaft, face at Z0, tip 3, G42, r 0.8:
    // start on the face moves down by 0.937258 on diameter, end on the diameter moves left by 0.468629.
    #[test]
    fn od_chamfer_general_solver() {
        let p = line_path(0.8, 3, 0.0, 18.0, -1.0, 20.0, 1.0, 2, 1);
        assert!(close(p[0], 0.0, 1e-9) && close(p[1], 18.0 - 0.937258, 1e-6), "{:?}", p);
        assert!(close(p[2], -1.468629, 1e-6) && close(p[3], 20.0, 1e-9), "{:?}", p);
        // nose centre = tip - r t is exactly r from the part line
        let c = (p[0] + 0.8, p[1] / 2.0 + 0.8);
        let dist = ((c.0 - 0.0) * (1.0) + (c.1 - 9.0) * (1.0)).abs() / 2f64.sqrt();
        assert!(close(dist, 0.8, 1e-9));
    }

    // Same for a 30 degree taper (to Z) from a face: matches the closed forms.
    #[test]
    fn od_taper_matches_closed_forms() {
        let (r, th) = (0.4, 30.0f64);
        let len = 3.0;
        let (dzp, dxp) = (-len * th.to_radians().cos(), len * th.to_radians().sin());
        let p = line_path(r, 3, 0.0, 10.0, dzp, 10.0 + 2.0 * dxp, 1.0, 2, 1);
        assert!(close(10.0 - p[1], 2.0 * chamfer_dx(r, th), 1e-9));
        assert!(close(dzp - p[2], chamfer_dz(r, th), 1e-9));
    }

    // ID entry chamfer in a 20 mm bore, boring bar tip 2, G41: mirror of the OD case.
    #[test]
    fn id_chamfer_tip2() {
        let p = line_path(0.8, 2, 0.0, 22.0, -1.0, 20.0, -1.0, 2, 1);
        assert!(close(p[1], 22.0 + 0.937258, 1e-6) && close(p[0], 0.0, 1e-9), "{:?}", p);
        assert!(close(p[2], -1.468629, 1e-6) && close(p[3], 20.0, 1e-9), "{:?}", p);
    }

    // Centre control point (tip 0 / 9): plain offset of r at right angles.
    #[test]
    fn centre_tip_is_plain_offset() {
        let p = line_path(1.0, 9, 0.0, 0.0, -10.0, 0.0, 1.0, 0, 0);
        assert!(close(p[1], 2.0, 1e-12) && close(p[3], 2.0, 1e-12));
        assert!(close(p[0], 0.0, 1e-12) && close(p[2], -10.0, 1e-12));
    }

    // Axis-parallel elements need no compensation for tip 3: a diameter and a face stay put.
    #[test]
    fn straight_moves_unchanged_tip3() {
        let d = line_path(0.8, 3, 0.0, 20.0, -10.0, 20.0, 1.0, 0, 0);
        assert!(close(d[1], 20.0, 1e-12) && close(d[3], 20.0, 1e-12) && close(d[0], -0.8, 1e-12));
        let f = line_path(0.8, 3, 0.0, 0.0, 0.0, 20.0, 1.0, 0, 0);
        assert!(close(f[0], 0.0, 1e-12) && close(f[2], 0.0, 1e-12));
    }

    // [KENTECH] radius rule and [IA] "R + r": convex 2 mm corner on a 30 mm shaft, r 0.8.
    // Part arc from the face (Z0, X26) to the diameter (Z-2, X30), counter-clockwise in the
    // +Z right / +X up view, G42. Tip path: start X 30 - 2(2 + 0.8) = 24.4 at Z0,
    // end Z -(2 + 0.8) = -2.8 at X30, radius 2.8.
    #[test]
    fn convex_corner_radius() {
        let p = arc_path(0.8, 3, 0.0, 26.0, -2.0, 30.0, 2.0, 1.0, 1.0);
        assert!(close(p[0], 0.0, 1e-9) && close(p[1], 24.4, 1e-9), "{:?}", p);
        assert!(close(p[2], -2.8, 1e-9) && close(p[3], 30.0, 1e-9), "{:?}", p);
        assert!(close(p[4], 2.8, 1e-12) && p[7] == 1.0);
    }

    // Concave fillet R2 at a shoulder (diameter 20 up to face at Z-10, travel toward the chuck):
    // tip path radius R - r; a nose bigger than the fillet is refused.
    #[test]
    fn concave_fillet() {
        // from (Z-8, X20) on the diameter to (Z-10, X24) on the face, clockwise, G42
        let p = arc_path(0.8, 3, -8.0, 20.0, -10.0, 24.0, 2.0, 0.0, 1.0);
        assert!(close(p[4], 1.2, 1e-12) && p[7] == 0.0, "{:?}", p);
        // start stays on the diameter line (tip 3), end on the face line
        assert!(close(p[1], 20.0, 1e-9) && close(p[2], -10.0, 1e-9), "{:?}", p);
        assert!(close(p[0], -8.8, 1e-9) && close(p[3], 24.0 - 2.0 * 0.8, 1e-9), "{:?}", p);
        assert!(arc_path(2.5, 3, -8.0, 20.0, -10.0, 24.0, 2.0, 0.0, 1.0)[0].is_nan());
    }

    #[test]
    fn errors_and_bad_input() {
        assert!(close(chamfer_error(1.0, 45.0), 2f64.sqrt() - 1.0, 1e-12));
        assert!(close(corner_arc_error(0.8), 0.331371, 1e-6));
        assert!(chamfer_dz(0.8, 90.0).is_nan());
        assert!(tip_vector(10).is_none());
        assert!(line_path(0.8, 3, 0.0, 0.0, 0.0, 0.0, 1.0, 0, 0)[0].is_nan());
        assert!(arc_path(0.8, 3, 0.0, 0.0, -10.0, 0.0, 2.0, 1.0, 1.0)[0].is_nan());
    }
}
