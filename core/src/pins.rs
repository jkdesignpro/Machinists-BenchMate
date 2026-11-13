//! Taper pins, inch series (taper 1/4 in per foot on the diameter).
//!
//! Sizes and limits as one supplier's cut sheet (hbbolt.com) prints them from
//! ASME B18.8.2-2000, the only full table found; two other suppliers print the
//! same large end for No. 7/0, 7, 9 and 14. See docs/sources.md, Pins.

/// Basic large-end diameters in inches, No. 7/0 (index 0) to No. 14 (index 20).
const TAPER_PIN_DIA: [f64; 21] = [0.0625, 0.0780, 0.0940, 0.1090, 0.1250, 0.1410, 0.1560, 0.1720, 0.1930, 0.2190, 0.2500,
    0.2890, 0.3410, 0.4090, 0.4920, 0.5910, 0.7060, 0.8600, 1.0320, 1.2410, 1.5230];

/// Large-end diameter of an inch taper pin. `no`: the pin number, with 0 for No. 0
/// and -1 to -6 for 2/0 to 7/0. `which`: 0 basic, 1 commercial class maximum (+0.0013),
/// 2 commercial minimum (-0.0007), 3 precision class maximum (+0.0010), 4 precision
/// minimum (basic). Precision class is made up to No. 10 only.
pub fn taper_pin_dia_in(no: f64, which: f64) -> f64 {
    if !(no >= -6.0 && no <= 14.0) || no.fract() != 0.0 { return f64::NAN; }
    let d = TAPER_PIN_DIA[(no + 6.0) as usize];
    match which as i32 {
        0 => d,
        1 => d + 0.0013,
        2 => d - 0.0007,
        3 => if no <= 10.0 { d + 0.0010 } else { f64::NAN },
        4 => if no <= 10.0 { d } else { f64::NAN },
        _ => f64::NAN,
    }
}

/// Small-end diameter of a pin of large-end diameter `d` and length `l` with a taper of
/// `tpf` per foot on the diameter (same units for d and l as for the taper and its foot:
/// for 1/4 in per foot, d - l x 0.25 / 12). NaN when the pin would taper to nothing.
pub fn taper_pin_small(d: f64, l: f64, tpf: f64) -> f64 {
    if !(d > 0.0 && l >= 0.0 && tpf > 0.0) { return f64::NAN; }
    let s = d - l * tpf / 12.0;
    if s > 0.0 { s } else { f64::NAN }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    #[test]
    fn taper_pins() {
        // The cut sheet: 7/0 0.0625 (0.0638 / 0.0618 commercial, 0.0635 / 0.0625 precision); No. 0 0.1560;
        // No. 4 0.2500; No. 10 0.7060 (0.7073 / 0.7053, 0.7070 / 0.7060); No. 11 0.8600 (0.8613 / 0.8593, no precision class);
        // No. 14 1.5230 (1.5243 / 1.5223). Two other suppliers: No. 7 0.409, No. 9 0.591, 7/0 0.0625, No. 14 1.523.
        for (no, d, cmax, cmin) in [(-6.0, 0.0625, 0.0638, 0.0618), (0.0, 0.1560, 0.1573, 0.1553), (4.0, 0.2500, 0.2513, 0.2493),
            (7.0, 0.4090, 0.4103, 0.4083), (9.0, 0.5910, 0.5923, 0.5903), (10.0, 0.7060, 0.7073, 0.7053), (11.0, 0.8600, 0.8613, 0.8593), (14.0, 1.5230, 1.5243, 1.5223)] {
            close(taper_pin_dia_in(no, 0.0), d, 1e-12);
            close(taper_pin_dia_in(no, 1.0), cmax, 1e-9);
            close(taper_pin_dia_in(no, 2.0), cmin, 1e-9);
        }
        close(taper_pin_dia_in(-6.0, 3.0), 0.0635, 1e-9); close(taper_pin_dia_in(-6.0, 4.0), 0.0625, 1e-12);
        close(taper_pin_dia_in(10.0, 3.0), 0.7070, 1e-9);
        assert!(taper_pin_dia_in(11.0, 3.0).is_nan());
        assert!(taper_pin_dia_in(15.0, 0.0).is_nan());
        assert!(taper_pin_dia_in(-7.0, 0.0).is_nan());
        // The cut sheet's rule: small end = nominal diameter - length x 0.02083. A fastener supplier's chart prints
        // the small end at 1 in of length: 7/0 0.0417, 3/0 0.1042.
        close(taper_pin_small(0.0625, 1.0, 0.25), 0.0417, 5e-5);
        close(taper_pin_small(0.1250, 1.0, 0.25), 0.1042, 5e-5);
        close(taper_pin_small(0.2500, 2.0, 0.25), 0.2500 - 2.0 * 0.02083, 1e-5);
        assert!(taper_pin_small(0.0625, 3.0, 0.25).is_nan());
    }
}
