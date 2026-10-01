// interactive.js — friendly prompts when the tool is launched with no arguments
// (typical flow: double-click resize.bat, drag a folder into the console window)
import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';
import prompts from 'prompts';
import pc from 'picocolors';

async function resolvePath(input) {
  const clean = String(input ?? '').trim().replace(/^["']|["']$/g, ''); // drag&drop pastes quoted paths
  if (!clean) return null;
  const expanded = clean.startsWith('~') ? path.join(os.homedir(), clean.slice(1)) : clean;
  return path.resolve(expanded);
}

/** input must exist; throws with a clear message otherwise */
async function resolveDir(input) {
  const abs = await resolvePath(input);
  if (!abs) return null;
  const st = await fsp.stat(abs).catch(() => null);
  if (!st) throw new Error(`Path not found: ${abs}`);
  return abs;
}

/**
 * Ask for the minimal set of options; everything else keeps its CLI default.
 * `ask` is injectable so tests can simulate answers without a TTY.
 * @returns options object consumed by runResize
 */
export async function askOptions(defaults, ask = prompts) {
  console.log(pc.bold('\nImage Resizer — interactive mode'));
  console.log('Tip: you can drag & drop a folder into this window.\n');

  const { inputRaw } = await ask({
    type: 'text',
    name: 'inputRaw',
    message: 'Folder of images to convert (or a single image file)',
    validate: (v) => (v.trim() ? true : 'Please enter a folder path'),
  });
  if (!inputRaw) throw new Error('Cancelled.');
  const input = await resolveDir(inputRaw);

  const { maxSize } = await ask({
    type: 'number',
    name: 'maxSize',
    message: 'Longest side in pixels',
    initial: defaults.maxSize,
    min: 16, max: 30000,
  });

  const { quality } = await ask({
    type: 'number',
    name: 'quality',
    message: 'JPEG quality (1-100, 82 is a good default)',
    initial: defaults.quality,
    min: 1, max: 100,
  });

  const { recursive } = await ask({
    type: 'confirm',
    name: 'recursive',
    message: 'Include subfolders?',
    initial: defaults.recursive,
  });

  // default output: a subfolder inside the input named after the size (e.g. Photos\3800).
  // It usually does not exist yet — the tool creates it — so only the input is existence-checked.
  const inputStat = await fsp.stat(input).catch(() => null);
  const base = inputStat?.isFile() ? path.dirname(input) : input;
  const { outputRaw } = await ask({
    type: 'text',
    name: 'outputRaw',
    message: 'Output folder',
    initial: path.join(base, String(maxSize)),
  });
  if (outputRaw === undefined) throw new Error('Cancelled.');
  const output = (await resolvePath(outputRaw)) ?? path.join(base, String(maxSize));

  return { ...defaults, input, output, maxSize, quality, recursive };
}
