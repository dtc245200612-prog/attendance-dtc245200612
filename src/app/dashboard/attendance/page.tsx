"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Shift = {
  id: string | number;
  shift_name: string;
  starts_at: string;
  ends_at: string;
  late_tolerance_minutes: number;
  check_in_at: string | null;
  check_out_at: string | null;
};

function showTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
}

function attendanceStatus(shift: Shift) {
  if (!shift.check_in_at) return "Chưa check-in";

  const late =
    new Date(shift.check_in_at).getTime() >
    new Date(shift.starts_at).getTime() +
      shift.late_tolerance_minutes * 60_000;

  if (!shift.check_out_at) {
    return late ? "Đang làm · Vào trễ" : "Đang làm";
  }

  const early =
    new Date(shift.check_out_at).getTime() <
    new Date(shift.ends_at).getTime();

  return [
    "Đã check-out",
    late ? "Vào trễ" : "",
    early ? "Về sớm" : "",
  ].filter(Boolean).join(" · ");
}

export default function AttendancePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/shifts/me", {
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (!response.ok) {
        setError("Không thể tải lịch làm việc.");
        return;
      }

      const result = await response.json();
      setShifts(result.shifts);
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function attend(
    assignmentId: Shift["id"],
    action: "check-in" | "check-out",
  ) {
    setBusy(String(assignmentId));
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, action }),
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? "Điểm danh thất bại.");
        return;
      }

      setMessage(result.message);
      await load();
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <section className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow">
        <Link href="/dashboard" className="text-sm text-blue-600">
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Điểm danh của tôi</h1>
        <p className="mt-2 text-sm text-slate-600">
          Giờ hiển thị theo Việt Nam. Check-in từ 30 phút trước ca đến
          trước khi ca kết thúc. Check-out tối đa 4 giờ sau khi hết ca.
        </p>

        {loading && <p role="status" className="mt-4">Đang tải...</p>}
        {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
        {message && (
          <p role="status" className="mt-4 text-green-700">{message}</p>
        )}

        {!loading && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-3">Ca</th>
                  <th className="p-3">Lịch làm</th>
                  <th className="p-3">Check-in</th>
                  <th className="p-3">Check-out</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id} className="border-b">
                    <td className="p-3">{shift.shift_name}</td>
                    <td className="p-3">
                      <div>{showTime(shift.starts_at)}</div>
                      <div className="mt-1 text-slate-500">
                        đến {showTime(shift.ends_at)}
                      </div>
                    </td>
                    <td className="p-3">{showTime(shift.check_in_at)}</td>
                    <td className="p-3">{showTime(shift.check_out_at)}</td>
                    <td className="p-3">{attendanceStatus(shift)}</td>
                    <td className="p-3">
                      {!shift.check_out_at && (
                        <button
                          disabled={busy !== null}
                          onClick={() => attend(
                            shift.id,
                            shift.check_in_at ? "check-out" : "check-in",
                          )}
                          className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                        >
                          {busy === String(shift.id)
                            ? "Đang lưu..."
                            : shift.check_in_at ? "Check-out" : "Check-in"}
                        </button>
                      )}
                      {shift.check_out_at && "Hoàn tất"}
                    </td>
                  </tr>
                ))}

                {!shifts.length && (
                  <tr>
                    <td colSpan={6} className="p-4 text-slate-600">
                      Bạn chưa được phân ca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
