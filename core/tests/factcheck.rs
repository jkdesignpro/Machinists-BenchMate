//! 0.8.0 fact check: core formulas against values worked by hand from the textbook formula, or printed
//! in a standard. Each expected value is a literal, so a change to a formula in the core cannot also
//! change what it is checked against. See docs/factcheck.md.
use benchmate_core as c;

fn near(name: &str, got: f64, exp: f64, rel: f64) {
    assert!((got - exp).abs() <= rel * exp.abs().max(1.0), "{name}: got {got}, expected {exp}");
}

#[test]
fn speeds_and_feeds() {
    // n = 1000 vc / (pi D): 100 m/min on 10 mm.
    near("rpm_from_vc", c::rpm_from_vc(100.0, 10.0), 3183.0988618, 1e-9);
    // n = 12 SFM / (pi D): 300 SFM on 0.5 in.
    near("rpm_from_sfm", c::rpm_from_sfm(300.0, 0.5), 2291.8311805, 1e-9);
    // SFM = pi D n / 12: 2000 rpm on 0.5 in.
    near("sfm_from_rpm", c::sfm_from_rpm(2000.0, 0.5), 261.79938780, 1e-9);
    // fz = vf / (n z): 1000 mm/min, 5000 rpm, 4 teeth.
    near("feed_per_tooth_f", c::feed_per_tooth_f(1000.0, 5000.0, 4.0), 0.05, 1e-12);
    // hex = fz sqrt(1 - (1 - 2 ae/D)^2): fz 0.1, ae 1, D 10.
    near("chip_thickness_max", c::chip_thickness_max(0.1, 1.0, 10.0), 0.06, 1e-9);
    // Q = ae ap vf: 10 x 5 x 1000 = 50 000 mm3/min.
    near("mrr_milling", c::mrr_milling(10.0, 5.0, 1000.0), 50000.0, 1e-12);
    // T = P / omega: 5 kW at 1000 rpm.
    near("torque_for_power_nm", c::torque_for_power_nm(5.0, 1000.0), 47.746482928, 1e-9);
}

#[test]
fn milling_geometry() {
    // h = R - sqrt(R^2 - (s/2)^2): R 5, step 1.
    near("cusp_height", c::cusp_height(5.0, 1.0), 0.025062818, 1e-7);
    // De = 2 sqrt(ap (D - ap)): D 10, ap 1 = 2 x 3 = 6.
    near("ball_eff_dia", c::ball_eff_dia(10.0, 1.0, 0.0), 6.0, 1e-12);
    // pitch = pi Dp tan(ramp): path 20, 3 degrees.
    near("helix_pitch", c::helix_pitch(20.0, 3.0), 3.2928779, 1e-7);
    // Six holes on 100: the second hole is at 60 degrees, X = 50 cos 60 = 25.
    let h = c::bolt_circle(6, 100.0, 0.0, 0.0, 0.0);
    near("bolt_circle x", h[1].0, 25.0, 1e-12);
}

#[test]
fn turning_and_drilling() {
    // f = sqrt(32 r Ra): Ra 1.6 um (0.0016 mm), r 0.8 mm. Ra in mm, as the tool page passes it.
    near("feed_for_ra", c::feed_for_ra(0.0016, 0.8), 0.20238577, 1e-7);
    // L = (D/2) / tan(a/2): D 10, 118 degrees.
    near("drill_point_length", c::drill_point_length(10.0, 118.0), 3.0043031, 1e-7);
    // t = L / (f n): (20 + 3) / (0.2 x 1000).
    near("drill_time_min", c::drill_time_min(20.0, 3.0, 0.2, 1000.0), 0.115, 1e-12);
    // S = (D - d)/2 x L/l: (1 - 0.5)/2 x 8/4.
    near("taper_tailstock_setover", c::taper_tailstock_setover(1.0, 0.5, 4.0, 8.0), 0.5, 1e-12);
}

#[test]
fn inspection_trig() {
    // H = L sin(a): 5 in bar, 30 degrees.
    near("sine_bar_height", c::sine_bar_height(5.0, 30.0), 2.5, 1e-12);
    near("sine_bar_angle", c::sine_bar_angle(5.0, 2.5), 30.0, 1e-12);
}

#[test]
fn threads() {
    // ISO 724 prints M10 x 1.5: d2 9.026, D1 8.376.
    near("thread_basic_pitch_dia", c::thread_basic_pitch_dia(10.0, 1.5), 9.026, 1e-4);
    near("thread_basic_minor_dia", c::thread_basic_minor_dia(10.0, 1.5), 8.376, 1e-4);
    // H = sqrt(3)/2 P.
    near("thread_fundamental_h", c::thread_fundamental_h(1.5), 1.2990381, 1e-7);
    // Best wire w = P / (2 cos 30).
    near("thread_best_wire", c::thread_best_wire(1.5), 0.8660254, 1e-7);
    // M = E - 0.866025 P + 3 W: 9.026 - 1.2990375 + 2.598.
    near("thread_three_wire_m", c::thread_three_wire_m(9.026, 0.866, 1.5), 10.3249625, 1e-5);
    // Tap drill for cut threads: D - 0.01299 x % x P = 10 - 1.461375.
    near("tap_drill_cut", c::tap_drill_cut(10.0, 1.5, 75.0), 8.538625, 2e-4);
}
