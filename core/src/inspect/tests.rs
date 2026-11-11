//! Worked numbers for inspection round 2. Table values are the ones the
//! publishers print (data/refdata/*-evidence.json, docs/inspection.md).
use super::*;
use crate::fits::iso286_step_mean;

/// Main steps over 500 mm and IT1..IT18 (um) as printed by Wikipedia "IT Grade"
/// (IT12 to IT18 printed in mm, x1000 here).
const LARGE: [(f64, f64); 8] = [(500.0, 630.0), (630.0, 800.0), (800.0, 1000.0), (1000.0, 1250.0), (1250.0, 1600.0), (1600.0, 2000.0), (2000.0, 2500.0), (2500.0, 3150.0)];
const IT_LARGE: [[f64; 18]; 8] = [
    [9.0, 11.0, 16.0, 22.0, 32.0, 44.0, 70.0, 110.0, 175.0, 280.0, 440.0, 700.0, 1100.0, 1750.0, 2800.0, 4400.0, 7000.0, 11000.0],
    [10.0, 13.0, 18.0, 25.0, 36.0, 50.0, 80.0, 125.0, 200.0, 320.0, 500.0, 800.0, 1250.0, 2000.0, 3200.0, 5000.0, 8000.0, 12500.0],
    [11.0, 15.0, 21.0, 28.0, 40.0, 56.0, 90.0, 140.0, 230.0, 360.0, 560.0, 900.0, 1400.0, 2300.0, 3600.0, 5600.0, 9000.0, 14000.0],
    [13.0, 18.0, 24.0, 33.0, 47.0, 66.0, 105.0, 165.0, 260.0, 420.0, 660.0, 1050.0, 1650.0, 2600.0, 4200.0, 6600.0, 10500.0, 16500.0],
    [15.0, 21.0, 29.0, 39.0, 55.0, 78.0, 125.0, 195.0, 310.0, 500.0, 780.0, 1250.0, 1950.0, 3100.0, 5000.0, 7800.0, 12500.0, 19500.0],
    [18.0, 25.0, 35.0, 46.0, 65.0, 92.0, 150.0, 230.0, 370.0, 600.0, 920.0, 1500.0, 2300.0, 3700.0, 6000.0, 9200.0, 15000.0, 23000.0],
    [22.0, 30.0, 41.0, 55.0, 78.0, 110.0, 175.0, 280.0, 440.0, 700.0, 1100.0, 1750.0, 2800.0, 4400.0, 7000.0, 11000.0, 17500.0, 28000.0],
    [26.0, 36.0, 50.0, 68.0, 96.0, 135.0, 210.0, 330.0, 540.0, 860.0, 1350.0, 2100.0, 3300.0, 5400.0, 8600.0, 13500.0, 21000.0, 33000.0],
];

#[test] fn iso286_large_tolerance_unit() {
    // 500-630: D = sqrt(315000) = 561.25, I = 0.004 D + 2.1 = 4.345 um; IT7 = 16 I = 69.5 -> table 70
    let d = iso286_step_mean(500.0, 630.0);
    assert!((iso286_tolerance_unit_large(d) - 4.345).abs() < 1e-3);
    assert!((iso286_it_formula_large(d, 7) - 69.52).abs() < 0.01);
    assert!(iso286_it_formula_large(d, 0).is_nan());
}

/// Every printed IT value over 500 mm is within 7 % of the formula (the
/// largest gap is IT2 over 500 to 630: 11 printed, 11.7 by formula), and
/// IT11 to IT18 are exactly 10 x the grade five lower, as below 500 mm.
#[test] fn iso286_large_it_formula_vs_table() {
    let mut worst: f64 = 0.0;
    for (k, &(lo, hi)) in LARGE.iter().enumerate() {
        let d = iso286_step_mean(lo, hi);
        for g in 1..=18u32 {
            let t = IT_LARGE[k][(g - 1) as usize];
            let rel = (iso286_it_formula_large(d, g) - t).abs() / t;
            worst = worst.max(rel);
            assert!(rel < 0.07, "IT{} {}-{}: table {} formula {}", g, lo, hi, t, iso286_it_formula_large(d, g));
            if g >= 11 { assert_eq!(t, 10.0 * IT_LARGE[k][(g - 6) as usize]); }
        }
    }
    assert!(worst > 0.06, "the known worst cell should still be there");
}

/// Shaft deviations over 500 mm printed by GOST 25346-89 Table 2 (um) against
/// the annex formulas: every value within 6 %.
#[test] fn iso286_large_shaft_formula_vs_table() {
    // main steps: d e f g m n p
    let main: [[f64; 7]; 8] = [
        [-260.0, -145.0, -76.0, -22.0, 26.0, 44.0, 78.0], [-290.0, -160.0, -80.0, -24.0, 30.0, 50.0, 88.0],
        [-320.0, -170.0, -86.0, -26.0, 34.0, 56.0, 100.0], [-350.0, -195.0, -98.0, -28.0, 40.0, 66.0, 120.0],
        [-390.0, -220.0, -110.0, -30.0, 48.0, 78.0, 140.0], [-430.0, -240.0, -120.0, -32.0, 58.0, 92.0, 170.0],
        [-480.0, -260.0, -130.0, -34.0, 68.0, 110.0, 195.0], [-520.0, -290.0, -145.0, -38.0, 76.0, 135.0, 240.0]];
    let codes = [5u32, 6, 8, 10, 14, 15, 16];
    for (k, &(lo, hi)) in LARGE.iter().enumerate() {
        let d = iso286_step_mean(lo, hi);
        for (j, &c) in codes.iter().enumerate() {
            let f = iso286_shaft_fd_formula_large(c, d, IT_LARGE[k][6], main[k][6]);
            let t = main[k][j];
            assert!((f - t).abs() / t.abs() < 0.06, "letter {} {}-{}: table {} formula {:.1}", c, lo, hi, t, f);
        }
    }
    // intermediate steps: r s t u
    let sub: [(f64, f64, [f64; 4]); 16] = [
        (500.0, 560.0, [150.0, 280.0, 400.0, 600.0]), (560.0, 630.0, [155.0, 310.0, 450.0, 660.0]),
        (630.0, 710.0, [175.0, 340.0, 500.0, 740.0]), (710.0, 800.0, [185.0, 380.0, 560.0, 840.0]),
        (800.0, 900.0, [210.0, 430.0, 620.0, 940.0]), (900.0, 1000.0, [220.0, 470.0, 680.0, 1050.0]),
        (1000.0, 1120.0, [250.0, 520.0, 780.0, 1150.0]), (1120.0, 1250.0, [260.0, 580.0, 840.0, 1300.0]),
        (1250.0, 1400.0, [300.0, 640.0, 960.0, 1450.0]), (1400.0, 1600.0, [330.0, 720.0, 1050.0, 1600.0]),
        (1600.0, 1800.0, [370.0, 820.0, 1200.0, 1850.0]), (1800.0, 2000.0, [400.0, 920.0, 1350.0, 2000.0]),
        (2000.0, 2240.0, [440.0, 1000.0, 1500.0, 2300.0]), (2240.0, 2500.0, [460.0, 1100.0, 1650.0, 2500.0]),
        (2500.0, 2800.0, [550.0, 1250.0, 1900.0, 2900.0]), (2800.0, 3150.0, [580.0, 1400.0, 2100.0, 3200.0])];
    for &(lo, hi, vals) in sub.iter() {
        let k = LARGE.iter().position(|&(a, b)| lo >= a && hi <= b).unwrap();
        let d = iso286_step_mean(lo, hi);
        for (j, c) in [17u32, 18, 19, 20].iter().enumerate() {
            let f = iso286_shaft_fd_formula_large(*c, d, IT_LARGE[k][6], main[k][6]);
            assert!((f - vals[j]).abs() / vals[j] < 0.06, "letter {} {}-{}: table {} formula {:.1}", c, lo, hi, vals[j], f);
        }
    }
    assert!(iso286_shaft_fd_formula_large(1, 600.0, 70.0, 78.0).is_nan()); // a is not defined over 500 mm
}

/// Above 500 mm the hole rules use no delta: hole M, N, P to T = -ei of the
/// shaft (GOST 25346 Table 3 prints M -26, N -44, P -78, R -150, S -280, T -400
/// for 500 to 560 mm, the negatives of the shaft values).
#[test] fn iso286_large_holes_general_rule() {
    use crate::fits::{iso286_delta, iso286_hole_fd};
    let delta = iso286_delta(70.0, 44.0, 630.0);
    assert_eq!(delta, 0.0);
    assert_eq!(iso286_hole_fd(14, 7, 26.0, delta, 500.0, 630.0), -26.0);
    assert_eq!(iso286_hole_fd(15, 7, 44.0, delta, 500.0, 630.0), -44.0);
    assert_eq!(iso286_hole_fd(16, 7, 78.0, delta, 500.0, 630.0), -78.0);
    assert_eq!(iso286_hole_fd(19, 7, 400.0, delta, 500.0, 560.0), -400.0);
    assert_eq!(iso286_hole_fd(13, 7, 0.0, delta, 500.0, 630.0), 0.0);
}

/// j and J: Simply Bearings prints j6 over 18 to 30 mm as +9 / -4 and J7 over
/// 30 to 50 mm as +14 / -11 (IT6 = 13, IT7 = 25 um).
#[test] fn iso286_j_classes() {
    assert_eq!(iso286_j_limits(-4.0, 13.0, false), (9.0, -4.0));
    assert_eq!(iso286_j_limits(14.0, 25.0, true), (14.0, -11.0));
    assert_eq!(iso286_j_limit_f(14.0, 25.0, 1.0, 1.0), -11.0);
}

/// ANSI B4.1: Engineers Edge worked example RC5 at 2 in (and the KSU table):
/// hole +1.8 / 0, shaft -2.5 / -3.7 thousandths -> clearance 2.5 to 5.5.
#[test] fn ansi_fits() {
    assert!((ansi_fit_f(0.0, 1.8, 0.0, -2.5, -3.7, 0.0) - 2.5).abs() < 1e-12);
    assert!((ansi_fit_f(0.0, 1.8, 0.0, -2.5, -3.7, 1.0) - 5.5).abs() < 1e-12);
    assert_eq!(ansi_fit_f(0.0, 1.8, 0.0, -2.5, -3.7, 4.0), 1.0);
    // FN2 over 1.97 to 2.56 in: hole +1.2 / 0, shaft +2.7 / +2.0 -> interference 0.8 to 2.7
    assert!((ansi_fit_f(1.0, 1.2, 0.0, 2.7, 2.0, 0.0) - 0.8).abs() < 1e-12);
    assert!((ansi_fit_f(1.0, 1.2, 0.0, 2.7, 2.0, 1.0) - 2.7).abs() < 1e-12);
    assert_eq!(ansi_fit_f(1.0, 1.2, 0.0, 2.7, 2.0, 4.0), 3.0);
    // LT1 over 1.19 to 1.97 in: hole +1.0 / 0, shaft +0.3 / -0.3 -> -0.3 / +1.3, transition
    assert!((ansi_fit_f(0.0, 1.0, 0.0, 0.3, -0.3, 0.0) + 0.3).abs() < 1e-12);
    assert!((ansi_fit_f(0.0, 1.0, 0.0, 0.3, -0.3, 1.0) - 1.3).abs() < 1e-12);
    assert_eq!(ansi_fit_f(0.0, 1.0, 0.0, 0.3, -0.3, 4.0), 2.0);
}

#[test] fn renard() {
    assert!((renard_theoretical(10.0, 5.0) - 3.16228).abs() < 1e-5); // printed 3.15
    assert!((renard_theoretical(40.0, 3.0) - 1.18850).abs() < 1e-5); // printed 1.18, not 1.19
    assert!((renard_theoretical(5.0, 5.0) - 10.0).abs() < 1e-12);
    assert_eq!(renard_index(40.0, 3.15).round(), 20.0);
    assert_eq!(renard_index(20.0, 4.5).round(), 13.0);
    assert!(renard_index(10.0, 0.0).is_nan());
}

/// d2 and d3 by integration against the definitions and both printed tables.
#[test] fn control_chart_constants() {
    // n = 2: the range of two normals is |X1 - X2|: d2 = 2/sqrt(pi), d3 = sqrt(2 - 4/pi)
    let pi = std::f64::consts::PI;
    assert!((range_d2(2) - 2.0 / pi.sqrt()).abs() < 1e-6);
    assert!((range_d3(2) - (2.0 - 4.0 / pi).sqrt()).abs() < 1e-4);
    // NIST 6.3.2.1 (A2, D3, D4) and York (A2, D3, D4, d2, d3), n = 2..10
    let nist: [[f64; 3]; 9] = [[1.880, 0.0, 3.267], [1.023, 0.0, 2.575], [0.729, 0.0, 2.282], [0.577, 0.0, 2.115], [0.483, 0.0, 2.004],
        [0.419, 0.076, 1.924], [0.373, 0.136, 1.864], [0.337, 0.184, 1.816], [0.308, 0.223, 1.777]];
    let york: [[f64; 5]; 9] = [[1.880, 0.0, 3.266, 1.128, 0.852], [1.023, 0.0, 2.574, 1.693, 0.888], [0.729, 0.0, 2.281, 2.059, 0.879],
        [0.577, 0.0, 2.114, 2.326, 0.864], [0.483, 0.0, 2.003, 2.534, 0.848], [0.419, 0.076, 1.924, 2.704, 0.833],
        [0.373, 0.137, 1.863, 2.847, 0.819], [0.337, 0.184, 1.816, 2.970, 0.807], [0.308, 0.223, 1.777, 3.078, 0.797]];
    for n in 2..=10u32 {
        let k = (n - 2) as usize;
        let (a2, d3c, d4) = (spc_constant_computed(n, 2), spc_constant_computed(n, 3), spc_constant_computed(n, 4));
        // each printed value is the computed one rounded (half a unit in the 3rd decimal, plus integration error)
        for (p, c) in [(nist[k][0], a2), (nist[k][1], d3c), (nist[k][2], d4), (york[k][0], a2), (york[k][1], d3c), (york[k][2], d4)] {
            assert!((p - c).abs() < 0.0011, "n {} printed {} computed {:.5}", n, p, c);
        }
        assert!((york[k][3] - range_d2(n)).abs() < 0.0006, "d2 n {}", n);
        assert!((york[k][4] - range_d3(n)).abs() < 0.0011, "d3 n {} {:.5}", n, range_d3(n));
        assert!((spc_constant_table(n, 2) - nist[k][0]).abs() < 1e-12);
    }
}

/// NIST e-Handbook 6.3.2.2 worked example (flow rate, 10 batches):
/// mean 50.81, MR-bar 1.8778, UCL 55.8041, LCL 45.8159.
#[test] fn individuals_chart_nist_example() {
    let x = [49.6, 47.6, 49.9, 51.3, 47.8, 51.2, 52.6, 52.4, 53.6, 52.1];
    assert!((spc_imr(&x, 1) - 50.81).abs() < 1e-9);
    assert!((spc_imr(&x, 2) - 1.8778).abs() < 1e-4);
    assert!((spc_imr(&x, 3) - 55.8041).abs() < 1e-3);
    assert!((spc_imr(&x, 4) - 45.8159).abs() < 1e-3);
    assert!((spc_imr(&x, 20001) - 2.0).abs() < 1e-9);
    assert!((spc_imr(&x, 5) - 3.267 * 1.87778).abs() < 1e-3);
}

#[test] fn xbar_r_chart() {
    // three subgroups of 4: means 10, 11, 12; ranges 2, 2, 2
    let x = [9.0, 10.0, 11.0, 10.0, 10.0, 11.0, 12.0, 11.0, 11.0, 12.0, 13.0, 12.0, 99.0];
    assert_eq!(spc_xbar_r(&x, 4, 0), 3.0);
    assert!((spc_xbar_r(&x, 4, 1) - 11.0).abs() < 1e-12);
    assert!((spc_xbar_r(&x, 4, 2) - 2.0).abs() < 1e-12);
    assert!((spc_xbar_r(&x, 4, 3) - (11.0 + 0.729 * 2.0)).abs() < 1e-12);
    assert!((spc_xbar_r(&x, 4, 5) - 2.282 * 2.0).abs() < 1e-12);
    assert_eq!(spc_xbar_r(&x, 4, 6), 0.0);
    assert!((spc_xbar_r(&x, 4, 10002) - 12.0).abs() < 1e-12);
    assert!(spc_xbar_r(&x, 11, 1).is_nan());
}

#[test] fn sampling_oc() {
    // c = 0: Pa = (1 - p)^n
    assert!((sampling_pa_binomial(20, 0, 0.05) - 0.95f64.powi(20)).abs() < 1e-12);
    // direct sum for n = 50, c = 2, p = 0.04
    let (n, p) = (50u32, 0.04f64);
    let comb = |n: u32, k: u32| (0..k).fold(1.0, |a, i| a * (n - i) as f64 / (i + 1) as f64);
    let direct: f64 = (0..=2).map(|k| comb(n, k) * p.powi(k as i32) * (1.0 - p).powi((n - k) as i32)).sum();
    assert!((sampling_pa_binomial(n, 2, p) - direct).abs() < 1e-12);
    // Poisson: lambda = 2, c = 2 -> 5 e^-2
    assert!((sampling_pa_poisson(50, 2, 0.04) - 5.0 * (-2.0f64).exp()).abs() < 1e-12);
    assert!((sampling_aoq(50, 2, 0.04, 1000.0) - 0.04 * direct * 0.95).abs() < 1e-12);
    assert_eq!(sampling_pa_binomial(10, 10, 0.5), 1.0);
    assert!(sampling_pa_binomial(10, 1, 1.5).is_nan());
}
