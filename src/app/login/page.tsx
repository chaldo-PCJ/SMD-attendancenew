"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { KeyRound, GraduationCap, Database, RefreshCw } from "lucide-react";
import { isMockMode, setForceMockMode, getScriptUrl } from "@/lib/api";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, loginStudent } = useAuth();
  const { showToast } = useToast();

  const mockActive = isMockMode();
  const scriptUrlSet = !!getScriptUrl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      showToast("กรุณากรอกรหัสผ่าน", "warning");
      return;
    }

    setLoading(true);
    try {
      const success = await login(pin);
      if (success) {
        showToast("เข้าสู่ระบบสำเร็จ", "success");
      } else {
        showToast("รหัสผ่านไม่ถูกต้อง", "error");
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100/50">
      <Card className="max-w-md w-full shadow-2xl border-0 ring-1 ring-gray-900/5 bg-white/90 backdrop-blur-md overflow-hidden">
        <CardHeader className="text-center p-8 pb-4">
          <div className="mx-auto w-fit mb-6">
            <img
              src="/smdlogo.jpg"
              alt="SMD Logo"
              className="h-30 w-30 rounded-full object-cover shadow-sm ring-1 ring-gray-900/5"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 tracking-tight">
            SMD Attendance System
          </CardTitle>
          <CardDescription className="text-gray-500 mt-2 font-medium text-sm">
            โรงเรียนสาธิตมหาวิทยาลัยขอนแก่น ฝ่ายมัธยมศึกษา มอดินแดง
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 pt-4 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Input
                label="รหัสห้องเรียน"
                type="password"
                placeholder="กรอกรหัสห้องเรียนของคุณ"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={loading}
                className="text-center font-mono tracking-widest text-lg h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all duration-300"
              loading={loading}
            >
              <KeyRound className="h-4 w-4 mr-2" /> เข้าสู่ระบบ
            </Button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-xs font-medium uppercase tracking-wider">หรือ</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={loginStudent}
            className="w-full h-12 border-gray-200 hover:bg-gray-50 text-gray-700 font-medium flex items-center justify-center gap-2 transition-colors duration-300"
          >
            <GraduationCap className="h-5 w-5 text-gray-400" />
            <span>ตรวจสอบสถิติการมาเรียนสำหรับนักเรียน</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
