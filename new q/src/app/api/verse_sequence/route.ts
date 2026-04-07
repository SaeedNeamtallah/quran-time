import { getVerseSequencePayload } from "@/lib/server/quran-api";

export async function GET() {
  try {
    const payload = await getVerseSequencePayload();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
      }
    });
  } catch {
    return Response.json({ detail: "تعذر تحميل تسلسل الآيات" }, { status: 503 });
  }
}
