#!/bin/bash
set -e
npm install
# Pipe newlines + answer "+" (create) for any drizzle-kit interactive
# rename/create prompts; --force auto-approves data-loss statements so
# the push runs non-interactively in CI/post-merge.
printf '+\n+\n+\n+\n+\n+\n+\n+\n+\n+\n' | npm run db:push -- --force || {
  echo "[post-merge] db:push reported issues; continuing." >&2
}
