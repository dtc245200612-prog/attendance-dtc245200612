# Truy vấn LogQL minh chứng

Chạy trong Grafana Explore, datasource Loki.
Chọn khoảng thời gian bao gồm lúc tạo log.

## 1. Log Nginx
    {job="docker", service="nginx"}

## 2. Lọc log Nginx chứa mã 404
    {job="docker", service="nginx"} |= " 404 "

## 3. Log ứng dụng
    {job="docker", service="app"}

Tạo request mẫu:
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8088/login
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8088/log-demo-not-found

Kết quả dự kiến lần lượt là 200 và 404.
Đợi khoảng 15–30 giây rồi chạy lại truy vấn.
