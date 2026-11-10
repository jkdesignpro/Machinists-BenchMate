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

/// Write the drawing as an ASCII DXF file (CRLF line ends).
pub fn write_dxf(d: &Drawing, units: Units, ver: Version) -> String {
    match ver { Version::R2000 => write_r2000(d, units), Version::R12 => write_r12(d) }
}

fn header(w: &mut W, d: &Drawing, acadver: &str, units: Option<Units>, handseed: Option<&str>) {
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

fn view_centre(d: &Drawing) -> ((f64, f64), f64, f64) {
    let (x0, y0, x1, y1) = d.extents().unwrap_or((0.0, 0.0, 1.0, 1.0));
    let (w, h) = ((x1 - x0).max(1e-6), (y1 - y0).max(1e-6));
    (((x0 + x1) / 2.0, (y0 + y1) / 2.0), h * 1.1, w / h)
}

fn write_r2000(d: &Drawing, units: Units) -> String {
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
    // LAYER: 0 plus ours.
    table(&mut body, "LAYER", &t_layer, 1 + Layer::ALL.len() as i64);
    rec(&mut body, "LAYER", &t_layer, "AcDbLayerTableRecord");
    body.g(2, "0"); body.i(70, 0); body.i(62, 7); body.g(6, "Continuous");
    for l in Layer::ALL {
        rec(&mut body, "LAYER", &t_layer, "AcDbLayerTableRecord");
        body.g(2, l.name()); body.i(70, 0); body.i(62, l.colour() as i64); body.g(6, "Continuous");
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
    for e in &d.entities {
        let start = |b: &mut W, kind: &str, layer: Layer| { b.g(0, kind); let h = b.h(); b.g(5, &h); b.g(330, &br_model); b.g(100, "AcDbEntity"); b.g(8, layer.name()); };
        match e {
            Entity::Line { layer, a, b } => { start(&mut body, "LINE", *layer); body.g(100, "AcDbLine"); body.xyz(10, *a); body.xyz(11, *b); }
            Entity::Circle { layer, c, r } => { start(&mut body, "CIRCLE", *layer); body.g(100, "AcDbCircle"); body.xyz(10, *c); body.f(40, *r); }
            Entity::Arc { layer, c, r, start: s, end: t } => {
                start(&mut body, "ARC", *layer); body.g(100, "AcDbCircle"); body.xyz(10, *c); body.f(40, *r);
                body.g(100, "AcDbArc"); body.f(50, *s); body.f(51, *t);
            }
            Entity::Poly { layer, v, closed } => {
                start(&mut body, "LWPOLYLINE", *layer); body.g(100, "AcDbPolyline");
                body.i(90, v.len() as i64); body.i(70, if *closed { 1 } else { 0 }); body.f(43, 0.0);
                for p in v { body.f(10, p.0); body.f(20, p.1); if p.2 != 0.0 { body.f(42, p.2); } }
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

fn write_r12(d: &Drawing) -> String {
    // R12 has no $INSUNITS; units are agreed with the reader (see docs).
    let mut w = W { out: String::new(), next: 1 };
    header(&mut w, d, "AC1009", None, None);
    w.g(0, "SECTION"); w.g(2, "TABLES");
    w.g(0, "TABLE"); w.g(2, "LTYPE"); w.i(70, 1);
    w.g(0, "LTYPE"); w.g(2, "CONTINUOUS"); w.i(70, 0); w.g(3, "Solid line"); w.i(72, 65); w.i(73, 0); w.f(40, 0.0);
    w.g(0, "ENDTAB");
    w.g(0, "TABLE"); w.g(2, "LAYER"); w.i(70, 1 + Layer::ALL.len() as i64);
    w.g(0, "LAYER"); w.g(2, "0"); w.i(70, 0); w.i(62, 7); w.g(6, "CONTINUOUS");
    for l in Layer::ALL { w.g(0, "LAYER"); w.g(2, l.name()); w.i(70, 0); w.i(62, l.colour() as i64); w.g(6, "CONTINUOUS"); }
    w.g(0, "ENDTAB");
    w.g(0, "ENDSEC");
    w.g(0, "SECTION"); w.g(2, "BLOCKS"); w.g(0, "ENDSEC");
    w.g(0, "SECTION"); w.g(2, "ENTITIES");
    for e in &d.entities {
        match e {
            Entity::Line { layer, a, b } => { w.g(0, "LINE"); w.g(8, layer.name()); w.xyz(10, *a); w.xyz(11, *b); }
            Entity::Circle { layer, c, r } => { w.g(0, "CIRCLE"); w.g(8, layer.name()); w.xyz(10, *c); w.f(40, *r); }
            Entity::Arc { layer, c, r, start, end } => { w.g(0, "ARC"); w.g(8, layer.name()); w.xyz(10, *c); w.f(40, *r); w.f(50, *start); w.f(51, *end); }
            Entity::Poly { layer, v, closed } => {
                w.g(0, "POLYLINE"); w.g(8, layer.name()); w.i(66, 1); w.xyz(10, (0.0, 0.0)); w.i(70, if *closed { 1 } else { 0 });
                for p in v { w.g(0, "VERTEX"); w.g(8, layer.name()); w.xyz(10, (p.0, p.1)); if p.2 != 0.0 { w.f(42, p.2); } }
                w.g(0, "SEQEND"); w.g(8, layer.name());
            }
        }
    }
    w.g(0, "ENDSEC");
    w.g(0, "EOF");
    w.out
}

/// Area of a circle, for checks: pi r^2.
pub fn circle_area(r: f64) -> f64 { PI * r * r }
