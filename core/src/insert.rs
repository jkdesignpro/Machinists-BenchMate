//! Outline of an indexable insert, drawn to scale from its ISO 1832 shape
//! letter, inscribed circle and corner radius.
//!
//! Every ISO insert shape with equal sides is a tangential polygon: all its
//! sides touch the inscribed circle of diameter d (rho = d/2). That fixes the
//! whole outline:
//!
//! * a corner of angle a lies at rho / sin(a/2) from the centre, on the
//!   bisector of the corner;
//! * seen from the centre, the tangent point of a side lies 90 - a/2 degrees
//!   from the corner, so the next corner (angle b) is 180 - (a + b)/2 degrees
//!   further round;
//! * a corner radius r touches both sides at r / tan(a/2) from the sharp
//!   corner and turns through 180 - a degrees, which as a polyline bulge is
//!   tan((180 - a)/4);
//! * the radii fit as long as r < rho (at r = rho every shape becomes the
//!   inscribed circle itself).
//!
//! Sources: a tangential polygon has an incircle touching every side and
//! its angle bisectors meet at the centre of that circle (Wikipedia,
//! "Tangential polygon"; MathWorld, "Incircle"); the rest is the right
//! triangle between the centre, a corner and a tangent point. Shape letters
//! and corner angles come from the maker code keys in data/refdata/ (see
//! `tooling::insert_shape_angles`). Checked against the corner heights m
//! printed in ISO 3364:1997 for 18 inserts (test `iso3364_corner_heights`).

use crate::dxf::{self, Doc, Geo, Item};
use crate::tooling::insert_shape_angles;

/// Corner angles all the way round the insert, counter-clockwise, starting
/// with the corner the shape letter names. `None` for round inserts and for
/// shapes the inscribed circle does not fix (A, B, K parallelograms, L rectangle).
pub fn corner_angles(letter: char) -> Option<Vec<f64>> {
    if matches!(letter, 'A' | 'B' | 'K' | 'L') { return None; }
    let (a, b) = insert_shape_angles(letter);
    if !a.is_finite() { return None; }
    let n = match letter { 'T' => 3, 'P' => 5, 'H' | 'W' => 6, 'O' => 8, _ => 4 };
    Some((0..n).map(|i| if i % 2 == 0 { a } else { b }).collect())
}

/// Direction (degrees) of the first corner as drawn: rhombic inserts lie
/// with their sharp corners left and right, squares, hexagons and octagons
/// sit on a flat side, triangles, pentagons and trigons point up.
fn first_corner_deg(letter: char) -> f64 {
    match letter { 'S' => 45.0, 'T' | 'P' | 'W' => 90.0, 'O' => 22.5, _ => 0.0 }
}

/// Sharp corners of the insert (corner radius zero), centre of the inscribed
/// circle at the origin, counter-clockwise.
pub fn sharp_corners(letter: char, d: f64) -> Result<Vec<(f64, f64)>, String> {
    if !(d > 0.0) || !d.is_finite() { return Err("The inscribed circle must be greater than zero".into()); }
    let ang = corner_angles(letter).ok_or_else(|| format!("Shape {letter} is not fixed by its inscribed circle alone"))?;
    let rho = d / 2.0;
    let mut th = first_corner_deg(letter);
    let n = ang.len();
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let dist = rho / (ang[i].to_radians() / 2.0).sin();
        out.push((dist * th.to_radians().cos(), dist * th.to_radians().sin()));
        th += 180.0 - (ang[i] + ang[(i + 1) % n]) / 2.0;
    }
    Ok(out)
}

/// Outline of the insert as a closed polyline (x, y, bulge to the next
/// vertex), counter-clockwise, centre of the inscribed circle at the origin.
/// `r` is the corner radius (0 = sharp corners). A round insert (R) is the
/// circle of diameter `d` as two half-circle bulges; `r` is ignored.
pub fn outline(letter: char, d: f64, r: f64) -> Result<Vec<(f64, f64, f64)>, String> {
    if !(d > 0.0) || !d.is_finite() { return Err("The inscribed circle must be greater than zero".into()); }
    if letter == 'R' { return Ok(vec![(-d / 2.0, 0.0, 1.0), (d / 2.0, 0.0, 1.0)]); }
    let c = sharp_corners(letter, d)?;
    if !(r >= 0.0) || !r.is_finite() { return Err("The corner radius cannot be negative".into()); }
    if r == 0.0 { return Ok(c.iter().map(|p| (p.0, p.1, 0.0)).collect()); }
    if r >= d / 2.0 { return Err("The corner radius must be smaller than half the inscribed circle (at half, the insert is round)".into()); }
    let ang = corner_angles(letter).expect("checked by sharp_corners");
    let n = c.len();
    let unit = |from: (f64, f64), to: (f64, f64)| { let (x, y) = (to.0 - from.0, to.1 - from.1); let l = x.hypot(y); (x / l, y / l) };
    let mut v = Vec::with_capacity(2 * n);
    for i in 0..n {
        let t = r / (ang[i].to_radians() / 2.0).tan();
        let back = unit(c[i], c[(i + n - 1) % n]);
        let on = unit(c[i], c[(i + 1) % n]);
        v.push((c[i].0 + t * back.0, c[i].1 + t * back.1, ((180.0 - ang[i]) / 4.0).to_radians().tan()));
        v.push((c[i].0 + t * on.0, c[i].1 + t * on.1, 0.0));
    }
    Ok(v)
}

/// Dimensions of the outline. `which`:
/// 0 cutting edge length between sharp corners (side from the first corner),
/// 1 straight part of that side between the corner radii,
/// 2 centre to the sharp first corner,
/// 3 centre to the tip of the nose radius on the first corner,
/// 4 how far the nose tip sits back from the sharp corner,
/// 5 where the radius meets the side, measured from the sharp corner,
/// 6 width of the outline as drawn, 7 height as drawn, 8 area of the top face,
/// 9 first corner angle, 10 number of corners,
/// 11 and 12 the lowest x and y of the outline as drawn (centre at 0, 0),
/// 13 the corner height m of the first corner: for a four-cornered insert
/// how far the nose tip stands beyond the inscribed circle, for a triangle
/// its height above the opposite side (NaN for the other shapes, whose m
/// could not be checked against a published table).
/// Round inserts: 0, 6 and 7 are the diameter, 8 the circle area, 10 zero,
/// 11 and 12 minus the radius, the rest NaN.
pub fn dim(letter: char, d: f64, r: f64, which: u32) -> f64 {
    let Ok(v) = outline(letter, d, r) else { return f64::NAN };
    let rho = d / 2.0;
    if matches!(which, 6 | 7 | 8 | 11 | 12) {
        if which == 8 { return dxf::poly_area(&v).abs(); }
        let doc = Doc { layers: vec![("0".into(), 7)], items: vec![Item { layer: 0, geo: Geo::Poly { v, closed: true } }] };
        let Some((x0, y0, x1, y1)) = doc.extents() else { return f64::NAN };
        return match which { 6 => x1 - x0, 7 => y1 - y0, 11 => x0, _ => y0 };
    }
    if letter == 'R' { return match which { 0 => d, 10 => 0.0, _ => f64::NAN }; }
    let ang = corner_angles(letter).expect("outline succeeded");
    let half = ang[0].to_radians() / 2.0;
    match which {
        0 => crate::tooling::insert_edge_length(d, ang[0], ang[1 % ang.len()]),
        1 => (rho - r) * (1.0 / half.tan() + 1.0 / (ang[1 % ang.len()].to_radians() / 2.0).tan()),
        2 => rho / half.sin(),
        3 => rho / half.sin() - r * (1.0 / half.sin() - 1.0),
        4 => r * (1.0 / half.sin() - 1.0),
        5 => r / half.tan(),
        9 => ang[0],
        10 => ang.len() as f64,
        13 => match ang.len() { 4 => rho / half.sin() - r * (1.0 / half.sin() - 1.0) - rho, 3 => rho / half.sin() - r * (1.0 / half.sin() - 1.0) + rho, _ => f64::NAN },
        _ => f64::NAN,
    }
}

/// Inscribed circle of the bottom face of an insert with clearance: each
/// flank leans in by `clearance_deg`, so over the thickness `s` every side
/// moves in by s tan(clearance) and the circle shrinks by twice that.
/// NaN when the flanks would meet before the bottom face.
pub fn base_ic(d: f64, s: f64, clearance_deg: f64) -> f64 {
    if !(d > 0.0) || !(s >= 0.0) || !(0.0..90.0).contains(&clearance_deg) { return f64::NAN; }
    let b = d - 2.0 * s * clearance_deg.to_radians().tan();
    if b > 0.0 { b } else { f64::NAN }
}

/// The insert as a drawing: the outline on layer INSERT and the inscribed
/// circle on layer INSCRIBED (not written for a round insert, where the two
/// are the same circle).
pub fn doc(letter: char, d: f64, r: f64) -> Result<Doc, String> {
    let v = outline(letter, d, r)?;
    let mut doc = Doc::new();
    let li = doc.layer_index("INSERT", 7);
    if letter == 'R' {
        doc.items.push(Item { layer: li, geo: Geo::Circle { c: (0.0, 0.0), r: d / 2.0 } });
    } else {
        doc.items.push(Item { layer: li, geo: Geo::Poly { v, closed: true } });
        let lc = doc.layer_index("INSCRIBED", 4);
        doc.items.push(Item { layer: lc, geo: Geo::Circle { c: (0.0, 0.0), r: d / 2.0 } });
    }
    Ok(doc)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dxf::{bulge_arc, poly_area};
    use std::f64::consts::PI;

    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }
    const SHAPES: [char; 11] = ['C', 'D', 'E', 'M', 'V', 'S', 'T', 'P', 'H', 'O', 'W'];

    /// The corner angles of every shape close the polygon: they add up to (n - 2) x 180.
    #[test]
    fn angles_close_the_polygon() {
        for s in SHAPES {
            let a = corner_angles(s).unwrap();
            close(a.iter().sum::<f64>(), (a.len() as f64 - 2.0) * 180.0, 1e-9);
        }
        for s in ['A', 'B', 'K', 'L', 'R', '?'] { assert!(corner_angles(s).is_none(), "{s}"); }
    }

    /// Sharp outline: every side touches the inscribed circle, its length is
    /// the edge length formula, and the interior angles are the code's angles.
    #[test]
    fn sharp_outline_is_tangential() {
        for s in SHAPES {
            let d = 12.7;
            let c = sharp_corners(s, d).unwrap();
            let a = corner_angles(s).unwrap();
            let n = c.len();
            for i in 0..n {
                let (p, q, o) = (c[i], c[(i + 1) % n], c[(i + n - 1) % n]);
                let len = (q.0 - p.0).hypot(q.1 - p.1);
                // distance from the centre to the line through p and q
                close((p.0 * q.1 - q.0 * p.1).abs() / len, d / 2.0, 1e-9);
                close(len, crate::tooling::insert_edge_length(d, a[i], a[(i + 1) % n]), 1e-9);
                let (u, w) = ((q.0 - p.0, q.1 - p.1), (o.0 - p.0, o.1 - p.1));
                let ang = ((u.0 * w.0 + u.1 * w.1) / (u.0.hypot(u.1) * w.0.hypot(w.1))).acos().to_degrees();
                close(ang, a[i], 1e-9);
            }
            // counter-clockwise
            assert!(poly_area(&c.iter().map(|p| (p.0, p.1, 0.0)).collect::<Vec<_>>()) > 0.0, "{s}");
        }
    }

    /// Hand values: a square is d across, a triangle has side d sqrt(3) and
    /// height 1.5 d, an 80 degree rhombic is d / sin(40) long across its
    /// sharp corners and d / sin(50) across the blunt ones.
    #[test]
    fn hand_values() {
        close(dim('S', 12.7, 0.0, 6), 12.7, 1e-9);
        close(dim('S', 12.7, 0.0, 7), 12.7, 1e-9);
        close(dim('S', 12.7, 0.0, 8), 12.7 * 12.7, 1e-9);
        close(dim('T', 9.525, 0.0, 6), 9.525 * 3f64.sqrt(), 1e-9);
        close(dim('T', 9.525, 0.0, 7), 1.5 * 9.525, 1e-9);
        close(dim('C', 12.7, 0.0, 6), 12.7 / 40f64.to_radians().sin(), 1e-9);
        close(dim('C', 12.7, 0.0, 7), 12.7 / 50f64.to_radians().sin(), 1e-9);
        close(dim('C', 12.7, 0.0, 0), 12.7 / 80f64.to_radians().sin(), 1e-9);
        close(dim('H', 10.0, 0.0, 7), 10.0, 1e-9); // hexagon across flats
        close(dim('O', 10.0, 0.0, 6), 10.0, 1e-9); // octagon across flats
        close(dim('R', 10.0, 0.0, 6), 10.0, 1e-9);
        close(dim('R', 10.0, 0.0, 8), PI * 25.0, 1e-9);
        close(dim('T', 9.525, 0.0, 12), -9.525 / 2.0, 1e-9); // the triangle sits on its base
        close(dim('T', 9.525, 0.0, 11), -9.525 * 3f64.sqrt() / 2.0, 1e-9);
        close(dim('R', 10.0, 0.0, 11), -5.0, 1e-9);
        assert_eq!(dim('T', 9.525, 0.0, 10), 3.0);
        assert_eq!(dim('W', 9.525, 0.0, 10), 6.0);
        assert!(dim('K', 9.525, 0.0, 0).is_nan());
    }

    /// With a corner radius: every arc has that radius and is centred on the
    /// corner bisector, the straights still touch the inscribed circle, and
    /// the area is the sharp area less r^2 (cot(a/2) - (pi - a)/2) per corner.
    #[test]
    fn rounded_corners() {
        for s in SHAPES {
            let (d, r) = (12.7, 0.8);
            let v = outline(s, d, r).unwrap();
            let a = corner_angles(s).unwrap();
            let c = sharp_corners(s, d).unwrap();
            assert_eq!(v.len(), 2 * a.len());
            let mut area = 0.0;
            for (i, ang) in a.iter().enumerate() {
                let (p, q) = (v[2 * i], v[2 * i + 1]);
                let (cen, rad, _, _) = bulge_arc((p.0, p.1), (q.0, q.1), p.2);
                close(rad, r, 1e-9);
                // centre on the bisector: r / sin(a/2) from the sharp corner, towards the middle
                let h = ang.to_radians() / 2.0;
                close((cen.0 - c[i].0).hypot(cen.1 - c[i].1), r / h.sin(), 1e-9);
                close(cen.0.hypot(cen.1), (d / 2.0 - r) / h.sin(), 1e-9);
                // straight to the next corner touches the inscribed circle
                let nx = v[(2 * i + 2) % v.len()];
                let len = (nx.0 - q.0).hypot(nx.1 - q.1);
                close((q.0 * nx.1 - nx.0 * q.1).abs() / len, d / 2.0, 1e-9);
                close(len, (d / 2.0 - r) * (1.0 / h.tan() + 1.0 / (a[(i + 1) % a.len()].to_radians() / 2.0).tan()), 1e-9);
                area += (d / 2.0).powi(2) / h.tan() - r * r * (1.0 / h.tan() - (PI - ang.to_radians()) / 2.0);
            }
            close(poly_area(&v), area, 1e-9);
            close(dim(s, d, r, 8), area, 1e-9);
            close(dim(s, d, r, 1), (v[2].0 - v[1].0).hypot(v[2].1 - v[1].1), 1e-9);
        }
        // CNMG 12 04 08: nose tip from the centre, and how far it sits back from the sharp corner
        let h = 40f64.to_radians();
        close(dim('C', 12.7, 0.8, 3), 6.35 / h.sin() - 0.8 * (1.0 / h.sin() - 1.0), 1e-12);
        close(dim('C', 12.7, 0.8, 4), 0.8 * (1.0 / h.sin() - 1.0), 1e-12);
        close(dim('C', 12.7, 0.8, 5), 0.8 / h.tan(), 1e-12);
        close(dim('C', 12.7, 0.8, 6), 2.0 * dim('C', 12.7, 0.8, 3), 1e-9);
        // square with radius: still d across, area d^2 - (4 - pi) r^2
        close(dim('S', 12.7, 1.2, 6), 12.7, 1e-9);
        close(dim('S', 12.7, 1.2, 8), 12.7 * 12.7 - (4.0 - PI) * 1.44, 1e-9);
    }

    /// Corner heights m printed in ISO 3364:1997 (tables 2, 3 and 5, public
    /// preview). The standard works them from the inch corner radii (code 04
    /// = 1/64 in, 08 = 1/32 in, 12 = 3/64 in, 16 = 1/16 in, 24 = 3/32 in), so
    /// the check uses those; the nominal 0.4, 0.8 ... give values up to
    /// 0.008 mm smaller or larger, far inside the tolerance on m.
    #[test]
    fn iso3364_corner_heights() {
        let r = |sixty_fourths: f64| sixty_fourths * 25.4 / 64.0;
        for (shape, d, n, m) in [
            ('T', 9.525, 1.0, 13.891), ('T', 9.525, 2.0, 13.494), ('T', 9.525, 3.0, 13.097),
            ('T', 12.7, 2.0, 18.256), ('T', 12.7, 3.0, 17.859), ('T', 12.7, 4.0, 17.463),
            ('T', 15.875, 3.0, 22.622), ('T', 15.875, 4.0, 22.225),
            ('S', 9.525, 1.0, 1.808), ('S', 9.525, 2.0, 1.644),
            ('S', 12.7, 1.0, 2.466), ('S', 12.7, 2.0, 2.301), ('S', 12.7, 3.0, 2.137),
            ('S', 25.4, 6.0, 4.274),
            ('D', 12.7, 1.0, 6.939), ('D', 12.7, 2.0, 6.477), ('D', 12.7, 3.0, 6.014), ('D', 12.7, 4.0, 5.552),
        ] {
            close(dim(shape, d, r(n), 13), m, 0.00051);
        }
        // nominal radius: SNMG 12 04 08 with r 0.8 exactly
        close(dim('S', 12.7, 0.8, 13), 2.2989, 0.0001);
        assert!(dim('W', 12.7, 0.8, 13).is_nan());
        assert!(dim('R', 12.7, 0.0, 13).is_nan());
    }

    #[test]
    fn refusals() {
        assert!(outline('C', 0.0, 0.4).is_err());
        assert!(outline('C', 12.7, -0.1).is_err());
        assert!(outline('C', 12.7, 6.35).is_err());
        assert!(outline('C', 12.7, f64::NAN).is_err());
        assert!(outline('K', 12.7, 0.4).is_err());
        assert!(outline('C', 12.7, 6.3).is_ok());
        assert_eq!(outline('R', 10.0, 99.0).unwrap().len(), 2);
    }

    /// Bottom face of a positive insert: CCMT 09 T3 (d 9.525, s 3.97, 7 deg).
    #[test]
    fn clearance_base() {
        close(base_ic(9.525, 3.97, 7.0), 9.525 - 2.0 * 3.97 * 7f64.to_radians().tan(), 1e-12);
        close(base_ic(12.7, 4.76, 0.0), 12.7, 1e-12);
        assert!(base_ic(3.97, 7.94, 30.0).is_nan());
        assert!(base_ic(12.7, 4.76, 90.0).is_nan());
    }

    /// The drawing reads back from DXF with the same outline area.
    #[test]
    fn dxf_round_trip() {
        let d = doc('D', 12.7, 0.4).unwrap();
        let text = crate::dxf::write_doc(&d, crate::dxf::Units::Mm, crate::dxf::Version::R2000);
        let back = crate::dxf::read_dxf(&text).unwrap();
        let poly = back.doc.items.iter().find_map(|i| if let Geo::Poly { v, .. } = &i.geo { Some(v.clone()) } else { None }).unwrap();
        close(poly_area(&poly), dim('D', 12.7, 0.4, 8), 1e-6);
        assert_eq!(doc('R', 10.0, 0.0).unwrap().items.len(), 1);
    }
}
