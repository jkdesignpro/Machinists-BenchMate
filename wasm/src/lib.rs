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

// GD&T: internal 1 = hole/slot, 0 = pin/boss; mc 0 RFS, 1 MMC, 2 LMC.
f1!(gdt_mmc_size, c::mmc_size_f, lower, upper, internal);
f1!(gdt_lmc_size, c::lmc_size_f, lower, upper, internal);
f1!(gdt_bonus, c::bonus_tolerance_f, lower, upper, actual, internal, mc);
f1!(gdt_total_tol, c::total_tolerance_f, geo, lower, upper, actual, internal, mc);
f1!(gdt_virtual_condition, c::virtual_condition_f, lower, upper, geo, internal, mc);
f1!(gdt_resultant_condition, c::resultant_condition_f, lower, upper, geo, internal, mc);
f1!(gdt_true_position, c::true_position_dia, dx, dy);
f1!(gdt_true_position_3d, c::true_position_dia_3d, dx, dy, dz);
f1!(gdt_pos_from_pm, c::position_dia_from_plus_minus, tx, ty);
f1!(gdt_pm_from_pos, c::plus_minus_from_position_dia, dia);
f1!(gdt_floating_tol, c::floating_fastener_tol, hole, fastener);
f1!(gdt_fixed_tol, c::fixed_fastener_tol, hole, fastener);
f1!(gdt_fixed_tol_other, c::fixed_fastener_tol_other, hole, fastener, t_fixed);
f1!(gdt_floating_hole, c::floating_fastener_hole, fastener, tol);
f1!(gdt_fixed_hole, c::fixed_fastener_hole, fastener, t1, t2);

/// One-dimensional tolerance stack of up to 10 dimensions, each passed as
/// (nominal, plus, minus, dir); `out` as in `tolerance_stack_flat`.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn gdt_stack(n0: f64, p0: f64, m0: f64, d0: f64, n1: f64, p1: f64, m1: f64, d1: f64, n2: f64, p2: f64, m2: f64, d2: f64, n3: f64, p3: f64, m3: f64, d3: f64, n4: f64, p4: f64, m4: f64, d4: f64, n5: f64, p5: f64, m5: f64, d5: f64, n6: f64, p6: f64, m6: f64, d6: f64, n7: f64, p7: f64, m7: f64, d7: f64, n8: f64, p8: f64, m8: f64, d8: f64, n9: f64, p9: f64, m9: f64, d9: f64, out: f64) -> f64 {
    c::tolerance_stack_flat(&[n0, p0, m0, d0, n1, p1, m1, d1, n2, p2, m2, d2, n3, p3, m3, d3, n4, p4, m4, d4, n5, p5, m5, d5, n6, p6, m6, d6, n7, p7, m7, d7, n8, p8, m8, d8, n9, p9, m9, d9], out as u32) }

/// X of hole `i` (0-based) on a bolt circle.
#[no_mangle] pub extern "C" fn bolt_x(n: f64, dia: f64, start: f64, cx: f64, cy: f64, i: f64) -> f64 {
    c::bolt_circle(n as u32, dia, start, cx, cy)[i as usize].0 }
/// Y of hole `i` (0-based) on a bolt circle.
#[no_mangle] pub extern "C" fn bolt_y(n: f64, dia: f64, start: f64, cx: f64, cy: f64, i: f64) -> f64 {
    c::bolt_circle(n as u32, dia, start, cx, cy)[i as usize].1 }
