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

## Logging — mốc commit 3 của đề

Đã triển khai Loki, Promtail và datasource Loki trong Grafana.
Ba truy vấn có kết quả được ghi tại docs/logql.md.

Luồng log:
app/Nginx stdout và stderr → Docker json-file → Promtail → Loki → Grafana.

Bổ sung compose.logging.yaml vào cuối COMPOSE_FILE trong .env.
Giá trị đầy đủ:
COMPOSE_FILE=compose.yaml:compose.dev.yaml:compose.nginx.yaml:compose.monitoring.yaml:compose.cadvisor.yaml:compose.grafana.yaml:compose.logging.yaml

Thứ tự khởi động logging lần đầu:
1. Tạo đầy đủ file cấu hình trong repository.
2. Khởi động app và Nginx cùng các dependency.
3. Chạy bash scripts/update-log-targets.sh.
4. Chạy docker compose up -d loki promtail.
5. Restart Grafana để nạp datasource: docker compose restart grafana.

Kiểm tra Loki:
    curl -i http://127.0.0.1:3100/ready

Kết quả cần HTTP 200 và ready.
Loki có thể trả 503 trong thời gian khởi tạo ban đầu.

Xem log tại:
http://127.0.0.1:3002/explore
Chọn datasource Loki, chế độ Code, nhập truy vấn trong docs/logql.md.

Promtail đọc log json-file của app và Nginx từ Docker Desktop
qua local bind volume chỉ đọc, không dùng Docker socket.
Promtail chạy root để đọc log do Docker sở hữu, bỏ capabilities,
bật no-new-privileges và không publish cổng ra host.

Loki lưu log trong volume loki_data, retention 72 giờ qua compactor.
Positions của Promtail được lưu riêng trong volume promtail_positions.
Image Loki được cố định theo digest đã kiểm tra.
Promtail dùng phiên bản 3.5.0.

Sau khi app hoặc Nginx được tạo lại, ID container có thể đổi.
Bắt buộc cập nhật targets:
    bash scripts/update-log-targets.sh

Promtail tự đọc lại targets; không cần restart.
File targets.json được sinh cục bộ, không commit vào Git.

Promtail đã hết hỗ trợ ngày 02/03/2026.
Bản lab dùng Promtail theo yêu cầu đề bài.
Triển khai lâu dài cần chuyển sang Grafana Alloy.

Loki không bật xác thực; cổng chỉ bind 127.0.0.1.
Không ghi mật khẩu, token hoặc cookie vào log.
Retention Loki không thay thế rotation log file nguồn của Docker;
rotation sẽ được kiểm tra trong bước hardening.

Trạng thái tiến độ: mục Loki, Promtail và LogQL trong danh sách
chưa hoàn thành phía trên đã được hoàn thành.

## Hardening — phần 6

Đã kiểm tra các biện pháp:
- App chạy UID/GID người dùng Ubuntu, Nginx chạy 101:101.
- App và Nginx bỏ toàn bộ Linux capabilities.
- Bật no-new-privileges cho app và Nginx.
- Filesystem Nginx chỉ đọc; /tmp dùng tmpfs.
- Mạng backend internal, MySQL không publish cổng ra host.
- Các cổng giao diện chỉ bind 127.0.0.1.
- Secrets và .env không được Git theo dõi.
- Mật khẩu tài khoản được hash, session token được hash trong DB.
- Nginx có security headers.
- Tài khoản attendance_app chỉ có SELECT, INSERT, UPDATE, DELETE
  trên database attendance.
- Docker log rotation: max-size 10m, max-file 3 cho mỗi container.

Bổ sung compose.hardening.yaml vào cuối COMPOSE_FILE trong .env.
Giá trị đầy đủ:
COMPOSE_FILE=compose.yaml:compose.dev.yaml:compose.nginx.yaml:compose.monitoring.yaml:compose.cadvisor.yaml:compose.grafana.yaml:compose.logging.yaml:compose.hardening.yaml

Áp dụng quyền runtime sau khi đã tạo schema:
    docker compose exec -T mysql sh -c 'export MYSQL_PWD="$(cat /run/secrets/mysql_root_password)"; exec mysql --protocol=SOCKET -u root' < infra/mysql/003_runtime_privileges.sql

Sau khi giới hạn quyền, không dùng attendance_app để tạo hoặc sửa bảng.
Các thay đổi schema cần tài khoản quản trị hoặc migration riêng.
Nạp lại schema trên database hiện có bằng tài khoản ứng dụng sẽ bị từ chối.

Khởi động:
    docker compose up -d

Sau khi app/Nginx được tạo lại:
    bash scripts/update-log-targets.sh
    docker compose restart nginx

Kiểm tra website:
    curl -i http://localhost:8088/api/health/ready

Kiểm tra log mới:
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8088/hardening-log-check

LogQL:
    {job="docker", service="nginx"} |= "/hardening-log-check"

Kiểm tra Grafana: Nginx/MySQL UP bằng 1, CPU/RAM có dữ liệu mới.

cAdvisor dùng local bind volumes để đọc filesystem thực của
Docker Desktop, có mount riêng cho proc và cgroup.
Đã tắt metrics disk và diskIO; dashboard sử dụng CPU/RAM container.
cAdvisor vẫn là ngoại lệ privileged, chỉ dành cho collector tin cậy.
Promtail chạy root để đọc log, không privileged và không có Docker socket.

Giới hạn bản lab:
- App vẫn chạy Next.js development với mã nguồn bind mount.
- HTTP localhost có security headers, chưa cấu hình HTTPS.
- Promtail đã hết hỗ trợ; dùng theo đề bài.
- Chưa xác nhận đổi các mật khẩu demo từng xuất hiện trong ảnh.
- Bản lab chưa được xem là triển khai production.

Mục hardening trong danh sách chưa hoàn thành phía trên
đã được triển khai và kiểm tra ở phạm vi lab nêu trên.

## Kiểm tra dựng từ bản clone riêng

Đã kiểm tra:
- npm ci cài được dependencies từ lockfile.
- Khởi tạo database mới với đủ 6 bảng và seed tài khoản.
- Website qua Nginx trả HTTP 200, kết nối MySQL thành công.
- Grafana có dữ liệu Nginx và MySQL.
- cAdvisor thu metrics của 11 service thuộc project kiểm tra.
- Request thử nghiệm 404 xuất hiện trong Loki.
- Đã chuyển lại bản chính, health check trả HTTP 200.

Bản kiểm tra dùng COMPOSE_PROJECT_NAME riêng và mật khẩu mới.
Cần dừng bản chính trước khi chạy bản kiểm tra vì dùng cùng cổng host.

Dashboard hỗ trợ tên project tùy chọn khi sinh file:
    docker compose exec -e DASHBOARD_COMPOSE_PROJECT=attendance-verify-dtc245200612 app node scripts/generate-monitoring-dashboard.cjs

Nếu không truyền biến, mặc định là attendance-dtc245200612.

Khi khởi tạo mới, phải đợi MySQL healthy trước khi nạp schema.
Nạp 001_schema.sql và 002_sessions.sql bằng tài khoản quản trị.
Chạy seed, sau đó áp dụng 003_runtime_privileges.sql.
Tạo targets log sau khi app và Nginx đã chạy, trước khi bật Promtail.

## Kết quả kiểm tra dependencies ngày 18/10/2026

npm audit báo 5 mục High liên quan đến chuỗi dependency
development của ESLint, xuất phát từ braces:
GHSA-vfj7-8cjw-p6xm.

npm audit --omit=dev trả found 0 vulnerabilities tại thời điểm kiểm tra.
Điều này không chứng minh toàn bộ hệ thống không có lỗ hổng.
Bản lab vẫn dùng next dev nên không bỏ qua rủi ro development dependencies.

Không áp dụng npm audit fix --force vì đề xuất hạ
eslint-config-next xuống phiên bản major khác.
Advisory được kiểm tra khi đó chưa có bản vá.
