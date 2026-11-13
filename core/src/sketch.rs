//! The model behind the 2D sketcher page: a drawing of points, lines, arcs,
//! circles, polylines and single-line text on named layers (`dxf::Doc`), with
//! undo and redo, object snap, picking, measuring and DXF in and out.
//!
//! All geometry is plane analytic geometry:
//! - circle through three points: the circumcentre from the perpendicular
//!   bisector equations [WolframCircumcircle];
//! - line with line, line with circle and circle with circle intersections
//!   [WolframLineLine], [WolframCircleLine], [WolframCircleCircle];
//! - polyline bulges, arcs and the file format: the DXF reference [DXF].
//!
//! The page (app/sketch.js) only draws what this module returns and passes
//! the pointer position in; it does no geometry of its own beyond the view
//! transform.

use crate::dxf::{self, Doc, Geo, Item, Units, Version};
use std::fmt::Write as _;

type P = (f64, f64);

/// How many undo steps are kept.
pub const UNDO_MAX: usize = 200;

/// Snap kinds, in the order they win when several are within reach.
pub const SNAP_END: u32 = 1;
pub const SNAP_INT: u32 = 2;
pub const SNAP_MID: u32 = 4;
pub const SNAP_CEN: u32 = 8;
pub const SNAP_QUAD: u32 = 16;
pub const SNAP_NEAR: u32 = 32;
pub const SNAP_GRID: u32 = 64;
/// Tangent to a circle or arc, and square (perpendicular) onto a line, circle or arc: both from the last point placed.
pub const SNAP_TAN: u32 = 128;
pub const SNAP_PERP: u32 = 256;

/// The order the kinds win in (smaller wins).
fn rank(kind: u32) -> u32 {
    match kind { SNAP_END => 1, SNAP_INT => 2, SNAP_MID => 3, SNAP_CEN => 4, SNAP_QUAD => 5, SNAP_TAN => 6, SNAP_PERP => 7, SNAP_NEAR => 8, _ => 9 }
}

/// The points where a line from `p` touches the circle (centre `c`, radius
/// `r`) as a tangent: with d the distance from p to c and t the direction
/// from c to p, they lie at angles t +- acos(r / d). None when p is inside
/// or on the circle.
pub fn tangent_points(p: P, c: P, r: f64) -> Vec<P> {
    let d = dist(p, c);
    if !(d > r) || r <= 0.0 { return vec![]; }
    let t = ang(c, p);
    let a = (r / d).acos().to_degrees();
    vec![at(c, r, t + a), at(c, r, t - a)]
}

/// The foot of the perpendicular from `p` onto the line through `a` and `b`.
pub fn foot(p: P, a: P, b: P) -> Option<P> {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = dx * dx + dy * dy;
    if l2 == 0.0 { return None; }
    let t = ((p.0 - a.0) * dx + (p.1 - a.1) * dy) / l2;
    Some((a.0 + t * dx, a.1 + t * dy))
}

fn norm(a: f64) -> f64 { let r = a.rem_euclid(360.0); if (r - 360.0).abs() < 1e-12 { 0.0 } else { r } }
/// Counter-clockwise sweep from `s` to `e` in degrees, in (0, 360].
pub fn sweep(s: f64, e: f64) -> f64 { let w = norm(e - s); if w <= 1e-12 { 360.0 } else { w } }
fn in_sweep(a: f64, s: f64, e: f64) -> bool { let d = norm(a - s); d <= sweep(s, e) + 1e-7 || d >= 360.0 - 1e-7 }
fn ang(c: P, p: P) -> f64 { (p.1 - c.1).atan2(p.0 - c.0).to_degrees() }
fn at(c: P, r: f64, a: f64) -> P { (c.0 + r * a.to_radians().cos(), c.1 + r * a.to_radians().sin()) }
fn dist(a: P, b: P) -> f64 { (a.0 - b.0).hypot(a.1 - b.1) }

/// One straight or circular piece of an entity.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Prim {
    Seg { a: P, b: P },
    /// Counter-clockwise from `s` to `e` degrees; `full` for a whole circle.
    Arc { c: P, r: f64, s: f64, e: f64, full: bool },
}

impl Prim {
    /// The point of the piece nearest to `p`.
    pub fn nearest(&self, p: P) -> P {
        match *self {
            Prim::Seg { a, b } => {
                let (dx, dy) = (b.0 - a.0, b.1 - a.1);
                let l2 = dx * dx + dy * dy;
                if l2 == 0.0 { return a; }
                let t = (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / l2).clamp(0.0, 1.0);
                (a.0 + t * dx, a.1 + t * dy)
            }
            Prim::Arc { c, r, s, e, full } => {
                if dist(c, p) < 1e-300 { return at(c, r, s); }
                let a = ang(c, p);
                if full || in_sweep(a, s, e) { return at(c, r, a); }
                let (p1, p2) = (at(c, r, s), at(c, r, e));
                if dist(p, p1) <= dist(p, p2) { p1 } else { p2 }
            }
        }
    }
    pub fn distance(&self, p: P) -> f64 { dist(self.nearest(p), p) }
    /// The two ends (none for a whole circle).
    pub fn ends(&self) -> Option<(P, P)> {
        match *self {
            Prim::Seg { a, b } => Some((a, b)),
            Prim::Arc { full: true, .. } => None,
            Prim::Arc { c, r, s, e, .. } => Some((at(c, r, s), at(c, r, e))),
        }
    }
    /// The middle point (none for a whole circle).
    pub fn mid(&self) -> Option<P> {
        match *self {
            Prim::Seg { a, b } => Some(((a.0 + b.0) / 2.0, (a.1 + b.1) / 2.0)),
            Prim::Arc { full: true, .. } => None,
            Prim::Arc { c, r, s, e, .. } => Some(at(c, r, s + sweep(s, e) / 2.0)),
        }
    }
    pub fn length(&self) -> f64 {
        match *self {
            Prim::Seg { a, b } => dist(a, b),
            Prim::Arc { r, full: true, .. } => 2.0 * std::f64::consts::PI * r,
            Prim::Arc { r, s, e, .. } => r * sweep(s, e).to_radians(),
        }
    }
    fn has(&self, p: P, eps: f64) -> bool { self.distance(p) <= eps }
}

/// The straight and circular pieces of an entity (none for a point or text).
pub fn prims(g: &Geo) -> Vec<Prim> {
    match g {
        Geo::Line { a, b } => vec![Prim::Seg { a: *a, b: *b }],
        Geo::Circle { c, r } => vec![Prim::Arc { c: *c, r: *r, s: 0.0, e: 360.0, full: true }],
        Geo::Arc { c, r, start, end } => vec![Prim::Arc { c: *c, r: *r, s: *start, e: *end, full: false }],
        Geo::Poly { v, closed } => {
            let n = v.len();
            let segs = if *closed { n } else { n.saturating_sub(1) };
            (0..segs).map(|i| {
                let (p, q) = (v[i], v[(i + 1) % n]);
                if p.2 == 0.0 { Prim::Seg { a: (p.0, p.1), b: (q.0, q.1) } }
                else { let (c, r, s, e) = dxf::bulge_arc((p.0, p.1), (q.0, q.1), p.2); Prim::Arc { c, r, s, e, full: false } }
            }).collect()
        }
        Geo::Point { .. } | Geo::Text { .. } => vec![],
    }
}

/// Where two pieces cross or touch.
pub fn intersections(a: &Prim, b: &Prim) -> Vec<P> {
    let mut out: Vec<P> = vec![];
    match (*a, *b) {
        (Prim::Seg { a: p, b: q }, Prim::Seg { a: r, b: s }) => {
            let (d1, d2) = ((q.0 - p.0, q.1 - p.1), (s.0 - r.0, s.1 - r.1));
            let den = d1.0 * d2.1 - d1.1 * d2.0;
            let scale = (d1.0.hypot(d1.1) * d2.0.hypot(d2.1)).max(1e-300);
            if den.abs() / scale < 1e-12 { return out; }
            let w = (r.0 - p.0, r.1 - p.1);
            let t = (w.0 * d2.1 - w.1 * d2.0) / den;
            let u = (w.0 * d1.1 - w.1 * d1.0) / den;
            if (-1e-9..=1.0 + 1e-9).contains(&t) && (-1e-9..=1.0 + 1e-9).contains(&u) { out.push((p.0 + t * d1.0, p.1 + t * d1.1)); }
        }
        (Prim::Seg { a: p, b: q }, Prim::Arc { c, r, .. }) | (Prim::Arc { c, r, .. }, Prim::Seg { a: p, b: q }) => {
            let d = (q.0 - p.0, q.1 - p.1);
            let f = (p.0 - c.0, p.1 - c.1);
            let aa = d.0 * d.0 + d.1 * d.1;
            if aa == 0.0 { return out; }
            let bb = 2.0 * (f.0 * d.0 + f.1 * d.1);
            let cc = f.0 * f.0 + f.1 * f.1 - r * r;
            let mut disc = bb * bb - 4.0 * aa * cc;
            // A tangent line: the discriminant is zero up to rounding.
            if disc < 0.0 && disc > -1e-9 * aa * r * r { disc = 0.0; }
            if disc < 0.0 { return out; }
            let sq = disc.sqrt();
            let ts = if sq == 0.0 { vec![-bb / (2.0 * aa)] } else { vec![(-bb - sq) / (2.0 * aa), (-bb + sq) / (2.0 * aa)] };
            let eps = 1e-9 * (aa.sqrt() + r);
            for t in ts {
                let x = (p.0 + t * d.0, p.1 + t * d.1);
                if (-1e-9..=1.0 + 1e-9).contains(&t) && a.has(x, eps.max(1e-12)) && b.has(x, eps.max(1e-12)) { out.push(x); }
            }
        }
        (Prim::Arc { c: c1, r: r1, .. }, Prim::Arc { c: c2, r: r2, .. }) => {
            let d = dist(c1, c2);
            let eps = 1e-9 * (r1 + r2);
            if d < 1e-12 * (r1 + r2) || d > r1 + r2 + eps || d < (r1 - r2).abs() - eps { return out; }
            let x = (r1 * r1 - r2 * r2 + d * d) / (2.0 * d);
            let h = (r1 * r1 - x * x).max(0.0).sqrt();
            let (ux, uy) = ((c2.0 - c1.0) / d, (c2.1 - c1.1) / d);
            let m = (c1.0 + x * ux, c1.1 + x * uy);
            let cands = if h <= eps { vec![m] } else { vec![(m.0 - h * uy, m.1 + h * ux), (m.0 + h * uy, m.1 - h * ux)] };
            for q in cands { if a.has(q, eps.max(1e-12) * 10.0) && b.has(q, eps.max(1e-12) * 10.0) { out.push(q); } }
        }
    }
    out
}

/// The arc from `p1` through `p2` to `p3`: centre at the circumcentre of the
/// three points, drawn counter-clockwise when the points turn left.
pub fn arc3(p1: P, p2: P, p3: P) -> Result<Geo, String> {
    let d = 2.0 * (p1.0 * (p2.1 - p3.1) + p2.0 * (p3.1 - p1.1) + p3.0 * (p1.1 - p2.1));
    let size = dist(p1, p2).max(dist(p2, p3)).max(dist(p1, p3));
    if size == 0.0 || d.abs() < 1e-9 * size * size { return Err("The three points are in one line (or two are the same): no arc goes through them".into()); }
    let s = |p: P| p.0 * p.0 + p.1 * p.1;
    let c = ((s(p1) * (p2.1 - p3.1) + s(p2) * (p3.1 - p1.1) + s(p3) * (p1.1 - p2.1)) / d,
             (s(p1) * (p3.0 - p2.0) + s(p2) * (p1.0 - p3.0) + s(p3) * (p2.0 - p1.0)) / d);
    let r = dist(c, p1);
    let (a1, a3) = (norm(ang(c, p1)), norm(ang(c, p3)));
    Ok(if d > 0.0 { Geo::Arc { c, r, start: a1, end: a3 } } else { Geo::Arc { c, r, start: a3, end: a1 } })
}

/// A rectangle with sides along the axes as a closed polyline, counter-clockwise from the lower left corner.
pub fn rect(p1: P, p2: P) -> Result<Geo, String> {
    let (x0, x1) = (p1.0.min(p2.0), p1.0.max(p2.0));
    let (y0, y1) = (p1.1.min(p2.1), p1.1.max(p2.1));
    if x1 - x0 <= 0.0 || y1 - y0 <= 0.0 { return Err("The two corners must differ in both X and Y".into()); }
    Ok(Geo::Poly { v: vec![(x0, y0, 0.0), (x1, y0, 0.0), (x1, y1, 0.0), (x0, y1, 0.0)], closed: true })
}

/// Distance, dx, dy and direction (degrees, counter-clockwise from +X, 0 to 360) from `a` to `b`.
pub fn measure(a: P, b: P) -> (f64, f64, f64, f64) {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    (dx.hypot(dy), dx, dy, if dx == 0.0 && dy == 0.0 { 0.0 } else { norm(dy.atan2(dx).to_degrees()) })
}

/// The point at `len` from `a` in direction `deg` (counter-clockwise from +X).
pub fn polar(a: P, len: f64, deg: f64) -> P { (a.0 + len * deg.to_radians().cos(), a.1 + len * deg.to_radians().sin()) }

/// `p` moved onto the horizontal or vertical line through `a`, whichever is nearer its direction.
pub fn ortho(a: P, p: P) -> P { if (p.0 - a.0).abs() >= (p.1 - a.1).abs() { (p.0, a.1) } else { (a.0, p.1) } }

fn check(g: &Geo) -> Result<(), String> {
    let fin = |p: &P| p.0.is_finite() && p.1.is_finite();
    match g {
        Geo::Line { a, b } => {
            if !fin(a) || !fin(b) { return Err("A line needs two points given as numbers".into()); }
            if a == b { return Err("The two ends of the line are the same point".into()); }
        }
        Geo::Circle { c, r } | Geo::Arc { c, r, .. } => {
            if !fin(c) || !r.is_finite() { return Err("The centre and radius must be numbers".into()); }
            if *r <= 0.0 { return Err("The radius must be more than zero".into()); }
            if let Geo::Arc { start, end, .. } = g { if !start.is_finite() || !end.is_finite() { return Err("The arc angles must be numbers".into()); } }
        }
        Geo::Poly { v, .. } => {
            if v.len() < 2 { return Err("A polyline needs at least two points".into()); }
            if !v.iter().all(|p| p.0.is_finite() && p.1.is_finite() && p.2.is_finite()) { return Err("Every polyline point must be a number".into()); }
        }
        Geo::Point { p } => { if !fin(p) { return Err("The point must be given as numbers".into()); } }
        Geo::Text { p, h, rot, text } => {
            if !fin(p) || !rot.is_finite() { return Err("The text position and angle must be numbers".into()); }
            if !h.is_finite() || *h <= 0.0 { return Err("The text height must be more than zero".into()); }
            if text.trim().is_empty() { return Err("Type the text first".into()); }
            // The DXF reference asks for text values of at most 250 characters in one group.
            if dxf::dxf_text(text).chars().count() > 250 { return Err("The text is too long for one line of a DXF file (250 characters)".into()); }
        }
    }
    Ok(())
}

fn shift(g: &mut Geo, dx: f64, dy: f64) {
    let m = |p: &mut P| { p.0 += dx; p.1 += dy; };
    match g {
        Geo::Line { a, b } => { m(a); m(b); }
        Geo::Circle { c, .. } | Geo::Arc { c, .. } => m(c),
        Geo::Poly { v, .. } => for p in v.iter_mut() { p.0 += dx; p.1 += dy; },
        Geo::Point { p } | Geo::Text { p, .. } => m(p),
    }
}

fn scale_geo(g: &mut Geo, k: f64) {
    let m = |p: &mut P| { p.0 *= k; p.1 *= k; };
    match g {
        Geo::Line { a, b } => { m(a); m(b); }
        Geo::Circle { c, r } | Geo::Arc { c, r, .. } => { m(c); *r *= k; }
        Geo::Poly { v, .. } => for p in v.iter_mut() { p.0 *= k; p.1 *= k; },
        Geo::Point { p } => m(p),
        Geo::Text { p, h, .. } => { m(p); *h *= k; }
    }
}

/// The four corners of the box a text is taken to fill (0.7 x height per character, an estimate).
fn text_box(p: P, h: f64, rot: f64, text: &str) -> [P; 4] {
    let (s, c) = rot.to_radians().sin_cos();
    let w = 0.7 * h * text.chars().count() as f64;
    [(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)].map(|q| (p.0 + q.0 * c - q.1 * s, p.1 + q.0 * s + q.1 * c))
}

/// Distance from `p` to an entity (0 inside a text box).
pub fn geo_distance(g: &Geo, p: P) -> f64 {
    match g {
        Geo::Point { p: q } => dist(*q, p),
        Geo::Text { p: q, h, rot, text } => {
            // In the text's own frame the box is axis aligned.
            let (s, c) = (-rot).to_radians().sin_cos();
            let d = (p.0 - q.0, p.1 - q.1);
            let l = (d.0 * c - d.1 * s, d.0 * s + d.1 * c);
            let w = 0.7 * h * text.chars().count() as f64;
            let ox = if l.0 < 0.0 { -l.0 } else if l.0 > w { l.0 - w } else { 0.0 };
            let oy = if l.1 < 0.0 { -l.1 } else if l.1 > *h { l.1 - h } else { 0.0 };
            ox.hypot(oy)
        }
        _ => prims(g).iter().map(|q| q.distance(p)).fold(f64::INFINITY, f64::min),
    }
}

#[derive(Clone, Default, Debug)]
pub struct Sketch {
    pub doc: Doc,
    /// Drawing units: inch, or millimetre.
    pub inch: bool,
    undo: Vec<(Doc, bool)>,
    redo: Vec<(Doc, bool)>,
}

impl Sketch {
    /// An empty sketch with the layer `0`.
    pub fn new(inch: bool) -> Sketch { Sketch { doc: Doc { layers: vec![("0".into(), 7)], items: vec![] }, inch, undo: vec![], redo: vec![] } }

    fn mark(&mut self) {
        self.undo.push((self.doc.clone(), self.inch));
        if self.undo.len() > UNDO_MAX { self.undo.remove(0); }
        self.redo.clear();
    }
    pub fn can_undo(&self) -> bool { !self.undo.is_empty() }
    pub fn can_redo(&self) -> bool { !self.redo.is_empty() }
    pub fn undo(&mut self) -> bool {
        match self.undo.pop() { Some(s) => { self.redo.push((std::mem::replace(&mut self.doc, s.0), self.inch)); self.inch = s.1; true } None => false }
    }
    pub fn redo(&mut self) -> bool {
        match self.redo.pop() { Some(s) => { self.undo.push((std::mem::replace(&mut self.doc, s.0), self.inch)); self.inch = s.1; true } None => false }
    }

    fn layer(&self, i: usize) -> usize { if i < self.doc.layers.len() { i } else { 0 } }

    /// Add an entity; returns its index.
    pub fn add(&mut self, layer: usize, geo: Geo) -> Result<usize, String> {
        check(&geo)?;
        self.mark();
        if self.doc.layers.is_empty() { self.doc.layers.push(("0".into(), 7)); }
        let layer = self.layer(layer);
        self.doc.items.push(Item { layer, geo });
        Ok(self.doc.items.len() - 1)
    }

    /// Index of the layer called `name`, added if it is new (an undo step when added).
    pub fn layer_named(&mut self, name: &str, colour: i32) -> usize {
        let n = dxf::layer_name(name);
        if let Some(i) = self.doc.layers.iter().position(|l| l.0.eq_ignore_ascii_case(&n)) { return i; }
        self.mark();
        self.doc.layer_index(&n, colour)
    }

    pub fn set_layer_colour(&mut self, i: usize, colour: i32) -> bool {
        if i >= self.doc.layers.len() || !(1..=255).contains(&colour) || self.doc.layers[i].1 == colour { return false; }
        self.mark();
        self.doc.layers[i].1 = colour;
        true
    }

    /// Delete the entities with these indexes; returns how many went.
    pub fn delete(&mut self, sel: &[usize]) -> usize {
        let n = self.doc.items.len();
        let hit: Vec<bool> = (0..n).map(|i| sel.contains(&i)).collect();
        let count = hit.iter().filter(|h| **h).count();
        if count == 0 { return 0; }
        self.mark();
        let mut i = 0;
        self.doc.items.retain(|_| { let keep = !hit[i]; i += 1; keep });
        count
    }

    /// Move (or, with `copy`, duplicate and move) the entities with these
    /// indexes; returns the indexes of the moved or new entities.
    pub fn move_by(&mut self, sel: &[usize], dx: f64, dy: f64, copy: bool) -> Vec<usize> {
        let n = self.doc.items.len();
        let idx: Vec<usize> = (0..n).filter(|i| sel.contains(i)).collect();
        if idx.is_empty() || !dx.is_finite() || !dy.is_finite() || (dx == 0.0 && dy == 0.0) { return vec![]; }
        self.mark();
        let mut out = vec![];
        for i in idx {
            if copy {
                let mut it = self.doc.items[i].clone();
                shift(&mut it.geo, dx, dy);
                self.doc.items.push(it);
                out.push(self.doc.items.len() - 1);
            } else { shift(&mut self.doc.items[i].geo, dx, dy); out.push(i); }
        }
        out
    }

    /// Remove every entity (layers stay).
    pub fn clear(&mut self) -> bool {
        if self.doc.items.is_empty() { return false; }
        self.mark();
        self.doc.items.clear();
        true
    }

    /// Change the drawing units. With `convert` every length is multiplied
    /// or divided by 25.4 (1 in = 25.4 mm exactly) so the drawing keeps its
    /// real size; without it the numbers stay and only their meaning changes.
    pub fn set_units(&mut self, inch: bool, convert: bool) -> bool {
        if inch == self.inch { return false; }
        self.mark();
        if convert {
            let k = if inch { 1.0 / 25.4 } else { 25.4 };
            for it in self.doc.items.iter_mut() { scale_geo(&mut it.geo, k); }
        }
        self.inch = inch;
        true
    }

    /// Replace the sketch with the content of a DXF file. `default_inch` is
    /// used when the file does not state its units. Returns the report lines.
    pub fn import_dxf(&mut self, text: &str, default_inch: bool) -> Result<Vec<String>, String> {
        let r = dxf::read_dxf(text)?;
        if r.doc.items.is_empty() {
            let what = if r.skipped.is_empty() { String::new() } else { format!(" (left out: {})", skipped_text(&r.skipped)) };
            return Err(format!("No lines, arcs, circles, polylines, points or text found in the file{}", what));
        }
        self.mark();
        self.doc = r.doc;
        if !self.doc.layers.iter().any(|l| l.0 == "0") { self.doc.layers.insert(0, ("0".into(), 7)); for it in self.doc.items.iter_mut() { it.layer += 1; } }
        let mut out = vec![];
        let n = self.doc.items.len();
        let used: std::collections::BTreeSet<usize> = self.doc.items.iter().map(|i| i.layer).collect();
        match r.units {
            Some(u) => { self.inch = u == Units::Inch; out.push(format!("Read {} entities on {} layer{}. The file is in {}", n, used.len(), if used.len() == 1 { "" } else { "s" }, if self.inch { "inches" } else { "millimetres" })); }
            None => { self.inch = default_inch; out.push(format!("Read {} entities on {} layer{}, taken as {}", n, used.len(), if used.len() == 1 { "" } else { "s" }, if self.inch { "inches" } else { "millimetres" })); }
        }
        out.extend(r.notes);
        if !r.skipped.is_empty() { out.push(format!("Left out (not drawn here): {}", skipped_text(&r.skipped))); }
        Ok(out)
    }

    /// The sketch as a DXF file. With `explode` polylines are written as separate lines and arcs.
    pub fn export_dxf(&self, r12: bool, explode: bool) -> String {
        let (u, v) = (if self.inch { Units::Inch } else { Units::Mm }, if r12 { Version::R12 } else { Version::R2000 });
        if explode { dxf::write_doc(&self.doc.exploded(), u, v) } else { dxf::write_doc(&self.doc, u, v) }
    }

    /// Nearest entity within `tol` of `p`.
    pub fn pick(&self, p: P, tol: f64) -> Option<usize> {
        let mut best: Option<(usize, f64)> = None;
        for (i, it) in self.doc.items.iter().enumerate() {
            let d = geo_distance(&it.geo, p);
            if d <= tol && best.is_none_or(|b| d < b.1) { best = Some((i, d)); }
        }
        best.map(|b| b.0)
    }

    /// Object snap: the best point within `tol` of `p` among the kinds in
    /// `modes` (a sum of the `SNAP_` values). The nearest snap point wins;
    /// where two kinds give the same point the order end, intersection,
    /// middle, centre, quadrant, tangent, square decides its name. The
    /// nearest point on an entity counts only when none of those is in
    /// reach, and with `SNAP_GRID` and nothing at all in reach the point is
    /// rounded to the grid. Returns the point and its kind (0 when `p` is
    /// returned unchanged).
    pub fn snap(&self, p: P, tol: f64, modes: u32, grid: f64) -> (P, u32) { self.snap_from(p, tol, modes, grid, None) }

    /// As `snap`, with the last point placed: from it the tangent points of
    /// circles and arcs (`SNAP_TAN`) and the feet of perpendiculars onto
    /// lines, circles and arcs (`SNAP_PERP`) are offered too.
    pub fn snap_from(&self, p: P, tol: f64, modes: u32, grid: f64, from: Option<P>) -> (P, u32) {
        let mut best: Option<(P, u32, f64)> = None;
        let mut offer = |q: P, kind: u32| {
            if modes & kind == 0 { return; }
            let d = dist(q, p);
            if d > tol { return; }
            // "On a line" and the grid only count when no real snap point is in reach. Among
            // the real ones the nearest wins; where two are at the same place the order decides.
            let weak = |k: u32| k == SNAP_NEAR || k == SNAP_GRID;
            let same = |b: &(P, u32, f64)| (d - b.2).abs() <= 1e-9 * (1.0 + tol);
            let better = |b: (P, u32, f64)| {
                if weak(kind) != weak(b.1) { !weak(kind) }
                else if same(&b) { rank(kind) < rank(b.1) }
                else { d < b.2 }
            };
            if best.is_none_or(better) { best = Some((q, kind, d)); }
        };
        // Pieces within reach of the pointer, for the intersections.
        let mut close: Vec<(usize, Prim)> = vec![];
        for (i, it) in self.doc.items.iter().enumerate() {
            match &it.geo {
                Geo::Point { p: q } | Geo::Text { p: q, .. } => offer(*q, SNAP_END),
                g => {
                    for pr in prims(g) {
                        if let Some((a, b)) = pr.ends() { offer(a, SNAP_END); offer(b, SNAP_END); }
                        if let Some(m) = pr.mid() { offer(m, SNAP_MID); }
                        if let Prim::Arc { c, r, s, e, full } = pr {
                            offer(c, SNAP_CEN);
                            for q in [0.0, 90.0, 180.0, 270.0] { if full || in_sweep(q, s, e) { offer(at(c, r, q), SNAP_QUAD); } }
                        }
                        if let Some(f) = from {
                            match pr {
                                Prim::Seg { a, b } => { if let Some(q) = foot(f, a, b) { if dist(q, f) > 0.0 && pr.has(q, 1e-9 * (dist(a, b) + 1.0)) { offer(q, SNAP_PERP); } } }
                                Prim::Arc { c, r, s, e, full } => {
                                    for q in tangent_points(f, c, r) { if full || in_sweep(ang(c, q), s, e) { offer(q, SNAP_TAN); } }
                                    if dist(f, c) > 0.0 { let t = ang(c, f); for q in [t, t + 180.0] { if full || in_sweep(q, s, e) { offer(at(c, r, q), SNAP_PERP); } } }
                                }
                            }
                        }
                        let n = pr.nearest(p);
                        if dist(n, p) <= tol { offer(n, SNAP_NEAR); close.push((i, pr)); }
                    }
                }
            }
        }
        if modes & SNAP_INT != 0 {
            for a in 0..close.len() {
                for b in a + 1..close.len() {
                    if close[a].0 == close[b].0 { continue; }
                    for q in intersections(&close[a].1, &close[b].1) { offer(q, SNAP_INT); }
                }
            }
        }
        if let Some(b) = best { return (b.0, b.1); }
        if modes & SNAP_GRID != 0 && grid > 0.0 && grid.is_finite() {
            return (((p.0 / grid).round() * grid, (p.1 / grid).round() * grid), SNAP_GRID);
        }
        (p, 0)
    }

    /// What there is to know about one entity, as `label, value, kind` rows.
    /// Kinds: `L` a length, `A` an angle in degrees, `S` an area, `N` a
    /// plain number, `T` text (value 0, the label carries it).
    pub fn info(&self, i: usize) -> Vec<(String, f64, char)> {
        let Some(it) = self.doc.items.get(i) else { return vec![] };
        let mut o: Vec<(String, f64, char)> = vec![];
        let mut row = |l: &str, v: f64, k: char| o.push((l.to_string(), v, k));
        match &it.geo {
            Geo::Line { a, b } => {
                let (d, dx, dy, an) = measure(*a, *b);
                row("Line", 0.0, 'T');
                row("Start X", a.0, 'L'); row("Start Y", a.1, 'L'); row("End X", b.0, 'L'); row("End Y", b.1, 'L');
                row("Length", d, 'L'); row("Along X", dx, 'L'); row("Along Y", dy, 'L'); row("Direction", an, 'A');
            }
            Geo::Circle { c, r } => {
                row("Circle", 0.0, 'T');
                row("Centre X", c.0, 'L'); row("Centre Y", c.1, 'L'); row("Diameter", 2.0 * r, 'L'); row("Radius", *r, 'L');
                row("Circumference", 2.0 * std::f64::consts::PI * r, 'L'); row("Area", dxf::circle_area(*r), 'S');
            }
            Geo::Arc { c, r, start, end } => {
                let sw = sweep(*start, *end);
                let (p1, p2) = (at(*c, *r, *start), at(*c, *r, *end));
                row("Arc", 0.0, 'T');
                row("Centre X", c.0, 'L'); row("Centre Y", c.1, 'L'); row("Radius", *r, 'L');
                row("Start angle", *start, 'A'); row("End angle", *end, 'A'); row("Included angle", sw, 'A');
                row("Arc length", r * sw.to_radians(), 'L'); row("Chord", dist(p1, p2), 'L');
                row("Start X", p1.0, 'L'); row("Start Y", p1.1, 'L'); row("End X", p2.0, 'L'); row("End Y", p2.1, 'L');
            }
            Geo::Poly { v, closed } => {
                row(if *closed { "Closed polyline" } else { "Open polyline" }, 0.0, 'T');
                row("Points", v.len() as f64, 'N');
                row(if *closed { "Perimeter" } else { "Length" }, dxf::poly_length(v, *closed), 'L');
                if *closed { row("Area", dxf::poly_area(v).abs(), 'S'); }
                let d = Doc { layers: vec![], items: vec![Item { layer: 0, geo: it.geo.clone() }] };
                if let Some((x0, y0, x1, y1)) = d.extents() { row("Width", x1 - x0, 'L'); row("Height", y1 - y0, 'L'); }
            }
            Geo::Point { p } => { row("Point", 0.0, 'T'); row("X", p.0, 'L'); row("Y", p.1, 'L'); }
            Geo::Text { p, h, rot, text } => {
                row(&format!("Text: {}", text), 0.0, 'T');
                row("X", p.0, 'L'); row("Y", p.1, 'L'); row("Height", *h, 'L'); row("Angle", *rot, 'A');
            }
        }
        o
    }

    /// What two entities have to do with each other, as rows like `info`:
    /// two lines give the angle between them and where they meet (or how far
    /// apart they run when parallel); circles, arcs and points give the
    /// distance between centres; a line with a circle, arc or point gives the
    /// distance from that centre square onto the line.
    pub fn between(&self, i: usize, j: usize) -> Vec<(String, f64, char)> {
        let (Some(a), Some(b)) = (self.doc.items.get(i), self.doc.items.get(j)) else { return vec![] };
        let mut o: Vec<(String, f64, char)> = vec![];
        let mut row = |l: &str, v: f64, k: char| o.push((l.to_string(), v, k));
        let centre = |g: &Geo| match g { Geo::Circle { c, .. } | Geo::Arc { c, .. } => Some(*c), Geo::Point { p } => Some(*p), _ => None };
        let line = |g: &Geo| match g { Geo::Line { a, b } => Some((*a, *b)), _ => None };
        match (line(&a.geo), line(&b.geo), centre(&a.geo), centre(&b.geo)) {
            (Some((p, q)), Some((r, t)), _, _) => {
                let (d1, d2) = ((q.0 - p.0, q.1 - p.1), (t.0 - r.0, t.1 - r.1));
                let cross = d1.0 * d2.1 - d1.1 * d2.0;
                let dot = d1.0 * d2.0 + d1.1 * d2.1;
                // The angle between the two directions, folded into 0 to 90 degrees, and the other angle of the crossing.
                let an = cross.abs().atan2(dot.abs()).to_degrees();
                row("Two lines", 0.0, 'T');
                if cross.abs() < 1e-12 * d1.0.hypot(d1.1) * d2.0.hypot(d2.1) {
                    row("Angle between", 0.0, 'A');
                    if let Some(f) = foot(r, p, q) { row("Parallel, distance apart", dist(f, r), 'L'); }
                } else {
                    row("Angle between", an, 'A'); row("The other angle", 180.0 - an, 'A');
                    let w = (r.0 - p.0, r.1 - p.1);
                    let u = (w.0 * d2.1 - w.1 * d2.0) / cross;
                    row("The lines meet at X", p.0 + u * d1.0, 'L'); row("The lines meet at Y", p.1 + u * d1.1, 'L');
                }
            }
            (_, _, Some(c1), Some(c2)) => {
                let (d, dx, dy, an) = measure(c1, c2);
                row("Two centres", 0.0, 'T');
                row("Centre distance", d, 'L'); row("Along X", dx, 'L'); row("Along Y", dy, 'L'); row("Direction", an, 'A');
            }
            (Some((p, q)), _, _, Some(c)) | (_, Some((p, q)), Some(c), _) => {
                row("Line and centre", 0.0, 'T');
                if let Some(f) = foot(c, p, q) { row("Centre to the line, square", dist(f, c), 'L'); row("Foot on the line X", f.0, 'L'); row("Foot on the line Y", f.1, 'L'); }
            }
            _ => {}
        }
        o
    }

    /// The sketch as text, one record per line, fields separated by tabs:
    /// `U inch|mm`, `Y name colour` for each layer, then per entity
    /// `L layer x1 y1 x2 y2`, `C layer cx cy r`, `A layer cx cy r start end`,
    /// `P layer x y`, `T layer x y height angle text`,
    /// `W layer closed x y bulge ...`.
    pub fn to_text(&self) -> String {
        let mut o = String::new();
        let _ = writeln!(o, "U\t{}", if self.inch { "inch" } else { "mm" });
        for l in &self.doc.layers { let _ = writeln!(o, "Y\t{}\t{}", l.0.replace(['\t', '\n', '\r'], " "), l.1); }
        for it in &self.doc.items {
            let l = it.layer;
            let _ = match &it.geo {
                Geo::Line { a, b } => writeln!(o, "L\t{}\t{}\t{}\t{}\t{}", l, a.0, a.1, b.0, b.1),
                Geo::Circle { c, r } => writeln!(o, "C\t{}\t{}\t{}\t{}", l, c.0, c.1, r),
                Geo::Arc { c, r, start, end } => writeln!(o, "A\t{}\t{}\t{}\t{}\t{}\t{}", l, c.0, c.1, r, start, end),
                Geo::Point { p } => writeln!(o, "P\t{}\t{}\t{}", l, p.0, p.1),
                Geo::Text { p, h, rot, text } => writeln!(o, "T\t{}\t{}\t{}\t{}\t{}\t{}", l, p.0, p.1, h, rot, text.replace(['\t', '\n', '\r'], " ")),
                Geo::Poly { v, closed } => {
                    let _ = write!(o, "W\t{}\t{}", l, if *closed { 1 } else { 0 });
                    for p in v { let _ = write!(o, "\t{}\t{}\t{}", p.0, p.1, p.2); }
                    writeln!(o)
                }
            };
        }
        o
    }

    /// What to draw, one record per line, fields separated by tabs: `U` and
    /// `Y` as in `to_text`, then for entity number `i`:
    /// `S i layer x1 y1 x2 y2` a straight piece,
    /// `R i layer cx cy r start end full` an arc or circle (counter-clockwise, degrees),
    /// `P i layer x y` a point,
    /// `T i layer x y height angle width text` a text (width as in the extents: 0.7 x height per character).
    pub fn display(&self) -> String {
        let mut o = String::new();
        let _ = writeln!(o, "U\t{}", if self.inch { "inch" } else { "mm" });
        for l in &self.doc.layers { let _ = writeln!(o, "Y\t{}\t{}", l.0.replace(['\t', '\n', '\r'], " "), l.1); }
        for (i, it) in self.doc.items.iter().enumerate() {
            let l = it.layer;
            match &it.geo {
                Geo::Point { p } => { let _ = writeln!(o, "P\t{}\t{}\t{}\t{}", i, l, p.0, p.1); }
                Geo::Text { p, h, rot, text } => {
                    let _ = writeln!(o, "T\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}", i, l, p.0, p.1, h, rot, 0.7 * h * text.chars().count() as f64, text.replace(['\t', '\n', '\r'], " "));
                }
                g => for pr in prims(g) {
                    let _ = match pr {
                        Prim::Seg { a, b } => writeln!(o, "S\t{}\t{}\t{}\t{}\t{}\t{}", i, l, a.0, a.1, b.0, b.1),
                        Prim::Arc { c, r, s, e, full } => writeln!(o, "R\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}", i, l, c.0, c.1, r, s, e, if full { 1 } else { 0 }),
                    };
                },
            }
        }
        o
    }

    /// Read the text form back (unknown or damaged lines are left out). The undo history starts empty.
    pub fn from_text(text: &str) -> Sketch {
        let mut s = Sketch { doc: Doc::default(), inch: false, undo: vec![], redo: vec![] };
        let mut items: Vec<Item> = vec![];
        for line in text.lines() {
            let f: Vec<&str> = line.split('\t').collect();
            let n = |i: usize| f.get(i).and_then(|x| x.trim().parse::<f64>().ok()).unwrap_or(f64::NAN);
            let layer = f.get(1).and_then(|x| x.trim().parse::<usize>().ok()).unwrap_or(0);
            let geo = match f[0] {
                "U" => { s.inch = f.get(1).map(|x| x.trim()) == Some("inch"); None }
                "Y" => { if let Some(name) = f.get(1) { let c = f.get(2).and_then(|x| x.trim().parse::<i32>().ok()).unwrap_or(7); s.doc.layers.push((dxf::layer_name(name), if (1..=255).contains(&c) { c } else { 7 })); } None }
                "L" => Some(Geo::Line { a: (n(2), n(3)), b: (n(4), n(5)) }),
                "C" => Some(Geo::Circle { c: (n(2), n(3)), r: n(4) }),
                "A" => Some(Geo::Arc { c: (n(2), n(3)), r: n(4), start: n(5), end: n(6) }),
                "P" => Some(Geo::Point { p: (n(2), n(3)) }),
                "T" => Some(Geo::Text { p: (n(2), n(3)), h: n(4), rot: n(5), text: f.get(6..).map(|x| x.join(" ")).unwrap_or_default() }),
                "W" => {
                    let v: Vec<(f64, f64, f64)> = (0..(f.len().saturating_sub(3)) / 3).map(|k| (n(3 + 3 * k), n(4 + 3 * k), n(5 + 3 * k))).collect();
                    Some(Geo::Poly { v, closed: f.get(2).map(|x| x.trim()) == Some("1") })
                }
                _ => None,
            };
            if let Some(g) = geo { if check(&g).is_ok() { items.push(Item { layer, geo: g }); } }
        }
        if s.doc.layers.is_empty() { s.doc.layers.push(("0".into(), 7)); }
        let nl = s.doc.layers.len();
        for it in items.iter_mut() { if it.layer >= nl { it.layer = 0; } }
        s.doc.items = items;
        s
    }
}

fn skipped_text(s: &[(String, usize)]) -> String {
    s.iter().map(|x| format!("{} {}", x.1, x.0)).collect::<Vec<_>>().join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool { (a - b).abs() < 1e-9 }
    fn pclose(a: P, b: P) -> bool { close(a.0, b.0) && close(a.1, b.1) }

    #[test]
    fn arc_through_three_points() {
        // (1,0), (0,1), (-1,0) lie on the unit circle and turn left: the upper half, 0 to 180.
        let g = arc3((1.0, 0.0), (0.0, 1.0), (-1.0, 0.0)).unwrap();
        match g { Geo::Arc { c, r, start, end } => { assert!(pclose(c, (0.0, 0.0)) && close(r, 1.0) && close(start, 0.0) && close(end, 180.0)); } _ => panic!() }
        // The same ends through (0,-1) turn right: the lower half, still stored counter-clockwise, 180 to 0.
        let g = arc3((1.0, 0.0), (0.0, -1.0), (-1.0, 0.0)).unwrap();
        match g { Geo::Arc { start, end, .. } => { assert!(close(start, 180.0) && close(end, 0.0)); } _ => panic!() }
        // 3-4-5: the circle through (0,0), (6,0), (6,8) has the hypotenuse as diameter: centre (3,4), r 5.
        let g = arc3((0.0, 0.0), (6.0, 0.0), (6.0, 8.0)).unwrap();
        match g { Geo::Arc { c, r, .. } => { assert!(pclose(c, (3.0, 4.0)) && close(r, 5.0)); } _ => panic!() }
        assert!(arc3((0.0, 0.0), (1.0, 1.0), (2.0, 2.0)).is_err());
        assert!(arc3((0.0, 0.0), (0.0, 0.0), (2.0, 2.0)).is_err());
    }

    #[test]
    fn crossings() {
        let seg = |a: P, b: P| Prim::Seg { a, b };
        let circ = |c: P, r: f64| Prim::Arc { c, r, s: 0.0, e: 360.0, full: true };
        // Diagonals of a square cross in the middle.
        let x = intersections(&seg((0.0, 0.0), (2.0, 2.0)), &seg((0.0, 2.0), (2.0, 0.0)));
        assert!(x.len() == 1 && pclose(x[0], (1.0, 1.0)));
        // Parallel lines and lines that stop short do not.
        assert!(intersections(&seg((0.0, 0.0), (2.0, 0.0)), &seg((0.0, 1.0), (2.0, 1.0))).is_empty());
        assert!(intersections(&seg((0.0, 0.0), (1.0, 0.0)), &seg((2.0, -1.0), (2.0, 1.0))).is_empty());
        // The line y = 3 cuts the circle r 5 at x = -4 and 4 (3-4-5).
        let x = intersections(&seg((-10.0, 3.0), (10.0, 3.0)), &circ((0.0, 0.0), 5.0));
        assert!(x.len() == 2 && pclose(x[0], (-4.0, 3.0)) && pclose(x[1], (4.0, 3.0)));
        // A tangent line touches once.
        let x = intersections(&seg((-10.0, 5.0), (10.0, 5.0)), &circ((0.0, 0.0), 5.0));
        assert!(x.len() == 1 && pclose(x[0], (0.0, 5.0)));
        // An arc only counts where it is drawn: the upper half meets y = 3 twice, the right quarter once.
        let up = Prim::Arc { c: (0.0, 0.0), r: 5.0, s: 0.0, e: 180.0, full: false };
        assert_eq!(intersections(&seg((-10.0, 3.0), (10.0, 3.0)), &up).len(), 2);
        let q1 = Prim::Arc { c: (0.0, 0.0), r: 5.0, s: 0.0, e: 90.0, full: false };
        let x = intersections(&q1, &seg((-10.0, 3.0), (10.0, 3.0)));
        assert!(x.len() == 1 && pclose(x[0], (4.0, 3.0)));
        // Two circles r 5 with centres 6 apart cross at x = 3, y = +-4.
        let mut x = intersections(&circ((0.0, 0.0), 5.0), &circ((6.0, 0.0), 5.0));
        x.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        assert!(x.len() == 2 && pclose(x[0], (3.0, -4.0)) && pclose(x[1], (3.0, 4.0)));
        // Touching circles meet once; separate or one inside the other never.
        let x = intersections(&circ((0.0, 0.0), 5.0), &circ((8.0, 0.0), 3.0));
        assert!(x.len() == 1 && pclose(x[0], (5.0, 0.0)));
        assert!(intersections(&circ((0.0, 0.0), 5.0), &circ((20.0, 0.0), 3.0)).is_empty());
        assert!(intersections(&circ((0.0, 0.0), 5.0), &circ((1.0, 0.0), 1.0)).is_empty());
    }

    #[test]
    fn nearest_points() {
        let s = Prim::Seg { a: (0.0, 0.0), b: (10.0, 0.0) };
        assert!(pclose(s.nearest((3.0, 4.0)), (3.0, 0.0)) && pclose(s.nearest((-5.0, 4.0)), (0.0, 0.0)) && pclose(s.nearest((15.0, 1.0)), (10.0, 0.0)));
        let a = Prim::Arc { c: (0.0, 0.0), r: 5.0, s: 0.0, e: 90.0, full: false };
        assert!(pclose(a.nearest((6.0, 8.0)), (3.0, 4.0)));
        // Off the end of the arc the nearest point is the end.
        assert!(pclose(a.nearest((-3.0, 4.0)), (0.0, 5.0)) && pclose(a.nearest((4.0, -3.0)), (5.0, 0.0)));
        assert!(close(a.length(), 2.5 * std::f64::consts::PI));
        assert!(pclose(a.mid().unwrap(), (5.0 * 0.5f64.sqrt(), 5.0 * 0.5f64.sqrt())));
    }

    fn demo() -> Sketch {
        let mut s = Sketch::new(false);
        s.add(0, Geo::Line { a: (0.0, 0.0), b: (10.0, 0.0) }).unwrap();
        s.add(0, Geo::Line { a: (5.0, -5.0), b: (5.0, 5.0) }).unwrap();
        s.add(0, Geo::Circle { c: (20.0, 0.0), r: 4.0 }).unwrap();
        s
    }

    #[test]
    fn snap_order() {
        let s = demo();
        let all = SNAP_END | SNAP_INT | SNAP_MID | SNAP_CEN | SNAP_QUAD | SNAP_NEAR;
        // Near the end of the first line.
        assert_eq!(s.snap((0.2, 0.1), 0.5, all, 0.0), ((0.0, 0.0), SNAP_END));
        // Where the two lines cross is also the middle of both: the intersection wins.
        let r = s.snap((5.1, 0.2), 0.5, all, 0.0);
        assert!(pclose(r.0, (5.0, 0.0)) && r.1 == SNAP_INT);
        // With intersections off the middle point is found.
        let r = s.snap((5.1, 0.2), 0.5, all & !SNAP_INT, 0.0);
        assert!(pclose(r.0, (5.0, 0.0)) && r.1 == SNAP_MID);
        // Centre and quadrant of the circle.
        assert_eq!(s.snap((20.1, 0.1), 0.5, all, 0.0), ((20.0, 0.0), SNAP_CEN));
        let r = s.snap((20.1, 4.2), 0.5, all, 0.0);
        assert!(pclose(r.0, (20.0, 4.0)) && r.1 == SNAP_QUAD);
        // Somewhere along the line: the nearest point on it.
        let r = s.snap((2.3, 0.2), 0.5, all, 0.0);
        assert!(pclose(r.0, (2.3, 0.0)) && r.1 == SNAP_NEAR);
        // Two snap points in reach: the nearer one wins whatever its kind (the middle of the
        // upright line at (5, 0) against the end of a short line at (5.4, 0)).
        let mut t = Sketch::new(false);
        t.add(0, Geo::Line { a: (5.0, -5.0), b: (5.0, 5.0) }).unwrap();
        t.add(0, Geo::Line { a: (5.4, 0.0), b: (9.0, 3.0) }).unwrap();
        assert_eq!(t.snap((5.1, 0.0), 0.5, all, 0.0), ((5.0, 0.0), SNAP_MID));
        assert_eq!(t.snap((5.3, 0.0), 0.5, all, 0.0), ((5.4, 0.0), SNAP_END));
        // Nothing in reach: the grid, or the point as it is.
        assert_eq!(s.snap((12.3, 7.6), 0.5, all | SNAP_GRID, 1.0), ((12.0, 8.0), SNAP_GRID));
        assert_eq!(s.snap((12.3, 7.6), 0.5, all, 1.0), ((12.3, 7.6), 0));
        // Line and circle crossing: the line y = 0 from 0 to 10 does not reach the circle; add one that does.
        let mut s = s;
        s.add(0, Geo::Line { a: (10.0, 0.0), b: (30.0, 0.0) }).unwrap();
        let r = s.snap((16.2, 0.3), 0.5, all, 0.0);
        assert!(pclose(r.0, (16.0, 0.0)) && r.1 == SNAP_INT);
    }

    #[test]
    fn edit_undo_redo() {
        let mut s = demo();
        assert_eq!(s.doc.items.len(), 3);
        assert!(s.add(0, Geo::Line { a: (1.0, 1.0), b: (1.0, 1.0) }).is_err());
        assert!(s.add(0, Geo::Circle { c: (0.0, 0.0), r: 0.0 }).is_err());
        assert!(s.add(0, Geo::Text { p: (0.0, 0.0), h: 1.0, rot: 0.0, text: "x".repeat(251) }).is_err());
        assert!(s.add(0, Geo::Text { p: (0.0, 0.0), h: 1.0, rot: 0.0, text: "  ".into() }).is_err());
        assert_eq!(s.doc.items.len(), 3);
        assert_eq!(s.pick((20.0, 4.1), 0.3), Some(2));
        assert_eq!(s.pick((50.0, 50.0), 0.3), None);
        assert_eq!(s.delete(&[0, 2]), 2);
        assert_eq!(s.doc.items.len(), 1);
        assert!(s.undo());
        assert_eq!(s.doc.items.len(), 3);
        assert!(s.redo());
        assert_eq!(s.doc.items.len(), 1);
        assert!(!s.redo());
        assert!(s.undo());
        // Move and copy.
        assert_eq!(s.move_by(&[2], 5.0, 1.0, false), vec![2]);
        assert_eq!(s.doc.items[2].geo, Geo::Circle { c: (25.0, 1.0), r: 4.0 });
        assert_eq!(s.move_by(&[2], 10.0, 0.0, true), vec![3]);
        assert_eq!(s.doc.items[3].geo, Geo::Circle { c: (35.0, 1.0), r: 4.0 });
        assert_eq!(s.doc.items[2].geo, Geo::Circle { c: (25.0, 1.0), r: 4.0 });
        assert!(s.move_by(&[2], 0.0, 0.0, false).is_empty());
        // Units: 25.4 mm is one inch; changing back restores the numbers.
        let mut u = Sketch::new(false);
        u.add(0, Geo::Circle { c: (25.4, 50.8), r: 12.7 }).unwrap();
        assert!(u.set_units(true, true));
        match &u.doc.items[0].geo { Geo::Circle { c, r } => assert!(pclose(*c, (1.0, 2.0)) && close(*r, 0.5)), _ => panic!() }
        assert!(u.undo() && !u.inch);
        assert!(u.set_units(true, false) && u.inch);
        assert_eq!(u.doc.items[0].geo, Geo::Circle { c: (25.4, 50.8), r: 12.7 });
        assert!(u.clear() && u.doc.items.is_empty() && !u.clear());
    }

    #[test]
    fn text_form_round_trip() {
        let mut s = demo();
        let hole = s.layer_named("HOLES", 1);
        assert_eq!(hole, 1);
        assert_eq!(s.layer_named("holes", 3), 1);
        s.add(hole, arc3((1.0, 0.0), (0.0, 1.0), (-1.0, 0.0)).unwrap()).unwrap();
        s.add(hole, rect((0.0, 0.0), (30.0, 20.0)).unwrap()).unwrap();
        s.add(0, Geo::Point { p: (1.5, -2.25) }).unwrap();
        s.add(0, Geo::Text { p: (3.0, 4.0), h: 2.5, rot: 30.0, text: "R5 \u{00D8}10 typ".into() }).unwrap();
        s.add(0, Geo::Poly { v: vec![(0.0, 0.0, 1.0), (10.0, 0.0, 0.0), (10.0, 5.0, -0.5)], closed: false }).unwrap();
        let t = s.to_text();
        let b = Sketch::from_text(&t);
        assert_eq!(b.doc, s.doc);
        assert_eq!(b.inch, s.inch);
        assert!(!b.can_undo());
        // Damaged lines are dropped, the rest is kept.
        let b = Sketch::from_text("U\tinch\nL\t0\t0\t0\t1\tx\nC\t0\t1\t1\t2\nQ\tjunk\n");
        assert!(b.inch && b.doc.items.len() == 1 && b.doc.layers.len() == 1);
    }

    #[test]
    fn tangent_and_square_snaps() {
        // From (5, 0) the tangents to the unit circle about the origin touch at (0.2, +-sqrt(0.96)):
        // cos of the angle at the centre is r / d = 1 / 5.
        let t = tangent_points((5.0, 0.0), (0.0, 0.0), 1.0);
        assert!(t.len() == 2 && pclose(t[0], (0.2, 0.96f64.sqrt())) && pclose(t[1], (0.2, -(0.96f64.sqrt()))));
        // The tangent is square to the radius at the touching point.
        let (q, c, p) = (t[0], (0.0, 0.0), (5.0, 0.0));
        assert!(close((q.0 - c.0) * (p.0 - q.0) + (q.1 - c.1) * (p.1 - q.1), 0.0));
        assert!(tangent_points((0.5, 0.0), (0.0, 0.0), 1.0).is_empty());
        assert!(pclose(foot((3.0, 4.0), (0.0, 0.0), (10.0, 0.0)).unwrap(), (3.0, 0.0)));
        let mut s = Sketch::new(false);
        s.add(0, Geo::Circle { c: (0.0, 0.0), r: 1.0 }).unwrap();
        s.add(0, Geo::Line { a: (0.0, -5.0), b: (10.0, -5.0) }).unwrap();
        let all = 511 & !SNAP_GRID;
        let r = s.snap_from((0.25, 0.95), 0.2, all, 0.0, Some((5.0, 0.0)));
        assert!(pclose(r.0, (0.2, 0.96f64.sqrt())) && r.1 == SNAP_TAN);
        // Without a last point there is no tangent: the nearest point on the circle is given.
        assert_eq!(s.snap((0.25, 0.95), 0.2, all, 0.0).1, SNAP_NEAR);
        // Square onto the line from (5, 0): straight below.
        let r = s.snap_from((5.1, -4.9), 0.3, all, 0.0, Some((5.0, 0.0)));
        assert!(pclose(r.0, (5.0, -5.0)) && r.1 == SNAP_MID, "the middle of the line is at the same place and wins: {:?}", r);
        let r = s.snap_from((3.1, -4.9), 0.3, all, 0.0, Some((3.0, 0.0)));
        assert!(pclose(r.0, (3.0, -5.0)) && r.1 == SNAP_PERP);
        // Square onto the circle from (5, 0): the near point (1, 0) is a quadrant too, which wins.
        let r = s.snap_from((1.05, 0.05), 0.2, all, 0.0, Some((5.0, 0.0)));
        assert!(pclose(r.0, (1.0, 0.0)) && r.1 == SNAP_QUAD);
        let r = s.snap_from((0.75, 0.7), 0.2, all, 0.0, Some((5.0, 5.0)));
        assert!(pclose(r.0, (0.5f64.sqrt(), 0.5f64.sqrt())) && r.1 == SNAP_PERP);
    }

    #[test]
    fn between_two_entities() {
        let mut s = Sketch::new(false);
        s.add(0, Geo::Line { a: (0.0, 0.0), b: (10.0, 0.0) }).unwrap();
        s.add(0, Geo::Line { a: (2.0, -2.0), b: (6.0, 2.0) }).unwrap();
        s.add(0, Geo::Line { a: (0.0, 3.0), b: (-5.0, 3.0) }).unwrap();
        s.add(0, Geo::Circle { c: (3.0, 4.0), r: 1.0 }).unwrap();
        s.add(0, Geo::Point { p: (0.0, 0.0) }).unwrap();
        s.add(0, Geo::Text { p: (0.0, 0.0), h: 1.0, rot: 0.0, text: "x".into() }).unwrap();
        let get = |r: &[(String, f64, char)], l: &str| r.iter().find(|x| x.0 == l).unwrap().1;
        let r = s.between(0, 1);
        assert!(close(get(&r, "Angle between"), 45.0) && close(get(&r, "The other angle"), 135.0));
        assert!(close(get(&r, "The lines meet at X"), 4.0) && close(get(&r, "The lines meet at Y"), 0.0));
        // Opposite directions still count as parallel.
        let r = s.between(0, 2);
        assert!(close(get(&r, "Angle between"), 0.0) && close(get(&r, "Parallel, distance apart"), 3.0));
        let r = s.between(3, 4);
        assert!(close(get(&r, "Centre distance"), 5.0) && close(get(&r, "Along X"), -3.0));
        let r = s.between(0, 3);
        assert!(close(get(&r, "Centre to the line, square"), 4.0) && close(get(&r, "Foot on the line X"), 3.0));
        assert_eq!(s.between(3, 0), r);
        assert!(s.between(0, 5).is_empty() && s.between(0, 99).is_empty());
    }

    /// With BENCHMATE_DXF_OUT set, writes a sketch in both DXF versions, as
    /// polylines and taken apart, for the outside programs
    /// (scripts/check_dxf.py and scripts/check_dxf_cad.py). One sample is
    /// closed outlines only, so every program can measure it; the other has
    /// open lines, a point and text as well.
    #[test]
    fn write_samples() {
        let Ok(dir) = std::env::var("BENCHMATE_DXF_OUT") else { return };
        let mut plate = Sketch::new(false);
        // A plate 80 x 50 with a rounded right end (a half circle of radius 25), and two holes of 12.
        plate.add(0, Geo::Poly { v: vec![(0.0, 0.0, 0.0), (80.0, 0.0, 1.0), (80.0, 50.0, 0.0), (0.0, 50.0, 0.0)], closed: true }).unwrap();
        let holes = plate.layer_named("HOLES", 1);
        plate.add(holes, Geo::Circle { c: (20.0, 25.0), r: 6.0 }).unwrap();
        plate.add(holes, Geo::Circle { c: (60.0, 25.0), r: 6.0 }).unwrap();
        let mut notes = plate.clone();
        let cons = notes.layer_named("CONSTRUCTION", 4);
        notes.add(cons, Geo::Line { a: (0.0, 0.0), b: (80.0, 50.0) }).unwrap();
        notes.add(cons, arc3((20.0, 50.0), (40.0, 60.0), (60.0, 50.0)).unwrap()).unwrap();
        notes.add(cons, Geo::Point { p: (40.0, 25.0) }).unwrap();
        let txt = notes.layer_named("NOTES", 3);
        notes.add(txt, Geo::Text { p: (5.0, -8.0), h: 2.5, rot: 0.0, text: "PLATE 80 x 50, 2x \u{00D8}12 \u{00B1}0.1".into() }).unwrap();
        notes.add(txt, Geo::Text { p: (-3.0, 5.0), h: 2.5, rot: 90.0, text: "EDGE A".into() }).unwrap();
        let mut expected = String::new();
        for (name, s, measured) in [("sketchplate", &plate, true), ("sketchnotes", &notes, false)] {
            for (f, r12, la) in [("r2000-mm", false, false), ("r12-mm", true, false), ("r2000-mm-la", false, true), ("r12-mm-la", true, true)] {
                std::fs::write(format!("{dir}/{name}-{f}.dxf"), s.export_dxf(r12, la)).unwrap();
                if measured {
                    let e = s.doc.extents().unwrap();
                    expected.push_str(&format!("{name}-{f}.dxf\t{}\t{}\t{}\t{}\t{}\t{}\n", e.2 - e.0, e.3 - e.1, e.2 - e.0, e.3 - e.1, if la { 0 } else { 1 }, if !la && r12 { 1 } else { 0 }));
                }
            }
        }
        std::fs::write(format!("{dir}/expected-sketch.tsv"), expected).unwrap();
    }

    #[test]
    fn display_list() {
        let mut s = Sketch::new(true);
        s.add(0, Geo::Poly { v: vec![(0.0, 0.0, 1.0), (2.0, 0.0, 0.0), (2.0, 2.0, 0.0)], closed: false }).unwrap();
        s.add(0, Geo::Circle { c: (1.0, 1.0), r: 0.5 }).unwrap();
        s.add(0, Geo::Text { p: (0.0, 0.0), h: 1.0, rot: 0.0, text: "AB".into() }).unwrap();
        let d = s.display();
        let l: Vec<&str> = d.lines().collect();
        assert_eq!(l[0], "U\tinch");
        assert_eq!(l[1], "Y\t0\t7");
        // Bulge 1 from (0,0) to (2,0): a half circle about (1,0), radius 1, counter-clockwise from 180 to 0 (through the bottom).
        assert_eq!(l[2], "R\t0\t0\t1\t0\t1\t180\t0\t0");
        assert_eq!(l[3], "S\t0\t0\t2\t0\t2\t2");
        assert_eq!(l[4], "R\t1\t0\t1\t1\t0.5\t0\t360\t1");
        assert_eq!(l[5], "T\t2\t0\t0\t0\t1\t0\t1.4\tAB");
    }

    #[test]
    fn info_rows() {
        let mut s = Sketch::new(false);
        s.add(0, Geo::Line { a: (0.0, 0.0), b: (3.0, 4.0) }).unwrap();
        s.add(0, rect((0.0, 0.0), (30.0, 20.0)).unwrap()).unwrap();
        s.add(0, Geo::Arc { c: (0.0, 0.0), r: 10.0, start: 0.0, end: 90.0 }).unwrap();
        let get = |r: &[(String, f64, char)], l: &str| r.iter().find(|x| x.0 == l).unwrap().1;
        let r = s.info(0);
        assert!(close(get(&r, "Length"), 5.0) && close(get(&r, "Direction"), 53.13010235415598));
        let r = s.info(1);
        assert!(close(get(&r, "Perimeter"), 100.0) && close(get(&r, "Area"), 600.0) && close(get(&r, "Width"), 30.0));
        let r = s.info(2);
        assert!(close(get(&r, "Arc length"), 5.0 * std::f64::consts::PI) && close(get(&r, "Chord"), 10.0 * 2f64.sqrt()) && close(get(&r, "Included angle"), 90.0));
        assert!(s.info(9).is_empty());
        let m = measure((1.0, 1.0), (1.0, -2.0));
        assert!(close(m.0, 3.0) && close(m.3, 270.0));
        assert!(pclose(polar((1.0, 1.0), 2.0, 90.0), (1.0, 3.0)));
        assert_eq!(ortho((0.0, 0.0), (5.0, 1.0)), (5.0, 0.0));
        assert_eq!(ortho((0.0, 0.0), (1.0, -5.0)), (0.0, -5.0));
    }

    #[test]
    fn text_is_picked_by_its_box() {
        let mut s = Sketch::new(false);
        s.add(0, Geo::Text { p: (0.0, 0.0), h: 2.0, rot: 90.0, text: "ABCDE".into() }).unwrap();
        // Rotated 90 degrees the box runs up the Y axis: 7 long (5 x 0.7 x 2), 2 wide to the left.
        assert_eq!(s.pick((-1.0, 3.0), 0.1), Some(0));
        assert_eq!(s.pick((1.0, 3.0), 0.1), None);
        assert!(close(geo_distance(&s.doc.items[0].geo, (-1.0, 9.0)), 2.0));
        let b = text_box((0.0, 0.0), 2.0, 90.0, "ABCDE");
        assert!(pclose(b[2], (-2.0, 7.0)));
    }

    #[test]
    fn dxf_out_and_in() {
        let mut s = demo();
        let hole = s.layer_named("HOLES", 1);
        s.add(hole, arc3((1.0, 0.0), (0.0, 1.0), (-1.0, 0.0)).unwrap()).unwrap();
        s.add(hole, Geo::Poly { v: vec![(0.0, 0.0, 1.0), (10.0, 0.0, 0.0), (10.0, 5.0, -0.5)], closed: true }).unwrap();
        s.add(0, Geo::Point { p: (1.5, -2.25) }).unwrap();
        s.add(0, Geo::Text { p: (3.0, 4.0), h: 2.5, rot: 30.0, text: "\u{00D8}10 ^ typ".into() }).unwrap();
        for r12 in [false, true] {
            let f = s.export_dxf(r12, false);
            let mut b = Sketch::new(true);
            let rep = b.import_dxf(&f, true).unwrap();
            assert_eq!(b.doc.items.len(), s.doc.items.len(), "r12 {}", r12);
            for (x, y) in b.doc.items.iter().zip(s.doc.items.iter()) {
                assert_eq!(b.doc.layers[x.layer].0, s.doc.layers[y.layer].0);
                assert_eq!(x.geo, y.geo, "r12 {}", r12);
            }
            // R2000 states millimetres; R12 has no unit, so the default (inch here) is taken and said.
            assert_eq!(b.inch, r12);
            assert!(rep[0].contains(if r12 { "taken as inches" } else { "The file is in millimetres" }), "{:?}", rep);
            assert!(b.undo() && b.doc.items.is_empty());
        }
        // Taken apart: the closed polyline of three points becomes an arc, a line and an arc.
        let mut b = Sketch::new(false);
        b.import_dxf(&s.export_dxf(false, true), false).unwrap();
        assert_eq!(b.doc.items.len(), s.doc.items.len() + 2);
        assert_eq!(b.doc.extents().map(|e| (e.0 * 1e6).round()), s.doc.extents().map(|e| (e.0 * 1e6).round()));
        let mut b = Sketch::new(false);
        assert!(b.import_dxf("hello\nworld\n", false).is_err());
        assert!(b.import_dxf("  0\nSECTION\n  2\nENTITIES\n  0\nSPLINE\n  8\n0\n  0\nENDSEC\n  0\nEOF\n", false).unwrap_err().contains("1 SPLINE"));
    }
}
