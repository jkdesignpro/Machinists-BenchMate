//! Expression calculator: a small, safe recursive-descent parser for
//! arithmetic expressions. No `eval`, no variables other than `ans`, no
//! side effects, bounded input length and nesting depth.
//!
//! Grammar (lowest precedence first):
//!   expr   = term { ("+" | "-") term }
//!   term   = unary { ("*" | "/" | "%") unary }
//!   unary  = ("-" | "+") unary | power
//!   power  = postfix [ "^" unary ]          (right-associative; -2^2 = -4)
//!   postfix= primary { "!" }
//!   primary= number | constant | name "(" args ")" | "(" expr ")"
//! Numbers: 12, 0.5, .5, 1e-3, 2.5E+4. Constants: pi, e, ans.
//! Functions: sin cos tan asin acos atan atan2(y,x) sinh cosh tanh sqrt cbrt
//! abs ln log (base 10) log2 exp floor ceil round min(a,b) max(a,b)
//! hypot(a,b) fact(n) ncr(n,r) npr(n,r) dms(d,m,s) (to decimal degrees)
//! inv(x) (involute, inv a = tan a - a) mod(a,b). Trig angles in degrees or radians.
//!
//! Shop forms (for a machinist's calculator):
//! - Mixed numbers: `3 7/16` (space) and `3-7/16` (hyphen, no spaces) are
//!   3.4375. The fraction must be proper (numerator < denominator, both whole
//!   numbers). The hyphen form is only read as a mixed number at the start of
//!   an operand list (start, after `(`, `,`, `+` or `-`); after `*`, `/`, `^`
//!   or `%` it is plain subtraction, and `3 - 7/16` with spaces always is.
//! - Percent: `%` followed by the end, `)`, `,` or an operator is a postfix
//!   percent (`15%` = 0.15, `200*15%` = 30); between two operands it is the
//!   remainder (`7 % 3` = 1).
//! - Lengths with units (`eval_units` only, with the app's unit as the base):
//!   `12.7mm`, `1/2 in`, `3 7/16"`, `0.5 thou`, `2 ft`, `5' 3 1/2"`, also cm,
//!   m, um. Each is converted to the base unit (inch or mm), so
//!   `12.7mm + 1/2 in` is 1 in inch mode and 25.4 in mm mode. A plain
//!   fraction straight before a unit is one number: `1/2 in` is half an inch.
//!   Exact factors: 1 in = 25.4 mm, 1 ft = 12 in, 1 thou = 0.001 in.
//! - Degrees, minutes, seconds: `29°30'15"` is 29.5041666... decimal degrees.

use std::f64::consts::{E, PI};

const MAX_LEN: usize = 1000;
const MAX_DEPTH: usize = 64;

/// Result of evaluating an expression: the value, or an error with the
/// character position (0-based) where it was found.
#[derive(Debug, PartialEq)]
pub enum Eval { Ok(f64), Err(String, usize) }

struct P<'a> { s: &'a [u8], i: usize, deg: bool, ans: f64, depth: usize, base: f64, used: bool }

type R = Result<f64, (String, usize)>;

impl<'a> P<'a> {
    fn ws(&mut self) { while self.i < self.s.len() && (self.s[self.i] as char).is_ascii_whitespace() { self.i += 1; } }
    fn peek(&mut self) -> Option<u8> { self.ws(); self.s.get(self.i).copied() }
    fn err<T>(&self, m: &str) -> Result<T, (String, usize)> { Err((m.to_string(), self.i)) }
    fn eat(&mut self, c: u8) -> bool { if self.peek() == Some(c) { self.i += 1; true } else { false } }

    fn expr(&mut self) -> R {
        self.depth += 1;
        if self.depth > MAX_DEPTH { return self.err("Too deeply nested"); }
        let mut v = self.term()?;
        loop {
            if self.eat(b'+') { v += self.term()?; } else if self.eat(b'-') { v -= self.term()?; } else { break; }
        }
        self.depth -= 1;
        Ok(v)
    }
    fn term(&mut self) -> R {
        let mut v = self.unary()?;
        loop {
            if self.eat(b'*') { v *= self.unary()?; }
            else if self.eat(b'/') { let d = self.unary()?; if d == 0.0 { return self.err("Division by zero"); } v /= d; }
            else if self.eat(b'%') { let d = self.unary()?; if d == 0.0 { return self.err("Division by zero"); } v %= d; }
            else { break; }
        }
        Ok(v)
    }
    fn unary(&mut self) -> R {
        self.depth += 1;
        if self.depth > MAX_DEPTH { return self.err("Too deeply nested"); }
        let v = if self.eat(b'-') { -self.unary()? } else if self.eat(b'+') { self.unary()? } else { self.power()? };
        self.depth -= 1;
        Ok(v)
    }
    fn power(&mut self) -> R {
        let b = self.postfix()?;
        if self.eat(b'^') { let x = self.unary()?; return Ok(b.powf(x)); }
        Ok(b)
    }
    fn postfix(&mut self) -> R {
        let mut v = self.primary()?;
        loop {
            if self.eat(b'!') { v = fact(v).ok_or_else(|| ("Factorial needs a whole number from 0 to 170".to_string(), self.i))?; }
            else if self.peek() == Some(b'%') && self.percent_postfix() { self.i += 1; v /= 100.0; }
            else if let Some((mm, end, feet)) = self.unit_at(self.i) {
                if self.base <= 0.0 { return self.err("Length units (mm, in, ft) need inch or mm mode"); }
                self.i = end; self.used = true;
                v = v * mm / self.base;
                // Feet and inches: 5' 3 1/2" adds the inches that follow.
                if feet && matches!(self.peek(), Some(c) if c.is_ascii_digit() || c == b'.') {
                    let st = self.i;
                    let w = self.number()?;
                    match self.unit_at(self.i) {
                        Some((m2, e2, false)) if m2 == 25.4 => { self.i = e2; v += w * 25.4 / self.base; }
                        _ => return Err(("After feet, give inches, for example 5' 3 1/2\"".to_string(), st)),
                    }
                }
            }
            else if self.s.get(self.i..self.i + 2) == Some(&[0xC2, 0xB0]) {
                // Degree sign: degrees, then optional minutes (') and seconds (").
                self.i += 2;
                for (mark, div) in [(b'\'', 60.0), (b'"', 3600.0)] {
                    if !matches!(self.peek(), Some(c) if c.is_ascii_digit() || c == b'.') { break; }
                    let st = self.i;
                    let w = self.number()?;
                    if div == 60.0 && self.peek() == Some(b'"') { self.i += 1; v += w / 3600.0; break; }
                    if !self.eat(mark) { return Err(("After degrees, give minutes with ' and seconds with \"".to_string(), st)); }
                    v += w / div;
                }
            }
            else { break; }
        }
        Ok(v)
    }
    /// A length unit at `k` (after optional spaces): (millimetres per unit, end, is feet).
    fn unit_at(&self, mut k: usize) -> Option<(f64, usize, bool)> {
        let s = self.s;
        while k < s.len() && s[k].is_ascii_whitespace() { k += 1; }
        match s.get(k)? {
            b'"' => return Some((25.4, k + 1, false)),
            b'\'' => return Some((304.8, k + 1, true)),
            _ => {}
        }
        if s.get(k..k + 3) == Some(&[0xC2, 0xB5, b'm']) && !matches!(s.get(k + 3), Some(c) if c.is_ascii_alphanumeric()) { return Some((0.001, k + 3, false)); }
        let st = k;
        while k < s.len() && s[k].is_ascii_alphabetic() { k += 1; }
        if k == st || matches!(s.get(k), Some(c) if c.is_ascii_digit() || *c == b'(' || *c == b'_') { return None; }
        let w = std::str::from_utf8(&s[st..k]).ok()?.to_ascii_lowercase();
        let mm = match w.as_str() {
            "mm" => 1.0, "cm" => 10.0, "m" => 1000.0, "um" => 0.001,
            "in" | "inch" | "inches" => 25.4, "thou" => 0.0254,
            "ft" | "foot" | "feet" => 304.8,
            _ => return None,
        };
        Some((mm, k, w == "ft" || w == "foot" || w == "feet"))
    }
    /// The `%` at `self.i` is a postfix percent (not the remainder operator)
    /// when nothing that can start an operand follows it.
    fn percent_postfix(&self) -> bool {
        let mut k = self.i + 1;
        while k < self.s.len() && self.s[k].is_ascii_whitespace() { k += 1; }
        match self.s.get(k) { None => true, Some(c) => matches!(c, b')' | b',' | b'+' | b'-' | b'*' | b'/' | b'^' | b'%' | b'!') }
    }
    /// Whole number at `k..`: (value, end), or None if there is no digit.
    fn whole(&self, mut k: usize) -> Option<(f64, usize)> {
        let st = k;
        while k < self.s.len() && self.s[k].is_ascii_digit() { k += 1; }
        if k == st { return None; }
        std::str::from_utf8(&self.s[st..k]).ok()?.parse::<f64>().ok().map(|v| (v, k))
    }
    /// Mixed number after the whole number `w` at `st..j`: `w n/d` or `w-n/d`.
    fn mixed(&self, st: usize, j: usize, w: f64) -> Option<(f64, usize)> {
        let s = self.s;
        let k = if s.get(j) == Some(&b'-') {
            let prev = s[..st].iter().rev().find(|c| !c.is_ascii_whitespace());
            if !matches!(prev, None | Some(b'(') | Some(b',') | Some(b'+') | Some(b'-')) { return None; }
            j + 1
        } else {
            let mut k = j;
            while k < s.len() && s[k].is_ascii_whitespace() { k += 1; }
            if k == j { return None; }
            k
        };
        let (n, k) = self.whole(k)?;
        if s.get(k) != Some(&b'/') { return None; }
        let (d, k) = self.whole(k + 1)?;
        if let Some(c) = s.get(k) { if *c == b'.' || *c == b'(' || (c.is_ascii_alphabetic() && self.unit_at(k).is_none()) { return None; } }
        if !(d > 0.0 && n < d) { return None; }
        Some((w + n / d, k))
    }
    fn number(&mut self) -> R {
        let st = self.i;
        let s = self.s;
        let mut j = self.i;
        while j < s.len() && (s[j].is_ascii_digit() || s[j] == b'.') { j += 1; }
        if j < s.len() && (s[j] == b'e' || s[j] == b'E') {
            let mut k = j + 1;
            if k < s.len() && (s[k] == b'+' || s[k] == b'-') { k += 1; }
            if k < s.len() && s[k].is_ascii_digit() { while k < s.len() && s[k].is_ascii_digit() { k += 1; } j = k; }
        }
        let t = std::str::from_utf8(&s[st..j]).unwrap_or("");
        match t.parse::<f64>() {
            Ok(v) => {
                if s[st..j].iter().all(|c| c.is_ascii_digit()) {
                    if let Some((m, end)) = self.mixed(st, j, v) { self.i = end; return Ok(m); }
                    // A plain fraction straight before a length unit is one number: 1/2 in.
                    if s.get(j) == Some(&b'/') {
                        if let Some((d, k)) = self.whole(j + 1) {
                            if d > 0.0 && s.get(k) != Some(&b'.') && self.unit_at(k).is_some() { self.i = k; return Ok(v / d); }
                        }
                    }
                }
                self.i = j; Ok(v)
            }
            Err(_) => self.err("Not a number")
        }
    }
    fn primary(&mut self) -> R {
        match self.peek() {
            None => self.err("Expression ends too early"),
            Some(c) if c.is_ascii_digit() || c == b'.' => self.number(),
            Some(b'(') => { self.i += 1; let v = self.expr()?; if !self.eat(b')') { return self.err("Missing )"); } Ok(v) }
            Some(c) if c.is_ascii_alphabetic() => {
                let st = self.i;
                while self.i < self.s.len() && (self.s[self.i].is_ascii_alphanumeric() || self.s[self.i] == b'_') { self.i += 1; }
                let name = std::str::from_utf8(&self.s[st..self.i]).unwrap_or("").to_ascii_lowercase();
                if self.peek() == Some(b'(') {
                    self.i += 1;
                    let mut args = vec![];
                    if !self.eat(b')') {
                        loop { args.push(self.expr()?); if self.eat(b',') { continue; } if self.eat(b')') { break; } return self.err("Expected , or )"); }
                    }
                    self.call(&name, &args, st)
                } else {
                    match name.as_str() { "pi" => Ok(PI), "e" => Ok(E), "ans" => Ok(self.ans), _ => Err((format!("Unknown name '{name}'"), st)) }
                }
            }
            Some(c) => self.err(&format!("Unexpected '{}'", c as char)),
        }
    }
    fn call(&self, f: &str, a: &[f64], at: usize) -> R {
        let to_r = |x: f64| if self.deg { x * PI / 180.0 } else { x };
        let from_r = |x: f64| if self.deg { x * 180.0 / PI } else { x };
        let need = |n: usize| -> Result<(), (String, usize)> { if a.len() == n { Ok(()) } else { Err((format!("{f}() takes {n} value{}", if n == 1 { "" } else { "s" }), at)) } };
        let v = match f {
            "sin" | "cos" | "tan" | "asin" | "acos" | "atan" | "sinh" | "cosh" | "tanh" | "sqrt" | "cbrt" | "abs" | "ln" | "log" | "log10" | "log2"
            | "exp" | "floor" | "ceil" | "round" | "fact" | "inv" => {
                need(1)?;
                let x = a[0];
                match f {
                    "sin" => to_r(x).sin(), "cos" => to_r(x).cos(), "tan" => to_r(x).tan(),
                    "asin" => from_r(x.asin()), "acos" => from_r(x.acos()), "atan" => from_r(x.atan()),
                    "sinh" => x.sinh(), "cosh" => x.cosh(), "tanh" => x.tanh(),
                    "sqrt" => x.sqrt(), "cbrt" => x.cbrt(), "abs" => x.abs(),
                    "ln" => x.ln(), "log" | "log10" => x.log10(), "log2" => x.log2(), "exp" => x.exp(),
                    "floor" => x.floor(), "ceil" => x.ceil(), "round" => x.round(),
                    "fact" => fact(x).ok_or_else(|| ("fact() needs a whole number from 0 to 170".to_string(), at))?,
                    _ => { let r = to_r(x); r.tan() - r } // involute, in radians
                }
            }
            "atan2" | "min" | "max" | "hypot" | "ncr" | "npr" | "pow" | "mod" => {
                need(2)?;
                let (x, y) = (a[0], a[1]);
                match f {
                    "atan2" => from_r(x.atan2(y)), "min" => x.min(y), "max" => x.max(y), "hypot" => x.hypot(y), "pow" => x.powf(y),
                    "mod" => { if y == 0.0 { return Err(("Division by zero".to_string(), at)); } x % y }
                    _ => {
                        let (n, r) = (x, y);
                        if !(n >= 0.0 && r >= 0.0 && n.fract() == 0.0 && r.fract() == 0.0 && r <= n && n <= 1000.0) {
                            return Err((format!("{f}() needs whole numbers 0 <= r <= n <= 1000"), at));
                        }
                        let mut v = 1.0;
                        for k in 0..r as u64 { v *= (n - k as f64) / if f == "ncr" { (k + 1) as f64 } else { 1.0 }; }
                        v
                    }
                }
            }
            "dms" => { need(3)?; let s = if a[0] < 0.0 { -1.0 } else { 1.0 }; s * (a[0].abs() + a[1] / 60.0 + a[2] / 3600.0) }
            _ => return Err((format!("Unknown function '{f}'"), at)),
        };
        Ok(v)
    }
}

fn fact(x: f64) -> Option<f64> {
    if !(x >= 0.0 && x <= 170.0 && x.fract() == 0.0) { return None; }
    Some((1..=x as u64).fold(1.0, |p, k| p * k as f64))
}

/// Evaluate `src`. `deg` = trig functions take and give degrees; `ans` is
/// the value of the name `ans` (the last result).
pub fn eval(src: &str, deg: bool, ans: f64) -> Eval { eval_units(src, deg, ans, 0.0).0 }

/// As `eval`, but lengths may carry units. `base_mm` is the size of the unit
/// the result is in, in millimetres (25.4 for inch mode, 1 for mm mode; 0
/// refuses units). Also returns whether any length unit was used.
pub fn eval_units(src: &str, deg: bool, ans: f64, base_mm: f64) -> (Eval, bool) {
    if src.len() > MAX_LEN { return (Eval::Err(format!("Too long (over {MAX_LEN} characters)"), MAX_LEN), false); }
    let mut p = P { s: src.as_bytes(), i: 0, deg, ans, depth: 0, base: base_mm, used: false };
    if p.peek().is_none() { return (Eval::Err("Type an expression".into(), 0), false); }
    let r = match p.expr() {
        Ok(v) => {
            if p.peek().is_some() { Eval::Err(format!("Unexpected '{}'", p.s[p.i] as char), p.i) }
            else if v.is_finite() { Eval::Ok(v) } else { Eval::Err(if v.is_nan() { "Not a real number (outside the function's range)".into() } else { "Result too large".into() }, src.len()) }
        }
        Err((m, i)) => Eval::Err(m, i),
    };
    (r, p.used)
}

/// Decimal degrees to [degrees, minutes, seconds] (sign on the degrees, or
/// on the first non-zero part when the degrees are 0).
pub fn deg_to_dms(x: f64) -> [f64; 3] {
    let s = if x < 0.0 { -1.0 } else { 1.0 };
    let t = (x.abs() * 3600.0 * 1e6).round() / 1e6; // seconds, rounded to 1e-6 s
    let d = (t / 3600.0).floor();
    let m = ((t - d * 3600.0) / 60.0).floor();
    let sec = t - d * 3600.0 - m * 60.0;
    if d > 0.0 { [s * d, m, sec] } else if m > 0.0 { [0.0, s * m, sec] } else { [0.0, 0.0, s * sec] }
}

/// Prime factors of a whole number (2 to 1e12), smallest first.
pub fn prime_factors(n: f64) -> Vec<f64> {
    if !(n >= 2.0 && n <= 1e12 && n.fract() == 0.0) { return vec![]; }
    let mut m = n as u64;
    let mut out = vec![];
    let mut p = 2u64;
    while p * p <= m { while m % p == 0 { out.push(p as f64); m /= p; } p += if p == 2 { 1 } else { 2 }; }
    if m > 1 { out.push(m as f64); }
    out
}

/// Linear interpolation: y at x on the line through (x1, y1) and (x2, y2).
pub fn interpolate(x1: f64, y1: f64, x2: f64, y2: f64, x: f64) -> f64 {
    if x2 == x1 { return f64::NAN; }
    y1 + (x - x1) * (y2 - y1) / (x2 - x1)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ok(s: &str, deg: bool) -> f64 { match eval(s, deg, 0.0) { Eval::Ok(v) => v, Eval::Err(m, i) => panic!("{s}: {m} at {i}") } }
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    #[test]
    fn arithmetic() {
        close(ok("1 + 2 * 3", true), 7.0, 0.0);
        close(ok("(1 + 2) * 3", true), 9.0, 0.0);
        close(ok("2^3^2", true), 512.0, 0.0);
        close(ok("-2^2", true), -4.0, 0.0);
        close(ok("2^-1", true), 0.5, 0.0);
        close(ok("10 / 4", true), 2.5, 0.0);
        close(ok("7 % 3", true), 1.0, 0.0);
        close(ok(".5 + 1e-3 + 2.5E+1", true), 25.501, 1e-12);
        close(ok("5!", true), 120.0, 0.0);
        close(ok("ncr(10, 3)", true), 120.0, 1e-9);
        close(ok("npr(5, 2)", true), 20.0, 1e-12);
        close(ok("--3", true), 3.0, 0.0);
    }

    #[test]
    fn functions() {
        close(ok("sin(30)", true), 0.5, 1e-15);
        close(ok("sin(pi/6)", false), 0.5, 1e-15);
        close(ok("atan2(1, 1)", true), 45.0, 1e-12);
        close(ok("sqrt(2) * sqrt(2)", true), 2.0, 1e-15);
        close(ok("log(1000) + ln(e)", true), 4.0, 1e-15);
        close(ok("dms(29, 30, 0)", true), 29.5, 1e-15);
        // Involute of 20 deg = 0.014904 (standard gear value inv 20 = 0.0149044).
        close(ok("inv(20)", true), 0.014_904_4, 1e-7);
        close(ok("hypot(3, 4)", true), 5.0, 1e-15);
        assert_eq!(eval("ans * 2", true, 21.0), Eval::Ok(42.0));
    }

    #[test]
    fn errors() {
        assert!(matches!(eval("1 +", true, 0.0), Eval::Err(_, 3)));
        assert!(matches!(eval("2 3", true, 0.0), Eval::Err(_, 2)));
        assert!(matches!(eval("1/0", true, 0.0), Eval::Err(_, _)));
        assert!(matches!(eval("foo(1)", true, 0.0), Eval::Err(_, 0)));
        assert!(matches!(eval("sqrt(-1)", true, 0.0), Eval::Err(_, _)));
        assert!(matches!(eval("(1", true, 0.0), Eval::Err(_, _)));
        assert!(matches!(eval("", true, 0.0), Eval::Err(_, 0)));
        assert!(matches!(eval("3.5!", true, 0.0), Eval::Err(_, _)));
        let deep = "(".repeat(200) + "1" + &")".repeat(200);
        assert!(matches!(eval(&deep, true, 0.0), Eval::Err(_, _)));
        assert!(matches!(eval("system(1)", true, 0.0), Eval::Err(_, _)));
    }

    #[test]
    fn mixed_numbers() {
        close(ok("3 7/16", true), 3.4375, 0.0);
        close(ok("3-7/16", true), 3.4375, 0.0);
        close(ok("-3-7/16", true), -3.4375, 0.0);
        close(ok("1-1/2 + 2-3/4", true), 4.25, 0.0);
        close(ok("(1-1/2) * 2", true), 3.0, 0.0);
        close(ok("max(1-1/2, 0)", true), 1.5, 0.0);
        // Spaces around the minus: subtraction.
        close(ok("3 - 7/16", true), 2.5625, 0.0);
        // After * / ^ the hyphen is subtraction (1/3 - 1/4, 2*3 - 1/4).
        close(ok("1/3-1/4", true), 1.0 / 3.0 - 0.25, 1e-15);
        close(ok("2*3-1/4", true), 5.75, 0.0);
        // Improper fraction part is not a mixed number.
        close(ok("3-9/8", true), 3.0 - 9.0 / 8.0, 0.0);
        close(ok("2 1/2 * 2", true), 5.0, 0.0);
        close(ok("1-1/2-1/4", true), 1.25, 0.0);
        // A decimal is never the whole part.
        assert!(matches!(eval("2.5 1/2", true, 0.0), Eval::Err(_, _)));
        close(ok("2.5-1/2", true), 2.0, 0.0);
    }

    #[test]
    fn lengths_with_units() {
        let u = |s: &str, base: f64| match eval_units(s, true, 0.0, base) { (Eval::Ok(v), used) => (v, used), (Eval::Err(m, i), _) => panic!("{s}: {m} at {i}") };
        // Exact definitions: 1 in = 25.4 mm, 1 ft = 12 in, 1 thou = 0.001 in.
        close(u("12.7mm", 25.4).0, 0.5, 1e-15);
        close(u("1/2 in", 1.0).0, 12.7, 1e-12);
        close(u("1/2in", 25.4).0, 0.5, 0.0);
        close(u("12.7mm + 1/2 in", 25.4).0, 1.0, 1e-15);
        close(u("12.7mm + 1/2 in", 1.0).0, 25.4, 1e-12);
        close(u("3 7/16\"", 1.0).0, 3.4375 * 25.4, 1e-12);
        close(u("3-7/16in", 25.4).0, 3.4375, 0.0);
        close(u("5' 3 1/2\"", 25.4).0, 63.5, 1e-12);
        close(u("5'", 25.4).0, 60.0, 1e-12);
        close(u("2 ft", 1.0).0, 609.6, 1e-12);
        close(u("5 thou", 1.0).0, 0.127, 1e-15);
        close(u("25 um", 1.0).0, 0.025, 1e-15);
        close(u("2 * 3 mm", 1.0).0, 6.0, 0.0);
        close(u("(1 + 2) cm", 1.0).0, 30.0, 0.0);
        assert!(u("1 in", 1.0).1);
        assert!(!u("1 + 2", 1.0).1);
        // Without a base, units are refused; names that are not units still fail.
        assert!(matches!(eval("1 in", true, 0.0), Eval::Err(_, _)));
        assert!(matches!(eval_units("2 pi", true, 0.0, 1.0).0, Eval::Err(_, _)));
        assert!(matches!(eval_units("5' 3", true, 0.0, 25.4).0, Eval::Err(_, _)));
        // min( and max( after a value are not the unit m.
        assert!(matches!(eval_units("2 min(1, 2)", true, 0.0, 1.0).0, Eval::Err(_, _)));
    }

    #[test]
    fn degrees_minutes_seconds() {
        close(ok("29\u{b0}30'", true), 29.5, 1e-12);
        close(ok("29\u{b0}30'15\"", true), 29.0 + 30.0 / 60.0 + 15.0 / 3600.0, 1e-12);
        close(ok("29\u{b0} 30' 15\"", true), 29.0 + 30.0 / 60.0 + 15.0 / 3600.0, 1e-12);
        close(ok("-0\u{b0}30'", true), -0.5, 1e-12);
        close(ok("sin(30\u{b0})", true), 0.5, 1e-12);
        close(ok("10\u{b0} + 5", true), 15.0, 0.0);
        close(ok("0\u{b0}0'36\"", true), 0.01, 1e-12);
        assert!(matches!(eval("10\u{b0} 5", true, 0.0), Eval::Err(_, _)));
    }

    #[test]
    fn percent_and_mod() {
        close(ok("15%", true), 0.15, 1e-15);
        close(ok("200*15%", true), 30.0, 1e-12);
        close(ok("(50)% + 1", true), 1.5, 1e-15);
        close(ok("7 % 3", true), 1.0, 0.0);
        close(ok("7%3", true), 1.0, 0.0);
        close(ok("mod(7.5, 2)", true), 1.5, 0.0);
        assert!(matches!(eval("mod(1, 0)", true, 0.0), Eval::Err(_, _)));
    }

    #[test]
    fn helpers() {
        let d = deg_to_dms(29.508333333333);
        close(d[0], 29.0, 0.0); close(d[1], 30.0, 0.0); close(d[2], 30.0, 1e-5);
        assert_eq!(deg_to_dms(-0.5), [0.0, -30.0, 0.0]);
        assert_eq!(prime_factors(127.0), vec![127.0]);
        assert_eq!(prime_factors(360.0), vec![2.0, 2.0, 2.0, 3.0, 3.0, 5.0]);
        assert!(prime_factors(1.0).is_empty());
        close(interpolate(10.0, 100.0, 20.0, 200.0, 12.5), 125.0, 1e-12);
    }
}
