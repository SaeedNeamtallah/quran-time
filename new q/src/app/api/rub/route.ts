import { getRubPayload } from "@/lib/server/quran-api";
import { getCurrentRub } from "@/lib/server/rub-state";
import { clampInt } from "@/lib/utils/normalizers";

export async function GET(request: Request) {
  const incomingUrl = new URL(request.url);
  const count = clampInt(incomingUrl.searchParams.get("count"), 1, 8, 1);
  const rubParam = incomingUrl.searchParams.get("rub_number");
  const requestedRub = rubParam === null ? await getCurrentRub() : clampInt(rubParam, 1, 240, 1);

  try {
    const payload = await getRubPayload(requestedRub, count);

    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600"
      }
    });
  } catch {
    return Response.json({ detail: "تعذر تحميل الربع من المصحف المحلي" }, { status: 503 });
  }
}
