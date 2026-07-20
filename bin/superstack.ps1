# claude_superstack CLI (Windows) — install | init | migrate | doctor | update | uninstall
param([Parameter(Position=0)][string]$Command = "help",
      [Parameter(Position=1)][string]$Arg = "",
      [switch]$WithDesign)
$ErrorActionPreference = "Continue"
$SSHome    = Join-Path $HOME ".claude\superstack"
$ClaudeDir = Join-Path $HOME ".claude"
$Version   = "1.0.0"

function Have($n){ [bool](Get-Command $n -ErrorAction SilentlyContinue) }
function Info($m){ Write-Host "  $m" }
function Warn($m){ Write-Host "  $m" -ForegroundColor Yellow }
function OK($m){ Write-Host $m -ForegroundColor Green }

function Install-Plugin($market,$spec,$name){
  if (Have "claude") {
    $list = claude plugin list 2>$null
    if ($list -match $name) { Info "OK $name already installed"; return }
    claude plugin marketplace add $market 2>$null | Out-Null
    claude plugin install $spec 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Info "OK $name installed" }
    else { Warn "WARN $name failed - run in Claude Code: /plugin install $spec" }
  } else { Warn "WARN claude CLI missing - install $name manually: /plugin install $spec" }
}

function Install-Repos {
  Write-Host "`n-- Installing the 10-repo stack --"
  Install-Plugin "https://github.com/affaan-m/ECC" "ecc@ecc" "ecc"
  Install-Plugin "obra/superpowers-marketplace" "superpowers@superpowers-marketplace" "superpowers"
  npx --yes "@opengsd/gsd-core@latest" --install --claude --global 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Info "OK gsd-core installed" } else { Warn "WARN gsd-core: npx @opengsd/gsd-core@latest --install" }
  Install-Plugin "https://github.com/DietrichGebert/ponytail" "ponytail@ponytail" "ponytail"
  if (Have "graphify") { Info "OK graphify already installed" }
  elseif (Have "uv")   { uv tool install graphify 2>$null | Out-Null; graphify install 2>$null | Out-Null; Info "OK graphify installed" }
  elseif (Have "pipx") { pipx install graphify 2>$null | Out-Null; graphify install 2>$null | Out-Null; Info "OK graphify installed" }
  else { Warn "WARN graphify needs uv or pipx" }
  Install-Plugin "AgriciDaniel/claude-obsidian" "claude-obsidian@agricidaniel-claude-obsidian" "claude-obsidian"
  Install-Plugin "kepano/obsidian-skills" "obsidian@obsidian-skills" "obsidian"
  Install-Plugin "multica-ai/andrej-karpathy-skills" "andrej-karpathy-skills@multica-ai" "karpathy"
  Install-Plugin "nextlevelbuilder/ui-ux-pro-max-skill" "ui-ux-pro-max@ui-ux-pro-max-skill" "ui-ux-pro-max"
  if ($WithDesign) {
    $od = Join-Path $HOME "open-design"
    if (-not (Test-Path $od)) { git clone --depth 1 https://github.com/nexu-io/open-design.git $od 2>$null; Info "OK open-design cloned" }
  } else { Info "SKIP open-design (optional; use -WithDesign)" }
}

function Install-GlobalFiles {
  New-Item -ItemType Directory -Force -Path (Join-Path $ClaudeDir "hooks") | Out-Null
  $router = Join-Path $SSHome "global\CLAUDE.md"
  $target = Join-Path $ClaudeDir "CLAUDE.md"
  if ((Test-Path $target) -and -not (Select-String -Path $target -Pattern "CLAUDE-SUPERSTACK" -Quiet)) {
    Copy-Item $target "$target.pre-superstack.bak"
    Get-Content $router, "$target.pre-superstack.bak" | Set-Content $target
    Info "OK router prepended (backup saved)"
  } else { Copy-Item $router $target -Force; Info "OK global CLAUDE.md installed" }
  Copy-Item (Join-Path $SSHome "global\hooks\hooks.json") (Join-Path $ClaudeDir "hooks\hooks.json") -Force
  Info "OK hooks installed"
}

function Init-ProjectFiles($t){
  New-Item -ItemType Directory -Force -Path (Join-Path $t ".vault\wiki"), (Join-Path $t ".graphify") | Out-Null
  foreach ($f in @("hot.md","index.md","log.md")) {
    $dst = Join-Path $t ".vault\$f"
    if (-not (Test-Path $dst)) { Copy-Item (Join-Path $SSHome "templates\vault\$f") $dst }
  }
  $cfg = Join-Path $t ".superstack.json"
  if (-not (Test-Path $cfg)) { Copy-Item (Join-Path $SSHome "templates\superstack.json") $cfg }
  $cm = Join-Path $t "CLAUDE.md"
  if (Test-Path $cm) {
    if (-not (Select-String -Path $cm -Pattern "SuperStack Enabled" -Quiet)) {
      Add-Content $cm "`n`n"; Get-Content (Join-Path $SSHome "templates\CLAUDE.project.md") | Add-Content $cm
    }
  } else { Copy-Item (Join-Path $SSHome "templates\CLAUDE.project.md") $cm }
}

switch ($Command) {
  "install"  { Write-Host "claude_superstack v$Version"; Install-Repos; Install-GlobalFiles; OK "Install complete. Try: superstack.ps1 doctor" }
  "init"     { if (-not $Arg) { Warn "Usage: superstack.ps1 init <name>"; break }
               New-Item -ItemType Directory -Force -Path $Arg | Out-Null; Init-ProjectFiles $Arg
               if (Have "graphify") { Push-Location $Arg; graphify run . 2>$null | Out-Null; Pop-Location }
               OK "Project '$Arg' initialized." }
  "migrate"  { $t = if ($Arg) { $Arg } else { "." }; Init-ProjectFiles $t
               if (Have "graphify") { Push-Location $t; graphify run . 2>$null | Out-Null; Pop-Location }
               OK "Migrated '$t'." }
  "doctor"   { foreach ($tool in @("git","node","claude","graphify")) {
                 if (Have $tool) { Info "OK $tool" } else { Warn "MISSING $tool" } }
               if (Select-String -Path (Join-Path $ClaudeDir "CLAUDE.md") -Pattern "CLAUDE-SUPERSTACK" -Quiet -ErrorAction SilentlyContinue) { Info "OK router" } else { Warn "MISSING router - run install" } }
  "update"   { if (Have "claude") {
                 claude plugin marketplace update --all 2>$null | Out-Null
                 foreach ($s in @("ecc@ecc","superpowers@superpowers-marketplace","ponytail@ponytail","claude-obsidian@agricidaniel-claude-obsidian","obsidian@obsidian-skills","andrej-karpathy-skills@multica-ai","ui-ux-pro-max@ui-ux-pro-max-skill")) {
                   claude plugin update $s 2>$null | Out-Null; Info "updated $s" } }
               npx --yes "@opengsd/gsd-core@latest" --install --claude --global 2>$null | Out-Null
               if (Have "uv") { uv tool upgrade graphify 2>$null | Out-Null }
               $od = Join-Path $HOME "open-design"
               if (Test-Path (Join-Path $od ".git")) { git -C $od pull --ff-only 2>$null }
               if (Test-Path (Join-Path $SSHome ".git")) { git -C $SSHome pull --ff-only 2>$null; Install-GlobalFiles }
               OK "Update complete." }
  "uninstall"{ $bak = Join-Path $ClaudeDir "CLAUDE.md.pre-superstack.bak"
               if (Test-Path $bak) { Move-Item $bak (Join-Path $ClaudeDir "CLAUDE.md") -Force }
               else { Remove-Item (Join-Path $ClaudeDir "CLAUDE.md") -ErrorAction SilentlyContinue }
               OK "SuperStack removed (plugins left installed)." }
  default    { Write-Host @"
claude_superstack v$Version (Windows)
Usage: superstack.ps1 <install|init <name>|migrate [path]|doctor|update|uninstall> [-WithDesign]
"@ }
}
