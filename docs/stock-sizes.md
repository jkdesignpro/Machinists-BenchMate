# Common profiles and sizes (0.8.0)

The page **Common profiles and sizes** (tool `stocksizes`, Stock and sheet metal, and Mechanics >
Engineering) lists steel box tube (square and rectangular), round tube, equal angle, IPE beams and
parallel flange channels (metric), square tube, rectangular tube and equal angle (inch), aluminium
equal angle (inch), a flat bar of any width and thickness, and the series of T-slot aluminium framing.
Picking a size draws the section and gives its area, second moment, section modulus, radius of
gyration and, for a confirmed density, its weight per metre or foot, all from `mech_section` and
`mass_metric_kg` in the Rust core (sharp corners, as in Section properties). A size can be sent to
Section properties or Beam deflection.

## Sources and how they are merged

Each family has two publishers. A size both list is shown plain; a size one lists is shown dashed and
numbered 1 or 2. Nothing is averaged: where the publishers print a different wall for the same gauge
(12 gauge square tube is 0.109 in at Metals Depot and 0.105 in at Speedy Metals) both are listed.
Inch walls printed as .180, .188 or .1875 are one size (3/16) and .312 is 5/16. The lists are typed into
`scripts/gen_stock_sizes.py`, which writes `app/stocksizes-data.js`. All read on 2026-11-13.

| Family | Sizes | Both list | 1 | 2 |
| --- | --- | --- | --- | --- |
| Square hollow section, metric | 113 | 64 | AmesWeb, Square Hollow Section Dimensions Table (states EN 10210-2:2006) | Project Materials, "HSS hollow sections: CHS, SHS, RHS sizes" (no standard named for the table) |
| Rectangular hollow section, metric | 103 | 67 | AmesWeb, Rectangular Hollow Section table (EN 10210-2) | Project Materials, as above |
| Circular hollow section, metric | 74 | 43 | AmesWeb, Circular Hollow Section Sizes Table (EN 10210-2) | Wermac, hollow structural sections |
| Equal angle, metric | 99 | 69 | Wermac, dimensions of equal angles (NEN-EN 10025-1 and -2) | Kerschgens, product portfolio steel L-bars (DIN EN 10056, S235JR) |
| IPE beam, metric | 18 | 18 | Wermac, dimensions of IPE and INP beams | Project Materials, IPE beam dimensions and weight (the same h, b, tw and tf for every size) |
| Parallel flange channel, metric | 15 | 10 | British Steel, parallel flange channels datasheet (BS EN 10365) | Kocaer Steel, channels PFC (BS 4-1); where both list a size the web and flange agree |
| Square tube, inch | 86 | 51 | Metals Depot, steel square tube (each size marked A513 or A500) | Speedy Metals, structural steel square and rectangular tube (A500) |
| Rectangular tube, inch | 95 | 49 | Metals Depot, steel rectangle tube | Speedy Metals, as above (prints the small side first; turned round here to H x B) |
| Equal angle, inch | 63 | 23 | The Engineering ToolBox, steel angles with equal legs (2 in and up) | Speedy Metals, hot rolled structural shapes (A36) |
| Aluminium equal angle, inch | 36 | 25 | Speedy Metals, 6061-T6 and 6063-T52 structural shapes | Russel Metals, 6061-T6 aluminum angles |
| T-slot framing | | | Wikipedia, "T-slot structural framing": 10 and 15 series (inch), 20, 25, 30, 40 and 45 series (metric); rectangles x by 2x | MISUMI USA blog, R. Brownell, 19 May 2026: 3, 5, 6, 8 and 8-45 series with example profiles; a higher series number means a wider slot; 8 and 8-45 share the slot |

The two T-slot publishers name the series differently (Wikipedia by the profile size, MISUMI by its own
series number), so they are shown side by side and no slot widths are given (neither page gives them).

## Flat bar

Flat bar is a solid rectangle, so its area and stiffness need no table: the page takes a typed width and
thickness (50 x 10 mm or 2 x 3/8 in to start) and gives Ix lying flat, Iy on edge, the section modulus
and the least radius of gyration from the core. No list of stock sizes is given, because no two
publishers' lists could be read in full on 2026-11-13: Coyote Steel's wall chart lists hot rolled flat
from 1/4 in thick, Continental Steel's A36 page showed only 25 of its 280 sizes, and the text of
ArcelorMittal's EN 10058 table came out with its columns out of line. A list can be added when two
complete lists are read.

## What is left out

- Corner radii: the core builds sections from rectangles, so tube corner radii, the root and toe radii of
  rolled angle, and the root fillets of IPE beams and channels (a few per cent of the area) are ignored.
  The page says so and points to the maker's table for design.
- The A500 design wall (AISC uses a reduced wall for design) is not applied: no source for it was read
  for this page.
- Aluminium box tube: the UK and US stockist pages tried could not be read, so aluminium is the inch
  equal angle only, for now.
- American wide flange (W) beams and C channels: to add, with two publishers each.
