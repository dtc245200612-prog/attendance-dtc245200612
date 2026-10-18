const fs = require("node:fs");
const datasource = { type: "prometheus", uid: "prometheus" };
const label = "container_label_com_docker_compose_service";
const filter = 'job="cadvisor",container_label_com_docker_compose_project="attendance-dtc245200612"'.replace("attendance-dtc245200612", process.env.DASHBOARD_COMPOSE_PROJECT || "attendance-dtc245200612");

const definitions = [
  ["Nginx UP", 'nginx_up{job="nginx"}', "none", "stat"],
  ["MySQL UP", 'mysql_up{job="mysql"}', "none", "stat"],
  ["CPU container — % một lõi", `sum by (${label}) (rate(container_cpu_usage_seconds_total{${filter}}[5m])) * 100`, "percent", "timeseries"],
  ["RAM container", `sum by (${label}) (container_memory_working_set_bytes{${filter}})`, "bytes", "timeseries"],
  ["Nginx — Requests / giây", 'rate(nginx_http_requests_total{job="nginx"}[5m])', "reqps", "timeseries"],
  ["Nginx — Kết nối đang mở", 'nginx_connections_active{job="nginx"}', "short", "timeseries"],
  ["MySQL — Kết nối đang mở", 'mysql_global_status_threads_connected{job="mysql"}', "short", "timeseries"],
  ["MySQL — Client statements / giây", 'rate(mysql_global_status_questions{job="mysql"}[5m])', "ops", "timeseries"],
];

const panels = definitions.map(([title, expr, unit, type], index) => ({
  id: index + 1,
  title,
  type,
  datasource,
  gridPos: {
    x: (index % 2) * 12,
    y: Math.floor(index / 2) * 8,
    w: 12,
    h: 8,
  },
  targets: [{
    refId: "A",
    datasource,
    expr,
    legendFormat: index === 2 || index === 3 ? `{{${label}}}` : title,
    range: true,
  }],
  fieldConfig: {
    defaults: { unit, min: 0 },
    overrides: [],
  },
  options: type === "stat"
    ? {
        reduceOptions: { calcs: ["lastNotNull"], fields: "", values: false },
        graphMode: "none",
      }
    : {
        legend: { displayMode: "list", placement: "bottom" },
        tooltip: { mode: "multi" },
      },
}));

const dashboard = {
  uid: "attendance-overview",
  title: "Attendance — Container / Nginx / MySQL",
  schemaVersion: 39,
  version: 1,
  editable: false,
  timezone: "Asia/Ho_Chi_Minh",
  refresh: "15s",
  time: { from: "now-30m", to: "now" },
  panels,
};

fs.writeFileSync(
  "infra/grafana/provisioning/dashboards/json/attendance.json",
  JSON.stringify(dashboard, null, 2) + "\n",
);
console.log("DASHBOARD_FILE_READY");
