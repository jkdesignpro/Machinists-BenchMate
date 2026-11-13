# Milling strategy decider (0.8.0)

The page **Milling strategy: which roughing toolpath** (`app/strategy.js`) marks four roughing strategies
for a feature, a tool reach and a machine: adaptive or trochoidal (high-efficiency milling), traditional
roughing, plunge roughing and high-feed milling. It does no arithmetic: every reason it shows is a
statement from the sources below, with the key. A statement printed by one publisher only is marked
"to be verified". Where the sources disagree, both are shown.

The machine answers (how the control copes with many short moves, rigidity class, guideways) come from
the active machine profile, which since 0.8.0 records them (see Machine profiles).

## Sources (read 2026-11-13)

| Key | Source |
|---|---|
| BALL_MMT | J. Ball (Seco Tools), "The Hidden Complexities of Optimized Roughing", MoldMaking Technology, 14 June 2018 |
| GRANDT_PI | D. Grandt and S. Tiehen (Harvey Performance), "Boosting Shop Productivity by Applying High Efficiency Milling Techniques", Productivity Inc. blog, 27 February 2020 |
| LEVENTON_CTE | W. Leventon, "Lauding Light Cutting", Cutting Tool Engineering, 15 August 2025 |
| SOLIDCAM_AM | SolidCAM, "Adaptive Milling: Toolpath Strategies", SolidCAM blog, 27 August 2026 |
| KENNEDY_CTE | B. Kennedy, "Plunge Milling Improves Metal Removal in Deep Machining", Cutting Tool Engineering, 1 March 2012 |
| AM_LOWPOWER | "Faster Chipmaking On Low-Power Machines", American Machinist, 12 August 2010 |
| TUNG_HF | Tungaloy, "High feed knowledge academy" (no date), and M. van den Hoonaard (Tungaloy Germany), "New tasks for high-feed milling", industrial-production.de, 27 January 2022: counted as one publisher |

Leventon and Kennedy both write in Cutting Tool Engineering, but they are different articles by different
authors quoting different people; they are counted as one publisher where they make the same statement.

## Statements used

| Statement | Sources | Status |
|---|---|---|
| Trochoidal paths keep the load even in slots and pockets; straight passes meet sudden load changes in slots and corners | SOLIDCAM_AM, LEVENTON_CTE | two publishers |
| Best on straight-walled cavities and prismatic features | BALL_MMT | to be verified |
| Large depths leave stair steps on 3D surfaces; not for complex 3D contours | BALL_MMT | to be verified |
| Needs a control with the processing speed for many short moves; older machines may not manage | BALL_MMT, GRANDT_PI, LEVENTON_CTE | two or more publishers |
| Without enough look-ahead: jerky motion, gouging, chatter, poor finish; a control that cannot hold the path limits the feed | LEVENTON_CTE, SOLIDCAM_AM | two publishers |
| Run a test cut, or simulate, before an untried HEM routine | LEVENTON_CTE | one publisher (advice) |
| Rigidity: needs a rigid machine and good spindles (Ball, Grandt); the deep axial cut needs a rigid tool, holder, fixture and machine (SolidCAM); lets shops cut hard materials on machines not rigid enough for conventional milling (a builder quoted by Leventon) | all four | **disagree: shown side by side** |
| Depth of cut up to 2 x D (diameter at least half the depth) | BALL_MMT | to be verified |
| Used on stainless and nickel alloys, not only soft metals | LEVENTON_CTE | to be verified |
| Flutes: 5 to 9 (Ball); 5, 6, 7 and more (Grandt) | BALL_MMT, GRANDT_PI | shown side by side |
| Straight passes need far fewer lines of code | BALL_MMT | to be verified |
| Plunging: forces axial into spindle and table; side forces go away; eases fixturing | AM_LOWPOWER, KENNEDY_CTE | two publishers |
| Plunging suits old, less rigid, light or low-power machines | KENNEDY_CTE, AM_LOWPOWER | two publishers |
| Plunging suits long reach and deep features | KENNEDY_CTE | to be verified |
| Plunging chatters at 4 to 6 diameters of reach | KENNEDY_CTE | to be verified |
| A linear-guide machine takes less plunging chip load than a box-way machine | KENNEDY_CTE (a machine builder) | to be verified |
| Plunging keeps heat low, helps stainless | KENNEDY_CTE | to be verified |
| Plunging leaves scallops; roughing; step-over must suit the cutter | KENNEDY_CTE | to be verified |
| High-feed: shallow depth, high feed per tooth, force mostly axial, little vibration | TUNG_HF | one publisher |
| High-feed works on low-power machines (cut shallow, feed fast) | TUNG_HF, AM_LOWPOWER | two publishers |
| High-feed suits long projection; deep pockets in shallow passes; not for deep axial cuts or finishing walls; can push thin parts out of shape; needs acceleration and control response | TUNG_HF | to be verified |

## BenchMate's own choices

- A reach or a depth over 3 x the tool diameter counts as long. No source sets a line.
- Verdict: a reason that rules a strategy out (no CAM toolpaths, a control that stutters) marks it
  Not suited; two or more reasons for, beyond those against, mark it a Good fit; more against than for,
  Less suited; otherwise Possible.
