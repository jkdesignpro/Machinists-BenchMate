//! Unit converter. Every factor converts one unit to the SI unit of its
//! quantity and is built only from exact definitions given in NIST Special
//! Publication 811 (2008 edition), Appendix B: international inch and foot,
//! international avoirdupois pound, standard acceleration of gravity
//! 9.80665 m/s^2, US gallon of 231 in^3, UK gallon 4.54609 L, thermochemical
//! and International Table calorie, IT British thermal unit, standard
//! atmosphere, horsepower of 550 ft lbf/s. Conventional mmHg and inHg use
//! the conventional mercury density 13.5951 g/cm^3 with gn (see docs/sources.md).
//! `exact` is false only where SP 811 marks the value as not exact.

use std::f64::consts::PI;

/// A unit: symbol, name, factor to the SI unit of its quantity, offset
/// (temperature only: SI = (x + offset) x factor), exact by definition.
pub struct Unit { pub sym: &'static str, pub name: &'static str, pub k: f64, pub off: f64, pub exact: bool }

const IN: f64 = 0.0254;
const FT: f64 = 0.3048;
const LB: f64 = 0.453_592_37;
const GN: f64 = 9.806_65;
const LBF: f64 = LB * GN; // 4.448 221 615 260 5 N
const GAL: f64 = 231.0 * IN * IN * IN; // 3.785 411 784 L
const BTU: f64 = 1055.055_852_62; // IT Btu (SP 811 B.8, exact)
const MMHG: f64 = 13_595.1 * GN * 0.001; // conventional, 133.322 387 415 Pa
const HP: f64 = 550.0 * FT * LBF; // 745.699 871 582 270 22 W

macro_rules! u { ($s:expr, $n:expr, $k:expr) => { Unit { sym: $s, name: $n, k: $k, off: 0.0, exact: true } };
                 ($s:expr, $n:expr, $k:expr, conv) => { Unit { sym: $s, name: $n, k: $k, off: 0.0, exact: false } }; }

/// Quantity names, in the order of `units(q)`.
pub const QUANTITIES: [&str; 17] = ["Length", "Area", "Volume", "Mass", "Force", "Torque", "Pressure and stress", "Power", "Energy",
    "Speed", "Feed rate (per minute)", "Feed (per revolution or tooth)", "Temperature", "Temperature difference", "Density", "Flow rate", "Angle"];

/// Units of quantity `q` (index into `QUANTITIES`). The first unit is SI.
pub fn units(q: u32) -> Vec<Unit> {
    match q {
        0 => vec![u!("m", "metre", 1.0), u!("mm", "millimetre", 1e-3), u!("µm", "micrometre (micron)", 1e-6), u!("cm", "centimetre", 1e-2),
            u!("km", "kilometre", 1e3), u!("in", "inch", IN), u!("thou", "thousandth of an inch (mil)", IN / 1000.0), u!("µin", "microinch", IN * 1e-6),
            u!("ft", "foot", FT), u!("yd", "yard", 3.0 * FT), u!("mi", "mile (international)", 5280.0 * FT), u!("nmi", "nautical mile", 1852.0)],
        1 => vec![u!("m²", "square metre", 1.0), u!("mm²", "square millimetre", 1e-6), u!("cm²", "square centimetre", 1e-4),
            u!("in²", "square inch", IN * IN), u!("ft²", "square foot", FT * FT), u!("yd²", "square yard", 9.0 * FT * FT), u!("ha", "hectare", 1e4)],
        2 => vec![u!("m³", "cubic metre", 1.0), u!("L", "litre", 1e-3), u!("mL", "millilitre (cm³)", 1e-6), u!("mm³", "cubic millimetre", 1e-9),
            u!("in³", "cubic inch", IN * IN * IN), u!("ft³", "cubic foot", FT * FT * FT), u!("gal (US)", "US gallon", GAL), u!("qt (US)", "US liquid quart", GAL / 4.0),
            u!("fl oz (US)", "US fluid ounce", GAL / 128.0), u!("gal (UK)", "imperial gallon", 4.546_09e-3), u!("pt (UK)", "imperial pint", 4.546_09e-3 / 8.0)],
        3 => vec![u!("kg", "kilogram", 1.0), u!("g", "gram", 1e-3), u!("t", "tonne (metric ton)", 1e3), u!("lb", "pound (avoirdupois)", LB),
            u!("oz", "ounce (avoirdupois)", LB / 16.0), u!("ton (US)", "short ton (2000 lb)", 2000.0 * LB), u!("ton (UK)", "long ton (2240 lb)", 2240.0 * LB),
            u!("gr", "grain", LB / 7000.0), u!("slug", "slug (lbf s²/ft)", LBF / FT)],
        4 => vec![u!("N", "newton", 1.0), u!("kN", "kilonewton", 1e3), u!("lbf", "pound-force", LBF), u!("kip", "kip (1000 lbf)", 1000.0 * LBF),
            u!("ozf", "ounce-force", LBF / 16.0), u!("kgf", "kilogram-force", GN), u!("tf", "tonne-force", 1000.0 * GN), u!("dyn", "dyne", 1e-5)],
        5 => vec![u!("N·m", "newton metre", 1.0), u!("N·cm", "newton centimetre", 1e-2), u!("kN·m", "kilonewton metre", 1e3),
            u!("lbf·ft", "pound-force foot", LBF * FT), u!("lbf·in", "pound-force inch", LBF * IN), u!("ozf·in", "ounce-force inch", LBF / 16.0 * IN),
            u!("kgf·m", "kilogram-force metre", GN), u!("kgf·cm", "kilogram-force centimetre", GN / 100.0)],
        6 => vec![u!("Pa", "pascal", 1.0), u!("kPa", "kilopascal", 1e3), u!("MPa", "megapascal (N/mm²)", 1e6), u!("GPa", "gigapascal", 1e9),
            u!("bar", "bar", 1e5), u!("mbar", "millibar", 100.0), u!("psi", "pound-force per square inch", LBF / (IN * IN)),
            u!("ksi", "kip per square inch", 1000.0 * LBF / (IN * IN)), u!("Msi", "million psi", 1e6 * LBF / (IN * IN)), u!("atm", "standard atmosphere", 101_325.0),
            u!("kgf/cm²", "kilogram-force per cm² (technical atmosphere)", GN * 1e4), u!("kgf/mm²", "kilogram-force per mm²", GN * 1e6),
            u!("torr", "torr", 101_325.0 / 760.0), u!("mmHg", "millimetre of mercury, conventional", MMHG, conv),
            u!("inHg", "inch of mercury, conventional", MMHG * 25.4, conv), u!("inH₂O", "inch of water, conventional (4 °C)", 1000.0 * GN * IN, conv)],
        7 => vec![u!("W", "watt", 1.0), u!("kW", "kilowatt", 1e3), u!("hp", "horsepower (550 ft·lbf/s)", HP), u!("PS", "metric horsepower", 75.0 * GN),
            u!("ft·lbf/s", "foot pound-force per second", FT * LBF), u!("ft·lbf/min", "foot pound-force per minute", FT * LBF / 60.0),
            u!("Btu/h", "British thermal unit (IT) per hour", BTU / 3600.0), u!("kcal/h", "kilocalorie (IT) per hour", 4186.8 / 3600.0)],
        8 => vec![u!("J", "joule", 1.0), u!("kJ", "kilojoule", 1e3), u!("MJ", "megajoule", 1e6), u!("Wh", "watt hour", 3600.0), u!("kWh", "kilowatt hour", 3.6e6),
            u!("ft·lbf", "foot pound-force", FT * LBF), u!("in·lbf", "inch pound-force", IN * LBF), u!("Btu", "British thermal unit (IT)", BTU),
            u!("cal", "calorie (thermochemical)", 4.184), u!("cal (IT)", "calorie (International Table)", 4.1868), u!("kcal", "kilocalorie (thermochemical)", 4184.0),
            u!("hp·h", "horsepower hour", HP * 3600.0), u!("erg", "erg", 1e-7)],
        9 => vec![u!("m/s", "metre per second", 1.0), u!("m/min", "metre per minute", 1.0 / 60.0), u!("km/h", "kilometre per hour", 1.0 / 3.6),
            u!("ft/min", "foot per minute (SFM)", FT / 60.0), u!("ft/s", "foot per second", FT), u!("in/s", "inch per second", IN),
            u!("mph", "mile per hour", 5280.0 * FT / 3600.0), u!("kn", "knot", 1852.0 / 3600.0)],
        10 => vec![u!("m/s", "metre per second", 1.0), u!("mm/min", "millimetre per minute", 1e-3 / 60.0), u!("m/min", "metre per minute", 1.0 / 60.0),
            u!("mm/s", "millimetre per second", 1e-3), u!("in/min", "inch per minute (IPM)", IN / 60.0), u!("ft/min", "foot per minute", FT / 60.0), u!("in/s", "inch per second", IN)],
        11 => vec![u!("m/rev", "metre per revolution", 1.0), u!("mm/rev", "millimetre per revolution (or tooth)", 1e-3), u!("µm/rev", "micrometre per revolution", 1e-6),
            u!("in/rev", "inch per revolution (or tooth)", IN), u!("thou/rev", "thousandth per revolution", IN / 1000.0)],
        12 => vec![Unit { sym: "K", name: "kelvin", k: 1.0, off: 0.0, exact: true }, Unit { sym: "°C", name: "degree Celsius", k: 1.0, off: 273.15, exact: true },
            Unit { sym: "°F", name: "degree Fahrenheit", k: 5.0 / 9.0, off: 459.67, exact: true }, Unit { sym: "°R", name: "degree Rankine", k: 5.0 / 9.0, off: 0.0, exact: true }],
        13 => vec![u!("K", "kelvin", 1.0), u!("°C", "degree Celsius", 1.0), u!("°F", "degree Fahrenheit", 5.0 / 9.0), u!("°R", "degree Rankine", 5.0 / 9.0)],
        14 => vec![u!("kg/m³", "kilogram per cubic metre", 1.0), u!("g/cm³", "gram per cubic centimetre", 1e3), u!("kg/dm³", "kilogram per litre", 1e3),
            u!("lb/in³", "pound per cubic inch", LB / (IN * IN * IN)), u!("lb/ft³", "pound per cubic foot", LB / (FT * FT * FT)), u!("lb/gal (US)", "pound per US gallon", LB / GAL)],
        15 => vec![u!("m³/s", "cubic metre per second", 1.0), u!("L/min", "litre per minute", 1e-3 / 60.0), u!("L/s", "litre per second", 1e-3),
            u!("m³/h", "cubic metre per hour", 1.0 / 3600.0), u!("gal/min (US)", "US gallon per minute (GPM)", GAL / 60.0),
            u!("gal/min (UK)", "imperial gallon per minute", 4.546_09e-3 / 60.0), u!("ft³/min", "cubic foot per minute (CFM)", FT * FT * FT / 60.0)],
        16 => vec![u!("rad", "radian", 1.0), u!("°", "degree", PI / 180.0), u!("′", "minute of arc", PI / 10_800.0), u!("″", "second of arc", PI / 648_000.0),
            u!("gon", "gon (grad)", PI / 200.0), u!("rev", "revolution", 2.0 * PI), u!("mrad", "milliradian", 1e-3)],
        _ => vec![],
    }
}

/// Convert `x` from unit `from` to unit `to` of quantity `q`.
pub fn convert(q: u32, from: u32, to: u32, x: f64) -> f64 {
    let us = units(q);
    match (us.get(from as usize), us.get(to as usize)) {
        (Some(a), Some(b)) => (x + a.off) * a.k / b.k - b.off,
        _ => f64::NAN,
    }
}

/// The unit list of quantity `q` as text: one line per unit, `symbol|name|exact (1/0)|factor to SI`.
pub fn units_text(q: u32) -> String {
    units(q).iter().map(|u| format!("{}|{}|{}|{:e}", u.sym, u.name, if u.exact { 1 } else { 0 }, u.k)).collect::<Vec<_>>().join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    fn rel(a: f64, b: f64, tol: f64) { assert!(((a - b) / b).abs() <= tol, "{a} vs {b}"); }

    // Factors as printed in NIST SP 811 (2008), Appendix B.8 (7 significant
    // digits there unless marked exact).
    #[test]
    fn nist_factors() {
        rel(units(4)[2].k, 4.448_222, 5e-7);            // lbf -> N
        rel(units(4)[2].k, 4.448_221_615_260_5, 1e-15);  // exact
        rel(units(6)[6].k, 6.894_757e3, 5e-7);           // psi -> Pa
        rel(units(6)[7].k, 6.894_757e6, 5e-7);           // ksi
        rel(units(5)[3].k, 1.355_818, 5e-7);             // lbf ft -> N m
        rel(units(5)[4].k, 1.129_848e-1, 5e-7);          // lbf in
        rel(units(7)[2].k, 7.456_999e2, 5e-7);           // hp (550 ft lbf/s)
        rel(units(7)[6].k, 2.930_711e-1, 5e-7);          // Btu_IT/h
        rel(units(2)[6].k, 3.785_412e-3, 5e-7);          // US gallon
        rel(units(2)[4].k, 1.638_706_4e-5, 1e-15);       // in^3 exact
        rel(units(6)[13].k, 1.333_224e2, 5e-7);          // mmHg
        rel(units(6)[14].k, 3.386_389e3, 5e-7);          // inHg (conventional)
        rel(units(6)[15].k, 2.490_889e2, 1e-6);          // inH2O, conventional
        rel(units(14)[3].k, 2.767_990e4, 5e-7);          // lb/in^3
        rel(units(14)[4].k, 1.601_846e1, 5e-7);          // lb/ft^3
        rel(units(3)[8].k, 1.459_390e1, 5e-7);           // slug
        rel(units(8)[7].k, 1.055_056e3, 5e-7);           // Btu
        rel(units(9)[6].k, 0.447_04, 1e-15);             // mph exact
    }

    #[test]
    fn conversions() {
        rel(convert(0, 5, 1, 1.0), 25.4, 1e-15);
        rel(convert(12, 1, 2, 100.0), 212.0, 1e-12);
        rel(convert(12, 2, 1, -40.0), -40.0, 1e-12);
        rel(convert(12, 1, 0, 20.0), 293.15, 1e-15);
        rel(convert(12, 3, 2, 459.67 + 32.0), 32.0, 1e-12);
        rel(convert(13, 1, 2, 10.0), 18.0, 1e-12);
        rel(convert(6, 2, 7, 1.0), 0.145_037_737_7, 1e-9);  // 1 MPa = 0.1450377 ksi
        rel(convert(9, 3, 2, 1000.0), 18.288, 1e-12);       // 1000 ft/min = 18.288 km/h
        rel(convert(9, 3, 1, 1000.0), 304.8, 1e-12);
        rel(convert(16, 1, 0, 180.0), PI, 1e-15);
        assert!(convert(0, 99, 0, 1.0).is_nan());
        assert_eq!(units_text(12).lines().count(), 4);
        for q in 0..QUANTITIES.len() as u32 { assert!(!units(q).is_empty()); assert_eq!(units(q)[0].k, 1.0); }
    }
}
