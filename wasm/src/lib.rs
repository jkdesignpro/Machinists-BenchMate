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
#[no_mangle] pub extern "C" fn frac_reduce(num: f64, den: f64, which: f64) -> f64 {
    let (a, b) = c::frac_reduce(num, den); if which == 0.0 { a } else { b } }

// Geometry (core/src/geometry.rs)
f1!(tri_solve, c::solve_triangle_flat, a, b, cc, aa, bb, ccc, sol, which);
f1!(arc_solve, c::arc_solve_flat, mode, x, y, which);
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
f1!(npt_value, c::npt_value_f, d, p, l1, what);
f1!(round_sig, c::round_sig_f, x, sig);

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
