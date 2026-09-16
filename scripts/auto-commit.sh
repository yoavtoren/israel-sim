#!/bin/sh
# Cron entry point (every 30 min). Same commit + gated push as the Claude Stop hook.
exec "$(cd "$(dirname "$0")" && pwd)/claude-autopush.sh"
