$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

 $uv = Get-Command "uv" -ErrorAction SilentlyContinue
if (-not $uv) {
  Write-Error "uv not found. Install uv to manage the backend environment."
  exit 1
}

$npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npm) {
  Write-Error "npm not found. Install Node.js 18+ and ensure npm is in PATH."
  exit 1
}

Write-Host "Syncing backend dependencies..."
& $uv.Source sync --directory $backendDir
if ($LASTEXITCODE -ne 0) {
  Write-Error "Backend dependency sync failed."
  exit $LASTEXITCODE
}

Write-Host "Starting backend..."
$backend = Start-Process -FilePath $uv.Source -ArgumentList "run", "python", "-m", "app.main" -WorkingDirectory $backendDir -NoNewWindow -PassThru

Write-Host "Starting frontend..."
$frontend = Start-Process -FilePath $npm.Source -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -NoNewWindow -PassThru

try {
  Wait-Process -Id $backend.Id, $frontend.Id
} finally {
  if ($backend -and -not $backend.HasExited) {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
  }
  if ($frontend -and -not $frontend.HasExited) {
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
  }
}
