import { getChapterIndexPayload } from "@/lib/server/quran-api";

export async function GET() {
  try {
    const payload = await getChapterIndexPayload();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
      }
    });
  } catch {
    return Response.json({ detail: "تعذر تحميل فهرس السور" }, { status: 503 });
  }
}
