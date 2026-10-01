#!/usr/bin/env node
// cli.js — command-line entry point
//   resizer -i <folder> [options]     batch mode
//   resizer (no arguments)            interactive mode
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Command } from 'commander';
import pc from 'picocolors';

import { runResize } from './run.js';
import { askOptions } from './interactive.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const APP = { version: pkg.version, node: process.version, platform: `${process.platform} ${process.arch}`, cpus: os.cpus().length };

const program = new Command();

program
  .name('resizer')
  .description('Batch-resize every image in a folder to JPG (longest side limited, default 3800px).')
  .version(APP.version, '-V, --version')
  .option('-i, --input <dir>', 'folder (or single file) containing images')
  .option('-o, --output <dir>', 'output folder (default: "<input>-resized" next to the input)')
  .option('-s, --max-size <px>', 'longest side limit in pixels', '3800')
  .option('-q, --quality <n>', 'JPEG quality 1-100', '82')
  .option('-w, --workers <n>', 'parallel images ("auto" = CPU core count)', 'auto')
  .option('--no-recursive', 'do not descend into subfolders')
  .option('--overwrite', 're-convert even if the output JPG already exists (default: skip = resume-safe)')
  .option('--keep-metadata', 'keep EXIF/GPS metadata (default: strip EXIF but keep the ICC colour profile)')
  .option('--mozjpeg', 'use mozjpeg encoder (~30% smaller files, ~2-3x slower)')
  .option('--dry-run', 'scan and plan only — write nothing')
  .option('--log-level <level>', 'debug | info | warn | error', 'info')
  .option('--log-dir <dir>', 'where run logs are written (default: "<output>/_logs")')
  .option('--sharp-concurrency <n|auto>', 'libvips internal thread limit (default: 1 when workers > 1)', undefined)
  .option('--quiet', 'no progress bar, errors only')
  .action(async (opts) => {
    try {
      await main(opts);
    } catch (e) {
      console.error(pc.red(`\nError: ${e.message}`));
      if (process.env.RESIZER_DEBUG) console.error(e.stack);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(pc.red(`Unexpected error: ${e.message}`));
  process.exitCode = 1;
});

async function main(cliOpts) {
  const maxSize = clampInt(cliOpts.maxSize, 16, 30000, 3800, 'max-size');
  const quality = clampInt(cliOpts.quality, 1, 100, 82, 'quality');
  const workers = cliOpts.workers === 'auto'
    ? os.cpus().length
    : clampInt(cliOpts.workers, 1, 256, os.cpus().length, 'workers');

  let { input, output } = cliOpts;
  let recursive = cliOpts.recursive;
  if (!input) {
    const asked = await askOptions({ maxSize, quality, recursive });
    input = asked.input;
    output = asked.output;
    recursive = asked.recursive;
  }
  input = path.resolve(input.trim().replace(/^["']|["']$/g, ''));
  output = path.resolve((output ?? `${input}-resized`).trim().replace(/^["']|["']$/g, ''));
  if (input === output) throw new Error('Output folder must be different from the input folder.');

  const opts = {
    input,
    output,
    maxSize, quality, workers,
    recursive,
    overwrite: cliOpts.overwrite ?? false,
    keepMetadata: cliOpts.keepMetadata ?? false,
    mozjpeg: cliOpts.mozjpeg ?? false,
    dryRun: cliOpts.dryRun ?? false,
    logLevel: cliOpts.logLevel,
    logDir: cliOpts.logDir ? path.resolve(cliOpts.logDir) : path.join(output, '_logs'),
    sharpConcurrency: cliOpts.sharpConcurrency === undefined ? undefined : (cliOpts.sharpConcurrency === 'auto' ? 'auto' : clampInt(cliOpts.sharpConcurrency, 0, 256, 0, 'sharp-concurrency')),
    quiet: cliOpts.quiet ?? false,
  };

  if (!opts.quiet) {
    console.log(pc.bold(`\nImage Resizer v${APP.version}`));
    console.log(`  Input   : ${opts.input}`);
    console.log(`  Output  : ${opts.output}`);
    console.log(`  Longest side ≤ ${opts.maxSize}px | JPEG q${opts.quality} | ${opts.workers} worker(s)${opts.recursive ? ' | recursive' : ''}`);
    console.log(`  Logs    : ${opts.logDir}\n`);
  }

  const { stats, logPath } = await runResize(opts, APP);

  if (stats.total === 0) {
    console.log(pc.yellow('No image files found. Supported: jpg jpeg png webp gif tif tiff svg avif heic heif'));
  }
  if (logPath && !opts.quiet) console.log(pc.dim(`\nDetailed log: ${logPath}`));
  process.exitCode = stats.errors > 0 ? 2 : 0;
}

function clampInt(v, min, max, fallback, name) {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  if (n < min || n > max) throw new Error(`--${name} must be between ${min} and ${max}`);
  return n;
}
