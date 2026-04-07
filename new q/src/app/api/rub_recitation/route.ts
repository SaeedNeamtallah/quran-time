import { getRubRecitationPayload } from "@/lib/server/quran-api";
import { clampInt } from "@/lib/utils/normalizers";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const rubNumber = clampInt(incomingUrl.searchParams.get("rub_number"), 1, 240, 1);
  const count = clampInt(incomingUrl.searchParams.get("count"), 1, 8, 1);
  const recitationId = clampInt(incomingUrl.searchParams.get("recitation_id"), 1, 1000, 7);

  try {
    const payload = await getRubRecitationPayload(rubNumber, count, recitationId);
    return Response.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "rub_recitation_not_found") {
      return Response.json({ detail: "لا توجد ملفات صوتية متاحة لهذا الربع" }, { status: 404 });
    }
    return Response.json({ detail: "تعذر تحميل تلاوة الربع من المزود" }, { status: 503 });
  }
}
