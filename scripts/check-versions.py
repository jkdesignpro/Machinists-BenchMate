#!/usr/bin/env python3
"""Check that every place that states the app version agrees.

Usage: scripts/check-versions.py [expected]   e.g. scripts/check-versions.py v0.1.0
Exits 1 and lists the mismatches when they differ (CI and the release
workflow run this). Standard library only.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def cargo_version(path):
    text = (ROOT / path).read_text(encoding="utf-8")
    m = re.search(r'^\[package\][^\[]*?^version\s*=\s*"([^"]+)"', text, re.M | re.S)
    return m.group(1) if m else None


def found():
    out = {}
    root = (ROOT / "Cargo.toml").read_text(encoding="utf-8")
    members = re.search(r"members\s*=\s*\[([^\]]*)\]", root).group(1)
    for member in re.findall(r'"([^"]+)"', members):
        out[member + "/Cargo.toml"] = cargo_version(member + "/Cargo.toml")
    out["desktop/Cargo.toml"] = cargo_version("desktop/Cargo.toml")
    conf = json.loads((ROOT / "desktop/tauri.conf.json").read_text(encoding="utf-8"))
    out["desktop/tauri.conf.json"] = conf.get("version")
    app = (ROOT / "app/app.js").read_text(encoding="utf-8")
    m = re.search(r"#ver'\)\.textContent\s*=\s*'v([^']+)'", app)
    out["app/app.js (#ver)"] = m.group(1) if m else None
    for lock in ("Cargo.lock", "desktop/Cargo.lock"):
        p = ROOT / lock
        if p.exists():
            for name, ver in re.findall(r'name = "(benchmate-[^"]+)"\nversion = "([^"]+)"', p.read_text(encoding="utf-8")):
                out[f"{lock} ({name})"] = ver
    return out


def main():
    versions = found()
    want = sys.argv[1].lstrip("v") if len(sys.argv) > 1 and sys.argv[1] else None
    ref = want or versions["desktop/tauri.conf.json"]
    bad = {k: v for k, v in versions.items() if v != ref}
    for k, v in versions.items():
        print(f"{'ok ' if v == ref else 'BAD'} {k}: {v}")
    if bad:
        print(f"Version mismatch: expected {ref} everywhere.", file=sys.stderr)
        return 1
    print(f"All versions are {ref}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
