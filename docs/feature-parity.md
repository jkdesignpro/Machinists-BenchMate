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
| Milling | MRR and power | core | `mrr_*`, `power_kw` |
| Milling | Ball endmill cusp height, effective diameter | todo | geometry |
| Milling | Adaptive feed on rounded corners | todo | geometry |
| Milling | Tool runout, slitting saw feeds | todo | public references |
| Drilling | Drill speeds/feeds, point length, center drill, gun drill | core (partial) | MH |
| Reference | Tap drill sizes, drill chart (fraction, number, letter, metric) | todo | ASME B94.11M, public tables |
| Reference | Thread data and tolerances (UN, metric, NPT) | core (partial) | ASME B1.1, ISO 262/965 |
| Reference | ISO fits and tolerances | todo | ISO 286 |
| Reference | G-code and M-code reference | todo | Citizen/Mitsubishi manuals (machine-verified) |
| Reference | Material properties, weight, hardness conversion, thermal expansion | todo | ASTM E140, public data |
| Reference | Socket head cap screws, splines, knurling, reaming | todo | ASME/ISO |
| Geometry | Triangle solver, arc calculator, hole patterns, bolt circle | core (partial) | trig |
| Geometry | True position, geometric tolerancing, gauge block stack | todo | ASME Y14.5 concepts, own explanations |
| Finish | Surface finish | core | `ra_theoretical` |
| Tools | Lathe taper G-code, keyway broach G-code, custom macros | todo | machine manuals |
| Tools | Unit conversions, grinding, bandsaw time | todo | standard |
| Tools | G-code simulator | todo | reuse AMW simulator later |
| Extras | 2D CAD/DXF generator, knowledge quiz, assistant | later | |

Beyond parity (ours): manufacturer speeds and feeds with PDF import, an adaptive per-machine learning profile (see `vendor-data-and-learning.md`), Swiss-lathe helpers, "show the working" steps for every result, AMW link-up.
