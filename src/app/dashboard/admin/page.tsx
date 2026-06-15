"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, Student } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Upload, Plus, Trash2, Save, Download, RefreshCw, FileSpreadsheet, Settings, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

const CLASSROOMS = [
  "2/1", "2/2", "2/3", "2/4",
  "3/1", "3/2", "3/3", "3/4",
  "4/1", "4/2", "4/3", "4/4", "4/5",
  "5/1", "5/2", "5/3", "5/4", "5/5",
  "6/1", "6/2", "6/3", "6/4", "6/5"
];

const normalizeSheetNameToClassroom = (sheetName: string): string | null => {
  const trimmed = sheetName.trim();

  if (CLASSROOMS.includes(trimmed)) {
    return trimmed;
  }

  const compact = trimmed.replace(/\s+/g, "");
  const slashMatch = compact.match(/^([2-6])\/([1-5])$/);
  if (slashMatch) {
    const classroom = `${slashMatch[1]}/${slashMatch[2]}`;
    return CLASSROOMS.includes(classroom) ? classroom : null;
  }

  const digitsOnly = compact.replace(/\D/g, "");
  if (digitsOnly.length === 2) {
    const classroom = `${digitsOnly[0]}/${digitsOnly[1]}`;
    return CLASSROOMS.includes(classroom) ? classroom : null;
  }

  return null;
};

const normalizeHeader = (key: string) =>
  key
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");

const matchesHeader = (key: string, patterns: RegExp[]) => {
  const normalized = normalizeHeader(key);
  return patterns.some((pattern) => pattern.test(normalized) || pattern.test(key));
};

const parseCellValue = (value: any) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value).trim() : "";
  return String(value).replace(/^\uFEFF/, "").trim();
};

const parseExcelRow = (
  row: Record<string, any>,
  fallbackNumber: number,
  headerMap: Record<string, string | null>
): Student | null => {
  const studentId = parseCellValue(
    headerMap.studentId ? row[headerMap.studentId] : row["เลขประจำตัว"] ?? row["รหัสประจำตัว"] ?? row["รหัสนักเรียน"]
  );
  const name = parseCellValue(
    headerMap.name ? row[headerMap.name] : row["ชื่อ - สกุล"] ?? row["ชื่อ-สกุล"] ?? row["ชื่อ"] ?? row["ชื่อ-นามสกุล"]
  );
  const numberValue = parseCellValue(
    headerMap.number ? row[headerMap.number] : row["เลขที่"] ?? row["ลำดับ"] ?? fallbackNumber
  );
  const parsedNumber = Number(numberValue);
  const number = Number.isFinite(parsedNumber) ? parsedNumber : fallbackNumber;

  if (!studentId || !name) return null;

  // Classroom is derived from the sheet name because Excel often auto-formats
  // the "ชั้น" column as a date (for example 2/1 -> 2026-01-01T17:00:00.000Z).
  // The workbook's sheet name is the reliable classroom source.
  return { studentId, name, number };
};

const buildHeaderMap = (headerRow: any[]): Record<string, string | null> => {
  const map: Record<string, string | null> = {
    studentId: null,
    number: null,
    name: null,
    classroom: null,
  };

  headerRow.forEach((header, index) => {
    const key = typeof header === "string" ? header : String(header ?? "");
    if (!key) return;

    const column = XLSX.utils.encode_col(index);
    if (matchesHeader(key, [/เลขประจำตัว/, /รหัสประจำตัว/, /รหัสนักเรียน/, /studentid/, /id/])) {
      map.studentId = column;
    } else if (matchesHeader(key, [/เลขที่/, /number/, /no/, /ลำดับ/])) {
      map.number = column;
    } else if (matchesHeader(key, [/ชื่อ.*สกุล/, /ชื่อ-สกุล/, /ชื่อนามสกุล/, /fullname/, /name/, /ชื่อ/])) {
      map.name = column;
    } else if (matchesHeader(key, [/ชั้น/, /classroom/, /ห้อง/])) {
      map.classroom = column;
    }
  });

  return map;
};

export default function AdminPage() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<"classroom" | "all">("classroom");
  const [selectedClassroom, setSelectedClassroom] = useState<string>("2/1");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [classroomStudents, setClassroomStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Array<Student & { classroom: string }>>([]);

  // Excel preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewByClassroom, setPreviewByClassroom] = useState<Record<string, Student[]>>({});
  const [previewSkippedSheets, setPreviewSkippedSheets] = useState<string[]>([]);
  const [previewEmptySheets, setPreviewEmptySheets] = useState<string[]>([]);



  // Settings
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>("");

  // Modals & Forms
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    name: "",
    number: "",
    classroom: "2/1",
  });



  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isDeleteAllStudentsOpen, setIsDeleteAllStudentsOpen] = useState(false);
  const [isDeleteAllAttendanceOpen, setIsDeleteAllAttendanceOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load spreadsheet URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSpreadsheetUrl(localStorage.getItem("google_spreadsheet_url") || "");
    }
  }, []);

  const saveSpreadsheetUrl = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("google_spreadsheet_url", spreadsheetUrl);
      showToast("บันทึกลิงก์ Google Sheets เรียบร้อยแล้ว", "success");
    }
  };

  // Load student list
  const loadStudents = useCallback(async () => {
    if (!selectedClassroom) return;
    setLoading(true);
    try {
      const res = await api.getStudents(selectedClassroom);
      if (res.success) {
        // Sort students by seat number
        const sorted = (res.students || []).sort((a, b) => (a.number || 0) - (b.number || 0));
        setClassroomStudents(sorted);
      } else {
        throw new Error("ไม่สามารถโหลดรายชื่อนักเรียนได้");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "โหลดข้อมูลไม่สำเร็จ", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedClassroom, showToast]);

  const loadAllStudents = useCallback(async () => {
    setLoading(true);
    try {
      // Bulk endpoint: reduces dozens of Apps Script calls to one
      const res = await api.getAllStudents();
      if (!res.success) {
        throw new Error("ไม่สามารถโหลดรายชื่อนักเรียนทั้งหมดได้");
      }

      const merged = (res.students || []).map((s) => ({
        ...s,
        classroom: (s as any).classroom,
      }));

      merged.sort((a, b) => {
        const classroomCompare = a.classroom.localeCompare(b.classroom, undefined, { numeric: true });
        if (classroomCompare !== 0) return classroomCompare;
        return (a.number || 0) - (b.number || 0);
      });

      setAllStudents(merged);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "โหลดข้อมูลรวมไม่สำเร็จ", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);


  useEffect(() => {
    if (viewMode === "all") {
      loadAllStudents();
    } else {
      loadStudents();
    }
  }, [selectedClassroom, loadAllStudents, loadStudents, viewMode]);

  const displayedStudents = viewMode === "all" ? allStudents : classroomStudents;
  const canEditCurrentView = viewMode === "classroom";

  const parseExcelFileForPreview = async (file: File): Promise<{
    importedByClassroom: Record<string, Student[]>;
    skippedSheets: string[];
    emptySheets: string[];
  }> => {
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.onload = () => {
        const result = reader.result;
        if (!(result instanceof ArrayBuffer)) {
          reject(new Error("Invalid file data"));
          return;
        }
        resolve(result);
      };

      reader.readAsArrayBuffer(file);
    });

    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const importedMap = new Map<string, Student[]>();
    const skippedSheets: string[] = [];
    const emptySheets: string[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const classroom = normalizeSheetNameToClassroom(sheetName);
      if (!classroom) {
        skippedSheets.push(sheetName);
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (aoa.length < 2) {
        emptySheets.push(sheetName);
        return;
      }

      const headerMap = buildHeaderMap(aoa[0] || []);
      const rows = aoa.slice(1);
      const parsedStudents = rows
        .map((row, index) => {
          const rowObj: Record<string, any> = {};
          row.forEach((cellValue, cellIndex) => {
            rowObj[XLSX.utils.encode_col(cellIndex)] = cellValue;
          });

          // Preserve named headers when available, but always keep A:D access as fallback.
          (aoa[0] || []).forEach((header, cellIndex) => {
            if (!header) return;
            rowObj[String(header)] = row[cellIndex];
          });

          return parseExcelRow(rowObj, index + 1, headerMap);
        })
        .filter((item): item is Student => Boolean(item))
        .sort((a, b) => a.number - b.number);

      if (parsedStudents.length > 0) {
        importedMap.set(classroom, parsedStudents);
      } else {
        emptySheets.push(sheetName);
      }
    });

    if (importedMap.size === 0) {
      throw new Error("ไม่พบ sheet ห้องเรียนที่รองรับในไฟล์นี้");
    }

    const importedByClassroom: Record<string, Student[]> = {};
    importedMap.forEach((list, cls) => {
      importedByClassroom[cls] = list;
    });

    return { importedByClassroom, skippedSheets, emptySheets };
  };

  const processExcelFile = async (file: File): Promise<void> => {
    if (loading) return;

    setLoading(true);
    setDragActive(false);

    try {
      const result = await parseExcelFileForPreview(file);
      setPreviewByClassroom(result.importedByClassroom);
      setPreviewSkippedSheets(result.skippedSheets);
      setPreviewEmptySheets(result.emptySheets);
      setIsPreviewOpen(true);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "ไฟล์ Excel รูปแบบไม่ถูกต้อง ไม่สามารถนำเข้าได้", "error");
    } finally {
      setLoading(false);

      // Clear input (preserve existing UX behavior)
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setDragActive(false);
    }
  };

  const handleConfirmExcelPreviewSave = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const classrooms = Object.keys(previewByClassroom);
      if (classrooms.length === 0) {
        showToast("ไม่มีข้อมูลที่จะบันทึก", "warning");
        return;
      }


      let successCount = 0;
      const failedClassrooms: string[] = [];

      for (const classroom of classrooms) {
        const parsedStudents = previewByClassroom[classroom] || [];
        const res = await api.saveStudents(classroom, parsedStudents);
        if (res.success) successCount += 1;
        else failedClassrooms.push(classroom);
      }

      const sheetList = classrooms.join(", ");
      const warnings = [
        previewSkippedSheets.length > 0 ? `ข้าม sheet: ${previewSkippedSheets.join(", ")}` : "",
        previewEmptySheets.length > 0 ? `sheet ว่าง/ไม่ครบข้อมูล: ${previewEmptySheets.join(", ")}` : "",
        failedClassrooms.length > 0 ? `บันทึกไม่สำเร็จ: ${failedClassrooms.join(", ")}` : "",
      ].filter(Boolean);

      showToast(
        `นำเข้าข้อมูลสำเร็จ ${successCount} ห้อง (${sheetList})` +
          (warnings.length ? ` | ${warnings.join(" | ")}` : ""),
        failedClassrooms.length > 0 ? "warning" : "success",
        5000
      );

      if (viewMode === "all") await loadAllStudents();
      else await loadStudents();

      // Close preview modal automatically after saving
      setIsPreviewOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
    } finally {
      setLoading(false);
    }
  };


  // Bulk Excel Import (input change)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (loading) return;

    const file = e.target.files?.[0];
    if (!file) return;

    void processExcelFile(file);
  };


  // Push to server
  const handleSaveAll = async () => {
    setLoading(true);
    try {
      const res = await api.saveStudents(selectedClassroom, classroomStudents);
      if (res.success) {
        showToast(`บันทึกรายชื่อนักเรียนห้อง ${selectedClassroom} ไปยังเซิร์ฟเวอร์เรียบร้อย!`, "success");
        loadStudents();
      } else {
        throw new Error("บันทึกล้มเหลว");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally {
      setLoading(false);
    }
  };

  // Trigger manual add
  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCurrentView) {
      showToast("โหมดแสดงผลรวมทุกห้องเป็นแบบอ่านอย่างเดียว กรุณาสลับกลับไปโหมดรายห้องเพื่อแก้ไข", "warning");
      return;
    }

    if (!newStudent.studentId || !newStudent.name || !newStudent.number || !newStudent.classroom) {
      showToast("กรุณากรอกข้อมูลให้ครบทุกช่อง", "warning");
      return;
    }

    const targetClassroom = newStudent.classroom;

    // If user picked another classroom, switch UI to that room before mutating local table
    if (targetClassroom !== selectedClassroom) {
      setSelectedClassroom(targetClassroom);
      // Ensure local table is for the right classroom
      await loadStudents();
    }

    const sNum = parseInt(newStudent.number, 10);
    const item: Student = {
      studentId: newStudent.studentId.trim(),
      name: newStudent.name.trim(),
      number: isNaN(sNum) ? 99 : sNum,
    };

    // Check duplicate ID in local memory (for the target classroom)
    if (classroomStudents.some((s) => String(s.studentId).trim() === item.studentId)) {
      showToast(`รหัสนักเรียน ${item.studentId} ซ้ำกับในตารางห้อง ${targetClassroom}`, "error");
      return;
    }

    const updated = [...classroomStudents, item].sort((a, b) => a.number - b.number);
    setClassroomStudents(updated);

    setNewStudent({
      studentId: "",
      name: "",
      number: "",
      classroom: targetClassroom,
    });

    setIsAddOpen(false);
    showToast("เพิ่มนักเรียนชั่วคราวลงในตารางของห้องที่เลือกแล้ว (กดบันทึกเพื่อบันทึกจริง)", "success");
  };


  // Trigger single delete (direct server delete + reload)
  const confirmDelete = async () => {
    if (!studentToDelete) return;
    if (!canEditCurrentView) {
      showToast("โหมดแสดงผลรวมทุกห้องเป็นแบบอ่านอย่างเดียว กรุณาสลับกลับไปโหมดรายห้องเพื่อแก้ไข", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await api.deleteStudent(selectedClassroom, studentToDelete.studentId);
      if (res.success) {
        showToast(res.message || "ลบนักเรียนสำเร็จ", "success");
        setIsDeleteOpen(false);
        setStudentToDelete(null);
        loadStudents();
      } else {
        // If not saved on server yet (just in local table memory), delete locally
        const updated = classroomStudents.filter((s) => s.studentId !== studentToDelete.studentId);
        setClassroomStudents(updated);
        showToast("ลบรายการออกจากตารางชั่วคราวสำเร็จ", "success");
        setIsDeleteOpen(false);
        setStudentToDelete(null);
      }
    } catch (err: any) {
      // Direct local delete as fallback if failed on server
      const updated = classroomStudents.filter((s) => s.studentId !== studentToDelete.studentId);
      setClassroomStudents(updated);
      showToast("ลบข้อมูลชั่วคราวเรียบร้อย", "success");
      setIsDeleteOpen(false);
      setStudentToDelete(null);
    } finally {
      setLoading(false);
    }
  };

  // Clear memory roster
  const confirmClear = () => {
    if (!canEditCurrentView) {
      showToast("โหมดแสดงผลรวมทุกห้องเป็นแบบอ่านอย่างเดียว กรุณาสลับกลับไปโหมดรายห้องเพื่อแก้ไข", "warning");
      return;
    }
    setClassroomStudents([]);
    setIsClearOpen(false);
    showToast("เคลียร์รายชื่อนักเรียนออกจากตารางชั่วคราวแล้ว", "info");
  };

  const handleClearAllStudents = async () => {
    setLoading(true);
    try {
      const res = await api.deleteAllStudents();
      if (res.success) {
        showToast(res.message, "success");
        if (viewMode === "all") await loadAllStudents();
        else await loadStudents();
      } else {
        showToast(res.message, "error");
      }
    } catch (err: any) {
      showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error");
    } finally {
      setLoading(false);
      setIsDeleteAllStudentsOpen(false);
    }
  };

  const handleClearAllAttendance = async () => {
    setLoading(true);
    try {
      const res1 = await api.deleteAllAttendance();
      const res2 = await api.deleteAllUniformChecks();
      if (res1.success && res2.success) {
        showToast("ลบข้อมูลการเช็กชื่อและเครื่องแต่งกายทั้งหมดสำเร็จ", "success");
      } else {
        showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error");
      }
    } catch (err: any) {
      showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error");
    } finally {
      setLoading(false);
      setIsDeleteAllAttendanceOpen(false);
    }
  };

  // Template Excel Download helper
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = [["เลขประจำตัว", "เลขที่", "ชื่อ - สกุล", "ชั้น"]];

    const sampleSheets = [
      { sheetName: "21", classroom: "2/1" },
      { sheetName: "22", classroom: "2/2" },
      { sheetName: "31", classroom: "3/1" },
    ];

    sampleSheets.forEach((item, index) => {
      const ws = XLSX.utils.aoa_to_sheet([
        ...headers,
        [
          `68${String(index + 1).padStart(4, "0")}`,
          1,
          `ตัวอย่างนักเรียนห้อง ${item.classroom}`,
          item.classroom,
        ],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, item.sheetName);
    });

    XLSX.writeFile(wb, `student_import_template.xlsx`);
    showToast("ดาวน์โหลดไฟล์แม่แบบหลายห้องเรียบร้อย", "success");
  };

  return (
    <div className="space-y-6">

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-orange-950 flex items-center gap-2">
            <Settings className="h-6 w-6 text-orange-600" /> จัดการข้อมูลนักเรียน (Admin)
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            นำเข้าไฟล์รายชื่อนักเรียน แก้ไข ลบ และเชื่อมต่อฐานข้อมูล Google Sheets
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column options */}
        <div className="space-y-6 lg:col-span-1">


          {/* Import Roster Card */}
          <Card className="border-orange-100 shadow-sm bg-white">
            <CardHeader className="bg-orange-50/50 pb-4 border-b border-orange-50">
              <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                <Upload className="h-4.5 w-4.5 text-orange-600" />
                นำเข้าข้อมูลนักเรียน
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">

              <CardContent className="p-5 flex flex-col gap-2">
                <Button onClick={() => setIsAddOpen(true)} variant="outline" className="w-full text-sm font-bold border-orange-200 flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4 text-orange-600" /> เพิ่มนักเรียนแบบกำหนดเอง
                </Button>
              </CardContent>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-500 block">
                  อัปโหลดไฟล์ Excel (.xlsx)
                </span>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!loading) setDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!loading) setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (!file) return;

                    void processExcelFile(file);
                  }}

                  className={`
                    group flex flex-col items-center justify-center gap-3
                    border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all
                    ${
                      dragActive
                        ? "border-orange-500 bg-orange-100 scale-[1.01]"
                        : "border-orange-300 bg-orange-50/50 hover:border-orange-500 hover:bg-orange-50"
                    }
                  `}
                  role="button"
                  tabIndex={0}
                >
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-orange-600" />
                  </div>

                  <div className="text-center">
                    <p className="font-semibold text-gray-800">
                      ลากไฟล์มาวางที่นี่
                    </p>
                    <p className="text-sm text-gray-500">
                      หรือ <span className="text-orange-600 font-semibold">คลิกเพื่อเลือกไฟล์</span>
                    </p>
                  </div>

                  <p className="text-xs text-gray-400">
                    รองรับ .xlsx และ .xls
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <p className="text-[11px] text-gray-500 leading-relaxed">
                  รองรับไฟล์ที่มีหลาย Sheet ต่อห้องเรียน โดยใช้ชื่อ Sheet เช่น{" "}
                  <strong>21</strong> = ห้อง <strong>2/1</strong>,{" "}
                  <strong>22</strong> = ห้อง <strong>2/2</strong> และอ่านคอลัมน์{" "}
                  <strong>เลขประจำตัว, เลขที่, ชื่อ - สกุล, ชั้น</strong>
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  size="sm"
                  className="w-full text-xs font-bold border-orange-200"
                >
                  <Download className="h-3 w-3" /> โหลดไฟล์ตัวอย่าง
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="border-red-100 shadow-sm bg-white">
            <CardHeader className="bg-red-50/50 pb-4 border-b border-red-50">
              <CardTitle className="text-red-950 font-bold text-base flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-red-600" />
                การจัดการขั้นสูง (Danger Zone)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-3">
              <Button onClick={() => setIsDeleteAllStudentsOpen(true)} variant="outline" className="w-full text-sm font-bold border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center gap-2">
                <Trash2 className="h-4 w-4" /> ลบรายชื่อนักเรียนทั้งหมด
              </Button>
              <Button onClick={() => setIsDeleteAllAttendanceOpen(true)} variant="outline" className="w-full text-sm font-bold border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center gap-2">
                <Trash2 className="h-4 w-4" /> ลบข้อมูลการเช็กชื่อทั้งหมด
              </Button>
              <p className="text-[11px] text-gray-500 leading-relaxed text-center mt-2">
                การลบข้อมูลในส่วนนี้จะเป็นการลบออกจากฐานข้อมูลอย่างถาวร โปรดใช้ความระมัดระวัง
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Right column - Main Roster list */}
        <div className="lg:col-span-2">

          <Card className="border-orange-100 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-orange-500/5 px-6 py-4 border-b border-orange-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-orange-950 font-bold text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-orange-600" />
                  {viewMode === "all" ? "รายชื่อนักเรียนทั้งหมดทุกห้อง" : `รายชื่อนักเรียนห้องเรียน ${selectedClassroom}`}
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-gray-500">
                  มีข้อมูลอยู่ในตารางขณะนี้: {displayedStudents.length} คน
                </CardDescription>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <div className="inline-flex rounded-full border border-orange-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("classroom")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${viewMode === "classroom"
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-gray-700 hover:bg-orange-50"
                      }`}
                  >
                    รายห้อง
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("all")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${viewMode === "all"
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-gray-700 hover:bg-orange-50"
                      }`}
                  >
                    ทุกห้อง
                  </button>
                </div>

                {viewMode === "classroom" ? (
                  <div className="w-40">
                    <select
                      value={selectedClassroom}
                      onChange={(e) => setSelectedClassroom(e.target.value)}
                      className="h-9 w-full rounded-xl border border-orange-200 bg-white px-3 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {CLASSROOMS.map((cls) => (
                        <option key={cls} value={cls}>ห้องเรียน {cls}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700">
                    โหมดทุกห้องเป็นแบบอ่านอย่างเดียว
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">

              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-2"></div>
                  <span className="text-gray-400 text-xs font-semibold">กำลังโหลดข้อมูลนักเรียน...</span>
                </div>
              ) : displayedStudents.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-xs font-bold space-y-1">
                  <p>ยังไม่มีรายชื่อนักเรียนในห้องเรียนนี้</p>
                  <p className="font-medium text-gray-400">กรุณาอัปโหลด Excel หรือกรอกเพิ่มด้วยตนเองด้านซ้าย</p>
                </div>
              ) : (
                <>
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-orange-50">
                        <TableRow>
                          <TableHead className="w-16 text-center">เลขที่</TableHead>
                          <TableHead className="w-32">รหัสประจำตัว</TableHead>
                          <TableHead>ชื่อ - นามสกุล</TableHead>
                          <TableHead className="w-24 text-center">ชั้น</TableHead>
                          <TableHead className="w-20 text-center">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedStudents.map((student: any) => (
                          <TableRow key={student.studentId} className="hover:bg-orange-50/10">
                            <TableCell className="text-center font-bold text-gray-500">
                              {student.number}
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-gray-600">
                              {student.studentId}
                            </TableCell>
                            <TableCell className="font-semibold text-gray-800">
                              {student.name}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-gray-600">
                              {student.classroom || selectedClassroom}
                            </TableCell>
                            <TableCell className="text-center">
                              {canEditCurrentView ? (
                                <button
                                  onClick={() => {
                                    setStudentToDelete(student);
                                    setIsDeleteOpen(true);
                                  }}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-400 font-bold">ดูอย่างเดียว</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                 
                </>
              )}

            </CardContent>
          </Card>

        </div>

      </div>

      {/* Excel Preview dialog */}
      <Dialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="พรีวิวข้อมูลที่จะนำเข้า"
        description="ตรวจสอบข้อมูลก่อนกดยืนยันเพื่อบันทึกลงฐานข้อมูล"
      >
        <div className="max-h-[70vh] overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
              <div className="text-[11px] font-bold text-gray-500">จำนวนห้อง</div>
              <div className="text-base font-extrabold text-orange-950">
                {Object.keys(previewByClassroom).length}
              </div>
            </div>
            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
              <div className="text-[11px] font-bold text-gray-500">จำนวนแถวรวม</div>
              <div className="text-base font-extrabold text-orange-950">
                {Object.values(previewByClassroom).reduce((acc, list) => acc + (list?.length || 0), 0)}
              </div>
            </div>
            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
              <div className="text-[11px] font-bold text-gray-500">ไฟล์ที่ถูกข้าม/ว่าง</div>
              <div className="text-base font-extrabold text-orange-950">
                {(previewSkippedSheets?.length || 0) + (previewEmptySheets?.length || 0)}
              </div>
            </div>
          </div>

          {previewSkippedSheets.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <div className="text-sm font-bold text-amber-900">ข้าม sheet</div>
              <div className="text-xs text-amber-900/80 font-semibold">
                {previewSkippedSheets.join(", ")}
              </div>
            </div>
          )}

          {previewEmptySheets.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <div className="text-sm font-bold text-amber-900">sheet ว่าง/ไม่ครบข้อมูล</div>
              <div className="text-xs text-amber-900/80 font-semibold">
                {previewEmptySheets.join(", ")}
              </div>
            </div>
          )}

          {Object.entries(previewByClassroom).map(([classroom, students]) => (
            <div key={classroom} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-orange-950">ห้องเรียน {classroom}</div>
                <div className="text-[11px] font-bold text-gray-500">{students.length} คน</div>
              </div>

              <div className="border border-orange-100 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-orange-50">
                    <TableRow>
                      <TableHead className="w-16 text-center">เลขที่</TableHead>
                      <TableHead className="w-32">รหัสประจำตัว</TableHead>
                      <TableHead>ชื่อ - นามสกุล</TableHead>
                      <TableHead className="w-24 text-center">ชั้น</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={`${classroom}:${s.studentId}`}>
                        <TableCell className="text-center font-bold text-gray-600">
                          {s.number}
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-gray-600">
                          {s.studentId}
                        </TableCell>
                        <TableCell className="font-semibold text-gray-800">
                          {s.name}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-gray-600">
                          {classroom}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConfirmExcelPreviewSave}
            loading={loading}
            className="font-bold"
          >
            ยืนยันบันทึกลงฐานข้อมูล
          </Button>
        </div>
      </Dialog>

      {/* Manual Add dialog */}
      <Dialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="เพิ่มนักเรียนแบบระบุเอง"
      >
        <form onSubmit={handleManualAddSubmit} className="space-y-4">
          <Select
            label="เลือกชั้น"
            value={newStudent.classroom ? newStudent.classroom.split("/")[0] : ""}
            onChange={(e) => {
              const level = e.target.value;
              const levelNum = level ? Number(level) : 2;
              const fallbackRoom = `${levelNum}/${1}`;
              const nextClassroom =
                CLASSROOMS.includes(fallbackRoom as any)
                  ? fallbackRoom
                  : CLASSROOMS.filter((c) => c.startsWith(`${levelNum}/`))[0] || "2/1";
              setNewStudent({ ...newStudent, classroom: nextClassroom });
            }}

            options={[
              { value: "2", label: "ชั้น 2" },
              { value: "3", label: "ชั้น 3" },
              { value: "4", label: "ชั้น 4" },
              { value: "5", label: "ชั้น 5" },
              { value: "6", label: "ชั้น 6" },
            ]}
          />

          <Select
            label="เลือกห้อง"
            value={newStudent.classroom}
            onChange={(e) => setNewStudent({ ...newStudent, classroom: e.target.value })}
            options={CLASSROOMS.filter((c) => {
              const level = newStudent.classroom?.split("/")[0] || "2";
              return c.startsWith(`${level}/`);
            }).map((c) => ({
              value: c,
              label: `ห้องเรียน ${c}`,
            }))}
          />


          <Input
            label="รหัสประจำตัวนักเรียน"
            placeholder="เช่น 100101"
            value={newStudent.studentId}
            onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
          />
          <Input
            label="ชื่อ - นามสกุล"
            placeholder="เช่น เด็กชายสมจิต สมหวัง"
            value={newStudent.name}
            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
          />
          <Input
            label="เลขที่"
            placeholder="เช่น 1"
            type="number"
            value={newStudent.number}
            onChange={(e) => setNewStudent({ ...newStudent, number: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" size="sm" className="font-bold">
              เพิ่มลงตาราง
            </Button>
          </div>
        </form>
      </Dialog>


      {/* Delete confirmation dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="ยืนยันการลบนักเรียน"
        description="การดำเนินการนี้อาจส่งผลต่อข้อมูลบนฐานข้อมูลทันที"
      >
        <div className="space-y-3 font-semibold text-gray-800">
          <p>คุณแน่ใจหรือไม่ที่จะลบนักเรียน:</p>
          <div className="bg-red-50 border border-red-100 p-3.5 rounded-xl font-bold text-red-950">
            {studentToDelete?.name} (รหัส: {studentToDelete?.studentId}, เลขที่: {studentToDelete?.number})
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="destructive" size="sm" onClick={confirmDelete} loading={loading}>
            ยืนยันลบข้อมูล
          </Button>
        </div>
      </Dialog>

      {/* Clear confirmation dialog */}
      <Dialog
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        title="ยืนยันการล้างตารางชั่วคราว"
        description="การล้างตารางจะไม่เขียนบันทึกไปบนเซิร์ฟเวอร์จนกว่าคุณจะกดบันทึกจริง"
      >
        <p className="font-semibold text-gray-700">คุณแน่ใจหรือไม่ที่จะล้างตารางรายชื่อทั้งหมดบนหน้าจอนี้ชั่วคราว?</p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setIsClearOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="destructive" size="sm" onClick={confirmClear}>
            ล้างตาราง
          </Button>
        </div>
      </Dialog>

      {/* Delete All Students Dialog */}
      <Dialog
        isOpen={isDeleteAllStudentsOpen}
        onClose={() => setIsDeleteAllStudentsOpen(false)}
        title="ยืนยันการลบรายชื่อนักเรียนทั้งหมด"
        description="การดำเนินการนี้จะลบข้อมูลนักเรียนทั้งหมดจากฐานข้อมูลอย่างถาวร ไม่สามารถกู้คืนได้"
      >
        <p className="font-semibold text-red-600">คุณแน่ใจหรือไม่ที่จะลบรายชื่อนักเรียนของทุกห้อง?</p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setIsDeleteAllStudentsOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClearAllStudents} loading={loading}>
            ยืนยันการลบข้อมูล
          </Button>
        </div>
      </Dialog>

      {/* Delete All Attendance Dialog */}
      <Dialog
        isOpen={isDeleteAllAttendanceOpen}
        onClose={() => setIsDeleteAllAttendanceOpen(false)}
        title="ยืนยันการลบข้อมูลการเช็กชื่อทั้งหมด"
        description="การดำเนินการนี้จะลบข้อมูลการเช็กชื่อและการตรวจเครื่องแต่งกายทั้งหมดจากฐานข้อมูลอย่างถาวร ไม่สามารถกู้คืนได้"
      >
        <p className="font-semibold text-red-600">คุณแน่ใจหรือไม่ที่จะลบข้อมูลการมาเรียนและการแต่งกายของทุกห้อง?</p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setIsDeleteAllAttendanceOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClearAllAttendance} loading={loading}>
            ยืนยันการลบข้อมูล
          </Button>
        </div>
      </Dialog>

    </div>
  );
}
