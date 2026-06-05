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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      showToast("กรุณากรอกรหัสผ่าน", "warning");
      return;
    }

    setLoading(true);
    // Simulate brief validation delay
    setTimeout(() => {
      const success = login(pin);
      setLoading(false);
      if (success) {
        showToast("เข้าสู่ระบบสำเร็จ", "success");
      } else {
        showToast("รหัสผ่านไม่ถูกต้อง", "error");
      }
    }, 500);
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-orange-50/50 to-orange-100/40">

      <Card className="max-w-md w-full shadow-md border-orange-100 hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="text-center bg-orange-500 text-white p-8 relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-600"></div>
          <div className="mx-auto bg-white/20 p-3 rounded-2xl w-fit mb-4">
            {/* add logo  */}
<img
  src="/smdlogo.jpg"
  alt="SMD Logo"
  className="h-45 w-45 rounded-full object-cover"
/>          </div>
          <CardTitle className="text-2xl font-bold text-white tracking-wide">
            SMD Attendance System
          </CardTitle>
          <CardDescription className="text-orange-100 mt-1.5 font-medium text-xs">
            โรงเรียนสาธิตมหาวิทยาลัยขอนแก่น ฝ่ายมัธยมศึกษา มอดินแดง
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Input
                label="รหัสห้องเรียน"
                type="password"
                placeholder="กรอกรหัสห้องเรียนของคุณ"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={loading}
                className="text-center font-mono tracking-widest text-lg"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              loading={loading}
            >
              <KeyRound className="h-4 w-4" /> เข้าสู่ระบบ
            </Button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-orange-100"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold">หรือ</span>
            <div className="flex-grow border-t border-orange-100"></div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={loginStudent}
            className="w-full h-11 border-orange-200 hover:bg-orange-50 text-orange-800 font-bold flex items-center justify-center gap-2"
          >
            <GraduationCap className="h-5 w-5 text-orange-600" /> ตรวจสอบสถิติการมาเรียนสำหรับนักเรียน
          </Button>
        </CardContent>
      </Card>
      
    </div>
  );
}
