# Text engraving: how it works, sources and decisions

Goes with `core/src/engrave.rs` (font reader, layout, lengths),
`gcode::gen_engrave` in `core/src/gcode.rs` (the program), `app/engrave.js`
(the page) and `data/fonts/hershey/` (the letters).

## What it does

Type a text, pick one of nine stroke letter styles, give the height of the
capitals, and BenchMate shows the text to scale and writes the program. The
text can sit on a straight line at any angle or round a circle (letter tops
outward or inward), start, middle or end on the position typed, and can be
mirrored for a mould or a stamp. The strokes also go to the G-code simulator,
to the 2D sketcher and to a DXF file (R2000 or R12).

## The letters

Stroke fonts draw each letter as a few open lines. The cutter centre follows
the lines, so the width of the engraved line is the width of the cutter at
that depth. That is what engraving, scribing and marking need; outline fonts
(TrueType and the like) would need pocketing.

The fonts are the Hershey fonts, as SVG font files. Their use notice, the
acknowledgements it asks for, where the files came from and what was checked
are in `data/fonts/hershey/README.md`. The page prints the acknowledgements.

- **Height.** The height typed is the height of the capital letters. It is
  measured on the letter H of the font (662 units in all nine files, which is
  21 Hershey units of 31.5). The `cap-height` entry in the files (500) is a
  placeholder and is not used. A test checks all nine files.
- **Curves.** The Hershey letters are straight lines. Twenty added accented
  letters per file hold curves; each curve is cut into 10 straight pieces.
- **Letters the font does not have** are named on the page and left out, with
  a gap where each would be. Nothing is swapped in silently.

## Layout (own geometry, with tests)

- Scale = height / 662. Width factor multiplies x only. Extra letter space is
  added once after every letter.
- Each line is shifted so its inked start, middle or end is on the position
  typed. Lines step down by the line pitch (1.5 x height when blank).
- Straight: rotate about the position, then move there.
- Round a circle: a distance s along the foot of the letters becomes the
  angle s / R (in radians) from the anchor angle; a height v above the foot
  becomes the radius R + v (tops outward, reads clockwise) or R - v (tops
  inward, reads counter-clockwise). Strokes longer than 0.05 rad are cut into
  pieces so they follow the circle. Further lines step inward (tops outward)
  or outward (tops inward). The text is refused if it is longer than the
  circle or if a line would reach the centre.
- **Stroke order.** Letters stay in reading order. Inside a letter the strokes
  are taken nearest end first, run backwards when the far end is nearer, and
  strokes that carry on from each other are joined. On the default text this
  cut the lifted moves from 118.9 to 52.5 mm and the plunges from 27 to 20
  (BENCHMATE, 5 mm high, single line sans). The engraved line is the same.

Tests (`core/src/engrave.rs`): a small test font with hand-worked sizes,
lengths, positions, angles, the mirror image, both circle layouts, missing
letters, refusals, stroke order and joining.

## The program

Plain `G00` and `G01` only, with the same header and the same rules as the
other generators (`docs/cycles.md`): for each stroke a rapid above its start,
`G01 Z-depth` at the plunge feed, the stroke at the cutting feed, `G00` to
the safe height. Z0 is the surface being engraved. The text is printed in the
header with brackets and other signs replaced by a full stop, so a comment
can never end early.

- Supported controls: Generic ISO 6983 / Fanuc-style and Haas, as for the
  drilling cycles (the words used are the same: `G17 G20/G21 G40 G49 G80 G90`,
  `G43 H`, `G54` to `G59`, `M03`, `M05`, `M06`, `M08`, `M09`, `M30`,
  `G91 G28 Z0.`). Sources for those words are in `docs/cycles.md`.
- The numbers in the program are rounded to 0.001 mm or 0.0001 in, and the
  move list (time, backplot) uses the same rounded numbers.
- Limits: 2000 characters of text, 50 000 points per program.
- Tests (`core/src/gcode/tests.rs`): two golden programs, a hand-worked
  program with its feed and rapid times, the refusals, the comment text, and
  every one of the nine fonts engraved and read back by the simulator with
  the same feed time.

## Line width of a pointed cutter

Width at the surface = tip flat + 2 x depth x tan(half the included angle).
BenchMate geometry (a triangle), checked against two published values:

| Source | Case | Published | BenchMate |
|---|---|---|---|
| FlatCAM wiki, "V-Shaped bits: Groove Dimension Tables", https://bitbucket.org/jpcgt/flatcam/wiki/V-Shaped_bits__Groove_Dimension_Tables (read 2026-11-12) | 60 degrees, tip 0.1 mm, 0.05 mm deep | 0.158 mm | 0.1577 mm |
| Calculator Academy, "Chamfer Diameter Calculator", https://calculator.academy/chamfer-diameter-calculator/ (read 2026-11-12) | 82 degrees, 5.0 mm at the tip, 9.4 mm at the face | 2.53 mm deep | 2.531 mm |

## DXF check

The DXF of the default text was opened with ezdxf 1.4 (recover and audit) in
both forms: R2000, 20 LWPOLYLINE on layer ENGRAVE, no errors, no fixes, total
length 128.330 mm; R12, 20 POLYLINE, the same. The core reports 20 strokes
and 128.330 mm.

## Not included

- Wrapping the text round a diameter with a rotary axis. The feed of a move
  that turns a rotary axis and moves a linear axis together is read
  differently by different controls, so it needs its own sources first.
- Engraving on a lathe with a driven tool and the C axis.
- More than one depth pass, and tool compensation: the cutter centre follows
  the letter.
- Serial numbers that count up. Type the text for each part.
- Outline (TrueType) fonts.
