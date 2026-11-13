//! Fasteners and machine elements: bolt stress area, tightening torque and
//! preload (VDI 2230 relations), O-ring gland squeeze / fill / stretch, rolling
//! bearing basic rating life, keyway check dimensions.
//!
//! Only formulas live here. Table data (property classes, screw dimensions,
//! clearance holes, keys, T-slots, O-ring sizes) is reference data in
//! `data/refdata/fasteners-evidence.json` with its publishers.
//!
//! Sources (formulas are not copyrightable; standards cited by name and clause):
//! * VDI 2230 Part 1:2015, "Systematic calculation of highly stressed bolted
//!   joints", tightening torque (R13) and permitted assembly preload (R7).
//!   Free sources for the same relations: FVA-Workbench documentation
//!   "Bolt connection" (doc.fva-service.de, eq. 230 and 259); W. S. Hameedi,
//!   I. Völgyi, Budapest University of Technology and Economics, ÉPKO 2025,
//!   eq. (3) (attributed to Motosh and VDI 2230).
//! * ISO 898-1:2013 clause 9.1.6.1 (stress area As = pi/4 ((d2 + d3)/2)^2) and
//!   ASME B1.1 (As = 0.7854 (D - 0.9743/n)^2).
//! * ISO 281:2007 clause 6 (basic rating life L10 = (C/P)^p).
//! * O-ring gland ratios: definitions as used by Parker ORD 5700, Global O-Ring
//!   and Seal and Apple Rubber design guides (squeeze, gland fill, stretch).
//!   See docs/sources.md.

use std::f64::consts::PI;

// ---------------------------------------------------------------------------
// Threads: stress area
// ---------------------------------------------------------------------------

/// Stress diameter of an ISO metric thread, `(d2 + d3) / 2 = d - 0.938194 P`
/// (d2 = d - 0.649519 P, d3 = d - 1.226869 P; ISO 898-1 clause 9.1.6.1).
pub fn stress_dia_iso(d: f64, p: f64) -> f64 {
    let d2 = d - 0.75 * 0.866_025_403_784_438_6 * p;
    let d3 = d - (1.25 + 1.0 / 6.0) * 0.866_025_403_784_438_6 * p;
    (d2 + d3) / 2.0
}

/// Tensile stress area of an ISO metric thread, `As = pi/4 ((d2 + d3)/2)^2`.
/// M10 x 1.5: 58.0 mm2.
/// Not a number when the pitch is so coarse that no stress diameter is left.
pub fn stress_area_iso(d: f64, p: f64) -> f64 {
    let ds = stress_dia_iso(d, p);
    if ds > 0.0 { PI / 4.0 * ds.powi(2) } else { f64::NAN }
}

/// Stress diameter of a Unified inch thread, `D - 0.9743 / n` = `D - 0.9743 P`
/// (ASME B1.1 appendix formula; any length unit).
pub fn stress_dia_unified(d: f64, p: f64) -> f64 {
    d - 0.9743 * p
}

/// Tensile stress area of a Unified inch thread, `As = 0.7854 (D - 0.9743 P)^2`.
/// Not a number when the pitch is so coarse that no stress diameter is left.
pub fn stress_area_unified(d: f64, p: f64) -> f64 {
    let ds = stress_dia_unified(d, p);
    if ds > 0.0 { PI / 4.0 * ds.powi(2) } else { f64::NAN }
}

/// f64 interface: `system` 0 = ISO metric, 1 = Unified.
pub fn stress_area_f(d: f64, p: f64, system: f64) -> f64 {
    if system as i32 == 1 { stress_area_unified(d, p) } else { stress_area_iso(d, p) }
}

/// f64 interface: stress diameter, `system` 0 = ISO metric, 1 = Unified.
pub fn stress_dia_f(d: f64, p: f64, system: f64) -> f64 {
    if system as i32 == 1 { stress_dia_unified(d, p) } else { stress_dia_iso(d, p) }
}

// ---------------------------------------------------------------------------
// Breaking force and thread engagement
// ---------------------------------------------------------------------------

/// Ultimate tensile (breaking) force of a screw, `F = Rm x As`: tensile
/// strength times tensile stress area (Fastenal Technical Reference Guide,
/// "P = St x As"; the minimum ultimate tensile loads of ISO 898-1 are built
/// the same way). Units follow the inputs: mm2 x MPa = N, in2 x psi = lbf.
pub fn tensile_load(stress_area: f64, tensile_strength: f64) -> f64 {
    stress_area * tensile_strength
}

/// Simplified shear area of a 60 degree thread per unit of engaged length,
/// `0.5 pi d2` with the basic pitch diameter `d2 = d - 0.649519 P`
/// (Roymech, "Screw thread calculations": Ass = 0.5 pi dp Le).
pub fn thread_shear_area_per_length(d: f64, p: f64) -> f64 {
    0.5 * PI * crate::thread_pitch_dia_basic(d, p)
}

/// Simplified least length of engagement for which the screw breaks before
/// the thread strips, screw and tapped part of like strength: the shear area
/// is made twice the tensile stress area, `Le = 2 As / (0.5 pi d2)` (Roymech).
/// `system` 0 = ISO metric, 1 = Unified. M10 x 1.5: 8.18 mm.
pub fn engagement_min_simple(d: f64, p: f64, system: f64) -> f64 {
    2.0 * stress_area_f(d, p, system) / thread_shear_area_per_length(d, p)
}

/// A rule-of-thumb engagement given in screw diameters: `k x d`.
pub fn engagement_by_diameters(d: f64, k: f64) -> f64 {
    d * k
}

// ---------------------------------------------------------------------------
// Tightening torque and preload (VDI 2230-1:2015)
// ---------------------------------------------------------------------------

/// Mean friction diameter under the head or nut, `DKm = (dw + dh) / 2`, with
/// `dw` the outside diameter of the bearing face and `dh` the clearance hole.
pub fn bearing_mean_dia(dw: f64, dh: f64) -> f64 {
    (dw + dh) / 2.0
}

/// Tightening torque `MA = F (0.16 P + 0.58 d2 muG + DKm/2 muK)`
/// (VDI 2230-1:2015, R13). Any consistent units: N and mm give N mm,
/// lbf and in give lbf in. 0.16 P ~ P / (2 pi) is the torque that stretches
/// the bolt, 0.58 d2 muG ~ d2 muG / (2 cos 30 deg) the thread friction (60 deg
/// thread), DKm/2 muK the friction under the head or nut.
pub fn tightening_torque(f: f64, p: f64, d2: f64, mu_g: f64, dkm: f64, mu_k: f64) -> f64 {
    f * (0.16 * p + 0.58 * d2 * mu_g + dkm / 2.0 * mu_k)
}

/// One part of [`tightening_torque`]: `part` 0 = pitch (stretching the bolt),
/// 1 = thread friction, 2 = head / nut friction.
pub fn tightening_torque_part(f: f64, p: f64, d2: f64, mu_g: f64, dkm: f64, mu_k: f64, part: f64) -> f64 {
    match part as i32 {
        0 => f * 0.16 * p,
        1 => f * 0.58 * d2 * mu_g,
        2 => f * dkm / 2.0 * mu_k,
        _ => f64::NAN,
    }
}

/// Preload from a torque (inverse of [`tightening_torque`]).
pub fn preload_from_torque(t: f64, p: f64, d2: f64, mu_g: f64, dkm: f64, mu_k: f64) -> f64 {
    t / (0.16 * p + 0.58 * d2 * mu_g + dkm / 2.0 * mu_k)
}

/// Thread torque taken by the bolt shank while tightening,
/// `MG = F d2/2 (P/(pi d2) + 1.155 muG)` (VDI 2230-1, R8; 1.155 = 1/cos 30 deg).
pub fn thread_torque(f: f64, p: f64, d2: f64, mu_g: f64) -> f64 {
    f * d2 / 2.0 * (p / (PI * d2) + 1.155 * mu_g)
}

/// Equivalent (von Mises) stress in the bolt while tightening to preload `f`:
/// `sqrt(sigma^2 + 3 tau^2)`, `sigma = F / As`, `tau = MG / Wp`. At the
/// yield limit the section is taken as fully plastic in torsion, so
/// `Wp = pi d0^3 / 12` (d0 = stress diameter; the elastic value is
/// pi d0^3 / 16). This is the assumption behind the 3/2 factor in
/// [`preload_permitted`] (VDI 2230-1, R7/R8).
pub fn assembly_equiv_stress(f: f64, as_: f64, d0: f64, p: f64, d2: f64, mu_g: f64) -> f64 {
    let sigma = f / as_;
    let tau = thread_torque(f, p, d2, mu_g) / (PI * d0.powi(3) / 12.0);
    (sigma * sigma + 3.0 * tau * tau).sqrt()
}

/// Permitted assembly preload (VDI 2230-1:2015, R7): the preload at which the
/// equivalent stress while tightening is `nu` (usually 0.9) times the minimum
/// yield strength `rp02`:
/// `FMzul = A0 nu Rp0.2 / sqrt(1 + 3 [3/2 d2/d0 (P/(pi d2) + 1.155 muG)]^2)`,
/// with A0 = As and d0 the stress diameter for a bolt with a full-size shank.
/// Units: mm and MPa give N; in and psi give lbf.
pub fn preload_permitted(as_: f64, d0: f64, d2: f64, p: f64, mu_g: f64, nu: f64, rp02: f64) -> f64 {
    let k = 1.5 * d2 / d0 * (p / (PI * d2) + 1.155 * mu_g);
    as_ * nu * rp02 / (1.0 + 3.0 * k * k).sqrt()
}

/// Preload as a fraction of the proof load: `F = pct/100 x Sp x As`.
pub fn preload_from_proof(as_: f64, sp: f64, pct: f64) -> f64 {
    as_ * sp * pct / 100.0
}

/// Nut factor K of the short formula `T = K F d` that gives the same torque.
pub fn nut_factor(t: f64, f: f64, d: f64) -> f64 {
    t / (f * d)
}

// ---------------------------------------------------------------------------
// O-ring glands (own derivations from the definitions in the makers' guides)
// ---------------------------------------------------------------------------

/// Squeeze in percent of the cross-section: `(CS - gland depth) / CS x 100`.
pub fn oring_squeeze_pct(cs: f64, gland_depth: f64) -> f64 {
    (cs - gland_depth) / cs * 100.0
}

/// Stretch of the inside diameter in percent: `(seat dia - ID) / ID x 100`,
/// seat dia = the groove bottom diameter of a piston (male) gland. Negative
/// values mean the ring is compressed on its outside (rod / bore glands).
pub fn oring_stretch_pct(ring_id: f64, seat_dia: f64) -> f64 {
    (seat_dia - ring_id) / ring_id * 100.0
}

/// Cross-section after stretching, assuming the ring keeps its volume
/// (`pi^2/4 CS^2 Dm` constant, Dm = mean diameter): solves
/// `CS'^2 (seat + CS') = CS^2 (ID + CS)` by fixed-point iteration. This is
/// an idealisation; makers publish empirical curves that give a slightly
/// smaller reduction, so the result is shown as an estimate.
pub fn oring_cs_stretched(cs: f64, ring_id: f64, seat_dia: f64) -> f64 {
    if !(seat_dia > ring_id) { return cs; }
    let v = cs * cs * (ring_id + cs);
    let mut c = cs;
    for _ in 0..60 { c = (v / (seat_dia + c)).sqrt(); }
    c
}

/// Gland fill in percent: ring volume / groove volume x 100 for a ring of
/// cross-section `cs` and mean diameter `ring_dm` in a rectangular groove of
/// width `w`, depth `h` and mean diameter `groove_dm` (rotationally
/// symmetric): `(pi CS^2/4 x Dm) / (w h Dg) x 100`. For a long straight groove
/// pass the same value for both diameters (area ratio).
pub fn oring_fill_pct(cs: f64, ring_dm: f64, w: f64, h: f64, groove_dm: f64) -> f64 {
    (PI * cs * cs / 4.0 * ring_dm) / (w * h * groove_dm) * 100.0
}

/// Gland depth for a target squeeze (percent): `CS (1 - s/100)`.
pub fn oring_depth_for_squeeze(cs: f64, squeeze_pct: f64) -> f64 {
    cs * (1.0 - squeeze_pct / 100.0)
}

/// Groove width for a target fill (percent) at depth `h` (area ratio):
/// `w = (pi CS^2 / 4) / (fill/100 x h)`.
pub fn oring_width_for_fill(cs: f64, h: f64, fill_pct: f64) -> f64 {
    PI * cs * cs / 4.0 / (fill_pct / 100.0 * h)
}

// ---------------------------------------------------------------------------
// Rolling bearings (ISO 281:2007 clause 6)
// ---------------------------------------------------------------------------

/// Life exponent p: 3 for ball bearings, 10/3 for roller bearings
/// (`roller` 0 = ball, 1 = roller).
pub fn bearing_life_exponent(roller: f64) -> f64 {
    if roller as i32 == 1 { 10.0 / 3.0 } else { 3.0 }
}

/// Basic rating life in millions of revolutions, `L10 = (C/P)^p`.
pub fn bearing_l10(c: f64, p_load: f64, roller: f64) -> f64 {
    (c / p_load).powf(bearing_life_exponent(roller))
}

/// Basic rating life in operating hours, `L10h = 10^6 / (60 n) x L10`.
pub fn bearing_l10h(c: f64, p_load: f64, roller: f64, rpm: f64) -> f64 {
    bearing_l10(c, p_load, roller) * 1.0e6 / (60.0 * rpm)
}

/// Basic dynamic load rating needed for a life of `hours` at `rpm`:
/// `C = P (60 n L10h / 10^6)^(1/p)`.
pub fn bearing_c_required(p_load: f64, roller: f64, rpm: f64, hours: f64) -> f64 {
    p_load * (60.0 * rpm * hours / 1.0e6).powf(1.0 / bearing_life_exponent(roller))
}

/// Equivalent dynamic load `P = X Fr + Y Fa` with the factors X and Y from
/// the bearing maker's catalogue for the bearing and the ratio Fa/Fr.
pub fn bearing_equiv_load(x: f64, fr: f64, y: f64, fa: f64) -> f64 {
    x * fr + y * fa
}

// ---------------------------------------------------------------------------
// Keyways
// ---------------------------------------------------------------------------

/// Check dimension of a shaft keyseat: from the far side of the shaft to the
/// keyseat bottom, `d - t1`.
pub fn keyseat_shaft_dim(d: f64, t1: f64) -> f64 {
    d - t1
}

/// Check dimension of a hub keyway: from the far side of the bore to the
/// keyway bottom, `d + t2`.
pub fn keyway_hub_dim(d: f64, t2: f64) -> f64 {
    d + t2
}

/// Chordal height lost at the edge of a keyseat of width `b` on a shaft of
/// diameter `d`: `(d - sqrt(d^2 - b^2)) / 2`. Inch keyseat depths in ASME
/// B17.1 are measured from the edge of the keyseat, metric t1 from the top of
/// the shaft; this converts between the two.
pub fn keyseat_chordal_height(d: f64, b: f64) -> f64 {
    (d - (d * d - b * b).sqrt()) / 2.0
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b} (tol {tol})"); }
    fn rel(a: f64, b: f64, tol: f64) { assert!(((a - b) / b).abs() <= tol, "{a} vs {b} (rel tol {tol})"); }

    /// MSC Industrial Supply socket products handbook, metric socket head cap
    /// screws (ASTM A574M, 1220 MPa minimum): minimum tensile loads M6 24.5 kN,
    /// M8 44.6, M10 70.8, M12 103, M16 192, M20 299, M24 431 kN
    /// (accessed 2026-11-10). Load = As x 1220 MPa with the ISO stress area.
    #[test] fn stress_area_vs_published_tensile_loads() {
        for (d, p, kn) in [(6.0, 1.0, 24.5), (8.0, 1.25, 44.6), (10.0, 1.5, 70.8), (12.0, 1.75, 103.0),
                           (16.0, 2.0, 192.0), (20.0, 2.5, 299.0), (24.0, 3.0, 431.0)] {
            rel(stress_area_iso(d, p) * 1220.0 / 1000.0, kn, 0.005);
        }
        close(stress_area_iso(10.0, 1.5), 57.99, 0.01);
    }

    /// Roymech, "Screw thread calculations", table row M10 x 1.5 (6H/6g):
    /// pitch diameter 9.0257 mm, tensile stress area 57.9896 mm2, simplified
    /// shear area 14.1776 mm2 per mm, simplified engagement 8.1805 mm
    /// (accessed 2026-11-12).
    #[test] fn engagement_simple_reproduces_the_published_m10_row() {
        close(crate::thread_pitch_dia_basic(10.0, 1.5), 9.0257, 0.00005);
        close(stress_area_iso(10.0, 1.5), 57.9896, 0.0001);
        close(thread_shear_area_per_length(10.0, 1.5), 14.1776, 0.00005);
        close(engagement_min_simple(10.0, 1.5, 0.0), 8.1805, 0.00005);
        // The same construction with the Unified stress area: a little shorter, since that area is a little smaller.
        assert!(engagement_min_simple(10.0, 1.5, 1.0) < engagement_min_simple(10.0, 1.5, 0.0));
        close(engagement_by_diameters(10.0, 1.5), 15.0, 1e-12);
    }

    /// Fastenal Technical Reference Guide (S7028 Rev. 9), worked example:
    /// 3/4-10 SAE J429 Grade 5, 120 000 psi x 0.3340 in2 = 40 080 lb
    /// (accessed 2026-11-12). The Unified formula gives 0.3345 in2.
    #[test] fn stress_area_refuses_a_pitch_too_coarse_for_the_diameter() {
        // M10 with a 12 mm pitch has a negative stress diameter: no area, not the square of a negative number.
        assert!(stress_area_iso(10.0, 12.0).is_nan());
        assert!(stress_area_unified(0.25, 0.3).is_nan());
        assert!(engagement_min_simple(10.0, 12.0, 0.0).is_nan());
    }
    #[test] fn tensile_load_reproduces_the_published_grade_5_example() {
        close(tensile_load(0.3340, 120_000.0), 40_080.0, 1e-6);
        close(stress_area_unified(0.75, 0.1), 0.3340, 0.0006);
        rel(tensile_load(stress_area_unified(0.75, 0.1), 120_000.0), 40_080.0, 0.002);
    }

    /// The ISO and Unified constants differ (0.938194 against 0.9743), so the
    /// unified area is a little smaller for the same diameter and pitch.
    #[test] fn unified_stress_area() {
        // 1/2-13 UNC: 0.7854 (0.5 - 0.9743/13)^2 = 0.1419 in2
        close(stress_area_unified(0.5, 1.0 / 13.0), 0.1419, 0.00005);
        assert!(stress_area_unified(10.0, 1.5) < stress_area_iso(10.0, 1.5));
        close(stress_area_f(0.5, 1.0 / 13.0, 1.0), stress_area_unified(0.5, 1.0 / 13.0), 0.0);
    }

    /// Published VDI 2230 table values (technical information "Screws and
    /// nuts", pp. 1287-1288, on marek.eu, accessed 2026-11-10), muG = muK = 0.12:
    /// M10 27.3 kN -> 46 N m, M12 39.9 kN -> 80 N m, M16 75.3 kN -> 194 N m,
    /// class 8.8; M10 10.9 40.2 kN -> 68 N m. The head geometry behind the
    /// table is not printed; with dw = ISO 272 width across flats and dh =
    /// ISO 273 medium clearance hole the formula agrees within 2.5 %.
    #[test] fn torque_vs_published_table() {
        let case = |d: f64, p: f64, s: f64, dh: f64, f_kn: f64, nm: f64| {
            let d2 = d - 0.649519 * p;
            let t = tightening_torque(f_kn * 1000.0, p, d2, 0.12, bearing_mean_dia(s, dh), 0.12) / 1000.0;
            rel(t, nm, 0.025);
        };
        case(10.0, 1.5, 16.0, 11.0, 27.3, 46.0);
        case(12.0, 1.75, 18.0, 13.5, 39.9, 80.0);
        case(16.0, 2.0, 24.0, 17.5, 75.3, 194.0);
        case(10.0, 1.5, 16.0, 11.0, 40.2, 68.0);
        case(8.0, 1.25, 13.0, 9.0, 17.2, 23.1);
    }

    #[test] fn torque_parts_add_up_and_invert() {
        let (f, p, d2, mg, dkm, mk) = (25_000.0, 1.5, 9.026, 0.12, 13.5, 0.14);
        let t = tightening_torque(f, p, d2, mg, dkm, mk);
        let sum: f64 = (0..3).map(|i| tightening_torque_part(f, p, d2, mg, dkm, mk, i as f64)).sum();
        close(sum, t, 1e-6);
        close(preload_from_torque(t, p, d2, mg, dkm, mk), f, 1e-6);
        // 0.16 P is P/(2 pi) rounded; 0.58 is 1/(2 cos 30) rounded
        close(0.16, 1.0 / (2.0 * PI), 0.0009);
        close(0.58, 1.0 / (2.0 * (30f64).to_radians().cos()), 0.003);
    }

    /// The permitted preload is defined by the equivalent stress while
    /// tightening reaching nu x Rp0.2: check it with the separately written
    /// stress function, and that it falls as thread friction rises.
    #[test] fn permitted_preload_meets_its_definition() {
        let (d, p) = (10.0, 1.5);
        let as_ = stress_area_iso(d, p);
        let d0 = stress_dia_iso(d, p);
        let d2 = d - 0.649519 * p;
        for mu in [0.08, 0.12, 0.16] {
            let f = preload_permitted(as_, d0, d2, p, mu, 0.9, 640.0);
            close(assembly_equiv_stress(f, as_, d0, p, d2, mu), 0.9 * 640.0, 1e-9);
        }
        let f1 = preload_permitted(as_, d0, d2, p, 0.08, 0.9, 640.0);
        let f2 = preload_permitted(as_, d0, d2, p, 0.16, 0.9, 640.0);
        assert!(f1 > f2);
        // M10 8.8, muG 0.12: about 29.6 kN by hand (As 58.0, sqrt term 1.128)
        close(preload_permitted(as_, d0, d2, p, 0.12, 0.9, 640.0) / 1000.0, 29.6, 0.1);
    }

    #[test] fn proof_and_nut_factor() {
        close(preload_from_proof(58.0, 600.0, 75.0), 26_100.0, 1e-9);
        close(nut_factor(46_000.0, 27_300.0, 10.0), 0.1685, 0.0001);
    }

    /// Global O-Ring and Seal, static radial gland table (accessed 2026-11-10):
    /// -2XX, CS 0.139 +/- 0.004, gland depth 0.111-0.113 -> squeeze 0.022-0.032,
    /// "16%-23%"; -3XX, CS 0.210 +/- 0.005, depth 0.170-0.173 -> 0.032-0.045,
    /// "15%-21%". The percentages are squeeze over the nominal cross-section.
    #[test] fn oring_squeeze_vs_maker_table() {
        close(0.135 - 0.113, 0.022, 1e-9);
        close(0.143 - 0.111, 0.032, 1e-9);
        close(oring_squeeze_pct(0.139, 0.139 - 0.022), 15.8, 0.05);
        close(oring_squeeze_pct(0.139, 0.139 - 0.032), 23.0, 0.05);
        close(oring_squeeze_pct(0.210, 0.210 - 0.032), 15.2, 0.05);
        close(oring_squeeze_pct(0.210, 0.210 - 0.045), 21.4, 0.05);
    }

    #[test] fn oring_fill_stretch_and_design() {
        // area ratio: CS 2.62 in a 3.6 x 2.1 groove
        close(oring_fill_pct(2.62, 50.0, 3.6, 2.1, 50.0), PI * 2.62 * 2.62 / 4.0 / (3.6 * 2.1) * 100.0, 1e-9);
        close(oring_stretch_pct(20.0, 21.0), 5.0, 1e-12);
        let h = oring_depth_for_squeeze(0.139, 20.0);
        close(h, 0.1112, 1e-9);
        let w = oring_width_for_fill(0.139, h, 75.0);
        close(oring_fill_pct(0.139, 1.0, w, h, 1.0), 75.0, 1e-9);
        // constant volume: CS'^2 (seat + CS') = CS^2 (ID + CS)
        let c = oring_cs_stretched(3.0, 40.0, 42.0);
        close(c * c * (42.0 + c), 9.0 * 43.0, 1e-9);
        assert!(c < 3.0);
        close(oring_cs_stretched(3.0, 40.0, 39.0), 3.0, 0.0);
    }

    #[test] fn bearing_life() {
        close(bearing_l10(30.0, 3.0, 0.0), 1000.0, 1e-9);
        close(bearing_l10(30.0, 3.0, 1.0), 10f64.powf(10.0 / 3.0), 1e-6);
        close(bearing_l10h(30.0, 3.0, 0.0, 1000.0), 1000.0 * 1e6 / 60_000.0, 1e-6);
        let c = bearing_c_required(3.0, 0.0, 1000.0, 1000.0 * 1e6 / 60_000.0);
        close(c, 30.0, 1e-9);
        close(bearing_equiv_load(0.56, 2.0, 1.5, 1.0), 2.62, 1e-12);
    }

    // ZKL, "Determining the bearing size" (designer information, section 5),
    // tables of C/P against L10 and L10h at n = 1000 1/min (accessed 2026-11-11).
    // C/P is printed to three figures, so the check is relative within 1.5 %.
    #[test] fn bearing_life_vs_maker_table() {
        let rel = |a: f64, b: f64| ((a - b) / b).abs();
        for &(cp, l10, h, roller) in &[(1.82, 6.0, 100.0, 0.0), (3.91, 60.0, 1000.0, 0.0), (8.43, 600.0, 10000.0, 0.0),
                                        (1.71, 6.0, 100.0, 1.0), (3.42, 60.0, 1000.0, 1.0), (6.81, 600.0, 10000.0, 1.0)] {
            assert!(rel(bearing_l10(cp, 1.0, roller), l10) < 0.015, "L10 C/P {cp}");
            assert!(rel(bearing_l10h(cp, 1.0, roller, 1000.0), h) < 0.015, "L10h C/P {cp}");
        }
    }

    #[test] fn keyways() {
        close(keyseat_shaft_dim(25.0, 4.0), 21.0, 0.0);
        close(keyway_hub_dim(25.0, 3.3), 28.3, 1e-12);
        // 1/4 key on a 1 in shaft: chordal height 0.0159 in
        close(keyseat_chordal_height(1.0, 0.25), 0.0159, 0.00005);
    }
}
