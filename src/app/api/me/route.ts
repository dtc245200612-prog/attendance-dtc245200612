import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

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

    return NextResponse.json(
      { user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error(JSON.stringify({
      level: "error",
      event: "auth.session_check_failed",
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json(
      { message: "Không thể kiểm tra phiên đăng nhập." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
