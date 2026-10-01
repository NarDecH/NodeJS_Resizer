// benchmark-child.js — runs the measurement matrix (spawned by benchmark.js with
// UV_THREADPOOL_SIZE already in the environment, before the libuv pool exists).
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runResize } from '../src/run.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [count, src, outDir, logDir] = process.argv.slice(2);
const APP = { version: 'bench', node: process.version, platform: `${process.platform} ${process.arch}`, cpus: os.cpus().length };

const opts = {
  input: src, output: outDir,
  maxSize: 3800, quality: 82, recursive: false, overwrite: true,
  keepMetadata: false, mozjpeg: false, dryRun: false,
  logLevel: 'error', quiet: true, logDir,
};

async function main() {
  // warm the OS file cache so every measured run starts equally warm
  console.log('warm-up run …');
  await runResize({ ...opts, workers: 8 }, APP);
  await fsp.rm(outDir, { recursive: true, force: true });

  const matrix = [];
  for (const workers of [1, 2, 4, 6, 8, 12, 16, 24]) {
    for (const sharpConcurrency of ['auto', 1]) {
      const t0 = Date.now();
      const { stats } = await runResize({ ...opts, workers, sharpConcurrency }, APP);
      const wallS = (Date.now() - t0) / 1000;
      const row = { workers, sharpConcurrency, wallS, ips: stats.throughputIps, mps: stats.throughputMps, bytesIn: stats.bytesIn, bytesOut: stats.bytesOut, errors: stats.errors };
      matrix.push(row);
      console.log(`workers=${String(workers).padStart(2)} sharp=${String(sharpConcurrency).padEnd(4)} | wall ${wallS.toFixed(2).padStart(6)}s | ${row.ips.toFixed(2).padStart(6)} img/s | ${row.mps.toFixed(1).padStart(6)} MP/s`);
      await fsp.rm(outDir, { recursive: true, force: true });
    }
  }

  const results = {
    count: Number(count),
    cpu: os.cpus()[0].model,
    cores: os.cpus().length,
    uvThreadpool: Number(process.env.UV_THREADPOOL_SIZE ?? 4),
    matrix,
  };
  await fsp.writeFile(path.join(ROOT, 'bench', 'results.json'), JSON.stringify(results, null, 2));
  const best = [...matrix].sort((a, b) => b.mps - a.mps)[0];
  console.log(`\nBEST: workers=${best.workers} sharp=${best.sharpConcurrency} → ${best.mps.toFixed(1)} MP/s (${best.ips.toFixed(2)} img/s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
