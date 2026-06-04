import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui/toast";
import PwaRegister from "@/components/PwaRegister";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบเช็คชื่อนักเรียน - SMD Attendance System",
  description: "ระบบบันทึกและติดตามการเช็คชื่อเข้าเรียนของนักเรียน",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "เช็คชื่อ ม.ด.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${sarabun.variable} font-sans`}>
      <body className="bg-orange-50/20 text-gray-800 antialiased min-h-screen">
        <AuthProvider>
          <ToastProvider>
            <PwaRegister />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
