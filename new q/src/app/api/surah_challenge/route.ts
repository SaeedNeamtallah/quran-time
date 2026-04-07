import { getSurahChallengePayload } from "@/lib/server/quran-api";
import { clampInt } from "@/lib/utils/normalizers";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const chapter = clampInt(incomingUrl.searchParams.get("chapter"), 1, 114, 18);
  const page = clampInt(incomingUrl.searchParams.get("page"), 1, 9_999, 1);
  const perPage = clampInt(incomingUrl.searchParams.get("per_page"), 1, 200, 15);

  try {
    const payload = await getSurahChallengePayload(chapter, page, perPage);
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600"
      }
    });
  } catch {
    return Response.json({ detail: "تعذر تحميل آيات السورة من مزود البيانات" }, { status: 503 });
  }
}
