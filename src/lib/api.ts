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
    let query = supabase.from('attendance').select('*');
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
      return { success: false, message: "เกิดข้อผิดพลาดในการลบข้อมูลการตรวจเครื่องแต่งกายทั้งหมด" };
    }
    return { success: true, message: "ลบข้อมูลการตรวจเครื่องแต่งกายทั้งหมดสำเร็จ" };
  },
};
