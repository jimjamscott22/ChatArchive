$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

$pythonCmd = "python"
if (-not (Get-Command $pythonCmd -ErrorAction SilentlyContinue)) {
  if (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
  } else {
    Write-Error "Python not found. Install Python 3.10+ or ensure python/py is in PATH."
    exit 1
  }
}

if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
  Write-Error "npm not found. Install Node.js 18+ and ensure npm is in PATH."
  exit 1
}

Write-Host "Starting backend..."
$backend = Start-Process -FilePath $pythonCmd -ArgumentList "-m", "app.main" -WorkingDirectory $backendDir -NoNewWindow -PassThru

Write-Host "Starting frontend..."
$frontend = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -NoNewWindow -PassThru

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
