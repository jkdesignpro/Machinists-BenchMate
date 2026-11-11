# Design language and shell

BenchMate has its own look (from 0.2.0). It keeps the same bones as Jacob's other tools (top bar, left rail, content area, CSS tokens) but no longer copies their colours or sizes.

## Look
The look is called **Machine control** (chosen by Jacob on 2026-11-11 from four mock-ups, after the first 0.2.0 look read as a generic web app).

- **Feel:** the front of a CNC control. An enamel chassis with hard edges, results on readout screens, buttons and tabs as hard keys with a thick lower edge that press down. No rounded cards, soft shadows, gradient headers, pills or background grid.
- **Colour has a meaning.** The accent (`--key`, amber as standard) is the selected key, headings and "you are here". Green (`--digit`, `--hot`) is a computed number: the main result, a worked-out box, the answer on a drawing. Blue (`--dim`) is a dimension line on a drawing. Green, orange and red (`--ok`, `--warn`, `--err`) are only for status.
- **Accent colour is the user's.** The view menu has eight swatches and a colour picker; the choice is kept under `bm.accent`. `setAccent()` in `app/app.js` sets `--key`, `--key-ink` (black or white lettering, whichever has more contrast), and `--key-lift` / `--key-drop` (the colour lightened or darkened to a 4.5:1 contrast on the dark and the light panel), which `--accent` uses wherever the accent is text or a line. Use `--key` only as a fill behind `--key-ink`; use `--accent` for text, icons and lines.
- **Themes:** Dark (the standard), Light (a pale enamel panel with LCD-style readouts) and Auto (follows the system), in the view menu. `data-theme` on the root is always `dark`, `light` or `auto`. Every colour comes from `app/tokens.css`; nothing else hard-codes a colour (the ISO 513 material group colours are data, not styling).
- **Readout screens:** `.res`, `.screen` and a tool's results panel re-point `--panel`, `--line` and `--soft` to the screen tokens (`--screen`, `--screen-line`), so anything placed inside, a drawing included, picks up the screen colours.
- **Type:** 13 px system sans (Segoe UI, the system face on a Mac, Arial or Liberation Sans), headings and keys in capitals with letter spacing; JetBrains Mono / Cascadia Mono / Consolas for numbers and code. No web fonts: the app is offline.
- **Surfaces:** panels with a 1 px chassis edge (`--edge`), a light line on the top edge (`--bevel`) and a 2 to 3 px radius; keys 30 px high (`--keytop`, `--keybot`, `--keyedge`).
- **Icons:** BenchMate's own line icons in `app/icons.js` (24 px grid, 1.6 stroke, round caps). No icon fonts.
- **Units always shown** next to a number; inch / mm in the top bar and on each tool.

## Shell (`app/app.js`, `app/shell.css`)
- **Top bar:** brand, search (Ctrl+K or /), mode selector, active machine, units, calculator (Alt+C), view menu (theme, accent colour, Compact view, What's new).
- **Left rail:** Home, favourites, the workspaces (the open one lists its sections and pages), My shop.
- **Routes:** `#/home`, `#/w/<workspace>`, `#/t/<page>[/<tab>]`, `#/news`. `openTool(id)` opens a tool by id; a tool inside a hub opens the hub on that tab.
- **Pages and hubs** (`app/workspaces.js`): a page is one entry in the rail. A hub page holds several related tools as tabs. A tool or hub may be listed in more than one workspace; `UNLISTED_PAGES` must stay empty (the smoke test checks).
- **Modes:** Simple lists `SIMPLE_PAGES` (16) and hides inputs tagged `level: 'advanced'` (their defaults are used). Advanced lists everything. Expert also opens every "Formula and sources" block and every folded evidence table, and shows inputs tagged `level: 'expert'`. A mode never changes a calculation.
- **Compact view:** `body.compact` (auto below 820 px, or forced On/Off): one column, the rail as a drawer, a bottom bar. Built so a phone layout can reuse it.

## The standard calculator page (`mountTool`)
A registry entry (`fields`, `calc`, `working`, `source`) gets, without any code of its own: inputs on the left; the first result as a large tile and the rest in a table; a drawing under the results; decimals, reset, copy, pin to Home, units, formula and sources, favourite. Optional extras in the entry:
- `pairs: [[a, b, a_to_b, b_to_a, 'both'?]]`: two linked boxes. The box typed in last is the input; the other shows the worked-out value. The calculation sees the worked-out box as blank unless the pair says `'both'`.
- `pick`: fill fields from the tool library.
- `level` on a field; `when(v)` on a field to show it only when it applies.
- A drawing: `DIAGRAMS[id] = (v, sys, rows) => svg` in a `diagrams-*.js` file (or `diagram` in the entry).

Tools that need their own screen use `render: el => ...` and the shared classes (`grid`, `f`, `res`, `seg`, `btn`, `mfilter`).

## Drawings (`app/dk.js`)
One kit, one style: `DK.svg`, `fit`, `line`, `path`, `poly`, `rect`, `circle`, `cl` (centre line), `dim`, `dimH`, `dimV`, `angle`, `leader`, `arrow`, `text`, `n`. Classes: `part`, `hatch`, `ghost`, `ln`, `thin`, `hid`, `cl`, `tool`, `dim`, `hot`, `txt`, `mut`, `dimt`, `hott`.
- Draw the real situation, to scale where that helps, with ratios clamped so odd inputs never break the picture.
- Label with the user's numbers and units; put the answer on the drawing in the hot colour.
- Numbers on a drawing come from the inputs or the Rust results, never from a second calculation in JavaScript.
- Nothing may reach outside the viewBox. Check each drawing in both themes and both unit systems with `node tests/smoke/shot.mjs`, or all of them at once with `node tests/smoke/sheet.mjs out.png all` (it fails if anything is outside a frame).
- All art is BenchMate's own, drawn from the geometry.

## Home (`app/dashboard.js`)
A 12-column grid of widgets saved in `localStorage` (`bm.dash`): a calculator in small form (`mountTool(..., { mini: true })`), favourites, recent tools, pinned results, the calculator, tip of the day (`app/tips.js`), tool library, what's new. The first run asks what the user mostly does.
