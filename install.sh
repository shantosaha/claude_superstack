#!/usr/bin/env bash
# claude_superstack one-line bootstrap (macOS / Linux / WSL)
# curl -fsSL https://raw.githubusercontent.com/shantosaha/claude_superstack/main/install.sh | bash
set -euo pipefail

REPO_URL="${SUPERSTACK_REPO:-https://github.com/shantosaha/claude_superstack.git}"
SS_HOME="$HOME/.claude/superstack"
BIN_DIR="$HOME/.local/bin"

echo "🚀 claude_superstack bootstrap"

command -v git >/dev/null 2>&1 || { echo "❌ git is required. Install git and re-run."; exit 1; }

# 1. Get / refresh the superstack scripts
if [ -d "$SS_HOME/.git" ]; then
  git -C "$SS_HOME" pull --ff-only >/dev/null 2>&1 || true
  echo "  ✅ superstack scripts refreshed"
elif [ -d "$SS_HOME" ] && [ -f "$SS_HOME/bin/superstack" ]; then
  echo "  ✅ superstack scripts present (local copy)"
else
  git clone --depth 1 "$REPO_URL" "$SS_HOME"
  echo "  ✅ superstack scripts cloned → $SS_HOME"
fi

# 2. Link the CLI onto PATH
mkdir -p "$BIN_DIR"
ln -sf "$SS_HOME/bin/superstack" "$BIN_DIR/superstack"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) SHELL_RC="$HOME/.bashrc"; [ -n "${ZSH_VERSION:-}" ] || [ "$(basename "${SHELL:-}")" = "zsh" ] && SHELL_RC="$HOME/.zshrc"
     echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$SHELL_RC"
     export PATH="$BIN_DIR:$PATH"
     echo "  ✅ added ~/.local/bin to PATH ($SHELL_RC)" ;;
esac

# 3. Run the full installer (checks each repo, installs what's missing)
"$SS_HOME/bin/superstack" install "$@"
