import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

interface AssignmentRow extends RowDataPacket {
  id: string;
  can_check_in: number;
  can_check_out: number;
}

interface AttendanceRow extends RowDataPacket {
  id: string;
  check_out_at: Date | null;
}

function reply(message: string, status: number) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
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

    let body;
    try {
      body = await request.json();
    } catch {
      return reply("JSON không hợp lệ.", 400);
    }

    const assignmentId = String(body?.assignmentId ?? "");
    const action = body?.action;

    if (
      !/^[1-9]\d{0,15}$/.test(assignmentId) ||
      (action !== "check-in" && action !== "check-out")
    ) {
      return reply("Phân ca hoặc hành động không hợp lệ.", 400);
    }

    const connection = await getDatabase().getConnection();

    try {
      await connection.beginTransaction();

      const [assignments] = await connection.execute<AssignmentRow[]>(
        `SELECT id,
           (UTC_TIMESTAMP(3) >= DATE_SUB(starts_at, INTERVAL 30 MINUTE)
            AND UTC_TIMESTAMP(3) < ends_at) AS can_check_in,
           (UTC_TIMESTAMP(3) <= DATE_ADD(ends_at, INTERVAL 4 HOUR))
            AS can_check_out
         FROM shift_assignments
         WHERE id = ? AND user_id = ?
         FOR UPDATE`,
        [assignmentId, user.id],
      );

      const assignment = assignments[0];

      if (!assignment) {
        await connection.rollback();
        return reply("Không tìm thấy phân ca của bạn.", 404);
      }

      const [records] = await connection.execute<AttendanceRow[]>(
        `SELECT id, check_out_at FROM attendance_records
         WHERE assignment_id = ? FOR UPDATE`,
        [assignmentId],
      );

      const record = records[0];

      if (action === "check-in") {
        if (record) {
          await connection.rollback();
          return reply("Bạn đã check-in ca này.", 409);
        }

        if (!assignment.can_check_in) {
          await connection.rollback();
          return reply("Chưa đến hoặc đã hết thời gian check-in.", 400);
        }

        await connection.execute(
          `INSERT INTO attendance_records (assignment_id, check_in_at)
           VALUES (?, UTC_TIMESTAMP(3))`,
          [assignmentId],
        );
      } else {
        if (!record) {
          await connection.rollback();
          return reply("Bạn cần check-in trước.", 400);
        }

        if (record.check_out_at) {
          await connection.rollback();
          return reply("Bạn đã check-out ca này.", 409);
        }

        if (!assignment.can_check_out) {
          await connection.rollback();
          return reply("Đã hết thời gian check-out.", 400);
        }

        await connection.execute(
          `UPDATE attendance_records SET check_out_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [record.id],
        );
      }

      await connection.execute(
        `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id)
         VALUES (?, ?, 'shift_assignment', ?)`,
        [user.id, `attendance.${action}`, assignmentId],
      );

      await connection.commit();

      console.info(JSON.stringify({
        level: "info",
        event: `attendance.${action}`,
        user_id: user.id,
        assignment_id: assignmentId,
        timestamp: new Date().toISOString(),
      }));

      return reply(
        action === "check-in" ? "Check-in thành công." : "Check-out thành công.",
        200,
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch {
    console.error(JSON.stringify({
      level: "error",
      event: "attendance.action_failed",
      timestamp: new Date().toISOString(),
    }));

    return reply("Không thể điểm danh lúc này.", 503);
  }
}
