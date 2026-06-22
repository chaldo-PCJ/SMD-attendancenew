"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, Student, DeductionSettings, LatePenaltySettings } from "@/lib/api";
import { getLatePenaltySettings, saveLatePenaltySettings } from "@/lib/api";
import { MoveRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Upload, Plus, Trash2, Download, RefreshCw, FileSpreadsheet,
  Settings, AlertTriangle, Scale, Gauge, ChevronDown, ChevronRight,
  Search, Users, BookOpen, ClipboardList, GraduationCap, X, Pencil, Save,
  History, Clock, AlarmClock
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  parseLegacyAttendanceExcel,
  saveLegacyAttendanceData,
  LegacyClassroomData,
} from "@/lib/importLegacyAttendance";

const CLASSROOMS = [
  "2/1", "2/2", "2/3", "2/4",
  "3/1", "3/2", "3/3", "3/4",
  "4/1", "4/2", "4/3", "4/4", "4/5",
  "5/1", "5/2", "5/3", "5/4", "5/5",
  "6/1", "6/2", "6/3", "6/4", "6/5"
];

const normalizeSheetNameToClassroom = (sheetName: string): string | null => {
  const trimmed = sheetName.trim();
  if (CLASSROOMS.includes(trimmed)) return trimmed;
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
  key.replace(/^\uFEFF/, "").toLowerCase().replace(/\s+/g, "").replace(/[-_]/g, "");

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
  return { studentId, name, number };
};

const buildHeaderMap = (headerRow: any[]): Record<string, string | null> => {
  const map: Record<string, string | null> = { studentId: null, number: null, name: null, classroom: null };
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

// Accordion component
function AccordionSection({
  title,
  icon,
  isOpen,
  onToggle,
  badge,
  children,
  danger = false,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-2xl border ${danger ? "border-red-100" : "border-slate-200"} bg-white overflow-hidden shadow-sm transition-all`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${
          danger ? "hover:bg-red-50/50" : "hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className={danger ? "text-red-500" : "text-orange-500"}>{icon}</span>
          <span className={`text-sm font-bold ${danger ? "text-red-800" : "text-slate-800"}`}>{title}</span>
          {badge && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className={`h-4 w-4 ${danger ? "text-red-400" : "text-slate-400"}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${danger ? "text-red-400" : "text-slate-400"}`} />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 pt-1 border-t border-slate-50">{children}</div>}
    </div>
  );
}

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

  // Deduction settings (load from database on mount)
  const [deductionSettings, setDeductionSettings] = useState<DeductionSettings>({ uniformDeduction: 10, hairDeduction: 10, nailDeduction: 5 });
  const [isDeductionOpen, setIsDeductionOpen] = useState(false);
  const [editDeductionSettings, setEditDeductionSettings] = useState<DeductionSettings>({ uniformDeduction: 10, hairDeduction: 10, nailDeduction: 5 });

  // Late penalty settings (load from database on mount)
  const [latePenaltySettings, setLatePenaltySettings] = useState<LatePenaltySettings>({ lateThreshold: 3, penaltyPoints: 5 });
  const [isLatePenaltyOpen, setIsLatePenaltyOpen] = useState(false);
  const [editLatePenaltySettings, setEditLatePenaltySettings] = useState<LatePenaltySettings>({ lateThreshold: 3, penaltyPoints: 5 });

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

  // Load late penalty settings from database
  const loadLatePenaltySettings = useCallback(async () => {
    try {
      const res = await getLatePenaltySettings();
      if (res.success && res.settings) {
        setLatePenaltySettings(res.settings);
      }
    } catch (err) {
      console.error("Error loading late penalty settings:", err);
    }
  }, []);

  useEffect(() => {
    loadDeductionSettings();
    loadLatePenaltySettings();
  }, [loadDeductionSettings, loadLatePenaltySettings]);

  const openDeductionDialog = () => {
    setEditDeductionSettings({ ...deductionSettings });
    setIsDeductionOpen(true);
  };

  const handleSaveDeductionSettings = async () => {
    const s = editDeductionSettings;
    if (s.uniformDeduction < 0 || s.hairDeduction < 0 || s.nailDeduction < 0) {
      showToast("ค่าหักคะแนนต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0", "warning");
      return;
    }
    const res = await api.saveDeductionSettings(s);
    if (res.success) {
      setDeductionSettings(s);
      showToast("บันทึกการตั้งค่าการหักคะแนนระเบียบวินัยเรียบร้อย", "success");
      setIsDeductionOpen(false);
    } else {
      showToast(res.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
    }
  };

  const handleResetDeductionSettings = async () => {
    const defaults: DeductionSettings = { uniformDeduction: 10, hairDeduction: 10, nailDeduction: 5 };
    const res = await api.saveDeductionSettings(defaults);
    if (res.success) {
      setDeductionSettings(defaults);
      setEditDeductionSettings(defaults);
      showToast("รีเซ็ตการตั้งค่าเป็นค่ามาตรฐานแล้ว", "success");
      setIsDeductionOpen(false);
    } else {
      showToast(res.message || "เกิดข้อผิดพลาดในการรีเซ็ต", "error");
    }
  };

  // Late penalty handlers
  const openLatePenaltyDialog = () => {
    setEditLatePenaltySettings({ ...latePenaltySettings });
    setIsLatePenaltyOpen(true);
  };

  const handleSaveLatePenaltySettings = async () => {
    const s = editLatePenaltySettings;
    if (s.lateThreshold < 1 || s.penaltyPoints < 0) {
      showToast("ค่าตั้งค่าต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0 (หักครั้งละต้องมากกว่า 0)", "warning");
      return;
    }
    const res = await saveLatePenaltySettings(s);
    if (res.success) {
      setLatePenaltySettings(s);
      showToast("บันทึกการตั้งค่าการหักคะแนนมาสายเรียบร้อย", "success");
      setIsLatePenaltyOpen(false);
    } else {
      showToast(res.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
    }
  };

  const handleResetLatePenaltySettings = async () => {
    const defaults: LatePenaltySettings = { lateThreshold: 3, penaltyPoints: 5 };
    const res = await saveLatePenaltySettings(defaults);
    if (res.success) {
      setLatePenaltySettings(defaults);
      setEditLatePenaltySettings(defaults);
      showToast("รีเซ็ตการตั้งค่าการหักคะแนนมาสายเป็นค่ามาตรฐานแล้ว", "success");
      setIsLatePenaltyOpen(false);
    } else {
      showToast(res.message || "เกิดข้อผิดพลาดในการรีเซ็ต", "error");
    }
  };

  // Modals & Forms
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ studentId: "", name: "", number: "", classroom: "2/1" });

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student & { classroom?: string } | null>(null);

  // Edit state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student & { classroom?: string }>({ studentId: "", name: "", number: 0, classroom: "2/1" });

  // Move student state
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [studentToMove, setStudentToMove] = useState<Student & { classroom: string }>({ studentId: "", name: "", number: 0, classroom: "2/1" });
  const [moveTargetClassroom, setMoveTargetClassroom] = useState<string>("2/2");
  const [isMoving, setIsMoving] = useState(false);

  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isDeleteAllStudentsOpen, setIsDeleteAllStudentsOpen] = useState(false);
  const [isDeleteAllAttendanceOpen, setIsDeleteAllAttendanceOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const legacyFileInputRef = useRef<HTMLInputElement>(null);

  // Accordion states (all collapsed by default)
  const [accordionImport, setAccordionImport] = useState(false);
  const [accordionLegacy, setAccordionLegacy] = useState(false);
  const [accordionDeduction, setAccordionDeduction] = useState(false);
  const [accordionLatePenalty, setAccordionLatePenalty] = useState(false);
  const [accordionDanger, setAccordionDanger] = useState(false);

  // Legacy import state
  const [isLegacyPreviewOpen, setIsLegacyPreviewOpen] = useState(false);
  const [legacyPreviewData, setLegacyPreviewData] = useState<LegacyClassroomData[]>([]);
  const [legacySkippedSheets, setLegacySkippedSheets] = useState<string[]>([]);
  const [isImportingLegacy, setIsImportingLegacy] = useState(false);
  const [legacyImportProgress, setLegacyImportProgress] = useState<string>("");
  const [legacyImportResult, setLegacyImportResult] = useState<{
    totalClassrooms: number;
    completedClassrooms: number;
    totalAttendanceSaved: number;
    totalStudentsCreated: number;
    errors: string[];
  } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Always editable - no read-only mode
  const canEditCurrentView = true;

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
      const res = await api.getAllStudents();
      if (!res.success) throw new Error("ไม่สามารถโหลดรายชื่อนักเรียนทั้งหมดได้");
      const merged = (res.students || []).map((s) => ({ ...s, classroom: (s as any).classroom }));
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

  // Filtered students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return displayedStudents;
    const q = searchQuery.trim().toLowerCase();
    return displayedStudents.filter((s: any) =>
      String(s.studentId).toLowerCase().includes(q) ||
      String(s.name).toLowerCase().includes(q) ||
      String(s.number).includes(q)
    );
  }, [displayedStudents, searchQuery]);

  const parseExcelFileForPreview = async (file: File): Promise<{
    importedByClassroom: Record<string, Student[]>;
    skippedSheets: string[];
    emptySheets: string[];
  }> => {
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => {
        const result = reader.result;
        if (!(result instanceof ArrayBuffer)) { reject(new Error("Invalid file data")); return; }
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
      if (!classroom) { skippedSheets.push(sheetName); return; }
      const sheet = workbook.Sheets[sheetName];
      const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (aoa.length < 2) { emptySheets.push(sheetName); return; }
      const headerMap = buildHeaderMap(aoa[0] || []);
      const rows = aoa.slice(1);
      const parsedStudents = rows
        .map((row, index) => {
          const rowObj: Record<string, any> = {};
          row.forEach((cellValue, cellIndex) => { rowObj[XLSX.utils.encode_col(cellIndex)] = cellValue; });
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

    if (importedMap.size === 0) throw new Error("ไม่พบ sheet ห้องเรียนที่รองรับในไฟล์นี้");

    const importedByClassroom: Record<string, Student[]> = {};
    importedMap.forEach((list, cls) => { importedByClassroom[cls] = list; });
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
      if (fileInputRef.current) fileInputRef.current.value = "";
      setDragActive(false);
    }
  };

  const handleConfirmExcelPreviewSave = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const classrooms = Object.keys(previewByClassroom);
      if (classrooms.length === 0) { showToast("ไม่มีข้อมูลที่จะบันทึก", "warning"); return; }
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
        `นำเข้าข้อมูลสำเร็จ ${successCount} ห้อง (${sheetList})` + (warnings.length ? ` | ${warnings.join(" | ")}` : ""),
        failedClassrooms.length > 0 ? "warning" : "success", 5000
      );
      if (viewMode === "all") await loadAllStudents();
      else await loadStudents();
      setIsPreviewOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
    } finally { setLoading(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (loading) return;
    const file = e.target.files?.[0];
    if (!file) return;
    void processExcelFile(file);
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      const res = await api.saveStudents(selectedClassroom, classroomStudents);
      if (res.success) {
        showToast(`บันทึกรายชื่อนักเรียนห้อง ${selectedClassroom} ไปยังเซิร์ฟเวอร์เรียบร้อย!`, "success");
        loadStudents();
      } else throw new Error("บันทึกล้มเหลว");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally { setLoading(false); }
  };

  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.studentId || !newStudent.name || !newStudent.number || !newStudent.classroom) {
      showToast("กรุณากรอกข้อมูลให้ครบทุกช่อง", "warning");
      return;
    }
    const targetClassroom = newStudent.classroom;
    if (targetClassroom !== selectedClassroom) {
      setSelectedClassroom(targetClassroom);
      await loadStudents();
    }
    const sNum = parseInt(newStudent.number, 10);
    const item: Student = { studentId: newStudent.studentId.trim(), name: newStudent.name.trim(), number: isNaN(sNum) ? 99 : sNum };
    if (classroomStudents.some((s) => String(s.studentId).trim() === item.studentId)) {
      showToast(`รหัสนักเรียน ${item.studentId} ซ้ำกับในตารางห้อง ${targetClassroom}`, "error");
      return;
    }
    const updated = [...classroomStudents, item].sort((a, b) => a.number - b.number);
    setClassroomStudents(updated);
    setNewStudent({ studentId: "", name: "", number: "", classroom: targetClassroom });
    setIsAddOpen(false);
    showToast("เพิ่มนักเรียนชั่วคราวลงในตารางของห้องที่เลือกแล้ว (กดบันทึกเพื่อบันทึกจริง)", "success");
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    const targetClassroom = studentToDelete.classroom || selectedClassroom;

    setLoading(true);
    try {
      const res = await api.deleteStudent(targetClassroom, studentToDelete.studentId);
      if (res.success) {
        showToast(res.message || "ลบนักเรียนสำเร็จ", "success");
      } else {
        // Local delete fallback
        if (viewMode === "all") {
          setAllStudents((prev) => prev.filter((s) => s.studentId !== studentToDelete.studentId));
        } else {
          setClassroomStudents((prev) => prev.filter((s) => s.studentId !== studentToDelete.studentId));
        }
        showToast("ลบรายการออกจากตารางชั่วคราวสำเร็จ", "success");
      }
      setIsDeleteOpen(false);
      setStudentToDelete(null);
      if (viewMode === "all") await loadAllStudents();
      else await loadStudents();
    } catch (err: any) {
      if (viewMode === "all") {
        setAllStudents((prev) => prev.filter((s) => s.studentId !== studentToDelete.studentId));
      } else {
        setClassroomStudents((prev) => prev.filter((s) => s.studentId !== studentToDelete.studentId));
      }
      showToast("ลบข้อมูลชั่วคราวเรียบร้อย", "success");
      setIsDeleteOpen(false);
      setStudentToDelete(null);
    } finally { setLoading(false); }
  };

  // Move student handlers
  const openMoveDialog = (student: any) => {
    setStudentToMove({
      studentId: student.studentId,
      name: student.name,
      number: student.number,
      classroom: student.classroom || selectedClassroom
    });
    // Set default target classroom to the next classroom in the list
    const currentIdx = CLASSROOMS.indexOf(student.classroom || selectedClassroom);
    const nextIdx = currentIdx < CLASSROOMS.length - 1 ? currentIdx + 1 : 0;
    setMoveTargetClassroom(CLASSROOMS[nextIdx]);
    setIsMoveOpen(true);
  };

  const handleMoveStudent = async () => {
    if (!studentToMove.studentId || !studentToMove.classroom || !moveTargetClassroom) {
      showToast("กรุณาเลือกห้องปลายทาง", "warning");
      return;
    }
    setIsMoving(true);
    try {
      const res = await api.moveStudent(
        studentToMove.studentId,
        studentToMove.classroom,
        moveTargetClassroom,
        studentToMove.name
      );
      if (res.success) {
        showToast(res.message, "success");
        setIsMoveOpen(false);
        // Reload data
        if (viewMode === "all") {
          await loadAllStudents();
        } else {
          await loadStudents();
        }
      } else {
        showToast(res.message || "เกิดข้อผิดพลาดในการย้ายห้อง", "error");
      }
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาดในการย้ายห้อง", "error");
    } finally {
      setIsMoving(false);
    }
  };

  // Edit handlers
  const openEditDialog = (student: Student & { classroom?: string }) => {
    setEditingStudent({ ...student });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = editingStudent;
    if (!s.studentId || !s.name || !s.number) {
      showToast("กรุณากรอกข้อมูลให้ครบทุกช่อง", "warning");
      return;
    }

    const editClassroom = s.classroom || selectedClassroom;

    if (viewMode === "all") {
      // Update allStudents locally
      setAllStudents((prev) =>
        prev.map((st) =>
          st.studentId === s.studentId ? { ...st, studentId: s.studentId, name: s.name, number: s.number } : st
        )
      );
      showToast("แก้ไขข้อมูลนักเรียนเรียบร้อย (บันทึกในหน่วยความจำ)", "success");
    } else {
      // Update classroomStudents
      setClassroomStudents((prev) =>
        prev.map((st) =>
          st.studentId === s.studentId ? { studentId: s.studentId, name: s.name, number: s.number } : st
        )
      );
      showToast("แก้ไขข้อมูลนักเรียนเรียบร้อย (กดบันทึกเพื่อบันทึกลงฐานข้อมูล)", "success");
    }
    setIsEditOpen(false);
  };

  const confirmClear = () => {
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
      } else showToast(res.message, "error");
    } catch (err: any) { showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error"); }
    finally { setLoading(false); setIsDeleteAllStudentsOpen(false); }
  };

  const handleClearAllAttendance = async () => {
    setLoading(true);
    try {
      const res1 = await api.deleteAllAttendance();
      const res2 = await api.deleteAllUniformChecks();
      if (res1.success && res2.success) {
        showToast("ลบข้อมูลการเช็กชื่อและระเบียบวินัยทั้งหมดสำเร็จ", "success");
      } else showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error");
    } catch (err: any) { showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error"); }
    finally { setLoading(false); setIsDeleteAllAttendanceOpen(false); }
  };

  // Legacy import handlers
  const handleLegacyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isImportingLegacy) return;
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    try {
      const result = await parseLegacyAttendanceExcel(file);
      setLegacyPreviewData(result.classrooms);
      setLegacySkippedSheets(result.skippedSheets);
      setLegacyImportResult(null);
      setIsLegacyPreviewOpen(true);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "ไม่สามารถอ่านไฟล์ Excel ได้", "error");
    } finally {
      setLoading(false);
      if (legacyFileInputRef.current) legacyFileInputRef.current.value = "";
    }
  };

  const handleConfirmLegacyImport = async () => {
    if (isImportingLegacy || legacyPreviewData.length === 0) return;
    
    setIsImportingLegacy(true);
    setLegacyImportProgress("กำลังนำเข้าข้อมูล...");
    
    let totalAttendanceSaved = 0;
    let totalStudentsCreated = 0;
    let completedClassrooms = 0;
    const allErrors: string[] = [];

    for (const classroomData of legacyPreviewData) {
      setLegacyImportProgress(`กำลังนำเข้าข้อมูลห้อง ${classroomData.classroom}...`);
      try {
        const res = await saveLegacyAttendanceData(classroomData);
        if (res.success) {
          totalAttendanceSaved += res.attendanceSaved;
          completedClassrooms++;
        }
        if (res.errors.length > 0) {
          allErrors.push(...res.errors.map((e) => `[${classroomData.classroom}] ${e}`));
        }
      } catch (err: any) {
        allErrors.push(`[${classroomData.classroom}] ${err.message || "เกิดข้อผิดพลาด"}`);
      }
    }

    setLegacyImportResult({
      totalClassrooms: legacyPreviewData.length,
      completedClassrooms,
      totalAttendanceSaved,
      totalStudentsCreated,
      errors: allErrors,
    });
    setLegacyImportProgress("");

    if (allErrors.length === 0) {
      showToast(
        `นำเข้าข้อมูลเก่าสำเร็จ ${completedClassrooms} ห้อง (บันทึก ${totalAttendanceSaved} รายการ)`,
        "success"
      );
    } else {
      showToast(
        `นำเข้าข้อมูล: ${completedClassrooms}/${legacyPreviewData.length} ห้องสำเร็จ | ข้อผิดพลาด ${allErrors.length} รายการ`,
        "warning", 5000
      );
    }
    
    setIsImportingLegacy(false);
  };

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
        [`68${String(index + 1).padStart(4, "0")}`, 1, `ตัวอย่างนักเรียนห้อง ${item.classroom}`, item.classroom],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, item.sheetName);
    });
    XLSX.writeFile(wb, `student_import_template.xlsx`);
    showToast("ดาวน์โหลดไฟล์แม่แบบหลายห้องเรียบร้อย", "success");
  };

  // Compute summary stats
  const totalUniqueStudents = useMemo(() => {
    if (viewMode === "all") return allStudents.length;
    return classroomStudents.length;
  }, [viewMode, allStudents, classroomStudents]);

  const totalClassrooms = CLASSROOMS.length;
  const currentClassroom = viewMode === "all" ? "ทุกห้อง" : selectedClassroom;

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ===== ROW 1: Page Header ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              จัดการข้อมูลนักเรียน
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              นำเข้า แก้ไข และจัดการข้อมูลนักเรียน
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsAddOpen(true)}
              className="h-10 px-5 text-sm font-bold rounded-xl shadow-sm shadow-orange-100 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="h-4 w-4" /> เพิ่มนักเรียน
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="h-10 px-5 text-sm font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" /> นำเข้า Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* ===== ROW 2: Statistics Cards ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-slate-100 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">นักเรียนทั้งหมด</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{totalUniqueStudents} คน</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ห้องเรียนทั้งหมด</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{totalClassrooms} ห้อง</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ห้องที่กำลังดู</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{currentClassroom}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">รายการล่าสุด</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{displayedStudents.length} คน</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== ROW 3: Main Workspace ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6">

          {/* Left Sidebar - Sticky Accordions */}
          <div className="space-y-3 xl:sticky xl:top-6 xl:self-start">

            {/* Accordion 1: Import */}
            <AccordionSection
              title="นำเข้าข้อมูลนักเรียน"
              icon={<Upload className="h-4 w-4" />}
              isOpen={accordionImport}
              onToggle={() => setAccordionImport(!accordionImport)}
            >
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (!loading) setDragActive(true); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!loading) setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (!file) return;
                    void processExcelFile(file);
                  }}
                  className={`
                    flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all
                    ${dragActive ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-slate-50/50 hover:border-orange-300 hover:bg-orange-50/30"}
                  `}
                  role="button"
                  tabIndex={0}
                >
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">ลากไฟล์มาวางที่นี่</p>
                    <p className="text-xs text-slate-400">หรือคลิกเพื่อเลือกไฟล์</p>
                  </div>
                  <p className="text-[10px] text-slate-400">รองรับ .xlsx และ .xls</p>
                </div>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  size="sm"
                  className="w-full text-xs font-bold rounded-xl border-slate-200"
                >
                  <Download className="h-3 w-3" /> โหลดไฟล์ตัวอย่าง
                </Button>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  ชื่อ Sheet เช่น <strong>21</strong> = ห้อง <strong>2/1</strong>
                </p>
              </div>
            </AccordionSection>

            {/* Accordion 2: Legacy Import */}
            <AccordionSection
              title="นำเข้าข้อมูลการเช็กชื่อเก่า"
              icon={<History className="h-4 w-4" />}
              isOpen={accordionLegacy}
              onToggle={() => setAccordionLegacy(!accordionLegacy)}
            >
              <div className="space-y-3">
                <div
                  onClick={() => legacyFileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all border-slate-200 bg-slate-50/50 hover:border-amber-300 hover:bg-amber-50/30"
                  role="button"
                  tabIndex={0}
                >
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">นำเข้าข้อมูลเก่า</p>
                    <p className="text-xs text-slate-400">ไฟล์ Excel จาก Google Sheet</p>
                  </div>
                  <p className="text-[10px] text-slate-400">ชื่อ Sheet เช่น ม.21, สานฝัน ม.61</p>
                </div>
                <input
                  ref={legacyFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleLegacyFileUpload}
                  className="hidden"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  รองรับไฟล์ที่มีโครงสร้าง: คอลัมน์แรกเป็นวันที่, คอลัมน์ถัดไปเป็นชื่อนักเรียน (เลขที่ + คำนำหน้า + ชื่อ)
                </p>
              </div>
            </AccordionSection>

            {/* Accordion 3: Deduction Settings */}
            <AccordionSection
              title="ตั้งค่าการหักคะแนนระเบียบวินัย"
              icon={<Scale className="h-4 w-4" />}
              isOpen={accordionDeduction}
              onToggle={() => setAccordionDeduction(!accordionDeduction)}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">การแต่งกาย</span>
                    <span className="font-bold text-violet-600">-{deductionSettings.uniformDeduction}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">ทรงผม</span>
                    <span className="font-bold text-violet-600">-{deductionSettings.hairDeduction}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">เล็บมือ</span>
                    <span className="font-bold text-violet-600">-{deductionSettings.nailDeduction}</span>
                  </div>
                </div>
                <Button
                  onClick={openDeductionDialog}
                  size="sm"
                  className="w-full text-xs font-bold rounded-xl bg-violet-500 text-violet-700 border border-violet-200 hover:bg-violet-100"
                >
                  <Gauge className="h-3 w-3" /> แก้ไข
                </Button>
              </div>
            </AccordionSection>

            {/* Accordion 4: Late Penalty Settings */}
            <AccordionSection
              title="ตั้งค่าการหักคะแนนมาสาย"
              icon={<AlarmClock className="h-4 w-4" />}
              isOpen={accordionLatePenalty}
              onToggle={() => setAccordionLatePenalty(!accordionLatePenalty)}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">หักคะแนนเมื่อสาย</span>
                    <span className="font-bold text-amber-600">ทุก {latePenaltySettings.lateThreshold} ครั้ง</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">จำนวนคะแนนที่หัก</span>
                    <span className="font-bold text-amber-600">-{latePenaltySettings.penaltyPoints} คะแนน</span>
                  </div>
                </div>
                <Button
                  onClick={openLatePenaltyDialog}
                  size="sm"
                  className="w-full text-xs font-bold rounded-xl bg-amber-500 text-amber-700 border border-amber-200 hover:bg-amber-100"
                >
                  <Gauge className="h-3 w-3" /> แก้ไข
                </Button>
              </div>
            </AccordionSection>

            {/* Accordion 5: Danger Zone */}
            <AccordionSection
              title="แก้ไขข้อมูลสำคัญ"
              icon={<AlertTriangle className="h-4 w-4" />}
              isOpen={accordionDanger}
              onToggle={() => setAccordionDanger(!accordionDanger)}
              danger
            >
              <div className="space-y-2">
                <Button
                  onClick={() => setIsDeleteAllStudentsOpen(true)}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" /> ลบรายชื่อนักเรียนทั้งหมด
                </Button>
                <Button
                  onClick={() => setIsDeleteAllAttendanceOpen(true)}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" /> ลบข้อมูลการเช็กชื่อทั้งหมด
                </Button>
              </div>
            </AccordionSection>

          </div>

          {/* Right Content Area - Student Table (PRIMARY) */}
          <div className="min-w-0">

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("classroom")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
                      viewMode === "classroom"
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    รายห้อง
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("all")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
                      viewMode === "all"
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ทุกห้อง
                  </button>
                </div>
                <select
                  value={viewMode === "all" ? "all" : selectedClassroom}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "all") {
                      setViewMode("all");
                    } else {
                      if (viewMode === "all") setViewMode("classroom");
                      setSelectedClassroom(val);
                    }
                  }}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="all">ทุกห้อง</option>
                  {CLASSROOMS.map((cls) => (
                    <option key={cls} value={cls}>ห้อง {cls}</option>
                  ))}
                </select>
                {viewMode === "classroom" && (
                  <Button
                    onClick={handleSaveAll}
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    disabled={loading}
                  >
                    <Save className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> บันทึก
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ค้นหา รหัส หรือ ชื่อ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-48 sm:w-56 rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => { viewMode === "all" ? loadAllStudents() : loadStudents(); }}
                  disabled={loading}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-slate-700"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Student List Card */}
            <Card className="border-slate-100 shadow-sm rounded-2xl bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-orange-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {viewMode === "all" ? "รายชื่อนักเรียนทั้งหมดทุกห้อง" : `รายชื่อนักเรียนห้อง ${selectedClassroom}`}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {filteredStudents.length !== displayedStudents.length
                        ? `พบ ${filteredStudents.length} รายการ จาก ${displayedStudents.length} คน`
                        : `ทั้งหมด ${displayedStudents.length} คน`
                      }
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="p-0">
                {loading ? (
                  <div className="h-64 flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-orange-400 mb-2.5" />
                    <span className="text-slate-400 text-xs font-medium">กำลังโหลดข้อมูลนักเรียน...</span>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="py-14 px-8 text-center">
                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-100 mb-4">
                      <Users className="h-7 w-7 text-slate-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-700 mb-1">ยังไม่มีข้อมูลนักเรียน</h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
                      {searchQuery ? "ไม่พบรายชื่อที่ตรงกับคำค้นหา" : 'กรุณาเพิ่มนักเรียนด้วยการ "นำเข้า Excel" หรือ "เพิ่มนักเรียน"'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/80">
                            <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">เลขที่</th>
                            <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-32">รหัสนักเรียน</th>
                            <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                            <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-20">ห้อง</th>
                            <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredStudents.map((student: any, idx: number) => (
                            <tr
                              key={student.studentId}
                              className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-orange-50/30 transition-colors`}
                            >
                              <td className="px-4 py-3.5 text-sm font-bold text-slate-400">{student.number}</td>
                              <td className="px-4 py-3.5 font-mono text-sm font-semibold text-slate-600">{student.studentId}</td>
                              <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{student.name}</td>
                              <td className="px-4 py-3.5 text-center text-sm font-semibold text-slate-500">{student.classroom || selectedClassroom}</td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => openEditDialog(student)}
                                    className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                    title="แก้ไขนักเรียน"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => { setStudentToDelete(student); setIsDeleteOpen(true); }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="ลบนักเรียน"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden divide-y divide-slate-100">
                      {filteredStudents.map((student: any) => (
                        <div key={student.studentId} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  #{student.number}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-400">{student.classroom || selectedClassroom}</span>
                              </div>
                              <p className="text-sm font-bold text-slate-800 truncate">{student.name}</p>
                              <p className="text-[11px] font-mono font-medium text-slate-400 mt-0.5">{student.studentId}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1">
                              <button
                                onClick={() => openEditDialog(student)}
                                className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setStudentToDelete(student); setIsDeleteOpen(true); }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-400">
                        แสดง {filteredStudents.length} รายการ
                      </span>
                      {viewMode === "classroom" && (
                        <span className="text-[10px] text-slate-400 font-medium">กดบันทึกเพื่อบันทึกลงฐานข้อมูล</span>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* ===== All Dialogs ===== */}

        {/* Excel Preview dialog */}
        <Dialog isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title="พรีวิวข้อมูลที่จะนำเข้า" description="ตรวจสอบข้อมูลก่อนกดยืนยันเพื่อบันทึกลงฐานข้อมูล">
          <div className="max-h-[70vh] overflow-y-auto space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
                <div className="text-[11px] font-bold text-gray-500">จำนวนห้อง</div>
                <div className="text-base font-extrabold text-orange-950">{Object.keys(previewByClassroom).length}</div>
              </div>
              <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
                <div className="text-[11px] font-bold text-gray-500">จำนวนแถวรวม</div>
                <div className="text-base font-extrabold text-orange-950">{Object.values(previewByClassroom).reduce((acc, list) => acc + (list?.length || 0), 0)}</div>
              </div>
              <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
                <div className="text-[11px] font-bold text-gray-500">ไฟล์ที่ถูกข้าม/ว่าง</div>
                <div className="text-base font-extrabold text-orange-950">{(previewSkippedSheets?.length || 0) + (previewEmptySheets?.length || 0)}</div>
              </div>
            </div>
            {previewSkippedSheets.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                <div className="text-sm font-bold text-amber-900">ข้าม sheet</div>
                <div className="text-xs text-amber-900/80 font-semibold">{previewSkippedSheets.join(", ")}</div>
              </div>
            )}
            {previewEmptySheets.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                <div className="text-sm font-bold text-amber-900">sheet ว่าง/ไม่ครบข้อมูล</div>
                <div className="text-xs text-amber-900/80 font-semibold">{previewEmptySheets.join(", ")}</div>
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
                          <TableCell className="text-center font-bold text-gray-600">{s.number}</TableCell>
                          <TableCell className="font-mono font-semibold text-gray-600">{s.studentId}</TableCell>
                          <TableCell className="font-semibold text-gray-800">{s.name}</TableCell>
                          <TableCell className="text-center font-semibold text-gray-600">{classroom}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" size="md" onClick={() => setIsPreviewOpen(false)} disabled={loading} className="px-6 py-2.5">ยกเลิก</Button>
            <Button variant="primary" size="md" onClick={handleConfirmExcelPreviewSave} loading={loading} className="px-6 py-2.5 font-bold">ยืนยันบันทึกลงฐานข้อมูล</Button>
          </div>
        </Dialog>

        {/* Manual Add dialog */}
        <Dialog isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="เพิ่มนักเรียนแบบระบุเอง">
          <form onSubmit={handleManualAddSubmit} className="space-y-4">
            <Select
              label="เลือกชั้น"
              value={newStudent.classroom ? newStudent.classroom.split("/")[0] : ""}
              onChange={(e) => {
                const level = e.target.value;
                const levelNum = level ? Number(level) : 2;
                const fallbackRoom = `${levelNum}/${1}`;
                const nextClassroom = CLASSROOMS.includes(fallbackRoom as any) ? fallbackRoom : CLASSROOMS.filter((c) => c.startsWith(`${levelNum}/`))[0] || "2/1";
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
              }).map((c) => ({ value: c, label: `ห้องเรียน ${c}` }))}
            />
            <Input label="รหัสประจำตัวนักเรียน" placeholder="เช่น 100101" value={newStudent.studentId} onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })} />
            <Input label="ชื่อ - นามสกุล" placeholder="เช่น เด็กชายสมจิต สมหวัง" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} />
            <Input label="เลขที่" placeholder="เช่น 1" type="number" value={newStudent.number} onChange={(e) => setNewStudent({ ...newStudent, number: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" size="md" onClick={() => setIsAddOpen(false)} className="px-6 py-2.5">ยกเลิก</Button>
              <Button type="submit" size="md" className="px-6 py-2.5 font-bold">เพิ่มลงตาราง</Button>
            </div>
          </form>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="แก้ไขข้อมูลนักเรียน" description="แก้ไขรายละเอียดของนักเรียน">
          <div className="space-y-6">
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <Input
                label="รหัสประจำตัวนักเรียน"
                placeholder="เช่น 100101"
                value={editingStudent.studentId}
                onChange={(e) => setEditingStudent({ ...editingStudent, studentId: e.target.value })}
              />
              <Input
                label="ชื่อ - นามสกุล"
                placeholder="เช่น เด็กชายสมจิต สมหวัง"
                value={editingStudent.name}
                onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
              />
              <Input
                label="เลขที่"
                placeholder="เช่น 1"
                type="number"
                value={editingStudent.number.toString()}
                onChange={(e) => setEditingStudent({ ...editingStudent, number: Math.max(1, parseInt(e.target.value) || 0) })}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" size="md" onClick={() => setIsEditOpen(false)} className="px-6 py-2.5">ยกเลิก</Button>
                <Button type="submit" size="md" className="px-6 py-2.5 font-bold">บันทึก</Button>
              </div>
            </form>

            {/* Move Classroom Section */}
            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-bold text-slate-700">ย้ายห้องเรียน</h4>
              </div>
              <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3.5 space-y-3">
                <div className="text-xs text-blue-800 font-semibold">
                  ห้องปัจจุบัน: {editingStudent.classroom || selectedClassroom}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={moveTargetClassroom}
                    onChange={(e) => setMoveTargetClassroom(e.target.value)}
                    className="flex-1 h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {CLASSROOMS.filter((c) => c !== (editingStudent.classroom || selectedClassroom)).map((c) => (
                      <option key={c} value={c}>ห้อง {c}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setStudentToMove({
                        studentId: editingStudent.studentId,
                        name: editingStudent.name,
                        number: editingStudent.number,
                        classroom: editingStudent.classroom || selectedClassroom
                      });
                      setIsEditOpen(false);
                      setIsMoveOpen(true);
                    }}
                    className="shrink-0 h-9 px-4 text-xs font-bold rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    ย้าย
                  </Button>
                </div>
                <p className="text-[10px] text-blue-600/80">ข้อมูลการเช็กชื่อและการตรวจระเบียบวินัยทั้งหมดจะถูกย้ายไปยังห้องใหม่ด้วย</p>
              </div>
            </div>
          </div>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="ยืนยันการลบนักเรียน" description="การดำเนินการนี้จะลบข้อมูลนักเรียนออกจากฐานข้อมูลทันที">
          <div className="space-y-3 font-semibold text-gray-800">
            <p>คุณแน่ใจหรือไม่ที่จะลบนักเรียน:</p>
            <div className="bg-red-50 border border-red-100 p-3.5 rounded-xl font-bold text-red-950">
              {studentToDelete?.name} (รหัส: {studentToDelete?.studentId}, เลขที่: {studentToDelete?.number})
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="md" onClick={() => setIsDeleteOpen(false)} className="px-6 py-2.5">ยกเลิก</Button>
            <Button variant="destructive" size="md" onClick={confirmDelete} loading={loading} className="px-6 py-2.5">ยืนยันลบข้อมูล</Button>
          </div>
        </Dialog>

        {/* Clear confirmation dialog */}
        <Dialog isOpen={isClearOpen} onClose={() => setIsClearOpen(false)} title="ยืนยันการล้างตารางชั่วคราว" description="การล้างตารางจะไม่เขียนบันทึกไปบนเซิร์ฟเวอร์จนกว่าคุณจะกดบันทึกจริง">
          <p className="font-semibold text-gray-700">คุณแน่ใจหรือไม่ที่จะล้างตารางรายชื่อทั้งหมดบนหน้าจอนี้ชั่วคราว?</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="md" onClick={() => setIsClearOpen(false)} className="px-6 py-2.5">ยกเลิก</Button>
            <Button variant="destructive" size="md" onClick={confirmClear} className="px-6 py-2.5">ล้างตาราง</Button>
          </div>
        </Dialog>

        {/* Delete All Students Dialog */}
        <Dialog isOpen={isDeleteAllStudentsOpen} onClose={() => setIsDeleteAllStudentsOpen(false)} title="ยืนยันการลบรายชื่อนักเรียนทั้งหมด" description="การดำเนินการนี้จะลบข้อมูลนักเรียนทั้งหมดจากฐานข้อมูลอย่างถาวร ไม่สามารถกู้คืนได้">
          <p className="font-semibold text-red-600">คุณแน่ใจหรือไม่ที่จะลบรายชื่อนักเรียนของทุกห้อง?</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="md" onClick={() => setIsDeleteAllStudentsOpen(false)} className="px-6 py-2.5">ยกเลิก</Button>
            <Button variant="destructive" size="md" onClick={handleClearAllStudents} loading={loading} className="px-6 py-2.5">ยืนยันการลบข้อมูล</Button>
          </div>
        </Dialog>

        {/* Delete All Attendance Dialog */}
        <Dialog isOpen={isDeleteAllAttendanceOpen} onClose={() => setIsDeleteAllAttendanceOpen(false)} title="ยืนยันการลบข้อมูลการเช็กชื่อทั้งหมด" description="การดำเนินการนี้จะลบข้อมูลการเช็กชื่อและการตรวจระเบียบวินัยทั้งหมดจากฐานข้อมูลอย่างถาวร ไม่สามารถกู้คืนได้">
          <p className="font-semibold text-red-600">คุณแน่ใจหรือไม่ที่จะลบข้อมูลการมาเข้าแถวและการแต่งกายของทุกห้อง?</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="md" onClick={() => setIsDeleteAllAttendanceOpen(false)} className="px-6 py-2.5">ยกเลิก</Button>
            <Button variant="destructive" size="md" onClick={handleClearAllAttendance} loading={loading} className="px-6 py-2.5">ยืนยันการลบข้อมูล</Button>
          </div>
        </Dialog>

        {/* Legacy Import Preview Dialog */}
        <Dialog isOpen={isLegacyPreviewOpen} onClose={() => {
          if (!isImportingLegacy) {
            setIsLegacyPreviewOpen(false);
            setLegacyImportResult(null);
          }
        }} title="พรีวิวข้อมูลการเช็กชื่อเก่า" description="ตรวจสอบข้อมูลก่อนนำเข้า">
          <div className="max-h-[70vh] overflow-y-auto space-y-4">
            {legacyImportProgress && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-amber-500" />
                <span className="text-sm font-semibold text-amber-800">{legacyImportProgress}</span>
              </div>
            )}

            {legacyImportResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="text-[11px] font-bold text-gray-500">นำเข้าสำเร็จ</div>
                    <div className="text-base font-extrabold text-emerald-800">{legacyImportResult.completedClassrooms}/{legacyImportResult.totalClassrooms} ห้อง</div>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="text-[11px] font-bold text-gray-500">บันทึกรายการ</div>
                    <div className="text-base font-extrabold text-emerald-800">{legacyImportResult.totalAttendanceSaved} รายการ</div>
                  </div>
                </div>
                {legacyImportResult.totalStudentsCreated > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                    <div className="text-sm font-bold text-blue-900">สร้างนักเรียนใหม่</div>
                    <div className="text-xs text-blue-900/80 font-semibold">เพิ่มนักเรียนใหม่ {legacyImportResult.totalStudentsCreated} คน</div>
                  </div>
                )}
                {legacyImportResult.errors.length > 0 && (
                  <div className="rounded-xl border border-red-100 bg-red-50/40 p-3">
                    <div className="text-sm font-bold text-red-900">ข้อผิดพลาด</div>
                    <div className="text-xs text-red-900/80 font-semibold max-h-32 overflow-y-auto">
                      {legacyImportResult.errors.map((err, i) => (
                        <div key={i}>- {err}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" size="md" onClick={() => { setIsLegacyPreviewOpen(false); setLegacyImportResult(null); }} className="px-6 py-2.5">ปิด</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <div className="text-[11px] font-bold text-gray-500">จำนวนห้อง</div>
                    <div className="text-base font-extrabold text-amber-950">{legacyPreviewData.length}</div>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <div className="text-[11px] font-bold text-gray-500">วันทั้งหมด</div>
                    <div className="text-base font-extrabold text-amber-950">{legacyPreviewData.reduce((acc, c) => acc + c.attendanceDays.length, 0)}</div>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <div className="text-[11px] font-bold text-gray-500">รายการเช็กชื่อ</div>
                    <div className="text-base font-extrabold text-amber-950">{legacyPreviewData.reduce((acc, c) => acc + c.attendanceDays.reduce((a, d) => a + d.records.length, 0), 0)}</div>
                  </div>
                </div>
                {legacySkippedSheets.length > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <div className="text-sm font-bold text-amber-900">ข้าม sheet</div>
                    <div className="text-xs text-amber-900/80 font-semibold">{legacySkippedSheets.join(", ")}</div>
                  </div>
                )}
                {legacyPreviewData.map((classroomData) => (
                  <div key={classroomData.classroom} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-extrabold text-amber-950">ห้องเรียน {classroomData.classroom}</div>
                        {classroomData.isSapfan && (
                          <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">สานฝัน</span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-gray-500">{classroomData.attendanceDays.length} วัน | {classroomData.studentNumbers.length} คน</div>
                    </div>

                    {/* Student List Preview - first 5 students */}
                    {classroomData.studentHeaders.length > 0 && (
                      <div className="border border-amber-100 rounded-xl overflow-hidden">
                        <div className="text-[10px] font-bold text-amber-700 bg-amber-50 px-3 py-1.5 border-b border-amber-100">
                          รายชื่อนักเรียน (แสดง {Math.min(5, classroomData.studentHeaders.length)} ใน {classroomData.studentHeaders.length} คน)
                        </div>
                        <div className="divide-y divide-amber-50">
                          {classroomData.studentHeaders.slice(0, 5).map((header, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                              <span className="font-bold text-gray-400 w-5 text-right">{idx + 1}.</span>
                              <span className="font-semibold text-gray-700 truncate">{header}</span>
                            </div>
                          ))}
                          {classroomData.studentHeaders.length > 5 && (
                            <div className="px-3 py-1.5 text-[10px] text-gray-400 italic">
                              ...และอีก {classroomData.studentHeaders.length - 5} คน
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Attendance Days Table */}
                    <div className="border border-amber-100 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-amber-50">
                          <TableRow>
                            <TableHead className="w-24">วันที่</TableHead>
                            <TableHead className="w-16 text-center">คนที่เช็ก</TableHead>
                            <TableHead>สถานะ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classroomData.attendanceDays.slice(0, 10).map((day) => {
                            const statusCount: Record<string, number> = {};
                            day.records.forEach((r) => {
                              const key = r.status || "ไม่ระบุ";
                              statusCount[key] = (statusCount[key] || 0) + 1;
                            });
                            const statusStr = Object.entries(statusCount)
                              .map(([k, v]) => `${k} ${v}`)
                              .join(", ");
                            return (
                              <TableRow key={day.date}>
                                <TableCell className="font-mono text-xs font-semibold text-gray-600">{day.date}</TableCell>
                                <TableCell className="text-center font-bold text-gray-600">{day.records.length}</TableCell>
                                <TableCell className="text-xs text-gray-500">{statusStr}</TableCell>
                              </TableRow>
                            );
                          })}
                          {classroomData.attendanceDays.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-xs text-gray-400 font-semibold py-2">
                                ...และอีก {classroomData.attendanceDays.length - 10} วัน
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3">
                  <p className="text-xs text-amber-900 font-semibold">
                    ⚠️ ระบบจะใช้ <strong>เลขที่</strong> ของนักเรียนในการ match กับฐานข้อมูล กรุณาตรวจสอบว่านักเรียนในห้องนั้นๆ มีข้อมูลอยู่ในระบบแล้ว
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" size="md" onClick={() => { setIsLegacyPreviewOpen(false); setLegacyImportResult(null); }} disabled={isImportingLegacy} className="px-6 py-2.5">ยกเลิก</Button>
                  <Button variant="primary" size="md" onClick={handleConfirmLegacyImport} loading={isImportingLegacy} className="px-6 py-2.5 font-bold bg-amber-500 hover:bg-amber-600">ยืนยันนำเข้าข้อมูลเก่า</Button>
                </div>
              </>
            )}
          </div>
        </Dialog>

        {/* Move Student Dialog */}
        <Dialog isOpen={isMoveOpen} onClose={() => setIsMoveOpen(false)} title="ย้ายห้องเรียนของนักเรียน" description="ย้ายนักเรียนไปยังห้องเรียนอื่น พร้อมข้อมูลการเช็กชื่อและการตรวจระเบียบวินัย">
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl">
              <div className="text-sm font-bold text-blue-900">นักเรียนที่ต้องการย้าย</div>
              <div className="text-sm font-semibold text-blue-800 mt-1">
                {studentToMove.name} (รหัส: {studentToMove.studentId}, เลขที่: {studentToMove.number})
              </div>
              <div className="text-xs font-medium text-blue-600 mt-0.5">
                ห้องปัจจุบัน: {studentToMove.classroom}
              </div>
            </div>

            <Select
              label="ย้ายไปยังห้อง"
              value={moveTargetClassroom}
              onChange={(e) => setMoveTargetClassroom(e.target.value)}
              options={CLASSROOMS.filter((c) => c !== studentToMove.classroom).map((c) => ({
                value: c,
                label: `ห้องเรียน ${c}`
              }))}
            />

            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <p className="text-xs text-amber-900 font-semibold">
                ⚠️ ข้อมูลการเช็กชื่อและการตรวจระเบียบวินัยทั้งหมดของนักเรียนคนนี้จะถูกย้ายไปยังห้องใหม่ด้วย
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="md" onClick={() => setIsMoveOpen(false)} disabled={isMoving} className="px-6 py-2.5">ยกเลิก</Button>
            <Button size="md" onClick={handleMoveStudent} loading={isMoving} className="px-6 py-2.5 font-bold bg-blue-500 hover:bg-blue-600 text-white">
               ยืนยันย้ายห้อง
            </Button>
          </div>
        </Dialog>

        {/* Deduction Settings Dialog */}
        <Dialog isOpen={isDeductionOpen} onClose={() => setIsDeductionOpen(false)} title="แก้ไขค่าการหักคะแนนระเบียบวินัย" description="กำหนดจำนวนคะแนนที่จะหักเมื่อนักเรียนตรวจไม่ผ่านในแต่ละประเภท">
          <div className="space-y-5">
            <div className="space-y-3">
              <Input label="การแต่งกาย (คะแนนที่หักต่อครั้ง)" type="number" min={0} value={editDeductionSettings.uniformDeduction.toString()} onChange={(e) => setEditDeductionSettings({ ...editDeductionSettings, uniformDeduction: Math.max(0, parseInt(e.target.value) || 0) })} />
              <Input label="ทรงผม (คะแนนที่หักต่อครั้ง)" type="number" min={0} value={editDeductionSettings.hairDeduction.toString()} onChange={(e) => setEditDeductionSettings({ ...editDeductionSettings, hairDeduction: Math.max(0, parseInt(e.target.value) || 0) })} />
              <Input label="เล็บมือ (คะแนนที่หักต่อครั้ง)" type="number" min={0} value={editDeductionSettings.nailDeduction.toString()} onChange={(e) => setEditDeductionSettings({ ...editDeductionSettings, nailDeduction: Math.max(0, parseInt(e.target.value) || 0) })} />
            </div>
            <p className="text-xs text-gray-500">ค่าเริ่มต้น: แต่งกาย 10 คะแนน, ทรงผม 10 คะแนน, เล็บมือ 5 คะแนน</p>
          </div>
          <div className="flex justify-between gap-3 pt-4">
            <Button variant="outline" size="md" onClick={handleResetDeductionSettings} className="px-5 py-2.5">รีเซ็ตเป็นค่าเริ่มต้น</Button>
            <div className="flex gap-3">
              <Button variant="outline" size="md" onClick={() => setIsDeductionOpen(false)} className="px-6 py-2.5">ยกเลิก</Button>
              <Button size="md" onClick={handleSaveDeductionSettings} className="px-6 py-2.5 font-bold">บันทึกการตั้งค่า</Button>
            </div>
          </div>
        </Dialog>

        {/* Late Penalty Settings Dialog */}
        <Dialog isOpen={isLatePenaltyOpen} onClose={() => setIsLatePenaltyOpen(false)} title="แก้ไขค่าการหักคะแนนมาสาย" description="กำหนดจำนวนครั้งที่มาสายที่จะหักคะแนน และจำนวนคะแนนที่หัก">
          <div className="space-y-5">
            <div className="space-y-3">
              <Input label="หักคะแนนเมื่อสายครบ (ครั้ง)" type="number" min={1} value={editLatePenaltySettings.lateThreshold.toString()} onChange={(e) => setEditLatePenaltySettings({ ...editLatePenaltySettings, lateThreshold: Math.max(1, parseInt(e.target.value) || 1) })} />
              <Input label="จำนวนคะแนนที่หัก (ต่อครั้ง)" type="number" min={0} value={editLatePenaltySettings.penaltyPoints.toString()} onChange={(e) => setEditLatePenaltySettings({ ...editLatePenaltySettings, penaltyPoints: Math.max(0, parseInt(e.target.value) || 0) })} />
            </div>
            <p className="text-xs text-gray-500">ค่าเริ่มต้น: หักทุก 3 ครั้ง, หัก 5 คะแนนต่อครั้ง</p>
          </div>
          <div className="flex justify-between gap-3 pt-4">
            <Button variant="outline" size="md" onClick={handleResetLatePenaltySettings} className="px-5 py-2.5">รีเซ็ตเป็นค่าเริ่มต้น</Button>
            <div className="flex gap-3">
              <Button variant="outline" size="md" onClick={() => setIsLatePenaltyOpen(false)} className="px-6 py-2.5">ยกเลิก</Button>
              <Button size="md" onClick={handleSaveLatePenaltySettings} className="px-6 py-2.5 font-bold">บันทึกการตั้งค่า</Button>
            </div>
          </div>
        </Dialog>

      </div>
    </div>
  );
}
