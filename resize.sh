#!/usr/bin/env bash
# Image Resizer launcher (macOS/Linux)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install from https://nodejs.org, then run: npm install"
  exit 1
fi
# sharp processes images on Node's libuv threadpool (default 4 threads) —
# raise it to the core count so batch mode can use the whole CPU
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-$(nproc 2>/dev/null || echo 4)}"
exec node src/entry.mjs "$@"
