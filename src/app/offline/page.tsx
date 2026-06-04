export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-orange-100/60 px-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur rounded-3xl border border-orange-100 shadow-lg p-8 text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
          <span className="text-3xl">📶</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-orange-950">คุณกำลังออฟไลน์</h1>
          <p className="text-sm text-gray-600">
            แอปยังเปิดได้จากข้อมูลที่แคชไว้ หากกลับมาเชื่อมต่ออินเทอร์เน็ตแล้ว ให้ลองรีเฟรชอีกครั้งเพื่อซิงก์ข้อมูลล่าสุด
          </p>
        </div>
        <div className="text-xs text-gray-500 font-medium">
          SMD Attendance System
        </div>
      </div>
    </div>
  );
}
