import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

interface EmployeeRow extends RowDataPacket {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
}

export async function GET() {
  try {
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

    const [employees] = await getDatabase().execute<EmployeeRow[]>(
      `SELECT id, employee_code, full_name, email
       FROM users
       WHERE role = 'EMPLOYEE' AND is_active = TRUE
       ORDER BY employee_code`,
    );

    return NextResponse.json(
      { employees },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "Không thể tải danh sách nhân viên." },
      { status: 503 },
    );
  }
}
