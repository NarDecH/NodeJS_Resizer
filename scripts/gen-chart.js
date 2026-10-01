// gen-chart.js — render docs/assets/concurrency-chart.svg from bench/results.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'bench', 'results.json'), 'utf8'));

const W = 860, H = 462, M = { top: 46, right: 24, bottom: 66, left: 70 };
const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
const xs = data.matrix.filter((r) => r.sharpConcurrency === 1);
const xa = data.matrix.filter((r) => r.sharpConcurrency === 'auto');
const workers = xs.map((r) => r.workers);
const yMax = Math.ceil(Math.max(...data.matrix.map((r) => r.mps)) / 50) * 50;
const satY = Math.round(Math.max(...data.matrix.map((r) => r.mps)));
const uvt = data.uvThreadpool ?? 4;
const px = (w) => M.left + ((workers.indexOf(w)) / (workers.length - 1)) * iw;
const py = (v) => M.top + ih - (v / yMax) * ih;

function line(rows, color) {
  const pts = rows.map((r) => `${px(r.workers).toFixed(1)},${py(r.mps).toFixed(1)}`).join(' ');
  const dots = rows.map((r) =>
    `<circle cx="${px(r.workers).toFixed(1)}" cy="${py(r.mps).toFixed(1)}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${r.workers} workers → ${r.mps.toFixed(1)} MP/s</title></circle>`).join('');
  return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"/>${dots}`;
}

const gridY = [0, 50, 100, 150, 200, 250, 300, 350, 400].filter((v) => v <= yMax);
const grid = gridY.map((v) => `
  <line x1="${M.left}" y1="${py(v)}" x2="${W - M.right}" y2="${py(v)}" stroke="#e3e8ee" stroke-width="1"/>
  <text x="${M.left - 10}" y="${py(v) + 4}" text-anchor="end" font-size="12" fill="#5b6470">${v}</text>`).join('');

const xLabels = workers.map((w) => `
  <text x="${px(w)}" y="${M.top + ih + 20}" text-anchor="middle" font-size="12" fill="#5b6470">${w}</text>`).join('');

const saturationY = py(satY);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, system-ui, sans-serif">
  <rect width="${W}" height="${H}" rx="12" fill="#ffffff"/>
  <text x="${M.left}" y="26" font-size="17" font-weight="600" fill="#1d2733">Throughput vs. file-level workers — ${data.count} real photos (14.2 MP → 3800px, q82)</text>
  <text x="${M.left}" y="${H - 12}" font-size="11" fill="#8a94a1">Intel Core i9-9900K (16 threads) · NVMe SSD · sharp 0.35 · Node 24 · libuv threadpool = ${uvt} · measured with npm run benchmark</text>
  ${grid}
  <text x="${M.left - 46}" y="${M.top + ih / 2}" font-size="12" fill="#5b6470" transform="rotate(-90 ${M.left - 46} ${M.top + ih / 2})" text-anchor="middle">MP / second</text>
  <text x="${M.left + iw / 2}" y="${M.top + ih + 40}" text-anchor="middle" font-size="12" fill="#5b6470">parallel file workers (-w)</text>
  <line x1="${M.left}" y1="${saturationY}" x2="${W - M.right}" y2="${saturationY}" stroke="#e76f51" stroke-width="1.4" stroke-dasharray="6 5"/>
  <text x="${M.left + 8}" y="${saturationY - 7}" font-size="12" fill="#e76f51" font-weight="600">saturates ≈ ${satY} MP/s (libvips threads = 1, threadpool = ${uvt})</text>
  ${line(xa, '#2a9d8f')}
  ${line(xs, '#264653')}
  <g transform="translate(${W - M.right - 236}, 40)">
    <rect width="228" height="40" rx="8" fill="#f5f7fa" stroke="#e3e8ee"/>
    <line x1="14" y1="15" x2="42" y2="15" stroke="#2a9d8f" stroke-width="2.5"/><circle cx="28" cy="15" r="4" fill="#2a9d8f"/>
    <text x="50" y="19" font-size="12" fill="#1d2733">libvips threads: auto (default C++)</text>
    <line x1="14" y1="30" x2="42" y2="30" stroke="#264653" stroke-width="2.5"/><circle cx="28" cy="30" r="4" fill="#264653"/>
    <text x="50" y="34" font-size="12" fill="#1d2733">libvips threads: 1 (our default)</text>
  </g>
  ${xLabels}
</svg>`;

fs.writeFileSync(path.join(ROOT, 'docs', 'assets', 'concurrency-chart.svg'), svg);
console.log('wrote docs/assets/concurrency-chart.svg');
