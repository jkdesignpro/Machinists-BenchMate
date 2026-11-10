# G and M codes, macro reference

Screens: **G and M codes** (`gmcodes`) and **Macro reference** (`macroref`), group
"G-code reference", code in `app/gmcodes.js`. Data: `data/refdata/gcodes-evidence.json`,
built into `data/refdata.json` (key `gcodes`) by `scripts/build_refdata.py`.
Parity batch A4 (`docs/parity-audit.md`): U92, U93, CN21, CN22, CN81 done; U94, BB73 partial.

## Rules

- A code is listed for a control only when the maker's own public document prints it
  (or the machine builder's, or the maker's distribution network's document for
  that maker's machines), or two independent public sources agree. For the generic
  base the source is the public NIST RS274NGC report. The build stops on any row
  that has no source, names a source that is not in the file, or has only one
  independent source. Sources that copy each other share a `family` and count once
  (the two third-party Okuma lists; the two mfgrobots pages).
- One control's code is never shown as another's. A search for a code a control's
  sources do not list says "not confirmed for <control>" and names the controls
  that do list it; the compare view shows "Not confirmed" in that column.
- Meanings are BenchMate's own short wording. Nothing is copied from the manuals
  beyond code numbers and group numbers. Heidenhain's TNC 320 page was read in
  French and translated.
- Each row carries: code, modal group (only where the source prints it against the
  row), meaning, mill / lathe, option flag (where the source marks options), notes,
  and source keys with section or page. The UI shows the source per row with title,
  edition, URL and access date on hover.
- Where sources disagree both are recorded (see below). Where a manual edition is
  printed, it is given; older editions are flagged in the notes.
- The default control comes from the active machine profile's free-text Control
  field (keywords per control in `controls.<id>.match`, e.g. "Citizen" and "M70"
  map to Mitsubishi; "MELDAS" maps to MELDAS 60); a lathe-type machine sets the
  lathe filter.

## Control ids and the cycle generators

The cycle generators on `claude/cycles` (`core/src/gcode.rs`, `Ctrl`) use six
output dialects: 0 Generic ISO 6983 / Fanuc-style, 1 Haas, 2 Mitsubishi M70/M80,
3 Siemens 840D ISO mode, 4 Heidenhain ISO, 5 Okuma OSP. Each control here has
`cycles_ctrl` with that number: `generic` and `fanuc` = 0, `haas` = 1,
`mitsubishi` = 2, `siemens-iso` = 3, `heidenhain` = 4, `okuma` = 5. `meldas`,
`siemens` (native) and `mazak` have no generator dialect (`null`).

## Coverage (codes confirmed per control)

Rows can cover mill and lathe at once, so the mill and lathe columns overlap.
"Maker" includes builder, distributor and public-report sources.

| Control | G rows | M rows | Mill | Lathe | Maker | Two sources | Options marked | Macro facts | Gap notes |
|---|---|---|---|---|---|---|---|---|---|
| Generic ISO 6983 / RS-274 (NIST RS274NGC) | 52 | 14 | 66 | 0 | 66 | 0 | 0 | 0 | 2 |
| Fanuc (0i-F / 0i-F Plus; 30i family) | 138 | 2 | 86 | 60 | 136 | 4 | 8 | 11 | 5 |
| Haas (NGC mill and lathe) | 169 | 98 | 132 | 135 | 267 | 0 | 64 | 11 | 2 |
| Mitsubishi M70 / M80 / M800 | 66 | 8 | 19 | 70 | 74 | 0 | 9 | 2 | 3 |
| Mitsubishi MELDAS 60/60S (legacy lathe) | 65 | 0 | 0 | 65 | 65 | 0 | 6 | 1 | 2 |
| Siemens 840D sl (native) | 32 | 10 | 42 | 42 | 42 | 0 | 1 | 6 | 2 |
| Siemens 840D sl (ISO mode, milling) | 83 | 0 | 83 | 0 | 83 | 0 | 6 | 0 | 2 |
| Heidenhain TNC (DIN/ISO) | 37 | 0 | 37 | 0 | 37 | 0 | 0 | 1 | 2 |
| Okuma OSP (lathe, P200L/P20L) | 14 | 41 | 0 | 55 | 55 | 0 | 6 | 3 | 3 |
| Mazak (EIA/ISO, turning) | 74 | 0 | 0 | 74 | 74 | 0 | 16 | 1 | 3 |

Total 903 code rows, 36 macro facts, 9 recorded disagreements.

## Sources per control (all accessed 2026-11-10)

**Generic ISO 6983 / RS-274.** ISO 6983-1:2009 is cited by name only (not public).
[NIST] T. R. Kramer, F. M. Proctor, E. Messina, *The NIST RS274NGC Interpreter -
Version 3*, NISTIR 6556, 17 Aug 2000, US Government work (public domain): Table 4
modal groups (3.4, p. 20), Table 5 G codes (p. 22), M codes 3.6 (pp. 38-39).
https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6556.pdf. Second source:
LinuxCNC docs (GPL), G-code overview section 13 (modal groups) and the M-code
quick reference: https://linuxcnc.org/docs/html/gcode/overview.html,
https://linuxcnc.org/docs/html/gcode/m-code.html. LinuxCNC's extensions (G7/G8,
G33, G76, M61-M73 ...) are not listed as generic. NIST describes a 3-axis
machining centre, so the generic base is mill only.

**Fanuc.** [FAN_M] FANUC Series 0i-F Plus Operator's Manual (Machining Center
System), B-64694EN-2/01, Table 2 G code list (public copy:
https://manualmachine.com/fanuc/0ifplus/24332569-operators-manual). [FAN_T]
FANUC Series 0i-MODEL F lathe system, B-64604EN-1/01, Table 2 (a) G code list and
contents (sections 3.2-3.4, 4.1, 4.2, 4.7) (public copy:
https://manualmachine.com/fanuc/0if/18164311-operators-manual). Third-party:
[MFG_FT] mfgrobots A/B/C table (https://www.mfgrobots.com/Article/equipment/cnc/46176.html),
[MFG_F31] mfgrobots 30i/31i list (.../46743.html), [TIE] TIE / fanucworld
machining-centre list (https://content.fanucworld.com/?p=930), [IMD_SYS] Industrial
Monitor Direct, G-code systems A/B/C (2026-05-04). The text extraction of the
Fanuc tables separates group numbers from rows, so groups are given only where
they were printed against the row.

**Haas.** [HAAS_MG] Mill Operator's Manual chapter 17.1 (online, (c) 2025):
https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---g-codes.html.
[HAAS_MWB] Mill Programming Workbook ((c) 2015), G list pp. 14-17, M list pp. 20-21.
[HFO_L] Haas Factory Outlet (Productivity Inc.) Lathe Programming manual, revised
12/2024, G list pp. 70-72, M list pp. 73-74 (content adapted from Haas Automation).
[HAAS_LC] Haas lathe G&M code card, revised 04-09-02 (University of Florida copy),
used as a cross-check. [HAAS_MAC] Macro Programming Information (last published
27 June 2017). The current online Haas M-code and lathe pages refused to load
during this work.

**Mitsubishi M70/M80/M800.** [MIT_70L] MITSUBISHI CNC M700L/M700LV/M70L
Programming Manual, section 3.6 (public copy:
https://manualmachine.com/mitsubishicnc/m70l/19069133-programming-manual).
[MIT_EL] [MIT_EM] Mitsubishi Electric e-learning "The Basics of CNC Machining
Programming" for lathe (BNP-C8027-688) and machining centre (BNP-C8027-689),
(c) 2020, sections 1.6, 1.9, 3.3, 3.4. The M80/M800 programming manuals
(IB-1501275 to IB-1501278) could not be read.

**Mitsubishi MELDAS 60/60S (legacy).** [MIT_M60] MELDAS 60/60S programming
manual (lathe), BNP-B2181 revision H, section 3.8 G code list, pp. 15-19:
https://dl.mitsubishielectric.com/dl/fa/document/manual/cnc/bnp-b2181%28eng%29/bnp-b2181%28eng%29h.pdf.
The owner asked for MELDAS 600; no public MELDAS 600 manual was found, so the 60/60S
lathe manual stands in and MELDAS 600 is a gap.

**Siemens.** [SIE_C101] SINUMERIK Handbook: G codes & M codes (C101), Siemens
Limited (covers 802D to SINUMERIK ONE), pp. 4-5. [SIE_ISOM] SINUMERIK 840D sl /
802D sl ISO Milling programming manual, 06/2009, 6FC5398-7BP10-1BA0, Table B-1
(manualslib copy pp. 147-149). [SIE_PGA] Job Planning programming manual 03/2013,
6FC5398-2BP40-3BA1, chapter 1. Newer ISO-dialect editions exist but were not
readable here.

**Heidenhain.** [HEI_320] TNC 320 (77185x-01) DIN/ISO user's manual, 7/2014
(French), section 17.6 p. 553 (modes-d-emploi.com copy). [HEI_426] TNC 426 B
(280 472) ISO manual, section 10.6 p. 275. [ICAM_H] ICAM V27, Heidenhain ISO
pre-processor syntax (independent). Only page 553 of the overview could be read.

**Okuma.** [OKU_P200L] OSP-P200L/P20L Programming Manual, 3rd edition, 5238-E-R2
(LE33-013-R3), August 2007, sections 1-5 (manualmachine.com copy). [OKU_BLOG]
Okuma America blog, P. Russell. Third-party: [OKU_MTH] Machine Tool Help Okuma lathe
list (same text as mfgrobots article 46439, counted once); [ICAM_O] ICAM V27 Okuma
syntax.

**Mazak.** [MAZ_T] Yamazaki Mazak, Programming Manual, Programming EIA/ISO, for all
MAZATROL turning CNC (incl. T-Plus) and FUSION 640T NEXUS, C734PBT018E, 08.2002,
section 3-7 (copy attached on forums.autodesk.com). BenchMate lists the standard
EIA/ISO mode, series A code and gives series B and C codes in the notes.

**Macros.** [TORNOS] Tornos, Tips & Tricks B Macro, edition 4, 06.06.2017 (machine
builder, FANUC-controlled machines). [CNCC] CNCCookbook, G-code parameterized
programming (modified 27 April 2024).

## Disagreements recorded

| Control | Topic | What differs |
|---|---|---|
| Fanuc | G36 on the lathe | 0i-F lathe manual: G35/G36 circular threading. mfgrobots: G36/G37 automatic tool compensation X/Z. |
| Fanuc | Choosing system A/B/C | Maker: parameter 3401 bits 6 (GSB) and 7 (GSC). Industrial Monitor Direct: bit 0. BenchMate follows the maker. |
| Fanuc | #3000 / #3006 | Tornos: #3000 alarm stops, #3006 message without stopping. CNCCookbook: #3006 also stops. |
| Fanuc | Common variable ranges | CNCCookbook #100-#199 and #500-#999; Tornos #150-#199 per channel and #600-#699 shared. |
| Haas | G87 / G88 (mill) | In the 2015 workbook, not in the current online summary. |
| Haas | M110 / M111 (lathe) | 2002 card: tailstock chuck. 2024 HFO manual: secondary spindle chuck. |
| Haas | Global variables | The macro document reserves #500-#600 and gives #600-#699 to the user (600 in both, as printed). |
| Okuma | G95 | One third-party list prints "per minute (mm/rev)", the other per revolution; the maker's manual has per revolution. |
| Okuma | M98 / M99 | Third-party lists: tailstock thrust low/high, not subprogram calls. Not confirmed by the maker excerpt; recorded as a warning not to assume Fanuc meanings. |

Cross-control differences shown by the compare view (each from that control's own
source): G70/G71 (Fanuc lathe cycles, Haas mill bolt patterns, Siemens inch/metric);
G10-G16 (Heidenhain polar moves); G12/G13 (Haas pocket milling vs Heidenhain polar
arcs); G43/G44 (Mitsubishi lathe 2nd spindle vs tool length elsewhere); G65 (Okuma
mirror image vs macro call); G76 (Okuma automatic rounding vs threading or fine
boring); G90/G92/G94 and G98/G99 (lathe cycles and feed modes vs mill modes); G99
(Heidenhain tool definition).

## Gaps

Listed per control in the evidence file (`gaps`) and on screen. The main ones:

- Generic: RS274NGC parameters and expressions not transcribed.
- Fanuc: M00/M01/M02/M30 only from one Fanuc-specific source (see the generic base);
  lathe G98/G99 and B/C single-cycle codes (G77-G79, G20/G21/G24) from one
  third-party table; lathe drilling cycles G83-G89 not in the readable part of the
  maker's table.
- Haas: current online M-code pages could not be read (2015 workbook used).
- Mitsubishi: M80/M800 manuals not readable; which G-code list uses which code not
  confirmed; macro variable ranges and IF/WHILE syntax not confirmed.
- MELDAS 600: no public manual found.
- Siemens: ISO turning dialect; ISO-mode M codes; arithmetic function list.
- Heidenhain: remaining overview pages (pockets, contours, transformations, M
  functions); Q-parameter ranges and D-function numbers (one source).
- Okuma: OSP mill; G90/G91, LAP cycles, threading cycles and M08/M09 (third-party
  lists only); CALL/RTS/MODIN syntax (one source).
- Mazak: machining centre EIA codes; M codes; rows the extraction left unclear.
- Not built: letter-address table (BB73), program characters and layout (CN23, CN24).

## Tests

- `scripts/build_refdata.py` validates every row (source present and known,
  confirmation rule, meaning present, mill or lathe set, code format, no duplicate
  rows) and prints the per-control counts.
- Browser check (Playwright, 1280 px and 390 px): every tool opens with no console
  errors and no sideways page scroll; the default control follows a Mitsubishi
  machine profile; searches for G76, G01 (matches only G01) and "tapping"; G76 on
  Heidenhain reports "not confirmed"; Fanuc vs Siemens compare of G70; Fanuc vs
  Heidenhain compare of G200 shows "Not confirmed for Fanuc"; the macro reference
  finds WHILE for Fanuc and R parameters for Siemens.
