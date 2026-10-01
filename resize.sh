#!/usr/bin/env bash
# Image Resizer launcher (macOS/Linux)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install from https://nodejs.org, then run: npm install"
  exit 1
fi
exec node src/cli.js "$@"
