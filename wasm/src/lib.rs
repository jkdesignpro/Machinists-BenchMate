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
/// Milling finish: which 0 Rt per tooth, 1 Ra per tooth, 2 Rt per rev, 3 Ra per rev, 4 feed per rev.
#[no_mangle] pub extern "C" fn mill_finish(fz: f64, z: f64, r: f64, which: f64) -> f64 { pick(c::mill_finish(fz, z, r), which) }
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
f1!(share_of, c::share_of, x, limit);
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
f1!(cut_check, c::cut_check_f, d, d_shank, stickout, flute_len, flute_factor, e_gpa, z, ae, ap, fz, vc, kc, eta, ratio, f_direct, defl_limit, p_max, t_max, holder_k, out);
f1!(holder_deflection_mm, c::holder_deflection_mm, f, k);
f1!(stiffness_n_um, c::stiffness_n_um, f, defl);
f1!(tool_and_holder_deflection_mm, c::tool_and_holder_deflection_mm, f, stickout, flute, d_shank, d_flute, e_gpa, k);
f1!(cut_optimise, c::cut_optimise_f, d, d_shank, stickout, flute_len, flute_factor, e_gpa, z, ae, ap, fz, vc, kc, eta, ratio, f_direct, defl_limit, p_max, t_max, holder_k, vary_ae, out);

// GD&T: internal 1 = hole/slot, 0 = pin/boss; mc 0 RFS, 1 MMC, 2 LMC.
f1!(gdt_mmc_size, c::mmc_size_f, lower, upper, internal);
f1!(gdt_lmc_size, c::lmc_size_f, lower, upper, internal);
f1!(gdt_bonus, c::bonus_tolerance_f, lower, upper, actual, internal, mc);
f1!(gdt_total_tol, c::total_tolerance_f, geo, lower, upper, actual, internal, mc);
f1!(gdt_virtual_condition, c::virtual_condition_f, lower, upper, geo, internal, mc);
f1!(gdt_resultant_condition, c::resultant_condition_f, lower, upper, geo, internal, mc);
f1!(gdt_true_position, c::true_position_dia, dx, dy);
f1!(gdt_tp_coords, c::true_position_dia_from_coords, nx, ny, mx, my);
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

f1!(gdt_profile_u_outside, c::profile_unequal_outside, total, u);
f1!(gdt_profile_u_inside, c::profile_unequal_inside, total, u);
f1!(gdt_profile_u_offset, c::profile_unequal_offset, total, u);
f1!(gdt_profile_u_margin, c::profile_unequal_margin, total, u, e);

/// Composite position lower segment for up to 8 holes, each passed as
/// (nominal x, nominal y, measured x, measured y, bonus); `out` as in
/// `composite_frtzf_flat`.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn gdt_composite(x0: f64, y0: f64, dx0: f64, dy0: f64, b0: f64, x1: f64, y1: f64, dx1: f64, dy1: f64, b1: f64, x2: f64, y2: f64, dx2: f64, dy2: f64, b2: f64, x3: f64, y3: f64, dx3: f64, dy3: f64, b3: f64, x4: f64, y4: f64, dx4: f64, dy4: f64, b4: f64, x5: f64, y5: f64, dx5: f64, dy5: f64, b5: f64, x6: f64, y6: f64, dx6: f64, dy6: f64, b6: f64, x7: f64, y7: f64, dx7: f64, dy7: f64, b7: f64, rotate: f64, out: f64) -> f64 {
    c::composite_frtzf_flat(&[x0, y0, dx0, dy0, b0, x1, y1, dx1, dy1, b1, x2, y2, dx2, dy2, b2, x3, y3, dx3, dy3, b3, x4, y4, dx4, dy4, b4, x5, y5, dx5, dy5, b5, x6, y6, dx6, dy6, b6, x7, y7, dx7, dy7, b7], rotate, out as u32) }

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

// Shop helpers (core/src/shop.rs)
/// Shared input buffer for list data (process capability). JS writes up to
/// `BUF_LEN` values at `buf_ptr()` in the exported memory, then calls a
/// function with the count.
const BUF_LEN: usize = 5000;
static mut BUF: [f64; BUF_LEN] = [0.0; BUF_LEN];
#[no_mangle] pub extern "C" fn buf_ptr() -> *mut f64 { core::ptr::addr_of_mut!(BUF) as *mut f64 }
#[no_mangle] pub extern "C" fn buf_len() -> f64 { BUF_LEN as f64 }
fn buf(n: f64) -> &'static [f64] {
    let n = (n.max(0.0) as usize).min(BUF_LEN);
    // SAFETY: single-threaded wasm; the buffer is only read here after JS wrote it.
    unsafe { core::slice::from_raw_parts(core::ptr::addr_of!(BUF) as *const f64, n) }
}
/// Capability results for the first `n` buffer values; `which` as in `capability_flat`.
#[no_mangle] pub extern "C" fn cap_from_buf(n: f64, lsl: f64, usl: f64, subgroup: f64, which: f64) -> f64 {
    c::capability_flat(buf(n), lsl, usl, subgroup.max(1.0) as usize, which as u32) }
/// Indices from a mean and sigma: which 0 Cp, 1 Cpk, 2 Cpl, 3 Cpu, 4 ppm below, 5 ppm above.
#[no_mangle] pub extern "C" fn cap_from_stats(mean: f64, sigma: f64, lsl: f64, usl: f64, which: f64) -> f64 {
    let (cp, cpk, cpl, cpu) = c::cap_indices(mean, sigma, lsl, usl);
    let (lo, hi) = c::cap_ppm(mean, sigma, lsl, usl);
    [cp, cpk, cpl, cpu, lo, hi].get(which as usize).copied().unwrap_or(f64::NAN) }
f1!(normal_pdf, c::normal_pdf, x, mean, sigma);
f1!(temp_length_at_20, c::length_at_20, reading, t_part, t_gauge, a_part, a_gauge);
f1!(temp_reading_for_length, c::reading_for_length, l20, t_part, t_gauge, a_part, a_gauge);
f1!(thermal_growth, c::thermal_growth, length, alpha, dt);
f1!(alpha_uncertainty, c::alpha_uncertainty, length, u_alpha, t);
f1!(coolant_conc, c::coolant_conc, brix, factor);
f1!(coolant_add_concentrate, c::coolant_add_concentrate, vol, c_now, c_target, c_conc);
f1!(coolant_add_water, c::coolant_add_water, vol, c_now, c_target);
f1!(coolant_topup_mix, c::coolant_topup_mix, v_now, c_now, v_full, c_target);
f1!(coolant_concentrate_in, c::coolant_concentrate_in, vol, c, c_conc);
f1!(frac_nearest_num, c::frac_nearest_num, x, den);
f1!(mixed_to_decimal, c::mixed_to_decimal, whole, num, den);
/// Nearest fraction of `x` to 1/`den`: which 0 sign, 1 whole, 2 numerator,
/// 3 denominator (reduced), 4 error (fraction minus x).
#[no_mangle] pub extern "C" fn frac_nearest(x: f64, den: f64, which: f64) -> f64 { pick(c::nearest_fraction(x, den), which) }
#[no_mangle] pub extern "C" fn frac_reduce(num: f64, den: f64, which: f64) -> f64 {
    let (a, b) = c::frac_reduce(num, den); if which == 0.0 { a } else { b } }

// Geometry (core/src/geometry.rs)
f1!(tri_solve, c::solve_triangle_flat, a, b, cc, aa, bb, ccc, sol, which);
f1!(arc_solve, c::arc_solve_flat, mode, x, y, which);
f1!(arc_two, c::arc_two_flat, ka, a, kb, b, sol, which);
f1!(circle_3pts, c::circle_3pts_flat, x1, y1, x2, y2, x3, y3, which);
f1!(sine_bar_height, c::sine_bar_height, l, theta);
f1!(sine_bar_angle, c::sine_bar_angle, l, h);
f1!(bend_allowance, c::bend_allowance, angle, r, k, t);
f1!(outside_setback, c::outside_setback, angle, r, t);
f1!(bend_deduction, c::bend_deduction, angle, r, k, t);
f1!(k_from_bend_allowance, c::k_from_bend_allowance, angle, r, t, ba);
f1!(mass_metric_kg, c::mass_metric_kg, area, len, density);
f1!(dovetail_male_over_pins, c::dovetail_male_over_pins, w, alpha, d);
f1!(dovetail_female_between_pins, c::dovetail_female_between_pins, w, alpha, d);
f1!(dovetail_contact_along_flank, c::dovetail_contact_along_flank, alpha, d);
f1!(vgroove_pin_height, c::vgroove_pin_height, w, beta, d);
f1!(vgroove_contact_margin, c::vgroove_contact_margin, w, beta, d);
#[no_mangle] pub extern "C" fn stock_area(shape: f64, a: f64, b: f64) -> f64 { c::stock_area(shape as u32, a, b) }
#[no_mangle] pub extern "C" fn dovetail_corner_width(top: f64, h: f64, alpha: f64, male: f64) -> f64 { c::dovetail_corner_width(top, h, alpha, male != 0.0) }
/// Fillet in a corner: which 0..6 = t1x, t1y, t2x, t2y, cx, cy, tangent distance.
#[no_mangle] pub extern "C" fn fillet_line_line(px: f64, py: f64, d1: f64, d2: f64, r: f64, which: f64) -> f64 {
    c::fillet_line_line(px, py, d1, d2, r).get(which as usize).copied().unwrap_or(f64::NAN) }
/// Line-circle fillet: which 9 = number of solutions, else solution `sol` value 0..5.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn fillet_line_circle(x1: f64, y1: f64, x2: f64, y2: f64, cx: f64, cy: f64, rr: f64, r: f64, outside: f64, side: f64, sol: f64, which: f64) -> f64 {
    let v = c::fillet_line_circle(x1, y1, x2, y2, cx, cy, rr, r, outside != 0.0, side);
    if which as i32 == 9 { return v.len() as f64; }
    v.get(sol as usize).and_then(|s| s.get(which as usize)).copied().unwrap_or(f64::NAN) }

// Lists passed through the shared buffer: results kept until the next call.
static mut LIST_OUT: Vec<f64> = Vec::new();
fn set_out(v: Vec<f64>) -> f64 { let n = v.len(); unsafe { *core::ptr::addr_of_mut!(LIST_OUT) = v; } n as f64 }
/// Value `i` of the last list result.
#[no_mangle] pub extern "C" fn list_out(i: f64) -> f64 {
    // SAFETY: single-threaded wasm; LIST_OUT is only replaced by set_out.
    let v: &Vec<f64> = unsafe { &*core::ptr::addr_of!(LIST_OUT) };
    v.get(i as usize).copied().unwrap_or(f64::NAN) }
/// Fewest-block gauge stack from the first `n` buffer values (block sizes).
/// Returns the number of blocks (NaN if none); `list_out(i)` gives the sizes.
#[no_mangle] pub extern "C" fn gauge_stack(n: f64, target: f64, unit: f64) -> f64 {
    let blocks = buf(n).to_vec();
    match c::gauge_stack(&blocks, target, unit) { Some(ix) => set_out(ix.iter().map(|i| blocks[*i]).collect()), None => { set_out(vec![]); f64::NAN } } }
fn ints(v: &[f64]) -> Vec<u64> { v.iter().filter(|x| **x >= 1.0).map(|x| x.round() as u64).collect() }
/// Indexing with hole circles in the buffer (first `n` values). mode 0: N
/// divisions; mode 1: angle deg/min/sec. Returns the count of workable
/// circles; `list_out(3i..3i+2)` = whole turns, holes, circle.
#[no_mangle] pub extern "C" fn index_plates(n: f64, ratio: f64, mode: f64, a: f64, m: f64, s: f64) -> f64 {
    let circles = ints(buf(n));
    let r = ratio.round().max(0.0) as u64;
    let v = if mode == 0.0 { c::index_simple(r, a.round().max(0.0) as u64, &circles) } else { c::index_angle(r, a.max(0.0) as u64, m.max(0.0) as u64, s.max(0.0) as u64, &circles) };
    let k = v.len(); set_out(v.iter().flat_map(|t| [t.0 as f64, t.1 as f64, t.2 as f64]).collect()); k as f64 }
/// Differential indexing: buffer holds `nc` circles then `ng` gears.
/// Returns 1 if found: list_out = [A', turns, holes, circle, gear ratio, same direction (1/0), gear count, gears...].
#[no_mangle] pub extern "C" fn index_differential(nc: f64, ng: f64, ratio: f64, divisions: f64, max_off: f64) -> f64 {
    let all = buf(nc + ng);
    let circles = ints(&all[..(nc as usize).min(all.len())]);
    let gears = ints(&all[(nc as usize).min(all.len())..]);
    match c::index_differential(ratio.round() as u64, divisions.round() as u64, &circles, &gears, max_off.max(1.0) as u64) {
        Some(d) => { let mut v = vec![d.approx as f64, d.crank.0 as f64, d.crank.1 as f64, d.crank.2 as f64, d.gear_ratio, if d.same_direction { 1.0 } else { 0.0 }, d.gears.len() as f64];
            v.extend(d.gears.iter().map(|g| *g as f64)); set_out(v); 1.0 }
        None => { set_out(vec![]); 0.0 } } }
// Other thread forms (core/src/thread_forms.rs)
f1!(whitworth_value, c::whitworth_value_f, d, p, what);
f1!(ba_value, c::ba_value_f, n, what);
f1!(pitch_tpi, c::pitch_tpi, x);
/// Thread identifier: which 0 diameter difference, 1 pitch difference (fraction), 2 score (NaN = not a candidate).
#[no_mangle] pub extern "C" fn thread_match(d_meas: f64, p_meas: f64, d_ref: f64, p_nom: f64, which: f64) -> f64 { pick(c::thread_match(d_meas, p_meas, d_ref, p_nom), which) }
f1!(npt_value, c::npt_value_f, d, p, l1, what);
f1!(round_sig, c::round_sig_f, x, sig);
// Threads round 3 (core/src/power_threads.rs)
f1!(acme_limit, c::acme_limit_f, d, p, class, internal, which);
f1!(stub_acme_limit, c::stub_acme_limit_f, d, p, internal, which);
f1!(trap_value, c::trap_value_f, d, p, what);
f1!(sti_value, c::sti_value_f, d, p, what);
f1!(unj_value, c::unj_value_f, d, p, class, what);
f1!(buttress_value, c::buttress_value_f, d, p, what);
f1!(unm_value, c::unm_value_f, d, p, what);
f1!(thread_misc, c::thread_misc_f, a, b, what);
f1!(wire_measurement, c::wire_measurement_f, x, w, p, angle, inverse);

// Cycle generators (core/src/cycles.rs, core/src/gcode.rs)
f1!(css_rpm, c::css_rpm_f, v, dia, max_rpm, metric);
f1!(css_plunge_time_min, c::css_plunge_time_min_f, d0, d1, f_rev, v, max_rpm, metric);
f1!(thread_mill_path_radius, c::thread_mill_path_radius_f, cut_dia, tool_dia, internal);
f1!(thread_mill_centre_feed, c::thread_mill_centre_feed_f, edge_feed, cut_dia, tool_dia, internal);
f1!(helix_path_feed, c::helix_path_feed, f_plane, r, pitch);
f1!(helix_lead_angle_deg, c::helix_lead_angle_deg, r, pitch);
f1!(thread_depth_external, c::thread_depth_external, p);
f1!(thread_depth_internal, c::thread_depth_internal, p);
f1!(tap_feed, c::tap_feed, pitch, rpm);
/// Infeed table into list_out (cumulative depths). mode 0: by first cut
/// (a = first, b = min cut); 1: by passes (a = passes, b = first-pass
/// factor); 2: constant depth (a = step); 3: custom (buffer holds `a` steps).
#[no_mangle] pub extern "C" fn infeed(mode: f64, total: f64, a: f64, b: f64, finish: f64) -> f64 {
    let v = match mode as i32 {
        0 => c::infeed_by_first_cut(total, a, b, finish),
        1 => c::infeed_by_passes(total, a.max(0.0) as u32, b, finish),
        2 => c::infeed_constant_depth(total, a, finish),
        _ => c::infeed_custom(buf(a)),
    };
    set_out(v) }
/// Rectangular grid (zigzag order) into list_out as x0, y0, x1, y1, ...; returns the hole count.
#[no_mangle] pub extern "C" fn pattern_grid(x0: f64, y0: f64, nx: f64, ny: f64, dx: f64, dy: f64) -> f64 {
    let v = c::gcode::pattern_grid(x0, y0, nx.clamp(0.0, 1000.0) as u32, ny.clamp(0.0, 1000.0) as u32, dx, dy);
    set_out(v.iter().flat_map(|p| [p.0, p.1]).collect()) / 2.0 }

static mut STR: String = String::new();
fn set_str(s: &str) -> f64 { unsafe { *core::ptr::addr_of_mut!(STR) = s.to_string(); } s.len() as f64 }
/// Pointer to the last text result (UTF-8; the call that made it returns the length).
#[no_mangle] pub extern "C" fn str_ptr() -> *const u8 { unsafe { (*core::ptr::addr_of!(STR)).as_ptr() } }
static mut PROG: Option<c::gcode::Program> = None;
fn prog() -> Option<&'static c::gcode::Program> { unsafe { (*core::ptr::addr_of!(PROG)).as_ref() } }
/// Whether a control (0 generic, 1 Haas, 2 Mitsubishi, 3 Siemens, 4 Heidenhain, 5 Okuma) has a generator for a cycle.
#[no_mangle] pub extern "C" fn cyc_supported(ctrl: f64, cycle: f64) -> f64 { if c::gcode::supported(c::gcode::Ctrl::from_f(ctrl), cycle as u32) { 1.0 } else { 0.0 } }
/// Generate a program from the first `n` buffer values (layout in
/// `gcode::run_flat`). Returns 1 if a program was made, 0 on error.
#[no_mangle] pub extern "C" fn cyc_run(cycle: f64, n: f64) -> f64 {
    let p = c::gcode::run_flat(cycle as u32, buf(n));
    let ok = p.error.is_none();
    unsafe { *core::ptr::addr_of_mut!(PROG) = Some(p); }
    if ok { 1.0 } else { 0.0 } }
/// Put text into the string buffer: 0 program, 1 error, 2 warnings (one per line). Returns the length.
#[no_mangle] pub extern "C" fn cyc_text(which: f64) -> f64 {
    match prog() { None => set_str(""), Some(p) => match which as i32 {
        0 => set_str(&p.text), 1 => set_str(p.error.as_deref().unwrap_or("")), _ => set_str(&p.warnings.join("\n")) } } }
/// Number of moves of the last program.
#[no_mangle] pub extern "C" fn cyc_moves() -> f64 { prog().map(|p| p.moves.len() as f64).unwrap_or(0.0) }
/// Move `i` field: 0 kind, 1 x, 2 y, 3 z, 4 cx, 5 cy, 6 feed/min, 7 seconds.
#[no_mangle] pub extern "C" fn cyc_move(i: f64, f: f64) -> f64 {
    prog().and_then(|p| p.moves.get(i as usize)).map(|m| [m.kind as f64, m.x, m.y, m.z, m.cx, m.cy, m.f, m.t].get(f as usize).copied().unwrap_or(f64::NAN)).unwrap_or(f64::NAN) }
/// Program info: 0 max rpm, 1 max feed per min, 2 start x, 3 start y, 4 start z, 5 table length.
#[no_mangle] pub extern "C" fn cyc_info(which: f64) -> f64 {
    prog().map(|p| [p.max_rpm, p.max_feed, p.start[0], p.start[1], p.start[2], p.table.len() as f64].get(which as usize).copied().unwrap_or(f64::NAN)).unwrap_or(f64::NAN) }
#[no_mangle] pub extern "C" fn cyc_table(i: f64) -> f64 { prog().and_then(|p| p.table.get(i as usize).copied()).unwrap_or(f64::NAN) }
/// Times in seconds with rapids at `rapid` per minute: 0 feed, 1 rapid, 2 dwell.
#[no_mangle] pub extern "C" fn cyc_time(rapid: f64, which: f64) -> f64 {
    prog().map(|p| { let t = p.time(rapid); [t.0, t.1, t.2].get(which as usize).copied().unwrap_or(f64::NAN) }).unwrap_or(f64::NAN) }
/// CSV of the hole list in the buffer (first 2n values); returns the length.
#[no_mangle] pub extern "C" fn holes_csv(n: f64, metric: f64) -> f64 {
    let v = buf(2.0 * n); let h: Vec<(f64, f64)> = v.chunks(2).filter(|c| c.len() == 2).map(|c| (c[0], c[1])).collect();
    set_str(&c::gcode::holes_csv(&h, metric != 0.0)) }
// CAD / DXF (core/src/cad.rs, core/src/dxf.rs)
static mut TEXT: Vec<u8> = Vec::new();
fn set_text(s: String) -> f64 { let n = s.len(); unsafe { *core::ptr::addr_of_mut!(TEXT) = s.into_bytes(); } n as f64 }
/// Address of the last text result (UTF-8, length returned by the call that made it).
#[no_mangle] pub extern "C" fn text_ptr() -> *const u8 {
    // SAFETY: single-threaded wasm; TEXT is only replaced by set_text.
    unsafe { (*core::ptr::addr_of!(TEXT)).as_ptr() } }
/// Build shape `shape` (see `cad::shape`) from the first `n` buffer values.
/// On success returns the DXF text length (text at `text_ptr`) and puts the
/// drawing in `list_out` (`Drawing::flatten`). On bad input returns minus the
/// length of an error message held at `text_ptr`.
#[no_mangle] pub extern "C" fn dxf_build(shape: f64, n: f64, inch: f64, r12: f64, marks: f64, lower_left: f64) -> f64 {
    let p = buf(n).to_vec();
    match c::cad::build(shape as u32, &p, marks != 0.0) {
        Ok(mut d) => {
            if lower_left != 0.0 { d.origin_lower_left(); }
            set_out(d.flatten());
            let u = if inch != 0.0 { c::dxf::Units::Inch } else { c::dxf::Units::Mm };
            let v = if r12 != 0.0 { c::dxf::Version::R12 } else { c::dxf::Version::R2000 };
            set_text(c::dxf::write_dxf(&d, u, v))
        }
        Err(e) => { set_out(vec![]); -set_text(e) }
    } }
f1!(polygon_dims, c::cad::polygon_dims, n, size, corners, which);
// Tooling (core/src/tooling.rs)
f1!(insert_edge_length, c::insert_edge_length, d, a1, a2);
f1!(insert_edge_length_shape, c::insert_edge_length_f, d, letter_code);
f1!(insert_size_code, c::insert_size_code, edge_len);
f1!(knurl_blank_dia_cp, c::knurl_blank_dia_cp, p, n);
f1!(knurl_blank_dia_dp, c::knurl_blank_dia_dp, dp, n);
f1!(knurl_teeth_cp, c::knurl_teeth_cp, d, p);
f1!(knurl_teeth_dp, c::knurl_teeth_dp, d, dp);
f1!(lerp, c::lerp, x, x0, y0, x1, y1);
f1!(knurl_dp_to_cp, c::knurl_dp_to_cp, dp);
f1!(knurl_blank_dia, c::knurl_blank_dia, p_normal, n, helix_deg);
f1!(knurl_teeth_exact, c::knurl_teeth_exact, d, p_normal, helix_deg);
f1!(profile_rz_over_ra, c::profile_rz_over_ra, kind);
f1!(profile_rq_over_ra, c::profile_rq_over_ra, kind);
f1!(rq_ra_convert, c::rq_ra_convert, x, kind, inverse);
f1!(tap_h_limit, c::tap_h_limit, basic, n, major, which);
f1!(tap_l_limit_min, c::tap_l_limit_min, basic, n);
f1!(tap_d_limit, c::tap_d_limit, basic, n, step, sign);
f1!(tap_limit_for_fraction, c::tap_limit_for_fraction, basic, pd_min, pd_max, frac, step);
f1!(saw_teeth_in_cut, c::saw_teeth_in_cut, len, tpi);
f1!(saw_min_tpi, c::saw_min_tpi, thin, teeth);

// Fasteners and machine elements (core/src/fasteners.rs)
f1!(stress_area, c::stress_area_f, d, p, system);
f1!(stress_dia, c::stress_dia_f, d, p, system);
f1!(bearing_mean_dia, c::bearing_mean_dia, dw, dh);
f1!(tightening_torque, c::tightening_torque, f, p, d2, mu_g, dkm, mu_k);
f1!(tightening_torque_part, c::tightening_torque_part, f, p, d2, mu_g, dkm, mu_k, part);
f1!(preload_from_torque, c::preload_from_torque, t, p, d2, mu_g, dkm, mu_k);
f1!(assembly_equiv_stress, c::assembly_equiv_stress, f, as_, d0, p, d2, mu_g);
f1!(preload_permitted, c::preload_permitted, as_, d0, d2, p, mu_g, nu, rp02);
f1!(preload_from_proof, c::preload_from_proof, as_, sp, pct);
f1!(nut_factor, c::nut_factor, t, f, d);
f1!(oring_squeeze_pct, c::oring_squeeze_pct, cs, depth);
f1!(oring_stretch_pct, c::oring_stretch_pct, id, seat);
f1!(oring_cs_stretched, c::oring_cs_stretched, cs, id, seat);
f1!(oring_fill_pct, c::oring_fill_pct, cs, ring_dm, w, h, groove_dm);
f1!(oring_depth_for_squeeze, c::oring_depth_for_squeeze, cs, squeeze);
f1!(oring_width_for_fill, c::oring_width_for_fill, cs, h, fill);
f1!(bearing_l10, c::bearing_l10, c, p, roller);
f1!(bearing_l10h, c::bearing_l10h, c, p, roller, rpm);
f1!(bearing_c_required, c::bearing_c_required, p, roller, rpm, hours);
f1!(bearing_equiv_load, c::bearing_equiv_load, x, fr, y, fa);
f1!(keyseat_shaft_dim, c::keyseat_shaft_dim, d, t1);
f1!(keyway_hub_dim, c::keyway_hub_dim, d, t2);
f1!(keyseat_chordal_height, c::keyseat_chordal_height, d, b);
// Small milling and turning calculators (core/src/millturn.rs)
f1!(mt_engagement_deg, c::engagement_deg_f, ae, d);
f1!(rctf, c::rctf, ae, d);
f1!(hex_for_engagement, c::hex_for_engagement, fz, phi_rad);
f1!(engagement_arc_deg, c::engagement_arc_deg_f, ae, d, r_wall, inside);
f1!(cusp_height, c::cusp_height, r, s);
f1!(stepover_for_cusp, c::stepover_for_cusp, r, h);
f1!(ball_eff_dia, c::ball_eff_dia, d, ap, tilt);
f1!(ball_min_dia, c::ball_min_dia, d, ap, tilt);
f1!(speed_at_nominal_dia, c::speed_at_nominal_dia, vc, d, de);
f1!(runout_chip_max, c::runout_chip_max, fz, tir, z);
f1!(runout_fz_for_max, c::runout_fz_for_max, target, tir, z);
f1!(cutter_approach, c::cutter_approach, d, ae);
f1!(teeth_engaged, c::teeth_engaged, z, ae, d);
f1!(turn_passes, c::turn_passes, d0, d1, ap_max);
f1!(c_axis_deg_min, c::c_axis_deg_min, vf, d);
f1!(c_axis_feed_from_deg, c::c_axis_feed_from_deg, deg_min, d);
f1!(inverse_time_f, c::inverse_time_f, lin, deg, d, vf);
f1!(second_moment_tube, c::second_moment_tube, d, di);
f1!(boring_bar_deflection, c::boring_bar_deflection, f, l, d, di, e_gpa);
f1!(turning_force, c::turning_force, kc, ap, f);
f1!(bandsaw_chip_per_tooth, c::bandsaw_chip_per_tooth, vf, vb, tpi);
f1!(spot_depth, c::spot_depth, dc, angle);
f1!(centre_drill_depth, c::centre_drill_depth, dc, dp, l, angle);
f1!(centre_drill_dia, c::centre_drill_dia, z, dp, l, angle);
f1!(spot_chamfer_dia, c::spot_chamfer_dia, z, angle);
f1!(saw_section, c::saw_section, shape, a, b, nx, ny, which);
f1!(saw_cut_time, c::saw_cut_time, area, rate);
f1!(partoff_time, c::partoff_time, d0, d1, f, vc, n_max, k, which);
f1!(partoff_time_rpm, c::partoff_time_rpm, d0, d1, f, n);
/// Per-tooth chip loads with runout into list_out; returns the tooth count.
#[no_mangle] pub extern "C" fn runout_chips(fz: f64, tir: f64, z: f64) -> f64 { set_out(c::runout_chips(fz, tir, z.max(0.0) as usize)) }
/// Multi-pass turning into list_out as (finished dia, rpm, minutes) per pass; returns the pass count.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn turn_rough(d0: f64, d1: f64, ap_max: f64, len: f64, f: f64, vc: f64, rpm: f64, n_max: f64) -> f64 {
    let p = c::turn_rough(d0, d1, ap_max, len, f, vc, rpm, n_max);
    let n = p.len(); set_out(p.into_iter().flat_map(|(a, b, t)| [a, b, t]).collect()); n as f64 }

// Chatter (core/src/chatter.rs). Samples go in their own buffer (up to 65 536);
// spectra are averaged over calls to chat_add until chat_reset.
const CHAT_LEN: usize = 65536;
static mut CHAT_BUF: [f64; CHAT_LEN] = [0.0; CHAT_LEN];
static mut CHAT_AVG: Vec<f64> = Vec::new();
static mut CHAT_FRAMES: f64 = 0.0;
#[no_mangle] pub extern "C" fn chat_buf_ptr() -> *mut f64 { core::ptr::addr_of_mut!(CHAT_BUF) as *mut f64 }
#[no_mangle] pub extern "C" fn chat_buf_len() -> f64 { CHAT_LEN as f64 }
#[no_mangle] pub extern "C" fn chat_reset() { unsafe { *core::ptr::addr_of_mut!(CHAT_AVG) = Vec::new(); *core::ptr::addr_of_mut!(CHAT_FRAMES) = 0.0; } }
/// Add the spectrum of the first `n` samples (largest power of two) to the average;
/// returns the number of bins (n/2), restarting the average when the size changes.
#[no_mangle] pub extern "C" fn chat_add(n: f64) -> f64 {
    let n = (n.max(0.0) as usize).min(CHAT_LEN);
    // SAFETY: single-threaded wasm; JS wrote the buffer before this call.
    let x = unsafe { core::slice::from_raw_parts(core::ptr::addr_of!(CHAT_BUF) as *const f64, n) };
    let m = c::amplitude_spectrum(x);
    unsafe {
        let avg = &mut *core::ptr::addr_of_mut!(CHAT_AVG); let fr = &mut *core::ptr::addr_of_mut!(CHAT_FRAMES);
        if avg.len() != m.len() { *avg = vec![0.0; m.len()]; *fr = 0.0; }
        for (a, v) in avg.iter_mut().zip(&m) { *a = (*a * *fr + v) / (*fr + 1.0); }
        *fr += 1.0; avg.len() as f64 }
}
/// Averaged amplitude of bin i.
#[no_mangle] pub extern "C" fn chat_bin(i: f64) -> f64 { unsafe { (&*core::ptr::addr_of!(CHAT_AVG)).get(i as usize).copied().unwrap_or(f64::NAN) } }
/// Up to k peaks of the averaged spectrum (bin width df Hz, fmin..fmax) into list_out as
/// (frequency, amplitude, spindle harmonic order or 0) using the spindle frequency
/// rpm / 60 and tolerance tol Hz; returns the count.
#[no_mangle] pub extern "C" fn chat_peaks(df: f64, fmin: f64, fmax: f64, rpm: f64, tol: f64, k: f64) -> f64 {
    let avg = unsafe { &*core::ptr::addr_of!(CHAT_AVG) };
    let p = c::spectrum_peaks(avg, df, fmin, fmax, k.max(0.0) as usize);
    let n = p.len();
    set_out(p.into_iter().flat_map(|(f, a)| [f, a, c::harmonic_order(f, rpm / 60.0, tol)]).collect()); n as f64 }
f1!(tooth_pass_hz, c::tooth_pass_hz, rpm, z);
f1!(stable_rpm, c::stable_rpm, fc, z, lobe);
// Stability chart (core/src/lobes.rs)
f1!(cantilever_fn_hz, c::cantilever_fn_hz, d, l, e_gpa, rho);
f1!(cantilever_tip_stiffness, c::cantilever_tip_stiffness, d, l, e_gpa);
f1!(ks_resultant, c::ks_resultant, kc, beta);
f1!(lobe_critical_depth, c::lobe_critical_depth, k, zeta, ks, beta, nt_star);
/// Stability limit at a spindle speed: which 0 limiting depth (mm), 1 chatter frequency (Hz), 2 lobe number.
#[no_mangle] pub extern "C" fn lobe_limit_at_rpm(k: f64, zeta: f64, fn_hz: f64, ks: f64, beta: f64, nt_star: f64, nt: f64, rpm: f64, which: f64) -> f64 { pick(c::lobe_limit_at_rpm(k, zeta, fn_hz, ks, beta, nt_star, nt, rpm), which) }
f1!(chatter_ratio, c::chatter_ratio, fc, rpm, z);
f1!(harmonic_order, c::harmonic_order, f, base, tol);

// Grinding (core/src/grinding.rs)
f1!(wheel_speed_ms, c::wheel_speed_ms, d, rpm);
f1!(wheel_rpm_ms, c::wheel_rpm_ms, vs, d);
f1!(speed_ratio, c::speed_ratio, vs, vw);
f1!(equiv_dia, c::equiv_dia_f, dw, ds, mode);
f1!(contact_length, c::contact_length, ae, de);
f1!(specific_mrr, c::specific_mrr, ae, vw);
f1!(equiv_chip_um, c::equiv_chip_um, ae, vw, vs);
f1!(traverse_speed, c::traverse_speed, fa, nw);
f1!(overlap_ratio, c::overlap_ratio, bs, fa);
f1!(traverse_time, c::traverse_time, len, fa, nw, passes);
f1!(plunge_time, c::plunge_time, stock, vfr, spark);
f1!(plunge_specific_mrr, c::plunge_specific_mrr, dw, vfr);
f1!(over_marked_max, c::over_marked_max, vs, vmax);
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn surface_grind(len: f64, over: f64, cross_travel: f64, cross: f64, vt: f64, stock: f64, down: f64, spark: f64, both: f64, which: f64) -> f64 {
    c::surface_grind(len, over, cross_travel, cross, vt, stock, down, spark, both, which as u32) }

// Tool nose radius compensation by hand (core/src/tnrc.rs). X values are diameters.
f1!(tnrc_chamfer_dz, c::tnrc::chamfer_dz, r, theta);
f1!(tnrc_chamfer_dx, c::tnrc::chamfer_dx, r, theta);
f1!(tnrc_chamfer_error, c::tnrc::chamfer_error, r, theta);
f1!(tnrc_corner_arc_error, c::tnrc::corner_arc_error, r);
/// Tip vector component: which 0 = Z, 1 = X (NaN for a bad tip number).
#[no_mangle] pub extern "C" fn tnrc_tip(tip: f64, which: f64) -> f64 {
    match c::tnrc::tip_vector(tip.max(0.0) as u32) { Some((z, x)) => if which > 0.5 { x } else { z }, None => f64::NAN } }
/// Straight element into list_out as [z1', x1', z2', x2', nz, nx]; returns 6.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn tnrc_line(r: f64, tip: f64, z1: f64, x1: f64, z2: f64, x2: f64, side: f64, end1: f64, end2: f64) -> f64 {
    set_out(c::tnrc::line_path(r, tip.max(0.0) as u32, z1, x1, z2, x2, side, end1.max(0.0) as u32, end2.max(0.0) as u32).to_vec()) }
/// Arc into list_out as [z1', x1', z2', x2', R', cz', cx', convex]; returns 8.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn tnrc_arc(r: f64, tip: f64, z1: f64, x1: f64, z2: f64, x2: f64, rp: f64, ccw: f64, side: f64) -> f64 {
    set_out(c::tnrc::arc_path(r, tip.max(0.0) as u32, z1, x1, z2, x2, rp, ccw, side).to_vec()) }
// Measurement and shop maths (core/src/measure.rs)
fn pick<const N: usize>(a: [f64; N], which: f64) -> f64 { a.get(which as usize).copied().unwrap_or(f64::NAN) }
f1!(ball_height_in_cone, c::ball_height_in_cone, ball_d, face_d, included);
/// Limits and middle of a tolerance: which 0 upper limit, 1 lower limit, 2 middle, 3 tolerance, 4 half the tolerance, 5 middle - nominal.
#[no_mangle] pub extern "C" fn tol_limits(nominal: f64, dev_a: f64, dev_b: f64, which: f64) -> f64 { pick(c::tol_limits(nominal, dev_a, dev_b), which) }
/// Wear offset change: which 0 error (measured - target), 1 change, 2 new offset value.
#[no_mangle] pub extern "C" fn offset_adjust(measured: f64, target: f64, sense: f64, halve: f64, current: f64, which: f64) -> f64 { pick(c::offset_adjust(measured, target, sense, halve, current), which) }
f1!(cone_face_dia_from_ball, c::cone_face_dia_from_ball, ball_d, height, included);
/// Two balls in a tapered bore: which 0 included angle, 1 face diameter.
#[no_mangle] pub extern "C" fn cone_two_balls(d1: f64, h1: f64, d2: f64, h2: f64, which: f64) -> f64 { pick(c::cone_from_two_balls(d1, h1, d2, h2), which) }
f1!(taper_over_rolls, c::taper_over_rolls, dia0, included, d, h);
/// External taper from two roll measurements: which 0 included angle, 1 diameter at the plate.
#[no_mangle] pub extern "C" fn taper_from_rolls(d: f64, m1: f64, h1: f64, m2: f64, h2: f64, which: f64) -> f64 { pick(c::taper_from_rolls(d, m1, h1, m2, h2), which) }
f1!(shrink_fit_dt, c::shrink_fit_dt, d, interference, clearance, alpha);
f1!(shrink_fit_hub_temp, c::shrink_fit_hub_temp, d, interference, clearance, alpha_hub, alpha_shaft, t0, t_shaft);
f1!(press_fit_pressure, c::press_fit_pressure, d, delta, d_out, d_in, e_hub, nu_hub, e_shaft, nu_shaft);
f1!(press_fit_compliance, c::press_fit_compliance, d, d_out, d_in, e_hub, nu_hub, e_shaft, nu_shaft);
f1!(press_fit_hub_stress, c::press_fit_hub_stress, p, d, d_out);
f1!(press_fit_torque, c::press_fit_torque, p, d, len, mu);
f1!(press_fit_axial_force, c::press_fit_axial_force, p, d, len, mu);
/// Compound angles: which 0 true angle, 1 direction.
#[no_mangle] pub extern "C" fn compound_apparent(ax: f64, ay: f64, which: f64) -> f64 { pick(c::compound_from_apparent(ax, ay), which) }
#[no_mangle] pub extern "C" fn compound_sequential(a1: f64, a2: f64, which: f64) -> f64 { pick(c::compound_from_sequential(a1, a2), which) }
/// Settings for a true angle: which 0 apparent X, 1 apparent Y, 2 first tilt (about X), 3 second tilt.
#[no_mangle] pub extern "C" fn compound_settings(cc: f64, dir: f64, which: f64) -> f64 { pick(c::compound_settings(cc, dir), which) }
f1!(angle_between_faces, c::angle_between_faces, c1, dir1, c2, dir2);
f1!(change_gear_ratio, c::change_gear_ratio, target, leadscrew, fixed);
/// Change-gear trains from the first `n` buffer values (tooth counts) into
/// list_out as (a, b, c, d, ratio) per train, c = d = 0 for a simple train;
/// returns the train count.
#[no_mangle] pub extern "C" fn change_gears(n: f64, target: f64, compound: f64, max: f64) -> f64 {
    let g: Vec<u32> = buf(n).iter().filter(|x| **x >= 1.0 && **x <= 1000.0).map(|x| x.round() as u32).collect();
    let t = c::change_gear_trains(&g, target, compound != 0.0, max.clamp(1.0, 200.0) as usize);
    let k = t.len();
    set_out(t.iter().flat_map(|t| [t.a as f64, t.b as f64, t.c as f64, t.d as f64, t.ratio]).collect()); k as f64 }
f1!(capital_recovery_factor, c::capital_recovery_factor, i, n);
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn machine_hourly_rate(price: f64, resale: f64, years: f64, interest: f64, hours: f64, fixed: f64, kw: f64, load: f64, kwh: f64, labour: f64, which: f64) -> f64 {
    c::machine_hourly_rate(price, resale, years, interest, hours, fixed, kw, load, kwh, labour, which as u32) }
f1!(break_even_qty, c::break_even_qty, fixed, price, variable);
f1!(payback_years, c::payback_years, investment, saving);
f1!(discounted_payback_years, c::discounted_payback_years, investment, saving, i);
f1!(npv, c::npv, investment, saving, n, i, resale);
/// Plane figure `kind`: which 0 area, 1 perimeter, 2-3 extra values (see core).
#[no_mangle] pub extern "C" fn plane_figure(kind: f64, a: f64, b: f64, cc: f64, which: f64) -> f64 { pick(c::plane_figure(kind as u32, a, b, cc), which) }
/// Solid `kind`: which 0 volume, 1 total surface, 2 lateral surface, 3 extra.
#[no_mangle] pub extern "C" fn solid_figure(kind: f64, a: f64, b: f64, cc: f64, which: f64) -> f64 { pick(c::solid_figure(kind as u32, a, b, cc), which) }
#[no_mangle] pub extern "C" fn scale_spec(kind: f64, which: f64) -> f64 { pick(c::scale_spec(kind as u32), which) }
#[no_mangle] pub extern "C" fn scale_reading(kind: f64, value: f64, which: f64) -> f64 { pick(c::scale_reading(kind as u32, value), which) }

// Unit converter (core/src/units.rs)
/// Quantity names, one per line, into the string buffer; returns the length.
#[no_mangle] pub extern "C" fn unit_quantities() -> f64 { set_str(&c::units::QUANTITIES.join("\n")) }
/// Units of quantity `q` as text (`symbol|name|exact|factor` lines) into the string buffer.
#[no_mangle] pub extern "C" fn unit_list(q: f64) -> f64 { set_str(&c::units::units_text(q as u32)) }
#[no_mangle] pub extern "C" fn unit_convert(q: f64, from: f64, to: f64, x: f64) -> f64 { c::units::convert(q as u32, from as u32, to as u32, x) }
f1!(dms_to_deg, c::units::dms_to_deg, d, m, s);
#[no_mangle] pub extern "C" fn angle_form_from_deg(kind: f64, a: f64) -> f64 { c::units::angle_form_from_deg(kind as u32, a) }
#[no_mangle] pub extern "C" fn angle_form_to_deg(kind: f64, x: f64) -> f64 { c::units::angle_form_to_deg(kind as u32, x) }

// Expression calculator (core/src/expr.rs)
static mut EXPR_POS: f64 = 0.0;
/// Evaluate the expression whose character codes are the first `n` buffer
/// values. Returns the value, or NaN with the error message in the string
/// buffer (its length from `expr_err_len`) and its position from `expr_err_pos`.
#[no_mangle] pub extern "C" fn expr_eval(n: f64, deg: f64, ans: f64) -> f64 {
    let s: String = buf(n).iter().map(|c| char::from_u32(*c as u32).unwrap_or('?')).collect();
    match c::expr::eval(&s, deg != 0.0, ans) {
        c::expr::Eval::Ok(v) => { set_str(""); v }
        c::expr::Eval::Err(m, i) => { set_str(&m); unsafe { *core::ptr::addr_of_mut!(EXPR_POS) = i as f64; } f64::NAN }
    } }
static mut EXPR_USED: f64 = 0.0;
/// As `expr_eval`, with length units allowed: `base_mm` is 25.4 in inch mode and 1 in mm mode.
/// `expr_len_used` then says whether the expression held a length unit (1) or not (0).
#[no_mangle] pub extern "C" fn expr_eval_u(n: f64, deg: f64, ans: f64, base_mm: f64) -> f64 {
    let s: String = buf(n).iter().map(|c| char::from_u32(*c as u32).unwrap_or('?')).collect();
    let (r, used) = c::expr::eval_units(&s, deg != 0.0, ans, base_mm);
    unsafe { *core::ptr::addr_of_mut!(EXPR_USED) = if used { 1.0 } else { 0.0 }; }
    match r {
        c::expr::Eval::Ok(v) => { set_str(""); v }
        c::expr::Eval::Err(m, i) => { set_str(&m); unsafe { *core::ptr::addr_of_mut!(EXPR_POS) = i as f64; } f64::NAN }
    } }
#[no_mangle] pub extern "C" fn expr_len_used() -> f64 { unsafe { *core::ptr::addr_of!(EXPR_USED) } }
#[no_mangle] pub extern "C" fn expr_err_len() -> f64 { let s: &String = unsafe { &*core::ptr::addr_of!(STR) }; s.len() as f64 }
#[no_mangle] pub extern "C" fn expr_err_pos() -> f64 { unsafe { *core::ptr::addr_of!(EXPR_POS) } }
/// Decimal degrees to degrees, minutes, seconds: which 0, 1, 2.
#[no_mangle] pub extern "C" fn deg_to_dms(x: f64, which: f64) -> f64 { pick(c::expr::deg_to_dms(x), which) }
/// Prime factors of `n` into list_out; returns the count.
#[no_mangle] pub extern "C" fn prime_factors(n: f64) -> f64 { set_out(c::expr::prime_factors(n)) }
f1!(interpolate, c::expr::interpolate, x1, y1, x2, y2, x);

// Gears and splines (core/src/gears.rs). Lengths in any one unit (module or 1/P).
f1!(gear_involute, c::gears::involute, deg);
f1!(gear_inv_angle, c::gears::inv_angle_deg, inv);
/// Spur gear: which 0 d, 1 db, 2 da, 3 df, 4 ha, 5 hf, 6 h, 7 p, 8 pb, 9 s, 10 e, 11 z_min, 12 x_min, 13 s at tip.
#[no_mangle] pub extern "C" fn gear_spur(m: f64, z: f64, alpha: f64, x: f64, ha: f64, hf: f64, which: f64) -> f64 { c::gears::spur_flat(m, z, alpha, x, ha, hf, which as u32) }
/// Spur pair: which 0 inv aw, 1 aw, 2 y, 3 a0, 4 a, 5 dw1, 6 dw2, 7 ha1, 8 ha2, 9 h, 10 da1, 11 da2, 12 df1, 13 df2, 14 contact ratio.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn gear_spur_pair(m: f64, z1: f64, z2: f64, alpha: f64, x1: f64, x2: f64, ha: f64, hf: f64, which: f64) -> f64 { c::gears::spur_pair_flat(m, z1, z2, alpha, x1, x2, ha, hf, which as u32) }
f1!(gear_shift_sum_for_centre, c::gears::shift_sum_for_centre, m, z1, z2, alpha, a);
f1!(gear_thickness_at, c::gears::thickness_at, d, s, alpha, dy);
/// Helical gear: which 0 mt, 1 at, 2 d, 3 db, 4 da, 5 df, 6 beta_b, 7 lead, 8 px, 9 pn, 10 pt, 11 zv.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn gear_helical(mn: f64, z: f64, an: f64, beta: f64, xn: f64, ha: f64, hf: f64, which: f64) -> f64 { c::gears::helical_flat(mn, z, an, beta, xn, ha, hf, which as u32) }
/// Helical pair: which 0 a, 1 a_wt, 2 y, 3 da1, 4 da2, 5 df1, 6 df2, 7 eps_alpha, 8 a0.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn gear_helical_pair(mn: f64, z1: f64, z2: f64, an: f64, beta: f64, xn1: f64, xn2: f64, ha: f64, hf: f64, which: f64) -> f64 { c::gears::helical_pair_flat(mn, z1, z2, an, beta, xn1, xn2, ha, hf, which as u32) }
f1!(gear_overlap_ratio, c::gears::overlap_ratio, face, mn, beta);
/// Gear measurement (see `gear_measure_flat` for `which`).
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn gear_measure(mn: f64, z: f64, an: f64, beta: f64, xn: f64, dp: f64, internal: f64, k: f64, ha: f64, which: f64) -> f64 {
    c::gears::gear_measure_flat(mn, z, an, beta, xn, dp, internal != 0.0, k, ha, which as u32) }
/// One tooth outline (x, y pairs) into list_out; returns the value count.
#[no_mangle] pub extern "C" fn gear_tooth(d: f64, db: f64, da: f64, df: f64, s: f64, n: f64) -> f64 {
    set_out(c::gears::tooth_outline(d, db, da, df, s, n.max(0.0) as usize)) }
/// Gear train ratio from the first `n` buffer values (driver, driven, driver, driven, ...).
#[no_mangle] pub extern "C" fn gear_train_ratio(n: f64) -> f64 { c::gears::train_ratio(buf(n)) }
f1!(gear_willis, c::gears::willis, zs, zr, ns, nr, nc);
f1!(gear_planet_teeth, c::gears::planet_teeth, zs, zr);
#[no_mangle] pub extern "C" fn gear_planets_assemble(zs: f64, zr: f64, n: f64) -> f64 { if c::gears::planets_assemble(zs, zr, n) { 1.0 } else { 0.0 } }
/// Worm: which 0 lead, 1 lead angle, 2 ratio, 3 centre distance, 4 wheel pitch dia, 5 normal module, 6 axial pitch.
#[no_mangle] pub extern "C" fn gear_worm(mx: f64, z1: f64, z2: f64, d1: f64, which: f64) -> f64 { pick(c::gears::worm(mx, z1, z2, d1), which) }
f1!(gear_train_sign, c::gears::train_sign, n);
f1!(gear_over_pins_ext, c::gears::over_pins_ext, z, d, alpha, s, dp);
f1!(gear_between_pins_int, c::gears::between_pins_int, z, d, alpha, e, dp);
f1!(gear_ideal_pin_ext, c::gears::ideal_pin_ext, m, z, alpha, x);
f1!(gear_ideal_pin_int, c::gears::ideal_pin_int, m, z, alpha, x);
/// Involute spline, 30 deg flat root side fit: std 1 ANSI B92.1, 2 ISO 4156; which as `spline_flat`.
#[no_mangle] pub extern "C" fn gear_spline(std: f64, m: f64, z: f64, which: f64) -> f64 { c::gears::spline_flat(std as u32, m, z, which as u32) }
// G-code backplot (core/src/gsim.rs). JS writes the program's UTF-8 bytes
// at `gsim_in(len)`, calls `gsim_run`, then reads the flat results through
// the pointers below (valid until the next `gsim_in` or `gsim_run`).
static mut GSIM_IN: Vec<u8> = Vec::new();
static mut GSIM_SEGS: Vec<f64> = Vec::new();
static mut GSIM_STEPS: Vec<f64> = Vec::new();
static mut GSIM_STATS: Vec<f64> = Vec::new();
static mut GSIM_MSGS: String = String::new();
/// Make room for `len` bytes of program text and return where to write them.
#[no_mangle] pub extern "C" fn gsim_in(len: f64) -> *mut u8 {
    let n = len.clamp(0.0, 64.0e6) as usize;
    // SAFETY: single-threaded wasm; JS writes the bytes before gsim_run reads them.
    unsafe { let v = &mut *core::ptr::addr_of_mut!(GSIM_IN); *v = vec![0u8; n]; v.as_mut_ptr() } }
/// Run the backplot on the first `len` bytes. lathe 0/1; ctrl as `gcode::Ctrl`;
/// metric_out and default_metric 0/1; rapid (output units/min, 0 unknown);
/// arc_tol (output units, 0 = default); max_rpm (G96 limit when no G50).
/// Returns the number of steps (executed blocks).
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn gsim_run(len: f64, lathe: f64, ctrl: f64, metric_out: f64, default_metric: f64, rapid: f64, arc_tol: f64, max_rpm: f64) -> f64 {
    // SAFETY: single-threaded wasm; the statics are only touched here and by the readers below.
    unsafe {
        let src = &*core::ptr::addr_of!(GSIM_IN);
        let n = (len.max(0.0) as usize).min(src.len());
        let text = String::from_utf8_lossy(&src[..n]).into_owned();
        let o = c::gsim::Opts { lathe: lathe != 0.0, ctrl: c::gcode::Ctrl::from_f(ctrl), metric_out: metric_out != 0.0, default_metric: default_metric != 0.0,
            rapid: if rapid > 0.0 { rapid } else { 0.0 }, arc_tol: if arc_tol > 0.0 { arc_tol } else { 0.0 }, max_rpm: if max_rpm > 0.0 { max_rpm } else { 0.0 } };
        let s = c::gsim::simulate(&text, &o);
        *core::ptr::addr_of_mut!(GSIM_SEGS) = c::gsim::segs_flat(&s);
        *core::ptr::addr_of_mut!(GSIM_STEPS) = c::gsim::steps_flat(&s);
        *core::ptr::addr_of_mut!(GSIM_STATS) = c::gsim::stats_flat(&s);
        *core::ptr::addr_of_mut!(GSIM_MSGS) = c::gsim::msgs_text(&s);
        s.steps.len() as f64
    } }
/// Segments: 7 values each (rapid 1/0, x0, y0, z0, x1, y1, z1); count of values.
#[no_mangle] pub extern "C" fn gsim_segs_ptr() -> *const f64 { unsafe { (&*core::ptr::addr_of!(GSIM_SEGS)).as_ptr() } }
#[no_mangle] pub extern "C" fn gsim_segs_len() -> f64 { unsafe { (&*core::ptr::addr_of!(GSIM_SEGS)).len() as f64 } }
/// Steps: `gsim::STEP_W` values each (line, seg0, seg1, x, y, z, feed, per_rev, rpm, tool, time).
#[no_mangle] pub extern "C" fn gsim_steps_ptr() -> *const f64 { unsafe { (&*core::ptr::addr_of!(GSIM_STEPS)).as_ptr() } }
#[no_mangle] pub extern "C" fn gsim_steps_len() -> f64 { unsafe { (&*core::ptr::addr_of!(GSIM_STEPS)).len() as f64 } }
#[no_mangle] pub extern "C" fn gsim_step_w() -> f64 { c::gsim::STEP_W as f64 }
/// Statistic `i` as in `gsim::stats_flat`.
#[no_mangle] pub extern "C" fn gsim_stat(i: f64) -> f64 { unsafe { (&*core::ptr::addr_of!(GSIM_STATS)).get(i as usize).copied().unwrap_or(f64::NAN) } }
/// Messages ("line TAB level TAB text" per line) into the text buffer; returns the length (text at `text_ptr`).
#[no_mangle] pub extern "C" fn gsim_msgs() -> f64 { set_text(unsafe { (&*core::ptr::addr_of!(GSIM_MSGS)).clone() }) }

// Mechanics (core/src/mechanics.rs): unit-consistent unless named.
use c::mechanics as mech;
#[no_mangle] pub extern "C" fn mech_section(shape: f64, p1: f64, p2: f64, p3: f64, p4: f64, which: f64) -> f64 { mech::section_flat(shape, p1, p2, p3, p4, which as u32) }
/// Beam summary; `which` as in `beam_flat`.
#[no_mangle] pub extern "C" fn mech_beam(support: f64, l: f64, a: f64, p: f64, w: f64, ei: f64, which: f64) -> f64 { mech::beam_flat(support, l, a, p, w, ei, which as u32) }
/// Beam value at x: which 0 deflection, 1 slope, 2 moment, 3 shear.
#[no_mangle] #[allow(clippy::too_many_arguments)]
pub extern "C" fn mech_beam_at(support: f64, l: f64, a: f64, p: f64, w: f64, ei: f64, x: f64, which: f64) -> f64 {
    mech::beam_at(support as u32, l, a, p, w, ei, x).get(which as usize).copied().unwrap_or(f64::NAN) }
f1!(mech_bending_stress, mech::bending_stress, m, i, cc);
f1!(mech_polar_moment, mech::polar_moment, d_out, d_in);
f1!(mech_torsion_stress, mech::torsion_stress, t, d_out, d_in, r);
f1!(mech_torsion_angle, mech::torsion_angle, t, l, g, d_out, d_in);
f1!(mech_torsion_solid_dia, mech::torsion_solid_dia, t, tau);
f1!(mech_shear_modulus, mech::shear_modulus, e, nu);
f1!(mech_shaft_power_w, mech::shaft_power_w, t_nm, rpm);
f1!(mech_shaft_torque_nm, mech::shaft_torque_nm, p_w, rpm);
#[no_mangle] pub extern "C" fn mech_column(e: f64, sy: f64, k: f64, l: f64, area: f64, r: f64, which: f64) -> f64 { mech::column_flat(e, sy, k, l, area, r, which as u32) }
f1!(mech_euler_stress, mech::euler_stress, e, slenderness);
f1!(mech_johnson_stress, mech::johnson_stress, e, sy, slenderness);
f1!(mech_kt_plate_hole, mech::kt_plate_hole, d_over_w);
f1!(mech_kt_ellipse, mech::kt_ellipse, a, b);
f1!(mech_notch_kf, mech::notch_kf, kt, q);
f1!(mech_endurance_estimate, mech::endurance_estimate, sut, inch);
f1!(mech_marin_surface, mech::marin_surface, finish, sut, inch);
f1!(mech_marin_size_mm, mech::marin_size_mm, d_mm);
f1!(mech_stress_alt, mech::stress_alt, smax, smin);
f1!(mech_stress_mean, mech::stress_mean, smax, smin);
/// line 0 Goodman, 1 Soderberg, 2 Gerber, 3 Langer yield.
#[no_mangle] pub extern "C" fn mech_fatigue_factor(line: f64, sa: f64, sm: f64, se: f64, sut: f64, sy: f64) -> f64 { mech::fatigue_factor(line as u32, sa, sm, se, sut, sy) }
f1!(mech_centrifugal_n, mech::centrifugal_n, m_kg, r_m, rpm);
f1!(mech_chuck_grip_n, mech::chuck_grip_n, f0, sum_mr, rpm, internal);
f1!(mech_chuck_speed_for_grip, mech::chuck_speed_for_grip, f0, f_req, sum_mr);
f1!(mech_unbalance_force_n, mech::unbalance_force_n, u_gmm, rpm);
f1!(mech_iso_uper_gmm, mech::iso_uper_gmm, g, m_kg, rpm);
f1!(mech_iso_eper_um, mech::iso_eper_um, g, rpm);
f1!(mech_iso_grade_from_u, mech::iso_grade_from_u, u_gmm, m_kg, rpm);
f1!(mech_plane_share, mech::plane_share, u, h_this, h_other);
/// Critical speed with `n` discs in the shared buffer as (x m, mass kg) pairs; SI units; `which` as in `critical_speed`.
#[no_mangle] pub extern "C" fn mech_critical_speed(n: f64, support: f64, l: f64, ei: f64, mu: f64, which: f64) -> f64 {
    let b = buf(2.0 * n.max(0.0));
    let discs: Vec<(f64, f64)> = b.chunks_exact(2).map(|p| (p[0], p[1])).collect();
    mech::critical_speed(support as u32, l, ei, mu, &discs, which as u32) }
// Inspection round 2 (core/src/inspect.rs)
f1!(iso286_it_formula_large, c::iso286_it_formula_large_f, d_mean, grade);
f1!(iso286_shaft_fd_formula_large, c::iso286_shaft_fd_formula_large_f, letter, d, it7, p_dev);
f1!(iso286_j_limit, c::iso286_j_limit_f, dev, it, hole, which);
f1!(ansi_fit, c::ansi_fit_f, interference_print, hole_plus, hole_minus, shaft_plus, shaft_minus, which);
f1!(renard_theoretical, c::renard_theoretical, r, i);
f1!(renard_index, c::renard_index, r, x);
f1!(spc_constant_computed, c::spc_constant_computed_f, n, which);
f1!(spc_constant_table, c::spc_constant_table_f, n, which);
f1!(sampling, c::sampling_f, n, ac, p, lot, which);
/// X-bar/R chart of the first `n` buffer values in subgroups of `sg`; `which` as in `spc_xbar_r`.
#[no_mangle] pub extern "C" fn spc_xbar_r_buf(n: f64, sg: f64, which: f64) -> f64 { c::spc_xbar_r(buf(n), sg.max(0.0) as usize, which.max(0.0) as u32) }
/// Individuals/moving range chart of the first `n` buffer values; `which` as in `spc_imr`.
#[no_mangle] pub extern "C" fn spc_imr_buf(n: f64, which: f64) -> f64 { c::spc_imr(buf(n), which.max(0.0) as u32) }
// Materials reference (B4): two-metal galvanic check.
f1!(galv_diff, c::matref::galvanic_difference, a, b);
/// 0 = first metal is the anode, 1 = second, -1 = equal; index_scale 1 for an anodic index table.
#[no_mangle] pub extern "C" fn galv_anode(a: f64, b: f64, index_scale: f64) -> f64 { c::matref::galvanic_anode(a, b, index_scale != 0.0) as f64 }
/// 1 when the difference is within the limit, else 0.
#[no_mangle] pub extern "C" fn galv_within(diff: f64, limit: f64) -> f64 { if c::matref::galvanic_within(diff, limit) { 1.0 } else { 0.0 } }

// Cutting forces (core/src/cutforce.rs)
f1!(kienzle_kc, c::kienzle_kc, kc11, mc, h);
f1!(lead_chip_thickness, c::lead_chip_thickness, f, kappa);
f1!(lead_feed_for_chip, c::lead_feed_for_chip, h, kappa);
f1!(round_insert_kappa_deg, c::round_insert_kappa_deg, ic, ap);
f1!(round_insert_hex, c::round_insert_hex, fz, ic, ap);
f1!(round_insert_fz_for_hex, c::round_insert_fz_for_hex, hex, ic, ap);
f1!(drill_chip_thickness, c::drill_chip_thickness, fnr, point);
f1!(drill_power_kw, c::drill_power_kw, vc, d, fnr, kc);
f1!(drill_torque_nm, c::drill_torque_nm, d, fnr, kc);
f1!(drill_thrust_n, c::drill_thrust_n, kc, d, fnr, point);
f1!(tap_torque_nm, c::tap_torque_nm, kc, pitch, d);
f1!(form_tap_torque_nm, c::form_tap_torque_nm, kf, pitch, d);
f1!(power_from_torque_kw, c::power_from_torque_kw, torque, rpm);
f1!(turn_work_deflection, c::turn_work_deflection, support, f, a, l, d, di, e_gpa);
/// Worst deflection of a part in the lathe: which 0 deflection (mm), 1 distance from the chuck (mm).
#[no_mangle] pub extern "C" fn turn_work_deflection_max(support: f64, f: f64, l: f64, d: f64, di: f64, e_gpa: f64, which: f64) -> f64 { pick(c::turn_work_deflection_max(support, f, l, d, di, e_gpa), which) }

// Speeds and feeds advisor (core/src/advisor.rs)
f1!(range_pick, c::range_pick, lo, hi, t);
f1!(lerp_at, c::lerp_at, x0, y0, x1, y1, x);
f1!(apply_factor, c::apply_factor, x, k);
f1!(ream_predrill, c::ream_predrill, d, stock);
f1!(drill_time_min, c::drill_time_min, depth, point, fnr, rpm);
f1!(mrr_drilling_cm3_min, c::mrr_drilling_cm3_min, d, vf);
/// Starting width and depth for an end mill: which 0 ae, 1 ap, 2 source of ae, 3 source of ap.
#[no_mangle] pub extern "C" fn mill_engagement(op: f64, d: f64, flute_len: f64, boldness: f64, which: f64) -> f64 { pick(c::mill_engagement(op, d, flute_len, boldness), which) }
f1!(advise_mill, c::advise_mill_f, d, z, d_shank, stickout, flute_len, flute_factor, e_gpa, vc, chip, kc11, mc, ae, ap, lock, n_max, vf_max, p_max, t_max, eta, radial_ratio, defl_limit, holder_k, out);
f1!(advise_turn, c::advise_turn_f, d, vc, f, ap, kappa, kc11, mc, lock, n_max, p_max, t_max, eta, out);
/// Twist drill feed per revolution by diameter (inches): which 0 low, 1 high.
#[no_mangle] pub extern "C" fn drill_feed_range_in(d_in: f64, which: f64) -> f64 { pick(c::drill_feed_range_in(d_in), which) }
/// Reaming (or any hole tool without a force model): which as in `advise_hole`.
#[no_mangle] pub extern "C" fn advise_hole(vc: f64, d: f64, fnr: f64, n_max: f64, vf_max: f64, which: f64) -> f64 { pick(c::advise_hole(vc, d, fnr, n_max, vf_max), which) }
f1!(hold_in_range, c::hold_in_range, x, lo, hi);
f1!(chip_window, c::chip_window, f, ap, f_lo, f_hi, ap_lo, ap_hi);
/// Plunge roughing advice: which 0 rpm, 1 cutting speed reached, 2 feed per tooth, 3 feed rate down, 4 rpm before the cap, 5 limit, 6 kc, 7 removal rate, 8 spindle power, 9 power available, 10 share of it, 11 reduced.
#[no_mangle] pub extern "C" fn advise_plunge(vc: f64, d: f64, z: f64, fz: f64, ae: f64, step: f64, kc11: f64, mc: f64, fz_locked: f64, n_max: f64, vf_max: f64, p_max: f64, t_max: f64, eta: f64, which: f64) -> f64 { pick(c::advise_plunge(vc, d, z, fz, ae, step, kc11, mc, fz_locked, n_max, vf_max, p_max, t_max, eta), which) }
f1!(plunge_cusp, c::plunge_cusp, d, step);
f1!(plunge_max_step, c::plunge_max_step, d, ae);
f1!(plunge_count, c::plunge_count, len, step);
f1!(plunge_rough_time_min, c::plunge_rough_time_min, depth, vf, count);
/// Tapping advice: which 0 rpm, 1 cutting speed reached, 2 feed rate, 3 rpm the table asks for, 4 limit.
#[no_mangle] pub extern "C" fn advise_tap(vc: f64, d: f64, pitch: f64, n_max: f64, vf_max: f64, which: f64) -> f64 { pick(c::advise_tap(vc, d, pitch, n_max, vf_max), which) }
f1!(tap_time_min, c::tap_time_min, depth, pitch, rpm);
/// Boring bar advice: which 0 force, 1 deflection, 2 share of the allowed deflection, 3 L/D, 4 share of the guidance, 5 limit, 6 depth used, 7 deepest depth, 8 reduced, 9 overhang at which the starting depth fits.
#[no_mangle] pub extern "C" fn advise_bore(l: f64, d: f64, di: f64, e_gpa: f64, kc: f64, fnr: f64, ap: f64, ap_locked: f64, f_known: f64, defl_limit: f64, ld_guide: f64, which: f64) -> f64 { pick(c::advise_bore(l, d, di, e_gpa, kc, fnr, ap, ap_locked, f_known, defl_limit, ld_guide), which) }
/// Drilling advice with the spindle check: which as in `advise_drill`.
#[no_mangle] pub extern "C" fn advise_drill(vc: f64, d: f64, fnr: f64, point: f64, kc11: f64, mc: f64, feed_locked: f64, n_max: f64, vf_max: f64, p_max: f64, t_max: f64, eta: f64, which: f64) -> f64 { pick(c::advise_drill(vc, d, fnr, point, kc11, mc, feed_locked, n_max, vf_max, p_max, t_max, eta), which) }
