//! Materials reference helpers (parity batch B4): the two-metal galvanic check.
//!
//! The potentials themselves are reference data (data/refdata/matref-evidence.json):
//! a galvanic series in seawater (volts against Ag/AgCl, D. Gerr, "Controlling
//! Galvanic Corrosion") and an anodic index table (Engineers Edge, in the layout of
//! the MIL-STD-889 groups). This module only compares two entries of one table.
//!
//! * In a galvanic series the metal with the more negative potential is the anode
//!   (it corrodes); in an anodic index table the metal with the larger index is.
//! * The rule of thumb is a limit on the difference: Gerr 0.20 V for metals in
//!   contact in seawater; Engineers Edge and Carr Lane 0.15 V harsh, 0.25 V normal,
//!   0.50 V controlled environments (anodic index).

/// Potential difference between two metals of the same table (V), always >= 0.
pub fn galvanic_difference(a: f64, b: f64) -> f64 {
    if !(a.is_finite() && b.is_finite()) { return f64::NAN; }
    (a - b).abs()
}

/// Which of the two corrodes: 0 = a, 1 = b, -1 = neither (equal values).
/// `index_scale` true for an anodic index table (larger = anodic), false for a
/// galvanic series in volts (more negative = anodic).
pub fn galvanic_anode(a: f64, b: f64, index_scale: bool) -> i32 {
    if !(a.is_finite() && b.is_finite()) || (a - b).abs() < 1e-12 { return -1; }
    let a_anodic = if index_scale { a > b } else { a < b };
    if a_anodic { 0 } else { 1 }
}

/// True when the difference is within the limit (the limit itself counts as within;
/// printed potentials have two decimals, so values are compared to 1e-9 V).
pub fn galvanic_within(diff: f64, limit: f64) -> bool {
    diff.is_finite() && limit.is_finite() && diff <= limit + 1e-9
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seawater_pairs() {
        // Gerr: aluminium marine alloys -0.82 V, 316 passive -0.15 V -> 0.67 V, aluminium corrodes.
        assert!((galvanic_difference(-0.82, -0.15) - 0.67).abs() < 1e-12);
        assert_eq!(galvanic_anode(-0.82, -0.15, false), 0);
        assert!(!galvanic_within(0.67, 0.20));
        // Gerr: Monel -0.11 V and titanium -0.10 V -> 0.01 V, within 0.20 V; Monel is the anode.
        assert!((galvanic_difference(-0.11, -0.10) - 0.01).abs() < 1e-12);
        assert_eq!(galvanic_anode(-0.11, -0.10, false), 0);
        assert!(galvanic_within(galvanic_difference(-0.11, -0.10), 0.20));
        // Zinc -1.05 V against mild steel -0.79 V: zinc protects the steel.
        assert_eq!(galvanic_anode(-0.79, -1.05, false), 1);
    }

    #[test]
    fn anodic_index_pairs() {
        // Engineers Edge: 300-series stainless 0.50, wrought aluminium (not 2000) 0.90 -> 0.40 V.
        let d = galvanic_difference(0.50, 0.90);
        assert!((d - 0.40).abs() < 1e-12);
        assert_eq!(galvanic_anode(0.50, 0.90, true), 1);
        assert!(galvanic_within(d, 0.50) && !galvanic_within(d, 0.25));
        // Brass 0.40 and copper 0.35 -> 0.05 V: fine even in a harsh environment; exactly at a limit counts as within.
        assert!(galvanic_within(galvanic_difference(0.40, 0.35), 0.15));
        assert!(galvanic_within(galvanic_difference(0.60, 0.35), 0.25));
        assert_eq!(galvanic_anode(0.5, 0.5, true), -1);
        assert!(galvanic_difference(f64::NAN, 1.0).is_nan());
    }
}
