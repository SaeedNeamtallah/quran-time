import { getAppStatusPayload } from "@/lib/server/quran-api";
import { getCurrentRub } from "@/lib/server/rub-state";

export async function GET() {
  const currentRub = await getCurrentRub();
  const payload = await getAppStatusPayload(currentRub);
  return Response.json(payload);
}
