#!/bin/sh
# Claude Code Stop hook: commit and push whatever changed during the turn.
# Deploys are gated by CI, so pushing a work-in-progress snapshot never ships a broken build.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO_DIR" || exit 0

# Don't interfere with an in-progress git operation.
GIT_DIR="$(git rev-parse --git-dir)" || exit 0
for f in index.lock MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD; do
  [ -e "$GIT_DIR/$f" ] && exit 0
done

BRANCH="$(git symbolic-ref --short -q HEAD)" || exit 0

git add -A
if ! git diff --cached --quiet; then
  FILES="$(git diff --cached --name-only | head -5 | xargs -n1 basename | paste -sd, -)"
  COUNT="$(git diff --cached --name-only | wc -l | tr -d ' ')"
  git commit -q --no-verify -m "auto: $(date '+%Y-%m-%d %H:%M') — $COUNT file(s): $FILES"
fi

# Push only if there is something unpushed.
[ -z "$(git rev-list "@{u}..HEAD" 2>/dev/null || echo new)" ] && exit 0

# Gate the push on the same checks CI runs, so half-finished work (e.g. another
# session mid-refactor) stays as local commits instead of failing CI.
if ! npm run -s typecheck >/dev/null 2>&1 || ! npm run -s test >/dev/null 2>&1; then
  echo "$(date '+%Y-%m-%d %H:%M') push skipped: typecheck/test failing — commits kept locally"
  exit 0
fi
git push -q origin "$BRANCH" 2>&1 | tail -3
exit 0
