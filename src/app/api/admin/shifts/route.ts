import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

interface ShiftRow extends RowDataPacket {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
}

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { message: "Bạn chưa đăng nhập." },
      { status: 401 },
    );
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { message: "Bạn không có quyền quản trị." },
      { status: 403 },
    );
  }

  return user;
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if (access instanceof NextResponse) return access;

    const [shifts] = await getDatabase().execute<ShiftRow[]>(
      `SELECT id, name, start_time, end_time, late_tolerance_minutes
       FROM shift_templates ORDER BY id`,
    );

    return NextResponse.json(
      { shifts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "Không thể tải danh sách ca." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const allowedOrigin =
    process.env.APP_ORIGIN ?? "http://localhost:3001";

  if (request.headers.get("origin") !== allowedOrigin) {
    return NextResponse.json(
      { message: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 },
    );
  }

  try {
    const access = await requireAdmin();
    if (access instanceof NextResponse) return access;

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Dữ liệu JSON không hợp lệ." },
        { status: 400 },
      );
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const startTime = body?.startTime;
    const endTime = body?.endTime;
    const tolerance = body?.lateToleranceMinutes ?? 5;
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
      !name ||
      name.length > 100 ||
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      !timePattern.test(startTime) ||
      !timePattern.test(endTime) ||
      startTime === endTime ||
      !Number.isInteger(tolerance) ||
      tolerance < 0 ||
      tolerance > 120
    ) {
      return NextResponse.json(
        { message: "Tên ca, giờ làm hoặc số phút cho phép trễ không hợp lệ." },
        { status: 400 },
      );
    }

    const connection = await getDatabase().getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO shift_templates
         (name, start_time, end_time, late_tolerance_minutes)
         VALUES (?, ?, ?, ?)`,
        [name, startTime, endTime, tolerance],
      );

      await connection.execute(
        `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          access.id,
          "shift.create",
          "shift_template",
          result.insertId,
          JSON.stringify({ name, startTime, endTime }),
        ],
      );

      await connection.commit();

      return NextResponse.json(
        { message: "Đã tạo mẫu ca.", id: String(result.insertId) },
        { status: 201 },
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch {
    return NextResponse.json(
      { message: "Không thể tạo mẫu ca." },
      { status: 503 },
    );
  }
}
