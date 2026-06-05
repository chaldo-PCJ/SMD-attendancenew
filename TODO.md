# TODO

- [ ] วางแผนและยืนยันขอบเขตงาน: Daily Report export PDF และ Excel
- [x] เพิ่มปุ่ม Export Excel (.xlsx) ใน `src/app/dashboard/daily-report/page.tsx`
- [ ] Implement `exportExcel()`:

  - [ ] กรณี admin + selectedClassroom=ALL: export ตารางสรุปต่อห้อง
  - [ ] กรณีห้องเดียว: export ตารางรายนักเรียน (เลขที่/รหัส/ชื่อ-นามสกุล/สถานะ)
- [ ] ตั้งชื่อไฟล์ให้เหมาะสมด้วยวันที่ที่เลือก
- [ ] รัน lint/build และทดสอบการดาวน์โหลดไฟล์

