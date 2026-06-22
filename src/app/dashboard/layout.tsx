"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  Menu,
  X,
  Database,
  ClipboardCheck,
  BarChart3,
  Calendar as CalendarIcon,
  LineChart,
  Settings,
  ListChecks,
  School,
  Crown,
  UserCheck,
  Activity
} from "lucide-react";
import { isMockMode } from "@/lib/api";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly: boolean;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if not loaded/authenticated
  useEffect(() => {
    if (!isLoading && !session.role) {
      router.push("/login");
    }
  }, [session, isLoading, router]);

  if (isLoading || !session.role || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50/20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const navigation: NavigationItem[] = [
    { name: "เช็คชื่อนักเรียน", href: "/dashboard/attendance", icon: ClipboardCheck, adminOnly: false },
    { name: "ตรวจระเบียบวินัย", href: "/dashboard/uniform-check", icon: UserCheck, adminOnly: false },
    { name: "รายงานเข้าแถวรายวัน", href: "/dashboard/daily-report", icon: BarChart3, adminOnly: false },
    { name: "ปฏิทินบันทึก", href: "/dashboard/calendar", icon: CalendarIcon, adminOnly: false },
    { name: "สถิติการเข้าแถว", href: "/dashboard/statistics", icon: LineChart, adminOnly: false },
    { name: "สถิติระเบียบวินัย", href: "/dashboard/uniform-statistics", icon: ListChecks, adminOnly: false },
    { name: "จัดการระบบ", href: "/dashboard/admin", icon: Settings, adminOnly: true },
  ];

  // Filter navigation items based on user role
  const filteredNav = navigation.filter((item) => {
    if (item.adminOnly && session.role !== "admin") return false;
    return true;
  });

  return (
    <div className="min-h-screen xl:h-screen flex flex-col xl:flex-row bg-orange-50/10 overflow-x-hidden xl:overflow-hidden">

      {/* Mobile/Tablet Navbar */}
      <header className="xl:hidden bg-white border-b border-orange-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 text-gray-600 hover:bg-orange-50 rounded-lg transition-colors mr-1"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <img
            src="/smdlogo.jpg"
            alt="SMD Logo"
            className="h-10 w-10 rounded-full object-cover"
          />
          <div>
            <h1 className="font-bold text-orange-900 text-sm">SMD Attendance System</h1>
            <div className="text-[10px] text-gray-500 font-semibold">
              {session.role === "admin" ? (
                <span className="flex items-center gap-0.5 text-amber-600">
                  ผู้ดูแลระบบ <Crown className="h-3 w-3 fill-amber-500" />
                </span>
              ) : (
                `อาจารย์ประจำชั้นห้อง ${session.classroomLock}`
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isMockMode() && (
            <span className="bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
              <Database className="h-2.5 w-2.5" /> Mock
            </span>
          )}
        </div>
      </header>

      {/* Mobile/Tablet Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile/Tablet Drawer */}
      <nav
        className={`fixed top-[53px] bottom-0 left-0 w-64 bg-white border-r border-orange-100 z-30 transform transition-transform duration-300 xl:hidden flex flex-col justify-between ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="px-3 py-4 space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-200"
                  : "text-gray-700 hover:bg-orange-50 hover:text-orange-900"
                  }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-orange-600"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-orange-50">
          <button
            onClick={() => {
              logout();
              setMobileMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden xl:flex flex-col justify-between w-64 bg-white border-r border-orange-100 h-screen p-4 flex-shrink-0 shadow-sm">
        <div className="space-y-6">
          {/* Logo & Info */}
          <div className="flex items-center gap-3 px-3 py-3.5 bg-orange-50/50 rounded-2xl border border-orange-100/60">
            <img
              src="/smdlogo.jpg"
              alt="SMD Logo"
              className="h-20 w-20 rounded-full object-cover"
            />            <div>
              <h1 className="font-extrabold text-orange-950 text-base leading-tight">SMD Attendance System</h1>
              <div className="text-xs text-gray-500 font-semibold mt-0.5">
                {session.role === "admin" ? (
                  <span className="flex items-center gap-1 text-amber-600">
                    ผู้ดูแลระบบ <Crown className="h-3 w-3 fill-amber-500" />
                  </span>
                ) : (
                  `ห้องเรียน ${session.classroomLock}`
                )}
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${isActive
                    ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                    : "text-gray-700 hover:bg-orange-50 hover:text-orange-900"
                    }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-orange-600"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel */}
        <div className="space-y-3">
          {isMockMode() && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-100/40 border border-orange-200/50 text-orange-900 text-xs rounded-xl font-semibold">
              <Database className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
              <span>ใช้โหมดจำลอง (Mock DB)</span>
            </div>
          )}

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
          >
            <LogOut className="h-4 w-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-8 w-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
