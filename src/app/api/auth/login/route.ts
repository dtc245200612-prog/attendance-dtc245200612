import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDatabase } from "@/lib/db";

interface LoginUser extends RowDataPacket {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: "ADMIN" | "EMPLOYEE";
  is_active: number;
}

const authGlobal = globalThis as typeof globalThis & {
  loginAttempts?: Map<string, { count: number; expires: number }>;
};

const attempts = authGlobal.loginAttempts ??= new Map();
const sessionSeconds = 8 * 60 * 60;

function respond(message: string, status: number) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const allowedOrigin =
    process.env.APP_ORIGIN ?? "http://localhost:3001";

  if (request.headers.get("origin") !== allowedOrigin) {
    return respond("Nguồn yêu cầu không hợp lệ.", 403);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return respond("Yêu cầu phải dùng JSON.", 415);
  }

  let email: string;
  let password: string;

  try {
    const body = await request.json();

    if (
      typeof body?.email !== "string" ||
      typeof body?.password !== "string"
    ) {
      return respond("Vui lòng nhập email và mật khẩu.", 400);
    }

    email = body.email.trim().toLowerCase();
    password = body.password;

    if (
      !email ||
      email.length > 191 ||
      !password ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return respond("Email hoặc mật khẩu không hợp lệ.", 400);
    }
  } catch {
    return respond("Dữ liệu JSON không hợp lệ.", 400);
  }

  const now = Date.now();

  for (const [key, value] of attempts) {
    if (value.expires <= now) attempts.delete(key);
  }

  const previous = attempts.get(email);

  if (previous && previous.count >= 10) {
    return respond("Thử quá nhiều lần. Hãy đợi 15 phút.", 429);
  }

  if (!previous && attempts.size >= 1000) {
    return respond("Hệ thống đang bận. Vui lòng thử lại sau.", 429);
  }

  attempts.set(email, {
    count: (previous?.count ?? 0) + 1,
    expires: previous?.expires ?? now + 15 * 60 * 1000,
  });

  try {
    const database = getDatabase();
    const [users] = await database.execute<LoginUser[]>(
      `SELECT id, full_name, email, password_hash, role, is_active
       FROM users WHERE email = ? LIMIT 1`,
      [email],
    );

    const user = users[0];

    if (
      !user ||
      !user.is_active ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return respond("Email hoặc mật khẩu không đúng.", 401);
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(now + sessionSeconds * 1000);

    await database.execute(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      [tokenHash, user.id, expiresAt],
    );

    attempts.delete(email);

    const response = NextResponse.json(
      {
        user: {
          id: String(user.id),
          fullName: user.full_name,
          email: user.email,
          role: user.role,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set("attendance_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      path: "/",
      maxAge: sessionSeconds,
      expires: expiresAt,
    });

    return response;
  } catch {
    console.error(JSON.stringify({
      level: "error",
      event: "auth.login_failed",
      timestamp: new Date().toISOString(),
    }));

    return respond("Không thể đăng nhập lúc này.", 503);
  }
}
