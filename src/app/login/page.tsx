"use client";

import { useState, type FormEvent } from "react";

type LoggedInUser = {
  fullName: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<LoggedInUser | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = event.currentTarget;
    const values = new FormData(form);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: values.get("email"),
          password: values.get("password"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? "Đăng nhập thất bại.");
        return;
      }

      window.location.replace("/dashboard");
      form.reset();
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <p className="text-sm font-semibold text-blue-600">
          ĐỀ 27 · DTC245200612
        </p>
        <h1 className="mt-2 text-3xl font-bold">Attendance</h1>
        <p className="mt-2 text-sm text-slate-600">
          Hệ thống điểm danh nhân viên theo ca
        </p>

        {user ? (
          <div className="mt-6" role="status">
            <p className="font-semibold text-green-700">
              Đăng nhập thành công
            </p>
            <p className="mt-3">{user.fullName}</p>
            <p className="text-sm text-slate-600">{user.email}</p>
            <p className="mt-2 text-sm">
              Vai trò: {user.role === "ADMIN" ? "Quản trị viên" : "Nhân viên"}
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={191}
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                placeholder="admin@attendance.local"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
