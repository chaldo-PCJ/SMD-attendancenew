"use client";

import React, { useState, useMemo, useCallback } from "react";
import { api, AttendanceRecord, UniformCheckRecord } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import {
  LogOut, Search, GraduationCap, Calendar, CheckCircle2,
  AlertTriangle, RefreshCw, User, School, Clock,
  CalendarCheck, CalendarX, Shirt, Scissors, Hand,
  BookOpen, UserCircle, AlertCircle, ChevronRight,
  ArrowRight
} from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { format, parse } from "date-fns";
import { th } from "date-fns/locale/th";

ChartJS.register(ArcElement, Tooltip, Legend);

function formatThaiDate(dateStr: string): string {
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  const buddhistYear = d.getFullYear() + 543;
  return `${format(d, "d MMM", { locale: th })} ${buddhistYear}`;
}

function datesForStatus(records: AttendanceRecord[], status: string): Date[] {
  return records.filter((r) => r.status === status).map((r) => parse(r.date, "yyyy-MM-dd", new Date()));
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "มา": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "สาย": return "bg-amber-50 text-amber-700 border-amber-200";
    case "ลา": return "bg-blue-50 text-blue-700 border-blue-200";
    case "ขาด": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function statusBadgeLabel(status: string): string {
  switch (status) {
    case "มา": return "มาเข้าแถว";
    case "สาย": return "มาสาย";
    case "ลา": return "ลา";
    case "ขาด": return "ขาดเข้าแถว";
    default: return status;
  }
}

export default function StudentPortalPage() {
  const { logout } = useAuth();
  const { showToast } = useToast();

  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [uniformRecords, setUniformRecords] = useState<(UniformCheckRecord & { date: string; classroom: string })[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [foundStudent, setFoundStudent] = useState<{ name: string; classroom: string; id: string } | null>(null);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = studentId.trim();
    if (!trimmed) {
      showToast("กรุณากรอกรหัสนักเรียน", "warning");
      return;
    }

    setLoading(true);
    setSelectedDate(undefined);
    setFoundStudent(null);
    try {
      const studentsRes = await api.getAllStudents();

      const match = studentsRes.success
        ? studentsRes.students.find(s => String(s.studentId).trim() === trimmed)
        : undefined;

      if (match) {
        setFoundStudent({ name: match.name, classroom: match.classroom || "", id: match.studentId });
      }

      let allAttendance: AttendanceRecord[] = [];
      let allUniform: (UniformCheckRecord & { date: string; classroom: string })[] = [];

      const classroom = match?.classroom || "";

      if (classroom) {
        const [attRes, uniRes] = await Promise.all([
          api.getAttendance(classroom),
          api.getAllUniformChecks(classroom),
        ]);
        if (attRes.success) allAttendance = attRes.attendance || [];
        if (uniRes.success) allUniform = uniRes.checks || [];
      } else {
        const { CLASSROOMS } = await import("@/lib/classrooms");
        const [attResults, uniRes] = await Promise.all([
          Promise.all(CLASSROOMS.map((cls) => api.getAttendance(cls))),
          api.getAllUniformChecks(),
        ]);
        for (const res of attResults) {
          if (res.success) {
            allAttendance.push(...(res.attendance || []));
          }
        }
        if (uniRes.success) allUniform = uniRes.checks || [];
      }

      const filteredAtt = allAttendance.filter(r => String(r.studentId).trim() === trimmed);
      const filteredUni = allUniform.filter(r => String(r.studentId).trim() === trimmed);

      setRecords(filteredAtt);
      setUniformRecords(filteredUni);
      setHasSearched(true);

      if (filteredAtt.length === 0 && filteredUni.length === 0 && !match) {
        showToast("ไม่พบประวัติของรหัสนี้", "info");
      } else if (filteredAtt.length === 0 && filteredUni.length === 0) {
        showToast("พบข้อมูลนักเรียน แต่ยังไม่มีประวัติการเข้าแถวหรือการตรวจระเบียบวินัย", "info");
      } else {
        showToast("ค้นหาข้อมูลสำเร็จ", "success");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการค้นหา", "error");
    } finally {
      setLoading(false);
    }
  }, [studentId, showToast]);

  const studentInfo = useMemo(() => {
    if (records.length > 0) return { name: records[0].studentName, classroom: records[0].classroom, id: records[0].studentId };
    if (uniformRecords.length > 0) return { name: uniformRecords[0].studentName, classroom: uniformRecords[0].classroom, id: uniformRecords[0].studentId };
    if (foundStudent) return foundStudent;
    return null;
  }, [records, uniformRecords, foundStudent]);

  const stats = useMemo(() => {
    let present = 0, late = 0, leave = 0, absent = 0;
    records.forEach(r => {
      if (r.status === "มา") present++;
      else if (r.status === "สาย") late++;
      else if (r.status === "ลา") leave++;
      else if (r.status === "ขาด") absent++;
    });
    const total = records.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { present, late, leave, absent, total, rate };
  }, [records]);

  const uniformStats = useMemo(() => {
    let uniformPass = 0, hairPass = 0, nailPass = 0;
    const total = uniformRecords.length;
    uniformRecords.forEach(r => {
      if (r.uniformPass) uniformPass++;
      if (r.hairPass) hairPass++;
      if (r.nailPass) nailPass++;
    });
    return {
      total,
      uniformRate: total > 0 ? Math.round((uniformPass / total) * 100) : 0,
      hairRate: total > 0 ? Math.round((hairPass / total) * 100) : 0,
      nailRate: total > 0 ? Math.round((nailPass / total) * 100) : 0,
    };
  }, [uniformRecords]);

  const getRateColor = (rate: number) => {
    if (rate >= 80) return "text-emerald-600";
    if (rate >= 60) return "text-amber-600";
    return "text-red-500";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return "bg-emerald-500";
    if (rate >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const chartData = useMemo(() => ({
    labels: ["มาเข้าแถว", "มาสาย", "ลา", "ขาดเข้าแถว"],
    datasets: [{
      data: [stats.present, stats.late, stats.leave, stats.absent],
      backgroundColor: ["#10b981", "#f59e0b", "#3b82f6", "#ef4444"],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }), [stats]);

  const calendarModifiers = useMemo(() => ({
    present: datesForStatus(records, "มา"),
    late: datesForStatus(records, "สาย"),
    leave: datesForStatus(records, "ลา"),
    absent: datesForStatus(records, "ขาด"),
  }), [records]);

  const calendarModifierClassNames = useMemo(() => ({
    present: "!bg-emerald-500 !text-white !rounded-full !font-bold",
    late: "!bg-amber-500 !text-white !rounded-full !font-bold",
    leave: "!bg-blue-500 !text-white !rounded-full !font-bold",
    absent: "!bg-red-500 !text-white !rounded-full !font-bold",
  }), []);

  const selectedDayInfo = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const dayAtt = records.filter(r => r.date === dateStr);
    const dayUni = uniformRecords.filter(r => r.date === dateStr);
    if (dayAtt.length === 0 && dayUni.length === 0) return null;
    return { dateStr, formatted: formatThaiDate(dateStr), attendance: dayAtt, uniform: dayUni };
  }, [selectedDate, records, uniformRecords]);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-orange-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="space-y-8">

          {/* ─── Search ─── */}
          <div className="max-w-6xl mx-auto w-full">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex h-12 w-12 rounded-xl bg-white border border-slate-200 items-center justify-center mb-3">
                    <Search className="h-5 w-5 text-orange-500" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900">ค้นหาข้อมูลนักเรียน</h2>
                  <p className="text-sm text-slate-500 mt-0.5">กรอกรหัสประจำตัวนักเรียนเพื่อดูสถิติส่วนตัวทั้งหมด</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="รหัสประจำตัวนักเรียน..."
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      disabled={loading}
                      className="pl-10 h-12 text-base bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 px-6 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-none transition-all shrink-0"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      "ค้นหา"
                    )}
                  </Button>
                  <button
                    onClick={() => {
                      window.location.href = "/login";
                    }}
                    className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-all w-full sm:w-auto shrink-0"
                  >
                    เข้าสู่ระบบอาจารย์
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ─── Loading State ─── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
              <div className="h-10 w-10 border-[3px] border-slate-200 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-500">กำลังประมวลผลข้อมูล...</p>
            </div>
          )}

          {/* ─── Empty State: Welcome ─── */}
          {!loading && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
              <div className="h-16 w-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                <UserCircle className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">ยินดีต้อนรับสู่ระบบสืบค้นข้อมูล</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">กรุณากรอกรหัสนักเรียนเพื่อเริ่มต้นการค้นหา และดูสถิติการเรียนของคุณ</p>
            </div>
          )}

          {/* ─── Empty State: Not Found ─── */}
          {!loading && hasSearched && !studentInfo && (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
              <div className="h-16 w-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-5">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">ไม่พบข้อมูลนักเรียน</h3>
              <p className="text-sm text-slate-500 mt-1">
                ไม่พบประวัติของรหัสนักเรียน "{studentId}" ในระบบ
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setStudentId(""); setHasSearched(false); }}
                className="mt-4"
              >
                ลองใหม่อีกครั้ง
              </Button>
            </div>
          )}

          {/* ─── Results ─── */}
          {!loading && hasSearched && studentInfo && (
            <div className="space-y-6 animate-fade-in">

              {/* ── Profile & Attendance Rate ── */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
                {/* Avatar */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <User className="h-6 w-6 sm:h-7 sm:w-7 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{studentInfo.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                        <School className="h-3.5 w-3.5 text-slate-400" />
                        ม.{studentInfo.classroom}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-slate-500">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        {studentInfo.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>


              {/* Chart */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
                  <CheckCircle2 className="h-4 w-4 text-orange-500" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">สัดส่วนการมาเข้าแถว</h3>
                </div>
                <div className="flex flex-col items-center gap-6">
                  <div className="relative h-44 w-44">
                    {stats.total > 0 ? (
                      <Doughnut
                        data={chartData}
                        options={{
                          maintainAspectRatio: false,
                          cutout: '78%',
                          plugins: { legend: { display: false }, tooltip: { enabled: true } }
                        }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <p className="text-sm text-slate-400 font-medium">ไม่มีข้อมูล</p>
                      </div>
                    )}
                    {stats.total > 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-slate-900">{stats.rate}%</span>
                        <span className="text-[11px] font-medium text-slate-500">มาเข้าแถว</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-lg font-bold text-slate-400">ไม่พบข้อมูล</span>
                      </div>
                    )}
                  </div>
                  <div className="w-full grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" />
                      <span className="text-slate-600">มาเข้าแถว</span>
                      <span className="ml-auto font-semibold text-slate-900">{stats.present}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" />
                      <span className="text-slate-600">มาสาย</span>
                      <span className="ml-auto font-semibold text-slate-900">{stats.late}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
                      <span className="text-slate-600">ลา</span>
                      <span className="ml-auto font-semibold text-slate-900">{stats.leave}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shrink-0" />
                      <span className="text-slate-600">ขาด</span>
                      <span className="ml-auto font-semibold text-slate-900">{stats.absent}</span>
                    </div>
                  </div>
                </div>
              </div>



              {/* ── Calendar & Chart ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Calendar */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
                    <Calendar className="h-4 w-4 text-orange-500" />
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">ปฏิทินการเข้าแถว</h3>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 flex justify-center custom-calendar-wrapper">
                      <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        modifiers={calendarModifiers}
                        modifiersClassNames={calendarModifierClassNames}
                        locale={th}
                        className="bg-slate-50 p-3 rounded-xl border border-slate-100 w-full"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-3 min-h-[160px]">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">รายละเอียดประจำวัน</h4>
                      {selectedDayInfo ? (
                        <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-4 flex-1">
                          <p className="text-sm font-semibold text-orange-500 border-b border-slate-200 pb-2">{selectedDayInfo.formatted}</p>

                          {/* Attendance Info */}
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">การเข้าแถว</p>
                            {selectedDayInfo.attendance.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {selectedDayInfo.attendance.map((a, i) => (
                                  <span key={i} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(a.status)}`}>
                                    {statusBadgeLabel(a.status)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400">ไม่มีข้อมูลการเช็คชื่อ</p>
                            )}
                          </div>

                          {/* Uniform Info */}
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">การตรวจระเบียบวินัย</p>
                            {selectedDayInfo.uniform.length > 0 ? (
                              <div className="space-y-2">
                                {selectedDayInfo.uniform.map((u, i) => (
                                  <div key={i} className="bg-white p-2.5 rounded-xl border border-slate-100 text-xs space-y-1.5">
                                    <div className="flex justify-between">
                                      <span className="font-medium text-slate-600 flex items-center gap-1.5"><Shirt className="h-3 w-3" /> การแต่งกาย</span>
                                      <span className={u.uniformPass ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>{u.uniformPass ? "ผ่าน" : `ไม่ผ่าน (${u.uniformReason || "-"})`}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-slate-600 flex items-center gap-1.5"><Scissors className="h-3 w-3" /> ทรงผม</span>
                                      <span className={u.hairPass ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>{u.hairPass ? "ผ่าน" : `ไม่ผ่าน (${u.hairReason || "-"})`}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-slate-600 flex items-center gap-1.5"><Hand className="h-3 w-3" /> เล็บ</span>
                                      <span className={u.nailPass ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>{u.nailPass ? "ผ่าน" : `ไม่ผ่าน (${u.nailReason || "-"})`}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400">ไม่มีข้อมูลการตรวจ</p>
                            )}
                          </div>

                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-100 border-dashed">
                          <p className="text-xs font-medium text-slate-400">คลิกวันที่บนปฏิทินเพื่อดูข้อมูล</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>


                {/* ── Uniform Stats ── */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-orange-500" />
                      <h3 className="text-sm font-semibold text-slate-900">สถิติการตรวจระเบียบวินัย</h3>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                      {uniformStats.total === 0 ? "ไม่พบข้อมูล" : `ตรวจทั้งหมด ${uniformStats.total} ครั้ง`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {/* Uniform */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <Shirt className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <div className={`text-lg font-semibold ${uniformStats.total === 0 ? "text-slate-400" : getRateColor(uniformStats.uniformRate)}`}>
                        {uniformStats.total === 0 ? "ไม่พบข้อมูล" : `${uniformStats.uniformRate}%`}
                      </div>
                          <div className="text-xs font-medium text-slate-500">การแต่งกาย</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressColor(uniformStats.uniformRate)} transition-all`} style={{ width: `${Math.min(uniformStats.uniformRate, 100)}%` }} />
                      </div>
                    </div>
                    {/* Hair */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <Scissors className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <div className={`text-lg font-semibold ${uniformStats.total === 0 ? "text-slate-400" : getRateColor(uniformStats.hairRate)}`}>
                        {uniformStats.total === 0 ? "ไม่พบข้อมูล" : `${uniformStats.hairRate}%`}
                      </div>
                          <div className="text-xs font-medium text-slate-500">ทรงผม</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressColor(uniformStats.hairRate)} transition-all`} style={{ width: `${Math.min(uniformStats.hairRate, 100)}%` }} />
                      </div>
                    </div>
                    {/* Nails */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <Hand className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <div className={`text-lg font-semibold ${uniformStats.total === 0 ? "text-slate-400" : getRateColor(uniformStats.nailRate)}`}>
                        {uniformStats.total === 0 ? "ไม่พบข้อมูล" : `${uniformStats.nailRate}%`}
                      </div>
                          <div className="text-xs font-medium text-slate-500">เล็บ</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressColor(uniformStats.nailRate)} transition-all`} style={{ width: `${Math.min(uniformStats.nailRate, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        .custom-calendar-wrapper .rdp {
          --rdp-accent-color: #f97316;
          margin: 0;
          width: 100%;
        }
        .custom-calendar-wrapper .rdp-months {
          justify-content: center;
          width: 100%;
        }
        .custom-calendar-wrapper .rdp-month {
          width: 100%;
        }
        .custom-calendar-wrapper .rdp-table {
          max-width: 100%;
          width: 100%;
        }
        .custom-calendar-wrapper .rdp-day_button {
          font-weight: 600;
          border-radius: 9999px;
          font-size: 0.8rem;
        }
        .custom-calendar-wrapper .rdp-selected .rdp-day_button {
          background-color: var(--rdp-accent-color);
          color: white;
          font-weight: bold;
        }
        .custom-calendar-wrapper .rdp-nav_button {
          border-radius: 0.5rem;
        }
        .custom-calendar-wrapper .rdp-caption_label {
          font-weight: 600;
          font-size: 0.9rem;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}