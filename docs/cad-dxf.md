# CAD / DXF generator, tool library, favourites: sources and decisions

Covers the DXF writer (`core/src/dxf.rs`), the parametric shapes
(`core/src/cad.rs`), the screens in `app/cad.js`, the tool library
(`app/toollib.js`) and favourites (`app/app.js`). Written 2026-11-10.

## DXF format

- **[DXF]** Autodesk, *DXF Reference* (AutoCAD 2012 edition, PDF
  `autocad_2012_pdf_dxf-reference_enu.pdf`, and the current online edition in
  the AutoCAD developer help). Sections used: "HEADER Section Group Codes"
  (`$ACADVER`, `$HANDSEED`, `$INSUNITS`, `$MEASUREMENT`, `$LUNITS`,
  `$EXTMIN`/`$EXTMAX`), "TABLES Section" (VPORT, LTYPE, LAYER, STYLE, VIEW,
  UCS, APPID, DIMSTYLE, BLOCK_RECORD; common symbol table group codes),
  "BLOCKS Section", "ENTITIES Section" (common entity group codes; LINE,
  CIRCLE, ARC, LWPOLYLINE, POLYLINE, VERTEX, SEQEND), "OBJECTS Section"
  (DICTIONARY). Cited by name; the Autodesk servers could not be reached from
  this session, so the group codes were written from the published reference
  as known and then checked with an independent reader (below).
- **[EZDXF]** ezdxf (MIT licence), Python DXF library, version 1.4.5,
  https://ezdxf.mozman.at/ . Used only as an independent reader/validator,
  not as a source of code. Its unit table (`ezdxf/units.py`: 1 = inches,
  4 = millimetres) and bulge convention (`ezdxf.math.bulge_to_arc`: the arc
  starts at the vertex that carries the bulge, positive = counter-clockwise)
  agree with what BenchMate writes.

Values BenchMate relies on:

| Item | Value | Where |
|---|---|---|
| `$INSUNITS` (code 70) | 1 inches, 4 millimetres | [DXF] HEADER; [EZDXF] units table |
| `$MEASUREMENT` (code 70) | 0 English, 1 metric | [DXF] HEADER |
| Release strings | AC1009 = R12, AC1015 = R2000 | [DXF] `$ACADVER` |
| ARC 50/51 | start/end angle in degrees, counter-clockwise | [DXF] ARC |
| LWPOLYLINE | 90 vertex count, 70 bit 1 closed, 43 constant width, 10/20 per vertex, 42 bulge | [DXF] LWPOLYLINE |
| Bulge | tan(theta / 4); negative = clockwise; 1 = half circle | [DXF] LWPOLYLINE/VERTEX; [EZDXF] |
| R12 polyline | POLYLINE (66 = 1 vertices follow, 70 = 1 closed), VERTEX (42 bulge), SEQEND | [DXF] POLYLINE, VERTEX |
| R2000 handles | code 5 on every object (105 on DIMSTYLE), owner 330, `$HANDSEED` above every handle | [DXF] common group codes |

## What the files contain

- **R2000 (default):** HEADER, empty CLASSES, all nine symbol tables (VPORT
  `*Active` zoomed to the part; LTYPE ByBlock/ByLayer/Continuous; LAYER 0
  plus OUTLINE, HOLES, CENTRE; STYLE Standard; empty VIEW and UCS; APPID ACAD;
  DIMSTYLE Standard; BLOCK_RECORD `*Model_Space`, `*Paper_Space`), the two
  layout blocks, ENTITIES, and OBJECTS with the root dictionary and
  ACAD_GROUP. No LAYOUT objects (see open items). ASCII,
  CRLF line ends, numbers with up to 10 decimals.
- **R12:** HEADER (no `$INSUNITS`, which R12 does not have), LTYPE and LAYER
  tables, empty BLOCKS, ENTITIES with POLYLINE/VERTEX/SEQEND. Offered because
  some older CAM, laser and plasma software only reads R12. The user is told
  that R12 does not store units.
- **Layers:** OUTLINE (outer profile, ACI 7), HOLES (round holes and inner
  bores, ACI 1), CENTRE (centre marks, bolt pitch circle, slot centreline,
  ACI 4). Centre marks are optional.
- **Geometry rules:** outer profiles are one closed polyline, counter-
  clockwise; round holes are CIRCLE entities so CAM can pick them as drill
  points; values are in the units chosen in the title bar; origin at the
  shape's centre or at the lower-left corner of the part (centre marks do
  not count for the corner).

## Shapes and checks

| Shape | Parameters | Refused when |
|---|---|---|
| Bolt circle | pitch dia, holes, hole dia, start angle, OD, centre bore | holes overlap (chord D sin(180/n) not more than hole dia), OD or bore cuts into the holes |
| Hole grid | columns, rows, pitch X/Y, hole dia, plate margin, corner radius | pitch not more than hole dia, margin not more than hole radius, corner radius above half the plate |
| Straight slot | centre distance, width, angle | non-positive values |
| Arc slot | centreline radius, width, start, sweep | width at least 2R, sweep 360 or more, ends touching (2R sin(gap/2) not more than width) |
| Rectangle | width, height, corner radius, corner holes dia and inset | corner radius above half a side, hole breaking an edge or the corner radius (hole centre within r - hole radius of the inner rectangle) |
| Polygon | sides, size across flats or corners, rotation, bore | bore not inside the across-flats circle |
| Circle / ring | OD, ID | ID not below OD |
| Keyhole | head dia, slot width, head centre to slot end centre, rotation | slot not narrower than the head, slot ending inside the head |
| D-flat | dia, across flat (flat to far side), rotation | across flat not below the dia |
| Double-D | dia, across flats, rotation | across flats not below the dia |

Regular polygon relations (circumradius R = F / (2 cos(180/n)) from across
flats F, side 2R sin(180/n), area n R^2 sin(360/n) / 2): Machinery's
Handbook, "regular polygons", and plane geometry. Bolt circle positions use
the existing `bolt_circle` function.

## Tests and independent validation

`cargo test` (module `cad::tests`) writes each shape, reads the text back
with a small DXF reader written in the test (group-code pairs, sections,
header variables, tables, entities; R12 POLYLINE/VERTEX folded into one
record) and checks:

- `$ACADVER`, `$INSUNITS`/`$MEASUREMENT` (inch and mm), section order, the
  nine tables, every entity's layer is defined, header extents equal the
  model extents;
- every handle unique and below `$HANDSEED` (R2000);
- hole centres against `bolt_circle` and a hand value (50 cos 15 deg =
  48.29629), grid hole spread, rectangle corner holes;
- outline areas from the parsed vertices and bulges against closed forms:
  rounded plate W H - (4 - pi) r^2; straight slot L w + pi (w/2)^2 and its
  perimeter; arc slot (sweep in rad) R w + pi (w/2)^2 for 90 and 270 degree
  sweeps (bulge above 1); hexagon 1 in across flats = sqrt(3)/2 in^2;
  keyhole, D-flat and double-D from circle and circular-segment areas;
- extents of arcs (exact, including axis points), lower-left origin, and
  the refusals listed above.

**Independent reader:** `scripts/check_dxf.py` reads every sample (10 shapes
x R2000/R12 x inch/mm, plus R2000 with the lower-left origin: 50 files,
written by the `write_samples` test when `BENCHMATE_DXF_OUT` is set) with
ezdxf 1.4.5 in strict mode (`ezdxf.readfile`, not the recover loader) and
runs `doc.audit()`. Result on 2026-11-10: **all 50 files load, 0 audit
errors, 0 audit fixes**; `$INSUNITS` read back as 1 or 4 (absent in R12).
The script also recomputes each outline area from ezdxf's own reading of the
bulges (`bulge_to_arc`) and matches the closed-form areas to 1e-9 relative.
The browser test downloaded 21 files from the app (all shapes in mm and
inch, R12 with lower-left origin, a custom file name) and ezdxf read and
audited all of them without errors.

Not tested: AutoCAD, LibreCAD or any CAM package (none available offline).
The R2000 file has no LAYOUT objects; ezdxf accepts this without a fix.
Whether AutoCAD opens it without an audit message is not checked (open item).

## Saving

The browser saves through a Blob link (`saveFile` in `app/app.js`). A native
wrapper can set `window.BenchMateSave(name, data, mimeType)` to show a save
dialog instead; the Tauri build will use this.

## Tool library

- Fields: name, type (end mill, ball, corner radius, face, chamfer, thread
  mill, drill, spot/centre drill, cutting and forming tap, reamer, boring
  bar, turning, grooving/parting and threading inserts, other), units of
  the tool (mm or inch), tool number, cutting diameter, shank diameter,
  flutes, flute length, overall length, stick-out, corner/nose radius, point
  angle, thread pitch (mm, or TPI for an inch tool), tool material, coating,
  maker, part number, notes. Unknown values stay blank.
- Stored in `localStorage` (`bm.tools`), exported as
  `{"benchmate_tools": 1, "tools": [...]}`. **Import never overwrites:** a tool
  identical in every field to one in the library is skipped; anything else is
  added with a new id, even if its id matched an existing tool.
- Fill: calculators declare `pick: { map: { field: toolKey }, clear, types }`
  in `app/tools.js`; the generic screen shows "Fill from tool library" when
  any tool has a mapped value. Lengths are converted when the tool's units
  differ from the title-bar units (1 in = 25.4 mm exactly, NIST SP 811).
  Filled screens: spindle speed (diameter), milling feed (teeth), arc feed
  and helical interpolation (tool diameter), tool deflection and cut
  optimiser (diameter, shank, stick-out, flute length, flutes; Solid carbide
  sets the carbide E preset, any other material leaves E alone because the
  presets are single grades), drill point (diameter, point angle), surface
  finish (nose radius from an insert), tap drill (a tap's diameter and pitch
  select the matching standard thread, or "Other"; a forming or cutting tap
  sets the tap type).

## Favourites

Star a tool in the side list (shown on hover or focus, always when set) or
with the button next to each tool's title (also on phones, where the side
list is hidden). Favourites appear as a group at the top of the list in the
order they were starred, stored in `localStorage` (`bm.favs`).

## Phones (390 px)

The browser test opens every tool at 390 px wide in light and dark themes and
checks that nothing scrolls sideways. Wide result tables now scroll inside
their own box below 760 px, and long values and labels wrap; this also fixed
11 existing screens that overflowed (deflection, cut optimiser, drill chart,
thread data, pipe threads, Whitworth, machine tapers, fits, GD&T guide,
tolerance stack, materials).
