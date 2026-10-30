#!/usr/bin/env bash
# Runs once, when the workspace is first created: install packages, create
# the tables, load the demo data.
set -euo pipefail
cd "$(dirname "$0")/.."

# The package and build folders are container volumes, created as root.
sudo chown -R "$(id -u):$(id -g)" node_modules .next

echo "▶ Installing packages…"
npm ci

echo "▶ Setting up the database…"
npm run db:migrate
npm run db:seed

echo "✓ Workspace ready. The app starts on its own; type \`claude\` in the terminal to begin."
