# claude_superstack CLI (Windows) — install | init | migrate | doctor | update | uninstall
param([Parameter(Position=0)][string]$Command = "help",
      [Parameter(Position=1)][string]$Arg = "",
      [switch]$WithDesign,
      [switch]$All,
      [switch]$NoConfirm)
$ErrorActionPreference = "Continue"
$SSHome    = Join-Path $HOME ".claude\superstack"
$ClaudeDir = Join-Path $HOME ".claude"
$BinDir    = Join-Path $HOME ".local\bin"
$Version   = "1.0.0"

function Have($n){ [bool](Get-Command $n -ErrorAction SilentlyContinue) }
function Info($m){ Write-Host "  $m" }
function Warn($m){ Write-Host "  $m" -ForegroundColor Yellow }
function OK($m){ Write-Host $m -ForegroundColor Green }
function Err($m){ Write-Host $m -ForegroundColor Red }

$script:Failures = @()
$script:Skipped  = @()
function Record-Failure($name,$reason){ $script:Failures += "$name`: $reason"; Warn "WARN $name`: $reason" }
function Record-Skipped($name,$reason){ $script:Skipped  += "$name`: $reason"; Info "SKIP $name`: $reason" }
function Print-Summary {
  if ($script:Failures.Count -gt 0) {
    Write-Host ""
    Err "Failures:"
    foreach ($f in $script:Failures) { Info "x $f" }
  }
  if ($script:Skipped.Count -gt 0) {
    Write-Host ""
    Warn "Skipped:"
    foreach ($s in $script:Skipped) { Info "> $s" }
  }
}

$PluginSpecs = @(
  @{Market="https://github.com/affaan-m/ECC"; Spec="ecc@ecc"; Name="ecc"},
  @{Market="obra/superpowers-marketplace"; Spec="superpowers@superpowers-marketplace"; Name="superpowers"},
  @{Market="https://github.com/DietrichGebert/ponytail"; Spec="ponytail@ponytail"; Name="ponytail"},
  @{Market="AgriciDaniel/claude-obsidian"; Spec="claude-obsidian@agricidaniel-claude-obsidian"; Name="claude-obsidian"},
  @{Market="kepano/obsidian-skills"; Spec="obsidian@obsidian-skills"; Name="obsidian"},
  @{Market="multica-ai/andrej-karpathy-skills"; Spec="andrej-karpathy-skills@karpathy-skills"; Name="karpathy"},
  @{Market="nextlevelbuilder/ui-ux-pro-max-skill"; Spec="ui-ux-pro-max@ui-ux-pro-max-skill"; Name="ui-ux-pro-max"}
)

function Plugin-Installed($name){
  $list = claude plugin list 2>$null
  return ($list -match $name)
}

function Install-Plugin($market,$spec,$name){
  if (Plugin-Installed $name) { Info "OK $name already installed"; return }
  claude plugin marketplace add $market 2>$null | Out-Null
  claude plugin install $spec 2>$null | Out-Null
  if (Plugin-Installed $name) { Info "OK $name installed" }
  else { Record-Failure $name "install failed - run manually: /plugin marketplace add $market && /plugin install $spec" }
}

function Preflight-Prerequisites {
  if ((Have "uv") -or (Have "pipx")) { return }
  Write-Host ""
  Write-Host "The following will be installed: uv (for graphify)"
  $a = Read-Host "Proceed? [Y/n]"
  if ($a -eq "" -or $a -eq "Y" -or $a -eq "y") {
    Warn "WARN uv: no auto-installer for Windows in this script - install manually: https://github.com/astral-sh/uv"
  } else {
    Record-Skipped "graphify" "skipped by choice (uv/pipx prerequisite declined)"
  }
}

function Install-Repos {
  Write-Host "`n-- Installing the 10-repo stack --"
  Preflight-Prerequisites

  $claudeAvailable = Have "claude"
  foreach ($p in $PluginSpecs) {
    if ($claudeAvailable) {
      Install-Plugin $p.Market $p.Spec $p.Name
    } else {
      Record-Skipped $p.Name "claude CLI not found - install manually: /plugin marketplace add $($p.Market) && /plugin install $($p.Spec)"
    }
  }

  $gsdInstalled = Test-Path (Join-Path $ClaudeDir "gsd-core")
  if ($gsdInstalled) { Info "OK gsd-core already installed" }
  else {
    npx --yes "@opengsd/gsd-core@latest" --install --claude --global 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Info "OK gsd-core installed" }
    else { Record-Failure "gsd-core" "run manually: npx @opengsd/gsd-core@latest --install --claude --global" }
  }

  if (Have "graphify") { Info "OK graphify already installed" }
  elseif (Have "uv") {
    uv tool install graphify 2>$null | Out-Null; graphify install 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Info "OK graphify installed" } else { Record-Failure "graphify" "run: uv tool install graphify && graphify install" }
  }
  elseif (Have "pipx") {
    if (-not (Have "python") -and -not (Have "python3")) {
      Record-Skipped "graphify" "pipx found but no python/python3 on PATH - install Python 3 first: https://python.org"
    } else {
      pipx install graphify 2>$null | Out-Null; graphify install 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { Info "OK graphify installed" } else { Record-Failure "graphify" "run: pipx install graphify && graphify install" }
    }
  }
  else { Record-Skipped "graphify" "needs uv or pipx: https://github.com/Graphify-Labs/graphify" }

  if ($WithDesign) {
    $od = Join-Path $HOME "open-design"
    if (Test-Path $od) { Info "OK open-design already cloned" }
    else {
      git clone --depth 1 https://github.com/nexu-io/open-design.git $od 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { Info "OK open-design cloned" } else { Record-Failure "open-design" "clone failed - retry: git clone https://github.com/nexu-io/open-design.git $od" }
    }
  } else { Record-Skipped "open-design" "optional; use -WithDesign to include" }
}

function Install-GlobalFiles {
  New-Item -ItemType Directory -Force -Path (Join-Path $ClaudeDir "hooks") | Out-Null
  $router = Join-Path $SSHome "global\CLAUDE.md"
  $target = Join-Path $ClaudeDir "CLAUDE.md"
  if ((Test-Path $target) -and (Select-String -Path $target -Pattern "CLAUDE-SUPERSTACK" -Quiet)) {
    Info "OK global CLAUDE.md already has SuperStack router (no change)"
  } elseif (Test-Path $target) {
    Copy-Item $target "$target.pre-superstack.bak"
    Warn "Existing global CLAUDE.md backed up -> CLAUDE.md.pre-superstack.bak"
    Get-Content $router, "$target.pre-superstack.bak" | Set-Content $target
    Info "OK router prepended to your existing CLAUDE.md"
  } else {
    Copy-Item $router $target -Force
    Info "OK global CLAUDE.md installed"
  }
  $hooksTarget = Join-Path $ClaudeDir "hooks\hooks.json"
  $hooksSrc = Join-Path $SSHome "global\hooks\hooks.json"
  if ((Test-Path $hooksTarget) -and (Select-String -Path $hooksTarget -Pattern "SUPERSTACK MEMORY" -Quiet)) {
    Info "OK hooks.json already has SuperStack hooks (no change)"
  } elseif (Test-Path $hooksTarget) {
    Copy-Item $hooksSrc (Join-Path $ClaudeDir "hooks\hooks.superstack.json") -Force
    Record-Skipped "hooks.json" "existing hooks.json found - SuperStack hooks saved to hooks.superstack.json; merge manually"
  } else {
    Copy-Item $hooksSrc $hooksTarget -Force
    Info "OK hooks installed"
  }
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

function Run-HealthChecks {
  $script:ok = 0; $script:warn = 0
  function CheckItem($label,$cond){
    if ($cond) { Info "OK $label"; $script:ok++ } else { Warn "WARN $label"; $script:warn++ }
  }
  CheckItem "git" (Have "git")
  CheckItem "node" (Have "node")
  CheckItem "claude CLI" (Have "claude")
  CheckItem "global CLAUDE.md router" (Select-String -Path (Join-Path $ClaudeDir "CLAUDE.md") -Pattern "CLAUDE-SUPERSTACK" -Quiet -ErrorAction SilentlyContinue)
  CheckItem "hooks" ((Select-String -Path (Join-Path $ClaudeDir "hooks\hooks.json") -Pattern "SUPERSTACK MEMORY" -Quiet -ErrorAction SilentlyContinue) -or (Test-Path (Join-Path $ClaudeDir "hooks\hooks.superstack.json")))
  CheckItem "graphify" (Have "graphify")
  if (Have "claude") {
    foreach ($p in $PluginSpecs) { CheckItem "plugin: $($p.Name)" (Plugin-Installed $p.Name) }
  }
  CheckItem "gsd-core" (Test-Path (Join-Path $ClaudeDir "gsd-core"))
  CheckItem "open-design (optional)" (Test-Path (Join-Path $HOME "open-design"))
  Write-Host ""
  Write-Host "Result: $script:ok OK, $script:warn warnings."
}

function Uninstall-RouterAndHooks {
  $target = Join-Path $ClaudeDir "CLAUDE.md"
  $bak = Join-Path $ClaudeDir "CLAUDE.md.pre-superstack.bak"
  if ((Test-Path $target) -and (Select-String -Path $target -Pattern "CLAUDE-SUPERSTACK" -Quiet)) {
    if (Test-Path $bak) {
      Move-Item $bak $target -Force
      Info "OK restored your original CLAUDE.md from backup"
    } else {
      $ts = Get-Date -Format "yyyyMMdd-HHmmss"
      Copy-Item $target "$target.uninstalled-$ts"
      Remove-Item $target -ErrorAction SilentlyContinue
      Info "OK removed SuperStack CLAUDE.md (no prior backup existed - saved a copy to CLAUDE.md.uninstalled-$ts before deleting)"
    }
  } else {
    Info "INFO global CLAUDE.md is not SuperStack's - left untouched"
  }
  Remove-Item (Join-Path $ClaudeDir "hooks\hooks.superstack.json") -ErrorAction SilentlyContinue
  $hooksTarget = Join-Path $ClaudeDir "hooks\hooks.json"
  if ((Test-Path $hooksTarget) -and (Select-String -Path $hooksTarget -Pattern "SUPERSTACK MEMORY" -Quiet)) {
    # Marker match doesn't guarantee this is a pure SuperStack file - it may be
    # merged with another tool's hooks. Never delete without a copy.
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item $hooksTarget "$hooksTarget.uninstalled-$ts"
    Remove-Item $hooksTarget -ErrorAction SilentlyContinue
    Info "OK removed hooks.json (saved a copy to hooks.json.uninstalled-$ts before deleting; if it was merged with another tool's hooks, restore and re-merge)"
  }
}

function Uninstall-Plugins {
  if (-not (Have "claude")) { Record-Skipped "plugins" "claude CLI not found"; return }
  foreach ($p in $PluginSpecs) {
    if (Plugin-Installed $p.Name) {
      claude plugin uninstall $p.Spec 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { Info "OK uninstalled $($p.Name)" }
      else { Record-Failure $p.Name "uninstall failed - run manually: claude plugin uninstall $($p.Spec)" }
    }
  }
}

function Uninstall-CliAndRepos {
  Remove-Item (Join-Path $BinDir "superstack.ps1") -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ClaudeDir "gsd-core") -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ClaudeDir "gsd-migration-journal") -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ClaudeDir "gsd-file-manifest.json") -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ClaudeDir "gsd-install-state.json") -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ClaudeDir "agents\gsd-*.md") -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ClaudeDir "hooks\lib\gsd-*") -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ClaudeDir "commands\gsd:*.md") -ErrorAction SilentlyContinue
  Remove-Item $SSHome -Recurse -Force -ErrorAction SilentlyContinue
  if (Have "uv") { uv tool uninstall graphify 2>$null | Out-Null }
  if (Have "pipx") { pipx uninstall graphify 2>$null | Out-Null }
  Info "OK removed CLI, superstack home, gsd-core commands, graphify"
}

function Uninstall-OpenDesign {
  $od = Join-Path $HOME "open-design"
  if (Test-Path $od) { Remove-Item $od -Recurse -Force; Info "OK removed open-design" }
  else { Info "INFO open-design not present - nothing to remove" }
}

function Confirm-Category($msg){
  if ($NoConfirm) { return $true }
  $a = Read-Host "$msg [y/N]"
  return ($a -eq "y")
}

function Ensure-SSHome {
  # A prior 'uninstall -All' removes $SSHome entirely. Re-clone it here so
  # install is self-healing even when invoked directly (not via install.ps1).
  if (-not (Test-Path (Join-Path $SSHome "global\CLAUDE.md"))) {
    $repoUrl = if ($env:SUPERSTACK_REPO) { $env:SUPERSTACK_REPO } else { "https://github.com/shantosaha/claude_superstack.git" }
    Warn "SuperStack scripts missing at $SSHome - re-cloning from $repoUrl"
    git clone --depth 1 $repoUrl $SSHome 2>$null | Out-Null
    if (-not (Test-Path (Join-Path $SSHome "global\CLAUDE.md"))) {
      Record-Failure "superstack scripts" "clone failed - run manually: git clone $repoUrl $SSHome"
    }
  }
}

switch ($Command) {
  "install"  {
    Write-Host "claude_superstack v$Version - installing"
    Ensure-SSHome
    Install-Repos
    Install-GlobalFiles
    Write-Host ""
    Write-Host "-- Verifying install --"
    Run-HealthChecks
    Print-Summary
    Write-Host ""
    if ($script:Failures.Count -eq 0) { OK "Install complete." } else { Warn "Install finished with $($script:Failures.Count) failure(s) - see Failures above." }
    Write-Host "Try: superstack.ps1 doctor"
  }
  "init"     { if (-not $Arg) { Warn "Usage: superstack.ps1 init <name>"; break }
               New-Item -ItemType Directory -Force -Path $Arg | Out-Null; Init-ProjectFiles $Arg
               if (Have "graphify") { Push-Location $Arg; graphify run . 2>$null | Out-Null; Pop-Location }
               OK "Project '$Arg' initialized." }
  "migrate"  { $t = if ($Arg) { $Arg } else { "." }; Init-ProjectFiles $t
               if (Have "graphify") { Push-Location $t; graphify run . 2>$null | Out-Null; Pop-Location }
               OK "Migrated '$t'." }
  "doctor"   { Write-Host "SuperStack doctor"; Run-HealthChecks
               if (Test-Path ".superstack.json") { Info "OK current project is SuperStack-enabled" }
               else { Warn "INFO current directory not initialized (superstack.ps1 migrate .)" } }
  "update"   { if (Have "claude") {
                 claude plugin marketplace update --all 2>$null | Out-Null
                 foreach ($p in $PluginSpecs) {
                   claude plugin update $p.Spec 2>$null | Out-Null; Info "updated $($p.Name)" } }
               npx --yes "@opengsd/gsd-core@latest" --install --claude --global 2>$null | Out-Null
               if (Have "uv") { uv tool upgrade graphify 2>$null | Out-Null }
               $od = Join-Path $HOME "open-design"
               if (Test-Path (Join-Path $od ".git")) { git -C $od pull --ff-only 2>$null }
               if (Test-Path (Join-Path $SSHome ".git")) { git -C $SSHome pull --ff-only 2>$null; Install-GlobalFiles }
               OK "Update complete." }
  "uninstall"{
    if (-not $All) {
      Write-Host "Removing SuperStack global router + hooks only"
      $a = Read-Host "Proceed? [y/N]"
      if ($a -ne "y") { Write-Host "Aborted."; break }
      Uninstall-RouterAndHooks
      Write-Host ""
      Warn "This does NOT remove:"
      Info "- Claude Code plugins (ecc, superpowers, ponytail, claude-obsidian, obsidian, karpathy, ui-ux-pro-max)"
      Info "- gsd-core commands, graphify"
      Info "- $SSHome, $(Join-Path $BinDir 'superstack.ps1')"
      Info "- open-design"
      Info "- any project's .vault/, .graphify/, .superstack.json, or project CLAUDE.md (never touched)"
      Write-Host "Run 'superstack.ps1 uninstall -All' to remove everything global."
      OK "Light uninstall complete."
      break
    }
    Write-Host "Full SuperStack removal (-All)"
    Write-Host "This only ever touches: $ClaudeDir, $BinDir, $(Join-Path $HOME 'open-design')"
    Write-Host "Project files (.vault/, .graphify/, .superstack.json, project CLAUDE.md) are never touched."
    Write-Host ""
    if (Confirm-Category "Remove Claude Code plugins (7)?") { Uninstall-Plugins } else { Record-Skipped "plugins" "skipped by choice" }
    if (Confirm-Category "Remove CLI tools & repos?") { Uninstall-CliAndRepos } else { Record-Skipped "cli-and-repos" "skipped by choice" }
    if (Confirm-Category "Remove global router + hooks?") { Uninstall-RouterAndHooks } else { Record-Skipped "router-and-hooks" "skipped by choice" }
    if (Confirm-Category "Remove open-design?") { Uninstall-OpenDesign } else { Record-Skipped "open-design" "skipped by choice" }
    Write-Host ""
    Print-Summary
    Write-Host ""
    Write-Host "-- Post-removal check --"
    if (Have "superstack.ps1") { Warn "WARN superstack.ps1 still found on PATH" } else { OK "confirmed: superstack.ps1 not found" }
    OK "Full uninstall finished."
  }
  default    { Write-Host @"
claude_superstack v$Version (Windows)
Usage: superstack.ps1 <install|init <name>|migrate [path]|doctor|update|uninstall> [-WithDesign] [-All] [-NoConfirm]
  uninstall           Remove global router + hooks only (repos/plugins left installed)
  uninstall -All      Remove everything global, with a confirm prompt per category
  uninstall -All -NoConfirm  Remove everything global, no prompts
  (Project files - .vault/, .graphify/, .superstack.json, project CLAUDE.md - are never touched by uninstall.)
"@ }
}
