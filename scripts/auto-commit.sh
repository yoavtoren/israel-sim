#!/bin/sh
# Auto-commit and push local changes. Installed as a cron job (every 30 min).
# Deploys are gated by CI, so pushing a work-in-progress snapshot never ships a broken build.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR" || exit 1

git add -A
if ! git diff --cached --quiet; then
  git commit -m "auto: snapshot $(date '+%Y-%m-%d %H:%M')" --no-verify
fi
git push -q origin main