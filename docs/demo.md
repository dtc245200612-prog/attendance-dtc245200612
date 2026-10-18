# Kịch bản demo — Đề 27 Attendance

Sinh viên: DTC245200612

## 1. GitHub và kiến trúc

Repository:
https://github.com/dtc245200612-prog/attendance-dtc245200612

Luồng website:
Trình duyệt → Nginx → Next.js → MySQL.

Luồng metrics:
Exporters/cAdvisor → Prometheus → Grafana.

Luồng log:
Docker json-file → Promtail → Loki → Grafana.

Các mốc commit:
- Nginx: 82e499a.
- Monitoring: 2442c72.
- Logging: a468b4e.
- Hardening bổ sung: 513577c.

## 2. Chức năng điểm danh

Website: http://localhost:8088/login
phpMyAdmin: http://localhost:8081

- ADMIN tạo mẫu ca và phân ca cho NV001.
- Chọn ca nằm trong thời gian check-in của buổi demo.
- EMPLOYEE đăng nhập, check-in rồi check-out.
- Tải lại trang để chứng minh dữ liệu được lưu.
- Mở attendance_records trong phpMyAdmin, đối chiếu bản ghi.
- Giải thích check-out trước giờ kết thúc được ghi nhận về sớm.

## 3. Reverse proxy

- Chỉ rõ địa chỉ website dùng cổng 8088.
- Chạy kiểm tra cấu hình:
    docker compose exec nginx nginx -t
- Kiểm tra headers:
    curl -I http://localhost:8088/login

## 4. Monitoring

Prometheus: http://localhost:9090/targets
Grafana: http://127.0.0.1:3002/d/attendance-overview

- Bốn job prometheus, nginx, mysql, cadvisor đều UP.
- Nginx UP và MySQL UP trên dashboard bằng 1.
- Giải thích CPU/RAM theo service.
- Giải thích requests/giây, connections và statements/giây.
- Tải lại website để tạo traffic.

## 5. Logging

Grafana Explore: http://127.0.0.1:3002/explore

Tạo log:
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8088/log-demo-not-found

Chạy ba truy vấn trong docs/logql.md.
Giải thích service label và phép lọc |=.
404 là request thử nghiệm tới trang không tồn tại.

## 6. Hardening

Trình bày:
- App và Nginx non-root.
- Drop capabilities, no-new-privileges.
- Nginx filesystem chỉ đọc.
- Backend internal, không publish MySQL.
- Secrets ngoài Git, password hash và session token hash.
- DB ứng dụng chỉ có SELECT, INSERT, UPDATE, DELETE.
- Docker log rotation 10m, tối đa 3 file/container.

Ngoại lệ:
- cAdvisor privileged để thu metrics host/container.
- Promtail root để đọc log Docker, không có Docker socket.
- Lab dùng HTTP localhost và Next.js development.
- Promtail hết hỗ trợ; dùng theo đề, nên chuyển Alloy khi triển khai lâu dài.

## 7. Kết thúc demo

Dừng và giữ dữ liệu:
    docker compose stop

Không dùng down -v khi cần giữ dữ liệu.
