const fs = require("node:fs");
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

function getDemoPassword(filename) {
  if (!fs.existsSync(filename)) {
    fs.writeFileSync(
      filename,
      crypto.randomBytes(18).toString("base64url"),
      { mode: 0o600, flag: "wx" },
    );
  }

  return fs.readFileSync(filename, "utf8").trim();
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: fs.readFileSync(process.env.DB_PASSWORD_FILE, "utf8").trim(),
    timezone: "Z",
  });

  try {
    const accounts = [
      {
        code: "ADMIN001",
        name: "Quản trị viên",
        email: "admin@attendance.local",
        role: "ADMIN",
        passwordFile: "/app/secrets/demo_admin_password.txt",
      },
      {
        code: "NV001",
        name: "Nhân viên Demo",
        email: "employee@attendance.local",
        role: "EMPLOYEE",
        passwordFile: "/app/secrets/demo_employee_password.txt",
      },
    ];

    for (const account of accounts) {
      const [existing] = await connection.execute(
        "SELECT id FROM users WHERE email = ?",
        [account.email],
      );

      if (existing.length > 0) {
        console.log(`Đã tồn tại, giữ nguyên: ${account.email}`);
        continue;
      }

      const password = getDemoPassword(account.passwordFile);
      const passwordHash = await bcrypt.hash(password, 12);

      await connection.execute(
        `INSERT INTO users
          (employee_code, full_name, email, password_hash, role)
         VALUES (?, ?, ?, ?, ?)`,
        [
          account.code,
          account.name,
          account.email,
          passwordHash,
          account.role,
        ],
      );

      console.log(`Đã tạo: ${account.email} (${account.role})`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Seed thất bại:", error.code || error.name);
  process.exitCode = 1;
});
