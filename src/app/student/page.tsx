"use client";

import React, { useState, useMemo, useCallback } from "react";
import { api, AttendanceRecord, UniformCheckRecord } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import {
  LogOut, Search, GraduationCap, Calendar, CheckCircle2,
  AlertTriangle, RefreshCw, User, BadgeCheck, School, Clock,
  CalendarCheck, CalendarX, AlertCircle, History, Shirt, Scissors, Hand
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
    case "มา": return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "สาย": return "bg-amber-100 text-amber-800 border-amber-300";
    case "ลา": return "bg-blue-100 text-blue-800 border-blue-300";
    case "ขาด": return "bg-red-100 text-red-800 border-red-300";
    default: return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

function statusBadgeLabel(status: string): string {
  switch (status) {
    case "มา": return "มาเรียน";
    case "สาย": return "มาสาย";
    case "ลา": return "ลา";
    case "ขาด": return "ขาดเรียน";
    default: return status;
  }
}

export default function StudentPortalPage() {
  const { logout } = useAuth();
  const { showToast } = useToast();

  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [uniformRecords, setUniformRecords] = useState<(UniformCheckRecord & { date: string })[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = studentId.trim();
    if (!trimmed) {
      showToast("กรุณากรอกรหัสนักเรียน", "warning");
      return;
    }

    setLoading(true);
    setSelectedDate(undefined);
    try {
      const [attRes, uniRes] = await Promise.all([
        api.getAttendance(),
        api.getAllUniformChecks()
      ]);

      if (!attRes.success || !uniRes.success) {
        throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
      }

      const filteredAtt = (attRes.attendance || []).filter(r => String(r.studentId).trim() === trimmed);
      const filteredUni = (uniRes.checks || []).filter(r => String(r.studentId).trim() === trimmed);

      setRecords(filteredAtt);
      setUniformRecords(filteredUni);
      setHasSearched(true);

      if (filteredAtt.length === 0 && filteredUni.length === 0) {
        showToast("ไม่พบประวัติของรหัสนี้", "info");
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
    return null;
  }, [records, uniformRecords]);

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
    if (rate >= 80) return "text-emerald-500 bg-emerald-500";
    if (rate >= 60) return "text-amber-500 bg-amber-500";
    return "text-red-500 bg-red-500";
  };

  const chartData = useMemo(() => ({
    labels: ["มาเรียน", "มาสาย", "ลา", "ขาดเรียน"],
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
    <div className="min-h-screen bg-[#fcf8f5] p-4 md:p-6 lg:p-8 font-sans selection:bg-orange-100">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-800 text-xl">ระบบสืบค้นข้อมูลนักเรียน</h1>
              <p className="text-sm text-slate-500 font-medium">ตรวจสอบประวัติการเข้าเรียนและการแต่งกาย</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-5 py-2.5 rounded-xl transition-all shadow-sm w-full sm:w-auto">
            <LogOut className="h-4 w-4" /> กลับหน้าแรก
          </button>
        </div>

        {/* Search */}
        <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
            <h2 className="text-white text-lg font-bold flex items-center gap-2">
              <Search className="h-5 w-5 text-orange-100" />
              ค้นหาข้อมูลนักเรียน
            </h2>
            <p className="text-orange-50 text-sm mt-1">กรอกรหัสประจำตัวนักเรียนเพื่อดูสถิติส่วนตัวทั้งหมด</p>
          </div>
          <div className="p-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="รหัสประจำตัวนักเรียน..."
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={loading}
                  className="pl-12 h-14 text-lg bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl transition-all font-medium"
                />
              </div>
              <Button type="submit" disabled={loading} className="h-14 px-8 text-base font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-md shadow-orange-200 transition-all">
                {loading ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Search className="h-5 w-5 mr-2" />}
                {loading ? "กำลังค้นหา..." : "ค้นหาข้อมูล"}
              </Button>
            </form>
          </div>
        </Card>

        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-slate-500 font-bold animate-pulse">กำลังประมวลผลข้อมูล...</p>
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center mb-2">
              <GraduationCap className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700">ยินดีต้อนรับสู่ระบบสืบค้นข้อมูล</h3>
            <p className="text-slate-500">กรุณากรอกรหัสนักเรียนเพื่อเริ่มต้นการค้นหา</p>
          </div>
        )}

        {!loading && hasSearched && !studentInfo && (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-24 w-24 bg-red-50 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700">ไม่พบข้อมูลนักเรียน</h3>
            <p className="text-slate-500">ไม่พบประวัติของรหัสนักเรียน "{studentId}" ในระบบ</p>
          </div>
        )}

        {!loading && hasSearched && studentInfo && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Profile Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-1 border-0 shadow-lg shadow-slate-200/40 rounded-2xl bg-white overflow-hidden relative">
                <div className="h-24 bg-gradient-to-br from-orange-400 to-orange-500 absolute top-0 left-0 right-0" />
                <div className="p-6 pt-16 relative flex flex-col items-center text-center">
                  <div className="h-20 w-20 bg-white rounded-full p-1.5 shadow-md mb-4">
                    <div className="h-full w-full bg-slate-100 rounded-full flex items-center justify-center">
                      <User className="h-8 w-8 text-slate-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-800 mb-1">{studentInfo.name}</h3>
                  <div className="flex items-center gap-2 justify-center mb-6">
                    <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-100 flex items-center gap-1.5">
                      <School className="h-3.5 w-3.5" /> ม.{studentInfo.classroom}
                    </span>
                    <span className="bg-slate-50 text-slate-700 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 font-mono flex items-center gap-1.5">
                      <BadgeCheck className="h-3.5 w-3.5 text-orange-500" /> {studentInfo.id}
                    </span>
                  </div>

                  {/* Attendance Overall Rate */}
                  <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-slate-600">อัตราการเข้าเรียน</span>
                      <span className={`text-sm font-extrabold ${getRateColor(stats.rate).split(' ')[0]}`}>{stats.rate}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getRateColor(stats.rate).split(' ')[1]}`} style={{ width: `${Math.min(stats.rate, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 text-left">จากการเช็คชื่อทั้งหมด {stats.total} ครั้ง</p>
                  </div>
                </div>
              </Card>

              {/* Uniform Stats */}
              <Card className="md:col-span-2 border-0 shadow-lg shadow-slate-200/40 rounded-2xl bg-white overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-orange-500" />
                  <h3 className="font-bold text-slate-800">สถิติการตรวจเครื่องแต่งกาย</h3>
                  <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">ตรวจทั้งหมด {uniformStats.total} ครั้ง</span>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1 items-center">
                  {/* Uniform */}
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center ${uniformStats.uniformRate >= 80 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      <Shirt className="h-6 w-6" />
                    </div>
                    <div>
                      <div className={`text-3xl font-extrabold ${uniformStats.uniformRate >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{uniformStats.uniformRate}%</div>
                      <div className="text-sm font-bold text-slate-500 mt-1">เครื่องแต่งกาย</div>
                    </div>
                  </div>
                  {/* Hair */}
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center ${uniformStats.hairRate >= 80 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      <Scissors className="h-6 w-6" />
                    </div>
                    <div>
                      <div className={`text-3xl font-extrabold ${uniformStats.hairRate >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{uniformStats.hairRate}%</div>
                      <div className="text-sm font-bold text-slate-500 mt-1">ทรงผม</div>
                    </div>
                  </div>
                  {/* Nails */}
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center ${uniformStats.nailRate >= 80 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      <Hand className="h-6 w-6" />
                    </div>
                    <div>
                      <div className={`text-3xl font-extrabold ${uniformStats.nailRate >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{uniformStats.nailRate}%</div>
                      <div className="text-sm font-bold text-slate-500 mt-1">เล็บ</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Attendance Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "มาเรียน", value: stats.present, icon: CheckCircle2, color: "emerald" },
                { label: "มาสาย", value: stats.late, icon: Clock, color: "amber" },
                { label: "ลา", value: stats.leave, icon: CalendarCheck, color: "blue" },
                { label: "ขาด", value: stats.absent, icon: CalendarX, color: "red" }
              ].map((stat, i) => {
                const Icon = stat.icon;
                const colorMap: Record<string, string> = {
                  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
                  amber: "bg-amber-50 text-amber-600 border-amber-100",
                  blue: "bg-blue-50 text-blue-600 border-blue-100",
                  red: "bg-red-50 text-red-600 border-red-100",
                };
                return (
                  <Card key={i} className={`border ${colorMap[stat.color]} shadow-sm hover:shadow-md transition-all`}>
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                      <Icon className="h-6 w-6 opacity-80" />
                      <div className="text-3xl font-extrabold">{stat.value}</div>
                      <div className="text-xs font-bold opacity-80">{stat.label}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Calendar & Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-0 shadow-lg shadow-slate-200/40 rounded-2xl bg-white p-6 flex flex-col items-center">
                <div className="w-full flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                  <Calendar className="h-5 w-5 text-orange-500" />
                  <h3 className="font-bold text-slate-800">ปฏิทินการเข้าเรียน</h3>
                </div>
                <div className="flex flex-col md:flex-row gap-8 w-full">
                  <div className="flex-1 flex justify-center custom-calendar-wrapper">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      modifiers={calendarModifiers}
                      modifiersClassNames={calendarModifierClassNames}
                      locale={th}
                      className="bg-slate-50 p-4 rounded-2xl border border-slate-100"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-4">
                    <h4 className="font-bold text-slate-700 text-sm">รายละเอียดประจำวัน</h4>
                    {selectedDayInfo ? (
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                        <p className="font-bold text-orange-600 border-b border-slate-200 pb-2">{selectedDayInfo.formatted}</p>

                        {/* Attendance Info */}
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-2">การเข้าเรียน:</p>
                          {selectedDayInfo.attendance.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedDayInfo.attendance.map((a, i) => (
                                <span key={i} className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadgeClass(a.status)}`}>
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
                          <p className="text-xs font-bold text-slate-500 mb-2">การตรวจเครื่องแต่งกาย:</p>
                          {selectedDayInfo.uniform.length > 0 ? (
                            <div className="space-y-2">
                              {selectedDayInfo.uniform.map((u, i) => (
                                <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-100 text-xs space-y-1.5 shadow-sm">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-slate-600 flex items-center gap-1.5"><Shirt className="h-3 w-3" /> เครื่องแต่งกาย</span>
                                    <span className={u.uniformPass ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>{u.uniformPass ? "ผ่าน" : `ไม่ผ่าน (${u.uniformReason || "-"})`}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium text-slate-600 flex items-center gap-1.5"><Scissors className="h-3 w-3" /> ทรงผม</span>
                                    <span className={u.hairPass ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>{u.hairPass ? "ผ่าน" : `ไม่ผ่าน (${u.hairReason || "-"})`}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium text-slate-600 flex items-center gap-1.5"><Hand className="h-3 w-3" /> เล็บ</span>
                                    <span className={u.nailPass ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>{u.nailPass ? "ผ่าน" : `ไม่ผ่าน (${u.nailReason || "-"})`}</span>
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
                      <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                        <p className="text-slate-400 text-sm font-medium">คลิกวันที่บนปฏิทินเพื่อดูข้อมูล</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="lg:col-span-1 border-0 shadow-lg shadow-slate-200/40 rounded-2xl bg-white p-6">
                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                  <CheckCircle2 className="h-5 w-5 text-orange-500" />
                  <h3 className="font-bold text-slate-800">สัดส่วนการมาเรียน</h3>
                </div>
                <div className="relative h-48 w-full flex items-center justify-center">
                  {stats.total > 0 ? (
                    <Doughnut data={chartData} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }} />
                  ) : (
                    <p className="text-slate-400 text-sm font-bold">ไม่มีข้อมูล</p>
                  )}
                  {stats.total > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-extrabold text-slate-800">{stats.rate}%</span>
                      <span className="text-xs text-slate-500 font-medium">มาเรียน</span>
                    </div>
                  )}
                </div>
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-sm font-medium"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />มาเรียน</span><span className="font-bold text-slate-700">{stats.present}</span></div>
                  <div className="flex justify-between text-sm font-medium"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />มาสาย</span><span className="font-bold text-slate-700">{stats.late}</span></div>
                  <div className="flex justify-between text-sm font-medium"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />ลา</span><span className="font-bold text-slate-700">{stats.leave}</span></div>
                  <div className="flex justify-between text-sm font-medium"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />ขาดเรียน</span><span className="font-bold text-slate-700">{stats.absent}</span></div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-calendar-wrapper .rdp {
          --rdp-accent-color: #f97316;
          --rdp-background-color: #fff7ed;
          margin: 0;
        }
        .custom-calendar-wrapper .rdp-day_button {
          font-weight: 600;
          border-radius: 9999px;
        }
        .custom-calendar-wrapper .rdp-selected .rdp-day_button {
          background-color: var(--rdp-accent-color);
          color: white;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}
