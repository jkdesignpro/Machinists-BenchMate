//! Cutting forces from the specific cutting force (0.3.0): Kienzle's kc,
//! chip thickness with an entering angle or a round insert, drill torque,
//! thrust and power, tap torque, and the deflection of a slender part in
//! the lathe. Sources are in docs/sources.md, "Cutting forces".
//!
//! * [ISC] Iscar, "Materials and grades" table after DIN / ISO 513 and VDI 3323:
//!   kc1.1 is the specific cutting force for a 1 mm^2 chip section, mc the chip
//!   thickness factor.
//! * [SAN] Sandvik Coromant, "Formulas and definitions" for drilling and turning.
//! * [LUB] Lubero, "Calculation formulas: tapping and thread forming".
//! * [YAM] Yamawa, European catalogue YEU21, p. 644 (forming tap torque).
//! * [ISCTI] Iscar, "Machining titanium" user guide 05/2019, eq. 7 and table 19
//!   (feed per tooth = basic feed / sin of the cutting edge angle).
//! * [ROARK] beam formulas, as in the module `mechanics`.

use std::f64::consts::PI;

fn pos(x: f64) -> bool { x > 0.0 && x.is_finite() }

/// Kienzle: specific cutting force at chip thickness `h` (mm):
/// `kc = kc1.1 * h^(-mc)` (N/mm^2). kc1.1 is the value for h = 1 mm and a
/// 1 mm wide chip [ISC]. `mc = 0` returns kc1.1 unchanged (used where a
/// publisher prints no mc).
pub fn kienzle_kc(kc11: f64, mc: f64, h: f64) -> f64 {
    if !(pos(kc11) && pos(h) && mc >= 0.0) { return f64::NAN; }
    kc11 * h.powf(-mc)
}

/// Chip thickness across a straight cutting edge set at the entering angle
/// `kappa_deg` (90 = square shoulder; a 95 degree turning holder gives sin 95 = 0.996):
/// `h = f sin(kappa)`, with `f` the feed
/// per revolution (turning) or per tooth (face milling at full width). [ISCTI]
pub fn lead_chip_thickness(f: f64, kappa_deg: f64) -> f64 {
    if !(pos(f) && kappa_deg > 0.0 && kappa_deg < 180.0) { return f64::NAN; }
    f * kappa_deg.to_radians().sin()
}

/// Feed that gives the chip thickness `h` at the entering angle: `f = h / sin(kappa)`. [ISCTI]
pub fn lead_feed_for_chip(h: f64, kappa_deg: f64) -> f64 {
    if !(pos(h) && kappa_deg > 0.0 && kappa_deg < 180.0) { return f64::NAN; }
    h / kappa_deg.to_radians().sin()
}

/// Largest entering angle on a round insert of diameter `ic` cutting `ap` deep:
/// the edge leaves the work where `cos(kappa) = (ic/2 - ap) / (ic/2)`.
/// 90 degrees once ap reaches the insert radius. (Circle geometry.)
pub fn round_insert_kappa_deg(ic: f64, ap: f64) -> f64 {
    if !(pos(ic) && pos(ap)) { return f64::NAN; }
    let r = ic / 2.0;
    if ap >= r { 90.0 } else { ((r - ap) / r).acos().to_degrees() }
}

/// Largest chip thickness on a round insert: `hex = fz sin(kappa_max)`
/// `= fz sqrt(ic^2 - (ic - 2 ap)^2) / ic` for ap below the insert radius, fz above.
pub fn round_insert_hex(fz: f64, ic: f64, ap: f64) -> f64 {
    let k = round_insert_kappa_deg(ic, ap);
    if !(pos(fz) && k.is_finite()) { return f64::NAN; }
    fz * k.to_radians().sin()
}

/// Feed per tooth that gives `hex` on a round insert at depth `ap`.
pub fn round_insert_fz_for_hex(hex: f64, ic: f64, ap: f64) -> f64 {
    let k = round_insert_kappa_deg(ic, ap);
    if !(pos(hex) && k.is_finite()) { return f64::NAN; }
    hex / k.to_radians().sin()
}

/// Chip thickness on each lip of a two-lip drill: `h = (fn / 2) sin(point / 2)`.
/// The entering angle of a drill lip is half the point angle (140 deg point: 70 deg).
pub fn drill_chip_thickness(fnr: f64, point_deg: f64) -> f64 {
    if !(pos(fnr) && point_deg > 0.0 && point_deg <= 180.0) { return f64::NAN; }
    fnr / 2.0 * (point_deg / 2.0).to_radians().sin()
}

/// Net drilling power (kW): `Pc = vc Dc fn kc / (240 x 10^3)`, vc m/min, mm, mm/rev, N/mm^2. [SAN]
pub fn drill_power_kw(vc: f64, d: f64, fnr: f64, kc: f64) -> f64 {
    if !(pos(vc) && pos(d) && pos(fnr) && pos(kc)) { return f64::NAN; }
    vc * d * fnr * kc / 240_000.0
}

/// Drilling torque (N m): `Mc = Pc 30 x 10^3 / (pi n)` [SAN]; with
/// n = 1000 vc / (pi Dc) this is `Dc^2 fn kc / 8000`, independent of speed.
pub fn drill_torque_nm(d: f64, fnr: f64, kc: f64) -> f64 {
    if !(pos(d) && pos(fnr) && pos(kc)) { return f64::NAN; }
    d * d * fnr * kc / 8000.0
}

/// Drilling feed force (thrust, N): `Ff = 0.5 kc (Dc / 2) fn sin(kr)`, kr = half the point angle. [SAN]
pub fn drill_thrust_n(kc: f64, d: f64, fnr: f64, point_deg: f64) -> f64 {
    if !(pos(d) && pos(fnr) && pos(kc) && point_deg > 0.0 && point_deg <= 180.0) { return f64::NAN; }
    0.5 * kc * d / 2.0 * fnr * (point_deg / 2.0).to_radians().sin()
}

/// Torque of a cutting tap (N m): `Md = kc P^2 d / 8000`, pitch P and nominal
/// diameter d in mm [LUB]. It is the force kc x (thread section, about P^2 / 4)
/// acting at the radius d / 2.
pub fn tap_torque_nm(kc: f64, pitch: f64, d: f64) -> f64 {
    if !(pos(kc) && pos(pitch) && pos(d)) { return f64::NAN; }
    kc * pitch * pitch * d / 8000.0
}

/// Area cut out of the nut by one ISO or Unified 60 degree thread groove, per
/// unit of P^2: a trapezium 5H/8 high, 3P/4 wide at the minor diameter and
/// P/8 wide at the major diameter: (7/16) (5/8) (sqrt 3 / 2) = 0.2368 (trapezium area = mean width x height).
/// The tap torque formula rounds it to 1/4.
pub fn thread_groove_area_factor() -> f64 { 7.0 / 16.0 * 5.0 / 8.0 * 3f64.sqrt() / 2.0 }

/// Torque of a forming (roll) tap (N m): `T = Kf Dc P^2 / 1000`, for a thread
/// 1.5 D long at 75 % thread height [YAM]. Kf is the deforming resistance (N/mm^2).
pub fn form_tap_torque_nm(kf: f64, pitch: f64, d: f64) -> f64 {
    if !(pos(kf) && pos(pitch) && pos(d)) { return f64::NAN; }
    kf * d * pitch * pitch / 1000.0
}

/// Power from torque and speed (kW): `P = 2 pi n M / 60 000` = M n / 9549.3.
pub fn power_from_torque_kw(torque_nm: f64, rpm: f64) -> f64 {
    if !(torque_nm >= 0.0 && pos(rpm)) { return f64::NAN; }
    2.0 * PI * rpm * torque_nm / 60_000.0
}

/// Deflection (mm) of a round part in the lathe under a force `f` (N) applied
/// by the tool at the distance `a` (mm) from the chuck jaws, part length `l`
/// out of the jaws, diameter `d`, bore `di`, E in GPa.
/// `support` 0: held in the chuck only (cantilever), `F a^3 / (3 E I)`;
/// 1: chuck and tailstock centre (fixed at the chuck, simply supported at the
/// centre), `F a^3 b^2 (3 L + b) / (12 L^3 E I)`, b = L - a;
/// 2: between centres (simply supported), `F a^2 b^2 / (3 E I L)`. [ROARK]
/// The chuck is taken as rigid and the centre as unyielding, so a real set-up
/// gives a little more.
pub fn turn_work_deflection(support: f64, f: f64, a: f64, l: f64, d: f64, di: f64, e_gpa: f64) -> f64 {
    if !(pos(l) && pos(d) && pos(e_gpa) && di < d && a >= 0.0 && a <= l && f.is_finite()) { return f64::NAN; }
    let ei = e_gpa * 1000.0 * crate::millturn::second_moment_tube(d, di);
    let b = l - a;
    match support as i32 {
        0 => f * a.powi(3) / (3.0 * ei),
        1 => f * a.powi(3) * b * b * (3.0 * l + b) / (12.0 * l.powi(3) * ei),
        2 => f * a * a * b * b / (3.0 * ei * l),
        _ => f64::NAN,
    }
}

/// Where along the part the tool pushes it away the most, and by how much:
/// `[deflection (mm), distance from the chuck (mm)]`. Chuck only: the free end.
/// Between centres: the middle. Chuck and centre: found by search (0.5858 L,
/// the root of a^2 - 4 L a + 2 L^2 = 0).
pub fn turn_work_deflection_max(support: f64, f: f64, l: f64, d: f64, di: f64, e_gpa: f64) -> [f64; 2] {
    let a = match support as i32 {
        0 => l,
        2 => l / 2.0,
        1 => {
            // golden-section search on [0, L]; the function has one maximum there
            let (mut lo, mut hi) = (0.0, l);
            let g = (5f64.sqrt() - 1.0) / 2.0;
            for _ in 0..80 {
                let x1 = hi - g * (hi - lo);
                let x2 = lo + g * (hi - lo);
                let y1 = turn_work_deflection(1.0, 1.0, x1, l, d, di, e_gpa);
                let y2 = turn_work_deflection(1.0, 1.0, x2, l, d, di, e_gpa);
                if y1 < y2 { lo = x1; } else { hi = x2; }
            }
            (lo + hi) / 2.0
        }
        _ => return [f64::NAN, f64::NAN],
    };
    [turn_work_deflection(support, f, a, l, d, di, e_gpa), a]
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    #[test]
    fn kienzle() {
        // h = 1 mm gives kc1.1 itself; the Iscar group 2 values at 0.2 mm: 1500 x 0.2^-0.22 = 2137.3 (hand, logs)
        assert_eq!(kienzle_kc(1500.0, 0.22, 1.0), 1500.0);
        assert!(close(kienzle_kc(1500.0, 0.22, 0.2), 1500.0 * (0.22f64 * 5f64.ln()).exp(), 1e-9));
        assert!(close(kienzle_kc(1500.0, 0.22, 0.2), 2137.3, 0.1));
        assert_eq!(kienzle_kc(4600.0, 0.0, 0.05), 4600.0);
        assert!(kienzle_kc(1500.0, 0.22, 0.0).is_nan());
    }

    /// A second publisher prints kc against the feed per tooth instead of
    /// kc1.1 and mc (Mitsubishi Materials, cutting power for face milling).
    /// Its rows fall on a power law, as Kienzle's formula says, with
    /// exponents inside the range of mc that Iscar prints (0.20 to 0.30)
    /// or just outside it.
    #[test]
    fn kienzle_shape_against_a_table_by_feed() {
        // (kc at 0.1, 0.2, 0.3, 0.4, 0.6 mm/tooth)
        let rows: [(&str, [f64; 5]); 4] = [
            ("mild steel 520 MPa", [2200.0, 1950.0, 1820.0, 1700.0, 1580.0]),
            ("grey cast iron 200 HB", [1750.0, 1400.0, 1240.0, 1050.0, 970.0]),
            ("brass 500 MPa", [1150.0, 950.0, 800.0, 700.0, 630.0]),
            ("Al-Mg 160 MPa", [580.0, 480.0, 400.0, 350.0, 320.0]),
        ];
        let f = [0.1f64, 0.2, 0.3, 0.4, 0.6];
        for (name, kc) in rows {
            // least-squares slope of ln kc on ln f
            let n = 5.0;
            let (sx, sy) = (f.iter().map(|x| x.ln()).sum::<f64>(), kc.iter().map(|y| y.ln()).sum::<f64>());
            let sxy: f64 = f.iter().zip(kc.iter()).map(|(x, y)| x.ln() * y.ln()).sum();
            let sxx: f64 = f.iter().map(|x| x.ln().powi(2)).sum();
            let slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
            let mc = -slope;
            assert!(mc > 0.15 && mc < 0.40, "{name}: mc {mc}");
            // every printed value within 6 % of the fitted power law
            let ln_k1 = (sy - slope * sx) / n;
            for (x, y) in f.iter().zip(kc.iter()) {
                let fit = (ln_k1 + slope * x.ln()).exp();
                assert!((fit / y - 1.0).abs() < 0.06, "{name} at {x}: {fit} against {y}");
            }
        }
    }

    #[test]
    fn entering_angle_and_round_insert() {
        // Iscar table 19: 1 / sin for 90, 75, 65, 60, 45, 30 degrees = 1, 1.03, 1.1, 1.15, 1.4, 2
        for (k, printed) in [(90.0, 1.0), (75.0, 1.03), (65.0, 1.1), (60.0, 1.15), (45.0, 1.4), (30.0, 2.0)] {
            assert!(close(lead_feed_for_chip(1.0, k), printed, 0.015), "{k}");
        }
        assert!(close(lead_chip_thickness(0.2, 45.0), 0.141421, 1e-6));
        assert!(close(lead_chip_thickness(0.2, 95.0), 0.2 * 85f64.to_radians().sin(), 1e-12));
        assert!(lead_chip_thickness(0.2, 180.0).is_nan());
        // round insert 12 mm, 1.5 mm deep: cos k = 4.5 / 6, k = 41.41 deg; hex = fz sqrt(144 - 81) / 12 = 0.6614 fz
        assert!(close(round_insert_kappa_deg(12.0, 1.5), 41.4096, 1e-3));
        assert!(close(round_insert_hex(0.3, 12.0, 1.5), 0.3 * 63f64.sqrt() / 12.0, 1e-12));
        assert!(close(round_insert_fz_for_hex(0.1, 12.0, 1.5), 0.1 * 12.0 / 63f64.sqrt(), 1e-12));
        // at and above the insert radius the full feed is the chip
        assert_eq!(round_insert_hex(0.3, 12.0, 6.0), 0.3);
        assert_eq!(round_insert_kappa_deg(12.0, 8.0), 90.0);
    }

    #[test]
    fn drilling() {
        // 20 mm drill, 0.3 mm/rev, 100 m/min, kc 2000: Pc = 100 x 20 x 0.3 x 2000 / 240 000 = 5.0 kW
        assert!(close(drill_power_kw(100.0, 20.0, 0.3, 2000.0), 5.0, 1e-12));
        // n = 1591.55 rpm; Mc = 5 x 30 000 / (pi n) = 30.0 N m = 20^2 x 0.3 x 2000 / 8000
        let n = crate::rpm_from_vc(100.0, 20.0);
        assert!(close(drill_torque_nm(20.0, 0.3, 2000.0), 5.0 * 30_000.0 / (PI * n), 1e-9));
        assert!(close(drill_torque_nm(20.0, 0.3, 2000.0), 30.0, 1e-12));
        assert!(close(power_from_torque_kw(30.0, n), 5.0, 1e-9));
        // Ff = 0.5 x 2000 x 10 x 0.3 x sin 70 = 2819.1 N (140 degree point)
        assert!(close(drill_thrust_n(2000.0, 20.0, 0.3, 140.0), 3000.0 * 70f64.to_radians().sin(), 1e-9));
        assert!(close(drill_chip_thickness(0.3, 140.0), 0.15 * 70f64.to_radians().sin(), 1e-12));
        // same order as the one figure Mitsubishi prints (10 mm drill, 0.3 mm/rev: 15 N m, 2500 N; no material given)
        let kc = kienzle_kc(1500.0, 0.22, drill_chip_thickness(0.3, 140.0));
        let (m, t) = (drill_torque_nm(10.0, 0.3, kc), drill_thrust_n(kc, 10.0, 0.3, 140.0));
        assert!(m > 5.0 && m < 20.0 && t > 1000.0 && t < 3500.0, "{m} {t}");
    }

    #[test]
    fn tapping() {
        // M10 x 1.5 in steel, kc 2300 (Lubero's table): 2300 x 2.25 x 10 / 8000 = 6.47 N m
        assert!(close(tap_torque_nm(2300.0, 1.5, 10.0), 6.46875, 1e-9));
        // the 1/4 in the formula is the groove area 0.2368 P^2 rounded up (5 % high)
        assert!(close(thread_groove_area_factor(), 0.236804, 1e-6));
        assert!(close(tap_torque_nm(1.0, 1.0, 1.0), 0.25 / 2.0 / 1000.0, 1e-15));
        // forming tap, M6 x 1, Kf 800: 800 x 6 x 1 / 1000 = 4.8 N m
        assert!(close(form_tap_torque_nm(800.0, 1.0, 6.0), 4.8, 1e-12));
        // power: 6.47 N m at 500 rpm = 0.339 kW
        assert!(close(power_from_torque_kw(6.46875, 500.0), 6.46875 * 500.0 / 9549.2966, 1e-6));
    }

    #[test]
    fn slender_part() {
        // steel bar 20 mm, 200 mm out of the chuck, 100 N at the end: I = 7853.98 mm^4,
        // F L^3 / (3 E I) = 100 x 8e6 / (3 x 210 000 x 7853.98) = 0.16168 mm
        let i = PI * 20f64.powi(4) / 64.0;
        assert!(close(turn_work_deflection(0.0, 100.0, 200.0, 200.0, 20.0, 0.0, 210.0), 100.0 * 8e6 / (3.0 * 210_000.0 * i), 1e-12));
        // between centres, load at the middle: F L^3 / (48 E I)
        assert!(close(turn_work_deflection(2.0, 100.0, 100.0, 200.0, 20.0, 0.0, 210.0), 100.0 * 8e6 / (48.0 * 210_000.0 * i), 1e-12));
        // chuck and centre, load at the middle: 7 F L^3 / (768 E I)
        assert!(close(turn_work_deflection(1.0, 100.0, 100.0, 200.0, 20.0, 0.0, 210.0), 7.0 * 100.0 * 8e6 / (768.0 * 210_000.0 * i), 1e-12));
        // no deflection at a support
        assert_eq!(turn_work_deflection(1.0, 100.0, 200.0, 200.0, 20.0, 0.0, 210.0), 0.0);
        assert_eq!(turn_work_deflection(2.0, 100.0, 0.0, 200.0, 20.0, 0.0, 210.0), 0.0);
        // worst places
        let m = turn_work_deflection_max(0.0, 100.0, 200.0, 20.0, 0.0, 210.0);
        assert_eq!(m[1], 200.0);
        let m = turn_work_deflection_max(2.0, 100.0, 200.0, 20.0, 0.0, 210.0);
        assert_eq!(m[1], 100.0);
        let m = turn_work_deflection_max(1.0, 100.0, 200.0, 20.0, 0.0, 210.0);
        assert!(close(m[1] / 200.0, 2.0 - 2f64.sqrt(), 1e-6), "{}", m[1] / 200.0);
        // the centre cuts the worst deflection to about a fortieth of the chuck-only value
        let c = turn_work_deflection_max(0.0, 100.0, 200.0, 20.0, 0.0, 210.0)[0];
        assert!(c / m[0] > 30.0 && c / m[0] < 40.0, "{}", c / m[0]);
        // a tube is softer
        assert!(turn_work_deflection(0.0, 100.0, 200.0, 200.0, 20.0, 16.0, 210.0) > c);
    }
}
