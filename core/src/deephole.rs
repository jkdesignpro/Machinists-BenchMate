//! Gun drilling helpers. The starting values themselves (speeds, feeds, coolant
//! pressure and flow) are makers' tables in `data/refdata/gundrill-evidence.json`;
//! this module holds the arithmetic done on them.
//!
//! Sources (docs/sources.md, section "Gun drilling"):
//! * [STERLING] Sterling Gun Drills, catalogue, "Speeds and Feeds": RPM = SFM /
//!   0.262 / diameter; drill lengths over 30:1, reduce the feed by 20 %; speed
//!   adjustments in percent (free machining +30 % and others).
//! * [MASTERFLUID] Master Fluid Solutions, technical bulletin 109: with a
//!   water-based coolant supply enough per drill revolution to fill the drilled
//!   hole: gallons = 0.785 d^2 depth / 231 (inch), flow = volume x rpm. Flow
//!   through a nozzle, before friction: GPM = 30 d^2 sqrt(psi).
//! * [UNISIG] UNISIG deep hole drilling technical reference: starting flow per
//!   unit of tool diameter.

use std::f64::consts::PI;

/// Depth of the hole in drill diameters.
pub fn depth_ratio(depth: f64, dia: f64) -> f64 { depth / dia }

/// A value changed by a percentage: `v (1 + pct / 100)` [STERLING speed notes].
pub fn pct_adjust(v: f64, pct: f64) -> f64 { v * (1.0 + pct / 100.0) }

/// Feed per revolution for a hole `ratio` diameters deep: over `limit`
/// diameters it is changed by `pct` percent ([STERLING]: over 30:1, -20 %).
pub fn gundrill_feed_for_depth(feed: f64, ratio: f64, limit: f64, pct: f64) -> f64 {
    if ratio > limit { pct_adjust(feed, pct) } else { feed }
}

/// Flow (US gal/min) that fills the drilled hole once per drill revolution
/// [MASTERFLUID]: `pi/4 d^2 depth / 231 x rpm`, d and depth in inch.
pub fn fill_rule_flow_gpm(d_in: f64, depth_in: f64, rpm: f64) -> f64 {
    PI / 4.0 * d_in * d_in * depth_in / 231.0 * rpm
}

/// Flow (US gal/min) through a round nozzle of diameter `d_in` at `psi`,
/// before friction losses [MASTERFLUID]: `30 d^2 sqrt(psi)`.
pub fn nozzle_flow_gpm(d_in: f64, psi: f64) -> f64 { 30.0 * d_in * d_in * psi.sqrt() }

/// Flow from a rate per unit of tool diameter [UNISIG]: `rate x dia`.
pub fn flow_per_dia(rate: f64, dia: f64) -> f64 { rate * dia }

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    /// [MASTERFLUID] worked examples: a 3/8 in hole 8 in deep at 300 rpm needs
    /// about 1.1 GPM; 1,000 psi through a 0.100 in nozzle gives about 9.5 GPM.
    #[test]
    fn master_fluid_examples() {
        assert!(close(fill_rule_flow_gpm(0.375, 8.0, 300.0), 1.1, 0.05));
        assert!(close(nozzle_flow_gpm(0.100, 1000.0), 9.5, 0.05));
    }

    /// [STERLING]: RPM = SFM / 0.262 / diameter (the core uses 12 / pi =
    /// 3.8197, 1 / 0.262 is 3.8168); over 30:1 the feed drops by 20 %; free
    /// machining stainless +30 %. [UNISIG]: 25 to 30 gal/min per inch, 3.7 to
    /// 4.5 l/min per mm, which agree: 1 in = 25.4 mm gives 94 to 114 l/min =
    /// 24.8 to 30.2 gal/min.
    #[test]
    fn sterling_and_unisig_rules() {
        assert!(close(crate::rpm_from_sfm(280.0, 0.5), 280.0 / 0.262 / 0.5, 2.0));
        assert!(close(gundrill_feed_for_depth(0.0008, 31.0, 30.0, -20.0), 0.00064, 1e-12));
        assert!(close(gundrill_feed_for_depth(0.0008, 30.0, 30.0, -20.0), 0.0008, 1e-15));
        assert!(close(pct_adjust(200.0, 30.0), 260.0, 1e-9) && close(pct_adjust(400.0, -60.0), 160.0, 1e-9));
        assert!(close(depth_ratio(16.0, 0.5), 32.0, 1e-12));
        assert!(close(flow_per_dia(3.7, 25.4) / 3.785411784, 24.8, 0.05));
        assert!(close(flow_per_dia(4.5, 25.4) / 3.785411784, 30.2, 0.05));
    }
}
