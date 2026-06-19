"use client";

import { supabase } from './supabase';

export interface Student {
  studentId: string;
  name: string;
  number: number;
  classroom?: string;
}

export interface AttendanceRecord {
  classroom: string;
  date: string;
  studentId: string;
  studentName: string;
  status: "มา" | "สาย" | "ลา" | "ขาด";
  timestamp?: string;
}

export interface UniformCheckRecord {
  studentId: string;
  studentName: string;
  uniformPass: boolean | null;
  uniformReason?: string;
  hairPass: boolean | null;
  hairReason?: string;
  nailPass: boolean | null;
  nailReason?: string;
  number?: number;
}

export const isMockMode = (): boolean => {
  return false;
};

export const setForceMockMode = (force: boolean) => {
  // stub
};

export const getScriptUrl = (): string => {
  return process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
};

// Exported API Methods
export const api = {
  getStudents: async (classroom: string): Promise<{ success: boolean; students: Student[] }> => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('classroom', classroom)
      .order('number', { ascending: true });
    
    if (error) {
      console.error("Error fetching students:", error);
      return { success: false, students: [] };
    }
    
    const formattedStudents = data.map((d: any) => ({
      studentId: d.student_id,
      name: d.name,
      number: d.number,
      classroom: d.classroom
    }));
    return { success: true, students: formattedStudents };
  },

  getAllStudents: async (): Promise<{ success: boolean; students: Student[] }> => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('classroom', { ascending: true })
      .order('number', { ascending: true });
    
    if (error) {
      console.error("Error fetching all students:", error);
      return { success: false, students: [] };
    }
    
    const formattedStudents = data.map((d: any) => ({
      studentId: d.student_id,
      name: d.name,
      number: d.number,
      classroom: d.classroom
    }));
    return { success: true, students: formattedStudents };
  },

  saveStudents: async (classroom: string, students: Student[]): Promise<{ success: boolean; count: number }> => {
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .eq('classroom', classroom);
      
    if (deleteError) {
      console.error("Error deleting old students:", deleteError);
      return { success: false, count: 0 };
    }

    if (students.length === 0) {
        return { success: true, count: 0 };
    }

    const studentsToInsert = students.map(s => ({
      student_id: s.studentId,
      name: s.name,
      number: s.number,
      classroom: classroom
    }));

    const { error } = await supabase
      .from('students')
      .insert(studentsToInsert);
      
    if (error) {
      console.error("Error inserting students:", error);
      return { success: false, count: 0 };
    }

    // แอบรัน Background ส่งข้อมูลนักเรียนไป Google Sheet
    const scriptUrl = getScriptUrl();
    if (scriptUrl) {
      try {
        const payload = {
          action: "saveStudents",
          room: classroom.replace("/", ""),
          students: studentsToInsert.map(s => ({
            studentId: s.student_id,
            number: s.number,
            name: s.name,
            className: s.classroom
          }))
        };
        fetch(scriptUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        }).catch(err => console.error("Error sending students to Apps Script:", err));
      } catch (err) {
        console.error("Error formatting payload for Apps Script:", err);
      }
    }

    return { success: true, count: studentsToInsert.length };
  },

  deleteStudent: async (classroom: string, studentId: string): Promise<{ success: boolean; message: string }> => {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('classroom', classroom)
      .eq('student_id', studentId);

    if (error) {
      console.error("Error deleting student:", error);
      return { success: false, message: "Error deleting student" };
    }
    return { success: true, message: `ลบนักเรียนรหัส ${studentId} สำเร็จ` };
  },

  saveAttendance: async (
    classroom: string,
    date: string,
    attendance: { studentId: string; studentName: string; number?: number; status: string }[]
  ): Promise<{ success: boolean; count: number; date: string }> => {
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('classroom', classroom)
      .eq('date', date);

    if (deleteError) {
      console.error("Error deleting old attendance:", deleteError);
      return { success: false, count: 0, date };
    }

    if (attendance.length === 0) {
      return { success: true, count: 0, date };
    }

    const attendanceToInsert = attendance.map(a => ({
      classroom: classroom,
      date: date,
      student_id: a.studentId,
      student_name: a.studentName,
      status: a.status
    }));

    const { error } = await supabase
      .from('attendance')
      .insert(attendanceToInsert);

    if (error) {
      console.error("Error inserting attendance:", error);
      return { success: false, count: 0, date };
    }

    // Send to Google Sheets via Apps Script Web App
    const scriptUrl = getScriptUrl();
    if (scriptUrl) {
      try {
        const payload = {
          action: "saveAttendance",
          room: classroom.replace("/", ""), // e.g. "2/1" -> "21"
          date: date,
          attendance: attendance.map(a => ({
            studentId: a.studentId,
            number: a.number || "",
            name: a.studentName,
            className: classroom,
            status: a.status
          }))
        };
        fetch(scriptUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        }).catch(err => console.error("Error sending to Apps Script:", err));
      } catch (err) {
        console.error("Error formatting payload for Apps Script:", err);
      }
    }

    return { success: true, count: attendanceToInsert.length, date };
  },

  getAttendance: async (
    classroom?: string,
    date?: string
  ): Promise<{ success: boolean; attendance: AttendanceRecord[] }> => {
    let query = supabase.from('attendance').select('*', { count: 'exact' }).limit(50000);
    if (classroom) {
      query = query.eq('classroom', classroom);
    }
    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching attendance:", error);
      return { success: false, attendance: [] };
    }

    const formattedAttendance: AttendanceRecord[] = data.map((d: any) => ({
      classroom: d.classroom,
      date: d.date,
      studentId: d.student_id,
      studentName: d.student_name,
      status: d.status,
      timestamp: d.timestamp
    }));

    return { success: true, attendance: formattedAttendance };
  },

  saveUniformCheck: async (
    classroom: string,
    date: string,
    teacherName: string,
    checks: UniformCheckRecord[]
  ): Promise<{ success: boolean; count: number; date: string }> => {
    const { error: deleteError } = await supabase
      .from('uniform_checks')
      .delete()
      .eq('classroom', classroom)
      .eq('date', date);

    if (deleteError) {
      console.error("Error deleting old uniform checks:", deleteError);
      return { success: false, count: 0, date };
    }

    if (checks.length === 0) {
      return { success: true, count: 0, date };
    }

    const checksToInsert = checks.map(c => ({
      classroom: classroom,
      date: date,
      teacher_name: teacherName,
      student_id: c.studentId,
      student_name: c.studentName,
      uniform_pass: c.uniformPass,
      uniform_reason: c.uniformReason,
      hair_pass: c.hairPass,
      hair_reason: c.hairReason,
      nail_pass: c.nailPass,
      nail_reason: c.nailReason
    }));

    const { error } = await supabase
      .from('uniform_checks')
      .insert(checksToInsert);

    if (error) {
      console.error("Error inserting uniform checks:", error);
      return { success: false, count: 0, date };
    }

    return { success: true, count: checksToInsert.length, date };
  },

  getUniformCheck: async (
    classroom: string,
    date: string
  ): Promise<{ success: boolean; checks: UniformCheckRecord[]; teacherName?: string }> => {
    const { data, error } = await supabase
      .from('uniform_checks')
      .select('*')
      .eq('classroom', classroom)
      .eq('date', date);
    
    if (error) {
      console.error("Error fetching uniform checks:", error);
      return { success: false, checks: [] };
    }

    if (!data || data.length === 0) {
      return { success: true, checks: [] };
    }

    const teacherName = data[0].teacher_name;

    const formattedChecks: UniformCheckRecord[] = data.map((d: any) => ({
      studentId: d.student_id,
      studentName: d.student_name,
      uniformPass: d.uniform_pass,
      uniformReason: d.uniform_reason,
      hairPass: d.hair_pass,
      hairReason: d.hair_reason,
      nailPass: d.nail_pass,
      nailReason: d.nail_reason
    }));

    return { success: true, checks: formattedChecks, teacherName };
  },

  getAllUniformChecks: async (
    classroom?: string
  ): Promise<{ success: boolean; checks: (UniformCheckRecord & { date: string, classroom: string })[] }> => {
    let query = supabase.from('uniform_checks').select('*');
    
    if (classroom) {
      query = query.eq('classroom', classroom);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching all uniform checks:", error);
      return { success: false, checks: [] };
    }

    if (!data || data.length === 0) {
      return { success: true, checks: [] };
    }

    const formattedChecks = data.map((d: any) => ({
      studentId: d.student_id,
      studentName: d.student_name,
      uniformPass: d.uniform_pass,
      uniformReason: d.uniform_reason,
      hairPass: d.hair_pass,
      hairReason: d.hair_reason,
      nailPass: d.nail_pass,
      nailReason: d.nail_reason,
      date: d.date,
      classroom: d.classroom
    }));

    return { success: true, checks: formattedChecks };
  },

  deleteAllStudents: async (): Promise<{ success: boolean; message: string }> => {
    const { error } = await supabase
      .from('students')
      .delete()
      .neq('classroom', 'NONE_CLASSROOM');
    if (error) {
      console.error("Error deleting all students:", error);
      return { success: false, message: "เกิดข้อผิดพลาดในการลบข้อมูลนักเรียนทั้งหมด" };
    }
    return { success: true, message: "ลบข้อมูลรายชื่อนักเรียนทั้งหมดสำเร็จ" };
  },

  deleteAllAttendance: async (): Promise<{ success: boolean; message: string }> => {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .neq('classroom', 'NONE_CLASSROOM');
    if (error) {
      console.error("Error deleting all attendance:", error);
      return { success: false, message: "เกิดข้อผิดพลาดในการลบข้อมูลการเช็กชื่อทั้งหมด" };
    }
    return { success: true, message: "ลบข้อมูลการเช็กชื่อทั้งหมดสำเร็จ" };
  },

  deleteAllUniformChecks: async (): Promise<{ success: boolean; message: string }> => {
    const { error } = await supabase
      .from('uniform_checks')
      .delete()
      .neq('classroom', 'NONE_CLASSROOM');
    if (error) {
      console.error("Error deleting all uniform checks:", error);
      return { success: false, message: "เกิดข้อผิดพลาดในการลบข้อมูลการตรวจระเบียบวินัยทั้งหมด" };
    }
    return { success: true, message: "ลบข้อมูลการตรวจระเบียบวินัยทั้งหมดสำเร็จ" };
  },

  // ===== Deduction Settings (Database-backed) =====

  getDeductionSettings: async (): Promise<{ success: boolean; settings: DeductionSettings | null }> => {
    try {
      const { data, error } = await supabase
        .from('discipline_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // Table might be empty, return defaults
        if (error.code === 'PGRST116') {
          return { success: true, settings: null };
        }
        console.error("Error fetching deduction settings:", error);
        return { success: false, settings: null };
      }

      if (!data) {
        return { success: true, settings: null };
      }

      return {
        success: true,
        settings: {
          uniformDeduction: data.uniform_deduction ?? DEFAULT_DEDUCTION_SETTINGS.uniformDeduction,
          hairDeduction: data.hair_deduction ?? DEFAULT_DEDUCTION_SETTINGS.hairDeduction,
          nailDeduction: data.nail_deduction ?? DEFAULT_DEDUCTION_SETTINGS.nailDeduction,
        },
      };
    } catch (err) {
      console.error("Error getting deduction settings:", err);
      return { success: false, settings: null };
    }
  },

  saveDeductionSettings: async (settings: DeductionSettings): Promise<{ success: boolean; message: string }> => {
    try {
      // Delete all existing rows (we only keep one)
      const { error: deleteError } = await supabase
        .from('discipline_settings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (deleteError && deleteError.code !== 'PGRST116') {
        console.error("Error deleting old settings:", deleteError);
        // Continue anyway - try to insert
      }

      const { error: insertError } = await supabase
        .from('discipline_settings')
        .insert({
          uniform_deduction: settings.uniformDeduction,
          hair_deduction: settings.hairDeduction,
          nail_deduction: settings.nailDeduction,
        });

      if (insertError) {
        console.error("Error inserting deduction settings:", insertError);
        return { success: false, message: "ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้" };
      }

      return { success: true, message: "บันทึกการตั้งค่าการหักคะแนนระเบียบวินัยเรียบร้อย" };
    } catch (err) {
      console.error("Error saving deduction settings:", err);
      return { success: false, message: "เกิดข้อผิดพลาดในการบันทึก" };
    }
  },
};

export interface DeductionSettings {
  uniformDeduction: number;
  hairDeduction: number;
  nailDeduction: number;
}

export interface LatePenaltySettings {
  lateThreshold: number;
  penaltyPoints: number;
}

const DEFAULT_DEDUCTION_SETTINGS: DeductionSettings = {
  uniformDeduction: 10,
  hairDeduction: 10,
  nailDeduction: 5,
};

const DEDUCTION_SETTINGS_KEY = "discipline_deduction_settings";

export const getDeductionSettings = (): DeductionSettings => {
  if (typeof window === "undefined") return DEFAULT_DEDUCTION_SETTINGS;
  try {
    const stored = localStorage.getItem(DEDUCTION_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        uniformDeduction: parsed.uniformDeduction ?? DEFAULT_DEDUCTION_SETTINGS.uniformDeduction,
        hairDeduction: parsed.hairDeduction ?? DEFAULT_DEDUCTION_SETTINGS.hairDeduction,
        nailDeduction: parsed.nailDeduction ?? DEFAULT_DEDUCTION_SETTINGS.nailDeduction,
      };
    }
  } catch (e) {
    console.error("Error reading deduction settings:", e);
  }
  return DEFAULT_DEDUCTION_SETTINGS;
};

export const saveDeductionSettings = (settings: DeductionSettings): boolean => {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(DEDUCTION_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error("Error saving deduction settings:", e);
    return false;
  }
};

export const resetDeductionSettings = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(DEDUCTION_SETTINGS_KEY);
    return true;
  } catch (e) {
    console.error("Error resetting deduction settings:", e);
    return false;
  }
};

// ===== Late Penalty Settings (Database-backed) =====

const DEFAULT_LATE_PENALTY_SETTINGS: LatePenaltySettings = {
  lateThreshold: 3,
  penaltyPoints: 5,
};

export const getLatePenaltySettings = async (): Promise<{ success: boolean; settings: LatePenaltySettings | null }> => {
  try {
    const { data, error } = await supabase
      .from('late_penalty_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, settings: null };
      }
      console.error("Error fetching late penalty settings:", error);
      return { success: false, settings: null };
    }

    if (!data) {
      return { success: true, settings: null };
    }

    return {
      success: true,
      settings: {
        lateThreshold: data.late_threshold ?? DEFAULT_LATE_PENALTY_SETTINGS.lateThreshold,
        penaltyPoints: data.penalty_points ?? DEFAULT_LATE_PENALTY_SETTINGS.penaltyPoints,
      },
    };
  } catch (err) {
    console.error("Error getting late penalty settings:", err);
    return { success: false, settings: null };
  }
};

export const saveLatePenaltySettings = async (settings: LatePenaltySettings): Promise<{ success: boolean; message: string }> => {
  try {
    const { error: deleteError } = await supabase
      .from('late_penalty_settings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError && deleteError.code !== 'PGRST116') {
      console.error("Error deleting old late penalty settings:", deleteError);
    }

    const { error: insertError } = await supabase
      .from('late_penalty_settings')
      .insert({
        late_threshold: settings.lateThreshold,
        penalty_points: settings.penaltyPoints,
      });

    if (insertError) {
      console.error("Error inserting late penalty settings:", insertError);
      return { success: false, message: "ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้" };
    }

    return { success: true, message: "บันทึกการตั้งค่าการหักคะแนนมาสายเรียบร้อย" };
  } catch (err) {
    console.error("Error saving late penalty settings:", err);
    return { success: false, message: "เกิดข้อผิดพลาดในการบันทึก" };
  }
};

export const getLateCountForStudent = async (
  studentId: string,
  classroom: string,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; lateCount: number }> => {
  try {
    let query = supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('classroom', classroom)
      .eq('status', 'สาย');

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { count, error } = await query;

    if (error) {
      console.error("Error counting late attendance:", error);
      return { success: false, lateCount: 0 };
    }

    return { success: true, lateCount: count || 0 };
  } catch (err) {
    console.error("Error getting late count for student:", err);
    return { success: false, lateCount: 0 };
  }
};

// ===== Late Penalty Calculation (for statistics) =====

export const calculateLatePenaltyForStudent = async (
  studentId: string,
  classroom: string,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; lateCount: number; penaltyPoints: number }> => {
  try {
    // Get late count from attendance
    let query = supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('classroom', classroom)
      .eq('status', 'สาย');

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { count: lateCount, error: countError } = await query;

    if (countError) {
      console.error("Error counting late attendance:", countError);
      return { success: false, lateCount: 0, penaltyPoints: 0 };
    }

    const actualLateCount = lateCount || 0;

    // Get penalty settings
    const settingsRes = await getLatePenaltySettings();
    if (!settingsRes.success || !settingsRes.settings) {
      return { success: true, lateCount: actualLateCount, penaltyPoints: 0 };
    }

    const { lateThreshold, penaltyPoints } = settingsRes.settings;

    // Calculate how many times penalty should be applied
    if (lateThreshold <= 0 || penaltyPoints <= 0) {
      return { success: true, lateCount: actualLateCount, penaltyPoints: 0 };
    }

    const penaltyCount = Math.floor(actualLateCount / lateThreshold);
    const totalPenaltyPoints = penaltyCount * penaltyPoints;

    return {
      success: true,
      lateCount: actualLateCount,
      penaltyPoints: totalPenaltyPoints,
    };
  } catch (err) {
    console.error("Error calculating late penalty:", err);
    return { success: false, lateCount: 0, penaltyPoints: 0 };
  }
};
