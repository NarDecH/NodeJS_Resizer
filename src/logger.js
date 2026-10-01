// logger.js — detailed dual-format file logging (.log human-readable + .jsonl machine-readable)
// Every run creates its own pair of files plus a summary.json for quick analysis.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function timestamp() {
  // local time, ISO-like with milliseconds, filesystem-safe
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return {
    file: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`,
    log: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`,
  };
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return 'n/a';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function pad(s, n) { return String(s).padEnd(n); }

export { fmtBytes };

export class Logger {
  /**
   * @param {string} logDir   directory where run logs are written
   * @param {string} level    debug | info | warn | error
   * @param {object} [meta]   static info copied into every run header
   */
  constructor(logDir, level = 'info', meta = {}) {
    this.logDir = logDir;
    this.level = LEVELS[level] ? level : 'info';
    this.meta = meta;
    this.errors = 0;
    this.warnings = 0;
    const ts = timestamp();
    this.runId = ts.file;
    this.baseName = `run-${this.runId}`;
    this.logPath = path.join(logDir, `${this.baseName}.log`);
    this.jsonlPath = path.join(logDir, `${this.baseName}.jsonl`);
    this.summaryPath = path.join(logDir, `${this.baseName}.summary.json`);
    this._human = [];
    this._jsonl = [];
    this._started = Date.now();
  }

  async init() {
    await fsp.mkdir(this.logDir, { recursive: true });
    const m = this.meta;
    this.header(
      'Image Resizer — run log',
      `Run ID      : ${this.runId}`,
      `Started     : ${timestamp().log}`,
      `Tool version: ${m.version ?? 'n/a'}`,
      `Node.js     : ${m.node ?? process.version}`,
      `Platform    : ${m.platform ?? `${process.platform} ${process.arch}`}`,
      `CPU cores   : ${m.cpus ?? 'n/a'}`,
    );
    this.jsonl('run_start', { runId: this.runId, ...this.meta });
  }

  /** push pre-formatted lines into the human log buffer */
  header(title, ...lines) {
    const bar = '═'.repeat(78);
    this._human.push(bar, `  ${title}`, bar, ...lines.map((l) => `  ${l}`), '');
  }

  hr(char = '─') {
    this._human.push(char.repeat(78));
  }

  _line(level, event, data) {
    const entry = { ts: new Date().toISOString(), level, event, ...data };
    this._jsonl.push(JSON.stringify(entry));
    return entry;
  }

  /** structured event → both files (jsonl verbatim, human via formatter) */
  jsonl(event, data = {}) {
    return this._line('info', event, data);
  }

  debug(event, data) {
    if (LEVELS[this.level] > LEVELS.debug) return;
    this._line('debug', event, data);
    this._human.push(`[t+${this._elapsed()}] DEBUG ${event} ${JSON.stringify(data)}`);
  }

  info(event, data) {
    this._line('info', event, data);
    this._human.push(`[t+${this._elapsed()}] INFO  ${event} ${JSON.stringify(data)}`);
  }

  warn(event, data) {
    this.warnings++;
    this._line('warn', event, data);
    this._human.push(`[t+${this._elapsed()}] WARN  ${event} ${JSON.stringify(data)}`);
  }

  error(event, data) {
    this.errors++;
    this._line('error', event, data);
    this._human.push(`[t+${this._elapsed()}] ERROR ${event} ${JSON.stringify(data)}`);
  }

  /** human-only note (not in jsonl) */
  note(text) {
    this._human.push(`[t+${this._elapsed()}] NOTE  ${text}`);
  }

  _elapsed() {
    return `${((Date.now() - this._started) / 1000).toFixed(3)}s`;
  }

  /** detailed per-file result row in the human log */
  fileResult(r) {
    this._human.push(
      `[t+${this._elapsed()}] ${pad(r.status.toUpperCase(), 5)} ${r.input}`
      + `\n          ${r.output ?? '-'}`
      + `\n          dims ${r.widthIn ?? '-'}x${r.heightIn ?? '-'} → ${r.widthOut ?? '-'}x${r.heightOut ?? '-'}`
      + ` | ${r.formatIn ?? '?'} → jpg`
      + ` | ${fmtBytes(r.bytesIn)} → ${fmtBytes(r.bytesOut)}`
      + ` | ${r.durationMs} ms`
      + (r.note ? ` | ${r.note}` : ''),
    );
    this._line('info', r.status === 'error' ? 'file_error' : `file_${r.status}`, r);
  }

  async flush(summary) {
    if (summary) {
      this.header('SUMMARY', ...Object.entries(summary.lines ?? {}).map(([k, v]) => `${pad(k, 12)}: ${v}`));
      this._line('info', 'run_end', { stats: summary.stats });
      try {
        await fsp.writeFile(this.summaryPath, JSON.stringify({ runId: this.runId, meta: this.meta, ...summary.stats }, null, 2));
      } catch { /* non-fatal */ }
    }
    this._human.push(`  Log files : ${this.logPath}\n              ${this.jsonlPath}`);
    try {
      await fsp.writeFile(this.logPath, this._human.join('\n') + '\n', 'utf8');
      await fsp.writeFile(this.jsonlPath, this._jsonl.join('\n') + '\n', 'utf8');
      // convenience copies for "grab the newest log" workflows
      await fsp.writeFile(path.join(this.logDir, 'latest.log'), this._human.join('\n') + '\n', 'utf8');
      await fsp.writeFile(path.join(this.logDir, 'latest.jsonl'), this._jsonl.join('\n') + '\n', 'utf8');
    } catch (e) {
      return { ok: false, error: e.message, logPath: null };
    }
    return { ok: true, logPath: this.logPath, jsonlPath: this.jsonlPath };
  }
}
