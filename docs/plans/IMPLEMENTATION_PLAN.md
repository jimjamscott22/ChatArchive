# ChatArchive: Windows Packaging Implementation Plan

Read `SPEC.md` first. Work through the phases in order. Each phase ends with a verification step; don't move on until it passes. Commit after each phase.

Version note: Tauri APIs shift. Before each Tauri step, check the current v2 docs (Context7 or tauri.app) rather than trusting memory for plugin names and capability syntax.

---

## Phase 0: Prerequisites

- [ ] Confirm toolchain on the Windows dev machine: `rustup` (MSVC target), Visual Studio Build Tools (C++ workload), Node 20+, `uv`, Git.
- [ ] Confirm the existing app runs in dev: backend via `uv run uvicorn ...`, frontend via `npm run dev`.
- [ ] Add `GET /health` to the FastAPI app returning `{"status": "ok"}` if it doesn't exist.
- [ ] Make the backend's data directory configurable via env var or CLI flag (`CHATARCHIVE_DATA_DIR`). Default to `%APPDATA%\ChatArchive` via `platformdirs`.

**Verify:** `curl http://127.0.0.1:8000/health` returns ok; data dir is created in the expected place.

---

## Phase 1: Backend sidecar entrypoint

- [ ] Create `backend/entry.py`:
  - Parse `--port` (required) and optional `--data-dir`.
  - Start uvicorn programmatically: `uvicorn.run(app, host="127.0.0.1", port=port, log_config=None)`. Avoid the uvicorn reload/workers options, since they break when frozen.
  - **Parent-death watchdog:** start a daemon thread that blocks on `sys.stdin.read()`. When stdin closes (Tauri exits or crashes), call `os._exit(0)`. This prevents orphaned processes, which matters because a PyInstaller `--onefile` exe is a bootloader plus a child process, and killing the bootloader alone can leave the child running.
- [ ] Add dependencies for freezing: `uv add --dev pyinstaller`.
- [ ] Write `scripts/build_sidecar.ps1`:
  1. `cd backend; uv sync --frozen`
  2. `uv run pyinstaller --onefile --noconsole --name chatarchive-api entry.py` plus the `--hidden-import` flags from SPEC.md (and `--collect-submodules` for any package that needs it)
  3. Get the Rust target triple with `rustc -vV` (parse the `host:` line)
  4. Copy `dist/chatarchive-api.exe` to `src-tauri/binaries/chatarchive-api-<triple>.exe`
- [ ] Add `src-tauri/binaries/` and PyInstaller `build/`, `dist/`, `*.spec` outputs to `.gitignore`.

**Verify:** run the frozen exe standalone from a terminal: `chatarchive-api-x86_64-pc-windows-msvc.exe --port 8765`, then hit `/health`. Close stdin (Ctrl+Z, Enter, or pipe from a closed handle) and confirm the process exits. Fix missing hidden imports until this works. This is the step where most packaging bugs surface, so it's worth getting solid before touching Tauri.

---

## Phase 2: Tauri shell

- [ ] From the repo root: `npm create tauri-app@latest` (or `npx tauri init` inside the existing frontend setup). Point it at the existing Vite frontend (`frontendDist` = `../frontend/dist`, `devUrl` = Vite dev URL).
- [ ] Add plugins: `tauri-plugin-shell` (sidecar spawning) and `tauri-plugin-single-instance`.
- [ ] In `tauri.conf.json`: set product name `ChatArchive`, a proper identifier (e.g. `me.jamielab.chatarchive`), icons, `bundle.targets` = `["nsis"]`, and `bundle.externalBin` = `["binaries/chatarchive-api"]`.
- [ ] Capabilities file: allow spawning the sidecar only, scoped by name (`chatarchive-api`, `sidecar: true`). Don't grant general shell access.
- [ ] In `src-tauri/src/main.rs` / `lib.rs`:
  1. Pick a free port: bind a `TcpListener` to `127.0.0.1:0`, read the port, drop the listener.
  2. Spawn the sidecar with `--port <port>`, with stdin piped and kept open (this is what the watchdog watches).
  3. Store the port and child handle in Tauri managed state.
  4. Expose a command `get_backend_port` to the frontend.
  5. Poll `GET /health` (short interval, ~10s timeout) and emit a `backend-ready` event, or `backend-failed` on timeout.
  6. On window close / app exit, kill the child explicitly.
  7. Register the single-instance plugin so a second launch focuses the existing window.
- [ ] Capture sidecar stdout/stderr and write to a log file in the app data dir (`%APPDATA%\ChatArchive\logs`). This is essential for debugging installed builds.

**Verify:** `npm run tauri dev` opens a window and the backend is spawned. Check Task Manager: closing the window leaves no `chatarchive-api` process.

---

## Phase 3: Frontend integration

- [ ] Add an API base-URL module: on startup in Tauri, `invoke("get_backend_port")` and set base to `http://127.0.0.1:<port>`. Fall back to the dev URL when not running in Tauri (`window.__TAURI_INTERNALS__` check) so plain-browser dev still works.
- [ ] Add a splash/loading screen shown until `backend-ready`, and an error screen (with a "view logs" hint) on `backend-failed`.
- [ ] Update FastAPI CORS allow-list to include `http://tauri.localhost` (Windows webview origin) alongside the dev origins. Verify the exact origin in devtools rather than assuming.
- [ ] Remove any hardcoded `localhost:8000` references in the frontend.

**Verify:** `npm run tauri dev` end to end: UI loads, data reads and writes work, data lands in `%APPDATA%\ChatArchive`.

---

## Phase 4: Local production build

- [ ] Run `scripts/build_sidecar.ps1`, then `npm run tauri build`.
- [ ] Install the generated NSIS installer (`src-tauri/target/release/bundle/nsis/`).
- [ ] Test on a clean Windows VM (Windows Sandbox is an easy option) with no Python/Node/Rust installed.
- [ ] Walk through the acceptance criteria in SPEC.md: launch, single-instance, clean shutdown, uninstall, reinstall with data preserved.

**Verify:** all acceptance checkboxes except the CI/release ones pass. If antivirus flags the sidecar, note it and consider Nuitka as a follow-up.

---

## Phase 5: GitHub Actions release pipeline

- [ ] Create `.github/workflows/release.yml`, triggered on push of tags matching `v*`, running on `windows-latest`.
- [ ] Steps:
  1. `actions/checkout`
  2. `actions/setup-node` (Node 20, npm cache)
  3. `dtolnay/rust-toolchain@stable`, plus a Rust cache (`swatinem/rust-cache`)
  4. `astral-sh/setup-uv`
  5. `npm ci` for the frontend
  6. Run `scripts/build_sidecar.ps1`
  7. `tauri-apps/tauri-action` with `tagName: ${{ github.ref_name }}` and `releaseName: "ChatArchive ${{ github.ref_name }}"`. Create the release as a **draft** first so you can review before publishing.
  8. Generate SHA256 checksums for the installer and upload them as a release asset.
- [ ] Use only the built-in `GITHUB_TOKEN` (set `permissions: contents: write`). No other secrets are needed for v1.
- [ ] Keep the version in one place: `src-tauri/tauri.conf.json` is the source of truth; document the release process (bump version, commit, tag, push).

**Verify:** push tag `v0.1.0-rc1` on a test branch or fork first. Confirm the draft release has the installer and checksum, then download and install the CI-built artifact on the VM.

---

## Phase 6: Docs and polish

- [ ] README: screenshot, install instructions, system requirements, the SmartScreen "More info → Run anyway" walkthrough, where user data lives, how to report issues.
- [ ] README "Building from source" section covering prerequisites and the commands from Phases 1 to 4.
- [ ] Proper app icon set (`npx tauri icon source.png`).
- [ ] Tag `v0.1.0`, publish the release, and link it from the GitHub profile / portfolio page.

---

## Backlog (post v1)

- Tauri updater plugin for auto-updates (needs a signing keypair for update manifests, separate from Windows code signing).
- Code signing via Azure Trusted Signing to remove the SmartScreen warning.
- WinGet manifest submission to `microsoft/winget-pkgs`.
- MSI output via WiX for enterprise-style deployment.
- Nuitka build of the sidecar if PyInstaller triggers AV false positives.
- macOS and Linux targets via a CI matrix.

## Known Risks

| Risk | Mitigation |
|---|---|
| Orphaned sidecar process after crash | stdin-close watchdog in `entry.py` plus explicit kill in Tauri |
| PyInstaller missing hidden imports | Verify frozen exe standalone in Phase 1 before integrating |
| AV false positives on onefile exe | Document, submit to vendors, consider Nuitka |
| CORS origin mismatch in production | Check actual origin in devtools; add to allow-list |
| SmartScreen warning on unsigned installer | Documented in README; signing in backlog |
