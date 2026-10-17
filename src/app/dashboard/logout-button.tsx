"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        setError("Đăng xuất thất bại. Vui lòng thử lại.");
        setLoading(false);
        return;
      }

      window.location.replace("/login");
    } catch {
      setError("Không thể kết nối máy chủ.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={logout}
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Đang đăng xuất..." : "Đăng xuất"}
      </button>
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    </div>
  );
}
