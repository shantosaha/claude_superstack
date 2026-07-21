# claude_superstack one-line bootstrap (Windows PowerShell)
# irm https://raw.githubusercontent.com/shantosaha/claude_superstack/main/install.ps1 | iex
$ErrorActionPreference = "Continue"
$RepoUrl = if ($env:SUPERSTACK_REPO) { $env:SUPERSTACK_REPO } else { "https://github.com/shantosaha/claude_superstack.git" }
$SSHome  = Join-Path $HOME ".claude\superstack"

Write-Host "claude_superstack bootstrap (Windows)" -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "git is required." -ForegroundColor Red; exit 1 }

if (Test-Path (Join-Path $SSHome ".git")) { git -C $SSHome pull --ff-only 2>$null }
elseif (-not (Test-Path (Join-Path $SSHome "bin\superstack.ps1"))) { git clone --depth 1 $RepoUrl $SSHome }
Write-Host "  superstack scripts ready -> $SSHome"

# Put the scripts dir on PATH: persist to the user env var, and update this session.
$binDir = Join-Path $SSHome "bin"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
  Write-Host "  added $binDir to your User PATH"
  Write-Host "  this only applies to this script's session and NEW terminals - restart your current terminal to use 'superstack.ps1' directly"
}
if ($env:Path -notlike "*$binDir*") { $env:Path = "$env:Path;$binDir" }

& (Join-Path $SSHome "bin\superstack.ps1") install @args
