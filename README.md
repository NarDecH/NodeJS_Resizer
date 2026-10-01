<p align="center">
  <img src="docs/assets/banner.svg" alt="Image Resizer" width="720">
</p>

<h1 align="center">NodeJS Resizer</h1>

<p align="center">
  <strong>ปรับขนาดรูปภาพทั้งโฟลเดอร์เป็น JPG คุณภาพสวย ด้วยพลังของ sharp / libvips</strong><br>
  กำหนดความยาวด้านที่ยาวที่สุด (เริ่มต้น 3800px) — เร็วมาก มีไฟล์ log ละเอียด ใช้งานง่าย
</p>

<p align="center">
  <a href="https://github.com/NarDecH/NodeJS_Resizer/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/NarDecH/NodeJS_Resizer?style=flat-square&color=2a9d8f"></a>
  <a href="https://github.com/NarDecH/NodeJS_Resizer/actions"><img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/NarDecH/NodeJS_Resizer?style=flat-square"></a>
  <a href="https://nardech.github.io/NodeJS_Resizer/"><img alt="Docs" src="https://img.shields.io/badge/docs-GitHub%20Pages-8e44ad?style=flat-square"></a>
</p>

---

## ทำอะไรได้บ้าง

- **แปลงทุกรูปในโฟลเดอร์เป็น JPG อย่างเดียว** — PNG, WebP, TIFF, GIF, SVG, AVIF, HEIC ฯลฯ → `.jpg`
- **จำกัดขนาดด้านยาวสุด** เช่น 3800px (ปรับได้) — รูปที่เล็กกว่าจะถูก re-encode เป็น JPG โดยไม่ขยาย
- **หมุนภาพอัตโนมัติตาม EXIF** และคงสีถูกต้องด้วย ICC profile (ตัด EXIF/GPS ออกเพื่อความเป็นส่วนตัว หรือเลือก `--keep-metadata`)
- **เร็วสุด ๆ ด้วย concurrency อัตโนมัติ** — วิ่งเต็มกำลัง CPU ทุกคอร์ พร้อมจำกัดเธรดของ libvips ให้ไม่ทับกัน (อ่านผลวิจัยทั้งหมดได้ที่ [docs/RESEARCH.md](docs/RESEARCH.md))
- **ระบบ log ละเอียดทุกไฟล์** — `.log` สำหรับคนอ่าน + `.jsonl` สำหรับเครื่องวิเคราะห์ + `summary.json` ต่อรัน (รายละเอียดที่ [docs/LOGGING.md](docs/LOGGING.md))
- **ใช้ต่อจากที่ค้างได้ (resume-safe)** — รันใหม่แล้วข้ามไฟล์ที่เสร็จแล้ว, เขียนไฟล์แบบ atomic, ไฟล์เสียไม่ทำให้ทั้งชุดล้ม
- **ใช้ง่ายที่สุด** — ดับเบิลคลิก `resize.bat` แล้วลากโฟลเดอร์ใส่ จบ

## เริ่มใช้งานเร็ว ๆ

**วิธีที่ 1 — ดาวน์โหลดโปรแกรมสำเร็จรูป (แนะนำ, Windows):**
ไปที่ [หน้าดาวน์โหลด](https://nardech.github.io/NodeJS_Resizer/) → โหลด `…win-x64-portable.zip` → แตก zip → ดับเบิลคลิก `resize.bat` (ไม่ต้องติดตั้งอะไรเพิ่ม)

**วิธีที่ 2 — ผ่าน npm:**

```bash
git clone https://github.com/NarDecH/NodeJS_Resizer.git
cd NodeJS_Resizer
npm install
npm start -- -i "D:\Photos"           # → ได้ D:\Photos-resized ขนาดยาวสุด 3800px
```

**วิธีที่ 3 — สั่งเองเต็มรูปแบบ:**

```bash
node src/cli.js -i "D:\Photos" -o "D:\Web" -s 3800 -q 82 -w auto
```

ตัวอย่างผลลัพธ์:

```
Summary
  Files      4904 (4904 converted, 0 skipped, 0 errors)
  WallTime   231.42 s
  Throughput 21.20 img/s | 301.4 MP/s
  Size       25.1 GB → 4.8 GB (-20.3 GB, 80.9%)
```

## ตัวเลือกทั้งหมด

| ตัวเลือก | ค่าเริ่มต้น | ความหมาย |
| --- | --- | --- |
| `-i, --input <dir>` | (ถาม) | โฟลเดอร์รูปต้นทาง หรือไฟล์เดียว |
| `-o, --output <dir>` | `<input>-resized` | โฟลเดอร์ปลายทาง (อยู่ข้างนอก ไม่ข้างใน input) |
| `-s, --max-size <px>` | `3800` | ความยาวด้านที่ยาวที่สุดที่ยอมให้มีได้ |
| `-q, --quality <n>` | `82` | คุณภาพ JPEG 1–100 |
| `-w, --workers <n>` | `auto` | จำนวนรูปที่ประมวลผลพร้อมกัน |
| `--no-recursive` | recursive | ไม่ลงไปในโฟลเดอร์ย่อย |
| `--overwrite` | ปิด | แปลงซ้ำทุกไฟล์ (ปกติข้ามไฟล์ที่มีผลลัพธ์แล้ว = resume) |
| `--keep-metadata` | ปิด | เก็บ EXIF/GPS ไว้ (ปกติตัดทิ้ง แต่คง ICC) |
| `--mozjpeg` | ปิด | เข้ารหัสแบบ mozjpeg — ไฟล์เล็กลง ~30% แต่ช้าลง 2–3 เท่า |
| `--dry-run` | ปิด | วางแผนอย่างเดียว ไม่เขียนไฟล์ |
| `--log-level <lvl>` | `info` | `debug` `info` `warn` `error` |
| `--log-dir <dir>` | `<output>/_logs` | ที่เก็บไฟล์ log ต่อรัน |
| `--quiet` | ปิด | ไม่แสดง progress bar |

เอกสารฉบับเต็ม: [docs/USAGE.md](docs/USAGE.md)

## ไฟล์ log

ทุกครั้งที่รันจะได้ 3 ไฟล์ใน `<output>/_logs/`:

```
run-20261001-135627.log          ← มนุษย์อ่าน: ทุกไฟล์ ขนาด ก่อน→หลัง มิติ ระยะเวลา
run-20261001-135627.jsonl        ← เครื่องอ่าน: 1 event ต่อบรรทัด เอาไปเข้า Excel/Python ได้
run-20261001-135627.summary.json ← สรุปรวมของรันนั้น
+ latest.log / latest.jsonl      ← สำเนาของรันล่าสุดเสมอ
```

วิธีวิเคราะห์และดีบัก: [docs/LOGGING.md](docs/LOGGING.md)

## ประสิทธิภาพ

ทดสอบบนภาพถ่ายจริง 14.2 MP (4608×3072) ลดเหลือยาวสุด 3800px บน Intel Core i9-9900K:

- ทำได้ **~260 MP/s** (~16 รูป/วินาที — โฟลเดอร์ 4,904 รูป 25 GB เสร็จใน ~4.5 นาที) โดย **CPU วิ่ง 94%** เต็มเครื่อง
- เร่งจาก 1 เธรด (51 MP/s) ได้ **5.1 เท่า**; อิ่มตัวที่ workers ≈ 8–16
- ข้อค้นพบสำคัญ: sharp รูปหนึ่ง pipeline บน **libuv threadpool ของ Node (default แค่ 4 เธรด)** —
  ตั้ง `UV_THREADPOOL_SIZE` ให้เท่าจำนวนคอร์ (เครื่องมือทำให้เองแล้ว) รวมกับ pin libvips = 1 เธรด
  ให้ throughput +42% และ CPU จาก 53% → 94% (ข้อมูลและกราฟจริงทั้งหมดใน [docs/RESEARCH.md](docs/RESEARCH.md))

## เอกสารทั้งหมด

| เอกสาร | Markdown | HTML (สวย) |
| --- | --- | --- |
| วิธีใช้ | [docs/USAGE.md](docs/USAGE.md) | [docs/usage.html](https://nardech.github.io/NodeJS_Resizer/usage.html) |
| งานวิจัย/benchmark | [docs/RESEARCH.md](docs/RESEARCH.md) | [docs/research.html](https://nardech.github.io/NodeJS_Resizer/research.html) |
| ระบบ log | [docs/LOGGING.md](docs/LOGGING.md) | [docs/logging.html](https://nardech.github.io/NodeJS_Resizer/logging.html) |
| สถาปัตยกรรม | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | [docs/architecture.html](https://nardech.github.io/NodeJS_Resizer/architecture.html) |
| บันทึกเวอร์ชัน | [docs/CHANGELOG.md](docs/CHANGELOG.md) | [docs/changelog.html](https://nardech.github.io/NodeJS_Resizer/changelog.html) |
| หน้าแรก + ดาวน์โหลด | — | [docs/index.html](https://nardech.github.io/NodeJS_Resizer/) |

## สำหรับผู้พัฒนา

```bash
npm test          # สร้างชุดรูปทดสอบ + รัน resizer + ตรวจผลลัพธ์อัตโนมัติ
npm run samples   # สร้างรูปทดสอบหลาย format ใน test/samples
npm run benchmark # วัด throughput หลายค่า concurrency (ใช้โฟลเดอร์ __Photo ถ้ามี)
```

สัญญาณที่ agent/AI ควรรู้ก่อนแก้โค้ด อยู่ใน [AGENTS.md](AGENTS.md)

## License

[MIT](LICENSE)
