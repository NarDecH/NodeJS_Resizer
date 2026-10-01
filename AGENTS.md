# AGENTS.md — คู่มือสำหรับ AI agent ที่มาทำงานกับ repo นี้

ภาษาของโปรเจกต์: **โค้ด/CLI/log เป็นภาษาอังกฤษ, เอกสาร (md/html) เป็นภาษาไทยแบบทางการแต่อ่านง่าย**

## ภาพรวม

Node.js CLI สำหรับย่อรูปทั้งโฟลเดอร์เป็น JPG (ยาวสุดเริ่มต้น 3800px) ใช้ sharp 0.35+ (libvips)
ทุกการรันต้องเกิด log ไฟล์ครบทั้ง `.log` (คนอ่าน) และ `.jsonl` (เครื่องอ่าน) เสมอ

## โครงสร้าง

```
src/entry.mjs       process entry — ตั้ง UV_THREADPOOL_SIZE = คอร์ก่อน pool ถูกสร้าง แล้วค่อย import cli.js
                    (สำคัญมาก: libuv pool ถูกสร้างครั้งเดียวและอ่าน env ครั้งเดียว — อย่าย้ายไปไว้หลัง import sharp)
src/cli.js          entry point, แยกวิเคราะห์ args (commander), interactive mode เมื่อไม่ส่ง args
src/run.js          orchestrator: scan → pool → progress → summary → flush log
src/scanner.js      เดินโฟลเดอร์ กรองนามสกุลรูป ตัด output ทิ้งจากผลสแกนเสมอ
src/converter.js    pipeline ต่อรูป: metadata → rotate(EXIF) → resize(inside, withoutEnlargement) → jpeg
src/pool.js         worker pool แบบ fixed-size (ไม่ใช้ worker_threads — libvips มีเธรด C++ ของตัวเอง)
src/logger.js       dual-format logger (.log/.jsonl), เขียนทีเดียวตอน flush (ทน crash ระหว่างรัน)
src/interactive.js  prompts สำหรับดับเบิลคลิก resize.bat, ตัด quote จาก drag&drop
scripts/            make-samples (รูปทดสอบ), benchmark (parent+child — วัด concurrency),
                    gen-chart (กราฟ SVG จาก bench/results.json), test-run (e2e)
docs/               เอกสาร md + html + assets/svg — โฮสต์บน GitHub Pages (main branch, /docs)
```

## กฎที่ต้องไม่ผิด

1. **Output เริ่มต้นต้องเป็น `<input>-resized` (โฟลเดอร์ข้างเคียง) ไม่ใช่โฟลเดอร์ใน input** — กัน rescan ตัวเอง
2. **scanner ต้อง exclude output dir เสมอ** และ skip โฟลเดอร์ `_logs`
3. **เขียนไฟล์ผลลัพธ์แบบ atomic**: `.part` แล้ว rename — เพื่อให้ resume-safe และไม่มีไฟล์ครึ่ง ๆ กลาง ๆ
4. **skip existing output คือ default** (`--overwrite` เพื่อ force) — อย่าสลับ
5. **คงสีด้วย `.keepIccProfile()` เมื่อตัด EXIF**; `.rotate()` ต้องมาก่อน `.resize()` เสมอ
6. **Performance model (ห้ามทลายโดยไม่ benchmark ใหม่)** — sharp รัน pipeline บน libuv threadpool ของ Node
   ซึ่ง default มีแค่ 4 เธรด (คอขวดจริง): `src/entry.mjs` และ launchers ตั้ง `UV_THREADPOOL_SIZE` = จำนวนคอร์ให้ก่อนเสมอ;
   `sharp.concurrency(1)` เมื่อ workers > 1 (ปล่อย auto = หลาย pipeline แย่ง vips pool เดียวกัน, ช้ากว่าถึง −30%);
   `sharp.cache(0)`; ข้อมูลวัด: 262 MP/s, CPU 94% บน i9-9900K (docs/RESEARCH.md)
7. **รู้เสมอว่าไฟล์ใดเสีย = error ต่อไฟล์ ไม่ crash ทั้งรัน** exit code: 0 สำเร็จ, 2 มี error บางไฟล์, 1 ระบบล้ม
8. แก้พฤติกรรมใด ๆ แล้ว **ต้องรัน `npm test` ให้ผ่าน** และอัปเดต docs/CHANGELOG.md

## สิ่งแวดล้อม

- Windows + Git Bash; `node` อาจไม่อยู่ใน PATH — ใช้ `export PATH="/c/Program Files/nodejs:$PATH"` ก่อน
- Node >= 18.17, ESM (`"type": "module"`)
- วัดประสิทธิภาพ: `node scripts/benchmark.js 48` (spawn child ที่ตั้ง UVT ให้เหมือน runtime จริง — อย่าวัดใน-process เพราะ env จะไม่มีผล)
- ห้าม commit: `node_modules/`, `runtime/`, `bench/`, `test/samples/`, `*_resized*/`, `**/_logs/`, `__Photo/`
- `__Photo/` (ถ้ามี) คือภาพถ่ายส่วนตัวของเจ้าของ repo — อ่านอย่างเดียว ห้าม copy ขึ้น repo หรือใส่ไปใน release

## การทดสอบ

```bash
npm test              # e2e: สร้างรูป → รัน → assert มิติ/ชื่อไฟล์/log
node scripts/benchmark.js 48   # ใช้ __Photo; ถ้าไม่มีให้แก้ SRC_LIBRARY ไปชี้โฟลเดอร์รูปอื่น
```

เคสที่ต้องยังทำงานถูกหลังแก้โค้ดเสมอ: ไฟล์เสีย (corrupt), รูปที่เล็กกว่า limit, EXIF orientation,
โฟลเดอร์ย่อย, resume (รันซ้ำต้องได้ skipped ทั้งหมด), dry-run ไม่เขียนรูป

## การ release

1. bump `version` ใน package.json + เพิ่มข้อความใน docs/CHANGELOG.md
2. `npm test` ให้ผ่าน
3. build portable zip: โครงสร้าง = โค้ด + node_modules + `runtime/node.exe` (Windows x64) + resize.bat
4. commit + tag `vX.Y.Z` + push + `gh release create vX.Y.Z <assets>` (zip portable, zip source, SHA256SUMS.txt)
5. Pages เสิร์ฟจาก `main:/docs` — หน้า download (docs/index.html) ดึง release ล่าสุดจาก GitHub API อัตโนมัติ
