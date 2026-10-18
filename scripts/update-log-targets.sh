#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

target_file=$(mktemp infra/promtail/.targets-XXXXXX)
trap 'rm -f "$target_file"' EXIT

printf '[' > "$target_file"
separator=""

for service in app nginx; do
  container_id=$(docker compose ps -q "$service")

  if [[ ! "$container_id" =~ ^[a-f0-9]{64}$ ]]; then
    echo "Không tìm thấy container đang chạy: $service"
    exit 1
  fi

  driver=$(docker inspect --format '{{.HostConfig.LogConfig.Type}}' "$container_id")

  if [ "$driver" != "json-file" ]; then
    echo "Container $service không dùng json-file."
    exit 1
  fi

  log_path=$(docker inspect --format '{{.LogPath}}' "$container_id")

  if [ "$log_path" != "/var/lib/docker/containers/$container_id/$container_id-json.log" ]; then
    echo "Đường dẫn log không đúng cấu trúc dự kiến: $service"
    exit 1
  fi

  printf '%s{"targets":["localhost"],"labels":{"job":"docker","service":"%s","environment":"lab","__path__":"%s"}}' \
    "$separator" "$service" "$log_path" >> "$target_file"
  separator=","
done

printf ']\n' >> "$target_file"
chmod 644 "$target_file"
mv "$target_file" infra/promtail/targets.json

echo "LOG_TARGETS_READY"
