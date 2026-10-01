// converter.js — single-image pipeline: decode → auto-orient → resize (long side limit) → encode JPEG
import fsp from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUTPUT_TMP_SUFFIX = '.part';

/** libvips renders SVG at 72 dpi by default; raise density so small SVGs rasterise above the limit. */
function svgDensity(meta, maxSize) {
  const side = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (!side || side >= maxSize) return 72;
  return Math.min(Math.ceil(72 * (maxSize / side)), 2400);
}

/**
 * Process one image file into a JPG under outputDir.
 * @param {object} cfg  { maxSize, quality, mozjpeg, keepMetadata, overwrite, logger }
 * @returns result object consumed by logger.fileResult / report
 */
export async function convertOne(inputFile, outputDir, cfg, relativeDir = '') {
  const t0 = process.hrtime.bigint();
  const result = {
    input: inputFile,
    output: null,
    status: 'converted', // converted | skipped | error
    widthIn: null, heightIn: null, widthOut: null, heightOut: null,
    formatIn: null, bytesIn: null, bytesOut: null,
    durationMs: null, note: '',
  };

  const base = path.basename(inputFile, path.extname(inputFile));
  const outDirAbs = relativeDir ? path.join(outputDir, relativeDir) : outputDir;
  const outPath = path.join(outDirAbs, `${base}.jpg`);
  result.output = outPath;

  try {
    // Resume support: an existing output means this file was already converted.
    const exists = await fsp.stat(outPath).then(() => true, () => false);
    if (exists && !cfg.overwrite) {
      result.status = 'skipped';
      result.note = 'output already exists (use --overwrite to redo)';
      result.bytesOut = (await fsp.stat(outPath)).size;
      return result;
    }

    let meta;
    try {
      meta = await sharp(inputFile, { failOn: 'none' }).metadata();
    } catch (e) {
      result.status = 'error';
      result.note = `unreadable/corrupt (${e.message})`;
      return result;
    }
    result.formatIn = meta.format;
    // EXIF orientation 5-8 means the stored raster is rotated 90°; swap for true display size.
    const swap = meta.orientation >= 5;
    result.widthIn = swap ? meta.height : meta.width;
    result.heightIn = swap ? meta.width : meta.height;
    result.bytesIn = meta.size ?? (await fsp.stat(inputFile)).size;

    let pipeline = sharp(inputFile, {
      failOn: 'none',
      sequentialRead: true,
      limitInputPixels: cfg.limitInputPixels,
      density: meta.format === 'svg' ? svgDensity(meta, cfg.maxSize) : undefined,
    });
    pipeline.on('warning', (w) => cfg.logger?.warn('sharp_warning', { input: inputFile, message: String(w.message ?? w) }));

    // auto-rotate from EXIF first so "longest side" refers to the displayed image
    pipeline = pipeline.rotate();
    if (cfg.keepMetadata) pipeline = pipeline.keepMetadata();
    else pipeline = pipeline.keepIccProfile(); // preserve colour profile even when stripping EXIF

    pipeline = pipeline.resize(cfg.maxSize, cfg.maxSize, { fit: 'inside', withoutEnlargement: true });
    pipeline = pipeline.jpeg({
      quality: cfg.quality,
      progressive: true,
      mozjpeg: cfg.mozjpeg,
      chromaSubsampling: '4:2:0',
    });

    await fsp.mkdir(outDirAbs, { recursive: true });
    const tmpPath = outPath + OUTPUT_TMP_SUFFIX;
    await pipeline.toFile(tmpPath);
    await fsp.rename(tmpPath, outPath); // atomic on same volume → resume-safe

    const outStat = await fsp.stat(outPath);
    result.bytesOut = outStat.size;
    result.durationMs = Number(process.hrtime.bigint() - t0) / 1e6;

    const outMeta = await sharp(outPath).metadata();
    result.widthOut = outMeta.width;
    result.heightOut = outMeta.height;
    if (result.widthIn !== null && Math.max(result.widthIn, result.heightIn) <= cfg.maxSize) {
      result.note = 'no resize needed (already within limit) — re-encoded to JPG';
    }
    return result;
  } catch (e) {
    result.status = 'error';
    result.durationMs = Number(process.hrtime.bigint() - t0) / 1e6;
    result.note = e.message;
    await fsp.unlink(outPath + OUTPUT_TMP_SUFFIX).catch(() => {}); // never leave .part debris
    return result;
  }
}
