# CAD / DXF generator, 2D sketcher, tool library, favourites: sources and decisions

Covers the DXF writer and reader (`core/src/dxf.rs`), the parametric shapes
(`core/src/cad.rs`), the 2D sketcher (`core/src/sketch.rs`, `app/sketch.js`),
the screens in `app/cad.js`, the tool library (`app/toollib.js`) and
favourites (`app/app.js`). Written 2026-11-10; the sketcher, the reader and
the checks in other programs added 2026-11-11 (0.4.0).

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
  the first session (2026-11-10), so those group codes were written from the
  published reference as known and then checked with an independent reader
  (below). On 2026-11-11 the online edition could be read, and these pages
  were read for the sketcher and the reader:
  - "TEXT (DXF)", https://help.autodesk.com/cloudhelp/2018/ENU/AutoCAD-DXF/files/GUID-62E5383D-8A14-47B4-BFC4-35824CAE8363.htm :
    10/20/30 first alignment point (in OCS), 40 height, 1 the string, 50
    rotation (default 0), 7 style (default STANDARD), 72/73 justification
    (default 0 = left, baseline), 210/220/230 extrusion (default 0, 0, 1).
  - "About Arbitrary Axis Algorithm (DXF)", https://help.autodesk.com/cloudhelp/2018/ENU/AutoCAD-DXF/files/GUID-E19E5B42-0CC7-4EBA-B29F-5E1D595149EE.htm :
    if |Nx| < 1/64 and |Ny| < 1/64 then Ax = Wy x N, otherwise Ax = Wz x N;
    Ay = N x Ax (Wy = (0, 1, 0), Wz = (0, 0, 1)).
  - "About ASCII Control Characters in DXF Files", https://help.autodesk.com/cloudhelp/2016/ENU/AutoCAD-DXF/files/GUID-77D34F88-73CC-495D-B48C-37628EE61D73.htm :
    a control character is written as a caret and a letter; a caret in the
    text itself is written as caret, space.
  - "ATTDEF (DXF)" (same reference): text of more than 250 characters is
    divided into 250-character chunks. The sketcher keeps a text to 250.
- **[ACADCODES]** Autodesk, AutoCAD LT help, "Control Codes and Special
  Characters Reference", https://help.autodesk.com/cloudhelp/2015/ENU/AutoCAD-LT/files/GUID-968CBC1D-BA99-4519-ABDD-88419EB2BF92.htm
  (read 2026-11-11): `%%d` degrees, `%%p` plus/minus, `%%c` diameter.
- **[EZDXFDOC]** ezdxf documentation, read 2026-11-11: "Object Coordinate
  System (OCS)", https://ezdxf.readthedocs.io/en/stable/concepts/ocs.html
  (the same arbitrary axis algorithm; LINE and POINT are in world
  coordinates, CIRCLE, ARC, TEXT, LWPOLYLINE and 2D POLYLINE in OCS) and
  "DXF Tags", https://ezdxf.readthedocs.io/en/stable/dxfinternals/dxftags.html
  (Unicode characters as `\U+nnnn`; UTF-8 only from DXF R2007).
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
| TEXT | 10/20/30 start of the baseline, 40 height, 1 string, 50 rotation, 7 style | [DXF] TEXT; read back by [EZDXF] |
| Signs in text | `%%d` degree, `%%p` plus or minus, `%%c` diameter; other non-ASCII as `\U+XXXX`; caret as caret, space | [ACADCODES]; [EZDXFDOC] DXF Tags; [DXF] ASCII control characters |
| Extrusion (0, 0, -1) | Ax = Wy x N = (-1, 0, 0), Ay = N x Ax = (0, 1, 0): x changes sign, y stays | [DXF] arbitrary axis algorithm; [EZDXFDOC] OCS (same algorithm) |
| World or object coordinates | LINE and POINT are in world coordinates; CIRCLE, ARC, TEXT, LWPOLYLINE, 2D POLYLINE in the object system | [EZDXFDOC] OCS; [DXF] entity pages ("in OCS") |

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

**The lines-and-arcs files (2026-11-11):** `write_samples` now also writes
each shape with its outline taken apart (`-la`), and two sketches (a plate
with a rounded end and two holes; the same with open lines, an arc, a point
and text). That makes 78 files. ezdxf reads all 78 with 0 audit errors and 0
fixes. For each of the 24 `-la` files the script lets ezdxf take the
polyline of the matching polyline file apart itself (`virtual_entities()`)
and compares the lines and arcs one by one with ours: all the same.

**Opened in other programs (2026-11-11):** `scripts/check_dxf_cad.py` opens
the 44 millimetre samples that have an `expected-*.tsv` row (10 shapes and
the plate sketch, R2000 and R12, as polylines and as lines and arcs) in
three programs and compares the size each one draws with the size the core
states (tolerance 0.06 mm: LibreCAD's PDF has dots of 0.021 mm).

| Program | How it was asked | Result |
|---|---|---|
| LibreCAD 2.2.0.2 | `librecad dxf2pdf -c -s 1`: the drawing printed at scale 1, the vector paths of the PDF measured with PyMuPDF | 44 of 44 files open and measure the same width and height (largest difference 0.03 mm) |
| Inkscape 1.2.2 | its DXF importer (`dxf_input.py`, manual scale 1), the shapes of the SVG measured with Inkscape's own library | 44 of 44 files open and measure the same (largest difference 0.01 mm) |
| OpenSCAD 2021.01 | `import("file.dxf")` exported as SVG (closed outlines only, so compared with the part without centre marks) | 29 of 44 the same. The other 15 are its own limits: it draws the arcs inside a polyline as straight lines, and it does not read the R12 POLYLINE entity ("Unsupported DXF Entity 'POLYLINE'"). All 22 lines-and-arcs files measure the same, which is what that option is for |

The second sketch (open lines, an arc, a POINT and two TEXT entities, one
with a diameter sign and one turned 90 degrees) was opened in LibreCAD and
looked at: geometry, both texts and the diameter sign are drawn as in the
sketcher. OpenSCAD says "Unsupported DXF Entity 'POINT'" and leaves text
out; it only wants outlines.

Still not tested: AutoCAD, Fusion, SolidWorks, Mastercam or any other
commercial CAD or CAM package (none can be run here), and FreeCAD (no
package for this system). The R2000 file has no LAYOUT objects; ezdxf,
LibreCAD and Inkscape accept this. Whether AutoCAD opens it without an audit
message is not checked (open item).

## Reading DXF files (0.4.0)

`dxf::read_dxf` reads ASCII DXF of any release into a `Doc` (layers with
colour, and entities):

- **Read:** LINE, POINT, CIRCLE, ARC, TEXT, MTEXT (as one line: `\P` becomes
  a space, formatting codes and braces are dropped), LWPOLYLINE and 2D
  POLYLINE / VERTEX / SEQEND with bulges and the closed flag; the LAYER table
  (name, colour); `$INSUNITS` (1 inch, 4 mm) and `$MEASUREMENT`.
- **Counted and listed, not drawn:** every other entity type (SPLINE,
  ELLIPSE, INSERT, DIMENSION, HATCH, 3DFACE...), entities in paper space
  (67 = 1), entities in a tilted plane (extrusion not along Z), text in a
  mirrored plane, 3D polylines and meshes, and entities with values that
  are not numbers. The page shows the count per type. Nothing is guessed.
- **Mirrored plane:** an entity with extrusion (0, 0, -1) is turned back by
  the arbitrary axis rule: x changes sign, an arc from s to e becomes
  180 - e to 180 - s, a bulge changes sign. Tested with a circle, an arc and
  a polyline.
- **Units:** a file that states neither inch nor mm is taken in the units
  the drawing already has, and the report says so. Another unit code is
  reported and the numbers are kept.
- **Not handled:** binary DXF and DWG (named as such, with what to do);
  text justification other than left / baseline (the first alignment point
  is used, which AutoCAD keeps at the start of the text for all but
  aligned and fit text); text widths (the reader's own font decides);
  files in an old code page (letters outside ASCII in layer names or text
  may come out wrong; geometry is not affected).

Tests (`dxf::tests`): text escapes both ways; every entity type with layers,
colours and units; old polylines and files with no sections; the mirrored
plane; points and text written in both versions and read back; polylines
taken apart.

## 2D sketcher (0.4.0)

The drawing (`sketch::Sketch`: a `Doc`, its units and an undo history of
200 steps) lives in the Rust core. The page draws the core's display list
and sends pointer positions and typed values in; it does no geometry of its
own beyond turning canvas pixels into drawing coordinates.

| What | How | Checked against |
|---|---|---|
| Arc through three points | circumcentre from the determinant form, x0 = -bx / (2a), y0 = -by / (2a) [MWCIRC]; counter-clockwise when a > 0 | unit circle halves; the 3-4-5 triangle (0,0), (6,0), (6,8): centre (3, 4), r 5; points in a line refused |
| Line with line | the two parametric equations, parameters within 0 to 1 | square diagonals meet at the centre; parallel and short lines do not |
| Line with circle or arc | quadratic in the line parameter; arcs only where they are drawn | y = 3 cuts r 5 at x = -4 and 4; a tangent line touches once |
| Circle with circle | x = (d^2 - r2^2 + r1^2) / (2d), h = sqrt(r1^2 - x^2) [MWCC] | r 5 circles 6 apart cross at (3, 4) and (3, -4); touching circles once |
| Tangent from a point | touching points at acos(r / d) either side of the line from the centre to the point (the radius is square to the tangent, so cos = r / d) | from (5, 0) to the unit circle: (0.2, +-sqrt(0.96)); radius dot tangent = 0 |
| Square onto a line or circle | foot of the perpendicular; on a circle the points on the line through the centre | (3, 4) onto the X axis is (3, 0) |
| Angle between two lines | atan2(\|d1 x d2\|, \|d1 . d2\|), 0 to 90 degrees, and 180 minus it | 45 and 135 degrees; opposite directions count as parallel |
| Lengths and areas | line and arc lengths, chord, circle area, polyline perimeter and area with bulges (`dxf::poly_length`, `poly_area`) | 3-4-5 line; rectangle 30 x 20: 100 and 600; quarter arc r 10 |
| Text box | 0.7 x height per character wide, for picking and extents only | LibreCAD drew the 2.5 mm sample text 0.76 x height per character |

**Snap order:** the nearest snap point within reach of the pointer wins
among end, crossing, middle, centre, quadrant, tangent and square; where two
kinds are at the same place it is named in that order. "On a line" (the
nearest point of an entity) counts only when none of those is in reach, the
grid only when nothing is. Tangent and square work from the last point
placed. Reach is 10 screen pixels.

**Left out on purpose (a simple sketcher):** trim, extend, fillet, offset,
mirror, rotate and scale; dimensions as DXF DIMENSION entities (Measure and
the selection read-outs give the numbers instead); splines and ellipses;
blocks; line types and widths; editing an entity's numbers after it is
drawn (delete and draw again, or move it).

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
