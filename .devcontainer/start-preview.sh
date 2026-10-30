#!/usr/bin/env bash
# Starts the app in the background (port 3000, "Covenant preview") unless it
# is already running. Runs every time the workspace starts; the preview skill
# runs it too. Output goes to /tmp/covenant-dev.log.
#
#   bash .devcontainer/start-preview.sh            start it if it isn't running
#   bash .devcontainer/start-preview.sh --restart  stop it first, then start it
set -euo pipefail
cd "$(dirname "$0")/.."

LOG=/tmp/covenant-dev.log

if [ "${1:-}" = "--restart" ]; then
  # The [n] keeps pkill from matching this script's own command line.
  pkill -f "[n]ext dev" || true
  pkill -f "[n]ext-server" || true
  sleep 2
fi

if curl -fsS -o /dev/null http://localhost:3000/api/llm 2>/dev/null; then
  echo "✓ Covenant preview is already running on port 3000."
  exit 0
fi

# Apply any new database changes first (safe to repeat).
npm run --silent db:setup >>"$LOG" 2>&1 || echo "⚠ Database setup failed; see $LOG"

nohup setsid npm run dev -- --hostname 0.0.0.0 --port 3000 >>"$LOG" 2>&1 < /dev/null &

for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null http://localhost:3000/api/llm 2>/dev/null; then
    echo "✓ Covenant preview is running on port 3000."
    exit 0
  fi
  sleep 1
done
echo "⚠ The app is still starting; check $LOG if it doesn't appear."
