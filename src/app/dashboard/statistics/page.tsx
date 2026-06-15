"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, AttendanceRecord, Student } from "@/lib/api";
import {
  CLASSROOMS,
  ALL_CLASSROOMS_VALUE,
  classroomOptions,
  classroomLabel,
} from "@/lib/classrooms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  BarChart2,
  PieChart,
  Info,
  TrendingUp,
  Users,
  Target,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Download,
  Calendar,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ChartTitle
);

type RangeFilter = "all" | "7d" | "30d" | "custom";

interface ClassroomSummary {
  classroom: string;
  percentage: number;
  totalRecords: number;
  hasData: boolean;
  present: number;
  late: number;
  leave: number;
  absent: number;
}

interface StudentAnalytics {
  studentId: string;
  studentName: string;
  number: number;
  present: number;
  late: number;
  leave: number;
  absent: number;
  total: number;
  attendanceRate: number;
}

const statusConfig = [
  { key: "มา", label: "มาเรียน", color: "#10b981" },
  { key: "สาย", label: "มาสาย", color: "#f59e0b" },
  { key: "ลา", label: "ลากิจ/ลาป่วย", color: "#3b82f6" },
  { key: "ขาด", label: "ขาดเรียน", color: "#ef4444" },
] as const;

const RANGE_PRESETS: { value: RangeFilter; label: string; days: number | null }[] = [
  { value: "all", label: "ข้อมูลทั้งหมด", days: null },
  { value: "7d", label: "7 วันที่ผ่านมา", days: 7 },
  { value: "30d", label: "30 วันที่ผ่านมา", days: 30 },
  { value: "custom", label: "กำหนดเอง", days: null },
];

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function StatisticsPage() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");

  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [selectedClassroom, setSelectedClassroom] = useState<string>(
    session.role === "admin" ? ALL_CLASSROOMS_VALUE : session.classroomLock || "2/1"
  );

  const isAdmin = session.role === "admin";
  const scopeIsAll = selectedClassroom === ALL_CLASSROOMS_VALUE;
  const effectiveClassroom = isAdmin ? selectedClassroom : session.classroomLock || "2/1";

  useEffect(() => {
    if (session.role === "admin") {
      setSelectedClassroom(ALL_CLASSROOMS_VALUE);
      return;
    }

    if (session.classroomLock) {
      setSelectedClassroom(session.classroomLock);
    }
  }, [session.role, session.classroomLock]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const classroomScope = isAdmin ? selectedClassroom : effectiveClassroom;

      const attendanceRes = await api.getAttendance(
        classroomScope === ALL_CLASSROOMS_VALUE ? undefined : classroomScope
      );
      if (!attendanceRes.success) {
        throw new Error("ไม่สามารถดึงสถิติการเข้าเรียนได้");
      }

      setAttendance(attendanceRes.attendance || []);

      if (classroomScope !== ALL_CLASSROOMS_VALUE) {
        const studentsRes = await api.getStudents(classroomScope);
        setStudents(studentsRes.success ? studentsRes.students || [] : []);
      } else {
        setStudents([]);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลสถิติ", "error");
    } finally {
      setLoading(false);
    }
  }, [effectiveClassroom, isAdmin, selectedClassroom, showToast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const filteredAttendance = useMemo(() => {
    if (rangeFilter === "all") return attendance;

    let cutoffDate: Date | null = null;

    if (rangeFilter === "custom") {
      if (!customStartDate && !customEndDate) return attendance;
      return attendance.filter((r) => {
        if (customStartDate && r.date < customStartDate) return false;
        if (customEndDate && r.date > customEndDate) return false;
        return true;
      });
    }

    const preset = RANGE_PRESETS.find((p) => p.value === rangeFilter);
    if (!preset || preset.days === null) return attendance;

    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - preset.days);
    const cutoffStr = formatDate(cutoffDate);
    return attendance.filter((r) => r.date >= cutoffStr);
  }, [attendance, rangeFilter, customStartDate, customEndDate]);

  const statusCounts = useMemo(() => {
    return filteredAttendance.reduce(
      (acc, record) => {
        if (record.status === "มา") acc.present += 1;
        if (record.status === "สาย") acc.late += 1;
        if (record.status === "ลา") acc.leave += 1;
        if (record.status === "ขาด") acc.absent += 1;
        return acc;
      },
      { present: 0, late: 0, leave: 0, absent: 0 }
    );
  }, [filteredAttendance]);

  const overallAttendanceRate = useMemo(() => {
    const total = filteredAttendance.length;
    if (total === 0) return 0;
    const attended = filteredAttendance.filter((r) => r.status === "มา" || r.status === "สาย").length;
    return Math.round((attended / total) * 100);
  }, [filteredAttendance]);

  const uniqueDates = useMemo(
    () => new Set(filteredAttendance.map((record) => record.date)).size,
    [filteredAttendance]
  );

  const classroomSummaries = useMemo<ClassroomSummary[]>(() => {
    return CLASSROOMS.map((classroom) => {
      const records = filteredAttendance.filter((record) => record.classroom === classroom);
      const totalRecords = records.length;
      if (totalRecords === 0) {
        return {
          classroom,
          percentage: 0,
          totalRecords: 0,
          hasData: false,
          present: 0,
          late: 0,
          leave: 0,
          absent: 0,
        };
      }

      const present = records.filter((record) => record.status === "มา").length;
      const late = records.filter((record) => record.status === "สาย").length;
      const leave = records.filter((record) => record.status === "ลา").length;
      const absent = records.filter((record) => record.status === "ขาด").length;
      const percentage = Math.round(((present + late) / totalRecords) * 100);

      return {
        classroom,
        percentage,
        totalRecords,
        hasData: true,
        present,
        late,
        leave,
        absent,
      };
    });
  }, [filteredAttendance]);

  const classroomCompletion = useMemo(() => {
    const hasData = classroomSummaries.filter((item) => item.hasData).length;
    return { hasData, total: CLASSROOMS.length };
  }, [classroomSummaries]);

  const studentAnalytics = useMemo<StudentAnalytics[]>(() => {
    if (scopeIsAll) return [];

    return students
      .map((student) => {
        const records = filteredAttendance.filter(
          (record) => String(record.studentId).trim() === String(student.studentId).trim()
        );
        const present = records.filter((record) => record.status === "มา").length;
        const late = records.filter((record) => record.status === "สาย").length;
        const leave = records.filter((record) => record.status === "ลา").length;
        const absent = records.filter((record) => record.status === "ขาด").length;
        const total = records.length;
        const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        return {
          studentId: student.studentId,
          studentName: student.name,
          number: student.number,
          present,
          late,
          leave,
          absent,
          total,
          attendanceRate,
        };
      })
      .sort((a, b) => a.attendanceRate - b.attendanceRate || a.number - b.number);
  }, [filteredAttendance, scopeIsAll, students]);

  const scopeRiskStudents = useMemo(
    () => studentAnalytics.filter((item) => item.total > 0 && item.attendanceRate < 80),
    [studentAnalytics]
  );

  const barData = useMemo(() => {
    if (!scopeIsAll) {
      return {
        labels: studentAnalytics.map((item) => `#${item.number}`),
        datasets: [
          {
            label: "อัตราเข้าเรียน (%)",
            data: studentAnalytics.map((item) => item.attendanceRate),
            backgroundColor: studentAnalytics.map((item) =>
              item.attendanceRate >= 80
                ? "rgba(16, 185, 129, 0.85)"
                : item.attendanceRate >= 60
                  ? "rgba(245, 158, 11, 0.85)"
                  : "rgba(239, 68, 68, 0.85)"
            ),
            borderColor: "#ffffff",
            borderWidth: 1,
            borderRadius: 8,
          },
        ],
      };
    }

    return {
      labels: classroomSummaries.map((item) => `ห้อง ${item.classroom}`),
      datasets: [
        {
          label: "อัตราเข้าเรียน (%)",
          data: classroomSummaries.map((item) => (item.hasData ? item.percentage : 0)),
          backgroundColor: classroomSummaries.map((item) =>
            item.hasData ? "rgba(249, 115, 22, 0.85)" : "rgba(229, 231, 235, 0.5)"
          ),
          borderColor: "rgb(249, 115, 22)",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    };
  }, [classroomSummaries, scopeIsAll, studentAnalytics]);

  const doughnutData = useMemo(() => {
    return {
      labels: statusConfig.map((item) => item.label),
      datasets: [
        {
          data: [statusCounts.present, statusCounts.late, statusCounts.leave, statusCounts.absent],
          backgroundColor: statusConfig.map((item) => item.color),
          borderColor: ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    };
  }, [statusCounts]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          font: {
            family: "var(--font-noto-thai), sans-serif",
            weight: "bold" as const,
            size: 12,
          },
          padding: 20,
        },
      },
      tooltip: {
        bodyFont: {
          family: "var(--font-noto-thai), sans-serif",
        },
        titleFont: {
          family: "var(--font-noto-thai), sans-serif",
        },
      },
    },
  };

  const barOptions = useMemo(() => {
    const isStudentScope = !scopeIsAll;
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
          ticks: {
            font: {
              family: "var(--font-noto-thai), sans-serif",
              weight: "bold" as const,
            },
            callback: (value: any) => `${value}%`,
          },
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              family: "var(--font-noto-thai), sans-serif",
              weight: "bold" as const,
              size: 10,
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          bodyFont: {
            family: "var(--font-noto-thai), sans-serif",
          },
          titleFont: {
            family: "var(--font-noto-thai), sans-serif",
          },
          callbacks: isStudentScope
            ? {
              title: (context: any) => {
                const index = context[0].dataIndex;
                const item = studentAnalytics[index];
                return item ? `${item.number}. ${item.studentName}` : context[0].label;
              },
              label: (context: any) => `อัตราเข้าเรียน: ${context.raw}%`,
            }
            : {
              label: (context: any) => {
                const index = context.dataIndex;
                const item = classroomSummaries[index];
                return item && item.hasData ? `อัตราเข้าเรียน: ${context.raw}%` : "ยังไม่มีข้อมูลเช็คชื่อ";
              },
            },
        },
      },
    };
  }, [classroomSummaries, scopeIsAll, studentAnalytics]);

  const summaryCards = useMemo(() => {
    if (scopeIsAll) {
      return [
        {
          label: "อัตราเข้าเรียนภาพรวม",
          value: `${overallAttendanceRate}%`,
          icon: TrendingUp,
          tone: "orange",
        },
        {
          label: "ห้องที่มีข้อมูล",
          value: `${classroomCompletion.hasData} / ${classroomCompletion.total}`,
          icon: CheckCircle2,
          tone: "emerald",
        },
        {
          label: "วันบันทึกที่พบ",
          value: `${uniqueDates} วัน`,
          icon: Users,
          tone: "blue",
        },
        {
          label: "ยังไม่เช็คชื่อ",
          value: `${classroomCompletion.total - classroomCompletion.hasData} ห้อง`,
          icon: AlertTriangle,
          tone: "red",
        },
      ];
    }

    return [
      {
        label: `อัตราเข้าเรียนห้อง ${effectiveClassroom}`,
        value: `${overallAttendanceRate}%`,
        icon: TrendingUp,
        tone: "orange",
      },
      {
        label: "จำนวนนักเรียน",
        value: `${students.length} คน`,
        icon: Users,
        tone: "emerald",
      },
      {
        label: "วันบันทึกที่พบ",
        value: `${uniqueDates} วัน`,
        icon: CheckCircle2,
        tone: "blue",
      },
      {
        label: "นักเรียนที่ต้องติดตาม",
        value: `${scopeRiskStudents.length} คน`,
        icon: AlertTriangle,
        tone: "red",
      },
    ];
  }, [
    classroomCompletion.hasData,
    classroomCompletion.total,
    effectiveClassroom,
    overallAttendanceRate,
    scopeIsAll,
    scopeRiskStudents.length,
    students.length,
    uniqueDates,
  ]);

  const exportPdf = () => {
    window.print();
    showToast("เลือกบันทึกเป็น PDF จากหน้าต่างพิมพ์ของเบราว์เซอร์ได้เลย", "info", 3000);
  };

  const safeFileName = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[\\/:*?\"<>|]+/g, "-");

  const exportExcel = () => {
    try {
      const scopeLabel = scopeIsAll ? "all" : effectiveClassroom;
      const rangeLabel = rangeFilter === "all" ? "all" : rangeFilter;
      const fileBase = `statistics_${rangeLabel}_${safeFileName(scopeLabel)}`;

      if (!scopeIsAll) {
        const rows = studentAnalytics.map((item) => ({
          "เลขที่": item.number,
          "นักเรียน": item.studentName,
          "รหัสนักเรียน": item.studentId,
          "มา": item.present,
          "สาย": item.late,
          "ลา": item.leave,
          "ขาด": item.absent,
          "รวมวันที่มีข้อมูล": item.total,
          "% เข้าเรียน": `${item.attendanceRate}%`,
        }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Student Analytics");
        XLSX.writeFile(wb, safeFileName(`${fileBase}.xlsx`));
        showToast("Export Excel สำเร็จ (สถิตินักเรียน)", "success", 2500);
        return;
      }

      const rows = classroomSummaries
        .slice()
        .sort((a, b) => {
          if (!a.hasData && !b.hasData) return 0;
          if (!a.hasData) return 1;
          if (!b.hasData) return -1;
          return a.percentage - b.percentage;
        })
        .map((item) => ({
          "ห้องเรียน": classroomLabel(item.classroom),
          "สถานะ": item.hasData ? "ส่งแล้ว" : "ยังไม่ส่ง",
          "นักเรียนทั้งหมด": item.hasData ? item.totalRecords : "-",
          "มา": item.hasData ? item.present : "-",
          "สาย": item.hasData ? item.late : "-",
          "ลา": item.hasData ? item.leave : "-",
          "ขาด": item.hasData ? item.absent : "-",
          "% อัตราการเข้าเรียน": item.hasData ? `${item.percentage}%` : "-",
        }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Classroom Analytics");
      XLSX.writeFile(wb, safeFileName(`${fileBase}.xlsx`));
      showToast("Export Excel สำเร็จ (สถิติรายห้อง)", "success", 2500);
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || "Export Excel ไม่สำเร็จ", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-orange-950 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-orange-600" /> สถิติและบทวิเคราะห์การเข้าเรียน
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            {scopeIsAll
              ? "ดูภาพรวมทั้งโรงเรียน และเจาะลึกห้องเรียนที่ต้องติดตามเป็นพิเศษ"
              : `วิเคราะห์เชิงลึกเฉพาะ ${classroomLabel(effectiveClassroom)} พร้อมรายชื่อนักเรียนที่ต้องติดตาม`}
          </p>
        </div>
      </div>

      <Card className="border-orange-100 shadow-sm">
        <CardContent className="p-5 flex flex-col lg:flex-row items-end gap-4">
          <div className="w-full lg:w-72">
            <Select
              label="ขอบเขตการวิเคราะห์"
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
              disabled={!isAdmin}
              options={isAdmin ? classroomOptions(true) : classroomOptions(false)}
            />
          </div>

          <div className="w-full lg:w-56">
            <Select
              label="ช่วงเวลาวิเคราะห์"
              value={rangeFilter}
              onChange={(e) => setRangeFilter(e.target.value as RangeFilter)}
              options={RANGE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            />
          </div>

          {rangeFilter === "custom" && (
            <div className="flex flex-col sm:flex-row items-end gap-3 w-full lg:w-auto">
              <div className="w-full sm:w-44">
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">วันที่เริ่มต้น</label>
                <div className="relative">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400 pointer-events-none" />
                </div>
              </div>
              <div className="w-full sm:w-44">
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">วันที่สิ้นสุด</label>
                <div className="relative">
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    max={formatDate(new Date())}
                    className="flex h-10 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400 pointer-events-none" />
                </div>
              </div>
              {(customStartDate || customEndDate) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className="text-xs text-gray-500 hover:text-red-600 h-10 px-2"
                  title="ล้างวันที่"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <div className="flex gap-2 w-full lg:w-auto">
            <Button
              variant="outline"
              onClick={exportPdf}
              disabled={loading}
              className="px-4 w-full lg:w-auto border-orange-200"
            >
              <Printer className="h-4 w-4" /> Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={exportExcel}
              disabled={loading}
              className="px-4 w-full lg:w-auto border-orange-200"
            >
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button
              variant="outline"
              onClick={loadStats}
              disabled={loading}
              className="px-4 w-full lg:w-auto border-orange-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> รีเฟรชข้อมูล
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-orange-100 shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-2" />
          <span className="text-gray-500 text-xs font-semibold">กำลังวิเคราะห์ข้อมูลกราฟ...</span>
        </div>
      ) : filteredAttendance.length === 0 ? (
        <Card className="border-orange-100 bg-orange-50/10">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <Info className="h-10 w-10 text-orange-400" />
            <div>
              <h3 className="font-bold text-orange-950 text-base">ไม่พบข้อมูลสถิติในช่วงเวลาที่เลือก</h3>
              <p className="text-gray-500 text-xs mt-1">
                กรุณาลงบันทึกการเช็คชื่อก่อนเข้าเมนูเพื่อประมวลผลกราฟ
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              const toneClass =
                card.tone === "orange"
                  ? "bg-orange-100 text-orange-600"
                  : card.tone === "emerald"
                    ? "bg-emerald-100 text-emerald-600"
                    : card.tone === "blue"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-red-100 text-red-600";

              return (
                <Card key={card.label} className="border-orange-100 shadow-sm">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${toneClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500">{card.label}</p>
                      <h3 className="text-2xl font-bold text-orange-950 mt-1">{card.value}</h3>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-orange-100 shadow-sm lg:col-span-1 flex flex-col bg-white">
              <CardHeader className="border-b border-orange-50">
                <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-orange-600" />
                  สัดส่วนสถานะการเช็คชื่อ
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-gray-500">
                  {scopeIsAll
                    ? "ภาพรวมการเช็คชื่อของทุกห้องที่อยู่ในช่วงเวลาที่เลือก"
                    : `สัดส่วนการเข้าเรียนของ ${classroomLabel(effectiveClassroom)}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-grow flex flex-col justify-between">
                <div className="relative h-64 w-full">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
                <div className="mt-4 p-4 bg-orange-50/50 border border-orange-100 rounded-xl text-center">
                  <span className="text-xs font-bold text-gray-500 block">
                    {scopeIsAll ? "อัตราการเข้าเรียนเฉลี่ยทั้งโรงเรียน" : "อัตราการเข้าเรียนเฉลี่ยของห้องนี้"}
                  </span>
                  <span className="text-3xl font-extrabold text-orange-600 mt-1 block">{overallAttendanceRate}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-100 shadow-sm lg:col-span-2 bg-white flex flex-col">
              <CardHeader className="border-b border-orange-50">
                <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-orange-600" />
                  {scopeIsAll ? "เปรียบเทียบอัตราเข้าเรียนรายห้อง" : "เปรียบเทียบอัตราเข้าเรียนรายนักเรียน"}
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-gray-500">
                  {scopeIsAll
                    ? "ร้อยละการเข้าเรียนสะสม (มาเรียน + มาสาย) แยกรายห้องเรียน"
                    : "ร้อยละการเข้าเรียนสะสม (มาเรียน + มาสาย) แยกรายนักเรียนในห้องที่เลือก"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-grow flex flex-col justify-center">
                <div className="w-full overflow-x-auto pb-2">
                  <div className={`h-80 w-full ${scopeIsAll ? "min-w-[700px]" : "min-w-[900px]"}`}>
                    <Bar data={barData} options={barOptions} />
                  </div>
                </div>

                <div className="text-[10px] text-gray-400 mt-4 font-semibold italic flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  <span>
                    {scopeIsAll
                      ? "ห้องเรียนที่เป็นแท่งสีเทาหมายความว่าไม่มีประวัติข้อมูลการเช็คชื่อในช่วงเวลาที่ระบุ"
                      : "สีเขียวหมายถึงอัตราการเข้าเรียนสูง, สีส้มคือระดับเฝ้าระวัง, สีแดงคือกลุ่มเสี่ยง"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {!scopeIsAll ? (
            <Card className="border-orange-100 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-orange-50">
                <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-600" />
                  วิเคราะห์รายนักเรียน
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-gray-500">
                  ตารางนี้ช่วยให้อาจารย์เห็นนักเรียนที่มีแนวโน้มขาดเรียนหรือมาสายสะสมจากข้อมูลที่บันทึกแล้ว
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-orange-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold">เลขที่</th>
                        <th className="px-4 py-3 text-left font-bold">นักเรียน</th>
                        <th className="px-4 py-3 text-center font-bold">มา</th>
                        <th className="px-4 py-3 text-center font-bold">สาย</th>
                        <th className="px-4 py-3 text-center font-bold">ลา</th>
                        <th className="px-4 py-3 text-center font-bold">ขาด</th>
                        <th className="px-4 py-3 text-center font-bold">รวมวันที่มีข้อมูล</th>
                        <th className="px-4 py-3 text-right font-bold">% เข้าเรียน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentAnalytics.map((item) => (
                        <tr key={item.studentId} className="border-t border-orange-50 hover:bg-orange-50/40">
                          <td className="px-4 py-3 font-bold text-gray-700">{item.number}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-800">{item.studentName}</div>
                            <div className="text-[10px] font-mono text-gray-400">{item.studentId}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-emerald-700 font-semibold">{item.present}</td>
                          <td className="px-4 py-3 text-center text-amber-700 font-semibold">{item.late}</td>
                          <td className="px-4 py-3 text-center text-blue-700 font-semibold">{item.leave}</td>
                          <td className="px-4 py-3 text-center text-red-700 font-semibold">{item.absent}</td>
                          <td className="px-4 py-3 text-center text-gray-700 font-semibold">{item.total}</td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-bold ${item.attendanceRate >= 80
                                  ? "bg-emerald-50 text-emerald-700"
                                  : item.attendanceRate >= 60
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                            >
                              {item.attendanceRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {scopeRiskStudents.length > 0 && (
                  <div className="p-4 border-t border-orange-50 bg-red-50/20">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      กลุ่มที่ควรติดตาม
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scopeRiskStudents.slice(0, 6).map((item) => (
                        <span
                          key={item.studentId}
                          className="inline-flex items-center rounded-full bg-white border border-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                        >
                          {item.number}. {item.studentName} ({item.attendanceRate}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-orange-100 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-orange-50">
                <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-600" />
                  ห้องที่ควรติดตาม
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-gray-500">
                  เรียงตามอัตราการเข้าเรียนจากต่ำไปสูงเพื่อช่วยให้ผู้บริหารเห็นจุดที่ควรสนับสนุนก่อน
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-orange-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold">ห้องเรียน</th>
                        <th className="px-4 py-3 text-center font-bold">สถานะ</th>
                        <th className="px-4 py-3 text-center font-bold">นักเรียนทั้งหมด</th>
                        <th className="px-4 py-3 text-center font-bold text-emerald-700">มา</th>
                        <th className="px-4 py-3 text-center font-bold text-amber-700">สาย</th>
                        <th className="px-4 py-3 text-center font-bold text-blue-700">ลา</th>
                        <th className="px-4 py-3 text-center font-bold text-red-700">ขาด</th>
                        <th className="px-4 py-3 text-right font-bold">% อัตราการเข้าเรียน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classroomSummaries
                        .slice()
                        .sort((a, b) => {
                          if (!a.hasData && !b.hasData) return 0;
                          if (!a.hasData) return 1;
                          if (!b.hasData) return -1;
                          return a.percentage - b.percentage;
                        })
                        .map((item) => (
                          <tr key={item.classroom} className="border-t border-orange-50 hover:bg-orange-50/40">
                            <td className="px-4 py-3 font-semibold text-gray-800">{classroomLabel(item.classroom)}</td>
                            <td className="px-4 py-3 text-center">
                              {item.hasData ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <CheckCircle2 className="h-3 w-3" /> ส่งแล้ว
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                                  <AlertTriangle className="h-3 w-3" /> ยังไม่ส่ง
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-700">
                              {item.hasData ? `${item.totalRecords} คน` : "-"}
                            </td>
                            <td className="px-4 py-3 text-center text-emerald-700 font-semibold">{item.hasData ? item.present : "-"}</td>
                            <td className="px-4 py-3 text-center text-amber-700 font-semibold">{item.hasData ? item.late : "-"}</td>
                            <td className="px-4 py-3 text-center text-blue-700 font-semibold">{item.hasData ? item.leave : "-"}</td>
                            <td className="px-4 py-3 text-center text-red-700 font-semibold">{item.hasData ? item.absent : "-"}</td>
                            <td className="px-4 py-3 text-right font-bold">
                              {item.hasData ? (
                                <span
                                  className={`px-2 py-0.5 rounded-lg ${item.percentage >= 80 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                                    }`}
                                >
                                  {item.percentage}%
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}