"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, Student, UniformCheckRecord, DeductionSettings } from "@/lib/api";
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
  Users,
  Target,
  Calendar,
  X,
  ListChecks,
  UserCheck,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer,
  Download,
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

const RANGE_PRESETS: { value: RangeFilter; label: string; days: number | null }[] = [
  { value: "all", label: "ข้อมูลทั้งหมด", days: null },
  { value: "7d", label: "7 วันที่ผ่านมา", days: 7 },
  { value: "30d", label: "30 วันที่ผ่านมา", days: 30 },
  { value: "custom", label: "กำหนดเอง", days: null },
];

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

interface UniformStudentStat {
  studentId: string;
  studentName: string;
  number: number;
  classroom: string;
  totalChecks: number;
  uniformFails: number;
  hairFails: number;
  nailFails: number;
  totalDeductions: number;
}

export default function UniformStatisticsPage() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<(UniformCheckRecord & { date: string, classroom: string })[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");

  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Deduction settings from database
  const [deductionSettings, setDeductionSettings] = useState<DeductionSettings>({ uniformDeduction: 10, hairDeduction: 10, nailDeduction: 5 });

  // Sort state
  type SortDir = "asc" | "desc";
  interface SortConfig {
    key: string;
    dir: SortDir;
  }

  function SortHeader({
    label,
    sortKey,
    currentSort,
    onSort,
    className = "",
  }: {
    label: string;
    sortKey: string;
    currentSort: SortConfig;
    onSort: (key: string) => void;
    className?: string;
  }) {
    const isActive = currentSort.key === sortKey;
    return (
      <th
        className={`px-4 py-3 cursor-pointer select-none hover:bg-orange-100/50 transition-colors ${className}`}
        onClick={() => onSort(sortKey)}
      >
        <div className="flex items-center gap-1 justify-center">
          <span>{label}</span>
          {isActive ? (
            currentSort.dir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 text-slate-300 shrink-0" />
          )}
        </div>
      </th>
    );
  }

  const [studentSort, setStudentSort] = useState<SortConfig>({ key: "totalDeductions", dir: "desc" });

  const handleStudentSort = (key: string) => {
    setStudentSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  // Load deduction settings from database
  const loadDeductionSettings = useCallback(async () => {
    try {
      const res = await api.getDeductionSettings();
      if (res.success && res.settings) {
        setDeductionSettings(res.settings);
      }
    } catch (err) {
      console.error("Error loading deduction settings:", err);
    }
  }, []);

  useEffect(() => {
    loadDeductionSettings();
  }, [loadDeductionSettings]);

  const [selectedClassroom, setSelectedClassroom] = useState<string>(
    session.role === "admin" ? ALL_CLASSROOMS_VALUE : session.classroomLock || "2/1"
  );

  const isAdmin = session.role === "admin";
  const scopeIsAll = selectedClassroom === ALL_CLASSROOMS_VALUE;
  const effectiveClassroom = selectedClassroom;

  useEffect(() => {
    if (session.role === "admin") {
      setSelectedClassroom(ALL_CLASSROOMS_VALUE);
      return;
    }

    // Teacher defaults to own classroom but can change freely
    if (session.classroomLock) {
      setSelectedClassroom((prev) => {
        if (prev === session.classroomLock) return prev;
        return session.classroomLock || prev;
      });
    }
  }, [session.role, session.classroomLock]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const classroomScope = selectedClassroom;

      const checkRes = await api.getAllUniformChecks(
        classroomScope === ALL_CLASSROOMS_VALUE ? undefined : classroomScope
      );

      if (!checkRes.success) {
        throw new Error("ไม่สามารถดึงข้อมูลการตรวจได้");
      }

      setChecks(checkRes.checks || []);

      if (classroomScope !== ALL_CLASSROOMS_VALUE) {
        const studentsRes = await api.getStudents(classroomScope);
        setStudents(studentsRes.success ? studentsRes.students || [] : []);
      } else {
        const studentsRes = await api.getAllStudents();
        setStudents(studentsRes.success ? studentsRes.students || [] : []);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลสถิติ", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedClassroom, showToast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const filteredChecks = useMemo(() => {
    if (rangeFilter === "all") return checks;

    let cutoffDate: Date | null = null;

    if (rangeFilter === "custom") {
      if (!customStartDate && !customEndDate) return checks;
      return checks.filter((r) => {
        if (customStartDate && r.date < customStartDate) return false;
        if (customEndDate && r.date > customEndDate) return false;
        return true;
      });
    }

    const preset = RANGE_PRESETS.find((p) => p.value === rangeFilter);
    if (!preset || preset.days === null) return checks;

    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - preset.days);
    const cutoffStr = formatDate(cutoffDate);
    return checks.filter((r) => r.date >= cutoffStr);
  }, [checks, rangeFilter, customStartDate, customEndDate]);

  // Overall calculations
  const totalRecords = filteredChecks.length;
  const uniformFails = filteredChecks.filter(r => !r.uniformPass).length;
  const hairFails = filteredChecks.filter(r => !r.hairPass).length;
  const nailFails = filteredChecks.filter(r => !r.nailPass).length;

  const uniformPassRate = totalRecords > 0 ? Math.round(((totalRecords - uniformFails) / totalRecords) * 100) : 0;
  const hairPassRate = totalRecords > 0 ? Math.round(((totalRecords - hairFails) / totalRecords) * 100) : 0;
  const nailPassRate = totalRecords > 0 ? Math.round(((totalRecords - nailFails) / totalRecords) * 100) : 0;

  const totalDeductions = (uniformFails * deductionSettings.uniformDeduction) + (hairFails * deductionSettings.hairDeduction) + (nailFails * deductionSettings.nailDeduction);

  const studentAnalytics = useMemo<UniformStudentStat[]>(() => {
    return students
      .map((student) => {
        const studentChecks = filteredChecks.filter(
          (record) => String(record.studentId).trim() === String(student.studentId).trim()
        );

        const uniformFail = studentChecks.filter(r => !r.uniformPass).length;
        const hairFail = studentChecks.filter(r => !r.hairPass).length;
        const nailFail = studentChecks.filter(r => !r.nailPass).length;

        const deductions = (uniformFail * deductionSettings.uniformDeduction) + (hairFail * deductionSettings.hairDeduction) + (nailFail * deductionSettings.nailDeduction);

        return {
          studentId: student.studentId,
          studentName: student.name,
          number: student.number,
          classroom: student.classroom || effectiveClassroom,
          totalChecks: studentChecks.length,
          uniformFails: uniformFail,
          hairFails: hairFail,
          nailFails: nailFail,
          totalDeductions: deductions,
        };
      })
  }, [filteredChecks, students, effectiveClassroom]);

  // Sorted student analytics for display
  const sortedStudentAnalytics = useMemo(() => {
    const sorted = [...studentAnalytics];
    const { key, dir } = studentSort;
    const mult = dir === "asc" ? 1 : -1;

    sorted.sort((a: any, b: any) => {
      let valA = a[key];
      let valB = b[key];
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return -1 * mult;
      if (valA > valB) return 1 * mult;
      return 0;
    });

    return sorted;
  }, [studentAnalytics, studentSort]);

  const topDeductionStudents = useMemo(() => {
    return studentAnalytics.filter(s => s.totalDeductions > 0).slice(0, 10);
  }, [studentAnalytics]);

  const doughnutData = useMemo(() => {
    return {
      labels: ['การแต่งกาย (ผ่าน)', 'การแต่งกาย (ไม่ผ่าน)'],
      datasets: [
        {
          data: [totalRecords - uniformFails, uniformFails],
          backgroundColor: ["#10b981", "#ef4444"],
          borderColor: ["#ffffff", "#ffffff"],
          borderWidth: 2,
        },
      ],
    };
  }, [totalRecords, uniformFails]);

  const hairDoughnutData = useMemo(() => {
    return {
      labels: ['ทรงผม (ผ่าน)', 'ทรงผม (ไม่ผ่าน)'],
      datasets: [
        {
          data: [totalRecords - hairFails, hairFails],
          backgroundColor: ["#10b981", "#ef4444"],
          borderColor: ["#ffffff", "#ffffff"],
          borderWidth: 2,
        },
      ],
    };
  }, [totalRecords, hairFails]);

  const nailDoughnutData = useMemo(() => {
    return {
      labels: ['เล็บมือ (ผ่าน)', 'เล็บมือ (ไม่ผ่าน)'],
      datasets: [
        {
          data: [totalRecords - nailFails, nailFails],
          backgroundColor: ["#10b981", "#ef4444"],
          borderColor: ["#ffffff", "#ffffff"],
          borderWidth: 2,
        },
      ],
    };
  }, [totalRecords, nailFails]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          font: { family: "var(--font-noto-thai), sans-serif", weight: "bold" as const, size: 10 },
          padding: 10,
        },
      },
    },
  };

  const barData = useMemo(() => {
    return {
      labels: topDeductionStudents.map((item) => scopeIsAll ? `${item.studentName} (${item.classroom})` : `#${item.number} ${item.studentName}`),
      datasets: [
        {
          label: "คะแนนที่ถูกหักรวม",
          data: topDeductionStudents.map((item) => item.totalDeductions),
          backgroundColor: "rgba(239, 68, 68, 0.85)",
          borderColor: "#ffffff",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [topDeductionStudents, scopeIsAll]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0, 0, 0, 0.05)" },
          ticks: {
            font: { family: "var(--font-noto-thai), sans-serif", weight: "bold" as const },
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "var(--font-noto-thai), sans-serif", weight: "bold" as const, size: 10 },
          },
        },
      },
      plugins: {
        legend: { display: false },
      },
    };
  }, []);

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
      const fileBase = `uniform_statistics_${rangeLabel}_${safeFileName(scopeLabel)}`;

      if (!scopeIsAll) {
        const rows = sortedStudentAnalytics.map((item) => ({
          "ห้อง": classroomLabel(item.classroom),
          "เลขที่": item.number,
          "นักเรียน": item.studentName,
          "รหัสนักเรียน": item.studentId,
          "ตรวจ(ครั้ง)": item.totalChecks,
          "แต่งกาย(ไม่ผ่าน)": item.uniformFails,
          "ทรงผม(ไม่ผ่าน)": item.hairFails,
          "เล็บมือ(ไม่ผ่าน)": item.nailFails,
          "คะแนนที่ถูกหักรวม": item.totalDeductions,
        }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Student Stats");
        XLSX.writeFile(wb, safeFileName(`${fileBase}.xlsx`));
        showToast("Export Excel สำเร็จ (สถิติระเบียบวินัยรายนักเรียน)", "success", 2500);
        return;
      }

      const classroomStats = CLASSROOMS.map((cls) => {
        const clsChecks = filteredChecks.filter(r => r.classroom === cls);
        const clsStudents = students.filter(s => s.classroom === cls);
        const uniformFails = clsChecks.filter(r => !r.uniformPass).length;
        const hairFails = clsChecks.filter(r => !r.hairPass).length;
        const nailFails = clsChecks.filter(r => !r.nailPass).length;
        const totalDeductions = (uniformFails * deductionSettings.uniformDeduction) + (hairFails * deductionSettings.hairDeduction) + (nailFails * deductionSettings.nailDeduction);
        return {
          "ห้องเรียน": classroomLabel(cls),
          "จำนวนนักเรียน": clsStudents.length,
          "ตรวจ(ครั้ง)": clsChecks.length,
          "แต่งกาย(ไม่ผ่าน)": uniformFails,
          "ทรงผม(ไม่ผ่าน)": hairFails,
          "เล็บมือ(ไม่ผ่าน)": nailFails,
          "คะแนนที่ถูกหักรวม": totalDeductions,
        };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classroomStats), "Classroom Stats");
      XLSX.writeFile(wb, safeFileName(`${fileBase}.xlsx`));
      showToast("Export Excel สำเร็จ (สถิติระเบียบวินัยรายห้อง)", "success", 2500);
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || "Export Excel ไม่สำเร็จ", "error");
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-orange-950 flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-orange-600" /> สถิติระเบียบวินัย
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            {scopeIsAll
              ? "ดูภาพรวมทั้งโรงเรียน และระบุนักเรียนที่มีการหักคะแนนบ่อยที่สุด"
              : `สถิติการตรวจระเบียบวินัยเฉพาะ ${classroomLabel(effectiveClassroom)}`}
          </p>
        </div>
      </div>

      <Card className="border-orange-100 shadow-sm rounded-3xl">
        <CardContent className="p-5 flex flex-col lg:flex-row items-end gap-4">
          <div className="w-full lg:w-72">
            <Select
              label="ห้องเรียน"
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
              disabled={false}
              options={isAdmin ? classroomOptions(true) : classroomOptions(false)}
            />
          </div>

          <div className="w-full lg:w-56">
            <Select
              label="ช่วงเวลา"
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
                </div>
              </div>
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
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-orange-100 shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-2" />
          <span className="text-gray-500 text-xs font-semibold">กำลังวิเคราะห์ข้อมูล...</span>
        </div>
      ) : filteredChecks.length === 0 ? (
        <Card className="border-orange-100 bg-orange-50/10 rounded-3xl">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <Info className="h-10 w-10 text-orange-400" />
            <div>
              <h3 className="font-bold text-orange-950 text-base">ไม่พบข้อมูลในระบบ</h3>
              <p className="text-gray-500 text-xs mt-1">
                กรุณาลงบันทึกการตรวจระเบียบวินัยก่อนเพื่อประมวลผลกราฟ
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-orange-100 shadow-sm rounded-3xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500">จำนวนการตรวจทั้งหมด</p>
                  <h3 className="text-2xl font-bold text-orange-950 mt-1">
                    {totalRecords === 0 ? "ไม่พบข้อมูล" : `${totalRecords} ครั้ง`}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-100 shadow-sm rounded-3xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500">อัตราผ่านการแต่งกาย</p>
                  <h3 className="text-2xl font-bold text-orange-950 mt-1">
                    {totalRecords === 0 ? "ไม่พบข้อมูล" : `${uniformPassRate}%`}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-100 shadow-sm rounded-3xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500">อัตราผ่านทรงผม</p>
                  <h3 className="text-2xl font-bold text-orange-950 mt-1">
                    {totalRecords === 0 ? "ไม่พบข้อมูล" : `${hairPassRate}%`}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-100 shadow-sm rounded-3xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500">ยอดหักคะแนนรวม</p>
                  <h3 className="text-2xl font-bold text-orange-950 mt-1">
                    {totalRecords === 0 ? "ไม่พบข้อมูล" : totalDeductions}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-orange-100 shadow-sm rounded-3xl flex flex-col bg-white">
              <CardHeader className="border-b border-orange-50">
                <CardTitle className="text-orange-950 font-bold text-sm text-center">สัดส่วนการแต่งกาย</CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex-grow flex justify-center">
                <div className="relative h-48 w-full">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-100 shadow-sm rounded-3xl flex flex-col bg-white">
              <CardHeader className="border-b border-orange-50">
                <CardTitle className="text-orange-950 font-bold text-sm text-center">สัดส่วนทรงผม</CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex-grow flex justify-center">
                <div className="relative h-48 w-full">
                  <Doughnut data={hairDoughnutData} options={doughnutOptions} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-100 shadow-sm rounded-3xl flex flex-col bg-white">
              <CardHeader className="border-b border-orange-50">
                <CardTitle className="text-orange-950 font-bold text-sm text-center">สัดส่วนเล็บมือ</CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex-grow flex justify-center">
                <div className="relative h-48 w-full">
                  <Doughnut data={nailDoughnutData} options={doughnutOptions} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-orange-100 shadow-sm rounded-3xl bg-white flex flex-col">
            <CardHeader className="border-b border-orange-50">
              <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-orange-600" />
                นักเรียนที่ถูกหักคะแนนสูงสุด 10 อันดับ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {topDeductionStudents.length > 0 ? (
                <div className="h-64 w-full">
                  <Bar data={barData} options={barOptions} />
                </div>
              ) : (
                <div className="h-64 w-full flex items-center justify-center text-gray-500 font-bold">
                  ไม่มีนักเรียนที่ถูกหักคะแนน
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-100 shadow-sm overflow-hidden rounded-3xl">
            <CardHeader className="border-b border-orange-50">
              <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-600" />
                ตารางสรุปรายนักเรียน
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-orange-50 text-gray-700">
                    <tr>
                      <SortHeader label="ห้อง" sortKey="classroom" currentSort={studentSort} onSort={handleStudentSort} className="text-left" />
                      <SortHeader label="เลขที่" sortKey="number" currentSort={studentSort} onSort={handleStudentSort} className="text-left" />
                      <SortHeader label="นักเรียน" sortKey="studentName" currentSort={studentSort} onSort={handleStudentSort} className="text-left" />
                      <SortHeader label="ตรวจ(ครั้ง)" sortKey="totalChecks" currentSort={studentSort} onSort={handleStudentSort} className="text-center" />
                      <SortHeader label="แต่งกาย(ไม่ผ่าน)" sortKey="uniformFails" currentSort={studentSort} onSort={handleStudentSort} className="text-center" />
                      <SortHeader label="ทรงผม(ไม่ผ่าน)" sortKey="hairFails" currentSort={studentSort} onSort={handleStudentSort} className="text-center" />
                      <SortHeader label="เล็บมือ(ไม่ผ่าน)" sortKey="nailFails" currentSort={studentSort} onSort={handleStudentSort} className="text-center" />
                      <SortHeader label="คะแนนที่ถูกหักรวม" sortKey="totalDeductions" currentSort={studentSort} onSort={handleStudentSort} className="text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedStudentAnalytics.map((student) => (
                      <tr key={student.studentId} className="hover:bg-orange-50/10">
                        <td className="px-4 py-3 text-gray-500">{student.classroom}</td>
                        <td className="px-4 py-3 font-semibold text-gray-500">{student.number}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{student.studentName}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{student.totalChecks}</td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {student.uniformFails > 0 ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold text-xs">{student.uniformFails}</span>
                          ) : "0"}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {student.hairFails > 0 ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold text-xs">{student.hairFails}</span>
                          ) : "0"}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {student.nailFails > 0 ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold text-xs">{student.nailFails}</span>
                          ) : "0"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">
                          {student.totalDeductions > 0 ? `-${student.totalDeductions}` : "0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
