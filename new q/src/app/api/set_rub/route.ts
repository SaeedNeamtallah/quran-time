import { setCurrentRub } from "@/lib/server/rub-state";
import { clampInt } from "@/lib/utils/normalizers";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    rub_number?: unknown;
  } | null;
  const rubNumber = clampInt(payload?.rub_number, 1, 240, 1);
  const currentRub = await setCurrentRub(rubNumber);

  return Response.json({
    message: "تم تحديث الربع الحالي.",
    current_rub: currentRub
  });
}
