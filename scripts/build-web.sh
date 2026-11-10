#!/bin/sh
# Build the Rust formulas to WebAssembly and place them next to the UI.
# Needs: rustup target add wasm32-unknown-unknown
set -e
cd "$(dirname "$0")/.."
cargo build -p benchmate-wasm --target wasm32-unknown-unknown --release
cp target/wasm32-unknown-unknown/release/benchmate_wasm.wasm app/benchmate.wasm
python3 scripts/build_materials.py
mkdir -p app/data && cp data/materials.json app/data/
echo "Built app/benchmate.wasm. Serve the app/ folder, e.g.: cd app && python3 -m http.server 8765"
