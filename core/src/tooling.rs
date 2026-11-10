//! Tooling reference formulas: indexable insert edge length and ISO size code,
//! knurl blank diameters, and linear interpolation for published conversion
//! tables (hardness). Code meanings and table values are reference data in
//! data/refdata/ with their publishers; only geometry and arithmetic live here.

/// Cutting edge length of an indexable insert with inscribed circle `d`.
/// Every ISO insert shape is a tangential polygon (all sides touch the
/// inscribed circle), so a side between corners of angles `a1` and `a2`
/// (degrees) has length `r (cot(a1/2) + cot(a2/2))`, r = d/2.
/// Square: 90/90 gives l = d. Triangle: 60/60 gives l = d sqrt(3).
/// Rhombic with corner angle a: a / (180 - a) gives l = d / sin(a).
/// Trigon (W, 80 deg): 80/160 gives l = 0.684 d.
pub fn insert_edge_length(d: f64, a1_deg: f64, a2_deg: f64) -> f64 {
    let c = |a: f64| 1.0 / (a.to_radians() / 2.0).tan();
    d / 2.0 * (c(a1_deg) + c(a2_deg))
}

/// ISO metric size code of an insert: the cutting edge length in mm with the
/// decimals dropped (round inserts: the diameter). An edge length within
/// 0.01 mm below a whole millimetre is taken as that whole number: the inch
/// based IC 25.4 mm triangle has l = 43.994 mm and is coded 44 by the makers.
pub fn insert_size_code(edge_len_mm: f64) -> f64 {
    (edge_len_mm + 0.01).floor()
}

/// Corner angles (a1, a2) of the sides for an ISO insert shape letter, as
/// used by [`insert_edge_length`]. Returns (NaN, NaN) for round and unknown
/// shapes. Codes: A 85, B 82, C 80, D 55, E 75, M 86, V 35 (rhombic);
/// K 55, L 90 (parallelogram/rectangle are not tangential: NaN);
/// H 120 hexagon, O 135 octagon, P 108 pentagon, S 90, T 60, W 80 trigon.
pub fn insert_shape_angles(letter: char) -> (f64, f64) {
    match letter {
        'A' => (85.0, 95.0), 'B' => (82.0, 98.0), 'C' => (80.0, 100.0), 'D' => (55.0, 125.0),
        'E' => (75.0, 105.0), 'M' => (86.0, 94.0), 'V' => (35.0, 145.0),
        'H' => (120.0, 120.0), 'O' => (135.0, 135.0), 'P' => (108.0, 108.0),
        'S' => (90.0, 90.0), 'T' => (60.0, 60.0), 'W' => (80.0, 160.0),
        _ => (f64::NAN, f64::NAN),
    }
}

/// f64 interface: edge length for shape letter given as its char code.
pub fn insert_edge_length_f(d: f64, letter_code: f64) -> f64 {
    let (a1, a2) = insert_shape_angles(char::from_u32(letter_code as u32).unwrap_or('?'));
    insert_edge_length(d, a1, a2)
}

// ---------------------------------------------------------------------------
// Knurling
// ---------------------------------------------------------------------------

/// Blank diameter on which a knurl of circular pitch `p` (distance between
/// teeth along the circumference, same unit as the result) tracks with a whole
/// number of teeth `n`: `D = n p / pi`.
pub fn knurl_blank_dia_cp(p: f64, n: f64) -> f64 {
    n * p / std::f64::consts::PI
}

/// Blank diameter for a diametral pitch (DP) knurl, the US convention (teeth
/// per inch of diameter): `D = n / DP` (inch).
pub fn knurl_blank_dia_dp(dp: f64, n: f64) -> f64 {
    n / dp
}

/// Whole number of teeth nearest to a blank of diameter `d` for circular
/// pitch `p`: `round(pi d / p)`.
pub fn knurl_teeth_cp(d: f64, p: f64) -> f64 {
    (std::f64::consts::PI * d / p).round()
}

/// Whole number of teeth nearest to diameter `d` (inch) for diametral pitch `dp`.
pub fn knurl_teeth_dp(d: f64, dp: f64) -> f64 {
    (d * dp).round()
}

/// Circular pitch (along the circumference, inch) of a diametral pitch knurl:
/// `p = pi / DP`. DP 96 gives 0.0327 in, about 30.6 teeth per inch.
pub fn knurl_dp_to_cp(dp: f64) -> f64 {
    std::f64::consts::PI / dp
}

/// Blank diameter for `n` teeth of a knurl whose pitch `p_normal` is measured
/// square to the teeth, with the teeth at `helix_deg` to the work axis (0 for a
/// straight knurl, 30 for the usual diagonal and diamond knurls). Around the
/// circumference the pitch is `p / cos(helix)`, so `D = n p / (pi cos(helix))`.
pub fn knurl_blank_dia(p_normal: f64, n: f64, helix_deg: f64) -> f64 {
    n * p_normal / (std::f64::consts::PI * helix_deg.to_radians().cos())
}

/// Teeth (not rounded) around diameter `d` for a knurl of normal pitch `p` at
/// `helix_deg`: `pi d cos(helix) / p`. Round to a whole number and feed it back
/// to [`knurl_blank_dia`] to get a diameter that tracks.
pub fn knurl_teeth_exact(d: f64, p_normal: f64, helix_deg: f64) -> f64 {
    std::f64::consts::PI * d * helix_deg.to_radians().cos() / p_normal
}

// ---------------------------------------------------------------------------
// Surface texture
// ---------------------------------------------------------------------------

/// Ratio of peak-to-valley height to Ra for an ideal periodic profile, to show
/// why no fixed Ra to Rz factor exists: the ratio depends only on the shape of
/// the profile. kind 0: sine wave (pi); 1: triangular, sawtooth (4);
/// 2: turned feed marks, parabolic arcs (18 sqrt 3 / 8 = 3.897);
/// 3: square wave (2). Real profiles with odd deep scratches or high peaks
/// have much larger ratios, since Ra averages them away and Rz does not.
pub fn profile_rz_over_ra(kind: f64) -> f64 {
    match kind as i32 {
        0 => std::f64::consts::PI,
        1 => 4.0,
        2 => 18.0 * 3f64.sqrt() / 8.0,
        3 => 2.0,
        _ => f64::NAN,
    }
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/// Linear interpolation between two published table points (x0, y0) and
/// (x1, y1). Used for hardness conversion, where the standards' tables are
/// interpolated linearly between adjacent rows.
pub fn lerp(x: f64, x0: f64, y0: f64, x1: f64, y1: f64) -> f64 {
    if x1 == x0 { return y0; }
    y0 + (y1 - y0) * (x - x0) / (x1 - x0)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b} (tol {tol})"); }

    #[test] fn edge_length_geometry() {
        close(insert_edge_length(12.7, 90.0, 90.0), 12.7, 1e-12);
        close(insert_edge_length(12.7, 60.0, 60.0), 12.7 * 3f64.sqrt(), 1e-12);
        close(insert_edge_length(12.7, 80.0, 100.0), 12.7 / 80f64.to_radians().sin(), 1e-12);
    }

    /// Mitsubishi Materials toolholder identification page (insert size codes
    /// by inscribed circle and shape, accessed 2026-11-10); Korloy and Walter
    /// print the same codes for the sizes they list.
    #[test] fn size_codes_vs_published() {
        let rows: [(char, f64, f64); 30] = [
            ('T', 4.76, 8.0), ('T', 5.56, 9.0), ('T', 6.35, 11.0), ('T', 7.94, 13.0), ('T', 9.525, 16.0), ('T', 12.7, 22.0),
            ('T', 15.875, 27.0), ('T', 19.05, 33.0), ('T', 25.4, 44.0),
            ('S', 6.35, 6.0), ('S', 9.525, 9.0), ('S', 12.7, 12.0), ('S', 15.875, 15.0), ('S', 19.05, 19.0), ('S', 25.4, 25.0),
            ('W', 6.35, 4.0), ('W', 7.94, 5.0), ('W', 9.525, 6.0), ('W', 12.7, 8.0), ('W', 15.875, 10.0), ('W', 19.05, 13.0),
            ('C', 9.525, 9.0), ('C', 12.7, 12.0), ('C', 15.875, 16.0), ('C', 19.05, 19.0), ('C', 25.4, 25.0),
            ('D', 9.525, 11.0), ('D', 12.7, 15.0), ('D', 15.875, 19.0), ('D', 25.4, 31.0),
        ];
        for (s, d, code) in rows {
            let (a1, a2) = insert_shape_angles(s);
            assert_eq!(insert_size_code(insert_edge_length(d, a1, a2)), code, "{s} {d}");
        }
        // V: 6.35 -> 11, 9.525 -> 16; D 19.05 -> 23
        assert_eq!(insert_size_code(insert_edge_length_f(6.35, 'V' as u32 as f64)), 11.0);
        assert_eq!(insert_size_code(insert_edge_length_f(9.525, 'V' as u32 as f64)), 16.0);
        assert_eq!(insert_size_code(insert_edge_length_f(19.05, 'D' as u32 as f64)), 23.0);
        // Walter prints the trigon edge length: IC 12.7 -> 8.7, 9.525 -> 6.5, 6.35 -> 4.3
        close(insert_edge_length_f(12.7, 'W' as u32 as f64), 8.7, 0.05);
        close(insert_edge_length_f(9.525, 'W' as u32 as f64), 6.5, 0.05);
        close(insert_edge_length_f(6.35, 'W' as u32 as f64), 4.3, 0.05);
    }

    #[test] fn knurl_geometry() {
        // a whole number of teeth fits: circumference = n p
        let d = knurl_blank_dia_cp(1.0, 40.0);
        close(std::f64::consts::PI * d, 40.0, 1e-12);
        close(knurl_teeth_cp(d, 1.0), 40.0, 0.0);
        close(knurl_blank_dia_dp(96.0, 48.0), 0.5, 1e-12);
        close(knurl_teeth_dp(0.5, 96.0), 48.0, 0.0);
    }

    /// Dorian Tool knurling catalogue: 20 TPI at 30 deg is 17.32 TPI around the
    /// work; 1.000 in at 96 DP and 30 deg gives 83.14 teeth and 83 teeth track
    /// on about 0.998 in. Hommel+Keller: CP 20 is a 1.27 mm pitch, DP 64 a
    /// 1.25 mm pitch (both accessed 2026-11-10).
    #[test] fn knurl_vs_makers() {
        close(1.0 / (knurl_blank_dia(1.0 / 20.0, 1.0, 30.0) * std::f64::consts::PI), 17.32, 0.005);
        let p = knurl_dp_to_cp(96.0);
        close(knurl_teeth_exact(1.0, p, 30.0), 83.14, 0.005);
        close(knurl_blank_dia(p, 83.0, 30.0), 0.998, 0.0005);
        close(25.4 / 20.0, 1.27, 1e-12);
        close(knurl_dp_to_cp(64.0) * 25.4, 1.25, 0.005);
        close(1.0 / knurl_dp_to_cp(96.0), 30.6, 0.05);
        // straight knurl: the general form reduces to the CP and DP forms
        close(knurl_blank_dia(1.0, 40.0, 0.0), knurl_blank_dia_cp(1.0, 40.0), 1e-12);
        close(knurl_blank_dia(knurl_dp_to_cp(96.0), 48.0, 0.0), knurl_blank_dia_dp(96.0, 48.0), 1e-12);
    }

    /// Check the profile ratios by sampling one period of each profile.
    #[test] fn rz_over_ra_profiles() {
        let n = 200_000;
        let ratio = |f: &dyn Fn(f64) -> f64| {
            let ys: Vec<f64> = (0..n).map(|i| f((i as f64 + 0.5) / n as f64)).collect();
            let mean = ys.iter().sum::<f64>() / n as f64;
            let ra = ys.iter().map(|y| (y - mean).abs()).sum::<f64>() / n as f64;
            let (lo, hi) = ys.iter().fold((f64::MAX, f64::MIN), |(a, b), &y| (a.min(y), b.max(y)));
            (hi - lo) / ra
        };
        close(ratio(&|x| (2.0 * std::f64::consts::PI * x).sin()), profile_rz_over_ra(0.0), 1e-3);
        close(ratio(&|x| x), profile_rz_over_ra(1.0), 1e-3);
        close(ratio(&|x| (x - 0.5) * (x - 0.5)), profile_rz_over_ra(2.0), 1e-3);
        close(ratio(&|x| if x < 0.5 { 1.0 } else { 0.0 }), profile_rz_over_ra(3.0), 1e-3);
    }

    #[test] fn interpolation() {
        close(lerp(5.0, 0.0, 10.0, 10.0, 20.0), 15.0, 1e-12);
        close(lerp(3.0, 3.0, 7.0, 3.0, 9.0), 7.0, 0.0);
    }
}
