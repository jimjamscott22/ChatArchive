# ChatArchive: Windows Packaging & Release Spec

## Goal
Ship ChatArchive (React/TypeScript frontend + FastAPI backend) as a double-click Windows desktop app, published as an installer on GitHub Releases. Launching the app starts the backend, opens the UI in a native window, and shuts everything down cleanly on exit.

## Chosen Approach
**Tauri v2 shell + FastAPI sidecar (frozen with PyInstaller) + GitHub Actions release pipeline.**

Why: small installer (tens of MB, not Electron's 100MB+), uses the system WebView2, no Python install needed on the user's machine, and the sidecar pattern is Tauri-native.

## Architecture

```
ChatArchive.exe (Tauri, Rust)
 ├── WebView2 window  → loads built React app (static assets bundled in Tauri)
 └── Sidecar process  → chatarchive-api.exe (PyInstaller-frozen FastAPI + uvicorn)
                          listens on 127.0.0.1:<port>
```

- The frontend talks to the backend over HTTP on localhost.
- Tauri spawns the sidecar on startup and kills it on exit (including crashes where possible).

## Requirements

### Functional
1. Double-clicking the app starts the backend and shows the UI with no console window.
2. Backend binds to `127.0.0.1` only, never `0.0.0.0`.
3. Port selection: pick a free port at startup (not a hardcoded one) and hand it to the frontend.
4. Readiness: the UI does not load until the backend health endpoint (`GET /health`) responds, with a splash/loading state and a timeout error screen.
5. Clean shutdown: closing the window terminates the sidecar. No orphaned `chatarchive-api.exe` in Task Manager.
6. Single instance: launching a second copy focuses the existing window.
7. User data (SQLite DB / archive files) lives in `%APPDATA%\ChatArchive`, never in the install directory. Survives uninstall and upgrade.

### Distribution
1. NSIS `.exe` installer (Tauri default) with Start Menu shortcut, optional desktop shortcut, and an uninstaller.
2. Optional: MSI via WiX (Tauri can emit both).
3. Published on GitHub Releases, triggered by pushing a `v*` tag.
4. Release assets include SHA256 checksums.
5. Optional later: WinGet manifest pointing at the release asset.

### Non-Functional
- Installer under ~60MB.
- Cold start to usable UI under ~5 seconds on a mid-range machine.
- Python deps managed with **uv** (`pyproject.toml` + `uv.lock`); builds use `uv sync --frozen`.
- Builds are reproducible in CI (Windows runner), not only on the dev machine.

## Out of Scope (for v1)
- Auto-update (Tauri updater plugin is a v1.1 candidate).
- Code signing. Unsigned builds will trigger SmartScreen; document "More info → Run anyway" in the README. Revisit with Azure Trusted Signing.
- macOS/Linux builds (the pipeline should not preclude them later).

## Repo Layout (target)

```
chatarchive/
├── backend/            # FastAPI app, pyproject.toml, uv.lock
│   └── entry.py        # sidecar entrypoint: parses --port, runs uvicorn
├── frontend/           # React + TS (Vite)
├── src-tauri/          # Tauri project
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   ├── binaries/       # sidecar exe lands here, named with target triple
│   └── src/main.rs
├── scripts/
│   └── build_sidecar.ps1
├── .github/workflows/release.yml
├── SPEC.md
├── IMPLEMENTATION_PLAN.md
└── README.md
```

## Key Technical Notes
- **Sidecar naming:** Tauri requires the binary be named `chatarchive-api-x86_64-pc-windows-msvc.exe` in `src-tauri/binaries/`, and declared under `bundle.externalBin` as `binaries/chatarchive-api`.
- **PyInstaller:** use `--onedir` or `--onefile`? Start with `--onefile` for simplicity, but switch to `--onedir` if cold start or antivirus flags are a problem (onefile unpacks to temp on every launch).
- **Hidden imports:** uvicorn and FastAPI need explicit `--hidden-import` entries (e.g. `uvicorn.logging`, `uvicorn.loops.auto`, `uvicorn.protocols.http.auto`, `uvicorn.lifespan.on`). Verify by running the frozen exe standalone first.
- **CORS:** Tauri's webview origin is `http://tauri.localhost` on Windows. Add it to the FastAPI CORS allow-list. Alternatively, route all calls through Tauri's HTTP plugin.
- **Tauri permissions (v2):** shell/sidecar execution must be allowed in the capabilities file, scoped to the one sidecar only.
- **Frontend API base URL:** obtained at runtime from Tauri (`invoke("get_backend_port")`), not baked in at build time.
- **Prerequisites on dev machine:** Rust toolchain (rustup, MSVC build tools), Node 20+, uv, WebView2 (preinstalled on Win 11).

## Acceptance Criteria
- [ ] Fresh Windows VM with no Python/Node/Rust: installer runs, app launches, UI works end-to-end.
- [ ] Closing the window leaves no background processes.
- [ ] Launching twice focuses the existing window.
- [ ] Reinstalling/upgrading preserves user data in `%APPDATA%\ChatArchive`.
- [ ] Pushing tag `v0.1.0` produces a GitHub Release with the installer and checksum attached.
- [ ] README documents install steps and the SmartScreen warning.
