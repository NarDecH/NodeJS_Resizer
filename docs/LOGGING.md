# ระบบ LOG — โครงสร้าง, ความหมาย, และวิธีใช้วิเคราะห์/ดีบัก

เวอร์ชัน HTML: [logging.html](https://nardech.github.io/NodeJS_Resizer/logging.html)

ทุกการรันสร้างไฟล์ใน `<output>/_logs/` (เปลี่ยนที่ได้ด้วย `--log-dir`):

| ไฟล์ | ผู้อ่าน | เนื้อหา |
| --- | --- | --- |
| `run-YYYYMMDD-HHMMSS.log` | คน | หัวรัน (เวอร์ชัน/เครื่อง/ค่าที่ตั้ง) + ผลต่อไฟล์แบบละเอียด + top-5 + สรุป |
| `run-YYYYMMDD-HHMMSS.jsonl` | เครื่อง | 1 event ต่อบรรทัด (JSON Lines) — เอาเข้า Excel/Python/jq ได้ทันที |
| `run-….summary.json` | คน+เครื่อง | สรุปตัวเลขทั้งรัน (นับไฟล์, throughput, ขนาด, slowest, saving สูงสุด) |
| `latest.log` / `latest.jsonl` | คน | สำเนาของรันล่าสุดเสมอ — ไม่ต้องไล่หาชื่อไฟล์ |

## ตัวอย่างไฟล์ `.log` (ตัดมา)

```
══════════════════════════════════════════════════════════════════════════════
  Image Resizer — run log
══════════════════════════════════════════════════════════════════════════════
  Run ID      : 20261001-135627
  Tool version: 1.0.0
  Node.js     : v24.21.0
  Platform    : win32 x64
  CPU cores   : 16

[t+0.237s] CONVERTED C:\Photos\DSC_0123.jpg
          C:\Photos\3800\DSC_0123.jpg
          dims 6000x4000 → 3800x2533 | jpeg → jpg | 8.2 MB → 2.1 MB | 231 ms
[t+0.419s] ERROR C:\Photos\corrupt.jpg
          dims -x- → -x- | ? → jpg | n/a → n/a | unreadable/corrupt (Input file has corrupt header)
──────────────────────────────────────────────────────────────────────────────
  Files       : 11 (10 converted, 0 skipped, 1 errors)
  Throughput  : 23.81 img/s | 261.1 MP/s
  Size        : 1.08 MB → 486.8 KB (-618.5 KB, 56.0%)
```

ทุกบรรทัดผลต่อไฟล์มีครบ: เวลาที่ผ่านมา (t+), สถานะ, พาธ input/output,
มิติก่อน→หลัง (คิด EXIF rotation แล้ว), ฟอร์แมตต้นทาง, ขนาดก่อน→หลัง, ระยะเวลา, หมายเหตุ

## ชนิด event ในไฟล์ `.jsonl`

| event | ความหมาย | ฟิลด์สำคัญ |
| --- | --- | --- |
| `run_start` | เริ่มรัน + ค่า config ทั้งหมด | `version, input, output, maxSize, quality, workers, recursive, overwrite, dryRun, cpus` |
| `file_converted` | แปลงสำเร็จ | `input, output, widthIn/heightIn, widthOut/heightOut, formatIn, bytesIn, bytesOut, durationMs, note` |
| `file_skipped` | ข้าม (มีผลลัพธ์อยู่แล้ว = resume) | `input, output, bytesOut, note` |
| `file_error` | ไฟล์เสีย/อ่านไม่ได้ | `input, note` (ข้อความ error เต็ม) |
| `sharp_warning` | libvips เตือน (ไฟล์เสียเล็กน้อยแต่อ่านได้) | `input, message` |
| `scan_excluded_output_dir` | ตัดโฟลเดอร์ output ออกจากการสแกนแล้ว | `dir` |
| `scan_done` | สแกนจบ | `files, entriesSeen` |
| `run_end` | สรุปท้ายรัน | ตัวเลข summary ทั้งหมด |

ระดับ log (`--log-level`): `debug` < `info` < `warn` < `error` — default `info`
(ระดับ `debug` จะเริ่มบันทึกเหตุการณ์ภายในเพิ่ม เอาไว้ไล่พฤติกรรมเฉพาะจุด)

## วิธีวิเคราะห์ที่ใช้บ่อย

```bash
# ไฟล์ไหน error บ้าง
grep file_error <output>/_logs/latest.jsonl

# 10 ไฟล์ที่ใช้เวลานานสุด (ใช้ jq)
jq -c 'select(.event=="file_converted") | {input, ms:.durationMs}' <output>/_logs/latest.jsonl | sort -t: -k2 -rn | head

# กราฟ histogram ขนาดไฟล์ผลลัพธ์ (Python)
python - <<'EOF'
import json
rows=[json.loads(l) for l in open(r'logs/latest.jsonl',encoding='utf8')]
kb=[r['bytesOut']/1024 for r in rows if r.get('event')=='file_converted']
print(f'n={len(kb)} min={min(kb):.0f}KB median={sorted(kb)[len(kb)//2]:.0f}KB max={max(kb):.0f}KB')
EOF
```

เคล็ด: รันหลายรอบเปรียบเทียบ tuning ได้เพราะทุกไฟล์ log มี Run ID + config กำกับเสมอ

## ปรัชญาของระบบ log

- **เขียนครั้งเดียวตอน flush** — งานหลักไม่เสียเวลา I/O กับ log; ถ้าโปรแกรมถูกฆ่ากลางทาง ไฟล์ log ของรันนั้นจะไม่ถูกเขียน (ยอมแลกเพื่อความเร็ว — ผลลัพธ์รูปยังครบเพราะเขียนแบบ atomic ต่อรูป)
- **สองรูปแบบคู่กันเสมอ** — `.log` ตอบ "เกิดอะไรขึ้น" ให้คน, `.jsonl` ตอบ "รูปแบบไหน ตัวเลขไหน" ให้เครื่อง
- **config ฝังใน log ทุกรัน** — ไม่มีทางลืมว่ารันนั้นใช้ค่าอะไร
- **`summary.json` แยกไฟล์** — เปิดดูเร็วโดยไม่ต้อง parse log ยาว ๆ
