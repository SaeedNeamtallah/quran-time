import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const distDir = process.env.NEXT_DIST_DIR || ".next-prod";
const standaloneRoot = path.join(process.cwd(), distDir, "standalone");
const nestedServer = path.join(standaloneRoot, path.basename(process.cwd()), "server.js");
const directServer = path.join(standaloneRoot, "server.js");
const serverEntry = [directServer, nestedServer].find((candidate) => existsSync(candidate));

if (!serverEntry) {
  console.error(`Could not find standalone server entry under ${standaloneRoot}. Run npm run build first.`);
  process.exit(1);
}

const child = spawn(process.execPath, [serverEntry], {
  cwd: path.dirname(serverEntry),
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
