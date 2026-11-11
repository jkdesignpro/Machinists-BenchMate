# Tooling reference (parity batch B3)

Branch `claude/tooling-ref`, 2026-11-11. What was built, where each value comes from, and what is left out.

## Tools

| Tool | id | Code |
|---|---|---|
| Tooling guide | `toolguide` | `app/tooling.js` (`renderToolGuide`) |
| Tap pitch diameter limits (H and D numbers) | `taplimits` | `app/tooling.js` (`renderTapLimits`), `core/src/tooling.rs` |
| Saw blade pitch (TPI) | `sawtpi` | `app/tools.js`, `core/src/tooling.rs` |
| Forming tap makers compared (in Tap drill size, forming mode) | `tapdrill` | `app/tooling.js` (`formTapCompare`), `app/refdata.js` |

Data: `data/refdata/tooling-evidence.json`, built into `data/refdata.json` (`tooling`) by `scripts/build_refdata.py` (`build_tooling`).

Already covered elsewhere and not repeated: insert and holder codes (`insertcode`, `holdercode`), ISO 513 groups (`iso513`), drill sizes (`drillchart`), drill point length (`drillpoint`), spot and centre drill depth (`spotdepth`), tap drill sizes for cutting and forming taps (`tapdrill`), bandsaw cut time (`bandsaw`), tool wear (`cncguide`).

## Evidence rules

- A value is **confirmed** when two independent free publishers print it. Copies count once: USCTI's tapping tips are GWS Tool Group's text, so USCTI and GWS are one family in the guide's source tags.
- Where publishers disagree, every value is shown with who prints it. Nothing is averaged or picked.
- A value or statement from one publisher is flagged **needs 2nd source** (the build reports it as `review`).
- Text is our own wording. No handbook, standard or catalogue text or table was copied. Machinery's Handbook was not used as a source.

## Results of the checks

### Tap limits

| Item | Value | Publishers | Status |
|---|---|---|---|
| H (and L) number step | 0.0005 in | OSG, USCTI, MSC, Cutting Tool Supply | confirmed |
| H band width through 1 in | 0.0005 in (H1 = basic to + 0.0005) | OSG, MSC | confirmed |
| H band width over 1 in to 1-1/2 in | 0.0010 in (H4 = + 0.0010 to + 0.0020) | OSG | needs 2nd source |
| L number step | 0.0005 in below basic | USCTI | needs 2nd source |
| D number step | 0.0005 in (OSG, from D3 to D9 maxima) and 0.013 mm (USCTI) | OSG, USCTI | confirmed at 0.0005 in; the two differ by 0.0003 mm per number and both are used on screen |
| D number minimums | OSG's printed bands D3 to D9 | OSG | needs 2nd source |
| 40 % rule | tap about 40 % of the tolerance above minimum | Cutting Tool Supply | needs 2nd source |

Checks (tests in `core/src/tooling.rs`): USCTI's 1/4-20 GH5 max 0.2200 and GL3 min 0.2160; OSG's H1, H5 and over-1-in H4 bands; USCTI's M6 x 1 D5 and DU3 sums. The 40 % rule reproduces OSG's printed recommendation for 1/4-20 3B (H3), 1/2-13 2B (H5) and M6 x 1 6H (D5); for 1/4-20 2B it gives H4 where OSG prints H5. The screen shows both.

USCTI's M6 x 1 example uses a basic pitch diameter of 5.530 mm in its sums while its text says 5.350 mm (ISO 724: 5.350). The test keeps its arithmetic; BenchMate uses the ISO formula.

Found while checking: BenchMate's class 2B maximum pitch diameter for 1/4-20 is 0.2223 in, OSG prints 0.2224 in. That comes from the existing Thread data formulas (`un_limit`), not from this batch, and was not changed here.

### Forming tap hole

| Item | Value | Publishers | Status |
|---|---|---|---|
| Inch constant | hole = D - 0.0068 x % / TPI | North American Tool, Besly (CTE 1995), MSC, FM Carbide, Engineers Edge | confirmed (two tap makers) |
| Metric divisor | hole = D - % x P / 147.06 | North American Tool, FM Carbide | confirmed; MSC prints the 0.0068 a second time (an error), shown as printed and marked as differing |
| Shortcut | D - P/2 (= 73.5 % on the rule) | MSC | needs 2nd source |

Balax, a forming tap maker, prints miniature hole sizes 0 to 0.0016 in larger than the rule (see `docs/sources.md`, Tap drills). North American Tool gives 55 to 75 % as the range and Besly says not to form above 75 %.

### Coating maximum temperature (°C, as printed)

| Coating | Values (publishers) | Status |
|---|---|---|
| TiN | 600 (Oerlikon Balzers, Hartner, Brycoat); 500 (GWS, Jozef Stefan Institute) | differ |
| TiCN | 400 (Balzers, Brycoat); 450 (Hartner) | one differs |
| TiAlN | 800 (Hartner, Brycoat); 1100 (Balzers, a TiAlN-based brand); 900 (JSI) | differ |
| AlTiN | 800 (GWS, Brycoat); 1000 (Balzers); 900 (Hartner); 1100 (JSI, AlTiN/TiN nano-layer) | differ |
| AlCrN | 1100 (Balzers) | needs 2nd source |
| DLC | 500 (Hartner) | needs 2nd source |
| CVD diamond | 600 (Balzers, Hartner) | confirmed |
| ZrN | 700 (Hartner); 600 (Brycoat) | differ |
| CrN | 700 (Brycoat); 750 (JSI) | differ |
| CVD Al2O3 | none printed by the sources compared | not given |

Some publishers call the figure an oxidation temperature (GWS); brand coatings are their own recipes. The guide says so and shows every value.

### Saw blade pitch

| Item | Value | Publishers | Status |
|---|---|---|---|
| Fewest teeth in the cut | 3 | Starrett, RMT | confirmed |
| Upper figure | no more than about 10 to 14 (soft materials) | Starrett | needs 2nd source |
| Preferred range | 6 to 12 | RMT | needs 2nd source |

### Guide statements

Each paragraph of the guide carries its source keys. Confirmed by two independent sources: tap types and chip direction (MSC, Travers), forming tap properties (MSC, RS, Travers), reamer flute direction by hole (Gammons, Cutwel), drill point angles 118 and 135 (Regal, Travers), end mill flute trade-offs, end shapes and roughers (Productivity, Brother), coating choice by work material (Productivity, Hartner), CVD Al2O3 against crater wear (Mitsubishi Materials, Seco, from the CNC guide sources). Single-source and flagged: variable helix, high helix for aluminium, split points and points over 140, drill types, reamer stock and speed, broken tap methods (RapidDirect only). Not sourced yet and flagged: the geometry definitions (rake, clearance, chip breaker, edge hone), tool materials summary, high-feed mills, point thinning. The lead angle = 90° - entering angle relation and chip thickness f sin(kr) are geometry (OWN).

## Not built

- Hole saw speeds: no two independent maker charts were compared, so none are given.
- Broaching, burrs, mounted points, files, drill and HSS toolbit sharpening, colour-coded maker taps, pipe and STI tap limits, maker grade comparison charts.
- The research budget ran out before a second source was read for the geometry terms and broken tap removal; those statements stay flagged.
