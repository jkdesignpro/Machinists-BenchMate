//! Parametric 2D shapes for the DXF generator: hole patterns, slots,
//! rectangles, polygons, rings and simple profiles (keyhole, D-flat,
//! double-D). Every shape is built in its own units (the caller's inch or
//! mm) around the origin, outer profiles counter-clockwise on the OUTLINE
//! layer, round holes on HOLES, optional centre marks on CENTRE.
//!
//! Plane geometry only (circle-line intersection, regular polygon
//! circumradius R = F / (2 cos(pi / n))). Bolt circle positions come from
//! `crate::bolt_circle`. See docs/cad-dxf.md.

use crate::dxf::{Drawing, Layer};
use std::f64::consts::PI;

/// Shape numbers used by the UI and the WebAssembly wrapper.
pub mod shape {
    pub const BOLT_CIRCLE: u32 = 0;
    pub const GRID: u32 = 1;
    pub const SLOT: u32 = 2;
    pub const ARC_SLOT: u32 = 3;
    pub const RECTANGLE: u32 = 4;
    pub const POLYGON: u32 = 5;
    pub const RING: u32 = 6;
    pub const KEYHOLE: u32 = 7;
    pub const D_FLAT: u32 = 8;
    pub const DOUBLE_D: u32 = 9;
}

type R = Result<Drawing, String>;
const EPS: f64 = 1e-9;

fn pos(x: f64, what: &str) -> Result<f64, String> {
    if x.is_finite() && x > 0.0 { Ok(x) } else { Err(format!("{what} must be greater than zero.")) }
}
fn opt(x: f64, what: &str) -> Result<f64, String> {
    if x.is_nan() || x == 0.0 { Ok(0.0) } else if x.is_finite() && x > 0.0 { Ok(x) } else { Err(format!("{what} must be zero (none) or greater than zero.")) }
}
fn count(x: f64, lo: u32, hi: u32, what: &str) -> Result<u32, String> {
    if x.is_finite() && x.fract() == 0.0 && x >= lo as f64 && x <= hi as f64 { Ok(x as u32) } else { Err(format!("{what} must be a whole number from {lo} to {hi}.")) }
}
fn ang(x: f64) -> f64 { if x.is_finite() { x } else { 0.0 } }

/// Rectangle centred on the origin with corner radius `r` (0 = sharp), CCW,
/// starting at the bottom edge. Bulge of a 90 degree arc = tan(22.5 deg).
pub fn rounded_rect(w: f64, h: f64, r: f64) -> Vec<(f64, f64, f64)> {
    let (x0, y0, x1, y1) = (-w / 2.0, -h / 2.0, w / 2.0, h / 2.0);
    if r <= 0.0 { return vec![(x0, y0, 0.0), (x1, y0, 0.0), (x1, y1, 0.0), (x0, y1, 0.0)]; }
    let b = (PI / 8.0).tan();
    vec![(x0 + r, y0, 0.0), (x1 - r, y0, b), (x1, y0 + r, 0.0), (x1, y1 - r, b), (x1 - r, y1, 0.0), (x0 + r, y1, b), (x0, y1 - r, 0.0), (x0, y0 + r, b)]
}

/// Circumradius of a regular n-gon from its size across flats (`across_corners`
/// false) or across corners (true). Across flats F: R = F / (2 cos(pi / n)).
pub fn polygon_circumradius(n: u32, size: f64, across_corners: bool) -> f64 {
    if across_corners { size / 2.0 } else { size / (2.0 * (PI / n as f64).cos()) }
}

/// Regular polygon dimensions: which 0 across corners, 1 across flats
/// (for odd n: flat to opposite corner, i.e. R + r), 2 side length, 3 area.
/// Across flats for even n is 2 r with r = R cos(pi / n); side = 2 R sin(pi / n).
pub fn polygon_dims(n: f64, size: f64, across_corners: f64, which: f64) -> f64 {
    if !(n >= 3.0) || !(size > 0.0) { return f64::NAN; }
    let n = n.round() as u32;
    let rr = polygon_circumradius(n, size, across_corners != 0.0);
    let ri = rr * (PI / n as f64).cos();
    match which as u32 {
        0 => 2.0 * rr,
        1 => if n % 2 == 0 { 2.0 * ri } else { rr + ri },
        2 => 2.0 * rr * (PI / n as f64).sin(),
        3 => 0.5 * n as f64 * rr * rr * (2.0 * PI / n as f64).sin(),
        _ => f64::NAN,
    }
}

fn mark(d: &mut Drawing, on: bool, c: (f64, f64), r: f64) { if on { d.centre_mark(c, r * 1.25); } }

/// Build shape `kind` from its parameter list `p` (see the per-shape comments).
/// `marks` adds centre marks (and the pitch circle / slot centreline).
pub fn build(kind: u32, p: &[f64], marks: bool) -> R {
    let g = |i: usize| p.get(i).copied().unwrap_or(f64::NAN);
    match kind {
        shape::BOLT_CIRCLE => bolt_circle_shape(g(0), g(1), g(2), g(3), g(4), g(5), marks),
        shape::GRID => grid(g(0), g(1), g(2), g(3), g(4), g(5), g(6), marks),
        shape::SLOT => slot(g(0), g(1), g(2), marks),
        shape::ARC_SLOT => arc_slot(g(0), g(1), g(2), g(3), marks),
        shape::RECTANGLE => rectangle(g(0), g(1), g(2), g(3), g(4), marks),
        shape::POLYGON => polygon(g(0), g(1), g(2), g(3), g(4), marks),
        shape::RING => ring(g(0), g(1), marks),
        shape::KEYHOLE => keyhole(g(0), g(1), g(2), g(3), marks),
        shape::D_FLAT => d_flat(g(0), g(1), g(2), marks),
        shape::DOUBLE_D => double_d(g(0), g(1), g(2), marks),
        _ => Err("Unknown shape.".into()),
    }
}

/// Bolt circle: [pitch circle dia, holes, hole dia, start angle, flange OD (0 none), centre bore (0 none)].
pub fn bolt_circle_shape(bc: f64, n: f64, hd: f64, start: f64, od: f64, bore: f64, marks: bool) -> R {
    let bc = pos(bc, "Bolt circle diameter")?;
    let n = count(n, 1, 360, "Number of holes")?;
    let hd = pos(hd, "Hole diameter")?;
    let od = opt(od, "Outside diameter")?;
    let bore = opt(bore, "Centre bore")?;
    if n >= 2 && bc * (PI / n as f64).sin() <= hd + EPS { return Err("The holes overlap: the spacing between holes is not more than the hole diameter.".into()); }
    if n == 1 && hd >= bc { return Err("The hole is larger than the bolt circle.".into()); }
    if od > 0.0 && od <= bc + hd + EPS { return Err("The outside diameter cuts into the holes: it must be more than the bolt circle plus one hole diameter.".into()); }
    if bore > 0.0 && bore >= bc - hd - EPS { return Err("The centre bore cuts into the holes: it must be less than the bolt circle minus one hole diameter.".into()); }
    let mut d = Drawing::new();
    if od > 0.0 { d.circle(Layer::Outline, (0.0, 0.0), od / 2.0); }
    if bore > 0.0 { d.circle(Layer::Holes, (0.0, 0.0), bore / 2.0); }
    for c in crate::bolt_circle(n, bc, ang(start), 0.0, 0.0) {
        d.circle(Layer::Holes, c, hd / 2.0);
        mark(&mut d, marks, c, hd / 2.0);
    }
    if marks { d.circle(Layer::Centre, (0.0, 0.0), bc / 2.0); d.centre_mark((0.0, 0.0), (hd / 2.0).max(bc * 0.06)); }
    Ok(d)
}

/// Grid of holes: [columns, rows, pitch X, pitch Y, hole dia, plate margin
/// (0 = no plate), plate corner radius]. Centred on the origin.
#[allow(clippy::too_many_arguments)]
pub fn grid(nx: f64, ny: f64, px: f64, py: f64, hd: f64, margin: f64, cr: f64, marks: bool) -> R {
    let nx = count(nx, 1, 200, "Columns")?;
    let ny = count(ny, 1, 200, "Rows")?;
    let hd = pos(hd, "Hole diameter")?;
    let px = if nx > 1 { pos(px, "Pitch X")? } else { 0.0 };
    let py = if ny > 1 { pos(py, "Pitch Y")? } else { 0.0 };
    if nx > 1 && px <= hd + EPS { return Err("The holes overlap in X: pitch X must be more than the hole diameter.".into()); }
    if ny > 1 && py <= hd + EPS { return Err("The holes overlap in Y: pitch Y must be more than the hole diameter.".into()); }
    let margin = opt(margin, "Plate margin")?;
    let cr = opt(cr, "Corner radius")?;
    let (gw, gh) = ((nx - 1) as f64 * px, (ny - 1) as f64 * py);
    let mut d = Drawing::new();
    if margin > 0.0 {
        if margin <= hd / 2.0 + EPS { return Err("The plate margin must be more than the hole radius.".into()); }
        let (w, h) = (gw + 2.0 * margin, gh + 2.0 * margin);
        if cr > w.min(h) / 2.0 + EPS { return Err("The corner radius is more than half the plate width or height.".into()); }
        d.closed_poly(Layer::Outline, rounded_rect(w, h, cr.min(w.min(h) / 2.0)));
    }
    for j in 0..ny { for i in 0..nx {
        let c = (-gw / 2.0 + i as f64 * px, -gh / 2.0 + j as f64 * py);
        d.circle(Layer::Holes, c, hd / 2.0);
        mark(&mut d, marks, c, hd / 2.0);
    } }
    Ok(d)
}

/// Straight slot: [centre distance of the end radii, width, angle]. Outline CCW
/// with two half-circle ends (bulge 1).
pub fn slot(l: f64, w: f64, angle: f64, marks: bool) -> R {
    let l = pos(l, "Centre distance")?;
    let w = pos(w, "Slot width")?;
    let (a, b) = (l / 2.0, w / 2.0);
    let mut d = Drawing::new();
    d.closed_poly(Layer::Outline, vec![(-a, -b, 0.0), (a, -b, 1.0), (a, b, 0.0), (-a, b, 1.0)]);
    if marks { mark(&mut d, true, (-a, 0.0), b); mark(&mut d, true, (a, 0.0), b); d.line(Layer::Centre, (-a, 0.0), (a, 0.0)); }
    d.rotate(ang(angle));
    Ok(d)
}

/// Arc slot: [centreline radius, width, start angle, sweep angle]. Centred on
/// the origin; outer arc bulge tan(sweep / 4), inner arc the negative.
pub fn arc_slot(r: f64, w: f64, start: f64, sweep: f64, marks: bool) -> R {
    let r = pos(r, "Centreline radius")?;
    let w = pos(w, "Slot width")?;
    let sw = pos(sweep, "Sweep angle")?;
    if w >= 2.0 * r - EPS { return Err("The slot is wider than twice the centreline radius.".into()); }
    if sw >= 360.0 { return Err("The sweep angle must be less than 360 degrees.".into()); }
    let gap = (360.0 - sw).to_radians();
    if gap < PI && 2.0 * r * (gap / 2.0).sin() <= w + EPS { return Err("The two ends of the slot run into each other: reduce the sweep or the width.".into()); }
    let s = ang(start);
    let (ro, ri, b) = (r + w / 2.0, r - w / 2.0, (sw.to_radians() / 4.0).tan());
    let at = |rad: f64, deg: f64| (rad * deg.to_radians().cos(), rad * deg.to_radians().sin());
    let (os, oe, ie, is) = (at(ro, s), at(ro, s + sw), at(ri, s + sw), at(ri, s));
    let mut d = Drawing::new();
    d.closed_poly(Layer::Outline, vec![(os.0, os.1, b), (oe.0, oe.1, 1.0), (ie.0, ie.1, -b), (is.0, is.1, 1.0)]);
    if marks {
        mark(&mut d, true, at(r, s), w / 2.0); mark(&mut d, true, at(r, s + sw), w / 2.0);
        d.arc(Layer::Centre, (0.0, 0.0), r, s, s + sw);
        d.centre_mark((0.0, 0.0), w / 2.0);
    }
    Ok(d)
}

/// Rectangle: [width, height, corner radius, corner hole dia (0 none), hole inset from the edges].
pub fn rectangle(w: f64, h: f64, cr: f64, hd: f64, inset: f64, marks: bool) -> R {
    let w = pos(w, "Width")?;
    let h = pos(h, "Height")?;
    let cr = opt(cr, "Corner radius")?;
    if cr > w.min(h) / 2.0 + EPS { return Err("The corner radius is more than half the width or height.".into()); }
    let hd = opt(hd, "Hole diameter")?;
    let mut d = Drawing::new();
    d.closed_poly(Layer::Outline, rounded_rect(w, h, cr.min(w.min(h) / 2.0)));
    if hd > 0.0 {
        let inset = pos(inset, "Hole inset")?;
        if inset <= hd / 2.0 + EPS { return Err("The hole inset must be more than the hole radius.".into()); }
        let (x, y) = (w / 2.0 - inset, h / 2.0 - inset);
        if x <= hd / 2.0 + EPS || y <= hd / 2.0 + EPS { return Err("The corner holes overlap: the inset is too large for the plate.".into()); }
        if cr > 0.0 {
            // The rounded rectangle is the inner rectangle (half sizes ax, ay) grown by cr,
            // so a hole is inside when its centre is within cr - hole radius of that rectangle.
            let (ax, ay) = (w / 2.0 - cr, h / 2.0 - cr);
            if (x - ax).max(0.0).hypot((y - ay).max(0.0)) + hd / 2.0 >= cr - EPS { return Err("The corner holes break out through the corner radius.".into()); }
        }
        for c in [(-x, -y), (x, -y), (x, y), (-x, y)] { d.circle(Layer::Holes, c, hd / 2.0); mark(&mut d, marks, c, hd / 2.0); }
    }
    if marks { d.centre_mark((0.0, 0.0), w.min(h) * 0.08); }
    Ok(d)
}

/// Regular polygon: [sides, size, size is across corners (1) or across flats (0),
/// rotation, centre bore (0 none)]. A flat at the bottom at rotation 0.
pub fn polygon(n: f64, size: f64, corners: f64, rotation: f64, bore: f64, marks: bool) -> R {
    let n = count(n, 3, 200, "Number of sides")?;
    let size = pos(size, "Size")?;
    let bore = opt(bore, "Centre bore")?;
    let rr = polygon_circumradius(n, size, corners == 1.0);
    if bore > 0.0 && bore / 2.0 >= rr * (PI / n as f64).cos() - EPS { return Err("The centre bore is larger than the polygon across flats.".into()); }
    let mut d = Drawing::new();
    let v = (0..n).map(|k| { let a = (-90.0 + 180.0 / n as f64 + 360.0 * k as f64 / n as f64).to_radians(); (rr * a.cos(), rr * a.sin(), 0.0) }).collect();
    d.closed_poly(Layer::Outline, v);
    if bore > 0.0 { d.circle(Layer::Holes, (0.0, 0.0), bore / 2.0); }
    if marks { d.centre_mark((0.0, 0.0), if bore > 0.0 { bore / 2.0 * 1.25 } else { rr * 0.15 }); }
    d.rotate(ang(rotation));
    Ok(d)
}

/// Circle or ring: [outside diameter, inside diameter (0 = solid disc)].
pub fn ring(od: f64, id: f64, marks: bool) -> R {
    let od = pos(od, "Outside diameter")?;
    let id = opt(id, "Inside diameter")?;
    if id >= od - EPS { return Err("The inside diameter must be less than the outside diameter.".into()); }
    let mut d = Drawing::new();
    d.circle(Layer::Outline, (0.0, 0.0), od / 2.0);
    if id > 0.0 { d.circle(Layer::Holes, (0.0, 0.0), id / 2.0); }
    if marks { d.centre_mark((0.0, 0.0), if id > 0.0 { id / 2.0 * 1.25 } else { od * 0.1 }); }
    Ok(d)
}

/// Keyhole: [head diameter, slot width, distance from the head centre to the
/// slot end radius centre, rotation]. Head at the origin, slot pointing down
/// (-Y) at rotation 0. The slot sides meet the head circle at y = -sqrt(R^2 - (w/2)^2).
pub fn keyhole(dh: f64, w: f64, l: f64, rotation: f64, marks: bool) -> R {
    let dh = pos(dh, "Head diameter")?;
    let w = pos(w, "Slot width")?;
    let l = pos(l, "Slot length")?;
    let (r, b) = (dh / 2.0, w / 2.0);
    if w >= dh - EPS { return Err("The slot must be narrower than the head diameter.".into()); }
    let yc = (r * r - b * b).sqrt();
    if l <= yc + EPS { return Err("The slot is too short: it ends inside the head circle.".into()); }
    let sweep = 2.0 * PI - 2.0 * (b / r).asin();
    let mut d = Drawing::new();
    d.closed_poly(Layer::Outline, vec![(b, -yc, (sweep / 4.0).tan()), (-b, -yc, 0.0), (-b, -l, 1.0), (b, -l, 0.0)]);
    if marks { mark(&mut d, true, (0.0, 0.0), r); mark(&mut d, true, (0.0, -l), b); }
    d.rotate(ang(rotation));
    Ok(d)
}

/// D-flat: [diameter, across-flat size (flat to the far side of the circle), rotation].
/// Flat on +Y at rotation 0, at y = A - R.
pub fn d_flat(dia: f64, a: f64, rotation: f64, marks: bool) -> R {
    let dia = pos(dia, "Diameter")?;
    let a = pos(a, "Across-flat size")?;
    if a >= dia - EPS { return Err("The across-flat size must be less than the diameter.".into()); }
    let r = dia / 2.0;
    let yf = a - r;
    let x0 = (r * r - yf * yf).sqrt();
    let alpha = yf.atan2(x0);
    let sweep = PI + 2.0 * alpha;
    let mut d = Drawing::new();
    d.closed_poly(Layer::Outline, vec![(-x0, yf, (sweep / 4.0).tan()), (x0, yf, 0.0)]);
    if marks { d.centre_mark((0.0, 0.0), r * 0.25); }
    d.rotate(ang(rotation));
    Ok(d)
}

/// Double-D: [diameter, across flats, rotation]. Flats on +Y and -Y at rotation 0.
pub fn double_d(dia: f64, af: f64, rotation: f64, marks: bool) -> R {
    let dia = pos(dia, "Diameter")?;
    let af = pos(af, "Across flats")?;
    if af >= dia - EPS { return Err("The across-flats size must be less than the diameter.".into()); }
    let (r, h) = (dia / 2.0, af / 2.0);
    let x0 = (r * r - h * h).sqrt();
    let b = ((2.0 * h.atan2(x0)) / 4.0).tan();
    let mut d = Drawing::new();
    d.closed_poly(Layer::Outline, vec![(x0, -h, b), (x0, h, 0.0), (-x0, h, b), (-x0, -h, 0.0)]);
    if marks { d.centre_mark((0.0, 0.0), r * 0.25); }
    d.rotate(ang(rotation));
    Ok(d)
}

#[cfg(test)]
mod tests {
    //! Round trip: build, write, parse the DXF back with a small reader
    //! written here, then check the geometry against closed-form values.
    use super::*;
    use crate::dxf::*;
    use std::collections::HashMap;

    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    /// Parsed entity: kind, layer, numeric group codes (all values per code, in order).
    #[derive(Debug)]
    struct Ent { kind: String, layer: String, codes: Vec<(i32, String)> }
    impl Ent {
        fn f(&self, code: i32) -> f64 { self.codes.iter().find(|c| c.0 == code).map(|c| c.1.trim().parse().unwrap()).unwrap() }
        fn all(&self, code: i32) -> Vec<f64> { self.codes.iter().filter(|c| c.0 == code).map(|c| c.1.trim().parse().unwrap()).collect() }
        fn s(&self, code: i32) -> Option<&str> { self.codes.iter().find(|c| c.0 == code).map(|c| c.1.as_str()) }
    }
    struct Parsed { header: HashMap<String, Vec<(i32, String)>>, sections: Vec<String>, entities: Vec<Ent>, handles: Vec<u64>, tables: HashMap<String, Vec<Ent>> }

    /// Minimal DXF reader: group code / value pairs, sections, header
    /// variables, table entries and ENTITIES (POLYLINE/VERTEX/SEQEND folded
    /// into one polyline record with 10/20/42 per vertex).
    fn parse(txt: &str) -> Parsed {
        let lines: Vec<&str> = txt.split("\r\n").collect();
        assert!(lines.len() % 2 == 1 && lines.last() == Some(&""), "pairs end with CRLF");
        let pairs: Vec<(i32, String)> = lines[..lines.len() - 1].chunks(2).map(|c| (c[0].trim().parse::<i32>().expect("group code"), c[1].to_string())).collect();
        assert_eq!(pairs.last().unwrap(), &(0, "EOF".to_string()));
        let mut p = Parsed { header: HashMap::new(), sections: vec![], entities: vec![], handles: vec![], tables: HashMap::new() };
        let mut i = 0;
        let mut section = String::new();
        let mut table = String::new();
        while i < pairs.len() {
            let (c, v) = (&pairs[i].0, pairs[i].1.clone());
            if (*c == 5 || *c == 105) && section != "HEADER" { p.handles.push(u64::from_str_radix(&v, 16).unwrap()); }
            if *c == 0 && v == "SECTION" { section = pairs[i + 1].1.clone(); p.sections.push(section.clone()); i += 2; continue; }
            if *c == 0 && v == "ENDSEC" { section.clear(); i += 1; continue; }
            if section == "HEADER" && *c == 9 {
                let mut vals = vec![]; let mut j = i + 1;
                while j < pairs.len() && pairs[j].0 != 9 && pairs[j].0 != 0 { vals.push(pairs[j].clone()); j += 1; }
                p.header.insert(v, vals); i = j; continue;
            }
            if section == "TABLES" && *c == 0 {
                if v == "TABLE" { table = pairs[i + 1].1.clone(); i += 2; continue; }
                if v == "ENDTAB" { i += 1; continue; }
                let mut e = Ent { kind: v.clone(), layer: String::new(), codes: vec![] }; let mut j = i + 1;
                while pairs[j].0 != 0 { if pairs[j].0 == 5 || pairs[j].0 == 105 { p.handles.push(u64::from_str_radix(&pairs[j].1, 16).unwrap()); } e.codes.push(pairs[j].clone()); j += 1; }
                p.tables.entry(table.clone()).or_default().push(e); i = j; continue;
            }
            if section == "ENTITIES" && *c == 0 {
                let mut e = Ent { kind: v.clone(), layer: String::new(), codes: vec![] }; let mut j = i + 1;
                while pairs[j].0 != 0 { if pairs[j].0 == 8 { e.layer = pairs[j].1.clone(); } if pairs[j].0 == 5 { p.handles.push(u64::from_str_radix(&pairs[j].1, 16).unwrap()); } e.codes.push(pairs[j].clone()); j += 1; }
                if v == "POLYLINE" {
                    // Collect VERTEX records until SEQEND.
                    let mut verts = vec![];
                    while pairs[j].1 == "VERTEX" {
                        let mut k = j + 1; let (mut x, mut y, mut b) = (0.0, 0.0, 0.0);
                        while pairs[k].0 != 0 { match pairs[k].0 { 10 => x = pairs[k].1.parse().unwrap(), 20 => y = pairs[k].1.parse().unwrap(), 42 => b = pairs[k].1.parse().unwrap(), _ => {} } k += 1; }
                        verts.push((x, y, b)); j = k;
                    }
                    assert_eq!(pairs[j].1, "SEQEND");
                    j += 1; while pairs[j].0 != 0 { j += 1; }
                    e.codes.retain(|c| c.0 == 70 || c.0 == 8);
                    e.codes.push((90, verts.len().to_string()));
                    for (x, y, b) in verts { e.codes.push((10, x.to_string())); e.codes.push((20, y.to_string())); e.codes.push((42, b.to_string())); }
                }
                p.entities.push(e); i = j; continue;
            }
            i += 1;
        }
        p
    }

    /// Polyline vertices (x, y, bulge) of a parsed LWPOLYLINE or folded POLYLINE.
    fn verts(e: &Ent) -> Vec<(f64, f64, f64)> {
        let mut v: Vec<(f64, f64, f64)> = vec![];
        for (c, s) in &e.codes {
            let x: f64 = match s.trim().parse() { Ok(x) => x, Err(_) => continue };
            match c { 10 => v.push((x, 0.0, 0.0)), 20 => v.last_mut().unwrap().1 = x, 42 => v.last_mut().unwrap().2 = x, _ => {} }
        }
        assert_eq!(v.len(), e.f(90) as usize);
        v
    }

    fn roundtrip(d: &Drawing, u: Units, ver: Version) -> Parsed {
        let txt = write_dxf(d, u, ver);
        let p = parse(&txt);
        // Every handle unique, all below $HANDSEED.
        let mut h = p.handles.clone(); h.sort(); let n = h.len(); h.dedup(); assert_eq!(h.len(), n, "duplicate handles");
        if ver == Version::R2000 {
            let seed = u64::from_str_radix(&p.header["$HANDSEED"][0].1, 16).unwrap();
            assert!(h.iter().all(|x| *x < seed && *x > 0));
            assert_eq!(p.header["$ACADVER"][0].1, "AC1015");
            assert_eq!(p.header["$INSUNITS"][0].1, u.insunits().to_string());
            assert_eq!(p.sections, ["HEADER", "CLASSES", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS"]);
            for t in ["VPORT", "LTYPE", "LAYER", "STYLE", "APPID", "DIMSTYLE", "BLOCK_RECORD"] { assert!(p.tables.contains_key(t), "table {t}"); }
        } else {
            assert_eq!(p.header["$ACADVER"][0].1, "AC1009");
            assert!(!p.header.contains_key("$INSUNITS"));
        }
        let layers: Vec<&str> = p.tables["LAYER"].iter().map(|e| e.s(2).unwrap()).collect();
        for e in &p.entities { assert!(layers.contains(&e.layer.as_str()), "layer {} defined", e.layer); }
        assert_eq!(p.entities.len(), d.entities.len());
        // Header extents match the model.
        let (x0, y0, x1, y1) = d.extents().unwrap();
        let ext: Vec<f64> = p.header["$EXTMAX"].iter().map(|c| c.1.parse().unwrap()).collect();
        close(ext[0], x1, 1e-9); close(ext[1], y1, 1e-9);
        let ext: Vec<f64> = p.header["$EXTMIN"].iter().map(|c| c.1.parse().unwrap()).collect();
        close(ext[0], x0, 1e-9); close(ext[1], y0, 1e-9);
        p
    }

    fn outline(p: &Parsed) -> Vec<(f64, f64, f64)> {
        let e = p.entities.iter().find(|e| e.layer == "OUTLINE" && (e.kind == "LWPOLYLINE" || e.kind == "POLYLINE")).expect("outline polyline");
        assert_eq!(e.f(70) as i32 & 1, 1, "closed");
        verts(e)
    }

    #[test]
    fn number_format() {
        assert_eq!(num(1.0), "1"); assert_eq!(num(-0.0), "0"); assert_eq!(num(-1e-13), "0");
        assert_eq!(num(2.5), "2.5"); assert_eq!(num(1.0 / 3.0), "0.3333333333"); assert_eq!(num(-12.75), "-12.75");
    }

    #[test]
    fn bulge_arc_semicircle() {
        // (1,0) -> (-1,0) with bulge 1 is the upper half of the unit circle, CCW 0..180.
        let (c, r, s, e) = bulge_arc((1.0, 0.0), (-1.0, 0.0), 1.0);
        close(c.0, 0.0, 1e-12); close(c.1, 0.0, 1e-12); close(r, 1.0, 1e-12); close(s, 0.0, 1e-12); close(e, 180.0, 1e-12);
        // Bulge -1 the other way: the arc from (1,0) clockwise to (-1,0) is the lower half, CCW 180..360.
        let (_, _, s, e) = bulge_arc((1.0, 0.0), (-1.0, 0.0), -1.0);
        close(s, 180.0, 1e-12); close(e.rem_euclid(360.0), 0.0, 1e-12);
        // Quarter arc (bulge tan 22.5 deg) from (1,0) to (0,1) about the origin.
        let (c, r, _, _) = bulge_arc((1.0, 0.0), (0.0, 1.0), (PI / 8.0).tan());
        close(c.0, 0.0, 1e-12); close(c.1, 0.0, 1e-12); close(r, 1.0, 1e-12);
    }

    #[test]
    fn bolt_circle_roundtrip() {
        for ver in [Version::R2000, Version::R12] {
            let d = build(shape::BOLT_CIRCLE, &[100.0, 6.0, 9.0, 15.0, 130.0, 40.0], true).unwrap();
            let p = roundtrip(&d, Units::Mm, ver);
            let holes: Vec<&Ent> = p.entities.iter().filter(|e| e.kind == "CIRCLE" && e.layer == "HOLES" && (e.f(40) - 4.5).abs() < 1e-12).collect();
            assert_eq!(holes.len(), 6);
            for (h, c) in holes.iter().zip(crate::bolt_circle(6, 100.0, 15.0, 0.0, 0.0)) { close(h.f(10), c.0, 1e-9); close(h.f(20), c.1, 1e-9); close(h.f(10).hypot(h.f(20)), 50.0, 1e-9); }
            // First hole at 15 deg: x = 50 cos 15 = 48.2963, y = 12.9410.
            close(holes[0].f(10), 48.29629131, 1e-7); close(holes[0].f(20), 12.94095226, 1e-7);
            let od = p.entities.iter().find(|e| e.kind == "CIRCLE" && e.layer == "OUTLINE").unwrap();
            close(od.f(40), 65.0, 1e-12);
            assert!(p.entities.iter().any(|e| e.kind == "CIRCLE" && e.layer == "HOLES" && e.f(40) == 20.0));
            assert_eq!(p.entities.iter().filter(|e| e.layer == "CENTRE" && e.kind == "LINE").count(), 6 * 2 + 2);
            // Extents are the OD.
            close(d.extents().unwrap().2, 65.0, 1e-12);
        }
        // Inch drawing: $INSUNITS 1, $MEASUREMENT 0.
        let d = build(shape::BOLT_CIRCLE, &[4.0, 4.0, 0.25, 45.0, 0.0, 0.0], false).unwrap();
        let p = roundtrip(&d, Units::Inch, Version::R2000);
        assert_eq!(p.header["$INSUNITS"][0].1, "1"); assert_eq!(p.header["$MEASUREMENT"][0].1, "0");
        assert_eq!(p.entities.len(), 4);
        let mm = roundtrip(&d, Units::Mm, Version::R2000);
        assert_eq!(mm.header["$INSUNITS"][0].1, "4"); assert_eq!(mm.header["$MEASUREMENT"][0].1, "1");
        // Overlapping holes are refused: 12 holes of 30 on a 100 circle (spacing 25.9).
        assert!(build(shape::BOLT_CIRCLE, &[100.0, 12.0, 30.0, 0.0, 0.0, 0.0], false).is_err());
        assert!(build(shape::BOLT_CIRCLE, &[100.0, 6.0, 10.0, 0.0, 105.0, 0.0], false).is_err());
    }

    #[test]
    fn grid_and_plate() {
        let d = build(shape::GRID, &[4.0, 3.0, 20.0, 15.0, 6.0, 10.0, 5.0], true).unwrap();
        let p = roundtrip(&d, Units::Mm, Version::R2000);
        let holes: Vec<&Ent> = p.entities.iter().filter(|e| e.kind == "CIRCLE").collect();
        assert_eq!(holes.len(), 12);
        let xs: Vec<f64> = holes.iter().map(|h| h.f(10)).collect();
        close(xs.iter().cloned().fold(f64::MAX, f64::min), -30.0, 1e-12); close(xs.iter().cloned().fold(f64::MIN, f64::max), 30.0, 1e-12);
        // Plate 80 x 50 with R5 corners: area = 80*50 - (4 - pi) 25.
        close(poly_area(&outline(&p)), 4000.0 - (4.0 - PI) * 25.0, 1e-7);
        let (x0, y0, x1, y1) = d.extents().unwrap();
        close(x1 - x0, 80.0, 1e-12); close(y1 - y0, 50.0, 1e-12);
        assert!(build(shape::GRID, &[3.0, 1.0, 5.0, 0.0, 6.0, 0.0, 0.0], false).is_err());
    }

    #[test]
    fn slots() {
        for ver in [Version::R2000, Version::R12] {
            // Straight slot 40 c-c, 10 wide, at 30 deg: area = 40*10 + pi 25; length overall 50.
            let d = build(shape::SLOT, &[40.0, 10.0, 30.0], false).unwrap();
            let p = roundtrip(&d, Units::Mm, ver);
            let v = outline(&p);
            close(poly_area(&v), 400.0 + PI * 25.0, 1e-7);
            close(poly_length(&v, true), 80.0 + PI * 10.0, 1e-7);
            // Arc slot R50, 10 wide, 90 deg sweep from 0: area = (pi/2) 50 * 10 + pi 25.
            let d = build(shape::ARC_SLOT, &[50.0, 10.0, 0.0, 90.0], true).unwrap();
            let p = roundtrip(&d, Units::Mm, ver);
            close(poly_area(&outline(&p)), PI / 2.0 * 500.0 + PI * 25.0, 1e-7);
            // Extents: outer arc to 55 on both axes, end caps reach -5 below/left of the axes.
            let (x0, y0, x1, y1) = d.part_extents().unwrap();
            close(x1, 55.0, 1e-9); close(y1, 55.0, 1e-9); close(x0, -5.0, 1e-9); close(y0, -5.0, 1e-9);
        }
        // A 270 deg arc slot (bulge > 1) is still exact.
        let d = build(shape::ARC_SLOT, &[30.0, 8.0, 45.0, 270.0], false).unwrap();
        let p = roundtrip(&d, Units::Inch, Version::R2000);
        close(poly_area(&outline(&p)), 1.5 * PI * 30.0 * 8.0 + PI * 16.0, 1e-7);
        assert!(build(shape::ARC_SLOT, &[30.0, 8.0, 0.0, 350.0], false).is_err());
        assert!(build(shape::ARC_SLOT, &[3.0, 8.0, 0.0, 90.0], false).is_err());
    }

    #[test]
    fn rectangle_polygon_ring() {
        let d = build(shape::RECTANGLE, &[100.0, 60.0, 8.0, 6.6, 10.0], true).unwrap();
        let p = roundtrip(&d, Units::Mm, Version::R2000);
        close(poly_area(&outline(&p)), 6000.0 - (4.0 - PI) * 64.0, 1e-7);
        let holes: Vec<&Ent> = p.entities.iter().filter(|e| e.kind == "CIRCLE" && e.layer == "HOLES").collect();
        assert_eq!(holes.len(), 4);
        for h in holes { close(h.f(10).abs(), 40.0, 1e-12); close(h.f(20).abs(), 20.0, 1e-12); close(h.f(40), 3.3, 1e-12); }
        // Full radius ends (r = h/2) give a stadium with 6 vertices after merging.
        let d = build(shape::RECTANGLE, &[100.0, 60.0, 30.0, 0.0, 0.0], false).unwrap();
        let p = roundtrip(&d, Units::Mm, Version::R2000);
        let v = outline(&p); assert_eq!(v.len(), 6);
        close(poly_area(&v), 40.0 * 60.0 + PI * 900.0, 1e-7);
        assert!(build(shape::RECTANGLE, &[100.0, 60.0, 31.0, 0.0, 0.0], false).is_err());
        assert!(build(shape::RECTANGLE, &[100.0, 60.0, 20.0, 6.0, 5.0], false).is_err(), "hole breaks out through the corner radius");

        // Hexagon 1 in across flats: across corners 1.1547, side 0.57735, area 0.866025.
        let d = build(shape::POLYGON, &[6.0, 1.0, 0.0, 0.0, 0.0], false).unwrap();
        let p = roundtrip(&d, Units::Inch, Version::R2000);
        let v = outline(&p); assert_eq!(v.len(), 6);
        close(poly_area(&v), 3f64.sqrt() / 2.0, 1e-7);
        let (_, y0, _, y1) = d.extents().unwrap(); close(y1 - y0, 1.0, 1e-12); // flat at bottom and top
        close(polygon_dims(6.0, 1.0, 0.0, 0.0), 2.0 / 3f64.sqrt(), 1e-12);
        close(polygon_dims(6.0, 1.0, 0.0, 2.0), 1.0 / 3f64.sqrt(), 1e-12);
        // Square 50 across corners: side 35.355, flats 35.355, area 1250.
        close(polygon_dims(4.0, 50.0, 1.0, 1.0), 50.0 / 2f64.sqrt(), 1e-12);
        close(polygon_dims(4.0, 50.0, 1.0, 3.0), 1250.0, 1e-9);
        // Pentagon across corners 2R = 20: flat to corner = R (1 + cos 36).
        close(polygon_dims(5.0, 20.0, 1.0, 1.0), 10.0 * (1.0 + (PI / 5.0).cos()), 1e-12);
        let d = build(shape::POLYGON, &[5.0, 20.0, 1.0, 0.0, 0.0], false).unwrap();
        let (_, y0, _, y1) = d.extents().unwrap(); close(y1 - y0, 10.0 * (1.0 + (PI / 5.0).cos()), 1e-12);

        let d = build(shape::RING, &[50.0, 30.0], false).unwrap();
        let p = roundtrip(&d, Units::Mm, Version::R12);
        assert_eq!(p.entities.len(), 2);
        assert!(build(shape::RING, &[50.0, 50.0], false).is_err());
    }

    #[test]
    fn profiles() {
        for ver in [Version::R2000, Version::R12] {
            // Keyhole: head 20, slot 8, end centre 25 below. Area = disc + strip from the
            // chord down to the end centre - circular segment below the chord + half end circle.
            let (r, b, l) = (10.0f64, 4.0f64, 25.0f64);
            let yc = (r * r - b * b).sqrt();
            let seg = r * r * (yc / r).acos() - yc * (r * r - yc * yc).sqrt();
            let d = build(shape::KEYHOLE, &[20.0, 8.0, 25.0, 0.0], true).unwrap();
            let p = roundtrip(&d, Units::Mm, ver);
            close(poly_area(&outline(&p)), PI * r * r + 2.0 * b * (l - yc) - seg + PI * b * b / 2.0, 1e-7);
            let (x0, y0, x1, y1) = d.part_extents().unwrap();
            close(x0, -10.0, 1e-9); close(x1, 10.0, 1e-9); close(y1, 10.0, 1e-9); close(y0, -29.0, 1e-9);
            // D-flat: dia 20, across flat 17 -> flat at y = 7; area = disc - segment of height 3.
            let d = build(shape::D_FLAT, &[20.0, 17.0, 0.0], false).unwrap();
            let p = roundtrip(&d, Units::Mm, ver);
            let seg = r * r * (7.0f64 / r).acos() - 7.0 * (r * r - 49.0f64).sqrt();
            close(poly_area(&outline(&p)), PI * r * r - seg, 1e-7);
            let (_, y0, _, y1) = d.extents().unwrap(); close(y1 - y0, 17.0, 1e-9);
            // Double-D: dia 20, 16 across flats, rotated 90 deg -> flats vertical.
            let d = build(shape::DOUBLE_D, &[20.0, 16.0, 90.0], false).unwrap();
            let p = roundtrip(&d, Units::Mm, ver);
            let seg = r * r * (8.0f64 / r).acos() - 8.0 * (r * r - 64.0f64).sqrt();
            close(poly_area(&outline(&p)), PI * r * r - 2.0 * seg, 1e-7);
            let (x0, y0, x1, y1) = d.extents().unwrap(); close(x1 - x0, 16.0, 1e-9); close(y1 - y0, 20.0, 1e-9);
        }
        assert!(build(shape::KEYHOLE, &[20.0, 8.0, 5.0, 0.0], false).is_err());
        assert!(build(shape::D_FLAT, &[20.0, 20.0, 0.0], false).is_err());
    }

    #[test]
    fn origin_and_flatten() {
        let mut d = build(shape::SLOT, &[40.0, 10.0, 0.0], true).unwrap();
        d.origin_lower_left();
        let (x0, y0, x1, y1) = d.part_extents().unwrap();
        close(x0, 0.0, 1e-12); close(y0, 0.0, 1e-12); close(x1, 50.0, 1e-12); close(y1, 10.0, 1e-12);
        let f = d.flatten();
        assert_eq!(&f[..5], &[0.0, 0.0, 50.0, 10.0, 6.0]);
        assert_eq!(f[5], 4.0); assert_eq!(f[8], 4.0);
        assert_eq!(f.len(), 5 + 4 + 4 * 3 + 5 * 6);
        // Centre marks reach outside the part (cross half length 1.25 x end radius).
        close(d.extents().unwrap().0, 5.0 - 6.25, 1e-12);
    }
    /// With BENCHMATE_DXF_OUT set, writes every shape in both versions and
    /// units there, for an independent reader (scripts/check_dxf.py, ezdxf).
    #[test]
    fn write_samples() {
        let Ok(dir) = std::env::var("BENCHMATE_DXF_OUT") else { return };
        let cases: [(&str, u32, &[f64]); 10] = [
            ("bolt", shape::BOLT_CIRCLE, &[100.0, 6.0, 9.0, 15.0, 130.0, 40.0]), ("grid", shape::GRID, &[4.0, 3.0, 20.0, 15.0, 6.0, 10.0, 5.0]),
            ("slot", shape::SLOT, &[40.0, 10.0, 30.0]), ("arcslot", shape::ARC_SLOT, &[50.0, 10.0, 20.0, 250.0]),
            ("rect", shape::RECTANGLE, &[100.0, 60.0, 8.0, 6.6, 10.0]), ("hex", shape::POLYGON, &[6.0, 30.0, 0.0, 15.0, 10.0]),
            ("ring", shape::RING, &[50.0, 30.0]), ("keyhole", shape::KEYHOLE, &[20.0, 8.0, 25.0, 0.0]),
            ("dflat", shape::D_FLAT, &[20.0, 17.0, 0.0]), ("doubled", shape::DOUBLE_D, &[20.0, 16.0, 90.0]),
        ];
        for (name, k, p) in cases {
            let d = build(k, p, true).unwrap();
            for (vn, ver) in [("r2000", Version::R2000), ("r12", Version::R12)] {
                for (un, u) in [("mm", Units::Mm), ("in", Units::Inch)] {
                    std::fs::write(format!("{dir}/{name}-{vn}-{un}.dxf"), write_dxf(&d, u, ver)).unwrap();
                }
            }
            let mut ll = d.clone(); ll.origin_lower_left();
            std::fs::write(format!("{dir}/{name}-r2000-mm-ll.dxf"), write_dxf(&ll, Units::Mm, Version::R2000)).unwrap();
        }
    }
}
