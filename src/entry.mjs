// entry.mjs — process entry point.
// sharp pipelines run on Node's libuv threadpool, whose default size is 4 — that
// silently caps real parallelism no matter how many file workers we run (see
// RESEARCH.md). The env var must be set before the pool is created, so we set it
// here and only then load the CLI. An explicit UV_THREADPOOL_SIZE always wins.
import os from 'node:os';

process.env.UV_THREADPOOL_SIZE ??= String(os.availableParallelism?.() ?? os.cpus().length);

await import('./cli.js');
