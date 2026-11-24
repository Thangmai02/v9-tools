import { mkdirSync } from "fs";
import { spawn } from "child_process";
import path from "path";

const dataDir = path.resolve(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });
mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.error("Thiếu DATABASE_URL Postgres (Neon/Supabase).");
  process.exit(1);
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...extraEnv },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

await run("npx", ["prisma", "migrate", "deploy"]);

const web = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", process.env.PORT || "3000"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

let worker = null;
let closing = false;

function startWorker() {
  worker = spawn("npx", ["tsx", "worker/index.ts"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  worker.on("exit", (code) => {
    if (closing) return;
    console.error(`[worker] exited ${code ?? 0}. Khởi động lại sau 2 giây.`);
    setTimeout(startWorker, 2000);
  });
}

startWorker();

function shutdown(signal) {
  closing = true;
  web.kill(signal);
  worker?.kill(signal);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

web.on("exit", (code) => {
  closing = true;
  worker?.kill("SIGTERM");
  process.exit(code ?? 1);
});
