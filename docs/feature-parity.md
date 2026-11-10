# Feature parity tracker

Goal: at minimum match the breadth of commercial machinist calculators, built only from free knowledge (standards, textbooks, manufacturer-published formulas, public-domain data).

Statuses match the strict line-by-line audit in `parity-audit.md` (2026-11-10, judged from the code): `done` (in the app and working), `partial` (in the app, covers only part), `missing` (not in the app; a formula in `benchmate-core` with no screen counts as missing), `in progress` (on an unmerged branch; still missing until merged). The "Audit rows" column points at the rows in `parity-audit.md` section 1.

Every item needs: cited source, unit tests against worked examples, own UI.

| Area | Feature | Status | BenchMate tool | Audit rows |
|---|---|---|---|---|
| Turning | Cutting speed and feed recommendations by material | missing | | U1, U2 |
| Turning | Spindle speed conversion | done | `rpm` | U3 |
| Turning | Feed rate conversion (per rev / per minute) | missing | | U4 |
| Turning | Roughing pass cut time | partial (one pass, fixed RPM) | `passtime` | U5 |
| Turning | Part-off / grooving cut time (CSS) | missing | | U6 |
| Turning | Taper calculation | done | `taper` | U7 |
| Turning | Lathe taper G-code, lathe cycle generator | missing | | U8, U11 |
| Turning | Boring bar deflection | partial (end-mill cantilever model only) | `deflection` | U9 |
| Turning | C-axis feed converter | missing | | U10 |
| Turning | Surface finish from nose radius | done | `finish` | U12 |
| Turning | Bar stock planner (parts per bar, weight, cost) | done (ours) | `bar` | |
| Milling | Speeds and feeds with chip thinning, deflection, power check | partial (checks a cut you enter; no starting data, kc by hand) | `cutopt` | U13, U18 |
| Milling | Spindle speed and table feed | done | `rpm`, `feed` | U14, U15 |
| Milling | Radial chip thinning | partial (hm/hex shown; no compensated feed) | `cutopt` | U16 |
| Milling | MRR and power | done (MRR) / partial (power needs kc) | `mrr`, `cutopt` | U17, U18 |
| Milling | Arc feed correction (internal/external) | done | `arcfeed` | U21 (partial: no corner-engagement feed) |
| Milling | Helical interpolation / ramp angle and pitch | done (ours) | `helix` | |
| Milling | Tool deflection, cut optimiser | done (ours) | `deflection`, `cutopt` | |
| Milling | Ball end mill cusp height and effective diameter | missing | | U19, U20 |
| Milling | Tool runout, slitting saw speeds and feeds | missing | | U22, U23 |
| Milling | Thread milling calculator and program | missing | | U24, U25 |
| Economics | Taylor tool life, cost per part, economic tool life | done (ours) | `toollife` | |
| Drilling | Drill speed/feed recommendations | missing | | U28 |
| Drilling | Drill point length | done | `drillpoint` | U29 |
| Drilling | Center drill, reaming, gun drill, tapping speed | missing | | U32-U35 |
| Reference | Drill chart (fraction, number, letter, metric) | done | `drillchart` | U30 |
| Reference | Tap drill sizes (cut and form) | done | `tapdrill` | U31 |
| Reference | Thread data and limits: UNC/UNF/UNEF, metric M | done | `threaddata` | U38, U43, U52 |
| Reference | Thread data: UN constant pitch / UNS | partial (custom size only) | `threaddata` | U39 |
| Reference | NPT, BSPP, BSW, BSF, BA | done (basic dimensions; no tolerances, no NPTF) | `pipethreads`, `whitworth` | U47, U48, U50 |
| Reference | Thread measurement over wires | done (60 degree only) | `wires` | U51 |
| Threads | UNJ, UNR, UNM, ACME, Stub ACME, STI, plating allowance | missing | | U40-U46, U49 |
| Reference | ISO fits and tolerances | partial (no j/J, up to 500 mm) | `fits` | U61 |
| Reference | G-code and M-code reference per control dialect, custom macros | missing | | U92-U94 |
| Reference | Material properties | partial (properties, no SFM/machinability data; round 2 in progress) | `materials` | U82 |
| Reference | Material weight | partial (bar only; full tool in progress on `claude/geometry`) | `bar` | U81 |
| Reference | Hardness conversion | missing (in progress, `claude/ref-data-3`) | | U67 |
| Reference | Thermal expansion | partial (measurement correction only) | `tempcomp` | U68 |
| Reference | Socket head cap screw holes, knurling, reaming | missing | | U71, U87, U33 |
| Geometry | Bolt circle | done | `bolt` | U72 |
| Geometry | Rectangular hole pattern, coordinate export | missing | | U73, U74 |
| Geometry | Triangle solver, arc calculator, geometry, angles | missing (in progress, `claude/geometry`) | | U75-U78 |
| Geometry | Sine bar, gauge block stack | missing (in progress, `claude/geometry`) | | U69, U65 |
| Geometry | Height over ball (countersinks, tapered bores) | missing | | U70 |
| GD&T | True position with MMC/LMC bonus | done | `gdttp`, `gdtbonus` | U62 |
| GD&T | Learning centre (no quiz), frame builder | done | `gdtguide`, `gdtfcf`, `gdtdof` and others | U63, U64 |
| Finish | Surface finish (lathe, mill, conversions) | partial (lathe only; conversions in progress) | `finish` | U66 |
| Tools | Keyway broach G-code, G76, G84, G81/82/83/73 generators | missing | | U36, U37, U53, U88 |
| Tools | Unit conversions | partial (length only) | `fraction` | U79 |
| Tools | Scientific calculator | missing | | U80 |
| Tools | Bandsaw cut time | missing | | U90 |
| Tools | G-code simulator | missing | | U95 |
| Tools | 2D CAD / DXF generator | partial | `dxfbolt`, `dxfgrid`, `dxfslot`, `dxfrect`, `dxfpoly`, `dxfring`, `dxfprofile` (parametric shapes, live preview, DXF R2000/R12 export; no free sketching, snapping or angle measure) | U96 |
| Shop | Coolant concentration and mix | done | `coolconc`, `coolmix` | U89 |
| Shop | Chatter finder (mic, stable-speed lobes) and vibration check | missing | | U26, U27 |
| Grinding | Equivalent diameter, grit conversion, plunge, surface, wheel/workpiece speed, cylindricity | missing | | U55-U60 |
| Gears/splines | Spur gear data, ISO 4156, ANSI B92.1, SAE J499a | missing | | U83-U86 |
| Library | Formula library | partial (working shown per tool; no library view) | all tools | U97 |
| Library | Tips, tool wear info, assistant, community cut data | missing | | U91, U98, U101, U102 |
| Library | Indexable insert catalogue | missing (in progress, `claude/ref-data-3`) | | U103 |
| Shop | Tool library and favourites | done | `toollib` (fill into rpm, feed, arcfeed, helix, deflection, cutopt, drillpoint, tapdrill, finish); star in the side list or by the title | U106, U109 |
| Shop | Decimal precision, home dashboard, reorderable menu | missing | | U105, U107, U108 |
| Platform | Inch/metric toggle | done | `app.js` | U104 |
| Platform | Offline, web/desktop link | partial (local web app; no installable offline build) | | U110, U111 |
| Platform | Mobile apps, languages | missing (later phase) | | U112, U113 |

Count against Ultra (from `parity-audit.md`): 113 rows, 22 done, 16 partial, 73 missing (8 of them in progress), 2 out of scope. The build order is in `parity-audit.md` section 6.

Beyond parity (ours): manufacturer speeds and feeds with PDF import, an adaptive per-machine learning profile (see `vendor-data-and-learning.md`), Swiss-lathe helpers, "show the working" steps for every result, AMW link-up.


**Scope rule:** BenchMate is for all machinists and all machines. The Citizen L20 is just the first machine profile to be verified. Nothing machine-specific goes in the general tools: G/M codes, cycles and limits live in selectable control/machine profiles.

**Dropped by Jacob:** quiz and tolerance-stack mini game (not wanted).
