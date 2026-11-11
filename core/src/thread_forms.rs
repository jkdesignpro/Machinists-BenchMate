//! Other thread forms: 55 degree Whitworth form (BSW, BSF, and the pipe
//! threads of ISO 228-1 and ISO 7-1), British Association (BA) threads, and
//! 60 degree taper pipe threads (NPT, ASME B1.20.1).
//!
//! Standards are cited by name and clause only. The profile constants follow
//! from the thread angle by geometry and are stated in the standards; series
//! data (sizes, threads per inch, pipe outside diameters, hand-tight lengths)
//! are reference data kept in data/refdata/ with their publishers.

// ---------------------------------------------------------------------------
// 55 degree Whitworth form (BS 84; same basic profile in ISO 228-1 and ISO 7-1)
// ---------------------------------------------------------------------------

/// Height of the fundamental triangle of a 55 degree thread:
/// `H = P / (2 tan 27.5 deg) = 0.960491 P`.
pub fn whitworth_fundamental_h(p: f64) -> f64 {
    p / (2.0 * 27.5f64.to_radians().tan())
}

/// Thread depth (radial) of the rounded Whitworth form: `h = (2/3) H = 0.640327 P`
/// (H/6 is truncated at crest and root).
pub fn whitworth_depth(p: f64) -> f64 {
    whitworth_fundamental_h(p) * 2.0 / 3.0
}

/// Crest and root radius of the Whitworth form: `r = 0.137329 P`. The arc is
/// tangent to both flanks and touches the line H/6 inside the sharp vee, so
/// `r = (H/6) sin(27.5) / (1 - sin(27.5))`.
pub fn whitworth_radius(p: f64) -> f64 {
    let s = 27.5f64.to_radians().sin();
    whitworth_fundamental_h(p) / 6.0 * s / (1.0 - s)
}

/// Basic pitch (effective) diameter `d2 = d - h = d - 0.640327 P`.
pub fn whitworth_pitch_dia(d: f64, p: f64) -> f64 {
    d - whitworth_depth(p)
}

/// Basic minor diameter `d1 = d - 2h = d - 1.280654 P`.
pub fn whitworth_minor_dia(d: f64, p: f64) -> f64 {
    d - 2.0 * whitworth_depth(p)
}

/// Taper pipe threads ISO 7-1 (R / Rp / Rc): taper 1:16 on diameter. Diameter
/// at distance `x` from the gauge plane (positive towards the large end).
pub fn taper_1_16_dia(d_gauge: f64, x: f64) -> f64 {
    d_gauge + x / 16.0
}

// ---------------------------------------------------------------------------
// British Association threads (BS 93)
// ---------------------------------------------------------------------------

/// BA thread pitch from the size number, mm: `P = 0.9^n` (BS 93 basis).
/// The standard tabulates P rounded (to 0.01 mm); see [`ba_round`].
pub fn ba_pitch_mm(n: f64) -> f64 {
    0.9f64.powf(n)
}

/// BA major diameter from the pitch, mm: `D = 6 P^(6/5)` (BS 93 basis).
pub fn ba_major_mm(n: f64) -> f64 {
    6.0 * ba_pitch_mm(n).powf(1.2)
}

/// BA thread depth: `h = 0.6 P` (thread angle 47.5 deg, crest and root radius
/// 0.18083 P, as stated with BS 93).
pub fn ba_depth(p: f64) -> f64 {
    0.6 * p
}

/// Round to `sig` significant figures, as the BA table values are
/// (pitch and major diameter to two significant figures).
pub fn round_sig(x: f64, sig: i32) -> f64 {
    if x == 0.0 { return 0.0; }
    let k = 10f64.powi(sig - 1 - x.abs().log10().floor() as i32);
    (x * k).round() / k
}

// ---------------------------------------------------------------------------
// NPT, American national standard taper pipe threads (ASME B1.20.1)
// ---------------------------------------------------------------------------

/// Pitch diameter at the small end of the external thread (inch):
/// `E0 = D - (0.050 D + 1.1) p`, D = outside diameter of the pipe, p = pitch.
pub fn npt_e0(d: f64, p: f64) -> f64 {
    d - (0.050 * d + 1.1) * p
}

/// Pitch diameter at the hand-tight plane: `E1 = E0 + 0.0625 L1` (taper 1:16
/// on diameter), L1 = hand-tight engagement (a tabulated length).
pub fn npt_e1(e0: f64, l1: f64) -> f64 {
    e0 + 0.0625 * l1
}

/// Length of effective external thread: `L2 = (0.80 D + 6.8) p`.
pub fn npt_l2(d: f64, p: f64) -> f64 {
    (0.80 * d + 6.8) * p
}

/// Height of the sharp V thread `H = 0.866025 p`; truncated thread height
/// `h = 0.800 p` (ASME B1.20.1 basic form).
pub fn npt_thread_height(p: f64) -> f64 {
    0.8 * p
}

/// f64 interface: `what` 0 E0, 1 L2, 2 thread height h, 3 E1 (needs `l1`),
/// 4 pitch diameter at the end of the effective thread (E0 + L2/16).
pub fn npt_value_f(d: f64, p: f64, l1: f64, what: f64) -> f64 {
    match what as i32 {
        0 => npt_e0(d, p),
        1 => npt_l2(d, p),
        2 => npt_thread_height(p),
        3 => npt_e1(npt_e0(d, p), l1),
        4 => npt_e0(d, p) + npt_l2(d, p) / 16.0,
        _ => f64::NAN,
    }
}

/// f64 interface: Whitworth form, `what` 0 pitch dia, 1 minor dia, 2 depth,
/// 3 radius, 4 fundamental triangle height.
pub fn whitworth_value_f(d: f64, p: f64, what: f64) -> f64 {
    match what as i32 {
        0 => whitworth_pitch_dia(d, p),
        1 => whitworth_minor_dia(d, p),
        2 => whitworth_depth(p),
        3 => whitworth_radius(p),
        4 => whitworth_fundamental_h(p),
        _ => f64::NAN,
    }
}

/// f64 interface for [`round_sig`].
pub fn round_sig_f(x: f64, sig: f64) -> f64 {
    round_sig(x, sig as i32)
}

/// f64 interface: BA, `what` 0 pitch (exact formula), 1 major (exact formula).
pub fn ba_value_f(n: f64, what: f64) -> f64 {
    match what as i32 { 0 => ba_pitch_mm(n), 1 => ba_major_mm(n), _ => f64::NAN }
}

// ---------- Thread identifier ----------

/// Pitch in mm from threads per inch, or threads per inch from a pitch in
/// mm: 25.4 / x (1 in = 25.4 mm exactly).
pub fn pitch_tpi(x: f64) -> f64 { if x > 0.0 { 25.4 / x } else { f64::NAN } }

/// Thread identifier: how well a measured diameter and pitch fit one
/// standard thread. `d_ref` is that thread's diameter at the place measured
/// (basic major diameter for a screw, basic minor diameter for a bore),
/// `p_nom` its pitch; all in the same length unit as the measurement, mm.
///
/// Returns `[measured diameter - d_ref, (measured pitch - p_nom) / p_nom,
/// score]`. The thread is a candidate when the pitch is within 6 % and the
/// diameter within 6 % of `d_ref` (never less than 0.3 mm); otherwise the
/// score is NaN. The score is the distance in units of "2 % of pitch" and
/// "2 % of diameter + 0.05 mm", so 0 is exact and about 1 or less is a
/// close fit for caliper and pitch-gauge readings. This is BenchMate's own
/// search rule, not a standard: it only orders the table.
pub fn thread_match(d_meas: f64, p_meas: f64, d_ref: f64, p_nom: f64) -> [f64; 3] {
    if !(d_meas > 0.0 && p_meas > 0.0 && d_ref > 0.0 && p_nom > 0.0) || !(d_meas + p_meas + d_ref + p_nom).is_finite() { return [f64::NAN; 3]; }
    let dd = d_meas - d_ref;
    let dp = (p_meas - p_nom) / p_nom;
    if dp.abs() > 0.06 || dd.abs() > (0.06 * d_ref).max(0.3) { return [dd, dp, f64::NAN]; }
    let a = dp / 0.02;
    let b = dd / (0.02 * d_ref + 0.05);
    [dd, dp, (a * a + b * b).sqrt()]
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) { assert!((a - b).abs() <= tol, "{a} vs {b} (tol {tol})"); }

    #[test] fn whitworth_constants() {
        // the three profile constants quoted with the BS 84 / ISO 228-1 form
        close(whitworth_fundamental_h(1.0), 0.960491, 5e-7);
        close(whitworth_depth(1.0), 0.640327, 5e-7);
        close(whitworth_radius(1.0), 0.137329, 5e-7);
    }

    #[test] fn ba_formula() {
        close(ba_pitch_mm(0.0), 1.0, 1e-12);
        close(ba_major_mm(0.0), 6.0, 1e-12);
        close(ba_pitch_mm(2.0), 0.81, 1e-12);
    }

    fn r4(x: f64) -> f64 { (x * 1e4).round() / 1e4 }
    fn r5(x: f64) -> f64 { (x * 1e5).round() / 1e5 }

    /// NPT rows as printed by Wikipedia (National pipe thread, accessed
    /// 2026-11-10): size, TPI, OD, L1, E1, L2. 1/16 OD is printed .313; the
    /// E1 printed is reproduced with the nominal 0.3125.
    const NPT_WIKI: [(&str, f64, f64, f64, f64, f64); 24] = [
        ("1/16", 27.0, 0.3125, 0.1600, 0.28118, 0.2611), ("1/8", 27.0, 0.405, 0.1615, 0.37360, 0.2639),
        ("1/4", 18.0, 0.540, 0.2278, 0.49163, 0.4018), ("3/8", 18.0, 0.675, 0.2400, 0.62701, 0.4078),
        ("1/2", 14.0, 0.840, 0.3200, 0.77843, 0.5337), ("3/4", 14.0, 1.050, 0.3390, 0.98887, 0.5457),
        ("1", 11.5, 1.315, 0.4000, 1.23863, 0.6828), ("1 1/4", 11.5, 1.660, 0.4200, 1.58338, 0.7068),
        ("1 1/2", 11.5, 1.900, 0.4200, 1.82234, 0.7235), ("2", 11.5, 2.375, 0.4360, 2.29627, 0.7565),
        ("2 1/2", 8.0, 2.875, 0.6820, 2.76216, 1.1375), ("3", 8.0, 3.500, 0.7660, 3.38850, 1.2000),
        ("3 1/2", 8.0, 4.000, 0.8210, 3.88881, 1.2500), ("4", 8.0, 4.500, 0.8440, 4.38713, 1.3000),
        ("5", 8.0, 5.563, 0.9370, 5.44929, 1.4063), ("6", 8.0, 6.625, 0.9580, 6.50597, 1.5125),
        ("8", 8.0, 8.625, 1.0630, 8.50003, 1.7125), ("10", 8.0, 10.750, 1.2100, 10.62094, 1.9250),
        ("12", 8.0, 12.750, 1.3600, 12.61781, 2.1250), ("14", 8.0, 14.000, 1.5620, 13.87263, 2.2500),
        ("16", 8.0, 16.000, 1.8120, 15.87575, 2.4500), ("18", 8.0, 18.000, 2.0000, 17.87500, 2.6500),
        ("20", 8.0, 20.000, 2.1250, 19.87031, 2.8500), ("24", 8.0, 24.000, 2.3750, 23.86094, 3.2500),
    ];

    #[test] fn npt_vs_published() {
        for (s, tpi, d, l1, e1, l2) in NPT_WIKI {
            let p = 1.0 / tpi;
            let e1c = npt_e1(npt_e0(d, p), l1);
            // 4 in: E0 + 0.0625 L1 = 4.387125 exactly, a rounding tie; Wikipedia
            // prints 4.38713, another publisher 4.38712.
            assert!((e1c - e1).abs() <= 5.000_1e-6, "{s} E1 {e1c} vs {e1}");
            if s != "4" { close(r5(e1c), e1, 1e-9); }
            close(r4(npt_l2(d, p)), l2, 1e-9);
        }
    }

    /// BSW: size (in), TPI, minor dia printed by Wikipedia (British Standard
    /// Whitworth, accessed 2026-11-10), a subset.
    const BSW_WIKI: [(f64, f64, f64); 12] = [
        (0.125, 40.0, 0.0930), (0.25, 20.0, 0.1860), (0.3125, 18.0, 0.2414), (0.375, 16.0, 0.2950),
        (0.4375, 14.0, 0.3460), (0.5, 12.0, 0.3933), (0.75, 10.0, 0.6219), (1.0, 8.0, 0.8399),
        (1.5, 6.0, 1.2866), (2.0, 4.5, 1.7154), (3.0, 3.5, 2.6341), (6.0, 2.5, 5.4877),
    ];

    #[test] fn bsw_minor_vs_published() {
        for (d, tpi, m) in BSW_WIKI {
            close(r4(whitworth_minor_dia(d, 1.0 / tpi)), m, 1e-9);
        }
        // Engineers Edge and British Fasteners print d - 2 x (depth rounded to
        // 0.0001): 1 in BSW .8400, 5/16 BSW .2413, 7/16 BSF .3663.
        for (d, tpi, m) in [(1.0, 8.0, 0.8400), (0.3125, 18.0, 0.2413), (0.4375, 18.0, 0.3663)] {
            close(d - 2.0 * r4(whitworth_depth(1.0 / tpi)), m, 1e-9);
            close(whitworth_minor_dia(d, 1.0 / tpi), m, 1.0e-4);
        }
    }

    #[test] fn bsf_minor_vs_published() {
        // British Fasteners, BSF core diameters (accessed 2026-11-10)
        for (d, tpi, m) in [(0.1875, 32.0, 0.1475), (0.25, 26.0, 0.2008), (0.3125, 22.0, 0.2543), (0.375, 20.0, 0.311),
                            (0.5, 16.0, 0.42), (0.625, 14.0, 0.5336), (0.75, 12.0, 0.6432), (1.0, 10.0, 0.872)] {
            close(whitworth_minor_dia(d, 1.0 / tpi), m, 1.0e-4);
        }
    }

    #[test] fn bsp_minor_vs_published() {
        // Wikipedia (British Standard Pipe): G 1/2 minor 18.631, G 1 30.291, G 2 56.656 mm
        for (d, tpi, m) in [(20.955, 14.0, 18.631), (33.249, 11.0, 30.291), (59.614, 11.0, 56.656)] {
            close(whitworth_minor_dia(d, 25.4 / tpi), m, 1.0e-3);
        }
    }

    #[test] fn ba_vs_published() {
        // Wikipedia (British Association screw threads, BS 93:2008): BA, pitch, OD (mm)
        let rows = [(0, 1.00, 6.00), (1, 0.90, 5.30), (2, 0.81, 4.70), (3, 0.73, 4.10), (4, 0.66, 3.60), (5, 0.59, 3.20),
                    (6, 0.53, 2.80), (7, 0.48, 2.50), (8, 0.43, 2.20), (9, 0.39, 1.90), (10, 0.35, 1.70), (25, 0.072, 0.25)];
        for (n, p, d) in rows {
            close(round_sig(ba_pitch_mm(n as f64), 2), p, 1e-9);
            close(round_sig(ba_major_mm(n as f64), 2), d, 1e-9);
        }
    }

    #[test] fn npt_formulas() {
        // geometry: E0 + L2/16 is the pitch diameter where the effective thread ends
        let (d, p) = (0.840, 1.0 / 14.0);
        close(npt_value_f(d, p, 0.0, 4.0) - npt_e0(d, p), npt_l2(d, p) / 16.0, 1e-12);
        close(npt_thread_height(p), 0.05714, 1e-5);
    }

    #[test]
    fn thread_identifier() {
        // 20 threads per inch is a 1.27 mm pitch, and back.
        close(pitch_tpi(20.0), 1.27, 1e-12);
        close(pitch_tpi(1.27), 20.0, 1e-12);
        assert!(pitch_tpi(0.0).is_nan());
        // An exact reading scores 0.
        let r = thread_match(10.0, 1.5, 10.0, 1.5);
        close(r[0], 0.0, 1e-12); close(r[1], 0.0, 1e-12); close(r[2], 0.0, 1e-12);
        // A screw measuring 9.85 mm with a 1.5 mm pitch gauge: M10 x 1.5 fits far better than
        // 3/8-16 UNC (9.525 mm, 1.5875 mm), which is still listed as a candidate.
        let m10 = thread_match(9.85, 1.5, 10.0, 1.5);
        let unc = thread_match(9.85, 1.5, 9.525, pitch_tpi(16.0));
        close(m10[0], -0.15, 1e-12);
        close(m10[2], 0.6, 1e-9); // 0.15 / (0.02 x 10 + 0.05)
        assert!(unc[2].is_finite() && unc[2] > 3.0 * m10[2]);
        // M8 x 1.25 and 5/16-20 UNF (7.9375 mm, 1.27 mm) are near twins: both are candidates
        // for a 7.9 mm, 1.25 mm reading and the pitch decides.
        let m8 = thread_match(7.9, 1.25, 8.0, 1.25);
        let unf = thread_match(7.9, 1.25, 7.9375, 1.27);
        assert!(m8[2].is_finite() && unf[2].is_finite() && m8[2] < unf[2]);
        // Outside the window: M10 x 1.5 against a 12 mm reading, or a 1.75 mm pitch.
        assert!(thread_match(12.0, 1.5, 10.0, 1.5)[2].is_nan());
        assert!(thread_match(10.0, 1.75, 10.0, 1.5)[2].is_nan());
        // Small threads keep a 0.3 mm diameter window: M2 x 0.4 against a 1.75 mm reading.
        assert!(thread_match(1.75, 0.4, 2.0, 0.4)[2].is_finite());
        assert!(thread_match(-1.0, 0.4, 2.0, 0.4)[2].is_nan());
    }
}
