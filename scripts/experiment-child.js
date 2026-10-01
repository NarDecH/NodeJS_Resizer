// experiment-child.js — one measured run; spawned by experiment.js with UV_THREADPOOL_SIZE pre-set
import os from 'node:os';
import { runResize } from '../src/run.js';

const [, , workers, uvt, sharpC, cache, src, out, logDir] = process.argv;
const t0 = Date.now();
const { stats } = await runResize(
  {
    input: src, output: out,
    maxSize: 3800, quality: 82, recursive: false, overwrite: true,
    keepMetadata: false, mozjpeg: false, dryRun: false,
    logLevel: 'error', quiet: true, logDir,
    workers: Number(workers),
    sharpConcurrency: sharpC === 'auto' ? 'auto' : Number(sharpC),
    cache: cache === 'none' ? 0 : undefined,
  },
  { version: 'experiment', node: process.version, platform: process.platform, cpus: os.cpus().length },
);
console.log(JSON.stringify({
  workers: Number(workers), uvt: Number(uvt), sharp: sharpC, cache,
  wallS: (Date.now() - t0) / 1000,
  ips: stats.throughputIps, mps: stats.throughputMps,
  rssMB: Math.round(process.memoryUsage().rss / 1e6),
}));
