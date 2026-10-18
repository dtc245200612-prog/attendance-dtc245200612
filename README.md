# Đề 27 — Hệ thống điểm danh Attendance

- Mã sinh viên: DTC245200612
- GitHub: dtc245200612-prog
- Môi trường: Ubuntu trên WSL 2, Docker Desktop

## Công nghệ

Next.js, React, TypeScript, MySQL 8.4, phpMyAdmin và Docker Compose.

## Tiến độ

Đã triển khai:
- Check-in/check-out và lịch sử điểm danh cá nhân.
- Kết nối Next.js với MySQL.
- Tài khoản ADMIN và EMPLOYEE, mật khẩu hash bằng bcrypt.
- Session lưu trong MySQL, đăng nhập và đăng xuất.
- Dashboard, quản lý mẫu ca và phân ca.
- Kiểm tra ca chồng nhau, hỗ trợ ca qua đêm.

Chưa hoàn thành:
- Nginx reverse proxy.
- Prometheus và Grafana.
- Loki, Promtail và LogQL.
- Kiểm tra hardening đầy đủ.

## Yêu cầu môi trường

- Ubuntu chạy WSL 2.
- Docker Desktop bật WSL Integration cho Ubuntu.
- Docker Compose và Git.
- OpenSSL để tạo mật khẩu.

Các lệnh bên dưới chạy trong Ubuntu, tại thư mục repository.

## Chuẩn bị lần đầu

Tạo cấu hình UID/GID và mật khẩu cục bộ:

```bash
printf 'LOCAL_UID=%s\nLOCAL_GID=%s\n' "$(id -u)" "$(id -g)" > .env
mkdir -p secrets

(
  umask 077
  test -f secrets/mysql_root_password.txt ||
    openssl rand -hex 24 > secrets/mysql_root_password.txt
  test -f secrets/mysql_app_password.txt ||
    openssl rand -hex 24 > secrets/mysql_app_password.txt
)
```

Cài dependencies:

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/npm-cache \
  -v "$PWD:/app" -w /app \
  node:22-bookworm-slim npm ci
```

Khởi động database và phpMyAdmin:

```bash
docker compose up -d
```

Đợi MySQL healthy bằng `docker compose ps`, sau đó nạp schema:

```bash
for schema in infra/mysql/001_schema.sql infra/mysql/002_sessions.sql; do
  docker compose exec -T mysql sh -c '
    export MYSQL_PWD="$(cat /run/secrets/mysql_app_password)"
    exec mysql --default-character-set=utf8mb4 \
      --protocol=TCP -h 127.0.0.1 \
      -u attendance_app -D attendance
  ' < "$schema" || break
done
```

Khởi động ứng dụng và tạo tài khoản demo:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d
docker compose -f compose.yaml -f compose.dev.yaml exec app node scripts/seed.cjs
```

## Truy cập

- Đăng nhập: http://localhost:3001/login
- Dashboard: http://localhost:3001/dashboard
- Quản lý ca: http://localhost:3001/dashboard/shifts
- Phân ca: http://localhost:3001/dashboard/assignments
- phpMyAdmin: http://localhost:8081
- Kiểm tra DB: http://localhost:3001/api/health/ready

Tài khoản demo:
- ADMIN: admin@attendance.local
- EMPLOYEE: employee@attendance.local

Mật khẩu demo được tạo trong `secrets/demo_admin_password.txt`
và `secrets/demo_employee_password.txt`. Không đưa các file này lên Git.

phpMyAdmin dùng tài khoản `attendance_app` và mật khẩu trong
`secrets/mysql_app_password.txt`.

## Kiểm tra và vận hành

```bash
docker compose -f compose.yaml -f compose.dev.yaml exec app npx tsc --noEmit
docker compose -f compose.yaml -f compose.dev.yaml ps
docker compose -f compose.yaml -f compose.dev.yaml logs --tail=80 app
```

Dừng, giữ nguyên dữ liệu:

```bash
docker compose -f compose.yaml -f compose.dev.yaml stop
```

Chạy lại sau khi mở Docker Desktop và Ubuntu:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d
```

Nếu app báo không tìm thấy `/app/package.json` sau khi khởi động lại WSL,
kiểm tra file `package.json` còn trên Ubuntu rồi tạo lại riêng app:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d --force-recreate --no-deps app
```

Không dùng `docker compose down -v` nếu cần giữ dữ liệu MySQL.

## Bảo mật hiện tại

- App chạy bằng UID/GID của người dùng Ubuntu, không chạy root.
- Mạng backend đặt internal; MySQL không publish cổng ra host.
- Website và phpMyAdmin bind localhost.
- Secrets và .env bị loại khỏi Git.
- Mật khẩu tài khoản được hash; database chỉ lưu hash session token.
- API quản trị kiểm tra quyền ADMIN tại backend.

Cấu hình hiện tại phục vụ development trên localhost, chưa phải bản production.

## Điểm danh nhân viên

- Trang điểm danh: http://localhost:3001/dashboard/attendance
- ADMIN tạo mẫu ca và phân ca cho nhân viên theo ngày.
- EMPLOYEE đăng nhập để xem ca và điểm danh.
- Check-in từ 30 phút trước giờ bắt đầu đến trước khi ca kết thúc.
- Check-out sau check-in, tối đa 4 giờ sau khi ca kết thúc.
- Backend kiểm tra chủ sở hữu phân ca và ngăn thao tác trùng.
- Thời gian lưu theo UTC, giao diện hiển thị giờ Việt Nam.
- Dữ liệu được lưu trong MySQL, kiểm tra qua phpMyAdmin.
