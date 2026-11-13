# Formula fact check (0.8.0)

Point 15 of the 0.8.0 feedback: check the maths. 23 core functions were called through the built
WebAssembly module and compared with a value worked by hand from the textbook formula, or printed in a
standard (ISO 724 for M10 x 1.5). All 23 agree. The same checks are kept as a Rust test,
`core/tests/factcheck.rs`, with every expected value written as a number, so a later change to a
formula cannot also change what it is checked against.

| Area | Functions | Basis |
| --- | --- | --- |
| Speeds and feeds | rpm from cutting speed (metric and SFM), SFM from rpm, feed per tooth, maximum chip thickness, metal removal rate, torque from power | n = 1000 vc / (pi D); n = 12 SFM / (pi D); fz = vf / (n z); hex = fz sqrt(1 - (1 - 2 ae/D)^2); Q = ae ap vf; T = P / omega |
| Milling geometry | cusp height, ball nose effective diameter, helix pitch, bolt circle | h = R - sqrt(R^2 - (s/2)^2); De = 2 sqrt(ap (D - ap)); pitch = pi D tan(ramp); X = R cos(angle) |
| Turning and drilling | feed for a target Ra, drill point length, drilling time, tailstock setover | f = sqrt(32 r Ra); L = (D/2) / tan(a/2); t = L / (f n); S = (D - d)/2 x L/l |
| Inspection | sine bar height and angle | H = L sin(a) |
| Threads | basic pitch and minor diameter, fundamental triangle, best wire, three-wire measurement, tap drill | ISO 724 printed values; H = sqrt(3)/2 P; w = P / (2 cos 30); M = E - 0.866025 P + 3 W; D - 0.01299 x % x P |

Notes from the check:

- `feed_for_ra` takes Ra in millimetres (the Surface finish page converts from micrometres or
  microinches before calling it). The first run of the check passed micrometres and showed a
  difference; the function was right and the check was corrected.
- Some references write the theoretical roughness as Ra = f^2 / (31.2 r) rather than f^2 / (32 r).
  The two differ by 2.5 %; BenchMate uses 32. To be verified against two publishers before it is shown
  on the page.

The checks that need tables (thread limits, fits, hardness conversion) are covered by the existing
core tests and the book audit (`docs/parity-audit.md`).
