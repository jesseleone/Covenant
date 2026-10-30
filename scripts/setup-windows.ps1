# Covenant workspace setup for Windows (the alternative to GitHub Codespaces).
#
# Run in PowerShell:
#   irm https://raw.githubusercontent.com/jesseleone/Covenant/main/scripts/setup-windows.ps1 | iex
#
# It checks for Docker Desktop, Git and VS Code (offering to install them with
# winget), gets a copy of Covenant into your user folder, and opens it in the
# same workspace Codespaces uses: the app, a database with demo data, and
# Claude Code. Safe to run again: it reuses what is already there.
# Not yet tested on a Windows machine; please report problems to the engineers.

$ErrorActionPreference = "Stop"
$RepoUrl = if ($env:COVENANT_REPO) { $env:COVENANT_REPO } else { "https://github.com/jesseleone/Covenant.git" }
$Branch  = if ($env:COVENANT_BRANCH) { $env:COVENANT_BRANCH } else { "main" }
$Dir     = if ($env:COVENANT_DIR) { $env:COVENANT_DIR } else { Join-Path $HOME "Covenant" }

function Say($m)  { Write-Host "`n$m" -ForegroundColor White }
function Ok($m)   { Write-Host "  OK  $m" -ForegroundColor Green }
function Fail($m) { Write-Host "`n  $m`n" -ForegroundColor Red; exit 1 }
function Ask($q)  { (Read-Host "  $q [y/N]") -match '^[Yy]' }
function Has($c)  { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") }
function Install-WithWinget($id, $name, $page) {
  if ((Has winget) -and (Ask "$name isn't installed. Install it now?")) {
    winget install --id $id -e --accept-package-agreements --accept-source-agreements
    Refresh-Path
  } else {
    Start-Process $page
    Fail "Install $name from the page that just opened, then run this setup again."
  }
}

Say "Setting up Covenant on this PC"

# 1. Docker Desktop ---------------------------------------------------------------
$DockerExe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
if (-not (Has docker) -and -not (Test-Path $DockerExe)) {
  Install-WithWinget "Docker.DockerDesktop" "Docker Desktop" "https://www.docker.com/products/docker-desktop/"
  Fail "Docker Desktop is installed. Restart your PC if it asks you to, start Docker Desktop once, then run this setup again."
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "  Starting Docker Desktop..."
  if (Test-Path $DockerExe) { Start-Process $DockerExe }
  for ($i = 0; $i -lt 90; $i++) { docker info *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 2 }
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { Fail "Docker Desktop didn't start. Open it from the Start menu, wait until it says it's running, then run this setup again." }
}
Ok "Docker Desktop is running"

# 2. Git ------------------------------------------------------------------------------
if (-not (Has git)) { Install-WithWinget "Git.Git" "Git" "https://git-scm.com/download/win" }
Ok "Git is available"

# 3. Get Covenant ------------------------------------------------------------------------
if (Test-Path (Join-Path $Dir ".git")) {
  git -C $Dir pull --ff-only --quiet
  if ($LASTEXITCODE -ne 0) { Write-Host "  (Couldn't update $Dir automatically; using it as it is.)" }
  Ok "Covenant is in $Dir"
} else {
  git clone --quiet --branch $Branch $RepoUrl $Dir
  Ok "Downloaded Covenant to $Dir"
}

# 4. Open it in the workspace ----------------------------------------------------------------
if (-not (Has code)) { Install-WithWinget "Microsoft.VisualStudioCode" "VS Code" "https://code.visualstudio.com/download" }
code --install-extension ms-vscode-remote.remote-containers --force | Out-Null
Ok "VS Code has the Dev Containers extension"

$Hex = -join ([System.Text.Encoding]::UTF8.GetBytes($Dir) | ForEach-Object { $_.ToString("x2") })
code --folder-uri "vscode-remote://dev-container+$Hex/workspaces/Covenant"

Say "VS Code is opening Covenant in its workspace."
Write-Host "  The first time takes a few minutes. When it's ready, the app opens as 'Covenant preview'."
Write-Host "  Then open a terminal in VS Code (Terminal > New Terminal), type: claude"
Write-Host "  and sign in with your company Claude account."
