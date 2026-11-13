# Backlash: linear and rotary axes, gears (0.8.0)

The page **Backlash: linear and rotary axes, gears** (tool `backlash`) has three parts. Formulas in
`core/src/rotary.rs` (`lost_motion`, `play_to_arcsec`, `arcsec_to_play`, `arcsec_to`,
`gear_backlash_centre`, `gear_angular_arcmin`), with tests (`backlash_helpers`).

## Linear axis: lost motion from an indicator

Two publishers describe the same test: come up to a point from one side and zero the indicator, move
the axis away and back to the same commanded point, and read what is left on the indicator.

- Tormach knowledge base, "Lost motion testing and gib/ACB adjustment (PCNC 440)": jog in until the dial
  has turned at least once, stop at 0, zero the axis, `G01 X.01 F5`, then `G01 X0 F5`; the reading at X0
  is the lost motion. Lost motion is the difference between the commanded and the observed motion:
  mostly backlash (gib clearance, the angular contact bearing pair), plus bearing give, friction and heat.
- MachMotion support, "How to test for backlash": zero the indicator after moving one way, move the
  other way, and the movement before the indicator responds is the backlash.

Both say to adjust or repair the mechanics before using backlash compensation (Tormach: only once
lost motion is under 0.001 in; its control limits compensation to 0.005 in per axis). MachMotion's
"over 0.003 in shows in accuracy, motion and finish" is one publisher and is not shown on the page.

Compensation: Wikipedia ("Backlash (engineering)") says simple controls add the lost travel at each
change of direction, while professional machines use backlash-free drives (ball screws, split nuts).

## Rotary axis: play and angle

Geometry only: angle in radians = play / radius; 1 radian = 206 264.8 arc seconds.

## Gear pair: backlash from the centre distance

KHK-USA, B. Dengel, "A primer on backlash, its purpose in gear designs": opening the centre distance by
da adds circular backlash j = 2 da tan(alpha), or jn = 2 da sin(alpha) in the normal direction.
Angular backlash is inversely proportional to the gear's radius, so it is given for each gear.
One publisher for the formulas (Wikipedia names the same terms, but its equations did not come through
when read on 2026-11-13): marked so on the page. The angular backlash of a gear on the page is the
arc j at its pitch radius (geometry).
