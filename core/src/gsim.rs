//! G-code backplot: reads a program in a practical subset of ISO 6983 /
//! Fanuc-style G-code (Haas reads the same here) and turns it into toolpath
//! segments, a bounding box, distances and an estimated cycle time.
//!
//! This is a backplot of the programmed path, not a machine verification:
//! no stock, no tool shape, no cutter or nose radius compensation, no
//! acceleration, no machine limits. Supported: G0/G1/G2/G3 (I/J/K centre or
//! R), helical arcs, G4, G17/G18/G19, G20/G21, G90/G91 (mill), G94/G95
//! (mill) and G98/G99 (lathe feed modes), G96/G97 and G50 S, G28 (to the
//! intermediate point only), F/S/T/M/N words, comments in brackets or after
//! a semicolon. Mill drilling cycles G73, G74, G81 to G86 and G89 are
//! expanded; lathe G70 (finishing along P..Q), G90/G92/G94 box cycles and
//! G32 are drawn. G71 to G76 roughing and threading cycles, G76/G87/G88 on
//! the mill and everything else are reported as "not simulated yet".
//!
//! Lathe mode: X words are diameters, U and W incremental X and Z; the
//! position is kept as radius (x), y = 0, z. Mill mode: X, Y, Z.
//! Internally every length is in millimetres; results are converted to the
//! output unit chosen in `Opts`.

use crate::gcode::Ctrl;
use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;

/// Simulation options. Lengths in the output unit (mm when `metric_out`,
/// else inch).
#[derive(Clone, Copy, Debug)]
pub struct Opts {
    pub lathe: bool,
    pub ctrl: Ctrl,
    /// Results in mm (true) or inch (false).
    pub metric_out: bool,
    /// Units assumed until the program gives G20 or G21.
    pub default_metric: bool,
    /// Rapid traverse rate, output units per minute (0 = unknown).
    pub rapid: f64,
    /// Largest allowed difference between the start and end radius of an
    /// arc, output units.
    pub arc_tol: f64,
    /// Spindle limit used for G96 when the program has no G50 S (0 = none).
    pub max_rpm: f64,
}

impl Default for Opts {
    fn default() -> Self {
        Opts { lathe: false, ctrl: Ctrl::Generic, metric_out: true, default_metric: true, rapid: 0.0, arc_tol: 0.005, max_rpm: 0.0 }
    }
}

/// One straight piece of the path (arcs are split into pieces of at most
/// 2 degrees). `step` is the index in `Sim::steps` of the block that made it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Seg { pub rapid: bool, pub step: u32, pub a: [f64; 3], pub b: [f64; 3] }

/// One executed block, in execution order (a G70 runs its P..Q blocks again).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Step {
    /// Source line, 1-based.
    pub line: u32,
    /// Segments `seg0..seg1` belong to this block.
    pub seg0: u32,
    pub seg1: u32,
    /// Position after the block (lathe: x is the radius).
    pub pos: [f64; 3],
    /// Modal feed in output units per minute or per revolution.
    pub feed: f64,
    pub per_rev: bool,
    /// Spindle speed in rpm (under G96: at the end position).
    pub rpm: f64,
    pub tool: u32,
    /// Cumulative estimated time in seconds at the end of the block.
    pub time: f64,
}

/// A message: level 0 error, 1 warning, 2 note. `line` is 1-based (0 = whole program).
#[derive(Clone, Debug, PartialEq)]
pub struct Msg { pub line: u32, pub level: u8, pub text: String }

#[derive(Clone, Debug, Default)]
pub struct Sim {
    pub segs: Vec<Seg>,
    pub steps: Vec<Step>,
    pub msgs: Vec<Msg>,
    /// Bounding box of all moves, and of feed moves only: (min, max).
    pub bbox: Option<([f64; 3], [f64; 3])>,
    pub bbox_feed: Option<([f64; 3], [f64; 3])>,
    pub feed_dist: f64,
    pub rapid_dist: f64,
    /// Seconds. Rapid time is NaN when the rapid rate is unknown.
    pub feed_time: f64,
    pub rapid_time: f64,
    pub dwell_time: f64,
    /// Feed blocks whose time could not be counted (no F, or per-rev with no S).
    pub untimed: u32,
    pub metric_out: bool,
    pub lathe: bool,
}

impl Sim {
    pub fn errors(&self) -> impl Iterator<Item = &Msg> { self.msgs.iter().filter(|m| m.level == 0) }
    pub fn error_count(&self) -> usize { self.errors().count() }
    pub fn total_time(&self) -> f64 { self.feed_time + self.dwell_time + if self.rapid_time.is_finite() { self.rapid_time } else { 0.0 } }
}

// ---------------------------------------------------------------------------
// Lexing

#[derive(Clone, Copy, Debug, PartialEq)]
struct Word { c: char, v: f64, dec: bool }

#[derive(Debug, PartialEq)]
enum Lex { Words(Vec<Word>), Blank, Macro }

fn lex(line: &str) -> Result<Lex, String> {
    let mut code = String::new();
    // Brackets inside a comment are counted, so "(4 HOLE(S) AT Z-20.)" is one comment.
    let mut depth = 0;
    for ch in line.chars() {
        match ch {
            '(' => depth += 1,
            ')' if depth > 0 => depth -= 1,
            ')' => return Err("')' with no matching '('".into()),
            _ if depth > 0 => {}
            ';' => break,
            '\r' => {}
            _ => code.push(ch),
        }
    }
    if depth > 0 { return Err("comment not closed: ')' missing".into()); }
    let t = code.trim();
    if t.is_empty() || t.starts_with('%') { return Ok(Lex::Blank); }
    if t.contains('#') || t.contains('[') || t.contains('=') { return Ok(Lex::Macro); }
    let b: Vec<char> = t.chars().collect();
    let mut i = 0;
    let mut out = vec![];
    if b[0] == '/' { i = 1; }
    while i < b.len() {
        let c = b[i];
        if c.is_whitespace() { i += 1; continue; }
        let c = if c == ':' { 'O' } else { c.to_ascii_uppercase() };
        if !c.is_ascii_alphabetic() { return Err(format!("unexpected character '{}'", b[i])); }
        i += 1;
        while i < b.len() && b[i] == ' ' { i += 1; }
        if i < b.len() && b[i].is_ascii_alphabetic() { return Ok(Lex::Macro); }
        let s0 = i;
        if i < b.len() && (b[i] == '+' || b[i] == '-') { i += 1; }
        let mut digits = 0; let mut dec = false;
        while i < b.len() && (b[i].is_ascii_digit() || b[i] == '.') { if b[i] == '.' { if dec { break; } dec = true; } else { digits += 1; } i += 1; }
        if digits == 0 { return Err(format!("word {} has no value", c)); }
        let s: String = b[s0..i].iter().collect();
        let v: f64 = s.parse().map_err(|_| format!("bad number in word {}{}", c, s))?;
        out.push(Word { c, v, dec });
    }
    Ok(Lex::Words(out))
}

// ---------------------------------------------------------------------------
// Execution

const MM: f64 = 25.4;

#[derive(Clone, Copy)]
struct Cyc { r: f64, z: f64, q: f64, p: f64, init_z: f64 }

struct M<'a> {
    o: Opts,
    lines: Vec<&'a str>,
    labels: HashMap<i64, usize>,
    sim: Sim,
    once: HashSet<String>,
    pos: [f64; 3],
    metric: bool,
    units_set: bool,
    moved: bool,
    abs: bool,
    plane: u8,
    motion: i32,
    cycle: Option<i32>,
    cyc: Cyc,
    ret_r: bool,
    per_rev: bool,
    f_mm: f64,
    css: bool,
    v_mpm: f64,
    rpm: f64,
    clamp: f64,
    tool: u32,
    time: f64,
    stopped: bool,
    depth: u32,
    step: u32,
    untimed_lines: HashSet<u32>,
    /// End point of the last lathe box cycle (X and Z stay modal).
    box_end: Option<[f64; 3]>,
}

enum Flow { Next, Jump(usize), Stop }

fn has(w: &[Word], c: char) -> bool { w.iter().any(|x| x.c == c) }
fn get(w: &[Word], c: char) -> Option<Word> { w.iter().rev().find(|x| x.c == c).copied() }

impl<'a> M<'a> {
    fn k(&self) -> f64 { if self.metric { 1.0 } else { MM } }
    fn msg(&mut self, line: usize, level: u8, text: impl Into<String>) { self.sim.msgs.push(Msg { line: line as u32 + 1, level, text: text.into() }); }
    fn once(&mut self, key: &str, line: usize, level: u8, text: impl Into<String>) {
        if self.once.insert(key.to_string()) { self.msg(line, level, text); }
    }
    fn out_k(&self) -> f64 { if self.o.metric_out { 1.0 } else { 1.0 / MM } }

    fn push(&mut self, rapid: bool, a: [f64; 3], b: [f64; 3]) {
        if (0..3).all(|i| (a[i] - b[i]).abs() < 1e-12) { return; }
        self.sim.segs.push(Seg { rapid, step: self.step, a, b });
    }

    fn rapid_to(&mut self, t: [f64; 3]) {
        let a = self.pos;
        let d = dist(a, t);
        self.sim.rapid_dist += d;
        self.push(true, a, t);
        self.pos = t;
    }

    /// Spindle rpm at radius `r` (mm).
    fn rpm_at(&self, r: f64) -> f64 {
        if self.css && self.o.lathe {
            let lim = if self.clamp > 0.0 { self.clamp } else { self.o.max_rpm };
            crate::cycles::css_rpm(self.v_mpm, 2.0 * r.abs(), lim, true)
        } else { self.rpm }
    }

    /// Feed along a polyline from the current position; returns false if
    /// the time could not be counted.
    fn feed_path(&mut self, line: usize, pts: &[[f64; 3]]) { self.feed_path_len(line, pts, None, 1.0) }

    /// As `feed_path`; `exact` is the true length of a curved path whose
    /// chords are `pts` (the chord lengths are scaled up to it).
    /// `tf` scales the length used for the time (helical arcs: the feed
    /// applies along the arc in the plane, as on Fanuc and Haas controls).
    fn feed_path_len(&mut self, line: usize, pts: &[[f64; 3]], exact: Option<f64>, tf: f64) {
        let mut chord = 0.0; let mut p = self.pos;
        for &b in pts { chord += dist(p, b); p = b; }
        let scale = match exact { Some(l) if chord > 0.0 => l / chord, _ => 1.0 };
        let mut a = self.pos;
        let mut t = 0.0; let mut ok = true; let mut len = 0.0;
        for &b in pts {
            let d = dist(a, b) * scale;
            len += d;
            if d > 0.0 {
                if self.f_mm <= 0.0 { ok = false; }
                else if self.per_rev {
                    // Split for constant surface speed on a lathe (rpm changes with X).
                    let n = if self.css && self.o.lathe && (a[0] - b[0]).abs() > 1e-9 { 16 } else { 1 };
                    for j in 0..n {
                        let r = a[0] + (b[0] - a[0]) * (j as f64 + 0.5) / n as f64;
                        let rpm = self.rpm_at(r);
                        if !(rpm > 0.0) { ok = false; break; }
                        if rpm.is_finite() { t += d * tf / n as f64 / (self.f_mm * rpm) * 60.0; }
                    }
                } else { t += d * tf / self.f_mm * 60.0; }
            }
            self.push(false, a, b);
            a = b;
        }
        self.pos = a;
        self.sim.feed_dist += len;
        if len > 0.0 {
            if ok { self.sim.feed_time += t; self.time += t; }
            else if self.untimed_lines.insert(line as u32) {
                self.sim.untimed += 1;
                if self.f_mm <= 0.0 { self.msg(line, 0, "feed move with no feed rate (F) set"); }
                else if self.css && self.o.lathe { self.once("nocss", line, 1, "feed per revolution under G96 with no surface speed (S): time not counted"); }
                else { self.once("nos", line, 1, "feed per revolution with no spindle speed (S): time not counted for this and any later such block"); }
            }
        }
    }

    fn dwell(&mut self, s: f64) { if s > 0.0 { self.sim.dwell_time += s; self.time += s; } }

    /// Seconds from a P word: with a decimal point seconds, without milliseconds.
    fn p_secs(w: Word) -> f64 { if w.dec { w.v } else { w.v / 1000.0 } }

    /// End point from the axis words of a block.
    fn target(&mut self, line: usize, w: &[Word]) -> [f64; 3] {
        let k = self.k();
        let mut t = self.pos;
        if self.o.lathe {
            if let Some(x) = get(w, 'X') { t[0] = x.v * k / 2.0; }
            if let Some(z) = get(w, 'Z') { t[2] = z.v * k; }
            if let Some(u) = get(w, 'U') { t[0] += u.v * k / 2.0; }
            if let Some(ww) = get(w, 'W') { t[2] += ww.v * k; }
            if has(w, 'Y') { self.once("lathey", line, 1, "Y word ignored in lathe mode"); }
        } else {
            for (i, c) in ['X', 'Y', 'Z'].iter().enumerate() {
                if let Some(x) = get(w, *c) { if self.abs { t[i] = x.v * k; } else { t[i] += x.v * k; } }
            }
        }
        t
    }

    fn has_axes(&self, w: &[Word]) -> bool {
        if self.o.lathe { w.iter().any(|x| matches!(x.c, 'X' | 'Z' | 'U' | 'W')) } else { w.iter().any(|x| matches!(x.c, 'X' | 'Y' | 'Z')) }
    }

    fn run(&mut self, from: usize, to: usize) {
        let mut i = from;
        while i <= to && i < self.lines.len() {
            if self.stopped {
                if self.depth == 0 {
                    if let Ok(Lex::Words(w)) = lex(self.lines[i]) {
                        if !w.is_empty() && w.iter().any(|x| x.c != 'N' && x.c != 'O') { self.once("after", i, 1, "blocks after M30 / M02 are not simulated"); }
                    }
                }
                i += 1; continue;
            }
            match self.line(i) {
                Flow::Next => i += 1,
                Flow::Jump(j) => i = j,
                Flow::Stop => { self.stopped = true; i += 1; }
            }
        }
    }

    fn line(&mut self, i: usize) -> Flow {
        let src = self.lines[i];
        if src.trim().is_empty() { return Flow::Next; }
        self.step = self.sim.steps.len() as u32;
        let seg0 = self.sim.segs.len() as u32;
        let flow = match lex(src) {
            Err(e) => { self.msg(i, 0, e); Flow::Next }
            Ok(Lex::Blank) => Flow::Next,
            Ok(Lex::Macro) => { self.msg(i, 1, "macro statement (variables, IF, GOTO, WHILE) not simulated; block skipped"); Flow::Next }
            Ok(Lex::Words(w)) => self.block(i, &w),
        };
        let k = self.out_k();
        let rpm = self.rpm_at(self.pos[0]);
        let seg1 = self.sim.segs.len() as u32;
        // A G70 block owns only its own segments, not those of the P..Q blocks it ran.
        let mut s0 = seg1;
        while s0 > seg0 && self.sim.segs[s0 as usize - 1].step == self.step { s0 -= 1; }
        let seg0 = if self.sim.steps.len() as u32 > self.step { s0 } else { seg0 };
        self.sim.steps.push(Step {
            line: i as u32 + 1, seg0, seg1,
            pos: [self.pos[0] * k, self.pos[1] * k, self.pos[2] * k],
            feed: self.f_mm * k, per_rev: self.per_rev, rpm: if rpm.is_finite() { rpm } else { 0.0 }, tool: self.tool, time: self.time,
        });
        flow
    }

    fn block(&mut self, i: usize, w: &[Word]) -> Flow {
        let lathe = self.o.lathe;
        // Words with no decimal point on axis values.
        if let Some(x) = w.iter().find(|x| "XYZUWIJKR".contains(x.c) && !x.dec && x.v != 0.0) {
            self.once("nodec", i, 1, format!("{}{} has no decimal point: read as {} {} (calculator-type input). Controls with standard input read it in least increments (0.001 mm / 0.0001 in)", x.c, x.v, x.v, if self.metric { "mm" } else { "in" }));
        }
        let gs: Vec<i32> = w.iter().filter(|x| x.c == 'G').map(|x| (x.v * 10.0).round() as i32).collect();
        // Units first: they apply to the coordinates in the same block.
        for &g in &gs {
            if g == 200 || g == 210 {
                let m = g == 210;
                if self.moved && m != self.metric { self.msg(i, 1, format!("units switched to {} after moves: later values are read in {}; re-state F", if m { "mm (G21)" } else { "inch (G20)" }, if m { "mm" } else { "inch" })); }
                self.metric = m; self.units_set = true;
            }
        }
        let mut motion: Option<i32> = None;
        let mut nonmodal: Option<i32> = None;
        for &g in &gs {
            match g {
                0 | 10 | 20 | 30 => { if let Err(e) = setm(&mut motion, g) { self.msg(i, 0, e); return Flow::Next; } }
                40 => nonmodal = Some(40),
                170 | 180 | 190 => { self.plane = (g / 10) as u8; if lathe && g != 180 { self.once("lplane", i, 1, "G17/G19 on a lathe: arcs are taken in that plane; most lathes use G18"); } }
                200 | 210 => {}
                280 => nonmodal = Some(280),
                530 => nonmodal = Some(530),
                400 => {}
                410 | 420 => self.once("comp", i, 2, "cutter / nose radius compensation (G41/G42) is not applied: the plot shows the programmed path"),
                430 | 440 | 490 | 540..=590 | 610 | 640 | 150 | 690 => {}
                900 | 910 if !lathe => self.abs = g == 900,
                940 | 950 if !lathe => self.per_rev = g == 950,
                980 | 990 if lathe => self.per_rev = g == 990,
                980 | 990 => self.ret_r = g == 990,
                960 => { self.css = true; if !lathe { self.once("milcss", i, 1, "G96 on a mill: S is taken as a surface speed but the spindle speed is not known; per-rev feeds are not timed"); } }
                970 => self.css = false,
                500 if lathe => nonmodal = Some(500),
                920 if !lathe => nonmodal = Some(920),
                800 => { self.cycle = None; }
                930 => { self.msg(i, 1, "inverse time feed (G93) not simulated"); }
                // Mill drilling cycles.
                730 | 740 | 810 | 820 | 830 | 840 | 850 | 860 | 890 if !lathe => {
                    if self.cycle.is_none() { self.cyc.init_z = self.pos[2]; }
                    self.cycle = Some(g); motion = Some(g);
                }
                760 | 870 | 880 if !lathe => { self.msg(i, 1, format!("canned cycle G{} not simulated yet; no move drawn", g / 10)); return Flow::Next; }
                // Lathe cycles.
                320 | 900 | 920 | 940 if lathe => { if let Err(e) = setm(&mut motion, g) { self.msg(i, 0, e); return Flow::Next; } }
                700 | 710 | 720 | 730 | 740 | 750 | 760 if lathe => nonmodal = Some(g),
                800..=890 if lathe => { self.msg(i, 1, format!("canned cycle G{} on a lathe not simulated yet; no move drawn", g / 10)); return Flow::Next; }
                _ => self.msg(i, 1, format!("G{} not simulated; ignored", fmt_g(g))),
            }
        }
        // F, S, T.
        if let Some(f) = get(w, 'F') { self.f_mm = f.v * self.k(); }
        if let Some(s) = get(w, 'S') {
            if nonmodal == Some(500) { self.clamp = s.v; }
            else if self.css { self.v_mpm = if self.metric { s.v } else { s.v * 0.3048 }; }
            else { self.rpm = s.v; }
        }
        if let Some(t) = get(w, 'T') { self.tool = if lathe && t.v >= 100.0 { (t.v as u32) / 100 } else { t.v as u32 }; }
        let mut stop = false;
        for m in w.iter().filter(|x| x.c == 'M') {
            match m.v as i32 {
                2 | 30 => stop = true,
                98 | 97 => self.msg(i, 1, format!("subprogram call M{} not simulated", m.v as i32)),
                99 => self.msg(i, 1, "M99 (return / loop) not simulated"),
                _ => {}
            }
        }
        // Group 01 code cancels a drilling cycle.
        if let Some(g) = motion { if !lathe && g <= 30 { self.cycle = None; } }
        if let Some(g) = motion { if !(self.cycle.is_some() && g >= 730) { if g != self.motion { self.box_end = None; } self.motion = g; } }

        let flow = match nonmodal {
            Some(40) => {
                let s = get(w, 'P').map(Self::p_secs).or_else(|| get(w, 'X').map(|x| x.v)).or_else(|| get(w, 'U').map(|x| x.v)).unwrap_or(0.0);
                self.dwell(s); Flow::Next
            }
            Some(280) => {
                let t = self.target(i, w);
                self.rapid_to(t); self.moved = true;
                if self.has_axes(w) { self.once("g28", i, 2, "G28: the move from the intermediate point to the machine reference point is not drawn or timed (its position in work coordinates is unknown)"); }
                Flow::Next
            }
            Some(530) => { self.msg(i, 1, "G53 machine-coordinate move not simulated; no move drawn"); Flow::Next }
            Some(500) => { if self.has_axes(w) { self.msg(i, 1, "G50 coordinate setting not simulated"); } Flow::Next }
            Some(920) => { self.msg(i, 1, "G92 position preset not simulated; coordinates are not shifted"); Flow::Next }
            Some(g) if lathe && g >= 700 => self.lathe_cycle(i, g, w),
            _ => { self.motion_block(i, w); Flow::Next }
        };
        if stop { return Flow::Stop; }
        flow
    }

    fn motion_block(&mut self, i: usize, w: &[Word]) {
        let axes = self.has_axes(w);
        if let Some(c) = self.cycle {
            if axes || has(w, 'R') { self.drill(i, c, w); }
            return;
        }
        if !axes && !(matches!(self.motion, 20 | 30) && (has(w, 'I') || has(w, 'J') || has(w, 'K'))) { return; }
        if !self.units_set { self.units_set = true; let m = self.metric; self.once("units", i, 1, format!("no G20/G21 before the first move: {} assumed", if m { "mm" } else { "inch" })); }
        self.moved = true;
        let mut t = self.target(i, w);
        if matches!(self.motion, 900 | 920 | 940) {
            // Absolute X / Z not given in this block keep the last cycle's end point.
            if let Some(b) = self.box_end {
                if !has(w, 'X') && !has(w, 'U') { t[0] = b[0]; }
                if !has(w, 'Z') && !has(w, 'W') { t[2] = b[2]; }
            }
            self.box_end = Some(t);
        }
        match self.motion {
            0 => self.rapid_to(t),
            10 => self.feed_path(i, &[t]),
            20 | 30 => self.arc(i, self.motion == 30, t, w),
            320 => self.feed_path(i, &[t]),
            900 | 920 | 940 => self.box_cycle(i, self.motion, t, w),
            _ => {}
        }
    }

    fn arc(&mut self, i: usize, ccw: bool, t: [f64; 3], w: &[Word]) {
        let (ia, ib, il) = match self.plane { 18 => (2, 0, 1), 19 => (1, 2, 0), _ => (0, 1, 2) };
        let k = self.k();
        let s = self.pos;
        let (sa, sb, ea, eb) = (s[ia], s[ib], t[ia], t[ib]);
        let off = |ax: usize| -> Option<f64> { get(w, ['I', 'J', 'K'][ax]).map(|x| x.v * k) };
        let tol = self.o.arc_tol / self.out_k();
        let (ca, cb);
        if let Some(r) = get(w, 'R') {
            let r = r.v * k;
            let d = ((ea - sa).powi(2) + (eb - sb).powi(2)).sqrt();
            if d < 1e-9 { self.msg(i, 0, "arc with R and the same start and end point (a full circle needs I/J/K)"); self.feed_path(i, &[t]); return; }
            if r.abs() < 1e-12 { self.msg(i, 0, "arc radius R is zero"); self.feed_path(i, &[t]); return; }
            let h2 = r * r - (d / 2.0).powi(2);
            if h2 < 0.0 && d / 2.0 - r.abs() > tol { self.msg(i, 0, format!("arc radius R{} is smaller than half the distance between start and end ({})", fnum(r.abs() * self.out_k()), fnum(d / 2.0 * self.out_k()))); self.feed_path(i, &[t]); return; }
            let h = h2.max(0.0).sqrt();
            let (ua, ub) = ((ea - sa) / d, (eb - sb) / d);
            let sign = if ccw { 1.0 } else { -1.0 } * if r > 0.0 { 1.0 } else { -1.0 };
            ca = (sa + ea) / 2.0 - ub * h * sign; cb = (sb + eb) / 2.0 + ua * h * sign;
        } else {
            let (oa, ob) = (off(ia), off(ib));
            if oa.is_none() && ob.is_none() { self.msg(i, 0, format!("arc needs a centre ({} and {}) or a radius R", ["I", "J", "K"][ia.min(ib)], ["I", "J", "K"][ia.max(ib)])); self.feed_path(i, &[t]); return; }
            ca = sa + oa.unwrap_or(0.0); cb = sb + ob.unwrap_or(0.0);
        }
        let rs = ((sa - ca).powi(2) + (sb - cb).powi(2)).sqrt();
        let re = ((ea - ca).powi(2) + (eb - cb).powi(2)).sqrt();
        if (rs - re).abs() > tol {
            let q = self.out_k();
            self.msg(i, 0, format!("arc start radius {} and end radius {} differ by {} (tolerance {})", fnum(rs * q), fnum(re * q), fnum((rs - re).abs() * q), fnum(tol * q)));
            self.feed_path(i, &[t]);
            return;
        }
        if rs < 1e-9 { self.msg(i, 0, "arc radius is zero"); self.feed_path(i, &[t]); return; }
        let a0 = (sb - cb).atan2(sa - ca);
        let a1 = (eb - cb).atan2(ea - ca);
        let mut sw = if ccw { a1 - a0 } else { a0 - a1 };
        while sw < 0.0 { sw += 2.0 * PI; }
        while sw >= 2.0 * PI { sw -= 2.0 * PI; }
        let same = (sa - ea).abs() < 1e-9 && (sb - eb).abs() < 1e-9;
        if same { sw = 2.0 * PI; }
        let n = ((sw / (PI / 90.0)).ceil() as usize).max(1);
        let dir = if ccw { 1.0 } else { -1.0 };
        let mut pts = Vec::with_capacity(n);
        for j in 1..=n {
            let f = j as f64 / n as f64;
            let mut p = s;
            if j == n { p = t; } else {
                let a = a0 + dir * sw * f;
                let r = rs + (re - rs) * f;
                p[ia] = ca + r * a.cos(); p[ib] = cb + r * a.sin();
                p[il] = s[il] + (t[il] - s[il]) * f;
                // Axes outside the plane and the linear axis are interpolated.
            }
            pts.push(p);
        }
        // True length of the (helical) arc; the radius may drift by up to the tolerance.
        let rm = (rs + re) / 2.0;
        let exact = ((rm * sw).powi(2) + (t[il] - s[il]).powi(2)).sqrt();
        let tf = if exact > 0.0 { rm * sw / exact } else { 1.0 };
        self.feed_path_len(i, &pts, Some(exact), tf);
    }

    /// Mill drilling cycle at the position given by the block.
    fn drill(&mut self, i: usize, c: i32, w: &[Word]) {
        let k = self.k();
        if self.plane != 17 { self.once("cplane", i, 1, "drilling cycles are drawn along Z (G17) only"); }
        if let Some(r) = get(w, 'R') { self.cyc.r = if self.abs { r.v * k } else { self.cyc.init_z + r.v * k }; }
        if let Some(z) = get(w, 'Z') { self.cyc.z = if self.abs { z.v * k } else { self.cyc.r + z.v * k }; }
        if let Some(q) = get(w, 'Q') { self.cyc.q = q.v.abs() * k; }
        if let Some(p) = get(w, 'P') { self.cyc.p = Self::p_secs(p); }
        let reps = get(w, 'K').or(get(w, 'L')).map(|x| x.v.max(0.0) as u32).unwrap_or(1);
        self.moved = true;
        if !self.units_set { self.units_set = true; let m = self.metric; self.once("units", i, 1, format!("no G20/G21 before the first move: {} assumed", if m { "mm" } else { "inch" })); }
        let (dx, dy) = (get(w, 'X').map(|x| x.v * k), get(w, 'Y').map(|x| x.v * k));
        let Cyc { r, z, q, p, init_z } = self.cyc;
        if z > r { self.msg(i, 1, "cycle bottom Z is above the R level"); }
        for n in 0..reps {
            let mut xy = [self.pos[0], self.pos[1]];
            if self.abs { xy[0] = dx.unwrap_or(xy[0]); xy[1] = dy.unwrap_or(xy[1]); }
            else { xy[0] += dx.unwrap_or(0.0); xy[1] += dy.unwrap_or(0.0); }
            let _ = n;
            let zc = self.pos[2];
            self.rapid_to([xy[0], xy[1], zc]);
            self.rapid_to([xy[0], xy[1], r]);
            let at = |zz: f64| [xy[0], xy[1], zz];
            match c {
                830 | 730 => {
                    // Peck clearance / G73 back-off: a control parameter; taken
                    // as 0.5 mm or 0.02 in, the same as the cycle generators.
                    let cl = if self.metric { 0.5 } else { 0.02 * MM };
                    if q <= 0.0 { self.msg(i, 0, format!("G{} needs a peck depth Q greater than zero", c / 10)); self.feed_path(i, &[at(z)]); }
                    else {
                        let mut d = r;
                        while d > z + 1e-9 {
                            let nx = (d - q).max(z);
                            self.feed_path(i, &[at(nx)]);
                            if nx > z + 1e-9 {
                                if c == 830 { self.rapid_to(at(r)); }
                                self.rapid_to(at((nx + cl).min(r)));
                            }
                            d = nx;
                        }
                        self.once(if c == 830 { "g83" } else { "g73" }, i, 2, format!("G{} pecks: {}, then rapid to {} above the last depth (the control's clearance parameter, assumed)", c / 10, if c == 830 { "rapid back to R" } else { "short back-off" }, if self.metric { "0.5 mm" } else { "0.02 in" }));
                    }
                }
                840 | 740 => { self.feed_path(i, &[at(z)]); self.dwell(p); self.feed_path(i, &[at(r)]); }
                850 => { self.feed_path(i, &[at(z)]); self.feed_path(i, &[at(r)]); }
                890 => { self.feed_path(i, &[at(z)]); self.dwell(p); self.feed_path(i, &[at(r)]); }
                820 => { self.feed_path(i, &[at(z)]); self.dwell(p); }
                _ => { self.feed_path(i, &[at(z)]); }
            }
            let ret = if self.ret_r { r } else { init_z.max(r) };
            self.rapid_to(at(ret));
        }
    }

    /// Lathe G90 (turning), G92 (threading), G94 (facing) single cycles from
    /// the current (start) point to `t`.
    fn box_cycle(&mut self, i: usize, g: i32, t: [f64; 3], w: &[Word]) {
        let s = self.pos;
        let rr = get(w, 'R').map(|x| x.v * self.k()).unwrap_or(0.0);
        if g == 940 {
            self.rapid_to([s[0], 0.0, t[2] + rr]);
            self.feed_path(i, &[[t[0], 0.0, t[2]]]);
            self.feed_path(i, &[[t[0], 0.0, s[2]]]);
        } else {
            self.rapid_to([t[0] + rr, 0.0, s[2]]);
            if g == 920 {
                let pr = self.per_rev; self.per_rev = true;
                self.feed_path(i, &[[t[0], 0.0, t[2]]]);
                self.per_rev = pr;
                self.rapid_to([s[0], 0.0, t[2]]);
            } else {
                self.feed_path(i, &[[t[0], 0.0, t[2]]]);
                self.feed_path(i, &[[s[0], 0.0, t[2]]]);
            }
        }
        self.rapid_to(s);
    }

    fn lathe_cycle(&mut self, i: usize, g: i32, w: &[Word]) -> Flow {
        let pq = (get(w, 'P'), get(w, 'Q'));
        match g {
            700 | 710 | 720 | 730 => {
                let (Some(p), Some(q)) = pq else { return Flow::Next; }; // first block of the two-block format
                let (Some(&pi), Some(&qi)) = (self.labels.get(&(p.v as i64)), self.labels.get(&(q.v as i64))) else {
                    self.msg(i, 0, format!("G{} P{} Q{}: block N{} or N{} not found", g / 10, p.v, q.v, p.v, q.v)); return Flow::Next;
                };
                if qi < pi { self.msg(i, 0, "P block comes after the Q block"); return Flow::Next; }
                if g == 700 {
                    if self.depth > 0 { self.msg(i, 0, "G70 inside a G70 contour"); return Flow::Next; }
                    let start = self.pos;
                    self.depth += 1;
                    self.run(pi, qi);
                    self.depth -= 1;
                    self.step = self.sim.steps.len() as u32;
                    self.rapid_to(start);
                    self.once("g70", i, 2, "G70 is drawn as the finishing contour P..Q at its programmed feed, then a rapid back to the start point");
                    Flow::Next
                } else {
                    self.msg(i, 1, format!("G{} roughing not simulated yet: the contour N{}..N{} is drawn only when G70 runs it", g / 10, p.v, q.v));
                    if self.depth > 0 { Flow::Next } else { Flow::Jump(qi + 1) }
                }
            }
            _ => {
                if self.has_axes(w) { self.msg(i, 1, format!("canned cycle G{} not simulated yet; no move drawn", g / 10)); }
                Flow::Next
            }
        }
    }
}

fn setm(m: &mut Option<i32>, g: i32) -> Result<(), String> {
    if let Some(p) = *m { if p != g { return Err(format!("two motion codes in one block (G{} and G{})", fmt_g(p), fmt_g(g))); } }
    *m = Some(g); Ok(())
}
fn fmt_g(g: i32) -> String { if g % 10 == 0 { format!("{}", g / 10) } else { format!("{}.{}", g / 10, g % 10) } }
fn fnum(v: f64) -> String { crate::gcode::fnum(v, 4) }
fn dist(a: [f64; 3], b: [f64; 3]) -> f64 { ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt() }

fn grow(b: &mut Option<([f64; 3], [f64; 3])>, p: [f64; 3]) {
    match b {
        None => *b = Some((p, p)),
        Some((lo, hi)) => for i in 0..3 { lo[i] = lo[i].min(p[i]); hi[i] = hi[i].max(p[i]); },
    }
}

/// Run the backplot over a whole program.
pub fn simulate(text: &str, o: &Opts) -> Sim {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut sim = Sim { metric_out: o.metric_out, lathe: o.lathe, ..Default::default() };
    if !matches!(o.ctrl, Ctrl::Generic | Ctrl::Haas) {
        sim.msgs.push(Msg { line: 0, level: 0, text: format!("{} is not yet supported; choose Generic ISO / Fanuc-style or Haas", o.ctrl.label()) });
        sim.rapid_time = f64::NAN;
        return sim;
    }
    let mut labels = HashMap::new();
    for (i, l) in lines.iter().enumerate() {
        if let Ok(Lex::Words(w)) = lex(l) { if let Some(n) = w.iter().find(|x| x.c == 'N') { labels.entry(n.v as i64).or_insert(i); } }
    }
    let mut oo = *o;
    if !(oo.arc_tol > 0.0) { oo.arc_tol = if o.metric_out { 0.005 } else { 0.0002 }; }
    let mut m = M {
        o: oo, lines, labels, sim, once: HashSet::new(), pos: [0.0; 3], metric: o.default_metric, units_set: false, moved: false,
        abs: true, plane: if o.lathe { 18 } else { 17 }, motion: 0, cycle: None, cyc: Cyc { r: 0.0, z: 0.0, q: 0.0, p: 0.0, init_z: 0.0 },
        ret_r: false, per_rev: o.lathe, f_mm: 0.0, css: false, v_mpm: 0.0, rpm: 0.0, clamp: 0.0, tool: 0, time: 0.0, stopped: false, depth: 0, step: 0,
        untimed_lines: HashSet::new(), box_end: None,
    };
    let n = m.lines.len();
    if n > 0 { m.run(0, n - 1); }
    let k = m.out_k();
    let mut sim = m.sim;
    for s in sim.segs.iter_mut() { for j in 0..3 { s.a[j] *= k; s.b[j] *= k; } }
    for s in &sim.segs {
        grow(&mut sim.bbox, s.a); grow(&mut sim.bbox, s.b);
        if !s.rapid { grow(&mut sim.bbox_feed, s.a); grow(&mut sim.bbox_feed, s.b); }
    }
    sim.feed_dist *= k; sim.rapid_dist *= k;
    sim.rapid_time = if o.rapid > 0.0 { sim.rapid_dist / o.rapid * 60.0 } else { f64::NAN };
    // Add the rapid time into the cumulative step times.
    if o.rapid > 0.0 {
        let mut acc = 0.0; let mut si = 0;
        for st in sim.steps.iter_mut() {
            while si < st.seg1 as usize { let s = sim.segs[si]; if s.rapid { acc += dist(s.a, s.b) / o.rapid * 60.0; } si += 1; }
            st.time += acc;
        }
    }
    sim.msgs.sort_by_key(|m| (m.line, m.level));
    sim
}

/// Flat numeric results for the WebAssembly wrapper: 0..5 bbox min xyz and
/// max xyz (NaN when empty), 6..11 feed-only bbox, 12 feed distance, 13 rapid
/// distance, 14 feed time, 15 rapid time, 16 dwell time, 17 total time,
/// 18 untimed blocks, 19 errors, 20 warnings, 21 notes.
pub fn stats_flat(s: &Sim) -> Vec<f64> {
    let mut v = vec![];
    for b in [s.bbox, s.bbox_feed] {
        match b { Some((lo, hi)) => { v.extend(lo); v.extend(hi); } None => v.extend([f64::NAN; 6]) }
    }
    let cnt = |l: u8| s.msgs.iter().filter(|m| m.level == l).count() as f64;
    v.extend([s.feed_dist, s.rapid_dist, s.feed_time, s.rapid_time, s.dwell_time, s.total_time(), s.untimed as f64, cnt(0), cnt(1), cnt(2)]);
    v
}

/// Segments as 7 values each: rapid (1/0), x0, y0, z0, x1, y1, z1.
pub fn segs_flat(s: &Sim) -> Vec<f64> {
    s.segs.iter().flat_map(|g| [if g.rapid { 1.0 } else { 0.0 }, g.a[0], g.a[1], g.a[2], g.b[0], g.b[1], g.b[2]]).collect()
}

/// Steps as 10 values each: line, seg0, seg1, x, y, z, feed, per_rev, rpm, tool, time.
pub const STEP_W: usize = 11;
pub fn steps_flat(s: &Sim) -> Vec<f64> {
    s.steps.iter().flat_map(|t| [t.line as f64, t.seg0 as f64, t.seg1 as f64, t.pos[0], t.pos[1], t.pos[2], t.feed, if t.per_rev { 1.0 } else { 0.0 }, t.rpm, t.tool as f64, t.time]).collect()
}

/// Messages, one per line: "line<TAB>level<TAB>text".
pub fn msgs_text(s: &Sim) -> String {
    s.msgs.iter().map(|m| format!("{}\t{}\t{}", m.line, m.level, m.text.replace(['\n', '\t'], " "))).collect::<Vec<_>>().join("\n")
}

#[cfg(test)]
mod tests;
