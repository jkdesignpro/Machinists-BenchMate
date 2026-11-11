//! G-code tidy tools: renumber, strip, re-space, convert between inch and
//! millimetre programs, and tell a lathe program from a mill program.
//!
//! These work on the text of a program, word by word, and leave everything
//! they do not understand exactly as it was. Macro statements (anything with
//! `#`, `[`, `=` or a keyword such as IF or GOTO) are never re-spaced or
//! converted; only their sequence number and a literal `GOTO n` are followed
//! when the program is renumbered.
//!
//! What the rules rest on (docs/sources.md, "G-code tidy tools"):
//!
//! * A word without a decimal point is read by the control either as whole
//!   units ("pocket calculator" type) or in least input increments (standard
//!   type), depending on a parameter [FANUC-DPI]; on Haas the same choice is
//!   Setting 162. The least input increment is typically 0.001 mm or
//!   0.0001 in [MMS-LII]. The converter therefore has to be told which.
//! * The lathe cycles G70 to G73 name their profile blocks with P and Q
//!   (sequence numbers); G74, G75 and the two-line G76 take P and Q as whole
//!   numbers in least input increments, with no decimal point [CTC-G76].
//! * 1 in = 25.4 mm exactly; 1 ft = 0.3048 m exactly (surface speed under
//!   G96).

use crate::gsim::Msg;
use std::collections::{HashMap, HashSet};

const MM: f64 = 25.4;
const FT_PER_M: f64 = 1.0 / 0.3048;

#[derive(Clone, Debug, PartialEq)]
enum Tok {
    /// A letter with a number: `raw` is the text as written (it may hold
    /// spaces between the letter and the number).
    Word { c: char, num: String, raw: String },
    /// `( ... )` or `; ...` to the end of the line.
    Comment(String),
    /// Anything else: `%`, `/`, `,`, macro text, a letter with no number.
    Text(String),
    Space(String),
}

fn is_num_start(b: &[char], i: usize) -> bool {
    let mut j = i;
    if j < b.len() && (b[j] == '+' || b[j] == '-') { j += 1; }
    let mut digits = false;
    while j < b.len() && (b[j].is_ascii_digit() || b[j] == '.') { if b[j].is_ascii_digit() { digits = true; } j += 1; }
    digits
}

fn take_num(b: &[char], i: &mut usize) -> String {
    let s0 = *i;
    if *i < b.len() && (b[*i] == '+' || b[*i] == '-') { *i += 1; }
    let mut dec = false;
    while *i < b.len() && (b[*i].is_ascii_digit() || (b[*i] == '.' && !dec)) { if b[*i] == '.' { dec = true; } *i += 1; }
    b[s0..*i].iter().collect()
}

fn tokens(line: &str) -> Vec<Tok> {
    let b: Vec<char> = line.chars().filter(|c| *c != '\r').collect();
    let mut out = vec![];
    let mut i = 0;
    while i < b.len() {
        let c = b[i];
        if c == '(' {
            let s0 = i; let mut depth = 0;
            while i < b.len() { if b[i] == '(' { depth += 1; } else if b[i] == ')' { depth -= 1; if depth == 0 { i += 1; break; } } i += 1; }
            out.push(Tok::Comment(b[s0..i].iter().collect()));
        } else if c == ';' {
            out.push(Tok::Comment(b[i..].iter().collect())); i = b.len();
        } else if c.is_whitespace() {
            let s0 = i; while i < b.len() && b[i].is_whitespace() { i += 1; }
            out.push(Tok::Space(b[s0..i].iter().collect()));
        } else if c.is_ascii_alphabetic() {
            let s0 = i; while i < b.len() && b[i].is_ascii_alphabetic() { i += 1; }
            if i - s0 == 1 {
                let mut j = i; while j < b.len() && b[j] == ' ' { j += 1; }
                if is_num_start(&b, j) {
                    let mut k = j; let num = take_num(&b, &mut k);
                    out.push(Tok::Word { c: c.to_ascii_uppercase(), num, raw: b[s0..k].iter().collect() });
                    i = k; continue;
                }
            }
            out.push(Tok::Text(b[s0..i].iter().collect()));
        } else if c.is_ascii_digit() || c == '.' {
            let mut k = i; let n = take_num(&b, &mut k);
            if k == i { k = i + 1; out.push(Tok::Text(c.to_string())); } else { out.push(Tok::Text(n)); }
            i = k;
        } else {
            out.push(Tok::Text(c.to_string())); i += 1;
        }
    }
    out
}

fn is_macro(t: &[Tok]) -> bool {
    t.iter().any(|x| match x {
        Tok::Text(s) => s.contains(['#', '[', ']', '=']) || (s.len() >= 2 && s.chars().all(|c| c.is_ascii_alphabetic())),
        _ => false,
    })
}

fn has_code(t: &[Tok]) -> bool { t.iter().any(|x| matches!(x, Tok::Word { .. } | Tok::Text(_))) }
fn is_percent(t: &[Tok]) -> bool { t.iter().find(|x| !matches!(x, Tok::Space(_))).is_some_and(|x| matches!(x, Tok::Text(s) if s == "%")) }

/// The line names a program: O1234 or :1234 first.
fn is_program_line(t: &[Tok]) -> bool {
    match t.iter().find(|x| !matches!(x, Tok::Space(_))) {
        Some(Tok::Word { c: 'O', .. }) => true,
        Some(Tok::Text(s)) => s == ":",
        _ => false,
    }
}

/// Index of the sequence number word: the first word of the line, after an
/// optional block skip `/`.
fn n_index(t: &[Tok]) -> Option<usize> {
    for (i, x) in t.iter().enumerate() {
        match x {
            Tok::Space(_) => {}
            Tok::Text(s) if s == "/" => {}
            Tok::Word { c: 'N', .. } => return Some(i),
            _ => return None,
        }
    }
    None
}

fn word_int(num: &str) -> Option<i64> { if num.contains('.') { None } else { num.parse::<i64>().ok() } }

/// G codes on a line, times ten (G76 = 760, G72.1 = 721).
fn g_codes(t: &[Tok]) -> Vec<i32> {
    t.iter().filter_map(|x| match x { Tok::Word { c: 'G', num, .. } => num.parse::<f64>().ok().map(|v| (v * 10.0).round() as i32), _ => None }).collect()
}
fn m_codes(t: &[Tok]) -> Vec<i32> {
    t.iter().filter_map(|x| match x { Tok::Word { c: 'M', num, .. } => num.parse::<f64>().ok().map(|v| v.round() as i32), _ => None }).collect()
}
fn has_word(t: &[Tok], c: char) -> bool { t.iter().any(|x| matches!(x, Tok::Word { c: k, .. } if *k == c)) }

/// Where a block names other blocks by sequence number: token indexes of the
/// numbers. P and Q of the lathe cycles G70 to G73, P of M97 and M99, and a
/// literal number after GOTO.
fn ref_indexes(t: &[Tok], lathe: bool) -> Vec<usize> {
    let g = g_codes(t); let m = m_codes(t);
    let cyc = lathe && g.iter().any(|x| [700, 710, 720, 730].contains(x));
    let sub = m.iter().any(|x| *x == 97 || *x == 99);
    let mut out = vec![];
    for (i, x) in t.iter().enumerate() {
        match x {
            Tok::Word { c: 'P', num, .. } if (cyc || sub) && word_int(num).is_some() => out.push(i),
            Tok::Word { c: 'Q', num, .. } if cyc && word_int(num).is_some() => out.push(i),
            Tok::Text(s) if s.eq_ignore_ascii_case("GOTO") => {
                let mut j = i + 1; while j < t.len() && matches!(t[j], Tok::Space(_)) { j += 1; }
                if let Some(Tok::Text(n)) = t.get(j) { if n.parse::<i64>().is_ok() { out.push(j); } }
            }
            _ => {}
        }
    }
    out
}

fn ref_value(x: &Tok) -> Option<i64> {
    match x { Tok::Word { num, .. } => word_int(num), Tok::Text(n) => n.parse::<i64>().ok(), _ => None }
}

/// What to do with a program. `numbers`: 0 leave, 1 renumber, 2 remove.
/// `spacing`: 0 leave, 1 one space between words, 2 no spaces.
#[derive(Clone, Copy, Debug)]
pub struct TidyOpts {
    pub numbers: u8,
    pub start: u32,
    pub step: u32,
    /// Renumber: give a number to every block, not only to the blocks that have one.
    pub all: bool,
    pub comments: bool,
    pub blank: bool,
    pub spacing: u8,
    pub upper: bool,
    pub lathe: bool,
}

impl Default for TidyOpts {
    fn default() -> Self { TidyOpts { numbers: 0, start: 10, step: 10, all: false, comments: false, blank: false, spacing: 0, upper: false, lathe: false } }
}

#[derive(Clone, Debug, Default)]
pub struct TidyOut { pub text: String, pub msgs: Vec<Msg>, pub changed: usize }

fn render(t: &[Tok]) -> String {
    t.iter().map(|x| match x { Tok::Word { raw, .. } => raw.as_str(), Tok::Comment(s) | Tok::Text(s) | Tok::Space(s) => s.as_str() }).collect()
}

fn word(c: char, num: &str) -> Tok { Tok::Word { c, num: num.to_string(), raw: format!("{}{}", c, num) } }

/// Join the tokens of an ordinary block with one space, or none, between them.
fn respace(t: &[Tok], sep: &str) -> String {
    let mut out = String::new();
    let mut glue = true; // nothing before the first token, nothing after '/' or ','
    for x in t {
        // a word keeps the case of its letter and loses any space inside it
        let s = match x { Tok::Space(_) => continue, Tok::Word { num, raw, .. } => format!("{}{}", &raw[..1], num), Tok::Comment(s) | Tok::Text(s) => s.clone() };
        let comma = s == ",";
        if !glue && !comma { out.push_str(sep); }
        out.push_str(&s);
        glue = s == "/" || comma;
    }
    out
}

/// Renumber, strip and re-space a program. Lines keep their order; the
/// result has one `\n` between lines.
pub fn tidy(text: &str, o: &TidyOpts) -> TidyOut {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut toks: Vec<Vec<Tok>> = lines.iter().map(|l| tokens(l)).collect();
    let mut msgs: Vec<Msg> = vec![];
    let step = o.step.max(1);

    // Blocks that other blocks name by number.
    let mut labels: HashMap<i64, usize> = HashMap::new();
    for (i, t) in toks.iter().enumerate() {
        if let Some(k) = n_index(t) {
            if let Some(n) = ref_value(&t[k]) {
                if labels.contains_key(&n) { msgs.push(Msg { line: i as u32 + 1, level: 1, text: format!("N{} is used more than once: blocks that name it are pointed at the first one", n) }); }
                else { labels.insert(n, i); }
            }
        }
    }
    let mut targets: HashSet<i64> = HashSet::new();
    for t in &toks { for k in ref_indexes(t, o.lathe) { if let Some(n) = ref_value(&t[k]) { targets.insert(n); } } }

    // New numbers.
    let mut map: HashMap<i64, i64> = HashMap::new();
    if o.numbers == 1 {
        let mut next = o.start as i64;
        let mut new_of_line: HashMap<usize, i64> = HashMap::new();
        for (i, t) in toks.iter().enumerate() {
            let has_n = n_index(t).is_some();
            let wants = has_n || (o.all && has_code(t) && !is_percent(t) && !is_program_line(t));
            if !wants { continue; }
            new_of_line.insert(i, next);
            if let Some(k) = n_index(t) { if let Some(n) = ref_value(&t[k]) { if labels.get(&n) == Some(&i) { map.insert(n, next); } } }
            next += step as i64;
        }
        if next - step as i64 > 99_999 { msgs.push(Msg { line: 0, level: 1, text: format!("The last number is N{}: many controls take five digits at most. Use a smaller step", next - step as i64) }); }
        // References first (they read the old numbers), then the numbers themselves.
        for (i, t) in toks.iter_mut().enumerate() {
            for k in ref_indexes(t, o.lathe) {
                let old = match ref_value(&t[k]) { Some(v) => v, None => continue };
                match map.get(&old) {
                    Some(new) => { t[k] = match &t[k] { Tok::Word { c, .. } => word(*c, &new.to_string()), _ => Tok::Text(new.to_string()) }; }
                    None => msgs.push(Msg { line: i as u32 + 1, level: 1, text: format!("This block names N{}, which is not in the program: left as it is", old) }),
                }
            }
        }
        for (i, t) in toks.iter_mut().enumerate() {
            let new = match new_of_line.get(&i) { Some(v) => *v, None => continue };
            match n_index(t) {
                Some(k) => t[k] = word('N', &new.to_string()),
                None => {
                    // after leading spaces and a block skip
                    let mut at = 0;
                    while at < t.len() && (matches!(t[at], Tok::Space(_)) || matches!(&t[at], Tok::Text(s) if s == "/")) { at += 1; }
                    t.insert(at, word('N', &new.to_string()));
                    if o.spacing != 2 { t.insert(at + 1, Tok::Space(" ".into())); }
                }
            }
        }
    } else if o.numbers == 2 {
        let mut kept: Vec<i64> = vec![];
        for t in toks.iter_mut() {
            if let Some(k) = n_index(t) {
                let n = ref_value(&t[k]);
                if n.is_some_and(|n| targets.contains(&n)) { kept.push(n.unwrap()); continue; }
                t.remove(k);
                if matches!(t.get(k), Some(Tok::Space(_))) { t.remove(k); }
            }
        }
        if !kept.is_empty() {
            kept.sort(); kept.dedup();
            msgs.push(Msg { line: 0, level: 2, text: format!("Kept {}: another block names {} by number", kept.iter().map(|n| format!("N{}", n)).collect::<Vec<_>>().join(", "), if kept.len() == 1 { "it" } else { "them" }) });
        }
    }

    let mut out: Vec<String> = vec![];
    let mut changed = 0;
    for (i, t) in toks.iter_mut().enumerate() {
        let before = lines[i].trim_end_matches('\r');
        let was_blank = !t.iter().any(|x| !matches!(x, Tok::Space(_)));
        if o.comments {
            let keep_first = is_program_line(t);
            let mut seen = false;
            t.retain(|x| match x { Tok::Comment(_) => { let k = keep_first && !seen; seen = true; k } _ => true });
        }
        if o.upper {
            for x in t.iter_mut() {
                match x {
                    Tok::Word { c, num, raw } => { *raw = if raw.len() == num.len() + 1 { format!("{}{}", c, num) } else { raw.to_ascii_uppercase() }; }
                    Tok::Text(s) => *s = s.to_ascii_uppercase(),
                    _ => {}
                }
            }
        }
        let mac = is_macro(t);
        let s = if o.spacing == 0 || mac || is_percent(t) { render(t).trim_end().to_string() } else { respace(t, if o.spacing == 1 { " " } else { "" }) };
        let now_blank = s.trim().is_empty();
        if now_blank && ((o.blank) || (o.comments && !was_blank)) { changed += 1; continue; }
        if s != before { changed += 1; }
        out.push(s);
    }
    msgs.sort_by_key(|m| (m.line, m.level));
    TidyOut { text: out.join("\n"), msgs, changed }
}

/// A number for a program word: up to `dp` decimals, trailing zeros dropped,
/// the decimal point kept (`50.`, `0.5`, `-2.25`).
pub fn word_num(v: f64, dp: usize) -> String {
    let mut s = format!("{:.*}", dp, v);
    if s.contains('.') { while s.ends_with('0') { s.pop(); } } else { s.push('.'); }
    if s.starts_with('-') && s[1..].chars().all(|c| c == '0' || c == '.') { s.remove(0); }
    s
}

/// Convert a length between millimetres and inches: `to_metric` multiplies by 25.4.
pub fn convert_length(v: f64, to_metric: bool) -> f64 { if to_metric { v * MM } else { v / MM } }
/// Convert a surface speed between m/min and ft/min.
pub fn convert_surface_speed(v: f64, to_metric: bool) -> f64 { if to_metric { v / FT_PER_M } else { v * FT_PER_M } }
/// Convert a whole number of least input increments (0.001 mm or 0.0001 in)
/// to the other unit's increments, rounded to a whole number.
pub fn convert_increments(n: f64, to_metric: bool) -> f64 {
    if to_metric { (n * 0.0001 * MM / 0.001).round() } else { (n * 0.001 / MM / 0.0001).round() }
}

#[derive(Clone, Copy, PartialEq)]
enum Kind { Len, Feed, Incr, LenOrIncr, Css, Keep }

/// Convert a program between inch and millimetre units. `int_mode` says how
/// a length without a decimal point is read: 0 as whole units, 1 in least
/// input increments (0.0001 in or 0.001 mm). Every converted length is
/// written with a decimal point.
pub fn convert_units(text: &str, to_metric: bool, lathe: bool, int_mode: u8) -> TidyOut {
    let (from, to, g_from, g_to) = if to_metric { ("inch", "mm", 200, 210) } else { ("mm", "inch", 210, 200) };
    let dp_len = if to_metric { 3 } else { 4 };
    let mut msgs: Vec<Msg> = vec![];
    let mut out: Vec<String> = vec![];
    let (mut css, mut inv_time) = (false, false);
    let (mut changed, mut ints, mut swapped, mut already) = (0usize, 0usize, 0usize, 0usize);
    let mut feed_ints = 0usize;
    for (li, line) in text.split('\n').enumerate() {
        let ln = li as u32 + 1;
        let mut t = tokens(line);
        if is_macro(&t) {
            if has_code(&t) { msgs.push(Msg { line: ln, level: 1, text: "Macro statement: not converted. Check any lengths in it by hand".into() }); }
            out.push(line.trim_end_matches('\r').to_string()); continue;
        }
        let g = g_codes(&t);
        if g.contains(&960) { css = true; }
        if g.contains(&970) { css = false; }
        if g.contains(&930) { inv_time = true; }
        if g.contains(&940) || g.contains(&950) || (lathe && (g.contains(&980) || g.contains(&990))) { inv_time = false; }
        let (has_p, has_e) = (has_word(&t, 'P'), has_word(&t, 'E'));
        let axes = ['X', 'Z', 'U', 'W'].iter().any(|c| has_word(&t, *c));
        let cyc7x = lathe && g.iter().any(|x| (700..=760).contains(x) && x % 10 == 0);
        let (g73, g7475, g76) = (lathe && g.contains(&730), lathe && (g.contains(&740) || g.contains(&750)), lathe && g.contains(&760));
        let refs_pq = lathe && g.iter().any(|x| [700, 710, 720, 730].contains(x));
        let clamp = g.contains(&500) || g.contains(&920);
        let rot = g.contains(&680) || g.contains(&681);
        if g.contains(&150) || g.contains(&160) || g.contains(&510) { msgs.push(Msg { line: ln, level: 1, text: "Polar coordinates or scaling on this line: check which words are lengths".into() }); }
        if cyc7x { msgs.push(Msg { line: ln, level: 1, text: "Lathe cycle: depths and allowances were converted by the usual word meanings. Check this block against the control manual".into() }); }
        if has_e { msgs.push(Msg { line: ln, level: 1, text: "E word left as it is: its meaning depends on the control".into() }); }
        let mut line_changed = false;
        let mut prev_comma = false;
        for x in t.iter_mut() {
            let comma = prev_comma;
            prev_comma = matches!(x, Tok::Text(s) if s == ",");
            let (c, num) = match x { Tok::Word { c, num, .. } => (*c, num.clone()), _ => continue };
            let v: f64 = match num.parse() { Ok(v) => v, Err(_) => continue };
            let dec = num.contains('.');
            if c == 'G' {
                let code = (v * 10.0).round() as i32;
                if code == g_from { *x = word('G', if to_metric { "21" } else { "20" }); swapped += 1; line_changed = true; }
                else if code == g_to { already += 1; }
                continue;
            }
            let kind = match c {
                'X' | 'Y' | 'Z' | 'U' | 'V' | 'W' | 'I' | 'J' | 'K' => Kind::Len,
                'R' if rot || (g73 && !has_p) => Kind::Keep,
                'R' => Kind::Len,
                'C' if comma => Kind::Len,
                'F' if inv_time => Kind::Keep,
                'F' => Kind::Feed,
                'Q' if refs_pq => Kind::Keep,
                'Q' if lathe => Kind::LenOrIncr,
                'Q' => Kind::Len,
                'P' if (g7475 || g76) && axes && !dec => Kind::Incr,
                'D' if lathe && (g.contains(&710) || g.contains(&720) || g76) => Kind::LenOrIncr,
                'S' if css && !clamp => Kind::Css,
                _ => Kind::Keep,
            };
            let new = match kind {
                Kind::Keep => continue,
                Kind::Css => format!("{}", convert_surface_speed(v, to_metric).round()),
                Kind::Incr => format!("{}", convert_increments(v, to_metric)),
                Kind::LenOrIncr if !dec => format!("{}", convert_increments(v, to_metric)),
                Kind::Feed => {
                    if !dec && v != 0.0 { feed_ints += 1; }
                    let r = convert_length(v, to_metric);
                    word_num(r, if to_metric { if r.abs() >= 10.0 { 1 } else { 4 } } else if r.abs() >= 1.0 { 4 } else { 6 })
                }
                Kind::Len | Kind::LenOrIncr => {
                    if !dec && v == 0.0 { continue; } // X0 is zero in either reading
                    let units = if dec { v } else {
                        ints += 1;
                        if int_mode == 1 { v * if to_metric { 0.0001 } else { 0.001 } } else { v }
                    };
                    word_num(convert_length(units, to_metric), dp_len)
                }
            };
            *x = word(c, &new);
            line_changed = true;
        }
        if line_changed { changed += 1; out.push(render(&t).trim_end().to_string()); } else { out.push(line.trim_end_matches('\r').to_string()); }
    }
    if swapped == 0 {
        msgs.push(Msg { line: 0, level: 1, text: format!("The program has no G{}: add G{} near the top so the control reads it in {}", g_from / 10, g_to / 10, to) });
    }
    if already > 0 { msgs.push(Msg { line: 0, level: 0, text: format!("The program already has G{} ({}): it may not be an {} program. Check before using the result", g_to / 10, to, from) }); }
    if ints > 0 {
        msgs.push(Msg { line: 0, level: 1, text: format!("{} length word{} had no decimal point and {} read as {}", ints, if ints == 1 { "" } else { "s" }, if ints == 1 { "was" } else { "were" },
            if int_mode == 1 { if to_metric { "least input increments of 0.0001 in" } else { "least input increments of 0.001 mm" } } else { "whole units" }) });
    }
    if feed_ints > 0 { msgs.push(Msg { line: 0, level: 1, text: format!("{} feed word{} had no decimal point and {} read as whole units: check them", feed_ints, if feed_ints == 1 { "" } else { "s" }, if feed_ints == 1 { "was" } else { "were" }) }); }
    msgs.push(Msg { line: 0, level: 2, text: "Arc end points and centres are rounded one by one: run the result in the simulator, which checks every arc".into() });
    msgs.push(Msg { line: 0, level: 2, text: "Tool offsets, work offsets and parameters stored in the control are not in the program and are not converted".into() });
    msgs.sort_by_key(|m| (m.line, m.level));
    TidyOut { text: out.join("\n"), msgs, changed }
}

/// Tell a lathe program from a mill program by the words only one of them
/// uses. Returns (1 lathe, 0 mill, -1 cannot tell) and the reasons, in words.
pub fn detect_machine(text: &str) -> (i32, String) {
    let (mut lathe, mut mill) = (0i32, 0i32);
    let mut why_l: Vec<&str> = vec![];
    let mut why_m: Vec<&str> = vec![];
    let mut seen: HashSet<&str> = HashSet::new();
    let mut add = |is_lathe: bool, w: i32, key: &'static str| {
        if !seen.insert(key) { return; }
        if is_lathe { lathe += w; why_l.push(key); } else { mill += w; why_m.push(key); }
    };
    for line in text.split('\n') {
        let t = tokens(line);
        if is_macro(&t) { continue; }
        let g = g_codes(&t); let m = m_codes(&t);
        let has = |c: char| has_word(&t, c);
        for x in &t {
            if let Tok::Word { c: 'T', num, .. } = x {
                if !num.contains('.') && num.trim_start_matches(['+', '-']).len() == 4 { add(true, 3, "a four-digit tool word such as T0101"); }
            }
        }
        if g.contains(&500) && has('S') { add(true, 3, "G50 S (spindle speed limit)"); }
        if g.contains(&960) { add(true, 2, "G96 (constant surface speed)"); }
        if g.iter().any(|x| [710, 720].contains(x)) && has('P') && has('Q') { add(true, 3, "G71 or G72 with P and Q (roughing cycle)"); }
        if g.contains(&700) && has('P') && has('Q') { add(true, 2, "G70 with P and Q (finishing cycle)"); }
        if g.contains(&920) && has('F') && !has('Y') { add(true, 2, "G92 with F (threading cycle)"); }
        if g.contains(&320) { add(true, 2, "G32 (thread cutting)"); }
        if (has('U') || has('W')) && !g.iter().any(|x| (700..=760).contains(x)) { add(true, 1, "U or W words (incremental X and Z)"); }
        if g.contains(&430) && has('H') { add(false, 3, "G43 H (tool length offset)"); }
        if m.contains(&6) { add(false, 2, "M06 (tool change)"); }
        if has('Y') { add(false, 2, "Y words"); }
        if g.contains(&170) { add(false, 1, "G17 (XY plane)"); }
        if g.iter().any(|x| [810, 820, 830, 840, 850, 860].contains(x)) && has('R') { add(false, 2, "a drilling cycle with an R plane"); }
        if (g.contains(&410) || g.contains(&420)) && has('D') { add(false, 2, "G41 or G42 with D (cutter compensation)"); }
    }
    let kind = if lathe >= mill + 2 { 1 } else if mill >= lathe + 2 { 0 } else { -1 };
    let why = match kind {
        1 => format!("Lathe: {}", why_l.join("; ")),
        0 => format!("Mill: {}", why_m.join("; ")),
        _ if lathe + mill == 0 => "Cannot tell: none of the words that only a lathe or only a mill uses are in the program".to_string(),
        _ => format!("Cannot tell. Lathe signs: {}. Mill signs: {}", if why_l.is_empty() { "none".into() } else { why_l.join("; ") }, if why_m.is_empty() { "none".into() } else { why_m.join("; ") }),
    };
    (kind, why)
}

/// Messages, one per line: "line<TAB>level<TAB>text" (as `gsim::msgs_text`).
pub fn msgs_text(m: &[Msg]) -> String {
    m.iter().map(|m| format!("{}\t{}\t{}", m.line, m.level, m.text.replace(['\n', '\t'], " "))).collect::<Vec<_>>().join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    const LATHE: &str = "%\nO2345 (LATHE)\n(PROFILE)\nN10 G21 G40 G99\nN20 T0101\nN30 G50 S3000\nN40 G96 S180 M03\nN50 G00 X54. Z2. M08\nN60 G71 U2. R0.5\nN70 G71 P100 Q170 U0.4 W0.1 F0.25\nN100 G00 X20.\nN110 G01 Z0. F0.1\nN170 X50.\nN180 G70 P100 Q170\nN190 M30\n%";

    #[test]
    fn tokens_round_trip() {
        for l in ["N10 G01 X1.5 Y-2. (CUT (DEEP)) ; END", "/N20G0X0Y0", "#100 = [#101 + 1.]", "IF [#1 GT 0] GOTO 100", "G1 X 10. Y 5.", "%", ":1234", "G01 X50. ,R2. ,C1."] {
            assert_eq!(render(&tokens(l)), l);
        }
        assert!(is_macro(&tokens("#100 = 1.")) && is_macro(&tokens("GOTO 20")) && !is_macro(&tokens("G01 X1. (A = B)")));
        assert_eq!(n_index(&tokens("/N20 G0")), Some(1));
        assert_eq!(n_index(&tokens("G0 N20")), None);
    }

    #[test]
    fn renumber_follows_the_cycle_blocks() {
        let o = TidyOpts { numbers: 1, start: 100, step: 5, lathe: true, ..Default::default() };
        let r = tidy(LATHE, &o);
        let l: Vec<&str> = r.text.split('\n').collect();
        assert_eq!(l[0], "%");
        assert_eq!(l[1], "O2345 (LATHE)");
        assert_eq!(l[2], "(PROFILE)");
        assert_eq!(l[3], "N100 G21 G40 G99");
        // N70 is the 7th numbered block: 100 + 6 x 5 = 130. N100 the 8th: 135. N170 the 10th: 145.
        assert_eq!(l[9], "N130 G71 P135 Q145 U0.4 W0.1 F0.25");
        assert_eq!(l[10], "N135 G00 X20.");
        assert_eq!(l[12], "N145 X50.");
        assert_eq!(l[13], "N150 G70 P135 Q145");
        assert!(r.msgs.is_empty());
        // In a mill program G73 Q is a peck depth, not a block number.
        let m = tidy("N5 G73 X0 Y0 Z-10. Q2 R2. F100\nN7 G80", &TidyOpts { numbers: 1, start: 10, step: 10, ..Default::default() });
        assert_eq!(m.text, "N10 G73 X0 Y0 Z-10. Q2 R2. F100\nN20 G80");
    }

    #[test]
    fn renumber_all_blocks_goto_and_missing_targets() {
        let src = "O1\nG0 X0\n/G1 X5. F100\nIF [#1 GT 0] GOTO 50\n(NOTE)\n\nN50 M99 P70\nM30";
        let r = tidy(src, &TidyOpts { numbers: 1, start: 10, step: 10, all: true, ..Default::default() });
        assert_eq!(r.text, "O1\nN10 G0 X0\n/N20 G1 X5. F100\nN30 IF [#1 GT 0] GOTO 50\n(NOTE)\n\nN40 M99 P70\nN50 M30".replace("GOTO 50", "GOTO 40"));
        assert_eq!(r.msgs.len(), 1);
        assert!(r.msgs[0].text.contains("N70") && r.msgs[0].line == 7);
        // five digits at most
        let big = tidy("N1 G0\nN2 G1", &TidyOpts { numbers: 1, start: 99_995, step: 10, ..Default::default() });
        assert!(big.msgs.iter().any(|m| m.text.contains("five digits")));
    }

    #[test]
    fn remove_numbers_keeps_the_named_blocks() {
        let r = tidy(LATHE, &TidyOpts { numbers: 2, lathe: true, ..Default::default() });
        let l: Vec<&str> = r.text.split('\n').collect();
        assert_eq!(l[3], "G21 G40 G99");
        assert_eq!(l[9], "G71 P100 Q170 U0.4 W0.1 F0.25");
        assert_eq!(l[10], "N100 G00 X20.");
        assert_eq!(l[11], "G01 Z0. F0.1");
        assert_eq!(l[12], "N170 X50.");
        assert!(r.msgs.iter().any(|m| m.text.contains("Kept N100, N170")));
    }

    #[test]
    fn strip_and_spacing() {
        let src = "%\nO100 (PART 7) (REV B)\n(SETUP NOTE)\n\nn10 g0 x1.5y2. (RAPID)\nN20G1X5.F100;feed\n#1 = 5 (COUNT)\n%";
        let r = tidy(src, &TidyOpts { comments: true, blank: true, spacing: 1, upper: true, ..Default::default() });
        assert_eq!(r.text, "%\nO100 (PART 7)\nN10 G0 X1.5 Y2.\nN20 G1 X5. F100\n#1 = 5\n%");
        let tight = tidy("N10 G01 X1. Y2. ,R0.5 (A)\n/ N20 M30", &TidyOpts { spacing: 2, ..Default::default() });
        assert_eq!(tight.text, "N10G01X1.Y2.,R0.5(A)\n/N20M30");
        let same = tidy(src, &TidyOpts::default());
        assert_eq!(same.text, src);
        assert_eq!(same.changed, 0);
    }

    #[test]
    fn word_numbers() {
        assert_eq!(word_num(50.0, 3), "50.");
        assert_eq!(word_num(0.5, 4), "0.5");
        assert_eq!(word_num(-2.25, 3), "-2.25");
        assert_eq!(word_num(-0.00001, 4), "0.");
        assert_eq!(word_num(1.96850, 4), "1.9685");
        assert_eq!(convert_length(1.0, true), 25.4);
        assert!((convert_surface_speed(180.0, false) - 590.551).abs() < 1e-3);
        // 0.1 mm = 100 increments of 0.001 mm = 0.003937 in = 39 increments of 0.0001 in
        assert_eq!(convert_increments(100.0, false), 39.0);
        assert_eq!(convert_increments(39.0, true), 99.0);
    }

    #[test]
    fn mill_to_inch_and_back() {
        let src = "N10 G21 G17 G90\nN20 G00 X50.8 Y25.4 S3000 M03\nN30 G01 Z-2.54 F254.\nN40 G03 X55.88 Y30.48 R5.08\nN50 G83 X0 Y0 Z-12.7 Q2.54 R2.54 P500 F127.\nN60 G68 X0 Y0 R45.\nN70 G43 H1 Z25.4 D2 T3 M08";
        let r = convert_units(src, false, false, 0);
        let l: Vec<&str> = r.text.split('\n').collect();
        assert_eq!(l[0], "N10 G20 G17 G90");
        assert_eq!(l[1], "N20 G00 X2. Y1. S3000 M03");
        assert_eq!(l[2], "N30 G01 Z-0.1 F10.");
        assert_eq!(l[3], "N40 G03 X2.2 Y1.2 R0.2");
        assert_eq!(l[4], "N50 G83 X0 Y0 Z-0.5 Q0.1 R0.1 P500 F5.");
        assert_eq!(l[5], "N60 G68 X0 Y0 R45.");
        assert_eq!(l[6], "N70 G43 H1 Z1. D2 T3 M08");
        assert!(!r.msgs.iter().any(|m| m.level == 0));
        let back = convert_units(&r.text, true, false, 0);
        assert_eq!(back.text, src);
    }

    #[test]
    fn lathe_to_inch() {
        let src = "N10 G21 G99\nN30 G50 S3000\nN40 G96 S180 M03\nN50 G00 X50.8 Z2.54\nN60 G71 U2.54 R0.508\nN70 G71 P100 Q170 U0.508 W0.127 F0.254\nN100 G01 X25.4 F0.1\nN170 X50.8\nN180 G70 P100 Q170\nN200 G97 S800\nN210 G76 P010060 Q100 R0.05\nN220 G76 X22.16 Z-13. P920 Q300 F1.5\nN230 G74 R1.\nN240 G74 Z-25.4 Q5000 F0.1";
        let r = convert_units(src, false, true, 0);
        let l: Vec<&str> = r.text.split('\n').collect();
        assert_eq!(l[0], "N10 G20 G99");
        assert_eq!(l[1], "N30 G50 S3000");
        assert_eq!(l[2], "N40 G96 S591 M03"); // 180 m/min = 590.55 ft/min
        assert_eq!(l[3], "N50 G00 X2. Z0.1");
        assert_eq!(l[4], "N60 G71 U0.1 R0.02");
        assert_eq!(l[5], "N70 G71 P100 Q170 U0.02 W0.005 F0.01");
        assert_eq!(l[6], "N100 G01 X1. F0.003937");
        assert_eq!(l[8], "N180 G70 P100 Q170");
        assert_eq!(l[9], "N200 G97 S800");
        // Q100 = 0.1 mm = 39 x 0.0001 in; R0.05 mm = 0.002 in
        assert_eq!(l[10], "N210 G76 P010060 Q39 R0.002");
        // P920 = 0.92 mm = 362 x 0.0001 in; Q300 = 0.3 mm = 118; F1.5 mm = 0.059055 in
        assert_eq!(l[11], "N220 G76 X0.8724 Z-0.5118 P362 Q118 F0.059055");
        assert_eq!(l[12], "N230 G74 R0.0394");
        assert_eq!(l[13], "N240 G74 Z-1. Q1969 F0.003937");
        assert!(r.msgs.iter().filter(|m| m.text.starts_with("Lathe cycle")).count() == 7);
    }

    #[test]
    fn integers_and_warnings() {
        // whole units
        let a = convert_units("G20\nG01 X1 Y0 F20", true, false, 0);
        assert_eq!(a.text, "G21\nG01 X25.4 Y0 F508.");
        assert!(a.msgs.iter().any(|m| m.text.contains("1 length word had no decimal point and was read as whole units")));
        assert!(a.msgs.iter().any(|m| m.text.contains("1 feed word had no decimal point")));
        // least input increments: X10000 = 1.0000 in
        let b = convert_units("G20\nG01 X10000 F20.", true, false, 1);
        assert_eq!(b.text, "G21\nG01 X25.4 F508.");
        // wrong direction and no unit code
        let c = convert_units("G21\nG01 X1.", true, false, 0);
        assert!(c.msgs.iter().any(|m| m.level == 0 && m.text.contains("already has G21")));
        assert!(c.msgs.iter().any(|m| m.text.contains("has no G20")));
        // macro lines stay, with a warning; inverse time feed is not a length
        let d = convert_units("G20\n#1 = 2.5\nG93 G01 X1. F30.\nG94 X2. F30.", true, false, 0);
        assert_eq!(d.text, "G21\n#1 = 2.5\nG93 G01 X25.4 F30.\nG94 X50.8 F762.");
        assert!(d.msgs.iter().any(|m| m.line == 2 && m.text.starts_with("Macro statement")));
    }

    #[test]
    fn lathe_or_mill() {
        assert_eq!(detect_machine(LATHE).0, 1);
        assert!(detect_machine(LATHE).1.contains("T0101"));
        let mill = "O1\nG21 G17 G90\nT1 M06\nG43 H1 Z25.\nG01 X10. Y5. F300.\nM30";
        let (k, why) = detect_machine(mill);
        assert_eq!(k, 0);
        assert!(why.starts_with("Mill:") && why.contains("G43 H"));
        assert_eq!(detect_machine("G00 X10. Z5.\nG01 Z0 F0.2\nM30").0, -1);
        assert_eq!(detect_machine("").0, -1);
        // a mill program that sets its origin with G92 X Y Z is not a thread
        assert_eq!(detect_machine("G92 X0 Y0 Z0\nG01 X5. Y5. F100.\nG43 H1 Z5.").0, 0);
    }
}
