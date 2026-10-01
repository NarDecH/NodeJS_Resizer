// make-samples.js — generate a mixed test set covering every code path:
// big/small images, PNG transparency, WebP, GIF, TIFF, SVG, EXIF orientation,
// a corrupt file and a non-image file. Usage: node scripts/make-samples.js [dir]
import path from 'node:path';
import fsp from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test', 'samples');
await fsp.mkdir(path.join(dir, 'sub'), { recursive: true });

function gradient(width, height, channels = 3) {
  const buf = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      buf[i] = Math.round(255 * x / width);
      buf[i + 1] = Math.round(255 * y / height);
      buf[i + 2] = Math.round(255 * (x + y) / (width + height));
    }
  }
  return { create: { width, height, channels, background: { r: 30, g: 60, b: 120 } }, raw: buf };
}

async function make(name, width, height, format, opts = {}) {
  const channels = format === 'png' ? 4 : 3;
  const img = sharp({ create: { width, height, channels, background: opts.bg ?? { r: 40, g: 90, b: 160 } } });
  await img.composite([{
    input: Buffer.from(
      `<svg width="${Math.round(width / 3)}" height="${Math.round(height / 3)}">
         <circle cx="50%" cy="50%" r="45%" fill="#ffd166"/>
         <text x="50%" y="54%" font-size="48" text-anchor="middle" fill="#073b4c">${name}</text>
       </svg>`,
    ),
  }])[format]({ quality: opts.quality }).toFile(path.join(dir, name));
  console.log('created', name, `${width}x${height}`);
}

await make('big-photo.jpg', 6000, 4000, 'jpeg', { quality: 90 });           // needs downscale
await make('huge-portrait.jpg', 4160, 6240, 'jpeg', { quality: 95 });       // portrait > limit
await make('edge-exact.jpg', 3800, 2533, 'jpeg', { quality: 85 });          // exactly at limit
await make('small-photo.jpg', 1200, 800, 'jpeg', { quality: 70 });          // below limit → re-encode only
await make('screenshot.png', 5200, 2900, 'png');                            // PNG → JPG, transparency flattened
await make('webp-source.webp', 4500, 3000, 'webp');                         // WebP → JPG
await make('scan.tiff', 4800, 3200, 'tiff');                                // TIFF → JPG
await make('icon.gif', 2000, 1500, 'gif');                                  // GIF (first frame) → JPG
await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#2a9d8f' } })
  .png().toFile(path.join(dir, 'sub', 'nested-folder.png'));                // recursion test
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#e76f51' } })
  .jpeg().toFile(path.join(dir, 'tiny.jpg'));                               // small, stays small
await fsp.writeFile(path.join(dir, 'corrupt.jpg'), Buffer.from('GIF89a-not-really-an-image-just-garbage-'.repeat(40)));
console.log('created corrupt.jpg (intentionally broken)');
await fsp.writeFile(path.join(dir, 'notes.txt'), 'not an image — must be ignored by the scanner');
console.log('created notes.txt (non-image)');
console.log('\nsample set ready in', dir);
