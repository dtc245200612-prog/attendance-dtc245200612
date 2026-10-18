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

## Nginx reverse proxy — mốc commit 1 của đề

Luồng truy cập: trình duyệt → Nginx:8088 → app:3000 → MySQL.

Khởi động:
    docker compose -f compose.yaml -f compose.dev.yaml -f compose.nginx.yaml up -d

Website: http://localhost:8088/login
phpMyAdmin: http://localhost:8081

Khi chạy cùng Nginx, dùng website qua cổng 8088.
APP_ORIGIN được đặt thành http://localhost:8088.
Mục Nginx trong danh sách chưa hoàn thành phía trên đã được hoàn thành.

Kiểm tra:
    docker compose -f compose.yaml -f compose.dev.yaml -f compose.nginx.yaml exec nginx nginx -t
    curl -I http://localhost:8088/login

Security headers: X-Content-Type-Options, X-Frame-Options,
Referrer-Policy và Permissions-Policy.
Hiện dùng HTTP localhost với security headers, chưa có HTTPS.

Nginx chạy non-root, filesystem chỉ đọc, bỏ capabilities
và chỉ tham gia mạng web.

Dừng và giữ dữ liệu:
    docker compose -f compose.yaml -f compose.dev.yaml -f compose.nginx.yaml stop

## Monitoring — mốc commit 2 của đề

Đã triển khai giám sát container, Nginx và MySQL bằng
Prometheus, cAdvisor, Nginx exporter, MySQL exporter và Grafana.

Grafana được provision datasource và dashboard từ file trong Git.

Các file Compose sử dụng:
- compose.yaml
- compose.dev.yaml
- compose.nginx.yaml
- compose.monitoring.yaml
- compose.cadvisor.yaml
- compose.grafana.yaml

Bổ sung dòng sau vào .env, giữ nguyên LOCAL_UID và LOCAL_GID:
COMPOSE_FILE=compose.yaml:compose.dev.yaml:compose.nginx.yaml:compose.monitoring.yaml:compose.cadvisor.yaml:compose.grafana.yaml

Chuẩn bị MySQL exporter:
    bash scripts/setup-mysql-exporter.sh

Script tạo tài khoản giám sát và file credentials trong secrets/.
Chạy khi MySQL đã healthy, trước khi khởi động exporter.
Tài khoản exporter không có quyền ghi dữ liệu ứng dụng.

Chuẩn bị mật khẩu Grafana:
    openssl rand -hex 24

Lưu kết quả thành GRAFANA_ADMIN_PASSWORD trong .env.
Không commit mật khẩu. Biến này thiết lập mật khẩu admin khi
Grafana khởi tạo database lần đầu, không tự đổi mật khẩu đã có.

Cài dependencies ứng dụng bằng npm ci theo hướng dẫn phía trên,
rồi sinh dashboard:
    docker compose run --rm --no-deps app node scripts/generate-monitoring-dashboard.cjs

Khởi động toàn bộ hệ thống:
    docker compose up -d

Truy cập:
- Website: http://localhost:8088/login
- phpMyAdmin: http://localhost:8081
- Prometheus: http://localhost:9090
- Grafana: http://127.0.0.1:3002
- Dashboard: http://127.0.0.1:3002/d/attendance-overview

Tài khoản Grafana: admin.
Mật khẩu lấy từ GRAFANA_ADMIN_PASSWORD đã cấu hình trong .env.

Kiểm tra trên Prometheus:
- up: các job prometheus, nginx, mysql, cadvisor phải bằng 1.
- nginx_up: bằng 1.
- mysql_up: bằng 1.
- container_memory_working_set_bytes: có dữ liệu container dự án.
- rate(container_cpu_usage_seconds_total[5m]): có dữ liệu CPU.

Dashboard gồm:
- Trạng thái Nginx và MySQL.
- CPU và RAM theo service.
- Nginx requests/giây và active connections.
- MySQL connections và client statements/giây.

Prometheus giữ dữ liệu tối đa 7 ngày hoặc khoảng 1GB.
Prometheus và Grafana dùng named volumes để lưu dữ liệu.
Image Prometheus và Grafana được cố định theo digest đã kiểm tra.

cAdvisor là ngoại lệ hardening: cần privileged và quyền đọc
filesystem/cgroup/socket của Docker Desktop để thu thập metrics.
Các mount được đặt read-only; socket read-only vẫn cho phép
gọi API, nên collector này phải được coi là thành phần tin cậy.
Không publish cổng cAdvisor hoặc exporter ra host.

Dừng hệ thống, giữ dữ liệu:
    docker compose stop

Không dùng down -v nếu cần giữ dữ liệu.

Trạng thái tiến độ: mục Prometheus và Grafana trong danh sách
chưa hoàn thành phía trên đã được hoàn thành.
