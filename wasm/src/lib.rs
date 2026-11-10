//! Plain `extern "C"` wrappers so the UI can call the Rust formulas from
//! JavaScript with `WebAssembly.instantiate` and no build tooling.
//! Scalars in, scalar out. Names match `benchmate-core`.
use benchmate_core as c;

macro_rules! f1 { ($n:ident, $p:path, $($a:ident),*) => {
    #[no_mangle] pub extern "C" fn $n($($a: f64),*) -> f64 { $p($($a),*) } } }

f1!(rpm_from_sfm, c::rpm_from_sfm, sfm, dia_in);
f1!(rpm_from_vc, c::rpm_from_vc, vc, dia_mm);
f1!(sfm_from_rpm, c::sfm_from_rpm, rpm, dia_in);
f1!(vc_from_rpm, c::vc_from_rpm, rpm, dia_mm);
f1!(feed_per_tooth, c::feed_per_tooth_f, vf, rpm, teeth);
f1!(table_feed, c::table_feed_f, rpm, fz, teeth);
f1!(mrr_turning_cm3_min, c::mrr_turning_cm3_min, vc, ap, f);
f1!(mrr_turning_in3_min, c::mrr_turning_in3_min, sfm, doc, ipr);
f1!(mrr_milling, c::mrr_milling, ae, ap, vf);
f1!(power_kw, c::power_kw, q, kc, eta);
f1!(rt_theoretical, c::rt_theoretical, feed, r);
f1!(ra_theoretical, c::ra_theoretical, feed, r);
f1!(feed_for_ra, c::feed_for_ra, ra, r);
f1!(pass_time_min, c::pass_time_min, length, feed, rpm);
f1!(taper_included_angle_deg, c::taper_included_angle_deg, large, small, length);
f1!(taper_per_length, c::taper_per_length, large, small, length);
f1!(taper_small_dia, c::taper_small_dia, large, length, deg);
f1!(drill_point_length, c::drill_point_length, dia, angle);
f1!(thread_pitch_dia_basic, c::thread_pitch_dia_basic, major, pitch);
f1!(thread_best_wire, c::thread_best_wire, pitch);
f1!(thread_three_wire_m, c::thread_three_wire_m, e, wire, pitch);

f1!(spindle_power_available_kw, c::spindle_power_available_kw, rpm, p_max, t_max);
f1!(torque_for_power_nm, c::torque_for_power_nm, p, rpm);

/// X of hole `i` (0-based) on a bolt circle.
#[no_mangle] pub extern "C" fn bolt_x(n: f64, dia: f64, start: f64, cx: f64, cy: f64, i: f64) -> f64 {
    c::bolt_circle(n as u32, dia, start, cx, cy)[i as usize].0 }
/// Y of hole `i` (0-based) on a bolt circle.
#[no_mangle] pub extern "C" fn bolt_y(n: f64, dia: f64, start: f64, cx: f64, cy: f64, i: f64) -> f64 {
    c::bolt_circle(n as u32, dia, start, cx, cy)[i as usize].1 }
