import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: "Bạn chưa đăng nhập." },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const [shifts] = await getDatabase().execute(
      `SELECT a.id, s.name AS shift_name,
              a.starts_at, a.ends_at, a.late_tolerance_minutes,
              r.check_in_at, r.check_out_at
       FROM shift_assignments a
       JOIN shift_templates s ON s.id = a.shift_template_id
       LEFT JOIN attendance_records r ON r.assignment_id = a.id
       WHERE a.user_id = ?
       ORDER BY a.starts_at DESC, a.id DESC
       LIMIT 100`,
      [user.id],
    );

    return NextResponse.json(
      { shifts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error(JSON.stringify({
      level: "error",
      event: "shifts.list_failed",
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json(
      { message: "Không thể tải lịch làm việc." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
