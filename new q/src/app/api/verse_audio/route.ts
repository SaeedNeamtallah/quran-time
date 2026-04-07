import { getVerseAudioPayload } from "@/lib/server/quran-api";
import { clampInt } from "@/lib/utils/normalizers";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const verseKey = incomingUrl.searchParams.get("verse_key") || "";
  const recitationId = clampInt(incomingUrl.searchParams.get("recitation_id"), 1, 1000, 7);

  try {
    const payload = await getVerseAudioPayload(verseKey, recitationId);
    return Response.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "bad_verse_key") {
      return Response.json({ detail: "صيغة verse_key غير صحيحة" }, { status: 400 });
    }

    if (error instanceof Error && error.message === "verse_audio_not_found") {
      return Response.json({ detail: "لا يوجد ملف صوتي متاح لهذه الآية" }, { status: 404 });
    }

    return Response.json({ detail: "تعذر تحميل صوت الآية من المزود" }, { status: 503 });
  }
}
