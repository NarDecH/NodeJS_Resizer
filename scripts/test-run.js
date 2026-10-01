// test-run.js — end-to-end test: build a fresh sample set, run the CLI, assert results.
import path from 'node:path';
import fsp from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES = path.join(ROOT, 'test', 'samples');
const OUT = path.join(ROOT, 'test', 'out-e2e');

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  ✔ ${name}`);
  else { failures++; console.error(`  ✘ ${name} ${extra}`); }
}

/** run the CLI via the real entry point (sets UV_THREADPOOL_SIZE); exit code 2 (some files errored) is normal here */
function runCli(args) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'src', 'entry.mjs'), ...args], { stdio: 'inherit' });
  } catch (e) {
    if (e.status !== 2) throw e;
  }
}

async function main() {
  console.log('building sample set …');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-samples.js'), SAMPLES], { stdio: 'inherit' });
  await fsp.rm(path.join(SAMPLES, '3800'), { recursive: true, force: true });

  console.log('run 1 — full conversion …');
  runCli(['-i', SAMPLES, '-o', OUT, '-s', '3800', '-q', '82', '--quiet']);

  const dim = async (rel) => { const m = await sharp(path.join(OUT, rel)).metadata(); return `${m.width}x${m.height}`; };
  check('big 6000x4000 → 3800x2533', (await dim('big-photo.jpg')) === '3800x2533');
  check('portrait 4160x6240 → 2533x3800', (await dim('huge-portrait.jpg')) === '2533x3800');
  check('exact 3800 stays', (await dim('edge-exact.jpg')) === '3800x2533');
  check('small not enlarged', (await dim('small-photo.jpg')) === '1200x800');
  check('png converted', (await fsp.stat(path.join(OUT, 'screenshot.jpg'))).isFile());
  check('webp converted', (await fsp.stat(path.join(OUT, 'webp-source.jpg'))).isFile());
  check('tiff converted', (await fsp.stat(path.join(OUT, 'scan.jpg'))).isFile());
  check('gif converted', (await fsp.stat(path.join(OUT, 'icon.jpg'))).isFile());
  check('subfolder preserved', (await fsp.stat(path.join(OUT, 'sub', 'nested-folder.jpg'))).isFile());
  check('corrupt not written', (await fsp.stat(path.join(OUT, 'corrupt.jpg')).then(() => false, () => true)));
  check('notes.txt ignored', (await fsp.stat(path.join(OUT, 'notes.txt')).then(() => false, () => true)));

  console.log('run 2 — resume (all skipped) …');
  runCli(['-i', SAMPLES, '-o', OUT, '--quiet']);
  const jsonl = (await fsp.readFile(path.join(OUT, '_logs', 'latest.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  const runEnd = jsonl.find((e) => e.event === 'run_end');
  check('resume converts nothing', runEnd.stats.converted === 0, JSON.stringify(runEnd.stats));
  check('resume skips all valid', runEnd.stats.skipped === 10, `skipped=${runEnd.stats.skipped}`);
  check('corrupt still reported', runEnd.stats.errors === 1, `errors=${runEnd.stats.errors}`);

  console.log('run 3 — dry-run writes no images …');
  const DRY = path.join(ROOT, 'test', 'out-dry-e2e');
  runCli(['-i', SAMPLES, '-o', DRY, '--dry-run', '--quiet']);
  const dryFiles = (await fsp.readdir(DRY)).filter((f) => f.endsWith('.jpg'));
  check('dry-run: zero images written', dryFiles.length === 0, dryFiles.join(','));

  console.log('run 4 — default output = <input>/<size> (inside the input folder) …');
  runCli(['-i', SAMPLES, '--quiet']);
  check('output lands in <input>/3800', (await fsp.stat(path.join(SAMPLES, '3800', 'big-photo.jpg'))).isFile());
  check('subfolder mirrored into <input>/3800', (await fsp.stat(path.join(SAMPLES, '3800', 'sub', 'nested-folder.jpg'))).isFile());
  check('logs written to <input>/3800/_logs', (await fsp.stat(path.join(SAMPLES, '3800', '_logs', 'latest.log'))).isFile());

  console.log('run 5 — same input again (scanner must exclude the output dir) …');
  runCli(['-i', SAMPLES, '--quiet']);
  const nested = await fsp.stat(path.join(SAMPLES, '3800', '3800')).then(() => true, () => false);
  check('no nested 3800/3800 output', !nested);
  const jsonl2 = (await fsp.readFile(path.join(SAMPLES, '3800', '_logs', 'latest.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  const end2 = jsonl2.find((e) => e.event === 'run_end');
  check('re-run on same input skips everything', end2.stats.converted === 0, JSON.stringify(end2.stats));

  console.log('log files …');
  const logs = await fsp.readdir(path.join(OUT, '_logs'));
  check('run .log written', logs.some((f) => /^run-.*\.log$/.test(f)));
  check('run .jsonl written', logs.some((f) => /^run-.*\.jsonl$/.test(f)));
  check('summary.json written', logs.some((f) => f.endsWith('.summary.json')));
  check('latest.log written', logs.includes('latest.log'));

  if (failures) { console.error(`\nFAILED: ${failures} check(s)`); process.exit(1); }
  console.log('\nALL CHECKS PASSED ✔');
}

main().catch((e) => { console.error(e); process.exit(1); });
