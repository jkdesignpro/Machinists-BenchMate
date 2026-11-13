//! Rotary axis helper: where a point goes when a rotary axis turns, and the
//! feed of a block that turns a rotary axis.
//!
//! Sources (docs/rotary.md): ISO 841 (A, B, C turn about X, Y, Z; positive by
//! the right-hand screw rule, stated for the tool relative to the work, so a
//! table that carries the work turns the other way); rotation about an axis
//! (Wikipedia "Rotation matrix", MathWorks `rotx`); feed of a rotary block
//! (Fadal user manual section 12, Industrial Monitor Direct, CNC Cookbook).

use std::f64::consts::PI;

/// The two coordinates a rotation about axis 0 (X), 1 (Y) or 2 (Z) changes,
/// in the order that makes a positive right-hand rotation turn the first
/// towards the second.
fn plane(axis: u32) -> Option<(usize, usize)> { match axis { 0 => Some((1, 2)), 1 => Some((2, 0)), 2 => Some((0, 1)), _ => None } }

/// Rotate point `p` by `deg` degrees about a line through `c` parallel to X
/// (axis 0), Y (1) or Z (2). Positive is the right-hand rule: counter-
/// clockwise seen from the + end of the axis looking back along it.
pub fn rotate_point(axis: u32, deg: f64, p: [f64; 3], c: [f64; 3]) -> [f64; 3] {
    let (i, j) = match plane(axis) { Some(v) => v, None => return [f64::NAN; 3] };
    let (s, co) = (deg * PI / 180.0).sin_cos();
    let (u, w) = (p[i] - c[i], p[j] - c[j]);
    let mut q = p;
    q[i] = c[i] + u * co - w * s;
    q[j] = c[j] + u * s + w * co;
    q
}

/// Where a point of the part is after the rotary axis is sent to `deg`
/// (from 0). `part_right_hand` false: the part turns against the right-hand
/// rule for a positive angle (a table that carries the work, as ISO 841
/// defines it); true: the part itself turns by the right-hand rule.
pub fn part_point(axis: u32, deg: f64, p: [f64; 3], c: [f64; 3], part_right_hand: bool) -> [f64; 3] {
    rotate_point(axis, if part_right_hand { deg } else { -deg }, p, c)
}

/// Distance of a point from the rotary axis (it does not change when the axis turns).
pub fn radius_from_axis(axis: u32, p: [f64; 3], c: [f64; 3]) -> f64 {
    match plane(axis) { Some((i, j)) => ((p[i] - c[i]).powi(2) + (p[j] - c[j]).powi(2)).sqrt(), None => f64::NAN }
}

/// Flat form for the screen. `which`: 0 x, 1 y, 2 z after the move; 3 the
/// distance from the axis; 4 the straight-line distance the point moved.
#[allow(clippy::too_many_arguments)]
pub fn part_point_f(axis: f64, deg: f64, x: f64, y: f64, z: f64, cx: f64, cy: f64, cz: f64, part_right_hand: f64, which: f64) -> f64 {
    if ![deg, x, y, z, cx, cy, cz].iter().all(|v| v.is_finite()) || !(0.0..=2.0).contains(&axis) { return f64::NAN; }
    let (a, p, c) = (axis as u32, [x, y, z], [cx, cy, cz]);
    let q = part_point(a, deg, p, c, part_right_hand != 0.0);
    match which as i32 {
        0..=2 => q[which as usize],
        3 => radius_from_axis(a, p, c),
        4 => ((q[0] - p[0]).powi(2) + (q[1] - p[1]).powi(2) + (q[2] - p[2]).powi(2)).sqrt(),
        _ => f64::NAN,
    }
}

/// Length round the part for an angle at a radius: radius x angle in radians.
pub fn arc_length(radius: f64, deg: f64) -> f64 {
    if !(radius > 0.0) || !deg.is_finite() { return f64::NAN; }
    radius * deg.abs() * PI / 180.0
}

/// Angle in degrees that gives a length round the part at a radius.
pub fn angle_for_length(radius: f64, length: f64) -> f64 {
    if !(radius > 0.0) || !(length >= 0.0) { return f64::NAN; }
    length / radius * 180.0 / PI
}

/// Rotary feed in degrees per minute that gives a surface feed (length per
/// minute) at a radius, for a block that only turns the rotary axis.
pub fn deg_per_min(surface_feed: f64, radius: f64) -> f64 {
    if !(surface_feed > 0.0) || !(radius > 0.0) { return f64::NAN; }
    surface_feed * 180.0 / (PI * radius)
}

/// Surface feed at a radius for a rotary feed in degrees per minute.
pub fn surface_feed(deg_per_min: f64, radius: f64) -> f64 {
    if !(deg_per_min > 0.0) || !(radius > 0.0) { return f64::NAN; }
    deg_per_min * PI * radius / 180.0
}

/// Length the tool travels over the surface in a block that turns the part
/// by `deg` at `radius` and moves `linear` along the rotary axis at the same
/// time (a helix round the part): sqrt(arc^2 + linear^2).
pub fn move_length(radius: f64, deg: f64, linear: f64) -> f64 {
    let arc = arc_length(radius, deg);
    if !arc.is_finite() || !linear.is_finite() { return f64::NAN; }
    (arc * arc + linear * linear).sqrt()
}

/// Time of the block in seconds at a surface feed per minute.
pub fn move_time_s(surface_feed: f64, length: f64) -> f64 {
    if !(surface_feed > 0.0) || !(length > 0.0) { return f64::NAN; }
    length / surface_feed * 60.0
}

/// Inverse time feed word (G93): 1 / (minutes the block takes) = surface feed / length.
pub fn inverse_time_f(surface_feed: f64, length: f64) -> f64 {
    if !(surface_feed > 0.0) || !(length > 0.0) { return f64::NAN; }
    surface_feed / length
}

/// Rotary speed during the block in degrees per minute: angle / minutes.
pub fn rotary_rate(surface_feed: f64, length: f64, deg: f64) -> f64 {
    if !(surface_feed > 0.0) || !(length > 0.0) || !deg.is_finite() { return f64::NAN; }
    deg.abs() * surface_feed / length
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }
    const O: [f64; 3] = [0.0; 3];

    #[test]
    fn rotation_matches_published_values() {
        // MathWorks rotx(30) on (2, -2, 4): (2.0000, -3.7321, 2.4641)
        let q = rotate_point(0, 30.0, [2.0, -2.0, 4.0], O);
        close(q[0], 2.0, 1e-12); close(q[1], -3.7321, 5e-5); close(q[2], 2.4641, 5e-5);
        // Wikipedia: Rz turns a vector along x towards the y axis
        let q = rotate_point(2, 90.0, [1.0, 0.0, 0.0], O);
        close(q[0], 0.0, 1e-12); close(q[1], 1.0, 1e-12); close(q[2], 0.0, 1e-12);
        // the same rule about Y: z towards x
        let q = rotate_point(1, 90.0, [0.0, 0.0, 1.0], O);
        close(q[0], 1.0, 1e-12); close(q[2], 0.0, 1e-12);
        // and about X: y towards z
        let q = rotate_point(0, 90.0, [0.0, 1.0, 0.0], O);
        close(q[1], 0.0, 1e-12); close(q[2], 1.0, 1e-12);
        assert!(rotate_point(3, 90.0, [1.0, 0.0, 0.0], O)[0].is_nan());
    }

    #[test]
    fn part_on_a_table_turns_the_other_way() {
        // A axis table, centre line at Y0 Z0. A point on top of the part (Z+25) after A90:
        // the table turns against the right-hand rule, so the top goes to Y+25 (not Y-25).
        let q = part_point(0, 90.0, [10.0, 0.0, 25.0], O, false);
        close(q[0], 10.0, 1e-12); close(q[1], 25.0, 1e-9); close(q[2], 0.0, 1e-9);
        let q = part_point(0, 90.0, [10.0, 0.0, 25.0], O, true);
        close(q[1], -25.0, 1e-9); close(q[2], 0.0, 1e-9);
        // a centre line that is not at zero: the point turns about it
        let q = part_point(0, 180.0, [0.0, 12.0, 30.0], [0.0, 10.0, 20.0], false);
        close(q[1], 8.0, 1e-9); close(q[2], 10.0, 1e-9);
        // the distance from the axis never changes; a full turn comes back
        let (p, c) = ([3.0, 7.0, -2.0], [1.0, 2.0, 3.0]);
        for axis in 0..3 { for deg in [-270.0, -33.0, 17.5, 90.0, 360.0] {
            let q = part_point(axis, deg, p, c, false);
            close(radius_from_axis(axis, q, c), radius_from_axis(axis, p, c), 1e-12);
            close(q[axis as usize], p[axis as usize], 1e-12);
        } }
        let q = part_point(1, 360.0, p, c, false);
        for i in 0..3 { close(q[i], p[i], 1e-12); }
        // flat form
        close(part_point_f(0.0, 90.0, 10.0, 0.0, 25.0, 0.0, 0.0, 0.0, 0.0, 1.0), 25.0, 1e-9);
        close(part_point_f(0.0, 90.0, 10.0, 0.0, 25.0, 0.0, 0.0, 0.0, 0.0, 3.0), 25.0, 1e-12);
        close(part_point_f(0.0, 90.0, 10.0, 0.0, 25.0, 0.0, 0.0, 0.0, 0.0, 4.0), 25.0 * 2f64.sqrt(), 1e-9);
        assert!(part_point_f(0.0, f64::NAN, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0).is_nan());
        assert!(part_point_f(5.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0).is_nan());
    }

    #[test]
    fn fadal_manual_example() {
        // Fadal user manual, section 12: 4.0 in diameter, A turns 90 degrees, X moves 3.0, 25 in/min wanted.
        // Actual move distance 4.3439; feed in degrees per minute 517.97; inverse time feed 5.755.
        let len = move_length(2.0, 90.0, 3.0);
        close(len, 4.3439, 5e-5);
        close(rotary_rate(25.0, len, 90.0), 517.97, 0.01);
        close(inverse_time_f(25.0, len), 5.755, 0.0005);
        close(move_time_s(25.0, len), 60.0 / 5.755, 0.01);
    }

    #[test]
    fn industrial_monitor_direct_example() {
        // X 0.25 in, A 360 degrees, diameter 2.0 in: distance about 6.288 in; at 2.0 in/min, 3.144 min.
        let len = move_length(1.0, 360.0, 0.25);
        close(len, 6.288, 0.0005);
        close(move_time_s(2.0, len) / 60.0, 3.144, 0.0005);
        // its feed relation: X feed = A deg/min x pi x diameter / 360
        close(surface_feed(114.59, 1.0), 114.59 * PI * 2.0 / 360.0, 1e-12);
        close(deg_per_min(2.0, 1.0), 360.0 / PI, 1e-9);
    }

    #[test]
    fn rotary_only_block() {
        // 90 degrees per minute: a full turn takes 4 minutes (RapidRotary README)
        let r = 10.0;
        let f = surface_feed(90.0, r);
        close(move_time_s(f, arc_length(r, 360.0)), 240.0, 1e-9);
        // degrees per minute and surface feed undo each other; the rotary rate of a turn-only block is that feed
        close(deg_per_min(surface_feed(250.0, 12.5), 12.5), 250.0, 1e-9);
        close(rotary_rate(100.0, arc_length(20.0, 45.0), 45.0), deg_per_min(100.0, 20.0), 1e-9);
        // a quarter turn at radius 20 is 10 pi long; and back
        close(arc_length(20.0, 90.0), 10.0 * PI, 1e-12);
        close(arc_length(20.0, -90.0), 10.0 * PI, 1e-12);
        close(angle_for_length(20.0, 10.0 * PI), 90.0, 1e-12);
        // inverse time: the block takes 1/F minutes
        close(60.0 / inverse_time_f(300.0, 150.0), move_time_s(300.0, 150.0), 1e-12);
        for bad in [deg_per_min(0.0, 1.0), deg_per_min(1.0, 0.0), surface_feed(1.0, -1.0), arc_length(0.0, 90.0), move_length(1.0, f64::NAN, 0.0), inverse_time_f(1.0, 0.0), move_time_s(0.0, 1.0)] { assert!(bad.is_nan()); }
    }
}
