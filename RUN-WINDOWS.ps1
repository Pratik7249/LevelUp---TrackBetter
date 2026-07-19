$ErrorActionPreference = "Stop"

Write-Host "`nTrackBetter installer" -ForegroundColor Cyan
Write-Host "Project: $PWD`n"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed or is not available in PATH."
}

$nodeVersion = node -p "process.versions.node"
$nodeMajor = [int]($nodeVersion.Split('.')[0])
Write-Host "Node.js: v$nodeVersion"

if ($nodeMajor -lt 20) {
  throw "Node.js 20.9 or newer is required."
}

Write-Host "Removing old build folders..." -ForegroundColor Yellow
if (Test-Path ".\node_modules") { Remove-Item -Recurse -Force ".\node_modules" }
if (Test-Path ".\.next") { Remove-Item -Recurse -Force ".\.next" }

$packageRunner = "npm"
Write-Host "Installing exact dependencies with npm ci..." -ForegroundColor Yellow
npm ci

if ($LASTEXITCODE -ne 0) {
  Write-Host "npm ci failed. Trying pnpm through Corepack..." -ForegroundColor Yellow
  if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    throw "Both npm and Corepack installation methods failed. Reinstall Node.js 22 LTS and retry."
  }
  corepack enable
  corepack prepare pnpm@10.13.1 --activate
  corepack pnpm install
  if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed with both npm and pnpm." }
  $packageRunner = "pnpm"
}

if (-not (Test-Path ".\.env.local") -and (Test-Path ".\.env.example")) {
  Copy-Item ".\.env.example" ".\.env.local"
  Write-Host "Created .env.local from .env.example. Add Firebase values before Google login." -ForegroundColor Yellow
}

Write-Host "`nStarting TrackBetter at http://localhost:3000`n" -ForegroundColor Green
if ($packageRunner -eq "pnpm") {
  corepack pnpm dev
} else {
  npm run dev
}
