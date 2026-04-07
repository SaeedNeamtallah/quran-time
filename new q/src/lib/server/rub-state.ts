import { promises as fs } from "node:fs";
import path from "node:path";

import { clampInt } from "@/lib/utils/normalizers";

const STATE_PATH = path.resolve(process.cwd(), "..", "state.json");

interface RubStatePayload {
  current_rub?: unknown;
}

let writeQueue: Promise<void> = Promise.resolve();

async function readRubState() {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    return JSON.parse(raw) as RubStatePayload;
  } catch {
    return null;
  }
}

export async function getCurrentRub() {
  const payload = await readRubState();
  return clampInt(payload?.current_rub, 1, 240, 1);
}

export async function setCurrentRub(nextRub: number) {
  const safeRub = clampInt(nextRub, 1, 240, 1);

  writeQueue = writeQueue.then(async () => {
    await fs.writeFile(
      STATE_PATH,
      `${JSON.stringify(
        {
          current_rub: safeRub
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  });

  await writeQueue;
  return safeRub;
}