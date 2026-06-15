"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api, AttendanceRecord } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CheckCircle2, XCircle, RefreshCw, ClipboardList, Clock, Filter } from "lucide-react";

const CLASSROOMS = [
  "2/1", "2/2", "2/3", "2/4",
  "3/1", "3/2", "3/3", "3/4",
  "4/1", "4/2", "4/3", "4/4", "4/5",
  "5/1", "5/2", "5/3", "5/4", "5/5",
  "6/1", "6/2", "6/3", "6/4", "6/5"
];

interface ClassroomCheckStatus {
  classroom: string;
  checked: boolean;
  count: number;
  time: string | null;
}

export default function TeacherStatusPage() {
  const { showToast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const res = await api.getAttendance(undefined, selectedDate);
      if (res.success) {
        setRecords(res.attendance || []);
      } else {
        throw new Error("ไม่สามารถดึงข้อมูลสถานะการเช็คชื่อได้");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    loadStatus();
  }, [selectedDate, loadStatus]);

  // Compute status for all classrooms
  const classroomStatusList = useMemo((): ClassroomCheckStatus[] => {
    return CLASSROOMS.map((cls) => {
      const clsRecords = records.filter((r) => r.classroom === cls);
      const checked = clsRecords.length > 0;

      let time: string | null = null;
      if (checked && clsRecords[0].timestamp) {
        try {
          const dateObj = new Date(clsRecords[0].timestamp);
          const hours = String(dateObj.getHours()).padStart(2, "0");
          const minutes = String(dateObj.getMinutes()).padStart(2, "0");
          time = `${hours}:${minutes} น.`;
        } catch (e) {
          time = null;
        }
      }

      return {
        classroom: cls,
        checked,
        count: clsRecords.length,
        time,
      };
    });
  }, [records]);

  // Filtered list
  const filteredList = useMemo(() => {
    if (filterPendingOnly) {
      return classroomStatusList.filter((item) => !item.checked);
    }
    return classroomStatusList;
  }, [classroomStatusList, filterPendingOnly]);

  const summary = useMemo(() => {
    const total = CLASSROOMS.length;
    const completed = classroomStatusList.filter((item) => item.checked).length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [classroomStatusList]);

  return (
    <div className="space-y-6">

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-orange-950 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-orange-600" /> สถานะการส่งเช็คชื่อประจำวัน
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            ตรวจการเข้าทำการบันทึกเช็คชื่อของครูประจำชั้นแต่ละห้องเรียน (เช็คก่อนเรียน)
          </p>
        </div>
      </div>

      {/* Date Select & Filter controls */}
      <Card className="border-orange-100 shadow-sm bg-white">
        <CardContent className="p-5 flex flex-col md:flex-row items-end justify-between gap-4">

          <div className="flex flex-wrap items-end gap-3 w-full md:w-auto">
            {/* Date selector */}
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 block">วันที่ตรวจสอบ</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setFilterPendingOnly(!filterPendingOnly)}
              className={`h-10 px-4 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 active:scale-[0.98] ${filterPendingOnly
                  ? "bg-orange-500 border-orange-600 text-white shadow-sm"
                  : "bg-white border-orange-200 text-gray-700 hover:bg-orange-50"
                }`}
            >
              <Filter className="h-4 w-4" />
              <span>แสดงเฉพาะห้องที่ยังไม่เช็ค ({summary.pending})</span>
            </button>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={loadStatus}
              disabled={loading}
              className="px-4 border-orange-200 flex-grow md:flex-grow-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> รีเฟรช
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Status summary widgets */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-white border border-orange-100 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-gray-500 block">ห้องเรียนทั้งหมด</span>
          <span className="text-2xl font-extrabold text-orange-950 mt-1 block">{summary.total} ห้อง</span>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-emerald-600 block">เช็คชื่อแล้ว</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">{summary.completed} ห้อง</span>
        </div>
        <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-red-500 block">ยังไม่เช็ค</span>
          <span className="text-2xl font-extrabold text-red-700 mt-1 block">{summary.pending} ห้อง</span>
        </div>
      </div>

      {/* Classroom Status Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-orange-100 shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-2"></div>
          <span className="text-gray-500 text-xs font-semibold">กำลังดึงข้อมูลสถานะการส่ง...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <Card className="border-orange-100 bg-orange-50/10">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <div>
              <h3 className="font-bold text-orange-950 text-base">อาจารย์ทุกห้องส่งเช็คชื่อครบถ้วนแล้ว!</h3>
              <p className="text-gray-500 text-xs mt-1">
                การเช็คชื่อรอบเช้าเสร็จสมบูรณ์เรียบร้อยแล้ว
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredList.map((item) => (
            <div
              key={item.classroom}
              className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between min-h-[110px] transition-all hover:-translate-y-0.5 duration-150 ${item.checked
                  ? "bg-emerald-50/20 border-emerald-100 text-emerald-950"
                  : "bg-white border-orange-100 text-gray-800"
                }`}
            >
              <div>
                <span className="text-xs font-bold text-gray-500 block">ห้องเรียน</span>
                <h4 className="text-lg font-extrabold text-orange-950 mt-0.5">{item.classroom}</h4>
              </div>

              <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-dashed border-gray-100">
                {item.checked ? (
                  <>
                    <span className="inline-flex items-center gap-0.5 text-xs text-emerald-700 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5 fill-emerald-100" /> เช็คแล้ว ({item.count})
                    </span>
                    {item.time && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 font-semibold">
                        <Clock className="h-2.5 w-2.5" /> {item.time}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-bold">
                    <XCircle className="h-3.5 w-3.5 fill-red-50 font-bold" /> ยังไม่เช็คชื่อ
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
