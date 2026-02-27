# ChatArchive build script
# Run from the project root: .\build.ps1
# Output: dist\ChatArchive\ChatArchive.exe

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot

# ── Prerequisites ────────────────────────────────────────────────────────────

foreach ($cmd in @("npm", "python", "pyinstaller")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "$cmd not found. Ensure it is installed and on your PATH."
        exit 1
    }
}

# ── Step 1: Build the React frontend ────────────────────────────────────────

Write-Host ""
Write-Host "=== Step 1/2: Building frontend ===" -ForegroundColor Cyan
Push-Location (Join-Path $rootDir "frontend")
try {
    npm install
    npm run build
} finally {
    Pop-Location
}

$distDir = Join-Path $rootDir "frontend\dist"
if (-not (Test-Path $distDir)) {
    Write-Error "Frontend build failed — dist folder not found."
    exit 1
}
Write-Host "Frontend built successfully." -ForegroundColor Green

# ── Step 2: Bundle with PyInstaller ─────────────────────────────────────────

Write-Host ""
Write-Host "=== Step 2/2: Bundling with PyInstaller ===" -ForegroundColor Cyan
Set-Location $rootDir

# Install pyinstaller into the active environment if missing
python -m pip install pyinstaller --quiet

pyinstaller chatarchive.spec --noconfirm

$exePath = Join-Path $rootDir "dist\ChatArchive\ChatArchive.exe"
if (-not (Test-Path $exePath)) {
    Write-Error "PyInstaller step failed — executable not found at $exePath"
    exit 1
}

# ── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Executable: $exePath" -ForegroundColor Yellow
Write-Host ""
Write-Host "To run: double-click ChatArchive.exe inside dist\ChatArchive\"
Write-Host "To share: copy the entire dist\ChatArchive\ folder."
Write-Host ""
Write-Host "Note: on first run, place your .env file next to ChatArchive.exe"
Write-Host "if you use Supabase or a PostgreSQL database."
