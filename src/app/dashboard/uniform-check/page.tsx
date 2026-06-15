"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, UniformCheckRecord } from "@/lib/api";
import { CLASSROOMS, classroomOptions } from "@/lib/classrooms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Calendar as CalendarIcon, RefreshCw, AlertCircle, UserCheck, Save } from "lucide-react";

export default function UniformCheckPage() {
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
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDate());
  const [teacherName, setTeacherName] = useState("");

  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<UniformCheckRecord[]>([]);
  const isTeacher = session.role === "teacher";
  const activeClassroom = selectedClassroom;

  const todayDate = useMemo(() => getTodayDate(), []);

  const loadData = useCallback(async () => {
    if (!activeClassroom || !selectedDate) return;
    setLoading(true);
    setStudents([]);
    try {
      const [studentRes, checkRes] = await Promise.all([
        api.getStudents(activeClassroom),
        api.getUniformCheck(activeClassroom, selectedDate),
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

      const records = checkRes.success ? checkRes.checks : [];
      if (checkRes.success && checkRes.teacherName) {
        setTeacherName(checkRes.teacherName);
      }

      const recordByStudentId = new Map<string, UniformCheckRecord>();
      for (const r of records) {
        recordByStudentId.set(String(r.studentId), r);
      }

      const mappedStudents: UniformCheckRecord[] = classroomStudents
        .map((s) => {
          const record = recordByStudentId.get(String(s.studentId));
          return {
            studentId: s.studentId,
            studentName: s.name,
            uniformPass: record?.uniformPass ?? null,
            uniformReason: record?.uniformReason || "",
            hairPass: record?.hairPass ?? null,
            hairReason: record?.hairReason || "",
            nailPass: record?.nailPass ?? null,
            nailReason: record?.nailReason || "",
            number: s.number || 99,
          };
        })
        .sort((a: any, b: any) => a.number - b.number);

      setStudents(mappedStudents);

    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
    } finally {
      setLoading(false);
    }
  }, [activeClassroom, selectedDate, showToast]);

  useEffect(() => {
    loadData();
  }, [selectedClassroom, selectedDate, loadData]);

  // Empty out the useEffect that was here for tab switching

  const updateStudent = (studentId: string, field: keyof UniformCheckRecord, value: any) => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, [field]: value } : s));
  };

  const editable = true;

  const handleSave = async () => {
    if (students.length === 0) {
      showToast("ไม่มีข้อมูลนักเรียนสำหรับบันทึก", "warning");
      return;
    }

    if (!teacherName.trim()) {
      showToast("กรุณาระบุชื่ออาจารย์ผู้ตรวจ", "warning");
      return;
    }

    const incomplete = students.some(s => s.uniformPass === null || s.hairPass === null || s.nailPass === null);
    if (incomplete) {
      showToast("กรุณาตรวจเครื่องแต่งกายให้ครบทุกคนก่อนบันทึก", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await api.saveUniformCheck(selectedClassroom, selectedDate, teacherName.trim(), students);
      if (res.success) {
        showToast(`บันทึกข้อมูลการตรวจเครื่องแต่งกายห้อง ${selectedClassroom} สำเร็จ!`, "success", 0, "modal");
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-orange-950 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-orange-600" /> ตรวจเครื่องแต่งกาย
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            ตรวจการแต่งกาย ทรงผม และเล็บมือ
          </p>
        </div>
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
                วันที่ตรวจ
              </label>
              <input
                type="date"
                value={selectedDate}
                max={todayDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-11 w-full rounded-full border border-orange-200 bg-white px-4 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              />
            </div>

            <div className="w-full md:w-64 space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 block">
                อาจารย์ผู้ตรวจ *
              </label>
              <input
                type="text"
                placeholder="ระบุชื่ออาจารย์ *"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                disabled={!editable}
                className="h-11 w-full rounded-full border border-orange-200 bg-white px-4 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              />
            </div>

            <div className="w-full md:w-auto flex gap-2">
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

      {/* Check List */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-orange-100 shadow-sm p-6 sm:p-8 space-y-5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
            <div className="h-4 w-48 rounded-full bg-orange-100" />
          </div>
        </div>
      ) : students.length === 0 ? (
        <Card className="border-orange-200 bg-orange-50/20">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <AlertCircle className="h-10 w-10 text-orange-500" />
            <div>
              <h3 className="font-bold text-orange-950 text-base">ไม่พบข้อมูลนักเรียนของห้อง {selectedClassroom}</h3>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student: any) => (
              <div
                key={student.studentId}
                className="bg-white p-5 rounded-3xl border border-orange-100 shadow-sm space-y-4"
              >
                <div className="flex items-center gap-3 border-b border-orange-50 pb-3">
                  <span className="flex items-center justify-center h-10 w-10 bg-orange-100 text-orange-800 rounded-full font-bold text-sm">
                    {student.number}
                  </span>
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">{student.studentName}</h4>
                    <span className="text-xs font-mono text-gray-400 font-semibold">{student.studentId}</span>
                  </div>
                </div>

                {/* Uniform */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">1. การแต่งกาย</span>
                    <div className="relative flex items-center p-1 rounded-full w-32 bg-gray-100">
                      <div
                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 ease-in-out ${student.uniformPass === true
                          ? 'bg-emerald-500 translate-x-0 left-1 opacity-100'
                          : student.uniformPass === false
                            ? 'bg-red-500 translate-x-[calc(100%+4px)] left-1 opacity-100'
                            : 'opacity-0 left-1'
                          }`}
                      />
                      <button
                        disabled={!editable}
                        onClick={() => {
                          updateStudent(student.studentId, 'uniformPass', true);
                          updateStudent(student.studentId, 'uniformReason', '');
                        }}
                        className={`relative z-10 w-1/2 text-xs font-bold py-1.5 transition-colors duration-300 ${student.uniformPass === true ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        ผ่าน
                      </button>
                      <button
                        disabled={!editable}
                        onClick={() => updateStudent(student.studentId, 'uniformPass', false)}
                        className={`relative z-10 w-1/2 text-xs font-bold py-1.5 transition-colors duration-300 ${student.uniformPass === false ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        ไม่ผ่าน
                      </button>
                    </div>
                  </div>
                  {student.uniformPass === false && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <input
                        type="text"
                        placeholder="ระบุสาเหตุที่ไม่ผ่าน..."
                        disabled={!editable}
                        value={student.uniformReason}
                        onChange={(e) => updateStudent(student.studentId, 'uniformReason', e.target.value)}
                        className="w-full text-sm p-2 border border-red-200 rounded-xl bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-400 transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Hair */}
                <div className="space-y-2 pt-1 border-t border-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">2. ทรงผม</span>
                    <div className="relative flex items-center p-1 rounded-full w-32 bg-gray-100">
                      <div
                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 ease-in-out ${student.hairPass === true
                          ? 'bg-emerald-500 translate-x-0 left-1 opacity-100'
                          : student.hairPass === false
                            ? 'bg-red-500 translate-x-[calc(100%+4px)] left-1 opacity-100'
                            : 'opacity-0 left-1'
                          }`}
                      />
                      <button
                        disabled={!editable}
                        onClick={() => {
                          updateStudent(student.studentId, 'hairPass', true);
                          updateStudent(student.studentId, 'hairReason', '');
                        }}
                        className={`relative z-10 w-1/2 text-xs font-bold py-1.5 transition-colors duration-300 ${student.hairPass === true ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        ผ่าน
                      </button>
                      <button
                        disabled={!editable}
                        onClick={() => updateStudent(student.studentId, 'hairPass', false)}
                        className={`relative z-10 w-1/2 text-xs font-bold py-1.5 transition-colors duration-300 ${student.hairPass === false ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        ไม่ผ่าน
                      </button>
                    </div>
                  </div>
                  {student.hairPass === false && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <input
                        type="text"
                        placeholder="ระบุสาเหตุที่ไม่ผ่าน..."
                        disabled={!editable}
                        value={student.hairReason}
                        onChange={(e) => updateStudent(student.studentId, 'hairReason', e.target.value)}
                        className="w-full text-sm p-2 border border-red-200 rounded-xl bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-400 transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Nails */}
                <div className="space-y-2 pt-1 border-t border-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">3. เล็บมือ</span>
                    <div className="relative flex items-center p-1 rounded-full w-32 bg-gray-100">
                      <div
                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 ease-in-out ${student.nailPass === true
                          ? 'bg-emerald-500 translate-x-0 left-1 opacity-100'
                          : student.nailPass === false
                            ? 'bg-red-500 translate-x-[calc(100%+4px)] left-1 opacity-100'
                            : 'opacity-0 left-1'
                          }`}
                      />
                      <button
                        disabled={!editable}
                        onClick={() => {
                          updateStudent(student.studentId, 'nailPass', true);
                          updateStudent(student.studentId, 'nailReason', '');
                        }}
                        className={`relative z-10 w-1/2 text-xs font-bold py-1.5 transition-colors duration-300 ${student.nailPass === true ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        ผ่าน
                      </button>
                      <button
                        disabled={!editable}
                        onClick={() => updateStudent(student.studentId, 'nailPass', false)}
                        className={`relative z-10 w-1/2 text-xs font-bold py-1.5 transition-colors duration-300 ${student.nailPass === false ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        ไม่ผ่าน
                      </button>
                    </div>
                  </div>
                  {student.nailPass === false && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <input
                        type="text"
                        placeholder="ระบุสาเหตุที่ไม่ผ่าน..."
                        disabled={!editable}
                        value={student.nailReason}
                        onChange={(e) => updateStudent(student.studentId, 'nailReason', e.target.value)}
                        className="w-full text-sm p-2 border border-red-200 rounded-xl bg-red-50 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Save Bar */}
          <div className="flex justify-end gap-2 bg-white p-4 rounded-3xl border border-orange-100 shadow-sm sticky bottom-4">
            <Button
              onClick={handleSave}
              disabled={loading || students.length === 0}
              className="h-11 px-8 text-base font-bold rounded-full shadow-md shadow-orange-100"
              loading={loading}
            >
              <Save className="h-4.5 w-4.5" /> บันทึกข้อมูล
            </Button>
          </div>

        </div>
      )}
    </div>
  );
}
