# G-code snippets: how they work, sources and decisions

Goes with `core/src/gcode.rs` (the blocks), `core/src/gcode/tests.rs` and
`core/src/gcode/golden/snippets/` (the tests), `app/snippets.js` (the box on
the calculators) and `app/cycles.js` (the fold on the generator pages).

## What a snippet is

The cycle blocks of a program on their own, to paste into a program that
already has its tool change, offsets and spindle start. A snippet starts with
comment lines:

    (BENCHMATE SNIPPET - CYCLE BLOCKS ONLY - HAAS - MM)
    (BEFORE THESE BLOCKS: G90 G17, WORK OFFSET AND TOOL LENGTH OFFSET ACTIVE)
    (BEFORE THESE BLOCKS: SPINDLE ON: S1200 M03)
    (BEFORE THESE BLOCKS: TOOL AT Z25.0, THE INITIAL LEVEL)
    (CHECK EVERY LINE AGAINST YOUR CONTROL MANUAL)
    G99 G82 X50.0 Y0.0 Z-18.0 R2.0 P0.3 F150.0
    X25.0 Y43.301
    G80

The "before these blocks" lines say what the left-out start of the program
had set up, because the blocks are only right in that state: the modes, the
spindle, and where the tool stands (canned cycles and G76 start from the
current position).

## One source of blocks

A snippet is not written by a second generator. Every generator in
`gcode.rs` marks the first and last of its cycle blocks, and the snippet is
those same lines of the same program. So everything in `docs/cycles.md`
holds for snippets too: the formats, the sources per control, the decimal
point rules, and which controls are supported.

What each generator marks:

| Generator | Blocks in the snippet | Left out |
|---|---|---|
| Drilling and tapping | `M29 S` (Fanuc-style rigid tapping), the cycle block, the other holes, `G80` | header, units and safety line, tool change, first position, `S M03`, `G43 H`, retract, coolant, spindle stop, home, `M30` |
| Thread milling | every pass: position, lead-in, helix, lead-out, retract | as above |
| Lathe threading | the `G76` block or blocks (with the Haas settings comment and spring passes), or the `G92` passes | header, tool call, `G97 S M03`, the move to the start point, return, stops |
| Taper, groove and cut-off | roughing and finishing moves | header, tool call, spindle start, first position, stops |
| Keyway broaching | the strokes | header, tool call, first position, home |
| G71 / G70 | the `G71` block or blocks, the profile blocks, `G70` | header, tool call, spindle start, the move to the start point, return, stops |
| Text engraving | every stroke | header, tool change, first position, `S M03`, `G43 H`, stops |

## Spindle and feed words

`gcode::gen_words` writes the spindle start and a feed word with nothing
round them, for the speed and feed calculators:

- mill: `S1500 M03`, and the feed per minute as `F150.0` under a comment
  that names G94;
- lathe, fixed speed: `G97 S1000 M03`;
- lathe, constant surface speed: `G50 S3000` (the clamp, asked for; the
  active machine's top speed is offered) then `G96 S180 M03`;
- lathe feed: `F0.15` under a comment that names G99 (per revolution), or
  `F150.0` under one that names G98 (per minute).

The F word stands alone on its line with a comment telling the user to put
it on the first cutting block. No source that could be read says in so many
words that these two controls take an F word in a block of its own, so the
snippet does not claim it.

Sources for the words (all already used by the generators or by the G and M
code reference): S and M03, `G97`, `G96` with `G50 S`, `G98` and `G99` on
lathes in G-code system A: [CIM-D], [HFO-L] in `docs/cycles.md`. G94 feed per
minute on mills: the Fanuc and Haas rows of the G and M code reference
(`data/refdata.json`, keys FAN_M "Table 2 G code list" and HAAS_MG "17.1
summary table"). Lathes set to G-code system B or C use other codes; the
snippet header names the dialect.

## Where the boxes are

| Page | Snippet | What the page fixes |
|---|---|---|
| Bolt circle | drilling or tapping cycle at the holes | the hole positions |
| Rectangular hole grid | the same, in the order listed | the hole positions |
| Drill point length | drilling cycle to the depth | hole bottom Z = depth at full diameter + point length (new optional box) |
| Spot and centre drill depth | G82 spot cycle to the depth (pointed tool, or a centre drill by its own sizes) | hole bottom Z |
| Tap drill size | G84 tapping cycle | the pitch |
| Spindle speed | spindle start; on a lathe also G96 with the surface speed | the speed |
| Milling feed rate | spindle start and feed word | speed and feed |
| Lathe feed | spindle start and feed word per revolution or per minute | speed and feeds |
| Every generator page | "Cycle blocks only" fold above the program | everything |

The thread data page keeps its two buttons that open the thread milling and
lathe threading generators with the thread filled in; the snippet is then the
fold on that page.

## Decisions

- **Per control.** The dialect is the control picked in the box. Until one
  is picked it is read from the "Control" text of the active machine (Haas,
  Fanuc, Mitsubishi, Siemens, Heidenhain, Okuma); with no machine it is the
  Generic ISO 6983 / Fanuc-style form, and the box says which case applies.
- **No blocks for a control that is not confirmed.** A machine with a
  Siemens, Heidenhain, Mitsubishi or Okuma control gets a sentence saying its
  format is not confirmed yet, and nothing to copy. The same rule as the
  generators.
- **Nothing invented.** The box starts with no spindle speed, feed or depth
  and asks for them one at a time. A value the calculator knows (hole
  positions, depth, pitch) is filled in and locked, with "from this page"
  beside it. The R plane and the initial Z start at the same values as the
  drilling page and can be changed.
- **Open in the full generator** carries the control, the cycle, the values
  and the holes (as pasted coordinates) to the drilling page.
- The box is folded until opened, and stays as the user left it.

## Tests

- `core/src/gcode/tests.rs`: every one of the 23 golden programs now also has
  a golden snippet in `golden/snippets/`. For each: the header names the
  control and the units; every "before" line is one comment with no brackets
  inside; the blocks are one run of whole lines of the program; none of
  `%`, `O`, `T`, `M06`, `G43`, `G54`, `G20`, `G21`, `G28`, `M05`, `M09`, `M30`
  is in them; and the simulator reads the snippet on its own with no errors.
  Three more tests: hand-written drilling snippets (with and without `M29`),
  lathe snippets, and the spindle and feed words with their refusals.
- `tests/smoke/smoke.mjs`, block `snippets`: the bolt circle box from empty
  to blocks; the G82 dwell word per control (`P300` against `P0.3`); the
  hand-off to the full generator; the fold on all eight generator pages; the
  control taken from a Haas machine and refused for a Siemens one; drill
  point, tap drill and spot drill values; the words on a mill and on a lathe;
  inch output.

## Not included

- Snippets for controls other than Generic ISO / Fanuc-style and Haas (see
  "Why the other controls are not supported yet" in `docs/cycles.md`).
- Bolt hole pattern codes of the control itself (such as a bolt hole circle
  G-code): the holes are written out one by one, which every supported
  control reads the same way.
- A left-hand tapping cycle, and lathes set to G-code system B or C.
