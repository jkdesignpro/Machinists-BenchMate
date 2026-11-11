'use strict';
// Tip of the day: BenchMate's own short shop tips, written for this app.
// Each tip: [text, topic]. Rules of thumb are marked as such; the numbers in
// them follow from the formulas the calculators use.
const TIPS = [
  ['Surface speed comes from the material and the cutter; spindle speed follows from the diameter. Halve the diameter and the RPM doubles for the same surface speed.', 'Speeds and feeds'],
  ['With constant surface speed on a lathe, set a maximum spindle speed before facing to centre. As the diameter gets close to zero the control asks for more and more RPM.', 'Turning'],
  ['Theoretical turning finish goes with feed squared divided by nose radius. Halving the feed improves it about four times; doubling the nose radius only about twice.', 'Surface finish'],
  ['When the radial depth of cut is less than half the cutter diameter, the chip is thinner than the programmed feed per tooth. Raise the feed to get the chip thickness you meant.', 'Milling'],
  ['Tool deflection grows with the cube of stick-out. A tool that hangs out 20 % further bends about 73 % more under the same force.', 'Tool deflection'],
  ['The stiffness of a round bar goes with the fourth power of its diameter. A 12 mm boring bar is about twice as stiff as a 10 mm bar of the same material and overhang.', 'Boring bars'],
  ['A drill point adds length to the hole. For a 118 degree point the point length is about 0.3 times the drill diameter.', 'Drilling'],
  ['Dimensions on a drawing apply at 20 °C (68 °F), the standard reference temperature. Let warm parts settle before you measure a close tolerance.', 'Measuring'],
  ['Steel grows about 11 to 12 micrometres per metre for each degree Celsius. A 100 mm steel part that is 5 °C warm reads about 0.006 mm large.', 'Measuring'],
  ['Aluminium expands about twice as much as steel for the same temperature rise, so an aluminium part measured warm with a steel gauge reads large.', 'Measuring'],
  ['For thread measurement over wires, the best wire size touches the flanks at the pitch line. With that size a small flank angle error changes the reading least.', 'Threads'],
  ['Build a gauge block stack from the fewest blocks that make the size. Fewer joints mean less build-up error.', 'Gauge blocks'],
  ['A sine bar loses accuracy at steep angles. Above about 45 degrees a small error in the block stack makes a large error in the angle.', 'Sine bar'],
  ['True position is a diameter: twice the straight-line distance from the true centre. Position = 2 × √(dx² + dy²).', 'GD&T'],
  ['With the maximum material modifier on a hole, every bit the hole is larger than its smallest allowed size is added to the position tolerance as bonus.', 'GD&T'],
  ['Modal G-codes stay active until something changes them. When you restart part-way through a program, check the plane, units, work offset and feed mode first.', 'Programming'],
  ['Write down the cutting data that worked. Your own proven numbers on your own machine beat any table.', 'Shop practice'],
  ['A long stringy chip is a hazard and marks the finish. More feed or a different chip breaker usually breaks it; more speed usually does not.', 'Turning'],
  ['Rule of thumb: chatter often stops when the spindle speed is changed by 10 to 15 % up or down, because the tooth passing frequency moves away from the resonance.', 'Chatter'],
  ['Coolant concentration drifts. Check it with a refractometer and multiply the reading by the factor printed for that coolant.', 'Coolant'],
  ['Deburr and clean before you measure. A burr or a chip under the part is one of the most common causes of a wrong reading.', 'Measuring'],
  ['Doubling the depth of cut roughly doubles the cutting force and power. Doubling the feed raises them by a little less, because thicker chips cut more efficiently.', 'Cutting forces'],
  ['A ball-nose cutter working at a shallow depth cuts on a much smaller diameter than its nominal size. Work out the effective diameter before you set the spindle speed.', 'Milling'],
  ['Check the first part against the drawing, not against the program. The program can be right and the offsets wrong.', 'Shop practice'],
];
