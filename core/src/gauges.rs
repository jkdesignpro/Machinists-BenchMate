//! Wire and sheet metal gauges. Only the American wire gauge follows a rule
//! and is computed here; the other gauges are tables (data/refdata/gauges-evidence.json).
//!
//! AWG rule as printed by Wikipedia (American wire gauge, after ASTM B258),
//! RapidTables and Omni Calculator; see docs/sources.md, Wire and sheet metal gauges.

/// Diameter in inches of AWG (Brown & Sharpe) gauge `n`: 0.005 x 92^((36 - n) / 39).
/// No. 36 is 0.005 in and No. 0000 is 0.46 in by definition; 0, 00, 000 and 0000
/// are n = 0, -1, -2 and -3. Whole numbers from -3 (4/0) to 56 only.
pub fn awg_dia_in(n: f64) -> f64 {
    if !(n >= -3.0 && n <= 56.0) || n.fract() != 0.0 { return f64::NAN; }
    0.005 * 92f64.powf((36.0 - n) / 39.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    // RapidTables, wire gauge chart, diameters in inches as printed (4 places).
    #[test]
    fn awg_table() {
        for (n, d) in [(-3.0, 0.4600), (-2.0, 0.4096), (-1.0, 0.3648), (0.0, 0.3249), (1.0, 0.2893), (2.0, 0.2576), (4.0, 0.2043), (6.0, 0.1620),
            (8.0, 0.1285), (10.0, 0.1019), (12.0, 0.0808), (14.0, 0.0641), (16.0, 0.0508), (18.0, 0.0403), (20.0, 0.0320), (22.0, 0.0253),
            (24.0, 0.0201), (26.0, 0.0159), (28.0, 0.0126), (30.0, 0.0100), (32.0, 0.0080), (34.0, 0.0063), (36.0, 0.0050), (38.0, 0.0040), (40.0, 0.0031)] {
            close(awg_dia_in(n), d, 5.0e-5 + 1e-12);
        }
        // The two defined sizes are exact, and each step is the 39th root of 92 (about 1.1229).
        close(awg_dia_in(36.0), 0.005, 1e-15);
        close(awg_dia_in(-3.0), 0.46, 1e-12);
        close(awg_dia_in(10.0) / awg_dia_in(11.0), 92f64.powf(1.0 / 39.0), 1e-12);
        close(92f64.powf(1.0 / 39.0), 1.1229, 5e-5);
        // Omni Calculator, wire gauge: 12 AWG is 0.0808081 in.
        close(awg_dia_in(12.0), 0.0808081, 5e-8);
        assert!(awg_dia_in(-4.0).is_nan());
        assert!(awg_dia_in(10.5).is_nan());
    }
}
