"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { CLASSROOMS, classroomOptions } from "@/lib/classrooms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Calendar as CalendarIcon, ExternalLink, RefreshCw, AlertCircle, ClipboardCheck } from "lucide-react";

interface AttendanceState {
  studentId: string;
  studentName: string;
  number: number;
  status: "มา" | "สาย" | "ลา" | "ขาด" | null;
}

export default function AttendancePage() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const myClassroom = session.classroomLock || "2/1";

  const [selectedClassroom, setSelectedClassroom] = useState<string>(myClassroom);

  // Default date is local today
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDate());

  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<AttendanceState[]>([]);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>("");
  const [checkedStudentIds, setCheckedStudentIds] = useState<Set<string>>(new Set());
  const isTeacher = session.role === "teacher";
  const activeClassroom = selectedClassroom;

  const todayDate = useMemo(() => getTodayDate(), []);



  // Keep attendance aligned with the actual current day so each new day starts from a blank slate.
  useEffect(() => {
    // Update selectedDate only when day changes (minimize setInterval wakes)

    const updateIfNeeded = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const next = `${year}-${month}-${day}`;
      setSelectedDate((prev) => (prev === next ? prev : next));
    };

    updateIfNeeded();

    const t = window.setInterval(updateIfNeeded, 5 * 60_000); // every 5 minutes
    return () => window.clearInterval(t);
  }, []);


  // Load students and attendance records
  const loadData = useCallback(async () => {
    if (!activeClassroom || !selectedDate) return;
    setLoading(true);
    setStudents([]);
    setCheckedStudentIds(new Set());
    try {
      const [studentRes, attendanceRes] = await Promise.all([
        api.getStudents(activeClassroom),
        api.getAttendance(activeClassroom, selectedDate),
      ]);

      if (!studentRes.success) {
        throw new Error("ไม่สามารถโหลดรายชื่อนักเรียนได้");
      }

      const classroomStudents = studentRes.students;
      if (classroomStudents.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const records = attendanceRes.success ? attendanceRes.attendance : [];

      // Map students to their existing status using O(1) lookup
      const recordByStudentId = new Map<string, (typeof records)[number]>();
      for (const r of records) {
        recordByStudentId.set(String(r.studentId), r);
      }

      const mappedStudents: AttendanceState[] = classroomStudents
        .map((s) => {
          const record = recordByStudentId.get(String(s.studentId));
          return {
            studentId: s.studentId,
            studentName: s.name,
            number: s.number || 99,
            status: (record?.status as AttendanceState["status"]) || null,
          };
        })
        .sort((a, b) => a.number - b.number);

      setStudents(mappedStudents);
      setCheckedStudentIds(new Set(records.map((r) => String(r.studentId))));

    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
    } finally {
      setLoading(false);
    }
  }, [activeClassroom, selectedDate, showToast]);

  // Fetch spreadsheet URL from localStorage or configuration
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = localStorage.getItem("google_spreadsheet_url") || "";
      setSpreadsheetUrl(url);
    }
    loadData();
  }, [selectedClassroom, selectedDate, loadData]);

  // Empty out the useEffect that was here for tab switching

  // Update status for a specific student
  const handleStatusChange = (studentId: string, status: "มา" | "สาย" | "ลา" | "ขาด") => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
    setCheckedStudentIds((prev) => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
  };

  const {
    checkedCount,
    allStudentsChecked,
    presentCount,
    lateCount,
    leaveCount,
    absentCount,
  } = useMemo(() => {
    const checked = students.reduce(
      (acc, s) => {
        if (s.status !== null) acc.checkedCount++;
        if (s.status === "มา") acc.presentCount++;
        else if (s.status === "สาย") acc.lateCount++;
        else if (s.status === "ลา") acc.leaveCount++;
        else if (s.status === "ขาด") acc.absentCount++;
        return acc;
      },
      {
        checkedCount: 0,
        presentCount: 0,
        lateCount: 0,
        leaveCount: 0,
        absentCount: 0,
      }
    );

    return {
      ...checked,
      allStudentsChecked: students.length > 0 && checked.checkedCount === students.length,
    };
  }, [students]);

  const isToday = selectedDate === todayDate;
  const editable = true;

  // Save attendance
  const handleSave = async () => {

    if (students.length === 0) {
      showToast("ไม่มีข้อมูลนักเรียนสำหรับบันทึก", "warning");
      return;
    }

    if (!allStudentsChecked) {
      showToast("กรุณาเช็กสถานะนักเรียนให้ครบทุกคนก่อนบันทึก", "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = students.map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        status: s.status as "มา" | "สาย" | "ลา" | "ขาด",
      }));

      const res = await api.saveAttendance(selectedClassroom, selectedDate, payload);
      if (res.success) {
        showToast(`บันทึกข้อมูลการเช็คชื่อของห้อง ${selectedClassroom} ประจำวันที่ ${selectedDate} สำเร็จ!`, "success", 0, "modal");
        // Reload to get fresh timestamp
        loadData();
      } else {
        throw new Error("การบันทึกล้มเหลว");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-orange-950 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-orange-600" /> เช็คชื่อนักเรียน
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            โรงเรียนสาธิตมหาวิทยาลัยขอนแก่น ฝ่ายมัธยมศึกษา มอดินแดง
          </p>
        </div>

        {spreadsheetUrl && (
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-orange-700 bg-orange-100/50 border border-orange-200 hover:bg-orange-100 font-bold px-3 py-2 rounded-xl w-fit transition-colors shadow-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" /> ลิงก์ Google Sheets
          </a>
        )}
      </div>

      {/* Control Card */}
      <Card className="border-orange-100 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-5 flex flex-col gap-4">
          {/* Removed teacher tab buttons */}

          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="w-full md:w-48">
              <Select
                label="ชั้นเรียน / ห้องเรียน"
                labelClassName="text-base font-semibold text-gray-700"
                className="text-base"
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
                options={classroomOptions(false)}
              />
            </div>

            <div className="w-full md:w-56 space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 block">
                วันที่บันทึกการเช็คชื่อ
              </label>

              <input
                type="date"
                value={selectedDate}
                max={todayDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="
      h-11
      w-full
      rounded-full
      border
      border-orange-200
      bg-white
      px-4
      text-base
      text-gray-700
      focus:outline-none
      focus:ring-2
      focus:ring-orange-300
      focus:border-orange-400
    "
              />
            </div>
            <div className="w-full md:w-auto flex gap-2">
              {selectedDate !== todayDate && (
                <Button
                  variant="outline"
                  onClick={() => setSelectedDate(todayDate)}
                  disabled={loading}
                  className="px-4 h-11 w-full md:w-auto border-orange-200 rounded-full font-bold text-base"
                >
                  <CalendarIcon className="h-4 w-4" /> วันนี้
                </Button>
              )}
              <Button
                variant="outline"
                onClick={loadData}
                disabled={loading}
                className="px-4 h-11 w-full md:w-auto border-orange-200 rounded-full font-bold text-base"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> รีเฟรช
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Sheet */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-orange-100 shadow-sm p-6 sm:p-8 space-y-5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
            <div className="h-4 w-48 rounded-full bg-orange-100" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="h-20 rounded-2xl bg-orange-50 border border-orange-100" />
            <div className="h-20 rounded-2xl bg-orange-50 border border-orange-100" />
            <div className="h-20 rounded-2xl bg-orange-50 border border-orange-100" />
            <div className="h-20 rounded-2xl bg-orange-50 border border-orange-100" />
          </div>
          <div className="space-y-2.5">
            <div className="h-11 rounded-2xl bg-orange-50 border border-orange-100" />
            <div className="h-11 rounded-2xl bg-orange-50 border border-orange-100" />
            <div className="h-11 rounded-2xl bg-orange-50 border border-orange-100" />
          </div>
          <span className="block text-gray-500 text-sm font-semibold">กำลังดึงข้อมูลการเข้าเรียน...</span>
        </div>
      ) : students.length === 0 ? (
        <Card className="border-orange-200 bg-orange-50/20">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <AlertCircle className="h-10 w-10 text-orange-500" />
            <div>
              <h3 className="font-bold text-orange-950 text-base">ไม่พบข้อมูลนักเรียนของห้อง {selectedClassroom}</h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                กรุณาให้ผู้ดูแลระบบอัปโหลดรายชื่อนักเรียนผ่านทาง <strong className="text-orange-900">แผงจัดการระบบ (จัดการระบบ)</strong> ก่อนทำการเช็คชื่อ
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">

          {/* Student Grid (Responsive: Cards on Mobile, Table on Desktop) */}

          {/* Mobile view: Student cards */}
          <div className="md:hidden space-y-3">
            {students.map((student) => (
              <div
                key={student.studentId}
                className="bg-white p-4 rounded-3xl border border-orange-100 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center h-9 w-9 bg-orange-100 text-orange-800 rounded-full font-bold text-lg">
                      {student.number}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-800 text-base">{student.studentName}</h4>
                      <span className="text-xs font-mono text-gray-400 font-semibold">{student.studentId}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {/* มา */}
                  <button
                    onClick={() => handleStatusChange(student.studentId, "มา")}
                    disabled={!editable}
                    className={`h-11 rounded-full font-bold text-sm border transform-gpu transition-all duration-200 ease-out active:scale-[0.95] motion-safe:hover:-translate-y-0.5 ${student.status === "มา"
                      ? "bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-100 ring-2 ring-emerald-200/80"
                      : "bg-white border-emerald-100 text-emerald-700 hover:bg-emerald-50"
                      } ${!editable ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    มา
                  </button>

                  {/* สาย */}
                  <button
                    onClick={() => handleStatusChange(student.studentId, "สาย")}
                    disabled={!editable}
                    className={`h-11 rounded-full font-bold text-sm border transform-gpu transition-all duration-200 ease-out active:scale-[0.95] motion-safe:hover:-translate-y-0.5 ${student.status === "สาย"
                      ? "bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-100 ring-2 ring-amber-200/80"
                      : "bg-white border-amber-100 text-amber-700 hover:bg-amber-50"
                      } ${!editable ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    สาย
                  </button>

                  {/* ลา */}
                  <button
                    onClick={() => handleStatusChange(student.studentId, "ลา")}
                    disabled={!editable}
                    className={`h-11 rounded-full font-bold text-sm border transform-gpu transition-all duration-200 ease-out active:scale-[0.95] motion-safe:hover:-translate-y-0.5 ${student.status === "ลา"
                      ? "bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-100 ring-2 ring-blue-200/80"
                      : "bg-white border-blue-100 text-blue-700 hover:bg-blue-50"
                      } ${!editable ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    ลา
                  </button>

                  {/* ขาด */}
                  <button
                    onClick={() => handleStatusChange(student.studentId, "ขาด")}
                    disabled={!editable}
                    className={`h-11 rounded-full font-bold text-sm border transform-gpu transition-all duration-200 ease-out active:scale-[0.95] motion-safe:hover:-translate-y-0.5 ${student.status === "ขาด"
                      ? "bg-red-500 border-red-600 text-white shadow-lg shadow-red-100 ring-2 ring-red-200/80"
                      : "bg-white border-red-100 text-red-700 hover:bg-red-50"
                      } ${!editable ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    ขาด
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view: Standard Table */}
          <div className="hidden md:block">
            <Card className="border-orange-100 shadow-sm overflow-hidden rounded-3xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center text-sm">เลขที่</TableHead>
                    <TableHead className="w-28 text-sm">รหัสนักเรียน</TableHead>
                    <TableHead className="text-sm">ชื่อ-นามสกุล</TableHead>
                    <TableHead className="text-center w-72 text-sm">สถานะการเข้าเรียน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.studentId} className="hover:bg-orange-50/10">
                      <TableCell className="text-center font-bold text-gray-500 text-sm">
                        {student.number}
                      </TableCell>
                      <TableCell className="font-mono text-gray-600 font-semibold text-sm">
                        {student.studentId}
                      </TableCell>
                      <TableCell className="font-semibold text-gray-800 text-base">
                        {student.studentName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">

                          {/* มา */}
                          <button
                            onClick={() => handleStatusChange(student.studentId, "มา")}
                            disabled={!editable}
                            className={`flex-1 h-9 rounded-full font-bold text-sm border transform-gpu transition-all duration-200 ease-out active:scale-[0.97] motion-safe:hover:-translate-y-0.5 ${student.status === "มา"
                              ? "bg-emerald-500 border-emerald-600 text-white shadow-md ring-2 ring-emerald-200/80"
                              : "bg-white border-emerald-100 text-emerald-700 hover:bg-emerald-50"
                              } ${!editable ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            มา
                          </button>

                          {/* สาย */}
                          <button
                            onClick={() => handleStatusChange(student.studentId, "สาย")}
                            disabled={!editable}
                            className={`flex-1 h-9 rounded-full font-bold text-sm border transform-gpu transition-all duration-200 ease-out active:scale-[0.97] motion-safe:hover:-translate-y-0.5 ${student.status === "สาย"
                              ? "bg-amber-500 border-amber-600 text-white shadow-md ring-2 ring-amber-200/80"
                              : "bg-white border-amber-100 text-amber-700 hover:bg-amber-50"
                              } ${!editable ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            สาย
                          </button>

                          {/* ลา */}
                          <button
                            onClick={() => handleStatusChange(student.studentId, "ลา")}
                            disabled={!editable}
                            className={`flex-1 h-9 rounded-full font-bold text-sm border transform-gpu transition-all duration-200 ease-out active:scale-[0.97] motion-safe:hover:-translate-y-0.5 ${student.status === "ลา"
                              ? "bg-blue-500 border-blue-600 text-white shadow-md ring-2 ring-blue-200/80"
                              : "bg-white border-blue-100 text-blue-700 hover:bg-blue-50"
                              } ${!editable ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            ลา
                          </button>

                          {/* ขาด */}
                          <button
                            onClick={() => handleStatusChange(student.studentId, "ขาด")}
                            disabled={!editable}
                            className={`flex-1 h-9 rounded-full font-bold text-sm border transform-gpu transition-all duration-200 ease-out active:scale-[0.97] motion-safe:hover:-translate-y-0.5 ${student.status === "ขาด"
                              ? "bg-red-500 border-red-600 text-white shadow-md ring-2 ring-red-200/80"
                              : "bg-white border-red-100 text-red-700 hover:bg-red-50"
                              } ${!editable ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            ขาด
                          </button>

                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Summary Buttons (Display only) */}
          {/* Summary Buttons */}
          <div className="bg-white p-3 rounded-2xl border border-orange-100 shadow-sm">
            <div className="flex items-center gap-2">

              {/* Total */}
              <div className="flex-1 min-w-0 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-700">
                {checkedCount}/{students.length}
              </div>

              {/* Present */}
              <div className="flex-1 min-w-0 h-10 rounded-full border border-emerald-200 bg-emerald-50 flex items-center justify-center text-sm font-bold text-emerald-700">
                {presentCount}
              </div>

              {/* Late */}
              <div className="flex-1 min-w-0 h-10 rounded-full border border-amber-200 bg-amber-50 flex items-center justify-center text-sm font-bold text-amber-700">
                {lateCount}
              </div>

              {/* Leave */}
              <div className="flex-1 min-w-0 h-10 rounded-full border border-blue-200 bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-700">
                {leaveCount}
              </div>

              {/* Absent */}
              <div className="flex-1 min-w-0 h-10 rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-sm font-bold text-red-700">
                {absentCount}
              </div>


            </div>
          </div>

          {/* Save Bar */}
          <div className="flex justify-end gap-2 bg-white p-4 rounded-3xl border border-orange-100 shadow-sm">
            <Button
              onClick={handleSave}
              disabled={loading || students.length === 0 || !allStudentsChecked}
              className="h-11 px-8 text-base font-bold rounded-full shadow-md shadow-orange-100"
              loading={loading}
            >
              <Save className="h-4.5 w-4.5" /> บันทึกการเข้าเรียน
            </Button>
          </div>

        </div>
      )}

    </div>
  );
}
