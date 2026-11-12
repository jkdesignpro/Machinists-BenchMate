#!/usr/bin/env python3
"""Turn CHANGELOG.md into app/data/changelog.json for the in-app "What's new" page.

Reads the Keep a Changelog layout: "## [version] - date" sections, "### Group"
headings and "- item" bullets (continuation lines are joined). Standard library only.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent


def parse(text):
    versions, cur, group = [], None, None
    for line in text.splitlines():
        m = re.match(r"^## \[?([^\]\s]+)\]?(?:\s*-\s*(.+))?$", line)
        if m:
            cur = {"version": m.group(1), "date": (m.group(2) or "").strip(), "groups": []}
            versions.append(cur)
            group = None
            continue
        if cur is None:
            continue
        m = re.match(r"^### (.+)$", line)
        if m:
            group = {"name": m.group(1).strip(), "items": []}
            cur["groups"].append(group)
            continue
        m = re.match(r"^- (.+)$", line)
        if m:
            if group is None:
                group = {"name": "", "items": []}
                cur["groups"].append(group)
            group["items"].append(m.group(1).strip())
            continue
        if line.startswith("  ") and group and group["items"] and line.strip():
            group["items"][-1] += " " + line.strip()
    clean = lambda s: re.sub(r"`([^`]*)`", r"\1", re.sub(r"\*\*([^*]*)\*\*", r"\1", re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)))
    for v in versions:
        for g in v["groups"]:
            g["items"] = [clean(i) for i in g["items"]]
    return [v for v in versions if any(g["items"] for g in v["groups"])]


def main():
    versions = parse((ROOT / "CHANGELOG.md").read_text(encoding="utf-8"))
    out = ROOT / "app" / "data" / "changelog.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"versions": versions}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"changelog: {len(versions)} versions -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
