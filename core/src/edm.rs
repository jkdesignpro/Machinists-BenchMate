//! Wire EDM arithmetic: kerf, wire offset, smallest inside corner radius, taper
//! and cut time. The spark gap, the stock left for skim cuts and the cutting
//! rate are inputs: they come from the machine's technology tables.
//!
//! Sources (docs/sources.md, section "Wire EDM"):
//! * [RELEDM] C. Sommer and S. Sommer, Complete EDM Handbook (Reliable EDM),
//!   chapters 2 and 5: a .012 in wire usually leaves a .016 in kerf; the gap
//!   between wire and work is .002 to .003 in; the smallest inside radius is
//!   set by the wire and the spark gap (.0063 in for .012 in wire, .0053 in for
//!   .010 in wire, reached by skimming); speed is rated in square inches of
//!   material cut in one hour.
//! * [CIMA_W] Cimatron wire EDM help, common parameters: cut width = wire
//!   diameter + 2 x the spark gap.
//! * [ADSK_W] Autodesk FeatureCAM help, "Offset method": the compensation value
//!   is the wire radius plus the spark gap allowance plus any finishing
//!   allowance.
//! * [UMN_EDM] University of Minnesota, Aerospace Engineering and Mechanics,
//!   wire EDM notes: taper angle = atan(sqrt(U^2 + V^2) / (Z3 + Z4)), Z3 + Z4
//!   being the length of wire between the guides.
//! * [IMD_TAPER], [IMD_PRICE] Industrial Monitor Direct knowledge base (no
//!   author named): land = tan(A) x height; cut area = cut length x workpiece
//!   height, time = area / rate.

fn pos(x: f64) -> bool { x.is_finite() && x > 0.0 }
fn nonneg(x: f64) -> bool { x.is_finite() && x >= 0.0 }

/// Width of the slot the wire leaves: wire diameter + 2 x spark gap [CIMA_W], [RELEDM].
pub fn edm_kerf(wire_dia: f64, gap: f64) -> f64 {
    if pos(wire_dia) && nonneg(gap) { wire_dia + 2.0 * gap } else { f64::NAN }
}

/// Wire offset from the finished profile for one pass: wire radius + spark gap
/// + stock left on for later passes [ADSK_W].
pub fn edm_offset(wire_dia: f64, gap: f64, stock: f64) -> f64 {
    if pos(wire_dia) && nonneg(gap) && nonneg(stock) { wire_dia / 2.0 + gap + stock } else { f64::NAN }
}

/// Smallest inside corner radius the wire can leave: wire radius + spark gap
/// of the pass that finishes the corner [RELEDM].
pub fn edm_min_inside_radius(wire_dia: f64, gap: f64) -> f64 { edm_offset(wire_dia, gap, 0.0) }

/// Taper cut over a height `h` at `angle_deg` per side (from the vertical).
/// `which`: 0 = sideways distance over the height (the land, per side),
/// 1 = the same on two opposite sides (how much an opening or a punch differs
/// in size between top and bottom). The same relation gives the sideways
/// distance between the wire guides when `h` is the length of wire between
/// them [UMN_EDM], [IMD_TAPER].
pub fn edm_taper(h: f64, angle_deg: f64, which: f64) -> f64 {
    if !(pos(h) && angle_deg.is_finite() && angle_deg >= 0.0 && angle_deg < 90.0) { return f64::NAN; }
    let land = h * angle_deg.to_radians().tan();
    match which as i64 { 0 => land, 1 => 2.0 * land, _ => f64::NAN }
}

/// Taper angle per side (degrees) from a sideways distance `land` over a height `h` [UMN_EDM].
pub fn edm_taper_angle(land: f64, h: f64) -> f64 {
    if pos(h) && nonneg(land) { (land / h).atan().to_degrees() } else { f64::NAN }
}

/// Cut time from the cutting rate (area per unit of time) [RELEDM], [IMD_PRICE].
/// `length` is the length of the cut path, `thickness` the height of the work,
/// `rate` the rate of the first cut, `skims` the number of skim cuts and
/// `skim_rate` their rate. Times come out in the time unit of the rates.
/// `which`: 0 = area of one pass, 1 = time of the first cut, 2 = speed along
/// the path on the first cut (rate / thickness), 3 = time of all skim cuts,
/// 4 = total time, 5 = speed along the path on a skim cut.
pub fn edm_cut(length: f64, thickness: f64, rate: f64, skims: f64, skim_rate: f64, which: f64) -> f64 {
    if !(pos(length) && pos(thickness)) { return f64::NAN; }
    let area = length * thickness;
    let n = if skims.is_finite() && skims >= 0.0 { skims.floor() } else { return f64::NAN };
    let rough = if pos(rate) { area / rate } else { f64::NAN };
    let skim = if n == 0.0 { 0.0 } else if pos(skim_rate) { n * area / skim_rate } else { f64::NAN };
    match which as i64 {
        0 => area,
        1 => rough,
        2 => if pos(rate) { rate / thickness } else { f64::NAN },
        3 => skim,
        4 => rough + skim,
        5 => if pos(skim_rate) { skim_rate / thickness } else { f64::NAN },
        _ => f64::NAN,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    #[test]
    fn kerf_offset_and_corner_against_the_handbook() {
        // [RELEDM] ch. 5: .012 in wire usually leaves a .016 in kerf; the gap is .002 to .003 in.
        assert!(close(edm_kerf(0.012, 0.002), 0.016, 1e-12));
        // The offset with no stock is half the kerf.
        assert!(close(edm_offset(0.012, 0.002, 0.0), 0.008, 1e-12));
        assert!(close(edm_offset(0.25, 0.04, 0.03), 0.195, 1e-12));
        // [RELEDM] ch. 5: smallest inside radius .0063 in for .012 in wire and .0053 in for .010 in
        // wire, reached by skimming: the wire radius plus a gap of .0003 in.
        assert!(close(edm_min_inside_radius(0.012, 0.0003), 0.0063, 1e-12));
        assert!(close(edm_min_inside_radius(0.010, 0.0003), 0.0053, 1e-12));
        assert!(edm_kerf(0.0, 0.002).is_nan() && edm_offset(0.01, -0.001, 0.0).is_nan() && edm_offset(0.01, 0.001, -0.1).is_nan());
    }

    #[test]
    fn taper_against_two_sources() {
        // [IMD_TAPER]: tan(1.5 deg) = 0.02619; over 25 mm the land is about 0.655 mm per side.
        assert!(close(edm_taper(25.0, 1.5, 0.0), 0.655, 5e-4));
        assert!(close(edm_taper(25.0, 1.5, 1.0), 1.309, 5e-4));
        // [UMN_EDM]: angle = atan(sqrt(U^2 + V^2) / (Z3 + Z4)), with Z3 = 3.2759 and Z4 = 0.2969 in.
        let span = 3.2759 + 0.2969;
        let (u, v) = (0.3f64, 0.4f64);
        let a = edm_taper_angle((u * u + v * v).sqrt(), span);
        assert!(close(a, (0.5f64 / 3.5728).atan().to_degrees(), 1e-12));
        assert!(close(edm_taper(span, a, 0.0), 0.5, 1e-12));
        assert!(close(edm_taper(10.0, 45.0, 0.0), 10.0, 1e-12));
        assert!(edm_taper(10.0, 90.0, 0.0).is_nan() && edm_taper(0.0, 5.0, 0.0).is_nan() && edm_taper_angle(1.0, 0.0).is_nan());
    }

    #[test]
    fn cut_time_from_the_rate() {
        // [IMD_PRICE]: a 13 in cut through 10 in is 130 sq in; at 3 sq in per hour about 43 hours.
        assert!(close(edm_cut(13.0, 10.0, 3.0, 0.0, 0.0, 0.0), 130.0, 1e-12));
        assert!(close(edm_cut(13.0, 10.0, 3.0, 0.0, 0.0, 1.0), 43.333, 1e-3));
        assert!(close(edm_cut(13.0, 10.0, 3.0, 0.0, 0.0, 4.0), 43.333, 1e-3));
        assert!(close(edm_cut(13.0, 10.0, 3.0, 0.0, 0.0, 2.0), 0.3, 1e-12));
        // Two skims at 8 sq in per hour: 2 x 130 / 8 = 32.5 h more.
        assert!(close(edm_cut(13.0, 10.0, 3.0, 2.0, 8.0, 3.0), 32.5, 1e-12));
        assert!(close(edm_cut(13.0, 10.0, 3.0, 2.0, 8.0, 4.0), 75.833, 1e-3));
        assert!(close(edm_cut(13.0, 10.0, 3.0, 2.0, 8.0, 5.0), 0.8, 1e-12));
        // Skims asked for with no rate: no total.
        assert!(edm_cut(13.0, 10.0, 3.0, 2.0, 0.0, 4.0).is_nan());
        // [RELEDM] ch. 2 prints 2 sq in per hour as 21 mm2/min and 6 as 64 mm2/min.
        let mm2_min = |in2_h: f64| in2_h * 645.16 / 60.0;
        assert!(close(mm2_min(2.0), 21.0, 0.6) && close(mm2_min(6.0), 64.0, 0.6));
    }
}
