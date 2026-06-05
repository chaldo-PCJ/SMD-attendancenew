"use client";

// API client to communicate with Google Apps Script Web App or fall back to localStorage Mock DB.

const TIMEOUT_MS = 30000; // 30 seconds

// Type definitions
export interface Student {
  studentId: string;
  name: string;
  number: number;
}

export interface AttendanceRecord {
  classroom: string;
  date: string;
  studentId: string;
  studentName: string;
  status: "มา" | "สาย" | "ลา" | "ขาด";
  timestamp?: string;
}

// Initial Mock Students for testing
const INITIAL_MOCK_STUDENTS: { [classroom: string]: Student[] } = {
  "2/1": [
    { studentId: "1001", name: "เด็กชายสมชาย รักดี", number: 1 },
    { studentId: "1002", name: "เด็กหญิงสมศรี มีสุข", number: 2 },
    { studentId: "1003", name: "เด็กชายวิทยา เรียนเก่ง", number: 3 },
    { studentId: "1004", name: "เด็กหญิงกนกวรรณ ใจงาม", number: 4 },
    { studentId: "1005", name: "เด็กชายปกรณ์ อดทน", number: 5 },
  ],
  "2/2": [
    { studentId: "2001", name: "เด็กชายกิตติศักดิ์ พลอยดี", number: 1 },
    { studentId: "2002", name: "เด็กหญิงสุดา วงศ์สว่าง", number: 2 },
    { studentId: "2003", name: "เด็กชายชูชัย ใจเพชร", number: 3 },
  ],
  "3/1": [
    { studentId: "3001", name: "เด็กหญิงดวงพร นามไพเราะ", number: 1 },
    { studentId: "3002", name: "เด็กชายเอกราช สุวรรณ", number: 2 },
  ]
};

// Helper for localStorage
const getMockData = (key: string, defaultValue: any) => {
  if (typeof window === "undefined") return defaultValue;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

const setMockData = (key: string, value: any) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
};

// Setup Mock DB in localStorage if empty
if (typeof window !== "undefined") {
  if (!localStorage.getItem("attendance_mock_students")) {
    setMockData("attendance_mock_students", INITIAL_MOCK_STUDENTS);
  }
  if (!localStorage.getItem("attendance_mock_records")) {
    // Some pre-populated attendance records for visual stats
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const dayBefore = new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0];
    
    const mockRecords: AttendanceRecord[] = [
      // Today 2/1
      { classroom: "2/1", date: today, studentId: "1001", studentName: "เด็กชายสมชาย รักดี", status: "มา" },
      { classroom: "2/1", date: today, studentId: "1002", studentName: "เด็กหญิงสมศรี มีสุข", status: "มา" },
      { classroom: "2/1", date: today, studentId: "1003", studentName: "เด็กชายวิทยา เรียนเก่ง", status: "สาย" },
      { classroom: "2/1", date: today, studentId: "1004", studentName: "เด็กหญิงกนกวรรณ ใจงาม", status: "ลา" },
      { classroom: "2/1", date: today, studentId: "1005", studentName: "เด็กชายปกรณ์ อดทน", status: "ขาด" },
      
      // Yesterday 2/1 (Complete)
      { classroom: "2/1", date: yesterday, studentId: "1001", studentName: "เด็กชายสมชาย รักดี", status: "มา" },
      { classroom: "2/1", date: yesterday, studentId: "1002", studentName: "เด็กหญิงสมศรี มีสุข", status: "มา" },
      { classroom: "2/1", date: yesterday, studentId: "1003", studentName: "เด็กชายวิทยา เรียนเก่ง", status: "มา" },
      { classroom: "2/1", date: yesterday, studentId: "1004", studentName: "เด็กหญิงกนกวรรณ ใจงาม", status: "มา" },
      { classroom: "2/1", date: yesterday, studentId: "1005", studentName: "เด็กชายปกรณ์ อดทน", status: "มา" },
      
      // Day before 2/1 (Incomplete record: only 3 checked)
      { classroom: "2/1", date: dayBefore, studentId: "1001", studentName: "เด็กชายสมชาย รักดี", status: "มา" },
      { classroom: "2/1", date: dayBefore, studentId: "1002", studentName: "เด็กหญิงสมศรี มีสุข", status: "มา" },
      { classroom: "2/1", date: dayBefore, studentId: "1003", studentName: "เด็กชายวิทยา เรียนเก่ง", status: "ขาด" },

      // Today 2/2
      { classroom: "2/2", date: today, studentId: "2001", studentName: "เด็กชายกิตติศักดิ์ พลอยดี", status: "มา" },
      { classroom: "2/2", date: today, studentId: "2002", studentName: "เด็กหญิงสุดา วงศ์สว่าง", status: "มา" },
      { classroom: "2/2", date: today, studentId: "2003", studentName: "เด็กชายชูชัย ใจเพชร", status: "มา" },
    ];
    setMockData("attendance_mock_records", mockRecords);
  }
}

// Fetch helper with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Check if Apps Script URL is set and valid
export const getScriptUrl = (): string => {
  return process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
};

export const isMockMode = (): boolean => {
  if (typeof window === "undefined") return true;
  const scriptUrl = getScriptUrl();
  const forcedMock = localStorage.getItem("force_mock_mode") === "true";
  return !scriptUrl || forcedMock;
};

export const setForceMockMode = (force: boolean) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("force_mock_mode", force ? "true" : "false");
    window.location.reload();
  }
};

// ---- Client-side caching + request coalescing ----
const MEM_CACHE = new Map<string, { expiresAt: number; value: any }>();
const INFLIGHT = new Map<string, Promise<any>>();
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const nowMs = () => Date.now();

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getCacheStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getCachedValue(key: string): any | null {
  const mem = MEM_CACHE.get(key);
  if (mem && mem.expiresAt > nowMs()) return mem.value;

  const ls = getCacheStorage();
  if (!ls) return null;
  const raw = ls.getItem(key);
  if (!raw) return null;
  const parsed = safeJsonParse<{ expiresAt: number; value: any }>(raw);
  if (!parsed) return null;
  if (parsed.expiresAt <= nowMs()) return null;

  MEM_CACHE.set(key, parsed);
  return parsed.value;
}

function setCachedValue(key: string, value: any, ttlMs: number) {
  const expiresAt = nowMs() + ttlMs;
  const entry = { expiresAt, value };
  MEM_CACHE.set(key, entry);

  const ls = getCacheStorage();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

function cacheKey(action: string, payload: any) {
  // stable-ish key
  return `api_cache_v1:${action}:${JSON.stringify(normalizePayloadForKey(payload || {}))}`;
}


function normalizePayloadForKey(payload: any) {
  // ensure consistent key for undefined vs missing props
  if (!payload || typeof payload !== "object") return payload;
  return Object.keys(payload)
    .sort()
    .reduce((acc: any, k) => {
      acc[k] = payload[k];
      return acc;
    }, {});
}


// Generic API caller
async function callApi(action: string, payload: any = {}): Promise<any> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 600));
    return handleMockRequest(action, payload);
  }

  const url = getScriptUrl();
  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      // Content-Type: text/plain avoids browser pre-flight OPTIONS requests (CORS)
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action, ...payload }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Failed to parse JSON response from server. Check web app deployment.");
    }

    if (data.success === false) {
      throw new Error(data.error || "Unknown server error");
    }

    return data;
  } catch (error: any) {
    console.error("API Call Failed:", error);
    if (error.name === "AbortError") {
      throw new Error("หมดเวลาการเชื่อมต่อ (30 วินาที) กรุณาลองใหม่อีกครั้ง");
    }
    throw new Error(error.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
  }
}

async function callApiCached(
  action: string,
  payload: any,
  opts: { ttlMs?: number; useCache?: boolean } = {}
): Promise<any> {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const useCache = opts.useCache !== false;
  const key = cacheKey(action, payload);

  if (useCache) {
    const cached = getCachedValue(key);
    if (cached !== null) return cached;
  }

  const inflightKey = `inflight:${key}`;
  const existing = INFLIGHT.get(inflightKey);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await callApi(action, payload);
      if (useCache) setCachedValue(key, res, ttlMs);
      return res;
    } finally {
      INFLIGHT.delete(inflightKey);
    }
  })();

  INFLIGHT.set(inflightKey, p);
  return p;
}

function invalidateCaches(prefixes: string[]) {
  // best-effort invalidation (memory + localStorage)
  for (const [k] of MEM_CACHE.entries()) {
    if (prefixes.some((p) => k.startsWith(p))) MEM_CACHE.delete(k);
  }

  const ls = getCacheStorage();
  if (!ls) return;

  for (let i = ls.length - 1; i >= 0; i--) {
    const k = ls.key(i);
    if (!k) continue;
    if (prefixes.some((p) => k.startsWith(p))) ls.removeItem(k);
  }
}


// Mock Request Handler
function handleMockRequest(action: string, payload: any): any {
  const mockStudents = getMockData("attendance_mock_students", {});
  const mockRecords: AttendanceRecord[] = getMockData("attendance_mock_records", []);

  switch (action) {
    case "getStudents": {
      const cls = payload.classroom;
      const list = mockStudents[cls] || [];
      return { success: true, students: list };
    }
    case "saveStudents": {
      const cls = payload.classroom;
      const list = payload.students || [];
      const updated = { ...mockStudents, [cls]: list };
      setMockData("attendance_mock_students", updated);
      return { success: true, count: list.length };
    }
    case "deleteStudent": {
      const cls = payload.classroom;
      const sid = payload.studentId;
      const list = mockStudents[cls] || [];
      const filtered = list.filter((s: Student) => String(s.studentId).trim() !== String(sid).trim());
      
      if (list.length === filtered.length) {
        return { success: false, error: `ไม่พบรหัสนักเรียน ${sid} ในชั้นเรียน ${cls}` };
      }
      
      const updated = { ...mockStudents, [cls]: filtered };
      setMockData("attendance_mock_students", updated);
      return { success: true, message: `ลบนักเรียนรหัส ${sid} สำเร็จ` };
    }
    case "saveAttendance": {
      const cls = payload.classroom;
      const date = payload.date;
      const list = payload.attendance || [];

      // Remove existing for this classroom + date
      let filteredRecords = mockRecords.filter(
        (r) => !(r.classroom === cls && r.date === date)
      );

      // Append new
      const timestamp = new Date().toISOString();
      const newRecords = list.map((item: any) => ({
        classroom: cls,
        date: date,
        studentId: item.studentId,
        studentName: item.studentName,
        status: item.status,
        timestamp,
      }));

      const updated = [...filteredRecords, ...newRecords];
      setMockData("attendance_mock_records", updated);
      return { success: true, count: newRecords.length, date };
    }
    case "getAttendance": {
      const cls = payload.classroom;
      const date = payload.date;

      let list = [...mockRecords];
      if (cls) {
        list = list.filter((r) => r.classroom === cls);
      }
      if (date) {
        list = list.filter((r) => r.date === date);
      }

      return { success: true, attendance: list };
    }
    default:
      return { success: false, error: "Mock action not found" };
  }
}

// Exported API Methods
export const api = {
  // Cache-first (6h) for roster/reference data
  getStudents: (classroom: string): Promise<{ success: boolean; students: Student[] }> =>
    callApiCached("getStudents", { classroom }, { ttlMs: DEFAULT_TTL_MS }),

  getAllStudents: (): Promise<{ success: boolean; students: (Student & { classroom: string })[] }> =>
    callApiCached("getAllStudents", {}, { ttlMs: DEFAULT_TTL_MS }),



  // Invalidate caches after writes
  saveStudents: (classroom: string, students: Student[]): Promise<{ success: boolean; count: number }> =>
    callApi("saveStudents", { classroom, students }).then((res) => {
      // roster changed for classroom => invalidate roster + attendance
      invalidateCaches(["api_cache_v1:getStudents:", "api_cache_v1:getAttendance:"]);
      return res;
    }),


  deleteStudent: (classroom: string, studentId: string): Promise<{ success: boolean; message: string }> =>
    callApi("deleteStudent", { classroom, studentId }).then((res) => {
      // invalidate roster + any attendance query
      invalidateCaches(["api_cache_v1:getStudents:", "api_cache_v1:getAttendance:"]);
      return res;
    }),


  saveAttendance: (
    classroom: string,
    date: string,
    attendance: { studentId: string; studentName: string; status: string }[]
  ): Promise<{ success: boolean; count: number; date: string }> =>
    callApi("saveAttendance", { classroom, date, attendance }).then((res) => {
      // Attendance changes affect any attendance query
      invalidateCaches(["api_cache_v1:getAttendance:"]);
      return res;
    }),


  // Cache-first (6h) for attendance queries; still safe because roster rarely changes and day attendance changes only when saving
  getAttendance: (
    classroom?: string,
    date?: string
  ): Promise<{ success: boolean; attendance: AttendanceRecord[] }> =>
    callApiCached("getAttendance", { classroom, date }, { ttlMs: DEFAULT_TTL_MS }),
};

