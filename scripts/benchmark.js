// benchmark.js — measure throughput across worker counts × libvips internal threads
// on a real photo subset. Results → bench/results.json (+ printed table).
// The measurement runs in a child process spawned with UV_THREADPOOL_SIZE preset
// (exactly what src/entry.mjs does at runtime), so numbers reflect real defaults.
// Usage: node scripts/benchmark.js [count=48]
import fsp from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_LIBRARY = path.join(ROOT, '__Photo'); // user's real photo library (read-only source)
const COUNT = Number(process.argv[2] ?? 48);
const UVT = os.availableParallelism?.() ?? os.cpus().length;
const BENCH = path.join(ROOT, 'bench');
const SRC = path.join(BENCH, 'src');

async function main() {
  await fsp.mkdir(SRC, { recursive: true });
  let names = (await fsp.readdir(SRC_LIBRARY)).filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  // take an even spread across the library (different prefixes / cameras)
  const step = Math.max(1, Math.floor(names.length / COUNT));
  names = names.filter((_, i) => i % step === 0).slice(0, COUNT);
  console.log(`copying ${names.length} source files from ${SRC_LIBRARY} …`);
  for (const n of names) await fsp.copyFile(path.join(SRC_LIBRARY, n), path.join(SRC, n));

  execFileSync(process.execPath, [
    path.join(ROOT, 'scripts', 'benchmark-child.js'),
    String(COUNT), SRC, path.join(BENCH, 'out'), path.join(BENCH, 'logs'),
  ], {
    env: { ...process.env, UV_THREADPOOL_SIZE: String(UVT) },
    stdio: 'inherit',
  });

  await fsp.rm(SRC, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
