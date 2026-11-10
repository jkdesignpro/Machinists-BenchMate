# Geometry batch: sources and decisions

Covers the triangle solver, chord/arc/sagitta and three-point circle, fillet
and tangent points, dovetail and V-groove over pins, stock weight,
sheet-metal bends, sine bar with gauge-block stacks, and dividing-head
indexing (`core/src/geometry.rs`, `app/geometry.js`, entries in
`app/tools.js`). All arithmetic is in the Rust core; every function has a
test against a worked example computed independently (by hand, by
constructing the geometry, or by brute force). Sources accessed 2026-11-10.

## Sources

Pure geometry (triangles, circles, fillets, dovetails, areas) is standard
mathematics and is not taken from any one book. Textbook reference for the
trigonometry: OpenStax, *Algebra and Trigonometry* 2e (CC BY), chapter 10,
"Further applications of trigonometry": law of sines incl. the ambiguous
case, law of cosines. Cited by name; not fetched in this session.

Gauge-block set compositions (maker listings):

- **[MIT-C]** Mitutoyo steel gauge block sets, series 516 (metric), PDF from
  Cutwel. https://www.cutwel.co.uk/media/product-pdfs/measuring-tools/gauge-blocks/MIT-516-MET-STEEL-GAUGE-BLOCK-SETS.pdf
  103, 88, 47, 32 and 9-piece metric sets.
- **[MIT-P]** Penn Tool Co. listing of Mitutoyo 516-437-26 (112-piece metric).
  https://penntoolco.com/516-437-26
- **[INS]** Insize 112-piece steel set, series 4100-2112 (Twin Eagle Imports).
  https://twineagleimports.com/products/insize-112-piece-steel-gauge-block-set-series-4100-2112
- **[STR]** Starrett RS81 inch set (81 pieces).
  https://checkout.starrett.com/rs-81-b-gage-block-set/
- **[MIT-T]** Transcat listing of Mitutoyo 516-902-26 (81-piece inch).
  https://www.transcat.com/516-902-26

Sheet metal:

- **[KET]** M. Bussey, "Sheet metal unfold rule equations", KETIV
  Technologies (hosted by Autodesk), v1.0.
  https://www.autodesk.com/akn-aknsite-article-attachments/8ca65522-d3ea-4478-8de6-0a86eba6d64c.pdf
  BA = (π/180) angle (R + K t); OSSB = tan(angle/2)(R + t); BD = 2 x setback
  - BA; K from BA or BD; bend angle is the angle bent through (opening
  angle = 180 - bend angle); K usually between 0 and 1. Notes that for
  bends over 90° some systems use R + t instead of the outside setback.
- **[AST]** Aircraft Systems Tech, "Making straight line bends" (based on FAA
  handbooks). https://www.aircraftsystemstech.com/2017/06/making-straight-line-bends.html
  Bend allowance as the neutral-axis arc length (90° case and an empirical
  any-angle form whose constants correspond to K ≈ 0.445); setback
  SB = K(R + T) with K = 1 at 90° and a chart for other angles; flat
  layout = mould line dimensions - setbacks + bend allowances.

Indexing:

- **[NAVY]** US Navy, *Machinery Repairman* training manual, chapter 7
  "Indexing", page 7-15 "Differential indexing" (public domain; via
  Integrated Publishing). https://enginemechanics.tpub.com/14345/Differential-Indexing-199.html
  Gear ratio = (A - N) x 40 / A (or N - A), spindle gear over driven gear;
  idlers: A > N one or three in a simple train, A < N none or two; compound
  trains reverse this. Hole circles and change-gear sets are not listed:
  it refers to the maker's manual.

## Statement check list

| Statement | Sources | Status |
|---|---|---|
| Law of sines, law of cosines, SSA gives 0, 1 or 2 triangles | OpenStax (cited); tests check each solution against the law of cosines | standard maths |
| Chord, arc, sagitta, segment, sector, R from chord and sagitta, three-point circle | plane geometry; tests use known circles | standard maths |
| Sine bar H = L sin θ | right-triangle trigonometry; tests | standard maths |
| Metric 112-piece set: 1.0005; 1.001-1.009 by 0.001; 1.01-1.49 by 0.01; 0.5-24.5 by 0.5; 25-100 by 25 | MIT-P, INS | confirmed (two makers) |
| Inch 81-piece set: .1001-.1009 by .0001; .101-.149 by .001; .050-.950 by .050; 1-4 by 1 | STR, MIT-T | confirmed (two makers; Transcat prints the last group unclearly as "1-4-100 Step=1") |
| Metric 88, 103, 47 and 32-piece sets | MIT-C only | one maker; labelled "one maker's listing" in the UI |
| Fewest-block stack | exact search (0/1 dynamic programme); tests compare with brute force | derivation |
| Bend allowance, outside setback, bend deduction, K from BA | KET, AST (AST gives the 90° setback and the neutral-axis BA) | confirmed; tan(angle/2) for other angles from KET only |
| Simple indexing: crank turns = 40 / N | NAVY (40:1 heads; the ratio is an input) | confirmed with tests |
| Differential ratio (A - N) x 40 / A, spindle gear driving | NAVY | one source |
| Idler rule for differential indexing | NAVY | one source |
| Dovetail over pins: M = W ± d (1 + cot(α/2)); V-groove pin height | own derivation; test constructs the pin and checks its distance to the flank | derivation |
| Fillets: tangent distance r / tan(α/2); line-arc fillet centre on offset line and circle R ± r | own derivation; tests check every tangent point | derivation |
| Weight = area x length x density | definitions; densities from Confirmed material data | standard |

## Decisions

- **No default index plates or change gears.** The user lists the hole
  circles and gears they own. No two maker sources for standard plate sets
  were read, so none is offered.
- **Worm ratio is an input** with 40 filled in (the ratio the Navy manual
  uses throughout); rotary tables (e.g. 72:1, 90:1) work the same way.
- **Differential search** tries A' = N ± 1, ± 2, ... (above first) up to a
  user limit (default 10), and takes the first A' that the plates index
  exactly and for which the listed gears give the ratio exactly (simple
  pair first, then compound). It reports the idler count rule, not a
  rotation direction, because only the idler rule was found in a source.
- **Gauge stacks** use each block once, in steps of 0.0005 mm (metric) or
  0.00005 in (inch); the target is rounded to that step and the screen
  says so. Sizes up to 1000 mm / 100 in. Wear blocks are not included.
- **Densities** are offered only where the material data has a Confirmed
  value (two or more publishers print the same value); otherwise the user
  enters one.
- **K-factor has no default.** It is entered, or computed from a measured
  test bend.
- **Flanges are measured to the virtual sharp (outside mould line).** For
  bends above 90° the UI warns that some CAD systems use another
  convention.
- **Line-arc fillet** returns up to two solutions for the chosen side and
  inside/outside; the user picks the one that matches the drawing.
