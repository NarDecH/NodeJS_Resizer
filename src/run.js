// run.js — orchestration: scan → worker pool → live progress → summary → log flush
import path from 'node:path';
import fsp from 'node:fs/promises';
import sharp from 'sharp';
import cliProgress from 'cli-progress';
import pc from 'picocolors';

import { scanImages } from './scanner.js';
import { convertOne } from './converter.js';
import { runPool } from './pool.js';
import { Logger, fmtBytes } from './logger.js';

export function humanBytes(n) { return fmtBytes(n); }

/**
 * @param {object} opts
 *  input, output, maxSize, quality, workers, recursive, overwrite, keepMetadata,
 *  mozjpeg, dryRun, logLevel, logDir (resolved), quiet
 * @param {object} appMeta { version, node, platform, cpus }
 */
export async function runResize(opts, appMeta) {
  const t0 = Date.now();
  const logger = new Logger(opts.logDir, opts.logLevel, {
    ...appMeta,
    input: opts.input,
    output: opts.output,
    maxSize: opts.maxSize,
    quality: opts.quality,
    workers: opts.workers,
    recursive: opts.recursive,
    overwrite: opts.overwrite,
    keepMetadata: opts.keepMetadata,
    mozjpeg: opts.mozjpeg,
    dryRun: opts.dryRun,
  });
  await logger.init();

  logger.note(`scanning ${opts.input}${opts.recursive ? ' (recursive)' : ''}`);
  const { files, scanned, excludedOutput } = await scanImages(opts.input, opts.output, opts.recursive);
  if (excludedOutput) logger.info('scan_excluded_output_dir', { dir: opts.output });
  logger.info('scan_done', { files: files.length, entriesSeen: scanned });

  if (opts.dryRun) logger.note('DRY RUN — no files will be written');

  const stats = {
    total: files.length,
    converted: 0, skipped: 0, errors: 0,
    bytesIn: 0, bytesOut: 0,
    msTotal: 0, msMin: Infinity, msMax: 0,
    pixelsIn: 0, pixelsOut: 0,
    slowest: [], biggestSaving: [],
  };
  const perFile = [];

  const bar = opts.quiet ? null : new cliProgress.SingleBar({
    format: ' {bar} {percentage}% | {value}/{total} | {status}',
    hideCursor: true, clearOnComplete: true, barsize: 32,
  }, cliProgress.Presets.shades_classic);
  bar?.start(files.length, 0, { status: 'starting' });

  // libvips spawns its own threads per operation; pin it to 1 when we drive
  // many files in parallel so we never oversubscribe the CPU (see RESEARCH.md).
  const sc = opts.sharpConcurrency;
  sharp.concurrency(sc === undefined ? (opts.workers > 1 ? 1 : 0) : (sc === 'auto' ? 0 : sc));
  sharp.cache(50);

  await runPool(files, opts.workers, async (file, i) => {
    const relDir = opts.recursive ? path.dirname(path.relative(opts.input, file)) : '';
    if (opts.dryRun) {
      let meta = null;
      try { meta = await sharp(file, { failOn: 'none' }).metadata(); } catch { /* reported below */ }
      return {
        input: file,
        output: path.join(opts.output, relDir, path.basename(file, path.extname(file)) + '.jpg'),
        status: meta ? 'converted' : 'error',
        widthIn: meta?.width ?? null, heightIn: meta?.height ?? null,
        widthOut: null, heightOut: null,
        formatIn: meta?.format ?? null,
        bytesIn: meta?.size ?? null, bytesOut: null,
        durationMs: null,
        note: meta ? 'dry-run' : 'unreadable/corrupt',
      };
    }
    return convertOne(file, opts.output, {
      maxSize: opts.maxSize,
      quality: opts.quality,
      mozjpeg: opts.mozjpeg,
      keepMetadata: opts.keepMetadata,
      overwrite: opts.overwrite,
      logger,
    }, relDir === '.' ? '' : relDir);
  }, (r) => {
    logger.fileResult(r);
    perFile.push(r);
    if (r.status === 'converted') {
      stats.converted++;
      stats.bytesIn += r.bytesIn ?? 0;
      stats.bytesOut += r.bytesOut ?? 0;
      stats.msTotal += r.durationMs ?? 0;
      if (r.durationMs) { stats.msMin = Math.min(stats.msMin, r.durationMs); stats.msMax = Math.max(stats.msMax, r.durationMs); }
      if (r.widthIn && r.heightIn) stats.pixelsIn += r.widthIn * r.heightIn;
      if (r.widthOut && r.heightOut) stats.pixelsOut += r.widthOut * r.heightOut;
    } else if (r.status === 'skipped') stats.skipped++;
    else { stats.errors++; if (opts.quiet) process.stderr.write(`ERROR ${r.input}: ${r.note}\n`); }
    bar?.increment(1, { status: r.status === 'error' ? pc.red('error') : `${stats.converted + stats.skipped}/${stats.total}` });
  });

  bar?.stop();

  const wallMs = Date.now() - t0;
  const saved = stats.bytesIn - stats.bytesOut;
  const stats2 = {
    ...stats,
    msMin: stats.msMin === Infinity ? 0 : stats.msMin,
    wallMs,
    throughputIps: wallMs > 0 ? stats.converted / (wallMs / 1000) : 0,
    throughputMps: wallMs > 0 ? stats.pixelsIn / 1e6 / (wallMs / 1000) : 0,
    avgMsPerImage: stats.converted ? stats.msTotal / stats.converted : 0,
    percentSaved: stats.bytesIn ? (saved / stats.bytesIn) * 100 : 0,
  };

  // top-5 lists for the log (debug aid: find pathological files)
  stats2.slowest = [...perFile].filter((r) => r.durationMs).sort((a, b) => b.durationMs - a.durationMs).slice(0, 5)
    .map((r) => ({ input: r.input, ms: Math.round(r.durationMs) }));
  stats2.biggestSaving = [...perFile].filter((r) => r.bytesIn && r.bytesOut)
    .sort((a, b) => (b.bytesIn - b.bytesOut) - (a.bytesIn - a.bytesOut)).slice(0, 5)
    .map((r) => ({ input: r.input, saved: r.bytesIn - r.bytesOut }));

  const lines = {
    Files: `${stats.total} (${stats.converted} converted, ${stats.skipped} skipped, ${stats.errors} errors)`,
    WallTime: `${(wallMs / 1000).toFixed(2)} s`,
    Throughput: `${stats2.throughputIps.toFixed(2)} img/s | ${stats2.throughputMps.toFixed(1)} MP/s`,
    Size: `${fmtBytes(stats.bytesIn)} → ${fmtBytes(stats.bytesOut)} (${saved >= 0 ? '-' : '+'}${fmtBytes(Math.abs(saved))}, ${stats2.percentSaved.toFixed(1)}%)`,
    PerImage: `avg ${stats2.avgMsPerImage.toFixed(0)} ms | min ${stats2.msMin.toFixed(0)} ms | max ${stats2.msMax.toFixed(0)} ms`,
    Errors: String(stats.errors),
  };

  if (!opts.quiet) {
    console.log('');
    console.log(pc.bold('Summary'));
    for (const [k, v] of Object.entries(lines)) console.log(`  ${pc.cyan(k.padEnd(11))}${v}`);
    if (stats.errors) console.log(pc.red(`  ${stats.errors} file(s) failed — see the log's ERROR lines.`));
  }

  logger.note(`slowest files: ${JSON.stringify(stats2.slowest)}`);
  logger.note(`biggest savings: ${JSON.stringify(stats2.biggestSaving)}`);
  const flushed = await logger.flush({ lines, stats: stats2 });

  return { stats: stats2, logPath: flushed.logPath, jsonlPath: flushed.jsonlPath, logger };
}
