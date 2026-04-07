import { getPageContentPayload } from "@/lib/server/quran-api";
import { clampInt } from "@/lib/utils/normalizers";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const pageNumber = clampInt(incomingUrl.searchParams.get("page"), 1, 604, 1);

  try {
    const payload = await getPageContentPayload(pageNumber);

    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600"
      }
    });
  } catch {
    return Response.json({ detail: "تعذر تحميل الصفحة من المصحف المحلي" }, { status: 503 });
  }
}
