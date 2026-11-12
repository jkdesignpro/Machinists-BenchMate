# Rotary axis helper: how it works, sources and decisions

Goes with `core/src/rotary.rs` (the arithmetic and its tests), the two pages
`rotpoint` and `rotfeed` in `app/tools.js` (Programming > Rotary axis) and
their drawings in `app/diagrams-eng.js`. All sources read 2026-11-12.

## What it does

- **Rotary axis: where a point goes** (`rotpoint`). A point on the part at
  A0 (or B0, C0), the centre line of the rotary axis and the angle the axis
  is sent to: the X, Y, Z of the point after the move, its distance from the
  axis, how far it moved in a straight line, and the turn in words. The
  drawing looks along the axis from its + end and shows the point before and
  after on the circle it travels.
- **Rotary axis feed** (`rotfeed`). For a diameter and the feed wanted along
  the surface: degrees per minute for a block that only turns (either one
  fills the other), the length round the part, the length of a cut that turns
  and moves along the axis in the same block, its time, the inverse time
  (G93) feed word and the rotary speed during the block. The drawing is the
  surface of the part unrolled flat, with the cut as the sloping line.

## Axis names and which way is plus

ISO 841 names the rotary axes A, B and C about X, Y and Z, positive in the
direction that advances a right-hand screw along the positive linear axis.
The standard states directions for the **tool relative to the work**. When
the machine moves the work instead (a rotary table, a trunnion, a fourth axis
with the part in its chuck), the work turns the opposite way for the same
positive command.

So the page has a box: a positive angle turns the part

- **against the right-hand rule** (the default: a table carries the part, as
  ISO 841 would have it), or
- **by the right-hand rule** (the tool head tilts and you want the tool
  point in part coordinates turned the other way, or the builder set the
  table up that way).

Builders do not always follow the standard. The BobCAD-CAM help page on the
right-hand rule says so in as many words. That is why the page also has a
row telling the user to jog the axis a few degrees plus and compare with the
drawing, and why nothing is assumed from the machine profile.

| Source | What it gives |
|---|---|
| ISO 841:1974, public preview, https://cdn.standards.iteh.ai/samples/5211/54d3a19b58444bb19d13c750347dad9a/ISO-841-1974.pdf (clauses 2.1, 2.6, 6.1, 6.2, 10) | Right-handed X, Y, Z; A, B, C about them by the right-hand screw rule; directions are for the tool relative to the work; primed letters for a moving work. The scan is partly garbled; only the clauses that read cleanly are used. |
| BobCAD-CAM help, "Understanding the right-hand rule", https://bobcad.com/components/webhelp/BCC/Content/Merge/CAM/Undertanding_RightHandRule.htm | The same rule in words, and that machine builders do not always build to the standard direction. |

## The rotation

Right-hand rule about X by an angle a, with Y and Z measured from the centre
line of the axis:

    Y' = Y cos a - Z sin a
    Z' = Y sin a + Z cos a

About Y the pair is (Z, X) and about Z it is (X, Y). The coordinate along
the axis and the distance from the axis do not change. A part carried by a
table turns by minus the angle.

| Source | Check | Published | BenchMate |
|---|---|---|---|
| MathWorks documentation, `rotx`, https://www.mathworks.com/help/phased/ref/rotx.html | rotx(30) applied to (2, -2, 4) | (2.0000, -3.7321, 2.4641) | (2.0000, -3.7321, 2.4641) |
| Wikipedia, "Rotation matrix" (basic 3D rotations) | Direction: a positive turn about Z takes a vector along X towards Y; counter-clockwise when the axis points at the observer | as stated | core test |

The matrices on the Wikipedia page did not come through when it was read, so
only its statement of the direction is used; the numbers are checked against
the MathWorks example. The straight-line distance moved is the plain
distance between the two points.

## Feed of a rotary block

Round the part, a length s at radius r is an angle s / r radians. So:

- surface feed f gives f x 180 / (pi x r) degrees per minute, and back;
- a block that turns by an angle while the tool moves a length L along the
  rotary axis cuts a helix of length sqrt((r x angle)^2 + L^2);
- time = length / feed;
- inverse time (G93): the F word is 1 / minutes the block takes, which is
  feed / length. Every cutting block needs its own F in G93;
- rotary speed during such a block = angle / time.

| Source | Case | Published | BenchMate |
|---|---|---|---|
| Fadal user manual, section 12 "Rotary axes", https://itscnc.com/pub/media/documents/fadal_manuals/user_manual/Sect_12_Rotary_Axes.pdf | 4.0 in diameter, A 90 degrees with X 3.0 in, 25 in/min wanted | move distance 4.3439; 517.97 degrees per minute; inverse time feed 5.755 (the sample program rounds it to F5.76) | 4.3439; 517.97; 5.755 |
| Industrial Monitor Direct knowledge base, "CNC rotary axis feedrate sync with linear axis", https://industrialmonitordirect.com/blogs/knowledgebase/cnc-rotary-axis-feedrate-sync-with-linear-axis-g-code | X 0.25 in, A 360 degrees, diameter 2.0 in, 2 in/min | distance 6.288 in; 3.144 min | 6.288; 3.144 |
| CNC Cookbook, "Feed rate mode G-codes G93, G94 and G95", https://cnccookbook.com/feed-rate-mode-g-codes-g93-g94-and-g95 | Meaning of F in G93 | the block takes 1/F minutes; F on every G01, G02, G03 block | same rule |
| Haas UK, "Inverse time feed mode (G93)", https://www.haas.co.uk/?p=1329 | The same, in seconds | the block takes 60 / F seconds | same rule |
| RapidRotary README, https://github.com/sgano/RapidRotary | A block that only turns | 90 degrees per minute is 4 minutes a turn | 240 s |

All five are core tests.

### A disagreement, shown and not used

The Industrial Monitor Direct page gives the distance formula above and the
relation X feed = A degrees per minute x pi x D / 360, both of which agree
with the Fadal manual. Two lines on the same page do not follow from them:
an example that states 2,880 degrees per minute for the 2 in/min case (its
own relation gives 114.59), and a sample G93 block written with F3.144 for a
block that takes 3.144 minutes (by the G93 rule on CNC Cookbook, Haas and
Fadal the word would be 1 / 3.144 = 0.318). BenchMate uses the formula and
the time, which three other sources agree with, and does not use those two
lines.

### The F word in G94 on a block that turns and moves

This is control-specific. The Fadal manual reads F on such a block as
degrees per minute of the rotary axis. Other controls read it other ways and
no second source could be read that states one rule for any other control.
So the page gives the rotary speed, names the Fadal reading as Fadal's, and
points the user to the inverse time word, which means the same on every
control that has G93, and to the manual. It does not print a G94 F word.

## Decisions

- The diameter is where the tool tip cuts, not the stock diameter. The page
  label says so.
- The centre line box for the coordinate along the axis is hidden, since it
  has no effect.
- The drawing of the point is to scale (the circle is the path of the
  point). The drawing of the unrolled surface has the right proportions
  between the length round and the move along, within limits, and carries
  the numbers as labels.
- No program is written by these pages. Wrapping a toolpath round a diameter
  needs the G94 rule of the control (above) and is left out until there are
  sources for it.

## Not read

- LinuxCNC G-code reference: the page was fetched but the G93 section was
  not in the text that came back. Not counted as a source.

## Not included

- Two rotary axes at once (five-axis tool centre point), tilted work planes
  (G68.2 and the like) and the offset of a trunnion's two centre lines.
- Finding the centre line of the axis on the machine (an indicator job).
- Wrapped toolpaths (see Decisions).
