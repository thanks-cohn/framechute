param(
  [switch]$NoBrowser,
  [switch]$SkipPull
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path (Join-Path $Root ".git"))) {
  throw "This launcher must be run from a Git clone of the SUBSTRATE repository. Expected .git at: $Root"
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required. Install Git for Windows, then run this launcher again."
}

Push-Location $Root
try {
  if (-not $SkipPull) {
    $dirty = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "git status failed." }

    if ($dirty.Count -gt 0) {
      Write-Host ""
      Write-Warning "SUBSTRATE has local changes. Nothing was overwritten."
      Write-Host "Commit/stash those changes first, then run this launcher again."
      Write-Host ""
      git status --short
      exit 2
    }

    Write-Step "Syncing this computer to GitHub main"
    git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw "git fetch origin main failed." }

    git checkout main
    if ($LASTEXITCODE -ne 0) { throw "git checkout main failed." }

    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) {
      throw "Could not fast-forward to origin/main. The launcher refuses to rewrite local history."
    }
  }

  $sha = (git rev-parse --short HEAD).Trim()
  $remoteSha = (git rev-parse --short origin/main).Trim()
  $branch = (git branch --show-current).Trim()

  Write-Step "SUBSTRATE source is ready"
  Write-Host "Branch:       $branch"
  Write-Host "Local commit: $sha"
  Write-Host "GitHub main:  $remoteSha"
  Write-Host "Extension:    $Root"

  if ($sha -ne $remoteSha) {
    Write-Warning "Local HEAD does not match origin/main."
  } else {
    Write-Host "PASS: this working copy matches GitHub main." -ForegroundColor Green
  }

  try { Set-Clipboard -Value $Root } catch {}

  if ($NoBrowser) { exit 0 }

  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  if (-not $candidates.Count) {
    Write-Warning "Chrome/Edge was not found automatically."
    Write-Host "Open chrome://extensions (or edge://extensions), enable Developer mode, and Load unpacked / Reload:"
    Write-Host $Root
    exit 0
  }

  $browser = $candidates[0]
  $extensionsUrl = if ($browser -like "*msedge.exe") { "edge://extensions/" } else { "chrome://extensions/" }

  Write-Step "Opening the extension manager"
  Start-Process -FilePath $browser -ArgumentList $extensionsUrl | Out-Null

  Write-Host ""
  Write-Host "FIRST TIME:" -ForegroundColor Yellow
  Write-Host "  Enable Developer mode -> Load unpacked -> paste/select:"
  Write-Host "  $Root"
  Write-Host ""
  Write-Host "AFTER EVERY CODE UPDATE:" -ForegroundColor Yellow
  Write-Host "  Run this launcher again, then press Reload on the SUBSTRATE / FrameChute extension card."
  Write-Host ""
  Write-Host "The repo path was copied to your clipboard."
  Write-Host "Once Reload is pressed, the extension running on this computer is the exact GitHub main checkout shown above."
}
finally {
  Pop-Location
}
