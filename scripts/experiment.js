// experiment.js — prove/disprove the libuv-threadpool bottleneck hypothesis.
// Each measured run is a fresh node process with UV_THREADPOOL_SIZE preset by the
// parent (so the env var is guaranteed effective before libuv creates its pool).
// Optionally samples CPU load during a run: node scripts/experiment.js 48 cpu
import fsp from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_LIBRARY = path.join(ROOT, '__Photo');
const COUNT = Number(process.argv[2] ?? 48);
const SAMPLE_CPU = process.argv[3] === 'cpu';
const BENCH = path.join(ROOT, 'bench');
const SRC = path.join(BENCH, 'src');

const CHILD = path.join(ROOT, 'scripts', 'experiment-child.js');

async function main() {
  await fsp.mkdir(SRC, { recursive: true });
  let names = (await fsp.readdir(SRC_LIBRARY)).filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  const step = Math.max(1, Math.floor(names.length / COUNT));
  names = names.filter((_, i) => i % step === 0).slice(0, COUNT);
  console.log(`copying ${names.length} source files …`);
  for (const n of names) await fsp.copyFile(path.join(SRC_LIBRARY, n), path.join(SRC, n));

  // execFileSync with stdout capture
  function runCapture(workers, uvt, sharpC, cache = 'default') {
    const stdout = execFileSync(process.execPath, [CHILD, workers, uvt, sharpC, cache, SRC, path.join(BENCH, 'out'), path.join(BENCH, 'logs')], {
      env: { ...process.env, UV_THREADPOOL_SIZE: String(uvt) },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    return JSON.parse(stdout.trim().split('\n').pop());
  }

  function cpuSampler(seconds) {
    const p = spawn('powershell.exe', ['-NoProfile', '-Command',
      `1..${seconds} | ForEach-Object { (Get-CimInstance Win32_Processor).LoadPercentage; Start-Sleep -Seconds 1 }`],
      { stdio: ['ignore', 'pipe', 'ignore'] });
    return new Promise((resolve) => {
      let out = '';
      p.stdout.on('data', (d) => { out += d; });
      p.on('close', () => {
        const vals = out.split(/\s+/).filter(Boolean).map(Number).filter((v) => v >= 0 && v <= 100);
        resolve(vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null);
      });
    });
  }

  async function measured(label, workers, uvt, sharpC, cache) {
    let cpu = null;
    let sampler;
    if (SAMPLE_CPU) {
      sampler = cpuSampler(14); // start sampling in the background
      await new Promise((r) => setTimeout(r, 500));
    }
    const row = runCapture(workers, uvt, sharpC, cache);
    if (SAMPLE_CPU) cpu = await sampler;
    await fsp.rm(path.join(BENCH, 'out'), { recursive: true, force: true });
    console.log(
      `w=${String(workers).padStart(2)} UVT=${String(uvt).padStart(2)} sharp=${String(sharpC).padEnd(4)} cache=${String(cache).padEnd(7)}`
      + ` | wall ${row.wallS.toFixed(2).padStart(6)}s | ${row.ips.toFixed(2).padStart(6)} img/s | ${row.mps.toFixed(1).padStart(6)} MP/s`
      + ` | per-worker ${(row.mps / workers).toFixed(1).padStart(5)} MP/s`
      + ` | rss ${String(row.rssMB).padStart(5)} MB`
      + (cpu !== null ? ` | CPU ${String(cpu).padStart(3)}%` : ''),
    );
    return { ...row, cpu };
  }

  console.log('warm-up run …');
  runCapture(8, 8, '1');
  await fsp.rm(path.join(BENCH, 'out'), { recursive: true, force: true });

  const matrix = [];
  matrix.push(await measured('baseline', 16, 4, '1'));            // current default (UVT=4)
  matrix.push(await measured('uvt=8', 8, 8, '1'));
  matrix.push(await measured('uvt=12', 12, 12, '1'));
  matrix.push(await measured('uvt=16', 16, 16, '1'));
  matrix.push(await measured('uvt=16-auto', 16, 16, 'auto'));
  matrix.push(await measured('uvt=16-cacheOff', 16, 16, '1', 'none'));
  matrix.push(await measured('uvt=24', 24, 24, '1'));
  matrix.push(await measured('uvt=8-sharp2', 8, 8, '2'));

  await fsp.writeFile(path.join(BENCH, 'experiment.json'),
    JSON.stringify({ count: names.length, cpu: os.cpus()[0].model, cores: os.cpus().length, matrix }, null, 2));
  const best = [...matrix].sort((a, b) => b.mps - a.mps)[0];
  console.log(`\nBEST: ${best.mps.toFixed(1)} MP/s (w=${best.workers} UVT=${best.uvt} sharp=${best.sharp} cache=${best.cache})`);
  await fsp.rm(SRC, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
