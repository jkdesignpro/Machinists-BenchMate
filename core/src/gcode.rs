//! G-code program generators for drilling, tapping, thread milling, lathe
//! threading, tapers, grooving and cut-off, keyway broaching and G71/G70
//! profile roughing. Every program comes from a per-control dialect table;
//! a cycle is only generated for a control whose syntax was confirmed from
//! the maker's public manual or two independent public sources (see
//! docs/cycles.md). Output is deterministic and covered by golden tests.
//!
//! Besides the text, each generator returns a list of moves (for the 2D
//! backplot and the cycle-time estimate). Mill moves are X, Y, Z; lathe
//! moves use x = radius, z, with y = 0. Feed moves carry their own time
//! (lathe feeds per revolution are converted with the spindle speed at
//! each point, CSS included); rapids are timed later from the rapid rate.

use crate::cycles::*;
use std::f64::consts::PI;

/// Controls. Only `Generic` and `Haas` have generators; the others are
/// listed so the UI can show them as not yet supported.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Ctrl { Generic = 0, Haas = 1, Mitsubishi = 2, Siemens = 3, Heidenhain = 4, Okuma = 5 }

impl Ctrl {
    pub fn from_f(v: f64) -> Ctrl {
        match v as i32 { 1 => Ctrl::Haas, 2 => Ctrl::Mitsubishi, 3 => Ctrl::Siemens, 4 => Ctrl::Heidenhain, 5 => Ctrl::Okuma, _ => Ctrl::Generic }
    }
    pub fn label(self) -> &'static str {
        match self {
            Ctrl::Generic => "GENERIC ISO 6983 / FANUC-STYLE",
            Ctrl::Haas => "HAAS",
            Ctrl::Mitsubishi => "MITSUBISHI M70/M80",
            Ctrl::Siemens => "SIEMENS 840D ISO MODE",
            Ctrl::Heidenhain => "HEIDENHAIN ISO",
            Ctrl::Okuma => "OKUMA OSP",
        }
    }
}

/// Cycle ids shared with the UI.
pub mod cyc {
    pub const DRILL: u32 = 1;
    pub const THREAD_MILL: u32 = 2;
    pub const G76: u32 = 3;
    pub const G92: u32 = 4;
    pub const TAPER: u32 = 5;
    pub const GROOVE: u32 = 6;
    pub const BROACH: u32 = 7;
    pub const G71: u32 = 8;
}

/// Whether a control has a confirmed generator for a cycle. Generic
/// (Fanuc-style, G-code system A on lathes) and Haas only; everything else
/// is "not yet supported" until its syntax is confirmed and recorded.
pub fn supported(ctrl: Ctrl, cycle: u32) -> bool {
    matches!(ctrl, Ctrl::Generic | Ctrl::Haas) && (1..=8).contains(&cycle)
}

// ---------------------------------------------------------------------------
// Program builder

/// One move: kind 0 rapid, 1 feed, 2 clockwise arc, 3 counter-clockwise arc,
/// 4 dwell. End point x, y, z; arc centre cx, cy (absolute, XY plane);
/// f = feed per minute (feed moves); t = seconds (feed moves and dwells).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Move { pub kind: u8, pub x: f64, pub y: f64, pub z: f64, pub cx: f64, pub cy: f64, pub f: f64, pub t: f64 }

#[derive(Clone, Debug, Default)]
pub struct Program {
    pub text: String,
    pub moves: Vec<Move>,
    /// Start point of the moves (x, y, z).
    pub start: [f64; 3],
    /// Extra table for the screen (infeed table rows etc.), flat.
    pub table: Vec<f64>,
    pub warnings: Vec<String>,
    /// Highest spindle speed and feed per minute the program commands.
    pub max_rpm: f64,
    pub max_feed: f64,
    pub error: Option<String>,
}

impl Program {
    fn err(msg: &str) -> Program { Program { error: Some(msg.to_string()), ..Default::default() } }
    /// (feed seconds, rapid seconds, dwell seconds) with rapids at `rapid`
    /// length units per minute.
    pub fn time(&self, rapid: f64) -> (f64, f64, f64) {
        let (mut tf, mut tr, mut td) = (0.0, 0.0, 0.0);
        let mut p = self.start;
        for m in &self.moves {
            match m.kind {
                0 => { let d = ((m.x - p[0]).powi(2) + (m.y - p[1]).powi(2) + (m.z - p[2]).powi(2)).sqrt(); if rapid > 0.0 { tr += d / rapid * 60.0; } }
                4 => td += m.t,
                _ => tf += m.t,
            }
            if m.kind != 4 { p = [m.x, m.y, m.z]; }
        }
        (tf, tr, td)
    }
}

/// Format a coordinate or feed with a decimal point always present:
/// rounded to `dp` places, trailing zeros trimmed, at least one digit after
/// the point ("10.0", "-3.175"); never "-0.0".
pub fn fnum(v: f64, dp: usize) -> String {
    let mut s = format!("{:.*}", dp, v);
    if s.contains('.') { while s.ends_with('0') { s.pop(); } if s.ends_with('.') { s.push('0'); } }
    if s.starts_with('-') && s[1..].chars().all(|c| c == '0' || c == '.') { s.remove(0); }
    s
}

struct B {
    metric: bool, ctrl: Ctrl, lines: Vec<String>, moves: Vec<Move>, pos: [f64; 3], start: [f64; 3],
    warn: Vec<String>, max_rpm: f64, max_feed: f64,
}

impl B {
    fn new(metric: bool, ctrl: Ctrl, _lathe: bool, start: [f64; 3]) -> B {
        B { metric, ctrl, lines: vec![], moves: vec![], pos: start, start, warn: vec![], max_rpm: 0.0, max_feed: 0.0 }
    }
    fn dp(&self) -> usize { if self.metric { 3 } else { 4 } }
    fn n(&self, v: f64) -> String { fnum(v, self.dp()) }
    /// Lathe X word (diameter) from a radius.
    fn xd(&self, r: f64) -> String { fnum(2.0 * r, self.dp()) }
    fn feed(&self, f: f64) -> String { fnum(f, if self.metric { 3 } else { 4 }) }
    fn l(&mut self, s: impl Into<String>) { self.lines.push(s.into()); }
    fn header(&mut self, prog: u32, title: &str, notes: &[String]) {
        self.l("%");
        let o = if self.ctrl == Ctrl::Haas { format!("O{:05}", prog) } else { format!("O{:04}", prog) };
        self.l(format!("{} (BENCHMATE {})", o, title));
        self.l("(GENERATED BY MACHINISTS BENCHMATE)");
        self.l("(CHECK EVERY LINE AGAINST YOUR CONTROL MANUAL)");
        self.l("(PROVE OUT IN SINGLE BLOCK WITH LOW RAPID AND FEED OVERRIDE)");
        self.l(format!("(CONTROL: {})", self.ctrl.label()));
        self.l(format!("(UNITS: {})", if self.metric { "MM" } else { "INCH" }));
        for n in notes { self.l(format!("({})", n)); }
    }
    fn footer(&mut self) { self.l("M30"); self.l("%"); }
    fn rpm(&mut self, n: f64) { if n > self.max_rpm { self.max_rpm = n; } }
    fn fmin(&mut self, f: f64) { if f > self.max_feed { self.max_feed = f; } }
    fn mv(&mut self, kind: u8, x: f64, y: f64, z: f64, cx: f64, cy: f64, f: f64, t: f64) {
        self.moves.push(Move { kind, x, y, z, cx, cy, f, t });
        if kind != 4 { self.pos = [x, y, z]; }
        if kind >= 1 && kind <= 3 { self.fmin(f); }
    }
    fn rapid_to(&mut self, x: f64, y: f64, z: f64) { self.mv(0, x, y, z, 0.0, 0.0, 0.0, 0.0); }
    /// Straight feed move at `f` per minute.
    fn feed_to(&mut self, x: f64, y: f64, z: f64, f: f64) {
        let p = self.pos;
        let d = ((x - p[0]).powi(2) + (y - p[1]).powi(2) + (z - p[2]).powi(2)).sqrt();
        let t = if f > 0.0 { d / f * 60.0 } else { 0.0 };
        self.mv(1, x, y, z, 0.0, 0.0, f, t);
    }
    /// Lathe feed move (x = radius) at `f_rev` per revolution with the spindle
    /// speed at each point from `sp`; time integrated along the segment.
    fn lfeed_to(&mut self, r: f64, z: f64, f_rev: f64, sp: &Spindle) {
        let p = self.pos;
        let len = ((r - p[0]).powi(2) + (z - p[2]).powi(2)).sqrt();
        let steps = 64;
        let mut t = 0.0; let mut fmax: f64 = 0.0;
        for i in 0..steps {
            let rr = p[0] + (r - p[0]) * (i as f64 + 0.5) / steps as f64;
            let n = sp.rpm_at(2.0 * rr, self.metric);
            fmax = fmax.max(f_rev * n);
            if n > 0.0 { t += (len / steps as f64) / (f_rev * n) * 60.0; }
        }
        let n0 = sp.rpm_at(2.0 * p[0], self.metric).max(sp.rpm_at(2.0 * r, self.metric));
        self.rpm(n0);
        self.mv(1, r, 0.0, z, 0.0, 0.0, fmax, t);
    }
    /// Arc in the XY plane about (cx, cy) to (x, y, z), clockwise or not,
    /// sweeping `sweep` radians (positive); time from the arc length in the
    /// plane at feed `f`.
    fn arc_to(&mut self, cw: bool, x: f64, y: f64, z: f64, cx: f64, cy: f64, sweep: f64, f: f64) {
        let r = ((x - cx).powi(2) + (y - cy).powi(2)).sqrt();
        let t = if f > 0.0 { r * sweep / f * 60.0 } else { 0.0 };
        self.mv(if cw { 2 } else { 3 }, x, y, z, cx, cy, f, t);
    }
    fn dwell(&mut self, s: f64) { let p = self.pos; self.mv(4, p[0], p[1], p[2], 0.0, 0.0, 0.0, s); }
    fn done(self, table: Vec<f64>) -> Program {
        let mut text = self.lines.join("\n"); text.push('\n');
        Program { text, moves: self.moves, start: self.start, table, warnings: self.warn, max_rpm: self.max_rpm, max_feed: self.max_feed, error: None }
    }
    fn units_line(&self) -> &'static str { if self.metric { "G21" } else { "G20" } }
}

/// Lathe spindle: fixed rpm or CSS with a clamp.
#[derive(Clone, Copy, Debug)]
pub struct Spindle { pub css: bool, pub v: f64, pub max_rpm: f64, pub rpm: f64 }
impl Spindle {
    fn rpm_at(&self, dia: f64, metric: bool) -> f64 { if self.css { css_rpm(self.v, dia, self.max_rpm, metric) } else { self.rpm } }
}

fn lathe_spindle_on(b: &mut B, sp: &Spindle, start_dia: f64) {
    if sp.css {
        b.l(format!("G50 S{}", sp.max_rpm.round() as i64));
        b.l(format!("G96 S{} M03", sp.v.round() as i64));
        let n = sp.rpm_at(start_dia, b.metric); b.rpm(n);
    } else {
        b.l(format!("G97 S{} M03", sp.rpm.round() as i64));
        b.rpm(sp.rpm);
    }
}
fn lathe_spindle_off(b: &mut B, sp: &Spindle, end_dia: f64) {
    if sp.css { b.l(format!("G97 S{}", sp.rpm_at(end_dia, b.metric).round() as i64)); }
}

fn check_lathe_spindle(sp: &Spindle) -> Option<&'static str> {
    if sp.css { if !(sp.v > 0.0) { return Some("Enter the surface speed."); } if !(sp.max_rpm > 0.0) { return Some("Enter the maximum spindle speed for CSS (G50 clamp)."); } }
    else if !(sp.rpm > 0.0) { return Some("Enter the spindle speed."); }
    None
}

// ---------------------------------------------------------------------------
// Hole patterns and coordinate export

/// Rectangular grid of `nx` x `ny` holes from (x0, y0) at pitch dx, dy, in
/// zigzag order (each row reverses) to shorten travel.
pub fn pattern_grid(x0: f64, y0: f64, nx: u32, ny: u32, dx: f64, dy: f64) -> Vec<(f64, f64)> {
    let mut v = Vec::new();
    for j in 0..ny {
        for k in 0..nx {
            let i = if j % 2 == 0 { k } else { nx - 1 - k };
            v.push((x0 + i as f64 * dx, y0 + j as f64 * dy));
        }
    }
    v
}

/// Hole list as CSV: "Hole,X,Y" then one row per hole, decimal point always
/// present.
pub fn holes_csv(holes: &[(f64, f64)], metric: bool) -> String {
    let dp = if metric { 3 } else { 4 };
    let mut s = String::from("Hole,X,Y\n");
    for (i, (x, y)) in holes.iter().enumerate() { s += &format!("{},{},{}\n", i + 1, fnum(*x, dp), fnum(*y, dp)); }
    s
}

// ---------------------------------------------------------------------------
// Mill: drilling and tapping canned cycles

#[derive(Clone, Debug)]
pub struct DrillJob {
    pub metric: bool, pub ctrl: Ctrl,
    /// 81, 82, 83, 73 or 84.
    pub cycle: u32,
    /// Tapping: rigid (true) or floating holder.
    pub rigid: bool,
    /// Return to the R plane between holes (G99) or to the initial level (G98).
    pub ret_r: bool,
    pub prog: u32, pub tool: u32, pub wcs: u32,
    pub rpm: f64, pub feed: f64, pub pitch: f64,
    pub z_init: f64, pub r: f64, pub z: f64, pub q: f64, pub dwell: f64,
    pub coolant: bool,
    pub holes: Vec<(f64, f64)>,
}

/// Peck clearance and G73 back-off assumed for the time estimate only (the
/// real values are control parameters).
fn peck_clear(metric: bool) -> f64 { if metric { 0.5 } else { 0.02 } }

pub fn gen_drill(j: &DrillJob) -> Program {
    if !supported(j.ctrl, cyc::DRILL) { return Program::err("This control is not yet supported for this cycle."); }
    if j.holes.is_empty() { return Program::err("No holes: enter a pattern or coordinates."); }
    if j.holes.len() > 2000 { return Program::err("Too many holes (2000 at most)."); }
    if ![81, 82, 83, 73, 84].contains(&j.cycle) { return Program::err("Unknown cycle."); }
    if !(j.rpm > 0.0) { return Program::err("Enter the spindle speed."); }
    if !(j.z < j.r && j.r <= j.z_init) { return Program::err("Need Z depth below the R plane, and the R plane at or below the initial Z."); }
    let tap = j.cycle == 84;
    let feed = if tap { tap_feed(j.pitch, j.rpm) } else { j.feed };
    if tap && !(j.pitch > 0.0) { return Program::err("Enter the tap pitch."); }
    if !(feed > 0.0) { return Program::err("Enter the feed."); }
    if (j.cycle == 83 || j.cycle == 73) && !(j.q > 0.0) { return Program::err("Enter the peck depth Q."); }
    if j.cycle == 82 && !(j.dwell > 0.0) { return Program::err("Enter the dwell time."); }
    let (x0, y0) = j.holes[0];
    let mut b = B::new(j.metric, j.ctrl, false, [x0, y0, j.z_init]);
    let name = match j.cycle { 81 => "DRILL G81", 82 => "SPOT/COUNTERBORE G82", 83 => "PECK DRILL G83", 73 => "CHIP BREAK G73", _ => if j.rigid { "RIGID TAP G84" } else { "FLOATING TAP G84" } };
    let mut notes = vec![format!("T{} - {} HOLE(S) - Z{} R{}", j.tool, j.holes.len(), b.n(j.z), b.n(j.r))];
    if tap {
        notes.push(format!("TAP FEED F = PITCH X RPM = {} X {}", fnum(j.pitch, if j.metric { 4 } else { 6 }), j.rpm.round() as i64));
        if !j.rigid { notes.push("FLOATING HOLDER: CHECK THE HOLDER MAKER'S FEED ADVICE".into()); }
        if j.rigid && j.ctrl == Ctrl::Haas { notes.push("HAAS: NEEDS THE RIGID TAPPING OPTION".into()); }
    }
    b.header(j.prog, name, &notes);
    b.l(format!("{} G17 G40 G49 G80 G90", b.units_line()));
    b.l(format!("T{} M06", j.tool));
    b.l(format!("G00 G{} X{} Y{}", j.wcs, b.n(x0), b.n(y0)));
    let generic_rigid = tap && j.rigid && j.ctrl == Ctrl::Generic;
    if !generic_rigid { b.l(format!("S{} M03", j.rpm.round() as i64)); }
    b.rpm(j.rpm);
    b.l(format!("G43 H{} Z{}{}", j.tool, b.n(j.z_init), if j.coolant { " M08" } else { "" }));
    if generic_rigid { b.l(format!("M29 S{}", j.rpm.round() as i64)); }
    let ret = if j.ret_r { "G99" } else { "G98" };
    let mut words = format!("{} G{} X{} Y{} Z{} R{}", ret, j.cycle, b.n(x0), b.n(y0), b.n(j.z), b.n(j.r));
    match j.cycle {
        83 | 73 => words += &format!(" Q{}", b.n(j.q)),
        82 => words += &if j.ctrl == Ctrl::Haas { format!(" P{}", fnum(j.dwell, 3)) } else { format!(" P{}", (j.dwell * 1000.0).round() as i64) },
        84 if j.dwell > 0.0 => words += &if j.ctrl == Ctrl::Haas { format!(" P{}", fnum(j.dwell, 3)) } else { format!(" P{}", (j.dwell * 1000.0).round() as i64) },
        _ => {}
    }
    words += &format!(" F{}", b.feed(feed));
    b.l(words);
    for (x, y) in j.holes.iter().skip(1) { b.l(format!("X{} Y{}", b.n(*x), b.n(*y))); }
    b.l("G80");
    b.l(format!("G00 Z{}", b.n(j.z_init)));
    if j.coolant { b.l("M09"); }
    b.l("M05");
    b.l("G91 G28 Z0.");
    b.l("G90");
    b.footer();
    // Moves.
    let c = peck_clear(j.metric);
    let retz = if j.ret_r { j.r } else { j.z_init };
    for (i, (x, y)) in j.holes.iter().enumerate() {
        let zc = if i == 0 { j.z_init } else { retz };
        b.rapid_to(*x, *y, zc);
        b.rapid_to(*x, *y, j.r);
        match j.cycle {
            83 | 73 => {
                let mut d = j.r;
                while d > j.z + 1e-9 {
                    let nd = (d - j.q).max(j.z);
                    b.feed_to(*x, *y, nd, feed);
                    if nd > j.z + 1e-9 {
                        if j.cycle == 83 { b.rapid_to(*x, *y, j.r); b.rapid_to(*x, *y, (nd + c).min(j.r)); }
                        else { b.rapid_to(*x, *y, (nd + c).min(j.r)); }
                    }
                    d = nd;
                }
            }
            84 => { b.feed_to(*x, *y, j.z, feed); if j.dwell > 0.0 { b.dwell(j.dwell); } b.feed_to(*x, *y, j.r, feed); }
            _ => { b.feed_to(*x, *y, j.z, feed); if j.cycle == 82 { b.dwell(j.dwell); } }
        }
        b.rapid_to(*x, *y, retz);
    }
    b.rapid_to(b.pos[0], b.pos[1], j.z_init);
    b.done(vec![])
}

// ---------------------------------------------------------------------------
// Mill: thread milling

#[derive(Clone, Debug)]
pub struct ThreadMillJob {
    pub metric: bool, pub ctrl: Ctrl, pub prog: u32, pub tool: u32, pub wcs: u32,
    pub internal: bool, pub left_hand: bool, pub climb: bool, pub comp: bool,
    pub major: f64, pub pitch: f64, pub depth: f64, pub tool_dia: f64,
    pub length: f64, pub z_top: f64, pub z_clear: f64,
    pub rpm: f64, pub edge_feed: f64, pub passes: u32, pub spring: u32,
    /// Multi-form tool (one turn covers the length) instead of single-form.
    pub multi_form: bool,
    pub cx: f64, pub cy: f64, pub d_reg: u32,
}

pub fn gen_thread_mill(j: &ThreadMillJob) -> Program {
    if !supported(j.ctrl, cyc::THREAD_MILL) { return Program::err("This control is not yet supported for this cycle."); }
    if !(j.major > 0.0 && j.pitch > 0.0 && j.depth > 0.0 && j.tool_dia > 0.0 && j.length > 0.0) { return Program::err("Enter diameter, pitch, thread depth, tool diameter and length."); }
    if !(j.rpm > 0.0 && j.edge_feed > 0.0) { return Program::err("Enter spindle speed and feed."); }
    if j.passes == 0 || j.passes > 20 { return Program::err("Radial passes: 1 to 20."); }
    if !(j.z_clear > j.z_top) { return Program::err("Clearance Z must be above the top of the thread."); }
    let rt = j.tool_dia / 2.0;
    let cut_dia = if j.internal { j.major } else { j.major - 2.0 * j.depth };
    let rc_final = thread_mill_path_radius(cut_dia, j.tool_dia, j.internal);
    if j.internal && !(rc_final > 0.0) { return Program::err("Tool too big for the thread: the tool must be smaller than the major diameter."); }
    if !j.internal && !(cut_dia > 0.0) { return Program::err("Thread depth too large for the diameter."); }
    if j.internal && j.tool_dia > j.major - 2.0 * j.depth { return Program::err("Tool does not fit the minor diameter (start bore)."); }
    let f = thread_mill_centre_feed(j.edge_feed, cut_dia, j.tool_dia, j.internal);
    // Arc direction of the helix: internal climb = CCW (G03), external climb = CW (G02) with M03.
    let ccw = j.internal == j.climb;
    let s = if ccw { 1.0 } else { -1.0 };
    let up = ccw != j.left_hand; // right-hand: CCW rises
    let dz = if up { j.pitch } else { -j.pitch };
    let z_bot = j.z_top - j.length;
    let revs = if j.multi_form { 1u32 } else { ((j.length / j.pitch) - 1e-9).ceil().max(1.0) as u32 };
    let lead_z = j.pitch / 4.0;
    // Z where the helix proper starts (after the lead-in arc).
    let (z_helix0, z_start) = if up { (z_bot, z_bot - lead_z) } else { let zt = z_bot + revs as f64 * j.pitch; (zt, zt + lead_z) };
    if !up && z_start > j.z_clear { return Program::err("Clearance Z too low for the lead-in above the thread."); }
    let mut b = B::new(j.metric, j.ctrl, false, [j.cx, j.cy, j.z_clear]);
    let gc = |c: bool| if c { "G03" } else { "G02" };
    let notes = vec![
        format!("T{} - {} {} THREAD D{} P{}", j.tool, if j.left_hand { "LH" } else { "RH" }, if j.internal { "INTERNAL" } else { "EXTERNAL" }, b.n(j.major), fnum(j.pitch, if j.metric { 4 } else { 6 })),
        format!("{} MILLING, {} RADIAL PASS(ES), {} SPRING PASS(ES)", if j.climb { "CLIMB" } else { "CONVENTIONAL" }, j.passes, j.spring),
        format!("TOOL DIA {} - {}", b.n(j.tool_dia), if j.comp { format!("G41/G42 WITH D{}: SET D TO THE TOOL RADIUS {}", j.d_reg, b.n(rt)) } else { "TOOL CENTRE PATH, NO COMPENSATION".to_string() }),
        format!("F IS THE TOOL CENTRE FEED FOR {} AT THE CUTTING EDGE", b.feed(j.edge_feed)),
        "Z REFERENCE: THE TOOL'S THREAD-FORM TOOTH".into(),
    ];
    b.header(j.prog, "THREAD MILL", &notes);
    b.l(format!("{} G17 G40 G49 G80 G90", b.units_line()));
    b.l(format!("T{} M06", j.tool));
    b.l(format!("G00 G{} X{} Y{}", j.wcs, b.n(j.cx), b.n(j.cy)));
    b.l(format!("S{} M03", j.rpm.round() as i64)); b.rpm(j.rpm);
    b.l(format!("G43 H{} Z{} M08", j.tool, b.n(j.z_clear)));
    let comp_word = if j.climb { "G41" } else { "G42" };
    let mut table = vec![];
    let total = j.passes + j.spring;
    for k in 1..=total {
        let kk = k.min(j.passes);
        let rem = j.depth * (1.0 - kk as f64 / j.passes as f64); // material left after this pass (radial)
        let rc = if j.internal { rc_final - rem } else { rc_final + rem };
        if !(rc > 0.0) { return Program::err("Tool path radius not positive on the first pass: use a smaller tool or more passes."); }
        table.extend_from_slice(&[k as f64, 2.0 * (if j.internal { rc + rt } else { rc - rt }), 2.0 * rc]);
        // Lead arc radius (tool centre path) and centre.
        let (ra, lc, lead_ccw, a_in, a_out) = if j.internal {
            let ra = rc / 2.0; (ra, (j.cx + rc - ra, j.cy), ccw, -s * 90.0, s * 90.0)
        } else {
            let ra = rt.max(rc * 0.1); (ra, (j.cx + rc + ra, j.cy), !ccw, 180.0 + s * 90.0, 180.0 - s * 90.0)
        };
        let off = if j.comp { rt } else { 0.0 };
        let pr = |a: f64, r: f64| (lc.0 + r * (a * PI / 180.0).cos(), lc.1 + r * (a * PI / 180.0).sin());
        let rap = ra + off; // programmed lead radius
        let rp = if j.internal { rc + off } else { rc - off }; // programmed thread radius
        let s_in = pr(a_in, rap);
        let s_out = pr(a_out, rap);
        let (ax, ay, ex, ey) = if j.internal { (j.cx, j.cy, j.cx, j.cy) } else {
            let a = pr(a_in, rap + 2.0 * rt); let e = pr(a_out, rap + 2.0 * rt); (a.0, a.1, e.0, e.1)
        };
        let px = j.cx + rp; let py = j.cy;
        b.l(format!("(PASS {} - {} DIA {})", k, if k > j.passes { "SPRING" } else { "THREAD" }, b.n(2.0 * if j.internal { rc + rt } else { rc - rt })));
        if (ax, ay) != (b.pos[0], b.pos[1]) || k == 1 { b.l(format!("G00 X{} Y{}", b.n(ax), b.n(ay))); }
        b.l(format!("G00 Z{}", b.n(z_start)));
        // Moves for the backplot follow the tool centre.
        let cpt = |a: f64, r: f64| (lc.0 + r * (a * PI / 180.0).cos(), lc.1 + r * (a * PI / 180.0).sin());
        let (tax, tay) = if j.internal { (j.cx, j.cy) } else { cpt(a_in, ra + 2.0 * rt) };
        b.rapid_to(tax, tay, j.z_clear);
        b.rapid_to(tax, tay, z_start);
        let comp = if j.comp { format!("{} D{} ", comp_word, j.d_reg) } else { String::new() };
        b.l(format!("G01 {}X{} Y{} F{}", comp, b.n(s_in.0), b.n(s_in.1), b.feed(f)));
        let c_in = cpt(a_in, ra); b.feed_to(c_in.0, c_in.1, z_start, f);
        // Lead-in arc to the thread circle.
        let (i, jj) = (lc.0 - s_in.0, lc.1 - s_in.1);
        b.l(format!("{} X{} Y{} Z{} I{} J{}", gc(lead_ccw), b.n(px), b.n(py), b.n(z_helix0), b.n(i), b.n(jj)));
        b.arc_to(!lead_ccw, j.cx + rc, j.cy, z_helix0, lc.0, lc.1, PI / 2.0, f);
        let mut z = z_helix0;
        for _ in 0..revs {
            z += dz;
            b.l(format!("{} X{} Y{} Z{} I{} J0.0", gc(ccw), b.n(px), b.n(py), b.n(z), b.n(-rp)));
            b.arc_to(!ccw, j.cx + rc, j.cy, z, j.cx, j.cy, 2.0 * PI, f);
        }
        let z_end = z + dz / 4.0;
        let (i2, j2) = (lc.0 - px, lc.1 - py);
        b.l(format!("{} X{} Y{} Z{} I{} J{}", gc(lead_ccw), b.n(s_out.0), b.n(s_out.1), b.n(z_end), b.n(i2), b.n(j2)));
        let c_out = cpt(a_out, ra); b.arc_to(!lead_ccw, c_out.0, c_out.1, z_end, lc.0, lc.1, PI / 2.0, f);
        b.l(format!("G01 {}X{} Y{}", if j.comp { "G40 " } else { "" }, b.n(ex), b.n(ey)));
        let (tex, tey) = if j.internal { (j.cx, j.cy) } else { cpt(a_out, ra + 2.0 * rt) };
        b.feed_to(tex, tey, z_end, f);
        b.l(format!("G00 Z{}", b.n(j.z_clear)));
        b.rapid_to(tex, tey, j.z_clear);
    }
    b.l("M09"); b.l("M05"); b.l("G91 G28 Z0."); b.l("G90");
    b.footer();
    if !j.internal { b.warn.push("External: the approach and exit points are outside the thread diameter; check they clear clamps and shoulders.".into()); }
    if j.comp { b.warn.push("With G41/G42 some controls apply F to the programmed contour, others to the tool centre; check your control and adjust F.".into()); }
    if j.multi_form { b.warn.push("Multi-form tool: one turn plus lead arcs; the cutting length must exceed the thread length plus one pitch.".into()); }
    b.done(table)
}

// ---------------------------------------------------------------------------
// Lathe: threading (G76 multi-pass cycle or G92 pass by pass)

#[derive(Clone, Debug)]
pub struct LatheThreadJob {
    pub metric: bool, pub ctrl: Ctrl, pub prog: u32, pub tool: u32,
    /// true = G76 cycle; false = G92 one block per pass.
    pub g76: bool,
    pub internal: bool,
    pub major: f64, pub lead: f64, pub depth: f64,
    pub z_start: f64, pub z_end: f64, pub x_clear: f64,
    /// Cumulative radial depths of the passes (last = depth), from the
    /// infeed formulas; the spring passes come on top.
    pub passes: Vec<f64>,
    pub spring: u32,
    /// G76 data: first cut, minimum cut, finish allowance (radial).
    pub first: f64, pub min_cut: f64, pub finish: f64,
    /// Haas G76 P: true = constant depth (P3), false = constant amount (P1).
    pub haas_const_depth: bool,
    pub tool_angle: f64, pub pullout: f64,
    /// Infeed angle for G92 passes (0 = radial), degrees.
    pub infeed_angle: f64,
    pub rpm: f64,
}

pub fn gen_lathe_thread(j: &LatheThreadJob) -> Program {
    let cyc_id = if j.g76 { cyc::G76 } else { cyc::G92 };
    if !supported(j.ctrl, cyc_id) { return Program::err("This control is not yet supported for this cycle."); }
    if !(j.major > 0.0 && j.lead > 0.0 && j.depth > 0.0) { return Program::err("Enter diameter, lead and thread depth."); }
    if !(j.rpm > 0.0) { return Program::err("Enter the spindle speed (threading runs at constant rpm, G97)."); }
    if !(j.z_end < j.z_start) { return Program::err("Thread end Z must be below the start Z (cutting toward the chuck)."); }
    if !(j.x_clear > 0.0) { return Program::err("Enter the X clearance."); }
    if j.passes.is_empty() { return Program::err("No passes: check the infeed values."); }
    if (j.passes.last().unwrap() - j.depth).abs() > 1e-9 { return Program::err("The passes must add up to the thread depth."); }
    let r_major = j.major / 2.0;
    let r_root = if j.internal { r_major } else { r_major - j.depth };
    let r_surf = if j.internal { r_major - j.depth } else { r_major };
    if !(r_root > 0.0) || (j.internal && !(r_surf > 0.0)) { return Program::err("Thread depth too large for the diameter."); }
    let sgn = if j.internal { -1.0 } else { 1.0 };
    let r_start = r_surf + sgn * j.x_clear;
    if j.internal && !(r_start > 0.0) { return Program::err("X clearance too large for the bore."); }
    let mut b = B::new(j.metric, j.ctrl, true, [r_start, 0.0, j.z_start]);
    let ldp = if j.metric { 4 } else { 6 };
    let notes = vec![
        format!("T{:02}{:02} - {} THREAD D{} LEAD {}", j.tool, j.tool, if j.internal { "INTERNAL" } else { "EXTERNAL" }, b.n(j.major), fnum(j.lead, ldp)),
        format!("DEPTH {} RADIAL, ROOT DIA {}", b.n(j.depth), b.xd(r_root)),
        format!("{} PASS(ES) + {} SPRING PASS(ES)", j.passes.len(), j.spring),
    ];
    b.header(j.prog, if j.g76 { "THREAD G76" } else { "THREAD G92" }, &notes);
    b.l(format!("{} G40 G99", b.units_line()));
    b.l(format!("T{:02}{:02}", j.tool, j.tool));
    b.l(format!("G97 S{} M03", j.rpm.round() as i64)); b.rpm(j.rpm);
    b.l(format!("G00 X{} Z{} M08", b.xd(r_start), b.n(j.z_start)));
    let feed_min = j.lead * j.rpm;
    let len = j.z_start - j.z_end;
    let t_pass = len / feed_min * 60.0;
    let half = (j.tool_angle / 2.0).max(0.0);
    let flank = if j.g76 { half } else { j.infeed_angle };
    let tan = (flank * PI / 180.0).tan();
    let mut table = vec![];
    let all: Vec<f64> = j.passes.iter().copied().chain(std::iter::repeat(j.depth).take(j.spring as usize)).collect();
    let mut prev = 0.0;
    for (i, d) in all.iter().enumerate() {
        let r = r_surf - sgn * d;
        table.extend_from_slice(&[(i + 1) as f64, *d, d - prev, 2.0 * r]);
        prev = *d;
    }
    if j.g76 {
        if j.ctrl == Ctrl::Generic {
            let inc = if j.metric { 1000.0 } else { 10000.0 };
            let ang = j.tool_angle.round() as i64;
            if ![80, 60, 55, 30, 29, 0].contains(&ang) { return Program::err("Fanuc-style G76 tool angle must be 80, 60, 55, 30, 29 or 0."); }
            let m = 1 + j.spring;
            if m > 99 { return Program::err("Too many finishing passes (99 at most)."); }
            let rr = (j.pullout * 10.0).round() as i64;
            if !(0..=99).contains(&rr) { return Program::err("Pull-out must be 0 to 9.9 leads."); }
            b.l(format!("G76 P{:02}{:02}{:02} Q{} R{}", m, rr, ang, (j.min_cut * inc).round() as i64, b.n(j.finish)));
            b.l(format!("G76 X{} Z{} P{} Q{} F{}", b.xd(r_root), b.n(j.z_end), (j.depth * inc).round() as i64, (j.first * inc).round() as i64, fnum(j.lead, ldp)));
        } else {
            let a = j.tool_angle.round() as i64;
            if !(0..=120).contains(&a) { return Program::err("Haas G76 tool angle A must be 0 to 120."); }
            b.l(format!("(HAAS: SET THREAD MINIMUM CUT TO {} AND THREAD FINISH ALLOWANCE TO {} IN SETTINGS)", b.n(j.min_cut), b.n(j.finish)));
            b.l(format!("G76 X{} Z{} K{} D{} A{} P{} F{}", b.xd(r_root), b.n(j.z_end), b.n(j.depth), b.n(j.first), a, if j.haas_const_depth { 3 } else { 1 }, fnum(j.lead, ldp)));
            if j.spring > 0 {
                b.l("(SPRING PASSES)");
                for _ in 0..j.spring { b.l(format!("G92 X{} Z{} F{}", b.xd(r_root), b.n(j.z_end), fnum(j.lead, ldp))); }
            }
        }
    } else {
        let mut zprev = f64::NAN;
        for d in all.iter() {
            let zs = j.z_start - (j.depth - d) * tan;
            let r = r_surf - sgn * d;
            if zs != zprev { b.l(format!("G00 Z{}", b.n(zs))); zprev = zs; }
            b.l(format!("G92 X{} Z{} F{}", b.xd(r), b.n(j.z_end), fnum(j.lead, ldp)));
        }
        if j.infeed_angle > 0.0 && j.depth * tan > j.z_start - j.z_end { b.warn.push("Flank infeed shift is longer than the thread: check the start Z.".into()); }
    }
    b.l(format!("G00 X{} Z{}", b.xd(r_start), b.n(j.z_start)));
    b.l("M09"); b.l("M05");
    b.footer();
    // Moves: each pass rapid in, thread (feed), rapid out, rapid back.
    for d in all.iter() {
        let zs = j.z_start - (j.depth - d) * tan;
        let r = r_surf - sgn * d;
        b.rapid_to(r_start, 0.0, zs);
        b.rapid_to(r, 0.0, zs);
        b.mv(1, r, 0.0, j.z_end, 0.0, 0.0, feed_min, t_pass * (zs - j.z_end) / len);
        b.rapid_to(r_start, 0.0, j.z_end);
        b.rapid_to(r_start, 0.0, j.z_start);
    }
    if j.g76 { b.warn.push("The pass table is what BenchMate expects the G76 cycle to cut from its first-cut, minimum-cut and finish values; the control computes the real passes.".into()); }
    b.warn.push("Threading needs constant rpm (G97); run the start Z far enough in front of the part for the axis to reach speed.".into());
    b.done(table)
}

// ---------------------------------------------------------------------------
// Lathe: taper turning or boring

#[derive(Clone, Debug)]
pub struct TaperJob {
    pub metric: bool, pub ctrl: Ctrl, pub prog: u32, pub tool: u32,
    pub internal: bool,
    /// Diameter at the front (z_front) and at the back (z_front - length).
    pub front_dia: f64, pub back_dia: f64, pub length: f64, pub z_front: f64,
    pub doc: f64, pub finish: f64, pub f_rough: f64, pub f_finish: f64,
    pub clear: f64, pub comp: bool, pub sp: Spindle,
}

pub fn gen_taper(j: &TaperJob) -> Program {
    if !supported(j.ctrl, cyc::TAPER) { return Program::err("This control is not yet supported for this cycle."); }
    if !(j.front_dia >= 0.0 && j.back_dia > 0.0 && j.length > 0.0) { return Program::err("Enter both diameters and the length."); }
    if !j.internal && !(j.front_dia < j.back_dia) { return Program::err("External taper: the front diameter must be smaller (stock = back diameter)."); }
    if j.internal && !(j.front_dia > j.back_dia) { return Program::err("Internal taper: the front diameter must be larger (pre-bore = back diameter)."); }
    if !(j.doc > 0.0 && j.f_rough > 0.0 && j.f_finish > 0.0 && j.clear > 0.0) || !(j.finish >= 0.0) { return Program::err("Enter depth of cut, finish allowance, feeds and clearance."); }
    if let Some(e) = check_lathe_spindle(&j.sp) { return Program::err(e); }
    let s = if j.internal { -1.0 } else { 1.0 };
    let (rf, rb, l, zf) = (j.front_dia / 2.0, j.back_dia / 2.0, j.length, j.z_front);
    let a = j.finish;
    if (rb - rf).abs() <= a { return Program::err("Finish allowance larger than the taper."); }
    let zc = zf + j.clear;
    // Offset cone (finish allowance): radius at z.
    let z_at = |r: f64| zf - l * (r - rf - s * a) / (rb - rf);
    let mut b = B::new(j.metric, j.ctrl, true, [rb + s * j.clear, 0.0, zc]);
    let ang = ((rb - rf).abs() / l).atan() * 180.0 / PI;
    let notes = vec![
        format!("T{:02}{:02} - {} TAPER D{} TO D{} OVER {}", j.tool, j.tool, if j.internal { "INTERNAL" } else { "EXTERNAL" }, b.n(j.front_dia), b.n(j.back_dia), b.n(l)),
        format!("HALF ANGLE {} DEG - ROUGH {} PER SIDE, LEAVE {}", fnum(ang, 4), b.n(j.doc), b.n(a)),
        if j.internal { "PRE-BORE TO THE BACK DIAMETER".into() } else { "STOCK = BACK DIAMETER".into() },
    ];
    b.header(j.prog, "TAPER", &notes);
    b.l(format!("{} G40 G99", b.units_line()));
    b.l(format!("T{:02}{:02}", j.tool, j.tool));
    lathe_spindle_on(&mut b, &j.sp, j.back_dia);
    b.l(format!("G00 X{} Z{} M08", b.xd(rb + s * j.clear), b.n(zc)));
    let target = rf + s * a; // last roughing level at the front
    let mut levels = vec![];
    let mut k = 1;
    loop {
        let r = rb - s * j.doc * k as f64;
        if s * (r - target) <= 1e-9 { levels.push(target); break; }
        levels.push(r); k += 1;
        if k > 1000 { return Program::err("Too many passes: increase the depth of cut."); }
    }
    if levels.len() > 1 && (levels[levels.len() - 1] - levels[levels.len() - 2]).abs() < 1e-9 { levels.pop(); }
    b.l("(ROUGHING)");
    let mut rprev = rb;
    for r in levels.iter() {
        let (zk, zp) = (z_at(*r), z_at(rprev).max(zf - l));
        b.l(format!("G00 X{}", b.xd(*r)));
        b.rapid_to(*r, 0.0, zc);
        b.l(format!("G01 Z{} F{}", b.n(zk), b.feed(j.f_rough)));
        b.lfeed_to(*r, zk, j.f_rough, &j.sp);
        b.l(format!("X{} Z{}", b.xd(rprev), b.n(zp)));
        b.lfeed_to(rprev, zp, j.f_rough, &j.sp);
        b.l(format!("G00 X{}", b.xd(rprev + s * j.clear)));
        b.rapid_to(rprev + s * j.clear, 0.0, zp);
        b.l(format!("Z{}", b.n(zc)));
        b.rapid_to(rprev + s * j.clear, 0.0, zc);
        rprev = *r;
    }
    // Finish along the cone, entering on its extension in front of the part.
    let r_ext = rf - (rb - rf) * j.clear / l;
    let r_ext = if j.internal { r_ext } else { r_ext.max(0.0) };
    b.l("(FINISH)");
    let comp = if j.comp { if j.internal { "G41 " } else { "G42 " } } else { "" };
    b.l(format!("G00 {}X{} Z{}", comp, b.xd(r_ext), b.n(zc)));
    b.rapid_to(r_ext, 0.0, zc);
    b.l(format!("G01 X{} Z{} F{}", b.xd(rf), b.n(zf), b.feed(j.f_finish)));
    b.lfeed_to(rf, zf, j.f_finish, &j.sp);
    b.l(format!("X{} Z{}", b.xd(rb), b.n(zf - l)));
    b.lfeed_to(rb, zf - l, j.f_finish, &j.sp);
    b.l(format!("{}X{}", if j.comp { "G40 " } else { "" }, b.xd(rb + s * j.clear)));
    b.lfeed_to(rb + s * j.clear, zf - l, j.f_finish, &j.sp);
    b.l(format!("G00 Z{}", b.n(zc)));
    b.rapid_to(rb + s * j.clear, 0.0, zc);
    b.l("M09");
    lathe_spindle_off(&mut b, &j.sp, j.back_dia + 2.0 * s * j.clear);
    b.l("M05");
    b.footer();
    if j.comp { b.warn.push("Nose radius compensation needs the tool's radius and tip direction in the offset page.".into()); }
    else if a == 0.0 { b.warn.push("Without nose radius compensation a taper is cut slightly off size; leave a finish allowance or use G41/G42.".into()); }
    b.done(levels.iter().map(|r| 2.0 * r).collect())
}

// ---------------------------------------------------------------------------
// Lathe: grooving and cut-off with CSS

#[derive(Clone, Debug)]
pub struct GrooveJob {
    pub metric: bool, pub ctrl: Ctrl, pub prog: u32, pub tool: u32,
    pub cutoff: bool,
    pub stock_dia: f64, pub bottom_dia: f64,
    /// Z of the groove's front wall; the tool's Z reference is its front corner.
    pub z_front: f64, pub width: f64, pub tool_width: f64, pub step: f64,
    pub peck: f64, pub peck_back: f64, pub f_rev: f64, pub clear: f64,
    pub sp: Spindle,
}

pub fn gen_groove(j: &GrooveJob) -> Program {
    if !supported(j.ctrl, cyc::GROOVE) { return Program::err("This control is not yet supported for this cycle."); }
    if !(j.stock_dia > 0.0 && j.bottom_dia >= 0.0 && j.bottom_dia < j.stock_dia) { return Program::err("Bottom diameter must be below the stock diameter."); }
    if !(j.tool_width > 0.0 && j.f_rev > 0.0 && j.clear > 0.0) { return Program::err("Enter tool width, feed and clearance."); }
    if let Some(e) = check_lathe_spindle(&j.sp) { return Program::err(e); }
    let width = if j.cutoff { j.tool_width } else { j.width };
    if !(width >= j.tool_width - 1e-12) { return Program::err("Groove narrower than the tool."); }
    let step = if j.step > 0.0 { j.step.min(j.tool_width) } else { j.tool_width * 0.8 };
    let n = if width - j.tool_width < 1e-9 { 1 } else { ((width - j.tool_width) / step - 1e-9).ceil() as usize + 1 };
    let zs: Vec<f64> = (0..n).map(|i| if i + 1 == n { j.z_front - (width - j.tool_width) } else { j.z_front - i as f64 * step }).collect();
    let (rs, rbot) = (j.stock_dia / 2.0, j.bottom_dia / 2.0);
    let rcl = rs + j.clear;
    let mut b = B::new(j.metric, j.ctrl, true, [rcl, 0.0, zs[0]]);
    let notes = vec![
        format!("T{:02}{:02} - {} D{} TO D{}", j.tool, j.tool, if j.cutoff { "CUT-OFF" } else { "GROOVE" }, b.n(j.stock_dia), b.n(j.bottom_dia)),
        format!("TOOL WIDTH {}{} - Z IS THE TOOL'S FRONT (+Z) CORNER", b.n(j.tool_width), if j.cutoff { String::new() } else { format!(", GROOVE WIDTH {}, {} PLUNGE(S)", b.n(width), n) }),
    ];
    b.header(j.prog, if j.cutoff { "CUT-OFF" } else { "GROOVE" }, &notes);
    b.l(format!("{} G40 G99", b.units_line()));
    b.l(format!("T{:02}{:02}", j.tool, j.tool));
    lathe_spindle_on(&mut b, &j.sp, j.stock_dia);
    b.l(format!("G00 X{} Z{} M08", b.xd(rcl), b.n(zs[0])));
    let mut first = true;
    for z in zs.iter() {
        if !first { b.l(format!("G00 Z{}", b.n(*z))); }
        b.rapid_to(rcl, 0.0, *z);
        first = false;
        if j.peck > 0.0 {
            let mut r = rs;
            let mut fword = true;
            while r > rbot + 1e-9 {
                let nr = (r - j.peck).max(rbot);
                b.l(format!("G01 X{}{}", b.xd(nr), if fword { format!(" F{}", b.feed(j.f_rev)) } else { String::new() }));
                fword = false;
                b.lfeed_to(nr, *z, j.f_rev, &j.sp);
                if nr > rbot + 1e-9 {
                    let back = (nr + j.peck_back).min(rcl);
                    b.l(format!("G00 X{}", b.xd(back)));
                    b.rapid_to(back, 0.0, *z);
                    b.lfeed_to(nr, *z, j.f_rev, &j.sp);
                }
                r = nr;
            }
        } else {
            b.l(format!("G01 X{} F{}", b.xd(rbot), b.feed(j.f_rev)));
            b.lfeed_to(rs, *z, j.f_rev, &j.sp); // approach from clearance to the stock surface
            b.lfeed_to(rbot, *z, j.f_rev, &j.sp);
        }
        b.l(format!("G00 X{}", b.xd(rcl)));
        b.rapid_to(rcl, 0.0, *z);
    }
    b.l("M09");
    lathe_spindle_off(&mut b, &j.sp, j.stock_dia);
    b.l("M05");
    b.footer();
    if j.cutoff && j.bottom_dia > 0.0 { b.warn.push("Cut-off stops short of the centre: the part may break off before the end.".into()); }
    if j.sp.css && j.bottom_dia < 1e-9 { b.warn.push("At the centre CSS asks for infinite speed: the G50 clamp sets the real speed.".into()); }
    let t_one = css_plunge_time_min(j.stock_dia, j.bottom_dia, j.f_rev, if j.sp.css { j.sp.v } else { 1.0 }, if j.sp.css { j.sp.max_rpm } else { 0.0 }, j.metric);
    let t_one = if j.sp.css { t_one } else { (rs - rbot) / (j.f_rev * j.sp.rpm) };
    b.done(vec![n as f64, t_one])
}

// ---------------------------------------------------------------------------
// Keyway broaching (lathe or mill, spindle locked)

#[derive(Clone, Debug)]
pub struct BroachJob {
    pub metric: bool, pub ctrl: Ctrl, pub prog: u32, pub tool: u32,
    pub lathe: bool,
    pub bore_dia: f64, pub depth: f64, pub doc: f64, pub spring: u32,
    pub z_start: f64, pub z_end: f64, pub feed: f64, pub lift: f64,
    /// Mill: bore centre, depth direction (0 +X, 1 +Y, 2 -X, 3 -Y), and the
    /// distance from the spindle axis to the cutting edge.
    pub cx: f64, pub cy: f64, pub dir: u32, pub edge: f64, pub wcs: u32,
}

pub fn gen_broach(j: &BroachJob) -> Program {
    if !supported(j.ctrl, cyc::BROACH) { return Program::err("This control is not yet supported for this cycle."); }
    if !(j.bore_dia > 0.0 && j.depth > 0.0 && j.doc > 0.0 && j.feed > 0.0 && j.lift >= 0.0) { return Program::err("Enter bore, keyway depth, depth per stroke and feed."); }
    if !(j.z_end < j.z_start) { return Program::err("Stroke end Z must be below the start Z."); }
    let n = ((j.depth / j.doc) - 1e-9).ceil().max(1.0) as usize;
    if n > 2000 { return Program::err("Too many strokes: increase the depth per stroke."); }
    let mut ds: Vec<f64> = (1..=n).map(|i| (i as f64 * j.doc).min(j.depth)).collect();
    for _ in 0..j.spring { ds.push(j.depth); }
    let rb = j.bore_dia / 2.0;
    let (ux, uy) = match j.dir { 1 => (0.0, 1.0), 2 => (-1.0, 0.0), 3 => (0.0, -1.0), _ => (1.0, 0.0) };
    let start = if j.lathe { [rb - j.lift.max(0.0), 0.0, j.z_start] } else { [j.cx, j.cy, j.z_start] };
    let mut b = B::new(j.metric, j.ctrl, j.lathe, start);
    let notes = vec![
        format!("T{} - KEYWAY BROACH, BORE D{}, DEPTH {}", j.tool, b.n(j.bore_dia), b.n(j.depth)),
        format!("{} STROKE(S) OF {} + {} SPRING, FEED {} PER MIN", n, b.n(j.doc), j.spring, b.feed(j.feed)),
        "SPINDLE MUST BE ORIENTED AND LOCKED - THE CODE IS MACHINE SPECIFIC".into(),
        "CUTTING EDGE MUST FACE THE KEYWAY DIRECTION".into(),
    ];
    b.header(j.prog, "KEYWAY BROACH", &notes);
    if j.lathe {
        b.l(format!("{} G40 G98", b.units_line()));
        b.l(format!("T{:02}{:02}", j.tool, j.tool));
        b.l("M05");
        b.l(format!("G00 X{} Z{} M08", b.xd(rb - j.lift), b.n(j.z_start)));
    } else {
        b.l(format!("{} G17 G40 G49 G80 G90 G94", b.units_line()));
        b.l(format!("T{} M06", j.tool));
        b.l("M05");
        b.l(format!("G00 G{} X{} Y{}", j.wcs, b.n(j.cx), b.n(j.cy)));
        b.l(format!("G43 H{} Z{} M08", j.tool, b.n(j.z_start)));
    }
    let mut table = vec![];
    for (i, d) in ds.iter().enumerate() {
        let r = rb + d;
        table.extend_from_slice(&[(i + 1) as f64, *d]);
        if j.lathe {
            b.l(format!("G00 X{}", b.xd(r)));
            b.rapid_to(r, 0.0, j.z_start);
            b.l(format!("G01 Z{} F{}", b.n(j.z_end), b.feed(j.feed)));
            b.feed_to(r, 0.0, j.z_end, j.feed);
            b.l(format!("G00 X{}", b.xd(r - j.lift)));
            b.rapid_to(r - j.lift, 0.0, j.z_end);
            b.l(format!("Z{}", b.n(j.z_start)));
            b.rapid_to(r - j.lift, 0.0, j.z_start);
        } else {
            let p = |dist: f64| (j.cx + ux * (dist - j.edge), j.cy + uy * (dist - j.edge));
            let (x, y) = p(r); let (lx, ly) = p(r - j.lift);
            b.l(format!("G00 X{} Y{}", b.n(x), b.n(y)));
            b.rapid_to(x, y, j.z_start);
            b.l(format!("G01 Z{} F{}", b.n(j.z_end), b.feed(j.feed)));
            b.feed_to(x, y, j.z_end, j.feed);
            b.l(format!("G00 X{} Y{}", b.n(lx), b.n(ly)));
            b.rapid_to(lx, ly, j.z_end);
            b.l(format!("Z{}", b.n(j.z_start)));
            b.rapid_to(lx, ly, j.z_start);
        }
    }
    if j.lathe { b.l(format!("G00 X{}", b.xd(rb - j.lift))); } else { b.l(format!("G00 X{} Y{}", b.n(j.cx), b.n(j.cy))); b.l("G91 G28 Z0."); b.l("G90"); }
    b.l("M09");
    b.footer();
    if j.lift <= 0.0 { b.warn.push("No lift on the return stroke: the edge will rub on the way back.".into()); }
    if !j.lathe && j.lift > (j.bore_dia / 2.0 - j.edge).abs() + j.depth { b.warn.push("Check the lift: the tool must stay inside the bore.".into()); }
    b.done(table)
}

// ---------------------------------------------------------------------------
// Lathe: G71/G70 rough and finish from a simple profile

#[derive(Clone, Debug)]
pub struct G71Job {
    pub metric: bool, pub ctrl: Ctrl, pub prog: u32, pub tool: u32,
    pub internal: bool, pub stock_dia: f64,
    /// Profile points (diameter, z) from the front, straight lines only.
    pub profile: Vec<(f64, f64)>,
    pub doc: f64, pub retract: f64, pub u: f64, pub w: f64,
    pub f_rough: f64, pub f_finish: f64, pub clear: f64, pub n_start: u32,
    pub sp: Spindle,
}

/// Radius of the profile (as list of (radius, z) going toward -Z) at
/// height r: the z where the profile first reaches r, walking from the
/// front. OD: profile radius grows; ID: it shrinks.
fn profile_z_at(p: &[(f64, f64)], r: f64, od: bool) -> f64 {
    let reached = |x: f64| if od { x >= r - 1e-12 } else { x <= r + 1e-12 };
    if reached(p[0].0) { return p[0].1; }
    for w in p.windows(2) {
        let ((r0, z0), (r1, z1)) = (w[0], w[1]);
        if reached(r1) {
            if (r1 - r0).abs() < 1e-12 { return z1; }
            return z0 + (z1 - z0) * (r - r0) / (r1 - r0);
        }
    }
    p[p.len() - 1].1
}

pub fn gen_g71(j: &G71Job) -> Program {
    if !supported(j.ctrl, cyc::G71) { return Program::err("This control is not yet supported for this cycle."); }
    if j.profile.len() < 2 { return Program::err("Enter at least two profile points."); }
    if j.profile.len() > 200 { return Program::err("200 profile points at most."); }
    if !(j.stock_dia > 0.0 && j.doc > 0.0 && j.retract >= 0.0 && j.f_rough > 0.0 && j.f_finish > 0.0 && j.clear > 0.0) { return Program::err("Enter stock, depth of cut, retract, feeds and clearance."); }
    if let Some(e) = check_lathe_spindle(&j.sp) { return Program::err(e); }
    let od = !j.internal;
    for w in j.profile.windows(2) {
        let ((x0, z0), (x1, z1)) = (w[0], w[1]);
        if z1 > z0 + 1e-12 { return Program::err("Profile Z must not go back toward the front (G71 type I)."); }
        if od && x1 < x0 - 1e-12 { return Program::err("Outside profile: diameters must not get smaller toward the chuck (no undercuts in G71 type I)."); }
        if !od && x1 > x0 + 1e-12 { return Program::err("Inside profile: diameters must not get larger toward the chuck."); }
    }
    let first = j.profile[0];
    let last = *j.profile.last().unwrap();
    if od && (first.0 >= j.stock_dia || last.0 > j.stock_dia + 1e-9) { return Program::err("Outside profile must lie below the stock diameter."); }
    if !od && (first.0 <= j.stock_dia || last.0 < j.stock_dia - 1e-9) { return Program::err("Inside profile must lie above the pre-bore diameter."); }
    let s = if od { 1.0 } else { -1.0 };
    let zc = first.1 + j.clear;
    let rs = j.stock_dia / 2.0;
    let rcl = rs + s * j.clear;
    let mut b = B::new(j.metric, j.ctrl, true, [rcl, 0.0, zc]);
    let notes = vec![
        format!("T{:02}{:02} - {} ROUGH G71 AND FINISH G70", j.tool, j.tool, if od { "OUTSIDE" } else { "INSIDE" }),
        format!("STOCK D{}, CUT {} PER SIDE, LEAVE U{} W{}", b.n(j.stock_dia), b.n(j.doc), b.n(s * j.u.abs()), b.n(j.w)),
    ];
    b.header(j.prog, "G71 G70", &notes);
    b.l(format!("{} G40 G99", b.units_line()));
    b.l(format!("T{:02}{:02}", j.tool, j.tool));
    lathe_spindle_on(&mut b, &j.sp, j.stock_dia);
    b.l(format!("G00 X{} Z{} M08", b.xd(rcl), b.n(zc)));
    let ns = j.n_start;
    // Profile blocks: N ns G00 X first; G01 Z first; then each point; then out to the stock.
    let mut blocks = vec![format!("G00 X{}", b.xd(first.0 / 2.0)), format!("G01 Z{} F{}", b.n(first.1), b.feed(j.f_finish))];
    for p in j.profile.iter().skip(1) { blocks.push(format!("X{} Z{}", b.xd(p.0 / 2.0), b.n(p.1))); }
    if (last.0 - j.stock_dia).abs() > 1e-9 { blocks.push(format!("X{}", b.xd(rs))); }
    let nf = ns + blocks.len() as u32 - 1;
    let u_word = b.n(s * j.u.abs());
    if j.ctrl == Ctrl::Haas {
        b.l(format!("G71 P{} Q{} U{} W{} D{} F{}", ns, nf, u_word, b.n(j.w), b.n(j.doc), b.feed(j.f_rough)));
    } else {
        b.l(format!("G71 U{} R{}", b.n(j.doc), b.n(j.retract)));
        b.l(format!("G71 P{} Q{} U{} W{} F{}", ns, nf, u_word, b.n(j.w), b.feed(j.f_rough)));
    }
    for (i, t) in blocks.iter().enumerate() { b.l(format!("N{} {}", ns + i as u32, t)); }
    b.l(format!("G70 P{} Q{}", ns, nf));
    b.l(format!("G00 X{} Z{}", b.xd(rcl), b.n(zc)));
    b.l("M09");
    lathe_spindle_off(&mut b, &j.sp, j.stock_dia);
    b.l("M05");
    b.footer();
    // Model: offset profile (radius + s u/2, z + w), roughing levels, semi-finish along the offset, finish.
    let mut prof: Vec<(f64, f64)> = j.profile.iter().map(|(x, z)| (x / 2.0, *z)).collect();
    if (last.0 - j.stock_dia).abs() > 1e-9 { prof.push((rs, last.1)); }
    let off: Vec<(f64, f64)> = prof.iter().map(|(r, z)| (r + s * j.u.abs() / 2.0, z + j.w)).collect();
    let r_min = off[0].0;
    let mut k = 1;
    let mut levels = vec![];
    loop {
        let r = rs - s * j.doc * k as f64;
        if s * (r - r_min) <= 1e-9 { break; }
        levels.push(r); k += 1;
        if k > 2000 { return Program::err("Too many passes: increase the depth of cut."); }
    }
    let mut table = vec![];
    for r in levels.iter() {
        let ze = profile_z_at(&off, *r, od);
        table.push(2.0 * r);
        b.rapid_to(r + s * j.retract, 0.0, zc);
        b.rapid_to(*r, 0.0, zc);
        b.lfeed_to(*r, ze, j.f_rough, &j.sp);
        b.rapid_to(r + s * j.retract, 0.0, ze + j.retract);
        b.rapid_to(r + s * j.retract, 0.0, zc);
    }
    // Semi-finish along the offset contour, then G70 along the profile.
    b.rapid_to(off[0].0, 0.0, zc);
    for p in off.iter() { b.lfeed_to(p.0, p.1, j.f_rough, &j.sp); }
    b.rapid_to(rcl, 0.0, b.pos[2]);
    b.rapid_to(rcl, 0.0, zc);
    b.rapid_to(prof[0].0, 0.0, zc);
    for p in prof.iter() { b.lfeed_to(p.0, p.1, j.f_finish, &j.sp); }
    b.rapid_to(rcl, 0.0, b.pos[2]);
    b.rapid_to(rcl, 0.0, zc);
    b.warn.push("The roughing moves shown are BenchMate's model of G71; the control plans the real passes.".into());
    b.warn.push("F in the profile blocks (finish feed) is used by G70 only; G71 roughs at its own F.".into());
    b.done(table)
}

// ---------------------------------------------------------------------------
// Flat parameter parsing for the WebAssembly wrapper (see wasm/src/lib.rs).

fn g(v: &[f64], i: usize) -> f64 { v.get(i).copied().unwrap_or(f64::NAN) }
fn gu(v: &[f64], i: usize) -> u32 { let x = g(v, i); if x.is_finite() && x > 0.0 { x.round() as u32 } else { 0 } }
fn gb(v: &[f64], i: usize) -> bool { g(v, i) == 1.0 }
fn pairs(v: &[f64], from: usize, n: usize) -> Vec<(f64, f64)> {
    (0..n).filter_map(|k| { let (x, y) = (g(v, from + 2 * k), g(v, from + 2 * k + 1)); if x.is_finite() && y.is_finite() { Some((x, y)) } else { None } }).collect()
}
fn spindle(v: &[f64], i: usize) -> Spindle { Spindle { css: gb(v, i), v: g(v, i + 1), max_rpm: g(v, i + 2), rpm: g(v, i + 3) } }

/// Build and run a generator from a flat parameter list. Layouts (index:
/// meaning), all start with 0 metric (1/0), 1 control, 2 program number,
/// 3 tool:
/// - DRILL: 4 cycle, 5 rigid, 6 return to R, 7 wcs, 8 rpm, 9 feed, 10 pitch,
///   11 z_init, 12 r, 13 z, 14 q, 15 dwell s, 16 coolant, 17 holes n, 18.. x, y.
/// - THREAD_MILL: 4 internal, 5 left hand, 6 climb, 7 comp, 8 major, 9 pitch,
///   10 depth, 11 tool dia, 12 length, 13 z top, 14 z clear, 15 rpm, 16 edge
///   feed, 17 passes, 18 spring, 19 multi-form, 20 cx, 21 cy, 22 D register, 23 wcs.
/// - G76 / G92: 4 internal, 5 major, 6 lead, 7 depth, 8 z start, 9 z end,
///   10 x clear (radial), 11 spring, 12 first, 13 min cut, 14 finish,
///   15 haas constant depth, 16 tool angle, 17 pull-out, 18 infeed angle,
///   19 rpm, 20 pass count n, 21.. cumulative depths.
/// - TAPER: 4 internal, 5 front dia, 6 back dia, 7 length, 8 z front, 9 doc,
///   10 finish, 11 f rough, 12 f finish, 13 clear, 14 comp, 15 css, 16 v,
///   17 max rpm, 18 rpm.
/// - GROOVE: 4 cut-off, 5 stock dia, 6 bottom dia, 7 z front, 8 width,
///   9 tool width, 10 step, 11 peck, 12 peck back, 13 feed/rev, 14 clear,
///   15 css, 16 v, 17 max rpm, 18 rpm.
/// - BROACH: 4 lathe, 5 bore dia, 6 depth, 7 doc, 8 spring, 9 z start,
///   10 z end, 11 feed, 12 lift, 13 cx, 14 cy, 15 dir, 16 edge, 17 wcs.
/// - G71: 4 internal, 5 stock dia, 6 doc, 7 retract, 8 u, 9 w, 10 f rough,
///   11 f finish, 12 clear, 13 n start, 14 css, 15 v, 16 max rpm, 17 rpm,
///   18 point count n, 19.. diameter, z.
pub fn run_flat(cycle: u32, v: &[f64]) -> Program {
    let (metric, ctrl, prog, tool) = (gb(v, 0), Ctrl::from_f(g(v, 1)), gu(v, 2), gu(v, 3).max(1));
    match cycle {
        cyc::DRILL => {
            let n = gu(v, 17) as usize;
            gen_drill(&DrillJob { metric, ctrl, prog, tool, cycle: gu(v, 4), rigid: gb(v, 5), ret_r: gb(v, 6), wcs: gu(v, 7).clamp(54, 59),
                rpm: g(v, 8), feed: g(v, 9), pitch: g(v, 10), z_init: g(v, 11), r: g(v, 12), z: g(v, 13), q: g(v, 14), dwell: g(v, 15),
                coolant: gb(v, 16), holes: pairs(v, 18, n) })
        }
        cyc::THREAD_MILL => gen_thread_mill(&ThreadMillJob { metric, ctrl, prog, tool, internal: gb(v, 4), left_hand: gb(v, 5), climb: gb(v, 6), comp: gb(v, 7),
            major: g(v, 8), pitch: g(v, 9), depth: g(v, 10), tool_dia: g(v, 11), length: g(v, 12), z_top: g(v, 13), z_clear: g(v, 14),
            rpm: g(v, 15), edge_feed: g(v, 16), passes: gu(v, 17), spring: gu(v, 18), multi_form: gb(v, 19), cx: g(v, 20), cy: g(v, 21),
            d_reg: gu(v, 22).max(1), wcs: gu(v, 23).clamp(54, 59) }),
        cyc::G76 | cyc::G92 => {
            let n = gu(v, 20) as usize;
            let passes: Vec<f64> = (0..n).map(|k| g(v, 21 + k)).collect();
            gen_lathe_thread(&LatheThreadJob { metric, ctrl, prog, tool, g76: cycle == cyc::G76, internal: gb(v, 4), major: g(v, 5), lead: g(v, 6), depth: g(v, 7),
                z_start: g(v, 8), z_end: g(v, 9), x_clear: g(v, 10), spring: gu(v, 11), first: g(v, 12), min_cut: g(v, 13).max(0.0), finish: g(v, 14).max(0.0),
                haas_const_depth: gb(v, 15), tool_angle: g(v, 16), pullout: g(v, 17).max(0.0), infeed_angle: g(v, 18).max(0.0), rpm: g(v, 19), passes })
        }
        cyc::TAPER => gen_taper(&TaperJob { metric, ctrl, prog, tool, internal: gb(v, 4), front_dia: g(v, 5), back_dia: g(v, 6), length: g(v, 7), z_front: g(v, 8),
            doc: g(v, 9), finish: g(v, 10), f_rough: g(v, 11), f_finish: g(v, 12), clear: g(v, 13), comp: gb(v, 14), sp: spindle(v, 15) }),
        cyc::GROOVE => gen_groove(&GrooveJob { metric, ctrl, prog, tool, cutoff: gb(v, 4), stock_dia: g(v, 5), bottom_dia: g(v, 6), z_front: g(v, 7), width: g(v, 8),
            tool_width: g(v, 9), step: g(v, 10), peck: g(v, 11).max(0.0), peck_back: g(v, 12).max(0.0), f_rev: g(v, 13), clear: g(v, 14), sp: spindle(v, 15) }),
        cyc::BROACH => gen_broach(&BroachJob { metric, ctrl, prog, tool, lathe: gb(v, 4), bore_dia: g(v, 5), depth: g(v, 6), doc: g(v, 7), spring: gu(v, 8),
            z_start: g(v, 9), z_end: g(v, 10), feed: g(v, 11), lift: g(v, 12), cx: g(v, 13), cy: g(v, 14), dir: gu(v, 15), edge: g(v, 16), wcs: gu(v, 17).clamp(54, 59) }),
        cyc::G71 => {
            let n = gu(v, 18) as usize;
            gen_g71(&G71Job { metric, ctrl, prog, tool, internal: gb(v, 4), stock_dia: g(v, 5), doc: g(v, 6), retract: g(v, 7), u: g(v, 8), w: g(v, 9),
                f_rough: g(v, 10), f_finish: g(v, 11), clear: g(v, 12), n_start: gu(v, 13).max(1), sp: spindle(v, 14), profile: pairs(v, 19, n) })
        }
        _ => Program::err("Unknown cycle."),
    }
}

#[cfg(test)]
mod tests;
