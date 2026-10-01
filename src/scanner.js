// scanner.js — discover image files under an input folder (recursively by default)
import fsp from 'node:fs/promises';
import path from 'node:path';

// Formats the bundled sharp/libvips build can decode (avif/heic decode through the heif loader).
export const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.jpe', '.jfif',
  '.png', '.webp', '.tif', '.tiff',
  '.gif', '.svg', '.avif', '.heic', '.heif',
]);

/**
 * Walk a folder and collect candidate image files.
 * @param {string} inputPath        folder (or a single file) to process
 * @param {string} outputPath       resolved output folder — always excluded from the scan
 * @param {boolean} recursive       include subfolders
 * @returns {Promise<{files: string[], scanned: number, excludedOutput: boolean}>}
 */
export async function scanImages(inputPath, outputPath, recursive) {
  const st = await fsp.stat(inputPath).catch(() => null);
  if (!st) throw new Error(`Input path does not exist: ${inputPath}`);
  if (st.isFile()) return { files: [path.resolve(inputPath)], scanned: 1, excludedOutput: false };

  const outReal = path.resolve(outputPath).toLowerCase();
  const files = [];
  let scanned = 0;
  let excludedOutput = false;

  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (e) {
      return; // unreadable folder — reported by caller via counts, not fatal
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (path.resolve(full).toLowerCase() === outReal) { excludedOutput = true; continue; }
        if (ent.name.startsWith('.') || ent.name.startsWith('_logs')) continue;
        if (recursive) await walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      scanned++;
      if (IMAGE_EXTENSIONS.has(path.extname(ent.name).toLowerCase())) {
        files.push(path.resolve(full));
      }
    }
  }

  await walk(path.resolve(inputPath));
  files.sort(); // deterministic order → stable logs across runs
  return { files, scanned, excludedOutput };
}
