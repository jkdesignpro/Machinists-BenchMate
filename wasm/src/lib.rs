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
f1!(arc_feed_internal, c::arc_feed_internal, fe, part_r, tool_r);
f1!(arc_feed_external, c::arc_feed_external, fe, part_r, tool_r);
f1!(helix_path_dia_internal, c::helix_path_dia_internal, hole, tool);
f1!(helix_path_dia_external, c::helix_path_dia_external, boss, tool);
f1!(helix_pitch, c::helix_pitch, path_dia, deg);
f1!(helix_ramp_deg, c::helix_ramp_deg, path_dia, pitch);
f1!(helix_axial_feed_plane, c::helix_axial_feed_plane, vf, deg);
f1!(helix_axial_feed_path, c::helix_axial_feed_path, vf, deg);
f1!(bar_section_area, c::bar_section_area_f, shape, size);
f1!(bar_length_per_part, c::bar_length_per_part, part, cutoff, facing);
f1!(bar_parts_per_bar, c::bar_parts_per_bar, bar, part, cutoff, facing, remnant, start);
f1!(bar_scrap_len, c::bar_scrap_len, bar, parts, per_part);
f1!(taylor_life, c::taylor_life, v, n, c);
f1!(taylor_speed, c::taylor_speed, t, n, c);
f1!(cost_per_part, c::cost_per_part, cycle, rate, tool, cut, life, material);
f1!(economic_tool_life, c::economic_tool_life, n, tool, rate, change);
f1!(max_production_tool_life, c::max_production_tool_life, n, change);
f1!(second_moment_round, c::second_moment_round, d);
f1!(tool_deflection_mm, c::tool_deflection_mm, f, stickout, flute, d_shank, d_flute, e_gpa);
f1!(tangential_force_n, c::tangential_force_n, pc, vc);
f1!(engagement_angle_deg, c::engagement_angle_deg, ae, d);
f1!(chip_thickness_max, c::chip_thickness_max, fz, ae, d);
f1!(chip_thickness_mean, c::chip_thickness_mean, fz, ae, d);
f1!(cut_check, c::cut_check_f, d, d_shank, stickout, flute_len, flute_factor, e_gpa, z, ae, ap, fz, vc, kc, eta, ratio, f_direct, defl_limit, p_max, t_max, out);
f1!(cut_optimise, c::cut_optimise_f, d, d_shank, stickout, flute_len, flute_factor, e_gpa, z, ae, ap, fz, vc, kc, eta, ratio, f_direct, defl_limit, p_max, t_max, vary_ae, out);

/// X of hole `i` (0-based) on a bolt circle.
#[no_mangle] pub extern "C" fn bolt_x(n: f64, dia: f64, start: f64, cx: f64, cy: f64, i: f64) -> f64 {
    c::bolt_circle(n as u32, dia, start, cx, cy)[i as usize].0 }
/// Y of hole `i` (0-based) on a bolt circle.
#[no_mangle] pub extern "C" fn bolt_y(n: f64, dia: f64, start: f64, cx: f64, cy: f64, i: f64) -> f64 {
    c::bolt_circle(n as u32, dia, start, cx, cy)[i as usize].1 }

// Threads and tapping (core/src/threads.rs)
f1!(thread_fundamental_h, c::thread_fundamental_h, p);
f1!(thread_basic_pitch_dia, c::thread_basic_pitch_dia, d, p);
f1!(thread_basic_minor_dia, c::thread_basic_minor_dia, d, p);
f1!(thread_basic_height, c::thread_basic_height, p);
f1!(thread_iso_d3, c::thread_iso_d3, d, p);
f1!(un_number_major_in, c::un_number_major_in, n);
f1!(tap_drill_cut, c::tap_drill_cut, d, p, pct);
f1!(tap_pct_cut, c::tap_pct_cut, d, p, drill);
f1!(tap_drill_form, c::tap_drill_form, d, p, pct);
f1!(tap_pct_form, c::tap_pct_form, d, p, hole);
f1!(iso965_limit, c::iso965_limit_f, d, p, grade, pos, which);
f1!(iso965_value, c::iso965_value_f, d, p, grade, what);
f1!(un_limit, c::un_limit_f, d, p, class, which);

// ISO limits and fits (core/src/fits.rs)
f1!(iso286_step_mean, c::iso286_step_mean, lo, hi);
f1!(iso286_it_formula, c::iso286_it_formula_f, d_mean, grade);
f1!(iso286_shaft_limit, c::iso286_shaft_limit_f, letter, grade, fd, it, which);
f1!(iso286_hole_limit, c::iso286_hole_limit_f, letter, grade, shaft_fd, it_n, it_n1, lo, hi, which);
f1!(iso286_fit, c::iso286_fit_f, hole_es, hole_ei, shaft_es, shaft_ei, which);
f1!(iso286_shaft_fd_formula, c::iso286_shaft_fd_formula_f, letter, d, it6, it7, it8, it9, it10);
