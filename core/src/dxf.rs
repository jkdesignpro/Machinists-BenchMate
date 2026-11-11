//! 2D drawing model and an ASCII DXF writer (R2000 / AC1015 and R12 / AC1009).
//!
//! The drawing holds LINE, CIRCLE, ARC and closed or open polylines with
//! bulges, each on one of three layers (outline, holes, centre marks). The
//! writer follows Autodesk's published DXF Reference [DXF]:
//!
//! * file layout: HEADER, CLASSES, TABLES, BLOCKS, ENTITIES, OBJECTS, EOF;
//!   group code / value pairs on two lines each;
//! * R2000 needs handles (code 5, DIMSTYLE 105) on every table, table entry,
//!   block, entity and object, owner handles (330) and subclass markers
//!   (100); `$HANDSEED` is larger than every handle used;
//! * `$INSUNITS` (code 70): 1 = inches, 4 = millimetres; `$MEASUREMENT`
//!   (code 70): 0 = English, 1 = metric;
//! * ARC angles (50, 51) in degrees, counter-clockwise from start to end;
//! * LWPOLYLINE (R2000): 90 vertex count, 70 flag 1 = closed, then per
//!   vertex 10/20 and optional 42 bulge; R12 has no LWPOLYLINE, so the same
//!   shape is written as POLYLINE / VERTEX (42 bulge) / SEQEND;
//! * bulge = tan(theta / 4), theta the included angle of the arc segment
//!   from this vertex to the next; positive = counter-clockwise.
//!
//! [DXF] Autodesk, "DXF Reference" (AutoCAD 2012 edition, PDF, and the
//! current online edition), sections "HEADER Section Group Codes",
//! "TABLES Section", "BLOCKS Section", "ENTITIES Section" (ARC, CIRCLE,
//! LINE, LWPOLYLINE, POLYLINE, VERTEX) and "OBJECTS Section" (DICTIONARY).
//! See docs/cad-dxf.md.

use std::f64::consts::PI;
use std::fmt::Write;

/// Drawing layers. Names and ACI colours are what the DXF carries.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Layer { Outline, Holes, Centre }

impl Layer {
    pub const ALL: [Layer; 3] = [Layer::Outline, Layer::Holes, Layer::Centre];
    pub fn name(self) -> &'static str {
        match self { Layer::Outline => "OUTLINE", Layer::Holes => "HOLES", Layer::Centre => "CENTRE" }
    }
    /// AutoCAD Color Index: 7 white/black, 1 red, 4 cyan.
    pub fn colour(self) -> i32 { match self { Layer::Outline => 7, Layer::Holes => 1, Layer::Centre => 4 } }
    pub fn index(self) -> u32 { match self { Layer::Outline => 0, Layer::Holes => 1, Layer::Centre => 2 } }
}

/// One drawing entity. Points are (x, y); angles in degrees.
#[derive(Clone, PartialEq, Debug)]
pub enum Entity {
    Line { layer: Layer, a: (f64, f64), b: (f64, f64) },
    Circle { layer: Layer, c: (f64, f64), r: f64 },
    /// Counter-clockwise from `start` to `end` (degrees).
    Arc { layer: Layer, c: (f64, f64), r: f64, start: f64, end: f64 },
    /// Vertices (x, y, bulge to the next vertex).
    Poly { layer: Layer, v: Vec<(f64, f64, f64)>, closed: bool },
}

impl Entity {
    pub fn layer(&self) -> Layer {
        match self { Entity::Line { layer, .. } | Entity::Circle { layer, .. } | Entity::Arc { layer, .. } | Entity::Poly { layer, .. } => *layer }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Units { Inch, Mm }
impl Units {
    /// `$INSUNITS` value [DXF]: 1 inches, 4 millimetres.
    pub fn insunits(self) -> i32 { match self { Units::Inch => 1, Units::Mm => 4 } }
    /// `$MEASUREMENT` value [DXF]: 0 English, 1 metric.
    pub fn measurement(self) -> i32 { match self { Units::Inch => 0, Units::Mm => 1 } }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Version { R12, R2000 }

/// A 2D drawing: a list of entities.
#[derive(Clone, Default, Debug, PartialEq)]
pub struct Drawing { pub entities: Vec<Entity> }

fn rot(p: (f64, f64), c: f64, s: f64) -> (f64, f64) { (p.0 * c - p.1 * s, p.0 * s + p.1 * c) }
fn norm_deg(a: f64) -> f64 { let r = a.rem_euclid(360.0); if (r - 360.0).abs() < 1e-12 { 0.0 } else { r } }

/// Centre, radius and CCW start/end angles (degrees) of the arc segment from
/// `p1` to `p2` with bulge `b` (b != 0). The centre lies on the left of the
/// chord at distance c (1 - b^2) / (4 b); r = c (1 + b^2) / (4 |b|).
pub fn bulge_arc(p1: (f64, f64), p2: (f64, f64), b: f64) -> ((f64, f64), f64, f64, f64) {
    let (dx, dy) = (p2.0 - p1.0, p2.1 - p1.1);
    let c = dx.hypot(dy);
    let k = (1.0 - b * b) / (4.0 * b);
    let centre = ((p1.0 + p2.0) / 2.0 - dy * k, (p1.1 + p2.1) / 2.0 + dx * k);
    let r = c * (1.0 + b * b) / (4.0 * b.abs());
    let a1 = (p1.1 - centre.1).atan2(p1.0 - centre.0).to_degrees();
    let a2 = (p2.1 - centre.1).atan2(p2.0 - centre.0).to_degrees();
    if b > 0.0 { (centre, r, a1, a2) } else { (centre, r, a2, a1) }
}

/// Points that bound an arc: its end points and every axis point (0, 90,
/// 180, 270 degrees) inside the CCW sweep from `start` to `end`.
pub fn arc_bound_points(c: (f64, f64), r: f64, start: f64, end: f64) -> Vec<(f64, f64)> {
    let s = norm_deg(start);
    let mut sweep = norm_deg(end) - s;
    if sweep <= 0.0 { sweep += 360.0; }
    let at = |a: f64| (c.0 + r * a.to_radians().cos(), c.1 + r * a.to_radians().sin());
    let mut v = vec![at(start), at(end)];
    for q in [0.0, 90.0, 180.0, 270.0, 360.0, 450.0, 540.0, 630.0] {
        if q > s && q < s + sweep { v.push(at(q)); }
    }
    v
}

/// Signed area of a closed polyline with bulges: shoelace over the vertices
/// plus each arc segment's circular segment area r^2 / 2 (theta - sin theta),
/// signed like its bulge. Positive for a counter-clockwise outline.
pub fn poly_area(v: &[(f64, f64, f64)]) -> f64 {
    let n = v.len();
    let mut a = 0.0;
    for i in 0..n {
        let (p, q) = (v[i], v[(i + 1) % n]);
        a += p.0 * q.1 - q.0 * p.1;
        if p.2 != 0.0 {
            let c = (q.0 - p.0).hypot(q.1 - p.1);
            let th = 4.0 * p.2.abs().atan();
            let r = c * (1.0 + p.2 * p.2) / (4.0 * p.2.abs());
            a += 2.0 * p.2.signum() * r * r / 2.0 * (th - th.sin());
        }
    }
    a / 2.0
}

/// Length of a polyline with bulges (arc length for bulged segments).
pub fn poly_length(v: &[(f64, f64, f64)], closed: bool) -> f64 {
    let n = v.len();
    let segs = if closed { n } else { n.saturating_sub(1) };
    (0..segs).map(|i| {
        let (p, q) = (v[i], v[(i + 1) % n]);
        let c = (q.0 - p.0).hypot(q.1 - p.1);
        if p.2 == 0.0 { c } else { let th = 4.0 * p.2.abs().atan(); c * (1.0 + p.2 * p.2) / (4.0 * p.2.abs()) * th }
    }).sum()
}

impl Drawing {
    pub fn new() -> Self { Self::default() }
    pub fn push(&mut self, e: Entity) { self.entities.push(e); }
    pub fn line(&mut self, layer: Layer, a: (f64, f64), b: (f64, f64)) { self.push(Entity::Line { layer, a, b }); }
    pub fn circle(&mut self, layer: Layer, c: (f64, f64), r: f64) { self.push(Entity::Circle { layer, c, r }); }
    pub fn arc(&mut self, layer: Layer, c: (f64, f64), r: f64, start: f64, end: f64) { self.push(Entity::Arc { layer, c, r, start: norm_deg(start), end: norm_deg(end) }); }
    /// Closed polyline; consecutive duplicate vertices are dropped.
    pub fn closed_poly(&mut self, layer: Layer, v: Vec<(f64, f64, f64)>) {
        let mut out: Vec<(f64, f64, f64)> = Vec::with_capacity(v.len());
        for p in v {
            if let Some(last) = out.last_mut() {
                if (last.0 - p.0).abs() < 1e-12 && (last.1 - p.1).abs() < 1e-12 { last.2 = p.2; continue; }
            }
            out.push(p);
        }
        while out.len() > 1 { let (f, l) = (out[0], out[out.len() - 1]); if (f.0 - l.0).abs() < 1e-12 && (f.1 - l.1).abs() < 1e-12 { out.pop(); } else { break; } }
        self.push(Entity::Poly { layer, v: out, closed: true });
    }
    /// Centre mark: two lines crossing at `c`, each `2 * half` long.
    pub fn centre_mark(&mut self, c: (f64, f64), half: f64) {
        self.line(Layer::Centre, (c.0 - half, c.1), (c.0 + half, c.1));
        self.line(Layer::Centre, (c.0, c.1 - half), (c.0, c.1 + half));
    }

    /// Bounding box (xmin, ymin, xmax, ymax) of all entities, exact for arcs.
    pub fn extents(&self) -> Option<(f64, f64, f64, f64)> { self.extents_where(|_| true) }

    /// Bounding box of the part itself (outline and holes, not centre marks).
    pub fn part_extents(&self) -> Option<(f64, f64, f64, f64)> { self.extents_where(|l| l != Layer::Centre) }

    fn extents_where(&self, keep: impl Fn(Layer) -> bool) -> Option<(f64, f64, f64, f64)> {
        let mut pts: Vec<(f64, f64)> = Vec::new();
        for e in self.entities.iter().filter(|e| keep(e.layer())) {
            match e {
                Entity::Line { a, b, .. } => { pts.push(*a); pts.push(*b); }
                Entity::Circle { c, r, .. } => { pts.push((c.0 - r, c.1 - r)); pts.push((c.0 + r, c.1 + r)); }
                Entity::Arc { c, r, start, end, .. } => pts.extend(arc_bound_points(*c, *r, *start, *end)),
                Entity::Poly { v, closed, .. } => {
                    let n = v.len();
                    for i in 0..n {
                        pts.push((v[i].0, v[i].1));
                        if v[i].2 != 0.0 && (*closed || i + 1 < n) {
                            let q = v[(i + 1) % n];
                            let (c, r, s, t) = bulge_arc((v[i].0, v[i].1), (q.0, q.1), v[i].2);
                            pts.extend(arc_bound_points(c, r, s, t));
                        }
                    }
                }
            }
        }
        if pts.is_empty() { return None; }
        let f = |g: fn(f64, f64) -> f64, i: usize, init: f64| pts.iter().map(|p| if i == 0 { p.0 } else { p.1 }).fold(init, g);
        Some((f(f64::min, 0, f64::INFINITY), f(f64::min, 1, f64::INFINITY), f(f64::max, 0, f64::NEG_INFINITY), f(f64::max, 1, f64::NEG_INFINITY)))
    }

    pub fn translate(&mut self, dx: f64, dy: f64) {
        let t = |p: &mut (f64, f64)| { p.0 += dx; p.1 += dy; };
        for e in &mut self.entities {
            match e {
                Entity::Line { a, b, .. } => { t(a); t(b); }
                Entity::Circle { c, .. } | Entity::Arc { c, .. } => t(c),
                Entity::Poly { v, .. } => for p in v.iter_mut() { p.0 += dx; p.1 += dy; },
            }
        }
    }

    /// Rotate every entity about the origin by `deg` (CCW). Bulges are unchanged.
    pub fn rotate(&mut self, deg: f64) {
        if deg == 0.0 { return; }
        let (s, c) = deg.to_radians().sin_cos();
        for e in &mut self.entities {
            match e {
                Entity::Line { a, b, .. } => { *a = rot(*a, c, s); *b = rot(*b, c, s); }
                Entity::Circle { c: cc, .. } => *cc = rot(*cc, c, s),
                Entity::Arc { c: cc, start, end, .. } => { *cc = rot(*cc, c, s); *start = norm_deg(*start + deg); *end = norm_deg(*end + deg); }
                Entity::Poly { v, .. } => for p in v.iter_mut() { let q = rot((p.0, p.1), c, s); p.0 = q.0; p.1 = q.1; },
            }
        }
    }

    /// Move the drawing so the lower-left corner of the part's extents is at 0,0.
    pub fn origin_lower_left(&mut self) {
        if let Some((x0, y0, _, _)) = self.part_extents() { self.translate(-x0, -y0); }
    }

    /// Flat numeric form for the UI: [xmin, ymin, xmax, ymax (part extents), count, records...]
    /// with records Line [1, layer, x1, y1, x2, y2], Circle [2, layer, cx, cy, r],
    /// Arc [3, layer, cx, cy, r, start, end], Poly [4, layer, closed, n, (x, y, bulge) * n].
    pub fn flatten(&self) -> Vec<f64> {
        let (x0, y0, x1, y1) = self.part_extents().unwrap_or((0.0, 0.0, 0.0, 0.0));
        let mut o = vec![x0, y0, x1, y1, self.entities.len() as f64];
        for e in &self.entities {
            let l = e.layer().index() as f64;
            match e {
                Entity::Line { a, b, .. } => o.extend([1.0, l, a.0, a.1, b.0, b.1]),
                Entity::Circle { c, r, .. } => o.extend([2.0, l, c.0, c.1, *r]),
                Entity::Arc { c, r, start, end, .. } => o.extend([3.0, l, c.0, c.1, *r, *start, *end]),
                Entity::Poly { v, closed, .. } => {
                    o.extend([4.0, l, if *closed { 1.0 } else { 0.0 }, v.len() as f64]);
                    for p in v { o.extend([p.0, p.1, p.2]); }
                }
            }
        }
        o
    }
}

/// Number for a DXF value: up to 10 decimals, trailing zeros removed, never "-0".
pub fn num(x: f64) -> String {
    let mut s = format!("{:.10}", x);
    if s.contains('.') { while s.ends_with('0') { s.pop(); } if s.ends_with('.') { s.pop(); } }
    if s == "-0" { s = "0".into(); }
    s
}

struct W { out: String, next: u32 }
impl W {
    fn g(&mut self, code: i32, v: &str) { let _ = write!(self.out, "{:>3}\r\n{}\r\n", code, v); }
    fn f(&mut self, code: i32, v: f64) { let s = num(v); self.g(code, &s); }
    fn i(&mut self, code: i32, v: i64) { self.g(code, &v.to_string()); }
    fn h(&mut self) -> String { let s = format!("{:X}", self.next); self.next += 1; s }
    fn xyz(&mut self, base: i32, p: (f64, f64)) { self.f(base, p.0); self.f(base + 10, p.1); self.f(base + 20, 0.0); }
}

/// Geometry of one entity in a general document (any layer names), as the
/// sketcher and the DXF reader use it. Angles in degrees.
#[derive(Clone, PartialEq, Debug)]
pub enum Geo {
    Line { a: (f64, f64), b: (f64, f64) },
    Circle { c: (f64, f64), r: f64 },
    /// Counter-clockwise from `start` to `end`.
    Arc { c: (f64, f64), r: f64, start: f64, end: f64 },
    /// Vertices (x, y, bulge to the next vertex).
    Poly { v: Vec<(f64, f64, f64)>, closed: bool },
    Point { p: (f64, f64) },
    /// Single-line text: insertion point (left end of the baseline), height, rotation.
    Text { p: (f64, f64), h: f64, rot: f64, text: String },
}

#[derive(Clone, PartialEq, Debug)]
pub struct Item { pub layer: usize, pub geo: Geo }

/// A drawing with named layers: (name, AutoCAD Color Index).
#[derive(Clone, Default, PartialEq, Debug)]
pub struct Doc { pub layers: Vec<(String, i32)>, pub items: Vec<Item> }

/// A layer name the DXF format accepts: the characters `< > / \ " : ; ? * | = '`
/// and control characters become `_`; an empty name becomes `0`.
pub fn layer_name(s: &str) -> String {
    let t: String = s.trim().chars().map(|c| if c.is_control() || "<>/\\\":;?*|='".contains(c) { '_' } else { c }).collect();
    if t.is_empty() { "0".into() } else { t }
}

impl Doc {
    pub fn new() -> Self { Self::default() }

    pub fn from_drawing(d: &Drawing) -> Doc {
        let layers = Layer::ALL.iter().map(|l| (l.name().to_string(), l.colour())).collect();
        let items = d.entities.iter().map(|e| Item { layer: e.layer().index() as usize, geo: match e {
            Entity::Line { a, b, .. } => Geo::Line { a: *a, b: *b },
            Entity::Circle { c, r, .. } => Geo::Circle { c: *c, r: *r },
            Entity::Arc { c, r, start, end, .. } => Geo::Arc { c: *c, r: *r, start: *start, end: *end },
            Entity::Poly { v, closed, .. } => Geo::Poly { v: v.clone(), closed: *closed },
        } }).collect();
        Doc { layers, items }
    }

    /// Index of the layer called `name` (compared without case, as DXF does), added with `colour` if it is new.
    pub fn layer_index(&mut self, name: &str, colour: i32) -> usize {
        let n = layer_name(name);
        if let Some(i) = self.layers.iter().position(|l| l.0.eq_ignore_ascii_case(&n)) { return i; }
        self.layers.push((n, if (1..=255).contains(&colour) { colour } else { 7 }));
        self.layers.len() - 1
    }

    /// The same drawing with every polyline taken apart into separate LINE
    /// and ARC entities, for programs that do not read polyline bulges (the
    /// arcs inside a polyline). A closed outline stays a closed chain of
    /// pieces end to end, in the same order.
    pub fn exploded(&self) -> Doc {
        let mut items = Vec::with_capacity(self.items.len());
        for it in &self.items {
            match &it.geo {
                Geo::Poly { v, closed } => {
                    let n = v.len();
                    let segs = if *closed { n } else { n.saturating_sub(1) };
                    for i in 0..segs {
                        let (p, q) = (v[i], v[(i + 1) % n]);
                        if (p.0, p.1) == (q.0, q.1) { continue; }
                        let geo = if p.2 == 0.0 { Geo::Line { a: (p.0, p.1), b: (q.0, q.1) } }
                            else { let (c, r, s, e) = bulge_arc((p.0, p.1), (q.0, q.1), p.2); Geo::Arc { c, r, start: norm_deg(s), end: norm_deg(e) } };
                        items.push(Item { layer: it.layer, geo });
                    }
                }
                _ => items.push(it.clone()),
            }
        }
        Doc { layers: self.layers.clone(), items }
    }

    fn lname(&self, i: usize) -> &str { self.layers.get(i).map(|l| l.0.as_str()).unwrap_or("0") }

    /// Bounding box (xmin, ymin, xmax, ymax), exact for arcs. A text is taken
    /// as a box `0.7 x height` wide per character (an estimate: the real width
    /// depends on the font of the program that opens the file).
    pub fn extents(&self) -> Option<(f64, f64, f64, f64)> {
        let mut pts: Vec<(f64, f64)> = Vec::new();
        for it in &self.items {
            match &it.geo {
                Geo::Line { a, b } => { pts.push(*a); pts.push(*b); }
                Geo::Circle { c, r } => { pts.push((c.0 - r, c.1 - r)); pts.push((c.0 + r, c.1 + r)); }
                Geo::Arc { c, r, start, end } => pts.extend(arc_bound_points(*c, *r, *start, *end)),
                Geo::Poly { v, closed } => {
                    let n = v.len();
                    for i in 0..n {
                        pts.push((v[i].0, v[i].1));
                        if v[i].2 != 0.0 && (*closed || i + 1 < n) {
                            let q = v[(i + 1) % n];
                            let (c, r, s, t) = bulge_arc((v[i].0, v[i].1), (q.0, q.1), v[i].2);
                            pts.extend(arc_bound_points(c, r, s, t));
                        }
                    }
                }
                Geo::Point { p } => pts.push(*p),
                Geo::Text { p, h, rot, text } => {
                    let (s, c) = rot.to_radians().sin_cos();
                    let w = 0.7 * h * text.chars().count() as f64;
                    for q in [(0.0, 0.0), (w, 0.0), (w, *h), (0.0, *h)] { let r = rot_pt(q, c, s); pts.push((p.0 + r.0, p.1 + r.1)); }
                }
            }
        }
        if pts.is_empty() { return None; }
        let f = |g: fn(f64, f64) -> f64, i: usize, init: f64| pts.iter().map(|p| if i == 0 { p.0 } else { p.1 }).fold(init, g);
        Some((f(f64::min, 0, f64::INFINITY), f(f64::min, 1, f64::INFINITY), f(f64::max, 0, f64::NEG_INFINITY), f(f64::max, 1, f64::NEG_INFINITY)))
    }
}

fn rot_pt(p: (f64, f64), c: f64, s: f64) -> (f64, f64) { rot(p, c, s) }

/// Text as a DXF string value: control characters become spaces, a caret is
/// written as caret and space, the degree, plus or minus and diameter signs
/// as the control codes `%%d`, `%%p` and `%%c` that every DXF reader knows,
/// and other characters outside ASCII as `\U+XXXX` (the form the DXF
/// reference gives for Unicode in an ASCII file).
pub fn dxf_text(s: &str) -> String {
    let mut o = String::new();
    for c in s.chars() {
        if c.is_control() { o.push(' '); }
        else if c == '^' { o.push_str("^ "); }
        else if c == '\u{00B0}' { o.push_str("%%d"); }
        else if c == '\u{00B1}' { o.push_str("%%p"); }
        else if c == '\u{00D8}' { o.push_str("%%c"); }
        else if c.is_ascii() { o.push(c); }
        else if (c as u32) <= 0xFFFF { let _ = write!(o, "\\U+{:04X}", c as u32); }
        else { o.push('?'); }
    }
    o
}

/// The reverse of `dxf_text`, plus the `%%d`, `%%p` and `%%c` codes (degree, plus or minus, diameter).
pub fn dxf_untext(s: &str) -> String {
    let b: Vec<char> = s.chars().collect();
    let mut o = String::new();
    let mut i = 0;
    while i < b.len() {
        if b[i] == '\\' && i + 6 < b.len() && b.get(i + 1) == Some(&'U') && b.get(i + 2) == Some(&'+') {
            let hex: String = b[i + 3..(i + 7).min(b.len())].iter().collect();
            if hex.len() == 4 { if let Some(c) = u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32) { o.push(c); i += 7; continue; } }
        }
        if b[i] == '^' && b.get(i + 1) == Some(&' ') { o.push('^'); i += 2; continue; }
        if b[i] == '%' && b.get(i + 1) == Some(&'%') {
            match b.get(i + 2).map(|c| c.to_ascii_lowercase()) {
                Some('d') => { o.push('\u{00B0}'); i += 3; continue; }
                Some('p') => { o.push('\u{00B1}'); i += 3; continue; }
                Some('c') => { o.push('\u{00D8}'); i += 3; continue; }
                _ => {}
            }
        }
        o.push(b[i]); i += 1;
    }
    o
}

/// Write the drawing as an ASCII DXF file (CRLF line ends).
pub fn write_dxf(d: &Drawing, units: Units, ver: Version) -> String { write_doc(&Doc::from_drawing(d), units, ver) }

/// Write a general document as an ASCII DXF file (CRLF line ends).
pub fn write_doc(d: &Doc, units: Units, ver: Version) -> String {
    match ver { Version::R2000 => write_r2000(d, units), Version::R12 => write_r12(d) }
}

fn header(w: &mut W, d: &Doc, acadver: &str, units: Option<Units>, handseed: Option<&str>) {
    let (x0, y0, x1, y1) = d.extents().unwrap_or((0.0, 0.0, 0.0, 0.0));
    w.g(0, "SECTION"); w.g(2, "HEADER");
    w.g(9, "$ACADVER"); w.g(1, acadver);
    if let Some(h) = handseed { w.g(9, "$HANDSEED"); w.g(5, h); }
    if let Some(u) = units {
        w.g(9, "$INSUNITS"); w.i(70, u.insunits() as i64);
        w.g(9, "$MEASUREMENT"); w.i(70, u.measurement() as i64);
    }
    w.g(9, "$LUNITS"); w.i(70, 2);
    w.g(9, "$EXTMIN"); w.xyz(10, (x0, y0));
    w.g(9, "$EXTMAX"); w.xyz(10, (x1, y1));
    w.g(9, "$LIMMIN"); w.f(10, x0); w.f(20, y0);
    w.g(9, "$LIMMAX"); w.f(10, x1); w.f(20, y1);
    w.g(0, "ENDSEC");
}

fn view_centre(d: &Doc) -> ((f64, f64), f64, f64) {
    let (x0, y0, x1, y1) = d.extents().unwrap_or((0.0, 0.0, 1.0, 1.0));
    let (w, h) = ((x1 - x0).max(1e-6), (y1 - y0).max(1e-6));
    (((x0 + x1) / 2.0, (y0 + y1) / 2.0), h * 1.1, w / h)
}

/// The layers to write after layer 0: every layer of the document except one called 0.
fn own_layers(d: &Doc) -> Vec<&(String, i32)> { d.layers.iter().filter(|l| l.0 != "0").collect() }
/// Colour of layer 0: the document's own if it has that layer, else 7 (black or white).
fn zero_colour(d: &Doc) -> i32 { d.layers.iter().find(|l| l.0 == "0").map(|l| l.1).unwrap_or(7) }

fn write_r2000(d: &Doc, units: Units) -> String {
    let mut w = W { out: String::new(), next: 1 };
    // Handles allocated up front so owners can be referenced.
    let root = w.h(); let groups = w.h();
    let t_vport = w.h(); let t_ltype = w.h(); let t_layer = w.h(); let t_style = w.h(); let t_view = w.h();
    let t_ucs = w.h(); let t_appid = w.h(); let t_dim = w.h(); let t_br = w.h();
    let br_model = w.h(); let br_paper = w.h();
    let mut body = W { out: String::new(), next: w.next };

    body.g(0, "SECTION"); body.g(2, "CLASSES"); body.g(0, "ENDSEC");
    body.g(0, "SECTION"); body.g(2, "TABLES");
    let table = |b: &mut W, name: &str, h: &str, n: i64| { b.g(0, "TABLE"); b.g(2, name); b.g(5, h); b.g(330, "0"); b.g(100, "AcDbSymbolTable"); b.i(70, n); };
    let rec = |b: &mut W, kind: &str, owner: &str, sub: &str| { b.g(0, kind); let h = b.h(); b.g(5, &h); b.g(330, owner); b.g(100, "AcDbSymbolTableRecord"); b.g(100, sub); };
    // VPORT *Active, zoomed to the drawing.
    table(&mut body, "VPORT", &t_vport, 1);
    rec(&mut body, "VPORT", &t_vport, "AcDbViewportTableRecord");
    let (vc, vh, asp) = view_centre(d);
    body.g(2, "*Active"); body.i(70, 0);
    body.f(10, 0.0); body.f(20, 0.0); body.f(11, 1.0); body.f(21, 1.0);
    body.f(12, vc.0); body.f(22, vc.1); body.f(13, 0.0); body.f(23, 0.0); body.f(14, 1.0); body.f(24, 1.0);
    body.f(15, 1.0); body.f(25, 1.0); body.f(16, 0.0); body.f(26, 0.0); body.f(36, 1.0);
    body.f(17, 0.0); body.f(27, 0.0); body.f(37, 0.0); body.f(40, vh); body.f(41, asp); body.f(42, 50.0);
    body.f(43, 0.0); body.f(44, 0.0); body.f(50, 0.0); body.f(51, 0.0);
    body.i(71, 0); body.i(72, 100); body.i(73, 1); body.i(74, 3); body.i(75, 0); body.i(76, 0); body.i(77, 0); body.i(78, 0);
    body.g(0, "ENDTAB");
    // LTYPE: ByBlock, ByLayer, Continuous.
    table(&mut body, "LTYPE", &t_ltype, 3);
    for (name, desc) in [("ByBlock", ""), ("ByLayer", ""), ("Continuous", "Solid line")] {
        rec(&mut body, "LTYPE", &t_ltype, "AcDbLinetypeTableRecord");
        body.g(2, name); body.i(70, 0); body.g(3, desc); body.i(72, 65); body.i(73, 0); body.f(40, 0.0);
    }
    body.g(0, "ENDTAB");
    // LAYER: 0 plus the document's.
    let layers = own_layers(d);
    table(&mut body, "LAYER", &t_layer, 1 + layers.len() as i64);
    rec(&mut body, "LAYER", &t_layer, "AcDbLayerTableRecord");
    body.g(2, "0"); body.i(70, 0); body.i(62, zero_colour(d) as i64); body.g(6, "Continuous");
    for l in &layers {
        rec(&mut body, "LAYER", &t_layer, "AcDbLayerTableRecord");
        body.g(2, &l.0); body.i(70, 0); body.i(62, l.1 as i64); body.g(6, "Continuous");
    }
    body.g(0, "ENDTAB");
    table(&mut body, "STYLE", &t_style, 1);
    rec(&mut body, "STYLE", &t_style, "AcDbTextStyleTableRecord");
    body.g(2, "Standard"); body.i(70, 0); body.f(40, 0.0); body.f(41, 1.0); body.f(50, 0.0); body.i(71, 0); body.f(42, 2.5); body.g(3, "txt"); body.g(4, "");
    body.g(0, "ENDTAB");
    table(&mut body, "VIEW", &t_view, 0); body.g(0, "ENDTAB");
    table(&mut body, "UCS", &t_ucs, 0); body.g(0, "ENDTAB");
    table(&mut body, "APPID", &t_appid, 1);
    rec(&mut body, "APPID", &t_appid, "AcDbRegAppTableRecord");
    body.g(2, "ACAD"); body.i(70, 0);
    body.g(0, "ENDTAB");
    // DIMSTYLE: table carries an extra subclass; entries use code 105 for the handle.
    body.g(0, "TABLE"); body.g(2, "DIMSTYLE"); body.g(5, &t_dim); body.g(330, "0"); body.g(100, "AcDbSymbolTable"); body.i(70, 1); body.g(100, "AcDbDimStyleTable"); body.i(71, 0);
    body.g(0, "DIMSTYLE"); let h = body.h(); body.g(105, &h); body.g(330, &t_dim); body.g(100, "AcDbSymbolTableRecord"); body.g(100, "AcDbDimStyleTableRecord");
    body.g(2, "Standard"); body.i(70, 0);
    body.g(0, "ENDTAB");
    table(&mut body, "BLOCK_RECORD", &t_br, 2);
    for (h, name) in [(&br_model, "*Model_Space"), (&br_paper, "*Paper_Space")] {
        body.g(0, "BLOCK_RECORD"); body.g(5, h); body.g(330, &t_br); body.g(100, "AcDbSymbolTableRecord"); body.g(100, "AcDbBlockTableRecord"); body.g(2, name);
    }
    body.g(0, "ENDTAB");
    body.g(0, "ENDSEC");
    // BLOCKS: the two layout blocks, empty.
    body.g(0, "SECTION"); body.g(2, "BLOCKS");
    for (owner, name, paper) in [(&br_model, "*Model_Space", false), (&br_paper, "*Paper_Space", true)] {
        body.g(0, "BLOCK"); let h = body.h(); body.g(5, &h); body.g(330, owner); body.g(100, "AcDbEntity");
        if paper { body.i(67, 1); }
        body.g(8, "0"); body.g(100, "AcDbBlockBegin"); body.g(2, name); body.i(70, 0); body.xyz(10, (0.0, 0.0)); body.g(3, name); body.g(1, "");
        body.g(0, "ENDBLK"); let h = body.h(); body.g(5, &h); body.g(330, owner); body.g(100, "AcDbEntity");
        if paper { body.i(67, 1); }
        body.g(8, "0"); body.g(100, "AcDbBlockEnd");
    }
    body.g(0, "ENDSEC");
    // ENTITIES
    body.g(0, "SECTION"); body.g(2, "ENTITIES");
    for it in &d.items {
        let layer = d.lname(it.layer);
        let start = |b: &mut W, kind: &str| { b.g(0, kind); let h = b.h(); b.g(5, &h); b.g(330, &br_model); b.g(100, "AcDbEntity"); b.g(8, layer); };
        match &it.geo {
            Geo::Line { a, b } => { start(&mut body, "LINE"); body.g(100, "AcDbLine"); body.xyz(10, *a); body.xyz(11, *b); }
            Geo::Circle { c, r } => { start(&mut body, "CIRCLE"); body.g(100, "AcDbCircle"); body.xyz(10, *c); body.f(40, *r); }
            Geo::Arc { c, r, start: s, end: t } => {
                start(&mut body, "ARC"); body.g(100, "AcDbCircle"); body.xyz(10, *c); body.f(40, *r);
                body.g(100, "AcDbArc"); body.f(50, *s); body.f(51, *t);
            }
            Geo::Poly { v, closed } => {
                start(&mut body, "LWPOLYLINE"); body.g(100, "AcDbPolyline");
                body.i(90, v.len() as i64); body.i(70, if *closed { 1 } else { 0 }); body.f(43, 0.0);
                for p in v { body.f(10, p.0); body.f(20, p.1); if p.2 != 0.0 { body.f(42, p.2); } }
            }
            Geo::Point { p } => { start(&mut body, "POINT"); body.g(100, "AcDbPoint"); body.xyz(10, *p); }
            Geo::Text { p, h, rot, text } => {
                start(&mut body, "TEXT"); body.g(100, "AcDbText"); body.xyz(10, *p); body.f(40, *h); body.g(1, &dxf_text(text));
                if *rot != 0.0 { body.f(50, *rot); }
                body.g(7, "Standard"); body.g(100, "AcDbText");
            }
        }
    }
    body.g(0, "ENDSEC");
    // OBJECTS: root dictionary with ACAD_GROUP.
    body.g(0, "SECTION"); body.g(2, "OBJECTS");
    body.g(0, "DICTIONARY"); body.g(5, &root); body.g(330, "0"); body.g(100, "AcDbDictionary"); body.i(281, 1); body.g(3, "ACAD_GROUP"); body.g(350, &groups);
    body.g(0, "DICTIONARY"); body.g(5, &groups); body.g(330, &root); body.g(100, "AcDbDictionary"); body.i(281, 1);
    body.g(0, "ENDSEC");
    body.g(0, "EOF");

    let seed = format!("{:X}", body.next);
    header(&mut w, d, "AC1015", Some(units), Some(&seed));
    w.out.push_str(&body.out);
    w.out
}

fn write_r12(d: &Doc) -> String {
    // R12 has no $INSUNITS; units are agreed with the reader (see docs).
    let mut w = W { out: String::new(), next: 1 };
    header(&mut w, d, "AC1009", None, None);
    let layers = own_layers(d);
    w.g(0, "SECTION"); w.g(2, "TABLES");
    w.g(0, "TABLE"); w.g(2, "LTYPE"); w.i(70, 1);
    w.g(0, "LTYPE"); w.g(2, "CONTINUOUS"); w.i(70, 0); w.g(3, "Solid line"); w.i(72, 65); w.i(73, 0); w.f(40, 0.0);
    w.g(0, "ENDTAB");
    w.g(0, "TABLE"); w.g(2, "LAYER"); w.i(70, 1 + layers.len() as i64);
    w.g(0, "LAYER"); w.g(2, "0"); w.i(70, 0); w.i(62, zero_colour(d) as i64); w.g(6, "CONTINUOUS");
    for l in &layers { w.g(0, "LAYER"); w.g(2, &l.0); w.i(70, 0); w.i(62, l.1 as i64); w.g(6, "CONTINUOUS"); }
    w.g(0, "ENDTAB");
    w.g(0, "ENDSEC");
    w.g(0, "SECTION"); w.g(2, "BLOCKS"); w.g(0, "ENDSEC");
    w.g(0, "SECTION"); w.g(2, "ENTITIES");
    for it in &d.items {
        let layer = d.lname(it.layer);
        match &it.geo {
            Geo::Line { a, b } => { w.g(0, "LINE"); w.g(8, layer); w.xyz(10, *a); w.xyz(11, *b); }
            Geo::Circle { c, r } => { w.g(0, "CIRCLE"); w.g(8, layer); w.xyz(10, *c); w.f(40, *r); }
            Geo::Arc { c, r, start, end } => { w.g(0, "ARC"); w.g(8, layer); w.xyz(10, *c); w.f(40, *r); w.f(50, *start); w.f(51, *end); }
            Geo::Poly { v, closed } => {
                w.g(0, "POLYLINE"); w.g(8, layer); w.i(66, 1); w.xyz(10, (0.0, 0.0)); w.i(70, if *closed { 1 } else { 0 });
                for p in v { w.g(0, "VERTEX"); w.g(8, layer); w.xyz(10, (p.0, p.1)); if p.2 != 0.0 { w.f(42, p.2); } }
                w.g(0, "SEQEND"); w.g(8, layer);
            }
            Geo::Point { p } => { w.g(0, "POINT"); w.g(8, layer); w.xyz(10, *p); }
            Geo::Text { p, h, rot, text } => {
                w.g(0, "TEXT"); w.g(8, layer); w.xyz(10, *p); w.f(40, *h); w.g(1, &dxf_text(text));
                if *rot != 0.0 { w.f(50, *rot); }
            }
        }
    }
    w.g(0, "ENDSEC");
    w.g(0, "EOF");
    w.out
}

/// What reading a DXF file gave: the entities understood, the units the
/// file states (if any) and what was left out, by entity type.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ReadOut { pub doc: Doc, pub units: Option<Units>, pub skipped: Vec<(String, usize)>, pub notes: Vec<String> }

fn pairs(text: &str) -> Result<Vec<(i32, String)>, String> {
    let lines: Vec<&str> = text.lines().collect();
    let mut out = Vec::with_capacity(lines.len() / 2);
    let mut i = 0;
    while i + 1 < lines.len() {
        let code = lines[i].trim();
        if code.is_empty() && lines[i + 1].trim().is_empty() { i += 1; continue; }
        let c: i32 = code.parse().map_err(|_| format!("line {}: \"{}\" is not a group code. This does not look like an ASCII DXF file", i + 1, code.chars().take(20).collect::<String>()))?;
        out.push((c, lines[i + 1].trim_end_matches('\r').to_string()));
        i += 2;
    }
    Ok(out)
}

/// Strip the formatting codes of an MTEXT string: `\P` is a new line (a
/// space here), `\X...;` codes and braces are dropped, `\\` is a backslash.
fn mtext_plain(s: &str) -> String {
    let b: Vec<char> = s.chars().collect();
    let mut o = String::new();
    let mut i = 0;
    while i < b.len() {
        let c = b[i];
        if c == '\\' && i + 1 < b.len() {
            let n = b[i + 1];
            if n == 'P' || n == 'p' { o.push(' '); i += 2; continue; }
            if n == '\\' || n == '{' || n == '}' { o.push(n); i += 2; continue; }
            if n == 'U' && b.get(i + 2) == Some(&'+') { o.push(c); i += 1; continue; }
            if n.is_ascii_alphabetic() {
                let mut j = i + 2;
                if "LlOoKk".contains(n) { i = j; continue; } // toggles with no argument
                while j < b.len() && b[j] != ';' { j += 1; }
                i = (j + 1).min(b.len()); continue;
            }
        }
        if c == '{' || c == '}' { i += 1; continue; }
        o.push(c); i += 1;
    }
    o
}

/// Read an ASCII DXF file: LINE, CIRCLE, ARC, POINT, TEXT, MTEXT (as one
/// line), LWPOLYLINE and 2D POLYLINE in model space, with their layers.
/// Entities drawn in a mirrored plane (extrusion 0, 0, -1) are turned back
/// into the world plane by the arbitrary axis rule of the DXF reference
/// [DXF]: x changes sign, an arc from s to e becomes 180 - e to 180 - s, a
/// bulge changes sign. Everything else is counted in `skipped`.
pub fn read_dxf(text: &str) -> Result<ReadOut, String> {
    let head = text.trim_start_matches('\u{feff}');
    if head.starts_with("AutoCAD Binary DXF") { return Err("This is a binary DXF file. Save it as an ASCII (text) DXF and open that".into()); }
    // A DWG file starts with its version name (AC1015, AC1027...); an ASCII DXF starts with a group code.
    if head.starts_with("AC10") {
        return Err("This is a DWG file, not a DXF. Save it as an ASCII DXF from the CAD program and open that".into());
    }
    let p = pairs(head)?;
    if !p.iter().any(|x| x.0 == 0 && x.1.trim() == "EOF") && !p.iter().any(|x| x.0 == 0 && x.1.trim() == "SECTION") {
        return Err("No SECTION or EOF found: this does not look like an ASCII DXF file".into());
    }
    let mut out = ReadOut::default();
    let mut skipped: Vec<(String, usize)> = vec![];
    let mut skip = |name: &str| { match skipped.iter_mut().find(|s| s.0 == name) { Some(s) => s.1 += 1, None => skipped.push((name.to_string(), 1)) } };
    let val = |s: &str| s.trim().parse::<f64>().unwrap_or(f64::NAN);
    let mut section = String::new();
    let mut i = 0;
    // A file with no sections at all (entities only) is read as entities.
    let bare = !p.iter().any(|x| x.0 == 0 && x.1.trim() == "SECTION");
    if bare { section = "ENTITIES".into(); }
    let mut measurement: Option<i32> = None;
    // An open POLYLINE collecting its VERTEX records.
    let mut open: Option<(usize, Vec<(f64, f64, f64)>, bool, bool)> = None;
    while i < p.len() {
        let (code, v) = (&p[i].0, p[i].1.trim());
        if *code == 0 && v == "SECTION" { section = p.get(i + 1).filter(|x| x.0 == 2).map(|x| x.1.trim().to_string()).unwrap_or_default(); i += 2; continue; }
        if *code == 0 && v == "ENDSEC" { section.clear(); i += 1; continue; }
        if section == "HEADER" {
            if *code == 9 && (v == "$INSUNITS" || v == "$MEASUREMENT") {
                if let Some(n) = p.get(i + 1).filter(|x| x.0 == 70).and_then(|x| x.1.trim().parse::<i32>().ok()) {
                    if v == "$INSUNITS" {
                        out.units = match n { 1 => Some(Units::Inch), 4 => Some(Units::Mm), _ => None };
                        if n != 0 && n != 1 && n != 4 { out.notes.push(format!("The file states unit code {} ($INSUNITS), which is neither inch (1) nor millimetre (4): the numbers are taken as they are", n)); }
                    } else { measurement = Some(n); }
                }
            }
            i += 1; continue;
        }
        if section == "TABLES" {
            if *code == 0 && v == "LAYER" {
                let mut j = i + 1; let (mut name, mut col) = (String::new(), 7);
                while j < p.len() && p[j].0 != 0 { if p[j].0 == 2 { name = p[j].1.trim().to_string(); } if p[j].0 == 62 { col = p[j].1.trim().parse::<i32>().unwrap_or(7).abs(); } j += 1; }
                if !name.is_empty() { out.doc.layer_index(&name, col); }
                i = j; continue;
            }
            i += 1; continue;
        }
        if section != "ENTITIES" || *code != 0 { i += 1; continue; }
        // One entity: its type, then every pair up to the next code 0.
        let kind = v.to_string();
        let mut j = i + 1;
        while j < p.len() && p[j].0 != 0 { j += 1; }
        let rec = &p[i + 1..j];
        i = j;
        let get = |c: i32| rec.iter().find(|x| x.0 == c).map(|x| val(&x.1));
        let num = |c: i32| get(c).unwrap_or(0.0);
        let lay = rec.iter().find(|x| x.0 == 8).map(|x| x.1.trim().to_string()).unwrap_or_else(|| "0".into());
        if kind == "VERTEX" { if let Some(o) = open.as_mut() { let m = if o.3 { -1.0 } else { 1.0 }; o.1.push((m * num(10), num(20), m * num(42))); } continue; }
        if kind == "SEQEND" {
            if let Some((layer, v, closed, _)) = open.take() { if v.len() >= 2 { out.doc.items.push(Item { layer, geo: Geo::Poly { v, closed } }); } }
            continue;
        }
        if kind == "EOF" { break; }
        if get(67) == Some(1.0) { skip("paper space"); continue; }
        // Extrusion direction: +Z is the world plane, -Z the mirrored one.
        let ez = get(230).unwrap_or(1.0);
        if num(210).abs() > 1e-9 || num(220).abs() > 1e-9 || ez.abs() < 1e-9 { skip(&format!("{} in a tilted plane", kind)); continue; }
        let mir = ez < 0.0;
        let mx = |x: f64| if mir { -x } else { x };
        let geo = match kind.as_str() {
            "LINE" => Some(Geo::Line { a: (num(10), num(20)), b: (num(11), num(21)) }),
            "POINT" => Some(Geo::Point { p: (num(10), num(20)) }),
            "CIRCLE" => Some(Geo::Circle { c: (mx(num(10)), num(20)), r: num(40) }),
            "ARC" => {
                let (s, e) = (num(50), num(51));
                let (s, e) = if mir { (180.0 - e, 180.0 - s) } else { (s, e) };
                Some(Geo::Arc { c: (mx(num(10)), num(20)), r: num(40), start: norm_deg(s), end: norm_deg(e) })
            }
            "TEXT" | "MTEXT" => {
                let raw: String = if kind == "MTEXT" {
                    let mut t: String = rec.iter().filter(|x| x.0 == 3).map(|x| x.1.as_str()).collect();
                    t.push_str(rec.iter().find(|x| x.0 == 1).map(|x| x.1.as_str()).unwrap_or(""));
                    mtext_plain(&t)
                } else { rec.iter().find(|x| x.0 == 1).map(|x| x.1.clone()).unwrap_or_default() };
                let rot = if kind == "MTEXT" && get(50).is_none() && (get(11).is_some() || get(21).is_some()) { num(21).atan2(num(11)).to_degrees() } else { num(50) };
                if mir { skip(&format!("{} in a mirrored plane", kind)); None }
                else { Some(Geo::Text { p: (num(10), num(20)), h: num(40), rot, text: dxf_untext(raw.trim_end_matches('\r')) }) }
            }
            "LWPOLYLINE" => {
                let mut v: Vec<(f64, f64, f64)> = vec![];
                for x in rec {
                    match x.0 {
                        10 => v.push((mx(val(&x.1)), 0.0, 0.0)),
                        20 => if let Some(l) = v.last_mut() { l.1 = val(&x.1); },
                        42 => if let Some(l) = v.last_mut() { l.2 = if mir { -val(&x.1) } else { val(&x.1) }; },
                        _ => {}
                    }
                }
                if v.len() >= 2 { Some(Geo::Poly { v, closed: (num(70) as i64) & 1 == 1 }) } else { None }
            }
            "POLYLINE" => {
                let flags = num(70) as i64;
                if flags & (8 | 16 | 64) != 0 { skip("3D POLYLINE or mesh"); open = None; }
                else { let li = out.doc.layer_index(&lay, 7); open = Some((li, vec![], flags & 1 == 1, mir)); }
                None
            }
            other => { skip(other); None }
        };
        if let Some(g) = geo {
            let ok = match &g {
                Geo::Line { a, b } => a.0.is_finite() && a.1.is_finite() && b.0.is_finite() && b.1.is_finite(),
                Geo::Circle { c, r } | Geo::Arc { c, r, .. } => c.0.is_finite() && c.1.is_finite() && *r > 0.0,
                Geo::Poly { v, .. } => v.iter().all(|p| p.0.is_finite() && p.1.is_finite() && p.2.is_finite()),
                Geo::Point { p } => p.0.is_finite() && p.1.is_finite(),
                Geo::Text { p, h, text, .. } => p.0.is_finite() && p.1.is_finite() && *h > 0.0 && !text.trim().is_empty(),
            };
            if ok { let li = out.doc.layer_index(&lay, 7); out.doc.items.push(Item { layer: li, geo: g }); } else { skip(&format!("{} with bad values", kind)); }
        }
    }
    if out.units.is_none() {
        if let Some(m) = measurement { out.notes.push(format!("The file gives no drawing unit ($INSUNITS); its measurement flag says {}", if m == 1 { "metric" } else { "inch" })); }
        else { out.notes.push("The file does not say whether it is in inches or millimetres: the numbers are taken as they are".into()); }
    }
    out.skipped = skipped;
    Ok(out)
}

/// Area of a circle, for checks: pi r^2.
pub fn circle_area(r: f64) -> f64 { PI * r * r }

#[cfg(test)]
mod tests {
    use super::*;

    fn file(body: &str) -> String { body.split('|').map(|l| l.trim()).collect::<Vec<_>>().join("\n") }

    #[test]
    fn text_escapes_round_trip() {
        let s = "\u{00D8}10 \u{00B1}0.1 at 45\u{00B0} ^ caret";
        let w = dxf_text(s);
        assert!(w.is_ascii());
        assert_eq!(w, "%%c10 %%p0.1 at 45%%d ^  caret");
        assert_eq!(dxf_text("M8 \u{00D7} 1.25"), "M8 \\U+00D7 1.25");
        assert_eq!(dxf_untext("M8 \\U+00D7 1.25"), "M8 \u{00D7} 1.25");
        assert_eq!(dxf_untext(&w), s);
        // The older percent codes are read too.
        assert_eq!(dxf_untext("%%c10 %%p0.1 45%%D"), "\u{00D8}10 \u{00B1}0.1 45\u{00B0}");
        // A short or broken escape is left as it is.
        assert_eq!(dxf_untext("\\U+00"), "\\U+00");
        assert_eq!(dxf_untext("\\U+ZZZZ"), "\\U+ZZZZ");
        assert_eq!(layer_name(" a/b:c "), "a_b_c");
        assert_eq!(layer_name("  "), "0");
    }

    #[test]
    fn reads_the_plain_entities_with_layers_and_units() {
        let f = file("0|SECTION|2|HEADER|9|$INSUNITS|70|1|0|ENDSEC|0|SECTION|2|TABLES|0|TABLE|2|LAYER|0|LAYER|2|CUT|62|3|0|ENDTAB|0|ENDSEC|\
            0|SECTION|2|ENTITIES|\
            0|LINE|8|CUT|10|1|20|2|11|3|21|4|\
            0|CIRCLE|8|cut|10|5|20|6|40|1.5|\
            0|ARC|8|0|10|0|20|0|40|2|50|350|51|10|\
            0|POINT|8|0|10|7|20|8|\
            0|TEXT|8|NOTES|10|1|20|1|40|0.2|1|%%c0.5 THRU|50|90|\
            0|MTEXT|8|NOTES|10|2|20|2|40|0.25|1|{\\H1.5x;Two\\Plines}|\
            0|LWPOLYLINE|8|CUT|90|3|70|1|10|0|20|0|42|1|10|4|20|0|10|4|20|3|\
            0|SPLINE|8|CUT|0|INSERT|8|CUT|2|BLK|0|SPLINE|8|CUT|\
            0|ENDSEC|0|EOF|");
        let r = read_dxf(&f).unwrap();
        assert_eq!(r.units, Some(Units::Inch));
        assert_eq!(r.doc.layers, vec![("CUT".to_string(), 3), ("0".to_string(), 7), ("NOTES".to_string(), 7)]);
        let g: Vec<&Geo> = r.doc.items.iter().map(|i| &i.geo).collect();
        assert_eq!(g.len(), 7);
        assert_eq!(*g[0], Geo::Line { a: (1.0, 2.0), b: (3.0, 4.0) });
        assert_eq!(*g[1], Geo::Circle { c: (5.0, 6.0), r: 1.5 });
        // Layer names are compared without case.
        assert_eq!(r.doc.items[1].layer, 0);
        assert_eq!(*g[2], Geo::Arc { c: (0.0, 0.0), r: 2.0, start: 350.0, end: 10.0 });
        assert_eq!(*g[3], Geo::Point { p: (7.0, 8.0) });
        assert_eq!(*g[4], Geo::Text { p: (1.0, 1.0), h: 0.2, rot: 90.0, text: "\u{00D8}0.5 THRU".into() });
        assert_eq!(*g[5], Geo::Text { p: (2.0, 2.0), h: 0.25, rot: 0.0, text: "Two lines".into() });
        assert_eq!(*g[6], Geo::Poly { v: vec![(0.0, 0.0, 1.0), (4.0, 0.0, 0.0), (4.0, 3.0, 0.0)], closed: true });
        assert_eq!(r.skipped, vec![("SPLINE".to_string(), 2), ("INSERT".to_string(), 1)]);
        assert!(r.notes.is_empty());
    }

    #[test]
    fn reads_old_polylines_and_bare_files() {
        // R12 style POLYLINE with VERTEX records, no sections at all, no units.
        let f = file("0|POLYLINE|8|A|66|1|70|0|0|VERTEX|8|A|10|0|20|0|42|-0.5|0|VERTEX|8|A|10|2|20|0|0|VERTEX|8|A|10|2|20|2|0|SEQEND|\
            0|POLYLINE|8|A|66|1|70|8|0|VERTEX|8|A|10|0|20|0|30|5|0|VERTEX|8|A|10|1|20|1|30|6|0|SEQEND|0|EOF|");
        let r = read_dxf(&f).unwrap();
        assert_eq!(r.units, None);
        assert_eq!(r.doc.items.len(), 1);
        assert_eq!(r.doc.items[0].geo, Geo::Poly { v: vec![(0.0, 0.0, -0.5), (2.0, 0.0, 0.0), (2.0, 2.0, 0.0)], closed: false });
        assert_eq!(r.skipped, vec![("3D POLYLINE or mesh".to_string(), 1)]);
        assert!(r.notes[0].contains("does not say"));
        assert!(read_dxf("not a dxf\nfile\n").is_err());
        assert!(read_dxf("AutoCAD Binary DXF\r\n\u{1a}\0").unwrap_err().contains("binary DXF"));
        assert!(read_dxf("AC1027\0\0\0\0\0").unwrap_err().contains("DWG"));
        // A byte order mark in front of the first group code is not a problem.
        assert!(read_dxf("\u{feff}0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n").is_ok());
        assert!(read_dxf("").is_err());
    }

    #[test]
    fn mirrored_plane_is_turned_back() {
        // Extrusion (0, 0, -1): by the arbitrary axis rule the entity's X axis is the world -X.
        // A circle at OCS (3, 4) is at world (-3, 4). An arc from 0 to 90 in that plane
        // runs, seen from +Z, counter-clockwise from 90 to 180.
        let f = file("0|SECTION|2|ENTITIES|\
            0|CIRCLE|8|0|10|3|20|4|40|1|230|-1|\
            0|ARC|8|0|10|3|20|4|40|1|50|0|51|90|210|0|220|0|230|-1|\
            0|LWPOLYLINE|8|0|90|2|70|0|10|0|20|0|42|1|10|2|20|0|230|-1|\
            0|CIRCLE|8|0|10|0|20|0|40|1|210|0.5|220|0|230|0.866|\
            0|CIRCLE|8|0|67|1|10|0|20|0|40|1|\
            0|ENDSEC|0|EOF|");
        let r = read_dxf(&f).unwrap();
        assert_eq!(r.doc.items.len(), 3);
        assert_eq!(r.doc.items[0].geo, Geo::Circle { c: (-3.0, 4.0), r: 1.0 });
        assert_eq!(r.doc.items[1].geo, Geo::Arc { c: (-3.0, 4.0), r: 1.0, start: 90.0, end: 180.0 });
        assert_eq!(r.doc.items[2].geo, Geo::Poly { v: vec![(0.0, 0.0, -1.0), (-2.0, 0.0, 0.0)], closed: false });
        assert_eq!(r.skipped, vec![("CIRCLE in a tilted plane".to_string(), 1), ("paper space".to_string(), 1)]);
    }

    #[test]
    fn exploded_polylines_keep_their_shape() {
        // A slot 40 between centres, 12 wide: two straight sides and two half-circle ends.
        let d = Doc { layers: vec![("OUTLINE".into(), 7)], items: vec![
            Item { layer: 0, geo: Geo::Poly { v: vec![(-20.0, -6.0, 0.0), (20.0, -6.0, 1.0), (20.0, 6.0, 0.0), (-20.0, 6.0, 1.0)], closed: true } },
            Item { layer: 0, geo: Geo::Circle { c: (0.0, 0.0), r: 2.0 } },
        ] };
        let x = d.exploded();
        assert_eq!(x.items.len(), 5);
        assert_eq!(x.items[0].geo, Geo::Line { a: (-20.0, -6.0), b: (20.0, -6.0) });
        assert_eq!(x.items[1].geo, Geo::Arc { c: (20.0, 0.0), r: 6.0, start: 270.0, end: 90.0 });
        assert_eq!(x.items[2].geo, Geo::Line { a: (20.0, 6.0), b: (-20.0, 6.0) });
        assert_eq!(x.items[3].geo, Geo::Arc { c: (-20.0, 0.0), r: 6.0, start: 90.0, end: 270.0 });
        assert_eq!(x.items[4].geo, Geo::Circle { c: (0.0, 0.0), r: 2.0 });
        // The outline is the same size either way.
        assert_eq!(x.extents(), d.extents());
        assert_eq!(x.extents(), Some((-26.0, -6.0, 26.0, 6.0)));
        let f = write_doc(&x, Units::Mm, Version::R12);
        assert!(!f.contains("POLYLINE") && !f.contains("VERTEX"));
        // Read back: the same pieces (the layer table of the file starts with layer 0, so only the geometry is compared).
        let back = read_dxf(&f).unwrap().doc;
        assert_eq!(back.items.iter().map(|i| &i.geo).collect::<Vec<_>>(), x.items.iter().map(|i| &i.geo).collect::<Vec<_>>());
        assert!(back.items.iter().all(|i| back.layers[i.layer].0 == "OUTLINE"));
    }

    #[test]
    fn writes_points_and_text_and_reads_them_back() {
        let mut d = Doc::new();
        let a = d.layer_index("0", 7);
        let b = d.layer_index("Marks", 5);
        d.items.push(Item { layer: a, geo: Geo::Point { p: (1.25, -2.5) } });
        d.items.push(Item { layer: b, geo: Geo::Text { p: (0.0, 3.0), h: 2.0, rot: 45.0, text: "M8 \u{00D7} 1.25".into() } });
        d.items.push(Item { layer: b, geo: Geo::Text { p: (0.0, 0.0), h: 1.0, rot: 0.0, text: "plain".into() } });
        for ver in [Version::R2000, Version::R12] {
            let f = write_doc(&d, Units::Mm, ver);
            assert!(f.is_ascii() && f.ends_with("EOF\r\n"));
            // Layer 0 is written once.
            let lines: Vec<&str> = f.split("\r\n").collect();
            let zero = lines.windows(2).filter(|w| w[0].trim() == "2" && w[1] == "0").count();
            assert_eq!(zero, 1, "{:?}", ver);
            let r = read_dxf(&f).unwrap();
            assert_eq!(r.doc.items, d.items, "{:?}", ver);
            assert_eq!(r.units, if ver == Version::R2000 { Some(Units::Mm) } else { None });
            assert!(r.skipped.is_empty());
        }
        // Text box in the extents: 5 characters x 0.7 x height 1 wide.
        let e = Doc { layers: vec![("0".into(), 7)], items: vec![Item { layer: 0, geo: Geo::Text { p: (0.0, 0.0), h: 1.0, rot: 0.0, text: "plain".into() } }] }.extents().unwrap();
        assert!((e.2 - 3.5).abs() < 1e-12 && (e.3 - 1.0).abs() < 1e-12);
    }
}
