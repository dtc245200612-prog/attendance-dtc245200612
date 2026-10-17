"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Shift = {
  id: string | number;
  name: string;
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  async function loadShifts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/shifts", {
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (response.status === 403) {
        setAuthorized(false);
        setError("Chỉ quản trị viên được quản lý ca làm.");
        return;
      }

      if (!response.ok) {
        setError("Không thể tải danh sách ca.");
        return;
      }

      const result = await response.json();
      setShifts(result.shifts);
      setAuthorized(true);
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShifts();
  }, []);

  async function createShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const values = new FormData(form);

    try {
      const response = await fetch("/api/admin/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          startTime: values.get("startTime"),
          endTime: values.get("endTime"),
          lateToleranceMinutes: Number(values.get("tolerance")),
        }),
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? "Không thể tạo ca.");
        return;
      }

      form.reset();
      setMessage("Đã tạo mẫu ca thành công.");
      await loadShifts();
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <section className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow">
        <Link href="/dashboard" className="text-sm text-blue-600">
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Quản lý ca làm</h1>
        <p className="mt-2 text-sm text-slate-600">
          Giờ làm theo múi giờ Việt Nam. Giờ kết thúc nhỏ hơn giờ bắt đầu
          được hiểu là kết thúc vào ngày hôm sau.
        </p>

        {loading && <p className="mt-5" role="status">Đang tải...</p>}
        {error && <p className="mt-5 text-red-700" role="alert">{error}</p>}
        {message && (
          <p className="mt-5 text-green-700" role="status">{message}</p>
        )}

        {authorized && (
          <>
            <form onSubmit={createShift} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium sm:col-span-2">
                Tên ca
                <input
                  name="name"
                  required
                  maxLength={100}
                  placeholder="Ca sáng"
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Giờ bắt đầu
                <input
                  name="startTime"
                  type="time"
                  required
                  defaultValue="08:00"
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Giờ kết thúc
                <input
                  name="endTime"
                  type="time"
                  required
                  defaultValue="17:00"
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <label className="text-sm font-medium">
                Cho phép trễ (phút)
                <input
                  name="tolerance"
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  required
                  defaultValue={5}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-3"
                />
              </label>

              <div className="flex items-end">
                <button
                  disabled={saving}
                  className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Tạo mẫu ca"}
                </button>
              </div>
            </form>

            <h2 className="mt-8 text-xl font-semibold">Danh sách mẫu ca</h2>
            {shifts.length === 0 ? (
              <p className="mt-3 text-slate-600">Chưa có mẫu ca.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="p-3">Tên ca</th>
                      <th className="p-3">Bắt đầu</th>
                      <th className="p-3">Kết thúc</th>
                      <th className="p-3">Cho phép trễ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="border-b">
                        <td className="p-3">{shift.name}</td>
                        <td className="p-3">{shift.start_time.slice(0, 5)}</td>
                        <td className="p-3">{shift.end_time.slice(0, 5)}</td>
                        <td className="p-3">{shift.late_tolerance_minutes} phút</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
