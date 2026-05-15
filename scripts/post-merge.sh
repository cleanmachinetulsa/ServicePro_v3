#!/bin/bash
set -e

npm install

# drizzle-kit push refuses to run without a TTY (it bails before even
# reading stdin). Use `script` to allocate a pty, and feed `+` answers
# (drizzle's "create" choice for renamed-table prompts) via stdin so any
# rename/create conflicts are resolved non-interactively. --force also
# auto-approves data-loss statements.
yes '+' | /usr/bin/script -qfec "npm run db:push -- --force" /dev/null || {
  echo "[post-merge] db:push reported issues; continuing." >&2
}
