import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

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
    const cookieStore = await cookies();
    const token = cookieStore.get("attendance_session")?.value;

    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const tokenHash = createHash("sha256").update(token).digest("hex");

      await getDatabase().execute(
        "DELETE FROM sessions WHERE token_hash = ?",
        [tokenHash],
      );
    }

    const response = NextResponse.json(
      { message: "Đã đăng xuất." },
      { headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set("attendance_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: "Không thể đăng xuất lúc này." },
      { status: 503 },
    );
  }
}
