// What is this for? (0.8.0). A short, plain explanation shown folded at the top of the less familiar tools:
// what the tool is used for, why, and how to read it. Each text keeps to what the tool's own sources say
// (shown under "Formula and sources"); a page with its own sources lists them in the text. Statements printed
// by only one publisher say "to be verified". Keys: tool id.
const ABOUT = {
  prefnum: {
    use: '<p>Preferred numbers are a short list of sizes in which each size is the same percentage bigger than the one before, so a range from small to large is covered evenly with few sizes. Use them when you choose a family of sizes yourself: a set of pins, spacers or fixture parts, the sizes of a product range, or steps of a load or capacity. Every size in the list is then about as far from its neighbours as any other, and the list stays short.</p>' +
      '<p><b>How to use this page.</b> Pick a series and a range and the page lists the sizes. Use R5 first; when its steps are too large, R10, then R20 (Kverneland gives them as the first, second and third choices of size). Or type the size you had in mind under "Nearest" to see the preferred number closest to it: Wikipedia notes that putting the nearest Renard number in place of any number keeps the largest relative error as small as it can be.</p>' +
      '<p><b>Steps.</b> Kverneland prints the steps as 60 % (R5), 25 % (R10) and 12 % (R20); Wikipedia prints the ratios 1.58, 1.26, 1.12 and 1.06 (R5, R10, R20, R40).</p>' +
      '<p><b>Where they came from.</b> Charles Renard, a French army officer, worked them out in the 1870s (both sources). Kverneland writes that he cut the number of rope diameters for military balloons from 425 to 17 <i>(one publisher, to be verified)</i>. Wikipedia writes that the ISO adopted the system in 1949 as Recommendation R3, which became ISO 3 <i>(one publisher, to be verified)</i>.</p>' +
      '<p><b>Where they are used.</b> Kverneland lists screw threads, steel plates and sheets, round steel bars, lifting capacities and hydraulic cylinder diameters. Wikipedia lists the current ratings of fuses, the voltage ratings of capacitors and nail lengths. Kverneland writes that thousands of dollars can be saved for each fastener size taken out of a product or a stock <i>(one publisher, to be verified)</i>.</p>' +
      '<p class="abs"><b>Sources:</b> K. O. Kverneland, "How ISO standards cut manufacturing costs", Machine Design, 5 November 1998 (machinedesign.com archive), read 2026-11-13. Wikipedia, "Renard series", read 2026-11-13.</p>',
  },
  gdtstack: {
    use: '<p>Use it before parts that fit together are made, to see whether a gap, an overlap or an overall length can go wrong even when every part is inside its tolerance. List the dimensions around the loop with the sign of each, and the page gives the gap at nominal and the range it can take.</p>' +
      '<p><b>Worst case</b> puts every dimension at its limit at the same time: if the worst case works, every assembly of good parts works. <b>RSS</b> (root sum square) gives a narrower, more likely range, so the tolerances can be wider, but only when the parts come from steady processes centred in their tolerance; otherwise use worst case. A position or profile tolerance goes in as plus and minus half its zone.</p>',
  },
  capability: {
    use: '<p>Use it to answer "can this process hold this tolerance?" from measurements of parts already made. Cp compares the tolerance with the spread of the process; Cpk also takes in how far the average is off the middle of the tolerance, so a centred process has Cpk equal to Cp and an off-centre one a lower Cpk. Cp and Cpk use the short-term spread from part to part; Pp and Ppk use the overall spread of all the parts, so drift over the run shows up as Ppk well below Cpk.</p>' +
      '<p>Paste the readings in the order the parts were made: the short-term spread is worked out from neighbouring parts, so mixing the order changes it. The expected parts per million out of tolerance assume the measurements follow a normal curve; the histogram shows whether they do.</p>',
  },
  ctrlchart: {
    use: '<p>Use it to tell whether a process is running steady or something has changed (a worn tool, a new bar, a warm machine). The control limits come from the process itself, not from the drawing: a point outside them says something changed and is worth looking for, even while the parts are still in tolerance. A process inside its control limits can still make bad parts if its spread is wider than the tolerance: that is what Process capability checks.</p>' +
      '<p>Individuals and moving range suit one part measured at a time; X-bar and R suit small groups of parts made together (2 to 10), where the X-bar chart follows the average and the R chart the spread.</p>',
  },
  grr: {
    use: '<p>Use it before trusting a gauge on a job: it tells how much of the variation you see comes from the measuring rather than from the parts. Repeatability is one person measuring the same part again; reproducibility is the difference between people. Several people each measure the same set of parts more than once, without knowing which part is which.</p>' +
      '<p>The page compares the result with the guidelines of the automotive measurement systems manual as its sources quote them: under 10 % is acceptable, 10 to 30 % may be, over 30 % is not, and the number of distinct categories should be 5 or more.</p>',
  },
  sampling: {
    use: '<p>Use it when a batch is accepted or rejected on a sample instead of checking every part: take n parts, accept the batch if c or fewer are bad. The curve shows the chance of accepting a batch for every share of bad parts in it, so you can see what a plan really lets through before you agree to it: the level of bad parts still accepted 95 % of the time, the level accepted only 10 % of the time, and the worst average quality that leaves after rejected batches are sorted (AOQL).</p>',
  },
  chatter: {
    use: '<p>Use it when a cut chatters and you want a spindle speed where it may not. Chatter feeds itself because each tooth cuts the wavy surface left by the tooth before; at some speeds a whole number of waves fits between teeth and the waves line up, and the cut can stay quiet. Listen to the cut or type the chatter frequency, then try the speeds listed.</p>' +
      '<p>It is a rule-of-thumb estimate, not a full stability lobe diagram: it does not tell how deep a cut will be stable. Change one thing at a time and listen again.</p>',
  },
  balance: {
    use: '<p>Use it to know how well a rotating part (a pulley, a fixture on a spindle, a fan, a rotor) needs to be balanced, and whether a measured unbalance is good enough. The balance grade G is chosen for the kind of machine; the page turns it into the unbalance allowed at your mass and speed, split between the two correction planes, and the mass to add or remove at a radius.</p>' +
      '<p>The force the unbalance makes rises with the square of the speed, so a part fine at low speed may not be at high speed.</p>',
  },
  tempcomp: {
    use: '<p>Use it when a part is measured warm or cold, away from the 20 °C (68 °F) at which drawing sizes hold. A part straight off the machine or in a cold shop is a different size from the size it will be at 20 °C, and the gauge grows or shrinks too. The page corrects the reading to 20 °C, or gives the reading to aim for on a part that is not at 20 °C so that it is on size when it is.</p>' +
      '<p>The correction matters most on long parts, close tolerances and parts and gauges of different materials (aluminium measured with steel).</p>',
  },
  runout: {
    use: '<p>Use it when an end mill wears or chips on one tooth first, or when a tool runs out in its holder. With runout one tooth cuts a bigger chip than the rest; the page shows each tooth\'s chip and the feed per tooth that keeps the worst tooth at the chip you want, so the tool is not overloaded.</p>' +
      '<p>Measure the runout at the cutting edges with an indicator (TIR). A better holder or collet that brings the runout down lets the feed go back up.</p>',
  },
  toollife: {
    use: '<p>Use it to choose a cutting speed by cost, not only by how long the tool lasts. A faster speed makes each part quicker but wears the tool sooner, so more tools and tool changes; a slower speed saves tools but costs machine time. The page gives the cost per part and the tool life at which it is lowest, and the faster tool life for most parts per hour.</p>' +
      '<p>The Taylor figures (n and C) must come from your tool maker or your own records of tool life at two or more speeds; without them, enter a tool life you know.</p>',
  },
};
