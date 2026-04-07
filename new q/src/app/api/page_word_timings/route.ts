import { getPageWordTimingsPayload } from "@/lib/server/quran-api";
import { clampInt } from "@/lib/utils/normalizers";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const pageNumber = clampInt(incomingUrl.searchParams.get("page_number"), 1, 604, 1);
  const recitationId = clampInt(incomingUrl.searchParams.get("recitation_id"), 1, 1000, 7);

  try {
    const payload = await getPageWordTimingsPayload(pageNumber, recitationId);
    return Response.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "page_word_timings_not_found") {
      return Response.json({ detail: "لا توجد آيات متاحة لتوقيتات كلمات الصفحة" }, { status: 404 });
    }
    return Response.json({ detail: "تعذر تحميل آيات الصفحة الحالية لتوقيتات الكلمات" }, { status: 503 });
  }
}
