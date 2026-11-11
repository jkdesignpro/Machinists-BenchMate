# Design language

BenchMate matches Alkart Mega Wizard (AMW) so Jacob's tools look like one family. Source of truth: the `:root` token block in AMW's `amw/static/index.html`, copied into `ui/tokens.css`.

- Serious engineering-tool look (JetBrains / Fusion style): flat surfaces, 1px borders, 4px radius, 12.5px Segoe UI text, JetBrains Mono / Cascadia Mono for numbers and code.
- No gradients, pills, glow or emoji.
- Light and dark themes via `prefers-color-scheme` plus a manual `data-theme` override. Accent blue `#2f6fde` (dark `#3d7ef0`).
- Layout: 38px title bar with menu bar and command search, 64px left tool rail (icon over small label), main work pane, results in a right side pane, status line.
- 16px stroke icons, 1.6 stroke width, round caps.
- Numbers in monospace, with units always shown; inch/metric toggle in the title bar.

LoomWright currently has no UI to match (README only). If it gets one, reconcile the tokens then.
