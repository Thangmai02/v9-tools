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

const worker = spawn("npx", ["tsx", "worker/index.ts"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

function shutdown(signal) {
  web.kill(signal);
  worker.kill(signal);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

web.on("exit", (code) => {
  worker.kill("SIGTERM");
  process.exit(code ?? 1);
});
worker.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`[worker] exited ${code}`);
  }
});
