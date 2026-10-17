import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

interface ShiftRow extends RowDataPacket {
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
}

function reply(message: string, status: number) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return reply("Bạn chưa đăng nhập.", 401);
    if (user.role !== "ADMIN") return reply("Không có quyền quản trị.", 403);

    const [assignments] = await getDatabase().query(
      `SELECT a.id, u.employee_code, u.full_name, s.name AS shift_name,
              a.starts_at, a.ends_at, a.late_tolerance_minutes
       FROM shift_assignments a
       JOIN users u ON u.id = a.user_id
       JOIN shift_templates s ON s.id = a.shift_template_id
       ORDER BY a.starts_at DESC, a.id DESC
       LIMIT 100`,
    );

    return NextResponse.json(
      { assignments },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return reply("Không thể tải lịch phân ca.", 503);
  }
}

export async function POST(request: Request) {
  if (
    request.headers.get("origin") !==
    (process.env.APP_ORIGIN ?? "http://localhost:3001")
  ) {
    return reply("Nguồn yêu cầu không hợp lệ.", 403);
  }

  try {
    const user = await getCurrentUser();
    if (!user) return reply("Bạn chưa đăng nhập.", 401);
    if (user.role !== "ADMIN") return reply("Không có quyền quản trị.", 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return reply("JSON không hợp lệ.", 400);
    }

    const userId = String(body?.userId ?? "");
    const shiftId = String(body?.shiftId ?? "");
    const date = body?.date;

    if (
      !/^[1-9]\d{0,15}$/.test(userId) ||
      !/^[1-9]\d{0,15}$/.test(shiftId) ||
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return reply("Nhân viên, mẫu ca hoặc ngày không hợp lệ.", 400);
    }

    const dayCheck = new Date(`${date}T00:00:00Z`);
    if (
      !Number.isFinite(dayCheck.getTime()) ||
      dayCheck.toISOString().slice(0, 10) !== date ||
      date < "2000-01-01" ||
      date > "2100-12-31"
    ) {
      return reply("Ngày không hợp lệ.", 400);
    }

    const connection = await getDatabase().getConnection();

    try {
      await connection.beginTransaction();

      const [employees] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM users
         WHERE id = ? AND role = 'EMPLOYEE' AND is_active = TRUE
         FOR UPDATE`,
        [userId],
      );

      if (!employees.length) {
        await connection.rollback();
        return reply("Không tìm thấy nhân viên đang hoạt động.", 404);
      }

      const [shifts] = await connection.execute<ShiftRow[]>(
        `SELECT start_time, end_time, late_tolerance_minutes
         FROM shift_templates WHERE id = ?`,
        [shiftId],
      );

      const shift = shifts[0];
      if (!shift) {
        await connection.rollback();
        return reply("Không tìm thấy mẫu ca.", 404);
      }

      const startsAt = new Date(`${date}T${shift.start_time}+07:00`);
      const endsAt = new Date(`${date}T${shift.end_time}+07:00`);

      if (endsAt <= startsAt) {
        endsAt.setTime(endsAt.getTime() + 24 * 60 * 60 * 1000);
      }

      const [overlaps] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM shift_assignments
         WHERE user_id = ? AND starts_at < ? AND ends_at > ?
         LIMIT 1 FOR UPDATE`,
        [userId, endsAt, startsAt],
      );

      if (overlaps.length) {
        await connection.rollback();
        return reply("Nhân viên đã có ca trùng khoảng thời gian này.", 409);
      }

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO shift_assignments
         (user_id, shift_template_id, starts_at, ends_at, late_tolerance_minutes)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, shiftId, startsAt, endsAt, shift.late_tolerance_minutes],
      );

      await connection.execute(
        `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id, details)
         VALUES (?, 'assignment.create', 'shift_assignment', ?, ?)`,
        [
          user.id,
          result.insertId,
          JSON.stringify({
            userId,
            shiftId,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          }),
        ],
      );

      await connection.commit();

      return NextResponse.json(
        { message: "Đã phân ca.", id: String(result.insertId) },
        { status: 201 },
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch {
    return reply("Không thể phân ca lúc này.", 503);
  }
}
