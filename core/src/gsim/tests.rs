use super::*;

fn mill() -> Opts { Opts::default() }
fn lathe() -> Opts { Opts { lathe: true, ..Opts::default() } }
fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }
fn errs(s: &Sim) -> Vec<String> { s.errors().map(|m| format!("{}: {}", m.line, m.text)).collect() }
fn last(s: &Sim) -> [f64; 3] { s.steps.last().unwrap().pos }

#[test]
fn golden_programs_parse_without_errors() {
    let dir = format!("{}/src/gcode/golden", env!("CARGO_MANIFEST_DIR"));
    let mut n = 0;
    for e in std::fs::read_dir(&dir).unwrap() {
        let p = e.unwrap().path();
        if p.extension().and_then(|x| x.to_str()) != Some("nc") { continue; }
        let name = p.file_name().unwrap().to_string_lossy().to_string();
        let text = std::fs::read_to_string(&p).unwrap();
        let is_lathe = ["g71", "g76", "g92", "taper", "groove", "cutoff", "broach_lathe"].iter().any(|k| name.starts_with(k));
        let metric = !name.contains("inch");
        for out_mm in [true, false] {
            let s = simulate(&text, &Opts { lathe: is_lathe, metric_out: out_mm, default_metric: metric, rapid: if out_mm { 10000.0 } else { 400.0 }, ..Opts::default() });
            assert!(errs(&s).is_empty(), "{name}: {:?}", errs(&s));
            assert!(!s.segs.is_empty(), "{name}: no moves");
            if s.feed_dist == 0.0 {
                // Only a G76 threading cycle, which is reported rather than drawn.
                assert!(s.msgs.iter().any(|m| m.text.contains("G76") && m.text.contains("not simulated yet")), "{name}: no feed moves");
            } else {
                assert!(s.feed_time > 0.0 && s.feed_time.is_finite(), "{name}: feed time {}", s.feed_time);
            }
            assert!(s.rapid_time.is_finite());
            assert_eq!(s.untimed, 0, "{name}: untimed blocks {:?}", s.msgs);
            // Every step points at a real line and the segment ranges are in order.
            let nl = text.split('\n').count() as u32;
            for st in &s.steps { assert!(st.line >= 1 && st.line <= nl); assert!(st.seg0 <= st.seg1 && st.seg1 as usize <= s.segs.len()); }
            // No "units assumed" warning: every generated program states G20 or G21.
            assert!(!s.msgs.iter().any(|m| m.text.contains("G20/G21")), "{name}: {:?}", s.msgs);
        }
        n += 1;
    }
    assert!(n >= 20, "only {n} golden files found");
}

#[test]
fn golden_lathe_cycles_are_reported_not_simulated() {
    let t = std::fs::read_to_string(format!("{}/src/gcode/golden/g76_generic_mm.nc", env!("CARGO_MANIFEST_DIR"))).unwrap();
    let s = simulate(&t, &lathe());
    assert!(s.msgs.iter().any(|m| m.level == 1 && m.text.contains("G76") && m.text.contains("not simulated yet")));
    let t = std::fs::read_to_string(format!("{}/src/gcode/golden/g71_generic_mm.nc", env!("CARGO_MANIFEST_DIR"))).unwrap();
    let s = simulate(&t, &lathe());
    assert!(s.msgs.iter().any(|m| m.text.contains("G71 roughing not simulated yet")));
    // G70 ran the contour N100..N107: the finish path reaches X50 (radius 25) at Z-40.
    assert!(s.bbox_feed.unwrap().0[2] <= -40.0 + 1e-9);
    assert!(close(s.bbox_feed.unwrap().1[0], 25.0, 1e-9));
    // The contour lines are executed once (by G70), after the G70 line in the step list order they appear before it.
    let n100 = t.lines().position(|l| l.starts_with("N100")).unwrap() as u32 + 1;
    assert_eq!(s.steps.iter().filter(|st| st.line == n100).count(), 1);
}

#[test]
fn golden_drill_cycle_expanded() {
    let t = std::fs::read_to_string(format!("{}/src/gcode/golden/drill_g83_generic_mm.nc", env!("CARGO_MANIFEST_DIR"))).unwrap();
    let s = simulate(&t, &mill());
    // 4 holes, R2 to Z-20 = 22 mm each.
    assert!(close(s.feed_dist, 98.0, 1e-9), "{}", s.feed_dist); // 22 mm plus five 0.5 mm re-entries per hole
    assert!(close(s.feed_time, 98.0 / 150.0 * 60.0, 1e-9));
    let bb = s.bbox_feed.unwrap();
    assert!(close(bb.0[0], -50.0, 1e-9) && close(bb.1[0], 50.0, 1e-9) && close(bb.0[2], -20.0, 1e-9));
}

#[test]
fn lex_words_and_comments() {
    assert_eq!(lex("  (only a comment)").unwrap(), Lex::Blank);
    assert_eq!(lex("%").unwrap(), Lex::Blank);
    assert_eq!(lex("#100=2.").unwrap(), Lex::Macro);
    assert_eq!(lex("IF [#1 GT 2] GOTO 10").unwrap(), Lex::Macro);
    let Lex::Words(w) = lex("n10 g01 x-.5 Z1. F100 ; tail").unwrap() else { panic!() };
    assert_eq!(w.len(), 5);
    assert_eq!(w[2], Word { c: 'X', v: -0.5, dec: true });
    assert_eq!(w[4], Word { c: 'F', v: 100.0, dec: false });
    assert!(lex("G01 X10 (open").is_err());
    assert!(lex("G01 X").is_err());
    assert!(lex("G01 X1.2.3").is_err());
}

#[test]
fn errors_carry_line_numbers() {
    let s = simulate("G21 G90\nG00 X0 Y0\nG01 X10. (no feed\nG01 X10. Y5.\n", &mill());
    let e = errs(&s);
    assert!(e.iter().any(|m| m.starts_with("3: comment not closed")), "{e:?}");
    assert!(e.iter().any(|m| m.starts_with("4: feed move with no feed rate")), "{e:?}");
    assert_eq!(s.untimed, 1);
}

#[test]
fn quarter_arc_ijk_and_r_agree() {
    let a = simulate("G21 G17 G90\nG00 X10. Y0.\nG03 X0. Y10. I-10. J0. F100.\n", &mill());
    let b = simulate("G21 G17 G90\nG00 X10. Y0.\nG03 X0. Y10. R10. F100.\n", &mill());
    for s in [&a, &b] {
        assert!(errs(s).is_empty(), "{:?}", errs(s));
        assert!(close(s.feed_dist, PI * 5.0, 1e-3), "{}", s.feed_dist);
        // CCW from +X to +Y: the arc passes through (7.07, 7.07), never below y = 0.
        let bb = s.bbox_feed.unwrap();
        assert!(close(bb.1[0], 10.0, 1e-9) && close(bb.1[1], 10.0, 1e-9) && bb.0[1] > -1e-9 && bb.0[0] > -1e-9);
        assert!(close(s.feed_time, PI * 5.0 / 100.0 * 60.0, 1e-3));
    }
    // The tessellated points lie on the circle.
    for g in &a.segs { if !g.rapid { assert!(close((g.b[0].powi(2) + g.b[1].powi(2)).sqrt(), 10.0, 1e-9)); } }
}

#[test]
fn clockwise_and_major_arcs() {
    // G02 from (10,0) to (0,10) with I-10: the long way round, 270 degrees.
    let s = simulate("G21\nG00 X10. Y0.\nG02 X0. Y10. I-10. J0. F100.\n", &mill());
    assert!(close(s.feed_dist, PI * 15.0, 1e-3), "{}", s.feed_dist);
    assert!(close(s.bbox_feed.unwrap().0[1], -10.0, 1e-3));
    // R negative: arc over 180 degrees. G03 R-10 from (10,0) to (0,10): centre (10,10), 270 degrees.
    let s = simulate("G21\nG00 X10. Y0.\nG03 X0. Y10. R-10. F100.\n", &mill());
    assert!(close(s.feed_dist, PI * 15.0, 1e-3), "{}", s.feed_dist);
    assert!(close(s.bbox_feed.unwrap().1[0], 20.0, 1e-3));
    // R positive G02 from (10,0) to (0,10): centre (10,10)? no: CW minor arc has its centre on the right, (10,10).
    let s = simulate("G21\nG00 X10. Y0.\nG02 X0. Y10. R10. F100.\n", &mill());
    assert!(close(s.feed_dist, PI * 5.0, 1e-3));
    for g in &s.segs { if !g.rapid { assert!(close(((g.b[0] - 10.0).powi(2) + (g.b[1] - 10.0).powi(2)).sqrt(), 10.0, 1e-9)); } }
}

#[test]
fn full_circle_and_helix() {
    let s = simulate("G21\nG00 X5. Y0. Z0.\nG03 X5. Y0. I-5. J0. F200.\n", &mill());
    assert!(close(s.feed_dist, 2.0 * PI * 5.0, 1e-3));
    // Helix: one turn of radius 5 with 2 mm lead.
    let s = simulate("G21\nG00 X5. Y0. Z0.\nG03 X5. Y0. Z-2. I-5. J0. F200.\n", &mill());
    assert!(close(s.feed_dist, ((2.0 * PI * 5.0f64).powi(2) + 4.0).sqrt(), 1e-9), "{}", s.feed_dist);
    // F applies along the arc in the plane: time from the planar length.
    assert!(close(s.feed_time, 2.0 * PI * 5.0 / 200.0 * 60.0, 1e-9));
    assert!(close(last(&s)[2], -2.0, 1e-12));
    // Full circle with R is an error.
    let s = simulate("G21\nG00 X5. Y0.\nG03 X5. Y0. R5. F200.\n", &mill());
    assert!(!errs(&s).is_empty());
}

#[test]
fn arc_radius_mismatch_is_an_error() {
    // Centre (0,0): start radius 10, end radius 10.1.
    let s = simulate("G21\nG00 X10. Y0.\nG03 X0. Y10.1 I-10. J0. F100.\n", &mill());
    let e = errs(&s);
    assert_eq!(e.len(), 1, "{e:?}");
    assert!(e[0].starts_with("3: arc start radius 10.0 and end radius 10.1"), "{e:?}");
    // Within tolerance (0.003 < 0.005): accepted.
    let s = simulate("G21\nG00 X10. Y0.\nG03 X0. Y10.003 I-10. J0. F100.\n", &mill());
    assert!(errs(&s).is_empty());
    // A tighter tolerance rejects it.
    let s = simulate("G21\nG00 X10. Y0.\nG03 X0. Y10.003 I-10. J0. F100.\n", &Opts { arc_tol: 0.001, ..mill() });
    assert_eq!(errs(&s).len(), 1);
    // R too small for the chord.
    let s = simulate("G21\nG00 X0. Y0.\nG02 X20. Y0. R5. F100.\n", &mill());
    assert!(errs(&s)[0].contains("smaller than half"));
    // No centre at all.
    let s = simulate("G21\nG00 X0. Y0.\nG02 X20. Y0. F100.\n", &mill());
    assert!(errs(&s)[0].contains("needs a centre"));
}

#[test]
fn g18_and_g19_planes() {
    // G18: plane Z-X. G03 from (X10, Z0) to (X0, Z-10)? a = Z, b = X: start (0,10), centre (0,0) via I-10.
    let s = simulate("G21 G18\nG00 X10. Y0. Z0.\nG03 X0. Z10. I-10. K0. F100.\n", &mill());
    assert!(errs(&s).is_empty(), "{:?}", errs(&s));
    // From (a=0,b=10) CCW in (Z,X) goes towards negative Z first... end (a=10, b=0) is -90 degrees, so CCW is 270 degrees.
    assert!(close(s.feed_dist, PI * 15.0, 1e-3), "{}", s.feed_dist);
    let s = simulate("G21 G18\nG00 X10. Y0. Z0.\nG02 X0. Z10. I-10. K0. F100.\n", &mill());
    assert!(close(s.feed_dist, PI * 5.0, 1e-3));
    // G19: plane Y-Z with J and K.
    let s = simulate("G21 G19\nG00 X0. Y10. Z0.\nG03 Y0. Z10. J-10. K0. F100.\n", &mill());
    assert!(close(s.feed_dist, PI * 5.0, 1e-3), "{}", s.feed_dist);
}

#[test]
fn incremental_mode() {
    let s = simulate("G21 G91\nG00 X10. Y5.\nG01 X10. F100.\nY-5.\nG90 G01 X0. Y0.\n", &mill());
    assert!(errs(&s).is_empty());
    let p: Vec<[f64; 3]> = s.steps.iter().map(|t| t.pos).collect();
    assert_eq!(p[1], [10.0, 5.0, 0.0]);
    assert_eq!(p[2], [20.0, 5.0, 0.0]);
    assert_eq!(p[3], [20.0, 0.0, 0.0]);
    assert_eq!(p[4], [0.0, 0.0, 0.0]);
    assert!(close(s.feed_dist, 10.0 + 5.0 + 20.0, 1e-12));
    // Incremental arc end point.
    let s = simulate("G21 G91\nG00 X10.\nG03 X-10. Y10. I-10. F100.\n", &mill());
    assert!(close(last(&s)[0], 0.0, 1e-12) && close(last(&s)[1], 10.0, 1e-12));
    assert!(close(s.feed_dist, PI * 5.0, 1e-3));
}

#[test]
fn unit_switch() {
    // 10 mm, then 1 inch = 25.4 mm.
    let s = simulate("G21\nG01 X10. F100.\nG20\nG01 X1. F4.\n", &mill());
    assert!(close(last(&s)[0], 25.4, 1e-12));
    assert!(close(s.feed_dist, 25.4, 1e-12));
    // Time: 10 mm at 100 mm/min + 15.4 mm at 4 in/min (101.6 mm/min).
    assert!(close(s.feed_time, 6.0 + 15.4 / 101.6 * 60.0, 1e-9));
    assert!(s.msgs.iter().any(|m| m.line == 3 && m.text.contains("units switched")));
    // Same program reported in inch.
    let s = simulate("G21\nG01 X10. F100.\nG20\nG01 X1. F4.\n", &Opts { metric_out: false, ..mill() });
    assert!(close(last(&s)[0], 1.0, 1e-12));
    assert!(close(s.steps.last().unwrap().feed, 4.0, 1e-12));
    // No G20/G21: assumed units and a warning.
    let s = simulate("G01 X1. F10.\n", &Opts { default_metric: false, ..mill() });
    assert!(close(last(&s)[0], 25.4, 1e-12));
    assert!(s.msgs.iter().any(|m| m.level == 1 && m.text.contains("inch assumed")));
}

#[test]
fn lathe_diameter_and_incremental_uw() {
    let s = simulate("G21 G99\nG97 S1000 M03\nG00 X50. Z2.\nG01 Z-20. F0.2\nU-10. W-5.\n", &lathe());
    assert!(errs(&s).is_empty(), "{:?}", errs(&s));
    // Positions are radius.
    assert_eq!(s.steps[2].pos, [25.0, 0.0, 2.0]);
    assert_eq!(last(&s), [20.0, 0.0, -25.0]);
    // 22 mm at 0.2 mm/rev x 1000 rpm = 200 mm/min.
    let d2 = (25.0f64 + 5.0 * 5.0).sqrt();
    assert!(close(s.feed_dist, 22.0 + d2, 1e-12));
    assert!(close(s.feed_time, (22.0 + d2) / 200.0 * 60.0, 1e-9));
}

#[test]
fn lathe_arc_radius_values() {
    // Convex OD corner R2: X20 Z0 to X24 Z-2, centre at X20 Z-2 (I radius).
    let a = simulate("G21\nG97 S1000\nG00 X20. Z0.\nG03 X24. Z-2. I0. K-2. F0.1\n", &lathe());
    let b = simulate("G21\nG97 S1000\nG00 X20. Z0.\nG03 X24. Z-2. R2. F0.1\n", &lathe());
    for s in [&a, &b] {
        assert!(errs(s).is_empty(), "{:?}", errs(s));
        assert!(close(s.feed_dist, PI, 1e-3), "{}", s.feed_dist);
        // Convex: the arc bulges out to radius 10 + 2 sin45... stays within X radius 10..12 and Z -2..0.
        for g in &s.segs { if !g.rapid { assert!(close(((g.b[0] - 10.0).powi(2) + (g.b[2] + 2.0).powi(2)).sqrt(), 2.0, 1e-9)); } }
    }
}

#[test]
fn per_rev_needs_spindle_speed() {
    let s = simulate("G21 G95\nG01 X10. F0.1\n", &mill());
    assert_eq!(s.untimed, 1);
    assert!(s.msgs.iter().any(|m| m.text.contains("no spindle speed")));
    let s = simulate("G21 G95 S500\nG01 X10. F0.1\n", &mill());
    assert_eq!(s.untimed, 0);
    assert!(close(s.feed_time, 10.0 / 50.0 * 60.0, 1e-9));
}

#[test]
fn css_facing_time_matches_closed_form() {
    // Face from D50 to D0 at 0.1 mm/rev, Vc 150, clamp 2500 rpm.
    let s = simulate("G21 G99\nG50 S2500\nG96 S150 M03\nG00 X50. Z0.\nG01 X0. F0.1\n", &lathe());
    let want = crate::cycles::css_plunge_time_min(50.0, 0.0, 0.1, 150.0, 2500.0, true) * 60.0;
    assert!(close(s.feed_time, want, want * 0.01), "{} vs {}", s.feed_time, want);
}

#[test]
fn rapid_time_and_bbox() {
    let s = simulate("G21\nG00 X30. Y40.\nG01 Z-5. F60.\n", &Opts { rapid: 6000.0, ..mill() });
    assert!(close(s.rapid_dist, 50.0, 1e-12));
    assert!(close(s.rapid_time, 0.5, 1e-12));
    assert!(close(s.feed_time, 5.0, 1e-12));
    assert!(close(s.total_time(), 5.5, 1e-12));
    let (lo, hi) = s.bbox.unwrap();
    assert_eq!(lo, [0.0, 0.0, -5.0]); assert_eq!(hi, [30.0, 40.0, 0.0]);
    // Step times are cumulative and include rapids.
    assert!(close(s.steps[1].time, 0.5, 1e-12) && close(s.steps[2].time, 5.5, 1e-12));
    // Unknown rapid rate: NaN rapid time, total without it.
    let s = simulate("G21\nG00 X30. Y40.\n", &mill());
    assert!(s.rapid_time.is_nan());
}

#[test]
fn drilling_cycles_g98_g99_and_incremental() {
    // G98: back to the initial level Z10 between holes.
    let s = simulate("G21 G90\nG00 X0. Y0. Z10.\nG98 G81 X0. Y0. Z-5. R2. F100.\nX10.\nG80\n", &mill());
    assert!(close(s.feed_dist, 14.0, 1e-12));
    assert_eq!(s.steps[3].pos, [10.0, 0.0, 10.0]);
    // G99: stays at R.
    let s = simulate("G21 G90\nG00 X0. Y0. Z10.\nG99 G81 X0. Y0. Z-5. R2. F100.\nX10.\nG80\n", &mill());
    assert_eq!(s.steps[3].pos, [10.0, 0.0, 2.0]);
    // G91 with K3: R and Z incremental, three holes 10 apart.
    let s = simulate("G21 G90\nG00 X0. Y0. Z10.\nG91 G99 G81 X10. Z-7. R-8. K3 F100.\nG80 G90\n", &mill());
    assert!(close(s.feed_dist, 21.0, 1e-12), "{}", s.feed_dist);
    assert_eq!(s.steps[2].pos, [30.0, 0.0, 2.0]);
    // G82 dwell P500 (ms), G83 pecks.
    let s = simulate("G21\nG00 Z10.\nG82 X0. Y0. Z-5. R2. P500 F100.\nG80\n", &mill());
    assert!(close(s.dwell_time, 0.5, 1e-12));
    let s = simulate("G21\nG00 Z10.\nG83 X0. Y0. Z-10. R2. Q4. F100.\nG80\n", &mill());
    // Pecks to -2, -6, -10, each re-entry fed from 0.5 mm above the last depth.
    assert!(close(s.feed_dist, 12.0 + 2.0 * 0.5, 1e-12), "{}", s.feed_dist);
    assert!(close(s.rapid_dist, 10.0 + 8.0 + (4.0 + 3.5) + (8.0 + 7.5) + 20.0, 1e-12), "{}", s.rapid_dist);
    // G73: short back-off only.
    let s = simulate("G21\nG00 Z10.\nG73 X0. Y0. Z-10. R2. Q4. F100.\nG80\n", &mill());
    assert!(close(s.feed_dist, 13.0, 1e-12));
    assert!(close(s.rapid_dist, 10.0 + 8.0 + 0.5 + 0.5 + 20.0, 1e-12), "{}", s.rapid_dist);
}

#[test]
fn lathe_box_cycles() {
    // G90 turning from start X52 Z2 to X40 Z-30, then X36 (Z modal).
    let s = simulate("G21 G99\nG97 S1000\nG00 X52. Z2.\nG90 X40. Z-30. F0.2\nX36.\nG00 X60.\n", &lathe());
    assert!(errs(&s).is_empty(), "{:?}", errs(&s));
    // Each pass: feed 32 along Z, feed back up (26-20 or 26-18 radius).
    assert!(close(s.feed_dist, 32.0 + 6.0 + 32.0 + 8.0, 1e-9), "{}", s.feed_dist);
    assert_eq!(s.steps[4].pos, [26.0, 0.0, 2.0]);
    // G92 threading feeds at F per rev regardless of G98.
    let s = simulate("G21 G98\nG97 S600\nG00 X32. Z5.\nG92 X29. Z-20. F1.5\n", &lathe());
    assert!(close(s.feed_dist, 25.0, 1e-9));
    assert!(close(s.feed_time, 25.0 / (1.5 * 600.0) * 60.0, 1e-9));
}

#[test]
fn g28_m30_and_unsupported() {
    let s = simulate("G21\nG00 X10. Y10. Z5.\nG91 G28 Z0.\nG90\nM30\nG00 X100.\n", &mill());
    assert_eq!(last(&s), [10.0, 10.0, 5.0]);
    assert!(s.msgs.iter().any(|m| m.level == 2 && m.text.contains("G28")));
    assert!(s.msgs.iter().any(|m| m.line == 6 && m.text.contains("after M30")));
    let s = simulate("G21\nG76 X1. Y1. Z-2. R1. Q0.1 F10.\n#1=2\nG10 L2 P1 X0.\n", &mill());
    assert!(s.msgs.iter().any(|m| m.line == 2 && m.text.contains("not simulated yet")));
    assert!(s.msgs.iter().any(|m| m.line == 3 && m.text.contains("macro")));
    assert!(s.msgs.iter().any(|m| m.line == 4 && m.text.contains("G10")));
    let s = simulate("G00 X1.", &Opts { ctrl: Ctrl::Siemens, ..mill() });
    assert!(errs(&s)[0].contains("not yet supported"));
    let s = simulate("G00 G01 X1. F1.", &mill());
    assert!(errs(&s)[0].contains("two motion codes"));
}

#[test]
fn flat_outputs() {
    let s = simulate("G21\nG00 X1.\nG01 X2. F10.\n", &mill());
    assert_eq!(segs_flat(&s).len(), 7 * s.segs.len());
    assert_eq!(steps_flat(&s).len(), STEP_W * s.steps.len());
    let st = stats_flat(&s);
    assert_eq!(st.len(), 22);
    assert_eq!(st[12], 1.0); assert_eq!(st[13], 1.0);
    assert!(msgs_text(&s).is_empty() || msgs_text(&s).contains('\t'));
}

