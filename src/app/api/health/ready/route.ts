import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";


export async function GET() {
  try {
    await getDatabase().query("SELECT 1");

    return NextResponse.json(
      { status: "ok", database: "connected" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error(
      JSON.stringify({
        level: "error",
        event: "database.health_failed",
        timestamp: new Date().toISOString(),
      }),
    );

    return NextResponse.json(
      { status: "error", database: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
