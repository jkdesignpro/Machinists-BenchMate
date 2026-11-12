//! Measurement round 2 and shop maths: balls in countersinks and tapered
//! bores, external tapers over rolls, shrink and press fits, compound
//! angles, lathe change gears, shop economics, plane figures and solids,
//! micrometer and vernier scale readings.
//!
//! Pure geometry and arithmetic. Sources and worked examples are listed in
//! docs/sources.md (section "Measurement and shop maths"). Angles are in
//! degrees at the API. Lengths in any one unit (the caller converts).

use std::f64::consts::PI;

fn rad(d: f64) -> f64 { d * PI / 180.0 }
fn deg(r: f64) -> f64 { r * 180.0 / PI }

// ---------------------------------------------------------------------------
// Ball in a countersink or tapered bore (large end at the face)

/// Height of the top of a ball above the face of a countersink or tapered
/// bore (negative = below the face). `face_d` is the diameter of the cone at
/// the face, `included` the included angle.
///
/// The ball touches the cone wall, so its centre is r / sin(a) above the cone
/// apex (a = half angle); the face is (D/2) / tan(a) above the apex:
/// h = r + r / sin(a) - D / (2 tan(a)).
pub fn ball_height_in_cone(ball_d: f64, face_d: f64, included: f64) -> f64 {
    let a = rad(included / 2.0);
    let r = ball_d / 2.0;
    if !(r > 0.0 && a > 0.0 && a < PI / 2.0) { return f64::NAN; }
    r + r / a.sin() - face_d / (2.0 * a.tan())
}

/// Diameter of the cone at the face from the height of the ball top above
/// the face (negative = below): inverse of `ball_height_in_cone`.
/// D = 2 [ r / cos(a) - (h - r) tan(a) ].
pub fn cone_face_dia_from_ball(ball_d: f64, height: f64, included: f64) -> f64 {
    let a = rad(included / 2.0);
    let r = ball_d / 2.0;
    if !(r > 0.0 && a > 0.0 && a < PI / 2.0) { return f64::NAN; }
    2.0 * (r / a.cos() - (height - r) * a.tan())
}

/// Included angle (degrees) and face diameter of a tapered bore from two
/// balls: ball 1 (smaller) sits deeper. Heights are of each ball top above
/// the face (negative = below). The centres are (h - r) above the face and
/// sin(a) = (r2 - r1) / (c2 - c1). Returns [included angle, face diameter],
/// NaN when the readings do not fit a cone opening towards the face.
pub fn cone_from_two_balls(d1: f64, h1: f64, d2: f64, h2: f64) -> [f64; 2] {
    let (r1, r2) = (d1 / 2.0, d2 / 2.0);
    let (c1, c2) = (h1 - r1, h2 - r2);
    let s = (r2 - r1) / (c2 - c1);
    if !(r1 > 0.0 && r2 > r1 && c2 > c1 && s > 0.0 && s < 1.0) { return [f64::NAN; 2]; }
    let inc = 2.0 * deg(s.asin());
    [inc, cone_face_dia_from_ball(d1, h1, inc)]
}

// ---------------------------------------------------------------------------
// External taper measured over rolls (small end down on the surface plate,
// a pair of equal rolls on equal gauge blocks of height H)

/// Measurement over a pair of rolls of diameter `d` resting on blocks of
/// height `h` against an external taper with diameter `dia0` at the plate
/// (small end down) and included angle `included`:
/// M = D_h + d (1 + tan(45 + a/2)), D_h = dia0 + 2 h tan(a).
pub fn taper_over_rolls(dia0: f64, included: f64, d: f64, h: f64) -> f64 {
    let a = rad(included / 2.0);
    if !(d > 0.0 && a >= 0.0 && a < PI / 2.0) { return f64::NAN; }
    dia0 + 2.0 * h * a.tan() + d * (1.0 + (PI / 4.0 + a / 2.0).tan())
}

/// Included angle and the diameter at the plate (small end) from two
/// measurements over the same rolls at two block heights:
/// tan(a) = (M2 - M1) / (2 (H2 - H1)). Returns [included, dia at plate].
pub fn taper_from_rolls(d: f64, m1: f64, h1: f64, m2: f64, h2: f64) -> [f64; 2] {
    if !(d > 0.0) || h2 == h1 { return [f64::NAN; 2]; }
    let t = (m2 - m1) / (2.0 * (h2 - h1));
    if !(t >= 0.0) { return [f64::NAN; 2]; }
    let a = t.atan();
    let dia0 = m1 - 2.0 * h1 * t - d * (1.0 + (PI / 4.0 + a / 2.0).tan());
    [2.0 * deg(a), dia0]
}

// ---------------------------------------------------------------------------
// Shrink and press fits

/// Temperature change (K) that makes a part of diameter `d` grow by
/// `interference + clearance`: dT = (i + c) / (alpha d). Use it for heating
/// the hub (positive) or, with the shaft's alpha, for cooling the shaft.
pub fn shrink_fit_dt(d: f64, interference: f64, clearance: f64, alpha: f64) -> f64 {
    if !(d > 0.0 && alpha > 0.0) { return f64::NAN; }
    (interference + clearance) / (alpha * d)
}

/// Hub temperature needed when the shaft is also cooled from `t0` to
/// `t_shaft`: the hub must grow by i + c minus the shaft's shrinkage.
/// T_hub = t0 + (i + c - alpha_s d (t0 - t_shaft)) / (alpha_h d).
pub fn shrink_fit_hub_temp(d: f64, interference: f64, clearance: f64, alpha_hub: f64, alpha_shaft: f64, t0: f64, t_shaft: f64) -> f64 {
    if !(d > 0.0 && alpha_hub > 0.0 && alpha_shaft >= 0.0) { return f64::NAN; }
    t0 + (interference + clearance - alpha_shaft * d * (t0 - t_shaft)) / (alpha_hub * d)
}

/// Lame thick-cylinder contact pressure of a press or shrink fit from the
/// diametral interference `delta` at nominal diameter `d`. Hub outside
/// diameter `d_out`, shaft bore `d_in` (0 = solid). E in pressure units
/// (result in the same units), Poisson's ratios nu.
/// p = delta / ( d/Eo ((do^2+d^2)/(do^2-d^2) + nuo) + d/Ei ((d^2+di^2)/(d^2-di^2) - nui) ).
#[allow(clippy::too_many_arguments)]
pub fn press_fit_pressure(d: f64, delta: f64, d_out: f64, d_in: f64, e_hub: f64, nu_hub: f64, e_shaft: f64, nu_shaft: f64) -> f64 {
    let k = press_fit_compliance(d, d_out, d_in, e_hub, nu_hub, e_shaft, nu_shaft);
    delta / k
}

/// Interference per unit pressure (the denominator of `press_fit_pressure`).
pub fn press_fit_compliance(d: f64, d_out: f64, d_in: f64, e_hub: f64, nu_hub: f64, e_shaft: f64, nu_shaft: f64) -> f64 {
    let di = d_in.max(0.0);
    if !(d > 0.0 && d_out > d && di < d && e_hub > 0.0 && e_shaft > 0.0) { return f64::NAN; }
    let (d2, o2, i2) = (d * d, d_out * d_out, di * di);
    d / e_hub * ((o2 + d2) / (o2 - d2) + nu_hub) + d / e_shaft * ((d2 + i2) / (d2 - i2) - nu_shaft)
}

/// Hoop (tangential) stress at the hub bore: p (do^2 + d^2) / (do^2 - d^2).
pub fn press_fit_hub_stress(p: f64, d: f64, d_out: f64) -> f64 {
    let (d2, o2) = (d * d, d_out * d_out);
    if !(d_out > d) { return f64::NAN; }
    p * (o2 + d2) / (o2 - d2)
}

/// Torque the fit can hold with friction coefficient mu over engaged length
/// `len`: T = mu p pi d^2 len / 2 (force x length units of the inputs).
pub fn press_fit_torque(p: f64, d: f64, len: f64, mu: f64) -> f64 { mu * p * PI * d * d * len / 2.0 }

/// Axial force to press the parts apart: F = mu p pi d len.
pub fn press_fit_axial_force(p: f64, d: f64, len: f64, mu: f64) -> f64 { mu * p * PI * d * len }

// ---------------------------------------------------------------------------
// Compound angles. A face is tilted by its true angle C towards plan
// direction `dir` (degrees from +X towards +Y). Its unit normal is
// n = (sin C cos dir, sin C sin dir, cos C).

fn normal(c: f64, dir: f64) -> [f64; 3] {
    let (c, b) = (rad(c), rad(dir));
    [c.sin() * b.cos(), c.sin() * b.sin(), c.cos()]
}
fn from_normal(n: [f64; 3]) -> [f64; 2] {
    let c = deg(n[2].clamp(-1.0, 1.0).acos());
    let dir = if n[0].abs() < 1e-15 && n[1].abs() < 1e-15 { 0.0 } else { deg(n[1].atan2(n[0])) };
    [c, dir]
}

/// True angle and its direction from the two apparent (projected) angles of
/// the face seen in the XZ and YZ planes: tan C = sqrt(tan^2 ax + tan^2 ay),
/// tan dir = tan ay / tan ax. Returns [C, dir].
pub fn compound_from_apparent(ax: f64, ay: f64) -> [f64; 2] {
    if !(ax.abs() < 90.0 && ay.abs() < 90.0) { return [f64::NAN; 2]; }
    let (tx, ty) = (rad(ax).tan(), rad(ay).tan());
    let l = (1.0 + tx * tx + ty * ty).sqrt();
    from_normal([tx / l, ty / l, 1.0 / l])
}

/// True angle and direction after two successive tilts: first `a1` about the
/// X axis (the face then slopes along Y), then `a2` about the tilted plate's
/// own Y axis (as on a compound sine plate). The normal is
/// Rx(-a1) Ry(a2) z = (sin a2, sin a1 cos a2, cos a1 cos a2), so
/// cos C = cos a1 cos a2. Returns [C, dir].
pub fn compound_from_sequential(a1: f64, a2: f64) -> [f64; 2] {
    let (p, q) = (rad(a1), rad(a2));
    from_normal([q.sin(), p.sin() * q.cos(), p.cos() * q.cos()])
}

/// Settings for a true angle C in direction `dir`:
/// [apparent ax, apparent ay, sequential a1 (about X, first), sequential a2
/// (about the tilted Y, second)].
/// tan ax = tan C cos dir, tan ay = tan C sin dir; sin a2 = sin C cos dir,
/// tan a1 = tan C sin dir.
pub fn compound_settings(c: f64, dir: f64) -> [f64; 4] {
    if !(c >= 0.0 && c < 90.0) { return [f64::NAN; 4]; }
    let n = normal(c, dir);
    [deg(n[0].atan2(n[2])), deg(n[1].atan2(n[2])), deg(n[1].atan2(n[2])), deg(n[0].clamp(-1.0, 1.0).asin())]
}

/// Angle between the normals of two faces given as (true angle, direction):
/// the dihedral angle between the faces is 180 minus this.
pub fn angle_between_faces(c1: f64, dir1: f64, c2: f64, dir2: f64) -> f64 {
    let (a, b) = (normal(c1, dir1), normal(c2, dir2));
    deg((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]).clamp(-1.0, 1.0).acos())
}

// ---------------------------------------------------------------------------
// Lathe change gears

/// One gear train: driver/driven pairs. `b` and `d` are 0 for a simple
/// train (a drives b through any idler). Ratio = (a/b) x (c/d).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Train { pub a: u32, pub b: u32, pub c: u32, pub d: u32, pub ratio: f64 }

/// Gear trains from the gears you have, closest to `target` ratio first.
/// Simple trains a/b and compound trains (a/b)(c/d) with a, b, c, d
/// different gears from the list (a tooth count listed twice is two gears).
/// Ratios that repeat are kept once (the simpler train). At most `max` trains.
pub fn change_gear_trains(gears: &[u32], target: f64, compound: bool, max: usize) -> Vec<Train> {
    let g: Vec<u32> = gears.iter().copied().filter(|x| *x > 0).take(60).collect();
    let n = g.len();
    if !(target > 0.0) || n < 2 { return vec![]; }
    let mut out: Vec<Train> = Vec::new();
    for i in 0..n { for j in 0..n {
        if i == j { continue; }
        out.push(Train { a: g[i], b: g[j], c: 0, d: 0, ratio: g[i] as f64 / g[j] as f64 });
    } }
    if compound && n >= 4 {
        for i in 0..n { for j in 0..n { if j == i { continue; }
            for k in 0..n { if k == i || k == j { continue; }
                for l in 0..n { if l == i || l == j || l == k { continue; }
                    // (a/b)(c/d) equals (c/b)(a/d): keep a <= c to halve the list.
                    if g[i] > g[k] { continue; }
                    out.push(Train { a: g[i], b: g[j], c: g[k], d: g[l], ratio: (g[i] as f64 * g[k] as f64) / (g[j] as f64 * g[l] as f64) });
                } } } }
    }
    let err = |t: &Train| (t.ratio / target - 1.0).abs();
    out.sort_by(|x, y| err(x).partial_cmp(&err(y)).unwrap().then((x.c == 0).cmp(&(y.c == 0)).reverse()));
    let mut res: Vec<Train> = Vec::new();
    for t in out {
        if res.iter().any(|r| (r.ratio - t.ratio).abs() <= 1e-12 * t.ratio) { continue; }
        res.push(t);
        if res.len() >= max { break; }
    }
    res
}

/// Gear ratio needed to cut lead `target` with a leadscrew of lead
/// `leadscrew` and a fixed ratio `fixed` between spindle and the first
/// change gear (1 when the stud turns with the spindle): target / (leadscrew x fixed).
pub fn change_gear_ratio(target: f64, leadscrew: f64, fixed: f64) -> f64 {
    if !(target > 0.0 && leadscrew > 0.0 && fixed > 0.0) { return f64::NAN; }
    target / (leadscrew * fixed)
}

// ---------------------------------------------------------------------------
// Shop economics. Money in any one currency; all inputs are yours.

/// Capital recovery factor: the equal yearly payment that repays 1 over `n`
/// years at interest `i` (fraction): i (1+i)^n / ((1+i)^n - 1); 1/n at i = 0.
pub fn capital_recovery_factor(i: f64, n: f64) -> f64 {
    if !(n > 0.0) { return f64::NAN; }
    if i.abs() < 1e-12 { return 1.0 / n; }
    let f = (1.0 + i).powf(n);
    i * f / (f - 1.0)
}

/// Machine hourly rate. Yearly capital cost = (price - resale) x CRF(i, n) +
/// resale x i; plus yearly fixed costs (floor space, maintenance, insurance),
/// divided by the hours run per year; plus power (kW x load x price per kWh)
/// and the operator's rate per hour. Returns which: 0 total per hour,
/// 1 capital per hour, 2 fixed costs per hour, 3 power per hour.
#[allow(clippy::too_many_arguments)]
pub fn machine_hourly_rate(price: f64, resale: f64, years: f64, interest: f64, hours: f64, fixed_per_year: f64, kw: f64, load: f64, kwh_price: f64, labour: f64, which: u32) -> f64 {
    if !(hours > 0.0 && years > 0.0) { return f64::NAN; }
    let cap = ((price - resale) * capital_recovery_factor(interest, years) + resale * interest) / hours;
    let fix = fixed_per_year / hours;
    let pw = kw * load * kwh_price;
    match which { 0 => cap + fix + pw + labour, 1 => cap, 2 => fix, 3 => pw, _ => f64::NAN }
}

/// Break-even quantity: fixed cost / (price per part - variable cost per part).
pub fn break_even_qty(fixed: f64, price: f64, variable: f64) -> f64 {
    let m = price - variable;
    if !(m > 0.0) { return f64::NAN; }
    fixed / m
}

/// Simple payback in years: investment / yearly net saving.
pub fn payback_years(investment: f64, saving: f64) -> f64 { if saving > 0.0 { investment / saving } else { f64::NAN } }

/// Discounted payback: years until the present value of the yearly saving
/// equals the investment: n = -ln(1 - I i / A) / ln(1 + i). NaN if never.
pub fn discounted_payback_years(investment: f64, saving: f64, i: f64) -> f64 {
    if !(saving > 0.0) { return f64::NAN; }
    if i.abs() < 1e-12 { return investment / saving; }
    let x = 1.0 - investment * i / saving;
    if !(x > 0.0) { return f64::NAN; }
    -x.ln() / (1.0 + i).ln()
}

/// Net present value of a yearly saving over `n` years at interest `i`, less
/// the investment, plus the resale value at the end discounted:
/// NPV = A (1 - (1+i)^-n) / i + S (1+i)^-n - I.
pub fn npv(investment: f64, saving: f64, n: f64, i: f64, resale: f64) -> f64 {
    let v = (1.0 + i).powf(-n);
    let pa = if i.abs() < 1e-12 { n } else { (1.0 - v) / i };
    saving * pa + resale * v - investment
}

// ---------------------------------------------------------------------------
// Plane figures. kind and parameters (a, b, c):
//  0 square side a; 1 rectangle a x b; 2 parallelogram base a, height b,
//  slant side c; 3 isosceles trapezoid parallel sides a and b, height c;
//  4 circle diameter a; 5 ring outside a, inside b; 6 ellipse axes a and b
//  (full lengths); 7 regular polygon, a sides, across flats b; 8 sector
//  radius a, angle b (deg); 9 regular polygon, a sides, across corners b.
// which: 0 area, 1 perimeter, 2 extra 1, 3 extra 2 (see plane_extra_names).

/// Area, perimeter and two extra values of a plane figure (see above).
pub fn plane_figure(kind: u32, a: f64, b: f64, c: f64) -> [f64; 4] {
    let n = f64::NAN;
    let pos = |x: f64| x > 0.0;
    match kind {
        // Square: the 4th value is the diameter of the circle of the same area (pi d^2 / 4 = a^2).
        0 if pos(a) => [a * a, 4.0 * a, a * 2f64.sqrt(), 2.0 * a / PI.sqrt()],
        1 if pos(a) && pos(b) => [a * b, 2.0 * (a + b), (a * a + b * b).sqrt(), n],
        2 if pos(a) && pos(b) && c >= b => [a * b, 2.0 * (a + c), deg((b / c).asin()), n],
        3 if pos(a) && pos(b) && pos(c) => { let leg = (c * c + ((a - b) / 2.0).powi(2)).sqrt(); [(a + b) / 2.0 * c, a + b + 2.0 * leg, leg, n] }
        // Circle: the 3rd value is the side of the square of the same area.
        4 if pos(a) => [PI * a * a / 4.0, PI * a, a * PI.sqrt() / 2.0, n],
        5 if pos(a) && b >= 0.0 && b < a => [PI * (a * a - b * b) / 4.0, PI * (a + b), (a - b) / 2.0, n],
        6 if pos(a) && pos(b) => {
            // Ramanujan's second approximation of the perimeter (an approximation; see docs/sources.md).
            let (x, y) = (a / 2.0, b / 2.0);
            let h = ((x - y) / (x + y)).powi(2);
            [PI * x * y, PI * (x + y) * (1.0 + 3.0 * h / (10.0 + (4.0 - 3.0 * h).sqrt())), n, n]
        }
        7 | 9 if a >= 3.0 && pos(b) => {
            let k = a.round();
            let t = PI / k;
            let af = if kind == 7 { b } else { b * t.cos() };
            let side = af * t.tan();
            [k * side * af / 4.0, k * side, side, if kind == 7 { af / t.cos() } else { af }]
        }
        8 if pos(a) && pos(b) && b <= 360.0 => { let t = rad(b); [a * a * t / 2.0, 2.0 * a + a * t, a * t, 2.0 * a * (t / 2.0).sin()] }
        _ => [n; 4],
    }
}

/// Prismoidal formula: volume of a solid between two parallel end faces of areas `a1`
/// and `a2`, a distance `h` apart, with the area `am` of the section halfway between:
/// V = h (A1 + 4 Am + A2) / 6. Exact for prisms, pyramids, frustums, wedges, spheres and
/// any solid whose section area is at most a cubic in the height.
pub fn prismoid_volume(a1: f64, am: f64, a2: f64, h: f64) -> f64 {
    if !(a1 >= 0.0 && am >= 0.0 && a2 >= 0.0 && h > 0.0) { return f64::NAN; }
    h * (a1 + 4.0 * am + a2) / 6.0
}

/// Liquid in a cylindrical tank with flat ends, diameter `d`, length (or height) `l`,
/// filled to depth `h`. `orient` 0 lying down (depth measured across the diameter):
/// V = L [R^2 acos((R - h) / R) - (R - h) sqrt(2 R h - h^2)]; 1 standing on end
/// (depth measured along the length): V = pi R^2 h. `which`: 0 volume of liquid,
/// 1 volume when full, 2 fraction full.
pub fn tank_contents(orient: f64, d: f64, l: f64, h: f64, which: f64) -> f64 {
    if !(d > 0.0 && l > 0.0 && h >= 0.0) { return f64::NAN; }
    let r = d / 2.0;
    let full = PI * r * r * l;
    let v = match orient as i32 {
        0 if h <= d => l * (r * r * ((r - h) / r).acos() - (r - h) * (2.0 * r * h - h * h).max(0.0).sqrt()),
        1 if h <= l => PI * r * r * h,
        _ => return f64::NAN,
    };
    match which as i32 { 0 => v, 1 => full, 2 => v / full, _ => f64::NAN }
}

/// Area under equally spaced ordinates `ys`, a distance `d` apart, by the trapezoidal
/// rule: d [(first + last) / 2 + the ones between]. At least two ordinates.
pub fn trapezoid_area(ys: &[f64], d: f64) -> f64 {
    if ys.len() < 2 || !(d > 0.0) || ys.iter().any(|y| !y.is_finite()) { return f64::NAN; }
    let inner: f64 = ys[1..ys.len() - 1].iter().sum();
    d * ((ys[0] + ys[ys.len() - 1]) / 2.0 + inner)
}

/// The same area by Simpson's rule: d/3 [first + last + 4 (2nd, 4th, ...) + 2 (3rd, 5th, ...)].
/// Needs an odd number of ordinates (an even number of strips), at least three.
pub fn simpson_area(ys: &[f64], d: f64) -> f64 {
    let n = ys.len();
    if n < 3 || n % 2 == 0 || !(d > 0.0) || ys.iter().any(|y| !y.is_finite()) { return f64::NAN; }
    let mut s = ys[0] + ys[n - 1];
    for (i, y) in ys.iter().enumerate().take(n - 1).skip(1) { s += if i % 2 == 1 { 4.0 * y } else { 2.0 * y }; }
    d / 3.0 * s
}

// Solids. kind and parameters (a, b, c):
//  0 cube side a; 1 box a x b x c; 2 cylinder diameter a, length b;
//  3 tube outside a, inside b, length c; 4 cone base diameter a, height b;
//  5 frustum of a cone, diameters a and b, height c; 6 sphere diameter a;
//  7 spherical cap, sphere diameter a, cap height b; 8 square pyramid base
//  side a, height b; 9 torus (ring) mean diameter a, section diameter b;
//  10 hexagon bar across flats a, length b.
// which: 0 volume, 1 total surface area, 2 side (lateral) area, 3 extra.

/// Volume, total surface, lateral surface and one extra value of a solid.
pub fn solid_figure(kind: u32, a: f64, b: f64, c: f64) -> [f64; 4] {
    let n = f64::NAN;
    let pos = |x: f64| x > 0.0;
    match kind {
        0 if pos(a) => [a.powi(3), 6.0 * a * a, 4.0 * a * a, a * 3f64.sqrt()],
        1 if pos(a) && pos(b) && pos(c) => [a * b * c, 2.0 * (a * b + b * c + a * c), 2.0 * c * (a + b), (a * a + b * b + c * c).sqrt()],
        2 if pos(a) && pos(b) => { let r = a / 2.0; [PI * r * r * b, 2.0 * PI * r * r + PI * a * b, PI * a * b, n] }
        3 if pos(a) && b >= 0.0 && b < a && pos(c) => {
            let (ro, ri) = (a / 2.0, b / 2.0);
            [PI * (ro * ro - ri * ri) * c, 2.0 * PI * (ro * ro - ri * ri) + PI * (a + b) * c, PI * a * c, PI * b * c]
        }
        4 if pos(a) && pos(b) => { let r = a / 2.0; let s = (r * r + b * b).sqrt(); [PI * r * r * b / 3.0, PI * r * r + PI * r * s, PI * r * s, s] }
        5 if pos(a) && pos(b) && pos(c) => {
            let (r1, r2) = (a / 2.0, b / 2.0);
            let s = (c * c + (r1 - r2).powi(2)).sqrt();
            [PI * c * (r1 * r1 + r1 * r2 + r2 * r2) / 3.0, PI * (r1 * r1 + r2 * r2) + PI * (r1 + r2) * s, PI * (r1 + r2) * s, s]
        }
        6 if pos(a) => { let r = a / 2.0; [4.0 / 3.0 * PI * r.powi(3), 4.0 * PI * r * r, 4.0 * PI * r * r, n] }
        7 if pos(a) && pos(b) && b <= a => {
            let r = a / 2.0;
            let base = (b * (2.0 * r - b)).sqrt() * 2.0;
            [PI * b * b * (3.0 * r - b) / 3.0, 2.0 * PI * r * b + PI * base * base / 4.0, 2.0 * PI * r * b, base]
        }
        8 if pos(a) && pos(b) => { let s = (b * b + a * a / 4.0).sqrt(); [a * a * b / 3.0, a * a + 2.0 * a * s, 2.0 * a * s, s] }
        9 if pos(a) && pos(b) && b <= a => [PI * PI * a * b * b / 4.0, PI * PI * a * b, PI * PI * a * b, n],
        10 if pos(a) && pos(b) => {
            let side = a / 3f64.sqrt();
            let area = 3f64.sqrt() / 2.0 * a * a;
            [area * b, 2.0 * area + 6.0 * side * b, 6.0 * side * b, 2.0 * side]
        }
        _ => [n; 4],
    }
}

// ---------------------------------------------------------------------------
// Micrometer and vernier scales. kind:
//  0 metric micrometer 0.01 mm (0.5 mm sleeve lines, 50-division thimble)
//  1 metric micrometer with vernier, 0.001 mm (10 vernier lines)
//  2 inch micrometer 0.001 in (0.025 in sleeve lines, 25-division thimble)
//  3 inch micrometer with vernier, 0.0001 in (10 vernier lines)
//  4 metric vernier caliper 0.02 mm (1 mm main scale, 50 vernier divisions)
//  5 metric vernier caliper 0.05 mm (1 mm main scale, 20 vernier divisions)
//  6 inch vernier caliper 0.001 in (0.025 in main scale, 25 vernier divisions)

/// [resolution, main-scale step, divisions on the thimble (0 for a caliper),
/// vernier divisions (0 for none)] of a scale kind.
pub fn scale_spec(kind: u32) -> [f64; 4] {
    match kind {
        0 => [0.01, 0.5, 50.0, 0.0],
        1 => [0.001, 0.5, 50.0, 10.0],
        2 => [0.001, 0.025, 25.0, 0.0],
        3 => [0.0001, 0.025, 25.0, 10.0],
        4 => [0.02, 1.0, 0.0, 50.0],
        5 => [0.05, 1.0, 0.0, 20.0],
        6 => [0.001, 0.025, 0.0, 25.0],
        _ => [f64::NAN; 4],
    }
}

/// Break a reading into what the scales show: [reading rounded to the
/// resolution, main-scale value (last line passed), main-scale line count,
/// thimble division at the line (micrometers), vernier line that coincides].
pub fn scale_reading(kind: u32, value: f64) -> [f64; 5] {
    let [res, step, thim, ver] = scale_spec(kind);
    if !(value >= 0.0) || res.is_nan() { return [f64::NAN; 5]; }
    let units = (value / res).round();
    let v = units * res;
    let per_step = (step / res).round(); // resolution units per main-scale line
    let lines = (units / per_step).floor();
    let rest = units - lines * per_step; // resolution units past the last line
    if thim > 0.0 {
        // micrometer: thimble division is one hundredth (or thousandth) step
        let per_div = per_step / thim; // resolution units per thimble division (1 or 10)
        let div = (rest / per_div).floor();
        let vline = rest - div * per_div; // vernier line (0 if no vernier)
        [v, lines * step, lines, div, if ver > 0.0 { vline } else { f64::NAN }]
    } else {
        [v, lines * step, lines, f64::NAN, rest]
    }
}

// ---------- Limits of size and the middle of a tolerance ----------

/// Limits of size from a nominal size and two deviations, given in either
/// order and with their signs (for example +0.002 and -0.001, or +0.05 and
/// +0.02). For two limits, pass nominal 0 and the limits as the deviations.
/// Returns `[upper limit, lower limit, middle, tolerance (upper - lower),
/// half the tolerance, middle - nominal]`. The middle is the size to aim
/// for so the same amount of tolerance is left on both sides.
pub fn tol_limits(nominal: f64, dev_a: f64, dev_b: f64) -> [f64; 6] {
    if !(nominal.is_finite() && dev_a.is_finite() && dev_b.is_finite()) { return [f64::NAN; 6]; }
    let hi = nominal + dev_a.max(dev_b);
    let lo = nominal + dev_a.min(dev_b);
    let mid = (hi + lo) / 2.0;
    [hi, lo, mid, hi - lo, (hi - lo) / 2.0, mid - nominal]
}

// ---------- Wear offset change from a measured size ----------

/// Change to a wear offset that brings a measured size to its target.
/// error = measured - target; change = sense x error, halved when `halve`
/// is above 0.5. `sense` is -1 when a larger reading needs a smaller offset
/// value (a turned diameter or bore on the X wear offset, an outside size
/// milled with cutter compensation, a height or length left under the tool)
/// and +1 when it needs a larger one (an inside size milled with cutter
/// compensation, a depth cut below the Z zero). Halve when the reading is
/// across two sides but the offset acts on one (a radius value).
///
/// This is the arithmetic of a control that adds the wear value to the tool
/// position (lathe X and Z wear, G43 on a mill) and moves the cutter away
/// from the programmed edge by the D value (G41 / G42).
/// Returns `[error, change, current + change]`.
pub fn offset_adjust(measured: f64, target: f64, sense: f64, halve: f64, current: f64) -> [f64; 3] {
    if !(measured.is_finite() && target.is_finite() && current.is_finite() && sense.is_finite()) || sense == 0.0 { return [f64::NAN; 3]; }
    let e = measured - target;
    let c = sense.signum() * e * if halve > 0.5 { 0.5 } else { 1.0 };
    [e, c, current + c]
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    #[test]
    fn ball_in_countersink() {
        // 90 deg countersink, 0.500 face diameter, 0.375 ball:
        // r = 0.1875, h = 0.1875 + 0.1875/sin45 - 0.25/tan45 = 0.2026650...
        close(ball_height_in_cone(0.375, 0.5, 90.0), 0.1875 + 0.1875 * 2f64.sqrt() - 0.25, 1e-12);
        close(ball_height_in_cone(0.375, 0.5, 90.0), 0.202665, 1e-6);
        // Inverse returns the face diameter.
        close(cone_face_dia_from_ball(0.375, 0.202665043, 90.0), 0.5, 1e-8);
        // 82 deg countersink: round trip.
        let h = ball_height_in_cone(10.0, 12.0, 82.0);
        close(cone_face_dia_from_ball(10.0, h, 82.0), 12.0, 1e-10);
        // 60 deg centre: ball of 2r with r/sin30 = 2r; face 0 -> h = 3r.
        close(ball_height_in_cone(2.0, 0.0, 60.0), 3.0, 1e-12);
    }

    #[test]
    fn ball_independent_formula() {
        // M. Biegert, "Measuring Countersink Diameter Using Gage Balls" (2014), Eq. 2:
        // D = B / cos(A/2) + (B - 2H) tan(A/2), H = ball height above the surface.
        for (b, a, h) in [(0.375, 82.0, 0.1), (0.5, 100.0, 0.05), (10.0, 90.0, -1.0), (6.35, 60.0, 2.0)] {
            let half = rad(a / 2.0);
            close(cone_face_dia_from_ball(b, h, a), b / half.cos() + (b - 2.0 * h) * half.tan(), 1e-12);
        }
    }

    #[test]
    fn rolls_worked_example() {
        // NIMI CITS Fitter Trade Theory p. 113: over rollers 61.5 mm at the small
        // end and 69.3 mm on 70 mm slip gauges: tan(a) = (69.3 - 61.5) / (2 x 70).
        let r = taper_from_rolls(10.0, 61.5, 0.0, 69.3, 70.0);
        close(r[0], 2.0 * deg((7.8f64 / 140.0).atan()), 1e-12);
        close(r[0], 6.37779, 1e-5);
    }

    #[test]
    fn two_balls() {
        // Build a 10 deg included bore with 30.000 at the face, put balls of
        // 20 and 25 in it, and recover the angle and diameter.
        let (inc, dface) = (10.0, 30.0);
        let h1 = ball_height_in_cone(20.0, dface, inc);
        let h2 = ball_height_in_cone(25.0, dface, inc);
        let r = cone_from_two_balls(20.0, h1, 25.0, h2);
        close(r[0], inc, 1e-9); close(r[1], dface, 1e-9);
        // The bigger ball must sit higher than the smaller one.
        assert!(cone_from_two_balls(20.0, h2, 25.0, h1)[0].is_nan());
    }

    #[test]
    fn rolls_on_taper() {
        // Zero taper: M = D + 2d (tan 45 = 1), like a plain cylinder over rolls.
        close(taper_over_rolls(1.0, 0.0, 0.25, 0.0), 1.5, 1e-12);
        // 1 + tan(45 + a/2) = 1 + tan a + sec a (identity), a = 5 deg.
        let a = rad(5.0);
        close(taper_over_rolls(1.0, 10.0, 0.25, 0.0), 1.0 + 0.25 * (1.0 + a.tan() + 1.0 / a.cos()), 1e-12);
        // Two heights give back the taper.
        let (d, inc, d0) = (0.25, 7.15, 1.2);
        let m1 = taper_over_rolls(d0, inc, d, 0.0);
        let m2 = taper_over_rolls(d0, inc, d, 2.0);
        let r = taper_from_rolls(d, m1, 0.0, m2, 2.0);
        close(r[0], inc, 1e-9); close(r[1], d0, 1e-9);
        // 3/4 in per foot on diameter: 2 tan a = 0.0625 -> M2 - M1 = 0.0625 x dH.
        close(m2 - m1, 2.0 * 2.0 * rad(inc / 2.0).tan(), 1e-12);
    }

    #[test]
    fn shrink() {
        // 100 mm steel hub (11.5e-6/K), 0.05 interference + 0.05 clearance -> 86.96 K.
        close(shrink_fit_dt(100.0, 0.05, 0.05, 11.5e-6), 0.1 / 1.15e-3, 1e-9);
        // Same, shaft cooled 100 K: hub only needs 0.1 - 0.115 < 0 -> below ambient.
        close(shrink_fit_hub_temp(100.0, 0.05, 0.05, 11.5e-6, 11.5e-6, 20.0, -80.0), 20.0 + (0.1 - 0.115) / 1.15e-3, 1e-9);
    }

    #[test]
    fn press_fit() {
        // Same material, solid shaft: p = E delta (do^2 - d^2) / (2 d do^2).
        let (e, d, d_o, delta) = (207_000.0, 50.0, 100.0, 0.05);
        let p = press_fit_pressure(d, delta, d_o, 0.0, e, 0.3, e, 0.3);
        close(p, e * delta * (d_o * d_o - d * d) / (2.0 * d * d_o * d_o), 1e-9);
        close(p, 77.625, 1e-9);
        close(press_fit_hub_stress(p, d, d_o), p * 12500.0 / 7500.0, 1e-9);
        close(press_fit_torque(1.0, 2.0, 3.0, 0.5), 0.5 * PI * 4.0 * 3.0 / 2.0, 1e-12);
        // Engineers Edge "Interference Press Fit Cylinder Design Calculator" (PDF):
        // contact pressure 3.000 psi, hub OD 2.0000 in, contact diameter 1.5050 in ->
        // tangential stress at the hub inside diameter 10.83305 psi (their Eq. 13).
        close(press_fit_hub_stress(3.0, 1.505, 2.0), 10.83305, 1e-5);
    }

    #[test]
    fn compound() {
        // Apparent 30 and 30: tan C = sqrt(2/3) -> C = 39.2315 deg, direction 45.
        let r = compound_from_apparent(30.0, 30.0);
        close(r[0], deg((2.0f64 / 3.0).sqrt().atan()), 1e-9); close(r[0], 39.23152048, 1e-7); close(r[1], 45.0, 1e-9);
        // Successive 30 and 30: cos C = cos30 cos30 = 0.75 -> C = 41.4096 deg.
        close(compound_from_sequential(30.0, 30.0)[0], 41.40962211, 1e-7);
        // Settings round trip.
        let s = compound_settings(41.40962211, compound_from_sequential(30.0, 30.0)[1]);
        close(s[2], 30.0, 1e-6); close(s[3], 30.0, 1e-6);
        let s = compound_settings(r[0], r[1]);
        close(s[0], 30.0, 1e-9); close(s[1], 30.0, 1e-9);
        // Single tilt: direction 0 -> apparent X = C, apparent Y = 0.
        let s = compound_settings(20.0, 0.0);
        close(s[0], 20.0, 1e-12); close(s[1], 0.0, 1e-12); close(s[3], 20.0, 1e-12);
        close(angle_between_faces(10.0, 0.0, 10.0, 180.0), 20.0, 1e-9);
    }

    #[test]
    fn gears() {
        // 1.5 mm pitch on an 8 TPI leadscrew: ratio 1.5 / 3.175 = 60/127.
        let ratio = change_gear_ratio(1.5, 25.4 / 8.0, 1.0);
        close(ratio, 60.0 / 127.0, 1e-12);
        let set = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 127];
        let t = change_gear_trains(&set, ratio, false, 5);
        assert_eq!((t[0].a, t[0].b), (60, 127));
        // 13 TPI on an 8 TPI screw: ratio 8/13 has no simple train from this set
        // without a 65 pair; 40/65 = 8/13 exactly.
        let t = change_gear_trains(&set, 8.0 / 13.0, false, 3);
        close(t[0].ratio, 8.0 / 13.0, 1e-12);
        // Compound: 1.75 mm on 8 TPI needs 70/127 -> exact simple; 0.7 mm: 28/127 -> compound (20/127)(70/50)
        let t = change_gear_trains(&set, 0.7 / 3.175, true, 3);
        close(t[0].ratio, 0.7 / 3.175, 1e-12);
        assert!(t[0].c > 0);
    }

    #[test]
    fn economics() {
        // CRF at 10 % over 5 years = 0.263797 (standard interest table value).
        close(capital_recovery_factor(0.10, 5.0), 0.2637974808, 1e-9);
        close(capital_recovery_factor(0.0, 4.0), 0.25, 1e-12);
        // 100 000 machine, 10 000 resale, 5 y, 10 %, 2000 h, 5000 fixed, 10 kW at 0.5 load x 0.2, labour 30.
        let cap = (90_000.0 * 0.2637974808 + 1000.0) / 2000.0;
        close(machine_hourly_rate(100_000.0, 10_000.0, 5.0, 0.10, 2000.0, 5000.0, 10.0, 0.5, 0.2, 30.0, 1), cap, 1e-6);
        close(machine_hourly_rate(100_000.0, 10_000.0, 5.0, 0.10, 2000.0, 5000.0, 10.0, 0.5, 0.2, 30.0, 0), cap + 2.5 + 1.0 + 30.0, 1e-6);
        close(break_even_qty(5000.0, 12.0, 7.0), 1000.0, 1e-12);
        close(payback_years(50_000.0, 20_000.0), 2.5, 1e-12);
        // PV of 1 per year for 3 years at 10 % = 2.486852; NPV with I = 2.486852 is 0.
        close(npv(2.4868519910, 1.0, 3.0, 0.10, 0.0), 0.0, 1e-9);
        // Discounted payback where PV annuity factor equals I/A: n = 3.
        close(discounted_payback_years(2.4868519910, 1.0, 0.10), 3.0, 1e-8);
    }

    #[test]
    fn figures() {
        // Hexagon across flats 1: across corners 1.1547, side 0.57735, area 0.866025.
        let h = plane_figure(7, 6.0, 1.0, 0.0);
        close(h[0], 3f64.sqrt() / 2.0, 1e-12); close(h[2], 1.0 / 3f64.sqrt(), 1e-12); close(h[3], 2.0 / 3f64.sqrt(), 1e-12);
        // Same hexagon from across corners.
        let h2 = plane_figure(9, 6.0, 2.0 / 3f64.sqrt(), 0.0);
        close(h2[0], h[0], 1e-12);
        // Square across corners = side x sqrt2 (polygon of 4, AF 1 -> AC 1.41421).
        close(plane_figure(7, 4.0, 1.0, 0.0)[3], 2f64.sqrt(), 1e-12);
        // Circle d 2: area pi, circumference 2 pi.
        close(plane_figure(4, 2.0, 0.0, 0.0)[0], PI, 1e-12);
        // Circle and square of equal area: a circle of diameter 2 has the area of a square of side sqrt(pi), and back.
        close(plane_figure(4, 2.0, 0.0, 0.0)[2], PI.sqrt(), 1e-12);
        close(plane_figure(0, PI.sqrt(), 0.0, 0.0)[3], 2.0, 1e-12);
        // Ellipse that is a circle: perimeter exact.
        close(plane_figure(6, 2.0, 2.0, 0.0)[1], 2.0 * PI, 1e-12);
        // Ellipse a = 10, b = 5 (semi 5 and 2.5): perimeter 24.22112 (series value).
        close(plane_figure(6, 10.0, 5.0, 0.0)[1], 24.2211206, 1e-6);
        close(plane_figure(3, 10.0, 6.0, 4.0)[0], 32.0, 1e-12);
        // Sector r 2, 90 deg: area pi, arc pi.
        close(plane_figure(8, 2.0, 90.0, 0.0)[0], PI, 1e-12);
        // Solids: sphere d 2 volume 4/3 pi; cone d 2 h 3 -> pi; frustum equal ends = cylinder.
        close(solid_figure(6, 2.0, 0.0, 0.0)[0], 4.0 / 3.0 * PI, 1e-12);
        close(solid_figure(4, 2.0, 3.0, 0.0)[0], PI, 1e-12);
        close(solid_figure(5, 2.0, 2.0, 3.0)[0], solid_figure(2, 2.0, 3.0, 0.0)[0], 1e-12);
        // Cap of full height = sphere.
        close(solid_figure(7, 2.0, 2.0, 0.0)[0], 4.0 / 3.0 * PI, 1e-12);
        // Torus R = 2 (mean d 4), r = 1 (d 2): V = 2 pi^2 R r^2 = 4 pi^2.
        close(solid_figure(9, 4.0, 2.0, 0.0)[0], 4.0 * PI * PI, 1e-12);
        close(solid_figure(9, 4.0, 2.0, 0.0)[1], 8.0 * PI * PI, 1e-12);
        close(solid_figure(1, 2.0, 3.0, 4.0)[1], 52.0, 1e-12);
    }

    #[test]
    fn scales_worked_examples() {
        // Mitutoyo Quick Guide E11003(7): 7.37 mm = sleeve 7 + thimble 0.37.
        let r = scale_reading(0, 7.37);
        close(r[1], 7.0, 1e-12); close(r[3], 37.0, 1e-12);
        // Same guide, vernier micrometer: 6.213 = 6 + 0.21 + 0.003.
        let r = scale_reading(1, 6.213);
        close(r[1], 6.0, 1e-12); close(r[3], 21.0, 1e-12); close(r[4], 3.0, 1e-12);
        // Same guide, 0.05 mm caliper: 16.15 = 16 + 0.15 (vernier line 3).
        let r = scale_reading(5, 16.15);
        close(r[1], 16.0, 1e-12); close(r[4], 3.0, 1e-12);
        // PGI "How to read an outside micrometer": .226 = .200 + .025 + .001.
        let r = scale_reading(2, 0.226);
        close(r[1], 0.225, 1e-12); close(r[2], 9.0, 1e-12); close(r[3], 1.0, 1e-12);
        // Same, with vernier: .2262 = .225 + .001 + .0002.
        let r = scale_reading(3, 0.2262);
        close(r[1], 0.225, 1e-12); close(r[3], 1.0, 1e-12); close(r[4], 2.0, 1e-12);
    }

    #[test]
    fn tolerance_limits_and_middle() {
        // 1.000 +0.002 / -0.001: limits 1.002 and 0.999, middle 1.0005, band 0.003.
        let r = tol_limits(1.0, 0.002, -0.001);
        close(r[0], 1.002, 1e-12); close(r[1], 0.999, 1e-12); close(r[2], 1.0005, 1e-12);
        close(r[3], 0.003, 1e-12); close(r[4], 0.0015, 1e-12); close(r[5], 0.0005, 1e-12);
        // The order of the deviations does not matter.
        assert_eq!(tol_limits(1.0, -0.001, 0.002), r);
        // Both deviations on one side, as for an ISO 286 shaft 25 g6 (-0.007 / -0.020):
        // limits 24.993 and 24.980, middle 24.9865.
        let r = tol_limits(25.0, -0.007, -0.020);
        close(r[0], 24.993, 1e-12); close(r[1], 24.980, 1e-12); close(r[2], 24.9865, 1e-12); close(r[5], -0.0135, 1e-12);
        // Equal plus and minus: the middle is the nominal.
        let r = tol_limits(10.0, 0.05, -0.05);
        close(r[2], 10.0, 1e-12); close(r[5], 0.0, 1e-12); close(r[4], 0.05, 1e-12);
        // Two limits (nominal 0): 25.05 and 24.98 give 25.015.
        let r = tol_limits(0.0, 25.05, 24.98);
        close(r[0], 25.05, 1e-12); close(r[1], 24.98, 1e-12); close(r[2], 25.015, 1e-12);
        assert!(tol_limits(f64::NAN, 0.1, 0.1)[2].is_nan());
    }

    #[test]
    fn wear_offset_change() {
        // Turned diameter 0.002 in oversize: -0.002 in the X wear offset (Modern Machine Shop,
        // "Taking full advantage of geometry and wear offsets").
        let r = offset_adjust(1.002, 1.0, -1.0, 0.0, 0.0);
        close(r[0], 0.002, 1e-12); close(r[1], -0.002, 1e-12); close(r[2], -0.002, 1e-12);
        // A bore 0.03 mm small needs +0.03 mm (the tool moves to a larger diameter).
        close(offset_adjust(19.97, 20.0, -1.0, 0.0, 0.0)[1], 0.03, 1e-12);
        // Boss 1.001 for 1.000 with a diameter table: -0.001 (Autodesk); 1.0120 for 1.0000: -0.0120 (CIMCO).
        close(offset_adjust(1.001, 1.0, -1.0, 0.0, 0.0)[1], -0.001, 1e-12);
        close(offset_adjust(1.012, 1.0, -1.0, 0.0, 0.0)[1], -0.012, 1e-12);
        // The same boss on a control that holds a radius: half the error.
        close(offset_adjust(25.04, 25.0, -1.0, 1.0, 0.0)[1], -0.02, 1e-12);
        // A pocket 0.04 mm small, radius value: the offset also goes down 0.02 (more is removed).
        close(offset_adjust(24.96, 25.0, 1.0, 1.0, 0.0)[1], -0.02, 1e-12);
        // A pocket floor 0.05 mm too deep with -0.10 already in the wear: +0.05, new value -0.05.
        let r = offset_adjust(10.05, 10.0, 1.0, 0.0, -0.10);
        close(r[1], 0.05, 1e-12); close(r[2], -0.05, 1e-12);
        // A part 0.08 mm too thick under a face mill: -0.08.
        close(offset_adjust(20.08, 20.0, -1.0, 0.0, 0.0)[1], -0.08, 1e-12);
        // On target: no change.
        close(offset_adjust(5.0, 5.0, 1.0, 1.0, 0.25)[2], 0.25, 1e-12);
        assert!(offset_adjust(1.0, 1.0, 0.0, 0.0, 0.0)[1].is_nan());
        assert!(offset_adjust(f64::NAN, 1.0, 1.0, 0.0, 0.0)[1].is_nan());
    }

    #[test]
    fn scales() {
        // Metric micrometer 7.38: sleeve 7.0 (14 half-mm lines), thimble 38.
        let r = scale_reading(0, 7.38);
        close(r[0], 7.38, 1e-12); close(r[1], 7.0, 1e-12); close(r[3], 38.0, 1e-12);
        // 7.88: sleeve 7.5 (15 lines), thimble 38.
        let r = scale_reading(0, 7.88);
        close(r[1], 7.5, 1e-12); close(r[2], 15.0, 1e-12); close(r[3], 38.0, 1e-12);
        // Inch micrometer 0.2789 with vernier: 0.275 + 3 x 0.001 + 9 x 0.0001.
        let r = scale_reading(3, 0.2789);
        close(r[1], 0.275, 1e-12); close(r[3], 3.0, 1e-12); close(r[4], 9.0, 1e-12);
        // Caliper 0.02: 23.46 -> 23 mm, vernier line 23 (0.46 / 0.02).
        let r = scale_reading(4, 23.46);
        close(r[1], 23.0, 1e-12); close(r[4], 23.0, 1e-12);
        // Inch caliper 1.437 -> 1.425 + 12 x 0.001.
        let r = scale_reading(6, 1.437);
        close(r[1], 1.425, 1e-12); close(r[4], 12.0, 1e-12);
    }

    // Prismoidal formula (MathWorld, Prismatoid; MATHalino, solid mensuration: prismatoid, with the storage bin
    // 8 x 7 and 14 x 11 ft, 12 ft high: A1 56, Am 99, A2 154). Exact for the pyramid, the frustum and the sphere.
    #[test]
    fn prismoidal_formula() {
        close(prismoid_volume(56.0, 99.0, 154.0, 12.0), 1212.0, 1e-9);
        close(prismoid_volume(9.0, 9.0 / 4.0, 0.0, 5.0), solid_figure(8, 3.0, 5.0, 0.0)[0], 1e-12);
        close(prismoid_volume(PI * 4.0, PI * 2.25, PI, 3.0), solid_figure(5, 4.0, 2.0, 3.0)[0], 1e-12);
        close(prismoid_volume(0.0, PI, 0.0, 2.0), solid_figure(6, 2.0, 0.0, 0.0)[0], 1e-12);
        assert!(prismoid_volume(1.0, 1.0, 1.0, 0.0).is_nan());
    }

    // Horizontal cylindrical segment (MathWorld; Math is Fun, volume of a horizontal cylinder): empty at h = 0,
    // half at h = R, full at h = 2R.
    #[test]
    fn tank() {
        close(tank_contents(0.0, 2.0, 5.0, 0.0, 0.0), 0.0, 1e-12);
        close(tank_contents(0.0, 2.0, 5.0, 1.0, 0.0), PI * 5.0 / 2.0, 1e-12);
        close(tank_contents(0.0, 2.0, 5.0, 2.0, 0.0), PI * 5.0, 1e-12);
        close(tank_contents(0.0, 2.0, 5.0, 1.0, 2.0), 0.5, 1e-12);
        // A quarter of the diameter deep: segment area R^2 (pi/3 - sqrt(3)/4) for R = 1.
        close(tank_contents(0.0, 2.0, 1.0, 0.5, 0.0), PI / 3.0 - 3f64.sqrt() / 4.0, 1e-12);
        close(tank_contents(1.0, 2.0, 5.0, 2.0, 0.0), PI * 2.0, 1e-12);
        close(tank_contents(1.0, 2.0, 5.0, 2.0, 1.0), PI * 5.0, 1e-12);
        assert!(tank_contents(0.0, 2.0, 5.0, 2.5, 0.0).is_nan());
        assert!(tank_contents(1.0, 2.0, 5.0, 6.0, 0.0).is_nan());
    }

    // Published examples: offsets 3.6, 5.0, 6.5, 5.5, 7.3, 6.0, 4.0 m at 25 m by Simpson's rule: 843.33 m2
    // (Geosurab surveying notes); heights 0, 30, 40, 50, 60, 22, 0 m at 20 m: about 4053 m2 (Maths at Home);
    // offsets 12, 24, 16 m at 20 m by the trapezoidal rule: 760 m2 (Class Mathematics).
    #[test]
    fn irregular_areas() {
        close(simpson_area(&[3.6, 5.0, 6.5, 5.5, 7.3, 6.0, 4.0], 25.0), 843.33, 5e-3);
        close(simpson_area(&[0.0, 30.0, 40.0, 50.0, 60.0, 22.0, 0.0], 20.0), 4053.0, 0.5);
        close(trapezoid_area(&[12.0, 24.0, 16.0], 20.0), 760.0, 1e-9);
        // Simpson's rule is exact for a parabola, the trapezoidal rule for a straight line.
        close(simpson_area(&[0.0, 1.0, 4.0, 9.0, 16.0], 1.0), 64.0 / 3.0, 1e-12);
        close(trapezoid_area(&[1.0, 2.0, 3.0, 4.0], 2.0), 15.0, 1e-12);
        assert!(simpson_area(&[1.0, 2.0, 3.0, 4.0], 1.0).is_nan());
        assert!(trapezoid_area(&[1.0], 1.0).is_nan());
    }
}
