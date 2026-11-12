//! Belt and roller chain drives between two shafts: belt length, wrap,
//! centre distance, chain length in pitches, sprocket pitch diameter.
//!
//! Belt length (exact and approximate) and wrap angle as printed by
//! tec-science and Omni Calculator; chain length, centre distance and
//! sprocket pitch diameter as printed by Martin Sprocket & Gear (engineering
//! data), U.S. Tsubaki (RS chain drive selection) and a summary of Mott,
//! Machine Elements in Mechanical Design. See docs/sources.md, Belts and chains.

use std::f64::consts::PI;

fn pair(d1: f64, d2: f64) -> (f64, f64) { if d1 <= d2 { (d1, d2) } else { (d2, d1) } }

/// Length of an open belt round two pulleys, exact:
/// (Dl + Ds) pi/2 + (Dl - Ds) asin((Dl - Ds) / 2C) + 2 sqrt(C^2 - (Dl - Ds)^2 / 4).
/// NaN when the pulleys would touch or overlap.
pub fn belt_length(d1: f64, d2: f64, c: f64) -> f64 {
    let (ds, dl) = pair(d1, d2);
    if !(ds > 0.0 && c > (ds + dl) / 2.0) { return f64::NAN; }
    let dd = dl - ds;
    (dl + ds) * PI / 2.0 + dd * (dd / (2.0 * c)).asin() + 2.0 * (c * c - 0.25 * dd * dd).sqrt()
}

/// The usual approximation: 2C + pi/2 (Dl + Ds) + (Dl - Ds)^2 / (4C).
pub fn belt_length_approx(d1: f64, d2: f64, c: f64) -> f64 {
    let (ds, dl) = pair(d1, d2);
    if !(ds > 0.0 && c > (ds + dl) / 2.0) { return f64::NAN; }
    2.0 * c + PI / 2.0 * (dl + ds) + (dl - ds).powi(2) / (4.0 * c)
}

/// Angle of wrap in degrees: which 0 on the small pulley, 180 - 2 asin((Dl - Ds) / 2C);
/// 1 on the large pulley (the rest of the turn: 180 + 2 asin(...)).
pub fn belt_wrap_deg(d1: f64, d2: f64, c: f64, which: f64) -> f64 {
    let (ds, dl) = pair(d1, d2);
    if !(ds > 0.0 && c > (ds + dl) / 2.0) { return f64::NAN; }
    let a = 2.0 * ((dl - ds) / (2.0 * c)).asin().to_degrees();
    match which as i32 { 0 => 180.0 - a, 1 => 180.0 + a, _ => f64::NAN }
}

/// Centre distance that an open belt of length `len` gives: the exact length
/// formula solved by bisection. NaN when the belt is too short to go round
/// both pulleys with a gap between them.
pub fn belt_centre(d1: f64, d2: f64, len: f64) -> f64 {
    let (ds, dl) = pair(d1, d2);
    if !(ds > 0.0 && len > 0.0) { return f64::NAN; }
    let mut lo = (ds + dl) / 2.0 * (1.0 + 1e-12);
    if !(belt_length(ds, dl, lo) < len) { return f64::NAN; }
    let mut hi = len; // a belt of length L can never span more than L/2 between centres
    for _ in 0..200 {
        let mid = 0.5 * (lo + hi);
        if belt_length(ds, dl, mid) < len { lo = mid } else { hi = mid }
    }
    0.5 * (lo + hi)
}

/// Speed of the driven shaft: n x (size of the driver / size of the driven),
/// sizes being pulley diameters or numbers of teeth.
pub fn drive_driven_rpm(n: f64, driver: f64, driven: f64) -> f64 {
    if !(n >= 0.0 && driver > 0.0 && driven > 0.0) { return f64::NAN; }
    n * driver / driven
}

/// Pitch in inches of an ANSI roller chain from its number: the digits before
/// the last are eighths of an inch (the last digit is 0 standard, 1 light,
/// 5 bushed without rollers). 40 and 41 give 1/2, 100 gives 1 1/4.
pub fn chain_pitch_in(number: f64) -> f64 {
    if !(number >= 25.0 && number <= 240.0) || number.fract() != 0.0 { return f64::NAN; }
    let last = (number as i64) % 10;
    if last != 0 && last != 1 && last != 5 { return f64::NAN; }
    ((number as i64) / 10) as f64 / 8.0
}

/// Chain length in pitches for a centre distance `c` in pitches:
/// L = 2C + (N1 + N2)/2 + (N2 - N1)^2 / (4 pi^2 C).
pub fn chain_length_pitches(n1: f64, n2: f64, c: f64) -> f64 {
    if !(n1 >= 3.0 && n2 >= 3.0 && c > 0.0) { return f64::NAN; }
    2.0 * c + (n1 + n2) / 2.0 + (n2 - n1).powi(2) / (4.0 * PI * PI * c)
}

/// The next whole even number of pitches at or above `l` (a chain of an odd
/// number of pitches needs an offset link).
pub fn chain_even_links(l: f64) -> f64 {
    if !(l > 0.0) { return f64::NAN; }
    let n = (l - 1e-9).ceil();
    if (n as i64) % 2 == 0 { n } else { n + 1.0 }
}

/// Centre distance in pitches for a chain of `l` pitches:
/// C = 1/8 [2L - (N1 + N2) + sqrt((2L - (N1 + N2))^2 - (8/pi^2)(N2 - N1)^2)].
pub fn chain_centre_pitches(n1: f64, n2: f64, l: f64) -> f64 {
    if !(n1 >= 3.0 && n2 >= 3.0 && l > 0.0) { return f64::NAN; }
    let a = 2.0 * l - (n1 + n2);
    let disc = a * a - 8.0 / (PI * PI) * (n2 - n1).powi(2);
    if !(a > 0.0 && disc >= 0.0) { return f64::NAN; }
    (a + disc.sqrt()) / 8.0
}

/// Pitch diameter of a sprocket: p / sin(180 deg / N).
pub fn sprocket_pitch_dia(p: f64, n: f64) -> f64 {
    if !(p > 0.0 && n >= 3.0) { return f64::NAN; }
    p / (PI / n).sin()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b}"); }

    // Omni Calculator, belt length: pulleys of 30 cm and 15 cm, 1.5 m apart: 3.71 m. Pulleys of 6 and
    // 20 in, 56 in apart, by the approximate formula: 153.72 in.
    #[test]
    fn belt_examples() {
        close(belt_length(0.15, 0.30, 1.5), 3.71, 5e-3);
        close(belt_length_approx(20.0, 6.0, 56.0), 153.72, 5e-3);
        // tec-science prints the exact length with the span angle a = asin((dl - ds) / 2e): 2 e cos a + (dl + ds) pi/2 + (dl - ds) a.
        let (ds, dl, e) = (6.0_f64, 20.0_f64, 56.0_f64);
        let a = ((dl - ds) / (2.0 * e)).asin();
        close(belt_length(ds, dl, e), 2.0 * e * a.cos() + (dl + ds) * PI / 2.0 + (dl - ds) * a, 1e-10);
        // Exact and approximate agree closely at a long centre distance, and equal pulleys give 2C + pi D exactly.
        close(belt_length(6.0, 20.0, 56.0), 153.72, 0.02);
        close(belt_length(100.0, 100.0, 300.0), 600.0 + PI * 100.0, 1e-10);
        // Wrap: tec-science, small pulley pi - 2 asin((dl - ds) / 2e); the two wraps make a full turn.
        close(belt_wrap_deg(6.0, 20.0, 56.0, 0.0), 180.0 - 2.0 * a.to_degrees(), 1e-12);
        close(belt_wrap_deg(6.0, 20.0, 56.0, 0.0) + belt_wrap_deg(6.0, 20.0, 56.0, 1.0), 360.0, 1e-12);
        close(belt_wrap_deg(100.0, 100.0, 300.0, 0.0), 180.0, 1e-12);
        // Centre distance is the inverse of the exact length.
        close(belt_centre(6.0, 20.0, belt_length(6.0, 20.0, 56.0)), 56.0, 1e-8);
        close(belt_centre(0.3, 0.15, belt_length(0.15, 0.3, 1.5)), 1.5, 1e-9);
        assert!(belt_centre(6.0, 20.0, 40.0).is_nan());  // shorter than the belt round touching pulleys
        assert!(belt_length(6.0, 20.0, 13.0).is_nan());  // pulleys would overlap
        close(drive_driven_rpm(1750.0, 6.0, 20.0), 525.0, 1e-12);
    }

    #[test]
    fn chain_drive() {
        // Wikipedia, Roller chain: 25 1/4, 35 3/8, 40 and 41 1/2, 50 5/8, 60 3/4, 80 1 in; a No. 160 chain has 2 in pitch.
        // Martin, sprocket engineering data: 100 1.25, 120 1.5, 140 1.75, 180 2.25, 200 2.5, 240 3.
        for (n, p) in [(25.0, 0.25), (35.0, 0.375), (40.0, 0.5), (41.0, 0.5), (50.0, 0.625), (60.0, 0.75), (80.0, 1.0), (100.0, 1.25),
            (120.0, 1.5), (140.0, 1.75), (160.0, 2.0), (180.0, 2.25), (200.0, 2.5), (240.0, 3.0)] { close(chain_pitch_in(n), p, 1e-15); }
        assert!(chain_pitch_in(42.0).is_nan());
        // Martin prints the last term as 0.1013 (N - n)^2 / 4C.
        let (n1, n2, c) = (17.0, 51.0, 40.0);
        close(chain_length_pitches(n1, n2, c), 2.0 * c + (n1 + n2) / 2.0 + 0.1013 * (n2 - n1) * (n2 - n1) / (4.0 * c), 1e-3);
        close(chain_length_pitches(20.0, 20.0, 30.0), 80.0, 1e-12);
        // Even number of pitches, and the centre distance formula is the inverse of the length formula.
        close(chain_even_links(114.73), 116.0, 0.0); close(chain_even_links(115.2), 116.0, 0.0); close(chain_even_links(116.0), 116.0, 0.0);
        let l = chain_length_pitches(n1, n2, c);
        close(chain_centre_pitches(n1, n2, l), c, 1e-9);
        // Mott (as summarised) prints the constant 8/pi^2 as 0.81; Tsubaki as 8 over 9.86.
        close(8.0 / (PI * PI), 0.81, 1e-3); close(PI * PI, 9.86, 1e-2);
        // Pitch diameter p / sin(180/N): a 6-tooth sprocket of pitch p has a pitch circle of diameter 2p (hexagon).
        close(sprocket_pitch_dia(0.5, 6.0), 1.0, 1e-12);
        close(sprocket_pitch_dia(0.5, 17.0), 0.5 / (180.0_f64 / 17.0).to_radians().sin(), 1e-12);
        assert!(chain_centre_pitches(17.0, 51.0, 30.0).is_nan());
    }
}
