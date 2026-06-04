"use client";

import React, { useState, useMemo } from "react";
import { api, AttendanceRecord } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Search, GraduationCap, Calendar, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

// Chart.js imports
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function StudentPortalPage() {
  const { logout } = useAuth();
  const { showToast } = useToast();
  
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Search logic
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) {
      showToast("กรุณากรอกรหัสนักเรียน", "warning");
      return;
    }

    setLoading(true);
    try {
      // Fetch all attendance records
      const res = await api.getAttendance();
      if (!res.success) {
        throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
      }

      // Filter for this student ID
      const targetId = studentId.trim();
      const filtered = (res.attendance || []).filter(
        (r) => String(r.studentId).trim() === targetId
      );

      setRecords(filtered);
      setHasSearched(true);

      if (filtered.length === 0) {
        showToast("ไม่พบประวัติการเข้าเรียนของรหัสนี้", "info");
      } else {
        showToast("ค้นหาข้อมูลสำเร็จ", "success");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการค้นหา", "error");
    } finally {
      setLoading(false);
    }
  };

  // Student Info from first record
  const studentInfo = useMemo(() => {
    if (records.length === 0) return null;
    const first = records[0];
    return {
      name: first.studentName,
      classroom: first.classroom,
      id: first.studentId,
    };
  }, [records]);

  // Breakdown status math
  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let leave = 0;
    let absent = 0;

    records.forEach((r) => {
      if (r.status === "มา") present++;
      else if (r.status === "สาย") late++;
      else if (r.status === "ลา") leave++;
      else if (r.status === "ขาด") absent++;
    });

    const total = records.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { present, late, leave, absent, total, rate };
  }, [records]);

  // Chart JS setup
  const chartData = useMemo(() => {
    return {
      labels: ["มาเรียน", "มาสาย", "ลา", "ขาดเรียน"],
      datasets: [
        {
          data: [stats.present, stats.late, stats.leave, stats.absent],
          backgroundColor: [
            "#10b981", // Emerald-500
            "#f59e0b", // Amber-500
            "#3b82f6", // Blue-500
            "#ef4444", // Red-500
          ],
          borderColor: ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
          borderWidth: 2,
        },
      ],
    };
  }, [stats]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          font: {
            family: "var(--font-noto-thai), sans-serif",
            weight: "bold" as const,
            size: 11,
          },
          padding: 10,
        },
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 to-orange-100/30 p-4 flex flex-col items-center justify-center">
      
      {/* Top Navbar */}
      <div className="max-w-2xl w-full flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-orange-600" />
          <div>
            <h1 className="font-bold text-orange-950 text-base">ระบบสืบค้นข้อมูลนักเรียน</h1>
            <p className="text-[10px] text-gray-500 font-semibold">ค้นหาประวัติการเช็คชื่อเข้าเรียน</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1 text-xs font-bold text-red-600 bg-white hover:bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-[0.98]"
        >
          <LogOut className="h-3.5 w-3.5" /> กลับหน้าหลัก
        </button>
      </div>

      {/* Main card */}
      <Card className="max-w-2xl w-full shadow-md border-orange-100 hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="bg-orange-500 text-white p-6 relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-orange-600"></div>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
  <GraduationCap className="h-6 w-6" />
  ตรวจสอบสถิติการมาเรียนสำหรับนักเรียน
</CardTitle>
          <CardDescription className="text-orange-100 mt-1 font-semibold text-xs">
            กรอกรหัสประจำตัวนักเรียนเพื่อประมวลผลสถิติส่วนตัว
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {/* Search form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-grow">
              <Input
                placeholder="กรอกรหัสประจำตัว เช่น 1001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={loading}
                className="text-center font-mono font-bold tracking-widest"
              />
            </div>
            <Button type="submit" loading={loading} className="px-6 font-bold h-10">
              <Search className="h-4 w-4" /> ค้นหา
            </Button>
          </form>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-2"></div>
              <span className="text-gray-400 text-xs font-bold">กำลังประมวลผลสถิติ...</span>
            </div>
          ) : hasSearched && records.length === 0 ? (
            <div className="p-8 text-center text-gray-500 bg-orange-50/30 border border-orange-100 rounded-2xl flex flex-col items-center gap-2 font-semibold text-xs">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <span>ไม่พบข้อมูลประวัติรหัสนักเรียน "{studentId}"</span>
              <p className="font-medium text-gray-400 max-w-xs">โปรดตรวจสอบความถูกต้องของรหัส หรือติดต่อครูประจำชั้นหากยังไม่มีการเช็คชื่อ</p>
            </div>
          ) : hasSearched && studentInfo ? (
            <div className="space-y-6">
              
              {/* Profile Card */}
              <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-gray-500">ชื่อนักเรียน</span>
                  <h4 className="text-lg font-bold text-orange-950 mt-0.5">{studentInfo.name}</h4>
                </div>
                <div className="flex gap-6">
                  <div>
                    <span className="text-xs font-bold text-gray-500">ชั้นเรียน</span>
                    <p className="font-bold text-gray-800 text-sm mt-0.5">ห้องเรียน {studentInfo.classroom}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-500">รหัสประจำตัว</span>
                    <p className="font-mono font-bold text-gray-800 text-sm mt-0.5">{studentInfo.id}</p>
                  </div>
                </div>
              </div>

              {/* Data Widgets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                
                <div className="bg-white border border-orange-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-600 block">มาเรียน</span>
                  <span className="text-xl font-bold text-emerald-700 mt-1 block">{stats.present} วัน</span>
                </div>
                
                <div className="bg-white border border-orange-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-500 block">มาสาย</span>
                  <span className="text-xl font-bold text-amber-600 mt-1 block">{stats.late} วัน</span>
                </div>

                <div className="bg-white border border-orange-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-500 block">ลากิจ/ป่วย</span>
                  <span className="text-xl font-bold text-blue-600 mt-1 block">{stats.leave} วัน</span>
                </div>

                <div className="bg-white border border-orange-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-red-500 block">ขาดเรียน</span>
                  <span className="text-xl font-bold text-red-600 mt-1 block">{stats.absent} วัน</span>
                </div>

              </div>

              {/* Chart & Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
                
                <div className="relative h-48 w-full">
                  <Doughnut data={chartData} options={chartOptions} />
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl text-center">
                    <span className="text-xs font-bold text-gray-500 block">ร้อยละการเข้าเรียนเฉลี่ย</span>
                    <span className={`text-4xl font-extrabold mt-1 block ${
                      stats.rate >= 80 ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {stats.rate}%
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1 block font-semibold">
                      (เช็คชื่อทั้งหมด {stats.total} ครั้ง • รวม มา และ สาย)
                    </span>
                  </div>
                  
                  {stats.rate < 80 && stats.total > 0 && (
                    <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-900 text-xs font-bold">
                      <AlertTriangle className="h-4.5 w-4.5 text-red-500 flex-shrink-0" />
                      <span>หมายเหตุ: อัตราการเข้าเรียนต่ำกว่าเกณฑ์ 80% โปรดระมัดระวังและปรับปรุงการมาเรียน</span>
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 text-xs font-bold flex flex-col items-center gap-1.5">
              <GraduationCap className="h-10 w-10 text-orange-200" />
              <p>กรอกรหัสของคุณเพื่อตรวจเช็คสถิติประวัติส่วนตัว</p>
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
}
