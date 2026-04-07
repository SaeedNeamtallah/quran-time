import { getRubWordTimingsPayload } from "@/lib/server/quran-api";
import { clampInt } from "@/lib/utils/normalizers";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const rubNumber = clampInt(incomingUrl.searchParams.get("rub_number"), 1, 240, 1);
  const count = clampInt(incomingUrl.searchParams.get("count"), 1, 8, 1);
  const recitationId = clampInt(incomingUrl.searchParams.get("recitation_id"), 1, 1000, 7);

  try {
    const payload = await getRubWordTimingsPayload(rubNumber, count, recitationId);
    return Response.json(payload);
  } catch {
    return Response.json({ detail: "تعذر تحميل توقيتات كلمات الربع من المزود" }, { status: 503 });
  }
}
