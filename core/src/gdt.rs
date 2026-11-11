//! GD&T (geometric dimensioning and tolerancing) arithmetic.
//!
//! These are the size-and-position calculations machinists and inspectors do by
//! hand. The rules behind them are set by ASME Y14.5-2018 and ISO 1101 / ISO 2692
//! (cited by name and clause only, never quoted). Each formula was checked
//! against at least two independent free public sources; the keys in square
//! brackets resolve to the source list in `docs/gdt.md`.
//!
//! Conventions used throughout:
//! * Sizes are given as the lower and upper size limits (`lower <= upper`).
//! * `internal` = true for an internal feature of size (hole, slot),
//!   false for an external one (pin, shaft, boss, tab).
//! * Material condition modifier `mc`: 0 = RFS (regardless of feature size,
//!   the default in Y14.5-2018 and the ISO default), 1 = MMC (ISO "M", the
//!   maximum material requirement), 2 = LMC (ISO "L", least material requirement).
//! * All lengths in one unit (inch or mm); the functions are unit-free.

/// Regardless of feature size: no bonus tolerance.
pub const MC_RFS: u32 = 0;
/// Maximum material condition modifier.
pub const MC_MMC: u32 = 1;
/// Least material condition modifier.
pub const MC_LMC: u32 = 2;

/// Size at maximum material condition: the smallest hole or the largest pin.
/// [GDTB][SKL][JLC][UIUC]
pub fn mmc_size(lower: f64, upper: f64, internal: bool) -> f64 {
    if internal { lower } else { upper }
}

/// Size at least material condition: the largest hole or the smallest pin.
/// [GDTB][SKL][JLC][UIUC]
pub fn lmc_size(lower: f64, upper: f64, internal: bool) -> f64 {
    if internal { upper } else { lower }
}

fn size_ok(lower: f64, upper: f64) -> bool {
    lower.is_finite() && upper.is_finite() && lower > 0.0 && upper >= lower
}

/// Bonus tolerance for an actual (mating / measured) size.
///
/// With MMC the bonus is how far the actual size has departed from MMC,
/// with LMC how far it has departed from LMC. RFS gives no bonus.
/// Returns NaN if the size limits are invalid or the actual size is outside
/// them (the feature is then rejected for size; no bonus applies).
/// [GDTB][SKL][JLC][OEP]
pub fn bonus_tolerance(lower: f64, upper: f64, actual: f64, internal: bool, mc: u32) -> f64 {
    if !size_ok(lower, upper) || !(actual >= lower && actual <= upper) { return f64::NAN; }
    match mc {
        MC_RFS => 0.0,
        MC_MMC => (actual - mmc_size(lower, upper, internal)).abs(),
        MC_LMC => (actual - lmc_size(lower, upper, internal)).abs(),
        _ => f64::NAN,
    }
}

/// Total geometric tolerance allowed at an actual size: stated tolerance + bonus.
pub fn total_tolerance(geo_tol: f64, lower: f64, upper: f64, actual: f64, internal: bool, mc: u32) -> f64 {
    if !(geo_tol >= 0.0) { return f64::NAN; }
    geo_tol + bonus_tolerance(lower, upper, actual, internal, mc)
}

/// Virtual condition: the constant boundary made by the stated geometric
/// tolerance and the MMC (or LMC) size together.
///
/// * MMC, internal: MMC - tol.  MMC, external: MMC + tol.
/// * LMC, internal: LMC + tol.  LMC, external: LMC - tol.
///
/// RFS has no virtual condition (NaN). The same arithmetic at RFS gives the
/// "outer/inner boundary" (worst-case boundary), which callers may show
/// separately with that name. [GDTB][SKL][JLC][OEP]
pub fn virtual_condition(lower: f64, upper: f64, geo_tol: f64, internal: bool, mc: u32) -> f64 {
    if !size_ok(lower, upper) || !(geo_tol >= 0.0) { return f64::NAN; }
    match (mc, internal) {
        (MC_MMC, true) => lower - geo_tol,
        (MC_MMC, false) => upper + geo_tol,
        (MC_LMC, true) => upper + geo_tol,
        (MC_LMC, false) => lower - geo_tol,
        _ => f64::NAN,
    }
}

/// Resultant condition: the worst-case boundary on the opposite side from the
/// virtual condition, at the other size limit with the full bonus used.
///
/// * MMC, internal: LMC + tol + size tolerance.  MMC, external: LMC - tol - size tolerance.
/// * LMC, internal: MMC - tol - size tolerance.  LMC, external: MMC + tol + size tolerance.
///
/// MMC case: [OEP], and it follows from the bonus and virtual condition rules.
/// LMC case: BenchMate derivation by the same reasoning, to be verified (docs/gdt.md).
pub fn resultant_condition(lower: f64, upper: f64, geo_tol: f64, internal: bool, mc: u32) -> f64 {
    if !size_ok(lower, upper) || !(geo_tol >= 0.0) { return f64::NAN; }
    let bonus = upper - lower;
    match (mc, internal) {
        (MC_MMC, true) => upper + geo_tol + bonus,
        (MC_MMC, false) => lower - geo_tol - bonus,
        (MC_LMC, true) => lower - geo_tol - bonus,
        (MC_LMC, false) => upper + geo_tol + bonus,
        _ => f64::NAN,
    }
}

/// Diametral true-position deviation from measured coordinate deviations:
/// `2 * sqrt(dx^2 + dy^2)`. Compared directly with a cylindrical (diameter
/// symbol) position tolerance zone. [GDTB][WEV]
pub fn true_position_dia(dx: f64, dy: f64) -> f64 {
    2.0 * dx.hypot(dy)
}

/// Same, from nominal and measured coordinates.
pub fn true_position_dia_from_coords(nx: f64, ny: f64, mx: f64, my: f64) -> f64 {
    true_position_dia(mx - nx, my - ny)
}

/// Same in three dimensions (spherical zone): `2 * sqrt(dx^2 + dy^2 + dz^2)`.
pub fn true_position_dia_3d(dx: f64, dy: f64, dz: f64) -> f64 {
    2.0 * (dx * dx + dy * dy + dz * dz).sqrt()
}

/// Cylindrical position zone diameter that circumscribes a rectangular
/// coordinate (plus/minus) zone of half-widths `tx`, `ty`:
/// `2 * sqrt(tx^2 + ty^2)`. For equal tolerances this is 2.828 x the
/// plus/minus value (1.414 x the total width). Geometry; see [GDTB][WEV].
pub fn position_dia_from_plus_minus(tx: f64, ty: f64) -> f64 {
    2.0 * tx.hypot(ty)
}

/// Equal plus/minus coordinate tolerance of the square inscribed in a
/// cylindrical position zone of diameter `dia`: `dia / (2 * sqrt(2))`.
/// The square is smaller than the circle, so this is the conservative
/// coordinate tolerance (it rejects some good parts). Geometry.
pub fn plus_minus_from_position_dia(dia: f64) -> f64 {
    dia / (2.0 * std::f64::consts::SQRT_2)
}

/// Floating fastener (fastener passes through clearance holes in both
/// parts, e.g. bolt and nut): position tolerance at MMC for each part,
/// `T = H - F` with H the hole MMC size and F the fastener MMC size.
/// ASME Y14.5 nonmandatory appendix (fastener formulas), cited only; [OEP][SKL][GDTB]
pub fn floating_fastener_tol(hole_mmc: f64, fastener_mmc: f64) -> f64 {
    hole_mmc - fastener_mmc
}

/// Fixed fastener (fastener is held in one part, e.g. a tapped hole or
/// press-fit pin): total of both position tolerances at MMC, `t1 + t2 = H - F`.
/// Equal split: `T = (H - F) / 2`. Does not allow for perpendicularity error
/// of the fixed fastener; a projected tolerance zone covers that.
/// ASME Y14.5 nonmandatory appendix (fastener formulas), cited only; [OEP][SKL][GDTB]
pub fn fixed_fastener_tol(hole_mmc: f64, fastener_mmc: f64) -> f64 {
    (hole_mmc - fastener_mmc) / 2.0
}

/// Fixed fastener: tolerance left for the clearance-hole part when the
/// fastener part already has `t_fixed`: `t2 = H - F - t1`.
pub fn fixed_fastener_tol_other(hole_mmc: f64, fastener_mmc: f64, t_fixed: f64) -> f64 {
    hole_mmc - fastener_mmc - t_fixed
}

/// Floating fastener: clearance hole MMC size needed, `H = F + T`.
pub fn floating_fastener_hole(fastener_mmc: f64, tol: f64) -> f64 { fastener_mmc + tol }

/// Fixed fastener: clearance hole MMC size needed, `H = F + t1 + t2`.
pub fn fixed_fastener_hole(fastener_mmc: f64, t1: f64, t2: f64) -> f64 { fastener_mmc + t1 + t2 }

/// One dimension in a one-dimensional tolerance stack.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StackDim {
    /// Nominal (basic) value, positive.
    pub nominal: f64,
    /// Upper deviation (+), entered as a positive number.
    pub plus: f64,
    /// Lower deviation (-), entered as a positive number.
    pub minus: f64,
    /// +1 if the dimension adds to the gap, -1 if it subtracts.
    pub dir: f64,
}

/// Result of a one-dimensional stack.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StackResult {
    /// Gap at nominal values.
    pub nominal: f64,
    /// Gap at the mean (mid-limit) of every dimension.
    pub mean: f64,
    /// Worst-case (arithmetic) half range: sum of the half tolerances.
    pub wc: f64,
    /// Root-sum-square half range: sqrt of the sum of squared half tolerances.
    pub rss: f64,
    pub wc_min: f64,
    pub wc_max: f64,
    pub rss_min: f64,
    pub rss_max: f64,
}

/// One-dimensional tolerance stack, worst case and RSS.
///
/// Each dimension is centred on its mean (nominal + (plus - minus) / 2) with a
/// symmetric half tolerance (plus + minus) / 2. Worst case adds the half
/// tolerances; RSS takes the square root of the sum of their squares, which
/// assumes independent, centred, normally distributed dimensions at the same
/// process capability (each half tolerance taken as 3 sigma). [ACC][FF]
pub fn tolerance_stack(dims: &[StackDim]) -> StackResult {
    let mut nominal = 0.0;
    let mut mean = 0.0;
    let mut wc = 0.0;
    let mut sq = 0.0;
    for d in dims {
        let s = if d.dir < 0.0 { -1.0 } else { 1.0 };
        let half = (d.plus + d.minus) / 2.0;
        nominal += s * d.nominal;
        mean += s * (d.nominal + (d.plus - d.minus) / 2.0);
        wc += half.abs();
        sq += half * half;
    }
    let rss = sq.sqrt();
    StackResult { nominal, mean, wc, rss, wc_min: mean - wc, wc_max: mean + wc, rss_min: mean - rss, rss_max: mean + rss }
}

/// Worst-case sum of symmetric (plus/minus) tolerances.
pub fn stack_worst_case(tols: &[f64]) -> f64 { tols.iter().map(|t| t.abs()).sum() }

/// Root-sum-square of symmetric (plus/minus) tolerances.
pub fn stack_rss(tols: &[f64]) -> f64 { tols.iter().map(|t| t * t).sum::<f64>().sqrt() }

/// Result of a composite position (feature-relating) check for a hole pattern.
#[derive(Clone, Debug, PartialEq)]
pub struct CompositeResult {
    /// Smallest feature-relating zone diameter (FRTZF, lower segment) that the
    /// pattern can meet after the best allowed shift (and rotation), net of
    /// each hole's bonus: max over holes of (2 |residual| - bonus).
    pub frtzf_needed: f64,
    /// Best-fit shift of the pattern of zones (same units as the deviations).
    pub shift_x: f64,
    pub shift_y: f64,
    /// Best-fit rotation of the pattern of zones about the origin of the
    /// nominal coordinates (radians, small-angle model). Zero if not allowed.
    pub rot: f64,
    /// Diametral residual of each hole to its shifted zone centre.
    pub residual_dia: Vec<f64>,
}

/// Composite position, lower segment (FRTZF): can the pattern of
/// feature-relating zones be moved, as one rigid group, so that every hole
/// axis lies inside its own zone? The lower segment fixes orientation only
/// (to the datums it references), not location, so the group may translate
/// in the plane; if it references no secondary datum it may also rotate
/// about the datum axis. [FARO][DCS]
///
/// `nominal`: basic (true) positions of the holes, used for the rotation
/// lever arms. `dev`: measured deviation of each hole from its true position
/// (dX, dY) in the datum reference frame. `bonus`: per-hole bonus (0 at RFS).
/// The upper segment (PLTZF) is checked separately per hole with
/// `true_position_dia` against its own tolerance, without any shift.
///
/// Method: minimise the convex function
/// `g(tx, ty, a) = max_i (2 |dev_i - t - a k x p_i| - bonus_i)` by a
/// nested golden-section search: g is jointly convex, so the partial
/// minima are convex and unimodal and the search finds the global minimum.
pub fn composite_frtzf(nominal: &[(f64, f64)], dev: &[(f64, f64)], bonus: &[f64], allow_rotation: bool) -> CompositeResult {
    let n = nominal.len().min(dev.len());
    if n == 0 {
        return CompositeResult { frtzf_needed: f64::NAN, shift_x: 0.0, shift_y: 0.0, rot: 0.0, residual_dia: vec![] };
    }
    let b = |i: usize| bonus.get(i).copied().filter(|x| x.is_finite() && *x > 0.0).unwrap_or(0.0);
    // Rotate about the centroid of the nominal positions (better conditioned),
    // then express the result about the origin.
    let (cx, cy) = (nominal[..n].iter().map(|p| p.0).sum::<f64>() / n as f64, nominal[..n].iter().map(|p| p.1).sum::<f64>() / n as f64);
    let arm = nominal[..n].iter().map(|p| (p.0 - cx).hypot(p.1 - cy)).fold(0.0, f64::max).max(1e-12);
    let resid = |x: &[f64; 3], i: usize| -> (f64, f64) {
        let a = if allow_rotation { x[2] / arm } else { 0.0 };
        let (px, py) = (nominal[i].0 - cx, nominal[i].1 - cy);
        // small rotation a about the centroid moves a zone centre by (-a py, a px)
        (dev[i].0 - x[0] + a * py, dev[i].1 - x[1] - a * px)
    };
    let g = |x: &[f64; 3]| (0..n).map(|i| { let (ex, ey) = resid(x, i); 2.0 * ex.hypot(ey) - b(i) }).fold(f64::NEG_INFINITY, f64::max);
    // g is jointly convex in (tx, ty, a), so min over ty is convex in (tx, a)
    // and min over (tx, ty) is convex in a: nested golden-section searches
    // find the global minimum.
    let scale = dev[..n].iter().map(|d| d.0.hypot(d.1)).fold(0.0, f64::max).max(1e-9);
    let bmax = (0..n).map(b).fold(0.0, f64::max);
    let span = 2.0 * scale + bmax + 1e-9;
    fn golden<F: FnMut(f64) -> f64>(mut lo: f64, mut hi: f64, iters: usize, mut f: F) -> (f64, f64) {
        let r = (5f64.sqrt() - 1.0) / 2.0;
        let mut x1 = hi - r * (hi - lo); let mut x2 = lo + r * (hi - lo);
        let mut f1 = f(x1); let mut f2 = f(x2);
        for _ in 0..iters {
            if f1 <= f2 { hi = x2; x2 = x1; f2 = f1; x1 = hi - r * (hi - lo); f1 = f(x1); }
            else { lo = x1; x1 = x2; f1 = f2; x2 = lo + r * (hi - lo); f2 = f(x2); }
        }
        if f1 <= f2 { (x1, f1) } else { (x2, f2) }
    }
    let it = 90;
    let best_t = |a: f64| -> ([f64; 3], f64) {
        let (tx, _) = golden(-span, span, it, |tx| golden(-span, span, it, |ty| g(&[tx, ty, a])).1);
        let (ty, f) = golden(-span, span, it, |ty| g(&[tx, ty, a]));
        ([tx, ty, a], f)
    };
    let (x, fx) = if allow_rotation {
        // a here is the tip displacement at the largest arm; bounded like t.
        let (a, _) = golden(-4.0 * span, 4.0 * span, it, |a| best_t(a).1);
        best_t(a)
    } else { best_t(0.0) };
    let a = if allow_rotation { x[2] / arm } else { 0.0 };
    let residual_dia = (0..n).map(|i| { let (ex, ey) = resid(&x, i); 2.0 * ex.hypot(ey) }).collect();
    // Shift about the origin: rotation about the centroid = rotation about the origin + extra shift.
    CompositeResult { frtzf_needed: fx, shift_x: x[0] + a * cy, shift_y: x[1] - a * cx, rot: a, residual_dia }
}

/// Unequally disposed profile (U modifier): limits of the zone measured
/// from the true profile, as (towards the outside of the material, into the
/// material) = (u, total - u). `u` is the part of the total zone that lies
/// outside the material (the material-adding side). [GDTB][OEP]
pub fn profile_unequal_limits(total: f64, u: f64) -> (f64, f64) {
    if !(total > 0.0) || !(u >= 0.0) || u > total { return (f64::NAN, f64::NAN); }
    (u, total - u)
}

/// Equal-bilateral zone of the same width with its centre offset from the
/// true profile, for CMM software that wants "+/- t/2 about an offset
/// profile": offset = u - total / 2 (positive = outside the material).
pub fn profile_unequal_offset(total: f64, u: f64) -> f64 {
    let (o, i) = profile_unequal_limits(total, u);
    (o - i) / 2.0
}

/// Check one measured profile deviation `e` (positive = outside the
/// material, negative = into the material): returns the margin left
/// (>= 0 passes, < 0 fails by that much).
pub fn profile_unequal_margin(total: f64, u: f64, e: f64) -> f64 {
    let (o, i) = profile_unequal_limits(total, u);
    (o - e).min(e + i)
}
// ---- f64 wrappers for the WebAssembly layer ----

/// Composite position lower segment from up to 8 holes passed flat as
/// (nominal x, nominal y, measured x, measured y, bonus); a hole whose
/// measured x or y is not finite is skipped. Deviations = measured - nominal. `rotate` > 0.5 allows rotation of the pattern. `out`: 0 FRTZF
/// needed, 1 shift x, 2 shift y, 3 rotation (rad), 4 holes used,
/// 10 + i diametral residual of the i-th used hole.
pub fn composite_frtzf_flat(v: &[f64], rotate: f64, out: u32) -> f64 {
    let mut nom = Vec::new(); let mut dev = Vec::new(); let mut bon = Vec::new();
    for c in v.chunks(5) {
        if c.len() < 5 || !(c[2].is_finite() && c[3].is_finite()) { continue; }
        let z = |x: f64| if x.is_finite() { x } else { 0.0 };
        nom.push((z(c[0]), z(c[1]))); dev.push((c[2] - z(c[0]), c[3] - z(c[1]))); bon.push(z(c[4]));
    }
    let r = composite_frtzf(&nom, &dev, &bon, rotate > 0.5);
    match out {
        0 => r.frtzf_needed, 1 => r.shift_x, 2 => r.shift_y, 3 => r.rot, 4 => nom.len() as f64,
        k @ 10..=17 => r.residual_dia.get((k - 10) as usize).copied().unwrap_or(f64::NAN),
        _ => f64::NAN,
    }
}
pub fn profile_unequal_outside(total: f64, u: f64) -> f64 { profile_unequal_limits(total, u).0 }
pub fn profile_unequal_inside(total: f64, u: f64) -> f64 { profile_unequal_limits(total, u).1 }

/// `internal` > 0.5 means internal; `mc` 0 RFS, 1 MMC, 2 LMC.
pub fn bonus_tolerance_f(lower: f64, upper: f64, actual: f64, internal: f64, mc: f64) -> f64 {
    bonus_tolerance(lower, upper, actual, internal > 0.5, mc as u32)
}
pub fn total_tolerance_f(geo: f64, lower: f64, upper: f64, actual: f64, internal: f64, mc: f64) -> f64 {
    total_tolerance(geo, lower, upper, actual, internal > 0.5, mc as u32)
}
pub fn virtual_condition_f(lower: f64, upper: f64, geo: f64, internal: f64, mc: f64) -> f64 {
    virtual_condition(lower, upper, geo, internal > 0.5, mc as u32)
}
pub fn resultant_condition_f(lower: f64, upper: f64, geo: f64, internal: f64, mc: f64) -> f64 {
    resultant_condition(lower, upper, geo, internal > 0.5, mc as u32)
}
pub fn mmc_size_f(lower: f64, upper: f64, internal: f64) -> f64 { mmc_size(lower, upper, internal > 0.5) }
pub fn lmc_size_f(lower: f64, upper: f64, internal: f64) -> f64 { lmc_size(lower, upper, internal > 0.5) }

/// Stack evaluated from up to 10 dimensions passed flat as
/// (nominal, plus, minus, dir) groups; groups with nominal and both
/// tolerances zero or NaN are skipped. `out`: 0 nominal, 1 mean, 2 wc, 3 rss,
/// 4 wc_min, 5 wc_max, 6 rss_min, 7 rss_max, 8 count of dimensions used.
pub fn tolerance_stack_flat(v: &[f64], out: u32) -> f64 {
    let z = |x: f64| if x.is_finite() { x } else { 0.0 };
    let dims: Vec<StackDim> = v.chunks(4).filter_map(|c| {
        if c.len() < 4 { return None; }
        let d = StackDim { nominal: z(c[0]), plus: z(c[1]), minus: z(c[2]), dir: z(c[3]) };
        if d.nominal == 0.0 && d.plus == 0.0 && d.minus == 0.0 { None } else { Some(d) }
    }).collect();
    let r = tolerance_stack(&dims);
    match out {
        0 => r.nominal, 1 => r.mean, 2 => r.wc, 3 => r.rss,
        4 => r.wc_min, 5 => r.wc_max, 6 => r.rss_min, 7 => r.rss_max,
        8 => dims.len() as f64,
        _ => f64::NAN,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    // Hand-worked examples (each checked with python3), independent of any book:
    // Hole 0.500-0.510, position dia 0.010 at MMC.
    //   MMC 0.500, LMC 0.510. At 0.506 the bonus is 0.006, total 0.016.
    //   VC = 0.500 - 0.010 = 0.490. RC = 0.510 + 0.010 + 0.010 = 0.530.
    #[test] fn hole_mmc() {
        close(mmc_size(0.5, 0.51, true), 0.5, 0.0);
        close(lmc_size(0.5, 0.51, true), 0.51, 0.0);
        close(bonus_tolerance(0.5, 0.51, 0.506, true, MC_MMC), 0.006, 1e-12);
        close(total_tolerance(0.010, 0.5, 0.51, 0.506, true, MC_MMC), 0.016, 1e-12);
        close(virtual_condition(0.5, 0.51, 0.010, true, MC_MMC), 0.490, 1e-12);
        close(resultant_condition(0.5, 0.51, 0.010, true, MC_MMC), 0.530, 1e-12);
    }
    // Pin 9.8-10.0 mm, perpendicularity dia 0.1 at MMC.
    //   MMC 10.0. At 9.9 bonus 0.1, total 0.2. VC 10.1. RC 9.8 - 0.1 - 0.2 = 9.5.
    #[test] fn pin_mmc() {
        close(bonus_tolerance(9.8, 10.0, 9.9, false, MC_MMC), 0.1, 1e-12);
        close(total_tolerance(0.1, 9.8, 10.0, 9.85, false, MC_MMC), 0.25, 1e-12);
        close(virtual_condition(9.8, 10.0, 0.1, false, MC_MMC), 10.1, 1e-12);
        close(resultant_condition(9.8, 10.0, 0.1, false, MC_MMC), 9.5, 1e-12);
    }
    // LMC: hole 20.0-20.2, position dia 0.2 at LMC (wall thickness case).
    //   LMC 20.2; at 20.05 bonus 0.15. VC = 20.2 + 0.2 = 20.4; RC = 20.0 - 0.2 - 0.2 = 19.6.
    //   Boss 30.0-29.8 at LMC dia 0.2: LMC 29.8; at 29.95 bonus 0.15; VC 29.6; RC 30.4.
    #[test] fn lmc() {
        close(bonus_tolerance(20.0, 20.2, 20.05, true, MC_LMC), 0.15, 1e-12);
        close(virtual_condition(20.0, 20.2, 0.2, true, MC_LMC), 20.4, 1e-12);
        close(resultant_condition(20.0, 20.2, 0.2, true, MC_LMC), 19.6, 1e-12);
        close(bonus_tolerance(29.8, 30.0, 29.95, false, MC_LMC), 0.15, 1e-12);
        close(virtual_condition(29.8, 30.0, 0.2, false, MC_LMC), 29.6, 1e-12);
        close(resultant_condition(29.8, 30.0, 0.2, false, MC_LMC), 30.4, 1e-12);
    }
    #[test] fn rfs_and_out_of_size() {
        close(bonus_tolerance(0.5, 0.51, 0.506, true, MC_RFS), 0.0, 0.0);
        assert!(virtual_condition(0.5, 0.51, 0.01, true, MC_RFS).is_nan());
        assert!(bonus_tolerance(0.5, 0.51, 0.512, true, MC_MMC).is_nan()); // oversize hole
        assert!(bonus_tolerance(0.51, 0.5, 0.505, true, MC_MMC).is_nan()); // limits reversed
        assert!(total_tolerance(-0.1, 0.5, 0.51, 0.505, true, MC_MMC).is_nan());
    }
    // True position: dX 0.003, dY 0.004 -> 2 x 0.005 = 0.010 (3-4-5 triangle).
    // dX 0.02, dY -0.03 mm -> 2 sqrt(0.0013) = 0.0721110 (python3).
    #[test] fn true_position() {
        close(true_position_dia(0.003, 0.004), 0.010, 1e-15);
        close(true_position_dia(0.02, -0.03), 0.0721110, 1e-7);
        close(true_position_dia_3d(0.002, 0.003, 0.006), 0.014, 1e-15); // 2-3-6-7
    }
    // +/-0.005 square zone -> dia 2 sqrt(2) 0.005 = 0.0141421; dia 0.014 -> +/-0.0049497.
    // Rectangle +/-0.003 x +/-0.004 -> dia 0.010.
    #[test] fn conversion() {
        close(position_dia_from_plus_minus(0.005, 0.005), 0.0141421, 1e-7);
        close(position_dia_from_plus_minus(0.003, 0.004), 0.010, 1e-15);
        close(plus_minus_from_position_dia(0.014), 0.0049497, 1e-7);
        close(plus_minus_from_position_dia(position_dia_from_plus_minus(0.1, 0.1)), 0.1, 1e-15);
    }
    // M8 bolt (F = 8.0) in 9.0 clearance holes: floating T = 1.0 each part.
    // Fixed (tapped hole in one part): (9 - 8) / 2 = 0.5 each, or 0.3 + 0.7.
    #[test] fn fasteners() {
        close(floating_fastener_tol(9.0, 8.0), 1.0, 1e-12);
        close(fixed_fastener_tol(9.0, 8.0), 0.5, 1e-12);
        close(fixed_fastener_tol_other(9.0, 8.0, 0.3), 0.7, 1e-12);
        close(floating_fastener_hole(0.25, 0.014), 0.264, 1e-12);
        close(fixed_fastener_hole(0.25, 0.007, 0.010), 0.267, 1e-12);
    }
    // Stack: housing 50 +/-0.1 (+), shaft part 30 +0.05/-0.15 (-), spacer 19.5 +/-0.05 (-).
    //   nominal gap 0.5; means 50, 29.95, 19.5 -> mean gap 0.55.
    //   half tols 0.1, 0.1, 0.05: WC 0.25; RSS sqrt(0.0225) = 0.15.
    #[test] fn stack() {
        let d = [
            StackDim { nominal: 50.0, plus: 0.1, minus: 0.1, dir: 1.0 },
            StackDim { nominal: 30.0, plus: 0.05, minus: 0.15, dir: -1.0 },
            StackDim { nominal: 19.5, plus: 0.05, minus: 0.05, dir: -1.0 },
        ];
        let r = tolerance_stack(&d);
        close(r.nominal, 0.5, 1e-12);
        close(r.mean, 0.55, 1e-12);
        close(r.wc, 0.25, 1e-12);
        close(r.rss, 0.15, 1e-12);
        close(r.wc_min, 0.30, 1e-12);
        close(r.rss_max, 0.70, 1e-12);
        close(stack_worst_case(&[0.1, 0.1, 0.05]), 0.25, 1e-12);
        close(stack_rss(&[0.1, 0.1, 0.05]), 0.15, 1e-12);
        let flat = [50.0, 0.1, 0.1, 1.0, 30.0, 0.05, 0.15, -1.0, 19.5, 0.05, 0.05, -1.0, f64::NAN, f64::NAN, f64::NAN, 1.0];
        close(tolerance_stack_flat(&flat, 3), 0.15, 1e-12);
        close(tolerance_stack_flat(&flat, 8), 3.0, 0.0);
    }

    // Composite position, lower segment (own worked examples; brute force cross-check).
    #[test] fn composite_translation() {
        let nom = [(0.0, 0.0), (50.0, 0.0)];
        // opposite deviations: best shift 0, each residual 0.02 radius -> 0.04 dia
        let r = composite_frtzf(&nom, &[(0.02, 0.0), (-0.02, 0.0)], &[0.0, 0.0], false);
        close(r.frtzf_needed, 0.04, 1e-9); close(r.shift_x, 0.0, 1e-9);
        // same deviation on every hole: the pattern shifts, nothing left
        let r = composite_frtzf(&nom, &[(0.1, 0.05), (0.1, 0.05)], &[0.0, 0.0], false);
        close(r.frtzf_needed, 0.0, 1e-9); close(r.shift_x, 0.1, 1e-9); close(r.shift_y, 0.05, 1e-9);
        // bonus 0.01 on each hole lowers the need by 0.01
        let r = composite_frtzf(&nom, &[(0.02, 0.0), (-0.02, 0.0)], &[0.01, 0.01], false);
        close(r.frtzf_needed, 0.03, 1e-9);
    }
    // Rotation: holes at x = -50 and +50 moved -0.03 and +0.03 in y.
    // With rotation a = 0.03 / 50 = 0.0006 rad everything fits (need 0);
    // without rotation the best is no shift and 0.06.
    #[test] fn composite_rotation() {
        let nom = [(-50.0, 0.0), (50.0, 0.0)];
        let dev = [(0.0, -0.03), (0.0, 0.03)];
        let r = composite_frtzf(&nom, &dev, &[], true);
        close(r.frtzf_needed, 0.0, 1e-8); close(r.rot, 0.0006, 1e-9);
        let r = composite_frtzf(&nom, &dev, &[], false);
        close(r.frtzf_needed, 0.06, 1e-9);
        // Rotation about the origin when the pattern is off-centre: nominal (100,0),(200,0).
        let r = composite_frtzf(&[(100.0, 0.0), (200.0, 0.0)], &[(0.0, 0.06), (0.0, 0.12)], &[], true);
        close(r.frtzf_needed, 0.0, 1e-8); close(r.rot, 0.0006, 1e-9); close(r.shift_y, 0.0, 1e-8);
    }
    // Three holes, general deviations: compare with a fine brute-force grid search.
    #[test] fn composite_brute_force() {
        let nom = [(0.0, 0.0), (40.0, 0.0), (0.0, 30.0)];
        let dev = [(0.01, 0.02), (-0.01, 0.0), (0.03, -0.01)];
        let r = composite_frtzf(&nom, &dev, &[0.0; 3], false);
        let mut best = f64::INFINITY;
        for i in -400..=400 { for j in -400..=400 {
            let (tx, ty) = (i as f64 * 1e-4, j as f64 * 1e-4);
            let g = dev.iter().map(|d| 2.0 * (d.0 - tx).hypot(d.1 - ty)).fold(0.0, f64::max);
            if g < best { best = g; }
        } }
        assert!(r.frtzf_needed <= best + 1e-12, "{} vs {}", r.frtzf_needed, best);
        assert!(r.frtzf_needed >= best - 3e-4);
        // with rotation it can only get better
        let rr = composite_frtzf(&nom, &dev, &[0.0; 3], true);
        assert!(rr.frtzf_needed <= r.frtzf_needed + 1e-12);
        // flat wrapper
        let flat = [0.0, 0.0, 0.01, 0.02, 0.0, 40.0, 0.0, 39.99, 0.0, 0.0, 0.0, 30.0, 0.03, 29.99, 0.0, 9.0, 9.0, f64::NAN, f64::NAN, 0.0];
        close(composite_frtzf_flat(&flat, 0.0, 0), r.frtzf_needed, 1e-12);
        close(composite_frtzf_flat(&flat, 0.0, 4), 3.0, 0.0);
    }
    // Unequal profile: total 0.6, U 0.2 -> 0.2 outside, 0.4 inside; offset -0.1.
    #[test] fn profile_unequal() {
        let (o, i) = profile_unequal_limits(0.6, 0.2);
        close(o, 0.2, 1e-12); close(i, 0.4, 1e-12);
        close(profile_unequal_offset(0.6, 0.2), -0.1, 1e-12);
        close(profile_unequal_offset(0.6, 0.6), 0.3, 1e-12); // all outside
        close(profile_unequal_margin(0.6, 0.2, 0.15), 0.05, 1e-12);
        close(profile_unequal_margin(0.6, 0.2, -0.45), -0.05, 1e-12);
        assert!(profile_unequal_limits(0.6, 0.7).0.is_nan());
    }

    // Random patterns (fixed LCG seed): the optimiser must not be worse than a
    // two-stage grid search, with and without rotation.
    #[test] fn composite_random_vs_grid() {
        let mut seed: u64 = 12345;
        let mut rnd = || { seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); ((seed >> 11) as f64 / (1u64 << 53) as f64) * 2.0 - 1.0 };
        for _case in 0..12 {
            let n = 3 + (rnd().abs() * 4.0) as usize;
            let nom: Vec<(f64, f64)> = (0..n).map(|_| (rnd() * 60.0, rnd() * 40.0)).collect();
            let dev: Vec<(f64, f64)> = (0..n).map(|_| (rnd() * 0.04, rnd() * 0.04)).collect();
            for &rot in &[false, true] {
                let r = composite_frtzf(&nom, &dev, &[], rot);
                let (cx, cy) = (nom.iter().map(|p| p.0).sum::<f64>() / n as f64, nom.iter().map(|p| p.1).sum::<f64>() / n as f64);
                let g = |tx: f64, ty: f64, a: f64| dev.iter().zip(&nom).map(|(d, p)| 2.0 * (d.0 - tx + a * (p.1 - cy)).hypot(d.1 - ty - a * (p.0 - cx))).fold(0.0, f64::max);
                let mut best = (f64::INFINITY, 0.0, 0.0, 0.0);
                let arange: Vec<f64> = if rot { (-20..=20).map(|k| k as f64 * 5e-5).collect() } else { vec![0.0] };
                for &a in &arange { for i in -40..=40 { for j in -40..=40 {
                    let v = g(i as f64 * 1e-3, j as f64 * 1e-3, a); if v < best.0 { best = (v, i as f64 * 1e-3, j as f64 * 1e-3, a); }
                } } }
                // local refine
                let (_, bx, by, ba) = best;
                let arange2: Vec<f64> = if rot { (-10..=10).map(|k| ba + k as f64 * 5e-6).collect() } else { vec![0.0] };
                for &a in &arange2 { for i in -25..=25 { for j in -25..=25 {
                    let v = g(bx + i as f64 * 4e-5, by + j as f64 * 4e-5, a); if v < best.0 { best = (v, 0.0, 0.0, 0.0); }
                } } }
                assert!(r.frtzf_needed <= best.0 + 1e-9, "rot {rot}: {} vs grid {}", r.frtzf_needed, best.0);
                // reported residuals are consistent with the reported need
                close(r.residual_dia.iter().cloned().fold(0.0, f64::max), r.frtzf_needed, 1e-12);
            }
        }
    }
    #[test] fn wrappers() {
        close(bonus_tolerance_f(0.5, 0.51, 0.506, 1.0, 1.0), 0.006, 1e-12);
        close(virtual_condition_f(9.8, 10.0, 0.1, 0.0, 1.0), 10.1, 1e-12);
        close(resultant_condition_f(0.5, 0.51, 0.01, 1.0, 1.0), 0.53, 1e-12);
    }
}
