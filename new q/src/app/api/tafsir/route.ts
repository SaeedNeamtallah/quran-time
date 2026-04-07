import { getTafsirPayload } from "@/lib/server/quran-api";
import { clampInt } from "@/lib/utils/normalizers";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const verseKey = incomingUrl.searchParams.get("verse_key") || "";
  const tafsirId = clampInt(incomingUrl.searchParams.get("tafsir_id"), 1, 10_000, 16);

  try {
    const payload = await getTafsirPayload(verseKey, tafsirId);
    return Response.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "bad_verse_key") {
      return Response.json({ detail: "صيغة verse_key غير صحيحة" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "tafsir_not_found") {
      return Response.json({ detail: "لا يوجد تفسير متاح لهذه الآية" }, { status: 404 });
    }
    return Response.json({ detail: "تعذر تحميل التفسير من المزود" }, { status: 503 });
  }
}
