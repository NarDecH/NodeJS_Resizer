# Changelog

รูปแบบอ้างอิง [Keep a Changelog](https://keepachangelog.com/th-TH/1.1.0/) · เวอร์ชันตาม [SemVer](https://semver.org/lang/th/)

## [1.0.1] — 2026-10-01

### แก้ไข/เพิ่มประสิทธิภาพ (Fixed / Performance)
- **แก้คอขวดที่ซ่อนอยู่: libuv threadpool ของ Node (default 4 เธรด)** — sharp รัน pipeline บน pool นี้
  ทำให้แม้ตั้ง worker เยอะแค่ไหน ก็มี pipeline ทำงานพร้อมกันจริงแค่ 4 (CPU วิ่ง ~53%)
  แล้วตั้ง `UV_THREADPOOL_SIZE` = จำนวนคอร์ให้อัตโนมัติผ่าน `src/entry.mjs` และ launchers
- ผลจริงบน i9-9900K: throughput **185 → 262 MP/s (+42%)**, CPU **53% → 94%**, ชุด 240 รูป 21.5s → 14.8s
- ปิด vips operation cache (`sharp.cache(0)`) — งานผ่านครั้งเดียวไม่ได้ประโยชน์จาก cache
- เพิ่ม `--skip-smaller` — ข้ามรูปที่ด้านยาวสุด ≤ limit อยู่แล้วโดยไม่แปลง (ชุดรูปผสมเร็วขึ้นมาก)
- วิเคราะห์ฉบับเต็ม (3 ก้าว: พบความผิดปกติ → ทดสอบยืนยัน → benchmark ทางการ) ใน docs/RESEARCH.md

[1.0.1]: https://github.com/NarDecH/NodeJS_Resizer/releases/tag/v1.0.1

## [1.0.0] — 2026-10-01

### เพิ่มใหม่ (Added)
- CLI ย่อรูปทั้งโฟลเดอร์เป็น JPG: กำหนดความยาวด้านสูงสุดได้ (default 3800px), คุณภาพ JPEG, recursive, resume-safe
- แปลงข้ามฟอร์แมต: jpg/jpeg/jfif/png/webp/tiff/gif/svg/avif/heic/heif → `.jpg`
- Auto-rotate ตาม EXIF orientation + คง ICC colour profile (ตัด EXIF/GPS เพื่อความเป็นส่วนตัว, เปิด `--keep-metadata` เพื่อเก็บ)
- ระบบ log ครบต่อรัน: `.log` (คนอ่าน) + `.jsonl` (เครื่องอ่าน) + `summary.json` + `latest.*`
- โหมดใช้งาน: interactive (ดับเบิลคลิก `resize.bat` / `npm start`), CLI เต็มรูปแบบ, `--dry-run`
- Concurrency อัตโนมัติ: workers = จำนวนคอร์ + `sharp.concurrency(1)` — พิสูจน์ด้วย benchmark ว่าเร็วสุด (ดู RESEARCH)
- Atomic write (`.part` → rename): ขัดจังหวะกลางทางได้ ไม่มีไฟล์ครึ่งกลาง
- `--mozjpeg` สำหรับไฟล์เล็กลง ~30% (แลกเวลา), `--overwrite`, `--quiet`, `--log-level`, `--log-dir`, `--sharp-concurrency`
- เอกสารครบทั้ง md + HTML: README, USAGE, RESEARCH (พร้อมกราฟจากข้อมูลจริง), LOGGING, ARCHITECTURE, CHANGELOG
- GitHub Pages: หน้าดาวน์โหลดดึง release ล่าสุดจาก GitHub API อัตโนมัติ
- Release assets: แพ็กเกจพกพา Windows x64 (มี Node runtime + node_modules ในตัว) และซอร์สโค้ด zip

### ประสิทธิภาพ (บน i9-9900K, ภาพ 14.2 MP → 3800px, q82)
- ~185 MP/s (~11.5 รูป/วินาที) ที่ workers 4–8+; เร่งจากเธรดเดียว 3.7 เท่า
- ขนาดรวมลดลง 78% (233 MB → 51 MB) ในชุดทดสอบ 48 รูป

[1.0.0]: https://github.com/NarDecH/NodeJS_Resizer/releases/tag/v1.0.0
