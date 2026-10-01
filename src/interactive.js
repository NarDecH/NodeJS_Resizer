// interactive.js — friendly prompts when the tool is launched with no arguments
// (typical flow: double-click resize.bat, drag a folder into the console window)
import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';
import prompts from 'prompts';
import pc from 'picocolors';

async function resolveDir(input) {
  const clean = input.trim().replace(/^["']|["']$/g, ''); // drag&drop pastes quoted paths
  if (!clean) return null;
  const expanded = clean.startsWith('~') ? path.join(os.homedir(), clean.slice(1)) : clean;
  const abs = path.resolve(expanded);
  const st = await fsp.stat(abs).catch(() => null);
  if (!st) throw new Error(`Path not found: ${abs}`);
  return abs;
}

/**
 * Ask for the minimal set of options; everything else keeps its CLI default.
 * @returns options object consumed by runResize
 */
export async function askOptions(defaults) {
  console.log(pc.bold('\nImage Resizer — interactive mode'));
  console.log('Tip: you can drag & drop a folder into this window.\n');

  const { inputRaw } = await prompts({
    type: 'text',
    name: 'inputRaw',
    message: 'Folder of images to convert (or a single image file)',
    validate: (v) => (v.trim() ? true : 'Please enter a folder path'),
  });
  const input = await resolveDir(inputRaw);

  const { maxSize } = await prompts({
    type: 'number',
    name: 'maxSize',
    message: 'Longest side in pixels',
    initial: defaults.maxSize,
    min: 16, max: 30000,
  });

  const { quality } = await prompts({
    type: 'number',
    name: 'quality',
    message: 'JPEG quality (1-100, 82 is a good default)',
    initial: defaults.quality,
    min: 1, max: 100,
  });

  const { recursive } = await prompts({
    type: 'confirm',
    name: 'recursive',
    message: 'Include subfolders?',
    initial: defaults.recursive,
  });

  // default output: sibling folder "<input>-resized" — never inside the input folder,
  // so re-running the tool on the same input can't re-process its own results
  const outputBase = input.endsWith(path.sep) ? input.slice(0, -1) : input;
  const { outputRaw } = await prompts({
    type: 'text',
    name: 'outputRaw',
    message: 'Output folder',
    initial: `${outputBase}-resized`,
  });
  const output = await resolveDir(outputRaw) ?? path.resolve(outputRaw.trim().replace(/^["']|["']$/g, ''));

  return { ...defaults, input, output, maxSize, quality, recursive };
}
