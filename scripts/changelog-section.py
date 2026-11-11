#!/usr/bin/env python3
"""Print the CHANGELOG.md section for one version (release notes).

Usage: scripts/changelog-section.py v0.1.0
Looks for a heading "## [0.1.0]" (optionally followed by " - date"). If the
version has no section yet, falls back to "## [Unreleased]" and says so on
stderr, so a draft release still gets notes the owner can edit.
"""
import pathlib
import re
import sys

text = (pathlib.Path(__file__).resolve().parent.parent / "CHANGELOG.md").read_text(encoding="utf-8")


def section(name):
    m = re.search(r"^## \[" + re.escape(name) + r"\][^\n]*\n(.*?)(?=^## \[|\Z)", text, re.M | re.S)
    return m.group(1).strip() if m else None


version = sys.argv[1].lstrip("v") if len(sys.argv) > 1 else ""
body = section(version) if version else None
if body is None:
    print(f"CHANGELOG.md has no [{version}] section; using [Unreleased].", file=sys.stderr)
    body = section("Unreleased") or "See CHANGELOG.md."
print(body)
