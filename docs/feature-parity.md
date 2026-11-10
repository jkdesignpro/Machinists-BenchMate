# Feature parity tracker

Goal: at minimum match the breadth of commercial machinist calculators, built only from free knowledge (standards, textbooks, manufacturer-published formulas, public-domain data). Status: `todo`, `core` (formula in `benchmate-core`, no UI), `done`.

Every item needs: cited source, unit tests against worked examples, own UI.

| Area | Feature | Status | Source plan |
|---|---|---|---|
| Turning | Cutting speed recommendations | todo | manufacturer public catalogues, Machinery's Handbook ranges |
| Turning | Part-off / grooving cut time | todo | kinematics |
| Turning | Roughing pass cut time | core | `pass_time_min` |
| Turning | Spindle speed and feed conversions | core | `rpm_from_sfm` etc. |
| Turning | Boring bar deflection | todo | beam theory, MH |
| Turning | C-axis feed converter | todo | geometry |
| Milling | Speeds and feeds with chip thinning, power check | core (partial) | MH, Sandvik public formulas |
| Milling | Radial chip thinning | todo | standard formula |
| Milling | Thread milling G-code | todo | helical interpolation |
| Milling | Arc feed correction (internal/external) | done | `arc_feed_*`, Sandvik |
| Milling | Helical interpolation / ramp angle and pitch | done | `helix_*`, Sandvik, MH |
| Turning | Bar stock planner (parts per bar, weight, cost) | done | `bar_*`, MH |
| Economics | Taylor tool life, cost per part, economic tool life | done | `taylor_*`, `cost_per_part`, `economic_tool_life`; Taylor 1907, Gilbert 1950, MH |
| Milling | MRR and power | core | `mrr_*`, `power_kw` |
| Milling | Ball endmill cusp height, effective diameter | todo | geometry |
| Milling | Adaptive feed on rounded corners | todo | geometry |
| Milling | Tool runout, slitting saw feeds | todo | public references |
| Drilling | Drill speeds/feeds, point length, center drill, gun drill | core (partial) | MH |
| Reference | Tap drill sizes, drill chart (fraction, number, letter, metric) | todo | ASME B94.11M, public tables |
| Reference | Thread data and tolerances (UN, metric, NPT) | core (partial) | ASME B1.1, ISO 262/965 |
| Reference | ISO fits and tolerances | todo | ISO 286 |
| Reference | G-code and M-code reference, per control dialect | todo | ISO 6983 / RS-274 base, then per-control profiles from public manuals (Fanuc-style, Haas, Siemens, Mitsubishi, Citizen, others); never assumed |
| Reference | Material properties, weight, hardness conversion, thermal expansion | todo | ASTM E140, public data |
| Reference | Socket head cap screws, splines, knurling, reaming | todo | ASME/ISO |
| Geometry | Triangle solver, arc calculator, hole patterns, bolt circle | core (partial) | trig |
| Geometry | True position, geometric tolerancing, gauge block stack | todo | ASME Y14.5 concepts, own explanations |
| Finish | Surface finish | core | `ra_theoretical` |
| Tools | Lathe taper G-code, keyway broach G-code, custom macros | todo | machine manuals |
| Tools | Unit conversions, grinding, bandsaw time | todo | standard |
| Tools | G-code simulator | todo | reuse AMW simulator later |
| Extras | 2D CAD/DXF generator, assistant | later | |
| Shop | Chatter finder (mic, stable-speed lobes) and vibration check | todo | tooth-passing/lobe formula, FFT |
| Grinding | Equivalent diameter, grit conversion, plunge, surface, wheel/workpiece speed | todo | MH grinding chapter |
| Threads | UNJ/UNR/UNS/UNEF/UNM, BSPP, NPT, STI, Whitworth, ACME, Stub ACME, plating allowance | todo | ASME B1.1, B1.5, B1.8, B1.20.1, ISO 228, BS 84 |
| Gears/splines | Spur gear data, involute splines (ISO 4156, ANSI B92.1), SAE J499a | todo | standards, MH |
| Geometry | Sine bar, height over ball, countersink/tapered bore over ball, socket head cap screw holes | todo | trig, ASME B18.3 |
| Cycles | G81/82/83/73, G84, G76, thread mill, keyway broach, lathe cycle generator, taper | todo | machine manuals |
| Library | Formula library (172+ in Ultra), tips, tool wear info, indexable insert catalogue | todo | own writing, ISO 1832 |
| Shop | Tool library (save end mills, drills, taps, reamers; one-tap fill into any calculator), reorderable menu, link to a web/desktop session | todo | own design |
| Platform | Offline, favourites, many languages, mobile later | todo | |

Beyond parity (ours): manufacturer speeds and feeds with PDF import, an adaptive per-machine learning profile (see `vendor-data-and-learning.md`), Swiss-lathe helpers, "show the working" steps for every result, AMW link-up.


**Scope rule:** BenchMate is for all machinists and all machines. The Citizen L20 is just the first machine profile to be verified. Nothing machine-specific goes in the general tools: G/M codes, cycles and limits live in selectable control/machine profiles.

**Dropped by Jacob:** quiz and tolerance-stack mini game (not wanted).
