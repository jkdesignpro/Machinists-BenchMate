//! Mechanics for the shop (parity batch B8): section properties, beams,
//! torsion of round shafts, column buckling, stress concentration at holes,
//! fatigue basics, centrifugal force on chuck jaws, rotor balancing
//! (ISO 21940-11) and the first critical speed of a shaft.
//!
//! Units: unless a function name or doc says otherwise the formulas are
//! unit-consistent: pass lengths, forces and moduli in one coherent set
//! (in, lbf, psi or mm, N, MPa) and the result is in that set. Functions that
//! involve mass, speed or power state their units (SI) in the doc comment.
//!
//! Sources (formulas of classical mechanics are not copyrightable; each source
//! is listed in docs/mechanics.md and docs/sources.md):
//! * [GERE] Gere and Goodno, Mechanics of Materials (section properties,
//!   parallel-axis theorem, principal axes, beam deflection, torsion)
//! * [ROARK] Young, Budynas, Sadegh, Roark's Formulas for Stress and Strain,
//!   8th ed. (Table 8.1 beam cases; Ch. 10 torsion; Ch. 15 columns)
//! * [AWC] American Wood Council, Design Aid No. 6, Beam Design Formulas with
//!   Shear and Moment Diagrams (free PDF): closed-form maximum deflections and
//!   moments used as the test oracles below
//! * [AISC] AISC 360-16 Commentary, Table C-A-7.1 (effective length factors)
//! * [SHIG] Budynas and Nisbett, Shigley's Mechanical Engineering Design
//!   (Johnson parabola, Goodman/Soderberg/Gerber lines, Marin equation)
//! * [EE] Engineers Edge, Marin endurance limit calculator (after T. H. Brown,
//!   Marks' Calculations for Machine Design): Se' = 0.504 Sut, surface factor
//!   table, size factor (d/7.62)^-0.1133
//! * [PSU] Penn State ME 360 notes n06_fatigue (after Norton): Goodman worked
//!   example (Na 2.507, Nm 7.533, N 1.88)
//! * [FMO] B. McGinty, fracturemechanics.org, Stress concentrations at holes:
//!   Kirsch Kt = 3 and the finite-width fit on net section stress
//! * [IRD] IRD Balancing, Technical Paper 1, Balance quality requirements of
//!   rigid rotors (ISO 1940/21940-11 formula, plane allocation, worked example)
//! * [VDI3106] VDI 3106 (chuck speed and clamping force; cited by name)
//! * [THOM] W. T. Thomson, Theory of Vibration with Applications (Rayleigh and
//!   Dunkerley methods; beam natural frequencies)

use std::f64::consts::PI;

const NAN: f64 = f64::NAN;
/// Standard acceleration of gravity, m/s^2 (CGPM 1901, exact).
pub const G0: f64 = 9.80665;

// ---------------------------------------------------------------- sections

/// Area properties of a plane section. x is horizontal, y vertical, origin at
/// the lower-left corner of the bounding box; second moments are about the
/// centroidal axes parallel to x and y.
#[derive(Debug, Clone, Copy)]
pub struct Section {
    pub a: f64, pub xc: f64, pub yc: f64,
    pub ix: f64, pub iy: f64, pub ixy: f64,
    pub width: f64, pub height: f64,
    /// Polar second moment J for round and tubular sections (NaN otherwise).
    pub j: f64,
}

impl Section {
    /// Principal second moments (I1 >= I2) and the angle of the I1 axis from
    /// x in degrees: I1,2 = (Ix+Iy)/2 +- sqrt(((Ix-Iy)/2)^2 + Ixy^2),
    /// tan 2 theta = -2 Ixy / (Ix - Iy) [GERE ch. 12].
    pub fn principal(&self) -> (f64, f64, f64) {
        let avg = (self.ix + self.iy) / 2.0;
        let r = (((self.ix - self.iy) / 2.0).powi(2) + self.ixy * self.ixy).sqrt();
        let th = 0.5 * (-2.0 * self.ixy).atan2(self.ix - self.iy);
        (avg + r, avg - r, th.to_degrees())
    }
}

/// Built-up section from rectangles (x0, y0, w, h, sign): sign +1 adds
/// material, -1 removes it (a hole that lies inside added material).
/// Parallel-axis theorem: I = sum(I_own + A d^2) [GERE ch. 12]. Sharp
/// corners: fillets and root radii of rolled shapes are ignored.
pub fn built_up(rects: &[(f64, f64, f64, f64, f64)]) -> Section {
    let (mut a, mut sx, mut sy) = (0.0, 0.0, 0.0);
    let (mut xmin, mut xmax, mut ymin, mut ymax) = (f64::INFINITY, f64::NEG_INFINITY, f64::INFINITY, f64::NEG_INFINITY);
    for &(x0, y0, w, h, s) in rects {
        let ai = s * w * h;
        a += ai; sx += ai * (x0 + w / 2.0); sy += ai * (y0 + h / 2.0);
        if s > 0.0 { xmin = xmin.min(x0); xmax = xmax.max(x0 + w); ymin = ymin.min(y0); ymax = ymax.max(y0 + h); }
    }
    let (xc, yc) = (sx / a, sy / a);
    let (mut ix, mut iy, mut ixy) = (0.0, 0.0, 0.0);
    for &(x0, y0, w, h, s) in rects {
        let ai = s * w * h;
        let (dx, dy) = (x0 + w / 2.0 - xc, y0 + h / 2.0 - yc);
        ix += s * w * h.powi(3) / 12.0 + ai * dy * dy;
        iy += s * h * w.powi(3) / 12.0 + ai * dx * dx;
        ixy += ai * dx * dy;
    }
    Section { a, xc: xc - xmin, yc: yc - ymin, ix, iy, ixy, width: xmax - xmin, height: ymax - ymin, j: NAN }
}

/// Section by shape code:
/// 0 rectangle (b, h); 1 hollow rectangle (B, H, wall t); 2 round (D);
/// 3 tube (D, inner d); 4 I-beam, symmetric (flange width b, depth h,
/// flange t_f, web t_w); 5 channel (b, h, t_f, t_w; web on the left);
/// 6 angle (vertical leg a, horizontal leg b, thickness t; corner lower left);
/// 7 tee (flange width b, depth h, flange t_f, stem t_w; flange on top).
/// Returns None for impossible proportions.
pub fn section(shape: u32, p1: f64, p2: f64, p3: f64, p4: f64) -> Option<Section> {
    let pos = |v: f64| v > 0.0 && v.is_finite();
    let s = match shape {
        0 if pos(p1) && pos(p2) => built_up(&[(0.0, 0.0, p1, p2, 1.0)]),
        1 if pos(p1) && pos(p2) && pos(p3) && 2.0 * p3 < p1.min(p2) =>
            built_up(&[(0.0, 0.0, p1, p2, 1.0), (p3, p3, p1 - 2.0 * p3, p2 - 2.0 * p3, -1.0)]),
        2 | 3 => {
            let (d, di) = (p1, if shape == 3 { p2 } else { 0.0 });
            if !pos(d) || !(di >= 0.0 && di < d) { return None; }
            // Round and tube: A = pi (D^2 - d^2)/4, I = pi (D^4 - d^4)/64, J = 2 I [GERE].
            let a = PI * (d * d - di * di) / 4.0;
            let i = PI * (d.powi(4) - di.powi(4)) / 64.0;
            Section { a, xc: d / 2.0, yc: d / 2.0, ix: i, iy: i, ixy: 0.0, width: d, height: d, j: 2.0 * i }
        }
        4 | 5 if pos(p1) && pos(p2) && pos(p3) && pos(p4) && 2.0 * p3 < p2 && p4 <= p1 => {
            let (b, h, tf, tw) = (p1, p2, p3, p4);
            let wx = if shape == 4 { (b - tw) / 2.0 } else { 0.0 };
            built_up(&[(0.0, 0.0, b, tf, 1.0), (0.0, h - tf, b, tf, 1.0), (wx, tf, tw, h - 2.0 * tf, 1.0)])
        }
        6 if pos(p1) && pos(p2) && pos(p3) && p3 < p1.min(p2) => {
            let (a, b, t) = (p1, p2, p3);
            built_up(&[(0.0, 0.0, t, a, 1.0), (t, 0.0, b - t, t, 1.0)])
        }
        7 if pos(p1) && pos(p2) && pos(p3) && pos(p4) && p3 < p2 && p4 <= p1 => {
            let (b, h, tf, tw) = (p1, p2, p3, p4);
            built_up(&[(0.0, h - tf, b, tf, 1.0), ((b - tw) / 2.0, 0.0, tw, h - tf, 1.0)])
        }
        _ => return None,
    };
    Some(s)
}

/// Flat accessor for the UI. which: 0 A, 1 x centroid, 2 y centroid (from the
/// lower-left corner), 3 Ix, 4 Iy, 5 Ixy, 6 I1, 7 I2, 8 angle of I1 from x
/// (deg), 9 Sx top = Ix/(h - y), 10 Sx bottom = Ix/y, 11 Sy left = Iy/x,
/// 12 Sy right = Iy/(b - x), 13 rx, 14 ry, 15 r min = sqrt(I2/A),
/// 16 J (round and tube only), 17 width, 18 height,
/// 19 torsion section modulus J/(D/2) (round and tube only).
pub fn section_flat(shape: f64, p1: f64, p2: f64, p3: f64, p4: f64, which: u32) -> f64 {
    let Some(s) = section(shape as u32, p1, p2, p3, p4) else { return NAN };
    let (i1, i2, th) = s.principal();
    match which {
        0 => s.a, 1 => s.xc, 2 => s.yc, 3 => s.ix, 4 => s.iy, 5 => s.ixy,
        6 => i1, 7 => i2, 8 => th,
        9 => s.ix / (s.height - s.yc), 10 => s.ix / s.yc,
        11 => s.iy / s.xc, 12 => s.iy / (s.width - s.xc),
        13 => (s.ix / s.a).sqrt(), 14 => (s.iy / s.a).sqrt(), 15 => (i2 / s.a).sqrt(),
        16 => s.j, 17 => s.width, 18 => s.height,
        19 => s.j / (s.width / 2.0),
        _ => NAN,
    }
}

// ------------------------------------------------------------------- beams

/// Beam supports: 0 cantilever (fixed at x = 0, free at x = L),
/// 1 simply supported (pinned at both ends), 2 fixed at both ends.
/// Values at x for a point load P at distance a from the left (fixed) end:
/// [deflection y (positive in the direction of the load), slope dy/dx,
/// bending moment M (sagging positive), shear V = dM/dx].
/// Sign convention: E I y'' = -M. Closed forms from [ROARK] Table 8.1 and
/// [AWC] DA 6 cases 8, 13, 22; checked in the tests against E I y'' = -M,
/// V = dM/dx and the published maxima.
pub fn beam_point(support: u32, l: f64, a: f64, p: f64, ei: f64, x: f64) -> [f64; 4] {
    if !(l > 0.0 && ei > 0.0 && (0.0..=l).contains(&a) && (0.0..=l).contains(&x)) { return [NAN; 4]; }
    let b = l - a;
    match support {
        0 => {
            if x <= a {
                [p * x * x * (3.0 * a - x) / (6.0 * ei), p * x * (2.0 * a - x) / (2.0 * ei), -p * (a - x), p]
            } else {
                [p * a * a * (3.0 * x - a) / (6.0 * ei), p * a * a / (2.0 * ei), 0.0, 0.0]
            }
        }
        1 => {
            if x <= a {
                [p * b * x * (l * l - b * b - x * x) / (6.0 * ei * l), p * b * (l * l - b * b - 3.0 * x * x) / (6.0 * ei * l), p * b * x / l, p * b / l]
            } else {
                let xr = l - x;
                [p * a * xr * (l * l - a * a - xr * xr) / (6.0 * ei * l), -p * a * (l * l - a * a - 3.0 * xr * xr) / (6.0 * ei * l), p * a * xr / l, -p * a / l]
            }
        }
        2 => {
            // Fixed-fixed: y = P b^2 x^2 (3 a L - 3 a x - b x) / (6 E I L^3) for x <= a,
            // mirror image (a <-> b, x -> L - x) beyond the load [ROARK][AWC case 22].
            let side = |a: f64, b: f64, x: f64| -> [f64; 4] {
                let l3 = l.powi(3);
                let y = p * b * b * x * x * (3.0 * a * l - 3.0 * a * x - b * x) / (6.0 * ei * l3);
                let th = p * b * b * (6.0 * a * l * x - 3.0 * (3.0 * a + b) * x * x) / (6.0 * ei * l3);
                let m = p * b * b * ((3.0 * a + b) * x - a * l) / l3;
                let v = p * b * b * (3.0 * a + b) / l3;
                [y, th, m, v]
            };
            if x <= a { side(a, b, x) } else { let r = side(b, a, l - x); [r[0], -r[1], r[2], -r[3]] }
        }
        _ => [NAN; 4],
    }
}

/// Values at x for a uniform load w (force per length) over the whole span;
/// same layout and sign convention as `beam_point` [ROARK][AWC cases 1, 15, 21].
pub fn beam_udl(support: u32, l: f64, w: f64, ei: f64, x: f64) -> [f64; 4] {
    if !(l > 0.0 && ei > 0.0 && (0.0..=l).contains(&x)) { return [NAN; 4]; }
    match support {
        0 => [w * x * x * (6.0 * l * l - 4.0 * l * x + x * x) / (24.0 * ei), w * x * (3.0 * l * l - 3.0 * l * x + x * x) / (6.0 * ei),
              -w * (l - x).powi(2) / 2.0, w * (l - x)],
        1 => [w * x * (l.powi(3) - 2.0 * l * x * x + x.powi(3)) / (24.0 * ei), w * (l.powi(3) - 6.0 * l * x * x + 4.0 * x.powi(3)) / (24.0 * ei),
              w * x * (l - x) / 2.0, w * (l / 2.0 - x)],
        2 => [w * x * x * (l - x).powi(2) / (24.0 * ei), w * x * (l - x) * (l - 2.0 * x) / (12.0 * ei),
              w * (6.0 * l * x - 6.0 * x * x - l * l) / 12.0, w * (l / 2.0 - x)],
        _ => [NAN; 4],
    }
}

/// Point load and uniform load together (superposition). `p` or `w` may be 0.
pub fn beam_at(support: u32, l: f64, a: f64, p: f64, w: f64, ei: f64, x: f64) -> [f64; 4] {
    let mut r = [0.0; 4];
    if p != 0.0 { let q = beam_point(support, l, a, p, ei, x); for i in 0..4 { r[i] += q[i]; } }
    if w != 0.0 { let q = beam_udl(support, l, w, ei, x); for i in 0..4 { r[i] += q[i]; } }
    if !(l > 0.0 && ei > 0.0 && (0.0..=l).contains(&x)) { return [NAN; 4]; }
    r
}

/// Largest |value| of component k over the span and where it occurs: dense
/// sampling (with the load point and ends) then a golden-section refinement.
fn beam_extreme(support: u32, l: f64, a: f64, p: f64, w: f64, ei: f64, k: usize) -> (f64, f64) {
    let f = |x: f64| beam_at(support, l, a, p, w, ei, x)[k];
    let n = 2000;
    let mut best = (0.0f64, 0.0f64); // (signed value, x)
    let mut cand: Vec<f64> = (0..=n).map(|i| l * i as f64 / n as f64).collect();
    if p != 0.0 { cand.push(a); cand.push((a - 1e-9 * l).max(0.0)); cand.push((a + 1e-9 * l).min(l)); }
    for &x in &cand { let v = f(x); if v.abs() > best.0.abs() { best = (v, x); } }
    // Refine an interior extreme (smooth between samples).
    let h = l / n as f64;
    let (mut lo, mut hi) = ((best.1 - h).max(0.0), (best.1 + h).min(l));
    if p != 0.0 && (lo < a && a < hi) { return best; }
    let g = (5f64.sqrt() - 1.0) / 2.0;
    for _ in 0..80 {
        let (x1, x2) = (hi - g * (hi - lo), lo + g * (hi - lo));
        if f(x1).abs() > f(x2).abs() { hi = x2; } else { lo = x1; }
    }
    let xm = (lo + hi) / 2.0;
    let vm = f(xm);
    if vm.abs() > best.0.abs() { (vm, xm) } else { best }
}

/// Beam summary. which: 0 max |deflection| (signed), 1 its x, 2 max |slope|
/// (dimensionless, radians), 3 its x, 4 max |moment| (signed), 5 its x,
/// 6 max |shear|, 7 left reaction force, 8 left end moment, 9 right reaction
/// force, 10 right end moment (0 for a free or pinned end).
/// Reactions follow from the shear and moment at the ends.
pub fn beam_flat(support: f64, l: f64, a: f64, p: f64, w: f64, ei: f64, which: u32) -> f64 {
    let s = support as u32;
    if !(l > 0.0 && ei > 0.0) || s > 2 || (p != 0.0 && !(0.0..=l).contains(&a)) { return NAN; }
    let at = |x: f64| beam_at(s, l, a, p, w, ei, x);
    match which {
        0 | 1 => { let r = beam_extreme(s, l, a, p, w, ei, 0); if which == 0 { r.0 } else { r.1 } }
        2 | 3 => { let r = beam_extreme(s, l, a, p, w, ei, 1); if which == 2 { r.0 } else { r.1 } }
        4 | 5 => { let r = beam_extreme(s, l, a, p, w, ei, 2); if which == 4 { r.0 } else { r.1 } }
        6 => { let r0 = at(0.0)[3].abs(); let r1 = at(l)[3].abs(); let rm = beam_extreme(s, l, a, p, w, ei, 3).0.abs(); r0.max(r1).max(rm) }
        7 => at(0.0)[3],
        8 => at(0.0)[2],
        9 => if s == 0 { 0.0 } else { -at(l)[3] },
        10 => at(l)[2],
        _ => NAN,
    }
}

/// Bending stress sigma = M c / I = M / S [GERE ch. 5].
pub fn bending_stress(m: f64, i: f64, c: f64) -> f64 { m * c / i }

// ----------------------------------------------------------------- torsion

/// Polar second moment of a round shaft or tube: J = pi (D^4 - d^4) / 32 [GERE ch. 3].
pub fn polar_moment(d_out: f64, d_in: f64) -> f64 {
    if !(d_out > 0.0 && d_in >= 0.0 && d_in < d_out) { return NAN; }
    PI * (d_out.powi(4) - d_in.powi(4)) / 32.0
}
/// Shear stress at radius r: tau = T r / J. Max at the outside, r = D/2 [GERE ch. 3].
pub fn torsion_stress(t: f64, d_out: f64, d_in: f64, r: f64) -> f64 { t * r / polar_moment(d_out, d_in) }
/// Angle of twist in radians: phi = T L / (G J) [GERE ch. 3].
pub fn torsion_angle(t: f64, l: f64, g: f64, d_out: f64, d_in: f64) -> f64 { t * l / (g * polar_moment(d_out, d_in)) }
/// Solid shaft diameter for an allowable shear stress: d = (16 T / (pi tau))^(1/3).
pub fn torsion_solid_dia(t: f64, tau: f64) -> f64 { (16.0 * t / (PI * tau)).cbrt() }
/// Shear modulus of an isotropic material: G = E / (2 (1 + nu)) [GERE ch. 3].
pub fn shear_modulus(e: f64, nu: f64) -> f64 { e / (2.0 * (1.0 + nu)) }
/// Power in W from torque in N m and speed in rpm: P = T omega, omega = 2 pi n / 60.
pub fn shaft_power_w(t_nm: f64, rpm: f64) -> f64 { t_nm * 2.0 * PI * rpm / 60.0 }
/// Torque in N m from power in W and speed in rpm.
pub fn shaft_torque_nm(p_w: f64, rpm: f64) -> f64 { p_w * 60.0 / (2.0 * PI * rpm) }

// ----------------------------------------------------------------- columns

/// Euler critical stress: sigma_cr = pi^2 E / (K L / r)^2 [GERE ch. 11][SHIG].
pub fn euler_stress(e: f64, slenderness: f64) -> f64 { PI * PI * e / (slenderness * slenderness) }
/// Johnson parabola: sigma_cr = Sy - (Sy (K L / r) / (2 pi))^2 / E [SHIG].
pub fn johnson_stress(e: f64, sy: f64, slenderness: f64) -> f64 { sy - (sy * slenderness / (2.0 * PI)).powi(2) / e }
/// Slenderness where the Johnson parabola meets the Euler curve (tangent):
/// (K L / r)_1 = sqrt(2 pi^2 E / Sy) [SHIG].
pub fn transition_slenderness(e: f64, sy: f64) -> f64 { (2.0 * PI * PI * e / sy).sqrt() }

/// Column summary. which: 0 slenderness K L / r, 1 transition slenderness,
/// 2 method (1 Euler, 2 Johnson), 3 critical stress, 4 critical load
/// sigma_cr A, 5 Euler stress at this slenderness (for comparison).
pub fn column_flat(e: f64, sy: f64, k: f64, l: f64, area: f64, r: f64, which: u32) -> f64 {
    if !(e > 0.0 && sy > 0.0 && k > 0.0 && l > 0.0 && area > 0.0 && r > 0.0) { return NAN; }
    let lam = k * l / r;
    let lt = transition_slenderness(e, sy);
    let johnson = lam < lt;
    let s = if johnson { johnson_stress(e, sy, lam) } else { euler_stress(e, lam) };
    match which { 0 => lam, 1 => lt, 2 => if johnson { 2.0 } else { 1.0 }, 3 => s, 4 => s * area, 5 => euler_stress(e, lam), _ => NAN }
}

// ------------------------------------------------------ stress concentration

/// Kt for a central circular hole in a finite-width plate in tension, on the
/// net-section stress sigma_nom = F / ((W - d) t). Fit printed by [FMO]:
/// Kt = 3 - 3.14 (d/W) + 3.667 (d/W)^2 - 1.527 (d/W)^3; Kt -> 3 (Kirsch) as
/// d/W -> 0. Returns NaN outside 0 <= d/W < 1.
pub fn kt_plate_hole(d_over_w: f64) -> f64 {
    let r = d_over_w;
    if !(0.0..1.0).contains(&r) { return NAN; }
    3.0 - 3.14 * r + 3.667 * r * r - 1.527 * r.powi(3)
}
/// Inglis (1913), elliptical hole in an infinite plate, load across the a
/// axis: Kt = 1 + 2 a / b (exact elastic solution; a circle gives 3).
pub fn kt_ellipse(a: f64, b: f64) -> f64 { if a > 0.0 && b > 0.0 { 1.0 + 2.0 * a / b } else { NAN } }
/// Fatigue notch factor from the notch sensitivity q: Kf = 1 + q (Kt - 1) [EE][SHIG].
pub fn notch_kf(kt: f64, q: f64) -> f64 { 1.0 + q * (kt - 1.0) }

// ----------------------------------------------------------------- fatigue

/// Rotating-beam endurance limit estimate for steels [EE]: Se' = 0.504 Sut,
/// capped at 700 MPa (Sut > 1400 MPa) or 100 kpsi (Sut > 200 kpsi).
/// `inch` = 1 when Sut is in kpsi, 0 for MPa. An estimate, not a test value.
pub fn endurance_estimate(sut: f64, inch: f64) -> f64 {
    if !(sut > 0.0) { return NAN; }
    let (lim, cap) = if inch != 0.0 { (200.0, 100.0) } else { (1400.0, 700.0) };
    if sut <= lim { 0.504 * sut } else { cap }
}
/// Marin surface factor ka = a Sut^b [EE] (table after Marks'), capped at 1.
/// finish: 0 ground, 1 machined or cold-drawn, 2 hot-rolled, 3 as forged.
/// `inch` = 1 for Sut in kpsi, 0 for MPa.
pub fn marin_surface(finish: f64, sut: f64, inch: f64) -> f64 {
    let (am, ak, b) = match finish as u32 { 0 => (1.58, 1.34, -0.085), 1 => (4.51, 2.70, -0.265), 2 => (57.7, 14.4, -0.718), 3 => (272.0, 39.9, -0.995), _ => return NAN };
    if !(sut > 0.0) { return NAN; }
    ((if inch != 0.0 { ak } else { am }) * sut.powf(b)).min(1.0)
}
/// Marin size factor for bending or torsion of a round part [EE]:
/// kb = (d / 7.62)^-0.1133 for 2.79 <= d <= 51 mm (inch form (d/0.3)^-0.1133
/// is the same fit). NaN outside that range (enter your own factor).
pub fn marin_size_mm(d_mm: f64) -> f64 {
    if !(2.79..=51.0).contains(&d_mm) { return NAN; }
    (d_mm / 7.62).powf(-0.1133)
}
/// Alternating and mean stress from the extremes of a cycle.
pub fn stress_alt(smax: f64, smin: f64) -> f64 { (smax - smin) / 2.0 }
pub fn stress_mean(smax: f64, smin: f64) -> f64 { (smax + smin) / 2.0 }

/// Fatigue factor of safety for alternating sa and mean sm stress [SHIG]:
/// line 0 modified Goodman 1/n = sa/Se + sm/Sut; 1 Soderberg 1/n = sa/Se + sm/Sy;
/// 2 Gerber n sa/Se + (n sm/Sut)^2 = 1, solved:
/// n = 1/2 (Sut/sm)^2 (sa/Se) [-1 + sqrt(1 + (2 sm Se / (Sut sa))^2)];
/// 3 Langer first-cycle yield n = Sy / (sa + |sm|).
/// For sm <= 0 (compressive mean) lines 0-2 give n = Se / sa (the usual
/// conservative choice [SHIG]).
pub fn fatigue_factor(line: u32, sa: f64, sm: f64, se: f64, sut: f64, sy: f64) -> f64 {
    if !(sa >= 0.0 && se > 0.0) { return NAN; }
    if line == 3 { return if sy > 0.0 { sy / (sa + sm.abs()) } else { NAN }; }
    if sm <= 0.0 { return if sa > 0.0 { se / sa } else { NAN }; }
    match line {
        0 if sut > 0.0 => 1.0 / (sa / se + sm / sut),
        1 if sy > 0.0 => 1.0 / (sa / se + sm / sy),
        2 if sut > 0.0 => {
            if sa == 0.0 { return sut / sm; }
            let x = 2.0 * sm * se / (sut * sa);
            0.5 * (sut / sm).powi(2) * (sa / se) * (-1.0 + (1.0 + x * x).sqrt())
        }
        _ => NAN,
    }
}

// ----------------------------------------------------- centrifugal, balance

/// Angular speed in rad/s from rpm: omega = 2 pi n / 60 = pi n / 30.
pub fn omega(rpm: f64) -> f64 { PI * rpm / 30.0 }
/// Centrifugal force in N of a mass m (kg) whose centre of gravity runs at
/// radius r (m): F = m r omega^2 (Newton's second law for circular motion).
pub fn centrifugal_n(m_kg: f64, r_m: f64, rpm: f64) -> f64 { m_kg * r_m * omega(rpm).powi(2) }
/// Grip of a chuck at speed [VDI3106 by name]: total jaw centrifugal force
/// Fc = sum(m r) omega^2; gripping an outside diameter (jaws close inward)
/// Fsp = Fsp0 - Fc, gripping a bore (jaws open outward) Fsp = Fsp0 + Fc.
/// `sum_mr` in kg m (all jaws, base plus top jaw), forces in N.
pub fn chuck_grip_n(f0: f64, sum_mr: f64, rpm: f64, internal: f64) -> f64 {
    let fc = sum_mr * omega(rpm).powi(2);
    if internal != 0.0 { f0 + fc } else { f0 - fc }
}
/// Speed (rpm) at which an outside-diameter grip falls from f0 to f_req.
pub fn chuck_speed_for_grip(f0: f64, f_req: f64, sum_mr: f64) -> f64 {
    if !(sum_mr > 0.0 && f0 > f_req) { return NAN; }
    30.0 / PI * ((f0 - f_req) / sum_mr).sqrt()
}
/// Force in N from an unbalance U in g mm at n rpm: F = U omega^2 (U in kg m).
pub fn unbalance_force_n(u_gmm: f64, rpm: f64) -> f64 { u_gmm * 1e-6 * omega(rpm).powi(2) }
/// ISO 21940-11 permissible residual unbalance in g mm for balance grade G
/// (mm/s), rotor mass m (kg) and maximum service speed n (rpm):
/// U_per = 1000 G m / omega = (60 000 / 2 pi) G m / n = 9549.3 G m / n [IRD].
pub fn iso_uper_gmm(g: f64, m_kg: f64, rpm: f64) -> f64 {
    if !(g > 0.0 && m_kg > 0.0 && rpm > 0.0) { return NAN; }
    1000.0 * g * m_kg / omega(rpm)
}
/// Permissible specific unbalance (centre-of-mass offset) in g mm/kg = um.
pub fn iso_eper_um(g: f64, rpm: f64) -> f64 { iso_uper_gmm(g, 1.0, rpm) }
/// Balance grade G (mm/s) reached by a residual unbalance U (g mm).
pub fn iso_grade_from_u(u_gmm: f64, m_kg: f64, rpm: f64) -> f64 { u_gmm * omega(rpm) / (1000.0 * m_kg) }
/// Two-plane allocation [IRD]: share of plane L = U hR / b, plane R = U hL / b,
/// hL and hR the distances from the centre of gravity to each plane, b their
/// separation (planes between the bearings, b > d/3). Each share should be
/// 30-70 % of U_per; outside that, use the narrow-rotor rules.
pub fn plane_share(u: f64, h_this: f64, h_other: f64) -> f64 {
    let b = h_this + h_other;
    if !(b > 0.0) { return NAN; }
    u * h_other / b
}

// ------------------------------------------------------------ critical speed

/// First critical (whirling) speed of a uniform shaft on rigid bearings.
/// SI units: E I in N m^2, length m, mass per length mu kg/m, disc masses kg
/// at positions x (m from the left bearing or the fixed end).
/// support 1 simply supported (bearing at each end), 0 overhung (cantilever).
/// Assumptions: Euler-Bernoulli shaft, rigid bearings, discs as point
/// masses (no gyroscopic or rotary inertia), small deflection, no damping.
/// which: 0 Rayleigh (static deflection curve, shaft lumped into 100 pieces) rpm,
/// 1 Dunkerley rpm, 2 shaft alone (exact beam eigenvalue) rpm,
/// 3 largest static deflection under gravity (m) [THOM].
pub fn critical_speed(support: u32, l: f64, ei: f64, mu: f64, discs: &[(f64, f64)], which: u32) -> f64 {
    if !(l > 0.0 && ei > 0.0 && mu >= 0.0) || support > 1 { return NAN; }
    if discs.iter().any(|&(x, m)| !(0.0..=l).contains(&x) || !(m >= 0.0)) { return NAN; }
    if mu == 0.0 && discs.iter().all(|d| d.1 == 0.0) { return NAN; }
    // Influence coefficient: deflection at xi from a unit load at xj.
    let alpha = |xi: f64, xj: f64| beam_point(support, l, xj, 1.0, ei, xi)[0];
    let to_rpm = |w: f64| w * 30.0 / PI;
    // Shaft alone: omega = (beta L)^2 sqrt(E I / (mu L^4)); beta L = pi (pinned-pinned),
    // 1.875104 (cantilever, root of cos x cosh x = -1) [THOM].
    let bl: f64 = if support == 1 { PI } else { 1.875_104_068_711_961 };
    let w_shaft = if mu > 0.0 { bl * bl * (ei / (mu * l.powi(4))).sqrt() } else { f64::INFINITY };
    match which {
        1 => {
            let mut inv = if mu > 0.0 { 1.0 / (w_shaft * w_shaft) } else { 0.0 };
            for &(x, m) in discs { if m > 0.0 { inv += m * alpha(x, x); } }
            to_rpm(1.0 / inv.sqrt())
        }
        2 => if mu > 0.0 { to_rpm(w_shaft) } else { NAN },
        0 | 3 => {
            let n = 100;
            let mut pts: Vec<(f64, f64)> = discs.iter().copied().filter(|d| d.1 > 0.0).collect();
            if mu > 0.0 { for i in 0..n { pts.push((l * (i as f64 + 0.5) / n as f64, mu * l / n as f64)); } }
            let ys: Vec<f64> = pts.iter().map(|&(xi, _)| pts.iter().map(|&(xj, mj)| mj * G0 * alpha(xi, xj)).sum()).collect();
            if which == 3 {
                // Largest static deflection anywhere: sample the span.
                return (0..=400).map(|k| { let x = l * k as f64 / 400.0; pts.iter().map(|&(xj, mj)| mj * G0 * alpha(x, xj)).sum::<f64>() }).fold(0.0, f64::max);
            }
            let num: f64 = pts.iter().zip(&ys).map(|(&(_, m), &y)| m * y).sum();
            let den: f64 = pts.iter().zip(&ys).map(|(&(_, m), &y)| m * y * y).sum();
            to_rpm((G0 * num / den).sqrt())
        }
        _ => NAN,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b} (tol {tol})"); }
    fn rel(a: f64, b: f64, tol: f64) { assert!(((a - b) / b).abs() <= tol, "{a} vs {b} (rel {tol})"); }

    #[test]
    fn rectangle_round_tube() {
        // b h^3 / 12 and pi D^4 / 64 [GERE].
        let s = section(0, 2.0, 4.0, 0.0, 0.0).unwrap();
        close(s.a, 8.0, 1e-12); close(s.ix, 2.0 * 64.0 / 12.0, 1e-12); close(s.iy, 4.0 * 8.0 / 12.0, 1e-12);
        close(section_flat(0.0, 2.0, 4.0, 0.0, 0.0, 9), 32.0 / 3.0 / 2.0, 1e-12); // S = b h^2 / 6
        close(section_flat(2.0, 50.0, 0.0, 0.0, 0.0, 3), PI * 50f64.powi(4) / 64.0, 1e-6);
        close(section_flat(3.0, 50.0, 40.0, 0.0, 0.0, 16), PI * (50f64.powi(4) - 40f64.powi(4)) / 32.0, 1e-6);
        // Hollow rectangle = outer minus inner.
        let h = section(1, 4.0, 6.0, 0.5, 0.0).unwrap();
        close(h.ix, (4.0 * 216.0 - 3.0 * 125.0) / 12.0, 1e-12);
        close(h.yc, 3.0, 1e-12);
        assert!(section(1, 4.0, 6.0, 2.0, 0.0).is_none());
    }

    #[test]
    fn i_beam_closed_form() {
        // Ix = [b h^3 - (b - tw)(h - 2 tf)^3] / 12 for a symmetric I [GERE].
        let (b, h, tf, tw): (f64, f64, f64, f64) = (100.0, 200.0, 10.0, 6.0);
        let s = section(4, b, h, tf, tw).unwrap();
        close(s.ix, (b * h.powi(3) - (b - tw) * (h - 2.0 * tf).powi(3)) / 12.0, 1e-6);
        close(s.iy, 2.0 * tf * b.powi(3) / 12.0 + (h - 2.0 * tf) * tw.powi(3) / 12.0, 1e-6);
        close(s.yc, 100.0, 1e-9); close(s.xc, 50.0, 1e-9); close(s.ixy, 0.0, 1e-6);
        // Channel: same Ix as the I; centroid nearer the web.
        let c = section(5, b, h, tf, tw).unwrap();
        close(c.ix, s.ix, 1e-6);
        let a = 2.0 * b * tf + (h - 2.0 * tf) * tw;
        close(c.xc, (2.0 * b * tf * b / 2.0 + (h - 2.0 * tf) * tw * tw / 2.0) / a, 1e-9);
    }

    #[test]
    fn tee_worked_example() {
        // T-section 100 x 20 flange, 20 x 80 stem (h = 100): a common
        // hand-calculation set. A = 3600; y from the bottom = (2000*90 + 1600*40)/3600
        // = 67.78; Ix = 100*20^3/12 + 2000*22.22^2 + 20*80^3/12 + 1600*27.78^2 = 3.142e6.
        let s = section(7, 100.0, 100.0, 20.0, 20.0).unwrap();
        close(s.a, 3600.0, 1e-9);
        close(s.yc, 244_000.0 / 3600.0, 1e-9);
        let yc: f64 = 244_000.0 / 3600.0;
        let ix = 100.0 * 8000.0 / 12.0 + 2000.0 * (90.0 - yc).powi(2) + 20.0 * 512_000.0 / 12.0 + 1600.0 * (40.0 - yc).powi(2);
        close(s.ix, ix, 1e-6);
        rel(s.ix, 3.1422e6, 1e-4);
    }

    #[test]
    fn equal_angle() {
        // L 4 x 4 x 1/2 in, sharp corners: A = 3.75 in^2, y = 1.1833 in, the
        // AISC Manual lists 3.75 in^2 and 1.18 in (with fillets). Equal legs:
        // Ix = Iy, principal axes at 45 deg, I1 = Ix + |Ixy|.
        let s = section(6, 4.0, 4.0, 0.5, 0.0).unwrap();
        close(s.a, 3.75, 1e-12); close(s.yc, 4.4375 / 3.75, 1e-12); close(s.xc, s.yc, 1e-12);
        close(s.ix, s.iy, 1e-12);
        assert!(s.ixy < 0.0);
        let (i1, i2, th) = s.principal();
        close(th, 45.0, 1e-9); close(i1, s.ix - s.ixy, 1e-12); close(i2, s.ix + s.ixy, 1e-12);
        close(s.ix, 5.5615, 1e-3);
        close(section_flat(6.0, 4.0, 4.0, 0.5, 0.0, 15), (i2 / 3.75).sqrt(), 1e-12);
    }

    fn check_beam_consistency(support: u32, l: f64, a: f64, p: f64, w: f64, ei: f64) {
        // E I y'' = -M, slope = dy/dx, V = dM/dx by central differences.
        let h = l * 1e-4;
        for k in 1..20 {
            let x = l * k as f64 / 20.0 + 0.0123 * l;
            if x - 2.0 * h < 0.0 || x + 2.0 * h > l || (p != 0.0 && (x - a).abs() < 3.0 * h) { continue; }
            let f = |x: f64| beam_at(support, l, a, p, w, ei, x);
            let (ym, y0, yp) = (f(x - h)[0], f(x)[0], f(x + h)[0]);
            let m = f(x)[2];
            let scale = (p.abs() * l + w.abs() * l * l).max(1e-30);
            close(ei * (yp - 2.0 * y0 + ym) / (h * h), -m, 1e-4 * scale);
            close((yp - ym) / (2.0 * h), f(x)[1], 1e-6 * f(x)[1].abs().max(1e-12) + 1e-9 * scale * l * l / ei);
            close((f(x + h)[2] - f(x - h)[2]) / (2.0 * h), f(x)[3], 1e-6 * scale / l + 1e-9);
        }
    }

    #[test]
    fn beam_equations_consistent() {
        for s in 0..3 {
            for &a in &[0.3, 0.5, 0.8, 1.0] {
                if s != 0 && a == 1.0 { continue; }
                check_beam_consistency(s, 1.0, a, 1000.0, 0.0, 2e4);
            }
            check_beam_consistency(s, 2.0, 0.0, 0.0, 50.0, 3e4);
        }
        // Boundary conditions.
        close(beam_point(0, 1.0, 0.7, 1.0, 1.0, 0.0)[0], 0.0, 1e-15);
        close(beam_point(0, 1.0, 0.7, 1.0, 1.0, 0.0)[1], 0.0, 1e-15);
        close(beam_point(1, 1.0, 0.3, 1.0, 1.0, 1.0)[0], 0.0, 1e-15);
        close(beam_point(2, 1.0, 0.3, 1.0, 1.0, 1.0)[0], 0.0, 1e-15);
        close(beam_point(2, 1.0, 0.3, 1.0, 1.0, 1.0)[1], 0.0, 1e-15);
        close(beam_udl(2, 1.0, 1.0, 1.0, 1.0)[1], 0.0, 1e-15);
        // Continuity at the load point.
        let l = beam_point(2, 1.0, 0.3, 1.0, 1.0, 0.3 - 1e-12);
        let r = beam_point(2, 1.0, 0.3, 1.0, 1.0, 0.3 + 1e-12);
        close(l[0], r[0], 1e-12); close(l[1], r[1], 1e-10); close(l[2], r[2], 1e-10);
    }

    #[test]
    fn beam_published_maxima() {
        // AWC Design Aid 6 (free): maximum deflections and moments.
        let (l, p, w, ei): (f64, f64, f64, f64) = (2.0, 1000.0, 300.0, 5.0e5);
        // Case 7: simple beam, centre load: P L^3 / (48 E I), M = P L / 4.
        rel(beam_flat(1.0, l, 1.0, p, 0.0, ei, 0), p * l.powi(3) / (48.0 * ei), 1e-9);
        rel(beam_flat(1.0, l, 1.0, p, 0.0, ei, 4), p * l / 4.0, 1e-9);
        // Case 1: simple beam, uniform load: 5 w L^4 / (384 E I), M = w L^2 / 8, end slope w L^3 / (24 E I).
        rel(beam_flat(1.0, l, 0.0, 0.0, w, ei, 0), 5.0 * w * l.powi(4) / (384.0 * ei), 1e-9);
        rel(beam_flat(1.0, l, 0.0, 0.0, w, ei, 4), w * l * l / 8.0, 1e-9);
        rel(beam_flat(1.0, l, 0.0, 0.0, w, ei, 2), w * l.powi(3) / (24.0 * ei), 1e-9);
        // Case 8: simple beam, load at a > b: max at x = sqrt(a (a + 2b) / 3),
        // P a b (a + 2 b) sqrt(3 a (a + 2 b)) / (27 E I L).
        let (a, b): (f64, f64) = (1.4, 0.6);
        rel(beam_flat(1.0, l, a, p, 0.0, ei, 0), p * a * b * (a + 2.0 * b) * (3.0 * a * (a + 2.0 * b)).sqrt() / (27.0 * ei * l), 1e-9);
        rel(beam_flat(1.0, l, a, p, 0.0, ei, 1), (a * (a + 2.0 * b) / 3.0).sqrt(), 1e-6);
        close(beam_flat(1.0, l, a, p, 0.0, ei, 7), p * b / l, 1e-9);
        // Cantilever, end load: P L^3 / (3 E I), slope P L^2 / (2 E I), M = P L.
        rel(beam_flat(0.0, l, l, p, 0.0, ei, 0), p * l.powi(3) / (3.0 * ei), 1e-9);
        rel(beam_flat(0.0, l, l, p, 0.0, ei, 2), p * l * l / (2.0 * ei), 1e-9);
        rel(beam_flat(0.0, l, l, p, 0.0, ei, 4), -p * l, 1e-9);
        // Cantilever, uniform: w L^4 / (8 E I), M = w L^2 / 2.
        rel(beam_flat(0.0, l, 0.0, 0.0, w, ei, 0), w * l.powi(4) / (8.0 * ei), 1e-9);
        rel(beam_flat(0.0, l, 0.0, 0.0, w, ei, 8), -w * l * l / 2.0, 1e-9);
        // Fixed both ends, uniform: w L^4 / (384 E I), end M = w L^2 / 12.
        rel(beam_flat(2.0, l, 0.0, 0.0, w, ei, 0), w * l.powi(4) / (384.0 * ei), 1e-9);
        rel(beam_flat(2.0, l, 0.0, 0.0, w, ei, 4), -w * l * l / 12.0, 1e-9);
        // Fixed both ends, centre load: P L^3 / (192 E I), M = P L / 8.
        rel(beam_flat(2.0, l, 1.0, p, 0.0, ei, 0), p * l.powi(3) / (192.0 * ei), 1e-9);
        rel(beam_flat(2.0, l, 1.0, p, 0.0, ei, 4).abs(), p * l / 8.0, 1e-9);
        // Fixed both ends, load at a < b: max 2 P a^3 b^2 / (3 E I (3a + b)^2) at x = L - 2 b L / (3 b + a)
        // (mirror of the a > b form), end moment P a b^2 / L^2, reaction P b^2 (3a + b) / L^3.
        let (a, b): (f64, f64) = (0.6, 1.4);
        rel(beam_flat(2.0, l, a, p, 0.0, ei, 0), 2.0 * p * b.powi(3) * a * a / (3.0 * ei * (3.0 * b + a).powi(2)), 1e-9);
        rel(beam_flat(2.0, l, a, p, 0.0, ei, 8), -p * a * b * b / (l * l), 1e-9);
        rel(beam_flat(2.0, l, a, p, 0.0, ei, 7), p * b * b * (3.0 * a + b) / l.powi(3), 1e-9);
        rel(beam_flat(2.0, l, a, p, 0.0, ei, 9), p * a * a * (3.0 * b + a) / l.powi(3), 1e-9);
        // Superposition: shear max on a simple beam with both loads = larger reaction.
        let v = beam_flat(1.0, l, 0.5, p, w, ei, 6);
        close(v, p * 1.5 / 2.0 + w * l / 2.0, 1e-6);
        // US units worked check: 2 x 4 in steel bar (I = 10.667 in^4), 48 in simple span,
        // 1000 lbf at mid-span, E = 30e6 psi: 1000*48^3/(48*30e6*10.667) = 0.0072 in.
        let i = section_flat(0.0, 2.0, 4.0, 0.0, 0.0, 3);
        close(beam_flat(1.0, 48.0, 24.0, 1000.0, 0.0, 30e6 * i, 0), 0.0072, 1e-5);
        close(bending_stress(1000.0 * 48.0 / 4.0, i, 2.0), 2250.0, 1e-9);
    }

    #[test]
    fn torsion() {
        // tau = 16 T / (pi d^3) for a solid shaft; T = 100 N m = 1e5 N mm, d = 20 mm: 63.66 MPa.
        close(torsion_stress(1e5, 20.0, 0.0, 10.0), 16e5 / (PI * 8000.0), 1e-9);
        close(torsion_stress(1e5, 20.0, 0.0, 10.0), 63.662, 1e-3);
        close(torsion_solid_dia(1e5, 63.661_977_236_758_13), 20.0, 1e-9);
        // phi = T L / (G J), G = 80 GPa = 80 000 MPa, L = 1000 mm: 0.0796 rad.
        let j = polar_moment(20.0, 0.0);
        close(j, PI * 160_000.0 / 32.0, 1e-9);
        close(torsion_angle(1e5, 1000.0, 80_000.0, 20.0, 0.0), 1e8 / (80_000.0 * j), 1e-12);
        close(torsion_angle(1e5, 1000.0, 80_000.0, 20.0, 0.0), 0.079_577, 1e-6);
        // G = E / (2 (1 + nu)): 200 GPa, 0.3 -> 76.92 GPa.
        close(shear_modulus(200.0, 0.3), 76.923, 1e-3);
        // P = T omega: 100 N m at 1000 rpm = 10.472 kW; and the 9549 rule (kW = N m rpm / 9549).
        close(shaft_power_w(100.0, 1000.0), 10_471.976, 1e-3);
        close(shaft_torque_nm(10_000.0, 1000.0), 10_000.0 * 9.549_296 / 1000.0, 1e-4);
        // Tube: the inside radius sees tau * d / D.
        close(torsion_stress(1e5, 40.0, 30.0, 15.0) / torsion_stress(1e5, 40.0, 30.0, 20.0), 0.75, 1e-12);
    }

    #[test]
    fn columns() {
        // Johnson meets Euler with the same value and slope at the transition [SHIG].
        let (e, sy): (f64, f64) = (207_000.0, 350.0);
        let lt = transition_slenderness(e, sy);
        close(johnson_stress(e, sy, lt), euler_stress(e, lt), 1e-9);
        close(euler_stress(e, lt), sy / 2.0, 1e-9);
        let h = 1e-4;
        close((johnson_stress(e, sy, lt + h) - johnson_stress(e, sy, lt - h)) / (2.0 * h), (euler_stress(e, lt + h) - euler_stress(e, lt - h)) / (2.0 * h), 1e-6);
        // Pinned 25 mm round bar, 1 m long, E 207 GPa: r = 6.25 mm, KL/r = 160 (Euler):
        // Pcr = pi^2 E I / L^2 = pi^2 * 207000 * 19174.76 / 1e6 = 39 173 N.
        let a = section_flat(2.0, 25.0, 0.0, 0.0, 0.0, 0);
        let r = section_flat(2.0, 25.0, 0.0, 0.0, 0.0, 15);
        close(r, 6.25, 1e-12);
        close(column_flat(e, sy, 1.0, 1000.0, a, r, 0), 160.0, 1e-9);
        close(column_flat(e, sy, 1.0, 1000.0, a, r, 2), 1.0, 0.0);
        close(column_flat(e, sy, 1.0, 1000.0, a, r, 4), PI * PI * e * (PI * 25f64.powi(4) / 64.0) / 1e6, 1e-6);
        rel(column_flat(e, sy, 1.0, 1000.0, a, r, 4), 39_173.0, 1e-4);
        // Short: 300 mm, KL/r = 48 < 108.0 -> Johnson.
        close(column_flat(e, sy, 1.0, 300.0, a, r, 2), 2.0, 0.0);
        close(column_flat(e, sy, 1.0, 300.0, a, r, 3), sy - (sy * 48.0 / (2.0 * PI)).powi(2) / e, 1e-9);
    }

    #[test]
    fn stress_concentration() {
        // Kirsch limit and the [FMO] fit; Inglis circle = 3.
        close(kt_plate_hole(0.0), 3.0, 0.0);
        close(kt_plate_hole(0.5), 3.0 - 1.57 + 0.91675 - 0.190875, 1e-12);
        assert!(kt_plate_hole(1.0).is_nan());
        close(kt_ellipse(1.0, 1.0), 3.0, 0.0);
        close(kt_ellipse(3.0, 1.0), 7.0, 0.0);
        close(notch_kf(2.0, 0.8), 1.8, 1e-12);
    }

    #[test]
    fn fatigue() {
        // [EE]: Se' = 0.504 Sut, caps; surface factors from its own check rows:
        // machined 455 MPa 0.89, as forged 455 MPa 0.63, machined 875 MPa 0.75, as forged 875 MPa 0.33.
        close(endurance_estimate(600.0, 0.0), 302.4, 1e-9);
        close(endurance_estimate(1500.0, 0.0), 700.0, 0.0);
        close(endurance_estimate(220.0, 1.0), 100.0, 0.0);
        close(marin_surface(1.0, 455.0, 0.0), 0.89, 0.005);
        // The [EE] rows match the kpsi constants; the MPa constants give 0.616 and 0.321 for
        // as forged (the two fits differ by about 2 %), hence the wider tolerance.
        close(marin_surface(3.0, 455.0, 0.0), 0.63, 0.015);
        close(marin_surface(1.0, 875.0, 0.0), 0.75, 0.005);
        close(marin_surface(3.0, 875.0, 0.0), 0.33, 0.01);
        close(marin_surface(3.0, 65.0, 1.0), 0.63, 0.005);
        close(marin_surface(1.0, 65.0, 1.0), 0.89, 0.005);
        close(marin_surface(3.0, 125.0, 1.0), 0.33, 0.005);
        close(marin_size_mm(7.62), 1.0, 1e-12);
        assert!(marin_size_mm(60.0).is_nan());
        // [PSU] (after Norton Ex. 6-5): Na = Se/sa = 2.507, Nm = Sut/sm = 7.533, N Goodman = 1.88.
        let (se, sut): (f64, f64) = (21.84, 80.0);
        let (sa, sm) = (se / 2.507, sut / 7.533);
        close(fatigue_factor(0, sa, sm, se, sut, 60.0), 1.88, 0.005);
        // Gerber satisfies n sa/Se + (n sm/Sut)^2 = 1, and is above Goodman; Soderberg below.
        let n = fatigue_factor(2, sa, sm, se, sut, 60.0);
        close(n * sa / se + (n * sm / sut).powi(2), 1.0, 1e-12);
        assert!(n > fatigue_factor(0, sa, sm, se, sut, 60.0));
        assert!(fatigue_factor(1, sa, sm, se, sut, 60.0) < fatigue_factor(0, sa, sm, se, sut, 60.0));
        close(fatigue_factor(3, 10.0, 20.0, se, sut, 60.0), 2.0, 1e-12);
        close(fatigue_factor(0, 10.0, -5.0, se, sut, 60.0), se / 10.0, 1e-12);
        close(stress_alt(100.0, -20.0), 60.0, 0.0); close(stress_mean(100.0, -20.0), 40.0, 0.0);
    }

    #[test]
    fn centrifugal_and_balance() {
        // F = m r omega^2: 1 kg at 0.1 m, 3000 rpm: omega = 314.16 rad/s, F = 9869.6 N.
        close(centrifugal_n(1.0, 0.1, 3000.0), 0.1 * (100.0 * PI).powi(2), 1e-9);
        // Chuck: 3 jaws x 1.2 kg at 0.08 m, 3000 rpm: Fc = 0.288 * 98 696 = 28 424.5 N.
        let fc = 0.288 * (100.0 * PI).powi(2);
        close(chuck_grip_n(60_000.0, 0.288, 3000.0, 0.0), 60_000.0 - fc, 1e-6);
        close(chuck_grip_n(60_000.0, 0.288, 3000.0, 1.0), 60_000.0 + fc, 1e-6);
        close(chuck_speed_for_grip(60_000.0, 60_000.0 - fc, 0.288), 3000.0, 1e-6);
        // [IRD] worked example: 1000 lb rotor, 900 rpm, G 6.3: 6.015 G W / N = 42.1 oz in,
        // 21 oz in per plane; G 2.5: 8.3 oz in per plane. 1 oz in = 28.349523125 * 25.4 g mm.
        let m = 1000.0 * 0.453_592_37;
        let ozin = 28.349_523_125 * 25.4;
        close(iso_uper_gmm(6.3, m, 900.0) / ozin, 42.1, 0.05);
        close(plane_share(iso_uper_gmm(6.3, m, 900.0), 1.0, 1.0) / ozin, 21.0, 0.1);
        close(plane_share(iso_uper_gmm(2.5, m, 900.0), 1.0, 1.0) / ozin, 8.3, 0.06); // printed 8.3 (8.35 before rounding)
        // The printed metric form 9549 G m / n.
        rel(iso_uper_gmm(6.3, 10.0, 3000.0), 9549.0 * 6.3 * 10.0 / 3000.0, 1e-4);
        close(iso_grade_from_u(iso_uper_gmm(2.5, 4.0, 12_000.0), 4.0, 12_000.0), 2.5, 1e-12);
        // G 1 mm/s at omega = 1000 rad/s: e = G / omega = 1 um.
        close(iso_eper_um(1.0, 60_000.0 / (2.0 * PI)), 1.0, 1e-12);
        close(plane_share(100.0, 0.3, 0.7), 70.0, 1e-12);
        // 1 g mm at 10 000 rpm: 1e-6 * 1047.2^2 = 1.0966 N.
        close(unbalance_force_n(1.0, 10_000.0), 1e-6 * (PI * 10_000.0 / 30.0).powi(2), 1e-12);
    }

    #[test]
    fn critical_speeds() {
        let (l, ei): (f64, f64) = (1.0, 2.0e4);
        // Single disc mid-span on a massless shaft: omega = sqrt(48 E I / (m L^3)) (exact).
        let w = (48.0 * ei / (10.0 * l.powi(3))).sqrt() * 30.0 / PI;
        rel(critical_speed(1, l, ei, 0.0, &[(0.5, 10.0)], 0), w, 1e-9);
        rel(critical_speed(1, l, ei, 0.0, &[(0.5, 10.0)], 1), w, 1e-9);
        // Same as sqrt(g / static deflection).
        let d = critical_speed(1, l, ei, 0.0, &[(0.5, 10.0)], 3);
        rel(d, 10.0 * G0 * l.powi(3) / (48.0 * ei), 1e-3);
        // Overhung disc at the end: sqrt(3 E I / (m L^3)).
        rel(critical_speed(0, l, ei, 0.0, &[(1.0, 10.0)], 0), (3.0 * ei / 10.0).sqrt() * 30.0 / PI, 1e-9);
        // Uniform shaft alone: exact pi^2 sqrt(EI / mu L^4); Rayleigh with the static
        // deflection curve gives sqrt(3024/31) = 9.8767 (upper bound) [THOM].
        let mu = 5.0;
        let exact = PI * PI * (ei / mu).sqrt() * 30.0 / PI;
        rel(critical_speed(1, l, ei, mu, &[], 2), exact, 1e-12);
        rel(critical_speed(1, l, ei, mu, &[], 0), (3024.0f64 / 31.0).sqrt() * (ei / mu).sqrt() * 30.0 / PI, 1e-3);
        // Dunkerley is a lower bound, Rayleigh an upper bound.
        let discs = [(0.3, 8.0), (0.7, 4.0)];
        let ray = critical_speed(1, l, ei, mu, &discs, 0);
        let dun = critical_speed(1, l, ei, mu, &discs, 1);
        assert!(dun < ray);
        assert!(dun > 0.85 * ray);
        // Cantilever shaft alone: 1.8751^2 sqrt(EI / mu L^4) = 3.5160.
        rel(critical_speed(0, l, ei, mu, &[], 2) * PI / 30.0, 3.516_015 * (ei / mu).sqrt(), 1e-6);
    }
}
