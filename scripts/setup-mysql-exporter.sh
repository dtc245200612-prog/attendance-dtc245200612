#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
umask 077

if [ ! -s secrets/mysql_exporter_password.txt ]; then
  openssl rand -hex 24 > secrets/mysql_exporter_password.txt
fi

exporter_password=$(cat secrets/mysql_exporter_password.txt)

if [[ ! "$exporter_password" =~ ^[a-f0-9]{48}$ ]]; then
  echo "File mật khẩu exporter không đúng định dạng."
  exit 1
fi

printf "CREATE USER IF NOT EXISTS 'metrics_exporter'@'%%' IDENTIFIED BY '%s' WITH MAX_USER_CONNECTIONS 3;
ALTER USER 'metrics_exporter'@'%%' IDENTIFIED BY '%s' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT ON *.* TO 'metrics_exporter'@'%%';
GRANT SELECT ON performance_schema.* TO 'metrics_exporter'@'%%';
" "$exporter_password" "$exporter_password" |
docker compose exec -T mysql sh -c '
  export MYSQL_PWD="$(cat /run/secrets/mysql_root_password)"
  exec mysql --protocol=SOCKET -u root
'

printf '[client]\nuser=metrics_exporter\npassword=%s\nhost=mysql\nport=3306\n' \
  "$exporter_password" > secrets/mysql_exporter.cnf

chmod 600 secrets/mysql_exporter_password.txt secrets/mysql_exporter.cnf
unset exporter_password
echo "MYSQL_EXPORTER_ACCOUNT_READY"
