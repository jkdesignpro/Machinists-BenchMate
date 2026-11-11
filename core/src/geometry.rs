//! Shop geometry: triangles, circles and arcs, sine bar and gauge-block
//! stacks, dividing-head indexing, stock weight, sheet-metal bends,
//! fillets and tangent points, dovetail and V-groove measurement over pins.
//!
//! Pure plane geometry and trigonometry. Sources and worked examples are
//! listed in docs/geometry.md. Angles are in degrees at the API unless the
//! name says `_rad`.

use std::f64::consts::PI;

fn rad(d: f64) -> f64 { d * PI / 180.0 }
fn deg(r: f64) -> f64 { r * 180.0 / PI }

// ---------------------------------------------------------------------------
// Triangles

/// A solved triangle: sides a, b, c and the opposite angles A, B, C (degrees).
pub type Tri = [f64; 6];

/// Solve a triangle from any three known values (NaN = unknown), at least one
/// of them a side. Returns 0, 1 or 2 solutions (two only in the ambiguous
/// side-side-angle case). Law of sines, law of cosines, angle sum 180.
pub fn solve_triangle(a: f64, b: f64, c: f64, aa: f64, bb: f64, cc: f64) -> Vec<Tri> {
    let mut s = [a, b, c];
    let mut g = [aa, bb, cc];
    let known = |x: f64| x.is_finite();
    let ns = s.iter().filter(|x| known(**x)).count();
    let na = g.iter().filter(|x| known(**x)).count();
    if ns + na != 3 || ns == 0 { return vec![]; }
    if s.iter().any(|x| known(*x) && *x <= 0.0) || g.iter().any(|x| known(*x) && (*x <= 0.0 || *x >= 180.0)) { return vec![]; }
    let finish = |s: [f64; 3], g: [f64; 3]| -> Option<Tri> {
        let ok = s.iter().all(|x| x.is_finite() && *x > 0.0) && g.iter().all(|x| x.is_finite() && *x > 0.0)
            && ((g[0] + g[1] + g[2]) - 180.0).abs() < 1e-6;
        if ok { Some([s[0], s[1], s[2], g[0], g[1], g[2]]) } else { None }
    };
    // Two angles known: the third follows, then sides by the law of sines.
    if na == 2 {
        let u = (0..3).find(|i| !known(g[*i])).unwrap();
        let sum: f64 = (0..3).filter(|i| *i != u).map(|i| g[i]).sum();
        if sum >= 180.0 { return vec![]; }
        g[u] = 180.0 - sum;
        let i = (0..3).find(|i| known(s[*i])).unwrap();
        let k = s[i] / rad(g[i]).sin();
        for j in 0..3 { if j != i { s[j] = k * rad(g[j]).sin(); } }
        return finish(s, g).into_iter().collect();
    }
    let sss = |s: [f64; 3]| -> Option<Tri> {
        let (a, b, c) = (s[0], s[1], s[2]);
        if a + b <= c || a + c <= b || b + c <= a { return None; }
        let ga = deg(((b * b + c * c - a * a) / (2.0 * b * c)).clamp(-1.0, 1.0).acos());
        let gb = deg(((a * a + c * c - b * b) / (2.0 * a * c)).clamp(-1.0, 1.0).acos());
        finish(s, [ga, gb, 180.0 - ga - gb])
    };
    if ns == 3 { return sss(s).into_iter().collect(); }
    // Two sides and one angle.
    let ia = (0..3).find(|i| known(g[*i])).unwrap();
    let us = (0..3).find(|i| !known(s[*i])).unwrap();
    if ia == us {
        // SAS: the angle is between the known sides.
        let (j, k) = ((us + 1) % 3, (us + 2) % 3);
        s[us] = (s[j] * s[j] + s[k] * s[k] - 2.0 * s[j] * s[k] * rad(g[ia]).cos()).sqrt();
        return sss(s).into_iter().collect();
    }
    // SSA: known angle ia with its opposite side known; other known side j.
    let j = (0..3).find(|i| *i != ia && known(s[*i])).unwrap();
    let sin_j = s[j] * rad(g[ia]).sin() / s[ia];
    if sin_j > 1.0 + 1e-12 { return vec![]; }
    let b1 = if sin_j > 1.0 - 1e-13 { 90.0 } else { deg(sin_j.asin()) };
    let mut out = vec![];
    for gj in [b1, 180.0 - b1] {
        if g[ia] + gj >= 180.0 - 1e-9 { continue; }
        if out.iter().any(|t: &Tri| (t[3 + j] - gj).abs() < 1e-6) { continue; }
        let mut g2 = g; g2[j] = gj; g2[us] = 180.0 - g[ia] - gj;
        let mut s2 = s; s2[us] = s[ia] * rad(g2[us]).sin() / rad(g[ia]).sin();
        if let Some(t) = finish(s2, g2) { out.push(t); }
    }
    out
}

/// Triangle area from a solved triangle: (1/2) a b sin C.
pub fn triangle_area(t: &Tri) -> f64 { 0.5 * t[0] * t[1] * rad(t[5]).sin() }

/// Flat form for WebAssembly: `which` 0..5 = a, b, c, A, B, C of solution
/// `sol`; 6 = area; 9 = number of solutions.
pub fn solve_triangle_flat(a: f64, b: f64, c: f64, aa: f64, bb: f64, cc: f64, sol: f64, which: f64) -> f64 {
    let v = solve_triangle(a, b, c, aa, bb, cc);
    if which as i32 == 9 { return v.len() as f64; }
    match v.get(sol as usize) {
        Some(t) if (which as usize) < 6 => t[which as usize],
        Some(t) if which as i32 == 6 => triangle_area(t),
        _ => f64::NAN,
    }
}

// ---------------------------------------------------------------------------
// Circles, chords, arcs, segments

/// Chord length for radius R and included angle theta (degrees): 2 R sin(theta/2).
pub fn chord_length(r: f64, theta: f64) -> f64 { 2.0 * r * rad(theta / 2.0).sin() }
/// Arc length: R x theta (radians).
pub fn arc_length(r: f64, theta: f64) -> f64 { r * rad(theta) }
/// Sagitta (arc height above the chord): R (1 - cos(theta/2)).
pub fn sagitta(r: f64, theta: f64) -> f64 { r * (1.0 - rad(theta / 2.0).cos()) }
/// Area of the circular segment between chord and arc: R^2/2 (theta - sin theta).
pub fn segment_area(r: f64, theta: f64) -> f64 { r * r / 2.0 * (rad(theta) - rad(theta).sin()) }
/// Area of the sector: R^2 theta / 2.
pub fn sector_area(r: f64, theta: f64) -> f64 { r * r * rad(theta) / 2.0 }
/// Radius from chord c and sagitta s: (c^2/4 + s^2) / (2 s).
pub fn radius_from_chord_sagitta(c: f64, s: f64) -> f64 {
    if !(c > 0.0 && s > 0.0) { return f64::NAN; }
    (c * c / 4.0 + s * s) / (2.0 * s)
}
/// Included angle (degrees) of the minor arc for chord c on radius R.
pub fn angle_from_chord(c: f64, r: f64) -> f64 {
    if !(c > 0.0 && r > 0.0) || c > 2.0 * r + 1e-12 { return f64::NAN; }
    2.0 * deg((c / (2.0 * r)).min(1.0).asin())
}
/// Included angle (degrees) from sagitta s on radius R (s up to 2R gives up to 360).
pub fn angle_from_sagitta(s: f64, r: f64) -> f64 {
    if !(s > 0.0 && r > 0.0) || s > 2.0 * r + 1e-12 { return f64::NAN; }
    2.0 * deg((1.0 - s / r).max(-1.0).acos())
}

/// Solve the arc from two knowns. `mode`: 1 R and angle, 2 R and chord,
/// 3 R and sagitta, 4 chord and sagitta, 5 R and arc length.
/// Returns (R, theta in degrees).
pub fn arc_solve(mode: u32, x: f64, y: f64) -> (f64, f64) {
    match mode {
        1 => (x, if y > 0.0 && y <= 360.0 { y } else { f64::NAN }),
        2 => (x, angle_from_chord(y, x)),
        3 => (x, angle_from_sagitta(y, x)),
        4 => { let r = radius_from_chord_sagitta(x, y); (r, angle_from_sagitta(y, r)) }
        5 => (x, if x > 0.0 && y > 0.0 && y <= 2.0 * PI * x + 1e-12 { deg(y / x) } else { f64::NAN }),
        _ => (f64::NAN, f64::NAN),
    }
}

/// Root of `f` on [lo, hi] by bisection. `f(lo)` and `f(hi)` must differ in
/// sign (or one be zero); NaN otherwise. Bisection halves the bracket every
/// step, so it always converges, to the last bit of the bracket (at most 200 steps).
pub fn bisect<F: Fn(f64) -> f64>(f: F, mut lo: f64, mut hi: f64) -> f64 {
    let (mut flo, fhi) = (f(lo), f(hi));
    if flo == 0.0 { return lo; }
    if fhi == 0.0 { return hi; }
    if !(flo.is_finite() && fhi.is_finite()) || flo.signum() == fhi.signum() { return f64::NAN; }
    for _ in 0..200 {
        let mid = 0.5 * (lo + hi);
        if mid <= lo || mid >= hi { break; }
        let fm = f(mid);
        if fm == 0.0 { return mid; }
        if fm.signum() == flo.signum() { lo = mid; flo = fm; } else { hi = mid; }
    }
    0.5 * (lo + hi)
}

/// Half angle u* (radians, between pi/2 and pi) where sagitta / arc length is
/// largest: d/du [(1 - cos u) / (2u)] = 0, i.e. u sin u = 1 - cos u (about 2.3311,
/// an included angle of about 267.1 deg). Below it the ratio rises with the angle,
/// above it the ratio falls, so a sagitta and an arc length can fit two arcs.
pub fn arc_sl_peak() -> f64 { bisect(|u| u * u.sin() - (1.0 - u.cos()), PI / 2.0, PI) }

/// Every arc (R, included angle in degrees, 0 < angle <= 360) with the two known
/// values `a` of kind `ka` and `b` of kind `kb`. Kinds: 0 radius, 1 included angle
/// (degrees), 2 chord, 3 arc length, 4 sagitta (height of the arc above the chord).
/// Closed forms where they exist; chord + arc length and sagitta + arc length are
/// solved for the half angle u by bisection on a bracket where the function is
/// monotonic. Several solutions are returned in order of angle:
/// radius + chord gives the minor and the major arc; sagitta + arc length gives
/// two arcs when s/L lies between 1/pi and the peak at u*.
pub fn arc_from_two(ka: u32, a: f64, kb: u32, b: f64) -> Vec<(f64, f64)> {
    if ka == kb || !(a > 0.0 && b > 0.0) || ka > 4 || kb > 4 { return vec![]; }
    let (k1, x, k2, y) = if ka < kb { (ka, a, kb, b) } else { (kb, b, ka, a) };
    let mut cand: Vec<(f64, f64)> = Vec::new();
    let mut push = |r: f64, t: f64| cand.push((r, t));
    match (k1, k2) {
        (0, 1) => push(x, y),
        (0, 2) => { let t = angle_from_chord(y, x); push(x, t); if y < 2.0 * x * (1.0 - 1e-12) { push(x, 360.0 - t); } }
        (0, 3) => push(x, deg(y / x)),
        (0, 4) => push(x, angle_from_sagitta(y, x)),
        (1, 2) => if x < 360.0 { push(y / (2.0 * rad(x / 2.0).sin()), x) },
        (1, 3) => push(y / rad(x), x),
        (1, 4) => push(y / (1.0 - rad(x / 2.0).cos()), x),
        (2, 3) => {
            // c = 2 R sin u, L = 2 R u: sin(u)/u = c/L, falling from 1 to 0 on (0, pi].
            if y > x {
                let k = x / y;
                let u = bisect(|u| (if u == 0.0 { 1.0 } else { u.sin() / u }) - k, 0.0, PI);
                if u > 0.0 { push(x / (2.0 * u.sin()), 2.0 * deg(u)); }
            }
        }
        (2, 4) => { let r = radius_from_chord_sagitta(x, y); push(r, angle_from_sagitta(y, r)); }
        (3, 4) => {
            // L = 2 R u, s = R (1 - cos u): q(u) = s/L = (1 - cos u)/(2u), rising on (0, u*], falling on [u*, pi].
            let k = y / x;
            let q = |u: f64| if u == 0.0 { 0.0 } else { (1.0 - u.cos()) / (2.0 * u) };
            let us = arc_sl_peak();
            for (lo, hi) in [(0.0, us), (us, PI)] {
                let u = bisect(|u| q(u) - k, lo, hi);
                if u > 0.0 { push(x / (2.0 * u), 2.0 * deg(u)); }
            }
        }
        _ => {}
    }
    let mut out: Vec<(f64, f64)> = cand.into_iter()
        .filter(|&(r, t)| r.is_finite() && r > 0.0 && t.is_finite() && t > 0.0 && t <= 360.0 + 1e-9)
        .map(|(r, t)| (r, t.min(360.0))).collect();
    out.sort_by(|p, q| p.1.partial_cmp(&q.1).unwrap());
    out.dedup_by(|p, q| (p.1 - q.1).abs() < 1e-7 * q.1.max(1.0));
    out
}

/// Flat form for WebAssembly: solution `sol` of `arc_from_two`; `which` as in
/// `arc_solve_flat` (0 R, 1 angle, 2 chord, 3 arc length, 4 sagitta, 5 segment
/// area, 6 sector area, 7 diameter); 9 = number of solutions.
pub fn arc_two_flat(ka: f64, a: f64, kb: f64, b: f64, sol: f64, which: f64) -> f64 {
    let v = arc_from_two(ka as u32, a, kb as u32, b);
    if which as i32 == 9 { return v.len() as f64; }
    let Some(&(r, t)) = v.get(sol as usize) else { return f64::NAN };
    match which as i32 {
        0 => r, 1 => t, 2 => chord_length(r, t), 3 => arc_length(r, t), 4 => sagitta(r, t),
        5 => segment_area(r, t), 6 => sector_area(r, t), 7 => 2.0 * r, _ => f64::NAN,
    }
}

/// `which`: 0 R, 1 angle, 2 chord, 3 arc length, 4 sagitta, 5 segment area,
/// 6 sector area, 7 diameter.
pub fn arc_solve_flat(mode: f64, x: f64, y: f64, which: f64) -> f64 {
    let (r, t) = arc_solve(mode as u32, x, y);
    if !(r > 0.0 && t > 0.0) { return f64::NAN; }
    match which as i32 {
        0 => r, 1 => t, 2 => chord_length(r, t), 3 => arc_length(r, t), 4 => sagitta(r, t),
        5 => segment_area(r, t), 6 => sector_area(r, t), 7 => 2.0 * r, _ => f64::NAN,
    }
}

/// Circle through three points: (cx, cy, r). NaN if the points are in line.
pub fn circle_3pts(x1: f64, y1: f64, x2: f64, y2: f64, x3: f64, y3: f64) -> (f64, f64, f64) {
    let d = 2.0 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    let scale = [x1, y1, x2, y2, x3, y3].iter().fold(1.0f64, |m, v| m.max(v.abs()));
    if d.abs() < 1e-12 * scale * scale { return (f64::NAN, f64::NAN, f64::NAN); }
    let s1 = x1 * x1 + y1 * y1;
    let s2 = x2 * x2 + y2 * y2;
    let s3 = x3 * x3 + y3 * y3;
    let cx = (s1 * (y2 - y3) + s2 * (y3 - y1) + s3 * (y1 - y2)) / d;
    let cy = (s1 * (x3 - x2) + s2 * (x1 - x3) + s3 * (x2 - x1)) / d;
    (cx, cy, ((x1 - cx).powi(2) + (y1 - cy).powi(2)).sqrt())
}
pub fn circle_3pts_flat(x1: f64, y1: f64, x2: f64, y2: f64, x3: f64, y3: f64, which: f64) -> f64 {
    let (cx, cy, r) = circle_3pts(x1, y1, x2, y2, x3, y3);
    match which as i32 { 0 => cx, 1 => cy, 2 => r, _ => f64::NAN }
}

// ---------------------------------------------------------------------------
// Sine bar and gauge blocks

/// Gauge-block height under the roll of a sine bar of centre distance L to set
/// angle theta: H = L sin(theta).
pub fn sine_bar_height(l: f64, theta: f64) -> f64 {
    if !(l > 0.0) || !(0.0..=90.0).contains(&theta) { return f64::NAN; }
    l * rad(theta).sin()
}
/// Angle set by a stack H under a sine bar of length L: asin(H / L), degrees.
pub fn sine_bar_angle(l: f64, h: f64) -> f64 {
    if !(l > 0.0 && h >= 0.0 && h <= l) { return f64::NAN; }
    deg((h / l).asin())
}

/// Gauge-block stack with the fewest blocks that makes `target` exactly from
/// `blocks` (each block used at most once; list a size twice if the set has
/// two). All sizes must be whole multiples of `unit` (e.g. 0.0005 mm or
/// 0.00005 in). Returns the indices of the blocks used, or None.
/// Exact 0/1 minimum-count dynamic programme over sizes in `unit` steps.
pub fn gauge_stack(blocks: &[f64], target: f64, unit: f64) -> Option<Vec<usize>> {
    if !(unit > 0.0) || !(target > 0.0) { return None; }
    let q = |x: f64| -> Option<usize> {
        let k = x / unit;
        if (k - k.round()).abs() > 1e-6 * k.max(1.0) || k < 0.5 { None } else { Some(k.round() as usize) }
    };
    let t = q(target)?;
    const MAX_UNITS: usize = 2_000_000;
    if t > MAX_UNITS { return None; }
    let w: Vec<usize> = blocks.iter().map(|b| q(*b)).collect::<Option<Vec<_>>>()?;
    let n = w.len();
    const INF: u16 = u16::MAX;
    let mut dp = vec![INF; t + 1];
    dp[0] = 0;
    let words = t / 64 + 1;
    let mut take = vec![0u64; n * words];
    for (i, &wi) in w.iter().enumerate() {
        if wi == 0 || wi > t { continue; }
        for j in (wi..=t).rev() {
            let p = dp[j - wi];
            if p != INF && p + 1 < dp[j] {
                dp[j] = p + 1;
                take[i * words + j / 64] |= 1u64 << (j % 64);
            }
        }
    }
    if dp[t] == INF { return None; }
    let mut used = vec![];
    let mut j = t;
    for i in (0..n).rev() {
        if j == 0 { break; }
        if take[i * words + j / 64] >> (j % 64) & 1 == 1 { used.push(i); j -= w[i]; }
    }
    if j != 0 { return None; }
    used.reverse();
    Some(used)
}

// ---------------------------------------------------------------------------
// Dividing head / rotary table indexing

/// Greatest common divisor of two integers.
pub fn gcd_u(a: u64, b: u64) -> u64 { if b == 0 { a } else { gcd_u(b, a % b) } }

/// Crank movement for `num/den` crank turns (whole turns, then holes on a
/// circle). Returns (whole turns, holes, circle) for every circle in
/// `circles` that gives an exact result, smallest circle first.
pub fn index_fraction(num: u64, den: u64, circles: &[u64]) -> Vec<(u64, u64, u64)> {
    if den == 0 { return vec![]; }
    let whole = num / den;
    let r = num % den;
    let g = gcd_u(r, den).max(1);
    let (rn, rd) = (r / g, den / g);
    let mut out: Vec<(u64, u64, u64)> = circles.iter().filter(|&&h| h > 0 && (r == 0 || h % rd == 0))
        .map(|&h| (whole, if r == 0 { 0 } else { rn * (h / rd) }, h)).collect();
    out.sort_by_key(|x| x.2);
    out.dedup();
    out
}

/// Simple indexing: crank turns = ratio / N.
pub fn index_simple(ratio: u64, n: u64, circles: &[u64]) -> Vec<(u64, u64, u64)> {
    if n == 0 { return vec![]; }
    index_fraction(ratio, n, circles)
}

/// Angular indexing: crank turns = ratio x angle / 360, angle in degrees,
/// minutes and seconds (whole numbers).
pub fn index_angle(ratio: u64, d: u64, m: u64, s: u64, circles: &[u64]) -> Vec<(u64, u64, u64)> {
    let secs = d * 3600 + m * 60 + s;
    index_fraction(ratio * secs, 1_296_000, circles)
}

/// One differential-indexing set-up.
#[derive(Debug, Clone, PartialEq)]
pub struct Differential {
    /// Approximate division A' indexed with the plate.
    pub approx: u64,
    /// (whole turns, holes, circle) for A'.
    pub crank: (u64, u64, u64),
    /// Required gear ratio driver/driven = ratio x (A' - N) / A' (absolute value).
    pub gear_ratio: f64,
    /// True if A' > N (decides the number of idlers: simple train 1 or 3 when A' > N, none or 2 when A' < N).
    pub same_direction: bool,
    /// Gears: [driver, driven] for a simple train, or [driver1, driven1, driver2, driven2] compound.
    pub gears: Vec<u64>,
}

/// Change gears (from `gears`, each used at most once) giving exactly `num/den`:
/// a simple pair first, otherwise a compound pair of pairs.
pub fn change_gears(num: u64, den: u64, gears: &[u64]) -> Option<Vec<u64>> {
    let n = gears.len();
    for i in 0..n { for j in 0..n {
        if i != j && gears[i] * den == gears[j] * num { return Some(vec![gears[i], gears[j]]); }
    } }
    for a in 0..n { for b in 0..n { if b == a { continue; }
        for c in 0..n { if c == a || c == b { continue; }
            for d in 0..n { if d == a || d == b || d == c { continue; }
                if gears[a] * gears[c] * den == gears[b] * gears[d] * num { return Some(vec![gears[a], gears[b], gears[c], gears[d]]); }
            } } } }
    None
}

/// Differential indexing for N divisions: tries A' = N +/- 1, 2, ... up to
/// `max_offset`, nearest first (A' above N tried before A' below at equal
/// distance), and returns the first A' that the plates index exactly and for
/// which the change gears give the ratio ratio x |A' - N| / A' exactly.
pub fn index_differential(ratio: u64, n: u64, circles: &[u64], gears: &[u64], max_offset: u64) -> Option<Differential> {
    if n < 2 { return None; }
    for off in 1..=max_offset {
        for ap in [n + off, n.saturating_sub(off)] {
            if ap < 2 || ap == n { continue; }
            let crank = match index_simple(ratio, ap, circles).into_iter().next() { Some(c) => c, None => continue };
            let diff = ap.abs_diff(n);
            let (gn, gd) = (ratio * diff, ap);
            let g = gcd_u(gn, gd);
            if let Some(gs) = change_gears(gn / g, gd / g, gears) {
                return Some(Differential { approx: ap, crank, gear_ratio: gn as f64 / gd as f64, same_direction: ap > n, gears: gs });
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Stock weight

/// Cross-section area of stock. `shape`: 1 round (d), 2 hex across flats (s),
/// 3 square (s), 4 tube (outside D = a, wall = b), 5 flat / plate / sheet
/// (width a, thickness b).
pub fn stock_area(shape: u32, a: f64, b: f64) -> f64 {
    match shape {
        1 => if a > 0.0 { PI * a * a / 4.0 } else { f64::NAN },
        2 => if a > 0.0 { 3f64.sqrt() / 2.0 * a * a } else { f64::NAN },
        3 => if a > 0.0 { a * a } else { f64::NAN },
        4 => if a > 0.0 && b > 0.0 && 2.0 * b <= a { PI / 4.0 * (a * a - (a - 2.0 * b).powi(2)) } else { f64::NAN },
        5 => if a > 0.0 && b > 0.0 { a * b } else { f64::NAN },
        _ => f64::NAN,
    }
}
/// Mass = area x length x density (consistent units: mm^2, mm, kg/m^3 -> kg
/// needs the 1e-9 factor, which the caller applies with `mass_metric_kg`).
pub fn mass_metric_kg(area_mm2: f64, len_mm: f64, density_kg_m3: f64) -> f64 {
    if !(area_mm2 > 0.0 && len_mm > 0.0 && density_kg_m3 > 0.0) { return f64::NAN; }
    area_mm2 * len_mm * 1e-9 * density_kg_m3
}

// ---------------------------------------------------------------------------
// Sheet-metal bends

/// Bend allowance (arc length of the neutral axis):
/// BA = (pi/180) x bend angle x (R + K t). Bend angle is the angle the
/// flange is bent through (90 for a right-angle bend), R the inside radius.
pub fn bend_allowance(angle: f64, r: f64, k: f64, t: f64) -> f64 {
    if !(angle > 0.0 && angle < 180.0 && r >= 0.0 && t > 0.0 && (0.0..=1.0).contains(&k)) { return f64::NAN; }
    rad(angle) * (r + k * t)
}
/// Outside setback: tan(angle/2) x (R + t).
pub fn outside_setback(angle: f64, r: f64, t: f64) -> f64 {
    if !(angle > 0.0 && angle < 180.0 && r >= 0.0 && t > 0.0) { return f64::NAN; }
    rad(angle / 2.0).tan() * (r + t)
}
/// Bend deduction: 2 x outside setback - bend allowance.
pub fn bend_deduction(angle: f64, r: f64, k: f64, t: f64) -> f64 {
    2.0 * outside_setback(angle, r, t) - bend_allowance(angle, r, k, t)
}
/// K-factor from a measured bend allowance: (BA / angle_rad - R) / t.
pub fn k_from_bend_allowance(angle: f64, r: f64, t: f64, ba: f64) -> f64 {
    if !(angle > 0.0 && t > 0.0 && ba > 0.0) { return f64::NAN; }
    (ba / rad(angle) - r) / t
}

// ---------------------------------------------------------------------------
// Fillets and tangent points

/// Fillet of radius r in a corner at (px, py) between two legs leaving the
/// corner at directions d1 and d2 (degrees). Returns (t1x, t1y, t2x, t2y,
/// cx, cy, tangent distance). NaN if the legs are parallel.
pub fn fillet_line_line(px: f64, py: f64, d1: f64, d2: f64, r: f64) -> [f64; 7] {
    let (u1, u2) = ((rad(d1).cos(), rad(d1).sin()), (rad(d2).cos(), rad(d2).sin()));
    let cosa = (u1.0 * u2.0 + u1.1 * u2.1).clamp(-1.0, 1.0);
    let alpha = cosa.acos(); // included angle between the legs
    if !(r > 0.0) || alpha < 1e-9 || (PI - alpha) < 1e-9 { return [f64::NAN; 7]; }
    let td = r / (alpha / 2.0).tan();
    let bis = (u1.0 + u2.0, u1.1 + u2.1);
    let bl = (bis.0 * bis.0 + bis.1 * bis.1).sqrt();
    let dc = r / (alpha / 2.0).sin();
    [px + u1.0 * td, py + u1.1 * td, px + u2.0 * td, py + u2.1 * td, px + bis.0 / bl * dc, py + bis.1 / bl * dc, td]
}

/// Fillets of radius r between the infinite line through (x1,y1)-(x2,y2) and
/// the circle centre (cx,cy) radius R. `outside`: the fillet touches the
/// circle from outside (centre at R + r) or from inside (R - r). `side`:
/// +1 fillet centre left of the line direction, -1 right. Returns up to two
/// solutions, each (fillet centre x, y, tangent point on line x, y, tangent
/// point on circle x, y).
pub fn fillet_line_circle(x1: f64, y1: f64, x2: f64, y2: f64, cx: f64, cy: f64, rr: f64, r: f64, outside: bool, side: f64) -> Vec<[f64; 6]> {
    let (dx, dy) = (x2 - x1, y2 - y1);
    let l = (dx * dx + dy * dy).sqrt();
    if !(l > 0.0 && rr > 0.0 && r > 0.0) || (!outside && r >= rr) { return vec![]; }
    let (ux, uy) = (dx / l, dy / l);
    let (nx, ny) = (-uy * side.signum(), ux * side.signum());
    // Offset line: points p0 + t u with p0 = (x1,y1) + r n.
    let (ox, oy) = (x1 + nx * r, y1 + ny * r);
    let rc = if outside { rr + r } else { rr - r };
    // Solve |p0 + t u - c| = rc.
    let (wx, wy) = (ox - cx, oy - cy);
    let b = wx * ux + wy * uy;
    let c = wx * wx + wy * wy - rc * rc;
    let disc = b * b - c;
    if disc < -1e-12 { return vec![]; }
    let sq = disc.max(0.0).sqrt();
    let mut out = vec![];
    for t in [-b - sq, -b + sq] {
        let (fx, fy) = (ox + ux * t, oy + uy * t);
        if out.iter().any(|s: &[f64; 6]| (s[0] - fx).abs() < 1e-12 && (s[1] - fy).abs() < 1e-12) { continue; }
        let (tlx, tly) = (fx - nx * r, fy - ny * r);
        let (ex, ey) = (fx - cx, fy - cy);
        let el = (ex * ex + ey * ey).sqrt();
        out.push([fx, fy, tlx, tly, cx + ex / el * rr, cy + ey / el * rr]);
    }
    out
}

// ---------------------------------------------------------------------------
// Dovetails and V-grooves measured over pins

/// Distance from the sharp corner to the pin's centre line, measured along
/// the base: (d/2) cot(alpha/2), where alpha is the corner angle between the
/// base and the flank (e.g. 60 for a 60-degree dovetail).
fn pin_offset(alpha: f64, d: f64) -> f64 { d / 2.0 / rad(alpha / 2.0).tan() }

/// Male dovetail: measurement over two pins sitting in the root corners,
/// W = width between the sharp root corners: M = W + d (1 + cot(alpha/2)).
pub fn dovetail_male_over_pins(w: f64, alpha: f64, d: f64) -> f64 {
    if !(w > 0.0 && d > 0.0 && alpha > 0.0 && alpha < 90.0) { return f64::NAN; }
    w + 2.0 * pin_offset(alpha, d) + d
}
/// Female dovetail: measurement between two pins in the bottom corners,
/// W = width between the sharp bottom corners: M = W - d (1 + cot(alpha/2)).
pub fn dovetail_female_between_pins(w: f64, alpha: f64, d: f64) -> f64 {
    if !(w > 0.0 && d > 0.0 && alpha > 0.0 && alpha < 90.0) { return f64::NAN; }
    w - 2.0 * pin_offset(alpha, d) - d
}
/// Width at the sharp corners from the width at the other face and the depth h.
/// Male (narrow at the root): root = top - 2 h cot(alpha).
/// Female (wide at the bottom): bottom = top + 2 h cot(alpha).
pub fn dovetail_corner_width(top: f64, h: f64, alpha: f64, male: bool) -> f64 {
    if !(top > 0.0 && h > 0.0 && alpha > 0.0 && alpha < 90.0) { return f64::NAN; }
    let k = 2.0 * h / rad(alpha).tan();
    if male { top - k } else { top + k }
}
/// Distance along the flank from the corner to the pin's contact point,
/// (d/2) cot(alpha/2); the pin is valid only if this is less than the flank
/// length h / sin(alpha).
pub fn dovetail_contact_along_flank(alpha: f64, d: f64) -> f64 { pin_offset(alpha, d) }

/// V-groove of included angle beta and sharp top width W: height of the top
/// of a pin of diameter d above the top face (negative = below):
/// (d/2)/sin(beta/2) + d/2 - (W/2)/tan(beta/2).
pub fn vgroove_pin_height(w: f64, beta: f64, d: f64) -> f64 {
    if !(w > 0.0 && d > 0.0 && beta > 0.0 && beta < 180.0) { return f64::NAN; }
    d / 2.0 / rad(beta / 2.0).sin() + d / 2.0 - w / 2.0 / rad(beta / 2.0).tan()
}
/// The pin touches both flanks below the top edges if the contact point,
/// (d/2)/tan(beta/2) from the vertex along each flank, is less than the flank
/// length (W/2)/sin(beta/2). Returns that margin (positive = valid).
pub fn vgroove_contact_margin(w: f64, beta: f64, d: f64) -> f64 {
    w / 2.0 / rad(beta / 2.0).sin() - d / 2.0 / rad(beta / 2.0).tan()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }
    const N: f64 = f64::NAN;

    #[test]
    fn triangle_cases() {
        // 3-4-5 right triangle: A = atan(3/4) = 36.8699 deg.
        let t = solve_triangle(3.0, 4.0, 5.0, N, N, N);
        assert_eq!(t.len(), 1);
        close(t[0][3], 36.86989765, 1e-7); close(t[0][5], 90.0, 1e-9); close(triangle_area(&t[0]), 6.0, 1e-12);
        // Right triangle from hypotenuse and one angle (C = 90): c = 10, A = 30 -> a = 5, b = 8.660254.
        let t = solve_triangle(N, N, 10.0, 30.0, N, 90.0);
        close(t[0][0], 5.0, 1e-12); close(t[0][1], 8.660254038, 1e-9);
        // SAS: b = 5, c = 7, A = 60 -> a^2 = 25 + 49 - 35 = 39.
        let t = solve_triangle(N, 5.0, 7.0, 60.0, N, N);
        close(t[0][0], 39f64.sqrt(), 1e-12);
        // AAS: A = 40, B = 60, a = 10 -> c = 10 sin 80 / sin 40.
        let t = solve_triangle(10.0, N, N, 40.0, 60.0, N);
        close(t[0][2], 10.0 * rad(80.0).sin() / rad(40.0).sin(), 1e-12); close(t[0][5], 80.0, 1e-12);
        // SSA ambiguous: a = 6, b = 8, A = 35: sin B = 8 sin35 / 6 = 0.764765 -> B = 49.8864 or 130.1136.
        let t = solve_triangle(6.0, 8.0, N, 35.0, N, N);
        assert_eq!(t.len(), 2);
        close(t[0][4], 49.886408, 1e-5); close(t[1][4], 130.113592, 1e-5);
        for s in &t { // each solution satisfies the law of cosines
            close(s[2] * s[2], s[0] * s[0] + s[1] * s[1] - 2.0 * s[0] * s[1] * rad(s[5]).cos(), 1e-9);
        }
        // SSA no solution: a = 3, b = 8, A = 35 (8 sin 35 = 4.59 > 3).
        assert!(solve_triangle(3.0, 8.0, N, 35.0, N, N).is_empty());
        // SSA one solution (a >= b): a = 9, b = 8, A = 35.
        assert_eq!(solve_triangle(9.0, 8.0, N, 35.0, N, N).len(), 1);
        // SSA right-angle limit: a = 4, b = 8, A = 30 -> B = 90 only.
        let t = solve_triangle(4.0, 8.0, N, 30.0, N, N);
        assert_eq!(t.len(), 1); close(t[0][4], 90.0, 1e-6);
        // Invalid inputs.
        assert!(solve_triangle(1.0, 2.0, 3.0, N, N, N).is_empty());
        assert!(solve_triangle(N, N, N, 60.0, 60.0, 60.0).is_empty());
        assert!(solve_triangle(5.0, N, N, 100.0, 90.0, N).is_empty());
        close(solve_triangle_flat(3.0, 4.0, 5.0, N, N, N, 0.0, 9.0), 1.0, 0.0);
    }

    #[test]
    fn arcs_and_circles() {
        // R 50, 60 deg: chord = 50, arc = 52.35988, sagitta = 50 (1 - cos 30) = 6.69873.
        close(chord_length(50.0, 60.0), 50.0, 1e-12);
        close(arc_length(50.0, 60.0), 52.35987756, 1e-8);
        close(sagitta(50.0, 60.0), 6.698729811, 1e-9);
        // segment = 2500/2 (pi/3 - sin 60) = 226.3966
        close(segment_area(50.0, 60.0), 1250.0 * (PI / 3.0 - 3f64.sqrt() / 2.0), 1e-9);
        // Chord 80, sagitta 20 -> R = (1600 + 400) / 40 = 50.
        close(radius_from_chord_sagitta(80.0, 20.0), 50.0, 1e-12);
        let (r, t) = arc_solve(4, 80.0, 20.0);
        close(r, 50.0, 1e-12); close(chord_length(r, t), 80.0, 1e-9);
        // Sagitta beyond R: major arc.
        close(angle_from_sagitta(75.0, 50.0), 240.0, 1e-9); // 2 acos(1 - 1.5)
        assert!(angle_from_chord(120.0, 50.0).is_nan());
        close(arc_solve_flat(5.0, 50.0, 52.35987756, 1.0), 60.0, 1e-7);
        // Circle through (0,0), (10,0), (0,10): centre (5,5), r = 7.0710678.
        let (cx, cy, r) = circle_3pts(0.0, 0.0, 10.0, 0.0, 0.0, 10.0);
        close(cx, 5.0, 1e-12); close(cy, 5.0, 1e-12); close(r, 50f64.sqrt(), 1e-12);
        // Points on a known circle: centre (3, -2), r 7.
        let p = |a: f64| (3.0 + 7.0 * rad(a).cos(), -2.0 + 7.0 * rad(a).sin());
        let (a, b, c) = (p(10.0), p(100.0), p(250.0));
        let (cx, cy, r) = circle_3pts(a.0, a.1, b.0, b.1, c.0, c.1);
        close(cx, 3.0, 1e-9); close(cy, -2.0, 1e-9); close(r, 7.0, 1e-9);
        assert!(circle_3pts(0.0, 0.0, 1.0, 1.0, 2.0, 2.0).0.is_nan());
    }

    #[test]
    fn arc_from_any_two() {
        // Every pair rebuilds the arc it came from, for a minor and a major arc.
        for &(r, t) in &[(50.0, 60.0), (12.5, 135.0), (8.0, 300.0), (3.0, 1.0)] {
            let v = [r, t, chord_length(r, t), arc_length(r, t), sagitta(r, t)];
            for ka in 0..5u32 { for kb in (ka + 1)..5u32 {
                if ka == 1 && kb == 2 && t >= 360.0 { continue; }
                let sols = arc_from_two(ka, v[ka as usize], kb, v[kb as usize]);
                assert!(!sols.is_empty(), "pair {ka},{kb} for R {r} angle {t}");
                assert!(sols.iter().any(|&(rr, tt)| (rr - r).abs() < 1e-9 * r && (tt - t).abs() < 1e-8 * t.max(1.0)),
                    "pair {ka},{kb} for R {r} angle {t}: {sols:?}");
                // order of the two knowns does not matter
                assert_eq!(arc_from_two(kb, v[kb as usize], ka, v[ka as usize]).len(), sols.len());
            } }
        }
        // Radius and chord: minor and major arc. R 50, chord 50: 60 and 300 deg.
        let s = arc_from_two(0, 50.0, 2, 50.0);
        assert_eq!(s.len(), 2); close(s[0].1, 60.0, 1e-9); close(s[1].1, 300.0, 1e-9);
        // Chord 80, sagitta 20 -> R 50 (worked example already used for radius_from_chord_sagitta).
        let s = arc_from_two(2, 80.0, 4, 20.0); close(s[0].0, 50.0, 1e-12);
        // Chord and arc length: a semicircle of R 10 has c 20, L 10 pi.
        let s = arc_from_two(2, 20.0, 3, 10.0 * PI); assert_eq!(s.len(), 1); close(s[0].0, 10.0, 1e-9); close(s[0].1, 180.0, 1e-8);
        // Arc no longer than its chord: no arc.
        assert!(arc_from_two(2, 20.0, 3, 20.0).is_empty());
        // Sagitta and arc length: the peak of s/L is at u sin u = 1 - cos u, u = 2.33112 rad.
        let us = arc_sl_peak(); close(us * us.sin(), 1.0 - us.cos(), 1e-12); close(us, 2.331122, 1e-6);
        // s/L between 1/pi and the peak: two arcs. R 10, 250 deg gives one; the other has the same s/L.
        let (l, sg) = (arc_length(10.0, 250.0), sagitta(10.0, 250.0));
        let s = arc_from_two(3, l, 4, sg);
        assert_eq!(s.len(), 2);
        for &(rr, tt) in &s { close(arc_length(rr, tt), l, 1e-9); close(sagitta(rr, tt), sg, 1e-9); }
        assert!(s[0].1 < 267.1 && s[1].1 > 267.1);
        // Small s/L (shallow arc): one arc.
        assert_eq!(arc_from_two(3, arc_length(10.0, 30.0), 4, sagitta(10.0, 30.0)).len(), 1);
        // s/L above the peak: none.
        assert!(arc_from_two(3, 10.0, 4, 4.0).is_empty());
        // Flat form
        close(arc_two_flat(0.0, 50.0, 1.0, 60.0, 0.0, 2.0), 50.0, 1e-12);
        close(arc_two_flat(0.0, 50.0, 2.0, 50.0, 0.0, 9.0), 2.0, 0.0);
        // bisect: root of x^2 - 2 on [0, 2]
        close(bisect(|x| x * x - 2.0, 0.0, 2.0), 2f64.sqrt(), 1e-15);
        assert!(bisect(|x| x * x + 1.0, 0.0, 2.0).is_nan());
    }

    #[test]
    fn sine_bar() {
        // 100 mm bar, 30 deg: 50.000; 5 in bar, 15 deg: 1.29410.
        close(sine_bar_height(100.0, 30.0), 50.0, 1e-12);
        close(sine_bar_height(5.0, 15.0), 1.294095226, 1e-9);
        close(sine_bar_angle(5.0, 1.294095226), 15.0, 1e-7);
        assert!(sine_bar_angle(5.0, 6.0).is_nan());
    }

    fn metric_88() -> Vec<f64> {
        let mut v = vec![1.0005];
        for i in 1..=9 { v.push(1.0 + i as f64 * 0.001); }
        for i in 1..=49 { v.push(1.0 + i as f64 * 0.01); }
        for i in 1..=19 { v.push(i as f64 * 0.5); }
        for i in 1..=10 { v.push(i as f64 * 10.0); }
        v
    }

    #[test]
    fn gauge_stacks() {
        let set = metric_88();
        assert_eq!(set.len(), 88);
        // 41.3825: classic method 1.0005 + 1.002 + 1.38 + 8.0 + 30 = 5 blocks; check DP finds <= 5 and sums.
        let u = gauge_stack(&set, 41.3825, 0.0005).unwrap();
        let sum: f64 = u.iter().map(|i| set[*i]).sum();
        close(sum, 41.3825, 1e-9);
        assert!(u.len() <= 5);
        // Single block and two-block cases.
        assert_eq!(gauge_stack(&set, 30.0, 0.0005).unwrap().len(), 1);
        assert_eq!(gauge_stack(&set, 31.5, 0.0005).unwrap().len(), 2);
        // Below the smallest block: impossible. Each block used once: 0.5 + 0.5 is not allowed,
        // so with only the 0.5 block, 1.0 cannot be made.
        assert!(gauge_stack(&set, 0.3, 0.0005).is_none());
        assert!(gauge_stack(&[0.5], 1.0, 0.0005).is_none());
        assert_eq!(gauge_stack(&[0.5, 0.5], 1.0, 0.0005).unwrap().len(), 2);
        // Brute-force check of minimum count on several targets using blocks below 12 mm.
        let small: Vec<f64> = set.iter().cloned().filter(|x| *x < 12.0).collect();
        for tgt in [3.0125, 7.4535, 2.5085, 9.999] {
            let got = gauge_stack(&small, tgt, 0.0005);
            // brute force up to 4 blocks
            let n = small.len();
            let mut best = usize::MAX;
            let tq = (tgt / 0.0005).round() as i64;
            let q: Vec<i64> = small.iter().map(|x| (x / 0.0005).round() as i64).collect();
            for a in 0..n { if q[a] == tq { best = best.min(1); }
                for b in a + 1..n { if q[a] + q[b] == tq { best = best.min(2); }
                    for c in b + 1..n { if q[a] + q[b] + q[c] == tq { best = best.min(3); }
                        for d in c + 1..n { if q[a] + q[b] + q[c] + q[d] == tq { best = best.min(4); } } } } }
            let v = got.expect("stack exists");
            assert!(best <= 4, "brute force found none for {tgt}");
            assert_eq!(v.len(), best, "target {tgt}");
            close(v.iter().map(|i| small[*i]).sum::<f64>(), tgt, 1e-9);
        }
        // Not a multiple of the unit.
        assert!(gauge_stack(&set, 10.0001, 0.0005).is_none());
    }

    #[test]
    fn indexing() {
        // 40:1 head, 6 divisions: 6 2/3 turns -> 6 turns + 10 holes on a 15 circle, 12 on 18, ...
        let c = [15, 16, 17, 18, 19, 20, 21, 23, 27, 29, 31, 33, 37, 39, 41, 43, 47, 49];
        let s = index_simple(40, 6, &c);
        assert_eq!(s[0], (6, 10, 15));
        assert!(s.contains(&(6, 12, 18)) && s.contains(&(6, 14, 21)));
        // 40 divisions: exactly 1 turn, any circle, 0 holes.
        assert_eq!(index_simple(40, 40, &c)[0], (1, 0, 15));
        // 52 divisions: 40/52 = 10/13 -> needs a circle divisible by 13: 39 -> 30 holes.
        assert_eq!(index_simple(40, 52, &c), vec![(0, 30, 39)]);
        // 51 divisions: 40/51 -> 17 x 3 -> needs 51-hole circle: none.
        assert!(index_simple(40, 51, &c).is_empty());
        // Angle 15 deg 30 min on 40:1: 40 x 15.5 / 360 = 1 13/18 turns -> 13 holes on 18.
        assert!(index_angle(40, 15, 30, 0, &c).contains(&(1, 13, 18)));
        // Gears: ratio 2/3 from {24, 32, 36, 48}: 24/36 or 32/48.
        let g = change_gears(2, 3, &[24, 32, 36, 48]).unwrap();
        assert_eq!(g[0] * 3, g[1] * 2);
        // Compound: 7/10 from {24, 28, 32, 40, 48, 56, 64, 72}: e.g. 28/40 simple? 28*10 = 40*7 yes.
        assert_eq!(change_gears(7, 10, &[24, 28, 32, 40, 48]).unwrap(), vec![28, 40]);
        // Needs compound: 5/12 from {24, 32, 40, 48, 64, 72}: 40/... 40*12 = 480, 5*96: no 96; compound 40/48 x 24/48? only one 48.
        let gc = change_gears(5, 12, &[24, 32, 40, 48, 64, 72]).unwrap();
        assert_eq!(gc.len(), 4); assert_eq!(gc[0] * gc[2] * 12, gc[1] * gc[3] * 5);
        // Differential: 51 divisions (no 51-hole circle). Tries A' = 52, 50, 53, 49, ...
        let gears = [24, 24, 28, 32, 40, 44, 48, 56, 64, 72, 86, 100];
        let d = index_differential(40, 51, &c, &gears, 10).unwrap();
        let ok = d.gears.len() == 2 && d.gears[0] as f64 / d.gears[1] as f64 == d.gear_ratio
            || d.gears.len() == 4 && (d.gears[0] * d.gears[2]) as f64 / (d.gears[1] * d.gears[3]) as f64 - d.gear_ratio < 1e-12;
        assert!(ok, "{d:?}");
        assert_eq!(d.same_direction, d.approx > 51);
        close(d.gear_ratio, 40.0 * (d.approx as f64 - 51.0).abs() / d.approx as f64, 1e-12);
    }

    #[test]
    fn weights() {
        // Round 50 mm x 1000 mm steel 7850: area 1963.495 mm^2 -> 15.413 kg.
        close(mass_metric_kg(stock_area(1, 50.0, 0.0), 1000.0, 7850.0), 15.41343895, 1e-6);
        // Tube 60 x 5 wall: pi/4 (3600 - 2500) = 863.938 mm^2.
        close(stock_area(4, 60.0, 5.0), PI / 4.0 * 1100.0, 1e-9);
        // Hex 24 AF: 498.831 mm^2.
        close(stock_area(2, 24.0, 0.0), 3f64.sqrt() / 2.0 * 576.0, 1e-9);
        // Plate 200 x 10, 500 long, aluminium 2700: 2000 x 500 x 2.7e-6 = 2.7 kg.
        close(mass_metric_kg(stock_area(5, 200.0, 10.0), 500.0, 2700.0), 2.7, 1e-12);
        assert!(stock_area(4, 10.0, 6.0).is_nan());
    }

    #[test]
    fn bends() {
        // 90 deg, R 2, t 2, K 0.33: BA = pi/2 (2 + 0.66) = 4.17832; OSSB = 4; BD = 3.82168.
        close(bend_allowance(90.0, 2.0, 0.33, 2.0), PI / 2.0 * 2.66, 1e-12);
        close(outside_setback(90.0, 2.0, 2.0), 4.0, 1e-12);
        close(bend_deduction(90.0, 2.0, 0.33, 2.0), 8.0 - PI / 2.0 * 2.66, 1e-12);
        close(k_from_bend_allowance(90.0, 2.0, 2.0, PI / 2.0 * 2.66), 0.33, 1e-12);
        // Independent check: flat length of a 90 deg L with 50 and 30 outside flanges
        // = straight parts (50 - 4) + (30 - 4) + BA.
        let flat = 50.0 + 30.0 - bend_deduction(90.0, 2.0, 0.33, 2.0);
        close(flat, 46.0 + 26.0 + PI / 2.0 * 2.66, 1e-12);
        // 45 deg bend: OSSB = tan 22.5 (R + t).
        close(outside_setback(45.0, 1.0, 1.5), (PI / 8.0).tan() * 2.5, 1e-12);
    }

    #[test]
    fn fillets() {
        // Square corner at origin, legs along +X and +Y, r = 5: tangent points (5,0),(0,5), centre (5,5).
        let f = fillet_line_line(0.0, 0.0, 0.0, 90.0, 5.0);
        close(f[0], 5.0, 1e-12); close(f[1], 0.0, 1e-12); close(f[3], 5.0, 1e-12); close(f[4], 5.0, 1e-12); close(f[5], 5.0, 1e-12);
        // 60 deg corner: tangent distance r / tan 30.
        close(fillet_line_line(0.0, 0.0, 0.0, 60.0, 3.0)[6], 3.0 / (PI / 6.0).tan(), 1e-12);
        // Line y = 0 (left to right), circle centre (0, 20) R 10, fillet r 5 above the line, outside the circle:
        // centre at y = 5, distance 15 from (0,20) -> x = +/- sqrt(225 - 225) = 0 -> one solution (0,5).
        let s = fillet_line_circle(-10.0, 0.0, 10.0, 0.0, 0.0, 20.0, 10.0, 5.0, true, 1.0);
        assert_eq!(s.len(), 1); close(s[0][0], 0.0, 1e-6); close(s[0][1], 5.0, 1e-12);
        // Circle centre (0, 12) R 10, r 4 outside, above line: centre y = 4, |F - C| = 14 -> x = +/- sqrt(196 - 64).
        let s = fillet_line_circle(-10.0, 0.0, 10.0, 0.0, 0.0, 12.0, 10.0, 4.0, true, 1.0);
        assert_eq!(s.len(), 2);
        let x = (196.0f64 - 64.0).sqrt();
        close(s[0][0].abs(), x, 1e-9); close(s[0][2], s[0][0], 1e-12); close(s[0][3], 0.0, 1e-12);
        // Tangent point on circle at distance R from centre and on the line C-F.
        for q in &s {
            close(((q[4]).powi(2) + (q[5] - 12.0).powi(2)).sqrt(), 10.0, 1e-9);
            close(((q[0] - q[4]).powi(2) + (q[1] - q[5]).powi(2)).sqrt(), 4.0, 1e-9);
        }
        // Inside: circle centre (0, 6) R 10 crosses the line; fillet r 2 inside the circle, above the line:
        // centre y = 2, |F - C| = 8 -> x = +/- sqrt(64 - 16).
        let s = fillet_line_circle(-10.0, 0.0, 10.0, 0.0, 0.0, 6.0, 10.0, 2.0, false, 1.0);
        assert_eq!(s.len(), 2); close(s[1][0].abs(), 48f64.sqrt(), 1e-9);
        for q in &s { close(((q[0] - q[4]).powi(2) + (q[1] - q[5]).powi(2)).sqrt(), 2.0, 1e-9); }
    }

    #[test]
    fn dovetail_and_vgroove() {
        // Independent numeric check: construct the 60 deg male dovetail root corner at x = 0,
        // base y = 0 to the left (outside), flank going up-right... Pin centre must be at distance d/2
        // from the base and from the flank line.
        let (alpha, d) = (60.0f64, 10.0f64);
        let off = dovetail_contact_along_flank(alpha, d);
        // Corner at origin, base along -x, flank along direction at angle alpha above the -x axis? For the
        // male part the overhanging flank leans outward: direction (-cos a, sin a). Pin centre (-off, d/2).
        let (cx, cy) = (-off, d / 2.0);
        let (fx, fy) = (-rad(alpha).cos(), rad(alpha).sin());
        let dist_flank = (cx * fy - cy * fx).abs();
        close(dist_flank, d / 2.0, 1e-12);
        // Over-pins: W + 2 off + d, with W = 50: 50 + 2 x 8.660254 + 10 = 77.320508.
        close(dovetail_male_over_pins(50.0, 60.0, 10.0), 50.0 + 2.0 * 5.0 * 3f64.sqrt() + 10.0, 1e-9);
        close(dovetail_female_between_pins(80.0, 60.0, 10.0), 80.0 - 2.0 * 5.0 * 3f64.sqrt() - 10.0, 1e-9);
        // Corner width: male top 60, depth 10, 60 deg: root = 60 - 20 / tan 60 = 48.452995.
        close(dovetail_corner_width(60.0, 10.0, 60.0, true), 60.0 - 20.0 / 3f64.sqrt(), 1e-9);
        // V-groove 90 deg, W 20, pin 10: vertex depth 10; centre 5 / sin 45 = 7.0711 above vertex;
        // top of pin 7.0711 + 5 - 10 = 2.0711 above the top face.
        close(vgroove_pin_height(20.0, 90.0, 10.0), 5.0 * 2f64.sqrt() + 5.0 - 10.0, 1e-12);
        assert!(vgroove_contact_margin(20.0, 90.0, 10.0) > 0.0);
        assert!(vgroove_contact_margin(20.0, 90.0, 30.0) < 0.0);
    }
}
