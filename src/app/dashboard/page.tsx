import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "./logout-button";

async function DashboardContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <section className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            ĐỀ 27 · DTC245200612
          </p>
          <h1 className="mt-2 text-3xl font-bold">Attendance Dashboard</h1>
          <p className="mt-3">Xin chào, {user.fullName}</p>
          <p className="text-sm text-slate-600">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 rounded-xl bg-slate-100 p-5">
        <h2 className="font-semibold">
          {user.role === "ADMIN" ? "Khu vực quản trị" : "Khu vực nhân viên"}
        </h2>

        <nav className="mt-4 flex flex-wrap gap-3">
          {user.role === "ADMIN" && (
            <>
              <Link
                href="/dashboard/shifts"
                className="rounded-lg bg-blue-600 px-4 py-3 text-white"
              >
                Tạo ca / Quản lý ca
              </Link>
              <Link
                href="/dashboard/assignments"
                className="rounded-lg bg-blue-600 px-4 py-3 text-white"
              >
                Phân ca nhân viên
              </Link>
            </>
          )}

          <Link
            href="/dashboard/attendance"
            className="rounded-lg bg-slate-800 px-4 py-3 text-white"
          >
            Điểm danh / Lịch sử cá nhân
          </Link>
        </nav>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <Suspense fallback={<p role="status">Đang kiểm tra phiên đăng nhập...</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
