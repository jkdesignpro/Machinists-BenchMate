# Materials reference (parity batch B4)

Five screens in the Materials group: **Temper and heat-tint colours** (`tempercolours`),
**Heat treatment reference** (`heattreat`), **Galvanic series and two-metal check**
(`galvanic`), **Machining plastics** (`plastics`) and **Metal identification** (`metalid`).
UI in `app/matref.js`; data in `data/refdata/matref-evidence.json`, built into
`data/refdata.json` (section `matref`) by `build_matref()` in `scripts/build_refdata.py`;
the galvanic difference and anode choice are in `core/src/matref.rs` (tests there).

## Evidence model

Each value records what one free publisher prints: source key, value as printed (`v`, the
text or a close transcription), and the value in a common unit (°C, m/min, mm/rev, 10^-6/K,
kg/m³). Where a publisher prints °F itself, that °F is kept and shown (`fp`); otherwise the
other unit is converted by the Rust unit converter. Sources that copy another source share a
`family` and count once.

- **Confirmed**: two independent publishers agree, and no other value has two.
- **One source differs** (`confirmed_with_outlier`): two agree, a third prints something else; all shown.
- **Sources differ**: publishers print different values; every value is shown with its
  publisher, none is picked.
- **One source**: needs a second source.
- **As printed**: text (quench media), shown per publisher without comparing.
- **To be verified**: our own statement with no source yet (shown so, never hidden).

What "agree" means depends on the kind of value, and the screen says which rule it used:

| Values | Agree when |
|---|---|
| Temper colours | within 10 °C (charts are printed to the nearest 5-10 degrees; the colours themselves are approximate) |
| Heat treatment temperatures, plastics annealing | both ends within 3 °C (rounding of °F/°C conversions) |
| Plastics maximum service temperature, expansion, density | the printed values or ranges overlap (3 °C or 3 x 10^-6/K slack; 2 % for density) |
| Plastics cutting speed, feed, angles | both ends within 2 % (unit conversion) |
| Explanatory statements and terms | two independent publishers say the same or use the term in that sense; the wording is ours |

No handbook table was used (Machinery's Handbook or similar). Explanations, terms and notes
are written in our own words.

## Temper and heat-tint colours

Plain carbon steel: US Navy Aviation Structural Mechanic manual (Table 6-2), West Yorkshire
Steel's chart, and Wikipedia's row attributed to Kraemer (1983). Matching is by colour name
(our keys; each publisher's name is kept). Result: 7 colours confirmed, 1 confirmed with an
outlier (brown: Navy 254 °C and WYS 250 °C, Wikipedia/Kraemer 265 °C), 1 differs (light/pale
blue: Navy 321, WYS 310, Wikipedia 288 °C), 4 single source (WYS's yellow, violet, grey blue,
grey green).

Stainless steel heat tint: only the BSSA chart (via Wikipedia): 5 colours, single source.
Heat Treat Today (Herring, 2026) gives the same order by oxide thickness and the factors
(time, atmosphere, chromium, surface) but its temperature chart is an image.

Titanium: not built. The sources found treat titanium weld colour as a contamination check
(against the weld specification), not a temperature scale, and no two free publishers print a
titanium colour/temperature chart.

The screen says plainly that colours are approximate and depend on time, alloy, atmosphere and
surface.

## Heat treatment

Terms (12) in our own words; each lists the publishers whose data sheets use the term in that
sense: 7 used by two or more, 4 by one, case hardening (carburising) by none of the documents
read (marked to be verified).

Steels (12 grades, 70 values): 1045 (Lucefin C45E), 4140 (Lucefin 42CrMo4), 4340 (Atlas),
O1 (Uddeholm Arne, Doerrenberg 1.2510), A2 (Hudson, Doerrenberg 1.2363), D2 (Uddeholm
Sverker 21, Lucefin 1.2379), S7 (Hudson, GMH SWG 2357), H13 (Uddeholm Orvar Supreme,
Doerrenberg 1.2344), M2 (voestalpine Denmark data sheet), 416 (Atlas; Aalco's text is
identical and counts once), 420 (ATI, Atlas), 440C (Aalco). 17-4PH: Atlas prints solution
treatment and H900 to H1150 (°C, hours, minimum properties); Aalco and Atlas both state that
the condition number is the ageing temperature in °F (confirmed); the build checks every
printed °C against its condition name.

Result: 2 confirmed (D2 hardening 1000-1040 °C, Uddeholm "usually" and Lucefin; 420 annealing
843-899 / 840-900 °C), 16 differ, 38 single source, 14 printed text (quench media). Makers
genuinely recommend different ranges (for example O1 hardening 790-850 °C Uddeholm against
790-820 °C Doerrenberg; A2 tempering 177-260 °C Hudson against 500-550 °C Doerrenberg); both
are shown.

Tempering temperature against hardness: **not shown**. Only single publishers print it as
numbers (Lucefin for C45E in HRC and 42CrMo4 in HB and 1.2379; ATI for 420 in HRC; Atlas for
416 and 420 in HB); the tool makers print graphs. No two independent publishers print the same
steel, hardening and hardness scale.

Notes on sources: the Lucefin 1.2379 card is a 2018 edition (EN ISO 4957:2018 is current);
Doerrenberg says "similar to AISI" for 1.2510 and 1.2344 and names no AISI grade for 1.2363;
ATI's sheet names 440C in the title but gives no 440C heat treatment.

## Galvanic series and two-metal check

- Seawater series: Dave Gerr, "Controlling Galvanic Corrosion" (33 metals, mV against
  Ag/AgCl at 77 °F; single publisher), with his rule that metals in contact in seawater should
  differ by less than 0.20 V. Checked against Wikipedia's order for stagnant seawater (from
  MIL-STD-889C and others; order only): the checker says whether the two sources agree on which
  metal of the pair is the anode. Lead and tin, for example, are the other way round.
- Anodic index: Engineers Edge table (19 groups, the MIL-STD-889 layout; single publisher).
  Limits 0.15 V harsh, 0.25 V normal, 0.50 V controlled: confirmed by Engineers Edge and Carr
  Lane (Carr Lane adds that they are not for critical parts).
- MISUMI's "anodic index" table prints signed values with no environment or reference; it is
  a different scale and is listed as a source but not mixed in.
- Calculation (`core/src/matref.rs`): ΔE = |E_A − E_B|; the anode is the more negative metal in
  the seawater series or the larger index in the anodic index table; within the limit when
  ΔE ≤ limit. The area and moisture advice on the screen is general practice in our words.

## Machining plastics

12 plastics: acetal, PA6, PA66, PEEK, UHMW-PE, PTFE, PC, PMMA, PVC, PP, ABS, PEI.

- Where BenchMate's material data already holds the plastic (acetal, nylon, PEEK, PTFE,
  UHMW-PE), density and expansion are read from `data/materials.json` with their own status and
  a button opens Material equivalents; the build refuses to store them twice.
- Maximum service temperature (W.S. Hampshire °F, Professional Plastics "upper working
  temperature" °C): 10 confirmed, 2 differ (PC: 290 °F against 115-130 °C; PP: 140 °F
  against 90-120 °C).
- Expansion for the 7 plastics not in the material data (W.S. Hampshire in/in/°F x 10^-5,
  Professional Plastics 10^-6/K): 3 confirmed (PC, PVC, PEI), 4 differ. Density for those 7:
  W.S. Hampshire only.
- Annealing hold temperature: PA6 160 °C confirmed (MCAM and Ensinger); PEEK differs (250 against
  221 °C); others single.
- Starting turning data (speed, feed, clearance and rake angles) from Mitsubishi Chemical
  Advanced Materials (Machinist Toolkit), Ensinger (machining guide hosted by Curbell) and
  Boedeker Plastics: 1 confirmed (PEI rake 0-10°), 32 differ, 14 single. Boedeker's angle
  columns match Ensinger's for most plastics, so its angles count with Ensinger. The Ensinger
  imperial table's text is out of order; turning values were read by column position (marked
  in the source note). MCAM's PTFE rows are filled Fluorosint grades and are not used for virgin
  PTFE. MCAM rows are trade names, matched to generic plastics by us.
- Notes per plastic and general practice in our own words, each with the publishers that say
  the same.
- 0.7.0: the family of each plastic (amorphous or semi-crystalline; nine on two publishers,
  UHMW-PE, PTFE and PVC on one) and fourteen statements on thermoplastics, thermosets and the
  two families in our own words. Two of them are marked "sources differ" and print both views
  (cost, heat). Sources and what was left unread: `docs/sources.md`, Families of plastics.

## Metal identification (low priority)

Spark, magnet and chip tests from the US Navy Steelworker manual (single source; spark stream
lengths, colours and bursts for wrought iron, low- and high-carbon steel, grey cast iron,
stainless, nickel and Monel). The file test and appearance are our own statements, marked to
be verified.

Added in 0.7.0: the magnet on stainless and "use a certificate or an analysis" now rest on
Atlas Steels Tech Note 1 and EngineerExcel (two publishers). Three chemical spot tests from
Atlas Steels: nitric acid (stainless or not), the molybdenum spot test (304 from 316) and the
sulphur print (free-machining steels), each with its limits and one source. EngineerExcel
describes the result of the nitric acid test differently, so that row is marked "sources
differ" and prints both. URLs in docs/sources.md, "Chemical spot tests".

## Not built from batch B4

Tool steel selection guide, corrosion types beyond galvanic, machining nonferrous metals
(MH159), non-metals other than plastics (MH160), mill certificates (ED63), zinc and magnesium
alloys (ED58, MH64), hardenability, subzero treatment, titanium heat-tint colours.

## Fetch log

38 page fetches and 8 searches (2026-11-11). Fetch failed: Doerrenberg 1.2379 (robots
disallowed). The Ensinger stock-shapes catalogue page gave no property values.
