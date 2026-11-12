//! Text engraving with stroke (single line) fonts.
//!
//! A stroke font draws each letter as a few open lines, which is what an
//! engraving cutter, a scriber or a drag tool follows. BenchMate ships the
//! Hershey fonts as SVG font files (data/fonts/hershey, with their own use
//! notice and acknowledgements inside each file). This module reads such a
//! file, lays a text out to a cap height on a straight line or round a
//! circle, and reports the strokes, their size and their length. The program
//! text is made in `gcode::gen_engrave`.
//!
//! Geometry only: scaling, a rotation, and the mapping of a length along a
//! circle to an angle (angle = length / radius).

use std::collections::HashMap;
use std::f64::consts::PI;

/// One letter: its advance (pen movement to the next letter) and strokes, in
/// font units, y up, baseline at y = 0.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Glyph { pub adv: f64, pub strokes: Vec<Vec<(f64, f64)>> }

#[derive(Clone, Debug, Default)]
pub struct Font {
    pub name: String,
    /// Height of the capital letters in font units, measured on the letter H
    /// (the files' own cap-height entry is a placeholder and is not used).
    pub cap: f64,
    /// Advance of a letter the file gives no advance for.
    pub adv: f64,
    pub glyphs: HashMap<char, Glyph>,
}

/// Straight pieces used for one curve of a letter (the Hershey letters are
/// straight lines; only some added accented letters have curves).
const CURVE_STEPS: usize = 10;

fn attr<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let b = tag.as_bytes();
    let mut from = 0;
    while let Some(i) = tag[from..].find(name) {
        let at = from + i;
        let end = at + name.len();
        let before_ok = at == 0 || b[at - 1].is_ascii_whitespace();
        if before_ok && end + 1 < b.len() && b[end] == b'=' && (b[end + 1] == b'"' || b[end + 1] == b'\'') {
            let q = b[end + 1] as char;
            let rest = &tag[end + 2..];
            return rest.find(q).map(|j| &rest[..j]);
        }
        from = end;
    }
    None
}

/// The text of an XML attribute with its character references resolved.
fn unescape(s: &str) -> String {
    let mut out = String::new();
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        match tail.find(';') {
            Some(j) => {
                let name = &tail[1..j];
                let ch = match name {
                    "amp" => Some('&'), "lt" => Some('<'), "gt" => Some('>'), "quot" => Some('"'), "apos" => Some('\''),
                    _ if name.starts_with("#x") || name.starts_with("#X") => u32::from_str_radix(&name[2..], 16).ok().and_then(char::from_u32),
                    _ if name.starts_with('#') => name[1..].parse::<u32>().ok().and_then(char::from_u32),
                    _ => None,
                };
                match ch { Some(c) => out.push(c), None => out.push_str(&tail[..=j]) }
                rest = &tail[j + 1..];
            }
            None => { out.push_str(tail); rest = ""; }
        }
    }
    out.push_str(rest);
    out
}

/// SVG path data to strokes. Handles M, L, H, V, C, Q and Z, absolute and
/// relative; curves are cut into straight pieces.
pub fn path_strokes(d: &str) -> Result<Vec<Vec<(f64, f64)>>, String> {
    // tokens: command letters and numbers (with sign and exponent)
    #[derive(Clone, Copy)]
    enum Tok { Cmd(char), Num(f64) }
    let mut toks = Vec::new();
    let b = d.as_bytes();
    let mut i = 0;
    while i < b.len() {
        let c = b[i] as char;
        if c.is_ascii_alphabetic() && c != 'e' && c != 'E' { toks.push(Tok::Cmd(c)); i += 1; }
        else if c.is_ascii_digit() || c == '-' || c == '+' || c == '.' {
            let s = i; i += 1;
            while i < b.len() {
                let k = b[i] as char;
                if k.is_ascii_digit() || k == '.' { i += 1; }
                else if (k == 'e' || k == 'E') && i + 1 < b.len() { i += 1; if b[i] == b'-' || b[i] == b'+' { i += 1; } }
                else { break; }
            }
            let v: f64 = d[s..i].parse().map_err(|_| format!("Font file: bad number \"{}\" in a letter", &d[s..i]))?;
            toks.push(Tok::Num(v));
        } else { i += 1; }
    }
    let mut out: Vec<Vec<(f64, f64)>> = Vec::new();
    let (mut cur, mut start) = ((0.0, 0.0), (0.0, 0.0));
    let mut cmd = ' ';
    let mut k = 0;
    let num = |k: &mut usize| -> Result<f64, String> {
        match toks.get(*k) { Some(Tok::Num(v)) => { *k += 1; Ok(*v) } _ => Err("Font file: a letter's outline ends in the middle of a move".to_string()) }
    };
    while k < toks.len() {
        if let Tok::Cmd(c) = toks[k] { cmd = c; k += 1; if c == 'Z' || c == 'z' {
            if let Some(s) = out.last_mut() { if s.last() != Some(&start) { s.push(start); } }
            cur = start; continue;
        } }
        let rel = cmd.is_ascii_lowercase();
        let (ox, oy) = if rel { cur } else { (0.0, 0.0) };
        match cmd.to_ascii_uppercase() {
            'M' => { let p = (ox + num(&mut k)?, oy + num(&mut k)?); out.push(vec![p]); cur = p; start = p; cmd = if rel { 'l' } else { 'L' }; }
            'L' => { let p = (ox + num(&mut k)?, oy + num(&mut k)?); push(&mut out, cur, p); cur = p; }
            'H' => { let p = (ox + num(&mut k)?, cur.1); push(&mut out, cur, p); cur = p; }
            'V' => { let p = (cur.0, oy + num(&mut k)?); push(&mut out, cur, p); cur = p; }
            'C' => {
                let p1 = (ox + num(&mut k)?, oy + num(&mut k)?); let p2 = (ox + num(&mut k)?, oy + num(&mut k)?); let p3 = (ox + num(&mut k)?, oy + num(&mut k)?);
                for s in 1..=CURVE_STEPS {
                    let t = s as f64 / CURVE_STEPS as f64; let u = 1.0 - t;
                    let p = (u * u * u * cur.0 + 3.0 * u * u * t * p1.0 + 3.0 * u * t * t * p2.0 + t * t * t * p3.0,
                             u * u * u * cur.1 + 3.0 * u * u * t * p1.1 + 3.0 * u * t * t * p2.1 + t * t * t * p3.1);
                    push_pt(&mut out, cur, p);
                }
                cur = p3;
            }
            'Q' => {
                let p1 = (ox + num(&mut k)?, oy + num(&mut k)?); let p2 = (ox + num(&mut k)?, oy + num(&mut k)?);
                for s in 1..=CURVE_STEPS {
                    let t = s as f64 / CURVE_STEPS as f64; let u = 1.0 - t;
                    let p = (u * u * cur.0 + 2.0 * u * t * p1.0 + t * t * p2.0, u * u * cur.1 + 2.0 * u * t * p1.1 + t * t * p2.1);
                    push_pt(&mut out, cur, p);
                }
                cur = p2;
            }
            other => return Err(format!("Font file: outline command {other} is not supported")),
        }
    }
    Ok(out)
}

fn push(out: &mut Vec<Vec<(f64, f64)>>, from: (f64, f64), p: (f64, f64)) { push_pt(out, from, p); }
fn push_pt(out: &mut Vec<Vec<(f64, f64)>>, from: (f64, f64), p: (f64, f64)) {
    if out.is_empty() { out.push(vec![from]); }
    out.last_mut().unwrap().push(p);
}

impl Font {
    /// Read an SVG font: the `font`, `font-face` and `glyph` elements.
    pub fn parse_svg(text: &str) -> Result<Font, String> {
        let mut f = Font::default();
        let mut rest = text;
        let mut seen_font = false;
        while let Some(i) = rest.find('<') {
            let tail = &rest[i + 1..];
            let end = match tail.find('>') { Some(e) => e, None => break };
            let tag = &tail[..end];
            rest = &tail[end + 1..];
            let name = tag.split(|c: char| c.is_whitespace() || c == '/').next().unwrap_or("");
            match name {
                "font" => { seen_font = true; if let Some(a) = attr(tag, "horiz-adv-x").and_then(|v| v.parse::<f64>().ok()) { f.adv = a; } }
                "font-face" => { if let Some(n) = attr(tag, "font-family") { f.name = unescape(n); } }
                "glyph" => {
                    let u = match attr(tag, "unicode") { Some(u) => unescape(u), None => continue };
                    let mut it = u.chars();
                    let ch = match (it.next(), it.next()) { (Some(c), None) => c, _ => continue }; // ligatures are left out
                    let adv = attr(tag, "horiz-adv-x").and_then(|v| v.parse::<f64>().ok()).unwrap_or(f.adv);
                    let strokes = match attr(tag, "d") { Some(d) => path_strokes(d)?, None => vec![] };
                    f.glyphs.insert(ch, Glyph { adv, strokes });
                }
                _ => {}
            }
        }
        if !seen_font || f.glyphs.is_empty() { return Err("This is not an SVG font file (no font or no letters found).".into()); }
        let top = |c: char| f.glyphs.get(&c).map(|g| g.strokes.iter().flatten().map(|p| p.1).fold(f64::NEG_INFINITY, f64::max)).filter(|v| *v > 0.0);
        f.cap = top('H').or_else(|| top('X')).or_else(|| top('E')).ok_or("Font file: no capital H, X or E to take the letter height from.")?;
        if !(f.adv > 0.0) { f.adv = f.cap * 0.6; }
        Ok(f)
    }
}

/// Where and how the text is laid out. Lengths in the caller's unit.
#[derive(Clone, Copy, Debug)]
pub struct Opts {
    /// Height of the capital letters.
    pub cap_h: f64,
    /// Extra space between letters (may be negative).
    pub spacing: f64,
    /// Baseline to baseline; not positive = 1.5 x cap height.
    pub line: f64,
    /// Width factor (1 = as drawn).
    pub stretch: f64,
    /// 0 left, 1 centre, 2 right: which point of each line sits on the anchor.
    pub align: u8,
    /// 0 straight line, 1 round a circle with the letter tops outward
    /// (reads clockwise), 2 round a circle with the letter tops inward
    /// (reads counter-clockwise).
    pub mode: u8,
    /// Straight: the anchor point on the baseline of the first line.
    /// Circle: the centre of the circle.
    pub x: f64, pub y: f64,
    /// Straight: direction of the baseline, degrees counter-clockwise from +X.
    /// Circle: where on the circle the anchor sits, degrees from +X.
    pub angle: f64,
    /// Circle: radius of the baseline of the first line.
    pub radius: f64,
    /// Mirror image (for a mould, a stamp or the back of clear material).
    pub mirror: bool,
}

#[derive(Clone, Debug, Default)]
pub struct Laid {
    pub strokes: Vec<Vec<(f64, f64)>>,
    /// Characters the font has no letter for (each once, in order met).
    pub missing: Vec<char>,
    /// Letters drawn.
    pub drawn: usize,
}

pub const MAX_CHARS: usize = 2000;

/// Longest piece of a letter stroke, as an angle, when a text is bent round
/// a circle: longer pieces are cut so they follow the circle.
const ARC_STEP_RAD: f64 = 0.05;

pub fn layout(font: &Font, text: &str, o: &Opts) -> Result<Laid, String> {
    if !(o.cap_h > 0.0) { return Err("Enter the letter height.".into()); }
    if !(o.stretch > 0.0) { return Err("The width factor must be greater than zero.".into()); }
    if !o.spacing.is_finite() || !o.x.is_finite() || !o.y.is_finite() || !o.angle.is_finite() { return Err("Enter the position and the angle as numbers.".into()); }
    if o.mode > 2 { return Err("Unknown layout.".into()); }
    if o.mode != 0 && !(o.radius > 0.0) { return Err("Enter the radius of the circle the text follows.".into()); }
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    if text.trim().is_empty() { return Err("Type the text to engrave.".into()); }
    if text.chars().count() > MAX_CHARS { return Err(format!("The text is too long ({MAX_CHARS} characters at most).")); }
    let s = o.cap_h / font.cap;
    let sx = s * o.stretch;
    let pitch = if o.line > 0.0 { o.line } else { 1.5 * o.cap_h };
    let mut laid = Laid::default();
    // Each line: strokes as (along, up) from the line's own start, then aligned.
    for (li, line) in text.split('\n').enumerate() {
        let mut pen = 0.0;
        let mut ls: Vec<Vec<(f64, f64)>> = Vec::new();
        let (mut lo, mut hi) = (f64::INFINITY, f64::NEG_INFINITY);
        for ch in line.chars() {
            match font.glyphs.get(&ch) {
                Some(g) => {
                    let mut letter = Vec::with_capacity(g.strokes.len());
                    for st in &g.strokes {
                        let pts: Vec<(f64, f64)> = st.iter().map(|p| (pen + p.0 * sx, p.1 * s)).collect();
                        for p in &pts { lo = lo.min(p.0); hi = hi.max(p.0); }
                        letter.push(pts);
                    }
                    let from = ls.last().and_then(|st| st.last().copied());
                    ls.extend(order_strokes(letter, from));
                    if !g.strokes.is_empty() { laid.drawn += 1; }
                    pen += g.adv * sx + o.spacing;
                }
                None => {
                    if !ch.is_control() && !laid.missing.contains(&ch) { laid.missing.push(ch); }
                    pen += font.adv * sx + o.spacing;
                }
            }
        }
        if ls.is_empty() { continue; }
        let shift = match o.align { 1 => -(lo + hi) / 2.0, 2 => -hi, _ => -lo };
        let width = hi - lo;
        let down = li as f64 * pitch;
        let m = if o.mirror { -1.0 } else { 1.0 };
        if o.mode == 0 {
            let (sn, cs) = (o.angle * PI / 180.0).sin_cos();
            for st in ls {
                laid.strokes.push(st.iter().map(|p| { let (u, v) = (m * (p.0 + shift), p.1 - down); (o.x + u * cs - v * sn, o.y + u * sn + v * cs) }).collect());
            }
        } else {
            // Letter tops outward: lines step inward. Tops inward: lines step outward.
            let r_line = if o.mode == 1 { o.radius - down } else { o.radius + down };
            if !(r_line > 0.0) { return Err("Too many lines for this radius: a line would fall on or past the centre.".into()); }
            if width > 2.0 * PI * r_line { return Err("The text is longer than the circle it follows. Use a larger radius, a smaller height or fewer letters.".into()); }
            let a0 = o.angle * PI / 180.0;
            let dir = if o.mode == 1 { -1.0 } else { 1.0 };
            let map = |u: f64, v: f64| {
                let th = a0 + dir * m * (u + shift) / r_line;
                let rr = if o.mode == 1 { r_line + v } else { r_line - v };
                (o.x + rr * th.cos(), o.y + rr * th.sin())
            };
            for st in ls {
                let mut out = Vec::with_capacity(st.len());
                for (i, p) in st.iter().enumerate() {
                    if i > 0 {
                        let q = st[i - 1];
                        let n = (((p.0 - q.0).abs() / r_line) / ARC_STEP_RAD).ceil().max(1.0) as usize;
                        for k in 1..n { let t = k as f64 / n as f64; out.push(map(q.0 + (p.0 - q.0) * t, q.1 + (p.1 - q.1) * t)); }
                    }
                    out.push(map(p.0, p.1));
                }
                laid.strokes.push(out);
            }
        }
    }
    if laid.strokes.is_empty() {
        return Err(if laid.missing.is_empty() { "Nothing to engrave: the text has only spaces.".into() } else { format!("Nothing to engrave: this font has no letter for {}.", laid.missing.iter().collect::<String>()) });
    }
    laid.strokes = join(laid.strokes, 1e-9 * o.cap_h);
    Ok(laid)
}

/// Put the strokes of one letter in an order that keeps the lifted moves
/// short: start with the stroke end nearest to `from` (the first stroke as
/// drawn when there is no `from`), then always go to the nearest end left,
/// running a stroke backwards when its far end is the nearer one. Letters
/// stay in reading order; only the strokes inside a letter move.
pub fn order_strokes(mut strokes: Vec<Vec<(f64, f64)>>, from: Option<(f64, f64)>) -> Vec<Vec<(f64, f64)>> {
    strokes.retain(|s| !s.is_empty());
    let mut out = Vec::with_capacity(strokes.len());
    let mut at = from;
    while !strokes.is_empty() {
        let (mut best, mut rev, mut bd) = (0usize, false, f64::INFINITY);
        if let Some(p) = at {
            for (i, st) in strokes.iter().enumerate() {
                let (d0, d1) = (dist(p, st[0]), dist(p, *st.last().unwrap()));
                if d0 < bd - 1e-12 { best = i; rev = false; bd = d0; }
                if d1 < bd - 1e-12 { best = i; rev = true; bd = d1; }
            }
        }
        let mut st = strokes.remove(best);
        if rev { st.reverse(); }
        at = st.last().copied();
        out.push(st);
    }
    out
}

/// Join strokes that start where the one before ended, and drop repeated
/// points, so the cutter is not lifted where the line carries on.
pub fn join(strokes: Vec<Vec<(f64, f64)>>, tol: f64) -> Vec<Vec<(f64, f64)>> {
    let near = |a: (f64, f64), b: (f64, f64)| (a.0 - b.0).abs() <= tol && (a.1 - b.1).abs() <= tol;
    let mut out: Vec<Vec<(f64, f64)>> = Vec::new();
    for st in strokes {
        let mut st2: Vec<(f64, f64)> = Vec::with_capacity(st.len());
        for p in st { if st2.last().map(|q| near(*q, p)) != Some(true) { st2.push(p); } }
        if st2.is_empty() { continue; }
        match out.last_mut() {
            Some(prev) if near(*prev.last().unwrap(), st2[0]) => prev.extend(st2.into_iter().skip(1)),
            _ => out.push(st2),
        }
    }
    out
}

fn dist(a: (f64, f64), b: (f64, f64)) -> f64 { ((a.0 - b.0).powi(2) + (a.1 - b.1).powi(2)).sqrt() }

/// Length cut: the sum of the stroke lengths.
pub fn cut_length(strokes: &[Vec<(f64, f64)>]) -> f64 { strokes.iter().map(|s| s.windows(2).map(|w| dist(w[0], w[1])).sum::<f64>()).sum() }

/// Length travelled above the work between strokes (end of one to the start of the next).
pub fn link_length(strokes: &[Vec<(f64, f64)>]) -> f64 {
    strokes.windows(2).map(|w| dist(*w[0].last().unwrap(), w[1][0])).sum()
}

/// (min x, min y, max x, max y) of the strokes.
pub fn bbox(strokes: &[Vec<(f64, f64)>]) -> Option<(f64, f64, f64, f64)> {
    let mut b = (f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY);
    for p in strokes.iter().flatten() { b = (b.0.min(p.0), b.1.min(p.1), b.2.max(p.0), b.3.max(p.1)); }
    if b.0.is_finite() { Some(b) } else { None }
}

/// Info for the screen: 0 strokes (cutter plunges), 1 length cut, 2 length
/// travelled between strokes, 3 min x, 4 min y, 5 max x, 6 max y, 7 letters
/// drawn, 8 characters the font does not have, 9 points.
pub fn info(l: &Laid, which: u32) -> f64 {
    let b = bbox(&l.strokes).unwrap_or((f64::NAN, f64::NAN, f64::NAN, f64::NAN));
    match which {
        0 => l.strokes.len() as f64, 1 => cut_length(&l.strokes), 2 => link_length(&l.strokes),
        3 => b.0, 4 => b.1, 5 => b.2, 6 => b.3, 7 => l.drawn as f64, 8 => l.missing.len() as f64,
        9 => l.strokes.iter().map(|s| s.len()).sum::<usize>() as f64,
        _ => f64::NAN,
    }
}

/// Strokes as a flat list: for each stroke its point count, then x, y pairs.
pub fn flat(l: &Laid) -> Vec<f64> {
    let mut v = Vec::new();
    for s in &l.strokes { v.push(s.len() as f64); for p in s { v.push(p.0); v.push(p.1); } }
    v
}

/// The strokes as a drawing on layer ENGRAVE (open polylines; a lone point
/// becomes a very short line so it is not lost).
pub fn doc(l: &Laid) -> crate::dxf::Doc {
    use crate::dxf::{Doc, Geo, Item};
    let mut d = Doc::new();
    let li = d.layer_index("ENGRAVE", 7);
    for s in &l.strokes {
        if s.len() >= 2 { d.items.push(Item { layer: li, geo: Geo::Poly { v: s.iter().map(|p| (p.0, p.1, 0.0)).collect(), closed: false } }); }
    }
    d
}

/// Width of the line a pointed (V) cutter leaves at a depth: the tip flat
/// plus 2 x depth x tan(half the included angle). NaN on bad input.
pub fn v_width(depth: f64, angle_deg: f64, flat: f64) -> f64 {
    if !(depth >= 0.0) || !(angle_deg > 0.0 && angle_deg < 180.0) || !(flat >= 0.0) { return f64::NAN; }
    flat + 2.0 * depth * (angle_deg * PI / 360.0).tan()
}

/// Depth at which a pointed cutter leaves a line of a given width (the
/// inverse of `v_width`). NaN when the width is not more than the tip flat.
pub fn v_depth(width: f64, angle_deg: f64, flat: f64) -> f64 {
    if !(angle_deg > 0.0 && angle_deg < 180.0) || !(flat >= 0.0) || !(width > flat) { return f64::NAN; }
    (width - flat) / (2.0 * (angle_deg * PI / 360.0).tan())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    /// A small font in the same form as the shipped files: H is two posts
    /// and a bar, I one post, a dot, and a letter with a curve.
    const MINI: &str = r#"<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><metadata>Test font</metadata><defs>
<font id="Mini" horiz-adv-x="400" ><font-face font-family="Mini &amp; test" units-per-em="1000" cap-height="500" />
<missing-glyph horiz-adv-x="400" />
<glyph unicode=" " glyph-name="space" horiz-adv-x="400" />
<glyph unicode="H" glyph-name="H" horiz-adv-x="700" d="M 100 0 L 100 700 M 500 0 L 500 700 M 100 350 L 500 350" />
<glyph unicode="I" glyph-name="I" horiz-adv-x="300" d="M 100 0 L 100 700" />
<glyph unicode="L" glyph-name="L" horiz-adv-x="500" d="M 100 700 L 100 0 L 400 0" />
<glyph unicode="&#x22;" glyph-name="quotedbl" horiz-adv-x="300" d="M 100 700 L 100 500 M 200 700 L 200 500" />
<glyph unicode="&amp;" glyph-name="ampersand" horiz-adv-x="300" d="M 100 1e+02 L 2e2 100 Z" />
<glyph unicode="&#xb0;" glyph-name="degree" horiz-adv-x="300" d="M 100 600 C 100 700 200 700 200 600" />
<glyph unicode="fi" glyph-name="fi" horiz-adv-x="300" d="M 0 0 L 1 1" />
</font></defs></svg>"#;

    fn mini() -> Font { Font::parse_svg(MINI).unwrap() }
    fn opts(h: f64) -> Opts { Opts { cap_h: h, spacing: 0.0, line: 0.0, stretch: 1.0, align: 0, mode: 0, x: 0.0, y: 0.0, angle: 0.0, radius: 0.0, mirror: false } }

    #[test]
    fn reads_an_svg_font() {
        let f = mini();
        assert_eq!(f.name, "Mini & test");
        close(f.cap, 700.0, 1e-12); // measured on the H, not the cap-height entry
        close(f.adv, 400.0, 1e-12);
        assert_eq!(f.glyphs.len(), 7); // the two-letter ligature is left out
        assert_eq!(f.glyphs[&'H'].strokes.len(), 3);
        assert_eq!(f.glyphs[&'"'].strokes.len(), 2);
        // exponent numbers and a closed outline
        assert_eq!(f.glyphs[&'&'].strokes[0], vec![(100.0, 100.0), (200.0, 100.0), (100.0, 100.0)]);
        // a curve becomes straight pieces that start and end where the curve does; its top is at 3/4 of the control height
        let c = &f.glyphs[&'\u{b0}'].strokes[0];
        assert_eq!(c.len(), CURVE_STEPS + 1);
        assert_eq!((c[0], c[CURVE_STEPS]), ((100.0, 600.0), (200.0, 600.0)));
        close(c[CURVE_STEPS / 2].1, 675.0, 1e-9);
        assert!(Font::parse_svg("<svg></svg>").is_err());
        assert!(Font::parse_svg("not a font").is_err());
    }

    #[test]
    fn path_commands() {
        assert_eq!(path_strokes("M 0 0 L 10 0 10 5").unwrap(), vec![vec![(0.0, 0.0), (10.0, 0.0), (10.0, 5.0)]]);
        assert_eq!(path_strokes("m 1 1 l 2 0 v 3 h -2 z").unwrap(), vec![vec![(1.0, 1.0), (3.0, 1.0), (3.0, 4.0), (1.0, 4.0), (1.0, 1.0)]]);
        assert_eq!(path_strokes("M0,0L1,1M2,2L3,3").unwrap().len(), 2);
        assert!(path_strokes("M 0 0 A 1 1 0 0 0 2 2").is_err());
        assert!(path_strokes("M 0 0 L 1").is_err());
        assert_eq!(path_strokes("").unwrap().len(), 0);
    }

    #[test]
    fn straight_layout_is_to_size() {
        let f = mini();
        // cap height 7: one font unit is 0.01
        let l = layout(&f, "HI", &opts(7.0)).unwrap();
        assert_eq!(l.drawn, 2);
        // left aligned: the ink starts at x = 0 (the H's left post, 1.0 into its cell)
        let b = bbox(&l.strokes).unwrap();
        close(b.0, 0.0, 1e-12); close(b.1, 0.0, 1e-12); close(b.3, 7.0, 1e-12);
        // I post at pen 7.0 + 1.0, less the 1.0 shift
        close(b.2, 7.0, 1e-12);
        // H: 7 + 7 + 4, I: 7
        close(cut_length(&l.strokes), 25.0, 1e-12);
        assert_eq!(l.strokes.len(), 4);
        // strokes inside a letter are taken nearest end first: left post up, the bar (3.5 down the post),
        // the right post from its foot (3.5 from the bar end; a tie goes to the end met first), then the I from its top (3 across)
        assert_eq!(l.strokes, vec![vec![(0.0, 0.0), (0.0, 7.0)], vec![(0.0, 3.5), (4.0, 3.5)], vec![(4.0, 0.0), (4.0, 7.0)], vec![(7.0, 7.0), (7.0, 0.0)]]);
        close(link_length(&l.strokes), 3.5 + 3.5 + 3.0, 1e-12);
        // spacing and stretch: stretch 2 doubles every x; spacing adds once between the two letters
        let mut o = opts(7.0); o.stretch = 2.0; o.spacing = 0.5;
        let b2 = bbox(&layout(&f, "HI", &o).unwrap().strokes).unwrap();
        close(b2.2, 14.0 + 0.5, 1e-12);
        // centre and right
        o = opts(7.0); o.align = 1; let bc = bbox(&layout(&f, "HI", &o).unwrap().strokes).unwrap(); close(bc.0, -3.5, 1e-12); close(bc.2, 3.5, 1e-12);
        o.align = 2; let br = bbox(&layout(&f, "HI", &o).unwrap().strokes).unwrap(); close(br.0, -7.0, 1e-12); close(br.2, 0.0, 1e-12);
    }

    #[test]
    fn lines_angle_position_and_mirror() {
        let f = mini();
        // two lines: the second baseline is 1.5 x cap height lower by default, or the pitch given
        let l = layout(&f, "I\nI", &opts(10.0)).unwrap();
        let b = bbox(&l.strokes).unwrap(); close(b.1, -15.0, 1e-12); close(b.3, 10.0, 1e-12);
        let mut o = opts(10.0); o.line = 12.0;
        close(bbox(&layout(&f, "I\r\nI", &o).unwrap().strokes).unwrap().1, -12.0, 1e-12);
        // 90 degrees about the anchor, then moved: the I post runs along -X from the anchor
        o = opts(10.0); o.angle = 90.0; o.x = 100.0; o.y = 50.0;
        let l = layout(&f, "I", &o).unwrap();
        close(l.strokes[0][0].0, 100.0, 1e-9); close(l.strokes[0][0].1, 50.0, 1e-9);
        close(l.strokes[0][1].0, 90.0, 1e-9); close(l.strokes[0][1].1, 50.0, 1e-9);
        // mirror: the L's foot points to -X, and the outline is the mirror image point for point
        let a = layout(&f, "L", &opts(7.0)).unwrap().strokes; let mut om = opts(7.0); om.mirror = true;
        let m = layout(&f, "L", &om).unwrap().strokes;
        assert_eq!(a.len(), 1); assert_eq!(m.len(), 1);
        for (p, q) in a[0].iter().zip(m[0].iter()) { close(p.0, -q.0, 1e-12); close(p.1, q.1, 1e-12); }
        close(a[0][2].0, 3.0, 1e-12);
    }

    #[test]
    fn round_a_circle() {
        let f = mini();
        // tops outward, anchored at the top of a radius 50 circle, centred: the I post is radial at 90 degrees
        let mut o = opts(7.0); o.mode = 1; o.radius = 50.0; o.angle = 90.0; o.align = 1; o.x = 10.0; o.y = 20.0;
        let l = layout(&f, "I", &o).unwrap();
        close(l.strokes[0][0].0, 10.0, 1e-9); close(l.strokes[0][0].1, 70.0, 1e-9);
        close(l.strokes[0][1].0, 10.0, 1e-9); close(l.strokes[0][1].1, 77.0, 1e-9);
        // "HI" left aligned at the top reads clockwise: the I sits at a smaller angle than the H,
        // and the distance along the baseline (7.0 between the posts) is the arc length
        o.align = 0; o.x = 0.0; o.y = 0.0;
        let l = layout(&f, "HI", &o).unwrap();
        let ang = |p: (f64, f64)| p.1.atan2(p.0);
        let h_post = l.strokes[0][0]; let i_post = *l.strokes.last().unwrap().first().unwrap();
        close(ang(h_post), PI / 2.0, 1e-12);
        close((ang(h_post) - ang(i_post)) * 50.0, 7.0, 1e-9);
        // every baseline point is on the radius; cap tops are on radius + cap height
        close(h_post.0.hypot(h_post.1), 50.0, 1e-9);
        close(l.strokes[0][1].0.hypot(l.strokes[0][1].1), 57.0, 1e-9);
        // the H's bar (4.0 long at half height) is cut into pieces that stay on radius 53.5
        let bar = &l.strokes[1];
        assert!(bar.len() > 2);
        for p in bar { close(p.0.hypot(p.1), 53.5, 1e-9); }
        // tops inward, anchored at the bottom: reads counter-clockwise (left to right at the bottom), tops towards the centre
        o.mode = 2; o.angle = 270.0;
        let l = layout(&f, "HI", &o).unwrap();
        let h_post = l.strokes[0][0]; let i_post = *l.strokes.last().unwrap().first().unwrap();
        close(h_post.0, 0.0, 1e-9); close(h_post.1, -50.0, 1e-9);
        assert!(i_post.0 > h_post.0);
        close(l.strokes[0][1].0.hypot(l.strokes[0][1].1), 43.0, 1e-9);
        // second line: inward for tops outward, outward for tops inward
        o.mode = 1; o.angle = 90.0; o.line = 10.0;
        let l = layout(&f, "I\nI", &o).unwrap();
        close(l.strokes[1].iter().map(|p| p.0.hypot(p.1)).fold(f64::INFINITY, f64::min), 40.0, 1e-9);
        // refusals
        o.radius = 0.0; assert!(layout(&f, "I", &o).is_err());
        o.radius = 0.5; o.line = 0.0; assert!(layout(&f, "HHHHHHHH", &o).unwrap_err().contains("longer than the circle"));
        o.radius = 5.0; o.line = 10.0; assert!(layout(&f, "I\nI", &o).unwrap_err().contains("centre"));
    }

    #[test]
    fn missing_letters_and_refusals() {
        let f = mini();
        let l = layout(&f, "HxIx y", &opts(7.0)).unwrap();
        assert_eq!(l.missing, vec!['x', 'y']);
        assert_eq!(l.drawn, 2);
        // a missing letter still takes the default advance (4.0), so the I is 7 + 4 further on
        let i_post = *l.strokes.last().unwrap().first().unwrap();
        close(i_post.0, 7.0 + 4.0 + 1.0 - 1.0, 1e-12);
        assert!(layout(&f, "   ", &opts(7.0)).is_err());
        assert!(layout(&f, "xyz", &opts(7.0)).unwrap_err().contains("xyz"));
        assert!(layout(&f, "H", &opts(0.0)).is_err());
        let mut o = opts(7.0); o.stretch = 0.0; assert!(layout(&f, "H", &o).is_err());
        assert!(layout(&f, &"H".repeat(MAX_CHARS + 1), &opts(7.0)).is_err());
    }

    #[test]
    fn orders_strokes_nearest_end_first() {
        // three strokes of one letter, drawn far end first in the font: from (0, 0) the nearest end is the
        // far end of the second stroke, so it is run backwards; then the third; then the first
        let st = vec![vec![(10.0, 0.0), (10.0, 5.0)], vec![(3.0, 0.0), (1.0, 0.0)], vec![(4.0, 0.0), (4.0, 5.0)]];
        let o = order_strokes(st.clone(), Some((0.0, 0.0)));
        assert_eq!(o, vec![vec![(1.0, 0.0), (3.0, 0.0)], vec![(4.0, 0.0), (4.0, 5.0)], vec![(10.0, 5.0), (10.0, 0.0)]]);
        // with nowhere to come from, the first stroke is taken as drawn
        assert_eq!(order_strokes(st.clone(), None)[0], st[0]);
        // nothing is lost or changed in length
        close(cut_length(&o), cut_length(&st), 1e-12);
        // and on a real word the lifted moves get shorter than the font's own order
        assert!(link_length(&o) < link_length(&st));
    }

    #[test]
    fn joins_strokes_that_carry_on() {
        let s = join(vec![vec![(0.0, 0.0), (1.0, 0.0)], vec![(1.0, 0.0), (1.0, 1.0)], vec![(5.0, 5.0), (5.0, 5.0), (6.0, 5.0)]], 1e-9);
        assert_eq!(s, vec![vec![(0.0, 0.0), (1.0, 0.0), (1.0, 1.0)], vec![(5.0, 5.0), (6.0, 5.0)]]);
    }

    #[test]
    fn flat_list_and_drawing() {
        let f = mini();
        let l = layout(&f, "L", &opts(7.0)).unwrap();
        assert_eq!(flat(&l), vec![3.0, 0.0, 7.0, 0.0, 0.0, 3.0, 0.0]);
        assert_eq!(info(&l, 0), 1.0); close(info(&l, 1), 10.0, 1e-12); assert_eq!(info(&l, 9), 3.0);
        let d = doc(&l);
        assert_eq!(d.layers[0].0, "ENGRAVE");
        assert_eq!(d.items.len(), 1);
    }

    #[test]
    fn v_cutter_line_width() {
        // 90 degree point: the line is twice as wide as it is deep
        close(v_width(0.2, 90.0, 0.0), 0.4, 1e-12);
        // 60 degree point with a 0.1 flat at 0.25 deep: 0.1 + 0.5 tan 30
        close(v_width(0.25, 60.0, 0.1), 0.1 + 0.5 * (PI / 6.0).tan(), 1e-12);
        close(v_depth(v_width(0.25, 60.0, 0.1), 60.0, 0.1), 0.25, 1e-12);
        // published values: FlatCAM wiki groove table, 60 degrees, 0.1 flat, 0.05 deep: 0.158
        close(v_width(0.05, 60.0, 0.1), 0.158, 0.0005);
        // Calculator Academy chamfer example: 82 degrees, 5.0 at the tip to 9.4 at the face, 2.53 deep
        close(v_depth(9.4, 82.0, 5.0), 2.53, 0.005);
        close(v_width(2.53, 82.0, 5.0), 9.4, 0.01);
        assert!(v_width(0.2, 180.0, 0.0).is_nan());
        assert!(v_depth(0.1, 60.0, 0.1).is_nan());
    }
}
