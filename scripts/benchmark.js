// benchmark.js — measure throughput across worker counts × libvips internal threads
// on a real photo subset. Results → bench/results.json (+ printed table).
// Usage: node scripts/benchmark.js [count=48]
import path from 'node:path';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

import { runResize } from '../src/run.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_LIBRARY = path.join(ROOT, '__Photo'); // user's real photo library (read-only source)
const COUNT = Number(process.argv[2] ?? 48);
const BENCH = path.join(ROOT, 'bench');
const SRC = path.join(BENCH, 'src');

const APP = { version: 'bench', node: process.version, platform: `${process.platform} ${process.arch}`, cpus: os.cpus().length };

async function main() {
  await fsp.mkdir(SRC, { recursive: true });
  let names = (await fsp.readdir(SRC_LIBRARY)).filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  // take an even spread across the library (different prefixes / cameras)
  const step = Math.max(1, Math.floor(names.length / COUNT));
  names = names.filter((_, i) => i % step === 0).slice(0, COUNT);
  console.log(`copying ${names.length} source files from ${SRC_LIBRARY} …`);
  for (const n of names) await fsp.copyFile(path.join(SRC_LIBRARY, n), path.join(SRC, n));

  const opts = {
    input: SRC, output: path.join(BENCH, 'out'),
    maxSize: 3800, quality: 82, recursive: false, overwrite: true,
    keepMetadata: false, mozjpeg: false, dryRun: false,
    logLevel: 'error', quiet: true, logDir: path.join(BENCH, 'logs'),
  };

  // warm the OS file cache so every measured run starts equally warm
  console.log('warm-up run …');
  await runResize({ ...opts, workers: 8 }, APP);

  const matrix = [];
  for (const workers of [1, 2, 4, 6, 8, 12, 16, 24]) {
    for (const sharpConcurrency of ['auto', 1]) {
      const label = `workers=${String(workers).padStart(2)} sharp=${String(sharpConcurrency).padEnd(4)}`;
      const t0 = Date.now();
      const { stats } = await runResize({ ...opts, workers, sharpConcurrency }, APP);
      const wallS = (Date.now() - t0) / 1000;
      const row = { workers, sharpConcurrency, wallS, ips: stats.throughputIps, mps: stats.throughputMps, bytesIn: stats.bytesIn, bytesOut: stats.bytesOut, errors: stats.errors };
      matrix.push(row);
      console.log(`${label} | wall ${wallS.toFixed(2).padStart(6)}s | ${row.ips.toFixed(2).padStart(6)} img/s | ${row.mps.toFixed(1).padStart(6)} MP/s`);
      await fsp.rm(path.join(BENCH, 'out'), { recursive: true, force: true });
    }
  }

  await fsp.writeFile(path.join(BENCH, 'results.json'), JSON.stringify({ count: names.length, cpu: os.cpus()[0].model, cores: os.cpus().length, matrix }, null, 2));
  const best = [...matrix].sort((a, b) => b.mps - a.mps)[0];
  console.log(`\nBEST: workers=${best.workers} sharp=${best.sharpConcurrency} → ${best.mps.toFixed(1)} MP/s (${best.ips.toFixed(2)} img/s)`);
  await fsp.rm(SRC, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
