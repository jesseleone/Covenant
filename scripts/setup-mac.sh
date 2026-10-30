#!/usr/bin/env bash
# Covenant workspace setup for a Mac (the alternative to GitHub Codespaces).
#
# Run in Terminal:
#   curl -fsSL https://raw.githubusercontent.com/jesseleone/Covenant/main/scripts/setup-mac.sh | bash
#
# It checks for Docker Desktop and VS Code (offering to install them), gets a
# copy of Covenant into ~/Covenant, and opens it in the same workspace
# Codespaces uses: the app, a database with demo data, and Claude Code.
# Safe to run again: it reuses what is already there.
set -euo pipefail

REPO_URL="${COVENANT_REPO:-https://github.com/jesseleone/Covenant.git}"
BRANCH="${COVENANT_BRANCH:-main}"
DIR="${COVENANT_DIR:-$HOME/Covenant}"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
fail() { printf '\n  ✗ %s\n\n' "$*" >&2; exit 1; }
ask()  { local reply; read -r -p "  $1 [y/N] " reply < /dev/tty || true; [[ "$reply" =~ ^[Yy] ]]; }
has()  { command -v "$1" >/dev/null 2>&1; }

say "Setting up Covenant on this Mac"

# 1. Docker Desktop ------------------------------------------------------------
if ! has docker && [ ! -d /Applications/Docker.app ]; then
  echo "  Docker Desktop runs the workspace on your Mac. It isn't installed."
  if has brew && ask "Install Docker Desktop now with Homebrew?"; then
    brew install --cask docker
  else
    open "https://www.docker.com/products/docker-desktop/"
    fail "Install Docker Desktop from the page that just opened, start it once, then run this setup again."
  fi
fi
if ! docker info >/dev/null 2>&1; then
  echo "  Starting Docker Desktop…"
  open -a Docker || true
  for _ in $(seq 1 90); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || fail "Docker Desktop didn't start. Open it from Applications, wait until it says it's running, then run this setup again."
fi
ok "Docker Desktop is running"

# 2. Git -------------------------------------------------------------------------
if ! git --version >/dev/null 2>&1; then
  xcode-select --install 2>/dev/null || true
  fail "Your Mac needs Apple's command line tools for Git. Finish the installer that just opened, then run this setup again."
fi
ok "Git is available"

# 3. Get Covenant ---------------------------------------------------------------------
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only --quiet || echo "  (Couldn't update $DIR automatically; using it as it is.)"
  ok "Covenant is in $DIR"
else
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$DIR"
  ok "Downloaded Covenant to $DIR"
fi

# 4. Open it in the workspace -----------------------------------------------------------
CODE=""
if has code; then CODE="code"
elif [ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]; then CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
elif has brew && ask "VS Code isn't installed. Install it now with Homebrew?"; then
  brew install --cask visual-studio-code
  CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
fi

if [ -n "$CODE" ]; then
  "$CODE" --install-extension ms-vscode-remote.remote-containers --force >/dev/null
  ok "VS Code has the Dev Containers extension"
  HEX=$(printf '%s' "$DIR" | xxd -p | tr -d '\n')
  "$CODE" --folder-uri "vscode-remote://dev-container+${HEX}/workspaces/Covenant"
  say "VS Code is opening Covenant in its workspace."
  echo "  The first time takes a few minutes. When it's ready, the app opens as \"Covenant preview\"."
  echo "  Then open a terminal in VS Code (Terminal → New Terminal), type: claude"
  echo "  and sign in with your company Claude account."
elif has npx; then
  echo "  No VS Code: starting the workspace with the Dev Containers command-line tool instead."
  npx --yes @devcontainers/cli up --workspace-folder "$DIR"
  say "The workspace is running."
  echo "  Open a terminal inside it with:  npx @devcontainers/cli exec --workspace-folder \"$DIR\" bash"
  echo "  then type: claude"
else
  open "https://code.visualstudio.com/download"
  fail "Install VS Code from the page that just opened, then run this setup again."
fi
