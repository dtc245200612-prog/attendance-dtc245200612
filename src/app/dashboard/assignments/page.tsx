"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Employee = {
  id: string | number;
  employee_code: string;
  full_name: string;
};

type Shift = {
  id: string | number;
  name: string;
  start_time: string;
  end_time: string;
};

type Assignment = {
  id: string | number;
  employee_code: string;
  full_name: string;
  shift_name: string;
  starts_at: string;
  ends_at: string;
};

function vietnamTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
}

export default function AssignmentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");

    try {
      const responses = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/shifts", { cache: "no-store" }),
        fetch("/api/admin/assignments", { cache: "no-store" }),
      ]);

      if (responses.some((response) => response.status === 401)) {
        window.location.replace("/login");
        return;
      }

      if (responses.some((response) => response.status === 403)) {
        setReady(false);
        setError("Chỉ quản trị viên được phân ca.");
        return;
      }

      if (responses.some((response) => !response.ok)) {
        setError("Không thể tải dữ liệu phân ca.");
        return;
      }

      const [employeeData, shiftData, assignmentData] = await Promise.all(
        responses.map((response) => response.json()),
      );

      setEmployees(employeeData.employees);
      setShifts(shiftData.shifts);
      setAssignments(assignmentData.assignments);
      setReady(true);
    } catch {
      setError("Không thể kết nối máy chủ.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const values = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: values.get("userId"),
          shiftId: values.get("shiftId"),
          date: values.get("date"),
        }),
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? "Phân ca thất bại.");
        return;
      }

      setMessage("Đã phân ca thành công.");
      await load();
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <section className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow">
        <Link href="/dashboard" className="text-sm text-blue-600">
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Phân ca nhân viên</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ngày và giờ làm theo múi giờ Việt Nam.
        </p>

        {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
        {message && <p role="status" className="mt-4 text-green-700">{message}</p>}
        {!ready && !error && <p className="mt-4">Đang tải...</p>}

        {ready && (
          <>
            <form onSubmit={assign} className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium">
                Nhân viên
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="mt-2 block w-full rounded-lg border p-3"
                >
                  <option value="" disabled>Chọn nhân viên</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employee_code} — {employee.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Mẫu ca
                <select
                  name="shiftId"
                  required
                  defaultValue=""
                  className="mt-2 block w-full rounded-lg border p-3"
                >
                  <option value="" disabled>Chọn mẫu ca</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time.slice(0, 5)}–
                      {shift.end_time.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Ngày bắt đầu ca
                <input
                  name="date"
                  type="date"
                  required
                  min="2000-01-01"
                  max="2100-12-31"
                  className="mt-2 block w-full rounded-lg border p-3"
                />
              </label>

              <button
                disabled={saving || !employees.length || !shifts.length}
                className="rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-50 sm:col-span-3"
              >
                {saving ? "Đang lưu..." : "Phân ca"}
              </button>
            </form>

            {!shifts.length && (
              <Link href="/dashboard/shifts" className="mt-4 block text-blue-600">
                Chưa có mẫu ca. Bấm để tạo mẫu ca trước.
              </Link>
            )}

            <h2 className="mt-8 text-xl font-semibold">100 phân ca gần nhất</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="p-3">Nhân viên</th>
                    <th className="p-3">Ca</th>
                    <th className="p-3">Bắt đầu</th>
                    <th className="p-3">Kết thúc</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b">
                      <td className="p-3">
                        {assignment.employee_code} — {assignment.full_name}
                      </td>
                      <td className="p-3">{assignment.shift_name}</td>
                      <td className="p-3">{vietnamTime(assignment.starts_at)}</td>
                      <td className="p-3">{vietnamTime(assignment.ends_at)}</td>
                    </tr>
                  ))}
                  {!assignments.length && (
                    <tr>
                      <td colSpan={4} className="p-3 text-slate-600">
                        Chưa có phân ca.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
