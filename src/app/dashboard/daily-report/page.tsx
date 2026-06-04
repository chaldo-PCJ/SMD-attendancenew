"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, AttendanceRecord, Student } from "@/lib/api";
import { CLASSROOMS, ALL_CLASSROOMS_VALUE, classroomOptions, classroomLabel } from "@/lib/classrooms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  BarChart3,
  Printer,
  Download,
  UserX,
  Clock3,
  CheckCheck,
  CalendarDays,
} from "lucide-react";

interface ClassroomSummary {
  classroom: string;
  totalChecked: number;
  present: number;
  late: number;
  leave: number;
  absent: number;
  percentage: number;
  hasRecord: boolean;
}

interface StudentStatusGroup {
  present: Student[];
  late: Student[];
  leave: Student[];
  absent: Student[];
}

export default function DailyReportPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [selectedClassroom, setSelectedClassroom] = useState<string>(
    session.role === "admin" ? ALL_CLASSROOMS_VALUE : session.classroomLock || "2/1"
  );
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<ClassroomSummary[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const isAdmin = session.role === "admin";
  const classroomScope = isAdmin
    ? selectedClassroom
    : session.classroomLock || "2/1";
  const reportClassroom = isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE
    ? "all"
    : classroomScope;
  const visibleClassrooms = useMemo(() => {
    if (isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE) {
      return CLASSROOMS;
    }
    return [classroomScope];
  }, [classroomScope, isAdmin, selectedClassroom]);

  useEffect(() => {
    if (!isAdmin && session.classroomLock) {
      setSelectedClassroom(session.classroomLock);
    }
    if (isAdmin) {
      setSelectedClassroom((current) => current || ALL_CLASSROOMS_VALUE);
    }
  }, [isAdmin, session.classroomLock]);

  const loadReport = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const [attendanceRes, studentRes] = await Promise.all([
        api.getAttendance(
          isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE ? undefined : classroomScope,
          selectedDate
        ),
        isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE
          ? Promise.resolve({ success: true, students: [] as Student[] })
          : api.getStudents(classroomScope),
      ]);

      if (!attendanceRes.success) {
        throw new Error("ไม่สามารถโหลดข้อมูลรายงานได้");
      }

      setAttendance(attendanceRes.attendance || []);
      setStudents(studentRes.success ? studentRes.students || [] : []);

      const allRecords = attendanceRes.attendance || [];
      const summariesList: ClassroomSummary[] = visibleClassrooms.map((cls) => {
        const clsRecords = allRecords.filter((r) => r.classroom === cls);
        const hasRecord = clsRecords.length > 0;

        if (!hasRecord) {
          return {
            classroom: cls,
            totalChecked: 0,
            present: 0,
            late: 0,
            leave: 0,
            absent: 0,
            percentage: 0,
            hasRecord: false,
          };
        }

        const present = clsRecords.filter((r) => r.status === "มา").length;
        const late = clsRecords.filter((r) => r.status === "สาย").length;
        const leave = clsRecords.filter((r) => r.status === "ลา").length;
        const absent = clsRecords.filter((r) => r.status === "ขาด").length;
        const total = clsRecords.length;
        const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        return {
          classroom: cls,
          totalChecked: total,
          present,
          late,
          leave,
          absent,
          percentage,
          hasRecord: true,
        };
      });

      setSummaries(summariesList);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการดึงรายงาน", "error");
    } finally {
      setLoading(false);
    }
  }, [classroomScope, isAdmin, selectedClassroom, selectedDate, showToast, visibleClassrooms]);

  useEffect(() => {
    loadReport();
  }, [selectedDate, loadReport]);

  const currentSummary = useMemo(() => {
    if (isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE) {
      return {
        total: attendance.length,
        present: attendance.filter((r) => r.status === "มา").length,
        late: attendance.filter((r) => r.status === "สาย").length,
        leave: attendance.filter((r) => r.status === "ลา").length,
        absent: attendance.filter((r) => r.status === "ขาด").length,
      };
    }

    const currentRecords = attendance.filter((r) => r.classroom === classroomScope);
    return {
      total: currentRecords.length,
      present: currentRecords.filter((r) => r.status === "มา").length,
      late: currentRecords.filter((r) => r.status === "สาย").length,
      leave: currentRecords.filter((r) => r.status === "ลา").length,
      absent: currentRecords.filter((r) => r.status === "ขาด").length,
    };
  }, [attendance, classroomScope, isAdmin, selectedClassroom]);

  const selectedClassroomSummary = useMemo(() => {
    if (isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE) return null;
    return summaries.find((item) => item.classroom === classroomScope) || null;
  }, [classroomScope, isAdmin, selectedClassroom, summaries]);

  const studentStatusGroups = useMemo<StudentStatusGroup>(() => {
    const groups: StudentStatusGroup = { present: [], late: [], leave: [], absent: [] };
    if (isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE) {
      return groups;
    }

    const studentMap = new Map<string, Student>();
    students.forEach((student) => {
      studentMap.set(String(student.studentId).trim(), student);
    });

    attendance
      .filter((record) => record.classroom === classroomScope)
      .forEach((record) => {
        const student = studentMap.get(String(record.studentId).trim()) || {
          studentId: record.studentId,
          name: record.studentName,
          number: 0,
        };

        if (record.status === "มา") groups.present.push(student);
        if (record.status === "สาย") groups.late.push(student);
        if (record.status === "ลา") groups.leave.push(student);
        if (record.status === "ขาด") groups.absent.push(student);
      });

    const sortByNumber = (a: Student, b: Student) => (a.number || 0) - (b.number || 0);
    groups.present.sort(sortByNumber);
    groups.late.sort(sortByNumber);
    groups.leave.sort(sortByNumber);
    groups.absent.sort(sortByNumber);
    return groups;
  }, [attendance, classroomScope, isAdmin, selectedClassroom, students]);

  const printReport = () => window.print();

  const exportPdf = () => {
    window.print();
    showToast("เลือกบันทึกเป็น PDF จากหน้าต่างพิมพ์ของเบราว์เซอร์ได้เลย", "info", 3000);
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-orange-950 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-orange-600" /> รายงานสรุปประจำวัน
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            {isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE
              ? "สรุปภาพรวมรายวันของทุกห้อง"
              : `สรุปผลรายวันสำหรับ ${classroomLabel(classroomScope)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={printReport} className="border-orange-200">
            <Printer className="h-4 w-4" /> พิมพ์ / Export PDF
          </Button>
          <Button variant="outline" onClick={loadReport} disabled={loading} className="border-orange-200">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> รีเฟรชข้อมูล
          </Button>
        </div>
      </div>

      <Card className="print:hidden border-orange-100 shadow-sm">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="w-full sm:w-56 space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 block">
                เลือกวันที่ดูรายงาน
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {isAdmin && (
              <div className="w-full sm:w-64">
                <Select
                  label="ขอบเขตรายงาน"
                  value={selectedClassroom}
                  onChange={(e) => setSelectedClassroom(e.target.value)}
                  options={classroomOptions(true)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div ref={reportRef} className="space-y-6">
        <Card className="border-orange-100 shadow-sm bg-white">
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-orange-950 font-extrabold text-xl">
                  <FileText className="h-5 w-5 text-orange-600" />
                  ใบสรุปรายงานประจำวัน
                </div>
                <div className="mt-2 text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-orange-500" />
                    วันที่ {new Date(selectedDate).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <div>
                    ขอบเขต:{" "}
                    <span className="font-bold text-orange-900">
                      {isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE
                        ? "ภาพรวมทุกห้อง"
                        : classroomLabel(classroomScope)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3 text-center">
                  <div className="text-[10px] font-bold text-gray-500">ทั้งหมด</div>
                  <div className="text-2xl font-extrabold text-orange-950">{currentSummary.total}</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                  <div className="text-[10px] font-bold text-emerald-700">มา</div>
                  <div className="text-2xl font-extrabold text-emerald-800">{currentSummary.present}</div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-center">
                  <div className="text-[10px] font-bold text-amber-700">สาย</div>
                  <div className="text-2xl font-extrabold text-amber-800">{currentSummary.late}</div>
                </div>
                <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-center">
                  <div className="text-[10px] font-bold text-red-700">ขาด/ลา</div>
                  <div className="text-2xl font-extrabold text-red-800">
                    {currentSummary.leave + currentSummary.absent}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Card className="border-orange-100 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                    <CheckCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500">มาเรียน</p>
                    <h3 className="text-xl font-bold text-emerald-800">{currentSummary.present} คน</h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-100 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500">สาย</p>
                    <h3 className="text-xl font-bold text-amber-800">{currentSummary.late} คน</h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-100 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500">ลา</p>
                    <h3 className="text-xl font-bold text-blue-800">{currentSummary.leave} คน</h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-100 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-100 text-red-600">
                    <UserX className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500">ขาด</p>
                    <h3 className="text-xl font-bold text-red-800">{currentSummary.absent} คน</h3>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-orange-100 shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-2" />
            <span className="text-gray-500 text-xs font-semibold">กำลังประมวลผลรายงาน...</span>
          </div>
        ) : isAdmin && selectedClassroom === ALL_CLASSROOMS_VALUE ? (
          <Card className="border-orange-100 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ห้องเรียน</TableHead>
                  <TableHead className="text-center">สถานะการส่ง</TableHead>
                  <TableHead className="text-center">นักเรียนทั้งหมด</TableHead>
                  <TableHead className="text-center text-emerald-700">มา (คน)</TableHead>
                  <TableHead className="text-center text-amber-700">สาย (คน)</TableHead>
                  <TableHead className="text-center text-blue-700">ลา (คน)</TableHead>
                  <TableHead className="text-center text-red-700">ขาด (คน)</TableHead>
                  <TableHead className="text-right">% อัตราการเข้าเรียน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow key={s.classroom} className="hover:bg-orange-50/10">
                    <TableCell className="font-bold text-gray-800">ห้องเรียน {s.classroom}</TableCell>
                    <TableCell className="text-center">
                      {s.hasRecord ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          <CheckCircle2 className="h-3 w-3" /> ส่งแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          <AlertCircle className="h-3 w-3" /> ยังไม่ส่ง
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-gray-700">
                      {s.hasRecord ? `${s.totalChecked} คน` : "-"}
                    </TableCell>
                    <TableCell className="text-center text-emerald-700 font-semibold">
                      {s.hasRecord ? s.present : "-"}
                    </TableCell>
                    <TableCell className="text-center text-amber-700 font-semibold">
                      {s.hasRecord ? s.late : "-"}
                    </TableCell>
                    <TableCell className="text-center text-blue-700 font-semibold">
                      {s.hasRecord ? s.leave : "-"}
                    </TableCell>
                    <TableCell className="text-center text-red-700 font-semibold">
                      {s.hasRecord ? s.absent : "-"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-800">
                      {s.hasRecord ? (
                        <span className={`px-2 py-0.5 rounded-lg ${
                          s.percentage >= 80 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                        }`}>
                          {s.percentage}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-orange-100 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่</TableHead>
                    <TableHead>รหัสนักเรียน</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance
                    .filter((record) => record.classroom === classroomScope)
                    .map((record, idx) => (
                      <TableRow key={`${record.studentId}-${idx}`} className="hover:bg-orange-50/10">
                        <TableCell className="font-bold text-gray-700">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-mono text-gray-600 font-semibold">
                          {record.studentId}
                        </TableCell>
                        <TableCell className="font-semibold text-gray-800">
                          {record.studentName}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${
                              record.status === "มา"
                                ? "bg-emerald-100 text-emerald-800"
                                : record.status === "สาย"
                                  ? "bg-amber-100 text-amber-800"
                                  : record.status === "ลา"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                          >
                            {record.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-orange-100 shadow-sm">
                <CardHeader className="border-b border-orange-50">
                  <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    มาเรียน ({studentStatusGroups.present.length} คน)
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-gray-500">
                    รายชื่อนักเรียนที่มาเรียนในวันที่เลือก
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {studentStatusGroups.present.length > 0 ? studentStatusGroups.present.map((student) => (
                      <span key={student.studentId} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {student.number}. {student.name}
                      </span>
                    )) : <span className="text-sm text-gray-400">-</span>}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-100 shadow-sm">
                <CardHeader className="border-b border-orange-50">
                  <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                    <Clock3 className="h-5 w-5 text-amber-600" />
                    สาย ({studentStatusGroups.late.length} คน)
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-gray-500">
                    รายชื่อนักเรียนที่มาสาย
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {studentStatusGroups.late.length > 0 ? studentStatusGroups.late.map((student) => (
                      <span key={student.studentId} className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        {student.number}. {student.name}
                      </span>
                    )) : <span className="text-sm text-gray-400">-</span>}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-100 shadow-sm">
                <CardHeader className="border-b border-orange-50">
                  <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    ลา ({studentStatusGroups.leave.length} คน)
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-gray-500">
                    รายชื่อนักเรียนที่ลา
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {studentStatusGroups.leave.length > 0 ? studentStatusGroups.leave.map((student) => (
                      <span key={student.studentId} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        {student.number}. {student.name}
                      </span>
                    )) : <span className="text-sm text-gray-400">-</span>}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-100 shadow-sm">
                <CardHeader className="border-b border-orange-50">
                  <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                    <UserX className="h-5 w-5 text-red-600" />
                    ขาด ({studentStatusGroups.absent.length} คน)
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-gray-500">
                    รายชื่อนักเรียนที่ขาดเรียน
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {studentStatusGroups.absent.length > 0 ? studentStatusGroups.absent.map((student) => (
                      <span key={student.studentId} className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">
                        {student.number}. {student.name}
                      </span>
                    )) : <span className="text-sm text-gray-400">-</span>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <div className="print:hidden">
        <Card className="border-orange-100 bg-orange-50/20 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm text-gray-700">
              ใช้ปุ่ม <span className="font-bold text-orange-900">พิมพ์ / Export PDF</span> เพื่อบันทึกรายงานเป็นไฟล์ PDF
            </div>
            <Button variant="outline" onClick={exportPdf} className="border-orange-200">
              <Download className="h-4 w-4" /> Export PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
