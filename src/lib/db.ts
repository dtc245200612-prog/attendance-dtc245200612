import "server-only";
import { readFileSync } from "node:fs";
import mysql, { type Pool } from "mysql2/promise";

const databaseGlobal = globalThis as typeof globalThis & {
  attendancePool?: Pool;
};

export function getDatabase(): Pool {
  if (!databaseGlobal.attendancePool) {
    const passwordFile = process.env.DB_PASSWORD_FILE;

    if (!passwordFile) {
      throw new Error("DB_PASSWORD_FILE is required");
    }

    databaseGlobal.attendancePool = mysql.createPool({
      host: process.env.DB_HOST ?? "mysql",
      port: Number(process.env.DB_PORT ?? "3306"),
      user: process.env.DB_USER ?? "attendance_app",
      database: process.env.DB_NAME ?? "attendance",
      password: readFileSync(passwordFile, "utf8").trim(),
      timezone: "Z",
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 20,
      connectTimeout: 10000,
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
  }

  return databaseGlobal.attendancePool;
}
