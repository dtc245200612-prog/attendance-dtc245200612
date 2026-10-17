import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { getDatabase } from "@/lib/db";

interface SessionUser extends RowDataPacket {
  id: string;
  full_name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("attendance_session")?.value;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [users] = await getDatabase().execute<SessionUser[]>(
    `SELECT users.id, users.full_name, users.email, users.role
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?
       AND sessions.expires_at > UTC_TIMESTAMP(3)
       AND users.is_active = TRUE
     LIMIT 1`,
    [tokenHash],
  );

  const user = users[0];

  if (!user) {
    return null;
  }

  return {
    id: String(user.id),
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  };
}
