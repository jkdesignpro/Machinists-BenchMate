# Common profiles and sizes (0.8.0)

The page **Common profiles and sizes** (tool `stocksizes`, Stock and sheet metal, and Mechanics >
Engineering) lists box tube, square tube and equal angle in the sizes stockists and tables list, and the
series of T-slot aluminium framing. Picking a size draws the section and gives its area, second moment,
section modulus, radius of gyration and, for a confirmed density, its weight per metre or foot, all from
`mech_section` and `mass_metric_kg` in the Rust core (sharp corners, as in Section properties). A size
can be sent to Section properties or Beam deflection.

## Sources and how they are merged

Each family has two publishers. A size both list is shown plain; a size one lists is shown dashed and
numbered 1 or 2. Nothing is averaged: where the publishers print a different wall for the same gauge
(12 gauge square tube is 0.109 in at Metals Depot and 0.105 in at Speedy Metals) both are listed.
The lists are typed into `scripts/gen_stock_sizes.py`, which writes `app/stocksizes-data.js`.
All read on 2026-11-13.

| Family | 1 | 2 |
| --- | --- | --- |
| Square hollow section, metric | AmesWeb, Square Hollow Section Dimensions Table (states EN 10210-2:2006) | Project Materials, "HSS hollow sections: CHS, SHS, RHS sizes" (no standard named for the table) |
| Square tube, inch | Metals Depot, steel square tube (each size marked A513 or A500) | Speedy Metals, structural steel square and rectangular tube (A500) |
| Equal angle, metric | Wermac, dimensions of equal angles (NEN-EN 10025-1 and -2) | Kerschgens, product portfolio steel L-bars (DIN EN 10056, S235JR) |
| Equal angle, inch | The Engineering ToolBox, steel angles with equal legs (2 in and up) | Speedy Metals, hot rolled structural shapes (A36) |
| T-slot framing | Wikipedia, "T-slot structural framing": 10 and 15 series (inch), 20, 25, 30, 40 and 45 series (metric); rectangles x by 2x | MISUMI USA blog, R. Brownell, 19 May 2026: 3, 5, 6, 8 and 8-45 series with example profiles; a higher series number means a wider slot; 8 and 8-45 share the slot |

The two T-slot publishers name the series differently (Wikipedia by the profile size, MISUMI by its own
series number), so they are shown side by side and no slot widths are given (neither page gives them).

## What is left out

- Corner radii: the core builds sections from rectangles, so tube corner radii and the root and toe radii
  of rolled angle are ignored. The page says so and points to the maker's table for design.
- The A500 design wall (AISC uses a reduced wall for design) is not applied: no source for it was read
  for this page.
- Rectangular tube, channel, I-beam and flat bar sizes: to add, with two publishers each.
