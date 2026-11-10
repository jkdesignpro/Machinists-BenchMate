# Releasing Machinists BenchMate

The desktop app is a Tauri 2 wrapper (`desktop/`) around the static UI in `app/`.
All builds run on GitHub Actions; the repository is public, so the minutes are free.

| Workflow | When | What |
|---|---|---|
| `.github/workflows/ci.yml` | every push and pull request | version check, `cargo test`, WebAssembly build, headless Chromium smoke test of `app/` (every tool, inch and mm, the desktop CSP, no console errors), `clippy` and tests of the desktop crate. Run it by hand (Actions > CI > Run workflow) with *Also build the desktop installers* ticked to test-build every installer as workflow artifacts, without a release |
| `.github/workflows/build-desktop.yml` | called by `ci.yml` (by hand) and `release.yml` | the per-platform installer builds (reusable workflow) |
| `.github/workflows/release.yml` | you run it, or push a tag `v*` | Windows x64 `.msi` and NSIS `-setup.exe`, Linux x86_64 `.AppImage` and `.deb`, macOS Apple Silicon `.app.zip` (ad hoc signed, verified) and `.dmg`; optional macOS Intel; a **draft** GitHub Release with the CHANGELOG notes, the files and `SHA256SUMS.txt` |

Nothing is published until you press **Publish release** on the draft.

## Cutting a release

1. **Pick the version** (semver), e.g. `0.2.0`.
2. **Set it everywhere.** These must all agree (CI fails otherwise):
   - `core/Cargo.toml`, `wasm/Cargo.toml`, `desktop/Cargo.toml` (`version = "0.2.0"`)
   - `desktop/tauri.conf.json` (`"version": "0.2.0"`)
   - `app/app.js` (`$('#ver').textContent = 'v0.2.0'`)
   - run `cargo update -w` at the root and `cargo update -p benchmate-desktop` in `desktop/` so both `Cargo.lock` files follow.

   Check with `python3 scripts/check-versions.py v0.2.0`.
3. **CHANGELOG.** Rename `## [Unreleased]` to `## [0.2.0] - YYYY-MM-DD` and start a new empty `## [Unreleased]` above it. The release notes are that section (`scripts/changelog-section.py v0.2.0` prints them; with no section the draft gets the Unreleased notes).
4. **Merge to `main`** and wait for CI to pass.
5. **Start the build**, either way:
   - Actions tab > **Release** > **Run workflow** > branch `main`, version `v0.2.0` (tick *Also build macOS Intel* if wanted), or
   - `git tag v0.2.0 && git push origin v0.2.0`.
6. **Check the draft** (Releases page, about 15-25 minutes later): download each file and try it on a real machine (first launch, a calculation, a DXF save dialog, close and reopen to see settings kept).
7. **Publish** the draft. With *Run workflow* the tag `v0.2.0` is created on the built commit when you publish.

Re-running the workflow for the same version replaces the files on the existing draft.

## What the user sees (no paid certificates)

- **Windows:** unsigned installers make Microsoft Defender SmartScreen say "Windows protected your PC". The user clicks **More info > Run anyway**. Signing through SignPath (below) removes the unknown-publisher warning; SmartScreen reputation still builds up over the first downloads.
- **macOS:** the app is signed *ad hoc* (`codesign --force --deep --sign -`, then `codesign --verify --deep --strict`), the same approach as Alkart Mega Wizard. It is not notarised (that needs a paid Apple Developer ID), so the first launch is blocked: the user opens the app once, then **System Settings > Privacy & Security > Open Anyway** (macOS 15+; on older macOS, right-click > Open also works). Apple Silicon needs a valid signature to run at all, which the ad hoc signature provides.
- **Linux:** `chmod +x` the AppImage and run it, or `sudo apt install ./machinists-benchmate_*.deb`.

## Windows code signing with SignPath Foundation (free for open source)

The release workflow has a SignPath step that runs only when the secret `SIGNPATH_API_TOKEN` exists. Without it the Windows files ship unsigned and the run shows a notice.

### 1. Apply

1. Read the conditions at <https://signpath.org> (SignPath Foundation, free code signing for OSS). In short: an OSI-approved licence (AGPL-3.0 is), a public repository, builds made by CI from that repository (this workflow), no malware/PUP behaviour, a project that is maintained and released, and a code-signing policy page in the project.
2. Add a short **code signing policy** to the README or a `docs/code-signing.md` stating: "Free code signing provided by SignPath.io, certificate by SignPath Foundation", who the committers/reviewers/approvers are (you), and that releases are built by GitHub Actions from this repository. SignPath gives the exact wording to use.
3. Apply through the form on signpath.org with the repository URL. Approval can take a few weeks.
4. When accepted, SignPath sets up an organisation for you. In the SignPath web app:
   - Connect the GitHub repository as a **trusted build system** (GitHub.com) so SignPath accepts artifacts from this workflow.
   - Create a **project** (e.g. slug `Machinists-BenchMate`).
   - Create an **artifact configuration** for a ZIP that contains `*.msi` and `*.exe` at the root, signing each with Authenticode (the workflow uploads exactly `Machinists-BenchMate_<ver>_windows_x64.msi` and `..._windows_x64-setup.exe`). Example:
     ```xml
     <artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
       <zip-file>
         <msi-file path="*.msi"><authenticode-sign/></msi-file>
         <pe-file path="*.exe"><authenticode-sign/></pe-file>
       </zip-file>
     </artifact-configuration>
     ```
   - Note the **signing policy** slug (normally `release-signing`; there is also `test-signing` for trials).
   - Create a **CI user** and an **API token** for it, and give it submitter rights on the signing policy.

### 2. Add the secret and variables to GitHub

Repository > Settings > Secrets and variables > Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `SIGNPATH_API_TOKEN` | the CI user's API token |
| Variable | `SIGNPATH_ORGANIZATION_ID` | your SignPath organisation ID (a GUID) |
| Variable | `SIGNPATH_PROJECT_SLUG` | e.g. `Machinists-BenchMate` |
| Variable | `SIGNPATH_SIGNING_POLICY_SLUG` | e.g. `release-signing` |
| Variable | `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | the artifact configuration's slug (e.g. `initial`) |

On the next release run the Windows job uploads the unsigned installers, SignPath signs them (with `release-signing` an approver may have to press Approve in SignPath), and the signed files go into the draft release.

Note: this signs the installers. The `.exe` installed by them is not signed separately; SignPath can sign it too with a deeper artifact configuration (MSI and NSIS contents), which can be added later.

## macOS: optional Intel build and notarisation

- Intel: tick *Also build macOS Intel* when running the workflow (cross-compiled on the Apple Silicon runner, `macos-latest`).
- Notarisation would remove the Open Anyway step but needs an Apple Developer Program membership (paid). If that is ever added: set `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` as secrets, pass them to the `tauri build` step, and remove `"signingIdentity": "-"` from `desktop/tauri.conf.json` and the ad hoc `codesign` lines.

## Building the desktop app locally

```
rustup target add wasm32-unknown-unknown
scripts/build-web.sh                 # app/benchmate.wasm and app/data/
cargo install tauri-cli --version "^2" --locked   # or: npx @tauri-apps/cli@2 ...
cd desktop
cargo tauri build                    # installers in desktop/target/release/bundle/
```
Linux needs: `sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev patchelf build-essential file`.
Windows needs the WebView2 runtime (built into Windows 10/11) and the MSVC build tools. macOS needs Xcode command line tools.

To change the icon, edit `desktop/icons/icon.svg` and run `cargo tauri icon icons/icon.svg -o icons` in `desktop/` (then delete the `android/` and `ios/` folders it creates).

## Where the desktop app keeps its data

Settings, machine profiles, tool library, favourites and setup sheets live in the webview's localStorage, tied to the app identifier `com.jkdesignpro.benchmate`; they survive restarts and upgrades. Do not change the identifier, or users lose their saved data.

- Windows: `%LOCALAPPDATA%\com.jkdesignpro.benchmate\EBWebView`
- macOS: `~/Library/WebKit/com.jkdesignpro.benchmate` (and `~/Library/Application Support/com.jkdesignpro.benchmate`)
- Linux: `~/.local/share/com.jkdesignpro.benchmate/localstorage`
