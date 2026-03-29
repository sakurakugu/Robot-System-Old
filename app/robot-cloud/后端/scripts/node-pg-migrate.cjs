const path = require("node:path");
const net = require("node:net");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

const 项目根目录 = path.resolve(__dirname, "..");
const 云端根目录 = path.resolve(项目根目录, "..");

dotenv.config({ path: path.join(项目根目录, ".env") });

function 获取数据库连接串() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || "127.0.0.1";
  const port = process.env.DB_PORT || "5432";
  const database = process.env.DB_NAME || "robotdog";
  const user = process.env.DB_USER || "robotdog";
  const password = process.env.DB_PASSWORD || "robotdog";

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function 读取端口(value, defaultValue) {
  const port = Number.parseInt(String(value || defaultValue), 10);
  return Number.isFinite(port) ? port : defaultValue;
}

function 检查端口可连接(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const 完成 = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1500);
    socket.once("connect", () => 完成(true));
    socket.once("timeout", () => 完成(false));
    socket.once("error", () => 完成(false));
  });
}

async function 确保PostgreSQL已启动(action) {
  if (action === "create") {
    return;
  }

  const host = process.env.DB_HOST || "127.0.0.1";
  const port = 读取端口(process.env.DB_PORT, 5432);

  if (await 检查端口可连接(host, port)) {
    return;
  }

  if (!["127.0.0.1", "localhost"].includes(host)) {
    return;
  }

  const composeEnv = path.join(云端根目录, ".env");
  const args = ["compose"];
  if (require("node:fs").existsSync(composeEnv)) {
    args.push("--env-file", composeEnv);
  }
  args.push("up", "-d", "postgres");

  const result = spawnSync("docker", args, {
    cwd: 云端根目录,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error("自动启动 PostgreSQL 容器失败");
  }
}

async function 主程序() {
  const [, , action = "up", ...restArgs] = process.argv;
  const binPath = path.join(项目根目录, "node_modules", "node-pg-migrate", "bin", "node-pg-migrate.js");
  const migrationsDir = path.join(项目根目录, "migrations");

  await 确保PostgreSQL已启动(action);

  const args = [
    binPath,
    action,
    "--migrations-dir",
    migrationsDir,
    "--migrations-table",
    "pgmigrations",
    "--database-url-var",
    "DATABASE_URL",
  ];

  if (action === "create") {
    args.push("--migration-file-language", "sql");
  }

  args.push(...restArgs);

  const result = spawnSync(process.execPath, args, {
    cwd: 项目根目录,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: 获取数据库连接串(),
    },
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }

  process.exit(1);
}

主程序().catch((error) => {
  console.error(error);
  process.exit(1);
});
